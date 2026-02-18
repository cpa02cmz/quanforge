/**
 * Batch Statistics Tracker
 * Monitors and reports batch performance metrics
 */

import { createScopedLogger } from '../../utils/logger';

const logger = () => createScopedLogger('BatchStatistics');

export interface BatchStats {
  totalBatches: number;
  totalQueries: number;
  avgBatchSize: number;
  avgExecutionTime: number;
  cacheHitRate: number;
  retryRate: number;
}

export class BatchStatistics {
  private stats: BatchStats = {
    totalBatches: 0,
    totalQueries: 0,
    avgBatchSize: 0,
    avgExecutionTime: 0,
    cacheHitRate: 0,
    retryRate: 0
  };

  private retryCount = 0;

  /**
   * Update statistics after batch execution
   */
  update(batchSize: number, executionTime: number): void {
    this.stats.totalBatches++;
    this.stats.totalQueries += batchSize;
    this.stats.avgBatchSize = this.stats.totalQueries / this.stats.totalBatches;
    this.stats.avgExecutionTime = 
      (this.stats.avgExecutionTime * (this.stats.totalBatches - 1) + executionTime) / 
      this.stats.totalBatches;
    
    logger().debug(`Stats updated: avgBatchSize=${this.stats.avgBatchSize.toFixed(2)}, avgExecutionTime=${this.stats.avgExecutionTime.toFixed(2)}ms`);
  }

  /**
   * Record a retry
   */
  recordRetry(): void {
    this.retryCount++;
    this.stats.retryRate = this.retryCount / this.stats.totalBatches;
  }

  /**
   * Get current statistics (read-only copy)
   */
  getStats(): Readonly<BatchStats> {
    return { ...this.stats };
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.stats = {
      totalBatches: 0,
      totalQueries: 0,
      avgBatchSize: 0,
      avgExecutionTime: 0,
      cacheHitRate: 0,
      retryRate: 0
    };
    this.retryCount = 0;
    logger().debug('Statistics reset');
  }

  /**
   * Get formatted statistics for reporting
   */
  getReport(): string {
    return `
Batch Statistics:
  Total Batches: ${this.stats.totalBatches}
  Total Queries: ${this.stats.totalQueries}
  Avg Batch Size: ${this.stats.avgBatchSize.toFixed(2)}
  Avg Execution Time: ${this.stats.avgExecutionTime.toFixed(2)}ms
  Retry Rate: ${(this.stats.retryRate * 100).toFixed(2)}%
    `.trim();
  }
}
