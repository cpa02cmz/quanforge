/**
 * Tests for useToggle hook
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToggle, useToggleState, useToggles } from '../useToggle';

describe('useToggle', () => {
  it('should initialize with default false value', () => {
    const { result } = renderHook(() => useToggle());
    
    const [value] = result.current;
    expect(value).toBe(false);
  });

  it('should initialize with provided value', () => {
    const { result } = renderHook(() => useToggle(true));
    
    const [value] = result.current;
    expect(value).toBe(true);
  });

  it('should toggle value', () => {
    const { result } = renderHook(() => useToggle(false));
    
    act(() => {
      const toggle = result.current[1];
      toggle();
    });
    
    expect(result.current[0]).toBe(true);
    
    act(() => {
      const toggle = result.current[1];
      toggle();
    });
    
    expect(result.current[0]).toBe(false);
  });

  it('should set value to specific boolean', () => {
    const { result } = renderHook(() => useToggle(false));
    
    act(() => {
      const set = result.current[2];
      set(true);
    });
    
    expect(result.current[0]).toBe(true);
    
    act(() => {
      const set = result.current[2];
      set(false);
    });
    
    expect(result.current[0]).toBe(false);
  });
});

describe('useToggleState', () => {
  it('should return all toggle state properties', () => {
    const { result } = renderHook(() => useToggleState());
    
    expect(result.current.value).toBe(false);
    expect(result.current.isTrue).toBe(false);
    expect(result.current.isFalse).toBe(true);
    expect(typeof result.current.toggle).toBe('function');
    expect(typeof result.current.setTrue).toBe('function');
    expect(typeof result.current.setFalse).toBe('function');
    expect(typeof result.current.set).toBe('function');
  });

  it('should toggle value correctly', () => {
    const { result } = renderHook(() => useToggleState());
    
    expect(result.current.value).toBe(false);
    
    act(() => {
      result.current.toggle();
    });
    
    expect(result.current.value).toBe(true);
    expect(result.current.isTrue).toBe(true);
    expect(result.current.isFalse).toBe(false);
  });

  it('should setTrue and setFalse correctly', () => {
    const { result } = renderHook(() => useToggleState());
    
    act(() => {
      result.current.setTrue();
    });
    
    expect(result.current.value).toBe(true);
    
    act(() => {
      result.current.setFalse();
    });
    
    expect(result.current.value).toBe(false);
  });

  it('should set value correctly', () => {
    const { result } = renderHook(() => useToggleState());
    
    act(() => {
      result.current.set(true);
    });
    
    expect(result.current.value).toBe(true);
    
    act(() => {
      result.current.set(false);
    });
    
    expect(result.current.value).toBe(false);
  });
});

describe('useToggles', () => {
  it('should initialize multiple toggles with default false', () => {
    const { result } = renderHook(() => useToggles(['a', 'b', 'c'] as const));
    
    expect(result.current.states.a.value).toBe(false);
    expect(result.current.states.b.value).toBe(false);
    expect(result.current.states.c.value).toBe(false);
  });

  it('should initialize with provided values', () => {
    const { result } = renderHook(() => 
      useToggles(['a', 'b', 'c'] as const, { a: true })
    );
    
    expect(result.current.states.a.value).toBe(true);
    expect(result.current.states.b.value).toBe(false);
    expect(result.current.states.c.value).toBe(false);
  });

  it('should toggle individual values', () => {
    const { result } = renderHook(() => useToggles(['a', 'b'] as const));
    
    act(() => {
      result.current.toggle('a');
    });
    
    expect(result.current.states.a.value).toBe(true);
    expect(result.current.states.b.value).toBe(false);
  });

  it('should setAll to specific value', () => {
    const { result } = renderHook(() => useToggles(['a', 'b', 'c'] as const));
    
    act(() => {
      result.current.setAll(true);
    });
    
    expect(result.current.states.a.value).toBe(true);
    expect(result.current.states.b.value).toBe(true);
    expect(result.current.states.c.value).toBe(true);
    expect(result.current.allTrue).toBe(true);
  });

  it('should resetAll to initial values', () => {
    const { result } = renderHook(() => 
      useToggles(['a', 'b'] as const, { a: true })
    );
    
    // Change values
    act(() => {
      result.current.setAll(true);
    });
    
    // Reset
    act(() => {
      result.current.resetAll();
    });
    
    expect(result.current.states.a.value).toBe(true); // Back to initial
    expect(result.current.states.b.value).toBe(false); // Back to initial
  });

  it('should correctly report anyTrue, allTrue, allFalse', () => {
    const { result } = renderHook(() => useToggles(['a', 'b'] as const));
    
    // All false initially
    expect(result.current.anyTrue).toBe(false);
    expect(result.current.allTrue).toBe(false);
    expect(result.current.allFalse).toBe(true);
    
    // Toggle one
    act(() => {
      result.current.toggle('a');
    });
    
    expect(result.current.anyTrue).toBe(true);
    expect(result.current.allTrue).toBe(false);
    expect(result.current.allFalse).toBe(false);
    
    // Toggle all
    act(() => {
      result.current.toggle('b');
    });
    
    expect(result.current.anyTrue).toBe(true);
    expect(result.current.allTrue).toBe(true);
    expect(result.current.allFalse).toBe(false);
  });
});
