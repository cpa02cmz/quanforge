/**
 * Timeout Manager
 * 
 * Centralized timeout and timer management to prevent:
 * - Orphaned timers causing memory leaks
 * - Zombie callbacks after component unmount
 * - Uncoordinated timeout handling across services
 * 
 * Features:
 * - Automatic cleanup on unmount/destroy
 * - Named timers for debugging
 * - Timer cancellation and replacement
 * - Memory leak detection
 * 
 * @module services/reliability/timeoutManager
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('timeout-manager');

/**
 * Timer type enumeration
 */
export enum TimerType {
  TIMEOUT = 'timeout',
  INTERVAL = 'interval',
  IDLE_CALLBACK = 'idle_callback',
  ANIMATION_FRAME = 'animation_frame'
}

/**
 * Timer metadata for tracking
 */
interface TimerMetadata {
  id: number | string;
  type: TimerType;
  name: string;
  createdAt: number;
  delay: number;
  owner?: string;
  /** Whether timer has been cleared */
  cleared: boolean;
  /** Callback function reference for debugging */
  callbackName?: string;
}

/**
 * Configuration options
 */
export interface TimeoutManagerConfig {
  /** Maximum number of active timers before warning */
  maxActiveTimers: number;
  /** Enable memory leak detection */
  enableLeakDetection: boolean;
  /** Warn threshold for long-running intervals (ms) */
  longIntervalWarningMs: number;
  /** Enable debug logging */
  enableDebugLogging: boolean;
}

/**
 * Timer statistics
 */
export interface TimerStats {
  activeTimers: number;
  activeIntervals: number;
  activeIdleCallbacks: number;
  activeAnimationFrames: number;
  totalCreated: number;
  totalCleared: number;
  oldestTimerAge: number;
  timerNames: string[];
}

const DEFAULT_CONFIG: TimeoutManagerConfig = {
  maxActiveTimers: 100,
  enableLeakDetection: true,
  longIntervalWarningMs: 60000, // 1 minute
  enableDebugLogging: false
};

/**
 * Timeout Manager - Centralized timer management
 */
export class TimeoutManager {
  private timers = new Map<string, TimerMetadata>();
  private config: TimeoutManagerConfig;
  private totalCreated = 0;
  private totalCleared = 0;
  private leakCheckInterval?: ReturnType<typeof setInterval>;
  private static instance: TimeoutManager | null = null;

  constructor(config: Partial<TimeoutManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enableLeakDetection) {
      this.startLeakDetection();
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<TimeoutManagerConfig>): TimeoutManager {
    if (!TimeoutManager.instance) {
      TimeoutManager.instance = new TimeoutManager(config);
    }
    return TimeoutManager.instance;
  }

  /**
   * Set a managed timeout
   * @param callback - Function to execute
   * @param delay - Delay in milliseconds
   * @param name - Unique name for the timer
   * @param owner - Owner component/service name
   * @returns Timer ID for cancellation
   */
  setTimeout(
    callback: () => void,
    delay: number,
    name: string,
    owner?: string
  ): number {
    // Clear existing timer with same name
    this.clearTimer(name);

    const wrappedCallback = () => {
      this.markCleared(name);
      try {
        callback();
      } catch (error: unknown) {
        logger.error(`Timer '${name}' callback error:`, error);
      }
    };

    const id = window.setTimeout(wrappedCallback, delay);
    
    this.registerTimer({
      id,
      type: TimerType.TIMEOUT,
      name,
      createdAt: Date.now(),
      delay,
      owner,
      cleared: false,
      callbackName: callback.name || 'anonymous'
    });

    if (this.config.enableDebugLogging) {
      logger.debug(`Timer '${name}' created (delay: ${delay}ms, owner: ${owner || 'unknown'})`);
    }

    return id as number;
  }

  /**
   * Set a managed interval
   * @param callback - Function to execute
   * @param delay - Interval in milliseconds
   * @param name - Unique name for the timer
   * @param owner - Owner component/service name
   * @returns Timer ID for cancellation
   */
  setInterval(
    callback: () => void,
    delay: number,
    name: string,
    owner?: string
  ): number {
    // Clear existing interval with same name
    this.clearTimer(name);

    const wrappedCallback = () => {
      try {
        callback();
      } catch (error: unknown) {
        logger.error(`Interval '${name}' callback error:`, error);
      }
    };

    const id = window.setInterval(wrappedCallback, delay);
    
    this.registerTimer({
      id,
      type: TimerType.INTERVAL,
      name,
      createdAt: Date.now(),
      delay,
      owner,
      cleared: false,
      callbackName: callback.name || 'anonymous'
    });

    // Warn about long-running intervals
    if (delay >= this.config.longIntervalWarningMs) {
      logger.debug(`Long interval '${name}' created (${delay}ms)`);
    }

    return id as number;
  }

