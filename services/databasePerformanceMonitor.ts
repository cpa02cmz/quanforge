import { SupabaseClient } from '@supabase/supabase-js';

interface DatabaseMetrics {
  queryTime: number;
  cacheHitRate: number;
  connectionPoolUtilization: number;
  indexUsage: number;
  slowQueries: number;
  errorRate: number;
  throughput: number;
}

interface QueryPerformanceMetrics {
  queryId: string;
  tableName: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  executionTime: number;
  resultSize: number;
  startTime: number;
  endTime: number;
  parameters: Record<string, any>;
  success: boolean;
  error: string | undefined;
  userId: string | undefined;
  cached: boolean;
}

interface DatabasePerformanceSummary {
  totalQueries: number;
  avgExecutionTime: number;
  slowQueries: number; // Queries > 500ms
  cacheHitRate: number;
  mostExpensiveQueries: QueryPerformanceMetrics[];
  queryDistribution: {
    select: number;
    insert: number;
    update: number;
    delete: number;
  };
  performanceTrend: number[]; // Last 10 query times
}

interface PerformanceAlert {
  type: 'slow_query' | 'high_error_rate' | 'connection_exhaustion' | 'cache_miss';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metadata: any;
}

class DatabasePerformanceMonitor {
  private static instance: DatabasePerformanceMonitor;
  private metrics: DatabaseMetrics = {
    queryTime: 0,
    cacheHitRate: 0,
    connectionPoolUtilization: 0,
    indexUsage: 0,
    slowQueries: 0,
    errorRate: 0,
    throughput: 0,
  };
  private queryHistory: Array<{ query: string; time: number; timestamp: number }> = [];
  private detailedMetrics: QueryPerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly HIGH_ERROR_RATE_THRESHOLD = 0.05; // 5%
  private readonly MAX_QUERY_HISTORY = 1000;
  private readonly MAX_DETAILED_METRICS = 10000; // Limit to prevent memory issues
  private readonly PERFORMANCE_TREND_SIZE = 10;

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): DatabasePerformanceMonitor {
    if (!DatabasePerformanceMonitor.instance) {
      DatabasePerformanceMonitor.instance = new DatabasePerformanceMonitor();
    }
    return DatabasePerformanceMonitor.instance;
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
      this.generateAlerts();
    }, 30000); // Monitor every 30 seconds
  }

  // Enhanced record query with detailed metrics
  recordDetailedQuery(input: { 
    queryId: string;
    tableName: string;
    operation: 'select' | 'insert' | 'update' | 'delete';
    resultSize: number;
    parameters: Record<string, any>;
    error: string | undefined;
    userId: string | undefined;
    cached: boolean;
    startTime: number; 
    endTime: number; 
  }): void {
    const executionTime = input.endTime - input.startTime;
    const success = !input.error;
    
    // Create metric object step by step to avoid type issues
    const metric = {
      queryId: input.queryId,
      tableName: input.tableName,
      operation: input.operation,
      resultSize: input.resultSize,
      parameters: input.parameters,
      error: input.error,
      userId: input.userId,
      cached: input.cached,
      startTime: input.startTime,
      endTime: input.endTime,
      executionTime: executionTime,
      success: success,
    } as QueryPerformanceMetrics;

    this.detailedMetrics.push(metric);

    // Maintain size limit
    if (this.detailedMetrics.length > this.MAX_DETAILED_METRICS) {
      this.detailedMetrics = this.detailedMetrics.slice(-this.MAX_DETAILED_METRICS);
    }

    // Also record in the original query history for backward compatibility
    this.queryHistory.push({
      query: this.sanitizeQuery(input.queryId),
      time: executionTime,
      timestamp: Date.now(),
    });

    // Maintain query history size
    if (this.queryHistory.length > this.MAX_QUERY_HISTORY) {
      this.queryHistory = this.queryHistory.slice(-this.MAX_QUERY_HISTORY);
    }

    // Update metrics
    this.updateQueryMetrics(executionTime, success);

    // Check for slow queries
    if (executionTime > this.SLOW_QUERY_THRESHOLD) {
      this.createAlert('slow_query', 'medium', `Slow query detected: ${executionTime}ms`, {
        query: input.queryId,
        executionTime,
        tableName: input.tableName,
        operation: input.operation,
      });
    }
  }

  // Record query execution (original method for backward compatibility)
  recordQuery(query: string, executionTime: number, success: boolean): void {
    this.queryHistory.push({
      query: this.sanitizeQuery(query),
      time: executionTime,
      timestamp: Date.now(),
    });

    // Maintain query history size
    if (this.queryHistory.length > this.MAX_QUERY_HISTORY) {
      this.queryHistory = this.queryHistory.slice(-this.MAX_QUERY_HISTORY);
    }

    // Update metrics
    this.updateQueryMetrics(executionTime, success);

    // Check for slow queries
    if (executionTime > this.SLOW_QUERY_THRESHOLD) {
      this.createAlert('slow_query', 'medium', `Slow query detected: ${executionTime}ms`, {
        query: this.sanitizeQuery(query),
        executionTime,
      });
    }
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data from queries for logging
    return query
      .replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, "'***'") // Replace string literals
      .replace(/\b\d+\b/g, '***') // Replace numbers
      .substring(0, 200); // Limit length
  }

  private updateQueryMetrics(_executionTime: number, success: boolean): void {
    // Update average query time
    const recentQueries = this.queryHistory.slice(-100);
    this.metrics.queryTime = recentQueries.length > 0 ? recentQueries.reduce((sum, q) => sum + q.time, 0) / recentQueries.length : 0;

    // Update error rate
    const recentErrors = this.queryHistory.slice(-100).filter((_, _index) => {
      // This is a simplified error tracking - in production, track actual errors
      return !success;
    }).length;
    this.metrics.errorRate = recentErrors / Math.min(100, this.queryHistory.length);

    // Update throughput (queries per second)
    const oneMinuteAgo = Date.now() - 60000;
    const queriesInLastMinute = this.queryHistory.filter(q => q.timestamp > oneMinuteAgo).length;
    this.metrics.throughput = queriesInLastMinute / 60;

    // Update slow queries count
    this.metrics.slowQueries = this.queryHistory.filter(q => q.time > this.SLOW_QUERY_THRESHOLD).length;
  }

  private collectMetrics(): void {
    // Collect cache hit rate from advanced cache
    // This would integrate with the actual cache system
    // For now, simulate cache metrics
    this.metrics.cacheHitRate = 0.85; // 85% cache hit rate

    // Collect connection pool metrics
    // This would integrate with the connection pool
    this.metrics.connectionPoolUtilization = 0.6; // 60% utilization

    // Collect index usage metrics
    // This would require database introspection
    this.metrics.indexUsage = 0.9; // 90% index usage
  }

  private analyzePerformance(): void {
    // Analyze query patterns and suggest optimizations
    const queryPatterns = this.analyzeQueryPatterns();
    const indexSuggestions = this.suggestIndexes();
    const optimizationSuggestions = this.suggestOptimizations();

    // Log analysis results
    if (process.env['NODE_ENV'] === 'development') {
      console.log('Database Performance Analysis:', {
        queryPatterns,
        indexSuggestions,
        optimizationSuggestions,
      });
    }
  }

  private analyzeQueryPatterns(): any {
    const patterns = {
      mostFrequentTables: this.getMostFrequentTables(),
      averageQueryComplexity: this.calculateQueryComplexity(),
      peakUsageTimes: this.getPeakUsageTimes(),
    };

    return patterns;
  }

  private getMostFrequentTables(): Array<{ table: string; count: number }> {
    const tableCounts = new Map<string, number>();

    this.queryHistory.forEach(({ query }) => {
      const tableMatch = query.match(/from\s+(\w+)/i);
      if (tableMatch && tableMatch[1]) {
        const table = tableMatch[1].toLowerCase();
        tableCounts.set(table, (tableCounts.get(table) || 0) + 1);
      }
    });

    return Array.from(tableCounts.entries())
      .map(([table, count]) => ({ table, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private calculateQueryComplexity(): number {
    let totalComplexity = 0;
    let queryCount = 0;

    this.queryHistory.forEach(({ query }) => {
      let complexity = 1;
      
      // Add complexity for joins
      const joins = (query.match(/join/gi) || []).length;
      complexity += joins * 2;

      // Add complexity for subqueries
      const subqueries = (query.match(/\(select/gi) || []).length;
      complexity += subqueries * 3;

      // Add complexity for aggregations
      const aggregations = (query.match(/\b(count|sum|avg|min|max)\b/gi) || []).length;
      complexity += aggregations;

      totalComplexity += complexity;
      queryCount++;
    });

    return queryCount > 0 ? totalComplexity / queryCount : 0;
  }

  private getPeakUsageTimes(): Array<{ hour: number; queryCount: number }> {
    const hourlyCounts = new Map<number, number>();

    this.queryHistory.forEach(({ timestamp }) => {
      const hour = new Date(timestamp).getHours();
      hourlyCounts.set(hour, (hourlyCounts.get(hour) || 0) + 1);
    });

    return Array.from(hourlyCounts.entries())
      .map(([hour, queryCount]) => ({ hour, queryCount }))
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, 3);
  }

  private suggestIndexes(): string[] {
    const suggestions: string[] = [];
    const tableQueries = this.groupQueriesByTable();

    for (const [table, queries] of tableQueries) {
      const commonFilters = this.getCommonFilters(queries);
      
      commonFilters.forEach((filter) => {
        suggestions.push(`CREATE INDEX CONCURRENTLY idx_${table}_${filter} ON ${table} (${filter});`);
      });
    }

    return suggestions;
  }

  private groupQueriesByTable(): Map<string, string[]> {
    const tableQueries = new Map<string, string[]>();

    this.queryHistory.forEach(({ query }) => {
      const tableMatch = query.match(/from\s+(\w+)/i);
      if (tableMatch && tableMatch[1]) {
        const table = tableMatch[1].toLowerCase();
        if (!tableQueries.has(table)) {
          tableQueries.set(table, []);
        }
        tableQueries.get(table)!.push(query);
      }
    });

    return tableQueries;
  }

  private getCommonFilters(queries: string[]): string[] {
    const filterCounts = new Map<string, number>();

    queries.forEach((query) => {
      const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/i);
      if (whereMatch && whereMatch[1]) {
        const whereClause = whereMatch[1];
        const filters = whereClause.split(/\s+and\s+/i);
        
        filters.forEach((filter) => {
          const columnMatch = filter.match(/(\w+)\s*=/);
          if (columnMatch && columnMatch[1]) {
            const column = columnMatch[1].toLowerCase();
            filterCounts.set(column, (filterCounts.get(column) || 0) + 1);
          }
        });
      }
    });

    // Return filters that appear in more than 50% of queries
    const threshold = queries.length * 0.5;
    return Array.from(filterCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([column]) => column);
  }

  private suggestOptimizations(): string[] {
    const suggestions: string[] = [];

    // Suggest query optimizations based on patterns
    if (this.metrics.queryTime > 500) {
      suggestions.push('Consider adding indexes for frequently filtered columns');
    }

    if (this.metrics.cacheHitRate < 0.8) {
      suggestions.push('Cache hit rate is low, consider increasing cache TTL or cache size');
    }

    if (this.metrics.connectionPoolUtilization > 0.8) {
      suggestions.push('Connection pool utilization is high, consider increasing pool size');
    }

    if (this.metrics.errorRate > this.HIGH_ERROR_RATE_THRESHOLD) {
      suggestions.push('Error rate is high, check query syntax and database constraints');
    }

    return suggestions;
  }

  private generateAlerts(): void {
    // Check for performance issues and generate alerts
    if (this.metrics.errorRate > this.HIGH_ERROR_RATE_THRESHOLD) {
      this.createAlert(
        'high_error_rate',
        'high',
        `High error rate detected: ${(this.metrics.errorRate * 100).toFixed(2)}%`,
        { errorRate: this.metrics.errorRate }
      );
    }

    if (this.metrics.connectionPoolUtilization > 0.9) {
      this.createAlert(
        'connection_exhaustion',
        'critical',
        `Connection pool nearly exhausted: ${(this.metrics.connectionPoolUtilization * 100).toFixed(2)}%`,
        { utilization: this.metrics.connectionPoolUtilization }
      );
    }

    if (this.metrics.cacheHitRate < 0.5) {
      this.createAlert(
        'cache_miss',
        'medium',
        `Low cache hit rate: ${(this.metrics.cacheHitRate * 100).toFixed(2)}%`,
        { hitRate: this.metrics.cacheHitRate }
      );
    }
  }

  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    metadata: any
  ): void {
    // Avoid duplicate alerts
    const recentAlert = this.alerts.find(
      (alert) =>
        alert.type === type &&
        alert.severity === severity &&
        Date.now() - alert.timestamp < 300000 // 5 minutes
    );

    if (!recentAlert) {
      this.alerts.push({
        type,
        severity,
        message,
        timestamp: Date.now(),
        metadata,
      });

      // Keep only recent alerts
      this.alerts = this.alerts.filter((alert) => Date.now() - alert.timestamp < 3600000); // 1 hour

      // Log alert
      console.warn(`Database Performance Alert [${severity.toUpperCase()}]: ${message}`);
    }
  }

  // Get current metrics
  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  // Get recent alerts
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  // Get query performance report
  getPerformanceReport(): {
    summary: DatabaseMetrics;
    topSlowQueries: Array<{ query: string; time: number; timestamp: number }>;
    alerts: PerformanceAlert[];
    recommendations: string[];
  } {
    const topSlowQueries = this.queryHistory
      .filter((q) => q.time > this.SLOW_QUERY_THRESHOLD)
      .sort((a, b) => b.time - a.time)
      .slice(0, 10);

    const recommendations = this.suggestOptimizations();

    return {
      summary: this.metrics,
      topSlowQueries,
      alerts: this.alerts,
      recommendations,
    };
  }

  /**
   * Get enhanced performance summary with detailed metrics
   */
  getEnhancedPerformanceSummary(): DatabasePerformanceSummary {
    if (this.detailedMetrics.length === 0) {
      return {
        totalQueries: 0,
        avgExecutionTime: 0,
        slowQueries: 0,
        cacheHitRate: 0,
        mostExpensiveQueries: [],
        queryDistribution: { select: 0, insert: 0, update: 0, delete: 0 },
        performanceTrend: [],
      };
    }

    const totalQueries = this.detailedMetrics.length;
    const totalExecutionTime = this.detailedMetrics.reduce((sum, m) => sum + m.executionTime, 0);
    const avgExecutionTime = totalExecutionTime / totalQueries;
    
    const slowQueries = this.detailedMetrics.filter(m => m.executionTime > 500).length; // Using 500ms as slow threshold for enhanced metrics
    const cachedQueries = this.detailedMetrics.filter(m => m.cached).length;
    const cacheHitRate = totalQueries > 0 ? (cachedQueries / totalQueries) * 100 : 0;

    // Query distribution
    const queryDistribution = {
      select: this.detailedMetrics.filter(m => m.operation === 'select').length,
      insert: this.detailedMetrics.filter(m => m.operation === 'insert').length,
      update: this.detailedMetrics.filter(m => m.operation === 'update').length,
      delete: this.detailedMetrics.filter(m => m.operation === 'delete').length,
    };

    // Most expensive queries
    const mostExpensiveQueries = [...this.detailedMetrics]
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    // Performance trend (last N queries)
    const performanceTrend = this.detailedMetrics
      .slice(-this.PERFORMANCE_TREND_SIZE)
      .map(m => m.executionTime);

    return {
      totalQueries,
      avgExecutionTime,
      slowQueries,
      cacheHitRate,
      mostExpensiveQueries,
      queryDistribution,
      performanceTrend,
    };
  }

  /**
   * Get optimization recommendations based on detailed metrics
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const summary = this.getEnhancedPerformanceSummary();

    if (summary.avgExecutionTime > 1000) {
      recommendations.push(`Average query time is high (${summary.avgExecutionTime.toFixed(2)}ms). Consider adding indexes.`);
    }

    if (summary.slowQueries > 0) {
      const slowQueryPercent = (summary.slowQueries / summary.totalQueries) * 100;
      recommendations.push(`${summary.slowQueries} queries (${slowQueryPercent.toFixed(2)}%) are taking >500ms. Review these for optimization.`);
    }

    if (summary.cacheHitRate < 50) {
      recommendations.push(`Cache hit rate is low (${summary.cacheHitRate.toFixed(2)}%). Consider optimizing cache strategies.`);
    }

    // Check for specific patterns that might indicate optimization opportunities
    const selectQueries = this.detailedMetrics.filter(m => m.operation === 'select');
    if (selectQueries.length > 0) {
      const avgSelectTime = selectQueries.reduce((sum, q) => sum + q.executionTime, 0) / selectQueries.length;
      if (avgSelectTime > 500) {
        recommendations.push(`SELECT operations are slow (avg ${avgSelectTime.toFixed(2)}ms). Consider adding indexes on frequently queried fields.`);
      }
    }

    return recommendations;
  }

  /**
   * Monitor and optimize query performance in real-time
   */
  async monitorAndOptimizeQuery<T>(
    _client: SupabaseClient,
    tableName: string,
    operation: 'select' | 'insert' | 'update' | 'delete',
    queryExecutor: () => Promise<T>,
    parameters: Record<string, any> = {},
    userId?: string
  ): Promise<T> {
    const startTime = performance.now();
    let error: string | undefined;
    let result: T | null = null;
    let cached = false;

    try {
      result = await queryExecutor();
      // If this is a cached result, set cached flag
      // This would be determined by the caching layer, for now we'll implement it as false
    } catch (err: any) {
      error = err.message || 'Unknown error';
      throw err;
    } finally {
      const endTime = performance.now();
      
      // For now, we'll assume no caching for this implementation
      // In a real implementation, you'd check if the result came from cache
      cached = false;

       this.recordDetailedQuery({
        queryId: `query_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        tableName,
        operation,
        parameters,
        userId,
        startTime,
        endTime,
        resultSize: result !== null && Array.isArray(result) ? result.length : result !== null && typeof result === 'object' ? 1 : 0,
        cached,
        error,
      });
    }

    return result as T;
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      queryTime: 0,
      cacheHitRate: 0,
      connectionPoolUtilization: 0,
      indexUsage: 0,
      slowQueries: 0,
      errorRate: 0,
      throughput: 0,
    };
    this.queryHistory = [];
    this.detailedMetrics = [];
    this.alerts = [];
  }

  // Cleanup
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

export const databasePerformanceMonitor = DatabasePerformanceMonitor.getInstance();
export { DatabasePerformanceMonitor };