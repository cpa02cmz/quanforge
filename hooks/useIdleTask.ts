/**
 * useIdleTask Hook
 * 
 * A performance optimization hook for scheduling tasks during browser idle time.
 * Useful for non-critical operations like analytics, prefetching, and background
 * computations that can be deferred.
 * 
 * Features:
 * - Schedule tasks during browser idle time
 * - Priority-based task scheduling
 * - Task cancellation and cleanup
 * - Automatic cleanup on unmount
 * - Fallback for browsers without requestIdleCallback
 * 
 * @module hooks/useIdleTask
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ========== TYPES ==========

export type TaskPriority = 'high' | 'normal' | 'low' | 'background';

export interface IdleTask {
  /** Unique task identifier */
  id: string;
  /** Task function to execute */
  execute: () => void | Promise<void>;
  /** Task priority (higher priority tasks run first) */
  priority: TaskPriority;
  /** Timeout in ms before forcing execution (default: 5000) */
  timeout?: number;
  /** Whether task should run only once (default: true) */
  once?: boolean;
  /** Task description for debugging */
  description?: string;
}

export interface IdleTaskResult {
  /** Schedule a task to run during idle time */
  scheduleTask: (task: Omit<IdleTask, 'id'>) => string;
  /** Schedule a high priority task */
  scheduleHighPriority: (execute: () => void | Promise<void>, description?: string) => string;
  /** Schedule a low priority task */
  scheduleLowPriority: (execute: () => void | Promise<void>, description?: string) => string;
  /** Schedule a background task (lowest priority) */
  scheduleBackground: (execute: () => void | Promise<void>, description?: string) => string;
  /** Cancel a scheduled task */
  cancelTask: (taskId: string) => boolean;
  /** Cancel all pending tasks */
  cancelAllTasks: () => void;
  /** Number of pending tasks */
  pendingTaskCount: number;
  /** Whether currently executing tasks */
  isExecuting: boolean;
}

// ========== CONSTANTS ==========

const PRIORITY_VALUES: Record<TaskPriority, number> = {
  high: 4,
  normal: 3,
  low: 2,
  background: 1,
};

const DEFAULT_TIMEOUTS: Record<TaskPriority, number> = {
  high: 1000,
  normal: 3000,
  low: 5000,
  background: 10000,
};

// ========== HELPER FUNCTIONS ==========

/**
 * Request idle callback with fallback
 */
function requestIdleCallbackWithFallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
): number {
  if (typeof requestIdleCallback !== 'undefined') {
    return requestIdleCallback(callback, options);
  }
  
  // Fallback: Use setTimeout with a configurable delay based on priority
  const start = Date.now();
  return window.setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    });
  }, options?.timeout ? Math.min(options.timeout / 5, 100) : 10) as unknown as number;
}

/**
 * Cancel idle callback with fallback
 */
