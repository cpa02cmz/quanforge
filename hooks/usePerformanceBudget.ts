/**
 * Performance Budget Monitor Hook
 * 
 * Monitors application performance against defined budgets.
 * Provides real-time alerts when budgets are exceeded.
 * 
 * Features:
 * - Bundle size monitoring
 * - JavaScript heap size tracking
 * - Network request timing
 * - Custom metric budgets
 * - Alert system for budget violations
 * - Performance scoring
 * 
 * @module hooks/usePerformanceBudget
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('performance-budget');

// ========== TYPES ==========

export interface PerformanceBudget {
  /** Budget name/identifier */
  name: string;
  /** Maximum allowed value */
  max: number;
  /** Unit of measurement */
  unit: 'ms' | 'KB' | 'MB' | 'count' | 'percent';
  /** Budget category */
  category: 'timing' | 'memory' | 'network' | 'bundle' | 'custom';
  /** Severity when exceeded */
  severity: 'warning' | 'error' | 'critical';
  /** Description of what this budget measures */
  description?: string;
}

export interface MetricValue {
  /** Current measured value */
  value: number;
  /** Unit of measurement */
  unit: PerformanceBudget['unit'];
  /** When this measurement was taken */
  timestamp: number;
  /** Whether this exceeds the budget */
  exceeded: boolean;
  /** Budget that was exceeded (if any) */
  budget?: PerformanceBudget;
}

export interface BudgetViolation {
  /** Budget that was violated */
  budget: PerformanceBudget;
  /** Actual value measured */
  actualValue: number;
  /** How much over budget (percentage) */
  overagePercent: number;
  /** When the violation occurred */
  timestamp: number;
  /** Severity of violation */
  severity: PerformanceBudget['severity'];
}

export interface PerformanceScore {
  /** Overall score (0-100) */
  overall: number;
  /** Category scores */
  categories: {
    timing: number;
    memory: number;
    network: number;
    bundle: number;
    custom: number;
  };
  /** Number of violated budgets */
  violations: number;
  /** Number of passed budgets */
  passed: number;
}

export interface PerformanceBudgetConfig {
  /** Budgets to monitor */
  budgets: PerformanceBudget[];
  /** How often to check budgets (ms) */
  checkInterval?: number;
  /** Whether to log violations */
  logViolations?: boolean;
  /** Callback when budget is violated */
  onViolation?: (violation: BudgetViolation) => void;
  /** Callback when score changes */
  onScoreChange?: (score: PerformanceScore) => void;
}

export interface PerformanceBudgetState {
  /** Current metric values */
  metrics: Map<string, MetricValue>;
  /** Active violations */
  violations: BudgetViolation[];
  /** Current performance score */
  score: PerformanceScore;
  /** Whether monitoring is active */
  isMonitoring: boolean;
  /** Last check timestamp */
  lastCheck: number | null;
}

// ========== DEFAULT BUDGETS ==========

const DEFAULT_BUDGETS: PerformanceBudget[] = [
  // Timing budgets
  {
    name: 'first-contentful-paint',
    max: 1800,
    unit: 'ms',
    category: 'timing',
    severity: 'warning',
    description: 'First Contentful Paint should be under 1.8s',
  },
  {
    name: 'largest-contentful-paint',
    max: 2500,
    unit: 'ms',
    category: 'timing',
    severity: 'error',
    description: 'Largest Contentful Paint should be under 2.5s',
  },
  {
    name: 'time-to-interactive',
    max: 3800,
    unit: 'ms',
    category: 'timing',
    severity: 'warning',
    description: 'Time to Interactive should be under 3.8s',
  },
  {
    name: 'total-blocking-time',
    max: 200,
    unit: 'ms',
    category: 'timing',
    severity: 'warning',
    description: 'Total Blocking Time should be under 200ms',
  },
  {
    name: 'cumulative-layout-shift',
    max: 0.1,
    unit: 'count',
    category: 'timing',
    severity: 'warning',
    description: 'Cumulative Layout Shift should be under 0.1',
  },
  // Memory budgets
  {
    name: 'js-heap-size',
    max: 100,
    unit: 'MB',
    category: 'memory',
    severity: 'warning',
    description: 'JavaScript heap size should be under 100MB',
  },
  {
    name: 'dom-nodes',
    max: 1500,
    unit: 'count',
    category: 'memory',
    severity: 'warning',
    description: 'DOM nodes should be under 1500',
  },
  // Network budgets
  {
    name: 'total-resource-size',
    max: 2000,
    unit: 'KB',
    category: 'network',
    severity: 'warning',
    description: 'Total resource size should be under 2MB',
  },
  {
    name: 'javascript-size',
    max: 500,
    unit: 'KB',
    category: 'bundle',
    severity: 'warning',
    description: 'JavaScript bundle size should be under 500KB',
  },
  {
    name: 'request-count',
    max: 50,
    unit: 'count',
    category: 'network',
    severity: 'warning',
    description: 'Total requests should be under 50',
  },
];

