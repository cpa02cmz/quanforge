/**
 * Bulkhead Pattern Implementation
 * 
 * Isolates failures by limiting concurrent calls to services.
 * Prevents cascading failures by restricting the number of concurrent operations.
 * 
 * @module services/reliability/bulkhead
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('bulkhead');

/**
 * Bulkhead state enumeration
 */
export enum BulkheadState {
  OPEN = 'open',      // Accepting calls
  CLOSED = 'closed',  // Rejecting calls (limit reached)
  DEGRADED = 'degraded' // Operating with limited capacity
}

/**
 * Bulkhead configuration options
 */
export interface BulkheadConfig {
  /** Maximum concurrent calls allowed */
  maxConcurrentCalls: number;
  /** Maximum wait time for a slot (ms) */
  maxWaitTime: number;
  /** Name of the bulkhead for logging */
  name: string;
  /** Callback when bulkhead state changes */
  onStateChange?: (state: BulkheadState, metrics: BulkheadMetrics) => void;
  /** Callback when a call is rejected */
  onCallRejected?: (waitingCalls: number) => void;
  /** Enable graceful degradation mode */
  enableDegradation?: boolean;
  /** Degradation threshold (percentage of max calls) */
  degradationThreshold?: number;
}

/**
 * Bulkhead metrics for monitoring
 */
export interface BulkheadMetrics {
  /** Current state of the bulkhead */
  state: BulkheadState;
  /** Number of active calls */
  activeCalls: number;
  /** Number of calls waiting for a slot */
  waitingCalls: number;
  /** Total calls accepted */
  totalAccepted: number;
  /** Total calls rejected */
  totalRejected: number;
  /** Average wait time for acquiring a slot */
  avgWaitTime: number;
  /** Current available slots */
  availableSlots: number;
  /** Timestamp of last state change */
  lastStateChange: number;
  /** Peak concurrent calls */
  peakConcurrentCalls: number;
}

/**
 * Internal call tracking
 */
interface PendingCall {
  resolve: (value: void) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * Bulkhead implementation for isolating failures
 */
export class Bulkhead {
  private state: BulkheadState = BulkheadState.OPEN;
  private activeCalls = 0;
  private waitingCalls: PendingCall[] = [];
  private totalAccepted = 0;
  private totalRejected = 0;
  private waitTimes: number[] = [];
  private peakConcurrentCalls = 0;
  private lastStateChange = Date.now();
  private readonly config: BulkheadConfig;
  private readonly maxWaitTimeHistory = 100;

  constructor(config: BulkheadConfig) {
    this.config = {
      enableDegradation: true,
      degradationThreshold: 0.8,
      ...config
    };

    logger.info(`Bulkhead '${config.name}' initialized with max ${config.maxConcurrentCalls} concurrent calls`);
  }

