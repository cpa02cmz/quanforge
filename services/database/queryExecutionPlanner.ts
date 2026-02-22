/**
 * Query Execution Planner
 * 
 * Intelligent query planning with cost estimation, optimization suggestions,
 * and execution strategy selection.
 * 
 * Features:
 * - Query cost estimation
 * - Execution plan generation
 * - Optimization recommendations
 * - Adaptive plan selection
 * - Historical plan learning
 * 
 * @module services/database/queryExecutionPlanner
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../modularConstants';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('QueryExecutionPlanner');

// ============================================================================
// TYPES
// ============================================================================

export type ExecutionStrategy = 'sequential' | 'parallel' | 'batched' | 'cached';
export type OptimizationLevel = 'none' | 'basic' | 'aggressive' | 'maximum';
export type QueryComplexity = 'simple' | 'moderate' | 'complex' | 'very_complex';

export interface QueryPlan {
  id: string;
  sql: string;
  normalizedSql: string;
  strategy: ExecutionStrategy;
  complexity: QueryComplexity;
  estimatedCost: number;
  estimatedRows: number;
  estimatedDurationMs: number;
  optimizations: OptimizationSuggestion[];
  dependencies: string[];
  createdAt: number;
}

export interface ExecutionStep {
  id: string;
  type: 'scan' | 'join' | 'filter' | 'sort' | 'aggregate' | 'limit';
  table?: string;
  index?: string;
  estimatedRows: number;
  estimatedCost: number;
  children: ExecutionStep[];
}

export interface OptimizationSuggestion {
  type: 'index' | 'rewrite' | 'cache' | 'partition' | 'denormalize' | 'materialize';
  description: string;
  impact: 'low' | 'medium' | 'high';
  estimatedImprovement: number;
  sql?: string;
}

export interface PlanStatistics {
  totalPlans: number;
  averageCost: number;
  averageDuration: number;
  cacheHits: number;
  cacheMisses: number;
  optimizationsApplied: number;
  strategiesUsed: Record<ExecutionStrategy, number>;
}

export interface PlannerConfig {
  enabled: boolean;
  optimizationLevel: OptimizationLevel;
  costThreshold: number;
  enableCaching: boolean;
  enableLearning: boolean;
  maxPlanCacheSize: number;
  parallelThreshold: number;
  batchSize: number;
}

export interface QueryFeatures {
  hasJoin: boolean;
  hasSubquery: boolean;
  hasAggregate: boolean;
  hasGroupBy: boolean;
  hasOrderBy: boolean;
  hasLimit: boolean;
  hasWhere: boolean;
  tableCount: number;
  estimatedResultSize: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: PlannerConfig = {
  enabled: true,
  optimizationLevel: 'aggressive',
  costThreshold: 1000,
  enableCaching: true,
  enableLearning: true,
  maxPlanCacheSize: 500,
  parallelThreshold: 10000,
  batchSize: 100,
};

// ============================================================================
// QUERY EXECUTION PLANNER CLASS
// ============================================================================

/**
 * Plans and optimizes query execution strategies
 */
export class QueryExecutionPlanner {
  private static instance: QueryExecutionPlanner;
  private config: PlannerConfig;
  private planCache: Map<string, QueryPlan> = new Map();
  private executionHistory: Map<string, { planned: number; actual: number; count: number }> = new Map();
  private stats: PlanStatistics = {
    totalPlans: 0,
    averageCost: 0,
    averageDuration: 0,
    cacheHits: 0,
    cacheMisses: 0,
    optimizationsApplied: 0,
    strategiesUsed: { sequential: 0, parallel: 0, batched: 0, cached: 0 },
  };
  private totalCost = 0;
  private totalDuration = 0;
  private isInitialized = false;

