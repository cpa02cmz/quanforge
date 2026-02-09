/**
 * Unified Cache Architecture
 * Consolidates 12+ cache implementations into 3 specialized variants
 * Provides consistent interfaces, configuration, and optimization
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('cache');

// Base interfaces and types
export interface BaseCacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  tags: string[];
  compressed?: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface CacheConfig {
  maxSize?: number; // Maximum number of entries
  maxMemorySize?: number; // Maximum memory size in bytes
  defaultTTL?: number; // Default TTL in milliseconds
  cleanupInterval?: number; // Cleanup interval in milliseconds
  compressionThreshold?: number; // Size threshold for compression
  enableCompression?: boolean;
  enableMetrics?: boolean;
  enablePersistence?: boolean;
  syncAcrossTabs?: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  compressions: number;
  hitRate: number;
  memoryUsage: number;
  avgAccessTime: number;
  regionStats?: Record<string, { hits: number; misses: number }>;
  tagStats?: Record<string, number>;
}

export interface CacheStrategy {
  name: string;
  shouldCache: (key: string, data: any) => boolean;
  getTTL: (key: string, data: any) => number;
  onEvict?: (key: string, data: any) => void;
}

// Constants for configuration
export const CACHE_CONSTANTS = {
  DEFAULT_SIZE: 1000,
  DEFAULT_MEMORY_SIZE: 10 * 1024 * 1024, // 10MB
  DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
  DEFAULT_CLEANUP_INTERVAL: 60 * 1000, // 1 minute
  DEFAULT_COMPRESSION_THRESHOLD: 1024, // 1KB
  COMPRESSION_RATIO_THRESHOLD: 0.8, // Only compress if reduces size by 20%
  
  // Specialized configurations
  LRU_CACHE_SIZE: 200,
  LRU_DEFAULT_TTL: 15 * 60 * 1000, // 15 minutes
  
  ADVANCED_CACHE_SIZE: 500,
  ADVANCED_MEMORY_SIZE: 10 * 1024 * 1024,
  ADVANCED_TTL: 3 * 60 * 1000, // 3 minutes
  
  UNIFIED_CACHE_SIZE: 1000,
  UNIFIED_MEMORY_SIZE: 10 * 1024 * 1024,
  UNIFIED_TTL: 5 * 60 * 1000, // 5 minutes
  
  // Edge configurations
  EDGE_REGIONS: ['hkg1', 'iad1', 'sin1', 'cle1', 'fra1'],
  EDGE_CACHE_TTL: 3 * 60 * 1000, // 3 minutes for edge
  
  // Tag configurations
  TAGS: {
    API: 'api',
    AI: 'ai',
    USER: 'user',
    STATIC: 'static',
    EDGE: 'edge',
    MARKET: 'market',
    ROBOT: 'robot'
  }
};

// Compression utilities
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

export class CompressionUtils {
  static async compress(data: any): Promise<{ compressed: boolean; data: any; size: number }> {
    const jsonString = JSON.stringify(data);
    const originalSize = jsonString.length * 2; // UTF-16
    
    if (originalSize < CACHE_CONSTANTS.DEFAULT_COMPRESSION_THRESHOLD) {
      return { compressed: false, data, size: originalSize };
    }
    
    try {
      const compressedData = compressToUTF16(jsonString);
      const compressedSize = compressedData.length * 2;
      
      // Only use compression if it reduces size significantly
      if (compressedSize < originalSize * CACHE_CONSTANTS.COMPRESSION_RATIO_THRESHOLD) {
        return { compressed: true, data: compressedData, size: compressedSize };
      }
    } catch (error) {
      logger.warn('Compression failed:', error);
    }
    
    return { compressed: false, data, size: originalSize };
  }
  
  static async decompress(data: any, compressed: boolean): Promise<any> {
    if (!compressed) {
      return data;
    }
    
    try {
      const decompressed = decompressFromUTF16(data);
      return JSON.parse(decompressed);
    } catch (error) {
      logger.warn('Decompression failed:', error);
      throw new Error('Failed to decompress cached data');
    }
  }
}

// Base cache class with common functionality
export abstract class BaseCache<T = any> {
  protected cache = new Map<string, BaseCacheEntry<T>>();
  protected metrics: CacheMetrics;
  protected config: Required<CacheConfig>;
  protected cleanupTimer: number | null = null;
  protected accessTimes: number[] = [];
  protected strategies = new Map<string, CacheStrategy>();

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxSize: CACHE_CONSTANTS.DEFAULT_SIZE,
      maxMemorySize: CACHE_CONSTANTS.DEFAULT_MEMORY_SIZE,
      defaultTTL: CACHE_CONSTANTS.DEFAULT_TTL,
      cleanupInterval: CACHE_CONSTANTS.DEFAULT_CLEANUP_INTERVAL,
      compressionThreshold: CACHE_CONSTANTS.DEFAULT_COMPRESSION_THRESHOLD,
      enableCompression: true,
      enableMetrics: true,
      enablePersistence: false,
      syncAcrossTabs: false,
      ...config
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      compressions: 0,
      hitRate: 0,
      memoryUsage: 0,
      avgAccessTime: 0
    };

    this.startCleanup();
  }

  // Abstract methods to be implemented by specialized caches
  abstract get(key: string, ...args: any[]): Promise<T | null>;
  abstract set(key: string, data: T, ...args: any[]): Promise<void>;

  // Common cache operations
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.metrics.deletes++;
      this.updateMemoryUsage();
    }
    
    return deleted;
  }

  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.metrics.deletes += size;
    this.updateMemoryUsage();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Strategy management
  registerStrategy(name: string, strategy: CacheStrategy): void {
    this.strategies.set(name, strategy);
  }

  protected shouldCacheEntry(key: string, data: any): boolean {
    for (const strategy of this.strategies.values()) {
      if (!strategy.shouldCache(key, data)) {
        return false;
      }
    }
    return true;
  }

  protected getTTLForEntry(key: string, data: any): number {
    for (const strategy of this.strategies.values()) {
      return strategy.getTTL(key, data);
    }
    return this.config.defaultTTL;
  }

  // Metrics and monitoring
  getMetrics(): CacheMetrics {
    this.updateHitRate();
    this.updateAvgAccessTime();
    return { ...this.metrics };
  }

  protected recordHit(): void {
    this.metrics.hits++;
  }

  protected recordMiss(): void {
    this.metrics.misses++;
  }

  protected recordAccessTime(time: number): void {
    this.accessTimes.push(time);
    
    if (this.accessTimes.length > 100) {
      this.accessTimes = this.accessTimes.slice(-100);
    }
  }

  protected updateMemoryUsage(): void {
    this.metrics.memoryUsage = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
  }

  protected updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  protected updateAvgAccessTime(): void {
    if (this.accessTimes.length > 0) {
      this.metrics.avgAccessTime = this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length;
    }
  }

  // Cleanup and maintenance
  protected startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = window.setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  protected cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.metrics.evictions += keysToDelete.length;
      this.updateMemoryUsage();
    }
  }

  protected calculateSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2; // UTF-16
    }
    return JSON.stringify(data).length * 2;
  }

  // Capacity management
  protected abstract ensureCapacity(requiredSize: number): Promise<void>;
  
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}