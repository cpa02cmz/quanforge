/**
 * Resilience Policy Enforcer
 * 
 * Provides a unified interface to apply multiple resilience patterns consistently.
 * Combines circuit breaker, bulkhead, retry, timeout, and fallback into a single decorator.
 * 
 * Features:
 * - Unified resilience policy configuration
 * - Automatic pattern composition
 * - Metrics collection across all patterns
 * - Configurable failure handling
 * 
 * @module services/reliability/resiliencePolicy
 */

import { createScopedLogger } from '../../utils/logger';
import { Bulkhead, BulkheadState, bulkheadManager, type BulkheadConfig } from './bulkhead';
import { gracefulDegradation, DegradationLevel, type FallbackConfig } from './gracefulDegradation';

const logger = createScopedLogger('resilience-policy');

/**
 * Resilience pattern types
 */
export enum ResiliencePattern {
  CIRCUIT_BREAKER = 'circuit_breaker',
  BULKHEAD = 'bulkhead',
  RETRY = 'retry',
  TIMEOUT = 'timeout',
  FALLBACK = 'fallback',
  RATE_LIMITER = 'rate_limiter'
}

/**
 * Resilience policy configuration
 */
export interface ResiliencePolicyConfig {
  /** Service name for identification */
  serviceName: string;
  /** Enabled resilience patterns */
  patterns: ResiliencePattern[];
  /** Circuit breaker settings */
  circuitBreaker?: {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    resetTimeout: number;
  };
  /** Bulkhead settings */
  bulkhead?: {
    maxConcurrentCalls: number;
    maxWaitTime: number;
  };
  /** Retry settings */
  retry?: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    jitter: boolean;
    retryableErrors?: string[];
  };
  /** Timeout settings */
  timeout?: {
    duration: number;
    onTimeout?: 'reject' | 'fallback';
  };
  /** Fallback settings */
  fallback?: {
    handler: (error: Error) => Promise<unknown>;
    degradeOnFailure?: boolean;
  };
  /** Enable metrics collection */
  enableMetrics?: boolean;
  /** Callback on any pattern state change */
  onStateChange?: (event: ResilienceEvent) => void;
}

/**
 * Resilience event
 */
export interface ResilienceEvent {
  serviceName: string;
  pattern: ResiliencePattern;
  type: 'state_change' | 'success' | 'failure' | 'timeout' | 'retry' | 'fallback';
  timestamp: number;
  details: Record<string, unknown>;
}

/**
 * Execution context
 */
interface ExecutionContext {
  attempt: number;
  startTime: number;
  errors: Error[];
  usedPatterns: ResiliencePattern[];
}

/**
 * Resilience metrics
 */
export interface ResilienceMetrics {
  serviceName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  timeoutCalls: number;
  fallbackCalls: number;
  retryCalls: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  currentPatterns: {
    bulkhead: BulkheadState | null;
    degradationLevel: DegradationLevel | null;
  };
  patternStats: Record<ResiliencePattern, {
    activations: number;
    successes: number;
    failures: number;
  }>;
}

/**
 * Circuit breaker state for internal use
 */
enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Internal circuit breaker
 */
class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly config: Required<NonNullable<ResiliencePolicyConfig['circuitBreaker']>>;

  constructor(config: NonNullable<ResiliencePolicyConfig['circuitBreaker']>) {
    this.config = {
      ...config,
      successThreshold: config.successThreshold || 3
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error: unknown) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }
}

/**
 * Resilience Policy Enforcer
 */
export class ResiliencePolicy {
  private readonly config: ResiliencePolicyConfig;
  private readonly circuitBreaker: CircuitBreaker | null = null;
  private readonly bulkhead: Bulkhead | null = null;
  private readonly latencies: number[] = [];
  private readonly patternStats: Record<ResiliencePattern, {
    activations: number;
    successes: number;
    failures: number;
  }>;
  
  private totalCalls = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private timeoutCalls = 0;
  private fallbackCalls = 0;
  private retryCalls = 0;
  
  private readonly MAX_LATENCY_HISTORY = 1000;

