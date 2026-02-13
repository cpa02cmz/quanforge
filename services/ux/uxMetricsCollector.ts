/**
 * UX Metrics Collection Module
 * Handles all performance observation and data collection
 */

import { UXMetrics } from './uxTypes';
import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('UXMetricsCollector');

// Browser API type extensions for performance entries
interface LayoutShiftEntry extends PerformanceEntry {
  hadRecentInput: boolean;
  value: number;
}

interface FirstInputEntry extends PerformanceEntry {
  processingStart: number;
}

interface LargestContentfulPaintEntry extends PerformanceEntry {
  startTime: number;
}

export class UXMetricsCollector {
  private observers: PerformanceObserver[] = [];
  
  constructor(private metrics: UXMetrics) {}

  /**
   * Start monitoring all UX metrics
   */
  startMonitoring(): void {
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeNavigation();
    this.observeResources();
    this.observeLongTasks();
  }

  /**
   * Stop all performance observers
   */
  stopMonitoring(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  /**
   * Observe Largest Contentful Paint (LCP)
   */
  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as LargestContentfulPaintEntry;
        this.metrics.lcp = lastEntry.startTime;
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('LCP observation not supported:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Observe First Input Delay (FID)
   */
  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'first-input') {
            const fidEntry = entry as FirstInputEntry;
            this.metrics.fid = fidEntry.processingStart - fidEntry.startTime;
            break;
          }
        }
      });
      
      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('FID observation not supported:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Observe Cumulative Layout Shift (CLS)
   */
  private observeCLS(): void {
    try {
      let clsValue = 0;
      
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          const layoutShift = entry as LayoutShiftEntry;
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
          }
        }
        this.metrics.cls = clsValue;
      });
      
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('CLS observation not supported:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Observe Navigation Timing
   */
  private observeNavigation(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
            this.metrics.fcp = navEntry.loadEventStart - navEntry.fetchStart;
            break;
          }
        }
      });
      
      observer.observe({ entryTypes: ['navigation'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('Navigation timing observation not supported:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Observe Resource Timing
   */
  private observeResources(): void {
    try {
      const observer = new PerformanceObserver(() => {
        // Note: API endpoint monitoring removed - this is a client-side SPA
        // with service-layer architecture (no REST API endpoints)
        // Service call timing is tracked via performance.mark/measure instead
      });
      
      observer.observe({ entryTypes: ['resource'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('Resource timing observation not supported:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Observe Long Tasks
   */
  private observeLongTasks(): void {
    try {
      let totalBlockingTime = 0;
      
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'longtask') {
            totalBlockingTime += entry.duration - 50;
          }
        }
        this.metrics.tbt = totalBlockingTime;
      });
      
      observer.observe({ entryTypes: ['longtask'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('Long task observation not supported:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Measure render time
   */
  measureRenderTime(): void {
    const startTime = performance.now();
    
    // Force a reflow to measure render time
    document.body.offsetHeight;
    
    this.metrics.renderTime = performance.now() - startTime;
  }

  /**
   * Update user interaction metrics
   */
  updateInteractionMetrics({
    clickDelay,
    scrollPerformance,
    inputLag
  }: {
    clickDelay?: number;
    scrollPerformance?: number;
    inputLag?: number;
  }): void {
    if (clickDelay !== undefined) this.metrics.clickDelay = clickDelay;
    if (scrollPerformance !== undefined) this.metrics.scrollPerformance = scrollPerformance;
    if (inputLag !== undefined) this.metrics.inputLag = inputLag;
  }

  /**
   * Update error metrics
   */
  updateErrorMetrics({
    errorRate,
    crashRate
  }: {
    errorRate?: number;
    crashRate?: number;
  }): void {
    if (errorRate !== undefined) this.metrics.errorRate = errorRate;
    if (crashRate !== undefined) this.metrics.crashRate = crashRate;
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): UXMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    const initialMetrics: UXMetrics = {
      lcp: 0,
      fid: 0,
      cls: 0,
      ttfb: 0,
      fcp: 0,
      tti: 0,
      si: 0,
      tbt: 0,
      apiResponseTime: 0,
      renderTime: 0,
      errorRate: 0,
      crashRate: 0,
      clickDelay: 0,
      scrollPerformance: 0,
      inputLag: 0,
    };
    
    Object.assign(this.metrics, initialMetrics);
  }
}