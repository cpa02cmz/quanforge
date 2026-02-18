/**
 * ServiceFactory Tests
 * 
 * Tests for standardized service creation pattern
 * Addresses Issue #795: Service Layer Interface Pattern Inconsistency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ServiceFactory, 
  BaseService, 
  ServiceInitializer,
  type IService 
} from './ServiceFactory';

// Clear registry before each test
beforeEach(() => {
  ServiceFactory.clearRegistry();
});

describe('ServiceFactory', () => {
  describe('createSingleton', () => {
    it('should create a singleton instance', () => {
      class TestService {
        value = Math.random();
      }

      const instance1 = ServiceFactory.createSingleton('TestService', () => new TestService());
      const instance2 = ServiceFactory.createSingleton('TestService', () => new TestService());

      expect(instance1).toBe(instance2);
      expect(instance1.value).toBe(instance2.value);
    });

    it('should create different instances for different names', () => {
      class ServiceA { id = 'A'; }
      class ServiceB { id = 'B'; }

      const instanceA = ServiceFactory.createSingleton('ServiceA', () => new ServiceA());
      const instanceB = ServiceFactory.createSingleton('ServiceB', () => new ServiceB());

      expect(instanceA).not.toBe(instanceB);
      expect(instanceA.id).toBe('A');
      expect(instanceB.id).toBe('B');
    });

    it('should track service in registry', () => {
      class TestService {}
      
      ServiceFactory.createSingleton('TestService', () => new TestService());
      
      const services = ServiceFactory.listServices();
      expect(services).toContain('TestService');
    });

    it('should provide service metadata', () => {
      class TestService {}
      
      ServiceFactory.createSingleton('TestService', () => new TestService());
      
      const metadata = ServiceFactory.getServiceInfo('TestService');
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('TestService');
      expect(metadata?.initialized).toBe(true);
      expect(metadata?.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('createLazy', () => {
    it('should lazy initialize service on first access', () => {
      const factory = vi.fn(() => ({ value: 42 }));
      
      const lazyService = ServiceFactory.createLazy('LazyService', factory);
      
      // Factory should not be called yet
      expect(factory).not.toHaveBeenCalled();
      
      // Access property to trigger initialization
      const value = lazyService.value;
      
      expect(factory).toHaveBeenCalledTimes(1);
      expect(value).toBe(42);
    });

    it('should reuse instance on subsequent accesses', () => {
      let callCount = 0;
      const factory = () => ({ 
        value: ++callCount,
        getValue: () => callCount 
      });
      
      const lazyService = ServiceFactory.createLazy('LazyService2', factory);
      
      const value1 = lazyService.value;
      const value2 = lazyService.value;
      
      expect(value1).toBe(1);
      expect(value2).toBe(1); // Same instance
    });
  });

  describe('clearRegistry', () => {
    it('should clear all registered services', () => {
      class TestService {}
      
      ServiceFactory.createSingleton('TestService1', () => new TestService());
      ServiceFactory.createSingleton('TestService2', () => new TestService());
      
      expect(ServiceFactory.listServices()).toHaveLength(2);
      
      ServiceFactory.clearRegistry();
      
      expect(ServiceFactory.listServices()).toHaveLength(0);
    });
  });
});

describe('BaseService', () => {
  it('should provide service name', () => {
    class ConcreteService extends BaseService {
      constructor() {
        super('ConcreteService');
      }
    }

    const service = new ConcreteService();
    expect(service.getServiceName()).toBe('ConcreteService');
  });

  it('should track initialization state', async () => {
    class ConcreteService extends BaseService {
      constructor() {
        super('ConcreteService');
      }
    }

    const service = new ConcreteService();
    
    await service.initialize();
    expect((service as unknown as { initialized: boolean }).initialized).toBe(true);
    
    await service.dispose();
    expect((service as unknown as { initialized: boolean }).initialized).toBe(false);
  });

  it('should only initialize once', async () => {
    let initCount = 0;
    
    class ConcreteService extends BaseService {
      constructor() {
        super('ConcreteService');
      }
      
      async initialize(): Promise<void> {
        // Check if already initialized before calling super
        if ((this as unknown as { initialized: boolean }).initialized) {
          return;
        }
        initCount++;
        await super.initialize();
      }
    }

    const service = new ConcreteService();
    
    await service.initialize();
    await service.initialize(); // Second call should be no-op
    
    expect(initCount).toBe(1);
  });
});

describe('ServiceInitializer', () => {
  beforeEach(() => {
    // Reset static state
    (ServiceInitializer as unknown as { initialized: boolean; initQueue: unknown[] }).initialized = false;
    (ServiceInitializer as unknown as { initialized: boolean; initQueue: unknown[] }).initQueue = [];
  });

  it('should register and initialize services', async () => {
    const initFn = vi.fn().mockResolvedValue(undefined);
    
    ServiceInitializer.register(initFn);
    
    expect(initFn).not.toHaveBeenCalled();
    
    await ServiceInitializer.initializeAll();
    
    expect(initFn).toHaveBeenCalledTimes(1);
  });

  it('should handle initialization errors gracefully', async () => {
    const errorFn = vi.fn().mockRejectedValue(new Error('Init failed'));
    const successFn = vi.fn().mockResolvedValue(undefined);
    
    ServiceInitializer.register(errorFn);
    ServiceInitializer.register(successFn);
    
    await ServiceInitializer.initializeAll();
    
    expect(errorFn).toHaveBeenCalled();
    expect(successFn).toHaveBeenCalled();
  });
});

describe('Service Pattern Compliance', () => {
  it('should demonstrate proper service pattern (Issue #795)', () => {
    // Example of standardized service pattern
    interface ICacheService {
      get(key: string): string | null;
      set(key: string, value: string): void;
    }

    class CacheService extends BaseService implements ICacheService {
      private cache = new Map<string, string>();

      constructor() {
        super('CacheService');
      }

      get(key: string): string | null {
        return this.cache.get(key) ?? null;
      }

      set(key: string, value: string): void {
        this.cache.set(key, value);
      }
    }

    // Standard export pattern
    const cacheService = ServiceFactory.createSingleton(
      'CacheService',
      () => new CacheService()
    );

    // Test the service
    cacheService.set('test', 'value');
    expect(cacheService.get('test')).toBe('value');

    // Verify singleton behavior
    const cacheService2 = ServiceFactory.createSingleton(
      'CacheService',
      () => new CacheService()
    );
    expect(cacheService2.get('test')).toBe('value');
  });
});
