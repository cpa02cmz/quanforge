/**
 * Backend Manager
 * 
 * Unified orchestrator for all backend services including:
 * - Service Registry coordination
 * - Performance analysis integration
 * - Request context tracking
 * - Rate limiting management
 * - Request queuing
 * - Health dashboard aggregation
 * - Event coordination
 * 
 * @module services/backend/manager
 * @author Backend Engineer
 */

import {
  BackendServiceStatus,
  ServiceCriticality,
  BackendHealthDashboard,
  ServiceHealthDisplay,
  BackendAlert,
  BackendEvent,
  BackendEventListener,
  BackendEventType,
  BackendPerformanceReport,
  DEFAULT_BACKEND_CONFIG,
} from './types';

import { backendServiceRegistry } from './serviceRegistry';
import { backendPerformanceAnalyzer } from './performanceAnalyzer';
import { requestContextManager } from './requestContext';
import { backendRateLimiter } from './rateLimiter';
import { requestQueueManager } from './requestQueue';

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('BackendManager');

/**
 * Backend manager configuration
 */
export interface BackendManagerOptions {
  enableRateLimiting: boolean;
  enableQueueing: boolean;
  enableTracing: boolean;
  enableMetrics: boolean;
  healthCheckInterval: number;
  alertingEnabled: boolean;
}

/**
 * Backend manager status
 */
export interface BackendManagerStatus {
  initialized: boolean;
  uptime: number;
  services: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  requests: {
    pending: number;
    active: number;
    completed: number;
    failed: number;
  };
  rateLimiting: {
    enabled: boolean;
    totalServices: number;
    averageAllowRate: number;
  };
  queueing: {
    enabled: boolean;
    totalQueued: number;
    averageThroughput: number;
  };
}

/**
 * Backend operation context
 */
export interface BackendOperationContext {
  serviceName: string;
  operation: string;
  priority?: 'critical' | 'high' | 'normal' | 'low';
  timeout?: number;
  retries?: number;
  skipRateLimit?: boolean;
  skipQueue?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Default backend manager options
 */
const DEFAULT_OPTIONS: BackendManagerOptions = {
  enableRateLimiting: true,
  enableQueueing: true,
  enableTracing: true,
  enableMetrics: true,
  healthCheckInterval: 30000,
  alertingEnabled: true,
};

/**
 * Backend Manager
 * 
 * Singleton class that orchestrates all backend services.
 */
export class BackendManager {
  private static instance: BackendManager | null = null;
  
