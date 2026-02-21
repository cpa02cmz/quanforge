/**
 * Error Budget Tracker
 * 
 * Implements SRE error budget tracking for service reliability management.
 * Error budgets represent the acceptable amount of unreliability within a time window.
 * 
 * Features:
 * - SLA/SLO tracking with configurable targets
 * - Error budget calculation and burn rate monitoring
 * - Alerting when budgets are exhausted or burning too fast
 * - Historical tracking and trend analysis
 * 
 * @module services/reliability/errorBudgetTracker
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('error-budget-tracker');

/**
 * SLO (Service Level Objective) configuration
 */
export interface SLOConfig {
  /** Service name */
  serviceName: string;
  /** Target availability (0-1, e.g., 0.999 for 99.9%) */
  targetAvailability: number;
  /** Time window for budget calculation (ms) */
  timeWindow: number;
  /** Alert threshold when budget remaining drops below this (0-1) */
  alertThreshold: number;
  /** Burn rate alert threshold (multiplier) */
  burnRateAlertThreshold: number;
  /** Whether to auto-reset budget at window end */
  autoReset: boolean;
}

/**
 * Error budget status
 */
export interface ErrorBudgetStatus {
  serviceName: string;
  targetAvailability: number;
  currentAvailability: number;
  totalBudget: number;
  remainingBudget: number;
  consumedBudget: number;
  burnRate: number;
  timeToExhaustion: number | null;
  windowStart: number;
  windowEnd: number;
  isExhausted: boolean;
  isAlertActive: boolean;
  totalRequests: number;
  failedRequests: number;
  successfulRequests: number;
}

/**
 * Budget consumption record
 */
interface BudgetRecord {
  timestamp: number;
  success: boolean;
  latency?: number;
}

/**
 * Budget alert
 */
export interface BudgetAlert {
  serviceName: string;
  type: 'budget_exhausted' | 'budget_low' | 'burn_rate_high' | 'availability_drop';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  details: Record<string, unknown>;
}

/**
 * Alert callback type
 */
type AlertCallback = (alert: BudgetAlert) => void;

/**
 * Error Budget Tracker
 * 
 * Tracks error budgets for services to enable SRE best practices.
 */
export class ErrorBudgetTracker {
  private configs = new Map<string, SLOConfig>();
  private records = new Map<string, BudgetRecord[]>();
  private windowStarts = new Map<string, number>();
  private alertCallbacks: AlertCallback[] = [];
  private cleanupInterval?: ReturnType<typeof setInterval>;
  
  private readonly MAX_RECORDS = 100000;
  private readonly DEFAULT_TIME_WINDOW = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.startCleanup();
    
    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Register a service with SLO configuration
   */
  registerService(config: Partial<SLOConfig> & { serviceName: string }): void {
    const fullConfig: SLOConfig = {
      targetAvailability: 0.999,
      timeWindow: this.DEFAULT_TIME_WINDOW,
      alertThreshold: 0.1, // Alert when 10% budget remaining
      burnRateAlertThreshold: 2, // Alert if burning 2x faster than expected
      autoReset: true,
      ...config
    };

    if (this.configs.has(config.serviceName)) {
      logger.warn(`Service '${config.serviceName}' already registered, updating configuration`);
    }

    this.configs.set(config.serviceName, fullConfig);
    this.records.set(config.serviceName, []);
    this.windowStarts.set(config.serviceName, Date.now());

    logger.info(
      `Service '${config.serviceName}' registered with ${(fullConfig.targetAvailability * 100).toFixed(3)}% availability target ` +
      `and ${(fullConfig.timeWindow / (24 * 60 * 60 * 1000)).toFixed(0)} day window`
    );
  }

  /**
   * Unregister a service
   */
  unregisterService(serviceName: string): void {
    this.configs.delete(serviceName);
    this.records.delete(serviceName);
    this.windowStarts.delete(serviceName);
    logger.info(`Service '${serviceName}' unregistered`);
  }

  /**
   * Record a request result
   */
  recordRequest(serviceName: string, success: boolean, latency?: number): void {
    const config = this.configs.get(serviceName);
    if (!config) {
      logger.warn(`Service '${serviceName}' not registered for error budget tracking`);
      return;
    }

    // Check if window needs reset
    this.checkWindowReset(serviceName);

    const records = this.records.get(serviceName) || [];
    records.push({
      timestamp: Date.now(),
      success,
      latency
    });

    // Trim old records outside window
    const windowStart = this.windowStarts.get(serviceName) || 0;
    const cutoff = windowStart;
    const trimmedRecords = records.filter(r => r.timestamp >= cutoff);
    
    // Also trim to max records to prevent memory issues
    const finalRecords = trimmedRecords.slice(-this.MAX_RECORDS);
    this.records.set(serviceName, finalRecords);

    // Check for alerts after recording
    this.checkAlerts(serviceName);
  }

  /**
   * Record batch of requests
   */
  recordBatch(serviceName: string, results: Array<{ success: boolean; latency?: number }>): void {
    results.forEach(result => {
      this.recordRequest(serviceName, result.success, result.latency);
    });
  }

