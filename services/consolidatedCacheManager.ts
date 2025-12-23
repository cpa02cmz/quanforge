// Consolidated Cache Manager - Unifies all cache strategies
import { createScopedLogger } from "../utils/logger";
import { securityManager } from "./securityManager";
import { CACHE_CONFIG, TIME_CONSTANTS } from "../constants/config";
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

const logger = createScopedLogger('consolidated-cache');

// Core interfaces
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
}

interface CacheOptions {
  maxSize?: number;           // Maximum number of entries
  maxMemorySize?: number;     // Maximum memory size in bytes
  defaultTTL?: number;        // Default TTL in milliseconds
  cleanupInterval?: number;   // Cleanup interval in milliseconds
  compressionThreshold?: number; // Size threshold for compression
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
}

interface CacheStrategy {
  name: string;
  shouldCache: (key: string, data: any) => boolean;
  getTTL: (key: string, data: any) => number;
  getTags?: (key: string, data: any) => string[];
  onEvict?: (key: string, data: any) => void;
  priority: 'high' | 'medium' | 'low';
  compression?: boolean;
  regionSpecific?: boolean;
}

// Main Cache Manager class
export class ConsolidatedCacheManager {
  private cache = new Map<string, CacheEntry>();
  private strategies = new Map<string, CacheStrategy>();
  private metrics: CacheMetrics;
  private options: Required<CacheOptions>;
  private cleanupTimer: number | null = null;
  private accessTimes: number[] = [];
  private storageKey = 'quantforge-consolidated-cache';

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: 500, // Reduced for edge constraints
      maxMemorySize: 5 * 1024 * 1024, // 5MB - optimized for edge
      defaultTTL: 3 * 60 * 1000, // 3 minutes - shorter for edge
      cleanupInterval: 30000, // 30 seconds - faster cleanup for edge
      compressionThreshold: 512, // 512B - lower threshold for edge
      enableCompression: true,
      enableMetrics: process.env['NODE_ENV'] === 'development', // Disable in production for edge
      enablePersistence: false, // Disable for edge deployment
      syncAcrossTabs: false, // Disable for edge deployment
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
      regionStats: {}
    };

    this.initializeStrategies();
    this.startCleanup();
    
    if (this.options.enablePersistence) {
      this.loadFromStorage();
    }

    if (this.options.syncAcrossTabs && typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange);
    }
  }

  /**
   * Initialize predefined cache strategies
   */
  private initializeStrategies(): void {
    // API Response Strategy
    this.strategies.set('api', {
      name: 'api_response',
      shouldCache: (_key: string, data: any) => {
        return !data || !data.error;
      },
      getTTL: (_key: string, data: any) => {
        return data && data.success ? 10 * 60 * 1000 : 2 * 60 * 1000;
      },
      getTags: () => ['api'],
      priority: 'high',
      compression: true,
      regionSpecific: true
    });

    // AI Response Strategy
    this.strategies.set('ai', {
      name: 'ai_response',
      shouldCache: (_key: string, data: any) => {
        return data && data.content && data.content.length > 0;
      },
      getTTL: (_key: string, data: any) => {
        const length = data?.content?.length || 0;
        return length > 1000 ? 30 * 60 * 1000 : 15 * 60 * 1000;
      },
      getTags: () => ['ai', 'generation'],
      priority: 'medium',
      compression: true,
      regionSpecific: true
    });

    // User Data Strategy
    this.strategies.set('user', {
      name: 'user_data',
      shouldCache: () => true,
      getTTL: () => 5 * 60 * 1000,
      getTags: () => ['user'],
      priority: 'high',
      compression: false,
      regionSpecific: false
    });

    // Static Data Strategy
    this.strategies.set('static', {
      name: 'static_data',
      shouldCache: () => true,
      getTTL: () => 60 * 60 * 1000,
      getTags: () => ['static'],
      priority: 'low',
      compression: true,
      regionSpecific: false
    });

    // Market Data Strategy
    this.strategies.set('market', {
      name: 'market_data',
      shouldCache: () => true,
      getTTL: () => 30 * 1000, // 30 seconds
      getTags: () => ['market', 'realtime'],
      priority: 'high',
      compression: false,
      regionSpecific: true
    });
  }

  /**
   * Get data from cache
   */
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

    return data as T;
  }

  /**
   * Set data in cache
   */
  async set<T = any>(
    key: string,
    data: T,
    strategyOrTTL?: string | number,
    tags: string[] = [],
    region?: string
  ): Promise<void> {
    const strategy = typeof strategyOrTTL === 'string' 
      ? this.strategies.get(strategyOrTTL)
      : null;

    // Check if strategy allows caching
    if (strategy && !strategy.shouldCache(key, data)) {
      return;
    }

    // Determine TTL
    const ttl = strategy 
      ? strategy.getTTL(key, data)
      : (typeof strategyOrTTL === 'number' ? strategyOrTTL : this.options.defaultTTL);

    // Determine tags
    const effectiveTags = strategy?.getTags 
      ? [...strategy.getTags(key, data), ...tags]
      : tags;

    // Process data (compression if needed)
    let processedData: any = data;
    let compressed = false;
    let size = this.calculateSize(data);

    if (this.options.enableCompression && 
        size > this.options.compressionThreshold && 
        strategy?.compression !== false) {
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
      ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
      tags: effectiveTags,
      region: strategy?.regionSpecific ? region : undefined,
      compressed,
      size
    };

    this.cache.set(key, entry);
    this.metrics.sets++;
    this.updateMemoryUsage();

    if (this.options.enablePersistence) {
      this.saveToStorage();
    }
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.deletes++;
      this.updateMemoryUsage();
      
      if (this.options.enablePersistence) {
        this.saveToStorage();
      }
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.metrics.deletes += size;
    this.updateMemoryUsage();

    if (this.options.enablePersistence) {
      this.removeFromStorage();
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Invalidate entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    this.metrics.deletes += invalidated;
    this.updateMemoryUsage();

    if (invalidated > 0 && this.options.enablePersistence) {
      this.saveToStorage();
    }

    return invalidated;
  }

  /**
   * Invalidate entries by region
   */
  async invalidateByRegion(region: string): Promise<number> {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.region === region) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    this.metrics.deletes += invalidated;
    this.updateMemoryUsage();

    if (invalidated > 0 && this.options.enablePersistence) {
      this.saveToStorage();
    }

    return invalidated;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateHitRate();
    this.updateAvgAccessTime();
    return { ...this.metrics };
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats(): {
    entries: number;
    totalSize: number;
    avgSize: number;
    oldestEntry: number;
    newestEntry: number;
    topTags: Array<{ tag: string; count: number }>;
    regionDistribution: Record<string, number>;
    compressionRatio: number;
  } {
    const entries = Array.from(this.cache.values());
    const tagCounts: Record<string, number> = {};
    const regionDistribution: Record<string, number> = {};

    let totalCompressedSize = 0;
    let totalUncompressedSize = 0;

    entries.forEach(entry => {
      // Tag analysis
      entry.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      // Region distribution
      if (entry.region) {
        regionDistribution[entry.region] = (regionDistribution[entry.region] || 0) + 1;
      }

      // Compression analysis
      totalUncompressedSize += entry.size;
      if (entry.compressed) {
        totalCompressedSize += entry.size;
      }
    });

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    const timestamps = entries.map(e => e.timestamp);
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    return {
      entries: this.cache.size,
      totalSize: this.metrics.memoryUsage,
      avgSize: entries.length > 0 ? this.metrics.memoryUsage / entries.length : 0,
      oldestEntry,
      newestEntry,
      topTags,
      regionDistribution,
      compressionRatio: totalUncompressedSize > 0 ? totalCompressedSize / totalUncompressedSize : 0
    };
  }

  /**
   * Ensure cache capacity with intelligent eviction
   */
  private async ensureCapacity(requiredSize: number): Promise<void> {
    while (this.shouldEvict(requiredSize)) {
      await this.evictLeastUseful();
    }
  }

  /**
   * Determine if eviction is needed
   */
  private shouldEvict(requiredSize: number): boolean {
    return (
      this.cache.size >= this.options.maxSize ||
      this.metrics.memoryUsage + requiredSize > this.options.maxMemorySize
    );
  }

  /**
   * Evict least useful entries
   */
  private async evictLeastUseful(): Promise<void> {
    const entries = Array.from(this.cache.entries());
    
    // Calculate utility score for each entry
    const scoredEntries = entries.map(([key, entry]) => {
      const age = Date.now() - entry.timestamp;
      const timeSinceAccess = Date.now() - entry.lastAccessed;
      const accessFrequency = entry.accessCount / (age / 1000 || 1);
      
      // Utility score: higher is more useful
      const utilityScore = (
        accessFrequency * 100 + // Access frequency weight
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

      // Call strategy onEvict callback
      const strategy = Array.from(this.strategies.values()).find(s => 
        entry.entry.tags.includes(s.name)
      );
      if (strategy?.onEvict) {
        strategy.onEvict(entry.key, entry.entry.data);
      }
    }

    this.updateMemoryUsage();
  }

  /**
   * Calculate approximate size of data
   */
  private calculateSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2; // UTF-16
    }
    return JSON.stringify(data).length * 2;
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = window.setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.metrics.evictions += keysToDelete.length;
      this.updateMemoryUsage();
      
      if (this.options.enablePersistence) {
        this.saveToStorage();
      }
    }
  }

  /**
   * Record cache hit
   */
  private recordHit(region?: string): void {
    this.metrics.hits++;
    if (region) {
      if (!this.metrics.regionStats[region]) {
        this.metrics.regionStats[region] = { hits: 0, misses: 0 };
      }
      this.metrics.regionStats[region].hits++;
    }
  }

  /**
   * Record cache miss
   */
  private recordMiss(region?: string): void {
    this.metrics.misses++;
    if (region) {
      if (!this.metrics.regionStats[region]) {
        this.metrics.regionStats[region] = { hits: 0, misses: 0 };
      }
      this.metrics.regionStats[region].misses++;
    }
  }

  /**
   * Record access time
   */
  private recordAccessTime(time: number): void {
    this.accessTimes.push(time);
    
    // Keep only last 100 measurements
    if (this.accessTimes.length > 100) {
      this.accessTimes = this.accessTimes.slice(-100);
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  /**
   * Update average access time
   */
  private updateAvgAccessTime(): void {
    if (this.accessTimes.length > 0) {
      this.metrics.avgAccessTime = this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length;
    }
  }

  /**
   * Update memory usage
   */
  private updateMemoryUsage(): void {
    this.metrics.memoryUsage = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
  }

  /**
   * Save cache to localStorage
   */
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

  /**
   * Load cache from localStorage
   */
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

  /**
   * Remove cache from localStorage
   */
  private removeFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(this.storageKey);
      } catch (error) {
        console.error('Failed to remove cache from storage:', error);
      }
    }
  }

  /**
   * Handle storage changes for tab sync
   */
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

  /**
   * Destroy cache manager
   */
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

