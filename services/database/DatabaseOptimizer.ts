/**
 * Database Optimization Service
 * 
 * Provides comprehensive database optimization utilities following best practices:
 * - Query optimization and analysis
 * - Index recommendations
 * - Performance monitoring
 * - Cache management
 * - Connection pool optimization
 * 
 * @module services/database/DatabaseOptimizer
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import type { 
  QueryMetrics, 
  DatabasePerformanceSummary,
  RobotFilterDTO,
  PaginationParams
} from '../../types/database';
import { COUNT_CONSTANTS, TIME_CONSTANTS } from '../modularConstants';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('DatabaseOptimizer');

// ============================================================================
// TYPES
// ============================================================================

interface OptimizationRecommendation {
  type: 'index' | 'query' | 'cache' | 'connection' | 'vacuum';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  suggestion: string;
  estimatedImprovement?: string;
}

interface IndexAnalysis {
  indexName: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  indexType: string;
  sizeBytes?: number;
  usageCount?: number;
  recommendation?: string;
}

interface _QueryPlanAnalysis {
  query: string;
  plan: string;
  estimatedCost: number;
  estimatedRows: number;
  executionTime: number;
  recommendations: string[];
}

// ============================================================================
// QUERY OPTIMIZER CLASS
// ============================================================================

/**
 * Query optimization utilities
 */
export class QueryOptimizer {
  private queryMetrics: Map<string, QueryMetrics> = new Map();
  private slowQueryThreshold = 100; // ms
  private maxMetricsHistory = COUNT_CONSTANTS.HISTORY.LARGE;

  /**
   * Record query execution metrics
   */
  recordQuery(queryName: string, durationMs: number): void {
    const existing = this.queryMetrics.get(queryName);
    
    if (existing) {
      existing.execution_count++;
      existing.max_duration_ms = Math.max(existing.max_duration_ms, durationMs);
      existing.min_duration_ms = Math.min(existing.min_duration_ms, durationMs);
      
      // Calculate rolling average
      const totalDuration = existing.avg_duration_ms * (existing.execution_count - 1) + durationMs;
      existing.avg_duration_ms = totalDuration / existing.execution_count;
      
      // Update percentiles (simplified approximation)
      existing.p95_duration_ms = existing.avg_duration_ms * 1.5;
      existing.p99_duration_ms = existing.avg_duration_ms * 2;
      
      existing.last_executed = new Date().toISOString();
    } else {
      this.queryMetrics.set(queryName, {
        query_name: queryName,
        execution_count: 1,
        avg_duration_ms: durationMs,
        max_duration_ms: durationMs,
        min_duration_ms: durationMs,
        p95_duration_ms: durationMs,
        p99_duration_ms: durationMs,
        last_executed: new Date().toISOString()
      });
    }

    // Log slow queries
    if (durationMs > this.slowQueryThreshold) {
      logger.warn(`Slow query detected: ${queryName} took ${durationMs.toFixed(2)}ms`);
    }

    // Cleanup old metrics if exceeding limit
    this.cleanupMetrics();
  }

  /**
   * Get metrics for a specific query
   */
  getQueryMetrics(queryName: string): QueryMetrics | undefined {
    return this.queryMetrics.get(queryName);
  }

  /**
   * Get all query metrics
   */
  getAllMetrics(): QueryMetrics[] {
    return Array.from(this.queryMetrics.values());
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): DatabasePerformanceSummary {
    const metrics = this.getAllMetrics();
    
    const totalQueries = metrics.reduce((sum, m) => sum + m.execution_count, 0);
    const slowQueries = metrics.filter(m => m.avg_duration_ms > this.slowQueryThreshold).length;
    const avgLatency = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.avg_duration_ms, 0) / metrics.length
      : 0;

    const metricsByOperation: Record<string, QueryMetrics> = {};
    for (const metric of metrics) {
      metricsByOperation[metric.query_name] = metric;
    }

    return {
      total_queries: totalQueries,
      slow_queries: slowQueries,
      avg_latency_ms: avgLatency,
      cache_hit_rate: 0, // Would need cache integration
      connection_errors: 0, // Would need connection monitoring
      metrics_by_operation: metricsByOperation
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.queryMetrics.clear();
  }

  /**
   * Cleanup old metrics to prevent memory bloat
   */
  private cleanupMetrics(): void {
    if (this.queryMetrics.size > this.maxMetricsHistory) {
      // Remove oldest entries
      const entries = Array.from(this.queryMetrics.entries())
        .sort((a, b) => a[1].last_executed.localeCompare(b[1].last_executed));
      
      const toRemove = entries.slice(0, entries.length - this.maxMetricsHistory);
      for (const [key] of toRemove) {
        this.queryMetrics.delete(key);
      }
    }
  }
}

