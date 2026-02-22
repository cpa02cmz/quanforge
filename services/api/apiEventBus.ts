/**
 * API Event Bus - Centralized Event System for API Operations
 * 
 * This module provides a centralized event system for API operations:
 * - Request lifecycle events (start, progress, complete, error)
 * - Cross-service communication
 * - Performance monitoring integration
 * - Error tracking and debugging
 * - Request correlation and tracing
 * 
 * Benefits:
 * - Single source of truth for API events
 * - Decoupled service communication
 * - Enhanced observability
 * - Easy debugging and monitoring
 * 
 * @module services/api/apiEventBus
 * @since 2026-02-22
 * @author API Specialist Agent
 */

import { createScopedLogger } from '../../utils/logger';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';
import { TIME_CONSTANTS } from '../../constants/config';

const logger = createScopedLogger('APIEventBus');

// ============= Types =============

/**
 * API event types
 */
export type APIEventType =
  | 'request:start'
  | 'request:progress'
  | 'request:complete'
  | 'request:error'
  | 'request:cancel'
  | 'request:retry'
  | 'request:timeout'
  | 'cache:hit'
  | 'cache:miss'
  | 'cache:invalidate'
  | 'rate_limit:hit'
  | 'rate_limit:reset'
  | 'circuit_breaker:open'
  | 'circuit_breaker:close'
  | 'circuit_breaker:half_open'
  | 'health:status_change'
  | 'health:alert'
  | 'queue:pause'
  | 'queue:resume'
  | 'queue:overflow'
  | 'deduplication:hit'
  | 'error:classified'
  | 'middleware:pre'
  | 'middleware:post'
  | 'tracing:span_start'
  | 'tracing:span_end';

/**
 * Base API event
 */
export interface APIEvent<T = unknown> {
  /** Event type */
  type: APIEventType;
  /** Event ID */
  id: string;
  /** Timestamp */
  timestamp: number;
  /** Event payload */
  payload: T;
  /** Request correlation ID */
  requestId?: string;
  /** Source service */
  source?: string;
  /** Event metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request start event payload
 */
export interface RequestStartPayload {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Request progress event payload
 */
export interface RequestProgressPayload {
  requestId: string;
  loaded: number;
  total?: number;
  percentage?: number;
  direction: 'upload' | 'download';
}

/**
 * Request complete event payload
 */
export interface RequestCompletePayload {
  requestId: string;
  url: string;
  method: string;
  statusCode: number;
  duration: number;
  cached: boolean;
  deduplicated: boolean;
  dataSize?: number;
}

/**
 * Request error event payload
 */
export interface RequestErrorPayload {
  requestId: string;
  url: string;
  method: string;
  error: Error;
  statusCode?: number;
  category?: string;
  retryable: boolean;
  attemptNumber?: number;
}

/**
 * Request cancel event payload
 */
export interface RequestCancelPayload {
  requestId: string;
  reason?: string;
}

/**
 * Request retry event payload
 */
export interface RequestRetryPayload {
  requestId: string;
  attemptNumber: number;
  maxAttempts: number;
  delay: number;
  error?: Error;
}

/**
 * Cache hit event payload
 */
export interface CacheHitPayload {
  key: string;
  age: number;
  size?: number;
}

/**
 * Cache miss event payload
 */
export interface CacheMissPayload {
  key: string;
  reason: 'not_found' | 'expired' | 'invalidated';
}

/**
 * Rate limit hit event payload
 */
export interface RateLimitHitPayload {
  key: string;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Circuit breaker event payload
 */
export interface CircuitBreakerPayload {
  endpoint: string;
  failures: number;
  threshold: number;
  state: 'open' | 'closed' | 'half_open';
}

/**
 * Health status change payload
 */
export interface HealthStatusChangePayload {
  endpoint: string;
  previousStatus: string;
  newStatus: string;
  responseTime?: number;
  message?: string;
}

/**
 * Error classified payload
 */
export interface ErrorClassifiedPayload {
  errorId: string;
  code: string;
  category: string;
  severity: string;
  message: string;
  retryable: boolean;
}

/**
 * Event handler function
 */
export type APIEventHandler<T = unknown> = (event: APIEvent<T>) => void | Promise<void>;

/**
 * Event subscription options
 */
export interface EventSubscriptionOptions {
  /** Only handle events for specific request IDs */
  requestId?: string;
  /** Only handle events from specific source */
  source?: string;
  /** Maximum number of times to handle the event */
  maxCalls?: number;
  /** Debounce events (ms) */
  debounce?: number;
  /** Throttle events (ms) */
  throttle?: number;
  /** Filter function */
  filter?: (event: APIEvent) => boolean;
}

/**
 * Event bus statistics
 */
export interface EventBusStats {
  /** Total events emitted */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<APIEventType, number>;
  /** Active subscriptions */
  activeSubscriptions: number;
  /** Subscriptions by type */
  subscriptionsByType: Record<APIEventType, number>;
  /** Events in buffer */
  bufferedEvents: number;
  /** Events dropped (buffer full) */
  droppedEvents: number;
  /** Average processing time (ms) */
  avgProcessingTime: number;
}

/**
 * Event bus configuration
 */
export interface EventBusConfig {
  /** Maximum events to keep in buffer */
  maxBufferSize: number;
  /** Enable event buffering */
  enableBuffering: boolean;
  /** Buffer retention time (ms) */
  bufferRetentionTime: number;
  /** Maximum async handler timeout (ms) */
  asyncHandlerTimeout: number;
  /** Enable debug logging */
  debugLogging: boolean;
}

// ============= Default Configuration =============

const DEFAULT_CONFIG: EventBusConfig = {
  maxBufferSize: 1000,
  enableBuffering: true,
  bufferRetentionTime: TIME_CONSTANTS.HOUR,
  asyncHandlerTimeout: 5000,
  debugLogging: false,
};

// ============= API Event Bus Class =============

/**
 * API Event Bus
 * 
 * Centralized event system for all API operations.
 */
export class APIEventBus {
  private config: EventBusConfig;
  private eventCounter = 0;
  private subscriptions = new Map<APIEventType, Set<{
    handler: APIEventHandler;
    options: EventSubscriptionOptions;
    callCount: number;
  }>>();
  
