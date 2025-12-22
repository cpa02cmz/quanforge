/**
 * Performance Monitoring Service Module
 * Extracted from services/supabase.ts for better modularity
 * Provides comprehensive performance tracking and analysis capabilities
 */

import { PERFORMANCE_LIMITS, PERFORMANCE_PERCENTILES } from './config/constants';

/**
 * Basic performance monitor for tracking operation metrics
 * Tracks count, total time, and average time per operation
 */
export class PerformanceMonitor {
  private metrics: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();

  /**
   * Record an operation's performance
   * @param operation - Name of the operation being tracked
   * @param duration - Duration in milliseconds
   */
  record(operation: string, duration: number): void {
    const metric = this.metrics.get(operation) || { count: 0, totalTime: 0, avgTime: 0 };
    metric.count++;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.count;
    this.metrics.set(operation, metric);
  }

  /**
   * Get metrics for a specific operation
   * @param operation - Operation name
   * @returns Metrics object or null if not found
   */
  getMetrics(operation: string): { count: number; totalTime: number; avgTime: number } | undefined {
    return this.metrics.get(operation);
  }

  /**
   * Get all metrics for all operations
   * @returns Object with all metrics
   */
  getAllMetrics(): Record<string, { count: number; totalTime: number; avgTime: number }> {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * Log performance metrics to console in development
   */
  logMetrics(): void {
    const allMetrics = this.getAllMetrics();
    if (Object.keys(allMetrics).length === 0) {
      console.log('No performance metrics recorded');
      return;
    }

    console.group('Database Performance Metrics');
    for (const [operation, metric] of Object.entries(allMetrics)) {
      console.log(`${operation}: ${metric.count} calls, avg: ${metric.avgTime.toFixed(2)}ms, total: ${metric.totalTime.toFixed(2)}ms`);
    }
    console.groupEnd();
  }

  /**
   * Get operations sorted by total time (most expensive first)
   * @param limit - Maximum number of operations to return
   * @returns Array of sorted operations
   */
  getSlowestOperations(limit: number = 10): Array<{ operation: string; totalTime: number; count: number; avgTime: number }> {
    const all = Object.entries(this.getAllMetrics());
    return all
      .map(([operation, metrics]) => ({ operation, ...metrics }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, limit);
  }

  /**
   * Get operations sorted by call count (most frequent first)
   * @param limit - Maximum number of operations to return
   * @returns Array of sorted operations
   */
  getMostFrequentOperations(limit: number = 10): Array<{ operation: string; count: number; totalTime: number; avgTime: number }> {
    const all = Object.entries(this.getAllMetrics());
    return all
      .map(([operation, metrics]) => ({ operation, ...metrics }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

/**
 * Enhanced performance tracker with edge metrics and percentiles
 * Tracks detailed performance statistics with historical data
 */
export class EdgePerformanceTracker {
  private metrics: Map<string, number[]> = new Map();
  
  /**
   * Record a metric value for an operation
   * @param operation - Operation name
   * @param value - Value to record (typically duration in ms)
   */
  recordMetric(operation: string, value: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    const values = this.metrics.get(operation)!;
    values.push(value);
    
    // Keep only last configured number of values to manage memory
    if (values.length > PERFORMANCE_LIMITS.METRICS_HISTORY_SIZE) {
      values.splice(0, values.length - PERFORMANCE_LIMITS.METRICS_HISTORY_SIZE);
    }
  }
  
  /**
   * Get average value for an operation
   * @param operation - Operation name
   * @returns Average value or 0 if no data
   */
  getAverage(operation: string): number {
    const values = this.metrics.get(operation) || [];
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }
  
  /**
   * Get percentile value for an operation
   * @param operation - Operation name
   * @param percentile - Percentile to calculate (0-100)
   * @returns Percentile value or 0 if no data
   */
  getPercentile(operation: string, percentile: number): number {
    const values = this.metrics.get(operation) || [];
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * (percentile / 100));
    return sorted[Math.min(index, sorted.length - 1)] || 0;
  }

  /**
   * Get minimum value for an operation
   * @param operation - Operation name
   * @returns Minimum value or 0 if no data
   */
  getMin(operation: string): number {
    const values = this.metrics.get(operation) || [];
    return values.length > 0 ? Math.min(...values) : 0;
  }

  /**
   * Get maximum value for an operation
   * @param operation - Operation name  
   * @returns Maximum value or 0 if no data
   */
  getMax(operation: string): number {
    const values = this.metrics.get(operation) || [];
    return values.length > 0 ? Math.max(...values) : 0;
  }
  
  /**
   * Get comprehensive metrics for all operations
   * @returns Object with aggregated statistics
   */
  getAllMetrics(): Record<string, { avg: number; min: number; max: number; p50: number; p95: number; p99: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; p50: number; p95: number; p99: number; count: number }> = {};
    
    for (const [operation] of this.metrics) {
      result[operation] = {
        avg: this.getAverage(operation),
        min: this.getMin(operation),
        max: this.getMax(operation),
        p50: this.getPercentile(operation, PERFORMANCE_PERCENTILES.P50),
        p95: this.getPercentile(operation, PERFORMANCE_PERCENTILES.P95),
        p99: this.getPercentile(operation, PERFORMANCE_PERCENTILES.P99),
        count: this.metrics.get(operation)!.length,
      };
    }
    
    return result;
  }

  /**
   * Clear metrics for a specific operation or all operations
   * @param operation - Optional operation name. If not provided, clears all metrics.
   */
  clear(operation?: string): void {
    if (operation) {
      this.metrics.delete(operation);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Get all operations being tracked
   * @returns Array of operation names
   */
  getTrackedOperations(): string[] {
    return Array.from(this.metrics.keys());
  }
}

/**
 * Performance utilities and helpers
 */
export const PerformanceUtils = {
  /**
   * Measure execution time of a function
   * @param fn - Function to measure
   * @param operationName - Name for the operation
   * @param monitor - PerformanceMonitor instance
   * @returns Function result
   */
  async measureAsync<T>(
    fn: () => Promise<T>,
    operationName: string,
    monitor: PerformanceMonitor
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      monitor.record(operationName, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      monitor.record(`${operationName}_error`, duration);
      throw error;
    }
  },

  /**
   * Measure execution time of a synchronous function
   * @param fn - Function to measure
   * @param operationName - Name for the operation
   * @param monitor - PerformanceMonitor instance
   * @returns Function result
   */
  measure<T>(
    fn: () => T,
    operationName: string,
    monitor: PerformanceMonitor
  ): T {
    const startTime = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      monitor.record(operationName, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      monitor.record(`${operationName}_error`, duration);
      throw error;
    }
  },

  /**
   * Create a simple performance decorator
   * @param monitor - PerformanceMonitor instance
   * @returns Decorator function
   */
  withPerformanceTracking<T extends (...args: any[]) => any>(
    monitor: PerformanceMonitor
  ) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      const operationName = `${target.constructor.name}.${propertyKey}`;

      descriptor.value = function(...args: any[]) {
        const startTime = performance.now();
        try {
          const result = originalMethod.apply(this, args);
          const duration = performance.now() - startTime;
          monitor.record(operationName, duration);
          return result;
        } catch (error) {
          const duration = performance.now() - startTime;
          monitor.record(`${operationName}_error`, duration);
          throw error;
        }
      };

      return descriptor;
    };
  }
};

// Default instances for common usage
export const defaultPerformanceMonitor = new PerformanceMonitor();
export const defaultEdgePerformanceTracker = new EdgePerformanceTracker();

// Performance tracking wrapper for database operations
export const trackPerformance = <T>(
  operation: string,
  fn: () => Promise<T>,
  monitor: PerformanceMonitor = defaultPerformanceMonitor,
  edgeTracker: EdgePerformanceTracker = defaultEdgePerformanceTracker
): Promise<T> => {
  return PerformanceUtils.measureAsync(fn, operation, monitor).then(result => {
    const duration = monitor.getMetrics(operation)?.avgTime || 0;
    edgeTracker.recordMetric(operation, duration);
    return result;
  });
};

export default {
  PerformanceMonitor,
  EdgePerformanceTracker,
  PerformanceUtils,
  defaultPerformanceMonitor,
  defaultEdgePerformanceTracker,
  trackPerformance
};