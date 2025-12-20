/**
 * Database Performance Monitor Compatibility Wrapper
 * Redirects to consolidated edge analytics monitoring system
 */

import { edgeAnalyticsMonitoring } from './edgeAnalyticsMonitoring';

// Compatibility interface for existing code
interface DatabaseMetrics {
  queryTime: number;
  cacheHitRate: number;
  connectionPoolUtilization: number;
  indexUsage: number;
  slowQueries: number;
  errorRate: number;
  throughput: number;
}

class DatabasePerformanceMonitor {
  getMetrics(): DatabaseMetrics {
    const edgeMetrics = edgeAnalyticsMonitoring.getMetrics();
    const latest = edgeMetrics[edgeMetrics.length - 1];
    
    return {
      queryTime: latest?.responseTime || 0,
      cacheHitRate: latest?.cacheHitRate || 0,
      connectionPoolUtilization: latest?.memoryUsage || 0,
      indexUsage: 85, // Default placeholder
      slowQueries: 0,
      errorRate: latest?.errorRate || 0,
      throughput: 0,
    };
  }

  getPerformanceReport(): any {
    return {
      summary: edgeAnalyticsMonitoring.getPerformanceSummary(),
      timestamp: Date.now(),
      recommendations: [],
    };
  }

  destroy(): void {
    // Cleanup handled by edgeAnalyticsMonitoring
  }

  recordQuery(query: string, time: number, success: boolean): void {
    // Query recording now handled by edge analytics monitoring
  }
}

export const databasePerformanceMonitor = new DatabasePerformanceMonitor();