  /**
   * Execute an operation with bulkhead protection
   * @param operation - The async operation to execute
   * @returns The result of the operation
   * @throws Error if bulkhead is closed or wait timeout exceeded
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();

    // Try to acquire a slot
    await this.acquireSlot(startTime);

    try {
      const result = await operation();
      return result;
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * Try to execute without waiting (fire and forget with rejection)
   * @param operation - The async operation to execute
   * @returns true if accepted, false if rejected
   */
  async tryExecute<T>(operation: () => Promise<T>): Promise<{ accepted: boolean; result?: T; error?: Error }> {
    if (this.activeCalls >= this.config.maxConcurrentCalls) {
      this.totalRejected++;
      this.config.onCallRejected?.(this.waitingCalls.length);
      return { accepted: false };
    }

    this.activeCalls++;
    this.totalAccepted++;
    this.updatePeakCalls();
    this.updateState();

    try {
      const result = await operation();
      return { accepted: true, result };
    } catch (error: unknown) {
      return { accepted: true, error: error instanceof Error ? error : new Error(String(error)) };
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * Acquire a slot in the bulkhead
   */
  private async acquireSlot(requestTime: number): Promise<void> {
    // If we have available slots, use immediately
    if (this.activeCalls < this.config.maxConcurrentCalls) {
      this.activeCalls++;
      this.totalAccepted++;
      this.updatePeakCalls();
      this.updateState();
      return;
    }

    // If no wait time, reject immediately
    if (this.config.maxWaitTime <= 0) {
      this.totalRejected++;
      this.config.onCallRejected?.(this.waitingCalls.length);
      throw new Error(
        `Bulkhead '${this.config.name}' is full. No waiting allowed. ` +
        `Active: ${this.activeCalls}/${this.config.maxConcurrentCalls}`
      );
    }

    // Wait for a slot with timeout
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from waiting queue
        const index = this.waitingCalls.findIndex(c => c.resolve === resolve);
        if (index !== -1) {
          this.waitingCalls.splice(index, 1);
        }
        this.totalRejected++;
        this.config.onCallRejected?.(this.waitingCalls.length);
        reject(new Error(
          `Bulkhead '${this.config.name}' wait timeout exceeded. ` +
          `Waited: ${this.config.maxWaitTime}ms`
        ));
      }, this.config.maxWaitTime);

      this.waitingCalls.push({
        resolve: (value) => {
          clearTimeout(timeoutId);
          const waitTime = Date.now() - requestTime;
          this.recordWaitTime(waitTime);
          this.activeCalls++;
          this.totalAccepted++;
          this.updatePeakCalls();
          this.updateState();
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timestamp: requestTime
      });
    });
  }

  /**
   * Release a slot and notify waiting calls
   */
  private releaseSlot(): void {
    this.activeCalls--;

    // Notify the next waiting call
    if (this.waitingCalls.length > 0) {
      const next = this.waitingCalls.shift()!;
      next.resolve();
    }

    this.updateState();
  }

  /**
   * Update peak concurrent calls tracking
   */
  private updatePeakCalls(): void {
    if (this.activeCalls > this.peakConcurrentCalls) {
      this.peakConcurrentCalls = this.activeCalls;
    }
  }

  /**
   * Record wait time for metrics
   */
  private recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime);
    if (this.waitTimes.length > this.maxWaitTimeHistory) {
      this.waitTimes.shift();
    }
  }

  /**
   * Update bulkhead state based on current conditions
   */
  private updateState(): void {
    const previousState = this.state;
    const utilizationRatio = this.activeCalls / this.config.maxConcurrentCalls;

    if (this.activeCalls >= this.config.maxConcurrentCalls) {
      this.state = BulkheadState.CLOSED;
    } else if (
      this.config.enableDegradation &&
      utilizationRatio >= (this.config.degradationThreshold || 0.8)
    ) {
      this.state = BulkheadState.DEGRADED;
    } else {
      this.state = BulkheadState.OPEN;
    }

    if (previousState !== this.state) {
      this.lastStateChange = Date.now();
      logger.info(
        `Bulkhead '${this.config.name}' state changed: ${previousState} -> ${this.state} ` +
        `(active: ${this.activeCalls}/${this.config.maxConcurrentCalls})`
      );
      this.config.onStateChange?.(this.state, this.getMetrics());
    }
  }

  /**
   * Get current bulkhead metrics
   */
  getMetrics(): BulkheadMetrics {
    const avgWaitTime = this.waitTimes.length > 0
      ? this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length
      : 0;

    return {
      state: this.state,
      activeCalls: this.activeCalls,
      waitingCalls: this.waitingCalls.length,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
      avgWaitTime,
      availableSlots: this.config.maxConcurrentCalls - this.activeCalls,
      lastStateChange: this.lastStateChange,
      peakConcurrentCalls: this.peakConcurrentCalls
    };
  }

  /**
   * Get current state
   */
  getState(): BulkheadState {
    return this.state;
  }

  /**
   * Check if bulkhead is accepting calls
   */
  isAvailable(): boolean {
    return this.activeCalls < this.config.maxConcurrentCalls;
  }

  /**
   * Reset bulkhead state and metrics
   */
  reset(): void {
    // Reject all waiting calls
    this.waitingCalls.forEach(call => {
      call.reject(new Error(`Bulkhead '${this.config.name}' reset`));
    });

    this.state = BulkheadState.OPEN;
    this.activeCalls = 0;
    this.waitingCalls = [];
    this.totalAccepted = 0;
    this.totalRejected = 0;
    this.waitTimes = [];
    this.peakConcurrentCalls = 0;
    this.lastStateChange = Date.now();

    logger.info(`Bulkhead '${this.config.name}' reset`);
  }
}

