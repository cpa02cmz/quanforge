/**
 * Backend Load Balancer
 * 
 * Provides sophisticated load balancing with:
 * - Multiple load balancing strategies (round-robin, least-connections, weighted, random)
 * - Health-aware routing (only routes to healthy instances)
 * - Automatic failover and instance recovery
 * - Session affinity support
 * - Connection tracking and statistics
 * - Circuit breaker integration
 * 
 * @module services/backend/loadBalancer
 * @author Backend Engineer
 */

import { BackendServiceStatus, BackendEventType, BackendEvent, BackendEventListener } from './types';
import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('LoadBalancer');

// ============= Types =============

/**
 * Load balancing strategy
 */
export type LoadBalancingStrategy = 
  | 'round_robin' 
  | 'least_connections' 
  | 'weighted' 
  | 'random'
  | 'ip_hash';

/**
 * Backend instance configuration
 */
export interface BackendInstance {
  id: string;
  host: string;
  port: number;
  weight: number;
  maxConnections: number;
  currentConnections: number;
  status: BackendServiceStatus;
  lastHealthCheck: number | null;
  consecutiveFailures: number;
  metadata?: Record<string, unknown>;
}

/**
 * Load balancer configuration
 */
export interface LoadBalancerConfig {
  serviceName: string;
  strategy: LoadBalancingStrategy;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
  enableSessionAffinity: boolean;
  sessionAffinityTTL: number;
}

/**
 * Load balancer statistics
 */
export interface LoadBalancerStats {
  serviceName: string;
  totalInstances: number;
  healthyInstances: number;
  unhealthyInstances: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  currentConnections: number;
  maxConnections: number;
}

/**
 * Load balancer result
 */
export interface LoadBalancerResult {
  instance: BackendInstance | null;
  reason: string;
  availableInstances: number;
  totalInstances: number;
}

/**
 * Session affinity entry
 */
interface SessionAffinityEntry {
  instanceId: string;
  createdAt: number;
  lastAccessed: number;
  requestCount: number;
}

/**
 * Default load balancer configurations
 */
export const DEFAULT_LOAD_BALANCER_CONFIGS: Record<string, Partial<LoadBalancerConfig>> = {
  database: {
    strategy: 'least_connections',
    healthCheckInterval: 10000,
    healthCheckTimeout: 5000,
    unhealthyThreshold: 3,
    healthyThreshold: 2,
    enableSessionAffinity: false,
    sessionAffinityTTL: 300000,
  },
  ai_service: {
    strategy: 'weighted',
    healthCheckInterval: 30000,
    healthCheckTimeout: 10000,
    unhealthyThreshold: 5,
    healthyThreshold: 3,
    enableSessionAffinity: false,
    sessionAffinityTTL: 0,
  },
  cache: {
    strategy: 'round_robin',
    healthCheckInterval: 5000,
    healthCheckTimeout: 2000,
    unhealthyThreshold: 3,
    healthyThreshold: 2,
    enableSessionAffinity: true,
    sessionAffinityTTL: 60000,
  },
  api_gateway: {
    strategy: 'least_connections',
    healthCheckInterval: 10000,
    healthCheckTimeout: 5000,
    unhealthyThreshold: 3,
    healthyThreshold: 2,
    enableSessionAffinity: true,
    sessionAffinityTTL: 300000,
  },
  default: {
    strategy: 'round_robin',
    healthCheckInterval: 30000,
    healthCheckTimeout: 10000,
    unhealthyThreshold: 3,
    healthyThreshold: 2,
    enableSessionAffinity: false,
    sessionAffinityTTL: 0,
  },
};

/**
 * Backend Load Balancer
 * 
 * Singleton class that provides load balancing for backend service instances.
 */
export class BackendLoadBalancer {
  private static instance: BackendLoadBalancer | null = null;
  
  // Service pools - Map of service name to instances
  private pools: Map<string, BackendInstance[]> = new Map();
  
