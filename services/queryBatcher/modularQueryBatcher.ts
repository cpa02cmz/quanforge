/**
 * Modular Query Batching Manager
 * Orchestrates all query batching activities through modular components
 * Flexy loves modularity! All hardcoded values moved to batchConfig.ts
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BatchQuery, BatchConfig, BatchStats, QueryBatch } from './queryTypes';
import { QueryQueueManager } from './queryQueueManager';
import { QueryExecutionEngine } from './queryExecutionEngine';
import {
  DEFAULT_BATCH_CONFIG,
  QUEUE_HEALTH_THRESHOLDS,
  QUERY_EXECUTION_LIMITS
} from './batchConfig';
import { createScopedLogger } from '../../utils/logger';
import { STATUS_TYPES } from '../../constants/modularConfig';

const logger = createScopedLogger('QueryBatcher');

class QueryBatcher {
  private static instance: QueryBatcher;
  private queueManager: QueryQueueManager;
  private executionEngine: QueryExecutionEngine;
  private batchProcessor: ReturnType<typeof setInterval> | null = null;
  private stats: BatchStats = {
    totalBatches: 0,
    totalQueries: 0,
    avgBatchSize: 0,
    avgExecutionTime: 0,
    cacheHitRate: 0,
    retryRate: 0
  };

  private constructor(
    client: SupabaseClient,
    config: Partial<BatchConfig> = {}
  ) {
    const finalConfig: BatchConfig = { ...DEFAULT_BATCH_CONFIG, ...config };

    this.queueManager = new QueryQueueManager(finalConfig);
    this.executionEngine = new QueryExecutionEngine(client, {
      retryAttempts: finalConfig.retryAttempts,
      retryDelay: finalConfig.retryDelay
    });

    this.startBatchProcessor();
  }

  static getInstance(
    client?: SupabaseClient,
    config?: Partial<BatchConfig>
  ): QueryBatcher {
    if (!QueryBatcher.instance) {
      if (!client) {
        throw new Error('Supabase client required for first instantiation');
      }
      QueryBatcher.instance = new QueryBatcher(client, config);
    }
    return QueryBatcher.instance;
  }

  /**
   * Add a query to the batch queue (backward compatibility)
   */
  async addQuery<T = any>(
    query: string,
    params: any[] = [],
    operation: BatchQuery['operation'] = 'select',
    priority: BatchQuery['priority'] = 'medium',
    table?: string
  ): Promise<T> {
    return this.queueManager.addQuery<T>(query, params, operation, priority, table);
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    pendingQueries: number;
    queriesByPriority: Record<string, number>;
    oldestQueryAge: number;
  } {
    return this.queueManager.getQueueStatus();
  }

  /**
   * Get current statistics
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.queueManager.updateConfig(newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): BatchConfig {
    return this.queueManager.getConfig();
  }

  /**
   * Cancel a specific query
   */
  cancelQuery(queryId: string): boolean {
    return this.queueManager.cancelQuery(queryId);
  }

  /**
   * Force immediate batch processing
   */
  async forceProcessBatch(): Promise<{
    processed: number;
    errors: number;
    avgExecutionTime: number;
  }> {
    return this.processBatchImmediate();
  }

  /**
   * Get queue health metrics
   */
  getQueueHealth(): {
    status: typeof STATUS_TYPES.HEALTH[keyof typeof STATUS_TYPES.HEALTH];
    pendingQueries: number;
    overdueQueries: number;
    avgWaitTime: number;
    recommendations: string[];
  } {
    const queueStatus = this.queueManager.getQueueStatus();
    const overdueQueries = this.queueManager.getOverdueQueries().length;

    let status: typeof STATUS_TYPES.HEALTH[keyof typeof STATUS_TYPES.HEALTH] = STATUS_TYPES.HEALTH.HEALTHY;
    const recommendations: string[] = [];

    if (queueStatus.pendingQueries > QUEUE_HEALTH_THRESHOLDS.PENDING_CRITICAL) {
      status = STATUS_TYPES.HEALTH.CRITICAL;
      recommendations.push('Queue size is very high, consider increasing batch size or timeout');
    } else if (queueStatus.pendingQueries > QUEUE_HEALTH_THRESHOLDS.PENDING_WARNING) {
      status = STATUS_TYPES.HEALTH.WARNING;
      recommendations.push('Monitor queue size for potential bottlenecks');
    }

    if (overdueQueries > QUEUE_HEALTH_THRESHOLDS.OVERDUE_CRITICAL) {
      status = STATUS_TYPES.HEALTH.CRITICAL;
      recommendations.push('Many overdue queries detected - check database performance');
    } else if (overdueQueries > QUEUE_HEALTH_THRESHOLDS.OVERDUE_WARNING) {
      status = STATUS_TYPES.HEALTH.WARNING;
      recommendations.push('Some queries are waiting too long');
    }

    if (queueStatus.oldestQueryAge > QUEUE_HEALTH_THRESHOLDS.MAX_WAIT_TIME_WARNING) {
      status = STATUS_TYPES.HEALTH.WARNING;
      recommendations.push('Oldest query is waiting too long');
    }

    return {
      status,
      pendingQueries: queueStatus.pendingQueries,
      overdueQueries,
      avgWaitTime: queueStatus.oldestQueryAge,
      recommendations
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalBatches: 0,
      totalQueries: 0,
      avgBatchSize: 0,
      avgExecutionTime: 0,
      cacheHitRate: 0,
      retryRate: 0
    };
  }

  /**
   * Clean shutdown
   */
  shutdown(): void {
    if (this.batchProcessor) {
      clearTimeout(this.batchProcessor);
      this.batchProcessor = null;
    }
    
    // Process remaining queries immediately
    this.processBatchImmediate().catch(err => logger.error('Failed to process batch during shutdown:', err));
    logger.log('Querybatcher shutting down');
  }

  /**
   * Start the batch processor
   */
  private startBatchProcessor(): void {
    const config = this.queueManager.getConfig();
    
    const processBatch = () => {
      this.processBatchImmediate().catch(err => logger.error('Batch processing failed:', err));
      
      // Schedule next batch processing
      this.batchProcessor = setTimeout(processBatch, config.batchTimeout);
    };

    this.batchProcessor = setTimeout(processBatch, config.batchTimeout);
  }

  /**
   * Process a batch immediately
   */
  private async processBatchImmediate(): Promise<{
    processed: number;
    errors: number;
    avgExecutionTime: number;
  }> {
    const batch = this.queueManager.getNextBatch();
    
    if (!batch) {
      return {
        processed: 0,
        errors: 0,
        avgExecutionTime: 0
      };
    }

    const startTime = performance.now();
    
    try {
      // Execute the batch
      const results = await this.executionEngine.executeBatch(batch.queries);
      
      // Process results back to the queue manager
      this.queueManager.processBatchResults(results);
      
      // Update statistics
      const executionTime = performance.now() - startTime;
      this.updateStats(batch, results, executionTime);
      
      const errors = results.filter(r => r.error).length;
      
      return {
        processed: batch.queries.length,
        errors,
        avgExecutionTime: executionTime
      };
    } catch (error: unknown) {
      console.error('Batch processing failed:', error);
      
      // Create error results for all queries
      const errorResults = batch.queries.map(query => ({
        id: query.id,
        error: {
          code: 'BATCH_FAILED',
          message: `Batch execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'database',
          status: QUERY_EXECUTION_LIMITS.ERROR_STATUS_SERVER,
          details: { batchId: Date.now(), originalError: error }
        } as any,
        executionTime: performance.now() - startTime
      }));
      
      this.queueManager.processBatchResults(errorResults);
      
      return {
        processed: batch.queries.length,
        errors: batch.queries.length,
        avgExecutionTime: performance.now() - startTime
      };
    }
  }

  /**
   * Update statistics
   */
  private updateStats(
    batch: QueryBatch,
    results: Array<{ id: string; error?: any; executionTime: number }>,
    executionTime: number
  ): void {
    this.stats.totalBatches++;
    this.stats.totalQueries += batch.queries.length;
    this.stats.avgBatchSize = this.stats.totalQueries / this.stats.totalBatches;
    this.stats.avgExecutionTime = 
      (this.stats.avgExecutionTime * (this.stats.totalBatches - 1) + executionTime) / 
      this.stats.totalBatches;
    
    // Calculate retry rate (simplified)
    const errors = results.filter(r => r.error).length;
    this.stats.retryRate = (errors / batch.queries.length) * 100;

    // Cache hit rate would be calculated based on cache implementation
    // For now, keeping it at 0
  }
}

// Export singleton instance
export const queryBatcher = {
  getInstance: QueryBatcher.getInstance
};

// Export class for testing
export { QueryBatcher };