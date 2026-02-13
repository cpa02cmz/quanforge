import { robotCache, queryCache } from './cache';
import { getClient } from './client';
import { handleError } from '../../utils/errorHandler';
import { createScopedLogger } from '../../utils/logger';
import { HEALTH_CHECK_CONFIG } from '../monitoringConfig';

const logger = createScopedLogger('DatabaseMonitoring');

// Performance monitoring for database operations
export class DatabaseMonitor {
  private static metrics = new Map<string, { count: number; totalTime: number; errors: number }>();

  static recordOperation(operation: string, duration: number, success: boolean = true): void {
    const current = this.metrics.get(operation) || { count: 0, totalTime: 0, errors: 0 };
    current.count++;
    current.totalTime += duration;
    if (!success) current.errors++;
    this.metrics.set(operation, current);
  }

  static getMetrics(): Record<string, { count: number; avgTime: number; errors: number; errorRate: number }> {
    const result: Record<string, any> = {};
    
    for (const [operation, metrics] of this.metrics.entries()) {
      result[operation] = {
        count: metrics.count,
        avgTime: metrics.totalTime / metrics.count,
        errors: metrics.errors,
        errorRate: metrics.errors / metrics.count
      };
    }
    
    return result;
  }

  static resetMetrics(): void {
    this.metrics.clear();
  }
}

// Query optimizer with caching
export class QueryOptimizer {
  static async executeQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    cacheKey?: string
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      // Check cache first
      if (cacheKey && queryCache.has(cacheKey)) {
        const cachedResult = queryCache.get(cacheKey);
        DatabaseMonitor.recordOperation(`${queryName}_cache_hit`, performance.now() - startTime);
        return cachedResult;
      }

      // Execute query
      const result = await queryFn();
      
      // Cache result
      if (cacheKey && result) {
        queryCache.set(cacheKey, result);
      }
      
      DatabaseMonitor.recordOperation(queryName, performance.now() - startTime, true);
      return result;
    } catch (error: unknown) {
      DatabaseMonitor.recordOperation(queryName, performance.now() - startTime, false);
      handleError(error instanceof Error ? error : new Error(String(error)), queryName);
      throw error;
    }
  }

  // Batch query execution
  static async executeBatch<T>(
    queries: Array<{ name: string; fn: () => Promise<T>; cacheKey?: string }>
  ): Promise<T[]> {
    const startTime = performance.now();
    
    try {
      const results = await Promise.allSettled(
        queries.map(async ({ name, fn, cacheKey }) => {
          return this.executeQuery(name, fn, cacheKey);
        })
      );

      const successfulResults: T[] = [];
      const failedResults: unknown[] = [];
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
        } else {
          failedResults.push(result);
        }
      });
      
      if (failedResults.length > 0) {
        console.warn(`${failedResults.length} batch queries failed:`, failedResults);
      }

      DatabaseMonitor.recordOperation('batch_query', performance.now() - startTime);
      return successfulResults;
    } catch (error: unknown) {
      DatabaseMonitor.recordOperation('batch_query', performance.now() - startTime, false);
      throw error;
    }
  }
}

// Connection health monitor
export class ConnectionHealthMonitor {
  private static healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private static isHealthy = true;

  static startHealthCheck(intervalMs: number = HEALTH_CHECK_CONFIG.INTERVAL_STANDARD): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const client = getClient();
        // Simple health check - try to get session
        await client.auth.getSession();
        
        if (!this.isHealthy) {
          logger.log('Database connection restored');
          this.isHealthy = true;
        }
      } catch (error: unknown) {
        if (this.isHealthy) {
          logger.warn('Database connection health check failed:', error instanceof Error ? error.message : String(error));
          this.isHealthy = false;
        }
      }
    }, intervalMs);
  }

  static stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  static isConnectionHealthy(): boolean {
    return this.isHealthy;
  }
}

// Performance metrics collector
export const collectDatabaseMetrics = () => {
  const dbMetrics = DatabaseMonitor.getMetrics();
  const cacheStats = {
    robotCache: robotCache.getStats(),
    queryCache: queryCache.getStats()
  };
  
  return {
    operations: dbMetrics,
    cache: cacheStats,
    connection: {
      healthy: ConnectionHealthMonitor.isConnectionHealthy()
    }
  };
};

// Initialize monitoring
if (typeof window !== 'undefined') {
  // Start health checks in browser
  ConnectionHealthMonitor.startHealthCheck();
  
  // Log metrics periodically in development
  if (process.env['NODE_ENV'] === 'development') {
    setInterval(() => {
      const metrics = collectDatabaseMetrics();
      logger.log('Database Metrics:', metrics);
    }, 60000); // Every minute
  }
}