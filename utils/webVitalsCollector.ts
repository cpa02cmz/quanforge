/**
 * Web Vitals Collector
 * 
 * Collects Core Web Vitals and custom performance metrics.
 * Provides reporting and analytics integration.
 * 
 * Features:
 * - Core Web Vitals (LCP, FID, CLS, TTFB, FCP)
 * - Custom metric collection
 * - Performance scoring
 * - Analytics integration
 * - Real User Monitoring (RUM)
 * 
 * @module utils/webVitalsCollector
 */

import { createScopedLogger } from './logger';

const logger = createScopedLogger('web-vitals');

// ========== TYPES ==========

export interface Metric {
  /** Metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Rating: 'good' | 'needs-improvement' | 'poor' */
  rating: 'good' | 'needs-improvement' | 'poor';
  /** When the metric was recorded */
  timestamp: number;
  /** Unique ID for this metric entry */
  id: string;
  /** Navigation type */
  navigationType?: 'navigate' | 'reload' | 'back-forward' | 'prerender';
  /** Additional delta for CLS-like metrics */
  delta?: number;
  /** Entries from Performance API */
  entries?: PerformanceEntry[];
}

export interface WebVitalsReport {
  /** Page URL */
  url: string;
  /** User agent */
  userAgent: string;
  /** Connection type */
  effectiveType?: string;
  /** Device memory (GB) */
  deviceMemory?: number;
  /** CPU cores */
  cpuCores?: number;
  /** Timestamp */
  timestamp: number;
  /** Collected metrics */
  metrics: Metric[];
  /** Overall score */
  score: number;
}

export interface WebVitalsConfig {
  /** Whether to report metrics */
  reportEnabled?: boolean;
  /** Reporting endpoint */
  reportEndpoint?: string;
  /** Sampling rate (0-1) */
  samplingRate?: number;
  /** Whether to log metrics */
  logMetrics?: boolean;
  /** Callback for each metric */
  onMetric?: (metric: Metric) => void;
  /** Callback when report is ready */
  onReport?: (report: WebVitalsReport) => void;
}

// ========== CONSTANTS ==========

// Core Web Vitals thresholds (based on Google's recommendations)
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // milliseconds
  FID: { good: 100, poor: 300 }, // milliseconds
  CLS: { good: 0.1, poor: 0.25 }, // unitless
  TTFB: { good: 800, poor: 1800 }, // milliseconds
  FCP: { good: 1800, poor: 3000 }, // milliseconds
  INP: { good: 200, poor: 500 }, // milliseconds
};

// ========== HELPER FUNCTIONS ==========

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get rating based on thresholds
 */
