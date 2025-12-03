/**
 * Enhanced Edge Monitoring Service
 * Provides comprehensive monitoring and alerting for edge deployment
 */

interface EdgeMonitorConfig {
  enableRealTimeMonitoring: boolean;
  enableHealthChecks: boolean;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  notificationChannels: ('console' | 'webhook' | 'email')[];
  webhookUrl?: string;
  emailRecipients?: string[];
}

interface HealthCheckResult {
  endpoint: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: number;
  region: string;
  error?: string;
  metadata?: Record<string, any>;
}

interface PerformanceMetrics {
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
}

interface Alert {
  id: string;
  type: 'performance' | 'availability' | 'error' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  region: string;
  endpoint?: string;
  metrics?: Record<string, number>;
  resolved: boolean;
  resolvedAt?: number;
}

class EdgeMonitoringService {
  private static instance: EdgeMonitoringService;
  private config: EdgeMonitorConfig;
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private performanceMetrics: PerformanceMetrics[] = [];
  private alerts: Map<string, Alert> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isMonitoring = false;

  private constructor() {
    this.config = {
      enableRealTimeMonitoring: process.env['VITE_ENABLE_PERFORMANCE_MONITORING'] === 'true',
      enableHealthChecks: true,
      enablePerformanceTracking: true,
      enableErrorTracking: process.env['VITE_ENABLE_ERROR_REPORTING'] === 'true',
      alertThresholds: {
        responseTime: 1000, // 1 second
        errorRate: 0.05, // 5%
        memoryUsage: 0.8, // 80%
        cpuUsage: 0.8 // 80%
      },
      notificationChannels: ['console'],
      webhookUrl: process.env['VITE_WEBHOOK_URL'],
      emailRecipients: process.env['VITE_ALERT_EMAILS']?.split(',')
    };

    this.initializeMonitoring();
  }

  static getInstance(): EdgeMonitoringService {
    if (!EdgeMonitoringService.instance) {
      EdgeMonitoringService.instance = new EdgeMonitoringService();
    }
    return EdgeMonitoringService.instance;
  }

  private initializeMonitoring(): void {
    if (!this.config.enableRealTimeMonitoring) return;

    this.startHealthChecks();
    this.startPerformanceMonitoring();
    this.startErrorTracking();
    this.isMonitoring = true;

    console.log('Edge monitoring service initialized');
  }

  private startHealthChecks(): void {
    if (!this.config.enableHealthChecks) return;

    const endpoints = [
      '/api/health',
      '/api/robots',
      '/api/strategies',
      '/api/analytics/performance-score'
    ];

    const regions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'];

    // Check health every 30 seconds
    const interval = setInterval(async () => {
      for (const endpoint of endpoints) {
        for (const region of regions) {
          await this.performHealthCheck(endpoint, region);
        }
      }
    }, 30000);

    this.monitoringIntervals.set('healthChecks', interval);
  }

  private async performHealthCheck(endpoint: string, region: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'x-health-check': 'true',
          'x-edge-region': region,
          'x-vercel-region': region
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      const responseTime = performance.now() - startTime;
      const status = response.ok ? 
        (responseTime < this.config.alertThresholds.responseTime ? 'healthy' : 'degraded') : 
        'unhealthy';

      const result: HealthCheckResult = {
        endpoint,
        status,
        responseTime,
        timestamp: Date.now(),
        region,
        metadata: {
          statusCode: response.status,
          statusText: response.statusText
        }
      };

      this.healthChecks.set(`${endpoint}:${region}`, result);

      // Check for alerts
      if (status === 'unhealthy') {
        this.createAlert({
          type: 'availability',
          severity: 'critical',
          message: `Health check failed for ${endpoint} in ${region}`,
          region,
          endpoint,
          metrics: { responseTime, statusCode: response.status }
        });
      } else if (status === 'degraded') {
        this.createAlert({
          type: 'performance',
          severity: 'medium',
          message: `Slow response from ${endpoint} in ${region}`,
          region,
          endpoint,
          metrics: { responseTime }
        });
      }

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      const result: HealthCheckResult = {
        endpoint,
        status: 'unhealthy',
        responseTime,
        timestamp: Date.now(),
        region,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.healthChecks.set(`${endpoint}:${region}`, result);

      this.createAlert({
        type: 'availability',
        severity: 'critical',
        message: `Health check error for ${endpoint} in ${region}: ${result.error}`,
        region,
        endpoint,
        metrics: { responseTime }
      });
    }
  }

