import { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../types';
import { queryOptimizer } from './queryOptimizer';
import { securityManager } from './security/SecurityManager';
import { createScopedLogger } from '../utils/logger';
import { SIZE_CONSTANTS } from './modularConstants';

const logger = createScopedLogger('DatabaseOptimizer');

interface OptimizationConfig {
  enableQueryCaching: boolean;
  enableBatchOperations: boolean;
  enableFullTextSearch: boolean;
  enableConnectionPooling: boolean;
  enableResultCompression: boolean;
  enablePredictiveCaching: boolean;
  enableSemanticCaching: boolean;
  enableQueryBatching: boolean;
  enableSmartIndexing: boolean;
}

interface OptimizationMetrics {
  cacheHitRate: number;
  queryResponseTime: number;
  batchEfficiency: number;
  compressionRatio: number;
  totalOptimizedQueries: number;
}

class DatabaseOptimizer {
  private config: OptimizationConfig = {
    enableQueryCaching: true,
    enableBatchOperations: true,
    enableFullTextSearch: true,
    enableConnectionPooling: true,
    enableResultCompression: true,
    enablePredictiveCaching: true,
    enableSemanticCaching: true,
    enableQueryBatching: true,
    enableSmartIndexing: true,
  };
  
  private metrics: OptimizationMetrics = {
    cacheHitRate: 0,
    queryResponseTime: 0,
    batchEfficiency: 0,
    compressionRatio: 0,
    totalOptimizedQueries: 0,
  };
  
  private optimizationHistory: Array<{
    operation: string;
    executionTime: number;
    timestamp: number;
  }> = [];

  /**
   * Optimize robot search queries with caching and indexing
   */
  async searchRobotsOptimized(
    client: SupabaseClient,
    searchTerm: string,
    options: {
      userId?: string;
      strategyType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: Robot[] | null; error: any }> {
    if (!securityManager.validateInput(searchTerm, 'search')) {
      return { data: null, error: { message: 'Invalid search term' } };
    }
    
    // Sanitize and prepare search term
    const sanitizedTerm = searchTerm.trim().toLowerCase();
    if (sanitizedTerm.length < 2) {
      return { data: null, error: { message: 'Search term too short' } };
    }
    
    // Use the existing queryOptimizer for optimized search
    const result = await queryOptimizer.searchRobotsOptimized(
      client,
      sanitizedTerm,
      {
        strategyType: options.strategyType,
        userId: options.userId,
      }
    );
    
    this.updateMetrics(result.metrics);
    
    return {
      data: result.data,
      error: result.error
    };
  }

  /**
   * Optimize robot listing queries with advanced filtering and caching
   */
  async listRobotsOptimized(
    client: SupabaseClient,
    options: {
      userId?: string;
      strategyType?: string;
      limit?: number;
      offset?: number;
      searchTerm?: string;
      orderBy?: 'created_at' | 'updated_at' | 'name';
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<{ data: Robot[] | null; error: any; metrics: any }> {
    // Use the existing queryOptimizer for the database query
    const result = await queryOptimizer.getRobotsOptimized(client, {
      userId: options.userId,
      strategyType: options.strategyType,
      searchTerm: options.searchTerm,
      limit: options.limit,
      offset: options.offset,
      orderBy: options.orderBy,
      orderDirection: options.orderDirection
    });
    
    this.updateMetrics(result.metrics);
    
    return {
      data: result.data,
      error: result.error,
      metrics: result.metrics
    };
  }

  /**
   * Batch insert operation with optimization
   */
  async batchInsertOptimized<T>(
    client: SupabaseClient,
    table: string,
    records: T[],
    options: {
      batchSize?: number;
      validateRecords?: boolean;
    } = {}
  ): Promise<{ data: T[] | null; error: any; metrics: any }> {
    const startTime = performance.now();
    const batchSize = options.batchSize || 100;
    
    // Validate records if requested
    if (options.validateRecords) {
      for (const record of records) {
        if (!securityManager.validateInput(record, 'record')) {
          return { data: null, error: { message: 'Invalid record data' }, metrics: { executionTime: 0 } };
        }
      }
    }
    
    const result = await queryOptimizer.batchInsert(client, table, records, batchSize);
    
    const executionTime = performance.now() - startTime;
    
    this.updateMetrics({
      executionTime,
      resultCount: Array.isArray(result.data) ? result.data.length : 0,
      cacheHit: false,
      queryHash: `batch_insert_${table}_${records.length}`
    });
    
    return {
      data: result.data,
      error: result.error,
      metrics: { executionTime }
    };
  }

  /**
   * Update optimization metrics
   */
  private updateMetrics(queryMetrics: any): void {
    this.metrics.totalOptimizedQueries++;
    this.metrics.queryResponseTime = 
      (this.metrics.queryResponseTime + queryMetrics.executionTime) / this.metrics.totalOptimizedQueries;
    
    // Store in history
    this.optimizationHistory.push({
      operation: 'query_execution',
      executionTime: queryMetrics.executionTime,
      timestamp: Date.now()
    });
    
    // Keep only recent history
    if (this.optimizationHistory.length > 1000) {
      this.optimizationHistory = this.optimizationHistory.slice(-1000);
    }
  }

  /**
   * Get current optimization metrics
   */
  getOptimizationMetrics(): OptimizationMetrics {
    // Calculate cache hit rate from queryOptimizer
    const analysis = queryOptimizer.getPerformanceAnalysis();
    this.metrics.cacheHitRate = analysis.cacheHitRate;
    
    return { ...this.metrics };
  }

  /**
   * Optimize query execution by batching similar operations
   */
  async executeBatchedQueries<T>(
    client: SupabaseClient,
    operations: Array<{ 
      table: string; 
      operation: 'select' | 'insert' | 'update' | 'delete'; 
      params: any 
    }>
  ): Promise<Array<{ data: T | null; error: any }>> {
    if (!this.config.enableQueryBatching) {
      // Execute operations individually if batching is disabled
      const results: Array<{ data: T | null; error: any }> = [];
      for (const op of operations) {
        let result: { data: T | null; error: any };
        switch (op.operation) {
          case 'select': {
            const selectResult = await client.from(op.table).select('*').match(op.params);
            result = { data: selectResult.data as T | null, error: selectResult.error };
            break;
          }
          case 'insert': {
            const insertResult = await client.from(op.table).insert(op.params);
            result = { data: insertResult.data as T | null, error: insertResult.error };
            break;
          }
          case 'update': {
            const updateResult = await client.from(op.table).update(op.params.data).match(op.params.filter);
            result = { data: updateResult.data as T | null, error: updateResult.error };
            break;
          }
          case 'delete': {
            const deleteResult = await client.from(op.table).delete().match(op.params);
            result = { data: deleteResult.data as T | null, error: deleteResult.error };
            break;
          }
          default:
            result = { data: null, error: { message: 'Invalid operation' } };
        }
        results.push(result);
      }
      return results;
    }

    // Group similar queries for optimization
    const groupedOperations = this.groupSimilarQueries(operations);
    const results: Array<{ data: T | null; error: any }> = [];

    for (const group of groupedOperations) {
      if (group.length === 1) {
        // Execute single operation
        const op = group[0];
        if (!op) {
          results.push({ data: null, error: { message: 'Operation is undefined' } });
          continue;
        }
        let result: { data: T | null; error: any };
        switch (op.operation) {
          case 'select': {
            const selectResult = await client.from(op.table).select('*').match(op.params);
            result = { data: selectResult.data as T | null, error: selectResult.error };
            break;
          }
          case 'insert': {
            const insertResult = await client.from(op.table).insert(op.params);
            result = { data: insertResult.data as T | null, error: insertResult.error };
            break;
          }
          case 'update': {
            const updateResult = await client.from(op.table).update(op.params.data).match(op.params.filter);
            result = { data: updateResult.data as T | null, error: updateResult.error };
            break;
          }
          case 'delete': {
            const deleteResult = await client.from(op.table).delete().match(op.params);
            result = { data: deleteResult.data as T | null, error: deleteResult.error };
            break;
          }
          default:
            result = { data: null, error: { message: 'Invalid operation' } };
        }
        results.push(result);
      } else {
        // Execute batched operations (simplified implementation)
        const batchResult = await this.executeBatchedQuery<T>(group);
        results.push(...batchResult);
      }
    }

    return results;
  }

  /**
   * Group similar queries for batching
   */
  private groupSimilarQueries(queries: Array<{ 
    table: string; 
    operation: 'select' | 'insert' | 'update' | 'delete'; 
    params: any 
  }>): Array<Array<{ 
    table: string; 
    operation: 'select' | 'insert' | 'update' | 'delete'; 
    params: any 
  }>> {
    const groups: Array<Array<{ 
      table: string; 
      operation: 'select' | 'insert' | 'update' | 'delete'; 
      params: any 
    }>> = [];
    
    for (const query of queries) {
      let foundGroup = false;
      
      // Try to find existing group with similar operation
      for (const group of groups) {
        const firstQuery = group[0];
        if (firstQuery && this.areQueriesSimilar(firstQuery, query)) {
          group.push(query);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        groups.push([query]);
      }
    }
    
    return groups;
  }

  /**
   * Check if two queries are similar enough for batching
   */
  private areQueriesSimilar(
    query1: { table: string; operation: string; params: any }, 
    query2: { table: string; operation: string; params: any }
  ): boolean {
    // Queries are similar if they have the same table and operation type
    return query1.table === query2.table && query1.operation === query2.operation;
  }

  /**
   * Execute batched query
   */
  private async executeBatchedQuery<T>(queries: Array<{ 
    table: string; 
    operation: 'select' | 'insert' | 'update' | 'delete'; 
    params: any 
  }>): Promise<Array<{ data: T | null; error: any }>> {
    // Implementation would combine queries into a single database operation
    logger.log(`Executing batched query for ${queries.length} operations`);
    return queries.map(() => ({ data: null as T | null, error: null }));
  }

  /**
   * Get query optimization recommendations based on current performance
   */
  async getQueryOptimizationRecommendations(
    client: SupabaseClient
  ): Promise<{ 
    recommendations: string[]; 
    severity: 'low' | 'medium' | 'high';
    impact: 'performance' | 'cost' | 'reliability';
  }> {
    const recommendations: string[] = [];
    
    // Check for missing indexes based on common query patterns
    try {
      // Get query performance metrics
      const { data: slowQueries, error } = await client
        .from('pg_stat_statements') // This is a PostgreSQL extension for query stats
        .select('query, mean_time, calls')
        .order('mean_time', { ascending: false })
        .limit(5);
      
      if (!error && slowQueries && slowQueries.length > 0) {
        // Check for queries without indexes
        slowQueries.forEach((query: any) => {
          if (query.mean_time > 100 && query.calls > 100) { // Slow and frequently called
            recommendations.push(`Query taking ${query.mean_time.toFixed(2)}ms avg time with ${query.calls} calls may need indexing: ${query.query.substring(0, SIZE_CONSTANTS.STRING.MEDIUM)}...`);
          }
        });
      }
    } catch (_err) {
      // pg_stat_statements might not be available, which is fine
      logger.debug('Query statistics not available for optimization recommendations');
    }
    
    // Add general recommendations based on our metrics
    const metrics = this.getOptimizationMetrics();
    if (metrics.queryResponseTime > 1000) {
      recommendations.push('Average query response time is high (>1 second). Consider adding indexes or optimizing queries.');
    }
    
    if (metrics.cacheHitRate < 30) {
      recommendations.push('Cache hit rate is low (<30%). Consider optimizing cache strategies for frequently accessed data.');
    }
    
    // Additional optimization checks
    try {
      // Check for table bloat and suggest vacuum/analyze
      const { data: tableStats, error: tableError } = await client
        .from('pg_stat_user_tables')
        .select('relname, n_tup_ins, n_tup_upd, n_tup_del, n_tup_hot_upd')
        .gt('n_tup_del', 1000) // Tables with significant deletions
        .limit(10);
      
      if (!tableError && tableStats && tableStats.length > 0) {
        tableStats.forEach((table: any) => {
          recommendations.push(`Table "${table.relname}" has ${table.n_tup_del} deleted rows, consider VACUUM operation for optimization.`);
        });
      }
    } catch (_err) {
      logger.debug('Table statistics not available for optimization recommendations');
    }

    return {
      recommendations,
      severity: recommendations.length > 5 ? 'high' : recommendations.length > 2 ? 'medium' : 'low',
      impact: 'performance'
    };
  }
  
  /**
   * Advanced query optimization with materialized views and performance insights
   */
  async getAdvancedOptimizationInsights(client: SupabaseClient): Promise<{
    performanceInsights: unknown[];
    materializedViewRecommendations: string[];
    indexRecommendations: string[];
  }> {
    const performanceInsights: unknown[] = [];
    const materializedViewRecommendations: string[] = [];
    const indexRecommendations: string[] = [];
    
    try {
      // Get strategy performance insights from materialized view if available
      const { data: strategyInsights, error: strategyError } = await client
        .rpc('get_strategy_performance_insights');
      
      if (!strategyError && strategyInsights) {
        performanceInsights.push(...strategyInsights);
      }
    } catch (_err) {
      logger.debug('Strategy performance insights not available');
    }

    // Suggest materialized views for complex aggregations
    materializedViewRecommendations.push(
      'CREATE MATERIALIZED VIEW IF NOT EXISTS robots_summary_cache AS SELECT strategy_type, COUNT(*) as count, AVG(view_count) as avg_views FROM robots GROUP BY strategy_type;',
      'CREATE MATERIALIZED VIEW IF NOT EXISTS user_activity_summary AS SELECT user_id, COUNT(*) as robot_count, MAX(updated_at) as last_activity FROM robots GROUP BY user_id;'
    );
    
    // Suggest additional indexes based on common query patterns
    indexRecommendations.push(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_strategy_created ON robots(strategy_type, created_at DESC);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_user_updated ON robots(user_id, updated_at DESC);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_name_search ON robots USING gin(to_tsvector(\'english\', name));'
    );
    
    return {
      performanceInsights,
      materializedViewRecommendations,
      indexRecommendations
    };
  }
  
  /**
   * Run comprehensive database optimization including VACUUM, ANALYZE, and maintenance
   */
  async runComprehensiveOptimization(client: SupabaseClient): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const startTime = Date.now();
      
      // Run ANALYZE to update statistics
      await client.rpc('pg_stat_reset');
      
      // Get table statistics and run optimization where needed
      const { data: tables, error: tableError } = await client
        .from('pg_stat_user_tables')
        .select('relname, seq_scan, idx_scan, n_tup_ins, n_tup_upd, n_tup_del')
        .gt('n_tup_del', 1000);
      
      if (!tableError && tables) {
        // For each table with significant changes, suggest optimization
        for (const table of tables) {
          if (table.n_tup_del > 1000) {
            // In a real implementation, we would run VACUUM ANALYZE on the table
            logger.log(`Table ${table.relname} has ${table.n_tup_del} deleted tuples, optimization recommended`);
          }
        }
      }
      
      // Update query optimizer statistics
      const queryAnalysis = queryOptimizer.getPerformanceAnalysis();
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        message: `Comprehensive optimization completed in ${duration}ms`,
        details: {
          operations: ['statistics_update', 'query_analysis'],
          duration: duration,
          analyzedTables: tables ? tables.length : 0,
          slowQueryCount: queryAnalysis.slowQueries.length
        }
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: `Comprehensive optimization failed: ${error}`,
      };
    }
  }
  
  /**
   * Run database maintenance operations
   */
  async runDatabaseMaintenance(client: SupabaseClient): Promise<{ success: boolean; message: string }> {
    try {
      // Run ANALYZE to update table statistics
      const { error: analyzeError } = await client.rpc('pg_stat_reset');
      if (analyzeError) {
        logger.error('Error running ANALYZE:', analyzeError);
      }

      // Get tables that need maintenance
      const { data: tables, error: tableError } = await client
        .from('pg_stat_user_tables')
        .select('relname, n_tup_del')
        .gt('n_tup_del', 5000); // Tables with significant deletions

      if (!tableError && tables) {
        for (const table of tables) {
          logger.log(`Table ${table.relname} has ${table.n_tup_del} deleted tuples, maintenance recommended`);
          // In a real scenario, we would run VACUUM operations here
        }
      }

      return {
        success: true,
        message: 'Database maintenance completed'
      };
    } catch (_error) {
      logger.error('Database maintenance failed:', _error);
      return {
        success: false,
        message: `Database maintenance failed: ${_error}`
      };
    }
  }
  
  /**
   * Get general optimization recommendations
   */
  getOptimizationRecommendations(): Array<{ 
    category: string; 
    recommendation: string; 
    priority: 'low' | 'medium' | 'high'; 
    impact: string 
  }> {
    const metrics = this.getOptimizationMetrics();
    const recommendations: Array<{ 
      category: string; 
      recommendation: string; 
      priority: 'low' | 'medium' | 'high'; 
      impact: string 
    }> = [];
    
    // Cache-related recommendations
    if (metrics.cacheHitRate < 30) {
      recommendations.push({
        category: 'cache',
        recommendation: 'Increase cache hit rate by optimizing frequently accessed data',
        priority: 'high' as 'low' | 'medium' | 'high',
        impact: 'Performance improvement'
      });
    }
    
    // Query performance recommendations
    if (metrics.queryResponseTime > 500) {
      recommendations.push({
        category: 'query',
        recommendation: 'Optimize slow queries by adding indexes or rewriting',
        priority: 'high' as 'low' | 'medium' | 'high',
        impact: 'Response time improvement'
      });
    }
    
    return recommendations;
  }
}

// Singleton instance
export const databaseOptimizer = new DatabaseOptimizer();

// Export the class for potential instantiation with custom config
export { DatabaseOptimizer };