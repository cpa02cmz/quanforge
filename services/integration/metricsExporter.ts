/**
 * Integration Metrics Exporter - Export Integration Metrics for External Monitoring
 * 
 * Provides comprehensive metrics export capabilities:
 * - Prometheus-compatible metrics export
 * - JSON metrics export for dashboards
 * - Real-time metrics streaming
 * - Metrics aggregation and summarization
 * - Alert threshold monitoring
 */

import { createScopedLogger } from '../../utils/logger';
import {
  IntegrationStatus,
  IntegrationEventType,
  type IntegrationEvent,
  type IntegrationMetrics,
  type IntegrationSystemSummary,
} from './types';
import { IntegrationType } from '../integrationResilience';
import { integrationOrchestrator } from './orchestrator';
import { integrationMetrics as healthMetrics } from '../integrationHealthMonitor';

const logger = createScopedLogger('metrics-exporter');

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Prometheus metric type
 */
export enum PrometheusMetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

/**
 * Prometheus metric definition
 */
export interface PrometheusMetric {
  name: string;
  help: string;
  type: PrometheusMetricType;
  labels: Record<string, string>;
  value: number;
  timestamp?: number;
}

/**
 * Metrics export configuration
 */
export interface MetricsExporterConfig {
  /** Export prefix for all metrics */
  prefix: string;
  /** Include timestamps in metrics */
  includeTimestamps: boolean;
  /** Labels to include in all metrics */
  globalLabels: Record<string, string>;
  /** Histogram buckets for latency metrics */
  histogramBuckets: number[];
  /** Enable real-time streaming */
  enableStreaming: boolean;
  /** Streaming interval in ms */
  streamingInterval: number;
  /** Metrics retention period in ms */
  retentionPeriod: number;
}

/**
 * Alert threshold definition
 */
export interface AlertThreshold {
  /** Alert identifier */
  id: string;
  /** Metric name to monitor */
  metricName: string;
  /** Comparison operator */
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  /** Threshold value */
  threshold: number;
  /** Alert severity */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Alert message template */
  message: string;
  /** Whether alert is enabled */
  enabled: boolean;
  /** Cooldown period in ms */
  cooldown: number;
}

/**
 * Alert event
 */
export interface AlertEvent {
  id: string;
  threshold: AlertThreshold;
  value: number;
  timestamp: Date;
  integrationName?: string;
  acknowledged: boolean;
}

/**
 * Metrics snapshot
 */
export interface MetricsSnapshot {
  timestamp: Date;
  systemSummary: IntegrationSystemSummary;
  integrationMetrics: Array<{
    name: string;
    type: IntegrationType;
    metrics: IntegrationMetrics;
    status: IntegrationStatus;
  }>;
  alerts: AlertEvent[];
}

/**
 * Metrics subscriber callback
 */
export type MetricsSubscriber = (snapshot: MetricsSnapshot) => void;

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: MetricsExporterConfig = {
  prefix: 'quanforge_integration',
  includeTimestamps: true,
  globalLabels: {},
  histogramBuckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  enableStreaming: true,
  streamingInterval: 15000,
  retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
};

const DEFAULT_THRESHOLDS: AlertThreshold[] = [
  {
    id: 'high_error_rate',
    metricName: 'error_rate',
    operator: 'gte',
    threshold: 0.1,
    severity: 'warning',
    message: 'Integration {{name}} has high error rate: {{value}}',
    enabled: true,
    cooldown: 300000, // 5 minutes
  },
  {
    id: 'critical_error_rate',
    metricName: 'error_rate',
    operator: 'gte',
    threshold: 0.5,
    severity: 'critical',
    message: 'Integration {{name}} has critical error rate: {{value}}',
    enabled: true,
    cooldown: 60000, // 1 minute
  },
  {
    id: 'high_latency',
    metricName: 'average_latency',
    operator: 'gte',
    threshold: 1000,
    severity: 'warning',
    message: 'Integration {{name}} has high latency: {{value}}ms',
    enabled: true,
    cooldown: 300000,
  },
  {
    id: 'low_uptime',
    metricName: 'uptime',
    operator: 'lt',
    threshold: 95,
    severity: 'warning',
    message: 'Integration {{name}} has low uptime: {{value}}%',
    enabled: true,
    cooldown: 600000, // 10 minutes
  },
];

// ============================================================================
// Integration Metrics Exporter
// ============================================================================

/**
 * Integration Metrics Exporter
 * 
 * Exports integration metrics in various formats for monitoring systems
 */
export class IntegrationMetricsExporter {
  private static instance: IntegrationMetricsExporter | null = null;
  
