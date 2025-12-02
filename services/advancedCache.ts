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

interface CacheConfig {
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

class AdvancedCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressions: 0,
  };
  private config: CacheConfig = {
    maxSize: 50 * 1024 * 1024, // 50MB
    maxEntries: 1000,
    defaultTTL: 300000, // 5 minutes
    cleanupInterval: 60000, // 1 minute
    compressionThreshold: 1024, // 1KB
  };
  private cleanupTimer: NodeJS.Timeout | null = null;

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
      } catch (error) {
        console.warn(`Failed to decompress cache entry: ${key}`, error);
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
      console.warn(`Cache entry too large: ${key} (${size} bytes)`);
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
      } catch (error) {
        console.warn(`Failed to compress cache entry: ${key}`, error);
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
  getHotEntries(limit: number = 10): Array<{ key: string; entry: CacheEntry<any> }> {
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
        this.set(key, data, { ttl, tags });
      } catch (error) {
        console.warn(`Failed to preload cache entry: ${key}`, error);
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
          this.set(key, data, { ttl, tags });
        } catch (error) {
          console.warn(`Failed to warm cache entry: ${key}`, error);
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

  // Adaptive cache eviction based on access patterns
  private adaptEvictionPolicy(): void {
    // Calculate access patterns and adjust eviction strategy
    const accessCounts = Array.from(this.cache.values()).map(entry => entry.accessCount);
    if (accessCounts.length === 0) return;
    
    const avgAccess = accessCounts.reduce((sum, count) => sum + count, 0) / accessCounts.length;
    const maxAccess = Math.max(...accessCounts);
    
    // If there's a big difference between most and least accessed items,
    // we should be more aggressive about keeping frequently accessed items
    if (maxAccess > avgAccess * 2) {
      // Trim the cache more aggressively to keep only high-value items
      this.trimCacheAggressively();
    }
  }
  
  private trimCacheAggressively(): void {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => {
        // Prioritize by access count first, then by recency
        const accessDiff = b.entry.accessCount - a.entry.accessCount;
        if (accessDiff !== 0) return accessDiff;
        return b.entry.lastAccessed - a.entry.lastAccessed;
      });
    
    // Keep only the top 70% most valuable entries
    const keepCount = Math.max(10, Math.floor(entries.length * 0.7)); // Keep at least 10 entries
    const entriesToKeep = new Set(entries.slice(0, keepCount).map(item => item.key));
    
    for (const [key] of this.cache) {
      if (!entriesToKeep.has(key)) {
        this.cache.delete(key);
        this.stats.evictions++;
      }
    }
  }

  // Compression methods now use lz-string library

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.removeExpiredEntries();
    }, this.config.cleanupInterval);
  }

  // Get cache efficiency metrics


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
    for (const [name, instance] of this.instances) {
      instance.destroy();
    }
    this.instances.clear();
  }
}

// Pre-configured cache instances
export const robotCache = CacheFactory.getInstance('robots', {
  maxSize: 10 * 1024 * 1024, // 10MB
  defaultTTL: 300000, // 5 minutes
});

export const queryCache = CacheFactory.getInstance('queries', {
  maxSize: 5 * 1024 * 1024, // 5MB
  defaultTTL: 60000, // 1 minute
});

export const userCache = CacheFactory.getInstance('users', {
  maxSize: 2 * 1024 * 1024, // 2MB
  defaultTTL: 900000, // 15 minutes
});

// Cleanup on page unload to prevent memory leaks
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    CacheFactory.destroyAll();
  });
}