/**
 * Database Index Optimizer
 * Provides advanced indexing strategies and optimization recommendations for Supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface IndexRecommendation {
  tableName: string;
  columns: string[];
  type: 'btree' | 'gin' | 'hash' | 'fulltext';
  recommendation: string;
  estimatedPerformanceGain: number; // Percentage improvement
  queryPatterns: string[];
}

interface IndexUsageStats {
  indexName: string;
  tableName: string;
  columns: string[];
  usageCount: number;
  lastUsed: Date;
  selectivity: number; // How selective the index is (0-1)
}

class DatabaseIndexOptimizer {
  private static instance: DatabaseIndexOptimizer;
  private indexRecommendations: IndexRecommendation[] = [];
  private indexUsageStats: Map<string, IndexUsageStats> = new Map();
  
  private constructor() {
    this.initializeDefaultRecommendations();
  }
  
  static getInstance(): DatabaseIndexOptimizer {
    if (!DatabaseIndexOptimizer.instance) {
      DatabaseIndexOptimizer.instance = new DatabaseIndexOptimizer();
    }
    return DatabaseIndexOptimizer.instance;
  }
  
  private initializeDefaultRecommendations(): void {
    // Default recommendations based on common query patterns
    this.indexRecommendations = [
      {
        tableName: 'robots',
        columns: ['user_id'],
        type: 'btree',
        recommendation: 'CREATE INDEX CONCURRENTLY idx_robots_user_id ON robots(user_id);',
        estimatedPerformanceGain: 45,
        queryPatterns: ['SELECT * FROM robots WHERE user_id = ?', 'SELECT * FROM robots WHERE user_id IN (?)']
      },
      {
        tableName: 'robots',
        columns: ['strategy_type'],
        type: 'btree',
        recommendation: 'CREATE INDEX CONCURRENTLY idx_robots_strategy_type ON robots(strategy_type);',
        estimatedPerformanceGain: 35,
        queryPatterns: ['SELECT * FROM robots WHERE strategy_type = ?', 'SELECT COUNT(*) FROM robots WHERE strategy_type = ?']
      },
      {
        tableName: 'robots',
        columns: ['created_at'],
        type: 'btree',
        recommendation: 'CREATE INDEX CONCURRENTLY idx_robots_created_at_desc ON robots(created_at DESC);',
        estimatedPerformanceGain: 40,
        queryPatterns: ['SELECT * FROM robots ORDER BY created_at DESC LIMIT ?', 'SELECT * FROM robots WHERE created_at > ?']
      },
      {
        tableName: 'robots',
        columns: ['user_id', 'strategy_type'],
        type: 'btree',
        recommendation: 'CREATE INDEX CONCURRENTLY idx_robots_user_strategy ON robots(user_id, strategy_type);',
        estimatedPerformanceGain: 60,
        queryPatterns: ['SELECT * FROM robots WHERE user_id = ? AND strategy_type = ?']
      },
      {
        tableName: 'robots',
        columns: ['user_id', 'created_at'],
        type: 'btree',
        recommendation: 'CREATE INDEX CONCURRENTLY idx_robots_user_created ON robots(user_id, created_at DESC);',
        estimatedPerformanceGain: 55,
        queryPatterns: ['SELECT * FROM robots WHERE user_id = ? ORDER BY created_at DESC']
      },
      {
        tableName: 'robots',
        columns: ['search_vector'],
        type: 'fulltext',
        recommendation: 'CREATE INDEX CONCURRENTLY idx_robots_search_vector_gin ON robots USING GIN(search_vector);',
        estimatedPerformanceGain: 70,
        queryPatterns: ['SELECT * FROM robots WHERE search_vector @@ plainto_tsquery(?)', 'SELECT * FROM robots WHERE search_vector @@ to_tsquery(?)']
      }
    ];
  }
  
  /**
   * Analyze the database and recommend indexes based on query patterns
   */
  async analyzeDatabaseIndexes(client: SupabaseClient): Promise<IndexRecommendation[]> {
    try {
      // Get existing indexes
      const { data: existingIndexes, error: indexesError } = await client
        .from('information_schema.statistics')
        .select('index_name, table_name, column_name')
        .eq('table_schema', 'public');
        
      if (indexesError) {
        console.warn('Could not fetch existing indexes:', indexesError);
        // Return default recommendations if we can't get existing indexes
        return this.indexRecommendations;
      }
      
      // Filter out already existing indexes from recommendations
      const existingIndexMap = new Map<string, string[]>();
      if (existingIndexes) {
        for (const index of existingIndexes) {
          if (!existingIndexMap.has(index.table_name)) {
            existingIndexMap.set(index.table_name, []);
          }
          existingIndexMap.get(index.table_name)!.push(index.column_name);
        }
      }
      
      // Return only recommendations for indexes that don't exist
      return this.indexRecommendations.filter(rec => {
        const existingCols = existingIndexMap.get(rec.tableName) || [];
        // Check if all required columns for this index are already indexed
        return !rec.columns.every(col => existingCols.includes(col));
      });
    } catch (error) {
      console.error('Error analyzing database indexes:', error);
      // Return default recommendations if analysis fails
      return this.indexRecommendations;
    }
  }
  
  /**
   * Get recommendations for specific table
   */
  getTableRecommendations(tableName: string): IndexRecommendation[] {
    return this.indexRecommendations.filter(rec => rec.tableName === tableName);
  }
  
  /**
   * Get recommendations for text search optimization
   */
  getTextSearchRecommendations(): IndexRecommendation[] {
    return this.indexRecommendations.filter(rec => rec.type === 'fulltext');
  }
  
  /**
   * Execute index creation (should be done carefully in production)
   */
  async createRecommendedIndexes(client: SupabaseClient, recommendations: IndexRecommendation[]): Promise<{ 
    success: boolean; 
    created: string[]; 
    errors: string[] 
  }> {
    const created: string[] = [];
    const errors: string[] = [];
    
    for (const recommendation of recommendations) {
      try {
        // Execute the index creation as raw SQL
        await client.rpc('exec_sql', { 
          sql: recommendation.recommendation 
        }).select('*');
        
        created.push(recommendation.recommendation);
        console.log(`Created index: ${recommendation.recommendation}`);
      } catch (error: any) {
        console.error(`Failed to create index: ${recommendation.recommendation}`, error);
        errors.push(`${recommendation.recommendation}: ${error.message}`);
      }
    }
    
    return {
      success: errors.length === 0,
      created,
      errors
    };
  }
  
  /**
   * Get index usage statistics (if available)
   */
  async getIndexUsageStats(client: SupabaseClient): Promise<IndexUsageStats[]> {
    try {
      // Try to get index usage stats from pg_stat_user_indexes if available
      const { data: indexStats, error: statsError } = await client
        .rpc('pg_stat_get_inspect', {})
        .select('*');
        
      if (statsError) {
        console.warn('Could not fetch index usage stats:', statsError);
        return Array.from(this.indexUsageStats.values());
      }
      
      return indexStats || [];
    } catch (error) {
      console.warn('Could not fetch index usage statistics:', error);
      return Array.from(this.indexUsageStats.values());
    }
  }
  
  /**
   * Update index usage for performance tracking
   */
  updateIndexUsage(indexName: string, tableName: string, columns: string[]): void {
    const key = `${tableName}_${columns.join('_')}`;
    const existing = this.indexUsageStats.get(key);
    
    if (existing) {
      existing.usageCount++;
      existing.lastUsed = new Date();
    } else {
      this.indexUsageStats.set(key, {
        indexName,
        tableName,
        columns,
        usageCount: 1,
        lastUsed: new Date(),
        selectivity: 0.5 // Default assumption
      });
    }
  }
  
  /**
   * Get comprehensive index optimization report
   */
  async getOptimizationReport(client: SupabaseClient): Promise<{
    currentRecommendations: IndexRecommendation[];
    usageStats: IndexUsageStats[];
    performanceImpact: number; // Estimated overall performance improvement
    implementationPriority: IndexRecommendation[];
  }> {
    const recommendations = await this.analyzeDatabaseIndexes(client);
    const usageStats = await this.getIndexUsageStats(client);
    
    // Calculate estimated performance impact
    const performanceImpact = recommendations.reduce(
      (sum, rec) => sum + rec.estimatedPerformanceGain, 
      0
    );
    
    // Sort recommendations by priority (estimated performance gain)
    const implementationPriority = [...recommendations].sort(
      (a, b) => b.estimatedPerformanceGain - a.estimatedPerformanceGain
    );
    
    return {
      currentRecommendations: recommendations,
      usageStats,
      performanceImpact,
      implementationPriority
    };
  }
  
  /**
   * Get index recommendations optimized for specific query patterns
   */
  getQueryBasedRecommendations(queryPatterns: string[]): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];
    
    for (const pattern of queryPatterns) {
      // Analyze query pattern and match with appropriate index
      if (pattern.includes('WHERE user_id')) {
        const userIndex = this.indexRecommendations.find(
          rec => rec.tableName === 'robots' && rec.columns.includes('user_id')
        );
        if (userIndex && !recommendations.some(r => r.recommendation === userIndex.recommendation)) {
          recommendations.push(userIndex);
        }
      }
      
      if (pattern.includes('WHERE strategy_type')) {
        const strategyIndex = this.indexRecommendations.find(
          rec => rec.tableName === 'robots' && rec.columns.includes('strategy_type')
        );
        if (strategyIndex && !recommendations.some(r => r.recommendation === strategyIndex.recommendation)) {
          recommendations.push(strategyIndex);
        }
      }
      
      if (pattern.includes('ORDER BY created_at') || pattern.includes('WHERE created_at')) {
        const dateIndex = this.indexRecommendations.find(
          rec => rec.tableName === 'robots' && rec.columns.includes('created_at')
        );
        if (dateIndex && !recommendations.some(r => r.recommendation === dateIndex.recommendation)) {
          recommendations.push(dateIndex);
        }
      }
      
      if (pattern.includes('search_vector') || pattern.includes('tsvector')) {
        const searchIndex = this.getTextSearchRecommendations();
        searchIndex.forEach(index => {
          if (!recommendations.some(r => r.recommendation === index.recommendation)) {
            recommendations.push(index);
          }
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Get SQL commands for all recommended indexes
   */
  getAllIndexCommands(): string[] {
    return this.indexRecommendations.map(rec => rec.recommendation);
  }
}

export const databaseIndexOptimizer = DatabaseIndexOptimizer.getInstance();
export { DatabaseIndexOptimizer };