import { settingsManager } from './settingsManager';
import { handleError } from '../utils/errorHandler';
import { consolidatedCache } from './consolidatedCacheManager';
import { connectionPool } from './supabaseConnectionPool';

interface QueryOptimization {
  originalQuery: string;
  optimizedQuery: string;
  improvements: string[];
  estimatedPerformanceGain: number;
}

interface QueryMetrics {
  executionTime: number;
  resultCount: number;
  cacheHit: boolean;
  timestamp: number;
}

interface PaginationOptions {
  page: number;
  limit: number;
  offset: number;
  orderBy?: string;
  ascending?: boolean;
}

interface IndexRecommendation {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

interface BatchQuery<T = any> {
  query: string;
  params?: any[];
  cacheKey?: string;
  ttl?: number;
}

interface QueryResult<T = any> {
  data?: T;
  error?: any;
  cached?: boolean;
}

export class QueryOptimizerEnhanced {
  private queryMetrics: Map<string, QueryMetrics[]> = new Map();
  private indexRecommendations: Map<string, IndexRecommendation[]> = new Map();
  private batchQueue: Map<string, BatchQuery[]> = new Map();
  private batchTimeout: Map<string, NodeJS.Timeout> = new Map();
  private readonly BATCH_DELAY = 50; // 50ms batching window
  private readonly METRICS_RETENTION_LIMIT = 1000;
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second

  constructor() {
    this.initializeOptimizations();
  }

  private initializeOptimizations(): void {
    // Pre-compute common query patterns
    this.precomputeCommonQueries();
    
    // Initialize index recommendations
    this.initializeIndexRecommendations();
    
    // Set up periodic optimization
    this.setupPeriodicOptimization();
  }

  private precomputeCommonQueries(): void {
    // Placeholder for future optimization
  }

  private initializeIndexRecommendations(): void {
    // Placeholder for future optimization
  }

  private setupPeriodicOptimization(): void {
    // Placeholder for future optimization
  }

  async batchQuery<T>(queries: BatchQuery[]): Promise<QueryResult<T>[]> {
    const results: QueryResult<T>[] = [];
    const cache = new Map<string, any>();

    for (const { query, params, cacheKey, ttl = 300000 } of queries) {
      // Check cache first
      if (cacheKey) {
        const cached = await consolidatedCache.get(cacheKey);
        if (cached) {
          results.push({ data: cached, cached: true });
          continue;
        }
      }

      try {
        const client = await connectionPool.getClient();
        let result: any;

        // Handle different query types
        if (query.includes('SELECT')) {
          result = await client
            .from('robots')
            .select(query.replace('SELECT ', ''));
        } else if (query.includes('INSERT')) {
          result = await client
            .from('robots')
            .insert(params);
        } else if (query.includes('UPDATE')) {
          result = await client
            .from('robots')
            .update(params?.[1])
            .eq('id', params?.[0]);
        } else {
          // Fallback to RPC for custom queries
          result = await client.rpc('exec_sql', { query, params });
        }

        if (cacheKey && result.data) {
          await consolidatedCache.set(cacheKey, result.data, 'api');
        }

        results.push({ data: result.data, error: result.error, cached: false });
      } catch (error) {
        results.push({ error, cached: false });
      }
    }

    return results;
  }

