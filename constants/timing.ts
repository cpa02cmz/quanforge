/**
 * Application Constants
 * Centralized configuration for timing, sizing, and magic numbers
 */

// Toast Notifications
export const TOAST_DURATION = 3000; // 3 seconds

// UI Feedback Timing
export const COPY_FEEDBACK_DURATION = 2000; // 2 seconds
export const DIRECTION_INDICATOR_DURATION = 800; // 0.8 seconds

// Memory Management
export const MEMORY_MONITOR_INTERVAL_LARGE = 5000; // 5 seconds for large datasets
export const MEMORY_MONITOR_INTERVAL_NORMAL = 10000; // 10 seconds for normal datasets
export const MAX_CHAT_HISTORY_LENGTH = 5000; // Maximum messages to retain

// Performance Monitoring
export const PERFORMANCE_INSIGHTS_INTERVAL = 5000; // 5 seconds

// Caching
export const FILTER_CACHE_TTL = 5000; // 5 seconds for filter results

// Animation
export const FADE_TRANSITION_DURATION = 300; // 300ms

// Virtual Scrolling
export const VIRTUAL_SCROLL_OVERSCAN = 5; // Number of items to render outside viewport
export const VIRTUAL_SCROLL_ITEM_HEIGHT = 280; // Height of each robot card in px

// Preload Timing Constants
export const PRELOAD_DELAYS = {
  IMMEDIATE: 0,           // No delay for critical routes
  LAYOUT: 500,            // 500ms - Layout is essential for navigation
  GENERATOR: 1000,        // 1s - Generator is second most likely route
  STATIC_PAGES: 2000,     // 2s - Static pages can load last
} as const;

// Retry Timing Constants  
export const RETRY_DELAYS = {
  SHORT: 1000,            // 1 second
  MEDIUM: 2000,           // 2 seconds
  LONG: 3000,             // 3 seconds
  EXTENDED: 5000,         // 5 seconds
} as const;

// Timeout Constants
export const TIMEOUTS = {
  QUICK: 1000,            // 1 second
  STANDARD: 5000,         // 5 seconds
  EXTENDED: 10000,        // 10 seconds
  LONG: 30000,            // 30 seconds
} as const;

// Cache TTL Constants (in milliseconds)
export const CACHE_TTL = {
  VERY_SHORT: 1000,       // 1 second
  SHORT: 5000,            // 5 seconds
  MEDIUM: 15000,          // 15 seconds
  STANDARD: 60000,        // 1 minute
  LONG: 300000,           // 5 minutes
  EXTENDED: 900000,       // 15 minutes
  DAILY: 86400000,        // 24 hours
} as const;

// Size Limits
export const SIZE_LIMITS = {
  SMALL: 100,             // 100 items/bytes
  MEDIUM: 500,            // 500 items/bytes
  LARGE: 1000,            // 1000 items/bytes
  VERY_LARGE: 5000,       // 5000 items/bytes
  MAX_CACHE: 10000,       // 10000 items
} as const;

// Health Check Intervals
export const HEALTH_CHECK_INTERVALS = {
  FAST: 5000,             // 5 seconds
  NORMAL: 10000,          // 10 seconds
  SLOW: 30000,            // 30 seconds
  VERY_SLOW: 60000,       // 1 minute
} as const;

// Performance Monitoring Constants
export const PERFORMANCE_MONITORING = {
  // Metric collection limits
  MAX_METRICS: 500,                   // Maximum metrics to retain
  MAX_MEMORY_SNAPSHOTS: 100,          // Maximum memory snapshots
  MAX_LOGS: 1000,                     // Maximum log entries
  REPORTING_THRESHOLD: 200,           // Auto-report every N metrics
  SAMPLING_RATE: 0.1,                 // Sample 10% of operations
  
  // Thresholds
  SLOW_OPERATION_THRESHOLD: 1000,     // 1 second
  HIGH_MEMORY_THRESHOLD_MB: 50,       // 50MB warning threshold
  MODERATE_MEMORY_THRESHOLD_MB: 30,   // 30MB for scoring
  SLOW_OP_SCORE_THRESHOLD: 500,       // 500ms for slow op detection
  HIGH_AVG_DURATION_THRESHOLD: 200,   // 200ms for scoring
  
  // Score calculations
  SLOW_OP_PENALTY_MULTIPLIER: 5,      // Deduct 5 points per slow op
  SLOW_OP_MAX_PENALTY: 30,            // Max 30 points deduction
  HIGH_AVG_DURATION_MAX_PENALTY: 20,  // Max 20 points for high avg
  MEMORY_USAGE_MAX_PENALTY: 20,       // Max 20 points for memory
} as const;

// Memory Constants
export const MEMORY = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  WARNING_THRESHOLD_MB: 50,
  CRITICAL_THRESHOLD_MB: 100,
  CLEANUP_THRESHOLD_PERCENT: 0.8,     // 80%
} as const;

// Message Buffer Constants
export const MESSAGE_BUFFER = {
  DEFAULT_MAX_SIZE: 50,
  MEMORY_WARNING_MB: 5,
  MEMORY_CRITICAL_MB: 10,
  MONITOR_INTERVAL: 15000,            // 15 seconds
  KEEP_RECENT_CRITICAL: 10,
  KEEP_RECENT_WARNING: 15,
  TRIM_CUTOFF_HOURS: 4,               // 4 hours
  MANUAL_CLEANUP_THRESHOLD_KB: 2048,  // 2MB
} as const;

// Error Display Constants
export const ERROR_DISPLAY = {
  DURATION_SHORT: 3000,               // 3 seconds - low severity
  DURATION_MEDIUM: 5000,              // 5 seconds - medium severity
  DURATION_LONG: 8000,                // 8 seconds - high/critical severity
} as const;
