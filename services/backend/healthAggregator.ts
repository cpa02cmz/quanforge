/**
 * Backend Health Aggregator
 * 
 * Provides unified health aggregation across all backend services with:
 * - Service health rollup
 * - Dependency health tracking
 * - Health score calculation
 * - Alert generation based on health thresholds
 * - Historical health trends
 * - Real-time health monitoring
 * 
 * @module services/backend/healthAggregator
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../utils/logger';
import { backendServiceRegistry } from './serviceRegistry';
import { requestContextManager } from './requestContext';
import { backendRateLimiter } from './rateLimiter';

const logger = createScopedLogger('HealthAggregator');

/**
 * Health status level
 */
export type HealthLevel = 'healthy' | 'degraded' | 'unhealthy' | 'critical' | 'unknown';

/**
 * Service health info
 */
export interface ServiceHealthInfo {
  name: string;
  status: HealthLevel;
  score: number; // 0-100
  latency: number;
  uptime: number;
  errorRate: number;
  throughput: number;
  lastCheck: number;
  message?: string;
  dependencies: string[];
}

/**
 * Aggregated health report
 */
export interface AggregatedHealthReport {
  timestamp: number;
  overallStatus: HealthLevel;
  overallScore: number;
  criticalServicesDown: number;
  services: ServiceHealthInfo[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    critical: number;
    unknown: number;
  };
  recommendations: HealthRecommendation[];
  alerts: HealthAlert[];
  trends: HealthTrends;
}

/**
 * Health recommendation
 */
export interface HealthRecommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  service: string;
  category: 'performance' | 'availability' | 'dependency' | 'capacity';
  description: string;
  action: string;
}

/**
 * Health alert
 */
export interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  service: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

/**
 * Health trends
 */
export interface HealthTrends {
  latencyTrend: 'improving' | 'stable' | 'degrading';
  errorTrend: 'improving' | 'stable' | 'degrading';
  availabilityTrend: 'improving' | 'stable' | 'degrading';
  healthScoreHistory: { timestamp: number; score: number }[];
}

/**
 * Health threshold configuration
 */
export interface HealthThresholds {
  latencyHealthy: number; // ms
  latencyDegraded: number; // ms
  errorRateHealthy: number; // 0-1
  errorRateDegraded: number; // 0-1
  uptimeHealthy: number; // 0-1
  uptimeDegraded: number; // 0-1
  throughputMin: number; // req/s
}

/**
 * Default health thresholds
 */
export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  latencyHealthy: 100,
  latencyDegraded: 500,
  errorRateHealthy: 0.01,
  errorRateDegraded: 0.05,
  uptimeHealthy: 0.99,
  uptimeDegraded: 0.95,
  throughputMin: 1,
};

/**
 * Backend Health Aggregator
 * 
 * Singleton class that aggregates health information across all backend services.
 */
export class BackendHealthAggregator {
  private static instance: BackendHealthAggregator | null = null;

  private thresholds: HealthThresholds;
  private healthHistory: Map<string, { timestamp: number; score: number }[]> = new Map();
  private alerts: HealthAlert[] = [];
  private maxAlerts: number = 100;
  private maxHistoryPerService: number = 100;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(report: AggregatedHealthReport) => void> = new Set();

  private lastReport: AggregatedHealthReport | null = null;

