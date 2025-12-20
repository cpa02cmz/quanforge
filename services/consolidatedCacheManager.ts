/**
 * Consolidated Cache Manager - Legacy Wrapper
 * 
 * This file now redirects to the unified cache manager for consolidation.
 * The actual implementation is in unifiedCacheManager.ts
 */

export { 
  globalCache as consolidatedCache,
  cacheMetrics,
  cacheInvalidateByTags,
  cacheInvalidateByRegion 
} from './unifiedCacheManager';

export type { CacheStrategy, CacheMetrics, CacheOptions } from './unifiedCacheManager';