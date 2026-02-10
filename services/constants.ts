/**
 * Service-Level Constants
 * Centralizes hardcoded values used across services for better maintainability
 * Flexy loves modularity! 🎯
 */

import { TIME_CONSTANTS } from '../constants/config';

// ========== CACHE TTL CONSTANTS ==========
export const CACHE_TTLS = {
  // Short-term caches (seconds to minutes)
  VERY_SHORT: 5 * TIME_CONSTANTS.SECOND,        // 5 seconds
  SHORT: 30 * TIME_CONSTANTS.SECOND,            // 30 seconds
  ONE_MINUTE: TIME_CONSTANTS.MINUTE,            // 1 minute
  TWO_MINUTES: 2 * TIME_CONSTANTS.MINUTE,       // 2 minutes
  
  // Medium-term caches (5-15 minutes)
  FIVE_MINUTES: 5 * TIME_CONSTANTS.MINUTE,      // 5 minutes
  TEN_MINUTES: 10 * TIME_CONSTANTS.MINUTE,      // 10 minutes
  FIFTEEN_MINUTES: 15 * TIME_CONSTANTS.MINUTE,  // 15 minutes
  
  // Long-term caches (hours)
  THIRTY_MINUTES: 30 * TIME_CONSTANTS.MINUTE,   // 30 minutes
  ONE_HOUR: TIME_CONSTANTS.HOUR,                // 1 hour
  TWO_HOURS: 2 * TIME_CONSTANTS.HOUR,           // 2 hours
  FOUR_HOURS: 4 * TIME_CONSTANTS.HOUR,          // 4 hours
  
  // Extended caches
  ONE_DAY: TIME_CONSTANTS.DAY,                  // 24 hours
  ONE_WEEK: TIME_CONSTANTS.WEEK,                // 7 days
  ONE_YEAR: 365 * TIME_CONSTANTS.DAY,           // 365 days
} as const;

// ========== RETRY CONFIGURATION ==========
export const RETRY_CONFIG = {
  // Base delays
  BASE_DELAY_MS: 1000,                          // 1 second
  MAX_DELAY_MS: 10000,                          // 10 seconds
  CAP_DELAY_MS: 5000,                           // 5 seconds cap
  
  // Exponential backoff
  BACKOFF_MULTIPLIER: 2,
  MAX_ATTEMPTS: 3,
  
  // Retry delays by scenario
  DELAYS: {
    SHORT: 500,                                 // 0.5 seconds
    NORMAL: 1000,                               // 1 second
    MEDIUM: 2000,                               // 2 seconds
    LONG: 3000,                                 // 3 seconds
    EXTENDED: 5000,                             // 5 seconds
  },
} as const;

// ========== CONNECTION POOL CONSTANTS ==========
export const POOL_CONFIG = {
  // Timeouts
  IDLE_TIMEOUT_MS: 45000,                       // 45 seconds
  CONNECTION_TIMEOUT_MS: 800,                   // 0.8 seconds
  ACQUIRE_TIMEOUT_MS: 300,                      // 0.3 seconds
  HEALTH_CHECK_INTERVAL_MS: 15000,              // 15 seconds
  
  // Scoring weights
  SCORING: {
    REGION_MATCH_BONUS: 2000,
    HEALTHY_BONUS: 500,
    RECENT_USE_PENALTY: 200,
    LATENCY_MULTIPLIER: 1000,
    MAX_LATENCY_PENALTY: 1000,
  },
  
  // Thresholds
  RECENT_USAGE_THRESHOLD_MS: 30000,             // 30 seconds
  COLD_START_THRESHOLD_MS: 500,                 // 0.5 seconds
  MAX_CONNECTIONS: 100,
} as const;

// ========== WEB VITALS THRESHOLDS ==========
export const WEB_VITALS_THRESHOLDS = {
  // Largest Contentful Paint (ms)
  LCP: {
    GOOD: 2500,
    NEEDS_IMPROVEMENT: 4000,
    POOR: 6000,
  },
  
  // First Contentful Paint (ms)
  FCP: {
    GOOD: 1800,
    NEEDS_IMPROVEMENT: 3000,
    POOR: 4500,
  },
  
  // Time to First Byte (ms)
  TTFB: {
    GOOD: 800,
    NEEDS_IMPROVEMENT: 1800,
    POOR: 3000,
  },
  
  // First Input Delay (ms)
  FID: {
    GOOD: 100,
    NEEDS_IMPROVEMENT: 300,
    POOR: 500,
  },
  
  // Interaction to Next Paint (ms)
  INP: {
    GOOD: 200,
    NEEDS_IMPROVEMENT: 500,
    POOR: 800,
  },
  
  // Cumulative Layout Shift
  CLS: {
    GOOD: 0.1,
    NEEDS_IMPROVEMENT: 0.25,
    POOR: 0.5,
  },
} as const;

// ========== API RESPONSE THRESHOLDS ==========
export const API_THRESHOLDS = {
  // Response time (ms)
  RESPONSE_TIME: {
    EXCELLENT: 200,
    GOOD: 500,
    NEEDS_IMPROVEMENT: 1000,
    POOR: 2000,
  },
  
  // Query execution time (ms)
  QUERY: {
    SLOW: 500,
    CRITICAL: 1000,
  },
} as const;

