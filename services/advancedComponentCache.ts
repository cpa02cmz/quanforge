/**
 * Advanced Component Cache Service
 * Provides sophisticated caching strategies for React components and data
 */

import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('ComponentCache');

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  size?: number; // Size in bytes (optional)
}

interface ComponentCacheConfig {
  maxEntries?: number;
  defaultTTL?: number; // Default time to live in milliseconds
  maxSize?: number; // Maximum cache size in bytes
  enableCompression?: boolean;
  enableEncryption?: boolean;
}

class AdvancedComponentCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: Required<ComponentCacheConfig>;
  private size: number = 0; // Current cache size in bytes

  constructor(config: ComponentCacheConfig = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 1000,
      defaultTTL: config.defaultTTL ?? 300000, // 5 minutes
      maxSize: config.maxSize ?? 50 * 1024 * 1024, // 50 MB
      enableCompression: config.enableCompression ?? false,
      enableEncryption: config.enableEncryption ?? false,
    };
  }

  /**
   * Gets a value from the cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Sets a value in the cache
   */
  set<T>(key: string, data: T, ttl?: number): boolean {
    const entryTTL = ttl ?? this.config.defaultTTL;
    const timestamp = Date.now();
    
    // Calculate size if needed
    let size = 0;
    if (this.config.maxSize > 0) {
      try {
        size = new Blob([JSON.stringify(data)]).size;
      } catch {
        // Fallback size calculation
        size = JSON.stringify(data).length;
      }
    }

    // Check if adding this entry would exceed size limits
    if (this.config.maxSize > 0 && (this.size + size > this.config.maxSize)) {
      // Evict oldest entries until we have enough space
      this.evictBySize(size);
    }

    // Check if we need to evict entries by count
    if (this.config.maxEntries > 0 && this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp,
      ttl: entryTTL,
      size: size
    };

    this.cache.set(key, entry);
    this.size += size;

    return true;
  }

  /**
   * Deletes a value from the cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry && typeof entry.size === 'number') {
      this.size -= entry.size;
    }
    return this.cache.delete(key);
  }

  /**
   * Clears the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.size = 0;
  }

  /**
   * Checks if a key exists in the cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Gets cache statistics
   */
  getStats(): { size: number; entries: number; maxSize: number } {
    return {
      size: this.size,
      entries: this.cache.size,
      maxSize: this.config.maxSize
    };
  }

  /**
   * Evicts the oldest entries to make space
   */
  private evictOldest(): void {
    if (this.cache.size === 0) return;

    // Find the oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Number.MAX_SAFE_INTEGER;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry && typeof entry.size === 'number') {
        this.size -= entry.size;
      }
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Evicts entries by size to make space for a new entry
   */
  private evictBySize(requiredSize: number): void {
    if (this.config.maxSize <= 0) return;

    // Sort entries by timestamp (oldest first) and remove until we have enough space
    const sortedEntries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (const [key, entry] of sortedEntries) {
      if (this.size - (entry.size ?? 0) + requiredSize <= this.config.maxSize) {
        break;
      }
      
      this.cache.delete(key);
      this.size -= entry.size ?? 0;
    }
  }

  /**
   * Prunes expired entries
   */
  prune(): number {
    let prunedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.delete(key);
        prunedCount++;
      }
    }

    return prunedCount;
  }

  /**
   * Gets all cache keys
   */
  keys(): string[] {
    // Prune expired entries first
    this.prune();
    return Array.from(this.cache.keys());
  }

  /**
   * Preheats the cache with common keys
   */
  async preheat(keys: Array<{ key: string; loader: () => Promise<unknown> }>): Promise<void> {
    const promises = keys.map(async ({ key, loader }) => {
      if (!this.has(key)) {
        try {
          const data = await loader();
          this.set(key, data);
        } catch (error) {
          logger.warn(`Failed to preheat cache for key ${key}:`, error);
        }
      }
    });

    await Promise.all(promises);
  }

  /**
   * Gets the cache entry without checking expiration
   */
  getRaw(key: string): CacheEntry<unknown> | undefined {
    return this.cache.get(key);
  }

  /**
   * Updates cache configuration
   */
  updateConfig(newConfig: Partial<ComponentCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets the current configuration
   */
  getConfig(): Required<ComponentCacheConfig> {
    return { ...this.config };
  }
}

// Create singleton instances for different use cases
export const componentCache = new AdvancedComponentCache({
  maxEntries: 500,
  defaultTTL: 300000, // 5 minutes
  maxSize: 25 * 1024 * 1024 // 25 MB
});

export const dataCache = new AdvancedComponentCache({
  maxEntries: 1000,
  defaultTTL: 600000, // 10 minutes
  maxSize: 50 * 1024 * 1024 // 50 MB
});

export const sessionCache = new AdvancedComponentCache({
  maxEntries: 200,
  defaultTTL: 1800000, // 30 minutes
  maxSize: 10 * 1024 * 1024 // 10 MB
});

// Export the main class for custom instances
export { AdvancedComponentCache };