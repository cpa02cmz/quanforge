/**
 * API Batch Operations Service
 * Efficient bulk API operations with concurrency control, progress tracking, and error handling
 * 
 * @module services/api/apiBatchOperations
 */

import { createScopedLogger } from '../../utils/logger';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';
import { apiRequestInterceptor, type RequestConfig } from './apiRequestInterceptor';

const logger = createScopedLogger('APIBatchOperations');

/**
 * Batch item configuration
 */
export interface BatchItem<T = unknown, _R = unknown> {
  id: string;
  config: RequestConfig;
  input?: T;
  retries?: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Batch item result
 */
export interface BatchResult<R = unknown> {
  id: string;
  success: boolean;
  data?: R;
  error?: Error;
  duration: number;
  retries: number;
}

/**
 * Batch operation configuration
 */
export interface BatchConfig {
  concurrency?: number;
  stopOnError?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  onProgress?: (completed: number, total: number) => void;
  onItemComplete?: <R>(result: BatchResult<R>) => void;
  onItemError?: <R>(result: BatchResult<R>) => void;
}

/**
 * Batch operation status
 */
export interface BatchStatus {
  id: string;
  total: number;
  completed: number;
  successful: number;
  failed: number;
  pending: number;
  inProgress: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

/**
 * Batch operation summary
 */
export interface BatchSummary<R = unknown> {
  id: string;
  total: number;
  successful: number;
  failed: number;
  duration: number;
  results: BatchResult<R>[];
  errors: Array<{ id: string; error: Error }>;
}

/**
 * Active batch operation
 */
interface ActiveBatch<R = unknown> {
  id: string;
  items: BatchItem[];
  results: BatchResult<R>[];
  config: BatchConfig;
  status: BatchStatus;
  abortController: AbortController;
  resolve: (summary: BatchSummary<unknown>) => void;
  reject: (error: Error) => void;
}

/**
 * API Batch Operations Service
 * 
 * Features:
 * - Concurrent batch execution with configurable limits
 * - Progress tracking and callbacks
 * - Individual item retry logic
 * - Stop-on-error support
 * - Batch cancellation
 * - Partial success handling
 * - Priority-based processing
 */
export class APIBatchOperations {
  private activeBatches = new Map<string, ActiveBatch>();
  private batchCounter = 0;
  private readonly defaultConcurrency: number;
  private readonly defaultMaxRetries: number;
  private readonly defaultRetryDelay: number;
  
  // Statistics
  private stats = {
    totalBatches: 0,
    totalItems: 0,
    successfulItems: 0,
    failedItems: 0,
    averageBatchDuration: 0
  };

