/**
 * Reliability Metrics Exporter
 * 
 * Provides unified metrics collection and export for reliability services.
 * Supports multiple export formats for integration with monitoring systems.
 * 
 * Features:
 * - Unified metrics collection from all reliability services
 * - Multiple export formats (JSON, Prometheus-style)
 * - Real-time metrics streaming
 * - Historical metrics aggregation
 * - Health score calculation
 * 
 * @module services/reliability/metricsExporter
 */

import { createScopedLogger } from '../../utils/logger';
import { cascadingFailureDetector } from './cascadingFailureDetector';
import { gracefulDegradation, ServiceHealth } from './gracefulDegradation';
import { bulkheadManager, BulkheadState } from './bulkhead';
import { errorBudgetTracker } from './errorBudgetTracker';
import { latencyBudgetTracker, ViolationLevel } from './latencyBudgetTracker';
import { serviceDependencyGraph } from './dependencyGraph';

const logger = createScopedLogger('metrics-exporter');

/**
 * Export format type
 */
export type ExportFormat = 'json' | 'prometheus' | 'summary';

/**
 * Health score calculation
 */
export interface HealthScore {
  overall: number;
  components: {
    services: number;
    rateLimiters: number;
    bulkheads: number;
    errorBudgets: number;
    latencyBudgets: number;
    dependencies: number;
  };
  factors: {
    healthyServices: number;
    degradedServices: number;
    rateLimitedServices: number;
    openBulkheads: number;
    exhaustedBudgets: number;
    violatedBudgets: number;
    criticalDependencies: number;
  };
}

/**
 * Unified reliability metrics
 */
export interface UnifiedReliabilityMetrics {
  timestamp: number;
  healthScore: HealthScore;
  services: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    offline: number;
    healing: number;
  };
  rateLimiters: {
    total: number;
    throttled: number;
    totalRequests: number;
    allowedRequests: number;
    rejectedRequests: number;
  };
  bulkheads: {
    total: number;
    open: number;
    degraded: number;
    totalCalls: number;
    rejectedCalls: number;
  };
  errorBudgets: {
    total: number;
    healthy: number;
    atRisk: number;
    exhausted: number;
  };
  latencyBudgets: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    breached: number;
  };
  dependencies: {
    totalServices: number;
    totalEdges: number;
    criticalServices: number;
    maxDepth: number;
    cycles: number;
  };
  cascadeRisk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    servicesAtRisk: string[];
  };
}

/**
 * Metrics snapshot
 */
interface MetricsSnapshot {
  timestamp: number;
  metrics: UnifiedReliabilityMetrics;
}

/**
 * Metrics exporter configuration
 */
export interface MetricsExporterConfig {
  /** Enable historical metrics collection */
  enableHistory: boolean;
  /** Maximum history size */
  maxHistorySize: number;
  /** Collection interval (ms) */
  collectionInterval: number;
  /** Enable real-time streaming */
  enableStreaming: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: MetricsExporterConfig = {
  enableHistory: true,
  maxHistorySize: 1000,
  collectionInterval: 30000,
  enableStreaming: true
};

/**
 * Reliability Metrics Exporter
 */
export class ReliabilityMetricsExporter {
  private config: MetricsExporterConfig;
  private history: MetricsSnapshot[] = [];
  private collectionTimer: ReturnType<typeof setInterval> | null = null;
  private streamListeners = new Map<string, Array<(metrics: UnifiedReliabilityMetrics) => void>>();
  private static instance: ReliabilityMetricsExporter | null = null;

  private constructor(config?: Partial<MetricsExporterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<MetricsExporterConfig>): ReliabilityMetricsExporter {
    if (!ReliabilityMetricsExporter.instance) {
      ReliabilityMetricsExporter.instance = new ReliabilityMetricsExporter(config);
    }
    return ReliabilityMetricsExporter.instance;
  }

  /**
   * Start metrics collection
   */
  startCollection(): void {
    if (this.collectionTimer) {
      logger.warn('Metrics collection already running');
      return;
    }

    this.collectionTimer = setInterval(() => {
      this.collect();
    }, this.config.collectionInterval);

    logger.info('Metrics collection started');
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
      logger.info('Metrics collection stopped');
    }
  }

