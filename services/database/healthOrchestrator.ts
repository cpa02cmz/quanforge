/**
 * Database Health Orchestrator
 * 
 * Provides unified health management across all database services.
 * Coordinates health checks, degradation handling, and recovery procedures.
 * 
 * Features:
 * - Unified health status aggregation
 * - Service dependency tracking
 * - Automated health check scheduling
 * - Degradation level management
 * - Recovery orchestration
 * - Event-driven notifications
 * 
 * @module services/database/healthOrchestrator
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../modularConstants';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('HealthOrchestrator');

// ============================================================================
// TYPES
// ============================================================================

export type HealthLevel = 'optimal' | 'healthy' | 'degraded' | 'critical' | 'unavailable';

export interface ServiceHealth {
  id: string;
  name: string;
  level: HealthLevel;
  score: number;
  lastCheck: number;
  message: string;
  details: Record<string, unknown>;
  dependencies: string[];
}

export interface HealthOrchestratorStatus {
  overall: HealthLevel;
  overallScore: number;
  services: ServiceHealth[];
  degradedServices: string[];
  lastFullCheck: number;
  nextScheduledCheck: number;
  checkCount: number;
  recoveryInProgress: boolean;
}

export interface HealthCheckResult {
  serviceId: string;
  level: HealthLevel;
  score: number;
  message: string;
  details: Record<string, unknown>;
  timestamp: number;
}

export interface HealthEvent {
  id: string;
  timestamp: number;
  type: 'health_check' | 'degradation' | 'recovery' | 'alert';
  serviceId: string;
  previousLevel: HealthLevel;
  currentLevel: HealthLevel;
  message: string;
}

export interface HealthConfig {
  checkIntervalMs: number;
  fullCheckIntervalMs: number;
  degradedThreshold: number;
  criticalThreshold: number;
  recoveryAttempts: number;
  recoveryDelayMs: number;
  enableAutoRecovery: boolean;
  eventHistorySize: number;
}

type HealthCheckFunction = () => Promise<HealthCheckResult>;
type HealthEventHandler = (event: HealthEvent) => void;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: HealthConfig = {
  checkIntervalMs: TIME_CONSTANTS.SECOND * 30,
  fullCheckIntervalMs: TIME_CONSTANTS.MINUTE * 5,
  degradedThreshold: 70,
  criticalThreshold: 40,
  recoveryAttempts: 3,
  recoveryDelayMs: TIME_CONSTANTS.SECOND * 10,
  enableAutoRecovery: true,
  eventHistorySize: 100,
};

// ============================================================================
// HEALTH ORCHESTRATOR CLASS
// ============================================================================

/**
 * Orchestrates health management across all database services
 */
export class HealthOrchestrator {
  private static instance: HealthOrchestrator;
  private config: HealthConfig;
  private services: Map<string, {
    health: ServiceHealth;
    checkFunction: HealthCheckFunction;
  }> = new Map();
  private events: HealthEvent[] = [];
  private eventHandlers: HealthEventHandler[] = [];
  private checkTimer?: ReturnType<typeof setInterval>;
  private fullCheckTimer?: ReturnType<typeof setInterval>;
  private isRecovering = false;
  private isInitialized = false;
  
