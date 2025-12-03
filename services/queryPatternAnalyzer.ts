/**
 * Query Pattern Analyzer
 * Analyzes database query patterns and provides optimization recommendations
 */

interface QueryPattern {
  table: string;
  columns: string[];
  filters: string[];
  orderBy: string[];
  executionTime: number;
  callCount: number;
  timestamp: number;
  userId?: string;
}

interface PerformanceRecommendation {
  type: 'index' | 'query' | 'structure' | 'cache';
  table: string;
  columns?: string[];
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  estimatedImprovement: number; // Percentage improvement
}

interface PerformanceMetrics {
  totalQueries: number;
  avgExecutionTime: number;
  slowQueries: number; // Queries > 1000ms
  cacheHitRate: number;
  recommendations: PerformanceRecommendation[];
  queryPatterns: QueryPattern[];
}

class QueryPatternAnalyzer {
  private queryPatterns: QueryPattern[] = [];
  private readonly MAX_PATTERNS = 1000;
  private performanceMetrics: PerformanceMetrics | null = null;

  /**
   * Record query execution details for pattern analysis
   */
  recordQueryExecution(table: string, columns: string[], filters: string[], orderBy: string[], 
                       executionTime: number, userId?: string): void {
    const pattern: QueryPattern = {
      table,
      columns,
      filters,
      orderBy,
      executionTime,
      callCount: 1,
      timestamp: Date.now(),
    };
    
    // Only add userId if it's provided
    if (userId !== undefined) {
      (pattern as any).userId = userId;
    }

    // Check if we already have a similar pattern
    const existingIndex = this.findSimilarPattern(pattern);
    if (existingIndex !== -1) {
      // Update existing pattern
      const existing = this.queryPatterns[existingIndex];
      if (existing) {
        existing.executionTime = (existing.executionTime * existing.callCount + executionTime) / (existing.callCount + 1);
        existing.callCount++;
        existing.timestamp = Date.now(); // Update timestamp to latest
      }
    } else {
      // Add new pattern
      this.queryPatterns.push(pattern);
      
      // Maintain size limit
      if (this.queryPatterns.length > this.MAX_PATTERNS) {
        // Remove oldest patterns
        this.queryPatterns = this.queryPatterns
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, this.MAX_PATTERNS);
      }
    }
  }

  /**
   * Find similar query pattern to avoid duplicates
   */
  private findSimilarPattern(newPattern: QueryPattern): number {
    return this.queryPatterns.findIndex(pattern => 
      pattern.table === newPattern.table &&
      this.arraysEqual(pattern.columns, newPattern.columns) &&
      this.arraysEqual(pattern.filters, newPattern.filters) &&
      this.arraysEqual(pattern.orderBy, newPattern.orderBy)
    );
  }

  /**
   * Helper to compare arrays regardless of order
   */
  private arraysEqual(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) return false;
    
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    
    return sorted1.every((val, idx) => val === sorted2[idx]);
  }

  /**
   * Get performance metrics and recommendations
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const totalQueries = this.queryPatterns.length;
    const avgExecutionTime = totalQueries > 0 
      ? this.queryPatterns.reduce((sum, pattern) => sum + pattern.executionTime, 0) / totalQueries
      : 0;
    const slowQueries = this.queryPatterns.filter(p => p.executionTime > 1000).length;
    
    // For now, return a default cache hit rate - this would be connected to actual cache metrics
    const cacheHitRate = 85; // Default value

    // Generate recommendations based on query patterns
    const recommendations = this.generateRecommendations();

    this.performanceMetrics = {
      totalQueries,
      avgExecutionTime,
      slowQueries,
      cacheHitRate,
      recommendations,
      queryPatterns: [...this.queryPatterns]
    };

    return this.performanceMetrics;
  }

  /**
   * Generate performance recommendations based on query patterns
   */
  private generateRecommendations(): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // Analyze query patterns to recommend indexes
    const frequentPatterns = this.queryPatterns
      .filter(p => p.callCount > 5) // Only consider frequently executed queries
      .sort((a, b) => b.callCount - a.callCount);

    for (const pattern of frequentPatterns) {
      // Check for potential index recommendations
      if (pattern.filters.length > 0) {
        // Look for single column filters that could benefit from indexes
        for (const filter of pattern.filters) {
          // Extract column name from filter (format: "column.operator.value")
          const match = filter.match(/^([^.]+)\./);
          if (match && match[1]) {
            const column = match[1];
            
            // Check if this column is already indexed (simplified check)
            // This would be replaced with actual database index checking in production
            recommendations.push({
              type: 'index',
              table: pattern.table,
              columns: [column],
              recommendation: `Add index on column "${column}" for table "${pattern.table}" to optimize filter operations`,
              impact: pattern.executionTime > 500 ? 'high' : pattern.executionTime > 200 ? 'medium' : 'low',
              estimatedImprovement: pattern.executionTime > 500 ? 70 : pattern.executionTime > 200 ? 50 : 30
            });
          }
        }
      }

      // Check for composite index opportunities
      if (pattern.filters.length > 1 && pattern.callCount > 10) {
        const columns = pattern.filters
          .map(filter => {
            const match = filter.match(/^([^.]+)\./);
            return match ? match[1] : null;
          })
          .filter(Boolean) as string[];

        if (columns.length > 1) {
          recommendations.push({
            type: 'index',
            table: pattern.table,
            columns,
            recommendation: `Add composite index on columns [${columns.join(', ')}] for table "${pattern.table}" to optimize multi-column filter operations`,
            impact: 'medium',
            estimatedImprovement: 40
          });
        }
      }

      // Check for ORDER BY optimization
      if (pattern.orderBy.length > 0) {
        for (const orderByCol of pattern.orderBy) {
          recommendations.push({
            type: 'index',
            table: pattern.table,
            columns: [orderByCol],
            recommendation: `Add index on column "${orderByCol}" for table "${pattern.table}" to optimize ORDER BY operations`,
            impact: 'medium',
            estimatedImprovement: 35
          });
        }
      }
    }

    // Check for query structure improvements
    const highExecutionPatterns = this.queryPatterns.filter(p => p.executionTime > 1000);
    for (const pattern of highExecutionPatterns) {
      recommendations.push({
        type: 'query',
        table: pattern.table,
        recommendation: `Query on table "${pattern.table}" with filters [${pattern.filters.join(', ')}] has high execution time (${pattern.executionTime.toFixed(2)}ms). Consider adding appropriate indexes.`,
        impact: 'high',
        estimatedImprovement: 60
      });
    }

    // Remove duplicates
    return recommendations.filter((rec, index, self) => 
      index === self.findIndex(r => 
        r.recommendation === rec.recommendation
      )
    );
  }

  /**
   * Get slowest queries for deeper analysis
   */
  getSlowestQueries(limit: number = 10): QueryPattern[] {
    return [...this.queryPatterns]
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Get most frequently executed queries
   */
  getFrequentQueries(limit: number = 10): QueryPattern[] {
    return [...this.queryPatterns]
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, limit);
  }

  /**
   * Clear query pattern history
   */
  clearHistory(): void {
    this.queryPatterns = [];
    this.performanceMetrics = null;
  }

  /**
   * Get detailed analysis for a specific table
   */
  getTableAnalysis(table: string): {
    totalQueries: number;
    avgExecutionTime: number;
    topFilters: string[];
    topOrderBy: string[];
    recommendations: PerformanceRecommendation[];
  } {
    const tablePatterns = this.queryPatterns.filter(p => p.table === table);
    
    if (tablePatterns.length === 0) {
      return {
        totalQueries: 0,
        avgExecutionTime: 0,
        topFilters: [],
        topOrderBy: [],
        recommendations: []
      };
    }

    const totalQueries = tablePatterns.length;
    const avgExecutionTime = tablePatterns.reduce((sum, p) => sum + p.executionTime, 0) / totalQueries;
    
    // Get top filters and order by patterns
    const filterCounts: Record<string, number> = {};
    const orderByCounts: Record<string, number> = {};
    
    tablePatterns.forEach(pattern => {
      pattern.filters.forEach(filter => {
        filterCounts[filter] = (filterCounts[filter] || 0) + 1;
      });
      
      pattern.orderBy.forEach(order => {
        orderByCounts[order] = (orderByCounts[order] || 0) + 1;
      });
    });
    
    const topFilters = Object.entries(filterCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([filter]) => filter);
      
    const topOrderBy = Object.entries(orderByCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([order]) => order);

    return {
      totalQueries,
      avgExecutionTime,
      topFilters,
      topOrderBy,
      recommendations: this.performanceMetrics?.recommendations
        .filter(r => r.table === table) || []
    };
  }

  /**
   * Get all query patterns
   */
  getAllQueryPatterns(): QueryPattern[] {
    return [...this.queryPatterns];
  }
}

// Singleton instance
export const queryPatternAnalyzer = new QueryPatternAnalyzer();

// Export the class for potential instantiation with custom config
export { QueryPatternAnalyzer };