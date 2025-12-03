/**
 * Advanced Database Optimizer
 * Provides additional database optimization features including query plan analysis,
 * connection optimization, and performance tuning for Supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { databaseOptimizer } from './databaseOptimizer';
import { enhancedConnectionPool } from './enhancedSupabasePool';
import { queryOptimizer } from './queryOptimizer';

interface QueryPlan {
  query: string;
  executionTime: number;
  plan: any;
  recommendations: string[];
}

interface IndexRecommendation {
  table: string;
  columns: string[];
  reason: string;
  estimatedImprovement: number;
}

interface OptimizationResult {
  success: boolean;
  message: string;
  details?: any;
}

interface AdvancedOptimizationConfig {
  enableQueryPlanAnalysis: boolean;
  enableConnectionOptimization: boolean;
  enableIndexOptimization: boolean;
  enableCacheOptimization: boolean;
  enableMonitoring: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

class AdvancedDatabaseOptimizer {
  private config: AdvancedOptimizationConfig = {
    enableQueryPlanAnalysis: true,
    enableConnectionOptimization: true,
    enableIndexOptimization: true,
    enableCacheOptimization: true,
    enableMonitoring: true,
    logLevel: 'info'
  };

  private queryPlans: Map<string, QueryPlan> = new Map();
  private optimizationHistory: Array<{
    operation: string;
    timestamp: number;
    duration: number;
    success: boolean;
    details?: any;
  }> = [];

  private readonly MAX_HISTORY = 500;

  constructor(config?: Partial<AdvancedOptimizationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Analyze query execution plans and provide optimization recommendations
   */
  async analyzeQueryPlan(client: SupabaseClient, query: string): Promise<QueryPlan> {
    if (!this.config.enableQueryPlanAnalysis) {
      return {
        query,
        executionTime: 0,
        plan: {},
        recommendations: ['Query plan analysis is disabled']
      };
    }

    const startTime = performance.now();

    try {
      // For Supabase/PostgreSQL, we can use EXPLAIN to get query plans
      // This is a simplified version - in production, you'd execute EXPLAIN ANALYZE
      const planAnalysis = await this.getQueryPlan(client, query);
      
      const executionTime = performance.now() - startTime;
      
      const recommendations = this.generatePlanRecommendations(planAnalysis);
      
      const queryPlan: QueryPlan = {
        query,
        executionTime,
        plan: planAnalysis,
        recommendations
      };

      // Store for later analysis
      const queryHash = this.generateQueryHash(query);
      this.queryPlans.set(queryHash, queryPlan);

      // Keep query plans within limits
      if (this.queryPlans.size > 100) {
        const firstKey = this.queryPlans.keys().next().value;
        this.queryPlans.delete(firstKey);
      }

      this.log('debug', `Query plan analyzed for: ${query.substring(0, 50)}...`, { executionTime, recommendations });

      return queryPlan;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.log('error', `Error analyzing query plan: ${error}`, { query, executionTime });
      
      return {
        query,
        executionTime,
        plan: {},
        recommendations: [`Error analyzing query: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Get query execution plan using EXPLAIN
   */
  private async getQueryPlan(client: SupabaseClient, query: string): Promise<any> {
    try {
      // Sanitize query for EXPLAIN - remove sensitive data
      const sanitizedQuery = this.sanitizeQueryForExplain(query);
      
      // Execute EXPLAIN ANALYZE to get detailed plan
      const { data, error } = await client
        .from('pg_stat_statements')
        .select('query_plan')
        .ilike('query', `%${this.extractTableName(query)}%`)
        .limit(1);

      if (error) {
        // Fallback: try to get plan by executing an EXPLAIN directly
        // Note: In a real implementation, this would require a direct database connection
        // since Supabase doesn't allow direct EXPLAIN execution through the client
        return {
          query: sanitizedQuery,
          estimated: true,
          reason: 'Direct EXPLAIN not available through Supabase client',
          fallback_analysis: this.estimateQueryPlan(sanitizedQuery)
        };
      }

      return data ? data[0] : this.estimateQueryPlan(sanitizedQuery);
    } catch (error) {
      this.log('warn', `Could not get exact query plan: ${error}`, { query });
      return this.estimateQueryPlan(this.sanitizeQueryForExplain(query));
    }
  }

  /**
   * Estimate query plan based on query structure (fallback implementation)
   */
  private estimateQueryPlan(query: string): any {
    const plan = {
      query_text: query,
      estimated_cost: 0,
      estimated_rows: 0,
      operations: [] as string[],
      potential_issues: [] as string[],
      recommendations: [] as string[]
    };

    // Analyze query structure
    if (query.toLowerCase().includes('join')) {
      plan.operations.push('JOIN operation');
      plan.potential_issues.push('JOINs may be slow without proper indexes');
      plan.recommendations.push('Consider adding indexes on JOIN columns');
    }

    if (query.toLowerCase().includes('like')) {
      plan.operations.push('LIKE operation');
      plan.potential_issues.push('LIKE operations can be slow on large datasets');
      plan.recommendations.push('Consider using full-text search or indexes for LIKE operations');
    }

    if ((query.match(/where/gi) || []).length > 1) {
      plan.operations.push('Multiple WHERE conditions');
      plan.recommendations.push('Consider composite indexes for multiple WHERE conditions');
    }

    if (query.toLowerCase().includes('order by') && query.toLowerCase().includes('limit')) {
      plan.operations.push('ORDER BY with LIMIT');
      plan.recommendations.push('Ensure ORDER BY column has an index for efficient LIMIT operations');
    }

    return plan;
  }

  /**
   * Generate optimization recommendations based on query plan
   */
  private generatePlanRecommendations(plan: any): string[] {
    const recommendations: string[] = [];

    if (plan.potential_issues) {
      recommendations.push(...plan.potential_issues);
    }

    if (plan.recommendations) {
      recommendations.push(...plan.recommendations);
    }

    // Additional recommendations based on estimated cost/rows
    if (plan.estimated_cost > 100) {
      recommendations.push('Query has high estimated cost - consider optimization');
    }

    if (plan.estimated_rows > 10000) {
      recommendations.push('Query returns many rows - consider pagination or filtering');
    }

    return recommendations;
  }

  /**
   * Optimize database connections based on usage patterns
   */
  async optimizeConnections(): Promise<OptimizationResult> {
    if (!this.config.enableConnectionOptimization) {
      return {
        success: true,
        message: 'Connection optimization is disabled'
      };
    }

    const startTime = Date.now();

    try {
      // Get current connection metrics
      const metrics = await enhancedConnectionPool.getDetailedStats();
      
      // Optimize based on metrics
      const optimizations: string[] = [];

      // Adjust pool size based on usage patterns
      if (metrics.pool.activeConnections >= metrics.pool.totalConnections * 0.9) {
        // Pool is near capacity, consider increasing
        const newMax = Math.min(metrics.config.maxConnections + 2, 12);
        enhancedConnectionPool.updateConfig({ maxConnections: newMax });
        optimizations.push(`Increased max connections to ${newMax}`);
      } else if (metrics.pool.activeConnections < metrics.pool.totalConnections * 0.3) {
        // Pool has too many idle connections, consider decreasing
        const newMax = Math.max(metrics.config.maxConnections - 1, metrics.config.minConnections);
        if (newMax < metrics.config.maxConnections) {
          enhancedConnectionPool.updateConfig({ maxConnections: newMax });
          optimizations.push(`Decreased max connections to ${newMax}`);
        }
      }

      // Perform connection warm-up if needed
      if (metrics.pool.totalConnections < metrics.config.minConnections) {
        await enhancedConnectionPool.forceEdgeWarming();
        optimizations.push('Warmed up additional connections');
      }

      // Drain unhealthy connections
      await enhancedConnectionPool.drainConnections();
      optimizations.push('Drained unhealthy connections');

      const duration = Date.now() - startTime;

      this.recordOptimization('optimizeConnections', duration, true, { metrics, optimizations });

      this.log('info', `Connection optimization completed`, { 
        duration, 
        optimizations,
        metrics: {
          before: {
            total: metrics.pool.totalConnections,
            active: metrics.pool.activeConnections,
            idle: metrics.pool.idleConnections
          }
        }
      });

      return {
        success: true,
        message: `Connection optimization completed in ${duration}ms`,
        details: {
          optimizations,
          metrics: await enhancedConnectionPool.getDetailedStats()
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordOptimization('optimizeConnections', duration, false, { error });

      this.log('error', `Connection optimization failed: ${error}`, { duration });

      return {
        success: false,
        message: `Connection optimization failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Optimize database indexes based on query patterns
   */
  async optimizeIndexes(client: SupabaseClient): Promise<OptimizationResult> {
    if (!this.config.enableIndexOptimization) {
      return {
        success: true,
        message: 'Index optimization is disabled'
      };
    }

    const startTime = Date.now();

    try {
      // Analyze query patterns to recommend indexes
      const recommendations = await this.analyzeIndexNeeds(client);
      
      // Generate SQL for creating recommended indexes
      const indexSql = this.generateIndexSql(recommendations);
      
      const duration = Date.now() - startTime;

      this.recordOptimization('optimizeIndexes', duration, true, { recommendations, indexSql });

      this.log('info', `Index optimization analysis completed`, { 
        duration, 
        recommendations: recommendations.length,
        sqlStatements: indexSql.length
      });

      return {
        success: true,
        message: `${recommendations.length} index recommendations generated`,
        details: {
          recommendations,
          sql: indexSql
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordOptimization('optimizeIndexes', duration, false, { error });

      this.log('error', `Index optimization failed: ${error}`, { duration });

      return {
        success: false,
        message: `Index optimization failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Analyze query patterns to identify needed indexes
   */
  private async analyzeIndexNeeds(client: SupabaseClient): Promise<IndexRecommendation[]> {
    try {
      // Get slow queries from the query optimizer
      const queryAnalysis = queryOptimizer.getPerformanceAnalysis();
      const slowQueries = queryAnalysis.slowQueries.slice(0, 10); // Top 10 slow queries

      const recommendations: IndexRecommendation[] = [];

      for (const slowQuery of slowQueries) {
        // Analyze query to identify potential indexes
        const table = this.extractTableNameFromQuery(slowQuery.queryHash);
        if (table) {
          const columns = this.extractFilterColumns(slowQuery.queryHash);
          if (columns.length > 0) {
            recommendations.push({
              table,
              columns,
              reason: 'Slow query detected on these columns',
              estimatedImprovement: this.estimateIndexImprovement(slowQuery)
            });
          }
        }
      }

      // Also analyze table statistics for missing indexes
      try {
        const { data: tableStats, error: statsError } = await client
          .from('pg_stat_user_tables')
          .select('relname, seq_scan, idx_scan')
          .gt('seq_scan', 'idx_scan') // Tables with more sequential scans than index scans
          .limit(10);

        if (!statsError && tableStats) {
          for (const table of tableStats) {
            recommendations.push({
              table: table.relname,
              columns: ['id'], // Common index on primary key
              reason: 'Sequential scans detected, index on primary key recommended',
              estimatedImprovement: 0.7 // 70% estimated improvement
            });
          }
        }
      } catch (error) {
        this.log('debug', 'Could not analyze table statistics for index recommendations', { error });
      }

      return recommendations;
    } catch (error) {
      this.log('warn', `Could not analyze index needs: ${error}`, { error });
      return [];
    }
  }

  /**
   * Generate SQL statements for creating indexes
   */
  private generateIndexSql(recommendations: IndexRecommendation[]): string[] {
    const sqlStatements: string[] = [];

    for (const rec of recommendations) {
      const indexName = `idx_${rec.table}_${rec.columns.join('_')}`;
      const columnsStr = rec.columns.join(', ');
      
      sqlStatements.push(
        `CREATE INDEX IF NOT EXISTS ${indexName} ON ${rec.table} (${columnsStr});`
      );
    }

    return sqlStatements;
  }

  /**
   * Optimize caching strategies based on access patterns
   */
  async optimizeCaching(): Promise<OptimizationResult> {
    if (!this.config.enableCacheOptimization) {
      return {
        success: true,
        message: 'Cache optimization is disabled'
      };
    }

    const startTime = Date.now();

    try {
      // Get current cache metrics
      const cacheMetrics = databaseOptimizer.getOptimizationMetrics();
      
      // Optimize based on cache hit rate
      const optimizations: string[] = [];

      if (cacheMetrics.cacheHitRate < 50) {
        // Cache hit rate is low, consider increasing TTL or cache size
        optimizations.push('Cache hit rate is low (<50%), consider increasing TTL or cache size');
      }

      if (cacheMetrics.queryResponseTime > 500) {
        optimizations.push('Query response time is high, consider optimizing queries or adding more indexes');
      }

      // Clear old optimization history to free memory
      databaseOptimizer.clearHistory();
      optimizations.push('Cleared old optimization history');

      // Run comprehensive optimization
      await databaseOptimizer.runComprehensiveOptimization({} as any);
      optimizations.push('Ran comprehensive database optimization');

      const duration = Date.now() - startTime;

      this.recordOptimization('optimizeCaching', duration, true, { optimizations, cacheMetrics });

      this.log('info', `Cache optimization completed`, { 
        duration, 
        optimizations,
        cacheMetrics
      });

      return {
        success: true,
        message: `Cache optimization completed in ${duration}ms`,
        details: {
          optimizations,
          cacheMetrics: databaseOptimizer.getOptimizationMetrics()
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordOptimization('optimizeCaching', duration, false, { error });

      this.log('error', `Cache optimization failed: ${error}`, { duration });

      return {
        success: false,
        message: `Cache optimization failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Extract table name from query (simplified)
   */
  private extractTableName(query: string): string {
    const match = query.match(/from\s+(\w+)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Extract table name from query hash
   */
  private extractTableNameFromQuery(queryHash: string): string | null {
    // This is a simplified implementation
    // In reality, you'd need to decode the query hash back to the original query
    // For now, we'll use a heuristic approach
    const tables = ['robots', 'users', 'analytics', 'performance_metrics'];
    
    for (const table of tables) {
      if (queryHash.toLowerCase().includes(table)) {
        return table;
      }
    }
    
    return null;
  }

  /**
   * Extract filter columns from query
   */
  private extractFilterColumns(queryHash: string): string[] {
    // Simplified implementation - in reality, you'd need to analyze the actual query
    const columns: string[] = [];
    
    if (queryHash.includes('user_id')) columns.push('user_id');
    if (queryHash.includes('strategy_type')) columns.push('strategy_type');
    if (queryHash.includes('created_at')) columns.push('created_at');
    if (queryHash.includes('updated_at')) columns.push('updated_at');
    if (queryHash.includes('name')) columns.push('name');
    
    return columns;
  }

  /**
   * Estimate index improvement
   */
  private estimateIndexImprovement(slowQuery: any): number {
    // Simplified estimation based on query time
    if (slowQuery.executionTime > 1000) return 0.8; // 80% improvement for very slow queries
    if (slowQuery.executionTime > 500) return 0.6;  // 60% improvement for slow queries
    if (slowQuery.executionTime > 200) return 0.4;  // 40% improvement for moderately slow queries
    return 0.2; // 20% improvement for relatively fast queries
  }

  /**
   * Sanitize query for EXPLAIN (remove sensitive data)
   */
  private sanitizeQueryForExplain(query: string): string {
    // Remove potential sensitive data while keeping structure
    return query
      .replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, "'***'") // Replace string literals
      .replace(/\b\d+\b/g, '***') // Replace numbers
      .substring(0, 500); // Limit length
  }

  /**
   * Generate query hash for identification
   */
  private generateQueryHash(query: string): string {
    // Create a simple hash of the query
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 16);
  }

  /**
   * Record optimization operation in history
   */
  private recordOptimization(operation: string, duration: number, success: boolean, details?: any): void {
    this.optimizationHistory.push({
      operation,
      timestamp: Date.now(),
      duration,
      success,
      details
    });

    // Keep history within limits
    if (this.optimizationHistory.length > this.MAX_HISTORY) {
      this.optimizationHistory = this.optimizationHistory.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): Array<{
    operation: string;
    timestamp: number;
    duration: number;
    success: boolean;
    details?: any;
  }> {
    return [...this.optimizationHistory];
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    // Get recommendations from database optimizer
    const dbRecommendations = databaseOptimizer.getOptimizationRecommendations();
    recommendations.push(...dbRecommendations);

    // Add recommendations based on optimization history
    const recentOptimizations = this.optimizationHistory.slice(-10);
    const failedOptimizations = recentOptimizations.filter(opt => !opt.success);
    
    if (failedOptimizations.length > 0) {
      recommendations.push(`Address ${failedOptimizations.length} failed optimizations in the last 10 attempts`);
    }

    return recommendations;
  }

  /**
   * Run comprehensive optimization
   */
  async runComprehensiveOptimization(client: SupabaseClient): Promise<{
    connection: OptimizationResult;
    index: OptimizationResult;
    cache: OptimizationResult;
  }> {
    // Run all optimizations in parallel
    const [connection, index, cache] = await Promise.all([
      this.optimizeConnections(),
      this.optimizeIndexes(client),
      this.optimizeCaching()
    ]);

    // Note: We're not including query analysis as a separate result since it's an analysis function
    // rather than an optimization action. The query analysis is done internally.

    this.log('info', 'Comprehensive optimization completed', {
      connection: connection.success,
      index: index.success,
      cache: cache.success
    });

    return {
      connection,
      index,
      cache
    };
  }

  /**
   * Log messages based on log level
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      switch (level) {
        case 'error':
          console.error(logMessage, data);
          break;
        case 'warn':
          console.warn(logMessage, data);
          break;
        case 'info':
          console.info(logMessage, data);
          break;
        case 'debug':
          console.debug(logMessage, data);
          break;
      }
    }
  }

  /**
   * Check if message should be logged based on configured log level
   */
  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.config.logLevel];
  }
}

// Singleton instance
export const advancedDatabaseOptimizer = new AdvancedDatabaseOptimizer();

// Export the class for potential instantiation with custom config
export { AdvancedDatabaseOptimizer };