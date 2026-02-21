/**
 * useComponentPerformance Hook
 * 
 * Tracks component render performance and provides insights for optimization.
 * Helps identify slow renders, unnecessary re-renders, and memory leaks.
 * 
 * Features:
 * - Render time measurement
 * - Re-render count tracking
 * - Props change detection
 * - Memory usage monitoring
 * - Performance scoring
 * 
 * @module hooks/useComponentPerformance
 */

import { useRef, useEffect, useCallback } from 'react';
import React from 'react';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('component-perf');

// ========== TYPES ==========

export interface ComponentPerformanceConfig {
  /** Component name for logging */
  name: string;
  /** Log render times in development */
  logRenders?: boolean;
  /** Warn if render exceeds threshold (ms) */
  warnThreshold?: number;
  /** Track which props changed */
  trackProps?: boolean;
  /** Enable memory monitoring */
  trackMemory?: boolean;
  /** Max samples to keep */
  maxSamples?: number;
}

export interface RenderMetric {
  /** Render sequence number */
  renderNumber: number;
  /** Time taken to render (ms) */
  duration: number;
  /** Timestamp of render */
  timestamp: number;
  /** Which props changed (if tracking enabled) */
  changedProps?: string[];
  /** Memory usage before render */
  memoryBefore?: number;
  /** Memory usage after render */
  memoryAfter?: number;
}

export interface ComponentPerformanceResult {
  /** Total number of renders */
  renderCount: number;
  /** Average render time */
  averageRenderTime: number;
  /** Slowest render time */
  maxRenderTime: number;
  /** Fastest render time */
  minRenderTime: number;
  /** Last N render metrics */
  renderHistory: RenderMetric[];
  /** Props that change frequently */
  frequentChanges: Map<string, number>;
  /** Performance score (0-100) */
  score: number;
  /** Whether component has performance issues */
  hasIssues: boolean;
  /** List of detected issues */
  issues: string[];
}

// ========== CONSTANTS ==========

const DEFAULT_CONFIG: Required<Omit<ComponentPerformanceConfig, 'name'>> = {
  logRenders: import.meta.env.DEV,
  warnThreshold: 16, // 60fps = ~16ms per frame
  trackProps: true,
  trackMemory: true,
  maxSamples: 50,
};

// ========== HELPER FUNCTIONS ==========

function getChangedProps(
  prevProps: Record<string, unknown> | null,
  nextProps: Record<string, unknown>
): string[] {
  if (!prevProps) return [];
  
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(prevProps), ...Object.keys(nextProps)]);
  
  for (const key of allKeys) {
    if (prevProps[key] !== nextProps[key]) {
      changed.push(key);
    }
  }
  
  return changed;
}

function getMemoryUsage(): number | undefined {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
    return perf.memory?.usedJSHeapSize;
  }
  return undefined;
}

function calculateScore(metrics: RenderMetric[], renderCount: number): number {
  if (metrics.length === 0) return 100;
  
  let score = 100;
  
  // Penalize for slow renders
  const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
  if (avgDuration > 50) score -= 30;
  else if (avgDuration > 16) score -= 15;
  else if (avgDuration > 8) score -= 5;
  
  // Penalize for too many renders
  if (renderCount > 100) score -= 20;
  else if (renderCount > 50) score -= 10;
  else if (renderCount > 20) score -= 5;
  
  // Penalize for inconsistent render times
  const durations = metrics.map(m => m.duration);
  const maxDiff = Math.max(...durations) - Math.min(...durations);
  if (maxDiff > 100) score -= 15;
  else if (maxDiff > 50) score -= 8;
  
  return Math.max(0, score);
}

function detectIssues(
  metrics: RenderMetric[],
  renderCount: number,
  frequentChanges: Map<string, number>
): string[] {
  const issues: string[] = [];
  
  if (metrics.length === 0) return issues;
  
  const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
  
  if (avgDuration > 50) {
    issues.push('Average render time exceeds 50ms - consider optimization');
  }
  
  if (renderCount > 50 && metrics.length > 10) {
    issues.push('High render count detected - check for unnecessary re-renders');
  }
  
  for (const [prop, count] of frequentChanges) {
    if (count > renderCount * 0.8) {
      issues.push(`Prop "${prop}" changes on ${Math.round(count / renderCount * 100)}% of renders - consider memoization`);
    }
  }
  
  // Check for memory growth
  const memoryMetrics = metrics.filter(m => m.memoryBefore && m.memoryAfter);
  if (memoryMetrics.length > 5) {
    const firstMetric = memoryMetrics[0];
    const lastMetric = memoryMetrics[memoryMetrics.length - 1];
    if (firstMetric?.memoryBefore && lastMetric?.memoryAfter) {
      const growth = (lastMetric.memoryAfter - firstMetric.memoryBefore) / firstMetric.memoryBefore;
      if (growth > 0.5) {
        issues.push(`Memory usage grew by ${Math.round(growth * 100)}% - check for memory leaks`);
      }
    }
  }
  
  return issues;
}

// ========== MAIN HOOK ==========