  constructor(config: ResiliencePolicyConfig) {
    this.config = config;

    // Initialize pattern stats
    this.patternStats = {
      [ResiliencePattern.CIRCUIT_BREAKER]: { activations: 0, successes: 0, failures: 0 },
      [ResiliencePattern.BULKHEAD]: { activations: 0, successes: 0, failures: 0 },
      [ResiliencePattern.RETRY]: { activations: 0, successes: 0, failures: 0 },
      [ResiliencePattern.TIMEOUT]: { activations: 0, successes: 0, failures: 0 },
      [ResiliencePattern.FALLBACK]: { activations: 0, successes: 0, failures: 0 },
      [ResiliencePattern.RATE_LIMITER]: { activations: 0, successes: 0, failures: 0 }
    };

    // Initialize circuit breaker if enabled
    if (this.isPatternEnabled(ResiliencePattern.CIRCUIT_BREAKER) && config.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    }

    // Initialize bulkhead if enabled
    if (this.isPatternEnabled(ResiliencePattern.BULKHEAD) && config.bulkhead) {
      const existingBulkhead = bulkheadManager.get(config.serviceName);
      if (existingBulkhead) {
        this.bulkhead = existingBulkhead;
      } else {
        this.bulkhead = bulkheadManager.register(config.serviceName, {
          maxConcurrentCalls: config.bulkhead.maxConcurrentCalls,
          maxWaitTime: config.bulkhead.maxWaitTime,
          enableDegradation: true
        });
      }
    }

    logger.info(
      `Resilience policy created for '${config.serviceName}' with patterns: ${config.patterns.join(', ')}`
    );
  }

  /**
   * Check if a pattern is enabled
   */
  private isPatternEnabled(pattern: ResiliencePattern): boolean {
    return this.config.patterns.includes(pattern);
  }

  /**
   * Execute a function with all resilience patterns applied
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const context: ExecutionContext = {
      attempt: 0,
      startTime: Date.now(),
      errors: [],
      usedPatterns: []
    };

    this.totalCalls++;

    try {
      const result = await this.executeWithPatterns(fn, context);
      this.recordSuccess(Date.now() - context.startTime);
      return result;
    } catch (error: unknown) {
      // Try fallback if enabled
      if (this.isPatternEnabled(ResiliencePattern.FALLBACK) && this.config.fallback) {
        try {
          return (await this.executeFallback(error, context)) as T;
        } catch (fallbackError: unknown) {
          this.recordFailure(Date.now() - context.startTime);
          throw fallbackError;
        }
      }
      
      this.recordFailure(Date.now() - context.startTime);
      throw error;
    }
  }

  /**
   * Execute with all patterns applied
   */
  private async executeWithPatterns<T>(
    fn: () => Promise<T>,
    context: ExecutionContext
  ): Promise<T> {
    // Apply bulkhead
    if (this.isPatternEnabled(ResiliencePattern.BULKHEAD) && this.bulkhead) {
      context.usedPatterns.push(ResiliencePattern.BULKHEAD);
      this.patternStats[ResiliencePattern.BULKHEAD].activations++;
      
      return this.bulkhead.execute(async () => {
        return this.executeWithCircuitBreaker(fn, context);
      });
    }

    return this.executeWithCircuitBreaker(fn, context);
  }

  /**
   * Execute with circuit breaker
   */
  private async executeWithCircuitBreaker<T>(
    fn: () => Promise<T>,
    context: ExecutionContext
  ): Promise<T> {
    if (this.isPatternEnabled(ResiliencePattern.CIRCUIT_BREAKER) && this.circuitBreaker) {
      context.usedPatterns.push(ResiliencePattern.CIRCUIT_BREAKER);
      this.patternStats[ResiliencePattern.CIRCUIT_BREAKER].activations++;

      try {
        return await this.circuitBreaker.execute(() => 
          this.executeWithRetry(fn, context)
        );
      } catch (error: unknown) {
        this.patternStats[ResiliencePattern.CIRCUIT_BREAKER].failures++;
        return this.handleFailure(error, fn, context);
      }
    }

    return this.executeWithRetry(fn, context);
  }