  /**
   * Set a managed requestIdleCallback
   * @param callback - Function to execute
   * @param name - Unique name for the callback
   * @param options - IdleCallback options
   * @returns Callback ID for cancellation
   */
  requestIdleCallback(
    callback: (deadline: IdleDeadline) => void,
    name: string,
    options?: IdleRequestOptions
  ): number {
    // Clear existing callback with same name
    this.clearTimer(name);

    const wrappedCallback = (deadline: IdleDeadline) => {
      this.markCleared(name);
      try {
        callback(deadline);
      } catch (error: unknown) {
        logger.error(`Idle callback '${name}' error:`, error);
      }
    };

    const id = window.requestIdleCallback(wrappedCallback, options);
    
    this.registerTimer({
      id,
      type: TimerType.IDLE_CALLBACK,
      name,
      createdAt: Date.now(),
      delay: 0,
      cleared: false,
      callbackName: callback.name || 'anonymous'
    });

    return id as number;
  }

  /**
   * Set a managed requestAnimationFrame
   * @param callback - Function to execute
   * @param name - Unique name for the frame
   * @returns Frame ID for cancellation
   */
  requestAnimationFrame(
    callback: (timestamp: number) => void,
    name: string
  ): number {
    // Clear existing frame with same name
    this.clearTimer(name);

    const wrappedCallback = (timestamp: number) => {
      this.markCleared(name);
      try {
        callback(timestamp);
      } catch (error: unknown) {
        logger.error(`Animation frame '${name}' error:`, error);
      }
    };

    const id = window.requestAnimationFrame(wrappedCallback);
    
    this.registerTimer({
      id,
      type: TimerType.ANIMATION_FRAME,
      name,
      createdAt: Date.now(),
      delay: 16, // ~60fps
      cleared: false,
      callbackName: callback.name || 'anonymous'
    });

    return id as number;
  }

  /**
   * Clear a specific timer by name
   */
  clearTimer(name: string): boolean {
    const metadata = this.timers.get(name);
    if (!metadata || metadata.cleared) {
      return false;
    }

    switch (metadata.type) {
      case TimerType.TIMEOUT:
        window.clearTimeout(metadata.id as number);
        break;
      case TimerType.INTERVAL:
        window.clearInterval(metadata.id as number);
        break;
      case TimerType.IDLE_CALLBACK:
        window.cancelIdleCallback(metadata.id as number);
        break;
      case TimerType.ANIMATION_FRAME:
        window.cancelAnimationFrame(metadata.id as number);
        break;
    }

    this.markCleared(name);
    return true;
  }

  /**
   * Clear all timers owned by a specific component/service
   */
  clearByOwner(owner: string): number {
    let cleared = 0;
    this.timers.forEach((metadata, name) => {
      if (metadata.owner === owner && !metadata.cleared) {
        this.clearTimer(name);
        cleared++;
      }
    });
    return cleared;
  }

  /**
   * Clear all timers
   */
  clearAll(): number {
    let cleared = 0;
    this.timers.forEach((metadata, name) => {
      if (!metadata.cleared) {
        this.clearTimer(name);
        cleared++;
      }
    });
    return cleared;
  }

  /**
   * Replace an existing timer (or create new one)
   */
  replaceTimeout(
    callback: () => void,
    delay: number,
    name: string,
    owner?: string
  ): number {
    this.clearTimer(name);
    return this.setTimeout(callback, delay, name, owner);
  }

  /**
   * Replace an existing interval (or create new one)
   */
  replaceInterval(
    callback: () => void,
    delay: number,
    name: string,
    owner?: string
  ): number {
    this.clearTimer(name);
    return this.setInterval(callback, delay, name, owner);
  }

  /**
   * Check if a timer is active
   */
  isActive(name: string): boolean {
    const metadata = this.timers.get(name);
    return metadata !== undefined && !metadata.cleared;
  }