  private constructor(config: Partial<HealthConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  static getInstance(config?: Partial<HealthConfig>): HealthOrchestrator {
    if (!HealthOrchestrator.instance) {
      HealthOrchestrator.instance = new HealthOrchestrator(config);
    }
    return HealthOrchestrator.instance;
  }
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  /**
   * Initialize the health orchestrator
   */
  initialize(): void {
    if (this.isInitialized) return;
    
    this.startHealthChecks();
    this.isInitialized = true;
    
    logger.log('Health orchestrator initialized', {
      checkInterval: `${this.config.checkIntervalMs}ms`,
      autoRecovery: this.config.enableAutoRecovery,
    });
  }
  
  /**
   * Shutdown the health orchestrator
   */
  shutdown(): void {
    this.stopHealthChecks();
    this.services.clear();
    this.events = [];
    this.eventHandlers = [];
    this.isInitialized = false;
    
    logger.log('Health orchestrator shutdown');
  }
  
  /**
   * Register a service for health monitoring
   */
  registerService(
    id: string,
    name: string,
    checkFunction: HealthCheckFunction,
    dependencies: string[] = []
  ): void {
    const health: ServiceHealth = {
      id,
      name,
      level: 'healthy',
      score: 100,
      lastCheck: 0,
      message: 'Not yet checked',
      details: {},
      dependencies,
    };
    
    this.services.set(id, { health, checkFunction });
    
    logger.log('Service registered for health monitoring', {
      id,
      name,
      dependencies: dependencies.length,
    });
  }
  
  /**
   * Unregister a service from health monitoring
   */
  unregisterService(id: string): boolean {
    const removed = this.services.delete(id);
    if (removed) {
      logger.log('Service unregistered from health monitoring', { id });
    }
    return removed;
  }
  
  /**
   * Get current health status
   */
  getStatus(): HealthOrchestratorStatus {
    const services = Array.from(this.services.values()).map(s => s.health);
    const degradedServices = services
      .filter(s => s.level !== 'optimal' && s.level !== 'healthy')
      .map(s => s.id);
    
    const overall = this.calculateOverallLevel(services);
    const overallScore = this.calculateOverallScore(services);
    
    return {
      overall,
      overallScore,
      services,
      degradedServices,
      lastFullCheck: this.getLastFullCheckTime(),
      nextScheduledCheck: this.getNextCheckTime(),
      checkCount: services.length,
      recoveryInProgress: this.isRecovering,
    };
  }
  
  /**
   * Get health of a specific service
   */
  getServiceHealth(serviceId: string): ServiceHealth | null {
    const service = this.services.get(serviceId);
    return service ? { ...service.health } : null;
  }
  
  /**
   * Run health check for all services
   */
  async runFullHealthCheck(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    for (const [id, _service] of this.services) {
      try {
        const result = await this.runServiceHealthCheck(id);
        results.push(result);
      } catch (error) {
        logger.error('Health check failed for service', {
          serviceId: id,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }
    
    return results;
  }
  
  /**
   * Run health check for a specific service
   */
  async runServiceHealthCheck(serviceId: string): Promise<HealthCheckResult> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }
    
    const previousLevel = service.health.level;
    const result = await service.checkFunction();
    
    // Update service health
    service.health.level = result.level;
    service.health.score = result.score;
    service.health.lastCheck = result.timestamp;
    service.health.message = result.message;
    service.health.details = result.details;
    
    // Emit event if level changed
    if (previousLevel !== result.level) {
      this.emitEvent({
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        type: result.level === 'healthy' || result.level === 'optimal' ? 'recovery' : 'degradation',
        serviceId,
        previousLevel,
        currentLevel: result.level,
        message: `Service health changed from ${previousLevel} to ${result.level}`,
      });
    }
    
    return result;
  }
  
  /**
   * Subscribe to health events
   */
  onHealthEvent(handler: HealthEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index > -1) {
        this.eventHandlers.splice(index, 1);
      }
    };
  }
  
  /**
   * Get event history
   */
  getEventHistory(limit: number = 50): HealthEvent[] {
    return this.events.slice(-limit);
  }
  