  private readonly config: MetricsExporterConfig;
  private readonly thresholds = new Map<string, AlertThreshold>();
  private readonly alertHistory = new Map<string, AlertEvent>();
  private readonly alertCooldowns = new Map<string, number>();
  private readonly snapshots: MetricsSnapshot[] = [];
  private readonly subscribers = new Set<MetricsSubscriber>();
  
  private streamingTimer?: ReturnType<typeof setInterval>;
  private unsubscribeOrchestrator?: () => void;
  private isInitialized = false;
  private alertIdCounter = 0;

  private constructor(config: Partial<MetricsExporterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('Integration Metrics Exporter created');
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<MetricsExporterConfig>): IntegrationMetricsExporter {
    if (!IntegrationMetricsExporter.instance) {
      IntegrationMetricsExporter.instance = new IntegrationMetricsExporter(config);
    }
    return IntegrationMetricsExporter.instance;
  }

  /**
   * Initialize the metrics exporter
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Metrics Exporter already initialized');
      return;
    }

    logger.info('Initializing Integration Metrics Exporter...');

    // Load default thresholds
    DEFAULT_THRESHOLDS.forEach(threshold => {
      this.thresholds.set(threshold.id, threshold);
    });

    // Subscribe to integration events
    this.unsubscribeOrchestrator = integrationOrchestrator.subscribeAll((event) => {
      this.handleIntegrationEvent(event);
    });

    // Start streaming if enabled
    if (this.config.enableStreaming) {
      this.startStreaming();
    }

    this.isInitialized = true;
    logger.info('Integration Metrics Exporter initialized', {
      thresholds: this.thresholds.size,
    });
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const metrics = this.collectMetrics();
    const lines: string[] = [];

    // System-level metrics
    lines.push(this.formatPrometheusMetric({
      name: `${this.config.prefix}_total_integrations`,
      help: 'Total number of registered integrations',
      type: PrometheusMetricType.GAUGE,
      labels: this.config.globalLabels,
      value: metrics.systemSummary.totalIntegrations,
    }));

    lines.push(this.formatPrometheusMetric({
      name: `${this.config.prefix}_healthy_integrations`,
      help: 'Number of healthy integrations',
      type: PrometheusMetricType.GAUGE,
      labels: this.config.globalLabels,
      value: metrics.systemSummary.healthyCount,
    }));

    lines.push(this.formatPrometheusMetric({
      name: `${this.config.prefix}_degraded_integrations`,
      help: 'Number of degraded integrations',
      type: PrometheusMetricType.GAUGE,
      labels: this.config.globalLabels,
      value: metrics.systemSummary.degradedCount,
    }));

    lines.push(this.formatPrometheusMetric({
      name: `${this.config.prefix}_unhealthy_integrations`,
      help: 'Number of unhealthy integrations',
      type: PrometheusMetricType.GAUGE,
      labels: this.config.globalLabels,
      value: metrics.systemSummary.unhealthyCount,
    }));

    lines.push(this.formatPrometheusMetric({
      name: `${this.config.prefix}_system_uptime`,
      help: 'System uptime percentage',
      type: PrometheusMetricType.GAUGE,
      labels: this.config.globalLabels,
      value: metrics.systemSummary.uptime,
    }));

    // Per-integration metrics
    for (const integration of metrics.integrationMetrics) {
      const baseLabels = {
        ...this.config.globalLabels,
        integration_name: integration.name,
        integration_type: integration.type,
        integration_status: integration.status,
        integration_priority: String(integration.metrics.name ? integration.metrics.name : 'unknown'),
      };

      lines.push(this.formatPrometheusMetric({
        name: `${this.config.prefix}_integration_total_requests`,
        help: 'Total requests for integration',
        type: PrometheusMetricType.COUNTER,
        labels: baseLabels,
        value: integration.metrics.totalRequests,
      }));

      lines.push(this.formatPrometheusMetric({
        name: `${this.config.prefix}_integration_successful_requests`,
        help: 'Successful requests for integration',
        type: PrometheusMetricType.COUNTER,
        labels: baseLabels,
        value: integration.metrics.successfulRequests,
      }));

      lines.push(this.formatPrometheusMetric({
        name: `${this.config.prefix}_integration_failed_requests`,
        help: 'Failed requests for integration',
        type: PrometheusMetricType.COUNTER,
        labels: baseLabels,
        value: integration.metrics.failedRequests,
      }));

      lines.push(this.formatPrometheusMetric({
        name: `${this.config.prefix}_integration_error_rate`,
        help: 'Error rate for integration',
        type: PrometheusMetricType.GAUGE,
        labels: baseLabels,
        value: integration.metrics.errorRate,
      }));

      lines.push(this.formatPrometheusMetric({
        name: `${this.config.prefix}_integration_average_latency_ms`,
        help: 'Average latency for integration in ms',
        type: PrometheusMetricType.GAUGE,
        labels: baseLabels,
        value: integration.metrics.averageLatency,
      }));

      lines.push(this.formatPrometheusMetric({
        name: `${this.config.prefix}_integration_p95_latency_ms`,
        help: 'P95 latency for integration in ms',
        type: PrometheusMetricType.GAUGE,
        labels: baseLabels,
        value: integration.metrics.p95Latency,
      }));

      lines.push(this.formatPrometheusMetric({
        name: `${this.config.prefix}_integration_p99_latency_ms`,
        help: 'P99 latency for integration in ms',
        type: PrometheusMetricType.GAUGE,
        labels: baseLabels,
        value: integration.metrics.p99Latency,
      }));

      lines.push(this.formatPrometheusMetric({
        name: `${this.config.prefix}_integration_circuit_breaker_trips`,
        help: 'Circuit breaker trip count for integration',
        type: PrometheusMetricType.COUNTER,
        labels: baseLabels,
        value: integration.metrics.circuitBreakerTrips,
      }));

      lines.push(this.formatPrometheusMetric({
        name: `${this.config.prefix}_integration_fallback_usage`,
        help: 'Fallback usage count for integration',
        type: PrometheusMetricType.COUNTER,
        labels: baseLabels,
        value: integration.metrics.fallbackUsageCount,
      }));
    }

    return lines.join('\n');
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): MetricsSnapshot {
    return this.collectMetrics();
  }

  /**
   * Collect current metrics
   */
  collectMetrics(): MetricsSnapshot {
    const systemSummary = integrationOrchestrator.getSystemSummary();
    const allStatuses = integrationOrchestrator.getAllStatuses();

    const integrationMetrics = Object.entries(allStatuses).map(([name, status]) => {
      const metrics = integrationOrchestrator.getMetrics(name);
      const healthMetricsData = healthMetrics.getMetrics(name) || {
        count: 0,
        errorCount: 0,
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errorRate: 0,
      };

      return {
        name,
        type: status.type,
        status: status.status,
        metrics: metrics || {
          name,
          totalRequests: healthMetricsData.count,
          successfulRequests: healthMetricsData.count - healthMetricsData.errorCount,
          failedRequests: healthMetricsData.errorCount,
          averageLatency: healthMetricsData.avgLatency,
          p95Latency: healthMetricsData.p95Latency,
          p99Latency: healthMetricsData.p99Latency,
          errorRate: healthMetricsData.errorRate,
          circuitBreakerTrips: 0,
          fallbackUsageCount: 0,
          lastHourRequests: healthMetricsData.count,
          lastHourErrorRate: healthMetricsData.errorRate,
        },
      };
    });

    const snapshot: MetricsSnapshot = {
      timestamp: new Date(),
      systemSummary,
      integrationMetrics,
      alerts: Array.from(this.alertHistory.values()),
    };

    // Store snapshot
    this.snapshots.push(snapshot);
    this.pruneSnapshots();

    // Check thresholds
    this.checkThresholds(snapshot);

    return snapshot;
  }

