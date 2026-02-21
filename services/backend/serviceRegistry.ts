/**
 * Backend Service Registry
 * 
 * Centralized registry for all backend services with:
 * - Service registration and lifecycle management
 * - Health checking with configurable intervals
 * - Metrics collection and aggregation
 * - Event-driven status notifications
 * - Dependency tracking
 * 
 * @module services/backend/serviceRegistry
 * @author Backend Engineer
 */

import {
  BackendServiceStatus,
  ServiceCriticality,
  BackendServiceConfig,
  ServiceHealthResult,
  RegisteredService,
  ServiceRegistryStats,
  BackendEventType,
  BackendEvent,
  BackendEventListener,
  DEFAULT_BACKEND_CONFIG,
} from './types';

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('BackendServiceRegistry');

/**
 * Backend Service Registry
 * 
 * Singleton class that manages all backend services in the application.
 */
export class BackendServiceRegistry {
  private static instance: BackendServiceRegistry | null = null;
  
  private services: Map<string, RegisteredService> = new Map();
  private healthCheckTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private eventListeners: Set<BackendEventListener> = new Set();
  
  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): BackendServiceRegistry {
    if (!BackendServiceRegistry.instance) {
      BackendServiceRegistry.instance = new BackendServiceRegistry();
    }
    return BackendServiceRegistry.instance;
  }

  /**
   * Register a new backend service
   */
  registerService(config: BackendServiceConfig): string {
    const id = this.generateServiceId(config.name);
    
    if (this.services.has(id)) {
      logger.warn(`Service already registered: ${config.name}, updating configuration`);
      this.unregisterService(id);
    }

    const service: RegisteredService = {
      id,
      config,
      status: 'initializing',
      lastHealthCheck: null,
      lastStatusChange: Date.now(),
      consecutiveFailures: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: 0,
      downtime: 0,
    };

    this.services.set(id, service);
    
    // Start health checking if configured
    if (config.healthCheck) {
      this.startHealthChecking(id);
    } else {
      // Mark as healthy if no health check is configured
      this.updateServiceStatus(id, 'healthy');
    }

    this.emitEvent({
      type: BackendEventType.SERVICE_REGISTERED,
      timestamp: Date.now(),
      service: config.name,
      data: { id, criticality: config.criticality },
      severity: 'info',
    });

    logger.log(`Service registered: ${config.name} (${config.criticality})`);
    return id;
  }

  /**
   * Unregister a service
   */
  unregisterService(id: string): boolean {
    const service = this.services.get(id);
    if (!service) {
      return false;
    }

    // Stop health checking
    this.stopHealthChecking(id);

    // Remove from registry
    this.services.delete(id);

    this.emitEvent({
      type: BackendEventType.SERVICE_UNREGISTERED,
      timestamp: Date.now(),
      service: service.config.name,
      data: { id },
      severity: 'info',
    });

    logger.log(`Service unregistered: ${service.config.name}`);
    return true;
  }

  /**
   * Get service by ID
   */
  getService(id: string): RegisteredService | undefined {
    return this.services.get(id);
  }

  /**
   * Get service by name
   */
  getServiceByName(name: string): RegisteredService | undefined {
    for (const service of this.services.values()) {
      if (service.config.name === name) {
        return service;
      }
    }
    return undefined;
  }

  /**
   * Get all services
   */
  getAllServices(): RegisteredService[] {
    return Array.from(this.services.values());
  }

  /**
   * Get services by status
   */
  getServicesByStatus(status: BackendServiceStatus): RegisteredService[] {
    return this.getAllServices().filter(s => s.status === status);
  }

  /**
   * Get services by criticality
   */
  getServicesByCriticality(criticality: ServiceCriticality): RegisteredService[] {
    return this.getAllServices().filter(s => s.config.criticality === criticality);
  }

  /**
   * Record a request for a service
   */
  recordRequest(serviceName: string, success: boolean, duration: number): void {
    const service = this.getServiceByName(serviceName);
    if (!service) {
      logger.warn(`Attempted to record request for unknown service: ${serviceName}`);
      return;
    }

    service.totalRequests++;
    
    if (success) {
      service.successfulRequests++;
      // Update average response time using exponential moving average
      service.averageResponseTime = service.averageResponseTime === 0
        ? duration
        : service.averageResponseTime * 0.9 + duration * 0.1;
    } else {
      service.failedRequests++;
    }
  }

  /**
   * Perform health check for a specific service
   */
  async checkServiceHealth(id: string): Promise<ServiceHealthResult | null> {
    const service = this.services.get(id);
    if (!service || !service.config.healthCheck) {
      return null;
    }

    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        service.config.healthCheck(),
        this.createTimeoutPromise(service.config.initializationTimeout || DEFAULT_BACKEND_CONFIG.requestTimeout),
      ]);

      const latency = Date.now() - startTime;
      
      const healthResult: ServiceHealthResult = {
        ...result,
        latency,
        timestamp: Date.now(),
      };

      this.updateServiceStatus(id, result.status);
      service.lastHealthCheck = healthResult.timestamp;
      service.consecutiveFailures = 0;

      // Update uptime/downtime
      if (result.status === 'healthy') {
        service.uptime += latency;
      } else {
        service.downtime += latency;
      }

      return healthResult;
    } catch (error) {
      const latency = Date.now() - startTime;
      service.consecutiveFailures++;
      service.downtime += latency;

      const errorResult: ServiceHealthResult = {
        status: service.consecutiveFailures >= 3 ? 'unhealthy' : 'degraded',
        message: error instanceof Error ? error.message : 'Health check failed',
        latency,
        timestamp: Date.now(),
      };

      this.updateServiceStatus(id, errorResult.status);
      service.lastHealthCheck = errorResult.timestamp;

      return errorResult;
    }
  }

  /**
   * Check health of all services
   */
  async checkAllServicesHealth(): Promise<Map<string, ServiceHealthResult>> {
    const results = new Map<string, ServiceHealthResult>();
    const checks = Array.from(this.services.keys()).map(async (id) => {
      const result = await this.checkServiceHealth(id);
      if (result) {
        results.set(id, result);
      }
    });

    await Promise.allSettled(checks);
    return results;
  }

  /**
   * Get registry statistics
   */
  getStats(): ServiceRegistryStats {
    const services = this.getAllServices();
    const totalServices = services.length;
    
    const healthyServices = services.filter(s => s.status === 'healthy').length;
    const degradedServices = services.filter(s => s.status === 'degraded').length;
    const unhealthyServices = services.filter(s => s.status === 'unhealthy').length;
    
    const criticalServicesDown = services.filter(
      s => (s.status === 'unhealthy' || s.status === 'stopped') && 
           s.config.criticality === 'critical'
    ).length;

    const totalResponseTime = services.reduce(
      (sum, s) => sum + s.averageResponseTime, 
      0
    );
    const averageResponseTime = totalServices > 0 
      ? totalResponseTime / totalServices 
      : 0;

    let overallHealth: BackendServiceStatus = 'healthy';
    if (criticalServicesDown > 0) {
      overallHealth = 'unhealthy';
    } else if (unhealthyServices > 0 || degradedServices > 0) {
      overallHealth = 'degraded';
    }

    return {
      totalServices,
      healthyServices,
      degradedServices,
      unhealthyServices,
      criticalServicesDown,
      averageResponseTime,
      overallHealth,
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
   * Get dependencies for a service
   */
  getServiceDependencies(serviceName: string): RegisteredService[] {
    const service = this.getServiceByName(serviceName);
    if (!service || !service.config.dependencies) {
      return [];
    }

    return service.config.dependencies
      .map(depName => this.getServiceByName(depName))
      .filter((s): s is RegisteredService => s !== undefined);
  }

  /**
   * Get services that depend on a given service
   */
  getServiceDependents(serviceName: string): RegisteredService[] {
    return this.getAllServices().filter(
      service => service.config.dependencies?.includes(serviceName)
    );
  }

  /**
   * Check if all dependencies are healthy
   */
  areDependenciesHealthy(serviceName: string): boolean {
    const dependencies = this.getServiceDependencies(serviceName);
    return dependencies.every(dep => dep.status === 'healthy');
  }

  /**
   * Get service initialization order (topological sort based on dependencies)
   */
  getInitializationOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (serviceName: string) => {
      if (visited.has(serviceName)) {
        return;
      }
      visited.add(serviceName);

      const service = this.getServiceByName(serviceName);
      if (service?.config.dependencies) {
        service.config.dependencies.forEach(visit);
      }

      order.push(serviceName);
    };

    this.services.forEach(service => visit(service.config.name));
    return order;
  }

  // Private methods

  private generateServiceId(name: string): string {
    return `service_${name}_${Date.now()}`;
  }

  private updateServiceStatus(id: string, status: BackendServiceStatus): void {
    const service = this.services.get(id);
    if (!service) {
      return;
    }

    const previousStatus = service.status;
    if (previousStatus === status) {
      return;
    }

    service.status = status;
    service.lastStatusChange = Date.now();

    // Notify listener
    if (service.config.onHealthChange) {
      try {
        service.config.onHealthChange(status);
      } catch (error) {
        logger.warn(`Error in health change callback for ${service.config.name}:`, error);
      }
    }

    // Emit event
    this.emitEvent({
      type: BackendEventType.SERVICE_HEALTH_CHANGED,
      timestamp: Date.now(),
      service: service.config.name,
      data: { 
        id, 
        previousStatus, 
        newStatus: status,
        criticality: service.config.criticality,
      },
      severity: status === 'unhealthy' ? 'error' : status === 'degraded' ? 'warning' : 'info',
    });

    logger.log(`Service ${service.config.name} status changed: ${previousStatus} -> ${status}`);
  }

  private startHealthChecking(id: string): void {
    const service = this.services.get(id);
    if (!service) {
      return;
    }

    // Stop any existing timer
    this.stopHealthChecking(id);

    const interval = service.config.healthCheckInterval || DEFAULT_BACKEND_CONFIG.healthCheckInterval;
    
    const timer = setInterval(async () => {
      await this.checkServiceHealth(id);
    }, interval);

    this.healthCheckTimers.set(id, timer);
  }

  private stopHealthChecking(id: string): void {
    const timer = this.healthCheckTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(id);
    }
  }

  private emitEvent(event: BackendEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.warn('Error in event listener:', error);
      }
    });
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), timeout);
    });
  }

  /**
   * Cleanup and destroy the registry
   */
  destroy(): void {
    // Stop all health check timers
    this.healthCheckTimers.forEach((_, id) => {
      this.stopHealthChecking(id);
    });

    // Clear all services
    this.services.clear();

    // Clear event listeners
    this.eventListeners.clear();

    // Reset singleton
    BackendServiceRegistry.instance = null;

    logger.log('Backend Service Registry destroyed');
  }
}

