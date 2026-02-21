/**
 * Database Health Checker - Connection and Performance Health Monitoring
 * 
 * Provides comprehensive health monitoring for database connections with:
 * - Connection pool health checks
 * - Query performance monitoring
 * - Latency tracking
 * - Resource usage monitoring
 * - Automated health scoring
 * 
 * @module services/database/utils/healthChecker
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../../utils/logger';
import { TIMEOUTS } from '../../../constants';

const logger = createScopedLogger('DatabaseHealthChecker');

// ============= Types =============

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';

export interface ConnectionHealth {
  /** Connection is available */
  available: boolean;
  /** Connection latency in ms */
  latency: number;
  /** Last successful connection timestamp */
  lastSuccess: number | null;
  /** Last failure timestamp */
  lastFailure: number | null;
  /** Consecutive failure count */
  consecutiveFailures: number;
  /** Total connection attempts */
  totalAttempts: number;
  /** Total successful connections */
  totalSuccesses: number;
}

export interface PoolHealth {
  /** Pool is healthy */
  healthy: boolean;
  /** Total connections in pool */
  totalConnections: number;
  /** Active connections */
  activeConnections: number;
  /** Idle connections */
  idleConnections: number;
  /** Waiting requests */
  waitingRequests: number;
  /** Pool utilization percentage */
  utilization: number;
}

export interface QueryHealth {
  /** Average query time in ms */
  avgQueryTime: number;
  /** P95 query time in ms */
  p95QueryTime: number;
  /** P99 query time in ms */
  p99QueryTime: number;
  /** Total queries executed */
  totalQueries: number;
  /** Failed queries */
  failedQueries: number;
  /** Query success rate */
  successRate: number;
  /** Slow queries count (>1s) */
  slowQueries: number;
}

export interface DatabaseHealthReport {
  /** Overall health status */
  status: HealthStatus;
  /** Health score (0-100) */
  score: number;
  /** Timestamp of report */
  timestamp: number;
  /** Connection health */
  connection: ConnectionHealth;
  /** Pool health */
  pool: PoolHealth;
  /** Query health */
  queries: QueryHealth;
  /** Issues detected */
  issues: string[];
  /** Recommendations */
  recommendations: string[];
}

export interface HealthCheckOptions {
  /** Timeout for health check in ms */
  timeout?: number;
  /** Include detailed metrics */
  detailed?: boolean;
  /** Custom health check query */
  customCheckQuery?: string;
}

// ============= Default Options =============

const DEFAULT_OPTIONS: Required<HealthCheckOptions> = {
  timeout: TIMEOUTS.QUICK_OPERATION,
  detailed: false,
  customCheckQuery: 'SELECT 1',
};

// ============= Health Thresholds =============

const THRESHOLDS = {
  latency: {
    healthy: 50,    // < 50ms
    degraded: 200,  // < 200ms
    unhealthy: 500, // < 500ms
    // > 500ms = critical
  },
  utilization: {
    healthy: 70,    // < 70%
    degraded: 85,   // < 85%
    unhealthy: 95,  // < 95%
    // > 95% = critical
  },
  successRate: {
    healthy: 99,    // > 99%
    degraded: 95,   // > 95%
    unhealthy: 90,  // > 90%
    // < 90% = critical
  },
  consecutiveFailures: {
    healthy: 0,
    degraded: 2,
    unhealthy: 5,
    // > 5 = critical
  },
};

// ============= Database Health Checker Class =============

/**
 * Database Health Checker for monitoring database health
 */
export class DatabaseHealthChecker {
  private connectionHealth: ConnectionHealth = {
    available: true,
    latency: 0,
    lastSuccess: null,
    lastFailure: null,
    consecutiveFailures: 0,
    totalAttempts: 0,
    totalSuccesses: 0,
  };

  private poolHealth: PoolHealth = {
    healthy: true,
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    utilization: 0,
  };

  private queryHealth: QueryHealth = {
    avgQueryTime: 0,
    p95QueryTime: 0,
    p99QueryTime: 0,
    totalQueries: 0,
    failedQueries: 0,
    successRate: 100,
    slowQueries: 0,
  };

  private queryTimes: number[] = [];
  private readonly maxQuerySamples = 1000;

  /**
   * Run a comprehensive health check
   */
  async checkHealth(
    executeQuery: (sql: string) => Promise<unknown>,
    getPoolStats?: () => PoolHealth | null,
    options: HealthCheckOptions = {}
  ): Promise<DatabaseHealthReport> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check connection health
    const connectionHealth = await this.checkConnection(executeQuery, opts.timeout);
    
