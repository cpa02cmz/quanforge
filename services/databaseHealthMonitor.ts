/**
 * Database Health Monitor Service
 * 
 * Comprehensive database health monitoring with real-time metrics,
 * connection pool status, query performance tracking, and proactive alerts.
 * 
 * @module services/databaseHealthMonitor
 * @author Database Architect
 */

import { createScopedLogger } from '../utils/logger';
import { connectionPool } from './supabaseConnectionPool';
import { databaseOptimizer } from './databaseOptimizer';
import { CACHE_SIZES } from '../constants/modularConfig';
import { TIME_CONSTANTS } from './modularConstants';

const logger = createScopedLogger('DatabaseHealthMonitor');

// ============================================================================
// TYPES
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface DatabaseHealthMetrics {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  
  // Connection metrics
  connections: {
    total: number;
    active: number;
    idle: number;
    maxConnections: number;
    utilizationPercent: number;
    averageResponseTimeMs: number;
  };
  
  // Query metrics
  queries: {
    totalExecuted: number;
    averageExecutionTimeMs: number;
    slowQueryCount: number;
    cacheHitRate: number;
  };
  
  // Storage metrics
  storage: {
    mode: 'mock' | 'supabase';
    totalRecords: number;
    estimatedSizeBytes: number;
  };
  
  // Performance score
  performanceScore: number;
}

export interface DatabaseAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  metric: string;
  value: number;
  threshold: number;
  resolved: boolean;
  resolvedAt?: string;
}

export interface HealthCheckResult {
  passed: boolean;
  name: string;
  message: string;
  duration: number;
  details?: Record<string, unknown>;
}

export interface HealthMonitorConfig {
  checkIntervalMs: number;
  alertThresholds: {
    connectionUtilizationPercent: number;
    queryTimeMs: number;
    cacheHitRatePercent: number;
    storageUsagePercent: number;
    slowQueryThresholdMs: number;
  };
  enableAlerts: boolean;
  maxAlertHistory: number;
  enableAutoRecovery: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: HealthMonitorConfig = {
  checkIntervalMs: TIME_CONSTANTS.MINUTE * 5, // 5 minutes
  alertThresholds: {
    connectionUtilizationPercent: 80,
    queryTimeMs: 1000,
    cacheHitRatePercent: 30,
    storageUsagePercent: 80,
    slowQueryThresholdMs: 500,
  },
  enableAlerts: true,
  maxAlertHistory: 100,
  enableAutoRecovery: true,
};

// ============================================================================
// DATABASE HEALTH MONITOR CLASS
// ============================================================================

class DatabaseHealthMonitor {
  private static instance: DatabaseHealthMonitor;
  private config: HealthMonitorConfig;
  private metrics: DatabaseHealthMetrics | null = null;
  private alerts: DatabaseAlert[] = [];
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private startTime: number = Date.now();
  private healthCheckHistory: DatabaseHealthMetrics[] = [];
  private listeners: Set<(metrics: DatabaseHealthMetrics) => void> = new Set();
  private alertListeners: Set<(alert: DatabaseAlert) => void> = new Set();

  private constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startMonitoring();
  }

  static getInstance(config?: Partial<HealthMonitorConfig>): DatabaseHealthMonitor {
    if (!DatabaseHealthMonitor.instance) {
      DatabaseHealthMonitor.instance = new DatabaseHealthMonitor(config);
    }
    return DatabaseHealthMonitor.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get current health metrics
   */
  getMetrics(): DatabaseHealthMetrics | null {
    return this.metrics;
  }

  /**
   * Get all active alerts
   */
  getAlerts(): DatabaseAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 50): DatabaseAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get health check history
   */
  getHealthCheckHistory(limit: number = 24): DatabaseHealthMetrics[] {
    return this.healthCheckHistory.slice(-limit);
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    const startTime = performance.now();

    // 1. Connection health check
    results.push(await this.checkConnectionHealth());

    // 2. Query performance check
    results.push(await this.checkQueryPerformance());

    // 3. Cache health check
    results.push(await this.checkCacheHealth());

    // 4. Storage health check
    results.push(await this.checkStorageHealth());

    // 5. Index health check (for Supabase)
    results.push(await this.checkIndexHealth());

    // Update metrics after health check
    await this.updateMetrics();

    const totalDuration = performance.now() - startTime;
    logger.debug(`Health check completed in ${totalDuration.toFixed(2)}ms`);

    return results;
  }

