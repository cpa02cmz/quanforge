/**
 * API Tracing Service
 * Request correlation and distributed tracing for API calls
 * 
 * @module services/api/apiTracing
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../../constants/config';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('APITracing');

/**
 * Span kind for tracing
 */
export type SpanKind = 'client' | 'server' | 'producer' | 'consumer';

/**
 * Span status
 */
export type SpanStatus = 'ok' | 'error' | 'cancelled';

/**
 * Trace context
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: number;
}

/**
 * Span attribute value
 */
export type AttributeValue = string | number | boolean | string[] | number[] | boolean[];

/**
 * Span event
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, AttributeValue>;
}

/**
 * Span link
 */
export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes?: Record<string, AttributeValue>;
}

/**
 * Span data
 */
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: SpanStatus;
  statusMessage?: string;
  attributes: Record<string, AttributeValue>;
  events: SpanEvent[];
  links: SpanLink[];
}

/**
 * Trace configuration
 */
export interface TracingConfig {
  enabled?: boolean;
  sampleRate?: number; // 0-1, default 1 (100%)
  maxSpansPerTrace?: number;
  maxTraceAge?: number;
  propagateHeaders?: boolean;
  serviceName?: string;
}

/**
 * Trace statistics
 */
export interface TracingStats {
  totalTraces: number;
  totalSpans: number;
  activeTraces: number;
  sampledTraces: number;
  averageTraceDuration: number;
  errorRate: number;
}

/**
 * API Tracing Service
 * 
 * Features:
 * - Distributed tracing with trace context propagation
 * - Span creation and management
 * - Event and link tracking
 * - Sampling support
 * - W3C Trace Context compatibility
 * - Performance analysis
 */
export class APITracing {
  private activeSpans = new Map<string, Span>();
  private traces = new Map<string, Span[]>();
  private config: Required<TracingConfig>;
  private spanCounter = 0;
  private traceCounter = 0;
  private cleanupInterval: ReturnType<typeof setInterval>;
  
  // Current trace context (for async local storage simulation)
  private currentContext: TraceContext | null = null;
  
  // Statistics
  private stats = {
    totalTraces: 0,
    totalSpans: 0,
    sampledTraces: 0,
    totalDuration: 0,
    errorSpans: 0
  };

