/**
 * Types for Backend Optimization System
 */

export interface OptimizationConfig {
  enableDatabaseOptimization: boolean;
  enableQueryOptimization: boolean;
  enableEdgeOptimization: boolean;
  enableCacheOptimization: boolean;
  enablePerformanceMonitoring: boolean;
  optimizationInterval: number;
}

export interface OptimizationMetrics {
  database: {
    queryTime: number;
    cacheHitRate: number;
    connectionPoolUtilization: number;
    indexUsage: number;
    slowQueries: number;
    errorRate: number;
    throughput: number;
  };
  cache: {
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    missRate: number;
    evictions: number;
    compressions: number;
  };
  edge: {
    coldStartCount: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    requestCount: number;
    lastWarmup: number;
  };
  overallScore?: number;
}

export interface OptimizationHistory {
  timestamp: number;
  metrics: OptimizationMetrics;
  recommendations: string[];
  success: boolean;
}

export interface QueryAnalysis {
  slowQueries: Array<{
    query: string;
    executionTime: number;
    frequency: number;
  }>;
  cacheHitRate: number;
  recommendations: string[];
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  compressions: number;
}

export interface EdgeMetrics {
  coldStartCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  requestCount: number;
  lastWarmup: number;
}