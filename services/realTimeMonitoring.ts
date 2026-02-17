import { handleError } from '../utils/errorHandler';
import { consolidatedCache } from './consolidatedCacheManager';
import { MEMORY_LIMITS, PERFORMANCE_THRESHOLDS, UX_THRESHOLDS, TIMEOUTS } from '../constants';
import { CACHE_TTLS, PERFORMANCE_BUDGETS, API_THRESHOLDS, SCORING, ARRAY_LIMITS } from './constants';
import { createScopedLogger } from '../utils/logger';
import { SLICE_LIMITS } from '../constants/modularConfig';

const logger = createScopedLogger('RealTimeMonitoring');

interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
}

interface PerformanceMetrics {
  timestamp: number;
  url: string;
  userAgent: string;
  connection: string;
  vitals: CoreWebVitals;
  resources: PerformanceResourceTiming[];
  memory?: MemoryInfo;
  navigation: PerformanceNavigationTiming;
}

interface PerformanceBudget {
  bundleSize: number;
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  ttfb: number;
}

interface PerformanceAlert {
  type: 'budget_exceeded' | 'slow_vitals' | 'error_rate' | 'memory_leak';
  metric: string;
  value: number;
  threshold: number;
  url: string;
  timestamp: number;
}

class RealTimeMonitoring {
  private static instance: RealTimeMonitoring;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private observers: PerformanceObserver[] = [];
  private isInitialized = false;
  private readonly METRICS_RETENTION_LIMIT = MEMORY_LIMITS.MAX_METRICS_RETENTION;
  private readonly ALERT_THRESHOLD = 0.1; // 10% error rate - this is a business logic threshold
  private readonly SLOW_RESOURCE_THRESHOLD = API_THRESHOLDS.RESPONSE_TIME.POOR; // 2 seconds
  private readonly LARGE_RESOURCE_THRESHOLD = PERFORMANCE_BUDGETS.RESOURCE_SIZE.WARNING; // 500KB
  private readonly MEMORY_CRITICAL_THRESHOLD = 0.9; // 90% memory usage
  private readonly MAX_ALERTS_RETAINED = ARRAY_LIMITS.ALERTS_STANDARD; // 50 alerts

  // Timer references for cleanup
  private memoryCheckInterval: ReturnType<typeof setInterval> | null = null;
  private reportingInterval: ReturnType<typeof setInterval> | null = null;
  private budgetCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Event listener references for cleanup
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

  private readonly PERFORMANCE_BUDGET: PerformanceBudget = {
    bundleSize: PERFORMANCE_BUDGETS.BUNDLE_SIZE.WARNING, // 200KB warning threshold
    lcp: UX_THRESHOLDS.LCP_GOOD, // 2.5s
    fid: UX_THRESHOLDS.FID_GOOD, // 100ms
    cls: PERFORMANCE_THRESHOLDS.CLS_GOOD, // 0.1
    fcp: 1800, // 1.8s - aligned with UX_THRESHOLDS pattern (no direct FCP constant available)
    ttfb: UX_THRESHOLDS.TTFB_GOOD // 800ms
  };

  private constructor() {}

  static getInstance(): RealTimeMonitoring {
    if (!RealTimeMonitoring.instance) {
      RealTimeMonitoring.instance = new RealTimeMonitoring();
    }
    return RealTimeMonitoring.instance;
  }

  /**
   * Initialize real-time performance monitoring
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    try {
      // Initialize Core Web Vitals monitoring
      this.initializeCoreWebVitals();
      
      // Initialize resource monitoring
      this.initializeResourceMonitoring();
      
      // Initialize memory monitoring
      this.initializeMemoryMonitoring();
      
      // Initialize error monitoring
      this.initializeErrorMonitoring();
      
      // Set up periodic reporting
      this.setupPeriodicReporting();
      
this.isInitialized = true;
      // Performance monitoring initialized
     } catch (error: unknown) {
       handleError(error as Error, 'initialize', 'RealTimeMonitoring');
     }
  }

  /**
   * Initialize Core Web Vitals monitoring
   */
  private initializeCoreWebVitals(): void {
    // Largest Contentful Paint (LCP)
    this.observePerformanceObserver('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1];
      this.updateMetric('lcp', lastEntry.startTime);
    });