  // Event buffer for replay/debugging
  private eventBuffer: APIEvent[] = [];
  
  // Statistics
  private stats = {
    totalEvents: 0,
    eventsByType: {} as Record<APIEventType, number>,
    droppedEvents: 0,
    totalProcessingTime: 0,
  };
  
  // Cleanup interval
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Start periodic cleanup
    this.startCleanup();
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiEventBus', {
        cleanup: () => this.destroy(),
        priority: 'medium',
        description: 'API event bus service',
      });
    }
    
    logger.info('API Event Bus initialized', { config: this.config });
  }

  // ============= Core Methods =============

  /**
   * Emit an event
   */
  emit<T = unknown>(
    type: APIEventType,
    payload: T,
    options?: {
      requestId?: string;
      source?: string;
      metadata?: Record<string, unknown>;
    }
  ): APIEvent<T> {
    const startTime = Date.now();
    
    const event: APIEvent<T> = {
      type,
      id: this.generateEventId(),
      timestamp: Date.now(),
      payload,
      requestId: options?.requestId,
      source: options?.source,
      metadata: options?.metadata,
    };
    
    // Update statistics
    this.stats.totalEvents++;
    this.stats.eventsByType[type] = (this.stats.eventsByType[type] || 0) + 1;
    
    // Buffer event
    if (this.config.enableBuffering) {
      this.bufferEvent(event);
    }
    
    // Debug logging
    if (this.config.debugLogging) {
      logger.debug(`Event emitted: ${type}`, { eventId: event.id, payload });
    }
    
    // Notify subscribers
    this.notifySubscribers(event);
    
    // Track processing time
    this.stats.totalProcessingTime += Date.now() - startTime;
    
    return event;
  }

  /**
   * Subscribe to an event type
   */
  on<T = unknown>(
    type: APIEventType,
    handler: APIEventHandler<T>,
    options: EventSubscriptionOptions = {}
  ): () => void {
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, new Set());
    }
    
    const subscription = {
      handler: handler as APIEventHandler,
      options,
      callCount: 0,
    };
    
    this.subscriptions.get(type)!.add(subscription);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(type);
      if (handlers) {
        handlers.delete(subscription);
        if (handlers.size === 0) {
          this.subscriptions.delete(type);
        }
      }
    };
  }

  /**
   * Subscribe to an event type once
   */
  once<T = unknown>(
    type: APIEventType,
    handler: APIEventHandler<T>,
    options: EventSubscriptionOptions = {}
  ): () => void {
    return this.on(type, handler, { ...options, maxCalls: 1 });
  }

  /**
   * Subscribe to multiple event types
   */
  onMultiple(
    types: APIEventType[],
    handler: APIEventHandler,
    options: EventSubscriptionOptions = {}
  ): () => void {
    const unsubscribers = types.map(type => this.on(type, handler, options));
    return () => unsubscribers.forEach(unsub => unsub());
  }

  /**
   * Subscribe to all events
   */
  onAll(
    handler: APIEventHandler,
    options: EventSubscriptionOptions = {}
  ): () => void {
    const allTypes: APIEventType[] = [
      'request:start', 'request:progress', 'request:complete', 'request:error',
      'request:cancel', 'request:retry', 'request:timeout',
      'cache:hit', 'cache:miss', 'cache:invalidate',
      'rate_limit:hit', 'rate_limit:reset',
      'circuit_breaker:open', 'circuit_breaker:close', 'circuit_breaker:half_open',
      'health:status_change', 'health:alert',
      'queue:pause', 'queue:resume', 'queue:overflow',
      'deduplication:hit',
      'error:classified',
      'middleware:pre', 'middleware:post',
      'tracing:span_start', 'tracing:span_end',
    ];
    
    return this.onMultiple(allTypes, handler, options);
  }

  // ============= Convenience Methods =============

  /**
   * Emit request start event
   */
  emitRequestStart(payload: RequestStartPayload, requestId: string): APIEvent<RequestStartPayload> {
    return this.emit('request:start', payload, { requestId, source: 'api' });
  }

  /**
   * Emit request progress event
   */
  emitRequestProgress(payload: RequestProgressPayload): APIEvent<RequestProgressPayload> {
    return this.emit('request:progress', payload, { requestId: payload.requestId, source: 'api' });
  }

  /**
   * Emit request complete event
   */
  emitRequestComplete(payload: RequestCompletePayload): APIEvent<RequestCompletePayload> {
    return this.emit('request:complete', payload, { requestId: payload.requestId, source: 'api' });
  }

  /**
   * Emit request error event
   */
  emitRequestError(payload: RequestErrorPayload): APIEvent<RequestErrorPayload> {
    return this.emit('request:error', payload, { requestId: payload.requestId, source: 'api' });
  }

  /**
   * Emit cache hit event
   */
  emitCacheHit(payload: CacheHitPayload): APIEvent<CacheHitPayload> {
    return this.emit('cache:hit', payload, { source: 'cache' });
  }

  /**
   * Emit cache miss event
   */
  emitCacheMiss(payload: CacheMissPayload): APIEvent<CacheMissPayload> {
    return this.emit('cache:miss', payload, { source: 'cache' });
  }

  /**
   * Emit rate limit hit event
   */
  emitRateLimitHit(payload: RateLimitHitPayload): APIEvent<RateLimitHitPayload> {
    return this.emit('rate_limit:hit', payload, { source: 'rate_limiter' });
  }

  /**
   * Emit circuit breaker event
   */
  emitCircuitBreaker(payload: CircuitBreakerPayload): APIEvent<CircuitBreakerPayload> {
    const type = payload.state === 'open' ? 'circuit_breaker:open' :
                 payload.state === 'half_open' ? 'circuit_breaker:half_open' :
                 'circuit_breaker:close';
    return this.emit(type, payload, { source: 'circuit_breaker' });
  }

  /**
   * Emit health status change event
   */
  emitHealthStatusChange(payload: HealthStatusChangePayload): APIEvent<HealthStatusChangePayload> {
    return this.emit('health:status_change', payload, { source: 'health_monitor' });
  }

  /**
   * Emit error classified event
   */
  emitErrorClassified(payload: ErrorClassifiedPayload): APIEvent<ErrorClassifiedPayload> {
    return this.emit('error:classified', payload, { source: 'error_classifier' });
  }

  // ============= Buffer Methods =============

  /**
   * Get buffered events
   */
  getBufferedEvents(filter?: {
    type?: APIEventType;
    requestId?: string;
    source?: string;
    since?: number;
  }): APIEvent[] {
    let events = [...this.eventBuffer];
    
    if (filter) {
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.requestId) {
        events = events.filter(e => e.requestId === filter.requestId);
      }
      if (filter.source) {
        events = events.filter(e => e.source === filter.source);
      }
      if (filter.since) {
        events = events.filter(e => e.timestamp >= filter.since!);
      }
    }
    
    return events;
  }

  /**
   * Replay events to a handler
   */
  replayEvents(
    handler: APIEventHandler,
    filter?: {
      type?: APIEventType;
      requestId?: string;
      source?: string;
      since?: number;
    }
  ): void {
    const events = this.getBufferedEvents(filter);
    for (const event of events) {
      handler(event);
    }
  }

  /**
   * Clear event buffer
   */
  clearBuffer(): void {
    this.eventBuffer = [];
  }

  // ============= Statistics Methods =============

  /**
   * Get event bus statistics
   */
  getStats(): EventBusStats {
    const subscriptionsByType: Record<APIEventType, number> = {} as Record<APIEventType, number>;
    
    for (const [type, handlers] of this.subscriptions.entries()) {
      subscriptionsByType[type] = handlers.size;
    }
    
    return {
      totalEvents: this.stats.totalEvents,
      eventsByType: { ...this.stats.eventsByType },
      activeSubscriptions: Array.from(this.subscriptions.values())
        .reduce((sum, set) => sum + set.size, 0),
      subscriptionsByType,
      bufferedEvents: this.eventBuffer.length,
      droppedEvents: this.stats.droppedEvents,
      avgProcessingTime: this.stats.totalEvents > 0 
        ? this.stats.totalProcessingTime / this.stats.totalEvents 
        : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalEvents: 0,
      eventsByType: {} as Record<APIEventType, number>,
      droppedEvents: 0,
      totalProcessingTime: 0,
    };
    logger.info('Event bus statistics reset');
  }

  // ============= Private Methods =============

  private generateEventId(): string {
    return `evt_${Date.now()}_${++this.eventCounter}`;
  }

  private bufferEvent(event: APIEvent): void {
    if (this.eventBuffer.length >= this.config.maxBufferSize) {
      // Remove oldest event
      this.eventBuffer.shift();
      this.stats.droppedEvents++;
    }
    
    this.eventBuffer.push(event);
  }

  private notifySubscribers(event: APIEvent): void {
    const handlers = this.subscriptions.get(event.type);
    if (!handlers) return;
    
    const toRemove: Array<{ handler: APIEventHandler; options: EventSubscriptionOptions; callCount: number }> = [];
    
    for (const subscription of handlers) {
      // Check filter
      if (subscription.options.filter && !subscription.options.filter(event)) {
        continue;
      }
      
      // Check requestId filter
      if (subscription.options.requestId && event.requestId !== subscription.options.requestId) {
        continue;
      }
      
      // Check source filter
      if (subscription.options.source && event.source !== subscription.options.source) {
        continue;
      }
      
      // Call handler
      try {
        const result = subscription.handler(event);
        
        // Handle async handlers
        if (result instanceof Promise) {
          result.catch(error => {
            logger.error('Async event handler error', { event: event.type, error });
          });
        }
      } catch (error) {
        logger.error('Event handler error', { event: event.type, error });
      }
      
      // Update call count
      subscription.callCount++;
      
      // Check max calls
      if (subscription.options.maxCalls !== undefined && 
          subscription.callCount >= subscription.options.maxCalls) {
        toRemove.push(subscription);
      }
    }
    
    // Remove expired subscriptions
    for (const sub of toRemove) {
      handlers.delete(sub);
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      // Remove old events from buffer
      const cutoff = Date.now() - this.config.bufferRetentionTime;
      this.eventBuffer = this.eventBuffer.filter(e => e.timestamp > cutoff);
      
      // Remove empty subscription sets
      for (const [type, handlers] of this.subscriptions.entries()) {
        if (handlers.size === 0) {
          this.subscriptions.delete(type);
        }
      }
    }, TIME_CONSTANTS.MINUTE * 5);
  }

  /**
   * Destroy the event bus
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.subscriptions.clear();
    this.eventBuffer = [];
    
    logger.info('API Event Bus destroyed');
  }
}

// ============= Singleton Instance =============

let eventBusInstance: APIEventBus | null = null;

/**
 * Get the API event bus instance
 */