  private constructor(thresholds: Partial<HealthThresholds> = {}) {
    this.thresholds = { ...DEFAULT_HEALTH_THRESHOLDS, ...thresholds };
    this.startMonitoring();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(thresholds?: Partial<HealthThresholds>): BackendHealthAggregator {
    if (!BackendHealthAggregator.instance) {
      BackendHealthAggregator.instance = new BackendHealthAggregator(thresholds);
    }
    return BackendHealthAggregator.instance;
  }

  /**
   * Get aggregated health report
   */
  getAggregatedHealth(): AggregatedHealthReport {
    const services = this.collectServiceHealth();
    const summary = this.calculateSummary(services);
    const overallScore = this.calculateOverallScore(services);
    const overallStatus = this.determineOverallStatus(summary, overallScore);
    const recommendations = this.generateRecommendations(services);
    const trends = this.calculateTrends();

    const report: AggregatedHealthReport = {
      timestamp: Date.now(),
      overallStatus,
      overallScore,
      criticalServicesDown: summary.critical,
      services,
      summary,
      recommendations,
      alerts: this.alerts.slice(-20),
      trends,
    };

    this.lastReport = report;
    this.notifyListeners(report);

    return report;
  }

  /**
   * Get health for a specific service
   */
  getServiceHealth(serviceName: string): ServiceHealthInfo | null {
    const allServices = this.collectServiceHealth();
    return allServices.find(s => s.name === serviceName) || null;
  }

  /**
   * Get current alerts
   */
  getAlerts(filter?: { severity?: HealthAlert['severity']; service?: string }): HealthAlert[] {
    let filtered = [...this.alerts];

    if (filter) {
      if (filter.severity) {
        filtered = filtered.filter(a => a.severity === filter.severity);
      }
      if (filter.service) {
        filtered = filtered.filter(a => a.service === filter.service);
      }
    }

    return filtered;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledgedAlerts(): number {
    const initialCount = this.alerts.length;
    this.alerts = this.alerts.filter(a => !a.acknowledged);
    return initialCount - this.alerts.length;
  }

  /**
   * Subscribe to health reports
   */
  subscribe(listener: (report: AggregatedHealthReport) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get last report
   */
  getLastReport(): AggregatedHealthReport | null {
    return this.lastReport;
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<HealthThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.log('Health thresholds updated');
  }

  /**
   * Force a health check
   */
  async forceHealthCheck(): Promise<AggregatedHealthReport> {
    // Trigger health checks in registry
    await backendServiceRegistry.checkAllServicesHealth();
    return this.getAggregatedHealth();
  }

  // Private methods

  private collectServiceHealth(): ServiceHealthInfo[] {
    const services: ServiceHealthInfo[] = [];
    const registryServices = backendServiceRegistry.getAllServices();

    for (const service of registryServices) {
      const serviceStats = requestContextManager.getServiceStats(service.config.name);
      const rateLimitStatus = backendRateLimiter.getStatus(service.config.name);

      // Calculate health metrics
      const totalRequests = serviceStats.totalRequests;
      const errorRate = totalRequests > 0 
        ? serviceStats.failedRequests / totalRequests 
        : 0;
      
      const uptime = (service.uptime + service.downtime) > 0
        ? service.uptime / (service.uptime + service.downtime)
        : 1;

      const throughput = rateLimitStatus
        ? rateLimitStatus.allowedRequests / ((Date.now() - rateLimitStatus.lastRefillTime) / 1000 || 1)
        : 0;

      const healthInfo: ServiceHealthInfo = {
        name: service.config.name,
        status: this.mapStatusToHealthLevel(service.status),
        score: this.calculateServiceScore(service.averageResponseTime, errorRate, uptime),
        latency: service.averageResponseTime,
        uptime: uptime * 100,
        errorRate,
        throughput,
        lastCheck: service.lastHealthCheck || Date.now(),
        message: this.getServiceMessage(service.status),
        dependencies: service.config.dependencies || [],
      };

      // Store history
      this.storeHealthHistory(service.config.name, healthInfo.score);

      services.push(healthInfo);
    }

    return services;
  }

  private mapStatusToHealthLevel(status: string): HealthLevel {
    switch (status) {
      case 'healthy': return 'healthy';
      case 'degraded': return 'degraded';
      case 'unhealthy': return 'unhealthy';
      case 'stopped': return 'critical';
      default: return 'unknown';
    }
  }

  private calculateServiceScore(latency: number, errorRate: number, uptime: number): number {
    let score = 100;

    // Latency scoring (up to -30 points)
    if (latency > this.thresholds.latencyDegraded) {
      score -= 30;
    } else if (latency > this.thresholds.latencyHealthy) {
      score -= 15 * (latency - this.thresholds.latencyHealthy) / 
                (this.thresholds.latencyDegraded - this.thresholds.latencyHealthy);
    }

    // Error rate scoring (up to -40 points)
    if (errorRate > this.thresholds.errorRateDegraded) {
      score -= 40;
    } else if (errorRate > this.thresholds.errorRateHealthy) {
      score -= 20 * (errorRate - this.thresholds.errorRateHealthy) / 
                (this.thresholds.errorRateDegraded - this.thresholds.errorRateHealthy);
    }

    // Uptime scoring (up to -30 points)
    if (uptime < this.thresholds.uptimeDegraded) {
      score -= 30;
    } else if (uptime < this.thresholds.uptimeHealthy) {
      score -= 15 * (this.thresholds.uptimeHealthy - uptime) / 
                (this.thresholds.uptimeHealthy - this.thresholds.uptimeDegraded);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateSummary(services: ServiceHealthInfo[]) {
    const summary = {
      total: services.length,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      critical: 0,
      unknown: 0,
    };

    for (const service of services) {
      switch (service.status) {
        case 'healthy': summary.healthy++; break;
        case 'degraded': summary.degraded++; break;
        case 'unhealthy': summary.unhealthy++; break;
        case 'critical': summary.critical++; break;
        default: summary.unknown++; break;
      }
    }

    return summary;
  }

  private calculateOverallScore(services: ServiceHealthInfo[]): number {
    if (services.length === 0) return 100;

    // Weighted average with penalty for critical services
    let totalWeight = 0;
    let weightedScore = 0;

    for (const service of services) {
      const weight = service.status === 'critical' ? 3 : 
                     service.status === 'unhealthy' ? 2 : 1;
      totalWeight += weight;
      weightedScore += service.score * weight;
    }

    return Math.round(weightedScore / totalWeight);
  }

  private determineOverallStatus(summary: ReturnType<typeof this.calculateSummary>, score: number): HealthLevel {
    if (summary.critical > 0) return 'critical';
    if (summary.unhealthy > 0 || score < 50) return 'unhealthy';
    if (summary.degraded > 0 || score < 80) return 'degraded';
    if (summary.unknown > summary.total / 2) return 'unknown';
    return 'healthy';
  }

  private generateRecommendations(services: ServiceHealthInfo[]): HealthRecommendation[] {
    const recommendations: HealthRecommendation[] = [];

    for (const service of services) {
      // Latency recommendations
      if (service.latency > this.thresholds.latencyDegraded) {
        recommendations.push({
          id: `rec_${service.name}_latency`,
          priority: service.status === 'critical' ? 'critical' : 'high',
          service: service.name,
          category: 'performance',
          description: `High latency detected (${service.latency.toFixed(0)}ms)`,
          action: 'Consider adding caching, optimizing queries, or scaling horizontally',
        });
      }

      // Error rate recommendations
      if (service.errorRate > this.thresholds.errorRateDegraded) {
        recommendations.push({
          id: `rec_${service.name}_errors`,
          priority: 'critical',
          service: service.name,
          category: 'availability',
          description: `High error rate (${(service.errorRate * 100).toFixed(1)}%)`,
          action: 'Review error logs, check dependencies, and implement better error handling',
        });
      }

      // Uptime recommendations
      if (service.uptime < this.thresholds.uptimeDegraded * 100) {
        recommendations.push({
          id: `rec_${service.name}_uptime`,
          priority: 'high',
          service: service.name,
          category: 'availability',
          description: `Low uptime (${service.uptime.toFixed(1)}%)`,
          action: 'Investigate service instability and consider implementing failover',
        });
      }

      // Dependency recommendations
      if (service.dependencies.length > 0 && service.status !== 'healthy') {
        recommendations.push({
          id: `rec_${service.name}_deps`,
          priority: 'medium',
          service: service.name,
          category: 'dependency',
          description: `Service depends on: ${service.dependencies.join(', ')}`,
          action: 'Check dependency health and implement fallback strategies',
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private calculateTrends(): HealthTrends {
    const allScores: { timestamp: number; score: number }[] = [];

    for (const history of this.healthHistory.values()) {
      allScores.push(...history);
    }

    allScores.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate trends based on recent history
    const recentScores = allScores.slice(-10);
    const olderScores = allScores.slice(-20, -10);

    const recentAvg = this.average(recentScores.map(s => s.score));
    const olderAvg = this.average(olderScores.map(s => s.score));

    const latencyTrend = this.determineTrend(olderAvg, recentAvg, 5);
    const errorTrend = this.determineTrend(olderAvg, recentAvg, 5);
    const availabilityTrend = this.determineTrend(olderAvg, recentAvg, 5);

    return {
      latencyTrend,
      errorTrend,
      availabilityTrend,
      healthScoreHistory: allScores.slice(-50),
    };
  }

  private determineTrend(older: number, newer: number, threshold: number): 'improving' | 'stable' | 'degrading' {
    const diff = newer - older;
    if (diff > threshold) return 'improving';
    if (diff < -threshold) return 'degrading';
    return 'stable';
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private storeHealthHistory(serviceName: string, score: number): void {
    const history = this.healthHistory.get(serviceName) || [];
    history.push({ timestamp: Date.now(), score });

    if (history.length > this.maxHistoryPerService) {
      history.shift();
    }

    this.healthHistory.set(serviceName, history);
  }

  private getServiceMessage(status: string): string {
    switch (status) {
      case 'healthy': return 'Service is operating normally';
      case 'degraded': return 'Service is experiencing issues';
      case 'unhealthy': return 'Service is not responding correctly';
      case 'stopped': return 'Service is stopped';
      default: return 'Service status unknown';
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const report = this.getAggregatedHealth();

      // Generate alerts based on report
      if (report.overallStatus === 'critical') {
        this.createAlert('critical', 'system', 'System health is critical - immediate attention required');
      } else if (report.overallStatus === 'unhealthy') {
        this.createAlert('error', 'system', 'System health is degraded');
      }

      // Check individual services
      for (const service of report.services) {
        if (service.status === 'critical') {
          this.createAlert('critical', service.name, `Service ${service.name} is critical`);
        } else if (service.status === 'unhealthy') {
          this.createAlert('error', service.name, `Service ${service.name} is unhealthy`);
        }
      }
    }, 30000); // Every 30 seconds
  }

  private createAlert(severity: HealthAlert['severity'], service: string, message: string): void {
    // Check for duplicate recent alerts
    const recentDuplicate = this.alerts.find(
      a => a.service === service && 
           a.message === message && 
           !a.acknowledged &&
           Date.now() - a.timestamp < 300000 // 5 minutes
    );

    if (recentDuplicate) return;

    const alert: HealthAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      severity,
      service,
      message,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.push(alert);

    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }

    logger.warn(`Health alert: [${severity}] ${service}: ${message}`);
  }

  private notifyListeners(report: AggregatedHealthReport): void {
    this.listeners.forEach(listener => {
      try {
        listener(report);
      } catch (error) {
        logger.warn('Error in health report listener:', error);
      }
    });
  }

  /**
   * Cleanup and destroy the aggregator
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.healthHistory.clear();
    this.alerts = [];
    this.listeners.clear();

    BackendHealthAggregator.instance = null;
    logger.log('Health aggregator destroyed');
  }
}

// Export singleton instance
export const backendHealthAggregator = BackendHealthAggregator.getInstance();

/**
 * Helper function to get backend health
 */
export function getBackendHealthReport(): AggregatedHealthReport {
  return backendHealthAggregator.getAggregatedHealth();
}

/**
 * Helper function to check if backend is healthy
 */
export function isBackendHealthy(): boolean {
  const report = backendHealthAggregator.getLastReport();
  return report?.overallStatus === 'healthy' || report?.overallStatus === 'degraded';
}
