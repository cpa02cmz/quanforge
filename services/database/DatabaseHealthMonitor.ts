/**
 * Database Health Monitoring Service
 * 
 * Provides comprehensive health monitoring for database operations:
 * - Connection health checks
 * - Performance monitoring
 * - Error tracking
 * - Alerting capabilities
 * 
 * @module services/database/DatabaseHealthMonitor
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { 
  DatabaseHealthCheck
} from '../../types/database';
import { TIME_CONSTANTS, COUNT_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('DatabaseHealthMonitor');

// ============================================================================
// TYPES
// ============================================================================

interface HealthAlert {
  id: string;
  type: 'connection' | 'performance' | 'error' | 'capacity';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  metadata?: Record<string, unknown>;
}

interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    connection: HealthCheckResult;
    latency: HealthCheckResult;
    errors: HealthCheckResult;
    capacity: HealthCheckResult;
  };
  lastUpdated: Date;
}

interface HealthCheckResult {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  value?: number;
  threshold?: number;
  duration?: number;
}

type AlertCallback = (alert: HealthAlert) => void;

// ============================================================================
// HEALTH MONITOR CLASS
// ============================================================================

/**
 * Database health monitoring service
 */
export class DatabaseHealthMonitor {
  private alerts: HealthAlert[] = [];
  private healthHistory: HealthStatus[] = [];
  private alertCallbacks: AlertCallback[] = [];
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private connectionLatencies: number[] = [];
  private errorCount = 0;
  private lastErrorTime?: Date;
  
  // Thresholds
  private readonly LATENCY_WARNING_MS = 100;
  private readonly LATENCY_CRITICAL_MS = 500;
  private readonly ERROR_RATE_WARNING = 0.05; // 5%
  private readonly ERROR_RATE_CRITICAL = 0.15; // 15%
  private readonly MAX_HISTORY = COUNT_CONSTANTS.HISTORY.LARGE;

  /**
   * Initialize health monitoring
   */
  async initialize(): Promise<void> {
    logger.log('Database health monitor initialized');
    this.startPeriodicCheck();
  }

  /**
   * Shutdown health monitoring
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    logger.log('Database health monitor shutdown complete');
  }

  /**
   * Register alert callback
   */
  onAlert(callback: AlertCallback): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Record connection latency
   */
  recordLatency(latencyMs: number): void {
    this.connectionLatencies.push(latencyMs);
    
    // Keep only recent history
    if (this.connectionLatencies.length > this.MAX_HISTORY) {
      this.connectionLatencies.shift();
    }

    // Check for latency issues
    if (latencyMs > this.LATENCY_CRITICAL_MS) {
      this.createAlert('performance', 'critical', 
        `Critical latency detected: ${latencyMs.toFixed(2)}ms`,
        { latency: latencyMs }
      );
    } else if (latencyMs > this.LATENCY_WARNING_MS) {
      this.createAlert('performance', 'warning',
        `High latency detected: ${latencyMs.toFixed(2)}ms`,
        { latency: latencyMs }
      );
    }
  }

