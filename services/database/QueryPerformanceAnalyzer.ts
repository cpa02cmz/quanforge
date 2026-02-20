/**
 * Query Performance Analyzer
 * 
 * Analyzes query performance patterns and provides optimization recommendations
 * 
 * @module services/database/QueryPerformanceAnalyzer
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { QueryMetrics } from '../../types/database';
import { COUNT_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('QueryPerformanceAnalyzer');

// ============================================================================
// TYPES
// ============================================================================

interface QueryPattern {
  pattern: string;
  frequency: number;
  avgDuration: number;
  optimizations: string[];
}

interface PerformanceReport {
  timestamp: Date;
  totalQueries: number;
  slowQueries: QueryMetrics[];
  patterns: QueryPattern[];
  recommendations: OptimizationRecommendation[];
  summary: {
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number;
  };
}

interface OptimizationRecommendation {
  category: 'index' | 'query_rewrite' | 'caching' | 'connection' | 'batching';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  estimatedImpact: string;
  sqlSuggestion?: string;
}

interface QueryExecution {
  queryName: string;
  sql: string;
  params?: unknown[];
  startTime: number;
  endTime?: number;
  duration?: number;
  rowCount?: number;
  error?: Error;
  cached: boolean;
}

// ============================================================================
// QUERY PERFORMANCE ANALYZER CLASS
// ============================================================================

/**
 * Analyzes query performance and provides recommendations
 */
export class QueryPerformanceAnalyzer {
  private executions: QueryExecution[] = [];
  private patterns: Map<string, QueryPattern> = new Map();
  private slowQueryThreshold = 100; // ms
  private maxExecutions = COUNT_CONSTANTS.HISTORY.LARGE;

  /**
   * Start tracking a query execution
   */
  startQuery(queryName: string, sql: string, params?: unknown[]): () => QueryExecution {
    const execution: QueryExecution = {
      queryName,
      sql,
      params,
      startTime: performance.now(),
      cached: false
    };

    this.executions.push(execution);

    // Cleanup old executions
    if (this.executions.length > this.maxExecutions) {
      this.executions = this.executions.slice(-this.maxExecutions);
    }

    return () => this.endQuery(execution);
  }

  /**
   * End tracking a query execution
   */
  private endQuery(execution: QueryExecution): QueryExecution {
    execution.endTime = performance.now();
    execution.duration = execution.endTime - execution.startTime;

    // Update patterns
    this.updatePattern(execution);

    // Log slow queries
    if (execution.duration > this.slowQueryThreshold) {
      logger.warn(`Slow query: ${execution.queryName} took ${execution.duration.toFixed(2)}ms`);
    }

    return execution;
  }

  /**
   * Mark query as cached
   */
  markCached(queryName: string): void {
    const execution = this.executions.find(e => 
      e.queryName === queryName && !e.endTime
    );
    if (execution) {
      execution.cached = true;
    }
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit: number = 10): QueryMetrics[] {
    const queryDurations = new Map<string, { total: number; count: number; max: number; min: number }>();

    for (const exec of this.executions) {
      if (!exec.duration) continue;

      const existing = queryDurations.get(exec.queryName) || { total: 0, count: 0, max: 0, min: Infinity };
      existing.total += exec.duration;
      existing.count++;
      existing.max = Math.max(existing.max, exec.duration);
      existing.min = Math.min(existing.min, exec.duration);
      queryDurations.set(exec.queryName, existing);
    }

    const metrics: QueryMetrics[] = [];
    for (const [queryName, stats] of queryDurations) {
      if (stats.total / stats.count > this.slowQueryThreshold) {
        metrics.push({
          query_name: queryName,
          execution_count: stats.count,
          avg_duration_ms: stats.total / stats.count,
          max_duration_ms: stats.max,
          min_duration_ms: stats.min,
          p95_duration_ms: stats.total / stats.count * 1.5,
          p99_duration_ms: stats.total / stats.count * 2,
          last_executed: new Date().toISOString()
        });
      }
    }

    return metrics
      .sort((a, b) => b.avg_duration_ms - a.avg_duration_ms)
      .slice(0, limit);
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): PerformanceReport {
    const executions = this.executions.filter(e => e.duration !== undefined);
    
    if (executions.length === 0) {
      return {
        timestamp: new Date(),
        totalQueries: 0,
        slowQueries: [],
        patterns: [],
        recommendations: [],
        summary: {
          avgLatency: 0,
          p95Latency: 0,
          p99Latency: 0,
          throughput: 0
        }
      };
    }

    // Calculate summary statistics
    const durations = executions.map(e => e.duration!);
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const sum = sortedDurations.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p99Index = Math.floor(sortedDurations.length * 0.99);

    const summary = {
      avgLatency: sum / sortedDurations.length,
      p95Latency: sortedDurations[p95Index] || sortedDurations[sortedDurations.length - 1],
      p99Latency: sortedDurations[p99Index] || sortedDurations[sortedDurations.length - 1],
      throughput: this.calculateThroughput(executions)
    };

    // Get slow queries
    const slowQueries = this.getSlowQueries();

    // Get patterns
    const patterns = Array.from(this.patterns.values());

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, slowQueries, patterns);

