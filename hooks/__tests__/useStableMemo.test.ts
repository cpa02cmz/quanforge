/**
 * Tests for useStableMemo hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useStableMemo,
  useStableCallback,
  useStableObject,
  useStableArray,
  useCombineProps,
} from '../useStableMemo';

describe('useStableMemo', () => {
  it('should return memoized value with shallow equality', () => {
    const factory = vi.fn(() => ({ a: 1, b: 2 }));
    
    const { result, rerender } = renderHook(() => 
      useStableMemo(factory, { deps: [] })
    );

    expect(result.current).toEqual({ a: 1, b: 2 });
    expect(factory).toHaveBeenCalledTimes(1);

    // Rerender with same deps should not call factory again
    rerender();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('should use deep equality when enabled', () => {
    const factory = vi.fn(() => ({ nested: { value: 1 } }));
    
    const { result, rerender } = renderHook(() => 
      useStableMemo(factory, { deep: true, deps: [] })
    );

    const firstResult = result.current;
    expect(firstResult).toEqual({ nested: { value: 1 } });

    rerender();
    
    // Should return same reference due to deep equality
    expect(result.current).toBe(firstResult);
  });

  it('should use custom equality function', () => {
    const factory = vi.fn((x: number) => ({ sum: x }));
    const equalityFn = vi.fn((a: { sum: number }, b: { sum: number }) => a.sum === b.sum);
    
    const { result, rerender } = renderHook(
      ({ value }) => useStableMemo(() => factory(value), { 
        equalityFn, 
        deps: [value] 
      }),
      { initialProps: { value: 5 } }
    );

    expect(result.current).toEqual({ sum: 5 });
    
    rerender({ value: 5 });
    expect(factory).toHaveBeenCalledTimes(1);
    
    rerender({ value: 10 });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('should invalidate cache when deps change', () => {
    const factory = vi.fn((x: number) => x * 2);
    
    const { result, rerender } = renderHook(
      ({ value }) => useStableMemo(() => factory(value), { deps: [value] }),
      { initialProps: { value: 5 } }
    );

    expect(result.current).toBe(10);
    
    rerender({ value: 10 });
    expect(result.current).toBe(20);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

describe('useStableCallback', () => {
  it('should return stable callback reference', () => {
    const callback = vi.fn((x: number) => x * 2);
    
    const { result, rerender } = renderHook(() => 
      useStableCallback(callback)
    );

    const firstCallback = result.current;
    
    rerender();
    
    // Reference should be stable
    expect(result.current).toBe(firstCallback);
    
    // But it should call the latest callback
    act(() => {
      result.current(5);
    });
    
    expect(callback).toHaveBeenCalledWith(5);
  });

  it('should work with changing callback implementation', () => {
    let multiplier = 2;
    
    const { result, rerender } = renderHook(() => 
      useStableCallback((x: number) => x * multiplier)
    );

    expect(result.current(5)).toBe(10);
    
    multiplier = 3;
    rerender();
    
    expect(result.current(5)).toBe(15);
  });
});

describe('useStableObject', () => {
  it('should return stable object reference when values are equal', () => {
    const { result, rerender } = renderHook(
      ({ obj }) => useStableObject(obj),
      { initialProps: { obj: { a: 1, b: 2 } } }
    );

    const firstResult = result.current;
    expect(firstResult).toEqual({ a: 1, b: 2 });
    
    // Rerender with same values
    rerender({ obj: { a: 1, b: 2 } });
    
    // Should return same reference
    expect(result.current).toBe(firstResult);
  });

  it('should return new object when values change', () => {
    const { result, rerender } = renderHook(
      ({ obj }) => useStableObject(obj),
      { initialProps: { obj: { a: 1, b: 2 } } }
    );

    const firstResult = result.current;
    
    rerender({ obj: { a: 1, b: 3 } });
    
    // Should return new reference
    expect(result.current).not.toBe(firstResult);
    expect(result.current).toEqual({ a: 1, b: 3 });
  });
});

describe('useStableArray', () => {
  it('should return stable array reference when values are equal', () => {
    const { result, rerender } = renderHook(
      ({ arr }) => useStableArray(arr),
      { initialProps: { arr: [1, 2, 3] } }
    );

    const firstResult = result.current;
    expect(firstResult).toEqual([1, 2, 3]);
    
    // Rerender with same values
    rerender({ arr: [1, 2, 3] });
    
    // Should return same reference
    expect(result.current).toBe(firstResult);
  });

  it('should return new array when values change', () => {
    const { result, rerender } = renderHook(
      ({ arr }) => useStableArray(arr),
      { initialProps: { arr: [1, 2, 3] } }
    );

    const firstResult = result.current;
    
    rerender({ arr: [1, 2, 4] });
    
    // Should return new reference
    expect(result.current).not.toBe(firstResult);
    expect(result.current).toEqual([1, 2, 4]);
  });
});

describe('useCombineProps', () => {
  it('should return stable props object', () => {
    const onClick = vi.fn();
    
    const { result, rerender } = renderHook(
      ({ props }) => useCombineProps(props),
      { initialProps: { props: { onClick, disabled: false } } }
    );

    const firstResult = result.current;
    
    // Rerender with same props
    rerender({ props: { onClick, disabled: false } });
    
    // Should return same reference
    expect(result.current).toBe(firstResult);
  });

  it('should return new object when props change', () => {
    const onClick = vi.fn();
    
    const { result, rerender } = renderHook(
      ({ props }) => useCombineProps(props),
      { initialProps: { props: { onClick, disabled: false } } }
    );

    const firstResult = result.current;
    
    rerender({ props: { onClick, disabled: true } });
    
    // Should return new reference
    expect(result.current).not.toBe(firstResult);
    expect(result.current.disabled).toBe(true);
  });
});
