/**
 * API Request Queue - Priority-based Request Queue for API Operations
 * 
 * This module provides a sophisticated request queue system that:
 * - Manages concurrent requests with configurable limits
 * - Supports priority-based execution (high, normal, low)
 * - Provides request throttling and backpressure handling
 * - Enables request cancellation and pausing
 * - Tracks queue statistics and health
 * 
 * Benefits:
 * - Prevents API overload by controlling concurrency
 * - Ensures critical requests are prioritized
 * - Provides graceful degradation under load
 * - Improves application responsiveness
 * 
 * @module services/api/apiRequestQueue
 * @since 2026-02-21
 * @author API Specialist Agent
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../../constants/config';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('APIRequestQueue');

// ============= Types =============

/**
 * Request priority levels
 */
export type RequestPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

/**
 * Request status in the queue
 */
export type RequestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Queue item representing a queued request
 */
export interface QueuedRequest<T = unknown> {
  /** Unique request ID */
  id: string;
  /** Request function to execute */
  executor: () => Promise<T>;
  /** Request priority */
  priority: RequestPriority;
  /** Current status */
  status: RequestStatus;
  /** Time when request was added to queue */
  enqueuedAt: number;
  /** Time when request started executing */
  startedAt?: number;
  /** Time when request completed */
  completedAt?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** AbortController for cancellation */
  abortController: AbortController;
  /** Request metadata */
  metadata?: Record<string, unknown>;
  /** Error if request failed */
  error?: Error;
  /** Result if request completed */
  result?: T;
}

/**
 * Queue configuration options
 */
export interface QueueConfig {
  /** Maximum concurrent requests */
  maxConcurrent: number;
  /** Maximum queue size */
  maxQueueSize: number;
  /** Default timeout for requests (ms) */
  defaultTimeout: number;
  /** Enable priority queue */
  enablePriority: boolean;
  /** Auto-start queue processing */
  autoStart: boolean;
  /** Pause when browser/tab is hidden */
  pauseOnHidden: boolean;
  /** Request retry count on queue failure */
  retryCount: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Total requests processed */
  totalProcessed: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Cancelled requests */
  cancelledRequests: number;
  /** Requests currently in queue */
  pendingCount: number;
  /** Requests currently running */
  runningCount: number;
  /** Average wait time in queue (ms) */
  averageWaitTime: number;
  /** Average execution time (ms) */
  averageExecutionTime: number;
  /** Peak queue size */
  peakQueueSize: number;
  /** Queue health status */
  health: 'healthy' | 'degraded' | 'overloaded';
}

/**
 * Queue event types
 */
export type QueueEvent = 
  | 'request_enqueued'
  | 'request_started'
  | 'request_completed'
  | 'request_failed'
  | 'request_cancelled'
  | 'queue_paused'
  | 'queue_resumed'
  | 'queue_cleared';

/**
 * Queue event handler
 */
export type QueueEventHandler = (event: QueueEvent, data?: unknown) => void;

// ============= Priority Values =============

const PRIORITY_VALUES: Record<RequestPriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
  background: 0,
};

// ============= Default Configuration =============

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 6, // Browser default connection limit per domain
  maxQueueSize: 100,
  defaultTimeout: 30000,
  enablePriority: true,
  autoStart: true,
  pauseOnHidden: true,
  retryCount: 1,
  retryDelay: 1000,
};

// ============= API Request Queue Class =============

/**
 * API Request Queue
 * 
 * A priority-based request queue that manages concurrent API requests
 * with throttling, cancellation, and graceful degradation support.
 */
export class APIRequestQueue {
  private config: QueueConfig;
  
  // Queue storage (separate queues per priority)
  private queues = new Map<RequestPriority, QueuedRequest[]>();
  
  // Currently running requests
  private running = new Map<string, QueuedRequest>();
  
  // Completed/failed requests history (for stats)
  private history: QueuedRequest[] = [];
  
  // Queue state
  private paused = false;
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  
  // Event handlers
  private eventHandlers = new Map<QueueEvent, Set<QueueEventHandler>>();
  
  // Statistics
  private stats = {
    totalProcessed: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cancelledRequests: 0,
    totalWaitTime: 0,
    totalExecutionTime: 0,
    peakQueueSize: 0,
  };
  
  // Request ID counter
  private requestCounter = 0;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize priority queues
    for (const priority of Object.keys(PRIORITY_VALUES) as RequestPriority[]) {
      this.queues.set(priority, []);
    }
    
