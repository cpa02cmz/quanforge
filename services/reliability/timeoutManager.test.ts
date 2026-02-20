/**
 * Tests for Timeout Manager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeoutManager, TimerType } from './timeoutManager';

describe('TimeoutManager', () => {
  let manager: TimeoutManager;

  beforeEach(() => {
    manager = new TimeoutManager({ enableLeakDetection: false, enableDebugLogging: false });
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  describe('setTimeout', () => {
    it('should create a managed timeout', () => {
      const callback = vi.fn();
      const id = manager.setTimeout(callback, 1000, 'test-timer');
      
      expect(id).toBeDefined();
      expect(manager.isActive('test-timer')).toBe(true);
    });

    it('should execute callback after delay', () => {
      const callback = vi.fn();
      manager.setTimeout(callback, 1000, 'test-timer');
      
      vi.advanceTimersByTime(500);
      expect(callback).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should mark timer as cleared after execution', () => {
      const callback = vi.fn();
      manager.setTimeout(callback, 1000, 'test-timer');
      
      vi.advanceTimersByTime(1000);
      
      expect(manager.isActive('test-timer')).toBe(false);
    });

    it('should replace existing timer with same name', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      manager.setTimeout(callback1, 1000, 'test-timer');
      manager.setTimeout(callback2, 2000, 'test-timer');
      
      vi.advanceTimersByTime(1000);
      expect(callback1).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(1000);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should clear timer before execution', () => {
      const callback = vi.fn();
      manager.setTimeout(callback, 1000, 'test-timer');
      
      manager.clearTimer('test-timer');
      
      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('setInterval', () => {
    it('should create a managed interval', () => {
      const callback = vi.fn();
      const id = manager.setInterval(callback, 1000, 'test-interval');
      
      expect(id).toBeDefined();
      expect(manager.isActive('test-interval')).toBe(true);
    });

    it('should execute callback repeatedly', () => {
      const callback = vi.fn();
      manager.setInterval(callback, 1000, 'test-interval');
      
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);
      
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should stop interval when cleared', () => {
      const callback = vi.fn();
      manager.setInterval(callback, 1000, 'test-interval');
      
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);
      
      manager.clearTimer('test-interval');
      
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearByOwner', () => {
    it('should clear all timers owned by a specific owner', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();
      
      manager.setTimeout(callback1, 1000, 'timer-1', 'owner-a');
      manager.setTimeout(callback2, 1000, 'timer-2', 'owner-a');
      manager.setTimeout(callback3, 1000, 'timer-3', 'owner-b');
      
      const cleared = manager.clearByOwner('owner-a');
      
      expect(cleared).toBe(2);
      expect(manager.isActive('timer-1')).toBe(false);
      expect(manager.isActive('timer-2')).toBe(false);
      expect(manager.isActive('timer-3')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const callback = vi.fn();
      
      manager.setTimeout(callback, 1000, 'timeout-1');
      manager.setTimeout(callback, 2000, 'timeout-2');
      manager.setInterval(callback, 1000, 'interval-1');
      
      const stats = manager.getStats();
      
      expect(stats.activeTimers).toBe(2);
      expect(stats.activeIntervals).toBe(1);
      expect(stats.totalCreated).toBe(3);
    });
  });

  describe('clearAll', () => {
    it('should clear all active timers', () => {
      const callback = vi.fn();
      
      manager.setTimeout(callback, 1000, 'timer-1');
      manager.setTimeout(callback, 2000, 'timer-2');
      manager.setInterval(callback, 1000, 'interval-1');
      
      const cleared = manager.clearAll();
      
      expect(cleared).toBe(3);
      expect(manager.isActive('timer-1')).toBe(false);
      expect(manager.isActive('timer-2')).toBe(false);
      expect(manager.isActive('interval-1')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should catch and log callback errors', () => {
      const errorCallback = () => {
        throw new Error('Test error');
      };
      
      // Should not throw
      expect(() => {
        manager.setTimeout(errorCallback, 1000, 'error-timer');
        vi.advanceTimersByTime(1000);
      }).not.toThrow();
    });
  });

  describe('replaceTimeout', () => {
    it('should replace existing timeout', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      manager.setTimeout(callback1, 1000, 'replace-test');
      manager.replaceTimeout(callback2, 2000, 'replace-test');
      
      vi.advanceTimersByTime(1000);
      expect(callback1).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(1000);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTimerDetails', () => {
    it('should return timer metadata', () => {
      const callback = function testCallback() { /* test */ };
      
      manager.setTimeout(callback, 1000, 'detail-test', 'test-owner');
      
      const details = manager.getTimerDetails('detail-test');
      
      expect(details).toBeDefined();
      expect(details?.type).toBe(TimerType.TIMEOUT);
      expect(details?.name).toBe('detail-test');
      expect(details?.owner).toBe('test-owner');
      expect(details?.delay).toBe(1000);
    });
  });

  describe('reset', () => {
    it('should reset manager state', () => {
      const callback = vi.fn();
      
      manager.setTimeout(callback, 1000, 'timer-1');
      manager.setTimeout(callback, 2000, 'timer-2');
      
      manager.reset();
      
      const stats = manager.getStats();
      expect(stats.activeTimers).toBe(0);
      expect(stats.totalCreated).toBe(0);
      expect(stats.totalCleared).toBe(0);
    });
  });
});