// ========== MONITORING CONSTANTS ==========
export const MONITORING = {
  // Intervals
  INTERVALS: {
    FAST: 5 * TIME_CONSTANTS.SECOND,             // 5 seconds
    NORMAL: 10 * TIME_CONSTANTS.SECOND,          // 10 seconds
    SLOW: 30 * TIME_CONSTANTS.SECOND,            // 30 seconds
    VERY_SLOW: TIME_CONSTANTS.MINUTE,            // 1 minute
  },
  
  // Flush intervals
  FLUSH_INTERVAL_MS: 30 * TIME_CONSTANTS.SECOND, // 30 seconds
  
  // Limits
  MAX_METRICS: 500,
  MAX_MEMORY_SNAPSHOTS: 100,
  MAX_LOGS: 1000,
  MAX_SAMPLES: 100,
  
  // Thresholds
  SLOW_OPERATION_THRESHOLD_MS: 1000,             // 1 second
  HIGH_MEMORY_THRESHOLD_MB: 50,
  MODERATE_MEMORY_THRESHOLD_MB: 30,
} as const;

// ========== RATE LIMITING CONSTANTS ==========
export const RATE_LIMITS = {
  // Default window
  DEFAULT_WINDOW_MS: TIME_CONSTANTS.MINUTE,      // 1 minute
  
  // Time windows
  ONE_MINUTE: TIME_CONSTANTS.MINUTE,
  FIFTEEN_MINUTES: 15 * TIME_CONSTANTS.MINUTE,
  ONE_HOUR: TIME_CONSTANTS.HOUR,
  ONE_DAY: TIME_CONSTANTS.DAY,
  
  // Request limits
  REQUESTS: {
    BASIC: 100,
    PREMIUM: 500,
    ENTERPRISE: 2000,
  },
  
  // Rate limit delay
  RATE_LIMIT_DELAY_MS: 100,                      // 100ms between requests
} as const;

// ========== SECURITY CONSTANTS ==========
export const SECURITY = {
  // Token expiry
  TOKEN_EXPIRY_MS: TIME_CONSTANTS.HOUR,          // 1 hour
  TOKEN_REFRESH_BEFORE_MS: 5 * TIME_CONSTANTS.MINUTE, // 5 minutes before expiry
  CSRF_VIOLATION_AGE_MS: TIME_CONSTANTS.DAY,     // 24 hours
  
  // String limits
  MAX_STRING_LENGTH: 1000,
  MAX_CODE_LENGTH: 100000,                       // 100KB
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_PARAM_VALUE_LENGTH: 500,
  MAX_INPUT_LENGTH: 10000,
  
  // API key
  MIN_API_KEY_LENGTH: 10,
  MAX_API_KEY_LENGTH: 500,
} as const;

// ========== CACHE SIZE CONSTANTS ==========
export const CACHE_SIZES = {
  // Entry limits
  MAX_ENTRIES_SMALL: 100,
  MAX_ENTRIES_MEDIUM: 500,
  MAX_ENTRIES_LARGE: 1000,
  
  // Memory limits (bytes)
  SMALL_MB: 2 * 1024 * 1024,                     // 2MB
  MEDIUM_MB: 5 * 1024 * 1024,                    // 5MB
  LARGE_MB: 10 * 1024 * 1024,                    // 10MB
  VERY_LARGE_MB: 20 * 1024 * 1024,               // 20MB
  MAX_MB: 50 * 1024 * 1024,                      // 50MB
} as const;

// ========== SCORING CONSTANTS ==========
export const SCORING = {
  // Score ranges
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  DEFAULT_SCORE: 100,
  
  // Thresholds
  EXCELLENT: 80,
  GOOD: 60,
  POOR: 0,
  
  // Multipliers
  PERCENTAGE_MULTIPLIER: 100,
  RATIO_MULTIPLIER: 50,
  ACCESS_FREQUENCY_MULTIPLIER: 100,
  
  // Penalties
  SLOW_OP_PENALTY_MULTIPLIER: 5,
  SLOW_OP_MAX_PENALTY: 30,
} as const;

// ========== ERROR CODES ==========
export const ERROR_CODES = {
  // HTTP Status Codes
  HTTP: {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    RATE_LIMIT: 429,
    SERVER_ERROR: 500,
  },
  
  // Supabase Error Codes
  SUPABASE: {
    CONNECTION_ERROR: 1014,
    RECORD_NOT_FOUND: 'PGRST116',
    PERMISSION_DENIED: 'PGRST301',
    INSUFFICIENT_PRIVILEGE: '42501',
    UNIQUE_VIOLATION: '23505',
    FOREIGN_KEY_VIOLATION: '23503',
  },
} as const;

