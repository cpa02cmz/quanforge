/**
 * Adaptive Rate Limiter
 * 
 * Dynamically adjusts rate limits based on system health, load, and performance metrics.
 * Combines token bucket with adaptive control for optimal throughput.
 * 
 * Features:
 * - Dynamic rate adjustment based on system health
 * - Load-based throttling
 * - Automatic scale-up/scale-down
 * - Integration with health monitoring
 * - Metrics collection and reporting
 * 
 * @module services/reliability/adaptiveRateLimiter
 */

import { createScopedLogger } from '../../utils/logger';
import { rateLimiterManager, type RateLimiterConfig as _RateLimiterConfig, type RateLimiterStatus } from './rateLimiter';
import { serviceRegistry } from './serviceRegistry';
import { ServiceHealth } from './gracefulDegradation';

const logger = createScopedLogger('adaptive-rate-limiter');

/**
 * System load level
 */
export enum LoadLevel {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Adaptation strategy
 */
export enum AdaptationStrategy {
  /** Conservative - slow adjustments */
  CONSERVATIVE = 'conservative',
  /** Aggressive - fast adjustments */
  AGGRESSIVE = 'aggressive',
  /** Balanced - moderate adjustments */
  BALANCED = 'balanced'
}

/**
 * Adaptive rate limiter configuration
 */
export interface AdaptiveRateLimiterConfig {
  /** Service name */
  serviceName: string;
  /** Initial tokens per second */
  initialRate: number;
  /** Minimum tokens per second (floor) */
  minRate: number;
  /** Maximum tokens per second (ceiling) */
  maxRate: number;
  /** Adaptation strategy */
  strategy: AdaptationStrategy;
  /** Scale-up factor (multiplier when healthy) */
  scaleUpFactor: number;
  /** Scale-down factor (multiplier when unhealthy) */
  scaleDownFactor: number;
  /** Cooldown period between adjustments (ms) */
  cooldownPeriod: number;
  /** Health threshold for scale-up */
  healthThresholdForScaleUp: number;
  /** Health threshold for scale-down */
  healthThresholdForScaleDown: number;
  /** Load thresholds */
  loadThresholds: {
    low: number;
    high: number;
    critical: number;
  };
}

/**
 * Adaptive rate limiter status
 */
export interface AdaptiveRateLimiterStatus extends RateLimiterStatus {
  /** Current load level */
  loadLevel: LoadLevel;
  /** Current adaptation factor */
  adaptationFactor: number;
  /** Last adjustment time */
  lastAdjustment: number;
  /** Total adjustments made */
  totalAdjustments: number;
  /** Is currently scaling */
  isScaling: boolean;
  /** Reason for current rate */
  rateReason: string;
}

/**
 * System metrics for load calculation
 */
interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestQueueSize: number;
  errorRate: number;
  avgResponseTime: number;
}

/**
 * Default configurations by service type
 */
const DEFAULT_CONFIGS: Record<string, Partial<AdaptiveRateLimiterConfig>> = {
  ai_service: {
    initialRate: 10,
    minRate: 2,
    maxRate: 50,
    strategy: AdaptationStrategy.CONSERVATIVE,
    scaleUpFactor: 1.2,
    scaleDownFactor: 0.5,
    cooldownPeriod: 60000,
    healthThresholdForScaleUp: 0.95,
    healthThresholdForScaleDown: 0.8,
    loadThresholds: { low: 0.3, high: 0.7, critical: 0.9 }
  },
  database: {
    initialRate: 50,
    minRate: 10,
    maxRate: 200,
    strategy: AdaptationStrategy.BALANCED,
    scaleUpFactor: 1.5,
    scaleDownFactor: 0.3,
    cooldownPeriod: 30000,
    healthThresholdForScaleUp: 0.90,
    healthThresholdForScaleDown: 0.75,
    loadThresholds: { low: 0.25, high: 0.75, critical: 0.85 }
  },
  external_api: {
    initialRate: 5,
    minRate: 1,
    maxRate: 20,
    strategy: AdaptationStrategy.CONSERVATIVE,
    scaleUpFactor: 1.1,
    scaleDownFactor: 0.5,
    cooldownPeriod: 120000,
    healthThresholdForScaleUp: 0.98,
    healthThresholdForScaleDown: 0.85,
    loadThresholds: { low: 0.2, high: 0.6, critical: 0.8 }
  },
  cache: {
    initialRate: 100,
    minRate: 50,
    maxRate: 500,
    strategy: AdaptationStrategy.AGGRESSIVE,
    scaleUpFactor: 2.0,
    scaleDownFactor: 0.2,
    cooldownPeriod: 10000,
    healthThresholdForScaleUp: 0.85,
    healthThresholdForScaleDown: 0.6,
    loadThresholds: { low: 0.3, high: 0.8, critical: 0.95 }
  }
};

