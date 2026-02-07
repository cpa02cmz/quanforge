/**
 * Query Batching System
 * Reduces database round trips by batching multiple queries
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface BatchQuery {
  id: string;
  query: string;
  params?: any[];
  table?: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

interface BatchResult {
  id: string;
  data?: any;
  error?: any;
  executionTime: number;
}

interface BatchConfig {
  maxBatchSize: number;
  batchTimeout: number;
  maxWaitTime: number;
  priorityQueues: boolean;
  retryAttempts: number;
  retryDelay: number;
}

class QueryBatcher {
  private static instance: QueryBatcher;
  private batchQueue: BatchQuery[] = [];
  private pendingResults: Map<string, {
    resolve: (result: BatchResult) => void;
    reject: (error: any) => void;
    startTime: number;
  }> = new Map();
  private config: BatchConfig = {
    maxBatchSize: 10,
    batchTimeout: 50, // 50ms
    maxWaitTime: 500, // 500ms max wait
    priorityQueues: true,
    retryAttempts: 3,
    retryDelay: 100
  };
  private batchTimer: number | null = null;
  private stats = {
    totalBatches: 0,
    totalQueries: 0,
    avgBatchSize: 0,
    avgExecutionTime: 0,
    cacheHitRate: 0,
    retryRate: 0
  };

  private constructor() {
    this.startBatchProcessor();
  }

  static getInstance(): QueryBatcher {
    if (!QueryBatcher.instance) {
      QueryBatcher.instance = new QueryBatcher();
    }
    return QueryBatcher.instance;
  }

  /**
   * Add a query to the batch queue
   */
  async addQuery<T = any>(
    query: string,
    params: any[] = [],
    operation: BatchQuery['operation'] = 'select',
    priority: BatchQuery['priority'] = 'medium',
    table?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.generateQueryId();
      const batchQuery: BatchQuery = {
        id,
        query,
        params,
        table,
        operation,
        priority,
        timestamp: Date.now()
      };

      this.pendingResults.set(id, {
        resolve: resolve as (result: BatchResult) => void,
        reject,
        startTime: performance.now()
      });

      this.addToQueue(batchQuery);
      this.scheduleBatch();
    });
  }

  /**
   * Add query to appropriate queue based on priority
   */
  private addToQueue(query: BatchQuery): void {
    if (this.config.priorityQueues) {
      // Insert based on priority
      let insertIndex = this.batchQueue.length;
      
      for (let i = 0; i < this.batchQueue.length; i++) {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const batchItem = this.batchQueue[i];
        if (!batchItem) continue;
        const currentPriority = priorityOrder[batchItem.priority];
        const newPriority = priorityOrder[query.priority];
        
        if (newPriority > currentPriority) {
          insertIndex = i;
          break;
        }
      }
      
      this.batchQueue.splice(insertIndex, 0, query);
    } else {
      this.batchQueue.push(query);
    }
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch(): void {
    if (this.batchTimer) {
      return;
    }

    const shouldProcessImmediately = 
      this.batchQueue.length >= this.config.maxBatchSize ||
      this.hasHighPriorityQueries();

    const delay = shouldProcessImmediately ? 0 : this.config.batchTimeout;

    this.batchTimer = window.setTimeout(() => {
      this.processBatch();
      this.batchTimer = null;
    }, delay);
  }

  /**
   * Check if there are high priority queries that should be processed immediately
   */
  private hasHighPriorityQueries(): boolean {
    return this.batchQueue.some(query => query.priority === 'high');
  }

  /**
   * Process the current batch of queries
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    const batch = this.batchQueue.splice(0, this.config.maxBatchSize);
    const startTime = performance.now();

    try {
      const results = await this.executeBatch(batch);
      const executionTime = performance.now() - startTime;

      this.updateStats(batch.length, executionTime);
      this.resolveBatch(results);

    } catch (error) {
      console.error('Batch execution failed:', error);
      await this.handleBatchError(batch, error);
    }
  }

  /**
   * Execute a batch of queries
   */
  private async executeBatch(batch: BatchQuery[]): Promise<BatchResult[]> {
    // Group queries by table and operation for optimization
    const groupedQueries = this.groupQueries(batch);
    const results: BatchResult[] = [];

    for (const group of groupedQueries) {
      try {
        const groupResults = await this.executeQueryGroup(group);
        results.push(...groupResults);
      } catch (error) {
        // Add error results for all queries in this group
        const errorResults = group.queries.map(query => ({
          id: query.id,
          error,
          executionTime: 0
        }));
        results.push(...errorResults);
      }
    }

    return results;
  }

  /**
   * Group queries by table and operation for batch optimization
   */
  private groupQueries(batch: BatchQuery[]): Array<{
    table?: string;
    operation: BatchQuery['operation'];
    queries: BatchQuery[];
  }> {
    const groups = new Map<string, {
      table?: string;
      operation: BatchQuery['operation'];
      queries: BatchQuery[];
    }>();

    for (const query of batch) {
      const key = `${query.table || 'no-table'}-${query.operation}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          table: query.table,
          operation: query.operation,
          queries: []
        });
      }
      
      groups.get(key)!.queries.push(query);
    }

    return Array.from(groups.values());
  }

  /**
   * Execute a group of related queries
   */
  private async executeQueryGroup(group: {
    table?: string;
    operation: BatchQuery['operation'];
    queries: BatchQuery[];
  }): Promise<BatchResult[]> {
    const { operation, queries } = group;
    const results: BatchResult[] = [];

    // Get Supabase client
    const { enhancedConnectionPool } = await import('./enhancedSupabasePool');
    const client = await enhancedConnectionPool.acquire(undefined, operation === 'select');

    try {
      switch (operation) {
        case 'select':
          results.push(...await this.executeSelectQueries(client, queries));
          break;
        case 'insert':
          results.push(...await this.executeInsertQueries(client, queries));
          break;
        case 'update':
          results.push(...await this.executeUpdateQueries(client, queries));
          break;
        case 'delete':
          results.push(...await this.executeDeleteQueries(client, queries));
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } finally {
      enhancedConnectionPool.release(client);
    }

    return results;
  }

  /**
   * Execute SELECT queries (can be optimized with IN clauses)
   */
  private async executeSelectQueries(
    client: SupabaseClient,
    queries: BatchQuery[]
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    // Try to combine compatible SELECT queries
    const combinedQueries = this.combineSelectQueries(queries);

    for (const combined of combinedQueries) {
      const startTime = performance.now();
      
      try {
        let queryBuilder = client.from(combined.table!);

        // Apply combined filters
        if (combined.combinedFilters) {
          for (const filter of combined.combinedFilters) {
            (queryBuilder as any) = (queryBuilder as any).filter(filter.column, filter.operator, filter.value);
          }
        }

        // Apply select columns
        if (combined.selectColumns) {
          (queryBuilder as any) = (queryBuilder as any).select(combined.selectColumns);
        }

        const { data, error } = await (queryBuilder as any);

        const executionTime = performance.now() - startTime;

        // Distribute results back to original queries
        for (const originalQuery of combined.originalQueries) {
          if (error) {
            results.push({
              id: originalQuery.id,
              error,
              executionTime
            });
          } else {
            // Filter data for this specific query if needed
            const queryData = this.filterDataForQuery(data, originalQuery);
            results.push({
              id: originalQuery.id,
              data: queryData,
              executionTime
            });
          }
        }
      } catch (error) {
        const executionTime = performance.now() - startTime;
        for (const originalQuery of combined.originalQueries) {
          results.push({
            id: originalQuery.id,
            error,
            executionTime
          });
        }
      }
    }

    return results;
  }

  /**
   * Combine compatible SELECT queries for better performance
   */
  private combineSelectQueries(queries: BatchQuery[]): Array<{
    table: string;
    originalQueries: BatchQuery[];
    combinedFilters?: Array<{ column: string; operator: string; value: any }>;
    selectColumns?: string;
  }> {
    const groups = new Map<string, BatchQuery[]>();

    // Group by table and select columns
    for (const query of queries) {
      const key = `${query.table || 'unknown'}-${this.extractSelectColumns(query)}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(query);
    }

    const combined: Array<{
      table: string;
      originalQueries: BatchQuery[];
      combinedFilters?: Array<{ column: string; operator: string; value: any }>;
      selectColumns?: string;
    }> = [];

    for (const [key, groupQueries] of groups) {
      const [table, selectColumns] = key.split('-');
      if (!table) continue;

      combined.push({
        table,
        originalQueries: groupQueries,
        selectColumns: selectColumns !== 'undefined' ? selectColumns : undefined,
        combinedFilters: this.extractFilters(groupQueries)
      });
    }

    return combined;
  }

  /**
   * Extract select columns from query
   */
  private extractSelectColumns(query: BatchQuery): string {
    // Simple parsing - in real implementation, this would be more sophisticated
    const match = query.query.match(/select\s+(.+?)\s+from/i);
    return match?.[1]?.trim() ?? '*';
  }

  /**
   * Extract filters from queries
   */
  private extractFilters(queries: BatchQuery[]): Array<{ column: string; operator: string; value: any }> {
    const filters: Array<{ column: string; operator: string; value: any }> = [];
    
    // This is a simplified implementation
    // In practice, you'd parse the SQL queries more carefully
    for (const query of queries) {
      if (query.params && query.params.length > 0) {
        // Extract filter information from parameters
        // This would need to be more sophisticated in practice
      }
    }

    return filters;
  }

  /**
   * Filter data for specific query
   */
  private filterDataForQuery(data: any[], _query: BatchQuery): any[] {
    // Simple implementation - in practice, this would be more sophisticated
    return data;
  }

  /**
   * Execute INSERT queries
   */
  private async executeInsertQueries(
    client: SupabaseClient,
    queries: BatchQuery[]
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const query of queries) {
      const startTime = performance.now();
      
      try {
        const { data, error } = await client
          .from(query.table!)
          .insert(query.params?.[0] || {});

        const executionTime = performance.now() - startTime;
        
        results.push({
          id: query.id,
          data,
          error,
          executionTime
        });
      } catch (error) {
        const executionTime = performance.now() - startTime;
        results.push({
          id: query.id,
          error,
          executionTime
        });
      }
    }

    return results;
  }

  /**
   * Execute UPDATE queries
   */
  private async executeUpdateQueries(
    client: SupabaseClient,
    queries: BatchQuery[]
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const query of queries) {
      const startTime = performance.now();
      
      try {
        const [updateData, filterCondition] = query.params || [{}, {}];
        let queryBuilder = client.from(query.table!).update(updateData);

        // Apply filter conditions
        for (const [column, value] of Object.entries(filterCondition)) {
          queryBuilder = queryBuilder.eq(column, value);
        }

        const { data, error } = await queryBuilder;

        const executionTime = performance.now() - startTime;
        
        results.push({
          id: query.id,
          data,
          error,
          executionTime
        });
      } catch (error) {
        const executionTime = performance.now() - startTime;
        results.push({
          id: query.id,
          error,
          executionTime
        });
      }
    }

    return results;
  }

  /**
   * Execute DELETE queries
   */
  private async executeDeleteQueries(
    client: SupabaseClient,
    queries: BatchQuery[]
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const query of queries) {
      const startTime = performance.now();
      
      try {
        let queryBuilder = client.from(query.table!).delete();

        // Apply filter conditions
        if (query.params && query.params.length > 0) {
          const filterCondition = query.params[0];
          for (const [column, value] of Object.entries(filterCondition)) {
            queryBuilder = queryBuilder.eq(column, value);
          }
        }

        const { data, error } = await queryBuilder;

        const executionTime = performance.now() - startTime;
        
        results.push({
          id: query.id,
          data,
          error,
          executionTime
        });
      } catch (error) {
        const executionTime = performance.now() - startTime;
        results.push({
          id: query.id,
          error,
          executionTime
        });
      }
    }

    return results;
  }

  /**
   * Handle batch execution errors
   */
  private async handleBatchError(batch: BatchQuery[], error: any): Promise<void> {
    // Retry logic for failed batches
    for (const query of batch) {
      const pending = this.pendingResults.get(query.id);
      if (pending) {
        pending.reject(error);
        this.pendingResults.delete(query.id);
      }
    }

    this.stats.retryRate++;
  }

  /**
   * Resolve batch results to pending promises
   */
  private resolveBatch(results: BatchResult[]): void {
    for (const result of results) {
      const pending = this.pendingResults.get(result.id);
      if (pending) {
        if (result.error) {
          pending.reject(result.error);
        } else {
          pending.resolve(result);
        }
        
        this.pendingResults.delete(result.id);
      }
    }
  }

  /**
   * Start the batch processor
   */
  private startBatchProcessor(): void {
    // Process any remaining queries every second
    setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.processBatch();
      }
    }, 1000);
  }

  /**
   * Update performance statistics
   */
  private updateStats(batchSize: number, executionTime: number): void {
    this.stats.totalBatches++;
    this.stats.totalQueries += batchSize;
    this.stats.avgBatchSize = this.stats.totalQueries / this.stats.totalBatches;
    this.stats.avgExecutionTime = 
      (this.stats.avgExecutionTime * (this.stats.totalBatches - 1) + executionTime) / 
      this.stats.totalBatches;
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Configure batcher settings
   */
  configure(config: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('Query batcher configuration updated:', this.config);
  }

  /**
   * Clear all pending queries
   */
  clearQueue(): void {
    // Reject all pending queries
    for (const [, pending] of this.pendingResults.entries()) {
      pending.reject(new Error('Query queue cleared'));
    }
    
    this.pendingResults.clear();
    this.batchQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.batchQueue.length,
      pendingResults: this.pendingResults.size,
      hasHighPriority: this.hasHighPriorityQueries(),
      oldestQuery: this.batchQueue.length > 0 && this.batchQueue[0] ? 
        Date.now() - this.batchQueue[0].timestamp : 0
    };
  }
}

