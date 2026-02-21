/**
 * API Metrics Collector Service
 * Comprehensive API performance monitoring and analytics
 * 
 * @module services/api/apiMetricsCollector
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../../constants/config';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('APIMetricsCollector');

/**
 * Request metric data point
 */
export interface RequestMetric {
  timestamp: number;
  duration: number;
  status: number;
  cached: boolean;
  endpoint: string;
  method: string;
  size?: number;
  error?: string;
  retryCount: number;
}

/**
 * Endpoint statistics
 */
export interface EndpointStats {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cachedRequests: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  errorRate: number;
  cacheHitRate: number;
  totalBytes: number;
  averageRetries: number;
  lastRequest?: number;
  lastError?: string;
  lastErrorTime?: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

/**
 * Time series bucket for aggregation
 */
interface TimeSeriesBucket {
  count: number;
  sum: number;
  min: number;
  max: number;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  name: string;
  condition: (stats: EndpointStats) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: (stats: EndpointStats) => string;
  cooldown: number; // ms between alerts
}

/**
 * Alert event
 */
export interface AlertEvent {
  name: string;
  severity: AlertConfig['severity'];
  message: string;
  timestamp: number;
  endpoint?: string;
  stats: EndpointStats;
}

/**
 * Metrics summary
 */
export interface MetricsSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cachedRequests: number;
  averageDuration: number;
  errorRate: number;
  cacheHitRate: number;
  totalBytes: number;
  activeEndpoints: number;
  alerts: AlertEvent[];
}

/**
 * API Metrics Collector
 * 
 * Features:
 * - Per-endpoint statistics
 * - Percentile calculations (p50, p95, p99)
 * - Time-series aggregation
 * - Alert system
 * - Error tracking
 * - Performance monitoring
 */
export class APIMetricsCollector {
  private metrics = new Map<string, RequestMetric[]>();
  private endpointStats = new Map<string, EndpointStats>();
  private timeSeries = new Map<string, Map<string, TimeSeriesBucket>>();
  private alerts: AlertConfig[] = [];
  private alertHistory: AlertEvent[] = [];
  private lastAlertTime = new Map<string, number>();
  
  private readonly maxMetricsPerEndpoint: number;
  private readonly timeSeriesInterval: number; // ms per bucket
  private readonly maxHistorySize: number;
  
  // Cleanup timer
  private cleanupInterval: ReturnType<typeof setInterval>;
  
