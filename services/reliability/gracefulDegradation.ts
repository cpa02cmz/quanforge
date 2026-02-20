/**
 * Graceful Degradation Service
 * 
 * Provides fallback mechanisms for critical services to ensure
 * application continues to function even when primary services fail.
 * 
 * Features:
 * - Service fallback chains
 * - Automatic degradation level management
 * - Circuit breaker integration
 * - Recovery detection and promotion
 * - Degradation metrics and alerts
 * 
 * @module services/reliability/gracefulDegradation
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('graceful-degradation');

/**
 * Degradation level enumeration
 */
export enum DegradationLevel {
  FULL = 'full',           // All features available
  PARTIAL = 'partial',     // Some features unavailable
  MINIMAL = 'minimal',     // Only critical features
  EMERGENCY = 'emergency'  // Fallback/cached data only
}

/**
 * Service health status
 */
export enum ServiceHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  OFFLINE = 'offline'
}

/**
 * Fallback configuration
 */
export interface FallbackConfig<T> {
  /** Primary service function */
  primary: () => Promise<T>;
  /** Fallback service function (partial degradation) */
  partial?: () => Promise<T>;
  /** Minimal fallback (critical features only) */
  minimal?: () => Promise<T>;
  /** Emergency fallback (cached/stub data) */
  emergency?: () => Promise<T>;
  /** Service name for logging */
  serviceName: string;
  /** Health check function */
  healthCheck?: () => Promise<boolean>;
  /** Timeout for primary service (ms) */
  timeout?: number;
  /** Maximum retries before degradation */
  maxRetries?: number;
  /** Recovery check interval (ms) */
  recoveryCheckInterval?: number;
}

/**
 * Degradation state
 */
interface DegradationState {
  level: DegradationLevel;
  health: ServiceHealth;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  lastHealthCheck: number | null;
  totalRequests: number;
  failedRequests: number;
  degradedRequests: number;
}

/**
 * Service metrics
 */
export interface DegradationMetrics {
  serviceName: string;
  level: DegradationLevel;
  health: ServiceHealth;
  availability: number;
  avgResponseTime: number;
  consecutiveFailures: number;
  lastFailure: number | null;
  totalRequests: number;
  failedRequests: number;
  degradationRate: number;
}

/**
 * Recovery callback
 */
type RecoveryCallback = (serviceName: string, newLevel: DegradationLevel) => void;

/**
 * Graceful Degradation Service
 */
export class GracefulDegradationService {
  private services = new Map<string, FallbackConfig<unknown>>();
  private states = new Map<string, DegradationState>();
  private responseTimes = new Map<string, number[]>();
  private recoveryCallbacks: RecoveryCallback[] = [];
  private recoveryCheckIntervals = new Map<string, ReturnType<typeof setInterval>>();
  
  private readonly DEFAULT_TIMEOUT = 10000;
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_RECOVERY_INTERVAL = 30000;
  private readonly FAILURE_THRESHOLD = 3;
  private readonly SUCCESS_THRESHOLD = 5;
  private readonly MAX_RESPONSE_TIME_HISTORY = 100;

  /**
   * Register a service with fallback chain
   */
  register<T>(config: FallbackConfig<T>): void {
    const serviceName = config.serviceName;
    
    if (this.services.has(serviceName)) {
      logger.warn(`Service '${serviceName}' already registered, updating configuration`);
    }

    this.services.set(serviceName, config as FallbackConfig<unknown>);
    this.states.set(serviceName, this.createInitialState());
    this.responseTimes.set(serviceName, []);

    // Start recovery monitoring
    this.startRecoveryMonitoring(serviceName);

    logger.info(`Service '${serviceName}' registered with graceful degradation`);
  }

  /**
   * Unregister a service
   */
  unregister(serviceName: string): void {
    this.services.delete(serviceName);
    this.states.delete(serviceName);
    this.responseTimes.delete(serviceName);
    
    const interval = this.recoveryCheckIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.recoveryCheckIntervals.delete(serviceName);
    }

