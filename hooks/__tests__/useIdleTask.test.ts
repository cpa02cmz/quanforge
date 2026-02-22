/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useIdleTask, useIdleAnalytics, useIdlePrefetch } from '../useIdleTask';

// Mock requestIdleCallback for tests
const mockRequestIdleCallback = vi.fn();
const mockCancelIdleCallback = vi.fn();

describe('useIdleTask', () => {
  beforeEach(() => {
    // Set up requestIdleCallback mock
    (window as unknown as { requestIdleCallback: typeof mockRequestIdleCallback }).requestIdleCallback = mockRequestIdleCallback;
    (window as unknown as { cancelIdleCallback: typeof mockCancelIdleCallback }).cancelIdleCallback = mockCancelIdleCallback;
    
    // Default implementation - execute callback immediately
    mockRequestIdleCallback.mockImplementation((callback: IdleRequestCallback) => {
      const start = Date.now();
      return window.setTimeout(() => {
        callback({
          didTimeout: false,
          timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
        });
      }, 0) as unknown as number;
    });
    
    mockCancelIdleCallback.mockImplementation((id: number) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useIdleTask());
    
    expect(result.current.pendingTaskCount).toBe(0);
    expect(result.current.isExecuting).toBe(false);
  });

  it('should provide scheduleTask function', () => {
    const { result } = renderHook(() => useIdleTask());
    
    expect(typeof result.current.scheduleTask).toBe('function');
    expect(typeof result.current.scheduleHighPriority).toBe('function');
    expect(typeof result.current.scheduleLowPriority).toBe('function');
    expect(typeof result.current.scheduleBackground).toBe('function');
  });

  it('should provide cancelTask function', () => {
    const { result } = renderHook(() => useIdleTask());
    
    expect(typeof result.current.cancelTask).toBe('function');
    expect(typeof result.current.cancelAllTasks).toBe('function');
  });

  it('should schedule a task and return a task ID', () => {
    const { result } = renderHook(() => useIdleTask());
    
    const taskId = result.current.scheduleTask({
      execute: () => {},
      priority: 'normal',
    });
    
    expect(typeof taskId).toBe('string');
    expect(taskId).toMatch(/^task_/);
  });

  it('should increment pending task count when task is scheduled', () => {
    const { result } = renderHook(() => useIdleTask());
    
    act(() => {
      result.current.scheduleTask({
        execute: () => {},
        priority: 'normal',
      });
    });
    
    expect(result.current.pendingTaskCount).toBe(1);
  });

  it('should cancel all tasks', () => {
    const { result } = renderHook(() => useIdleTask());
    
    act(() => {
      result.current.scheduleTask({
        execute: () => {},
        priority: 'normal',
      });
      result.current.scheduleTask({
        execute: () => {},
        priority: 'low',
      });
    });
    
    expect(result.current.pendingTaskCount).toBe(2);
    
    act(() => {
      result.current.cancelAllTasks();
    });
    
    expect(result.current.pendingTaskCount).toBe(0);
  });

  it('should schedule high priority task', () => {
    const { result } = renderHook(() => useIdleTask());
    
    const taskId = result.current.scheduleHighPriority(() => {});
    
    expect(typeof taskId).toBe('string');
  });

  it('should schedule low priority task', () => {
    const { result } = renderHook(() => useIdleTask());
    
    const taskId = result.current.scheduleLowPriority(() => {});
    
    expect(typeof taskId).toBe('string');
  });

  it('should schedule background task', () => {
    const { result } = renderHook(() => useIdleTask());
    
    const taskId = result.current.scheduleBackground(() => {});
    
    expect(typeof taskId).toBe('string');
  });
});

describe('useIdleAnalytics', () => {
  beforeEach(() => {
    (window as unknown as { requestIdleCallback: typeof mockRequestIdleCallback }).requestIdleCallback = mockRequestIdleCallback;
    (window as unknown as { cancelIdleCallback: typeof mockCancelIdleCallback }).cancelIdleCallback = mockCancelIdleCallback;
    
    mockRequestIdleCallback.mockImplementation((callback: IdleRequestCallback) => {
      const start = Date.now();
      return window.setTimeout(() => {
        callback({
          didTimeout: false,
          timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
        });
      }, 0) as unknown as number;
    });
    
    mockCancelIdleCallback.mockImplementation((id: number) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide trackEvent function', () => {
    const { result } = renderHook(() => useIdleAnalytics());
    
    expect(typeof result.current.trackEvent).toBe('function');
  });

  it('should provide trackPageView function', () => {
    const { result } = renderHook(() => useIdleAnalytics());
    
    expect(typeof result.current.trackPageView).toBe('function');
  });

  it('should provide flush function', () => {
    const { result } = renderHook(() => useIdleAnalytics());
    
    expect(typeof result.current.flush).toBe('function');
  });

  it('should not throw when tracking events', () => {
    const { result } = renderHook(() => useIdleAnalytics());
    
    expect(() => {
      result.current.trackEvent('test_event', { foo: 'bar' });
    }).not.toThrow();
  });
});

describe('useIdlePrefetch', () => {
  beforeEach(() => {
    (window as unknown as { requestIdleCallback: typeof mockRequestIdleCallback }).requestIdleCallback = mockRequestIdleCallback;
    (window as unknown as { cancelIdleCallback: typeof mockCancelIdleCallback }).cancelIdleCallback = mockCancelIdleCallback;
    
    mockRequestIdleCallback.mockImplementation((callback: IdleRequestCallback) => {
      const start = Date.now();
      return window.setTimeout(() => {
        callback({
          didTimeout: false,
          timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
        });
      }, 0) as unknown as number;
    });
    
    mockCancelIdleCallback.mockImplementation((id: number) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide prefetch function', () => {
    const { result } = renderHook(() => useIdlePrefetch());
    
    expect(typeof result.current.prefetch).toBe('function');
  });

  it('should provide prefetchRoutes function', () => {
    const { result } = renderHook(() => useIdlePrefetch());
    
    expect(typeof result.current.prefetchRoutes).toBe('function');
  });

  it('should not throw when prefetching', () => {
    const { result } = renderHook(() => useIdlePrefetch());
    
    expect(() => {
      result.current.prefetch('test-key', async () => ({ data: 'test' }));
    }).not.toThrow();
  });

  it('should not throw when prefetching routes', () => {
    const { result } = renderHook(() => useIdlePrefetch());
    
    expect(() => {
      result.current.prefetchRoutes(['/dashboard', '/settings']);
    }).not.toThrow();
  });
});
