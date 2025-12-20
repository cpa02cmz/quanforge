/**
 * Consolidated Database Monitoring Service
 * Integrates with connectionManager for comprehensive database health and performance monitoring
 */

// Client functionality is now handled by connectionManager
import { connectionManager, type PoolMetrics } from './connectionManager';
import { handleError } from '../../utils/errorHandler';

// Consolidated database performance monitoring
export interface DatabaseMetrics {
  operations: Record<string, { count: number; avgTime: number; errors: number; errorRate: number }>;
  connections: PoolMetrics;
  cache: { hitRate: number; size: number; evictions: number };
}

// Performance monitoring for database operations
export class DatabaseMonitor {
  private static metrics = new Map<string, { count: number; totalTime: number; errors: number }>();
  private static cacheMetrics = { hits: 0, misses: 0, evictions: 0 };
  private static startTime = Date.now();
  private static isHealthy = true;
  private static healthCheckInterval: NodeJS.Timeout | null = null;

  static recordOperation(operation: string, duration: number, success: boolean = true): void {
    const current = this.metrics.get(operation) || { count: 0, totalTime: 0, errors: 0 };
    current.count++;
    current.totalTime += duration;
    if (!success) current.errors++;
    this.metrics.set(operation, current);
  }

  static recordCacheHit(): void {
    this.cacheMetrics.hits++;
  }

  static recordCacheMiss(): void {
    this.cacheMetrics.misses++;
  }

  static recordCacheEviction(): void {
    this.cacheMetrics.evictions++;
  }

  static getMetrics(): DatabaseMetrics {
    // Operation metrics
    const operations: Record<string, any> = {};
    for (const [operation, metrics] of this.metrics.entries()) {
      operations[operation] = {
        count: metrics.count,
        avgTime: metrics.totalTime / metrics.count,
        errors: metrics.errors,
        errorRate: metrics.errors / metrics.count
      };
    }

    // Connection metrics from unified connection manager
    const connections = connectionManager.getMetrics();

    // Cache metrics
    const totalCacheOps = this.cacheMetrics.hits + this.cacheMetrics.misses;
    const cache = {
      hitRate: totalCacheOps > 0 ? (this.cacheMetrics.hits / totalCacheOps) * 100 : 0,
      size: 0, // Will be updated by unified cache manager
      evictions: this.cacheMetrics.evictions
    };

    return {
      operations,
      connections,
      cache
    };
  }

  static getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    uptime: number;
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check connection health
    if (metrics.connections.errorRate > 10) {
      status = 'critical';
      issues.push(`High connection error rate: ${metrics.connections.errorRate.toFixed(1)}%`);
    } else if (metrics.connections.errorRate > 5) {
      status = 'warning';
      issues.push(`Elevated connection error rate: ${metrics.connections.errorRate.toFixed(1)}%`);
    }

    // Check connection utilization
    if (metrics.connections.connectionUtilization > 90) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`High connection utilization: ${metrics.connections.connectionUtilization.toFixed(1)}%`);
    }

    // Check unhealthy connections
    if (metrics.connections.unhealthyConnections > 0) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`${metrics.connections.unhealthyConnections} unhealthy connections`);
    }

    // Check average response times
    const criticalResponseTime = parseInt(process.env['VITE_DB_CRITICAL_RESPONSE_TIME'] || '5000');
    const warningResponseTime = parseInt(process.env['VITE_DB_WARNING_RESPONSE_TIME'] || '2000');
    
    if (metrics.connections.averageResponseTime > criticalResponseTime) {
      status = 'critical';
      issues.push(`Very slow response time: ${metrics.connections.averageResponseTime}ms`);
    } else if (metrics.connections.averageResponseTime > warningResponseTime) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`Slow response time: ${metrics.connections.averageResponseTime}ms`);
    }

    // Check cache hit rate
    if (metrics.cache.hitRate < 80 && (this.cacheMetrics.hits + this.cacheMetrics.misses) > 100) {
      issues.push(`Low cache hit rate: ${metrics.cache.hitRate.toFixed(1)}%`);
    }

    return {
      status,
      issues,
      uptime: Date.now() - this.startTime
    };
  }

  static startHealthCheck(intervalMs: number = parseInt(process.env['VITE_DB_HEALTH_CHECK_INTERVAL'] || '30000')): void {
    // Stop any existing health check
    this.stopHealthCheck();

    this.healthCheckInterval = setInterval(async () => {
      try {
        const client = await connectionManager.getConnection(false);
        // Simple health check - try to get session
        await client.auth.getSession();
        
        if (!this.isHealthy) {
          if (import.meta.env.DEV) {
            console.log('Database connection restored');
          }
          this.isHealthy = true;
        }
      } catch (error) {
        if (this.isHealthy) {
          if (import.meta.env.DEV) {
            console.warn('Database connection health check failed:', error);
          }
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

  static resetMetrics(): void {
    this.metrics.clear();
    this.cacheMetrics = { hits: 0, misses: 0, evictions: 0 };
    this.startTime = Date.now();
  }
}

// Performance metrics collector
export const collectDatabaseMetrics = () => {
  const dbMetrics = DatabaseMonitor.getMetrics();
  const healthStatus = DatabaseMonitor.getHealthStatus();
  
  return {
    operations: dbMetrics.operations,
    connections: dbMetrics.connections,
    cache: dbMetrics.cache,
    health: healthStatus
  };
};

// Initialize monitoring on client side
if (typeof window !== 'undefined') {
  DatabaseMonitor.startHealthCheck();
}

// Export default for compatibility
export default DatabaseMonitor;