    // Start processing if auto-start enabled
    if (this.config.autoStart) {
      this.start();
    }
    
    // Handle visibility change for pausing
    if (this.config.pauseOnHidden && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiRequestQueue', {
        cleanup: () => this.destroy(),
        priority: 'high',
        description: 'API request queue service',
      });
    }
    
    logger.info('API Request Queue initialized', { config: this.config });
  }

  // ============= Public Methods =============

  /**
   * Enqueue a request for execution
   */
  async enqueue<T = unknown>(
    executor: () => Promise<T>,
    options: {
      priority?: RequestPriority;
      timeout?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const priority = options.priority || 'normal';
      const queue = this.queues.get(priority);
      
      if (!queue) {
        reject(new Error(`Invalid priority: ${priority}`));
        return;
      }
      
      // Check queue capacity
      const currentSize = this.getTotalQueueSize();
      if (currentSize >= this.config.maxQueueSize) {
        // Try to evict lowest priority items
        if (!this.evictLowPriorityItems()) {
          reject(new Error('Queue is full'));
          return;
        }
      }
      
      const request: QueuedRequest<T> = {
        id: this.generateRequestId(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        executor: executor as () => Promise<any>,
        priority,
        status: 'pending',
        enqueuedAt: Date.now(),
        timeout: options.timeout ?? this.config.defaultTimeout,
        abortController: new AbortController(),
        metadata: options.metadata,
      };
      
      queue.push(request);
      
      // Update peak queue size
      const newSize = this.getTotalQueueSize();
      if (newSize > this.stats.peakQueueSize) {
        this.stats.peakQueueSize = newSize;
      }
      
      this.emit('request_enqueued', { request });
      logger.debug(`Request enqueued: ${request.id} (priority: ${priority})`);
      
      // Trigger processing
      this.processQueue();
      
      // Handle completion with proper cleanup
      const pollInterval = setInterval(() => {
        if (request.status !== 'pending' && request.status !== 'running') {
          clearInterval(pollInterval);
          if (request.status === 'completed') {
            resolve(request.result as T);
          } else if (request.status === 'failed') {
            reject(request.error);
          } else if (request.status === 'cancelled') {
            reject(new Error('Request cancelled'));
          }
        }
      }, 10);
      
      // Clean up interval on abort
      request.abortController.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        if (request.status === 'pending' || request.status === 'running') {
          request.status = 'cancelled';
          reject(new Error('Request cancelled'));
        }
      });
    });
  }

  /**
   * Cancel a specific request by ID
   */
  cancel(requestId: string): boolean {
    // Check running requests first
    const running = this.running.get(requestId);
    if (running) {
      running.abortController.abort();
      running.status = 'cancelled';
      this.running.delete(requestId);
      this.stats.cancelledRequests++;
      this.emit('request_cancelled', { request: running });
      return true;
    }
    
    // Check queued requests
    for (const queue of this.queues.values()) {
      const index = queue.findIndex(r => r.id === requestId);
      if (index !== -1) {
        const request = queue.splice(index, 1)[0];
        request.status = 'cancelled';
        this.stats.cancelledRequests++;
        this.emit('request_cancelled', { request });
        return true;
      }
    }
    
    return false;
  }

  /**
   * Cancel all requests (running and queued)
   */
  cancelAll(): number {
    let count = 0;
    
    // Cancel running requests
    for (const request of this.running.values()) {
      request.abortController.abort();
      request.status = 'cancelled';
      count++;
    }
    this.running.clear();
    
    // Cancel queued requests
    for (const queue of this.queues.values()) {
      for (const request of queue) {
        request.status = 'cancelled';
        count++;
      }
      queue.length = 0;
    }
    
    this.stats.cancelledRequests += count;
    this.emit('queue_cleared', { count });
    logger.info(`Cancelled ${count} requests`);
    
    return count;
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.paused = true;
    this.emit('queue_paused');
    logger.info('Queue processing paused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.paused = false;
    this.emit('queue_resumed');
    this.processQueue();
    logger.info('Queue processing resumed');
  }

  /**
   * Check if queue is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.getTotalQueueSize();
  }

  /**
   * Get count of running requests
   */
  getRunningCount(): number {
    return this.running.size;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const avgWaitTime = this.stats.totalProcessed > 0
      ? this.stats.totalWaitTime / this.stats.totalProcessed
      : 0;
    
    const avgExecutionTime = this.stats.successfulRequests > 0
      ? this.stats.totalExecutionTime / this.stats.successfulRequests
      : 0;
    
    // Determine health status
    const queueSize = this.getTotalQueueSize();
    const load = (queueSize + this.running.size) / this.config.maxQueueSize;
    
    let health: 'healthy' | 'degraded' | 'overloaded';
    if (load < 0.5) {
      health = 'healthy';
    } else if (load < 0.8) {
      health = 'degraded';
    } else {
      health = 'overloaded';
    }
    
    return {
      totalProcessed: this.stats.totalProcessed,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      cancelledRequests: this.stats.cancelledRequests,
      pendingCount: this.getTotalQueueSize(),
      runningCount: this.running.size,
      averageWaitTime: avgWaitTime,
      averageExecutionTime: avgExecutionTime,
      peakQueueSize: this.stats.peakQueueSize,
      health,
    };
  }

  /**
   * Subscribe to queue events
   */
  on(event: QueueEvent, handler: QueueEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Update queue configuration
   */
  updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Queue config updated', config);
  }

  /**
   * Start queue processing
   */
  start(): void {
    if (this.processingInterval) return;
    
    this.processingInterval = setInterval(() => this.processQueue(), 50);
    this.processQueue();
    logger.info('Queue processing started');
  }

  /**
   * Stop queue processing
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    logger.info('Queue processing stopped');
  }

  /**
   * Clear queue and history
   */
  clear(): void {
    this.cancelAll();
    this.history = [];
    this.resetStats();
    logger.info('Queue cleared');
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cancelledRequests: 0,
      totalWaitTime: 0,
      totalExecutionTime: 0,
      peakQueueSize: 0,
    };
  }

  /**
   * Destroy the queue
   */
  destroy(): void {
    this.stop();
    this.cancelAll();
    
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    
    this.eventHandlers.clear();
    logger.info('API Request Queue destroyed');
  }

  // ============= Private Methods =============

  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  private getTotalQueueSize(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  private processQueue(): void {
    if (this.paused) return;
    
    // Process while we have capacity and pending requests
    while (this.running.size < this.config.maxConcurrent && this.hasPendingRequests()) {
      const request = this.getNextRequest();
      if (request) {
        this.executeRequest(request);
      }
    }
  }

  private hasPendingRequests(): boolean {
    for (const queue of this.queues.values()) {
      if (queue.length > 0) return true;
    }
    return false;
  }

  private getNextRequest(): QueuedRequest | null {
    if (!this.config.enablePriority) {
      // Simple FIFO: find first non-empty queue
      for (const queue of this.queues.values()) {
        if (queue.length > 0) {
          return queue.shift()!;
        }
      }
      return null;
    }
    
    // Priority-based: get from highest priority queue first
    const priorities = Object.entries(PRIORITY_VALUES)
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p as RequestPriority);
    
    for (const priority of priorities) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue.shift()!;
      }
    }
    
    return null;
  }

  private async executeRequest(request: QueuedRequest): Promise<void> {
    request.status = 'running';
    request.startedAt = Date.now();
    this.running.set(request.id, request);
    
    // Track wait time
    const waitTime = request.startedAt - request.enqueuedAt;
    this.stats.totalWaitTime += waitTime;
    
    this.emit('request_started', { request, waitTime });
    logger.debug(`Executing request: ${request.id}`);
    
    // Set up timeout
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (request.timeout) {
      timeoutId = setTimeout(() => {
        request.abortController.abort();
      }, request.timeout);
    }
    
    try {
      // Execute the request
      const result = await request.executor();
      
      // Clean up timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      // Handle success
      request.result = result;
      request.status = 'completed';
      request.completedAt = Date.now();
      
      const executionTime = request.completedAt - (request.startedAt || request.completedAt);
      this.stats.totalExecutionTime += executionTime;
      
      this.stats.totalProcessed++;
      this.stats.successfulRequests++;
      
      this.emit('request_completed', { request, result, executionTime });
      
    } catch (error: unknown) {
      // Clean up timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      // Handle failure
      request.error = error instanceof Error ? error : new Error(String(error));
      request.status = 'failed';
      request.completedAt = Date.now();
      
      this.stats.totalProcessed++;
      this.stats.failedRequests++;
      
      this.emit('request_failed', { request, error: request.error });
      logger.error(`Request failed: ${request.id}`, request.error);
      
    } finally {
      this.running.delete(request.id);
      
      // Add to history (limited size)
      this.history.push(request);
      if (this.history.length > 100) {
        this.history.shift();
      }
      
      // Continue processing
      this.processQueue();
    }
  }

  private evictLowPriorityItems(): boolean {
    // Try to remove lowest priority items first
    const priorities = Object.entries(PRIORITY_VALUES)
      .sort((a, b) => a[1] - b[1])
      .map(([p]) => p as RequestPriority);
    
    for (const priority of priorities) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        const evicted = queue.pop();
        if (evicted) {
          evicted.status = 'cancelled';
          this.stats.cancelledRequests++;
          this.emit('request_cancelled', { request: evicted, reason: 'evicted' });
          logger.debug(`Evicted request: ${evicted.id} (priority: ${priority})`);
          return true;
        }
      }
    }
    
    return false;
  }

  private emit(event: QueueEvent, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event, data);
        } catch (error) {
          logger.error(`Error in event handler for ${event}`, error);
        }
      }
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.pause();
    } else {
      this.resume();
    }
  };
}

