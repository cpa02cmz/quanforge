/**
 * Backpressure Manager
 * 
 * Monitors system load and provides backpressure signals to prevent
 * system overload. Implements load shedding and pressure-based throttling.
 * 
 * Features:
 * - System resource monitoring (memory, event loop lag)
 * - Pressure level detection (low, medium, high, critical)
 * - Automatic load shedding when under pressure
 * - Configurable pressure thresholds
 * - Integration with rate limiting and bulkhead patterns
 * - Metrics collection and alerting
 * 
 * @module services/reliability/backpressureManager
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('backpressure-manager');

/**
 * Pressure level enum
 */
export enum PressureLevel {
  /** System is under minimal load */
  LOW = 'low',
  /** System is under normal load */
  NORMAL = 'normal',
  /** System is under elevated load, consider throttling */
  HIGH = 'high',
  /** System is under critical load, immediate action required */
  CRITICAL = 'critical'
}

/**
 * Load shedding strategy
 */
export enum LoadSheddingStrategy {
  /** Reject new requests when under pressure */
  REJECT_NEW = 'reject_new',
  /** Shed low-priority requests first */
  SHED_LOW_PRIORITY = 'shed_low_priority',
  /** Proportionally reduce all traffic */
  PROPORTIONAL = 'proportional',
  /** Delay processing of requests */
  DELAY = 'delay'
}

/**
 * Resource metrics interface
 */
export interface ResourceMetrics {
  /** Memory usage (0-1) */
  memoryUsage: number;
  /** Estimated CPU usage (0-1) - simulated in browser */
  cpuUsage: number;
  /** Event loop lag in ms */
  eventLoopLag: number;
  /** Number of pending promises/tasks */
  pendingTasks: number;
  /** Network requests in flight */
  networkRequests: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Timestamp of measurement */
  timestamp: number;
}

/**
 * Pressure threshold configuration
 */
export interface PressureThresholds {
  /** Memory usage threshold for high pressure (0-1) */
  memoryHigh: number;
  /** Memory usage threshold for critical pressure (0-1) */
  memoryCritical: number;
  /** Event loop lag threshold for high pressure (ms) */
  eventLoopLagHigh: number;
  /** Event loop lag threshold for critical pressure (ms) */
  eventLoopLagCritical: number;
  /** Pending tasks threshold for high pressure */
  pendingTasksHigh: number;
  /** Pending tasks threshold for critical pressure */
  pendingTasksCritical: number;
  /** Error rate threshold for high pressure (0-1) */
  errorRateHigh: number;
  /** Error rate threshold for critical pressure (0-1) */
  errorRateCritical: number;
}

/**
 * Backpressure configuration
 */
export interface BackpressureConfig {
  /** Enable backpressure monitoring */
  enabled: boolean;
  /** Monitoring interval in ms */
  monitoringInterval: number;
  /** Load shedding strategy */
  sheddingStrategy: LoadSheddingStrategy;
  /** Pressure thresholds */
  thresholds: PressureThresholds;
  /** Enable automatic load shedding */
  autoLoadShedding: boolean;
  /** Cooldown period after shedding before accepting new load (ms) */
  sheddingCooldown: number;
  /** Maximum requests to shed per interval */
  maxShedPerInterval: number;
  /** Enable pressure-based rate limiting */
  pressureRateLimiting: boolean;
  /** Factor to reduce rate when under high pressure */
  highPressureRateFactor: number;
  /** Factor to reduce rate when under critical pressure */
  criticalPressureRateFactor: number;
}

/**
 * Backpressure status
 */
export interface BackpressureStatus {
  /** Current pressure level */
  level: PressureLevel;
  /** Current resource metrics */
  metrics: ResourceMetrics;
  /** Whether load shedding is active */
  isShedding: boolean;
  /** Number of requests shed in current interval */
  shedCount: number;
  /** Total requests shed */
  totalShed: number;
  /** Recommended action */
  recommendedAction: string;
  /** Pressure score (0-100) */
  pressureScore: number;
  /** Time since last pressure change */
  lastPressureChange: number;
}

/**
 * Pressure event
 */
export interface PressureEvent {
  /** Previous pressure level */
  previousLevel: PressureLevel;
  /** New pressure level */
  newLevel: PressureLevel;
  /** Metrics at time of change */
  metrics: ResourceMetrics;
  /** Timestamp of event */
  timestamp: number;
}

