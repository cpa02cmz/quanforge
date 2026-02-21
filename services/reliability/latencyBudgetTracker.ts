/**
 * Latency Budget Tracker
 * 
 * Tracks and enforces latency budgets for service chains.
 * Monitors latency degradation patterns and provides alerts.
 * 
 * Features:
 * - Per-service latency budget management
 * - Latency percentile tracking (p50, p95, p99)
 * - Budget violation alerts
 * - Trend analysis
 * - Integration with health monitoring
 * 
 * @module services/reliability/latencyBudgetTracker
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('latency-budget-tracker');

/**
 * Latency budget violation level
 */
export enum ViolationLevel {
  NONE = 'none',
  WARNING = 'warning',
  CRITICAL = 'critical',
  BREACH = 'breach'
}

/**
 * Latency budget configuration
 */
export interface LatencyBudgetConfig {
  /** Service name */
  serviceName: string;
  /** Target latency (ms) - desired performance */
  targetLatency: number;
  /** Warning threshold (ms) - 80% of budget */
  warningThreshold: number;
  /** Critical threshold (ms) - 90% of budget */
  criticalThreshold: number;
  /** Breach threshold (ms) - 100% of budget */
  breachThreshold: number;
  /** Window size for percentile calculations */
  windowSize: number;
  /** Minimum samples required for percentile calculation */
  minSamples: number;
  /** Enable trend analysis */
  enableTrendAnalysis: boolean;
  /** Trend window size */
  trendWindowSize: number;
}

/**
 * Latency sample
 */
interface LatencySample {
  value: number;
  timestamp: number;
  success: boolean;
}

/**
 * Latency metrics
 */
export interface LatencyMetrics {
  serviceName: string;
  /** Current latency (last measurement) */
  current: number;
  /** Minimum latency in window */
  min: number;
  /** Maximum latency in window */
  max: number;
  /** Average latency */
  avg: number;
  /** 50th percentile */
  p50: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
  /** Standard deviation */
  stdDev: number;
  /** Sample count */
  sampleCount: number;
  /** Violation level */
  violationLevel: ViolationLevel;
  /** Budget usage percentage */
  budgetUsage: number;
  /** Trend direction */
  trend: 'improving' | 'stable' | 'degrading';
  /** Trend confidence (0-1) */
  trendConfidence: number;
}

/**
 * Latency budget event
 */
export interface LatencyBudgetEvent {
  type: 'sample_recorded' | 'threshold_warning' | 'threshold_critical' | 'budget_breach' | 'recovery';
  serviceName: string;
  timestamp: number;
  latency: number;
  violationLevel: ViolationLevel;
  metrics: LatencyMetrics;
}

/**
 * Budget violation summary
 */
export interface BudgetViolationSummary {
  serviceName: string;
  violationLevel: ViolationLevel;
  budgetUsage: number;
  currentLatency: number;
  targetLatency: number;
  timeInViolation: number;
  samplesInViolation: number;
}

/**
 * Default latency budget configurations
 */
const DEFAULT_CONFIGS: Record<string, Partial<LatencyBudgetConfig>> = {
  ai_service: {
    targetLatency: 2000,
    warningThreshold: 1600,
    criticalThreshold: 1800,
    breachThreshold: 2000,
    windowSize: 100,
    minSamples: 10,
    enableTrendAnalysis: true,
    trendWindowSize: 50
  },
  database: {
    targetLatency: 100,
    warningThreshold: 80,
    criticalThreshold: 90,
    breachThreshold: 100,
    windowSize: 200,
    minSamples: 20,
    enableTrendAnalysis: true,
    trendWindowSize: 100
  },
  cache: {
    targetLatency: 10,
    warningThreshold: 8,
    criticalThreshold: 9,
    breachThreshold: 10,
    windowSize: 500,
    minSamples: 50,
    enableTrendAnalysis: true,
    trendWindowSize: 200
  },
  external_api: {
    targetLatency: 500,
    warningThreshold: 400,
    criticalThreshold: 450,
    breachThreshold: 500,
    windowSize: 50,
    minSamples: 5,
    enableTrendAnalysis: true,
    trendWindowSize: 25
  }
};

/**
 * Latency Budget Tracker
 */
