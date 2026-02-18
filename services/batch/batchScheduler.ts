/**
 * Batch Scheduler
 * Manages batch processing timers and scheduling logic
 */

import { createScopedLogger } from '../../utils/logger';
import { STAGGER } from '../constants';
import { createListenerManager } from '../../utils/listenerManager';

const logger = () => createScopedLogger('BatchScheduler');

export interface SchedulerConfig {
  batchTimeout: number;
  maxBatchSize: number;
  onProcessBatch: () => void | Promise<void>;
  shouldProcessImmediately: () => boolean;
}

export class BatchScheduler {
  private timer: number | null = null;
  private config: SchedulerConfig;
  private cleanupManager = createListenerManager();

  constructor(config: SchedulerConfig) {
    this.config = config;
    this.startPeriodicProcessor();
  }

  /**
   * Schedule a batch to be processed
   */
  schedule(): void {
    if (this.timer) {
      return; // Already scheduled
    }

    const shouldProcessNow = this.config.shouldProcessImmediately();
    const delay = shouldProcessNow ? 0 : this.config.batchTimeout;

    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.config.onProcessBatch();
    }, delay);

    logger().debug(`Batch scheduled in ${delay}ms`);
  }

  /**
   * Cancel pending batch
   */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      logger().debug('Pending batch cancelled');
    }
  }

  /**
   * Check if batch is currently scheduled
   */
  isScheduled(): boolean {
    return this.timer !== null;
  }

  /**
   * Force immediate processing
   */
  forceProcess(): void {
    this.cancel();
    void this.config.onProcessBatch();
  }

  /**
   * Start periodic processor for any remaining queries
   */
  private startPeriodicProcessor(): void {
    this.cleanupManager.setInterval(() => {
      void this.config.onProcessBatch();
    }, STAGGER.DEFAULT_DELAY_MS * 10);
  }

  /**
   * Clean up all timers and intervals
   */
  destroy(): void {
    this.cancel();
    this.cleanupManager.cleanup();
    logger().debug('BatchScheduler destroyed');
  }
}
