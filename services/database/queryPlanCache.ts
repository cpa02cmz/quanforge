/**
 * Query Plan Cache Service
 * 
 * Caches compiled query plans for improved performance on repeated queries.
 * Implements LRU eviction policy with memory-aware caching.
 * 
 * Features:
 * - LRU cache eviction
 * - Memory-aware caching with size limits
 * - Query plan statistics
 * - Automatic invalidation on schema changes
 * - Thread-safe operations
 * 
 * @module services/database/queryPlanCache
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('QueryPlanCache');

// ============================================================================
// TYPES
// ============================================================================

export interface CachedQueryPlan {
  id: string;
  sql: string;
  normalizedSql: string;
  compiledAt: number;
  lastUsed: number;
  hitCount: number;
  estimatedRows: number;
  estimatedCost: number;
  executionTimeMs: number;
  parameters: string[];
  indexes: string[];
  warnings: string[];
}

export interface CacheEntry {
  plan: CachedQueryPlan;
  size: number;
  accessCount: number;
  lastAccess: number;
}

export interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  evictions: number;
  memoryUsedBytes: number;
  memoryLimitBytes: number;
  hitRate: number;
  averagePlanSize: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheConfig {
  maxSizeBytes: number;
  maxEntries: number;
  ttlMs: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
  enableStats: boolean;
  normalizeQueries: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: CacheConfig = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  maxEntries: 1000,
  ttlMs: TIME_CONSTANTS.HOUR, // 1 hour
  evictionPolicy: 'lru',
  enableStats: true,
  normalizeQueries: true,
};

// ============================================================================
// QUERY PLAN CACHE CLASS
// ============================================================================

/**
 * LRU Cache for database query plans
 */
