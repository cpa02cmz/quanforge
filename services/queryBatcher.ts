/**
 * Query Batcher - Refactored
 * Coordinates batch processing using modular components
 * 
 * @deprecated Use services/batch/index.ts for direct module access
 */

import { BATCH_SIZES, RETRY_CONFIG, STAGGER } from './constants';
import { ID_GENERATION } from '../constants/modularConfig';
import { createScopedLogger } from '../utils/logger';
import { createListenerManager } from '../utils/listenerManager';
import { enhancedConnectionPool } from './enhancedSupabasePool';
import {
  QueryQueue,
  BatchQuery,
  BatchScheduler,
  QueryExecutor,
  BatchStatistics,
  BatchResult
} from './batch';

const logger = createScopedLogger('QueryBatcher');

interface BatchConfig {
  maxBatchSize: number;
  batchTimeout: number;
  maxWaitTime: number;
  priorityQueues: boolean;
  retryAttempts: number;
  retryDelay: number;
}

interface PendingResult {
  resolve: (result: BatchResult) => void;
  reject: (error: unknown) => void;
  startTime: number;
}

class QueryBatcher {
  private static instance: QueryBatcher;
  private queue: QueryQueue;
  private scheduler: BatchScheduler;
  private executor: QueryExecutor;
  private stats: BatchStatistics;
  private pendingResults = new Map<string, PendingResult>();
  private config: BatchConfig;
  private cleanupManager = createListenerManager();

  private constructor() {
    this.config = {
      maxBatchSize: BATCH_SIZES.DATABASE_OPERATIONS,
      batchTimeout: 50,
      maxWaitTime: STAGGER.DEFAULT_DELAY_MS * 5,
      priorityQueues: true,
      retryAttempts: RETRY_CONFIG.MAX_ATTEMPTS,
      retryDelay: RETRY_CONFIG.DELAYS.SHORT
    };

    this.queue = new QueryQueue({ priorityQueues: this.config.priorityQueues });
    this.scheduler = new BatchScheduler({
      batchTimeout: this.config.batchTimeout,
      maxBatchSize: this.config.maxBatchSize,
      onProcessBatch: () => this.processBatch(),
      shouldProcessImmediately: () => this.shouldProcessImmediately()
    });
    this.executor = new QueryExecutor();
    this.stats = new BatchStatistics();
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
  async addQuery<T = unknown>(
    query: string,
    params: unknown[] = [],
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

      this.queue.add(batchQuery);
      this.scheduler.schedule();
    });
  }

  /**
   * Check if batch should be processed immediately
   */
  private shouldProcessImmediately(): boolean {
    return this.queue.length >= this.config.maxBatchSize || this.queue.hasHighPriority();
  }

  /**
   * Process the current batch
   */
  private async processBatch(): Promise<void> {
    if (this.queue.isEmpty()) {
      return;
    }

    const batch = this.queue.dequeue(this.config.maxBatchSize);
    const startTime = performance.now();

    try {
      const client = await enhancedConnectionPool.acquire(undefined, true);
      try {
        const results = await this.executor.executeBatch(client, batch);
        this.stats.update(batch.length, performance.now() - startTime);
        this.resolveBatch(results);
      } finally {
        enhancedConnectionPool.release(client);
      }
    } catch (error: unknown) {
      logger.error('Batch execution failed:', error);
      this.handleBatchError(batch, error);
    }
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
   * Handle batch execution error
   */
  private handleBatchError(batch: BatchQuery[], error: unknown): void {
    for (const query of batch) {
      const pending = this.pendingResults.get(query.id);
      if (pending) {
        pending.reject(error);
        this.pendingResults.delete(query.id);
      }
    }
    this.stats.recordRetry();
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `${ID_GENERATION.PREFIXES.QUERY}${ID_GENERATION.SEPARATOR}${Date.now()}${ID_GENERATION.SEPARATOR}${Math.random().toString(36).substring(2, ID_GENERATION.RANDOM.STANDARD)}`;
  }

  // Public API methods
  getStats() { return this.stats.getStats(); }
  
  configure(config: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...config };
    logger.log('Configuration updated');
  }

  clearQueue(): void {
    for (const [, pending] of this.pendingResults) {
      pending.reject(new Error('Query queue cleared'));
    }
    this.pendingResults.clear();
    this.queue.clear();
    this.scheduler.cancel();
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      pendingResults: this.pendingResults.size,
      hasHighPriority: this.queue.hasHighPriority(),
      oldestQuery: Date.now() - this.queue.getOldestTimestamp()
    };
  }

  destroy(): void {
    this.clearQueue();
    this.scheduler.destroy();
    this.cleanupManager.cleanup();
    logger.log('QueryBatcher destroyed');
  }
}

// Singleton instance
export const queryBatcher = QueryBatcher.getInstance();

// Utility functions
export const batchSelect = <T = unknown>(
  table: string,
  columns = '*',
  filters: Record<string, unknown> = {},
  priority: BatchQuery['priority'] = 'medium'
): Promise<T[]> => {
  const whereClause = Object.keys(filters).length > 0 ? 
    `where ${Object.keys(filters).map(key => `${key} = ?`).join(' and ')}` : '';
  return queryBatcher.addQuery<T[]>(
    `select ${columns} from ${table} ${whereClause}`,
    Object.values(filters),
    'select',
    priority,
    table
  );
};

export const batchInsert = <T = unknown>(
  table: string,
  data: Partial<T>,
  priority: BatchQuery['priority'] = 'medium'
): Promise<T> => queryBatcher.addQuery<T>(
  `insert into ${table}`,
  [data],
  'insert',
  priority,
  table
);

export const batchUpdate = <T = unknown>(
  table: string,
  data: Partial<T>,
  filters: Record<string, unknown>,
  priority: BatchQuery['priority'] = 'medium'
): Promise<T[]> => queryBatcher.addQuery<T[]>(
  `update ${table}`,
  [data, filters],
  'update',
  priority,
  table
);

export const batchDelete = (
  table: string,
  filters: Record<string, unknown>,
  priority: BatchQuery['priority'] = 'medium'
): Promise<void> => queryBatcher.addQuery<void>(
  `delete from ${table}`,
  [filters],
  'delete',
  priority,
  table
);