export const getAPIEventBus = (config?: Partial<EventBusConfig>): APIEventBus => {
  if (!eventBusInstance) {
    eventBusInstance = new APIEventBus(config);
  }
  return eventBusInstance;
};

/**
 * Initialize the API event bus with custom config
 */
export const initializeAPIEventBus = (config: Partial<EventBusConfig>): APIEventBus => {
  if (eventBusInstance) {
    eventBusInstance.destroy();
  }
  eventBusInstance = new APIEventBus(config);
  return eventBusInstance;
};

/**
 * Check if event bus is initialized
 */
export const hasAPIEventBus = (): boolean => {
  return eventBusInstance !== null;
};

// ============= Convenience Functions =============

/**
 * Emit an event using the singleton instance
 */
export const emitAPIEvent = <T = unknown>(
  type: APIEventType,
  payload: T,
  options?: { requestId?: string; source?: string; metadata?: Record<string, unknown> }
): APIEvent<T> => getAPIEventBus().emit(type, payload, options);

/**
 * Subscribe to an event using the singleton instance
 */
export const onAPIEvent = <T = unknown>(
  type: APIEventType,
  handler: APIEventHandler<T>,
  options?: EventSubscriptionOptions
): (() => void) => getAPIEventBus().on(type, handler, options);

// ============= React Hook =============