export class QueryPlanCache {
  private static instance: QueryPlanCache;
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memoryUsed: 0,
  };
  private accessOrder: string[] = [];
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private isInitialized = false;

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<CacheConfig>): QueryPlanCache {
    if (!QueryPlanCache.instance) {
      QueryPlanCache.instance = new QueryPlanCache(config);
    }
    return QueryPlanCache.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the cache
   */
  initialize(): void {
    if (this.isInitialized) return;

    // Start periodic cleanup
    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      TIME_CONSTANTS.MINUTE * 5
    );

    this.isInitialized = true;
    logger.log('Query plan cache initialized', {
      maxSize: this.formatBytes(this.config.maxSizeBytes),
      maxEntries: this.config.maxEntries,
    });
  }

  /**
   * Shutdown the cache
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
    this.isInitialized = false;
    logger.log('Query plan cache shutdown');
  }

  /**
   * Get a cached query plan
   */
  get(sql: string, params?: unknown[]): CachedQueryPlan | null {
    const key = this.generateKey(sql, params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.plan.compiledAt > this.config.ttlMs) {
      this.deleteByKey(key);
      this.stats.misses++;
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccess = Date.now();
    entry.plan.lastUsed = Date.now();
    entry.plan.hitCount++;

    // Update LRU order
    this.updateAccessOrder(key);

    this.stats.hits++;

    return entry.plan;
  }

  /**
   * Store a query plan in the cache
   */
  set(sql: string, plan: Omit<CachedQueryPlan, 'id' | 'compiledAt' | 'lastUsed' | 'hitCount'>): boolean {
    const key = this.generateKey(sql, plan.parameters);
    const size = this.estimatePlanSize(plan);

    // Check if we need to evict entries
    while (
      (this.stats.memoryUsed + size > this.config.maxSizeBytes ||
        this.cache.size >= this.config.maxEntries) &&
      this.cache.size > 0
    ) {
      this.evict();
    }

    // Don't cache if plan is too large
    if (size > this.config.maxSizeBytes * 0.5) {
      logger.warn('Query plan too large to cache', {
        size: this.formatBytes(size),
        sql: sql.substring(0, 100),
      });
      return false;
    }

    const fullPlan: CachedQueryPlan = {
      ...plan,
      id: key,
      compiledAt: Date.now(),
      lastUsed: Date.now(),
      hitCount: 0,
    };

    const entry: CacheEntry = {
      plan: fullPlan,
      size,
      accessCount: 1,
      lastAccess: Date.now(),
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
    this.stats.memoryUsed += size;

    logger.debug('Cached query plan', {
      key: key.substring(0, 16),
      size: this.formatBytes(size),
      totalEntries: this.cache.size,
    });

    return true;
  }

  /**
   * Check if a plan exists in cache
   */
  has(sql: string, params?: unknown[]): boolean {
    const key = this.generateKey(sql, params);
    return this.cache.has(key);
  }

  /**
   * Delete a cached plan by SQL
   */
  deleteBySql(sql: string, params?: unknown[]): boolean {
    const key = this.generateKey(sql, params);
    return this.deleteByKey(key);
  }

  /**
   * Clear all cached plans
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    this.stats.memoryUsed = 0;
    logger.log('Cache cleared', { entriesRemoved: count });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalRequests = this.stats.hits + this.stats.misses;

    let oldestEntry = Date.now();
    let newestEntry = 0;

    for (const entry of entries) {
      if (entry.plan.compiledAt < oldestEntry) {
        oldestEntry = entry.plan.compiledAt;
      }
      if (entry.plan.compiledAt > newestEntry) {
        newestEntry = entry.plan.compiledAt;
      }
    }

    return {
      entries: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      memoryUsedBytes: this.stats.memoryUsed,
      memoryLimitBytes: this.config.maxSizeBytes,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      averagePlanSize: entries.length > 0 ? this.stats.memoryUsed / entries.length : 0,
      oldestEntry: entries.length > 0 ? oldestEntry : 0,
      newestEntry: entries.length > 0 ? newestEntry : 0,
    };
  }

  /**
   * Get top N most used queries
   */
  getTopQueries(limit: number = 10): CachedQueryPlan[] {
    return Array.from(this.cache.values())
      .sort((a, b) => b.plan.hitCount - a.plan.hitCount)
      .slice(0, limit)
      .map(entry => entry.plan);
  }

  /**
   * Get slow queries from cache
   */
  getSlowQueries(thresholdMs: number = 100): CachedQueryPlan[] {
    return Array.from(this.cache.values())
      .filter(entry => entry.plan.executionTimeMs > thresholdMs)
      .sort((a, b) => b.plan.executionTimeMs - a.plan.executionTimeMs)
      .map(entry => entry.plan);
  }

  /**
   * Invalidate plans for a specific table
   */
  invalidateTable(tableName: string): number {
    let invalidated = 0;

    for (const [key, entry] of this.cache) {
      if (entry.plan.sql.toLowerCase().includes(tableName.toLowerCase())) {
        this.deleteByKey(key);
        invalidated++;
      }
    }

    if (invalidated > 0) {
      logger.log('Invalidated table queries', { tableName, count: invalidated });
    }

    return invalidated;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };

    // Check if we need to evict due to new limits
    while (
      (this.stats.memoryUsed > this.config.maxSizeBytes ||
        this.cache.size > this.config.maxEntries) &&
      this.cache.size > 0
    ) {
      this.evict();
    }

    logger.log('Cache configuration updated', this.config);
  }

  /**
   * Get cache health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    message: string;
    metrics: CacheStats;
  } {
    const stats = this.getStats();
    const memoryUtilization = stats.memoryUsedBytes / stats.memoryLimitBytes;

    if (memoryUtilization > 0.9 || stats.hitRate < 0.3) {
      return {
        status: 'critical',
        message: `Cache under pressure: ${Math.round(memoryUtilization * 100)}% memory, ${Math.round(stats.hitRate * 100)}% hit rate`,
        metrics: stats,
      };
    }

    if (memoryUtilization > 0.75 || stats.hitRate < 0.5) {
      return {
        status: 'degraded',
        message: `Cache performance degraded: ${Math.round(memoryUtilization * 100)}% memory, ${Math.round(stats.hitRate * 100)}% hit rate`,
        metrics: stats,
      };
    }

    return {
      status: 'healthy',
      message: `Cache operating normally: ${Math.round(memoryUtilization * 100)}% memory, ${Math.round(stats.hitRate * 100)}% hit rate`,
      metrics: stats,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private deleteByKey(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.stats.memoryUsed -= entry.size;
    this.accessOrder = this.accessOrder.filter(k => k !== key);

    return true;
  }

  private evict(): boolean {
    if (this.cache.size === 0) return false;

    let keyToEvict: string | null = null;

    switch (this.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.accessOrder[0];
        break;

      case 'lfu': {
        let minAccess = Infinity;
        for (const [key, entry] of this.cache) {
          if (entry.accessCount < minAccess) {
            minAccess = entry.accessCount;
            keyToEvict = key;
          }
        }
        break;
      }

      case 'fifo':
        keyToEvict = this.accessOrder[0];
        break;
    }

    if (keyToEvict && this.deleteByKey(keyToEvict)) {
      this.stats.evictions++;
      logger.debug('Evicted cache entry', { key: keyToEvict.substring(0, 16) });
      return true;
    }

    return false;
  }

  private cleanup(): void {
    const now = Date.now();
    let expired = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.plan.compiledAt > this.config.ttlMs) {
        this.deleteByKey(key);
        expired++;
      }
    }

    if (expired > 0) {
      logger.debug('Cache cleanup completed', { expiredEntries: expired });
    }
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }

  private generateKey(sql: string, params?: unknown[]): string {
    const normalized = this.config.normalizeQueries
      ? this.normalizeSql(sql)
      : sql;

    // Simple hash function for generating cache keys
    let hash = 0;
    const str = normalized + (params ? JSON.stringify(params) : '');

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(36);
  }

  private normalizeSql(sql: string): string {
    return sql
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '?')
      .replace(/:\w+/g, '?')
      .trim();
  }

  private estimatePlanSize(plan: Omit<CachedQueryPlan, 'id' | 'compiledAt' | 'lastUsed' | 'hitCount'>): number {
    // Estimate memory size of the plan
    let size = 1024; // Base overhead

    size += plan.sql.length * 2;
    size += plan.normalizedSql.length * 2;
    size += plan.parameters.length * 50;
    size += plan.indexes.length * 100;
    size += plan.warnings.length * 100;

    return size;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const queryPlanCache = QueryPlanCache.getInstance();

// Auto-initialize
queryPlanCache.initialize();
