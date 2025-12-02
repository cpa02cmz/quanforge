import { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../types';
import { queryOptimizer } from './queryOptimizer';
import { queryCache } from './advancedCache';
import { securityManager } from './securityManager';

interface EnhancedOptimizationConfig {
  enableQueryCaching: boolean;
  enableBatchOperations: boolean;
  enableFullTextSearch: boolean;
  enableConnectionPooling: boolean;
  enableResultCompression: boolean;
  enableQueryAnalysis: boolean;
  enableSlowQueryDetection: boolean;
  enableAutomaticIndexing: boolean;
}

interface QueryAnalysis {
  executionTime: number;
  resultSize: number;
  cacheHit: boolean;
  queryComplexity: number;
  recommendations: string[];
}

interface SlowQueryReport {
  query: string;
  executionTime: number;
  timestamp: number;
  parameters: Record<string, any>;
}

class EnhancedDatabaseOptimizer {
  private config: EnhancedOptimizationConfig = {
    enableQueryCaching: true,
    enableBatchOperations: true,
    enableFullTextSearch: true,
    enableConnectionPooling: true,
    enableResultCompression: true,
    enableQueryAnalysis: true,
    enableSlowQueryDetection: true,
    enableAutomaticIndexing: false,
  };

  private slowQueryThreshold: number = 1000; // 1 second
  private slowQueries: SlowQueryReport[] = [];
  private maxSlowQueryRecords: number = 100;

  constructor(config?: Partial<EnhancedOptimizationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Enhanced robot search with advanced optimization techniques
   */
  async searchRobotsEnhanced(
    client: SupabaseClient,
    searchTerm: string,
    options: {
      userId?: string;
      strategyType?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'created_at' | 'updated_at' | 'name' | 'view_count';
      sortOrder?: 'asc' | 'desc';
      includeAnalytics?: boolean;
      includeMetadata?: boolean;
    } = {}
  ): Promise<{ 
    data: Robot[] | null; 
    error: any; 
    analysis: QueryAnalysis;
  }> {
    const startTime = performance.now();
    
    // Validate inputs for security
    const validation = securityManager.sanitizeAndValidate(
      { searchTerm, ...options },
      'robot'
    );
    
    if (!validation.isValid) {
      const analysis: QueryAnalysis = {
        executionTime: performance.now() - startTime,
        resultSize: 0,
        cacheHit: false,
        queryComplexity: 1,
        recommendations: ['Input validation failed', 'Check query parameters']
      };
      
      return { 
        data: null, 
        error: new Error(`Validation failed: ${validation.errors.join(', ')}`),
        analysis
      };
    }
    
    const sanitizedTerm = validation.sanitizedData.searchTerm || '';
    const sanitizedOptions = validation.sanitizedData;
    
    // Create cache key for this specific search
    const cacheKey = `search_enhanced_${sanitizedTerm}_${sanitizedOptions.userId || 'all'}_${sanitizedOptions.strategyType || 'all'}_${sanitizedOptions.limit || 20}_${sanitizedOptions.sortBy || 'created_at'}_${sanitizedOptions.sortOrder || 'desc'}`;
    
    // Try cache first if enabled
    if (this.config.enableQueryCaching) {
      const cached = queryCache.get<any>(cacheKey);
      if (cached) {
        const executionTime = performance.now() - startTime;
        const analysis: QueryAnalysis = {
          executionTime,
          resultSize: Array.isArray(cached.data) ? cached.data.length : 0,
          cacheHit: true,
          queryComplexity: 1,
          recommendations: ['Query served from cache']
        };
        
        return { 
          data: cached.data, 
          error: null, 
          analysis
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
          dateRange: undefined,
        }
      );
      
      const executionTime = performance.now() - startTime;
      
      // Cache result if successful and caching is enabled
      if (!result.error && result.data && this.config.enableQueryCaching) {
        queryCache.set(cacheKey, { data: result.data }, {
          ttl: 300000, // 5 minutes
          tags: ['robots', 'search', 'enhanced'],
          priority: 'high'
        });
      }
      
      // Analyze the query performance
      const analysis = this.analyzeQueryPerformance(
        executionTime,
        Array.isArray(result.data) ? result.data.length : 0,
        result.metrics?.cacheHit || false
      );
      
      // Check for slow queries
      if (this.config.enableSlowQueryDetection && executionTime > this.slowQueryThreshold) {
        this.recordSlowQuery('searchRobotsEnhanced', executionTime, {
          searchTerm,
          options
        });
      }
      
      return { 
        data: result.data, 
        error: result.error, 
        analysis
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      const analysis: QueryAnalysis = {
        executionTime,
        resultSize: 0,
        cacheHit: false,
        queryComplexity: 5,
        recommendations: ['Query execution failed', 'Check database connection', 'Review query parameters']
      };
      
      return { 
        data: null, 
        error, 
        analysis
      };
    }
  }

  /**
   * Optimized insert with batch and validation capabilities
   */
  async insertRobotsEnhanced(
    client: SupabaseClient,
    robots: Partial<Robot>[],
    options: {
      validateEach?: boolean;
      batchSize?: number;
      transactionMode?: boolean;
    } = {}
  ): Promise<{ 
    data: Robot[] | null; 
    error: any; 
    analysis: QueryAnalysis;
  }> {
    const startTime = performance.now();
    const validateEach = options.validateEach || false;
    const batchSize = options.batchSize || 50;
    
    if (validateEach) {
      for (const robot of robots) {
        const validation = securityManager.sanitizeAndValidate(robot, 'robot');
        if (!validation.isValid) {
          const executionTime = performance.now() - startTime;
          const analysis: QueryAnalysis = {
            executionTime,
            resultSize: 0,
            cacheHit: false,
            queryComplexity: 3,
            recommendations: ['Validation failed for robot', 'Check robot data format']
          };
          
          return { 
            data: null, 
            error: new Error(`Validation failed for robot: ${validation.errors.join(', ')}`),
            analysis
          };
        }
      }
    }
    
    try {
      // Batch insert with optimized chunking
      const results = [];
      for (let i = 0; i < robots.length; i += batchSize) {
        const batch = robots.slice(i, i + batchSize).map(robot => {
          const validation = securityManager.sanitizeAndValidate(robot, 'robot');
          return validation.sanitizedData;
        });
        
        const result = await client
          .from('robots')
          .insert(batch)
          .select();
        
        if (result.error) {
          throw result.error;
        }
        
        if (result.data) {
          results.push(...result.data);
        }
      }
      
      const executionTime = performance.now() - startTime;
      
      // Invalidate relevant caches
      queryCache.clearByTags(['robots', 'list']);
      
      const analysis = this.analyzeQueryPerformance(
        executionTime,
        results.length,
        false
      );
      
      // Check for slow queries
      if (this.config.enableSlowQueryDetection && executionTime > this.slowQueryThreshold) {
        this.recordSlowQuery('insertRobotsEnhanced', executionTime, {
          batchSize,
          count: robots.length
        });
      }
      
      return { 
        data: results, 
        error: null, 
        analysis
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      const analysis: QueryAnalysis = {
        executionTime,
        resultSize: 0,
        cacheHit: false,
        queryComplexity: 5,
        recommendations: ['Insert operation failed', 'Check database constraints', 'Review robot data']
      };
      
      return { 
        data: null, 
        error, 
        analysis
      };
    }
  }

  /**
   * Advanced analytics with optimized aggregation queries
   */
  async getAdvancedAnalytics(
    client: SupabaseClient,
    options: {
      userId?: string;
      strategyType?: string;
      dateRange?: { start: string; end: string };
      includePerformance?: boolean;
      includeTrends?: boolean;
    } = {}
  ): Promise<{ 
    data: any; 
    error: any; 
    analysis: QueryAnalysis;
  }> {
    const startTime = performance.now();
    
    try {
      // Build optimized analytics query
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
        
        const analysis: QueryAnalysis = {
          executionTime,
          resultSize: 0,
          cacheHit: false,
          queryComplexity: 4,
          recommendations: ['Analytics query failed', 'Check database connection']
        };
        
        return { 
          data: null, 
          error, 
          analysis
        };
      }
      
      // Perform advanced analytics processing
      const analytics = this.processAdvancedAnalytics(data as Robot[], options);
      
      const executionTime = performance.now() - startTime;
      
      const analysis = this.analyzeQueryPerformance(
        executionTime,
        Array.isArray(data) ? data.length : 0,
        false
      );
      
      // Check for slow queries
      if (this.config.enableSlowQueryDetection && executionTime > this.slowQueryThreshold) {
        this.recordSlowQuery('getAdvancedAnalytics', executionTime, options);
      }
      
      return { 
        data: analytics, 
        error: null, 
        analysis
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      const analysis: QueryAnalysis = {
        executionTime,
        resultSize: 0,
        cacheHit: false,
        queryComplexity: 5,
        recommendations: ['Analytics processing failed', 'Check query parameters']
      };
      
      return { 
        data: null, 
        error, 
        analysis
      };
    }
  }

  private processAdvancedAnalytics(robots: Robot[], options: any) {
    const analytics = {
      totalRobots: robots.length,
      byStrategyType: {} as Record<string, number>,
      byDate: {} as Record<string, number>,
      avgRobotSize: 0,
      totalCodeSize: 0,
      performanceMetrics: {} as any,
      trends: [] as any[],
    };
    
    // Group by strategy type
    for (const robot of robots) {
      const type = robot.strategy_type || 'Custom';
      analytics.byStrategyType[type] = (analytics.byStrategyType[type] || 0) + 1;
      
      // Count by date
      const date = new Date(robot.created_at).toISOString().split('T')[0];
      analytics.byDate[date] = (analytics.byDate[date] || 0) + 1;
      
      // Calculate code size
      if (robot.code) {
        analytics.totalCodeSize += robot.code.length;
      }
    }
    
    analytics.avgRobotSize = robots.length > 0 ? analytics.totalCodeSize / robots.length : 0;
    
    // Add performance metrics if requested
    if (options.includePerformance) {
      analytics.performanceMetrics = {
        avgCodeSize: analytics.avgRobotSize,
        growthRate: this.calculateGrowthRate(analytics.byDate),
        mostPopularType: this.getMostPopularType(analytics.byStrategyType),
      };
    }
    
    // Add trends if requested
    if (options.includeTrends) {
      analytics.trends = this.calculateTrends(analytics.byDate);
    }
    
    return analytics;
  }

  private calculateGrowthRate(dateData: Record<string, number>): number {
    const dates = Object.keys(dateData).sort();
    if (dates.length < 2) return 0;
    
    const first = dateData[dates[0]];
    const last = dateData[dates[dates.length - 1]];
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }

  private getMostPopularType(typeData: Record<string, number>): string {
    let maxType = '';
    let maxCount = 0;
    
    for (const [type, count] of Object.entries(typeData)) {
      if (count > maxCount) {
        maxCount = count;
        maxType = type;
      }
    }
    
    return maxType;
  }

  private calculateTrends(dateData: Record<string, number>): any[] {
    const dates = Object.keys(dateData).sort();
    const trends = [];
    
    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];
      const change = dateData[currDate] - dateData[prevDate];
      
      trends.push({
        date: currDate,
        change,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      });
    }
    
    return trends;
  }

  /**
   * Analyze query performance and provide recommendations
   */
  private analyzeQueryPerformance(
    executionTime: number, 
    resultSize: number, 
    wasCached: boolean
  ): QueryAnalysis {
    const queryComplexity = this.estimateQueryComplexity(executionTime, resultSize);
    
    const recommendations: string[] = [];
    
    // Performance recommendations based on execution time
    if (executionTime > 2000) {
      recommendations.push('Query is very slow, consider adding database indexes');
    } else if (executionTime > 1000) {
      recommendations.push('Query is slow, consider optimization');
    } else if (executionTime > 500) {
      recommendations.push('Query could be optimized for better performance');
    }
    
    // Size-based recommendations
    if (resultSize > 1000) {
      recommendations.push('Large result set, consider pagination or filtering');
    }
    
    // Caching recommendations
    if (!wasCached && resultSize > 0) {
      recommendations.push('Result could benefit from caching');
    }
    
    // Complexity recommendations
    if (queryComplexity > 4) {
      recommendations.push('Query complexity is high, consider optimization');
    } else if (queryComplexity > 3) {
      recommendations.push('Query complexity is moderate, could be simplified');
    }
    
    return {
      executionTime,
      resultSize,
      cacheHit: wasCached,
      queryComplexity,
      recommendations
    };
  }

  private estimateQueryComplexity(executionTime: number, resultSize: number): number {
    // Simple complexity estimation based on execution time and result size
    let complexity = 1;
    
    if (executionTime > 2000) complexity += 3;
    else if (executionTime > 1000) complexity += 2;
    else if (executionTime > 500) complexity += 1;
    
    if (resultSize > 1000) complexity += 2;
    else if (resultSize > 100) complexity += 1;
    
    return Math.min(complexity, 5); // Max complexity of 5
  }

  /**
   * Record slow queries for analysis
   */
  private recordSlowQuery(queryName: string, executionTime: number, parameters: Record<string, any>): void {
    const report: SlowQueryReport = {
      query: queryName,
      executionTime,
      timestamp: Date.now(),
      parameters
    };
    
    this.slowQueries.push(report);
    
    // Keep only the most recent slow query reports
    if (this.slowQueries.length > this.maxSlowQueryRecords) {
      this.slowQueries = this.slowQueries.slice(-this.maxSlowQueryRecords);
    }
    
    console.warn(`Slow query detected: ${queryName} took ${executionTime.toFixed(2)}ms`, parameters);
  }

  /**
   * Get slow query reports
   */
  getSlowQueryReports(): SlowQueryReport[] {
    return [...this.slowQueries];
  }

  /**
   * Clear slow query reports
   */
  clearSlowQueryReports(): void {
    this.slowQueries = [];
  }

  /**
   * Get query performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Check for slow queries
    const slowQueries = this.slowQueries.filter(sq => sq.executionTime > 1000);
    if (slowQueries.length > 0) {
      recommendations.push(`Found ${slowQueries.length} slow queries (>1s), optimize these operations`);
    }
    
    // Check average performance
    if (this.slowQueries.length > 0) {
      const avgTime = this.slowQueries.reduce((sum, sq) => sum + sq.executionTime, 0) / this.slowQueries.length;
      if (avgTime > 1000) {
        recommendations.push(`Average query time is high (${avgTime.toFixed(2)}ms), consider optimization`);
      }
    }
    
    return recommendations;
  }

  /**
   * Enable or disable specific optimization features
   */
  setFeatureFlags(flags: Partial<EnhancedOptimizationConfig>): void {
    this.config = { ...this.config, ...flags };
  }

  /**
   * Get current optimization configuration
   */
  getConfig(): EnhancedOptimizationConfig {
    return { ...this.config };
  }

  /**
   * Set slow query threshold in milliseconds
   */
  setSlowQueryThreshold(threshold: number): void {
    this.slowQueryThreshold = threshold;
  }

  /**
   * Get slow query threshold
   */
  getSlowQueryThreshold(): number {
    return this.slowQueryThreshold;
  }
}

// Singleton instance
export const enhancedDatabaseOptimizer = new EnhancedDatabaseOptimizer();

// Export the class for potential instantiation with custom config
export { EnhancedDatabaseOptimizer };