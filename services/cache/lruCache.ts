/**
 * Optimized LRU Cache Implementation
 * Replaces OptimizedLRUCache with enhanced memory management and performance
 */

import { BaseCache, BaseCacheEntry, CacheConfig, CacheMetrics, CompressionUtils, CACHE_CONSTANTS } from './__init__';
import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('lruCache');

export interface LRUCacheOptions extends CacheConfig {
  maxSize?: number;
}

export class OptimizedLRUCache<T = any> extends BaseCache<T> {
  constructor(options: LRUCacheOptions = {}) {
    super({
      maxSize: CACHE_CONSTANTS.LRU_CACHE_SIZE,
      defaultTTL: CACHE_CONSTANTS.LRU_DEFAULT_TTL,
      ...options
    });
  }

  async get(key: string): Promise<T | null> {
    const startTime = performance.now();
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.recordMiss();
      this.recordAccessTime(performance.now() - startTime);
      return null;
    }

    // Check expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.recordMiss();
      this.recordAccessTime(performance.now() - startTime);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.recordHit();
    this.recordAccessTime(performance.now() - startTime);

    // Decompress if needed
    if (entry.compressed) {
      try {
        return await CompressionUtils.decompress(entry.data, entry.compressed);
      } catch (error) {
        logger.warn(`Failed to decompress cache entry: ${key}`, error);
        this.cache.delete(key);
        this.recordMiss();
        return null;
      }
    }

    return entry.data;
  }

  async set(key: string, data: T, options: { ttl?: number; tags?: string[]; priority?: 'high' | 'medium' | 'low' } = {}): Promise<void> {
    // Check if we should cache this entry
    if (!this.shouldCacheEntry(key, data)) {
      return;
    }

    const ttl = options.ttl || this.getTTLForEntry(key, data);
    const expires = Date.now() + ttl;

    // Process data (compression if needed)
    let processedData: any = data;
    let compressed = false;
    let size = this.calculateSize(data);

    if (this.config.enableCompression && size > this.config.compressionThreshold) {
      try {
        const compressionResult = await CompressionUtils.compress(data);
        processedData = compressionResult.data;
        compressed = compressionResult.compressed;
        size = compressionResult.size;
        
        if (compressed) {
          this.metrics.compressions++;
        }
      } catch (error) {
        logger.warn('Compression failed:', error);
      }
    }

    // Ensure capacity
    await this.ensureCapacity(size);

    // Create cache entry
    const entry: BaseCacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      tags: options.tags || [],
      compressed,
      priority: options.priority || 'medium'
    };

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, entry);
    this.metrics.sets++;
    this.updateMemoryUsage();
  }

  // LRU-specific capacity management
  protected async ensureCapacity(requiredSize: number): Promise<void> {
    while (
      this.cache.size >= this.config.maxSize ||
      this.metrics.memoryUsage + requiredSize > this.config.maxMemorySize
    ) {
      this.evictLeastUsed();
    }
  }

  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null;
    let leastUsedScore = Infinity;

    for (const [key, item] of this.cache.entries()) {
      // Calculate score based on access count and recency
      const timeSinceAccess = Date.now() - item.lastAccessed;
      const score = item.accessCount / (timeSinceAccess + 1);

      if (score < leastUsedScore) {
        leastUsedScore = score;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      this.metrics.evictions++;
    }
  }

  // Additional LRU-specific methods
  getStats() {
    const metrics = this.getMetrics();
    return {
      ...metrics,
      size: this.cache.size,
      keys: this.keys(),
      hotEntries: this.getHotEntries(10)
    };
  }

  private getHotEntries(limit: number): Array<{ key: string; entry: BaseCacheEntry<T> }> {
    return Array.from(this.cache.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, limit)
      .map(([key, entry]) => ({ key, entry }));
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.timestamp + item.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.metrics.evictions += cleaned;
    this.updateMemoryUsage();
    return cleaned;
  }

  clearByTags(tags: string[]): number {
    let cleared = 0;
    for (const [key] of this.cache.entries()) {
      const entry = this.cache.get(key);
      if (entry && tags.some(tag => entry.tags.includes(tag))) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    this.metrics.evictions += cleared;
    this.updateMemoryUsage();
    return cleared;
  }

  startAutoCleanup(intervalMs: number = CACHE_CONSTANTS.DEFAULT_CLEANUP_INTERVAL): void {
    setInterval(() => {
      try {
        const cleaned = this.cleanup();
        if (cleaned > 0 && process.env.NODE_ENV === 'development') {
          logger.log(`LRU Cache cleanup: removed ${cleaned} expired entries`);
        }
      } catch (error) {
        logger.warn('LRU Cache auto cleanup failed:', error);
      }
    }, intervalMs);
  }
}

// Pre-configured cache instances with different configurations
export const robotCache = new OptimizedLRUCache<any>({maxSize: 200, defaultTTL: 900000}); // 15 minutes
export const analyticsCache = new OptimizedLRUCache<any>({maxSize: 100, defaultTTL: 600000}); // 10 minutes
export const marketDataCache = new OptimizedLRUCache<any>({maxSize: 50, defaultTTL: 300000}); // 5 minutes

// Start auto cleanup for all caches
if (typeof window !== 'undefined') {
  robotCache.startAutoCleanup();
  analyticsCache.startAutoCleanup();
  marketDataCache.startAutoCleanup();
}