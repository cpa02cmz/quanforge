/**
 * Tests for Graceful Degradation Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  GracefulDegradationService, 
  DegradationLevel, 
  ServiceHealth 
} from './gracefulDegradation';

describe('GracefulDegradationService', () => {
  let service: GracefulDegradationService;

  beforeEach(() => {
    service = new GracefulDegradationService();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('register', () => {
    it('should register a service with fallback chain', () => {
      const config = {
        serviceName: 'test-service',
        primary: vi.fn().mockResolvedValue('primary-result'),
      };
      
      service.register(config);
      
      expect(service.getLevel('test-service')).toBe(DegradationLevel.FULL);
      expect(service.getHealth('test-service')).toBe(ServiceHealth.HEALTHY);
    });

    it('should update existing service registration', () => {
      const config1 = {
        serviceName: 'test-service',
        primary: vi.fn().mockResolvedValue('result-1'),
      };
      
      const config2 = {
        serviceName: 'test-service',
        primary: vi.fn().mockResolvedValue('result-2'),
      };
      
      service.register(config1);
      service.register(config2);
      
      expect(service.getLevel('test-service')).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute primary function when healthy', async () => {
      const primary = vi.fn().mockResolvedValue('primary-result');
      
      service.register({
        serviceName: 'test-service',
        primary,
      });
      
      const result = await service.execute<string>('test-service');
      
      expect(result).toBe('primary-result');
      expect(primary).toHaveBeenCalledTimes(1);
    });

    it('should use partial fallback when degraded', async () => {
      const primary = vi.fn().mockRejectedValue(new Error('Primary failed'));
      const partial = vi.fn().mockResolvedValue('partial-result');
      
      service.register({
        serviceName: 'test-service',
        primary,
        partial,
      });
      
      // Simulate degradation by manually setting level
      service.setLevel('test-service', DegradationLevel.PARTIAL);
      
      const result = await service.execute<string>('test-service');
      
      expect(result).toBe('partial-result');
      expect(partial).toHaveBeenCalledTimes(1);
    });

    it('should use emergency fallback in emergency mode', async () => {
      const primary = vi.fn().mockResolvedValue('primary-result');
      const emergency = vi.fn().mockResolvedValue('emergency-result');
      
      service.register({
        serviceName: 'test-service',
        primary,
        emergency,
      });
      
      service.setLevel('test-service', DegradationLevel.EMERGENCY);
      
      const result = await service.execute<string>('test-service');
      
      expect(result).toBe('emergency-result');
      expect(emergency).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unregistered service', async () => {
      await expect(service.execute('unknown-service')).rejects.toThrow(
        "Service 'unknown-service' not registered"
      );
    });

    it('should timeout long-running operations', async () => {
      const slowPrimary = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('slow'), 5000))
      );
      
      service.register({
        serviceName: 'slow-service',
        primary: slowPrimary,
        timeout: 100,
      });
      
      await expect(service.execute('slow-service')).rejects.toThrow('timeout');
    });
  });

  describe('degradation', () => {
    it('should degrade after consecutive failures', async () => {
      const failingPrimary = vi.fn().mockRejectedValue(new Error('Failed'));
      
      service.register({
        serviceName: 'failing-service',
        primary: failingPrimary,
      });
      
      // Execute multiple times to trigger degradation
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('failing-service');
        } catch {
          // Expected to fail
        }
      }
      
      const level = service.getLevel('failing-service');
      expect(level).not.toBe(DegradationLevel.FULL);
    });

    it('should recover after consecutive successes', async () => {
      const primary = vi.fn().mockResolvedValue('success');
      
      service.register({
        serviceName: 'recovery-service',
        primary,
      });
      
      // Set to degraded state
      service.setLevel('recovery-service', DegradationLevel.PARTIAL);
      
      // Execute multiple times to trigger recovery
      for (let i = 0; i < 10; i++) {
        await service.execute('recovery-service');
      }
      
      const level = service.getLevel('recovery-service');
      expect(level).toBe(DegradationLevel.FULL);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for registered service', async () => {
      const primary = vi.fn().mockResolvedValue('result');
      
      service.register({
        serviceName: 'metrics-service',
        primary,
      });
      
      await service.execute('metrics-service');
      
      const metrics = service.getMetrics('metrics-service');
      
      expect(metrics).toBeDefined();
      expect(metrics?.serviceName).toBe('metrics-service');
      expect(metrics?.totalRequests).toBe(1);
      expect(metrics?.availability).toBe(100);
    });

    it('should return null for unregistered service', () => {
      const metrics = service.getMetrics('unknown-service');
      expect(metrics).toBeNull();
    });
  });

  describe('setLevel', () => {
    it('should manually set degradation level', () => {
      service.register({
        serviceName: 'manual-service',
        primary: vi.fn().mockResolvedValue('result'),
      });
      
      service.setLevel('manual-service', DegradationLevel.MINIMAL);
      
      expect(service.getLevel('manual-service')).toBe(DegradationLevel.MINIMAL);
    });

    it('should warn for unregistered service', () => {
      service.setLevel('unknown-service', DegradationLevel.FULL);
      // Should not throw
    });
  });

  describe('reset', () => {
    it('should reset service state', async () => {
      const primary = vi.fn().mockResolvedValue('result');
      
      service.register({
        serviceName: 'reset-service',
        primary,
      });
      
      // Execute some operations
      await service.execute('reset-service');
      service.setLevel('reset-service', DegradationLevel.PARTIAL);
      
      service.reset('reset-service');
      
      const metrics = service.getMetrics('reset-service');
      expect(metrics?.level).toBe(DegradationLevel.FULL);
      expect(metrics?.totalRequests).toBe(0);
    });
  });

  describe('unregister', () => {
    it('should unregister service', () => {
      service.register({
        serviceName: 'temp-service',
        primary: vi.fn().mockResolvedValue('result'),
      });
      
      service.unregister('temp-service');
      
      expect(service.getLevel('temp-service')).toBeNull();
    });
  });

  describe('recovery callbacks', () => {
    it('should notify recovery callbacks', async () => {
      const primary = vi.fn().mockResolvedValue('result');
      const callback = vi.fn();
      
      service.register({
        serviceName: 'callback-service',
        primary,
      });
      
      service.onRecovery(callback);
      service.setLevel('callback-service', DegradationLevel.PARTIAL);
      
      // Trigger recovery
      for (let i = 0; i < 10; i++) {
        await service.execute('callback-service');
      }
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('getAllMetrics', () => {
    it('should return metrics for all services', async () => {
      service.register({
        serviceName: 'service-1',
        primary: vi.fn().mockResolvedValue('result'),
      });
      
      service.register({
        serviceName: 'service-2',
        primary: vi.fn().mockResolvedValue('result'),
      });
      
      await service.execute('service-1');
      await service.execute('service-2');
      
      const allMetrics = service.getAllMetrics();
      
      expect(allMetrics).toHaveLength(2);
      expect(allMetrics.map(m => m.serviceName)).toContain('service-1');
      expect(allMetrics.map(m => m.serviceName)).toContain('service-2');
    });
  });
});
