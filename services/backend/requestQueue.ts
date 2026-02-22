/**
 * Backend Request Queue Manager
 * 
 * Provides request queuing with:
 * - Priority-based queue processing
 * - Request deduplication
 * - Queue overflow handling
 * - Batch processing support
 * - Queue statistics and monitoring
 * 
 * @module services/backend/requestQueue
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('RequestQueue');

/**
 * Queue item priority
 */
export type QueuePriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Queue item status
 */
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';

/**
 * Queue item interface
 */
export interface QueueItem<T = unknown, R = unknown> {
  id: string;
  serviceName: string;
  operation: string;
  payload: T;
  priority: QueuePriority;
  status: QueueStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: R;
  error?: Error;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  metadata?: Record<string, unknown>;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  serviceName: string;
  maxConcurrent: number;
  maxSize: number;
  defaultTimeout: number;
  defaultRetries: number;
  processingInterval: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  serviceName: string;
  totalItems: number;
  pendingItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  throughput: number; // items per second
}

/**
 * Queue options for adding items
 */
export interface QueueOptions {
  priority?: QueuePriority;
  timeout?: number;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
  deduplicationKey?: string;
}

/**
 * Default queue configurations
 */
export const DEFAULT_QUEUE_CONFIGS: Record<string, QueueConfig> = {
  database: {
    serviceName: 'database',
    maxConcurrent: 10,
    maxSize: 1000,
    defaultTimeout: 30000,
    defaultRetries: 3,
    processingInterval: 50,
  },
  ai_service: {
    serviceName: 'ai_service',
    maxConcurrent: 5,
    maxSize: 100,
    defaultTimeout: 60000,
    defaultRetries: 2,
    processingInterval: 100,
  },
  cache: {
    serviceName: 'cache',
    maxConcurrent: 20,
    maxSize: 2000,
    defaultTimeout: 5000,
    defaultRetries: 1,
    processingInterval: 25,
  },
  market_data: {
    serviceName: 'market_data',
    maxConcurrent: 10,
    maxSize: 500,
    defaultTimeout: 10000,
    defaultRetries: 2,
    processingInterval: 50,
  },
  default: {
    serviceName: 'default',
    maxConcurrent: 5,
    maxSize: 200,
    defaultTimeout: 30000,
    defaultRetries: 2,
    processingInterval: 100,
  },
};

/**
 * Priority order mapping
 */
const PRIORITY_ORDER: Record<QueuePriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/**
 * Backend Request Queue Manager
 * 
 * Singleton class that manages request queues for backend services.
 */
export class RequestQueueManager {
  private static instance: RequestQueueManager | null = null;
  
  private queues: Map<string, QueueItem[]> = new Map();
  private configs: Map<string, QueueConfig> = new Map();
  private deduplicationCache: Map<string, { id: string; timestamp: number }> = new Map();
  private processingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private processors: Map<string, (item: QueueItem) => Promise<unknown>> = new Map();
  
  private stats: Map<string, {
    waitTimes: number[];
    processingTimes: number[];
    completedCount: number;
    failedCount: number;
    lastReset: number;
  }> = new Map();

  private deduplicationTTL: number = 60000; // 1 minute

  private constructor() {
    this.initializeDefaultConfigs();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): RequestQueueManager {
    if (!RequestQueueManager.instance) {
      RequestQueueManager.instance = new RequestQueueManager();
    }
    return RequestQueueManager.instance;
  }

  /**
   * Configure a queue for a service
   */
  configureQueue(config: QueueConfig): void {
    this.configs.set(config.serviceName, config);
    
    if (!this.queues.has(config.serviceName)) {
      this.queues.set(config.serviceName, []);
    }

    this.stats.set(config.serviceName, {
      waitTimes: [],
      processingTimes: [],
      completedCount: 0,
      failedCount: 0,
      lastReset: Date.now(),
    });

    logger.log(`Queue configured for ${config.serviceName}: max=${config.maxSize}, concurrent=${config.maxConcurrent}`);
  }

  /**
   * Register a processor for a service
   */
  registerProcessor<T, R>(
    serviceName: string,
    processor: (item: QueueItem<T>) => Promise<R>
  ): void {
    this.processors.set(serviceName, processor as (item: QueueItem) => Promise<unknown>);
    this.startProcessing(serviceName);
    logger.log(`Processor registered for ${serviceName}`);
  }

