/**
 * Scheduler Module
 * 
 * Provides comprehensive job scheduling capabilities:
 * - Job Scheduler: Background task scheduling and execution
 * - Multiple scheduling strategies (once, interval, cron, immediate)
 * - Job prioritization and concurrency control
 * - Retry strategies with backoff
 * - Job persistence and recovery
 * - Event-driven monitoring
 * 
 * @module services/scheduler
 * @author Backend Engineer
 */

// Types
export type {
  JobStatus,
  JobPriority,
  RetryStrategy,
  ScheduleType,
  JobExecutionContext,
  JobExecutionResult,
  JobHandler,
  RetryConfig,
  ScheduleConfig,
  JobConfig,
  RegisteredJob,
  SchedulerStats,
  SchedulerConfig,
  JobEvent,
  JobEventListener,
  CronParts,
} from './types';

// Enums and Constants
export {
  JobEventType,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_RETRY_CONFIG,
} from './types';

// Job Scheduler
export {
  JobScheduler,
  jobScheduler,
  scheduleJob,
  executeJobNow,
} from './jobScheduler';

// Import for use in functions
import { JobScheduler as JobSchedulerClass, jobScheduler as schedulerInstance } from './jobScheduler';
import type { SchedulerConfig, SchedulerStats } from './types';

/**
 * Initialize the scheduler
 */
export function initializeScheduler(config?: Partial<SchedulerConfig>): void {
  const scheduler = JobSchedulerClass.getInstance(config);
  scheduler.start();
}

/**
 * Get scheduler health status
 */
export function getSchedulerHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  stats: SchedulerStats;
} {
  const stats = schedulerInstance.getStats();
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (stats.failedJobs > (stats.totalExecutions - stats.failedJobs) || stats.successRate < 0.5) {
    status = 'unhealthy';
  } else if (stats.successRate < 0.9 || stats.runningJobs > stats.totalJobs * 0.5) {
    status = 'degraded';
  }
  
  return { status, stats };
}
