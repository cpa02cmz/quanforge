import { SupabaseClient } from '@supabase/supabase-js';

interface IndexRecommendation {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  usageCount: number;
  performanceGain: number;
  queryPattern: string;
}

interface QueryAnalysis {
  query: string;
  executionTime: number;
  resultCount: number;
  suggestedIndex: string;
  improvementPotential: number;
}

class DatabaseIndexOptimizer {
  private static instance: DatabaseIndexOptimizer;
  private indexRecommendations: Map<string, IndexRecommendation> = new Map();
  private queryAnalysisCache: Map<string, QueryAnalysis> = new Map();
  private queryPatternCount: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): DatabaseIndexOptimizer {
    if (!DatabaseIndexOptimizer.instance) {
      DatabaseIndexOptimizer.instance = new DatabaseIndexOptimizer();
    }
    return DatabaseIndexOptimizer.instance;
  }

  /**
   * Analyze query patterns and recommend indexes
   */
  async analyzeQueryPattern(
    client: SupabaseClient,
    tableName: string,
    queryColumns: string[],
    filterColumns: string[],
    orderByColumns: string[]
  ): Promise<IndexRecommendation | null> {
    const patternKey = `${tableName}:${queryColumns.join(',')}:${filterColumns.join(',')}:${orderByColumns.join(',')}`;
    const count = (this.queryPatternCount.get(patternKey) || 0) + 1;
    this.queryPatternCount.set(patternKey, count);

    if (count >= 5) { // Only recommend after seeing pattern 5+ times
      // Determine best index type based on usage pattern
      let indexType: 'btree' | 'hash' | 'gin' | 'gist' = 'btree';
      
      // B-tree is good for most cases, hash for exact matches, gin for full-text
      if (filterColumns.some(col => col.includes('ilike') || col.includes('like'))) {
        indexType = 'gin';
      } else if (filterColumns.length === 1 && orderByColumns.length > 0) {
        indexType = 'btree';
      }

      const recommendation: IndexRecommendation = {
        table: tableName,
        columns: [...new Set([...filterColumns, ...orderByColumns])],
        type: indexType,
        usageCount: count,
        performanceGain: Math.min(80, 10 + count * 5), // Cap at 80% improvement
        queryPattern: patternKey
      };

      this.indexRecommendations.set(patternKey, recommendation);
      return recommendation;
    }

    return null;
  }

  /**
   * Analyze slow queries and suggest optimizations
   */
  async analyzeSlowQuery(
    query: string,
    executionTime: number,
    resultCount: number
  ): Promise<QueryAnalysis> {
    const analysisKey = this.generateQueryHash(query);
    const cached = this.queryAnalysisCache.get(analysisKey);
    
    if (cached) {
      return cached;
    }

    // Analyze query for potential improvements
    const analysis: QueryAnalysis = {
      query,
      executionTime,
      resultCount,
      suggestedIndex: this.generateSuggestedIndex(query),
      improvementPotential: this.calculateImprovementPotential(query, executionTime)
    };

    this.queryAnalysisCache.set(analysisKey, analysis);
    return analysis;
  }

  private generateSuggestedIndex(query: string): string {
    // Extract table and columns from query
    const tableMatch = query.match(/from\s+["']?(\w+)["']?/i);
    if (!tableMatch) return '';

    const tableName = tableMatch[1];
    const columns: string[] = [];

    // Extract WHERE clause columns
    const whereMatch = query.match(/where\s+(.*?)(?:order by|group by|limit|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const columnMatches = whereClause.match(/\b(\w+)\s*[=<>!]/g);
      if (columnMatches) {
        for (const match of columnMatches) {
          const col = match.trim().replace(/[=<>!].*$/, '');
          if (!columns.includes(col)) {
            columns.push(col);
          }
        }
      }
    }

    // Extract ORDER BY columns
    const orderMatch = query.match(/order by\s+([a-zA-Z0-9_,\s]+)/i);
    if (orderMatch) {
      const orderClause = orderMatch[1];
      const orderColumns = orderClause.split(',').map(col => col.trim().split(/\s+/)[0]);
      for (const col of orderColumns) {
        if (!columns.includes(col)) {
          columns.push(col);
        }
      }
    }

    if (columns.length === 0) return '';

    return `CREATE INDEX idx_${tableName}_${columns.join('_')}_btree ON ${tableName} (${columns.join(', ')});`;
  }

  private calculateImprovementPotential(query: string, executionTime: number): number {
    // Based on query complexity and execution time, estimate potential improvement
    const hasOrderBy = /order by/i.test(query);
    const hasWhere = /where/i.test(query);
    const hasJoins = /join/i.test(query);
    
    let basePotential = 0;
    
    if (hasWhere && executionTime > 100) basePotential += 20;
    if (hasOrderBy && executionTime > 100) basePotential += 15;
    if (hasJoins && executionTime > 200) basePotential += 25;
    
    // Cap improvement potential
    return Math.min(70, basePotential);
  }

  private generateQueryHash(query: string): string {
    // Create a simple hash of the query pattern (excluding values)
    const normalized = query
      .toLowerCase()
      .replace(/'.*?'/g, '?')  // Replace string literals
      .replace(/\d+/g, '?')     // Replace numbers
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
    
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Get all index recommendations for a table
   */
  getIndexRecommendationsForTable(tableName: string): IndexRecommendation[] {
    return Array.from(this.indexRecommendations.values())
      .filter(rec => rec.table === tableName)
      .sort((a, b) => b.performanceGain - a.performanceGain);
  }

  /**
   * Get all index recommendations
   */
  getAllIndexRecommendations(): IndexRecommendation[] {
    return Array.from(this.indexRecommendations.values())
      .sort((a, b) => b.performanceGain - a.performanceGain);
  }

  /**
   * Get all query analyses
   */
  getAllQueryAnalyses(): QueryAnalysis[] {
    return Array.from(this.queryAnalysisCache.values())
      .sort((a, b) => b.executionTime - a.executionTime);
  }

  /**
   * Get SQL commands for all recommended indexes
   */
  getRecommendedIndexSQL(): string[] {
    const recommendations = this.getAllIndexRecommendations();
    return recommendations.map(rec => {
      const columns = rec.columns.join(', ');
      return `CREATE INDEX IF NOT EXISTS idx_${rec.table}_${columns.replace(/,/g, '_').replace(/\s/g, '')}_${rec.type} ON ${rec.table} (${columns}) USING ${rec.type};`;
    });
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.indexRecommendations.clear();
    this.queryAnalysisCache.clear();
    this.queryPatternCount.clear();
  }

  /**
   * Get index optimization report
   */
  getOptimizationReport(): {
    totalRecommendations: number;
    totalQueriesAnalyzed: number;
    potentialPerformanceGain: number;
    recommendedIndexes: string[];
    topRecommendations: IndexRecommendation[];
  } {
    const recommendations = this.getAllIndexRecommendations();
    const analyses = this.getAllQueryAnalyses();
    
    const totalPotential = recommendations.reduce((sum, rec) => sum + rec.performanceGain, 0);
    
    return {
      totalRecommendations: recommendations.length,
      totalQueriesAnalyzed: analyses.length,
      potentialPerformanceGain: totalPotential,
      recommendedIndexes: this.getRecommendedIndexSQL(),
      topRecommendations: recommendations.slice(0, 5) // Top 5
    };
  }
}

export const databaseIndexOptimizer = DatabaseIndexOptimizer.getInstance();
export { DatabaseIndexOptimizer };