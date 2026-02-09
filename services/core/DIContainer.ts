/**
 * Dependency Injection Container - Service Management
 * 
 * Implements IoC pattern for managing service lifecycles and dependencies
 */

import { ServiceContainer, SERVICE_TOKENS, IService } from '../../types/serviceInterfaces';

export class DIContainer implements ServiceContainer {
  private services = new Map<string, () => any | Promise<any>>();
  private instances = new Map<string, any>();
  private isDisposing = false;

  /**
   * Register a service factory with the container
   */
  register<T>(token: string, factory: () => T | Promise<T>): void {
    if (this.isDisposing) {
      throw new Error('Cannot register services during disposal');
    }
    this.services.set(token, factory);
  }

  /**
   * Get a service instance (creates if not exists)
   */
  async get<T>(token: string): Promise<T> {
    if (this.isDisposing) {
      throw new Error('Cannot get services during disposal');
    }

    // Return existing instance if available
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // Check if service is registered
    if (!this.services.has(token)) {
      throw new Error(`Service ${token} is not registered`);
    }

    try {
      // Create new instance
      const factory = this.services.get(token)!;
      const instance = await factory();
      
      // Initialize if it's a service
      if (instance && typeof instance.initialize === 'function') {
        await instance.initialize();
      }

      // Cache instance
      this.instances.set(token, instance);
      return instance;
    } catch (error) {
      throw new Error(`Failed to create service ${token}: ${error.message}`);
    }
  }

  /**
   * Check if a service is registered
   */
  has(token: string): boolean {
    return this.services.has(token);
  }

  /**
   * Dispose all services
   */
  async dispose(): Promise<void> {
    if (this.isDisposing) return;
    this.isDisposing = true;

    const disposePromises = Array.from(this.instances.entries()).map(async ([token, instance]) => {
      try {
        if (instance && typeof instance.destroy === 'function') {
          await instance.destroy();
        }
      } catch {
        // Silently ignore disposal errors
      }
    });

    await Promise.all(disposePromises);
    this.instances.clear();
    this.services.clear();
    this.isDisposing = false;
  }

  /**
   * Create scoped container for specific operations
   */
  createScope(): DIContainer {
    const scope = new DIContainer();
    
    // Copy service factories but not instances
    this.services.forEach((factory, token) => {
      scope.register(token, factory);
    });
    
    return scope;
  }

  /**
   * Get container diagnostics
   */
  getDiagnostics() {
    return {
      registeredServices: Array.from(this.services.keys()),
      instantiatedServices: Array.from(this.instances.keys()),
      isDisposing: this.isDisposing,
    };
  }
}

// Global container instance
export const globalContainer = new DIContainer();

// Helper for creating service decorators (optional future use)
// Note: Requires reflect-metadata package for full functionality
export function Injectable(token: string) {
  return function <T extends new (...args: any[]) => {}>(constructor: T) {
    // Store metadata for future auto-registration if available
    try {
      if (typeof Reflect !== 'undefined' && 'defineMetadata' in Reflect) {
        (Reflect as any).defineMetadata('injectable', token, constructor);
      }
  } catch {
    // Metadata not available, but that's okay for basic functionality
  }
    return constructor;
  };
}

// Service registration helper
export function registerService<T>(
  container: DIContainer,
  token: string,
  factory: () => T | Promise<T>
): void {
  container.register(token, factory);
}

// Service resolution helper
export async function resolveService<T>(token: string): Promise<T> {
  return globalContainer.get<T>(token);
}

// Service health check helper
export async function checkServiceHealth(token: string): Promise<boolean> {
  try {
    const service = await globalContainer.get(token) as IService;
    if (service && typeof service.isHealthy === 'function') {
      return await service.isHealthy();
    }
    return true; // Assume healthy if no health check method
  } catch {
    return false;
  }
}

// Multiple service health check
export async function checkAllServiceHealth(): Promise<Record<string, boolean>> {
  const tokens = Object.values(SERVICE_TOKENS);
  const healthResults: Record<string, boolean> = {};
  
  await Promise.all(
    tokens.map(async (token) => {
      healthResults[token as string] = await checkServiceHealth(token as string);
    })
  );
  
  return healthResults;
}