  /**
   * Check if window needs reset
   */
  private checkWindowReset(serviceName: string): void {
    const config = this.configs.get(serviceName);
    const windowStart = this.windowStarts.get(serviceName);
    
    if (!config || !windowStart) return;

    const now = Date.now();
    if (now - windowStart >= config.timeWindow && config.autoReset) {
      this.resetWindow(serviceName);
    }
  }

  /**
   * Reset the budget window for a service
   */
  resetWindow(serviceName: string): void {
    const config = this.configs.get(serviceName);
    if (!config) return;

    this.records.set(serviceName, []);
    this.windowStarts.set(serviceName, Date.now());

    logger.info(`Error budget window reset for '${serviceName}'`);
  }

  /**
   * Get error budget status for a service
   */
  getStatus(serviceName: string): ErrorBudgetStatus | null {
    const config = this.configs.get(serviceName);
    const records = this.records.get(serviceName);
    const windowStart = this.windowStarts.get(serviceName);

    if (!config || records === undefined || !windowStart) {
      return null;
    }

    const now = Date.now();
    const windowRecords = records.filter(r => r.timestamp >= windowStart);

    const totalRequests = windowRecords.length;
    const failedRequests = windowRecords.filter(r => !r.success).length;
    const successfulRequests = totalRequests - failedRequests;

    // Calculate current availability
    const currentAvailability = totalRequests > 0 
      ? successfulRequests / totalRequests 
      : 1;

    // Calculate error budget
    // Total budget = (1 - targetAvailability) * estimated requests in window
    const estimatedRequestsPerMs = totalRequests / (now - windowStart);
    const estimatedTotalRequests = estimatedRequestsPerMs * config.timeWindow;
    const totalBudget = Math.max(1, Math.floor((1 - config.targetAvailability) * estimatedTotalRequests));

    // Consumed budget = actual failures - allowed failures
    const allowedFailures = Math.floor(config.targetAvailability * totalRequests);
    const consumedBudget = Math.max(0, failedRequests - (totalRequests - allowedFailures));
    const remainingBudget = Math.max(0, totalBudget - consumedBudget);

    // Calculate burn rate (budget consumed per hour)
    const windowHours = (now - windowStart) / (60 * 60 * 1000);
    const burnRate = windowHours > 0 ? consumedBudget / windowHours : 0;

    // Calculate time to exhaustion
    const _expectedBurnRate = totalBudget / (config.timeWindow / (60 * 60 * 1000));
    const timeToExhaustion = burnRate > 0 
      ? (remainingBudget / burnRate) * (60 * 60 * 1000)
      : null;

    // Determine if exhausted or alert active
    const isExhausted = remainingBudget <= 0;
    const isAlertActive = remainingBudget / totalBudget < config.alertThreshold;

    return {
      serviceName,
      targetAvailability: config.targetAvailability,
      currentAvailability,
      totalBudget,
      remainingBudget,
      consumedBudget,
      burnRate,
      timeToExhaustion,
      windowStart,
      windowEnd: windowStart + config.timeWindow,
      isExhausted,
      isAlertActive,
      totalRequests,
      failedRequests,
      successfulRequests
    };
  }

