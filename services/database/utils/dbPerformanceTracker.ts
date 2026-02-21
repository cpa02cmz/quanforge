/**
 * Database Performance Tracker
 * 
 * Tracks database query performance metrics and provides
 * insights for optimization opportunities.
 * 
 * Features:
 * - Query execution time tracking
 * - Slow query detection and logging
 * - Performance statistics aggregation
 * - Memory-efficient circular buffer for metrics
 * 
 * @module services/database/utils/dbPerformanceTracker
 */

import { createScopedLogger } from '../../../utils/logger';

const logger = createScopedLogger('db-performance-tracker');

/**
 * Query performance metrics
 */
export interface QueryMetrics {
  /** Query identifier (table/operation) */
  queryId: string;
  /** Query type (SELECT, INSERT, UPDATE, DELETE) */
  operation: string;
  /** Table name */
  tableName: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Timestamp of the query */
  timestamp: number;
  /** Whether the query was successful */
  success: boolean;
  /** Error message if failed */
  errorMessage?: string;
  /** Number of rows affected/returned */
  rowCount?: number;
}

/**
 * Performance statistics for a query
 */
export interface QueryStats {
  queryId: string;
  tableName: string;
  operation: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  p50ExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  totalRowsAffected: number;
  lastExecuted: number;
  errorRate: number;
}

/**
 * Performance tracker configuration
 */
export interface PerformanceTrackerConfig {
  /** Enable performance tracking */
  enabled: boolean;
  /** Slow query threshold in milliseconds */
  slowQueryThreshold: number;
  /** Maximum number of metrics to keep in memory */
  maxMetricsHistory: number;
  /** Log slow queries */
  logSlowQueries: boolean;
  /** Log all queries (verbose mode) */
  logAllQueries: boolean;
}

const DEFAULT_CONFIG: PerformanceTrackerConfig = {
  enabled: true,
  slowQueryThreshold: 1000, // 1 second
  maxMetricsHistory: 1000,
  logSlowQueries: true,
  logAllQueries: false
};

/**
 * Database Performance Tracker
 */
export class DatabasePerformanceTracker {
  private metrics: QueryMetrics[] = [];
  private config: PerformanceTrackerConfig;
  private queryIndex: Map<string, number[]> = new Map(); // queryId -> indices in metrics array
  
