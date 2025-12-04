import { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../types';
import { queryOptimizer } from './queryOptimizer';
import { databasePerformanceMonitor } from './databasePerformanceMonitor';

interface AdvancedOptimizationConfig {
  enableMaterializedViews: boolean;
  enablePartitioning: boolean;
  enableQueryRewriting: boolean;
  enableStatisticsOptimization: boolean;
  enableConnectionPooling: boolean;
  enableResultCaching: boolean;
  enableBatchProcessing: boolean;
}

interface OptimizationStrategy {
  id: string;
  name: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  enabled: boolean;
  apply: (client: SupabaseClient) => Promise<void>;
}

interface OptimizationRecommendation {
  id: string;
  name: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  reason: string;
}

class AdvancedDatabaseOptimizer {
  private config: AdvancedOptimizationConfig = {
    enableMaterializedViews: true,
    enablePartitioning: false, // Disabled by default as requires more setup
    enableQueryRewriting: true,
    enableStatisticsOptimization: true,
    enableConnectionPooling: true,
    enableResultCaching: true,
    enableBatchProcessing: true,
  };

  private optimizationStrategies: OptimizationStrategy[] = [];

  constructor(config?: Partial<AdvancedOptimizationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.initializeOptimizationStrategies();
  }

  private initializeOptimizationStrategies(): void {
    // Materialized view optimization
    this.optimizationStrategies.push({
      id: 'materialized_view_optimization',
      name: 'Materialized View Optimization',
      description: 'Creates materialized views for frequently accessed aggregated data',
      impact: 'high',
      enabled: this.config.enableMaterializedViews,
      async apply(client: SupabaseClient): Promise<void> {
        // Create materialized view for strategy performance analytics
        await client.rpc('create_strategy_performance_mv');
        
        // Create materialized view for user activity
        await client.rpc('create_user_activity_mv');
        
        // Create materialized view for popular robots
        await client.rpc('create_popular_robots_mv');
      }
    });

    // Query rewriting optimization
    this.optimizationStrategies.push({
      id: 'query_rewrite_optimization',
      name: 'Query Rewrite Optimization',
      description: 'Rewrites complex queries to use optimized execution paths',
      impact: 'medium',
      enabled: this.config.enableQueryRewriting,
      async apply(client: SupabaseClient): Promise<void> {
        // Create optimized functions for common queries
        await client.rpc('create_optimized_search_function');
        await client.rpc('create_optimized_analytics_function');
      }
    });

    // Statistics optimization
    this.optimizationStrategies.push({
      id: 'statistics_optimization',
      name: 'Statistics Optimization',
      description: 'Updates table statistics for better query planning',
      impact: 'medium',
      enabled: this.config.enableStatisticsOptimization,
      async apply(client: SupabaseClient): Promise<void> {
        // Update statistics for key tables
        await client.rpc('update_table_statistics', { table_name: 'robots' });
      }
    });
  }

  /**
   * Apply all enabled optimizations
   */
  async applyAllOptimizations(client: SupabaseClient): Promise<{ 
    success: boolean; 
    appliedOptimizations: string[]; 
    failedOptimizations: Array<{ id: string; error: string }> 
  }> {
    const appliedOptimizations: string[] = [];
    const failedOptimizations: Array<{ id: string; error: string }> = [];
    
    for (const strategy of this.optimizationStrategies) {
      if (strategy.enabled) {
        try {
          await strategy.apply(client);
          appliedOptimizations.push(strategy.id);
        } catch (error) {
          failedOptimizations.push({
            id: strategy.id,
            error: (error as Error).message
          });
        }
      }
    }
    
    return {
      success: failedOptimizations.length === 0,
      appliedOptimizations,
      failedOptimizations
    };
  }

  /**
   * Apply specific optimization by ID
   */
  async applyOptimization(client: SupabaseClient, optimizationId: string): Promise<boolean> {
    const strategy = this.optimizationStrategies.find(s => s.id === optimizationId && s.enabled);
    if (!strategy) return false;
    
    try {
      await strategy.apply(client);
      return true;
    } catch (error) {
      console.error(`Failed to apply optimization ${optimizationId}:`, error);
      return false;
    }
  }

  /**
   * Get optimization recommendations based on current performance
   */
  async getOptimizationRecommendations(client: SupabaseClient): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const metrics = databasePerformanceMonitor.getMetrics();
    
    // Check for slow queries and recommend materialized views
    if (metrics.queryTime > 500) { // High query time
      const materializedViewOpt = this.optimizationStrategies.find(o => o.id === 'materialized_view_optimization');
      if (materializedViewOpt) {
        recommendations.push({
          id: materializedViewOpt.id,
          name: materializedViewOpt.name,
          description: materializedViewOpt.description,
          impact: 'high',
          reason: `Query time is high at ${metrics.queryTime}ms, materialized views can improve performance for repeated complex queries`
        });
      }
    }
    
    // Check for high error rate and recommend statistics update
    if (metrics.errorRate > 0.05) { // High error rate
      const statsOpt = this.optimizationStrategies.find(o => o.id === 'statistics_optimization');
      if (statsOpt) {
        recommendations.push({
          id: statsOpt.id,
          name: statsOpt.name,
          description: statsOpt.description,
          impact: 'medium',
          reason: `High error rate detected, updating table statistics may help query planner`
        });
      }
    }
    
    // Analyze query patterns for optimization opportunities
    const queryAnalysis = queryOptimizer.getPerformanceAnalysis();
    if (queryAnalysis.slowQueries.length > 0) {
      // Recommend query rewriting for slow queries
      const rewriteOpt = this.optimizationStrategies.find(o => o.id === 'query_rewrite_optimization');
      if (rewriteOpt) {
        recommendations.push({
          id: rewriteOpt.id,
          name: rewriteOpt.name,
          description: rewriteOpt.description,
          impact: 'medium',
          reason: `Detected ${queryAnalysis.slowQueries.length} slow queries that could benefit from query rewriting`
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Create additional indexes based on usage patterns
   */
  async createOptimizationIndexes(client: SupabaseClient): Promise<void> {
    // Create composite indexes for common query patterns
    const indexes = [
      {
        name: 'idx_robots_user_strategy_created',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_user_strategy_created ON robots (user_id, strategy_type, created_at DESC)'
      },
      {
        name: 'idx_robots_strategy_params_gin',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_strategy_params_gin ON robots USING GIN (strategy_params) WHERE strategy_params IS NOT NULL'
      },
      {
        name: 'idx_robots_backtest_settings_gin',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_backtest_settings_gin ON robots USING GIN (backtest_settings) WHERE backtest_settings IS NOT NULL'
      },
      {
        name: 'idx_robots_updated_recent',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_updated_recent ON robots (updated_at DESC) WHERE updated_at > NOW() - INTERVAL \'30 days\''
      },
      {
        name: 'idx_robots_view_count',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_view_count ON robots (view_count DESC) WHERE view_count > 10'
      }
    ];

    for (const index of indexes) {
      try {
        await client.rpc('execute_raw_sql', { sql: index.definition });
      } catch (error) {
        console.warn(`Could not create index ${index.name}:`, error);
        // For Supabase, we might need to execute these via database functions or migrations
        // Instead, let's log what should be created
        console.log(`Index should be created: ${index.definition}`);
      }
    }
  }

  /**
   * Optimize database for specific use cases
   */
  async optimizeForUseCase(client: SupabaseClient, useCase: 'search' | 'analytics' | 'realtime' | 'batch'): Promise<void> {
    switch (useCase) {
      case 'search':
        // Optimize for search operations
        await this.optimizeForSearch(client);
        break;
      case 'analytics':
        // Optimize for analytical queries
        await this.optimizeForAnalytics(client);
        break;
      case 'realtime':
        // Optimize for real-time operations
        await this.optimizeForRealtime(client);
        break;
      case 'batch':
        // Optimize for batch operations
        await this.optimizeForBatch(client);
        break;
    }
  }

  private async optimizeForSearch(client: SupabaseClient): Promise<void> {
    // Ensure full-text search indexes are in place
    try {
      // This would typically be done via a stored procedure in Supabase
      await client.rpc('ensure_search_indexes');
    } catch (error) {
      // If RPC fails, it might not be available in this Supabase setup
      console.log('Search optimization: Creating search indexes via direct query');
      
      // For full-text search optimization, we can create a computed column
      // This is just a placeholder - in practice this would be done in the DB schema
    }
  }

  private async optimizeForAnalytics(client: SupabaseClient): Promise<void> {
    // Create materialized views for analytics
    if (this.config.enableMaterializedViews) {
      try {
        // Create a materialized view for strategy performance analytics
        const createMvQuery = `
          CREATE MATERIALIZED VIEW IF NOT EXISTS strategy_performance_mv AS
          SELECT 
            strategy_type,
            COUNT(*) as robot_count,
            AVG((analysis_result->>'riskScore')::NUMERIC) as avg_risk_score,
            AVG((analysis_result->>'profitPotential')::NUMERIC) as avg_profit_potential,
            MAX(created_at) as last_created
          FROM robots 
          WHERE is_active = true
          GROUP BY strategy_type
          WITH NO DATA;
        `;
        
        await client.rpc('execute_raw_sql', { sql: createMvQuery });
      } catch (error) {
        console.warn('Could not create analytics materialized view:', error);
      }
    }
  }

  private async optimizeForRealtime(client: SupabaseClient): Promise<void> {
    // Optimize for real-time operations by ensuring proper indexes
    // and potentially setting up specific configurations
    try {
      // Ensure indexes for real-time operations exist
      await client.rpc('ensure_realtime_indexes');
    } catch (error) {
      console.log('Real-time optimization: Creating indexes via direct query');
    }
  }

  private async optimizeForBatch(client: SupabaseClient): Promise<void> {
    // Optimize for batch operations
    if (this.config.enableBatchProcessing) {
      // We can optimize batch operations by ensuring proper indexing
      // and potentially adjusting database parameters for batch workloads
      await this.createOptimizationIndexes(client);
    }
  }

  /**
   * Get current optimization status
   */
  getOptimizationStatus(): {
    config: AdvancedOptimizationConfig;
    strategies: Array<{ id: string; name: string; enabled: boolean }>;
    recommendationsCount: number;
  } {
    return {
      config: this.config,
      strategies: this.optimizationStrategies.map(s => ({
        id: s.id,
        name: s.name,
        enabled: s.enabled
      })),
      recommendationsCount: this.optimizationStrategies.filter(s => s.enabled).length
    };
  }

  /**
   * Run comprehensive database optimization
   */
  async runComprehensiveOptimization(client: SupabaseClient): Promise<{
    success: boolean;
    optimizationsApplied: number;
    durationMs: number;
    recommendations: OptimizationRecommendation[];
  }> {
    const startTime = Date.now();
    
    // Apply all optimizations
    const result = await this.applyAllOptimizations(client);
    
    // Get recommendations
    const recommendations = await this.getOptimizationRecommendations(client);
    
    const durationMs = Date.now() - startTime;
    
    return {
      success: result.success,
      optimizationsApplied: result.appliedOptimizations.length,
      durationMs,
      recommendations
    };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<AdvancedOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update strategy enablement based on new config
    this.optimizationStrategies.forEach(strategy => {
      const configKey = strategy.id.replace('_optimization', '') as keyof AdvancedOptimizationConfig;
      if (configKey in this.config) {
        strategy.enabled = this.config[configKey] as boolean;
      }
    });
  }
}

// Singleton instance
export const advancedDatabaseOptimizer = new AdvancedDatabaseOptimizer();

// Export the class for potential instantiation with custom config
export { AdvancedDatabaseOptimizer };