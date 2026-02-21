/**
 * Health Check Scheduler
 * 
 * Provides periodic health checking for all registered services.
 * Automatically detects unhealthy services and triggers alerts.
 * 
 * Features:
 * - Configurable health check intervals per service
 * - Timeout handling for slow health checks
 * - Automatic unhealthy service detection
 * - Integration with service registry
 * - Event-based notifications for health changes
 * 
 * @module services/reliability/healthCheckScheduler
 */

import { createScopedLogger } from '../../utils/logger';
import { serviceRegistry, ServiceCriticality, type ServiceRegistration } from './serviceRegistry';
import { gracefulDegradation, ServiceHealth } from './gracefulDegradation';

const logger = createScopedLogger('health-check-scheduler');

/**
 * Health check result
 */
export interface HealthCheckResult {
  serviceName: string;
  healthy: boolean;
  responseTime: number;
  timestamp: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Health check configuration per service
 */
export interface HealthCheckConfig {
  /** Interval between health checks in ms */
  interval: number;
  /** Timeout for health check in ms */
  timeout: number;
  /** Number of consecutive failures before marking unhealthy */
  failureThreshold: number;
  /** Number of consecutive successes before marking healthy */
  successThreshold: number;
  /** Custom health check function */
  checkFn?: () => Promise<{ healthy: boolean; details?: Record<string, unknown> }>;
  /** Enable/disable health checking */
  enabled: boolean;
}

/**
 * Service health state
 */
interface ServiceHealthState {
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheck: HealthCheckResult | null;
  isHealthy: boolean;
  checkInterval: ReturnType<typeof setInterval> | null;
}

/**
 * Health check event
 */
export interface HealthCheckEvent {
  type: 'health_check_pass' | 'health_check_fail' | 'service_healthy' | 'service_unhealthy';
  serviceName: string;
  timestamp: number;
  result: HealthCheckResult;
}

/**
 * Default health check configurations by criticality
 */
const DEFAULT_CONFIGS: Record<ServiceCriticality, Partial<HealthCheckConfig>> = {
  [ServiceCriticality.CRITICAL]: {
    interval: 15000, // 15 seconds
    timeout: 5000,
    failureThreshold: 2,
    successThreshold: 3
  },
  [ServiceCriticality.HIGH]: {
    interval: 30000, // 30 seconds
    timeout: 5000,
    failureThreshold: 3,
    successThreshold: 2
  },
  [ServiceCriticality.MEDIUM]: {
    interval: 60000, // 1 minute
    timeout: 10000,
    failureThreshold: 3,
    successThreshold: 2
  },
  [ServiceCriticality.LOW]: {
    interval: 120000, // 2 minutes
    timeout: 15000,
    failureThreshold: 5,
    successThreshold: 1
  }
};

/**
 * Health Check Scheduler
 */
export class HealthCheckScheduler {
  private healthStates = new Map<string, ServiceHealthState>();
  private eventListeners = new Map<string, Array<(event: HealthCheckEvent) => void>>();
  private isRunning = false;
  private static instance: HealthCheckScheduler | null = null;

  private constructor() {
    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): HealthCheckScheduler {
    if (!HealthCheckScheduler.instance) {
      HealthCheckScheduler.instance = new HealthCheckScheduler();
    }
    return HealthCheckScheduler.instance;
  }

  /**
   * Register a service for health checking
   */
  register(
    serviceName: string,
    config?: Partial<HealthCheckConfig>,
    customCheckFn?: () => Promise<{ healthy: boolean; details?: Record<string, unknown> }>
  ): void {
    if (this.healthStates.has(serviceName)) {
      logger.warn(`Service '${serviceName}' already registered for health checks`);
      return;
    }

    // Get service registration for default config
    const registration = serviceRegistry.getRegistration(serviceName);
    const criticality = registration?.criticality || ServiceCriticality.MEDIUM;
    const defaultConfig = DEFAULT_CONFIGS[criticality];

    const finalConfig: HealthCheckConfig = {
      interval: config?.interval ?? defaultConfig.interval ?? 60000,
      timeout: config?.timeout ?? defaultConfig.timeout ?? 5000,
      failureThreshold: config?.failureThreshold ?? defaultConfig.failureThreshold ?? 3,
      successThreshold: config?.successThreshold ?? defaultConfig.successThreshold ?? 2,
      checkFn: customCheckFn ?? config?.checkFn ?? this.createDefaultCheckFn(serviceName, registration),
      enabled: config?.enabled ?? true
    };

    this.healthStates.set(serviceName, {
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastCheck: null,
      isHealthy: true, // Assume healthy initially
      checkInterval: null
    });

    // Start health checking if scheduler is running
    if (this.isRunning && finalConfig.enabled) {
      this.startHealthCheck(serviceName, finalConfig);
    }

    logger.info(`Registered '${serviceName}' for health checks (interval: ${finalConfig.interval}ms)`);
  }

