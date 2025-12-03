/**
 * Comprehensive Backend Optimizer Service
 * Integrates all optimization services for maximum performance
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { backendOptimizer } from './backendOptimizer';
import { databaseOptimizer } from './databaseOptimizer';
import { queryOptimizer } from './queryOptimizer';
import { robotCache } from './advancedCache';
import { edgeOptimizer } from './edgeFunctionOptimizer';
import { vercelEdgeOptimizer } from './vercelEdgeOptimizer';
import { createResilientClient } from './resilientSupabase';

interface ComprehensiveOptimizationConfig {
  enableAllOptimizations: boolean;
  enableRequestDeduplication: boolean;
  enableQueryAnalysis: boolean;
  enableConnectionHealthCheck: boolean;
  enableBatchOptimizations: boolean;
  enableEdgeOptimizations: boolean;
  enableDatabaseOptimizations: boolean;
  enableCacheOptimizations: boolean;
  enableRealtimeOptimizations: boolean;
  deduplicationTTL: number;
  healthCheckInterval: number;
  maxConcurrentRequests: number;
  cacheWarmupInterval: number;
}

interface OptimizationMetrics {
  deduplicatedRequests: number;
  savedBandwidth: number;
  queryOptimizationRate: number;
  cacheHitRate: number;
  responseTimeImprovement: number;
  errorRateReduction: number;
  databasePerformance: number;
  edgePerformance: number;
}

interface OptimizationResult {
  success: boolean;
  metrics: OptimizationMetrics;
  recommendations: string[];
  executionTime: number;
}

class ComprehensiveBackendOptimizer {
  private static instance: ComprehensiveBackendOptimizer;
  private config: ComprehensiveOptimizationConfig = {
    enableAllOptimizations: true,
    enableRequestDeduplication: true,
    enableQueryAnalysis: true,
    enableConnectionHealthCheck: true,
    enableBatchOptimizations: true,
    enableEdgeOptimizations: true,
    enableDatabaseOptimizations: true,
    enableCacheOptimizations: true,
    enableRealtimeOptimizations: true,
    deduplicationTTL: 5000,
    healthCheckInterval: 30000,
    maxConcurrentRequests: 10,
    cacheWarmupInterval: 300000, // 5 minutes
  };

  private isInitialized = false;

  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): ComprehensiveBackendOptimizer {
    if (!ComprehensiveBackendOptimizer.instance) {
      ComprehensiveBackendOptimizer.instance = new ComprehensiveBackendOptimizer();
    }
    return ComprehensiveBackendOptimizer.instance;
  }

  /**
   * Initialize all optimization services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('Initializing comprehensive backend optimization services...');

    // Update backend optimizer config
    backendOptimizer.updateConfig({
      enableRequestDeduplication: this.config.enableRequestDeduplication,
      enableQueryAnalysis: this.config.enableQueryAnalysis,
      enableConnectionHealthCheck: this.config.enableConnectionHealthCheck,
      enableBatchOptimizations: this.config.enableBatchOptimizations,
      deduplicationTTL: this.config.deduplicationTTL,
      healthCheckInterval: this.config.healthCheckInterval,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
    });

    // Start cache warmup process
    if (this.config.enableCacheOptimizations) {
      this.startCacheWarmup();
    }

    // Initialize edge optimizations
    if (this.config.enableEdgeOptimizations) {
      vercelEdgeOptimizer.updateConfig({
        enableEdgeCaching: true,
        enableCompression: true,
        cacheTTL: this.config.cacheWarmupInterval,
      });
    }

    this.isInitialized = true;
    console.log('Comprehensive backend optimization services initialized successfully');
  }

  /**
   * Execute comprehensive optimization for a database query
   */
  async executeOptimizedQuery<T>(
    client: SupabaseClient,
    table: string,
    operation: string,
    params?: any
  ): Promise<{ data: T | null; error: any; metrics: any }> {
    const startTime = performance.now();

    // Apply request deduplication if enabled
    const requestKey = `${table}:${operation}:${JSON.stringify(params)}`;
    
    const result = await backendOptimizer.executeWithDeduplication(
      requestKey,
      async () => {
        // Apply query analysis and optimization
        const optimizedResult = await backendOptimizer.analyzeAndOptimizeQuery<T[]>(
          client,
          table,
          params || {}
        );

        return optimizedResult;
      }
    );

    const executionTime = performance.now() - startTime;

    // Update metrics
    const metrics = {
      ...result.metrics,
      executionTime,
    };

    // Handle the case where the result.data might be an array but we expect a single item
    let returnData: T | null = null;
    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      returnData = result.data[0] as unknown as T;
    } else if (result.data && !Array.isArray(result.data)) {
      returnData = result.data as T;
    }

    return {
      data: returnData,
      error: result.error,
      metrics,
    };
  }

  /**
   * Execute batch operations with comprehensive optimization
   */
  async executeBatchOptimized<T>(
    client: SupabaseClient,
    operations: Array<() => Promise<T>>,
    batchSize: number = 5
  ): Promise<T[]> {
    return backendOptimizer.executeBatchOperation(client, operations, batchSize);
  }

  /**
   * Run comprehensive database optimization
   */
  async runDatabaseOptimization(client: SupabaseClient): Promise<OptimizationResult> {
    const startTime = performance.now();

    try {
      // Run database maintenance
      const maintenanceResult = await databaseOptimizer.runDatabaseMaintenance(client);

      // Get query optimization recommendations
      const queryOptimization = await databaseOptimizer.getQueryOptimizationRecommendations(client);

      // Get current metrics
      const dbMetrics = databaseOptimizer.getOptimizationMetrics();

      // Get backend metrics
      const backendMetrics = backendOptimizer.getMetrics();

      const executionTime = performance.now() - startTime;

      const result: OptimizationResult = {
        success: true,
        metrics: {
          deduplicatedRequests: backendMetrics.deduplicatedRequests,
          savedBandwidth: backendMetrics.savedBandwidth,
          queryOptimizationRate: backendMetrics.queryOptimizationRate,
          cacheHitRate: dbMetrics.cacheHitRate,
          responseTimeImprovement: dbMetrics.queryResponseTime,
          errorRateReduction: 0, // Placeholder - would need actual error rate comparison
          databasePerformance: dbMetrics.queryResponseTime,
          edgePerformance: 0, // Placeholder - would need edge metrics
        },
        recommendations: [
          ...backendOptimizer.getOptimizationRecommendations(),
          ...databaseOptimizer.getOptimizationRecommendations(),
        ],
        executionTime,
      };

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;

      return {
        success: false,
        metrics: {
          deduplicatedRequests: 0,
          savedBandwidth: 0,
          queryOptimizationRate: 0,
          cacheHitRate: 0,
          responseTimeImprovement: 0,
          errorRateReduction: 0,
          databasePerformance: 0,
          edgePerformance: 0,
        },
        recommendations: [`Database optimization failed: ${error}`],
        executionTime,
      };
    }
  }

  /**
   * Run comprehensive edge optimization
   */
  async runEdgeOptimization(): Promise<OptimizationResult> {
    const startTime = performance.now();

    try {
      // Warm up all edge functions
      await edgeOptimizer.warmupAllFunctions();

      // Get edge metrics
      const edgeMetrics = edgeOptimizer.getMetrics();

      // Get optimization recommendations
      const recommendations = edgeOptimizer.getOptimizationRecommendations();

      const executionTime = performance.now() - startTime;

      return {
        success: true,
        metrics: {
          deduplicatedRequests: 0, // Placeholder
          savedBandwidth: 0, // Placeholder
          queryOptimizationRate: 0, // Placeholder
          cacheHitRate: 0, // Placeholder
          responseTimeImprovement: 0, // Placeholder
          errorRateReduction: 0, // Placeholder
          databasePerformance: 0, // Placeholder
          edgePerformance: Object.values(edgeMetrics).reduce((sum, metric) => sum + metric.averageResponseTime, 0) / Object.keys(edgeMetrics).length || 0,
        },
        recommendations,
        executionTime,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;

      return {
        success: false,
        metrics: {
          deduplicatedRequests: 0,
          savedBandwidth: 0,
          queryOptimizationRate: 0,
          cacheHitRate: 0,
          responseTimeImprovement: 0,
          errorRateReduction: 0,
          databasePerformance: 0,
          edgePerformance: 0,
        },
        recommendations: [`Edge optimization failed: ${error}`],
        executionTime,
      };
    }
  }

  /**
   * Run full system optimization
   */
  async runFullOptimization(client: SupabaseClient): Promise<OptimizationResult> {
    const startTime = performance.now();

    try {
      // Run all optimizations in parallel
      const [dbResult, edgeResult] = await Promise.all([
        this.runDatabaseOptimization(client),
        this.runEdgeOptimization()
      ]);

      const executionTime = performance.now() - startTime;

      // Combine results
      const combinedResult: OptimizationResult = {
        success: dbResult.success && edgeResult.success,
        metrics: {
          deduplicatedRequests: dbResult.metrics.deduplicatedRequests,
          savedBandwidth: dbResult.metrics.savedBandwidth,
          queryOptimizationRate: dbResult.metrics.queryOptimizationRate,
          cacheHitRate: dbResult.metrics.cacheHitRate,
          responseTimeImprovement: (dbResult.metrics.responseTimeImprovement + edgeResult.metrics.responseTimeImprovement) / 2,
          errorRateReduction: (dbResult.metrics.errorRateReduction + edgeResult.metrics.errorRateReduction) / 2,
          databasePerformance: dbResult.metrics.databasePerformance,
          edgePerformance: edgeResult.metrics.edgePerformance,
        },
        recommendations: [
          ...dbResult.recommendations,
          ...edgeResult.recommendations,
        ],
        executionTime,
      };

      return combinedResult;
    } catch (error) {
      const executionTime = performance.now() - startTime;

      return {
        success: false,
        metrics: {
          deduplicatedRequests: 0,
          savedBandwidth: 0,
          queryOptimizationRate: 0,
          cacheHitRate: 0,
          responseTimeImprovement: 0,
          errorRateReduction: 0,
          databasePerformance: 0,
          edgePerformance: 0,
        },
        recommendations: [`Full optimization failed: ${error}`],
        executionTime,
      };
    }
  }

  /**
   * Preload common data with comprehensive optimization
   */
  async preloadCommonData(client: SupabaseClient): Promise<void> {
    // Use backend optimizer for preloading
    await backendOptimizer.preloadCommonData(client);

    // Use database optimizer for additional preloading
    await databaseOptimizer.searchRobotsOptimized(
      client,
      '', // Empty search for latest robots
      { limit: 10 } // Preload top robots
    );
  }

  /**
   * Start cache warmup process
   */
  private startCacheWarmup(): void {
    // Schedule cache warmup
    setInterval(async () => {
      try {
        // Warm up common queries
        const warmUpQueries = [
          { table: 'robots', conditions: { limit: 10 } },
          { table: 'strategies', conditions: { limit: 10 } },
        ];
        
        // For now, skip resilient client usage in warmup
        // We can't use resilientSupabase without a specific instance
        // This would need to be passed from the calling code
        console.warn('Skipping cache warmup - resilient client not available');
      } catch (error) {
        console.warn('Cache warmup failed:', error);
      }
    }, this.config.cacheWarmupInterval);
  }

  /**
   * Get comprehensive optimization metrics
   */
  getComprehensiveMetrics(): OptimizationMetrics {
    const backendMetrics = backendOptimizer.getMetrics();
    const dbMetrics = databaseOptimizer.getOptimizationMetrics();
    
    return {
      deduplicatedRequests: backendMetrics.deduplicatedRequests,
      savedBandwidth: backendMetrics.savedBandwidth,
      queryOptimizationRate: backendMetrics.queryOptimizationRate,
      cacheHitRate: dbMetrics.cacheHitRate,
      responseTimeImprovement: dbMetrics.queryResponseTime,
      errorRateReduction: 0, // Placeholder
      databasePerformance: dbMetrics.queryResponseTime,
      edgePerformance: 0, // Placeholder
    };
  }

  /**
   * Update optimization configuration
   */
  updateConfig(newConfig: Partial<ComprehensiveOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update sub-optimizers
    backendOptimizer.updateConfig({
      enableRequestDeduplication: this.config.enableRequestDeduplication,
      enableQueryAnalysis: this.config.enableQueryAnalysis,
      enableConnectionHealthCheck: this.config.enableConnectionHealthCheck,
      enableBatchOptimizations: this.config.enableBatchOptimizations,
      deduplicationTTL: this.config.deduplicationTTL,
      healthCheckInterval: this.config.healthCheckInterval,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): ComprehensiveOptimizationConfig {
    return { ...this.config };
  }
}

export const comprehensiveBackendOptimizer = ComprehensiveBackendOptimizer.getInstance();

// Initialize optimizer when module is loaded
if (typeof window !== 'undefined') {
  // In browser environment, initialize after a short delay
  setTimeout(() => {
    comprehensiveBackendOptimizer.initialize().catch(console.error);
  }, 1000);
}

export type { ComprehensiveOptimizationConfig, OptimizationMetrics, OptimizationResult };