export const queryBatcher = QueryBatcher.getInstance();

// Utility functions for common use cases
export const batchSelect = <T = any>(
  table: string,
  columns: string = '*',
  filters: Record<string, any> = {},
  priority: BatchQuery['priority'] = 'medium'
): Promise<T[]> => {
  const whereClause = Object.keys(filters).length > 0 ? 
    `where ${Object.keys(filters).map(key => `${key} = ?`).join(' and ')}` : '';
    
  const query = `select ${columns} from ${table} ${whereClause}`;
  const params = Object.values(filters);

  return queryBatcher.addQuery<T[]>(query, params, 'select', priority, table);
};

export const batchInsert = <T = any>(
  table: string,
  data: Partial<T>,
  priority: BatchQuery['priority'] = 'medium'
): Promise<T> => {
  const query = `insert into ${table}`;
  const params = [data];

  return queryBatcher.addQuery<T>(query, params, 'insert', priority, table);
};

export const batchUpdate = <T = any>(
  table: string,
  data: Partial<T>,
  filters: Record<string, any>,
  priority: BatchQuery['priority'] = 'medium'
): Promise<T[]> => {
  const query = `update ${table}`;
  const params = [data, filters];

  return queryBatcher.addQuery<T[]>(query, params, 'update', priority, table);
};

export const batchDelete = (
  table: string,
  filters: Record<string, any>,
  priority: BatchQuery['priority'] = 'medium'
): Promise<void> => {
  const query = `delete from ${table}`;
  const params = [filters];

  return queryBatcher.addQuery<void>(query, params, 'delete', priority, table);
};