import React from 'react';
import { logger } from './logger';

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
  private observers: PerformanceObserver[] = [];
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
        this.observers.push(observerFCP);

        // Largest Contentful Paint
        const observerLCP = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            this.recordMetric('lcp', lastEntry.startTime);
          }
        });
        observerLCP.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(observerLCP);

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
        this.observers.push(observerCLS);

        // First Input Delay
        const observerFID = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('fid', (entry as any).processingStart - entry.startTime);
          }
        });
        observerFID.observe({ entryTypes: ['first-input'] });
        this.observers.push(observerFID);
      } catch (e) {
        if (import.meta.env.DEV) {
          logger.warn('Performance monitoring not fully supported:', e);
        }
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
      logger.log(`Performance Metric [${name}]:`, value);
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

private recordInteraction(name: string, duration: number) {
     this.recordMetric(`interaction_${name}`, duration);
   }

   // Custom timing for user interactions
   measureInteraction(name: string, fn: () => void | Promise<void>): Promise<void> | void {
     const start = performance.now();
     
     const result = fn();
     
     if (result instanceof Promise) {
       return result.finally(() => {
         const duration = performance.now() - start;
         this.recordInteraction(name, duration);
       });
     } else {
       const duration = performance.now() - start;
       this.recordInteraction(name, duration);
     }
   }

     // Enhanced API call timing with error tracking
     async measureApiCall<T>(name: string, fn: () => Promise<T>): Promise<T> {
       const start = performance.now();
       let success = true;
       let errorType: string | undefined;
       
       try {
         const result = await fn();
         return result;
       } catch (error) {
         success = false;
         errorType = error instanceof Error ? error.constructor.name : typeof error;
         throw error;
       } finally {
         const duration = performance.now() - start;
         this.recordMetric(`api_${name}_duration`, duration);
         this.recordMetric(`api_${name}_success`, success ? 1 : 0);
         if (!success && errorType) {
           this.recordMetric(`api_${name}_error_${errorType}`, 1);
         }
         
// Log slow API calls for optimization
          if (duration > 1000) { // More than 1 second
            logger.warn(`Slow API call detected: ${name} took ${duration.toFixed(2)}ms`);
          }
       }
     }
    
     // Performance monitoring for database operations
     async measureDbOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
       const start = performance.now();
       let success = true;
       let errorType: string | undefined;
       let resultSize = 0;
       
       try {
         const result = await fn();
         // Estimate result size if it's an array or object
         if (Array.isArray(result)) {
           resultSize = result.length;
         } else if (result && typeof result === 'object') {
           resultSize = JSON.stringify(result).length;
         } else {
           resultSize = typeof result === 'string' ? result.length : 1;
         }
         return result;
       } catch (error) {
         success = false;
         errorType = error instanceof Error ? error.constructor.name : typeof error;
         throw error;
       } finally {
         const duration = performance.now() - start;
         this.recordMetric(`db_${name}_duration`, duration);
         this.recordMetric(`db_${name}_success`, success ? 1 : 0);
         this.recordMetric(`db_${name}_result_size`, resultSize);
         if (!success && errorType) {
           this.recordMetric(`db_${name}_error_${errorType}`, 1);
         }
         
// Log slow database operations
          if (duration > 500) { // More than 0.5 seconds
            logger.warn(`Slow DB operation detected: ${name} took ${duration.toFixed(2)}ms, result size: ${resultSize}`);
          }
       }
     }

   // Memory usage snapshot
   captureMemorySnapshot() {
     if ('memory' in performance) {
       const memory = (performance as any).memory;
       if (memory) {
         this.recordMetric('memory_used', memory.usedJSHeapSize);
         this.recordMetric('memory_total', memory.totalJSHeapSize);
         this.recordMetric('memory_limit', memory.jsHeapSizeLimit);
       }
     }
   }

   // Track specific performance marks
   startMark(name: string) {
     if (this.isSupported) {
       performance.mark(`start_${name}`);
     }
   }

   endMark(name: string) {
     if (this.isSupported) {
       performance.mark(`end_${name}`);
       performance.measure(name, `start_${name}`, `end_${name}`);
       
       const measure = performance.getEntriesByName(name)[0];
       if (measure) {
         this.recordMetric(`measure_${name}`, measure.duration);
       }
       
       // Clean up marks to prevent memory bloat
       performance.clearMarks(`start_${name}`);
       performance.clearMarks(`end_${name}`);
       performance.clearMeasures(name);
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
          utilization: memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100,
        };
      }
      return null;
    }
    
