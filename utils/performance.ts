import React from 'react';

// Performance monitoring utilities for production optimization

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

interface PageLoadMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private isSupported = typeof window !== 'undefined' && 'performance' in window;

  constructor() {
    if (this.isSupported && import.meta.env.PROD) {
      this.initWebVitals();
      this.observePageLoad();
    }
  }

  private initWebVitals() {
    // Observe Core Web Vitals
    if ('PerformanceObserver' in window) {
      try {
        // First Contentful Paint
        const observerFCP = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              this.recordMetric('fcp', entry.startTime);
            }
          }
        });
        observerFCP.observe({ entryTypes: ['paint'] });

        // Largest Contentful Paint
        const observerLCP = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric('lcp', lastEntry.startTime);
        });
        observerLCP.observe({ entryTypes: ['largest-contentful-paint'] });

        // Cumulative Layout Shift
        let clsValue = 0;
        const observerCLS = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          this.recordMetric('cls', clsValue);
        });
        observerCLS.observe({ entryTypes: ['layout-shift'] });

        // First Input Delay
        const observerFID = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('fid', (entry as any).processingStart - entry.startTime);
          }
        });
        observerFID.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        console.warn('Performance monitoring not fully supported:', e);
      }
    }
  }

  private observePageLoad() {
    if (this.isSupported) {
      window.addEventListener('load', () => {
        // Time to First Byte
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.recordMetric('ttfb', navigation.responseStart - navigation.requestStart);
          
          // Page load time
          this.recordMetric('pageLoad', navigation.loadEventEnd - navigation.fetchStart);
        }
      });
    }
  }

  recordMetric(name: string, value: number) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);
    
    // Keep only last 50 metrics
    if (this.metrics.length > 50) {
      this.metrics = this.metrics.slice(-50);
    }

    // Log in production for monitoring
    if (import.meta.env.PROD) {
      console.log(`Performance Metric [${name}]:`, value);
    }

    // Store critical metrics in localStorage
    if (['fcp', 'lcp', 'cls', 'fid', 'ttfb'].includes(name)) {
      try {
        const key = `perf_${name}`;
        localStorage.setItem(key, value.toString());
      } catch (e) {
        // Ignore storage errors
      }
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getWebVitals(): Partial<PageLoadMetrics> {
    const vitals: Partial<PageLoadMetrics> = {};
    
    this.metrics.forEach(metric => {
      switch (metric.name) {
        case 'fcp':
          vitals.fcp = metric.value;
          break;
        case 'lcp':
          vitals.lcp = metric.value;
          break;
        case 'fid':
          vitals.fid = metric.value;
          break;
        case 'cls':
          vitals.cls = metric.value;
          break;
        case 'ttfb':
          vitals.ttfb = metric.value;
          break;
      }
    });

    return vitals;
  }

  // Custom timing for user interactions
  measureInteraction(name: string, fn: () => void | Promise<void>) {
    const start = performance.now();
    
    const result = fn();
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start;
        this.recordMetric(`interaction_${name}`, duration);
      });
    } else {
      const duration = performance.now() - start;
      this.recordMetric(`interaction_${name}`, duration);
    }
  }

  // Memory usage monitoring (if available)
  getMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      };
    }
    return null;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility function for measuring component render time
export const measureRender = (componentName: string) => {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      performanceMonitor.recordMetric(`render_${componentName}`, duration);
    }
  };
};

// Hook for React components
export const usePerformanceMonitor = (componentName: string) => {
  const startTime = React.useRef<number>(performance.now());
  
  React.useEffect(() => {
    return () => {
      if (startTime.current) {
        const duration = performance.now() - startTime.current;
        performanceMonitor.recordMetric(`component_${componentName}`, duration);
      }
    };
  }, [componentName]);
};