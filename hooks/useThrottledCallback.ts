/**
 * useThrottledCallback Hook
 * 
 * Creates a throttled version of a callback function that limits execution
 * to once per specified time interval.
 * 
 * Features:
 * - Automatic cleanup on unmount
 * - Leading and trailing edge execution options
 * - Cancel and flush methods
 * - Type-safe callback preservation
 * - Perfect for scroll, resize, and high-frequency events
 * 
 * @module hooks/useThrottledCallback
 */

import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Configuration options for throttled callback
 */
interface ThrottleOptions {
  /** Interval in milliseconds (default: 100) */
  interval?: number;
  /** Execute on leading edge (default: true) */
  leading?: boolean;
  /** Execute on trailing edge (default: true) */
  trailing?: boolean;
}

/**
 * Result of useThrottledCallback
 */
interface ThrottledCallback<T extends (...args: unknown[]) => unknown> {
  /** Throttled callback function */
  callback: (...args: Parameters<T>) => void;
  /** Cancel any pending execution */
  cancel: () => void;
  /** Immediately execute pending callback */
  flush: () => void;
  /** Check if there's a pending execution */
  pending: () => boolean;
}

/**
 * Hook for creating a throttled callback with automatic cleanup
 * 
 * @example
 * ```tsx
 * const throttledScroll = useThrottledCallback(
 *   (scrollTop: number) => updateScrollPosition(scrollTop),
 *   { interval: 100 }
 * );
 * 
 * // Usage in scroll handler
 * window.addEventListener('scroll', () => {
 *   throttledScroll.callback(window.scrollY);
 * });
 * 
 * // Cancel pending execution
 * throttledScroll.cancel();
 * ```
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  options: ThrottleOptions = {}
): ThrottledCallback<T> {
  const { interval = 100, leading = true, trailing = true } = options;

  // Refs for timer and state management
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef<Parameters<T> | null>(null);
  const lastExecTimeRef = useRef<number>(0);
  const hasTrailingCallRef = useRef(false);

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
      lastExecTimeRef.current = Date.now();
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
    hasTrailingCallRef.current = false;
  }, []);

  /**
   * Immediately execute pending callback
   */
  const flush = useCallback(() => {
    if (timeoutRef.current && hasTrailingCallRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      execute();
      hasTrailingCallRef.current = false;
    }
  }, [execute]);

  /**
   * Check if there's a pending execution
   */
  const pending = useCallback(() => {
    return timeoutRef.current !== null;
  }, []);

  /**
   * Throttled callback function
   */
  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      argsRef.current = args;

      const timeSinceLastExec = now - lastExecTimeRef.current;
      const remainingTime = interval - timeSinceLastExec;

      // Execute immediately if enough time has passed (leading edge)
      if (remainingTime <= 0) {
        if (leading || lastExecTimeRef.current === 0) {
          execute();
        }
        lastExecTimeRef.current = now;
        return;
      }

      // Schedule trailing edge execution
      if (trailing && !timeoutRef.current) {
        hasTrailingCallRef.current = true;
        timeoutRef.current = setTimeout(() => {
          if (hasTrailingCallRef.current) {
            execute();
            hasTrailingCallRef.current = false;
          }
          timeoutRef.current = null;
          lastExecTimeRef.current = Date.now();
        }, remainingTime);
      }
    },
    [interval, leading, trailing, execute]
  );

  return {
    callback: throttledCallback,
    cancel,
    flush,
    pending,
  };
}

/**
 * Simplified hook that returns just the throttled function
 * 
 * @example
 * ```tsx
 * const throttledUpdate = useThrottle((value: number) => {
 *   saveToServer(value);
 * }, 500);
 * 
 * throttledUpdate(newValue); // Will execute at most once per 500ms
 * ```
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number = 100
): (...args: Parameters<T>) => void {
  const { callback: throttledCallback } = useThrottledCallback(callback, { interval });
  return throttledCallback;
}

/**
 * Hook for throttling a value
 * 
 * @example
 * ```tsx
 * const [scrollTop, setScrollTop] = useState(0);
 * const throttledScrollTop = useThrottledValue(scrollTop, 100);
 * 
 * useEffect(() => {
 *   // This effect runs at most once per 100ms
 *   saveScrollPosition(throttledScrollTop);
 * }, [throttledScrollTop]);
 * ```
 */
export function useThrottledValue<T>(value: T, interval: number = 100): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdateTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    const remainingTime = interval - timeSinceLastUpdate;

    if (remainingTime <= 0) {
      setThrottledValue(value);
      lastUpdateTimeRef.current = now;
    } else if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        setThrottledValue(value);
        lastUpdateTimeRef.current = Date.now();
        timeoutRef.current = null;
      }, remainingTime);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, interval]);

  return throttledValue;
}

export default useThrottledCallback;
