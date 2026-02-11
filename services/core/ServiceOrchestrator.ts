/**
 * Service Orchestrator - Central Service Management and Coordination
 * 
 * Manages all modular services, health monitoring, and dependency injection
 */

import { 
  IServiceOrchestrator, 
  ServiceHealthStatus, 
  SERVICE_TOKENS,
  IDatabaseCore,
  ICacheManager,
  IConnectionPool,
  IAnalyticsCollector,
  IAICore,
  IWorkerManager,
  IRateLimiter,
} from '../../types/serviceInterfaces';
import { globalContainer, registerService } from './DIContainer';
import { DatabaseCore } from '../database/DatabaseCore';
import { CacheManager } from '../cache/CacheManager';
import { ConnectionPool } from '../database/ConnectionPool';
import { AnalyticsCollector } from '../analytics/AnalyticsCollector';
import { AICore } from '../ai/AICore';
import { WorkerManager } from '../ai/WorkerManager';
import { RateLimiter } from '../ai/RateLimiter';
import { createScopedLogger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/errorHandler';

const logger = createScopedLogger('ServiceOrchestrator');

export class ServiceOrchestrator implements IServiceOrchestrator {
  private isInitialized = false;
  private healthStatus: ServiceHealthStatus = {};
  private healthCheckTimer?: ReturnType<typeof setInterval>;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Service Orchestrator already initialized');
      return;
    }

    logger.info('Initializing Service Orchestrator...');

    try {
      // Register all services with dependency injection container
      await this.registerServices();
      
      // Initialize all services
      await this.initializeServices();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isInitialized = true;
      logger.info('Service Orchestrator initialized successfully');
    } catch (error: unknown) {
      logger.error('Failed to initialize Service Orchestrator:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.isInitialized) return;

    logger.info('Destroying Service Orchestrator...');

    try {
      // Stop health monitoring
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }

      // Dispose all services through container
      await globalContainer.dispose();
      
      this.isInitialized = false;
      this.healthStatus = {};
      
      logger.info('Service Orchestrator destroyed successfully');
    } catch (error: unknown) {
      logger.error('Error destroying Service Orchestrator:', error);
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isInitialized) return false;

    try {
      const health = await this.getServiceHealth();
      const healthyServices = Object.values(health).filter(healthy => healthy).length;
      const totalServices = Object.keys(health).length;
      
      return healthyServices === totalServices;
    } catch (error: unknown) {
      logger.error('Service Orchestrator health check failed:', error);
      return false;
    }
  }

  async initializeServices(): Promise<void> {
    logger.info('Initializing all services...');

    const services = [
      SERVICE_TOKENS.DATABASE_CORE,
      SERVICE_TOKENS.CACHE_MANAGER,
      SERVICE_TOKENS.CONNECTION_POOL,
      SERVICE_TOKENS.ANALYTICS_COLLECTOR,
      SERVICE_TOKENS.AI_CORE,
      SERVICE_TOKENS.WORKER_MANAGER,
      SERVICE_TOKENS.RATE_LIMITER,
    ];

    for (const token of services) {
      try {
        logger.info(`Initializing service: ${token}`);
        const service = await globalContainer.get(token);
        
        // Health check after initialization
        const isHealthy = await (service as any).isHealthy?.();
        const isServiceHealthy = typeof isHealthy === 'boolean' ? isHealthy : true;
        this.healthStatus[token] = {
          healthy: isServiceHealthy,
          lastCheck: new Date(),
          error: !isServiceHealthy ? 'Service reported unhealthy' : undefined,
        };
        
        logger.info(`Service ${token} initialized${isHealthy === false ? ' with warnings' : ' successfully'}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.healthStatus[token] = {
          healthy: false,
          lastCheck: new Date(),
          error: errorMessage,
        };
        logger.error(`Failed to initialize service ${token}:`, errorMessage);
        
        // Continue with other services - don't let one failure stop everything
      }
    }

    logger.info('Service initialization completed');
  }

  async shutdownServices(): Promise<void> {
    logger.info('Shutting down all services...');
    
    // Container dispose will handle all service destruction
    await globalContainer.dispose();
    this.healthStatus = {};
    
    logger.info('All services shut down');
  }

  async getService<T>(token: string): Promise<T> {
    if (!this.isInitialized) {
      throw new Error('Service Orchestrator not initialized');
    }

    try {
      return await globalContainer.get<T>(token);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get service ${token}:`, errorMessage);
      throw error;
    }
  }

  async getServiceHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [token, status] of Object.entries(this.healthStatus)) {
// Do a quick health check
      try {
        const service = await globalContainer.get(token);
        const isHealthy = await (service as any).isHealthy?.();
        
        // Update status
        this.healthStatus[token] = {
          healthy: isHealthy !== false,
          lastCheck: new Date(),
          responseTime: Date.now() - status.lastCheck.getTime(),
        };
        
        health[token] = isHealthy !== false;
      } catch (error: unknown) {
        this.healthStatus[token] = {
          healthy: false,
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
        health[token] = false;
      }
    }

    return health;
  }

  // Private helper methods

  private async registerServices(): Promise<void> {
    logger.info('Registering services with dependency injection...');

    // Database Core
    registerService(globalContainer, SERVICE_TOKENS.DATABASE_CORE, () => new DatabaseCore());
    
    // Cache Manager
    registerService(globalContainer, SERVICE_TOKENS.CACHE_MANAGER, () => new CacheManager());
    
    // Connection Pool
    registerService(globalContainer, SERVICE_TOKENS.CONNECTION_POOL, () => new ConnectionPool());
    
    // Analytics Collector
    registerService(globalContainer, SERVICE_TOKENS.ANALYTICS_COLLECTOR, () => new AnalyticsCollector());
    
    // AI Core
    registerService(globalContainer, SERVICE_TOKENS.AI_CORE, () => new AICore());
    
    // Worker Manager
    registerService(globalContainer, SERVICE_TOKENS.WORKER_MANAGER, () => new WorkerManager());
    
    // Rate Limiter
    registerService(globalContainer, SERVICE_TOKENS.RATE_LIMITER, () => new RateLimiter());

    logger.info('All services registered successfully');
  }

  private startHealthMonitoring(): void {
    // Run health checks every 30 seconds
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000);

    logger.info('Health monitoring started');
  }

  private async performHealthChecks(): Promise<void> {
    try {
      const healthResults = await this.getServiceHealth();
      const unhealthyServices = Object.entries(healthResults)
        .filter(([_, healthy]) => !healthy)
        .map(([token, _]) => token);

      if (unhealthyServices.length > 0) {
        logger.warn(`Unhealthy services detected: ${unhealthyServices.join(', ')}`);
        
        // Attempt to recover unhealthy services
        await this.attemptServiceRecovery(unhealthyServices);
      } else {
        logger.debug('All services healthy');
      }
    } catch (error: unknown) {
      logger.error('Error during health checks:', error);
    }
  }

  private async attemptServiceRecovery(unhealthyServices: string[]): Promise<void> {
    for (const token of unhealthyServices) {
      try {
        logger.info(`Attempting to recover service: ${token}`);
        
        // For now, we'll just update the health status
        // In a full implementation, you might restart services
        const service = await globalContainer.get(token);
        const isHealthy = await (service as any).isHealthy?.();
        
        if (isHealthy !== false) {
          logger.info(`Service ${token} recovered successfully`);
          this.healthStatus[token].healthy = true;
          this.healthStatus[token].error = undefined;
        }
      } catch (error: unknown) {
        logger.error(`Failed to recover service ${token}:`, error);
      }
    }
  }

  // Public convenience methods

  async getDatabase(): Promise<IDatabaseCore> {
    return this.getService<IDatabaseCore>(SERVICE_TOKENS.DATABASE_CORE);
  }

  async getCache(): Promise<ICacheManager> {
    return this.getService<ICacheManager>(SERVICE_TOKENS.CACHE_MANAGER);
  }

  async getConnectionPool(): Promise<IConnectionPool> {
    return this.getService<IConnectionPool>(SERVICE_TOKENS.CONNECTION_POOL);
  }

  async getAnalytics(): Promise<IAnalyticsCollector> {
    return this.getService<IAnalyticsCollector>(SERVICE_TOKENS.ANALYTICS_COLLECTOR);
  }

  async getAICore(): Promise<IAICore> {
    return this.getService<IAICore>(SERVICE_TOKENS.AI_CORE);
  }

  async getWorkerManager(): Promise<IWorkerManager> {
    return this.getService<IWorkerManager>(SERVICE_TOKENS.WORKER_MANAGER);
  }

  async getRateLimiter(): Promise<IRateLimiter> {
    return this.getService<IRateLimiter>(SERVICE_TOKENS.RATE_LIMITER);
  }

  getDetailedHealthStatus(): ServiceHealthStatus {
    return { ...this.healthStatus };
  }

  getContainerDiagnostics() {
    return globalContainer.getDiagnostics();
  }

  async restartService(token: string): Promise<void> {
    if (!globalContainer.has(token)) {
      throw new Error(`Service ${token} not found`);
    }

    try {
      logger.info(`Restarting service: ${token}`);
      
      // Get and destroy the service
      const service = await globalContainer.get(token);
      await (service as any).destroy?.();
      
      // Clear the instance from container
      (globalContainer as any).instances.delete(token);
      
      // Re-initialize the service
      const newService = await globalContainer.get(token);
      const isHealthy = await (newService as any).isHealthy?.();
      
      this.healthStatus[token] = {
        healthy: isHealthy !== false,
        lastCheck: new Date(),
        error: isHealthy === false ? 'Service unhealthy after restart' : undefined,
      };
      
      logger.info(`Service ${token} restarted${isHealthy === false ? ' with issues' : ' successfully'}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to restart service ${token}:`, errorMessage);
      this.healthStatus[token] = {
        healthy: false,
        lastCheck: new Date(),
        error: errorMessage,
      };
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getRegisteredServices(): string[] {
    return globalContainer.getDiagnostics().registeredServices;
  }

  async getServiceStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    
    try {
      // Database stats
      const db = await this.getDatabase();
      stats.database = db.getConfig();
      
      // Cache stats
      const cache = await this.getCache();
      stats.cache = cache.getStats();
      
      // Connection pool stats
      const pool = await this.getConnectionPool();
      stats.connectionPool = pool.getPoolStats();
      
      // Worker manager stats
      const workers = await this.getWorkerManager();
      stats.workers = workers.getWorkerStats();
      
      // Rate limiter stats
      const rateLimiter = await this.getRateLimiter();
      stats.rateLimiter = {
        ...rateLimiter.getConfig(),
        // Add any additional stats that are available
      };
      
      return stats;
    } catch (error: unknown) {
      logger.error('Failed to collect service stats:', error);
      return { error: getErrorMessage(error) };
    }
  }
}

// Global orchestrator instance
export const globalOrchestrator = new ServiceOrchestrator();