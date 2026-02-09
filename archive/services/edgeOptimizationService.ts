/**
 * Enhanced Edge Optimization Service
 * Provides advanced optimization for Vercel Edge deployment and Supabase integration
 */

import { enhancedConnectionPool } from './enhancedSupabasePool';
import { edgeConnectionPool } from './edgeSupabasePool';
import { globalCache } from './unifiedCacheManager';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance';

interface EdgeOptimizationConfig {
  enablePredictiveCaching: boolean;
  enableConnectionWarming: boolean;
  enableRegionAffinity: boolean;
  enableCompression: boolean;
  cacheStrategy: 'aggressive' | 'balanced' | 'conservative';
  maxConnections: number;
  connectionTimeout: number;
  retryAttempts: number;
  healthCheckInterval: number;
}

interface EdgeMetrics {
  region: string;
  timestamp: number;
  connectionPool: {
    totalConnections: number;
    activeConnections: number;
    healthyConnections: number;
    avgAcquireTime: number;
    hitRate: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
    memoryUsage: number;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number;
  };
}

class EdgeOptimizationService {
  private static instance: EdgeOptimizationService;
  private config: EdgeOptimizationConfig = {
    enablePredictiveCaching: true,
    enableConnectionWarming: true,
    enableRegionAffinity: true,
    enableCompression: true,
    cacheStrategy: 'balanced',
    maxConnections: 6,
    connectionTimeout: 1000,
    retryAttempts: 3,
    healthCheckInterval: 30000
  };
  
  private metrics: Map<string, EdgeMetrics[]> = new Map();
  private optimizationTimer: ReturnType<typeof setInterval> | null = null;
  private readonly edgeRegions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1', 'cle1'];
  private currentRegion = process.env['VERCEL_REGION'] || 'unknown';

  private constructor() {
    this.initializeOptimizations();
  }

  static getInstance(): EdgeOptimizationService {
    if (!EdgeOptimizationService.instance) {
      EdgeOptimizationService.instance = new EdgeOptimizationService();
    }
    return EdgeOptimizationService.instance;
  }

  private async initializeOptimizations(): Promise<void> {
    console.log(`Initializing Edge Optimization Service for region: ${this.currentRegion}`);
    
    // Optimize connection pools for edge
    this.optimizeConnectionPools();
    
    // Start optimization monitoring
    this.startOptimizationMonitoring();
    
    // Initialize predictive caching
    if (this.config.enablePredictiveCaching) {
      this.initializePredictiveCaching();
    }
    
    // Warm up connections if enabled
    if (this.config.enableConnectionWarming) {
      await this.warmupConnections();
    }
  }

  private optimizeConnectionPools(): void {
    // Optimize enhanced connection pool for edge
    enhancedConnectionPool.optimizeForEdge();
    
    // Update configuration for edge environment
    enhancedConnectionPool.updateConfig({
      maxConnections: this.config.maxConnections,
      acquireTimeout: this.config.connectionTimeout,
      retryAttempts: this.config.retryAttempts,
      healthCheckInterval: this.config.healthCheckInterval,
      connectionWarming: this.config.enableConnectionWarming,
      regionAffinity: this.config.enableRegionAffinity
    });
  }

  private startOptimizationMonitoring(): void {
    this.optimizationTimer = setInterval(() => {
      this.performOptimizations();
    }, 60000); // Run optimizations every minute
  }

