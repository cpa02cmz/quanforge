/**
 * Core Optimization Engine
 * Central coordination for all optimization activities
 */

import { OptimizationMetrics, OptimizationConfig } from './optimizationTypes';
import { MetricsCollector } from './metricsCollector';
import { RecommendationEngine } from './recommendationEngine';
import { OptimizationApplier } from './optimizationApplier';

interface OptimizationHistory {
  timestamp: number;
  metrics: OptimizationMetrics;
  recommendations: string[];
}

export class CoreOptimizationEngine {
  private metricsCollector: MetricsCollector;
  private recommendationEngine: RecommendationEngine;
  private optimizationApplier: OptimizationApplier;
  private optimizationTimer: ReturnType<typeof setInterval> | null = null;
  private optimizationHistory: OptimizationHistory[] = [];
  
  private readonly MAX_OPTIMIZATION_HISTORY = 50;

  constructor(private config: OptimizationConfig) {
    this.metricsCollector = new MetricsCollector(config);
    this.recommendationEngine = new RecommendationEngine(config);
    this.optimizationApplier = new OptimizationApplier(config);
  }

  /**
   * Initialize the optimization engine
   */
  async initialize(): Promise<void> {
    await this.metricsCollector.initialize();
    await this.recommendationEngine.initialize();
    await this.optimizationApplier.initialize();
    
    this.startPeriodicOptimization();
  }

  /**
   * Start periodic optimization tasks
   */
  private startPeriodicOptimization(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }
    
    this.optimizationTimer = setInterval(async () => {
      await this.performOptimizationCycle();
    }, this.config.optimizationInterval);
  }

  /**
   * Perform a full optimization cycle
   */
  private async performOptimizationCycle(): Promise<void> {
    try {
      console.log('Starting optimization cycle...');
      
      // Collect current metrics
      const metrics = await this.metricsCollector.collectMetrics();
      
      // Generate recommendations
      const recommendations = await this.recommendationEngine.generateRecommendations(metrics);
      
      // Apply optimizations based on recommendations
      await this.optimizationApplier.applyOptimizations(recommendations);
      
      // Record optimization history
      this.optimizationHistory.push({
        timestamp: Date.now(),
        metrics,
        recommendations
      });
      
      // Keep history within limits
      if (this.optimizationHistory.length > this.MAX_OPTIMIZATION_HISTORY) {
        this.optimizationHistory = this.optimizationHistory.slice(-this.MAX_OPTIMIZATION_HISTORY);
      }
      
      console.log(`Optimization cycle completed. Applied ${recommendations.length} optimizations.`);
    } catch (error) {
      console.error('Error during optimization cycle:', error);
    }
  }

  /**
   * Get current optimization status
   */
  async getOptimizationStatus(): Promise<{
    metrics: OptimizationMetrics;
    recommendations: string[];
    lastOptimization: number;
    optimizationEnabled: boolean;
  }> {
    const metrics = await this.metricsCollector.collectMetrics();
    const recommendations = await this.recommendationEngine.generateRecommendations(metrics);
    
    return {
      metrics,
      recommendations,
      lastOptimization: this.optimizationHistory.length > 0 
        ? this.optimizationHistory[this.optimizationHistory.length - 1].timestamp 
        : 0,
      optimizationEnabled: this.optimizationTimer !== null,
    };
  }

  /**
   * Force immediate optimization cycle
   */
  async forceOptimization(): Promise<void> {
    await this.performOptimizationCycle();
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): OptimizationHistory[] {
    return [...this.optimizationHistory];
  }

  /**
   * Calculate overall optimization score
   */
  calculateOverallScore(dbMetrics: any, cacheMetrics: any, edgeMetrics: any): number {
    let score = 0;
    
    // Database performance (50 points)
    if (dbMetrics.queryTime < 100) score += 25; // Fast queries
    if (dbMetrics.cacheHitRate > 80) score += 15; // Good cache hit rate
    if (dbMetrics.errorRate < 0.01) score += 10; // Low error rate
    
    // Cache performance (30 points)
    if (cacheMetrics.hitRate > 80) score += 20; // Good cache hit rate
    if (cacheMetrics.evictions < 50) score += 10; // Low evictions
    
    // Edge performance (20 points)
    if (edgeMetrics.averageResponseTime < 200) score += 15; // Fast edge responses
    if (edgeMetrics.errorRate < 0.01) score += 5; // Low edge error rate
    
    return Math.min(100, score);
  }

  /**
   * Shutdown the optimization engine
   */
  shutdown(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = null;
    }
    
    this.optimizationApplier.shutdown();
    this.metricsCollector.shutdown();
  }
}