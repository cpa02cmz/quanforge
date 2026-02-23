/**
 * Integration Service Discovery - Dynamic Service Discovery and Capability Registration
 * 
 * Provides comprehensive service discovery capabilities:
 * - Service registration with capabilities
 * - Dynamic service discovery by capability
 * - Service health and availability tracking
 * - Load balancing across service instances
 * - Service versioning and compatibility
 */

import { createScopedLogger } from '../../utils/logger';
import { TIMEOUTS, MEMORY_LIMITS } from '../../constants';
import {
  IntegrationStatus,
  IntegrationPriority,
  type IntegrationHealthCheckResult,
} from './types';
import { IntegrationType } from '../integrationResilience';

const logger = createScopedLogger('service-discovery');

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Service capability definition
 */
export interface ServiceCapability {
  /** Capability identifier */
  id: string;
  /** Capability name */
  name: string;
  /** Capability description */
  description?: string;
  /** Capability version */
  version: string;
  /** Required capabilities */
  requires?: string[];
  /** Capability parameters schema */
  parameters?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    default?: unknown;
    description?: string;
  }>;
}

/**
 * Service instance information
 */
export interface ServiceInstance {
  /** Unique instance identifier */
  id: string;
  /** Service name */
  name: string;
  /** Service type */
  type: IntegrationType;
  /** Service endpoint/URL */
  endpoint?: string;
  /** Service version */
  version: string;
  /** Service capabilities */
  capabilities: ServiceCapability[];
  /** Service metadata */
  metadata: Record<string, unknown>;
  /** Registration timestamp */
  registeredAt: Date;
  /** Last heartbeat timestamp */
  lastHeartbeat: Date;
  /** Service status */
  status: IntegrationStatus;
  /** Service priority */
  priority: IntegrationPriority;
  /** Health check function */
  healthCheck?: () => Promise<IntegrationHealthCheckResult>;
  /** Instance weight for load balancing (0-100) */
  weight: number;
  /** Instance tags for filtering */
  tags: string[];
}

/**
 * Service discovery query options
 */
export interface ServiceQueryOptions {
  /** Filter by service type */
  type?: IntegrationType;
  /** Filter by capability */
  capability?: string;
  /** Filter by tags */
  tags?: string[];
  /** Filter by status */
  status?: IntegrationStatus;
  /** Filter by minimum priority */
  minPriority?: IntegrationPriority;
  /** Require healthy instances only */
  healthyOnly?: boolean;
  /** Maximum results */
  limit?: number;
  /** Sort by field */
  sortBy?: 'priority' | 'weight' | 'lastHeartbeat' | 'registeredAt';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Service discovery result
 */
export interface ServiceDiscoveryResult {
  /** Matching services */
  services: ServiceInstance[];
  /** Total matching services */
  total: number;
  /** Query execution time in ms */
  queryTime: number;
  /** Whether results are from cache */
  fromCache: boolean;
}

/**
 * Load balancing strategy
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  RANDOM = 'random',
  PRIORITY_BASED = 'priority_based',
}

/**
 * Service discovery configuration
 */
export interface ServiceDiscoveryConfig {
  /** Heartbeat interval in ms */
  heartbeatInterval: number;
  /** Heartbeat timeout in ms */
  heartbeatTimeout: number;
  /** Enable caching */
  enableCache: boolean;
  /** Cache TTL in ms */
  cacheTTL: number;
  /** Maximum services in registry */
  maxServices: number;
  /** Default load balancing strategy */
  defaultLoadBalancingStrategy: LoadBalancingStrategy;
  /** Enable automatic cleanup of stale services */
  enableAutoCleanup: boolean;
  /** Cleanup interval in ms */
  cleanupInterval: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ServiceDiscoveryConfig = {
  heartbeatInterval: TIMEOUTS.HEALTH_CHECK || 30000,
  heartbeatTimeout: 90000, // 3x heartbeat interval
  enableCache: true,
  cacheTTL: 5000,
  maxServices: MEMORY_LIMITS.MAX_HISTORY_SIZE || 100,
  defaultLoadBalancingStrategy: LoadBalancingStrategy.PRIORITY_BASED,
  enableAutoCleanup: true,
  cleanupInterval: 60000,
};

// ============================================================================
// Service Discovery Manager
// ============================================================================

/**
 * Service Discovery Manager
 * 
 * Manages service registration, discovery, and load balancing
 */
export class ServiceDiscoveryManager {
  private static instance: ServiceDiscoveryManager | null = null;
  
