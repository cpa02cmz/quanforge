/**
 * Scoring Constants
 * Centralized scoring, risk, and threshold values for consistent evaluation
 * Flexy loves modularity - no more magic numbers! 
 */

// ========== RISK SCORE VALUES ==========
export const RISK_SCORES = {
  // High risk indicators
  CRITICAL: 100,
  HIGH: 50,
  MEDIUM: 30,
  LOW: 20,
  MINIMAL: 10,
  VERY_LOW: 5,

  // Security-specific
  SECURITY: {
    SUSPICIOUS_PATTERN: 50,
    DANGEROUS_PATTERN: 100,
    KNOWN_THREAT: 100,
    ENCRYPTION_WEAK: 30,
    ENCRYPTION_MISSING: 50,
    VALIDATION_FAILURE: 20,
  },

  // Input validation
  INPUT: {
    MAX_LENGTH_EXCEEDED: 10,
    INVALID_FORMAT: 10,
    SUSPICIOUS_CHARS: 10,
    PATTERN_MISMATCH: 10,
  },
} as const;

// ========== CONFIDENCE SCORE VALUES ==========
export const CONFIDENCE_SCORES = {
  BASE: 0,
  LOW: 20,
  MEDIUM: 30,
  HIGH: 50,
  VERY_HIGH: 100,

  // Pattern matches
  PATTERN: {
    EXACT: 30,
    STRONG: 20,
    MODERATE: 10,
  },
} as const;

// ========== PERFORMANCE SCORE VALUES ==========
export const PERFORMANCE_SCORES = {
  PERFECT: 100,
  EXCELLENT: 90,
  GOOD: 80,
  NEEDS_IMPROVEMENT: 50,
  POOR: 0,

  // Penalties
  PENALTIES: {
    HIGH_MEMORY: 20,
    MODERATE_MEMORY: 10,
    SLOW_QUERY: 10,
    HIGH_ERROR_RATE: 10,
  },

  // Bonuses
  BONUSES: {
    LOW_ERROR_RATE: 10,
    GOOD_CACHE_HIT: 20,
    LOW_EVICTIONS: 10,
    LOW_EDGE_ERROR: 5,
  },
} as const;

// ========== UX SCORE VALUES ==========
export const UX_SCORES = {
  PERFECT: 100,
  BASELINE: 50,
  THRESHOLD: {
    EXCELLENT: 80,
    GOOD: 60,
    NEEDS_IMPROVEMENT: 50,
  },

  // Abandonment risk factors
  ABANDONMENT: {
    POOR_SCORE: 30,
    SLOW_LCP: 20,
    HIGH_CLS: 10,
  },

  // Long task threshold (ms)
  LONG_TASK_THRESHOLD_MS: 50,

  // Trend detection
  TREND_THRESHOLD: 5,
} as const;

// ========== OPTIMIZATION VALUES ==========
export const OPTIMIZATION_VALUES = {
  // History sizes
  HISTORY_SIZE: 50,

  // Estimated gains
  PERFORMANCE_GAIN_ESTIMATE: 20, // 20% improvement
  IMPROVEMENT_ESTIMATE_PERCENT: 5, // 5% improvement

  // Score boost
  OPTIMIZATION_BOOST: 10,
} as const;

// ========== PAGINATION & LIMIT VALUES ==========
export const PAGINATION_VALUES = {
  DEFAULT_PAGE_SIZE: 10,
  DEFAULT_LIMIT: 20,
  MAX_ATTEMPTS: 10,
} as const;

// ========== CACHE & STORAGE VALUES ==========
export const CACHE_VALUES = {
  HOT_ENTRIES_LIMIT: 10,
  DEFAULT_CACHE_SIZE: 100,
  DEFAULT_TTL_MINUTES: 5,
} as const;

// ========== ITEM DIMENSIONS ==========
export const ITEM_DIMENSIONS = {
  VIRTUAL_SCROLL_ITEM_HEIGHT: 50, // pixels
} as const;

// ========== RATE LIMITING VALUES ==========
export const RATE_LIMIT_VALUES = {
  DEFAULT_BURST_SIZE: 10,
  DEFAULT_TOP_USERS_LIMIT: 10,
  API_KEY_MIN_LENGTH: 20,
  API_KEY_MASK_THRESHOLD: 10,
} as const;

// ========== BUSINESS RULES ==========
export const BUSINESS_RULES = {
  // Business hours
  BUSINESS_HOURS: {
    START: 9,
    END: 18,
    DAYS_START: 1, // Monday
    DAYS_END: 5, // Friday
  },
} as const;

// ========== THRESHOLD VALUES ==========
export const THRESHOLD_VALUES = {
  // Error rates
  ERROR_RATE: {
    CRITICAL: 0.01, // 1%
    WARNING: 0.05, // 5%
  },

  // Cache metrics
  CACHE_HIT_RATE: {
    EXCELLENT: 80, // 80%
    GOOD: 70, // 70%
  },

  // Eviction thresholds
  EVICTIONS: {
    HIGH: 50,
    LOW: 50,
  },

  // CLS thresholds
  CLS: {
    GOOD: 0.1,
    NEEDS_IMPROVEMENT: 0.25,
  },
} as const;

// ========== SCORING WEIGHTS ==========
export const SCORING_WEIGHTS = {
  UX: {
    PERFORMANCE: 0.4,
    RELIABILITY: 0.3,
    ENGAGEMENT: 0.3,
  },
} as const;

// Default export
export const SCORING_CONSTANTS = {
  RISK: RISK_SCORES,
  CONFIDENCE: CONFIDENCE_SCORES,
  PERFORMANCE: PERFORMANCE_SCORES,
  UX: UX_SCORES,
  OPTIMIZATION: OPTIMIZATION_VALUES,
  PAGINATION: PAGINATION_VALUES,
  CACHE: CACHE_VALUES,
  DIMENSIONS: ITEM_DIMENSIONS,
  RATE_LIMIT: RATE_LIMIT_VALUES,
  BUSINESS: BUSINESS_RULES,
  THRESHOLD: THRESHOLD_VALUES,
  WEIGHTS: SCORING_WEIGHTS,
} as const;

export default SCORING_CONSTANTS;
