/**
 * Tests for Query Execution Planner Service
 * 
 * @module services/database/queryExecutionPlanner.test
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

import { QueryExecutionPlanner, type PlannerConfig } from './queryExecutionPlanner';

describe('QueryExecutionPlanner', () => {
  let planner: QueryExecutionPlanner;

  beforeEach(() => {
    // Create a fresh instance for each test
    // @ts-expect-error - Reset singleton for testing
    QueryExecutionPlanner.instance = undefined;
    
    const testConfig: Partial<PlannerConfig> = {
      enabled: true,
      optimizationLevel: 'aggressive',
      enableCaching: true,
      enableLearning: true,
    };
    planner = QueryExecutionPlanner.getInstance(testConfig);
    planner.initialize();
  });

  afterEach(() => {
    planner.shutdown();
  });

  describe('initialization', () => {
    it('should initialize correctly', () => {
      const stats = planner.getStatistics();
      expect(stats.totalPlans).toBe(0);
    });
  });

  describe('plan creation', () => {
    it('should create a plan for simple queries', () => {
      const sql = 'SELECT * FROM robots WHERE id = ?';
      const plan = planner.createPlan(sql);

      expect(plan).toBeDefined();
      expect(plan.sql).toBe(sql);
      expect(plan.normalizedSql).toContain('select');
      expect(plan.strategy).toBeDefined();
      expect(plan.complexity).toBeDefined();
      expect(plan.estimatedCost).toBeGreaterThan(0);
      expect(plan.estimatedDurationMs).toBeGreaterThan(0);
    });

    it('should create a plan with parameters', () => {
      const sql = 'SELECT * FROM robots WHERE user_id = ? AND is_active = ?';
      const params = ['user123', true];
      const plan = planner.createPlan(sql, params);

      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.dependencies).toContain('robots');
    });

    it('should determine query complexity correctly', () => {
      const simpleSql = 'SELECT id FROM robots LIMIT 10';
      const complexSql = `
        SELECT r.*, u.name, COUNT(*) as count
        FROM robots r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN trades t ON r.id = t.robot_id
        WHERE r.is_active = true
        GROUP BY r.id, u.name
        HAVING COUNT(*) > 5
        ORDER BY count DESC
      `;

      const simplePlan = planner.createPlan(simpleSql);
      const complexPlan = planner.createPlan(complexSql);

      expect(['simple', 'moderate']).toContain(simplePlan.complexity);
      expect(['complex', 'very_complex']).toContain(complexPlan.complexity);
    });

    it('should select appropriate execution strategy', () => {
      const sequentialSql = 'SELECT * FROM robots WHERE id = 1';
      const plan = planner.createPlan(sequentialSql);

      expect(['sequential', 'cached']).toContain(plan.strategy);
    });

    it('should extract dependencies from queries', () => {
      const sql = `
        SELECT r.*, u.name
        FROM robots r
        JOIN users u ON r.user_id = u.id
      `;
      const plan = planner.createPlan(sql);

      expect(plan.dependencies).toContain('robots');
      expect(plan.dependencies).toContain('users');
    });
  });

  describe('plan caching', () => {
    it('should cache identical queries', () => {
      const sql = 'SELECT * FROM robots WHERE id = ?';
      
      const plan1 = planner.createPlan(sql, [1]);
      const plan2 = planner.createPlan(sql, [2]);

      // Both should have similar structure (cached plan)
      expect(plan1.normalizedSql).toBe(plan2.normalizedSql);
    });

    it('should clear cache', () => {
      planner.createPlan('SELECT * FROM robots');
      
      planner.clearCache();
      const cachedPlans = planner.getCachedPlans();
      
      expect(cachedPlans.length).toBe(0);
    });

    it('should track cache statistics', () => {
      planner.createPlan('SELECT * FROM robots');
      planner.createPlan('SELECT * FROM robots');
      planner.createPlan('SELECT * FROM users');

      const stats = planner.getStatistics();
      expect(stats.cacheHits).toBeGreaterThan(0);
      expect(stats.totalPlans).toBeGreaterThan(0);
    });
  });

  describe('optimization suggestions', () => {
    it('should suggest optimizations for queries', () => {
      const sql = 'SELECT * FROM robots WHERE user_id = ? AND status = ?';
      const optimizations = planner.getOptimizations(sql);

      expect(Array.isArray(optimizations)).toBe(true);
    });

    it('should suggest index for WHERE clauses', () => {
      const sql = 'SELECT * FROM robots WHERE user_id = ?';
      const optimizations = planner.getOptimizations(sql);

      const indexSuggestion = optimizations.find(o => o.type === 'index');
      expect(indexSuggestion).toBeDefined();
    });

    it('should include optimizations in plan', () => {
      const sql = 'SELECT * FROM robots WHERE user_id = ? ORDER BY created_at DESC';
      const plan = planner.createPlan(sql);

      expect(Array.isArray(plan.optimizations)).toBe(true);
    });
  });

  describe('query validation', () => {
    it('should validate simple queries', () => {
      const sql = 'SELECT id, name FROM robots WHERE is_active = true';
      const result = planner.validateQuery(sql);

      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should detect unbalanced parentheses', () => {
      const sql = 'SELECT * FROM robots WHERE (id = 1';
      const result = planner.validateQuery(sql);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('parentheses'))).toBe(true);
    });

    it('should warn about SELECT *', () => {
      const sql = 'SELECT * FROM robots';
      const result = planner.validateQuery(sql);

      expect(result.warnings.some(w => w.includes('SELECT *'))).toBe(true);
    });

    it('should warn about missing WHERE clause', () => {
      const sql = 'SELECT id FROM robots';
      const result = planner.validateQuery(sql);

      expect(result.warnings.some(w => w.includes('WHERE'))).toBe(true);
    });
  });

  describe('execution recording', () => {
    it('should record execution metrics', () => {
      const plan = planner.createPlan('SELECT * FROM robots');
      
      // Should not throw
      expect(() => {
        planner.recordExecution(plan.id, 50, 100);
      }).not.toThrow();
    });
  });

  describe('plan comparison', () => {
    it('should compare two plans', () => {
      const plan1 = planner.createPlan('SELECT id FROM robots WHERE id = 1');
      const plan2 = planner.createPlan('SELECT * FROM robots WHERE user_id = 1');

      const comparison = planner.comparePlans(plan1, plan2);

      expect(comparison).toHaveProperty('winner');
      expect(comparison).toHaveProperty('costDifference');
      expect(comparison).toHaveProperty('durationDifference');
      expect(comparison).toHaveProperty('recommendation');
    });
  });

  describe('statistics', () => {
    it('should track statistics', () => {
      planner.createPlan('SELECT * FROM robots');
      planner.createPlan('SELECT * FROM users');

      const stats = planner.getStatistics();

      expect(stats.totalPlans).toBe(2);
      expect(stats.averageCost).toBeGreaterThan(0);
      expect(stats.averageDuration).toBeGreaterThan(0);
    });
  });

  describe('configuration update', () => {
    it('should update configuration', () => {
      planner.updateConfig({
        optimizationLevel: 'maximum',
      });

      // Should not throw
      expect(() => planner.getStatistics()).not.toThrow();
    });
  });
});
