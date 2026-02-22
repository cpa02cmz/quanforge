/**
 * useIdleCallback Hook
 * Schedules non-critical work during browser idle periods
 * 
 * Features:
 * - Wraps requestIdleCallback with React lifecycle
 * - Automatic cleanup on unmount
 * - Fallback to setTimeout for unsupported browsers
 * - Configurable timeout for guaranteed execution
 * - TypeScript-first with full type safety
 * 
 * @module hooks/useIdleCallback
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Idle deadline interface compatible with browser API
 */
interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

/**
 * Options for idle callback
 */
interface IdleCallbackOptions {
  /** Maximum time to wait before forcing execution (ms) */
  timeout?: number;
}

/**
 * Check if requestIdleCallback is available
 */
const hasIdleCallback = typeof window !== 'undefined' && 
  typeof window.requestIdleCallback === 'function';

/**
 * Fallback implementation using setTimeout
 */
const fallbackRequestIdleCallback = (
  callback: (deadline: IdleDeadline) => void,
  options?: IdleCallbackOptions
): number => {
  return window.setTimeout(() => {
    const start = Date.now();
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    });
  }, options?.timeout ?? 1) as unknown as number;
};

const fallbackCancelIdleCallback = (id: number): void => {
  window.clearTimeout(id);
};

/**
 * Get the appropriate requestIdleCallback function
 */
const getRequestIdleCallback = (): typeof window.requestIdleCallback => {
  if (hasIdleCallback) {
    return window.requestIdleCallback.bind(window);
  }
  return fallbackRequestIdleCallback as typeof window.requestIdleCallback;
};

/**
 * Get the appropriate cancelIdleCallback function
 */
const getCancelIdleCallback = (): typeof window.cancelIdleCallback => {
  if (hasIdleCallback) {
    return window.cancelIdleCallback.bind(window);
  }
  return fallbackCancelIdleCallback as typeof window.cancelIdleCallback;
};

/**
 * Hook return type
 */
interface UseIdleCallbackResult {
  /** Schedule work to be done during idle period */
  scheduleIdleWork: (callback: (deadline: IdleDeadline) => void, options?: IdleCallbackOptions) => number;
  /** Cancel a scheduled idle callback */
  cancelIdleWork: (id: number) => void;
  /** Check if currently in an idle period */
  isInIdlePeriod: () => boolean;
}

/**
 * Hook for scheduling non-critical work during browser idle periods
 * 
 * Use this for:
 * - Analytics reporting
 * - Non-critical DOM updates
 * - Preloading data
 * - Background computations
 * 
 * @example
 * ```tsx
 * const { scheduleIdleWork } = useIdleCallback();
 * 
 * // Schedule non-critical work
 * scheduleIdleWork((deadline) => {
 *   while (deadline.timeRemaining() > 0 && hasWork()) {
 *     doWork();
 *   }
 * });
 * ```
 */
export function useIdleCallback(): UseIdleCallbackResult {
  const callbacksRef = useRef<Set<number>>(new Set());
  const isMountedRef = useRef(true);

  /**
   * Schedule work to be done during idle period
   */
  const scheduleIdleWork = useCallback((
    callback: (deadline: IdleDeadline) => void,
    options?: IdleCallbackOptions
  ): number => {
    const requestIdle = getRequestIdleCallback();
    
    const wrappedCallback = (deadline: IdleDeadline) => {
      if (!isMountedRef.current) {
        return;
      }
      
      callbacksRef.current.delete(id);
      callback(deadline);
    };
    
    const id = requestIdle(wrappedCallback as IdleRequestCallback, options as IdleRequestOptions);
    callbacksRef.current.add(id);
    
    return id;
  }, []);

  /**
   * Cancel a scheduled idle callback
   */
  const cancelIdleWork = useCallback((id: number): void => {
    const cancelIdle = getCancelIdleCallback();
    
    if (callbacksRef.current.has(id)) {
      callbacksRef.current.delete(id);
      cancelIdle(id);
    }
  }, []);

  /**
   * Check if currently in an idle period
   */
  const isInIdlePeriod = useCallback((): boolean => {
    if (!hasIdleCallback) {
      return false;
    }
    
    // Use requestIdleCallback to check if we're in idle
    let isIdle = false;
    const startIdleCheck = Date.now();
    
    window.requestIdleCallback?.(() => {
      isIdle = Date.now() - startIdleCheck < 1;
    }, { timeout: 0 });
    
    return isIdle;
  }, []);

  // Cleanup all callbacks on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      const cancelIdle = getCancelIdleCallback();
      callbacksRef.current.forEach(id => {
        cancelIdle(id);
      });
      callbacksRef.current.clear();
    };
  }, []);

  return {
    scheduleIdleWork,
    cancelIdleWork,
    isInIdlePeriod,
  };
}

