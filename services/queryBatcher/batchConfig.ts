/**
 * Query Batcher Configuration Constants
 * Flexy loves modularity! Centralized configuration for query batching system
 */

// ========== BATCH SIZE CONFIGURATION ==========
export const BATCH_SIZE_CONFIG = {
  // Default batch sizes
  DEFAULT: 10,
  SMALL: 5,
  MEDIUM: 15,
  LARGE: 25,
  MAXIMUM: 50,
  
  // Size thresholds
  WARNING_THRESHOLD: 30,
  CRITICAL_THRESHOLD: 50,
} as const;

// ========== BATCH TIMEOUT CONFIGURATION (milliseconds) ==========
export const BATCH_TIMEOUT_CONFIG = {
  // Timeout values
  IMMEDIATE: 10,
  FAST: 25,
  DEFAULT: 50,
  NORMAL: 100,
  RELAXED: 200,
  SLOW: 500,
  
  // Maximum wait times
  MAX_WAIT_FAST: 300,
  MAX_WAIT_DEFAULT: 500,
  MAX_WAIT_RELAXED: 1000,
  MAX_WAIT_EXTENDED: 2000,
} as const;

// ========== RETRY CONFIGURATION ==========
export const BATCH_RETRY_CONFIG = {
  // Attempt counts
  ATTEMPTS_MINIMAL: 1,
  ATTEMPTS_DEFAULT: 3,
  ATTEMPTS_AGGRESSIVE: 5,
  
  // Delay values (ms)
  DELAY_MINIMAL: 50,
  DELAY_DEFAULT: 100,
  DELAY_MEDIUM: 250,
  DELAY_EXTENDED: 500,
} as const;

// ========== QUEUE HEALTH THRESHOLDS ==========
export const QUEUE_HEALTH_THRESHOLDS = {
  // Queue size thresholds
  PENDING_WARNING: 20,
  PENDING_CRITICAL: 50,
  
  // Overdue query thresholds
  OVERDUE_WARNING: 5,
  OVERDUE_CRITICAL: 10,
  
  // Wait time thresholds (ms)
  MAX_WAIT_TIME_WARNING: 1000,
  MAX_WAIT_TIME_CRITICAL: 2000,
} as const;

// ========== DEFAULT BATCH CONFIGURATION ==========
export const DEFAULT_BATCH_CONFIG = {
  maxBatchSize: BATCH_SIZE_CONFIG.DEFAULT,
  batchTimeout: BATCH_TIMEOUT_CONFIG.DEFAULT,
  maxWaitTime: BATCH_TIMEOUT_CONFIG.MAX_WAIT_DEFAULT,
  priorityQueues: true,
  retryAttempts: BATCH_RETRY_CONFIG.ATTEMPTS_DEFAULT,
  retryDelay: BATCH_RETRY_CONFIG.DELAY_DEFAULT,
} as const;

// ========== QUERY EXECUTION LIMITS ==========
export const QUERY_EXECUTION_LIMITS = {
  // Result limits
  DEFAULT_SELECT_LIMIT: 1000,
  MAX_SELECT_LIMIT: 5000,
  
  // Error status codes
  ERROR_STATUS_SERVER: 500,
  ERROR_STATUS_CLIENT_RANGE_START: 400,
  ERROR_STATUS_CLIENT_RANGE_END: 500,
} as const;

// Type exports
export type BatchSizeConfig = typeof BATCH_SIZE_CONFIG;
export type BatchTimeoutConfig = typeof BATCH_TIMEOUT_CONFIG;
export type BatchRetryConfig = typeof BATCH_RETRY_CONFIG;
export type QueueHealthThresholds = typeof QUEUE_HEALTH_THRESHOLDS;

// Default export
export const BATCH_CONFIG = {
  SIZE: BATCH_SIZE_CONFIG,
  TIMEOUT: BATCH_TIMEOUT_CONFIG,
  RETRY: BATCH_RETRY_CONFIG,
  HEALTH: QUEUE_HEALTH_THRESHOLDS,
  DEFAULTS: DEFAULT_BATCH_CONFIG,
  LIMITS: QUERY_EXECUTION_LIMITS,
} as const;
