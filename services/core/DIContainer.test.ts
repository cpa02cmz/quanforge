import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DIContainer } from './DIContainer';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  afterEach(async () => {
    await container.dispose();
  });

  describe('Service Registration', () => {
    it('should register a service factory', () => {
      const mockFactory = () => ({ name: 'test-service' });
      
      expect(() => container.register('TestService', mockFactory)).not.toThrow();
    });

    it('should throw error when registering during disposal', async () => {
      const mockFactory = () => ({ name: 'test-service' });
      
      // Start disposal
      const disposePromise = container.dispose();
      
      // Try to register during disposal
      expect(() => container.register('TestService', mockFactory)).toThrow(
        'Cannot register services during disposal'
      );
      
      await disposePromise;
    });

    it('should allow overriding existing service registrations', () => {
      const factory1 = () => ({ name: 'service-v1' });
      const factory2 = () => ({ name: 'service-v2' });
      
      container.register('TestService', factory1);
      container.register('TestService', factory2); // Should not throw
      
      expect(() => container.register('TestService', factory2)).not.toThrow();
    });
  });

  describe('Service Resolution', () => {
    it('should create and return service instance', async () => {
      const mockService = { name: 'test-service', method: () => 'test-result' };
      const mockFactory = () => mockService;
      
      container.register('TestService', mockFactory);
      const instance = await container.get('TestService') as any;
      
      expect(instance).toBe(mockService);
      expect(instance.name).toBe('test-service');
      expect(instance.method()).toBe('test-result');
    });

    it('should return singleton instance for subsequent calls', async () => {
      let callCount = 0;
      const mockFactory = () => {
        callCount++;
        return { id: callCount, name: 'singleton-service' };
      };
      
      container.register('SingletonService', mockFactory);
      
      const instance1 = await container.get('SingletonService') as any;
      const instance2 = await container.get('SingletonService') as any;
      
      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(1);
      expect(callCount).toBe(1);
    });

    it('should throw error for unregistered service', async () => {
      await expect(container.get('NonExistentService')).rejects.toThrow(
        'Service NonExistentService is not registered'
      );
    });

    it('should throw error when getting service during disposal', async () => {
      const mockFactory = () => ({ name: 'test-service' });
      container.register('TestService', mockFactory);
      
      // Start disposal
      const disposePromise = container.dispose();
      
      // Try to get service during disposal
      await expect(container.get('TestService')).rejects.toThrow(
        'Cannot get services during disposal'
      );
      
      await disposePromise;
    });

    it('should initialize service if initialize method is available', async () => {
      let initialized = false;
      const mockService = {
        name: 'initializable-service',
        initialize: async () => {
          initialized = true;
        }
      };
      const mockFactory = () => mockService;
      
      container.register('InitService', mockFactory);
      await container.get('InitService');
      
      expect(initialized).toBe(true);
    });

    it('should handle async service factories', async () => {
      const mockService = { name: 'async-service' };
      const mockFactory = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return mockService;
      };
      
      container.register('AsyncService', mockFactory);
      const instance = await container.get('AsyncService') as any;
      
      expect(instance).toBe(mockService);
    });

    it('should handle factory errors gracefully', async () => {
      const errorFactory = () => {
        throw new Error('Factory error');
      };
      
      container.register('ErrorService', errorFactory);
      
      await expect(container.get('ErrorService')).rejects.toThrow('Factory error');
    });
  });

  describe('Service Lifecycle', () => {
    it('should dispose all services properly', async () => {
      let dispose1Called = false;
      let dispose2Called = false;
      
      const service1 = {
        name: 'service1',
        destroy: async () => { dispose1Called = true; }
      };
      
      const service2 = {
        name: 'service2',
        destroy: async () => { dispose2Called = true; }
      };
      
      container.register('Service1', () => service1);
      container.register('Service2', () => service2);
      
      // Create instances
      await container.get('Service1');
      await container.get('Service2');
      
      // Dispose container
      await container.dispose();
      
      expect(dispose1Called).toBe(true);
      expect(dispose2Called).toBe(true);
    });

    it('should handle disposal errors gracefully', async () => {
      const service1 = {
        name: 'service1',
        destroy: async () => { throw new Error('Dispose error'); }
      };
      
      container.register('ErrorService', () => service1);
      await container.get('ErrorService');
      
      // Should not throw even if service dispose fails
      await expect(container.dispose()).resolves.not.toThrow();
      
      // Disposal errors are silently ignored (lint fix: no-console)
    });

    it('should allow operations after disposal completes', async () => {
      await container.dispose();
      
      // container.isDisposing is reset to false, so operations should work again
      expect(() => container.register('Test', () => ({}))).not.toThrow();
      await container.register('Test2', () => ({}));
      await expect(container.get('Test2')).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle circular dependency creation without infinite loops', async () => {
      // Simulate potential circular dependency but actual implementation returns instances
      container.register('ServiceA', async () => {
        return { 
          name: 'service-a',
          getB: () => container.get('ServiceB')
        };
      });
      
      container.register('ServiceB', async () => {
        return { 
          name: 'service-b',
          getA: () => container.get('ServiceA')
        };
      });
      
      // The circular reference creation works - the issue arises when calling getB/getA
      const instanceA = await container.get('ServiceA') as any;
      
      expect(instanceA).toBeDefined();
      expect(instanceA.name).toBe('service-a');
      expect(typeof instanceA.getB).toBe('function');
    });

    it('should handle service factory returning null/undefined', async () => {
      container.register('NullService', () => null);
      container.register('UndefinedService', () => undefined);
      
      const nullInstance = await container.get('NullService');
      const undefinedInstance = await container.get('UndefinedService');
      
      expect(nullInstance).toBeNull();
      expect(undefinedInstance).toBeUndefined();
    });

    it('should handle service factory throwing non-Error objects', async () => {
      container.register('StringErrorService', () => {
        throw 'String error';
      });
      
      container.register('ObjectErrorService', () => {
        throw { custom: 'error' };
      });
      
      // The DIContainer wraps errors - objects without .message property return undefined
      await expect(container.get('StringErrorService')).rejects.toThrow(
        'Failed to create service StringErrorService: undefined'
      );
      await expect(container.get('ObjectErrorService')).rejects.toThrow(
        'Failed to create service ObjectErrorService: undefined'
      );
    });
  });
});