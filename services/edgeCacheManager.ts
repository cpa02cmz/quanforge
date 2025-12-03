/**
 * Edge-Optimized Cache Manager
 * Advanced multi-layer caching with edge-specific optimizations
 */

import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

interface EdgeCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  region: string;
  compressed: boolean;
  accessCount: number;
  lastAccessed: number;
  size: number;
  etag?: string;
  vary?: string[];
}

interface EdgeCacheConfig {
  memoryMaxSize: number;
  memoryMaxEntries: number;
  persistentMaxSize: number;
  persistentMaxEntries: number;
  defaultTTL: number;
  cleanupInterval: number;
  compressionThreshold: number;
  edgeRegions: string[];
  replicationFactor: number;
}

interface EdgeCacheStats {
  memoryHits: number;
  persistentHits: number;
  edgeHits: number;
  misses: number;
  memorySize: number;
  persistentSize: number;
  hitRate: number;
  regionalStats: Map<string, { hits: number; size: number }>;
}

/**
 * Edge-optimized cache with regional replication and intelligent invalidation
 */
export class EdgeCacheManager<T = any> {
  private memoryCache = new Map<string, EdgeCacheEntry<T>>();
  private persistentCache: IDBDatabase | null = null;
  private edgeCache = new Map<string, EdgeCacheEntry<T>>(); // Simulated edge cache
  private stats = {
    memoryHits: 0,
    persistentHits: 0,
    edgeHits: 0,
    misses: 0,
    regionalStats: new Map<string, { hits: number; size: number }>(),
  };
  private config: EdgeCacheConfig = {
    memoryMaxSize: 15 * 1024 * 1024, // 15MB for better edge performance
    memoryMaxEntries: 750, // Increased entries
    persistentMaxSize: 75 * 1024 * 1024, // 75MB persistent cache
    persistentMaxEntries: 3000, // Increased entries
    defaultTTL: 45 * 60 * 1000, // 45 minutes - optimized for edge
    cleanupInterval: 30000, // 30 seconds - more frequent cleanup
    compressionThreshold: 1536, // 1.5KB - more aggressive compression
    edgeRegions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1', 'cle1'],
    replicationFactor: 3, // Replicate to 3 edge regions for better availability
  };
  private cleanupTimer: number | null = null;
  private dbName = 'edgeCacheManager';
  private storeName = 'edgeCache';
  private currentRegion = process.env.VERCEL_REGION || 'unknown';

  constructor(config?: Partial<EdgeCacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.initPersistentCache();
    this.startCleanup();
    this.initializeRegionalStats();
  }

  private initializeRegionalStats(): void {
    this.config.edgeRegions.forEach(region => {
      this.stats.regionalStats.set(region, { hits: 0, size: 0 });
    });
  }

