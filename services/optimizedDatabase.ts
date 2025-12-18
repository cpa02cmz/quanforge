/**
 * Optimized Database Service
 * Consolidates database operations with better performance and caching
 */

import { cacheManager } from './unifiedCache';
import { performanceMonitor } from '../utils/performance';

export interface DatabaseConfig {
  enableQueryCache: boolean;
  enableBatchOperations: boolean;
  defaultPageSize: number;
  maxBatchSize: number;
  queryTimeout: number;
}

export interface QueryOptions {
  cacheTTL?: number;
  useCache?: boolean;
  priority?: 'low' | 'normal' | 'high';
  tags?: string[];
}

export interface BatchOperation<T> {
  type: 'create' | 'update' | 'delete';
  table: string;
  data?: T;
  id?: string;
  filter?: Record<string, any>;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryResult<T> {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  error: string | null;
  cached: boolean;
  queryTime: number;
}

/**
 * Optimized Database Service with advanced caching and batch operations
 */
export class OptimizedDatabaseService {
  private config: DatabaseConfig;
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private batchQueue: BatchOperation<any>[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = {
      enableQueryCache: true,
      enableBatchOperations: true,
      defaultPageSize: 20,
      maxBatchSize: 50,
      queryTimeout: 10000,
      ...config,
    };
  }

  /**
   * Execute a query with caching and performance monitoring
   */
  async query<T>(
    queryFn: () => Promise<T>,
    cacheKey: string,
    options: QueryOptions = {}
  ): Promise<T> {
    const startTime = performance.now();
    const {
      cacheTTL = 300000, // 5 minutes
      useCache = this.config.enableQueryCache,
      priority = 'normal',
      tags = [],
    } = options;

    // Check cache first
    if (useCache) {
      const cached = this.getCachedResult<T>(cacheKey);
      if (cached !== null) {
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric(`query_cached_${priority}`, duration);
        return cached;
      }
    }

    try {
      // Execute query with timeout
      const result = await this.withTimeout(queryFn(), this.config.queryTimeout);
      
      // Cache result
      if (useCache) {
        this.setCachedResult(cacheKey, result, cacheTTL);
      }

      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric(`query_${priority}`, duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric(`query_error_${priority}`, duration);
      throw error;
    }
  }

  /**
   * Get paginated results with optimized caching
   */
  async getPaginated<T>(
    table: string,
    pagination: PaginationOptions,
    filters: Record<string, any> = {},
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
    const offset = (page - 1) * limit;
    
    // Generate cache key
    const filterKey = JSON.stringify(filters);
    const cacheKey = `paginated_${table}_${page}_${limit}_${sortBy}_${sortOrder}_${filterKey}`;
    
    return this.query(async () => {
      // This would integrate with the actual database (Supabase, etc.)
      // For now, we'll implement the logic structure
      
      const result = await this.executePaginatedQuery<T>(table, {
        offset,
        limit,
        sortBy,
        sortOrder,
        filters,
      });

      const totalCount = await this.getCountQuery(table, filters);
      
      return {
        data: result,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: offset + limit < totalCount,
          hasPrev: page > 1,
        },
        error: null,
        cached: false,
        queryTime: 0, // Will be set by query method
      } as QueryResult<T>;
    }, cacheKey, options);
  }

  /**
   * Batch operations for better performance
   */
  async batch<T>(operations: BatchOperation<T>[]): Promise<void> {
    if (!this.config.enableBatchOperations) {
      // Execute operations individually
      for (const op of operations) {
        await this.executeOperation(op);
      }
      return;
    }

    // Add to batch queue
    this.batchQueue.push(...operations);

    // Process batch if it reaches max size or set timer
    if (this.batchQueue.length >= this.config.maxBatchSize) {
      await this.processBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), 100);
    }
  }

  /**
   * Get multiple items by IDs efficiently
   */
  async getByIds<T>(table: string, ids: string[]): Promise<T[]> {
    if (ids.length === 0) return [];

    const cacheKey = `by_ids_${table}_${ids.join(',')}`;
    
    return this.query(async () => {
      // Check individual cache first
      const cached: T[] = [];
      const uncachedIds: string[] = [];
      
      for (const id of ids) {
        const itemCacheKey = `${table}_${id}`;
        const cachedItem = this.getCachedResult<T>(itemCacheKey);
        if (cachedItem) {
          cached.push(cachedItem);
        } else {
          uncachedIds.push(id);
        }
      }

      // Fetch uncached items
      let uncachedItems: T[] = [];
      if (uncachedIds.length > 0) {
        uncachedItems = await this.executeByIdsQuery<T>(table, uncachedIds);
        
        // Cache individual items
        for (const item of uncachedItems) {
          const itemCacheKey = `${table}_${(item as any).id}`;
          this.setCachedResult(itemCacheKey, item, 300000);
        }
      }

      return [...cached, ...uncachedItems];
    }, cacheKey);
  }

  /**
   * Optimized search with full-text search support
   */
