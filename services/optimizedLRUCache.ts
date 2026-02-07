<<<<<<< HEAD
import { handleErrorCompat as handleError } from '../utils/errorManager';
=======
import { handleError } from '../utils/errorHandler';
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)

interface CacheEntry<T> {
  value: T;
  expires: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
}

/**
 * Optimized LRU Cache with enhanced memory management and adaptive TTL
 */
export class OptimizedLRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private hits = 0;
  private misses = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxSize: number = 200, defaultTtl: number = 900000) { // 15 min default TTL
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    
    if (!item) {
      this.misses++;
      return undefined;
    }

    // Check expiration
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Update access statistics
    item.accessCount++;
    item.lastAccessed = Date.now();
    this.hits++;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  set(key: string, value: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || this.defaultTtl;
    const expires = Date.now() + ttl;

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Ensure size limit
    while (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }

    // Add new entry
    this.cache.set(key, {
      value,
      expires,
      accessCount: 1,
      lastAccessed: Date.now()
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    // Check expiration
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Evict least used entries based on access patterns
   */
  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null;
    let leastUsedScore = Infinity;

    for (const [key, item] of this.cache.entries()) {
      // Calculate score based on access count and recency
      const timeSinceAccess = Date.now() - item.lastAccessed;
      const score = item.accessCount / (timeSinceAccess + 1);

      if (score < leastUsedScore) {
        leastUsedScore = score;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
    }
  }

  /**
   * Estimate memory usage (rough approximation)
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      // Rough estimation: key size + value size + metadata
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += JSON.stringify(entry.value).length * 2;
      totalSize += 64; // Metadata overhead
    }
    
    return totalSize;
  }

  /**
   * Clear entries by tags
   */
  clearByTags(tags: string[]): number {
    let cleared = 0;
    for (const [key] of this.cache.entries()) {
      // Simple tag matching - in a real implementation, you'd store tags with entries
      if (tags.some(tag => key.includes(tag))) {
        this.cache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Set up automatic cleanup interval
   */
  startAutoCleanup(intervalMs: number = 300000): void { // 5 minutes
    // Clear existing timer if any
    this.stopAutoCleanup();
    
    this.cleanupTimer = setInterval(() => {
      try {
        const cleaned = this.cleanup();
        if (cleaned > 0 && import.meta.env.DEV) {
          console.log(`Cache cleanup: removed ${cleaned} expired entries`);
        }
      } catch (error) {
        handleError(error as Error, 'cacheAutoCleanup', 'OptimizedLRUCache');
      }
    }, intervalMs);
  }

  /**
   * Stop automatic cleanup interval
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Destroy the cache and cleanup all resources
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clear();
  }
}

// Global cache instances with different configurations
export const robotCache = new OptimizedLRUCache<any>(200, 900000); // 15 minutes
export const analyticsCache = new OptimizedLRUCache<any>(100, 600000); // 10 minutes
export const marketDataCache = new OptimizedLRUCache<any>(50, 300000); // 5 minutes

// Start auto cleanup for all caches
if (typeof window !== 'undefined') {
  robotCache.startAutoCleanup();
  analyticsCache.startAutoCleanup();
  marketDataCache.startAutoCleanup();
}