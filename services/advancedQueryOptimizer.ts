/**
 * Advanced Database Query Optimizer with Batching and Connection Pooling
 * Provides high-performance database operations with intelligent caching
 */

import { Robot } from '../types';

export interface QueryOptions {
  cache?: boolean;
  cacheTTL?: number;
  batch?: boolean;
  priority?: 'high' | 'normal' | 'low';
  timeout?: number;
}

export interface BatchQuery<T> {
  id: string;
  query: () => Promise<T>;
  priority: 'high' | 'normal' | 'low';
  timeout: number;
  resolve: (_value: T) => void;
  reject: (_reason: any) => void;
}

export interface QueryMetrics {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  averageQueryTime: number;
  batchQueries: number;
  connectionPoolUtilization: number;
}

export class AdvancedQueryOptimizer {
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private batchQueue: BatchQuery<any>[] = [];
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private connectionPool: any[] = [];
  private activeConnections = 0;
  private maxConnections = 10;
  private metrics: QueryMetrics = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageQueryTime: 0,
    batchQueries: 0,
    connectionPoolUtilization: 0
  };
  private queryTimes: number[] = [];

  constructor(maxConnections: number = 10) {
    this.maxConnections = maxConnections;
    this.initializeConnectionPool();
  }

  /**
   * Initialize connection pool with optimal sizing
   */
  private initializeConnectionPool(): void {
    // Pre-warm connection pool
    for (let i = 0; i < Math.min(5, this.maxConnections); i++) {
      this.connectionPool.push({
        id: `conn_${i}`,
        inUse: false,
        lastUsed: Date.now(),
        queryCount: 0
      });
    }
  }

  /**
   * Get available connection from pool
   */
  private async getConnection(): Promise<any> {
    // Find available connection
    let connection = this.connectionPool.find(conn => !conn.inUse);
    
    if (!connection) {
      // Create new connection if under limit
      if (this.activeConnections < this.maxConnections) {
        connection = {
          id: `conn_${Date.now()}_${Math.random()}`,
          inUse: false,
          lastUsed: Date.now(),
          queryCount: 0
        };
        this.connectionPool.push(connection);
        this.activeConnections++;
      } else {
        // Wait for available connection
        await this.waitForConnection();
        return this.getConnection();
      }
    }

    connection.inUse = true;
    connection.lastUsed = Date.now();
    return connection;
  }

  /**
   * Release connection back to pool
   */
  private releaseConnection(connection: any): void {
    connection.inUse = false;
    this.updateConnectionPoolMetrics();
  }

  /**
   * Wait for available connection
   */
  private async waitForConnection(): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const availableConnection = this.connectionPool.find(conn => !conn.inUse);
        if (availableConnection) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 10);
    });
  }

  /**
   * Update connection pool utilization metrics
   */
  private updateConnectionPoolMetrics(): void {
    const activeConnections = this.connectionPool.filter(conn => conn.inUse).length;
    this.metrics.connectionPoolUtilization = (activeConnections / this.maxConnections) * 100;
  }

  /**
   * Execute query with caching and batching support
   */
  async executeQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const startTime = performance.now();
    this.metrics.totalQueries++;

    try {
// Check cache first
    if (options.cache !== false) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached !== null) {
        this.metrics.cacheHits++;
        return cached;
      }
      this.metrics.cacheMisses++;
    }

      // Execute query (batched or immediate)
      let result: T;
      if (options.batch !== false) {
        result = await this.executeBatchQuery(cacheKey, queryFn, options);
      } else {
        result = await this.executeQueryImmediate(queryFn, options);
      }

      // Cache result
      if (options.cache !== false) {
        this.setCache(cacheKey, result, options.cacheTTL);
      }

      // Update metrics
      const queryTime = performance.now() - startTime;
      this.updateQueryMetrics(queryTime);

      return result;
    } catch (error) {
      const queryTime = performance.now() - startTime;
      this.updateQueryMetrics(queryTime);
      throw error;
    }
  }

  /**
   * Execute query immediately with connection pooling
   */
  private async executeQueryImmediate<T>(
    queryFn: () => Promise<T>,
    options: QueryOptions
  ): Promise<T> {
    const connection = await this.getConnection();
    
    try {
      // Add timeout if specified
      if (options.timeout) {
        return await Promise.race([
          queryFn(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), options.timeout)
          )
        ]);
      }
      
      const result = await queryFn();
      return result as T;
    } finally {
      this.releaseConnection(connection);
    }
  }

  /**
   * Execute query as part of a batch
   */
  private async executeBatchQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    options: QueryOptions
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const batchQuery: BatchQuery<T> = {
        id: cacheKey,
        query: queryFn,
        priority: options.priority || 'normal',
        timeout: options.timeout || 30000,
        resolve,
        reject
      };

      this.batchQueue.push(batchQuery);
      this.metrics.batchQueries++;

      // Sort queue by priority
      this.batchQueue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Schedule batch execution
      this.scheduleBatchExecution();
    });
  }

  /**
   * Schedule batch execution with optimal timing
   */
  private scheduleBatchExecution(): void {
    if (this.batchTimer) return;

    // Dynamic batch timing based on queue size and priority
    const hasHighPriority = this.batchQueue.some(q => q.priority === 'high');
    const batchSize = this.batchQueue.length;
    
    let delay = 50; // Default 50ms
    if (hasHighPriority) delay = 10; // 10ms for high priority
    else if (batchSize > 10) delay = 25; // 25ms for large batches
    else if (batchSize > 5) delay = 35; // 35ms for medium batches

    this.batchTimer = setTimeout(() => {
      this.executeBatch();
      this.batchTimer = null;
    }, delay);
  }

  /**
   * Execute batch of queries
   */
  private async executeBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, Math.min(10, this.batchQueue.length));
    const connection = await this.getConnection();

    try {
      // Execute queries in parallel with connection pooling
      const queryPromises = batch.map(async (batchQuery) => {
        try {
          const result = await Promise.race([
            batchQuery.query(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout')), batchQuery.timeout)
            )
          ]);
          batchQuery.resolve(result);
        } catch (error) {
          batchQuery.reject(error);
        }
      });

      await Promise.allSettled(queryPromises);
    } finally {
      this.releaseConnection(connection);
    }

    // Schedule next batch if queue still has items
    if (this.batchQueue.length > 0) {
      this.scheduleBatchExecution();
    }
  }

  /**
   * Batch update multiple robots efficiently
   */
  async batchUpdateRobots(updates: Array<{ id: string; data: Partial<Robot> }>): Promise<Robot[]> {
    const batchSize = 20; // Optimal batch size for updates
    const results: Robot[] = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const batchPromises = batch.map(async ({ id, data }) => {
        return this.executeQuery(
          `robot_update_${id}`,
          async () => {
            // Simulate database update - replace with actual implementation
            return { 
              id, 
              user_id: 'default_user',
              name: data.name || `Updated Robot ${id}`,
              description: data.description || `Updated description for ${id}`,
              code: data.code || `// Updated code for ${id}`,
              strategy_type: data.strategy_type || 'Custom',
              strategy_params: data.strategy_params,
              backtest_settings: data.backtest_settings,
              analysis_result: data.analysis_result,
              chat_history: data.chat_history,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as Robot;
          },
          { batch: true, priority: 'normal', cache: false }
        );
      });

      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Failed to update robot ${batch[index].id}:`, result.reason);
        }
      });
    }

    return results;
  }

  /**
   * Get multiple robots by IDs efficiently
   */
  async getRobotsByIds(ids: string[]): Promise<Robot[]> {
    const uniqueIds = [...new Set(ids)]; // Remove duplicates
    const cacheKey = `robots_batch_${uniqueIds.sort().join(',')}`;
    
    return this.executeQuery(
      cacheKey,
      async () => {
        // Simulate database query - replace with actual implementation
        const robots: Robot[] = [];
        for (const id of uniqueIds) {
          // Mock robot data - replace with actual database call
          robots.push({
            id,
            user_id: 'default_user',
            name: `Robot ${id}`,
            description: `Description for ${id}`,
            code: `// Code for ${id}`,
            strategy_type: 'Custom',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as Robot);
        }
        return robots;
      },
      { batch: true, priority: 'normal', cache: true, cacheTTL: 300000 }
    );
  }

  /**
   * Get paginated robots with optimized queries
   */
  async getRobotsPaginated(
    page: number = 1,
    limit: number = 20,
    filters: Record<string, any> = {}
  ): Promise<{ robots: Robot[]; total: number; page: number; totalPages: number }> {
    const cacheKey = `robots_page_${page}_limit_${limit}_${JSON.stringify(filters)}`;
    
    return this.executeQuery(
      cacheKey,
      async () => {
        // Simulate paginated query - replace with actual implementation
        const offset = (page - 1) * limit;
        
        // Mock data - replace with actual database calls
        const total = 100; // Mock total count
        const robots: Robot[] = [];
        
        for (let i = 0; i < limit && i + offset < total; i++) {
          robots.push({
            id: `robot_${i + offset}`,
            user_id: 'default_user',
            name: `Robot ${i + offset}`,
            description: `Description for ${i + offset}`,
            code: `// Code for ${i + offset}`,
            strategy_type: 'Custom',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as Robot);
        }
        
        return {
          robots,
          total,
          page,
          totalPages: Math.ceil(total / limit)
        };
      },
      { batch: true, priority: 'normal', cache: true, cacheTTL: 60000 }
    );
  }

  /**
   * Get value from cache
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null as T;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set value in cache
   */
  private setCache<T>(key: string, data: T, ttl: number = 300000): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Cleanup old cache entries periodically
    if (this.queryCache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.queryCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Update query metrics
   */
  private updateQueryMetrics(queryTime: number): void {
    this.queryTimes.push(queryTime);
    
    // Keep only last 100 query times for average calculation
    if (this.queryTimes.length > 100) {
      this.queryTimes = this.queryTimes.slice(-100);
    }
    
    this.metrics.averageQueryTime = 
      this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): QueryMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    missRate: number;
  } {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return {
      size: this.queryCache.size,
      hitRate: total > 0 ? (this.metrics.cacheHits / total) * 100 : 0,
      missRate: total > 0 ? (this.metrics.cacheMisses / total) * 100 : 0
    };
  }

  /**
   * Get connection pool statistics
   */
  getConnectionPoolStats(): {
    totalConnections: number;
    activeConnections: number;
    utilization: number;
    averageQueriesPerConnection: number;
  } {
    const activeConnections = this.connectionPool.filter(conn => conn.inUse).length;
    const totalQueries = this.connectionPool.reduce((sum, conn) => sum + conn.queryCount, 0);
    
    return {
      totalConnections: this.connectionPool.length,
      activeConnections,
      utilization: this.metrics.connectionPoolUtilization,
      averageQueriesPerConnection: this.connectionPool.length > 0 ? totalQueries / this.connectionPool.length : 0
    };
  }

  /**
   * Optimize connection pool based on current usage
   */
  optimizeConnectionPool(): void {
    const stats = this.getConnectionPoolStats();
    
    // Add connections if utilization is high
    if (stats.utilization > 80 && this.connectionPool.length < this.maxConnections) {
      const newConnections = Math.min(2, this.maxConnections - this.connectionPool.length);
      for (let i = 0; i < newConnections; i++) {
        this.connectionPool.push({
          id: `conn_${Date.now()}_${Math.random()}`,
          inUse: false,
          lastUsed: Date.now(),
          queryCount: 0
        });
      }
    }
    
    // Remove idle connections if utilization is low
    if (stats.utilization < 30 && this.connectionPool.length > 5) {
      const idleConnections = this.connectionPool
        .filter(conn => !conn.inUse && conn.queryCount < 10)
        .sort((a, b) => a.lastUsed - b.lastUsed);
      
      const toRemove = Math.min(2, idleConnections.length);
      for (let i = 0; i < toRemove; i++) {
        const index = this.connectionPool.indexOf(idleConnections[i]);
        if (index > -1) {
          this.connectionPool.splice(index, 1);
          this.activeConnections--;
        }
      }
    }
  }

  /**
   * Clear all caches and reset metrics
   */
  reset(): void {
    this.queryCache.clear();
    this.batchQueue = [];
    this.metrics = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageQueryTime: 0,
      batchQueries: 0,
      connectionPoolUtilization: 0
    };
    this.queryTimes = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.reset();
    this.connectionPool = [];
    this.activeConnections = 0;
  }
}

// Singleton instance
export const queryOptimizer = new AdvancedQueryOptimizer();