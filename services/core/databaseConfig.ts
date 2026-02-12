/**
 * Database and connection configuration constants
 * Extracted from monolithic supabase.ts for better modularity
 * Now using centralized modular configuration
 */

import { RETRY_CONFIGS, CACHE_SIZES, SERVICE_TIMEOUTS } from '../../constants/modularConfig';
import { CACHE_TTLS } from '../constants';

// Enhanced connection retry configuration with exponential backoff - using modular config
export const RETRY_CONFIG = {
  maxRetries: RETRY_CONFIGS.AGGRESSIVE.MAX_ATTEMPTS,
  retryDelay: RETRY_CONFIGS.AGGRESSIVE.BASE_DELAY_MS,
  backoffMultiplier: RETRY_CONFIGS.AGGRESSIVE.BACKOFF_MULTIPLIER,
  maxDelay: RETRY_CONFIGS.AGGRESSIVE.MAX_DELAY_MS,
  jitter: RETRY_CONFIGS.AGGRESSIVE.USE_JITTER,
} as const;

// Cache configuration for performance optimization - using modular config
export const CACHE_CONFIG = {
  ttl: CACHE_TTLS.FIFTEEN_MINUTES,
  maxSize: CACHE_SIZES.ENTRIES.MEDIUM,
} as const;

// Storage keys for localStorage operations
export const STORAGE_KEYS = {
  SESSION: 'mock_session',
  ROBOTS: 'mock_robots',
} as const;

// Performance tracking thresholds - using modular config
export const PERFORMANCE_THRESHOLDS = {
  SLOW_OPERATION_MS: SERVICE_TIMEOUTS.QUICK,
  WARNING_OPERATION_MS: 200,
} as const;

// Database operation limits - using modular config
export const DB_LIMITS = {
  DEFAULT_ROBOT_LIMIT: CACHE_SIZES.ENTRIES.SMALL,
  MAX_SEARCH_RESULTS: 50,
  BATCH_UPDATE_SIZE: 25,
} as const;