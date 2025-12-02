import { SupabaseClient } from '@supabase/supabase-js';
import { Robot, StrategyAnalysis } from '../types';
import { queryOptimizer } from './queryOptimizer';

interface QueryMetrics {
  executionTime: number;
  resultCount: number;
  cacheHit: boolean;
  queryHash: string;
}

class EnhancedQueryOptimizer {
  /**
   * Batch retrieval for multiple robot IDs
   */
  async getRobotsByIds(
    client: SupabaseClient,
    ids: string[],
    options: {
      selectFields?: string[];
      includeAnalysis?: boolean;
    } = {}
  ): Promise<{ data: Robot[] | null; error: any; metrics: QueryMetrics }> {
    if (!ids || ids.length === 0) {
      return { 
        data: [], 
        error: null, 
        metrics: { 
          executionTime: 0, 
          resultCount: 0, 
          cacheHit: false, 
          queryHash: 'empty_ids' 
        } 
      };
    }
    
    // Create a cache key for this specific batch query
    const cacheKey = `robots_by_ids_${ids.sort().join('_')}_${options.includeAnalysis ? 'with_analysis' : 'basic'}`;
    
    // Check queryOptimizer cache first
    const cached = this.getFromQueryOptimizerCache(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.getDefaultTTL()) {
      const metrics: QueryMetrics = {
        executionTime: 0, // Cache hit, minimal time
        resultCount: Array.isArray(cached.data) ? cached.data.length : 0,
        cacheHit: true,
        queryHash: cacheKey,
      };
      
      return { data: cached.data as Robot[], error: null, metrics };
    }
    
    const startTime = performance.now();
    
    try {
      let query = client
        .from('robots')
        .select(options.selectFields?.join(', ') || '*')
        .in('id', ids);
      
      // Using the destructuring approach that's causing issues
      // Let's use the result object directly to avoid type confusion
      const result = await query;
      
      if (result.error) {
        const metrics: QueryMetrics = {
          executionTime: performance.now() - startTime,
          resultCount: 0,
          cacheHit: false,
          queryHash: cacheKey,
        };
        
        return { data: null, error: result.error, metrics };
      }
      
      // Cache the results using queryOptimizer's cache
      if (result.data) {
        this.setQueryOptimizerCache(cacheKey, {
          data: result.data,
          timestamp: Date.now(),
          ttl: this.getDefaultTTL(),
        });
      }
      
      const metrics: QueryMetrics = {
        executionTime: performance.now() - startTime,
        resultCount: Array.isArray(result.data) ? result.data.length : 0,
        cacheHit: false,
        queryHash: cacheKey,
      };
      
      this.recordMetrics(metrics);
      return { data: result.data as any as Robot[], error: null, metrics };
    } catch (error: any) {
      const metrics: QueryMetrics = {
        executionTime: performance.now() - startTime,
        resultCount: 0,
        cacheHit: false,
        queryHash: cacheKey,
      };
      
      return { data: null, error, metrics };
    }
  }
  
  /**
   * Optimized query with analysis data for dashboard
   */
  async getRobotsWithAnalysis(
    client: SupabaseClient,
    options: {
      userId?: string;
      strategyType?: string;
      searchTerm?: string;
      limit?: number;
      offset?: number;
      orderBy?: 'created_at' | 'updated_at' | 'name' | 'risk_score';
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<{ data: (Robot & { analysis_cache?: StrategyAnalysis })[] | null; error: any; metrics: QueryMetrics }> {
    const startTime = performance.now();
    const cacheKey = `robots_with_analysis_${options.userId || 'all'}_${options.strategyType || 'all'}_${options.searchTerm || 'none'}_${options.limit || 20}`;
    
    // Check queryOptimizer cache first
    const cached = this.getFromQueryOptimizerCache(cacheKey);
    if (cached && Date.now() - cached.timestamp < 600000) { // 10 minute TTL for analysis data
      const metrics: QueryMetrics = {
        executionTime: 0, // Cache hit
        resultCount: Array.isArray(cached.data) ? cached.data.length : 0,
        cacheHit: true,
        queryHash: cacheKey,
      };
      
      return { data: cached.data as (Robot & { analysis_cache?: StrategyAnalysis })[], error: null, metrics };
    }
    
    try {
      let query = client
        .from('robots')
        .select('id, name, description, strategy_type, created_at, updated_at, user_id, analysis_result')
        .limit(options.limit || 20);
      
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }
      
      if (options.strategyType && options.strategyType !== 'All') {
        query = query.eq('strategy_type', options.strategyType);
      }
      
      if (options.searchTerm) {
        query = query.or(`name.ilike.%${options.searchTerm}%,description.ilike.%${options.searchTerm}%`);
      }
      
      if (options.orderBy === 'risk_score' && options.orderBy) {
        // Special handling for ordering by analysis risk score if available
        query = query.order('created_at', { ascending: options.orderDirection === 'asc' });
      } else {
        query = query.order(options.orderBy || 'created_at', { ascending: options.orderDirection === 'asc' });
      }
      
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      }
      
      const result = await query;
      const { data, error } = result;
      
      if (error) {
        const metrics: QueryMetrics = {
          executionTime: performance.now() - startTime,
          resultCount: 0,
          cacheHit: false,
          queryHash: cacheKey,
        };
        
        return { data: null, error, metrics };
      }
      
      // Cache the results using queryOptimizer's cache
      if (data) {
        this.setQueryOptimizerCache(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl: 600000, // 10 minutes for analysis data
        });
      }
      
      const metrics: QueryMetrics = {
        executionTime: performance.now() - startTime,
        resultCount: Array.isArray(data) ? data.length : 0,
        cacheHit: false,
        queryHash: cacheKey,
      };
      
      this.recordMetrics(metrics);
      return { data: data as (Robot & { analysis_cache?: StrategyAnalysis })[], error: null, metrics };
    } catch (error: any) {
      const metrics: QueryMetrics = {
        executionTime: performance.now() - startTime,
        resultCount: 0,
        cacheHit: false,
        queryHash: cacheKey,
      };
      
      return { data: null, error, metrics };
    }
  }
  
  // Helper methods to access queryOptimizer's private properties
  private getFromQueryOptimizerCache(key: string): any {
    // @ts-ignore accessing private property
    return queryOptimizer.queryCache.get(key);
  }
  
  private setQueryOptimizerCache(key: string, value: any): void {
    // @ts-ignore accessing private property
    const dataSize = this.calculateSize(value.data);
    // @ts-ignore accessing private property
    queryOptimizer.maintainCacheSize(dataSize);
    // @ts-ignore accessing private property
    queryOptimizer.queryCache.set(key, value);
  }
  
  private getDefaultTTL(): number {
    // @ts-ignore accessing private property
    return queryOptimizer.DEFAULT_TTL || 60000; // 1 minute default
  }
  
  private recordMetrics(metrics: QueryMetrics): void {
    // @ts-ignore accessing private property
    if (queryOptimizer.recordMetrics) {
      // @ts-ignore accessing private property
      queryOptimizer.recordMetrics(metrics);
    }
  }
  
  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 0;
    }
  }
  
  /**
   * Clear cache entries related to a specific table
   */
  private clearRelatedCacheEntries(table: string): void {
    // @ts-ignore accessing private property
    for (const [key, _] of queryOptimizer.queryCache) {
      if (key.includes(table)) {
        // @ts-ignore accessing private property
        queryOptimizer.queryCache.delete(key);
      }
    }
  }
}

export const enhancedQueryOptimizer = new EnhancedQueryOptimizer();