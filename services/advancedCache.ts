import { COUNT_CONSTANTS } from './modularConstants';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  tags: string[];
  compressed?: boolean;
}

export interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  compressionThreshold: number; // Size threshold for compression
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  compressions: number;
}

import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { createScopedLogger } from '../utils/logger';
import { CACHE_TTLS, TIME_CONSTANTS, CACHE_SIZES } from './constants';

const logger = createScopedLogger('AdvancedCache');

export class AdvancedCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressions: 0,
  };
  private config: CacheConfig = {
    maxSize: CACHE_SIZES.LARGE_MB, // 10MB (reduced for edge)
    maxEntries: 500, // Reduced entries
    defaultTTL: CACHE_TTLS.THREE_MINUTES, // 3 minutes (shorter for edge)
    cleanupInterval: TIME_CONSTANTS.SECOND * 30, // 30 seconds
    compressionThreshold: 512, // 0.5KB (more aggressive)
  };
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.startCleanup();
  }

  // Get data from cache
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.stats.hits++;
    
    // Decompress if needed
    if (entry.compressed) {
      try {
        return decompressFromUTF16(entry.data as string) as T;
      } catch (error: unknown) {
        logger.warn(`Failed to decompress cache entry: ${key}`, error);
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }
    }
    
    return entry.data;
  }

  // Set data in cache
  set<T>(key: string, data: T, options?: {
    ttl?: number;
    tags?: string[];
    priority?: 'low' | 'normal' | 'high';
  }): void {
    const serializedData = JSON.stringify(data);
    const size = new Blob([serializedData]).size;
    
    // Check if data is too large
    if (size > this.config.maxSize) {
      logger.warn(`Cache entry too large: ${key} (${size} bytes)`);
      return;
    }

    let processedData = data;
    let compressed = false;

    // Compress large entries
    if (size > this.config.compressionThreshold) {
      try {
        processedData = compressToUTF16(serializedData) as T;
        compressed = true;
        this.stats.compressions++;
      } catch (error: unknown) {
        logger.warn(`Failed to compress cache entry: ${key}`, error);
      }
    }

    const entry: CacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl: options?.ttl || this.config.defaultTTL,
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      tags: options?.tags || [],
      compressed,
    };

    // Ensure cache size limits
    this.ensureCapacity(size);

    this.cache.set(key, entry);
  }

  // Delete cache entry
  delete(key: string): boolean {
    return this.cache.delete(key);
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
    
    return deletedCount;
  }

  // Get cache statistics
  getStats(): CacheStats {
    const totalEntries = this.cache.size;
    const totalSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      totalEntries,
      totalSize,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0,
      evictions: this.stats.evictions,
      compressions: this.stats.compressions,
    };
  }

  // Get cache entries sorted by access frequency
  getHotEntries(limit: number = COUNT_CONSTANTS.PAGINATION.SMALL): Array<{ key: string; entry: CacheEntry<any> }> {
    return Array.from(this.cache.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, limit)
      .map(([key, entry]) => ({ key, entry }));
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
        this.set(key, data, { ttl: ttl || CACHE_TTLS.FIVE_MINUTES, tags: tags || [] });
      } catch (error: unknown) {
        logger.warn(`Failed to preload cache entry: ${key}`, error);
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
this.set(key, data, { ttl: ttl || CACHE_TTLS.FIVE_MINUTES, tags: tags || [] });
        } catch (error: unknown) {
          logger.warn(`Failed to warm cache entry: ${key}`, error);
        }
      }
    }
  }

  private ensureCapacity(newEntrySize: number): void {
    let currentSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);

    // Remove expired entries first
    this.removeExpiredEntries();

    // Recalculate size after cleanup
    currentSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);

    // If still over capacity, remove least recently used entries
    while (
      (currentSize + newEntrySize > this.config.maxSize) ||
      this.cache.size >= this.config.maxEntries
    ) {
      const lruKey = this.getLRUKey();
      if (lruKey) {
        const removedEntry = this.cache.get(lruKey);
        if (removedEntry) {
          currentSize -= removedEntry.size;
          this.cache.delete(lruKey);
          this.stats.evictions++;
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

  private enforceMaxSize(): void {
    // Check total size
    let totalSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
    
    // Remove entries if over size limit
    while (totalSize > this.config.maxSize && this.cache.size > 0) {
      const lruKey = this.getLRUKey();
      if (lruKey) {
        const entry = this.cache.get(lruKey);
        if (entry) {
          totalSize -= entry.size;
          this.cache.delete(lruKey);
          this.stats.evictions++;
        }
      } else {
        break;
      }
    }
    
    // Remove entries if over count limit
    while (this.cache.size > this.config.maxEntries) {
      const lruKey = this.getLRUKey();
      if (lruKey) {
        this.cache.delete(lruKey);
        this.stats.evictions++;
      } else {
        break;
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

  // Compression methods now use lz-string library

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.removeExpiredEntries();
      this.enforceMaxSize();
    }, this.config.cleanupInterval);
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

    logger.log(`[EdgeCache] Invalidated ${deletedCount} entries for region: ${region}`);
    return deletedCount;
  }

  // Get edge-specific cache statistics
  getEdgeStats(): { [region: string]: { entries: number; size: number; hitRate: number } } {
    const edgeStats: { [region: string]: { entries: number; size: number; hitRate: number } } = {};
    const regions = ['hkg1', 'iad1', 'sin1', 'cle1', 'fra1'];
    
    for (const region of regions) {
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
    const edgeRegions = ['hkg1', 'iad1', 'sin1', 'cle1', 'fra1'];
    
    for (const region of edgeRegions) {
      try {
        // Pre-warm region-specific cache entries
        const regionKey = `edge_${region}_warm`;
        this.set(regionKey, {
          warmed: true,
          timestamp: Date.now(),
          region,
          metrics: {
            hitRate: 0,
            lastAccess: Date.now()
          }
        }, {
          ttl: CACHE_TTLS.FIVE_MINUTES,
          tags: ['edge', region, 'warm']
        });

        // Pre-warm common query patterns for this region
        const commonQueries = [
          `robots_list_${region}`,
          `user_sessions_${region}`,
          `market_data_${region}`
        ];

        for (const queryKey of commonQueries) {
          this.set(queryKey, {
            cached: true,
            region,
            timestamp: Date.now()
          }, {
            ttl: CACHE_TTLS.THREE_MINUTES,
            tags: ['edge', region, 'query']
          });
        }

        logger.log(`Edge cache warmed for region: ${region}`);
      } catch (error: unknown) {
        logger.warn(`Failed to warm edge cache for region ${region}:`, error);
      }
    }
  }

  // Cleanup and destroy
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// Cache factory for different data types
export class CacheFactory {
  private static instances = new Map<string, AdvancedCache>();

  static getInstance(name: string, config?: Partial<CacheConfig>): AdvancedCache {
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
export const robotCache = CacheFactory.getInstance('robots', {
  maxSize: CACHE_SIZES.LARGE_MB, // 10MB
  defaultTTL: CACHE_TTLS.FIVE_MINUTES,
});

export const queryCache = CacheFactory.getInstance('queries', {
  maxSize: CACHE_SIZES.MEDIUM_MB, // 5MB
  defaultTTL: CACHE_TTLS.ONE_MINUTE,
});

export const userCache = CacheFactory.getInstance('users', {
  maxSize: CACHE_SIZES.SMALL_MB, // 2MB
  defaultTTL: CACHE_TTLS.FIFTEEN_MINUTES,
});

// Cleanup on page unload to prevent memory leaks
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    CacheFactory.destroyAll();
  });
}