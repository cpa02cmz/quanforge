/**
 * Advanced Cache Implementation
 * Replaces AdvancedCache with edge optimization and compression features
 */

import { BaseCache, BaseCacheEntry, CacheConfig, CompressionUtils, CACHE_CONSTANTS } from './__init__';
import { createScopedLogger } from '../../utils/logger';
import { CACHE_CONFIG, TIME_CONSTANTS } from '../../constants/config';

const logger = createScopedLogger('advancedCache');

export interface AdvancedCacheConfig extends CacheConfig {
  maxSize: number;
  maxEntries: number;
  compressionThreshold: number;
}

interface AdvancedCacheEntry<T = any> extends BaseCacheEntry<T> {
  compressed: boolean;
}

interface AdvancedCacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  compressions: number;
}

export class AdvancedCache extends BaseCache {
  constructor(config?: Partial<AdvancedCacheConfig>) {
    super({
      maxSize: CACHE_CONSTANTS.ADVANCED_CACHE_SIZE,
      maxMemorySize: CACHE_CONSTANTS.ADVANCED_MEMORY_SIZE,
      defaultTTL: CACHE_CONSTANTS.ADVANCED_TTL,
      compressionThreshold: 512, // 0.5KB (more aggressive for edge)
      enableCompression: true,
      ...config
    });
  }

  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();
    const entry = this.cache.get(key) as AdvancedCacheEntry<T>;
    
    if (!entry) {
      this.recordMiss();
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.recordMiss();
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    // Move to end (LRU)
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

  async set<T = any>(
    key: string,
    data: T,
    options?: {
      ttl?: number;
      tags?: string[];
      priority?: 'low' | 'normal' | 'high';
    }
  ): Promise<void> {
    if (!this.shouldCacheEntry(key, data)) {
      return;
    }

    const serializedData = JSON.stringify(data);
    const size = new Blob([serializedData]).size;
    
    // Check if data is too large
    if (size > this.config.maxSize) {
      logger.warn(`Cache entry too large: ${key} (${size} bytes)`);
      return;
    }

    // Process data (compression if needed)
    let processedData: any = data;
    let compressed = false;
    let finalSize = size;

    if (this.config.enableCompression && size > this.config.compressionThreshold) {
      try {
        const compressionResult = await CompressionUtils.compress(data);
        processedData = compressionResult.data;
        compressed = compressionResult.compressed;
        finalSize = compressionResult.size;
        
        if (compressed) {
          this.metrics.compressions++;
        }
      } catch (error) {
        logger.warn(`Failed to compress cache entry: ${key}`, error);
      }
    }

    const ttl = options?.ttl || this.getTTLForEntry(key, data);
    
    const entry: AdvancedCacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now(),
      size: finalSize,
      tags: options?.tags || [],
      compressed,
      priority: this.mapPriority(options?.priority || 'normal')
    };

    // Ensure cache size limits
    await this.ensureCapacity(finalSize);

    this.cache.set(key, entry);
    this.metrics.sets++;
    this.updateMemoryUsage();
  }