  constructor(config: Partial<PerformanceTrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Track a database query execution
   */
  trackQuery(
    queryId: string,
    operation: string,
    tableName: string,
    executionTime: number,
    success: boolean,
    rowCount?: number,
    errorMessage?: string
  ): void {
    if (!this.config.enabled) return;

    const metric: QueryMetrics = {
      queryId,
      operation: operation.toUpperCase(),
      tableName,
      executionTime,
      timestamp: Date.now(),
      success,
      rowCount,
      errorMessage
    };

    this.addMetric(metric);
    this.logIfNeeded(metric);
  }

  /**
   * Track a query using a wrapper function
   */
  async trackQueryExecution<T>(
    queryId: string,
    operation: string,
    tableName: string,
    queryFn: () => Promise<{ data: T; rowCount?: number }>
  ): Promise<T> {
    const startTime = performance.now();
    let success = false;
    let rowCount: number | undefined;
    let errorMessage: string | undefined;
    let data: T;

    try {
      const result = await queryFn();
      data = result.data;
      rowCount = result.rowCount;
      success = true;
      return data;
    } catch (error: unknown) {
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const executionTime = performance.now() - startTime;
      this.trackQuery(queryId, operation, tableName, executionTime, success, rowCount, errorMessage);
    }
  }

  /**
   * Add metric to the circular buffer
   */
  private addMetric(metric: QueryMetrics): void {
    // Add to metrics array
    this.metrics.push(metric);

    // Update index
    const indices = this.queryIndex.get(metric.queryId) || [];
    indices.push(this.metrics.length - 1);
    this.queryIndex.set(metric.queryId, indices);

    // Trim if exceeding max size
    if (this.metrics.length > this.config.maxMetricsHistory) {
      const removed = this.metrics.shift();
      if (removed) {
        // Update indices
        for (const [queryId, idxs] of this.queryIndex.entries()) {
          const newIndices = idxs
            .map(idx => idx - 1)
            .filter(idx => idx >= 0);
          if (newIndices.length === 0) {
            this.queryIndex.delete(queryId);
          } else {
            this.queryIndex.set(queryId, newIndices);
          }
        }
      }
    }
  }

  /**
   * Log query if configured
   */
  private logIfNeeded(metric: QueryMetrics): void {
    if (this.config.logAllQueries) {
      logger.debug(
        `Query ${metric.queryId}: ${metric.executionTime.toFixed(2)}ms ` +
        `(${metric.operation} on ${metric.tableName})`
      );
    }

    if (this.config.logSlowQueries && metric.executionTime > this.config.slowQueryThreshold) {
      logger.warn(
        `Slow query detected: ${metric.queryId} took ${metric.executionTime.toFixed(2)}ms ` +
        `(threshold: ${this.config.slowQueryThreshold}ms)`,
        { tableName: metric.tableName, operation: metric.operation }
      );
    }

    if (!metric.success) {
      logger.error(
        `Query failed: ${metric.queryId}`,
        { error: metric.errorMessage, tableName: metric.tableName }
      );
    }
  }

  /**
   * Get statistics for a specific query
   */
  getQueryStats(queryId: string): QueryStats | null {
    const indices = this.queryIndex.get(queryId);
    if (!indices || indices.length === 0) return null;

    const queryMetrics = indices
      .map(idx => this.metrics[idx])
      .filter(Boolean);

    if (queryMetrics.length === 0) return null;

    const executionTimes = queryMetrics.map(m => m.executionTime).sort((a, b) => a - b);
    const first = queryMetrics[0];

    return {
      queryId,
      tableName: first.tableName,
      operation: first.operation,
      totalExecutions: queryMetrics.length,
      successfulExecutions: queryMetrics.filter(m => m.success).length,
      failedExecutions: queryMetrics.filter(m => !m.success).length,
      averageExecutionTime: this.calculateAverage(executionTimes),
      minExecutionTime: executionTimes[0],
      maxExecutionTime: executionTimes[executionTimes.length - 1],
      p50ExecutionTime: this.calculatePercentile(executionTimes, 50),
      p95ExecutionTime: this.calculatePercentile(executionTimes, 95),
      p99ExecutionTime: this.calculatePercentile(executionTimes, 99),
      totalRowsAffected: queryMetrics.reduce((sum, m) => sum + (m.rowCount || 0), 0),
      lastExecuted: Math.max(...queryMetrics.map(m => m.timestamp)),
      errorRate: queryMetrics.filter(m => !m.success).length / queryMetrics.length
    };
  }

  /**
   * Get statistics for all queries
   */
  getAllQueryStats(): QueryStats[] {
    const stats: QueryStats[] = [];
    for (const queryId of this.queryIndex.keys()) {
      const stat = this.getQueryStats(queryId);
      if (stat) stats.push(stat);
    }
    return stats;
  }

  /**
   * Get slow queries (queries exceeding threshold)
   */
  getSlowQueries(threshold?: number): QueryMetrics[] {
    const slowThreshold = threshold || this.config.slowQueryThreshold;
    return this.metrics.filter(m => m.executionTime > slowThreshold);
  }

  /**
   * Get failed queries
   */
  getFailedQueries(): QueryMetrics[] {
    return this.metrics.filter(m => !m.success);
  }

  /**
   * Get queries by table name
   */
  getQueriesByTable(tableName: string): QueryMetrics[] {
    return this.metrics.filter(m => m.tableName === tableName);
  }

  /**
   * Get overall performance summary
   */
  getPerformanceSummary(): {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    averageExecutionTime: number;
    slowQueryCount: number;
    errorRate: number;
    mostFrequentQueries: Array<{ queryId: string; count: number }>;
    slowestQueries: Array<{ queryId: string; avgTime: number }>;
  } {
    const totalQueries = this.metrics.length;
    const successfulQueries = this.metrics.filter(m => m.success).length;
    const failedQueries = totalQueries - successfulQueries;
    const slowQueryCount = this.getSlowQueries().length;
    
    const allTimes = this.metrics.map(m => m.executionTime);
    const averageExecutionTime = this.calculateAverage(allTimes);
    
    // Get most frequent queries
    const frequencyMap = new Map<string, number>();
    for (const metric of this.metrics) {
      frequencyMap.set(metric.queryId, (frequencyMap.get(metric.queryId) || 0) + 1);
    }
    const mostFrequentQueries = Array.from(frequencyMap.entries())
      .map(([queryId, count]) => ({ queryId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get slowest queries
    const avgTimeMap = new Map<string, number[]>();
    for (const metric of this.metrics) {
      const times = avgTimeMap.get(metric.queryId) || [];
      times.push(metric.executionTime);
      avgTimeMap.set(metric.queryId, times);
    }
    const slowestQueries = Array.from(avgTimeMap.entries())
      .map(([queryId, times]) => ({ queryId, avgTime: this.calculateAverage(times) }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      averageExecutionTime,
      slowQueryCount,
      errorRate: totalQueries > 0 ? failedQueries / totalQueries : 0,
      mostFrequentQueries,
      slowestQueries
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.queryIndex.clear();
    logger.info('Performance metrics cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PerformanceTrackerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }
}

// Export singleton instance
export const dbPerformanceTracker = new DatabasePerformanceTracker();

/**
 * Decorator for tracking query performance
 */
export function trackQuery(queryId: string, operation: string, tableName: string) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<unknown>>
  ) {
    const originalMethod = descriptor.value;
    
    if (!originalMethod) return descriptor;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      return dbPerformanceTracker.trackQueryExecution(
        queryId,
        operation,
        tableName,
        async () => {
          const result = await originalMethod.apply(this, args);
          return { data: result, rowCount: undefined };
        }
      );
    };

    return descriptor;
  };
}
