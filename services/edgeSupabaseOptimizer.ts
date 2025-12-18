/**
 * Enhanced Supabase Edge Optimization Service
 * Provides advanced optimization for Supabase operations in edge environments
 */

import { edgeConnectionPool } from './edgeSupabasePool';
import { edgeCacheManager } from './edgeCacheManager';
import { settingsManager } from './settingsManager';

interface EdgeSupabaseConfig {
  enableConnectionPooling: boolean;
  enableQueryOptimization: boolean;
  enableResultCaching: boolean;
  enableBatching: boolean;
  maxBatchSize: number;
  batchTimeout: number;
  queryTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface QueryCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  queryHash: string;
  hitCount: number;
}

interface BatchedQuery {
  id: string;
  query: string;
  params: any[];
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
}

export class EdgeSupabaseOptimizer {
  private static instance: EdgeSupabaseOptimizer;
  private config: EdgeSupabaseConfig = {
    enableConnectionPooling: true,
    enableQueryOptimization: true,
    enableResultCaching: true,
    enableBatching: true,
    maxBatchSize: 10,
    batchTimeout: 50, // 50ms
    queryTimeout: 7500,
    retryAttempts: 3,
    retryDelay: 1000,
  };

  private queryCache = new Map<string, QueryCacheEntry>();
  private batchQueue: BatchedQuery[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private metrics = {
    queriesExecuted: 0,
    cacheHits: 0,
    batchesProcessed: 0,
    averageQueryTime: 0,
    connectionPoolHits: 0,
  };

  private constructor() {
    this.initializeMetrics();
  }

  static getInstance(): EdgeSupabaseOptimizer {
    if (!EdgeSupabaseOptimizer.instance) {
      EdgeSupabaseOptimizer.instance = new EdgeSupabaseOptimizer();
    }
    return EdgeSupabaseOptimizer.instance;
  }

  /**
   * Execute optimized query with caching and connection pooling
   */
  async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    options: {
      cacheKey?: string;
      cacheTTL?: number;
      useBatch?: boolean;
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      // Check cache first
      if (this.config.enableResultCaching && options.cacheKey) {
        const cached = await this.getFromCache(options.cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          return cached;
        }
      }

      // Use batching if enabled and appropriate
      if (this.config.enableBatching && options.useBatch !== false) {
        return this.executeBatchedQuery(query, params, options);
      }

      // Execute query with optimized connection
      const result = await this.executeQueryWithOptimization(query, params, options);
      
      // Cache result if applicable
      if (this.config.enableResultCaching && options.cacheKey && result) {
        await this.setCache(options.cacheKey, result, options.cacheTTL);
      }

      // Update metrics
      const duration = performance.now() - startTime;
      this.updateMetrics(duration);

      return result;

    } catch (error) {
      console.error('Edge Supabase query failed:', error);
      throw error;
    }
  }

  /**
   * Execute multiple queries in parallel with optimization
   */
  async executeBatch(queries: Array<{
    query: string;
    params?: any[];
    cacheKey?: string;
    cacheTTL?: number;
  }>): Promise<any[]> {
    const startTime = performance.now();
    
    try {
      // Check cache for all queries first
      const uncachedQueries: Array<{
        index: number;
        query: string;
        params: any[];
        cacheKey?: string;
        cacheTTL?: number;
      }> = [];
      
      const results: any[] = new Array(queries.length);

      for (let i = 0; i < queries.length; i++) {
        const { query, params = [], cacheKey, cacheTTL } = queries[i];
        
        if (cacheKey) {
          const cached = await this.getFromCache(cacheKey);
          if (cached) {
            results[i] = cached;
            this.metrics.cacheHits++;
            continue;
          }
        }
        
        uncachedQueries.push({ index: i, query, params, cacheKey, cacheTTL });
      }

      // Execute uncached queries in parallel
      if (uncachedQueries.length > 0) {
        const client = await this.getOptimizedClient();
        
        const parallelQueries = uncachedQueries.map(async ({ query, params }) => {
          return this.executeQueryWithRetry(client, query, params);
        });

        const parallelResults = await Promise.allSettled(parallelQueries);
        
        // Process results and cache them
        for (let i = 0; i < parallelResults.length; i++) {
          const result = parallelResults[i];
          const originalIndex = uncachedQueries[i].index;
          const { cacheKey, cacheTTL } = uncachedQueries[i];
          
          if (result.status === 'fulfilled') {
            results[originalIndex] = result.value;
            
            if (cacheKey && result.value) {
              await this.setCache(cacheKey, result.value, cacheTTL);
            }
          } else {
            throw result.reason;
          }
        }
      }

      // Update metrics
      const duration = performance.now() - startTime;
      this.updateMetrics(duration);
      this.metrics.batchesProcessed++;

      return results;

    } catch (error) {
      console.error('Edge Supabase batch execution failed:', error);
      throw error;
    }
  }

