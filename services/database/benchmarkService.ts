/**
 * Database Benchmark Service
 * 
 * Provides performance regression testing and benchmarking capabilities
 * for database operations. Tracks performance over time and alerts on
 * performance degradation.
 * 
 * Features:
 * - Operation timing benchmarks
 * - Regression detection
 * - Performance trending
 * - Baseline comparisons
 * - Automated benchmark suites
 * 
 * @module services/database/benchmarkService
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateRobotDTO } from '../../types/database';
import { COUNT_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('BenchmarkService');

// ============================================================================
// TYPES
// ============================================================================

export interface BenchmarkResult {
  id: string;
  name: string;
  category: BenchmarkCategory;
  timestamp: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p50Time: number;
  p95Time: number;
  p99Time: number;
  opsPerSecond: number;
  successRate: number;
  errorCount: number;
  baseline: BaselineComparison | null;
  regression: RegressionInfo | null;
}

export type BenchmarkCategory = 
  | 'read'
  | 'write'
  | 'update'
  | 'delete'
  | 'query'
  | 'batch'
  | 'cache'
  | 'connection';

export interface BaselineComparison {
  baselineAvg: number;
  baselineTimestamp: string;
  percentChange: number;
  status: 'improved' | 'stable' | 'degraded' | 'critical';
}

export interface RegressionInfo {
  isRegressed: boolean;
  severity: 'none' | 'minor' | 'moderate' | 'major' | 'critical';
  threshold: number;
  actualChange: number;
}

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  benchmarks: BenchmarkConfig[];
  createdAt: string;
  lastRun: string | null;
  runCount: number;
}

export interface BenchmarkConfig {
  name: string;
  category: BenchmarkCategory;
  iterations: number;
  warmupIterations: number;
  timeout: number;
  baselineThreshold: number; // Percentage threshold for regression
  criticalThreshold: number; // Percentage for critical regression
  enabled: boolean;
}

export interface BenchmarkHistory {
  name: string;
  results: BenchmarkResult[];
  trend: 'improving' | 'stable' | 'degrading';
  avgOverLast5: number;
  changeFromBaseline: number;
}

export interface BenchmarkReport {
  timestamp: string;
  suite: string;
  totalBenchmarks: number;
  passed: number;
  failed: number;
  regressions: number;
  results: BenchmarkResult[];
  summary: {
    avgOpsPerSecond: number;
    avgLatency: number;
    overallScore: number;
    healthStatus: 'healthy' | 'degraded' | 'critical';
  };
  recommendations: string[];
}

type BenchmarkOperation = () => Promise<unknown>;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  name: 'default',
  category: 'query',
  iterations: 10,
  warmupIterations: 2,
  timeout: 30000,
  baselineThreshold: 20, // 20% degradation triggers warning
  criticalThreshold: 50, // 50% degradation is critical
  enabled: true,
};

const DEFAULT_BENCHMARK_SUITE: BenchmarkSuite = {
  id: 'default',
  name: 'Default Benchmark Suite',
  description: 'Standard database performance benchmarks',
  benchmarks: [],
  createdAt: new Date().toISOString(),
  lastRun: null,
  runCount: 0,
};

// ============================================================================
// BENCHMARK SERVICE CLASS
// ============================================================================

/**
 * Provides database performance benchmarking capabilities
 */
export class BenchmarkService {
  private static instance: BenchmarkService;
  private baselines: Map<string, BenchmarkResult> = new Map();
  private history: Map<string, BenchmarkResult[]> = new Map();
  private suites: Map<string, BenchmarkSuite> = new Map();
  private maxHistorySize = COUNT_CONSTANTS.HISTORY.STANDARD;

  private constructor() {
    this.initializeDefaultSuite();
  }