/**
 * Pressure event listener
 */
export type PressureEventListener = (event: PressureEvent) => void;

/**
 * Default pressure thresholds
 */
const DEFAULT_THRESHOLDS: PressureThresholds = {
  memoryHigh: 0.7,
  memoryCritical: 0.85,
  eventLoopLagHigh: 50,
  eventLoopLagCritical: 100,
  pendingTasksHigh: 100,
  pendingTasksCritical: 200,
  errorRateHigh: 0.05,
  errorRateCritical: 0.1
};

/**
 * Default backpressure configuration
 */
const DEFAULT_CONFIG: BackpressureConfig = {
  enabled: true,
  monitoringInterval: 5000,
  sheddingStrategy: LoadSheddingStrategy.SHED_LOW_PRIORITY,
  thresholds: DEFAULT_THRESHOLDS,
  autoLoadShedding: true,
  sheddingCooldown: 10000,
  maxShedPerInterval: 50,
  pressureRateLimiting: true,
  highPressureRateFactor: 0.5,
  criticalPressureRateFactor: 0.2
};

/**
 * Backpressure Manager
 * 
 * Singleton service that monitors system pressure and provides
 * backpressure signals to prevent overload.
 */
export class BackpressureManager {
  private config: BackpressureConfig;
  private currentMetrics: ResourceMetrics;
  private currentLevel: PressureLevel = PressureLevel.LOW;
  private isShedding: boolean = false;
  private shedCount: number = 0;
  private totalShed: number = 0;
  private lastPressureChange: number = Date.now();
  private lastSheddingTime: number = 0;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private eventLoopCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastEventLoopCheck: number = 0;
  private eventLoopLag: number = 0;
  private pendingTasksCount: number = 0;
  private networkRequestsCount: number = 0;
  private errorCount: number = 0;
  private successCount: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private eventListeners: PressureEventListener[] = [];
  private static instance: BackpressureManager | null = null;

  private constructor(config?: Partial<BackpressureConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentMetrics = this.getInitialMetrics();

    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<BackpressureConfig>): BackpressureManager {
    if (!BackpressureManager.instance) {
      BackpressureManager.instance = new BackpressureManager(config);
    }
    return BackpressureManager.instance;
  }

  /**
   * Initialize initial metrics
   */
  private getInitialMetrics(): ResourceMetrics {
    return {
      memoryUsage: 0,
      cpuUsage: 0,
      eventLoopLag: 0,
      pendingTasks: 0,
      networkRequests: 0,
      cacheHitRate: 1,
      errorRate: 0,
      timestamp: Date.now()
    };
  }

