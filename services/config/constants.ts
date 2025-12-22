/**
 * Configuration Constants for Supabase Service
 * Extracted from services/supabase.ts for better modularity
 */

// Enhanced connection retry configuration with exponential backoff
export const RETRY_CONFIG = {
  maxRetries: 5,
  retryDelay: 500,
  backoffMultiplier: 1.5,
  maxDelay: 10000, // Cap at 10 seconds
  jitter: true, // Add jitter to prevent thundering herd
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  ttl: 15 * 60 * 1000, // 15 minutes for better edge performance
  maxSize: 200, // Max cached items
} as const;

// Storage keys for localStorage
export const STORAGE_KEYS = {
  SESSION: 'mock_session',
  ROBOTS: 'mock_robots',
} as const;

// Query and pagination limits
export const QUERY_LIMITS = {
  DEFAULT_LIMIT: 100,
  BATCH_SIZE: 10,
  MAX_CACHE_SIZE: 100,
} as const;

// Performance monitoring thresholds
export const PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 1000,
  MEMORY_WARNING_MB: 100,
  CACHE_HIT_RATE_MIN: 0.8,
} as const;

// Database operation timeouts
export const TIMEOUTS = {
  DEFAULT_QUERY_MS: 5000,
  BATCH_OPERATION_MS: 10000,
  CONNECTION_TEST_MS: 3000,
} as const;

// Rate limiting configuration
export const RATE_LIMITS = {
  MAX_REQUESTS_PER_MINUTE: 60,
  WINDOW_SIZE_MS: 60000,
} as const;

// Default TTL values for different cache types
export const TTL_VALUES = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
  MAX: 300 * 1000, // 5 minutes
} as const;

// Pagination defaults
export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// Cache key prefixes
export const CACHE_PREFIXES = {
  ROBOT: 'robot_',
  USER_ROBOTS: 'user_robots_',
  SEARCH: 'search_',
  ANALYTICS: 'analytics_',
} as const;

// Error codes for storage quota management
export const STORAGE_ERROR_CODES = {
  QUOTA_EXCEEDED: 22,
  MOZILLA_QUOTA_EXCEEDED: 1014,
} as const;

// Authentication session configuration
export const AUTH_CONFIG = {
  EXPIRES_IN: 3600, // 1 hour in seconds
} as const;

// Performance monitoring limits
export const PERFORMANCE_LIMITS = {
  METRICS_HISTORY_SIZE: 100,
  SLOW_QUERY_THRESHOLD_MS: 500,
  PAGINATED_QUERY_THRESHOLD_MS: 1000,
} as const;

// Percentile calculations for performance monitoring
export const PERFORMANCE_PERCENTILES = {
  P50: 50,
  P95: 95,
  P99: 99,
} as const;

// Cache TTL calculation limits
export const CACHE_TTL_LIMITS = {
  MIN_TTL_MS: 60000, // 1 minute
  MAX_TTL_MS: 300000, // 5 minutes
  MULTIPLIER_MIN: 100,
  MULTIPLIER_MAX: 50,
} as const;

// Pagination calculations
export const PAGINATION_CALCULATIONS = {
  MIN_SEARCH_TERM_LENGTH: 1,
  MULTI_WORD_SEARCH_MIN_LENGTH: 0,
} as const;

// Database migration configuration
export const MIGRATION_CONFIG = {
  BATCH_SIZE: 10,
  EXPORT_VERSION: "1.0",
  JSON_INDENT: 2,
} as const;

// Bulk operation configuration
export const BULK_OPERATIONS = {
  BATCH_SIZE: 10,
  SUCCESS_THRESHOLD: 0, // Minimum success count required
} as const;

// Database statistics calculations
export const DATABASE_STATS = {
  BYTES_PER_KB: 1024,
  SIZE_ROUNDING_PRECISION: 0,
} as const;