    // Check pool health if available
    const poolHealth = getPoolStats ? this.updatePoolHealth(getPoolStats()) : this.poolHealth;

    // Analyze health and generate report
    const status = this.calculateHealthStatus(connectionHealth, poolHealth);
    const score = this.calculateHealthScore(connectionHealth, poolHealth);

    // Collect issues
    if (connectionHealth.consecutiveFailures > 0) {
      issues.push(`Connection has ${connectionHealth.consecutiveFailures} consecutive failures`);
    }
    if (connectionHealth.latency > THRESHOLDS.latency.degraded) {
      issues.push(`High connection latency: ${connectionHealth.latency}ms`);
    }
    if (poolHealth.utilization > THRESHOLDS.utilization.degraded) {
      issues.push(`High pool utilization: ${poolHealth.utilization.toFixed(1)}%`);
    }
    if (this.queryHealth.successRate < THRESHOLDS.successRate.degraded) {
      issues.push(`Low query success rate: ${this.queryHealth.successRate.toFixed(1)}%`);
    }
    if (this.queryHealth.slowQueries > 10) {
      issues.push(`${this.queryHealth.slowQueries} slow queries detected`);
    }

    // Generate recommendations
    if (poolHealth.utilization > 80) {
      recommendations.push('Consider increasing connection pool size');
    }
    if (connectionHealth.latency > 100) {
      recommendations.push('Investigate network latency or database load');
    }
    if (this.queryHealth.avgQueryTime > 100) {
      recommendations.push('Review and optimize slow queries');
    }
    if (this.queryHealth.successRate < 95) {
      recommendations.push('Review error handling and query patterns');
    }

