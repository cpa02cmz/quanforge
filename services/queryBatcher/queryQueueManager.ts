/**
 * Query Queue Manager
 * Handles query queueing, prioritization, and batch formation
 */

import { BatchQuery, BatchConfig, PendingQuery, QueryBatch } from './queryTypes';

export class QueryQueueManager {
  private batchQueue: BatchQuery[] = [];
  private pendingResults: Map<string, PendingQuery> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(private config: BatchConfig) {}

  /**
   * Add a query to the batch queue
   */
  addQuery<T = any>(
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
        resolve: resolve as (result: any) => void,
        reject,
        startTime: performance.now()
      });

      this.addToQueue(batchQuery);
      this.scheduleBatchProcessing();
    });
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    pendingQueries: number;
    queriesByPriority: Record<string, number>;
    oldestQueryAge: number;
  } {
    const queriesByPriority: Record<string, number> = {
      high: 0,
      medium: 0,
      low: 0
    };

    let oldestTimestamp = Date.now();

    for (const query of this.batchQueue) {
      queriesByPriority[query.priority]++;
      oldestTimestamp = Math.min(oldestTimestamp, query.timestamp);
    }

    return {
      pendingQueries: this.batchQueue.length,
      queriesByPriority,
      oldestQueryAge: Date.now() - oldestTimestamp
    };
  }

  /**
   * Get next batch to process
   */
  getNextBatch(): QueryBatch | null {
    if (this.batchQueue.length === 0) {
      return null;
    }

    const queries = this.extractBatch();
    const totalWaitTime = this.calculateTotalWaitTime(queries);
    const priority = this.calculateBatchPriority(queries);

    return {
      queries,
      totalWaitTime,
      priority
    };
  }

  /**
   * Process batch results
   */
  processBatchResults(results: Array<{ id: string; data?: any; error?: any; executionTime: number }>): void {
    for (const result of results) {
      const pending = this.pendingResults.get(result.id);
      if (pending) {
        this.pendingResults.delete(result.id);
        
        if (result.error) {
          pending.reject(result.error);
        } else {
          pending.resolve(result);
        }
      }
    }
  }

  /**
   * Clear queue and pending results
   */
  clearQueue(): void {
    this.batchQueue = [];
    this.pendingResults.clear();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): BatchConfig {
    return { ...this.config };
  }

  /**
   * Cancel a specific query
   */
  cancelQuery(queryId: string): boolean {
    const pendingIndex = this.batchQueue.findIndex(q => q.id === queryId);
    if (pendingIndex !== -1) {
      this.batchQueue.splice(pendingIndex, 1);
    }

    const pending = this.pendingResults.get(queryId);
    if (pending) {
      this.pendingResults.delete(queryId);
      pending.reject(new Error('Query cancelled'));
      return true;
    }

    return false;
  }

  /**
   * Get queries waiting longer than max wait time
   */
  getOverdueQueries(): BatchQuery[] {
    const now = Date.now();
    return this.batchQueue.filter(query => 
      now - query.timestamp > this.config.maxWaitTime
    );
  }

  // Private methods

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add query to queue with priority ordering
   */
  private addToQueue(query: BatchQuery): void {
    if (this.config.priorityQueues) {
      this.insertByPriority(query);
    } else {
      this.batchQueue.push(query);
    }
  }

  /**
   * Insert query by priority (high priority first)
   */
  private insertByPriority(query: BatchQuery): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const queryPriority = priorityOrder[query.priority] ?? 1;

    let insertIndex = this.batchQueue.length;
    for (let i = 0; i < this.batchQueue.length; i++) {
      const existingPriority = priorityOrder[this.batchQueue[i].priority] ?? 1;
      if (queryPriority < existingPriority) {
        insertIndex = i;
        break;
      }
    }

    this.batchQueue.splice(insertIndex, 0, query);
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer) {
      return; // Already scheduled
    }

    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      // The actual batch processing will be handled by the QueryBatchProcessor
    }, this.config.batchTimeout);
  }

  /**
   * Extract batch from queue
   */
  private extractBatch(): BatchQuery[] {
    const batchSize = Math.min(this.config.maxBatchSize, this.batchQueue.length);
    return this.batchQueue.splice(0, batchSize);
  }

  /**
   * Calculate total wait time for a batch
   */
  private calculateTotalWaitTime(queries: BatchQuery[]): number {
    if (queries.length === 0) return 0;
    
    const now = Date.now();
    const totalWaitTime = queries.reduce((sum, query) => sum + (now - query.timestamp), 0);
    return totalWaitTime / queries.length;
  }

  /**
   * Calculate batch priority based on contained queries
   */
  private calculateBatchPriority(queries: BatchQuery[]): 'high' | 'medium' | 'low' {
    if (queries.length === 0) return 'medium';

    const priorityCounts = { high: 0, medium: 0, low: 0 };
    for (const query of queries) {
      priorityCounts[query.priority]++;
    }

    if (priorityCounts.high > 0) return 'high';
    if (priorityCounts.medium > priorityCounts.low) return 'medium';
    return 'low';
  }
}