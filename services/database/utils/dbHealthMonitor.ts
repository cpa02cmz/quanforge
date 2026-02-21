/**
 * Database Connection Health Monitor
 * 
 * Monitors database connection health, detects issues early,
 * and provides health check endpoints for monitoring systems.
 * 
 * Features:
 * - Connection health checks
 * - Latency monitoring
 * - Connection pool status tracking
 * - Health check history
 * - Automatic health check scheduling
 * 
 * @module services/database/utils/dbHealthMonitor
 */

import { createScopedLogger } from '../../../utils/logger';
import { getClient } from '../client';

const logger = createScopedLogger('db-health-monitor');

/**
 * Health status enumeration
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: number;
  latency: number;
  message: string;
  details?: {
    connectionValid?: boolean;
    responseTime?: number;
    lastSuccessfulQuery?: number;
    consecutiveFailures?: number;
    totalChecks?: number;
    successfulChecks?: number;
  };
  error?: string;
}

/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
  /** Enable automatic health checks */
  autoCheck: boolean;
  /** Health check interval in milliseconds */
  checkInterval: number;
  /** Timeout for health check queries in milliseconds */
  checkTimeout: number;
  /** Number of consecutive failures before marking as unhealthy */
  failureThreshold: number;
  /** Latency threshold in milliseconds for degraded status */
  degradedLatencyThreshold: number;
  /** Latency threshold in milliseconds for unhealthy status */
  unhealthyLatencyThreshold: number;
  /** Maximum history entries to keep */
  maxHistorySize: number;
}

const DEFAULT_CONFIG: HealthMonitorConfig = {
  autoCheck: true,
  checkInterval: 30000, // 30 seconds
  checkTimeout: 5000, // 5 seconds
  failureThreshold: 3,
  degradedLatencyThreshold: 500, // 500ms
  unhealthyLatencyThreshold: 2000, // 2 seconds
  maxHistorySize: 100
};

/**
 * Database Connection Health Monitor
 */