/**
 * Hook to track component performance metrics
 * 
 * @example
 * ```tsx
 * function MyComponent({ data, onClick }) {
 *   const { markRenderStart, markRenderEnd, getPerformanceReport } = useComponentPerformance({
 *     name: 'MyComponent',
 *     warnThreshold: 16,
 *   });
 *   
 *   markRenderStart({ data, onClick });
 *   
 *   useEffect(() => {
 *     markRenderEnd();
 *   });
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useComponentPerformance(
  config: ComponentPerformanceConfig
): {
  markRenderStart: (props?: Record<string, unknown>) => void;
  markRenderEnd: () => void;
  getPerformanceReport: () => ComponentPerformanceResult;
  resetMetrics: () => void;
} {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const {
    name,
    logRenders,
    warnThreshold,
    trackProps,
    trackMemory,
    maxSamples,
  } = fullConfig;
  
  const renderStartTimeRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);
  const metricsRef = useRef<RenderMetric[]>([]);
  const prevPropsRef = useRef<Record<string, unknown> | null>(null);
  const frequentChangesRef = useRef<Map<string, number>>(new Map());
  
  // Track render start
  const markRenderStart = useCallback((props?: Record<string, unknown>) => {
    renderStartTimeRef.current = performance.now();
    
    // Track prop changes
    if (trackProps && props) {
      const changed = getChangedProps(prevPropsRef.current, props);
      
      for (const prop of changed) {
        frequentChangesRef.current.set(
          prop,
          (frequentChangesRef.current.get(prop) || 0) + 1
        );
      }
      
      prevPropsRef.current = { ...props };
    }
  }, [trackProps]);
  
  // Track render end
  const markRenderEnd = useCallback(() => {
    const duration = performance.now() - renderStartTimeRef.current;
    renderCountRef.current++;
    
    const metric: RenderMetric = {
      renderNumber: renderCountRef.current,
      duration,
      timestamp: Date.now(),
    };
    
    if (trackMemory) {
      metric.memoryBefore = getMemoryUsage();
      // Memory after will be captured in next render
      const lastMetric = metricsRef.current[metricsRef.current.length - 1];
      if (lastMetric) {
        lastMetric.memoryAfter = getMemoryUsage();
      }
    }
    
    // Track changed props
    if (trackProps && prevPropsRef.current) {
      const lastMetric = metricsRef.current[metricsRef.current.length - 1];
      const lastChanged = getChangedProps(
        lastMetric?.changedProps ? 
          Object.fromEntries(lastMetric.changedProps.map(p => [p, true])) : 
          null,
        prevPropsRef.current
      );
      metric.changedProps = lastChanged.length > 0 ? lastChanged : undefined;
    }
    
    metricsRef.current.push(metric);
    
    // Trim to max samples
    if (metricsRef.current.length > maxSamples) {
      metricsRef.current = metricsRef.current.slice(-maxSamples);
    }
    
    // Log in development
    if (logRenders) {
      logger.log(`[${name}] Render #${renderCountRef.current}: ${duration.toFixed(2)}ms`);
    }
    
    // Warn if slow
    if (duration > warnThreshold) {
      logger.warn(`[${name}] Slow render: ${duration.toFixed(2)}ms (threshold: ${warnThreshold}ms)`);
    }
  }, [name, logRenders, warnThreshold, trackProps, trackMemory, maxSamples]);
  
  // Get performance report
  const getPerformanceReport = useCallback((): ComponentPerformanceResult => {
    const metrics = metricsRef.current;
    const renderCount = renderCountRef.current;
    
    const durations = metrics.map(m => m.duration);
    const averageRenderTime = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    
    const score = calculateScore(metrics, renderCount);
    const issues = detectIssues(metrics, renderCount, frequentChangesRef.current);
    
    return {
      renderCount,
      averageRenderTime,
      maxRenderTime: durations.length > 0 ? Math.max(...durations) : 0,
      minRenderTime: durations.length > 0 ? Math.min(...durations) : 0,
      renderHistory: [...metrics],
      frequentChanges: new Map(frequentChangesRef.current),
      score,
      hasIssues: issues.length > 0,
      issues,
    };
  }, []);
  
  // Reset metrics
  const resetMetrics = useCallback(() => {
    metricsRef.current = [];
    renderCountRef.current = 0;
    prevPropsRef.current = null;
    frequentChangesRef.current = new Map();
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (logRenders && renderCountRef.current > 0) {
        const report = getPerformanceReport();
        logger.log(`[${name}] Component unmounted. Final stats:`, {
          renderCount: report.renderCount,
          averageRenderTime: `${report.averageRenderTime.toFixed(2)}ms`,
          score: report.score,
          issues: report.issues.length,
        });
      }
    };
  }, [name, logRenders, getPerformanceReport]);
  
  return {
    markRenderStart,
    markRenderEnd,
    getPerformanceReport,
    resetMetrics,
  };
}

// ========== WITH PERFORMANCE HOC ==========

/**
 * Higher-order component that adds performance tracking
 * 
 * @example
 * ```tsx
 * const TrackedComponent = withPerformance(MyComponent, 'MyComponent');
 * ```
 */
export function withPerformance<P extends object>(
  Component: React.ComponentType<P>,
  name: string,
  config?: Partial<ComponentPerformanceConfig>
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props: P) => {
    const { markRenderStart, markRenderEnd } = useComponentPerformance({
      name,
      ...config,
    });
    
    markRenderStart(props as Record<string, unknown>);
    
    useEffect(() => {
      markRenderEnd();
    });
    
    return <Component {...props} />;
  };
  
  WrappedComponent.displayName = `withPerformance(${name})`;
  
  return WrappedComponent;
}

export default useComponentPerformance;
