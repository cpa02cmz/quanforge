/**
 * Intelligent Query Cache Service
 * Advanced caching layer with predictive invalidation and performance optimization
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { AdvancedCache, CacheConfig } from './advancedCache';

interface QueryCacheConfig extends CacheConfig {
  predictivePrefetching: boolean;
  autoInvalidation: boolean;
  performanceThreshold: number; // ms above which queries are considered slow
}

interface QueryPattern {
  queryHash: string;
  accessFrequency: number;
  averageExecutionTime: number;
  lastAccessed: number;
  tags: string[];
  table: string;
}

interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  compressionRate: number;
  prefetchSuccessRate: number;
}

class IntelligentQueryCache {
  private cache: AdvancedCache;
  private config: QueryCacheConfig;
  private queryPatterns = new Map<string, QueryPattern>();
  private metrics: CacheMetrics = {
    hitRate: 0,
    missRate: 0,
    evictionRate: 0,
    compressionRate: 0,
    prefetchSuccessRate: 0,
  };
  private stats = {
    hits: 0,
    misses: 0,
    prefetchHits: 0,
    prefetchMisses: 0,
  };
  private readonly DEFAULT_CONFIG: QueryCacheConfig = {
    maxSize: 20 * 1024 * 1024, // 20MB
    maxEntries: 1000,
    defaultTTL: 300000, // 5 minutes
    cleanupInterval: 30000, // 30 seconds
    compressionThreshold: 1024, // 1KB
    predictivePrefetching: true,
    autoInvalidation: true,
    performanceThreshold: 200, // 200ms
  };

  constructor(config?: Partial<QueryCacheConfig>) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.cache = new AdvancedCache({
      maxSize: this.config.maxSize,
      maxEntries: this.config.maxEntries,
      defaultTTL: this.config.defaultTTL,
      cleanupInterval: this.config.cleanupInterval,
      compressionThreshold: this.config.compressionThreshold,
    });
  }

  /**
   * Execute a query with intelligent caching
   */
  async executeQueryWithCache<T>(
    client: SupabaseClient,
    table: string,
    queryBuilder: (client: SupabaseClient) => any,
    cacheKey?: string,
    options: {
      ttl?: number;
      tags?: string[];
      forceRefresh?: boolean;
      usePredictivePrefetching?: boolean;
    } = {}
  ): Promise<{ data: T[] | null; error: any; fromCache: boolean; metrics: any }> {
    const startTime = performance.now();
    const usePrefetching = options.usePredictivePrefetching ?? this.config.predictivePrefetching;
    
    // Generate cache key if not provided
    const finalCacheKey = cacheKey || this.generateCacheKey(table, queryBuilder.toString());
    
    // Track query pattern
    this.trackQueryPattern(finalCacheKey, table, options.tags || []);

    // Check cache first
    if (!options.forceRefresh) {
      const cachedResult = this.cache.get<T[]>(finalCacheKey);
      if (cachedResult) {
        this.stats.hits++;
        this.updateMetrics();
        
        const executionTime = performance.now() - startTime;
        return {
          data: cachedResult,
          error: null,
          fromCache: true,
          metrics: {
            executionTime,
            hit: true,
            queryHash: finalCacheKey,
          }
        };
      }
    }

    this.stats.misses++;
    
    try {
      // Execute the actual query
      const query = queryBuilder(client);
      const { data, error } = await query;
      
      if (!error && data) {
        // Cache the result
        this.cache.set(finalCacheKey, data, {
          ttl: options.ttl || this.config.defaultTTL,
          tags: options.tags
        });

        // Trigger predictive prefetching if enabled
        if (usePrefetching) {
          this.triggerPredictivePrefetching(client, table, data, options.tags || []);
        }
      }

      const executionTime = performance.now() - startTime;
      return {
        data,
        error,
        fromCache: false,
        metrics: {
          executionTime,
          hit: false,
          queryHash: finalCacheKey,
        }
      };
    } catch (error) {
      return {
        data: null,
        error,
        fromCache: false,
        metrics: {
          executionTime: performance.now() - startTime,
          hit: false,
          queryHash: finalCacheKey,
        }
      };
    }
  }

  /**
   * Track query access patterns for predictive optimization
   */
  private trackQueryPattern(queryHash: string, table: string, tags: string[]): void {
    const now = Date.now();
    
    if (this.queryPatterns.has(queryHash)) {
      const pattern = this.queryPatterns.get(queryHash)!;
      pattern.accessFrequency++;
      pattern.lastAccessed = now;
    } else {
      this.queryPatterns.set(queryHash, {
        queryHash,
        accessFrequency: 1,
        averageExecutionTime: 0,
        lastAccessed: now,
        tags,
        table,
      });
    }

    // Keep only recent patterns to prevent memory bloat
    if (this.queryPatterns.size > 5000) {
      // Remove least recently accessed patterns
      const sorted = Array.from(this.queryPatterns.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      for (let i = 0; i < 1000 && i < sorted.length; i++) {
        const entry = sorted[i];
        if (entry) {
          this.queryPatterns.delete(entry[0]);
        }
      }
    }
  }

  /**
   * Trigger predictive prefetching based on query patterns
   */
  private triggerPredictivePrefetching<T>(
    client: SupabaseClient,
    table: string,
    data: T[],
    tags: string[]
  ): void {
    // Only prefetch if we have sufficient data to analyze patterns
    if (data.length < 2) return;

    // Identify related queries that might be needed soon
    const relatedQueries = this.identifyRelatedQueries(table, data);
    
    // Prefetch related data in background
    relatedQueries.forEach(async (queryInfo) => {
      const { cacheKey, queryBuilder } = queryInfo;
      
      // Check if already cached before prefetching
      if (!this.cache.get(cacheKey)) {
        try {
          const query = queryBuilder(client);
          const { data: prefetchedData, error } = await query;
          
          if (!error && prefetchedData) {
            this.stats.prefetchHits++;
            this.cache.set(cacheKey, prefetchedData, {
              ttl: this.config.defaultTTL * 0.5, // Shorter TTL for prefetched data
              tags: [...tags, 'prefetched'],
            });
          } else {
            this.stats.prefetchMisses++;
          }
        } catch (e) {
          this.stats.prefetchMisses++;
        }
      }
    });
  }

  /**
   * Identify related queries based on current data
   */
  private identifyRelatedQueries<T>(table: string, data: T[]): Array<{
    cacheKey: string;
    queryBuilder: (client: SupabaseClient) => any;
  }> {
    const relatedQueries: Array<{ cacheKey: string; queryBuilder: (client: SupabaseClient) => any }> = [];

    // Example: For robots table, prefetch related user data
    if (table === 'robots' && Array.isArray(data) && data.length > 0) {
      // Extract user IDs for potential prefetching
      const userIds = Array.from(
        new Set(
          (data as any[]).filter(item => item.user_id).map(item => item.user_id)
        )
      ).slice(0, 5); // Limit prefetching to prevent overloading

      if (userIds.length > 0) {
        relatedQueries.push({
          cacheKey: `users_by_ids_${userIds.join('_')}`,
          queryBuilder: (client) => client
            .from('users')
            .select('id, name, email')
            .in('id', userIds)
        });
      }
    }

    // Example: For strategy analysis, prefetch related market data
    if (table === 'strategies' && Array.isArray(data) && data.length > 0) {
      const symbols = Array.from(
        new Set(
          (data as any[]).filter(item => item.symbol).map(item => item.symbol)
        )
      ).slice(0, 3);

      if (symbols.length > 0) {
        symbols.forEach(symbol => {
          relatedQueries.push({
            cacheKey: `market_data_${symbol}`,
            queryBuilder: (client) => client
              .from('market_data')
              .select('*')
              .eq('symbol', symbol)
              .order('timestamp', { ascending: false })
              .limit(100)
          });
        });
      }
    }

    return relatedQueries;
  }

  /**
   * Generate cache key from table and query parameters
   */
  private generateCacheKey(table: string, queryStr: string): string {
    // Create a more robust hash to avoid collisions
    const str = `${table}:${queryStr}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${table}_${Math.abs(hash).toString(36).substring(0, 16)}`;
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(): void {
    const totalRequests = this.stats.hits + this.stats.misses;
    const totalPrefetch = this.stats.prefetchHits + this.stats.prefetchMisses;
    
    this.metrics.hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    this.metrics.missRate = totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;
    this.metrics.prefetchSuccessRate = totalPrefetch > 0 ? (this.stats.prefetchHits / totalPrefetch) * 100 : 0;
    
    // Get cache stats from underlying cache
    const cacheStats = this.cache.getStats();
    this.metrics.evictionRate = cacheStats.evictions > 0 ? 
      (cacheStats.evictions / totalRequests) * 100 : 0;
    this.metrics.compressionRate = cacheStats.compressions > 0 ? 
      (cacheStats.compressions / totalRequests) * 100 : 0;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      ...this.cache.getStats(),
      patternCount: this.queryPatterns.size,
    };
  }

  /**
   * Invalidate cache by tags (for auto-invalidation)
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    if (!this.config.autoInvalidation) {
      return 0;
    }

    return this.cache.clearByTags(tags);
  }

  /**
   * Invalidate cache for a specific table
   */
  async invalidateTable(table: string): Promise<number> {
    if (!this.config.autoInvalidation) {
      return 0;
    }

    // Find all cache entries related to this table
    const tableKeys = Array.from(this.cache['cache'].keys())
      .filter(key => key.includes(table));
    
    let invalidatedCount = 0;
    tableKeys.forEach(key => {
      if (this.cache.delete(key)) {
        invalidatedCount++;
      }
    });

    return invalidatedCount;
  }

  /**
   * Get predictive query recommendations based on access patterns
   */
  getPredictiveRecommendations(): Array<{
    query: string;
    frequency: number;
    estimatedTimeSaved: number;
    table: string;
  }> {
    const recommendations = Array.from(this.queryPatterns.entries())
      .map(([_, pattern]) => ({
        query: pattern.queryHash,
        frequency: pattern.accessFrequency,
        estimatedTimeSaved: pattern.averageExecutionTime * pattern.accessFrequency,
        table: pattern.table,
      }))
      .sort((a, b) => b.estimatedTimeSaved - a.estimatedTimeSaved)
      .slice(0, 20); // Top 20 recommendations

    return recommendations;
  }

  /**
   * Warm up cache with predicted high-value queries
   */
  async warmupPredictedQueries(client: SupabaseClient): Promise<void> {
    const recommendations = this.getPredictiveRecommendations();
    
    for (const recommendation of recommendations) {
      // Generate a basic query for the recommended table
      // This is a simplified example - in practice, you'd have more specific warmup logic
      try {
        const { data, error } = await client
          .from(recommendation.table)
          .select('*')
          .limit(1);
        
        if (!error && data) {
          // Cache a representative sample
          const cacheKey = `warmup_${recommendation.table}`;
          this.cache.set(cacheKey, data, {
            ttl: this.config.defaultTTL * 2, // Longer TTL for warmup data
            tags: ['warmup', recommendation.table],
          });
        }
      } catch (e) {
        // Ignore errors during warmup
      }
    }
  }

  /**
   * Analyze slow queries and provide optimization suggestions
   */
  getSlowQueryAnalysis(): Array<{
    queryHash: string;
    executionTime: number;
    accessFrequency: number;
    shouldCache: boolean;
  }> {
    return Array.from(this.queryPatterns.entries())
      .map(([_, pattern]) => ({
        queryHash: pattern.queryHash,
        executionTime: pattern.averageExecutionTime,
        accessFrequency: pattern.accessFrequency,
        shouldCache: pattern.averageExecutionTime > this.config.performanceThreshold && 
                    pattern.accessFrequency > 1
      }))
      .filter(item => item.shouldCache)
      .sort((a, b) => b.executionTime - a.executionTime);
  }

  /**
   * Clear all caches and reset statistics
   */
  clear(): void {
    this.cache.clear(); // Use the correct method name
    this.queryPatterns.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      prefetchHits: 0,
      prefetchMisses: 0,
    };
  }

  /**
   * Destroy and cleanup resources
   */
  destroy(): void {
    this.cache.destroy();
    this.queryPatterns.clear();
  }
}

// Singleton instance
export const intelligentQueryCache = new IntelligentQueryCache();

export { IntelligentQueryCache };