// ========== PERFORMANCE BUDGETS ==========
export const PERFORMANCE_BUDGETS = {
  // Bundle sizes (bytes)
  BUNDLE_SIZE: {
    WARNING: 200 * 1024,                         // 200KB
    CRITICAL: 300 * 1024,                        // 300KB
    MAX: 1024 * 1024,                            // 1MB
  },
  
  // Resource sizes
  RESOURCE_SIZE: {
    WARNING: 500 * 1024,                         // 500KB
    CRITICAL: 1024 * 1024,                       // 1MB
  },
  
  // Load times (ms)
  LOAD_TIME: {
    WARNING: 3000,                               // 3 seconds
    CRITICAL: 5000,                              // 5 seconds
  },
} as const;

// ========== STAGGER & DELAY CONSTANTS ==========
export const STAGGER = {
  MICRO_DELAY_MS: 10,                           // 10ms - for tight polling loops
  DEFAULT_DELAY_MS: 100,                        // 100ms - standard stagger delay
  IMPORT_STAGGER_MS: 1000,                      // 1s - module import staggering
  HEALTH_CHECK_TIMEOUT_MS: 2000,                // 2s - health check timeout
  WARMUP_TIMEOUT_MS: 2000,                      // 2s - connection warmup timeout
  MAX_EXPONENTIAL_DELAY_MS: 5000,               // 5s - max exponential backoff
} as const;

// ========== BATCH SIZES ==========
export const BATCH_SIZES = {
  DATABASE_OPERATIONS: 10,
  PAGINATION_DEFAULT: 20,
  PAGINATION_MAX: 100,
  PREFETCH_BATCH: 20,
  REALTIME_SYNC: 50,
  METRICS_BATCH: 100,
} as const;

// ========== TIMEOUT CONSTANTS ==========
export const TIMEOUTS = {
  // Quick timeouts
  QUICK: 1000,                                   // 1 second
  STANDARD: 5000,                                // 5 seconds
  EXTENDED: 10000,                               // 10 seconds
  LONG: 30000,                                   // 30 seconds
  
  // Specific timeouts
  CIRCUIT_BREAKER: {
    FAST: 5000,
    SLOW: 15000,
    RESET: 30000,
  },
  
  POOL: {
    ACQUIRE: 5000,
    HEALTH_CHECK: 10000,
  },
} as const;

// ========== UI TIMING CONSTANTS ==========
export const UI_TIMING = {
  TOAST_DURATION: 3000,                          // 3 seconds
  COPY_FEEDBACK_DURATION: 2000,                  // 2 seconds
  DIRECTION_INDICATOR_DURATION: 800,             // 0.8 seconds
  FADE_TRANSITION_DURATION: 300,                 // 300ms
} as const;

// ========== VIRTUAL SCROLL CONSTANTS ==========
export const VIRTUAL_SCROLL = {
  OVERSCAN: 5,
  ITEM_HEIGHT: 280,                              // pixels
} as const;

// ========== MEMORY CONSTANTS ==========
export const MEMORY = {
  // Thresholds
  WARNING_MB: 50,
  CRITICAL_MB: 100,
  CLEANUP_THRESHOLD_PERCENT: 0.8,                // 80%
  
  // Monitoring intervals
  MONITOR_INTERVAL_LARGE_MS: 5000,               // 5 seconds
  MONITOR_INTERVAL_NORMAL_MS: 10000,             // 10 seconds
  
  // Buffer limits
  MAX_CHAT_HISTORY: 5000,
  MAX_HISTORY_SIZE: 100,
} as const;

// ========== WEBSOCKET CONSTANTS ==========
export const WEBSOCKET = {
  // Reconnect configuration
  MAX_RECONNECT_ATTEMPTS: 3,
  BASE_RECONNECT_DELAY_MS: 1000,
  MAX_RECONNECT_DELAY_MS: 30000,                 // 30 seconds
  JITTER_MAX_MS: 1000,
  
  // Heartbeat
  HEARTBEAT_INTERVAL_MS: 30000,                  // 30 seconds
} as const;

// ========== DATABASE CONSTANTS ==========
export const DATABASE = {
  // Retry configuration
  RETRY: {
    BASE_DELAY_MS: 500,
    MAX_DELAY_MS: 10000,
    BACKOFF_MULTIPLIER: 2,
    MAX_ATTEMPTS: 3,
  },
  
  // Circuit breaker
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 3,
    RESET_TIMEOUT_MS: 30 * TIME_CONSTANTS.SECOND, // 30 seconds
    MONITORING_PERIOD_MS: 10000,                  // 10 seconds
    SUCCESS_THRESHOLD: 3,
  },
  
  // Cache TTL
  CACHE_TTL_MS: 15 * TIME_CONSTANTS.MINUTE,      // 15 minutes
} as const;

// Default export
export const SERVICE_CONSTANTS = {
  CACHE_TTLS,
  RETRY_CONFIG,
  POOL_CONFIG,
  WEB_VITALS_THRESHOLDS,
  API_THRESHOLDS,
  MONITORING,
  RATE_LIMITS,
  SECURITY,
  CACHE_SIZES,
  SCORING,
  ERROR_CODES,
  PERFORMANCE_BUDGETS,
  STAGGER,
  BATCH_SIZES,
  TIMEOUTS,
  UI_TIMING,
  VIRTUAL_SCROLL,
  MEMORY,
  WEBSOCKET,
  DATABASE,
} as const;