  /**
   * Get timer statistics
   */
  getStats(): TimerStats {
    let activeTimers = 0;
    let activeIntervals = 0;
    let activeIdleCallbacks = 0;
    let activeAnimationFrames = 0;
    let oldestTimestamp = Date.now();
    const timerNames: string[] = [];

    this.timers.forEach(metadata => {
      if (!metadata.cleared) {
        timerNames.push(metadata.name);
        
        switch (metadata.type) {
          case TimerType.TIMEOUT:
            activeTimers++;
            break;
          case TimerType.INTERVAL:
            activeIntervals++;
            break;
          case TimerType.IDLE_CALLBACK:
            activeIdleCallbacks++;
            break;
          case TimerType.ANIMATION_FRAME:
            activeAnimationFrames++;
            break;
        }

        if (metadata.createdAt < oldestTimestamp) {
          oldestTimestamp = metadata.createdAt;
        }
      }
    });

    return {
      activeTimers,
      activeIntervals,
      activeIdleCallbacks,
      activeAnimationFrames,
      totalCreated: this.totalCreated,
      totalCleared: this.totalCleared,
      oldestTimerAge: Date.now() - oldestTimestamp,
      timerNames
    };
  }

  /**
   * Get timer details for debugging
   */
  getTimerDetails(name: string): TimerMetadata | undefined {
    return this.timers.get(name);
  }

  /**
   * Get all active timers for debugging
   */
  getActiveTimers(): TimerMetadata[] {
    return Array.from(this.timers.values()).filter(m => !m.cleared);
  }

  /**
   * Register a timer
   */
  private registerTimer(metadata: TimerMetadata): void {
    this.timers.set(metadata.name, metadata);
    this.totalCreated++;
    this.checkTimerCount();
  }

  /**
   * Mark a timer as cleared
   */
  private markCleared(name: string): void {
    const metadata = this.timers.get(name);
    if (metadata && !metadata.cleared) {
      metadata.cleared = true;
      this.totalCleared++;
    }
  }

  /**
   * Check timer count and warn if approaching limit
   */
  private checkTimerCount(): void {
    const stats = this.getStats();
    const activeCount = stats.activeTimers + stats.activeIntervals + 
                        stats.activeIdleCallbacks + stats.activeAnimationFrames;

    if (activeCount >= this.config.maxActiveTimers * 0.8) {
      logger.warn(
        `Approaching timer limit: ${activeCount}/${this.config.maxActiveTimers} active timers`
      );
    }

    if (activeCount >= this.config.maxActiveTimers) {
      logger.error(
        `Timer limit exceeded: ${activeCount}/${this.config.maxActiveTimers} active timers. ` +
        `This may indicate a memory leak.`
      );
    }
  }

  /**
   * Start periodic leak detection
   */
  private startLeakDetection(): void {
    if (this.leakCheckInterval) {
      clearInterval(this.leakCheckInterval);
    }

    this.leakCheckInterval = setInterval(() => {
      this.detectLeaks();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Detect potential timer leaks
   */
  private detectLeaks(): void {
    const stats = this.getStats();
    const activeCount = stats.activeTimers + stats.activeIntervals;

    // Check for old intervals (potential leaks)
    if (stats.oldestTimerAge > 300000) { // 5 minutes
      const oldTimers = this.getActiveTimers()
        .filter(m => Date.now() - m.createdAt > 300000 && m.type === TimerType.INTERVAL);
      
      if (oldTimers.length > 0) {
        logger.warn(
          `Detected ${oldTimers.length} long-running intervals (>5min). ` +
          `Names: ${oldTimers.map(t => t.name).join(', ')}`
        );
      }
    }

    // Check for high timer count
    if (activeCount > 50) {
      logger.warn(
        `High timer count detected: ${activeCount} active timers. ` +
        `Consider reviewing timer usage.`
      );
    }
  }

  /**
   * Cleanup and destroy manager
   */
  destroy(): void {
    this.clearAll();
    if (this.leakCheckInterval) {
      clearInterval(this.leakCheckInterval);
      this.leakCheckInterval = undefined;
    }
    logger.info('Timeout manager destroyed');
  }

  /**
   * Reset manager state (for testing)
   */
  reset(): void {
    this.clearAll();
    this.totalCreated = 0;
    this.totalCleared = 0;
  }
}

// Export singleton instance
export const timeoutManager = TimeoutManager.getInstance();

// Register with cleanup coordinator if available
if (typeof window !== 'undefined') {
  // Auto-cleanup on page unload
  window.addEventListener('beforeunload', () => {
    timeoutManager.clearAll();
  });
}
