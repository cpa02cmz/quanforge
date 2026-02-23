/**
 * User Usage Tracker Tests
 * 
 * Tests for the UserUsageTracker service
 * 
 * @module services/database/userUsageTracker.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserUsageTracker, userUsageTracker } from './userUsageTracker';

// ============================================================================
// USER USAGE TRACKER TESTS
// ============================================================================

describe('UserUsageTracker', () => {
  let tracker: UserUsageTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = UserUsageTracker.getInstance();
    tracker.initialize();
    tracker.clearAllData();
  });

  afterEach(() => {
    tracker.shutdown();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = UserUsageTracker.getInstance();
      const instance2 = UserUsageTracker.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize without errors', () => {
      expect(() => tracker.initialize()).not.toThrow();
    });
  });

  describe('trackUsage', () => {
    it('should track a usage record', () => {
      const record = tracker.trackUsage('user-1', 'read', 'robots');
      
      expect(record).toBeDefined();
      expect(record.userId).toBe('user-1');
      expect(record.type).toBe('read');
      expect(record.resource).toBe('robots');
      expect(record.count).toBe(1);
      expect(record.id).toBeDefined();
      expect(record.timestamp).toBeGreaterThan(0);
    });

    it('should track usage with custom count', () => {
      const record = tracker.trackUsage('user-1', 'write', 'robots', { count: 5 });
      
      expect(record.count).toBe(5);
    });

    it('should track usage with bytes processed', () => {
      const record = tracker.trackUsage('user-1', 'export', 'robots', { 
        bytesProcessed: 1024 
      });
      
      expect(record.bytesProcessed).toBe(1024);
    });

    it('should track usage with metadata', () => {
      const metadata = { source: 'dashboard', action: 'export' };
      const record = tracker.trackUsage('user-1', 'export', 'robots', { metadata });
      
      expect(record.metadata).toEqual(metadata);
    });
  });

  describe('checkQuota', () => {
    it('should return not exceeded for new user', async () => {
      const result = await tracker.checkQuota('user-new', 'read');
      
      expect(result.exceeded).toBe(false);
      expect(result.current).toBe(0);
      expect(result.limit).toBeGreaterThan(0);
    });

    it('should increment usage when tracking', async () => {
      tracker.trackUsage('user-1', 'read', 'robots');
      tracker.trackUsage('user-1', 'read', 'robots');
      
      const result = await tracker.checkQuota('user-1', 'read');
      
      expect(result.current).toBe(2);
    });

    it('should detect quota exceeded', async () => {
      // Get the quota and set a low limit
      const quota = tracker.getOrCreateQuota('user-1');
      quota.limits.readsPerHour = 2;
      
      // Track usage up to limit
      tracker.trackUsage('user-1', 'read', 'robots');
      tracker.trackUsage('user-1', 'read', 'robots');
      
      const result = await tracker.checkQuota('user-1', 'read');
      
      expect(result.exceeded).toBe(true);
      expect(result.current).toBe(2);
      expect(result.limit).toBe(2);
    });
  });

  describe('getOrCreateQuota', () => {
    it('should create default quota for new user', () => {
      const quota = tracker.getOrCreateQuota('new-user');
      
      expect(quota).toBeDefined();
      expect(quota.userId).toBe('new-user');
      expect(quota.tier).toBe('free');
      expect(quota.limits).toBeDefined();
      expect(quota.currentUsage).toBeDefined();
    });

    it('should return existing quota for known user', () => {
      const quota1 = tracker.getOrCreateQuota('user-1');
      const quota2 = tracker.getOrCreateQuota('user-1');
      
      expect(quota1).toBe(quota2);
    });
  });

  describe('setUserTier', () => {
    it('should update user tier', () => {
      tracker.setUserTier('user-1', 'premium');
      
      const quota = tracker.getOrCreateQuota('user-1');
      expect(quota.tier).toBe('premium');
      expect(quota.limits.readsPerHour).toBeGreaterThan(100);
    });

    it('should update limits based on tier', () => {
      tracker.setUserTier('user-1', 'enterprise');
      
      const quota = tracker.getOrCreateQuota('user-1');
      expect(quota.tier).toBe('enterprise');
      expect(quota.limits.maxRobots).toBe(1000);
    });
  });

  describe('updateStorageUsage', () => {
    it('should update storage usage', () => {
      tracker.updateStorageUsage('user-1', 5000, 10);
      
      const quota = tracker.getOrCreateQuota('user-1');
      expect(quota.currentUsage.totalStorageBytes).toBe(5000);
      expect(quota.currentUsage.totalRobots).toBe(10);
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', () => {
      tracker.trackUsage('user-1', 'read', 'robots');
      tracker.trackUsage('user-1', 'read', 'robots');
      tracker.trackUsage('user-1', 'write', 'robots');
      
      const stats = tracker.getUsageStats('user-1', 'day');
      
      expect(stats.userId).toBe('user-1');
      expect(stats.period).toBe('day');
      expect(stats.totalOperations).toBe(3);
      expect(stats.operationsByType.read).toBe(2);
      expect(stats.operationsByType.write).toBe(1);
    });

    it('should calculate average per hour', () => {
      tracker.trackUsage('user-1', 'read', 'robots', { count: 100 });
      
      const stats = tracker.getUsageStats('user-1', 'day');
      
      expect(stats.averagePerHour).toBeGreaterThan(0);
    });

    it('should determine trend direction', () => {
      tracker.trackUsage('user-1', 'read', 'robots');
      
      const stats = tracker.getUsageStats('user-1', 'hour');
      
      expect(['increasing', 'stable', 'decreasing']).toContain(stats.trendDirection);
    });
  });

  describe('getQuotaStatus', () => {
    it('should return quota status with percentages', () => {
      tracker.trackUsage('user-1', 'read', 'robots');
      
      const status = tracker.getQuotaStatus('user-1');
      
      expect(status.quota).toBeDefined();
      expect(status.usagePercentages).toBeDefined();
      expect(status.usagePercentages.read).toBeGreaterThanOrEqual(0);
      expect(status.nearLimit).toBeInstanceOf(Array);
    });

    it('should identify near-limit types', () => {
      const quota = tracker.getOrCreateQuota('user-1');
      quota.limits.readsPerHour = 2;
      
      tracker.trackUsage('user-1', 'read', 'robots');
      tracker.trackUsage('user-1', 'read', 'robots');
      
      const status = tracker.getQuotaStatus('user-1');
      
      expect(status.nearLimit).toContain('read');
    });
  });

  describe('configuration', () => {
    it('should get current config', () => {
      const config = tracker.getConfig();
      
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('defaultTier');
      expect(config).toHaveProperty('cleanupIntervalMs');
    });

    it('should update config', () => {
      tracker.updateConfig({ defaultTier: 'premium' });
      
      const config = tracker.getConfig();
      expect(config.defaultTier).toBe('premium');
    });
  });

  describe('clearUserData', () => {
    it('should clear user data', () => {
      tracker.trackUsage('user-1', 'read', 'robots');
      tracker.clearUserData('user-1');
      
      const stats = tracker.getUsageStats('user-1', 'day');
      expect(stats.totalOperations).toBe(0);
    });
  });

  describe('clearAllData', () => {
    it('should clear all data', () => {
      tracker.trackUsage('user-1', 'read', 'robots');
      tracker.trackUsage('user-2', 'write', 'robots');
      tracker.clearAllData();
      
      const stats1 = tracker.getUsageStats('user-1', 'day');
      const stats2 = tracker.getUsageStats('user-2', 'day');
      
      expect(stats1.totalOperations).toBe(0);
      expect(stats2.totalOperations).toBe(0);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('UserUsageTracker Integration', () => {
  it('should work with exported singleton', () => {
    expect(userUsageTracker).toBeDefined();
    expect(userUsageTracker).toBeInstanceOf(UserUsageTracker);
  });

  it('should track and check quota workflow', async () => {
    const tracker = UserUsageTracker.getInstance();
    tracker.initialize();
    tracker.clearAllData();
    
    // Track usage
    tracker.trackUsage('workflow-user', 'ai_generation', 'strategy');
    
    // Check quota
    const result = await tracker.checkQuota('workflow-user', 'ai_generation');
    
    expect(result.current).toBe(1);
    expect(result.exceeded).toBe(false);
    
    tracker.shutdown();
  });
});
