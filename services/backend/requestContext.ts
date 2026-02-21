/**
 * Backend Request Context Manager
 * 
 * Provides request lifecycle tracking with:
 * - Distributed tracing support
 * - Request correlation
 * - Performance tracking
 * - Error tracking
 * - Nested request context support
 * 
 * @module services/backend/requestContext
 * @author Backend Engineer
 */

import {
  RequestContext,
  RequestEntry,
  RequestContextOptions,
  RequestStats,
  BackendEventType,
  BackendEvent,
  BackendEventListener,
  DEFAULT_BACKEND_CONFIG,
} from './types';

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('RequestContext');

/**
 * Backend Request Context Manager
 * 
 * Singleton class that manages request contexts for distributed tracing.
 */
export class RequestContextManager {
  private static instance: RequestContextManager | null = null;
  
  private requests: Map<string, RequestEntry> = new Map();
  private eventListeners: Set<BackendEventListener> = new Set();
  private requestDurations: number[] = [];
  private maxStoredDurations: number = 1000;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.startCleanupInterval();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): RequestContextManager {
    if (!RequestContextManager.instance) {
      RequestContextManager.instance = new RequestContextManager();
    }
    return RequestContextManager.instance;
  }

  /**
   * Start a new request context
   */
  startRequest(options: RequestContextOptions): RequestContext {
    const context: RequestContext = {
      id: this.generateRequestId(),
      startTime: Date.now(),
      serviceName: options.serviceName,
      operation: options.operation,
      metadata: options.metadata,
      parentId: options.parentContext?.id,
      traceId: options.parentContext?.traceId || this.generateTraceId(),
      spanId: this.generateSpanId(),
    };

    const entry: RequestEntry = {
      context,
      status: 'pending',
      children: [],
    };

    this.requests.set(context.id, entry);

    // Link to parent if exists
    if (options.parentContext) {
      const parentEntry = this.requests.get(options.parentContext.id);
      if (parentEntry) {
        parentEntry.children.push(context.id);
      }
    }

    this.emitEvent({
      type: BackendEventType.REQUEST_STARTED,
      timestamp: context.startTime,
      service: options.serviceName,
      data: {
        requestId: context.id,
        operation: options.operation,
        traceId: context.traceId,
        spanId: context.spanId,
        parentId: context.parentId,
      },
      severity: 'info',
    });

    return context;
  }

  /**
   * End a request context successfully
   */
  endRequest(context: RequestContext, metadata?: Record<string, unknown>): void {
    const entry = this.requests.get(context.id);
    if (!entry) {
      logger.warn(`Request not found: ${context.id}`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - context.startTime;

    entry.endTime = endTime;
    entry.duration = duration;
    entry.status = 'success';

    if (metadata) {
      entry.context.metadata = { ...entry.context.metadata, ...metadata };
    }

    // Store duration for statistics
    this.storeDuration(duration);

    this.emitEvent({
      type: BackendEventType.REQUEST_COMPLETED,
      timestamp: endTime,
      service: context.serviceName,
      data: {
        requestId: context.id,
        operation: context.operation,
        duration,
        traceId: context.traceId,
        spanId: context.spanId,
      },
      severity: 'info',
    });
  }

  /**
   * End a request context with an error
   */
  endRequestWithError(context: RequestContext, error: Error): void {
    const entry = this.requests.get(context.id);
    if (!entry) {
      logger.warn(`Request not found: ${context.id}`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - context.startTime;

    entry.endTime = endTime;
    entry.duration = duration;
    entry.status = 'error';
    entry.error = error;

    // Store duration for statistics
    this.storeDuration(duration);

    this.emitEvent({
      type: BackendEventType.REQUEST_FAILED,
      timestamp: endTime,
      service: context.serviceName,
      data: {
        requestId: context.id,
        operation: context.operation,
        duration,
        error: error.message,
        traceId: context.traceId,
        spanId: context.spanId,
      },
      severity: 'error',
    });
  }

  /**
   * Get request entry by ID
   */
  getRequest(id: string): RequestEntry | undefined {
    return this.requests.get(id);
  }

  /**
   * Get request context by ID
   */
  getContext(id: string): RequestContext | undefined {
    return this.requests.get(id)?.context;
  }

  /**
   * Get all pending requests
   */
  getPendingRequests(): RequestEntry[] {
    return Array.from(this.requests.values()).filter(r => r.status === 'pending');
  }

  /**
   * Get requests for a specific service
   */
  getRequestsByService(serviceName: string): RequestEntry[] {
    return Array.from(this.requests.values()).filter(
      r => r.context.serviceName === serviceName
    );
  }

  /**
   * Get request statistics
   */
  getStats(): RequestStats {
    const entries = Array.from(this.requests.values());
    const totalRequests = entries.length;
    const pendingRequests = entries.filter(r => r.status === 'pending').length;
    const successfulRequests = entries.filter(r => r.status === 'success').length;
    const failedRequests = entries.filter(r => r.status === 'error').length;

    const durations = this.requestDurations.slice();
    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      totalRequests,
      pendingRequests,
      successfulRequests,
      failedRequests,
      averageDuration,
      p50Duration: this.calculatePercentile(durations, 50),
      p95Duration: this.calculatePercentile(durations, 95),
      p99Duration: this.calculatePercentile(durations, 99),
    };
  }

  /**
   * Get request statistics for a specific service
   */
  getServiceStats(serviceName: string): RequestStats {
    const serviceRequests = this.getRequestsByService(serviceName);
    const totalRequests = serviceRequests.length;
    const pendingRequests = serviceRequests.filter(r => r.status === 'pending').length;
    const successfulRequests = serviceRequests.filter(r => r.status === 'success').length;
    const failedRequests = serviceRequests.filter(r => r.status === 'error').length;

    const durations = serviceRequests
      .filter(r => r.duration !== undefined)
      .map(r => r.duration!);

    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      totalRequests,
      pendingRequests,
      successfulRequests,
      failedRequests,
      averageDuration,
      p50Duration: this.calculatePercentile(durations, 50),
      p95Duration: this.calculatePercentile(durations, 95),
      p99Duration: this.calculatePercentile(durations, 99),
    };
  }

  /**
   * Get trace for a request (includes all nested requests)
   */
  getTrace(requestId: string): RequestEntry[] {
    const trace: RequestEntry[] = [];
    const visited = new Set<string>();

    const collect = (id: string) => {
      if (visited.has(id)) {
        return;
      }
      visited.add(id);

      const entry = this.requests.get(id);
      if (entry) {
        trace.push(entry);
        entry.children.forEach(collect);
      }
    };

    collect(requestId);
    return trace;
  }

  /**
   * Get slow requests (duration above threshold)
   */
  getSlowRequests(thresholdMs: number = DEFAULT_BACKEND_CONFIG.alertThresholds.latencyWarning): RequestEntry[] {
    return Array.from(this.requests.values()).filter(
      r => r.duration !== undefined && r.duration > thresholdMs
    );
  }

  /**
   * Get failed requests
   */
  getFailedRequests(): RequestEntry[] {
    return Array.from(this.requests.values()).filter(r => r.status === 'error');
  }

  /**
   * Subscribe to request events
   */
  subscribe(listener: BackendEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Create a child request context
   */
  createChildContext(parent: RequestContext, options: Omit<RequestContextOptions, 'parentContext'>): RequestContext {
    return this.startRequest({
      ...options,
      parentContext: parent,
    });
  }

  /**
   * Wrap an async function with request context tracking
   */
  async withContext<T>(
    options: RequestContextOptions,
    fn: (context: RequestContext) => Promise<T>
  ): Promise<T> {
    const context = this.startRequest(options);
    
    try {
      const result = await fn(context);
      this.endRequest(context);
      return result;
    } catch (error) {
      this.endRequestWithError(context, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get active requests count
   */
  getActiveRequestCount(): number {
    return this.getPendingRequests().length;
  }

  // Private methods

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateSpanId(): string {
    return `span_${Math.random().toString(36).substring(2, 9)}`;
  }

  private storeDuration(duration: number): void {
    this.requestDurations.push(duration);
    if (this.requestDurations.length > this.maxStoredDurations) {
      this.requestDurations.shift();
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  private startCleanupInterval(): void {
    // Clean up completed requests older than 5 minutes
    this.cleanupInterval = setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      
      for (const [id, entry] of this.requests) {
        if (
          entry.status !== 'pending' && 
          entry.endTime !== undefined && 
          entry.endTime < fiveMinutesAgo
        ) {
          this.requests.delete(id);
        }
      }
    }, 60000); // Run every minute
  }

  private emitEvent(event: BackendEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.warn('Error in event listener:', error);
      }
    });
  }

  /**
   * Cleanup and destroy the manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.requests.clear();
    this.requestDurations = [];
    this.eventListeners.clear();

    // Reset singleton
    RequestContextManager.instance = null;

    logger.log('Request Context Manager destroyed');
  }
}

// Export singleton instance
export const requestContextManager = RequestContextManager.getInstance();

/**
 * Helper decorator for tracking async method calls
 */
export function trackRequest(serviceName: string, operation?: string) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<unknown>>
  ) {
    const originalMethod = descriptor.value;
    const op = operation || propertyKey;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const context = requestContextManager.startRequest({
        serviceName,
        operation: op,
      });

      try {
        const result = await originalMethod?.apply(this, args);
        requestContextManager.endRequest(context);
        return result;
      } catch (error) {
        requestContextManager.endRequestWithError(
          context,
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    };

    return descriptor;
  };
}
