/**
 * API Event Bus Tests
 * 
 * @module services/api/apiEventBus.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  APIEventBus,
  getAPIEventBus,
  initializeAPIEventBus,
  hasAPIEventBus,
  emitAPIEvent,
  onAPIEvent,
  useAPIEventBus,
  type RequestStartPayload,
  type RequestCompletePayload,
  type RequestErrorPayload,
  type CacheHitPayload,
  type RateLimitHitPayload,
  type CircuitBreakerPayload,
  type HealthStatusChangePayload,
} from './apiEventBus';

describe('APIEventBus', () => {
  let eventBus: APIEventBus;

  beforeEach(() => {
    eventBus = new APIEventBus({
      maxBufferSize: 100,
      enableBuffering: true,
      debugLogging: false,
    });
  });

  afterEach(() => {
    eventBus.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultBus = new APIEventBus();
      const stats = defaultBus.getStats();
      
      expect(stats.totalEvents).toBe(0);
      expect(stats.activeSubscriptions).toBe(0);
      expect(stats.bufferedEvents).toBe(0);
      
      defaultBus.destroy();
    });

    it('should initialize with custom configuration', () => {
      const customBus = new APIEventBus({
        maxBufferSize: 50,
        enableBuffering: false,
        debugLogging: true,
      });
      
      const stats = customBus.getStats();
      expect(stats).toBeDefined();
      
      customBus.destroy();
    });
  });

  describe('emit', () => {
    it('should emit an event and return it', () => {
      const event = eventBus.emit('request:start', { url: '/test', method: 'GET' });
      
      expect(event.type).toBe('request:start');
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.payload).toEqual({ url: '/test', method: 'GET' });
    });

    it('should include request ID in event', () => {
      const event = eventBus.emit('request:start', { url: '/test', method: 'GET' }, { requestId: 'req-123' });
      
      expect(event.requestId).toBe('req-123');
    });

    it('should include source in event', () => {
      const event = eventBus.emit('cache:hit', { key: 'test', age: 100 }, { source: 'cache' });
      
      expect(event.source).toBe('cache');
    });

    it('should include metadata in event', () => {
      const event = eventBus.emit('request:start', { url: '/test' }, { metadata: { custom: 'data' } });
      
      expect(event.metadata).toEqual({ custom: 'data' });
    });

    it('should update statistics on emit', () => {
      eventBus.emit('request:start', { url: '/test1', method: 'GET' });
      eventBus.emit('request:start', { url: '/test2', method: 'POST' });
      eventBus.emit('cache:hit', { key: 'test', age: 100 });
      
      const stats = eventBus.getStats();
      
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsByType['request:start']).toBe(2);
      expect(stats.eventsByType['cache:hit']).toBe(1);
    });

    it('should buffer events when buffering is enabled', () => {
      eventBus.emit('request:start', { url: '/test', method: 'GET' });
      eventBus.emit('cache:hit', { key: 'test', age: 100 });
      
      const stats = eventBus.getStats();
      expect(stats.bufferedEvents).toBe(2);
    });
  });

  describe('on', () => {
    it('should subscribe to an event type', () => {
      const handler = vi.fn();
      eventBus.on('request:start', handler);
      
      eventBus.emit('request:start', { url: '/test', method: 'GET' });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should receive event in handler', () => {
      const handler = vi.fn();
      eventBus.on('cache:hit', handler);
      
      const payload: CacheHitPayload = { key: 'test-key', age: 100 };
      eventBus.emit('cache:hit', payload);
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cache:hit',
          payload,
        })
      );
    });

    it('should support multiple handlers for same event type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.on('request:start', handler1);
      eventBus.on('request:start', handler2);
      
      eventBus.emit('request:start', { url: '/test', method: 'GET' });
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('request:start', handler);
      
      eventBus.emit('request:start', { url: '/test1', method: 'GET' });
      expect(handler).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      
      eventBus.emit('request:start', { url: '/test2', method: 'GET' });
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should filter by request ID', () => {
      const handler = vi.fn();
      eventBus.on('request:start', handler, { requestId: 'req-123' });
      
      eventBus.emit('request:start', { url: '/test1', method: 'GET' }, { requestId: 'req-456' });
      eventBus.emit('request:start', { url: '/test2', method: 'GET' }, { requestId: 'req-123' });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should filter by source', () => {
      const handler = vi.fn();
      eventBus.on('cache:hit', handler, { source: 'cache' });
      
      eventBus.emit('cache:hit', { key: 'test1', age: 100 }, { source: 'api' });
      eventBus.emit('cache:hit', { key: 'test2', age: 200 }, { source: 'cache' });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support maxCalls option', () => {
      const handler = vi.fn();
      eventBus.on('request:start', handler, { maxCalls: 2 });
      
      eventBus.emit('request:start', { url: '/test1', method: 'GET' });
      eventBus.emit('request:start', { url: '/test2', method: 'GET' });
      eventBus.emit('request:start', { url: '/test3', method: 'GET' });
      
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should support filter function', () => {
      const handler = vi.fn();
      eventBus.on('request:start', handler, {
        filter: (event) => (event.payload as RequestStartPayload).method === 'POST',
      });
      
      eventBus.emit('request:start', { url: '/test1', method: 'GET' });
      eventBus.emit('request:start', { url: '/test2', method: 'POST' });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('once', () => {
    it('should subscribe to an event only once', () => {
      const handler = vi.fn();
      eventBus.once('request:start', handler);
      
      eventBus.emit('request:start', { url: '/test1', method: 'GET' });
      eventBus.emit('request:start', { url: '/test2', method: 'GET' });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('onMultiple', () => {
    it('should subscribe to multiple event types', () => {
      const handler = vi.fn();
      eventBus.onMultiple(['request:start', 'request:complete'], handler);
      
      eventBus.emit('request:start', { url: '/test', method: 'GET' });
      eventBus.emit('request:complete', { requestId: 'req-1', url: '/test', method: 'GET', statusCode: 200, duration: 100, cached: false, deduplicated: false });
      
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should unsubscribe from all event types', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.onMultiple(['request:start', 'request:complete'], handler);
      
      unsubscribe();
      
      eventBus.emit('request:start', { url: '/test', method: 'GET' });
      eventBus.emit('request:complete', { requestId: 'req-1', url: '/test', method: 'GET', statusCode: 200, duration: 100, cached: false, deduplicated: false });
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onAll', () => {
    it('should subscribe to all event types', () => {
      const handler = vi.fn();
      eventBus.onAll(handler);
      
      eventBus.emit('request:start', { url: '/test', method: 'GET' });
      eventBus.emit('cache:hit', { key: 'test', age: 100 });
      eventBus.emit('rate_limit:hit', { key: 'api', limit: 100, remaining: 0, resetTime: Date.now() });
      
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('convenience emit methods', () => {
    it('should emit request start event', () => {
      const handler = vi.fn();
      eventBus.on('request:start', handler);
      
      eventBus.emitRequestStart({ url: '/api/test', method: 'POST' }, 'req-123');
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request:start',
          requestId: 'req-123',
          source: 'api',
        })
      );
    });

    it('should emit request complete event', () => {
      const handler = vi.fn();
      eventBus.on('request:complete', handler);
      
      const payload: RequestCompletePayload = {
        requestId: 'req-123',
        url: '/api/test',
        method: 'POST',
        statusCode: 200,
        duration: 150,
        cached: false,
        deduplicated: false,
      };
      
      eventBus.emitRequestComplete(payload);
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request:complete',
        })
      );
    });

    it('should emit request error event', () => {
      const handler = vi.fn();
      eventBus.on('request:error', handler);
      
      const payload: RequestErrorPayload = {
        requestId: 'req-123',
        url: '/api/test',
        method: 'POST',
        error: new Error('Network failure'),
        category: 'network',
        retryable: true,
      };
      
      eventBus.emitRequestError(payload);
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request:error',
        })
      );
    });

    it('should emit cache hit event', () => {
      const handler = vi.fn();
      eventBus.on('cache:hit', handler);
      
      const payload: CacheHitPayload = { key: 'cache-key', age: 5000 };
      eventBus.emitCacheHit(payload);
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cache:hit',
          source: 'cache',
        })
      );
    });

    it('should emit rate limit hit event', () => {
      const handler = vi.fn();
      eventBus.on('rate_limit:hit', handler);
      
      const payload: RateLimitHitPayload = {
        key: 'api-key',
        limit: 100,
        remaining: 0,
        resetTime: Date.now() + 60000,
      };
      
      eventBus.emitRateLimitHit(payload);
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rate_limit:hit',
          source: 'rate_limiter',
        })
      );
    });

    it('should emit circuit breaker event', () => {
      const handler = vi.fn();
      eventBus.on('circuit_breaker:open', handler);
      
      const payload: CircuitBreakerPayload = {
        endpoint: '/api/external',
        failures: 5,
        threshold: 5,
        state: 'open',
      };
      
      eventBus.emitCircuitBreaker(payload);
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'circuit_breaker:open',
        })
      );
    });

    it('should emit health status change event', () => {
      const handler = vi.fn();
      eventBus.on('health:status_change', handler);
      
      const payload: HealthStatusChangePayload = {
        endpoint: '/api/health',
        previousStatus: 'healthy',
        newStatus: 'unhealthy',
        responseTime: 5000,
      };
      
      eventBus.emitHealthStatusChange(payload);
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'health:status_change',
        })
      );
    });
  });

  describe('buffer', () => {
    it('should get buffered events', () => {
      eventBus.emit('request:start', { url: '/test1', method: 'GET' });
      eventBus.emit('request:start', { url: '/test2', method: 'POST' });
      eventBus.emit('cache:hit', { key: 'test', age: 100 });
      
      const events = eventBus.getBufferedEvents();
      
      expect(events.length).toBe(3);
    });

    it('should filter buffered events by type', () => {
      eventBus.emit('request:start', { url: '/test', method: 'GET' });
      eventBus.emit('cache:hit', { key: 'test', age: 100 });
      
      const events = eventBus.getBufferedEvents({ type: 'request:start' });
      
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('request:start');
    });

    it('should filter buffered events by requestId', () => {
      eventBus.emit('request:start', { url: '/test', method: 'GET' }, { requestId: 'req-123' });
      eventBus.emit('request:start', { url: '/test', method: 'GET' }, { requestId: 'req-456' });
      
      const events = eventBus.getBufferedEvents({ requestId: 'req-123' });
      
      expect(events.length).toBe(1);
    });

    it('should filter buffered events by source', () => {
      eventBus.emit('cache:hit', { key: 'test', age: 100 }, { source: 'cache' });
      eventBus.emit('cache:hit', { key: 'test', age: 100 }, { source: 'api' });
      
      const events = eventBus.getBufferedEvents({ source: 'cache' });
      
      expect(events.length).toBe(1);
    });

    it('should clear buffer', () => {
      eventBus.emit('request:start', { url: '/test', method: 'GET' });
      
      eventBus.clearBuffer();
      
      expect(eventBus.getBufferedEvents().length).toBe(0);
    });

    it('should replay events', () => {
      const handler = vi.fn();
      
      eventBus.emit('request:start', { url: '/test1', method: 'GET' });
      eventBus.emit('request:start', { url: '/test2', method: 'POST' });
      
      eventBus.replayEvents(handler);
      
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('statistics', () => {
    it('should return statistics', () => {
      const handler = vi.fn();
      eventBus.on('request:start', handler);
      eventBus.on('cache:hit', handler);
      
      const stats = eventBus.getStats();
      
      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('eventsByType');
      expect(stats).toHaveProperty('activeSubscriptions');
      expect(stats).toHaveProperty('subscriptionsByType');
      expect(stats).toHaveProperty('bufferedEvents');
      expect(stats).toHaveProperty('droppedEvents');
      expect(stats).toHaveProperty('avgProcessingTime');
    });

    it('should track active subscriptions', () => {
      eventBus.on('request:start', () => {});
      eventBus.on('request:start', () => {});
      eventBus.on('cache:hit', () => {});
      
      const stats = eventBus.getStats();
      
      expect(stats.activeSubscriptions).toBe(3);
      expect(stats.subscriptionsByType['request:start']).toBe(2);
      expect(stats.subscriptionsByType['cache:hit']).toBe(1);
    });

    it('should reset statistics', () => {
      eventBus.emit('request:start', { url: '/test', method: 'GET' });
      
      eventBus.resetStats();
      
      const stats = eventBus.getStats();
      expect(stats.totalEvents).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should catch sync handler errors', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();
      
      eventBus.on('request:start', errorHandler);
      eventBus.on('request:start', normalHandler);
      
      // Should not throw
      expect(() => {
        eventBus.emit('request:start', { url: '/test', method: 'GET' });
      }).not.toThrow();
      
      // Normal handler should still be called
      expect(normalHandler).toHaveBeenCalled();
    });

    it('should handle async handlers', async () => {
      const asyncHandler = vi.fn(async () => {
        await new Promise(r => setTimeout(r, 10));
      });
      
      eventBus.on('request:start', asyncHandler);
      
      eventBus.emit('request:start', { url: '/test', method: 'GET' });
      
      // Give async handler time to complete
      await new Promise(r => setTimeout(r, 50));
      
      expect(asyncHandler).toHaveBeenCalled();
    });
  });

  describe('buffer overflow', () => {
    it('should drop old events when buffer is full', () => {
      const smallBus = new APIEventBus({ maxBufferSize: 3, enableBuffering: true });
      
      smallBus.emit('request:start', { url: '/test1', method: 'GET' });
      smallBus.emit('request:start', { url: '/test2', method: 'GET' });
      smallBus.emit('request:start', { url: '/test3', method: 'GET' });
      smallBus.emit('request:start', { url: '/test4', method: 'GET' });
      
      const stats = smallBus.getStats();
      
      expect(stats.bufferedEvents).toBe(3);
      expect(stats.droppedEvents).toBe(1);
      
      smallBus.destroy();
    });
  });
});

describe('Singleton functions', () => {
  it('should get singleton instance', () => {
    const instance1 = getAPIEventBus();
    const instance2 = getAPIEventBus();
    expect(instance1).toBe(instance2);
  });

  it('should initialize new instance', () => {
    initializeAPIEventBus({ maxBufferSize: 50 });
    expect(hasAPIEventBus()).toBe(true);
  });
});

describe('Convenience functions', () => {
  it('should emit event using convenience function', () => {
    const handler = vi.fn();
    onAPIEvent('request:start', handler);
    
    emitAPIEvent('request:start', { url: '/test', method: 'GET' });
    
    expect(handler).toHaveBeenCalled();
  });

  it('should subscribe using convenience function', () => {
    const handler = vi.fn();
    const unsubscribe = onAPIEvent('cache:hit', handler);
    
    emitAPIEvent('cache:hit', { key: 'test', age: 100 });
    
    expect(handler).toHaveBeenCalled();
    
    unsubscribe();
  });
});

describe('useAPIEventBus hook', () => {
  it('should return all event bus methods', () => {
    const hook = useAPIEventBus();
    
    expect(hook.emit).toBeDefined();
    expect(hook.on).toBeDefined();
    expect(hook.once).toBeDefined();
    expect(hook.onMultiple).toBeDefined();
    expect(hook.onAll).toBeDefined();
    expect(hook.getBufferedEvents).toBeDefined();
    expect(hook.getStats).toBeDefined();
    expect(hook.clearBuffer).toBeDefined();
    expect(hook.resetStats).toBeDefined();
  });

  it('should provide convenience emit methods', () => {
    const hook = useAPIEventBus();
    
    expect(hook.emitRequestStart).toBeDefined();
    expect(hook.emitRequestProgress).toBeDefined();
    expect(hook.emitRequestComplete).toBeDefined();
    expect(hook.emitRequestError).toBeDefined();
    expect(hook.emitCacheHit).toBeDefined();
    expect(hook.emitCacheMiss).toBeDefined();
    expect(hook.emitRateLimitHit).toBeDefined();
    expect(hook.emitCircuitBreaker).toBeDefined();
    expect(hook.emitHealthStatusChange).toBeDefined();
    expect(hook.emitErrorClassified).toBeDefined();
  });
});
