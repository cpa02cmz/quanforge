/**
 * Database Performance Monitor
 * Monitors and optimizes database performance for Supabase integration
 */

interface DatabaseMetrics {
  queryTime: number;
  cacheHitRate: number;
  connectionPoolUtilization: number;
  indexUsage: number;
  slowQueries: number;
  errorRate: number;
  throughput: number;
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
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly HIGH_ERROR_RATE_THRESHOLD = 0.05; // 5%
  private readonly MAX_QUERY_HISTORY = 1000;

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

  // Record query execution
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
     detailedAnalysis: {
       queryPatternAnalysis: any;
       indexSuggestions: string[];
       optimizationOpportunities: string[];
     };
   } {
     const topSlowQueries = this.queryHistory
       .filter((q) => q.time > this.SLOW_QUERY_THRESHOLD)
       .sort((a, b) => b.time - a.time)
       .slice(0, 10);

     const recommendations = this.suggestOptimizations();
     
     // Generate detailed analysis
     const detailedAnalysis = {
       queryPatternAnalysis: this.analyzeQueryPatterns(),
       indexSuggestions: this.suggestIndexes(),
       optimizationOpportunities: this.suggestOptimizations()
     };

     return {
       summary: this.metrics,
       topSlowQueries,
       alerts: this.alerts,
       recommendations,
       detailedAnalysis
     };
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
     this.alerts = [];
   }
   
   /**
    * Get comprehensive performance trends
    */
   getPerformanceTrends(hours: number = 24): {
     queryTimeTrend: Array<{ timestamp: number; avgTime: number }>;
     throughputTrend: Array<{ timestamp: number; throughput: number }>;
     errorRateTrend: Array<{ timestamp: number; errorRate: number }>;
     cacheHitTrend: Array<{ timestamp: number; cacheHitRate: number }>;
   } {
     const now = Date.now();
     const startTime = now - (hours * 60 * 60 * 1000);
     
     // Group queries by time window to calculate trends
     const timeWindows: Map<number, Array<{ time: number; timestamp: number }>> = new Map();
     const windowSize = 3600000; // 1 hour in ms
     
     this.queryHistory
       .filter(q => q.timestamp >= startTime)
       .forEach(q => {
         const windowStart = Math.floor(q.timestamp / windowSize) * windowSize;
         if (!timeWindows.has(windowStart)) {
           timeWindows.set(windowStart, []);
         }
         timeWindows.get(windowStart)!.push(q);
       });
       
     // Calculate trends for each time window
     const sortedWindows = Array.from(timeWindows.entries()).sort(([a], [b]) => a - b);
     
     const queryTimeTrend = sortedWindows.map(([timestamp, windowQueries]) => ({
       timestamp,
       avgTime: windowQueries.reduce((sum, q) => sum + q.time, 0) / windowQueries.length
     }));
     
     const throughputTrend = sortedWindows.map(([timestamp, windowQueries]) => ({
       timestamp,
       throughput: windowQueries.length // Number of queries per hour
     }));
     
     // Calculate error rate trend - for this implementation we'll assume all recorded queries succeeded
     // In a real implementation, we'd track errors separately
     const errorRateTrend = sortedWindows.map(([timestamp]) => ({
       timestamp,
       errorRate: 0 // Placeholder - would need actual error data
     }));
     
     // Calculate cache hit trend - placeholder for now
     const cacheHitTrend = sortedWindows.map(([timestamp]) => ({
       timestamp,
       cacheHitRate: this.metrics.cacheHitRate // Use overall rate as placeholder
     }));
     
     return {
       queryTimeTrend,
       throughputTrend,
       errorRateTrend,
       cacheHitTrend
     };
   }
   
   /**
    * Get performance impact analysis
    */
   getPerformanceImpactAnalysis(): {
     potentialSavings: {
       timeSavedMs: number;
       queriesOptimized: number;
       estimatedCostReduction: number; // Placeholder for cost estimation
     };
     bottleneckAnalysis: Array<{
       category: 'query' | 'connection' | 'cache' | 'index';
       severity: 'low' | 'medium' | 'high';
       impact: number; // 0-100 percentage
       recommendation: string;
     }>;
   } {
     const bottleneckAnalysis = [];
     
     // Query time bottleneck
     if (this.metrics.queryTime > 500) {
       bottleneckAnalysis.push({
         category: 'query' as const,
         severity: 'high' as const,
         impact: 80,
         recommendation: 'Implement query optimization and indexing strategies'
       });
     } else if (this.metrics.queryTime > 200) {
       bottleneckAnalysis.push({
         category: 'query' as const,
         severity: 'medium' as const,
         impact: 50,
         recommendation: 'Review slow queries and add appropriate indexes'
       });
     }
     
     // Cache bottleneck
     if (this.metrics.cacheHitRate < 50) {
       bottleneckAnalysis.push({
         category: 'cache' as const,
         severity: 'high' as const,
         impact: 70,
         recommendation: 'Improve caching strategy to reduce database load'
       });
     } else if (this.metrics.cacheHitRate < 70) {
       bottleneckAnalysis.push({
         category: 'cache' as const,
         severity: 'medium' as const,
         impact: 40,
         recommendation: 'Optimize cache hit rate through better TTL settings'
       });
     }
     
     // Connection pool bottleneck
     if (this.metrics.connectionPoolUtilization > 0.85) {
       bottleneckAnalysis.push({
         category: 'connection' as const,
         severity: 'high' as const,
         impact: 60,
         recommendation: 'Increase connection pool size or optimize query patterns'
       });
     } else if (this.metrics.connectionPoolUtilization > 0.7) {
       bottleneckAnalysis.push({
         category: 'connection' as const,
         severity: 'medium' as const,
         impact: 30,
         recommendation: 'Monitor connection usage and consider pool size adjustment'
       });
     }
     
     // Index usage bottleneck (placeholder - would need actual index stats)
     if (this.metrics.indexUsage < 0.5) {
       bottleneckAnalysis.push({
         category: 'index' as const,
         severity: 'high' as const,
         impact: 75,
         recommendation: 'Implement missing database indexes for common query patterns'
       });
     }
     
     // Calculate potential savings
     const slowQueryCount = this.queryHistory.filter(q => q.time > this.SLOW_QUERY_THRESHOLD).length;
     const avgSlowQueryTime = slowQueryCount > 0 
       ? this.queryHistory.filter(q => q.time > this.SLOW_QUERY_THRESHOLD).reduce((sum, q) => sum + q.time, 0) / slowQueryCount 
       : 0;
       
     const potentialSavings = {
       timeSavedMs: slowQueryCount * (avgSlowQueryTime - 100), // Assuming 100ms as optimized time
       queriesOptimized: slowQueryCount,
       estimatedCostReduction: slowQueryCount * 0.001 // Placeholder cost estimation
     };
     
     return {
       potentialSavings,
       bottleneckAnalysis
     };
   }
   
   /**
    * Export performance data for analysis
    */
   exportPerformanceData(): string {
     const report = {
       timestamp: new Date().toISOString(),
       metrics: this.metrics,
       queryCount: this.queryHistory.length,
       alertCount: this.alerts.length,
       topSlowQueries: this.queryHistory
         .sort((a, b) => b.time - a.time)
         .slice(0, 10)
         .map(q => ({ query: q.query, time: q.time, timestamp: new Date(q.timestamp).toISOString() })),
       trends: this.getPerformanceTrends(24),
       analysis: this.getPerformanceImpactAnalysis()
     };
     
     return JSON.stringify(report, null, 2);
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