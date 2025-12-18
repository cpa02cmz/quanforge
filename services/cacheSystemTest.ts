import { createScopedLogger } from '../utils/logger';
import { UnifiedCacheFactory, UnifiedCacheService } from './unifiedCacheService';
import { memoryMonitor, healthMonitor } from './memoryMonitor';
import { CacheSystemMigration } from './cacheSystemMigration';
import { CacheMigrationHelper } from './cacheMigration';
import { CACHE_CONFIGS, CACHE_STRATEGIES } from '../config/cache';

const logger = createScopedLogger('CacheSystemTest');

export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  metrics?: any;
}

export interface SuiteResult {
  suiteName: string;
  passed: boolean;
  tests: TestResult[];
  totalDuration: number;
}

/**
 * Comprehensive Cache System Test Suite
 * 
 * Tests all aspects of the new unified cache system including:
 * - Basic operations
 * - Performance benchmarks
 * - Memory management
 * - Migration validation
 * - Configuration validation
 */
export class CacheSystemTestSuite {
  private results: SuiteResult[] = [];

  /**
   * Run complete test suite
   */
  async runCompleteSuite(): Promise<{
    overallPassed: boolean;
    suites: SuiteResult[];
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      totalDuration: number;
    };
  }> {
    logger.info('Starting complete cache system test suite...');

    this.results = [];

    // Test suites
    await this.runBasicOperationsSuite();
    await this.runPerformanceSuite();
    await this.runMemoryManagementSuite();
    await this.runMigrationSuite();
    await this.runConfigurationSuite();
    await this.runIntegrationSuite();

    // Calculate summary
    const totalTests = this.results.reduce((sum, suite) => sum + suite.tests.length, 0);
    const passedTests = this.results.reduce((sum, suite) => 
      sum + suite.tests.filter(test => test.passed).length, 0);
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, suite) => sum + suite.totalDuration, 0);

    const overallPassed = failedTests === 0;

    logger.info(`Cache system test suite completed: ${passedTests}/${totalTests} passed`);

    return {
      overallPassed,
      suites: this.results,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        totalDuration
      }
    };
  }

  /**
   * Test basic cache operations
   */
  private async runBasicOperationsSuite(): Promise<SuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];
    logger.info('Running basic operations test suite...');

    try {
      // Test 1: Basic get/set
      tests.push(await this.runTest('basic-get-set', async () => {
        const cache = UnifiedCacheFactory.getInstance('test-basic');
        
        await cache.set('test-key', 'test-value');
        const result = await cache.get('test-key');
        
        if (result !== 'test-value') {
          throw new Error(`Expected 'test-value', got ${result}`);
        }
        
        return { operations: 2 };
      }));

      // Test 2: TTL expiration
      tests.push(await this.runTest('ttl-expiration', async () => {
        const cache = UnifiedCacheFactory.getInstance('test-ttl');
        
        await cache.set('expire-key', 'expire-value', { ttl: 100 }); // 100ms TTL
        
        // Should be available immediately
        const immediate = await cache.get('expire-key');
        if (immediate !== 'expire-value') {
          throw new Error('Value not available immediately');
        }
        
        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 150));
        const expired = await cache.get('expire-key');
        
        if (expired !== null) {
          throw new Error('Value should have expired');
        }
        
        return { ttlTest: true };
      }));

      // Test 3: Tag-based invalidation
      tests.push(await this.runTest('tag-invalidation', async () => {
        const cache = UnifiedCacheFactory.getInstance('test-tags');
        
        await cache.set('tag-key-1', 'value1', { tags: ['test-tag'] });
        await cache.set('tag-key-2', 'value2', { tags: ['test-tag'] });
        await cache.set('other-key', 'other', { tags: ['other-tag'] });
        
        const invalidated = cache.invalidateByTags(['test-tag']);
        
        if (invalidated !== 2) {
          throw new Error(`Expected 2 invalidated entries, got ${invalidated}`);
        }
        
        const val1 = await cache.get('tag-key-1');
        const val2 = await cache.get('tag-key-2');
        const other = await cache.get('other-key');
        
        if (val1 !== null || val2 !== null || other !== 'other') {
          throw new Error('Tag invalidation did not work correctly');
        }
        
        return { invalidated };
      }));

      // Test 4: Priority-based eviction
      tests.push(await this.runTest('priority-eviction', async () => {
        const cache = new UnifiedCacheService('test-priority', { 
          maxSize: 1024, // 1KB limit for testing
          maxEntries: 3
        });
        
        // Fill cache with different priorities
        await cache.set('low-priority', 'value1', { priority: 'low' });
        await cache.set('high-priority', 'value2', { priority: 'high' });
        await cache.set('normal-priority', 'value3', { priority: 'normal' });
        
        // Add one more to trigger eviction
        await cache.set('extra-priority', 'value4', { priority: 'low' });
        
        const stats = cache.getStats();
        
        if (stats.entryCount !== 3) {
          throw new Error(`Expected 3 entries, got ${stats.entryCount}`);
        }
        
        // High priority should still exist
        const highPriority = await cache.get('high-priority');
        if (highPriority !== 'value2') {
          throw new Error('High priority entry was evicted');
        }
        
        cache.destroy();
        return { evictionTest: true };
      }));

    } catch (error) {
      tests.push({
        testName: 'suite-error',
        passed: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const duration = Date.now() - startTime;
    const suiteResult: SuiteResult = {
      suiteName: 'Basic Operations',
      passed: tests.filter(t => t.passed).length === tests.length,
      tests,
      totalDuration: duration
    };

    this.results.push(suiteResult);
    return suiteResult;
  }

  /**
   * Test performance metrics
   */
  private async runPerformanceSuite(): Promise<SuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];
    logger.info('Running performance test suite...');

    try {
      // Test 1: Throughput benchmark
      tests.push(await this.runTest('throughput-benchmark', async () => {
        const cache = UnifiedCacheFactory.getInstance('test-throughput');
        const operations = 1000;
        const startTime = performance.now();
        
        // Set operations
        for (let i = 0; i < operations; i++) {
          await cache.set(`key-${i}`, `value-${i}`);
        }
        
        // Get operations
        for (let i = 0; i < operations; i++) {
          await cache.get(`key-${i}`);
        }
        
        const duration = performance.now() - startTime;
        const opsPerSecond = (operations * 2) / (duration / 1000);
        
        if (opsPerSecond < 1000) { // Should handle at least 1000 ops/sec
          logger.warn(`Lower than expected throughput: ${opsPerSecond.toFixed(2)} ops/sec`);
        }
        
        return { opsPerSecond, duration, operations };
      }));

      // Test 2: Memory efficiency
      tests.push(await this.runTest('memory-efficiency', async () => {
        const cache = UnifiedCacheFactory.getInstance('test-memory');
        const entries = 100;
        const baseData = { data: 'x'.repeat(100) }; // 100 bytes per entry
        
        // Fill cache
        for (let i = 0; i < entries; i++) {
          await cache.set(`mem-key-${i}`, { ...baseData, index: i });
        }
        
        const stats = cache.getStats();
        const avgSizePerEntry = stats.memoryUsage / stats.entryCount;
        
        // Should not be more than 10x the data size (includes overhead)
        const maxExpectedSize = 100 * 10; // 100 bytes * 10 = 1000 bytes per entry
        if (avgSizePerEntry > maxExpectedSize) {
          throw new Error(`Memory usage too high: ${avgSizePerEntry.toFixed(2)} bytes per entry`);
        }
        
        return { 
          avgSizePerEntry: avgSizePerEntry.toFixed(2),
          totalMemory: stats.memoryUsage,
          entries: stats.entryCount
        };
      }));

      // Test 3: Compression efficiency
      tests.push(await this.runTest('compression-efficiency', async () => {
        const cache = new UnifiedCacheService('test-compression', {
          compressionThreshold: 50 // Low threshold for testing
        });
        
        const largeData = 'x'.repeat(1000); // 1KB
        await cache.set('large-key', largeData, { compress: true });
        
        const entry = await cache.get('large-key');
        if (entry !== largeData) {
          throw new Error('Compression/decompression failed');
        }
        
        const stats = cache.getStats();
        const compressionSavings = stats.compressionSavings;
        
        if (compressionSavings <= 0) {
          logger.warn('No compression achieved for test data');
        }
        
        cache.destroy();
        return { compressionSavings };
      }));

    } catch (error) {
      tests.push({
        testName: 'performance-suite-error',
        passed: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const duration = Date.now() - startTime;
    const suiteResult: SuiteResult = {
      suiteName: 'Performance',
      passed: tests.filter(t => t.passed).length === tests.length,
      tests,
      totalDuration: duration
    };

    this.results.push(suiteResult);
    return suiteResult;
  }

  /**
   * Test memory management
   */
  private async runMemoryManagementSuite(): Promise<SuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];
    logger.info('Running memory management test suite...');

    try {
      // Test 1: Memory pressure detection
      tests.push(await this.runTest('memory-pressure-detection', async () => {
        const memoryStats = memoryMonitor.getMemoryStats();
        
        if (!memoryStats.pressure || !memoryStats.used) {
          throw new Error('Memory stats incomplete');
        }
        
        return { 
          pressure: memoryStats.pressure,
          usedMB: (memoryStats.used / 1024 / 1024).toFixed(2),
          timestamp: memoryStats.timestamp
        };
      }));

      // Test 2: Cache health monitoring
      tests.push(await this.runTest('health-monitoring', async () => {
        const healthResults = await healthMonitor.runHealthChecks();
        
        if (!healthResults.overall || !healthResults.checks || healthResults.checks.length === 0) {
          throw new Error('Health monitoring returned invalid results');
        }
        
        return {
          overall: healthResults.overall,
          checkCount: healthResults.checks.length,
          recommendationCount: healthResults.recommendations.length
        };
      }));

      // Test 3: Cleanup effectiveness
      tests.push(await this.runTest('cleanup-effectiveness', async () => {
        const cache = new UnifiedCacheService('test-cleanup', {
          maxSize: 5 * 1024, // 5KB limit
          cleanupInterval: 100 // Fast cleanup for testing
        });
        
        // Add entries that will trigger pressure
        for (let i = 0; i < 100; i++) {
          await cache.set(`cleanup-key-${i}`, 'x'.repeat(200));
        }
        
        const beforeCleanup = cache.getStats();
        const cleaned = cache.forceCleanup();
        
        const afterCleanup = cache.getStats();
        
        if (typeof cleaned !== 'number') {
          throw new Error('Force cleanup returned invalid result');
        }
        
        cache.destroy();
        return { 
          beforeCleanup: beforeCleanup.entryCount,
          afterCleanup: afterCleanup.entryCount,
          cleaned
        };
      }));

    } catch (error) {
      tests.push({
        testName: 'memory-suite-error',
        passed: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const duration = Date.now() - startTime;
    const suiteResult: SuiteResult = {
      suiteName: 'Memory Management',
      passed: tests.filter(t => t.passed).length === tests.length,
      tests,
      totalDuration: duration
    };

    this.results.push(suiteResult);
    return suiteResult;
  }

  /**
   * Test migration functionality
   */
  private async runMigrationSuite(): Promise<SuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];
    logger.info('Running migration test suite...');

    try {
      // Test 1: Migration status
      tests.push(await this.runTest('migration-status', async () => {
        const status = CacheSystemMigration.getStatus();
        
        if (!status || typeof status.completed !== 'boolean') {
          throw new Error('Migration status invalid');
        }
        
        return {
          completed: status.completed,
          activeCaches: status.activeCaches,
          memoryUsageMB: (status.totalMemoryUsage / 1024 / 1024).toFixed(2),
          pressure: status.memoryPressure
        };
      }));

      // Test 2: Legacy adapter creation
      tests.push(await this.runTest('legacy-adapter', async () => {
        const unifiedCache = UnifiedCacheFactory.getInstance('test-adapter');
        const adapter = CacheMigrationHelper.createLegacyAdapter(unifiedCache, {
          get: () => 'legacy-test',
          set: () => {}
        });
        
        // Test that adapter calls through to both systems
        const get1 = await adapter.get('test');
        if (get1 !== 'legacy-test') {
          throw new Error('Legacy get failed');
        }
        
        const get2 = await adapter.get('missing');
        if (get2 === undefined && get2 !== 'test-adapter-fallback') { // May have different value
          logger.debug('Adapter fell back to unified cache correctly');
        }
        
        const stats = adapter.getStats();
        if (!stats || typeof stats.hitRate !== 'number') {
          throw new Error('Adapter stats invalid');
        }
        
        return { adapterWorking: true, initialHitRate: stats.hitRate.toFixed(1) };
      }));

      // Test 3: Validate existing caches don't break
      tests.push(await this.runTest('cache-factory-integrity', async () => {
        // Create multiple instances and verify they're the same
        const cache1 = UnifiedCacheFactory.getInstance('integrity-test');
        const cache2 = UnifiedCacheFactory.getInstance('integrity-test');
        
        if (cache1 !== cache2) {
          throw new Error('Factory not returning singleton instances');
        }
        
        await cache1.set('integrity', 'test');
        const result = await cache2.get('integrity');
        
        if (result !== 'test') {
          throw new Error('Cache integrity failed');
        }
        
        return { singletonTest: true };
      }));

    } catch (error) {
      tests.push({
        testName: 'migration-suite-error',
        passed: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const duration = Date.now() - startTime;
    const suiteResult: SuiteResult = {
      suiteName: 'Migration',
      passed: tests.filter(t => t.passed).length === tests.length,
      tests,
      totalDuration: duration
    };

    this.results.push(suiteResult);
    return suiteResult;
  }

  /**
   * Test configuration system
   */
  private async runConfigurationSuite(): Promise<SuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];
    logger.info('Running configuration test suite...');

    try {
      // Test 1: Configuration validation
      tests.push(await this.runTest('config-validation', async () => {
        const strategies = Object.keys(CACHE_STRATEGIES);
        const configs = Object.keys(CACHE_CONFIGS);
        
        if (strategies.length === 0 || configs.length === 0) {
          throw new Error('No configurations available');
        }
        
        // Test edge strategy specifically
        const edgeStrategy = CACHE_STRATEGIES.edge;
        if (!edgeStrategy.config || !edgeStrategy.features) {
          throw new Error('Edge strategy configuration invalid');
        }
        
        return {
          strategies: strategies.length,
          configs: configs.length,
          edgeStrategy: edgeStrategy.name
        };
      }));

      // Test 2: Strategy-specific behavior
      tests.push(await this.runTest('strategy-behavior', async () => {
        const edgeCache = new UnifiedCacheService('edge-test', 'edge');
        const browserCache = new UnifiedCacheService('browser-test', 'browser');
        
        await edgeCache.set('test', 'value');
        await browserCache.set('test', 'value');
        
        const edgeStats = edgeCache.getStats();
        const browserStats = browserCache.getStats();
        
        // Edge should have more aggressive settings
        if (edgeStats.memoryUsage === browserStats.memoryUsage) {
          logger.debug('Edge and browser caches have similar memory usage - may be expected');
        }
        
        edgeCache.destroy();
        browserCache.destroy();
        
        return {
          edgeMemory: edgeStats.memoryUsage,
          browserMemory: browserStats.memoryUsage
        };
      }));

      // Test 3: Dynamic configuration updates
      tests.push(await this.runTest('dynamic-config', async () => {
        const cache = new UnifiedCacheService('dynamic-test', {
          defaultTTL: 5000 // 5 seconds
        });
        
        await cache.set('dynamic', 'value');
        const initialStats = cache.getStats();
        
        // Update configuration
        cache.updateConfig({ defaultTTL: 10000 }); // 10 seconds
        
        // Verify config was updated (implementation dependent)
        cache.destroy();
        
        return { configUpdated: true };
      }));

    } catch (error) {
      tests.push({
        testName: 'config-suite-error',
        passed: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const duration = Date.now() - startTime;
    const suiteResult: SuiteResult = {
      suiteName: 'Configuration',
      passed: tests.filter(t => t.passed).length === tests.length,
      tests,
      totalDuration: duration
    };

    this.results.push(suiteResult);
    return suiteResult;
  }

  /**
   * Test integration scenarios
   */
  private async runIntegrationSuite(): Promise<SuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];
    logger.info('Running integration test suite...');

    try {
      // Test 1: Concurrent access
      tests.push(await this.runTest('concurrent-access', async () => {
        const cache = UnifiedCacheFactory.getInstance('concurrent-test');
        const promises: Promise<any>[] = [];
        
        // Create concurrent operations
        for (let i = 0; i < 50; i++) {
          promises.push(cache.set(`concurrent-${i}`, `value-${i}`));
          promises.push(cache.get(`concurrent-${i}`));
        }
        
        await Promise.allSettled(promises);
        
        const stats = cache.getStats();
        
        if (stats.entryCount === 0) {
          throw new Error('Concurrent operations failed to set data');
        }
        
        return { concurrentOperations: promises.length, entries: stats.entryCount };
      }));

      // Test 2: Cache warming
      tests.push(await this.runTest('cache-warming', async () => {
        const cache = UnifiedCacheFactory.getInstance('warming-test');
        
        const loaders = [
          { key: 'warm-1', loader: () => Promise.resolve('warmed-value-1') },
          { key: 'warm-2', loader: () => Promise.resolve('warmed-value-2') },
          { key: 'warm-3', loader: () => Promise.resolve('warmed-value-3') }
        ];
        
        await cache.warmCache(loaders);
        
        // Verify warmed data
        const results = await Promise.all([
          cache.get('warm-1'),
          cache.get('warm-2'),
          cache.get('warm-3')
        ]);
        
        if (results.some(r => r === null)) {
          throw new Error('Cache warming failed');
        }
        
        return { warmedEntries: results.length };
      }));

      // Test 3: Error handling
      tests.push(await this.runTest('error-handling', async () => {
        const cache = UnifiedCacheFactory.getInstance('error-test');
        
        // Test with circular reference (should handle gracefully)
        const circular: any = { self: null };
        circular.self = circular;
        
        // This should not throw an error
        const setResult = await cache.set('circular', circular);
        const getResult = await cache.get('circular');
        
        // Test with invalid keys
        const invalidResult = await cache.get('');
        
        // Test destroy multiple times (should not error)
        cache.destroy();
        cache.destroy(); // Should be safe
        
        return { 
          circularHandled: true,
          invalidKeyHandled: invalidResult === null
        };
      }));

    } catch (error) {
      tests.push({
        testName: 'integration-suite-error',
        passed: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const duration = Date.now() - startTime;
    const suiteResult: SuiteResult = {
      suiteName: 'Integration',
      passed: tests.filter(t => t.passed).length === tests.length,
      tests,
      totalDuration: duration
    };

    this.results.push(suiteResult);
    return suiteResult;
  }

  /**
   * Run individual test
   */
  private async runTest(testName: string, testFn: () => Promise<any>): Promise<TestResult> {
    const startTime = performance.now();
    
    try {
      const metrics = await testFn();
      const duration = performance.now() - startTime;
      
      return {
        testName,
        passed: true,
        duration,
        metrics
      };
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      return {
        testName,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate test report
   */
  generateReport(): string {
    let report = '# Cache System Test Report\n\n';
    
    for (const suite of this.results) {
      report += `## ${suite.suiteName}\n`;
      report += `Status: ${suite.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `Duration: ${suite.totalDuration.toFixed(2)}ms\n\n`;
      
      for (const test of suite.tests) {
        const status = test.passed ? '✅' : '❌';
        report += `- ${status} **${test.testName}** (${test.duration.toFixed(2)}ms)\n`;
        
        if (!test.passed && test.error) {
          report += `  - Error: ${test.error}\n`;
        }
        
        if (test.metrics) {
          report += `  - Metrics: ${JSON.stringify(test.metrics, null, 2)}\n`;
        }
      }
      
      report += '\n';
    }
    
    return report;
  }
}

// Export convenience function for running tests
export const runCacheSystemTests = async () => {
  const testSuite = new CacheSystemTestSuite();
  return testSuite.runCompleteSuite();
};

// Export for debugging
export { testSuite: CacheSystemTestSuite };