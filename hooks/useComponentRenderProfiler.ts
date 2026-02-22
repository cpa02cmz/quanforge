/**
 * useComponentRenderProfiler Hook
 * Measures and reports component render performance metrics
 * 
 * Features:
 * - Measures render duration and count
 * - Tracks unnecessary re-renders
 * - Identifies performance bottlenecks
 * - Provides performance recommendations
 * - Zero production overhead (disabled in production)
 * 
 * @module hooks/useComponentRenderProfiler
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { createScopedLogger } from '../utils/logger';

/**
 * Performance metric for a single render
 */
interface RenderMetric {
  /** Render start timestamp */
  startTime: number;
  /** Render end timestamp */
  endTime: number;
  /** Duration in milliseconds */
  duration: number;
  /** Props that changed since last render */
  changedProps: string[];
  /** Reason for render (if detectable) */
  renderReason: 'mount' | 'props-change' | 'state-change' | 'context-change' | 'unknown';
}

/**
 * Aggregated performance statistics
 */
interface PerformanceStats {
  /** Total number of renders */
  renderCount: number;
  /** Average render duration in ms */
  averageDuration: number;
  /** Maximum render duration in ms */
  maxDuration: number;
  /** Minimum render duration in ms */
  minDuration: number;
  /** Last render duration in ms */
  lastDuration: number;
  /** Total time spent rendering in ms */
  totalTime: number;
  /** Number of unnecessary re-renders */
  unnecessaryRerenders: number;
  /** Percentage of unnecessary re-renders */
  unnecessaryRerenderPercent: number;
  /** Most frequently changed props */
  frequentPropChanges: Array<{ prop: string; count: number }>;
}

/**
 * Configuration options
 */
interface ProfilerConfig {
  /** Component name for logging */
  name?: string;
  /** Enable profiling (default: true in dev, false in prod) */
  enabled?: boolean;
  /** Log to console on each render */
  logRenders?: boolean;
  /** Warn if render takes longer than this (ms) */
  warnThreshold?: number;
  /** Maximum metrics to keep in history */
  maxHistorySize?: number;
  /** Callback when performance issues detected */
  onPerformanceIssue?: (stats: PerformanceStats, issue: string) => void;
}

/**
 * Result of the profiler hook
 */
interface ProfilerResult {
  /** Current performance statistics */
  stats: PerformanceStats;
  /** Reset all metrics */
  reset: () => void;
  /** Mark the start of an expensive operation */
  markStart: (label: string) => void;
  /** Mark the end of an expensive operation */
  markEnd: (label: string) => void;
  /** Get detailed render history */
  getHistory: () => RenderMetric[];
  /** Check if component is performing poorly */
  isPerformingPoorly: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ProfilerConfig> = {
  name: 'Component',
  enabled: typeof window !== 'undefined' && process.env['NODE_ENV'] === 'development',
  logRenders: false,
  warnThreshold: 16, // ~60fps
  maxHistorySize: 100,
  onPerformanceIssue: () => {},
};

/**
 * Detect which props changed between renders
 */
function detectPropChanges(
  prevProps: Record<string, unknown> | null,
  nextProps: Record<string, unknown> | null
): string[] {
  if (!prevProps || !nextProps) return [];
  
  const changed: string[] = [];
  
  for (const key of Object.keys(nextProps)) {
    if (prevProps[key] !== nextProps[key]) {
      changed.push(key);
    }
  }
  
  // Check for removed props
  for (const key of Object.keys(prevProps)) {
    if (!(key in nextProps)) {
      changed.push(key);
    }
  }
  
  return changed;
}

/**
 * Estimate render reason
 */
function estimateRenderReason(
  renderCount: number,
  changedProps: string[]
): RenderMetric['renderReason'] {
  if (renderCount === 1) return 'mount';
  if (changedProps.length > 0) return 'props-change';
  return 'unknown';
}

/**
 * Hook for profiling component render performance
 * 
 * @example
 * ```tsx
 * const MyComponent = memo((props) => {
 *   const { stats, isPerformingPoorly } = useComponentRenderProfiler(
 *     'MyComponent',
 *     props
 *   );
 *   
 *   if (isPerformingPoorly) {
 *     console.warn('Component performing poorly', stats);
 *   }
 *   
 *   return <div>...</div>;
 * });
 * ```
 */
export function useComponentRenderProfiler(
  componentName: string,
  props?: Record<string, unknown>,
  config: ProfilerConfig = {}
): ProfilerResult {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config, name: componentName };
  
