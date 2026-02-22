/**
 * Database Resource Governor
 * 
 * Manages resource allocation, quotas, and throttling for database operations.
 * Ensures fair resource distribution and prevents resource exhaustion.
 * 
 * Features:
 * - Resource quota management per operation type
 * - Adaptive throttling based on system load
 * - Priority-based resource allocation
 * - Real-time resource monitoring
 * - Automatic scaling and cleanup
 * 
 * @module services/database/resourceGovernor
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../modularConstants';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('ResourceGovernor');

// ============================================================================
// TYPES
// ============================================================================

export type ResourceType = 'connections' | 'queries' | 'memory' | 'cpu' | 'io';
export type ThrottleAction = 'none' | 'delay' | 'reject' | 'queue';
export type PriorityLevel = 'critical' | 'high' | 'normal' | 'low' | 'background';

export interface ResourceQuota {
  type: ResourceType;
  maxLimit: number;
  currentUsage: number;
  reserved: number;
  available: number;
  warningThreshold: number;
  criticalThreshold: number;
}

export interface ResourceUsage {
  type: ResourceType;
  used: number;
  limit: number;
  percentage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface ThrottleConfig {
  enabled: boolean;
  action: ThrottleAction;
  delayMs: number;
  maxQueueSize: number;
  cooldownMs: number;
}

export interface OperationRequest {
  id: string;
  type: 'query' | 'transaction' | 'batch' | 'migration';
  resources: Partial<Record<ResourceType, number>>;
  priority: PriorityLevel;
  timestamp: number;
  estimatedDuration?: number;
}

export interface GovernorConfig {
  enabled: boolean;
  monitoringIntervalMs: number;
  defaultPriority: PriorityLevel;
  quotas: Record<ResourceType, {
    maxLimit: number;
    warningThreshold: number;
    criticalThreshold: number;
  }>;
  throttling: ThrottleConfig;
  autoScaling: {
    enabled: boolean;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
    minQuota: number;
    maxQuota: number;
  };
}

export interface GovernorStatus {
  isEnabled: boolean;
  quotas: ResourceQuota[];
  activeOperations: number;
  queuedOperations: number;
  throttledOperations: number;
  rejectedOperations: number;
  averageWaitTime: number;
}

export interface ResourceEvent {
  id: string;
  timestamp: number;
  type: 'quota_exceeded' | 'throttle_activated' | 'throttle_released' | 'operation_queued' | 'operation_rejected';
  resourceType: ResourceType;
  details: Record<string, unknown>;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: GovernorConfig = {
  enabled: true,
  monitoringIntervalMs: TIME_CONSTANTS.SECOND * 10,
  defaultPriority: 'normal',
  quotas: {
    connections: { maxLimit: 20, warningThreshold: 0.7, criticalThreshold: 0.9 },
    queries: { maxLimit: 100, warningThreshold: 0.7, criticalThreshold: 0.9 },
    memory: { maxLimit: 512 * 1024 * 1024, warningThreshold: 0.8, criticalThreshold: 0.95 }, // 512MB
    cpu: { maxLimit: 80, warningThreshold: 0.7, criticalThreshold: 0.9 }, // Percentage
    io: { maxLimit: 1000, warningThreshold: 0.8, criticalThreshold: 0.95 }, // IOPS
  },
  throttling: {
    enabled: true,
    action: 'delay',
    delayMs: 100,
    maxQueueSize: 50,
    cooldownMs: TIME_CONSTANTS.SECOND * 5,
  },
  autoScaling: {
    enabled: true,
    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.3,
    minQuota: 5,
    maxQuota: 100,
  },
};

// ============================================================================
// RESOURCE GOVERNOR CLASS
// ============================================================================

/**
 * Manages database resource allocation and throttling
 */
export class ResourceGovernor {
  private static instance: ResourceGovernor;
  private config: GovernorConfig;
  private quotas: Map<ResourceType, ResourceQuota> = new Map();
  private activeOperations: Map<string, OperationRequest> = new Map();
  private operationQueue: OperationRequest[] = [];
  private events: ResourceEvent[] = [];
  private stats = {
    throttled: 0,
    rejected: 0,
    queued: 0,
    totalWaitTime: 0,
    waitCount: 0,
  };
  private monitoringTimer?: ReturnType<typeof setInterval>;
  private isInitialized = false;
  private isThrottling = false;

