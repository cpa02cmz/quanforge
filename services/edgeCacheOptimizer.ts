/**
 * Edge Cache Optimizer Service
 * Provides advanced caching and performance optimization for Vercel Edge Functions
 */

interface EdgeCacheConfig {
  enableEdgeCaching: boolean;
  edgeRegion: string;
  cacheTTL: number;
  maxCacheSize: number;
  compressionEnabled: boolean;
  prewarmEnabled: boolean;
}

interface EdgeCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  size: number;
  region: string;
  compressed: boolean;
}

class EdgeCacheOptimizer {
  private config: EdgeCacheConfig;
  private edgeCache = new Map<string, EdgeCacheEntry>();
  private regionLatencies: Map<string, number> = new Map();
  private edgeStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressions: 0,
    totalSize: 0,
  };

  constructor(config?: Partial<EdgeCacheConfig>) {
    this.config = {
      enableEdgeCaching: true,
      edgeRegion: (process.env as any)['VERCEL_REGION'] || 'unknown',
      cacheTTL: 300000, // 5 minutes default
      maxCacheSize: 10 * 1024 * 1024, // 10MB default
      compressionEnabled: true,
      prewarmEnabled: true,
      ...config,
    };

    // Initialize region latencies based on current region
    this.initializeRegionLatencies();
    
    // Setup cleanup interval
    if (typeof window !== 'undefined') {
      // Client-side cleanup
      setInterval(() => this.cleanup(), 30000); // Every 30 seconds
    }
  }

  private initializeRegionLatencies(): void {
    // Latencies in ms relative to current region
    const latencies: Record<string, number> = {
      'iad1': 10, // Virginia
      'sfo1': 150, // San Francisco
      'hkg1': 200, // Hong Kong
      'sin1': 250, // Singapore
      'fra1': 100, // Frankfurt
      'gru1': 200, // São Paulo
      'arn1': 120, // Stockholm
      'cle1': 50, // Cleveland
      'unknown': 300,
    };
    
    Object.entries(latencies).forEach(([region, latency]) => {
      this.regionLatencies.set(region, latency);
    });
  }

  /**
   * Get cached value for edge-optimized performance
   */
  get<T>(key: string): T | null {
    const cacheKey = this.generateRegionKey(key);
    const entry = this.edgeCache.get(cacheKey);

    if (!entry) {
      this.edgeStats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.edgeCache.delete(cacheKey);
      this.edgeStats.totalSize -= entry.size;
      this.edgeStats.misses++;
      return null;
    }

    this.edgeStats.hits++;
    
    // Decompress if needed
    if (entry.compressed) {
      try {
        // In a real implementation, we would decompress the data
        return entry.data as T;
      } catch (error) {
        console.warn(`Failed to decompress edge cache entry: ${key}`, error);
        this.edgeCache.delete(cacheKey);
        this.edgeStats.totalSize -= entry.size;
        this.edgeStats.misses++;
        return null;
      }
    }

    return entry.data as T;
  }

  /**
   * Set cached value with edge optimization
   */
  set<T>(key: string, data: T, ttl?: number): void {
    if (!this.config.enableEdgeCaching) return;

    const cacheKey = this.generateRegionKey(key);
    const serializedData = JSON.stringify(data);
    const size = new Blob([serializedData]).size;

    // Check if data is too large
    if (size > this.config.maxCacheSize) {
      console.warn(`Edge cache entry too large: ${key} (${size} bytes)`);
      return;
    }

    let processedData = data;
    let compressed = false;

    // Compress large entries if enabled
    if (this.config.compressionEnabled && size > 512) { // 0.5KB threshold
      try {
        processedData = data; // In real implementation, compress data
        compressed = true;
        this.edgeStats.compressions++;
      } catch (error) {
        console.warn(`Failed to compress edge cache entry: ${key}`, error);
      }
    }

    const entry: EdgeCacheEntry = {
      data: processedData,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTTL,
      size,
      region: this.config.edgeRegion,
      compressed,
    };

    // Check cache size limits
    if (this.edgeStats.totalSize + size > this.config.maxCacheSize) {
      this.enforceSizeLimit(size);
    }

    this.edgeCache.set(cacheKey, entry);
    this.edgeStats.totalSize += size;
  }

  /**
   * Pre-warm cache with common queries for edge regions
   */
  async prewarmCache(commonQueries: Array<{ key: string; loader: () => Promise<any> }>): Promise<void> {
    if (!this.config.prewarmEnabled) return;

    const promises = commonQueries.map(async ({ key, loader }) => {
      try {
        const data = await loader();
        this.set(key, data, 180000); // 3 minutes for prewarm
      } catch (error) {
        console.warn(`Failed to prewarm edge cache: ${key}`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Get optimal cache key based on region proximity
   */
  generateRegionKey(key: string): string {
    return `${this.config.edgeRegion}:${key}`;
  }

  /**
   * Get the closest edge region for data
   */
  getClosestRegion(): string {
    const currentRegion = this.config.edgeRegion;
    
    // Return current region if known
    if (currentRegion !== 'unknown') {
      return currentRegion;
    }
    
    // Otherwise, return the region with the lowest latency
    let closestRegion = 'iad1'; // Default to iad1
    let lowestLatency = Infinity;
    
    for (const [region, latency] of this.regionLatencies) {
      if (latency < lowestLatency) {
        lowestLatency = latency;
        closestRegion = region;
      }
    }
    
    return closestRegion;
  }

  /**
   * Get cache statistics for edge optimization
   */
  getEdgeStats(): {
    hitRate: number;
    totalEntries: number;
    totalSize: number;
    region: string;
    closestRegion: string;
    latencies: { [region: string]: number };
  } {
    const totalRequests = this.edgeStats.hits + this.edgeStats.misses;
    const hitRate = totalRequests > 0 ? (this.edgeStats.hits / totalRequests) * 100 : 0;

    return {
      hitRate,
      totalEntries: this.edgeCache.size,
      totalSize: this.edgeStats.totalSize,
      region: this.config.edgeRegion,
      closestRegion: this.getClosestRegion(),
      latencies: Object.fromEntries(this.regionLatencies),
    };
  }

  /**
   * Cleanup expired entries and enforce size limits
   */
  private cleanup(): void {
    const now = Date.now();
    let removedSize = 0;

    for (const [key, entry] of this.edgeCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.edgeCache.delete(key);
        removedSize += entry.size;
        this.edgeStats.evictions++;
      }
    }

    this.edgeStats.totalSize -= removedSize;

    // Enforce size limits after expiration cleanup
    if (this.edgeStats.totalSize > this.config.maxCacheSize) {
      this.enforceSizeLimit(0);
    }
  }

  /**
   * Enforce cache size limits using LRU
   */
  private enforceSizeLimit(_newEntrySize: number): void {
    const entries = Array.from(this.edgeCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp); // Sort by oldest first

    let removedSize = 0;
    const targetSize = this.config.maxCacheSize * 0.8; // Target 80% of max size

    for (const [key, entry] of entries) {
      if (this.edgeStats.totalSize - removedSize <= targetSize) break;

      this.edgeCache.delete(key);
      removedSize += entry.size;
      this.edgeStats.evictions++;
    }

    this.edgeStats.totalSize -= removedSize;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern: string): number {
    let invalidated = 0;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));

    for (const key of this.edgeCache.keys()) {
      if (regex.test(key)) {
        const entry = this.edgeCache.get(key)!;
        this.edgeCache.delete(key);
        this.edgeStats.totalSize -= entry.size;
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Get performance metrics for edge optimization
   */
  getPerformanceMetrics(): {
    hitRate: number;
    avgLatency: number;
    cacheEfficiency: number;
    regionPerformance: { [region: string]: number };
  } {
    const stats = this.getEdgeStats();
    const hitRate = stats.hitRate;
    
    // Calculate average latency based on region
    const avgLatency = this.regionLatencies.get(this.config.edgeRegion) || 100;
    
    // Cache efficiency: how well we're serving from cache vs. hitting origin
    const cacheEfficiency = hitRate > 0 ? Math.min(100, hitRate) : 0;
    
    // Performance by region
    const regionPerformance: { [region: string]: number } = {};
    for (const [region, latency] of this.regionLatencies) {
      regionPerformance[region] = Math.max(0, 100 - latency);
    }

    return {
      hitRate,
      avgLatency,
      cacheEfficiency,
      regionPerformance,
    };
  }

  /**
   * Optimize cache for specific use case
   */
  optimizeForUseCase(useCase: 'api' | 'assets' | 'database' | 'ai'): void {
    switch (useCase) {
      case 'api':
        this.config.cacheTTL = 60000; // 1 minute for API responses
        this.config.compressionEnabled = true;
        break;
      case 'assets':
        this.config.cacheTTL = 3600000; // 1 hour for assets
        this.config.compressionEnabled = true;
        break;
      case 'database':
        this.config.cacheTTL = 180000; // 3 minutes for DB queries
        this.config.compressionEnabled = true;
        break;
      case 'ai':
        this.config.cacheTTL = 900000; // 15 minutes for AI responses
        this.config.compressionEnabled = false; // AI responses are usually small
        break;
    }
  }

  /**
   * Get cache warming recommendations
   */
  getWarmingRecommendations(): string[] {
    const recommendations: string[] = [
      `Pre-warm cache with common ${this.config.edgeRegion} region queries`,
      'Implement cache warming for peak usage hours',
      'Use region-specific cache warming strategies',
      'Monitor cache hit rates by region',
      'Implement predictive cache warming based on usage patterns',
    ];

    return recommendations;
  }

  /**
   * Get cache for specific region
   */
  getRegionCache(region: string): Map<string, EdgeCacheEntry> {
    const regionCache = new Map<string, EdgeCacheEntry>();
    
    for (const [key, entry] of this.edgeCache.entries()) {
      if (key.startsWith(`${region}:`)) {
        regionCache.set(key, entry);
      }
    }
    
    return regionCache;
  }

  /**
   * Destroy and cleanup resources
   */
  destroy(): void {
    this.edgeCache.clear();
    this.edgeStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      compressions: 0,
      totalSize: 0,
    };
  }
}

// Singleton instance
export const edgeCacheOptimizer = new EdgeCacheOptimizer();

// Export the class for instantiation with custom config
export { EdgeCacheOptimizer };