  private readonly config: ServiceDiscoveryConfig;
  private readonly services = new Map<string, ServiceInstance>();
  private readonly capabilityIndex = new Map<string, Set<string>>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private readonly queryCache = new Map<string, { result: ServiceDiscoveryResult; timestamp: number }>();
  
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private roundRobinCounters = new Map<string, number>();
  private connectionCounts = new Map<string, number>();
  
  private isInitialized = false;
  private serviceIdCounter = 0;

  private constructor(config: Partial<ServiceDiscoveryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('Service Discovery Manager created');
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ServiceDiscoveryConfig>): ServiceDiscoveryManager {
    if (!ServiceDiscoveryManager.instance) {
      ServiceDiscoveryManager.instance = new ServiceDiscoveryManager(config);
    }
    return ServiceDiscoveryManager.instance;
  }

  /**
   * Initialize the service discovery manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Service Discovery Manager already initialized');
      return;
    }

    logger.info('Initializing Service Discovery Manager...');

    // Start heartbeat monitoring
    if (this.config.enableAutoCleanup) {
      this.startHeartbeatMonitoring();
      this.startCleanupTimer();
    }

    this.isInitialized = true;
    logger.info('Service Discovery Manager initialized');
  }

  /**
   * Register a service instance
   */
  registerService(options: {
    name: string;
    type: IntegrationType;
    endpoint?: string;
    version?: string;
    capabilities?: ServiceCapability[];
    metadata?: Record<string, unknown>;
    priority?: IntegrationPriority;
    healthCheck?: () => Promise<IntegrationHealthCheckResult>;
    weight?: number;
    tags?: string[];
  }): ServiceInstance {
    if (this.services.size >= this.config.maxServices) {
      throw new Error('Maximum number of services reached');
    }

    const id = `svc-${++this.serviceIdCounter}`;
    const now = new Date();
    
    const instance: ServiceInstance = {
      id,
      name: options.name,
      type: options.type,
      endpoint: options.endpoint,
      version: options.version || '1.0.0',
      capabilities: options.capabilities || [],
      metadata: options.metadata || {},
      registeredAt: now,
      lastHeartbeat: now,
      status: IntegrationStatus.UNKNOWN,
      priority: options.priority ?? IntegrationPriority.MEDIUM,
      healthCheck: options.healthCheck,
      weight: options.weight ?? 50,
      tags: options.tags || [],
    };

    this.services.set(id, instance);

    // Update capability index
    instance.capabilities.forEach(cap => {
      if (!this.capabilityIndex.has(cap.id)) {
        this.capabilityIndex.set(cap.id, new Set());
      }
      this.capabilityIndex.get(cap.id)!.add(id);
    });

    // Update tag index
    instance.tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(id);
    });

    // Clear query cache
    this.queryCache.clear();

    logger.info(`Service registered: ${instance.name}`, {
      id,
      type: instance.type,
      capabilities: instance.capabilities.length,
      priority: instance.priority,
    });

    return instance;
  }

  /**
   * Unregister a service instance
   */
  unregisterService(serviceId: string): boolean {
    const instance = this.services.get(serviceId);
    if (!instance) return false;

    // Remove from capability index
    instance.capabilities.forEach(cap => {
      this.capabilityIndex.get(cap.id)?.delete(serviceId);
    });

    // Remove from tag index
    instance.tags.forEach(tag => {
      this.tagIndex.get(tag)?.delete(serviceId);
    });

    this.services.delete(serviceId);
    this.connectionCounts.delete(serviceId);
    this.roundRobinCounters.delete(serviceId);

    // Clear query cache
    this.queryCache.clear();

    logger.info(`Service unregistered: ${instance.name}`, { id: serviceId });

    return true;
  }

  /**
   * Send heartbeat for a service
   */
  heartbeat(serviceId: string): boolean {
    const instance = this.services.get(serviceId);
    if (!instance) return false;

    instance.lastHeartbeat = new Date();
    
    if (instance.status === IntegrationStatus.UNHEALTHY) {
      instance.status = IntegrationStatus.HEALTHY;
      logger.info(`Service recovered: ${instance.name}`, { id: serviceId });
    }

    return true;
  }

