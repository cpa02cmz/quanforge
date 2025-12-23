/**
 * Cache Manager Service - Centralized Caching Operations
 * 
 * Handles caching with multiple strategies, TTL management, and cache invalidation
 */

import { ICacheManager, CacheConfig } from '../../types/serviceInterfaces';
import { consolidatedCache } from '../consolidatedCacheManager';

export class CacheManager implements ICacheManager {
  private config!: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
  };

  async initialize(): Promise<void> {
    this.config = {
      ttl: 15 * 60 * 1000, // 15 minutes
      maxSize: 200,
      strategy: 'lru',
    };
  }

  async destroy(): Promise<void> {
    // Clear all cache data
    await this.clear();
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test cache with simple set/get operation
      const testKey = 'health_check_' + Date.now();
      const testValue = 'healthy';
      
      await this.set(testKey, testValue);
      const retrieved = await this.get<string>(testKey);
      await this.invalidate(testKey);
      
      return retrieved === testValue;
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }

  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await consolidatedCache.get<T>(key);
      
      if (cached !== null) {
        this.stats.hits++;
        return cached;
      }
      
      this.stats.misses++;
      return null;
    } catch (error) {
      console.error(`Cache get failed for key ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, tags?: string[]): Promise<void> {
    try {
      await consolidatedCache.set(key, value, 'api', tags);
      this.stats.sets++;
    } catch (error) {
      console.error(`Cache set failed for key ${key}:`, error);
      throw error;
    }
  }

  async invalidate(pattern: string | string[]): Promise<void> {
    try {
      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      
      for (const patternToRemove of patterns) {
        // This would need to be implemented in the consolidated cache
        console.log(`Invalidating cache pattern: ${patternToRemove}`);
      }
      
      this.stats.invalidations += patterns.length;
    } catch (error) {
      console.error(`Cache invalidation failed for pattern ${pattern}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      // Clear all cache - this would need to be implemented in consolidated cache
      console.log('Clearing all cache');
      this.stats.invalidations++;
    } catch (error) {
      console.error('Cache clear failed:', error);
      throw error;
    }
  }

  getStats(): { hitRate: number; size: number; memoryUsage: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    
    return {
      hitRate,
      size: this.stats.sets - this.stats.invalidations,
      memoryUsage: 0, // Would need to be calculated from actual cache implementation
    };
  }

  // Advanced cache operations

  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    tags?: string[]
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - generate value and cache it
    const value = await factory();
    await this.set(key, value, tags);
    return value;
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      console.log(`Invalidating cache by tags: ${tags.join(', ')}`);
      // This would need to be implemented in the consolidated cache
      this.stats.invalidations += tags.length;
    } catch (error) {
      console.error(`Cache tag invalidation failed:`, error);
      throw error;
    }
  }

  async getMultiple<T>(keys: string[]): Promise<Record<string, T | null>> {
    const results: Record<string, T | null> = {};
    
    await Promise.all(
      keys.map(async (key) => {
        results[key] = await this.get<T>(key);
      })
    );
    
    return results;
  }

  async setMultiple<T>(entries: Record<string, T>, tags?: string[]): Promise<void> {
    await Promise.all(
      Object.entries(entries).map(async ([key, value]) => {
        await this.set(key, value, tags);
      })
    );
  }

  // Cache warming and optimization

  async warmCache<T>(entries: Record<string, T>, tags?: string[]): Promise<void> {
    console.log(`Warming cache with ${Object.keys(entries).length} entries`);
    await this.setMultiple(entries, tags);
  }

  async cleanup(): Promise<{ cleaned: number; errors: number }> {
    try {
      // Cleanup expired entries and optimize cache
      console.log('Running cache cleanup');
      
      return {
        cleaned: 0, // Would need to be calculated from actual cache
        errors: 0,
      };
    } catch (error) {
      console.error('Cache cleanup failed:', error);
      return { cleaned: 0, errors: 1 };
    }
  }

  // Statistics and monitoring

  getDetailedStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total).toFixed(4) : 0,
      efficiency: this.stats.sets > 0 ? (this.stats.hits / this.stats.sets).toFixed(4) : 0,
    };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
    };
  }

  // Adaptive TTL based on cache usage
  calculateOptimalTTL(_key: string, baseTTL: number): number {
    const hitRate = this.getStats().hitRate;
    
    if (hitRate > 0.8) {
      return baseTTL * 2; // Increase TTL for frequently accessed items
    } else if (hitRate < 0.2) {
      return Math.max(baseTTL * 0.5, 5 * 60 * 1000); // Reduce TTL but keep minimum 5min
    }
    
    return baseTTL;
  }
}