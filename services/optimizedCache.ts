import { createScopedLogger } from '../utils/logger';
import { securityManager } from './securityManager';
import { CACHE_SIZING_CONFIG, TIME_CONSTANTS } from '../constants/config';

const logger = createScopedLogger('OptimizedCache');

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
  compress?: boolean;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: string[];
  priority: 'low' | 'normal' | 'high';
  compressed: boolean;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  memoryUsage: number;
  entryCount: number;
  compressionRatio: number;
}

/**
 * Optimized Cache Service that consolidates all caching strategies
 * - Memory-based LRU cache
 * - Security validation
 * - Compression for large entries
 * - Tag-based invalidation
 * - Performance monitoring with sampling
 */
export class OptimizedCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder = new Map<string, number>();
  private maxSize: number;
  private defaultTTL: number;
  private compressionThreshold = 1024; // 1KB
  private cleanupInterval: ReturnType<typeof setInterval>;
  private accessCounter = 0;
  private metrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    compressions: 0,
    decompressions: 0
  };
  private samplingRate = 0.1; // Sample 10% of operations for metrics

  constructor(name: string, options: { maxSize?: number; defaultTTL?: number } = {}) {
    this.maxSize = options.maxSize || CACHE_SIZING_CONFIG.DEFAULT_CACHE.MAX_SIZE;
    this.defaultTTL = options.defaultTTL || CACHE_SIZING_CONFIG.DEFAULT_CACHE.DEFAULT_TTL;

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, TIME_CONSTANTS.CACHE_DEFAULT_TTL);
  }

  /**
   * Get data from cache with security validation
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.recordMetric('misses');
        return null;
      }

      // Check if entry is expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        this.recordMetric('misses');
        return null;
      }

      // Update access tracking
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.accessOrder.set(key, ++this.accessCounter);

      // Validate cached data for security
      const validation = securityManager.sanitizeAndValidateData(entry.data, 'robot');
      if (!validation.isValid) {
        logger.warn(`Invalid cached data detected for key: ${key}`, validation.errors);
        this.delete(key);
        this.recordMetric('misses');
        return null;
      }

      // Decompress if needed
      let data = entry.data;
      if (entry.compressed) {
        data = await this.decompress(data);
        this.recordMetric('decompressions');
      }

      this.recordMetric('hits');
      return data as T;
    } catch (error) {
      logger.error('Error getting from cache:', { key, error });
      this.recordMetric('misses');
      return null;
    }
  }

  /**
   * Set data in cache with optional compression
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.defaultTTL;
      const tags = options.tags || [];
      const priority = options.priority || 'normal';
      
      // Validate data before caching
      const validation = securityManager.sanitizeAndValidateData(data, 'robot');
      if (!validation.isValid) {
        logger.warn(`Attempted to cache invalid data for key: ${key}`, validation.errors);
        return;
      }

      let processedData = data;
      let compressed = false;
      const dataSize = this.estimateSize(data);

      // Compress large entries
      if (options.compress !== false && dataSize > this.compressionThreshold) {
        processedData = await this.compress(data);
        compressed = true;
        this.recordMetric('compressions');
      }

      const entry: CacheEntry<T> = {
        data: processedData,
        timestamp: Date.now(),
        ttl,
        tags,
        priority,
        compressed,
        accessCount: 0,
        lastAccessed: Date.now()
      };

      // Check if we need to evict entries
      if (this.cache.size >= 1000 || this.getCurrentMemoryUsage() > this.maxSize) {
        this.evictLeastRecentlyUsed();
      }

      this.cache.set(key, entry);
      this.accessOrder.set(key, ++this.accessCounter);
      this.recordMetric('sets');
    } catch (error) {
      logger.error('Error setting cache:', { key, error });
    }
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.accessOrder.delete(key);
    if (deleted) {
      this.recordMetric('deletes');
    }
    return deleted;
  }

  /**
   * Invalidate entries by tags
   */
  invalidateByTag(tag: string): number {
    let invalidated = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        invalidated++;
      }
    }
    this.metrics.deletes += invalidated;
    return invalidated;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (this.metrics.misses / totalRequests) * 100 : 0;

    return {
      hitRate,
      missRate,
      totalRequests,
      memoryUsage: this.getCurrentMemoryUsage(),
      entryCount: this.cache.size,
      compressionRatio: this.calculateCompressionRatio()
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastRecentlyUsed(): void {
    // Sort by access count and last accessed time
    const entries = Array.from(this.accessOrder.entries())
      .sort(([, a], [, b]) => a - b)
      .slice(0, Math.floor(this.cache.size * 0.2)); // Evict 20% of entries

    for (const [key] of entries) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.metrics.evictions++;
    }

    if (entries.length > 0) {
      logger.debug(`Evicted ${entries.length} LRU cache entries`);
    }
  }

  /**
   * Estimate memory usage of data
   */
  private estimateSize(data: unknown): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default estimate
    }
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += this.estimateSize(entry);
    }
    return totalSize;
  }

  /**
   * Calculate compression ratio
   */
  private calculateCompressionRatio(): number {
    const compressedEntries = Array.from(this.cache.values()).filter(entry => entry.compressed);
    if (compressedEntries.length === 0) return 1;

    // This is a simplified calculation
    return this.metrics.compressions > 0 ? 0.7 : 1; // Assume 30% compression
  }

  /**
   * Simple compression using LZ-string if available
   */
  private async compress<T>(data: T): Promise<T> {
    try {
      // Use dynamic import for better tree-shaking
      const lzModule = await import('lz-string');
      return lzModule.default.compress(JSON.stringify(data)) as T;
    } catch {
      return data; // Fallback to uncompressed
    }
  }

  /**
   * Simple decompression
   */
  private async decompress<T>(data: T): Promise<T> {
    try {
      const lzModule = await import('lz-string');
      return JSON.parse(lzModule.default.decompress(data as string)) as T;
    } catch {
      return data; // Fallback to original data
    }
  }

  /**
   * Record metrics with sampling
   */
  private recordMetric(type: keyof typeof this.metrics): void {
    if (Math.random() <= this.samplingRate) {
      this.metrics[type]++;
    }
  }

  /**
   * Cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Cache factory for creating named instances
class CacheFactory {
  private static instances = new Map<string, OptimizedCache>();

  static getInstance(name: string, options?: { maxSize?: number; defaultTTL?: number }): OptimizedCache {
    if (!this.instances.has(name)) {
      this.instances.set(name, new OptimizedCache(name, options));
    }
    return this.instances.get(name)!;
  }

  static destroyInstance(name: string): void {
    const instance = this.instances.get(name);
    if (instance) {
      instance.destroy();
      this.instances.delete(name);
    }
  }

  static destroyAll(): void {
    for (const [_name, instance] of this.instances) {
      instance.destroy();
    }
    this.instances.clear();
  }
}

// Export singleton instances for common use cases
export const robotCache = CacheFactory.getInstance('robots', { 
  maxSize: CACHE_SIZING_CONFIG.ROBOT_CACHE.MAX_SIZE, 
  defaultTTL: CACHE_SIZING_CONFIG.ROBOT_CACHE.DEFAULT_TTL 
});
export const marketDataCache = CacheFactory.getInstance('marketData', { 
  maxSize: CACHE_SIZING_CONFIG.MARKET_DATA_CACHE.MAX_SIZE, 
  defaultTTL: CACHE_SIZING_CONFIG.MARKET_DATA_CACHE.DEFAULT_TTL 
});
export const analysisCache = CacheFactory.getInstance('analysis', { 
  maxSize: CACHE_SIZING_CONFIG.ANALYSIS_CACHE.MAX_SIZE, 
  defaultTTL: CACHE_SIZING_CONFIG.ANALYSIS_CACHE.DEFAULT_TTL 
});

export { CacheFactory };
export default OptimizedCache;