/**
 * Job Scheduler Service
 * 
 * Comprehensive job scheduling system for background task management:
 * - Multiple scheduling strategies (once, interval, cron, immediate)
 * - Job prioritization and concurrency control
 * - Retry strategies with backoff
 * - Job persistence and recovery
 * - Event-driven monitoring
 * - Metrics collection
 * 
 * @module services/scheduler/jobScheduler
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../utils/logger';
import {
  JobStatus,
  JobPriority,
  JobConfig,
  JobExecutionContext,
  JobExecutionResult,
  JobEvent,
  JobEventType,
  JobEventListener,
  RegisteredJob,
  SchedulerStats,
  SchedulerConfig,
  RetryConfig,
  ScheduleConfig,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_RETRY_CONFIG,
  CronParts,
} from './types';

/**
 * Generate unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate next execution time based on schedule config
 */
function calculateNextExecution(schedule: ScheduleConfig, lastExecution?: number): number | undefined {
  const now = Date.now();
  
  switch (schedule.type) {
    case 'once':
      return schedule.startDate && schedule.startDate > now 
        ? schedule.startDate 
        : undefined;
    
    case 'interval':
      if (!schedule.interval) return undefined;
      {
        const base = lastExecution || now;
        let next = base + schedule.interval;
        
        // Handle end date
        if (schedule.endDate && next > schedule.endDate) {
          return undefined;
        }
        
        // Handle skip missed
        if (schedule.skipMissed && next < now) {
          next = now + schedule.interval;
        }
        
        return next;
      }
    
    case 'cron':
      if (!schedule.cronExpression) return undefined;
      return calculateNextCronExecution(schedule.cronExpression, now, schedule.timezone);
    
    case 'immediate':
      return now;
    
    default:
      return undefined;
  }
}

/**
 * Parse cron expression and get next execution time
 */
function calculateNextCronExecution(
  expression: string, 
  fromTime: number, 
  _timezone?: string
): number {
  const parts = parseCronExpression(expression);
  if (!parts) return fromTime;
  
  let current = new Date(fromTime);
  current.setSeconds(0);
  current.setMilliseconds(0);
  
  // Add one minute to start from next minute
  current.setMinutes(current.getMinutes() + 1);
  
  // Find next matching time (limit iterations to prevent infinite loop)
  for (let i = 0; i < 366 * 24 * 60; i++) { // Max 1 year of minutes
    if (matchesCronParts(current, parts)) {
      return current.getTime();
    }
    current.setMinutes(current.getMinutes() + 1);
  }
  
  return fromTime;
}

/**
 * Parse cron expression into parts
 */
function parseCronExpression(expression: string): CronParts | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  
  const parsePart = (part: string, min: number, max: number): number[] => {
    if (part === '*') {
      return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }
    
    const values: number[] = [];
    const ranges = part.split(',');
    
    for (const range of ranges) {
      let [start, end, step] = range.split(/[/\--]/);
      start = start || '*';
      end = end || start;
      step = step || '1';
      
      const startNum = start === '*' ? min : parseInt(start, 10);
      const endNum = end === '*' ? max : parseInt(end, 10);
      const stepNum = parseInt(step, 10) || 1;
      
      for (let i = startNum; i <= endNum; i += stepNum) {
        if (i >= min && i <= max) {
          values.push(i);
        }
      }
    }
    
    return [...new Set(values)].sort((a, b) => a - b);
  };
  
  return {
    minute: parsePart(parts[0], 0, 59),
    hour: parsePart(parts[1], 0, 23),
    dayOfMonth: parsePart(parts[2], 1, 31),
    month: parsePart(parts[3], 1, 12),
    dayOfWeek: parsePart(parts[4], 0, 6),
  };
}

/**
 * Check if date matches cron parts
 */
function matchesCronParts(date: Date, parts: CronParts): boolean {
  return (
    parts.minute.includes(date.getMinutes()) &&
    parts.hour.includes(date.getHours()) &&
    parts.dayOfMonth.includes(date.getDate()) &&
    parts.month.includes(date.getMonth() + 1) &&
    parts.dayOfWeek.includes(date.getDay())
  );
}