/**
 * React hook for using the API event bus
 */
export const useAPIEventBus = () => {
  const eventBus = getAPIEventBus();
  
  return {
    emit: <T = unknown>(
      type: APIEventType,
      payload: T,
      options?: { requestId?: string; source?: string; metadata?: Record<string, unknown> }
    ) => eventBus.emit(type, payload, options),
    
    on: <T = unknown>(
      type: APIEventType,
      handler: APIEventHandler<T>,
      options?: EventSubscriptionOptions
    ) => eventBus.on(type, handler, options),
    
    once: <T = unknown>(
      type: APIEventType,
      handler: APIEventHandler<T>,
      options?: EventSubscriptionOptions
    ) => eventBus.once(type, handler, options),
    
    onMultiple: (
      types: APIEventType[],
      handler: APIEventHandler,
      options?: EventSubscriptionOptions
    ) => eventBus.onMultiple(types, handler, options),
    
    onAll: (
      handler: APIEventHandler,
      options?: EventSubscriptionOptions
    ) => eventBus.onAll(handler, options),
    
    getBufferedEvents: (filter?: {
      type?: APIEventType;
      requestId?: string;
      source?: string;
      since?: number;
    }) => eventBus.getBufferedEvents(filter),
    
    getStats: () => eventBus.getStats(),
    clearBuffer: () => eventBus.clearBuffer(),
    resetStats: () => eventBus.resetStats(),
    
    // Convenience emit methods
    emitRequestStart: (payload: RequestStartPayload, requestId: string) =>
      eventBus.emitRequestStart(payload, requestId),
    emitRequestProgress: (payload: RequestProgressPayload) =>
      eventBus.emitRequestProgress(payload),
    emitRequestComplete: (payload: RequestCompletePayload) =>
      eventBus.emitRequestComplete(payload),
    emitRequestError: (payload: RequestErrorPayload) =>
      eventBus.emitRequestError(payload),
    emitCacheHit: (payload: CacheHitPayload) =>
      eventBus.emitCacheHit(payload),
    emitCacheMiss: (payload: CacheMissPayload) =>
      eventBus.emitCacheMiss(payload),
    emitRateLimitHit: (payload: RateLimitHitPayload) =>
      eventBus.emitRateLimitHit(payload),
    emitCircuitBreaker: (payload: CircuitBreakerPayload) =>
      eventBus.emitCircuitBreaker(payload),
    emitHealthStatusChange: (payload: HealthStatusChangePayload) =>
      eventBus.emitHealthStatusChange(payload),
    emitErrorClassified: (payload: ErrorClassifiedPayload) =>
      eventBus.emitErrorClassified(payload),
  };
};
