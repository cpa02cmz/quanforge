/**
 * useDeferredValue Hook
 * 
 * A performance optimization hook that defers updates for expensive computations
 * until the browser is idle. Similar to React 18's useDeferredValue but with
 * additional features for better control.
 * 
 * Features:
 * - Defer updates until browser idle
 * - Configurable timeout for fallback
 * - Priority-based rendering
 * - Memory-efficient value caching
 * - Automatic cleanup on unmount
 * 
 * @module hooks/useDeferredValue
 */

import { useState, useEffect, useRef, useCallback, useTransition } from 'react';

// ========== TYPES ==========

export interface DeferredValueOptions<T> {
  /** Timeout in ms before forcing update (default: 5000) */
  timeout?: number;
  /** Initial value before first deferral (default: first value passed) */
  initialValue?: T;
  /** Whether to use React 18's useTransition (default: true if available) */
  useTransition?: boolean;
  /** Minimum time between updates in ms (default: 100) */
  minUpdateInterval?: number;
  /** Whether to defer updates (default: true, set to false for immediate updates) */
  deferUpdates?: boolean;
}

export interface DeferredValueResult<T> {
  /** The deferred value */
  value: T;
  /** Whether the value is currently being updated */
  isPending: boolean;
  /** Force an immediate update */
  forceUpdate: () => void;
  /** Cancel any pending updates */
  cancelUpdate: () => void;
}

// ========== CONSTANTS ==========

const DEFAULT_OPTIONS: Required<Omit<DeferredValueOptions<unknown>, 'initialValue'>> = {
  timeout: 5000,
  useTransition: true,
  minUpdateInterval: 100,
  deferUpdates: true,
};

// ========== HELPER FUNCTIONS ==========

/**
 * Request idle callback with fallback for browsers that don't support it
 */
function requestIdleCallbackWithFallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
): number {
  if (typeof requestIdleCallback !== 'undefined') {
    return requestIdleCallback(callback, options);
  }
  
  // Fallback: Use setTimeout with a small delay
  const start = Date.now();
  return window.setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    });
  }, 1) as unknown as number;
}

/**
 * Cancel idle callback with fallback
 */