  constructor(config?: TracingConfig) {
    this.config = {
      enabled: config?.enabled ?? true,
      sampleRate: config?.sampleRate ?? 1,
      maxSpansPerTrace: config?.maxSpansPerTrace ?? 100,
      maxTraceAge: config?.maxTraceAge ?? TIME_CONSTANTS.HOUR,
      propagateHeaders: config?.propagateHeaders ?? true,
      serviceName: config?.serviceName ?? 'quanforge-api'
    };

    // Cleanup old traces periodically
    this.cleanupInterval = setInterval(
      () => this.cleanupOldTraces(),
      TIME_CONSTANTS.MINUTE * 5
    );

    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiTracing', {
        cleanup: () => this.destroy(),
        priority: 'low',
        description: 'API tracing service'
      });
    }
  }

  /**
   * Start a new trace
   */
  startTrace(name: string, options?: {
    parentContext?: TraceContext;
    kind?: SpanKind;
    attributes?: Record<string, AttributeValue>;
  }): { span: Span; context: TraceContext } {
    if (!this.config.enabled) {
      return this.createNoopTrace(name);
    }

    // Check sampling
    if (Math.random() > this.config.sampleRate) {
      return this.createNoopTrace(name);
    }

    this.stats.totalTraces++;
    this.stats.sampledTraces++;

    const traceId = options?.parentContext?.traceId ?? this.generateTraceId();
    const spanId = this.generateSpanId();
    const parentSpanId = options?.parentContext?.spanId;

    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId,
      traceFlags: options?.parentContext?.traceFlags ?? 1
    };

    const span: Span = {
      traceId,
      spanId,
      parentSpanId,
      name,
      kind: options?.kind ?? 'client',
      startTime: Date.now(),
      status: 'ok',
      attributes: {
        'service.name': this.config.serviceName,
        ...options?.attributes
      },
      events: [],
      links: []
    };

    this.activeSpans.set(spanId, span);
    this.currentContext = context;
    this.stats.totalSpans++;

    logger.debug(`Started trace: ${name}`, { traceId, spanId });

    return { span, context };
  }

  /**
   * Start a child span
   */
  startSpan(
    name: string,
    parentContext?: TraceContext,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, AttributeValue>;
    }
  ): { span: Span; context: TraceContext } {
    if (!this.config.enabled) {
      return this.createNoopTrace(name);
    }

    const parent = parentContext ?? this.currentContext;
    
    if (!parent) {
      return this.startTrace(name, options);
    }

    const spanId = this.generateSpanId();

    const context: TraceContext = {
      traceId: parent.traceId,
      spanId,
      parentSpanId: parent.spanId,
      traceFlags: parent.traceFlags
    };

    const span: Span = {
      traceId: parent.traceId,
      spanId,
      parentSpanId: parent.spanId,
      name,
      kind: options?.kind ?? 'client',
      startTime: Date.now(),
      status: 'ok',
      attributes: {
        'service.name': this.config.serviceName,
        ...options?.attributes
      },
      events: [],
      links: []
    };

    this.activeSpans.set(spanId, span);
    this.stats.totalSpans++;

    return { span, context };
  }

  /**
   * End a span
   */
  endSpan(span: Span, status: SpanStatus = 'ok', message?: string): void {
    if (!this.config.enabled) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    span.statusMessage = message;

    if (status === 'error') {
      this.stats.errorSpans++;
    }

    // Remove from active spans
    this.activeSpans.delete(span.spanId);

    // Add to trace
    const spans = this.traces.get(span.traceId) || [];
    spans.push(span);

    // Limit spans per trace
    if (spans.length > this.config.maxSpansPerTrace) {
      spans.shift();
    }

    this.traces.set(span.traceId, spans);
    this.stats.totalDuration += span.duration;

    logger.debug(`Ended span: ${span.name}`, {
      traceId: span.traceId,
      spanId: span.spanId,
      duration: span.duration,
      status
    });
  }

  /**
   * Add event to a span
   */
  addEvent(
    span: Span,
    name: string,
    attributes?: Record<string, AttributeValue>
  ): void {
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
  }

  /**
   * Add link to a span
   */
  addLink(
    span: Span,
    linkedContext: TraceContext,
    attributes?: Record<string, AttributeValue>
  ): void {
    span.links.push({
      traceId: linkedContext.traceId,
      spanId: linkedContext.spanId,
      attributes
    });
  }

  /**
   * Set attribute on a span
   */
  setAttribute(span: Span, key: string, value: AttributeValue): void {
    span.attributes[key] = value;
  }

  /**
   * Set multiple attributes on a span
   */
  setAttributes(span: Span, attributes: Record<string, AttributeValue>): void {
    Object.assign(span.attributes, attributes);
  }

  /**
   * Record an error on a span
   */
  recordError(span: Span, error: Error): void {
    span.status = 'error';
    span.statusMessage = error.message;

    span.events.push({
      name: 'exception',
      timestamp: Date.now(),
      attributes: {
        'exception.type': error.name,
        'exception.message': error.message,
        'exception.stacktrace': error.stack ?? ''
      }
    });
  }

  /**
   * Get trace context headers for propagation
   */
  getTraceHeaders(context?: TraceContext): Record<string, string> {
    if (!this.config.propagateHeaders) {
      return {};
    }

    const ctx = context ?? this.currentContext;
    if (!ctx) return {};

    return {
      'traceparent': this.formatTraceParent(ctx),
      'tracestate': ''
    };
  }

  /**
   * Parse trace context from headers
   */
  parseTraceHeaders(headers: Headers | Record<string, string>): TraceContext | null {
    const traceparent = headers instanceof Headers
      ? headers.get('traceparent')
      : headers['traceparent'];

    if (!traceparent) return null;

    return this.parseTraceParent(traceparent);
  }

  /**
   * Get a trace by ID
   */
  getTrace(traceId: string): Span[] | null {
    return this.traces.get(traceId) ?? null;
  }

  /**
   * Get active spans
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Get current trace context
   */
  getCurrentContext(): TraceContext | null {
    return this.currentContext;
  }

  /**
   * Set current trace context
   */
  setCurrentContext(context: TraceContext | null): void {
    this.currentContext = context;
  }

  /**
   * Get statistics
   */
  getStats(): TracingStats {
    const avgDuration = this.stats.totalSpans > 0
      ? this.stats.totalDuration / this.stats.totalSpans
      : 0;

    const errorRate = this.stats.totalSpans > 0
      ? this.stats.errorSpans / this.stats.totalSpans
      : 0;

    return {
      totalTraces: this.stats.totalTraces,
      totalSpans: this.stats.totalSpans,
      activeTraces: this.traces.size,
      sampledTraces: this.stats.sampledTraces,
      averageTraceDuration: avgDuration,
      errorRate
    };
  }

  /**
   * Export traces in OTLP format
   */
  exportOTLP(): { resourceSpans: unknown[] } {
    const spans = Array.from(this.traces.values()).flat();

    return {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.config.serviceName } }
          ]
        },
        scopeSpans: [{
          scope: { name: 'quanforge-api' },
          spans: spans.map(span => this.spanToOTLP(span))
        }]
      }]
    };
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.activeSpans.clear();
    this.traces.clear();
    this.currentContext = null;
  }

  // Private methods

  private generateTraceId(): string {
    return `${Date.now().toString(16)}${(++this.traceCounter).toString(16).padStart(8, '0')}`;
  }

  private generateSpanId(): string {
    return `${Date.now().toString(16).slice(-8)}${(++this.spanCounter).toString(16).padStart(8, '0')}`;
  }

  private createNoopTrace(name: string): { span: Span; context: TraceContext } {
    const context: TraceContext = {
      traceId: 'noop',
      spanId: 'noop',
      traceFlags: 0
    };

    const span: Span = {
      traceId: 'noop',
      spanId: 'noop',
      name,
      kind: 'client',
      startTime: Date.now(),
      status: 'ok',
      attributes: {},
      events: [],
      links: []
    };

    return { span, context };
  }

  private formatTraceParent(context: TraceContext): string {
    const flags = context.traceFlags.toString(16).padStart(2, '0');
    return `00-${context.traceId}-${context.spanId}-${flags}`;
  }

  private parseTraceParent(traceparent: string): TraceContext | null {
    const match = traceparent.match(/^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);
    
    if (!match) return null;

    return {
      traceId: match[2],
      spanId: match[3],
      traceFlags: parseInt(match[4], 16)
    };
  }

  private spanToOTLP(span: Span): unknown {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      kind: span.kind === 'client' ? 2 : span.kind === 'server' ? 1 : 3,
      startTimeUnixNano: span.startTime * 1000000,
      endTimeUnixNano: (span.endTime ?? span.startTime) * 1000000,
      status: {
        code: span.status === 'ok' ? 1 : span.status === 'error' ? 2 : 3,
        message: span.statusMessage
      },
      attributes: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        value: this.attributeToOTLP(value)
      })),
      events: span.events.map(event => ({
        name: event.name,
        timeUnixNano: event.timestamp * 1000000,
        attributes: Object.entries(event.attributes ?? {}).map(([key, value]) => ({
          key,
          value: this.attributeToOTLP(value)
        }))
      })),
      links: span.links.map(link => ({
        traceId: link.traceId,
        spanId: link.spanId,
        attributes: Object.entries(link.attributes ?? {}).map(([key, value]) => ({
          key,
          value: this.attributeToOTLP(value)
        }))
      }))
    };
  }

  private attributeToOTLP(value: AttributeValue): unknown {
    if (typeof value === 'string') {
      return { stringValue: value };
    }
    if (typeof value === 'number') {
      return { doubleValue: value };
    }
    if (typeof value === 'boolean') {
      return { boolValue: value };
    }
    if (Array.isArray(value)) {
      return { arrayValue: { values: value.map(v => this.attributeToOTLP(v as AttributeValue)) } };
    }
    return { stringValue: String(value) };
  }

  private cleanupOldTraces(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [traceId, spans] of this.traces.entries()) {
      const newestSpan = spans[spans.length - 1];
      if (newestSpan && now - newestSpan.startTime > this.config.maxTraceAge) {
        this.traces.delete(traceId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} old traces`);
    }
  }

  /**
   * Destroy the tracer and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    logger.info('API Tracing destroyed');
  }
}

// Create singleton instance
export const apiTracing = new APITracing();

// React hook for tracing
export const useAPITracing = () => ({
  startTrace: (name: string, options?: {
    parentContext?: TraceContext;
    kind?: SpanKind;
    attributes?: Record<string, AttributeValue>;
  }) => apiTracing.startTrace(name, options),
  
  startSpan: (name: string, parentContext?: TraceContext, options?: {
    kind?: SpanKind;
    attributes?: Record<string, AttributeValue>;
  }) => apiTracing.startSpan(name, parentContext, options),
  
  endSpan: (span: Span, status?: SpanStatus, message?: string) =>
    apiTracing.endSpan(span, status, message),
  
  addEvent: (span: Span, name: string, attributes?: Record<string, AttributeValue>) =>
    apiTracing.addEvent(span, name, attributes),
  
  addLink: (span: Span, linkedContext: TraceContext, attributes?: Record<string, AttributeValue>) =>
    apiTracing.addLink(span, linkedContext, attributes),
  
  setAttribute: (span: Span, key: string, value: AttributeValue) =>
    apiTracing.setAttribute(span, key, value),
  
  setAttributes: (span: Span, attributes: Record<string, AttributeValue>) =>
    apiTracing.setAttributes(span, attributes),
  
  recordError: (span: Span, error: Error) =>
    apiTracing.recordError(span, error),
  
  getTraceHeaders: (context?: TraceContext) =>
    apiTracing.getTraceHeaders(context),
  
  parseTraceHeaders: (headers: Headers | Record<string, string>) =>
    apiTracing.parseTraceHeaders(headers),
  
  getTrace: (traceId: string) => apiTracing.getTrace(traceId),
  
  getActiveSpans: () => apiTracing.getActiveSpans(),
  
  getCurrentContext: () => apiTracing.getCurrentContext(),
  
  getStats: () => apiTracing.getStats(),
  
  exportOTLP: () => apiTracing.exportOTLP(),
  
  clear: () => apiTracing.clear()
});
