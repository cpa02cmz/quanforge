/**
 * Integration Orchestrator - Unified External Integration Management
 * 
 * Provides centralized management for all external integrations including:
 * - Health monitoring and status tracking
 * - Circuit breaker coordination
 * - Graceful degradation management
 * - Event-driven state notifications
 * - Integration lifecycle management
 * - Metrics collection and reporting
 */

import { createScopedLogger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/errorHandler';
import { TIMEOUTS, MEMORY_LIMITS } from '../../constants';
import {
  IntegrationStatus,
  IntegrationPriority,
  IntegrationEventType,
  type IntegrationEvent,
  type IntegrationEventListener,
  type IntegrationConfig,
  type IntegrationHealthCheckResult,
  type IntegrationStatusInfo,
  type IntegrationSystemSummary,
  type IntegrationMetrics,
  type InitializationResult,
  type IntegrationDiagnostic,
  type OrchestratorConfig,
} from './types';
import { CircuitBreakerState } from '../integrationResilience';
import { circuitBreakerMonitor } from '../circuitBreakerMonitor';
import { integrationHealthMonitor, integrationMetrics } from '../integrationHealthMonitor';
import { degradedModeManager } from '../fallbackStrategies';

const logger = createScopedLogger('integration-orchestrator');

/**
 * Default orchestrator configuration
 */
const DEFAULT_CONFIG: OrchestratorConfig = {
  healthCheckInterval: TIMEOUTS.HEALTH_CHECK || 30000,
  metricsRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
  enableAutoRecovery: true,
  recoveryOptions: {
    maxAttempts: 3,
    delayBetweenAttempts: 5000,
    exponentialBackoff: true,
    notifyOnChange: true,
  },
  enableEventBus: true,
  maxConcurrentHealthChecks: 5,
};

/**
 * Integration Orchestrator
 * 
 * Central management point for all external integrations
 */
export class IntegrationOrchestrator {
  private static instance: IntegrationOrchestrator | null = null;
  
  private readonly integrations = new Map<string, IntegrationConfig>();
  private readonly integrationStatus = new Map<string, IntegrationStatusInfo>();
  private readonly eventListeners = new Map<IntegrationEventType, Set<IntegrationEventListener>>();
  private readonly recentEvents: IntegrationEvent[] = [];
  private readonly config: OrchestratorConfig;
  
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private isInitialized = false;
  private initializationTime?: Date;

  private constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('Integration Orchestrator created', { config: this.config });
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<OrchestratorConfig>): IntegrationOrchestrator {
    if (!IntegrationOrchestrator.instance) {
      IntegrationOrchestrator.instance = new IntegrationOrchestrator(config);
    }
    return IntegrationOrchestrator.instance;
  }

  /**
   * Initialize the orchestrator with all registered integrations
   */
  async initialize(): Promise<InitializationResult[]> {
    if (this.isInitialized) {
      logger.warn('Integration Orchestrator already initialized');
      return [];
    }

    logger.info('Initializing Integration Orchestrator...');
    this.initializationTime = new Date();
    const results: InitializationResult[] = [];

    // Sort integrations by priority
    const sortedIntegrations = Array.from(this.integrations.values())
      .sort((a, b) => a.priority - b.priority);

    // Initialize integrations in priority order
    for (const integration of sortedIntegrations) {
      const result = await this.initializeIntegration(integration);
      results.push(result);
    }

    // Start health monitoring
    this.startHealthMonitoring();
    
    this.isInitialized = true;
    logger.info('Integration Orchestrator initialized', {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });

    return results;
  }

  /**
   * Initialize a single integration
   */
  private async initializeIntegration(integration: IntegrationConfig): Promise<InitializationResult> {
    const startTime = Date.now();
    const result: InitializationResult = {
      name: integration.name,
      success: false,
      duration: 0,
      dependenciesMet: true,
      skippedDependencies: [],
    };

    try {
      // Check dependencies
      if (integration.dependencies) {
        for (const depName of integration.dependencies) {
          const depStatus = this.integrationStatus.get(depName);
          if (!depStatus || !depStatus.healthy) {
            result.dependenciesMet = false;
            result.skippedDependencies.push(depName);
          }
        }
      }

      // Perform initial health check
      const healthResult = await this.performHealthCheck(integration);
      
      result.success = healthResult.healthy;
      result.duration = Date.now() - startTime;

      // Update status
      this.updateIntegrationStatus(integration, healthResult);

      // Register with health monitor
      integrationHealthMonitor.registerHealthCheck({
        integrationType: integration.type,
        integrationName: integration.name,
        check: async () => {
          const result = await integration.healthCheck();
          return {
            success: result.healthy,
            latency: result.latency,
            error: result.error,
          };
        },
        interval: this.config.healthCheckInterval,
        onHealthChange: (status) => {
          this.handleHealthChange(integration, status);
        },
      });

      this.emitEvent({
        type: IntegrationEventType.INTEGRATION_REGISTERED,
        integrationType: integration.type,
        integrationName: integration.name,
        timestamp: new Date(),
        data: { priority: integration.priority },
      });

      logger.info(`Integration ${integration.name} initialized`, {
        success: result.success,
        duration: result.duration,
        latency: healthResult.latency,
      });

    } catch (error) {
      result.duration = Date.now() - startTime;
      result.error = getErrorMessage(error);
      
      this.updateIntegrationStatus(integration, {
        healthy: false,
        latency: result.duration,
        error: result.error,
      });

      logger.error(`Failed to initialize integration ${integration.name}:`, error);
    }

    return result;
  }

  /**
   * Register a new integration
   */
  registerIntegration(config: IntegrationConfig): void {
    if (this.integrations.has(config.name)) {
      logger.warn(`Integration ${config.name} already registered, updating`);
    }

    this.integrations.set(config.name, config);
    
    // Initialize status
    this.integrationStatus.set(config.name, {
      name: config.name,
      type: config.type,
      status: IntegrationStatus.UNKNOWN,
      priority: config.priority,
      healthy: false,
      lastHealthCheck: new Date(),
      latency: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      circuitBreakerState: CircuitBreakerState.CLOSED,
      degradedLevel: 1,
      uptime: 100,
      errorRate: 0,
      metadata: config.metadata,
    });

    logger.info(`Integration ${config.name} registered`, {
      type: config.type,
      priority: config.priority,
      dependencies: config.dependencies,
    });
  }

  /**
   * Unregister an integration
   */
  async unregisterIntegration(name: string): Promise<void> {
    const integration = this.integrations.get(name);
    if (!integration) {
      logger.warn(`Integration ${name} not found for unregistration`);
      return;
    }

    // Graceful shutdown if available
    if (integration.gracefulShutdown) {
      try {
        await integration.gracefulShutdown();
      } catch (error) {
        logger.error(`Error during graceful shutdown of ${name}:`, error);
      }
    }

    // Unregister from health monitor
    integrationHealthMonitor.unregisterHealthCheck(integration.type, name);

    this.integrations.delete(name);
    this.integrationStatus.delete(name);

    this.emitEvent({
      type: IntegrationEventType.INTEGRATION_UNREGISTERED,
      integrationType: integration.type,
      integrationName: name,
      timestamp: new Date(),
    });

    logger.info(`Integration ${name} unregistered`);
  }

  /**
   * Get status of a specific integration
   */
  getStatus(name: string): IntegrationStatusInfo | undefined {
    return this.integrationStatus.get(name);
  }

  /**
   * Get status of all integrations
   */
  getAllStatuses(): Record<string, IntegrationStatusInfo> {
    const result: Record<string, IntegrationStatusInfo> = {};
    this.integrationStatus.forEach((status, name) => {
      result[name] = { ...status };
    });
    return result;
  }

  /**
   * Get system-wide summary
   */
  getSystemSummary(): IntegrationSystemSummary {
    const statuses = Array.from(this.integrationStatus.values());
    
    const healthyCount = statuses.filter(s => s.status === IntegrationStatus.HEALTHY).length;
    const degradedCount = statuses.filter(s => s.status === IntegrationStatus.DEGRADED).length;
    const unhealthyCount = statuses.filter(s => s.status === IntegrationStatus.UNHEALTHY).length;
    const unknownCount = statuses.filter(s => s.status === IntegrationStatus.UNKNOWN).length;

    // Find critical integrations that are down
    const criticalIntegrationsDown = statuses
      .filter(s => s.priority === IntegrationPriority.CRITICAL && !s.healthy)
      .map(s => s.name);

    // Find degraded integrations
    const degradedIntegrations = statuses
      .filter(s => s.status === IntegrationStatus.DEGRADED)
      .map(s => ({ name: s.name, level: s.degradedLevel }));

    // Calculate overall status
    let overallStatus: IntegrationStatus;
    if (criticalIntegrationsDown.length > 0) {
      overallStatus = IntegrationStatus.UNHEALTHY;
    } else if (degradedCount > 0 || unhealthyCount > 0) {
      overallStatus = IntegrationStatus.DEGRADED;
    } else if (healthyCount === statuses.length) {
      overallStatus = IntegrationStatus.HEALTHY;
    } else {
      overallStatus = IntegrationStatus.UNKNOWN;
    }

    // Calculate overall uptime
    const avgUptime = statuses.length > 0
      ? statuses.reduce((sum, s) => sum + s.uptime, 0) / statuses.length
      : 100;

    return {
      totalIntegrations: statuses.length,
      healthyCount,
      degradedCount,
      unhealthyCount,
      unknownCount,
      overallStatus,
      criticalIntegrationsDown,
      degradedIntegrations,
      lastUpdated: new Date(),
      uptime: avgUptime,
    };
  }

  /**
   * Get metrics for a specific integration
   */
  getMetrics(name: string): IntegrationMetrics | undefined {
    const metrics = integrationMetrics.getMetrics(name);
    const status = this.integrationStatus.get(name);
    
    if (!status) return undefined;

    return {
      name,
      totalRequests: metrics.count,
      successfulRequests: metrics.count - metrics.errorCount,
      failedRequests: metrics.errorCount,
      averageLatency: metrics.avgLatency,
      p95Latency: metrics.p95Latency,
      p99Latency: metrics.p99Latency,
      errorRate: metrics.errorRate,
      circuitBreakerTrips: 0, // Would need to track this separately
      fallbackUsageCount: 0, // Would need to track this separately
      lastHourRequests: metrics.count, // Simplified
      lastHourErrorRate: metrics.errorRate,
    };
  }

  /**
   * Get diagnostic information for an integration
   */
  getDiagnostics(name: string): IntegrationDiagnostic | undefined {
    const config = this.integrations.get(name);
    const status = this.integrationStatus.get(name);
    
    if (!config || !status) return undefined;

    const metrics = this.getMetrics(name);
    const cbMetrics = circuitBreakerMonitor.getCircuitBreaker(name)?.getMetrics();
    const recentEvents = this.recentEvents.filter(
      e => e.integrationName === name
    ).slice(-10);

    return {
      name,
      type: config.type,
      status,
      metrics: metrics!,
      circuitBreakerMetrics: {
        state: cbMetrics?.state || CircuitBreakerState.CLOSED,
        failures: cbMetrics?.failures || 0,
        successes: cbMetrics?.successes || 0,
        failureRate: cbMetrics?.failureRate || 0,
      },
      recentEvents,
      config: {
        priority: config.priority,
        hasRecoveryHandler: !!config.recoveryHandler,
        hasGracefulShutdown: !!config.gracefulShutdown,
        dependencies: config.dependencies || [],
      },
    };
  }

  /**
   * Attempt to recover an unhealthy integration
   */
  async recoverIntegration(name: string): Promise<boolean> {
    const config = this.integrations.get(name);
    const status = this.integrationStatus.get(name);
    
    if (!config || !status) {
      logger.warn(`Cannot recover unknown integration: ${name}`);
      return false;
    }

    if (!config.recoveryHandler) {
      logger.warn(`No recovery handler for integration: ${name}`);
      return false;
    }

    logger.info(`Attempting recovery for integration: ${name}`);
    
    this.emitEvent({
      type: IntegrationEventType.RECOVERY_STARTED,
      integrationType: config.type,
      integrationName: name,
      timestamp: new Date(),
    });

    try {
      const recovered = await config.recoveryHandler();
      
      if (recovered) {
        // Reset circuit breaker
        circuitBreakerMonitor.resetCircuitBreaker(name);
        
        // Exit degraded mode if applicable
        degradedModeManager.exitDegradedMode(config.type);
        
        // Perform health check
        const healthResult = await this.performHealthCheck(config);
        this.updateIntegrationStatus(config, healthResult);

        this.emitEvent({
          type: IntegrationEventType.RECOVERY_COMPLETED,
          integrationType: config.type,
          integrationName: name,
          timestamp: new Date(),
          newStatus: healthResult.healthy ? IntegrationStatus.HEALTHY : IntegrationStatus.UNHEALTHY,
        });

        logger.info(`Recovery ${recovered ? 'successful' : 'failed'} for integration: ${name}`);
        return recovered;
      }

      return false;
    } catch (error) {
      logger.error(`Recovery failed for integration ${name}:`, error);
      return false;
    }
  }

  /**
   * Subscribe to integration events
   */
  subscribe(eventType: IntegrationEventType, listener: IntegrationEventListener): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    
    this.eventListeners.get(eventType)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.eventListeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(listener: IntegrationEventListener): () => void {
    const unsubscribers: Array<() => void> = [];
    
    Object.values(IntegrationEventType).forEach(eventType => {
      unsubscribers.push(this.subscribe(eventType as IntegrationEventType, listener));
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Integration Orchestrator...');

    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Graceful shutdown all integrations
    const shutdownPromises = Array.from(this.integrations.values()).map(async (integration) => {
      if (integration.gracefulShutdown) {
        try {
          await integration.gracefulShutdown();
          logger.info(`Integration ${integration.name} shut down successfully`);
        } catch (error) {
          logger.error(`Error shutting down integration ${integration.name}:`, error);
        }
      }
    });

    await Promise.allSettled(shutdownPromises);

    // Clear all state
    this.integrations.clear();
    this.integrationStatus.clear();
    this.eventListeners.clear();
    this.recentEvents.length = 0;
    this.isInitialized = false;

    logger.info('Integration Orchestrator shut down successfully');
  }

  /**
   * Check if orchestrator is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get orchestrator uptime
   */
  getUptime(): number {
    if (!this.initializationTime) return 0;
    return Date.now() - this.initializationTime.getTime();
  }

  // Private methods

  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.runHealthChecks();
    }, this.config.healthCheckInterval);

    logger.info('Health monitoring started', {
      interval: this.config.healthCheckInterval,
    });
  }

  private async runHealthChecks(): Promise<void> {
    const integrations = Array.from(this.integrations.values());
    
    // Run health checks in batches for efficiency
    for (let i = 0; i < integrations.length; i += this.config.maxConcurrentHealthChecks) {
      const batch = integrations.slice(i, i + this.config.maxConcurrentHealthChecks);
      await Promise.allSettled(
        batch.map(integration => this.runSingleHealthCheck(integration))
      );
    }
  }

  private async runSingleHealthCheck(integration: IntegrationConfig): Promise<void> {
    try {
      const result = await this.performHealthCheck(integration);
      this.updateIntegrationStatus(integration, result);
    } catch (error) {
      logger.error(`Health check failed for ${integration.name}:`, error);
    }
  }

  private async performHealthCheck(
    integration: IntegrationConfig
  ): Promise<IntegrationHealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const result = await integration.healthCheck();
      return {
        ...result,
        latency: result.latency || (Date.now() - startTime),
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: getErrorMessage(error),
      };
    }
  }

  private updateIntegrationStatus(
    integration: IntegrationConfig,
    healthResult: IntegrationHealthCheckResult
  ): void {
    const currentStatus = this.integrationStatus.get(integration.name);
    const previousStatus = currentStatus?.status || IntegrationStatus.UNKNOWN;

    // Determine new status
    let newStatus: IntegrationStatus;
    const isDegraded = degradedModeManager.isDegraded(integration.type);
    
    if (healthResult.healthy) {
      newStatus = isDegraded ? IntegrationStatus.DEGRADED : IntegrationStatus.HEALTHY;
    } else {
      newStatus = IntegrationStatus.UNHEALTHY;
    }

    // Get circuit breaker state
    const cbMetrics = circuitBreakerMonitor.getCircuitBreaker(integration.name)?.getMetrics();
    const cbState = cbMetrics?.state || CircuitBreakerState.CLOSED;

    // Update consecutive counts
    let consecutiveFailures = currentStatus?.consecutiveFailures || 0;
    let consecutiveSuccesses = currentStatus?.consecutiveSuccesses || 0;

    if (healthResult.healthy) {
      consecutiveSuccesses++;
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
      consecutiveSuccesses = 0;
    }

    // Calculate error rate
    const totalChecks = consecutiveSuccesses + consecutiveFailures;
    const errorRate = totalChecks > 0 ? consecutiveFailures / totalChecks : 0;

    const newStatusInfo: IntegrationStatusInfo = {
      name: integration.name,
      type: integration.type,
      status: newStatus,
      priority: integration.priority,
      healthy: healthResult.healthy,
      lastHealthCheck: new Date(),
      latency: healthResult.latency,
      consecutiveFailures,
      consecutiveSuccesses,
      circuitBreakerState: cbState,
      degradedLevel: isDegraded ? degradedModeManager.getDegradationLevel(integration.type) : 1,
      uptime: this.calculateUptime(integration.name, healthResult.healthy),
      errorRate,
      lastError: healthResult.error,
      lastErrorTime: healthResult.error ? new Date() : currentStatus?.lastErrorTime,
      metadata: integration.metadata,
    };

    this.integrationStatus.set(integration.name, newStatusInfo);

    // Emit status change event if status changed
    if (previousStatus !== newStatus) {
      this.emitEvent({
        type: IntegrationEventType.STATUS_CHANGED,
        integrationType: integration.type,
        integrationName: integration.name,
        timestamp: new Date(),
        previousStatus,
        newStatus,
        data: { healthResult },
      });

      // Notify callback if provided
      if (integration.onStatusChange) {
        integration.onStatusChange(newStatusInfo);
      }
    }
  }

  private handleHealthChange(
    integration: IntegrationConfig,
    healthStatus: { healthy: boolean; latency?: number; error?: string }
  ): void {
    const eventType = healthStatus.healthy
      ? IntegrationEventType.HEALTH_CHECK_PASSED
      : IntegrationEventType.HEALTH_CHECK_FAILED;

    this.emitEvent({
      type: eventType,
      integrationType: integration.type,
      integrationName: integration.name,
      timestamp: new Date(),
      data: { latency: healthStatus.latency, error: healthStatus.error },
    });
  }

  private emitEvent(event: IntegrationEvent): void {
    if (!this.config.enableEventBus) return;

    // Store recent events (limit to prevent memory growth)
    this.recentEvents.push(event);
    if (this.recentEvents.length > MEMORY_LIMITS.MAX_HISTORY_SIZE) {
      this.recentEvents.shift();
    }

    // Notify listeners
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          logger.error('Error in event listener:', error);
        }
      });
    }
  }

  private calculateUptime(name: string, isHealthy: boolean): number {
    const status = this.integrationStatus.get(name);
    if (!status) return isHealthy ? 100 : 0;

    // Simple uptime calculation based on consecutive checks
    // In production, you'd want a more sophisticated time-based calculation
    const total = status.consecutiveSuccesses + status.consecutiveFailures;
    if (total === 0) return 100;
    
    return (status.consecutiveSuccesses / total) * 100;
  }
}

// Export singleton instance
export const integrationOrchestrator = IntegrationOrchestrator.getInstance();
