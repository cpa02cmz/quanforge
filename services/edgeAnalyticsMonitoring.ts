/**
 * Consolidated Edge Analytics & Monitoring Service
 * Merges functionality from edgeMonitoring.ts and edgeAnalytics.ts
 * Provides unified edge deployment monitoring, analytics, and performance tracking
 */

import { EventMetadata } from '../types/common';

interface EdgeMonitorConfig {
  enableRealTimeMonitoring: boolean;
  enableHealthChecks: boolean;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  enableUserBehaviorTracking: boolean;
  sampleRate: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  notificationChannels: ('console' | 'webhook' | 'email')[];
  webhookUrl: string | undefined;
  emailRecipients: string[] | undefined;
  endpoint: string | undefined;
}

import { EventMetadata, PerformanceMetrics } from '../types/common';

interface HealthCheckResult {
  endpoint: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: number;
  region: string;
  error?: string;
  metadata?: EventMetadata;
}

interface EdgeMetrics {
  timestamp: number;
  region: string;
  endpoint: string;
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  bandwidthUsage: number;
  userAgent: string;
  url: string;
  loadTime: number;
  renderTime: number;
  userInteractions: number;
}

interface UserBehaviorEvent {
  type: string;
  target: string;
  timestamp: number;
  metadata?: EventMetadata;
}

interface UserBehaviorData {
  sessionId: string;
  userId?: string;
  events: UserBehaviorEvent[];
  pageViews: number;
  timeOnPage: number;
  bounceRate: number;
}

interface PerformanceData {
  coreWebVitals: {
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
    fcp: number; // First Contentful Paint
    ttfb: number; // Time to First Byte
  };
  resourceTiming: Array<{
    name: string;
    duration: number;
    size: number;
    cached: boolean;
  }>;
}

interface Alert {
  id: string;
  type: 'performance' | 'availability' | 'error' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  region: string;
  resolved: boolean;
  metadata?: EventMetadata;
}

class EdgeAnalyticsMonitoring {
  private static instance: EdgeAnalyticsMonitoring;
  private config: EdgeMonitorConfig = {
    enableRealTimeMonitoring: true,
    enableHealthChecks: true,
    enablePerformanceTracking: true,
    enableErrorTracking: true,
    enableUserBehaviorTracking: true,
    sampleRate: 0.1,
    alertThresholds: {
      responseTime: 1000,
      errorRate: 0.05,
      memoryUsage: 80,
      cpuUsage: 80,
    },
    notificationChannels: ['console'],
    webhookUrl: undefined,
    emailRecipients: undefined,
    endpoint: undefined,
  };

