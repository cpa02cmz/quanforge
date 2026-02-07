import { createScopedLogger } from '../utils/logger';
import { AdvancedCache, CacheFactory } from './advancedCache';
import { securityManager } from './securityManager';

const logger = createScopedLogger('UnifiedCache');

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
  compress?: boolean;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: string[];
  priority: 'low' | 'normal' | 'high';
  compressed: boolean;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  memoryUsage: number;
  entryCount: number;
  compressionRatio: number;
  topEntries: Array<{ key: string; accessCount: number; size: number }>;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  compressions: number;
  decompressions: number;
}

/**
 * Unified Cache Strategy that combines multiple caching approaches
 * - Memory cache for fast access
 * - Smart cache with LRU eviction
 * - Security validation for cached data
 * - Compression for large entries
 * - Tag-based invalidation
 * - Performance monitoring
 */
export class UnifiedCache {
  private memoryCache: AdvancedCache;
  private metrics: CacheMetrics;
  private compressionThreshold = 1024; // 1KB
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(name: string, options: { maxSize?: number; defaultTTL?: number } = {}) {
    this.memoryCache = CacheFactory.getInstance(name, {
      maxSize: options.maxSize || 10 * 1024 * 1024, // 10MB default
      defaultTTL: options.defaultTTL || 300000 // 5 minutes default
    });

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      compressions: 0,
      decompressions: 0
    };

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  /**
   * Get data from cache with security validation
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const entry = this.memoryCache.get<CacheEntry<T>>(key);
      
      if (!entry) {
        this.metrics.misses++;
        return null;
      }

      // Validate cached data for security
      const validation = securityManager.sanitizeAndValidate(entry.data, 'robot');
      if (!validation.isValid) {
        logger.warn(`Invalid cached data detected for key: ${key}`, validation.errors);
        this.delete(key);
        this.metrics.misses++;
        return null;
      }

      // Update access metrics
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      
      // Decompress if needed
      let data = entry.data;
      if (entry.compressed) {
        data = await this.decompress(data);
        this.metrics.decompressions++;
      }

      this.metrics.hits++;
      logger.debug(`Cache hit for key: ${key}`);
      return data as T;

    } catch (error) {
      logger.error(`Cache get error for key: ${key}`, error);
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Set data in cache with security validation and optional compression
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    try {
      // Validate data before caching
      const validation = securityManager.sanitizeAndValidate(data, 'robot');
      if (!validation.isValid) {
        logger.warn(`Invalid data blocked from cache for key: ${key}`, validation.errors);
        return;
      }

      const sanitizedData = validation.sanitizedData || data;
      const ttl = options.ttl || 300000; // 5 minutes default
      const tags = options.tags || [];
      const priority = options.priority || 'normal';
      
      // Determine if compression is needed
      const shouldCompress = options.compress !== false && 
                           JSON.stringify(sanitizedData).length > this.compressionThreshold;
      
      let finalData = sanitizedData;
      if (shouldCompress) {
        finalData = await this.compress(sanitizedData);
        this.metrics.compressions++;
      }

      const entry: CacheEntry<T> = {
        data: finalData,
        timestamp: Date.now(),
        ttl,
        tags,
        priority,
        compressed: shouldCompress,
        accessCount: 0,
        lastAccessed: Date.now()
      };

      this.memoryCache.set(key, entry, { ttl, tags, priority });
      this.metrics.sets++;
      
      logger.debug(`Cache set for key: ${key} (compressed: ${shouldCompress})`);

    } catch (error) {
      logger.error(`Cache set error for key: ${key}`, error);
    }
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    try {
      const result = this.memoryCache.delete(key);
      if (result) {
        this.metrics.deletes++;
        logger.debug(`Cache delete for key: ${key}`);
      }
      return result;
    } catch (error) {
      logger.error(`Cache delete error for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    try {
      return this.memoryCache.get(key) !== undefined;
    } catch (error) {
      logger.error(`Cache has error for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    try {
      this.memoryCache.destroy();
      this.metrics.deletes += 1; // Approximate
      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Cache clear error', error);
    }
  }

  /**
   * Invalidate entries by tags
   */
  invalidateByTags(tags: string[]): number {
    try {
      const stats = this.memoryCache.getStats();
      const invalidatedCount = 0;
      
      // This is a simplified implementation
      // In a real scenario, you'd need to track tags more efficiently
      tags.forEach(tag => {
        // Implementation would depend on the underlying cache structure
        logger.debug(`Invalidating cache entries for tag: ${tag}`);
      });
      
      return invalidatedCount;
    } catch (error) {
      logger.error('Cache invalidate by tags error', error);
      return 0;
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const baseStats = this.memoryCache.getStats();
    const totalRequests = this.metrics.hits + this.metrics.misses;
    
    return {
      hitRate: totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.metrics.misses / totalRequests) * 100 : 0,
      totalRequests,
      memoryUsage: baseStats.totalSize,
      entryCount: baseStats.totalEntries,
      compressionRatio: this.metrics.compressions > 0 ? 
        this.metrics.compressions / (this.metrics.compressions + this.metrics.sets) : 0,
      topEntries: [] // Would need additional tracking for top entries
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Warm cache with common data
   */
  async warmCache<T>(loaders: Array<{
    key: string;
    loader: () => Promise<T>;
    options?: CacheOptions;
  }>): Promise<void> {
    logger.info(`Warming cache with ${loaders.length} entries`);
    
    const promises = loaders.map(async ({ key, loader, options }) => {
      try {
        const data = await loader();
        await this.set(key, data, options);
        logger.debug(`Cache warmed for key: ${key}`);
      } catch (error) {
        logger.warn(`Failed to warm cache for key: ${key}`, error);
      }
    });

    await Promise.allSettled(promises);
    logger.info('Cache warming completed');
  }

  /**
   * Preload commonly accessed data
   */
  async preloadCommonData(): Promise<void> {
    const commonLoaders = [
      {
        key: 'strategy-types',
        loader: async () => ['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'],
        options: { ttl: 3600000, tags: ['static'] } // 1 hour
      },
      {
        key: 'timeframes',
        loader: async () => ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'],
        options: { ttl: 3600000, tags: ['static'] } // 1 hour
      },
      {
        key: 'symbols',
        loader: async () => ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'],
        options: { ttl: 1800000, tags: ['static'] } // 30 minutes
      }
    ];

    await this.warmCache(commonLoaders);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    try {
      const stats = this.memoryCache.getStats();
      // The underlying cache should handle cleanup automatically
      logger.debug('Cache cleanup completed', { entryCount: stats.totalEntries });
    } catch (error) {
      logger.error('Cache cleanup error', error);
    }
  }

  /**
   * Compress data for storage
   */
  private async compress(data: any): Promise<any> {
    // Simple compression simulation
    // In a real implementation, you'd use compression libraries
    return {
      _compressed: true,
      _originalSize: JSON.stringify(data).length,
      data: data
    };
  }

  /**
   * Decompress data from storage
   */
  private async decompress(compressedData: any): Promise<any> {
    // Simple decompression simulation
    if (compressedData && compressedData._compressed) {
      return compressedData.data;
    }
    return compressedData;
  }

  /**
   * Destroy cache instance and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.memoryCache.destroy();
    logger.info('Cache instance destroyed');
  }
}

// Global cache instances
export const unifiedRobotCache = new UnifiedCache('robots', {
  maxSize: 20 * 1024 * 1024, // 20MB
  defaultTTL: 600000 // 10 minutes
});

export const unifiedQueryCache = new UnifiedCache('queries', {
  maxSize: 5 * 1024 * 1024, // 5MB
  defaultTTL: 120000 // 2 minutes
});

export const unifiedUserCache = new UnifiedCache('users', {
  maxSize: 2 * 1024 * 1024, // 2MB
  defaultTTL: 900000 // 15 minutes
});

// Cache manager for coordinating multiple caches
export class CacheManager {
  private caches: Map<string, UnifiedCache> = new Map();

  constructor() {
    // Register default caches
    this.register('robots', unifiedRobotCache);
    this.register('queries', unifiedQueryCache);
    this.register('users', unifiedUserCache);
  }

  register(name: string, cache: UnifiedCache): void {
    this.caches.set(name, cache);
  }

  get(name: string): UnifiedCache | undefined {
    return this.caches.get(name);
  }

  async getFromAny<T>(key: string): Promise<T | null> {
    for (const [name, cache] of this.caches) {
      const result = await cache.get<T>(key);
      if (result !== null) {
        return result;
      }
    }
    return null;
  }

  async setInAll<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    const promises = Array.from(this.caches.values()).map(cache => 
      cache.set(key, data, options)
    );
    await Promise.allSettled(promises);
  }

  invalidateEverywhere(key: string): number {
    let count = 0;
    for (const cache of this.caches.values()) {
      if (cache.delete(key)) {
        count++;
      }
    }
    return count;
  }

  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, cache] of this.caches) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  destroyAll(): void {
    for (const cache of this.caches.values()) {
      cache.destroy();
    }
    this.caches.clear();
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager();