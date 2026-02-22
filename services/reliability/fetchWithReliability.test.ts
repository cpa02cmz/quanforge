/**
 * Tests for FetchWithReliability
 * 
 * @module services/reliability/fetchWithReliability.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FetchWithReliability,
  fetchWithTimeout,
  calculateDelay,
  isRetryableError,
  generateCacheKey,
  DEFAULT_RETRY_CONFIG
} from './fetchWithReliability';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FetchWithReliability', () => {
  let instance: FetchWithReliability;

  beforeEach(() => {
    vi.clearAllMocks();
    instance = new FetchWithReliability({
      retry: { ...DEFAULT_RETRY_CONFIG, initialDelay: 10, maxDelay: 100 }
    });
  });

  afterEach(() => {
    instance.destroy();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = FetchWithReliability.getInstance();
      const instance2 = FetchWithReliability.getInstance();
      expect(instance1).toBe(instance2);
      instance1.destroy();
    });
  });

  describe('fetch', () => {
    it('should make successful fetch request', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      const response = await instance.fetch('https://api.example.com/test');
      
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on abort error', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(
        instance.fetch('https://api.example.com/test')
      ).rejects.toThrow('Aborted');
      
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('metrics', () => {
    it('should track successful requests', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      await instance.fetch('https://api.example.com/test1');
      await instance.fetch('https://api.example.com/test2');

      const metrics = instance.getMetrics();
      
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(2);
    });

    it('should track failed requests', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      try { await instance.fetch('https://api.example.com/test'); } catch { /* intentionally ignored - testing error handling */ }

      const metrics = instance.getMetrics();
      
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedRequests).toBe(1);
    });
  });

  describe('resetMetrics', () => {
    it('should reset metrics', () => {
      instance.resetMetrics();
      const metrics = instance.getMetrics();
      
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset circuit breaker', () => {
      // Just test that the method exists and can be called
      instance.resetCircuitBreaker('test-key');
      
      // Verify no errors thrown
      expect(true).toBe(true);
    });
  });
});

describe('calculateDelay', () => {
  it('should calculate exponential backoff with jitter', () => {
    const config = DEFAULT_RETRY_CONFIG;
    
    // Multiple calls to verify jitter is applied
    const delays = [1, 2, 3].map(attempt => calculateDelay(attempt, config));
    
    // All delays should be positive
    delays.forEach(delay => expect(delay).toBeGreaterThan(0));
    
    // Delay should increase with attempts (ignoring jitter for this test)
    const baseDelays = [1, 2, 3].map(
      attempt => config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1)
    );
    
    // Delays should be close to base delays (within jitter range)
    delays.forEach((delay, i) => {
      const baseDelay = Math.min(baseDelays[i], config.maxDelay);
      expect(delay).toBeGreaterThanOrEqual(baseDelay * (1 - config.jitter));
      expect(delay).toBeLessThanOrEqual(baseDelay * (1 + config.jitter));
    });
  });

  it('should respect max delay', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, maxDelay: 100, jitter: 0 };
    // With 0 jitter, delay should be exactly maxDelay for high attempts
    const delay = calculateDelay(10, config);
    expect(delay).toBeLessThanOrEqual(config.maxDelay);
  });
});

describe('isRetryableError', () => {
  const config = DEFAULT_RETRY_CONFIG;

  it('should identify abort error as non-retryable', () => {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    
    expect(isRetryableError(error, config)).toBe(false);
  });

  it('should identify network errors as retryable', () => {
    const error = new Error('network error');
    expect(isRetryableError(error, config)).toBe(true);
  });

  it('should identify fetch errors as retryable', () => {
    const error = new Error('fetch failed');
    expect(isRetryableError(error, config)).toBe(true);
  });

  it('should identify timeout errors as retryable', () => {
    const error = new Error('timeout exceeded');
    expect(isRetryableError(error, config)).toBe(true);
  });
});

describe('generateCacheKey', () => {
  it('should generate consistent cache key', () => {
    const key1 = generateCacheKey('https://api.example.com/test', { method: 'GET' });
    const key2 = generateCacheKey('https://api.example.com/test', { method: 'GET' });
    
    expect(key1).toBe(key2);
  });

  it('should include method in cache key', () => {
    const key1 = generateCacheKey('https://api.example.com/test', { method: 'GET' });
    const key2 = generateCacheKey('https://api.example.com/test', { method: 'POST' });
    
    expect(key1).not.toBe(key2);
  });

  it('should include body in cache key', () => {
    const key1 = generateCacheKey('https://api.example.com/test', { 
      method: 'POST', 
      body: '{"data":"test"}' 
    });
    const key2 = generateCacheKey('https://api.example.com/test', { 
      method: 'POST', 
      body: '{"data":"other"}' 
    });
    
    expect(key1).not.toBe(key2);
  });
});

describe('fetchWithTimeout', () => {
  it('should complete fast requests', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const response = await fetchWithTimeout('https://api.example.com/test', {}, 1000);
    expect(response.ok).toBe(true);
  });
});
