/**
 * Reliability Dashboard Service
 * 
 * Provides a centralized view of all reliability metrics including:
 * - Circuit breaker states
 * - Bulkhead status
 * - Health checks
 * - Error rates
 * - Performance metrics
 * 
 * @module services/reliability/dashboard
 */

import { createScopedLogger } from '../../utils/logger';
import { circuitBreakerMonitor } from '../circuitBreakerMonitor';
import { CircuitBreakerState } from '../integrationResilience';
import { integrationHealthMonitor, integrationMetrics } from '../integrationHealthMonitor';
import { bulkheadManager, BulkheadState } from './bulkhead';
import { IntegrationType } from '../integrationResilience';

const logger = createScopedLogger('reliability-dashboard');

/**
 * Overall system health status
 */
export type SystemHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';

/**
 * Reliability metrics for a single integration
 */
export interface IntegrationReliabilityMetrics {
  name: string;
  type: IntegrationType;
  healthStatus: {
    healthy: boolean;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    lastCheck: number;
  };
  circuitBreaker: {
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    failureRate: number;
  };
  bulkhead: {
    state: BulkheadState;
    activeCalls: number;
    availableSlots: number;
    totalRejected: number;
  };
  performance: {
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    totalOperations: number;
  };
}

/**
 * Overall system reliability summary
 */
export interface SystemReliabilitySummary {
  status: SystemHealthStatus;
  timestamp: number;
  uptime: number;
  integrations: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  circuitBreakers: {
    total: number;
    closed: number;
    open: number;
    halfOpen: number;
  };
  bulkheads: {
    total: number;
    open: number;
    degraded: number;
    closed: number;
    totalActiveCalls: number;
    totalRejected: number;
  };
  performance: {
    avgLatency: number;
    avgErrorRate: number;
    totalOperations: number;
  };
  recommendations: string[];
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Name of the alert */
  name: string;
  /** Condition to check */
  condition: (summary: SystemReliabilitySummary) => boolean;
  /** Severity level */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Message template */
  message: string;
  /** Callback when alert triggers */
  onTrigger?: (summary: SystemReliabilitySummary) => void;
}

/**
 * Alert instance
 */
export interface Alert {
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  triggered: boolean;
}

/**
 * Reliability Dashboard class
 */
export class ReliabilityDashboard {
  private startTime = Date.now();
  private alerts: Alert[] = [];
  private alertConfigs: AlertConfig[] = [];
  private lastSummary: SystemReliabilitySummary | null = null;
  private alertCheckInterval?: ReturnType<typeof setInterval>;
  private readonly maxAlertHistory = 100;

  constructor() {
    this.setupDefaultAlerts();
  }

  /**
   * Setup default alert configurations
   */
  private setupDefaultAlerts(): void {
    this.alertConfigs = [
      {
        name: 'circuit_breaker_open',
        condition: (summary) => summary.circuitBreakers.open > 0,
        severity: 'error',
        message: '${count} circuit breaker(s) are OPEN, indicating service failures',
        onTrigger: (summary) => {
          logger.error(`Alert: ${summary.circuitBreakers.open} circuit breakers are OPEN`);
        }
      },
      {
        name: 'high_error_rate',
        condition: (summary) => summary.performance.avgErrorRate > 0.1,
        severity: 'warning',
        message: 'System error rate is ${rate}%, exceeding 10% threshold',
        onTrigger: (summary) => {
          logger.warn(`High error rate detected: ${(summary.performance.avgErrorRate * 100).toFixed(1)}%`);
        }
      },
      {
        name: 'bulkhead_rejections',
        condition: (summary) => summary.bulkheads.totalRejected > 100,
        severity: 'warning',
        message: 'High bulkhead rejections: ${count} calls rejected',
        onTrigger: (summary) => {
          logger.warn(`High bulkhead rejection count: ${summary.bulkheads.totalRejected}`);
        }
      },
      {
        name: 'system_unhealthy',
        condition: (summary) => summary.status === 'unhealthy' || summary.status === 'critical',
        severity: 'critical',
        message: 'System health status is ${status}',
        onTrigger: (summary) => {
          logger.error(`System health critical: ${summary.status}`);
        }
      },
      {
        name: 'all_circuit_breakers_open',
        condition: (summary) => 
          summary.circuitBreakers.total > 0 && 
          summary.circuitBreakers.open === summary.circuitBreakers.total,
        severity: 'critical',
        message: 'All circuit breakers are OPEN - system is in full failure mode',
        onTrigger: () => {
          logger.error('CRITICAL: All circuit breakers are OPEN');
        }
      }
    ];
  }

