/**
 * useDebouncedValue Hook
 * 
 * Returns a debounced version of a value that only updates after a specified delay
 * since the last change. Useful for search inputs, API calls, and other scenarios
 * where you want to limit the frequency of updates.
 * 
 * Features:
 * - Configurable debounce delay
 * - Optional immediate execution on first call
 * - Cleanup on unmount
 * - TypeScript generic support
 * - Works with any value type
 * 
 * @module hooks/useDebouncedValue
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ========== TYPES ==========

export interface DebounceOptions {
  /** Delay in milliseconds (default: 300) */
  delay?: number;
  /** Whether to update immediately on first call (default: false) */
  leading?: boolean;
  /** Maximum time to wait before forcing an update (default: Infinity) */
  maxWait?: number;
}

export interface DebouncedValueState<T> {
  /** The debounced value */
  value: T;
  /** Whether a debounce is currently pending */
  isPending: boolean;
  /** Force an immediate update of the debounced value */
  flush: () => void;
  /** Cancel any pending update */
  cancel: () => void;
}

// ========== MAIN HOOK ==========

/**
 * Hook to debounce a value with configurable delay and options
 * 
 * @example
 * ```tsx
 * function SearchComponent() {
 *   const [searchTerm, setSearchTerm] = useState('');
 *   const { value: debouncedSearch, isPending } = useDebouncedValue(searchTerm, {
 *     delay: 300,
 *   });
 *   
 *   // API call only triggers with debounced value
 *   useEffect(() => {
 *     if (debouncedSearch) {
 *       searchAPI(debouncedSearch);
 *     }
 *   }, [debouncedSearch]);
 *   
 *   return (
 *     <div>
 *       <input 
 *         value={searchTerm}
 *         onChange={(e) => setSearchTerm(e.target.value)}
 *       />
 *       {isPending && <span>Searching...</span>}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // With leading edge execution
 * const { value: debouncedValue } = useDebouncedValue(inputValue, {
 *   delay: 500,
 *   leading: true, // Update immediately on first change, then debounce
 * });
 * ```
 */
export function useDebouncedValue<T>(
  value: T,
  options: DebounceOptions = {}
): DebouncedValueState<T> {
  const { delay = 300, leading = false, maxWait = Infinity } = options;

  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isPending, setIsPending] = useState(false);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallTimeRef = useRef<number>(0);
  const leadingExecutedRef = useRef<boolean>(false);
  const previousValueRef = useRef<T>(value);

  // Cancel any pending updates
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxWaitTimeoutRef.current) {
      clearTimeout(maxWaitTimeoutRef.current);
      maxWaitTimeoutRef.current = null;
    }
    setIsPending(false);
    leadingExecutedRef.current = false;
  }, []);

  // Force immediate update
  const flush = useCallback(() => {
    cancel();
    setDebouncedValue(value);
    setIsPending(false);
    leadingExecutedRef.current = false;
  }, [cancel, value]);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTimeRef.current;
    lastCallTimeRef.current = now;

    // Check if this is the first call or value hasn't changed
    const isSameValue = value === previousValueRef.current;
    previousValueRef.current = value;

    // Skip if same value
    if (isSameValue) {
      return;
    }

    // Leading edge: execute immediately on first change
    if (leading && !leadingExecutedRef.current) {
      setDebouncedValue(value);
      leadingExecutedRef.current = true;
      setIsPending(true);
    } else {
      setIsPending(true);
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
      setIsPending(false);
      leadingExecutedRef.current = false;
      timeoutRef.current = null;
    }, delay);

    // Set max wait timeout if configured
    if (maxWait < Infinity && !maxWaitTimeoutRef.current) {
      maxWaitTimeoutRef.current = setTimeout(() => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setDebouncedValue(value);
        setIsPending(false);
        leadingExecutedRef.current = false;
        maxWaitTimeoutRef.current = null;
      }, maxWait - timeSinceLastCall);
    }

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (maxWaitTimeoutRef.current) {
        clearTimeout(maxWaitTimeoutRef.current);
      }
    };
  }, [value, delay, leading, maxWait]);

  return {
    value: debouncedValue,
    isPending,
    flush,
    cancel,
  };
}

// ========== UTILITY HOOKS ==========

/**
 * Hook to debounce a callback function
 * 
 * @example
 * ```tsx
 * const debouncedSave = useDebouncedCallback((data) => {
 *   saveToDatabase(data);
 * }, 500);
 * 
 * // Called immediately but executes after 500ms
 * debouncedSave(formData);
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
      timeoutRef.current = null;
    }, delay);
  }, [delay]);
}

/**
 * Hook to throttle a value (update at most once per interval)
 * 
 * @example
 * ```tsx
 * // Updates at most every 100ms
 * const { value: throttledScroll } = useThrottledValue(scrollPosition, 100);
 * ```
 */
export function useThrottledValue<T>(
  value: T,
  interval: number = 100
): DebouncedValueState<T> {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const [isPending, setIsPending] = useState(false);
  
  const lastUpdateTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<T | null>(null);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingValueRef.current !== null) {
      setThrottledValue(pendingValueRef.current);
      pendingValueRef.current = null;
    }
    setIsPending(false);
  }, []);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingValueRef.current = null;
    setIsPending(false);
  }, []);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

    if (timeSinceLastUpdate >= interval) {
      // Enough time has passed, update immediately
      lastUpdateTimeRef.current = now;
      setThrottledValue(value);
      setIsPending(false);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      pendingValueRef.current = null;
    } else {
      // Schedule update for later
      pendingValueRef.current = value;
      setIsPending(true);

      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          if (pendingValueRef.current !== null) {
            lastUpdateTimeRef.current = Date.now();
            setThrottledValue(pendingValueRef.current);
            pendingValueRef.current = null;
          }
          setIsPending(false);
          timeoutRef.current = null;
        }, interval - timeSinceLastUpdate);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, interval]);

  return {
    value: throttledValue,
    isPending,
    flush,
    cancel,
  };
}

export default useDebouncedValue;