// ========== HELPER FUNCTIONS ==========

/**
 * Get Performance API memory info
 */
function getMemoryInfo(): { usedJSHeapSize: number; jsHeapSizeLimit: number } | null {
  const perfWithMemory = performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  };
  
  if (perfWithMemory.memory) {
    return {
      usedJSHeapSize: perfWithMemory.memory.usedJSHeapSize,
      jsHeapSizeLimit: perfWithMemory.memory.jsHeapSizeLimit,
    };
  }
  return null;
}

/**
 * Get navigation timing metrics
 */
function getNavigationTimingMetrics(): Record<string, number> {
  const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (!timing) return {};

  return {
    'first-contentful-paint': timing.domContentLoadedEventEnd - timing.fetchStart,
    'time-to-interactive': timing.loadEventEnd - timing.fetchStart,
    'domContentLoaded': timing.domContentLoadedEventEnd - timing.fetchStart,
    'loadComplete': timing.loadEventEnd - timing.fetchStart,
  };
}

/**
 * Get resource timing metrics
 */
function getResourceTimingMetrics(): { totalSize: number; jsSize: number; count: number } {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  
  let totalSize = 0;
  let jsSize = 0;
  
  resources.forEach((resource) => {
    const size = resource.transferSize || resource.encodedBodySize || 0;
    totalSize += size;
    
    if (resource.initiatorType === 'script') {
      jsSize += size;
    }
  });

  return {
    totalSize: Math.round(totalSize / 1024), // KB
    jsSize: Math.round(jsSize / 1024), // KB
    count: resources.length,
  };
}

/**
 * Get largest contentful paint
 */
function getLCP(): number | null {
  const entries = performance.getEntriesByType('largest-contentful-paint');
  if (entries.length > 0) {
    return (entries[entries.length - 1] as LargestContentfulPaint).startTime;
  }
  return null;
}

/**
 * Get cumulative layout shift
 */
function getCLS(): number {
  const entries = performance.getEntriesByType('layout-shift');
  let cls = 0;
  
  entries.forEach((entry) => {
    if (!(entry as LayoutShift).hadRecentInput) {
      cls += (entry as LayoutShift).value;
    }
  });
  
  return cls;
}

/**
 * Get total blocking time (approximation)
 */
function getTBT(): number {
  const longTasks = performance.getEntriesByType('longtask');
  let tbt = 0;
  
  longTasks.forEach((task) => {
    const duration = task.duration;
    const blockingTime = duration - 50; // Tasks over 50ms are blocking
    if (blockingTime > 0) {
      tbt += blockingTime;
    }
  });
  
  return tbt;
}

// ========== MAIN HOOK ==========

/**
 * Hook to monitor performance budgets
 * 
 * @param config - Budget configuration
 * @returns Performance budget state and control functions
 * 
 * @example
 * const { violations, score, isMonitoring } = usePerformanceBudget({
 *   budgets: [
 *     { name: 'js-bundle', max: 300, unit: 'KB', category: 'bundle', severity: 'warning' }
 *   ],
 *   onViolation: (violation) => {
 *     console.warn(`Budget violated: ${violation.budget.name}`);
 *   }
 * });
 */
