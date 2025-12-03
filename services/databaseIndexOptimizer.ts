/**
 * Advanced Database Index Optimization Service
 * Provides intelligent indexing strategies for Supabase/PostgreSQL databases
 */

interface IndexRecommendation {
  tableName: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'brin';
  estimatedPerformanceGain: number;
  queryPatterns: string[];
  createdAt: Date;
}

interface IndexUsageStats {
  indexName: string;
  tableName: string;
  sizeKB: number;
  scans: number;
  tuplesRead: number;
  tuplesFetched: number;
  usageRatio: number;
}

class DatabaseIndexOptimizer {
  private static instance: DatabaseIndexOptimizer;
  private recommendations: IndexRecommendation[] = [];
  private ignoredTables: Set<string> = new Set();
  private readonly COMMON_INDEX_PATTERNS: Array<{
    pattern: string[];
    type: 'btree' | 'hash' | 'gin' | 'gist' | 'brin';
    gain: number;
  }> = [
    // User-based queries
    { pattern: ['user_id'], type: 'btree', gain: 0.7 },
    { pattern: ['user_id', 'created_at'], type: 'btree', gain: 0.8 },
    { pattern: ['user_id', 'strategy_type'], type: 'btree', gain: 0.75 },
    
    // Time-based queries
    { pattern: ['created_at'], type: 'btree', gain: 0.6 },
    { pattern: ['updated_at'], type: 'btree', gain: 0.6 },
    
    // Search queries
    { pattern: ['name'], type: 'btree', gain: 0.5 },
    { pattern: ['description'], type: 'gin', gain: 0.6 }, // For full-text search
    
    // Filter combinations
    { pattern: ['strategy_type', 'is_active'], type: 'btree', gain: 0.7 },
    { pattern: ['is_active', 'created_at'], type: 'btree', gain: 0.75 },
  ];

  private constructor() {
    this.initializeIgnoredTables();
  }

  static getInstance(): DatabaseIndexOptimizer {
    if (!DatabaseIndexOptimizer.instance) {
      DatabaseIndexOptimizer.instance = new DatabaseIndexOptimizer();
    }
    return DatabaseIndexOptimizer.instance;
  }

  private initializeIgnoredTables(): void {
    // Tables that typically don't benefit from additional indexing
    this.ignoredTables.add('auth.users');
    this.ignoredTables.add('auth.sessions');
    this.ignoredTables.add('auth.identities');
  }

