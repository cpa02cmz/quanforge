/**
 * Performance Metrics Collection Service
 * Collects, aggregates, and reports performance metrics
 * 
 * Features:
 * - Web Vitals collection (LCP, FID, CLS, TTFB, INP)
 * - Custom metrics tracking
 * - Performance budget monitoring
 * - Automatic batching and reporting
 * - Memory usage tracking
 * - Component render timing
 * 
 * @module services/performance/metricsCollector
 */

/**
 * Performance metric types
 */
export type MetricType = 
  | 'lcp'   // Largest Contentful Paint
  | 'fid'   // First Input Delay
  | 'cls'   // Cumulative Layout Shift
  | 'ttfb'  // Time to First Byte
  | 'inp'   // Interaction to Next Paint
  | 'fcp'   // First Contentful Paint
  | 'memory' // Memory usage
  | 'render' // Component render time
  | 'api'    // API call timing
  | 'custom'; // Custom metrics

/**
 * Performance metric value
 */
export interface PerformanceMetric {
  name: string;
  type: MetricType;
  value: number;
  unit: 'ms' | 'bytes' | 'percent' | 'count' | 'score';
  timestamp: number;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * Performance budget definition
 */
export interface PerformanceBudget {
  metric: string;
  warningThreshold: number;
  errorThreshold: number;
  unit: 'ms' | 'bytes' | 'percent' | 'count' | 'score';
}

/**
 * Metrics collector configuration
 */
interface MetricsCollectorConfig {
  /** Enable automatic Web Vitals collection */
  collectWebVitals?: boolean;
  /** Enable memory usage tracking */
  trackMemory?: boolean;
  /** Sampling rate (0-1) for metrics */
  sampleRate?: number;
  /** Batch size before reporting */
  batchSize?: number;
  /** Flush interval in ms */
  flushInterval?: number;
  /** Custom reporting endpoint */
  reportEndpoint?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Performance budgets */
  budgets?: PerformanceBudget[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<MetricsCollectorConfig> = {
  collectWebVitals: true,
  trackMemory: true,
  sampleRate: 1.0,
  batchSize: 10,
  flushInterval: 30000,
  reportEndpoint: '/api/metrics',
  debug: false,
  budgets: [
    { metric: 'lcp', warningThreshold: 2500, errorThreshold: 4000, unit: 'ms' },
    { metric: 'fid', warningThreshold: 100, errorThreshold: 300, unit: 'ms' },
    { metric: 'cls', warningThreshold: 0.1, errorThreshold: 0.25, unit: 'score' },
    { metric: 'ttfb', warningThreshold: 600, errorThreshold: 1000, unit: 'ms' },
    { metric: 'inp', warningThreshold: 200, errorThreshold: 500, unit: 'ms' },
    { metric: 'fcp', warningThreshold: 1800, errorThreshold: 3000, unit: 'ms' },
  ],
};

/**
 * Performance Metrics Collector
 * Singleton class for collecting and reporting performance metrics
 */
class PerformanceMetricsCollector {
  private static instance: PerformanceMetricsCollector | null = null;
  
  private config: Required<MetricsCollectorConfig>;
  private metrics: PerformanceMetric[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private observers: PerformanceObserver[] = [];
  private isInitialized = false;

  private constructor(config: MetricsCollectorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: MetricsCollectorConfig): PerformanceMetricsCollector {
    if (!PerformanceMetricsCollector.instance) {
      PerformanceMetricsCollector.instance = new PerformanceMetricsCollector(config);
    }
    return PerformanceMetricsCollector.instance;
  }

  /**
   * Initialize the collector
   */
  initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    this.isInitialized = true;

    if (this.config.collectWebVitals) {
      this.setupWebVitalsObservers();
    }

    if (this.config.trackMemory) {
      this.setupMemoryTracking();
    }

    this.startFlushTimer();
    
    this.debugLog('Metrics collector initialized');
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.metrics.push(fullMetric);
    this.checkBudget(fullMetric);

    if (this.metrics.length >= this.config.batchSize) {
      this.flush();
    }

    this.debugLog('Recorded metric:', fullMetric);
  }

  /**
   * Start timing an operation
   */
  startTiming(name: string): () => number {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric({
        name,
        type: 'custom',
        value: duration,
        unit: 'ms',
      });
      return duration;
    };
  }

  /**
   * Record component render time
   */
  recordRenderTime(componentName: string, duration: number): void {
    this.recordMetric({
      name: `render_${componentName}`,
      type: 'render',
      value: duration,
      unit: 'ms',
      tags: { component: componentName },
    });
  }

  /**
   * Record API call timing
   */
  recordAPICall(endpoint: string, duration: number, success: boolean): void {
    this.recordMetric({
      name: `api_${endpoint}`,
      type: 'api',
      value: duration,
      unit: 'ms',
      tags: { 
        endpoint, 
        success: success.toString(),
      },
    });
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): { usedMB: number; totalMB: number; percentUsed: number } | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const perfWithMemory = performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        jsHeapSizeLimit: number;
        totalJSHeapSize: number;
      };
    };