/**
 * Adaptive Rate Limiter
 */
export class AdaptiveRateLimiter {
  private configs = new Map<string, AdaptiveRateLimiterConfig>();
  private currentRates = new Map<string, number>();
  private lastAdjustments = new Map<string, number>();
  private totalAdjustments = new Map<string, number>();
  private systemMetrics = new Map<string, SystemMetrics>();
  private scalingInProgress = new Map<string, boolean>();
  private adjustmentIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private static instance: AdaptiveRateLimiter | null = null;

  private constructor() {
    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AdaptiveRateLimiter {
    if (!AdaptiveRateLimiter.instance) {
      AdaptiveRateLimiter.instance = new AdaptiveRateLimiter();
    }
    return AdaptiveRateLimiter.instance;
  }

  /**
   * Register a service for adaptive rate limiting
   */
  register(config: Partial<AdaptiveRateLimiterConfig> & { serviceName: string }): void {
    const serviceName = config.serviceName;
    
    if (this.configs.has(serviceName)) {
      logger.warn(`Service '${serviceName}' already registered, updating configuration`);
    }

    // Get default config for service type
    const defaultConfig = DEFAULT_CONFIGS[serviceName] || DEFAULT_CONFIGS.database;

    const finalConfig: AdaptiveRateLimiterConfig = {
      serviceName,
      initialRate: config.initialRate ?? defaultConfig.initialRate ?? 10,
      minRate: config.minRate ?? defaultConfig.minRate ?? 1,
      maxRate: config.maxRate ?? defaultConfig.maxRate ?? 100,
      strategy: config.strategy ?? defaultConfig.strategy ?? AdaptationStrategy.BALANCED,
      scaleUpFactor: config.scaleUpFactor ?? defaultConfig.scaleUpFactor ?? 1.2,
      scaleDownFactor: config.scaleDownFactor ?? defaultConfig.scaleDownFactor ?? 0.5,
      cooldownPeriod: config.cooldownPeriod ?? defaultConfig.cooldownPeriod ?? 30000,
      healthThresholdForScaleUp: config.healthThresholdForScaleUp ?? defaultConfig.healthThresholdForScaleUp ?? 0.95,
      healthThresholdForScaleDown: config.healthThresholdForScaleDown ?? defaultConfig.healthThresholdForScaleDown ?? 0.8,
      loadThresholds: config.loadThresholds ?? defaultConfig.loadThresholds ?? { low: 0.3, high: 0.7, critical: 0.9 }
    };

    this.configs.set(serviceName, finalConfig);
    this.currentRates.set(serviceName, finalConfig.initialRate);
    this.lastAdjustments.set(serviceName, 0);
    this.totalAdjustments.set(serviceName, 0);
    this.scalingInProgress.set(serviceName, false);

    // Register with base rate limiter
    rateLimiterManager.register(serviceName, {
      tokensPerSecond: finalConfig.initialRate,
      maxTokens: finalConfig.initialRate * 2,
      enableQueue: true,
      maxQueueSize: 50
    });

    // Start periodic adjustment
    this.startPeriodicAdjustment(serviceName);

    logger.info(
      `Registered '${serviceName}' for adaptive rate limiting ` +
      `(initial: ${finalConfig.initialRate}/s, range: ${finalConfig.minRate}-${finalConfig.maxRate})`
    );
  }

  /**
   * Unregister a service
   */
  unregister(serviceName: string): void {
    const interval = this.adjustmentIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.adjustmentIntervals.delete(serviceName);
    }

    this.configs.delete(serviceName);
    this.currentRates.delete(serviceName);
    this.lastAdjustments.delete(serviceName);
    this.totalAdjustments.delete(serviceName);
    this.systemMetrics.delete(serviceName);
    this.scalingInProgress.delete(serviceName);

    logger.info(`Unregistered '${serviceName}' from adaptive rate limiting`);
  }

