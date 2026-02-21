/**
 * API Health Monitor Service
 * Proactive health checking and monitoring for API endpoints
 * 
 * @module services/api/apiHealthMonitor
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../../constants/config';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('APIHealthMonitor');

/**
 * Health check status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Health check configuration for an endpoint
 */
export interface HealthCheckConfig {
  url: string;
  method?: 'GET' | 'HEAD' | 'POST';
  expectedStatus?: number[];
  expectedBody?: string | RegExp | ((body: string) => boolean);
  timeout?: number;
  interval?: number;
  retries?: number;
  headers?: Record<string, string>;
  body?: unknown;
  critical?: boolean;
  tags?: string[];
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  endpoint: string;
  status: HealthStatus;
  responseTime: number;
  statusCode?: number;
  message: string;
  timestamp: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastSuccess?: number;
  lastFailure?: number;
  uptime: number;
  tags: string[];
}

/**
 * Health check summary
 */
export interface HealthSummary {
  status: HealthStatus;
  totalEndpoints: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
  criticalIssues: number;
  averageResponseTime: number;
  overallUptime: number;
  lastCheckTime: number;
}

/**
 * Health alert
 */
export interface HealthAlert {
  id: string;
  endpoint: string;
  type: 'status_change' | 'latency' | 'uptime_drop' | 'consecutive_failures';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  details: Record<string, unknown>;
}

/**
 * Alert handler function
 */
export type HealthAlertHandler = (alert: HealthAlert) => void;

/**
 * Endpoint health state
 */
interface EndpointHealth {
  config: HealthCheckConfig;
  result: HealthCheckResult;
  intervalId?: ReturnType<typeof setInterval>;
  lastCheck?: number;
}

/**
 * API Health Monitor Service
 * 
 * Features:
 * - Configurable health checks with intervals
 * - Status tracking (healthy/degraded/unhealthy)
 * - Latency monitoring
 * - Uptime calculation
 * - Alert system for status changes
 * - Critical endpoint prioritization
 * - Tag-based grouping
 */
export class APIHealthMonitor {
  private endpoints = new Map<string, EndpointHealth>();
  private alerts: HealthAlert[] = [];
  private alertHandlers: HealthAlertHandler[] = [];
  private alertCounter = 0;
  
  // Global state
  private startTime = Date.now();
  private isMonitoring = false;
  private globalCheckInterval?: ReturnType<typeof setInterval>;
  
  // Configuration
  private readonly defaultInterval: number;
  private readonly defaultTimeout: number;
  private readonly maxAlerts: number;
  
  // Statistics
  private stats = {
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    totalLatency: 0
  };