  /**
   * Add an item to the queue
   */
  async enqueue<T, R>(
    serviceName: string,
    operation: string,
    payload: T,
    options: QueueOptions = {}
  ): Promise<string> {
    const config = this.configs.get(serviceName) ?? DEFAULT_QUEUE_CONFIGS['default']!;
    const queue = this.queues.get(serviceName) || [];

    // Check queue size
    if (queue.length >= config.maxSize) {
      throw new Error(`Queue overflow for ${serviceName}: max size ${config.maxSize} reached`);
    }

    // Check deduplication
    if (options.deduplicationKey) {
      const dedupeKey = `${serviceName}:${options.deduplicationKey}`;
      const cached = this.deduplicationCache.get(dedupeKey);
      
      if (cached && Date.now() - cached.timestamp < this.deduplicationTTL) {
        logger.debug(`Deduplicated request for ${serviceName}: ${options.deduplicationKey}`);
        return cached.id;
      }
    }

    const item: QueueItem<T, R> = {
      id: this.generateId(),
      serviceName,
      operation,
      payload,
      priority: options.priority || 'normal',
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? config.defaultRetries,
      timeout: options.timeout ?? config.defaultTimeout,
      metadata: options.metadata,
    };

    // Insert in priority order
    this.insertByPriority(queue, item);
    this.queues.set(serviceName, queue);

    // Update deduplication cache
    if (options.deduplicationKey) {
      const dedupeKey = `${serviceName}:${options.deduplicationKey}`;
      this.deduplicationCache.set(dedupeKey, { id: item.id, timestamp: Date.now() });
    }

    logger.debug(`Enqueued ${item.id} for ${serviceName}:${operation}`);
    return item.id;
  }

  /**
   * Get item status
   */
  getItem<T = unknown, R = unknown>(serviceName: string, itemId: string): QueueItem<T, R> | null {
    const queue = this.queues.get(serviceName);
    if (!queue) {
      return null;
    }

    return queue.find(item => item.id === itemId) as QueueItem<T, R> | null;
  }