function cancelIdleCallbackWithFallback(id: number): void {
  if (typeof cancelIdleCallback !== 'undefined') {
    cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Generate unique task ID
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ========== MAIN HOOK ==========

/**
 * Hook for scheduling tasks during browser idle time.
 * Tasks are prioritized and executed when the browser is not busy.
 * 
 * @example
 * ```tsx
 * const { scheduleTask, scheduleBackground, pendingTaskCount } = useIdleTask();
 * 
 * // Schedule a low priority task
 * scheduleTask({
 *   execute: () => console.log('Running during idle time'),
 *   priority: 'low',
 *   description: 'Debug log',
 * });
 * 
 * // Schedule a background task for analytics
 * scheduleBackground(() => sendAnalytics('page_view'));
 * ```
 */
export function useIdleTask(): IdleTaskResult {
  // Task queue state
  const [pendingTaskCount, setPendingTaskCount] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Refs for task management
  const taskQueueRef = useRef<Map<string, IdleTask>>(new Map());
  const idleCallbackRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);

  /**
   * Process tasks in priority order
   */
  const processTasks = useCallback((deadline: IdleDeadline) => {
    if (taskQueueRef.current.size === 0) {
      isProcessingRef.current = false;
      setPendingTaskCount(0);
      setIsExecuting(false);
      return;
    }

    setIsExecuting(true);
    isProcessingRef.current = true;

    // Sort tasks by priority
    const sortedTasks = Array.from(taskQueueRef.current.values()).sort(
      (a, b) => PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority]
    );

    // Process tasks while we have time
    while (deadline.timeRemaining() > 0 && sortedTasks.length > 0) {
      const task = sortedTasks.shift();
      if (!task) break;

      try {
        // Execute task
        const result = task.execute();
        
        // Handle async tasks
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`[useIdleTask] Task "${task.description || task.id}" failed:`, error);
          });
        }
      } catch (error) {
        console.error(`[useIdleTask] Task "${task.description || task.id}" error:`, error);
      }

      // Remove completed task
      taskQueueRef.current.delete(task.id);
    }

    // Update pending count
    setPendingTaskCount(taskQueueRef.current.size);

    // If there are remaining tasks, schedule another idle callback
    if (taskQueueRef.current.size > 0) {
      // Get the highest priority remaining task for timeout
      const remainingTasks = Array.from(taskQueueRef.current.values());
      const highestPriority = remainingTasks.reduce(
        (highest, task) => 
          PRIORITY_VALUES[task.priority] > PRIORITY_VALUES[highest] ? task.priority : highest,
        'background' as TaskPriority
      );
      
      idleCallbackRef.current = requestIdleCallbackWithFallback(processTasks, {
        timeout: DEFAULT_TIMEOUTS[highestPriority],
      });
    } else {
      isProcessingRef.current = false;
      setIsExecuting(false);
    }
  }, []);

  /**
   * Schedule processing if not already running
   */
  const scheduleProcessing = useCallback(() => {
    if (isProcessingRef.current || taskQueueRef.current.size === 0) {
      return;
    }

    // Get highest priority for timeout
    const tasks = Array.from(taskQueueRef.current.values());
    const highestPriority = tasks.reduce(
      (highest, task) => 
        PRIORITY_VALUES[task.priority] > PRIORITY_VALUES[highest] ? task.priority : highest,
      'background' as TaskPriority
    );

    idleCallbackRef.current = requestIdleCallbackWithFallback(processTasks, {
      timeout: DEFAULT_TIMEOUTS[highestPriority],
    });
  }, [processTasks]);

  /**
   * Schedule a task
   */
  const scheduleTask = useCallback((task: Omit<IdleTask, 'id'>): string => {
    const id = generateTaskId();
    const fullTask: IdleTask = {
      ...task,
      id,
      once: task.once ?? true,
      timeout: task.timeout ?? DEFAULT_TIMEOUTS[task.priority],
    };

    taskQueueRef.current.set(id, fullTask);
    setPendingTaskCount((prev) => prev + 1);
    
    // Schedule processing
    scheduleProcessing();

    return id;
  }, [scheduleProcessing]);

  /**
   * Schedule a high priority task
   */
  const scheduleHighPriority = useCallback(
    (execute: () => void | Promise<void>, description?: string): string => {
      return scheduleTask({ execute, priority: 'high', description });
    },
    [scheduleTask]
  );

  /**
   * Schedule a low priority task
   */
  const scheduleLowPriority = useCallback(
    (execute: () => void | Promise<void>, description?: string): string => {
      return scheduleTask({ execute, priority: 'low', description });
    },
    [scheduleTask]
  );

  /**
   * Schedule a background task (lowest priority)
   */
  const scheduleBackground = useCallback(
    (execute: () => void | Promise<void>, description?: string): string => {
      return scheduleTask({ execute, priority: 'background', description });
    },
    [scheduleTask]
  );

  /**
   * Cancel a scheduled task
   */
  const cancelTask = useCallback((taskId: string): boolean => {
    const existed = taskQueueRef.current.delete(taskId);
    if (existed) {
      setPendingTaskCount((prev) => Math.max(0, prev - 1));
    }
    return existed;
  }, []);

  /**
   * Cancel all pending tasks
   */
  const cancelAllTasks = useCallback(() => {
    taskQueueRef.current.clear();
    setPendingTaskCount(0);
    
    if (idleCallbackRef.current !== null) {
      cancelIdleCallbackWithFallback(idleCallbackRef.current);
      idleCallbackRef.current = null;
    }
    
    isProcessingRef.current = false;
    setIsExecuting(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (idleCallbackRef.current !== null) {
        cancelIdleCallbackWithFallback(idleCallbackRef.current);
      }
      taskQueueRef.current.clear();
    };
  }, []);

  return {
    scheduleTask,
    scheduleHighPriority,
    scheduleLowPriority,
    scheduleBackground,
    cancelTask,
    cancelAllTasks,
    pendingTaskCount,
    isExecuting,
  };
}

