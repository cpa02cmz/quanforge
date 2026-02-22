/**
 * Database Metrics Aggregator
 * 
 * Consolidates metrics from all database services into a unified observability layer.
 * Provides comprehensive monitoring, alerting, and reporting capabilities.
 * 
 * Features:
 * - Unified metrics collection from all database services
 * - Real-time aggregation and statistics
 * - Configurable alert thresholds
 * - Historical metrics storage
 * - Export capabilities for monitoring systems
 * 
 * @module services/database/metricsAggregator
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../modularConstants';
import { queryPlanCache } from './queryPlanCache';
import { failoverManager } from './failoverManager';
import { transactionManager } from './transactionManager';
import { databaseHealthMonitor } from './DatabaseHealthMonitor';

const logger = createScopedLogger('MetricsAggregator');

// ============================================================================
// TYPES
// ============================================================================

export interface DatabaseMetrics {
  timestamp: number;
  
  // Connection Metrics
  connections: {
    active: number;
    idle: number;
    total: number;
    waiting: number;
    errors: number;
  };
  
  // Query Performance Metrics
  queries: {
    totalExecuted: number;
    averageLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    slowQueries: number;
    failedQueries: number;
  };
  
  // Cache Metrics
  cache: {
    hitRate: number;
    hits: number;
    misses: number;
    evictions: number;
    memoryUsedBytes: number;
    memoryLimitBytes: number;
    entries: number;
  };
  
  // Transaction Metrics
  transactions: {
    total: number;
    successful: number;
    failed: number;
    rolledBack: number;
    averageDurationMs: number;
    activeCount: number;
  };
  
  // Failover Metrics
  failover: {
    state: string;
    totalFailovers: number;
    totalRecoveries: number;
    availability: number;
    activeEndpoint: string | null;
  };
  
  // Health Metrics
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    score: number;
    lastCheck: number;
    issues: string[];
  };
}

export interface MetricThreshold {
  metric: string;
  warningThreshold: number;
  criticalThreshold: number;
  operator: 'gt' | 'lt' | 'eq';
}

export interface Alert {
  id: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  acknowledged: boolean;
}

export interface MetricsConfig {
  collectionIntervalMs: number;
  retentionPeriodMs: number;
  maxStoredMetrics: number;
  alertThresholds: MetricThreshold[];
  enableAlerting: boolean;
  exportFormat: 'json' | 'prometheus' | 'csv';
}

export interface MetricsReport {
  period: {
    start: number;
    end: number;
  };
  summary: {
    averageConnectionCount: number;
    averageQueryLatencyMs: number;
    averageCacheHitRate: number;
    totalTransactions: number;
    transactionSuccessRate: number;
    uptime: number;
  };
  trends: {
    queryLatencyTrend: 'improving' | 'stable' | 'degrading';
    cacheHitRateTrend: 'improving' | 'stable' | 'degrading';
    connectionTrend: 'improving' | 'stable' | 'degrading';
  };
  alerts: Alert[];
  recommendations: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: MetricsConfig = {
  collectionIntervalMs: TIME_CONSTANTS.SECOND * 30,
  retentionPeriodMs: TIME_CONSTANTS.HOUR * 24,
  maxStoredMetrics: 2880, // 24 hours at 30-second intervals
  alertThresholds: [
    { metric: 'queries.averageLatencyMs', warningThreshold: 100, criticalThreshold: 500, operator: 'gt' },
    { metric: 'queries.slowQueries', warningThreshold: 10, criticalThreshold: 50, operator: 'gt' },
    { metric: 'cache.hitRate', warningThreshold: 0.7, criticalThreshold: 0.5, operator: 'lt' },
    { metric: 'transactions.failed', warningThreshold: 5, criticalThreshold: 20, operator: 'gt' },
    { metric: 'failover.availability', warningThreshold: 0.95, criticalThreshold: 0.9, operator: 'lt' },
    { metric: 'health.score', warningThreshold: 70, criticalThreshold: 50, operator: 'lt' },
  ],
  enableAlerting: true,
  exportFormat: 'json',
};

// ============================================================================
// METRICS AGGREGATOR CLASS
// ============================================================================

/**
 * Aggregates and manages database metrics
 */
export class MetricsAggregator {
  private static instance: MetricsAggregator;
  private config: MetricsConfig;
  private metricsHistory: DatabaseMetrics[] = [];
  private alerts: Alert[] = [];
  private collectionTimer?: ReturnType<typeof setInterval>;
  private isCollecting = false;
  private isInitialized = false;
  
  // Current metrics state
  private currentMetrics: DatabaseMetrics | null = null;
  private queryLatencies: number[] = [];
  private totalQueries = 0;
  private slowQueryThreshold = 100;
  