  /**
   * Start periodic rate adjustment
   */
  private startPeriodicAdjustment(serviceName: string): void {
    const config = this.configs.get(serviceName);
    if (!config) return;

    const interval = setInterval(() => {
      this.adjustRate(serviceName);
    }, config.cooldownPeriod);

    this.adjustmentIntervals.set(serviceName, interval);
  }

  /**
   * Update system metrics for a service
   */
  updateMetrics(
    serviceName: string,
    metrics: Partial<SystemMetrics>
  ): void {
    const existing = this.systemMetrics.get(serviceName) || {
      cpuUsage: 0,
      memoryUsage: 0,
      activeConnections: 0,
      requestQueueSize: 0,
      errorRate: 0,
      avgResponseTime: 0
    };

    this.systemMetrics.set(serviceName, {
      ...existing,
      ...metrics
    });
  }

  /**
   * Calculate load level for a service
   */
  calculateLoadLevel(serviceName: string): LoadLevel {
    const config = this.configs.get(serviceName);
    const metrics = this.systemMetrics.get(serviceName);

    if (!config || !metrics) {
      return LoadLevel.NORMAL;
    }

    // Calculate composite load score
    const loadScore = this.calculateLoadScore(metrics, config);

    if (loadScore >= config.loadThresholds.critical) {
      return LoadLevel.CRITICAL;
    } else if (loadScore >= config.loadThresholds.high) {
      return LoadLevel.HIGH;
    } else if (loadScore <= config.loadThresholds.low) {
      return LoadLevel.LOW;
    }

    return LoadLevel.NORMAL;
  }

  /**
   * Calculate composite load score
   */
  private calculateLoadScore(metrics: SystemMetrics, _config: AdaptiveRateLimiterConfig): number {
    // Weighted average of various metrics
    const weights = {
      cpu: 0.3,
      memory: 0.2,
      connections: 0.15,
      queue: 0.15,
      errors: 0.1,
      responseTime: 0.1
    };

    // Normalize metrics (0-1 scale)
    const normalizedCpu = metrics.cpuUsage / 100;
    const normalizedMemory = metrics.memoryUsage / 100;
    const normalizedConnections = Math.min(metrics.activeConnections / 100, 1);
    const normalizedQueue = Math.min(metrics.requestQueueSize / 50, 1);
    const normalizedErrors = Math.min(metrics.errorRate * 10, 1);
    const normalizedResponseTime = Math.min(metrics.avgResponseTime / 1000, 1);

    const loadScore = 
      weights.cpu * normalizedCpu +
      weights.memory * normalizedMemory +
      weights.connections * normalizedConnections +
      weights.queue * normalizedQueue +
      weights.errors * normalizedErrors +
      weights.responseTime * normalizedResponseTime;

    return loadScore;
  }

