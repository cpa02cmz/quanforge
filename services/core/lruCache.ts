/**
 * LRU Cache implementation for better performance and memory management
 * 
 * [CONSOLIDATED] This file now re-exports from the centralized cache module
 * to avoid duplication and ensure consistency across the codebase.
 * 
 * Previous duplication: services/core/lruCache.ts + services/database/cache.ts
 * Consolidated to: services/database/cache.ts (more complete implementation)
 * 
 * @deprecated Import directly from '../database/cache' instead for new code
 */

// Re-export from centralized cache module to maintain backward compatibility
export { 
  LRUCache, 
  robotCache, 
  queryCache, 
  sessionCache, 
  warmCache, 
  startCacheCleanup 
} from '../database/cache';