  static getInstance(): BenchmarkService {
    if (!BenchmarkService.instance) {
      BenchmarkService.instance = new BenchmarkService();
    }
    return BenchmarkService.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Run a single benchmark
   */
  async runBenchmark(
    name: string,
    operation: BenchmarkOperation,
    config: Partial<BenchmarkConfig> = {}
  ): Promise<BenchmarkResult> {
    const fullConfig: BenchmarkConfig = { ...DEFAULT_BENCHMARK_CONFIG, ...config, name };
    
    logger.log(`Running benchmark: ${name} (${fullConfig.iterations} iterations)`);

    // Warmup runs
    for (let i = 0; i < fullConfig.warmupIterations; i++) {
      try {
        await operation();
      } catch {
        // Ignore warmup errors
      }
    }

    // Actual benchmark runs
    const times: number[] = [];
    let errorCount = 0;
    const startTime = performance.now();

    for (let i = 0; i < fullConfig.iterations; i++) {
      const iterStart = performance.now();
      try {
        await operation();
        times.push(performance.now() - iterStart);
      } catch (error) {
        errorCount++;
        logger.warn(`Benchmark ${name} iteration ${i} failed:`, error);
      }
    }

    const totalTime = performance.now() - startTime;

    // Calculate statistics
    const result = this.calculateStatistics(
      name,
      fullConfig.category,
      times,
      fullConfig.iterations,
      totalTime,
      errorCount
    );

    // Compare with baseline
    result.baseline = this.compareWithBaseline(result, fullConfig);
    result.regression = this.detectRegression(result, fullConfig);

    // Store in history
    this.addToHistory(name, result);

    // Update baseline if this is the first run
    if (!this.baselines.has(name)) {
      this.baselines.set(name, result);
      logger.log(`Set baseline for ${name}: ${result.avgTime.toFixed(2)}ms`);
    }

    return result;
  }

  /**
   * Run a benchmark suite
   */
  async runSuite(
    suiteId: string,
    client: SupabaseClient,
    testUserId: string
  ): Promise<BenchmarkReport> {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new Error(`Benchmark suite not found: ${suiteId}`);
    }

    logger.log(`Running benchmark suite: ${suite.name}`);

    const results: BenchmarkResult[] = [];
    let passed = 0;
    let failed = 0;
    let regressions = 0;

    for (const config of suite.benchmarks) {
      if (!config.enabled) continue;

      try {
        const operation = this.getOperationForBenchmark(config.name, client, testUserId);
        const result = await this.runBenchmark(config.name, operation, config);
        results.push(result);

        if (result.successRate === 1) {
          passed++;
        } else {
          failed++;
        }

        if (result.regression?.isRegressed) {
          regressions++;
        }
      } catch (error) {
        logger.error(`Benchmark ${config.name} failed:`, error);
        failed++;
      }
    }

    // Update suite metadata
    suite.lastRun = new Date().toISOString();
    suite.runCount++;

    // Generate report
    const report = this.generateReport(suite, results, passed, failed, regressions);

    logger.log(`Suite completed: ${passed} passed, ${failed} failed, ${regressions} regressions`);

    return report;
  }

  /**
   * Get benchmark history for a specific benchmark
   */
  getHistory(name: string): BenchmarkHistory | null {
    const results = this.history.get(name);
    if (!results || results.length === 0) return null;

    const baseline = this.baselines.get(name);
    const last5 = results.slice(-5);
    const avgOverLast5 = last5.reduce((sum, r) => sum + r.avgTime, 0) / last5.length;

    // Calculate trend
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (last5.length >= 3) {
      const recent = last5.slice(-3);
      const older = last5.slice(0, -3);
      if (older.length > 0) {
        const recentAvg = recent.reduce((sum, r) => sum + r.avgTime, 0) / recent.length;
        const olderAvg = older.reduce((sum, r) => sum + r.avgTime, 0) / older.length;
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        trend = change < -5 ? 'improving' : change > 5 ? 'degrading' : 'stable';
      }
    }

    return {
      name,
      results,
      trend,
      avgOverLast5,
      changeFromBaseline: baseline 
        ? ((avgOverLast5 - baseline.avgTime) / baseline.avgTime) * 100 
        : 0,
    };
  }

  /**
   * Get all benchmark history
   */
  getAllHistory(): Map<string, BenchmarkHistory> {
    const allHistory = new Map<string, BenchmarkHistory>();
    for (const name of this.history.keys()) {
      const hist = this.getHistory(name);
      if (hist) {
        allHistory.set(name, hist);
      }
    }
    return allHistory;
  }

  /**
   * Set a baseline for a benchmark
   */
  setBaseline(name: string, result: BenchmarkResult): void {
    this.baselines.set(name, result);
    logger.log(`Baseline set for ${name}: ${result.avgTime.toFixed(2)}ms`);
  }

  /**
   * Clear history for a specific benchmark
   */
  clearHistory(name?: string): void {
    if (name) {
      this.history.delete(name);
    } else {
      this.history.clear();
    }
  }

