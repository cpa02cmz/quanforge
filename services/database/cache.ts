import { CACHE_CONFIG } from './client';
import { TIME_CONSTANTS } from '../../constants/config';

// LRU Cache implementation for better performance and memory management
export class LRUCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(ttl: number = CACHE_CONFIG.ttl, maxSize: number = CACHE_CONFIG.maxSize) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

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

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    return this.cache.size;
  }

  // Cleanup expired entries
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

  // Get cache statistics
  getStats(): { size: number; maxSize: number; ttl: number; oldestEntry: number | null } {
    let oldestTimestamp: number | null = null;
    
    for (const item of this.cache.values()) {
      if (!oldestTimestamp || item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
      }
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      oldestEntry: oldestTimestamp ? Date.now() - oldestTimestamp : null
    };
  }
}

// Global cache instances
export const robotCache = new LRUCache<any>(CACHE_CONFIG.ttl, CACHE_CONFIG.maxSize);
export const queryCache = new LRUCache<any>(CACHE_CONFIG.ttl / 2, CACHE_CONFIG.maxSize * 2); // Shorter TTL, larger size for queries
export const sessionCache = new LRUCache<any>(CACHE_CONFIG.ttl * 2, 50); // Longer TTL for sessions

// Cache warming utilities
export const warmCache = async (keys: string[], dataLoader: (key: string) => Promise<any>): Promise<void> => {
  const promises = keys.map(async (key) => {
    if (!robotCache.has(key)) {
      try {
        const data = await dataLoader(key);
        robotCache.set(key, data);
      } catch (error) {
        console.warn(`Failed to warm cache for key ${key}:`, error);
      }
    }
  });
  
  await Promise.allSettled(promises);
};

// Periodic cache cleanup
export const startCacheCleanup = (intervalMs: number = TIME_CONSTANTS.MINUTE): ReturnType<typeof setInterval> => {
  return setInterval(() => {
    const cleanedRobots = robotCache.cleanup();
    const cleanedQueries = queryCache.cleanup();
    const cleanedSessions = sessionCache.cleanup();
    
    if (cleanedRobots > 0 || cleanedQueries > 0 || cleanedSessions > 0) {
      console.log(`Cache cleanup: ${cleanedRobots} robots, ${cleanedQueries} queries, ${cleanedSessions} sessions`);
    }
  }, intervalMs);
};