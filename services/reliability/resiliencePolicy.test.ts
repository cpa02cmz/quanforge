/**
 * Tests for Resilience Policy
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ResiliencePolicy,
  ResiliencePolicyManager,
  withResilience,
  ResiliencePattern,
  type ResiliencePolicyConfig
} from './resiliencePolicy';

describe('ResiliencePolicy', () => {
  let policy: ResiliencePolicy;

  const createTestConfig = (): ResiliencePolicyConfig => ({
    serviceName: 'test-service',
    patterns: [
      ResiliencePattern.CIRCUIT_BREAKER,
      ResiliencePattern.RETRY,
      ResiliencePattern.TIMEOUT
    ],
    circuitBreaker: {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 5000,
      resetTimeout: 10000
    },
    retry: {
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitter: false
    },
    timeout: {
      duration: 5000
    },
    enableMetrics: true
  });

  beforeEach(() => {
    policy = new ResiliencePolicy(createTestConfig());
  });

  describe('execute', () => {
    it('should execute successful function', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await policy.execute(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should track metrics', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      
      await policy.execute(fn);
      
      const metrics = policy.getMetrics();
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(1);
    });

    it('should record failed calls', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('test error'));
      
      await expect(policy.execute(fn)).rejects.toThrow('test error');
      
      const metrics = policy.getMetrics();
      expect(metrics.failedCalls).toBe(1);
    });
  });

  describe('retry pattern', () => {
    it('should retry on failure', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('error 1'))
        .mockRejectedValueOnce(new Error('error 2'))
        .mockResolvedValue('success');
      
      const result = await policy.execute(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      
      const metrics = policy.getMetrics();
      expect(metrics.retryCalls).toBe(1);
    });

    it('should exhaust retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));
      
      await expect(policy.execute(fn)).rejects.toThrow('always fails');
      
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('circuit breaker pattern', () => {
    it('should open circuit after threshold failures', async () => {
      const config = createTestConfig();
      config.circuitBreaker = {
        failureThreshold: 2,
        successThreshold: 2,
        timeout: 1000,
        resetTimeout: 10000
      };
      
      policy = new ResiliencePolicy(config);
      
      const fn = vi.fn().mockRejectedValue(new Error('failure'));
      
      // Cause failures to trip circuit
      await expect(policy.execute(fn)).rejects.toThrow();
      await expect(policy.execute(fn)).rejects.toThrow();
      
      // Circuit should be open now
      await expect(policy.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
    });
  });

  describe('timeout pattern', () => {
    it('should timeout slow operations', async () => {
      const config = createTestConfig();
      config.timeout = { duration: 50 };
      config.patterns = [ResiliencePattern.TIMEOUT];
      
      policy = new ResiliencePolicy(config);
      
      const slowFn = () => new Promise(resolve => setTimeout(resolve, 1000));
      
      await expect(policy.execute(slowFn)).rejects.toThrow('timed out');
      
      const metrics = policy.getMetrics();
      expect(metrics.timeoutCalls).toBe(1);
    });
  });

  describe('fallback pattern', () => {
    it('should use fallback on failure', async () => {
      const fallbackHandler = vi.fn().mockResolvedValue('fallback value');
      const config: ResiliencePolicyConfig = {
        serviceName: 'fallback-test',
        patterns: [ResiliencePattern.FALLBACK],
        fallback: {
          handler: fallbackHandler
        },
        enableMetrics: true
      };
      
      policy = new ResiliencePolicy(config);
      
      const fn = vi.fn().mockRejectedValue(new Error('primary failed'));
      
      const result = await policy.execute(fn);
      
      expect(result).toBe('fallback value');
      expect(fallbackHandler).toHaveBeenCalled();
      
      const metrics = policy.getMetrics();
      expect(metrics.fallbackCalls).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return comprehensive metrics', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      
      await policy.execute(fn);
      await policy.execute(fn);
      
      const metrics = policy.getMetrics();
      
      expect(metrics.serviceName).toBe('test-service');
      expect(metrics.totalCalls).toBe(2);
      expect(metrics.successfulCalls).toBe(2);
      expect(metrics.avgLatency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reset', () => {
    it('should reset all counters', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      
      await policy.execute(fn);
      policy.reset();
      
      const metrics = policy.getMetrics();
      expect(metrics.totalCalls).toBe(0);
    });
  });
});

describe('ResiliencePolicyManager', () => {
  let manager: ResiliencePolicyManager;

  beforeEach(() => {
    manager = new ResiliencePolicyManager();
  });

  it('should create and store policies', () => {
    const policy = manager.createPolicy({
      serviceName: 'test',
      patterns: []
    });
    
    expect(policy).toBeInstanceOf(ResiliencePolicy);
    expect(manager.getPolicy('test')).toBe(policy);
  });

  it('should execute with policy', async () => {
    manager.createPolicy({
      serviceName: 'test',
      patterns: []
    });
    
    const fn = vi.fn().mockResolvedValue('result');
    const result = await manager.execute('test', fn);
    
    expect(result).toBe('result');
  });

  it('should throw for unknown policy', async () => {
    await expect(manager.execute('unknown', async () => {}))
      .rejects.toThrow('not found');
  });

  it('should get all metrics', async () => {
    manager.createPolicy({
      serviceName: 'service1',
      patterns: []
    });
    manager.createPolicy({
      serviceName: 'service2',
      patterns: []
    });
    
    const allMetrics = manager.getAllMetrics();
    expect(allMetrics).toHaveLength(2);
  });

  it('should reset all policies', async () => {
    const policy1 = manager.createPolicy({
      serviceName: 'service1',
      patterns: []
    });
    
    const fn = vi.fn().mockResolvedValue('result');
    await policy1.execute(fn);
    
    manager.resetAll();
    
    const metrics = policy1.getMetrics();
    expect(metrics.totalCalls).toBe(0);
  });
});

describe('withResilience decorator', () => {
  it('should wrap function with resilience', async () => {
    const decorator = withResilience({
      serviceName: 'decorated-service',
      patterns: []
    });
    
    const originalFn = vi.fn().mockResolvedValue('result');
    const wrappedFn = decorator(originalFn);
    
    const result = await wrappedFn();
    
    expect(result).toBe('result');
    expect(originalFn).toHaveBeenCalled();
  });
});