// Track memory usage over time with proper cleanup
     async monitorMemoryUsage(intervalMs: number = 30000): Promise<() => void> { // Default 30 seconds
 if (!('memory' in performance)) {
          if (import.meta.env.DEV) {
            logger.warn('Memory monitoring not supported in this browser');
          }
          return () => {}; // Return no-op cleanup function
        }
      
      const memoryInterval = setInterval(() => {
        const memory = this.getMemoryUsage();
        if (memory) {
          this.recordMetric('memory_used_bytes', memory.used);
          this.recordMetric('memory_utilization_percent', memory.utilization);
          
// Alert if memory usage is high
            if (memory.utilization > 80) {
              if (import.meta.env.DEV) {
                logger.warn(`High memory usage detected: ${memory.utilization.toFixed(2)}%`);
              }
              // Record high memory usage event
              this.recordMetric('high_memory_event', 1);
            }
            
            // Auto-cleanup if memory is critically high
            if (memory.utilization > 90) {
              this.performEmergencyCleanup();
            }
        }
      }, intervalMs);
      
      // Return cleanup function
      return () => {
        clearInterval(memoryInterval);
      };
    }
    
    // Emergency cleanup for critical memory situations
    private performEmergencyCleanup(): void {
      try {
        // Clear performance metrics history
        this.metrics.length = 0;
        
        // Disconnect all performance observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.length = 0;
        
        // Force garbage collection if available
        if ('gc' in globalThis) {
          (globalThis as any).gc();
        }
        
        logger.warn('Emergency memory cleanup performed');
        this.recordMetric('emergency_cleanup', 1);
      } catch (error) {
        logger.warn('Failed to perform emergency cleanup:', error);
      }
    }
    
    // Enhanced metrics for React component performance
    measureComponentRender(componentName: string, renderFn: () => any) {
      const start = performance.now();
      const result = renderFn();
      const duration = performance.now() - start;
      
// Only record if render was slow (indicating potential performance issue)
       if (duration > 10) { // More than 10ms is considered slow for a render
         this.recordMetric(`component_render_${componentName}`, duration);
         if (duration > 100) { // Very slow render
           logger.warn(`Slow component render detected: ${componentName} took ${duration.toFixed(2)}ms`);
         }
       }
      
      return result;
    }
    
 // Track bundle size and loading performance
     async trackBundlePerformance(): Promise<void> {
       if ('performance' in window) {
         window.addEventListener('load', () => {
           // Track resource loading times
           const resources = performance.getEntriesByType('resource');
           resources.forEach((resource: PerformanceEntry) => {
             if (resource.name.includes('assets/js/')) {
               this.recordMetric('bundle_load_time', resource.duration);
             }
           });
           
           // Record overall page load performance
           const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
           if (navigation) {
             this.recordMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart);
             this.recordMetric('window_load_time', navigation.loadEventEnd - navigation.fetchStart);
             this.recordMetric('first_byte_time', navigation.responseStart - navigation.requestStart);
           }
         });
       }
     }
     
     // Performance feedback for user experience
     getPerformanceFeedback(): string {
       const webVitals = this.getWebVitals();
       let feedback = '';
       
       if (webVitals.lcp && webVitals.lcp > 2500) {
         feedback += 'Slow loading detected. Consider optimizing images and assets. ';
       } else if (webVitals.lcp && webVitals.lcp < 1500) {
         feedback += 'Great loading performance! ';
       }
       
       if (webVitals.fid && webVitals.fid > 100) {
         feedback += 'Slow interactions detected. Consider optimizing code. ';
       }
       
       if (webVitals.cls && webVitals.cls > 0.1) {
         feedback += 'Layout shifts detected. Consider reserving space for images. ';
       }
       
       return feedback || 'Performance looks good!';
     }
     
     // Performance health check
     async performHealthCheck(): Promise<{
       score: number;
       issues: string[];
       suggestions: string[];
     }> {
       const webVitals = this.getWebVitals();
       const memory = this.getMemoryUsage();
       
       let score = 100;
       const issues: string[] = [];
       const suggestions: string[] = [];
       
       // Check LCP
       if (webVitals.lcp && webVitals.lcp > 2500) {
         score -= 25;
         issues.push(`LCP is ${webVitals.lcp}ms (should be < 2500ms)`);
         suggestions.push('Optimize critical rendering path and reduce server response time');
       }
       
       // Check FID
       if (webVitals.fid && webVitals.fid > 100) {
         score -= 20;
         issues.push(`FID is ${webVitals.fid}ms (should be < 100ms)`);
         suggestions.push('Reduce JavaScript execution time and break long tasks');
       }
       
       // Check CLS
       if (webVitals.cls && webVitals.cls > 0.1) {
         score -= 15;
         issues.push(`CLS is ${webVitals.cls} (should be < 0.1)`);
         suggestions.push('Reserve space for images and avoid dynamic content injection');
       }
       
       // Check memory usage
       if (memory && memory.utilization > 80) {
         score -= 10;
         issues.push(`Memory usage is ${memory.utilization.toFixed(1)}% (high)`);
         suggestions.push('Consider implementing memory cleanup and optimize data structures');
       }
       
       score = Math.max(0, score);
       
       return {
         score,
         issues,
         suggestions
       };
     }
   
// Stop memory monitoring
    stopMemoryMonitoring(): void {
      if ((globalThis as any).__memoryMonitoringInterval) {
        clearInterval((globalThis as any).__memoryMonitoringInterval);
        delete (globalThis as any).__memoryMonitoringInterval;
      }
    }
    
    // Cleanup all resources and prevent memory leaks
    cleanup(): void {
      this.stopMemoryMonitoring();
      this.metrics = [];
      this.observers.forEach(observer => {
        try {
          observer.disconnect();
        } catch (e) {
          // Ignore errors during cleanup
        }
      });
      this.observers = [];
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