export function usePerformanceBudget(config?: PerformanceBudgetConfig): {
  metrics: Map<string, MetricValue>;
  violations: BudgetViolation[];
  score: PerformanceScore;
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  checkNow: () => void;
  getMetric: (name: string) => MetricValue | undefined;
  addViolationCallback: (callback: (violation: BudgetViolation) => void) => void;
} {
  const {
    budgets = DEFAULT_BUDGETS,
    checkInterval = 30000, // 30 seconds
    logViolations = true,
    onViolation,
    onScoreChange,
  } = config || {};

  const [state, setState] = useState<PerformanceBudgetState>({
    metrics: new Map(),
    violations: [],
    score: {
      overall: 100,
      categories: {
        timing: 100,
        memory: 100,
        network: 100,
        bundle: 100,
        custom: 100,
      },
      violations: 0,
      passed: 0,
    },
    isMonitoring: false,
    lastCheck: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const violationCallbacksRef = useRef<((violation: BudgetViolation) => void)[]>([]);
  const mountedRef = useRef(true);

  /**
   * Calculate performance score
   */
  const calculateScore = useCallback((metrics: Map<string, MetricValue>): PerformanceScore => {
    const categoryScores: PerformanceScore['categories'] = {
      timing: 100,
      memory: 100,
      network: 100,
      bundle: 100,
      custom: 100,
    };

    const categoryCounts: Record<string, { total: number; passed: number }> = {};

    budgets.forEach((budget) => {
      const metric = metrics.get(budget.name);
      const category = budget.category;

      if (!categoryCounts[category]) {
        categoryCounts[category] = { total: 0, passed: 0 };
      }
      categoryCounts[category].total++;

      if (metric && !metric.exceeded) {
        categoryCounts[category].passed++;
      }
    });

    // Calculate category scores
    Object.entries(categoryCounts).forEach(([category, counts]) => {
      if (counts.total > 0) {
        categoryScores[category as keyof typeof categoryScores] = 
          Math.round((counts.passed / counts.total) * 100);
      }
    });

    // Calculate overall score
    const categoryValues = Object.values(categoryScores);
    const overall = Math.round(
      categoryValues.reduce((sum, score) => sum + score, 0) / categoryValues.length
    );

    // Count violations and passes
    let violations = 0;
    let passed = 0;
    metrics.forEach((metric) => {
      if (metric.exceeded) {
        violations++;
      } else {
        passed++;
      }
    });

    return {
      overall,
      categories: categoryScores,
      violations,
      passed,
    };
  }, [budgets]);

  /**
   * Check budgets against current metrics
   */
  const checkBudgets = useCallback(() => {
    if (typeof window === 'undefined' || !mountedRef.current) return;

    const newMetrics = new Map<string, MetricValue>();
    const newViolations: BudgetViolation[] = [];

    // Collect metrics
    const navTiming = getNavigationTimingMetrics();
    const resourceMetrics = getResourceTimingMetrics();
    const memoryInfo = getMemoryInfo();
    const lcp = getLCP();
    const cls = getCLS();
    const tbt = getTBT();

    // Add timing metrics
    Object.entries(navTiming).forEach(([name, value]) => {
      newMetrics.set(name, {
        value,
        unit: 'ms',
        timestamp: Date.now(),
        exceeded: false,
      });
    });

    // Add LCP
    if (lcp !== null) {
      newMetrics.set('largest-contentful-paint', {
        value: lcp,
        unit: 'ms',
        timestamp: Date.now(),
        exceeded: false,
      });
    }

    // Add CLS
    newMetrics.set('cumulative-layout-shift', {
      value: cls,
      unit: 'count',
      timestamp: Date.now(),
      exceeded: false,
    });

    // Add TBT
    newMetrics.set('total-blocking-time', {
      value: tbt,
      unit: 'ms',
      timestamp: Date.now(),
      exceeded: false,
    });

    // Add memory metrics
    if (memoryInfo) {
      newMetrics.set('js-heap-size', {
        value: Math.round(memoryInfo.usedJSHeapSize / (1024 * 1024)), // MB
        unit: 'MB',
        timestamp: Date.now(),
        exceeded: false,
      });
    }

    // Add DOM node count
    const domNodes = document.getElementsByTagName('*').length;
    newMetrics.set('dom-nodes', {
      value: domNodes,
      unit: 'count',
      timestamp: Date.now(),
      exceeded: false,
    });

    // Add resource metrics
    newMetrics.set('total-resource-size', {
      value: resourceMetrics.totalSize,
      unit: 'KB',
      timestamp: Date.now(),
      exceeded: false,
    });

    newMetrics.set('javascript-size', {
      value: resourceMetrics.jsSize,
      unit: 'KB',
      timestamp: Date.now(),
      exceeded: false,
    });

    newMetrics.set('request-count', {
      value: resourceMetrics.count,
      unit: 'count',
      timestamp: Date.now(),
      exceeded: false,
    });

    // Check budgets
    budgets.forEach((budget) => {
      const metric = newMetrics.get(budget.name);
      if (metric) {
        const exceeded = metric.value > budget.max;
        metric.exceeded = exceeded;
        metric.budget = budget;

        if (exceeded) {
          const overagePercent = ((metric.value - budget.max) / budget.max) * 100;
          const violation: BudgetViolation = {
            budget,
            actualValue: metric.value,
            overagePercent,
            timestamp: Date.now(),
            severity: budget.severity,
          };

          newViolations.push(violation);

          if (logViolations) {
            const logMethod = budget.severity === 'critical' ? 'error' : 
                             budget.severity === 'error' ? 'error' : 'warn';
            logger[logMethod](
              `Budget violation: ${budget.name} = ${metric.value}${metric.unit} ` +
              `(max: ${budget.max}${budget.unit}, ${overagePercent.toFixed(1)}% over)`
            );
          }

          // Call violation callbacks
          onViolation?.(violation);
          violationCallbacksRef.current.forEach((cb) => cb(violation));
        }
      }
    });

    // Calculate score
    const score = calculateScore(newMetrics);
    onScoreChange?.(score);

    // Update state
    setState((prev) => ({
      ...prev,
      metrics: newMetrics,
      violations: [...prev.violations, ...newViolations].slice(-100), // Keep last 100
      score,
      lastCheck: Date.now(),
    }));
  }, [budgets, logViolations, onViolation, onScoreChange, calculateScore]);

  /**
   * Start monitoring
   */
  const startMonitoring = useCallback(() => {
    if (intervalRef.current) return;

    // Initial check
    checkBudgets();

    // Set up interval
    intervalRef.current = setInterval(checkBudgets, checkInterval);

    setState((prev) => ({ ...prev, isMonitoring: true }));
    logger.info('Performance budget monitoring started');
  }, [checkBudgets, checkInterval]);

  /**
   * Stop monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setState((prev) => ({ ...prev, isMonitoring: false }));
    logger.info('Performance budget monitoring stopped');
  }, []);

  /**
   * Check budgets immediately
   */
  const checkNow = useCallback(() => {
    checkBudgets();
  }, [checkBudgets]);

  /**
   * Get a specific metric
   */
  const getMetric = useCallback((name: string): MetricValue | undefined => {
    return state.metrics.get(name);
  }, [state.metrics]);

  /**
   * Add a violation callback
   */
  const addViolationCallback = useCallback((callback: (violation: BudgetViolation) => void) => {
    violationCallbacksRef.current.push(callback);
  }, []);

  // Auto-start monitoring on mount
  useEffect(() => {
    mountedRef.current = true;
    startMonitoring();

    return () => {
      mountedRef.current = false;
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring]);

  return {
    metrics: state.metrics,
    violations: state.violations,
    score: state.score,
    isMonitoring: state.isMonitoring,
    startMonitoring,
    stopMonitoring,
    checkNow,
    getMetric,
    addViolationCallback,
  };
}

/**
 * Simplified hook that only returns the current performance score
 */
export function usePerformanceScore(): number {
  const { score } = usePerformanceBudget();
  return score.overall;
}

/**
 * Hook that returns true if any budget is violated
 */
export function useHasBudgetViolations(): boolean {
  const { violations } = usePerformanceBudget();
  return violations.length > 0;
}

export default usePerformanceBudget;