  private constructor(config: Partial<GovernorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeQuotas();
  }

  static getInstance(config?: Partial<GovernorConfig>): ResourceGovernor {
    if (!ResourceGovernor.instance) {
      ResourceGovernor.instance = new ResourceGovernor(config);
    }
    return ResourceGovernor.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the resource governor
   */
  initialize(): void {
    if (this.isInitialized) return;

    this.startMonitoring();
    this.isInitialized = true;

    logger.log('Resource governor initialized', {
      enabled: this.config.enabled,
      quotas: Object.keys(this.config.quotas).length,
      throttling: this.config.throttling.enabled,
    });
  }

  /**
   * Shutdown the resource governor
   */
  shutdown(): void {
    this.stopMonitoring();
    this.quotas.clear();
    this.activeOperations.clear();
    this.operationQueue = [];
    this.events = [];
    this.isInitialized = false;

    logger.log('Resource governor shutdown');
  }

  /**
   * Request resources for an operation
   */
  async acquire(request: Omit<OperationRequest, 'id' | 'timestamp'>): Promise<{
    granted: boolean;
    requestId: string;
    waitTime?: number;
    message: string;
  }> {
    if (!this.config.enabled) {
      return {
        granted: true,
        requestId: this.generateId(),
        message: 'Resource governor disabled',
      };
    }

    const fullRequest: OperationRequest = {
      ...request,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    // Check if resources are available
    const availability = this.checkAvailability(fullRequest);

    if (availability.available) {
      this.allocateResources(fullRequest);
      return {
        granted: true,
        requestId: fullRequest.id,
        message: 'Resources allocated successfully',
      };
    }

    // Handle resource contention
    return this.handleContention(fullRequest);
  }

  /**
   * Release resources after operation completion
   */
  release(requestId: string): boolean {
    const request = this.activeOperations.get(requestId);
    if (!request) return false;

    // Release allocated resources
    for (const [type, amount] of Object.entries(request.resources)) {
      const quota = this.quotas.get(type as ResourceType);
      if (quota && amount) {
        quota.currentUsage -= amount;
        quota.reserved -= amount;
      }
    }

    this.activeOperations.delete(requestId);

    // Process queued operations
    this.processQueue();

    logger.debug('Resources released', { requestId });
    return true;
  }

  /**
   * Get current governor status
   */
  getStatus(): GovernorStatus {
    const quotas = Array.from(this.quotas.values()).map(q => ({
      ...q,
      available: q.maxLimit - q.currentUsage - q.reserved,
    }));

    return {
      isEnabled: this.config.enabled,
      quotas,
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      throttledOperations: this.stats.throttled,
      rejectedOperations: this.stats.rejected,
      averageWaitTime: this.stats.waitCount > 0 
        ? this.stats.totalWaitTime / this.stats.waitCount 
        : 0,
    };
  }

  /**
   * Get resource usage report
   */
  getResourceUsage(): ResourceUsage[] {
    return Array.from(this.quotas.entries()).map(([type, quota]) => ({
      type,
      used: quota.currentUsage,
      limit: quota.maxLimit,
      percentage: (quota.currentUsage / quota.maxLimit) * 100,
      trend: this.calculateTrend(type),
    }));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GovernorConfig>): void {
    this.config = { ...this.config, ...config };

    // Reinitialize quotas if changed
    if (config.quotas) {
      this.initializeQuotas();
    }

    // Restart monitoring if interval changed
    if (config.monitoringIntervalMs !== undefined) {
      this.stopMonitoring();
      this.startMonitoring();
    }

    logger.log('Resource governor configuration updated');
  }

  /**
   * Set quota for a specific resource
   */
  setQuota(type: ResourceType, maxLimit: number): void {
    const existing = this.quotas.get(type);
    if (existing) {
      existing.maxLimit = maxLimit;
    } else {
      this.quotas.set(type, {
        type,
        maxLimit,
        currentUsage: 0,
        reserved: 0,
        available: maxLimit,
        warningThreshold: this.config.quotas[type]?.warningThreshold || 0.7,
        criticalThreshold: this.config.quotas[type]?.criticalThreshold || 0.9,
      });
    }

    logger.log('Quota updated', { type, maxLimit });
  }

  /**
   * Force release all resources for a type
   */
  forceReleaseAll(type: ResourceType): number {
    let released = 0;

    for (const [id, request] of this.activeOperations) {
      if (request.resources[type]) {
        this.release(id);
        released++;
      }
    }

    if (released > 0) {
      logger.warn('Force released all resources', { type, count: released });
    }

    return released;
  }

  /**
   * Get event history
   */
  getEventHistory(limit: number = 50): ResourceEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Check if throttling is active
   */
  isThrottlingActive(): boolean {
    return this.isThrottling;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private initializeQuotas(): void {
    for (const [type, config] of Object.entries(this.config.quotas)) {
      this.quotas.set(type as ResourceType, {
        type: type as ResourceType,
        maxLimit: config.maxLimit,
        currentUsage: 0,
        reserved: 0,
        available: config.maxLimit,
        warningThreshold: config.warningThreshold,
        criticalThreshold: config.criticalThreshold,
      });
    }
  }

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(
      () => this.performMonitoring(),
      this.config.monitoringIntervalMs
    );
  }

  private stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
  }

  private performMonitoring(): void {
    // Check quota levels and adjust
    for (const [type, quota] of this.quotas) {
      const usage = quota.currentUsage / quota.maxLimit;

      // Auto-scale if enabled
      if (this.config.autoScaling.enabled) {
        this.autoScale(type, usage);
      }

      // Check for threshold breaches
      if (usage >= quota.criticalThreshold) {
        this.emitEvent('quota_exceeded', type, {
          usage: usage * 100,
          threshold: quota.criticalThreshold * 100,
        });

        if (!this.isThrottling && this.config.throttling.enabled) {
          this.activateThrottling();
        }
      } else if (usage < quota.warningThreshold && this.isThrottling) {
        this.deactivateThrottling();
      }
    }

    // Clean up stale operations
    this.cleanupStaleOperations();
  }

  private checkAvailability(request: OperationRequest): { available: boolean; shortage: Partial<Record<ResourceType, number>> } {
    const shortage: Partial<Record<ResourceType, number>> = {};
    let available = true;

    for (const [type, requested] of Object.entries(request.resources)) {
      const quota = this.quotas.get(type as ResourceType);
      if (!quota || !requested) continue;

      const needed = quota.currentUsage + quota.reserved + requested;
      if (needed > quota.maxLimit) {
        shortage[type as ResourceType] = needed - quota.maxLimit;
        available = false;
      }
    }

    return { available, shortage };
  }

  private async handleContention(request: OperationRequest): Promise<{
    granted: boolean;
    requestId: string;
    waitTime?: number;
    message: string;
  }> {
    const action = this.config.throttling.action;

    switch (action) {
      case 'reject':
        this.stats.rejected++;
        this.emitEvent('operation_rejected', 'queries', { request });
        return {
          granted: false,
          requestId: request.id,
          message: 'Resources unavailable, operation rejected',
        };

      case 'delay':
        return this.delayOperation(request);

      case 'queue':
        return this.queueOperation(request);

      case 'none':
      default:
        // Allow operation anyway (degraded mode)
        this.allocateResources(request);
        return {
          granted: true,
          requestId: request.id,
          message: 'Resources allocated (degraded mode)',
        };
    }
  }

  private async delayOperation(request: OperationRequest): Promise<{
    granted: boolean;
    requestId: string;
    waitTime?: number;
    message: string;
  }> {
    const delayMs = this.config.throttling.delayMs;
    this.stats.throttled++;

    await this.sleep(delayMs);

    // Retry after delay
    const availability = this.checkAvailability(request);
    if (availability.available) {
      this.allocateResources(request);
      return {
        granted: true,
        requestId: request.id,
        waitTime: delayMs,
        message: 'Resources allocated after delay',
      };
    }

    // Still not available, queue it
    return this.queueOperation(request);
  }

  private queueOperation(request: OperationRequest): Promise<{
    granted: boolean;
    requestId: string;
    waitTime?: number;
    message: string;
  }> {
    if (this.operationQueue.length >= this.config.throttling.maxQueueSize) {
      this.stats.rejected++;
      this.emitEvent('operation_rejected', 'queries', { reason: 'queue_full' });
      return Promise.resolve({
        granted: false,
        requestId: request.id,
        message: 'Operation queue full, request rejected',
      });
    }

    this.operationQueue.push(request);
    this.stats.queued++;
    this.emitEvent('operation_queued', 'queries', { position: this.operationQueue.length });

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const availability = this.checkAvailability(request);
        if (availability.available) {
          clearInterval(checkInterval);
          this.allocateResources(request);
          const waitTime = Date.now() - request.timestamp;
          this.stats.totalWaitTime += waitTime;
          this.stats.waitCount++;
          resolve({
            granted: true,
            requestId: request.id,
            waitTime,
            message: 'Resources allocated from queue',
          });
        }
      }, 100);
    });
  }

  private allocateResources(request: OperationRequest): void {
    for (const [type, amount] of Object.entries(request.resources)) {
      const quota = this.quotas.get(type as ResourceType);
      if (quota && amount) {
        quota.currentUsage += amount;
      }
    }

    this.activeOperations.set(request.id, request);
  }

  private processQueue(): void {
    if (this.operationQueue.length === 0) return;

    // Process queued operations in priority order
    const sorted = [...this.operationQueue].sort((a, b) => {
      const priorityOrder: PriorityLevel[] = ['critical', 'high', 'normal', 'low', 'background'];
      return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    });

    for (const request of sorted) {
      const availability = this.checkAvailability(request);
      if (availability.available) {
        const index = this.operationQueue.indexOf(request);
        if (index > -1) {
          this.operationQueue.splice(index, 1);
          this.allocateResources(request);
        }
      }
    }
  }

  private activateThrottling(): void {
    this.isThrottling = true;
    this.emitEvent('throttle_activated', 'queries', {});
    logger.warn('Throttling activated due to high resource usage');
  }

  private deactivateThrottling(): void {
    this.isThrottling = false;
    this.emitEvent('throttle_released', 'queries', {});
    logger.log('Throttling deactivated');
  }

  private autoScale(type: ResourceType, usage: number): void {
    const quota = this.quotas.get(type);
    if (!quota) return;

    const { scaleUpThreshold, scaleDownThreshold, minQuota, maxQuota } = this.config.autoScaling;

    if (usage >= scaleUpThreshold && quota.maxLimit < maxQuota) {
      const newLimit = Math.min(quota.maxLimit * 1.2, maxQuota);
      quota.maxLimit = Math.round(newLimit);
      logger.log('Auto-scaled quota up', { type, newLimit: quota.maxLimit });
    } else if (usage <= scaleDownThreshold && quota.maxLimit > minQuota) {
      const newLimit = Math.max(quota.maxLimit * 0.8, minQuota);
      quota.maxLimit = Math.round(newLimit);
      logger.log('Auto-scaled quota down', { type, newLimit: quota.maxLimit });
    }
  }

  private cleanupStaleOperations(): void {
    const staleThreshold = Date.now() - TIME_CONSTANTS.MINUTE * 5;

    for (const [id, request] of this.activeOperations) {
      if (request.timestamp < staleThreshold) {
        logger.warn('Cleaning up stale operation', { requestId: id });
        this.release(id);
      }
    }
  }

  private calculateTrend(type: ResourceType): 'increasing' | 'stable' | 'decreasing' {
    // Simplified trend calculation based on recent events
    const recentEvents = this.events
      .filter(e => e.resourceType === type && e.timestamp > Date.now() - TIME_CONSTANTS.MINUTE)
      .slice(-10);

    if (recentEvents.length < 2) return 'stable';

    const exceededCount = recentEvents.filter(e => e.type === 'quota_exceeded').length;
    if (exceededCount > recentEvents.length / 2) return 'increasing';

    return 'stable';
  }

  private emitEvent(
    type: ResourceEvent['type'],
    resourceType: ResourceType,
    details: Record<string, unknown>
  ): void {
    const event: ResourceEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      resourceType,
      details,
    };

    this.events.push(event);

    // Keep only recent events
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const resourceGovernor = ResourceGovernor.getInstance();

// Register with service cleanup coordinator
serviceCleanupCoordinator.register('resourceGovernor', {
  cleanup: () => resourceGovernor.shutdown(),
  priority: 'high',
  description: 'Database resource governor service',
});

// Auto-initialize
resourceGovernor.initialize();
