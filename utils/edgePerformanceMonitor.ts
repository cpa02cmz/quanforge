/**
 * Edge Performance Monitor
 * Real-time performance monitoring for Vercel Edge Functions
 */

interface EdgeMetrics {
  region: string;
  functionName: string;
  duration: number;
  memoryUsage: number;
  coldStart: boolean;
  cacheHitRate: number;
  timestamp: number;
}

interface PerformanceThresholds {
  maxDuration: number;
  maxMemoryUsage: number;
  minCacheHitRate: number;
}

interface AlertConfig {
  enabled: boolean;
  thresholds: PerformanceThresholds;
  webhookUrl?: string;
}

export class EdgePerformanceMonitor {
  private static instance: EdgePerformanceMonitor;
  private metrics: EdgeMetrics[] = [];
  private alertConfig: AlertConfig = {
    enabled: true,
    thresholds: {
      maxDuration: 5000, // 5 seconds
      maxMemoryUsage: 128 * 1024 * 1024, // 128MB
      minCacheHitRate: 0.7, // 70%
    }
  };
  private maxMetrics = 1000; // Keep last 1000 metrics

  private constructor() {
    this.initializeMetrics();
  }

  static getInstance(): EdgePerformanceMonitor {
    if (!EdgePerformanceMonitor.instance) {
      EdgePerformanceMonitor.instance = new EdgePerformanceMonitor();
    }
    return EdgePerformanceMonitor.instance;
  }