  /**
   * Adjust rate based on current conditions
   */
  private adjustRate(serviceName: string): void {
    const config = this.configs.get(serviceName);
    if (!config) return;

    const now = Date.now();
    const lastAdjustment = this.lastAdjustments.get(serviceName) || 0;
    
    // Check cooldown
    if (now - lastAdjustment < config.cooldownPeriod) {
      return;
    }

    // Get current conditions
    const loadLevel = this.calculateLoadLevel(serviceName);
    const healthStatus = serviceRegistry.getStatus(serviceName);
    const health = healthStatus?.health ?? ServiceHealth.HEALTHY;
    const availability = healthStatus?.availability ?? 1;

    // Calculate new rate
    let newRate = this.currentRates.get(serviceName) || config.initialRate;
    let reason = 'normal operation';

    // Determine adjustment based on health and load
    if (health === ServiceHealth.UNHEALTHY || health === ServiceHealth.OFFLINE) {
      // Critical: scale down significantly
      newRate = this.calculateAdjustedRate(newRate, config.scaleDownFactor * 0.5, config);
      reason = 'service unhealthy';
    } else if (loadLevel === LoadLevel.CRITICAL) {
      // Critical load: scale down
      newRate = this.calculateAdjustedRate(newRate, config.scaleDownFactor * 0.5, config);
      reason = 'critical load';
    } else if (loadLevel === LoadLevel.HIGH) {
      // High load: scale down moderately
      newRate = this.calculateAdjustedRate(newRate, config.scaleDownFactor * 0.8, config);
      reason = 'high load';
    } else if (availability >= config.healthThresholdForScaleUp && loadLevel === LoadLevel.LOW) {
      // Healthy and low load: scale up
      newRate = this.calculateAdjustedRate(newRate, config.scaleUpFactor, config);
      reason = 'healthy, low load';
    } else if (availability < config.healthThresholdForScaleDown) {
      // Below health threshold: scale down
      newRate = this.calculateAdjustedRate(newRate, config.scaleDownFactor, config);
      reason = 'below health threshold';
    }

    // Apply rate if changed
    if (newRate !== this.currentRates.get(serviceName)) {
      this.applyRate(serviceName, newRate, reason);
    }
  }

  /**
   * Calculate adjusted rate with strategy consideration
   */
  private calculateAdjustedRate(
    currentRate: number,
    factor: number,
    config: AdaptiveRateLimiterConfig
  ): number {
    let adjustedRate = currentRate * factor;

    // Apply strategy-based smoothing
    switch (config.strategy) {
      case AdaptationStrategy.CONSERVATIVE:
        // Smaller adjustments
        adjustedRate = currentRate + (adjustedRate - currentRate) * 0.5;
        break;
      case AdaptationStrategy.AGGRESSIVE:
        // Full adjustments
        break;
      case AdaptationStrategy.BALANCED:
        // Moderate adjustments
        adjustedRate = currentRate + (adjustedRate - currentRate) * 0.75;
        break;
    }

    // Clamp to bounds
    return Math.max(config.minRate, Math.min(config.maxRate, Math.floor(adjustedRate)));
  }

  /**
   * Apply new rate to the rate limiter
   */
  private applyRate(serviceName: string, newRate: number, reason: string): void {
    const config = this.configs.get(serviceName);
    if (!config) return;

    const oldRate = this.currentRates.get(serviceName) || config.initialRate;
    
    // Update base rate limiter
    const limiter = rateLimiterManager.get(serviceName);
    if (limiter) {
      // Re-register with new rate
      rateLimiterManager.register(serviceName, {
        tokensPerSecond: newRate,
        maxTokens: newRate * 2,
        enableQueue: true,
        maxQueueSize: 50
      });
    }

    // Update tracking
    this.currentRates.set(serviceName, newRate);
    this.lastAdjustments.set(serviceName, Date.now());
    this.totalAdjustments.set(serviceName, (this.totalAdjustments.get(serviceName) || 0) + 1);

    logger.info(
      `Rate adjusted for '${serviceName}': ${oldRate}/s -> ${newRate}/s (${reason})`
    );
  }

  /**
   * Force a rate adjustment
   */
  forceAdjust(serviceName: string, targetRate: number): void {
    const config = this.configs.get(serviceName);
    if (!config) {
      logger.warn(`Cannot force adjust: service '${serviceName}' not registered`);
      return;
    }

    // Clamp to bounds
    const clampedRate = Math.max(config.minRate, Math.min(config.maxRate, targetRate));
    this.applyRate(serviceName, clampedRate, 'manual adjustment');
  }

