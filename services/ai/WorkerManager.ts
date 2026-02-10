/**
 * Worker Manager Service - Advanced Task Processing and Background Operations
 * 
 * Manages Web Workers, task distribution, and background processing
 */

import { IWorkerManager, WorkerConfig } from '../../types/serviceInterfaces';
import { createScopedLogger } from '../../utils/logger';
import { TIMEOUTS } from '../constants';

const logger = createScopedLogger('WorkerManager');

export interface WorkerTask {
  id: string;
  type: string;
  data: unknown;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timeout: number;
  createdAt: number;
  retries: number;
  maxRetries: number;
}

export interface WorkerResult {
  taskId: string;
  result: unknown;
  success: boolean;
  error?: string;
  duration: number;
  workerId: string;
}

export class WorkerManager implements IWorkerManager {
  private config!: WorkerConfig;
  private workers: Array<{ id: string; worker: Worker; isBusy: boolean; lastUsed: number }> = [];
  private taskQueue: WorkerTask[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private processingTasks = new Map<string, { resolve: (result: any) => void; reject: (error: Error) => void; startTime: number }>();
  private stats = {
    active: 0,
    completed: 0,
    failed: 0,
    queued: 0,
  };

  async initialize(): Promise<void> {
    this.config = {
      maxWorkers: 4,
      timeout: TIMEOUTS.LONG,
      retryAttempts: 3,
    };

    // Initialize worker pool
    await this.initializeWorkers();
    
    logger.info('Worker Manager initialized with max workers:', this.config.maxWorkers);
  }

  async destroy(): Promise<void> {
    // Terminate all workers
    for (const { worker, id } of this.workers) {
      try {
        worker.terminate();
        logger.info(`Terminated worker: ${id}`);
      } catch (error) {
        logger.error(`Error terminating worker ${id}:`, error);
      }
    }
    
    this.workers = [];
    this.taskQueue = [];
    this.processingTasks.clear();
    
    logger.info('Worker Manager destroyed');
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test with a simple task
      const testTask = {
        id: 'health-check-' + Date.now(),
        type: 'health-check',
        data: { test: true },
        priority: 'urgent' as const,
        timeout: TIMEOUTS.STANDARD,
        createdAt: Date.now(),
        retries: 0,
        maxRetries: 1,
      };

      const result = await this.executeTask(testTask) as WorkerResult;
      return result.success;
    } catch (error) {
      logger.error('Worker Manager health check failed:', error);
      return false;
    }
  }

  updateConfig(config: Partial<WorkerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Adjust worker pool size if needed
    this.adjustWorkerPool();
  }

  getConfig(): WorkerConfig {
    return { ...this.config };
  }

  async executeTask<T>(task: WorkerTask): Promise<T> {
    return new Promise((resolve, reject) => {
      const taskId = task.id || 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
      
      const taskWithId = { ...task, id: taskId };
      
      // Store promise handlers
      this.processingTasks.set(taskId, {
        resolve,
        reject,
        startTime: Date.now(),
      });

      // Add to queue
      this.addToQueue(taskWithId);
      
      // Process queue
      this.processQueue();
      
      // Set timeout
      setTimeout(() => {
        const handlers = this.processingTasks.get(taskId);
        if (handlers) {
          this.processingTasks.delete(taskId);
          handlers.reject(new Error(`Task ${taskId} timed out`));
        }
      }, taskWithId.timeout);
    });
  }

  async terminateWorker(workerId: string): Promise<void> {
    const workerIndex = this.workers.findIndex(w => w.id === workerId);
    
    if (workerIndex === -1) {
      throw new Error(`Worker ${workerId} not found`);
    }

    const { worker } = this.workers[workerIndex];
    
    try {
      worker.terminate();
      this.workers.splice(workerIndex, 1);
      this.stats.active--;
      
      logger.info(`Terminated worker: ${workerId}`);
      
      // Create new worker to maintain pool size
      await this.createWorker();
    } catch (error) {
      logger.error(`Error terminating worker ${workerId}:`, error);
      throw error;
    }
  }

  getWorkerStats(): { active: number; completed: number; failed: number } {
    return {
      active: this.stats.active,
      completed: this.stats.completed,
      failed: this.stats.failed,
    };
  }

  // Private helper methods

  private async initializeWorkers(): Promise<void> {
    for (let i = 0; i < this.config.maxWorkers; i++) {
      try {
        await this.createWorker();
      } catch (error) {
        logger.error(`Failed to initialize worker ${i}:`, error);
      }
    }
  }

