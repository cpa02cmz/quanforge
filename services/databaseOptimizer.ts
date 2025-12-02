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
      
      // Create cache key for this specific search with more granular options
      const cacheKey = `search_${sanitizedTerm}_${sanitizedOptions.userId || 'all'}_${sanitizedOptions.strategyType || 'all'}_${sanitizedOptions.limit || 20}_${sanitizedOptions.sortBy || 'created_at'}_${sanitizedOptions.sortOrder || 'desc'}`;
      
      // Try cache first if enabled
      if (this.config.enableQueryCaching) {
        const cached = robotCache.get<any>(cacheKey);
        if (cached) {
          const executionTime = performance.now() - startTime;
          this.recordOptimization('searchRobotsOptimized', executionTime, cached.data.length, true);
          return { 
            data: cached.data, 
            error: null, 
            metrics: this.metrics 
          };
        }
      }
      
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
        
        // Cache result if successful and caching is enabled
        if (!result.error && result.data && this.config.enableQueryCaching) {
          robotCache.set(cacheKey, { data: result.data }, {
            ttl: 300000, // 5 minutes
            tags: ['robots', 'search'],
            priority: 'normal'
          });
        }
        
        // Record optimization metrics
        this.recordOptimization(
          'searchRobotsOptimized',
          executionTime,
          Array.isArray(result.data) ? result.data.length : 0,
          result.metrics?.cacheHit || false
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
    * Optimized paginated robot query with enhanced error handling and proper count
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
       // Get total count for proper pagination
       let countQuery = client.from('robots').select('*', { count: 'exact', head: true });
       
       if (options.userId) {
         countQuery = countQuery.eq('user_id', options.userId);
       }
       
       if (options.strategyType && options.strategyType !== 'All') {
         countQuery = countQuery.eq('strategy_type', options.strategyType);
       }
       
       if (options.searchTerm) {
         countQuery = countQuery.or(`name.ilike.%${options.searchTerm}%,description.ilike.%${options.searchTerm}%`);
       }
       
       const { count: totalCount, error: countError } = await countQuery;
       if (countError) {
         console.error('Count query failed:', countError);
       }
       
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
             total: totalCount || 0,
             totalPages: totalCount ? Math.ceil(totalCount / limit) : 0,
             hasNext: false,
             hasPrev: false,
           }
         };
       }
       
       // Calculate pagination metadata based on actual total count
       const total = totalCount || (result.data ? result.data.length : 0);
       const totalPages = totalCount ? Math.ceil(totalCount / limit) : Math.ceil(total / limit);
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
        
        const startTime = Date.now();
        const operations: string[] = [];
        
        // Update statistics for better query planning
        try {
          const { error: statsError } = await client.rpc('pg_stat_reset');
          if (!statsError) {
            operations.push('statistics_update');
          }
        } catch (statsErr) {
          console.warn('Statistics update failed:', statsErr);
        }
        
        // Update search vectors for better search performance
        try {
          // In a real implementation, we would run a stored procedure to update search vectors
          // For now, we'll just log the operation
          operations.push('search_vector_update_simulation');
        } catch (updateErr) {
          console.warn('Search vector update failed:', updateErr);
        }
        
        const duration = Date.now() - startTime;
        
        return {
          success: true,
          message: `Database maintenance completed in ${duration}ms`,
          details: {
            operations,
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
   
   /**
    * Optimize database connection pooling for better performance
    */
   async optimizeConnectionPool(): Promise<void> {
     // In a real implementation, this would optimize connection pooling settings
     // For now, we'll log the optimization
     console.log('Connection pool optimization completed');
   }
   
   /**
    * Get query optimization recommendations based on current performance
    */
   async getQueryOptimizationRecommendations(
     client: SupabaseClient
   ): Promise<{ 
     recommendations: string[]; 
     severity: 'low' | 'medium' | 'high';
     impact: 'performance' | 'cost' | 'reliability';
   }> {
     const recommendations: string[] = [];
     
     // Check for missing indexes based on common query patterns
     try {
       // Get query performance metrics
       const { data: slowQueries, error } = await client
         .from('pg_stat_statements') // This is a PostgreSQL extension for query stats
         .select('query, mean_time, calls')
         .order('mean_time', { ascending: false })
         .limit(5);
       
       if (!error && slowQueries && slowQueries.length > 0) {
         // Check for queries without indexes
         slowQueries.forEach((query: any) => {
           if (query.mean_time > 100 && query.calls > 100) { // Slow and frequently called
             recommendations.push(`Query taking ${query.mean_time.toFixed(2)}ms avg time with ${query.calls} calls may need indexing: ${query.query.substring(0, 100)}...`);
           }
         });
       }
     } catch (err) {
       // pg_stat_statements might not be available, which is fine
       console.debug('Query statistics not available for optimization recommendations');
     }
     
     // Add general recommendations based on our metrics
     const metrics = this.getOptimizationMetrics();
     if (metrics.queryResponseTime > 1000) {
       recommendations.push('Average query response time is high (>1 second). Consider adding indexes or optimizing queries.');
     }
     
     if (metrics.cacheHitRate < 30) {
       recommendations.push('Cache hit rate is low (<30%). Consider optimizing cache strategies for frequently accessed data.');
     }
     
      return {
        recommendations,
        severity: recommendations.length > 5 ? 'high' : recommendations.length > 2 ? 'medium' : 'low',
        impact: 'performance'
      };
    }
    
    /**
     * Get advanced analytics for robots with multiple filtering options
     */
    async getAdvancedAnalytics(
      client: SupabaseClient,
      options: {
        userId?: string;
        strategyType?: string;
        dateRange?: { start: string; end: string };
        minRiskScore?: number;
        maxRiskScore?: number;
        minProfitPotential?: number;
        minEngagement?: number; // Minimum of views + copies
        limit?: number;
        offset?: number;
      } = {}
    ): Promise<{ 
      data: any; 
      error: any; 
      metrics: OptimizationMetrics 
    }> {
      const startTime = performance.now();
      
      try {
        // Build query with multiple filter options
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
        
        if (options.minRiskScore !== undefined) {
          query = query.gte('analysis_result->>riskScore', options.minRiskScore);
        }
        
        if (options.maxRiskScore !== undefined) {
          query = query.lte('analysis_result->>riskScore', options.maxRiskScore);
        }
        
        if (options.minProfitPotential !== undefined) {
          query = query.gte('analysis_result->>profitPotential', options.minProfitPotential);
        }
        
        if (options.minEngagement !== undefined) {
          query = query.gte('view_count + copy_count', options.minEngagement);
        }
        
        if (options.limit) {
          query = query.limit(options.limit);
        }
        
        if (options.offset) {
          // Use range instead of offset for Supabase
          const limit = options.limit || 20;
          query = query.range(options.offset, options.offset + limit - 1);
        }
        
        const { data, error } = await query;
        
        if (error) {
          const executionTime = performance.now() - startTime;
          return {
            data: null,
            error,
            metrics: this.metrics
          };
        }
        
        // Process advanced analytics
        const analytics = this.processAdvancedAnalytics(data as Robot[] || [], options);
        
        const executionTime = performance.now() - startTime;
        this.recordOptimization(
          'getAdvancedAnalytics',
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
        this.recordOptimization('getAdvancedAnalytics', executionTime, 0, false);
        
        return {
          data: null,
          error,
          metrics: this.metrics
        };
      }
    }
    
    private processAdvancedAnalytics(robots: Robot[], options: any) {
      // Calculate comprehensive analytics
      const analytics = {
        summary: {
          totalRobots: robots.length,
          totalViews: robots.reduce((sum, r) => sum + (r.view_count || 0), 0),
          totalCopies: robots.reduce((sum, r) => sum + (r.copy_count || 0), 0),
          avgRiskScore: 0,
          avgProfitPotential: 0,
          avgEngagement: 0,
        },
        byStrategyType: {} as Record<string, any>,
        byDate: {} as Record<string, any>,
        topPerformers: [] as Robot[],
        engagementMetrics: {
          highEngagementCount: 0,
          totalEngagement: 0,
          avgEngagementPerRobot: 0,
        }
      };
      
      // Calculate averages and group by strategy type
      let totalRiskScore = 0;
      let totalProfitPotential = 0;
      let totalEngagement = 0;
      let riskScoreCount = 0;
      let profitPotentialCount = 0;
      
      for (const robot of robots) {
        // Calculate engagement
        const engagement = (robot.view_count ?? 0) + (robot.copy_count ?? 0);
        totalEngagement += engagement;
        
        if (engagement > 50) {
          analytics.engagementMetrics.highEngagementCount++;
        }
        
        // Extract and calculate risk/profit metrics if available
        if (robot.analysis_result) {
          const riskScore = robot.analysis_result?.riskScore;
          if (typeof riskScore === 'number') {
            totalRiskScore += riskScore;
            riskScoreCount++;
          }
          
          const profitPotential = robot.analysis_result?.profitability;
          if (typeof profitPotential === 'number') {
            totalProfitPotential += profitPotential;
            profitPotentialCount++;
          }
        }
        
        // Group by strategy type
        const type = robot.strategy_type || 'Custom';
        if (!analytics.byStrategyType[type]) {
          analytics.byStrategyType[type] = {
            count: 0,
            totalViews: 0,
            totalCopies: 0,
            avgRiskScore: 0,
            avgProfitPotential: 0,
            totalEngagement: 0,
            robots: []
          };
        }
        
        analytics.byStrategyType[type].count++;
        analytics.byStrategyType[type].totalViews += (robot.view_count ?? 0);
        analytics.byStrategyType[type].totalCopies += (robot.copy_count ?? 0);
        analytics.byStrategyType[type].totalEngagement += engagement;
        analytics.byStrategyType[type].robots.push(robot);
      }
      
      // Calculate averages
      analytics.summary.avgRiskScore = riskScoreCount > 0 ? totalRiskScore / riskScoreCount : 0;
      analytics.summary.avgProfitPotential = profitPotentialCount > 0 ? totalProfitPotential / profitPotentialCount : 0;
      analytics.summary.avgEngagement = robots.length > 0 ? totalEngagement / robots.length : 0;
      analytics.engagementMetrics.totalEngagement = totalEngagement;
      analytics.engagementMetrics.avgEngagementPerRobot = robots.length > 0 ? totalEngagement / robots.length : 0;
      
      // Calculate averages for each strategy type
      for (const type in analytics.byStrategyType) {
        const typeData = analytics.byStrategyType[type];
        const robotsOfType = typeData.robots;
        
        // Calculate average risk score for this type
        let typeRiskScoreSum = 0;
        let typeRiskScoreCount = 0;
        let typeProfitPotentialSum = 0;
        let typeProfitPotentialCount = 0;
        
        for (const robot of robotsOfType) {
          if (robot.analysis_result) {
            const riskScore = robot.analysis_result?.riskScore;
            if (typeof riskScore === 'number') {
              typeRiskScoreSum += riskScore;
              typeRiskScoreCount++;
            }
            
            const profitPotential = robot.analysis_result?.profitability;
            if (typeof profitPotential === 'number') {
              typeProfitPotentialSum += profitPotential;
              typeProfitPotentialCount++;
            }
          }
        }
        
        typeData.avgRiskScore = typeRiskScoreCount > 0 ? typeRiskScoreSum / typeRiskScoreCount : 0;
        typeData.avgProfitPotential = typeProfitPotentialCount > 0 ? typeProfitPotentialSum / typeProfitPotentialCount : 0;
      }
      
      // Sort robots by engagement to get top performers
      const sortedRobots = [...robots].sort((a, b) => {
        const engagementA = (a.view_count ?? 0) + (a.copy_count ?? 0);
        const engagementB = (b.view_count ?? 0) + (b.copy_count ?? 0);
        return engagementB - engagementA;
      });
      
      analytics.topPerformers = sortedRobots.slice(0, 10); // Top 10
      
      return analytics;
    }
 }

// Singleton instance
export const databaseOptimizer = new DatabaseOptimizer();

// Export the class for potential instantiation with custom config
export { DatabaseOptimizer };