  constructor(options?: {
    defaultConcurrency?: number;
    defaultMaxRetries?: number;
    defaultRetryDelay?: number;
  }) {
    this.defaultConcurrency = options?.defaultConcurrency ?? 5;
    this.defaultMaxRetries = options?.defaultMaxRetries ?? 2;
    this.defaultRetryDelay = options?.defaultRetryDelay ?? 1000;
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiBatchOperations', {
        cleanup: () => this.destroy(),
        priority: 'medium',
        description: 'API batch operations service'
      });
    }
  }

  /**
   * Execute a batch of API requests
   */
  async executeBatch<T = unknown, R = unknown>(
    items: BatchItem<T>[],
    config: BatchConfig = {}
  ): Promise<BatchSummary<R>> {
    const batchId = this.generateBatchId();
    
    if (items.length === 0) {
      return {
        id: batchId,
        total: 0,
        successful: 0,
        failed: 0,
        duration: 0,
        results: [],
        errors: []
      };
    }

    return new Promise<BatchSummary<R>>((resolve, reject) => {
      const batch: ActiveBatch<R> = {
        id: batchId,
        items: this.sortByPriority(items),
        results: [],
        config: {
          concurrency: config.concurrency ?? this.defaultConcurrency,
          stopOnError: config.stopOnError ?? false,
          maxRetries: config.maxRetries ?? this.defaultMaxRetries,
          retryDelay: config.retryDelay ?? this.defaultRetryDelay,
          timeout: config.timeout,
          onProgress: config.onProgress,
          onItemComplete: config.onItemComplete,
          onItemError: config.onItemError
        },
        status: {
          id: batchId,
          total: items.length,
          completed: 0,
          successful: 0,
          failed: 0,
          pending: items.length,
          inProgress: 0,
          startTime: Date.now(),
          status: 'pending'
        },
        abortController: new AbortController(),
        resolve: resolve as (summary: BatchSummary<unknown>) => void,
        reject
      };

      this.activeBatches.set(batchId, batch);
      this.stats.totalBatches++;
      this.stats.totalItems += items.length;

      this.processBatch<R>(batch);
    });
  }

  /**
   * Execute batch with chunking for large datasets
   */
  async executeChunked<T = unknown, R = unknown>(
    items: BatchItem<T>[],
    chunkSize: number,
    config: BatchConfig = {}
  ): Promise<BatchSummary<R>[]> {
    const chunks = this.chunkArray(items, chunkSize);
    const results: BatchSummary<R>[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;
      
      logger.debug(`Processing chunk ${i + 1}/${chunks.length} with ${chunk.length} items`);
      
      const result = await this.executeBatch<T, R>(chunk, {
        ...config,
        onProgress: config.onProgress
          ? (completed, _total) => {
              const overallCompleted = (i * chunkSize) + completed;
              const overallTotal = items.length;
              config.onProgress?.(overallCompleted, overallTotal);
            }
          : undefined
      });
      
      results.push(result);

      // Stop if configured and chunk failed
      if (config.stopOnError && result.failed > 0) {
        break;
      }
    }

    return results;
  }

  /**
   * Get status of an active batch
   */
  getBatchStatus(batchId: string): BatchStatus | null {
    const batch = this.activeBatches.get(batchId);
    return batch?.status ?? null;
  }

  /**
   * Cancel an active batch
   */
  cancelBatch(batchId: string): boolean {
    const batch = this.activeBatches.get(batchId);
    if (!batch || batch.status.status === 'completed' || batch.status.status === 'cancelled') {
      return false;
    }

    batch.abortController.abort();
    batch.status.status = 'cancelled';
    batch.status.endTime = Date.now();
    batch.status.duration = batch.status.endTime - batch.status.startTime;

    const summary = this.createSummary<unknown>(batch);
    batch.resolve(summary);

    logger.info(`Batch ${batchId} cancelled`);
    return true;
  }

  /**
   * Cancel all active batches
   */
  cancelAllBatches(): number {
    let count = 0;
    for (const batchId of this.activeBatches.keys()) {
      if (this.cancelBatch(batchId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get statistics
   */
  getStats(): typeof this.stats & { activeBatches: number } {
    return {
      ...this.stats,
      activeBatches: this.activeBatches.size
    };
  }

  /**
   * Get active batch IDs
   */
  getActiveBatchIds(): string[] {
    return Array.from(this.activeBatches.keys());
  }

  // Private methods

  private generateBatchId(): string {
    return `batch_${Date.now()}_${++this.batchCounter}`;
  }

  private sortByPriority<T>(items: BatchItem<T>[]): BatchItem<T>[] {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return [...items].sort((a, b) => {
      const aPriority = priorityOrder[a.priority || 'medium'];
      const bPriority = priorityOrder[b.priority || 'medium'];
      return aPriority - bPriority;
    });
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async processBatch<R>(batch: ActiveBatch<R>): Promise<void> {
    batch.status.status = 'running';
    
    const { concurrency, stopOnError } = batch.config;
    const queue = [...batch.items];
    const inProgress = new Set<Promise<void>>();

    const processItem = async (item: BatchItem): Promise<void> => {
      if (batch.abortController.signal.aborted) {
        return;
      }

      batch.status.inProgress++;
      batch.status.pending--;

      const result = await this.executeItem<R>(item, batch);

      batch.results.push(result);
      batch.status.inProgress--;
      batch.status.completed++;

      if (result.success) {
        batch.status.successful++;
        this.stats.successfulItems++;
        batch.config.onItemComplete?.(result);
      } else {
        batch.status.failed++;
        this.stats.failedItems++;
        batch.config.onItemError?.(result);

        if (stopOnError) {
          batch.abortController.abort();
        }
      }

      batch.config.onProgress?.(batch.status.completed, batch.status.total);
    };

    while (queue.length > 0 || inProgress.size > 0) {
      if (batch.abortController.signal.aborted) {
        break;
      }

      // Fill up to concurrency limit
      while (queue.length > 0 && inProgress.size < (concurrency ?? this.defaultConcurrency)) {
        const item = queue.shift();
        if (item) {
          const promise = processItem(item).finally(() => {
            inProgress.delete(promise);
          });
          inProgress.add(promise);
        }
      }

      // Wait for at least one item to complete
      if (inProgress.size > 0) {
        await Promise.race(inProgress);
      }
    }

    // Wait for all remaining items
    await Promise.allSettled(inProgress);

    // Finalize batch
    batch.status.status = batch.abortController.signal.aborted ? 'cancelled' : 
      (batch.status.failed > 0 && stopOnError ? 'failed' : 'completed');
    batch.status.endTime = Date.now();
    batch.status.duration = batch.status.endTime - batch.status.startTime;

    const summary = this.createSummary<R>(batch);
    batch.resolve(summary);

    this.activeBatches.delete(batch.id);
  }

  private async executeItem<R>(
    item: BatchItem,
    batch: ActiveBatch<R>
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const maxRetries = item.retries ?? batch.config.maxRetries ?? this.defaultMaxRetries;
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= maxRetries) {
      if (batch.abortController.signal.aborted) {
        return {
          id: item.id,
          success: false,
          error: new Error('Batch cancelled'),
          duration: Date.now() - startTime,
          retries: attempt
        };
      }

      try {
        const response = await apiRequestInterceptor.request<R>({
          ...item.config,
          timeout: item.config.timeout ?? batch.config.timeout,
          signal: batch.abortController.signal
        });

        return {
          id: item.id,
          success: true,
          data: response.data,
          duration: Date.now() - startTime,
          retries: attempt
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt <= maxRetries) {
          const delay = this.calculateRetryDelay(attempt, batch.config.retryDelay);
          await this.delay(delay);
        }
      }
    }

    return {
      id: item.id,
      success: false,
      error: lastError,
      duration: Date.now() - startTime,
      retries: attempt - 1
    };
  }

  private calculateRetryDelay(attempt: number, baseDelay?: number): number {
    const delay = baseDelay ?? this.defaultRetryDelay;
    const exponentialDelay = delay * Math.pow(2, attempt - 1);
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.min(exponentialDelay + jitter, 10000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createSummary<R>(batch: ActiveBatch<R>): BatchSummary<R> {
    return {
      id: batch.id,
      total: batch.status.total,
      successful: batch.status.successful,
      failed: batch.status.failed,
      duration: batch.status.duration ?? 0,
      results: batch.results,
      errors: batch.results
        .filter(r => !r.success && r.error)
        .map(r => ({ id: r.id, error: r.error! }))
    };
  }

  /**
   * Destroy the service and clean up resources
   */
  destroy(): void {
    this.cancelAllBatches();
    this.activeBatches.clear();
    logger.info('API Batch Operations destroyed');
  }
}

// Create singleton instance
export const apiBatchOperations = new APIBatchOperations();

// React hook for batch operations
export const useAPIBatchOperations = () => ({
  executeBatch: <T = unknown, R = unknown>(
    items: BatchItem<T>[],
    config?: BatchConfig
  ) => apiBatchOperations.executeBatch<T, R>(items, config),
  
  executeChunked: <T = unknown, R = unknown>(
    items: BatchItem<T>[],
    chunkSize: number,
    config?: BatchConfig
  ) => apiBatchOperations.executeChunked<T, R>(items, chunkSize, config),
  
  getBatchStatus: (batchId: string) => apiBatchOperations.getBatchStatus(batchId),
  cancelBatch: (batchId: string) => apiBatchOperations.cancelBatch(batchId),
  cancelAllBatches: () => apiBatchOperations.cancelAllBatches(),
  getStats: () => apiBatchOperations.getStats()
});