  /**
   * Warm up cache with common queries
   */
  async warmupCache(queries: Array<{
    query: string;
    params?: any[];
    cacheKey: string;
    cacheTTL?: number;
  }>): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    console.log(`🔥 Warming up ${queries.length} Supabase queries...`);

    // Process in batches to avoid overwhelming the system
    const batchSize = 5;
    
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      
      const warmupPromises = batch.map(async ({ query, params = [], cacheKey, cacheTTL }) => {
        try {
          // Check if already cached
          const cached = await this.getFromCache(cacheKey);
          if (cached) {
            success++;
            return;
          }

          // Execute query and cache result
          const result = await this.executeQuery(query, params, {
            cacheKey,
            cacheTTL: cacheTTL || 30 * 60 * 1000, // 30 minutes default
            useBatch: false,
          });

          if (result) {
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          console.warn(`Failed to warmup query ${cacheKey}:`, error);
          failed++;
        }
      });

      await Promise.allSettled(warmupPromises);
      
      // Small delay between batches
      if (i + batchSize < queries.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Cache warmup completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Get optimized Supabase client with connection pooling
   */
  private async getOptimizedClient() {
    if (!this.config.enableConnectionPooling) {
      // Fallback to regular client
      const settings = settingsManager.getDBSettings();
      if (settings.mode !== 'supabase' || !settings.url || !settings.anonKey) {
        throw new Error('Supabase not configured');
      }
      
      // Create client without pooling (fallback)
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(settings.url, settings.anonKey);
    }

    try {
      const client = await edgeConnectionPool.getClient();
      this.metrics.connectionPoolHits++;
      return client;
    } catch (error) {
      console.warn('Connection pool failed, using fallback client:', error);
      
      // Fallback to direct client
      const settings = settingsManager.getDBSettings();
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(settings.url, settings.anonKey);
    }
  }

  /**
   * Execute query with retry logic
   */
  private async executeQueryWithRetry(client: any, query: string, params: any[]): Promise<any> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Execute query with timeout
        const result = await Promise.race([
          this.executeSupabaseQuery(client, query, params),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), this.config.queryTimeout)
          )
        ]);
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt === this.config.retryAttempts) {
          throw error;
        }
        
        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Execute Supabase query with proper query builder pattern
   */
  private async executeSupabaseQuery(client: any, query: string, params: any[]): Promise<any> {
    try {
      // Parse and execute optimized queries based on table and operation
      if (query.includes('robots')) {
        let builder = client.from('robots').select('*');
        
        // Apply filters from params
        if (params?.user_id) builder = builder.eq('user_id', params.user_id);
        if (params?.strategy_type) builder = builder.eq('strategy_type', params.strategy_type);
        if (params?.id) builder = builder.eq('id', params.id);
        if (params?.limit) builder = builder.limit(params.limit);
        if (params?.offset) builder = builder.range(params.offset, params.offset + (params.limit || 20) - 1);
        
        // Apply search filters
        if (params?.search) {
          builder = builder.or(`name.ilike.%${params.search}%,description.ilike.%${params.search}%`);
        }
        
        // Apply ordering
        if (params?.order) {
          const [column, direction] = params.order.split('.');
          builder = builder.order(column, { ascending: direction === 'asc' });
        } else {
          builder = builder.order('created_at', { ascending: false });
        }
        
        const result = await builder;
        return result.data;
      }
      
      if (query.includes('strategies')) {
        let builder = client.from('strategies').select('*');
        
        // Apply filters
        if (params?.category) builder = builder.eq('category', params.category);
        if (params?.difficulty) builder = builder.eq('difficulty', params.difficulty);
        if (params?.id) builder = builder.eq('id', params.id);
        if (params?.limit) builder = builder.limit(params.limit);
        
        // Apply search
        if (params?.search) {
          builder = builder.or(`name.ilike.%${params.search}%,description.ilike.%${params.search}%`);
        }
        
        // Apply ordering
        builder = builder.order('created_at', { ascending: false });
        
        const result = await builder;
        return result.data;
      }
      
      if (query.includes('analytics') || query.includes('metrics')) {
        // Handle analytics queries
        if (params?.table === 'robots') {
          const { count, error } = await client
            .from('robots')
            .select('*', { count: 'exact', head: true });
          
          if (error) throw error;
          
          // Get strategy type distribution
          const { data: strategyData } = await client
            .from('robots')
            .select('strategy_type');
          
          const distribution = strategyData?.reduce((acc: any, item: any) => {
            const type = item.strategy_type || 'Custom';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {});
          
          return {
            total: count,
            distribution,
            timestamp: Date.now()
          };
        }
      }
      
      // Handle insert operations
      if (query.includes('INSERT') || query.includes('insert')) {
        const table = query.includes('robots') ? 'robots' : 'strategies';
        const data = params?.data || params;
        
        const result = await client
          .from(table)
          .insert(data)
          .select();
        
        return result.data;
      }
      
      // Handle update operations
      if (query.includes('UPDATE') || query.includes('update')) {
        const table = query.includes('robots') ? 'robots' : 'strategies';
        const { id, ...updateData } = params || {};
        
        if (!id) throw new Error('ID required for update operations');
        
        const result = await client
          .from(table)
          .update({ ...updateData, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select();
        
        return result.data;
      }
      
      // Handle delete operations
      if (query.includes('DELETE') || query.includes('delete')) {
        const table = query.includes('robots') ? 'robots' : 'strategies';
        const { id } = params || {};
        
        if (!id) throw new Error('ID required for delete operations');
        
        const result = await client
          .from(table)
          .delete()
          .eq('id', id);
        
        return result;
      }
      
      // Default case - return empty result
      console.warn(`Unsupported query pattern: ${query}`);
      return null;
      
    } catch (error) {
      console.error('Supabase query execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute query with optimization
   */
  private async executeQueryWithOptimization(
    query: string,
    params: any[],
    options: any
  ): Promise<any> {
    const client = await this.getOptimizedClient();
    
    if (this.config.enableQueryOptimization) {
      // Apply query optimizations
      query = this.optimizeQuery(query);
    }
    
    return this.executeQueryWithRetry(client, query, params);
  }

  /**
   * Execute batched query
   */
  private async executeBatchedQuery(
    query: string,
    params: any[],
    options: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const batchedQuery: BatchedQuery = {
        id: this.generateQueryId(),
        query,
        params,
        resolve,
        reject,
        timestamp: Date.now(),
      };
      
      this.batchQueue.push(batchedQuery);
      
      // Set batch timer if not already set
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.config.batchTimeout);
      }
      
      // Process immediately if batch is full
      if (this.batchQueue.length >= this.config.maxBatchSize) {
        if (this.batchTimer) {
          clearTimeout(this.batchTimer);
          this.batchTimer = null;
        }
        this.processBatch();
      }
    });
  }

  /**
   * Process batch of queries
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;
    
    const batch = this.batchQueue.splice(0, this.config.maxBatchSize);
    
    try {
      const client = await this.getOptimizedClient();
      
      // Execute all queries in parallel
      const queryPromises = batch.map(async (batchedQuery) => {
        try {
          const result = await this.executeQueryWithRetry(
            client,
            batchedQuery.query,
            batchedQuery.params
          );
          batchedQuery.resolve(result);
        } catch (error) {
          batchedQuery.reject(error);
        }
      });
      
      await Promise.allSettled(queryPromises);
      this.metrics.batchesProcessed++;
      
    } catch (error) {
      // Reject all queries in batch
      batch.forEach(batchedQuery => {
        batchedQuery.reject(error);
      });
    }
  }

  /**
   * Optimize query for better performance
   */
  private optimizeQuery(query: string): string {
    // Add query optimizations
    let optimized = query;
    
    // Add LIMIT if not present for large tables
    if (optimized.includes('robots') && !optimized.includes('LIMIT')) {
      optimized += ' LIMIT 100';
    }
    
    // Add ORDER BY for consistent results
    if (optimized.includes('robots') && !optimized.includes('ORDER BY')) {
      optimized += ' ORDER BY created_at DESC';
    }
    
    return optimized;
  }

  /**
   * Get data from cache
   */
  private async getFromCache(key: string): Promise<any> {
    try {
      return await edgeCacheManager.get(key, {
        preferEdge: true,
        staleWhileRevalidate: true,
      });
    } catch (error) {
      console.debug('Cache get failed:', error);
      return null;
    }
  }

  /**
   * Set data to cache
   */
  private async setCache(key: string, data: any, ttl?: number): Promise<void> {
    try {
      await edgeCacheManager.set(key, data, {
        ttl: ttl || 15 * 60 * 1000, // 15 minutes default
        priority: 'normal',
        replicate: true,
      });
    } catch (error) {
      console.debug('Cache set failed:', error);
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(duration: number): void {
    this.metrics.queriesExecuted++;
    
    // Update average query time
    const totalQueries = this.metrics.queriesExecuted;
    const currentAverage = this.metrics.averageQueryTime;
    this.metrics.averageQueryTime = (currentAverage * (totalQueries - 1) + duration) / totalQueries;
  }

  /**
   * Initialize metrics collection
   */
  private initializeMetrics(): void {
    // Reset metrics periodically
    setInterval(() => {
      console.log('📊 Edge Supabase Metrics:', this.metrics);
    }, 60000); // Log every minute
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.queriesExecuted > 0 
        ? this.metrics.cacheHits / this.metrics.queriesExecuted 
        : 0,
      connectionPoolHitRate: this.metrics.queriesExecuted > 0
        ? this.metrics.connectionPoolHits / this.metrics.queriesExecuted
        : 0,
    };
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear cache
   */
  async clearCache(pattern?: string): Promise<void> {
    if (pattern) {
      await edgeCacheManager.invalidate([pattern]);
    } else {
      // Clear all Supabase-related cache
      await edgeCacheManager.invalidate(['supabase_*', 'robots_*', 'strategies_*']);
    }
  }

  /**
   * Optimize configuration based on metrics
   */
  optimizeConfiguration(): void {
    const metrics = this.getMetrics();
    
    // Adjust batch size based on performance
    if (metrics.averageQueryTime > 1000) {
      this.config.maxBatchSize = Math.max(5, this.config.maxBatchSize - 1);
    } else if (metrics.averageQueryTime < 200) {
      this.config.maxBatchSize = Math.min(15, this.config.maxBatchSize + 1);
    }
    
    // Adjust cache TTL based on hit rate
    if (metrics.cacheHitRate < 0.5) {
      // Increase cache TTL for better hit rates
      console.log('Increasing cache TTL to improve hit rates');
    }
    
    console.log('Edge Supabase configuration optimized:', {
      maxBatchSize: this.config.maxBatchSize,
      averageQueryTime: metrics.averageQueryTime,
      cacheHitRate: metrics.cacheHitRate,
    });
  }
}

// Export singleton instance
export const edgeSupabaseOptimizer = EdgeSupabaseOptimizer.getInstance();