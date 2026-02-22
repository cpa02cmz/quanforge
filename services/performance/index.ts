/**
 * Performance Services Index
 * Exports all performance-related services and utilities
 * 
 * @module services/performance
 */

// Export metrics collector
export { 
  getMetricsCollector,
  default as PerformanceMetricsCollector,
} from './metricsCollector';
export type { 
  PerformanceMetric as MetricsCollectorMetric,
  MetricType,
  PerformanceBudget,
  MetricsCollectorConfig,
} from './metricsCollector';

// Export performance monitor (if exists)
export * from './monitor';

// Export optimizer (if exists)
export * from './optimizer';
