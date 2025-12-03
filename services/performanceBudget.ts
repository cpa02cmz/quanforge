/**
 * Performance Budget Service
 * Real-time performance monitoring with budget enforcement and alerting
 * Optimized for Vercel Edge deployment with Core Web Vitals tracking
 */

// Performance budget configuration
const PERFORMANCE_BUDGETS = {
  // Core Web Vitals thresholds
  CORE_WEB_VITALS: {
    LCP: { warning: 2500, critical: 4000 }, // Largest Contentful Paint (ms)
    FID: { warning: 100, critical: 300 },   // First Input Delay (ms)
    CLS: { warning: 0.1, critical: 0.25 },  // Cumulative Layout Shift
    FCP: { warning: 1800, critical: 3000 }, // First Contentful Paint (ms)
    TTFB: { warning: 800, critical: 1800 }, // Time to First Byte (ms)
    INP: { warning: 200, critical: 500 },   // Interaction to Next Paint (ms)
  },

  // Resource budgets
  RESOURCES: {
    JAVASCRIPT: { warning: 250000, critical: 350000 },    // 250KB / 350KB
    CSS: { warning: 100000, critical: 150000 },          // 100KB / 150KB
    IMAGES: { warning: 500000, critical: 1000000 },       // 500KB / 1MB
    FONTS: { warning: 200000, critical: 300000 },         // 200KB / 300KB
    TOTAL: { warning: 1000000, critical: 2000000 },       // 1MB / 2MB
  },

  // Network budgets
  NETWORK: {
    REQUEST_COUNT: { warning: 50, critical: 100 },        // Number of requests
    TOTAL_SIZE: { warning: 1500000, critical: 3000000 },  // 1.5MB / 3MB
    DOM_SIZE: { warning: 1500, critical: 2500 },          // DOM nodes
  },

  // Runtime budgets
  RUNTIME: {
    BLOCKING_TIME: { warning: 200, critical: 400 },       // Main thread blocking (ms)
    SCRIPT_EVAL_TIME: { warning: 500, critical: 1000 },   // Script evaluation (ms)
    LONG_TASKS: { warning: 3, critical: 7 },              // Number of long tasks (>50ms)
  },
};

// Performance metrics interface
interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
  inp?: number;

  // Resource metrics
  resourceTiming: PerformanceResourceTiming[];
  resourceSizes: Record<string, number>;
  requestCount: number;

  // Runtime metrics
  longTasks: PerformanceEntry[];
  blockingTime: number;
  scriptEvalTime: number;

  // Custom metrics
  routeChanges: number;
  apiResponseTime: number;
  renderTime: number;

  // Metadata
  timestamp: number;
  url: string;
  userAgent: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  connectionType: string;
  region: string;
}

// Budget violation interface
interface BudgetViolation {
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  impact: string;
  recommendation: string;
}

// Performance budget service
class PerformanceBudgetService {
  private metrics: PerformanceMetrics[] = [];
  private violations: BudgetViolation[] = [];
  private observers: PerformanceObserver[] = [];
  private isMonitoring = false;
  private reportCallback?: (violations: BudgetViolation[], metrics: PerformanceMetrics) => void;

  constructor() {
    this.setupDeviceDetection();
    this.setupNetworkMonitoring();
  }