    logger.info(`Service '${serviceName}' unregistered`);
  }

  /**
   * Execute service with automatic fallback
   */
  async execute<T>(serviceName: string): Promise<T> {
    const config = this.services.get(serviceName) as FallbackConfig<T> | undefined;
    const state = this.states.get(serviceName);

    if (!config || !state) {
      throw new Error(`Service '${serviceName}' not registered`);
    }

    state.totalRequests++;
    const startTime = Date.now();

    try {
      // Determine which fallback level to use based on current state
      const result = await this.executeWithLevel(config, state.level);
      
      // Record success
      this.recordSuccess(serviceName, Date.now() - startTime);
      
      return result;
    } catch (error: unknown) {
      // Record failure
      this.recordFailure(serviceName);
      throw error;
    }
  }

  /**
   * Execute with specific degradation level
   */
  private async executeWithLevel<T>(
    config: FallbackConfig<T>,
    level: DegradationLevel
  ): Promise<T> {
    switch (level) {
      case DegradationLevel.FULL:
        return this.executeWithTimeout(config.primary, config.timeout || this.DEFAULT_TIMEOUT);
      
      case DegradationLevel.PARTIAL:
        if (config.partial) {
          return this.executeWithTimeout(config.partial, config.timeout || this.DEFAULT_TIMEOUT);
        }
        // Fall through to primary if no partial fallback
        return this.executeWithTimeout(config.primary, config.timeout || this.DEFAULT_TIMEOUT);
      
      case DegradationLevel.MINIMAL:
        if (config.minimal) {
          return config.minimal();
        }
        if (config.partial) {
          return config.partial();
        }
        return this.executeWithTimeout(config.primary, config.timeout || this.DEFAULT_TIMEOUT);
      
      case DegradationLevel.EMERGENCY:
        if (config.emergency) {
          return config.emergency();
        }
        if (config.minimal) {
          return config.minimal();
        }
        if (config.partial) {
          return config.partial();
        }
        return this.executeWithTimeout(config.primary, config.timeout || this.DEFAULT_TIMEOUT);
      
      default:
        return this.executeWithTimeout(config.primary, config.timeout || this.DEFAULT_TIMEOUT);
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Service timeout after ${timeout}ms`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Record successful execution
   */
  private recordSuccess(serviceName: string, responseTime: number): void {
    const state = this.states.get(serviceName);
    if (!state) return;

    state.consecutiveSuccesses++;
    state.consecutiveFailures = 0;
    state.lastSuccess = Date.now();
    state.health = ServiceHealth.HEALTHY;

    // Record response time
    const times = this.responseTimes.get(serviceName) || [];
    times.push(responseTime);
    if (times.length > this.MAX_RESPONSE_TIME_HISTORY) {
      times.shift();
    }
    this.responseTimes.set(serviceName, times);

    // Check for recovery (upgrade degradation level)
    if (state.level !== DegradationLevel.FULL && state.consecutiveSuccesses >= this.SUCCESS_THRESHOLD) {
      this.upgradeLevel(serviceName);
    }
  }

  /**
   * Record failed execution
   */
  private recordFailure(serviceName: string): void {
    const state = this.states.get(serviceName);
    if (!state) return;

    state.consecutiveFailures++;
    state.consecutiveSuccesses = 0;
    state.lastFailure = Date.now();
    state.failedRequests++;
    state.health = ServiceHealth.DEGRADED;

    // Check for degradation (downgrade level)
    if (state.consecutiveFailures >= this.FAILURE_THRESHOLD) {
      this.downgradeLevel(serviceName);
    }
  }

  /**
   * Upgrade degradation level (towards FULL)
   */
  private upgradeLevel(serviceName: string): void {
    const state = this.states.get(serviceName);
    if (!state) return;

    const previousLevel = state.level;
    
    switch (state.level) {
      case DegradationLevel.EMERGENCY:
        state.level = DegradationLevel.MINIMAL;
        break;
      case DegradationLevel.MINIMAL:
        state.level = DegradationLevel.PARTIAL;
        break;
      case DegradationLevel.PARTIAL:
        state.level = DegradationLevel.FULL;
        break;
    }

    if (previousLevel !== state.level) {
      logger.info(
        `Service '${serviceName}' recovered: ${previousLevel} -> ${state.level}`
      );
      state.health = ServiceHealth.HEALTHY;
      this.notifyRecoveryCallbacks(serviceName, state.level);
    }
  }

  /**
   * Downgrade degradation level (away from FULL)
   */
  private downgradeLevel(serviceName: string): void {
    const state = this.states.get(serviceName);
    if (!state) return;

    const previousLevel = state.level;
    state.degradedRequests++;
    
    switch (state.level) {
      case DegradationLevel.FULL:
        state.level = DegradationLevel.PARTIAL;
        break;
      case DegradationLevel.PARTIAL:
        state.level = DegradationLevel.MINIMAL;
        break;
      case DegradationLevel.MINIMAL:
        state.level = DegradationLevel.EMERGENCY;
        break;
    }

    if (previousLevel !== state.level) {
      logger.warn(
        `Service '${serviceName}' degraded: ${previousLevel} -> ${state.level} ` +
        `(failures: ${state.consecutiveFailures})`
      );
      
      if (state.level === DegradationLevel.EMERGENCY) {
        state.health = ServiceHealth.UNHEALTHY;
      }
    }
  }

  /**
   * Start recovery monitoring for a service
   */
  private startRecoveryMonitoring(serviceName: string): void {
    const config = this.services.get(serviceName);
    if (!config?.healthCheck) return;

    const interval = setInterval(async () => {
      await this.checkServiceHealth(serviceName);
    }, config.recoveryCheckInterval || this.DEFAULT_RECOVERY_INTERVAL);

    this.recoveryCheckIntervals.set(serviceName, interval);
  }

  /**
   * Check service health
   */
  private async checkServiceHealth(serviceName: string): Promise<void> {
    const config = this.services.get(serviceName);
    const state = this.states.get(serviceName);
    
    if (!config?.healthCheck || !state) return;

    try {
      const isHealthy = await config.healthCheck();
      state.lastHealthCheck = Date.now();

      if (isHealthy && state.level !== DegradationLevel.FULL) {
        // Reset failure count to allow recovery
        state.consecutiveFailures = 0;
        state.consecutiveSuccesses++;
        
        if (state.consecutiveSuccesses >= this.SUCCESS_THRESHOLD) {
          this.upgradeLevel(serviceName);
        }
      } else if (!isHealthy) {
        state.consecutiveSuccesses = 0;
        state.health = ServiceHealth.UNHEALTHY;
      }
    } catch (error: unknown) {
      logger.error(`Health check failed for '${serviceName}':`, error);
      state.health = ServiceHealth.OFFLINE;
    }
  }

  /**
   * Create initial degradation state
   */
  private createInitialState(): DegradationState {
    return {
      level: DegradationLevel.FULL,
      health: ServiceHealth.HEALTHY,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailure: null,
      lastSuccess: null,
      lastHealthCheck: null,
      totalRequests: 0,
      failedRequests: 0,
      degradedRequests: 0
    };
  }

  /**
   * Get service metrics
   */
  getMetrics(serviceName: string): DegradationMetrics | null {
    const state = this.states.get(serviceName);
    const times = this.responseTimes.get(serviceName);
    
    if (!state) return null;

    const avgResponseTime = times && times.length > 0
      ? times.reduce((a, b) => a + b, 0) / times.length
      : 0;

    const availability = state.totalRequests > 0
      ? ((state.totalRequests - state.failedRequests) / state.totalRequests) * 100
      : 100;

    const degradationRate = state.totalRequests > 0
      ? (state.degradedRequests / state.totalRequests) * 100
      : 0;

    return {
      serviceName,
      level: state.level,
      health: state.health,
      availability,
      avgResponseTime,
      consecutiveFailures: state.consecutiveFailures,
      lastFailure: state.lastFailure,
      totalRequests: state.totalRequests,
      failedRequests: state.failedRequests,
      degradationRate
    };
  }

  /**
   * Get all service metrics
   */
  getAllMetrics(): DegradationMetrics[] {
    const metrics: DegradationMetrics[] = [];
    this.services.forEach((_, serviceName) => {
      const m = this.getMetrics(serviceName);
      if (m) metrics.push(m);
    });
    return metrics;
  }

  /**
   * Get current degradation level for a service
   */
  getLevel(serviceName: string): DegradationLevel | null {
    return this.states.get(serviceName)?.level || null;
  }

  /**
   * Get current health for a service
   */
  getHealth(serviceName: string): ServiceHealth | null {
    return this.states.get(serviceName)?.health || null;
  }

  /**
   * Manually set degradation level
   */
  setLevel(serviceName: string, level: DegradationLevel): void {
    const state = this.states.get(serviceName);
    if (!state) {
      logger.warn(`Cannot set level: service '${serviceName}' not registered`);
      return;
    }

    const previousLevel = state.level;
    state.level = level;
    
    logger.info(`Service '${serviceName}' level manually set: ${previousLevel} -> ${level}`);
    
    if (level === DegradationLevel.FULL) {
      state.consecutiveFailures = 0;
      state.health = ServiceHealth.HEALTHY;
    }
  }

  /**
   * Register recovery callback
   */
  onRecovery(callback: RecoveryCallback): void {
    this.recoveryCallbacks.push(callback);
  }

  /**
   * Notify recovery callbacks
   */
  private notifyRecoveryCallbacks(serviceName: string, newLevel: DegradationLevel): void {
    this.recoveryCallbacks.forEach(callback => {
      try {
        callback(serviceName, newLevel);
      } catch (error: unknown) {
        logger.error('Recovery callback error:', error);
      }
    });
  }

  /**
   * Force health check for a service
   */
  async forceHealthCheck(serviceName: string): Promise<boolean> {
    await this.checkServiceHealth(serviceName);
    return this.getHealth(serviceName) === ServiceHealth.HEALTHY;
  }

  /**
   * Reset service state
   */
  reset(serviceName: string): void {
    const state = this.states.get(serviceName);
    if (state) {
      Object.assign(state, this.createInitialState());
      this.responseTimes.set(serviceName, []);
      logger.info(`Service '${serviceName}' state reset`);
    }
  }

  /**
   * Reset all services
   */
  resetAll(): void {
    this.states.forEach((_, serviceName) => {
      this.reset(serviceName);
    });
    logger.info('All service states reset');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.recoveryCheckIntervals.forEach(interval => clearInterval(interval));
    this.recoveryCheckIntervals.clear();
    this.services.clear();
    this.states.clear();
    this.responseTimes.clear();
    this.recoveryCallbacks = [];
    logger.info('Graceful degradation service destroyed');
  }
}

// Export singleton instance
export const gracefulDegradation = new GracefulDegradationService();

/**
 * Create a resilient service wrapper
 */
export function createResilientService<T>(
  config: FallbackConfig<T>
): {
  execute: () => Promise<T>;
  getMetrics: () => DegradationMetrics | null;
  getLevel: () => DegradationLevel | null;
  reset: () => void;
} {
  gracefulDegradation.register(config);
  
  return {
    execute: () => gracefulDegradation.execute<T>(config.serviceName),
    getMetrics: () => gracefulDegradation.getMetrics(config.serviceName),
    getLevel: () => gracefulDegradation.getLevel(config.serviceName),
    reset: () => gracefulDegradation.reset(config.serviceName)
  };
}