  // Optimized search with indexing
  async optimizedSearch<T>(
    table: string,
    searchTerm: string,
    options: {
      columns?: string[];
      limit?: number;
      offset?: number;
      orderBy?: string;
      ascending?: boolean;
      cacheKey?: string;
      ttl?: number;
    } = {}
  ): Promise<{ data: T[]; error: any; cached: boolean }> {
    const {
      columns = '*',
      limit = 50,
      offset = 0,
      orderBy = 'created_at',
      ascending = false,
      cacheKey,
      ttl = 300000
    } = options;

    // Generate cache key if not provided
    const finalCacheKey = cacheKey || `search_${table}_${searchTerm}_${JSON.stringify(options)}`;

    // Check cache
    if (cacheKey) {
      const cached = await consolidatedCache.get(finalCacheKey);
      if (cached) {
        return { data: cached, error: null, cached: true };
      }
    }

    try {
      const client = await connectionPool.getClient();
      
      // Sanitize search term to prevent injection
      const sanitizedTerm = searchTerm.replace(/['";\\]/g, '');
      
      // Use full-text search if available, otherwise fallback to ILIKE
      let query: any;
      if (sanitizedTerm.includes(' ')) {
        // Full-text search for multi-word queries
        query = client
          .from(table)
          .select(columns as string)
          .textSearch('search_vector', sanitizedTerm)
          .order(orderBy, { ascending })
          .range(offset, offset + limit - 1);
      } else {
        // Simple search for single words
        query = client
          .from(table)
          .select(columns as string)
          .or(`name.ilike.%${sanitizedTerm}%,description.ilike.%${sanitizedTerm}%,strategy.ilike.%${sanitizedTerm}%`)
          .order(orderBy, { ascending })
          .range(offset, offset + limit - 1);
      }

      const result = await query;

      // Cache successful results
      if (cacheKey && result.data) {
        await consolidatedCache.set(finalCacheKey, result.data, 'api');
      }

      return { data: result.data || [], error: result.error, cached: false };
    } catch (error) {
      return { data: [], error, cached: false };
    }
  }

  // Prepared statement for frequently used queries
  async getPreparedStatement(queryName: string, params: any[] = []): Promise<any> {
    const cacheKey = `prepared_${queryName}_${JSON.stringify(params)}`;
    
    // Check cache first
    const cached = await consolidatedCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const client = await connectionPool.getClient();
      let result: any;

      switch (queryName) {
        case 'get_robot_by_id':
          result = await client
            .from('robots')
            .select('*')
            .eq('id', params[0])
            .single();
          break;
        
        case 'get_user_robots':
          result = await client
            .from('robots')
            .select('*')
            .eq('user_id', params[0])
            .order('created_at', { ascending: false });
          break;
        
        case 'get_recent_robots':
          result = await client
            .from('robots')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(params[0] || 10);
          break;
        
        case 'get_popular_strategies':
          // Use RPC for complex queries
          result = await client.rpc('get_popular_strategies', { 
            limit: params[0] || 5 
          });
          break;
        
        default:
          throw new Error(`Unknown prepared statement: ${queryName}`);
      }

      // Cache successful results
      if (result.data) {
        await consolidatedCache.set(cacheKey, result.data, 'api');
      }

      return result;
    } catch (error) {
// Removed for production: console.error(`Prepared statement ${queryName} failed:`, error);
      throw error;
    }
  }

  // Query performance monitoring
  async executeWithMonitoring<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<{ data: T; executionTime: number; cached: boolean }> {
    const startTime = performance.now();
    const cacheKey = `monitor_${queryName}`;
    
    // Check if we have recent performance data
    const perfData = await consolidatedCache.get(cacheKey);
    if (perfData && (Date.now() - perfData.timestamp) < 60000) {
      return { data: perfData.data, executionTime: perfData.executionTime, cached: true };
    }

    try {
      const result = await queryFn();
      const executionTime = performance.now() - startTime;

      // Cache performance data
      await consolidatedCache.set(cacheKey, {
        data: result,
        executionTime,
        timestamp: Date.now()
      }, 'performance');

      return { data: result, executionTime, cached: false };
    } catch (error) {
      const executionTime = performance.now() - startTime;
// Removed for production: console.error(`Query ${queryName} failed after ${executionTime}ms:`, error);
      throw error;
    }
  }

  // Batch operations for better performance
  async batchInsert<T>(
    table: string,
    records: T[],
    options: {
      batchSize?: number;
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<{ data: T[] | null; error: any }> {
    const { batchSize = 1000, onProgress } = options;
    const client = await connectionPool.getClient();
    
    try {
      const results: T[] = [];
      const totalBatches = Math.ceil(records.length / batchSize);

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { data, error } = await client
          .from(table)
          .insert(batch)
          .select();

        if (error) throw error;
        if (data) results.push(...data);

        // Report progress
        if (onProgress) {
          const progress = Math.round(((i + batchSize) / records.length) * 100);
          onProgress(Math.min(progress, 100));
        }
      }

      return { data: results, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  // Intelligent query batching
  private async processBatch(batchId: string): Promise<void> {
    const queries = this.batchQueue.get(batchId) || [];
    if (queries.length === 0) return;

    this.batchQueue.delete(batchId);
    const timeout = this.batchTimeout.get(batchId);
    if (timeout) {
      clearTimeout(timeout);
      this.batchTimeout.delete(batchId);
    }

    await this.batchQuery(queries);
  }

  // Add query to batch
  addToBatch(batchId: string, query: BatchQuery): void {
    if (!this.batchQueue.has(batchId)) {
      this.batchQueue.set(batchId, []);
    }

    this.batchQueue.get(batchId)!.push(query);

    // Set timeout to process batch
    if (!this.batchTimeout.has(batchId)) {
      const timeout = setTimeout(() => {
        this.processBatch(batchId);
      }, this.BATCH_DELAY);
      this.batchTimeout.set(batchId, timeout);
    }
  }

  // Clear batch queue
  clearBatch(batchId: string): void {
    this.batchQueue.delete(batchId);
    const timeout = this.batchTimeout.get(batchId);
    if (timeout) {
      clearTimeout(timeout);
      this.batchTimeout.delete(batchId);
    }
  }

  // Get query statistics
  getQueryStats(): {
    batchQueueSize: number;
    activeBatches: number;
    cacheHitRate: number;
  } {
    const totalQueries = Array.from(this.batchQueue.values())
      .reduce((sum, queries) => sum + queries.length, 0);
    
    return {
      batchQueueSize: totalQueries,
      activeBatches: this.batchQueue.size,
      cacheHitRate: 0, // TODO: Implement hit rate tracking in consolidated cache
    };
  }
}

export const queryOptimizer = new QueryOptimizerEnhanced();