// Unified cache interface with enhanced edge optimization
import { compress, decompress } from 'lz-string';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  tags: string[];
  region?: string;
  compressed?: boolean;
  size: number;
  etag?: string;
  priority: 'high' | 'medium' | 'low';
}

interface CacheOptions {
  maxSize?: number;
  maxMemorySize?: number;
  defaultTTL?: number;
  cleanupInterval?: number;
  compressionThreshold?: number;
  enableCompression?: boolean;
  enableMetrics?: boolean;
  enablePersistence?: boolean;
  syncAcrossTabs?: boolean;
}

interface CacheMetrics {
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

interface CacheStrategy {
  name: string;
  shouldCache: (key: string, data: any) => boolean;
  getTTL: (key: string, data: any) => number;
  onEvict?: (key: string, data: any) => void;
}

// Enhanced Unified Cache Manager for edge optimization
export class UnifiedCacheManager {
  private cache = new Map<string, CacheEntry>();
  private strategies = new Map<string, CacheStrategy>();
  private metrics: CacheMetrics;
  private options: Required<CacheOptions>;
  private cleanupTimer: number | null = null;
  private accessTimes: number[] = [];
  private storageKey = 'quantforge-unified-cache';

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: 1000,
      maxMemorySize: 10 * 1024 * 1024, // 10MB
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      compressionThreshold: 1024, // 1KB
      enableCompression: true,
      enableMetrics: true,
      enablePersistence: true,
      syncAcrossTabs: true,
      ...options
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      compressions: 0,
      hitRate: 0,
      memoryUsage: 0,
      avgAccessTime: 0,
      regionStats: {},
      tagStats: {}
    };

    this.startCleanup();
    
    if (this.options.enablePersistence) {
      this.loadFromStorage();
    }

    if (this.options.syncAcrossTabs && typeof window !== 'undefined') {
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
      this.recordMiss(region);
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.recordMiss(region);
      return null;
    }

    // Check region specificity
    if (entry.region && entry.region !== region) {
      this.recordMiss(region);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Decompress if needed
    let data: any = entry.data;
    if (entry.compressed) {
      try {
        const decompressed = await decompress(entry.data);
        data = JSON.parse(decompressed);
      } catch (error) {
        console.warn('Failed to decompress cached data:', error);
        this.cache.delete(key);
        this.recordMiss(region);
        return null;
      }
    }

    this.recordHit(region);
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
    // Process data (compression if needed)
    let processedData: any = data;
    let compressed = false;
    let size = this.calculateSize(data);

    if (this.options.enableCompression && size > this.options.compressionThreshold) {
      try {
        const jsonString = JSON.stringify(data);
        const compressedData = compress(jsonString);
        const compressedSize = compressedData.length * 2;

        // Only use compression if it reduces size
        if (compressedSize < size * 0.8) {
          processedData = compressedData;
          compressed = true;
          size = compressedSize;
          this.metrics.compressions++;
        }
      } catch (error) {
        console.warn('Compression failed:', error);
      }
    }

    // Ensure capacity
    await this.ensureCapacity(size);

    // Create cache entry
    const entry: CacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl: ttl || this.options.defaultTTL,
      accessCount: 0,
      lastAccessed: Date.now(),
      tags,
      region,
      compressed,
      size,
      priority
    };

    this.cache.set(key, entry);
    this.metrics.sets++;
    this.updateMemoryUsage();
    this.updateTagStats(tags, 'set');