  /**
   * Wait for item completion
   */
  async waitForCompletion<T = unknown, R = unknown>(
    serviceName: string,
    itemId: string,
    timeout?: number
  ): Promise<QueueItem<T, R>> {
    const startTime = Date.now();
    const maxWait = timeout || 60000; // Default 1 minute

    while (Date.now() - startTime < maxWait) {
      const item = this.getItem<T, R>(serviceName, itemId);
      
      if (!item) {
        throw new Error(`Item ${itemId} not found in ${serviceName} queue`);
      }

      if (item.status === 'completed') {
        return item;
      }

      if (item.status === 'failed' || item.status === 'timeout') {
        throw item.error || new Error(`Item ${itemId} failed`);
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    throw new Error(`Timeout waiting for item ${itemId}`);
  }

  /**
   * Enqueue and wait for result
   */
  async enqueueAndWait<T, R>(
    serviceName: string,
    operation: string,
    payload: T,
    options: QueueOptions = {}
  ): Promise<R> {
    const itemId = await this.enqueue<T, R>(serviceName, operation, payload, options);
    const item = await this.waitForCompletion<T, R>(serviceName, itemId, options.timeout);
    return item.result!;
  }

  /**
   * Get queue statistics
   */
  getStats(serviceName: string): QueueStats {
    const queue = this.queues.get(serviceName) || [];
    const stats = this.stats.get(serviceName);

    const pendingItems = queue.filter(i => i.status === 'pending').length;
    const processingItems = queue.filter(i => i.status === 'processing').length;
    const completedItems = stats?.completedCount || 0;
    const failedItems = stats?.failedCount || 0;

    const waitTimes = stats?.waitTimes || [];
    const processingTimes = stats?.processingTimes || [];

    const averageWaitTime = waitTimes.length > 0
      ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
      : 0;

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

    const timeSinceReset = stats ? (Date.now() - stats.lastReset) / 1000 : 0;
    const throughput = timeSinceReset > 0 ? completedItems / timeSinceReset : 0;

    return {
      serviceName,
      totalItems: queue.length + completedItems + failedItems,
      pendingItems,
      processingItems,
      completedItems,
      failedItems,
      averageWaitTime,
      averageProcessingTime,
      throughput,
    };
  }

  /**
   * Get all queue statistics
   */
  getAllStats(): QueueStats[] {
    const stats: QueueStats[] = [];
    
    for (const serviceName of this.queues.keys()) {
      stats.push(this.getStats(serviceName));
    }

    return stats;
  }

  /**
   * Clear queue for a service
   */
  clearQueue(serviceName: string): number {
    const queue = this.queues.get(serviceName);
    if (!queue) {
      return 0;
    }

    const count = queue.length;
    queue.length = 0;
    
    logger.log(`Cleared ${count} items from ${serviceName} queue`);
    return count;
  }

  /**
   * Remove completed items from queue
   */
  cleanup(serviceName: string): number {
    const queue = this.queues.get(serviceName);
    if (!queue) {
      return 0;
    }

    const initialLength = queue.length;
    const filtered = queue.filter(item => 
      item.status !== 'completed' && 
      item.status !== 'failed' && 
      item.status !== 'timeout'
    );
    
    this.queues.set(serviceName, filtered);
    
    const removed = initialLength - filtered.length;
    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} completed items from ${serviceName} queue`);
    }
    
    return removed;
  }

  // Private methods

  private initializeDefaultConfigs(): void {
    for (const [_serviceName, config] of Object.entries(DEFAULT_QUEUE_CONFIGS)) {
      this.configureQueue(config);
    }
  }

  private generateId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private insertByPriority(queue: QueueItem[], item: QueueItem): void {
    const priority = PRIORITY_ORDER[item.priority];
    
    let insertIndex = queue.length;
    for (let i = 0; i < queue.length; i++) {
      const queueItem = queue[i];
      if (queueItem) {
        const queueItemPriority = PRIORITY_ORDER[queueItem.priority];
        if (queueItemPriority > priority) {
          insertIndex = i;
          break;
        }
      }
    }
    
    queue.splice(insertIndex, 0, item);
  }

  private startProcessing(serviceName: string): void {
    if (this.processingIntervals.has(serviceName)) {
      return;
    }

    const config = this.configs.get(serviceName) ?? DEFAULT_QUEUE_CONFIGS['default']!;
    
    const interval = setInterval(() => {
      this.processNext(serviceName);
    }, config.processingInterval);

    this.processingIntervals.set(serviceName, interval);
    logger.log(`Started processing for ${serviceName}`);
  }

  private stopProcessing(serviceName: string): void {
    const interval = this.processingIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.processingIntervals.delete(serviceName);
      logger.log(`Stopped processing for ${serviceName}`);
    }
  }

  private async processNext(serviceName: string): Promise<void> {
    const queue = this.queues.get(serviceName);
    const config = this.configs.get(serviceName);
    const processor = this.processors.get(serviceName);

    if (!queue || !config || !processor) {
      return;
    }

    // Check concurrent limit
    const processingCount = queue.filter(i => i.status === 'processing').length;
    if (processingCount >= config.maxConcurrent) {
      return;
    }

    // Get next pending item
    const item = queue.find(i => i.status === 'pending');
    if (!item) {
      return;
    }

    // Start processing
    item.status = 'processing';
    item.startedAt = Date.now();

    const waitTime = item.startedAt - item.createdAt;
    const stats = this.stats.get(serviceName);
    if (stats) {
      stats.waitTimes.push(waitTime);
      if (stats.waitTimes.length > 1000) {
        stats.waitTimes.shift();
      }
    }

    try {
      // Set timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Processing timeout')), item.timeout);
      });

      // Process with timeout
      const result = await Promise.race([
        processor(item),
        timeoutPromise,
      ]);

      item.result = result;
      item.status = 'completed';
      item.completedAt = Date.now();

      if (stats) {
        const processingTime = item.completedAt - item.startedAt;
        stats.processingTimes.push(processingTime);
        stats.completedCount++;
        
        if (stats.processingTimes.length > 1000) {
          stats.processingTimes.shift();
        }
      }

    } catch (error) {
      item.error = error instanceof Error ? error : new Error(String(error));
      item.retryCount++;

      if (item.retryCount < item.maxRetries) {
        item.status = 'pending';
        item.startedAt = undefined;
        logger.warn(`Retrying ${item.id} (${item.retryCount}/${item.maxRetries})`);
      } else {
        item.status = 'failed';
        item.completedAt = Date.now();
        
        if (stats) {
          stats.failedCount++;
        }
        
        logger.error(`Item ${item.id} failed after ${item.maxRetries} retries:`, error);
      }
    }
  }

  /**
   * Cleanup and destroy the queue manager
   */
  destroy(): void {
    // Stop all processing
    for (const serviceName of this.processingIntervals.keys()) {
      this.stopProcessing(serviceName);
    }

    // Clear all queues
    this.queues.clear();
    this.configs.clear();
    this.processors.clear();
    this.deduplicationCache.clear();
    this.stats.clear();

    RequestQueueManager.instance = null;
    logger.log('Request queue manager destroyed');
  }
}

// Export singleton instance
export const requestQueueManager = RequestQueueManager.getInstance();

/**
 * Helper function to enqueue a request
 */
export function enqueue<T, R>(
  serviceName: string,
  operation: string,
  payload: T,
  options?: QueueOptions
): Promise<string> {
  return requestQueueManager.enqueue<T, R>(serviceName, operation, payload, options);
}

/**
 * Helper function to enqueue and wait for result
 */
export async function enqueueAndWait<T, R>(
  serviceName: string,
  operation: string,
  payload: T,
  options?: QueueOptions
): Promise<R> {
  return requestQueueManager.enqueueAndWait<T, R>(serviceName, operation, payload, options);
}
