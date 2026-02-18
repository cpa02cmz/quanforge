/**
 * Service Factory - Standardized Service Creation Pattern
 * 
 * Provides consistent service instantiation across the codebase.
 * Addresses Issue #795: Service Layer Interface Pattern Inconsistency
 * 
 * @example
 * ```typescript
 * // Define service interface
 * interface ICacheService {
 *   get(key: string): Promise<any>;
 *   set(key: string, value: any): Promise<void>;
 * }
 * 
 * // Implement service
 * class CacheService implements ICacheService {
 *   async get(key: string) { ... }
 *   async set(key: string, value: any) { ... }
 * }
 * 
 * // Create singleton instance using factory
 * export const cacheService = ServiceFactory.createSingleton(
 *   'CacheService',
 *   () => new CacheService()
 * );
 * ```
 */

import { logger } from '../../utils/logger';

const serviceFactoryLogger = {
  debug: (...args: unknown[]) => logger.debug('[ServiceFactory]', ...args),
  error: (...args: unknown[]) => logger.error('[ServiceFactory]', ...args),
};

// Registry to track all services for debugging and monitoring
const serviceRegistry = new Map<string, unknown>();

// Service lifecycle state
interface ServiceMetadata {
  name: string;
  createdAt: Date;
  initialized: boolean;
  dependencies?: string[];
}

const serviceMetadata = new Map<string, ServiceMetadata>();

/**
 * Service Factory - Creates and manages service instances
 */
export class ServiceFactory {
  /**
   * Creates a singleton service instance
   * Ensures only one instance exists across the application
   * 
   * @param name - Service name for registration
   * @param factory - Factory function to create service instance
   * @returns The singleton service instance
   */
  static createSingleton<T>(name: string, factory: () => T): T {
    if (serviceRegistry.has(name)) {
      serviceFactoryLogger.debug(`Reusing existing singleton: ${name}`);
      return serviceRegistry.get(name) as T;
    }

    serviceFactoryLogger.debug(`Creating singleton service: ${name}`);
    const instance = factory();
    
    serviceRegistry.set(name, instance);
    serviceMetadata.set(name, {
      name,
      createdAt: new Date(),
      initialized: true,
    });

    return instance;
  }

  /**
   * Creates a service with lazy initialization
   * Instance is created only when first accessed
   * 
   * @param name - Service name for registration
   * @param factory - Factory function to create service instance
   * @returns A proxy that lazy-loads the service
   */
  static createLazy<T extends object>(name: string, factory: () => T): T {
    let instance: T | null = null;
    
    return new Proxy({} as T, {
      get(_target, prop) {
        if (!instance) {
          serviceFactoryLogger.debug(`Lazy initializing service: ${name}`);
          instance = ServiceFactory.createSingleton(name, factory);
        }
        return (instance as Record<string, unknown>)[prop as string];
      },
    });
  }

  /**
   * Gets service metadata for debugging
   */
  static getServiceInfo(name: string): ServiceMetadata | undefined {
    return serviceMetadata.get(name);
  }

  /**
   * Lists all registered services
   */
  static listServices(): string[] {
    return Array.from(serviceRegistry.keys());
  }

  /**
   * Clears all service registrations (useful for testing)
   */
  static clearRegistry(): void {
    serviceRegistry.clear();
    serviceMetadata.clear();
    serviceFactoryLogger.debug('Service registry cleared');
  }
}

/**
 * Decorator to mark a class as a service
 * Stores metadata about the service for introspection
 */
export function Service(name: string) {
  return function <T extends new (...args: unknown[]) => object>(constructor: T): T {
    // Store metadata on the constructor using bracket notation for index signature
    const ctor = constructor as unknown as Record<string, unknown>;
    ctor['serviceName'] = name;
    ctor['isService'] = true;
    
    serviceFactoryLogger.debug(`Service decorator applied: ${name}`);
    return constructor;
  };
}

/**
 * Standard service interface that all services should implement
 * Ensures consistent lifecycle management
 */
export interface IService {
  initialize?(): Promise<void> | void;
  dispose?(): Promise<void> | void;
  getServiceName?(): string;
}

/**
 * Base service class providing common functionality
 * Services should extend this class for consistency
 */
export abstract class BaseService implements IService {
  protected readonly serviceName: string;
  protected initialized = false;

  constructor(name: string) {
    this.serviceName = name;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }

  getServiceName(): string {
    return this.serviceName;
  }
}

/**
 * Service initialization helper
 * Ensures all services are properly initialized before use
 */
export class ServiceInitializer {
  private static initialized = false;
  private static initQueue: Array<() => Promise<void>> = [];

  /**
   * Registers a service initialization function
   */
  static register(initFn: () => Promise<void>): void {
    if (this.initialized) {
      // If already initialized, run immediately
      initFn().catch(console.error);
    } else {
      this.initQueue.push(initFn);
    }
  }

  /**
   * Initializes all registered services
   */
  static async initializeAll(): Promise<void> {
    if (this.initialized) return;

    logger.debug(`Initializing ${this.initQueue.length} services...`);
    
    for (const initFn of this.initQueue) {
      try {
        await initFn();
      } catch (error) {
        logger.error('Service initialization failed:', error);
      }
    }

    this.initialized = true;
    logger.debug('All services initialized');
  }
}

export default ServiceFactory;
