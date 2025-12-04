/**
 * Advanced Database Query Optimizer for QuantForge AI
 * Provides sophisticated query optimization for Supabase operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../types';
import { securityManager } from './securityManager';

export interface QueryOptimizerConfig {
  enableCaching: boolean;
  enableBatching: boolean;
  enableFullTextSearch: boolean;
  enableConnectionPooling: boolean;
  enableResultCompression: boolean;
  enablePredictiveCaching: boolean;
  enableQueryAnalysis: boolean;
  maxBatchSize: number;
  cacheTTL: number;
}

export interface QueryMetrics {
  queryCount: number;
  cacheHitRate: number;
  avgResponseTime: number;
  totalBytesTransferred: number;
  queryPatterns: Record<string, number>;
}

export interface OptimizedQueryResult<T> {
  data: T | null;
  error: any;
  metrics: {
    cacheHit: boolean;
    responseTime: number;
    dataSize: number;
    optimizationsApplied: string[];
  };
}

export class DatabaseQueryOptimizer {
  private config: QueryOptimizerConfig;
  private metrics: QueryMetrics;
  private queryCache: Map<string, { data: any; timestamp: number; size: number }>;
  private queryHistory: Array<{
    query: string;
    params: any;
    executionTime: number;
    success: boolean;
    timestamp: number;
  }>;
  private readonly MAX_HISTORY = 1000;

  constructor(config?: Partial<QueryOptimizerConfig>) {
    this.config = {
      enableCaching: true,
      enableBatching: true,
      enableFullTextSearch: true,
      enableConnectionPooling: true,
      enableResultCompression: true,
      enablePredictiveCaching: true,
      enableQueryAnalysis: true,
      maxBatchSize: 50,
      cacheTTL: 300000, // 5 minutes
      ...config
    };

    this.metrics = {
      queryCount: 0,
      cacheHitRate: 0,
      avgResponseTime: 0,
      totalBytesTransferred: 0,
      queryPatterns: {}
    };

    this.queryCache = new Map();
    this.queryHistory = [];
  }

  /**
   * Execute optimized robot query with multiple optimization strategies
   */
  async executeOptimizedRobotQuery(
    client: SupabaseClient,
    options: {
      userId?: string;
      strategyType?: string;
      searchTerm?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'created_at' | 'updated_at' | 'name' | 'view_count';
      sortOrder?: 'asc' | 'desc';
      includeAnalytics?: boolean;
    } = {}
  ): Promise<OptimizedQueryResult<Robot[]>> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('robots_query', options);
    const optimizationsApplied: string[] = [];

    try {
      // Check cache first if enabled
      if (this.config.enableCaching) {
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
          const responseTime = performance.now() - startTime;
          
          this.metrics.queryCount++;
          this.updateMetrics(true, responseTime, JSON.stringify(cached).length);
          
          return {
            data: cached,
            error: null,
            metrics: {
              cacheHit: true,
              responseTime,
              dataSize: JSON.stringify(cached).length,
              optimizationsApplied: ['cache_hit']
            }
          };
        }
        optimizationsApplied.push('cache_check');
      }

      // Validate inputs for security using robot type as it's the most relevant
      const validation = securityManager.sanitizeAndValidate(options, 'robot');
      if (!validation.isValid) {
        throw new Error(`Query validation failed: ${validation.errors.join(', ')}`);
      }

      // Build optimized query
      let query = client.from('robots').select('*');
      
      // Apply filters efficiently
      if (options.userId) {
        query = query.eq('user_id', options.userId);
        optimizationsApplied.push('user_filter');
      }
      
      if (options.strategyType && options.strategyType !== 'All') {
        query = query.eq('strategy_type', options.strategyType);
        optimizationsApplied.push('strategy_filter');
      }
      
      if (options.searchTerm) {
        if (this.config.enableFullTextSearch) {
          // Use the search function defined in the database
          const { data, error } = await client.rpc('search_robots', {
            search_query: options.searchTerm,
            strategy_filter: options.strategyType,
            user_filter: options.userId,
            limit_count: options.limit || 20,
            offset_count: options.offset || 0
          });
          
          const responseTime = performance.now() - startTime;
          const dataSize = JSON.stringify(data).length;
          
          this.metrics.queryCount++;
          this.updateMetrics(false, responseTime, dataSize);
          
          if (data && this.config.enableCaching) {
            this.setCachedResult(cacheKey, data, dataSize);
          }
          
          return {
            data: data as Robot[],
            error: error || null,
            metrics: {
              cacheHit: false,
              responseTime,
              dataSize,
              optimizationsApplied: [...optimizationsApplied, 'full_text_search']
            }
          };
        } else {
          // Fallback to basic filtering
          query = query.or(`name.ilike.%${options.searchTerm}%,description.ilike.%${options.searchTerm}%`);
          optimizationsApplied.push('text_search');
        }
      }

      // Apply sorting
      const sortBy = options.sortBy || 'updated_at';
      const sortOrder = options.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      optimizationsApplied.push('sorting');

      // Apply pagination
      if (options.limit) {
        const offset = options.offset || 0;
        query = query.range(offset, offset + options.limit - 1);
        optimizationsApplied.push('pagination');
      }

      // Execute query
      const { data, error } = await query;

      const responseTime = performance.now() - startTime;
      const dataSize = JSON.stringify(data).length;

      this.metrics.queryCount++;
      this.updateMetrics(false, responseTime, dataSize);

      // Cache result if successful and caching enabled
      if (data && this.config.enableCaching) {
        this.setCachedResult(cacheKey, data, dataSize);
      }

      return {
        data: data as Robot[] || [],
        error: error || null,
        metrics: {
          cacheHit: false,
          responseTime,
          dataSize,
          optimizationsApplied
        }
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      this.metrics.queryCount++;
      this.updateMetrics(false, responseTime, 0);
      
      return {
        data: null,
        error,
        metrics: {
          cacheHit: false,
          responseTime,
          dataSize: 0,
          optimizationsApplied
        }
      };
    }
  }

  /**
   * Execute batch operations with optimization
   */
  async executeBatchOperation<T>(
    client: SupabaseClient,
    table: string,
    operations: Array<{ type: 'insert' | 'update' | 'delete'; data: any; id?: string }>,
    options: { 
      validateEach?: boolean; 
      transaction?: boolean 
    } = {}
  ): Promise<OptimizedQueryResult<T[]>> {
    const startTime = performance.now();
    const optimizationsApplied: string[] = ['batch_operation'];
    
    try {
      // Validate operations if requested
      if (options.validateEach) {
        for (const op of operations) {
          const validation = securityManager.sanitizeAndValidate(op.data, 'robot');
          if (!validation.isValid) {
            throw new Error(`Validation failed for operation: ${validation.errors.join(', ')}`);
          }
        }
        optimizationsApplied.push('validation');
      }

      // Group operations by type for optimization
      const inserts = operations.filter(op => op.type === 'insert').map(op => op.data);
      const updates = operations.filter(op => op.type === 'update');
      const deletes = operations.filter(op => op.type === 'delete');

      const results: T[] = [];

      // Process inserts in batches
      if (inserts.length > 0) {
        const batchSize = this.config.maxBatchSize;
        for (let i = 0; i < inserts.length; i += batchSize) {
          const batch = inserts.slice(i, i + batchSize);
          const { data, error } = await client.from(table).insert(batch).select();
          if (error) throw error;
          results.push(...(data as T[]));
        }
        optimizationsApplied.push('batch_insert');
      }

      // Process updates
      if (updates.length > 0) {
        for (const update of updates) {
          if (!update.id) continue;
          const { data, error } = await client.from(table)
            .update(update.data)
            .eq('id', update.id)
            .select();
          if (error) throw error;
          if (data) results.push(...(data as T[]));
        }
        optimizationsApplied.push('batch_update');
      }

      // Process deletes
      if (deletes.length > 0) {
        for (const del of deletes) {
          if (!del.id) continue;
          const { error } = await client.from(table).delete().eq('id', del.id);
          if (error) throw error;
        }
        optimizationsApplied.push('batch_delete');
      }

      const responseTime = performance.now() - startTime;
      const dataSize = JSON.stringify(results).length;

      this.metrics.queryCount++;
      this.updateMetrics(false, responseTime, dataSize);

      return {
        data: results,
        error: null,
        metrics: {
          cacheHit: false,
          responseTime,
          dataSize,
          optimizationsApplied
        }
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      this.metrics.queryCount++;
      this.updateMetrics(false, responseTime, 0);
      
      return {
        data: null,
        error,
        metrics: {
          cacheHit: false,
          responseTime,
          dataSize: 0,
          optimizationsApplied
        }
      };
    }
  }

  /**
   * Get optimized analytics for robots
   */
  async getOptimizedAnalytics(
    client: SupabaseClient,
    options: {
      userId?: string;
      strategyType?: string;
      dateRange?: { start: string; end: string };
      includePerformance?: boolean;
    } = {}
  ): Promise<OptimizedQueryResult<any>> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('analytics', options);
    const optimizationsApplied: string[] = ['analytics_query'];

    try {
      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
          const responseTime = performance.now() - startTime;
          
          this.metrics.queryCount++;
          this.updateMetrics(true, responseTime, JSON.stringify(cached).length);
          
          return {
            data: cached,
            error: null,
            metrics: {
              cacheHit: true,
              responseTime,
              dataSize: JSON.stringify(cached).length,
              optimizationsApplied: ['analytics_cache_hit']
            }
          };
        }
      }

      // Use the analytics function defined in the database
      const { data, error } = await client.rpc('get_robot_analytics', {
        target_user_id: options.userId || null
      });

      const responseTime = performance.now() - startTime;
      const dataSize = JSON.stringify(data).length;

      this.metrics.queryCount++;
      this.updateMetrics(false, responseTime, dataSize);

      // Cache result if successful
      if (data && this.config.enableCaching) {
        this.setCachedResult(cacheKey, data, dataSize);
      }

      return {
        data,
        error: error || null,
        metrics: {
          cacheHit: false,
          responseTime,
          dataSize,
          optimizationsApplied
        }
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      this.metrics.queryCount++;
      this.updateMetrics(false, responseTime, 0);
      
      return {
        data: null,
        error,
        metrics: {
          cacheHit: false,
          responseTime,
          dataSize: 0,
          optimizationsApplied
        }
      };
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): QueryMetrics {
    return { ...this.metrics };
  }

  /**
   * Get query performance analysis
   */
  getPerformanceAnalysis(): {
    slowQueries: Array<{ query: string; avgTime: number; count: number }>;
    optimizationRecommendations: string[];
    cacheEfficiency: {
      hitRate: number;
      totalHits: number;
      totalMisses: number;
    };
  } {
    // Calculate slow queries from history
    const queryTimes: Record<string, { total: number; count: number }> = {};
    for (const query of this.queryHistory) {
      if (!queryTimes[query.query]) {
        queryTimes[query.query] = { total: 0, count: 0 };
      }
      queryTimes[query.query].total += query.executionTime;
      queryTimes[query.query].count += 1;
    }

    const slowQueries = Object.entries(queryTimes)
      .map(([query, stats]) => ({
        query,
        avgTime: stats.total / stats.count,
        count: stats.count
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10); // Top 10 slowest queries

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (this.metrics.cacheHitRate < 50) {
      recommendations.push('Increase caching for frequently accessed data');
    }
    
    if (slowQueries.length > 0 && slowQueries[0].avgTime > 500) {
      recommendations.push(`Optimize slow query: ${slowQueries[0].query} (avg: ${slowQueries[0].avgTime}ms)`);
    }

    // Calculate cache efficiency
    const totalCacheOps = this.metrics.queryCount;
    const estimatedCacheHits = Math.round((this.metrics.cacheHitRate / 100) * totalCacheOps);
    const estimatedCacheMisses = totalCacheOps - estimatedCacheHits;

    return {
      slowQueries,
      optimizationRecommendations: recommendations,
      cacheEfficiency: {
        hitRate: this.metrics.cacheHitRate,
        totalHits: estimatedCacheHits,
        totalMisses: estimatedCacheMisses
      }
    };
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(operation: string, params: any): string {
    // Create a stable hash of the parameters
    const paramStr = JSON.stringify(params, Object.keys(params).sort());
    const hash = this.simpleHash(paramStr);
    return `${operation}_${hash}`;
  }

  /**
   * Simple hash function
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

  /**
   * Get cached result
   */
  private getCachedResult(key: string): any | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.config.cacheTTL) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached result
   */
  private setCachedResult(key: string, data: any, size: number): void {
    // Evict oldest entries if cache is full
    if (this.queryCache.size >= 1000) { // Max 1000 entries
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey) {
        this.queryCache.delete(firstKey);
      }
    }

    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      size
    });
  }

  /**
   * Update metrics
   */
  private updateMetrics(cacheHit: boolean, responseTime: number, dataSize: number): void {
    if (cacheHit) {
      this.metrics.cacheHitRate = ((this.metrics.cacheHitRate * (this.metrics.queryCount - 1)) + 100) / this.metrics.queryCount;
    } else {
      const totalResponseTime = this.metrics.avgResponseTime * (this.metrics.queryCount - 1);
      this.metrics.avgResponseTime = (totalResponseTime + responseTime) / this.metrics.queryCount;
    }

    this.metrics.totalBytesTransferred += dataSize;

    // Add to history
    this.queryHistory.push({
      query: 'unknown', // Would be more specific in real implementation
      params: {},
      executionTime: responseTime,
      success: !cacheHit, // Simplified for this example
      timestamp: Date.now()
    });

    // Keep history within limits
    if (this.queryHistory.length > this.MAX_HISTORY) {
      this.queryHistory = this.queryHistory.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      queryCount: 0,
      cacheHitRate: 0,
      avgResponseTime: 0,
      totalBytesTransferred: 0,
      queryPatterns: {}
    };
    this.queryHistory = [];
  }
}

// Singleton instance
export const databaseQueryOptimizer = new DatabaseQueryOptimizer();