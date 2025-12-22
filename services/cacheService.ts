/**
 * Cache Service Module
 * Extracted from services/supabase.ts for better modularity
 * Provides LRU cache functionality and cache utilities
 */

import { CACHE_CONFIG } from './config/constants';

/**
 * LRU Cache implementation for better performance and memory management
 * Generic type T represents the type of cached data
 */
export class LRUCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(ttl: number = CACHE_CONFIG.ttl, maxSize: number = CACHE_CONFIG.maxSize) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  /**
   * Get value from cache, returns null if expired or not found
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if item has expired
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
   * Set value in cache with current timestamp
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
   * Delete specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
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
   * Get current cache size (number of entries)
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

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

// Default cache instance with default configuration
export const defaultCache = new LRUCache<any>(CACHE_CONFIG.ttl, CACHE_CONFIG.maxSize);

/**
 * Cache key generators for common use cases
 */
export const CacheKeys = {
  // Robot cache keys
  ROBOTS_LIST: 'robots_list',
  ROBOTS_PAGINATED: (page: number, limit: number, searchTerm?: string, filterType?: string) => 
    `robots_paginated_${page}_${limit}_${(searchTerm || '').toLowerCase()}_${(filterType || 'All')}`,
  ROBOTS_BATCH: (ids: string[]) => `robots_batch_${ids.sort().join('_')}`,
  ROBOT_SINGLE: (id: string) => `robot_${id}`,
  
  // User cache keys
  USER_ROBOTS: (userId: string) => `user_robots_${userId}`,
  USER_SESSION: (userId: string) => `user_session_${userId}`,
  
  // Analytics cache keys
  ANALYTICS_DASHBOARD: (timeframe: string) => `analytics_dashboard_${timeframe}`,
  ANALYTICS_PERFORMANCE: (metric: string, period: string) => `analytics_performance_${metric}_${period}`,
  
  // Settings cache keys
  SETTINGS_DB: 'settings_db',
  SETTINGS_AI: 'settings_ai',
  SETTINGS_AUTH: 'settings_auth',
} as const;

/**
 * Cache utilities
 */
export const CacheUtils = {
  /**
   * Create a unique cache key for any set of parameters
   */
  createKey: (prefix: string, ...params: (string | number | boolean)[]): string => {
    const serializedParams = params.map(p => String(p)).join('_');
    return `${prefix}_${serializedParams}`;
  },

  /**
   * Invalidate multiple cache keys matching a pattern
   */
  invalidatePattern: (cache: LRUCache<any>, pattern: string): number => {
    const keys = cache.keys();
    let invalidated = 0;
    
    for (const key of keys) {
      if (key.includes(pattern)) {
        cache.delete(key);
        invalidated++;
      }
    }
    
    return invalidated;
  },

  /**
   * Get or set pattern - returns cached value or executes function and caches result
   */
  getOrSet: async <T>(
    cache: LRUCache<T>, 
    key: string, 
    factory: () => Promise<T>
  ): Promise<T> => {
    const cached = cache.get(key);
    if (cached !== null) {
      return cached;
    }

    const result = await factory();
    cache.set(key, result);
    return result;
  }
};

export default LRUCache;