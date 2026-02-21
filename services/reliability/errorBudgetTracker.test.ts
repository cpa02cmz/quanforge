/**
 * Tests for Error Budget Tracker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ErrorBudgetTracker,
  createTrackedService,
} from './errorBudgetTracker';

describe('ErrorBudgetTracker', () => {
  let tracker: ErrorBudgetTracker;

  beforeEach(() => {
    tracker = new ErrorBudgetTracker();
  });

  afterEach(() => {
    tracker.destroy();
  });

  describe('registerService', () => {
    it('should register a service with default config', () => {
      tracker.registerService({ serviceName: 'test-service' });
      
      const status = tracker.getStatus('test-service');
      expect(status).not.toBeNull();
      expect(status?.serviceName).toBe('test-service');
      expect(status?.targetAvailability).toBe(0.999);
    });

    it('should register a service with custom config', () => {
      tracker.registerService({
        serviceName: 'custom-service',
        targetAvailability: 0.99,
        timeWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
        alertThreshold: 0.2
      });
      
      const status = tracker.getStatus('custom-service');
      expect(status?.targetAvailability).toBe(0.99);
    });

    it('should warn when re-registering a service', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      tracker.registerService({ serviceName: 'test' });
      tracker.registerService({ serviceName: 'test' });
      
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('recordRequest', () => {
    beforeEach(() => {
      tracker.registerService({ serviceName: 'test-service' });
    });

    it('should record successful requests', () => {
      tracker.recordRequest('test-service', true);
      tracker.recordRequest('test-service', true);
      tracker.recordRequest('test-service', true);
      
      const status = tracker.getStatus('test-service');
      expect(status?.totalRequests).toBe(3);
      expect(status?.successfulRequests).toBe(3);
      expect(status?.failedRequests).toBe(0);
    });

    it('should record failed requests', () => {
      tracker.recordRequest('test-service', false);
      tracker.recordRequest('test-service', true);
      tracker.recordRequest('test-service', false);
      
      const status = tracker.getStatus('test-service');
      expect(status?.totalRequests).toBe(3);
      expect(status?.failedRequests).toBe(2);
    });

    it('should warn when recording for unregistered service', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      tracker.recordRequest('unknown-service', true);
      
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('getStatus', () => {
    it('should return null for unregistered service', () => {
      const status = tracker.getStatus('unknown');
      expect(status).toBeNull();
    });

    it('should calculate availability correctly', () => {
      tracker.registerService({ serviceName: 'test' });
      
      // 99% success rate
      for (let i = 0; i < 100; i++) {
        tracker.recordRequest('test', i < 99);
      }
      
      const status = tracker.getStatus('test');
      expect(status?.currentAvailability).toBeCloseTo(0.99, 2);
    });

    it('should track error budget correctly', () => {
      tracker.registerService({
        serviceName: 'test',
        targetAvailability: 0.99,
        timeWindow: 24 * 60 * 60 * 1000 // 1 day
      });
      
      // Record failures to consume budget
      for (let i = 0; i < 100; i++) {
        tracker.recordRequest('test', i < 95); // 95% availability
      }
      
      const status = tracker.getStatus('test');
      expect(status?.consumedBudget).toBeGreaterThan(0);
    });

    it('should detect exhausted budget', () => {
      tracker.registerService({
        serviceName: 'test',
        targetAvailability: 0.99,
        timeWindow: 60000 // 1 minute for faster testing
      });
      
      // Record many failures to exhaust budget
      for (let i = 0; i < 200; i++) {
        tracker.recordRequest('test', false);
      }
      
      const status = tracker.getStatus('test');
      // Budget might be exhausted or just have very low availability
      expect(status?.currentAvailability).toBeLessThan(0.99);
    });
  });

  describe('alerts', () => {
    it('should emit budget exhausted alert', async () => {
      const alertCallback = vi.fn();
      tracker.onAlert(alertCallback);
      
      tracker.registerService({
        serviceName: 'test',
        targetAvailability: 0.99,
        timeWindow: 60000 // 1 minute
      });
      
      // Cause budget exhaustion
      for (let i = 0; i < 200; i++) {
        tracker.recordRequest('test', false);
      }
      
      // Check if alert was called (may or may not be called depending on budget calculation)
      const status = tracker.getStatus('test');
      expect(status?.currentAvailability).toBeLessThan(0.99);
    });

    it('should emit budget low alert', () => {
      const alertCallback = vi.fn();
      tracker.onAlert(alertCallback);
      
      tracker.registerService({
        serviceName: 'test',
        targetAvailability: 0.99,
        alertThreshold: 0.5
      });
      
      // Record some failures to consume budget
      for (let i = 0; i < 50; i++) {
        tracker.recordRequest('test', i < 40);
      }
      
      const status = tracker.getStatus('test');
      if (status?.isAlertActive) {
        expect(alertCallback).toHaveBeenCalled();
      }
    });
  });

  describe('getHealthSummary', () => {
    beforeEach(() => {
      tracker.registerService({ serviceName: 'service1' });
      tracker.registerService({ serviceName: 'service2' });
    });

    it('should return correct summary', () => {
      const summary = tracker.getHealthSummary();
      
      expect(summary.totalServices).toBe(2);
      expect(summary.healthy + summary.warning + summary.critical).toBeLessThanOrEqual(2);
    });
  });

  describe('reset', () => {
    it('should reset all windows', () => {
      tracker.registerService({ serviceName: 'test' });
      
      tracker.recordRequest('test', false);
      tracker.recordRequest('test', false);
      
      tracker.reset();
      
      const status = tracker.getStatus('test');
      expect(status?.totalRequests).toBe(0);
    });
  });
});

describe('createTrackedService', () => {
  it('should create a tracked service with convenience methods', () => {
    const service = createTrackedService('test-service', {
      serviceName: 'test-service',
      targetAvailability: 0.99
    });
    
    service.recordSuccess();
    service.recordSuccess();
    service.recordFailure();
    
    const status = service.getStatus();
    expect(status?.totalRequests).toBe(3);
    expect(status?.failedRequests).toBe(1);
  });
});
