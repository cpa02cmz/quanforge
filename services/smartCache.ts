import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { CACHE_CONFIG, TIME_CONSTANTS } from '../constants/config';

interface SmartCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  layer: 'memory' | 'persistent';
  compressed: boolean;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

interface SmartCacheConfig {
  memoryMaxSize: number;
  memoryMaxEntries: number;
  persistentMaxSize: number;
  persistentMaxEntries: number;
  defaultTTL: number;
  cleanupInterval: number;
  compressionThreshold: number;
}

interface SmartCacheStats {
  memoryHits: number;
  persistentHits: number;
  misses: number;
  memorySize: number;
  persistentSize: number;
  hitRate: number;
}

/**
 * Smart multi-layer cache with memory and persistent storage
 * Optimized for performance with automatic fallback and compression
 */
export class SmartCache<T = any> {
  private memoryCache = new Map<string, SmartCacheEntry<T>>();
  private persistentCache: IDBDatabase | null = null;
  private stats = {
    memoryHits: 0,
    persistentHits: 0,
    misses: 0,
  };
  private config: SmartCacheConfig = {
    memoryMaxSize: 5 * 1024 * 1024, // 5MB memory cache
    memoryMaxEntries: CACHE_CONFIG.MAX_LRU_CACHE_SIZE,
    persistentMaxSize: 20 * 1024 * 1024, // 20MB persistent cache
    persistentMaxEntries: CACHE_CONFIG.MAX_CACHE_ENTRIES,
    defaultTTL: TIME_CONSTANTS.MINUTE * 15, // 15 minutes
    cleanupInterval: TIME_CONSTANTS.MINUTE, // 1 minute
    compressionThreshold: CACHE_CONFIG.COMPRESSION_THRESHOLD, // 1KB
  };
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private dbName = 'smartCache';
  private storeName = 'cache';

  constructor(config?: Partial<SmartCacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.initPersistentCache();
    this.startCleanup();
  }

  private async initPersistentCache(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
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
        }
      };
    });
  }

  private async getFromIndexedDB(key: string): Promise<SmartCacheEntry<T> | null> {
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

        // Check if expired
        if (Date.now() - result.timestamp > result.ttl) {
          this.deleteFromIndexedDB(key);
          resolve(null);
          return;
        }

        resolve(result.value as SmartCacheEntry<T>);
      };
    });
  }

  private async setToIndexedDB(key: string, entry: SmartCacheEntry<T>): Promise<void> {
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
    
    // Sort by last accessed (LRU)
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    let currentSize = this.getCurrentMemorySize();
    const targetSize = this.config.memoryMaxSize * 0.8; // Evict to 80%
    
    for (const [key, entry] of entries) {
      if (currentSize <= targetSize && this.memoryCache.size <= this.config.memoryMaxEntries) {
        break;
      }
      
      // Move to persistent cache if still valid
      if (Date.now() - entry.timestamp <= entry.ttl) {
        this.setToIndexedDB(key, { ...entry, layer: 'persistent' });
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
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
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
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  async get(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      if (Date.now() - memoryEntry.timestamp > memoryEntry.ttl) {
        this.memoryCache.delete(key);
      } else {
        memoryEntry.accessCount++;
        memoryEntry.lastAccessed = Date.now();
        this.stats.memoryHits++;
        
        // Move to end (LRU)
        this.memoryCache.delete(key);
        this.memoryCache.set(key, memoryEntry);
        
        return memoryEntry.compressed ? this.decompressData(memoryEntry.data) : memoryEntry.data;
      }
    }

    // Check persistent cache
    const persistentEntry = await this.getFromIndexedDB(key);
    if (persistentEntry) {
      // Promote to memory cache if space allows
      if (this.getCurrentMemorySize() < this.config.memoryMaxSize && 
          this.memoryCache.size < this.config.memoryMaxEntries) {
        this.memoryCache.set(key, { ...persistentEntry, layer: 'memory' });
      }
      
      this.stats.persistentHits++;
      return persistentEntry.compressed ? this.decompressData(persistentEntry.data) : persistentEntry.data;
    }

    this.stats.misses++;
    return null;
  }

  async set(key: string, data: T, options?: {
    ttl?: number;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<void> {
    const ttl = options?.ttl || this.config.defaultTTL;
    const shouldCompress = this.shouldCompress(data);
    const processedData = shouldCompress ? this.compressData(data) : data;
    const size = this.estimateSize(data);

    const entry: SmartCacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl,
      layer: 'memory',
      compressed: shouldCompress,
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
    };

    // Store in memory cache
    this.memoryCache.set(key, entry);

    // Evict if necessary
    if (this.getCurrentMemorySize() > this.config.memoryMaxSize || 
        this.memoryCache.size > this.config.memoryMaxEntries) {
      this.evictMemoryCache();
    }
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.deleteFromIndexedDB(key);
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.persistentCache) {
      const transaction = this.persistentCache.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      store.clear();
    }
  }

  getStats(): SmartCacheStats {
    const totalHits = this.stats.memoryHits + this.stats.persistentHits;
    const totalRequests = totalHits + this.stats.misses;
    
    return {
      memoryHits: this.stats.memoryHits,
      persistentHits: this.stats.persistentHits,
      misses: this.stats.misses,
      memorySize: this.getCurrentMemorySize(),
      persistentSize: 0, // Would need separate tracking for IndexedDB
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
    };
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.persistentCache) {
      this.persistentCache.close();
      this.persistentCache = null;
    }
    
    this.memoryCache.clear();
  }
}

// Global smart cache instance
export const smartCache = new SmartCache();