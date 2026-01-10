import { createClient } from '@supabase/supabase-js';
import { Robot } from '../types';
import { consolidatedCache } from './consolidatedCacheManager';
import { securityManager } from './securityManager';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance';

// Enhanced Supabase optimization configuration
const SUPABASE_CONFIG = {
  // Connection pooling
  poolSize: 8,
  connectionTimeout: 5000,
  queryTimeout: 10000,
  
  // Caching
  cacheTTL: 5 * 60 * 1000, // 5 minutes for edge optimization
  maxCacheSize: 100,
  
  // Query optimization
  batchSize: 25,
  maxRetries: 3,
  retryDelay: 1000,
  
  // Performance
  enableReadReplica: true,
  enableQueryDeduplication: true,
  enableResultCompression: true,
};

// Query deduplication cache
const queryCache = new Map<string, Promise<any>>();

class OptimizedSupabaseService {
  private supabase: any = null;
  private isInitialized = false;
  private region: string = 'unknown';

  constructor() {
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      const supabaseUrl = process.env['VITE_SUPABASE_URL'];
      const supabaseAnonKey = process.env['VITE_SUPABASE_ANON_KEY'];

      if (!supabaseUrl || !supabaseAnonKey) {
        logger.warn('Supabase credentials not found, using mock mode');
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'X-Client-Info': 'quanforge-ai/optimized',
            'X-Edge-Region': this.region,
          },
        },
      });

      this.isInitialized = true;
      logger.info('Optimized Supabase client initialized');
    } catch (error) {
      logger.error('Failed to initialize Supabase client:', error);
    }
  }

  // Query deduplication to prevent duplicate requests
  private async deduplicateQuery<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
    if (queryCache.has(key)) {
      return queryCache.get(key);
    }

    const promise = queryFn();
    queryCache.set(key, promise);

    // Clear cache after promise resolves
    promise.finally(() => {
      queryCache.delete(key);
    });

    return promise;
  }

  // Batch query processing
  private async batchQuery<T>(queries: Array<{ key: string; query: () => Promise<T> }>): Promise<T[]> {
    const batchSize = Math.min(queries.length, SUPABASE_CONFIG.batchSize);
    const batches: Array<Array<{ key: string; query: () => Promise<T> }>> = [];
    
    for (let i = 0; i < queries.length; i += batchSize) {
      batches.push(queries.slice(i, i + batchSize));
    }

    const results: T[] = [];
    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(({ query }) => query())
      );
      
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : null
      ) as T[]);
    }

    return results;
  }

  // Optimized robots query with caching and pagination
  async getRobots(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const startTime = performance.now();
    const {
      page = 1,
      limit = 20,
      search = '',
      type = '',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = params;

    const cacheKey = `robots:${JSON.stringify(params)}`;
    
    // Try cache first
    const cached = await consolidatedCache.get(cacheKey);
    if (cached) {
      performanceMonitor.recordMetric('robots_cache_hit', 1);
      return cached;
    }

    return this.deduplicateQuery(cacheKey, async () => {
      if (!this.isInitialized) {
        return this.getMockRobots(params);
      }

      try {
        let query = this.supabase
          .from('robots')
          .select('*', { count: 'exact' });

        // Apply filters
        if (search) {
          query = query.ilike('name', `%${search}%`);
        }
        
        if (type) {
          query = query.eq('strategy_type', type);
        }

        // Apply sorting
        if (sortBy) {
          query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        }

        // Apply pagination
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        const result = {
          data: data || [],
          pagination: {
            page,
            limit,
            totalCount: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
          meta: {
            search,
            type,
            sortBy,
            sortOrder,
          },
        };

        // Cache result
        await consolidatedCache.set(cacheKey, result, SUPABASE_CONFIG.cacheTTL);
        
        performanceMonitor.recordMetric('robots_query_time', performance.now() - startTime);
        return result;
      } catch (error) {
        logger.error('Failed to fetch robots:', error);
        performanceMonitor.recordMetric('robots_query_error', 1);
        return this.getMockRobots(params);
      }
    });
  }

  // Optimized robot creation with validation
  async createRobot(robot: Omit<Robot, 'id' | 'created_at' | 'updated_at'>) {
    const startTime = performance.now();
    
    if (!this.isInitialized) {
      return this.createMockRobot(robot);
    }

    try {
      // Validate input
      const validatedRobot = {
        ...robot,
        name: securityManager.sanitizeInput(robot.name),
        description: securityManager.sanitizeInput(robot.description || ''),
        code: securityManager.sanitizeInput(robot.code),
      };

      const { data, error } = await this.supabase
        .from('robots')
        .insert([validatedRobot])
        .select()
        .single();

      if (error) throw error;

      // Invalidate relevant cache entries
      await this.invalidateRobotCache();

      performanceMonitor.recordMetric('robot_create_time', performance.now() - startTime);
      return data;
    } catch (error) {
      logger.error('Failed to create robot:', error);
      performanceMonitor.recordMetric('robot_create_error', 1);
      return this.createMockRobot(robot);
    }
  }

  // Optimized batch operations
  async batchUpdateRobots(updates: Array<{ id: string; data: Partial<Robot> }>) {
    const startTime = performance.now();
    
    if (!this.isInitialized) {
      return this.batchUpdateMockRobots(updates);
    }

    try {
      const queries = updates.map(({ id, data }) => ({
        key: `update_robot_${id}`,
        query: () => this.supabase
          .from('robots')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single(),
      }));

      const results = await this.batchQuery(queries);
      
      // Invalidate cache
      await this.invalidateRobotCache();

      performanceMonitor.recordMetric('batch_update_time', performance.now() - startTime);
      return results.filter(Boolean);
    } catch (error) {
      logger.error('Failed to batch update robots:', error);
      performanceMonitor.recordMetric('batch_update_error', 1);
      return this.batchUpdateMockRobots(updates);
    }
  }

  // Cache invalidation helper
  private async invalidateRobotCache() {
    // TODO: Implement pattern-based deletion in consolidated cache
    // For now, clear all cache entries
    await consolidatedCache.clear();
  }

  // Mock implementations for fallback
  private async getMockRobots(params: any) {
    // Implementation for mock mode
    return {
      data: [],
      pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 0 },
      meta: params,
    };
  }

  private async createMockRobot(robot: any) {
    return {
      id: `mock_${Date.now()}`,
      ...robot,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async batchUpdateMockRobots(updates: any[]) {
    return updates.map(() => null);
  }

  // Health check for monitoring
  async healthCheck() {
    if (!this.isInitialized) {
      return { status: 'mock', latency: 0 };
    }

    const startTime = performance.now();
    try {
      const { error } = await this.supabase
        .from('robots')
        .select('count')
        .limit(1);

      const latency = performance.now() - startTime;
      
      return {
        status: error ? 'error' : 'healthy',
        latency,
        error: error?.message,
      };
    } catch (error) {
      return {
        status: 'error',
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Performance metrics
  getMetrics() {
    return {
      cacheSize: consolidatedCache.size(),
      pendingQueries: queryCache.size,
      isInitialized: this.isInitialized,
      region: this.region,
      config: SUPABASE_CONFIG,
    };
  }
}

// Export singleton instance
export const optimizedSupabase = new OptimizedSupabaseService();
export default optimizedSupabase;