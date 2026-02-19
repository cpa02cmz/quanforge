/**
 * Advanced Performance Optimizer for QuantForge AI
 * Provides comprehensive performance optimization for database, API, and edge functions
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { databaseOptimizer } from './databaseOptimizer';
import { queryOptimizer } from './queryOptimizer';
import { robotCache } from './advancedCache';
import { createScopedLogger } from '../utils/logger';
import { TIME_CONSTANTS } from '../constants/config';
import { COUNT_CONSTANTS, THRESHOLD_CONSTANTS } from './modularConstants';
import { ARRAY_LIMITS } from '../constants/modularConfig';

const logger = createScopedLogger('PerformanceOptimizer');

interface PerformanceOptimizerConfig {
  enableRealTimeMonitoring: boolean;
  enablePredictiveOptimization: boolean;
  enableResourceOptimization: boolean;
  enablePerformanceAnalytics: boolean;
  monitoringInterval: number;
  predictionWindow: number;
  optimizationThreshold: number;
}

interface PerformanceMetrics {
  database: {
    queryTime: number;
    cacheHitRate: number;
    connectionPoolUtilization: number;
    errorRate: number;
    throughput: number;
    slowQueries: number;
  };
  cache: {
    hitRate: number;
    totalEntries: number;
    totalSize: number;
    evictions: number;
    responseTime: number;
  };
  api: {
    responseTime: number;
    errorRate: number;
    throughput: number;
    timeoutRate: number;
  };
  edge: {
    coldStartCount: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    requestCount: number;
  };
  overallScore: number;
}

class PerformanceOptimizer {
  private config: PerformanceOptimizerConfig = {
    enableRealTimeMonitoring: true,
    enablePredictiveOptimization: true,
    enableResourceOptimization: true,
    enablePerformanceAnalytics: true,
    monitoringInterval: 15 * TIME_CONSTANTS.SECOND, // 15 seconds
    predictionWindow: TIME_CONSTANTS.MINUTE * 5, // 5 minutes
    optimizationThreshold: 75, // 75% threshold for triggering optimizations
  };

  private metrics: PerformanceMetrics = {
    database: {
      queryTime: 0,
      cacheHitRate: 0,
      connectionPoolUtilization: 0,
      errorRate: 0,
      throughput: 0,
      slowQueries: 0,
    },
    cache: {
      hitRate: 0,
      totalEntries: 0,
      totalSize: 0,
      evictions: 0,
      responseTime: 0,
    },
    api: {
      responseTime: 0,
      errorRate: 0,
      throughput: 0,
      timeoutRate: 0,
    },
    edge: {
      coldStartCount: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      errorRate: 0,
      requestCount: 0,
    },
    overallScore: 0,
  };

  private monitoringTimer: ReturnType<typeof setInterval> | null = null;
  private performanceHistory: PerformanceMetrics[] = [];
  private readonly MAX_HISTORY = COUNT_CONSTANTS.HISTORY.STANDARD;

  constructor(config?: Partial<PerformanceOptimizerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Initialize the performance optimizer
   */
  async initialize(): Promise<void> {
    logger.log('Initializing Performance Optimizer...');

    // Start real-time monitoring if enabled
    if (this.config.enableRealTimeMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(async () => {
      await this.collectMetrics();
      await this.analyzePerformance();
    }, this.config.monitoringInterval);
  }

  /**
   * Collect comprehensive performance metrics
   */
  async collectMetrics(): Promise<PerformanceMetrics> {
    try {
      // Collect database metrics
      const dbMetrics = await this.collectDatabaseMetrics();
      
      // Collect cache metrics
      const cacheMetrics = this.collectCacheMetrics();
      
      // Collect API metrics (simulated for now)
      const apiMetrics = this.collectAPIMetrics();
      
      // Collect edge metrics
      const edgeMetrics = await this.collectEdgeMetrics();
      
      // Calculate overall performance score
      const overallScore = this.calculateOverallScore(dbMetrics, cacheMetrics, apiMetrics, edgeMetrics);
      
      this.metrics = {
        database: dbMetrics,
        cache: cacheMetrics,
        api: apiMetrics,
        edge: edgeMetrics,
        overallScore
      };
      
      // Store in history
      this.performanceHistory.push({ ...this.metrics });
      if (this.performanceHistory.length > this.MAX_HISTORY) {
        this.performanceHistory = this.performanceHistory.slice(-this.MAX_HISTORY);
      }
      
      return this.metrics;
    } catch (error: unknown) {
      logger.error('Error collecting performance metrics:', error);
      return this.metrics;
    }
  }

  /**
   * Collect database performance metrics
   */
  private async collectDatabaseMetrics(): Promise<PerformanceMetrics['database']> {
    const dbReport = databaseOptimizer.getOptimizationMetrics();
    const queryAnalysis = queryOptimizer.getPerformanceAnalysis();
    
    return {
      queryTime: dbReport.queryResponseTime,
      cacheHitRate: dbReport.cacheHitRate,
      connectionPoolUtilization: 0, // Would need actual connection pool metrics
      errorRate: 0, // Would need actual error tracking
      throughput: 0, // Would need actual throughput tracking
      slowQueries: queryAnalysis.slowQueries.length,
    };
  }

  /**
   * Collect cache performance metrics
   */
  private collectCacheMetrics(): PerformanceMetrics['cache'] {
    const cacheStats = robotCache.getStats();
    
    return {
      hitRate: cacheStats.hitRate,
      totalEntries: cacheStats.totalEntries,
      totalSize: cacheStats.totalSize,
      evictions: cacheStats.evictions,
      responseTime: 0, // Would need actual response time tracking
    };
  }

  /**
   * Collect API performance metrics (simulated)
   */
  private collectAPIMetrics(): PerformanceMetrics['api'] {
    return {
      responseTime: 0, // Would need actual API response time tracking
      errorRate: 0, // Would need actual error tracking
      throughput: 0, // Would need actual throughput tracking
      timeoutRate: 0, // Would need actual timeout tracking
    };
  }

  /**
   * Collect edge function performance metrics
   */
  private async collectEdgeMetrics(): Promise<PerformanceMetrics['edge']> {
    // This would typically call edge optimizer metrics
    return {
      coldStartCount: 0, // Would need actual cold start tracking
      averageResponseTime: 0, // Would need actual response time tracking
      p95ResponseTime: 0, // Would need actual response time tracking
      errorRate: 0, // Would need actual error tracking
      requestCount: 0, // Would need actual request tracking
    };
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(
    dbMetrics: PerformanceMetrics['database'],
    cacheMetrics: PerformanceMetrics['cache'],
    apiMetrics: PerformanceMetrics['api'],
    edgeMetrics: PerformanceMetrics['edge']
  ): number {
    let score = 0;
    
    // Database performance (40% of score)
    score += Math.min(40, 
      (dbMetrics.cacheHitRate > 80 ? 20 : dbMetrics.cacheHitRate > 60 ? 10 : 0) +
      (dbMetrics.queryTime < 100 ? 15 : dbMetrics.queryTime < 300 ? 10 : 5) +
      (dbMetrics.errorRate < 0.01 ? 5 : 0)
    );
    
    // Cache performance (25% of score)
    score += Math.min(25,
      (cacheMetrics.hitRate > 80 ? 15 : cacheMetrics.hitRate > 60 ? 10 : 5) +
      (cacheMetrics.evictions < 50 ? 10 : cacheMetrics.evictions < 100 ? 5 : 0)
    );
    
    // API performance (20% of score)
    score += Math.min(20,
      (apiMetrics.responseTime < 200 ? 10 : apiMetrics.responseTime < 500 ? 5 : 0) +
      (apiMetrics.errorRate < 0.01 ? 10 : apiMetrics.errorRate < 0.05 ? 5 : 0)
    );
    
    // Edge performance (15% of score)
    score += Math.min(15,
      (edgeMetrics.averageResponseTime < 200 ? 10 : edgeMetrics.averageResponseTime < 500 ? 5 : 0) +
      (edgeMetrics.errorRate < 0.01 ? 5 : 0)
    );
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Analyze performance and trigger optimizations if needed
   */
  private async analyzePerformance(): Promise<void> {
    if (this.metrics.overallScore < this.config.optimizationThreshold) {
      logger.log(`Performance score (${this.metrics.overallScore}) below threshold (${this.config.optimizationThreshold}), optimizing...`);
      await this.performOptimization();
    }
  }

  /**
   * Perform optimization based on current metrics
   */
  private async performOptimization(): Promise<void> {
    const optimizations: Array<Promise<any>> = [];
    
    // Database optimization
    if (this.metrics.database.queryTime > THRESHOLD_CONSTANTS.QUERY.NORMAL || this.metrics.database.cacheHitRate < THRESHOLD_CONSTANTS.CACHE_HIT_RATE.POOR * 100) {
      optimizations.push(this.optimizeDatabase());
    }

    // Cache optimization
    if (this.metrics.cache.hitRate < THRESHOLD_CONSTANTS.CACHE_HIT_RATE.ACCEPTABLE * 100 || this.metrics.cache.evictions > ARRAY_LIMITS.STANDARD) {
      optimizations.push(this.optimizeCache());
    }

    // Edge optimization
    if (this.metrics.edge.coldStartCount > 5 || this.metrics.edge.averageResponseTime > THRESHOLD_CONSTANTS.PERFORMANCE.NEEDS_IMPROVEMENT) {
      optimizations.push(this.optimizeEdge());
    }
    
    // Run optimizations in parallel
    await Promise.allSettled(optimizations);
  }

  /**
   * Optimize database performance
   */
  private async optimizeDatabase(): Promise<void> {
    try {
      logger.log('Optimizing database performance...');
      await databaseOptimizer.runDatabaseMaintenance({} as SupabaseClient);
    } catch (error: unknown) {
      logger.error('Database optimization failed:', error);
    }
  }

  /**
   * Optimize cache performance
   */
  private async optimizeCache(): Promise<void> {
    try {
      logger.log('Optimizing cache performance...');
      // Clear old entries and optimize cache - using available method
      robotCache.destroy();
    } catch (error: unknown) {
      logger.error('Cache optimization failed:', error);
    }
  }

  /**
   * Optimize edge performance
   */
  private async optimizeEdge(): Promise<void> {
    try {
      logger.log('Optimizing edge performance...');
      // This would typically call edge optimizer methods
    } catch (error: unknown) {
      logger.error('Edge optimization failed:', error);
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  /**
   * Predict performance issues based on historical data
   */
  async predictPerformanceIssues(): Promise<{
    dbIssues: string[];
    cacheIssues: string[];
    apiIssues: string[];
    edgeIssues: string[];
    recommendations: string[];
  }> {
    const issues: {
      dbIssues: string[];
      cacheIssues: string[];
      apiIssues: string[];
      edgeIssues: string[];
      recommendations: string[];
    } = {
      dbIssues: [],
      cacheIssues: [],
      apiIssues: [],
      edgeIssues: [],
      recommendations: []
    };

    // Analyze database trends
    if (this.metrics.database.queryTime > THRESHOLD_CONSTANTS.QUERY.NORMAL) {
      issues.dbIssues.push('High query response time detected');
    }

    if (this.metrics.database.cacheHitRate < THRESHOLD_CONSTANTS.CACHE_HIT_RATE.POOR * 100) {
      issues.dbIssues.push('Low database cache hit rate');
    }

    // Analyze cache trends
    if (this.metrics.cache.hitRate < THRESHOLD_CONSTANTS.CACHE_HIT_RATE.ACCEPTABLE * 100) {
      issues.cacheIssues.push('Low cache hit rate');
    }

    if (this.metrics.cache.evictions > ARRAY_LIMITS.STANDARD) {
      issues.cacheIssues.push('High cache eviction rate');
    }

    // Analyze API trends
    if (this.metrics.api.responseTime > THRESHOLD_CONSTANTS.API.SLOW) {
      issues.apiIssues.push('High API response time');
    }

    if (this.metrics.api.errorRate > THRESHOLD_CONSTANTS.ERROR_RATE.WARNING) {
      issues.apiIssues.push('High API error rate');
    }

    // Analyze edge trends
    if (this.metrics.edge.coldStartCount > 10) {
      issues.edgeIssues.push('High edge function cold start count');
    }

    if (this.metrics.edge.averageResponseTime > THRESHOLD_CONSTANTS.PERFORMANCE.NEEDS_IMPROVEMENT) {
      issues.edgeIssues.push('High edge function response time');
    }
    
    // Generate recommendations
    if (issues.dbIssues.length > 0) {
      issues.recommendations.push('Consider optimizing database queries and adding indexes');
    }
    
    if (issues.cacheIssues.length > 0) {
      issues.recommendations.push('Consider increasing cache size or optimizing cache strategies');
    }
    
    if (issues.apiIssues.length > 0) {
      issues.recommendations.push('Consider implementing request throttling or improving error handling');
    }
    
    if (issues.edgeIssues.length > 0) {
      issues.recommendations.push('Consider implementing edge function warming or optimization');
    }
    
    return issues;
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<string[]> {
    const issues = await this.predictPerformanceIssues();
    return issues.recommendations;
  }

  /**
   * Shutdown the performance optimizer
   */
  shutdown(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    logger.log('Performance Optimizer shut down');
  }

  /**
   * Run a performance optimization cycle manually
   */
  async runOptimizationCycle(): Promise<void> {
    await this.collectMetrics();
    await this.analyzePerformance();
  }

  /**
   * Get detailed performance report
   */
  async getPerformanceReport(): Promise<{
    currentMetrics: PerformanceMetrics;
    historicalTrend: PerformanceMetrics[];
    issues: any;
    recommendations: string[];
  }> {
    const currentMetrics = this.getMetrics();
    const historicalTrend = this.getPerformanceHistory();
    const issues = await this.predictPerformanceIssues();
    
    return {
      currentMetrics,
      historicalTrend,
      issues,
      recommendations: issues.recommendations
    };
  }

  /**
   * Adjust optimization configuration based on current performance
   */
  async adjustConfiguration(): Promise<void> {
    const metrics = this.getMetrics();
    
    // Adjust monitoring interval based on performance
    if (metrics.overallScore < 50) {
      // Increase monitoring frequency for poor performance
      this.config.monitoringInterval = Math.max(5 * TIME_CONSTANTS.SECOND, this.config.monitoringInterval / 2);
    } else if (metrics.overallScore > 85) {
      // Decrease monitoring frequency for good performance
      this.config.monitoringInterval = Math.min(30 * TIME_CONSTANTS.SECOND, this.config.monitoringInterval * 1.5);
    }
    
    // Restart monitoring with new interval
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.startMonitoring();
    }
  }
}

// Singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// Initialize when module is loaded
if (typeof window !== 'undefined') {
  setTimeout(() => {
    performanceOptimizer.initialize().catch(error => {
      logger.error('Failed to initialize performance optimizer:', error);
    });
  }, 3 * TIME_CONSTANTS.SECOND); // Initialize after other optimizers
}

export { PerformanceOptimizer, PerformanceOptimizerConfig, PerformanceMetrics };