  // Global stats
  private globalStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cachedRequests: 0,
    totalDuration: 0,
    totalBytes: 0
  };

  constructor(options?: {
    maxMetricsPerEndpoint?: number;
    timeSeriesInterval?: number;
    maxHistorySize?: number;
  }) {
    this.maxMetricsPerEndpoint = options?.maxMetricsPerEndpoint ?? 1000;
    this.timeSeriesInterval = options?.timeSeriesInterval ?? 60000; // 1 minute buckets
    this.maxHistorySize = options?.maxHistorySize ?? 100;
    
    // Cleanup old metrics periodically
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      TIME_CONSTANTS.CLEANUP_DEFAULT_INTERVAL
    );
    
    // Register default alerts
    this.registerDefaultAlerts();
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiMetricsCollector', {
        cleanup: () => this.destroy(),
        priority: 'low',
        description: 'API metrics collection service'
      });
    }
  }

  /**
   * Record a request metric
   */
  record(metric: RequestMetric): void {
    const key = this.getEndpointKey(metric.endpoint, metric.method);
    
    // Store metric
    const metrics = this.metrics.get(key) || [];
    metrics.push(metric);
    
    // Trim to max size
    if (metrics.length > this.maxMetricsPerEndpoint) {
      metrics.shift();
    }
    
    this.metrics.set(key, metrics);
    
    // Update stats
    this.updateEndpointStats(key, metric);
    
    // Update time series
    this.updateTimeSeries(key, metric);
    
    // Update global stats
    this.updateGlobalStats(metric);
    
    // Check alerts
    this.checkAlerts(key);
  }

  /**
   * Record a batch of metrics
   */
  recordBatch(metrics: RequestMetric[]): void {
    metrics.forEach(m => this.record(m));
  }

  /**
   * Get statistics for an endpoint
   */
  getEndpointStats(endpoint: string, method: string = 'GET'): EndpointStats | null {
    const key = this.getEndpointKey(endpoint, method);
    return this.endpointStats.get(key) || null;
  }

  /**
   * Get all endpoint statistics
   */
  getAllEndpointStats(): EndpointStats[] {
    return Array.from(this.endpointStats.values());
  }

  /**
   * Get metrics for an endpoint
   */
  getEndpointMetrics(endpoint: string, method: string = 'GET'): RequestMetric[] {
    const key = this.getEndpointKey(endpoint, method);
    return this.metrics.get(key) || [];
  }

  /**
   * Get metrics summary
   */
  getSummary(): MetricsSummary {
    const endpoints = this.getAllEndpointStats();
    
    return {
      totalRequests: this.globalStats.totalRequests,
      successfulRequests: this.globalStats.successfulRequests,
      failedRequests: this.globalStats.failedRequests,
      cachedRequests: this.globalStats.cachedRequests,
      averageDuration: this.globalStats.totalRequests > 0
        ? this.globalStats.totalDuration / this.globalStats.totalRequests
        : 0,
      errorRate: this.globalStats.totalRequests > 0
        ? this.globalStats.failedRequests / this.globalStats.totalRequests
        : 0,
      cacheHitRate: this.globalStats.totalRequests > 0
        ? this.globalStats.cachedRequests / this.globalStats.totalRequests
        : 0,
      totalBytes: this.globalStats.totalBytes,
      activeEndpoints: endpoints.length,
      alerts: this.getRecentAlerts()
    };
  }

  /**
   * Get time series data for an endpoint
   */
  getTimeSeries(
    endpoint: string,
    method: string = 'GET',
    metric: 'duration' | 'count' | 'errors' = 'duration',
    duration: number = TIME_CONSTANTS.HOUR
  ): TimeSeriesPoint[] {
    const key = this.getEndpointKey(endpoint, method);
    const series = this.timeSeries.get(key);
    
    if (!series) return [];
    
    const now = Date.now();
    const points: TimeSeriesPoint[] = [];
    
    for (const [timestampStr, bucket] of series.entries()) {
      const timestamp = parseInt(timestampStr, 10);
      
      if (now - timestamp > duration) continue;
      
      let value: number;
      switch (metric) {
        case 'duration':
          value = bucket.count > 0 ? bucket.sum / bucket.count : 0;
          break;
        case 'count':
          value = bucket.count;
          break;
        case 'errors':
          // This would need error count tracking in bucket
          value = 0;
          break;
        default:
          value = 0;
      }
      
      points.push({ timestamp, value });
    }
    
    return points.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Register a custom alert
   */
  registerAlert(config: AlertConfig): void {
    this.alerts.push(config);
    logger.debug(`Registered alert: ${config.name}`);
  }

  /**
   * Remove an alert
   */
  removeAlert(name: string): boolean {
    const index = this.alerts.findIndex(a => a.name === name);
    if (index > -1) {
      this.alerts.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(duration: number = TIME_CONSTANTS.HOUR): AlertEvent[] {
    const now = Date.now();
    return this.alertHistory.filter(a => now - a.timestamp < duration);
  }

  /**
   * Clear metrics for an endpoint
   */
  clearEndpoint(endpoint: string, method: string = 'GET'): void {
    const key = this.getEndpointKey(endpoint, method);
    this.metrics.delete(key);
    this.endpointStats.delete(key);
    this.timeSeries.delete(key);
    logger.debug(`Cleared metrics for ${key}`);
  }

  /**
   * Clear all metrics
   */
  clearAll(): void {
    this.metrics.clear();
    this.endpointStats.clear();
    this.timeSeries.clear();
    this.alertHistory = [];
    this.globalStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      totalDuration: 0,
      totalBytes: 0
    };
    logger.info('Cleared all metrics');
  }

  /**
   * Export metrics as JSON
   */
  export(): string {
    const data = {
      timestamp: Date.now(),
      globalStats: this.globalStats,
      endpointStats: Object.fromEntries(this.endpointStats),
      recentAlerts: this.alertHistory.slice(-20)
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Get slowest endpoints
   */
  getSlowestEndpoints(limit: number = 10): EndpointStats[] {
    return this.getAllEndpointStats()
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, limit);
  }

  /**
   * Get most error-prone endpoints
   */
  getErrorProneEndpoints(limit: number = 10): EndpointStats[] {
    return this.getAllEndpointStats()
      .filter(e => e.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit);
  }

  /**
   * Get most used endpoints
   */
  getMostUsedEndpoints(limit: number = 10): EndpointStats[] {
    return this.getAllEndpointStats()
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, limit);
  }

  // Private methods

  private getEndpointKey(endpoint: string, method: string): string {
    return `${method}:${endpoint}`;
  }

  private updateEndpointStats(key: string, metric: RequestMetric): void {
    const stats = this.endpointStats.get(key) || this.createEmptyStats(key);
    const metrics = this.metrics.get(key) || [];
    
    // Update counts
    stats.totalRequests++;
    stats.lastRequest = metric.timestamp;
    
    if (metric.cached) {
      stats.cachedRequests++;
    } else if (metric.status >= 200 && metric.status < 400) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
      stats.lastError = metric.error || `HTTP ${metric.status}`;
      stats.lastErrorTime = metric.timestamp;
    }
    
    // Update duration stats
    if (metrics.length > 0) {
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      
      stats.averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      stats.minDuration = durations[0] ?? 0;
      stats.maxDuration = durations[durations.length - 1] ?? 0;
      stats.p50Duration = this.percentile(durations, 50);
      stats.p95Duration = this.percentile(durations, 95);
      stats.p99Duration = this.percentile(durations, 99);
    }
    
    // Update rates
    stats.errorRate = stats.failedRequests / stats.totalRequests;
    stats.cacheHitRate = stats.cachedRequests / stats.totalRequests;
    
    // Update bytes
    if (metric.size) {
      stats.totalBytes += metric.size;
    }
    
    // Update retries
    stats.averageRetries = metrics.reduce((sum, m) => sum + m.retryCount, 0) / metrics.length;
    
    this.endpointStats.set(key, stats);
  }

  private createEmptyStats(key: string): EndpointStats {
    return {
      endpoint: key,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      averageDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      p50Duration: 0,
      p95Duration: 0,
      p99Duration: 0,
      errorRate: 0,
      cacheHitRate: 0,
      totalBytes: 0,
      averageRetries: 0
    };
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] ?? 0;
  }

  private updateTimeSeries(key: string, metric: RequestMetric): void {
    const series = this.timeSeries.get(key) || new Map<string, TimeSeriesBucket>();
    
    // Create bucket key based on interval
    const bucketTime = Math.floor(metric.timestamp / this.timeSeriesInterval) * this.timeSeriesInterval;
    const bucketKey = bucketTime.toString();
    
    const bucket = series.get(bucketKey) || {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity
    };
    
    bucket.count++;
    bucket.sum += metric.duration;
    bucket.min = Math.min(bucket.min, metric.duration);
    bucket.max = Math.max(bucket.max, metric.duration);
    
    series.set(bucketKey, bucket);
    this.timeSeries.set(key, series);
  }

  private updateGlobalStats(metric: RequestMetric): void {
    this.globalStats.totalRequests++;
    this.globalStats.totalDuration += metric.duration;
    
    if (metric.cached) {
      this.globalStats.cachedRequests++;
    } else if (metric.status >= 200 && metric.status < 400) {
      this.globalStats.successfulRequests++;
    } else {
      this.globalStats.failedRequests++;
    }
    
    if (metric.size) {
      this.globalStats.totalBytes += metric.size;
    }
  }

  private checkAlerts(endpointKey: string): void {
    const stats = this.endpointStats.get(endpointKey);
    if (!stats) return;
    
    const now = Date.now();
    
    for (const alert of this.alerts) {
      const lastAlert = this.lastAlertTime.get(alert.name) || 0;
      
      // Check cooldown
      if (now - lastAlert < alert.cooldown) continue;
      
      // Check condition
      if (alert.condition(stats)) {
        const event: AlertEvent = {
          name: alert.name,
          severity: alert.severity,
          message: alert.message(stats),
          timestamp: now,
          endpoint: stats.endpoint,
          stats
        };
        
        this.alertHistory.push(event);
        this.lastAlertTime.set(alert.name, now);
        
        // Trim history
        if (this.alertHistory.length > this.maxHistorySize) {
          this.alertHistory.shift();
        }
        
        logger.warn(`Alert [${alert.severity}] ${alert.name}: ${alert.message(stats)}`);
      }
    }
  }

  private registerDefaultAlerts(): void {
    // High error rate alert
    this.alerts.push({
      name: 'high_error_rate',
      condition: (stats) => stats.errorRate > 0.1 && stats.totalRequests > 10,
      severity: 'high',
      message: (stats) => `High error rate: ${(stats.errorRate * 100).toFixed(1)}% on ${stats.endpoint}`,
      cooldown: TIME_CONSTANTS.MINUTE * 5
    });
    
    // Slow response alert
    this.alerts.push({
      name: 'slow_response',
      condition: (stats) => stats.p95Duration > 5000 && stats.totalRequests > 5,
      severity: 'medium',
      message: (stats) => `Slow responses: p95 = ${stats.p95Duration.toFixed(0)}ms on ${stats.endpoint}`,
      cooldown: TIME_CONSTANTS.MINUTE * 10
    });
    
    // Critical error rate
    this.alerts.push({
      name: 'critical_error_rate',
      condition: (stats) => stats.errorRate > 0.5 && stats.totalRequests > 5,
      severity: 'critical',
      message: (stats) => `Critical error rate: ${(stats.errorRate * 100).toFixed(1)}% on ${stats.endpoint}`,
      cooldown: TIME_CONSTANTS.MINUTE
    });
    
    // Low cache hit rate
    this.alerts.push({
      name: 'low_cache_hit_rate',
      condition: (stats) => stats.cacheHitRate < 0.3 && stats.totalRequests > 20,
      severity: 'low',
      message: (stats) => `Low cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}% on ${stats.endpoint}`,
      cooldown: TIME_CONSTANTS.HOUR
    });
  }

  private cleanup(): void {
    const maxAge = TIME_CONSTANTS.HOUR * 24; // Keep 24 hours of data
    const now = Date.now();
    
    // Clean old metrics
    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => now - m.timestamp < maxAge);
      if (filtered.length === 0) {
        this.metrics.delete(key);
      } else if (filtered.length < metrics.length) {
        this.metrics.set(key, filtered);
      }
    }
    
    // Clean old time series
    for (const [key, series] of this.timeSeries.entries()) {
      for (const [bucketKey] of series.entries()) {
        const bucketTime = parseInt(bucketKey, 10);
        if (now - bucketTime > maxAge) {
          series.delete(bucketKey);
        }
      }
      
      if (series.size === 0) {
        this.timeSeries.delete(key);
      }
    }
    
    // Clean old alerts
    this.alertHistory = this.alertHistory.filter(a => now - a.timestamp < maxAge);
  }

  /**
   * Destroy the collector and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearAll();
    logger.info('API Metrics Collector destroyed');
  }
}

// Create singleton instance
export const apiMetricsCollector = new APIMetricsCollector();

// React hook for metrics
export const useAPIMetrics = () => ({
  record: (metric: RequestMetric) => apiMetricsCollector.record(metric),
  getEndpointStats: (endpoint: string, method?: string) =>
    apiMetricsCollector.getEndpointStats(endpoint, method),
  getAllEndpointStats: () => apiMetricsCollector.getAllEndpointStats(),
  getSummary: () => apiMetricsCollector.getSummary(),
  getSlowestEndpoints: (limit?: number) => apiMetricsCollector.getSlowestEndpoints(limit),
  getErrorProneEndpoints: (limit?: number) => apiMetricsCollector.getErrorProneEndpoints(limit),
  getMostUsedEndpoints: (limit?: number) => apiMetricsCollector.getMostUsedEndpoints(limit),
  getRecentAlerts: (duration?: number) => apiMetricsCollector.getRecentAlerts(duration),
  registerAlert: (config: AlertConfig) => apiMetricsCollector.registerAlert(config)
});