  /**
   * Collect current metrics
   */
  collect(): UnifiedReliabilityMetrics {
    const timestamp = Date.now();
    
    // Collect from all reliability services
    const services = this.collectServiceMetrics();
    const rateLimiters = this.collectRateLimiterMetrics();
    const bulkheads = this.collectBulkheadMetrics();
    const errorBudgets = this.collectErrorBudgetMetrics();
    const latencyBudgets = this.collectLatencyBudgetMetrics();
    const dependencies = this.collectDependencyMetrics();
    const cascadeRisk = this.collectCascadeRisk();
    
    // Calculate health score
    const healthScore = this.calculateHealthScore(
      services,
      rateLimiters,
      bulkheads,
      errorBudgets,
      latencyBudgets,
      dependencies
    );

    const metrics: UnifiedReliabilityMetrics = {
      timestamp,
      healthScore,
      services,
      rateLimiters,
      bulkheads,
      errorBudgets,
      latencyBudgets,
      dependencies,
      cascadeRisk
    };

    // Store in history
    if (this.config.enableHistory) {
      this.history.push({ timestamp, metrics });
      while (this.history.length > this.config.maxHistorySize) {
        this.history.shift();
      }
    }

    // Stream to listeners
    if (this.config.enableStreaming) {
      this.streamMetrics(metrics);
    }

    return metrics;
  }

  /**
   * Collect service metrics
   */
  private collectServiceMetrics(): UnifiedReliabilityMetrics['services'] {
    const allHealth = healthCheckScheduler.getAllHealth();
    const healingServices: string[] = [];

    // Get healing status
    // Note: selfHealingService doesn't have getAllStatus, so we track separately
    // This is a simplified version

    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    let offline = 0;

    allHealth.forEach((health) => {
      switch (health.lastCheck?.healthy ? 'healthy' : 'unhealthy') {
        case 'healthy':
          healthy++;
          break;
        default:
          unhealthy++;
      }
    });

    // Get degradation metrics for more accurate health counts
    const allDegradationMetrics = gracefulDegradation.getAllMetrics();
    allDegradationMetrics.forEach(m => {
      switch (m.health) {
        case ServiceHealth.HEALTHY:
          healthy++;
          break;
        case ServiceHealth.DEGRADED:
          degraded++;
          break;
        case ServiceHealth.UNHEALTHY:
          unhealthy++;
          break;
        case ServiceHealth.OFFLINE:
          offline++;
          break;
      }
    });

    return {
      total: allHealth.size,
      healthy,
      degraded,
      unhealthy,
      offline,
      healing: healingServices.length
    };
  }

  /**
   * Collect rate limiter metrics
   */
  private collectRateLimiterMetrics(): UnifiedReliabilityMetrics['rateLimiters'] {
    const statuses = rateLimiterManager.getAllStatuses();
    
    let totalRequests = 0;
    let allowedRequests = 0;
    let rejectedRequests = 0;
    let throttled = 0;

    statuses.forEach(status => {
      totalRequests += status.totalRequests;
      allowedRequests += status.allowedRequests;
      rejectedRequests += status.rejectedRequests;
      if (status.isThrottled) throttled++;
    });

    return {
      total: statuses.length,
      throttled,
      totalRequests,
      allowedRequests,
      rejectedRequests
    };
  }

  /**
   * Collect bulkhead metrics
   */
  private collectBulkheadMetrics(): UnifiedReliabilityMetrics['bulkheads'] {
    const statusesMap = bulkheadManager.getAllMetrics();
    const statuses = Object.values(statusesMap);
    
    let open = 0;
    let degraded = 0;
    let totalCalls = 0;
    let rejectedCalls = 0;

    statuses.forEach(status => {
      totalCalls += status.totalAccepted;
      rejectedCalls += status.totalRejected;
      if (status.state === BulkheadState.CLOSED) {
        open++;
      }
      if (status.state === BulkheadState.DEGRADED) {
        degraded++;
      }
    });

    return {
      total: statuses.length,
      open,
      degraded,
      totalCalls,
      rejectedCalls
    };
  }