    // First Input Delay (FID)
    this.observePerformanceObserver('first-input', (entries) => {
      const firstEntry = entries[0] as PerformanceEntry & { processingStart?: number };
      if (firstEntry.processingStart) {
        this.updateMetric('fid', firstEntry.processingStart - firstEntry.startTime);
      }
    });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    this.observePerformanceObserver('layout-shift', (entries) => {
      for (const entry of entries) {
        const clsEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!clsEntry.hadRecentInput) {
          clsValue += clsEntry.value || 0;
        }
      }
      this.updateMetric('cls', clsValue);
    });

    // First Contentful Paint (FCP)
    this.observePerformanceObserver('paint', (entries) => {
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        this.updateMetric('fcp', fcpEntry.startTime);
      }
    });

    // Time to First Byte (TTFB)
    this.observePerformanceObserver('navigation', (entries) => {
      const navEntry = entries[0] as PerformanceNavigationTiming;
      const ttfb = navEntry.responseStart - navEntry.requestStart;
      this.updateMetric('ttfb', ttfb);
    });
  }

  /**
   * Initialize resource monitoring
   */
  private initializeResourceMonitoring(): void {
    this.observePerformanceObserver('resource', (entries) => {
      entries.forEach(entry => {
        this.analyzeResourceTiming(entry as PerformanceResourceTiming);
      });
    });
  }

  /**
   * Initialize memory monitoring
   */
  private initializeMemoryMonitoring(): void {
    if ('memory' in performance) {
      this.memoryCheckInterval = setInterval(() => {
        this.checkMemoryUsage();
      }, TIMEOUTS.HEALTH_CHECK); // Check every 30 seconds
    }
  }

  /**
   * Initialize error monitoring
   */
  private initializeErrorMonitoring(): void {
    // Monitor JavaScript errors
    this.errorHandler = (event: ErrorEvent) => {
      this.recordError('javascript', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      }).catch(err => console.error('Failed to record error:', err));
    };
    window.addEventListener('error', this.errorHandler);

    // Monitor promise rejections
    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      this.recordError('promise', {
        reason: event.reason,
        stack: event.reason?.stack
      }).catch(err => console.error('Failed to record rejection:', err));
    };
    window.addEventListener('unhandledrejection', this.rejectionHandler);
  }

  /**
   * Set up periodic reporting
   */
  private setupPeriodicReporting(): void {
    // Report metrics every 5 minutes
    this.reportingInterval = setInterval(() => {
      this.reportMetrics();
    }, CACHE_TTLS.FIVE_MINUTES);

    // Check performance budgets every minute
    this.budgetCheckInterval = setInterval(() => {
      this.checkPerformanceBudgets();
    }, CACHE_TTLS.ONE_MINUTE);
  }

  /**
   * Observe performance entries
   */
  private observePerformanceObserver(
    type: string,
    callback: (entries: PerformanceEntryList) => void
  ): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      
      observer.observe({ type, buffered: true });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn(`Failed to observe ${type}:`, error);
    }
  }

  /**
   * Update metric value
   */
  private updateMetric(name: keyof CoreWebVitals, value: number): void {
    const currentMetrics = this.getCurrentMetrics();
    if (currentMetrics) {
      currentMetrics.vitals[name] = value;
      this.checkThreshold(name, value);
    }
  }

  /**
   * Analyze resource timing
   */
  private analyzeResourceTiming(entry: PerformanceResourceTiming): void {
    const duration = entry.responseEnd - entry.requestStart;
    const size = entry.transferSize || 0;

    // Check for slow resources - using centralized thresholds
    if (duration > this.SLOW_RESOURCE_THRESHOLD) {
      this.createAlert('slow_vitals', 'resource_load_time', duration, this.SLOW_RESOURCE_THRESHOLD, entry.name);
    }

    // Check for large resources - using centralized thresholds
    if (size > this.LARGE_RESOURCE_THRESHOLD) {
      this.createAlert('budget_exceeded', 'resource_size', size, this.LARGE_RESOURCE_THRESHOLD, entry.name);
    }
  }

  /**
   * Check memory usage
   */
  private checkMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as unknown as { memory: MemoryInfo }).memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

      if (usageRatio > this.MEMORY_CRITICAL_THRESHOLD) {
        this.createAlert('memory_leak', 'memory_usage', usageRatio, this.MEMORY_CRITICAL_THRESHOLD, window.location.href);
      }
    }
  }

  /**
   * Record error
   */
  private async recordError(type: string, details: Record<string, unknown>): Promise<void> {
    const errorData = {
      type,
      details,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    // Cache error for reporting
    await consolidatedCache.set(`error_${Date.now()}`, errorData, 'performance', ['error', 'performance']);

    // Check error rate
    this.checkErrorRate();
  }

  /**
   * Check error rate
   */
  private checkErrorRate(): void {
    const recentErrors = this.getRecentErrors(TIMEOUTS.HEALTH_CHECK * 2); // Last minute
    const totalRequests = this.getRecentRequests(TIMEOUTS.HEALTH_CHECK * 2);
    
    if (totalRequests > 0) {
      const errorRate = recentErrors.length / totalRequests;
      if (errorRate > this.ALERT_THRESHOLD) {
        this.createAlert('error_rate', 'error_percentage', errorRate * 100, this.ALERT_THRESHOLD * 100, window.location.href);
      }
    }
  }

  /**
   * Check performance thresholds
   */
  private checkThreshold(metric: string, value: number): void {
    const thresholds = {
      lcp: this.PERFORMANCE_BUDGET.lcp,
      fid: this.PERFORMANCE_BUDGET.fid,
      cls: this.PERFORMANCE_BUDGET.cls,
      fcp: this.PERFORMANCE_BUDGET.fcp,
      ttfb: this.PERFORMANCE_BUDGET.ttfb
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (threshold && value > threshold) {
      this.createAlert('slow_vitals', metric, value, threshold, window.location.href);
    }
  }

  /**
   * Check performance budgets
   */
  private checkPerformanceBudgets(): void {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) return;

    // Check bundle size
    const bundleSize = this.calculateBundleSize();
    if (bundleSize > this.PERFORMANCE_BUDGET.bundleSize) {
      this.createAlert('budget_exceeded', 'bundle_size', bundleSize, this.PERFORMANCE_BUDGET.bundleSize, window.location.href);
    }

    // Check Core Web Vitals against budgets
    Object.entries(currentMetrics.vitals).forEach(([metric, value]) => {
      const threshold = this.PERFORMANCE_BUDGET[metric as keyof PerformanceBudget];
      if (threshold && value > threshold) {
        this.createAlert('budget_exceeded', metric, value, threshold, window.location.href);
      }
    });
  }

  /**
   * Create performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    metric: string,
    value: number,
    threshold: number,
    url: string
  ): void {
    const alert: PerformanceAlert = {
      type,
      metric,
      value,
      threshold,
      url,
      timestamp: Date.now()
    };

    this.alerts.push(alert);

    // Keep only recent alerts - using centralized limit
    if (this.alerts.length > this.MAX_ALERTS_RETAINED) {
      this.alerts = this.alerts.slice(-this.MAX_ALERTS_RETAINED);
    }

    // Log warning
    logger.warn(`Performance alert: ${metric} (${value}) exceeds threshold (${threshold})`);
  }

  /**
   * Get current metrics
   */
  private getCurrentMetrics(): PerformanceMetrics | null {
    if (typeof window === 'undefined') return null;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    return {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection: (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType || 'unknown',
      vitals: {
        lcp: 0,
        fid: 0,
        cls: 0,
        fcp: 0,
        ttfb: 0
      },
      resources,
      memory: (performance as unknown as { memory?: MemoryInfo }).memory,
      navigation
    };
  }

  /**
   * Calculate bundle size
   */
  private calculateBundleSize(): number {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return resources
      .filter(r => r.name.includes('.js') || r.name.includes('.css'))
      .reduce((total, r) => total + (r.transferSize || 0), 0);
  }

  /**
   * Get recent errors
   */
  private getRecentErrors(_timeWindow: number): unknown[] {
    // This would typically query a cache or storage for recent errors
    // For now, return a placeholder
    return [];
  }

  /**
   * Get recent requests
   */
  private getRecentRequests(timeWindow: number): number {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const cutoff = Date.now() - timeWindow;
    return resources.filter(r => r.responseEnd > cutoff).length;
  }

  /**
   * Report metrics to analytics service
   */
  private async reportMetrics(): Promise<void> {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) return;

    try {
      // Cache metrics for batch reporting
      await consolidatedCache.set(`metrics_${Date.now()}`, currentMetrics, 'performance', ['metrics', 'performance']);

      // Store in memory for real-time access
      this.metrics.push(currentMetrics);
      if (this.metrics.length > this.METRICS_RETENTION_LIMIT) {
        this.metrics = this.metrics.slice(-this.METRICS_RETENTION_LIMIT);
      }

      logger.log('Metrics reported:', {
        lcp: currentMetrics.vitals.lcp,
        fid: currentMetrics.vitals.fid,
        cls: currentMetrics.vitals.cls,
        fcp: currentMetrics.vitals.fcp,
        ttfb: currentMetrics.vitals.ttfb
      });
    } catch (error: unknown) {
      handleError(error as Error, 'reportMetrics', 'RealTimeMonitoring');
    }
  }

  /**
   * Precompute common query patterns
   */
  private precomputeCommonQueries(): void {
    // Placeholder for future optimization
  }

  /**
   * Initialize index recommendations
   */
  private initializeIndexRecommendations(): void {
    // Placeholder for future optimization
  }

  /**
   * Set up periodic optimization
   */
  private setupPeriodicOptimization(): void {
    // Placeholder for future optimization
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    vitals: CoreWebVitals;
    alerts: PerformanceAlert[];
    budgetCompliance: Record<string, boolean>;
    score: number;
  } {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) {
      return {
        vitals: { lcp: 0, fid: 0, cls: 0, fcp: 0, ttfb: 0 },
        alerts: this.alerts.slice(-SLICE_LIMITS.HISTORY.STANDARD),
        budgetCompliance: {},
        score: 0
      };
    }

    const budgetCompliance: Record<string, boolean> = {};
    let score = 100;

    // Check each metric against budget
    Object.entries(currentMetrics.vitals).forEach(([metric, value]) => {
      const threshold = this.PERFORMANCE_BUDGET[metric as keyof PerformanceBudget];
      if (threshold) {
        budgetCompliance[metric] = value <= threshold;
        if (value > threshold) {
          score -= SCORING.SLOW_OP_PENALTY_MULTIPLIER * 4; // Deduct points for budget violations (20 points)
        }
      }
    });

    return {
      vitals: currentMetrics.vitals,
      alerts: this.alerts.slice(-ARRAY_LIMITS.ALERTS_RECENT),
      budgetCompliance,
      score: Math.max(0, score)
    };
  }

  /**
   * Get detailed metrics
   */
  getDetailedMetrics(): PerformanceMetrics[] {
    return this.metrics.slice(-SLICE_LIMITS.HISTORY.LARGE); // Last 100 metrics
  }

  /**
   * Get alerts
   */
  getAlerts(): PerformanceAlert[] {
    return this.alerts.slice(-SLICE_LIMITS.HISTORY.STANDARD); // Last 50 alerts
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.alerts = [];
  }

  /**
   * Destroy monitoring and clean up all resources to prevent memory leaks
   */
  destroy(): void {
    // Disconnect all PerformanceObservers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    // Clear all intervals
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
    }
    if (this.budgetCheckInterval) {
      clearInterval(this.budgetCheckInterval);
      this.budgetCheckInterval = null;
    }

    // Remove all event listeners
    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler);
      this.errorHandler = null;
    }
    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = null;
    }

    this.isInitialized = false;
  }
}

// Export singleton instance
export const realTimeMonitoring = RealTimeMonitoring.getInstance();
export type { CoreWebVitals, PerformanceMetrics, PerformanceBudget, PerformanceAlert };