  // Configurations per service
  private configs: Map<string, LoadBalancerConfig> = new Map();
  
  // Round-robin counters
  private roundRobinCounters: Map<string, number> = new Map();
  
  // Session affinity storage
  private sessionAffinity: Map<string, SessionAffinityEntry> = new Map();
  
  // Health check timers
  private healthCheckTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  
  // Health check functions
  private healthCheckers: Map<string, (instance: BackendInstance) => Promise<boolean>> = new Map();
  
  // Event listeners
  private eventListeners: Set<BackendEventListener> = new Set();
  
  // Statistics per service
  private stats: Map<string, {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    latencies: number[];
  }> = new Map();

  private constructor() {
    // Initialize default configurations
    for (const [serviceName, config] of Object.entries(DEFAULT_LOAD_BALANCER_CONFIGS)) {
      this.configs.set(serviceName, {
        serviceName,
        strategy: 'round_robin',
        healthCheckInterval: 30000,
        healthCheckTimeout: 10000,
        unhealthyThreshold: 3,
        healthyThreshold: 2,
        enableSessionAffinity: false,
        sessionAffinityTTL: 0,
        ...config,
      });
    }
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): BackendLoadBalancer {
    if (!BackendLoadBalancer.instance) {
      BackendLoadBalancer.instance = new BackendLoadBalancer();
    }
    return BackendLoadBalancer.instance;
  }

  /**
   * Configure load balancer for a service
   */
  configureService(config: LoadBalancerConfig): void {
    this.configs.set(config.serviceName, config);
    
    if (!this.pools.has(config.serviceName)) {
      this.pools.set(config.serviceName, []);
    }
    
    if (!this.stats.has(config.serviceName)) {
      this.stats.set(config.serviceName, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        latencies: [],
      });
    }
    