/**
 * Bulkhead Manager for managing multiple bulkheads
 */
export class BulkheadManager {
  private bulkheads = new Map<string, Bulkhead>();

  /**
   * Register a new bulkhead
   */
  register(name: string, config: Omit<BulkheadConfig, 'name'>): Bulkhead {
    if (this.bulkheads.has(name)) {
      logger.warn(`Bulkhead '${name}' already exists, returning existing instance`);
      return this.bulkheads.get(name)!;
    }

    const bulkhead = new Bulkhead({ ...config, name });
    this.bulkheads.set(name, bulkhead);
    return bulkhead;
  }

  /**
   * Get a bulkhead by name
   */
  get(name: string): Bulkhead | undefined {
    return this.bulkheads.get(name);
  }

  /**
   * Get all bulkhead metrics
   */
  getAllMetrics(): Record<string, BulkheadMetrics> {
    const result: Record<string, BulkheadMetrics> = {};
    this.bulkheads.forEach((bulkhead, name) => {
      result[name] = bulkhead.getMetrics();
    });
    return result;
  }

  /**
   * Get summary of all bulkheads
   */
  getSummary(): {
    total: number;
    open: number;
    closed: number;
    degraded: number;
    totalActiveCalls: number;
    totalRejected: number;
  } {
    let open = 0;
    let closed = 0;
    let degraded = 0;
    let totalActiveCalls = 0;
    let totalRejected = 0;

    this.bulkheads.forEach(bulkhead => {
      const metrics = bulkhead.getMetrics();
      totalActiveCalls += metrics.activeCalls;
      totalRejected += metrics.totalRejected;

      switch (metrics.state) {
        case BulkheadState.OPEN:
          open++;
          break;
        case BulkheadState.CLOSED:
          closed++;
          break;
        case BulkheadState.DEGRADED:
          degraded++;
          break;
      }
    });

    return {
      total: this.bulkheads.size,
      open,
      closed,
      degraded,
      totalActiveCalls,
      totalRejected
    };
  }

  /**
   * Reset all bulkheads
   */
  resetAll(): void {
    this.bulkheads.forEach(bulkhead => bulkhead.reset());
    logger.info('All bulkheads reset');
  }
}

// Default bulkhead configurations
export const DEFAULT_BULKHEAD_CONFIGS = {
  database: {
    maxConcurrentCalls: 20,
    maxWaitTime: 5000,
    enableDegradation: true,
    degradationThreshold: 0.75
  },
  ai_service: {
    maxConcurrentCalls: 5,
    maxWaitTime: 10000,
    enableDegradation: true,
    degradationThreshold: 0.6
  },
  market_data: {
    maxConcurrentCalls: 10,
    maxWaitTime: 3000,
    enableDegradation: true,
    degradationThreshold: 0.8
  },
  cache: {
    maxConcurrentCalls: 50,
    maxWaitTime: 1000,
    enableDegradation: false
  },
  external_api: {
    maxConcurrentCalls: 15,
    maxWaitTime: 5000,
    enableDegradation: true,
    degradationThreshold: 0.7
  }
} as const;

// Singleton instance
export const bulkheadManager = new BulkheadManager();

// Pre-register default bulkheads
Object.entries(DEFAULT_BULKHEAD_CONFIGS).forEach(([name, config]) => {
  bulkheadManager.register(name, config);
});