  /**
   * Start backpressure monitoring
   */
  start(): void {
    if (!this.config.enabled) {
      logger.warn('Backpressure monitoring is disabled');
      return;
    }

    if (this.monitoringInterval) {
      logger.warn('Backpressure monitoring already started');
      return;
    }

    logger.info('Starting backpressure monitoring...');

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.evaluatePressure();
    }, this.config.monitoringInterval);

    // Start event loop lag detection
    this.startEventLoopMonitoring();

    // Initial collection
    this.collectMetrics();
    this.evaluatePressure();

    logger.info('Backpressure monitoring started');
  }

  /**
   * Stop backpressure monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.eventLoopCheckInterval) {
      clearInterval(this.eventLoopCheckInterval);
      this.eventLoopCheckInterval = null;
    }

    logger.info('Backpressure monitoring stopped');
  }

  /**
   * Start event loop lag monitoring
   */
  private startEventLoopMonitoring(): void {
    this.lastEventLoopCheck = performance.now();

    const checkLag = () => {
      const now = performance.now();
      const expected = this.lastEventLoopCheck + 50; // Target 50ms intervals
      const lag = Math.max(0, now - expected);
      
      // Smooth the lag measurement
      this.eventLoopLag = this.eventLoopLag * 0.9 + lag * 0.1;
      this.lastEventLoopCheck = now;
    };

    this.eventLoopCheckInterval = setInterval(checkLag, 50);
  }

  /**
   * Collect current resource metrics
   */
  private collectMetrics(): void {
    const now = Date.now();

    // Memory usage (browser)
    let memoryUsage = 0;
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      if (memory) {
        memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      }
    }

    // CPU usage (simulated based on event loop lag)
    const cpuUsage = Math.min(1, this.eventLoopLag / 100);

    // Calculate cache hit rate
    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 
      ? this.cacheHits / totalCacheRequests 
      : 1;

    // Calculate error rate
    const totalRequests = this.successCount + this.errorCount;
    const errorRate = totalRequests > 0 
      ? this.errorCount / totalRequests 
      : 0;

    this.currentMetrics = {
      memoryUsage,
      cpuUsage,
      eventLoopLag: this.eventLoopLag,
      pendingTasks: this.pendingTasksCount,
      networkRequests: this.networkRequestsCount,
      cacheHitRate,
      errorRate,
      timestamp: now
    };

    // Reset counters for next interval
    this.shedCount = 0;
  }

  /**
   * Evaluate current pressure level
   */
  private evaluatePressure(): void {
    const metrics = this.currentMetrics;
    const thresholds = this.config.thresholds;

    // Calculate pressure score (0-100)
    let pressureScore = 0;
    const weights = {
      memory: 0.3,
      eventLoop: 0.25,
      pendingTasks: 0.2,
      errorRate: 0.15,
      cacheHitRate: 0.1
    };

    // Memory pressure (0-100)
    pressureScore += weights.memory * (metrics.memoryUsage * 100);

    // Event loop pressure (0-100)
    pressureScore += weights.eventLoop * Math.min(100, metrics.eventLoopLag);

    // Pending tasks pressure (0-100)
    const taskPressure = (metrics.pendingTasks / thresholds.pendingTasksCritical) * 100;
    pressureScore += weights.pendingTasks * Math.min(100, taskPressure);

    // Error rate pressure (0-100)
    pressureScore += weights.errorRate * (metrics.errorRate * 1000);

    // Cache miss penalty (0-100)
    pressureScore += weights.cacheHitRate * ((1 - metrics.cacheHitRate) * 100);

    pressureScore = Math.min(100, Math.max(0, pressureScore));

    // Determine pressure level
    let newLevel: PressureLevel;

    // Check critical conditions first
    if (
      metrics.memoryUsage >= thresholds.memoryCritical ||
      metrics.eventLoopLag >= thresholds.eventLoopLagCritical ||
      metrics.pendingTasks >= thresholds.pendingTasksCritical ||
      metrics.errorRate >= thresholds.errorRateCritical
    ) {
      newLevel = PressureLevel.CRITICAL;
    }
    // Check high conditions
    else if (
      metrics.memoryUsage >= thresholds.memoryHigh ||
      metrics.eventLoopLag >= thresholds.eventLoopLagHigh ||
      metrics.pendingTasks >= thresholds.pendingTasksHigh ||
      metrics.errorRate >= thresholds.errorRateHigh
    ) {
      newLevel = PressureLevel.HIGH;
    }
    // Check moderate conditions
    else if (pressureScore > 30) {
      newLevel = PressureLevel.NORMAL;
    }
    // Low pressure
    else {
      newLevel = PressureLevel.LOW;
    }

    // Handle pressure level change
    if (newLevel !== this.currentLevel) {
      this.handlePressureChange(newLevel);
    }

    // Update shedding state
    this.updateSheddingState();
  }

  /**
   * Handle pressure level change
   */
  private handlePressureChange(newLevel: PressureLevel): void {
    const previousLevel = this.currentLevel;
    this.currentLevel = newLevel;
    this.lastPressureChange = Date.now();

    const event: PressureEvent = {
      previousLevel,
      newLevel,
      metrics: { ...this.currentMetrics },
      timestamp: Date.now()
    };

    logger.info(`Pressure changed: ${previousLevel} -> ${newLevel}`, {
      memoryUsage: `${(this.currentMetrics.memoryUsage * 100).toFixed(1)}%`,
      eventLoopLag: `${this.currentMetrics.eventLoopLag.toFixed(1)}ms`,
      pendingTasks: this.currentMetrics.pendingTasks,
      errorRate: `${(this.currentMetrics.errorRate * 100).toFixed(2)}%`
    });

    // Notify listeners
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error: unknown) {
        logger.error('Error in pressure event listener', error);
      }
    });
  }

  /**
   * Update shedding state
   */
  private updateSheddingState(): void {
    const now = Date.now();

    if (this.config.autoLoadShedding) {
      if (this.currentLevel === PressureLevel.CRITICAL) {
        if (!this.isShedding || now - this.lastSheddingTime > this.config.sheddingCooldown) {
          this.isShedding = true;
          this.lastSheddingTime = now;
          logger.warn('Load shedding activated due to critical pressure');
        }
      } else if (this.currentLevel === PressureLevel.HIGH) {
        // High pressure - consider shedding
        if (!this.isShedding && this.currentMetrics.pendingTasks > this.config.thresholds.pendingTasksHigh) {
          this.isShedding = true;
          this.lastSheddingTime = now;
          logger.warn('Load shedding activated due to high pressure');
        }
      } else {
        // Normal or low pressure - stop shedding after cooldown
        if (this.isShedding && now - this.lastSheddingTime > this.config.sheddingCooldown) {
          this.isShedding = false;
          logger.info('Load shedding deactivated');
        }
      }
    }
  }

  /**
   * Check if a request should be accepted
   */
  shouldAcceptRequest(priority: 'low' | 'normal' | 'high' = 'normal'): boolean {
    if (!this.config.enabled) {
      return true;
    }

    // Check shedding state
    if (this.isShedding) {
      if (this.config.sheddingStrategy === LoadSheddingStrategy.REJECT_NEW) {
        this.shedCount++;
        this.totalShed++;
        return false;
      }

      if (this.config.sheddingStrategy === LoadSheddingStrategy.SHED_LOW_PRIORITY) {
        if (priority === 'low') {
          this.shedCount++;
          this.totalShed++;
          return false;
        }
      }

      if (this.config.sheddingStrategy === LoadSheddingStrategy.PROPORTIONAL) {
        // Shed 50% of requests when under pressure
        if (Math.random() < 0.5 && priority !== 'high') {
          this.shedCount++;
          this.totalShed++;
          return false;
        }
      }

      // Check max shed limit
      if (this.shedCount >= this.config.maxShedPerInterval) {
        // Accept request even under pressure if we've hit shed limit
        return true;
      }
    }

    return true;
  }

  /**
   * Get recommended delay for request processing (for DELAY strategy)
   */
  getRecommendedDelay(): number {
    if (!this.config.enabled || this.config.sheddingStrategy !== LoadSheddingStrategy.DELAY) {
      return 0;
    }

    switch (this.currentLevel) {
      case PressureLevel.CRITICAL:
        return 500 + Math.random() * 500; // 500-1000ms delay
      case PressureLevel.HIGH:
        return 100 + Math.random() * 200; // 100-300ms delay
      case PressureLevel.NORMAL:
        return Math.random() * 50; // 0-50ms delay
      default:
        return 0;
    }
  }

  /**
   * Get rate limit factor based on current pressure
   */
  getRateLimitFactor(): number {
    if (!this.config.pressureRateLimiting) {
      return 1;
    }

    switch (this.currentLevel) {
      case PressureLevel.CRITICAL:
        return this.config.criticalPressureRateFactor;
      case PressureLevel.HIGH:
        return this.config.highPressureRateFactor;
      default:
        return 1;
    }
  }

  /**
   * Record a task started
   */
  recordTaskStart(): void {
    this.pendingTasksCount++;
    this.networkRequestsCount++;
  }

  /**
   * Record a task completed
   */
  recordTaskEnd(success: boolean = true): void {
    this.pendingTasksCount = Math.max(0, this.pendingTasksCount - 1);
    this.networkRequestsCount = Math.max(0, this.networkRequestsCount - 1);

    if (success) {
      this.successCount++;
    } else {
      this.errorCount++;
    }
  }

  /**
   * Record a cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Subscribe to pressure events
   */
  subscribe(listener: PressureEventListener): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index !== -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current pressure level
   */
  getPressureLevel(): PressureLevel {
    return this.currentLevel;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ResourceMetrics {
    // Calculate live error rate
    const totalRequests = this.successCount + this.errorCount;
    const errorRate = totalRequests > 0 
      ? this.errorCount / totalRequests 
      : 0;

    // Calculate live cache hit rate
    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 
      ? this.cacheHits / totalCacheRequests 
      : 1;

    return {
      ...this.currentMetrics,
      pendingTasks: this.pendingTasksCount,
      networkRequests: this.networkRequestsCount,
      errorRate,
      cacheHitRate
    };
  }

  /**
   * Get full status
   */
  getStatus(): BackpressureStatus {
    const pressureScore = this.calculatePressureScore();
    const recommendedAction = this.getRecommendedAction();

    return {
      level: this.currentLevel,
      metrics: { ...this.currentMetrics },
      isShedding: this.isShedding,
      shedCount: this.shedCount,
      totalShed: this.totalShed,
      recommendedAction,
      pressureScore,
      lastPressureChange: this.lastPressureChange
    };
  }

  /**
   * Calculate pressure score
   */
  private calculatePressureScore(): number {
    const metrics = this.currentMetrics;
    const thresholds = this.config.thresholds;

    let score = 0;
    score += metrics.memoryUsage * 30;
    score += Math.min(30, metrics.eventLoopLag / thresholds.eventLoopLagCritical * 30);
    score += Math.min(20, metrics.pendingTasks / thresholds.pendingTasksCritical * 20);
    score += Math.min(20, metrics.errorRate / thresholds.errorRateCritical * 20);

    return Math.min(100, Math.round(score));
  }

  /**
   * Get recommended action based on current state
   */
  private getRecommendedAction(): string {
    if (this.currentLevel === PressureLevel.CRITICAL) {
      return 'Immediate load shedding required. Reduce all non-essential traffic.';
    }

    if (this.currentLevel === PressureLevel.HIGH) {
      return 'Consider reducing traffic. Shed low-priority requests.';
    }

    if (this.currentLevel === PressureLevel.NORMAL) {
      return 'System under moderate load. Monitor closely.';
    }

    return 'System healthy. Normal operations.';
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    return this.currentLevel === PressureLevel.LOW || this.currentLevel === PressureLevel.NORMAL;
  }

  /**
   * Force pressure level (for testing)
   */
  forcePressureLevel(level: PressureLevel): void {
    this.handlePressureChange(level);
  }

  /**
   * Reset counters
   */
  reset(): void {
    this.shedCount = 0;
    this.totalShed = 0;
    this.pendingTasksCount = 0;
    this.networkRequestsCount = 0;
    this.errorCount = 0;
    this.successCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.isShedding = false;
    this.currentLevel = PressureLevel.LOW;
    this.lastPressureChange = Date.now();
    this.currentMetrics = this.getInitialMetrics();
    logger.info('Backpressure manager reset');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BackpressureConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Backpressure configuration updated', config);
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.stop();
    this.eventListeners = [];
    BackpressureManager.instance = null;
    logger.info('Backpressure manager destroyed');
  }
}

