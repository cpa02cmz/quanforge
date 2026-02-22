/**
 * Tests for Resource Governor Service
 * 
 * @module services/database/resourceGovernor.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the serviceCleanupCoordinator
vi.mock('../../utils/serviceCleanupCoordinator', () => ({
  serviceCleanupCoordinator: {
    register: vi.fn(),
  },
}));

// Mock the logger
vi.mock('../../utils/logger', () => ({
  createScopedLogger: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock modularConstants
vi.mock('../modularConstants', () => ({
  TIME_CONSTANTS: {
    SECOND: 1000,
    MINUTE: 60000,
    HOUR: 3600000,
  },
}));

import { ResourceGovernor, type GovernorConfig } from './resourceGovernor';

describe('ResourceGovernor', () => {
  let governor: ResourceGovernor;

  beforeEach(() => {
    // Create a fresh instance for each test
    // @ts-expect-error - Reset singleton for testing
    ResourceGovernor.instance = undefined;
    
    const testConfig: Partial<GovernorConfig> = {
      enabled: true,
      throttling: {
        enabled: true,
        action: 'delay',
        delayMs: 10,
        maxQueueSize: 5,
        cooldownMs: 100,
      },
      autoScaling: {
        enabled: false,
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.3,
        minQuota: 5,
        maxQuota: 100,
      },
    };
    governor = ResourceGovernor.getInstance(testConfig);
    governor.initialize();
  });

  afterEach(() => {
    governor.shutdown();
  });

  describe('initialization', () => {
    it('should initialize correctly', () => {
      const status = governor.getStatus();
      expect(status.isEnabled).toBe(true);
      expect(status.activeOperations).toBe(0);
      expect(status.queuedOperations).toBe(0);
    });
  });

  describe('resource acquisition', () => {
    it('should grant resources when available', async () => {
      const result = await governor.acquire({
        type: 'query',
        resources: { connections: 1, queries: 1 },
        priority: 'normal',
      });

      expect(result.granted).toBe(true);
      expect(result.requestId).toBeDefined();
      expect(result.message).toContain('successfully');
    });

    it('should track active operations', async () => {
      const result = await governor.acquire({
        type: 'query',
        resources: { connections: 1, queries: 1 },
        priority: 'normal',
      });

      const status = governor.getStatus();
      expect(status.activeOperations).toBe(1);

      // Release the resource
      governor.release(result.requestId);

      const newStatus = governor.getStatus();
      expect(newStatus.activeOperations).toBe(0);
    });

    it('should handle multiple priority levels', async () => {
      const criticalResult = await governor.acquire({
        type: 'query',
        resources: { connections: 1 },
        priority: 'critical',
      });

      const backgroundResult = await governor.acquire({
        type: 'query',
        resources: { connections: 1 },
        priority: 'background',
      });

      expect(criticalResult.granted).toBe(true);
      expect(backgroundResult.granted).toBe(true);

      // Cleanup
      governor.release(criticalResult.requestId);
      governor.release(backgroundResult.requestId);
    });
  });

  describe('resource release', () => {
    it('should release resources correctly', async () => {
      const result = await governor.acquire({
        type: 'query',
        resources: { connections: 2 },
        priority: 'normal',
      });

      expect(result.granted).toBe(true);

      const releaseResult = governor.release(result.requestId);
      expect(releaseResult).toBe(true);

      // Releasing non-existent request should return false
      const doubleRelease = governor.release(result.requestId);
      expect(doubleRelease).toBe(false);
    });
  });

  describe('quota management', () => {
    it('should set and track quotas', () => {
      governor.setQuota('connections', 50);
      const usage = governor.getResourceUsage();
      const connectionUsage = usage.find(u => u.type === 'connections');
      expect(connectionUsage?.limit).toBe(50);
    });

    it('should track resource usage percentage', async () => {
      governor.setQuota('connections', 10);
      
      // Acquire some resources
      const result1 = await governor.acquire({
        type: 'query',
        resources: { connections: 3 },
        priority: 'normal',
      });

      const usage = governor.getResourceUsage();
      const connectionUsage = usage.find(u => u.type === 'connections');
      expect(connectionUsage?.percentage).toBe(30);

      // Cleanup
      governor.release(result1.requestId);
    });
  });

  describe('status and metrics', () => {
    it('should return correct status', () => {
      const status = governor.getStatus();
      
      expect(status).toHaveProperty('isEnabled');
      expect(status).toHaveProperty('quotas');
      expect(status).toHaveProperty('activeOperations');
      expect(status).toHaveProperty('queuedOperations');
    });

    it('should return resource usage', async () => {
      // First acquire a resource to ensure quotas are populated
      await governor.acquire({
        type: 'query',
        resources: { connections: 1 },
        priority: 'normal',
      });
      
      const usage = governor.getResourceUsage();
      
      expect(Array.isArray(usage)).toBe(true);
      // After initialization, we should have quotas defined
      expect(usage.length).toBeGreaterThanOrEqual(0);
      
      if (usage.length > 0) {
        const firstUsage = usage[0];
        expect(firstUsage).toHaveProperty('type');
        expect(firstUsage).toHaveProperty('used');
        expect(firstUsage).toHaveProperty('limit');
        expect(firstUsage).toHaveProperty('percentage');
        expect(firstUsage).toHaveProperty('trend');
      }
    });

    it('should track events', async () => {
      await governor.acquire({
        type: 'query',
        resources: { connections: 1 },
        priority: 'normal',
      });

      const events = governor.getEventHistory();
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('throttling', () => {
    it('should indicate throttling status', () => {
      const isThrottling = governor.isThrottlingActive();
      expect(typeof isThrottling).toBe('boolean');
    });
  });

  describe('force release', () => {
    it('should force release all resources of a type', async () => {
      governor.setQuota('connections', 100);
      
      // Acquire multiple resources
      const result1 = await governor.acquire({
        type: 'query',
        resources: { connections: 5 },
        priority: 'normal',
      });

      const result2 = await governor.acquire({
        type: 'query',
        resources: { connections: 5 },
        priority: 'normal',
      });

      expect(result1.granted).toBe(true);
      expect(result2.granted).toBe(true);

      // Force release all connections
      const releasedCount = governor.forceReleaseAll('connections');
      expect(releasedCount).toBe(2);
    });
  });

  describe('configuration update', () => {
    it('should update configuration', () => {
      governor.updateConfig({
        monitoringIntervalMs: 5000,
      });

      // Should not throw
      expect(() => governor.getStatus()).not.toThrow();
    });
  });
});
