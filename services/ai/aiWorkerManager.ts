// AI Worker Management for Background Processing
import { createScopedLogger } from "../../utils/logger";
import { AI_CONFIG } from "../../constants/config";

const logger = createScopedLogger('ai-worker-manager');

export interface WorkerTask {
  id: string;
  type: 'generation' | 'analysis';
  data: unknown;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  abortSignal?: AbortSignal;
  timeout?: number;
}

export interface WorkerStatus {
  status: 'idle' | 'busy' | 'error';
  currentTask?: WorkerTask;
  totalTasksProcessed: number;
  failedTasks: number;
  lastError?: string;
}

export class AIWorkerManager {
  private worker: Worker | null = null;
  private taskQueue: WorkerTask[] = [];
  private currentTask: WorkerTask | null = null;
  private status: WorkerStatus = {
    status: 'idle',
    totalTasksProcessed: 0,
    failedTasks: 0
  };
  private workerReady = false;

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker(): Promise<void> {
    try {
      // Create worker dynamically to avoid bundling issues
      const workerUrl = new URL('../../workers/aiWorker.ts', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });
      
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      logger.info('AI Worker initialized');
      this.workerReady = true;
    } catch (error) {
      logger.error('Failed to initialize AI Worker:', error);
      this.status.status = 'error';
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  async executeTask<T>(
    type: 'generation' | 'analysis',
    data: unknown,
    signal?: AbortSignal,
    timeout: number = AI_CONFIG.RETRY.MAX_DELAY
  ): Promise<T> {
    if (!this.workerReady) {
      throw new Error('AI Worker not ready');
    }

    return new Promise<T>((resolve, reject) => {
      const taskId = this.generateTaskId();
      const task: WorkerTask = {
        id: taskId,
        type,
        data,
        resolve: resolve as (result: unknown) => void,
        reject,
        abortSignal: signal,
        timeout
      };

      // Setup abort signal handling
      if (signal) {
        const handleAbort = () => {
          this.cancelTask(taskId);
          reject(new DOMException('Task aborted', 'AbortError'));
        };
        signal.addEventListener('abort', handleAbort, { once: true });
      }

      // Setup timeout
      if (timeout > 0) {
        setTimeout(() => {
          this.cancelTask(taskId);
          reject(new Error('Task timeout'));
        }, timeout);
      }

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.currentTask || this.taskQueue.length === 0 || !this.workerReady) {
      return;
    }

    this.currentTask = this.taskQueue.shift()!;
    this.status.status = 'busy';
    this.status.currentTask = this.currentTask;

    try {
      this.worker!.postMessage({
        id: this.currentTask.id,
        type: this.currentTask.type,
        data: this.currentTask.data
      });
    } catch (error) {
      logger.error('Failed to send task to worker:', error);
      this.handleTaskError(error);
    }
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const { id, result, error } = event.data;

    if (!this.currentTask || this.currentTask.id !== id) {
      logger.warn('Received message for unknown task:', id);
      return;
    }

    if (error) {
      this.handleTaskError(new Error(error));
    } else {
      this.handleTaskSuccess(result);
    }
  }

  private handleWorkerError(event: ErrorEvent): void {
    const error = new Error(event.message);
    this.handleTaskError(error);
  }

  private handleTaskSuccess(result: unknown): void {
    if (!this.currentTask) return;

    const task = this.currentTask;
    this.currentTask = null;
    this.status.status = 'idle';
    this.status.currentTask = undefined;
    this.status.totalTasksProcessed++;

    task.resolve(result);
    this.processQueue();
  }

  private handleTaskError(error: Error): void {
    if (!this.currentTask) return;

    const task = this.currentTask;
    this.currentTask = null;
    this.status.status = 'error';
    this.status.currentTask = undefined;
    this.status.failedTasks++;
    this.status.lastError = error.message;

    task.reject(error);
    this.processQueue();
  }

  private cancelTask(taskId: string): void {
    // Remove from queue if not started
    const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
      return;
    }

    // If currently running, abort it
    if (this.currentTask && this.currentTask.id === taskId) {
      this.currentTask = null;
      this.status.status = 'idle';
      this.status.currentTask = undefined;
      this.processQueue();
    }
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Get current worker status
  getStatus(): WorkerStatus {
    return { ...this.status };
  }

  // Get queue length
  getQueueLength(): number {
    return this.taskQueue.length;
  }

  // Clear all pending tasks
  clearQueue(): void {
    // Reject all pending tasks
    this.taskQueue.forEach(task => {
      task.reject(new Error('Task cancelled by queue clear'));
    });
    this.taskQueue = [];
  }

  // Restart worker
  async restartWorker(): Promise<void> {
    logger.info('Restarting AI Worker...');
    
    // Clear current task and queue
    this.clearQueue();
    this.currentTask = null;
    this.status = {
      status: 'idle',
      totalTasksProcessed: 0,
      failedTasks: 0
    };

    // Terminate current worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Reinitialize worker
    this.workerReady = false;
    await this.initializeWorker();
  }

  // Check if worker is ready
  isReady(): boolean {
    return this.workerReady && this.status.status !== 'error';
  }

  // Get performance metrics
  getMetrics(): {
    successRate: number;
    totalTasks: number;
    failedTasks: number;
    queueLength: number;
    status: string;
  } {
    const total = this.status.totalTasksProcessed + this.status.failedTasks;
    return {
      successRate: total > 0 ? this.status.totalTasksProcessed / total : 1,
      totalTasks: total,
      failedTasks: this.status.failedTasks,
      queueLength: this.taskQueue.length,
      status: this.status.status
    };
  }

  // Cleanup
  destroy(): void {
    this.clearQueue();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.workerReady = false;
  }
}

// Export singleton instance
export const aiWorkerManager = new AIWorkerManager();