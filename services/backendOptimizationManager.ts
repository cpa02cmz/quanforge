/**
 * Backward Compatibility Shim for Backend Optimization Manager
 * Maintains the original API while using the new modular implementation
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { backendOptimizationManager as modularManager } from './optimization/modularBackendOptimizationManager';
import { OptimizationConfig, OptimizationMetrics } from './optimization/optimizationTypes';

// Export the types for backward compatibility
export type { OptimizationConfig, OptimizationMetrics };

/**
 * Legacy Backend Optimization Manager Interface
 * Maintains compatibility with existing code
 */
class LegacyBackendOptimizationManager {
  private initialized = false;

  constructor(_config?: Partial<OptimizationConfig>) {
    // Note: Config is applied during initialization
  }

  /**
   * Initialize the optimization manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await modularManager.initialize();
    this.initialized = true;
  }

  /**
   * Collect comprehensive metrics from all optimization systems
   */
  async collectMetrics(): Promise<OptimizationMetrics> {
    return await modularManager.collectMetrics();
  }

  /**
   * Generate optimization recommendations based on current metrics
   */
  async generateRecommendations(): Promise<string[]> {
    return await modularManager.generateRecommendations();
  }

  /**
   * Apply optimizations based on recommendations
   */
  async applyOptimizations(recommendations: string[]): Promise<void> {
    await modularManager.applyOptimizations(recommendations);
  }

  /**
   * Get current optimization status
   */
  async getOptimizationStatus(): Promise<{
    metrics: OptimizationMetrics;
    recommendations: string[];
    lastOptimization: number;
    optimizationEnabled: boolean;
  }> {
    return await modularManager.getOptimizationStatus();
  }

  /**
   * Optimize database queries for a specific table
   */
  async optimizeTableQueries(client: SupabaseClient, tableName: string): Promise<void> {
    await modularManager.optimizeTableQueries(client, tableName);
  }

  /**
   * Run database maintenance tasks
   */
  async runDatabaseMaintenance(client: SupabaseClient): Promise<void> {
    await modularManager.runDatabaseMaintenance(client);
  }

  /**
   * Get query optimization recommendations
   */
  async getQueryOptimizationRecommendations(client: SupabaseClient): Promise<any> {
    return await modularManager.getQueryOptimizationRecommendations(client);
  }

  /**
   * Force immediate optimization cycle
   */
  async forceOptimization(): Promise<void> {
    await modularManager.forceOptimization();
  }

  /**
   * Get advanced optimization insights
   */
  async getAdvancedOptimizationInsights(client: SupabaseClient): Promise<any> {
    return await modularManager.getAdvancedOptimizationInsights(client);
  }

  /**
   * Run comprehensive optimization
   */
  async runComprehensiveOptimization(client: SupabaseClient): Promise<{
    optimizationsApplied: number;
    performanceGain: number;
    recommendations: string[];
  }> {
    return await modularManager.runComprehensiveOptimization(client);
  }

  /**
   * Get cross-system optimization recommendations
   */
  async getCrossSystemOptimizationRecommendations(client: SupabaseClient): Promise<{
    priority: string;
    recommendations: string[];
    potentialImpact: string;
  }> {
    return await modularManager.getCrossSystemOptimizationRecommendations(client);
  }

  /**
   * Perform predictive optimization
   */
  async performPredictiveOptimization(client: SupabaseClient): Promise<{
    predictions: string[];
    automatedOptimizations: string[];
  }> {
    return await modularManager.performPredictiveOptimization(client);
  }

  /**
   * Optimize system with priority and constraints
   */
  async optimizeSystem(client: SupabaseClient, options?: {
    priority?: 'performance' | 'reliability' | 'efficiency';
    maxTime?: number;
    targetGain?: number;
  }): Promise<{
    optimizationsApplied: string[];
    performanceGain: number;
    executionTime: number;
  }> {
    return await modularManager.optimizeSystem(client, options);
  }

  /**
   * Shutdown the optimization manager
   */
  shutdown(): void {
    modularManager.shutdown();
    this.initialized = false;
  }

  /**
   * Enhanced query execution with optimization
   */
  async executeOptimizedQuery<T>(
    client: SupabaseClient,
    queryType: string,
    queryFn: () => Promise<T>,
    options?: {
      useCache?: boolean;
      useDeduplication?: boolean;
      useQueryOptimization?: boolean;
      cacheKey?: string;
    }
  ): Promise<{ data: T | null; error: string | null }> {
    try {
      const startTime = Date.now();
      
      // Apply optimizations based on options
      const _useCache = options?.useCache ?? true;
      const useDeduplication = options?.useDeduplication ?? true;
      const _useQueryOptimization = options?.useQueryOptimization ?? true;
      const _cacheKey = options?.cacheKey;

      // Execute the query
      let result: T;
      
      if (useDeduplication) {
        // Use backend optimizer for deduplication
        result = await this.executeWithDeduplication(queryFn, _cacheKey);
      } else {
        result = await queryFn();
      }

      const _executionTime = Date.now() - startTime;

      return {
        data: result,
        error: null
      };
    } catch (error: unknown) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Execute with deduplication
   */
  private async executeWithDeduplication<T>(
    queryFn: () => Promise<T>,
    _cacheKey?: string
  ): Promise<T> {
    // For now, just execute the query directly
    // TODO: Integrate with backend optimizer's deduplication
    return await queryFn();
  }

  /**
   * Get optimization configuration
   */
  getConfig(): OptimizationConfig {
    return modularManager.getConfig();
  }

  /**
   * Update optimization configuration
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    modularManager.updateConfig(newConfig);
  }
}

// Create and export singleton instance for backward compatibility
const legacyInstance = new LegacyBackendOptimizationManager();

// Export the singleton instance with the original name
export const backendOptimizationManager = legacyInstance;

// Export the class for testing purposes
export { LegacyBackendOptimizationManager as BackendOptimizationManager };