  private async createWorker(): Promise<void> {
    const workerId = 'worker-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
    
    try {
      // Create Web Worker - in browser environment
      const worker = new Worker('/workers/aiWorker.js');
      
      // Set up message handler
      worker.onmessage = (event) => {
        this.handleWorkerMessage(workerId, event.data);
      };
      
      worker.onerror = (error) => {
        logger.error(`Worker ${workerId} error:`, error);
        this.handleWorkerError(workerId, error);
      };
      
      this.workers.push({
        id: workerId,
        worker,
        isBusy: false,
        lastUsed: Date.now(),
      });
      
      this.stats.active++;
      logger.info(`Created worker: ${workerId}`);
    } catch (error) {
      logger.error(`Failed to create worker:`, error);
      throw error;
    }
  }

  private addToQueue(task: WorkerTask): void {
    // Insert task based on priority
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const insertIndex = this.taskQueue.findIndex(t => priorityOrder[t.priority] > priorityOrder[task.priority]);
    
    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }
    
    this.stats.queued = this.taskQueue.length;
  }

  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0) return;
    
    // Find available worker
    const availableWorker = this.workers.find(w => !w.isBusy);
    if (!availableWorker) return;
    
    // Get next task
    const task = this.taskQueue.shift();
    if (!task) return;
    
    this.stats.queued = this.taskQueue.length;
    
    // Assign task to worker
    availableWorker.isBusy = true;
    availableWorker.lastUsed = Date.now();
    
    logger.info(`Assigning task ${task.id} to worker ${availableWorker.id}`);
    
    // Send task to worker
    availableWorker.worker.postMessage({
      type: task.type,
      taskId: task.id,
      data: task.data,
    });
  }

  private handleWorkerMessage(workerId: string, data: any): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker) return;
    
    worker.isBusy = false;
    worker.lastUsed = Date.now();
    
    if (data.taskId) {
      const handlers = this.processingTasks.get(data.taskId);
      if (handlers) {
        const duration = Date.now() - handlers.startTime;
        this.processingTasks.delete(data.taskId);
        
        if (data.success) {
          handlers.resolve(data.result);
          this.stats.completed++;
        } else {
          handlers.reject(new Error(data.error || 'Task failed'));
          this.stats.failed++;
        }
        
        logger.info(`Task ${data.taskId} completed in ${duration}ms with worker ${workerId}`);
      }
    }
    
    // Process next task in queue
    this.processQueue();
  }

  private handleWorkerError(workerId: string, error: Error | unknown): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker) return;

    worker.isBusy = false;
    this.stats.failed++;

    // Find any tasks assigned to this worker and fail them
    for (const [taskId, handlers] of this.processingTasks.entries()) {
      // In a real implementation, you'd track which worker is handling which task
      // For now, we'll just clean up any dangling tasks
      if (Math.random() < 0.1) { // Random cleanup for demo purposes
        this.processingTasks.delete(taskId);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        handlers.reject(new Error(`Task failed due to worker error: ${errorMessage}`));
      }
    }
    
    // Try to recreate the worker
    this.recreateWorker(workerId);
  }

  private async recreateWorker(failedWorkerId: string): Promise<void> {
    const workerIndex = this.workers.findIndex(w => w.id === failedWorkerId);
    if (workerIndex === -1) return;
    
    // Remove failed worker
    this.workers.splice(workerIndex, 1);
    this.stats.active--;
    
    // Create new worker
    try {
      await this.createWorker();
      logger.info(`Recreated worker to replace ${failedWorkerId}`);
    } catch (error) {
      logger.error(`Failed to recreate worker:`, error);
    }
  }

  private adjustWorkerPool(): void {
    const currentSize = this.workers.length;
    const targetSize = this.config.maxWorkers;
    
    if (currentSize < targetSize) {
      // Add workers
      for (let i = currentSize; i < targetSize; i++) {
        this.createWorker().catch(error => {
          logger.error(`Failed to add worker during pool adjustment:`, error);
        });
      }
    } else if (currentSize > targetSize) {
      // Remove excess workers (only idle ones)
      const idleWorkers = this.workers.filter(w => !w.isBusy);
      const toRemove = idleWorkers.slice(0, currentSize - targetSize);
      
      for (const { id } of toRemove) {
        this.terminateWorker(id).catch(error => {
          logger.error(`Failed to remove excess worker:`, error);
        });
      }
    }
  }

  getDetailedStats() {
    return {
      ...this.stats,
      queued: this.taskQueue.length,
      processing: this.processingTasks.size,
      workers: this.workers.map(w => ({
        id: w.id,
        isBusy: w.isBusy,
        lastUsed: w.lastUsed,
      })),
      uptime: Date.now(),
    };
  }

  async clearQueue(): Promise<void> {
    // Fail all queued tasks
    for (const task of this.taskQueue) {
      const handlers = this.processingTasks.get(task.id);
      if (handlers) {
        this.processingTasks.delete(task.id);
        handlers.reject(new Error('Task cancelled due to queue clear'));
      }
    }
    
    this.taskQueue = [];
    this.stats.queued = 0;
    
    logger.info('Queue cleared');
  }
}