/**
 * API Retry Policy - Configurable Retry Strategies for API Operations
 * 
 * This module provides a sophisticated retry system that:
 * - Supports multiple backoff strategies (exponential, linear, fixed, jitter)
 * - Configurable retry conditions based on error type and status codes
 * - Circuit breaker integration to prevent retry storms
 * - Per-endpoint retry configuration
 * - Comprehensive retry metrics and monitoring
 * 
 * Benefits:
 * - Improves application resilience against transient failures
 * - Prevents retry storms with circuit breaker integration
 * - Configurable retry behavior per endpoint
 * - Comprehensive observability into retry patterns
 * 
 * @module services/api/apiRetryPolicy
 * @since 2026-02-21
 * @author API Specialist Agent
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../../constants/config';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('APIRetryPolicy');

// ============= Types =============

/**
 * Backoff strategy types
 */
export type BackoffStrategy = 
  | 'exponential'
  | 'linear'
  | 'fixed'
  | 'decorrelated-jitter'
  | 'full-jitter'
  | 'equal-jitter';

/**
 * Retry condition function type
 */
export type RetryCondition = (
  error: Error,
  attempt: number,
  context?: RetryContext
) => boolean;

/**
 * Retry context passed to condition functions
 */
export interface RetryContext {
  url?: string;
  method?: string;
  statusCode?: number;
  headers?: Headers;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicyConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff strategy to use */
  backoffStrategy: BackoffStrategy;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Enable jitter to prevent thundering herd */
  enableJitter: boolean;
  /** Jitter factor (0-1) for random delay variation */
  jitterFactor: number;
  /** HTTP status codes to retry on */
  retryableStatusCodes: number[];
  /** HTTP methods that are safe to retry */
  retryableMethods: string[];
  /** Custom retry condition function */
  retryCondition?: RetryCondition;
  /** Timeout for each retry attempt */
  retryTimeout: number;
  /** Enable circuit breaker */
  enableCircuitBreaker: boolean;
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold: number;
  /** Circuit breaker reset timeout */
  circuitBreakerResetTimeout: number;
  /** Callback before each retry */
  onRetry?: (attempt: number, delay: number, error: Error, context?: RetryContext) => void;
  /** Callback when max retries exceeded */
  onMaxRetriesExceeded?: (attempts: number, lastError: Error, context?: RetryContext) => void;
}

/**
 * Retry attempt result
 */
export interface RetryAttemptResult<T = unknown> {
  /** Whether the attempt was successful */
  success: boolean;
  /** Result if successful */
  result?: T;
  /** Error if failed */
  error?: Error;
  /** Attempt number (1-based) */
  attempt: number;
  /** Delay before this attempt */
  delay: number;
  /** Total time spent on all attempts */
  totalDuration: number;
  /** Whether retries were exhausted */
  exhausted: boolean;
  /** Context for the attempt */
  context?: RetryContext;
}

/**
 * Retry statistics
 */
export interface RetryStats {
  /** Total operations attempted */
  totalOperations: number;
  /** Operations that succeeded on first try */
  firstTrySuccess: number;
  /** Operations that succeeded after retry */
  retrySuccess: number;
  /** Operations that failed after all retries */
  totalFailures: number;
  /** Total retry attempts made */
  totalRetryAttempts: number;
  /** Average attempts per operation */
  averageAttempts: number;
  /** Circuit breaker trips */
  circuitBreakerTrips: number;
  /** Most common retry reasons */
  topRetryReasons: { reason: string; count: number }[];
}

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Per-endpoint retry configuration
 */
export interface EndpointRetryConfig {
  /** URL pattern to match */
  pattern: string | RegExp;
  /** Override retry config */
  config: Partial<RetryPolicyConfig>;
}

// ============= Default Configuration =============

const DEFAULT_CONFIG: RetryPolicyConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffStrategy: 'exponential',
  backoffMultiplier: 2,
  enableJitter: true,
  jitterFactor: 0.5,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
  retryTimeout: 30000,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerResetTimeout: 60000,
};

// ============= Backoff Strategies =============

/**
 * Calculate delay using exponential backoff
 */
