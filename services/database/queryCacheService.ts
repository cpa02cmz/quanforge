/**
 * Query Cache Service - Intelligent Database Query Caching
 * 
 * Provides intelligent caching for database queries with:
 * - Pattern-based cache invalidation
 * - TTL management with adaptive expiration
 * - Cache warming and preloading
 * - Query result normalization
 * - Memory-efficient storage
 * 
 * @module services/database/queryCacheService
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS, COUNT_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('QueryCacheService');

// ============================================================================
// TYPES
// ============================================================================

export interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
  tags: string[];
  hitCount: number;
  lastAccess: number;
  size: number;
  queryHash: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  evictions: number;
  tagStats: Map<string, { entries: number; hits: number }>;
}

export interface CacheConfig {
  maxSize: number;
  maxEntries: number;
  defaultTTL: number;
  cleanupInterval: number;
  enableWarming: boolean;
  enableMetrics: boolean;
}

export interface CacheInvalidationRule {
  pattern: string | RegExp;
  tags?: string[];
  onOperation?: ('create' | 'update' | 'delete')[];
}

export interface QueryCacheOptions {
  ttl?: number;
  tags?: string[];
  bypassCache?: boolean;
  refreshInBackground?: boolean;
}

type CacheEventCallback = (event: CacheEvent) => void;

interface CacheEvent {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'evict' | 'clear';
  key: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 10 * 1024 * 1024, // 10MB
  maxEntries: 1000,
  defaultTTL: TIME_CONSTANTS.MINUTE * 5, // 5 minutes
  cleanupInterval: TIME_CONSTANTS.MINUTE,
  enableWarming: true,
  enableMetrics: true,
};

const INvalidation_RULES: CacheInvalidationRule[] = [
  { pattern: /^robots:/, tags: ['robots'], onOperation: ['create', 'update', 'delete'] },
  { pattern: /^robots:list/, tags: ['robots', 'list'], onOperation: ['create', 'delete'] },
  { pattern: /^robots:search:/, tags: ['robots', 'search'], onOperation: ['create', 'update', 'delete'] },
  { pattern: /^robots:stats/, tags: ['robots', 'stats'], onOperation: ['create', 'delete'] },
];

// ============================================================================
// QUERY CACHE SERVICE CLASS
// ============================================================================

/**
 * Intelligent query cache service for database operations
 */
