import { createScopedLogger } from '../utils/logger';
import { securityManager } from './securityManager';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

const logger = createScopedLogger('ConsolidatedCache');

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
  compress?: boolean;
  persistent?: boolean;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: string[];
  priority: 'low' | 'normal' | 'high';
  compressed: boolean;
  accessCount: number;
  lastAccessed: number;
  size: number;
  layer: 'memory' | 'persistent';
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  memoryUsage: number;
  persistentUsage: number;
  entryCount: number;
  compressionRatio: number;
  evictions: number;
  topEntries: Array<{ key: string; accessCount: number; size: number }>;
}

export interface CacheConfig {
  memoryMaxSize: number;
  memoryMaxEntries: number;
  persistentMaxSize: number;
  persistentMaxEntries: number;
  defaultTTL: number;
  cleanupInterval: number;
  compressionThreshold: number;
}

/**
 * Consolidated Cache System - Unified caching solution
 * Combines the best features from AdvancedCache, SmartCache, and UnifiedCache
 * - Memory cache for fast access
 * - Persistent cache for long-term storage
 * - LRU eviction policy
 * - Compression for large entries
 * - Security validation
 * - Performance monitoring
 */
export class ConsolidatedCache {
  private memoryCache = new Map<string, CacheEntry>();
  private persistentCache: IDBDatabase | null = null;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    compressions: 0,
    decompressions: 0,
  };
  private config: CacheConfig = {
    memoryMaxSize: 8 * 1024 * 1024, // 8MB memory cache
    memoryMaxEntries: 300,
    persistentMaxSize: 25 * 1024 * 1024, // 25MB persistent cache
    persistentMaxEntries: 800,
    defaultTTL: 15 * 60 * 1000, // 15 minutes
    cleanupInterval: 60000, // 1 minute
    compressionThreshold: 1024, // 1KB
  };
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.initializePersistentCache();
    this.startCleanupTimer();
  }

  private async initializePersistentCache(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      logger.warn('IndexedDB not available, using memory-only cache');
      return;
    }

    try {
      const request = indexedDB.open('ConsolidatedCache', 1);
      
      request.onerror = () => {
        logger.error('Failed to open IndexedDB:', request.error);
      };

      request.onsuccess = () => {
        this.persistentCache = request.result;
        this.isInitialized = true;
        logger.info('Persistent cache initialized');
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }
      };
    } catch (error) {
      logger.error('Error initializing persistent cache:', error);
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Get data from cache (memory first, then persistent)
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && !this.isExpired(memoryEntry)) {
        this.updateAccess(memoryEntry);
        this.stats.hits++;
        return memoryEntry.data as T;
      }

      // Check persistent cache
      if (this.persistentCache && this.isInitialized) {
        const persistentEntry = await this.getFromPersistent<T>(key);
        if (persistentEntry && !this.isExpired(persistentEntry)) {
          // Promote to memory cache if it's high priority
          if (persistentEntry.priority === 'high') {
            this.setToMemory(key, persistentEntry);
          }
          this.updateAccess(persistentEntry);
          this.stats.hits++;
          return persistentEntry.data as T;
        }
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Error getting cache entry:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set data in cache with intelligent layer selection
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    try {
      const entry = this.createCacheEntry(data, options);
      
      // Security validation
      const validation = securityManager.sanitizeAndValidate(data, 'user');
      if (!validation.isValid) {
        logger.warn('Cache entry failed security validation:', key, validation.errors);
        return;
      }

      this.stats.sets++;

      // Store in memory cache
      this.setToMemory(key, entry);

      // Store in persistent cache if specified or if data is large/important
      if (options.persistent || entry.priority === 'high' || entry.size > this.config.compressionThreshold) {
        this.setToPersistent(key, entry);
      }

      // Trigger cleanup if memory cache is full
      if (this.getMemorySize() > this.config.memoryMaxSize) {
        this.evictLRU('memory');
      }
    } catch (error) {
      logger.error('Error setting cache entry:', error);
    }
  }

  /**
   * Delete entry from all cache layers
   */
  async delete(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      this.stats.deletes++;

      if (this.persistentCache && this.isInitialized) {
        const transaction = this.persistentCache.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        store.delete(key);
      }
    } catch (error) {
      logger.error('Error deleting cache entry:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      
      if (this.persistentCache && this.isInitialized) {
        const transaction = this.persistentCache.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        store.clear();
      }
      
      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Invalidate entries by tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    let invalidated = 0;

    try {
      // Remove from memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags.includes(tag)) {
          this.memoryCache.delete(key);
          invalidated++;
        }
      }

      // Remove from persistent cache
      if (this.persistentCache && this.isInitialized) {
        const transaction = this.persistentCache.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        const index = store.index('tags');
        const request = index.openCursor(IDBKeyRange.only(tag));
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            invalidated++;
            cursor.continue();
          }
        };
      }

      logger.info(`Invalidated ${invalidated} entries for tag: ${tag}`);
    } catch (error) {
      logger.error('Error invalidating by tag:', error);
    }

    return invalidated;
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;

    // Get top entries by access count
    const topEntries = Array.from(this.memoryCache.entries())
      .map(([key, entry]) => ({ key, accessCount: entry.accessCount, size: entry.size }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    return {
      hitRate,
      missRate,
      totalRequests,
      memoryUsage: this.getMemorySize(),
      persistentUsage: this.getPersistentSize(),
      entryCount: this.memoryCache.size,
      compressionRatio: this.calculateCompressionRatio(),
      evictions: this.stats.evictions,
      topEntries,
    };
  }

  private createCacheEntry<T>(data: T, options: CacheOptions): CacheEntry<T> {
    const serialized = JSON.stringify(data);
    const size = new Blob([serialized]).size;
    const shouldCompress = size > this.config.compressionThreshold && (options.compress !== false);
    
    let processedData = data;
    let isCompressed = false;
    
    if (shouldCompress) {
      try {
        const compressedData = compressToUTF16(serialized);
        processedData = JSON.parse(decompressFromUTF16(compressedData)) as T;
        isCompressed = true;
        this.stats.compressions++;
      } catch (error) {
        logger.warn('Compression failed, storing uncompressed:', error);
      }
    }

    return {
      data: processedData,
      timestamp: Date.now(),
      ttl: options.ttl || this.config.defaultTTL,
      tags: options.tags || [],
      priority: options.priority || 'normal',
      compressed: isCompressed,
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
      layer: 'memory',
    };
  }

  private setToMemory<T>(key: string, entry: CacheEntry<T>): void {
    // Check if we need to evict entries
    if (this.memoryCache.size >= this.config.memoryMaxEntries) {
      this.evictLRU('memory');
    }
    
    entry.layer = 'memory';
    this.memoryCache.set(key, entry);
  }

  private setToPersistent<T>(key: string, entry: CacheEntry<T>): void {
    if (!this.persistentCache || !this.isInitialized) return;

    try {
      const transaction = this.persistentCache.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      entry.layer = 'persistent';
      store.put({ key, ...entry });
    } catch (error) {
      logger.error('Error setting persistent cache entry:', error);
    }
  }

  private async getFromPersistent<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.persistentCache || !this.isInitialized) return null;

    try {
      const transaction = this.persistentCache.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            if (result.compressed) {
              try {
                result.data = JSON.parse(decompressFromUTF16(result.data));
                this.stats.decompressions++;
              } catch (error) {
                logger.error('Decompression failed:', error);
                resolve(null);
                return;
              }
            }
            resolve(result);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = () => {
          logger.error('Error getting from persistent cache:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      logger.error('Error accessing persistent cache:', error);
      return null;
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private updateAccess(entry: CacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
  }

  private getMemorySize(): number {
    return Array.from(this.memoryCache.values()).reduce((total, entry) => total + entry.size, 0);
  }

  private getPersistentSize(): number {
    // This is an approximation - actual size would require IndexedDB metadata
    return Array.from(this.memoryCache.values())
      .filter(entry => entry.layer === 'persistent')
      .reduce((total, entry) => total + entry.size, 0);
  }

  private calculateCompressionRatio(): number {
    const compressedEntries = Array.from(this.memoryCache.values()).filter(entry => entry.compressed);
    if (compressedEntries.length === 0) return 0;

    const originalSize = compressedEntries.reduce((total, entry) => total + entry.size, 0);
    const compressedSize = compressedEntries.reduce((total, entry) => {
      const serialized = JSON.stringify(entry.data);
      return total + new Blob([serialized]).size;
    }, 0);

    return originalSize > 0 ? ((originalSize - compressedSize) / originalSize) * 100 : 0;
  }

  private evictLRU(layer: 'memory' | 'persistent'): void {
    if (layer === 'memory') {
      const entries = Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
      
      const toEvict = Math.ceil(this.config.memoryMaxEntries * 0.1); // Evict 10%
      for (let i = 0; i < toEvict && i < entries.length; i++) {
        const entry = entries[i];
        if (entry) {
          this.memoryCache.delete(entry[0]);
          this.stats.evictions++;
        }
      }
    }
  }

  private cleanup(): void {
    try {
      // Clean expired entries from memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (this.isExpired(entry)) {
          this.memoryCache.delete(key);
        }
      }

      // Clean expired entries from persistent cache
      if (this.persistentCache && this.isInitialized) {
        const transaction = this.persistentCache.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        const index = store.index('timestamp');
        const cutoffTime = Date.now() - this.config.defaultTTL;
        const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      }

      logger.debug('Cache cleanup completed');
    } catch (error) {
      logger.error('Error during cache cleanup:', error);
    }
  }

  /**
   * Destroy cache instance and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.memoryCache.clear();
    
    if (this.persistentCache) {
      this.persistentCache.close();
      this.persistentCache = null;
    }
    
    logger.info('Cache destroyed');
  }
}

// Singleton instance for global use
export const consolidatedCache = new ConsolidatedCache();

// Export factory function for custom instances
export const createConsolidatedCache = (config?: Partial<CacheConfig>) => {
  return new ConsolidatedCache(config);
};