function exponentialBackoff(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const delay = initialDelay * Math.pow(multiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Calculate delay using linear backoff
 */
function linearBackoff(
  attempt: number,
  initialDelay: number,
  maxDelay: number
): number {
  const delay = initialDelay * attempt;
  return Math.min(delay, maxDelay);
}

/**
 * Calculate delay using fixed backoff
 */
function fixedBackoff(initialDelay: number): number {
  return initialDelay;
}

/**
 * Calculate delay using decorrelated jitter
 * See: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
function decorrelatedJitterBackoff(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  previousDelay: number
): number {
  const delay = Math.min(maxDelay, Math.random() * (previousDelay * 3) + initialDelay);
  return Math.max(initialDelay, delay);
}

/**
 * Calculate delay using full jitter
 */
function fullJitterBackoff(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
  const delay = Math.random() * exponentialDelay;
  return Math.min(delay, maxDelay);
}

/**
 * Calculate delay using equal jitter
 */
function equalJitterBackoff(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
  const delay = (exponentialDelay / 2) + (Math.random() * exponentialDelay / 2);
  return Math.min(delay, maxDelay);
}

// ============= API Retry Policy Class =============

/**
 * API Retry Policy
 * 
 * A configurable retry system with multiple backoff strategies,
 * circuit breaker integration, and comprehensive monitoring.
 */
export class APIRetryPolicy {
  private config: RetryPolicyConfig;
  private endpointConfigs: EndpointRetryConfig[] = [];
  
  // Circuit breaker state
  private circuitBreakerState: CircuitBreakerState = 'closed';
  private consecutiveFailures = 0;
  private circuitBreakerOpenedAt?: number;
  
  // Statistics
  private stats = {
    totalOperations: 0,
    firstTrySuccess: 0,
    retrySuccess: 0,
    totalFailures: 0,
    totalRetryAttempts: 0,
    circuitBreakerTrips: 0,
    retryReasons: new Map<string, number>(),
  };
  
  // Active retry tracking
  private activeRetries = new Map<string, { attempt: number; lastDelay: number }>();
  
  // Cleanup interval
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<RetryPolicyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanup(), TIME_CONSTANTS.MINUTE);
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiRetryPolicy', {
        cleanup: () => this.destroy(),
        priority: 'medium',
        description: 'API retry policy service',
      });
    }
    
    logger.info('API Retry Policy initialized', { config: this.config });
  }

  // ============= Public Methods =============

  /**
   * Execute an operation with retry logic
   */
  async execute<T = unknown>(
    operation: () => Promise<T>,
    context?: RetryContext
  ): Promise<RetryAttemptResult<T>> {
    const startTime = Date.now();
    const operationId = this.generateOperationId();
    
    // Get effective config for this endpoint
    const effectiveConfig = this.getEffectiveConfig(context?.url);
    
    // Check circuit breaker
    if (effectiveConfig.enableCircuitBreaker && !this.canExecute()) {
      return {
        success: false,
        error: new Error('Circuit breaker is open'),
        attempt: 0,
        delay: 0,
        totalDuration: Date.now() - startTime,
        exhausted: true,
        context,
      };
    }
    
    this.stats.totalOperations++;
    let lastError: Error | undefined;
    let lastDelay = 0;
    let attempt = 0;
    
    // Track active retry
    this.activeRetries.set(operationId, { attempt: 0, lastDelay: 0 });
    
    try {
      while (attempt < effectiveConfig.maxAttempts) {
        attempt++;
        this.activeRetries.set(operationId, { attempt, lastDelay });
        
        try {
          // Execute the operation
          const result = await operation();
          
          // Success - update stats and reset circuit breaker
          if (attempt === 1) {
            this.stats.firstTrySuccess++;
          } else {
            this.stats.retrySuccess++;
            this.stats.totalRetryAttempts += attempt - 1;
          }
          
          this.onOperationSuccess();
          this.activeRetries.delete(operationId);
          
          return {
            success: true,
            result,
            attempt,
            delay: lastDelay,
            totalDuration: Date.now() - startTime,
            exhausted: false,
            context,
          };
          
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // Record retry reason
          this.recordRetryReason(lastError, context);
          
          // Check if we should retry
          if (attempt >= effectiveConfig.maxAttempts) {
            break;
          }
          
          // Check retry condition
          if (!this.shouldRetry(lastError, attempt, effectiveConfig, context)) {
            break;
          }
          
          // Calculate delay for next attempt
          lastDelay = this.calculateDelay(attempt, effectiveConfig, lastDelay);
          
          // Notify callback
          effectiveConfig.onRetry?.(attempt, lastDelay, lastError, context);
          
          logger.debug(`Retrying operation (attempt ${attempt + 1}/${effectiveConfig.maxAttempts})`, {
            delay: lastDelay,
            error: lastError.message,
          });
          
          // Wait before retry
          await this.sleep(lastDelay);
          
        } finally {
          this.stats.totalRetryAttempts = Math.max(0, this.stats.totalRetryAttempts);
        }
      }
      
      // All retries exhausted
      this.stats.totalFailures++;
      this.onOperationFailure();
      this.activeRetries.delete(operationId);
      
      effectiveConfig.onMaxRetriesExceeded?.(attempt, lastError!, context);
      
      return {
        success: false,
        error: lastError,
        attempt,
        delay: lastDelay,
        totalDuration: Date.now() - startTime,
        exhausted: true,
        context,
      };
      
    } finally {
      this.activeRetries.delete(operationId);
    }
  }

  /**
   * Wrap a function with retry logic
   */
  wrap<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    context?: RetryContext
  ): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
    return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
      const result = await this.execute(() => fn(...args), context);
      if (result.success && result.result !== undefined) {
        return result.result as Awaited<ReturnType<T>>;
      }
      throw result.error || new Error('Operation failed');
    };
  }

  /**
   * Add endpoint-specific retry configuration
   */
  addEndpointConfig(pattern: string | RegExp, config: Partial<RetryPolicyConfig>): void {
    this.endpointConfigs.push({ pattern, config });
    logger.debug('Added endpoint retry config', { pattern: String(pattern) });
  }

  /**
   * Remove endpoint-specific retry configuration
   */
  removeEndpointConfig(pattern: string | RegExp): boolean {
    const index = this.endpointConfigs.findIndex(
      ec => String(ec.pattern) === String(pattern)
    );
    if (index !== -1) {
      this.endpointConfigs.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get retry statistics
   */
  getStats(): RetryStats {
    const totalSuccessful = this.stats.firstTrySuccess + this.stats.retrySuccess;
    const averageAttempts = this.stats.totalOperations > 0
      ? (this.stats.totalRetryAttempts + this.stats.totalOperations) / this.stats.totalOperations
      : 1;
    
    // Get top retry reasons
    const topRetryReasons = Array.from(this.stats.retryReasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalOperations: this.stats.totalOperations,
      firstTrySuccess: this.stats.firstTrySuccess,
      retrySuccess: this.stats.retrySuccess,
      totalFailures: this.stats.totalFailures,
      totalRetryAttempts: this.stats.totalRetryAttempts,
      averageAttempts,
      circuitBreakerTrips: this.stats.circuitBreakerTrips,
      topRetryReasons,
    };
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    this.updateCircuitBreakerState();
    return this.circuitBreakerState;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerState = 'closed';
    this.consecutiveFailures = 0;
    this.circuitBreakerOpenedAt = undefined;
    logger.info('Circuit breaker reset');
  }

  /**
   * Update global retry configuration
   */
  updateConfig(config: Partial<RetryPolicyConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Retry policy config updated', config);
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.stats = {
      totalOperations: 0,
      firstTrySuccess: 0,
      retrySuccess: 0,
      totalFailures: 0,
      totalRetryAttempts: 0,
      circuitBreakerTrips: 0,
      retryReasons: new Map(),
    };
    logger.info('Retry policy statistics reset');
  }

  /**
   * Destroy the retry policy
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.activeRetries.clear();
    logger.info('API Retry Policy destroyed');
  }

  // ============= Private Methods =============

  private generateOperationId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEffectiveConfig(url?: string): RetryPolicyConfig {
    if (!url || this.endpointConfigs.length === 0) {
      return this.config;
    }
    
    // Find matching endpoint config
    for (const endpointConfig of this.endpointConfigs) {
      const pattern = endpointConfig.pattern;
      const matches = pattern instanceof RegExp
        ? pattern.test(url)
        : new RegExp(pattern).test(url);
      
      if (matches) {
        return { ...this.config, ...endpointConfig.config };
      }
    }
    
    return this.config;
  }

  private shouldRetry(
    error: Error,
    attempt: number,
    config: RetryPolicyConfig,
    context?: RetryContext
  ): boolean {
    // Check custom retry condition first
    if (config.retryCondition) {
      return config.retryCondition(error, attempt, context);
    }
    
    // Check if method is retryable
    if (context?.method && !config.retryableMethods.includes(context.method.toUpperCase())) {
      return false;
    }
    
    // Check status code if available
    if (context?.statusCode !== undefined) {
      return config.retryableStatusCodes.includes(context.statusCode);
    }
    
    // Check error type
    const errorName = error.name.toLowerCase();
    if (errorName.includes('timeout') || errorName.includes('network')) {
      return true;
    }
    
    // Check for abort error (should not retry)
    if (errorName.includes('abort')) {
      return false;
    }
    
    // Default: retry on any error
    return true;
  }

  private calculateDelay(
    attempt: number,
    config: RetryPolicyConfig,
    previousDelay: number
  ): number {
    let delay: number;
    
    switch (config.backoffStrategy) {
      case 'exponential':
        delay = exponentialBackoff(
          attempt,
          config.initialDelay,
          config.maxDelay,
          config.backoffMultiplier
        );
        break;
        
      case 'linear':
        delay = linearBackoff(attempt, config.initialDelay, config.maxDelay);
        break;
        
      case 'fixed':
        delay = fixedBackoff(config.initialDelay);
        break;
        
      case 'decorrelated-jitter':
        delay = decorrelatedJitterBackoff(
          attempt,
          config.initialDelay,
          config.maxDelay,
          previousDelay || config.initialDelay
        );
        break;
        
      case 'full-jitter':
        delay = fullJitterBackoff(
          attempt,
          config.initialDelay,
          config.maxDelay,
          config.backoffMultiplier
        );
        break;
        
      case 'equal-jitter':
        delay = equalJitterBackoff(
          attempt,
          config.initialDelay,
          config.maxDelay,
          config.backoffMultiplier
        );
        break;
        
      default:
        delay = exponentialBackoff(
          attempt,
          config.initialDelay,
          config.maxDelay,
          config.backoffMultiplier
        );
    }
    
    // Apply jitter if enabled and not already using jitter strategy
    if (config.enableJitter && !config.backoffStrategy.includes('jitter')) {
      delay = this.applyJitter(delay, config.jitterFactor);
    }
    
    return Math.round(delay);
  }

  private applyJitter(delay: number, factor: number): number {
    const jitterRange = delay * factor;
    return delay - (jitterRange / 2) + (Math.random() * jitterRange);
  }

  private canExecute(): boolean {
    this.updateCircuitBreakerState();
    return this.circuitBreakerState !== 'open';
  }

  private updateCircuitBreakerState(): void {
    if (this.circuitBreakerState === 'open') {
      const resetTimeout = this.config.circuitBreakerResetTimeout;
      if (
        this.circuitBreakerOpenedAt &&
        Date.now() - this.circuitBreakerOpenedAt >= resetTimeout
      ) {
        this.circuitBreakerState = 'half-open';
        logger.info('Circuit breaker entered half-open state');
      }
    }
  }

  private onOperationSuccess(): void {
    if (this.circuitBreakerState === 'half-open') {
      this.circuitBreakerState = 'closed';
      logger.info('Circuit breaker closed after successful operation');
    }
    this.consecutiveFailures = 0;
  }

  private onOperationFailure(): void {
    this.consecutiveFailures++;
    
    if (
      this.config.enableCircuitBreaker &&
      this.consecutiveFailures >= this.config.circuitBreakerThreshold
    ) {
      this.circuitBreakerState = 'open';
      this.circuitBreakerOpenedAt = Date.now();
      this.stats.circuitBreakerTrips++;
      logger.warn('Circuit breaker opened due to consecutive failures', {
        consecutiveFailures: this.consecutiveFailures,
        threshold: this.config.circuitBreakerThreshold,
      });
    }
  }

  private recordRetryReason(error: Error, context?: RetryContext): void {
    let reason = error.name || 'Unknown';
    
    if (context?.statusCode) {
      reason = `HTTP ${context.statusCode}`;
    } else if (error.message.includes('timeout')) {
      reason = 'Timeout';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      reason = 'NetworkError';
    }
    
    const count = this.stats.retryReasons.get(reason) || 0;
    this.stats.retryReasons.set(reason, count + 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    // Clean up old retry reasons (keep last 100)
    if (this.stats.retryReasons.size > 100) {
      const entries = Array.from(this.stats.retryReasons.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50);
      this.stats.retryReasons = new Map(entries);
    }
  }
}

// ============= Singleton Instance =============

let retryPolicyInstance: APIRetryPolicy | null = null;

/**
 * Get the API retry policy instance
 */
export const getAPIRetryPolicy = (config?: Partial<RetryPolicyConfig>): APIRetryPolicy => {
  if (!retryPolicyInstance) {
    retryPolicyInstance = new APIRetryPolicy(config);
  }
  return retryPolicyInstance;
};

/**
 * Initialize the API retry policy with custom config
 */
export const initializeAPIRetryPolicy = (config: Partial<RetryPolicyConfig>): APIRetryPolicy => {
  if (retryPolicyInstance) {
    retryPolicyInstance.destroy();
  }
  retryPolicyInstance = new APIRetryPolicy(config);
  return retryPolicyInstance;
};

/**
 * Check if retry policy is initialized
 */
export const hasAPIRetryPolicy = (): boolean => {
  return retryPolicyInstance !== null;
};

// ============= Convenience Functions =============

/**
 * Execute an operation with retry
 */
export const withRetry = <T = unknown>(
  operation: () => Promise<T>,
  context?: RetryContext
): Promise<RetryAttemptResult<T>> => getAPIRetryPolicy().execute(operation, context);

/**
 * Create a retry wrapper for a function
 */
export const createRetryable = <T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: RetryContext
): ((...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>) =>
  getAPIRetryPolicy().wrap(fn, context);

// ============= Pre-built Retry Conditions =============

/**
 * Retry only on network errors
 */
export const retryOnNetworkError: RetryCondition = (error: Error) => {
  const name = error.name.toLowerCase();
  return name.includes('network') || name.includes('fetch') || name.includes('timeout');
};

/**
 * Retry on server errors (5xx)
 */
export const retryOnServerError: RetryCondition = (
  _error: Error,
  _attempt: number,
  context?: RetryContext
) => {
  const status = context?.statusCode;
  return status !== undefined && status >= 500 && status < 600;
};

/**
 * Retry on rate limit (429)
 */
export const retryOnRateLimit: RetryCondition = (
  _error: Error,
  _attempt: number,
  context?: RetryContext
) => {
  return context?.statusCode === 429;
};

/**
 * Retry on transient errors (network + 5xx + 429)
 */
export const retryOnTransientError: RetryCondition = (
  error: Error,
  attempt: number,
  context?: RetryContext
) => {
  return (
    retryOnNetworkError(error, attempt, context) ||
    retryOnServerError(error, attempt, context) ||
    retryOnRateLimit(error, attempt, context)
  );
};

// ============= React Hook =============

/**
 * React hook for using the API retry policy
 */
export const useAPIRetryPolicy = () => {
  const policy = getAPIRetryPolicy();
  
  return {
    execute: <T = unknown>(operation: () => Promise<T>, context?: RetryContext) =>
      policy.execute(operation, context),
    
    wrap: <T extends (...args: unknown[]) => Promise<unknown>>(
      fn: T,
      context?: RetryContext
    ) => policy.wrap(fn, context),
    
    addEndpointConfig: (pattern: string | RegExp, config: Partial<RetryPolicyConfig>) =>
      policy.addEndpointConfig(pattern, config),
    
    removeEndpointConfig: (pattern: string | RegExp) =>
      policy.removeEndpointConfig(pattern),
    
    getStats: () => policy.getStats(),
    
    getCircuitBreakerState: () => policy.getCircuitBreakerState(),
    resetCircuitBreaker: () => policy.resetCircuitBreaker(),
    
    updateConfig: (config: Partial<RetryPolicyConfig>) => policy.updateConfig(config),
    resetStats: () => policy.resetStats(),
    
    // Pre-built conditions
    retryOnNetworkError,
    retryOnServerError,
    retryOnRateLimit,
    retryOnTransientError,
  };
};