  /**
   * Discover services matching query options
   */
  discoverServices(options: ServiceQueryOptions = {}): ServiceDiscoveryResult {
    const startTime = Date.now();
    const cacheKey = JSON.stringify(options);

    // Check cache
    if (this.config.enableCache) {
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
        return { ...cached.result, fromCache: true };
      }
    }

    let filtered = Array.from(this.services.values());

    // Apply filters
    if (options.type) {
      filtered = filtered.filter(s => s.type === options.type);
    }

    if (options.capability) {
      const serviceIds = this.capabilityIndex.get(options.capability);
      if (serviceIds) {
        filtered = filtered.filter(s => serviceIds.has(s.id));
      } else {
        filtered = [];
      }
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(s => 
        options.tags!.some(tag => s.tags.includes(tag))
      );
    }

    if (options.status) {
      filtered = filtered.filter(s => s.status === options.status);
    }

    if (options.minPriority !== undefined) {
      filtered = filtered.filter(s => s.priority <= options.minPriority!);
    }

    if (options.healthyOnly) {
      filtered = filtered.filter(s => s.status === IntegrationStatus.HEALTHY);
    }

    // Sort results
    if (options.sortBy) {
      const direction = options.sortDirection === 'desc' ? -1 : 1;
      filtered.sort((a, b) => {
        switch (options.sortBy) {
          case 'priority':
            return (a.priority - b.priority) * direction;
          case 'weight':
            return (a.weight - b.weight) * direction;
          case 'lastHeartbeat':
            return (a.lastHeartbeat.getTime() - b.lastHeartbeat.getTime()) * direction;
          case 'registeredAt':
            return (a.registeredAt.getTime() - b.registeredAt.getTime()) * direction;
          default:
            return 0;
        }
      });
    }

    // Apply limit
    const total = filtered.length;
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    const result: ServiceDiscoveryResult = {
      services: filtered,
      total,
      queryTime: Date.now() - startTime,
      fromCache: false,
    };

    // Cache result
    if (this.config.enableCache) {
      this.queryCache.set(cacheKey, { result, timestamp: Date.now() });
    }