    logger.log(`Load balancer configured for ${config.serviceName}: strategy=${config.strategy}`);
  }

  /**
   * Register a health checker for a service
   */
  registerHealthChecker(
    serviceName: string,
    checker: (instance: BackendInstance) => Promise<boolean>
  ): void {
    this.healthCheckers.set(serviceName, checker);
    this.startHealthChecking(serviceName);
    logger.log(`Health checker registered for ${serviceName}`);
  }

  /**
   * Add an instance to a service pool
   */
  addInstance(serviceName: string, instance: Omit<BackendInstance, 'currentConnections' | 'status' | 'lastHealthCheck' | 'consecutiveFailures'>): string {
    const pool = this.pools.get(serviceName) || [];
    
    // Check for duplicate
    const existing = pool.find(i => i.id === instance.id || (i.host === instance.host && i.port === instance.port));
    if (existing) {
      logger.warn(`Instance ${instance.id} already exists in ${serviceName} pool`);
      return existing.id;
    }
    
    const fullInstance: BackendInstance = {
      ...instance,
      currentConnections: 0,
      status: 'initializing',
      lastHealthCheck: null,
      consecutiveFailures: 0,
    };
    
    pool.push(fullInstance);
    this.pools.set(serviceName, pool);
    
    this.emitEvent({
      type: BackendEventType.SERVICE_REGISTERED,
      timestamp: Date.now(),
      service: serviceName,
      data: { instanceId: instance.id, host: instance.host, port: instance.port },
      severity: 'info',
    });
    
    logger.log(`Instance ${instance.id} added to ${serviceName} pool (${instance.host}:${instance.port})`);
    return instance.id;
  }

  /**
   * Remove an instance from a service pool
   */
  removeInstance(serviceName: string, instanceId: string): boolean {
    const pool = this.pools.get(serviceName);
    if (!pool) {
      return false;
    }
    
    const index = pool.findIndex(i => i.id === instanceId);
    if (index === -1) {
      return false;
    }
    
    pool.splice(index, 1);
    
    // Clear session affinity for this instance
    for (const [key, entry] of this.sessionAffinity) {
      if (entry.instanceId === instanceId) {
        this.sessionAffinity.delete(key);
      }
    }
    
    this.emitEvent({
      type: BackendEventType.SERVICE_UNREGISTERED,
      timestamp: Date.now(),
      service: serviceName,
      data: { instanceId },
      severity: 'info',
    });
    
    logger.log(`Instance ${instanceId} removed from ${serviceName} pool`);
    return true;
  }

  /**
   * Get the next instance for a request
   */
  getNextInstance(serviceName: string, sessionKey?: string): LoadBalancerResult {
    const pool = this.pools.get(serviceName);
    const config = this.configs.get(serviceName);
    
    if (!pool || pool.length === 0) {
      return {
        instance: null,
        reason: 'No instances available in pool',
        availableInstances: 0,
        totalInstances: 0,
      };
    }
    
    const healthyInstances = pool.filter(i => i.status === 'healthy');
    
    if (healthyInstances.length === 0) {
      return {
        instance: null,
        reason: 'No healthy instances available',
        availableInstances: 0,
        totalInstances: pool.length,
      };
    }
    
    // Check session affinity first
    if (config?.enableSessionAffinity && sessionKey) {
      const affinity = this.sessionAffinity.get(sessionKey);
      if (affinity) {
        const instance = healthyInstances.find(i => i.id === affinity.instanceId);
        if (instance && Date.now() - affinity.createdAt < (config.sessionAffinityTTL || 0)) {
          affinity.lastAccessed = Date.now();
          affinity.requestCount++;
          return {
            instance,
            reason: 'Session affinity match',
            availableInstances: healthyInstances.length,
            totalInstances: pool.length,
          };
        }
      }
    }
    
    // Apply load balancing strategy
    const selectedInstance = this.selectInstanceByStrategy(serviceName, healthyInstances, config?.strategy || 'round_robin');
    
    // Update session affinity
    if (config?.enableSessionAffinity && sessionKey && selectedInstance) {
      this.sessionAffinity.set(sessionKey, {
        instanceId: selectedInstance.id,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        requestCount: 1,
      });
    }
    
    return {
      instance: selectedInstance,
      reason: `Selected via ${config?.strategy || 'round_robin'} strategy`,
      availableInstances: healthyInstances.length,
      totalInstances: pool.length,
    };
  }

  /**
   * Acquire a connection to an instance
   */
  acquireConnection(serviceName: string, instanceId: string): boolean {
    const pool = this.pools.get(serviceName);
    if (!pool) {
      return false;
    }
    
    const instance = pool.find(i => i.id === instanceId);
    if (!instance || instance.status !== 'healthy') {
      return false;
    }
    
    if (instance.currentConnections >= instance.maxConnections) {
      logger.warn(`Instance ${instanceId} at max connections (${instance.maxConnections})`);
      return false;
    }
    
    instance.currentConnections++;
    return true;
  }

  /**
   * Release a connection from an instance
   */
  releaseConnection(serviceName: string, instanceId: string): void {
    const pool = this.pools.get(serviceName);
    if (!pool) {
      return;
    }
    
    const instance = pool.find(i => i.id === instanceId);
    if (instance && instance.currentConnections > 0) {
      instance.currentConnections--;
    }
  }

  /**
   * Record a request result
   */
  recordRequest(serviceName: string, instanceId: string, success: boolean, latency: number): void {
    const stats = this.stats.get(serviceName);
    if (stats) {
      stats.totalRequests++;
      if (success) {
        stats.successfulRequests++;
      } else {
        stats.failedRequests++;
      }
      stats.latencies.push(latency);
      if (stats.latencies.length > 1000) {
        stats.latencies.shift();
      }
    }
    
    // Update instance status based on result
    const pool = this.pools.get(serviceName);
    if (pool) {
      const instance = pool.find(i => i.id === instanceId);
      if (instance) {
        if (!success) {
          instance.consecutiveFailures++;
          const config = this.configs.get(serviceName);
          if (instance.consecutiveFailures >= (config?.unhealthyThreshold || 3)) {
            this.updateInstanceStatus(serviceName, instance, 'unhealthy');
          }
        } else {
          instance.consecutiveFailures = 0;
        }
      }
    }
  }

  /**
   * Get load balancer statistics
   */
  getStats(serviceName: string): LoadBalancerStats {
    const pool = this.pools.get(serviceName) || [];
    const stats = this.stats.get(serviceName);
    
    const healthyInstances = pool.filter(i => i.status === 'healthy').length;
    const unhealthyInstances = pool.filter(i => i.status === 'unhealthy').length;
    
    const latencies = stats?.latencies || [];
    const averageLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;
    
    const currentConnections = pool.reduce((sum, i) => sum + i.currentConnections, 0);
    const maxConnections = pool.reduce((sum, i) => sum + i.maxConnections, 0);
    
    return {
      serviceName,
      totalInstances: pool.length,
      healthyInstances,
      unhealthyInstances,
      totalRequests: stats?.totalRequests || 0,
      successfulRequests: stats?.successfulRequests || 0,
      failedRequests: stats?.failedRequests || 0,
      averageLatency,
      currentConnections,
      maxConnections,
    };
  }

  /**
   * Get all instances for a service
   */
  getInstances(serviceName: string): BackendInstance[] {
    return this.pools.get(serviceName) || [];
  }

  /**
   * Get instance by ID
   */
  getInstance(serviceName: string, instanceId: string): BackendInstance | undefined {
    const pool = this.pools.get(serviceName);
    return pool?.find(i => i.id === instanceId);
  }

  /**
   * Check health of all instances for a service
   */
  async checkHealth(serviceName: string): Promise<Map<string, boolean>> {
    const pool = this.pools.get(serviceName);
    const checker = this.healthCheckers.get(serviceName);
    const config = this.configs.get(serviceName);
    
    const results = new Map<string, boolean>();
    
    if (!pool || !checker) {
      return results;
    }
    
    const checkPromises = pool.map(async (instance) => {
      try {
        const isHealthy = await Promise.race([
          checker(instance),
          this.createTimeoutPromise(config?.healthCheckTimeout || 10000),
        ]);
        
        instance.lastHealthCheck = Date.now();
        
        if (isHealthy) {
          instance.consecutiveFailures = 0;
          if (instance.status !== 'healthy') {
            this.updateInstanceStatus(serviceName, instance, 'healthy');
          }
          results.set(instance.id, true);
        } else {
          throw new Error('Health check returned false');
        }
      } catch {
        instance.consecutiveFailures++;
        results.set(instance.id, false);
        
        if (instance.consecutiveFailures >= (config?.unhealthyThreshold || 3)) {
          this.updateInstanceStatus(serviceName, instance, 'unhealthy');
        } else if (instance.status === 'healthy') {
          this.updateInstanceStatus(serviceName, instance, 'degraded');
        }
      }
    });
    
    await Promise.allSettled(checkPromises);
    return results;
  }

  /**
   * Subscribe to load balancer events
   */
  subscribe(listener: BackendEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  // Private methods

  private selectInstanceByStrategy(
    serviceName: string,
    instances: BackendInstance[],
    strategy: LoadBalancingStrategy
  ): BackendInstance {
    switch (strategy) {
      case 'round_robin':
        return this.selectRoundRobin(serviceName, instances);
      case 'least_connections':
        return this.selectLeastConnections(instances);
      case 'weighted':
        return this.selectWeighted(instances);
      case 'random':
        return this.selectRandom(instances);
      case 'ip_hash':
        return this.selectRoundRobin(serviceName, instances); // Fallback to round-robin
      default:
        return this.selectRoundRobin(serviceName, instances);
    }
  }

  private selectRoundRobin(serviceName: string, instances: BackendInstance[]): BackendInstance {
    const counter = this.roundRobinCounters.get(serviceName) || 0;
    const index = counter % instances.length;
    this.roundRobinCounters.set(serviceName, counter + 1);
    return instances[index]!;
  }

  private selectLeastConnections(instances: BackendInstance[]): BackendInstance {
    return instances.reduce((min, instance) => 
      instance.currentConnections < min.currentConnections ? instance : min
    );
  }

  private selectWeighted(instances: BackendInstance[]): BackendInstance {
    const totalWeight = instances.reduce((sum, i) => sum + i.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }
    
    return instances[instances.length - 1]!;
  }

  private selectRandom(instances: BackendInstance[]): BackendInstance {
    const index = Math.floor(Math.random() * instances.length);
    return instances[index]!;
  }

  private updateInstanceStatus(
    serviceName: string,
    instance: BackendInstance,
    status: BackendServiceStatus
  ): void {
    const previousStatus = instance.status;
    instance.status = status;
    
    this.emitEvent({
      type: BackendEventType.SERVICE_HEALTH_CHANGED,
      timestamp: Date.now(),
      service: serviceName,
      data: {
        instanceId: instance.id,
        previousStatus,
        newStatus: status,
      },
      severity: status === 'unhealthy' ? 'error' : status === 'degraded' ? 'warning' : 'info',
    });
    
    logger.log(`Instance ${instance.id} status changed: ${previousStatus} -> ${status}`);
  }

  private startHealthChecking(serviceName: string): void {
    if (this.healthCheckTimers.has(serviceName)) {
      return;
    }
    
    const config = this.configs.get(serviceName);
    const interval = config?.healthCheckInterval || 30000;
    
    const timer = setInterval(async () => {
      try {
        await this.checkHealth(serviceName);
      } catch (error) {
        logger.error(`Health check error for ${serviceName}:`, error);
      }
    }, interval);
    
    this.healthCheckTimers.set(serviceName, timer);
    logger.log(`Health checking started for ${serviceName} (interval: ${interval}ms)`);
  }

  private stopHealthChecking(serviceName: string): void {
    const timer = this.healthCheckTimers.get(serviceName);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(serviceName);
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
   * Cleanup and destroy the load balancer
   */
  destroy(): void {
    // Stop all health check timers
    for (const serviceName of this.healthCheckTimers.keys()) {
      this.stopHealthChecking(serviceName);
    }
    
    // Clear all data
    this.pools.clear();
    this.configs.clear();
    this.roundRobinCounters.clear();
    this.sessionAffinity.clear();
    this.healthCheckers.clear();
    this.stats.clear();
    this.eventListeners.clear();
    
    BackendLoadBalancer.instance = null;
    logger.log('Load balancer destroyed');
  }
}

// Export singleton instance
export const backendLoadBalancer = BackendLoadBalancer.getInstance();

/**
 * Helper function to get next instance
 */
export function getNextBackendInstance(
  serviceName: string,
  sessionKey?: string
): LoadBalancerResult {
  return backendLoadBalancer.getNextInstance(serviceName, sessionKey);
}

/**
 * Helper function to acquire a connection
 */
export function acquireBackendConnection(
  serviceName: string,
  instanceId: string
): boolean {
  return backendLoadBalancer.acquireConnection(serviceName, instanceId);
}

/**
 * Helper function to release a connection
 */
export function releaseBackendConnection(
  serviceName: string,
  instanceId: string
): void {
  backendLoadBalancer.releaseConnection(serviceName, instanceId);
}

/**
 * Helper function to record a request result
 */
export function recordBackendRequest(
  serviceName: string,
  instanceId: string,
  success: boolean,
  latency: number
): void {
  backendLoadBalancer.recordRequest(serviceName, instanceId, success, latency);
}