// ============= Singleton Instance =============

let queueInstance: APIRequestQueue | null = null;

/**
 * Get the API request queue instance
 */
export const getAPIRequestQueue = (config?: Partial<QueueConfig>): APIRequestQueue => {
  if (!queueInstance) {
    queueInstance = new APIRequestQueue(config);
  }
  return queueInstance;
};

/**
 * Initialize the API request queue with custom config
 */
export const initializeAPIRequestQueue = (config: Partial<QueueConfig>): APIRequestQueue => {
  if (queueInstance) {
    queueInstance.destroy();
  }
  queueInstance = new APIRequestQueue(config);
  return queueInstance;
};

/**
 * Check if request queue is initialized
 */
export const hasAPIRequestQueue = (): boolean => {
  return queueInstance !== null;
};

// ============= Convenience Functions =============

/**
 * Enqueue a request with default settings
 */
export const queueRequest = <T = unknown>(
  executor: () => Promise<T>,
  options?: {
    priority?: RequestPriority;
    timeout?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<T> => getAPIRequestQueue().enqueue(executor, options);

/**
 * Enqueue a high priority request
 */
export const queueHighPriority = <T = unknown>(
  executor: () => Promise<T>,
  timeout?: number
): Promise<T> => getAPIRequestQueue().enqueue(executor, { priority: 'high', timeout });

/**
 * Enqueue a low priority request
 */
export const queueLowPriority = <T = unknown>(
  executor: () => Promise<T>,
  timeout?: number
): Promise<T> => getAPIRequestQueue().enqueue(executor, { priority: 'low', timeout });

/**
 * Enqueue a background request
 */
export const queueBackground = <T = unknown>(
  executor: () => Promise<T>,
  timeout?: number
): Promise<T> => getAPIRequestQueue().enqueue(executor, { priority: 'background', timeout });

// ============= React Hook =============

/**
 * React hook for using the API request queue
 */
export const useAPIRequestQueue = () => {
  const queue = getAPIRequestQueue();
  
  return {
    enqueue: <T = unknown>(
      executor: () => Promise<T>,
      options?: {
        priority?: RequestPriority;
        timeout?: number;
        metadata?: Record<string, unknown>;
      }
    ) => queue.enqueue(executor, options),
    
    cancel: (requestId: string) => queue.cancel(requestId),
    cancelAll: () => queue.cancelAll(),
    
    pause: () => queue.pause(),
    resume: () => queue.resume(),
    isPaused: () => queue.isPaused(),
    
    getQueueSize: () => queue.getQueueSize(),
    getRunningCount: () => queue.getRunningCount(),
    getStats: () => queue.getStats(),
    
    on: (event: QueueEvent, handler: QueueEventHandler) => queue.on(event, handler),
    
    highPriority: <T = unknown>(executor: () => Promise<T>, timeout?: number) =>
      queueHighPriority(executor, timeout),
    lowPriority: <T = unknown>(executor: () => Promise<T>, timeout?: number) =>
      queueLowPriority(executor, timeout),
    background: <T = unknown>(executor: () => Promise<T>, timeout?: number) =>
      queueBackground(executor, timeout),
  };
};