  /**
   * Get reliability metrics for a specific integration
   */
  getIntegrationMetrics(name: string, type: IntegrationType): IntegrationReliabilityMetrics {
    const healthStatus = integrationHealthMonitor.getHealthStatus(type, name);
    const circuitBreakerMetrics = circuitBreakerMonitor.getHealthStatus(name);
    const bulkhead = bulkheadManager.get(name);
    const performanceMetrics = integrationMetrics.getMetrics(name);

    return {
      name,
      type,
      healthStatus: {
        healthy: healthStatus.healthy,
        consecutiveFailures: healthStatus.consecutiveFailures,
        consecutiveSuccesses: healthStatus.consecutiveSuccesses,
        lastCheck: healthStatus.lastCheck
      },
      circuitBreaker: {
        state: circuitBreakerMetrics.circuitBreakerState,
        failures: circuitBreakerMetrics.consecutiveFailures,
        successes: circuitBreakerMetrics.consecutiveSuccesses,
        failureRate: circuitBreakerMetrics.errorRate
      },
      bulkhead: {
        state: bulkhead?.getState() || BulkheadState.OPEN,
        activeCalls: bulkhead?.getMetrics().activeCalls || 0,
        availableSlots: bulkhead?.getMetrics().availableSlots || 0,
        totalRejected: bulkhead?.getMetrics().totalRejected || 0
      },
      performance: {
        avgLatency: performanceMetrics.avgLatency,
        p95Latency: performanceMetrics.p95Latency,
        p99Latency: performanceMetrics.p99Latency,
        errorRate: performanceMetrics.errorRate,
        totalOperations: performanceMetrics.count
      }
    };
  }