  /**
   * Record database error
   */
  recordError(error: Error, context?: string): void {
    this.errorCount++;
    this.lastErrorTime = new Date();
    
    this.createAlert('error', 'error',
      `Database error: ${error.message}`,
      { error: error.message, context }
    );
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck(
    connectionTest: () => Promise<{ success: boolean; latency: number }>
  ): Promise<DatabaseHealthCheck> {
    const startTime = performance.now();
    
    try {
      const result = await connectionTest();
      const latency = result.success ? result.latency : performance.now() - startTime;
      
      this.recordLatency(latency);

      const healthCheck: DatabaseHealthCheck = {
        is_healthy: result.success && latency < this.LATENCY_CRITICAL_MS,
        latency_ms: latency,
        connection_pool: {
          active: 0, // Would be populated by actual pool stats
          idle: 0,
          total: 0
        },
        last_check: new Date().toISOString(),
        error: result.success ? undefined : 'Connection test failed'
      };

      // Update health history
      this.updateHealthHistory(healthCheck);

      return healthCheck;
    } catch (error) {
      const latency = performance.now() - startTime;
      
      this.recordError(error instanceof Error ? error : new Error(String(error)), 'healthCheck');
      
      return {
        is_healthy: false,
        latency_ms: latency,
        connection_pool: { active: 0, idle: 0, total: 0 },
        last_check: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    const avgLatency = this.getAverageLatency();
    const errorRate = this.getErrorRate();

    const latencyStatus = this.evaluateLatency(avgLatency);
    const errorStatus = this.evaluateErrorRate(errorRate);

    const checks = {
      connection: {
        status: latencyStatus === 'fail' ? 'fail' : 'pass',
        message: latencyStatus === 'fail' ? 'Connection issues detected' : 'Connection healthy',
        value: avgLatency,
        threshold: this.LATENCY_CRITICAL_MS
      } as HealthCheckResult,
      latency: {
        status: latencyStatus,
        message: this.getLatencyMessage(avgLatency),
        value: avgLatency,
        threshold: this.LATENCY_WARNING_MS
      } as HealthCheckResult,
      errors: {
        status: errorStatus,
        message: this.getErrorMessage(errorRate),
        value: errorRate * 100,
        threshold: this.ERROR_RATE_WARNING * 100
      } as HealthCheckResult,
      capacity: {
        status: 'pass',
        message: 'Capacity within normal limits'
      } as HealthCheckResult
    };

    // Determine overall status
    const overall = this.determineOverallStatus(checks);

    return {
      overall,
      checks,
      lastUpdated: new Date()
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Get health history
   */
  getHealthHistory(limit: number = 100): HealthStatus[] {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    avgLatency: number;
    maxLatency: number;
    minLatency: number;
    p95Latency: number;
    errorCount: number;
    errorRate: number;
  } {
    const latencies = this.connectionLatencies;
    
    if (latencies.length === 0) {
      return {
        avgLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        p95Latency: 0,
        errorCount: this.errorCount,
        errorRate: 0
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      avgLatency: sum / sorted.length,
      maxLatency: sorted[sorted.length - 1],
      minLatency: sorted[0],
      p95Latency: sorted[p95Index] || sorted[sorted.length - 1],
      errorCount: this.errorCount,
      errorRate: this.getErrorRate()
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private startPeriodicCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.cleanupOldData();
    }, TIME_CONSTANTS.MINUTE * 10); // Every 10 minutes
  }

  private createAlert(
    type: HealthAlert['type'],
    severity: HealthAlert['severity'],
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    const alert: HealthAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      timestamp: new Date(),
      acknowledged: false,
      metadata
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.MAX_HISTORY) {
      this.alerts.shift();
    }

    // Notify callbacks
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Alert callback error:', error);
      }
    }

    // Log alert
    if (severity === 'critical') {
      logger.error(`[ALERT] ${message}`);
    } else if (severity === 'error') {
      logger.error(`[ALERT] ${message}`);
    } else if (severity === 'warning') {
      logger.warn(`[ALERT] ${message}`);
    } else {
      logger.log(`[ALERT] ${message}`);
    }
  }

  private updateHealthHistory(healthCheck: DatabaseHealthCheck): void {
    const status = healthCheck.is_healthy ? 'healthy' : 
      (healthCheck.latency_ms < this.LATENCY_CRITICAL_MS ? 'degraded' : 'unhealthy');

    const checks: HealthStatus['checks'] = {
      connection: {
        status: healthCheck.is_healthy ? 'pass' : 'fail',
        message: healthCheck.error || 'Connection OK',
        duration: healthCheck.latency_ms
      },
      latency: {
        status: healthCheck.latency_ms < this.LATENCY_WARNING_MS ? 'pass' :
          (healthCheck.latency_ms < this.LATENCY_CRITICAL_MS ? 'warn' : 'fail'),
        message: `Latency: ${healthCheck.latency_ms.toFixed(2)}ms`,
        value: healthCheck.latency_ms
      },
      errors: {
        status: this.errorCount > 0 ? 'warn' : 'pass',
        message: `${this.errorCount} errors recorded`
      },
      capacity: {
        status: 'pass',
        message: 'Capacity OK'
      }
    };

    this.healthHistory.push({
      overall: status,
      checks,
      lastUpdated: new Date()
    });

    // Keep only recent history
    if (this.healthHistory.length > this.MAX_HISTORY) {
      this.healthHistory.shift();
    }
  }

  private getAverageLatency(): number {
    if (this.connectionLatencies.length === 0) return 0;
    const sum = this.connectionLatencies.reduce((a, b) => a + b, 0);
    return sum / this.connectionLatencies.length;
  }

  private getErrorRate(): number {
    const totalOps = this.connectionLatencies.length + this.errorCount;
    if (totalOps === 0) return 0;
    return this.errorCount / totalOps;
  }

  private evaluateLatency(latency: number): 'pass' | 'warn' | 'fail' {
    if (latency < this.LATENCY_WARNING_MS) return 'pass';
    if (latency < this.LATENCY_CRITICAL_MS) return 'warn';
    return 'fail';
  }

  private evaluateErrorRate(rate: number): 'pass' | 'warn' | 'fail' {
    if (rate < this.ERROR_RATE_WARNING) return 'pass';
    if (rate < this.ERROR_RATE_CRITICAL) return 'warn';
    return 'fail';
  }

  private getLatencyMessage(latency: number): string {
    if (latency < this.LATENCY_WARNING_MS) {
      return `Latency healthy (${latency.toFixed(2)}ms)`;
    }
    if (latency < this.LATENCY_CRITICAL_MS) {
      return `Latency elevated (${latency.toFixed(2)}ms)`;
    }
    return `Latency critical (${latency.toFixed(2)}ms)`;
  }

  private getErrorMessage(rate: number): string {
    const percent = (rate * 100).toFixed(2);
    if (rate < this.ERROR_RATE_WARNING) {
      return `Error rate normal (${percent}%)`;
    }
    if (rate < this.ERROR_RATE_CRITICAL) {
      return `Error rate elevated (${percent}%)`;
    }
    return `Error rate critical (${percent}%)`;
  }

  private determineOverallStatus(checks: HealthStatus['checks']): HealthStatus['overall'] {
    const values = Object.values(checks);
    
    if (values.some(c => c.status === 'fail')) {
      return 'unhealthy';
    }
    if (values.some(c => c.status === 'warn')) {
      return 'degraded';
    }
    return 'healthy';
  }

  private cleanupOldData(): void {
    // Clean up acknowledged alerts older than 24 hours
    const cutoff = new Date(Date.now() - TIME_CONSTANTS.DAY);
    this.alerts = this.alerts.filter(a => 
      !a.acknowledged || a.timestamp > cutoff
    );
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const databaseHealthMonitor = new DatabaseHealthMonitor();
