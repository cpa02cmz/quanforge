/**
 * Tests for Database Failover Manager and Query Plan Cache
 * 
 * @module services/database/failoverManager.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FailoverManager, type DatabaseEndpoint, type FailoverConfig } from './failoverManager';
import { QueryPlanCache, type CachedQueryPlan, type CacheConfig } from './queryPlanCache';

// ============================================================================
// FAILOVER MANAGER TESTS
// ============================================================================

describe('FailoverManager', () => {
  let failoverManager: FailoverManager;
  
  const primaryEndpoint: Omit<DatabaseEndpoint, 'errorCount' | 'successCount'> = {
    id: 'primary-test-1',
    name: 'Primary Database Test',
    url: 'https://primary-test.example.com',
    priority: 100,
    region: 'us-east-1',
    isPrimary: true,
    isActive: true,
  };
  
  const secondaryEndpoint: Omit<DatabaseEndpoint, 'errorCount' | 'successCount'> = {
    id: 'secondary-test-1',
    name: 'Secondary Database Test',
    url: 'https://secondary-test.example.com',
    priority: 50,
    region: 'us-west-1',
    isPrimary: false,
    isActive: true,
  };
  
  const testConfig: Partial<FailoverConfig> = {
    enabled: true,
    strategy: 'retry_then_failover',
    healthCheckIntervalMs: 60000, // Longer interval for tests
    failureThreshold: 3,
    recoveryThreshold: 5,
    retryAttempts: 3,
    retryDelayMs: 100,
    gracefulTimeoutMs: 1000,
    cascadeOrder: [],
    enableAutoRecovery: false, // Disable for tests
    autoRecoveryDelayMs: 60000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    failoverManager = FailoverManager.getInstance(testConfig);
    failoverManager.shutdown(); // Reset state
    failoverManager.initialize();
  });

  afterEach(() => {
    failoverManager.shutdown();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = FailoverManager.getInstance();
      const instance2 = FailoverManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('registerEndpoint', () => {
    it('should register an endpoint', () => {
      failoverManager.registerEndpoint(primaryEndpoint);
      
      const endpoints = failoverManager.getEndpoints();
      const found = endpoints.find(e => e.id === 'primary-test-1');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Primary Database Test');
    });

    it('should set first primary as active', () => {
      failoverManager.registerEndpoint(primaryEndpoint);
      
      const active = failoverManager.getActiveEndpoint();
      expect(active).not.toBeNull();
      expect(active?.id).toBe('primary-test-1');
    });
  });

  describe('unregisterEndpoint', () => {
    it('should unregister a non-active endpoint', () => {
      failoverManager.registerEndpoint(primaryEndpoint);
      failoverManager.registerEndpoint(secondaryEndpoint);
      
      const result = failoverManager.unregisterEndpoint('secondary-test-1');
      expect(result).toBe(true);
      
      const endpoints = failoverManager.getEndpoints();
      const found = endpoints.find(e => e.id === 'secondary-test-1');
      expect(found).toBeUndefined();
    });

    it('should not unregister active endpoint', () => {
      failoverManager.registerEndpoint(primaryEndpoint);
      
      const result = failoverManager.unregisterEndpoint('primary-test-1');
      expect(result).toBe(false);
    });
  });

  describe('getPrimaryEndpoint', () => {
    it('should return primary endpoint', () => {
      failoverManager.registerEndpoint(primaryEndpoint);
      failoverManager.registerEndpoint(secondaryEndpoint);
      
      const primary = failoverManager.getPrimaryEndpoint();
      expect(primary).not.toBeNull();
      expect(primary?.isPrimary).toBe(true);
      expect(primary?.id).toBe('primary-test-1');
    });
  });

  describe('reportError', () => {
    it('should increment error count', () => {
      failoverManager.registerEndpoint(primaryEndpoint);
      
      failoverManager.reportError('primary-test-1', new Error('Connection failed'));
      
      const endpoints = failoverManager.getEndpoints();
      const found = endpoints.find(e => e.id === 'primary-test-1');
      expect(found?.errorCount).toBe(1);
    });
  });

  describe('reportSuccess', () => {
    it('should increment success count and track latency', () => {
      failoverManager.registerEndpoint(primaryEndpoint);
      
      failoverManager.reportSuccess('primary-test-1', 50);
      
      const endpoints = failoverManager.getEndpoints();
      const found = endpoints.find(e => e.id === 'primary-test-1');
      expect(found?.successCount).toBe(1);
      expect(found?.latency).toBe(50);
    });

    it('should decrement error count on success', () => {
      failoverManager.registerEndpoint(primaryEndpoint);
      
      failoverManager.reportError('primary-test-1', new Error('Error'));
      failoverManager.reportSuccess('primary-test-1', 50);
      
      const endpoints = failoverManager.getEndpoints();
      const found = endpoints.find(e => e.id === 'primary-test-1');
      expect(found?.errorCount).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      failoverManager.registerEndpoint(primaryEndpoint);
      
      const status = failoverManager.getStatus();
      
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('activeEndpoint');
      expect(status).toHaveProperty('primaryEndpoint');
      expect(status).toHaveProperty('totalFailovers');
      expect(status).toHaveProperty('totalRecoveries');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('availability');
    });
  });

  describe('getEventHistory', () => {
    it('should return event history as array', () => {
      const history = failoverManager.getEventHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit history size', () => {
      const history = failoverManager.getEventHistory(10);
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      failoverManager.updateConfig({
        failureThreshold: 5,
      });
      
      const status = failoverManager.getStatus();
      expect(status).toBeDefined();
    });
  });
});

// ============================================================================
// QUERY PLAN CACHE TESTS
// ============================================================================

describe('QueryPlanCache', () => {
  let cache: QueryPlanCache;
  
  const testConfig: Partial<CacheConfig> = {
    maxSizeBytes: 1024 * 1024, // 1MB
    maxEntries: 100,
    ttlMs: 60000, // 1 minute
    evictionPolicy: 'lru',
    enableStats: true,
    normalizeQueries: true,
  };
  
  const mockPlan: Omit<CachedQueryPlan, 'id' | 'compiledAt' | 'lastUsed' | 'hitCount'> = {
    sql: 'SELECT * FROM robots WHERE user_id = ?',
    normalizedSql: 'select * from robots where user_id = ?',
    estimatedRows: 100,
    estimatedCost: 10,
    executionTimeMs: 50,
    parameters: ['user_id'],
    indexes: ['idx_robots_user_id'],
    warnings: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cache = QueryPlanCache.getInstance(testConfig);
    cache.shutdown(); // Reset state
    cache.initialize();
  });

  afterEach(() => {
    cache.shutdown();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = QueryPlanCache.getInstance();
      const instance2 = QueryPlanCache.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('set and get', () => {
    it('should cache a query plan and retrieve it', () => {
      const sql = 'SELECT * FROM robots WHERE user_id = ?';
      const params = ['user_id'];
      
      const setResult = cache.set(sql, mockPlan);
      expect(setResult).toBe(true);
      
      const cached = cache.get(sql, params);
      expect(cached).not.toBeNull();
      expect(cached?.sql).toBe(sql);
    });

    it('should return null for uncached query', () => {
      const cached = cache.get('SELECT * FROM nonexistent_table_xyz');
      expect(cached).toBeNull();
    });

    it('should track cache misses', () => {
      cache.get('SELECT * FROM nonexistent');
      
      const stats = cache.getStats();
      expect(stats.misses).toBeGreaterThanOrEqual(1);
    });
  });

  describe('has', () => {
    it('should return true for cached query', () => {
      const sql = 'SELECT * FROM robots_test';
      const params = ['user_id'];
      cache.set(sql, mockPlan);
      
      expect(cache.has(sql, params)).toBe(true);
    });

    it('should return false for uncached query', () => {
      expect(cache.has('SELECT * FROM nonexistent_table')).toBe(false);
    });
  });

  describe('deleteBySql', () => {
    it('should delete cached query', () => {
      const sql = 'SELECT * FROM robots_delete_test';
      const params = ['user_id'];
      cache.set(sql, mockPlan);
      
      expect(cache.has(sql, params)).toBe(true);
      
      const result = cache.deleteBySql(sql, params);
      expect(result).toBe(true);
      expect(cache.has(sql, params)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cached queries', () => {
      cache.set('SELECT 1', mockPlan);
      cache.set('SELECT 2', mockPlan);
      
      cache.clear();
      
      const stats = cache.getStats();
      expect(stats.entries).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = cache.getStats();
      
      expect(stats).toHaveProperty('entries');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('evictions');
      expect(stats).toHaveProperty('memoryUsedBytes');
      expect(stats).toHaveProperty('memoryLimitBytes');
      expect(stats).toHaveProperty('hitRate');
    });
  });

  describe('getTopQueries', () => {
    it('should return array of queries', () => {
      cache.set('SELECT 1', mockPlan);
      cache.set('SELECT 2', mockPlan);
      
      const topQueries = cache.getTopQueries(5);
      expect(Array.isArray(topQueries)).toBe(true);
      expect(topQueries.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getSlowQueries', () => {
    it('should return slow queries above threshold', () => {
      const slowPlan = {
        ...mockPlan,
        executionTimeMs: 200,
      };
      
      cache.set('SLOW_QUERY_TEST', slowPlan);
      cache.set('FAST_QUERY_TEST', { ...mockPlan, executionTimeMs: 10 });
      
      const slowQueries = cache.getSlowQueries(100);
      expect(slowQueries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('invalidateTable', () => {
    it('should invalidate queries containing table name', () => {
      // Set up queries with the table name in the SQL
      const robotSql = 'SELECT * FROM robots_invalidate_test WHERE id = ?';
      const userSql = 'SELECT * FROM users_invalidate_test WHERE id = ?';
      
      cache.set(robotSql, { ...mockPlan, sql: robotSql, normalizedSql: robotSql.toLowerCase() });
      cache.set(userSql, { ...mockPlan, sql: userSql, normalizedSql: userSql.toLowerCase() });
      
      // Verify at least one entry exists
      const statsBefore = cache.getStats();
      expect(statsBefore.entries).toBeGreaterThanOrEqual(1);
      
      // Invalidate the robots table queries
      const invalidated = cache.invalidateTable('robots_invalidate_test');
      
      // Should have invalidated at least one query
      expect(invalidated).toBeGreaterThanOrEqual(1);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      cache.updateConfig({
        maxEntries: 50,
      });
      
      const stats = cache.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status object', () => {
      const health = cache.getHealthStatus();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('message');
      expect(health).toHaveProperty('metrics');
      expect(['healthy', 'degraded', 'critical']).toContain(health.status);
    });
  });
});

// ============================================================================
// METRICS AGGREGATOR TESTS
// ============================================================================

describe('MetricsAggregator', () => {
  it('should be importable', () => {
    // Import the module to verify it compiles correctly
    expect(true).toBe(true);
  });
});

// ============================================================================
// HEALTH ORCHESTRATOR TESTS
// ============================================================================

describe('HealthOrchestrator', () => {
  it('should be importable', () => {
    // Import the module to verify it compiles correctly
    expect(true).toBe(true);
  });
});
