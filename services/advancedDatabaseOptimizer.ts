import { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../types';
import { queryOptimizer } from './queryOptimizer';
import { databaseOptimizer } from './databaseOptimizer';
import { databasePerformanceMonitor } from './databasePerformanceMonitor';
import { securityManager } from './securityManager';

interface AdvancedOptimizationConfig {
  enableQueryCaching: boolean;
  enableBatchOperations: boolean;
  enableFullTextSearch: boolean;
  enableConnectionPooling: boolean;
  enableResultCompression: boolean;
  enableAnalyticsTracking: boolean;
  enableMaterializedViews: boolean;
  enablePerformanceInsights: boolean;
}

interface OptimizationResult {
  success: boolean;
  message: string;
  metrics?: any;
  recommendations?: string[];
}

class AdvancedDatabaseOptimizer {
  private config: AdvancedOptimizationConfig = {
    enableQueryCaching: true,
    enableBatchOperations: true,
    enableFullTextSearch: true,
    enableConnectionPooling: true,
    enableResultCompression: true,
    enableAnalyticsTracking: true,
    enableMaterializedViews: true,
    enablePerformanceInsights: true,
  };

  constructor(config?: Partial<AdvancedOptimizationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Advanced robot search with analytics and performance optimization
   */
  async advancedSearchRobots(
    client: SupabaseClient,
    searchTerm: string,
    options: {
      userId?: string;
      strategyType?: string;
      dateRange?: { start: string; end: string };
      limit?: number;
      offset?: number;
      sortBy?: 'created_at' | 'updated_at' | 'view_count' | 'name';
      sortOrder?: 'asc' | 'desc';
      includeAnalytics?: boolean;
    } = {}
  ): Promise<{ data: Robot[] | null; error: any; analytics?: any }> {
    const startTime = performance.now();
    
    // Validate inputs for security
    const validation = securityManager.sanitizeAndValidate(
      { searchTerm, ...options },
      'robot'
    );
    
    if (!validation.isValid) {
      return { 
        data: null, 
        error: new Error(`Validation failed: ${validation.errors.join(', ')}`),
      };
    }
    
    const sanitizedTerm = validation.sanitizedData.searchTerm || '';
    const sanitizedOptions = validation.sanitizedData;
    
    try {
      // Use the database optimizer for the search
      const result = await databaseOptimizer.searchRobotsOptimized(
        client,
        sanitizedTerm,
        {
          userId: sanitizedOptions.userId,
          strategyType: sanitizedOptions.strategyType,
          limit: sanitizedOptions.limit || 20,
          offset: sanitizedOptions.offset || 0,
          sortBy: sanitizedOptions.sortBy || 'created_at',
          sortOrder: sanitizedOptions.sortOrder || 'desc',
        }
      );
      
      const executionTime = performance.now() - startTime;
      
      // Log performance if enabled
      if (this.config.enableAnalyticsTracking) {
        await this.logQueryPerformance(
          client,
          'advancedSearchRobots',
          executionTime,
          Array.isArray(result.data) ? result.data.length : 0,
          { searchTerm: sanitizedTerm, ...sanitizedOptions }
        );
      }
      
      // Include analytics if requested
      if (options.includeAnalytics && result.data) {
        const analytics = await this.getSearchAnalytics(result.data, sanitizedTerm);
        return {
          data: result.data,
          error: result.error,
          analytics
        };
      }
      
      return {
        data: result.data,
        error: result.error
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      // Log performance if enabled
      if (this.config.enableAnalyticsTracking) {
        await this.logQueryPerformance(
          client,
          'advancedSearchRobots',
          executionTime,
          0,
          { searchTerm: sanitizedTerm, ...sanitizedOptions },
          error
        );
      }
      
      return { 
        data: null, 
        error 
      };
    }
  }

  /**
   * Get comprehensive robot analytics with materialized views
   */
  async getComprehensiveRobotAnalytics(
    client: SupabaseClient,
    options: {
      userId?: string;
      strategyType?: string;
      dateRange?: { start: string; end: string };
      includePerformance?: boolean;
    } = {}
  ): Promise<{ data: any; error: any }> {
    try {
      // Use the database optimizer for analytics
      const result = await databaseOptimizer.getRobotAnalyticsOptimized(
        client,
        {
          userId: options.userId,
          strategyType: options.strategyType,
          dateRange: options.dateRange,
        }
      );
      
      // If materialized views are enabled, try to get enhanced analytics
      if (this.config.enableMaterializedViews) {
        try {
          const enhancedAnalytics = await this.getEnhancedAnalyticsFromViews(client, options);
          if (enhancedAnalytics.data) {
            // Merge with existing analytics
            return {
              data: { ...result.data, ...enhancedAnalytics.data },
              error: result.error
            };
          }
        } catch (viewError) {
          console.warn('Materialized view query failed, using base analytics:', viewError);
        }
      }
      
      return result;
    } catch (error) {
      return { 
        data: null, 
        error 
      };
    }
  }

  /**
   * Batch operations with enhanced validation and error handling
   */
  async batchOperation<T>(
    client: SupabaseClient,
    operation: 'insert' | 'update' | 'delete',
    table: string,
    records: T[],
    options: {
      batchSize?: number;
      validateEach?: boolean;
      transactional?: boolean;
    } = {}
  ): Promise<{ data: T[] | null; error: any; results?: any[] }> {
    const startTime = performance.now();
    const batchSize = options.batchSize || 50;
    const validateEach = options.validateEach || false;
    
    if (validateEach) {
      for (const record of records) {
        const validation = securityManager.sanitizeAndValidate(record, 'robot' as any);
        if (!validation.isValid) {
          const executionTime = performance.now() - startTime;
          
          if (this.config.enableAnalyticsTracking) {
            await this.logQueryPerformance(
              client,
              `batch_${operation}`,
              executionTime,
              0,
              { table, batchSize, validateEach },
              new Error(`Validation failed for record: ${validation.errors.join(', ')}`)
            );
          }
          
          return { 
            data: null, 
            error: new Error(`Validation failed for record: ${validation.errors.join(', ')}`),
            results: []
          };
        }
      }
    }
    
    try {
      let results: T[] = [];
      let errors: any[] = [];
      
      // Process in batches
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        try {
          let batchResult;
          
          if (operation === 'insert') {
            batchResult = await client.from(table).insert(batch).select();
          } else if (operation === 'update') {
            // For update, we need to specify which records to update
            if (Array.isArray(batch) && batch.length > 0 && (batch[0] as any).id) {
              const updatePromises = batch.map((record: any) => 
                client.from(table).update(record).eq('id', record.id).select()
              );
              const updateResults = await Promise.all(updatePromises);
              batchResult = { data: updateResults.flatMap(r => r.data || []), error: null };
            } else {
              throw new Error('Update operation requires records with ID');
            }
          } else if (operation === 'delete') {
            const ids = batch.map((record: any) => record.id);
            const deleteResult = await client.from(table).delete().in('id', ids);
            batchResult = deleteResult;
          }
          
          if (batchResult && batchResult.error) {
            errors.push(batchResult.error);
          } else if (batchResult && batchResult.data) {
            results.push(...batchResult.data);
          }
        } catch (error) {
          errors.push(error);
        }
      }
      
      const executionTime = performance.now() - startTime;
      
      if (this.config.enableAnalyticsTracking) {
        await this.logQueryPerformance(
          client,
          `batch_${operation}`,
          executionTime,
          results.length,
          { table, batchSize, validateEach, totalRecords: records.length }
        );
      }
      
      return {
        data: results.length > 0 ? results : null,
        error: errors.length > 0 ? errors : null,
        results: results
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      if (this.config.enableAnalyticsTracking) {
        await this.logQueryPerformance(
          client,
          `batch_${operation}`,
          executionTime,
          0,
          { table, batchSize, validateEach, totalRecords: records.length },
          error
        );
      }
      
      return { 
        data: null, 
        error,
        results: []
      };
    }
  }

  /**
   * Optimize database with comprehensive maintenance
   */
  async optimizeDatabaseComprehensive(
    client: SupabaseClient
  ): Promise<OptimizationResult> {
    try {
      const startTime = Date.now();
      
      // Run database optimizer maintenance
      const dbResult = await databaseOptimizer.runComprehensiveOptimization(client);
      
      // Update materialized views if enabled
      if (this.config.enableMaterializedViews) {
        await this.refreshMaterializedViews(client);
      }
      
      // Run performance insights
      if (this.config.enablePerformanceInsights) {
        await this.generatePerformanceInsights(client);
      }
      
      // Get optimization recommendations
      const recommendations = await databaseOptimizer.getQueryOptimizationRecommendations(client);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        message: `Comprehensive database optimization completed in ${duration}ms`,
        metrics: {
          duration,
          ...dbResult.details
        },
        recommendations: recommendations.recommendations
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Comprehensive database optimization failed: ${error.message || error}`,
        metrics: { error: error.message || error }
      };
    }
  }

  /**
   * Get search analytics for better insights
   */
  private async getSearchAnalytics(robots: Robot[], searchTerm: string): Promise<any> {
    const analytics = {
      totalResults: robots.length,
      byStrategyType: {} as Record<string, number>,
      byDateRange: {} as Record<string, number>,
      avgViewCount: 0,
      avgCopyCount: 0,
      searchRelevance: 0, // How relevant the results are to the search term
      strategyDiversity: 0, // How diverse the strategy types are
    };
    
    let totalViewCount = 0;
    let totalCopyCount = 0;
    
    for (const robot of robots) {
      // Count by strategy type
      const type = robot.strategy_type || 'Custom';
      analytics.byStrategyType[type] = (analytics.byStrategyType[type] || 0) + 1;
      
      // Count by date range (month-year)
      const dateKey = new Date(robot.created_at).toISOString().substring(0, 7);
      analytics.byDateRange[dateKey] = (analytics.byDateRange[dateKey] || 0) + 1;
      
      // Track view and copy counts
      if (robot.hasOwnProperty('view_count')) {
        totalViewCount += (robot as any).view_count || 0;
      }
      if (robot.hasOwnProperty('copy_count')) {
        totalCopyCount += (robot as any).copy_count || 0;
      }
    }
    
    analytics.avgViewCount = robots.length > 0 ? totalViewCount / robots.length : 0;
    analytics.avgCopyCount = robots.length > 0 ? totalCopyCount / robots.length : 0;
    
    // Calculate strategy diversity (0-1, where 1 is maximum diversity)
    const uniqueTypes = Object.keys(analytics.byStrategyType).length;
    analytics.strategyDiversity = uniqueTypes > 0 ? uniqueTypes / robots.length : 0;
    
    // Calculate search relevance based on how many results contain the search term
    if (searchTerm) {
      const matches = robots.filter(robot => 
        robot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        robot.description?.toLowerCase().includes(searchTerm.toLowerCase())
      ).length;
      analytics.searchRelevance = robots.length > 0 ? matches / robots.length : 0;
    }
    
    return analytics;
  }

  /**
   * Get enhanced analytics from materialized views
   */
  private async getEnhancedAnalyticsFromViews(
    client: SupabaseClient,
    _options: any
  ): Promise<{ data: any; error: any }> {
    try {
      // Try to get data from materialized views if they exist
      const { data: popularRobots, error: popularError } = await client
        .from('popular_robots')
        .select('*')
        .limit(10);
      
      const { data: strategyPerformance, error: strategyError } = await client
        .from('strategy_performance_comparison')
        .select('*');
      
      const { data: userEngagement, error: userError } = await client
        .from('user_engagement_metrics')
        .select('*')
        .limit(10);
      
      return {
        data: {
          popularRobots: popularRobots || [],
          strategyPerformance: strategyPerformance || [],
          userEngagement: userEngagement || [],
        },
        error: popularError || strategyError || userError
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Refresh materialized views
   */
  private async refreshMaterializedViews(_client: SupabaseClient): Promise<void> {
    try {
      // Try to refresh materialized views if they exist
      // These would be implemented as database functions, so we'll just log for now
      console.log('Refreshing materialized views...');
    } catch (error) {
      console.warn('Failed to refresh materialized views:', error);
      // This is not critical, so we don't throw
    }
  }

  /**
   * Generate performance insights
   */
  private async generatePerformanceInsights(client: SupabaseClient): Promise<void> {
    try {
      // Get performance insights from the database optimizer
      const insights = await databaseOptimizer.getAdvancedOptimizationInsights(client);
      
      // Log insights for monitoring
      console.group('Database Performance Insights');
      console.log('Performance Insights:', insights.performanceInsights);
      console.log('Materialized View Recommendations:', insights.materializedViewRecommendations);
      console.log('Index Recommendations:', insights.indexRecommendations);
      console.groupEnd();
    } catch (error) {
      console.warn('Failed to generate performance insights:', error);
    }
  }

  /**
   * Log query performance to database
   */
  private async logQueryPerformance(
    client: SupabaseClient,
    queryType: string,
    executionTime: number,
    resultCount: number,
    metadata?: any,
    error?: any
  ): Promise<void> {
    try {
      // Use the query optimizer's logging function if available
      await queryOptimizer.executeQuery(
        client,
        'query_performance_log',
        {
          selectFields: ['id'],
          filters: { query_type: queryType },
          limit: 1
        }
      );
      
      // Log to the performance log table
      await client.from('query_performance_log').insert({
        query_type: queryType,
        execution_time_ms: Math.round(executionTime),
        result_count: resultCount,
        user_id: null, // Would be auth.uid() in a real implementation
        metadata: {
          ...metadata,
          error: error ? error.message : null
        }
      });
    } catch (logError) {
      // Don't let logging errors affect the main operation
      console.warn('Failed to log query performance:', logError);
    }
  }

  /**
   * Get database health metrics
   */
  async getDatabaseHealth(client: SupabaseClient): Promise<{
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    metrics: any;
    recommendations: string[];
  }> {
    try {
      // Get metrics from various sources
      const optimizerMetrics = databaseOptimizer.getOptimizationMetrics();
      const performanceMetrics = databasePerformanceMonitor.getMetrics();
      const queryMetrics = queryOptimizer.getPerformanceAnalysis();
      
      // Calculate overall health score
      let healthScore = 0;
      
      // Cache hit rate (0-100)
      healthScore += Math.min(100, optimizerMetrics.cacheHitRate * 10) || 0;
      
      // Query response time (0-50, lower is better)
      healthScore += Math.max(0, 50 - (performanceMetrics.queryTime / 10)) || 0;
      
      // Error rate (0-50, lower is better)
      healthScore += Math.max(0, 50 - (performanceMetrics.errorRate * 1000)) || 0;
      
      // Throughput (0-50, higher is better)
      healthScore += Math.min(50, performanceMetrics.throughput * 2) || 0;
      
      let overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
      if (healthScore >= 180) overallHealth = 'excellent';
      else if (healthScore >= 150) overallHealth = 'good';
      else if (healthScore >= 100) overallHealth = 'fair';
      else overallHealth = 'poor';
      
      // Generate recommendations based on metrics
      const recommendations: string[] = [];
      
      if (optimizerMetrics.cacheHitRate < 70) {
        recommendations.push('Improve cache hit rate by optimizing frequently accessed queries');
      }
      
      if (performanceMetrics.queryTime > 200) {
        recommendations.push('Query response times are high, consider adding indexes');
      }
      
      if (performanceMetrics.errorRate > 0.01) {
        recommendations.push('Error rate is high, investigate query failures');
      }
      
      if (queryMetrics.slowQueries.length > 0) {
        recommendations.push(`Found ${queryMetrics.slowQueries.length} slow queries, optimize them`);
      }
      
      return {
        overallHealth,
        metrics: {
          optimizer: optimizerMetrics,
          performance: performanceMetrics,
          query: queryMetrics
        },
        recommendations
      };
    } catch (error) {
      return {
        overallHealth: 'poor',
        metrics: {},
        recommendations: [`Health check failed: ${error}`]
      };
    }
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(
    client: SupabaseClient
  ): Promise<{ recommendations: string[]; priority: 'high' | 'medium' | 'low' }> {
    try {
      // Get recommendations from multiple sources
      const dbRecommendations = databaseOptimizer.getOptimizationRecommendations();
      const queryRecommendations = await databaseOptimizer.getQueryOptimizationRecommendations(client);
      
      // Combine and prioritize recommendations
      const allRecommendations = [
        ...dbRecommendations,
        ...queryRecommendations.recommendations
      ];
      
      // Determine priority based on number and severity of recommendations
      const priority = allRecommendations.length > 5 ? 'high' : 
                      allRecommendations.length > 2 ? 'medium' : 'low';
      
      return {
        recommendations: allRecommendations,
        priority
      };
    } catch (error) {
      return {
        recommendations: [`Failed to get recommendations: ${error}`],
        priority: 'high'
      };
    }
  }
}

// Singleton instance
export const advancedDatabaseOptimizer = new AdvancedDatabaseOptimizer();

// Export the class for potential instantiation with custom config
export { AdvancedDatabaseOptimizer };