  private constructor(config: Partial<PlannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<PlannerConfig>): QueryExecutionPlanner {
    if (!QueryExecutionPlanner.instance) {
      QueryExecutionPlanner.instance = new QueryExecutionPlanner(config);
    }
    return QueryExecutionPlanner.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the query execution planner
   */
  initialize(): void {
    if (this.isInitialized) return;

    this.isInitialized = true;
    logger.log('Query execution planner initialized', {
      optimizationLevel: this.config.optimizationLevel,
      caching: this.config.enableCaching,
    });
  }

  /**
   * Shutdown the query execution planner
   */
  shutdown(): void {
    this.planCache.clear();
    this.executionHistory.clear();
    this.isInitialized = false;
    logger.log('Query execution planner shutdown');
  }

  /**
   * Create an execution plan for a query
   */
  createPlan(sql: string, params?: unknown[]): QueryPlan {
    if (!this.config.enabled) {
      return this.createDefaultPlan(sql);
    }

    const normalizedSql = this.normalizeSql(sql);
    const cacheKey = this.generateCacheKey(normalizedSql, params);

    // Check cache first
    if (this.config.enableCaching && this.planCache.has(cacheKey)) {
      this.stats.cacheHits++;
      const cached = this.planCache.get(cacheKey)!;
      return { ...cached, id: this.generateId() };
    }

    this.stats.cacheMisses++;

    // Analyze query features
    const features = this.analyzeQueryFeatures(sql);

    // Determine complexity
    const complexity = this.determineComplexity(features);

    // Estimate cost and rows
    const estimatedCost = this.estimateCost(sql, features);
    const estimatedRows = this.estimateRows(sql, features);

    // Determine best execution strategy
    const strategy = this.selectStrategy(features, estimatedCost, estimatedRows);

    // Generate optimization suggestions
    const optimizations = this.generateOptimizations(sql, features, estimatedCost);

    // Estimate duration
    const estimatedDurationMs = this.estimateDuration(estimatedCost, complexity);

    // Apply learning from history
    const adjustedDuration = this.applyLearning(normalizedSql, estimatedDurationMs);

    const plan: QueryPlan = {
      id: this.generateId(),
      sql,
      normalizedSql,
      strategy,
      complexity,
      estimatedCost,
      estimatedRows,
      estimatedDurationMs: adjustedDuration,
      optimizations,
      dependencies: this.extractDependencies(sql),
      createdAt: Date.now(),
    };

    // Cache the plan
    if (this.config.enableCaching) {
      this.cachePlan(cacheKey, plan);
    }

    // Update statistics
    this.updateStats(plan);

    return plan;
  }

  /**
   * Record actual execution metrics for learning
   */
  recordExecution(planId: string, actualDurationMs: number, actualRows: number): void {
    if (!this.config.enableLearning) return;

    // Find the plan in cache
    for (const [key, plan] of this.planCache) {
      if (plan.id === planId) {
        const history = this.executionHistory.get(key) || {
          planned: 0,
          actual: 0,
          count: 0,
        };

        history.planned += plan.estimatedDurationMs;
        history.actual += actualDurationMs;
        history.count++;

        this.executionHistory.set(key, history);

        logger.debug('Execution recorded for learning', {
          planId,
          planned: plan.estimatedDurationMs,
          actual: actualDurationMs,
          rows: actualRows,
        });
        break;
      }
    }
  }

  /**
   * Get plan statistics
   */
  getStatistics(): PlanStatistics {
    return { ...this.stats };
  }

  /**
   * Get cached plans
   */
  getCachedPlans(): QueryPlan[] {
    return Array.from(this.planCache.values());
  }

  /**
   * Clear plan cache
   */
  clearCache(): void {
    this.planCache.clear();
    logger.log('Plan cache cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PlannerConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.maxPlanCacheSize !== undefined) {
      this.trimCache();
    }

    logger.log('Query execution planner configuration updated');
  }

  /**
   * Get optimization suggestions for a query
   */
  getOptimizations(sql: string): OptimizationSuggestion[] {
    const features = this.analyzeQueryFeatures(sql);
    const cost = this.estimateCost(sql, features);
    return this.generateOptimizations(sql, features, cost);
  }

  /**
   * Validate a query for potential issues
   */
  validateQuery(sql: string): { valid: boolean; issues: string[]; warnings: string[] } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for common issues
    if (sql.toLowerCase().includes('select *')) {
      warnings.push('SELECT * may retrieve unnecessary columns');
    }

    if (!sql.toLowerCase().includes('where') && sql.toLowerCase().includes('select')) {
      warnings.push('Query without WHERE clause may scan entire table');
    }

    if ((sql.match(/join/gi) || []).length > 5) {
      warnings.push('Query has many joins, consider denormalization');
    }

    if (sql.toLowerCase().includes('order by') && !sql.toLowerCase().includes('limit')) {
      warnings.push('ORDER BY without LIMIT may be inefficient for large results');
    }

    // Check for syntax issues (basic)
    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push('Unbalanced parentheses');
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Compare two execution plans
   */
  comparePlans(plan1: QueryPlan, plan2: QueryPlan): {
    winner: 'plan1' | 'plan2' | 'equal';
    costDifference: number;
    durationDifference: number;
    recommendation: string;
  } {
    const costDiff = plan1.estimatedCost - plan2.estimatedCost;
    const durationDiff = plan1.estimatedDurationMs - plan2.estimatedDurationMs;

    let winner: 'plan1' | 'plan2' | 'equal' = 'equal';
    let recommendation = 'Both plans have similar performance';

    if (costDiff < -100 && durationDiff < -50) {
      winner = 'plan1';
      recommendation = 'Plan 1 is significantly better';
    } else if (costDiff > 100 && durationDiff > 50) {
      winner = 'plan2';
      recommendation = 'Plan 2 is significantly better';
    }

    return {
      winner,
      costDifference: costDiff,
      durationDifference: durationDiff,
      recommendation,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private createDefaultPlan(sql: string): QueryPlan {
    return {
      id: this.generateId(),
      sql,
      normalizedSql: this.normalizeSql(sql),
      strategy: 'sequential',
      complexity: 'moderate',
      estimatedCost: 100,
      estimatedRows: 100,
      estimatedDurationMs: 50,
      optimizations: [],
      dependencies: [],
      createdAt: Date.now(),
    };
  }

  private normalizeSql(sql: string): string {
    return sql
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '?')
      .replace(/:\w+/g, '?')
      .trim();
  }

  private generateCacheKey(normalizedSql: string, params?: unknown[]): string {
    const paramString = params ? JSON.stringify(params) : '';
    let hash = 0;
    const str = normalizedSql + paramString;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(36);
  }

  private analyzeQueryFeatures(sql: string): QueryFeatures {
    const lowerSql = sql.toLowerCase();

    return {
      hasJoin: lowerSql.includes('join'),
      hasSubquery: (lowerSql.match(/\(/g) || []).length > 0,
      hasAggregate: /(count|sum|avg|min|max)\s*\(/i.test(sql),
      hasGroupBy: lowerSql.includes('group by'),
      hasOrderBy: lowerSql.includes('order by'),
      hasLimit: lowerSql.includes('limit'),
      hasWhere: lowerSql.includes('where'),
      tableCount: (lowerSql.match(/from\s+\w+/gi) || []).length + (lowerSql.match(/join\s+\w+/gi) || []).length,
      estimatedResultSize: this.estimateResultSize(sql),
    };
  }

  private estimateResultSize(sql: string): number {
    // Simplified estimation based on query structure
    const lowerSql = sql.toLowerCase();

    if (lowerSql.includes('limit')) {
      const match = lowerSql.match(/limit\s+(\d+)/);
      if (match) return parseInt(match[1], 10);
    }

    if (lowerSql.includes('count(*)')) {
      return 1;
    }

    if (lowerSql.includes('group by')) {
      return 100; // Estimated groups
    }

    return 1000; // Default estimate
  }

  private determineComplexity(features: QueryFeatures): QueryComplexity {
    let score = 0;

    if (features.hasJoin) score += 2;
    if (features.hasSubquery) score += 2;
    if (features.hasAggregate) score += 1;
    if (features.hasGroupBy) score += 1;
    if (features.tableCount > 3) score += 2;
    if (features.estimatedResultSize > 10000) score += 2;

    if (score >= 6) return 'very_complex';
    if (score >= 4) return 'complex';
    if (score >= 2) return 'moderate';
    return 'simple';
  }

  private estimateCost(sql: string, features: QueryFeatures): number {
    let cost = 10; // Base cost

    // Table scans
    cost += features.tableCount * 50;

    // Joins are expensive
    if (features.hasJoin) {
      cost += 100 * features.tableCount;
    }

    // Subqueries
    if (features.hasSubquery) {
      cost += 150;
    }

    // Aggregations
    if (features.hasAggregate || features.hasGroupBy) {
      cost += 50;
    }

    // Sorting
    if (features.hasOrderBy) {
      cost += 30;
    }

    // Result size factor
    cost += Math.log10(features.estimatedResultSize + 1) * 20;

    return Math.round(cost);
  }

  private estimateRows(sql: string, features: QueryFeatures): number {
    // Start with estimated result size
    let rows = features.estimatedResultSize;

    // Joins multiply rows (simplified)
    if (features.hasJoin) {
      rows *= Math.pow(1.5, features.tableCount - 1);
    }

    // Filters reduce rows
    if (features.hasWhere) {
      rows *= 0.1;
    }

    return Math.round(rows);
  }

  private selectStrategy(features: QueryFeatures, cost: number, rows: number): ExecutionStrategy {
    // Check if result is likely cached
    if (this.config.enableCaching && cost < 50) {
      return 'cached';
    }

    // Parallel execution for large result sets
    if (rows > this.config.parallelThreshold && features.hasJoin) {
      return 'parallel';
    }

    // Batched for many operations
    if (features.tableCount > 2 || cost > 500) {
      return 'batched';
    }

    return 'sequential';
  }

  private generateOptimizations(sql: string, features: QueryFeatures, cost: number): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Index suggestions
    if (features.hasWhere && cost > 100) {
      const whereMatch = sql.toLowerCase().match(/where\s+(\w+)/);
      if (whereMatch) {
        suggestions.push({
          type: 'index',
          description: `Consider adding an index on column '${whereMatch[1]}' for WHERE clause`,
          impact: 'high',
          estimatedImprovement: 50,
        });
      }
    }

    // Join optimization
    if (features.hasJoin && features.tableCount > 2) {
      suggestions.push({
        type: 'denormalize',
        description: 'Consider denormalizing tables to reduce join complexity',
        impact: 'medium',
        estimatedImprovement: 30,
      });
    }

    // Caching suggestion
    if (cost > 200 && !features.hasSubquery) {
      suggestions.push({
        type: 'cache',
        description: 'Query is expensive, consider caching results',
        impact: 'medium',
        estimatedImprovement: 40,
      });
    }

    // Partition suggestion for large tables
    if (features.estimatedResultSize > 50000) {
      suggestions.push({
        type: 'partition',
        description: 'Large result set, consider table partitioning',
        impact: 'high',
        estimatedImprovement: 60,
      });
    }

    // Materialized view suggestion
    if (features.hasAggregate && features.hasJoin) {
      suggestions.push({
        type: 'materialize',
        description: 'Complex aggregation with joins, consider materialized view',
        impact: 'high',
        estimatedImprovement: 70,
      });
    }

    // Query rewrite suggestions
    if (sql.toLowerCase().includes('select *')) {
      suggestions.push({
        type: 'rewrite',
        description: 'Replace SELECT * with specific columns to reduce data transfer',
        impact: 'low',
        estimatedImprovement: 10,
        sql: sql.replace(/select \*/i, 'SELECT /* specify columns */'),
      });
    }

    return suggestions;
  }

  private estimateDuration(cost: number, complexity: QueryComplexity): number {
    const baseMs = 10;
    const complexityMultiplier: Record<QueryComplexity, number> = {
      simple: 1,
      moderate: 2,
      complex: 4,
      very_complex: 8,
    };

    return Math.round(baseMs + cost * complexityMultiplier[complexity] * 0.5);
  }

  private applyLearning(normalizedSql: string, estimatedDuration: number): number {
    const history = this.executionHistory.get(normalizedSql);
    if (!history || history.count < 3) {
      return estimatedDuration;
    }

    // Calculate adjustment factor based on historical accuracy
    const avgPlanned = history.planned / history.count;
    const avgActual = history.actual / history.count;
    const factor = avgActual / avgPlanned;

    // Apply adjustment with smoothing
    const adjusted = estimatedDuration * (factor * 0.3 + 0.7);

    return Math.round(adjusted);
  }

  private extractDependencies(sql: string): string[] {
    const dependencies: string[] = [];
    const tableMatches = sql.match(/(?:from|join)\s+(\w+)/gi) || [];

    for (const match of tableMatches) {
      const tableName = match.split(/\s+/)[1];
      if (tableName && !dependencies.includes(tableName)) {
        dependencies.push(tableName.toLowerCase());
      }
    }

    return dependencies;
  }

  private cachePlan(key: string, plan: QueryPlan): void {
    this.planCache.set(key, plan);
    this.trimCache();
  }

  private trimCache(): void {
    if (this.planCache.size > this.config.maxPlanCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.planCache.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt);

      const toRemove = entries.slice(0, entries.length - this.config.maxPlanCacheSize);
      for (const [key] of toRemove) {
        this.planCache.delete(key);
      }
    }
  }

  private updateStats(plan: QueryPlan): void {
    this.stats.totalPlans++;
    this.totalCost += plan.estimatedCost;
    this.totalDuration += plan.estimatedDurationMs;

    this.stats.averageCost = Math.round(this.totalCost / this.stats.totalPlans);
    this.stats.averageDuration = Math.round(this.totalDuration / this.stats.totalPlans);

    this.stats.strategiesUsed[plan.strategy]++;
    this.stats.optimizationsApplied += plan.optimizations.length;
  }

  private generateId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const queryExecutionPlanner = QueryExecutionPlanner.getInstance();

// Register with service cleanup coordinator
serviceCleanupCoordinator.register('queryExecutionPlanner', {
  cleanup: () => queryExecutionPlanner.shutdown(),
  priority: 'medium',
  description: 'Query execution planner service',
});

// Auto-initialize
queryExecutionPlanner.initialize();