    return {
      timestamp: new Date(),
      totalQueries: executions.length,
      slowQueries,
      patterns,
      recommendations,
      summary
    };
  }

  /**
   * Analyze SQL query and suggest optimizations
   */
  analyzeQuery(sql: string): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const sqlLower = sql.toLowerCase();

    // Check for SELECT *
    if (sqlLower.includes('select *')) {
      recommendations.push({
        category: 'query_rewrite',
        priority: 'medium',
        title: 'Avoid SELECT *',
        description: 'Select only the columns you need to reduce data transfer',
        estimatedImpact: '10-30% query speedup'
      });
    }

    // Check for missing WHERE clause on large tables
    if (!sqlLower.includes('where') && sqlLower.includes('from robots')) {
      recommendations.push({
        category: 'query_rewrite',
        priority: 'high',
        title: 'Add WHERE clause',
        description: 'Queries without WHERE clause scan entire table',
        estimatedImpact: '50-90% query speedup'
      });
    }

    // Check for LIKE with leading wildcard
    if (sqlLower.includes("like '%")) {
      recommendations.push({
        category: 'index',
        priority: 'high',
        title: 'Leading wildcard prevents index usage',
        description: 'Consider using trigram index or full-text search instead',
        estimatedImpact: '40-80% query speedup',
        sqlSuggestion: 'CREATE INDEX idx_name_trgm ON robots USING GIN (name gin_trgm_ops);'
      });
    }

    // Check for ORDER BY without index
    if (sqlLower.includes('order by')) {
      const orderByMatch = sqlLower.match(/order by\s+(\w+)/);
      if (orderByMatch) {
        recommendations.push({
          category: 'index',
          priority: 'medium',
          title: 'Consider index for ORDER BY',
          description: `Adding an index on "${orderByMatch[1]}" can improve sorting performance`,
          estimatedImpact: '20-50% query speedup',
          sqlSuggestion: `CREATE INDEX idx_robots_${orderByMatch[1]} ON robots (${orderByMatch[1]});`
        });
      }
    }

    // Check for JSONB operations without GIN index
    if (sqlLower.includes('->') || sqlLower.includes('@>') || sqlLower.includes('strategy_params')) {
      recommendations.push({
        category: 'index',
        priority: 'medium',
        title: 'JSONB query optimization',
        description: 'Consider GIN index for JSONB column queries',
        estimatedImpact: '30-60% query speedup',
        sqlSuggestion: 'CREATE INDEX idx_robots_params_gin ON robots USING GIN (strategy_params);'
      });
    }

    return recommendations;
  }

  /**
   * Get query patterns
   */
  getPatterns(): QueryPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Reset analyzer
   */
  reset(): void {
    this.executions = [];
    this.patterns.clear();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private updatePattern(execution: QueryExecution): void {
    const pattern = this.extractPattern(execution.sql);
    const existing = this.patterns.get(pattern) || {
      pattern,
      frequency: 0,
      avgDuration: 0,
      optimizations: []
    };

    existing.frequency++;
    existing.avgDuration = (existing.avgDuration * (existing.frequency - 1) + 
      (execution.duration || 0)) / existing.frequency;

    // Generate optimizations if needed
    if (existing.avgDuration > this.slowQueryThreshold && existing.optimizations.length === 0) {
      existing.optimizations = this.analyzeQuery(execution.sql).map(r => r.title);
    }

    this.patterns.set(pattern, existing);
  }

  private extractPattern(sql: string): string {
    // Normalize SQL for pattern matching
    return sql
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\b\d+\b/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/"[^"]*"/g, '?')
      .trim();
  }

  private calculateThroughput(executions: QueryExecution[]): number {
    if (executions.length < 2) return 0;

    const firstTime = executions[0].startTime;
    const lastTime = executions[executions.length - 1].endTime || executions[executions.length - 1].startTime;
    const durationMs = lastTime - firstTime;

    if (durationMs === 0) return 0;

    return (executions.length / durationMs) * 1000; // queries per second
  }

  private generateRecommendations(
    summary: PerformanceReport['summary'],
    slowQueries: QueryMetrics[],
    patterns: QueryPattern[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // High average latency
    if (summary.avgLatency > 50) {
      recommendations.push({
        category: 'index',
        priority: 'high',
        title: 'High average query latency',
        description: `Average latency is ${summary.avgLatency.toFixed(2)}ms, consider adding indexes for common query patterns`,
        estimatedImpact: '20-50% latency reduction'
      });
    }

    // High P99 latency
    if (summary.p99Latency > 200) {
      recommendations.push({
        category: 'caching',
        priority: 'high',
        title: 'High tail latency detected',
        description: `P99 latency is ${summary.p99Latency.toFixed(2)}ms, consider caching frequent queries`,
        estimatedImpact: '50-80% tail latency reduction'
      });
    }

    // Slow queries
    if (slowQueries.length > 3) {
      recommendations.push({
        category: 'query_rewrite',
        priority: 'medium',
        title: 'Multiple slow queries detected',
        description: `${slowQueries.length} slow queries found, review query execution plans`,
        estimatedImpact: '30-60% query speedup'
      });
    }

    // Check for repeated patterns
    const frequentPatterns = patterns.filter(p => p.frequency > 10 && p.avgDuration > 20);
    if (frequentPatterns.length > 0) {
      recommendations.push({
        category: 'caching',
        priority: 'medium',
        title: 'Frequent query patterns detected',
        description: `${frequentPatterns.length} query patterns executed frequently, consider caching`,
        estimatedImpact: '40-70% repeated query speedup'
      });
    }

    return recommendations;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const queryPerformanceAnalyzer = new QueryPerformanceAnalyzer();