  private async initPersistentCache(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.persistentCache = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('ttl', 'ttl', { unique: false });
          store.createIndex('region', 'region', { unique: false });
          store.createIndex('etag', 'etag', { unique: false });
        }
      };
    });
  }

  /**
   * Get data with edge-optimized hierarchy
   */
  async get(key: string, options?: {
    region?: string;
    preferEdge?: boolean;
    vary?: string[];
  }): Promise<T | null> {
    const region = options?.region || this.currentRegion;
    const varyKey = this.getVaryKey(key, options?.vary);

    // 1. Check memory cache first (fastest)
    const memoryEntry = this.memoryCache.get(varyKey);
    if (memoryEntry && this.isValidEntry(memoryEntry)) {
      this.updateAccess(memoryEntry);
      this.stats.memoryHits++;
      this.updateRegionalStats(region, 'memory');
      return memoryEntry.compressed ? this.decompressData(memoryEntry.data) : memoryEntry.data;
    }

    // 2. Check edge cache (if preferred)
    if (options?.preferEdge !== false) {
      const edgeEntry = await this.getFromEdgeCache(varyKey, region);
      if (edgeEntry && this.isValidEntry(edgeEntry)) {
        // Promote to memory cache
        this.setToMemoryCache(varyKey, edgeEntry);
        this.updateAccess(edgeEntry);
        this.stats.edgeHits++;
        this.updateRegionalStats(region, 'edge');
        return edgeEntry.compressed ? this.decompressData(edgeEntry.data) : edgeEntry.data;
      }
    }

    // 3. Check persistent cache
    const persistentEntry = await this.getFromIndexedDB(varyKey);
    if (persistentEntry && this.isValidEntry(persistentEntry)) {
      // Promote to higher tiers
      this.setToMemoryCache(varyKey, persistentEntry);
      await this.setToEdgeCache(varyKey, persistentEntry, region);
      this.updateAccess(persistentEntry);
      this.stats.persistentHits++;
      this.updateRegionalStats(region, 'persistent');
      return persistentEntry.compressed ? this.decompressData(persistentEntry.data) : persistentEntry.data;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set data with edge replication
   */
  async set(key: string, data: T, options?: {
    ttl?: number;
    region?: string;
    priority?: 'low' | 'normal' | 'high';
    replicate?: boolean;
    vary?: string[];
    etag?: string;
  }): Promise<void> {
    const region = options?.region || this.currentRegion;
    const varyKey = this.getVaryKey(key, options?.vary);
    const ttl = options?.ttl || this.config.defaultTTL;
    const shouldCompress = this.shouldCompress(data);
    const processedData = shouldCompress ? this.compressData(data) : data;
    const size = this.estimateSize(data);

    const entry: EdgeCacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl,
      region,
      compressed: shouldCompress,
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
      etag: options?.etag,
      vary: options?.vary,
    };

    // Store in all applicable tiers
    this.setToMemoryCache(varyKey, entry);
    await this.setToIndexedDB(varyKey, entry);
    
    if (options?.replicate !== false) {
      await this.setToEdgeCache(varyKey, entry, region);
      await this.replicateToEdgeRegions(varyKey, entry, region);
    }
  }

  /**
   * Invalidate cache entries with smart invalidation
   */
  async invalidate(pattern: string | string[], options?: {
    region?: string;
    cascade?: boolean;
  }): Promise<void> {
    const region = options?.region || this.currentRegion;
    const patterns = Array.isArray(pattern) ? pattern : [pattern];

    for (const pattern of patterns) {
      // Invalidate memory cache
      for (const [key] of this.memoryCache.entries()) {
        if (this.matchesPattern(key, pattern)) {
          this.memoryCache.delete(key);
        }
      }

      // Invalidate edge cache
      for (const [key] of this.edgeCache.entries()) {
        if (this.matchesPattern(key, pattern)) {
          this.edgeCache.delete(key);
        }
      }

      // Invalidate persistent cache
      await this.invalidateIndexedDB(pattern);

      // Cascade invalidation to related entries
      if (options?.cascade) {
        await this.cascadeInvalidation(pattern);
      }
    }
  }

  /**
   * Warm up cache with predicted data
   */
  async warmup(keys: string[], options?: {
    region?: string;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<{ warmed: number; failed: number }> {
    const region = options?.region || this.currentRegion;
    let warmed = 0;
    let failed = 0;

    const warmupPromises = keys.map(async (key) => {
      try {
        // Check if already cached
        const cached = await this.get(key, { region });
        if (cached) {
          warmed++;
          return;
        }

        // Simulate fetching data (in real implementation, this would fetch from source)
        const mockData = await this.fetchDataForWarmup(key);
        if (mockData) {
          await this.set(key, mockData, {
            region,
            priority: options?.priority || 'normal',
            replicate: true,
          });
          warmed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.warn(`Failed to warmup cache for key ${key}:`, error);
        failed++;
      }
    });

    await Promise.allSettled(warmupPromises);
    
    return { warmed, failed };
  }

  private getVaryKey(key: string, vary?: string[]): string {
    if (!vary || vary.length === 0) return key;
    return `${key}:${vary.sort().join(',')}`;
  }

  private isValidEntry(entry: EdgeCacheEntry<T>): boolean {
    return Date.now() - entry.timestamp <= entry.ttl;
  }

  private updateAccess(entry: EdgeCacheEntry<T>): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
  }

  private updateRegionalStats(region: string, tier: 'memory' | 'edge' | 'persistent'): void {
    const stats = this.stats.regionalStats.get(region);
    if (stats) {
      stats.hits++;
    }
  }

  private async getFromEdgeCache(key: string, region: string): Promise<EdgeCacheEntry<T> | null> {
    // Simulated edge cache - in real implementation, this would use Vercel's Edge Cache API
    const edgeKey = `${region}:${key}`;
    const entry = this.edgeCache.get(edgeKey);
    
    if (entry && this.isValidEntry(entry)) {
      return entry;
    }
    
    return null;
  }

  private async setToEdgeCache(key: string, entry: EdgeCacheEntry<T>, region: string): Promise<void> {
    const edgeKey = `${region}:${key}`;
    this.edgeCache.set(edgeKey, { ...entry, region });
    
    // Update regional stats
    const stats = this.stats.regionalStats.get(region);
    if (stats) {
      stats.size += entry.size;
    }
  }

  private async replicateToEdgeRegions(
    key: string, 
    entry: EdgeCacheEntry<T>, 
    sourceRegion: string
  ): Promise<void> {
    const targetRegions = this.config.edgeRegions
      .filter(r => r !== sourceRegion)
      .slice(0, this.config.replicationFactor);

    const replicationPromises = targetRegions.map(region => 
      this.setToEdgeCache(key, entry, region)
    );

    await Promise.allSettled(replicationPromises);
  }

  private setToMemoryCache(key: string, entry: EdgeCacheEntry<T>): void {
    this.memoryCache.set(key, entry);
    
    // Evict if necessary
    if (this.getCurrentMemorySize() > this.config.memoryMaxSize || 
        this.memoryCache.size > this.config.memoryMaxEntries) {
      this.evictMemoryCache();
    }
  }

  private async getFromIndexedDB(key: string): Promise<EdgeCacheEntry<T> | null> {
    if (!this.persistentCache) return null;

    return new Promise((resolve) => {
      const transaction = this.persistentCache!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        const entry = result.value as EdgeCacheEntry<T>;
        if (!this.isValidEntry(entry)) {
          this.deleteFromIndexedDB(key);
          resolve(null);
          return;
        }

        resolve(entry);
      };
    });
  }

  private async setToIndexedDB(key: string, entry: EdgeCacheEntry<T>): Promise<void> {
    if (!this.persistentCache) return;

    return new Promise((resolve) => {
      const transaction = this.persistentCache!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ key, value: entry });
      
      request.onerror = () => resolve();
      request.onsuccess = () => resolve();
    });
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.persistentCache) return;

    return new Promise((resolve) => {
      const transaction = this.persistentCache!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      
      request.onerror = () => resolve();
      request.onsuccess = () => resolve();
    });
  }

  private async invalidateIndexedDB(pattern: string): Promise<void> {
    if (!this.persistentCache) return;

    return new Promise((resolve) => {
      const transaction = this.persistentCache!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (this.matchesPattern(cursor.key as string, pattern)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => resolve();
    });
  }

  private matchesPattern(key: string, pattern: string): boolean {
    // Simple pattern matching - can be enhanced with regex
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(key);
    }
    return key.includes(pattern);
  }

  private async cascadeInvalidation(pattern: string): Promise<void> {
    // Find and invalidate related cache entries
    const relatedPatterns = this.getRelatedPatterns(pattern);
    
    for (const relatedPattern of relatedPatterns) {
      await this.invalidate(relatedPattern, { cascade: false });
    }
  }

  private getRelatedPatterns(pattern: string): string[] {
    // Generate related patterns based on common cache key structures
    const patterns: string[] = [];
    
    if (pattern.includes('robots')) {
      patterns.push('robots_list', 'robots_search', 'robots_filter');
    }
    
    if (pattern.includes('strategies')) {
      patterns.push('strategies_list', 'strategies_config');
    }
    
    return patterns;
  }

  private async fetchDataForWarmup(key: string): Promise<T | null> {
    // Mock implementation - in real scenario, this would fetch from the actual data source
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Return mock data based on key pattern
      if (key.includes('robots')) {
        return { id: 'mock', name: 'Warmup Robot' } as T;
      }
      
      if (key.includes('strategies')) {
        return { id: 'mock', type: 'Warmup Strategy' } as T;
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to fetch data for warmup key ${key}:`, error);
      return null;
    }
  }

  private estimateSize(data: T): number {
    if (data === null || data === undefined) return 0;
    return JSON.stringify(data).length * 2; // Rough estimate in bytes
  }

  private shouldCompress(data: T): boolean {
    return this.estimateSize(data) > this.config.compressionThreshold;
  }

  private compressData(data: T): T {
    try {
      const jsonString = JSON.stringify(data);
      const compressed = compressToUTF16(jsonString);
      return compressed as unknown as T;
    } catch (error) {
      console.warn('Failed to compress data:', error);
      return data;
    }
  }

  private decompressData(data: T): T {
    try {
      if (typeof data !== 'string') return data;
      const decompressed = decompressFromUTF16(data as string);
      return JSON.parse(decompressed);
    } catch (error) {
      console.warn('Failed to decompress data:', error);
      return data;
    }
  }

  private evictMemoryCache(): void {
    const entries = Array.from(this.memoryCache.entries());
    
    // Sort by access count and last accessed time (LRU with frequency consideration)
    entries.sort(([, a], [, b]) => {
      const scoreA = a.accessCount * 1000 + (Date.now() - a.lastAccessed);
      const scoreB = b.accessCount * 1000 + (Date.now() - b.lastAccessed);
      return scoreA - scoreB;
    });
    
    let currentSize = this.getCurrentMemorySize();
    const targetSize = this.config.memoryMaxSize * 0.8; // Evict to 80%
    
    for (const [key, entry] of entries) {
      if (currentSize <= targetSize && this.memoryCache.size <= this.config.memoryMaxEntries) {
        break;
      }
      
      // Move to persistent cache if still valid
      if (this.isValidEntry(entry)) {
        this.setToIndexedDB(key, entry);
      }
      
      this.memoryCache.delete(key);
      currentSize -= entry.size || 0;
    }
  }

  private getCurrentMemorySize(): number {
    let size = 0;
    for (const entry of this.memoryCache.values()) {
      size += entry.size || 0;
    }
    return size;
  }

  private cleanup(): void {
    const now = Date.now();
    
    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (!this.isValidEntry(entry)) {
        this.memoryCache.delete(key);
      }
    }
    
    // Clean edge cache
    for (const [key, entry] of this.edgeCache.entries()) {
      if (!this.isValidEntry(entry)) {
        this.edgeCache.delete(key);
      }
    }
    
    // Clean persistent cache
    if (this.persistentCache) {
      const transaction = this.persistentCache.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('ttl');
      const request = index.openCursor(IDBKeyRange.upperBound(now - this.config.defaultTTL));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }
    
    // Evict if necessary
    if (this.getCurrentMemorySize() > this.config.memoryMaxSize || 
        this.memoryCache.size > this.config.memoryMaxEntries) {
      this.evictMemoryCache();
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = window.setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): EdgeCacheStats {
    const totalHits = this.stats.memoryHits + this.stats.persistentHits + this.stats.edgeHits;
    const totalRequests = totalHits + this.stats.misses;
    
    return {
      memoryHits: this.stats.memoryHits,
      persistentHits: this.stats.persistentHits,
      edgeHits: this.stats.edgeHits,
      misses: this.stats.misses,
      memorySize: this.getCurrentMemorySize(),
      persistentSize: 0, // Would need separate tracking for IndexedDB
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      regionalStats: new Map(this.stats.regionalStats),
    };
  }

  /**
   * Optimize cache configuration based on usage patterns
   */
  optimizeConfiguration(): void {
    const stats = this.getStats();
    
    // Adjust TTL based on hit rate
    if (stats.hitRate > 0.9) {
      this.config.defaultTTL = Math.min(this.config.defaultTTL * 1.2, 60 * 60 * 1000); // Max 1 hour
    } else if (stats.hitRate < 0.7) {
      this.config.defaultTTL = Math.max(this.config.defaultTTL * 0.8, 5 * 60 * 1000); // Min 5 minutes
    }
    
    // Adjust compression threshold based on memory usage
    if (stats.memorySize > this.config.memoryMaxSize * 0.8) {
      this.config.compressionThreshold = Math.max(this.config.compressionThreshold * 0.8, 1024);
    }
    
    console.log('Cache configuration optimized:', {
      defaultTTL: this.config.defaultTTL,
      compressionThreshold: this.config.compressionThreshold,
      hitRate: stats.hitRate,
    });
  }

  destroy(): void {
    if (this.cleanupTimer) {
      window.clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.persistentCache) {
      this.persistentCache.close();
      this.persistentCache = null;
    }
    
    this.memoryCache.clear();
    this.edgeCache.clear();
  }
}

// Global edge cache manager instance
export const edgeCacheManager = new EdgeCacheManager();