export class LatencyBudgetTracker {
  private configs = new Map<string, LatencyBudgetConfig>();
  private samples = new Map<string, LatencySample[]>();
  private eventListeners = new Map<string, Array<(event: LatencyBudgetEvent) => void>>();
  private violationStartTimes = new Map<string, number>();
  private violationSampleCounts = new Map<string, number>();
  private static instance: LatencyBudgetTracker | null = null;

  private constructor() {
    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): LatencyBudgetTracker {
    if (!LatencyBudgetTracker.instance) {
      LatencyBudgetTracker.instance = new LatencyBudgetTracker();
    }
    return LatencyBudgetTracker.instance;
  }

  /**
   * Register a service with latency budget
   */
  register(config: Partial<LatencyBudgetConfig> & { serviceName: string }): void {
    const serviceName = config.serviceName;

    if (this.configs.has(serviceName)) {
      logger.warn(`Service '${serviceName}' already registered, updating configuration`);
    }

    // Get default config for service type
    const defaultConfig = DEFAULT_CONFIGS[serviceName] || DEFAULT_CONFIGS.database;

    const finalConfig: LatencyBudgetConfig = {
      serviceName,
      targetLatency: config.targetLatency ?? defaultConfig.targetLatency ?? 100,
      warningThreshold: config.warningThreshold ?? defaultConfig.warningThreshold ?? 80,
      criticalThreshold: config.criticalThreshold ?? defaultConfig.criticalThreshold ?? 90,
      breachThreshold: config.breachThreshold ?? defaultConfig.breachThreshold ?? 100,
      windowSize: config.windowSize ?? defaultConfig.windowSize ?? 100,
      minSamples: config.minSamples ?? defaultConfig.minSamples ?? 10,
      enableTrendAnalysis: config.enableTrendAnalysis ?? defaultConfig.enableTrendAnalysis ?? true,
      trendWindowSize: config.trendWindowSize ?? defaultConfig.trendWindowSize ?? 50
    };

    this.configs.set(serviceName, finalConfig);
    this.samples.set(serviceName, []);
    this.violationStartTimes.delete(serviceName);
    this.violationSampleCounts.set(serviceName, 0);

    logger.info(
      `Registered '${serviceName}' for latency budget tracking ` +
      `(target: ${finalConfig.targetLatency}ms, breach: ${finalConfig.breachThreshold}ms)`
    );
  }

  /**
   * Unregister a service
   */
  unregister(serviceName: string): void {
    this.configs.delete(serviceName);
    this.samples.delete(serviceName);
    this.violationStartTimes.delete(serviceName);
    this.violationSampleCounts.delete(serviceName);
    logger.info(`Unregistered '${serviceName}' from latency budget tracking`);
  }

  /**
   * Record a latency sample
   */
  recordLatency(serviceName: string, latency: number, success: boolean = true): void {
    const config = this.configs.get(serviceName);
    if (!config) {
      logger.debug(`Service '${serviceName}' not registered for latency tracking`);
      return;
    }

    const samples = this.samples.get(serviceName)!;
    
    // Add new sample
    samples.push({
      value: latency,
      timestamp: Date.now(),
      success
    });

    // Maintain window size
    while (samples.length > config.windowSize) {
      samples.shift();
    }

    // Calculate metrics and check violations
    const metrics = this.calculateMetrics(serviceName);
    
    // Check for violation changes
    this.checkViolation(serviceName, latency, metrics);

    // Emit sample recorded event
    this.emitEvent({
      type: 'sample_recorded',
      serviceName,
      timestamp: Date.now(),
      latency,
      violationLevel: metrics.violationLevel,
      metrics
    });
  }

  /**
   * Calculate metrics for a service
   */
  calculateMetrics(serviceName: string): LatencyMetrics {
    const config = this.configs.get(serviceName);
    const samples = this.samples.get(serviceName);

    if (!config || !samples || samples.length === 0) {
      return this.getEmptyMetrics(serviceName);
    }

    const values = samples.map(s => s.value).sort((a, b) => a - b);
    const count = values.length;

    // Basic statistics
    const min = values[0];
    const max = values[count - 1];
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;

    // Percentiles
    const p50 = this.percentile(values, 50);
    const p95 = this.percentile(values, 95);
    const p99 = this.percentile(values, 99);

    // Standard deviation
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / count;
    const stdDev = Math.sqrt(avgSquaredDiff);

    // Budget usage
    const currentLatency = values[count - 1];
    const budgetUsage = Math.min((currentLatency / config.breachThreshold) * 100, 100);

    // Violation level
    const violationLevel = this.determineViolationLevel(config, currentLatency);

    // Trend analysis
    const { trend, trendConfidence } = config.enableTrendAnalysis
      ? this.analyzeTrend(samples, config.trendWindowSize)
      : { trend: 'stable' as const, trendConfidence: 0 };

    return {
      serviceName,
      current: currentLatency,
      min,
      max,
      avg,
      p50,
      p95,
      p99,
      stdDev,
      sampleCount: count,
      violationLevel,
      budgetUsage,
      trend,
      trendConfidence
    };
  }

