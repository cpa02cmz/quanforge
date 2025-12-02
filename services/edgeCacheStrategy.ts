interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  tags: string[];
  compressed?: boolean;
  size: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  entries: number;
  hitRate: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTtl: number;
  compressionThreshold: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

class EdgeCacheStrategy {
  private cache: Map<string, CacheEntry> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, entries: 0, hitRate: 0 };
  private config: CacheConfig = {
    maxSize: 50 * 1024 * 1024, // 50MB
    defaultTtl: 300000, // 5 minutes
    compressionThreshold: 1024, // 1KB
    enableCompression: true,
    enableMetrics: true
  };

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...this.config, ...config };
    this.startCleanupTimer();
  }

  async get(key: string): Promise<any> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.updateStats('miss');
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      this.updateStats('miss');
      return null;
    }

    this.updateStats('hit');
    return entry.compressed ? this.decompress(entry.data) : entry.data;
  }

  async set(key: string, data: any, options: {
    ttl?: number;
    tags?: string[];
    compress?: boolean;
  } = {}): Promise<void> {
    const {
      ttl = this.config.defaultTtl,
      tags = [],
      compress = this.config.enableCompression
    } = options;

    // Check if we should compress
    const serialized = JSON.stringify(data);
    const shouldCompress = compress && serialized.length > this.config.compressionThreshold;
    
    let processedData = data;
    let size = serialized.length;
    
    if (shouldCompress) {
      processedData = this.compress(data);
      size = processedData.length;
    }

    // Check cache size limit
    if (size > this.config.maxSize) {
      console.warn(`Cache entry too large: ${size} bytes`);
      return;
    }

    // Evict if necessary
    await this.ensureSpace(size);

    const entry: CacheEntry = {
      data: processedData,
      timestamp: Date.now(),
      ttl,
      tags,
      compressed: shouldCompress,
      size
    };

    this.cache.set(key, entry);
    this.updateTags(key, tags);
    this.updateSize();
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    const keysToDelete = new Set<string>();

    for (const tag of tags) {
      const taggedKeys = this.tagIndex.get(tag);
      if (taggedKeys) {
        taggedKeys.forEach(key => keysToDelete.add(key));
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  async invalidateRegion(region: string, pattern: string = '*'): Promise<void> {
    const regionPattern = `${region}_${pattern}`;
    await this.invalidateByPattern(regionPattern);
  }

  async warmEdgeRegions(): Promise<void> {
    const regions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'];
    const warmPromises = regions.map(region => this.warmRegion(region));
    
    await Promise.allSettled(warmPromises);
  }

  private async warmRegion(region: string): Promise<void> {
    try {
      // Warm common cache entries for this region
      const warmKeys = [
        `${region}_strategies_popular`,
        `${region}_robots_recent`,
        `${region}_user_preferences`,
        `${region}_market_data_latest`
      ];

      for (const key of warmKeys) {
        const existing = this.cache.get(key);
        if (!existing || Date.now() - existing.timestamp > 60000) {
          // This would trigger a fetch in a real implementation
          console.log(`Warming cache for ${region}: ${key}`);
        }
      }
    } catch (error) {
      console.warn(`Failed to warm cache for region ${region}:`, error);
    }
  }

  private delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.removeTags(key, entry.tags);
      this.updateSize();
    }
  }

  private async ensureSpace(requiredSize: number): Promise<void> {
    const currentSize = this.getCurrentSize();
    
    if (currentSize + requiredSize <= this.config.maxSize) {
      return;
    }

    // LRU eviction
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      this.delete(key);
      freedSpace += entry.size;
      
      if (currentSize - freedSpace + requiredSize <= this.config.maxSize) {
        break;
      }
    }
  }

  private updateTags(key: string, tags: string[]): void {
    // Remove old tag associations
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.removeTags(key, oldEntry.tags);
    }

    // Add new tag associations
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  private removeTags(key: string, tags: string[]): void {
    for (const tag of tags) {
      const taggedKeys = this.tagIndex.get(tag);
      if (taggedKeys) {
        taggedKeys.delete(key);
        if (taggedKeys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }

  private compress(data: any): string {
    // Simple compression using LZ-string if available
    try {
      const { compressToUTF16 } = require('lz-string');
      return compressToUTF16(JSON.stringify(data));
    } catch {
      return JSON.stringify(data);
    }
  }

  private decompress(data: string): any {
    try {
      const { decompressFromUTF16 } = require('lz-string');
      return JSON.parse(decompressFromUTF16(data));
    } catch {
      return JSON.parse(data);
    }
  }

  private getCurrentSize(): number {
    let size = 0;
    for (const entry of this.cache.values()) {
      size += entry.size;
    }
    return size;
  }

  private updateSize(): void {
    this.stats.size = this.getCurrentSize();
    this.stats.entries = this.cache.size;
    this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
  }

  private updateStats(type: 'hit' | 'miss'): void {
    if (type === 'hit') {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    this.updateSize();
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  // Public API
  getStats(): CacheStats {
    return { ...this.stats };
  }

  getTagIndex(): Map<string, Set<string>> {
    return new Map(this.tagIndex);
  }

  clear(): void {
    this.cache.clear();
    this.tagIndex.clear();
    this.stats = { hits: 0, misses: 0, size: 0, entries: 0, hitRate: 0 };
  }

  // Smart cache invalidation based on events
  async smartInvalidate(event: {
    type: 'data-update' | 'user-action' | 'region-deploy';
    tags?: string[];
    userId?: string;
    region?: string;
    pattern?: string;
  }): Promise<void> {
    switch (event.type) {
      case 'data-update':
        if (event.tags) {
          await this.invalidateByTags(event.tags);
        }
        break;
        
      case 'user-action':
        if (event.userId) {
          await this.invalidateByPattern(`user_${event.userId}_*`);
        }
        break;
        
      case 'region-deploy':
        if (event.region) {
          await this.invalidateRegion(event.region, event.pattern);
        }
        break;
    }
  }
}

export const edgeCacheStrategy = new EdgeCacheStrategy();