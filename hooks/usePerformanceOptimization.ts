/**
 * usePerformanceOptimization Hook
 * 
 * A comprehensive performance optimization hook that provides lazy computation,
 * performance budget monitoring, and optimized list rendering utilities.
 * 
 * Features:
 * - Lazy computation with idle callback support
 * - Performance budget monitoring with alerts
 * - Optimized list rendering with chunking
 * - Automatic cleanup and memory management
 * 
 * @module hooks/usePerformanceOptimization
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('perf-opt');

// ========== TYPES ==========

export interface PerformanceBudget {
  /** Maximum render time in ms (default: 16 for 60fps) */
  maxRenderTime: number;
  /** Maximum memory usage in MB (default: 50) */
  maxMemoryMB: number;
  /** Maximum number of re-renders before warning (default: 10) */
  maxRerenders: number;
  /** Enable console warnings (default: true in dev) */
  enableWarnings: boolean;
}

export interface PerformanceAlert {
  type: 'render_time' | 'memory' | 'rerenders';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export interface LazyComputationOptions<T> {
  /** Delay before starting computation (ms) */
  delay?: number;
  /** Use requestIdleCallback for computation */
  useIdleCallback?: boolean;
  /** Timeout for idle callback (ms) */
  idleTimeout?: number;
  /** Fallback value while computing */
  fallback?: T;
  /** Callback when computation completes */
  onComplete?: (result: T) => void;
}

export interface ChunkedRenderOptions {
  /** Number of items to render per chunk (default: 20) */
  chunkSize?: number;
  /** Delay between chunks in ms (default: 16 for 60fps) */
  chunkDelay?: number;
  /** Minimum items before chunking (default: 50) */
  minItemsForChunking?: number;
}

// ========== PERFORMANCE BUDGET MONITOR ==========

/**
 * Hook to monitor component performance against a budget.
 * Alerts when performance thresholds are exceeded.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { alerts, isWithinBudget, markRenderStart, markRenderEnd } = usePerformanceBudget({
 *     maxRenderTime: 16,
 *     maxRerenders: 5,
 *   });
 *   
 *   markRenderStart();
 *   // ... render logic
 *   useEffect(() => markRenderEnd());
 *   
 *   if (!isWithinBudget) {
 *     console.warn('Performance budget exceeded:', alerts);
 *   }
 * }
 * ```
 */
export function usePerformanceBudget(
  componentName: string,
  budget: Partial<PerformanceBudget> = {}
): {
  alerts: PerformanceAlert[];
  isWithinBudget: boolean;
  renderCount: number;
  markRenderStart: () => void;
  markRenderEnd: () => void;
  reset: () => void;
} {
  const {
    maxRenderTime = 16,
    maxMemoryMB = 50,
    maxRerenders = 10,
    enableWarnings = import.meta.env.DEV,
  } = budget;

  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const renderCountRef = useRef(0);
  const renderStartTimeRef = useRef(0);
  const lastMemoryCheckRef = useRef(0);

  const addAlert = useCallback((alert: Omit<PerformanceAlert, 'timestamp'>) => {
    const newAlert = { ...alert, timestamp: Date.now() };
    setAlerts(prev => [...prev.slice(-9), newAlert]); // Keep last 10 alerts
    
    if (enableWarnings) {
      logger.warn(`[${componentName}] Performance alert:`, alert.message);
    }
  }, [componentName, enableWarnings]);

  const checkMemory = useCallback(() => {
    const now = Date.now();
    // Check memory at most once per second
    if (now - lastMemoryCheckRef.current < 1000) return;
    lastMemoryCheckRef.current = now;

    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
      const usedMB = (perf.memory?.usedJSHeapSize || 0) / (1024 * 1024);
      
      if (usedMB > maxMemoryMB) {
        addAlert({
          type: 'memory',
          message: `Memory usage (${usedMB.toFixed(1)}MB) exceeds budget (${maxMemoryMB}MB)`,
          value: usedMB,
          threshold: maxMemoryMB,
        });
      }
    }
  }, [maxMemoryMB, addAlert]);

  const markRenderStart = useCallback(() => {
    renderStartTimeRef.current = performance.now();
    checkMemory();
  }, [checkMemory]);