  /**
   * Calculate percentile value
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Determine violation level
   */
  private determineViolationLevel(
    config: LatencyBudgetConfig,
    latency: number
  ): ViolationLevel {
    if (latency >= config.breachThreshold) {
      return ViolationLevel.BREACH;
    } else if (latency >= config.criticalThreshold) {
      return ViolationLevel.CRITICAL;
    } else if (latency >= config.warningThreshold) {
      return ViolationLevel.WARNING;
    }
    return ViolationLevel.NONE;
  }

  /**
   * Analyze latency trend
   */
  private analyzeTrend(
    samples: LatencySample[],
    windowSize: number
  ): { trend: 'improving' | 'stable' | 'degrading'; trendConfidence: number } {
    if (samples.length < windowSize) {
      return { trend: 'stable', trendConfidence: 0 };
    }

    const recentSamples = samples.slice(-windowSize);
    const midPoint = Math.floor(recentSamples.length / 2);
    
    const firstHalf = recentSamples.slice(0, midPoint);
    const secondHalf = recentSamples.slice(midPoint);

    const firstAvg = firstHalf.reduce((a, s) => a + s.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, s) => a + s.value, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    const maxLatency = Math.max(firstAvg, secondAvg);
    const relativeChange = maxLatency > 0 ? Math.abs(diff / maxLatency) : 0;

    // Determine trend with confidence
    let trend: 'improving' | 'stable' | 'degrading';
    let trendConfidence: number;

    if (relativeChange < 0.05) {
      trend = 'stable';
      trendConfidence = 1 - relativeChange;
    } else if (diff > 0) {
      trend = 'degrading';
      trendConfidence = Math.min(relativeChange * 2, 1);
    } else {
      trend = 'improving';
      trendConfidence = Math.min(relativeChange * 2, 1);
    }

    return { trend, trendConfidence };
  }

  /**
   * Check and handle violation changes
   */
  private checkViolation(
    serviceName: string,
    latency: number,
    metrics: LatencyMetrics
  ): void {
    const config = this.configs.get(serviceName);
    if (!config) return;

    const currentViolation = metrics.violationLevel;
    const previousViolationTime = this.violationStartTimes.get(serviceName);

    if (currentViolation !== ViolationLevel.NONE) {
      // Track violation
      if (!previousViolationTime) {
        this.violationStartTimes.set(serviceName, Date.now());
        this.violationSampleCounts.set(serviceName, 1);
      } else {
        this.violationSampleCounts.set(
          serviceName,
          (this.violationSampleCounts.get(serviceName) || 0) + 1
        );
      }

      // Emit violation event
      const eventType = currentViolation === ViolationLevel.BREACH
        ? 'budget_breach'
        : currentViolation === ViolationLevel.CRITICAL
          ? 'threshold_critical'
          : 'threshold_warning';

      this.emitEvent({
        type: eventType,
        serviceName,
        timestamp: Date.now(),
        latency,
        violationLevel: currentViolation,
        metrics
      });

      logger.warn(
        `Latency ${eventType} for '${serviceName}': ${latency}ms ` +
        `(target: ${config.targetLatency}ms, usage: ${metrics.budgetUsage.toFixed(1)}%)`
      );
    } else if (previousViolationTime) {
      // Recovery
      this.emitEvent({
        type: 'recovery',
        serviceName,
        timestamp: Date.now(),
        latency,
        violationLevel: ViolationLevel.NONE,
        metrics
      });

      logger.info(`Latency budget recovered for '${serviceName}'`);
      this.violationStartTimes.delete(serviceName);
      this.violationSampleCounts.set(serviceName, 0);
    }
  }

  /**
   * Get empty metrics
   */
  private getEmptyMetrics(serviceName: string): LatencyMetrics {
    return {
      serviceName,
      current: 0,
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
      sampleCount: 0,
      violationLevel: ViolationLevel.NONE,
      budgetUsage: 0,
      trend: 'stable',
      trendConfidence: 0
    };
  }