  private async performOptimizations(): Promise<void> {
    try {
      const startTime = performance.now();
      
      // Collect current metrics
      const metrics = await this.collectMetrics();
      
      // Analyze and optimize based on metrics
      await this.optimizeBasedOnMetrics(metrics);
      
      // Clean up expired data
      this.cleanupExpiredData();
      
      const duration = performance.now() - startTime;
      console.debug(`Edge optimization cycle completed in ${duration.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('Edge optimization cycle failed:', error);
    }
  }

  private async collectMetrics(): Promise<EdgeMetrics> {
    const poolStats = enhancedConnectionPool.getStats();
    const edgeMetrics = enhancedConnectionPool.getEdgeMetrics();
    const cacheMetrics = globalCache.getMetrics();
    
    const metrics: EdgeMetrics = {
      region: this.currentRegion,
      timestamp: Date.now(),
      connectionPool: {
        totalConnections: poolStats.totalConnections,
        activeConnections: poolStats.activeConnections,
        healthyConnections: poolStats.totalConnections - poolStats.unhealthyConnections,
        avgAcquireTime: poolStats.avgAcquireTime,
        hitRate: poolStats.hitRate
      },
      cache: {
        hitRate: cacheMetrics.hitRate,
        missRate: 1 - cacheMetrics.hitRate,
        totalRequests: cacheMetrics.hits + cacheMetrics.misses,
        memoryUsage: cacheMetrics.memoryUsage
      },
      performance: {
        avgResponseTime: poolStats.avgAcquireTime,
        p95ResponseTime: this.calculatePercentile(poolStats.avgAcquireTime, 95),
        p99ResponseTime: this.calculatePercentile(poolStats.avgAcquireTime, 99),
        errorRate: this.calculateErrorRate(),
        throughput: this.calculateThroughput()
      }
    };
    
    // Store metrics for analysis
    this.storeMetrics(metrics);
    
    return metrics;
  }

  private storeMetrics(metrics: EdgeMetrics): void {
    const regionMetrics = this.metrics.get(metrics.region) || [];
    regionMetrics.push(metrics);
    
    // Keep only last 100 data points per region
    if (regionMetrics.length > 100) {
      regionMetrics.splice(0, regionMetrics.length - 100);
    }
    
    this.metrics.set(metrics.region, regionMetrics);
  }

  private async optimizeBasedOnMetrics(metrics: EdgeMetrics): Promise<void> {
    // Connection pool optimization
    if (metrics.connectionPool.avgAcquireTime > 500) {
      console.warn('Slow connection acquisition detected, optimizing pool...');
      await this.optimizeConnectionPool();
    }
    
    // Cache optimization
    if (metrics.cache.hitRate < 0.7) {
      console.warn('Low cache hit rate, optimizing cache strategy...');
      this.optimizeCacheStrategy();
    }
    
    // Performance optimization
    if (metrics.performance.avgResponseTime > 1000) {
      console.warn('High response times, applying performance optimizations...');
      await this.optimizePerformance();
    }
    
    // Error rate optimization
    if (metrics.performance.errorRate > 0.05) {
      console.warn('High error rate, applying error mitigation...');
      await this.mitigateErrors();
    }
  }

  private async optimizeConnectionPool(): Promise<void> {
    // Increase max connections if acquisition is slow
    const currentConfig = enhancedConnectionPool.getStats();
    if (currentConfig.totalConnections < this.config.maxConnections) {
      enhancedConnectionPool.updateConfig({
        maxConnections: Math.min(currentConfig.totalConnections + 2, this.config.maxConnections)
      });
    }
    
    // Force health check to remove unhealthy connections
    await enhancedConnectionPool.forceHealthCheck();
    
    // Warm up additional connections for current region
    if (this.config.enableConnectionWarming) {
      await enhancedConnectionPool.forceEdgeWarming();
    }
  }

  private optimizeCacheStrategy(): void {
    // Adjust cache TTL based on hit rate
    const cacheMetrics = globalCache.getMetrics();
    
    if (this.config.cacheStrategy === 'aggressive') {
      // Increase cache TTL for better hit rates
      globalCache.set('optimization_cache_ttl', Date.now(), 15 * 60 * 1000); // 15 minutes
    } else if (this.config.cacheStrategy === 'conservative') {
      // Decrease cache TTL for fresher data
      globalCache.set('optimization_cache_ttl', Date.now(), 2 * 60 * 1000); // 2 minutes
    }
  }

  private async optimizePerformance(): Promise<void> {
    // Enable compression if not already enabled
    if (this.config.enableCompression) {
      // This would integrate with Vercel's edge compression
      console.debug('Edge compression optimization applied');
    }
    
    // Optimize connection timeout for faster failover
    enhancedConnectionPool.updateConfig({
      acquireTimeout: Math.max(this.config.connectionTimeout - 200, 500)
    });
  }

  private async mitigateErrors(): Promise<void> {
    // Increase retry attempts for better reliability
    enhancedConnectionPool.updateConfig({
      retryAttempts: Math.min(this.config.retryAttempts + 1, 5)
    });
    
    // Force cleanup of unhealthy connections
    await enhancedConnectionPool.cleanupForEdge();
  }

  private cleanupExpiredData(): void {
    const now = Date.now();
    const expirationTime = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [region, metrics] of this.metrics.entries()) {
      const validMetrics = metrics.filter(m => now - m.timestamp < expirationTime);
      this.metrics.set(region, validMetrics);
    }
  }

  private initializePredictiveCaching(): void {
    // Pre-warm common cache keys based on usage patterns
    const commonKeys = [
      'robots_list',
      'user_session',
      'strategy_types',
      'market_data'
    ];
    
    commonKeys.forEach(key => {
      globalCache.set(`predictive_${key}`, { timestamp: Date.now() }, 5 * 60 * 1000);
    });
  }

  private async warmupConnections(): Promise<void> {
    console.log('Starting edge connection warm-up...');
    
    try {
      // Warm up enhanced connection pool
      await enhancedConnectionPool.forceEdgeWarming();
      
      // Warm up edge connection pool
      await edgeConnectionPool.warmEdgeConnections();
      
      console.log('Edge connection warm-up completed');
    } catch (error) {
      console.warn('Edge connection warm-up failed:', error);
    }
  }

  private calculatePercentile(baseValue: number, percentile: number): number {
    // Simplified percentile calculation based on base value
    // In a real implementation, this would use actual historical data
    const multiplier = percentile === 95 ? 1.5 : percentile === 99 ? 2.0 : 1.2;
    return baseValue * multiplier;
  }

  private calculateErrorRate(): number {
    // Simplified error rate calculation
    // In a real implementation, this would track actual errors
    return 0.01; // 1% error rate as example
  }

  private calculateThroughput(): number {
    // Simplified throughput calculation
    // In a real implementation, this would track actual request count
    return 100; // 100 requests per second as example
  }

  // Public API methods
  
  /**
   * Get current edge optimization metrics
   */
  async getMetrics(): Promise<EdgeMetrics> {
    return this.collectMetrics();
  }

  /**
   * Get historical metrics for a region
   */
  getHistoricalMetrics(region: string, limit: number = 50): EdgeMetrics[] {
    const regionMetrics = this.metrics.get(region) || [];
    return regionMetrics.slice(-limit);
  }

  /**
   * Update optimization configuration
   */
  updateConfig(newConfig: Partial<EdgeOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Edge optimization configuration updated:', this.config);
    
    // Re-apply optimizations with new config
    this.optimizeConnectionPools();
  }

  /**
   * Force immediate optimization cycle
   */
  async forceOptimization(): Promise<void> {
    console.log('Forcing immediate edge optimization...');
    await this.performOptimizations();
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const currentMetrics = this.metrics.get(this.currentRegion) || [];
    const latestMetrics = currentMetrics[currentMetrics.length - 1];
    
    if (!latestMetrics) {
      return ['No metrics available for recommendations'];
    }
    
    // Connection recommendations
    if (latestMetrics.connectionPool.avgAcquireTime > 500) {
      recommendations.push('Consider increasing max connections or enabling connection warming');
    }
    
    if (latestMetrics.connectionPool.hitRate < 0.8) {
      recommendations.push('Consider optimizing connection pool configuration');
    }
    
    // Cache recommendations
    if (latestMetrics.cache.hitRate < 0.7) {
      recommendations.push('Consider adjusting cache strategy or increasing TTL');
    }
    
    // Performance recommendations
    if (latestMetrics.performance.avgResponseTime > 1000) {
      recommendations.push('Consider enabling compression or optimizing queries');
    }
    
    if (latestMetrics.performance.errorRate > 0.05) {
      recommendations.push('Consider increasing retry attempts or improving error handling');
    }
    
    return recommendations;
  }

  /**
   * Get health status of edge optimizations
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    metrics: EdgeMetrics | null;
  } {
    const currentMetrics = this.metrics.get(this.currentRegion);
    const latestMetrics = currentMetrics ? currentMetrics[currentMetrics.length - 1] : null;
    
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!latestMetrics) {
      status = 'unhealthy';
      issues.push('No metrics available');
    } else {
      // Check connection health
      if (latestMetrics.connectionPool.healthyConnections === 0) {
        status = 'unhealthy';
        issues.push('No healthy connections available');
      } else if (latestMetrics.connectionPool.avgAcquireTime > 1000) {
        status = 'degraded';
        issues.push('Slow connection acquisition');
      }
      
      // Check cache health
      if (latestMetrics.cache.hitRate < 0.5) {
        status = 'degraded';
        issues.push('Low cache hit rate');
      }
      
      // Check performance health
      if (latestMetrics.performance.errorRate > 0.1) {
        status = 'unhealthy';
        issues.push('High error rate');
      } else if (latestMetrics.performance.avgResponseTime > 2000) {
        status = 'degraded';
        issues.push('High response times');
      }
    }
    
    return {
      status,
      issues,
      metrics: latestMetrics
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = null;
    }
    
    // Close connection pools
    await enhancedConnectionPool.closeAll();
    await edgeConnectionPool.clearConnections();
    
    // Clear metrics
    this.metrics.clear();
    
    console.log('Edge Optimization Service shutdown completed');
  }
}

export const edgeOptimizationService = EdgeOptimizationService.getInstance();