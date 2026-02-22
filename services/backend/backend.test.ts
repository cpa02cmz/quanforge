/**
 * Backend Services Tests
 * 
 * Tests for backend service registry, request context manager,
 * and performance analyzer.
 * 
 * @module services/backend/tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import types
import type {
  BackendServiceConfig,
  BackendServiceStatus,
} from './types';

// Import services
import {
  BackendServiceRegistry,
  backendServiceRegistry,
} from './serviceRegistry';

import {
  RequestContextManager,
  requestContextManager,
} from './requestContext';

import {
  BackendPerformanceAnalyzer,
  backendPerformanceAnalyzer,
  recordLatency,
  recordRequestCount,
  recordErrorCount,
} from './performanceAnalyzer';

describe('Backend Service Registry', () => {
  let registry: BackendServiceRegistry;

  beforeEach(() => {
    // Create a fresh instance for each test
    registry = BackendServiceRegistry.getInstance();
  });

  afterEach(() => {
    // Clean up after each test
    registry.destroy();
  });

  it('should be a singleton', () => {
    const instance1 = BackendServiceRegistry.getInstance();
    const instance2 = BackendServiceRegistry.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should register a service', () => {
    const config: BackendServiceConfig = {
      name: 'test-service',
      criticality: 'high',
      healthCheck: async () => ({
        status: 'healthy' as BackendServiceStatus,
        timestamp: Date.now(),
      }),
    };

    const id = registry.registerService(config);
    expect(id).toBeDefined();
    expect(id).toContain('test-service');

    const service = registry.getServiceByName('test-service');
    expect(service).toBeDefined();
    expect(service?.config.name).toBe('test-service');
    expect(service?.config.criticality).toBe('high');
  });

  it('should unregister a service', () => {
    const config: BackendServiceConfig = {
      name: 'test-service',
      criticality: 'medium',
    };

    const id = registry.registerService(config);
    expect(registry.getService(id)).toBeDefined();

    const result = registry.unregisterService(id);
    expect(result).toBe(true);
    expect(registry.getService(id)).toBeUndefined();
  });

  it('should check service health', async () => {
    const config: BackendServiceConfig = {
      name: 'healthy-service',
      criticality: 'high',
      healthCheck: async () => ({
        status: 'healthy' as BackendServiceStatus,
        message: 'Service is healthy',
        timestamp: Date.now(),
      }),
    };

    const id = registry.registerService(config);
    const result = await registry.checkServiceHealth(id);

    expect(result).toBeDefined();
    expect(result?.status).toBe('healthy');
    expect(result?.latency).toBeDefined();
  });

  it('should handle health check failures', async () => {
    const config: BackendServiceConfig = {
      name: 'failing-service',
      criticality: 'medium',
      healthCheck: async () => {
        throw new Error('Health check failed');
      },
    };

    const id = registry.registerService(config);
    const result = await registry.checkServiceHealth(id);

    expect(result).toBeDefined();
    expect(result?.status).toBe('degraded'); // First failure should be degraded
  });

  it('should record requests', () => {
    const config: BackendServiceConfig = {
      name: 'test-service',
      criticality: 'low',
    };

    registry.registerService(config);

    registry.recordRequest('test-service', true, 100);
    registry.recordRequest('test-service', true, 150);
    registry.recordRequest('test-service', false, 200);

    const service = registry.getServiceByName('test-service');
    expect(service?.totalRequests).toBe(3);
    expect(service?.successfulRequests).toBe(2);
    expect(service?.failedRequests).toBe(1);
    expect(service?.averageResponseTime).toBeGreaterThan(0);
  });

  it('should get registry statistics', () => {
    registry.registerService({ name: 'service-a', criticality: 'critical' });
    registry.registerService({ name: 'service-b', criticality: 'high' });
    registry.registerService({ name: 'service-c', criticality: 'low' });

    const stats = registry.getStats();
    expect(stats.totalServices).toBe(3);
    expect(stats.overallHealth).toBeDefined();
  });

  it('should get services by status', () => {
    registry.registerService({ name: 'service-a', criticality: 'high' });

    const healthyServices = registry.getServicesByStatus('healthy');
    expect(healthyServices.length).toBeGreaterThan(0);
  });

  it('should get services by criticality', () => {
    registry.registerService({ name: 'critical-service', criticality: 'critical' });
    registry.registerService({ name: 'high-service', criticality: 'high' });

    const criticalServices = registry.getServicesByCriticality('critical');
    expect(criticalServices.length).toBe(1);
    expect(criticalServices[0].config.name).toBe('critical-service');
  });

  it('should emit events on status change', async () => {
    const eventHandler = vi.fn();
    const unsubscribe = registry.subscribe(eventHandler);

    const config: BackendServiceConfig = {
      name: 'test-service',
      criticality: 'medium',
      healthCheck: async () => ({
        status: 'healthy' as BackendServiceStatus,
        timestamp: Date.now(),
      }),
    };

    registry.registerService(config);

    // Wait for health check to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(eventHandler).toHaveBeenCalled();
    unsubscribe();
  });
});

describe('Request Context Manager', () => {
  let manager: RequestContextManager;

  beforeEach(() => {
    manager = RequestContextManager.getInstance();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should be a singleton', () => {
    const instance1 = RequestContextManager.getInstance();
    const instance2 = RequestContextManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should start a request', () => {
    const context = manager.startRequest({
      serviceName: 'test-service',
      operation: 'test-operation',
    });

    expect(context.id).toBeDefined();
    expect(context.serviceName).toBe('test-service');
    expect(context.operation).toBe('test-operation');
    expect(context.traceId).toBeDefined();
    expect(context.spanId).toBeDefined();
  });

  it('should end a request successfully', () => {
    const context = manager.startRequest({
      serviceName: 'test-service',
      operation: 'test-operation',
    });

    manager.endRequest(context);

    const entry = manager.getRequest(context.id);
    expect(entry?.status).toBe('success');
    expect(entry?.duration).toBeDefined();
  });

  it('should end a request with error', () => {
    const context = manager.startRequest({
      serviceName: 'test-service',
      operation: 'test-operation',
    });

    const error = new Error('Test error');
    manager.endRequestWithError(context, error);

    const entry = manager.getRequest(context.id);
    expect(entry?.status).toBe('error');
    expect(entry?.error).toBe(error);
  });

  it('should create nested request contexts', () => {
    const parentContext = manager.startRequest({
      serviceName: 'parent-service',
      operation: 'parent-operation',
    });

    const childContext = manager.createChildContext(parentContext, {
      serviceName: 'child-service',
      operation: 'child-operation',
    });

    expect(childContext.parentId).toBe(parentContext.id);
    expect(childContext.traceId).toBe(parentContext.traceId);

    const parentEntry = manager.getRequest(parentContext.id);
    expect(parentEntry?.children).toContain(childContext.id);
  });

  it('should get pending requests', () => {
    manager.startRequest({
      serviceName: 'test-service',
      operation: 'test-operation',
    });

    const pending = manager.getPendingRequests();
    expect(pending.length).toBe(1);
  });

  it('should get request statistics', () => {
    // Create some requests
    const context1 = manager.startRequest({
      serviceName: 'test-service',
      operation: 'op1',
    });
    manager.endRequest(context1);

    const context2 = manager.startRequest({
      serviceName: 'test-service',
      operation: 'op2',
    });
    manager.endRequestWithError(context2, new Error('Test error'));

    const stats = manager.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.successfulRequests).toBe(1);
    expect(stats.failedRequests).toBe(1);
  });

  it('should wrap async function with context tracking', async () => {
    const result = await manager.withContext(
      { serviceName: 'test-service', operation: 'test-op' },
      async () => {
        return 'test-result';
      }
    );

    expect(result).toBe('test-result');

    const pending = manager.getPendingRequests();
    expect(pending.length).toBe(0);
  });

  it('should track failed wrapped functions', async () => {
    await expect(
      manager.withContext(
        { serviceName: 'test-service', operation: 'test-op' },
        async () => {
          throw new Error('Test error');
        }
      )
    ).rejects.toThrow('Test error');

    const stats = manager.getStats();
    expect(stats.failedRequests).toBe(1);
  });
});

describe('Backend Performance Analyzer', () => {
  let analyzer: BackendPerformanceAnalyzer;

  beforeEach(() => {
    analyzer = BackendPerformanceAnalyzer.getInstance();
    analyzer.clearAllMetrics();
  });

  afterEach(() => {
    analyzer.destroy();
  });

  it('should be a singleton', () => {
    const instance1 = BackendPerformanceAnalyzer.getInstance();
    const instance2 = BackendPerformanceAnalyzer.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should record metrics', () => {
    analyzer.recordMetric({
      name: 'latency',
      value: 100,
      unit: 'ms',
      timestamp: Date.now(),
      service: 'test-service',
      operation: 'test-op',
    });

    const metrics = analyzer.getMetrics('test-service');
    expect(metrics.length).toBe(1);
    expect(metrics[0].value).toBe(100);
  });

  it('should analyze service performance', () => {
    // Record some latency and request count metrics
    for (let i = 0; i < 10; i++) {
      analyzer.recordMetric({
        name: 'latency',
        value: 100 + i * 10,
        unit: 'ms',
        timestamp: Date.now() - i * 1000,
        service: 'test-service',
        operation: 'test-op',
      });
      
      analyzer.recordMetric({
        name: 'request_count',
        value: 1,
        unit: 'count',
        timestamp: Date.now() - i * 1000,
        service: 'test-service',
        operation: 'test-op',
      });
    }

    const analysis = analyzer.analyzeService('test-service');
    expect(analysis.serviceName).toBe('test-service');
    expect(analysis.metrics.requestCount).toBeGreaterThan(0);
    expect(analysis.score).toBeGreaterThan(0);
    expect(analysis.score).toBeLessThanOrEqual(100);
  });

  it('should generate performance report', () => {
    // Record metrics for multiple services
    analyzer.recordMetric({
      name: 'latency',
      value: 50,
      unit: 'ms',
      timestamp: Date.now(),
      service: 'service-a',
    });

    analyzer.recordMetric({
      name: 'latency',
      value: 200,
      unit: 'ms',
      timestamp: Date.now(),
      service: 'service-b',
    });

    const report = analyzer.generateReport();
    expect(report.services.length).toBe(2);
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.summary).toBeDefined();
  });

  it('should detect bottlenecks', () => {
    // Record high latency metrics
    for (let i = 0; i < 10; i++) {
      analyzer.recordMetric({
        name: 'latency',
        value: 3000, // 3 seconds - high latency
        unit: 'ms',
        timestamp: Date.now(),
        service: 'slow-service',
      });
    }

    const analysis = analyzer.analyzeService('slow-service');
    expect(analysis.bottlenecks.length).toBeGreaterThan(0);
    expect(analysis.bottlenecks.some(b => b.type === 'latency')).toBe(true);
  });

  it('should generate recommendations', () => {
    // Record high latency metrics
    for (let i = 0; i < 10; i++) {
      analyzer.recordMetric({
        name: 'latency',
        value: 500,
        unit: 'ms',
        timestamp: Date.now(),
        service: 'test-service',
      });
    }

    const analysis = analyzer.analyzeService('test-service');
    expect(analysis.recommendations.length).toBeGreaterThan(0);
  });

  it('should track services', () => {
    analyzer.recordMetric({
      name: 'latency',
      value: 100,
      unit: 'ms',
      timestamp: Date.now(),
      service: 'service-a',
    });

    analyzer.recordMetric({
      name: 'latency',
      value: 100,
      unit: 'ms',
      timestamp: Date.now(),
      service: 'service-b',
    });

    const services = analyzer.getTrackedServices();
    expect(services).toContain('service-a');
    expect(services).toContain('service-b');
  });

  it('should clear metrics', () => {
    analyzer.recordMetric({
      name: 'latency',
      value: 100,
      unit: 'ms',
      timestamp: Date.now(),
      service: 'test-service',
    });

    analyzer.clearServiceMetrics('test-service');
    const metrics = analyzer.getMetrics('test-service');
    expect(metrics.length).toBe(0);
  });
});

describe('Helper Functions', () => {
  it('should have recordLatency function', () => {
    expect(recordLatency).toBeDefined();
    expect(typeof recordLatency).toBe('function');
  });

  it('should have recordRequestCount function', () => {
    expect(recordRequestCount).toBeDefined();
    expect(typeof recordRequestCount).toBe('function');
  });

  it('should have recordErrorCount function', () => {
    expect(recordErrorCount).toBeDefined();
    expect(typeof recordErrorCount).toBe('function');
  });
});

// Import new services for additional tests
import {
  BackendRateLimiter,
  RequestQueueManager,
  BackendManager,
} from './index';

describe('Backend Rate Limiter', () => {
  let limiter: BackendRateLimiter;

  beforeEach(() => {
    (BackendRateLimiter as any).instance = null;
    limiter = BackendRateLimiter.getInstance();
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('should be a singleton', () => {
    const instance1 = BackendRateLimiter.getInstance();
    const instance2 = BackendRateLimiter.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should configure services', () => {
    limiter.configureService({
      serviceName: 'rate_test',
      maxTokens: 10,
      refillRate: 5,
    });

    const status = limiter.getStatus('rate_test');
    expect(status).toBeDefined();
    expect(status?.maxTokens).toBe(10);
  });

  it('should allow requests under limit', () => {
    limiter.configureService({
      serviceName: 'allow_service',
      maxTokens: 100,
      refillRate: 10,
    });

    const result = limiter.tryConsume('allow_service', 1);
    expect(result.allowed).toBe(true);
    expect(result.remainingTokens).toBeLessThan(100);
  });

  it('should reject requests over limit', () => {
    limiter.configureService({
      serviceName: 'reject_service',
      maxTokens: 2,
      refillRate: 1,
    });

    limiter.tryConsume('reject_service', 1);
    limiter.tryConsume('reject_service', 1);

    const result = limiter.tryConsume('reject_service', 1);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeDefined();
  });

  it('should track statistics', () => {
    limiter.configureService({
      serviceName: 'stats_test',
      maxTokens: 10,
      refillRate: 5,
    });

    limiter.tryConsume('stats_test', 1);
    limiter.tryConsume('stats_test', 1);

    const status = limiter.getStatus('stats_test');
    expect(status?.totalRequests).toBe(2);
    expect(status?.allowedRequests).toBe(2);
  });

  it('should reset rate limits', () => {
    limiter.configureService({
      serviceName: 'reset_test',
      maxTokens: 5,
      refillRate: 1,
    });

    // Consume all tokens
    for (let i = 0; i < 5; i++) {
      limiter.tryConsume('reset_test', 1);
    }

    limiter.reset('reset_test');

    const status = limiter.getStatus('reset_test');
    expect(status?.availableTokens).toBe(5);
  });

  it('should provide overall statistics', () => {
    limiter.configureService({
      serviceName: 'overall_test',
      maxTokens: 10,
      refillRate: 5,
    });

    const stats = limiter.getStats();
    expect(stats.totalServices).toBeGreaterThan(0);
  });
});

describe('Request Queue Manager', () => {
  let queueManager: RequestQueueManager;

  beforeEach(() => {
    (RequestQueueManager as any).instance = null;
    queueManager = RequestQueueManager.getInstance();
  });

  afterEach(() => {
    queueManager.destroy();
  });

  it('should be a singleton', () => {
    const instance1 = RequestQueueManager.getInstance();
    const instance2 = RequestQueueManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should configure queues', () => {
    queueManager.configureQueue({
      serviceName: 'queue_test',
      maxConcurrent: 5,
      maxSize: 100,
      defaultTimeout: 30000,
      defaultRetries: 2,
      processingInterval: 50,
    });

    const stats = queueManager.getStats('queue_test');
    expect(stats.serviceName).toBe('queue_test');
  });

  it('should enqueue items', async () => {
    queueManager.configureQueue({
      serviceName: 'enqueue_test',
      maxConcurrent: 1,
      maxSize: 10,
      defaultTimeout: 5000,
      defaultRetries: 1,
      processingInterval: 10,
    });

    queueManager.registerProcessor('enqueue_test', async (item) => {
      return { processed: item.id };
    });

    const itemId = await queueManager.enqueue(
      'enqueue_test',
      'test_op',
      { data: 'test' }
    );

    expect(itemId).toBeDefined();
    expect(itemId).toContain('q_');
  });

  it('should handle queue overflow', async () => {
    queueManager.configureQueue({
      serviceName: 'overflow_test',
      maxConcurrent: 0, // No processing
      maxSize: 2,
      defaultTimeout: 5000,
      defaultRetries: 0,
      processingInterval: 100,
    });

    await queueManager.enqueue('overflow_test', 'op', {});
    await queueManager.enqueue('overflow_test', 'op', {});

    await expect(queueManager.enqueue('overflow_test', 'op', {})).rejects.toThrow('Queue overflow');
  });

  it('should provide queue statistics', () => {
    queueManager.configureQueue({
      serviceName: 'stats_queue',
      maxConcurrent: 1,
      maxSize: 10,
      defaultTimeout: 5000,
      defaultRetries: 1,
      processingInterval: 100,
    });

    const stats = queueManager.getStats('stats_queue');
    expect(stats.serviceName).toBe('stats_queue');
    expect(stats.pendingItems).toBe(0);
  });

  it('should clear queues', async () => {
    queueManager.configureQueue({
      serviceName: 'clear_test',
      maxConcurrent: 0, // No processing
      maxSize: 100,
      defaultTimeout: 5000,
      defaultRetries: 0,
      processingInterval: 100,
    });

    await queueManager.enqueue('clear_test', 'op', {});
    await queueManager.enqueue('clear_test', 'op', {});

    const cleared = queueManager.clearQueue('clear_test');
    expect(cleared).toBe(2);
  });

  it('should support priority ordering', async () => {
    queueManager.configureQueue({
      serviceName: 'priority_test',
      maxConcurrent: 1,
      maxSize: 10,
      defaultTimeout: 5000,
      defaultRetries: 1,
      processingInterval: 10,
    });

    const lowId = await queueManager.enqueue('priority_test', 'op', {}, { priority: 'low' });
    const highId = await queueManager.enqueue('priority_test', 'op', {}, { priority: 'high' });
    
    expect(lowId).toBeDefined();
    expect(highId).toBeDefined();
  });
});

describe('Backend Manager', () => {
  let manager: BackendManager;

  beforeEach(() => {
    (BackendManager as any).instance = null;
    manager = BackendManager.getInstance();
  });

  afterEach(async () => {
    try {
      await manager.shutdown();
    } catch {
      // Ignore shutdown errors
    }
  });

  it('should be a singleton', () => {
    const instance1 = BackendManager.getInstance();
    const instance2 = BackendManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should initialize', async () => {
    await manager.initialize();
    const status = manager.getStatus();
    expect(status.initialized).toBe(true);
  });

  it('should get status', async () => {
    await manager.initialize();
    const status = manager.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.uptime).toBeGreaterThanOrEqual(0);
    expect(status.services).toBeDefined();
    expect(status.requests).toBeDefined();
  });

  it('should execute operations', async () => {
    await manager.initialize();

    const result = await manager.execute(
      { serviceName: 'test_service', operation: 'test_op' },
      async () => 'test_result'
    );

    expect(result).toBe('test_result');
  });

  it('should handle operation errors', async () => {
    await manager.initialize();

    await expect(
      manager.execute(
        { serviceName: 'error_service', operation: 'error_op' },
        async () => {
          throw new Error('Test error');
        }
      )
    ).rejects.toThrow('Test error');
  });

  it('should register services', async () => {
    await manager.initialize();

    const id = manager.registerService({
      name: 'custom_service',
      description: 'Custom service for testing',
      criticality: 'medium',
    });

    expect(id).toBeDefined();
  });

  it('should configure rate limits', async () => {
    await manager.initialize();

    manager.configureRateLimit({
      serviceName: 'rate_config_test',
      maxTokens: 10,
      refillRate: 5,
    });

    // Should not throw
    expect(true).toBe(true);
  });

  it('should provide health dashboard', async () => {
    await manager.initialize();

    const dashboard = await manager.getHealthDashboard();
    expect(dashboard.timestamp).toBeDefined();
    expect(dashboard.services).toBeDefined();
    expect(dashboard.metrics).toBeDefined();
  });

  it('should provide performance report', async () => {
    await manager.initialize();

    const report = manager.getPerformanceReport();
    expect(report.generatedAt).toBeDefined();
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
  });

  it('should handle subscriptions', async () => {
    await manager.initialize();

    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);

    // Trigger an event by registering a service
    manager.registerService({
      name: 'subscription_test',
      criticality: 'low',
    });

    unsubscribe();
    expect(typeof unsubscribe).toBe('function');
  });

  it('should shutdown gracefully', async () => {
    await manager.initialize();
    await manager.shutdown();

    const status = manager.getStatus();
    expect(status.initialized).toBe(false);
  });
});

describe('Integration Tests', () => {
  it('should work together end-to-end', async () => {
    // Reset singletons
    (BackendManager as any).instance = null;
    const manager = BackendManager.getInstance();

    await manager.initialize();

    // Register a service
    manager.registerService({
      name: 'integration_service',
      criticality: 'high',
    });

    // Configure rate limiting
    manager.configureRateLimit({
      serviceName: 'integration_service',
      maxTokens: 10,
      refillRate: 5,
    });

    // Execute operation
    const result = await manager.execute(
      { serviceName: 'integration_service', operation: 'test_op' },
      async () => ({ success: true })
    );

    expect(result.success).toBe(true);

    // Check health dashboard
    const dashboard = await manager.getHealthDashboard();
    expect(dashboard.overallStatus).toBeDefined();

    // Check performance report
    const report = manager.getPerformanceReport();
    expect(report.generatedAt).toBeDefined();

    await manager.shutdown();
  });

  it('should handle concurrent requests', async () => {
    (BackendManager as any).instance = null;
    const manager = BackendManager.getInstance();

    await manager.initialize();

    manager.configureRateLimit({
      serviceName: 'concurrent_test',
      maxTokens: 100,
      refillRate: 50,
    });

    const promises = Array.from({ length: 10 }, (_, i) =>
      manager.execute(
        { serviceName: 'concurrent_test', operation: `op_${i}` },
        async () => i
      )
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(10);
    expect(results).toEqual(expect.arrayContaining([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));

    await manager.shutdown();
  });
});
