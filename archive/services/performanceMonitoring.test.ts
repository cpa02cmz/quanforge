import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor, EdgePerformanceTracker, performanceMonitor, edgePerformanceTracker } from './performanceMonitoring';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should record operation metrics correctly', () => {
    monitor.record('db-query', 100);
    monitor.record('db-query', 200);

    const metrics = monitor.getMetrics('db-query');
    
    expect(metrics).toBeDefined();
    expect(metrics!.count).toBe(2);
    expect(metrics!.totalTime).toBe(300);
    expect(metrics!.avgTime).toBe(150);
  });

  test('should initialize new operation on first record', () => {
    monitor.record('new-operation', 50);

    const metrics = monitor.getMetrics('new-operation');
    
    expect(metrics).toBeDefined();
    expect(metrics!.count).toBe(1);
    expect(metrics!.totalTime).toBe(50);
    expect(metrics!.avgTime).toBe(50);
  });

  test('should return undefined for non-existent operation', () => {
    const metrics = monitor.getMetrics('non-existent');
    
    expect(metrics).toBeUndefined();
  });

  test('should retrieve all metrics', () => {
    monitor.record('operation-1', 100);
    monitor.record('operation-1', 200);
    monitor.record('operation-2', 50);

    const allMetrics = monitor.getAllMetrics();
    
    expect(allMetrics).toHaveProperty('operation-1');
    expect(allMetrics).toHaveProperty('operation-2');
    expect(allMetrics['operation-1'].count).toBe(2);
    expect(allMetrics['operation-2'].count).toBe(1);
  });

  test('should reset all metrics', () => {
    monitor.record('operation-1', 100);
    monitor.record('operation-2', 200);

    monitor.reset();

    const allMetrics = monitor.getAllMetrics();
    expect(Object.keys(allMetrics)).toHaveLength(0);
  });

  test('should log metrics to console', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    monitor.record('db-query', 100);
    monitor.record('db-query', 200);

    monitor.logMetrics();

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should calculate correct average over multiple records', () => {
    monitor.record('avg-test', 10);
    monitor.record('avg-test', 20);
    monitor.record('avg-test', 30);
    monitor.record('avg-test', 40);

    const metrics = monitor.getMetrics('avg-test');
    
    expect(metrics!.avgTime).toBe(25);
  });
});

describe('EdgePerformanceTracker', () => {
  let tracker: EdgePerformanceTracker;

  beforeEach(() => {
    tracker = new EdgePerformanceTracker();
  });

  test('should record metrics for operations', () => {
    tracker.recordMetric('api-call', 100);
    tracker.recordMetric('api-call', 200);

    const average = tracker.getAverage('api-call');
    
    expect(average).toBe(150);
  });

  test('should return 0 average for non-existent operation', () => {
    const average = tracker.getAverage('non-existent');
    
    expect(average).toBe(0);
  });

  test('should calculate percentiles correctly', () => {
    tracker.recordMetric('timing-test', 10);
    tracker.recordMetric('timing-test', 20);
    tracker.recordMetric('timing-test', 30);
    tracker.recordMetric('timing-test', 40);
    tracker.recordMetric('timing-test', 50);

    const p50 = tracker.getPercentile('timing-test', 50);
    const p95 = tracker.getPercentile('timing-test', 95);
    const p99 = tracker.getPercentile('timing-test', 99);

    expect(p50).toBe(30);
    expect(p95).toBe(50);
    expect(p99).toBe(50);
  });

  test('should return 0 for percentiles on empty data', () => {
    const p95 = tracker.getPercentile('non-existent', 95);
    
    expect(p95).toBe(0);
  });

  test('should limit metric history to 100 values', () => {
    for (let i = 0; i < 150; i++) {
      tracker.recordMetric('limit-test', i);
    }

    const metrics = tracker.getAllMetrics();
    expect(metrics['limit-test'].count).toBe(100);
  });

  test('should retrieve all metrics with statistics', () => {
    tracker.recordMetric('op-1', 10);
    tracker.recordMetric('op-1', 20);
    tracker.recordMetric('op-1', 30);
    tracker.recordMetric('op-1', 40);
    tracker.recordMetric('op-1', 50);
    tracker.recordMetric('op-2', 100);

    const allMetrics = tracker.getAllMetrics();
    
    expect(allMetrics).toHaveProperty('op-1');
    expect(allMetrics).toHaveProperty('op-2');
    expect(allMetrics['op-1'].avg).toBe(30);
    expect(allMetrics['op-1'].count).toBe(5);
    expect(allMetrics['op-2'].count).toBe(1);
  });

  test('should handle single value for percentile calculation', () => {
    tracker.recordMetric('single-value', 42);

    const p95 = tracker.getPercentile('single-value', 95);
    
    expect(p95).toBe(42);
  });

  test('should maintain separate metrics for different operations', () => {
    tracker.recordMetric('operation-a', 100);
    tracker.recordMetric('operation-b', 200);

    const avgA = tracker.getAverage('operation-a');
    const avgB = tracker.getAverage('operation-b');
    
    expect(avgA).toBe(100);
    expect(avgB).toBe(200);
  });
});

describe('Exported singleton instances', () => {
  test('performanceMonitor should be accessible', () => {
    expect(performanceMonitor).toBeDefined();
    expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
  });

  test('edgePerformanceTracker should be accessible', () => {
    expect(edgePerformanceTracker).toBeDefined();
    expect(edgePerformanceTracker).toBeInstanceOf(EdgePerformanceTracker);
  });

  test('singleton instances should maintain state across imports', () => {
    performanceMonitor.record('singleton-test', 100);
    const metrics = performanceMonitor.getMetrics('singleton-test');
    
    expect(metrics).toBeDefined();
    expect(metrics!.count).toBe(1);
    
    performanceMonitor.reset();
  });
});
