/**
 * API Deduplicator Tests
 * 
 * Comprehensive test suite for API request deduplication
 * Addresses Issue #815: Test Coverage Gap
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiDeduplicator, apiDeduplicator } from './apiDeduplicator';

describe('ApiDeduplicator', () => {
  let deduplicator: ApiDeduplicator;

  beforeEach(() => {
    deduplicator = new ApiDeduplicator();
  });

  afterEach(() => {
    deduplicator.destroy();
  });

  describe('deduplicate', () => {
    it('should execute a new request', async () => {
      const requestFn = vi.fn().mockResolvedValue('result');
      
      const result = await deduplicator.deduplicate('key1', requestFn);
      
      expect(result).toBe('result');
      expect(requestFn).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent requests with the same key', async () => {
      let resolveFn: (value: string) => void;
      const requestFn = vi.fn().mockImplementation(() => 
        new Promise(resolve => { resolveFn = resolve; })
      );
      
      // Start two requests with the same key concurrently
      const promise1 = deduplicator.deduplicate('key1', requestFn);
      const promise2 = deduplicator.deduplicate('key1', requestFn);
      
      // Resolve the underlying request
      resolveFn!('result');
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(requestFn).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should execute different keys independently', async () => {
      const requestFn1 = vi.fn().mockResolvedValue('result1');
      const requestFn2 = vi.fn().mockResolvedValue('result2');
      
      const result1 = await deduplicator.deduplicate('key1', requestFn1);
      const result2 = await deduplicator.deduplicate('key2', requestFn2);
      
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(requestFn1).toHaveBeenCalledTimes(1);
      expect(requestFn2).toHaveBeenCalledTimes(1);
    });

    it('should allow new request after previous completes', async () => {
      const requestFn = vi.fn().mockResolvedValue('result');
      
      await deduplicator.deduplicate('key1', requestFn);
      await deduplicator.deduplicate('key1', requestFn);
      
      expect(requestFn).toHaveBeenCalledTimes(2);
    });

    it('should reject all concurrent requests when one fails', async () => {
      const error = new Error('Request failed');
      let rejectFn: (error: Error) => void;
      const requestFn = vi.fn().mockImplementation(() => 
        new Promise((_, reject) => { rejectFn = reject; })
      );
      
      const promise1 = deduplicator.deduplicate('key1', requestFn);
      const promise2 = deduplicator.deduplicate('key1', requestFn);
      
      // Reject the underlying request
      rejectFn!(error);
      
      await expect(promise1).rejects.toThrow('Request failed');
      await expect(promise2).rejects.toThrow('Request failed');
    });
  });

  describe('deduplicateWithCache', () => {
    it('should cache successful responses', async () => {
      const requestFn = vi.fn().mockResolvedValue('cached-result');
      
      const result1 = await deduplicator.deduplicateWithCache('key1', requestFn, 5000);
      const result2 = await deduplicator.deduplicateWithCache('key1', requestFn, 5000);
      
      expect(result1).toBe('cached-result');
      expect(result2).toBe('cached-result');
      expect(requestFn).toHaveBeenCalledTimes(1);
    });


  });

  describe('generateKey', () => {
    it('should return endpoint when no params', () => {
      const key = ApiDeduplicator.generateKey('/api/users');
      expect(key).toBe('/api/users');
    });

    it('should generate consistent keys for same params', () => {
      const params = { b: 2, a: 1 };
      const key1 = ApiDeduplicator.generateKey('/api/users', params);
      const key2 = ApiDeduplicator.generateKey('/api/users', { a: 1, b: 2 });
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different params', () => {
      const key1 = ApiDeduplicator.generateKey('/api/users', { id: 1 });
      const key2 = ApiDeduplicator.generateKey('/api/users', { id: 2 });
      
      expect(key1).not.toBe(key2);
    });

    it('should handle null values', () => {
      const key = ApiDeduplicator.generateKey('/api/users', { id: null, name: undefined });
      expect(key).toContain('id:null');
    });

    it('should handle nested objects', () => {
      const params = { filter: { age: 25, name: 'John' } };
      const key = ApiDeduplicator.generateKey('/api/users', params);
      expect(key).toContain('filter');
      expect(key).toContain('age');
    });
  });

  describe('generateDeepKey', () => {
    it('should return endpoint when no params', () => {
      const key = ApiDeduplicator.generateDeepKey('/api/users');
      expect(key).toBe('/api/users');
    });

    it('should generate hash-based keys', () => {
      const params = { id: 1, name: 'test' };
      const key = ApiDeduplicator.generateDeepKey('/api/users', params);
      
      expect(key).toMatch(/\/api\/users#\d+/);
    });

    it('should generate consistent keys for identical params', () => {
      // Same params in same order should generate same key
      const params = { a: 1, b: 2 };
      const key1 = ApiDeduplicator.generateDeepKey('/api/users', params);
      const key2 = ApiDeduplicator.generateDeepKey('/api/users', { a: 1, b: 2 });
      
      expect(key1).toBe(key2);
    });

    it('should handle special types', () => {
      const params = {
        date: new Date('2024-01-01'),
        regex: /test/gi,
        map: new Map([['key', 'value']]),
        set: new Set([1, 2, 3]),
      };
      
      const key = ApiDeduplicator.generateDeepKey('/api/users', params);
      expect(key).toMatch(/\/api\/users#\d+/);
    });
  });

  describe('isPending', () => {
    it('should return false when no request is pending', () => {
      expect(deduplicator.isPending('key1')).toBe(false);
    });

    it('should return true when request is pending', async () => {
      let resolveFn: (value: string) => void;
      const requestFn = vi.fn().mockImplementation(() => 
        new Promise(resolve => { resolveFn = resolve; })
      );
      
      const promise = deduplicator.deduplicate('key1', requestFn);
      
      expect(deduplicator.isPending('key1')).toBe(true);
      
      resolveFn!('result');
      await promise;
      
      expect(deduplicator.isPending('key1')).toBe(false);
    });
  });

  describe('getPendingCount', () => {
    it('should return 0 when no requests pending', () => {
      expect(deduplicator.getPendingCount()).toBe(0);
    });

    it('should return count of pending requests', async () => {
      let resolveFn1: (value: string) => void;
      let resolveFn2: (value: string) => void;
      const requestFn1 = vi.fn().mockImplementation(() => 
        new Promise(resolve => { resolveFn1 = resolve; })
      );
      const requestFn2 = vi.fn().mockImplementation(() => 
        new Promise(resolve => { resolveFn2 = resolve; })
      );
      
      deduplicator.deduplicate('key1', requestFn1);
      deduplicator.deduplicate('key2', requestFn2);
      
      expect(deduplicator.getPendingCount()).toBe(2);
      
      resolveFn1!('result1');
      resolveFn2!('result2');
      await Promise.all([requestFn1, requestFn2]);
      
      expect(deduplicator.getPendingCount()).toBe(0);
    });
  });

  describe('getPendingKeys', () => {
    it('should return empty array when no requests', () => {
      expect(deduplicator.getPendingKeys()).toEqual([]);
    });

    it('should return array of pending keys', async () => {
      let resolveFn1: (value: string) => void;
      let resolveFn2: (value: string) => void;
      const requestFn1 = vi.fn().mockImplementation(() => 
        new Promise(resolve => { resolveFn1 = resolve; })
      );
      const requestFn2 = vi.fn().mockImplementation(() => 
        new Promise(resolve => { resolveFn2 = resolve; })
      );
      
      deduplicator.deduplicate('key1', requestFn1);
      deduplicator.deduplicate('key2', requestFn2);
      
      const keys = deduplicator.getPendingKeys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toHaveLength(2);
      
      resolveFn1!('result1');
      resolveFn2!('result2');
      await Promise.all([requestFn1, requestFn2]);
    });
  });

  describe('cancelRequest', () => {
    it('should return false when key not found', () => {
      const cancelled = deduplicator.cancelRequest('nonexistent');
      expect(cancelled).toBe(false);
    });
  });

  describe('cancelRequestsByPattern', () => {
    it('should return 0 when no matches found', () => {
      const count = deduplicator.cancelRequestsByPattern('nonexistent');
      expect(count).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should stop cleanup interval', () => {
      deduplicator.destroy();
      // Should not throw when destroying multiple times
      expect(() => deduplicator.destroy()).not.toThrow();
    });
  });
});

describe('apiDeduplicator singleton', () => {
  it('should be defined', () => {
    expect(apiDeduplicator).toBeDefined();
    expect(apiDeduplicator.deduplicate).toBeDefined();
    expect(apiDeduplicator.isPending).toBeDefined();
    expect(apiDeduplicator.cancelRequest).toBeDefined();
    expect(apiDeduplicator.cancelRequestsByPattern).toBeDefined();
    expect(apiDeduplicator.getPendingCount).toBeDefined();
    expect(ApiDeduplicator.generateKey).toBeDefined();
    expect(ApiDeduplicator.generateDeepKey).toBeDefined();
  });
});
