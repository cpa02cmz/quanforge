/**
 * Backend Performance Analyzer
 * 
 * Provides comprehensive performance analysis including:
 * - Latency analysis with percentile calculations
 * - Throughput monitoring
 * - Bottleneck detection
 * - Performance recommendations
 * - Trend analysis
 * 
 * @module services/backend/performanceAnalyzer
 * @author Backend Engineer
 */

import {
  PerformanceMetric,
  PerformanceAnalysis,
  PerformanceBottleneck,
  PerformanceRecommendation,
  BackendPerformanceReport,
  DEFAULT_BACKEND_CONFIG,
} from './types';

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('PerformanceAnalyzer');

/**
 * Backend Performance Analyzer
 * 
 * Singleton class that analyzes backend performance metrics.
 */
export class BackendPerformanceAnalyzer {
  private static instance: BackendPerformanceAnalyzer | null = null;
  
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private maxMetricsPerService: number = 10000;
  private analysisCache: Map<string, PerformanceAnalysis> = new Map();
  private cacheTTL: number = 60000; // 1 minute

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): BackendPerformanceAnalyzer {
    if (!BackendPerformanceAnalyzer.instance) {
      BackendPerformanceAnalyzer.instance = new BackendPerformanceAnalyzer();
    }
    return BackendPerformanceAnalyzer.instance;
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    const key = metric.service || 'global';
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const metrics = this.metrics.get(key)!;
    metrics.push(metric);

    // Trim if exceeded max
    if (metrics.length > this.maxMetricsPerService) {
      metrics.shift();
    }

    // Invalidate cache for this service
    this.analysisCache.delete(key);
  }

  /**
   * Record multiple metrics at once
   */
  recordMetrics(metrics: PerformanceMetric[]): void {
    metrics.forEach(metric => this.recordMetric(metric));
  }

  /**
   * Analyze performance for a specific service
   */
  analyzeService(
    serviceName: string,
    timeframe: { start: number; end: number } = { start: Date.now() - 3600000, end: Date.now() }
  ): PerformanceAnalysis {
    // Check cache
    const cacheKey = `${serviceName}_${timeframe.start}_${timeframe.end}`;
    const cached = this.analysisCache.get(cacheKey);
    if (cached && Date.now() - timeframe.end < this.cacheTTL) {
      return cached;
    }

    const metrics = this.metrics.get(serviceName) || [];
    const filtered = metrics.filter(
      m => m.timestamp >= timeframe.start && m.timestamp <= timeframe.end
    );

    const latencyMetrics = filtered.filter(m => m.name === 'latency' && m.unit === 'ms');
    const requestCounts = filtered.filter(m => m.name === 'request_count' && m.unit === 'count');
    const errorCounts = filtered.filter(m => m.name === 'error_count' && m.unit === 'count');

    // Calculate metrics
    const latencies = latencyMetrics.map(m => m.value);
    const requestCount = requestCounts.reduce((sum, m) => sum + m.value, 0);
    const errorCount = errorCounts.reduce((sum, m) => sum + m.value, 0);

    const averageLatency = this.calculateAverage(latencies);
    const p50Latency = this.calculatePercentile(latencies, 50);
    const p95Latency = this.calculatePercentile(latencies, 95);
    const p99Latency = this.calculatePercentile(latencies, 99);
    const errorRate = requestCount > 0 ? errorCount / requestCount : 0;

    const durationMs = timeframe.end - timeframe.start;
    const durationSeconds = durationMs / 1000;
    const throughput = durationSeconds > 0 ? requestCount / durationSeconds : 0;

    // Detect bottlenecks
    const bottlenecks = this.detectBottlenecks(
      serviceName,
      averageLatency,
      p95Latency,
      errorRate,
      throughput
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      serviceName,
      averageLatency,
      p95Latency,
      errorRate,
      throughput,
      bottlenecks
    );

    // Calculate score
    const score = this.calculateScore(averageLatency, p95Latency, errorRate, throughput);

    const analysis: PerformanceAnalysis = {
      serviceName,
      timeframe,
      metrics: {
        requestCount,
        averageLatency,
        p50Latency,
        p95Latency,
        p99Latency,
        errorRate,
        throughput,
      },
      bottlenecks,
      recommendations,
      score,
    };

    // Cache the result
    this.analysisCache.set(cacheKey, analysis);

    return analysis;
  }

  /**
   * Generate a comprehensive performance report
   */
  generateReport(
    timeframe: { start: number; end: number } = { start: Date.now() - 3600000, end: Date.now() }
  ): BackendPerformanceReport {
    const serviceAnalyses: PerformanceAnalysis[] = [];
    
    // Analyze all services
    for (const serviceName of this.metrics.keys()) {
      serviceAnalyses.push(this.analyzeService(serviceName, timeframe));
    }

    // Calculate overall metrics
    const totalRequests = serviceAnalyses.reduce((sum, a) => sum + a.metrics.requestCount, 0);
    const avgLatencies = serviceAnalyses.map(a => a.metrics.averageLatency).filter(l => l > 0);
    const averageLatency = this.calculateAverage(avgLatencies);
    const totalErrors = serviceAnalyses.reduce((sum, a) => 
      sum + a.metrics.errorRate * a.metrics.requestCount, 0
    );
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    const totalThroughput = serviceAnalyses.reduce((sum, a) => sum + a.metrics.throughput, 0);

    const healthyServices = serviceAnalyses.filter(a => a.score >= 80).length;
    const degradedServices = serviceAnalyses.filter(a => a.score < 80 && a.score >= 50).length;

    // Get top bottlenecks across all services
    const allBottlenecks = serviceAnalyses.flatMap(a => a.bottlenecks);
    const topBottlenecks = allBottlenecks
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 10);

    // Get critical recommendations
    const criticalRecommendations = serviceAnalyses
      .flatMap(a => a.recommendations)
      .filter(r => r.priority === 'critical' || r.priority === 'high')
      .slice(0, 10);

    const overallScore = this.calculateOverallScore(serviceAnalyses);

    return {
      generatedAt: Date.now(),
      timeframe,
      overallScore,
      services: serviceAnalyses,
      summary: {
        totalRequests,
        averageLatency,
        errorRate,
        throughput: totalThroughput,
        healthyServices,
        degradedServices,
      },
      topBottlenecks,
      criticalRecommendations,
    };
  }

  /**
   * Get metrics for a specific service
   */
  getMetrics(serviceName: string): PerformanceMetric[] {
    return this.metrics.get(serviceName) || [];
  }

  /**
   * Get all services being tracked
   */
  getTrackedServices(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear metrics for a specific service
   */
  clearServiceMetrics(serviceName: string): void {
    this.metrics.delete(serviceName);
    this.analysisCache.clear();
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
    this.analysisCache.clear();
  }

  // Private methods

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  private detectBottlenecks(
    serviceName: string,
    avgLatency: number,
    p95Latency: number,
    errorRate: number,
    throughput: number
  ): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];
    const thresholds = DEFAULT_BACKEND_CONFIG.alertThresholds;

    // Latency bottlenecks
    if (avgLatency > thresholds.latencyCritical) {
      bottlenecks.push({
        type: 'latency',
        severity: 'critical',
        description: `Average latency (${avgLatency.toFixed(0)}ms) exceeds critical threshold (${thresholds.latencyCritical}ms)`,
        location: serviceName,
        impact: 'User experience severely degraded',
        suggestedFix: 'Optimize database queries, add caching, or scale horizontally',
      });
    } else if (avgLatency > thresholds.latencyWarning) {
      bottlenecks.push({
        type: 'latency',
        severity: 'high',
        description: `Average latency (${avgLatency.toFixed(0)}ms) exceeds warning threshold (${thresholds.latencyWarning}ms)`,
        location: serviceName,
        impact: 'User experience may be affected',
        suggestedFix: 'Review slow queries and optimize hot paths',
      });
    }

    // P95 latency bottlenecks
    if (p95Latency > thresholds.latencyCritical * 2) {
      bottlenecks.push({
        type: 'latency',
        severity: 'high',
        description: `P95 latency (${p95Latency.toFixed(0)}ms) indicates high tail latency`,
        location: serviceName,
        impact: '5% of requests experience severe delays',
        suggestedFix: 'Investigate and optimize slow operations, add request timeouts',
      });
    }

    // Error rate bottlenecks
    if (errorRate > thresholds.errorRateCritical) {
      bottlenecks.push({
        type: 'error_rate',
        severity: 'critical',
        description: `Error rate (${(errorRate * 100).toFixed(1)}%) exceeds critical threshold (${thresholds.errorRateCritical * 100}%)`,
        location: serviceName,
        impact: 'Significant number of requests failing',
        suggestedFix: 'Investigate error logs, add error handling, check service dependencies',
      });
    } else if (errorRate > thresholds.errorRateWarning) {
      bottlenecks.push({
        type: 'error_rate',
        severity: 'high',
        description: `Error rate (${(errorRate * 100).toFixed(1)}%) exceeds warning threshold (${thresholds.errorRateWarning * 100}%)`,
        location: serviceName,
        impact: 'Some requests are failing',
        suggestedFix: 'Review error patterns and improve error handling',
      });
    }

    // Throughput bottlenecks
    if (throughput > 0 && throughput < 10) {
      bottlenecks.push({
        type: 'throughput',
        severity: 'medium',
        description: `Low throughput (${throughput.toFixed(1)} req/s) for service`,
        location: serviceName,
        impact: 'Service may not handle load efficiently',
        suggestedFix: 'Consider connection pooling, async processing, or caching',
      });
    }

    return bottlenecks;
  }

  private generateRecommendations(
    serviceName: string,
    avgLatency: number,
    p95Latency: number,
    _errorRate: number,
    _throughput: number,
    bottlenecks: PerformanceBottleneck[]
  ): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // Add recommendations based on bottlenecks
    bottlenecks.forEach((bottleneck, index) => {
      recommendations.push({
        id: `rec_${serviceName}_${index}`,
        priority: bottleneck.severity === 'critical' ? 'critical' : 
                  bottleneck.severity === 'high' ? 'high' : 
                  bottleneck.severity === 'medium' ? 'medium' : 'low',
        category: bottleneck.type === 'latency' ? 'optimization' :
                  bottleneck.type === 'error_rate' ? 'error_handling' :
                  bottleneck.type === 'throughput' ? 'scaling' : 'optimization',
        description: bottleneck.suggestedFix,
        impact: bottleneck.impact,
        autoApplicable: false,
      });
    });

    // Add general recommendations
    if (avgLatency > 100) {
      recommendations.push({
        id: `rec_${serviceName}_cache`,
        priority: 'medium',
        category: 'caching',
        description: 'Implement caching for frequently accessed data',
        impact: 'Could reduce latency by 30-50%',
        autoApplicable: false,
      });
    }

    if (p95Latency > avgLatency * 3) {
      recommendations.push({
        id: `rec_${serviceName}_tail`,
        priority: 'medium',
        category: 'optimization',
        description: 'Investigate and optimize tail latency outliers',
        impact: 'Improve consistency of response times',
        autoApplicable: false,
      });
    }

    return recommendations;
  }

  private calculateScore(
    avgLatency: number,
    _p95Latency: number,
    errorRate: number,
    throughput: number
  ): number {
    const thresholds = DEFAULT_BACKEND_CONFIG.alertThresholds;
    
    // Latency score (0-40 points)
    let latencyScore = 40;
    if (avgLatency > thresholds.latencyCritical) {
      latencyScore = 0;
    } else if (avgLatency > thresholds.latencyWarning) {
      latencyScore = 20;
    } else if (avgLatency > thresholds.latencyWarning / 2) {
      latencyScore = 30;
    }

    // Error rate score (0-40 points)
    let errorScore = 40;
    if (errorRate > thresholds.errorRateCritical) {
      errorScore = 0;
    } else if (errorRate > thresholds.errorRateWarning) {
      errorScore = 20;
    } else if (errorRate > thresholds.errorRateWarning / 2) {
      errorScore = 30;
    }

    // Throughput score (0-20 points)
    let throughputScore = 20;
    if (throughput < 1) {
      throughputScore = 5;
    } else if (throughput < 10) {
      throughputScore = 10;
    } else if (throughput < 100) {
      throughputScore = 15;
    }

    return latencyScore + errorScore + throughputScore;
  }

  private calculateOverallScore(analyses: PerformanceAnalysis[]): number {
    if (analyses.length === 0) return 100;
    
    // Weighted average based on service criticality
    return Math.round(
      analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length
    );
  }

  /**
   * Cleanup and destroy the analyzer
   */
  destroy(): void {
    this.metrics.clear();
    this.analysisCache.clear();
    BackendPerformanceAnalyzer.instance = null;
    logger.log('Performance Analyzer destroyed');
  }
}

// Export singleton instance
export const backendPerformanceAnalyzer = BackendPerformanceAnalyzer.getInstance();

/**
 * Helper function to record latency metric
 */
export function recordLatency(
  serviceName: string,
  operation: string,
  duration: number,
  tags?: Record<string, string>
): void {
  backendPerformanceAnalyzer.recordMetric({
    name: 'latency',
    value: duration,
    unit: 'ms',
    timestamp: Date.now(),
    service: serviceName,
    operation,
    tags,
  });
}

/**
 * Helper function to record request count
 */
export function recordRequestCount(
  serviceName: string,
  count: number,
  tags?: Record<string, string>
): void {
  backendPerformanceAnalyzer.recordMetric({
    name: 'request_count',
    value: count,
    unit: 'count',
    timestamp: Date.now(),
    service: serviceName,
    tags,
  });
}

/**
 * Helper function to record error count
 */
export function recordErrorCount(
  serviceName: string,
  count: number,
  tags?: Record<string, string>
): void {
  backendPerformanceAnalyzer.recordMetric({
    name: 'error_count',
    value: count,
    unit: 'count',
    timestamp: Date.now(),
    service: serviceName,
    tags,
  });
}