    if (!perfWithMemory.memory) {
      return null;
    }

    const { usedJSHeapSize, jsHeapSizeLimit } = perfWithMemory.memory;
    
    return {
      usedMB: usedJSHeapSize / (1024 * 1024),
      totalMB: jsHeapSizeLimit / (1024 * 1024),
      percentUsed: (usedJSHeapSize / jsHeapSizeLimit) * 100,
    };
  }

  /**
   * Flush all pending metrics
   */
  async flush(): Promise<PerformanceMetric[]> {
    if (this.metrics.length === 0) {
      return [];
    }

    const metricsToReport = [...this.metrics];
    this.metrics = [];

    this.debugLog(`Flushing ${metricsToReport.length} metrics`);

    // Report metrics (in production, send to analytics service)
    if (this.config.reportEndpoint && typeof navigator !== 'undefined') {
      try {
        // Use sendBeacon for reliable reporting
        const data = JSON.stringify({ metrics: metricsToReport });
        navigator.sendBeacon?.(this.config.reportEndpoint, data);
      } catch (error) {
        this.debugLog('Failed to report metrics:', error);
      }
    }

    return metricsToReport;
  }

  /**
   * Get collected metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Destroy the collector
   */
  destroy(): void {
    this.flush();
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    
    this.isInitialized = false;
    
    this.debugLog('Metrics collector destroyed');
  }

  /**
   * Setup Web Vitals observers
   */
  private setupWebVitalsObservers(): void {
    // LCP Observer
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        if (lastEntry) {
          this.recordMetric({
            name: 'lcp',
            type: 'lcp',
            value: lastEntry.startTime,
            unit: 'ms',
          });
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.push(lcpObserver);
    } catch {
      // Observer not supported
    }

    // FID Observer
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if ('processingStart' in entry && 'startTime' in entry) {
            this.recordMetric({
              name: 'fid',
              type: 'fid',
              value: (entry.processingStart as number) - (entry.startTime as number),
              unit: 'ms',
            });
          }
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
      this.observers.push(fidObserver);
    } catch {
      // Observer not supported
    }

    // CLS Observer
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if ('value' in entry && !(entry as { hadRecentInput?: boolean }).hadRecentInput) {
            clsValue += (entry.value as number);
          }
        });
        
        this.recordMetric({
          name: 'cls',
          type: 'cls',
          value: clsValue,
          unit: 'score',
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(clsObserver);
    } catch {
      // Observer not supported
    }

    // TTFB from Navigation Timing
    try {
      const navigationEntries = performance.getEntriesByType('navigation');
      const navigationEntry = navigationEntries[0] as PerformanceNavigationTiming | undefined;
      
      if (navigationEntry) {
        this.recordMetric({
          name: 'ttfb',
          type: 'ttfb',
          value: navigationEntry.responseStart - navigationEntry.requestStart,
          unit: 'ms',
        });

        // FCP
        this.recordMetric({
          name: 'fcp',
          type: 'fcp',
          value: navigationEntry.domContentLoadedEventEnd - navigationEntry.fetchStart,
          unit: 'ms',
        });
      }
    } catch {
      // Navigation timing not supported
    }
  }

  /**
   * Setup periodic memory tracking
   */
  private setupMemoryTracking(): void {
    const trackMemory = () => {
      const memory = this.getMemoryUsage();
      
      if (memory) {
        this.recordMetric({
          name: 'memory_used',
          type: 'memory',
          value: memory.usedMB,
          unit: 'bytes',
          tags: { type: 'used' },
        });
        
        this.recordMetric({
          name: 'memory_percent',
          type: 'memory',
          value: memory.percentUsed,
          unit: 'percent',
          tags: { type: 'percent' },
        });
      }
    };

    // Track memory every 30 seconds
    setInterval(trackMemory, 30000);
    
    // Initial tracking
    trackMemory();
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Check metric against budget
   */
  private checkBudget(metric: PerformanceMetric): void {
    const budget = this.config.budgets.find(b => b.metric === metric.name);
    
    if (!budget) {
      return;
    }

    if (metric.value > budget.errorThreshold) {
      this.debugLog(`BUDGET ERROR: ${metric.name} exceeded error threshold (${metric.value} > ${budget.errorThreshold})`);
    } else if (metric.value > budget.warningThreshold) {
      this.debugLog(`BUDGET WARNING: ${metric.name} exceeded warning threshold (${metric.value} > ${budget.warningThreshold})`);
    }
  }

  /**
   * Debug logging
   */
  private debugLog(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[PerformanceMetrics] ${message}`, ...args);
    }
  }
}

// Export singleton getter
export const getMetricsCollector = (config?: MetricsCollectorConfig): PerformanceMetricsCollector => {
  return PerformanceMetricsCollector.getInstance(config);
};

// Export types
export type { MetricsCollectorConfig };

export default PerformanceMetricsCollector;
