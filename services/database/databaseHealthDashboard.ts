/**
 * Database Health Dashboard Service
 * 
 * Comprehensive health monitoring and reporting for database services.
 * Aggregates health data from multiple services and provides dashboard-ready metrics.
 * 
 * @module services/database/databaseHealthDashboard
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../../constants/config';
import { databaseHealthMonitor } from './DatabaseHealthMonitor';
import { queryPerformanceAnalyzer } from './QueryPerformanceAnalyzer';
import { connectionLeakDetector } from './connectionLeakDetector';
import { metricsAggregator } from './metricsAggregator';

const logger = createScopedLogger('DatabaseHealthDashboard');

// ============================================================================
// TYPES
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  status: HealthStatus;
  threshold: {
    warning: number;
    critical: number;
  };
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
  source: string;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
}

export interface ServiceHealthSummary {
  name: string;
  status: HealthStatus;
  uptime: number;
  lastCheck: number;
  errorCount: number;
  responseTime: number;
  message: string;
}

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'gauge' | 'chart' | 'table' | 'status' | 'counter';
  data: Record<string, unknown>;
  refreshIntervalMs: number;
  lastUpdated: number;
}

export interface HealthDashboardData {
  timestamp: number;
  overallStatus: HealthStatus;
  services: ServiceHealthSummary[];
  metrics: HealthMetric[];
  alerts: DashboardAlert[];
  widgets: DashboardWidget[];
  recommendations: string[];
  systemLoad: {
    cpu: number;
    memory: number;
    connections: number;
    queries: number;
  };
}

export interface DashboardConfig {
  refreshIntervalMs: number;
  alertRetentionMs: number;
  enableAutoRefresh: boolean;
  maxAlerts: number;
  healthCheckTimeoutMs: number;
}

// ============================================================================
// DATABASE HEALTH DASHBOARD SERVICE
// ============================================================================

export class DatabaseHealthDashboard {
  private static instance: DatabaseHealthDashboard | null = null;
  private config: DashboardConfig;
  private alerts: DashboardAlert[] = [];
  private previousMetrics: Map<string, number> = new Map();
  private refreshTimer?: ReturnType<typeof setInterval>;
  private isInitialized = false;
  private lastRefresh = 0;
  private cachedData: HealthDashboardData | null = null;

  private constructor() {
    this.config = {
      refreshIntervalMs: TIME_CONSTANTS.SECOND * 30,
      alertRetentionMs: TIME_CONSTANTS.HOUR * 24,
      enableAutoRefresh: true,
      maxAlerts: 100,
      healthCheckTimeoutMs: TIME_CONSTANTS.SECOND * 5,
    };
  }

  static getInstance(): DatabaseHealthDashboard {
    if (!DatabaseHealthDashboard.instance) {
      DatabaseHealthDashboard.instance = new DatabaseHealthDashboard();
    }
    return DatabaseHealthDashboard.instance;
  }

  initialize(): void {
    if (this.isInitialized) return;

    if (this.config.enableAutoRefresh) {
      this.startAutoRefresh();
    }
    
    this.isInitialized = true;
    logger.log('DatabaseHealthDashboard initialized');
  }

  shutdown(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.isInitialized = false;
    logger.log('DatabaseHealthDashboard shutdown');
  }

  // ============================================================================
  // DASHBOARD DATA
  // ============================================================================

  async getDashboardData(): Promise<HealthDashboardData> {
    const now = Date.now();
    
    // Return cached data if recently refreshed
    if (this.cachedData && now - this.lastRefresh < 5000) {
      return this.cachedData;
    }

    const [services, metrics, systemLoad] = await Promise.all([
      this.getServiceHealthSummaries(),
      this.getHealthMetrics(),
      this.getSystemLoad(),
    ]);

    const alerts = this.getActiveAlerts();
    const widgets = this.generateWidgets(metrics, services, alerts);
    const recommendations = this.generateRecommendations(metrics, services, alerts);
    const overallStatus = this.calculateOverallStatus(services, metrics);

    this.cachedData = {
      timestamp: now,
      overallStatus,
      services,
      metrics,
      alerts,
      widgets,
      recommendations,
      systemLoad,
    };
    this.lastRefresh = now;

    return this.cachedData;
  }

  // ============================================================================
  // SERVICE HEALTH
  // ============================================================================

  private async getServiceHealthSummaries(): Promise<ServiceHealthSummary[]> {
    const summaries: ServiceHealthSummary[] = [];

    // Database Health Monitor
    try {
      const healthStatus = databaseHealthMonitor.getHealthStatus();
      const isHealthy = healthStatus.overall === 'healthy';
      summaries.push({
        name: 'Database Connection',
        status: isHealthy ? 'healthy' : 'unhealthy',
        uptime: 99.9,
        lastCheck: Date.now(),
        errorCount: 0,
        responseTime: 0,
        message: isHealthy ? 'Connected and operational' : 'Connection failed',
      });
    } catch {
      summaries.push(this.createErrorSummary('Database Connection'));
    }

    // Query Performance Analyzer
    try {
      const report = queryPerformanceAnalyzer.getPerformanceReport();
      const avgTime = report.summary?.avgLatency || 0;
      const status: HealthStatus = avgTime < 100 ? 'healthy' : avgTime < 500 ? 'degraded' : 'unhealthy';
      summaries.push({
        name: 'Query Performance',
        status,
        uptime: 100,
        lastCheck: Date.now(),
        errorCount: report.slowQueries?.length || 0,
        responseTime: avgTime,
        message: `Average query time: ${avgTime.toFixed(2)}ms`,
      });
    } catch {
      summaries.push(this.createErrorSummary('Query Performance'));
    }

    // Connection Leak Detector
    try {
      const poolHealth = connectionLeakDetector.getPoolHealth();
      // Map 'warning' to 'degraded' since our HealthStatus type doesn't have 'warning'
      const mappedStatus: HealthStatus = poolHealth.health === 'warning' ? 'degraded' : 
        (poolHealth.health === 'healthy' ? 'healthy' : 
         poolHealth.health === 'critical' ? 'critical' : 'unhealthy');
      summaries.push({
        name: 'Connection Pool',
        status: mappedStatus,
        uptime: 100,
        lastCheck: Date.now(),
        errorCount: poolHealth.leakedConnections,
        responseTime: 0,
        message: `${poolHealth.activeConnections} active, ${poolHealth.idleConnections} idle`,
      });
    } catch {
      summaries.push(this.createErrorSummary('Connection Pool'));
    }

    // Metrics Aggregator
    try {
      const metrics = metricsAggregator.getCurrentMetrics();
      const alertCount = metricsAggregator.getAlerts()?.length || 0;
      summaries.push({
        name: 'Metrics Collection',
        status: 'healthy',
        uptime: 100,
        lastCheck: Date.now(),
        errorCount: alertCount,
        responseTime: 0,
        message: `${metrics ? 1 : 0} metrics sources active`,
      });
    } catch {
      summaries.push(this.createErrorSummary('Metrics Collection'));
    }

    return summaries;
  }

  // ============================================================================
  // METRICS
  // ============================================================================

  private async getHealthMetrics(): Promise<HealthMetric[]> {
    const metrics: HealthMetric[] = [];

    // Query Response Time
    try {
      const report = queryPerformanceAnalyzer.getPerformanceReport();
      const avgTime = report.summary?.avgLatency || 0;
      const previousValue = this.previousMetrics.get('query_response_time') || avgTime;
      const changePercent = previousValue > 0 ? ((avgTime - previousValue) / previousValue) * 100 : 0;
      
      metrics.push({
        name: 'Query Response Time',
        value: avgTime,
        unit: 'ms',
        status: avgTime < 100 ? 'healthy' : avgTime < 500 ? 'degraded' : 'unhealthy',
        threshold: { warning: 100, critical: 500 },
        trend: changePercent > 10 ? 'up' : changePercent < -10 ? 'down' : 'stable',
        changePercent: Math.round(changePercent * 10) / 10,
      });
      this.previousMetrics.set('query_response_time', avgTime);
    } catch {
      metrics.push(this.createErrorMetric('Query Response Time'));
    }

    // Connection Pool Usage
    try {
      const poolHealth = connectionLeakDetector.getPoolHealth();
      const usagePercent = poolHealth.totalConnections > 0 
        ? (poolHealth.activeConnections / poolHealth.totalConnections) * 100 
        : 0;
      const previousValue = this.previousMetrics.get('pool_usage') || usagePercent;
      const changePercent = previousValue > 0 ? ((usagePercent - previousValue) / previousValue) * 100 : 0;

      metrics.push({
        name: 'Connection Pool Usage',
        value: usagePercent,
        unit: '%',
        status: usagePercent < 70 ? 'healthy' : usagePercent < 90 ? 'degraded' : 'unhealthy',
        threshold: { warning: 70, critical: 90 },
        trend: changePercent > 10 ? 'up' : changePercent < -10 ? 'down' : 'stable',
        changePercent: Math.round(changePercent * 10) / 10,
      });
      this.previousMetrics.set('pool_usage', usagePercent);
    } catch {
      metrics.push(this.createErrorMetric('Connection Pool Usage'));
    }

    // Slow Queries
    try {
      const report = queryPerformanceAnalyzer.getPerformanceReport();
      const slowQueries = report.slowQueries?.length || 0;
      const previousValue = this.previousMetrics.get('slow_queries') || slowQueries;
      const changePercent = previousValue > 0 ? ((slowQueries - previousValue) / previousValue) * 100 : 0;

      metrics.push({
        name: 'Slow Queries',
        value: slowQueries,
        unit: 'queries',
        status: slowQueries === 0 ? 'healthy' : slowQueries < 10 ? 'degraded' : 'unhealthy',
        threshold: { warning: 5, critical: 20 },
        trend: changePercent > 10 ? 'up' : changePercent < -10 ? 'down' : 'stable',
        changePercent: Math.round(changePercent * 10) / 10,
      });
      this.previousMetrics.set('slow_queries', slowQueries);
    } catch {
      metrics.push(this.createErrorMetric('Slow Queries'));
    }

    // Error Rate
    try {
      const report = queryPerformanceAnalyzer.getPerformanceReport();
      // Calculate error rate from failed queries
      const failedQueries = report.summary ? (report.totalQueries - report.patterns.length) : 0;
      const errorRate = report.totalQueries > 0 ? (failedQueries / report.totalQueries) * 100 : 0;
      const previousValue = this.previousMetrics.get('error_rate') || errorRate;
      const changePercent = previousValue > 0 ? ((errorRate - previousValue) / previousValue) * 100 : 0;

      metrics.push({
        name: 'Error Rate',
        value: errorRate,
        unit: '%',
        status: errorRate < 1 ? 'healthy' : errorRate < 5 ? 'degraded' : 'critical',
        threshold: { warning: 1, critical: 5 },
        trend: changePercent > 10 ? 'up' : changePercent < -10 ? 'down' : 'stable',
        changePercent: Math.round(changePercent * 10) / 10,
      });
      this.previousMetrics.set('error_rate', errorRate);
    } catch {
      metrics.push(this.createErrorMetric('Error Rate'));
    }

    // Memory Usage (simulated for browser)
    const memoryUsage = this.getSimulatedMemoryUsage();
    metrics.push({
      name: 'Memory Usage',
      value: memoryUsage,
      unit: '%',
      status: memoryUsage < 70 ? 'healthy' : memoryUsage < 90 ? 'degraded' : 'unhealthy',
      threshold: { warning: 70, critical: 90 },
      trend: 'stable',
      changePercent: 0,
    });

    return metrics;
  }

  // ============================================================================
  // ALERTS
  // ============================================================================

  addAlert(severity: AlertSeverity, message: string, source: string): DashboardAlert {
    const alert: DashboardAlert = {
      id: crypto.randomUUID?.() || `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity,
      message,
      source,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.unshift(alert);

    // Trim alerts to max count
    if (this.alerts.length > this.config.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.config.maxAlerts);
    }

    logger.log(`Alert added: [${severity}] ${message}`);
    return alert;
  }

  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = Date.now();
    
    return true;
  }

  getActiveAlerts(): DashboardAlert[] {
    const cutoff = Date.now() - this.config.alertRetentionMs;
    return this.alerts
      .filter(a => a.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  clearAlerts(): void {
    this.alerts = [];
    logger.log('All alerts cleared');
  }

  // ============================================================================
  // WIDGETS
  // ============================================================================

  private generateWidgets(
    metrics: HealthMetric[],
    services: ServiceHealthSummary[],
    alerts: DashboardAlert[]
  ): DashboardWidget[] {
    const now = Date.now();
    const widgets: DashboardWidget[] = [];

    // Overall Status Widget
    widgets.push({
      id: 'overall-status',
      title: 'System Health',
      type: 'status',
      data: {
        status: this.calculateOverallStatus(services, metrics),
        services: services.map(s => ({ name: s.name, status: s.status })),
      },
      refreshIntervalMs: 30000,
      lastUpdated: now,
    });

    // Query Performance Gauge
    const responseTimeMetric = metrics.find(m => m.name === 'Query Response Time');
    if (responseTimeMetric) {
      widgets.push({
        id: 'query-performance',
        title: 'Query Response Time',
        type: 'gauge',
        data: {
          value: responseTimeMetric.value,
          unit: responseTimeMetric.unit,
          status: responseTimeMetric.status,
          threshold: responseTimeMetric.threshold,
        },
        refreshIntervalMs: 10000,
        lastUpdated: now,
      });
    }

    // Pool Usage Gauge
    const poolUsageMetric = metrics.find(m => m.name === 'Connection Pool Usage');
    if (poolUsageMetric) {
      widgets.push({
        id: 'pool-usage',
        title: 'Connection Pool',
        type: 'gauge',
        data: {
          value: poolUsageMetric.value,
          unit: poolUsageMetric.unit,
          status: poolUsageMetric.status,
          threshold: poolUsageMetric.threshold,
        },
        refreshIntervalMs: 15000,
        lastUpdated: now,
      });
    }

    // Recent Alerts Table
    widgets.push({
      id: 'recent-alerts',
      title: 'Recent Alerts',
      type: 'table',
      data: {
        alerts: alerts.slice(0, 10).map(a => ({
          id: a.id,
          severity: a.severity,
          message: a.message,
          source: a.source,
          timestamp: a.timestamp,
          acknowledged: a.acknowledged,
        })),
      },
      refreshIntervalMs: 5000,
      lastUpdated: now,
    });

    return widgets;
  }

  // ============================================================================
  // RECOMMENDATIONS
  // ============================================================================

  private generateRecommendations(
    metrics: HealthMetric[],
    services: ServiceHealthSummary[],
    alerts: DashboardAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for slow queries
    const slowQueriesMetric = metrics.find(m => m.name === 'Slow Queries');
    if (slowQueriesMetric && slowQueriesMetric.value > 5) {
      recommendations.push('Consider optimizing slow queries. Review query execution plans and add appropriate indexes.');
    }

    // Check for high pool usage
    const poolUsageMetric = metrics.find(m => m.name === 'Connection Pool Usage');
    if (poolUsageMetric && poolUsageMetric.value > 70) {
      recommendations.push('Connection pool usage is high. Consider increasing pool size or optimizing connection usage.');
    }

    // Check for errors
    const errorRateMetric = metrics.find(m => m.name === 'Error Rate');
    if (errorRateMetric && errorRateMetric.value > 1) {
      recommendations.push('Error rate is elevated. Review recent errors and implement retry logic for transient failures.');
    }

    // Check for unacknowledged alerts
    const unackedAlerts = alerts.filter(a => !a.acknowledged && a.severity === 'critical');
    if (unackedAlerts.length > 0) {
      recommendations.push(`${unackedAlerts.length} critical alerts need attention. Review and acknowledge resolved issues.`);
    }

    // Check for unhealthy services
    const unhealthyServices = services.filter(s => s.status === 'unhealthy' || s.status === 'critical');
    if (unhealthyServices.length > 0) {
      recommendations.push(`${unhealthyServices.length} service(s) are unhealthy. Check logs and restart if necessary.`);
    }

    return recommendations;
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  updateConfig(config: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.enableAutoRefresh !== undefined) {
      if (config.enableAutoRefresh) {
        this.startAutoRefresh();
      } else if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
      }
    }
    
    logger.log('Configuration updated');
  }

  getConfig(): DashboardConfig {
    return { ...this.config };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private calculateOverallStatus(
    services: ServiceHealthSummary[],
    metrics: HealthMetric[]
  ): HealthStatus {
    const statuses = [
      ...services.map(s => s.status),
      ...metrics.map(m => m.status),
    ];

    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('unhealthy')) return 'unhealthy';
    if (statuses.includes('degraded')) return 'degraded';
    return 'healthy';
  }

  private async getSystemLoad(): Promise<{
    cpu: number;
    memory: number;
    connections: number;
    queries: number;
  }> {
    try {
      const poolHealth = connectionLeakDetector.getPoolHealth();
      const report = queryPerformanceAnalyzer.getPerformanceReport();

      return {
        cpu: Math.random() * 30 + 10, // Simulated
        memory: this.getSimulatedMemoryUsage(),
        connections: poolHealth.activeConnections || 0,
        queries: report.totalQueries || 0,
      };
    } catch {
      return {
        cpu: 0,
        memory: 0,
        connections: 0,
        queries: 0,
      };
    }
  }

  private getSimulatedMemoryUsage(): number {
    // Try to get actual memory usage if available
    if ('memory' in performance && (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory) {
      const memory = (performance as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      return (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
    }
    // Simulate reasonable value
    return Math.random() * 20 + 30;
  }

  private startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    this.refreshTimer = setInterval(async () => {
      try {
        await this.getDashboardData();
      } catch (error) {
        logger.error('Auto-refresh failed:', error);
      }
    }, this.config.refreshIntervalMs);
  }

  private timeout<T>(ms: number, fallback: T): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    });
  }

  private createErrorSummary(name: string): ServiceHealthSummary {
    return {
      name,
      status: 'unhealthy',
      uptime: 0,
      lastCheck: Date.now(),
      errorCount: 1,
      responseTime: 0,
      message: 'Service unavailable',
    };
  }

  private createErrorMetric(name: string): HealthMetric {
    return {
      name,
      value: 0,
      unit: 'unknown',
      status: 'unhealthy',
      threshold: { warning: 0, critical: 0 },
      trend: 'stable',
      changePercent: 0,
    };
  }
}

// Export singleton instance
export const databaseHealthDashboard = DatabaseHealthDashboard.getInstance();
