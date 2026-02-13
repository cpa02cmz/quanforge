import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('AnalyticsCollector');
/**
 * Database Analytics Collector
 * Handles performance monitoring, metrics collection, and analytics for database operations
 */

// import { handleError } from '../../utils/errorHandler';
import { TIME_CONSTANTS } from '../../constants/config';

interface OperationMetrics {
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  errors: number;
  lastError?: string;
  lastOperation?: number;
}

interface SystemMetrics {
  totalOperations: number;
  totalErrors: number;
  averageResponseTime: number;
  operationsPerSecond: number;
  errorRate: number;
  uptime: number;
}

export interface AnalyticsCollectorInterface {
  recordOperation(operation: string, duration: number, error?: Error | unknown): void;
  getMetrics(operation?: string): OperationMetrics | Record<string, OperationMetrics>;
  getSystemMetrics(): SystemMetrics;
  resetMetrics(): void;
  getPerformanceReport(): string;
  startPerformanceTimer(): () => number;
}

export class AnalyticsCollector implements AnalyticsCollectorInterface {
  private operations: Map<string, OperationMetrics> = new Map();
  private startTime: number = Date.now();
  private operationCounts: Map<string, number[]> = new Map(); // For rolling window calculations

  recordOperation(operation: string, duration: number, error?: Error | unknown): void {
    try {
      // Initialize operation metrics if not exists
      if (!this.operations.has(operation)) {
        this.operations.set(operation, {
          count: 0,
          totalDuration: 0,
          averageDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          errors: 0,
          lastOperation: undefined
        });
      }

      const metrics = this.operations.get(operation)!;
      
      // Update basic metrics
      metrics.count++;
      metrics.totalDuration += duration;
      metrics.averageDuration = metrics.totalDuration / metrics.count;
      metrics.minDuration = Math.min(metrics.minDuration, duration);
      metrics.maxDuration = Math.max(metrics.maxDuration, duration);
      metrics.lastOperation = Date.now();

      // Update rolling window for operations per second calculation
      if (!this.operationCounts.has(operation)) {
        this.operationCounts.set(operation, []);
      }
      const timestamps = this.operationCounts.get(operation)!;
      timestamps.push(Date.now());
      
      // Keep only last minute of operations for rate calculation
      const oneMinuteAgo = Date.now() - TIME_CONSTANTS.MINUTE;
      while (timestamps.length > 0 && timestamps[0] && timestamps[0] < oneMinuteAgo) {
        timestamps.shift();
      }

      // Track errors
      if (error) {
        metrics.errors++;
        metrics.lastError = error.message || String(error);
      }
    } catch (e) {
      // Don't let analytics failures break the main flow
      logger.warn('Failed to record operation metrics:', e);
    }
  }

  getMetrics(operation?: string): OperationMetrics | Record<string, OperationMetrics> {
    if (operation) {
      return this.operations.get(operation) || {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        errors: 0
      };
    }

    const allMetrics: Record<string, OperationMetrics> = {};
    for (const [op, metrics] of this.operations.entries()) {
      allMetrics[op] = { ...metrics };
    }
    return allMetrics;
  }

  getSystemMetrics(): SystemMetrics {
    let totalOperations = 0;
    let totalErrors = 0;
    let totalDuration = 0;
    let totalWeightedDuration = 0;
    let recentOperations = 0;

    const now = Date.now();
    const oneMinuteAgo = now - TIME_CONSTANTS.MINUTE;

    for (const [operation, metrics] of this.operations.entries()) {
      totalOperations += metrics.count;
      totalErrors += metrics.errors;
      totalDuration += metrics.totalDuration;
      // Using totalDuration for logging purposes only
      void totalDuration;
      
      // Calculate weighted average for response time
      if (metrics.count > 0) {
        totalWeightedDuration += metrics.averageDuration * metrics.count;
      }

      // Count recent operations for rate calculation
      const timestamps = this.operationCounts.get(operation) || [];
      recentOperations += timestamps.filter(timestamp => timestamp >= oneMinuteAgo).length;
    }

    const averageResponseTime = totalOperations > 0 ? totalWeightedDuration / totalOperations : 0;
    const operationsPerSecond = recentOperations / 60; // Rate per second over last minute
    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;
    const uptime = now - this.startTime;

    return {
      totalOperations,
      totalErrors,
      averageResponseTime,
      operationsPerSecond,
      errorRate,
      uptime
    };
  }

  resetMetrics(): void {
    this.operations.clear();
    this.operationCounts.clear();
    this.startTime = Date.now();
  }

