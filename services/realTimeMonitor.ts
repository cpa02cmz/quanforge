interface PerformanceMetrics {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
  domContentLoaded: number;
  loadComplete: number;
  memoryUsage?: number;
  connectionType?: string;
  deviceType?: string;
  userAgent?: string;
  timestamp: number;
  url: string;
}

interface ErrorMetrics {
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId: string;
}

interface PerformanceBudget {
  lcp: number; // 2.5s
  fid: number; // 100ms
  cls: number; // 0.1
  fcp: number; // 1.8s
  ttfb: number; // 800ms
  bundleSize: number; // 250KB
}

interface AlertConfig {
  enabled: boolean;
  thresholds: {
    buildTime: number;
    errorRate: number;
    responseTime: number;
    cacheHitRate: number;
  };
  webhookUrl?: string;
  emails?: string[];
}

export class RealTimeMonitor {
  private metrics: PerformanceMetrics[] = [];
  private errors: ErrorMetrics[] = [];
  private observers: PerformanceObserver[] = [];
  private sessionId: string;
  private userId?: string;
  private config: AlertConfig;
  private budget: PerformanceBudget;
  private isMonitoring = false;
  private reportingEndpoint?: string;
  private reportInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<AlertConfig>) {
    this.sessionId = this.generateSessionId();
    this.config = {
      enabled: true,
      thresholds: {
        buildTime: 10000, // 10 seconds
        errorRate: 1, // 1%
        responseTime: 500, // 500ms
        cacheHitRate: 80 // 80%
      },
      ...config
    };

    this.budget = {
      lcp: 2500,
      fid: 100,
      cls: 0.1,
      fcp: 1800,
      ttfb: 800,
      bundleSize: 256000 // 250KB
    };

    // Initialize reporting endpoint for production
    this.reportingEndpoint = process.env.NODE_ENV === 'production' 
      ? '/api/performance-metrics' 
      : undefined;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public startMonitoring(userId?: string): void {
    if (this.isMonitoring || !this.config.enabled) return;

    this.userId = userId;
    this.isMonitoring = true;

    // Monitor Core Web Vitals
    this.monitorCoreWebVitals();
    
    // Monitor errors
    this.trackErrors();
    
    // Monitor resource performance
    this.monitorResourcePerformance();
    
    // Monitor navigation timing
    this.monitorNavigationTiming();
    
    // Start periodic reporting
    this.startPeriodicReporting();

    console.log('🔍 Real-time performance monitoring started');
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }

    this.isMonitoring = false;
    console.log('⏹️ Performance monitoring stopped');
  }

  private monitorCoreWebVitals(): void {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      this.recordMetric({
        lcp: lastEntry.startTime,
        fid: 0,
        cls: 0,
        fcp: 0,
        ttfb: 0,
        domContentLoaded: 0,
        loadComplete: 0,
        timestamp: Date.now(),
        url: window.location.href,
        deviceType: this.getDeviceType(),
        connectionType: this.getConnectionType(),
        userAgent: navigator.userAgent
      });

      // Check budget
      if (lastEntry.startTime > this.budget.lcp) {
        this.triggerAlert('LCP', lastEntry.startTime, this.budget.lcp);
      }
    });

    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    this.observers.push(lcpObserver);

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        this.recordMetric({
          lcp: 0,
          fid: entry.processingStart - entry.startTime,
          cls: 0,
          fcp: 0,
          ttfb: 0,
          domContentLoaded: 0,
          loadComplete: 0,
          timestamp: Date.now(),
          url: window.location.href,
          deviceType: this.getDeviceType(),
          connectionType: this.getConnectionType(),
          userAgent: navigator.userAgent
        });

        if (entry.processingStart - entry.startTime > this.budget.fid) {
          this.triggerAlert('FID', entry.processingStart - entry.startTime, this.budget.fid);
        }
      });
    });

    fidObserver.observe({ entryTypes: ['first-input'] });
    this.observers.push(fidObserver);

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          
          this.recordMetric({
            lcp: 0,
            fid: 0,
            cls: clsValue,
            fcp: 0,
            ttfb: 0,
            domContentLoaded: 0,
            loadComplete: 0,
            timestamp: Date.now(),
            url: window.location.href,
            deviceType: this.getDeviceType(),
            connectionType: this.getConnectionType(),
            userAgent: navigator.userAgent
          });

          if (clsValue > this.budget.cls) {
            this.triggerAlert('CLS', clsValue, this.budget.cls);
          }
        }
      });
    });

    clsObserver.observe({ entryTypes: ['layout-shift'] });
    this.observers.push(clsObserver);
  }

  private trackErrors(): void {
    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.recordError({
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: this.userId,
        sessionId: this.sessionId
      });
    });

    // Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: this.userId,
        sessionId: this.sessionId
      });
    });
  }

  private monitorResourcePerformance(): void {
    const resourceObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming;
          
          // Check for slow resources
          if (resource.duration > this.config.thresholds.responseTime) {
            this.triggerAlert('Resource Load Time', resource.duration, this.config.thresholds.responseTime, {
              name: resource.name,
              type: this.getResourceType(resource.name)
            });
          }
        }
      });
    });

    resourceObserver.observe({ entryTypes: ['resource'] });
    this.observers.push(resourceObserver);
  }

  private monitorNavigationTiming(): void {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      this.recordMetric({
        lcp: 0,
        fid: 0,
        cls: 0,
        fcp: navigation.responseStart - navigation.requestStart,
        ttfb: navigation.responseStart - navigation.requestStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        timestamp: Date.now(),
        url: window.location.href,
        deviceType: this.getDeviceType(),
        connectionType: this.getConnectionType(),
        userAgent: navigator.userAgent
      });

      // Check navigation budgets
      if (navigation.domContentLoadedEventEnd - navigation.navigationStart > 3000) {
        this.triggerAlert('DOM Content Loaded', 
          navigation.domContentLoadedEventEnd - navigation.navigationStart, 3000);
      }
    });
  }

  private recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Keep only last 100 metrics to prevent memory issues
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Send to reporting endpoint if available
    if (this.reportingEndpoint) {
      this.sendMetric(metric);
    }
  }

  private recordError(error: ErrorMetrics): void {
    this.errors.push(error);
    
    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }

    // Send to reporting endpoint if available
    if (this.reportingEndpoint) {
      this.sendError(error);
    }

    // Check error rate
    this.checkErrorRate();
  }

  private async sendMetric(metric: PerformanceMetrics): Promise<void> {
    if (!this.reportingEndpoint) return;

    try {
      await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'metric', data: metric })
      });
    } catch (error) {
      console.warn('Failed to send performance metric:', error);
    }
  }

  private async sendError(error: ErrorMetrics): Promise<void> {
    if (!this.reportingEndpoint) return;

    try {
      await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'error', data: error })
      });
    } catch (error) {
      console.warn('Failed to send error metric:', error);
    }
  }

  private startPeriodicReporting(): void {
    this.reportInterval = setInterval(() => {
      this.generatePerformanceReport();
    }, 60000); // Report every minute
  }

  private generatePerformanceReport(): void {
    const report = {
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: Date.now(),
      metrics: {
        totalMetrics: this.metrics.length,
        totalErrors: this.errors.length,
        averageLCP: this.calculateAverage('lcp'),
        averageFID: this.calculateAverage('fid'),
        averageCLS: this.calculateAverage('cls'),
        averageFCP: this.calculateAverage('fcp'),
        averageTTFB: this.calculateAverage('ttfb'),
        errorRate: this.calculateErrorRate(),
        deviceBreakdown: this.getDeviceBreakdown(),
        connectionBreakdown: this.getConnectionBreakdown()
      }
    };

    console.log('📊 Performance Report:', report);
    
    // Send report to analytics
    if (this.reportingEndpoint) {
      this.sendReport(report);
    }
  }

  private async sendReport(report: any): Promise<void> {
    if (!this.reportingEndpoint) return;

    try {
      await fetch(`${this.reportingEndpoint}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report)
      });
    } catch (error) {
      console.warn('Failed to send performance report:', error);
    }
  }

  private calculateAverage(metric: keyof PerformanceMetrics): number {
    if (this.metrics.length === 0) return 0;
    
    const sum = this.metrics.reduce((acc, m) => acc + (m[metric] as number || 0), 0);
    return Math.round(sum / this.metrics.length);
  }

  private calculateErrorRate(): number {
    const timeWindow = 60000; // 1 minute
    const now = Date.now();
    const recentErrors = this.errors.filter(e => now - e.timestamp < timeWindow);
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < timeWindow);
    
    if (recentMetrics.length === 0) return 0;
    return Math.round((recentErrors.length / recentMetrics.length) * 100);
  }

  private getDeviceBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    this.metrics.forEach(metric => {
      const device = metric.deviceType || 'unknown';
      breakdown[device] = (breakdown[device] || 0) + 1;
    });

    return breakdown;
  }

  private getConnectionBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    this.metrics.forEach(metric => {
      const connection = metric.connectionType || 'unknown';
      breakdown[connection] = (breakdown[connection] || 0) + 1;
    });

    return breakdown;
  }

  private triggerAlert(metric: string, value: number, threshold: number, context?: any): void {
    const alert = {
      type: 'performance_budget_violation',
      metric,
      value,
      threshold,
      timestamp: Date.now(),
      url: window.location.href,
      sessionId: this.sessionId,
      userId: this.userId,
      context
    };

    console.warn(`🚨 Performance Alert: ${metric} (${value}) exceeded threshold (${threshold})`, alert);

    // Send alert if configured
    if (this.config.webhookUrl) {
      this.sendAlert(alert);
    }
  }

  private async sendAlert(alert: any): Promise<void> {
    if (!this.config.webhookUrl) return;

    try {
      await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.warn('Failed to send alert:', error);
    }
  }

  private checkErrorRate(): void {
    const errorRate = this.calculateErrorRate();
    
    if (errorRate > this.config.thresholds.errorRate) {
      this.triggerAlert('Error Rate', errorRate, this.config.thresholds.errorRate);
    }
  }

  private getDeviceType(): string {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private getConnectionType(): string {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return connection?.effectiveType || 'unknown';
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    return 'other';
  }

  // Public API for getting current metrics
  public getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  public getErrors(): ErrorMetrics[] {
    return [...this.errors];
  }

  public getCurrentPerformanceReport(): any {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: Date.now(),
      metrics: {
        totalMetrics: this.metrics.length,
        totalErrors: this.errors.length,
        averageLCP: this.calculateAverage('lcp'),
        averageFID: this.calculateAverage('fid'),
        averageCLS: this.calculateAverage('cls'),
        averageFCP: this.calculateAverage('fcp'),
        averageTTFB: this.calculateAverage('ttfb'),
        errorRate: this.calculateErrorRate(),
        deviceBreakdown: this.getDeviceBreakdown(),
        connectionBreakdown: this.getConnectionBreakdown()
      }
    };
  }

  public enforcePerformanceBudget(): void {
    // Check bundle size
    const bundleSize = this.calculateBundleSize();
    if (bundleSize > this.budget.bundleSize) {
      this.triggerAlert('Bundle Size', bundleSize, this.budget.bundleSize);
    }

    // Check other budgets
    const latestMetrics = this.metrics.slice(-10);
    latestMetrics.forEach(metric => {
      Object.entries(this.budget).forEach(([key, threshold]) => {
        const value = metric[key as keyof PerformanceMetrics] as number;
        if (value > threshold) {
          this.triggerAlert(key.toUpperCase(), value, threshold);
        }
      });
    });
  }

  private calculateBundleSize(): number {
    // This would typically be calculated during build time
    // For runtime, we can estimate based on loaded resources
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return resources.reduce((total, resource) => total + (resource.transferSize || 0), 0);
  }
}

// Singleton instance
export const performanceMonitor = new RealTimeMonitor();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  performanceMonitor.startMonitoring();
}