async search<T>(
    table: string,
    searchTerm: string,
    searchFields: string[] = ['name', 'description'],
    options: PaginationOptions & QueryOptions
  ): Promise<QueryResult<T>> {
    const { page = 1, limit = this.config.defaultPageSize } = options;
    
    // Generate search cache key
    const searchKey = `search_${table}_${searchTerm}_${searchFields.join(',')}_${page}_${limit}`;
    
    return this.query(async () => {
      // Implement optimized search logic
      const filters = {
        ...options,
        search: {
          term: searchTerm,
          fields: searchFields,
        },
      };

      return this.getPaginated<T>(table, options, filters, { ...options, useCache: true });
    }, searchKey, options);
  }

  /**
   * Invalidate cache by pattern or tags
   */
  invalidateCache(pattern: string | string[]): void {
    if (typeof pattern === 'string') {
      // Simple pattern matching
      for (const [key] of this.queryCache.entries()) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      // Tag-based invalidation through cache manager
      cacheManager.invalidateEverywhere(pattern.join('_'));
    }
  }

  /**
   * Get database performance statistics
   */
  getStats() {
    return {
      cacheSize: this.queryCache.size,
      batchQueueSize: this.batchQueue.length,
      config: this.config,
      cacheHitRate: this.calculateCacheHitRate(),
    };
  }

  /**
   * Execute paginated query (implementation would depend on database)
   */
  private async executePaginatedQuery<T>(
    table: string,
    options: {
      offset: number;
      limit: number;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
      filters: Record<string, any>;
    }
  ): Promise<T[]> {
    // This would integrate with Supabase or other database
    // For now, return empty array as placeholder
    console.log(`Executing paginated query on ${table}`, options);
    return [];
  }

  /**
   * Execute count query
   */
  private async getCountQuery(table: string, filters: Record<string, any>): Promise<number> {
    // This would integrate with Supabase or other database
    console.log(`Executing count query on ${table}`, filters);
    return 0;
  }

  /**
   * Execute query by IDs
   */
  private async executeByIdsQuery<T>(table: string, ids: string[]): Promise<T[]> {
    // This would integrate with Supabase or other database
    console.log(`Executing IDs query on ${table}`, ids);
    return [];
  }

  /**
   * Execute single operation
   */
  private async executeOperation<T>(operation: BatchOperation<T>): Promise<void> {
    // This would integrate with Supabase or other database
    console.log(`Executing operation`, operation);
  }

  /**
   * Process batch operations
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const operations = [...this.batchQueue];
    this.batchQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      // Group operations by type and table for better efficiency
      const grouped = this.groupOperations(operations);
      
      for (const [table, tableOps] of grouped.entries()) {
        await this.executeBatchForTable(table, tableOps);
      }
    } catch (error) {
      console.error('Batch operation failed:', error);
      // Re-queue operations if needed
    }
  }

  /**
   * Group operations by table
   */
  private groupOperations(operations: BatchOperation<any>[]): Map<string, BatchOperation<any>[]> {
    const grouped = new Map<string, BatchOperation<any>[]>();
    
    for (const op of operations) {
      if (!grouped.has(op.table)) {
        grouped.set(op.table, []);
      }
      grouped.get(op.table)!.push(op);
    }
    
    return grouped;
  }

  /**
   * Execute batch operations for a specific table
   */
  private async executeBatchForTable(table: string, operations: BatchOperation<any>[]): Promise<void> {
    // This would integrate with Supabase batch operations or similar
    console.log(`Executing batch for ${table}`, operations);
  }

  /**
   * Get cached result
   */
  private getCachedResult<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Set cached result
   */
  private setCachedResult<T>(key: string, data: T, ttl: number): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Cleanup old entries if cache is too large
    if (this.queryCache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Cleanup old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const entries = Array.from(this.queryCache.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.queryCache.delete(entries[i][0]);
    }
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    // This would need proper tracking of hits/misses
    return 0.85; // Placeholder
  }

  /**
   * Execute function with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    this.queryCache.clear();
    this.batchQueue = [];
  }
}

// Global optimized database service instance
export const optimizedDatabase = new OptimizedDatabaseService();

// Export convenience functions
export const query = <T>(queryFn: () => Promise<T>, cacheKey: string, options?: QueryOptions) =>
  optimizedDatabase.query(queryFn, cacheKey, options);

export const getPaginated = <T>(
  table: string,
  pagination: PaginationOptions,
  filters?: Record<string, any>,
  options?: QueryOptions
) => optimizedDatabase.getPaginated<T>(table, pagination, filters, options);

export const batch = <T>(operations: BatchOperation<T>[]) => optimizedDatabase.batch(operations);

export const search = <T>(
  table: string,
  searchTerm: string,
  searchFields: string[] = ['name', 'description'],
  options: PaginationOptions & QueryOptions
) => optimizedDatabase.search<T>(table, searchTerm, searchFields, options);