// ============================================================================
// INDEX ANALYZER CLASS
// ============================================================================

/**
 * Index analysis and recommendation utilities
 */
export class IndexAnalyzer {
  
  /**
   * Get recommended indexes for the robots table
   */
  getRecommendedIndexes(): IndexAnalysis[] {
    return [
      {
        indexName: 'idx_robots_user_id',
        tableName: 'robots',
        columns: ['user_id'],
        isUnique: false,
        indexType: 'btree',
        recommendation: 'Essential for user-scoped queries'
      },
      {
        indexName: 'idx_robots_active',
        tableName: 'robots',
        columns: ['is_active', 'deleted_at'],
        isUnique: false,
        indexType: 'partial',
        recommendation: 'Optimizes soft-delete filtering'
      },
      {
        indexName: 'idx_robots_strategy_type',
        tableName: 'robots',
        columns: ['strategy_type'],
        isUnique: false,
        indexType: 'btree',
        recommendation: 'Speeds up strategy filtering'
      },
      {
        indexName: 'idx_robots_user_active_created',
        tableName: 'robots',
        columns: ['user_id', 'created_at'],
        isUnique: false,
        indexType: 'composite',
        recommendation: 'Optimizes common pagination pattern'
      },
      {
        indexName: 'idx_robots_name_trgm',
        tableName: 'robots',
        columns: ['name'],
        isUnique: false,
        indexType: 'gin_trgm',
        recommendation: 'Enables fast fuzzy name search'
      },
      {
        indexName: 'idx_robots_strategy_params_gin',
        tableName: 'robots',
        columns: ['strategy_params'],
        isUnique: false,
        indexType: 'gin',
        recommendation: 'Enables JSONB key/value queries'
      }
    ];
  }

  /**
   * Analyze query pattern and suggest index
   */
  suggestIndex(query: string): IndexAnalysis | null {
    const queryLower = query.toLowerCase();
    
    // User-scoped queries
    if (queryLower.includes('user_id') && queryLower.includes('order by created_at')) {
      return {
        indexName: 'idx_robots_user_active_created',
        tableName: 'robots',
        columns: ['user_id', 'created_at DESC'],
        isUnique: false,
        indexType: 'composite',
        recommendation: 'Use composite index for user + date ordering'
      };
    }

    // Name search queries
    if (queryLower.includes('name') && (queryLower.includes('ilike') || queryLower.includes('like'))) {
      return {
        indexName: 'idx_robots_name_trgm',
        tableName: 'robots',
        columns: ['name'],
        isUnique: false,
        indexType: 'gin_trgm',
        recommendation: 'Use trigram index for pattern matching'
      };
    }

    // JSONB queries
    if (queryLower.includes('strategy_params') || queryLower.includes('->') || queryLower.includes('@>')) {
      return {
        indexName: 'idx_robots_strategy_params_gin',
        tableName: 'robots',
        columns: ['strategy_params'],
        isUnique: false,
        indexType: 'gin',
        recommendation: 'Use GIN index for JSONB containment queries'
      };
    }

    return null;
  }
}

// ============================================================================
// DATABASE OPTIMIZER SERVICE CLASS
// ============================================================================

/**
 * Main database optimization service
 */
export class DatabaseOptimizerService {
  private queryOptimizer: QueryOptimizer;
  private indexAnalyzer: IndexAnalyzer;
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private lastHealthCheck?: Date;

  constructor() {
    this.queryOptimizer = new QueryOptimizer();
    this.indexAnalyzer = new IndexAnalyzer();
  }

  /**
   * Initialize the optimizer service
   */
  async initialize(): Promise<void> {
    logger.log('Database optimizer service initialized');
    
    // Start periodic health checks
    this.startHealthMonitoring();
  }