export class DatabaseHealthMonitor {
  private config: HealthMonitorConfig;
  private healthHistory: HealthCheckResult[] = [];
  private consecutiveFailures: number = 0;
  private lastSuccessfulCheck: number | null = null;
  private totalChecks: number = 0;
  private successfulChecks: number = 0;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private currentStatus: HealthStatus = HealthStatus.UNKNOWN;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.autoCheck) {
      this.startAutoCheck();
    }
  }

  /**
   * Perform a health check
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const timestamp = Date.now();
    this.totalChecks++;

    try {
      // Attempt a simple query to check connection
      const client = getClient();
      
      // Use Promise.race for timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.checkTimeout);
      });

      // Simple SELECT 1 query
      const healthQuery = client.from('robots').select('id', { count: 'exact', head: true });
      
      await Promise.race([healthQuery, timeoutPromise]);
      
      const latency = performance.now() - startTime;
      
      // Success
      this.consecutiveFailures = 0;
      this.lastSuccessfulCheck = timestamp;
      this.successfulChecks++;
      
      const result = this.evaluateHealth(latency, true);
      this.currentStatus = result.status;
      
      this.addToHistory(result);
      return result;
      
    } catch (error: unknown) {
      const latency = performance.now() - startTime;
      this.consecutiveFailures++;
      
      const result = this.evaluateHealth(latency, false, error);
      this.currentStatus = result.status;
      
      this.addToHistory(result);
      return result;
    }
  }

  /**
   * Evaluate health based on metrics
   */
  private evaluateHealth(
    latency: number,
    success: boolean,
    error?: unknown
  ): HealthCheckResult {
    let status: HealthStatus;
    let message: string;

    if (!success) {
      if (this.consecutiveFailures >= this.config.failureThreshold) {
        status = HealthStatus.UNHEALTHY;
        message = `Database unhealthy: ${this.consecutiveFailures} consecutive failures`;
      } else {
        status = HealthStatus.DEGRADED;
        message = `Database degraded: connection issue (${this.consecutiveFailures} failures)`;
      }

      return {
        status,
        timestamp: Date.now(),
        latency,
        message,
        error: error instanceof Error ? error.message : String(error),
        details: {
          connectionValid: false,
          responseTime: latency,
          consecutiveFailures: this.consecutiveFailures,
          totalChecks: this.totalChecks,
          successfulChecks: this.successfulChecks
        }
      };
    }

    // Success - check latency
    if (latency > this.config.unhealthyLatencyThreshold) {
      status = HealthStatus.UNHEALTHY;
      message = `Database slow: latency ${latency.toFixed(0)}ms exceeds threshold`;
    } else if (latency > this.config.degradedLatencyThreshold) {
      status = HealthStatus.DEGRADED;
      message = `Database degraded: high latency (${latency.toFixed(0)}ms)`;
    } else {
      status = HealthStatus.HEALTHY;
      message = 'Database is healthy';
    }

    return {
      status,
      timestamp: Date.now(),
      latency,
      message,
      details: {
        connectionValid: true,
        responseTime: latency,
        lastSuccessfulQuery: this.lastSuccessfulCheck ?? undefined,
        consecutiveFailures: 0,
        totalChecks: this.totalChecks,
        successfulChecks: this.successfulChecks
      }
    };
  }

  /**
   * Add result to history
   */
  private addToHistory(result: HealthCheckResult): void {
    this.healthHistory.push(result);
    
    // Trim history if needed
    while (this.healthHistory.length > this.config.maxHistorySize) {
      this.healthHistory.shift();
    }
  }

  /**
   * Start automatic health checks
   */
  startAutoCheck(): void {
    if (this.checkInterval) {
      logger.warn('Auto check already running');
      return;
    }

    this.checkInterval = setInterval(async () => {
      try {
        const result = await this.checkHealth();
        if (result.status !== HealthStatus.HEALTHY) {
          logger.warn(`Health check: ${result.status} - ${result.message}`);
        }
      } catch (error: unknown) {
        logger.error('Health check failed:', error);
      }
    }, this.config.checkInterval);

    logger.info(`Auto health check started (interval: ${this.config.checkInterval}ms)`);
  }

  /**
   * Stop automatic health checks
   */
  stopAutoCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Auto health check stopped');
    }
  }

  /**
   * Get current health status
   */
  getCurrentStatus(): HealthStatus {
    return this.currentStatus;
  }

  /**
   * Get last health check result
   */
  getLastCheck(): HealthCheckResult | null {
    return this.healthHistory.length > 0 
      ? this.healthHistory[this.healthHistory.length - 1] 
      : null;
  }

  /**
   * Get health history
   */
  getHistory(limit?: number): HealthCheckResult[] {
    if (limit) {
      return this.healthHistory.slice(-limit);
    }
    return [...this.healthHistory];
  }

  /**
   * Get health statistics
   */
  getStats(): {
    currentStatus: HealthStatus;
    totalChecks: number;
    successfulChecks: number;
    failedChecks: number;
    successRate: number;
    consecutiveFailures: number;
    lastSuccessfulCheck: number | null;
    averageLatency: number;
  } {
    const failedChecks = this.totalChecks - this.successfulChecks;
    const successRate = this.totalChecks > 0 
      ? (this.successfulChecks / this.totalChecks) * 100 
      : 0;
    
    const latencies = this.healthHistory
      .filter(h => h.status !== HealthStatus.UNHEALTHY)
      .map(h => h.latency);
    
    const averageLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    return {
      currentStatus: this.currentStatus,
      totalChecks: this.totalChecks,
      successfulChecks: this.successfulChecks,
      failedChecks,
      successRate,
      consecutiveFailures: this.consecutiveFailures,
      lastSuccessfulCheck: this.lastSuccessfulCheck,
      averageLatency
    };
  }

  /**
   * Check if database is healthy (convenience method)
   */
  isHealthy(): boolean {
    return this.currentStatus === HealthStatus.HEALTHY;
  }

  /**
   * Check if database is available (healthy or degraded)
   */
  isAvailable(): boolean {
    return this.currentStatus === HealthStatus.HEALTHY || 
           this.currentStatus === HealthStatus.DEGRADED;
  }

  /**
   * Reset health monitor state
   */
  reset(): void {
    this.healthHistory = [];
    this.consecutiveFailures = 0;
    this.lastSuccessfulCheck = null;
    this.totalChecks = 0;
    this.successfulChecks = 0;
    this.currentStatus = HealthStatus.UNKNOWN;
    logger.info('Health monitor reset');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HealthMonitorConfig>): void {
    const wasAutoCheck = this.config.autoCheck;
    this.config = { ...this.config, ...config };
    
    // Restart auto check if needed
    if (this.config.autoCheck !== wasAutoCheck) {
      if (this.config.autoCheck) {
        this.startAutoCheck();
      } else {
        this.stopAutoCheck();
      }
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.stopAutoCheck();
    this.reset();
    logger.info('Health monitor destroyed');
  }
}

// Export singleton instance
export const dbHealthMonitor = new DatabaseHealthMonitor();
