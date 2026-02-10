/**
 * Edge Performance Metrics Service
 * Monitors Vercel Edge performance and CDN metrics
 */

import { EDGE_METRICS, SCORE_CALCULATION, CACHE_TTLS, TIME_CONSTANTS } from '../constants';

interface EdgeMetrics {
  region: string;
  responseTime: number;
  cacheHitRate: number;
  throughput: number;
  errorRate: number;
  timestamp: number;
}

interface CDNMetrics {
  edgeRegion: string;
  cacheStatus: 'hit' | 'miss' | 'stale' | 'revalidated';
  responseSize: number;
  ttl: number;
  timestamp: number;
}

interface PerformanceThresholds {
  maxResponseTime: number;
  minCacheHitRate: number;
  maxErrorRate: number;
  minThroughput: number;
}

class EdgeMetricsCollector {
  private metrics: EdgeMetrics[] = [];
  private cdnMetrics: CDNMetrics[] = [];
  private readonly maxMetricsSize = EDGE_METRICS.MAX_METRICS_SIZE;
  private readonly thresholds: PerformanceThresholds = {
    maxResponseTime: 500, // ms
    minCacheHitRate: 0.8, // 80%
    maxErrorRate: 0.01, // 1%
    minThroughput: 100 // requests per minute
  };

  constructor() {
    this.initializeEdgeDetection();
    this.startPeriodicCleanup();
  }

  private initializeEdgeDetection(): void {
    // Detect edge region from request headers or navigator
    if (typeof window !== 'undefined') {
      this.detectEdgeRegion();
    }
  }

  private async detectEdgeRegion(): Promise<void> {
    try {
      // Use a simple latency test to detect nearest edge region
      // Note: Using a static asset instead of non-existent API endpoint
      const startTime = performance.now();
      await fetch('/manifest.json', { method: 'HEAD', cache: 'no-cache' });
      const responseTime = performance.now() - startTime;
      
      this.recordMetric({
        region: this.guessRegionFromResponseTime(responseTime),
        responseTime,
        cacheHitRate: 0,
        throughput: 0,
        errorRate: 0,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn('Edge region detection failed:', error);
    }
  }

  private guessRegionFromResponseTime(responseTime: number): string {
    // Enhanced heuristic with more regions
    if (responseTime < 30) return 'iad1'; // US East - fastest
    if (responseTime < 60) return 'hkg1'; // Hong Kong
    if (responseTime < 90) return 'sin1'; // Singapore
    if (responseTime < 120) return 'fra1'; // Frankfurt
    if (responseTime < 150) return 'sfo1'; // San Francisco
    return 'unknown';
  }

  recordMetric(metric: EdgeMetrics): void {
    this.metrics.push(metric);
    
    // Keep metrics size bounded
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics = this.metrics.slice(-this.maxMetricsSize);
    }

    // Check performance thresholds
    this.checkThresholds(metric);
  }

  recordCDNMetric(metric: CDNMetrics): void {
    this.cdnMetrics.push(metric);
    
    if (this.cdnMetrics.length > this.maxMetricsSize) {
      this.cdnMetrics = this.cdnMetrics.slice(-this.maxMetricsSize);
    }
  }

  private checkThresholds(metric: EdgeMetrics): void {
    const alerts: string[] = [];

    if (metric.responseTime > this.thresholds.maxResponseTime) {
      alerts.push(`High response time: ${metric.responseTime}ms in ${metric.region}`);
    }

    if (metric.cacheHitRate < this.thresholds.minCacheHitRate) {
      alerts.push(`Low cache hit rate: ${(metric.cacheHitRate * 100).toFixed(1)}% in ${metric.region}`);
    }

    if (metric.errorRate > this.thresholds.maxErrorRate) {
      alerts.push(`High error rate: ${(metric.errorRate * 100).toFixed(2)}% in ${metric.region}`);
    }

    if (metric.throughput < this.thresholds.minThroughput) {
      alerts.push(`Low throughput: ${metric.throughput} req/min in ${metric.region}`);
    }

    if (alerts.length > 0) {
      console.warn('Edge Performance Alerts:', alerts);
      this.sendAlerts(alerts);
    }
  }

  private async sendAlerts(alerts: string[]): Promise<void> {
    // NOTE: Edge alerts endpoint removed - API directory not compatible with Vite build
    // Alerts are now logged locally only
    if (process.env['NODE_ENV'] === 'production') {
      console.warn('[Edge Alerts]', alerts.join(', '));
    }
  }

  getMetricsByRegion(region?: string): EdgeMetrics[] {
    if (!region) return this.metrics;
    return this.metrics.filter(m => m.region === region);
  }

  getCDNMetricsByRegion(region?: string): CDNMetrics[] {
    if (!region) return this.cdnMetrics;
    return this.cdnMetrics.filter(m => m.edgeRegion === region);
  }

  getAverageMetrics(timeWindow: number = EDGE_METRICS.DEFAULT_TIME_WINDOW): { [key: string]: number } {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return {
        avgResponseTime: 0,
        avgCacheHitRate: 0,
        avgErrorRate: 0,
        avgThroughput: 0
      };
    }

    return {
      avgResponseTime: recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length,
      avgCacheHitRate: recentMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / recentMetrics.length,
      avgErrorRate: recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length,
      avgThroughput: recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length
    } as { [key: string]: number };
  }