  /**
   * Add a custom benchmark to a suite
   */
  addBenchmarkToSuite(suiteId: string, config: BenchmarkConfig): void {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteId}`);
    }
    suite.benchmarks.push(config);
  }

  /**
   * Create a new benchmark suite
   */
  createSuite(suite: Partial<BenchmarkSuite>): BenchmarkSuite {
    const newSuite: BenchmarkSuite = {
      ...DEFAULT_BENCHMARK_SUITE,
      ...suite,
      id: suite.id || `suite_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.suites.set(newSuite.id, newSuite);
    return newSuite;
  }

  /**
   * Get all suites
   */
  getSuites(): BenchmarkSuite[] {
    return Array.from(this.suites.values());
  }

  /**
   * Get baseline comparison report
   */
  getBaselineReport(): { name: string; baseline: BenchmarkResult | null; current: BenchmarkResult | null }[] {
    const report: { name: string; baseline: BenchmarkResult | null; current: BenchmarkResult | null }[] = [];
    
    for (const name of this.baselines.keys()) {
      const baseline = this.baselines.get(name);
      const history = this.history.get(name);
      const current = history && history.length > 0 ? history[history.length - 1] : null;
      
      report.push({ name, baseline: baseline || null, current });
    }
    
    return report;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private initializeDefaultSuite(): void {
    const defaultSuite: BenchmarkSuite = {
      id: 'default',
      name: 'Standard Database Benchmarks',
      description: 'Core database operation benchmarks for regression testing',
      benchmarks: [
        { name: 'select_single_robot', category: 'read', iterations: 50, warmupIterations: 5, timeout: 10000, baselineThreshold: 20, criticalThreshold: 50, enabled: true },
        { name: 'select_user_robots', category: 'query', iterations: 20, warmupIterations: 3, timeout: 15000, baselineThreshold: 25, criticalThreshold: 60, enabled: true },
        { name: 'insert_robot', category: 'write', iterations: 10, warmupIterations: 2, timeout: 20000, baselineThreshold: 30, criticalThreshold: 70, enabled: true },
        { name: 'update_robot', category: 'update', iterations: 20, warmupIterations: 3, timeout: 15000, baselineThreshold: 25, criticalThreshold: 60, enabled: true },
        { name: 'delete_robot', category: 'delete', iterations: 10, warmupIterations: 2, timeout: 15000, baselineThreshold: 25, criticalThreshold: 60, enabled: true },
        { name: 'batch_insert_robots', category: 'batch', iterations: 5, warmupIterations: 1, timeout: 30000, baselineThreshold: 35, criticalThreshold: 80, enabled: true },
        { name: 'search_robots', category: 'query', iterations: 30, warmupIterations: 5, timeout: 20000, baselineThreshold: 20, criticalThreshold: 50, enabled: true },
        { name: 'count_robots', category: 'query', iterations: 50, warmupIterations: 5, timeout: 10000, baselineThreshold: 15, criticalThreshold: 40, enabled: true },
      ],
      createdAt: new Date().toISOString(),
      lastRun: null,
      runCount: 0,
    };
    
    this.suites.set(defaultSuite.id, defaultSuite);
  }

  private calculateStatistics(
    name: string,
    category: BenchmarkCategory,
    times: number[],
    iterations: number,
    totalTime: number,
    errorCount: number
  ): BenchmarkResult {
    const sortedTimes = [...times].sort((a, b) => a - b);
    const successCount = times.length;
    const successRate = iterations > 0 ? successCount / iterations : 0;

    return {
      id: `bench_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      category,
      timestamp: new Date().toISOString(),
      iterations,
      totalTime,
      avgTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      minTime: sortedTimes[0] || 0,
      maxTime: sortedTimes[sortedTimes.length - 1] || 0,
      p50Time: this.percentile(sortedTimes, 50),
      p95Time: this.percentile(sortedTimes, 95),
      p99Time: this.percentile(sortedTimes, 99),
      opsPerSecond: totalTime > 0 ? (successCount / totalTime) * 1000 : 0,
      successRate,
      errorCount,
      baseline: null,
      regression: null,
    };
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private compareWithBaseline(
    result: BenchmarkResult,
    config: BenchmarkConfig
  ): BaselineComparison | null {
    const baseline = this.baselines.get(result.name);
    if (!baseline) return null;

    const percentChange = ((result.avgTime - baseline.avgTime) / baseline.avgTime) * 100;
    
    let status: BaselineComparison['status'];
    if (percentChange < -config.baselineThreshold) {
      status = 'improved';
    } else if (percentChange <= config.baselineThreshold) {
      status = 'stable';
    } else if (percentChange <= config.criticalThreshold) {
      status = 'degraded';
    } else {
      status = 'critical';
    }

    return {
      baselineAvg: baseline.avgTime,
      baselineTimestamp: baseline.timestamp,
      percentChange,
      status,
    };
  }

  private detectRegression(
    result: BenchmarkResult,
    config: BenchmarkConfig
  ): RegressionInfo {
    if (!result.baseline) {
      return {
        isRegressed: false,
        severity: 'none',
        threshold: config.baselineThreshold,
        actualChange: 0,
      };
    }

    const change = result.baseline.percentChange;
    let isRegressed = false;
    let severity: RegressionInfo['severity'] = 'none';

    if (change > config.criticalThreshold) {
      isRegressed = true;
      severity = 'critical';
    } else if (change > config.baselineThreshold) {
      isRegressed = true;
      severity = change > (config.baselineThreshold + config.criticalThreshold) / 2 ? 'major' : 'moderate';
    } else if (change > config.baselineThreshold * 0.5) {
      severity = 'minor';
    }

    return {
      isRegressed,
      severity,
      threshold: config.baselineThreshold,
      actualChange: change,
    };
  }

  private addToHistory(name: string, result: BenchmarkResult): void {
    if (!this.history.has(name)) {
      this.history.set(name, []);
    }
    const results = this.history.get(name)!;
    results.push(result);
    
    // Trim history if needed
    if (results.length > this.maxHistorySize) {
      results.splice(0, results.length - this.maxHistorySize);
    }
  }

  private getOperationForBenchmark(
    name: string,
    client: SupabaseClient,
    testUserId: string
  ): BenchmarkOperation {
    const operations: Record<string, BenchmarkOperation> = {
      select_single_robot: async () => {
        const { data } = await client
          .from('robots')
          .select('*')
          .eq('user_id', testUserId)
          .limit(1)
          .single();
        return data;
      },

      select_user_robots: async () => {
        const { data } = await client
          .from('robots')
          .select('*')
          .eq('user_id', testUserId)
          .limit(20);
        return data;
      },

      insert_robot: async () => {
        const robot: CreateRobotDTO = {
          name: `Benchmark Robot ${Date.now()}`,
          code: '// Benchmark test code',
          strategy_type: 'Custom',
        };
        const { data } = await client
          .from('robots')
          .insert({ ...robot, user_id: testUserId })
          .select()
          .single();
        return data;
      },

      update_robot: async () => {
        // First get a robot to update
        const { data: existing } = await client
          .from('robots')
          .select('id')
          .eq('user_id', testUserId)
          .limit(1)
          .single();

        if (existing) {
          await client
            .from('robots')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        }
        return existing;
      },

      delete_robot: async () => {
        // Create then delete for benchmark
        const { data: created } = await client
          .from('robots')
          .insert({
            name: `Delete Test ${Date.now()}`,
            code: '// temp',
            user_id: testUserId,
          })
          .select()
          .single();

        if (created) {
          await client.from('robots').delete().eq('id', created.id);
        }
        return created;
      },

      batch_insert_robots: async () => {
        const robots = Array.from({ length: 5 }, (_, i) => ({
          name: `Batch Test ${Date.now()}_${i}`,
          code: '// batch test',
          user_id: testUserId,
          strategy_type: 'Custom' as const,
        }));
        const { data } = await client.from('robots').insert(robots).select();
        // Cleanup
        if (data) {
          await client.from('robots').delete().in('id', data.map((r: { id: string }) => r.id));
        }
        return data;
      },

      search_robots: async () => {
        const { data } = await client
          .from('robots')
          .select('*')
          .eq('user_id', testUserId)
          .ilike('name', '%test%')
          .limit(10);
        return data;
      },

      count_robots: async () => {
        const { count } = await client
          .from('robots')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', testUserId);
        return count;
      },
    };

    return operations[name] || (async () => null);
  }

  private generateReport(
    suite: BenchmarkSuite,
    results: BenchmarkResult[],
    passed: number,
    failed: number,
    regressions: number
  ): BenchmarkReport {
    const avgOpsPerSecond = results.length > 0
      ? results.reduce((sum, r) => sum + r.opsPerSecond, 0) / results.length
      : 0;
    
    const avgLatency = results.length > 0
      ? results.reduce((sum, r) => sum + r.avgTime, 0) / results.length
      : 0;

    // Calculate overall score (0-100)
    const successRate = suite.benchmarks.length > 0
      ? passed / suite.benchmarks.length
      : 0;
    const regressionPenalty = regressions * 10;
    const overallScore = Math.max(0, Math.min(100, (successRate * 100) - regressionPenalty));

    // Determine health status
    let healthStatus: 'healthy' | 'degraded' | 'critical';
    if (overallScore >= 80 && regressions === 0) {
      healthStatus = 'healthy';
    } else if (overallScore >= 50 && regressions <= 2) {
      healthStatus = 'degraded';
    } else {
      healthStatus = 'critical';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    results.forEach(result => {
      if (result.regression?.isRegressed) {
        recommendations.push(
          `Performance regression detected in "${result.name}": ${result.regression.actualChange.toFixed(1)}% slower than baseline`
        );
      }
      if (result.errorCount > 0) {
        recommendations.push(
          `"${result.name}" had ${result.errorCount} errors during benchmark`
        );
      }
    });

    if (avgLatency > 100) {
      recommendations.push('Average latency is high. Consider optimizing queries or adding indexes.');
    }

    return {
      timestamp: new Date().toISOString(),
      suite: suite.name,
      totalBenchmarks: suite.benchmarks.filter(b => b.enabled).length,
      passed,
      failed,
      regressions,
      results,
      summary: {
        avgOpsPerSecond,
        avgLatency,
        overallScore,
        healthStatus,
      },
      recommendations,
    };
  }
}

// Export singleton instance
export const benchmarkService = BenchmarkService.getInstance();
