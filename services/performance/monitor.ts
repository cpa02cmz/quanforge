/**
 * Consolidated Performance Monitoring Service
 * Merges functionality from: performanceMonitorEnhanced, realTimeMonitoring, frontendPerformanceOptimizer, realUserMonitoring
 * Provides unified performance monitoring, metrics collection, and optimization
 */

import { handleErrorCompat as handleError } from '../../utils/errorManager';
import { globalCache } from '../unifiedCacheManager';
import { ARRAY_LIMITS } from '../constants';
import { HTTP_CONSTANTS } from '../modularConstants';

// Unified performance interfaces
export interface CoreWebVital {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface EdgeMetric {
  url: string;
  method: string;
  status: number;
  duration: number;
  size: number;
  cache: 'hit' | 'miss' | 'stale';
  region: string;
}

export interface PerformanceMetrics {
  timestamp: number;
  url: string;
  userAgent: string;
  connection: string;
  vitals: {
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
    fcp: number; // First Contentful Paint
    ttfb: number; // Time to First Byte
  };
  resources: PerformanceResourceTiming[];
  memory?: any;
  navigation: PerformanceNavigationTiming;
}

export interface PerformanceBudget {
  bundleSize: number;
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  ttfb: number;
}

export interface EdgePerformanceMetrics {
  coldStartMetrics: {
    frequency: number;
    averageDuration: number;
    regions: Record<string, number>;
  };
  cacheHitRate: number;
  averageResponseTime: number;
  errorRate: number;
  regionMetrics: Record<string, {
    avgResponseTime: number;
    requestCount: number;
    errorRate: number;
  }>;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private webVitals: CoreWebVital[] = [];
  private edgeMetrics: EdgeMetric[] = [];
  private budgets: PerformanceBudget;
  private observers: PerformanceObserver[] = [];
  private isMonitoring = false;

