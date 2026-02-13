/**
 * Supabase Edge Configuration Constants
 * Flexy loves modularity! Centralized edge optimization configuration
 */

import { TIME_CONSTANTS } from '../../constants/config';

// ========== EDGE CACHE TTL CONFIGURATION ==========
export const EDGE_CACHE_TTL_CONFIG = {
  // Short-term caches
  VERY_SHORT: 5 * TIME_CONSTANTS.SECOND,      // 5 seconds
  SHORT: 15 * TIME_CONSTANTS.SECOND,          // 15 seconds
  DEFAULT: 30 * TIME_CONSTANTS.SECOND,        // 30 seconds
  MEDIUM: TIME_CONSTANTS.MINUTE,              // 1 minute
  EXTENDED: 2 * TIME_CONSTANTS.MINUTE,        // 2 minutes
  LONG: 5 * TIME_CONSTANTS.MINUTE,            // 5 minutes
} as const;

// ========== EDGE BATCH CONFIGURATION ==========
export const EDGE_BATCH_CONFIG = {
  // Batch sizes
  SIZE_SMALL: 5,
  SIZE_DEFAULT: 10,
  SIZE_LARGE: 25,
  SIZE_MAXIMUM: 50,
  
  // Batch timeouts (ms)
  TIMEOUT_FAST: 25,
  TIMEOUT_DEFAULT: 50,
  TIMEOUT_RELAXED: 100,
  TIMEOUT_SLOW: 200,
} as const;

// ========== EDGE REGION CONFIGURATION ==========
export const EDGE_REGIONS = {
  // Preferred regions
  PREFERRED: ['auto', 'us-east-1', 'eu-west-1'] as string[],
  FALLBACK: ['us-west-1', 'ap-southeast-1'] as string[],
  
  // All supported regions
  ALL: ['hkg1', 'iad1', 'sin1', 'cle1', 'fra1'] as string[],
  DEFAULT: 'iad1',
};

// ========== EDGE PERFORMANCE SCORING ==========
export const EDGE_SCORING = {
  // Latency calculation divisor (for score = BASE / (latency + 1))
  LATENCY_BASE: 1000,
  
  // Cache size limits
  MAX_CACHE_SIZE: 1000,
  MAX_REGION_PERFORMANCE_ENTRIES: 100,
} as const;

// ========== EDGE FEATURE FLAGS ==========
export const EDGE_FEATURE_DEFAULTS = {
  enableRegionOptimization: true,
  enableCompression: true,
  enableRequestBatching: true,
} as const;

// ========== DEFAULT EDGE CONFIGURATION ==========
export const DEFAULT_EDGE_CONFIG_VALUES = {
  ...EDGE_FEATURE_DEFAULTS,
  batchSize: EDGE_BATCH_CONFIG.SIZE_DEFAULT,
  batchTimeout: EDGE_BATCH_CONFIG.TIMEOUT_DEFAULT,
  preferredRegions: EDGE_REGIONS.PREFERRED,
  fallbackRegions: EDGE_REGIONS.FALLBACK,
  edgeCacheTTL: EDGE_CACHE_TTL_CONFIG.DEFAULT,
};

// Type exports
export type EdgeCacheTTLConfig = typeof EDGE_CACHE_TTL_CONFIG;
export type EdgeBatchConfig = typeof EDGE_BATCH_CONFIG;
export type EdgeRegions = typeof EDGE_REGIONS;

// Default export
export const EDGE_CONFIG_CONSTANTS = {
  CACHE_TTL: EDGE_CACHE_TTL_CONFIG,
  BATCH: EDGE_BATCH_CONFIG,
  REGIONS: EDGE_REGIONS,
  SCORING: EDGE_SCORING,
  FEATURES: EDGE_FEATURE_DEFAULTS,
  DEFAULTS: DEFAULT_EDGE_CONFIG_VALUES,
} as const;