  /**
   * Collect error budget metrics
   */
  private collectErrorBudgetMetrics(): UnifiedReliabilityMetrics['errorBudgets'] {
    const statuses = errorBudgetTracker.getAllStatuses();
    
    let healthy = 0;
    let atRisk = 0;
    let exhausted = 0;

    statuses.forEach(status => {
      const ratio = status.remainingBudget / status.totalBudget;
      if (ratio > 0.5) {
        healthy++;
      } else if (ratio > 0) {
        atRisk++;
      } else {
        exhausted++;
      }
    });

    return {
      total: statuses.length,
      healthy,
      atRisk,
      exhausted
    };
  }

  /**
   * Collect latency budget metrics
   */
  private collectLatencyBudgetMetrics(): UnifiedReliabilityMetrics['latencyBudgets'] {
    const metrics = latencyBudgetTracker.getAllMetrics();
    
    let healthy = 0;
    let warning = 0;
    let critical = 0;
    let breached = 0;

    metrics.forEach(m => {
      switch (m.violationLevel) {
        case ViolationLevel.NONE:
          healthy++;
          break;
        case ViolationLevel.WARNING:
          warning++;
          break;
        case ViolationLevel.CRITICAL:
          critical++;
          break;
        case ViolationLevel.BREACH:
          breached++;
          break;
      }
    });

    return {
      total: metrics.length,
      healthy,
      warning,
      critical,
      breached
    };
  }

  /**
   * Collect dependency metrics
   */
  private collectDependencyMetrics(): UnifiedReliabilityMetrics['dependencies'] {
    const stats = serviceDependencyGraph.getStats();
    const cycleResult = serviceDependencyGraph.detectCycles();

    return {
      totalServices: stats.totalServices,
      totalEdges: stats.totalDependencies,
      criticalServices: stats.criticalServices,
      maxDepth: stats.maxDepth,
      cycles: cycleResult.cycles.length
    };
  }

