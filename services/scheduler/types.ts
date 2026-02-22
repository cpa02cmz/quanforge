/**
 * Scheduler Service Types
 * 
 * Type definitions for the job scheduling system including:
 * - Job configuration and scheduling options
 * - Cron expression types
 * - Job execution states and results
 * - Scheduler configuration
 * 
 * @module services/scheduler/types
 * @author Backend Engineer
 */

/**
 * Job status
 */
export type JobStatus = 
  | 'pending'      // Job is scheduled but not yet running
  | 'running'      // Job is currently executing
  | 'completed'    // Job finished successfully
  | 'failed'       // Job execution failed
  | 'cancelled'    // Job was cancelled before execution
  | 'paused';      // Job is paused (won't execute until resumed)

/**
 * Job priority levels
 */
export type JobPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

/**
 * Job retry strategy
 */
export type RetryStrategy = 'none' | 'fixed' | 'exponential' | 'linear';

/**
 * Schedule type
 */
export type ScheduleType = 
  | 'once'         // Run once at specified time
  | 'interval'     // Run at fixed intervals
  | 'cron'         // Run based on cron expression
  | 'immediate';   // Run immediately when scheduled

/**
 * Job execution context
 */
export interface JobExecutionContext {
  jobId: string;
  jobName: string;
  scheduledTime: number;
  actualStartTime: number;
  attemptNumber: number;
  metadata: Record<string, unknown>;
  signal?: AbortSignal;
}

/**
 * Job execution result
 */
export interface JobExecutionResult<T = unknown> {
  jobId: string;
  status: JobStatus;
  startTime: number;
  endTime: number;
  duration: number;
  result?: T;
  error?: Error;
  attemptNumber: number;
  nextRunTime?: number;
}

/**
 * Job handler function type
 */
export type JobHandler<R = unknown> = (
  context: JobExecutionContext
) => Promise<R> | R;

/**
 * Job retry configuration
 */
export interface RetryConfig {
  strategy: RetryStrategy;
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryOnErrors?: string[];
}

/**
 * Job schedule configuration
 */
export interface ScheduleConfig {
  type: ScheduleType;
  interval?: number;           // For 'interval' type (milliseconds)
  cronExpression?: string;     // For 'cron' type
  startDate?: number;          // Start time for the schedule
  endDate?: number;            // End time for the schedule
  timezone?: string;           // Timezone for cron expressions
  skipMissed?: boolean;        // Skip missed executions
  maxMissed?: number;          // Maximum missed executions to catch up
}

/**
 * Job configuration
 */
export interface JobConfig<T = unknown> {
  id: string;
  name: string;
  description?: string;
  handler: JobHandler<T>;
  schedule: ScheduleConfig;
  priority?: JobPriority;
  retry?: Partial<RetryConfig>;
  timeout?: number;            // Maximum execution time (ms)
  concurrency?: number;        // Max concurrent executions
  tags?: string[];
  metadata?: Record<string, unknown>;
  enabled?: boolean;
  createdBy?: string;
  created_at?: number;
  updated_at?: number;
}

/**
 * Registered job
 */
export interface RegisteredJob<T = unknown> {
  config: JobConfig<T>;
  status: JobStatus;
  lastExecution?: JobExecutionResult;
  nextExecutionTime?: number;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  lastStatusChange: number;
  createdAt: number;
}

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
  totalJobs: number;
  activeJobs: number;
  pausedJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  pendingJobs: number;
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  uptime: number;
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  maxConcurrentJobs: number;
  defaultTimeout: number;
  defaultRetryConfig: RetryConfig;
  pollInterval: number;
  enablePersistence: boolean;
  persistenceKey?: string;
  enableMetrics: boolean;
  metricsSampleRate: number;
}

/**
 * Job event types
 */
export enum JobEventType {
  JOB_REGISTERED = 'job_registered',
  JOB_UNREGISTERED = 'job_unregistered',
  JOB_STARTED = 'job_started',
  JOB_COMPLETED = 'job_completed',
  JOB_FAILED = 'job_failed',
  JOB_CANCELLED = 'job_cancelled',
  JOB_PAUSED = 'job_paused',
  JOB_RESUMED = 'job_resumed',
  JOB_RETRY = 'job_retry',
  JOB_TIMEOUT = 'job_timeout',
  SCHEDULER_STARTED = 'scheduler_started',
  SCHEDULER_STOPPED = 'scheduler_stopped',
  SCHEDULER_ERROR = 'scheduler_error',
}

/**
 * Job event
 */
export interface JobEvent {
  type: JobEventType;
  jobId: string;
  jobName: string;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Job event listener
 */
export type JobEventListener = (event: JobEvent) => void;

/**
 * Cron expression parts
 */
export interface CronParts {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxConcurrentJobs: 10,
  defaultTimeout: 30000, // 30 seconds
  defaultRetryConfig: {
    strategy: 'exponential',
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },
  pollInterval: 1000, // 1 second
  enablePersistence: true,
  persistenceKey: 'quanforge_job_scheduler',
  enableMetrics: true,
  metricsSampleRate: 0.1, // 10%
};

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  strategy: 'exponential',
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};