  /**
   * Analyze query patterns and suggest optimal indexes
   */
  async analyzeQueryPatterns(queryHistory: Array<{ query: string; executionTime: number; frequency: number }>): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];
    
    // Analyze each query for potential index improvements
    for (const query of queryHistory) {
      const analysis = this.analyzeSingleQuery(query);
      if (analysis) {
        recommendations.push(analysis);
      }
    }
    
    // Deduplicate and sort by estimated gain
    const uniqueRecommendations = this.deduplicateRecommendations(recommendations);
    return uniqueRecommendations.sort((a, b) => b.estimatedPerformanceGain - a.estimatedPerformanceGain);
  }

  private analyzeSingleQuery(query: { query: string; executionTime: number; frequency: number }): IndexRecommendation | null {
    // Extract table name
    const tableMatch = query.query.match(/from\s+["`]?(\w+)["`]?/i);
    if (!tableMatch) return null;
    
    const tableName = tableMatch[1];
    if (this.ignoredTables.has(tableName)) return null;
    
    // Extract WHERE conditions
    const whereMatch = query.query.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/i);
    if (!whereMatch) return null;
    
    const whereClause = whereMatch[1].toLowerCase();
    const conditions = this.extractColumnConditions(whereClause);
    
    if (conditions.length === 0) return null;
    
    // Match against common patterns
    for (const pattern of this.COMMON_INDEX_PATTERNS) {
      if (this.matchesPattern(conditions, pattern.pattern)) {
        const estimatedGain = pattern.gain * (query.frequency / 100) * (query.executionTime / 1000);
        return {
          tableName,
          columns: pattern.pattern,
          type: pattern.type,
          estimatedPerformanceGain: Math.min(estimatedGain, 0.95), // Cap at 95%
          queryPatterns: [query.query.substring(0, 100)],
          createdAt: new Date()
        };
      }
    }
    
    // If no common pattern matched, try to suggest based on conditions
    if (conditions.length > 0) {
      // Prioritize frequently used and slow queries
      const estimatedGain = Math.min((query.frequency * query.executionTime) / 10000, 0.8);
      return {
        tableName,
        columns: conditions,
        type: 'btree' as 'btree' | 'hash' | 'gin' | 'gist' | 'brin', // Default to btree
        estimatedPerformanceGain: estimatedGain,
        queryPatterns: [query.query.substring(0, 100)],
        createdAt: new Date()
      };
    }
    
    return null;
  }

  private extractColumnConditions(whereClause: string): string[] {
    const conditions: string[] = [];
    
    // Match column = value patterns
    const equalityMatches = whereClause.match(/\b(\w+)\s*=\s*[^,\s)]+/g);
    if (equalityMatches) {
      equalityMatches.forEach(match => {
        const columnMatch = match.match(/\b(\w+)\s*=/);
        if (columnMatch && columnMatch[1]) {
          const column = columnMatch[1];
          if (!conditions.includes(column)) {
            conditions.push(column);
          }
        }
      });
    }
    
    // Match column IN (values) patterns
    const inMatches = whereClause.match(/\b(\w+)\s+in\s+\(/g);
    if (inMatches) {
      inMatches.forEach(match => {
        const columnMatch = match.match(/\b(\w+)\s+in/);
        if (columnMatch && columnMatch[1]) {
          const column = columnMatch[1];
          if (!conditions.includes(column)) {
            conditions.push(column);
          }
        }
      });
    }
    
    // Match column comparisons (>, <, >=, <=)
    const comparisonMatches = whereClause.match(/\b(\w+)\s*(>=|<=|>|<)\s*[^,\s)]+/g);
    if (comparisonMatches) {
      comparisonMatches.forEach(match => {
        const columnMatch = match.match(/\b(\w+)\s*(>=|<=|>|<)/);
        if (columnMatch && columnMatch[1]) {
          const column = columnMatch[1];
          if (!conditions.includes(column)) {
            conditions.push(column);
          }
        }
      });
    }
    
    return conditions;
  }

  private matchesPattern(conditions: string[], pattern: string[]): boolean {
    // Check if all pattern columns exist in conditions
    return pattern.every(col => conditions.includes(col));
  }

  private deduplicateRecommendations(recommendations: IndexRecommendation[]): IndexRecommendation[] {
    const uniqueMap = new Map<string, IndexRecommendation>();
    
    for (const rec of recommendations) {
      const key = `${rec.tableName}:${rec.columns.join(',')}:${rec.type}`;
      const existing = uniqueMap.get(key);
      
      if (!existing || rec.estimatedPerformanceGain > existing.estimatedPerformanceGain) {
        uniqueMap.set(key, rec);
      }
    }
    
    return Array.from(uniqueMap.values());
  }

  /**
   * Generate SQL for creating recommended indexes
   */
  generateIndexSQL(recommendations: IndexRecommendation[]): string[] {
    return recommendations.map(rec => {
      const columns = rec.columns.map(col => `"${col}"`).join(', ');
      const indexName = `idx_${rec.tableName}_${rec.columns.join('_')}`;
      
      switch (rec.type) {
        case 'gin':
          return `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "${rec.tableName}" USING GIN (${columns});`;
        case 'gist':
          return `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "${rec.tableName}" USING GIST (${columns});`;
        case 'hash':
          return `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "${rec.tableName}" USING HASH (${columns});`;
        case 'brin':
          return `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "${rec.tableName}" USING BRIN (${columns});`;
        default: // btree
          return `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "${rec.tableName}" (${columns});`;
      }
    });
  }

  /**
   * Analyze existing index usage and performance
   */
  async analyzeIndexUsage(): Promise<IndexUsageStats[]> {
    // This would typically query PostgreSQL's pg_stat_user_indexes
    // For now, we'll return a simulated implementation
    console.log('Index usage analysis would connect to database statistics');
    return [];
  }

  /**
   * Get recommendations for a specific table
   */
  getTableRecommendations(tableName: string): IndexRecommendation[] {
    return this.recommendations.filter(rec => rec.tableName === tableName);
  }

  /**
   * Add custom recommendation
   */
  addRecommendation(recommendation: IndexRecommendation): void {
    this.recommendations.push(recommendation);
  }

  /**
   * Clear all recommendations
   */
  clearRecommendations(): void {
    this.recommendations = [];
  }

  /**
   * Get all current recommendations
   */
  getRecommendations(): IndexRecommendation[] {
    return [...this.recommendations];
  }

  /**
   * Evaluate index effectiveness after implementation
   */
  async evaluateIndexEffectiveness(indexName: string, beforeStats: any, afterStats: any): Promise<number> {
    // Calculate improvement percentage
    const beforeTime = beforeStats.avgExecutionTime || 0;
    const afterTime = afterStats.avgExecutionTime || 0;
    
    if (beforeTime === 0) return 0;
    
    const improvement = ((beforeTime - afterTime) / beforeTime) * 100;
    return Math.max(0, Math.min(100, improvement)); // Clamp between 0 and 100
  }
}

export const databaseIndexOptimizer = DatabaseIndexOptimizer.getInstance();
export type { IndexRecommendation, IndexUsageStats };