  /**
   * Get metrics for a service
   */
  getMetrics(serviceName: string): LatencyMetrics {
    return this.calculateMetrics(serviceName);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): LatencyMetrics[] {
    const metrics: LatencyMetrics[] = [];
    this.configs.forEach((_, serviceName) => {
      metrics.push(this.calculateMetrics(serviceName));
    });
    return metrics;
  }

  /**
   * Get violation summary for a service
   */
  getViolationSummary(serviceName: string): BudgetViolationSummary | null {
    const config = this.configs.get(serviceName);
    const metrics = this.calculateMetrics(serviceName);
    const violationStartTime = this.violationStartTimes.get(serviceName);

    if (!config) return null;

    return {
      serviceName,
      violationLevel: metrics.violationLevel,
      budgetUsage: metrics.budgetUsage,
      currentLatency: metrics.current,
      targetLatency: config.targetLatency,
      timeInViolation: violationStartTime ? Date.now() - violationStartTime : 0,
      samplesInViolation: this.violationSampleCounts.get(serviceName) || 0
    };
  }

  /**
   * Get services with violations
   */
  getServicesWithViolations(): BudgetViolationSummary[] {
    const summaries: BudgetViolationSummary[] = [];
    
    this.configs.forEach((_, serviceName) => {
      const summary = this.getViolationSummary(serviceName);
      if (summary && summary.violationLevel !== ViolationLevel.NONE) {
        summaries.push(summary);
      }
    });

    return summaries.sort((a, b) => {
      // Sort by violation level (breach > critical > warning)
      const levelOrder = {
        [ViolationLevel.BREACH]: 3,
        [ViolationLevel.CRITICAL]: 2,
        [ViolationLevel.WARNING]: 1,
        [ViolationLevel.NONE]: 0
      };
      return levelOrder[b.violationLevel] - levelOrder[a.violationLevel];
    });
  }

  /**
   * Check if latency budget is healthy
   */
  isHealthy(serviceName: string): boolean {
    const metrics = this.calculateMetrics(serviceName);
    return metrics.violationLevel === ViolationLevel.NONE;
  }

  /**
   * Get services with degrading trend
   */
  getServicesWithDegradingTrend(): LatencyMetrics[] {
    return this.getAllMetrics().filter(
      m => m.trend === 'degrading' && m.trendConfidence > 0.5
    );
  }

  /**
   * Subscribe to latency budget events
   */
  subscribe(eventType: string, callback: (event: LatencyBudgetEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }

    this.eventListeners.get(eventType)!.push(callback);

    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit an event
   */
  private emitEvent(event: LatencyBudgetEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error: unknown) {
          logger.error('Error in latency budget event listener:', error);
        }
      });
    }

    // Also emit to 'all' listeners
    const allListeners = this.eventListeners.get('all');
    if (allListeners) {
      allListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error: unknown) {
          logger.error('Error in latency budget event listener:', error);
        }
      });
    }
  }

  /**
   * Reset a service's data
   */
  reset(serviceName: string): void {
    const samples = this.samples.get(serviceName);
    if (samples) {
      samples.length = 0;
    }
    this.violationStartTimes.delete(serviceName);
    this.violationSampleCounts.set(serviceName, 0);
    logger.info(`Latency budget data reset for '${serviceName}'`);
  }

  /**
   * Reset all services
   */
  resetAll(): void {
    this.samples.forEach((_, serviceName) => {
      this.reset(serviceName);
    });
    logger.info('All latency budget data reset');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.configs.clear();
    this.samples.clear();
    this.eventListeners.clear();
    this.violationStartTimes.clear();
    this.violationSampleCounts.clear();
    LatencyBudgetTracker.instance = null;
    logger.info('Latency budget tracker destroyed');
  }
}

// Export singleton instance
export const latencyBudgetTracker = LatencyBudgetTracker.getInstance();

/**
 * Helper function to record latency for a service
 */
export function recordLatency(serviceName: string, latency: number, success?: boolean): void {
  latencyBudgetTracker.recordLatency(serviceName, latency, success);
}

/**
 * Helper function to register a service with latency budget
 */
export function registerLatencyBudget(
  serviceName: string,
  config?: Partial<LatencyBudgetConfig>
): void {
  latencyBudgetTracker.register({
    serviceName,
    ...config
  });
}
