/**
 * Enhanced Cache Service
 * 
 * Provides a generic cache with TTL (Time To Live) and size management.
 * Automatically evicts oldest entries when max size is reached.
 * 
 * @module services/cache/EnhancedCache
 */

import { AI_CONFIG } from "../../constants/config";
import { TIMEOUTS } from "../../constants";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Enhanced cache with TTL and size management
 * 
 * Features:
 * - Automatic expiration of stale entries
 * - LRU-style eviction when max size reached
 * - Type-safe generic implementation
 * 
 * @example
 * ```typescript
 * const cache = new EnhancedCache<ResponseData>(100);
 * cache.set('key', data, 60000); // Cache for 60 seconds
 * const data = cache.get('key');
 * ```
 */
export class EnhancedCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  
  constructor(maxSize: number = AI_CONFIG.CACHE.MAX_CACHE_SIZE) {
    this.maxSize = maxSize;
  }
  
  /**
   * Retrieve an item from the cache
   * Returns null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Store an item in the cache
   * Automatically evicts oldest entry if max size reached
   */
  set(key: string, data: T, ttl: number = TIMEOUTS.CACHE_TTL): void {
    // Remove oldest entries if we're at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }
  
  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  /**
   * Get the current number of entries
   */
  size(): number {
    return this.cache.size;
  }
  
  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

export default EnhancedCache;
