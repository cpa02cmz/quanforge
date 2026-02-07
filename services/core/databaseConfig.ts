/**
 * Database and connection configuration constants
 * Extracted from monolithic supabase.ts for better modularity
 */

// Enhanced connection retry configuration with exponential backoff
export const RETRY_CONFIG = {
  maxRetries: 5,
  retryDelay: 500,
  backoffMultiplier: 1.5,
  maxDelay: 10000, // Cap at 10 seconds
  jitter: true, // Add jitter to prevent thundering herd
} as const;

// Cache configuration for performance optimization
export const CACHE_CONFIG = {
  ttl: 15 * 60 * 1000, // 15 minutes for better edge performance
  maxSize: 200, // Max cached items
} as const;

// Storage keys for localStorage operations
export const STORAGE_KEYS = {
  SESSION: 'mock_session',
  ROBOTS: 'mock_robots',
} as const;

// Performance tracking thresholds
export const PERFORMANCE_THRESHOLDS = {
  SLOW_OPERATION_MS: 500,
  WARNING_OPERATION_MS: 200,
} as const;

// Database operation limits
export const DB_LIMITS = {
  DEFAULT_ROBOT_LIMIT: 100,
  MAX_SEARCH_RESULTS: 50,
  BATCH_UPDATE_SIZE: 25,
} as const;