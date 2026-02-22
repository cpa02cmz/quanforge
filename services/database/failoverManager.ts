/**
 * Database Failover Manager
 * 
 * Manages database connection failover strategies with automatic recovery,
 * circuit breaker integration, and health monitoring.
 * 
 * Features:
 * - Automatic failover detection
 * - Multiple failover strategies
 * - Connection health monitoring
 * - Recovery orchestration
 * - Event-driven notifications
 * 
 * @module services/database/failoverManager
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../modularConstants';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('FailoverManager');

// ============================================================================
// TYPES
// ============================================================================

export type FailoverState = 
  | 'healthy'
  | 'degraded'
  | 'failing_over'
  | 'failed_over'
  | 'recovering'
  | 'unavailable';

export type FailoverStrategy = 
  | 'immediate'
  | 'graceful'
  | 'retry_then_failover'
  | 'cascade';

export interface DatabaseEndpoint {
  id: string;
  name: string;
  url: string;
  priority: number;
  region?: string;
  isPrimary: boolean;
  isActive: boolean;
  lastHealthCheck?: number;
  latency?: number;
  errorCount: number;
  successCount: number;
}

export interface FailoverConfig {
  enabled: boolean;
  strategy: FailoverStrategy;
  healthCheckIntervalMs: number;
  failureThreshold: number;
  recoveryThreshold: number;
  retryAttempts: number;
  retryDelayMs: number;
  gracefulTimeoutMs: number;
  cascadeOrder: string[];
  enableAutoRecovery: boolean;
  autoRecoveryDelayMs: number;
}

export interface FailoverEvent {
  id: string;
  timestamp: number;
  type: 'failover_start' | 'failover_complete' | 'recovery_start' | 'recovery_complete' | 'health_check_failed' | 'health_check_passed';
  fromEndpoint?: string;
  toEndpoint?: string;
  reason: string;
  duration?: number;
}

export interface FailoverStatus {
  state: FailoverState;
  activeEndpoint: DatabaseEndpoint | null;
  primaryEndpoint: DatabaseEndpoint | null;
  lastFailover?: FailoverEvent;
  totalFailovers: number;
  totalRecoveries: number;
  uptime: number;
  availability: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: FailoverConfig = {
  enabled: true,
  strategy: 'retry_then_failover',
  healthCheckIntervalMs: TIME_CONSTANTS.SECOND * 15,
  failureThreshold: 3,
  recoveryThreshold: 5,
  retryAttempts: 3,
  retryDelayMs: TIME_CONSTANTS.SECOND,
  gracefulTimeoutMs: TIME_CONSTANTS.SECOND * 30,
  cascadeOrder: [],
  enableAutoRecovery: true,
  autoRecoveryDelayMs: TIME_CONSTANTS.MINUTE * 5,
};

// ============================================================================
// FAILOVER MANAGER CLASS
// ============================================================================

/**
 * Manages database failover with health monitoring and automatic recovery
 */
export class FailoverManager {
  private static instance: FailoverManager;
  private config: FailoverConfig;
  private endpoints: Map<string, DatabaseEndpoint> = new Map();
  private activeEndpointId: string | null = null;
  private state: FailoverState = 'healthy';
  private events: FailoverEvent[] = [];
  private stats = {
    totalFailovers: 0,
    totalRecoveries: 0,
    startTime: Date.now(),
    healthyTime: 0,
    unhealthyTime: 0,
  };
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private isInitialized = false;

