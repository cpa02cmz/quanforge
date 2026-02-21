/**
 * Database Index Advisor
 * 
 * Analyzes query patterns, table statistics, and performance metrics
 * to suggest optimal indexes for the database.
 * 
 * @module services/database/indexAdvisor
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { schemaManager, IndexDefinition } from './schemaManager';
import { COUNT_CONSTANTS, SIZE_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('IndexAdvisor');

// ============================================================================
// TYPES
// ============================================================================

export interface IndexRecommendation {
  id: string;
  tableName: string;
  columns: string[];
  indexType: 'btree' | 'hash' | 'gin' | 'gist' | 'partial';
  isUnique: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  estimatedImpact: string;
  createStatement: string;
  relatedQueries: string[];
}

export interface IndexUsageStats {
  indexName: string;
  tableName: string;
  scans: number;
  tuplesRead: number;
  tuplesFetched: number;
  size: number;
  isUnused: boolean;
  usageRatio: number;
}

export interface QueryPattern {
  query: string;
  tableName: string;
  columns: string[];
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  frequency: number;
  avgExecutionTime: number;
  lastExecuted: string;
}

export interface IndexAnalysisResult {
  recommendations: IndexRecommendation[];
  unusedIndexes: IndexUsageStats[];
  duplicateIndexes: Array<{ indexes: string[]; recommendation: string }>;
  performanceScore: number;
}

export interface AdvisorConfig {
  analyzeUnusedThreshold: number;
  analyzeDuplicateColumns: boolean;
  analyzeQueryPatterns: boolean;
  maxRecommendations: number;
  minScanThreshold: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: AdvisorConfig = {
  analyzeUnusedThreshold: 1000, // Indexes with fewer scans are considered unused
  analyzeDuplicateColumns: true,
  analyzeQueryPatterns: true,
  maxRecommendations: 20,
  minScanThreshold: 10,
};

// ============================================================================
// PREDEFINED RECOMMENDATIONS FOR QUANFORGE
// ============================================================================

const PREDEFINED_RECOMMENDATIONS: IndexRecommendation[] = [
  {
    id: 'rec_composite_user_created',
    tableName: 'robots',
    columns: ['user_id', 'created_at'],
    indexType: 'btree',
    isUnique: false,
    priority: 'high',
    reason: 'Composite index for efficient user robot listing with time-based ordering',
    estimatedImpact: '50-70% improvement on user dashboard queries',
    createStatement: 'CREATE INDEX CONCURRENTLY idx_robots_user_created ON robots(user_id, created_at DESC);',
    relatedQueries: ['getRobotsByUser', 'getRobotsPaginated'],
  },
  {
    id: 'rec_composite_strategy_active',
    tableName: 'robots',
    columns: ['strategy_type', 'is_active'],
    indexType: 'partial',
    isUnique: false,
    priority: 'medium',
    reason: 'Partial index for filtering active robots by strategy type',
    estimatedImpact: '30-50% improvement on strategy filter queries',
    createStatement: 'CREATE INDEX CONCURRENTLY idx_robots_strategy_active ON robots(strategy_type) WHERE is_active = true;',
    relatedQueries: ['getRobotsByStrategy', 'filterRobots'],
  },
  {
    id: 'rec_partial_deleted',
    tableName: 'robots',
    columns: ['deleted_at'],
    indexType: 'partial',
    isUnique: false,
    priority: 'medium',
    reason: 'Partial index for soft delete queries to exclude deleted records efficiently',
    estimatedImpact: '20-40% improvement on queries filtering out soft-deleted records',
    createStatement: 'CREATE INDEX CONCURRENTLY idx_robots_not_deleted ON robots(id) WHERE deleted_at IS NULL;',
    relatedQueries: ['getActiveRobots', 'listRobots'],
  },
  {
    id: 'rec_gin_name_search',
    tableName: 'robots',
    columns: ['name'],
    indexType: 'gin',
    isUnique: false,
    priority: 'low',
    reason: 'GIN index for full-text search on robot names',
    estimatedImpact: '60-80% improvement on name search queries',
    createStatement: "CREATE INDEX CONCURRENTLY idx_robots_name_gin ON robots USING gin(to_tsvector('english', name));",
    relatedQueries: ['searchRobots'],
  },
  {
    id: 'rec_composite_active_created',
    tableName: 'robots',
    columns: ['is_active', 'created_at'],
    indexType: 'btree',
    isUnique: false,
    priority: 'high',
    reason: 'Composite index for listing active robots ordered by creation date',
    estimatedImpact: '40-60% improvement on main dashboard queries',
    createStatement: 'CREATE INDEX CONCURRENTLY idx_robots_active_created ON robots(is_active, created_at DESC);',
    relatedQueries: ['getRobotsPaginated', 'listActiveRobots'],
  },
  {
    id: 'rec_jsonb_strategy_params',
    tableName: 'robots',
    columns: ['strategy_params'],
    indexType: 'gin',
    isUnique: false,
    priority: 'low',
    reason: 'GIN index for querying JSONB strategy_params column',
    estimatedImpact: '50-70% improvement on strategy parameter queries',
    createStatement: 'CREATE INDEX CONCURRENTLY idx_robots_strategy_params_gin ON robots USING gin(strategy_params);',
    relatedQueries: ['findByStrategyParams'],
  },
];

// ============================================================================
// INDEX ADVISOR CLASS
// ============================================================================

/**
 * Analyzes database indexes and provides optimization recommendations
 */
