interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

interface CoreWebVital {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: string;
}

interface EdgeMetric {
  url: string;
  method: string;
  status: number;
  duration: number;
  size: number;
  cache: 'hit' | 'miss' | 'stale';
  region: string;
}

interface BundleMetric {
  name: string;
  size: number;
  gzippedSize: number;
  loadTime: number;
  type: 'js' | 'css' | 'asset';
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private coreWebVitals: CoreWebVital[] = [];
  private edgeMetrics: EdgeMetric[] = [];
  private bundleMetrics: BundleMetric[] = [];
  private isMonitoring = false;
  private sampleRate = 0.1; // 10% sampling rate

  private constructor() {
    this.initializeMonitoring();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Check sample rate
    if (Math.random() > this.sampleRate) return;

    this.isMonitoring = true;
    this.monitorCoreWebVitals();
    this.monitorEdgePerformance();
    this.monitorBundleLoading();
    this.monitorUserInteractions();
  }

  private async monitorCoreWebVitals(): Promise<void> {
    try {
      // Load web-vitals library dynamically
      const webVitals = await import('web-vitals');
      
      const recordMetric = (metric: any) => {
        const vital: CoreWebVital = {
          id: metric.id,
          name: metric.name,
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          navigationType: metric.navigationType || 'navigate'
        };
        
        this.coreWebVitals.push(vital);
        this.sendMetric('core-web-vital', vital);
      };

      webVitals.getCLS(recordMetric);
      webVitals.getFID(recordMetric);
      webVitals.getFCP(recordMetric);
      webVitals.getLCP(recordMetric);
      webVitals.getTTFB(recordMetric);
      
      // Also monitor INP if available
      if (webVitals.getINP) {
        webVitals.getINP(recordMetric);
      }
    } catch (error) {
      console.warn('Failed to load web-vitals:', error);
    }
  }