  private metrics: EdgeMetrics[] = [];
  private alerts: Alert[] = [];
  private healthChecks: Map<string, HealthCheckResult[]> = new Map();
  private userData: Map<string, UserBehaviorData> = new Map();
  private monitoringInterval: number | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.startMonitoring();
    }
  }

  static getInstance(): EdgeAnalyticsMonitoring {
    if (!EdgeAnalyticsMonitoring.instance) {
      EdgeAnalyticsMonitoring.instance = new EdgeAnalyticsMonitoring();
    }
    return EdgeAnalyticsMonitoring.instance;
  }

  startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = window.setInterval(() => {
      if (this.config.enableRealTimeMonitoring) {
        this.collectMetrics();
      }
      if (this.config.enableHealthChecks) {
        this.performHealthChecks();
      }
      this.checkAlerts();
    }, 30000); // Every 30 seconds
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private collectMetrics(): void {
    if (!((navigator as any).connection)) return;

    const performanceOpt = (window as any).performance;
    const memoryOpt = (window as any).performance?.memory;

    const metric: EdgeMetrics = {
      timestamp: Date.now(),
      region: this.detectRegion(),
      endpoint: window.location.pathname,
      responseTime: 0, // Would be populated by actual measurements
      throughput: 0, // Would be calculated from request data
      errorRate: 0, // Would be calculated from error tracking
      memoryUsage: memoryOpt ? memoryOpt.usedJSHeapSize / memoryOpt.totalJSHeapSize * 100 : 0,
      cpuUsage: 0, // Requires performance observer
      cacheHitRate: 0, // Would be calculated from cache metrics
      bandwidthUsage: this.getBandwidthUsage(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      loadTime: performanceOpt?.timing?.loadEventEnd - performanceOpt?.timing?.navigationStart || 0,
      renderTime: this.getRenderTime(),
      userInteractions: this.getUserInteractionCount(),
    };

    this.metrics.push(metric);
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    if (Math.random() < this.config.sampleRate && this.config.endpoint) {
      this.sendMetrics(metric);
    }
  }

  private performHealthChecks(): void {
    const endpoints = [window.location.origin];
    
    endpoints.forEach(async endpoint => {
      const result = await this.checkEndpointHealth(endpoint);
      const region = this.detectRegion();
      
      if (!this.healthChecks.has(region)) {
        this.healthChecks.set(region, []);
      }
      
      const checks = this.healthChecks.get(region)!;
      checks.push(result);
      
      // Keep only last 100 checks per region
      if (checks.length > 100) {
        checks.splice(0, checks.length - 100);
      }
    });
  }

  private async checkEndpointHealth(endpoint: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        cache: 'no-cache',
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint,
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime,
        timestamp: Date.now(),
        region: this.detectRegion(),
        metadata: {
          status: response.status,
          statusText: response.statusText,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint,
        status: 'unhealthy',
        responseTime,
        timestamp: Date.now(),
        region: this.detectRegion(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkAlerts(): void {
    if (this.metrics.length === 0) return;

    const latest = this.metrics[this.metrics.length - 1];
    const alerts: Alert[] = [];

    // Check response time threshold
    if (latest.responseTime > this.config.alertThresholds.responseTime) {
      alerts.push({
        id: `response-time-${Date.now()}`,
        type: 'performance',
        severity: latest.responseTime > this.config.alertThresholds.responseTime * 2 ? 'critical' : 'high',
        message: `Response time (${latest.responseTime}ms) exceeds threshold (${this.config.alertThresholds.responseTime}ms)`,
        timestamp: Date.now(),
        region: latest.region,
        resolved: false,
        metadata: { responseTime: latest.responseTime, threshold: this.config.alertThresholds.responseTime },
      });
    }

    // Check error rate threshold
    if (latest.errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        id: `error-rate-${Date.now()}`,
        type: 'error',
        severity: latest.errorRate > this.config.alertThresholds.errorRate * 2 ? 'critical' : 'high',
        message: `Error rate (${(latest.errorRate * 100).toFixed(2)}%) exceeds threshold (${(this.config.alertThresholds.errorRate * 100).toFixed(2)}%)`,
        timestamp: Date.now(),
        region: latest.region,
        resolved: false,
        metadata: { errorRate: latest.errorRate, threshold: this.config.alertThresholds.errorRate },
      });
    }

    // Check memory usage threshold
    if (latest.memoryUsage > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        id: `memory-usage-${Date.now()}`,
        type: 'resource',
        severity: latest.memoryUsage > this.config.alertThresholds.memoryUsage * 1.2 ? 'critical' : 'medium',
        message: `Memory usage (${latest.memoryUsage.toFixed(2)}%) exceeds threshold (${this.config.alertThresholds.memoryUsage}%)`,
        timestamp: Date.now(),
        region: latest.region,
        resolved: false,
        metadata: { memoryUsage: latest.memoryUsage, threshold: this.config.alertThresholds.memoryUsage },
      });
    }

    alerts.forEach(alert => this.addAlert(alert));
  }

  private addAlert(alert: Alert): void {
    this.alerts.push(alert);
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    this.sendNotification(alert);
  }

  private sendNotification(alert: Alert): void {
    const message = `[${alert.severity.toUpperCase()}] ${alert.message}`;
    
    if (this.config.notificationChannels.includes('console')) {
      console.warn(message, alert.metadata);
    }

    if (this.config.notificationChannels.includes('webhook') && this.config.webhookUrl) {
      fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      }).catch(console.error);
    }
  }

  private async sendMetrics(metrics: EdgeMetrics): Promise<void> {
    if (!this.config.endpoint) return;

    try {
      await fetch(`${this.config.endpoint}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics),
      });
    } catch (error) {
      console.error('Failed to send metrics:', error);
    }
  }

  private detectRegion(): string {
    // Simple region detection - in production this would use edge headers
    return 'global';
  }

  private getBandwidthUsage(): number {
    const connection = (navigator as any).connection;
    if (!connection) return 0;
    return connection.downlink || 0;
  }

  private getRenderTime(): number {
    const performanceOpt = (window as any).performance;
    if (!performanceOpt?.timing) return 0;
    return performanceOpt.timing.loadEventEnd - performanceOpt.timing.domComplete;
  }

  private getUserInteractionCount(): number {
    return this.userData.size;
  }

  // Public API methods
  trackUserEvent(event: string, target: string, metadata?: any): void {
    if (!this.config.enableUserBehaviorTracking) return;

    let sessionId = sessionStorage.getItem('edge-session-id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('edge-session-id', sessionId);
    }

    let userData = this.userData.get(sessionId);
    if (!userData) {
      userData = {
        sessionId,
        events: [],
        pageViews: 0,
        timeOnPage: 0,
        bounceRate: 0,
      };
      this.userData.set(sessionId, userData);
    }

    userData.events.push({
      type: event,
      target,
      timestamp: Date.now(),
      metadata,
    });

    if (event === 'pageview') {
      userData.pageViews++;
    }
  }

  getMetrics(): EdgeMetrics[] {
    return [...this.metrics];
  }

  getAlerts(severity?: Alert['severity']): Alert[] {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return [...this.alerts];
  }

  getHealthChecks(region?: string): Map<string, HealthCheckResult[]> {
    if (region) {
      const checks = this.healthChecks.get(region);
      return checks ? new Map([[region, checks]]) : new Map();
    }
    return new Map(this.healthChecks);
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  updateConfig(config: Partial<EdgeMonitorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getPerformanceSummary(): { [key: string]: number } {
    if (this.metrics.length === 0) return {};

    const recent = this.metrics.slice(-10);
    return {
      avgResponseTime: recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length,
      avgErrorRate: recent.reduce((sum, m) => sum + m.errorRate, 0) / recent.length,
      avgMemoryUsage: recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length,
      avgCacheHitRate: recent.reduce((sum, m) => sum + m.cacheHitRate, 0) / recent.length,
      totalAlerts: this.alerts.filter(a => !a.resolved).length,
    };
  }
}

export const edgeAnalyticsMonitoring = EdgeAnalyticsMonitoring.getInstance();
export type { EdgeMonitorConfig, EdgeMetrics, Alert, HealthCheckResult, UserBehaviorData, PerformanceData };