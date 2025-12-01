import { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../types';

interface QueryOptimization {
  selectFields?: string[];
  filters?: Record<string, any>;
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  offset?: number;
  useIndex?: string;
}

interface QueryMetrics {
  executionTime: number;
  resultCount: number;
  cacheHit: boolean;
  queryHash: string;
}

class QueryOptimizer {
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private queryMetrics: QueryMetrics[] = [];
  private readonly DEFAULT_TTL = 60000; // 1 minute
  private readonly MAX_METRICS = 1000;

  // Generate query hash for caching
  private generateQueryHash(optimization: QueryOptimization): string {
    return btoa(JSON.stringify(optimization)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  // Build optimized query
  async executeQuery<T>(
    client: SupabaseClient,
    table: string,
    optimization: QueryOptimization
  ): Promise<{ data: T[] | null; error: any; metrics: QueryMetrics }> {
    const startTime = performance.now();
    const queryHash = this.generateQueryHash(optimization);
    
    // Check cache first
    const cached = this.queryCache.get(queryHash);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      const metrics: QueryMetrics = {
        executionTime: performance.now() - startTime,
        resultCount: Array.isArray(cached.data) ? cached.data.length : 0,
        cacheHit: true,
        queryHash,
      };
      
      this.recordMetrics(metrics);
      return { data: cached.data, error: null, metrics };
    }

    // Build query with optimizations
    let query = client.from(table);

    // Select specific fields for better performance
    if (optimization.selectFields && optimization.selectFields.length > 0) {
      query = query.select(optimization.selectFields.join(', '));
    } else {
      query = query.select('*');
    }

    // Apply filters efficiently
    if (optimization.filters) {
      Object.entries(optimization.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else if (typeof value === 'object' && value.ilike) {
            query = query.ilike(key, value.ilike);
          } else if (typeof value === 'object' && value.or) {
            query = query.or(value.or);
          } else {
            query = query.eq(key, value);
          }
        }
      });
    }

    // Apply ordering
    if (optimization.orderBy) {
      query = query.order(optimization.orderBy.column, { 
        ascending: optimization.orderBy.ascending 
      });
    }

    // Apply pagination
    if (optimization.limit) {
      query = query.limit(optimization.limit);
    }

    if (optimization.offset) {
      query = query.range(optimization.offset, optimization.offset + (optimization.limit || 10) - 1);
    }

    // Execute query
    const { data, error } = await query;

    // Cache successful results
    if (!error && data) {
      this.queryCache.set(queryHash, {
        data,
        timestamp: Date.now(),
        ttl: this.DEFAULT_TTL,
      });
    }

    const metrics: QueryMetrics = {
      executionTime: performance.now() - startTime,
      resultCount: Array.isArray(data) ? data.length : 0,
      cacheHit: false,
      queryHash,
    };

    this.recordMetrics(metrics);
    return { data, error, metrics };
  }

  // Optimized robot queries
  async getRobotsOptimized(
    client: SupabaseClient,
    options: {
      userId?: string;
      strategyType?: string;
      searchTerm?: string;
      limit?: number;
      offset?: number;
      orderBy?: 'created_at' | 'updated_at' | 'name';
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<{ data: Robot[] | null; error: any; metrics: QueryMetrics }> {
    const optimization: QueryOptimization = {
      selectFields: ['id', 'name', 'description', 'strategy_type', 'created_at', 'updated_at', 'user_id'],
      limit: options.limit || 20,
      offset: options.offset,
      orderBy: {
        column: options.orderBy || 'created_at',
        ascending: options.orderDirection === 'asc',
      },
    };

    const filters: Record<string, any> = {};

    if (options.userId) {
      filters.user_id = options.userId;
    }

    if (options.strategyType && options.strategyType !== 'All') {
      filters.strategy_type = options.strategyType;
    }

    if (options.searchTerm) {
      // Use full-text search optimization
      filters.or = `name.ilike.%${options.searchTerm}%,description.ilike.%${options.searchTerm}%`;
    }

    optimization.filters = filters;

    return this.executeQuery<Robot>(client, 'robots', optimization);
  }

  // Batch operations for better performance
  async batchInsert<T>(
    client: SupabaseClient,
    table: string,
    records: T[],
    batchSize: number = 100
  ): Promise<{ data: T[] | null; error: any; metrics: QueryMetrics }> {
    const startTime = performance.now();
    const results: T[] = [];
    let errors: any[] = [];

    // Process in batches to avoid payload limits
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        const { data, error } = await client
          .from(table)
          .insert(batch)
          .select();

        if (error) {
          errors.push(error);
        } else if (data) {
          results.push(...data);
        }
      } catch (error) {
        errors.push(error);
      }
    }

    const metrics: QueryMetrics = {
      executionTime: performance.now() - startTime,
      resultCount: results.length,
      cacheHit: false,
      queryHash: `batch_insert_${table}_${records.length}`,
    };

    this.recordMetrics(metrics);
    
    return {
      data: results.length > 0 ? results : null,
      error: errors.length > 0 ? errors : null,
      metrics,
    };
  }

  // Optimized search with database indexes
  async searchRobotsOptimized(
    client: SupabaseClient,
    searchTerm: string,
    filters: {
      strategyType?: string;
      userId?: string;
      dateRange?: { start: string; end: string };
    } = {}
  ): Promise<{ data: Robot[] | null; error: any; metrics: QueryMetrics }> {
    const optimization: QueryOptimization = {
      selectFields: ['id', 'name', 'description', 'strategy_type', 'created_at', 'updated_at'],
      limit: 50, // Reasonable limit for search
    };

    const queryFilters: Record<string, any> = {};

    // Use text search for better performance
    if (searchTerm) {
      queryFilters.or = `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`;
    }

    if (filters.strategyType && filters.strategyType !== 'All') {
      queryFilters.strategy_type = filters.strategyType;
    }

    if (filters.userId) {
      queryFilters.user_id = filters.userId;
    }

    if (filters.dateRange) {
      queryFilters.and = `created_at.gte.${filters.dateRange.start},created_at.lte.${filters.dateRange.end}`;
    }

    optimization.filters = queryFilters;
    optimization.orderBy = { column: 'created_at', ascending: false };

    return this.executeQuery<Robot>(client, 'robots', optimization);
  }

  private recordMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);
    
    // Keep only recent metrics
    if (this.queryMetrics.length > this.MAX_METRICS) {
      this.queryMetrics = this.queryMetrics.slice(-this.MAX_METRICS);
    }
  }

  // Performance analysis
  getPerformanceAnalysis(): {
    averageExecutionTime: number;
    cacheHitRate: number;
    slowQueries: QueryMetrics[];
    totalQueries: number;
  } {
    const totalQueries = this.queryMetrics.length;
    if (totalQueries === 0) {
      return {
        averageExecutionTime: 0,
        cacheHitRate: 0,
        slowQueries: [],
        totalQueries: 0,
      };
    }

    const cacheHits = this.queryMetrics.filter(m => m.cacheHit).length;
    const averageExecutionTime = this.queryMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries;
    const slowQueries = this.queryMetrics.filter(m => m.executionTime > 1000); // Queries > 1s

    return {
      averageExecutionTime,
      cacheHitRate: (cacheHits / totalQueries) * 100,
      slowQueries: slowQueries.sort((a, b) => b.executionTime - a.executionTime).slice(0, 10),
      totalQueries,
    };
  }

  // Clear cache and metrics
  clearCache(): void {
    this.queryCache.clear();
  }

  clearMetrics(): void {
    this.queryMetrics = [];
  }
}

export const queryOptimizer = new QueryOptimizer();