  private options: BackendManagerOptions;
  private initialized: boolean = false;
  private startTime: number = 0;
  private eventListeners: Set<BackendEventListener> = new Set();
  private alerts: BackendAlert[] = [];
  private maxAlerts: number = 100;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  private constructor(options: Partial<BackendManagerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get the singleton instance
   */
  static getInstance(options?: Partial<BackendManagerOptions>): BackendManager {
    if (!BackendManager.instance) {
      BackendManager.instance = new BackendManager(options);
    }
    return BackendManager.instance;
  }

  /**
   * Initialize the backend manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Backend manager already initialized');
      return;
    }

    logger.log('Initializing backend manager...');
    this.startTime = Date.now();

    // Initialize all subsystems
    await this.initializeSubsystems();

    // Set up event coordination
    this.setupEventCoordination();

    // Start health monitoring
    this.startHealthMonitoring();

    this.initialized = true;
    logger.log('Backend manager initialized successfully');
  }

  /**
   * Execute a backend operation with full orchestration
   */
  async execute<T>(
    context: BackendOperationContext,
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check rate limit
    if (this.options.enableRateLimiting && !context.skipRateLimit) {
      const rateResult = backendRateLimiter.tryConsume(context.serviceName);
      
      if (!rateResult.allowed) {
        throw new Error(
          `Rate limit exceeded for ${context.serviceName}. Retry after ${rateResult.retryAfter}ms`
        );
      }
    }

    // Create request context for tracing
    let requestContext;
    if (this.options.enableTracing) {
      requestContext = requestContextManager.startRequest({
        serviceName: context.serviceName,
        operation: context.operation,
        metadata: context.metadata,
      });
    }

    const startTime = Date.now();

    try {
      // Execute the operation
      const result = await operation();

      // Record success metrics
      if (this.options.enableMetrics) {
        this.recordSuccess(context.serviceName, Date.now() - startTime);
      }

      // End request context
      if (requestContext) {
        requestContextManager.endRequest(requestContext);
      }

      return result;

    } catch (error) {
      // Record failure metrics
      if (this.options.enableMetrics) {
        this.recordFailure(context.serviceName, Date.now() - startTime);
      }

      // End request context with error
      if (requestContext) {
        requestContextManager.endRequestWithError(
          requestContext,
          error instanceof Error ? error : new Error(String(error))
        );
      }

      throw error;
    }
  }

  /**
   * Enqueue an operation for later execution
   */
  async enqueue<T, R>(
    context: BackendOperationContext,
    payload: T
  ): Promise<string> {
    if (!this.options.enableQueueing) {
      throw new Error('Queueing is not enabled');
    }

    return requestQueueManager.enqueue<T, R>(
      context.serviceName,
      context.operation,
      payload,
      {
        priority: context.priority,
        timeout: context.timeout,
        maxRetries: context.retries,
        metadata: context.metadata,
      }
    );
  }

  /**
   * Enqueue and wait for result
   */
  async enqueueAndWait<T, R>(
    context: BackendOperationContext,
    payload: T
  ): Promise<R> {
    if (!this.options.enableQueueing) {
      throw new Error('Queueing is not enabled');
    }

    return requestQueueManager.enqueueAndWait<T, R>(
      context.serviceName,
      context.operation,
      payload,
      {
        priority: context.priority,
        timeout: context.timeout,
        maxRetries: context.retries,
        metadata: context.metadata,
      }
    );
  }

  /**
   * Get comprehensive health dashboard
   */
  async getHealthDashboard(): Promise<BackendHealthDashboard> {
    const services = backendServiceRegistry.getAllServices();
    const registryStats = backendServiceRegistry.getStats();
    const requestStats = requestContextManager.getStats();
    const performanceReport = backendPerformanceAnalyzer.generateReport();

    const serviceDisplays: ServiceHealthDisplay[] = services.map(service => ({
      name: service.config.name,
      status: service.status,
      criticality: service.config.criticality,
      latency: service.averageResponseTime,
      uptime: service.uptime / (service.uptime + service.downtime) * 100 || 0,
      lastCheck: service.lastHealthCheck || 0,
      message: service.status === 'healthy' ? 'OK' : undefined,
    }));

    // Calculate trends
    const latencyTrend = this.calculateTrend(performanceReport.summary.averageLatency, 'latency');
    const errorTrend = this.calculateTrend(performanceReport.summary.errorRate, 'error');
    const throughputTrend = this.calculateTrend(performanceReport.summary.throughput, 'throughput');

    return {
      timestamp: Date.now(),
      overallStatus: registryStats.overallHealth,
      services: serviceDisplays,
      alerts: this.alerts.slice(-10),
      metrics: {
        totalRequests: requestStats.totalRequests,
        averageLatency: performanceReport.summary.averageLatency,
        errorRate: performanceReport.summary.errorRate,
        throughput: performanceReport.summary.throughput,
      },
      trends: {
        latencyTrend,
        errorTrend,
        throughputTrend,
      },
    };
  }

  /**
   * Get performance report
   */
  getPerformanceReport(
    timeframe?: { start: number; end: number }
  ): BackendPerformanceReport {
    return backendPerformanceAnalyzer.generateReport(timeframe);
  }

  /**
   * Get manager status
   */
  getStatus(): BackendManagerStatus {
    const registryStats = backendServiceRegistry.getStats();
    const requestStats = requestContextManager.getStats();
    const rateLimitStats = backendRateLimiter.getStats();
    const queueStats = requestQueueManager.getAllStats();

    const totalQueued = queueStats.reduce((sum, s) => sum + s.pendingItems, 0);
    const avgThroughput = queueStats.length > 0
      ? queueStats.reduce((sum, s) => sum + s.throughput, 0) / queueStats.length
      : 0;

    return {
      initialized: this.initialized,
      uptime: Date.now() - this.startTime,
      services: {
        total: registryStats.totalServices,
        healthy: registryStats.healthyServices,
        degraded: registryStats.degradedServices,
        unhealthy: registryStats.unhealthyServices,
      },
      requests: {
        pending: requestStats.pendingRequests,
        active: requestContextManager.getActiveRequestCount(),
        completed: requestStats.successfulRequests,
        failed: requestStats.failedRequests,
      },
      rateLimiting: {
        enabled: this.options.enableRateLimiting,
        totalServices: rateLimitStats.totalServices,
        averageAllowRate: rateLimitStats.averageAllowRate,
      },
      queueing: {
        enabled: this.options.enableQueueing,
        totalQueued,
        averageThroughput: avgThroughput,
      },
    };
  }

  /**
   * Subscribe to backend events
   */
  subscribe(listener: BackendEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Get active alerts
   */
  getAlerts(): BackendAlert[] {
    return this.alerts.slice();
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
   * Register a service
   */
  registerService(config: {
    name: string;
    description?: string;
    criticality: ServiceCriticality;
    healthCheck?: () => Promise<{ status: BackendServiceStatus; message?: string }>;
  }): string {
    return backendServiceRegistry.registerService({
      name: config.name,
      description: config.description,
      criticality: config.criticality,
      healthCheck: config.healthCheck ? async () => {
        const result = await config.healthCheck!();
        return {
          status: result.status,
          message: result.message,
          timestamp: Date.now(),
        };
      } : undefined,
    });
  }

  /**
   * Configure rate limiting for a service
   */
  configureRateLimit(config: {
    serviceName: string;
    maxTokens: number;
    refillRate: number;
    burstSize?: number;
  }): void {
    backendRateLimiter.configureService(config);
  }

  /**
   * Configure queue for a service
   */
  configureQueue(config: {
    serviceName: string;
    maxConcurrent: number;
    maxSize: number;
    defaultTimeout?: number;
    defaultRetries?: number;
  }): void {
    requestQueueManager.configureQueue({
      serviceName: config.serviceName,
      maxConcurrent: config.maxConcurrent,
      maxSize: config.maxSize,
      defaultTimeout: config.defaultTimeout || 30000,
      defaultRetries: config.defaultRetries || 2,
      processingInterval: 50,
    });
  }

  // Private methods

  private async initializeSubsystems(): Promise<void> {
    // Initialize rate limiter
    if (this.options.enableRateLimiting) {
      logger.log('Rate limiting enabled');
    }

    // Initialize queue manager
    if (this.options.enableQueueing) {
      logger.log('Request queuing enabled');
    }

    // Initialize service registry
    await backendServiceRegistry.checkAllServicesHealth();
  }

  private setupEventCoordination(): void {
    // Subscribe to service registry events
    backendServiceRegistry.subscribe((event) => {
      this.handleEvent(event);
    });

    // Subscribe to request context events
    requestContextManager.subscribe((event) => {
      this.handleEvent(event);
    });
  }

  private handleEvent(event: BackendEvent): void {
    // Create alerts for critical events
    if (this.options.alertingEnabled) {
      if (event.type === BackendEventType.SERVICE_HEALTH_CHANGED && 
          event.severity === 'error') {
        this.createAlert({
          severity: 'error',
          service: event.service || 'unknown',
          message: (event.data['message'] as string) || 'Service health changed',
        });
      }

      if (event.type === BackendEventType.REQUEST_FAILED &&
          event.severity === 'error') {
        // Only create alert for repeated failures
        const data = event.data as { errorCount?: number };
        if (data.errorCount && data.errorCount > 5) {
          this.createAlert({
            severity: 'warning',
            service: event.service || 'unknown',
            message: `Multiple failures detected: ${event.data['operation']}`,
          });
        }
      }
    }

    // Forward to all listeners
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.warn('Error in event listener:', error);
      }
    });
  }