  /**
   * Get all service statuses
   */
  getAllStatuses(): ErrorBudgetStatus[] {
    const statuses: ErrorBudgetStatus[] = [];
    this.configs.forEach((_, serviceName) => {
      const status = this.getStatus(serviceName);
      if (status) statuses.push(status);
    });
    return statuses;
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(serviceName: string): void {
    const status = this.getStatus(serviceName);
    const config = this.configs.get(serviceName);
    
    if (!status || !config) return;

    const alerts: BudgetAlert[] = [];

    // Check for exhausted budget
    if (status.isExhausted) {
      alerts.push({
        serviceName,
        type: 'budget_exhausted',
        severity: 'critical',
        message: `Error budget exhausted for '${serviceName}'. Availability at ${(status.currentAvailability * 100).toFixed(3)}%`,
        timestamp: Date.now(),
        details: {
          currentAvailability: status.currentAvailability,
          targetAvailability: status.targetAvailability,
          consumedBudget: status.consumedBudget,
          totalBudget: status.totalBudget
        }
      });
    }
    // Check for low budget
    else if (status.isAlertActive) {
      const remainingPercent = (status.remainingBudget / status.totalBudget) * 100;
      alerts.push({
        serviceName,
        type: 'budget_low',
        severity: 'warning',
        message: `Error budget low for '${serviceName}': ${remainingPercent.toFixed(1)}% remaining`,
        timestamp: Date.now(),
        details: {
          remainingBudget: status.remainingBudget,
          totalBudget: status.totalBudget,
          remainingPercent
        }
      });
    }

    // Check for high burn rate
    const expectedBurnRate = status.totalBudget / (config.timeWindow / (60 * 60 * 1000));
    if (status.burnRate > expectedBurnRate * config.burnRateAlertThreshold) {
      alerts.push({
        serviceName,
        type: 'burn_rate_high',
        severity: 'warning',
        message: `High burn rate for '${serviceName}': ${(status.burnRate / expectedBurnRate).toFixed(1)}x normal`,
        timestamp: Date.now(),
        details: {
          burnRate: status.burnRate,
          expectedBurnRate,
          multiplier: status.burnRate / expectedBurnRate,
          timeToExhaustion: status.timeToExhaustion
        }
      });
    }

    // Check for availability drop
    if (status.currentAvailability < config.targetAvailability * 0.95) {
      alerts.push({
        serviceName,
        type: 'availability_drop',
        severity: 'error',
        message: `Availability dropped for '${serviceName}': ${(status.currentAvailability * 100).toFixed(3)}% (target: ${(config.targetAvailability * 100).toFixed(3)}%)`,
        timestamp: Date.now(),
        details: {
          currentAvailability: status.currentAvailability,
          targetAvailability: config.targetAvailability,
          drop: config.targetAvailability - status.currentAvailability
        }
      });
    }

    // Emit alerts
    alerts.forEach(alert => this.emitAlert(alert));
  }

  /**
   * Emit an alert to all registered callbacks
   */
  private emitAlert(alert: BudgetAlert): void {
    const logMethod = alert.severity === 'critical' || alert.severity === 'error' ? 'error' : 
                      alert.severity === 'warning' ? 'warn' : 'info';
    logger[logMethod](`Alert [${alert.serviceName}]: ${alert.message}`);

    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error: unknown) {
        logger.error('Alert callback error:', error);
      }
    });
  }

  /**
   * Register an alert callback
   */
  onAlert(callback: AlertCallback): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Remove an alert callback
   */
  offAlert(callback: AlertCallback): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index !== -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * Get budget health summary
   */
  getHealthSummary(): {
    totalServices: number;
    healthy: number;
    warning: number;
    critical: number;
    exhausted: number;
  } {
    const statuses = this.getAllStatuses();
    
    let healthy = 0;
    let warning = 0;
    let critical = 0;
    let exhausted = 0;

    statuses.forEach(status => {
      if (status.isExhausted) {
        exhausted++;
        critical++;
      } else if (status.isAlertActive) {
        warning++;
      } else if (status.currentAvailability >= status.targetAvailability) {
        healthy++;
      } else {
        warning++;
      }
    });

    return {
      totalServices: statuses.length,
      healthy,
      warning,
      critical,
      exhausted
    };
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Cleanup old records
   */
  private cleanup(): void {
    const now = Date.now();
    
    this.configs.forEach((config, serviceName) => {
      const records = this.records.get(serviceName);
      const windowStart = this.windowStarts.get(serviceName);
      
      if (records && windowStart) {
        // Remove records outside the window
        const cutoff = Math.max(windowStart, now - config.timeWindow);
        const trimmed = records.filter(r => r.timestamp >= cutoff);
        this.records.set(serviceName, trimmed);
      }
    });
  }

  /**
   * Export data for analysis
   */
  exportData(serviceName?: string): {
    configs: SLOConfig[];
    statuses: ErrorBudgetStatus[];
    records: Record<string, BudgetRecord[]>;
  } {
    const configArray = serviceName 
      ? [this.configs.get(serviceName)!].filter(Boolean)
      : Array.from(this.configs.values());
    
    const statusArray = serviceName
      ? [this.getStatus(serviceName)!].filter(Boolean)
      : this.getAllStatuses();

    const recordsObj: Record<string, BudgetRecord[]> = {};
    if (serviceName) {
      const records = this.records.get(serviceName);
      if (records) recordsObj[serviceName] = records;
    } else {
      this.records.forEach((records, name) => {
        recordsObj[name] = records;
      });
    }

    return {
      configs: configArray,
      statuses: statusArray,
      records: recordsObj
    };
  }

  /**
   * Reset all data
   */
  reset(): void {
    this.configs.forEach((_, serviceName) => {
      this.resetWindow(serviceName);
    });
    logger.info('All error budget data reset');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.configs.clear();
    this.records.clear();
    this.windowStarts.clear();
    this.alertCallbacks = [];
    logger.info('Error budget tracker destroyed');
  }
}

// Singleton instance
export const errorBudgetTracker = new ErrorBudgetTracker();

/**
 * Helper function to create an error budget tracked service
 */
export function createTrackedService(
  serviceName: string,
  config: Partial<SLOConfig> & { serviceName: string }
): {
  recordSuccess: (latency?: number) => void;
  recordFailure: (latency?: number) => void;
  getStatus: () => ErrorBudgetStatus | null;
} {
  errorBudgetTracker.registerService(config);

  return {
    recordSuccess: (latency?: number) => errorBudgetTracker.recordRequest(serviceName, true, latency),
    recordFailure: (latency?: number) => errorBudgetTracker.recordRequest(serviceName, false, latency),
    getStatus: () => errorBudgetTracker.getStatus(serviceName)
  };
}