    return result;
  }

  /**
   * Get a single service instance using load balancing
   */
  getService(
    options: ServiceQueryOptions = {},
    strategy: LoadBalancingStrategy = this.config.defaultLoadBalancingStrategy
  ): ServiceInstance | undefined {
    const result = this.discoverServices({ ...options, healthyOnly: true });
    if (result.services.length === 0) return undefined;

    return this.applyLoadBalancing(result.services, strategy);
  }

  /**
   * Get service by ID
   */
  getServiceById(serviceId: string): ServiceInstance | undefined {
    return this.services.get(serviceId);
  }

  /**
   * Get all capabilities
   */
  getAllCapabilities(): ServiceCapability[] {
    const capabilities = new Map<string, ServiceCapability>();
    
    this.services.forEach(service => {
      service.capabilities.forEach(cap => {
        if (!capabilities.has(cap.id)) {
          capabilities.set(cap.id, cap);
        }
      });
    });

    return Array.from(capabilities.values());
  }

  /**
   * Get services by capability
   */
  getServicesByCapability(capabilityId: string): ServiceInstance[] {
    const serviceIds = this.capabilityIndex.get(capabilityId);
    if (!serviceIds) return [];

    return Array.from(serviceIds)
      .map(id => this.services.get(id))
      .filter((s): s is ServiceInstance => s !== undefined);
  }

  /**
   * Update service status
   */
  updateServiceStatus(serviceId: string, status: IntegrationStatus): boolean {
    const instance = this.services.get(serviceId);
    if (!instance) return false;

    instance.status = status;
    this.queryCache.clear();

    logger.debug(`Service status updated: ${instance.name}`, {
      id: serviceId,
      status,
    });

    return true;
  }

  /**
   * Get discovery statistics
   */
  getStatistics(): {
    totalServices: number;
    servicesByType: Record<string, number>;
    servicesByStatus: Record<string, number>;
    totalCapabilities: number;
    servicesByPriority: Record<string, number>;
    healthyPercentage: number;
  } {
    const servicesByType: Record<string, number> = {};
    const servicesByStatus: Record<string, number> = {};
    const servicesByPriority: Record<string, number> = {};
    let healthyCount = 0;

    this.services.forEach(service => {
      const typeKey = service.type;
      servicesByType[typeKey] = (servicesByType[typeKey] || 0) + 1;

      const statusKey = service.status;
      servicesByStatus[statusKey] = (servicesByStatus[statusKey] || 0) + 1;

      const priorityKey = `priority_${service.priority}`;
      servicesByPriority[priorityKey] = (servicesByPriority[priorityKey] || 0) + 1;

      if (service.status === IntegrationStatus.HEALTHY) {
        healthyCount++;
      }
    });

    return {
      totalServices: this.services.size,
      servicesByType,
      servicesByStatus,
      totalCapabilities: this.capabilityIndex.size,
      servicesByPriority,
      healthyPercentage: this.services.size > 0 
        ? (healthyCount / this.services.size) * 100 
        : 0,
    };
  }

  /**
   * Shutdown the service discovery manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Service Discovery Manager...');

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.services.clear();
    this.capabilityIndex.clear();
    this.tagIndex.clear();
    this.queryCache.clear();
    this.roundRobinCounters.clear();
    this.connectionCounts.clear();

    this.isInitialized = false;
    logger.info('Service Discovery Manager shut down');
  }

  // Private methods

  private applyLoadBalancing(
    services: ServiceInstance[],
    strategy: LoadBalancingStrategy
  ): ServiceInstance {
    // Return first service if only one available
    if (services.length === 1) return services[0]!;

    switch (strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN: {
        const key = 'default';
        const counter = (this.roundRobinCounters.get(key) || 0) % services.length;
        this.roundRobinCounters.set(key, counter + 1);
        return services[counter]!;
      }

      case LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN: {
        const totalWeight = services.reduce((sum, s) => sum + s.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const service of services) {
          random -= service.weight;
          if (random <= 0) return service;
        }
        
        return services[0]!;
      }

      case LoadBalancingStrategy.LEAST_CONNECTIONS: {
        let minService = services[0]!;
        let minConns = this.connectionCounts.get(minService.id) || 0;
        
        for (const s of services) {
          const sConns = this.connectionCounts.get(s.id) || 0;
          if (sConns < minConns) {
            minService = s;
            minConns = sConns;
          }
        }
        return minService;
      }

      case LoadBalancingStrategy.RANDOM: {
        return services[Math.floor(Math.random() * services.length)]!;
      }

      case LoadBalancingStrategy.PRIORITY_BASED: {
        // Sort by priority then weight
        const sorted = [...services].sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return b.weight - a.weight;
        });
        return sorted[0]!;
      }

      default:
        return services[0]!;
    }
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatTimer = setInterval(async () => {
      await this.runHealthChecks();
    }, this.config.heartbeatInterval);
  }

  private async runHealthChecks(): Promise<void> {
    const now = Date.now();
    const timeoutThreshold = now - this.config.heartbeatTimeout;

    for (const [id, instance] of this.services) {
      // Check for stale heartbeats
      if (instance.lastHeartbeat.getTime() < timeoutThreshold) {
        instance.status = IntegrationStatus.UNHEALTHY;
        logger.warn(`Service heartbeat timeout: ${instance.name}`, { id });
        continue;
      }

      // Run health check if available
      if (instance.healthCheck) {
        try {
          const result = await instance.healthCheck();
          instance.status = result.healthy ? IntegrationStatus.HEALTHY : IntegrationStatus.UNHEALTHY;
        } catch {
          instance.status = IntegrationStatus.UNHEALTHY;
        }
      }
    }

    this.queryCache.clear();
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleServices();
    }, this.config.cleanupInterval);
  }

  private cleanupStaleServices(): void {
    const now = Date.now();
    const staleThreshold = now - (this.config.heartbeatTimeout * 3);

    const staleIds: string[] = [];

    this.services.forEach((instance, id) => {
      if (instance.lastHeartbeat.getTime() < staleThreshold) {
        staleIds.push(id);
      }
    });

    if (staleIds.length > 0) {
      logger.info(`Cleaning up ${staleIds.length} stale services`);
      staleIds.forEach(id => this.unregisterService(id));
    }
  }
}

// Export singleton instance
export const serviceDiscovery = ServiceDiscoveryManager.getInstance();
