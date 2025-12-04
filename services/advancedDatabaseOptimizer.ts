import { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../types';
import { queryOptimizer } from './queryOptimizer';
import { robotCache } from './advancedCache';
import { securityManager } from './securityManager';

interface AdvancedOptimizationConfig {
  enableQueryCaching: boolean;
  enableBatchOperations: boolean;
  enableFullTextSearch: boolean;
  enableConnectionPooling: boolean;
  enableResultCompression: boolean;
  enablePredictiveCaching: boolean;
  enableSemanticCaching: boolean;
  enableQueryBatching: boolean;
  enableSmartIndexing: boolean;
  enableAnalyticsOptimization: boolean;
  enableRecommendationEngine: boolean;
}

interface PerformanceMetrics {
  cacheHitRate: number;
  queryResponseTime: number;
  batchEfficiency: number;
  compressionRatio: number;
  totalOptimizedQueries: number;
  analyticsQueries: number;
  recommendationQueries: number;
}

class AdvancedDatabaseOptimizer {
  private config: AdvancedOptimizationConfig = {
    enableQueryCaching: true,
    enableBatchOperations: true,
    enableFullTextSearch: true,
    enableConnectionPooling: true,
    enableResultCompression: true,
    enablePredictiveCaching: true,
    enableSemanticCaching: true,
    enableQueryBatching: true,
    enableSmartIndexing: true,
    enableAnalyticsOptimization: true,
    enableRecommendationEngine: true,
  };
  
  private metrics: PerformanceMetrics = {
    cacheHitRate: 0,
    queryResponseTime: 0,
    batchEfficiency: 0,
    compressionRatio: 0,
    totalOptimizedQueries: 0,
    analyticsQueries: 0,
    recommendationQueries: 0,
  };
  
  private optimizationHistory: Array<{
    operation: string;
    executionTime: number;
    resultSize: number;
    cached: boolean;
    timestamp: number;
  }> = [];
  
  private readonly MAX_HISTORY = 1000;

  constructor(config?: Partial<AdvancedOptimizationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Advanced robot search with multiple filters and ranking
   */
  async searchRobotsAdvanced(
    client: SupabaseClient,
    searchTerm: string,
    options: {
      strategyType?: string;
      userId?: string;
      minViewCount?: number;
      minRiskScore?: number;
      maxRiskScore?: number;
      limit?: number;
      offset?: number;
      sortBy?: 'relevance' | 'created_at' | 'view_count' | 'risk_score';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ data: Robot[] | null; error: any; metrics: PerformanceMetrics; total: number }> {
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
        metrics: this.metrics,
        total: 0
      };
    }
    
    const sanitizedTerm = validation.sanitizedData.searchTerm || '';
    const sanitizedOptions = validation.sanitizedData;
    
    // Create intelligent cache key with semantic hashing
    const cacheKey = this.generateSemanticCacheKey('searchAdvanced', {
      term: sanitizedTerm,
      strategyType: sanitizedOptions.strategyType || 'all',
      userId: sanitizedOptions.userId || 'all',
      minViewCount: sanitizedOptions.minViewCount || 0,
      limit: sanitizedOptions.limit || 20,
      sortBy: sanitizedOptions.sortBy || 'relevance',
      sortOrder: sanitizedOptions.sortOrder || 'desc'
    });
    
    // Try cache first if enabled
    if (this.config.enableQueryCaching) {
      const cached = robotCache.get<any>(cacheKey);
      if (cached) {
        const executionTime = performance.now() - startTime;
        this.recordOptimization('searchRobotsAdvanced', executionTime, cached.data.length, true);
        return { 
          data: cached.data, 
          error: null, 
          metrics: this.metrics,
          total: cached.total || 0
        };
      }
    }
    
    try {
      // Call the advanced search function in the database
      const result = await client.rpc('search_robots_advanced', {
        search_term: sanitizedTerm,
        strategy_filter: sanitizedOptions.strategyType || null,
        user_filter: sanitizedOptions.userId || null,
        min_view_count: sanitizedOptions.minViewCount || null,
        min_risk_score: sanitizedOptions.minRiskScore || null,
        max_risk_score: sanitizedOptions.maxRiskScore || null,
        limit_count: sanitizedOptions.limit || 20,
        offset_count: sanitizedOptions.offset || 0,
        sort_by: sanitizedOptions.sortBy || 'relevance',
        sort_direction: sanitizedOptions.sortOrder || 'DESC'
      });
      
      const executionTime = performance.now() - startTime;
      
      if (result.error) {
        return { 
          data: null, 
          error: result.error, 
          metrics: this.metrics,
          total: 0
        };
      }
      
      const total = result.data && result.data[0] ? result.data[0].total_count || 0 : 0;
      const data = result.data ? result.data.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        strategy_type: item.strategy_type,
        created_at: item.created_at,
        updated_at: item.updated_at,
        view_count: item.view_count,
        copy_count: item.copy_count,
        user_id: item.user_id,
        // Additional fields that might be available
        code: '',
        strategy_params: null,
        backtest_settings: null,
        analysis_result: null,
        chat_history: null,
        is_active: true,
        is_public: false,
        version: 1
      })) : [];
      
      // Cache result if successful and caching is enabled
      if (result.data && this.config.enableQueryCaching) {
        robotCache.set(cacheKey, { 
          data, 
          total 
        }, {
          ttl: 300000, // 5 minutes
          tags: ['robots', 'search', 'advanced'],
          priority: 'normal'
        });
      }
      
      // Record optimization metrics
      this.recordOptimization(
        'searchRobotsAdvanced',
        executionTime,
        data.length,
        false
      );
      
      // Update metrics
      this.metrics.totalOptimizedQueries++;
      this.metrics.queryResponseTime = executionTime;
      
      return { 
        data, 
        error: null, 
        metrics: this.metrics,
        total
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordOptimization(
        'searchRobotsAdvanced',
        executionTime,
        0,
        false
      );
      
      return { 
        data: null, 
        error, 
        metrics: this.metrics,
        total: 0
      };
    }
  }

  /**
   * Get comprehensive robot analytics
   */
  async getComprehensiveAnalytics(
    client: SupabaseClient,
    startDate?: string,
    endDate?: string,
    strategyType?: string
  ): Promise<{ data: any[] | null; error: any; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    
    try {
      const result = await client.rpc('get_comprehensive_analytics', {
        date_start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        date_end: endDate || new Date().toISOString(),
        strategy_type_filter: strategyType || null
      });
      
      const executionTime = performance.now() - startTime;
      
      if (result.error) {
        return { 
          data: null, 
          error: result.error, 
          metrics: this.metrics
        };
      }
      
      // Record optimization metrics
      this.metrics.analyticsQueries++;
      this.recordOptimization(
        'getComprehensiveAnalytics',
        executionTime,
        Array.isArray(result.data) ? result.data.length : 0,
        false
      );
      
      return { 
        data: result.data, 
        error: null, 
        metrics: this.metrics
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordOptimization(
        'getComprehensiveAnalytics',
        executionTime,
        0,
        false
      );
      
      return { 
        data: null, 
        error, 
        metrics: this.metrics
      };
    }
  }

  /**
   * Get strategy performance comparison
   */
  async getStrategyPerformanceComparison(
    client: SupabaseClient,
    startDate?: string,
    endDate?: string
  ): Promise<{ data: any[] | null; error: any; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    
    try {
      const result = await client.rpc('get_strategy_performance_comparison', {
        date_start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        date_end: endDate || new Date().toISOString()
      });
      
      const executionTime = performance.now() - startTime;
      
      if (result.error) {
        return { 
          data: null, 
          error: result.error, 
          metrics: this.metrics
        };
      }
      
      // Record optimization metrics
      this.metrics.analyticsQueries++;
      this.recordOptimization(
        'getStrategyPerformanceComparison',
        executionTime,
        Array.isArray(result.data) ? result.data.length : 0,
        false
      );
      
      return { 
        data: result.data, 
        error: null, 
        metrics: this.metrics
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordOptimization(
        'getStrategyPerformanceComparison',
        executionTime,
        0,
        false
      );
      
      return { 
        data: null, 
        error, 
        metrics: this.metrics
      };
    }
  }

  /**
   * Get robot recommendations for a user
   */
  async getRobotRecommendations(
    client: SupabaseClient,
    userId: string,
    limit: number = 10
  ): Promise<{ data: Robot[] | null; error: any; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    
    // Create cache key
    const cacheKey = `robot_recommendations_${userId}_${limit}`;
    
    // Try cache first if enabled
    if (this.config.enableQueryCaching) {
      const cached = robotCache.get<any>(cacheKey);
      if (cached) {
        const executionTime = performance.now() - startTime;
        this.recordOptimization('getRobotRecommendations', executionTime, cached.data.length, true);
        this.metrics.recommendationQueries++;
        return { 
          data: cached.data, 
          error: null, 
          metrics: this.metrics
        };
      }
    }
    
    try {
      const result = await client.rpc('get_robot_recommendations', {
        user_id_param: userId,
        limit_count: limit
      });
      
      const executionTime = performance.now() - startTime;
      
      if (result.error) {
        return { 
          data: null, 
          error: result.error, 
          metrics: this.metrics
        };
      }
      
      // Process the recommendation data into Robot format
      const data = result.data ? result.data.map((item: any) => ({
        id: item.id,
        name: item.name,
        strategy_type: item.strategy_type,
        view_count: item.view_count,
        copy_count: item.copy_count,
        created_at: item.created_at,
        // Additional fields that might be available
        description: '',
        user_id: userId, // This is a recommendation, so we'll use the user's ID
        code: '',
        strategy_params: null,
        backtest_settings: null,
        analysis_result: null,
        chat_history: null,
        is_active: true,
        is_public: true,
        version: 1
      })) : [];
      
      // Cache result if successful and caching is enabled
      if (data && this.config.enableQueryCaching) {
        robotCache.set(cacheKey, { data }, {
          ttl: 1800000, // 30 minutes for recommendations
          tags: ['recommendations', 'robots'],
          priority: 'high'
        });
      }
      
      // Record optimization metrics
      this.metrics.recommendationQueries++;
      this.recordOptimization(
        'getRobotRecommendations',
        executionTime,
        data.length,
        false
      );
      
      return { 
        data, 
        error: null, 
        metrics: this.metrics
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordOptimization(
        'getRobotRecommendations',
        executionTime,
        0,
        false
      );
      
      return { 
        data: null, 
        error, 
        metrics: this.metrics
      };
    }
  }

  /**
   * Calculate robot quality score
   */
  async calculateRobotQualityScore(
    client: SupabaseClient,
    robotId: string
  ): Promise<{ data: number | null; error: any; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    
    try {
      const result = await client.rpc('calculate_robot_quality_score', {
        robot_id_param: robotId
      });
      
      const executionTime = performance.now() - startTime;
      
      if (result.error) {
        return { 
          data: null, 
          error: result.error, 
          metrics: this.metrics
        };
      }
      
      return { 
        data: Array.isArray(result.data) && result.data[0] ? result.data[0].calculate_robot_quality_score : 0, 
        error: null, 
        metrics: this.metrics
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordOptimization(
        'calculateRobotQualityScore',
        executionTime,
        0,
        false
      );
      
      return { 
        data: null, 
        error, 
        metrics: this.metrics
      };
    }
  }

  /**
   * Get user engagement insights
   */
  async getUserEngagementInsights(
    client: SupabaseClient,
    userId: string
  ): Promise<{ data: any | null; error: any; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    
    try {
      const result = await client.rpc('get_user_engagement_insights', {
        user_id_param: userId
      });
      
      const executionTime = performance.now() - startTime;
      
      if (result.error) {
        return { 
          data: null, 
          error: result.error, 
          metrics: this.metrics
        };
      }
      
      return { 
        data: Array.isArray(result.data) && result.data[0] ? result.data[0].get_user_engagement_insights : null, 
        error: null, 
        metrics: this.metrics
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordOptimization(
        'getUserEngagementInsights',
        executionTime,
        0,
        false
      );
      
      return { 
        data: null, 
        error, 
        metrics: this.metrics
      };
    }
  }

  /**
   * Run comprehensive database optimization
   */
  async runDatabaseOptimization(
    client: SupabaseClient
  ): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const result = await client.rpc('run_database_optimization');
      
      if (result.error) {
        return {
          success: false,
          message: `Database optimization failed: ${result.error.message || result.error}`,
        };
      }
      
      return {
        success: true,
        message: `Database optimization completed successfully`,
        details: Array.isArray(result.data) && result.data[0] ? result.data[0] : null
      };
    } catch (error) {
      return {
        success: false,
        message: `Database optimization failed: ${error}`,
      };
    }
  }

  /**
   * Record optimization metrics
   */
  private recordOptimization(
    operation: string,
    executionTime: number,
    resultSize: number,
    wasCached: boolean
  ): void {
    // Add to history
    this.optimizationHistory.push({
      operation,
      executionTime,
      resultSize,
      cached: wasCached,
      timestamp: Date.now(),
    });
    
    // Keep history within limits
    if (this.optimizationHistory.length > this.MAX_HISTORY) {
      this.optimizationHistory = this.optimizationHistory.slice(-this.MAX_HISTORY);
    }
    
    // Update metrics
    const cacheHits = this.optimizationHistory.filter(h => h.cached).length;
    this.metrics.cacheHitRate = (cacheHits / this.optimizationHistory.length) * 100;
  }

  /**
   * Get optimization metrics
   */
  getOptimizationMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed optimization history
   */
  getOptimizationHistory(): Array<{
    operation: string;
    executionTime: number;
    resultSize: number;
    cached: boolean;
    timestamp: number;
  }> {
    return [...this.optimizationHistory];
  }

  /**
   * Clear optimization history
   */
  clearHistory(): void {
    this.optimizationHistory = [];
  }

  /**
   * Get optimization recommendations based on history
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.metrics.cacheHitRate < 50) {
      recommendations.push('Increase cache hit rate by optimizing frequently accessed queries');
    }
    
    if (this.metrics.queryResponseTime > 500) {
      recommendations.push('Query response time is high, consider adding more indexes');
    }
    
    if (this.optimizationHistory.length > 0) {
      const avgTime = this.optimizationHistory.reduce((sum, h) => sum + h.executionTime, 0) / 
                      this.optimizationHistory.length;
      
      if (avgTime > 300) {
        recommendations.push('Average execution time is high, optimize database queries');
      }
    }
    
    return recommendations;
  }

  /**
   * Generate semantic cache key for intelligent caching
   */
  private generateSemanticCacheKey(operation: string, params: Record<string, any>): string {
    // Create a normalized parameter object
    const normalizedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        const value = params[key];
        // Normalize values for consistent caching
        if (typeof value === 'string') {
          result[key] = value.toLowerCase().trim();
        } else if (typeof value === 'number') {
          result[key] = value.toString();
        } else if (value === null || value === undefined) {
          result[key] = 'null';
        } else {
          result[key] = JSON.stringify(value);
        }
        return result;
      }, {} as Record<string, string>);
    
    // Create semantic hash
    const paramString = JSON.stringify(normalizedParams);
    const semanticHash = this.simpleHash(paramString);
    
    return `${operation}_${semanticHash}`;
  }

  /**
   * Simple hash function for cache key generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// Singleton instance
export const advancedDatabaseOptimizer = new AdvancedDatabaseOptimizer();

// Export the class for potential instantiation with custom config
export { AdvancedDatabaseOptimizer };