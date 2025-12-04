import { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../types';
import { queryOptimizer } from './queryOptimizer';

interface OptimizationConfig {
  enableQueryCaching: boolean;
  enableBatchOperations: boolean;
  enableFullTextSearch: boolean;
  enableConnectionPooling: boolean;
  enableResultCompression: boolean;
  enablePredictiveCaching: boolean;
  enableSemanticCaching: boolean;
  enableQueryBatching: boolean;
  enableSmartIndexing: boolean;
  enableMaterializedViews: boolean;
  enablePartitioning: boolean;
}

interface OptimizationMetrics {
  cacheHitRate: number;
  queryResponseTime: number;
  batchEfficiency: number;
  compressionRatio: number;
  totalOptimizedQueries: number;
  materializedViewUsage: number;
}

interface SearchParams {
  searchTerm?: string;
  strategyType?: string;
  userId?: string;
  dateRange?: { start: string; end: string };
  minRiskScore?: number;
  maxRiskScore?: number;
  minProfitPotential?: number;
  maxProfitPotential?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'created_at' | 'updated_at' | 'name' | 'view_count' | 'risk_score' | 'profit_potential';
  sortOrder?: 'asc' | 'desc';
}

class DatabaseOptimizerEnhanced {
  private config: OptimizationConfig = {
    enableQueryCaching: true,
    enableBatchOperations: true,
    enableFullTextSearch: true,
    enableConnectionPooling: true,
    enableResultCompression: true,
    enablePredictiveCaching: true,
    enableSemanticCaching: true,
    enableQueryBatching: true,
    enableSmartIndexing: true,
    enableMaterializedViews: true,
    enablePartitioning: true,
  };
  
  private metrics: OptimizationMetrics = {
    cacheHitRate: 0,
    queryResponseTime: 0,
    batchEfficiency: 0,
    compressionRatio: 0,
    totalOptimizedQueries: 0,
    materializedViewUsage: 0,
  };
  
  private optimizationHistory: Array<{
    operation: string;
    executionTime: number;
    timestamp: number;
    cacheHit: boolean;
  }> = [];

  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly DEFAULT_TTL = 600000; // 10 minutes

  // Generate query hash for caching
  private generateQueryHash(obj: any): string {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 16);
  }

  // Check cache
  private async checkCache(queryHash: string): Promise<any> {
    const cached = this.queryCache.get(queryHash);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return null;
  }

  // Set cache
  private async setCache(queryHash: string, data: any): Promise<void> {
    this.queryCache.set(queryHash, {
      data,
      timestamp: Date.now(),
      ttl: this.DEFAULT_TTL
    });
  }

  /**
   * Enhanced robot search using new database functions and optimizations
   */
  async searchRobotsEnhanced(
    client: SupabaseClient,
    params: SearchParams
  ): Promise<{ data: Robot[] | null; error: any; metrics: any }> {
    const startTime = performance.now();
    
    const queryHash = this.generateQueryHash({
      filters: params,
      table: 'robots',
      operation: 'search_enhanced'
    });

    // Check cache first
    const cached = await this.checkCache(queryHash);
    if (cached) {
      const executionTime = performance.now() - startTime;
      this.updateMetrics({
        executionTime,
        resultCount: Array.isArray(cached) ? cached.length : 0,
        cacheHit: true,
        queryHash,
        optimizationLevel: 'advanced'
      });
      
      return { data: cached as Robot[], error: null, metrics: { executionTime, cacheHit: true } };
    }

    try {
      // Use the enhanced search function from the database
      const { data, error } = await client.rpc('search_robots_enhanced', {
        search_query: params.searchTerm || '',
        strategy_filter: params.strategyType || null,
        user_filter: params.userId || null,
        limit_count: params.limit || 20,
        offset_count: params.offset || 0,
        sort_by: params.sortBy || 'relevance',
        sort_direction: params.sortOrder || 'DESC',
        min_risk_score: params.minRiskScore || null,
        max_risk_score: params.maxRiskScore || null,
        min_profit_potential: params.minProfitPotential || null,
        max_profit_potential: params.maxProfitPotential || null
      });

      if (error) {
        throw new Error(error.message || 'Search query failed');
      }

      // Cache successful results
      if (data) {
        await this.setCache(queryHash, data);
      }

      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: Array.isArray(data) ? data.length : 0,
        cacheHit: false,
        queryHash,
        optimizationLevel: 'advanced'
      });
      
      return { data, error: null, metrics: { executionTime, cacheHit: false } };
    } catch (error: any) {
      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: 0,
        cacheHit: false,
        queryHash,
        optimizationLevel: 'basic'
      });
      
      return { data: null, error, metrics: { executionTime, cacheHit: false } };
    }
  }

  /**
   * Get robot summary statistics using materialized views
   */
  async getRobotSummaryStats(
    client: SupabaseClient,
    strategyType?: string
  ): Promise<{ data: any[] | null; error: any; metrics: any }> {
    const startTime = performance.now();
    const queryHash = this.generateQueryHash({
      table: 'robots_summary_stats',
      strategyType,
      operation: 'summary_stats'
    });

    // Check cache first
    const cached = await this.checkCache(queryHash);
    if (cached) {
      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: Array.isArray(cached) ? cached.length : 0,
        cacheHit: true,
        queryHash,
        optimizationLevel: 'advanced'
      });
      
      // Increment materialized view usage counter
      this.metrics.materializedViewUsage++;
      
      return { data: cached, error: null, metrics: { executionTime, cacheHit: true } };
    }

    try {
      let query = client.from('robots_summary_stats' as any);
      
      if (strategyType) {
        query = (query as any).eq('strategy_type', strategyType);
      }
      
      const result = await (query as any).select('*').order('total_robots', { ascending: false });

      if (result.error) {
        throw new Error(result.error.message || 'Summary stats query failed');
      }

      const { data } = result;

      // Cache successful results
      if (data) {
        await this.setCache(queryHash, data);
      }

      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: Array.isArray(data) ? data.length : 0,
        cacheHit: false,
        queryHash,
        optimizationLevel: 'advanced'
      });
      
      // Increment materialized view usage counter
      this.metrics.materializedViewUsage++;
      
      return { data, error: null, metrics: { executionTime, cacheHit: false } };
    } catch (error: any) {
      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: 0,
        cacheHit: false,
        queryHash,
        optimizationLevel: 'basic'
      });
      
      return { data: null, error, metrics: { executionTime, cacheHit: false } };
    }
  }

  /**
   * Get user engagement statistics using materialized views
   */
  async getUserEngagementStats(
    client: SupabaseClient,
    userId?: string
  ): Promise<{ data: any[] | null; error: any; metrics: any }> {
    const startTime = performance.now();
    const queryHash = this.generateQueryHash({
      table: 'user_engagement_stats',
      userId,
      operation: 'engagement_stats'
    });

    // Check cache first
    const cached = await this.checkCache(queryHash);
    if (cached) {
      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: Array.isArray(cached) ? cached.length : 0,
        cacheHit: true,
        queryHash,
        optimizationLevel: 'advanced'
      });
      
      // Increment materialized view usage counter
      this.metrics.materializedViewUsage++;
      
      return { data: cached, error: null, metrics: { executionTime, cacheHit: true } };
    }

    try {
      let query = client.from('user_engagement_stats' as any);
      
      if (userId) {
        query = (query as any).eq('user_id', userId);
      } else {
        query = (query as any).order('total_views', { ascending: false }).limit(50); // Top 50 users
      }
      
      const result = await (query as any).select('*');

      if (result.error) {
        throw new Error(result.error.message || 'Engagement stats query failed');
      }

      const { data } = result;

      // Cache successful results
      if (data) {
        await this.setCache(queryHash, data);
      }

      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: Array.isArray(data) ? data.length : 0,
        cacheHit: false,
        queryHash,
        optimizationLevel: 'advanced'
      });
      
      // Increment materialized view usage counter
      this.metrics.materializedViewUsage++;
      
      return { data, error: null, metrics: { executionTime, cacheHit: false } };
    } catch (error: any) {
      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: 0,
        cacheHit: false,
        queryHash,
        optimizationLevel: 'basic'
      });
      
      return { data: null, error, metrics: { executionTime, cacheHit: false } };
    }
  }

  /**
   * Get strategy performance insights using database functions
   */
  async getStrategyPerformanceInsights(
    client: SupabaseClient,
    strategyType?: string,
    timePeriod: string = '30 days'
  ): Promise<{ data: any[] | null; error: any; metrics: any }> {
    const startTime = performance.now();
    const queryHash = this.generateQueryHash({
      table: 'strategy_performance',
      strategyType,
      timePeriod,
      operation: 'performance_insights'
    });

    // Check cache first
    const cached = await this.checkCache(queryHash);
    if (cached) {
      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: Array.isArray(cached) ? cached.length : 0,
        cacheHit: true,
        queryHash,
        optimizationLevel: 'advanced'
      });
      
      return { data: cached, error: null, metrics: { executionTime, cacheHit: true } };
    }

    try {
      const { data, error } = await client.rpc('get_strategy_performance_insights', {
        strategy_type_filter: strategyType || null,
        time_period: timePeriod
      });

      if (error) {
        throw new Error(error.message || 'Strategy performance query failed');
      }

      // Cache successful results
      if (data) {
        await this.setCache(queryHash, data);
      }

      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: Array.isArray(data) ? data.length : 0,
        cacheHit: false,
        queryHash,
        optimizationLevel: 'advanced'
      });
      
      return { data, error: null, metrics: { executionTime, cacheHit: false } };
    } catch (error: any) {
      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: 0,
        cacheHit: false,
        queryHash,
        optimizationLevel: 'basic'
      });
      
      return { data: null, error, metrics: { executionTime, cacheHit: false } };
    }
  }

  /**
   * Batch insert with enhanced optimization
   */
  async batchInsertOptimized<T>(
    client: SupabaseClient,
    table: string,
    records: T[],
    options: {
      batchSize?: number;
      validateRecords?: boolean;
    } = {}
  ): Promise<{ data: T[] | null; error: any; metrics: any }> {
    const startTime = performance.now();
    const batchSize = options.batchSize || 100;
    const results: T[] = [];
    const errors: any[] = [];

    // Process in batches to avoid payload limits
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        const { data, error } = await client
          .from(table as any)
          .insert(batch)
          .select();

        if (error) {
          errors.push(error);
        } else if (data) {
          results.push(...data);
        }
      } catch (error) {
        errors.push(error);
      }
    }

    const executionTime = performance.now() - startTime;
    
    this.updateMetrics({
      executionTime,
      resultCount: results.length,
      cacheHit: false,
      queryHash: `batch_insert_${table}_${records.length}`,
      optimizationLevel: 'enhanced'
    });
    
    return {
      data: results.length > 0 ? results : null,
      error: errors.length > 0 ? errors : null,
      metrics: { executionTime, batchEfficiency: this.calculateBatchEfficiency(records.length, executionTime) }
    };
  }

  /**
   * Calculate batch efficiency score
   */
  private calculateBatchEfficiency(recordCount: number, executionTime: number): number {
    // Calculate efficiency as records processed per millisecond
    return recordCount > 0 ? recordCount / executionTime : 0;
  }

  /**
   * Update optimization metrics
   */
  private updateMetrics(queryMetrics: any): void {
    this.metrics.totalOptimizedQueries++;
    this.metrics.queryResponseTime = 
      (this.metrics.queryResponseTime + queryMetrics.executionTime) / this.metrics.totalOptimizedQueries;
    
    // Store in history
    this.optimizationHistory.push({
      operation: queryMetrics.operation || 'query_execution',
      executionTime: queryMetrics.executionTime,
      timestamp: Date.now(),
      cacheHit: queryMetrics.cacheHit || false
    });
    
    // Keep only recent history
    if (this.optimizationHistory.length > 1000) {
      this.optimizationHistory = this.optimizationHistory.slice(-1000);
    }
  }

  /**
   * Get current optimization metrics
   */
  getOptimizationMetrics(): OptimizationMetrics {
    // Calculate cache hit rate from our internal cache
    const totalOps = this.optimizationHistory.length;
    if (totalOps === 0) {
      return { ...this.metrics };
    }
    
    const cacheHits = this.optimizationHistory.filter(m => m.cacheHit).length;
    this.metrics.cacheHitRate = (cacheHits / totalOps) * 100;
    
    return { ...this.metrics };
  }

  /**
   * Execute optimized query using new database features
   */
  async executeOptimizedQuery<T>(
    client: SupabaseClient,
    table: string,
    options: {
      selectFields?: string[];
      filters?: Record<string, any>;
      orderBy?: { column: string; ascending: boolean };
      limit?: number;
      offset?: number;
      useMaterializedView?: boolean;
    } = {}
  ): Promise<{ data: T[] | null; error: any; metrics: any }> {
    const startTime = performance.now();
    const queryHash = this.generateQueryHash({
      table,
      options,
      operation: 'optimized_query'
    });

    // Check cache first
    const cached = await this.checkCache(queryHash);
    if (cached) {
      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: Array.isArray(cached) ? cached.length : 0,
        cacheHit: true,
        queryHash,
        optimizationLevel: 'advanced'
      });
      
      return { data: cached as T[], error: null, metrics: { executionTime, cacheHit: true } };
    }

    try {
      // Use regular table - Supabase client handles both regular tables and materialized views the same way
      let queryBuilder = client.from(table as any);

      // Apply field selection
      if (options.selectFields && options.selectFields.length > 0) {
        queryBuilder = queryBuilder.select(options.selectFields.join(', '));
      } else {
        queryBuilder = queryBuilder.select('*');
      }

      // Apply filters efficiently - handle as a separate query object
      let query = queryBuilder;
      if (options.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              query = (query as any).in(key, value);
            } else if (typeof value === 'object' && 'ilike' in value) {
              query = (query as any).ilike(key, value.ilike);
            } else if (typeof value === 'object' && 'or' in value) {
              query = (query as any).or(value.or);
            } else if (typeof value === 'object' && 'gte' in value) {
              query = (query as any).gte(key, value.gte);
            } else if (typeof value === 'object' && 'lte' in value) {
              query = (query as any).lte(key, value.lte);
            } else if (typeof value === 'object' && 'range' in value) {
              query = (query as any).gte(key, value.range[0]).lte(key, value.range[1]);
            } else {
              query = (query as any).eq(key, value);
            }
          }
        }
      }

      // Apply ordering
      if (options.orderBy) {
        query = (query as any).order(options.orderBy.column, { 
          ascending: options.orderBy.ascending 
        });
      }

      // Apply pagination
      if (options.limit) {
        query = (query as any).limit(options.limit);
      }

      if (options.offset) {
        query = (query as any).range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      // Execute query
      const result = await query;

      if (result.error) {
        throw new Error(result.error.message || 'Query failed');
      }

      const { data } = result;

      // Cache successful results
      if (data) {
        await this.setCache(queryHash, data);
      }

      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: Array.isArray(data) ? data.length : 0,
        cacheHit: false,
        queryHash,
        optimizationLevel: 'enhanced'
      });
      
      return { data, error: null, metrics: { executionTime, cacheHit: false } };
    } catch (error: any) {
      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: 0,
        cacheHit: false,
        queryHash,
        optimizationLevel: 'basic'
      });
      
      return { data: null, error, metrics: { executionTime, cacheHit: false } };
    }
  }

  /**
   * Refresh materialized views
   */
  async refreshMaterializedViews(client: SupabaseClient): Promise<{ success: boolean; message: string }> {
    try {
      const startTime = performance.now();
      
      // Call the database function to refresh materialized views
      const { error } = await client.rpc('refresh_materialized_views');
      
      if (error) {
        throw new Error(error.message || 'Failed to refresh materialized views');
      }
      
      const executionTime = performance.now() - startTime;
      
      this.updateMetrics({
        executionTime,
        resultCount: 2, // Two views refreshed
        cacheHit: false,
        queryHash: 'refresh_materialized_views',
        optimizationLevel: 'advanced'
      });
      
      return {
        success: true,
        message: `Materialized views refreshed successfully in ${executionTime}ms`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to refresh materialized views: ${error.message}`
      };
    }
  }

  /**
   * Get query optimization recommendations based on new database features
   */
  async getEnhancedOptimizationRecommendations(
    client: SupabaseClient
  ): Promise<{ 
    recommendations: string[]; 
    severity: 'low' | 'medium' | 'high';
    impact: 'performance' | 'cost' | 'reliability';
  }> {
    const recommendations: string[] = [];
    
    try {
      // Check for opportunities to use materialized views
      const { data: summaryStats, error: summaryError } = await client
        .from('robots_summary_stats' as any)
        .select('strategy_type, total_robots')
        .limit(1);
      
      if (!summaryError && summaryStats) {
        recommendations.push(
          'Materialized views are available for complex aggregations. ' +
          'Use getRobotSummaryStats() for faster strategy statistics.'
        );
      }
      
      // Check for opportunities to use enhanced search
      recommendations.push(
        'Enhanced search function with additional filters is available. ' +
        'Use searchRobotsEnhanced() for more sophisticated search capabilities.'
      );
      
      // Check for partitioned tables usage
      recommendations.push(
        'Performance metrics table is now partitioned for better scalability. ' +
        'Consider using performance_metrics_partitioned for time-series data.'
      );
      
      // Check current performance metrics
      const metrics = this.getOptimizationMetrics();
      if (metrics.queryResponseTime > 1000) {
        recommendations.push(
          'Average query response time is high (>1 second). ' +
          'Consider using materialized views for frequently accessed aggregations.'
        );
      }
      
      if (metrics.cacheHitRate < 60) {
        recommendations.push(
          'Cache hit rate is low (<60%). ' +
          'Consider using materialized views with longer TTL for frequently accessed data.'
        );
      }
      
    } catch (err) {
      console.debug('Could not get enhanced optimization recommendations:', err);
    }
    
    return {
      recommendations,
      severity: recommendations.length > 5 ? 'high' : recommendations.length > 2 ? 'medium' : 'low',
      impact: 'performance'
    };
  }
  
  /**
   * Run comprehensive database optimization using new features
   */
  async runComprehensiveOptimization(client: SupabaseClient): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const startTime = Date.now();
      
      // First, refresh materialized views
      const refreshResult = await this.refreshMaterializedViews(client);
      
      // Run ANALYZE to update statistics
      const { error: analyzeError } = await client.rpc('analyze_table_statistics');
      
      if (analyzeError) {
        console.warn('Could not run ANALYZE:', analyzeError);
      }
      
      // Get performance metrics
      const metrics = this.getOptimizationMetrics();
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        message: `Comprehensive optimization completed in ${duration}ms`,
        details: {
          operations: ['materialized_view_refresh', 'table_statistics_analysis'],
          duration: duration,
          refreshResult: refreshResult.message,
          metrics: metrics
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Comprehensive optimization failed: ${error}`,
      };
    }
  }
}

// Singleton instance
export const databaseOptimizerEnhanced = new DatabaseOptimizerEnhanced();

// Export the class for potential instantiation with custom config
export { DatabaseOptimizerEnhanced };