// ========== SPECIALIZED HOOKS ==========

/**
 * Hook for scheduling analytics events during idle time
 * 
 * @example
 * ```tsx
 * const { trackEvent, trackPageView } = useIdleAnalytics();
 * 
 * // These will be sent during idle time
 * trackEvent('button_click', { button: 'submit' });
 * trackPageView('/dashboard');
 * ```
 */
export function useIdleAnalytics(): {
  trackEvent: (eventName: string, data?: Record<string, unknown>) => void;
  trackPageView: (page: string) => void;
  flush: () => void;
} {
  const { scheduleBackground, cancelAllTasks } = useIdleTask();

  const trackEvent = useCallback(
    (eventName: string, data?: Record<string, unknown>) => {
      scheduleBackground(
        () => {
          // Default analytics implementation - can be customized
          if (typeof window !== 'undefined' && 'gtag' in window) {
            (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', eventName, data);
          }
        },
        `Analytics: ${eventName}`
      );
    },
    [scheduleBackground]
  );

  const trackPageView = useCallback(
    (page: string) => {
      scheduleBackground(
        () => {
          if (typeof window !== 'undefined' && 'gtag' in window) {
            (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('config', 'GA_MEASUREMENT_ID', {
              page_path: page,
            });
          }
        },
        `Page view: ${page}`
      );
    },
    [scheduleBackground]
  );

  const flush = useCallback(() => {
    cancelAllTasks();
  }, [cancelAllTasks]);

  return { trackEvent, trackPageView, flush };
}

/**
 * Hook for prefetching data during idle time
 * 
 * @example
 * ```tsx
 * const { prefetch, prefetchRoutes } = useIdlePrefetch();
 * 
 * // Prefetch data
 * prefetch('/api/users', () => fetch('/api/users'));
 * 
 * // Prefetch multiple routes
 * prefetchRoutes(['/dashboard', '/settings']);
 * ```
 */
export function useIdlePrefetch(): {
  prefetch: (key: string, fetcher: () => Promise<unknown>, priority?: TaskPriority) => void;
  prefetchRoutes: (routes: string[]) => void;
} {
  const { scheduleTask, scheduleLowPriority } = useIdleTask();
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetch = useCallback(
    (key: string, fetcher: () => Promise<unknown>, priority: TaskPriority = 'low') => {
      // Don't prefetch the same thing twice
      if (prefetchedRef.current.has(key)) {
        return;
      }

      prefetchedRef.current.add(key);

      scheduleTask({
        execute: async () => {
          try {
            await fetcher();
          } catch (error) {
            // Remove from prefetched set on error so it can be retried
            prefetchedRef.current.delete(key);
            throw error;
          }
        },
        priority,
        description: `Prefetch: ${key}`,
      });
    },
    [scheduleTask]
  );

  const prefetchRoutes = useCallback(
    (routes: string[]) => {
      routes.forEach((route) => {
        scheduleLowPriority(
          () => {
            // Preload route module if using dynamic imports
            // This is a no-op in most cases but enables future optimization
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = route;
            document.head.appendChild(link);
            
            // Clean up after a delay
            setTimeout(() => {
              document.head.removeChild(link);
            }, 60000);
          },
          `Prefetch route: ${route}`
        );
      });
    },
    [scheduleLowPriority]
  );

  return { prefetch, prefetchRoutes };
}

export default useIdleTask;
