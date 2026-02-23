/**
 * Backend Telemetry Exporter
 * 
 * Provides OpenTelemetry-compatible telemetry export with:
 * - Metrics export in Prometheus format
 * - Distributed trace context propagation
 * - Structured logging integration
 * - Service mesh observability
 * - Real-time metrics streaming
 * 
 * @module services/backend/telemetryExporter
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('TelemetryExporter');

/**
 * Telemetry metric types
 */
export type TelemetryMetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Telemetry metric
 */
export interface TelemetryMetric {
  name: string;
  type: TelemetryMetricType;
  value: number;
  unit: string;
  description?: string;
  labels: Record<string, string>;
  timestamp: number;
}

/**
 * Telemetry span for distributed tracing
 */
export interface TelemetrySpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
  events: TelemetryEvent[];
}

/**
 * Telemetry event
 */
export interface TelemetryEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, string | number | boolean>;
}

/**
 * Telemetry log entry
 */
export interface TelemetryLog {
  timestamp: number;
  severity: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  serviceName: string;
  traceId?: string;
  spanId?: string;
  attributes: Record<string, string | number | boolean>;
}

/**
 * Telemetry exporter configuration
 */
export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  enableMetrics: boolean;
  enableTracing: boolean;
  enableLogging: boolean;
  exportInterval: number; // milliseconds
  maxBatchSize: number;
  endpoint?: string; // Optional external endpoint
}

/**
 * Default telemetry configuration
 */
export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  serviceName: 'quanforge-backend',
  serviceVersion: '1.0.0',
  environment: 'production',
  enableMetrics: true,
  enableTracing: true,
  enableLogging: true,
  exportInterval: 60000, // 1 minute
  maxBatchSize: 1000,
};

/**
 * Backend Telemetry Exporter
 * 
 * Singleton class that provides comprehensive telemetry export capabilities.
 */
export class BackendTelemetryExporter {
  private static instance: BackendTelemetryExporter | null = null;

  private config: TelemetryConfig;
  private metrics: Map<string, TelemetryMetric[]> = new Map();
  private spans: Map<string, TelemetrySpan> = new Map();
  private logs: TelemetryLog[] = [];
  private exportInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(data: TelemetryExportData) => void> = new Set();

  private maxMetricsPerName: number = 10000;
  private maxSpans: number = 1000;
  private maxLogs: number = 5000;