function getRating(
  name: string,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Get navigation type
 */
function getNavigationType(): Metric['navigationType'] {
  const entries = performance.getEntriesByType('navigation');
  if (entries.length === 0) return 'navigate';
  
  const navEntry = entries[0] as PerformanceNavigationTiming;
  switch (navEntry.type) {
    case 'navigate':
      return 'navigate';
    case 'reload':
      return 'reload';
    case 'back_forward':
      return 'back-forward';
    default:
      return 'navigate';
  }
}

// ========== MAIN CLASS ==========

class WebVitalsCollector {
  private metrics: Map<string, Metric> = new Map();
  private config: WebVitalsConfig;
  private isInitialized = false;

  constructor(config: WebVitalsConfig = {}) {
    this.config = {
      reportEnabled: true,
      samplingRate: 1,
      logMetrics: true,
      ...config,
    };
  }

  /**
   * Initialize the collector
   */
  initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') return;

    this.isInitialized = true;

    // Collect metrics on page load
    if (document.readyState === 'complete') {
      this.collectMetrics();
    } else {
      window.addEventListener('load', () => this.collectMetrics());
    }

    // Collect on visibility change (for bfcache)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.report();
      }
    });

    // Collect on page unload
    window.addEventListener('pagehide', () => this.report());

    logger.info('Web Vitals collector initialized');
  }

  /**
   * Collect all metrics
   */
  collectMetrics(): void {
    this.collectTTFB();
    this.collectFCP();
    this.collectLCP();
    this.collectFID();
    this.collectCLS();
    this.collectINP();
    this.collectCustomMetrics();
  }

  /**
   * Collect Time to First Byte
   */
  private collectTTFB(): void {
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entries.length === 0) return;

    const navEntry = entries[0];
    if (!navEntry) return;
    
    const value = navEntry.responseStart - navEntry.requestStart;

    this.recordMetric({
      name: 'TTFB',
      value,
      rating: getRating('TTFB', value),
      timestamp: Date.now(),
      id: generateId(),
      navigationType: getNavigationType(),
      entries: [navEntry as PerformanceEntry],
    });
  }

  /**
   * Collect First Contentful Paint
   */
  private collectFCP(): void {
    const entries = performance.getEntriesByName('first-contentful-paint');
    if (entries.length === 0) return;

    const fcpEntry = entries[0];
    if (!fcpEntry) return;
    
    const value = fcpEntry.startTime;

    this.recordMetric({
      name: 'FCP',
      value,
      rating: getRating('FCP', value),
      timestamp: Date.now(),
      id: generateId(),
      navigationType: getNavigationType(),
      entries,
    });
  }

  /**
   * Collect Largest Contentful Paint
   */
  private collectLCP(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as LargestContentfulPaint;
        const value = lastEntry.startTime;

        this.recordMetric({
          name: 'LCP',
          value,
          rating: getRating('LCP', value),
          timestamp: Date.now(),
          id: generateId(),
          navigationType: getNavigationType(),
          entries: [lastEntry],
        });
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // LCP observer not supported
    }
  }

  /**
   * Collect First Input Delay
   */
  private collectFID(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const firstInput = entries[0] as PerformanceEventTiming;
        const value = firstInput.processingStart - firstInput.startTime;

        this.recordMetric({
          name: 'FID',
          value,
          rating: getRating('FID', value),
          timestamp: Date.now(),
          id: generateId(),
          navigationType: getNavigationType(),
          entries: [firstInput],
        });
      });

      observer.observe({ type: 'first-input', buffered: true });
    } catch {
      // FID observer not supported
    }
  }

  /**
   * Collect Cumulative Layout Shift
   */
  private collectCLS(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    let clsValue = 0;
    let clsEntries: LayoutShift[] = [];

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as LayoutShift[];
        
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            clsEntries.push(entry);
          }
        });

        this.recordMetric({
          name: 'CLS',
          value: clsValue,
          rating: getRating('CLS', clsValue),
          timestamp: Date.now(),
          id: generateId(),
          navigationType: getNavigationType(),
          delta: clsValue,
          entries: clsEntries,
        });
      });

      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // CLS observer not supported
    }
  }

  /**
   * Collect Interaction to Next Paint (INP)
   */
  private collectINP(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    let maxINP = 0;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceEventTiming[];
        
        entries.forEach((entry) => {
          if (entry.interactionId) {
            const inp = entry.duration;
            if (inp > maxINP) {
              maxINP = inp;
            }
          }
        });

        if (maxINP > 0) {
          this.recordMetric({
            name: 'INP',
            value: maxINP,
            rating: getRating('INP', maxINP),
            timestamp: Date.now(),
            id: generateId(),
            navigationType: getNavigationType(),
            entries: [],
          });
        }
      });

      observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });
    } catch {
      // INP observer not supported
    }
  }

  /**
   * Collect custom metrics
   */
  private collectCustomMetrics(): void {
    // JavaScript heap size
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    if (memory) {
      this.recordMetric({
        name: 'JS_HEAP_SIZE',
        value: Math.round(memory.usedJSHeapSize / (1024 * 1024)), // MB
        rating: 'good',
        timestamp: Date.now(),
        id: generateId(),
      });
    }

    // DOM size
    const domNodes = document.getElementsByTagName('*').length;
    this.recordMetric({
      name: 'DOM_SIZE',
      value: domNodes,
      rating: domNodes < 1500 ? 'good' : domNodes < 3000 ? 'needs-improvement' : 'poor',
      timestamp: Date.now(),
      id: generateId(),
    });

    // Resource count
    const resources = performance.getEntriesByType('resource');
    this.recordMetric({
      name: 'RESOURCE_COUNT',
      value: resources.length,
      rating: resources.length < 50 ? 'good' : resources.length < 100 ? 'needs-improvement' : 'poor',
      timestamp: Date.now(),
      id: generateId(),
    });
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: Metric): void {
    // Check sampling
    if (Math.random() > this.config.samplingRate!) return;

    this.metrics.set(metric.name, metric);

    // Log if enabled
    if (this.config.logMetrics) {
      logger.debug(
        `Metric: ${metric.name} = ${metric.value.toFixed(2)} (${metric.rating})`
      );
    }

    // Call callback
    this.config.onMetric?.(metric);
  }

  /**
   * Add a custom metric
   */
  addMetric(name: string, value: number, rating?: 'good' | 'needs-improvement' | 'poor'): void {
    this.recordMetric({
      name,
      value,
      rating: rating || getRating(name, value),
      timestamp: Date.now(),
      id: generateId(),
      navigationType: getNavigationType(),
    });
  }

  /**
   * Get a specific metric
   */
  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Calculate overall score
   */
  calculateScore(): number {
    const coreVitals = ['LCP', 'FID', 'CLS'];
    let totalScore = 0;
    let count = 0;

    coreVitals.forEach((name) => {
      const metric = this.metrics.get(name);
      if (metric) {
        let score: number;
        switch (metric.rating) {
          case 'good':
            score = 100;
            break;
          case 'needs-improvement':
            score = 50;
            break;
          case 'poor':
            score = 0;
            break;
        }
        totalScore += score;
        count++;
      }
    });

    return count > 0 ? Math.round(totalScore / count) : 100;
  }

  /**
   * Generate a report
   */
  generateReport(): WebVitalsReport {
    const nav = navigator as Navigator & {
      connection?: { effectiveType?: string };
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };

    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      effectiveType: nav.connection?.effectiveType,
      deviceMemory: nav.deviceMemory,
      cpuCores: nav.hardwareConcurrency,
      timestamp: Date.now(),
      metrics: this.getAllMetrics(),
      score: this.calculateScore(),
    };
  }

  /**
   * Report metrics
   */
  async report(): Promise<void> {
    if (!this.config.reportEnabled) return;

    const report = this.generateReport();

    // Call callback
    this.config.onReport?.(report);

    // Send to endpoint if configured
    if (this.config.reportEndpoint) {
      try {
        // Use sendBeacon for reliability
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            this.config.reportEndpoint,
            JSON.stringify(report)
          );
        } else {
          await fetch(this.config.reportEndpoint, {
            method: 'POST',
            body: JSON.stringify(report),
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
          });
        }
      } catch (error) {
        logger.error('Failed to report metrics:', error);
      }
    }
  }

  /**
   * Reset the collector
   */
  reset(): void {
    this.metrics.clear();
    logger.info('Web Vitals collector reset');
  }

  /**
   * Destroy the collector
   */
  destroy(): void {
    this.metrics.clear();
    this.isInitialized = false;
    logger.info('Web Vitals collector destroyed');
  }
}

// ========== SINGLETON EXPORT ==========

export const webVitalsCollector = new WebVitalsCollector();

// ========== UTILITY FUNCTIONS ==========

/**
 * Quick function to get current web vitals
 */
export function getWebVitals(): Metric[] {
  return webVitalsCollector.getAllMetrics();
}

/**
 * Quick function to get a specific metric
 */
export function getWebVital(name: string): Metric | undefined {
  return webVitalsCollector.getMetric(name);
}

/**
 * Quick function to get performance score
 */
export function getPerformanceScore(): number {
  return webVitalsCollector.calculateScore();
}

export default webVitalsCollector;
