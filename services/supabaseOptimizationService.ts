/**
 * Enhanced Supabase Optimization Service
 * Provides advanced optimization for Supabase integration in edge environments
 */

import { advancedSupabasePool } from './advancedSupabasePool';
import { edgeConnectionPool } from './edgeSupabasePool';
import { settingsManager } from './settingsManager';
import { globalCache } from './unifiedCacheManager';

interface SupabaseOptimizationConfig {
  enableReadReplica: boolean;
  enableConnectionPooling: boolean;
  enableQueryOptimization: boolean;
  enableResultCaching: boolean;
  maxRetries: number;
  queryTimeout: number;
  cacheTTL: number;
  batchSize: number;
}

interface QueryOptimization {
  originalQuery: string;
  optimizedQuery: string;
  improvement: string;
  estimatedGain: number;
}

interface SupabaseMetrics {
  queries: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
    cacheHits: number;
  };
  connections: {
    active: number;
    idle: number;
    total: number;
    avgAcquireTime: number;
  };
  cache: {
    hitRate: number;
    totalRequests: number;
    memoryUsage: number;
  };
}

class SupabaseOptimizationService {
  private static instance: SupabaseOptimizationService;
  private config: SupabaseOptimizationConfig = {
    enableReadReplica: true,
    enableConnectionPooling: true,
    enableQueryOptimization: true,
    enableResultCaching: true,
    maxRetries: 3,
    queryTimeout: 5000,
    cacheTTL: 300000, // 5 minutes
    batchSize: 50
  };
  
  private metrics: SupabaseMetrics = {
    queries: {
      total: 0,
      successful: 0,
      failed: 0,
      avgDuration: 0,
      cacheHits: 0
    },
    connections: {
      active: 0,
      idle: 0,
      total: 0,
      avgAcquireTime: 0
    },
    cache: {
      hitRate: 0,
      totalRequests: 0,
      memoryUsage: 0
    }
  };
  
  private queryCache = new Map<string, any>();
  private optimizationCache = new Map<string, QueryOptimization>();

  private constructor() {
    this.initializeOptimizations();
  }

  static getInstance(): SupabaseOptimizationService {
    if (!SupabaseOptimizationService.instance) {
      SupabaseOptimizationService.instance = new SupabaseOptimizationService();
    }
    return SupabaseOptimizationService.instance;
  }

  private initializeOptimizations(): void {
    console.log('Initializing Supabase Optimization Service...');
    
    // Configure connection pools
    this.configureConnectionPools();
    
    // Start metrics collection
    this.startMetricsCollection();
  }