  // Skip in production unless explicitly enabled
  const isEnabled = mergedConfig.enabled;
  
  // State
  const [metrics, setMetrics] = useState<RenderMetric[]>([]);
  const [isPerformingPoorly, setIsPerformingPoorly] = useState(false);
  
  // Refs
  const renderStartTimeRef = useRef<number>(0);
  const prevPropsRef = useRef<Record<string, unknown> | null>(null);
  const marksRef = useRef<Map<string, number>>(new Map());
  const issueLoggedRef = useRef(false);
  
  // Logger
  const logger = useMemo(() => createScopedLogger(componentName), [componentName]);

  // Calculate statistics
  const stats = useMemo((): PerformanceStats => {
    if (metrics.length === 0) {
      return {
        renderCount: 0,
        averageDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        lastDuration: 0,
        totalTime: 0,
        unnecessaryRerenders: 0,
        unnecessaryRerenderPercent: 0,
        frequentPropChanges: [],
      };
    }

    const durations = metrics.map(m => m.duration);
    const totalTime = durations.reduce((a, b) => a + b, 0);
    const unnecessaryRerenders = metrics.filter(m => m.changedProps.length === 0 && m.renderReason !== 'mount').length;
    
    // Calculate frequent prop changes
    const propChangeCounts = new Map<string, number>();
    metrics.forEach(m => {
      m.changedProps.forEach(prop => {
        propChangeCounts.set(prop, (propChangeCounts.get(prop) ?? 0) + 1);
      });
    });
    
    const frequentPropChanges = Array.from(propChangeCounts.entries())
      .map(([prop, count]) => ({ prop, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      renderCount: metrics.length,
      averageDuration: totalTime / metrics.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      lastDuration: durations[durations.length - 1] ?? 0,
      totalTime,
      unnecessaryRerenders,
      unnecessaryRerenderPercent: metrics.length > 1 
        ? (unnecessaryRerenders / (metrics.length - 1)) * 100 
        : 0,
      frequentPropChanges,
    };
  }, [metrics]);

  // Reset metrics
  const reset = useCallback(() => {
    setMetrics([]);
    setIsPerformingPoorly(false);
    issueLoggedRef.current = false;
    prevPropsRef.current = null;
  }, []);

  // Mark start of operation
  const markStart = useCallback((label: string) => {
    if (!isEnabled) return;
    marksRef.current.set(label, performance.now());
  }, [isEnabled]);

  // Mark end of operation
  const markEnd = useCallback((label: string) => {
    if (!isEnabled) return;
    
    const startTime = marksRef.current.get(label);
    if (startTime !== undefined) {
      const duration = performance.now() - startTime;
      marksRef.current.delete(label);
      
      if (mergedConfig.logRenders) {
        logger.debug(`${label}: ${duration.toFixed(2)}ms`);
      }
    }
  }, [isEnabled, logger, mergedConfig.logRenders]);

  // Get history
  const getHistory = useCallback(() => {
    return [...metrics];
  }, [metrics]);

  // Measure render time
  useEffect(() => {
    if (!isEnabled) return;

    const endTime = performance.now();
    const duration = endTime - renderStartTimeRef.current;
    const changedProps = detectPropChanges(prevPropsRef.current, props ?? null);
    const renderReason = estimateRenderReason(metrics.length + 1, changedProps);

    const metric: RenderMetric = {
      startTime: renderStartTimeRef.current,
      endTime,
      duration,
      changedProps,
      renderReason,
    };

    // Update metrics
    setMetrics(prev => {
      const newMetrics = [...prev, metric];
      if (newMetrics.length > mergedConfig.maxHistorySize) {
        newMetrics.shift();
      }
      return newMetrics;
    });

    // Update prev props
    prevPropsRef.current = props ? { ...props } : null;

    // Log render
    if (mergedConfig.logRenders) {
      logger.debug(
        `Render #${metrics.length + 1}: ${duration.toFixed(2)}ms`,
        changedProps.length > 0 ? `Changed props: ${changedProps.join(', ')}` : ''
      );
    }

    // Warn on slow renders
    if (duration > mergedConfig.warnThreshold) {
      logger.warn(
        `Slow render: ${duration.toFixed(2)}ms (threshold: ${mergedConfig.warnThreshold}ms)`
      );
    }

    // Check for performance issues
    const newRenderCount = metrics.length + 1;
    if (newRenderCount >= 5) {
      const recentMetrics = metrics.slice(-5);
      const avgDuration = recentMetrics.reduce((a, b) => a + b.duration, 0) / recentMetrics.length;
      const recentUnnecessary = recentMetrics.filter(m => m.changedProps.length === 0).length;
      
      if (avgDuration > mergedConfig.warnThreshold || recentUnnecessary >= 3) {
        setIsPerformingPoorly(true);
        
        if (!issueLoggedRef.current) {
          issueLoggedRef.current = true;
          
          const issue = avgDuration > mergedConfig.warnThreshold
            ? `Average render time (${avgDuration.toFixed(2)}ms) exceeds threshold`
            : `${recentUnnecessary} of last 5 renders were unnecessary`;
          
          mergedConfig.onPerformanceIssue(stats, issue);
          
          if (mergedConfig.logRenders) {
            logger.warn(`Performance issue detected: ${issue}`);
          }
        }
      }
    }
  });

  // Mark render start
  if (isEnabled) {
    renderStartTimeRef.current = performance.now();
  }

  // Cleanup
  useEffect(() => {
    if (!isEnabled) return;
    
    return () => {
      marksRef.current.clear();
    };
  }, [isEnabled]);

  return {
    stats,
    reset,
    markStart,
    markEnd,
    getHistory,
    isPerformingPoorly,
  };
}

/**
 * Simplified hook for measuring expensive operations
 * 
 * @example
 * ```tsx
 * const { measure } = usePerformanceMeasure('MyOperation');
 * 
 * const result = measure(() => {
 *   // Expensive operation
 *   return heavyComputation();
 * });
 * ```
 */
export function usePerformanceMeasure(name: string) {
  const isEnabled = typeof window !== 'undefined' && process.env['NODE_ENV'] === 'development';
  const logger = useMemo(() => createScopedLogger(name), [name]);
  
  const measure = useCallback(<T,>(fn: () => T): T => {
    if (!isEnabled) return fn();
    
    const startTime = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - startTime;
      if (duration > 1) {
        logger.debug(`Took ${duration.toFixed(2)}ms`);
      }
    }
  }, [logger, isEnabled]);

  const measureAsync = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (!isEnabled) return fn();
    
    const startTime = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - startTime;
      logger.debug(`Took ${duration.toFixed(2)}ms`);
    }
  }, [logger, isEnabled]);

  return { measure, measureAsync };
}

/**
 * Hook for tracking component mount/unmount timing
 */
export function useMountProfiler(name: string) {
  const isEnabled = typeof window !== 'undefined' && process.env['NODE_ENV'] === 'development';
  const mountTimeRef = useRef<number>(0);
  const logger = useMemo(() => createScopedLogger(name), [name]);

  useEffect(() => {
    if (!isEnabled) return;
    
    mountTimeRef.current = performance.now();
    logger.debug('Mounted');
    
    return () => {
      const mountDuration = performance.now() - mountTimeRef.current;
      logger.debug(`Unmounted after ${(mountDuration / 1000).toFixed(2)}s`);
    };
  }, [logger, isEnabled]);
}

export default useComponentRenderProfiler;