  private constructor() {
    this.budgets = {
      bundleSize: 250000, // 250KB
      lcp: 2500,
      fid: 100,
      cls: 0.1,
      fcp: 1800,
      ttfb: 800
    };
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startMonitoring(): void {
    if (this.isMonitoring || typeof window === 'undefined') return;

    this.isMonitoring = true;
    
    // Observe Core Web Vitals
    this.observeWebVitals();
    
    // Observe resource timing
    this.observeResources();
    
    // Observe navigation timing
    this.observeNavigation();
    
    // Start edge metrics collection
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => this.collectInitialMetrics());
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  private observeWebVitals(): void {
    try {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.recordWebVital('LCP', lastEntry.startTime, lastEntry);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.recordWebVital('FID', entry.processingStart - entry.startTime, entry);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.recordWebVital('CLS', clsValue, entry);
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch (error: unknown) {
      handleError(error as Error, 'observeWebVitals');
    }
  }

  private observeResources(): void {
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.recordResourceMetric(entry as PerformanceResourceTiming);
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    } catch (error: unknown) {
      handleError(error as Error, 'observeResources');
    }
  }

  private observeNavigation(): void {
    try {
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.recordNavigationMetric(entry as PerformanceNavigationTiming);
        });
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);
    } catch (error: unknown) {
      handleError(error as Error, 'observeNavigation');
    }
  }

  private recordWebVital(name: string, value: number, entry: any): void {
    const rating = this.getVitalRating(name, value);
    const webVital: CoreWebVital = {
      id: `${name}-${Date.now()}`,
      name,
      value,
      rating,
      delta: value - this.getPreviousVitalValue(name),
      navigationType: entry?.navigationType || 'unknown'
    };
    
    this.webVitals.push(webVital);
    this.cacheMetric(`web-vital-${name}`, webVital);
  }

  private recordResourceMetric(entry: PerformanceResourceTiming): void {
    const metric: PerformanceMetric = {
      name: 'resource',
      value: entry.duration,
      timestamp: Date.now(),
      tags: {
        url: entry.name,
        type: this.getResourceType(entry.name),
        size: entry.transferSize?.toString() || '0'
      }
    };
    
    this.addMetric('resources', metric);
    this.checkResourceBudget(entry);
  }

  private recordNavigationMetric(entry: PerformanceNavigationTiming): void {
    const vitals = {
      lcp: 0, // Will be filled by LCP observer
      fid: 0, // Will be filled by FID observer
      cls: 0, // Will be filled by CLS observer
      fcp: entry.responseStart - entry.requestStart,
      ttfb: entry.responseStart - entry.requestStart
    };

    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection: this.getConnectionType(),
      vitals,
      resources: [],
      memory: this.getMemoryInfo(),
      navigation: entry
    };

    this.cacheMetric('navigation', metrics);
  }

  private recordEdgeMetric(metric: EdgeMetric): void {
    this.edgeMetrics.push(metric);

    // Keep only last N edge metrics
    if (this.edgeMetrics.length > ARRAY_LIMITS.METRICS_LARGE) {
      this.edgeMetrics = this.edgeMetrics.slice(-ARRAY_LIMITS.METRICS_LARGE);
    }

    this.cacheMetric('edge', metric);
  }

  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags
    };
    
    this.addMetric(name, metric);
  }

  private addMetric(category: string, metric: PerformanceMetric): void {
    if (!this.metrics.has(category)) {
      this.metrics.set(category, []);
    }
    
    const categoryMetrics = this.metrics.get(category)!;
    categoryMetrics.push(metric);
    
    // Keep only last 100 metrics per category
    if (categoryMetrics.length > 100) {
      categoryMetrics.splice(0, categoryMetrics.length - 100);
    }
  }

  private cacheMetric(key: string, data: any): void {
    try {
      globalCache.set(`perf:${key}`, data, 60000); // Cache for 1 minute
    } catch (_error) {
      // Ignore cache errors
    }
  }

  getMetrics(): {
    webVitals: CoreWebVital[];
    resources: PerformanceMetric[];
    navigation: PerformanceMetrics[];
    edge: EdgeMetric[];
    custom: Record<string, PerformanceMetric[]>;
  } {
    // Get navigation metrics from cache or create empty array
    const navigationMetrics: PerformanceMetrics[] = [];
    
    return {
      webVitals: [...this.webVitals],
      resources: this.metrics.get('resources') || [],
      navigation: navigationMetrics,
      edge: [...this.edgeMetrics],
      custom: Object.fromEntries(this.metrics.entries())
    };
  }

  getPerformanceScore(): {
    overall: number;
    breakdown: {
      lcp: number;
      fid: number;
      cls: number;
      fcp: number;
      ttfb: number;
    };
    recommendations: string[];
  } {
    const latestVitals = this.getLatestWebVitals();
    const breakdown = {
      lcp: this.calculateVitalScore('LCP', latestVitals['lcp']),
      fid: this.calculateVitalScore('FID', latestVitals['fid']),
      cls: this.calculateVitalScore('CLS', latestVitals['cls']),
      fcp: this.calculateVitalScore('FCP', latestVitals['fcp']),
      ttfb: this.calculateVitalScore('TTFB', latestVitals['ttfb'])
    };
    
    const overall = Object.values(breakdown).reduce((sum, score) => sum + score, 0) / Object.keys(breakdown).length;
    const recommendations = this.generateRecommendations(breakdown);
    
    return { overall, breakdown, recommendations };
  }

  getEdgeMetrics(): EdgePerformanceMetrics {
    const recentMetrics = this.edgeMetrics.slice(-ARRAY_LIMITS.METRICS_STANDARD);
    const coldStarts = recentMetrics.filter(m => m.duration > 1000);
    const errors = recentMetrics.filter(m => m.status >= HTTP_CONSTANTS.BAD_REQUEST);
    
    // Calculate region metrics
    const regionMetrics: Record<string, any> = {};
    recentMetrics.forEach(metric => {
      if (!regionMetrics[metric.region]) {
        regionMetrics[metric.region] = { totalTime: 0, count: 0, errorCount: 0 };
      }
      regionMetrics[metric.region].totalTime += metric.duration;
      regionMetrics[metric.region].count++;
      if (metric.status >= HTTP_CONSTANTS.BAD_REQUEST) regionMetrics[metric.region].errorCount++;
    });
    
    Object.keys(regionMetrics).forEach(region => {
      const data = regionMetrics[region];
      regionMetrics[region] = {
        avgResponseTime: data.totalTime / data.count,
        requestCount: data.count,
        errorRate: (data.errorCount / data.count) * 100
      };
    });
    
    return {
      coldStartMetrics: {
        frequency: coldStarts.length / recentMetrics.length || 0,
        averageDuration: coldStarts.reduce((sum, m) => sum + m.duration, 0) / coldStarts.length || 0,
        regions: coldStarts.reduce((acc, m) => {
          acc[m.region] = (acc[m.region] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      cacheHitRate: this.calculateCacheHitRate(),
      averageResponseTime: recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length || 0,
      errorRate: (errors.length / recentMetrics.length) * 100 || 0,
      regionMetrics
    };
  }

  private getLatestWebVitals(): { [key: string]: number } {
    const latest: { [key: string]: number } = {};
    ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].forEach(name => {
      const vital = this.webVitals.filter(v => v.name === name).pop();
      latest[name.toLowerCase()] = vital?.value || 0;
    });
    return latest;
  }

  private calculateVitalScore(name: string, value: number): number {
    const thresholds: { [key: string]: { good: number; poor: number } } = {
      'LCP': { good: 2500, poor: 4000 },
      'FID': { good: 100, poor: 300 },
      'CLS': { good: 0.1, poor: 0.25 },
      'FCP': { good: 1800, poor: 3000 },
      'TTFB': { good: 800, poor: 1800 }
    };
    
    const threshold = thresholds[name];
    if (!threshold) return 50;
    
    if (value <= threshold.good) return 100;
    if (value >= threshold.poor) return 0;
    
    // Linear interpolation between good and poor
    const ratio = (value - threshold.good) / (threshold.poor - threshold.good);
    return Math.round(100 - (ratio * 100));
  }

  private generateRecommendations(breakdown: { [key: string]: number }): string[] {
    const recommendations: string[] = [];
    
    if (breakdown['lcp'] < 70) recommendations.push('Optimize Largest Contentful Paint by optimizing images and server response time');
    if (breakdown['fid'] < 70) recommendations.push('Reduce First Input Delay by minimizing JavaScript execution time');
    if (breakdown['cls'] < 70) recommendations.push('Improve Cumulative Layout Shift by properly sizing images and avoiding layout shifts');
    if (breakdown['fcp'] < 70) recommendations.push('Optimize First Contentful Paint by reducing server response time and render-blocking resources');
    if (breakdown['ttfb'] < 70) recommendations.push('Improve Time to First Byte by optimizing server performance and using CDN');
    
    return recommendations;
  }

  private collectInitialMetrics(): void {
    // Collect initial page load metrics
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0) {
        this.recordNavigationMetric(navEntries[0] as PerformanceNavigationTiming);
      }
    }
  }

  private getVitalRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const score = this.calculateVitalScore(name, value);
    if (score >= 80) return 'good';
    if (score >= 50) return 'needs-improvement';
    return 'poor';
  }

  private getPreviousVitalValue(name: string): number {
    const vital = this.webVitals.filter(v => v.name === name).slice(-2)[0];
    return vital?.value || 0;
  }

  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const scriptTypes = ['js', 'mjs'];
    const styleTypes = ['css'];
    
    if (imageTypes.includes(extension || '')) return 'image';
    if (scriptTypes.includes(extension || '')) return 'script';
    if (styleTypes.includes(extension || '')) return 'stylesheet';
    return 'other';
  }

  private getConnectionType(): string {
    return (navigator as any).connection?.effectiveType || 'unknown';
  }

  private getMemoryInfo(): any {
    return (performance as any).memory || {};
  }

  private checkResourceBudget(entry: PerformanceResourceTiming): void {
    if (entry.transferSize && entry.transferSize > 50000) { // 50KB
      // Large resource detected
    }
  }

  private calculateCacheHitRate(): number {
    const hits = this.edgeMetrics.filter(m => m.cache === 'hit').length;
    return hits / this.edgeMetrics.length || 0;
  }

// Optimization methods
  optimizeBundleSize(): void {
    // Trigger bundle optimization suggestions
    this.analyzeBundleSize();
  }

  private analyzeBundleSize(): void {
    // Bundle analysis results available via getMetrics()    
  }

  resetMetrics(): void {
    this.metrics.clear();
    this.webVitals = [];
    this.edgeMetrics = [];
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Legacy compatibility exports
export const realTimeMonitoring = performanceMonitor;
export default performanceMonitor;

// Auto-start in browser environment
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    performanceMonitor.startMonitoring();
  } else {
    window.addEventListener('load', () => {
      performanceMonitor.startMonitoring();
    });
  }
}