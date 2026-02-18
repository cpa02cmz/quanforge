/**
 * Batch Query Queue Management
 * Handles priority-based query queuing
 */

import { createScopedLogger } from '../../utils/logger';

const logger = () => createScopedLogger('QueryQueue');

export type BatchOperation = 'select' | 'insert' | 'update' | 'delete';

export interface BatchQuery {
  id: string;
  query: string;
  params?: unknown[];
  table?: string;
  operation: BatchOperation;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

export interface QueueConfig {
  priorityQueues: boolean;
}

export class QueryQueue {
  private queue: BatchQuery[] = [];
  private config: QueueConfig;

  constructor(config: QueueConfig) {
    this.config = config;
  }

  /**
   * Add query to queue with priority ordering
   */
  add(query: BatchQuery): void {
    if (this.config.priorityQueues) {
      this.addWithPriority(query);
    } else {
      this.queue.push(query);
    }
  }

  /**
   * Insert query based on priority (high > medium > low)
   */
  private addWithPriority(query: BatchQuery): void {
    const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const newPriority = priorityOrder[query.priority] || 0;
    
    let insertIndex = this.queue.length;
    
    for (let i = 0; i < this.queue.length; i++) {
      const currentQuery = this.queue[i];
      if (!currentQuery) continue;
      const currentPriority = priorityOrder[currentQuery.priority] || 0;
      
      if (newPriority > currentPriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, query);
    logger().debug(`Query ${query.id} added at position ${insertIndex} with priority ${query.priority}`);
  }

  /**
   * Remove and return queries up to batch size
   */
  dequeue(batchSize: number): BatchQuery[] {
    return this.queue.splice(0, batchSize);
  }

  /**
   * Check if queue has high priority queries
   */
  hasHighPriority(): boolean {
    return this.queue.some(query => query.priority === 'high');
  }

  /**
   * Get current queue length
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get oldest query timestamp
   */
  getOldestTimestamp(): number {
    return this.queue.length > 0 && this.queue[0] ? this.queue[0].timestamp : Date.now();
  }

  /**
   * Clear all queries
   */
  clear(): void {
    this.queue = [];
    logger().debug('Queue cleared');
  }

  /**
   * Peek at queue without modifying
   */
  peek(): readonly BatchQuery[] {
    return this.queue;
  }
}
