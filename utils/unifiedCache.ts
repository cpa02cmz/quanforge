// Unified Cache Implementation for QuantForge AI
// Consolidates all cache implementations into a single, optimized module

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  enableMetrics?: boolean; // Enable performance metrics
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

// Unified LRU Cache with TTL support
export class UnifiedLRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  private metrics = { hits: 0, misses: 0 };

  constructor(private options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl || 15 * 60 * 1000, // 15 minutes default
      maxSize: options.maxSize || 200,
      enableMetrics: options.enableMetrics || false,
      ...options
    };
  }

  set(key: string, value: T, customTtl?: number): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.options.maxSize! && !this.cache.has(key)) {
      this.evictOldest();
    }

    const ttl = customTtl || this.options.ttl!;
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
      hits: 0
    });

    this.accessOrder.set(key, ++this.accessCounter);
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      if (this.options.enableMetrics) this.metrics.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      if (this.options.enableMetrics) this.metrics.misses++;
      return undefined;
    }

    // Update access order and metrics
    this.accessOrder.set(key, ++this.accessCounter);
    entry.hits++;
    if (this.options.enableMetrics) this.metrics.hits++;

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
    this.metrics = { hits: 0, misses: 0 };
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestAccess = Infinity;

    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  // Cleanup expired entries
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  // Get cache metrics
  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.metrics.hits / total : 0
    };
  }

  // Get cache size
  get size(): number {
    return this.cache.size;
  }

  // Get all keys (for debugging)
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Specialized caches for different use cases
export class ResponseCache<T> extends UnifiedLRUCache<T> {
  constructor() {
    super({ ttl: 5 * 60 * 1000, maxSize: 100, enableMetrics: true }); // 5 minutes
  }
}

export class StaticCache<T> extends UnifiedLRUCache<T> {
  constructor() {
    super({ ttl: 60 * 60 * 1000, maxSize: 50, enableMetrics: false }); // 1 hour
  }
}

export class SessionCache<T> extends UnifiedLRUCache<T> {
  constructor() {
    super({ ttl: 30 * 60 * 1000, maxSize: 20, enableMetrics: true }); // 30 minutes
  }
}

// Cache factory for easy instantiation
export class CacheFactory {
  private static instances = new Map<string, UnifiedLRUCache<any>>();

  static getInstance<T>(
    name: string, 
    options: CacheOptions = {}
  ): UnifiedLRUCache<T> {
    if (!this.instances.has(name)) {
      this.instances.set(name, new UnifiedLRUCache<T>(options));
    }
    return this.instances.get(name) as UnifiedLRUCache<T>;
  }

  static getResponseCache<T>(): ResponseCache<T> {
    return this.getInstance('response', { ttl: 5 * 60 * 1000, maxSize: 100 }) as ResponseCache<T>;
  }

  static getStaticCache<T>(): StaticCache<T> {
    return this.getInstance('static', { ttl: 60 * 60 * 1000, maxSize: 50 }) as StaticCache<T>;
  }

  static getSessionCache<T>(): SessionCache<T> {
    return this.getInstance('session', { ttl: 30 * 60 * 1000, maxSize: 20 }) as SessionCache<T>;
  }

  static clearAll(): void {
    this.instances.forEach(cache => cache.clear());
    this.instances.clear();
  }

  static getMetrics(): Record<string, CacheMetrics> {
    const metrics: Record<string, CacheMetrics> = {};
    this.instances.forEach((cache, name) => {
      metrics[name] = cache.getMetrics();
    });
    return metrics;
  }
}

// Global cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

export function startCacheCleanup(intervalMs: number = 60000): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const instances = (CacheFactory as any).instances;
    if (instances) {
      instances.forEach((cache: UnifiedLRUCache<any>) => {
        const cleaned = cache.cleanup();
        if (cleaned > 0) {
          console.log(`Cache cleanup: removed ${cleaned} expired entries`);
        }
      });
    }
  }, intervalMs);
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Auto-start cleanup
if (typeof window !== 'undefined') {
  startCacheCleanup();
}

// Export default cache for backward compatibility
export default UnifiedLRUCache;