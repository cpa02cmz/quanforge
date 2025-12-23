/**
 * Unified Cache Manager Implementation
 * Replaces UnifiedCacheManager with enhanced edge optimization and strategies
 */

import { BaseCache, BaseCacheEntry, CacheConfig, CacheStrategy, CompressionUtils, CACHE_CONSTANTS } from './__init__';

interface UnifiedCacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  compressions: number;
  hitRate: number;
  memoryUsage: number;
  avgAccessTime: number;
  regionStats: Record<string, { hits: number; misses: number }>;
  tagStats: Record<string, number>;
}

export class UnifiedCacheManager extends BaseCache {
  private storageKey = 'quantforge-unified-cache';
  private regionStats: Record<string, { hits: number; misses: number }> = {};
  private tagStats: Record<string, number> = {};

  constructor(config: CacheConfig = {}) {
    super({
      maxSize: CACHE_CONSTANTS.UNIFIED_CACHE_SIZE,
      maxMemorySize: CACHE_CONSTANTS.UNIFIED_MEMORY_SIZE,
      defaultTTL: CACHE_CONSTANTS.UNIFIED_TTL,
      enablePersistence: true,
      syncAcrossTabs: true,
      ...config
    });
    
    if (this.config.enablePersistence) {
      this.loadFromStorage();
    }

    if (this.config.syncAcrossTabs && typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange);
    }
  }

  // Register a caching strategy
  registerStrategy(name: string, strategy: CacheStrategy): void {
    this.strategies.set(name, strategy);
  }

  // Get data from cache with enhanced edge optimization
  async get<T = any>(key: string, region?: string): Promise<T | null> {
    const startTime = performance.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.recordMiss();
      this.recordRegionHit(region, false);
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.recordMiss();
      this.recordRegionHit(region, false);
      return null;
    }

    // Check region specificity
    if ((entry as any).region && (entry as any).region !== region) {
      this.recordMiss();
      this.recordRegionHit(region, false);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Decompress if needed
    let data: any = entry.data;
    if (entry.compressed) {
      try {
        const decompressed = await CompressionUtils.decompress(entry.data, entry.compressed);
        data = decompressed;
      } catch (error) {
        console.warn('Failed to decompress cached data:', error);
        this.cache.delete(key);
        this.recordMiss();
        this.recordRegionHit(region, false);
        return null;
      }
    }

    this.recordHit();
    this.recordRegionHit(region, true);
    this.recordAccessTime(performance.now() - startTime);
    this.updateTagStats(entry.tags, 'hit');

    return data as T;
  }

  // Set data in cache with enhanced edge optimization
  async set<T = any>(
    key: string,
    data: T,
    ttl?: number,
    tags: string[] = [],
    region?: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<void> {
    // Check if we should cache this entry
    if (!this.shouldCacheEntry(key, data)) {
      return;
    }

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
        console.warn('Compression failed:', error);
      }
    }

    // Ensure capacity
    await this.ensureCapacity(size);

    // Create cache entry
    const finalTTL = ttl || this.getTTLForEntry(key, data);
    const entry: BaseCacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl: finalTTL,
      accessCount: 0,
      lastAccessed: Date.now(),
      tags,
      compressed,
      size,
      priority
    };

    // Add region-specific data if provided
    if (region) {
      (entry as any).region = region;
    }

    this.cache.set(key, entry);
    this.metrics.sets++;
    this.updateMemoryUsage();
    this.updateTagStats(tags, 'set');

    if (this.config.enablePersistence) {
      this.saveToStorage();
    }
  }

  // Get cache metrics with enhanced region and tag stats
  getMetrics(): UnifiedCacheMetrics {
    const baseMetrics = this.getMetrics();
    this.updateHitRate();
    this.updateAvgAccessTime();
    
    return {
      ...baseMetrics,
      regionStats: { ...this.regionStats },
      tagStats: { ...this.tagStats }
    };
  }

  // Enhanced utility-based eviction
  protected async ensureCapacity(requiredSize: number): Promise<void> {
    while (this.shouldEvict(requiredSize)) {
      await this.evictLeastUseful();
    }
  }

  protected shouldEvict(requiredSize: number): boolean {
    return (
      this.cache.size >= this.config.maxSize ||
      this.metrics.memoryUsage + requiredSize > this.config.maxMemorySize
    );
  }

  private async evictLeastUseful(): Promise<void> {
    const entries = Array.from(this.cache.entries());
    
    // Calculate utility score for each entry
    const scoredEntries = entries.map(([key, entry]) => {
      const age = Date.now() - entry.timestamp;
      const timeSinceAccess = Date.now() - entry.lastAccessed;
      const accessFrequency = entry.accessCount / (age / 1000 || 1);
      
      // Priority weights
      const priorityWeight = entry.priority === 'high' ? 1000 : 
                           entry.priority === 'medium' ? 500 : 100;
      
      // Utility score: higher is more useful
      const utilityScore = (
        accessFrequency * 100 + // Access frequency weight
        priorityWeight + // Priority weight
        (entry.size / 1024) * -1 + // Size penalty
        (timeSinceAccess / 1000) * -10 // Recent access bonus
      );

      return { key, entry, utilityScore };
    });

    // Sort by utility score (lowest first)
    scoredEntries.sort((a, b) => a.utilityScore - b.utilityScore);

    // Evict least useful entries (bottom 10%)
    const toEvict = Math.ceil(scoredEntries.length * 0.1);
    for (let i = 0; i < toEvict && i < scoredEntries.length; i++) {
      const scoreEntry = scoredEntries[i];
      if (!scoreEntry) continue;
      
      this.cache.delete(scoreEntry.key);
      this.metrics.evictions++;
      this.updateTagStats(scoreEntry.entry.tags, 'evict');
    }

    this.updateMemoryUsage();
  }

  // Invalidate entries by tags
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        this.cache.delete(key);
        invalidated++;
        this.updateTagStats(entry.tags, 'invalidate');
      }
    }

    this.metrics.deletes += invalidated;
    this.updateMemoryUsage();

    if (invalidated > 0 && this.config.enablePersistence) {
      this.saveToStorage();
    }

    return invalidated;
  }

  // Invalidate entries by region
  async invalidateByRegion(region: string): Promise<number> {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if ((entry as any).region === region) {
        this.cache.delete(key);
        invalidated++;
        this.updateTagStats(entry.tags, 'invalidate');
      }
    }

    this.metrics.deletes += invalidated;
    this.updateMemoryUsage();

    if (invalidated > 0 && this.config.enablePersistence) {
      this.saveToStorage();
    }

    return invalidated;
  }

  // Record region-specific data
  private recordRegionHit(region?: string, hit: boolean) {
    if (region) {
      if (!this.regionStats[region]) {
        this.regionStats[region] = { hits: 0, misses: 0 };
      }
      
      if (hit) {
        this.regionStats[region].hits++;
      } else {
        this.regionStats[region].misses++;
      }
    }
  }

  // Update tag statistics
  private updateTagStats(tags: string[], operation: 'hit' | 'set' | 'delete' | 'invalidate' | 'evict' | 'expire'): void {
    tags.forEach(tag => {
      if (!this.tagStats[tag]) {
        this.tagStats[tag] = 0;
      }
      
      switch (operation) {
        case 'hit':
        case 'set':
          this.tagStats[tag]++;
          break;
        case 'delete':
        case 'invalidate':
        case 'evict':
        case 'expire':
          this.tagStats[tag] = Math.max(0, this.tagStats[tag] - 1);
          break;
      }
    });
  }

  // Save cache to localStorage
  private saveToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const serializable = Array.from(this.cache.entries()).map(([key, entry]) => [
          key,
          {
            ...entry,
            data: entry.compressed ? entry.data : JSON.stringify(entry.data)
          }
        ]);
        localStorage.setItem(this.storageKey, JSON.stringify(serializable));
      } catch (error) {
        console.error('Failed to save cache to storage:', error);
      }
    }
  }

  // Load cache from localStorage
  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          this.cache = new Map(data.map(([key, entry]: [string, any]) => [
            key,
            {
              ...entry,
              data: entry.compressed ? entry.data : JSON.parse(entry.data)
            }
          ]));
          this.updateMemoryUsage();
        }
      } catch (error) {
        console.error('Failed to load cache from storage:', error);
      }
    }
  }

  // Handle storage changes for tab sync
  private handleStorageChange = (event: StorageEvent) => {
    if (event.key === this.storageKey && event.newValue) {
      try {
        const data = JSON.parse(event.newValue);
        this.cache = new Map(data.map(([key, entry]: [string, any]) => [
          key,
          {
            ...entry,
            data: entry.compressed ? entry.data : JSON.parse(entry.data)
          }
        ]));
        this.updateMemoryUsage();
      } catch (error) {
        console.error('Failed to sync cache from storage:', error);
      }
    }
  };

  // Destroy cache manager
  destroy(): void {
    super.destroy();
    
    if (this.config.syncAcrossTabs && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange);
    }
  }
}