  /**
   * Calculate overall system health status
   */
  private calculateSystemStatus(summary: Omit<SystemReliabilitySummary, 'status'>): SystemHealthStatus {
    // Critical conditions
    if (
      summary.circuitBreakers.total > 0 &&
      summary.circuitBreakers.open === summary.circuitBreakers.total
    ) {
      return 'critical';
    }

    if (summary.performance.avgErrorRate > 0.5) {
      return 'critical';
    }

    // Unhealthy conditions
    if (
      summary.integrations.unhealthy > summary.integrations.total / 2 ||
      summary.circuitBreakers.open > summary.circuitBreakers.total / 2
    ) {
      return 'unhealthy';
    }

    if (summary.performance.avgErrorRate > 0.25) {
      return 'unhealthy';
    }

    // Degraded conditions
    if (
      summary.integrations.degraded > 0 ||
      summary.circuitBreakers.open > 0 ||
      summary.bulkheads.closed > 0 ||
      summary.performance.avgErrorRate > 0.1
    ) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Generate recommendations based on current state
   */
  private generateRecommendations(summary: SystemReliabilitySummary): string[] {
    const recommendations: string[] = [];

    // Circuit breaker recommendations
    if (summary.circuitBreakers.open > 0) {
      recommendations.push(
        `${summary.circuitBreakers.open} circuit breaker(s) are open. ` +
        `Check upstream service health and consider resetting if issues are resolved.`
      );
    }

    // Bulkhead recommendations
    if (summary.bulkheads.closed > 0 || summary.bulkheads.totalRejected > 50) {
      recommendations.push(
        `High bulkhead utilization detected. ` +
        `Consider increasing max concurrent calls or optimizing slow operations.`
      );
    }

    // Error rate recommendations
    if (summary.performance.avgErrorRate > 0.05) {
      recommendations.push(
        `Error rate is ${(summary.performance.avgErrorRate * 100).toFixed(1)}%. ` +
        `Review recent errors and consider implementing additional fallback strategies.`
      );
    }

    // Latency recommendations
    if (summary.performance.avgLatency > 1000) {
      recommendations.push(
        `Average latency is ${summary.performance.avgLatency.toFixed(0)}ms. ` +
        `Consider caching strategies or performance optimization.`
      );
    }

    // Health check recommendations
    if (summary.integrations.unhealthy > 0) {
      recommendations.push(
        `${summary.integrations.unhealthy} integration(s) are unhealthy. ` +
        `Check connectivity and service availability.`
      );
    }

    return recommendations;
  }

  /**
   * Get full system reliability summary
   */
  getSystemSummary(): SystemReliabilitySummary {
    const healthSummary = integrationHealthMonitor.getSummary();
    const cbSummary = circuitBreakerMonitor.getSummary();
    const bulkheadSummary = bulkheadManager.getSummary();

    // Get all performance metrics
    const allMetrics = integrationMetrics.getAllMetrics();
    const metricsValues = Object.values(allMetrics);

    const avgLatency = metricsValues.length > 0
      ? metricsValues.reduce((sum, m) => sum + m.avgLatency, 0) / metricsValues.length
      : 0;

    const avgErrorRate = metricsValues.length > 0
      ? metricsValues.reduce((sum, m) => sum + m.errorRate, 0) / metricsValues.length
      : 0;

    const totalOperations = metricsValues.reduce((sum, m) => sum + m.count, 0);

    const summary: SystemReliabilitySummary = {
      status: 'healthy',
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      integrations: {
        total: healthSummary.total,
        healthy: healthSummary.healthy,
        degraded: 0, // Will be calculated
        unhealthy: healthSummary.unhealthy
      },
      circuitBreakers: {
        total: cbSummary.totalIntegrations,
        closed: cbSummary.healthy,
        open: cbSummary.unhealthy,
        halfOpen: 0 // Will be calculated from metrics
      },
      bulkheads: {
        total: bulkheadSummary.total,
        open: bulkheadSummary.open,
        degraded: bulkheadSummary.degraded,
        closed: bulkheadSummary.closed,
        totalActiveCalls: bulkheadSummary.totalActiveCalls,
        totalRejected: bulkheadSummary.totalRejected
      },
      performance: {
        avgLatency,
        avgErrorRate,
        totalOperations
      },
      recommendations: []
    };

    // Calculate degraded integrations
    summary.integrations.degraded = summary.integrations.total - 
      summary.integrations.healthy - summary.integrations.unhealthy;

    // Calculate half-open circuit breakers
    const allCbMetrics = circuitBreakerMonitor.getAllMetrics();
    Object.values(allCbMetrics).forEach(metrics => {
      if (metrics.state === CircuitBreakerState.HALF_OPEN) {
        summary.circuitBreakers.halfOpen++;
        summary.circuitBreakers.closed--; // Adjust since healthy includes closed only
      }
    });

    // Calculate overall status
    summary.status = this.calculateSystemStatus(summary);

    // Generate recommendations
    summary.recommendations = this.generateRecommendations(summary);

    // Store for alert checking
    this.lastSummary = summary;

    return summary;
  }

  /**
   * Check all alert conditions
   */
  checkAlerts(): Alert[] {
    if (!this.lastSummary) {
      this.getSystemSummary();
    }

    const triggeredAlerts: Alert[] = [];

    this.alertConfigs.forEach(config => {
      const triggered = config.condition(this.lastSummary!);

      if (triggered) {
        const alert: Alert = {
          name: config.name,
          severity: config.severity,
          message: config.message
            .replace('${count}', String(
              config.name.includes('circuit') 
                ? this.lastSummary!.circuitBreakers.open 
                : this.lastSummary!.bulkheads.totalRejected
            ))
            .replace('${rate}', String((this.lastSummary!.performance.avgErrorRate * 100).toFixed(1)))
            .replace('${status}', this.lastSummary!.status),
          timestamp: Date.now(),
          triggered: true
        };

        triggeredAlerts.push(alert);
        this.alerts.push(alert);
        config.onTrigger?.(this.lastSummary!);
      }
    });

    // Trim alert history
    if (this.alerts.length > this.maxAlertHistory) {
      this.alerts = this.alerts.slice(-this.maxAlertHistory);
    }

    return triggeredAlerts;
  }

  /**
   * Start periodic alert checking
   */
  startAlertMonitoring(intervalMs: number = 30000): void {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }

    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts();
    }, intervalMs);

    logger.info(`Alert monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop alert monitoring
   */
  stopAlertMonitoring(): void {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = undefined;
      logger.info('Alert monitoring stopped');
    }
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): Alert[] {
    return limit ? this.alerts.slice(-limit) : [...this.alerts];
  }

  /**
   * Add custom alert configuration
   */
  addAlertConfig(config: AlertConfig): void {
    this.alertConfigs.push(config);
    logger.info(`Custom alert '${config.name}' added`);
  }

  /**
   * Get health check endpoint response
   */
  getHealthCheckResponse(): {
    status: SystemHealthStatus;
    timestamp: number;
    version: string;
    uptime: number;
    checks: {
      integrations: { status: string; details: Record<string, unknown> };
      circuitBreakers: { status: string; details: Record<string, unknown> };
      bulkheads: { status: string; details: Record<string, unknown> };
    };
  } {
    const summary = this.getSystemSummary();

    return {
      status: summary.status,
      timestamp: summary.timestamp,
      version: '1.0.0',
      uptime: summary.uptime,
      checks: {
        integrations: {
          status: summary.integrations.unhealthy > 0 ? 'unhealthy' : 'healthy',
          details: {
            total: summary.integrations.total,
            healthy: summary.integrations.healthy,
            unhealthy: summary.integrations.unhealthy
          }
        },
        circuitBreakers: {
          status: summary.circuitBreakers.open > 0 ? 'unhealthy' : 'healthy',
          details: {
            total: summary.circuitBreakers.total,
            open: summary.circuitBreakers.open,
            halfOpen: summary.circuitBreakers.halfOpen
          }
        },
        bulkheads: {
          status: summary.bulkheads.closed > 0 ? 'degraded' : 'healthy',
          details: {
            total: summary.bulkheads.total,
            activeCalls: summary.bulkheads.totalActiveCalls,
            rejected: summary.bulkheads.totalRejected
          }
        }
      }
    };
  }

  /**
   * Reset dashboard state
   */
  reset(): void {
    this.startTime = Date.now();
    this.alerts = [];
    this.lastSummary = null;
    logger.info('Reliability dashboard reset');
  }
}

// Singleton instance
export const reliabilityDashboard = new ReliabilityDashboard();

// Auto-start alert monitoring in production
if (import.meta.env.PROD) {
  reliabilityDashboard.startAlertMonitoring(30000);
}
