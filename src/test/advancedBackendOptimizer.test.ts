/**
 * Tests for Advanced Backend Optimizer Service
 */

import { advancedBackendOptimizer } from '../../services/advancedBackendOptimizer';

// Mock Supabase client for testing
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: [{ id: 1, name: 'test' }],
        error: null,
      })),
    })),
  })),
};

describe('AdvancedBackendOptimizer', () => {
  beforeEach(() => {
    advancedBackendOptimizer.resetMetrics();
    jest.clearAllMocks();
  });

  test('should create singleton instance', () => {
    const instance1 = advancedBackendOptimizer;
    const instance2 = advancedBackendOptimizer;
    
    expect(instance1).toBe(instance2);
  });

  test('should execute operation with predictive caching', async () => {
    const mockOperation = jest.fn().mockResolvedValue('test-result');
    
    // First call - should execute operation
    const result1 = await advancedBackendOptimizer.executeWithPredictiveCaching(
      'test-key',
      mockOperation
    );
    
    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(result1).toBe('test-result');
    
    // Second call - should return cached result
    const result2 = await advancedBackendOptimizer.executeWithPredictiveCaching(
      'test-key',
      mockOperation
    );
    
    expect(mockOperation).toHaveBeenCalledTimes(1); // Still 1, should be cached
    expect(result2).toBe('test-result');
  });

  test('should execute operation with intelligent retry', async () => {
    const mockOperation = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success-result');
    
    const result = await advancedBackendOptimizer.executeWithIntelligentRetry(
      mockOperation
    );
    
    expect(mockOperation).toHaveBeenCalledTimes(2);
    expect(result).toBe('success-result');
  });

  test('should execute operation with adaptive throttling', async () => {
    const mockOperation = jest.fn().mockResolvedValue('throttled-result');
    
    const result = await advancedBackendOptimizer.executeWithAdaptiveThrottling(
      mockOperation,
      'test-resource'
    );
    
    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(result).toBe('throttled-result');
  });

  test('should execute comprehensive optimized operation', async () => {
    const mockOperation = jest.fn().mockResolvedValue('optimized-result');
    
    const result = await advancedBackendOptimizer.executeOptimizedOperation(
      mockSupabaseClient as any,
      mockOperation,
      {
        cacheKey: 'test-cache-key',
        table: 'test-table',
        filters: { id: 1 },
        resourceKey: 'test-resource',
      }
    );
    
    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(result).toBe('optimized-result');
  });

  test('should get optimization metrics', () => {
    const metrics = advancedBackendOptimizer.getMetrics();
    
    expect(metrics).toHaveProperty('predictiveCacheHitRate');
    expect(metrics).toHaveProperty('queryPlanImprovement');
    expect(metrics).toHaveProperty('resourceUtilization');
    expect(metrics).toHaveProperty('retrySuccessRate');
    expect(metrics).toHaveProperty('adaptiveThrottlingRate');
    expect(metrics).toHaveProperty('totalOptimizationGain');
  });

  test('should get optimization recommendations', () => {
    const recommendations = advancedBackendOptimizer.getOptimizationRecommendations();
    
    expect(Array.isArray(recommendations)).toBe(true);
    expect(recommendations.length).toBeGreaterThanOrEqual(0);
  });

  test('should update configuration', () => {
    const newConfig = {
      enablePredictiveCaching: false,
      maxRetryAttempts: 5,
    };
    
    advancedBackendOptimizer.updateConfig(newConfig);
    
    const config = advancedBackendOptimizer.getConfig();
    expect(config.enablePredictiveCaching).toBe(false);
    expect(config.maxRetryAttempts).toBe(5);
  });

  test('should warm up common data', async () => {
    // This should not throw an error
    await expect(advancedBackendOptimizer.warmupCommonData(mockSupabaseClient as any)).resolves.not.toThrow();
  });

  test('should optimize connection pooling', async () => {
    // This should not throw an error
    await expect(advancedBackendOptimizer.optimizeConnectionPooling()).resolves.not.toThrow();
  });
});