export class QueryCacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private eventCallbacks: CacheEventCallback[] = [];
  private warmingQueue: Set<string> = new Set();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = this.initStats();
  }

  /**
   * Initialize the cache service
   */
  async initialize(): Promise<void> {
    this.startCleanupTimer();
    logger.log('Query cache service initialized', {
      maxSize: this.config.maxSize,
      maxEntries: this.config.maxEntries,
      defaultTTL: this.config.defaultTTL,
    });
  }

  /**
   * Shutdown the cache service
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
    this.eventCallbacks = [];
    logger.log('Query cache service shutdown complete');
  }

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.recordMiss(key);
      return null;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.delete(key);
      this.recordMiss(key);
      return null;
    }

    // Update access stats
    entry.hitCount++;
    entry.lastAccess = Date.now();

    this.recordHit(key, entry);
    return entry.data;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, options: QueryCacheOptions = {}): void {
    // Check if we need to bypass cache
    if (options.bypassCache) {
      return;
    }

    // Calculate size
    const size = this.calculateSize(data);

    // Check if entry would exceed max size
    if (size > this.config.maxSize) {
      logger.warn(`Cache entry too large: ${size} bytes for key ${key}`);
      return;
    }

    // Evict if necessary
    this.evictIfNeeded(size);

    // Create entry
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl: options.ttl ?? this.config.defaultTTL,
      tags: options.tags ?? this.inferTags(key),
      hitCount: 0,
      lastAccess: Date.now(),
      size,
      queryHash: this.hashKey(key),
    };

    // Store entry
    this.cache.set(key, entry as CacheEntry<unknown>);

    // Update stats
    this.stats.totalEntries = this.cache.size;
    this.stats.totalSize += size;
    this.updateNewestEntry(entry.timestamp);

    this.emitEvent({
      type: 'set',
      key,
      timestamp: Date.now(),
      metadata: { size, ttl: entry.ttl, tags: entry.tags },
    });
  }

  /**
   * Delete cached data
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.stats.totalSize -= entry.size;
    this.stats.totalEntries = this.cache.size;

    this.emitEvent({
      type: 'delete',
      key,
      timestamp: Date.now(),
      metadata: { evicted: false },
    });

    return true;
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.stats.totalEntries = 0;
    this.stats.totalSize = 0;

    this.emitEvent({
      type: 'clear',
      key: '*',
      timestamp: Date.now(),
      metadata: { entriesCleared: count },
    });

    logger.log(`Cache cleared: ${count} entries removed`);
  }

  /**
   * Invalidate cache by pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    let invalidated = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        invalidated++;
      }
    }

    if (invalidated > 0) {
      logger.log(`Invalidated ${invalidated} entries matching pattern ${pattern}`);
    }

    return invalidated;
  }

  /**
   * Invalidate cache by tags
   */
  invalidateTags(tags: string[]): number {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        this.delete(key);
        invalidated++;
      }
    }

    if (invalidated > 0) {
      logger.log(`Invalidated ${invalidated} entries with tags ${tags.join(', ')}`);
    }

    return invalidated;
  }

  /**
   * Invalidate based on operation type
   */
  invalidateOnOperation(operation: 'create' | 'update' | 'delete', entityType: string): number {
    let totalInvalidated = 0;

    for (const rule of INvalidation_RULES) {
      if (rule.onOperation?.includes(operation)) {
        // Check if rule applies to entity type
        const patternStr = typeof rule.pattern === 'string' ? rule.pattern : rule.pattern.source;
        if (patternStr.includes(entityType)) {
          totalInvalidated += this.invalidatePattern(rule.pattern);

          if (rule.tags) {
            totalInvalidated += this.invalidateTags(rule.tags);
          }
        }
      }
    }

    return totalInvalidated;
  }

  /**
   * Get or set cached data with factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      // Optionally refresh in background
      if (options.refreshInBackground) {
        this.refreshInBackground(key, factory, options);
      }
      return cached;
    }

    // Execute factory and cache result
    const data = await factory();
    this.set(key, data, options);

    return data;
  }

  /**
   * Preload/warm cache with data
   */
  async warmCache<T>(entries: Array<{ key: string; factory: () => Promise<T>; options?: QueryCacheOptions }>): Promise<void> {
    if (!this.config.enableWarming) return;

    logger.log(`Warming cache with ${entries.length} entries`);

    await Promise.all(
      entries.map(async ({ key, factory, options }) => {
        if (!this.warmingQueue.has(key)) {
          this.warmingQueue.add(key);
          try {
            const data = await factory();
            this.set(key, data, options);
          } catch (error) {
            logger.error(`Failed to warm cache for key ${key}:`, error);
          } finally {
            this.warmingQueue.delete(key);
          }
        }
      })
    );
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
    };
  }

  /**
   * Get cache entries info
   */
  getEntries(): Array<{ key: string; size: number; hitCount: number; age: number; tags: string[] }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: entry.size,
      hitCount: entry.hitCount,
      age: Date.now() - entry.timestamp,
      tags: entry.tags,
    }));
  }

  /**
   * Register event callback
   */
  onEvent(callback: CacheEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index > -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private initStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null,
      evictions: 0,
      tagStats: new Map(),
    };
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      this.stats.evictions += evicted;
      logger.log(`Cleanup: evicted ${evicted} expired entries`);
    }
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() > entry.timestamp + entry.ttl;
  }

  private recordHit(key: string, entry: CacheEntry<unknown>): void {
    this.stats.hits++;

    // Update tag stats
    for (const tag of entry.tags) {
      const tagStat = this.stats.tagStats.get(tag) || { entries: 0, hits: 0 };
      tagStat.hits++;
      this.stats.tagStats.set(tag, tagStat);
    }

    this.emitEvent({
      type: 'hit',
      key,
      timestamp: Date.now(),
    });
  }

  private recordMiss(key: string): void {
    this.stats.misses++;

    this.emitEvent({
      type: 'miss',
      key,
      timestamp: Date.now(),
    });
  }

  private evictIfNeeded(requiredSize: number): void {
    // Check entry count limit
    while (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    // Check size limit
    while (this.stats.totalSize + requiredSize > this.config.maxSize) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);

      if (entry) {
        this.stats.totalSize -= entry.size;
        this.stats.evictions++;

        this.emitEvent({
          type: 'evict',
          key: oldestKey,
          timestamp: Date.now(),
          metadata: { reason: 'lru', size: entry.size },
        });
      }
    }
  }

  private calculateSize(data: unknown): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Estimate size for non-serializable data
      return 1024; // 1KB default estimate
    }
  }

  private hashKey(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private inferTags(key: string): string[] {
    const tags: string[] = [];

    // Extract entity type from key pattern
    const entityMatch = key.match(/^(\w+):/);
    if (entityMatch) {
      tags.push(entityMatch[1]);
    }

    // Extract operation type
    if (key.includes(':list')) tags.push('list');
    if (key.includes(':search')) tags.push('search');
    if (key.includes(':stats')) tags.push('stats');
    if (key.includes(':single')) tags.push('single');

    return tags;
  }

  private updateNewestEntry(timestamp: number): void {
    this.stats.newestEntry = timestamp;

    if (this.stats.oldestEntry === null) {
      this.stats.oldestEntry = timestamp;
    }
  }

  private async refreshInBackground<T>(
    key: string,
    factory: () => Promise<T>,
    options: QueryCacheOptions
  ): Promise<void> {
    try {
      const data = await factory();
      this.set(key, data, options);
    } catch (error) {
      logger.error(`Background refresh failed for key ${key}:`, error);
    }
  }

  private emitEvent(event: CacheEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error('Event callback error:', error);
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const queryCacheService = new QueryCacheService();
