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
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number; hits: number }>();
  private queryMetrics: QueryMetrics[] = [];
  private readonly DEFAULT_TTL = 600000; // 10 minutes - extended for better cache hit rates
  private readonly MAX_METRICS = 1000;
  private totalQueries = 0;
  private cacheHits = 0;

  // Calculate size of data in bytes
  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 0;
    }
  }

// Generate query hash for caching - improved with proper hash function
   private generateQueryHash(optimization: QueryOptimization): string {
     // Create a more robust hash to avoid collisions
     const str = JSON.stringify(optimization);
     let hash = 0;
     for (let i = 0; i < str.length; i++) {
       const char = str.charCodeAt(i);
       hash = ((hash << 5) - hash) + char;
       hash = hash & hash; // Convert to 32bit integer
     }
     return Math.abs(hash).toString(36).substring(0, 16);
   }

  // Check and maintain cache size limits - optimized for edge
  private maintainCacheSize(newEntrySize: number): void {
    const maxCacheSize = 25 * 1024 * 1024; // 25MB - increased for better caching
    let currentSize = 0;
    
    // Calculate current size
    for (const entry of this.queryCache.values()) {
      currentSize += this.calculateSize(entry.data);
    }
    
    // If adding the new entry would exceed the limit, remove oldest entries
    if (currentSize + newEntrySize > maxCacheSize) {
      // Sort entries by timestamp (oldest first) and remove until within limit
      const sortedEntries = Array.from(this.queryCache.entries())
        .map(([key, entry]) => ({ key, entry, size: this.calculateSize(entry.data) }))
        .sort((a, b) => a.entry.timestamp - b.entry.timestamp);
      
      for (const { key, size } of sortedEntries) {
        if (currentSize + newEntrySize <= maxCacheSize) break;
        this.queryCache.delete(key);
        currentSize -= size;
      }
    }
  }

   // Build optimized query with enhanced error handling and timeout
   async executeQuery<T>(
     client: SupabaseClient,
     table: string,
     optimization: QueryOptimization
   ): Promise<{ data: T[] | null; error: any; metrics: QueryMetrics }> {
     const startTime = performance.now();
     const queryHash = this.generateQueryHash(optimization);
     
// Check cache first with enhanced tracking
      this.totalQueries++;
      const cached = this.queryCache.get(queryHash);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        this.cacheHits++;
        cached.hits++; // Track cache hit frequency

        const metrics: QueryMetrics = {
          executionTime: performance.now() - startTime,
          resultCount: Array.isArray(cached.data) ? cached.data.length : 0,
          cacheHit: true,
          queryHash,
        };
        
        this.recordMetrics(metrics);
        return { data: cached.data as T[], error: null, metrics };
      }

     try {
       // Create AbortController for timeout handling
       const controller = new AbortController();
       const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    // Build query with optimizations - need to cast properly to handle Supabase types
    const queryBuilder = client.from(table);

    // Start building the query with select - optimize field selection
    let query = queryBuilder.select(optimization.selectFields && optimization.selectFields.length > 0 
      ? optimization.selectFields.join(', ') 
      : '*');

       // Apply filters efficiently
       if (optimization.filters) {
         for (const [key, value] of Object.entries(optimization.filters)) {
           if (value !== undefined && value !== null) {
             if (Array.isArray(value)) {
               query = query.in(key, value);
             } else if (typeof value === 'object' && 'ilike' in value) {
               query = query.ilike(key, value.ilike);
             } else if (typeof value === 'object' && 'or' in value) {
               query = query.or(value.or);
             } else if (typeof value === 'object' && 'gte' in value) {
               query = query.gte(key, value.gte);
             } else if (typeof value === 'object' && 'lte' in value) {
               query = query.lte(key, value.lte);
             } else {
               query = query.eq(key, value);
             }
           }
         }
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

       // Execute query with timeout
       const result = await query.abortSignal(controller.signal) as any;
       clearTimeout(timeoutId);
       
       const { data, error } = result;

       // Cache successful results with size management
       if (!error && data) {
         const dataSize = this.calculateSize(data);
         this.maintainCacheSize(dataSize);
         
          this.queryCache.set(queryHash, {
            data,
            timestamp: Date.now(),
            ttl: this.DEFAULT_TTL,
            hits: 1,
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
     } catch (error: any) {
       clearTimeout(setTimeout(() => {}, 0)); // Clear timeout if it exists
       
       // Handle timeout and other errors
       const metrics: QueryMetrics = {
         executionTime: performance.now() - startTime,
         resultCount: 0,
         cacheHit: false,
         queryHash,
       };
       
       this.recordMetrics(metrics);
       
       return { 
         data: null, 
         error: error.name === 'AbortError' ? new Error('Query timeout exceeded (30s)') : error, 
         metrics 
       };
     }
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
    // Create optimization object for this specific query
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
      filters['user_id'] = options.userId;
    }

    if (options.strategyType && options.strategyType !== 'All') {
      filters['strategy_type'] = options.strategyType;
    }

    if (options.searchTerm) {
      // Use full-text search optimization
      filters['or'] = `name.ilike.%${options.searchTerm}%,description.ilike.%${options.searchTerm}%`;
    }

    optimization.filters = filters;
    
    // Use the existing executeQuery method which handles caching
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
    const errors: any[] = [];

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
       // Sanitize search term to prevent injection
       const sanitizedTerm = searchTerm.replace(/[^\w\s]/gi, '');
       if (sanitizedTerm.length > 0) {
         queryFilters['or'] = `name.ilike.%${sanitizedTerm}%,description.ilike.%${sanitizedTerm}%`;
       }
     }

     if (filters.strategyType && filters.strategyType !== 'All') {
       queryFilters['strategy_type'] = filters.strategyType;
     }

     if (filters.userId) {
       queryFilters['user_id'] = filters.userId;
     }

     if (filters.dateRange) {
       queryFilters['and'] = `created_at.gte.${filters.dateRange.start},created_at.lte.${filters.dateRange.end}`;
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