// Unified cache interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheOptions {
  maxSize?: number;
  defaultTTL?: number;
  enableMetrics?: boolean;
  enableCompression?: boolean;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  hitRate: number;
  memoryUsage: number;
}

interface CacheStrategy {
  name: string;
  shouldCache: (key: string, data: any) => boolean;
  getTTL: (key: string, data: any) => number;
  onEvict?: (key: string, data: any) => void;
}

// Unified Cache Manager
export class UnifiedCacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private defaultTTL: number;
  private metrics: CacheMetrics;
  private enableMetrics: boolean;
  private strategies = new Map<string, CacheStrategy>();
  private compressionEnabled: boolean;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
    this.enableMetrics = options.enableMetrics || false;
    this.compressionEnabled = options.enableCompression || false;
    
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      memoryUsage: 0
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  // Register a caching strategy
  registerStrategy(name: string, strategy: CacheStrategy): void {
    this.strategies.set(name, strategy);
  }

  // Get data from cache
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      if (this.enableMetrics) this.metrics.misses++;
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      if (this.enableMetrics) this.metrics.misses++;
      return null;
    }

    // Update access metrics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    if (this.enableMetrics) {
      this.metrics.hits++;
      this.updateHitRate();
    }

    return entry.data;
  }

  // Set data in cache
  set<T>(key: string, data: T, ttl?: number, strategyName?: string): void {
    // Check if strategy allows caching
    if (strategyName) {
      const strategy = this.strategies.get(strategyName);
      if (strategy && !strategy.shouldCache(key, data)) {
        return;
      }
    }

    // Determine TTL
    let finalTTL = ttl || this.defaultTTL;
    if (strategyName) {
      const strategy = this.strategies.get(strategyName);
      if (strategy) {
        finalTTL = strategy.getTTL(key, data);
      }
    }

    // Check if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data: this.compressionEnabled ? this.compress(data) : data,
      timestamp: Date.now(),
      ttl: finalTTL,
      accessCount: 1,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    
    if (this.enableMetrics) {
      this.metrics.sets++;
      this.updateMemoryUsage();
    }
  }

  // Delete data from cache
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted && this.enableMetrics) {
      this.metrics.deletes++;
      this.updateMemoryUsage();
    }
    return deleted;
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    if (this.enableMetrics) {
      this.metrics.deletes += this.cache.size;
      this.updateMemoryUsage();
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

  // Get cache metrics
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  // Get all keys
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Evict least recently used items
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      const evictedEntry = this.cache.get(lruKey);
      this.cache.delete(lruKey);
      
      if (this.enableMetrics) {
        this.metrics.evictions++;
        this.updateMemoryUsage();
      }

      // Call strategy onEvict callback
      for (const strategy of this.strategies.values()) {
        if (strategy.onEvict && evictedEntry) {
          strategy.onEvict(lruKey, evictedEntry.data);
        }
      }
    }
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
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0 && this.enableMetrics) {
      this.metrics.evictions += keysToDelete.length;
      this.updateMemoryUsage();
    }
  }

  // Update hit rate
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  // Update memory usage (rough estimate)
  private updateMemoryUsage(): void {
    let totalSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2; // String size
      totalSize += JSON.stringify(entry.data).length * 2;
      totalSize += 64; // Estimated overhead
    }
    this.metrics.memoryUsage = totalSize;
  }

  // Simple compression (placeholder)
  private compress(data: any): any {
    // In a real implementation, you might use a compression library
    return data;
  }

  // Destroy cache manager
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
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

// Export convenience functions
export const cacheGet = <T>(key: string): T | null => globalCache.get<T>(key);
export const cacheSet = <T>(key: string, data: T, ttl?: number): void => globalCache.set(key, data, ttl);
export const cacheDelete = (key: string): boolean => globalCache.delete(key);
export const cacheClear = (): void => globalCache.clear();
export const cacheHas = (key: string): boolean => globalCache.has(key);
export const cacheMetrics = (): CacheMetrics => globalCache.getMetrics();