  /**
   * Create default health check function
   */
  private createDefaultCheckFn(
    serviceName: string,
    _registration: ServiceRegistration | undefined
  ): () => Promise<{ healthy: boolean; details?: Record<string, unknown> }> {
    return async () => {
      // Check graceful degradation health
      const health = gracefulDegradation.getHealth(serviceName);
      const isHealthy = health === ServiceHealth.HEALTHY || health === ServiceHealth.DEGRADED;

      return {
        healthy: isHealthy,
        details: {
          healthStatus: health,
          degradationLevel: gracefulDegradation.getLevel(serviceName)
        }
      };
    };
  }

  /**
   * Unregister a service from health checking
   */
  unregister(serviceName: string): void {
    const state = this.healthStates.get(serviceName);
    if (!state) return;

    if (state.checkInterval) {
      clearInterval(state.checkInterval);
    }

    this.healthStates.delete(serviceName);
    logger.info(`Unregistered '${serviceName}' from health checks`);
  }

  /**
   * Start all health checks
   */
  startAll(): void {
    if (this.isRunning) {
      logger.warn('Health check scheduler already running');
      return;
    }

    this.isRunning = true;

    this.healthStates.forEach((state, serviceName) => {
      const config = this.getServiceConfig(serviceName);
      if (config?.enabled) {
        this.startHealthCheck(serviceName, config);
      }
    });

    logger.info('Health check scheduler started for all services');
  }

  /**
   * Stop all health checks
   */
  stopAll(): void {
    this.healthStates.forEach((state) => {
      if (state.checkInterval) {
        clearInterval(state.checkInterval);
        state.checkInterval = null;
      }
    });

    this.isRunning = false;
    logger.info('Health check scheduler stopped');
  }

  /**
   * Start health check for a specific service
   */
  private startHealthCheck(serviceName: string, config: HealthCheckConfig): void {
    const state = this.healthStates.get(serviceName);
    if (!state) return;

    // Clear existing interval if any
    if (state.checkInterval) {
      clearInterval(state.checkInterval);
    }

    // Perform initial check
    this.performCheck(serviceName, config);

    // Schedule periodic checks
    state.checkInterval = setInterval(() => {
      this.performCheck(serviceName, config);
    }, config.interval);

    logger.debug(`Health checks started for '${serviceName}'`);
  }

