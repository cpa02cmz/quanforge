/**
 * LRU Cache implementation for better performance and memory management
 * Extracted from monolithic supabase.ts for better modularity
 */

import { CACHE_CONFIG } from './databaseConfig';

/**
 * Generic LRU (Least Recently Used) Cache implementation
 * Automatically evicts oldest items when max size is reached
 * Includes TTL (Time To Live) support for expired item cleanup
 */
export class LRUCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(ttl: number, maxSize: number) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  /**
   * Get item from cache, returns null if not found or expired
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.data;
  }

  /**
   * Set item in cache, evicts oldest if at max size
   */
  set(key: string, data: T): void {
    // Evict oldest if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Create application-wide cache instance
export const applicationCache = new LRUCache<any>(CACHE_CONFIG.ttl, CACHE_CONFIG.maxSize);