  /**
   * Attempt recovery for degraded services
   */
  async attemptRecovery(): Promise<Record<string, boolean>> {
    if (this.isRecovering) {
      logger.warn('Recovery already in progress');
      return {};
    }
    
    this.isRecovering = true;
    const results: Record<string, boolean> = {};
    
    try {
      const degradedServices = Array.from(this.services.values())
        .filter(s => s.health.level === 'degraded' || s.health.level === 'critical')
        .map(s => s.health.id);
      
      for (const serviceId of degradedServices) {
        results[serviceId] = await this.recoverService(serviceId);
      }
      
      return results;
    } finally {
      this.isRecovering = false;
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<HealthConfig>): void {
    const previousInterval = this.config.checkIntervalMs;
    this.config = { ...this.config, ...config };
    
    if (config.checkIntervalMs && config.checkIntervalMs !== previousInterval) {
      this.stopHealthChecks();
      this.startHealthChecks();
    }
    
    logger.log('Health orchestrator configuration updated');
  }
  
  /**
   * Get dashboard data for monitoring UI
   */
  getDashboardData(): {
    summary: {
      overall: HealthLevel;
      score: number;
      servicesHealthy: number;
      servicesDegraded: number;
      servicesCritical: number;
    };
    services: Array<{
      id: string;
      name: string;
      level: HealthLevel;
      score: number;
      message: string;
    }>;
    recentEvents: HealthEvent[];
  } {
    const services = Array.from(this.services.values()).map(s => s.health);
    
    return {
      summary: {
        overall: this.calculateOverallLevel(services),
        score: this.calculateOverallScore(services),
        servicesHealthy: services.filter(s => s.level === 'healthy' || s.level === 'optimal').length,
        servicesDegraded: services.filter(s => s.level === 'degraded').length,
        servicesCritical: services.filter(s => s.level === 'critical' || s.level === 'unavailable').length,
      },
      services: services.map(s => ({
        id: s.id,
        name: s.name,
        level: s.level,
        score: s.score,
        message: s.message,
      })),
      recentEvents: this.getEventHistory(10),
    };
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  private startHealthChecks(): void {
    // Quick health checks
    this.checkTimer = setInterval(
      () => this.performQuickCheck(),
      this.config.checkIntervalMs
    );
    
    // Full health checks
    this.fullCheckTimer = setInterval(
      () => this.performFullCheck(),
      this.config.fullCheckIntervalMs
    );
    
    // Initial check
    this.performFullCheck();
  }
  
  private stopHealthChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
    if (this.fullCheckTimer) {
      clearInterval(this.fullCheckTimer);
      this.fullCheckTimer = undefined;
    }
  }
  
  private async performQuickCheck(): Promise<void> {
    // Check critical services only
    const criticalServices = ['database-core', 'connection-pool'];
    
    for (const id of criticalServices) {
      if (this.services.has(id)) {
        try {
          await this.runServiceHealthCheck(id);
        } catch (_error) {
          logger.error('Quick health check failed', { serviceId: id });
        }
      }
    }
  }
  
  private async performFullCheck(): Promise<void> {
    logger.debug('Starting full health check');
    
    await this.runFullHealthCheck();
    
    // Check for auto-recovery
    if (this.config.enableAutoRecovery && !this.isRecovering) {
      const status = this.getStatus();
      if (status.degradedServices.length > 0) {
        logger.log('Auto-recovery triggered', {
          degradedServices: status.degradedServices,
        });
        await this.attemptRecovery();
      }
    }
  }
  
  private async recoverService(serviceId: string): Promise<boolean> {
    const service = this.services.get(serviceId);
    if (!service) return false;
    
    logger.log('Attempting service recovery', { serviceId });
    
    for (let attempt = 1; attempt <= this.config.recoveryAttempts; attempt++) {
      try {
        // Run health check which may trigger internal recovery
        const result = await this.runServiceHealthCheck(serviceId);
        
        if (result.level === 'healthy' || result.level === 'optimal') {
          logger.log('Service recovered successfully', { serviceId, attempts: attempt });
          return true;
        }
        
        // Wait before next attempt
        if (attempt < this.config.recoveryAttempts) {
          await this.sleep(this.config.recoveryDelayMs);
        }
      } catch (error) {
        logger.error('Recovery attempt failed', {
          serviceId,
          attempt,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }
    
    logger.warn('Service recovery failed', {
      serviceId,
      attempts: this.config.recoveryAttempts,
    });
    
    return false;
  }
  
  private calculateOverallLevel(services: ServiceHealth[]): HealthLevel {
    if (services.length === 0) return 'healthy';
    
    const levels: HealthLevel[] = ['unavailable', 'critical', 'degraded', 'healthy', 'optimal'];
    let worstLevel: HealthLevel = 'optimal';
    
    for (const service of services) {
      if (levels.indexOf(service.level) < levels.indexOf(worstLevel)) {
        worstLevel = service.level;
      }
    }
    
    return worstLevel;
  }
  
  private calculateOverallScore(services: ServiceHealth[]): number {
    if (services.length === 0) return 100;
    
    // Weight critical services more heavily
    const criticalServices = ['database-core', 'connection-pool'];
    let totalWeight = 0;
    let weightedScore = 0;
    
    for (const service of services) {
      const weight = criticalServices.includes(service.id) ? 2 : 1;
      totalWeight += weight;
      weightedScore += service.score * weight;
    }
    
    return Math.round(weightedScore / totalWeight);
  }
  
  private getLastFullCheckTime(): number {
    let last = 0;
    for (const service of this.services.values()) {
      if (service.health.lastCheck > last) {
        last = service.health.lastCheck;
      }
    }
    return last;
  }
  
  private getNextCheckTime(): number {
    return Date.now() + this.config.checkIntervalMs;
  }
  
  private emitEvent(event: HealthEvent): void {
    this.events.push(event);
    
    // Trim event history
    if (this.events.length > this.config.eventHistorySize) {
      this.events = this.events.slice(-this.config.eventHistorySize);
    }
    
    // Notify handlers
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Event handler error', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }
    
    logger.log('Health event emitted', {
      type: event.type,
      serviceId: event.serviceId,
      previousLevel: event.previousLevel,
      currentLevel: event.currentLevel,
    });
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const healthOrchestrator = HealthOrchestrator.getInstance();

// Register with service cleanup coordinator
serviceCleanupCoordinator.register('healthOrchestrator', {
  cleanup: () => healthOrchestrator.shutdown(),
  priority: 'high',
  description: 'Database health orchestrator service',
});

// Auto-initialize
healthOrchestrator.initialize();