  /**
   * Shutdown the optimizer service
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    logger.log('Database optimizer service shutdown complete');
  }

  /**
   * Record query execution
   */
  recordQuery(queryName: string, durationMs: number): void {
    this.queryOptimizer.recordQuery(queryName, durationMs);
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const summary = this.queryOptimizer.getPerformanceSummary();

    // Check for slow queries
    if (summary.slow_queries > 0) {
      recommendations.push({
        type: 'query',
        severity: 'medium',
        message: `${summary.slow_queries} slow queries detected`,
        suggestion: 'Review query execution plans and add appropriate indexes',
        estimatedImprovement: '20-50% query speedup'
      });
    }

    // Check average latency
    if (summary.avg_latency_ms > 50) {
      recommendations.push({
        type: 'index',
        severity: 'high',
        message: `High average query latency: ${summary.avg_latency_ms.toFixed(2)}ms`,
        suggestion: 'Consider adding composite indexes for common query patterns',
        estimatedImprovement: '30-60% latency reduction'
      });
    }

    // Check cache hit rate (if available)
    if (summary.cache_hit_rate < 0.8 && summary.cache_hit_rate > 0) {
      recommendations.push({
        type: 'cache',
        severity: 'medium',
        message: `Low cache hit rate: ${(summary.cache_hit_rate * 100).toFixed(1)}%`,
        suggestion: 'Increase cache TTL or pre-warm frequently accessed data',
        estimatedImprovement: '40-70% repeated query speedup'
      });
    }

    return recommendations;
  }

  /**
   * Get index recommendations
   */
  getIndexRecommendations(): IndexAnalysis[] {
    return this.indexAnalyzer.getRecommendedIndexes();
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): DatabasePerformanceSummary {
    return this.queryOptimizer.getPerformanceSummary();
  }

  /**
   * Optimize a filter query for best performance
   */
  optimizeFilter(filter: RobotFilterDTO, pagination: PaginationParams): {
    optimizedFilter: RobotFilterDTO;
    optimizedPagination: PaginationParams;
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    const optimizedFilter = { ...filter };
    const optimizedPagination = { ...pagination };

    // Ensure pagination limits
    if (optimizedPagination.limit > COUNT_CONSTANTS.PAGINATION.MAX) {
      suggestions.push(`Limiting page size from ${optimizedPagination.limit} to ${COUNT_CONSTANTS.PAGINATION.MAX}`);
      optimizedPagination.limit = COUNT_CONSTANTS.PAGINATION.MAX;
    }

    if (optimizedPagination.limit < 1) {
      optimizedPagination.limit = COUNT_CONSTANTS.PAGINATION.DEFAULT;
    }

    if (optimizedPagination.page < 1) {
      optimizedPagination.page = 1;
    }

    // Optimize search term
    if (optimizedFilter.search_term) {
      // Trim and normalize search term
      optimizedFilter.search_term = optimizedFilter.search_term.trim().toLowerCase();
      
      if (optimizedFilter.search_term.length < 2) {
        suggestions.push('Search term too short - minimum 2 characters recommended');
      }
    }

    // Default sort for pagination
    if (!optimizedPagination.sort_by) {
      optimizedPagination.sort_by = 'created_at';
      suggestions.push('Using default sort by created_at for optimal index usage');
    }

    if (!optimizedPagination.sort_order) {
      optimizedPagination.sort_order = 'desc';
    }

    return { optimizedFilter, optimizedPagination, suggestions };
  }

  /**
   * Generate optimized query for pagination
   */
  generatePaginationQuery(
    tableName: string,
    filter: RobotFilterDTO,
    pagination: PaginationParams
  ): string {
    const conditions: string[] = ['deleted_at IS NULL', 'is_active = true'];

    if (filter.user_id) {
      conditions.push(`user_id = '${filter.user_id}'`);
    }

    if (filter.strategy_type && filter.strategy_type !== 'All') {
      conditions.push(`strategy_type = '${filter.strategy_type}'`);
    }

    if (filter.search_term) {
      conditions.push(`(name ILIKE '%${filter.search_term}%' OR description ILIKE '%${filter.search_term}%')`);
    }

    const whereClause = conditions.join(' AND ');
    const orderBy = pagination.sort_by || 'created_at';
    const orderDirection = pagination.sort_order?.toUpperCase() || 'DESC';
    const offset = (pagination.page - 1) * pagination.limit;

    return `
      SELECT * FROM ${tableName}
      WHERE ${whereClause}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ${pagination.limit}
      OFFSET ${offset}
    `.trim();
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, TIME_CONSTANTS.MINUTE * 5); // Every 5 minutes
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    this.lastHealthCheck = new Date();
    
    const summary = this.getPerformanceSummary();
    
    if (summary.slow_queries > 5) {
      logger.warn(`Health check: ${summary.slow_queries} slow queries detected`);
    }
    
    if (summary.avg_latency_ms > 100) {
      logger.warn(`Health check: High average latency ${summary.avg_latency_ms.toFixed(2)}ms`);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const databaseOptimizer = new DatabaseOptimizerService();

// Register with service cleanup coordinator for proper lifecycle management
serviceCleanupCoordinator.register('databaseOptimizer', {
  cleanup: () => databaseOptimizer.shutdown(),
  priority: 'medium',
  description: 'Database optimization service'
});