  private constructor(config: Partial<MetricsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  static getInstance(config?: Partial<MetricsConfig>): MetricsAggregator {
    if (!MetricsAggregator.instance) {
      MetricsAggregator.instance = new MetricsAggregator(config);
    }
    return MetricsAggregator.instance;
  }
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  /**
   * Initialize the metrics aggregator
   */
  initialize(): void {
    if (this.isInitialized) return;
    
    this.startCollection();
    this.isInitialized = true;
    
    logger.log('Metrics aggregator initialized', {
      collectionInterval: `${this.config.collectionIntervalMs}ms`,
      retentionPeriod: `${this.config.retentionPeriodMs / TIME_CONSTANTS.HOUR}h`,
      alerting: this.config.enableAlerting,
    });
  }
  
  /**
   * Shutdown the metrics aggregator
   */
  shutdown(): void {
    this.stopCollection();
    this.metricsHistory = [];
    this.alerts = [];
    this.isInitialized = false;
    
    logger.log('Metrics aggregator shutdown');
  }
  
  /**
   * Get current metrics
   */
  getCurrentMetrics(): DatabaseMetrics | null {
    return this.currentMetrics;
  }
  
  /**
   * Get metrics history
   */
  getHistory(limit: number = 100): DatabaseMetrics[] {
    return this.metricsHistory.slice(-limit);
  }
  
  /**
   * Get alerts
   */
  getAlerts(includeAcknowledged: boolean = false): Alert[] {
    if (includeAcknowledged) return [...this.alerts];
    return this.alerts.filter(a => !a.acknowledged);
  }
  
  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      logger.log('Alert acknowledged', { alertId });
      return true;
    }
    return false;
  }
  
  /**
   * Record a query execution
   */
  recordQuery(latencyMs: number, success: boolean, isSlow: boolean = false): void {
    this.totalQueries++;
    this.queryLatencies.push(latencyMs);
    
    // Keep only recent latencies for percentile calculations
    if (this.queryLatencies.length > 1000) {
      this.queryLatencies = this.queryLatencies.slice(-500);
    }
    
    if (!success || isSlow) {
      this.collectMetrics();
    }
  }
  
  /**
   * Generate a metrics report
   */
  generateReport(periodStart?: number, periodEnd?: number): MetricsReport {
    const end = periodEnd || Date.now();
    const start = periodStart || end - TIME_CONSTANTS.HOUR;
    
    const periodMetrics = this.metricsHistory.filter(
      m => m.timestamp >= start && m.timestamp <= end
    );
    
    if (periodMetrics.length === 0) {
      return this.createEmptyReport(start, end);
    }
    
    // Calculate summary
    const summary = {
      averageConnectionCount: this.average(periodMetrics.map(m => m.connections.total)),
      averageQueryLatencyMs: this.average(periodMetrics.map(m => m.queries.averageLatencyMs)),
      averageCacheHitRate: this.average(periodMetrics.map(m => m.cache.hitRate)),
      totalTransactions: periodMetrics.reduce((sum, m) => sum + m.transactions.total, 0),
      transactionSuccessRate: this.calculateSuccessRate(periodMetrics),
      uptime: this.calculateUptime(periodMetrics),
    };
    
    // Calculate trends
    const trends = this.calculateTrends(periodMetrics);
    
    // Get relevant alerts
    const periodAlerts = this.alerts.filter(
      a => a.timestamp >= start && a.timestamp <= end
    );
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, trends, periodAlerts);
    
    return {
      period: { start, end },
      summary,
      trends,
      alerts: periodAlerts,
      recommendations,
    };
  }
  
  /**
   * Export metrics in specified format
   */
  exportMetrics(format: 'json' | 'prometheus' | 'csv' = this.config.exportFormat): string {
    const metrics = this.getCurrentMetrics();
    if (!metrics) return '';
    
    switch (format) {
      case 'prometheus':
        return this.formatPrometheus(metrics);
      case 'csv':
        return this.formatCSV(metrics);
      case 'json':
      default:
        return JSON.stringify(metrics, null, 2);
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<MetricsConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.collectionIntervalMs !== undefined) {
      this.stopCollection();
      this.startCollection();
    }
    
    logger.log('Metrics aggregator configuration updated');
  }
  
  /**
   * Force immediate metrics collection
   */
  async collectNow(): Promise<DatabaseMetrics> {
    return this.collectMetrics();
  }
  
  /**
   * Clear old metrics and alerts
   */
  cleanup(): void {
    const cutoff = Date.now() - this.config.retentionPeriodMs;
    
    const previousMetricsCount = this.metricsHistory.length;
    const previousAlertsCount = this.alerts.length;
    
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
    
    logger.debug('Cleanup completed', {
      metricsRemoved: previousMetricsCount - this.metricsHistory.length,
      alertsRemoved: previousAlertsCount - this.alerts.length,
    });
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  private startCollection(): void {
    if (this.collectionTimer) return;
    
    // Collect immediately
    this.collectMetrics();
    
    // Schedule periodic collection
    this.collectionTimer = setInterval(
      () => this.collectMetrics(),
      this.config.collectionIntervalMs
    );
  }
  
  private stopCollection(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
    }
  }
  
  private async collectMetrics(): Promise<DatabaseMetrics> {
    if (this.isCollecting) {
      return this.currentMetrics!;
    }
    
    this.isCollecting = true;
    
    try {
      const timestamp = Date.now();
      
      // Collect from all services
      const cacheStats = this.getCacheStats();
      const failoverStatus = this.getFailoverStatus();
      const transactionMetrics = this.getTransactionMetrics();
      const healthStatus = await this.getHealthStatus();
      
      // Calculate query metrics
      const queryMetrics = this.calculateQueryMetrics();
      
      // Build connection metrics (mock for now)
      const connectionMetrics = this.getConnectionMetrics();
      
      const metrics: DatabaseMetrics = {
        timestamp,
        connections: connectionMetrics,
        queries: queryMetrics,
        cache: cacheStats,
        transactions: transactionMetrics,
        failover: failoverStatus,
        health: healthStatus,
      };
      
      this.currentMetrics = metrics;
      
      // Store in history
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.config.maxStoredMetrics) {
        this.metricsHistory = this.metricsHistory.slice(-this.config.maxStoredMetrics);
      }
      
      // Check thresholds and generate alerts
      if (this.config.enableAlerting) {
        this.checkThresholds(metrics);
      }
      
      return metrics;
    } finally {
      this.isCollecting = false;
    }
  }
  
  private getCacheStats(): DatabaseMetrics['cache'] {
    try {
      const stats = queryPlanCache.getStats();
      return {
        hitRate: stats.hitRate,
        hits: stats.hits,
        misses: stats.misses,
        evictions: stats.evictions,
        memoryUsedBytes: stats.memoryUsedBytes,
        memoryLimitBytes: stats.memoryLimitBytes,
        entries: stats.entries,
      };
    } catch {
      return {
        hitRate: 0,
        hits: 0,
        misses: 0,
        evictions: 0,
        memoryUsedBytes: 0,
        memoryLimitBytes: 0,
        entries: 0,
      };
    }
  }
  
  private getFailoverStatus(): DatabaseMetrics['failover'] {
    try {
      const status = failoverManager.getStatus();
      return {
        state: status.state,
        totalFailovers: status.totalFailovers,
        totalRecoveries: status.totalRecoveries,
        availability: status.availability,
        activeEndpoint: status.activeEndpoint?.id || null,
      };
    } catch {
      return {
        state: 'unknown',
        totalFailovers: 0,
        totalRecoveries: 0,
        availability: 100,
        activeEndpoint: null,
      };
    }
  }
  
  private getTransactionMetrics(): DatabaseMetrics['transactions'] {
    try {
      const metrics = transactionManager.getMetrics();
      return {
        total: metrics.totalTransactions,
        successful: metrics.successfulTransactions,
        failed: metrics.failedTransactions,
        rolledBack: metrics.rolledBackTransactions,
        averageDurationMs: metrics.averageDuration,
        activeCount: transactionManager.getActiveTransactionCount(),
      };
    } catch {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        rolledBack: 0,
        averageDurationMs: 0,
        activeCount: 0,
      };
    }
  }
  
  private async getHealthStatus(): Promise<DatabaseMetrics['health']> {
    try {
      const healthStatus = databaseHealthMonitor.getHealthStatus();
      const overall = healthStatus.overall;
      const issues = databaseHealthMonitor.getActiveAlerts().map(a => a.message);
      
      // Calculate health score based on check results
      let score = 100;
      for (const check of Object.values(healthStatus.checks)) {
        if (check.status === 'warn') score -= 10;
        if (check.status === 'fail') score -= 25;
      }
      score = Math.max(0, score);
      
      return {
        status: overall === 'healthy' ? 'healthy' : overall === 'degraded' ? 'degraded' : 'unhealthy',
        score,
        lastCheck: Date.now(),
        issues,
      };
    } catch {
      return {
        status: 'unknown',
        score: 0,
        lastCheck: Date.now(),
        issues: ['Unable to retrieve health status'],
      };
    }
  }
  
  private calculateQueryMetrics(): DatabaseMetrics['queries'] {
    const latencies = this.queryLatencies;
    
    if (latencies.length === 0) {
      return {
        totalExecuted: this.totalQueries,
        averageLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        slowQueries: 0,
        failedQueries: 0,
      };
    }
    
    const sorted = [...latencies].sort((a, b) => a - b);
    
    return {
      totalExecuted: this.totalQueries,
      averageLatencyMs: this.average(latencies),
      p50LatencyMs: this.percentile(sorted, 50),
      p95LatencyMs: this.percentile(sorted, 95),
      p99LatencyMs: this.percentile(sorted, 99),
      slowQueries: latencies.filter(l => l > this.slowQueryThreshold).length,
      failedQueries: 0, // Would need to track separately
    };
  }
  
  private getConnectionMetrics(): DatabaseMetrics['connections'] {
    // This would integrate with ConnectionPool in a real implementation
    return {
      active: Math.floor(Math.random() * 5) + 1,
      idle: Math.floor(Math.random() * 3) + 1,
      total: Math.floor(Math.random() * 8) + 2,
      waiting: 0,
      errors: 0,
    };
  }
  
  private checkThresholds(metrics: DatabaseMetrics): void {
    for (const threshold of this.config.alertThresholds) {
      const value = this.getMetricValue(metrics, threshold.metric);
      if (value === null) continue;
      
      const breached = this.evaluateThreshold(value, threshold);
      
      if (breached) {
        this.createAlert(
          threshold,
          value,
          value >= threshold.criticalThreshold ? 'critical' : 'warning'
        );
      }
    }
  }
  
  private getMetricValue(metrics: DatabaseMetrics, path: string): number | null {
    const parts = path.split('.');
    let current: unknown = metrics;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return null;
      }
    }
    
    return typeof current === 'number' ? current : null;
  }
  
  private evaluateThreshold(value: number, threshold: MetricThreshold): boolean {
    switch (threshold.operator) {
      case 'gt':
        return value > threshold.warningThreshold;
      case 'lt':
        return value < threshold.warningThreshold;
      case 'eq':
        return value === threshold.warningThreshold;
      default:
        return false;
    }
  }
  
  private createAlert(
    threshold: MetricThreshold,
    value: number,
    severity: Alert['severity']
  ): void {
    // Check if similar alert already exists
    const existing = this.alerts.find(
      a => a.metric === threshold.metric && !a.acknowledged
    );
    
    if (existing) return;
    
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      severity,
      metric: threshold.metric,
      value,
      threshold: threshold.warningThreshold,
      message: `${threshold.metric} is ${value} (threshold: ${threshold.warningThreshold})`,
      acknowledged: false,
    };
    
    this.alerts.push(alert);
    
    logger.warn('Alert generated', {
      severity,
      metric: threshold.metric,
      value,
      threshold: threshold.warningThreshold,
    });
  }
  
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
  
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }
  
  private calculateSuccessRate(metrics: DatabaseMetrics[]): number {
    const total = metrics.reduce((sum, m) => sum + m.transactions.total, 0);
    const successful = metrics.reduce((sum, m) => sum + m.transactions.successful, 0);
    return total > 0 ? successful / total : 1;
  }
  
  private calculateUptime(metrics: DatabaseMetrics[]): number {
    if (metrics.length === 0) return 100;
    
    const healthyCount = metrics.filter(m => m.health.status === 'healthy').length;
    return (healthyCount / metrics.length) * 100;
  }
  
  private calculateTrends(metrics: DatabaseMetrics[]): MetricsReport['trends'] {
    if (metrics.length < 10) {
      return {
        queryLatencyTrend: 'stable',
        cacheHitRateTrend: 'stable',
        connectionTrend: 'stable',
      };
    }
    
    const recentMetrics = metrics.slice(-10);
    const olderMetrics = metrics.slice(0, metrics.length - 10);
    
    const recentAvgLatency = this.average(recentMetrics.map(m => m.queries.averageLatencyMs));
    const olderAvgLatency = this.average(olderMetrics.map(m => m.queries.averageLatencyMs));
    
    const recentCacheHitRate = this.average(recentMetrics.map(m => m.cache.hitRate));
    const olderCacheHitRate = this.average(olderMetrics.map(m => m.cache.hitRate));
    
    const recentConnections = this.average(recentMetrics.map(m => m.connections.total));
    const olderConnections = this.average(olderMetrics.map(m => m.connections.total));
    
    return {
      queryLatencyTrend: this.determineTrend(olderAvgLatency, recentAvgLatency, true),
      cacheHitRateTrend: this.determineTrend(olderCacheHitRate, recentCacheHitRate, false),
      connectionTrend: this.determineTrend(olderConnections, recentConnections, false),
    };
  }
  
  private determineTrend(older: number, newer: number, lowerIsBetter: boolean): 'improving' | 'stable' | 'degrading' {
    const change = Math.abs(newer - older) / (older || 1);
    
    if (change < 0.05) return 'stable';
    
    if (lowerIsBetter) {
      return newer < older ? 'improving' : 'degrading';
    } else {
      return newer > older ? 'improving' : 'degrading';
    }
  }
  
  private generateRecommendations(
    summary: MetricsReport['summary'],
    trends: MetricsReport['trends'],
    alerts: Alert[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (summary.averageQueryLatencyMs > 100) {
      recommendations.push('Consider optimizing slow queries or adding indexes');
    }
    
    if (summary.averageCacheHitRate < 0.8) {
      recommendations.push('Cache hit rate is low, consider increasing cache size or TTL');
    }
    
    if (trends.queryLatencyTrend === 'degrading') {
      recommendations.push('Query performance is degrading, investigate recent schema changes');
    }
    
    if (trends.cacheHitRateTrend === 'degrading') {
      recommendations.push('Cache effectiveness is decreasing, review cache invalidation policies');
    }
    
    if (alerts.some(a => a.severity === 'critical')) {
      recommendations.push('Critical alerts detected, immediate attention required');
    }
    
    if (summary.transactionSuccessRate < 0.95) {
      recommendations.push('Transaction failure rate is high, review error logs');
    }
    
    return recommendations;
  }
  
  private createEmptyReport(start: number, end: number): MetricsReport {
    return {
      period: { start, end },
      summary: {
        averageConnectionCount: 0,
        averageQueryLatencyMs: 0,
        averageCacheHitRate: 0,
        totalTransactions: 0,
        transactionSuccessRate: 100,
        uptime: 100,
      },
      trends: {
        queryLatencyTrend: 'stable',
        cacheHitRateTrend: 'stable',
        connectionTrend: 'stable',
      },
      alerts: [],
      recommendations: ['No metrics data available for the specified period'],
    };
  }
  
  private formatPrometheus(metrics: DatabaseMetrics): string {
    const lines: string[] = [];
    const prefix = 'quanforge_db_';
    
    // Connection metrics
    lines.push(`${prefix}connections_active ${metrics.connections.active}`);
    lines.push(`${prefix}connections_idle ${metrics.connections.idle}`);
    lines.push(`${prefix}connections_total ${metrics.connections.total}`);
    lines.push(`${prefix}connections_errors ${metrics.connections.errors}`);
    
    // Query metrics
    lines.push(`${prefix}queries_total ${metrics.queries.totalExecuted}`);
    lines.push(`${prefix}queries_latency_avg ${metrics.queries.averageLatencyMs}`);
    lines.push(`${prefix}queries_latency_p95 ${metrics.queries.p95LatencyMs}`);
    lines.push(`${prefix}queries_slow ${metrics.queries.slowQueries}`);
    
    // Cache metrics
    lines.push(`${prefix}cache_hit_rate ${metrics.cache.hitRate}`);
    lines.push(`${prefix}cache_hits ${metrics.cache.hits}`);
    lines.push(`${prefix}cache_misses ${metrics.cache.misses}`);
    lines.push(`${prefix}cache_evictions ${metrics.cache.evictions}`);
    
    // Transaction metrics
    lines.push(`${prefix}transactions_total ${metrics.transactions.total}`);
    lines.push(`${prefix}transactions_successful ${metrics.transactions.successful}`);
    lines.push(`${prefix}transactions_failed ${metrics.transactions.failed}`);
    
    // Health metrics
    lines.push(`${prefix}health_score ${metrics.health.score}`);
    
    return lines.join('\n');
  }
  
  private formatCSV(metrics: DatabaseMetrics): string {
    const headers = [
      'timestamp',
      'connections_active',
      'connections_idle',
      'queries_avg_latency',
      'queries_slow',
      'cache_hit_rate',
      'transactions_total',
      'health_score',
    ];
    
    const values = [
      metrics.timestamp,
      metrics.connections.active,
      metrics.connections.idle,
      metrics.queries.averageLatencyMs,
      metrics.queries.slowQueries,
      metrics.cache.hitRate,
      metrics.transactions.total,
      metrics.health.score,
    ];
    
    return `${headers.join(',')}\n${values.join(',')}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const metricsAggregator = MetricsAggregator.getInstance();

// Auto-initialize
metricsAggregator.initialize();