  /**
   * Execute with retry
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: ExecutionContext
  ): Promise<T> {
    const retryConfig = this.config.retry;
    
    if (!this.isPatternEnabled(ResiliencePattern.RETRY) || !retryConfig) {
      return this.executeWithTimeout(fn, context);
    }

    context.usedPatterns.push(ResiliencePattern.RETRY);
    this.patternStats[ResiliencePattern.RETRY].activations++;

    const maxAttempts = retryConfig.maxAttempts;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      context.attempt = attempt;

      try {
        const result = await this.executeWithTimeout(fn, context);
        if (attempt > 1) {
          this.retryCalls++;
          this.patternStats[ResiliencePattern.RETRY].successes++;
        }
        return result;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        context.errors.push(lastError);

        // Check if error is retryable
        if (retryConfig.retryableErrors && retryConfig.retryableErrors.length > 0) {
          const errorMessage = lastError.message.toLowerCase();
          const isRetryable = retryConfig.retryableErrors.some(e => 
            errorMessage.includes(e.toLowerCase())
          );
          if (!isRetryable) {
            throw lastError;
          }
        }

        // Don't wait after last attempt
        if (attempt < maxAttempts) {
          const delay = this.calculateRetryDelay(attempt, retryConfig);
          await this.sleep(delay);
        }
      }
    }

    this.patternStats[ResiliencePattern.RETRY].failures++;
    throw lastError || new Error('Retry exhausted');
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(
    attempt: number,
    config: NonNullable<ResiliencePolicyConfig['retry']>
  ): number {
    let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, config.maxDelay);

    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    context: ExecutionContext
  ): Promise<T> {
    const timeoutConfig = this.config.timeout;
    
    if (!this.isPatternEnabled(ResiliencePattern.TIMEOUT) || !timeoutConfig) {
      return fn();
    }

    context.usedPatterns.push(ResiliencePattern.TIMEOUT);
    this.patternStats[ResiliencePattern.TIMEOUT].activations++;

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.timeoutCalls++;
        this.patternStats[ResiliencePattern.TIMEOUT].failures++;
        
        const timeoutError = new Error(`Operation timed out after ${timeoutConfig.duration}ms`);
        
        this.emitEvent({
          serviceName: this.config.serviceName,
          pattern: ResiliencePattern.TIMEOUT,
          type: 'timeout',
          timestamp: Date.now(),
          details: { duration: timeoutConfig.duration }
        });

        if (timeoutConfig.onTimeout === 'fallback' && this.config.fallback) {
          this.executeFallback(timeoutError, context)
            .then(result => resolve(result as T))
            .catch(reject);
        } else {
          reject(timeoutError);
        }
      }, timeoutConfig.duration);

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          this.patternStats[ResiliencePattern.TIMEOUT].successes++;
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handle failure with fallback
   */
  private async handleFailure<T>(
    error: unknown,
    fn: () => Promise<T>,
    context: ExecutionContext
  ): Promise<T> {
    if (this.isPatternEnabled(ResiliencePattern.FALLBACK) && this.config.fallback) {
      return this.executeFallback(error, context) as Promise<T>;
    }

    throw error;
  }

  /**
   * Execute fallback handler
   */
  private async executeFallback(
    error: unknown,
    context: ExecutionContext
  ): Promise<unknown> {
    context.usedPatterns.push(ResiliencePattern.FALLBACK);
    this.patternStats[ResiliencePattern.FALLBACK].activations++;
    this.fallbackCalls++;

    try {
      const fallbackError = error instanceof Error ? error : new Error(String(error));
      const result = await this.config.fallback!.handler(fallbackError);
      this.patternStats[ResiliencePattern.FALLBACK].successes++;

      this.emitEvent({
        serviceName: this.config.serviceName,
        pattern: ResiliencePattern.FALLBACK,
        type: 'fallback',
        timestamp: Date.now(),
        details: { error: fallbackError.message }
      });

      return result;
    } catch (fallbackError: unknown) {
      this.patternStats[ResiliencePattern.FALLBACK].failures++;
      throw fallbackError;
    }
  }

  /**
   * Record successful execution
   */
  private recordSuccess(latency: number): void {
    this.successfulCalls++;
    this.recordLatency(latency);

    this.emitEvent({
      serviceName: this.config.serviceName,
      pattern: ResiliencePattern.CIRCUIT_BREAKER,
      type: 'success',
      timestamp: Date.now(),
      details: { latency }
    });
  }

  /**
   * Record failed execution
   */
  private recordFailure(latency: number): void {
    this.failedCalls++;
    this.recordLatency(latency);

    this.emitEvent({
      serviceName: this.config.serviceName,
      pattern: ResiliencePattern.CIRCUIT_BREAKER,
      type: 'failure',
      timestamp: Date.now(),
      details: { latency }
    });
  }

  /**
   * Record latency for metrics
   */
  private recordLatency(latency: number): void {
    if (!this.config.enableMetrics) return;
    
    this.latencies.push(latency);
    if (this.latencies.length > this.MAX_LATENCY_HISTORY) {
      this.latencies.shift();
    }
  }