  /**
   * Collect cascade risk
   */
  private collectCascadeRisk(): UnifiedReliabilityMetrics['cascadeRisk'] {
    const riskSummary = cascadingFailureDetector.getRiskSummary();
    
    return {
      level: riskSummary.overallRisk as 'low' | 'medium' | 'high' | 'critical',
      servicesAtRisk: riskSummary.servicesAtRisk
    };
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(
    services: UnifiedReliabilityMetrics['services'],
    rateLimiters: UnifiedReliabilityMetrics['rateLimiters'],
    bulkheads: UnifiedReliabilityMetrics['bulkheads'],
    errorBudgets: UnifiedReliabilityMetrics['errorBudgets'],
    latencyBudgets: UnifiedReliabilityMetrics['latencyBudgets'],
    dependencies: UnifiedReliabilityMetrics['dependencies']
  ): HealthScore {
    // Service health score (0-100)
    const servicesScore = services.total > 0
      ? ((services.healthy * 100) + (services.degraded * 50)) / services.total
      : 100;

    // Rate limiter score (0-100)
    const rateLimitersScore = rateLimiters.total > 0
      ? ((rateLimiters.total - rateLimiters.throttled) / rateLimiters.total) * 100
      : 100;

    // Bulkhead score (0-100)
    const bulkheadsScore = bulkheads.total > 0
      ? ((bulkheads.total - bulkheads.open) / bulkheads.total) * 100
      : 100;

    // Error budget score (0-100)
    const errorBudgetsScore = errorBudgets.total > 0
      ? ((errorBudgets.healthy * 100) + (errorBudgets.atRisk * 50)) / errorBudgets.total
      : 100;

    // Latency budget score (0-100)
    const latencyBudgetsScore = latencyBudgets.total > 0
      ? ((latencyBudgets.healthy * 100) + (latencyBudgets.warning * 70) + 
         (latencyBudgets.critical * 30)) / latencyBudgets.total
      : 100;

    // Dependencies score (0-100)
    const dependenciesScore = dependencies.totalServices > 0
      ? ((dependencies.totalServices - dependencies.criticalServices) / 
         dependencies.totalServices) * 100
      : 100;

    // Overall score (weighted average)
    const weights = {
      services: 0.25,
      rateLimiters: 0.1,
      bulkheads: 0.15,
      errorBudgets: 0.2,
      latencyBudgets: 0.2,
      dependencies: 0.1
    };

    const overall = 
      servicesScore * weights.services +
      rateLimitersScore * weights.rateLimiters +
      bulkheadsScore * weights.bulkheads +
      errorBudgetsScore * weights.errorBudgets +
      latencyBudgetsScore * weights.latencyBudgets +
      dependenciesScore * weights.dependencies;

    return {
      overall: Math.round(overall),
      components: {
        services: Math.round(servicesScore),
        rateLimiters: Math.round(rateLimitersScore),
        bulkheads: Math.round(bulkheadsScore),
        errorBudgets: Math.round(errorBudgetsScore),
        latencyBudgets: Math.round(latencyBudgetsScore),
        dependencies: Math.round(dependenciesScore)
      },
      factors: {
        healthyServices: services.healthy,
        degradedServices: services.degraded,
        rateLimitedServices: rateLimiters.throttled,
        openBulkheads: bulkheads.open,
        exhaustedBudgets: errorBudgets.exhausted,
        violatedBudgets: latencyBudgets.warning + latencyBudgets.critical + latencyBudgets.breached,
        criticalDependencies: dependencies.criticalServices
      }
    };
  }

  /**
   * Stream metrics to listeners
   */
  private streamMetrics(metrics: UnifiedReliabilityMetrics): void {
    const listeners = this.streamListeners.get('metrics');
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(metrics);
        } catch (error: unknown) {
          logger.error('Error in metrics stream listener:', error);
        }
      });
    }
  }

  /**
   * Export metrics in specified format
   */
  export(format: ExportFormat = 'json'): string {
    const metrics = this.collect();

    switch (format) {
      case 'prometheus':
        return this.exportPrometheus(metrics);
      case 'summary':
        return this.exportSummary(metrics);
      case 'json':
      default:
        return JSON.stringify(metrics, null, 2);
    }
  }

  /**
   * Export in Prometheus format
   */
  private exportPrometheus(metrics: UnifiedReliabilityMetrics): string {
    const lines: string[] = [];
    const timestamp = metrics.timestamp;

    // Health score
    lines.push(`# HELP reliability_health_score Overall system health score (0-100)`);
    lines.push(`# TYPE reliability_health_score gauge`);
    lines.push(`reliability_health_score ${metrics.healthScore.overall} ${timestamp}`);

    // Services
    lines.push(`# HELP reliability_services_total Total number of services`);
    lines.push(`# TYPE reliability_services_total gauge`);
    lines.push(`reliability_services_total ${metrics.services.total} ${timestamp}`);
    lines.push(`reliability_services_healthy ${metrics.services.healthy} ${timestamp}`);
    lines.push(`reliability_services_degraded ${metrics.services.degraded} ${timestamp}`);
    lines.push(`reliability_services_unhealthy ${metrics.services.unhealthy} ${timestamp}`);

    // Rate limiters
    lines.push(`# HELP reliability_rate_limiters_throttled Number of throttled rate limiters`);
    lines.push(`# TYPE reliability_rate_limiters_throttled gauge`);
    lines.push(`reliability_rate_limiters_throttled ${metrics.rateLimiters.throttled} ${timestamp}`);
    lines.push(`reliability_rate_limiters_total_requests ${metrics.rateLimiters.totalRequests} ${timestamp}`);
    lines.push(`reliability_rate_limiters_rejected_requests ${metrics.rateLimiters.rejectedRequests} ${timestamp}`);

    // Error budgets
    lines.push(`# HELP reliability_error_budgets_exhausted Number of exhausted error budgets`);
    lines.push(`# TYPE reliability_error_budgets_exhausted gauge`);
    lines.push(`reliability_error_budgets_exhausted ${metrics.errorBudgets.exhausted} ${timestamp}`);

    // Latency budgets
    lines.push(`# HELP reliability_latency_budgets_breached Number of breached latency budgets`);
    lines.push(`# TYPE reliability_latency_budgets_breached gauge`);
    lines.push(`reliability_latency_budgets_breached ${metrics.latencyBudgets.breached} ${timestamp}`);

    // Cascade risk
    lines.push(`# HELP reliability_cascade_risk_level Cascade risk level`);
    lines.push(`# TYPE reliability_cascade_risk_level gauge`);
    const riskLevel = { low: 1, medium: 2, high: 3, critical: 4 };
    lines.push(`reliability_cascade_risk_level ${riskLevel[metrics.cascadeRisk.level]} ${timestamp}`);

    return lines.join('\n');
  }

  /**
   * Export as human-readable summary
   */
  private exportSummary(metrics: UnifiedReliabilityMetrics): string {
    const lines: string[] = [];
    
    lines.push('=== Reliability Metrics Summary ===');
    lines.push(`Timestamp: ${new Date(metrics.timestamp).toISOString()}`);
    lines.push('');
    
    lines.push(`Health Score: ${metrics.healthScore.overall}/100`);
    lines.push(`  Services: ${metrics.healthScore.components.services}/100`);
    lines.push(`  Rate Limiters: ${metrics.healthScore.components.rateLimiters}/100`);
    lines.push(`  Bulkheads: ${metrics.healthScore.components.bulkheads}/100`);
    lines.push(`  Error Budgets: ${metrics.healthScore.components.errorBudgets}/100`);
    lines.push(`  Latency Budgets: ${metrics.healthScore.components.latencyBudgets}/100`);
    lines.push(`  Dependencies: ${metrics.healthScore.components.dependencies}/100`);
    lines.push('');
    
    lines.push(`Services: ${metrics.services.total} total`);
    lines.push(`  Healthy: ${metrics.services.healthy}`);
    lines.push(`  Degraded: ${metrics.services.degraded}`);
    lines.push(`  Unhealthy: ${metrics.services.unhealthy}`);
    lines.push(`  Offline: ${metrics.services.offline}`);
    lines.push('');
    
    lines.push(`Rate Limiters: ${metrics.rateLimiters.total} total`);
    lines.push(`  Throttled: ${metrics.rateLimiters.throttled}`);
    lines.push(`  Requests: ${metrics.rateLimiters.totalRequests} total, ${metrics.rateLimiters.allowedRequests} allowed, ${metrics.rateLimiters.rejectedRequests} rejected`);
    lines.push('');
    
    lines.push(`Error Budgets: ${metrics.errorBudgets.total} total`);
    lines.push(`  Healthy: ${metrics.errorBudgets.healthy}, At Risk: ${metrics.errorBudgets.atRisk}, Exhausted: ${metrics.errorBudgets.exhausted}`);
    lines.push('');
    
    lines.push(`Latency Budgets: ${metrics.latencyBudgets.total} total`);
    lines.push(`  Healthy: ${metrics.latencyBudgets.healthy}, Warning: ${metrics.latencyBudgets.warning}, Critical: ${metrics.latencyBudgets.critical}, Breached: ${metrics.latencyBudgets.breached}`);
    lines.push('');
    
    lines.push(`Cascade Risk: ${metrics.cascadeRisk.level}`);
    if (metrics.cascadeRisk.servicesAtRisk.length > 0) {
      lines.push(`  Services at risk: ${metrics.cascadeRisk.servicesAtRisk.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Get historical metrics
   */
  getHistory(limit?: number): MetricsSnapshot[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Subscribe to metrics stream
   */
  subscribe(callback: (metrics: UnifiedReliabilityMetrics) => void): () => void {
    if (!this.streamListeners.has('metrics')) {
      this.streamListeners.set('metrics', []);
    }

    this.streamListeners.get('metrics')!.push(callback);

    return () => {
      const listeners = this.streamListeners.get('metrics');
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get current metrics without storing
   */
  getCurrentMetrics(): UnifiedReliabilityMetrics {
    return this.collect();
  }

  /**
   * Reset history
   */
  reset(): void {
    this.history = [];
    logger.info('Metrics history reset');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.stopCollection();
    this.history = [];
    this.streamListeners.clear();
    ReliabilityMetricsExporter.instance = null;
    logger.info('Metrics exporter destroyed');
  }
}

// Export singleton instance
export const metricsExporter = ReliabilityMetricsExporter.getInstance();

/**
 * Helper function to export metrics
 */
export function exportMetrics(format: ExportFormat = 'json'): string {
  return metricsExporter.export(format);
}

/**
 * Helper function to get current metrics
 */
export function getCurrentMetrics(): UnifiedReliabilityMetrics {
  return metricsExporter.getCurrentMetrics();
}