  private configureConnectionPools(): void {
    // Optimize enhanced connection pool for Supabase
    advancedSupabasePool.updateConfig({
      maxConnections: 6,
      minConnections: 2,
      acquireTimeout: 1000,
      retryAttempts: this.config.maxRetries,
      connectionWarming: true,
      regionAffinity: true
    });
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics();
    }, 30000); // Update metrics every 30 seconds
  }

  private updateMetrics(): void {
    const poolStats = advancedSupabasePool.getStats();
    const cacheMetrics = globalCache.getMetrics();
    
    this.metrics.connections = {
      active: poolStats.activeConnections,
      idle: poolStats.idleConnections,
      total: poolStats.totalConnections,
      avgAcquireTime: poolStats.avgAcquireTime
    };
    
    this.metrics.cache = {
      hitRate: cacheMetrics.hitRate,
      totalRequests: cacheMetrics.hits + cacheMetrics.misses,
      memoryUsage: cacheMetrics.memoryUsage
    };
  }

  /**
   * Execute optimized query with caching and connection pooling
   */
  async executeQuery<T>(
    queryFn: (client: any) => Promise<T>,
    options: {
      useReadReplica?: boolean;
      cacheKey?: string;
      cacheTTL?: number;
      retries?: number;
    } = {}
  ): Promise<T> {
    const startTime = performance.now();
    const {
      useReadReplica = this.config.enableReadReplica,
      cacheKey,
      cacheTTL = this.config.cacheTTL,
      retries = this.config.maxRetries
    } = options;

    this.metrics.queries.total++;

    try {
      // Check cache first
      if (cacheKey && this.config.enableResultCaching) {
        const cached = this.queryCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < cacheTTL) {
          this.metrics.queries.cacheHits++;
          return cached.data;
        }
      }

      // Execute query with retry logic
      const result = await this.executeWithRetry(queryFn, useReadReplica, retries);
      
      // Cache successful result
      if (cacheKey && this.config.enableResultCaching) {
        this.queryCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      this.metrics.queries.successful++;
      
      const duration = performance.now() - startTime;
      this.updateQueryDuration(duration);
      
      return result;
      
    } catch (error) {
      this.metrics.queries.failed++;
      throw error;
    }
  }

  private async executeWithRetry<T>(
    queryFn: (client: any) => Promise<T>,
    useReadReplica: boolean,
    retries: number
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const client = await advancedSupabasePool.acquire(undefined, useReadReplica);
        
        try {
          const result = await Promise.race([
            queryFn(client),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout')), this.config.queryTimeout)
            )
          ]);
          
          return result;
          
        } finally {
          advancedSupabasePool.release(client);
        }
        
      } catch (error) {
        lastError = error;
        
        if (attempt === retries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  private updateQueryDuration(duration: number): void {
    const total = this.metrics.queries.total;
    const currentAvg = this.metrics.queries.avgDuration;
    this.metrics.queries.avgDuration = (currentAvg * (total - 1) + duration) / total;
  }

  /**
   * Optimize robots query with pagination and filtering
   */
  async getRobotsOptimized(options: {
    page?: number;
    limit?: number;
    searchTerm?: string;
    filterType?: string;
    useCache?: boolean;
  } = {}): Promise<{
    data: any[];
    pagination: any;
    cached: boolean;
  }> {
    const {
      page = 1,
      limit = 20,
      searchTerm,
      filterType,
      useCache = true
    } = options;

    const cacheKey = `robots_${page}_${limit}_${searchTerm || ''}_${filterType || 'all'}`;
    
    return this.executeQuery(async (client) => {
      const offset = (page - 1) * limit;
      
      let query = client
        .from('robots')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filterType && filterType !== 'all') {
        query = query.eq('strategy_type', filterType);
      }
      
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }
      
      // Apply pagination
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const result = await query;
      
      if (result.error) {
        throw result.error;
      }
      
      return {
        data: result.data || [],
        pagination: {
          page,
          limit,
          total: result.count || 0,
          totalPages: Math.ceil((result.count || 0) / limit),
          hasNext: offset + limit < (result.count || 0),
          hasPrev: page > 1
        },
        cached: false
      };
      
    }, {
      cacheKey: useCache ? cacheKey : undefined,
      useReadReplica: true
    });
  }

  /**
   * Batch insert robots for better performance
   */
  async batchInsertRobots(robots: any[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };
    const batchSize = this.config.batchSize;
    
    for (let i = 0; i < robots.length; i += batchSize) {
      const batch = robots.slice(i, i + batchSize);
      
      try {
        await this.executeQuery(async (client) => {
          const { error } = await client
            .from('robots')
            .insert(batch);
          
          if (error) {
            throw error;
          }
          
          return true;
        }, {
          useReadReplica: false,
          retries: 2
        });
        
        results.success += batch.length;
        
        // Clear relevant cache
        this.invalidateRobotsCache();
        
      } catch (error) {
        results.failed += batch.length;
        results.errors.push(`Batch ${i / batchSize + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return results;
  }

  /**
   * Get robot by ID with optimized caching
   */
  async getRobotById(id: string, useCache = true): Promise<any> {
    const cacheKey = `robot_${id}`;
    
    return this.executeQuery(async (client) => {
      const { data, error } = await client
        .from('robots')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    }, {
      cacheKey: useCache ? cacheKey : undefined,
      useReadReplica: true
    });
  }

  /**
   * Update robot with cache invalidation
   */
  async updateRobot(id: string, updates: any): Promise<any> {
    const result = await this.executeQuery(async (client) => {
      const { data, error } = await client
        .from('robots')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    }, {
      useReadReplica: false,
      retries: 2
    });
    
    // Invalidate relevant cache
    this.invalidateRobotsCache();
    this.queryCache.delete(`robot_${id}`);
    
    return result;
  }

  /**
   * Delete robot with cache invalidation
   */
  async deleteRobot(id: string): Promise<boolean> {
    await this.executeQuery(async (client) => {
      const { error } = await client
        .from('robots')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      return true;
    }, {
      useReadReplica: false,
      retries: 2
    });
    
    // Invalidate relevant cache
    this.invalidateRobotsCache();
    this.queryCache.delete(`robot_${id}`);
    
    return true;
  }

  /**
   * Get strategy types with caching
   */
  async getStrategyTypes(useCache = true): Promise<string[]> {
    const cacheKey = 'strategy_types';
    
    return this.executeQuery(async (client) => {
      const { data, error } = await client
        .from('robots')
        .select('strategy_type')
        .not('strategy_type', 'is', null);
      
      if (error) {
        throw error;
      }
      
      // Extract unique types
      const types = [...new Set((data || []).map((item: any) => item.strategy_type || 'Custom'))];
      return types;
    }, {
      cacheKey: useCache ? cacheKey : undefined,
      useReadReplica: true
    });
  }

  /**
   * Search robots with optimized full-text search
   */
  async searchRobots(query: string, options: {
    limit?: number;
    offset?: number;
    useCache?: boolean;
  } = {}): Promise<any[]> {
    const { limit = 50, offset = 0, useCache = true } = options;
    const cacheKey = `search_${query}_${limit}_${offset}`;
    
    return this.executeQuery(async (client) => {
      const { data, error } = await client
        .from('robots')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) {
        throw error;
      }
      
      return data || [];
    }, {
      cacheKey: useCache ? cacheKey : undefined,
      useReadReplica: true
    });
  }

  /**
   * Invalidate robots cache
   */
  private invalidateRobotsCache(): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.queryCache.keys()) {
      if (key.startsWith('robots_') || key.startsWith('search_')) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.queryCache.delete(key));
  }

  /**
   * Get optimization metrics
   */
  getMetrics(): SupabaseMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.metrics;
    
    // Query performance recommendations
    if (metrics.queries.avgDuration > 1000) {
      recommendations.push('Consider optimizing slow queries or adding indexes');
    }
    
    if (metrics.queries.cacheHits / metrics.queries.total < 0.5) {
      recommendations.push('Consider enabling result caching for better performance');
    }
    
    // Connection pool recommendations
    if (metrics.connections.avgAcquireTime > 500) {
      recommendations.push('Consider increasing connection pool size or enabling connection warming');
    }
    
    if (metrics.connections.active / metrics.connections.total > 0.8) {
      recommendations.push('Consider increasing max connections to handle high load');
    }
    
    // Cache recommendations
    if (metrics.cache.hitRate < 0.7) {
      recommendations.push('Consider adjusting cache TTL or strategy for better hit rates');
    }
    
    return recommendations;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SupabaseOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Supabase optimization configuration updated:', this.config);
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.queryCache.clear();
    this.optimizationCache.clear();
    console.log('Supabase optimization caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    queryCache: { size: number; keys: string[] };
    optimizationCache: { size: number; keys: string[] };
  } {
    return {
      queryCache: {
        size: this.queryCache.size,
        keys: Array.from(this.queryCache.keys())
      },
      optimizationCache: {
        size: this.optimizationCache.size,
        keys: Array.from(this.optimizationCache.keys())
      }
    };
  }
}

export const supabaseOptimizationService = SupabaseOptimizationService.getInstance();