function cancelIdleCallbackWithFallback(id: number): void {
  if (typeof cancelIdleCallback !== 'undefined') {
    cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

// ========== MAIN HOOK ==========

/**
 * Hook that defers value updates until the browser is idle.
 * Useful for expensive computations that can wait.
 * 
 * @example
 * ```tsx
 * // Basic usage
 * const deferredQuery = useDeferredValue(searchQuery);
 * 
 * // With options
 * const { value: deferredItems, isPending } = useDeferredValue(
 *   expensiveFilter(items, query),
 *   { timeout: 3000, minUpdateInterval: 200 }
 * );
 * 
 * // Force immediate update
 * const { value, forceUpdate } = useDeferredValue(data);
 * // Later: forceUpdate() to get the latest value immediately
 * ```
 */
export function useDeferredValue<T>(
  value: T,
  options: DeferredValueOptions<T> = {}
): DeferredValueResult<T> {
  const fullOptions = { ...DEFAULT_OPTIONS, ...options } as Required<DeferredValueOptions<T>> & { initialValue?: T };
  const {
    timeout,
    useTransition: useTransitionOption,
    minUpdateInterval,
    deferUpdates,
    initialValue,
  } = fullOptions;

  // State for the deferred value
  const [deferredValue, setDeferredValue] = useState<T>(
    initialValue !== undefined ? initialValue : value
  );
  
  // Track pending state
  const [isPending, setIsPending] = useState(false);
  
  // Refs for cleanup and timing
  const idleCallbackRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const pendingValueRef = useRef<T>(value);
  
  // Use React 18's useTransition if available and enabled
  const transitionResult = useTransitionOption ? useTransition() : [null, false];
  const startTransition = transitionResult[0] as ((callback: () => void) => void) | null;
  const isTransitionPending = transitionResult[1] as boolean;
  
  const canUseTransition = useTransitionOption && typeof startTransition === 'function';

  // Cancel any pending updates
  const cancelUpdate = useCallback(() => {
    if (idleCallbackRef.current !== null) {
      cancelIdleCallbackWithFallback(idleCallbackRef.current);
      idleCallbackRef.current = null;
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPending(false);
  }, []);

  // Force immediate update
  const forceUpdate = useCallback(() => {
    cancelUpdate();
    lastUpdateRef.current = Date.now();
    
    if (canUseTransition && startTransition) {
      startTransition(() => {
        setDeferredValue(pendingValueRef.current);
      });
    } else {
      setDeferredValue(pendingValueRef.current);
      setIsPending(false);
    }
  }, [cancelUpdate, canUseTransition, startTransition]);

  // Schedule deferred update
  useEffect(() => {
    pendingValueRef.current = value;
    
    // If deferring is disabled, update immediately
    if (!deferUpdates) {
      setDeferredValue(value);
      return;
    }
    
    // Check minimum update interval
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    
    if (timeSinceLastUpdate < minUpdateInterval) {
      // Too soon, schedule for later
      const delay = minUpdateInterval - timeSinceLastUpdate;
      timeoutRef.current = setTimeout(() => {
        forceUpdate();
      }, delay);
      return;
    }
    
    // Cancel any existing pending updates
    cancelUpdate();
    
    // Set pending state
    setIsPending(true);
    
    // Schedule idle callback
    idleCallbackRef.current = requestIdleCallbackWithFallback(
      (deadline) => {
        // Check if we have time or if we've timed out
        if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
          lastUpdateRef.current = Date.now();
          
          if (canUseTransition && startTransition) {
            startTransition(() => {
              setDeferredValue(value);
            });
          } else {
            setDeferredValue(value);
            setIsPending(false);
          }
        } else {
          // No time remaining, reschedule
          idleCallbackRef.current = requestIdleCallbackWithFallback(
            () => forceUpdate(),
            { timeout }
          );
        }
      },
      { timeout }
    );
    
    // Set a hard timeout as fallback
    timeoutRef.current = setTimeout(() => {
      forceUpdate();
    }, timeout);
    
    return () => {
      cancelUpdate();
    };
  }, [value, timeout, minUpdateInterval, deferUpdates, cancelUpdate, forceUpdate, canUseTransition, startTransition]);

  // Update isPending based on transition state
  useEffect(() => {
    if (canUseTransition) {
      setIsPending(isTransitionPending);
    }
  }, [isTransitionPending, canUseTransition]);

  return {
    value: deferredValue,
    isPending,
    forceUpdate,
    cancelUpdate,
  };
}

// ========== SPECIALIZED HOOKS ==========

/**
 * Hook for deferring search/filter operations
 * Optimized for search input scenarios with configurable debounce
 * 
 * @example
 * ```tsx
 * const deferredQuery = useDeferredSearch(searchQuery, 300);
 * const results = useMemo(() => filterItems(items, deferredQuery), [items, deferredQuery]);
 * ```
 */
export function useDeferredSearch<T extends string>(
  query: T,
  debounceMs: number = 150
): DeferredValueResult<T> {
  return useDeferredValue(query, {
    timeout: debounceMs * 3,
    minUpdateInterval: debounceMs,
    useTransition: true,
  });
}

/**
 * Hook for deferring list rendering
 * Useful for large lists that need virtualization
 * 
 * @example
 * ```tsx
 * const { value: visibleItems, isPending } = useDeferredList(
 *   sortedItems.slice(startIndex, endIndex)
 * );
 * ```
 */
export function useDeferredList<T>(
  items: T[],
  options: Omit<DeferredValueOptions<T[]>, 'initialValue'> = {}
): DeferredValueResult<T[]> {
  return useDeferredValue(items, {
    timeout: 1000,
    minUpdateInterval: 50,
    ...options,
  });
}

export default useDeferredValue;