export class IndexAdvisor {
  private static instance: IndexAdvisor;
  private config: AdvisorConfig;
  private queryPatterns: Map<string, QueryPattern> = new Map();
  private analysisHistory: Array<{
    timestamp: string;
    result: IndexAnalysisResult;
  }> = [];

  private constructor(config: Partial<AdvisorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<AdvisorConfig>): IndexAdvisor {
    if (!IndexAdvisor.instance) {
      IndexAdvisor.instance = new IndexAdvisor(config);
    }
    return IndexAdvisor.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Run comprehensive index analysis
   */
  async analyzeIndexes(client: SupabaseClient): Promise<IndexAnalysisResult> {
    logger.info('Starting index analysis...');

    const recommendations: IndexRecommendation[] = [];
    const unusedIndexes: IndexUsageStats[] = [];
    const duplicateIndexes: Array<{ indexes: string[]; recommendation: string }> = [];

    try {
      // Get current indexes
      const currentIndexes = await this.getCurrentIndexes(client);

      // Analyze index usage
      const usageStats = await this.getIndexUsageStats(client);
      
      // Find unused indexes
      for (const stat of usageStats) {
        if (stat.isUnused) {
          unusedIndexes.push(stat);
        }
      }

      // Find duplicate indexes
      const duplicates = this.findDuplicateIndexes(currentIndexes);
      duplicateIndexes.push(...duplicates);

      // Generate recommendations based on analysis
      const patternRecommendations = this.analyzeQueryPatterns(currentIndexes);
      recommendations.push(...patternRecommendations);

      // Add predefined recommendations that don't exist yet
      const predefinedRecs = this.filterApplicableRecommendations(
        PREDEFINED_RECOMMENDATIONS,
        currentIndexes
      );
      recommendations.push(...predefinedRecs);

      // Sort by priority
      recommendations.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Limit recommendations
      const limitedRecommendations = recommendations.slice(0, this.config.maxRecommendations);

      // Calculate performance score
      const performanceScore = this.calculatePerformanceScore(
        currentIndexes,
        unusedIndexes,
        limitedRecommendations
      );

      const result: IndexAnalysisResult = {
        recommendations: limitedRecommendations,
        unusedIndexes,
        duplicateIndexes,
        performanceScore,
      };

      // Store analysis history
      this.analysisHistory.push({
        timestamp: new Date().toISOString(),
        result,
      });

      // Keep history bounded
      if (this.analysisHistory.length > COUNT_CONSTANTS.HISTORY.LARGE) {
        this.analysisHistory.shift();
      }

      logger.info(`Index analysis complete. Score: ${performanceScore}, Recommendations: ${limitedRecommendations.length}`);

      return result;
    } catch (error) {
      logger.error('Index analysis failed:', error);
      return {
        recommendations: PREDEFINED_RECOMMENDATIONS.slice(0, 5),
        unusedIndexes: [],
        duplicateIndexes: [],
        performanceScore: 0,
      };
    }
  }

  /**
   * Get current indexes for all tables
   */
  async getCurrentIndexes(client: SupabaseClient): Promise<Map<string, IndexDefinition[]>> {
    const indexes = new Map<string, IndexDefinition[]>();

    try {
      const tables = await schemaManager.getAllTables(client);

      for (const table of tables) {
        const tableIndexes = await schemaManager.getIndexes(client, table);
        indexes.set(table, tableIndexes);
      }
    } catch (error) {
      logger.error('Failed to get current indexes:', error);
    }

    return indexes;
  }

  /**
   * Get index usage statistics
   */
  async getIndexUsageStats(client: SupabaseClient): Promise<IndexUsageStats[]> {
    const stats: IndexUsageStats[] = [];

    try {
      // Try to get index statistics from pg_stat_user_indexes
      const { data, error } = await client.rpc('get_index_usage_stats');

      if (error || !data) {
        // Return empty stats if RPC not available
        return [];
      }

      for (const row of data) {
        stats.push({
          indexName: String(row.indexrelname),
          tableName: String(row.relname),
          scans: Number(row.idx_scan) || 0,
          tuplesRead: Number(row.idx_tup_read) || 0,
          tuplesFetched: Number(row.idx_tup_fetch) || 0,
          size: Number(row.index_size) || 0,
          isUnused: Number(row.idx_scan) < this.config.analyzeUnusedThreshold,
          usageRatio: Number(row.idx_scan) > 0 
            ? Number(row.idx_tup_fetch) / Number(row.idx_scan) 
            : 0,
        });
      }
    } catch (error) {
      logger.debug('Could not get index usage stats:', error);
    }

    return stats;
  }

  /**
   * Record a query pattern for analysis
   */
  recordQueryPattern(
    query: string,
    tableName: string,
    columns: string[],
    operation: QueryPattern['operation'],
    executionTime: number
  ): void {
    const key = `${tableName}:${columns.sort().join(',')}`;
    const existing = this.queryPatterns.get(key);

    if (existing) {
      existing.frequency++;
      existing.avgExecutionTime = (existing.avgExecutionTime + executionTime) / 2;
      existing.lastExecuted = new Date().toISOString();
    } else {
      this.queryPatterns.set(key, {
        query,
        tableName,
        columns,
        operation,
        frequency: 1,
        avgExecutionTime: executionTime,
        lastExecuted: new Date().toISOString(),
      });
    }
  }

  /**
   * Get analysis history
   */
  getAnalysisHistory(): Array<{ timestamp: string; result: IndexAnalysisResult }> {
    return [...this.analysisHistory];
  }

  /**
   * Get recorded query patterns
   */
  getQueryPatterns(): QueryPattern[] {
    return Array.from(this.queryPatterns.values());
  }

  /**
   * Generate CREATE INDEX statements for recommendations
   */
  generateMigrationScript(recommendations: IndexRecommendation[]): string {
    const statements: string[] = [
      '-- Index Optimization Migration',
      '-- Generated by Database Index Advisor',
      `-- Date: ${new Date().toISOString()}`,
      '',
      '-- Begin transaction',
      'BEGIN;',
      '',
    ];

    for (const rec of recommendations) {
      statements.push(`-- ${rec.reason}`);
      statements.push(`-- Priority: ${rec.priority}`);
      statements.push(`-- Estimated Impact: ${rec.estimatedImpact}`);
      statements.push(rec.createStatement);
      statements.push('');
    }

    statements.push('-- Commit transaction');
    statements.push('COMMIT;');

    return statements.join('\n');
  }

  /**
   * Generate DROP INDEX statements for unused indexes
   */
  generateDropScript(unusedIndexes: IndexUsageStats[]): string {
    const statements: string[] = [
      '-- Unused Index Cleanup Migration',
      '-- Generated by Database Index Advisor',
      `-- Date: ${new Date().toISOString()}`,
      '',
      '-- WARNING: Review these indexes before dropping',
      '-- Some indexes may be used for constraints or rarely-run queries',
      '',
    ];

    for (const idx of unusedIndexes) {
      statements.push(`-- Index: ${idx.indexName} on ${idx.tableName}`);
      statements.push(`-- Scans: ${idx.scans}, Size: ${idx.size} bytes`);
      statements.push(`DROP INDEX CONCURRENTLY IF EXISTS ${idx.indexName};`);
      statements.push('');
    }

    return statements.join('\n');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private analyzeQueryPatterns(currentIndexes: Map<string, IndexDefinition[]>): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    for (const [_key, pattern] of this.queryPatterns) {
      // Check if columns are already indexed
      const tableIndexes = currentIndexes.get(pattern.tableName) || [];
      const indexedColumns = new Set(
        tableIndexes.flatMap((idx) => idx.columns)
      );

      // Find columns without indexes
      const unindexedColumns = pattern.columns.filter((col) => !indexedColumns.has(col));

      if (unindexedColumns.length > 0 && pattern.frequency > this.config.minScanThreshold) {
        const priority = this.determinePriority(pattern);
        
        recommendations.push({
          id: `rec_pattern_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          tableName: pattern.tableName,
          columns: unindexedColumns,
          indexType: 'btree',
          isUnique: false,
          priority,
          reason: `Frequently queried columns (${pattern.frequency} times) without index support`,
          estimatedImpact: `${30 + pattern.frequency * 2}% improvement on this query pattern`,
          createStatement: `CREATE INDEX CONCURRENTLY idx_${pattern.tableName}_${unindexedColumns.join('_')} ON ${pattern.tableName}(${unindexedColumns.join(', ')});`,
          relatedQueries: [pattern.query.substring(0, SIZE_CONSTANTS.STRING.SMALL)],
        });
      }
    }

    return recommendations;
  }

  private filterApplicableRecommendations(
    recommendations: IndexRecommendation[],
    currentIndexes: Map<string, IndexDefinition[]>
  ): IndexRecommendation[] {
    const applicable: IndexRecommendation[] = [];

    for (const rec of recommendations) {
      const tableIndexes = currentIndexes.get(rec.tableName) || [];
      const indexExists = tableIndexes.some((idx) => {
        // Check if similar index already exists
        const sameColumns = idx.columns.length === rec.columns.length &&
          rec.columns.every((col) => idx.columns.includes(col));
        return sameColumns;
      });

      if (!indexExists) {
        applicable.push(rec);
      }
    }

    return applicable;
  }

  private findDuplicateIndexes(
    currentIndexes: Map<string, IndexDefinition[]>
  ): Array<{ indexes: string[]; recommendation: string }> {
    const duplicates: Array<{ indexes: string[]; recommendation: string }> = [];

    for (const [tableName, indexes] of currentIndexes) {
      // Group indexes by their first column
      const byFirstColumn = new Map<string, string[]>();

      for (const idx of indexes) {
        if (idx.columns.length > 0) {
          const firstCol = idx.columns[0];
          if (!byFirstColumn.has(firstCol)) {
            byFirstColumn.set(firstCol, []);
          }
          byFirstColumn.get(firstCol)!.push(idx.name);
        }
      }

      // Find potential duplicates
      for (const [_col, indexNames] of byFirstColumn) {
        if (indexNames.length > 1) {
          duplicates.push({
            indexes: indexNames,
            recommendation: `Consider consolidating indexes ${indexNames.join(', ')} on table ${tableName}`,
          });
        }
      }
    }

    return duplicates;
  }

  private determinePriority(pattern: QueryPattern): IndexRecommendation['priority'] {
    if (pattern.frequency > 1000 || pattern.avgExecutionTime > 1000) {
      return 'critical';
    }
    if (pattern.frequency > 100 || pattern.avgExecutionTime > 500) {
      return 'high';
    }
    if (pattern.frequency > 10 || pattern.avgExecutionTime > 100) {
      return 'medium';
    }
    return 'low';
  }

  private calculatePerformanceScore(
    currentIndexes: Map<string, IndexDefinition[]>,
    unusedIndexes: IndexUsageStats[],
    recommendations: IndexRecommendation[]
  ): number {
    let score = 100;

    // Deduct for unused indexes
    score -= unusedIndexes.length * 5;

    // Deduct for missing critical recommendations
    const criticalCount = recommendations.filter((r) => r.priority === 'critical').length;
    score -= criticalCount * 15;

    // Deduct for missing high priority recommendations
    const highCount = recommendations.filter((r) => r.priority === 'high').length;
    score -= highCount * 8;

    // Deduct for missing medium priority recommendations
    const mediumCount = recommendations.filter((r) => r.priority === 'medium').length;
    score -= mediumCount * 3;

    // Bonus for having good index coverage
    const totalIndexes = Array.from(currentIndexes.values()).flat().length;
    if (totalIndexes > 0 && recommendations.length < totalIndexes / 2) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const indexAdvisor = IndexAdvisor.getInstance();
