/**
 * Tests for Bulkhead Pattern Implementation
 * 
 * @module services/reliability/bulkhead.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Bulkhead, BulkheadState, bulkheadManager } from './bulkhead';

describe('Bulkhead', () => {
  let bulkhead: Bulkhead;

  beforeEach(() => {
    bulkhead = new Bulkhead({
      name: 'test-bulkhead',
      maxConcurrentCalls: 3,
      maxWaitTime: 100,
      enableDegradation: true,
      degradationThreshold: 0.66 // 2/3 calls
    });
  });

  afterEach(() => {
    bulkhead.reset();
  });

  describe('execute', () => {
    it('should execute operation when slots are available', async () => {
      const operation = vi.fn().mockResolvedValue('result');
      const result = await bulkhead.execute(operation);

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should track active calls correctly', async () => {
      const metrics = bulkhead.getMetrics();
      expect(metrics.activeCalls).toBe(0);

      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const promise1 = bulkhead.execute(operation);
      const promise2 = bulkhead.execute(operation);

      // Check active calls during execution
      expect(bulkhead.getMetrics().activeCalls).toBe(2);

      await Promise.all([promise1, promise2]);

      // After completion, active calls should be 0
      expect(bulkhead.getMetrics().activeCalls).toBe(0);
    });

    it('should reject when max concurrent calls reached and no wait', async () => {
      const noWaitBulkhead = new Bulkhead({
        name: 'no-wait',
        maxConcurrentCalls: 1,
        maxWaitTime: 0
      });

      const slowOperation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      // Start first call
      const promise1 = noWaitBulkhead.execute(slowOperation);

      // Second call should be rejected immediately
      await expect(noWaitBulkhead.execute(slowOperation)).rejects.toThrow('is full');

      await promise1;
    });

    it('should queue calls when max concurrent calls reached', async () => {
      const operation = vi.fn().mockImplementation(() => 
        new Promise<string>(resolve => setTimeout(() => resolve('done'), 50))
      );

      // Start 3 concurrent calls (max)
      const promises = [
        bulkhead.execute(operation),
        bulkhead.execute(operation),
        bulkhead.execute(operation)
      ];

      // Wait a bit for calls to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // All slots should be used
      expect(bulkhead.getMetrics().activeCalls).toBe(3);
      expect(bulkhead.getMetrics().availableSlots).toBe(0);

      // Wait for all to complete
      await Promise.all(promises);
    });

    it('should track metrics correctly', async () => {
      const operation = vi.fn().mockResolvedValue('result');

      await bulkhead.execute(operation);
      await bulkhead.execute(operation);

      const metrics = bulkhead.getMetrics();
      expect(metrics.totalAccepted).toBe(2);
      expect(metrics.peakConcurrentCalls).toBeGreaterThanOrEqual(1);
    });
  });

  describe('tryExecute', () => {
    it('should accept when slots available', async () => {
      const operation = vi.fn().mockResolvedValue('result');
      const { accepted, result } = await bulkhead.tryExecute(operation);

      expect(accepted).toBe(true);
      expect(result).toBe('result');
    });

    it('should reject when no slots available', async () => {
      const slowOperation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      // Fill all slots
      const promises = [
        bulkhead.tryExecute(slowOperation),
        bulkhead.tryExecute(slowOperation),
        bulkhead.tryExecute(slowOperation)
      ];

      // Next call should be rejected
      const result = await bulkhead.tryExecute(slowOperation);
      expect(result.accepted).toBe(false);

      await Promise.all(promises);
    });
  });

  describe('state management', () => {
    it('should start in OPEN state', () => {
      expect(bulkhead.getState()).toBe(BulkheadState.OPEN);
    });

    it('should transition to DEGRADED when threshold reached', async () => {
      const onStateChange = vi.fn();
      const stateBulkhead = new Bulkhead({
        name: 'state-test',
        maxConcurrentCalls: 3,
        maxWaitTime: 100,
        enableDegradation: true,
        degradationThreshold: 0.66,
        onStateChange
      });

      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      // Start 2 calls (66% = degradation threshold)
      const promise1 = stateBulkhead.execute(operation);
      const promise2 = stateBulkhead.execute(operation);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(stateBulkhead.getState()).toBe(BulkheadState.DEGRADED);

      await Promise.all([promise1, promise2]);
    });

    it('should transition to CLOSED when all slots used', async () => {
      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const promises = [
        bulkhead.execute(operation),
        bulkhead.execute(operation),
        bulkhead.execute(operation)
      ];

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(bulkhead.getState()).toBe(BulkheadState.CLOSED);

      await Promise.all(promises);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', async () => {
      const operation = vi.fn().mockResolvedValue('result');
      await bulkhead.execute(operation);

      bulkhead.reset();

      const metrics = bulkhead.getMetrics();
      expect(metrics.activeCalls).toBe(0);
      expect(metrics.totalAccepted).toBe(0);
      expect(metrics.totalRejected).toBe(0);
      expect(bulkhead.getState()).toBe(BulkheadState.OPEN);
    });
  });

  describe('isAvailable', () => {
    it('should return true when slots available', () => {
      expect(bulkhead.isAvailable()).toBe(true);
    });

    it('should return false when all slots used', async () => {
      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const promises = [
        bulkhead.execute(operation),
        bulkhead.execute(operation),
        bulkhead.execute(operation)
      ];

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(bulkhead.isAvailable()).toBe(false);

      await Promise.all(promises);
    });
  });
});

describe('BulkheadManager', () => {
  beforeEach(() => {
    // Reset the singleton
    bulkheadManager.resetAll();
  });

  it('should register and retrieve bulkheads', () => {
    const bulkhead = bulkheadManager.register('test', {
      maxConcurrentCalls: 5,
      maxWaitTime: 1000
    });

    expect(bulkhead).toBeDefined();
    expect(bulkheadManager.get('test')).toBe(bulkhead);
  });

  it('should return existing bulkhead if already registered', () => {
    const bulkhead1 = bulkheadManager.register('test', {
      maxConcurrentCalls: 5,
      maxWaitTime: 1000
    });

    const bulkhead2 = bulkheadManager.register('test', {
      maxConcurrentCalls: 10, // Different config
      maxWaitTime: 2000
    });

    expect(bulkhead1).toBe(bulkhead2);
  });

  it('should get all metrics', () => {
    bulkheadManager.register('test1', { maxConcurrentCalls: 5, maxWaitTime: 1000 });
    bulkheadManager.register('test2', { maxConcurrentCalls: 10, maxWaitTime: 2000 });

    const metrics = bulkheadManager.getAllMetrics();
    expect(Object.keys(metrics)).toContain('test1');
    expect(Object.keys(metrics)).toContain('test2');
  });

  it('should get summary', () => {
    // Note: bulkheadManager already has pre-registered default bulkheads
    const initialSummary = bulkheadManager.getSummary();
    const initialTotal = initialSummary.total;

    bulkheadManager.register('test-summary-1', { maxConcurrentCalls: 5, maxWaitTime: 1000 });
    bulkheadManager.register('test-summary-2', { maxConcurrentCalls: 10, maxWaitTime: 2000 });

    const summary = bulkheadManager.getSummary();
    expect(summary.total).toBe(initialTotal + 2);
    expect(summary.open + summary.closed + summary.degraded).toBe(summary.total);
  });

  it('should reset all bulkheads', () => {
    const bulkhead = bulkheadManager.register('test', {
      maxConcurrentCalls: 5,
      maxWaitTime: 1000
    });

    vi.spyOn(bulkhead, 'reset');
    bulkheadManager.resetAll();

    expect(bulkhead.reset).toHaveBeenCalled();
  });
});
