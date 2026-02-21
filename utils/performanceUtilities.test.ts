/**
 * Performance Utilities Tests
 * 
 * Tests for resource preloader, lazy loader, and web vitals collector.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock document and window for testing
const mockLink = {
  rel: '',
  href: '',
  setAttribute: vi.fn(),
  crossOrigin: '',
  type: '',
};

const mockDocument = {
  head: {
    appendChild: vi.fn(),
    querySelector: vi.fn(() => null),
  },
  getElementsByTagName: vi.fn(() => [{ length: 10 }]),
  addEventListener: vi.fn(),
  visibilityState: 'visible',
  createElement: vi.fn(() => mockLink),
};

const mockLocation = {
  href: 'https://test.example.com/page',
  origin: 'https://test.example.com',
  pathname: '/page',
};

const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  requestIdleCallback: vi.fn((cb: () => void) => setTimeout(cb, 1)),
  location: mockLocation,
};

const mockPerformance = {
  getEntriesByType: vi.fn(() => []),
  getEntriesByName: vi.fn(() => []),
  getEntries: vi.fn(() => []),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50 MB
    jsHeapSizeLimit: 200 * 1024 * 1024, // 200 MB
  },
};

// Setup global mocks
vi.stubGlobal('document', mockDocument);
vi.stubGlobal('window', mockWindow);
vi.stubGlobal('performance', mockPerformance);
vi.stubGlobal('navigator', {
  sendBeacon: vi.fn(() => true),
  userAgent: 'test-agent',
  hardwareConcurrency: 4,
  deviceMemory: 8,
  connection: { effectiveType: '4g' },
});

describe('Resource Preloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should be importable', async () => {
    const { resourcePreloader } = await import('../utils/resourcePreloader');
    expect(resourcePreloader).toBeDefined();
  });

  it('should have preload method', async () => {
    const { resourcePreloader } = await import('../utils/resourcePreloader');
    expect(typeof resourcePreloader.preload).toBe('function');
  });

  it('should have prefetch method', async () => {
    const { resourcePreloader } = await import('../utils/resourcePreloader');
    expect(typeof resourcePreloader.prefetch).toBe('function');
  });

  it('should have preconnect method', async () => {
    const { resourcePreloader } = await import('../utils/resourcePreloader');
    expect(typeof resourcePreloader.preconnect).toBe('function');
  });

  it('should have dnsPrefetch method', async () => {
    const { resourcePreloader } = await import('../utils/resourcePreloader');
    expect(typeof resourcePreloader.dnsPrefetch).toBe('function');
  });

  it('should track preloaded resources', async () => {
    const { resourcePreloader } = await import('../utils/resourcePreloader');
    
    resourcePreloader.reset();
    resourcePreloader.preload('/test.css', { as: 'style' });
    
    const stats = resourcePreloader.getStats();
    expect(stats.preloaded).toContain('/test.css');
  });

  it('should have reset method', async () => {
    const { resourcePreloader } = await import('../utils/resourcePreloader');
    expect(typeof resourcePreloader.reset).toBe('function');
  });

  it('should check if resource is preloaded', async () => {
    const { resourcePreloader } = await import('../utils/resourcePreloader');
    
    resourcePreloader.reset();
    expect(resourcePreloader.isPreloaded('/test.css')).toBe(false);
    
    resourcePreloader.preload('/test.css', { as: 'style' });
    expect(resourcePreloader.isPreloaded('/test.css')).toBe(true);
  });

  it('should have getStats method', async () => {
    const { resourcePreloader } = await import('../utils/resourcePreloader');
    expect(typeof resourcePreloader.getStats).toBe('function');
  });
});

describe('Lazy Loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be importable', async () => {
    const { lazyLoader } = await import('../utils/lazyLoader');
    expect(lazyLoader).toBeDefined();
  });

  it('should have load method', async () => {
    const { lazyLoader } = await import('../utils/lazyLoader');
    expect(typeof lazyLoader.load).toBe('function');
  });

  it('should have prefetch method', async () => {
    const { lazyLoader } = await import('../utils/lazyLoader');
    expect(typeof lazyLoader.prefetch).toBe('function');
  });

  it('should have isLoaded method', async () => {
    const { lazyLoader } = await import('../utils/lazyLoader');
    expect(typeof lazyLoader.isLoaded).toBe('function');
  });

  it('should have getStats method', async () => {
    const { lazyLoader } = await import('../utils/lazyLoader');
    expect(typeof lazyLoader.getStats).toBe('function');
  });

  it('should have clearAll method', async () => {
    const { lazyLoader } = await import('../utils/lazyLoader');
    expect(typeof lazyLoader.clearAll).toBe('function');
  });

  it('should create lazy service factory', async () => {
    const { createLazyService } = await import('../utils/lazyLoader');
    expect(typeof createLazyService).toBe('function');
    
    const factory = createLazyService('test', async () => ({ value: 42 }));
    expect(factory.isLoaded()).toBe(false);
    expect(typeof factory.get).toBe('function');
    expect(typeof factory.preload).toBe('function');
  });
});

describe('Web Vitals Collector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformance.getEntriesByType.mockReturnValue([]);
    mockPerformance.getEntriesByName.mockReturnValue([]);
  });

  it('should be importable', async () => {
    const { webVitalsCollector } = await import('../utils/webVitalsCollector');
    expect(webVitalsCollector).toBeDefined();
  });

  it('should have initialize method', async () => {
    const { webVitalsCollector } = await import('../utils/webVitalsCollector');
    expect(typeof webVitalsCollector.initialize).toBe('function');
  });

  it('should have getAllMetrics method', async () => {
    const { webVitalsCollector } = await import('../utils/webVitalsCollector');
    expect(typeof webVitalsCollector.getAllMetrics).toBe('function');
  });

  it('should have getMetric method', async () => {
    const { webVitalsCollector } = await import('../utils/webVitalsCollector');
    expect(typeof webVitalsCollector.getMetric).toBe('function');
  });

  it('should have addMetric method', async () => {
    const { webVitalsCollector } = await import('../utils/webVitalsCollector');
    expect(typeof webVitalsCollector.addMetric).toBe('function');
  });

  it('should have calculateScore method', async () => {
    const { webVitalsCollector } = await import('../utils/webVitalsCollector');
    expect(typeof webVitalsCollector.calculateScore).toBe('function');
  });

  it('should have reset method', async () => {
    const { webVitalsCollector } = await import('../utils/webVitalsCollector');
    expect(typeof webVitalsCollector.reset).toBe('function');
  });

  it('should have generateReport method', async () => {
    const { webVitalsCollector } = await import('../utils/webVitalsCollector');
    expect(typeof webVitalsCollector.generateReport).toBe('function');
  });

  it('should add custom metrics', async () => {
    const { webVitalsCollector } = await import('../utils/webVitalsCollector');
    
    webVitalsCollector.reset();
    webVitalsCollector.addMetric('CUSTOM_METRIC', 100, 'good');
    
    const metric = webVitalsCollector.getMetric('CUSTOM_METRIC');
    expect(metric).toBeDefined();
    expect(metric?.value).toBe(100);
    expect(metric?.rating).toBe('good');
  });

  it('should generate report with metrics', async () => {
    const { webVitalsCollector } = await import('../utils/webVitalsCollector');
    
    webVitalsCollector.reset();
    webVitalsCollector.addMetric('TEST', 50, 'good');
    
    const report = webVitalsCollector.generateReport();
    expect(report).toBeDefined();
    expect(report.timestamp).toBeGreaterThan(0);
    expect(report.metrics.length).toBeGreaterThan(0);
  });

  it('should calculate performance score', async () => {
    const { webVitalsCollector } = await import('../utils/webVitalsCollector');
    
    const score = webVitalsCollector.calculateScore();
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('Helper Functions', () => {
  it('should export getWebVitals helper', async () => {
    const { getWebVitals } = await import('../utils/webVitalsCollector');
    expect(typeof getWebVitals).toBe('function');
  });

  it('should export getWebVital helper', async () => {
    const { getWebVital } = await import('../utils/webVitalsCollector');
    expect(typeof getWebVital).toBe('function');
  });

  it('should export getPerformanceScore helper', async () => {
    const { getPerformanceScore } = await import('../utils/webVitalsCollector');
    expect(typeof getPerformanceScore).toBe('function');
  });

  it('should export preloadResource helper', async () => {
    const { preloadResource } = await import('../utils/resourcePreloader');
    expect(typeof preloadResource).toBe('function');
  });

  it('should export prefetchResource helper', async () => {
    const { prefetchResource } = await import('../utils/resourcePreloader');
    expect(typeof prefetchResource).toBe('function');
  });

  it('should export preconnectOrigin helper', async () => {
    const { preconnectOrigin } = await import('../utils/resourcePreloader');
    expect(typeof preconnectOrigin).toBe('function');
  });
});