/**
 * Calculate retry delay based on strategy
 */
function calculateRetryDelay(
  strategy: string,
  attempt: number,
  config: RetryConfig
): number {
  switch (strategy) {
    case 'fixed':
      return config.initialDelay;
    
    case 'linear':
      return config.initialDelay * attempt;
    
    case 'exponential':
      {
        const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
        return Math.min(delay, config.maxDelay);
      }
    
    default:
      return 0;
  }
}

/**
 * Get priority weight for job ordering
 */
function getPriorityWeight(priority: JobPriority): number {
  const weights: Record<JobPriority, number> = {
    critical: 100,
    high: 75,
    normal: 50,
    low: 25,
    background: 10,
  };
  return weights[priority] || 50;
}

/**
 * Job Scheduler Service
 * 
 * Manages background job scheduling and execution
 */
export class JobScheduler {
  private static instance: JobScheduler | null = null;
  private logger = createScopedLogger('JobScheduler');
  private jobs: Map<string, RegisteredJob> = new Map();
  private runningJobs: Map<string, AbortController> = new Map();
  private timeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private eventListeners: Map<JobEventType, Set<JobEventListener>> = new Map();
  private config: SchedulerConfig;
  private started = false;
  private startTime = 0;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private executionQueue: string[] = [];

  private constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.loadPersistedJobs();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<SchedulerConfig>): JobScheduler {
    if (!JobScheduler.instance) {
      JobScheduler.instance = new JobScheduler(config);
    }
    return JobScheduler.instance;
  }

  /**
   * Register a new job
   */
  register<T = unknown>(config: JobConfig<T>): string {
    const jobId = config.id || generateJobId();
    
    if (this.jobs.has(jobId)) {
      this.logger.warn(`Job ${jobId} already exists, updating`, { jobId });
    }

    const job: RegisteredJob<T> = {
      config: {
        ...config,
        id: jobId,
        priority: config.priority || 'normal',
        timeout: config.timeout || this.config.defaultTimeout,
        retry: {
          ...this.config.defaultRetryConfig,
          ...config.retry,
        },
        enabled: config.enabled !== false,
        created_at: config.created_at || Date.now(),
        updated_at: Date.now(),
      },
      status: 'pending',
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      averageDuration: 0,
      lastStatusChange: Date.now(),
      createdAt: Date.now(),
    };

    // Calculate next execution time
    if (job.config.enabled) {
      job.nextExecutionTime = calculateNextExecution(config.schedule);
    }

    this.jobs.set(jobId, job);
    this.emitEvent({
      type: JobEventType.JOB_REGISTERED,
      jobId,
      jobName: config.name,
      timestamp: Date.now(),
      data: { config },
    });

    this.logger.log(`Job registered: ${config.name}`, { jobId, schedule: config.schedule.type });
    this.scheduleJobExecution(jobId);
    this.persistJobs();

    return jobId;
  }

  /**
   * Unregister a job
   */
  unregister(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.logger.warn(`Job ${jobId} not found`);
      return false;
    }

    // Cancel any scheduled execution
    this.clearJobTimers(jobId);

    // Cancel if running
    if (job.status === 'running') {
      this.cancelJob(jobId);
    }

    this.jobs.delete(jobId);
    
    this.emitEvent({
      type: JobEventType.JOB_UNREGISTERED,
      jobId,
      jobName: job.config.name,
      timestamp: Date.now(),
      data: {},
    });

    this.logger.log(`Job unregistered: ${job.config.name}`, { jobId });
    this.persistJobs();

    return true;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.started) {
      this.logger.warn('Scheduler already started');
      return;
    }

    this.started = true;
    this.startTime = Date.now();

    // Start poll interval for checking scheduled jobs
    this.pollInterval = setInterval(() => {
      this.checkScheduledJobs();
    }, this.config.pollInterval);

    this.emitEvent({
      type: JobEventType.SCHEDULER_STARTED,
      jobId: '',
      jobName: '',
      timestamp: Date.now(),
      data: { config: this.config },
    });

    this.logger.log('Scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;

    // Clear poll interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Cancel all running jobs
    for (const jobId of this.runningJobs.keys()) {
      this.cancelJob(jobId);
    }

    // Clear all scheduled timers
    for (const jobId of this.timeouts.keys()) {
      this.clearJobTimers(jobId);
    }

    this.emitEvent({
      type: JobEventType.SCHEDULER_STOPPED,
      jobId: '',
      jobName: '',
      timestamp: Date.now(),
      data: {},
    });

    this.logger.log('Scheduler stopped');
  }

  /**
   * Execute a job immediately
   */
  async executeNow<T = unknown>(jobId: string): Promise<JobExecutionResult<T>> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    return this.executeJob(jobId);
  }

  /**
   * Pause a job
   */
  pause(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'paused') return true;

    job.status = 'paused';
    job.lastStatusChange = Date.now();
    this.clearJobTimers(jobId);

    this.emitEvent({
      type: JobEventType.JOB_PAUSED,
      jobId,
      jobName: job.config.name,
      timestamp: Date.now(),
      data: {},
    });

    this.persistJobs();
    return true;
  }

  /**
   * Resume a paused job
   */
  resume(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status !== 'paused') return true;

    job.status = 'pending';
    job.lastStatusChange = Date.now();
    job.nextExecutionTime = calculateNextExecution(job.config.schedule);

    this.emitEvent({
      type: JobEventType.JOB_RESUMED,
      jobId,
      jobName: job.config.name,
      timestamp: Date.now(),
      data: {},
    });

    this.scheduleJobExecution(jobId);
    this.persistJobs();
    return true;
  }

  /**
   * Cancel a running job
   */
  cancelJob(jobId: string): boolean {
    const controller = this.runningJobs.get(jobId);
    if (!controller) return false;

    controller.abort();

    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'cancelled';
      job.lastStatusChange = Date.now();

      this.emitEvent({
        type: JobEventType.JOB_CANCELLED,
        jobId,
        jobName: job.config.name,
        timestamp: Date.now(),
        data: {},
      });
    }

    return true;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): RegisteredJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): RegisteredJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: JobStatus): RegisteredJob[] {
    return this.getAllJobs().filter(job => job.status === status);
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    const jobs = this.getAllJobs();
    const now = Date.now();

    const completedJobs = jobs.filter(j => j.status === 'completed');
    const failedJobs = jobs.filter(j => j.status === 'failed');
    const runningJobs = jobs.filter(j => j.status === 'running');
    const pendingJobs = jobs.filter(j => j.status === 'pending');
    const pausedJobs = jobs.filter(j => j.status === 'paused');

    const totalExecutions = jobs.reduce((sum, j) => sum + j.executionCount, 0);
    const totalSuccesses = jobs.reduce((sum, j) => sum + j.successCount, 0);
    const avgDurations = jobs.filter(j => j.averageDuration > 0);
    const averageDuration = avgDurations.length > 0
      ? avgDurations.reduce((sum, j) => sum + j.averageDuration, 0) / avgDurations.length
      : 0;

    return {
      totalJobs: jobs.length,
      activeJobs: pendingJobs.length + runningJobs.length,
      pausedJobs: pausedJobs.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      runningJobs: runningJobs.length,
      pendingJobs: pendingJobs.length,
      totalExecutions,
      successRate: totalExecutions > 0 ? totalSuccesses / totalExecutions : 0,
      averageExecutionTime: averageDuration,
      uptime: this.started ? now - this.startTime : 0,
    };
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: JobEventType, listener: JobEventListener): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);

    return () => {
      this.eventListeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Destroy the scheduler
   */
  destroy(): void {
    this.stop();
    this.jobs.clear();
    this.eventListeners.clear();
    JobScheduler.instance = null;
    this.logger.log('Scheduler destroyed');
  }

  // ============= Private Methods =============

  /**
   * Schedule job execution based on its configuration
   */
  private scheduleJobExecution(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || !job.config.enabled || job.status === 'paused') return;

    this.clearJobTimers(jobId);

    const nextRun = job.nextExecutionTime;
    if (!nextRun) return;

    const now = Date.now();
    const delay = Math.max(0, nextRun - now);

    const timeout = setTimeout(() => {
      this.executeJob(jobId);
    }, delay);

    this.timeouts.set(jobId, timeout);
  }

  /**
   * Check for jobs that need to be executed
   */
  private checkScheduledJobs(): void {
    if (!this.started) return;

    const now = Date.now();
    const runningCount = this.runningJobs.size;

    if (runningCount >= this.config.maxConcurrentJobs) {
      return;
    }

    // Get jobs that need execution, sorted by priority
    const jobsToRun = this.getAllJobs()
      .filter(job => 
        job.config.enabled &&
        job.status === 'pending' &&
        job.nextExecutionTime &&
        job.nextExecutionTime <= now &&
        !this.runningJobs.has(job.config.id)
      )
      .sort((a, b) => 
        getPriorityWeight(b.config.priority || 'normal') - 
        getPriorityWeight(a.config.priority || 'normal')
      );

    // Execute up to max concurrent
    const availableSlots = this.config.maxConcurrentJobs - runningCount;
    for (let i = 0; i < Math.min(jobsToRun.length, availableSlots); i++) {
      this.executeJob(jobsToRun[i].config.id);
    }
  }

  /**
   * Execute a job
   */
  private async executeJob<T = unknown>(jobId: string): Promise<JobExecutionResult<T>> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Check concurrency
    if (job.config.concurrency && this.runningJobs.size >= job.config.concurrency) {
      // Re-schedule for later
      job.nextExecutionTime = Date.now() + 1000;
      this.scheduleJobExecution(jobId);
      return this.createResult(jobId, 'pending', 0, 0);
    }

    // Create abort controller for this execution
    const controller = new AbortController();
    this.runningJobs.set(jobId, controller);

    // Update job status
    job.status = 'running';
    job.lastStatusChange = Date.now();
    const startTime = Date.now();

    this.emitEvent({
      type: JobEventType.JOB_STARTED,
      jobId,
      jobName: job.config.name,
      timestamp: startTime,
      data: {},
    });

    let attemptNumber = 1;
    let lastError: Error | undefined;
    const retryConfig: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...job.config.retry,
    };

    // Execute with retry logic
    while (attemptNumber <= retryConfig.maxAttempts) {
      try {
        // Set timeout
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, job.config.timeout || this.config.defaultTimeout);

        const context: JobExecutionContext = {
          jobId,
          jobName: job.config.name,
          scheduledTime: job.nextExecutionTime || startTime,
          actualStartTime: startTime,
          attemptNumber,
          metadata: job.config.metadata || {},
          signal: controller.signal,
        };

        const result = await Promise.race([
          job.config.handler(context),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error('Job timeout'));
            });
          }),
        ]);

        clearTimeout(timeoutId);

        // Success
        const endTime = Date.now();
        const duration = endTime - startTime;

        job.status = 'completed';
        job.lastStatusChange = endTime;
        job.executionCount++;
        job.successCount++;
        job.averageDuration = (job.averageDuration * (job.successCount - 1) + duration) / job.successCount;
        job.lastExecution = this.createResult(jobId, 'completed', startTime, endTime, result);
        job.nextExecutionTime = calculateNextExecution(job.config.schedule, startTime);

        this.runningJobs.delete(jobId);

        this.emitEvent({
          type: JobEventType.JOB_COMPLETED,
          jobId,
          jobName: job.config.name,
          timestamp: endTime,
          data: { result, duration },
        });

        // Schedule next execution
        if (job.nextExecutionTime && job.config.schedule.type !== 'once') {
          this.scheduleJobExecution(jobId);
        }

        this.persistJobs();
        return job.lastExecution as JobExecutionResult<T>;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attemptNumber < retryConfig.maxAttempts) {
          const delay = calculateRetryDelay(retryConfig.strategy, attemptNumber, retryConfig);
          
          this.emitEvent({
            type: JobEventType.JOB_RETRY,
            jobId,
            jobName: job.config.name,
            timestamp: Date.now(),
            data: { attemptNumber, delay, error: lastError.message },
          });

          await new Promise(resolve => setTimeout(resolve, delay));
          attemptNumber++;
        } else {
          break;
        }
      }
    }

    // All retries exhausted
    const endTime = Date.now();
    const duration = endTime - startTime;

    job.status = 'failed';
    job.lastStatusChange = endTime;
    job.executionCount++;
    job.failureCount++;
    job.averageDuration = (job.averageDuration * (job.executionCount - 1) + duration) / job.executionCount;
    job.lastExecution = this.createResult(jobId, 'failed', startTime, endTime, undefined, lastError);
    job.nextExecutionTime = calculateNextExecution(job.config.schedule, startTime);

    this.runningJobs.delete(jobId);

    this.emitEvent({
      type: JobEventType.JOB_FAILED,
      jobId,
      jobName: job.config.name,
      timestamp: endTime,
      data: { error: lastError?.message, attemptNumber },
    });

    // Schedule next execution for recurring jobs
    if (job.nextExecutionTime && job.config.schedule.type !== 'once') {
      this.scheduleJobExecution(jobId);
    }

    this.persistJobs();
    return job.lastExecution as JobExecutionResult<T>;
  }

  /**
   * Create execution result object
   */
  private createResult<T>(
    jobId: string,
    status: JobStatus,
    startTime: number,
    endTime: number,
    result?: T,
    error?: Error
  ): JobExecutionResult<T> {
    return {
      jobId,
      status,
      startTime,
      endTime,
      duration: endTime - startTime,
      result,
      error,
      attemptNumber: 1,
    };
  }

  /**
   * Clear all timers for a job
   */
  private clearJobTimers(jobId: string): void {
    const timeout = this.timeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(jobId);
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: JobEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          this.logger.error('Event listener error', { error, event });
        }
      }
    }
  }

  /**
   * Persist jobs to storage
   */
  private persistJobs(): void {
    if (!this.config.enablePersistence) return;

    try {
      const jobsData = Array.from(this.jobs.entries()).map(([id, job]) => ({
        id,
        config: {
          ...job.config,
          handler: undefined, // Don't persist handlers
        },
        status: job.status,
        executionCount: job.executionCount,
        successCount: job.successCount,
        failureCount: job.failureCount,
        averageDuration: job.averageDuration,
        nextExecutionTime: job.nextExecutionTime,
      }));

      localStorage.setItem(
        this.config.persistenceKey || 'job_scheduler',
        JSON.stringify(jobsData)
      );
    } catch (error) {
      this.logger.error('Failed to persist jobs', { error });
    }
  }

  /**
   * Load persisted jobs
   */
  private loadPersistedJobs(): void {
    if (!this.config.enablePersistence) return;

    try {
      const data = localStorage.getItem(this.config.persistenceKey || 'job_scheduler');
      if (data) {
        const jobsData = JSON.parse(data);
        for (const jobData of jobsData) {
          if (jobData.config.handler) {
            // Can't restore handlers, skip
            continue;
          }
          // Store metadata for re-registration
          this.logger.log(`Loaded persisted job: ${jobData.config.name}`, { id: jobData.id });
        }
      }
    } catch (error) {
      this.logger.error('Failed to load persisted jobs', { error });
    }
  }
}

// Singleton instance
export const jobScheduler = JobScheduler.getInstance();

/**
 * Convenience function to register a job
 */
export function scheduleJob<T = unknown>(config: JobConfig<T>): string {
  return jobScheduler.register(config);
}

/**
 * Convenience function to execute a job immediately
 */
export function executeJobNow<T = unknown>(jobId: string): Promise<JobExecutionResult<T>> {
  return jobScheduler.executeNow<T>(jobId);
}