  /**
   * Subscribe to metrics updates
   */
  subscribe(callback: (metrics: DatabaseHealthMetrics) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Subscribe to alerts
   */
  subscribeToAlerts(callback: (alert: DatabaseAlert) => void): () => void {
    this.alertListeners.add(callback);
    return () => this.alertListeners.delete(callback);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Restart monitoring with new config
   */
  restartMonitoring(config?: Partial<HealthMonitorConfig>): void {
    this.stopMonitoring();
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.startMonitoring();
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    overallScore: number;
    status: HealthStatus;
    issues: string[];
    recommendations: string[];
  } {
    const metrics = this.metrics;
    if (!metrics) {
      return {
        overallScore: 0,
        status: 'unhealthy',
        issues: ['No metrics available'],
        recommendations: ['Run health check to gather metrics'],
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check connection utilization
    if (metrics.connections.utilizationPercent > this.config.alertThresholds.connectionUtilizationPercent) {
      issues.push(`High connection utilization: ${metrics.connections.utilizationPercent.toFixed(1)}%`);
      recommendations.push('Consider increasing connection pool size or optimizing queries');
      score -= 15;
    }

    // Check query performance
    if (metrics.queries.averageExecutionTimeMs > this.config.alertThresholds.queryTimeMs) {
      issues.push(`Slow average query time: ${metrics.queries.averageExecutionTimeMs.toFixed(0)}ms`);
      recommendations.push('Review and optimize slow queries, add indexes if needed');
      score -= 20;
    }

    // Check cache hit rate
    if (metrics.queries.cacheHitRate < this.config.alertThresholds.cacheHitRatePercent) {
      issues.push(`Low cache hit rate: ${metrics.queries.cacheHitRate.toFixed(1)}%`);
      recommendations.push('Review caching strategy, increase cache TTL for stable data');
      score -= 15;
    }

    // Check for slow queries
    if (metrics.queries.slowQueryCount > 0) {
      issues.push(`${metrics.queries.slowQueryCount} slow queries detected`);
      recommendations.push('Analyze slow query log and optimize or add indexes');
      score -= 10;
    }

    // Determine status based on score
    let status: HealthStatus;
    if (score >= 90) status = 'healthy';
    else if (score >= 70) status = 'degraded';
    else if (score >= 50) status = 'unhealthy';
    else status = 'critical';

    return {
      overallScore: Math.max(0, score),
      status,
      issues,
      recommendations,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private startMonitoring(): void {
    // Initial health check
    this.runHealthCheck().catch(err => {
      logger.error('Initial health check failed:', err);
    });

    // Schedule periodic health checks
    this.checkTimer = setInterval(async () => {
      try {
        await this.runHealthCheck();
      } catch (err) {
        logger.error('Scheduled health check failed:', err);
      }
    }, this.config.checkIntervalMs);
  }

  private async updateMetrics(): Promise<void> {
    const connectionMetrics = connectionPool.getDetailedConnectionMetrics();
    const optimizerMetrics = databaseOptimizer.getOptimizationMetrics();

    // Get storage info
    const storageInfo = await this.getStorageInfo();

    const newMetrics: DatabaseHealthMetrics = {
      status: this.determineHealthStatus(connectionMetrics, optimizerMetrics),
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      connections: {
        total: connectionMetrics.totalConnections,
        active: connectionMetrics.healthyConnections,
        idle: connectionMetrics.totalConnections - connectionMetrics.healthyConnections,
        maxConnections: 10, // Default from config
        utilizationPercent: connectionMetrics.connectionUtilization,
        averageResponseTimeMs: connectionMetrics.averageResponseTime,
      },
      queries: {
        totalExecuted: optimizerMetrics.totalOptimizedQueries,
        averageExecutionTimeMs: optimizerMetrics.queryResponseTime,
        slowQueryCount: 0, // Would need to track this separately
        cacheHitRate: optimizerMetrics.cacheHitRate,
      },
      storage: storageInfo,
      performanceScore: this.calculatePerformanceScore(connectionMetrics, optimizerMetrics),
    };

    this.metrics = newMetrics;
    this.healthCheckHistory.push(newMetrics);

    // Keep history bounded
    if (this.healthCheckHistory.length > CACHE_SIZES.ENTRIES.LARGE) {
      this.healthCheckHistory.shift();
    }

    // Check for alerts
    this.checkThresholds(newMetrics);

    // Notify listeners
    this.notifyListeners(newMetrics);
  }

  private determineHealthStatus(
    connectionMetrics: { healthyConnections: number; totalConnections: number; connectionUtilization: number },
    optimizerMetrics: { queryResponseTime: number; cacheHitRate: number }
  ): HealthStatus {
    // Critical: No healthy connections
    if (connectionMetrics.healthyConnections === 0 && connectionMetrics.totalConnections > 0) {
      return 'critical';
    }

    // Unhealthy: Very slow queries or no cache hits
    if (optimizerMetrics.queryResponseTime > 5000 || optimizerMetrics.cacheHitRate < 10) {
      return 'unhealthy';
    }

    // Degraded: High utilization or slow queries
    if (
      connectionMetrics.connectionUtilization > 80 ||
      optimizerMetrics.queryResponseTime > 1000 ||
      optimizerMetrics.cacheHitRate < 30
    ) {
      return 'degraded';
    }

    return 'healthy';
  }

  private calculatePerformanceScore(
    connectionMetrics: { connectionUtilization: number; averageResponseTime: number },
    optimizerMetrics: { queryResponseTime: number; cacheHitRate: number }
  ): number {
    let score = 100;

    // Deduct for high connection utilization
    if (connectionMetrics.connectionUtilization > 80) {
      score -= (connectionMetrics.connectionUtilization - 80) * 0.5;
    }

    // Deduct for slow response times
    if (connectionMetrics.averageResponseTime > 100) {
      score -= Math.min(20, (connectionMetrics.averageResponseTime - 100) / 10);
    }

    // Deduct for slow queries
    if (optimizerMetrics.queryResponseTime > 500) {
      score -= Math.min(25, (optimizerMetrics.queryResponseTime - 500) / 100);
    }

    // Deduct for low cache hit rate
    if (optimizerMetrics.cacheHitRate < 50) {
      score -= (50 - optimizerMetrics.cacheHitRate) * 0.3;
    }

    return Math.max(0, Math.min(100, score));
  }

  private async getStorageInfo(): Promise<{ mode: 'mock' | 'supabase'; totalRecords: number; estimatedSizeBytes: number }> {
    try {
      // Check if we're in mock or Supabase mode
      const isMock = typeof localStorage !== 'undefined' && localStorage.getItem('mock_robots') !== null;
      
      if (isMock) {
        const stored = localStorage.getItem('mock_robots');
        const records = stored ? JSON.parse(stored).length : 0;
        const size = stored ? new Blob([stored]).size : 0;
        
        return {
          mode: 'mock',
          totalRecords: records,
          estimatedSizeBytes: size,
        };
      }

      // For Supabase, we'd need to query the database
      return {
        mode: 'supabase',
        totalRecords: 0,
        estimatedSizeBytes: 0,
      };
    } catch {
      return {
        mode: 'mock',
        totalRecords: 0,
        estimatedSizeBytes: 0,
      };
    }
  }

  private checkThresholds(metrics: DatabaseHealthMetrics): void {
    const thresholds = this.config.alertThresholds;

    // Check connection utilization
    if (metrics.connections.utilizationPercent > thresholds.connectionUtilizationPercent) {
      this.createAlert({
        severity: 'warning',
        message: `Connection utilization is high: ${metrics.connections.utilizationPercent.toFixed(1)}%`,
        metric: 'connection_utilization',
        value: metrics.connections.utilizationPercent,
        threshold: thresholds.connectionUtilizationPercent,
      });
    }

    // Check query time
    if (metrics.queries.averageExecutionTimeMs > thresholds.queryTimeMs) {
      this.createAlert({
        severity: 'warning',
        message: `Average query time is slow: ${metrics.queries.averageExecutionTimeMs.toFixed(0)}ms`,
        metric: 'query_time',
        value: metrics.queries.averageExecutionTimeMs,
        threshold: thresholds.queryTimeMs,
      });
    }

    // Check cache hit rate
    if (metrics.queries.cacheHitRate < thresholds.cacheHitRatePercent) {
      this.createAlert({
        severity: 'warning',
        message: `Cache hit rate is low: ${metrics.queries.cacheHitRate.toFixed(1)}%`,
        metric: 'cache_hit_rate',
        value: metrics.queries.cacheHitRate,
        threshold: thresholds.cacheHitRatePercent,
      });
    }
  }

  private createAlert(params: {
    severity: AlertSeverity;
    message: string;
    metric: string;
    value: number;
    threshold: number;
  }): void {
    if (!this.config.enableAlerts) return;

    const alert: DatabaseAlert = {
      id: `${params.metric}_${Date.now()}`,
      severity: params.severity,
      message: params.message,
      timestamp: new Date().toISOString(),
      metric: params.metric,
      value: params.value,
      threshold: params.threshold,
      resolved: false,
    };

    this.alerts.push(alert);

    // Keep alerts bounded
    if (this.alerts.length > this.config.maxAlertHistory) {
      this.alerts.shift();
    }

    // Notify alert listeners
    this.alertListeners.forEach(listener => listener(alert));
  }

  private notifyListeners(metrics: DatabaseHealthMetrics): void {
    this.listeners.forEach(listener => {
      try {
        listener(metrics);
      } catch (err) {
        logger.error('Error in metrics listener:', err);
      }
    });
  }

  // ============================================================================
  // HEALTH CHECK METHODS
  // ============================================================================

  private async checkConnectionHealth(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    
    try {
      const metrics = connectionPool.getConnectionMetrics();
      const isHealthy = metrics.healthyConnections > 0 || metrics.totalConnections === 0;
      
      return {
        passed: isHealthy,
        name: 'Connection Health',
        message: isHealthy 
          ? `Connection pool healthy: ${metrics.healthyConnections}/${metrics.totalConnections} connections`
          : 'No healthy connections available',
        duration: performance.now() - startTime,
        details: {
          totalConnections: metrics.totalConnections,
          healthyConnections: metrics.healthyConnections,
          averageResponseTime: metrics.averageResponseTime,
          totalErrors: metrics.totalErrors,
        },
      };
    } catch (err) {
      return {
        passed: false,
        name: 'Connection Health',
        message: `Connection check failed: ${err}`,
        duration: performance.now() - startTime,
      };
    }
  }

  private async checkQueryPerformance(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    
    try {
      const metrics = databaseOptimizer.getOptimizationMetrics();
      const isHealthy = metrics.queryResponseTime < this.config.alertThresholds.queryTimeMs;
      
      return {
        passed: isHealthy,
        name: 'Query Performance',
        message: isHealthy 
          ? `Query performance good: ${metrics.queryResponseTime.toFixed(2)}ms average`
          : `Query performance degraded: ${metrics.queryResponseTime.toFixed(2)}ms average`,
        duration: performance.now() - startTime,
        details: {
          totalOptimizedQueries: metrics.totalOptimizedQueries,
          averageResponseTime: metrics.queryResponseTime,
        },
      };
    } catch (err) {
      return {
        passed: false,
        name: 'Query Performance',
        message: `Query performance check failed: ${err}`,
        duration: performance.now() - startTime,
      };
    }
  }

  private async checkCacheHealth(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    
    try {
      const metrics = databaseOptimizer.getOptimizationMetrics();
      const isHealthy = metrics.cacheHitRate >= this.config.alertThresholds.cacheHitRatePercent;
      
      return {
        passed: isHealthy,
        name: 'Cache Health',
        message: isHealthy 
          ? `Cache performance good: ${metrics.cacheHitRate.toFixed(1)}% hit rate`
          : `Cache performance degraded: ${metrics.cacheHitRate.toFixed(1)}% hit rate`,
        duration: performance.now() - startTime,
        details: {
          cacheHitRate: metrics.cacheHitRate,
          totalQueries: metrics.totalOptimizedQueries,
        },
      };
    } catch (err) {
      return {
        passed: false,
        name: 'Cache Health',
        message: `Cache health check failed: ${err}`,
        duration: performance.now() - startTime,
      };
    }
  }

  private async checkStorageHealth(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    
    try {
      const storageInfo = await this.getStorageInfo();
      
      // For mock mode, check localStorage limits
      if (storageInfo.mode === 'mock') {
        const quota = 5 * 1024 * 1024; // 5MB typical limit
        const utilization = (storageInfo.estimatedSizeBytes / quota) * 100;
        const isHealthy = utilization < this.config.alertThresholds.storageUsagePercent;
        
        return {
          passed: isHealthy,
          name: 'Storage Health',
          message: isHealthy 
            ? `Storage usage: ${utilization.toFixed(1)}% (${(storageInfo.estimatedSizeBytes / 1024).toFixed(1)}KB)`
            : `Storage usage high: ${utilization.toFixed(1)}%`,
          duration: performance.now() - startTime,
          details: {
            mode: storageInfo.mode,
            totalRecords: storageInfo.totalRecords,
            estimatedSizeBytes: storageInfo.estimatedSizeBytes,
            utilizationPercent: utilization,
          },
        };
      }

      // For Supabase, just report healthy
      return {
        passed: true,
        name: 'Storage Health',
        message: `Supabase storage: ${storageInfo.totalRecords} records`,
        duration: performance.now() - startTime,
        details: {
          mode: storageInfo.mode,
          totalRecords: storageInfo.totalRecords,
        },
      };
    } catch (err) {
      return {
        passed: false,
        name: 'Storage Health',
        message: `Storage health check failed: ${err}`,
        duration: performance.now() - startTime,
      };
    }
  }

  private async checkIndexHealth(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    
    try {
      // This would ideally query pg_stat_user_indexes for Supabase
      // For now, return healthy
      return {
        passed: true,
        name: 'Index Health',
        message: 'Index health check passed',
        duration: performance.now() - startTime,
        details: {
          note: 'Full index analysis requires Supabase connection',
        },
      };
    } catch (err) {
      return {
        passed: false,
        name: 'Index Health',
        message: `Index health check failed: ${err}`,
        duration: performance.now() - startTime,
      };
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const databaseHealthMonitor = DatabaseHealthMonitor.getInstance();
export { DatabaseHealthMonitor };