  const markRenderEnd = useCallback(() => {
    const renderTime = performance.now() - renderStartTimeRef.current;
    renderCountRef.current++;

    if (renderTime > maxRenderTime) {
      addAlert({
        type: 'render_time',
        message: `Render time (${renderTime.toFixed(1)}ms) exceeds budget (${maxRenderTime}ms)`,
        value: renderTime,
        threshold: maxRenderTime,
      });
    }

    if (renderCountRef.current > maxRerenders) {
      addAlert({
        type: 'rerenders',
        message: `Re-render count (${renderCountRef.current}) exceeds budget (${maxRerenders})`,
        value: renderCountRef.current,
        threshold: maxRerenders,
      });
    }
  }, [maxRenderTime, maxRerenders, addAlert]);

  const reset = useCallback(() => {
    setAlerts([]);
    renderCountRef.current = 0;
  }, []);

  const isWithinBudget = alerts.length === 0;
  const renderCount = renderCountRef.current;

  return { alerts, isWithinBudget, renderCount, markRenderStart, markRenderEnd, reset };
}

// ========== LAZY COMPUTATION ==========

/**
 * Hook for lazy computation that defers expensive calculations.
 * Uses requestIdleCallback when available, with fallback to setTimeout.
 * 
 * @example
 * ```tsx
 * function DataComponent({ data }) {
 *   const result = useLazyComputation(
 *     () => processLargeDataset(data),
 *     [data],
 *     { fallback: [], useIdleCallback: true }
 *   );
 *   
 *   return <div>{result.length} items processed</div>;
 * }
 * ```
 */