  /**
   * Get current status for a service
   */
  getStatus(serviceName: string): AdaptiveRateLimiterStatus | null {
    const config = this.configs.get(serviceName);
    const baseStatus = rateLimiterManager.get(serviceName)?.getStatus();

    if (!config || !baseStatus) {
      return null;
    }

    const loadLevel = this.calculateLoadLevel(serviceName);
    const currentRate = this.currentRates.get(serviceName) || config.initialRate;
    const initialRate = config.initialRate;
    const adaptationFactor = currentRate / initialRate;

    return {
      ...baseStatus,
      name: serviceName,
      loadLevel,
      adaptationFactor,
      lastAdjustment: this.lastAdjustments.get(serviceName) || 0,
      totalAdjustments: this.totalAdjustments.get(serviceName) || 0,
      isScaling: this.scalingInProgress.get(serviceName) || false,
      rateReason: this.getRateReason(serviceName, loadLevel)
    };
  }

  /**
   * Get reason for current rate
   */
  private getRateReason(serviceName: string, loadLevel: LoadLevel): string {
    const config = this.configs.get(serviceName);
    if (!config) return 'unknown';

    const currentRate = this.currentRates.get(serviceName) || config.initialRate;
    
    if (currentRate === config.maxRate) {
      return 'at maximum capacity';
    } else if (currentRate === config.minRate) {
      return 'at minimum capacity';
    } else if (loadLevel === LoadLevel.CRITICAL) {
      return 'reduced due to critical load';
    } else if (loadLevel === LoadLevel.HIGH) {
      return 'reduced due to high load';
    } else if (loadLevel === LoadLevel.LOW) {
      return 'scaled up due to low load';
    }

    return 'normal operation';
  }

  /**
   * Get all service statuses
   */
  getAllStatuses(): AdaptiveRateLimiterStatus[] {
    const statuses: AdaptiveRateLimiterStatus[] = [];
    this.configs.forEach((_, serviceName) => {
      const status = this.getStatus(serviceName);
      if (status) statuses.push(status);
    });
    return statuses;
  }

  /**
   * Get services that need attention
   */
  getServicesNeedingAttention(): AdaptiveRateLimiterStatus[] {
    return this.getAllStatuses().filter(status => 
      status.loadLevel === LoadLevel.CRITICAL ||
      status.loadLevel === LoadLevel.HIGH ||
      status.adaptationFactor < 0.5
    );
  }

  /**
   * Reset a service to initial rate
   */
  resetToInitial(serviceName: string): void {
    const config = this.configs.get(serviceName);
    if (!config) return;

    this.applyRate(serviceName, config.initialRate, 'reset to initial');
  }

  /**
   * Reset all services
   */
  resetAll(): void {
    this.configs.forEach((config, serviceName) => {
      this.applyRate(serviceName, config.initialRate, 'global reset');
    });
    logger.info('All adaptive rate limiters reset');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.adjustmentIntervals.forEach(interval => clearInterval(interval));
    this.adjustmentIntervals.clear();
    this.configs.clear();
    this.currentRates.clear();
    this.lastAdjustments.clear();
    this.totalAdjustments.clear();
    this.systemMetrics.clear();
    this.scalingInProgress.clear();
    AdaptiveRateLimiter.instance = null;
    logger.info('Adaptive rate limiter destroyed');
  }
}

// Export singleton instance
export const adaptiveRateLimiter = AdaptiveRateLimiter.getInstance();

/**
 * Helper function to register a service with adaptive rate limiting
 */
export function registerAdaptiveRateLimiter(
  serviceName: string,
  config?: Partial<AdaptiveRateLimiterConfig>
): void {
  adaptiveRateLimiter.register({
    serviceName,
    ...config
  });
}

/**
 * Helper function to update metrics for adaptive rate limiting
 */
export function updateAdaptiveMetrics(
  serviceName: string,
  metrics: Partial<SystemMetrics>
): void {
  adaptiveRateLimiter.updateMetrics(serviceName, metrics);
}