    if (this.options.enablePersistence) {
      this.saveToStorage();
    }
  }

  // Delete data from cache
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.metrics.deletes++;
      this.updateMemoryUsage();
      
      if (entry) {
        this.updateTagStats(entry.tags, 'delete');
      }
      
      if (this.options.enablePersistence) {
        this.saveToStorage();
      }
    }
    
    return deleted;
  }

  // Clear all cache
  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.metrics.deletes += size;
    this.updateMemoryUsage();

    if (this.options.enablePersistence) {
      this.removeFromStorage();
    }
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  // Get cache size
  size(): number {
    return this.cache.size;
  }

  // Get all keys
  keys(): string[] {
    return Array.from(this.cache.keys());
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

    if (invalidated > 0 && this.options.enablePersistence) {
      this.saveToStorage();
    }

    return invalidated;
  }

  // Invalidate entries by region
  async invalidateByRegion(region: string): Promise<number> {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.region === region) {
        this.cache.delete(key);
        invalidated++;
        this.updateTagStats(entry.tags, 'invalidate');
      }
    }

    this.metrics.deletes += invalidated;
    this.updateMemoryUsage();

    if (invalidated > 0 && this.options.enablePersistence) {
      this.saveToStorage();
    }

    return invalidated;
  }

  // Get cache metrics
  getMetrics(): CacheMetrics {
    this.updateHitRate();
    this.updateAvgAccessTime();
    return { ...this.metrics };
  }

  // Enhanced utility-based eviction
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
      const entry = scoredEntries[i];
      if (!entry) continue;
      
      this.cache.delete(entry.key);
      this.metrics.evictions++;
      this.updateTagStats(entry.entry.tags, 'evict');
    }

    this.updateMemoryUsage();
  }

  // Ensure cache capacity with intelligent eviction
  private async ensureCapacity(requiredSize: number): Promise<void> {
    while (this.shouldEvict(requiredSize)) {
      await this.evictLeastUseful();
    }
  }

  // Determine if eviction is needed
  private shouldEvict(requiredSize: number): boolean {
    return (
      this.cache.size >= this.options.maxSize ||
      this.metrics.memoryUsage + requiredSize > this.options.maxMemorySize
    );
  }

  // Calculate approximate size of data
  private calculateSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2; // UTF-16
    }
    return JSON.stringify(data).length * 2;
  }

  // Start cleanup timer
  private startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = window.setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      const entry = this.cache.get(key);
      this.cache.delete(key);
      if (entry) {
        this.updateTagStats(entry.tags, 'expire');
      }
    }

    if (keysToDelete.length > 0) {
      this.metrics.evictions += keysToDelete.length;
      this.updateMemoryUsage();
      
      if (this.options.enablePersistence) {
        this.saveToStorage();
      }
    }
  }

  // Record cache hit
  private recordHit(region?: string): void {
    this.metrics.hits++;
    if (region) {
      if (!this.metrics.regionStats[region]) {
        this.metrics.regionStats[region] = { hits: 0, misses: 0 };
      }
      this.metrics.regionStats[region].hits++;
    }
  }

  // Record cache miss
  private recordMiss(region?: string): void {
    this.metrics.misses++;
    if (region) {
      if (!this.metrics.regionStats[region]) {
        this.metrics.regionStats[region] = { hits: 0, misses: 0 };
      }
      this.metrics.regionStats[region].misses++;
    }
  }

  // Record access time
  private recordAccessTime(time: number): void {
    this.accessTimes.push(time);
    
    // Keep only last 100 measurements
    if (this.accessTimes.length > 100) {
      this.accessTimes = this.accessTimes.slice(-100);
    }
  }

  // Update tag statistics
  private updateTagStats(tags: string[], operation: 'hit' | 'set' | 'delete' | 'invalidate' | 'evict' | 'expire'): void {
    tags.forEach(tag => {
      if (!this.metrics.tagStats[tag]) {
        this.metrics.tagStats[tag] = 0;
      }
      
      switch (operation) {
        case 'hit':
        case 'set':
          this.metrics.tagStats[tag]++;
          break;
        case 'delete':
        case 'invalidate':
        case 'evict':
        case 'expire':
          this.metrics.tagStats[tag] = Math.max(0, this.metrics.tagStats[tag] - 1);
          break;
      }
    });
  }

  // Update hit rate
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  // Update average access time
  private updateAvgAccessTime(): void {
    if (this.accessTimes.length > 0) {
      this.metrics.avgAccessTime = this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length;
    }
  }

  // Update memory usage
  private updateMemoryUsage(): void {
    this.metrics.memoryUsage = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
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

  // Remove cache from localStorage
  private removeFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(this.storageKey);
      } catch (error) {
        console.error('Failed to remove cache from storage:', error);
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
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.options.syncAcrossTabs && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange);
    }
    
    this.clear();
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
};

// Global cache instance
export const globalCache = new UnifiedCacheManager({
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000,
  enableMetrics: process.env['NODE_ENV'] === 'development',
  enableCompression: false
});

// Register default strategies
globalCache.registerStrategy('api_response', CacheStrategies.API_RESPONSE);
globalCache.registerStrategy('ai_response', CacheStrategies.AI_RESPONSE);
globalCache.registerStrategy('user_data', CacheStrategies.USER_DATA);
globalCache.registerStrategy('static_data', CacheStrategies.STATIC_DATA);

// Enhanced convenience functions
export const cacheGet = <T>(key: string, region?: string): Promise<T | null> => 
  globalCache.get<T>(key, region);

export const cacheSet = <T>(
  key: string, 
  data: T, 
  ttl?: number, 
  tags?: string[], 
  region?: string,
  priority?: 'high' | 'medium' | 'low'
): Promise<void> => 
  globalCache.set(key, data, ttl, tags, region, priority);

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

export type { CacheOptions, CacheMetrics };