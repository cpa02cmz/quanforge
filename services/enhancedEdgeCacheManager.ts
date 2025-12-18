/**
 * Enhanced Edge Cache Manager for Vercel Deployment
 * Provides intelligent caching strategies and optimization for edge functions
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  tags: string[];
  region?: string;
  compressed?: boolean;
  size: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  compressionThreshold: number; // Size threshold for compression in bytes
  enableCompression: boolean;
  enableMetrics: boolean;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  compressions: number;
  totalSize: number;
  hitRate: number;
  avgAccessTime: number;
  regionStats: Record<string, { hits: number; misses: number }>;
}

interface CacheStrategy {
  name: string;
  ttl: number;
  tags: string[];
  compression: boolean;
  regionSpecific: boolean;
  priority: 'high' | 'medium' | 'low';
}

class EnhancedEdgeCacheManager {
  private static instance: EnhancedEdgeCacheManager;
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private cleanupTimer: number | null = null;
  private accessTimes: number[] = [];
  private strategies: Map<string, CacheStrategy> = new Map();

  private constructor() {
    this.config = {
      maxSize: 10 * 1024 * 1024, // 10MB for edge constraints
      maxEntries: 1000, // Reduced for edge memory
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 30 * 1000, // 30 seconds
      compressionThreshold: 1024, // 1KB
      enableCompression: true,
      enableMetrics: true
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      compressions: 0,
      totalSize: 0,
      hitRate: 0,
      avgAccessTime: 0,
      regionStats: {}
    };

    this.initializeStrategies();
    this.startCleanup();
  }

  static getInstance(): EnhancedEdgeCacheManager {
    if (!EnhancedEdgeCacheManager.instance) {
      EnhancedEdgeCacheManager.instance = new EnhancedEdgeCacheManager();
    }
    return EnhancedEdgeCacheManager.instance;
  }

  /**
   * Initialize predefined cache strategies
   */
  private initializeStrategies(): void {
    // API strategies
    this.strategies.set('api:robots', {
      name: 'robots-api',
      ttl: 5 * 60 * 1000, // 5 minutes
      tags: ['api', 'robots', 'data'],
      compression: true,
      regionSpecific: true,
      priority: 'high'
    });

    this.strategies.set('api:generate', {
      name: 'generate-api',
      ttl: 2 * 60 * 1000, // 2 minutes
      tags: ['api', 'generate', 'ai'],
      compression: true,
      regionSpecific: true,
      priority: 'medium'
    });

    this.strategies.set('api:market-data', {
      name: 'market-data-api',
      ttl: 30 * 1000, // 30 seconds
      tags: ['api', 'market', 'realtime'],
      compression: false,
      regionSpecific: true,
      priority: 'high'
    });

    // Static asset strategies
    this.strategies.set('static:js', {
      name: 'javascript-assets',
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      tags: ['static', 'js', 'bundle'],
      compression: true,
      regionSpecific: false,
      priority: 'low'
    });

    this.strategies.set('static:css', {
      name: 'css-assets',
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      tags: ['static', 'css', 'styles'],
      compression: true,
      regionSpecific: false,
      priority: 'low'
    });

    // Page strategies
    this.strategies.set('page:dashboard', {
      name: 'dashboard-page',
      ttl: 10 * 60 * 1000, // 10 minutes
      tags: ['page', 'dashboard', 'dynamic'],
      compression: true,
      regionSpecific: true,
      priority: 'medium'
    });

    this.strategies.set('page:generator', {
      name: 'generator-page',
      ttl: 5 * 60 * 1000, // 5 minutes
      tags: ['page', 'generator', 'interactive'],
      compression: true,
      regionSpecific: true,
      priority: 'medium'
    });
  }

  /**
   * Get data from cache with enhanced features
   */
  async get(key: string, region?: string): Promise<any | null> {
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
    let data = entry.data;
    if (entry.compressed && this.config.enableCompression) {
      try {
        data = await this.decompressData(entry.data);
      } catch (error) {
// Removed for production: console.warn('Failed to decompress cached data:', error);
        this.cache.delete(key);
        this.recordMiss(region);
        return null;
      }
    }

    this.recordHit(region);
    this.recordAccessTime(performance.now() - startTime);

    return data;
  }

  /**
   * Set data in cache with intelligent optimization
   */
  async set(
    key: string, 
    data: any, 
    strategyOrTTL?: string | number, 
    tags: string[] = [], 
    region?: string
  ): Promise<void> {
    const strategy = typeof strategyOrTTL === 'string' 
      ? this.strategies.get(strategyOrTTL)
      : null;

    const ttl = strategy 
      ? strategy.ttl 
      : (typeof strategyOrTTL === 'number' ? strategyOrTTL : this.config.defaultTTL);

    const effectiveTags = strategy 
      ? [...strategy.tags, ...tags]
      : tags;

    let processedData = data;
    let compressed = false;
    let size = this.calculateSize(data);

    // Apply compression if beneficial
    if (this.config.enableCompression && 
        size > this.config.compressionThreshold && 
        (strategy?.compression !== false)) {
      try {
        const compressedData = await this.compressData(data);
        const compressedSize = this.calculateSize(compressedData);
        
        // Only use compression if it reduces size
        if (compressedSize < size * 0.8) {
          processedData = compressedData;
          compressed = true;
          size = compressedSize;
          this.metrics.compressions++;
        }
      } catch (error) {
// Removed for production: console.warn('Compression failed:', error);
      }
    }

    // Check cache capacity
    await this.ensureCapacity(size);

    // Create cache entry
    const entry: CacheEntry = {
      data: processedData,
      timestamp: Date.now(),
      ttl,
      tags: effectiveTags,
      region: strategy?.regionSpecific ? region : undefined,
      compressed,
      size,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    this.metrics.sets++;
    this.updateTotalSize();
  }

  /**
   * Invalidate cache entries by tags
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
    this.updateTotalSize();

    return invalidated;
  }

  /**
   * Invalidate cache entries by region
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
    this.updateTotalSize();

    return invalidated;
  }

  /**
   * Warm up cache with predicted data
   */
  async warmCache(predictions: Array<{ key: string; data: any; strategy: string }>): Promise<void> {
    const warmupPromises = predictions.map(async (prediction) => {
      try {
        await this.set(prediction.key, prediction.data, prediction.strategy, ['warmup']);
      } catch (error) {
// Removed for production: console.warn(`Failed to warm cache for key ${prediction.key}:`, error);
      }
    });

    await Promise.allSettled(warmupPromises);
// Removed for production: console.log(`Cache warm-up completed for ${predictions.length} entries`);
  }

  /**
   * Get comprehensive cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateHitRate();
    this.updateAvgAccessTime();
    return { ...this.metrics };
  }

  /**
   * Get detailed cache statistics
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
      totalSize: this.metrics.totalSize,
      avgSize: entries.length > 0 ? this.metrics.totalSize / entries.length : 0,
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
    // Check if we need to make space
    while (this.shouldEvict(requiredSize)) {
      await this.evictLeastUseful();
    }
  }

  /**
   * Determine if eviction is needed
   */
  private shouldEvict(requiredSize: number): boolean {
    return (
      this.cache.size >= this.config.maxEntries ||
      this.metrics.totalSize + requiredSize > this.config.maxSize
    );
  }

  /**
   * Evict least useful entries using advanced algorithm
   */
  private async evictLeastUseful(): Promise<void> {
    const entries = Array.from(this.cache.entries());
    
    // Calculate utility score for each entry
    const scoredEntries = entries.map(([key, entry]) => {
      const age = Date.now() - entry.timestamp;
      const timeSinceAccess = Date.now() - entry.lastAccessed;
      const accessFrequency = entry.accessCount / (age / 1000 || 1); // accesses per second
      
      // Utility score: higher is more useful
      const utilityScore = (
        accessFrequency * 100 + // Access frequency weight
        (entry.size / 1024) * -1 + // Size penalty (smaller is better)
        (timeSinceAccess / 1000) * -10 // Recent access bonus
      );

      return { key, entry, utilityScore };
    });

    // Sort by utility score (lowest first)
    scoredEntries.sort((a, b) => a.utilityScore - b.utilityScore);

    // Evict least useful entries
    const toEvict = Math.ceil(scoredEntries.length * 0.1); // Evict bottom 10%
    for (let i = 0; i < toEvict && i < scoredEntries.length; i++) {
      this.cache.delete(scoredEntries[i].key);
      this.metrics.evictions++;
    }

    this.updateTotalSize();
  }

  /**
   * Compress data using LZ-string
   */
  private async compressData(data: any): Promise<string> {
    const jsonString = JSON.stringify(data);
    
    // Dynamic import for edge compatibility
    const { compress } = await import('lz-string');
    return compress(jsonString);
  }

  /**
   * Decompress data using LZ-string
   */
  private async decompressData(compressedData: string): Promise<any> {
    // Dynamic import for edge compatibility
    const { decompress } = await import('lz-string');
    const jsonString = decompress(compressedData);
    return JSON.parse(jsonString);
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
    this.cleanupTimer = window.setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.metrics.deletes += cleaned;
      this.updateTotalSize();
// Removed for production: console.debug(`Cleaned up ${cleaned} expired cache entries`);
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
   * Update total cache size
   */
  private updateTotalSize(): void {
    this.metrics.totalSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.metrics.deletes += this.cache.size;
    this.updateTotalSize();
// Removed for production: console.log('Cache cleared');
  }

  /**
   * Optimize cache for edge deployment
   */
  optimizeForEdge(): void {
    this.config.maxSize = 5 * 1024 * 1024; // 5MB for edge
    this.config.maxEntries = 500;
    this.config.cleanupInterval = 15000; // 15 seconds
    this.config.defaultTTL = 3 * 60 * 1000; // 3 minutes
    
// Removed for production: console.log('Cache optimized for edge deployment');
  }

  /**
   * Export cache configuration
   */
  exportConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Import cache configuration
   */
  importConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
// Removed for production: console.log('Cache configuration updated');
  }
}

export const enhancedEdgeCacheManager = EnhancedEdgeCacheManager.getInstance();
export type { CacheStrategy, CacheMetrics, CacheConfig };