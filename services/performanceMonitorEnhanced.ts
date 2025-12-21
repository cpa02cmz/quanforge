interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface CoreWebVital {
  id: string;
  name: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: string;
}

export class PerformanceMonitorEnhanced {
  private static instance: PerformanceMonitorEnhanced;
  private metrics: PerformanceMetric[] = [];
  private coreWebVitals: CoreWebVital[] = [];
  private edgeMetrics: PerformanceMetric[] = [];

  private constructor() {
    this.initializeMonitoring();
  }

  static getInstance(): PerformanceMonitorEnhanced {
    if (!PerformanceMonitorEnhanced.instance) {
      PerformanceMonitorEnhanced.instance = new PerformanceMonitorEnhanced();
    }
    return PerformanceMonitorEnhanced.instance;
  }

  private initializeMonitoring(): void {
    if (typeof window !== 'undefined') {
      this.observePerformanceMetrics();
      this.observeCoreWebVitals();
      this.monitorEdgePerformance();
    }
  }

  private observePerformanceMetrics(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            const metric: PerformanceMetric = {
              id: crypto.randomUUID(),
              name: 'page-load',
              value: navEntry.loadEventEnd - navEntry.startTime,
              timestamp: Date.now(),
              metadata: {
                domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
                firstPaint: navEntry.loadEventEnd - navEntry.startTime,
                transferSize: navEntry.transferSize
              }
            };
            this.metrics.push(metric);
          }
        }
      });

      observer.observe({ entryTypes: ['navigation'] });
    } catch (error) {
      console.error('Failed to initialize performance monitoring:', error);
    }
  }

  private observeCoreWebVitals(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            const vital: CoreWebVital = {
              id: crypto.randomUUID(),
              name: 'LCP',
              value: entry.startTime,
              rating: entry.startTime < 2500 ? 'good' : entry.startTime < 4000 ? 'needs-improvement' : 'poor',
              delta: 0,
              navigationType: 'navigation'
            };
            this.coreWebVitals.push(vital);
          }
        }
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      console.error('Failed to initialize Core Web Vitals monitoring:', error);
    }
  }

  private monitorEdgePerformance(): void {
    try {
      // Monitor edge-specific metrics
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.includes('edge') || entry.name.includes('cdn')) {
            const edgeMetric: PerformanceMetric = {
              id: crypto.randomUUID(),
              name: 'edge-response',
              value: entry.duration,
              timestamp: Date.now(),
              metadata: {
                url: entry.name,
                size: (entry as any).transferSize,
                cached: (entry as any).transferSize === 0
              }
            };
            this.edgeMetrics.push(edgeMetric);
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });
    } catch (error) {
      console.error('Failed to initialize edge performance monitoring:', error);
    }
  }

  public recordCustomMetric(
    name: string,
    value: number,
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      id: crypto.randomUUID(),
      name,
      value,
      timestamp: Date.now(),
      metadata
    };
    this.metrics.push(metric);
  }

  public sendMetric(name: string, data: PerformanceMetric | CoreWebVital): void {
    // Send to analytics service or monitoring system
    try {
      const payload = {
        metric: name,
        data,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        url: typeof window !== 'undefined' ? window.location.href : 'server',
        timestamp: Date.now()
      };

      // In a real implementation, this would send to your monitoring service
      if (typeof window !== 'undefined' && window.navigator.sendBeacon) {
        window.navigator.sendBeacon('/api/metrics', JSON.stringify(payload));
      }
    } catch (error) {
      console.error('Failed to send metric:', error);
    }
  }

  public getMetrics(): {
    general: PerformanceMetric[];
    coreWebVitals: CoreWebVital[];
    edgeMetrics: PerformanceMetric[];
  } {
    return {
      general: [...this.metrics],
      coreWebVitals: [...this.coreWebVitals],
      edgeMetrics: [...this.edgeMetrics]
    };
  }

  public getPerformanceReport(): {
    pageLoadTime: number;
    lcp: number | null;
    fid: number | null;
    cls: number | null;
    edgePerformance: {
      averageResponseTime: number;
      cacheHitRate: number;
      totalRequests: number;
    };
  } {
    const pageLoadMetrics = this.metrics.filter(m => m.name === 'page-load');
    const avgPageLoadTime = pageLoadMetrics.length > 0 
      ? pageLoadMetrics.reduce((sum, m) => sum + m.value, 0) / pageLoadMetrics.length 
      : 0;

    const lcp = this.coreWebVitals.find(v => v.name === 'LCP')?.value || null;
    const fid = this.coreWebVitals.find(v => v.name === 'FID')?.value || null;
    const cls = this.coreWebVitals.find(v => v.name === 'CLS')?.value || null;

    const edgePerformance = this.calculateEdgePerformance();

    return {
      pageLoadTime: avgPageLoadTime,
      lcp,
      fid,
      cls,
      edgePerformance
    };
  }

  private calculateEdgePerformance(): {
    averageResponseTime: number;
    cacheHitRate: number;
    totalRequests: number;
  } {
    if (this.edgeMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        cacheHitRate: 0,
        totalRequests: 0
      };
    }

    const avgResponseTime = this.edgeMetrics.reduce((sum, m) => sum + m.value, 0) / this.edgeMetrics.length;
    const cachedRequests = this.edgeMetrics.filter(m => m.metadata?.['cached']).length;
    const cacheHitRate = (cachedRequests / this.edgeMetrics.length) * 100;

    return {
      averageResponseTime: avgResponseTime,
      cacheHitRate,
      totalRequests: this.edgeMetrics.length
    };
  }

  public clearMetrics(): void {
    this.metrics = [];
    this.coreWebVitals = [];
    this.edgeMetrics = [];
  }

  public exportMetrics(): string {
    const data = {
      timestamp: Date.now(),
      metrics: this.metrics,
      coreWebVitals: this.coreWebVitals,
      edgeMetrics: this.edgeMetrics,
      report: this.getPerformanceReport()
    };
    return JSON.stringify(data, null, 2);
  }
}

export const performanceMonitor = PerformanceMonitorEnhanced.getInstance();
export default PerformanceMonitorEnhanced;