  getCachePerformance(): { [status: string]: number } {
    const recent = this.cdnMetrics.filter(m => Date.now() - m.timestamp < EDGE_METRICS.DEFAULT_TIME_WINDOW);
    const total = recent.length;

    if (total === 0) return { hit: 0, miss: 0, stale: 0, revalidated: 0 };

    const counts = recent.reduce((acc, m) => {
      const status = m.cacheStatus as string;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return {
      hit: (counts['hit'] || 0) / total,
      miss: (counts['miss'] || 0) / total,
      stale: (counts['stale'] || 0) / total,
      revalidated: (counts['revalidated'] || 0) / total
    };
  }

  // Simulate edge performance for testing
  simulateEdgePerformance(): void {
    const regions = ['iad1', 'hkg1', 'sin1', 'fra1', 'sfo1'];
    const cacheStatuses: Array<'hit' | 'miss' | 'stale' | 'revalidated'> = ['hit', 'miss', 'stale', 'revalidated'];

    regions.forEach(region => {
      this.recordMetric({
        region,
        responseTime: Math.random() * 200 + 50,
        cacheHitRate: Math.random() * 0.3 + 0.7,
        throughput: Math.random() * 200 + 50,
        errorRate: Math.random() * 0.02,
        timestamp: Date.now()
      });

      cacheStatuses.forEach(status => {
        this.recordCDNMetric({
          edgeRegion: region,
          cacheStatus: status,
          responseSize: Math.random() * 10000 + 1000,
          ttl: Math.random() * 300 + 60,
          timestamp: Date.now()
        });
      });
    });
  }

  private startPeriodicCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - TIME_CONSTANTS.HOUR; // 1 hour ago
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
      this.cdnMetrics = this.cdnMetrics.filter(m => m.timestamp > cutoff);
    }, CACHE_TTLS.KV_CLEANUP); // Clean up every 5 minutes
  }

  // Export metrics for analysis
  exportMetrics(): { edge: EdgeMetrics[]; cdn: CDNMetrics[] } {
    return {
      edge: [...this.metrics],
      cdn: [...this.cdnMetrics]
    };
  }

  // Get performance score (0-100)
  getPerformanceScore(): number {
    const averages = this.getAverageMetrics();
    
    let score = SCORE_CALCULATION.MAX_SCORE;
    
    // Response time scoring (0-30 points)
    if (averages['avgResponseTime'] > this.thresholds.maxResponseTime) {
      score -= 30;
    } else {
      score -= (averages['avgResponseTime'] / this.thresholds.maxResponseTime) * 30;
    }
    
    // Cache hit rate scoring (0-25 points)
    if (averages['avgCacheHitRate'] < this.thresholds.minCacheHitRate) {
      score -= 25;
    } else {
      score -= (1 - averages['avgCacheHitRate'] / this.thresholds.minCacheHitRate) * 25;
    }
    
    // Error rate scoring (0-25 points)
    if (averages['avgErrorRate'] > this.thresholds.maxErrorRate) {
      score -= 25;
    } else {
      score -= (averages['avgErrorRate'] / this.thresholds.maxErrorRate) * 25;
    }
    
    // Throughput scoring (0-20 points)
    if (averages['avgThroughput'] < this.thresholds.minThroughput) {
      score -= 20;
    } else {
      score -= Math.max(0, 1 - averages['avgThroughput'] / this.thresholds.minThroughput) * 20;
    }
    
    return Math.max(0, Math.round(score));
  }
}

export const edgeMetrics = new EdgeMetricsCollector();

// Convenience functions for common operations
export const recordEdgeMetric = (metric: Omit<EdgeMetrics, 'timestamp'>) =>
  edgeMetrics.recordMetric({ ...metric, timestamp: Date.now() });

export const recordCDNMetric = (metric: Omit<CDNMetrics, 'timestamp'>) =>
  edgeMetrics.recordCDNMetric({ ...metric, timestamp: Date.now() });

export const getEdgePerformanceScore = () => edgeMetrics.getPerformanceScore();