  private createAlert(params: {
    severity: 'info' | 'warning' | 'error' | 'critical';
    service: string;
    message: string;
  }): void {
    const alert: BackendAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      severity: params.severity,
      service: params.service,
      message: params.message,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.push(alert);

    // Trim old alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }

    logger.warn(`Alert created: [${params.severity}] ${params.service}: ${params.message}`);
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const stats = backendServiceRegistry.getStats();
        
        // Check for unhealthy critical services
        const criticalDown = stats.criticalServicesDown;
        if (criticalDown > 0 && this.options.alertingEnabled) {
          this.createAlert({
            severity: 'critical',
            service: 'system',
            message: `${criticalDown} critical service(s) are down`,
          });
        }
      } catch (error) {
        logger.error('Error during health monitoring:', error);
      }
    }, this.options.healthCheckInterval);
  }

  private recordSuccess(serviceName: string, duration: number): void {
    backendServiceRegistry.recordRequest(serviceName, true, duration);
    
    backendPerformanceAnalyzer.recordMetric({
      name: 'latency',
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      service: serviceName,
    });
  }

  private recordFailure(serviceName: string, duration: number): void {
    backendServiceRegistry.recordRequest(serviceName, false, duration);
    
    backendPerformanceAnalyzer.recordMetric({
      name: 'error_count',
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      service: serviceName,
    });
  }

  private calculateTrend(
    value: number,
    type: 'latency' | 'error' | 'throughput'
  ): 'improving' | 'stable' | 'degrading' {
    // Simple trend calculation based on thresholds
    // In a real implementation, this would compare historical data
    const thresholds = DEFAULT_BACKEND_CONFIG.alertThresholds;

    switch (type) {
      case 'latency':
        if (value < thresholds.latencyWarning * 0.5) return 'improving';
        if (value > thresholds.latencyWarning) return 'degrading';
        return 'stable';

      case 'error':
        if (value < thresholds.errorRateWarning * 0.5) return 'improving';
        if (value > thresholds.errorRateWarning) return 'degrading';
        return 'stable';

      case 'throughput':
        if (value > 100) return 'improving';
        if (value < 10) return 'degrading';
        return 'stable';

      default:
        return 'stable';
    }
  }

  /**
   * Shutdown the backend manager
   */
  async shutdown(): Promise<void> {
    logger.log('Shutting down backend manager...');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Destroy subsystems
    backendRateLimiter.destroy();
    requestQueueManager.destroy();
    backendServiceRegistry.destroy();
    requestContextManager.destroy();
    backendPerformanceAnalyzer.destroy();

    // Clear state
    this.eventListeners.clear();
    this.alerts = [];
    this.initialized = false;

    BackendManager.instance = null;
    logger.log('Backend manager shut down successfully');
  }
}

// Export singleton instance
export const backendManager = BackendManager.getInstance();

/**
 * Helper function to execute a backend operation
 */
export function executeBackendOperation<T>(
  serviceName: string,
  operation: string,
  fn: () => Promise<T>,
  options?: Partial<BackendOperationContext>
): Promise<T> {
  return backendManager.execute(
    {
      serviceName,
      operation,
      ...options,
    },
    fn
  );
}

/**
 * Helper function to get backend health
 */
export async function getBackendHealth(): Promise<BackendHealthDashboard> {
  return backendManager.getHealthDashboard();
}

/**
 * Helper function to get backend status
 */
export function getBackendStatus(): BackendManagerStatus {
  return backendManager.getStatus();
}
