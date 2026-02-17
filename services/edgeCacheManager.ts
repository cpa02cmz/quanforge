/**
 * Edge-Optimized Cache Manager
 * Advanced multi-layer caching with edge-specific optimizations
 */

import { EdgeCacheCompression } from './edgeCacheCompression';
import { createSafeWildcardPattern, ReDoSError } from '../utils/safeRegex';
import { CACHE_CONFIG, TIME_CONSTANTS, EDGE_CONFIG } from '../constants/config';
import { STAGGER } from './constants';
import { createScopedLogger } from '../utils/logger';
import { ADJUSTMENT_FACTORS, THRESHOLD_CONSTANTS, EDGE_CACHE_CONSTANTS } from './modularConstants';

const logger = createScopedLogger('EdgeCacheManager');

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
    memoryMaxSize: CACHE_CONFIG.MAX_CACHE_MEMORY_SIZE * ADJUSTMENT_FACTORS.TTL.INCREASE_MEDIUM, // 15MB - optimized for edge performance
    memoryMaxEntries: CACHE_CONFIG.MAX_CACHE_ENTRIES * ADJUSTMENT_FACTORS.TTL.INCREASE_MEDIUM, // 1500 entries
    persistentMaxSize: EDGE_CACHE_CONSTANTS.SIZE.PERSISTENT_MAX, // 75MB persistent cache
    persistentMaxEntries: EDGE_CACHE_CONSTANTS.SIZE.PERSISTENT_MAX_ENTRIES, // 3000 entries
    defaultTTL: TIME_CONSTANTS.CACHE_LONG_TTL, // 60 minutes - increased for better hit rates
    cleanupInterval: TIME_CONSTANTS.CLEANUP_DEFAULT_INTERVAL, // 60 seconds - balanced cleanup
    compressionThreshold: CACHE_CONFIG.ADVANCED_CACHE_COMPRESSION_THRESHOLD, // 512B - lower threshold for more compression
    edgeRegions: EDGE_CONFIG.REGIONS.concat(['sfo1', 'arn1', 'gru1', 'syd1', 'nrt1']), // Extended regions
    replicationFactor: 4, // Increased replication for better redundancy
  };
  private cleanupTimer: number | null = null;
  private dbName = 'edgeCacheManager';
  private storeName = 'edgeCache';
  private currentRegion = process.env['VERCEL_REGION'] || 'unknown';
  private compression: EdgeCacheCompression;

  constructor(config?: Partial<EdgeCacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.compression = new EdgeCacheCompression({
      compressionThreshold: this.config.compressionThreshold,
    });
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
    staleWhileRevalidate?: boolean;
  }): Promise<T | null> {
    const region = options?.region || this.currentRegion;
    const varyKey = this.getVaryKey(key, options?.vary);

    // 1. Check memory cache first (fastest)
    const memoryEntry = this.memoryCache.get(varyKey);
    if (memoryEntry && this.isValidEntry(memoryEntry)) {
      this.updateAccess(memoryEntry);
      this.stats.memoryHits++;
      this.updateRegionalStats(region, 'memory');
      return memoryEntry.compressed ? this.compression.decompress(memoryEntry.data) : memoryEntry.data;
    }

    // 2. Check edge cache hierarchy with stale-while-revalidate
    if (options?.preferEdge !== false) {
      const edgeEntry = await this.getFromEdgeHierarchy(varyKey, region);
      if (edgeEntry) {
        // Check if entry is stale but still usable
        const isStale = !this.isValidEntry(edgeEntry);
        const canUseStale = options?.staleWhileRevalidate && this.canUseStaleEntry(edgeEntry);
        
        if (!isStale || canUseStale) {
          // Promote to memory cache
          this.setToMemoryCache(varyKey, edgeEntry);
          this.updateAccess(edgeEntry);
          
          if (isStale) {
            this.stats.edgeHits++; // Count as hit even if stale
            // Trigger background refresh
            this.refreshEntryInBackground(key, varyKey, region);
          } else {
            this.stats.edgeHits++;
          }
          
          this.updateRegionalStats(region, 'edge');
          return edgeEntry.compressed ? this.compression.decompress(edgeEntry.data) : edgeEntry.data;
        }
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
      return persistentEntry.compressed ? this.compression.decompress(persistentEntry.data) : persistentEntry.data;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Get data from edge cache hierarchy with multi-tier lookup
   */
  private async getFromEdgeHierarchy(key: string, region: string): Promise<EdgeCacheEntry<T> | null> {
    // 1. Check CDN edge cache (fastest)
    const cdnCache = await this.getFromCDNCache(key, region);
    if (cdnCache) {
      return cdnCache;
    }
    
    // 2. Check regional edge cache
    const regionalCache = await this.getFromRegionalCache(key, region);
    if (regionalCache) {
      // Promote to CDN cache for faster future access
      await this.setToCDNCache(key, regionalCache, region);
      return regionalCache;
    }
    
    // 3. Check neighboring edge regions for fallback
    const neighborCache = await this.getFromNeighborCache(key, region);
    if (neighborCache) {
      // Promote through the hierarchy
      await this.setToRegionalCache(key, neighborCache, region);
      await this.setToCDNCache(key, neighborCache, region);
      return neighborCache;
    }
    
    return null;
  }

  /**
   * Get from CDN edge cache with Vercel Edge Cache API integration
   */
  private async getFromCDNCache(key: string, region: string): Promise<EdgeCacheEntry<T> | null> {
    const cdnKey = `cdn:${region}:${key}`;
    
    // Try Vercel Edge Cache first (if available in edge runtime)
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open('edge-cache');
        const response = await cache.match(cdnKey);
        
        if (response) {
          const data = await response.json();
          const entry: EdgeCacheEntry<T> = {
            ...data,
            timestamp: Date.now() - (response.headers.get('age') ? parseInt(response.headers.get('age')!) * 1000 : 0)
          };
          
          if (this.isValidEntry(entry)) {
            // Store in local edge cache for faster access
            this.edgeCache.set(cdnKey, entry);
            return entry;
          }
        }
      } catch (error: unknown) {
        logger.debug('CDN cache lookup failed:', error);
      }
    }
    
    // Fallback to local edge cache
    const entry = this.edgeCache.get(cdnKey);
    if (entry && this.isValidEntry(entry)) {
      return entry;
    }
    
    return null;
  }

  /**
   * Get from regional edge cache
   */
  private async getFromRegionalCache(key: string, region: string): Promise<EdgeCacheEntry<T> | null> {
    const regionalKey = `regional:${region}:${key}`;
    const entry = this.edgeCache.get(regionalKey);
    
    if (entry && this.isValidEntry(entry)) {
      return entry;
    }
    
    return null;
  }

  private async setToRegionalCache(key: string, entry: EdgeCacheEntry<T>, region: string): Promise<void> {
    const regionalKey = `regional:${region}:${key}`;
    this.edgeCache.set(regionalKey, { ...entry, region });
  }

  /**
   * Get from neighboring edge regions for fallback
   */
  private async getFromNeighborCache(key: string, region: string): Promise<EdgeCacheEntry<T> | null> {
    // Get neighboring regions based on geographic proximity
    const neighbors = this.getNeighborRegions(region);
    
    for (const neighbor of neighbors) {
      const neighborKey = `regional:${neighbor}:${key}`;
      const entry = this.edgeCache.get(neighborKey);
      
      if (entry && this.isValidEntry(entry)) {
        return entry;
      }
    }
    
    return null;
  }

  /**
   * Set to CDN cache with Vercel Edge Cache API integration
   */
  private async setToCDNCache(key: string, entry: EdgeCacheEntry<T>, region: string): Promise<void> {
    const cdnKey = `cdn:${region}:${key}`;
    
    // Store in local edge cache
    this.edgeCache.set(cdnKey, { ...entry, region });
    
    // Try to store in Vercel Edge Cache (if available)
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open('edge-cache');
        const response = new Response(JSON.stringify(entry), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${Math.floor(entry.ttl / 1000)}`,
            'Edge-Cache-Tag': `region:${region},key:${key}`,
            'X-Edge-Cache-Region': region,
          }
        });
        
        await cache.put(cdnKey, response);
      } catch (error: unknown) {
        logger.debug('CDN cache storage failed:', error);
      }
    }
    
    // Update regional stats
    const stats = this.stats.regionalStats.get(region);
    if (stats) {
      stats.size += entry.size;
    }
  }

/**
     * Initialize edge cache with enhanced warming
     */
    async initialize(): Promise<void> {
      // Initialize persistent cache (this method exists)
      await this.initPersistentCache();
      
      // Start cleanup timer (this method exists)
      this.startCleanup();
      
      // Initialize regional stats (this method exists)
      this.initializeRegionalStats();
    }

  /**
   * Get neighboring regions for fallback
   */
  private getNeighborRegions(region: string): string[] {
    const proximityMap: Record<string, string[]> = {
      'hkg1': ['sin1', 'fra1'],
      'sin1': ['hkg1', 'fra1'],
      'fra1': ['sin1', 'iad1'],
      'iad1': ['fra1', 'sfo1', 'cle1'],
      'sfo1': ['iad1', 'arn1'],
      'arn1': ['sfo1', 'gru1'],
      'gru1': ['arn1'],
      'cle1': ['iad1']
    };
    
    return proximityMap[region] || [];
  }

  /**
   * Check if stale entry can still be used
   */
  private canUseStaleEntry(entry: EdgeCacheEntry<T>): boolean {
    const age = Date.now() - entry.timestamp;
    const staleThreshold = entry.ttl * ADJUSTMENT_FACTORS.EVICTION.STALE_THRESHOLD; // Allow 50% past TTL
    return age <= entry.ttl + staleThreshold;
  }

  /**
   * Refresh entry in background
   */
  private async refreshEntryInBackground(originalKey: string, _varyKey: string, region: string): Promise<void> {
    // Don't wait for this to complete
    setTimeout(async () => {
      try {
        const freshData = await this.fetchDataForWarmup(originalKey);
        if (freshData) {
          await this.set(originalKey, freshData, {
            region,
            replicate: true,
          });
        }
      } catch (error: unknown) {
        logger.debug(`Background refresh failed for key ${originalKey}:`, error);
      }
    }, 0);
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
    const shouldCompress = this.compression.shouldCompress(data);
    const processedData = shouldCompress ? this.compression.compress(data) : data;
    const size = this.compression.estimateSize(data);

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
    const targetRegion = options?.region || this.currentRegion;
    // Use targetRegion for cache invalidation
    this.currentRegion = targetRegion;
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
   * Semantic cache invalidation based on entity and action
   */
  async invalidateSemantic(entity: string, _action: 'create' | 'update' | 'delete', id?: string): Promise<void> {
    const patterns: string[] = [
      `${entity}_list`,
      `${entity}_search`,
      `${entity}_filter`,
      ...(id ? [`${entity}_${id}`] : []),
      `${entity}_analytics`
    ];
    
    await this.invalidateIntelligent(patterns, { cascade: true, dependencies: true });
  }

  /**
   * Warm up cache with predicted data and intelligent prioritization
   */
  async warmup(keys: string[], options?: {
    region?: string;
    priority?: 'low' | 'normal' | 'high';
    predictive?: boolean;
  }): Promise<{ warmed: number; failed: number }> {
    const region = options?.region || this.currentRegion;
    let warmed = 0;
    let failed = 0;

    // Trigger predictive warming if enabled
    if (options?.predictive) {
      this.predictiveCacheWarming().catch((err) => logger.error('Predictive cache warming failed', err));
    }

    // Sort keys by priority if predictive warming is enabled
    const sortedKeys = options?.predictive ? 
      this.prioritizeKeysForWarmup(keys, region) : 
      keys;

    // Process in batches to avoid overwhelming the system
    const batchSize = options?.priority === 'high' ? 10 : 5;
    
    for (let i = 0; i < sortedKeys.length; i += batchSize) {
      const batch = sortedKeys.slice(i, i + batchSize);
      
      const warmupPromises = batch.map(async (key) => {
        try {
          // Check if already cached (memory cache)
          const cached = await this.get(key, { region });
          if (cached) {
            warmed++;
            return;
          }

          // Check edge cache as fallback
          const edgeCached = await this.getFromEdgeCache(key, region);
          if (edgeCached) {
            warmed++;
            return;
          }

          // Fetch data with timeout
          let timeoutId: ReturnType<typeof setTimeout>;
          const mockData = await Promise.race([
            this.fetchDataForWarmup(key).then((value: any) => {
              clearTimeout(timeoutId);
              return value;
            }),
            new Promise<null>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('Warmup timeout')), STAGGER.WARMUP_TIMEOUT_MS);
            })
          ]);
          
          if (mockData) {
            await this.set(key, mockData, {
              region,
              priority: options?.priority || 'normal',
              replicate: true,
              ttl: this.getAdaptiveTTL(key, options?.priority),
            });
            warmed++;
          } else {
            failed++;
          }
        } catch (error: unknown) {
          logger.warn(`Failed to warmup cache for key ${key}:`, error);
          failed++;
        }
      });

      await Promise.allSettled(warmupPromises);
      
      // Small delay between batches to prevent rate limiting
      if (i + batchSize < sortedKeys.length) {
        await new Promise(resolve => setTimeout(resolve, STAGGER.DEFAULT_DELAY_MS));
      }
    }
    
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

  private updateRegionalStats(region: string, _tier: 'memory' | 'edge' | 'persistent'): void {
    const stats = this.stats.regionalStats.get(region);
    if (stats) {
      stats.hits++;
    }
  }

  // getFromEdgeCache retrieves cache entry from edge cache
  private async getFromEdgeCache(key: string, region: string): Promise<EdgeCacheEntry<T> | null> {
    // Simulated edge cache - in real implementation, this would use Vercel's Edge Cache API
    const edgeKey = `${region}:${key}`;
    const entry = this.edgeCache.get(edgeKey);
    
    if (entry && this.isValidEntry(entry)) {
      return entry;
    }
    
    return null;
  }

  // getFromEdgeCache is used internally for edge cache retrieval

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
    // Simple pattern matching with ReDoS protection
    if (pattern.includes('*')) {
      try {
        const regex = createSafeWildcardPattern(pattern);
        return regex.test(key);
      } catch (error: unknown) {
        // Fall back to simple string matching if pattern is unsafe
        if (error instanceof ReDoSError) {
          logger.warn('Unsafe cache pattern detected:', error.message);
          return key.includes(pattern.replace(/\*/g, ''));
        }
        return false;
      }
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
      patterns.push('robots_list', 'robots_search', 'robots_filter', 'robots_analytics');
    }
    
    if (pattern.includes('strategies')) {
      patterns.push('strategies_list', 'strategies_config', 'strategies_performance');
    }
    
    if (pattern.includes('market_data')) {
      patterns.push('market_data_*', 'market_tickers', 'market_analytics');
    }
    
    return patterns;
  }

  /**
   * Predictive cache warming based on usage patterns
   * Note: Called internally by warmup scheduler
   */
  private async predictiveCacheWarming(): Promise<void> {
    const userPatterns = this.analyzeUserPatterns();
    const criticalPaths = this.getCriticalPaths();
    
    // Warm based on user behavior patterns
    for (const pattern of userPatterns) {
      await this.warmCachePattern(pattern);
    }
    
    // Warm critical application paths
    for (const path of criticalPaths) {
      await this.warmCriticalPath(path);
    }
  }

  private analyzeUserPatterns(): string[] {
    // Analyze common user access patterns
    return [
      'robots_list',
      'strategies_config',
      'market_data_major_pairs',
      'user_preferences',
      'ai_chat_history'
    ];
  }

  private getCriticalPaths(): string[] {
    // Define critical application paths
    return [
      'dashboard_config',
      'generator_templates',
      'authentication_state',
      'system_health'
    ];
  }

  private async warmCachePattern(pattern: string): Promise<void> {
    try {
      const data = await this.fetchDataForWarmup(pattern);
      if (data) {
        await this.set(pattern, data, {
          ttl: this.config.defaultTTL * 2, // Extended TTL for warmed cache
          replicate: true
        });
      }
    } catch (error: unknown) {
      logger.warn(`Failed to warm cache pattern: ${pattern}`, error);
    }
  }

  private async warmCriticalPath(path: string): Promise<void> {
    try {
      const data = await this.fetchDataForWarmup(path);
      if (data) {
        await this.set(path, data, {
          ttl: this.config.defaultTTL * 3, // Extended TTL for critical paths
          replicate: true,
          priority: 'high'
        });
      }
    } catch (error: unknown) {
      logger.warn(`Failed to warm critical path: ${path}`, error);
    }
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
    } catch (error: unknown) {
      logger.error(`Failed to fetch data for warmup key ${key}:`, error);
      return null;
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
    const targetSize = this.config.memoryMaxSize * ADJUSTMENT_FACTORS.EVICTION.TARGET_SIZE; // Evict to 80%
    
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
   * Prioritize keys for warmup based on usage patterns and region
   */
  private prioritizeKeysForWarmup(keys: string[], region: string): string[] {
    const stats = this.getStats();
    const regionStats = stats.regionalStats.get(region);
    // Region stats used for prioritization logic (currently simplified)
    void regionStats;
    
    return keys.sort((a, b) => {
      // Prioritize based on historical access patterns
      const aAccess = this.getAccessScore(a, region);
      const bAccess = this.getAccessScore(b, region);
      
      // Prioritize based on key type
      const aTypeScore = this.getKeyTypeScore(a);
      const bTypeScore = this.getKeyTypeScore(b);
      
      // Combine scores
      const aScore = aAccess * 0.6 + aTypeScore * 0.4;
      const bScore = bAccess * 0.6 + bTypeScore * 0.4;
      
      return bScore - aScore;
    });
  }

  /**
   * Get access score for a key in a specific region
   */
  private getAccessScore(key: string, _region: string): number {
    // Simulate access scoring based on key patterns
    // Region parameter reserved for regional scoring variations
    if (key.includes('robots_list')) return 100;
    if (key.includes('strategies')) return 90;
    if (key.includes('market_data')) return 85;
    if (key.includes('user_session')) return 95;
    if (key.includes('analytics')) return 70;
    return 50;
  }

  /**
   * Get score based on key type
   */
  private getKeyTypeScore(key: string): number {
    if (key.includes('list') || key.includes('index')) return 90;
    if (key.includes('search') || key.includes('filter')) return 80;
    if (key.includes('detail') || key.includes('single')) return 70;
    if (key.includes('config') || key.includes('settings')) return 85;
    return 60;
  }

  /**
   * Get adaptive TTL based on key type and priority
   */
  private getAdaptiveTTL(key: string, priority?: 'low' | 'normal' | 'high'): number {
    let baseTTL = this.config.defaultTTL;
    
    // Adjust based on key type
    if (key.includes('robots_list')) baseTTL *= ADJUSTMENT_FACTORS.TTL.ROBOTS_MULTIPLIER;
    if (key.includes('market_data')) baseTTL *= ADJUSTMENT_FACTORS.TTL.MARKET_MULTIPLIER; // Market data changes frequently
    if (key.includes('strategies')) baseTTL *= ADJUSTMENT_FACTORS.TTL.INCREASE_SMALL;
    if (key.includes('user_session')) baseTTL *= ADJUSTMENT_FACTORS.TTL.SESSION_MULTIPLIER;

    // Adjust based on priority
    if (priority === 'high') baseTTL *= ADJUSTMENT_FACTORS.TTL.INCREASE_MEDIUM;
    if (priority === 'low') baseTTL *= ADJUSTMENT_FACTORS.TTL.DECREASE_MEDIUM;
    
    return Math.min(Math.max(baseTTL, EDGE_CACHE_CONSTANTS.TTL.MIN), EDGE_CACHE_CONSTANTS.TTL.MAX); // 5min to 2hr range
  }

  /**
   * Predictive cache warming based on usage patterns
   */
  async predictiveWarmup(region?: string): Promise<{ warmed: number; failed: number }> {
    const targetRegion = region || this.currentRegion;
    const stats = this.getStats();
    
    // Identify patterns and predict likely-to-be-accessed keys
    const predictedKeys = this.predictAccessKeys(targetRegion, stats);
    
    if (predictedKeys.length === 0) {
      return { warmed: 0, failed: 0 };
    }

    logger.log(`Predictive warmup for region ${targetRegion}: ${predictedKeys.length} keys`);

    return this.warmup(predictedKeys, {
      region: targetRegion,
      priority: 'normal',
      predictive: true,
    });
  }

  /**
   * Predict keys that are likely to be accessed
   */
  private predictAccessKeys(region: string, stats: EdgeCacheStats): string[] {
    // Base keys that are commonly accessed
    const baseKeys = [
      'robots_list',
      'strategies_list',
      'market_data_major_pairs',
      'user_session_active',
      'analytics_summary',
    ];
    
    // Add keys based on regional access patterns
    const regionStats = stats.regionalStats.get(region);
    if (regionStats && regionStats.hits > 100) {
      // High-traffic region gets more aggressive warming
      baseKeys.push('robots_search_trending', 'strategies_popular', 'market_data_volatility');
    }
    
    // Add time-based predictions
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      // Business hours - more trading activity
      baseKeys.push('market_data_realtime', 'strategies_active_trading');
    }
    
    return baseKeys;
  }

  /**
   * Intelligent cache invalidation with cascade and dependency tracking
   */
  async invalidateIntelligent(patterns: string[], options?: {
    region?: string;
    cascade?: boolean;
    dependencies?: boolean;
  }): Promise<{ invalidated: number; cascaded: number }> {
    const region = options?.region || this.currentRegion;
    let invalidated = 0;
    let cascaded = 0;

    for (const pattern of patterns) {
      // Count before invalidation
      const beforeCount = this.countMatchingEntries(pattern);
      
      // Standard invalidation
      await this.invalidate(pattern, { region, cascade: options?.cascade });
      invalidated += beforeCount;

      // Dependency-based invalidation
      if (options?.dependencies) {
        const dependencies = this.getDependencies(pattern);
        for (const dep of dependencies) {
          const depCount = this.countMatchingEntries(dep);
          await this.invalidate(dep, { region, cascade: false });
          cascaded += depCount;
        }
      }
    }

    return { invalidated, cascaded };
  }

  /**
   * Count entries matching a pattern
   */
  private countMatchingEntries(pattern: string): number {
    let count = 0;
    
    for (const key of this.memoryCache.keys()) {
      if (this.matchesPattern(key, pattern)) count++;
    }
    
    for (const key of this.edgeCache.keys()) {
      if (this.matchesPattern(key, pattern)) count++;
    }
    
    return count;
  }

  /**
   * Get dependencies for a cache pattern
   */
  private getDependencies(pattern: string): string[] {
    const dependencies: string[] = [];
    
    // Define dependency relationships
    if (pattern.includes('robots')) {
      dependencies.push('robots_list', 'robots_search', 'robots_filter', 'robots_stats');
    }
    
    if (pattern.includes('strategies')) {
      dependencies.push('strategies_list', 'strategies_config', 'strategies_performance');
    }
    
    if (pattern.includes('market_data')) {
      dependencies.push('market_data_summary', 'market_data_trending');
    }
    
    return dependencies;
  }

  /**
   * Optimize cache configuration based on usage patterns
   */
  optimizeConfiguration(): void {
    const stats = this.getStats();
    
    // Adjust TTL based on hit rate
    if (stats.hitRate > THRESHOLD_CONSTANTS.CACHE_HIT_RATE.EXCELLENT) {
      this.config.defaultTTL = Math.min(this.config.defaultTTL * ADJUSTMENT_FACTORS.TTL.INCREASE_SMALL, TIME_CONSTANTS.HOUR); // Max 1 hour
    } else if (stats.hitRate < THRESHOLD_CONSTANTS.CACHE_HIT_RATE.ACCEPTABLE) {
      this.config.defaultTTL = Math.max(this.config.defaultTTL * ADJUSTMENT_FACTORS.TTL.DECREASE_LARGE, 5 * TIME_CONSTANTS.MINUTE); // Min 5 minutes
    }

    // Adjust compression threshold based on memory usage
    if (stats.memorySize > this.config.memoryMaxSize * ADJUSTMENT_FACTORS.EVICTION.TARGET_SIZE) {
      this.config.compressionThreshold = Math.max(this.config.compressionThreshold * ADJUSTMENT_FACTORS.EVICTION.COMPRESSION_THRESHOLD, 1024);
    }
    
    // Optimize replication factor based on regional performance
    this.optimizeReplicationFactor(stats);
    
    logger.log('Cache configuration optimized:', {
      defaultTTL: this.config.defaultTTL,
      compressionThreshold: this.config.compressionThreshold,
      hitRate: stats.hitRate,
      replicationFactor: this.config.replicationFactor,
    });
  }

  /**
   * Optimize replication factor based on regional performance
   */
  private optimizeReplicationFactor(stats: EdgeCacheStats): void {
    let totalRegionalHits = 0;
    let activeRegions = 0;
    
    for (const [_region, regionStats] of stats.regionalStats.entries()) {
      if (regionStats.hits > 10) {
        totalRegionalHits += regionStats.hits;
        activeRegions++;
      }
    }
    
    // Adjust replication based on active regions and hit distribution
    if (activeRegions > 3 && totalRegionalHits > 1000) {
      this.config.replicationFactor = Math.min(this.config.replicationFactor + 1, 4);
    } else if (activeRegions < 2) {
      this.config.replicationFactor = Math.max(this.config.replicationFactor - 1, 1);
    }
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