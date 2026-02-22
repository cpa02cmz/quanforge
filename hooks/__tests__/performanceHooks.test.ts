/**
 * Tests for Performance Hooks
 * @module hooks/__tests__/performanceHooks.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock window.requestIdleCallback
const mockRequestIdleCallback = vi.fn();
const mockCancelIdleCallback = vi.fn();

describe('Performance Hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    
    // Mock requestIdleCallback
    window.requestIdleCallback = mockRequestIdleCallback.mockImplementation((cb) => {
      return window.setTimeout(() => cb({ 
        didTimeout: false, 
        timeRemaining: () => 50 
      }), 0);
    }) as unknown as typeof window.requestIdleCallback;
    
    window.cancelIdleCallback = mockCancelIdleCallback.mockImplementation((id) => {
      window.clearTimeout(id);
    }) as unknown as typeof window.cancelIdleCallback;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('useIdleCallback', () => {
    it('should be importable', async () => {
      const { useIdleCallback } = await import('../useIdleCallback');
      expect(useIdleCallback).toBeDefined();
      expect(typeof useIdleCallback).toBe('function');
    });

    it('should schedule idle work', async () => {
      const { useIdleCallback } = await import('../useIdleCallback');
      const { result } = renderHook(() => useIdleCallback());
      
      const callback = vi.fn();
      
      act(() => {
        result.current.scheduleIdleWork(callback);
      });
      
      expect(mockRequestIdleCallback).toHaveBeenCalled();
    });

    it('should cancel idle work', async () => {
      const { useIdleCallback } = await import('../useIdleCallback');
      const { result } = renderHook(() => useIdleCallback());
      
      const callback = vi.fn();
      
      let idleId: number;
      act(() => {
        idleId = result.current.scheduleIdleWork(callback);
      });
      
      act(() => {
        result.current.cancelIdleWork(idleId!);
      });
      
      expect(mockCancelIdleCallback).toHaveBeenCalled();
    });
  });

  describe('useIdleCallbackEffect', () => {
    it('should be importable', async () => {
      const { useIdleCallbackEffect } = await import('../useIdleCallback');
      expect(useIdleCallbackEffect).toBeDefined();
      expect(typeof useIdleCallbackEffect).toBe('function');
    });
  });

  describe('useIdleProcessor', () => {
    it('should be importable', async () => {
      const { useIdleProcessor } = await import('../useIdleCallback');
      expect(useIdleProcessor).toBeDefined();
      expect(typeof useIdleProcessor).toBe('function');
    });
  });
});

describe('useLazyComponent', () => {
  beforeEach(() => {
    // Mock IntersectionObserver
    const mockObserve = vi.fn();
    const mockDisconnect = vi.fn();
    
    window.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: mockObserve,
      unobserve: vi.fn(),
      disconnect: mockDisconnect,
    }));
  });

  it('should be importable', async () => {
    const { useLazyComponent } = await import('../useLazyComponent');
    expect(useLazyComponent).toBeDefined();
    expect(typeof useLazyComponent).toBe('function');
  });

  it('should return ref and state', async () => {
    const { useLazyComponent } = await import('../useLazyComponent');
    const { result } = renderHook(() => useLazyComponent());
    
    expect(result.current.ref).toBeDefined();
    expect(result.current).toHaveProperty('isLoaded');
    expect(result.current).toHaveProperty('isVisible');
    expect(result.current).toHaveProperty('hasError');
  });
});

describe('usePreloadComponents', () => {
  it('should be importable', async () => {
    const { usePreloadComponents } = await import('../useLazyComponent');
    expect(usePreloadComponents).toBeDefined();
    expect(typeof usePreloadComponents).toBe('function');
  });

  it('should return preload functions', async () => {
    const { usePreloadComponents } = await import('../useLazyComponent');
    const { result } = renderHook(() => usePreloadComponents());
    
    expect(result.current).toHaveProperty('preload');
    expect(result.current).toHaveProperty('preloadOnIdle');
    expect(result.current).toHaveProperty('isPreloading');
    expect(typeof result.current.preload).toBe('function');
    expect(typeof result.current.preloadOnIdle).toBe('function');
  });
});

describe('createLazyComponent', () => {
  it('should be importable', async () => {
    const { createLazyComponent } = await import('../useLazyComponent');
    expect(createLazyComponent).toBeDefined();
    expect(typeof createLazyComponent).toBe('function');
  });
});

describe('LazyComponentWrapper', () => {
  it('should be importable', async () => {
    const { LazyComponentWrapper } = await import('../useLazyComponent');
    expect(LazyComponentWrapper).toBeDefined();
    expect(typeof LazyComponentWrapper).toBe('function');
  });
});

describe('Performance Metrics Collector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be importable', async () => {
    const { getMetricsCollector } = await import('../../services/performance/metricsCollector');
    expect(getMetricsCollector).toBeDefined();
    expect(typeof getMetricsCollector).toBe('function');
  });

  it('should return singleton instance', async () => {
    const { getMetricsCollector } = await import('../../services/performance/metricsCollector');
    const instance1 = getMetricsCollector();
    const instance2 = getMetricsCollector();
    
    expect(instance1).toBe(instance2);
  });

  it('should record metrics', async () => {
    const { getMetricsCollector } = await import('../../services/performance/metricsCollector');
    const collector = getMetricsCollector({ debug: false });
    
    collector.recordMetric({
      name: 'test_metric',
      type: 'custom',
      value: 100,
      unit: 'ms',
    });
    
    const metrics = collector.getMetrics();
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics[0]?.name).toBe('test_metric');
    expect(metrics[0]?.value).toBe(100);
    
    collector.clear();
  });

  it('should start timing', async () => {
    const { getMetricsCollector } = await import('../../services/performance/metricsCollector');
    const collector = getMetricsCollector({ debug: false });
    
    const endTiming = collector.startTiming('test_operation');
    
    // Advance timers
    vi.advanceTimersByTime(50);
    
    const duration = endTiming();
    
    expect(duration).toBeGreaterThanOrEqual(0);
    
    collector.clear();
  });
});
