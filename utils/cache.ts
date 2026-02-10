/**
 * LRU (Least Recently Used) Cache implementation
 * Provides efficient in-memory caching with TTL support and automatic eviction
 */

import { CACHE_CONFIG } from '../constants/config';

export interface LRUCacheConfig {
  ttl: number;
  maxSize: number;
}

export class LRUCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(
    ttl: number = 5 * 60 * 1000, // 5 minutes default
    maxSize: number = CACHE_CONFIG.MAX_LRU_CACHE_SIZE
  ) {
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

    this.cache.delete(key);
    this.cache.set(key, item);
    return item.data;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { data: value, timestamp: Date.now() });
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
      oldestEntry: oldestTimestamp ? Date.now() - oldestTimestamp : null,
    };
  }
}
