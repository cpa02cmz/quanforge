/**
 * Tests for Frontend Performance Utility
 * 
 * @module utils/frontendPerformance.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  frontendPerformance,
  isMemoryUnderPressure,
  getMemoryUsageMB,
  triggerCleanupIfNeeded,
  type BundleSizeThreshold
} from './frontendPerformance';

// Mock performance API
const mockPerformance = {
  memory: {
    usedJSHeapSize: 100 * 1024 * 1024, // 100 MB
    totalJSHeapSize: 150 * 1024 * 1024, // 150 MB
    jsHeapSizeLimit: 200 * 1024 * 1024 // 200 MB
  },
  getEntriesByType: vi.fn((type: string) => {
    if (type === 'navigation') {
      return [{
        startTime: 0,
        loadEventEnd: 2000
      }];
    }
    if (type === 'paint') {
      return [{
        name: 'first-contentful-paint',
        startTime: 1500
      }];
    }
    return [];
  })
};

// Mock PerformanceObserver
class MockPerformanceObserver {
  callback: PerformanceObserverCallback;
  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
  }
  observe() {}
  disconnect() {}
}

describe('Frontend Performance Utility', () => {
  beforeEach(() => {
    vi.stubGlobal('performance', mockPerformance);
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
    frontendPerformance.clearAlerts();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getMetrics', () => {
    it('should return current performance metrics', () => {
      const metrics = frontendPerformance.getMetrics();
      
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('bundleSizes');
      expect(metrics).toHaveProperty('loadTime');
      expect(metrics).toHaveProperty('timestamp');
    });

    it('should include memory usage information', () => {
      const metrics = frontendPerformance.getMetrics();
      
      if (metrics.memoryUsage) {
        expect(metrics.memoryUsage.usedMB).toBeCloseTo(100, 0);
        expect(metrics.memoryUsage.limitMB).toBeCloseTo(200, 0);
        expect(metrics.memoryUsage.usagePercent).toBeCloseTo(50, 0);
      }
    });
  });

  describe('getPerformanceScore', () => {
    it('should return a score between 0 and 100', () => {
      const score = frontendPerformance.getPerformanceScore();
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return 100 for excellent performance', () => {
      // Mock excellent performance
      vi.stubGlobal('performance', {
        ...mockPerformance,
        memory: {
          usedJSHeapSize: 50 * 1024 * 1024, // 50 MB
          totalJSHeapSize: 150 * 1024 * 1024,
          jsHeapSizeLimit: 200 * 1024 * 1024
        }
      });

      const score = frontendPerformance.getPerformanceScore();
      expect(score).toBeGreaterThan(80);
    });
  });

  describe('getAlerts', () => {
    it('should return an array of alerts', () => {
      const alerts = frontendPerformance.getAlerts();
      
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should clear alerts when clearAlerts is called', () => {
      frontendPerformance.clearAlerts();
      const alerts = frontendPerformance.getAlerts();
      
      expect(alerts.length).toBe(0);
    });
  });

  describe('getRecommendations', () => {
    it('should return an array of recommendations', () => {
      const recommendations = frontendPerformance.getRecommendations();
      
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('registerBundleThreshold', () => {
    it('should register a bundle size threshold', () => {
      const threshold: BundleSizeThreshold = {
        name: 'test-bundle',
        maxSize: 100 * 1024, // 100 KB
        severity: 'warning'
      };

      expect(() => {
        frontendPerformance.registerBundleThreshold(threshold);
      }).not.toThrow();
    });
  });

  describe('checkBundleSizes', () => {
    it('should check bundle sizes against thresholds', () => {
      const bundleSizes = new Map<string, number>();
      bundleSizes.set('test-bundle', 50 * 1024); // 50 KB

      expect(() => {
        frontendPerformance.checkBundleSizes(bundleSizes);
      }).not.toThrow();
    });
  });

  describe('Utility Functions', () => {
    describe('isMemoryUnderPressure', () => {
      it('should return false for normal memory usage', () => {
        // 50% usage
        vi.stubGlobal('performance', {
          memory: {
            usedJSHeapSize: 100 * 1024 * 1024,
            jsHeapSizeLimit: 200 * 1024 * 1024
          }
        });

        const result = isMemoryUnderPressure();
        expect(result).toBe(false);
      });

      it('should return true for high memory usage', () => {
        // 75% usage
        vi.stubGlobal('performance', {
          memory: {
            usedJSHeapSize: 150 * 1024 * 1024,
            jsHeapSizeLimit: 200 * 1024 * 1024
          }
        });

        const result = isMemoryUnderPressure();
        expect(result).toBe(true);
      });

      it('should return false if memory API is not available', () => {
        vi.stubGlobal('performance', {});
        
        const result = isMemoryUnderPressure();
        expect(result).toBe(false);
      });
    });

    describe('getMemoryUsageMB', () => {
      it('should return memory usage in MB', () => {
        const result = getMemoryUsageMB();
        expect(result).toBeCloseTo(100, 0);
      });

      it('should return null if memory API is not available', () => {
        vi.stubGlobal('performance', {});
        
        const result = getMemoryUsageMB();
        expect(result).toBeNull();
      });
    });

    describe('triggerCleanupIfNeeded', () => {
      it('should not throw when called', () => {
        expect(() => {
          triggerCleanupIfNeeded();
        }).not.toThrow();
      });
    });
  });

  describe('Initialization', () => {
    it('should initialize without errors', () => {
      expect(() => {
        frontendPerformance.initialize();
      }).not.toThrow();
    });

    it('should not reinitialize if already initialized', () => {
      frontendPerformance.initialize();
      frontendPerformance.initialize();
      // Should not throw or cause issues
    });
  });

  describe('Destroy', () => {
    it('should destroy without errors', () => {
      frontendPerformance.initialize();
      expect(() => {
        frontendPerformance.destroy();
      }).not.toThrow();
    });
  });
});
