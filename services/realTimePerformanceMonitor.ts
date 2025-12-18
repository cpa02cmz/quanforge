/**
 * Real-time Performance Monitoring Service
 * Provides comprehensive performance monitoring with Web Vitals and custom metrics
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  type: 'navigation' | 'paint' | 'layout' | 'interaction' | 'custom';
  rating: 'good' | 'needs-improvement' | 'poor';
  metadata?: Record<string, any>;
}

interface WebVitals {
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  FCP?: number; // First Contentful Paint
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
  TBT?: number; // Total Blocking Time
}

interface PerformanceReport {
  timestamp: number;
  url: string;
  userAgent: string;
  region: string;
  connectionType: string;
  webVitals: WebVitals;
  customMetrics: PerformanceMetric[];
  resourceTiming: ResourceTimingEntry[];
  navigationTiming: PerformanceNavigationTiming;
  memoryUsage?: any;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations: string[];
}

interface PerformanceThresholds {
  LCP: { good: number; poor: number };
  FID: { good: number; poor: number };
  CLS: { good: number; poor: number };
  FCP: { good: number; poor: number };
  TTFB: { good: number; poor: number };
  INP: { good: number; poor: number };
  TBT: { good: number; poor: number };
}

class RealTimePerformanceMonitor {
  private static instance: RealTimePerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private reports: PerformanceReport[] = [];
  private observers: PerformanceObserver[] = [];
  private isMonitoring = false;
  private thresholds: PerformanceThresholds;
  private reportCallback?: (report: PerformanceReport) => void;
  private readonly MAX_METRICS = 1000;
  private readonly MAX_REPORTS = 100;

  private constructor() {
    this.thresholds = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      TTFB: { good: 800, poor: 1800 },
      INP: { good: 200, poor: 500 },
      TBT: { good: 200, poor: 600 }
    };
  }

  static getInstance(): RealTimePerformanceMonitor {
    if (!RealTimePerformanceMonitor.instance) {
      RealTimePerformanceMonitor.instance = new RealTimePerformanceMonitor();
    }
    return RealTimePerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(reportCallback?: (report: PerformanceReport) => void): void {
    if (this.isMonitoring || typeof window === 'undefined') {
      return;
    }

    this.reportCallback = reportCallback;
    this.isMonitoring = true;

    // Set up performance observers
    this.setupNavigationObserver();
    this.setupPaintObserver();
    this.setupLayoutShiftObserver();
    this.setupInteractionObserver();
    this.setupResourceObserver();
    this.setupCustomMetricsObserver();

    // Generate initial report after page load
    if (document.readyState === 'complete') {
      setTimeout(() => this.generateReport(), 1000);
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => this.generateReport(), 1000);
      });
    }

// Removed for production: console.log('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    // Disconnect all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    this.isMonitoring = false;
// Removed for production: console.log('Performance monitoring stopped');
  }

  /**
   * Setup navigation timing observer
   */
  private setupNavigationObserver(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordNavigationMetrics(navEntry);
          }
        }
      });

      observer.observe({ entryTypes: ['navigation'] });
      this.observers.push(observer);
    } catch (error) {
// Removed for production: console.warn('Navigation observer not supported:', error);
    }
  }

  /**
   * Setup paint timing observer
   */
  private setupPaintObserver(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint') {
            this.recordMetric({
              name: entry.name,
              value: entry.startTime,
              timestamp: Date.now(),
              type: 'paint',
              rating: this.ratePaintMetric(entry.name, entry.startTime)
            });
          }
        }
      });

      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    } catch (error) {
// Removed for production: console.warn('Paint observer not supported:', error);
    }
  }

  /**
   * Setup layout shift observer
   */
  private setupLayoutShiftObserver(): void {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }

        this.recordMetric({
          name: 'CLS',
          value: clsValue,
          timestamp: Date.now(),
          type: 'layout',
          rating: this.rateMetric('CLS', clsValue)
        });
      });

      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (error) {
// Removed for production: console.warn('Layout shift observer not supported:', error);
    }
  }

  /**
   * Setup interaction observer
   */
  private setupInteractionObserver(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'first-input') {
            const fidEntry = entry as PerformanceEventTiming;
            this.recordMetric({
              name: 'FID',
              value: fidEntry.processingStart - fidEntry.startTime,
              timestamp: Date.now(),
              type: 'interaction',
              rating: this.rateMetric('FID', fidEntry.processingStart - fidEntry.startTime)
            });
          } else if (entry.entryType === 'event') {
            const eventEntry = entry as PerformanceEventTiming;
            this.recordMetric({
              name: 'INP',
              value: eventEntry.duration,
              timestamp: Date.now(),
              type: 'interaction',
              rating: this.rateMetric('INP', eventEntry.duration),
              metadata: {
                target: (eventEntry.target as Element)?.tagName,
                type: eventEntry.name
              }
            });
          }
        }
      });

      observer.observe({ entryTypes: ['first-input', 'event'] });
      this.observers.push(observer);
    } catch (error) {
// Removed for production: console.warn('Interaction observer not supported:', error);
    }
  }

  /**
   * Setup resource timing observer
   */
  private setupResourceObserver(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            this.recordResourceMetric(entry as PerformanceResourceTiming);
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });
      this.observers.push(observer);
    } catch (error) {
// Removed for production: console.warn('Resource observer not supported:', error);
    }
  }

  /**
   * Setup custom metrics observer
   */
  private setupCustomMetricsObserver(): void {
    // Listen for custom performance marks
    const originalMark = performance.mark;
    performance.mark = (name?: string, options?: PerformanceMarkOptions) => {
      const result = originalMark.call(performance, name, options);
      if (name) {
        this.recordMetric({
          name,
          value: options?.startTime || 0,
          timestamp: Date.now(),
          type: 'custom',
          rating: 'good' // Custom metrics are rated as good by default
        });
      }
      return result;
    };

    // Listen for custom performance measures
    const originalMeasure = performance.measure;
    performance.measure = (name?: string, startOrMeasureOptions?: string | PerformanceMeasureOptions, end?: string) => {
      const result = originalMeasure.call(performance, name, startOrMeasureOptions, end);
      if (name) {
        const measure = performance.getEntriesByName(name, 'measure')[0];
        if (measure) {
          this.recordMetric({
            name,
            value: measure.duration,
            timestamp: Date.now(),
            type: 'custom',
            rating: this.rateCustomMetric(name, measure.duration)
          });
        }
      }
      return result;
    };
  }

  /**
   * Record navigation metrics
   */
  private recordNavigationMetrics(navEntry: PerformanceNavigationTiming): void {
    const metrics = [
      { name: 'TTFB', value: navEntry.responseStart - navEntry.requestStart },
      { name: 'FCP', value: navEntry.loadEventStart - navEntry.fetchStart },
      { name: 'LCP', value: navEntry.loadEventStart - navEntry.fetchStart }, // Simplified LCP
      { name: 'DOM Interactive', value: navEntry.domInteractive - navEntry.fetchStart },
      { name: 'DOM Complete', value: navEntry.domComplete - navEntry.fetchStart },
      { name: 'Load Complete', value: navEntry.loadEventEnd - navEntry.fetchStart }
    ];

    metrics.forEach(metric => {
      this.recordMetric({
        name: metric.name,
        value: metric.value,
        timestamp: Date.now(),
        type: 'navigation',
        rating: this.rateMetric(metric.name, metric.value)
      });
    });

    // Calculate Total Blocking Time
    const tbt = this.calculateTBT(navEntry);
    this.recordMetric({
      name: 'TBT',
      value: tbt,
      timestamp: Date.now(),
      type: 'navigation',
      rating: this.rateMetric('TBT', tbt)
    });
  }

  /**
   * Record resource metric
   */
  private recordResourceMetric(entry: PerformanceResourceTiming): void {
    const duration = entry.responseEnd - entry.startTime;
    const size = entry.transferSize || 0;

    this.recordMetric({
      name: `Resource ${entry.initiatorType}`,
      value: duration,
      timestamp: Date.now(),
      type: 'custom',
      rating: this.rateResourceMetric(entry.initiatorType, duration),
      metadata: {
        name: entry.name,
        size,
        type: entry.initiatorType,
        cached: entry.transferSize === 0 && entry.decodedBodySize > 0
      }
    });
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  /**
   * Rate a metric based on thresholds
   */
  private rateMetric(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = this.thresholds[name as keyof PerformanceThresholds];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Rate paint metric
   */
  private ratePaintMetric(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    if (name === 'first-contentful-paint') {
      return this.rateMetric('FCP', value);
    }
    return 'good';
  }

  /**
   * Rate custom metric
   */
  private rateCustomMetric(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    // Custom logic for different custom metrics
    if (name.includes('api')) {
      return value < 1000 ? 'good' : value < 2000 ? 'needs-improvement' : 'poor';
    }
    if (name.includes('render')) {
      return value < 100 ? 'good' : value < 300 ? 'needs-improvement' : 'poor';
    }
    return 'good';
  }

  /**
   * Rate resource metric
   */
  private rateResourceMetric(type: string, duration: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = {
      script: 200,
      link: 100,
      img: 300,
      css: 100,
      fetch: 1000,
      xhr: 1000
    };

    const threshold = thresholds[type as keyof typeof thresholds] || 500;
    if (duration <= threshold) return 'good';
    if (duration <= threshold * 2) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Calculate Total Blocking Time
   */
  private calculateTBT(navEntry: PerformanceNavigationTiming): number {
    // Simplified TBT calculation
    const fcp = navEntry.loadEventStart - navEntry.fetchStart; // Using as proxy for FCP
    const tti = navEntry.domComplete; // Using as proxy for TTI
    let tbt = 0;

    // Get long tasks (simplified)
    const longTasks = performance.getEntriesByType('long-task');
    for (const task of longTasks) {
      if (task.startTime >= fcp && task.startTime < tti) {
        tbt += task.duration - 50; // Subtract 50ms threshold
      }
    }

    return tbt;
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length === 0) {
      return null;
    }

    const navEntry = navEntries[0];
    const webVitals = this.extractWebVitals();
    const customMetrics = this.metrics.filter(m => m.type === 'custom');
    const resourceTiming = performance.getEntriesByType('resource') as ResourceTimingEntry[];
    const memoryUsage = this.getMemoryUsage();

    const report: PerformanceReport = {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      region: this.getRegion(),
      connectionType: this.getConnectionType(),
      webVitals,
      customMetrics,
      resourceTiming,
      navigationTiming: navEntry,
      memoryUsage,
      grade: this.calculateGrade(webVitals),
      recommendations: this.generateRecommendations(webVitals, customMetrics)
    };

    this.reports.push(report);
    if (this.reports.length > this.MAX_REPORTS) {
      this.reports = this.reports.slice(-this.MAX_REPORTS);
    }

    // Send report to callback
    if (this.reportCallback) {
      this.reportCallback(report);
    }

    return report;
  }

  /**
   * Extract Web Vitals from metrics
   */
  private extractWebVitals(): WebVitals {
    const vitals: WebVitals = {};

    for (const metric of this.metrics) {
      switch (metric.name) {
        case 'LCP':
          vitals.LCP = metric.value;
          break;
        case 'FID':
          vitals.FID = metric.value;
          break;
        case 'CLS':
          vitals.CLS = metric.value;
          break;
        case 'FCP':
          vitals.FCP = metric.value;
          break;
        case 'TTFB':
          vitals.TTFB = metric.value;
          break;
        case 'INP':
          vitals.INP = metric.value;
          break;
        case 'TBT':
          vitals.TBT = metric.value;
          break;
      }
    }

    return vitals;
  }

  /**
   * Get memory usage (if available)
   */
  private getMemoryUsage(): any {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }
    return undefined;
  }

  /**
   * Get user region
   */
  private getRegion(): string {
    // Try to get region from various sources
    return (window as any).VERCEL_REGION || 
           (window as any).CF_REGION || 
           (window as any).AWS_REGION || 
           'unknown';
  }

  /**
   * Get connection type
   */
  private getConnectionType(): string {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      return connection.effectiveType || connection.type || 'unknown';
    }
    
    return 'unknown';
  }

  /**
   * Calculate performance grade
   */
  private calculateGrade(vitals: WebVitals): 'A' | 'B' | 'C' | 'D' | 'F' {
    let score = 0;
    let total = 0;

    const weights = {
      LCP: 25,
      FID: 15,
      CLS: 20,
      FCP: 15,
      TTFB: 10,
      INP: 10,
      TBT: 5
    };

    for (const [metric, value] of Object.entries(vitals)) {
      if (value !== undefined) {
        const weight = weights[metric as keyof typeof weights];
        total += weight;

        const threshold = this.thresholds[metric as keyof PerformanceThresholds];
        if (threshold) {
          if (value <= threshold.good) {
            score += weight;
          } else if (value <= threshold.poor) {
            score += weight * 0.5;
          }
        }
      }
    }

    const percentage = total > 0 ? score / total : 0;

    if (percentage >= 0.9) return 'A';
    if (percentage >= 0.8) return 'B';
    if (percentage >= 0.7) return 'C';
    if (percentage >= 0.6) return 'D';
    return 'F';
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(vitals: WebVitals, customMetrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];

    // LCP recommendations
    if (vitals.LCP && vitals.LCP > this.thresholds.LCP.good) {
      recommendations.push('Optimize Largest Contentful Paint by preloading critical resources');
    }

    // FID recommendations
    if (vitals.FID && vitals.FID > this.thresholds.FID.good) {
      recommendations.push('Reduce First Input Delay by minimizing JavaScript execution time');
    }

    // CLS recommendations
    if (vitals.CLS && vitals.CLS > this.thresholds.CLS.good) {
      recommendations.push('Prevent Cumulative Layout Shift by specifying image dimensions');
    }

    // TTFB recommendations
    if (vitals.TTFB && vitals.TTFB > this.thresholds.TTFB.good) {
      recommendations.push('Improve Time to First Byte by optimizing server response time');
    }

    // Custom metric recommendations
    const slowAPICalls = customMetrics.filter(m => 
      m.name.includes('api') && m.rating === 'poor'
    );
    if (slowAPICalls.length > 0) {
      recommendations.push('Optimize slow API calls with better caching or query optimization');
    }

    const slowRenders = customMetrics.filter(m => 
      m.name.includes('render') && m.rating === 'poor'
    );
    if (slowRenders.length > 0) {
      recommendations.push('Improve render performance by optimizing component updates');
    }

    return recommendations;
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get recent reports
   */
  getReports(limit: number = 10): PerformanceReport[] {
    return this.reports.slice(-limit);
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    grade: string;
    webVitals: WebVitals;
    issues: string[];
    recommendations: string[];
  } {
    const latestReport = this.reports[this.reports.length - 1];
    
    if (!latestReport) {
      return {
        grade: 'N/A',
        webVitals: {},
        issues: ['No performance data available'],
        recommendations: ['Start performance monitoring to get recommendations']
      };
    }

    const issues = Object.entries(latestReport.webVitals)
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => {
        const threshold = this.thresholds[name as keyof PerformanceThresholds];
        if (threshold && value > threshold.poor) {
          return `${name} is poor (${value}ms)`;
        }
        return null;
      })
      .filter(Boolean) as string[];

    return {
      grade: latestReport.grade,
      webVitals: latestReport.webVitals,
      issues,
      recommendations: latestReport.recommendations
    };
  }

  /**
   * Record custom performance mark
   */
  mark(name: string): void {
    if (this.isMonitoring) {
      performance.mark(name);
    }
  }

  /**
   * Record custom performance measure
   */
  measure(name: string, startMark?: string, endMark?: string): void {
    if (this.isMonitoring) {
      performance.measure(name, startMark, endMark);
    }
  }

  /**
   * Clear all metrics and reports
   */
  clear(): void {
    this.metrics = [];
    this.reports = [];
  }

  /**
   * Export performance data
   */
  exportData(): {
    metrics: PerformanceMetric[];
    reports: PerformanceReport[];
    summary: any;
  } {
    return {
      metrics: this.metrics,
      reports: this.reports,
      summary: this.getSummary()
    };
  }
}

// Export singleton instance
export const performanceMonitor = RealTimePerformanceMonitor.getInstance();

// Export types and class for testing
export { RealTimePerformanceMonitor, type PerformanceMetric, type PerformanceReport, type WebVitals };

// Convenience functions
export const startPerformanceMonitoring = (callback?: (report: PerformanceReport) => void): void => 
  performanceMonitor.startMonitoring(callback);

export const getPerformanceSummary = () => performanceMonitor.getSummary();

export const markPerformance = (name: string): void => performanceMonitor.mark(name);

export const measurePerformance = (name: string, start?: string, end?: string): void => 
  performanceMonitor.measure(name, start, end);