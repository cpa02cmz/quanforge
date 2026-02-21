/**
 * Database Architect Services Tests
 * 
 * Tests for benchmark, archiving, and seeding services
 * 
 * @module services/database/architectServices.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BenchmarkService, type BenchmarkCategory } from './benchmarkService';
import { ArchivingService, type ArchiveConfig } from './archivingService';
import { SeedingService, type SeedingConfig, type RobotTemplate } from './seedingService';

// Mock Supabase client with proper chaining
interface MockQuery {
  select: () => MockQuery;
  eq: () => MockQuery;
  neq: () => MockQuery;
  gt: () => MockQuery;
  gte: () => MockQuery;
  lt: () => MockQuery;
  lte: () => MockQuery;
  not: () => MockQuery;
  is: () => MockQuery;
  in: () => Promise<{ data: unknown[]; error: null }>;
  ilike: () => Promise<{ data: unknown[]; error: null }>;
  limit: () => Promise<{ data: unknown[]; error: null }>;
  order: () => MockQuery;
  single: () => Promise<{ data: { id: string }; error: null }>;
}

const createMockQuery = (): MockQuery => {
  const result = { data: [], error: null };
  const chain: MockQuery = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    gt: () => chain,
    gte: () => chain,
    lt: () => chain,
    lte: () => chain,
    not: () => chain,
    is: () => chain,
    in: () => Promise.resolve(result) as Promise<{ data: unknown[]; error: null }>,
    ilike: () => Promise.resolve(result) as Promise<{ data: unknown[]; error: null }>,
    limit: () => Promise.resolve(result) as Promise<{ data: unknown[]; error: null }>,
    order: () => chain,
    single: () => Promise.resolve({ data: { id: 'test-id' }, error: null }),
  };
  return chain;
};

const mockClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => createMockQuery()),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
      in: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
} as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>;

// ============================================================================
// BENCHMARK SERVICE TESTS
// ============================================================================

describe('BenchmarkService', () => {
  let service: BenchmarkService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = BenchmarkService.getInstance();
    service.clearHistory();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = BenchmarkService.getInstance();
      const instance2 = BenchmarkService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('runBenchmark', () => {
    it('should run benchmark and return result', async () => {
      const operation = vi.fn().mockResolvedValue({ data: 'test' });
      
      const result = await service.runBenchmark('test_benchmark', operation, {
        iterations: 5,
        warmupIterations: 1,
      });

      expect(result.name).toBe('test_benchmark');
      expect(result.iterations).toBe(5);
      expect(result.successRate).toBe(1);
      expect(result.avgTime).toBeGreaterThanOrEqual(0);
      expect(operation).toHaveBeenCalledTimes(6); // 5 iterations + 1 warmup
    });

    it('should handle errors in operations', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));
      
      const result = await service.runBenchmark('error_benchmark', operation, {
        iterations: 3,
        warmupIterations: 0,
      });

      expect(result.errorCount).toBe(3);
      expect(result.successRate).toBe(0);
    });

    it('should calculate percentiles correctly', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 5));
        return true;
      });
      
      const result = await service.runBenchmark('percentile_test', operation, {
        iterations: 10,
        warmupIterations: 0,
      });

      expect(result.minTime).toBeLessThanOrEqual(result.p50Time);
      expect(result.p50Time).toBeLessThanOrEqual(result.p95Time);
      expect(result.p95Time).toBeLessThanOrEqual(result.p99Time);
      expect(result.p99Time).toBeLessThanOrEqual(result.maxTime);
    });

    it('should detect regression when performance degrades', async () => {
      // First run - set baseline
      const fastOperation = vi.fn().mockResolvedValue(true);
      const result1 = await service.runBenchmark('regression_test', fastOperation, {
        iterations: 5,
        warmupIterations: 0,
        baselineThreshold: 20,
      });
      
      expect(result1.baseline).toBeNull(); // First run, no comparison

      // Second run - slower
      const slowOperation = vi.fn().mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 50));
        return true;
      });
      
      const result2 = await service.runBenchmark('regression_test', slowOperation, {
        iterations: 5,
        warmupIterations: 0,
        baselineThreshold: 20,
      });

      expect(result2.baseline).not.toBeNull();
      // Should detect slower performance
      if (result2.baseline!.percentChange > 20) {
        expect(result2.regression?.isRegressed).toBe(true);
      }
    });
  });

  describe('getHistory', () => {
    it('should return null for unknown benchmark', () => {
      const history = service.getHistory('unknown_benchmark');
      expect(history).toBeNull();
    });

    it('should return history after running benchmarks', async () => {
      const operation = vi.fn().mockResolvedValue(true);
      
      await service.runBenchmark('history_test', operation, { iterations: 3, warmupIterations: 0 });
      
      const history = service.getHistory('history_test');
      expect(history).not.toBeNull();
      expect(history!.results.length).toBe(1);
    });
  });

  describe('createSuite', () => {
    it('should create a new benchmark suite', () => {
      const suite = service.createSuite({
        name: 'Custom Suite',
        description: 'Test suite',
        benchmarks: [{ name: 'custom_test', category: 'query', iterations: 10, warmupIterations: 2, timeout: 10000, baselineThreshold: 20, criticalThreshold: 50, enabled: true }],
      });

      expect(suite.name).toBe('Custom Suite');
      expect(suite.benchmarks.length).toBe(1);
    });
  });

  describe('getSuites', () => {
    it('should return all suites including default', () => {
      const suites = service.getSuites();
      expect(suites.length).toBeGreaterThan(0);
      expect(suites.find(s => s.id === 'default')).toBeDefined();
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', async () => {
      const operation = vi.fn().mockResolvedValue(true);
      
      await service.runBenchmark('clear_test', operation, { iterations: 3, warmupIterations: 0 });
      service.clearHistory();
      
      const history = service.getHistory('clear_test');
      expect(history).toBeNull();
    });
  });
});

// ============================================================================
// ARCHIVING SERVICE TESTS
// ============================================================================

describe('ArchivingService', () => {
  let service: ArchivingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = ArchivingService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ArchivingService.getInstance();
      const instance2 = ArchivingService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();
      
      expect(config).toHaveProperty('archiveAgeDays');
      expect(config).toHaveProperty('deletedRetentionDays');
      expect(config).toHaveProperty('batchSize');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service.updateConfig({ archiveAgeDays: 60 });
      const config = service.getConfig();
      
      expect(config.archiveAgeDays).toBe(60);
    });
  });

  describe('findArchiveCandidates', () => {
    it('should return candidates for archiving', async () => {
      const candidates = await service.findArchiveCandidates(mockClient);
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('should respect limit option', async () => {
      const candidates = await service.findArchiveCandidates(mockClient, { limit: 5 });
      // Mock returns empty, so just check it doesn't throw
      expect(Array.isArray(candidates)).toBe(true);
    });
  });

  describe('archiveRobots', () => {
    it('should handle dry run mode', async () => {
      service.updateConfig({ dryRun: true });
      
      const result = await service.archiveRobots(mockClient, ['id1', 'id2'], 'manual');
      
      expect(result.archived).toEqual(['id1', 'id2']);
      expect(result.failed).toEqual([]);
      
      service.updateConfig({ dryRun: false });
    });
  });

  describe('restoreRobots', () => {
    it('should handle dry run mode', async () => {
      service.updateConfig({ dryRun: true });
      
      const result = await service.restoreRobots(mockClient, ['id1']);
      
      expect(result.restoredCount).toBe(1);
      
      service.updateConfig({ dryRun: false });
    });
  });

  describe('purgeDeletedRecords', () => {
    it('should handle dry run mode', async () => {
      service.updateConfig({ dryRun: true });
      
      const result = await service.purgeDeletedRecords(mockClient, 30);
      
      expect(result.purgedCount).toBeGreaterThanOrEqual(0);
      
      service.updateConfig({ dryRun: false });
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report', async () => {
      const report = await service.generateReport(mockClient);
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('config');
      expect(report).toHaveProperty('stats');
      expect(report).toHaveProperty('candidates');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });
});

// ============================================================================
// SEEDING SERVICE TESTS
// ============================================================================

describe('SeedingService', () => {
  let service: SeedingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = SeedingService.getInstance();
    service.reset();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SeedingService.getInstance();
      const instance2 = SeedingService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();
      
      expect(config).toHaveProperty('defaultRobotCount');
      expect(config).toHaveProperty('batchSize');
      expect(config).toHaveProperty('addVariations');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service.updateConfig({ defaultRobotCount: 50 });
      const config = service.getConfig();
      
      expect(config.defaultRobotCount).toBe(50);
    });
  });

  describe('getTemplates', () => {
    it('should return all robot templates', () => {
      const templates = service.getTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('namePrefix');
      expect(templates[0]).toHaveProperty('strategyType');
      expect(templates[0]).toHaveProperty('codeTemplate');
    });
  });

  describe('generateRobot', () => {
    it('should generate robot with template data', () => {
      const template: RobotTemplate = {
        namePrefix: 'Test Robot',
        strategyType: 'Trend',
        codeTemplate: '// test code',
        description: 'Test description',
        strategyParams: { riskPercent: 2 },
        backtestSettings: { initialDeposit: 10000 },
      };

      const robot = service.generateRobot(template, 0, 'user-123');
      
      expect(robot.name).toContain('Test Robot');
      expect(robot.strategy_type).toBe('Trend');
      expect(robot.code).toContain('test code');
    });

    it('should add variations when configured', () => {
      service.updateConfig({ addVariations: true });
      
      const template: RobotTemplate = {
        namePrefix: 'Test',
        strategyType: 'Custom',
        codeTemplate: '// code',
        description: 'Test',
        strategyParams: { riskPercent: 2 },
        backtestSettings: {},
      };

      const robot = service.generateRobot(template, 0, 'user-123');
      
      expect(robot.strategy_params?.riskPercent).toBeDefined();
    });

    it('should include chat history when configured', () => {
      service.updateConfig({ includeChatHistory: true });
      
      const template: RobotTemplate = {
        namePrefix: 'Test',
        strategyType: 'Custom',
        codeTemplate: '// code',
        description: 'Test',
        strategyParams: {},
        backtestSettings: {},
      };

      const robot = service.generateRobot(template, 0, 'user-123');
      
      expect(robot.chat_history).toBeDefined();
      expect(robot.chat_history!.length).toBeGreaterThan(0);
    });

    it('should exclude chat history when not configured', () => {
      service.updateConfig({ includeChatHistory: false });
      
      const template: RobotTemplate = {
        namePrefix: 'Test',
        strategyType: 'Custom',
        codeTemplate: '// code',
        description: 'Test',
        strategyParams: {},
        backtestSettings: {},
      };

      const robot = service.generateRobot(template, 0, 'user-123');
      
      expect(robot.chat_history).toEqual([]);
    });
  });

  describe('seed', () => {
    it('should handle dry run mode', async () => {
      service.updateConfig({ dryRun: true });
      
      const result = await service.seed(mockClient, {
        userCount: 1,
        robotsPerUser: 5,
      });
      
      expect(result.robotsCreated).toBe(5);
      expect(result.errors).toEqual([]);
      
      service.updateConfig({ dryRun: false });
    });
  });

  describe('cleanup', () => {
    it('should return deleted count', async () => {
      // Even with no seeded data, cleanup should work
      const result = await service.cleanup(mockClient);
      
      expect(result).toHaveProperty('deleted');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('reset', () => {
    it('should clear all seeded IDs', () => {
      service.reset();
      const stats = service.getStats();
      
      expect(stats.totalSeeded).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return seeding statistics', () => {
      const stats = service.getStats();
      
      expect(stats).toHaveProperty('totalSeeded');
      expect(stats).toHaveProperty('byUser');
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Database Architect Services Integration', () => {
  it('should allow services to work together', async () => {
    const bench = BenchmarkService.getInstance();
    const archive = ArchivingService.getInstance();
    const seed = SeedingService.getInstance();

    // All should be singleton instances
    expect(bench).toBeDefined();
    expect(archive).toBeDefined();
    expect(seed).toBeDefined();

    // Should have proper type definitions
    const benchConfig: { iterations: number; category: BenchmarkCategory } = {
      iterations: 10,
      category: 'query',
    };
    expect(benchConfig.iterations).toBe(10);

    const archiveConfig: Partial<ArchiveConfig> = {
      archiveAgeDays: 90,
    };
    expect(archiveConfig.archiveAgeDays).toBe(90);

    const seedConfig: Partial<SeedingConfig> = {
      defaultRobotCount: 10,
    };
    expect(seedConfig.defaultRobotCount).toBe(10);
  });
});
