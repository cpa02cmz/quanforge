/**
 * useStableMemo Hook
 * 
 * A performance-optimized memoization hook that provides stable references
 * with deep equality comparison. Useful for expensive computations and
 * preventing unnecessary re-renders.
 * 
 * Features:
 * - Deep equality comparison for complex objects
 * - Stable reference across re-renders
 * - Optional custom equality function
 * - Memory-efficient caching
 * 
 * @module hooks/useStableMemo
 */

import { useMemo, useRef, useCallback } from 'react';

/**
 * Deep equality check for objects and arrays
 */
function deepEqual(a: unknown, b: unknown): boolean {
  // Same reference or primitive equality
  if (a === b) return true;
  
  // Handle null/undefined
  if (a == null || b == null) return a === b;
  
  // Handle different types
  if (typeof a !== typeof b) return false;
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  
  // Handle Date objects
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => 
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
  }
  
  return false;
}

/**
 * Shallow equality check for objects
 */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => 
    (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key]
  );
}

/**
 * Options for useStableMemo
 */
export interface StableMemoOptions<T> {
  /** Custom equality function (default: shallow) */
  equalityFn?: (a: T, b: T) => boolean;
  /** Use deep equality comparison (default: false) */
  deep?: boolean;
  /** Key for cache invalidation (like useMemo dependencies) */
  deps?: unknown[];
}

/**
 * Hook that memoizes a value with stable reference across re-renders.
 * Unlike useMemo, it uses deep/shallow equality to determine if the
 * computed value has actually changed.
 * 
 * @example
 * ```tsx
 * // Expensive computation with deep equality
 * const result = useStableMemo(
 *   () => computeExpensiveValue(complexData),
 *   { deep: true }
 * );
 * 
 * // With custom equality function
 * const result = useStableMemo(
 *   () => ({ items: filteredItems, total: sum }),
 *   { equalityFn: (a, b) => a.total === b.total }
 * );
 * ```
 */
export function useStableMemo<T>(
  factory: () => T,
  options: StableMemoOptions<T> = {}
): T {
  const { equalityFn, deep = false, deps = [] } = options;
  
  const cacheRef = useRef<{ value: T; deps: unknown[] } | null>(null);
  
  const compare = equalityFn || (deep ? deepEqual : shallowEqual);
  
  return useMemo(() => {
    const newValue = factory();
    
    // Check if dependencies changed
    const depsChanged = deps.length > 0 && 
      (!cacheRef.current || 
       deps.length !== cacheRef.current.deps.length ||
       deps.some((dep, i) => !Object.is(dep, cacheRef.current!.deps[i])));
    
    // If deps changed, always use new value
    if (depsChanged) {
      cacheRef.current = { value: newValue, deps };
      return newValue;
    }
    
    // If we have a cached value and it's equal to the new value, return cached
    if (cacheRef.current && compare(cacheRef.current.value, newValue)) {
      return cacheRef.current.value;
    }
    
    // Otherwise, update cache and return new value
    cacheRef.current = { value: newValue, deps };
    return newValue;
  }, deps);
}

/**
 * Hook that creates a stable callback reference.
 * The callback identity remains stable across re-renders,
 * preventing unnecessary child re-renders.
 * 
 * @example
 * ```tsx
 * const handleClick = useStableCallback((id: string) => {
 *   // This callback identity is stable
 *   console.log('Clicked:', id);
 * });
 * 
 * <Button onClick={handleClick} /> // Won't re-render if parent re-renders
 * ```
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  
  // Update ref on every render
  callbackRef.current = callback;
  
  // Return stable function that uses the ref
  return useCallback(
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    []
  );
}

/**
 * Hook that creates a stable object reference.
 * Useful for preventing re-renders when passing objects as props.
 * 
 * @example
 * ```tsx
 * const stableStyle = useStableObject({ padding: 16, margin: 8 });
 * // stableStyle identity is stable if values don't change
 * ```
 */
export function useStableObject<T extends object>(obj: T): T {
  const cacheRef = useRef<T>(obj);
  
  return useMemo(() => {
    if (shallowEqual(cacheRef.current, obj)) {
      return cacheRef.current;
    }
    cacheRef.current = obj;
    return obj;
  }, [obj]);
}

/**
 * Hook that creates a stable array reference.
 * Useful for preventing re-renders when passing arrays as props.
 * 
 * @example
 * ```tsx
 * const stableItems = useStableArray(['a', 'b', 'c']);
 * // stableItems identity is stable if values don't change
 * ```
 */
export function useStableArray<T>(arr: T[]): T[] {
  const cacheRef = useRef<T[]>(arr);
  
  return useMemo(() => {
    if (arr.length === cacheRef.current.length &&
        arr.every((item, i) => Object.is(item, cacheRef.current[i]))) {
      return cacheRef.current;
    }
    cacheRef.current = arr;
    return arr;
  }, [arr]);
}

/**
 * Hook that combines multiple values into a stable object.
 * Useful for creating stable prop objects from multiple sources.
 * 
 * @example
 * ```tsx
 * const props = useCombineProps({
 *   onClick: handleClick,
 *   disabled: isLoading,
 *   className: 'btn-primary',
 * });
 * ```
 */
export function useCombineProps<T extends object>(props: T): T {
  return useStableObject(props);
}

export default useStableMemo;
