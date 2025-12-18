// Unified Cache Interface
interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl?: number;
  hits: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number;
  strategy?: 'lru' | 'fifo' | 'lfu';
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
}

// Unified Cache Manager
class UnifiedCacheManager {
  private cache = new Map<string, CacheItem>();
  private maxSize: number;
  private strategy: 'lru' | 'fifo' | 'lfu';
  private stats = { hits: 0, misses: 0, totalRequests: 0 };

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 100;
    this.strategy = options.strategy || 'lru';
  }

  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    // Check if we need to evict items
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evict();
    }

    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl,
      hits: 0
    };

    this.cache.set(key, item);
  }

  get<T>(key: string): T | null {
    this.stats.totalRequests++;

    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    item.hits++;
    this.stats.hits++;
    return item.data as T;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    // Check TTL
    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, totalRequests: 0 };
  }

  private evict(): void {
    if (this.cache.size === 0) return;

    let keyToDelete: string;

    switch (this.strategy) {
      case 'lru':
        keyToDelete = this.findLRU();
        break;
      case 'lfu':
        keyToDelete = this.findLFU();
        break;
      case 'fifo':
        keyToDelete = this.findFIFO();
        break;
      default:
        keyToDelete = this.findLRU();
    }

    if (keyToDelete) {
      this.cache.delete(keyToDelete);
    }
  }

  private findLRU(): string {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private findLFU(): string {
    let leastUsedKey = '';
    let leastHits = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.hits < leastHits) {
        leastHits = item.hits;
        leastUsedKey = key;
      }
    }

    return leastUsedKey;
  }

  private findFIFO(): string {
    // FIFO uses the oldest timestamp
    return this.findLRU();
  }

  getStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.totalRequests > 0 ? this.stats.hits / this.stats.totalRequests : 0,
      totalRequests: this.stats.totalRequests
    };
  }

  // Maintenance: Clean up expired items
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.ttl && now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  // Get cache keys (useful for debugging)
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Get cache size
  size(): number {
    return this.cache.size;
  }
}

// Cache instances for different use cases
const memoryCache = new UnifiedCacheManager({ maxSize: 200, strategy: 'lru' });
const apiCache = new UnifiedCacheManager({ 
  maxSize: 50, 
  strategy: 'lru', 
  ttl: 5 * 60 * 1000 // 5 minutes 
});
const componentCache = new UnifiedCacheManager({ 
  maxSize: 100, 
  strategy: 'lfu', 
  ttl: 10 * 60 * 1000 // 10 minutes 
});

// API Cache specific functions
export const apiCacheService = {
  get: <T>(key: string) => apiCache.get<T>(key),
  set: <T>(key: string, data: T, ttl?: number) => apiCache.set(key, data, { ttl }),
  has: (key: string) => apiCache.has(key),
  delete: (key: string) => apiCache.delete(key),
  clear: () => apiCache.clear(),
  getStats: () => apiCache.getStats(),
  cleanup: () => apiCache.cleanup()
};

// Component Cache specific functions
export const componentCacheService = {
  get: <T>(key: string) => componentCache.get<T>(key),
  set: <T>(key: string, data: T, ttl?: number) => componentCache.set(key, data, { ttl }),
  has: (key: string) => componentCache.has(key),
  delete: (key: string) => componentCache.delete(key),
  clear: () => componentCache.clear(),
  getStats: () => componentCache.getStats(),
  cleanup: () => componentCache.cleanup()
};

// General Memory Cache
export const memoryCacheService = {
  get: <T>(key: string) => memoryCache.get<T>(key),
  set: <T>(key: string, data: T, options?: CacheOptions) => memoryCache.set(key, data, options),
  has: (key: string) => memoryCache.has(key),
  delete: (key: string) => memoryCache.delete(key),
  clear: () => memoryCache.clear(),
  getStats: () => memoryCache.getStats(),
  cleanup: () => memoryCache.cleanup()
};

// Smart Cache with predictive invalidation
export class SmartCache {
  protected cache = new UnifiedCacheManager({ maxSize: 150, strategy: 'lru' });
  private dependencies = new Map<string, Set<string>>();
  private accessPatterns = new Map<string, number[]>(); // Track access times for prediction

  set<T>(key: string, data: T, dependencies: string[] = [], options?: CacheOptions): void {
    this.cache.set(key, data, options);
    
    // Track dependencies
    this.dependencies.set(key, new Set(dependencies));
    
    // Track access pattern
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, []);
    }
    const patterns = this.accessPatterns.get(key);
    if (patterns) {
      patterns.push(Date.now());
    }
  }

  get<T>(key: string): T | null {
    const result = this.cache.get<T>(key);
    
    if (result) {
      // Track access pattern
      if (!this.accessPatterns.has(key)) {
        this.accessPatterns.set(key, []);
      }
      this.accessPatterns.get(key)!.push(Date.now());
    }
    
    return result;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    
    // Invalidate dependents
    const dependents = Array.from(this.dependencies.entries())
      .filter(([_key, deps]) => deps.has(key))
      .map(([depKey, _unused]) => depKey);
    
    dependents.forEach(depKey => {
      this.cache.delete(depKey);
      this.dependencies.delete(depKey);
      this.accessPatterns.delete(depKey);
    });
  }

  // Predictive preloading based on access patterns
  predictPreload(): string[] {
    const predictions: string[] = [];
    const now = Date.now();
    
    for (const [key, timestamps] of this.accessPatterns.entries()) {
      if (timestamps.length < 2) continue;
      
      // Calculate average interval
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      
      // Predict if this key should be accessed soon
      const lastAccess = timestamps[timestamps.length - 1];
      const timeSinceLastAccess = now - lastAccess;
      
      if (timeSinceLastAccess >= avgInterval * 0.8 && timeSinceLastAccess <= avgInterval * 1.2) {
        predictions.push(key);
      }
    }
    
    return predictions;
  }

  getStats() {
    return {
      ...this.cache.getStats(),
      dependenciesCount: this.dependencies.size,
      trackedPatterns: this.accessPatterns.size,
      predictions: this.predictPreload()
    };
  }

  clear(): void {
    this.cache.clear();
    this.dependencies.clear();
    this.accessPatterns.clear();
  }
}

// Export the smart cache instance
export const smartCacheInstance = new SmartCache();

// Cache utilities
export const CacheUtils = {
  // Generate cache key from arguments
  generateKey(prefix: string, ...args: unknown[]): string {
    const serialized = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(':');
    return `${prefix}:${serialized}`;
  },

  // TTL constants
  TTL: {
    MINUTE: 60 * 1000,
    FIVE_MINUTES: 5 * 60 * 1000,
    FIFTEEN_MINUTES: 15 * 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000
  },

  // Cache size constants
  SIZES: {
    SMALL: 50,
    MEDIUM: 100,
    LARGE: 200,
    EXTRA_LARGE: 500
  }
};

// Auto-cleanup interval
// Auto-cleanup function for smart cache
const cleanupSmartCache = () => {
  // Create a public cleanup method or use internal cleanup
  const cache = (smartCacheInstance as any).cache;
  if (cache && typeof cache.cleanup === 'function') {
    cache.cleanup();
  }
};

setInterval(() => {
  memoryCache.cleanup();
  apiCache.cleanup();
  componentCache.cleanup();
  cleanupSmartCache();
}, 5 * 60 * 1000); // Every 5 minutes

// Export classes and interfaces for external use
export { UnifiedCacheManager, CacheItem, CacheOptions, CacheStats };