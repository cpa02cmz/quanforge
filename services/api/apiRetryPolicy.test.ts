/**
 * API Retry Policy Tests
 * 
 * @module services/api/apiRetryPolicy.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  APIRetryPolicy,
  getAPIRetryPolicy,
  initializeAPIRetryPolicy,
  hasAPIRetryPolicy,
  withRetry,
  createRetryable,
  retryOnNetworkError,
  retryOnServerError,
  retryOnRateLimit,
  retryOnTransientError,
  useAPIRetryPolicy,
  type RetryPolicyConfig,
  type RetryContext,
  type BackoffStrategy,
} from './apiRetryPolicy';

describe('APIRetryPolicy', () => {
  let policy: APIRetryPolicy;

  beforeEach(() => {
    policy = new APIRetryPolicy({
      maxAttempts: 3,
      initialDelay: 10, // Use short delays for testing
      maxDelay: 100,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 3,
      circuitBreakerResetTimeout: 100,
    });
  });

  afterEach(() => {
    policy.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultPolicy = new APIRetryPolicy();
      expect(defaultPolicy.getStats()).toBeDefined();
      defaultPolicy.destroy();
    });

    it('should initialize with custom config', () => {
      const customPolicy = new APIRetryPolicy({
        maxAttempts: 5,
        initialDelay: 1000,
        backoffStrategy: 'linear',
      });
      customPolicy.destroy();
    });
  });

  describe('execute', () => {
    it('should return success on first try', async () => {
      const result = await policy.execute(() => Promise.resolve('success'));
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempt).toBe(1);
      expect(result.exhausted).toBe(false);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      
      const result = await policy.execute(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Transient error');
        }
        return Promise.resolve('success');
      });
      
      expect(result.success).toBe(true);
      expect(result.attempt).toBe(2);
    });

    it('should fail after max retries', async () => {
      let attempts = 0;
      
      const result = await policy.execute(() => {
        attempts++;
        throw new Error('Persistent error');
      });
      
      expect(result.success).toBe(false);
      expect(result.attempt).toBe(3);
      expect(result.exhausted).toBe(true);
      expect(result.error?.message).toBe('Persistent error');
    });

    it('should respect retryable status codes', async () => {
      const statusPolicy = new APIRetryPolicy({
        maxAttempts: 3,
        initialDelay: 10,
        retryableStatusCodes: [429, 500, 502, 503, 504],
        retryCondition: (_error, _attempt, context) => {
          return context?.statusCode ? [429, 500, 502, 503, 504].includes(context.statusCode) : false;
        },
      });
      
      let attempts = 0;
      
      const result = await statusPolicy.execute(
        () => {
          attempts++;
          throw new Error('Server error');
        },
        { statusCode: 503 }
      );
      
      expect(attempts).toBe(3);
      statusPolicy.destroy();
    });

    it('should not retry on non-retryable status codes', async () => {
      const statusPolicy = new APIRetryPolicy({
        maxAttempts: 3,
        initialDelay: 10,
        retryCondition: (_error, _attempt, context) => {
          return context?.statusCode ? [429, 500, 502, 503, 504].includes(context.statusCode) : false;
        },
      });
      
      let attempts = 0;
      
      const result = await statusPolicy.execute(
        () => {
          attempts++;
          throw new Error('Not found');
        },
        { statusCode: 404 }
      );
      
      expect(attempts).toBe(1); // No retries
      statusPolicy.destroy();
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const callbackPolicy = new APIRetryPolicy({
        maxAttempts: 3,
        initialDelay: 10,
        onRetry,
      });
      
      let attempts = 0;
      await callbackPolicy.execute(() => {
        attempts++;
        if (attempts < 3) throw new Error('Retry me');
        return Promise.resolve('done');
      });
      
      expect(onRetry).toHaveBeenCalledTimes(2);
      callbackPolicy.destroy();
    });

    it('should call onMaxRetriesExceeded callback', async () => {
      const onMaxRetriesExceeded = vi.fn();
      const callbackPolicy = new APIRetryPolicy({
        maxAttempts: 2,
        initialDelay: 10,
        onMaxRetriesExceeded,
      });
      
      await callbackPolicy.execute(() => {
        throw new Error('Always fails');
      });
      
      expect(onMaxRetriesExceeded).toHaveBeenCalled();
      callbackPolicy.destroy();
    });
  });

  describe('backoff strategies', () => {
    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      const exponentialPolicy = new APIRetryPolicy({
        maxAttempts: 4,
        initialDelay: 10,
        maxDelay: 1000,
        backoffStrategy: 'exponential',
        backoffMultiplier: 2,
        enableJitter: false,
        onRetry: (_attempt, delay) => delays.push(delay),
      });
      
      await exponentialPolicy.execute(() => {
        throw new Error('Always fails');
      });
      
      // Check delays increase exponentially (approximately)
      expect(delays.length).toBe(3);
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);
      
      exponentialPolicy.destroy();
    });

    it('should use linear backoff', async () => {
      const delays: number[] = [];
      const linearPolicy = new APIRetryPolicy({
        maxAttempts: 4,
        initialDelay: 10,
        backoffStrategy: 'linear',
        enableJitter: false,
        onRetry: (_attempt, delay) => delays.push(delay),
      });
      
      await linearPolicy.execute(() => {
        throw new Error('Always fails');
      });
      
      expect(delays.length).toBe(3);
      linearPolicy.destroy();
    });

    it('should use fixed backoff', async () => {
      const delays: number[] = [];
      const fixedPolicy = new APIRetryPolicy({
        maxAttempts: 4,
        initialDelay: 10,
        backoffStrategy: 'fixed',
        enableJitter: false,
        onRetry: (_attempt, delay) => delays.push(delay),
      });
      
      await fixedPolicy.execute(() => {
        throw new Error('Always fails');
      });
      
      // All delays should be the same (no jitter)
      expect(delays.every(d => d === 10)).toBe(true);
      fixedPolicy.destroy();
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit breaker after threshold failures', async () => {
      const cbPolicy = new APIRetryPolicy({
        maxAttempts: 1,
        initialDelay: 10,
        enableCircuitBreaker: true,
        circuitBreakerThreshold: 2,
        circuitBreakerResetTimeout: 1000,
      });
      
      // Fail twice to open circuit breaker
      await cbPolicy.execute(() => { throw new Error('Fail 1'); });
      await cbPolicy.execute(() => { throw new Error('Fail 2'); });
      
      expect(cbPolicy.getCircuitBreakerState()).toBe('open');
      
      cbPolicy.destroy();
    });

    it('should reset circuit breaker', async () => {
      const cbPolicy = new APIRetryPolicy({
        maxAttempts: 1,
        initialDelay: 10,
        enableCircuitBreaker: true,
        circuitBreakerThreshold: 2,
        circuitBreakerResetTimeout: 1000,
      });
      
      // Fail twice to open circuit breaker
      await cbPolicy.execute(() => { throw new Error('Fail 1'); });
      await cbPolicy.execute(() => { throw new Error('Fail 2'); });
      
      expect(cbPolicy.getCircuitBreakerState()).toBe('open');
      
      cbPolicy.resetCircuitBreaker();
      
      expect(cbPolicy.getCircuitBreakerState()).toBe('closed');
      
      cbPolicy.destroy();
    });
  });

  describe('endpoint configs', () => {
    it('should add endpoint-specific config', () => {
      policy.addEndpointConfig('/api/slow', { maxAttempts: 5 });
      // No error means success
    });

    it('should remove endpoint-specific config', () => {
      policy.addEndpointConfig('/api/test', { maxAttempts: 5 });
      const removed = policy.removeEndpointConfig('/api/test');
      expect(removed).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      await policy.execute(() => Promise.resolve('success'));
      await policy.execute(() => Promise.resolve('success'));
      
      try {
        await policy.execute(() => { throw new Error('fail'); });
      } catch {
        // Expected
      }
      
      const stats = policy.getStats();
      
      expect(stats.totalOperations).toBe(3);
      expect(stats.firstTrySuccess).toBe(2);
      expect(stats.totalFailures).toBe(1);
    });
  });

  describe('wrap', () => {
    it('should wrap a function with retry logic', async () => {
      let attempts = 0;
      
      const wrappedFn = policy.wrap(() => {
        attempts++;
        if (attempts < 2) throw new Error('Retry');
        return Promise.resolve('success');
      });
      
      const result = await wrappedFn();
      expect(result).toBe('success');
    });
  });
});

describe('Singleton functions', () => {
  it('should get singleton instance', () => {
    const instance1 = getAPIRetryPolicy();
    const instance2 = getAPIRetryPolicy();
    expect(instance1).toBe(instance2);
  });

  it('should initialize new instance', () => {
    initializeAPIRetryPolicy({ maxAttempts: 5 });
    expect(hasAPIRetryPolicy()).toBe(true);
  });
});

describe('Convenience functions', () => {
  it('should execute with retry', async () => {
    const result = await withRetry(() => Promise.resolve('success'));
    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
  });

  it('should create retryable function', async () => {
    const fn = createRetryable(() => Promise.resolve('success'));
    const result = await fn();
    expect(result).toBe('success');
  });
});

describe('Pre-built retry conditions', () => {
  it('should detect network errors', () => {
    const networkError = new Error('network timeout');
    networkError.name = 'NetworkError';
    
    expect(retryOnNetworkError(networkError, 1)).toBe(true);
  });

  it('should detect server errors', () => {
    expect(retryOnServerError(new Error(), 1, { statusCode: 500 })).toBe(true);
    expect(retryOnServerError(new Error(), 1, { statusCode: 503 })).toBe(true);
    expect(retryOnServerError(new Error(), 1, { statusCode: 200 })).toBe(false);
  });

  it('should detect rate limit', () => {
    expect(retryOnRateLimit(new Error(), 1, { statusCode: 429 })).toBe(true);
    expect(retryOnRateLimit(new Error(), 1, { statusCode: 500 })).toBe(false);
  });

  it('should detect transient errors', () => {
    const networkError = new Error('timeout');
    networkError.name = 'TimeoutError';
    
    expect(retryOnTransientError(networkError, 1)).toBe(true);
    expect(retryOnTransientError(new Error(), 1, { statusCode: 500 })).toBe(true);
    expect(retryOnTransientError(new Error(), 1, { statusCode: 429 })).toBe(true);
    expect(retryOnTransientError(new Error(), 1, { statusCode: 404 })).toBe(false);
  });
});

describe('useAPIRetryPolicy hook', () => {
  it('should return policy methods', () => {
    const hook = useAPIRetryPolicy();
    
    expect(hook.execute).toBeDefined();
    expect(hook.wrap).toBeDefined();
    expect(hook.addEndpointConfig).toBeDefined();
    expect(hook.getStats).toBeDefined();
    expect(hook.getCircuitBreakerState).toBeDefined();
    expect(hook.resetCircuitBreaker).toBeDefined();
    expect(hook.retryOnNetworkError).toBeDefined();
    expect(hook.retryOnServerError).toBeDefined();
    expect(hook.retryOnRateLimit).toBeDefined();
    expect(hook.retryOnTransientError).toBeDefined();
  });
});
