/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDeferredValue, useDeferredSearch, useDeferredList } from '../useDeferredValue';

// Mock requestIdleCallback for tests
const mockRequestIdleCallback = vi.fn();
const mockCancelIdleCallback = vi.fn();

describe('useDeferredValue', () => {
  beforeEach(() => {
    // Set up requestIdleCallback mock
    (window as unknown as { requestIdleCallback: typeof mockRequestIdleCallback }).requestIdleCallback = mockRequestIdleCallback;
    (window as unknown as { cancelIdleCallback: typeof mockCancelIdleCallback }).cancelIdleCallback = mockCancelIdleCallback;
    
    // Default implementation
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

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDeferredValue('initial'));
    
    expect(result.current.value).toBe('initial');
    // isPending may be true if an idle callback is scheduled
    expect(typeof result.current.isPending).toBe('boolean');
  });

  it('should provide forceUpdate function', () => {
    const { result } = renderHook(() => useDeferredValue('test'));
    
    expect(typeof result.current.forceUpdate).toBe('function');
    expect(typeof result.current.cancelUpdate).toBe('function');
  });

  it('should defer updates by default', () => {
    const { rerender } = renderHook(
      ({ value }) => useDeferredValue(value),
      { initialProps: { value: 'initial' } }
    );
    
    // Update should be deferred
    rerender({ value: 'updated' });
    
    // The hook should have scheduled an idle callback
    expect(mockRequestIdleCallback).toHaveBeenCalled();
  });

  it('should update immediately when deferUpdates is false', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDeferredValue(value, { deferUpdates: false }),
      { initialProps: { value: 'initial' } }
    );
    
    rerender({ value: 'updated' });
    
    expect(result.current.value).toBe('updated');
  });

  it('should provide cancelUpdate function', () => {
    const { result } = renderHook(() => useDeferredValue('test'));
    
    expect(typeof result.current.cancelUpdate).toBe('function');
    
    // Cancel should not throw
    act(() => {
      result.current.cancelUpdate();
    });
  });
});

describe('useDeferredSearch', () => {
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

  it('should return initial search query', () => {
    const { result } = renderHook(() => useDeferredSearch('initial query'));
    
    expect(result.current.value).toBe('initial query');
  });

  it('should defer search updates', () => {
    const { rerender } = renderHook(
      ({ query }) => useDeferredSearch(query, 150),
      { initialProps: { query: 'initial' } }
    );
    
    rerender({ query: 'updated search' });
    
    // Should have scheduled idle callback
    expect(mockRequestIdleCallback).toHaveBeenCalled();
  });
});

describe('useDeferredList', () => {
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

  it('should return initial list', () => {
    const initialList = [1, 2, 3];
    const { result } = renderHook(() => useDeferredList(initialList));
    
    expect(result.current.value).toEqual(initialList);
  });

  it('should defer list updates', () => {
    const initialList = [1, 2, 3];
    const updatedList = [4, 5, 6];
    
    const { rerender } = renderHook(
      ({ list }) => useDeferredList(list),
      { initialProps: { list: initialList } }
    );
    
    rerender({ list: updatedList });
    
    // Should have scheduled idle callback
    expect(mockRequestIdleCallback).toHaveBeenCalled();
  });
});