  private mapPriority(priority: 'low' | 'normal' | 'high'): 'high' | 'medium' | 'low' {
    switch (priority) {
      case 'high': return 'high';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  // Advanced cache statistics
  getStats(): AdvancedCacheStats {
    const metrics = this.getMetrics();
    const totalEntries = this.cache.size;
    const totalSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = metrics.hits + metrics.misses;
    
    return {
      totalEntries,
      totalSize,
      hitRate: totalRequests > 0 ? (metrics.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (metrics.misses / totalRequests) * 100 : 0,
      evictions: metrics.evictions,
      compressions: metrics.compressions,
    };
  }

  // Get cache entries sorted by access frequency
  getHotEntries(limit: number = 10): Array<{ key: string; entry: AdvancedCacheEntry<any> }> {
    return Array.from(this.cache.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, limit)
      .map(([key, entry]) => ({ 
        key, 
        entry: {
          ...entry,
          compressed: entry.compressed || false
        }
      }));
  }

  // Preload cache with common queries
  async preload<T>(entries: Array<{
    key: string;
    loader: () => Promise<T>;
    ttl?: number;
    tags?: string[];
  }>): Promise<void> {
    const promises = entries.map(async ({ key, loader, ttl, tags }) => {
      try {
        const data = await loader();
        await this.set(key, data, { ttl: ttl || 300000, tags: tags || [] });
      } catch (error) {
         if (process.env.NODE_ENV === 'development') {
           logger.warn(`Failed to preload cache entry: ${key}`, error);
         }
      }
    });

    await Promise.allSettled(promises);
  }

  // Cache warming strategy
  async warmCache<T>(loaders: Array<{
    pattern: string;
    loader: (params: any) => Promise<T>;
    paramsList: any[];
    ttl?: number;
    tags?: string[];
  }>): Promise<void> {
    for (const { pattern, loader, paramsList, ttl, tags } of loaders) {
      for (const params of paramsList) {
        const key = `${pattern}:${JSON.stringify(params)}`;
        try {
          const data = await loader(params);
          await this.set(key, data, { ttl: ttl || 300000, tags: tags || [] });
        } catch (error) {
          logger.warn(`Failed to warm cache entry: ${key}`, error);
        }
      }
    }
  }

  // Capacity management
  protected async ensureCapacity(newEntrySize: number): Promise<void> {
    let currentSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);

    // Remove expired entries first
    this.removeExpiredEntries();

    // Recalculate size after cleanup
    currentSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);

    // If still over capacity, remove least recently used entries
    while (
      (currentSize + newEntrySize > this.config.maxMemorySize) ||
      this.cache.size >= this.config.maxSize
    ) {
      const lruKey = this.getLRUKey();
      if (lruKey) {
        const removedEntry = this.cache.get(lruKey);
        if (removedEntry) {
          currentSize -= removedEntry.size;
          this.cache.delete(lruKey);
          this.metrics.evictions++;
        }
      } else {
        break;
      }
    }
  }

  private removeExpiredEntries(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private getLRUKey(): string | null {
    let lruKey: string | null = null;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    return lruKey;
  }

  // Clear cache by tags
  clearByTags(tags: string[]): number {
    let deletedCount = 0;
    
    for (const [key, entry] of this.cache) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    this.metrics.evictions += deletedCount;
    this.updateMemoryUsage();
    return deletedCount;
  }

  // Add edge-specific cache invalidation
  invalidateForEdgeRegion(region: string): number {
    const regionKeys = Array.from(this.cache.keys())
      .filter(key => key.includes(`_${region}`) || key.includes(`region_${region}`));
    let deletedCount = 0;
    
    regionKeys.forEach(key => {
      if (this.cache.delete(key)) {
        deletedCount++;
      }
    });
    
     // Use logger instead of logger.log for production safety
     if (process.env.NODE_ENV === 'development') {
       logger.log(`Invalidated ${deletedCount} cache entries for region: ${region}`);
     }
    return deletedCount;
  }

  // Get edge-specific cache statistics
  getEdgeStats(): { [region: string]: { entries: number; size: number; hitRate: number } } {
    const edgeStats: { [region: string]: { entries: number; size: number; hitRate: number } } = {};
    
    for (const region of CACHE_CONSTANTS.EDGE_REGIONS) {
      const regionKeys = Array.from(this.cache.entries())
        .filter(([key]) => key.includes(`_${region}`) || key.includes(`region_${region}`));
      
      const entries = regionKeys.length;
      const size = regionKeys.reduce((sum, [, entry]) => sum + entry.size, 0);
      const totalAccess = regionKeys.reduce((sum, [, entry]) => sum + entry.accessCount, 0);
      const hitRate = entries > 0 ? (totalAccess / entries) * 100 : 0;
      
      edgeStats[region] = { entries, size, hitRate };
    }
    
    return edgeStats;
  }

  // Edge-optimized cache warming
  async warmEdgeCache(): Promise<void> {
    for (const region of CACHE_CONSTANTS.EDGE_REGIONS) {
      try {
        // Pre-warm region-specific cache entries
        const regionKey = `edge_${region}_warm`;
        await this.set(regionKey, {
          warmed: true,
          timestamp: Date.now(),
          region,
          metrics: {
            hitRate: 0,
            lastAccess: Date.now()
          }
        }, {
          ttl: 300000, // 5 minutes
          tags: ['edge', region, 'warm']
        });

        // Pre-warm common query patterns for this region
        const commonQueries = [
          `robots_list_${region}`,
          `user_sessions_${region}`,
          `market_data_${region}`
        ];

        for (const queryKey of commonQueries) {
          await this.set(queryKey, {
            cached: true,
            region,
            timestamp: Date.now()
          }, {
            ttl: 180000, // 3 minutes
            tags: ['edge', region, 'query']
          });
        }

        logger.log(`Edge cache warmed for region: ${region}`);
      } catch (error) {
        logger.warn(`Failed to warm edge cache for region ${region}:`, error);
      }
    }
  }
}

// Cache factory for different data types
export class CacheFactory {
  private static instances = new Map<string, AdvancedCache>();

  static getInstance(name: string, config?: Partial<AdvancedCacheConfig>): AdvancedCache {
    if (!this.instances.has(name)) {
      this.instances.set(name, new AdvancedCache(config));
    }
    return this.instances.get(name)!;
  }

  static destroyInstance(name: string): void {
    const instance = this.instances.get(name);
    if (instance) {
      instance.destroy();
      this.instances.delete(name);
    }
  }

  static destroyAll(): void {
    for (const [, instance] of this.instances) {
      instance.destroy();
    }
    this.instances.clear();
  }
}

// Pre-configured cache instances
export const advancedRobotCache = CacheFactory.getInstance('robots', {
  maxSize: CACHE_CONFIG.MAX_CACHE_MEMORY_SIZE, // 10MB
  defaultTTL: TIME_CONSTANTS.CACHE_DEFAULT_TTL, // 5 minutes
});

export const queryCache = CacheFactory.getInstance('queries', {
  maxSize: CACHE_CONFIG.MAX_CACHE_MEMORY_SIZE / 2, // 5MB
  defaultTTL: TIME_CONSTANTS.CLEANUP_DEFAULT_INTERVAL, // 1 minute
});

export const userCache = CacheFactory.getInstance('users', {
  maxSize: CACHE_CONFIG.MAX_CACHE_MEMORY_SIZE / 5, // 2MB
  defaultTTL: TIME_CONSTANTS.CACHE_MEDIUM_TTL, // 15 minutes
});

// Cleanup on page unload to prevent memory leaks
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    CacheFactory.destroyAll();
  });
}