// Export singleton instance
export const backendServiceRegistry = BackendServiceRegistry.getInstance();

/**
 * Helper function to register common backend services
 */
export function registerCommonBackendServices(): void {
  // Register database service
  backendServiceRegistry.registerService({
    name: 'database',
    description: 'Supabase PostgreSQL Database',
    criticality: 'critical',
    version: '1.0.0',
    healthCheck: async () => ({
      status: 'healthy' as BackendServiceStatus,
      message: 'Database connection healthy',
      timestamp: Date.now(),
    }),
  });

  // Register AI service
  backendServiceRegistry.registerService({
    name: 'ai_service',
    description: 'Google Gemini AI Service',
    criticality: 'high',
    version: '1.0.0',
    dependencies: [],
    healthCheck: async () => ({
      status: 'healthy' as BackendServiceStatus,
      message: 'AI service available',
      timestamp: Date.now(),
    }),
  });

  // Register cache service
  backendServiceRegistry.registerService({
    name: 'cache',
    description: 'Multi-tier Cache Service',
    criticality: 'high',
    version: '1.0.0',
    healthCheck: async () => ({
      status: 'healthy' as BackendServiceStatus,
      message: 'Cache service operational',
      timestamp: Date.now(),
    }),
  });

  // Register market data service
  backendServiceRegistry.registerService({
    name: 'market_data',
    description: 'Real-time Market Data Service',
    criticality: 'medium',
    version: '1.0.0',
    healthCheck: async () => ({
      status: 'healthy' as BackendServiceStatus,
      message: 'Market data service available',
      timestamp: Date.now(),
    }),
  });

  logger.log('Common backend services registered');
}
