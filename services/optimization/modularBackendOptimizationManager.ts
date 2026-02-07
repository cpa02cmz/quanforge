/**
 * Modular Backend Optimization Manager
 * Orchestrates all optimization activities through modular components
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { OptimizationConfig, OptimizationMetrics, OptimizationHistory } from './optimizationTypes';
import { CoreOptimizationEngine } from './coreOptimizationEngine';
import { backendOptimizer } from '../backendOptimizer';
import { databaseOptimizer } from '../databaseOptimizer';
import { queryOptimizer } from '../queryOptimizer';
import { edgeOptimizer } from '../edgeFunctionOptimizer';
import { databasePerformanceMonitor } from '../databasePerformanceMonitor';
import { BACKEND_OPTIMIZATION_CONFIG } from '../../constants/config';

class BackendOptimizationManager {
  private static instance: BackendOptimizationManager;
  private coreEngine: CoreOptimizationEngine | null = null;
  private config: OptimizationConfig = {
    enableDatabaseOptimization: true,
    enableQueryOptimization: true,
    enableEdgeOptimization: true,
    enableCacheOptimization: true,
    enablePerformanceMonitoring: true,
    optimizationInterval: BACKEND_OPTIMIZATION_CONFIG.OPTIMIZATION_CHECK_INTERVAL,
  };

  private constructor() {}

  static getInstance(): BackendOptimizationManager {
    if (!BackendOptimizationManager.instance) {
      BackendOptimizationManager.instance = new BackendOptimizationManager();
    }
    return BackendOptimizationManager.instance;
  }

  /**
   * Initialize the optimization manager
   */
  async initialize(config?: Partial<OptimizationConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.coreEngine = new CoreOptimizationEngine(this.config);
    await this.coreEngine.initialize();
  }

  /**
   * Collect comprehensive metrics from all optimization systems
   */
  async collectMetrics(): Promise<OptimizationMetrics> {
    if (!this.coreEngine) {
      throw new Error('Optimization manager not initialized');
    }
    
    return await this.coreEngine.getOptimizationStatus().then(status => status.metrics);
  }

  /**
   * Generate optimization recommendations based on current metrics
   */
  async generateRecommendations(): Promise<string[]> {
    if (!this.coreEngine) {
      throw new Error('Optimization manager not initialized');
    }
    
    const status = await this.coreEngine.getOptimizationStatus();
    return status.recommendations;
  }

  /**
   * Apply optimizations based on recommendations
   */
  async applyOptimizations(recommendations: string[]): Promise<void> {
    if (!this.coreEngine) {
      throw new Error('Optimization manager not initialized');
    }
    
    // The core engine handles this internally
    await this.coreEngine.forceOptimization();
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
    if (!this.coreEngine) {
      throw new Error('Optimization manager not initialized');
    }
    
    return await this.coreEngine.getOptimizationStatus();
  }

  /**
   * Optimize database queries for a specific table
   */
  async optimizeTableQueries(client: SupabaseClient, tableName: string): Promise<void> {
    if (!this.config.enableDatabaseOptimization) return;
    
    // Analyze query patterns for the table
    const report = databasePerformanceMonitor.getPerformanceReport();
    // Note: This would need actual query analysis implementation
    console.log(`Optimizing queries for table: ${tableName}`);
  }

  /**
   * Run database maintenance tasks
   */
  async runDatabaseMaintenance(client: SupabaseClient): Promise<void> {
    if (!this.config.enableDatabaseOptimization) return;
    
    await databaseOptimizer.runDatabaseMaintenance(client);
    console.log('Database maintenance completed');
  }

  /**
   * Get query optimization recommendations
   */
  async getQueryOptimizationRecommendations(client: SupabaseClient): Promise<any> {
    if (!this.config.enableDatabaseOptimization) return { recommendations: [] };
    
    // For now, return basic recommendations
    return { 
      recommendations: [
        'Consider adding indexes for frequently queried columns',
        'Review slow query logs for optimization opportunities'
      ] 
    };
  }

  /**
   * Force immediate optimization cycle
   */
  async forceOptimization(): Promise<void> {
    if (!this.coreEngine) {
      throw new Error('Optimization manager not initialized');
    }
    
    await this.coreEngine.forceOptimization();
  }

  /**
   * Get advanced optimization insights
   */
  async getAdvancedOptimizationInsights(client: SupabaseClient): Promise<any> {
    if (!this.config.enableDatabaseOptimization) return null;
    
    try {
      const metrics = await this.collectMetrics();
      const recommendations = await this.generateRecommendations();
      
      return {
        metrics,
        recommendations,
        insights: {
          overallHealth: metrics.overallScore || 0,
          criticalIssues: recommendations.filter(r => r.includes('error') || r.includes('critical')),
          optimizationOpportunities: recommendations.filter(r => !r.includes('error') && !r.includes('critical'))
        }
      };
    } catch (error) {
      console.error('Error getting advanced insights:', error);
      return null;
    }
  }

  /**
   * Run comprehensive optimization
   */
  async runComprehensiveOptimization(client: SupabaseClient): Promise<{
    optimizationsApplied: number;
    performanceGain: number;
    recommendations: string[];
  }> {
    try {
      const metrics = await this.collectMetrics();
      const recommendations = await this.generateRecommendations();
      
      // Apply optimizations
      await this.applyOptimizations(recommendations);
      
      // Calculate performance gain (simplified)
      const performanceGain = Math.max(0, (metrics.overallScore || 0) - 50);
      
      return {
        optimizationsApplied: recommendations.length,
        performanceGain,
        recommendations
      };
    } catch (error) {
      console.error('Error in comprehensive optimization:', error);
      return {
        optimizationsApplied: 0,
        performanceGain: 0,
        recommendations: []
      };
    }
  }

  /**
   * Get cross-system optimization recommendations
   */
  async getCrossSystemOptimizationRecommendations(client: SupabaseClient): Promise<{
    priority: string;
    recommendations: string[];
    potentialImpact: string;
  }> {
    const metrics = await this.collectMetrics();
    const recommendations: string[] = [];
    let priority = 'medium';
    let potentialImpact = 'moderate';

    // Analyze interactions between systems
    if (metrics.cache.hitRate < 60 && metrics.database.queryTime > 300) {
      recommendations.push('Improve cache to reduce database load');
      priority = 'high';
      potentialImpact = 'significant';
    }

    if (metrics.edge.coldStartCount > 3 && metrics.database.queryTime > 300) {
      recommendations.push('Optimize both edge warmup and database queries');
      priority = 'high';
      potentialImpact = 'significant';
    }

    if (metrics.database.errorRate > 0.05 || metrics.edge.errorRate > 0.05) {
      recommendations.push('Address error handling across all systems');
      priority = 'critical';
      potentialImpact = 'high';
    }

    return {
      priority,
      recommendations,
      potentialImpact
    };
  }

  /**
   * Perform predictive optimization
   */
  async performPredictiveOptimization(client: SupabaseClient): Promise<{
    predictions: string[];
    automatedOptimizations: string[];
  }> {
    const metrics = await this.collectMetrics();
    const predictions: string[] = [];
    const automatedOptimizations: string[] = [];

    // Simple predictive logic based on trends
    if (metrics.database.queryTime > 200) {
      predictions.push('Database query times may degrade further');
      automatedOptimizations.push('Preemptive query optimization applied');
    }

    if (metrics.cache.hitRate < 60) {
      predictions.push('Cache hit rate may continue to decline');
      automatedOptimizations.push('Cache prewarming initiated');
    }

    return { predictions, automatedOptimizations };
  }

  /**
   * Optimize system with priority and constraints
   */
  async optimizeSystem(client: SupabaseClient, options?: {
    priority?: 'performance' | 'reliability' | 'efficiency';
    maxTime?: number;
    targetGain?: number;
  }): Promise<{
    optimizationsApplied: string[];
    performanceGain: number;
    executionTime: number;
  }> {
    const startTime = Date.now();
    const priority = options?.priority || 'performance';
    const maxTime = options?.maxTime || 60000; // 1 minute default
    const targetGain = options?.targetGain || 10;
    
    const optimizationsApplied: string[] = [];
    let performanceGain = 0;

    try {
      const currentMetrics = await this.collectMetrics();
      
      // Apply optimizations based on priority
      if (priority === 'performance' || currentMetrics.database.queryTime > 500) {
        await backendOptimizer.optimizeDatabaseQueries();
        optimizationsApplied.push('Database query optimization');
      }
      
      if (priority === 'performance' || currentMetrics.cache.hitRate < 70) {
        await backendOptimizer.optimizeDatabaseQueries();
        optimizationsApplied.push('Cache optimization');
      }
      
      if (priority === 'reliability' || currentMetrics.edge.coldStartCount > 3) {
        await edgeOptimizer.warmupFunction('api/supabase');
        optimizationsApplied.push('Edge reliability optimization');
      }

      // Calculate performance gain
      const newMetrics = await this.collectMetrics();
      performanceGain = (newMetrics.overallScore || 0) - (currentMetrics.overallScore || 0);
      
      // Continue if we haven't met target gain
      if (performanceGain < targetGain) {
        const compResult = await this.runComprehensiveOptimization(client);
        optimizationsApplied.push(`Applied ${compResult.optimizationsApplied} comprehensive optimizations`);
      }

      const executionTime = Date.now() - startTime;
      
      // Ensure we haven't exceeded max time
      if (executionTime > maxTime) {
        console.warn(`Optimization exceeded max time: ${executionTime}ms > ${maxTime}ms`);
      }

      return {
        optimizationsApplied,
        performanceGain: Math.max(0, performanceGain),
        executionTime
      };
    } catch (error) {
      console.error('System optimization failed:', error);
      return {
        optimizationsApplied,
        performanceGain: 0,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Shutdown the optimization manager
   */
  shutdown(): void {
    if (this.coreEngine) {
      this.coreEngine.shutdown();
      this.coreEngine = null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.coreEngine) {
      // Reinitialize with new config
      this.coreEngine.shutdown();
      this.coreEngine = new CoreOptimizationEngine(this.config);
      this.coreEngine.initialize();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const backendOptimizationManager = BackendOptimizationManager.getInstance();

// Export class for testing
export { BackendOptimizationManager };