    return {
      status,
      score,
      timestamp: Date.now(),
      connection: connectionHealth,
      pool: poolHealth,
      queries: this.queryHealth,
      issues,
      recommendations,
    };
  }

  /**
   * Check connection health by executing a simple query
   */
  private async checkConnection(
    executeQuery: (sql: string) => Promise<unknown>,
    timeout: number
  ): Promise<ConnectionHealth> {
    const startTime = Date.now();
    this.connectionHealth.totalAttempts++;

    try {
      // Execute with timeout
      await this.withTimeout(
        executeQuery('SELECT 1'),
        timeout,
        'Connection health check timed out'
      );

      const latency = Date.now() - startTime;
      
      this.connectionHealth = {
        ...this.connectionHealth,
        available: true,
        latency,
        lastSuccess: Date.now(),
        consecutiveFailures: 0,
        totalSuccesses: this.connectionHealth.totalSuccesses + 1,
      };

      return this.connectionHealth;
    } catch (error) {
      const latency = Date.now() - startTime;
      
      this.connectionHealth = {
        ...this.connectionHealth,
        available: false,
        latency,
        lastFailure: Date.now(),
        consecutiveFailures: this.connectionHealth.consecutiveFailures + 1,
      };

      logger.error('Connection health check failed:', error);
      return this.connectionHealth;
    }
  }

  /**
   * Update pool health from external stats
   */
  updatePoolHealth(stats: PoolHealth | null): PoolHealth {
    if (stats) {
      this.poolHealth = {
        ...stats,
        utilization: stats.totalConnections > 0 
          ? (stats.activeConnections / stats.totalConnections) * 100 
          : 0,
      };
    }
    return this.poolHealth;
  }

  /**
   * Record a query execution for health tracking
   */
  recordQuery(duration: number, success: boolean): void {
    this.queryHealth.totalQueries++;
    
    if (!success) {
      this.queryHealth.failedQueries++;
    }
    
    if (duration > 1000) {
      this.queryHealth.slowQueries++;
    }

    // Update success rate
    this.queryHealth.successRate = 
      ((this.queryHealth.totalQueries - this.queryHealth.failedQueries) / 
        this.queryHealth.totalQueries) * 100;

    // Track query times for percentile calculations
    this.queryTimes.push(duration);
    if (this.queryTimes.length > this.maxQuerySamples) {
      this.queryTimes.shift();
    }

    // Calculate percentiles
    if (this.queryTimes.length > 0) {
      const sorted = [...this.queryTimes].sort((a, b) => a - b);
      this.queryHealth.avgQueryTime = 
        sorted.reduce((a, b) => a + b, 0) / sorted.length;
      this.queryHealth.p95QueryTime = sorted[Math.floor(sorted.length * 0.95)] || 0;
      this.queryHealth.p99QueryTime = sorted[Math.floor(sorted.length * 0.99)] || 0;
    }
  }

  /**
   * Get current health report without running checks
   */
  getCurrentHealth(): Omit<DatabaseHealthReport, 'issues' | 'recommendations'> {
    const status = this.calculateHealthStatus(this.connectionHealth, this.poolHealth);
    const score = this.calculateHealthScore(this.connectionHealth, this.poolHealth);

    return {
      status,
      score,
      timestamp: Date.now(),
      connection: this.connectionHealth,
      pool: this.poolHealth,
      queries: this.queryHealth,
    };
  }

  /**
   * Reset all health metrics
   */
  reset(): void {
    this.connectionHealth = {
      available: true,
      latency: 0,
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
      totalAttempts: 0,
      totalSuccesses: 0,
    };

    this.poolHealth = {
      healthy: true,
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      utilization: 0,
    };

    this.queryHealth = {
      avgQueryTime: 0,
      p95QueryTime: 0,
      p99QueryTime: 0,
      totalQueries: 0,
      failedQueries: 0,
      successRate: 100,
      slowQueries: 0,
    };

    this.queryTimes = [];
  }

  // ============= Private Methods =============

  private calculateHealthStatus(
    connection: ConnectionHealth,
    pool: PoolHealth
  ): HealthStatus {
    // Critical conditions
    if (connection.consecutiveFailures > THRESHOLDS.consecutiveFailures.unhealthy) {
      return 'critical';
    }
    if (pool.utilization > THRESHOLDS.utilization.unhealthy) {
      return 'critical';
    }
    if (this.queryHealth.successRate < THRESHOLDS.successRate.unhealthy) {
      return 'critical';
    }

    // Unhealthy conditions
    if (connection.consecutiveFailures > THRESHOLDS.consecutiveFailures.degraded) {
      return 'unhealthy';
    }
    if (connection.latency > THRESHOLDS.latency.unhealthy) {
      return 'unhealthy';
    }
    if (pool.utilization > THRESHOLDS.utilization.degraded) {
      return 'unhealthy';
    }

    // Degraded conditions
    if (connection.consecutiveFailures > 0) {
      return 'degraded';
    }
    if (connection.latency > THRESHOLDS.latency.degraded) {
      return 'degraded';
    }
    if (pool.utilization > THRESHOLDS.utilization.healthy) {
      return 'degraded';
    }
    if (this.queryHealth.successRate < THRESHOLDS.successRate.degraded) {
      return 'degraded';
    }

    return 'healthy';
  }

  private calculateHealthScore(
    connection: ConnectionHealth,
    pool: PoolHealth
  ): number {
    let score = 100;

    // Connection score (40 points)
    if (!connection.available) {
      score -= 40;
    } else {
      if (connection.latency > THRESHOLDS.latency.unhealthy) {
        score -= 30;
      } else if (connection.latency > THRESHOLDS.latency.degraded) {
        score -= 15;
      } else if (connection.latency > THRESHOLDS.latency.healthy) {
        score -= 5;
      }
      if (connection.consecutiveFailures > 0) {
        score -= Math.min(connection.consecutiveFailures * 5, 20);
      }
    }

    // Pool score (30 points)
    if (pool.utilization > THRESHOLDS.utilization.unhealthy) {
      score -= 30;
    } else if (pool.utilization > THRESHOLDS.utilization.degraded) {
      score -= 20;
    } else if (pool.utilization > THRESHOLDS.utilization.healthy) {
      score -= 10;
    }

    // Query score (30 points)
    if (this.queryHealth.successRate < THRESHOLDS.successRate.unhealthy) {
      score -= 25;
    } else if (this.queryHealth.successRate < THRESHOLDS.successRate.degraded) {
      score -= 15;
    } else if (this.queryHealth.successRate < THRESHOLDS.successRate.healthy) {
      score -= 5;
    }
    if (this.queryHealth.avgQueryTime > 200) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }
}

// ============= Singleton Instance =============

export const databaseHealthChecker = new DatabaseHealthChecker();

// ============= Convenience Functions =============

/**
 * Check database health
 */
export async function checkDatabaseHealth(
  executeQuery: (sql: string) => Promise<unknown>,
  getPoolStats?: () => PoolHealth | null,
  options?: HealthCheckOptions
): Promise<DatabaseHealthReport> {
  return databaseHealthChecker.checkHealth(executeQuery, getPoolStats, options);
}

/**
 * Record a query execution
 */
export function recordQueryExecution(duration: number, success: boolean): void {
  databaseHealthChecker.recordQuery(duration, success);
}

/**
 * Get current health status
 */
export function getDatabaseHealthStatus(): HealthStatus {
  const health = databaseHealthChecker.getCurrentHealth();
  return health.status;
}
