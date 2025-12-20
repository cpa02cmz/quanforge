/**
 * Optimized Cache - Legacy Wrapper
 * 
 * This file now redirects to the unified cache manager for consolidation.
 * The actual implementation is in unifiedCacheManager.ts
 */

export { 
  globalCache,
  robotCache,
  marketDataCache, 
  analysisCache,
  CacheFactory
} from './unifiedCacheManager';

export type { CacheOptions, CacheEntry, CacheStats } from './unifiedCacheManager';

// Re-export the OptimizedCache class as a wrapper for compatibility
import { globalCache } from './unifiedCacheManager';

export class OptimizedCache {
  // Delegate to global cache for backward compatibility
  get<T>(key: string): T | null {
    return globalCache.get<T>(key);
  }

  set<T>(key: string, data: T, ttl?: number, tags?: string[]): void {
    globalCache.set(key, data, ttl, tags);
  }

  delete(key: string): boolean {
    return globalCache.delete(key);
  }

  clear(): void {
    globalCache.clear();
  }

  getMetrics(): any {
    return globalCache.getMetrics();
  }

  // Other methods can be added as needed for compatibility
}