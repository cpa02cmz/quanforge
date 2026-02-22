/**
 * Tests for usePrevious hook
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { 
  usePrevious, 
  useValueHistory, 
  useChangeDetector, 
  useTransition 
} from '../usePrevious';

describe('usePrevious', () => {
  it('should return undefined on first render', () => {
    const { result } = renderHook(() => usePrevious('initial'));
    
    expect(result.current).toBeUndefined();
  });

  it('should return previous value after update', () => {
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: 'first' },
    });
    
    // First render - previous is undefined
    expect(result.current).toBeUndefined();
    
    // Rerender with new value
    rerender({ value: 'second' });
    
    // Now previous should be 'first'
    expect(result.current).toBe('first');
    
    // Rerender again
    rerender({ value: 'third' });
    
    // Now previous should be 'second'
    expect(result.current).toBe('second');
  });

  it('should work with numbers', () => {
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: 0 },
    });
    
    expect(result.current).toBeUndefined();
    
    rerender({ value: 1 });
    expect(result.current).toBe(0);
    
    rerender({ value: 5 });
    expect(result.current).toBe(1);
  });

  it('should work with objects', () => {
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: { name: 'first' } },
    });
    
    expect(result.current).toBeUndefined();
    
    rerender({ value: { name: 'second' } });
    expect(result.current).toEqual({ name: 'first' });
  });
});

describe('useValueHistory', () => {
  it('should return an array', () => {
    const { result } = renderHook(() => useValueHistory('a', 5));
    
    expect(Array.isArray(result.current)).toBe(true);
  });

  it('should return an array with length <= maxHistory', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useValueHistory(value, 3), 
      { initialProps: { value: 'a' } }
    );
    
    // Multiple rerenders
    rerender({ value: 'b' });
    rerender({ value: 'c' });
    rerender({ value: 'd' });
    rerender({ value: 'e' });
    
    // Should not exceed maxHistory
    expect(result.current.length).toBeLessThanOrEqual(3);
  });

  it('should accept maxHistory parameter', () => {
    const { result } = renderHook(() => useValueHistory('test', 10));
    
    // Hook should work without errors
    expect(result.current).toBeDefined();
  });
});

describe('useChangeDetector', () => {
  it('should detect first render', () => {
    const { result } = renderHook(() => useChangeDetector('initial'));
    
    expect(result.current.isFirstRender).toBe(true);
    expect(result.current.hasChanged).toBe(false);
  });

  it('should detect changes after first render', () => {
    const { result, rerender } = renderHook(({ value }) => useChangeDetector(value), {
      initialProps: { value: 'first' },
    });
    
    expect(result.current.hasChanged).toBe(false);
    
    rerender({ value: 'second' });
    
    expect(result.current.hasChanged).toBe(true);
    expect(result.current.isFirstRender).toBe(false);
    expect(result.current.current).toBe('second');
    expect(result.current.previous).toBe('first');
  });

  it('should correctly identify when value has not changed', () => {
    const { result, rerender } = renderHook(({ value }) => useChangeDetector(value), {
      initialProps: { value: 'same' },
    });
    
    rerender({ value: 'same' }); // Same value
    
    expect(result.current.hasChanged).toBe(false);
  });
});

describe('useTransition', () => {
  it('should return true when value transitions from one value to another', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useTransition(value, 'idle', 'loading'),
      { initialProps: { value: 'idle' } }
    );
    
    expect(result.current).toBe(false);
    
    rerender({ value: 'loading' });
    
    expect(result.current).toBe(true);
  });

  it('should return false when transition is not exact', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useTransition(value, 'idle', 'done'),
      { initialProps: { value: 'idle' } }
    );
    
    rerender({ value: 'loading' }); // Different transition
    
    expect(result.current).toBe(false);
  });
});