// Export singleton instance getter (lazy to support test reset)
export const backpressureManager = {
  get instance(): BackpressureManager {
    return BackpressureManager.getInstance();
  }
};

/**
 * Helper function to check if request should be accepted
 */
export function shouldAcceptRequest(priority?: 'low' | 'normal' | 'high'): boolean {
  return BackpressureManager.getInstance().shouldAcceptRequest(priority);
}

/**
 * Helper function to get rate limit factor
 */
export function getBackpressureRateFactor(): number {
  return BackpressureManager.getInstance().getRateLimitFactor();
}

/**
 * Helper function to execute with backpressure protection
 */
export async function withBackpressure<T>(
  fn: () => Promise<T>,
  options?: {
    priority?: 'low' | 'normal' | 'high';
    onRejected?: () => T | Promise<T>;
  }
): Promise<T> {
  const manager = BackpressureManager.getInstance();
  const priority = options?.priority ?? 'normal';

  // Check if we should accept the request
  if (!manager.shouldAcceptRequest(priority)) {
    if (options?.onRejected) {
      return options.onRejected();
    }
    throw new Error('Request rejected due to backpressure');
  }

  // Apply delay if using DELAY strategy
  const delay = manager.getRecommendedDelay();
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  manager.recordTaskStart();

  try {
    const result = await fn();
    manager.recordTaskEnd(true);
    return result;
  } catch (error: unknown) {
    manager.recordTaskEnd(false);
    throw error;
  }
}