  // Setup device detection
  private setupDeviceDetection() {
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent;
      const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
      // Store device info for metrics
    }
  }

  // Setup network monitoring
  private setupNetworkMonitoring() {
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      // Monitor connection changes
    }
  }

  // Start performance monitoring
  startMonitoring(reportCallback?: (violations: BudgetViolation[], metrics: PerformanceMetrics) => void): void {
    if (this.isMonitoring) return;

    this.reportCallback = reportCallback;
    this.isMonitoring = true;

    // Observe Core Web Vitals
    this.observeWebVitals();

    // Observe resources
    this.observeResources();

    // Observe long tasks
    this.observeLongTasks();

    // Observe navigation timing
    this.observeNavigation();

    // Setup route change monitoring
    this.setupRouteChangeMonitoring();

    console.log('Performance budget monitoring started');
  }

  // Stop performance monitoring
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.isMonitoring = false;

    console.log('Performance budget monitoring stopped');
  }

  // Observe Core Web Vitals
  private observeWebVitals(): void {
    // LCP observer
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformancePaintTiming;
      if (lastEntry) {
        this.recordMetric('lcp', lastEntry.startTime);
      }
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    this.observers.push(lcpObserver);

    // FID observer (requires user interaction)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (entry.name === 'first-input') {
          this.recordMetric('fid', entry.processingStart - entry.startTime);
        }
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });
    this.observers.push(fidObserver);

    // CLS observer
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          this.recordMetric('cls', clsValue);
        }
      });
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
    this.observers.push(clsObserver);

    // FCP observer
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint') as PerformancePaintTiming;
      if (fcpEntry) {
        this.recordMetric('fcp', fcpEntry.startTime);
      }
    });
    fcpObserver.observe({ entryTypes: ['paint'] });
    this.observers.push(fcpObserver);

    // INP observer (if supported)
    if ('InteractionEvent' in window) {
      const inpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.recordMetric('inp', entry.duration);
        });
      });
      inpObserver.observe({ entryTypes: ['event'] });
      this.observers.push(inpObserver);
    }
  }

  // Observe resource loading
  private observeResources(): void {
    const resourceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries() as PerformanceResourceTiming[];
      entries.forEach(entry => {
        this.analyzeResource(entry);
      });
    });
    resourceObserver.observe({ entryTypes: ['resource'] });
    this.observers.push(resourceObserver);
  }

  // Observe long tasks
  private observeLongTasks(): void {
    if ('PerformanceObserver' in window && 'longtask' in PerformanceObserver.supportedEntryTypes) {
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          this.recordLongTask(entry);
        });
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);
    }
  }

  // Observe navigation timing
  private observeNavigation(): void {
    const navigationObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: PerformanceNavigationTiming) => {
        if (entry.entryType === 'navigation') {
          this.recordMetric('ttfb', entry.responseStart - entry.requestStart);
        }
      });
    });
    navigationObserver.observe({ entryTypes: ['navigation'] });
    this.observers.push(navigationObserver);
  }

  // Setup route change monitoring
  private setupRouteChangeMonitoring(): void {
    // Monitor for SPA route changes
    let routeChangeCount = 0;
    
    // Override pushState and replaceState to detect route changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      routeChangeCount++;
      // Trigger performance measurement after route change
      setTimeout(() => this.measureRoutePerformance(), 1000);
    }.bind(this);

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      routeChangeCount++;
      setTimeout(() => this.measureRoutePerformance(), 1000);
    }.bind(this);

    // Listen for popstate events
    window.addEventListener('popstate', () => {
      routeChangeCount++;
      setTimeout(() => this.measureRoutePerformance(), 1000);
    });
  }

  // Record metric
  private recordMetric(name: string, value: number): void {
    const latestMetrics = this.metrics[this.metrics.length - 1] || this.createMetricsEntry();
    latestMetrics[name as keyof PerformanceMetrics] = value;
    
    this.checkBudgetViolation(name, value);
  }

  // Record long task
  private recordLongTask(entry: PerformanceEntry): void {
    const latestMetrics = this.metrics[this.metrics.length - 1] || this.createMetricsEntry();
    latestMetrics.longTasks.push(entry);
    latestMetrics.blockingTime += entry.duration;
    
    this.checkBudgetViolation('longTasks', latestMetrics.longTasks.length);
    this.checkBudgetViolation('blockingTime', latestMetrics.blockingTime);
  }

  // Analyze resource
  private analyzeResource(entry: PerformanceResourceTiming): void {
    const latestMetrics = this.metrics[this.metrics.length - 1] || this.createMetricsEntry();
    
    // Track resource sizes
    const size = entry.transferSize || 0;
    const resourceType = this.getResourceType(entry);
    
    if (!latestMetrics.resourceSizes[resourceType]) {
      latestMetrics.resourceSizes[resourceType] = 0;
    }
    latestMetrics.resourceSizes[resourceType] += size;
    
    latestMetrics.resourceTiming.push(entry);
    latestMetrics.requestCount++;
    
    // Check resource budgets
    this.checkResourceBudgets(latestMetrics.resourceSizes);
    this.checkBudgetViolation('requestCount', latestMetrics.requestCount);
  }

  // Get resource type from entry
  private getResourceType(entry: PerformanceResourceTiming): string {
    if (entry.initiatorType === 'script') return 'JAVASCRIPT';
    if (entry.initiatorType === 'link' && entry.name.includes('.css')) return 'CSS';
    if (entry.initiatorType === 'img') return 'IMAGES';
    if (entry.initiatorType === 'css') return 'CSS';
    if (entry.name.includes('.woff') || entry.name.includes('.ttf')) return 'FONTS';
    return 'OTHER';
  }

  // Check resource budgets
  private checkResourceBudgets(resourceSizes: Record<string, number>): void {
    Object.entries(PERFORMANCE_BUDGETS.RESOURCES).forEach(([type, budget]) => {
      const size = resourceSizes[type] || 0;
      if (size > budget.critical) {
        this.addViolation({
          metric: `resource_${type.toLowerCase()}`,
          value: size,
          threshold: budget.critical,
          severity: 'critical',
          impact: `Excessive ${type} size affects page load performance`,
          recommendation: `Optimize ${type} through minification, compression, or code splitting`,
        });
      } else if (size > budget.warning) {
        this.addViolation({
          metric: `resource_${type.toLowerCase()}`,
          value: size,
          threshold: budget.warning,
          severity: 'warning',
          impact: `Large ${type} size may slow down page load`,
          recommendation: `Consider optimizing ${type} for better performance`,
        });
      }
    });
  }

  // Check budget violation
  private checkBudgetViolation(metric: string, value: number): void {
    // Check Core Web Vitals
    if (metric.toUpperCase() in PERFORMANCE_BUDGETS.CORE_WEB_VITALS) {
      const budget = PERFORMANCE_BUDGETS.CORE_WEB_VITALS[metric.toUpperCase() as keyof typeof PERFORMANCE_BUDGETS.CORE_WEB_VITALS];
      
      if (value > budget.critical) {
        this.addViolation({
          metric,
          value,
          threshold: budget.critical,
          severity: 'critical',
          impact: `Poor user experience due to slow ${metric}`,
          recommendation: this.getRecommendation(metric, value),
        });
      } else if (value > budget.warning) {
        this.addViolation({
          metric,
          value,
          threshold: budget.warning,
          severity: 'warning',
          impact: `Degraded user experience due to ${metric}`,
          recommendation: this.getRecommendation(metric, value),
        });
      }
    }

    // Check other budgets
    this.checkOtherBudgets(metric, value);
  }

  // Check other budget types
  private checkOtherBudgets(metric: string, value: number): void {
    // Network budgets
    if (metric === 'requestCount') {
      const budget = PERFORMANCE_BUDGETS.NETWORK.REQUEST_COUNT;
      if (value > budget.critical) {
        this.addViolation({
          metric,
          value,
          threshold: budget.critical,
          severity: 'critical',
          impact: 'Too many requests slow down page load',
          recommendation: 'Reduce HTTP requests through bundling and inlining',
        });
      }
    }

    // Runtime budgets
    if (metric === 'blockingTime') {
      const budget = PERFORMANCE_BUDGETS.RUNTIME.BLOCKING_TIME;
      if (value > budget.critical) {
        this.addViolation({
          metric,
          value,
          threshold: budget.critical,
          severity: 'critical',
          impact: 'Main thread blocking causes janky user experience',
          recommendation: 'Break up long tasks and use Web Workers for heavy computations',
        });
      }
    }
  }

  // Get recommendation for metric
  private getRecommendation(metric: string, value: number): string {
    const recommendations: Record<string, string> = {
      lcp: 'Optimize largest content element loading through lazy loading, compression, and CDNs',
      fid: 'Reduce JavaScript execution time and break up long tasks',
      cls: 'Reserve space for dynamic content and avoid inserting content above existing content',
      fcp: 'Optimize server response time and reduce render-blocking resources',
      ttfb: 'Improve server performance, use CDN, and enable HTTP/2 or HTTP/3',
      inp: 'Optimize interaction handlers and reduce main thread work',
    };

    return recommendations[metric] || 'Optimize overall page performance';
  }

  // Add violation
  private addViolation(violation: BudgetViolation): void {
    this.violations.push(violation);
    
    // Report violation if callback is provided
    if (this.reportCallback) {
      const latestMetrics = this.metrics[this.metrics.length - 1] || this.createMetricsEntry();
      this.reportCallback([violation], latestMetrics);
    }

    // Log violation
    console.warn(`Performance budget violation (${violation.severity}): ${violation.metric} = ${violation.value} (threshold: ${violation.threshold})`);
  }

  // Create metrics entry
  private createMetricsEntry(): PerformanceMetrics {
    return {
      resourceTiming: [],
      resourceSizes: {},
      requestCount: 0,
      longTasks: [],
      blockingTime: 0,
      scriptEvalTime: 0,
      routeChanges: 0,
      apiResponseTime: 0,
      renderTime: 0,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      deviceType: this.getDeviceType(),
      connectionType: this.getConnectionType(),
      region: this.getRegion(),
    };
  }

  // Get device type
  private getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    if (typeof navigator === 'undefined') return 'desktop';
    
    const userAgent = navigator.userAgent;
    if (/Mobile|Android|iPhone/.test(userAgent)) return 'mobile';
    if (/iPad|Tablet/.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  // Get connection type
  private getConnectionType(): string {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) return 'unknown';
    
    const connection = (navigator as any).connection;
    return connection?.effectiveType || 'unknown';
  }

  // Get region
  private getRegion(): string {
    // Try to get region from Vercel headers or other sources
    if (typeof window !== 'undefined') {
      const metaRegion = document.querySelector('meta[name="x-edge-region"]');
      if (metaRegion) return metaRegion.getAttribute('content') || 'unknown';
    }
    return 'unknown';
  }

  // Measure route performance
  private measureRoutePerformance(): void {
    const latestMetrics = this.metrics[this.metrics.length - 1] || this.createMetricsEntry();
    latestMetrics.routeChanges++;
    
    // Measure render time for new route
    const renderStart = performance.now();
    
    requestAnimationFrame(() => {
      const renderEnd = performance.now();
      latestMetrics.renderTime = renderEnd - renderStart;
      
      this.checkBudgetViolation('renderTime', latestMetrics.renderTime);
    });
  }

  // Get current metrics
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  // Get all violations
  getViolations(): BudgetViolation[] {
    return this.violations;
  }

  // Get performance score
  getPerformanceScore(): number {
    const latestMetrics = this.getCurrentMetrics();
    if (!latestMetrics) return 0;

    let score = 100;
    const violations = this.violations.filter(v => 
      Math.abs(Date.now() - v.threshold) < 300000 // Last 5 minutes
    );

    violations.forEach(violation => {
      if (violation.severity === 'critical') {
        score -= 20;
      } else if (violation.severity === 'warning') {
        score -= 10;
      }
    });

    return Math.max(0, score);
  }

  // Get performance report
  getPerformanceReport(): {
    score: number;
    metrics: PerformanceMetrics | null;
    violations: BudgetViolation[];
    recommendations: string[];
    summary: Record<string, any>;
  } {
    const currentMetrics = this.getCurrentMetrics();
    const currentViolations = this.violations.filter(v => 
      Math.abs(Date.now() - v.threshold) < 300000
    );

    const recommendations = Array.from(new Set(
      currentViolations.map(v => v.recommendation)
    ));

    const summary = {
      totalViolations: currentViolations.length,
      criticalViolations: currentViolations.filter(v => v.severity === 'critical').length,
      warningViolations: currentViolations.filter(v => v.severity === 'warning').length,
      resourceSize: Object.values(currentMetrics?.resourceSizes || {}).reduce((a, b) => a + b, 0),
      requestCount: currentMetrics?.requestCount || 0,
      blockingTime: currentMetrics?.blockingTime || 0,
    };

    return {
      score: this.getPerformanceScore(),
      metrics: currentMetrics,
      violations: currentViolations,
      recommendations,
      summary,
    };
  }

  // Clear metrics and violations
  clear(): void {
    this.metrics = [];
    this.violations = [];
  }

  // Export data for analysis
  exportData(): {
    metrics: PerformanceMetrics[];
    violations: BudgetViolation[];
    budgets: typeof PERFORMANCE_BUDGETS;
  } {
    return {
      metrics: this.metrics,
      violations: this.violations,
      budgets: PERFORMANCE_BUDGETS,
    };
  }
}

// Singleton instance
const performanceBudgetService = new PerformanceBudgetService();

// Export service
export const performanceBudget = {
  // Start monitoring
  startMonitoring(callback?: (violations: BudgetViolation[], metrics: PerformanceMetrics) => void) {
    return performanceBudgetService.startMonitoring(callback);
  },

  // Stop monitoring
  stopMonitoring() {
    return performanceBudgetService.stopMonitoring();
  },

  // Get current metrics
  getCurrentMetrics() {
    return performanceBudgetService.getCurrentMetrics();
  },

  // Get violations
  getViolations() {
    return performanceBudgetService.getViolations();
  },

  // Get performance score
  getPerformanceScore() {
    return performanceBudgetService.getPerformanceScore();
  },

  // Get performance report
  getPerformanceReport() {
    return performanceBudgetService.getPerformanceReport();
  },

  // Clear data
  clear() {
    return performanceBudgetService.clear();
  },

  // Export data
  exportData() {
    return performanceBudgetService.exportData();
  },
};

export default performanceBudget;