  /**
   * Measure edge function performance with comprehensive metrics
   */
  async measureEdgeFunction<T>(
    name: string,
    fn: () => Promise<T>,
    options?: {
      region?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    const startTime = performance.now();
    const region = options?.region || process.env['VERCEL_REGION'] || 'unknown';
    const coldStart = this.isColdStart();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      // Record metrics
      const currentMemory = this.getMemoryUsage();
      this.recordMetric({
        region,
        functionName: name,
        duration,
        memoryUsage: currentMemory,
        coldStart,
        cacheHitRate: this.getCacheHitRate(name),
        timestamp: Date.now(),
      });
      
      // Check for performance alerts
      if (this.alertConfig.enabled) {
        await this.checkPerformanceAlerts({
          region,
          functionName: name,
          duration,
          memoryUsage: currentMemory,
          coldStart,
          cacheHitRate: this.getCacheHitRate(name),
          timestamp: Date.now(),
        });
      }
      
      // Log slow operations in development
      if (import.meta.env.DEV && duration > 1000) {
        console.warn(`Slow edge function ${name}: ${duration.toFixed(2)}ms in region ${region}`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Record error metrics
      this.recordMetric({
        region,
        functionName: `${name}_error`,
        duration,
        memoryUsage: this.getMemoryUsage(),
        coldStart,
        cacheHitRate: 0,
        timestamp: Date.now(),
      });
      
      console.error(`Edge function ${name} failed in region ${region} after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  /**
   * Record performance metric
   */
  private recordMetric(metric: EdgeMetrics): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Check if this is a cold start
   */
  private isColdStart(): boolean {
    // Check for cold start indicators
    return !(globalThis as any)._edgeFunctionInitialized;
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Get cache hit rate for a function
   */
  private getCacheHitRate(functionName: string): number {
    // Calculate cache hit rate from recent metrics
    const recentMetrics = this.metrics.filter(m => 
      m.functionName === functionName && 
      Date.now() - m.timestamp < 300000 // Last 5 minutes
    );
    
    if (recentMetrics.length === 0) return 0;
    
    const totalCalls = recentMetrics.length;
    const cacheHits = recentMetrics.filter(m => m.cacheHitRate > 0).length;
    
    return cacheHits / totalCalls;
  }

  /**
   * Check for performance alerts
   */
  private async checkPerformanceAlerts(metric: EdgeMetrics): Promise<void> {
    const alerts: string[] = [];
    
    if (metric.duration > this.alertConfig.thresholds.maxDuration) {
      alerts.push(`High duration: ${metric.duration.toFixed(2)}ms`);
    }
    
    if (metric.memoryUsage > this.alertConfig.thresholds.maxMemoryUsage) {
      alerts.push(`High memory usage: ${(metric.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    }
    
    if (metric.cacheHitRate < this.alertConfig.thresholds.minCacheHitRate) {
      alerts.push(`Low cache hit rate: ${(metric.cacheHitRate * 100).toFixed(1)}%`);
    }
    
    if (metric.coldStart) {
      alerts.push('Cold start detected');
    }
    
    if (alerts.length > 0) {
      await this.sendAlert(metric, alerts);
    }
  }

  /**
   * Send performance alert
   */
  private async sendAlert(metric: EdgeMetrics, alerts: string[]): Promise<void> {
    const alertMessage = `Performance Alert for ${metric.functionName} in ${metric.region}: ${alerts.join(', ')}`;
    
    console.warn(alertMessage);
    
    // Send webhook if configured
    if (this.alertConfig.webhookUrl) {
      try {
        await fetch(this.alertConfig.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'performance_alert',
            metric,
            alerts,
            timestamp: Date.now(),
          }),
        });
      } catch (error) {
        console.error('Failed to send performance alert webhook:', error);
      }
    }
  }

  /**
   * Get performance metrics for analysis
   */
  getMetrics(options?: {
    functionName?: string;
    region?: string;
    timeRange?: number; // milliseconds
  }): EdgeMetrics[] {
    let filtered = [...this.metrics];
    
    if (options?.functionName) {
      filtered = filtered.filter(m => m.functionName === options.functionName);
    }
    
    if (options?.region) {
      filtered = filtered.filter(m => m.region === options.region);
    }
    
    if (options?.timeRange) {
      const cutoff = Date.now() - options.timeRange;
      filtered = filtered.filter(m => m.timestamp >= cutoff);
    }
    
    return filtered;
  }

  /**
   * Get performance statistics
   */
  getStatistics(options?: {
    functionName?: string;
    region?: string;
    timeRange?: number;
  }): {
    totalCalls: number;
    averageDuration: number;
    p95Duration: number;
    p99Duration: number;
    averageMemoryUsage: number;
    coldStartRate: number;
    cacheHitRate: number;
    errorRate: number;
  } {
    const metrics = this.getMetrics(options);
    
    if (metrics.length === 0) {
      return {
        totalCalls: 0,
        averageDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        averageMemoryUsage: 0,
        coldStartRate: 0,
        cacheHitRate: 0,
        errorRate: 0,
      };
    }
    
    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const memoryUsages = metrics.map(m => m.memoryUsage);
    const coldStarts = metrics.filter(m => m.coldStart).length;
    const errors = metrics.filter(m => m.functionName.includes('_error')).length;
    const cacheHits = metrics.reduce((sum, m) => sum + m.cacheHitRate, 0);
    
    return {
      totalCalls: metrics.length,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
      averageMemoryUsage: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length,
      coldStartRate: coldStarts / metrics.length,
      cacheHitRate: cacheHits / metrics.length,
      errorRate: errors / metrics.length,
    };
  }

  /**
   * Get regional performance comparison
   */
  getRegionalComparison(timeRange?: number): Record<string, {
    calls: number;
    averageDuration: number;
    cacheHitRate: number;
    coldStartRate: number;
  }> {
    const metrics = this.getMetrics({ timeRange });
    const regions = [...new Set(metrics.map(m => m.region))];
    
    const comparison: Record<string, any> = {};
    
    for (const region of regions) {
      const regionMetrics = metrics.filter(m => m.region === region);
      const durations = regionMetrics.map(m => m.duration);
      const coldStarts = regionMetrics.filter(m => m.coldStart).length;
      const cacheHits = regionMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0);
      
      comparison[region] = {
        calls: regionMetrics.length,
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        cacheHitRate: cacheHits / regionMetrics.length,
        coldStartRate: coldStarts / regionMetrics.length,
      };
    }
    
    return comparison;
  }

  /**
   * Optimize performance based on metrics
   */
  getOptimizationRecommendations(): Array<{
    type: 'duration' | 'memory' | 'cache' | 'cold_start';
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
    functionName?: string;
    region?: string;
  }> {
    const recommendations: Array<any> = [];
    const stats = this.getStatistics({ timeRange: 3600000 }); // Last hour
    
    // Duration recommendations
    if (stats.averageDuration > 3000) {
      recommendations.push({
        type: 'duration',
        severity: 'high',
        recommendation: 'Consider optimizing function logic or increasing timeout limits',
      });
    }
    
    // Memory recommendations
    if (stats.averageMemoryUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push({
        type: 'memory',
        severity: 'medium',
        recommendation: 'Optimize memory usage by reducing data retention or improving algorithms',
      });
    }
    
    // Cache recommendations
    if (stats.cacheHitRate < 0.7) {
      recommendations.push({
        type: 'cache',
        severity: 'medium',
        recommendation: 'Improve caching strategy or increase cache TTL',
      });
    }
    
    // Cold start recommendations
    if (stats.coldStartRate > 0.2) {
      recommendations.push({
        type: 'cold_start',
        severity: 'high',
        recommendation: 'Implement function warming or increase provisioned concurrency',
      });
    }
    
    // Regional recommendations
    const regionalStats = this.getRegionalComparison(3600000);
    for (const [region, stats] of Object.entries(regionalStats)) {
      if (stats.averageDuration > 5000) {
        recommendations.push({
          type: 'duration',
          severity: 'medium',
          recommendation: `Consider optimizing for region ${region} or adding more edge locations`,
          region,
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Configure alerts
   */
  configureAlerts(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
  }

  /**
   * Initialize metrics collection
   */
  private initializeMetrics(): void {
    // Mark as initialized to detect cold starts
    (globalThis as any)._edgeFunctionInitialized = true;
    
    // Log metrics periodically in development
    if (import.meta.env.DEV) {
      setInterval(() => {
        const stats = this.getStatistics({ timeRange: 300000 }); // Last 5 minutes
        console.log('📊 Edge Performance Stats (5min):', {
          calls: stats.totalCalls,
          avgDuration: `${stats.averageDuration.toFixed(2)}ms`,
          p95Duration: `${stats.p95Duration.toFixed(2)}ms`,
          cacheHitRate: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
          coldStartRate: `${(stats.coldStartRate * 100).toFixed(1)}%`,
        });
      }, 300000); // Every 5 minutes
    }
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      statistics: this.getStatistics(),
      regionalComparison: this.getRegionalComparison(),
      recommendations: this.getOptimizationRecommendations(),
      timestamp: Date.now(),
    }, null, 2);
  }
}

// Global instance
export const edgePerformanceMonitor = EdgePerformanceMonitor.getInstance();

// Utility function for easy function measurement
export function measureEdge<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    region?: string;
    metadata?: Record<string, any>;
  }
): Promise<T> {
  return edgePerformanceMonitor.measureEdgeFunction(name, fn, options);
}