  /**
   * Add an alert threshold
   */
  addThreshold(threshold: AlertThreshold): void {
    this.thresholds.set(threshold.id, threshold);
    logger.info(`Added alert threshold: ${threshold.id}`);
  }

  /**
   * Remove an alert threshold
   */
  removeThreshold(thresholdId: string): void {
    this.thresholds.delete(thresholdId);
    logger.info(`Removed alert threshold: ${thresholdId}`);
  }

  /**
   * Subscribe to metrics updates
   */
  subscribe(callback: MetricsSubscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Get alert history
   */
  getAlertHistory(options: {
    severity?: AlertThreshold['severity'];
    since?: Date;
    acknowledged?: boolean;
  } = {}): AlertEvent[] {
    let alerts = Array.from(this.alertHistory.values());

    if (options.severity) {
      alerts = alerts.filter(a => a.threshold.severity === options.severity);
    }

    if (options.since) {
      alerts = alerts.filter(a => a.timestamp >= options.since!);
    }

    if (options.acknowledged !== undefined) {
      alerts = alerts.filter(a => a.acknowledged === options.acknowledged);
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alertHistory.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    logger.info(`Alert acknowledged: ${alertId}`);

    return true;
  }

  /**
   * Get historical snapshots
   */
  getSnapshots(options: {
    since?: Date;
    limit?: number;
  } = {}): MetricsSnapshot[] {
    let snapshots = [...this.snapshots];

    if (options.since) {
      snapshots = snapshots.filter(s => s.timestamp >= options.since!);
    }

    if (options.limit) {
      snapshots = snapshots.slice(-options.limit);
    }

    return snapshots;
  }

  /**
   * Shutdown the metrics exporter
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Integration Metrics Exporter...');

    if (this.streamingTimer) {
      clearInterval(this.streamingTimer);
    }

    if (this.unsubscribeOrchestrator) {
      this.unsubscribeOrchestrator();
    }

    this.subscribers.clear();
    this.alertHistory.clear();
    this.alertCooldowns.clear();
    this.snapshots.length = 0;
    this.isInitialized = false;

    logger.info('Integration Metrics Exporter shut down');
  }

  // Private methods

  private formatPrometheusMetric(metric: PrometheusMetric): string {
    const lines: string[] = [];
    
    lines.push(`# HELP ${metric.name} ${metric.help}`);
    lines.push(`# TYPE ${metric.name} ${metric.type}`);

    const labelsStr = Object.entries(metric.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    const valueStr = this.config.includeTimestamps && metric.timestamp
      ? `${metric.value} ${metric.timestamp}`
      : String(metric.value);

    if (labelsStr) {
      lines.push(`${metric.name}{${labelsStr}} ${valueStr}`);
    } else {
      lines.push(`${metric.name} ${valueStr}`);
    }

    return lines.join('\n');
  }

  private startStreaming(): void {
    this.streamingTimer = setInterval(() => {
      this.streamMetrics();
    }, this.config.streamingInterval);
  }

  private streamMetrics(): void {
    const snapshot = this.collectMetrics();
    
    this.subscribers.forEach(callback => {
      try {
        callback(snapshot);
      } catch (error) {
        logger.error('Error in metrics subscriber:', error);
      }
    });
  }

  private handleIntegrationEvent(event: IntegrationEvent): void {
    // Update metrics on significant events
    if (
      event.type === IntegrationEventType.STATUS_CHANGED ||
      event.type === IntegrationEventType.HEALTH_CHECK_FAILED ||
      event.type === IntegrationEventType.CIRCUIT_BREAKER_OPENED
    ) {
      this.checkThresholdsForIntegration(event.integrationName);
    }
  }

  private checkThresholds(snapshot: MetricsSnapshot): void {
    for (const integration of snapshot.integrationMetrics) {
      this.checkThresholdsForIntegration(integration.name, integration.metrics);
    }
  }

  private checkThresholdsForIntegration(
    integrationName: string,
    metrics?: IntegrationMetrics
  ): void {
    const integrationMetrics = metrics || integrationOrchestrator.getMetrics(integrationName);
    if (!integrationMetrics) return;

    const status = integrationOrchestrator.getStatus(integrationName);

    const metricValues: Record<string, number> = {
      error_rate: integrationMetrics.errorRate,
      average_latency: integrationMetrics.averageLatency,
      p95_latency: integrationMetrics.p95Latency,
      p99_latency: integrationMetrics.p99Latency,
      uptime: status?.uptime || 100,
      total_requests: integrationMetrics.totalRequests,
      failed_requests: integrationMetrics.failedRequests,
    };

    this.thresholds.forEach(threshold => {
      if (!threshold.enabled) return;

      const value = metricValues[threshold.metricName];
      if (value === undefined) return;

      const exceeded = this.compareValue(value, threshold.operator, threshold.threshold);
      if (!exceeded) return;

      // Check cooldown
      const cooldownKey = `${threshold.id}:${integrationName}`;
      const lastAlert = this.alertCooldowns.get(cooldownKey);
      const now = Date.now();

      if (lastAlert && now - lastAlert < threshold.cooldown) {
        return;
      }

      // Create alert
      const alert: AlertEvent = {
        id: `alert-${++this.alertIdCounter}`,
        threshold,
        value,
        timestamp: new Date(),
        integrationName,
        acknowledged: false,
      };

      this.alertHistory.set(alert.id, alert);
      this.alertCooldowns.set(cooldownKey, now);

      logger.warn(`Alert triggered: ${threshold.id}`, {
        integration: integrationName,
        value,
        threshold: threshold.threshold,
        severity: threshold.severity,
      });
    });
  }

  private compareValue(value: number, operator: AlertThreshold['operator'], threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'neq': return value !== threshold;
      default: return false;
    }
  }

  private pruneSnapshots(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    
    while (this.snapshots.length > 0) {
      const snapshot = this.snapshots[0];
      if (snapshot && snapshot.timestamp.getTime() < cutoff) {
        this.snapshots.shift();
      } else {
        break;
      }
    }
  }
}

// Export singleton instance
export const integrationMetricsExporter = IntegrationMetricsExporter.getInstance();