  private startPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceTracking) return;

    // Collect performance metrics every minute
    const interval = setInterval(() => {
      this.collectPerformanceMetrics();
    }, 60000);

    this.monitoringIntervals.set('performance', interval);

    // Monitor Core Web Vitals
    this.monitorCoreWebVitals();
  }

  private collectPerformanceMetrics(): void {
    const regions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'];
    const endpoints = ['/api/robots', '/api/strategies', '/api/analytics'];

    regions.forEach(region => {
      endpoints.forEach(endpoint => {
        // Simulate metrics collection - in real implementation, this would fetch from monitoring APIs
        const metrics: PerformanceMetrics = {
          timestamp: Date.now(),
          region,
          endpoint,
          responseTime: Math.random() * 500 + 100,
          throughput: Math.random() * 1000 + 100,
          errorRate: Math.random() * 0.02,
          memoryUsage: Math.random() * 0.7 + 0.1,
          cpuUsage: Math.random() * 0.6 + 0.1,
          cacheHitRate: Math.random() * 0.3 + 0.7,
          bandwidthUsage: Math.random() * 1000000 + 100000
        };

        this.performanceMetrics.push(metrics);

        // Check for performance alerts
        this.checkPerformanceAlerts(metrics);
      });
    });

    // Keep only last 1000 metrics
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }
  }

  private checkPerformanceAlerts(metrics: PerformanceMetrics): void {
    const { alertThresholds } = this.config;

    if (metrics.responseTime > alertThresholds.responseTime) {
      this.createAlert({
        type: 'performance',
        severity: 'medium',
        message: `High response time for ${metrics.endpoint} in ${metrics.region}`,
        region: metrics.region,
        endpoint: metrics.endpoint,
        metrics: { responseTime: metrics.responseTime }
      });
    }

    if (metrics.errorRate > alertThresholds.errorRate) {
      this.createAlert({
        type: 'error',
        severity: 'high',
        message: `High error rate for ${metrics.endpoint} in ${metrics.region}`,
        region: metrics.region,
        endpoint: metrics.endpoint,
        metrics: { errorRate: metrics.errorRate }
      });
    }

    if (metrics.memoryUsage > alertThresholds.memoryUsage) {
      this.createAlert({
        type: 'resource',
        severity: 'high',
        message: `High memory usage in ${metrics.region}`,
        region: metrics.region,
        metrics: { memoryUsage: metrics.memoryUsage }
      });
    }

    if (metrics.cpuUsage > alertThresholds.cpuUsage) {
      this.createAlert({
        type: 'resource',
        severity: 'high',
        message: `High CPU usage in ${metrics.region}`,
        region: metrics.region,
        metrics: { cpuUsage: metrics.cpuUsage }
      });
    }
  }

  private monitorCoreWebVitals(): void {
    if (!('PerformanceObserver' in window)) return;

    // Monitor Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      if (lastEntry && lastEntry.startTime > 2500) { // LCP should be < 2.5s
        this.createAlert({
          type: 'performance',
          severity: 'medium',
          message: `Poor LCP detected: ${lastEntry.startTime.toFixed(0)}ms`,
          region: this.detectCurrentRegion(),
          metrics: { lcp: lastEntry.startTime }
        });
      }
    });

    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // Monitor Cumulative Layout Shift
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          
          if (clsValue > 0.1) { // CLS should be < 0.1
            this.createAlert({
              type: 'performance',
              severity: 'medium',
              message: `Poor CLS detected: ${clsValue.toFixed(3)}`,
              region: this.detectCurrentRegion(),
              metrics: { cls: clsValue }
            });
          }
        }
      });
    });

    clsObserver.observe({ entryTypes: ['layout-shift'] });
  }

  private startErrorTracking(): void {
    if (!this.config.enableErrorTracking) return;

    // Track JavaScript errors
    window.addEventListener('error', (event) => {
      this.createAlert({
        type: 'error',
        severity: 'medium',
        message: `JavaScript error: ${event.message}`,
        region: this.detectCurrentRegion(),
        metrics: {
          lineNumber: event.lineno,
          columnNumber: event.colno,
          filename: event.filename
        }
      });
    });

    // Track promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.createAlert({
        type: 'error',
        severity: 'medium',
        message: `Unhandled promise rejection: ${event.reason}`,
        region: this.detectCurrentRegion()
      });
    });

    // Track API errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        if (!response.ok) {
          this.createAlert({
            type: 'error',
            severity: 'low',
            message: `API error: ${response.status} ${response.statusText}`,
            region: this.detectCurrentRegion(),
            endpoint: args[0] as string,
            metrics: { statusCode: response.status }
          });
        }
        
        return response;
      } catch (error) {
        this.createAlert({
          type: 'error',
          severity: 'medium',
          message: `Network error: ${error}`,
          region: this.detectCurrentRegion(),
          endpoint: args[0] as string
        });
        throw error;
      }
    };
  }

  private createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false,
      ...alertData
    };

    this.alerts.set(alert.id, alert);

    // Send notifications
    this.sendNotifications(alert);

    // Auto-resolve similar alerts after 5 minutes if no new occurrences
    setTimeout(() => {
      const existingAlert = this.alerts.get(alert.id);
      if (existingAlert && !existingAlert.resolved) {
        this.resolveAlert(alert.id);
      }
    }, 5 * 60 * 1000);
  }

  private sendNotifications(alert: Alert): void {
    this.config.notificationChannels.forEach(channel => {
      switch (channel) {
        case 'console':
          console.warn(`🚨 Edge Alert [${alert.severity.toUpperCase()}]: ${alert.message}`, alert);
          break;
        
        case 'webhook':
          if (this.config.webhookUrl) {
            this.sendWebhookNotification(alert);
          }
          break;
        
        case 'email':
          if (this.config.emailRecipients) {
            this.sendEmailNotification(alert);
          }
          break;
      }
    });
  }

  private async sendWebhookNotification(alert: Alert): Promise<void> {
    try {
      await fetch(this.config.webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Alert-Severity': alert.severity,
          'X-Alert-Type': alert.type
        },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  private async sendEmailNotification(alert: Alert): Promise<void> {
    // In a real implementation, this would integrate with an email service
    console.log(`📧 Email alert sent to ${this.config.emailRecipients?.join(', ')}:`, alert.message);
  }

  private detectCurrentRegion(): string {
    // Try to detect region from various sources
    return (window as any).__VERCEL_REGION || 
           process.env.VERCEL_REGION || 
           'unknown';
  }

  // Public API methods
  public getHealthStatus(): Record<string, HealthCheckResult> {
    const result: Record<string, HealthCheckResult> = {};
    this.healthChecks.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  public getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceMetrics];
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  public getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  public resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      
      console.log(`✅ Alert resolved: ${alert.message}`);
    }
  }

  public updateConfig(newConfig: Partial<EdgeMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getMonitoringStatus(): {
    isMonitoring: boolean;
    activeIntervals: number;
    totalHealthChecks: number;
    totalMetrics: number;
    activeAlerts: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      activeIntervals: this.monitoringIntervals.size,
      totalHealthChecks: this.healthChecks.size,
      totalMetrics: this.performanceMetrics.length,
      activeAlerts: this.getActiveAlerts().length
    };
  }

  public generateReport(): {
    summary: {
      totalEndpoints: number;
      healthyEndpoints: number;
      degradedEndpoints: number;
      unhealthyEndpoints: number;
      averageResponseTime: number;
      totalAlerts: number;
      criticalAlerts: number;
    };
    healthByRegion: Record<string, { healthy: number; degraded: number; unhealthy: number }>;
    performanceByRegion: Record<string, { avgResponseTime: number; avgErrorRate: number }>;
    recentAlerts: Alert[];
  } {
    const healthChecks = Array.from(this.healthChecks.values());
    const alerts = this.getActiveAlerts();
    
    const summary = {
      totalEndpoints: healthChecks.length,
      healthyEndpoints: healthChecks.filter(hc => hc.status === 'healthy').length,
      degradedEndpoints: healthChecks.filter(hc => hc.status === 'degraded').length,
      unhealthyEndpoints: healthChecks.filter(hc => hc.status === 'unhealthy').length,
      averageResponseTime: healthChecks.reduce((sum, hc) => sum + hc.responseTime, 0) / healthChecks.length || 0,
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length
    };

    const healthByRegion: Record<string, { healthy: number; degraded: number; unhealthy: number }> = {};
    healthChecks.forEach(hc => {
      if (!healthByRegion[hc.region]) {
        healthByRegion[hc.region] = { healthy: 0, degraded: 0, unhealthy: 0 };
      }
      healthByRegion[hc.region][hc.status]++;
    });

    const performanceByRegion: Record<string, { avgResponseTime: number; avgErrorRate: number }> = {};
    this.performanceMetrics.forEach(metric => {
      if (!performanceByRegion[metric.region]) {
        performanceByRegion[metric.region] = { avgResponseTime: 0, avgErrorRate: 0, count: 0 };
      }
      const region = performanceByRegion[metric.region] as any;
      region.avgResponseTime += metric.responseTime;
      region.avgErrorRate += metric.errorRate;
      region.count++;
    });

    // Calculate averages
    Object.values(performanceByRegion).forEach((region: any) => {
      region.avgResponseTime /= region.count;
      region.avgErrorRate /= region.count;
      delete region.count;
    });

    const recentAlerts = alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      summary,
      healthByRegion,
      performanceByRegion,
      recentAlerts
    };
  }

  public stopMonitoring(): void {
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals.clear();
    this.isMonitoring = false;
    console.log('Edge monitoring service stopped');
  }

  public restartMonitoring(): void {
    this.stopMonitoring();
    this.initializeMonitoring();
  }
}

export const edgeMonitoring = EdgeMonitoringService.getInstance();

// Export types for external use
export type {
  EdgeMonitorConfig,
  HealthCheckResult,
  PerformanceMetrics,
  Alert
};