// Global singleton instance
export const consolidatedCache = new ConsolidatedCacheManager({
  maxSize: 1000,
  maxMemorySize: 10 * 1024 * 1024, // 10MB
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  enableMetrics: process.env['NODE_ENV'] === 'development',
  enableCompression: true,
  enablePersistence: true,
  syncAcrossTabs: true
});

// Convenience functions
export const cacheGet = <T>(key: string, region?: string): Promise<T | null> => 
  consolidatedCache.get<T>(key, region);

export const cacheSet = <T>(
  key: string, 
  data: T, 
  strategyOrTTL?: string | number, 
  tags?: string[], 
  region?: string
): Promise<void> => 
  consolidatedCache.set(key, data, strategyOrTTL, tags, region);

export const cacheDelete = (key: string): Promise<boolean> => 
  consolidatedCache.delete(key);

export const cacheClear = (): Promise<void> => 
  consolidatedCache.clear();

export const cacheHas = (key: string): boolean => 
  consolidatedCache.has(key);

export const cacheMetrics = (): CacheMetrics => 
  consolidatedCache.getMetrics();

export const cacheInvalidateByTags = (tags: string[]): Promise<number> => 
  consolidatedCache.invalidateByTags(tags);

export const cacheInvalidateByRegion = (region: string): Promise<number> => 
  consolidatedCache.invalidateByRegion(region);

export type { CacheStrategy, CacheMetrics, CacheOptions };