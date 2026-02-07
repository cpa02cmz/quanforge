/**
 * Dependency Injection Container
 * Provides IoC pattern for service management with lifecycle and health monitoring
 */

import type { IService } from './ServiceInterfaces';

// Service container implementation
class ServiceContainer {
  private services = new Map<string, IService>();
  private instances = new Map<string, IService>();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private startTime = Date.now();

  /**
   * Register a service with the container
   */
  register<T extends IService>(name: string, implementation: new () => T): void {
    this.services.set(name, new implementation());
  }

  /**
   * Register a service instance
   */
  registerInstance(name: string, instance: IService): void {
    this.services.set(name, instance);
  }

  /**
   * Get a service instance
   */
  async get<T extends IService>(name: string): Promise<T> {
    if (!this.services.has(name)) {
      throw new Error(`Service '${name}' not registered`);
    }

    if (!this.instances.has(name)) {
      const service = this.services.get(name)!;
      await service.initialize();
      this.instances.set(name, service);
    }

    return this.instances.get(name) as T;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Initialize all services in dependency order
   */
  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
      try {
        await service.initialize();
        this.instances.set(name, service);
        console.log(`✅ Service '${name}' initialized successfully`);
      } catch (error) {
        console.error(`❌ Failed to initialize service '${name}':`, error);
        throw error;
      }
    });

    await Promise.all(initPromises);
  }

  /**
   * Start health monitoring for all services
   */
  startHealthMonitoring(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const healthResults = await Promise.allSettled(
        Array.from(this.instances.values()).map(service => service.health())
      );

      healthResults.forEach((result, index) => {
        const serviceName = Array.from(this.instances.keys())[index];
        if (result.status === 'fulfilled') {
          const health = result.value;
          if (health.status === 'unhealthy') {
            console.warn(`⚠️ Service '${serviceName}' unhealthy: ${health.message}`);
          }
        } else {
          console.error(`❌ Health check failed for service '${serviceName}':`, result.reason);
        }
      });
    }, intervalMs);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get health status of all services
   */
  async getOverallHealth(): Promise<{ healthy: string[]; unhealthy: string[]; details: Record<string, any> }> {
    const healthPromises = Array.from(this.instances.entries()).map(async ([name, service]) => {
      try {
        const health = await service.health();
        return { name, ...health };
      } catch (error) {
        return { name, status: 'unhealthy' as const, message: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    const results = await Promise.all(healthPromises);
    
    const healthy = results.filter(r => r.status === 'healthy').map(r => r.name);
    const unhealthy = results.filter(r => r.status === 'unhealthy').map(r => r.name);
    const details = results.reduce((acc, r) => {
      acc[r.name] = { status: r.status, message: r.message };
      return acc;
    }, {} as Record<string, any>);

    return { healthy, unhealthy, details };
  }

  /**
   * Dispose all services
   */
  async disposeAll(): Promise<void> {
    this.stopHealthMonitoring();
    
    const disposePromises = Array.from(this.instances.values()).map(async (service) => {
      try {
        await service.dispose();
      } catch (error) {
        console.error('Error disposing service:', error);
      }
    });

    await Promise.all(disposePromises);
    this.instances.clear();
    this.services.clear();
  }

  /**
   * Get container uptime
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

// Global service container instance
export const serviceContainer = new ServiceContainer();

// Service orchestration for startup/shutdown
export class ServiceOrchestrator {
  constructor(private container: ServiceContainer) {}

  /**
   * Initialize and start all services
   */
  async start(): Promise<void> {
    console.log('🚀 Starting service orchestration...');
    
    try {
      await this.container.initializeAll();
      this.container.startHealthMonitoring();
      
      const health = await this.container.getOverallHealth();
      console.log(`✅ All services started. Healthy: ${health.healthy.length}, Unhealthy: ${health.unhealthy.length}`);
      
      if (health.unhealthy.length > 0) {
        console.warn('⚠️ Unhealthy services:', health.unhealthy);
      }
    } catch (error) {
      console.error('❌ Failed to start services:', error);
      throw error;
    }
  }

  /**
   * Gracefully stop all services
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping service orchestration...');
    
    try {
      await this.container.disposeAll();
      console.log('✅ All services stopped gracefully');
    } catch (error) {
      console.error('❌ Error stopping services:', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<any> {
    return await this.container.getOverallHealth();
  }

  /**
   * Restart a specific service
   */
  async restartService(serviceName: string): Promise<void> {
    console.log(`🔄 Restarting service '${serviceName}'...`);
    
    try {
      const service = await this.container.get(serviceName);
      await service.dispose();
      
      // Re-initialize the service
      await service.initialize();
      console.log(`✅ Service '${serviceName}' restarted successfully`);
    } catch (error) {
      console.error(`❌ Failed to restart service '${serviceName}':`, error);
      throw error;
    }
  }
}

// Global orchestrator instance
export const serviceOrchestrator = new ServiceOrchestrator(serviceContainer);