// Predefined strategies
export const CacheStrategies = {
  // Strategy for API responses
  API_RESPONSE: {
    name: 'api_response',
    shouldCache: (_key: string, data: any) => {
      // Don't cache error responses
      return !data || !data.error;
    },
    getTTL: (_key: string, data: any) => {
      // Cache successful responses longer
      return data && data.success ? 10 * 60 * 1000 : 2 * 60 * 1000; // 10min vs 2min
    }
  },

  // Strategy for AI responses
  AI_RESPONSE: {
    name: 'ai_response',
    shouldCache: (_key: string, data: any) => {
      // Don't cache empty or error responses
      return data && data.content && data.content.length > 0;
    },
    getTTL: (_key: string, data: any) => {
      // Cache based on content length
      const length = data?.content?.length || 0;
      return length > 1000 ? 30 * 60 * 1000 : 15 * 60 * 1000; // 30min vs 15min
    }
  },

  // Strategy for user data
  USER_DATA: {
    name: 'user_data',
    shouldCache: (_key: string, _data: any) => {
      // Always cache user data
      return true;
    },
    getTTL: (_key: string, _data: any) => {
      // User data changes frequently
      return 5 * 60 * 1000; // 5 minutes
    }
  },

  // Strategy for static data
  STATIC_DATA: {
    name: 'static_data',
    shouldCache: (_key: string, _data: any) => {
      return true;
    },
    getTTL: (_key: string, _data: any) => {
      // Static data can be cached longer
      return 60 * 60 * 1000; // 1 hour
    }
  }
} as const;