  private constructor(config: Partial<FailoverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<FailoverConfig>): FailoverManager {
    if (!FailoverManager.instance) {
      FailoverManager.instance = new FailoverManager(config);
    }
    return FailoverManager.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the failover manager
   */
  initialize(): void {
    if (this.isInitialized) return;

    // Start health monitoring
    if (this.config.enabled) {
      this.startHealthMonitoring();
    }

    this.isInitialized = true;
    logger.log('Failover manager initialized', {
      strategy: this.config.strategy,
      healthCheckInterval: `${this.config.healthCheckIntervalMs}ms`,
    });
  }

  /**
   * Shutdown the failover manager
   */
  shutdown(): void {
    this.stopHealthMonitoring();
    this.cancelRecovery();
    this.isInitialized = false;
    logger.log('Failover manager shutdown');
  }

  /**
   * Register a database endpoint
   */
  registerEndpoint(endpoint: Omit<DatabaseEndpoint, 'errorCount' | 'successCount'>): void {
    const fullEndpoint: DatabaseEndpoint = {
      ...endpoint,
      errorCount: 0,
      successCount: 0,
    };

    this.endpoints.set(endpoint.id, fullEndpoint);

    // Set first primary as active
    if (endpoint.isPrimary && !this.activeEndpointId) {
      this.activeEndpointId = endpoint.id;
    }

    logger.log('Registered endpoint', {
      id: endpoint.id,
      name: endpoint.name,
      isPrimary: endpoint.isPrimary,
    });
  }

  /**
   * Unregister a database endpoint
   */
  unregisterEndpoint(endpointId: string): boolean {
    if (this.activeEndpointId === endpointId) {
      logger.warn('Cannot unregister active endpoint');
      return false;
    }

    const removed = this.endpoints.delete(endpointId);
    if (removed) {
      logger.log('Unregistered endpoint', { id: endpointId });
    }
    return removed;
  }

  /**
   * Get active endpoint
   */
  getActiveEndpoint(): DatabaseEndpoint | null {
    if (!this.activeEndpointId) return null;
    return this.endpoints.get(this.activeEndpointId) || null;
  }

  /**
   * Get primary endpoint
   */
  getPrimaryEndpoint(): DatabaseEndpoint | null {
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.isPrimary) return endpoint;
    }
    return null;
  }

  /**
   * Get current failover status
   */
  getStatus(): FailoverStatus {
    const totalTime = Date.now() - this.stats.startTime;
    const availability = totalTime > 0 
      ? (this.stats.healthyTime / totalTime) * 100 
      : 100;

    return {
      state: this.state,
      activeEndpoint: this.getActiveEndpoint(),
      primaryEndpoint: this.getPrimaryEndpoint(),
      lastFailover: this.events[this.events.length - 1],
      totalFailovers: this.stats.totalFailovers,
      totalRecoveries: this.stats.totalRecoveries,
      uptime: Date.now() - this.stats.startTime,
      availability,
    };
  }

  /**
   * Get all registered endpoints
   */
  getEndpoints(): DatabaseEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Report a connection error
   */
  reportError(endpointId: string, error: Error): void {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return;

    endpoint.errorCount++;
    endpoint.lastHealthCheck = Date.now();

    logger.warn('Endpoint error reported', {
      endpointId,
      errorCount: endpoint.errorCount,
      errorMessage: error.message,
    });

    // Check if we need to failover
    if (
      endpointId === this.activeEndpointId &&
      endpoint.errorCount >= this.config.failureThreshold
    ) {
      this.triggerFailover(endpointId, `Error threshold exceeded: ${endpoint.errorCount}`);
    }
  }

  /**
   * Report a successful connection
   */
  reportSuccess(endpointId: string, latency?: number): void {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return;

    endpoint.successCount++;
    endpoint.errorCount = Math.max(0, endpoint.errorCount - 1);
    endpoint.lastHealthCheck = Date.now();
    endpoint.latency = latency;

    // Update state if recovering
    if (this.state === 'recovering' || this.state === 'degraded') {
      const successRate = endpoint.successCount / (endpoint.successCount + endpoint.errorCount);
      if (successRate >= this.config.recoveryThreshold / 10) {
        this.markHealthy(endpointId);
      }
    }
  }

  /**
   * Manually trigger failover
   */
  async triggerFailover(fromEndpointId?: string, reason: string = 'Manual failover'): Promise<boolean> {
    const sourceId = fromEndpointId || this.activeEndpointId;
    if (!sourceId) {
      logger.error('No active endpoint to failover from');
      return false;
    }

    const target = this.selectFailoverTarget(sourceId);
    if (!target) {
      logger.error('No failover target available');
      this.state = 'unavailable';
      return false;
    }

    return this.executeFailover(sourceId, target.id, reason);
  }

  /**
   * Attempt to recover to primary
   */
  async attemptRecovery(): Promise<boolean> {
    const primary = this.getPrimaryEndpoint();
    if (!primary || primary.id === this.activeEndpointId) {
      return false;
    }

    // Check if primary is healthy
    const isHealthy = await this.checkEndpointHealth(primary.id);
    if (!isHealthy) {
      logger.debug('Primary not yet healthy for recovery');
      return false;
    }

    return this.executeRecovery(primary.id);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FailoverConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart health monitoring if interval changed
    if (config.healthCheckIntervalMs !== undefined) {
      this.stopHealthMonitoring();
      this.startHealthMonitoring();
    }

    logger.log('Failover configuration updated', this.config);
  }

  /**
   * Get failover history
   */
  getEventHistory(limit: number = 50): FailoverEvent[] {
    return this.events.slice(-limit);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(
      () => this.performHealthChecks(),
      this.config.healthCheckIntervalMs
    );
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  private cancelRecovery(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
  }

  private async performHealthChecks(): Promise<void> {
    for (const endpoint of this.endpoints.values()) {
      await this.checkEndpointHealth(endpoint.id);
    }

    // Check if we should attempt recovery
    if (
      this.config.enableAutoRecovery &&
      this.state === 'failed_over' &&
      !this.recoveryTimer
    ) {
      this.scheduleRecovery();
    }
  }

  private async checkEndpointHealth(endpointId: string): Promise<boolean> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return false;

    const startTime = Date.now();

    try {
      // In a real implementation, this would make an actual database query
      // For now, we simulate health check based on error rates
      const errorRate = endpoint.errorCount / (endpoint.successCount + endpoint.errorCount + 1);
      const isHealthy = errorRate < 0.5;

      endpoint.latency = Date.now() - startTime;
      endpoint.lastHealthCheck = Date.now();
      endpoint.isActive = isHealthy;

      this.recordEvent(
        isHealthy ? 'health_check_passed' : 'health_check_failed',
        endpointId,
        undefined,
        isHealthy ? 'Health check passed' : 'Health check failed'
      );

      return isHealthy;
    } catch (error) {
      endpoint.errorCount++;
      endpoint.isActive = false;

      this.recordEvent(
        'health_check_failed',
        endpointId,
        undefined,
        `Health check error: ${error instanceof Error ? error.message : 'Unknown'}`
      );

      return false;
    }
  }

  private selectFailoverTarget(excludeId: string): DatabaseEndpoint | null {
    const candidates = Array.from(this.endpoints.values())
      .filter(e => e.id !== excludeId && e.isActive)
      .sort((a, b) => b.priority - a.priority);

    // Apply cascade order if configured
    if (this.config.cascadeOrder.length > 0) {
      for (const id of this.config.cascadeOrder) {
        const endpoint = candidates.find(c => c.id === id);
        if (endpoint) return endpoint;
      }
    }

    return candidates[0] || null;
  }

  private async executeFailover(
    fromId: string,
    toId: string,
    reason: string
  ): Promise<boolean> {
    const startTime = Date.now();
    this.state = 'failing_over';

    logger.warn('Executing failover', { fromId, toId, reason });

    // Record failover start
    this.recordEvent('failover_start', fromId, toId, reason);

    try {
      // Graceful shutdown of current connection
      if (this.config.strategy === 'graceful' || this.config.strategy === 'retry_then_failover') {
        await this.gracefulShutdown(fromId);
      }

      // Switch to new endpoint
      this.activeEndpointId = toId;
      this.state = 'failed_over';
      this.stats.totalFailovers++;

      const duration = Date.now() - startTime;

      // Record failover completion
      this.recordEvent('failover_complete', fromId, toId, 'Failover completed', duration);

      logger.warn('Failover completed', {
        fromId,
        toId,
        duration: `${duration}ms`,
        reason,
      });

      // Schedule recovery attempt if enabled
      if (this.config.enableAutoRecovery) {
        this.scheduleRecovery();
      }

      return true;
    } catch (error) {
      this.state = 'unavailable';

      logger.error('Failover failed', {
        fromId,
        toId,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      return false;
    }
  }

  private async executeRecovery(toId: string): Promise<boolean> {
    const fromId = this.activeEndpointId;
    if (!fromId) return false;

    const startTime = Date.now();
    this.state = 'recovering';

    logger.info('Executing recovery', { fromId, toId });

    this.recordEvent('recovery_start', fromId, toId, 'Recovery initiated');

    try {
      // Switch back to primary
      this.activeEndpointId = toId;
      this.state = 'healthy';
      this.stats.totalRecoveries++;

      const duration = Date.now() - startTime;

      this.recordEvent('recovery_complete', fromId, toId, 'Recovery completed', duration);

      logger.info('Recovery completed', {
        fromId,
        toId,
        duration: `${duration}ms`,
      });

      // Cancel any pending recovery
      this.cancelRecovery();

      return true;
    } catch (error) {
      this.state = 'failed_over';

      logger.error('Recovery failed', {
        fromId,
        toId,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      return false;
    }
  }

  private async gracefulShutdown(endpointId: string): Promise<void> {
    const timeout = this.config.gracefulTimeoutMs;
    const startTime = Date.now();

    // Wait for active connections to drain or timeout
    while (Date.now() - startTime < timeout) {
      // In a real implementation, check active connections
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private scheduleRecovery(): void {
    if (this.recoveryTimer) return;

    this.recoveryTimer = setTimeout(async () => {
      this.recoveryTimer = undefined;
      await this.attemptRecovery();
    }, this.config.autoRecoveryDelayMs);

    logger.debug('Recovery scheduled', {
      delay: `${this.config.autoRecoveryDelayMs}ms`,
    });
  }

  private markHealthy(endpointId: string): void {
    if (this.activeEndpointId === endpointId) {
      this.state = 'healthy';
      logger.info('Endpoint marked healthy', { endpointId });
    }
  }

  private recordEvent(
    type: FailoverEvent['type'],
    fromEndpoint?: string,
    toEndpoint?: string,
    reason: string = '',
    duration?: number
  ): void {
    const event: FailoverEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      fromEndpoint,
      toEndpoint,
      reason,
      duration,
    };

    this.events.push(event);

    // Keep only last 100 events
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }

    // Update healthy/unhealthy time tracking
    if (type === 'health_check_passed') {
      this.stats.healthyTime += this.config.healthCheckIntervalMs;
    } else if (type === 'health_check_failed') {
      this.stats.unhealthyTime += this.config.healthCheckIntervalMs;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const failoverManager = FailoverManager.getInstance();

// Register with service cleanup coordinator
serviceCleanupCoordinator.register('failoverManager', {
  cleanup: () => failoverManager.shutdown(),
  priority: 'high',
  description: 'Database failover manager service',
});

// Auto-initialize
failoverManager.initialize();
