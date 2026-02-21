/**
 * API Response Cache Service
 * Advanced caching layer for API responses with TTL, tag-based invalidation, and cache warming
 * 
 * @module services/api/apiResponseCache
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS, CACHE_CONFIG } from '../../constants/config';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('APIResponseCache');

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: Set<string>;
  etag?: string;
  lastModified?: string;
  hitCount: number;
  size: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  entries: number;
  oldestEntry?: number;
  newestEntry?: number;
  totalSize: number;
  evictions: number;
}

/**
 * Cache invalidation event
 */
export interface InvalidationEvent {
  key: string;
  reason: 'ttl' | 'tag' | 'manual' | 'size' | 'etag';
  timestamp: number;
}

/**
 * Cache warming task
 */
export interface WarmingTask {
  key: string;
  fetcher: () => Promise<unknown>;
  ttl: number;
  tags: string[];
  interval?: number;
  lastRun?: number;
}

export type CacheOptions = {
  ttl?: number;
  tags?: string[];
  etag?: string;
  lastModified?: string;
  compress?: boolean;
};

/**
 * API Response Cache
 * 
 * Features:
 * - TTL-based expiration
 * - Tag-based invalidation
 * - LRU eviction
 * - Cache warming
 * - ETag support
 * - Size management
 * - Statistics tracking
 */