  private monitorEdgePerformance(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes('/api/') || entry.name.includes('/edge/')) {
          const resource = entry as PerformanceResourceTiming;
          
          const edgeMetric: EdgeMetric = {
            url: entry.name,
            method: 'GET', // Default, could be enhanced with custom headers
            status: 200, // Would need to be captured from fetch
            duration: resource.duration,
            size: resource.transferSize || 0,
            cache: this.getCacheStatus(resource),
            region: this.detectEdgeRegion()
          };
          
          this.edgeMetrics.push(edgeMetric);
          this.sendMetric('edge-performance', edgeMetric);
        }
      }
    });

    observer.observe({ entryTypes: ['resource'] });
  }

  private monitorBundleLoading(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resource = entry as PerformanceResourceTiming;
        
        if (resource.name.includes('.js') || resource.name.includes('.css')) {
          const bundleMetric: BundleMetric = {
            name: resource.name.split('/').pop() || 'unknown',
            size: resource.transferSize || 0,
            gzippedSize: resource.encodedBodySize || 0,
            loadTime: resource.duration,
            type: resource.name.includes('.js') ? 'js' : 'css'
          };
          
          this.bundleMetrics.push(bundleMetric);
          this.sendMetric('bundle-loading', bundleMetric);
        }
      }
    });

    observer.observe({ entryTypes: ['resource'] });
  }

  private monitorUserInteractions(): void {
    // Monitor First Input Delay (already covered by web-vitals)
    // Monitor Largest Contentful Paint (already covered by web-vitals)
    // Monitor Cumulative Layout Shift (already covered by web-vitals)
    
    // Additional custom metrics
    this.monitorTimeToInteractive();
    this.monitorRouteChanges();
  }

  private monitorTimeToInteractive(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
          const tti = this.calculateTimeToInteractive(entry.startTime);
          this.sendMetric('time-to-interactive', { value: tti });
        }
      }
    });

    observer.observe({ entryTypes: ['paint'] });
  }

  private monitorRouteChanges(): void {
    // Monitor client-side route changes
    let lastNavigationStart = performance.timing.navigationStart;
    
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    const recordRouteChange = () => {
      const now = performance.now();
      const routeChangeTime = now - lastNavigationStart;
      this.sendMetric('route-change', { value: routeChangeTime });
      lastNavigationStart = now;
    };
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(recordRouteChange, 0);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(recordRouteChange, 0);
    };
    
    window.addEventListener('popstate', recordRouteChange);
  }

  private getCacheStatus(resource: PerformanceResourceTiming): 'hit' | 'miss' | 'stale' {
    const transferSize = resource.transferSize;
    const encodedSize = resource.encodedBodySize;
    
    if (transferSize === 0 && encodedSize > 0) return 'hit';
    if (transferSize === encodedSize) return 'miss';
    return 'stale';
  }

  private detectEdgeRegion(): string {
    // Try to detect edge region from response headers or timing
    // This is a simplified implementation
    const headers = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    // In a real implementation, you'd parse response headers
    // For now, return a default or try to infer from timing
    const avgResponseTime = headers.responseEnd - headers.requestStart;
    
    if (avgResponseTime < 100) return 'nearest';
    if (avgResponseTime < 300) return 'regional';
    return 'origin';
  }

  private calculateTimeToInteractive(fcpTime: number): number {
    // Simplified TTI calculation
    // In a real implementation, you'd monitor long tasks
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return Math.max(fcpTime, navigation.loadEventEnd - navigation.fetchStart);
  }

  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.isMonitoring) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push(metric);
    
    // Keep only last 100 metrics per type
    const metrics = this.metrics.get(name)!;
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }

    this.sendMetric(name, metric);
  }

  private async sendMetric(name: string, data: any): Promise<void> {
    try {
      // Send to edge metrics endpoint
      if (process.env.ENABLE_EDGE_METRICS === 'true') {
        const endpoint = process.env.EDGE_METRICS_ENDPOINT || '/api/edge-metrics';
        
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            data,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href
          })
        });
      }
    } catch (error) {
      // Silently fail to not impact user experience
      console.debug('Failed to send metric:', error);
    }
  }

  // Public API methods
  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.get(name) || [];
    }
    
    const allMetrics: PerformanceMetric[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }
    return allMetrics;
  }

  getCoreWebVitals(): CoreWebVital[] {
    return [...this.coreWebVitals];
  }

  getEdgeMetrics(): EdgeMetric[] {
    return [...this.edgeMetrics];
  }

  getBundleMetrics(): BundleMetric[] {
    return [...this.bundleMetrics];
  }

  getPerformanceSummary(): {
    coreWebVitals: Partial<CoreWebVital>;
    edgePerformance: {
      averageResponseTime: number;
      cacheHitRate: number;
      totalRequests: number;
    };
    bundlePerformance: {
      totalSize: number;
      totalGzippedSize: number;
      averageLoadTime: number;
    };
  } {
    const latestVitals = this.coreWebVitals[this.coreWebVitals.length - 1] || {};
    
    const edgeMetrics = this.edgeMetrics;
    const totalRequests = edgeMetrics.length;
    const averageResponseTime = totalRequests > 0 
      ? edgeMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests 
      : 0;
    const cacheHits = edgeMetrics.filter(m => m.cache === 'hit').length;
    const cacheHitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;
    
    const bundleMetrics = this.bundleMetrics;
    const totalSize = bundleMetrics.reduce((sum, m) => sum + m.size, 0);
    const totalGzippedSize = bundleMetrics.reduce((sum, m) => sum + m.gzippedSize, 0);
    const averageLoadTime = bundleMetrics.length > 0 
      ? bundleMetrics.reduce((sum, m) => sum + m.loadTime, 0) / bundleMetrics.length 
      : 0;

    return {
      coreWebVitals: {
        name: latestVitals.name,
        value: latestVitals.value,
        rating: latestVitals.rating
      },
      edgePerformance: {
        averageResponseTime,
        cacheHitRate,
        totalRequests
      },
      bundlePerformance: {
        totalSize,
        totalGzippedSize,
        averageLoadTime
      }
    };
  }

  clearMetrics(): void {
    this.metrics.clear();
    this.coreWebVitals = [];
    this.edgeMetrics = [];
    this.bundleMetrics = [];
  }

  setSampleRate(rate: number): void {
    this.sampleRate = Math.max(0, Math.min(1, rate));
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// Export convenience functions
export const recordMetric = (name: string, value: number, tags?: Record<string, string>) => {
  performanceMonitor.recordMetric(name, value, tags);
};

export const getPerformanceSummary = () => {
  return performanceMonitor.getPerformanceSummary();
};