export function useLazyComputation<T>(
  factory: () => T,
  deps: unknown[],
  options: LazyComputationOptions<T> = {}
): { value: T | undefined; isComputing: boolean; error: Error | null } {
  const {
    delay = 0,
    useIdleCallback = true,
    idleTimeout = 2000,
    fallback,
    onComplete,
  } = options;

  const [value, setValue] = useState<T | undefined>(fallback);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const depsRef = useRef(deps);
  const computingRef = useRef(false);

  // Check if deps changed
  const depsChanged = useMemo(() => {
    return deps.length !== depsRef.current.length ||
      deps.some((dep, i) => !Object.is(dep, depsRef.current[i]));
  }, [deps]);

  useEffect(() => {
    if (!depsChanged && computingRef.current) return;

    depsRef.current = deps;
    computingRef.current = true;
    setIsComputing(true);
    setError(null);

    const compute = () => {
      try {
        const result = factory();
        setValue(result);
        onComplete?.(result);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setIsComputing(false);
        computingRef.current = false;
      }
    };

    const scheduleComputation = (): (() => void) => {
      if (delay > 0) {
        const timeoutId = setTimeout(() => {
          if (useIdleCallback && 'requestIdleCallback' in window) {
            (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
              compute,
              { timeout: idleTimeout }
            );
            // idleId is intentionally not stored as cleanup happens via the outer timeout
          } else {
            compute();
          }
        }, delay);
        return () => clearTimeout(timeoutId);
      } else if (useIdleCallback && 'requestIdleCallback' in window) {
        const idleId = (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
          compute,
          { timeout: idleTimeout }
        );
        return () => {
          (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
        };
      } else {
        const timeoutId = setTimeout(compute, 0);
        return () => clearTimeout(timeoutId);
      }
    };

    const cleanup = scheduleComputation();
    return cleanup;
  }, [depsChanged, factory, delay, useIdleCallback, idleTimeout, onComplete]);

  return { value, isComputing, error };
}

// ========== CHUNKED LIST RENDERING ==========

/**
 * Hook for rendering large lists in chunks to prevent blocking.
 * Useful for lists with hundreds or thousands of items.
 * 
 * @example
 * ```tsx
 * function LargeList({ items }) {
 *   const { visibleItems, hasMore, loadMore } = useChunkedList(items, {
 *     chunkSize: 50,
 *   });
 *   
 *   return (
 *     <div>
 *       {visibleItems.map(item => <Item key={item.id} {...item} />)}
 *       {hasMore && <button onClick={loadMore}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useChunkedList<T>(
  items: T[],
  options: ChunkedRenderOptions = {}
): {
  visibleItems: T[];
  hasMore: boolean;
  loadMore: () => void;
  loadAll: () => void;
  reset: () => void;
  progress: number;
} {
  const {
    chunkSize = 20,
    // chunkDelay is used in useAutoChunkedRender, not here
    minItemsForChunking = 50,
  } = options;

  const [visibleCount, setVisibleCount] = useState(
    items.length <= minItemsForChunking ? items.length : chunkSize
  );
  const isLoadingRef = useRef(false);

  // Reset when items change significantly
  useEffect(() => {
    setVisibleCount(items.length <= minItemsForChunking ? items.length : chunkSize);
  }, [items.length, chunkSize, minItemsForChunking]);

  const loadMore = useCallback(() => {
    if (isLoadingRef.current || visibleCount >= items.length) return;
    
    isLoadingRef.current = true;
    
    // Use requestAnimationFrame for smooth chunking
    requestAnimationFrame(() => {
      setVisibleCount(prev => Math.min(prev + chunkSize, items.length));
      isLoadingRef.current = false;
    });
  }, [visibleCount, items.length, chunkSize]);

  const loadAll = useCallback(() => {
    setVisibleCount(items.length);
  }, [items.length]);

  const reset = useCallback(() => {
    setVisibleCount(items.length <= minItemsForChunking ? items.length : chunkSize);
  }, [items.length, chunkSize, minItemsForChunking]);

  const hasMore = visibleCount < items.length;
  const progress = items.length > 0 ? (visibleCount / items.length) * 100 : 100;

  return {
    visibleItems: items.slice(0, visibleCount),
    hasMore,
    loadMore,
    loadAll,
    reset,
    progress,
  };
}

// ========== AUTO-CHUNKED RENDER ==========

/**
 * Hook that automatically chunks rendering for large lists.
 * Progressively renders items without blocking the main thread.
 * 
 * @example
 * ```tsx
 * function AutoList({ items }) {
 *   const visibleItems = useAutoChunkedRender(items, { chunkSize: 30 });
 *   
 *   return (
 *     <div>
 *       {visibleItems.map(item => <Item key={item.id} {...item} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAutoChunkedRender<T>(
  items: T[],
  options: ChunkedRenderOptions = {}
): T[] {
  const {
    chunkSize = 20,
    chunkDelay = 16,
    minItemsForChunking = 50,
  } = options;

  const [visibleCount, setVisibleCount] = useState(
    items.length <= minItemsForChunking ? items.length : chunkSize
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset if items change
    const initialCount = items.length <= minItemsForChunking ? items.length : chunkSize;
    setVisibleCount(initialCount);

    if (items.length <= minItemsForChunking) return;

    // Auto-chunk render
    const chunkItems = () => {
      setVisibleCount(prev => {
        if (prev >= items.length) {
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          return prev;
        }
        return Math.min(prev + chunkSize, items.length);
      });
    };

    const scheduleNextChunk = () => {
      rafRef.current = requestAnimationFrame(() => {
        chunkItems();
        if (visibleCount < items.length) {
          setTimeout(scheduleNextChunk, chunkDelay);
        }
      });
    };

    // Start chunking after initial render
    const timeoutId = setTimeout(scheduleNextChunk, chunkDelay);

    return () => {
      clearTimeout(timeoutId);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [items.length, chunkSize, chunkDelay, minItemsForChunking]);

  return items.slice(0, visibleCount);
}

// ========== DEBOUNCED VALUE WITH CANCEL ==========

/**
 * Hook for debounced values with cancel and flush support.
 * Optimized for performance with leading/trailing options.
 * 
 * @example
 * ```tsx
 * function SearchInput({ onSearch }) {
 *   const [query, setQuery] = useState('');
 *   const { debouncedValue, cancel, flush } = useDebouncedValueWithCancel(query, 300);
 *   
 *   useEffect(() => {
 *     if (debouncedValue) onSearch(debouncedValue);
 *   }, [debouncedValue]);
 *   
 *   return (
 *     <input
 *       value={query}
 *       onChange={e => setQuery(e.target.value)}
 *       onBlur={flush} // Immediately search on blur
 *     />
 *   );
 * }
 * ```
 */
export function useDebouncedValueWithCancel<T>(
  value: T,
  delay: number
): {
  debouncedValue: T;
  isPending: boolean;
  cancel: () => void;
  flush: () => void;
} {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [isPending, setIsPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
    setIsPending(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
      setIsPending(false);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      setIsPending(false);
    }
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      setDebouncedValue(valueRef.current);
      setIsPending(false);
    }
  }, []);

  return { debouncedValue, isPending, cancel, flush };
}

export default usePerformanceBudget;