  /**
   * Perform health check for a service
   */
  private async performCheck(serviceName: string, config: HealthCheckConfig): Promise<HealthCheckResult> {
    const state = this.healthStates.get(serviceName);
    if (!state || !config.checkFn) {
      return this.createResult(serviceName, false, 0, 'No health check function');
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Execute health check with timeout
      const checkPromise = config.checkFn();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), config.timeout);
      });

      const checkResult = await Promise.race([checkPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      result = {
        serviceName,
        healthy: checkResult.healthy,
        responseTime,
        timestamp: Date.now(),
        details: checkResult.details
      };

      if (checkResult.healthy) {
        state.consecutiveSuccesses++;
        state.consecutiveFailures = 0;
        this.emitEvent({
          type: 'health_check_pass',
          serviceName,
          timestamp: result.timestamp,
          result
        });
      } else {
        state.consecutiveFailures++;
        state.consecutiveSuccesses = 0;
        this.emitEvent({
          type: 'health_check_fail',
          serviceName,
          timestamp: result.timestamp,
          result
        });
      }
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      result = {
        serviceName,
        healthy: false,
        responseTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };

      state.consecutiveFailures++;
      state.consecutiveSuccesses = 0;

      this.emitEvent({
        type: 'health_check_fail',
        serviceName,
        timestamp: result.timestamp,
        result
      });
    }

    state.lastCheck = result;

    // Update health status based on thresholds
    this.updateHealthStatus(serviceName, state, config);

    return result;
  }

  /**
   * Update health status based on check results
   */
  private updateHealthStatus(
    serviceName: string,
    state: ServiceHealthState,
    config: HealthCheckConfig
  ): void {
    const wasHealthy = state.isHealthy;

    if (!state.isHealthy) {
      // Currently unhealthy, check if we should become healthy
      if (state.consecutiveSuccesses >= config.successThreshold) {
        state.isHealthy = true;
        serviceRegistry.updateHealthCheckTime(serviceName);

        this.emitEvent({
          type: 'service_healthy',
          serviceName,
          timestamp: Date.now(),
          result: state.lastCheck!
        });

        logger.info(`Service '${serviceName}' is now healthy`);
      }
    } else {
      // Currently healthy, check if we should become unhealthy
      if (state.consecutiveFailures >= config.failureThreshold) {
        state.isHealthy = false;

        this.emitEvent({
          type: 'service_unhealthy',
          serviceName,
          timestamp: Date.now(),
          result: state.lastCheck!
        });

        logger.warn(`Service '${serviceName}' is now unhealthy`);

        // Record incident in service registry
        serviceRegistry.recordIncident(
          serviceName,
          'failure',
          'warning',
          `Service marked unhealthy after ${state.consecutiveFailures} consecutive failures`
        );
      }
    }

    // Log status change
    if (wasHealthy !== state.isHealthy) {
      logger.info(`Health status changed for '${serviceName}': ${wasHealthy ? 'healthy' : 'unhealthy'} -> ${state.isHealthy ? 'healthy' : 'unhealthy'}`);
    }
  }

  /**
   * Create a health check result
   */
  private createResult(
    serviceName: string,
    healthy: boolean,
    responseTime: number,
    error?: string
  ): HealthCheckResult {
    return {
      serviceName,
      healthy,
      responseTime,
      timestamp: Date.now(),
      error
    };
  }

  /**
   * Get service config (simplified - in real implementation, store config per service)
   */
  private getServiceConfig(serviceName: string): HealthCheckConfig | null {
    const registration = serviceRegistry.getRegistration(serviceName);
    const criticality = registration?.criticality || ServiceCriticality.MEDIUM;
    const defaultConfig = DEFAULT_CONFIGS[criticality];

    return {
      interval: defaultConfig.interval ?? 60000,
      timeout: defaultConfig.timeout ?? 5000,
      failureThreshold: defaultConfig.failureThreshold ?? 3,
      successThreshold: defaultConfig.successThreshold ?? 2,
      enabled: true
    };
  }

  /**
   * Force a health check for a service
   */
  async checkNow(serviceName: string): Promise<HealthCheckResult | null> {
    const state = this.healthStates.get(serviceName);
    if (!state) {
      logger.warn(`Service '${serviceName}' not registered for health checks`);
      return null;
    }

    const config = this.getServiceConfig(serviceName);
    if (!config) return null;

    return this.performCheck(serviceName, config);
  }

  /**
   * Get current health status for a service
   */
  getHealth(serviceName: string): { isHealthy: boolean; lastCheck: HealthCheckResult | null } | null {
    const state = this.healthStates.get(serviceName);
    if (!state) return null;

    return {
      isHealthy: state.isHealthy,
      lastCheck: state.lastCheck
    };
  }

  /**
   * Get all health statuses
   */
  getAllHealth(): Map<string, { isHealthy: boolean; lastCheck: HealthCheckResult | null }> {
    const result = new Map<string, { isHealthy: boolean; lastCheck: HealthCheckResult | null }>();
    
    this.healthStates.forEach((state, serviceName) => {
      result.set(serviceName, {
        isHealthy: state.isHealthy,
        lastCheck: state.lastCheck
      });
    });

    return result;
  }

  /**
   * Subscribe to health check events
   */
  subscribe(eventType: string, callback: (event: HealthCheckEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    this.eventListeners.get(eventType)!.push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit a health check event
   */
  private emitEvent(event: HealthCheckEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error: unknown) {
          logger.error('Error in health check event listener:', error);
        }
      });
    }

    // Also emit to 'all' listeners
    const allListeners = this.eventListeners.get('all');
    if (allListeners) {
      allListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error: unknown) {
          logger.error('Error in health check event listener:', error);
        }
      });
    }
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get registered service count
   */
  getRegisteredCount(): number {
    return this.healthStates.size;
  }

  /**
   * Reset all health states
   */
  reset(): void {
    this.stopAll();
    this.healthStates.clear();
    this.eventListeners.clear();
    logger.info('Health check scheduler reset');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.stopAll();
    this.healthStates.clear();
    this.eventListeners.clear();
    HealthCheckScheduler.instance = null;
    logger.info('Health check scheduler destroyed');
  }
}

// Export singleton instance
export const healthCheckScheduler = HealthCheckScheduler.getInstance();

/**
 * Helper function to register a service with default configuration
 */
export function registerServiceHealthCheck(
  serviceName: string,
  customCheckFn?: () => Promise<{ healthy: boolean; details?: Record<string, unknown> }>
): void {
  healthCheckScheduler.register(serviceName, undefined, customCheckFn);
}