export class APIResponseCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  private cleanupInterval: ReturnType<typeof setInterval>;
  private warmingTasks = new Map<string, WarmingTask>();
  private warmingInterval?: ReturnType<typeof setInterval>;
  
  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };
  
  // Invalidation history for debugging
  private invalidationHistory: InvalidationEvent[] = [];
  private readonly maxHistorySize = 100;

  constructor(options?: {
    maxSize?: number;
    defaultTTL?: number;
    cleanupInterval?: number;
  }) {
    this.maxSize = options?.maxSize ?? CACHE_CONFIG.MAX_LRU_CACHE_SIZE;
    this.defaultTTL = options?.defaultTTL ?? TIME_CONSTANTS.CACHE_DEFAULT_TTL;
    
    // Cleanup expired entries periodically
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      options?.cleanupInterval ?? TIME_CONSTANTS.CLEANUP_DEFAULT_INTERVAL
    );
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiResponseCache', {
        cleanup: () => this.destroy(),
        priority: 'medium',
        description: 'API response cache service'
      });
    }
  }

  /**
   * Get a cached response
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      this.stats.misses++;
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    }
    
    // Check TTL
    if (this.isExpired(entry)) {
      this.delete(key, 'ttl');
      this.stats.misses++;
      return null;
    }
    
    // Update hit count
    entry.hitCount++;
    this.stats.hits++;
    
    logger.debug(`Cache hit for key: ${key} (hits: ${entry.hitCount})`);
    return entry.data;
  }

  /**
   * Set a cache entry
   */
  set<T>(key: string, data: T, options?: CacheOptions): void {
    const ttl = options?.ttl ?? this.defaultTTL;
    const tags = new Set(options?.tags ?? []);
    
    // Estimate size (rough estimation based on JSON stringification)
    const size = this.estimateSize(data);
    
    // Check if we need to evict entries
    this.ensureCapacity(size);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      tags,
      etag: options?.etag,
      lastModified: options?.lastModified,
      hitCount: 0,
      size
    };
    
    this.cache.set(key, entry);
    logger.debug(`Cached key: ${key} (TTL: ${ttl}ms, size: ${size} bytes)`);
  }

  /**
   * Get or fetch - returns cached data or fetches and caches
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const data = await fetcher();
    this.set(key, data, options);
    return data;
  }

  /**
   * Check if a key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.delete(key, 'ttl');
      return false;
    }
    
    return true;
  }

  /**
   * Delete a cache entry
   */
  delete(key: string, reason: InvalidationEvent['reason'] = 'manual'): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.recordInvalidation(key, reason);
      logger.debug(`Deleted cache key: ${key} (reason: ${reason})`);
    }
    return existed;
  }

  /**
   * Invalidate all entries with a specific tag
   */
  invalidateByTag(tag: string): number {
    let count = 0;
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.has(tag)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.delete(key, 'tag');
      count++;
    }
    
    if (count > 0) {
      logger.info(`Invalidated ${count} entries with tag: ${tag}`);
    }
    
    return count;
  }

  /**
   * Invalidate entries matching a pattern
   */
  invalidateByPattern(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.delete(key, 'manual');
      count++;
    }
    
    if (count > 0) {
      logger.info(`Invalidated ${count} entries matching pattern: ${pattern}`);
    }
    
    return count;
  }

  /**
   * Invalidate by ETag (for HTTP cache validation)
   */
  invalidateByETag(etag: string): number {
    let count = 0;
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.etag === etag) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.delete(key, 'etag');
      count++;
    }
    
    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cleared ${size} cache entries`);
  }

  /**
   * Add a cache warming task
   */
  addWarmingTask(
    key: string,
    fetcher: () => Promise<unknown>,
    options: {
      ttl?: number;
      tags?: string[];
      interval?: number;
    } = {}
  ): void {
    const task: WarmingTask = {
      key,
      fetcher,
      ttl: options.ttl ?? this.defaultTTL,
      tags: options.tags ?? [],
      interval: options.interval
    };
    
    this.warmingTasks.set(key, task);
    logger.debug(`Added warming task for key: ${key}`);
    
    // Start warming interval if not running
    if (!this.warmingInterval && this.warmingTasks.size > 0) {
      this.startWarming();
    }
  }

  /**
   * Remove a cache warming task
   */
  removeWarmingTask(key: string): boolean {
    const removed = this.warmingTasks.delete(key);
    if (removed) {
      logger.debug(`Removed warming task for key: ${key}`);
      
      // Stop warming if no tasks remain
      if (this.warmingTasks.size === 0 && this.warmingInterval) {
        clearInterval(this.warmingInterval);
        this.warmingInterval = undefined;
      }
    }
    return removed;
  }

  /**
   * Run cache warming for all tasks
   */
  async warmAll(): Promise<void> {
    const tasks = Array.from(this.warmingTasks.values());
    logger.info(`Running cache warming for ${tasks.length} tasks`);
    
    await Promise.allSettled(
      tasks.map(task => this.runWarmingTask(task))
    );
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    let totalSize = 0;
    let oldestEntry: number | undefined;
    let newestEntry: number | undefined;
    
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
      
      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }
    
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      size: this.cache.size,
      entries: this.cache.size,
      oldestEntry,
      newestEntry,
      totalSize,
      evictions: this.stats.evictions
    };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get entries by tag
   */
  getByTag<T>(tag: string): Map<string, T> {
    const result = new Map<string, T>();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.has(tag) && !this.isExpired(entry)) {
        result.set(key, entry.data as T);
      }
    }
    
    return result;
  }

  /**
   * Get invalidation history
   */
  getInvalidationHistory(): InvalidationEvent[] {
    return [...this.invalidationHistory];
  }

  /**
   * Refresh a cache entry
   */
  async refresh<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const data = await fetcher();
    this.set(key, data, options);
    return data;
  }

  /**
   * Peek at cache entry without affecting statistics
   */
  peek<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry || this.isExpired(entry)) {
      return null;
    }
    return entry.data;
  }

  // Private methods

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private estimateSize(data: unknown): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 1024; // Default estimate for non-serializable data
    }
  }

  private ensureCapacity(newEntrySize: number): void {
    // Check entry count
    while (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    // Check total size (max 50MB)
    const maxTotalSize = 50 * 1024 * 1024;
    let currentSize = 0;
    for (const entry of this.cache.values()) {
      currentSize += entry.size;
    }
    
    while (currentSize + newEntrySize > maxTotalSize && this.cache.size > 0) {
      const evictedSize = this.evictLRU();
      currentSize -= evictedSize;
    }
  }

  private evictLRU(): number {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    let evictedSize = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      // Consider both timestamp and hit count for LRU
      const score = entry.timestamp - (entry.hitCount * 1000);
      if (score < oldestTime) {
        oldestTime = score;
        oldestKey = key;
        evictedSize = entry.size;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey, 'size');
      this.stats.evictions++;
    }
    
    return evictedSize;
  }

  private recordInvalidation(key: string, reason: InvalidationEvent['reason']): void {
    this.invalidationHistory.push({
      key,
      reason,
      timestamp: Date.now()
    });
    
    // Trim history
    if (this.invalidationHistory.length > this.maxHistorySize) {
      this.invalidationHistory.shift();
    }
  }

  private cleanup(): void {
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key, 'ttl');
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.debug(`Cleaned up ${expiredCount} expired entries`);
    }
  }

  private startWarming(): void {
    // Run warming every 5 minutes
    this.warmingInterval = setInterval(
      () => this.warmAll(),
      5 * TIME_CONSTANTS.MINUTE
    );
    
    // Run initial warming
    this.warmAll();
  }

  private async runWarmingTask(task: WarmingTask): Promise<void> {
    const now = Date.now();
    
    // Check if task should run
    if (task.interval && task.lastRun) {
      if (now - task.lastRun < task.interval) {
        return;
      }
    }
    
    try {
      const data = await task.fetcher();
      this.set(task.key, data, {
        ttl: task.ttl,
        tags: task.tags
      });
      task.lastRun = now;
      logger.debug(`Warmed cache for key: ${task.key}`);
    } catch (error) {
      logger.error(`Failed to warm cache for key: ${task.key}`, error);
    }
  }

  /**
   * Destroy the cache and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }
    this.clear();
    this.warmingTasks.clear();
    logger.info('API Response Cache destroyed');
  }
}

// Create singleton instance
export const apiResponseCache = new APIResponseCache();

// React hook for cache
export const useAPIResponseCache = () => ({
  get: <T>(key: string) => apiResponseCache.get<T>(key),
  set: <T>(key: string, data: T, options?: CacheOptions) => 
    apiResponseCache.set(key, data, options),
  getOrFetch: <T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions) =>
    apiResponseCache.getOrFetch(key, fetcher, options),
  invalidateByTag: (tag: string) => apiResponseCache.invalidateByTag(tag),
  invalidateByPattern: (pattern: string | RegExp) => 
    apiResponseCache.invalidateByPattern(pattern),
  clear: () => apiResponseCache.clear(),
  getStats: () => apiResponseCache.getStats()
});