  getPerformanceReport(): string {
    const systemMetrics = this.getSystemMetrics();
    const allMetrics = this.getMetrics();
    
    const report = [
      '=== Database Performance Report ===',
      '',
      'System Overview:',
      `  Total Operations: ${systemMetrics.totalOperations.toLocaleString()}`,
      `  Total Errors: ${systemMetrics.totalErrors.toLocaleString()}`,
      `  Error Rate: ${systemMetrics.errorRate.toFixed(2)}%`,
      `  Average Response Time: ${systemMetrics.averageResponseTime.toFixed(2)}ms`,
      `  Operations/Second: ${systemMetrics.operationsPerSecond.toFixed(2)}`,
      `  Uptime: ${Math.floor(systemMetrics.uptime / 1000)}s`,
      '',
      'Operation Breakdown:'
    ];

    // Sort operations by total time spent
    const sortedOperations = Object.entries(allMetrics)
      .sort(([, a], [, b]) => b.totalDuration - a.totalDuration);

    for (const [operation, metrics] of sortedOperations.slice(0, 10)) { // Top 10 operations
      const errorRate = metrics.count > 0 ? (metrics.errors / metrics.count * 100).toFixed(1) : '0.0';
      report.push(
        `  ${operation}:`,
        `    Count: ${metrics.count.toLocaleString()}`,
        `    Avg Duration: ${metrics.averageDuration.toFixed(2)}ms`,
        `    Min/Max: ${metrics.minDuration.toFixed(2)}ms / ${metrics.maxDuration.toFixed(2)}ms`,
        `    Error Rate: ${errorRate}%`,
        `    Total Time: ${(metrics.totalDuration / 1000).toFixed(2)}s`,
        ''
      );
    }

    // Performance recommendations
    report.push('Performance Insights:');
    
    // Slow operations
    const slowOperations = Object.entries(allMetrics)
      .filter(([, metrics]) => metrics.averageDuration > 1000)
      .sort(([, a], [, b]) => b.averageDuration - a.averageDuration);

    if (slowOperations.length > 0) {
      report.push('  ⚠️  Slow Operations (>1s average):');
      for (const [operation, metrics] of slowOperations.slice(0, 3)) {
        report.push(`    - ${operation}: ${metrics.averageDuration.toFixed(2)}ms average`);
      }
    }

    // High error rate operations
    const highErrorOperations = Object.entries(allMetrics)
      .filter(([, metrics]) => metrics.count > 10 && (metrics.errors / metrics.count) > 0.05)
      .sort(([, a], [, b]) => (b.errors / b.count) - (a.errors / a.count));

    if (highErrorOperations.length > 0) {
      report.push('  🚨 High Error Rate Operations (>5%):');
      for (const [operation, metrics] of highErrorOperations.slice(0, 3)) {
        const errorRate = (metrics.errors / metrics.count * 100).toFixed(1);
        report.push(`    - ${operation}: ${errorRate}% error rate`);
      }
    }

    if (slowOperations.length === 0 && highErrorOperations.length === 0) {
      report.push('  ✅ All operations performing within acceptable thresholds');
    }

    return report.join('\n');
  }

  startPerformanceTimer(): () => number {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      return duration;
    };
  }

  // Advanced analytics methods
  getPerformanceTrends(operation: string, _windowMinutes: number = 60): { trend: 'improving' | 'degrading' | 'stable'; change: number } {
    const metrics = this.operations.get(operation);
    if (!metrics || metrics.count < 10) {
      return { trend: 'stable', change: 0 };
    }

    // This is a simplified trend calculation
    // In a real implementation, we'd store more granular timestamp data
    const recentAvg = metrics.averageDuration;
    const trend = 
      recentAvg > metrics.averageDuration * 1.1 ? 'degrading' :
      recentAvg < metrics.averageDuration * 0.9 ? 'improving' : 'stable';
    
    const change = ((recentAvg - metrics.averageDuration) / metrics.averageDuration) * 100;

    return { trend, change };
  }

  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const allMetrics = this.getMetrics();

    // Check for consistently slow operations
    for (const [operation, metrics] of Object.entries(allMetrics)) {
      if (metrics.count > 20 && metrics.averageDuration > 500) {
        recommendations.push(
          `Consider optimizing '${operation}' - average ${metrics.averageDuration.toFixed(0)}ms with ${metrics.count} calls`
        );
      }
    }

    // Check for high error rates
    for (const [operation, metrics] of Object.entries(allMetrics)) {
      if (metrics.count > 10 && (metrics.errors / metrics.count) > 0.1) {
        recommendations.push(
          `Investigate '${operation}' errors - ${((metrics.errors / metrics.count) * 100).toFixed(1)}% failure rate`
        );
      }
    }

    // Check for infrequent but expensive operations
    for (const [operation, metrics] of Object.entries(allMetrics)) {
      if (metrics.count < 5 && metrics.maxDuration > 2000) {
        recommendations.push(
          `Consider caching results for '${operation}' - slow operation with only ${metrics.count} calls`
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('No immediate optimization recommendations - metrics look good!');
    }

    return recommendations;
  }
}

// Export singleton instance
export const analyticsCollector = new AnalyticsCollector();