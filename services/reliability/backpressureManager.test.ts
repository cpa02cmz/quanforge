/**
 * Tests for Backpressure Manager
 * 
 * @module services/reliability/backpressureManager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BackpressureManager,
  PressureLevel,
  LoadSheddingStrategy,
  withBackpressure
} from './backpressureManager';

describe('BackpressureManager', () => {
  let manager: BackpressureManager;

  beforeEach(() => {
    // Reset singleton and create fresh instance for each test
    BackpressureManager['instance'] = null;
    manager = BackpressureManager.getInstance({
      enabled: true,
      monitoringInterval: 1000,
      sheddingStrategy: LoadSheddingStrategy.SHED_LOW_PRIORITY,
      autoLoadShedding: true,
      sheddingCooldown: 1000,
      maxShedPerInterval: 10
    });
  });

  afterEach(() => {
    manager.stop();
    manager.destroy();
    BackpressureManager['instance'] = null;
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      BackpressureManager['instance'] = null;
      const defaultManager = BackpressureManager.getInstance();
      expect(defaultManager).toBeDefined();
      expect(defaultManager.getPressureLevel()).toBe(PressureLevel.LOW);
      defaultManager.destroy();
      BackpressureManager['instance'] = null;
    });

    it('should initialize with custom configuration', () => {
      BackpressureManager['instance'] = null;
      const customManager = BackpressureManager.getInstance({
        monitoringInterval: 5000,
        autoLoadShedding: false
      });
      expect(customManager).toBeDefined();
      customManager.destroy();
      BackpressureManager['instance'] = null;
    });
  });

  describe('pressure level management', () => {
    it('should start with LOW pressure level', () => {
      expect(manager.getPressureLevel()).toBe(PressureLevel.LOW);
    });

    it('should force pressure level change', () => {
      manager.forcePressureLevel(PressureLevel.HIGH);
      expect(manager.getPressureLevel()).toBe(PressureLevel.HIGH);
    });

    it('should emit pressure change events', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.forcePressureLevel(PressureLevel.HIGH);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          previousLevel: PressureLevel.LOW,
          newLevel: PressureLevel.HIGH,
          timestamp: expect.any(Number)
        })
      );
    });

    it('should unsubscribe from events', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      unsubscribe();
      manager.forcePressureLevel(PressureLevel.HIGH);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('request acceptance', () => {
    it('should accept requests under normal pressure', () => {
      manager.forcePressureLevel(PressureLevel.NORMAL);
      expect(manager.shouldAcceptRequest('normal')).toBe(true);
    });

    it('should accept high priority requests even under pressure', () => {
      manager.forcePressureLevel(PressureLevel.HIGH);
      expect(manager.shouldAcceptRequest('high')).toBe(true);
    });

    it('should reject low priority requests when load shedding with SHED_LOW_PRIORITY strategy', () => {
      manager.forcePressureLevel(PressureLevel.CRITICAL);
      // Start monitoring to trigger shedding
      manager['isShedding'] = true;
      manager['lastSheddingTime'] = Date.now();
      
      const result = manager.shouldAcceptRequest('low');
      expect(result).toBe(false);
    });

    it('should accept requests when disabled', () => {
      BackpressureManager['instance'] = null;
      const disabledManager = BackpressureManager.getInstance({ enabled: false });
      disabledManager.forcePressureLevel(PressureLevel.CRITICAL);
      
      expect(disabledManager.shouldAcceptRequest('low')).toBe(true);
      disabledManager.destroy();
      BackpressureManager['instance'] = null;
    });
  });

  describe('rate limit factor', () => {
    it('should return 1 for LOW pressure', () => {
      manager.forcePressureLevel(PressureLevel.LOW);
      expect(manager.getRateLimitFactor()).toBe(1);
    });

    it('should return reduced factor for HIGH pressure', () => {
      manager.forcePressureLevel(PressureLevel.HIGH);
      const factor = manager.getRateLimitFactor();
      expect(factor).toBeLessThan(1);
      expect(factor).toBeGreaterThan(0);
    });

    it('should return reduced factor for CRITICAL pressure', () => {
      manager.forcePressureLevel(PressureLevel.CRITICAL);
      const factor = manager.getRateLimitFactor();
      expect(factor).toBeLessThan(0.5);
      expect(factor).toBeGreaterThan(0);
    });
  });

  describe('task tracking', () => {
    it('should track task starts', () => {
      manager.recordTaskStart();
      manager.recordTaskStart();
      const metrics = manager.getMetrics();
      expect(metrics.pendingTasks).toBe(2);
    });

    it('should track task ends', () => {
      manager.recordTaskStart();
      manager.recordTaskStart();
      manager.recordTaskEnd(true);
      const metrics = manager.getMetrics();
      expect(metrics.pendingTasks).toBe(1);
    });

    it('should track success and errors', () => {
      manager.recordTaskStart();
      manager.recordTaskEnd(true);
      manager.recordTaskStart();
      manager.recordTaskEnd(false);
      
      const metrics = manager.getMetrics();
      // Error rate should be 50% (1 success, 1 error)
      expect(metrics.errorRate).toBeCloseTo(0.5, 1);
    });

    it('should not go below zero for pending tasks', () => {
      manager.recordTaskEnd(true);
      manager.recordTaskEnd(true);
      manager.recordTaskEnd(true);
      const metrics = manager.getMetrics();
      expect(metrics.pendingTasks).toBe(0);
    });
  });

  describe('cache tracking', () => {
    it('should track cache hits', () => {
      manager.recordCacheHit();
      manager.recordCacheHit();
      manager.recordCacheHit();
      // Cache hit rate should be 100% with no misses
      manager['collectMetrics']();
      const metrics = manager.getMetrics();
      expect(metrics.cacheHitRate).toBe(1);
    });

    it('should track cache misses', () => {
      manager.recordCacheHit();
      manager.recordCacheMiss();
      manager.recordCacheMiss();
      // Collect metrics to recalculate rates
      manager['collectMetrics']();
      const metrics = manager.getMetrics();
      expect(metrics.cacheHitRate).toBeCloseTo(0.33, 1);
    });
  });

  describe('status reporting', () => {
    it('should return complete status', () => {
      const status = manager.getStatus();
      
      expect(status).toHaveProperty('level');
      expect(status).toHaveProperty('metrics');
      expect(status).toHaveProperty('isShedding');
      expect(status).toHaveProperty('shedCount');
      expect(status).toHaveProperty('totalShed');
      expect(status).toHaveProperty('recommendedAction');
      expect(status).toHaveProperty('pressureScore');
    });

    it('should indicate healthy system', () => {
      manager.forcePressureLevel(PressureLevel.LOW);
      expect(manager.isHealthy()).toBe(true);
    });

    it('should indicate unhealthy system under critical pressure', () => {
      manager.forcePressureLevel(PressureLevel.CRITICAL);
      expect(manager.isHealthy()).toBe(false);
    });

    it('should provide recommended actions', () => {
      manager.forcePressureLevel(PressureLevel.CRITICAL);
      const status = manager.getStatus();
      expect(status.recommendedAction).toContain('shedding');
    });
  });

  describe('monitoring lifecycle', () => {
    it('should start monitoring', () => {
      manager.start();
      // Should have started monitoring interval
      expect(manager['monitoringInterval']).not.toBeNull();
    });

    it('should stop monitoring', () => {
      manager.start();
      manager.stop();
      expect(manager['monitoringInterval']).toBeNull();
    });

    it('should handle multiple start calls', () => {
      manager.start();
      manager.start(); // Should not throw or create duplicate intervals
      expect(manager['monitoringInterval']).not.toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset all counters', () => {
      manager.recordTaskStart();
      manager.recordTaskStart();
      manager.recordCacheHit();
      manager.recordCacheMiss();
      manager['shedCount'] = 5;
      manager['totalShed'] = 10;
      
      manager.reset();
      
      const metrics = manager.getMetrics();
      expect(metrics.pendingTasks).toBe(0);
      expect(manager.getStatus().shedCount).toBe(0);
      expect(manager.getStatus().totalShed).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      manager.updateConfig({ monitoringInterval: 10000 });
      expect(manager['config'].monitoringInterval).toBe(10000);
    });
  });
});

describe('withBackpressure helper', () => {
  // Get the global singleton that withBackpressure uses
  let manager: BackpressureManager;

  beforeEach(() => {
    // Use the global singleton
    manager = BackpressureManager.getInstance({
      enabled: true,
      autoLoadShedding: false
    });
    manager.reset();
  });

  afterEach(() => {
    manager.stop();
    manager.destroy();
    BackpressureManager['instance'] = null;
  });

  it('should execute function successfully', async () => {
    const result = await withBackpressure(() => Promise.resolve('success'));
    expect(result).toBe('success');
  });

  it('should track task execution', async () => {
    await withBackpressure(() => Promise.resolve('test'));
    const metrics = manager.getMetrics();
    expect(metrics.pendingTasks).toBe(0); // Task should be finished
  });

  it('should call onRejected callback when request is rejected', async () => {
    // Force critical pressure and shedding on the global singleton
    manager.forcePressureLevel(PressureLevel.CRITICAL);
    manager['isShedding'] = true;
    manager['lastSheddingTime'] = Date.now();
    manager['config'].sheddingStrategy = LoadSheddingStrategy.REJECT_NEW;
    
    const result = await withBackpressure(
      () => Promise.resolve('should not be called'),
      {
        priority: 'low',
        onRejected: () => 'fallback'
      }
    );
    
    expect(result).toBe('fallback');
  });

  it('should throw error when rejected without fallback', async () => {
    // Force critical pressure and shedding on the global singleton
    manager.forcePressureLevel(PressureLevel.CRITICAL);
    manager['isShedding'] = true;
    manager['lastSheddingTime'] = Date.now();
    manager['config'].sheddingStrategy = LoadSheddingStrategy.REJECT_NEW;
    
    await expect(
      withBackpressure(() => Promise.resolve('should not be called'), { priority: 'low' })
    ).rejects.toThrow('Request rejected due to backpressure');
  });

  it('should propagate errors from the function', async () => {
    await expect(
      withBackpressure(() => Promise.reject(new Error('test error')))
    ).rejects.toThrow('test error');
  });
});