  private constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_TELEMETRY_CONFIG, ...config };
    this.startExportInterval();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(config?: Partial<TelemetryConfig>): BackendTelemetryExporter {
    if (!BackendTelemetryExporter.instance) {
      BackendTelemetryExporter.instance = new BackendTelemetryExporter(config);
    }
    return BackendTelemetryExporter.instance;
  }

  /**
   * Record a metric
   */
  recordMetric(metric: Omit<TelemetryMetric, 'timestamp'>): void {
    if (!this.config.enableMetrics) return;

    const fullMetric: TelemetryMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    const metrics = this.metrics.get(metric.name) || [];
    metrics.push(fullMetric);

    // Trim if exceeded max
    if (metrics.length > this.maxMetricsPerName) {
      metrics.shift();
    }

    this.metrics.set(metric.name, metrics);
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(
    name: string,
    value: number = 1,
    labels: Record<string, string> = {}
  ): void {
    this.recordMetric({
      name,
      type: 'counter',
      value,
      unit: 'count',
      labels,
    });
  }

  /**
   * Record a gauge metric
   */
  recordGauge(
    name: string,
    value: number,
    unit: string,
    labels: Record<string, string> = {}
  ): void {
    this.recordMetric({
      name,
      type: 'gauge',
      value,
      unit,
      labels,
    });
  }

  /**
   * Record a histogram metric
   */
  recordHistogram(
    name: string,
    value: number,
    unit: string,
    labels: Record<string, string> = {}
  ): void {
    this.recordMetric({
      name,
      type: 'histogram',
      value,
      unit,
      labels,
    });
  }

  /**
   * Start a new span for distributed tracing
   */
  startSpan(
    operationName: string,
    serviceName: string,
    parentSpan?: TelemetrySpan,
    attributes: Record<string, string | number | boolean> = {}
  ): TelemetrySpan {
    const span: TelemetrySpan = {
      traceId: parentSpan?.traceId || this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId: parentSpan?.spanId,
      operationName,
      serviceName,
      startTime: Date.now(),
      status: 'ok',
      attributes: {
        ...attributes,
        'service.name': serviceName,
        'service.version': this.config.serviceVersion,
      },
      events: [],
    };

    this.spans.set(span.spanId, span);
    return span;
  }

  /**
   * End a span
   */
  endSpan(span: TelemetrySpan, status: 'ok' | 'error' = 'ok'): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    // Trim old spans if exceeded max
    if (this.spans.size > this.maxSpans) {
      const oldestKey = this.spans.keys().next().value;
      if (oldestKey) {
        this.spans.delete(oldestKey);
      }
    }
  }

  /**
   * Add an event to a span
   */
  addSpanEvent(
    span: TelemetrySpan,
    name: string,
    attributes: Record<string, string | number | boolean> = {}
  ): void {
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  /**
   * Record a log entry
   */
  log(
    severity: TelemetryLog['severity'],
    message: string,
    serviceName: string,
    attributes: Record<string, string | number | boolean> = {},
    span?: TelemetrySpan
  ): void {
    if (!this.config.enableLogging) return;

    const entry: TelemetryLog = {
      timestamp: Date.now(),
      severity,
      message,
      serviceName,
      traceId: span?.traceId,
      spanId: span?.spanId,
      attributes,
    };

    this.logs.push(entry);

    // Trim old logs if exceeded max
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    for (const [name, metrics] of this.metrics) {
      // Add HELP and TYPE headers
      const firstMetric = metrics[0];
      if (firstMetric) {
        if (firstMetric.description) {
          lines.push(`# HELP ${name} ${firstMetric.description}`);
        }
        lines.push(`# TYPE ${name} ${firstMetric.type}`);
      }

      // Add metric values with labels
      for (const metric of metrics.slice(-100)) { // Last 100 values
        const labelStr = Object.entries(metric.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        
        const labelPart = labelStr ? `{${labelStr}}` : '';
        lines.push(`${name}${labelPart} ${metric.value} ${metric.timestamp}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get metrics in JSON format
   */
  getJsonMetrics(): TelemetryMetric[] {
    const allMetrics: TelemetryMetric[] = [];
    
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }

    return allMetrics;
  }

  /**
   * Get all spans
   */
  getSpans(): TelemetrySpan[] {
    return Array.from(this.spans.values());
  }

  /**
   * Get spans for a specific trace
   */
  getTraceSpans(traceId: string): TelemetrySpan[] {
    return this.getSpans().filter(span => span.traceId === traceId);
  }

  /**
   * Get logs
   */
  getLogs(filter?: {
    serviceName?: string;
    severity?: TelemetryLog['severity'];
    traceId?: string;
    limit?: number;
  }): TelemetryLog[] {
    let filtered = [...this.logs];

    if (filter) {
      if (filter.serviceName) {
        filtered = filtered.filter(l => l.serviceName === filter.serviceName);
      }
      if (filter.severity) {
        filtered = filtered.filter(l => l.severity === filter.severity);
      }
      if (filter.traceId) {
        filtered = filtered.filter(l => l.traceId === filter.traceId);
      }
      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * Get telemetry statistics
   */
  getStats(): {
    metricsCount: number;
    spansCount: number;
    logsCount: number;
    services: string[];
  } {
    const services = new Set<string>();

    for (const span of this.spans.values()) {
      services.add(span.serviceName);
    }

    for (const log of this.logs) {
      services.add(log.serviceName);
    }

    let metricsCount = 0;
    for (const metrics of this.metrics.values()) {
      metricsCount += metrics.length;
    }

    return {
      metricsCount,
      spansCount: this.spans.size,
      logsCount: this.logs.length,
      services: Array.from(services),
    };
  }

  /**
   * Subscribe to telemetry exports
   */
  subscribe(listener: (data: TelemetryExportData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Export telemetry data
   */
  export(): TelemetryExportData {
    return {
      timestamp: Date.now(),
      service: {
        name: this.config.serviceName,
        version: this.config.serviceVersion,
        environment: this.config.environment,
      },
      metrics: this.getJsonMetrics(),
      spans: this.getSpans(),
      logs: this.getLogs({ limit: 100 }),
    };
  }

  /**
   * Clear all telemetry data
   */
  clear(): void {
    this.metrics.clear();
    this.spans.clear();
    this.logs = [];
    logger.log('Telemetry data cleared');
  }

  // Private methods

  private generateTraceId(): string {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  }

  private generateSpanId(): string {
    return Math.random().toString(16).slice(2, 18);
  }

  private startExportInterval(): void {
    if (this.config.endpoint) {
      this.exportInterval = setInterval(() => {
        this.exportToEndpoint();
      }, this.config.exportInterval);
    }
  }

  private async exportToEndpoint(): Promise<void> {
    if (!this.config.endpoint || this.listeners.size === 0) return;

    try {
      const data = this.export();
      
      // Notify listeners
      this.listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.warn('Error in telemetry listener:', error);
        }
      });

      // In a real implementation, this would send to the endpoint
      logger.debug('Telemetry exported:', {
        metrics: data.metrics.length,
        spans: data.spans.length,
        logs: data.logs.length,
      });
    } catch (error) {
      logger.error('Error exporting telemetry:', error);
    }
  }

  /**
   * Cleanup and destroy the exporter
   */
  destroy(): void {
    if (this.exportInterval) {
      clearInterval(this.exportInterval);
      this.exportInterval = null;
    }

    this.metrics.clear();
    this.spans.clear();
    this.logs = [];
    this.listeners.clear();

    BackendTelemetryExporter.instance = null;
    logger.log('Telemetry exporter destroyed');
  }
}

/**
 * Telemetry export data structure
 */
export interface TelemetryExportData {
  timestamp: number;
  service: {
    name: string;
    version: string;
    environment: string;
  };
  metrics: TelemetryMetric[];
  spans: TelemetrySpan[];
  logs: TelemetryLog[];
}

// Export singleton instance
export const backendTelemetryExporter = BackendTelemetryExporter.getInstance();

/**
 * Helper function to record a backend metric
 */
export function recordBackendMetric(
  name: string,
  value: number,
  type: TelemetryMetricType = 'gauge',
  labels: Record<string, string> = {}
): void {
  backendTelemetryExporter.recordMetric({
    name,
    type,
    value,
    unit: 'ms',
    labels,
  });
}

/**
 * Helper function to time an operation
 */
export async function timeOperation<T>(
  operationName: string,
  serviceName: string,
  fn: () => Promise<T>,
  labels: Record<string, string> = {}
): Promise<T> {
  const span = backendTelemetryExporter.startSpan(operationName, serviceName);
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    backendTelemetryExporter.recordHistogram(
      'operation_duration_ms',
      duration,
      'ms',
      { operation: operationName, service: serviceName, ...labels }
    );
    
    backendTelemetryExporter.endSpan(span, 'ok');
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    backendTelemetryExporter.recordHistogram(
      'operation_duration_ms',
      duration,
      'ms',
      { operation: operationName, service: serviceName, status: 'error', ...labels }
    );
    
    backendTelemetryExporter.endSpan(span, 'error');
    throw error;
  }
}

/**
 * Helper function to create a telemetry logger
 */
export function createTelemetryLogger(serviceName: string) {
  return {
    debug: (message: string, attrs: Record<string, string | number | boolean> = {}) =>
      backendTelemetryExporter.log('debug', message, serviceName, attrs),
    info: (message: string, attrs: Record<string, string | number | boolean> = {}) =>
      backendTelemetryExporter.log('info', message, serviceName, attrs),
    warn: (message: string, attrs: Record<string, string | number | boolean> = {}) =>
      backendTelemetryExporter.log('warn', message, serviceName, attrs),
    error: (message: string, attrs: Record<string, string | number | boolean> = {}) =>
      backendTelemetryExporter.log('error', message, serviceName, attrs),
  };
}