/**
 * Hook for running a callback during idle time with automatic scheduling
 * 
 * @example
 * ```tsx
 * // Run analytics during idle time
 * useIdleCallbackEffect(() => {
 *   sendAnalytics('page_view');
 * }, [currentPage]);
 * ```
 */
export function useIdleCallbackEffect(
  callback: () => void,
  deps: React.DependencyList,
  options?: IdleCallbackOptions
): void {
  const { scheduleIdleWork, cancelIdleWork } = useIdleCallback();
  const idRef = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any pending callback
    if (idRef.current !== null) {
      cancelIdleWork(idRef.current);
    }

    // Schedule new callback
    idRef.current = scheduleIdleWork(() => {
      callback();
      idRef.current = null;
    }, options);

    // Cleanup on effect re-run or unmount
    return () => {
      if (idRef.current !== null) {
        cancelIdleWork(idRef.current);
        idRef.current = null;
      }
    };
  }, deps);
}

/**
 * Hook for processing items during idle time
 * Useful for processing large arrays without blocking the main thread
 * 
 * @example
 * ```tsx
 * const { process, progress, isProcessing } = useIdleProcessor();
 * 
 * // Process large array in chunks during idle time
 * process(largeArray, (item) => {
 *   return transformItem(item);
 * });
 * ```
 */
export function useIdleProcessor<T, R>(
  chunkSize: number = 10
): {
  process: (items: T[], processor: (item: T) => R, onComplete?: (results: R[]) => void) => void;
  progress: number;
  isProcessing: boolean;
  cancel: () => void;
  results: R[];
} {
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<R[]>([]);
  
  const { scheduleIdleWork, cancelIdleWork } = useIdleCallback();
  const callbackIdRef = useRef<number | null>(null);
  const stateRef = useRef<{
    items: T[];
    processor: (item: T) => R;
    onComplete?: (results: R[]) => void;
    currentIndex: number;
    results: R[];
  }>({
    items: [],
    processor: () => null as R,
    currentIndex: 0,
    results: [],
  });

  const processChunk = useCallback(() => {
    const state = stateRef.current;
    const endIndex = Math.min(state.currentIndex + chunkSize, state.items.length);
    
    // Process chunk
    for (let i = state.currentIndex; i < endIndex; i++) {
      const item = state.items[i];
      if (item !== undefined) {
        state.results.push(state.processor(item));
      }
    }
    
    state.currentIndex = endIndex;
    
    // Update progress
    const newProgress = (state.currentIndex / state.items.length) * 100;
    setProgress(newProgress);
    setResults([...state.results]);
    
    // Check if done
    if (state.currentIndex >= state.items.length) {
      setIsProcessing(false);
      state.onComplete?.(state.results);
      return;
    }
    
    // Schedule next chunk
    callbackIdRef.current = scheduleIdleWork(processChunk);
  }, [chunkSize, scheduleIdleWork]);

  const process = useCallback((
    items: T[],
    processor: (item: T) => R,
    onComplete?: (results: R[]) => void
  ) => {
    // Cancel any existing processing
    if (callbackIdRef.current !== null) {
      cancelIdleWork(callbackIdRef.current);
    }
    
    // Reset state
    stateRef.current = {
      items,
      processor,
      onComplete,
      currentIndex: 0,
      results: [],
    };
    
    setProgress(0);
    setIsProcessing(true);
    setResults([]);
    
    // Start processing
    callbackIdRef.current = scheduleIdleWork(processChunk);
  }, [cancelIdleWork, scheduleIdleWork, processChunk]);

  const cancel = useCallback(() => {
    if (callbackIdRef.current !== null) {
      cancelIdleWork(callbackIdRef.current);
      callbackIdRef.current = null;
    }
    
    setIsProcessing(false);
  }, [cancelIdleWork]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callbackIdRef.current !== null) {
        cancelIdleWork(callbackIdRef.current);
      }
    };
  }, [cancelIdleWork]);

  return {
    process,
    progress,
    isProcessing,
    cancel,
    results,
  };
}

export default useIdleCallback;