  constructor(options?: {
    defaultInterval?: number;
    defaultTimeout?: number;
    maxAlerts?: number;
  }) {
    this.defaultInterval = options?.defaultInterval ?? TIME_CONSTANTS.MINUTE;
    this.defaultTimeout = options?.defaultTimeout ?? 10000;
    this.maxAlerts = options?.maxAlerts ?? 100;
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiHealthMonitor', {
        cleanup: () => this.destroy(),
        priority: 'low',
        description: 'API health monitoring service'
      });
    }
  }

  /**
   * Register an endpoint for health monitoring
   */
  registerEndpoint(name: string, config: HealthCheckConfig): () => void {
    const endpoint: EndpointHealth = {
      config: {
        ...config,
        method: config.method ?? 'GET',
        expectedStatus: config.expectedStatus ?? [200],
        timeout: config.timeout ?? this.defaultTimeout,
        interval: config.interval ?? this.defaultInterval,
        retries: config.retries ?? 1,
        tags: config.tags ?? []
      },
      result: {
        endpoint: name,
        status: 'unknown',
        responseTime: 0,
        message: 'Not yet checked',
        timestamp: Date.now(),
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        uptime: 100,
        tags: config.tags ?? []
      }
    };

    this.endpoints.set(name, endpoint);
    logger.info(`Registered endpoint: ${name}`, { url: config.url });

    // Start monitoring if already active
    if (this.isMonitoring) {
      this.startEndpointMonitoring(name, endpoint);
    }

    return () => this.unregisterEndpoint(name);
  }

  /**
   * Unregister an endpoint
   */
  unregisterEndpoint(name: string): boolean {
    const endpoint = this.endpoints.get(name);
    if (!endpoint) return false;

    if (endpoint.intervalId) {
      clearInterval(endpoint.intervalId);
    }

    this.endpoints.delete(name);
    logger.info(`Unregistered endpoint: ${name}`);
    return true;
  }

  /**
   * Start monitoring all registered endpoints
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    logger.info('Starting health monitoring');

    // Start monitoring each endpoint
    for (const [name, endpoint] of this.endpoints.entries()) {
      this.startEndpointMonitoring(name, endpoint);
    }

    // Run initial check for all endpoints
    this.checkAllEndpoints();
  }

  /**
   * Stop monitoring all endpoints
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    logger.info('Stopping health monitoring');

    // Stop all interval checks
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.intervalId) {
        clearInterval(endpoint.intervalId);
        endpoint.intervalId = undefined;
      }
    }

    if (this.globalCheckInterval) {
      clearInterval(this.globalCheckInterval);
      this.globalCheckInterval = undefined;
    }
  }

  /**
   * Check health of a specific endpoint
   */
  async checkEndpoint(name: string): Promise<HealthCheckResult | null> {
    const endpoint = this.endpoints.get(name);
    if (!endpoint) return null;

    return this.performHealthCheck(name, endpoint);
  }

  /**
   * Check health of all endpoints
   */
  async checkAllEndpoints(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    const checkPromises: Promise<void>[] = [];

    for (const [name, endpoint] of this.endpoints.entries()) {
      checkPromises.push(
        this.performHealthCheck(name, endpoint).then(result => {
          if (result) {
            results.set(name, result);
          }
        })
      );
    }

    await Promise.allSettled(checkPromises);
    return results;
  }

  /**
   * Get health status of an endpoint
   */
  getEndpointHealth(name: string): HealthCheckResult | null {
    return this.endpoints.get(name)?.result ?? null;
  }

  /**
   * Get health status of all endpoints
   */
  getAllEndpointHealth(): HealthCheckResult[] {
    return Array.from(this.endpoints.values()).map(e => e.result);
  }

  /**
   * Get overall health summary
   */
  getSummary(): HealthSummary {
    const allHealth = this.getAllEndpointHealth();
    
    const healthy = allHealth.filter(h => h.status === 'healthy').length;
    const degraded = allHealth.filter(h => h.status === 'degraded').length;
    const unhealthy = allHealth.filter(h => h.status === 'unhealthy').length;
    const unknown = allHealth.filter(h => h.status === 'unknown').length;
    
    const criticalIssues = allHealth.filter(
      h => h.status === 'unhealthy' && 
      this.endpoints.get(h.endpoint)?.config.critical
    ).length;

    const avgResponseTime = allHealth.length > 0
      ? allHealth.reduce((sum, h) => sum + h.responseTime, 0) / allHealth.length
      : 0;

    const overallUptime = allHealth.length > 0
      ? allHealth.reduce((sum, h) => sum + h.uptime, 0) / allHealth.length
      : 100;

    let status: HealthStatus = 'healthy';
    if (criticalIssues > 0 || unhealthy > allHealth.length / 2) {
      status = 'unhealthy';
    } else if (unhealthy > 0 || degraded > 0) {
      status = 'degraded';
    }

    return {
      status,
      totalEndpoints: allHealth.length,
      healthy,
      degraded,
      unhealthy,
      unknown,
      criticalIssues,
      averageResponseTime: avgResponseTime,
      overallUptime,
      lastCheckTime: Date.now()
    };
  }

  /**
   * Get endpoints by tag
   */
  getEndpointsByTag(tag: string): HealthCheckResult[] {
    return this.getAllEndpointHealth().filter(h => h.tags.includes(tag));
  }

  /**
   * Get health alerts
   */
  getAlerts(limit?: number): HealthAlert[] {
    const alerts = [...this.alerts].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? alerts.slice(0, limit) : alerts;
  }

  /**
   * Subscribe to health alerts
   */
  onAlert(handler: HealthAlertHandler): () => void {
    this.alertHandlers.push(handler);
    return () => {
      const index = this.alertHandlers.indexOf(handler);
      if (index > -1) {
        this.alertHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get statistics
   */
  getStats(): typeof this.stats & { uptime: number } {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime
    };
  }

  // Private methods

  private startEndpointMonitoring(name: string, endpoint: EndpointHealth): void {
    if (endpoint.intervalId) {
      clearInterval(endpoint.intervalId);
    }

    const interval = endpoint.config.interval ?? this.defaultInterval;
    
    endpoint.intervalId = setInterval(
      () => this.performHealthCheck(name, endpoint),
      interval
    );
  }

  private async performHealthCheck(
    name: string,
    endpoint: EndpointHealth
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const previousStatus = endpoint.result.status;
    
    let status: HealthStatus = 'healthy';
    let message = 'OK';
    let statusCode: number | undefined;

    this.stats.totalChecks++;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        endpoint.config.timeout ?? this.defaultTimeout
      );

      const response = await fetch(endpoint.config.url, {
        method: endpoint.config.method,
        headers: endpoint.config.headers,
        body: endpoint.config.body ? JSON.stringify(endpoint.config.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      statusCode = response.status;

      // Check status code
      const expectedStatus = endpoint.config.expectedStatus ?? [200];
      if (!expectedStatus.includes(response.status)) {
        status = 'unhealthy';
        message = `Unexpected status: ${response.status}`;
      }

      // Check response body if configured
      if (endpoint.config.expectedBody && status === 'healthy') {
        const body = await response.text();
        
        if (typeof endpoint.config.expectedBody === 'string') {
          if (!body.includes(endpoint.config.expectedBody)) {
            status = 'unhealthy';
            message = 'Response body does not contain expected string';
          }
        } else if (endpoint.config.expectedBody instanceof RegExp) {
          if (!endpoint.config.expectedBody.test(body)) {
            status = 'unhealthy';
            message = 'Response body does not match expected pattern';
          }
        } else if (typeof endpoint.config.expectedBody === 'function') {
          if (!endpoint.config.expectedBody(body)) {
            status = 'unhealthy';
            message = 'Response body validation failed';
          }
        }
      }

      this.stats.successfulChecks++;

    } catch (error) {
      status = 'unhealthy';
      message = error instanceof Error ? error.message : 'Unknown error';
      this.stats.failedChecks++;
    }

    const responseTime = Date.now() - startTime;
    this.stats.totalLatency += responseTime;

    // Update result
    const result = this.updateResult(endpoint, status, message, responseTime, statusCode);
    
    // Check for status change
    if (previousStatus !== status) {
      this.raiseAlert({
        id: this.generateAlertId(),
        endpoint: name,
        type: 'status_change',
        severity: status === 'unhealthy' ? 'critical' : 'warning',
        message: `Status changed from ${previousStatus} to ${status}`,
        timestamp: Date.now(),
        details: {
          previousStatus,
          newStatus: status,
          responseTime,
          message
        }
      });
    }

    // Check for latency
    if (responseTime > 5000) {
      this.raiseAlert({
        id: this.generateAlertId(),
        endpoint: name,
        type: 'latency',
        severity: 'warning',
        message: `High latency detected: ${responseTime}ms`,
        timestamp: Date.now(),
        details: { responseTime }
      });
    }

    // Check for consecutive failures
    if (result.consecutiveFailures >= 3) {
      this.raiseAlert({
        id: this.generateAlertId(),
        endpoint: name,
        type: 'consecutive_failures',
        severity: 'critical',
        message: `${result.consecutiveFailures} consecutive failures detected`,
        timestamp: Date.now(),
        details: { consecutiveFailures: result.consecutiveFailures }
      });
    }

    endpoint.lastCheck = Date.now();
    return result;
  }

  private updateResult(
    endpoint: EndpointHealth,
    status: HealthStatus,
    message: string,
    responseTime: number,
    statusCode?: number
  ): HealthCheckResult {
    const result = endpoint.result;

    // Update consecutive counters
    if (status === 'healthy') {
      result.consecutiveSuccesses++;
      result.consecutiveFailures = 0;
      result.lastSuccess = Date.now();
    } else {
      result.consecutiveFailures++;
      result.consecutiveSuccesses = 0;
      result.lastFailure = Date.now();
    }

    // Calculate uptime (simplified rolling average)
    const totalChecks = result.consecutiveSuccesses + result.consecutiveFailures;
    if (totalChecks > 0) {
      result.uptime = (result.consecutiveSuccesses / totalChecks) * 100;
    }

    // Determine if degraded
    let finalStatus = status;
    if (status === 'healthy' && responseTime > 2000) {
      finalStatus = 'degraded';
      message = `${message} (slow response: ${responseTime}ms)`;
    }

    result.status = finalStatus;
    result.responseTime = responseTime;
    result.statusCode = statusCode;
    result.message = message;
    result.timestamp = Date.now();

    return result;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${++this.alertCounter}`;
  }

  private raiseAlert(alert: HealthAlert): void {
    this.alerts.push(alert);
    
    // Trim alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }

    // Notify handlers
    for (const handler of this.alertHandlers) {
      try {
        handler(alert);
      } catch (error) {
        logger.error('Alert handler error', error);
      }
    }

    logger.warn(`Health alert [${alert.severity}]: ${alert.message}`, {
      endpoint: alert.endpoint,
      type: alert.type
    });
  }

  /**
   * Destroy the monitor and clean up resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.endpoints.clear();
    this.alerts = [];
    this.alertHandlers = [];
    logger.info('API Health Monitor destroyed');
  }
}

// Create singleton instance
export const apiHealthMonitor = new APIHealthMonitor();

// React hook for health monitoring
export const useAPIHealthMonitor = () => ({
  registerEndpoint: (name: string, config: HealthCheckConfig) =>
    apiHealthMonitor.registerEndpoint(name, config),
  unregisterEndpoint: (name: string) => apiHealthMonitor.unregisterEndpoint(name),
  startMonitoring: () => apiHealthMonitor.startMonitoring(),
  stopMonitoring: () => apiHealthMonitor.stopMonitoring(),
  checkEndpoint: (name: string) => apiHealthMonitor.checkEndpoint(name),
  checkAllEndpoints: () => apiHealthMonitor.checkAllEndpoints(),
  getEndpointHealth: (name: string) => apiHealthMonitor.getEndpointHealth(name),
  getAllEndpointHealth: () => apiHealthMonitor.getAllEndpointHealth(),
  getSummary: () => apiHealthMonitor.getSummary(),
  getEndpointsByTag: (tag: string) => apiHealthMonitor.getEndpointsByTag(tag),
  getAlerts: (limit?: number) => apiHealthMonitor.getAlerts(limit),
  onAlert: (handler: HealthAlertHandler) => apiHealthMonitor.onAlert(handler),
  getStats: () => apiHealthMonitor.getStats()
});