// Global cache instance
export const globalCache = new UnifiedCacheManager({
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000,
  enableMetrics: process.env.NODE_ENV === 'development',
  enableCompression: false
});

// Register default strategies
Object.entries(CacheStrategies).forEach(([name, strategy]) => {
  globalCache.registerStrategy(name, strategy);
});

// Enhanced convenience functions
export const cacheGet = <T>(key: string, region?: string): Promise<T | null> => 
  globalCache.get<T>(key, region);

export const cacheSet = <T>(
  key: string, 
  data: T, 
  options?: {
    ttl?: number; 
    tags?: string[]; 
    region?: string;
    priority?: 'high' | 'medium' | 'low';
  }
): Promise<void> => 
  globalCache.set(key, data, options?.ttl, options?.tags || [], options?.region, options?.priority);

export const cacheDelete = (key: string): Promise<boolean> => 
  globalCache.delete(key);

export const cacheClear = (): Promise<void> => 
  globalCache.clear();

export const cacheHas = (key: string): boolean => 
  globalCache.has(key);

export const cacheMetrics = () => 
  globalCache.getMetrics();

export const cacheInvalidateByTags = (tags: string[]): Promise<number> => 
  globalCache.invalidateByTags(tags);

export const cacheInvalidateByRegion = (region: string): Promise<number> => 
  globalCache.invalidateByRegion(region);