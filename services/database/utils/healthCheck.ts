/**
 * Database Health Check Service
 * 
 * Provides comprehensive database health monitoring with
 * connection status, query performance, and resource usage tracking.
 * 
 * @module services/database/utils/healthCheck
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../../utils/logger';
import { queryPerformanceTracker } from './queryBuilder';

const logger = createScopedLogger('DatabaseHealth');

/**
 * Health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Database health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: number;
  latency: number;
  details: {
    connection: boolean;
    queryable: boolean;
    responsive: boolean;
  };
  metrics?: {
    avgQueryTime: number;
    errorRate: number;
    slowQueryCount: number;
  };
  message?: string;
}

/**
 * Health check options
 */
export interface HealthCheckOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Include performance metrics */
  includeMetrics?: boolean;
  /** Test query to run */
  testQuery?: string;
}

/**
 * Default health check options
 */
const DEFAULT_HEALTH_OPTIONS: Required<HealthCheckOptions> = {
  timeout: 5000,
  includeMetrics: true,
  testQuery: 'SELECT 1',
};

/**
 * Determine health status from metrics
 */
function determineStatus(
  latency: number,
  errorRate: number,
  avgQueryTime: number
): HealthStatus {
  // Unhealthy: high error rate or very slow
  if (errorRate > 0.5 || latency > 5000 || avgQueryTime > 3000) {
    return 'unhealthy';
  }
  
  // Degraded: moderate issues
  if (errorRate > 0.1 || latency > 2000 || avgQueryTime > 1000) {
    return 'degraded';
  }
  
  return 'healthy';
}

/**
 * Run a health check on the database
 * 
 * @param client - Supabase client instance
 * @param options - Health check options
 * @returns Health check result
 */
export async function runHealthCheck(
  client: {
    from: (table: string) => {
      select: (columns: string) => {
        limit: (limit: number) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  } | null,
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult> {
  const opts = { ...DEFAULT_HEALTH_OPTIONS, ...options };
  const startTime = Date.now();
  const timestamp = startTime;
  
  const result: HealthCheckResult = {
    status: 'unhealthy',
    timestamp,
    latency: 0,
    details: {
      connection: false,
      queryable: false,
      responsive: false,
    },
  };
  
  // Check 1: Connection exists
  result.details.connection = client !== null;
  
  if (!client) {
    result.message = 'No database client available';
    return result;
  }
  
  try {
    // Check 2: Can execute queries
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), opts.timeout);
    });
    
    const queryPromise = client
      .from('robots')
      .select('id')
      .limit(1);
    
    const { data: _data, error } = await Promise.race([queryPromise, timeoutPromise]);
    
    result.details.queryable = !error;
    result.details.responsive = true;
    
    if (error) {
      result.message = `Query error: ${error.message}`;
      logger.warn('Health check query failed:', error.message);
    }
    
    // Calculate latency
    result.latency = Date.now() - startTime;
    
    // Include metrics if requested
    if (opts.includeMetrics) {
      const avgQueryTime = queryPerformanceTracker.getAverageDuration();
      const errorRate = queryPerformanceTracker.getErrorRate();
      const slowQueries = queryPerformanceTracker.getSlowQueries(1000);
      
      result.metrics = {
        avgQueryTime,
        errorRate,
        slowQueryCount: slowQueries.length,
      };
      
      result.status = determineStatus(result.latency, errorRate, avgQueryTime);
    } else {
      result.status = result.details.queryable ? 'healthy' : 'unhealthy';
    }
    
    if (result.status === 'healthy') {
      logger.debug(`Health check passed in ${result.latency}ms`);
    } else {
      logger.warn(`Health check ${result.status}: ${result.latency}ms latency`);
    }
    
  } catch (error) {
    result.latency = Date.now() - startTime;
    result.details.responsive = false;
    result.message = error instanceof Error ? error.message : 'Unknown error';
    result.status = 'unhealthy';
    logger.error('Health check failed:', result.message);
  }
  
  return result;
}

/**
 * Health check scheduler
 */
export class HealthCheckScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastResult: HealthCheckResult | null = null;
  private consecutiveFailures = 0;
  private onUnhealthy?: (result: HealthCheckResult) => void;
  private onRecovered?: () => void;
  
  /**
   * Start periodic health checks
   */
  start(
    clientGetter: () => Promise<{
      from: (table: string) => {
        select: (columns: string) => {
          limit: (limit: number) => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    } | null>,
    intervalMs: number = 30000,
    callbacks?: {
      onUnhealthy?: (result: HealthCheckResult) => void;
      onRecovered?: () => void;
    }
  ): void {
    this.onUnhealthy = callbacks?.onUnhealthy;
    this.onRecovered = callbacks?.onRecovered;
    
    // Run initial check
    this.runCheck(clientGetter);
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.runCheck(clientGetter);
    }, intervalMs);
    
    logger.info('Health check scheduler started');
  }
  
  private async runCheck(
    clientGetter: () => Promise<{
      from: (table: string) => {
        select: (columns: string) => {
          limit: (limit: number) => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    } | null>
  ): Promise<void> {
    try {
      const client = await clientGetter();
      const result = await runHealthCheck(client);
      
      const wasUnhealthy = this.lastResult?.status === 'unhealthy';
      const isNowHealthy = result.status === 'healthy';
      
      this.lastResult = result;
      
      if (result.status === 'unhealthy') {
        this.consecutiveFailures++;
        this.onUnhealthy?.(result);
      } else {
        if (wasUnhealthy && isNowHealthy) {
          logger.info('Database recovered');
          this.onRecovered?.();
        }
        this.consecutiveFailures = 0;
      }
    } catch (error) {
      logger.error('Health check error:', error);
    }
  }
  
  /**
   * Stop periodic health checks
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Health check scheduler stopped');
    }
  }
  
  /**
   * Get last health check result
   */
  getLastResult(): HealthCheckResult | null {
    return this.lastResult;
  }
  
  /**
   * Get consecutive failure count
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }
  
  /**
   * Check if currently healthy
   */
  isHealthy(): boolean {
    return this.lastResult?.status === 'healthy';
  }
}

/**
 * Global health check scheduler instance
 */
export const healthCheckScheduler = new HealthCheckScheduler();
