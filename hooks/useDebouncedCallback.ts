/**
 * useDebouncedCallback Hook
 * 
 * Creates a debounced version of a callback function that delays execution
 * until after a specified delay has elapsed since the last call.
 * 
 * Features:
 * - Automatic cleanup on unmount
 * - Cancel, flush, and pending methods
 * - Leading edge execution option
 * - Max wait time option
 * - Type-safe callback preservation
 * 
 * @module hooks/useDebouncedCallback
 */

import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Configuration options for debounced callback
 */
interface DebounceOptions {
  /** Delay in milliseconds (default: 300) */
  delay?: number;
  /** Execute on leading edge (default: false) */
  leading?: boolean;
  /** Maximum wait time in milliseconds */
  maxWait?: number;
}

/**
 * Result of useDebouncedCallback
 */
interface DebouncedCallback<T extends (...args: unknown[]) => unknown> {
  /** Debounced callback function */
  callback: (...args: Parameters<T>) => void;
  /** Cancel any pending execution */
  cancel: () => void;
  /** Immediately execute pending callback */
  flush: () => void;
  /** Check if there's a pending execution */
  pending: () => boolean;
}

/**
 * Hook for creating a debounced callback with automatic cleanup
 * 
 * @example
 * ```tsx
 * const debouncedSearch = useDebouncedCallback(
 *   (query: string) => searchAPI(query),
 *   { delay: 300 }
 * );
 * 
 * // Usage
 * debouncedSearch.callback('hello');
 * 
 * // Cancel pending execution
 * debouncedSearch.cancel();
 * 
 * // Check if pending
 * if (debouncedSearch.pending()) {
 *   console.log('Execution pending');
 * }
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  options: DebounceOptions = {}
): DebouncedCallback<T> {
  const { delay = 300, leading = false, maxWait } = options;

  // Refs for timer and state management
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef<Parameters<T> | null>(null);
  const calledRef = useRef(false);
  const lastCallTimeRef = useRef<number>(0);

  // Keep callback ref updated
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

  /**
   * Execute the callback
   */
  const execute = useCallback(() => {
    if (argsRef.current !== null && callbackRef.current) {
      callbackRef.current(...argsRef.current);
      calledRef.current = true;
    }
  }, []);

  /**
   * Cancel any pending execution
   */
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    argsRef.current = null;
  }, []);

  /**
   * Immediately execute pending callback
   */
  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      execute();
    }
  }, [execute]);

  /**
   * Check if there's a pending execution
   */
  const pending = useCallback(() => {
    return timeoutRef.current !== null;
  }, []);

  /**
   * Debounced callback function
   */
  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      argsRef.current = args;
      lastCallTimeRef.current = now;

      // Leading edge execution
      if (leading && !calledRef.current) {
        execute();
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Calculate delay
      let effectiveDelay = delay;

      // Handle maxWait
      if (maxWait !== undefined && calledRef.current) {
        const timeSinceLastCall = now - lastCallTimeRef.current;
        const remainingWait = maxWait - timeSinceLastCall;
        effectiveDelay = Math.min(delay, Math.max(0, remainingWait));
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        execute();
        timeoutRef.current = null;
      }, effectiveDelay);
    },
    [delay, leading, maxWait, execute]
  );

  return {
    callback: debouncedCallback,
    cancel,
    flush,
    pending,
  };
}

/**
 * Simplified hook that returns just the debounced function
 * 
 * @example
 * ```tsx
 * const debouncedSearch = useDebounce((query: string) => {
 *   searchAPI(query);
 * }, 300);
 * 
 * debouncedSearch('hello'); // Will execute after 300ms
 * ```
 */
export function useDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const { callback: debouncedCallback } = useDebouncedCallback(callback, { delay });
  return debouncedCallback;
}

/**
 * Hook for debouncing a value
 * 
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
 * 
 * useEffect(() => {
 *   if (debouncedSearchTerm) {
 *     searchAPI(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 * ```
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebouncedCallback;
