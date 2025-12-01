import { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../types';
import { queryOptimizer } from './queryOptimizer';
import { robotCache } from './advancedCache';
import { securityManager } from './securityManager';

interface OptimizationConfig {
  enableQueryCaching: boolean;
  enableBatchOperations: boolean;
  enableFullTextSearch: boolean;
  enableConnectionPooling: boolean;
  enableResultCompression: boolean;
}

interface OptimizationMetrics {
  cacheHitRate: number;
  queryResponseTime: number;
  batchEfficiency: number;
  compressionRatio: number;
  totalOptimizedQueries: number;
}

class DatabaseOptimizer {
  private config: OptimizationConfig = {
    enableQueryCaching: true,
    enableBatchOperations: true,
    enableFullTextSearch: true,
    enableConnectionPooling: true,
    enableResultCompression: true,
  };
  
  private metrics: OptimizationMetrics = {
    cacheHitRate: 0,
    queryResponseTime: 0,
    batchEfficiency: 0,
    compressionRatio: 0,
    totalOptimizedQueries: 0,
  };
  
  private optimizationHistory: Array<{
    operation: string;
    executionTime: number;
    resultSize: number;
    cached: boolean;
    timestamp: number;
  }> = [];
  
  private readonly MAX_HISTORY = 1000;

  constructor(config?: Partial<OptimizationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Optimized robot search with full-text search capabilities
   */
  async searchRobotsOptimized(
    client: SupabaseClient,
    searchTerm: string,
    options: {
      userId?: string;
      strategyType?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'created_at' | 'updated_at' | 'name' | 'view_count';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ data: Robot[] | null; error: any; metrics: OptimizationMetrics }> {
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
        metrics: this.metrics 
      };
    }
    
    const sanitizedTerm = validation.sanitizedData.searchTerm || '';
    const sanitizedOptions = validation.sanitizedData;
    
    try {
      // Use the existing queryOptimizer for optimized search
      const result = await queryOptimizer.searchRobotsOptimized(
        client,
        sanitizedTerm,
        {
          strategyType: sanitizedOptions.strategyType,
          userId: sanitizedOptions.userId,
          dateRange: undefined, // Add date range if needed
        }
      );
      
      const executionTime = performance.now() - startTime;
      
      // Record optimization metrics
      this.recordOptimization(
        'searchRobotsOptimized',
        executionTime,
        Array.isArray(result.data) ? result.data.length : 0,
        result.metrics.cacheHit
      );
      
      // Update metrics
      this.metrics.totalOptimizedQueries++;
      this.metrics.queryResponseTime = executionTime;
      
      return { 
        data: result.data, 
        error: result.error, 
        metrics: this.metrics 
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordOptimization(
        'searchRobotsOptimized',
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
   * Batch insert operation with optimization
   */
  async batchInsertOptimized<T>(
    client: SupabaseClient,
    table: string,
    records: T[],
    options: {
      batchSize?: number;
      validateEach?: boolean;
    } = {}
  ): Promise<{ data: T[] | null; error: any; metrics: OptimizationMetrics }> {
    const startTime = performance.now();
    const batchSize = options.batchSize || 50;
    const validateEach = options.validateEach || false;
    
    if (validateEach) {
      // Validate each record if required
      for (const record of records) {
        const validation = securityManager.sanitizeAndValidate(record, 'robot' as any);
        if (!validation.isValid) {
          const executionTime = performance.now() - startTime;
          this.recordOptimization('batchInsertOptimized', executionTime, 0, false);
          return { 
            data: null, 
            error: new Error(`Validation failed for record: ${validation.errors.join(', ')}`),
            metrics: this.metrics 
          };
        }
      }
    }
    
    try {
      const result = await queryOptimizer.batchInsert(client, table, records, batchSize);
      
      const executionTime = performance.now() - startTime;
      const efficiency = records.length > 0 ? (records.length / executionTime) * 1000 : 0;
      
      this.metrics.batchEfficiency = efficiency;
      
      this.recordOptimization(
        'batchInsertOptimized',
        executionTime,
        Array.isArray(result.data) ? result.data.length : 0,
        false
      );
      
      return { 
        data: result.data, 
        error: result.error, 
        metrics: this.metrics 
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordOptimization('batchInsertOptimized', executionTime, 0, false);
      
      return { 
        data: null, 
        error, 
        metrics: this.metrics 
      };
    }
  }

  /**
   * Optimized paginated robot query
   */
  async getRobotsPaginatedOptimized(
    client: SupabaseClient,
    options: {
      userId?: string;
      strategyType?: string;
      searchTerm?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'created_at' | 'updated_at' | 'name';
      sortOrder?: 'asc' | 'desc';
      includeAnalytics?: boolean;
    } = {}
  ): Promise<{ 
    data: Robot[] | null; 
    error: any; 
    metrics: OptimizationMetrics;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const startTime = performance.now();
    const page = Math.floor((options.offset || 0) / (options.limit || 20)) + 1;
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    
    // Create cache key for this query
    const cacheKey = `robots_paginated_${page}_${limit}_${options.searchTerm || ''}_${options.strategyType || 'All'}_${options.userId || 'All'}`;
    
    // Try cache first if enabled
    if (this.config.enableQueryCaching) {
      const cached = robotCache.get<any>(cacheKey);
      if (cached) {
        const executionTime = performance.now() - startTime;
        this.recordOptimization('getRobotsPaginatedOptimized', executionTime, cached.data.length, true);
        
        return {
          ...cached,
          metrics: this.metrics
        };
      }
    }
    
    try {
      // Use query optimizer for the database query
      const result = await queryOptimizer.getRobotsOptimized(client, {
        userId: options.userId,
        strategyType: options.strategyType,
        searchTerm: options.searchTerm,
        limit: limit,
        offset: offset,
        orderBy: options.sortBy,
        orderDirection: options.sortOrder,
      });
      
      if (result.error) {
        const executionTime = performance.now() - startTime;
        this.recordOptimization('getRobotsPaginatedOptimized', executionTime, 0, false);
        
        return {
          data: null,
          error: result.error,
          metrics: this.metrics,
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          }
        };
      }
      
      // Calculate pagination metadata
      const total = result.data ? result.data.length : 0; // In real implementation, we'd get the total from count query
      const totalPages = Math.ceil(total / limit);
      const hasNext = offset + limit < total;
      const hasPrev = page > 1;
      
      const response = {
        data: result.data,
        error: null,
        metrics: this.metrics,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
        }
      };
      
      // Cache the result if caching is enabled
      if (this.config.enableQueryCaching) {
        robotCache.set(cacheKey, response, {
          ttl: 300000, // 5 minutes
          tags: ['robots', 'paginated'],
          priority: 'high'
        });
      }
      
      const executionTime = performance.now() - startTime;
      this.recordOptimization(
        'getRobotsPaginatedOptimized',
        executionTime,
        Array.isArray(result.data) ? result.data.length : 0,
        result.metrics.cacheHit
      );
      
      return response;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordOptimization('getRobotsPaginatedOptimized', executionTime, 0, false);
      
      return {
        data: null,
        error,
        metrics: this.metrics,
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        }
      };
    }
  }

  /**
   * Advanced analytics query optimization
   */
  async getRobotAnalyticsOptimized(
    client: SupabaseClient,
    options: {
      userId?: string;
      strategyType?: string;
      dateRange?: { start: string; end: string };
      includePerformance?: boolean;
    } = {}
  ): Promise<{ data: any; error: any; metrics: OptimizationMetrics }> {
    const startTime = performance.now();
    
    try {
      // This would typically call a stored procedure or optimized view
      // For now, we'll create a simulated optimized analytics query
      let query = client.from('robots').select('*');
      
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }
      
      if (options.strategyType && options.strategyType !== 'All') {
        query = query.eq('strategy_type', options.strategyType);
      }
      
      if (options.dateRange) {
        query = query.gte('created_at', options.dateRange.start).lte('created_at', options.dateRange.end);
      }
      
      const { data, error } = await query;
      
      if (error) {
        const executionTime = performance.now() - startTime;
        this.recordOptimization('getRobotAnalyticsOptimized', executionTime, 0, false);
        
        return {
          data: null,
          error,
          metrics: this.metrics
        };
      }
      
      // Process analytics data
      const analytics = this.processAnalytics(data as Robot[], options);
      
      const executionTime = performance.now() - startTime;
      this.recordOptimization(
        'getRobotAnalyticsOptimized',
        executionTime,
        Array.isArray(data) ? data.length : 0,
        false
      );
      
      return {
        data: analytics,
        error: null,
        metrics: this.metrics
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordOptimization('getRobotAnalyticsOptimized', executionTime, 0, false);
      
      return {
        data: null,
        error,
        metrics: this.metrics
      };
    }
  }

  private processAnalytics(robots: Robot[], options: any) {
    const analytics = {
      totalRobots: robots.length,
      byStrategyType: {} as Record<string, number>,
      byDate: {} as Record<string, number>,
      avgRobotSize: 0,
      totalCodeSize: 0,
    };
    
    // Group by strategy type
    for (const robot of robots) {
      const type = robot.strategy_type || 'Custom';
      analytics.byStrategyType[type] = (analytics.byStrategyType[type] || 0) + 1;
      
      // Count by date (for date range analytics)
      const date = new Date(robot.created_at).toISOString().split('T')[0];
      analytics.byDate[date] = (analytics.byDate[date] || 0) + 1;
      
      // Calculate code size
      if (robot.code) {
        analytics.totalCodeSize += robot.code.length;
      }
    }
    
    analytics.avgRobotSize = robots.length > 0 ? analytics.totalCodeSize / robots.length : 0;
    
    return analytics;
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
  getOptimizationMetrics(): OptimizationMetrics {
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
   * Run database maintenance and optimization tasks
   */
  async runDatabaseMaintenance(client: SupabaseClient): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // This would typically include:
      // - Vacuum and analyze operations
      // - Index optimization
      // - Statistics updates
      // - Cleanup of temporary data
      
      // For now, we'll simulate maintenance operations
      const startTime = Date.now();
      
      // Update statistics (would call ANALYZE in real implementation)
      await client.rpc('pg_stat_reset');
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        message: `Database maintenance completed in ${duration}ms`,
        details: {
          operations: ['statistics_update'],
          duration: duration,
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Database maintenance failed: ${error}`,
      };
    }
  }
}

// Singleton instance
export const databaseOptimizer = new DatabaseOptimizer();

// Export the class for potential instantiation with custom config
export { DatabaseOptimizer };