  /**
   * Emit state change event
   */
  private emitEvent(event: ResilienceEvent): void {
    this.config.onStateChange?.(event);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current metrics
   */
  getMetrics(): ResilienceMetrics {
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    
    const avgLatency = sortedLatencies.length > 0
      ? sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length
      : 0;
    
    const p95Latency = sortedLatencies.length > 0
      ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0
      : 0;
    
    const p99Latency = sortedLatencies.length > 0
      ? sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0
      : 0;

    return {
      serviceName: this.config.serviceName,
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      timeoutCalls: this.timeoutCalls,
      fallbackCalls: this.fallbackCalls,
      retryCalls: this.retryCalls,
      avgLatency,
      p95Latency,
      p99Latency,
      currentPatterns: {
        bulkhead: this.bulkhead?.getState() || null,
        degradationLevel: null
      },
      patternStats: { ...this.patternStats }
    };
  }

  /**
   * Reset all patterns
   */
  reset(): void {
    this.circuitBreaker?.reset();
    this.bulkhead?.reset();
    this.totalCalls = 0;
    this.successfulCalls = 0;
    this.failedCalls = 0;
    this.timeoutCalls = 0;
    this.fallbackCalls = 0;
    this.retryCalls = 0;
    this.latencies.length = 0;

    Object.keys(this.patternStats).forEach(key => {
      this.patternStats[key as ResiliencePattern] = { activations: 0, successes: 0, failures: 0 };
    });

    logger.info(`Resilience policy reset for '${this.config.serviceName}'`);
  }
}

/**
 * Resilience Policy Manager
 * 
 * Manages multiple resilience policies
 */
export class ResiliencePolicyManager {
  private policies = new Map<string, ResiliencePolicy>();

  /**
   * Create and register a resilience policy
   */
  createPolicy(config: ResiliencePolicyConfig): ResiliencePolicy {
    if (this.policies.has(config.serviceName)) {
      logger.warn(`Policy '${config.serviceName}' already exists, replacing`);
    }

    const policy = new ResiliencePolicy(config);
    this.policies.set(config.serviceName, policy);
    return policy;
  }

  /**
   * Get a policy by name
   */
  getPolicy(serviceName: string): ResiliencePolicy | undefined {
    return this.policies.get(serviceName);
  }

  /**
   * Execute with a specific policy
   */
  async execute<T>(serviceName: string, fn: () => Promise<T>): Promise<T> {
    const policy = this.policies.get(serviceName);
    if (!policy) {
      throw new Error(`Policy '${serviceName}' not found`);
    }
    return policy.execute(fn);
  }

  /**
   * Get all policy metrics
   */
  getAllMetrics(): ResilienceMetrics[] {
    const metrics: ResilienceMetrics[] = [];
    this.policies.forEach(policy => {
      metrics.push(policy.getMetrics());
    });
    return metrics;
  }

  /**
   * Reset all policies
   */
  resetAll(): void {
    this.policies.forEach(policy => policy.reset());
    logger.info('All resilience policies reset');
  }
}

// Singleton manager
export const resiliencePolicyManager = new ResiliencePolicyManager();

/**
 * Decorator factory for creating resilient functions
 */
export function withResilience<T extends (...args: unknown[]) => Promise<unknown>>(
  config: ResiliencePolicyConfig
): (fn: T) => T {
  const policy = resiliencePolicyManager.createPolicy(config);
  
  return (fn: T): T => {
    return (async (...args: Parameters<T>) => {
      return policy.execute(() => fn(...args));
    }) as T;
  };
}

/**
 * Default resilience configurations
 */
export const DEFAULT_RESILIENCE_CONFIGS: Record<string, Partial<ResiliencePolicyConfig>> = {
  database: {
    patterns: [
      ResiliencePattern.CIRCUIT_BREAKER,
      ResiliencePattern.BULKHEAD,
      ResiliencePattern.RETRY,
      ResiliencePattern.TIMEOUT
    ],
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 10000,
      resetTimeout: 30000
    },
    bulkhead: {
      maxConcurrentCalls: 20,
      maxWaitTime: 5000
    },
    retry: {
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2,
      jitter: true
    },
    timeout: {
      duration: 10000
    }
  },
  ai_service: {
    patterns: [
      ResiliencePattern.CIRCUIT_BREAKER,
      ResiliencePattern.RETRY,
      ResiliencePattern.TIMEOUT,
      ResiliencePattern.FALLBACK
    ],
    circuitBreaker: {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000,
      resetTimeout: 60000
    },
    retry: {
      maxAttempts: 2,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: ['timeout', 'rate limit', '503']
    },
    timeout: {
      duration: 60000
    }
  },
  external_api: {
    patterns: [
      ResiliencePattern.CIRCUIT_BREAKER,
      ResiliencePattern.RETRY,
      ResiliencePattern.TIMEOUT
    ],
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 5000,
      resetTimeout: 30000
    },
    retry: {
      maxAttempts: 3,
      initialDelay: 200,
      maxDelay: 3000,
      backoffMultiplier: 2,
      jitter: true
    },
    timeout: {
      duration: 10000
    }
  },
  cache: {
    patterns: [
      ResiliencePattern.TIMEOUT,
      ResiliencePattern.FALLBACK
    ],
    timeout: {
      duration: 100,
      onTimeout: 'fallback'
    }
  }
};
