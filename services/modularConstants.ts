/**
 * Modular Service Constants
 * Flexy's modular configuration system - no more hardcoded values!
 * 
 * This module provides a centralized, type-safe configuration system
 * that eliminates magic numbers and hardcoded values across services.
 */

import {
  TIME_CONSTANTS,
  CACHE_CONFIG,
  RATE_LIMITING,
  SECURITY_CONFIG,
  PERFORMANCE_THRESHOLDS,
  API_CONFIG,
  AI_CONFIG,
  TRADING_CONSTANTS,
} from '../constants/config';

// Re-export base constants for convenience
export {
  TIME_CONSTANTS,
  CACHE_CONFIG,
  RATE_LIMITING,
  SECURITY_CONFIG,
  PERFORMANCE_THRESHOLDS,
  API_CONFIG,
  AI_CONFIG,
  TRADING_CONSTANTS,
};

// ========== TOKEN & AUTH CONSTANTS ==========
export const TOKEN_CONSTANTS = {
  // Expiry times in seconds (for API compatibility)
  EXPIRY_SECONDS: {
    ONE_HOUR: 3600,
    FOUR_HOURS: 14400,
    EIGHT_HOURS: 28800,
    ONE_DAY: 86400,
    ONE_WEEK: 604800,
  },
  
  // Expiry times in milliseconds
  EXPIRY_MS: {
    ONE_HOUR: TIME_CONSTANTS.HOUR,
    FOUR_HOURS: 4 * TIME_CONSTANTS.HOUR,
    EIGHT_HOURS: 8 * TIME_CONSTANTS.HOUR,
    ONE_DAY: TIME_CONSTANTS.DAY,
    ONE_WEEK: TIME_CONSTANTS.WEEK,
  },
  
  // Default values
  DEFAULT_ACCESS_TOKEN_EXPIRY_S: 3600,
  DEFAULT_REFRESH_TOKEN_EXPIRY_S: 604800, // 1 week
  DEFAULT_SESSION_EXPIRY_MS: TIME_CONSTANTS.HOUR,
  
  // Refresh buffer - refresh token before it expires
  REFRESH_BUFFER_MS: 5 * TIME_CONSTANTS.MINUTE, // 5 minutes
} as const;

// ========== SIZE & LIMIT CONSTANTS ==========
export const SIZE_CONSTANTS = {
  // String lengths
  STRING: {
    TINY: 10,
    SHORT: 50,
    SMALL: 100,
    MEDIUM: 500,
    STANDARD: 1000,
    LONG: 2000,
    MAX: 10000,
  },
  
  // Hash/Key lengths
  HASH: {
    PREFIX: 8,
    SHORT: 16,
    MEDIUM: 32,
    STANDARD: 50,
    LONG: 100,
    EXTENDED: 200,
    MAX: 500,
    FULL: 1000,
  },
  
  // Cache key lengths
  CACHE_KEY: {
    SHORT: 100,
    MEDIUM: 500,
    LONG: 1000,
  },
  
  // Code/Content lengths
  CODE: {
    SNIPPET: 1000,
    SMALL: 5000,
    MEDIUM: 10000,
    LARGE: 50000,
    MAX: 100000,
  },
  
  // Display lengths
  DISPLAY: {
    TINY: 10,
    SHORT: 50,
    MEDIUM: 100,
    STANDARD: 200,
    LONG: 254,
    MAX: 2048,
  },

  // Substring operation lengths - Flexy-approved for consistent truncation
  SUBSTRING: {
    TINY: 10,           // Very short preview (e.g., IDs)
    SHORT: 50,          // Short preview (e.g., labels)
    MEDIUM: 100,        // Medium preview (e.g., cache keys)
    STANDARD: 200,      // Standard preview (e.g., descriptions)
    LONG: 500,          // Long preview (e.g., code snippets)
    EXTENDED: 1000,     // Extended content (e.g., error messages)
    FULL: 5000,         // Near-full content (e.g., large code blocks)
    MAX: 10000,         // Maximum safe truncation
  },
  
  // Memory sizes in bytes
  MEMORY: {
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TWO_MB: 2 * 1024 * 1024,
    FIVE_MB: 5 * 1024 * 1024,
    TEN_MB: 10 * 1024 * 1024,
    TWENTY_MB: 20 * 1024 * 1024,
    FIFTY_MB: 50 * 1024 * 1024,
    HUNDRED_MB: 100 * 1024 * 1024,
  },
  
  // File sizes
  FILE: {
    SMALL: 50 * 1024,        // 50KB
    MEDIUM: 500 * 1024,      // 500KB
    LARGE: 1024 * 1024,      // 1MB
    MAX: 50 * 1024 * 1024,   // 50MB
  },
} as const;

// ========== THRESHOLD CONSTANTS ==========
export const THRESHOLD_CONSTANTS = {
  // Performance thresholds in milliseconds
  PERFORMANCE: {
    EXCELLENT: 200,
    GOOD: 500,
    NEEDS_IMPROVEMENT: 1000,
    POOR: 2000,
    CRITICAL: 3000,
  },
  
  // Query execution time
  QUERY: {
    FAST: 100,
    NORMAL: 500,
    SLOW: 1000,
    CRITICAL: 2000,
  },
  
  // Memory thresholds
  MEMORY: {
    WARNING_MB: 50,
    CRITICAL_MB: 100,
    CLEANUP_PERCENT: 80, // 80%
  },
  
  // API response time
  API: {
    FAST: 200,
    GOOD: 500,
    SLOW: 1000,
    TIMEOUT: 5000,
  },
  
  // Error rate thresholds
  ERROR_RATE: {
    ACCEPTABLE: 0.01,  // 1%
    WARNING: 0.05,     // 5%
    CRITICAL: 0.10,    // 10%
  },
  
  // Cache hit rate
  CACHE_HIT_RATE: {
    POOR: 0.5,         // 50%
    ACCEPTABLE: 0.7,   // 70%
    GOOD: 0.8,         // 80%
    EXCELLENT: 0.9,    // 90%
  },
} as const;

// ========== COUNT/LIMIT CONSTANTS ==========
export const COUNT_CONSTANTS = {
  // Pagination
  PAGINATION: {
    DEFAULT: 20,
    SMALL: 10,
    MEDIUM: 50,
    LARGE: 100,
    MAX: 1000,
  },
  
  // Batch operations
  BATCH: {
    TINY: 5,
    SMALL: 10,
    DEFAULT: 20,
    LARGE: 50,
    MAX: 100,
  },
  
  // Retry attempts
  RETRY: {
    MIN: 1,
    DEFAULT: 3,
    MAX: 5,
    EXTENDED: 10,
  },
  
  // History/metrics sizes
  HISTORY: {
    TINY: 10,
    SMALL: 50,
    STANDARD: 100,
    LARGE: 500,
    MAX: 1000,
  },
  
  // Cache entries
  CACHE: {
    SMALL: 100,
    MEDIUM: 500,
    LARGE: 1000,
    MAX: 5000,
  },
  
  // Alerts/Errors
  ALERTS: {
    RECENT: 10,
    STANDARD: 50,
    MAX: 100,
  },
} as const;

// ========== MULTIPLIER/DIVISOR CONSTANTS ==========
export const MATH_CONSTANTS = {
  // Time conversions
  TIME: {
    MS_PER_SECOND: 1000,
    MS_PER_MINUTE: 60 * 1000,
    MS_PER_HOUR: 60 * 60 * 1000,
    MS_PER_DAY: 24 * 60 * 60 * 1000,
    SECONDS_PER_MINUTE: 60,
    MINUTES_PER_HOUR: 60,
    HOURS_PER_DAY: 24,
    DAYS_PER_WEEK: 7,
  },
  
  // Size conversions
  SIZE: {
    BYTES_PER_KB: 1024,
    BYTES_PER_MB: 1024 * 1024,
    BYTES_PER_GB: 1024 * 1024 * 1024,
    KB_PER_MB: 1024,
    MB_PER_GB: 1024,
  },
  
  // Percentage
  PERCENTAGE: {
    MIN: 0,
    MAX: 100,
    DECIMAL: 100,
    HALF: 50,
  },
  
  // Scoring
  SCORE: {
    MIN: 0,
    MAX: 100,
    DEFAULT: 100,
    EXCELLENT: 80,
    GOOD: 60,
    PASS: 50,
  },
} as const;

// ========== DELAY/STAGGER CONSTANTS ==========
export const DELAY_CONSTANTS = {
  // Micro delays
  MICRO: 10,
  TINY: 50,
  SHORT: 100,
  
  // Standard delays
  DEFAULT: 100,
  NORMAL: 500,
  MEDIUM: 1000,
  LONG: 2000,
  EXTENDED: 5000,
  
  // Specific use cases
  STAGGER: {
    IMPORT: 1000,
    HEALTH_CHECK: 2000,
    WARMUP: 2000,
    RETRY_BASE: 1000,
    RETRY_MAX: 5000,
  },
  
  // Polling intervals
  POLLING: {
    FAST: 1000,
    NORMAL: 5000,
    SLOW: 10000,
    VERY_SLOW: 30000,
    MINUTE: 60000,
  },
  
  // UI delays
  UI: {
    TOAST: 3000,
    COPY_FEEDBACK: 2000,
    FADE_TRANSITION: 300,
    ANIMATION: 1000,
    ANIMATION_SLOW: 1500,
  },
} as const;

// ========== HTTP STATUS CONSTANTS ==========
export const HTTP_CONSTANTS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  // Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  
  // Server errors
  SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  
  // Ranges
  CLIENT_ERROR_RANGE: { MIN: 400, MAX: 499 },
  SERVER_ERROR_RANGE: { MIN: 500, MAX: 599 },
} as const;

// ========== SUPABASE ERROR CODES ==========
export const SUPABASE_ERRORS = {
  // Connection
  CONNECTION_ERROR: '1014',
  
  // Not found
  RECORD_NOT_FOUND: 'PGRST116',
  
  // Permission
  PERMISSION_DENIED: 'PGRST301',
  INSUFFICIENT_PRIVILEGE: '42501',
  
  // Data integrity
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  
  // Edge-specific
  EDGE_FUNCTION_TIMEOUT: 'EDGE_FUNCTION_TIMEOUT',
  EDGE_MEMORY_LIMIT: 'EDGE_MEMORY_LIMIT',
  EDGE_RATE_LIMIT: 'EDGE_RATE_LIMIT',
  
  // All non-retryable errors
  NON_RETRYABLE: [
    'PGRST116',
    'PGRST301',
    '42501',
    '23505',
    '23503',
  ],
} as const;

// ========== WEB VITALS CONSTANTS ==========
export const WEB_VITALS = {
  LCP: {
    GOOD: 2500,
    NEEDS_IMPROVEMENT: 4000,
    POOR: 6000,
  },
  FCP: {
    GOOD: 1800,
    NEEDS_IMPROVEMENT: 3000,
    POOR: 4500,
  },
  FID: {
    GOOD: 100,
    NEEDS_IMPROVEMENT: 300,
    POOR: 500,
  },
  INP: {
    GOOD: 200,
    NEEDS_IMPROVEMENT: 500,
    POOR: 800,
  },
  CLS: {
    GOOD: 0.1,
    NEEDS_IMPROVEMENT: 0.25,
    POOR: 0.5,
  },
  TTFB: {
    GOOD: 800,
    NEEDS_IMPROVEMENT: 1800,
    POOR: 3000,
  },
} as const;

// ========== TRADING CONSTANTS ==========
export const TRADING_DEFAULTS = {
  SYMBOL: 'EURUSD',
  TIMEFRAME: 'H1',
  RISK: {
    MIN_PERCENT: 0.01,
    MAX_PERCENT: 100,
    DEFAULT_PERCENT: 2,
  },
  STOP_LOSS: {
    MIN_PIPS: 1,
    MAX_PIPS: 1000,
    DEFAULT_PIPS: 50,
  },
  TAKE_PROFIT: {
    MIN_PIPS: 1,
    MAX_PIPS: 1000,
    DEFAULT_PIPS: 100,
  },
  DEPOSIT: {
    MIN: 100,
    MAX: 10000000,
    DEFAULT: 10000,
  },
  LEVERAGE: {
    MIN: 1,
    MAX: 1000,
    DEFAULT: 100,
  },
  MAGIC_NUMBER: {
    MIN: 1,
    MAX: 999999,
    DEFAULT: 123456,
  },
  BACKTEST: {
    MIN_DAYS: 1,
    MAX_DAYS: 365,
    DEFAULT_DAYS: 30,
    MAX_SIMULATION_DAYS: 3650, // 10 years
  },
  TIMEFRAMES: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'],
} as const;

// ========== SECURITY RISK SCORING CONSTANTS ==========
export const SECURITY_RISK_SCORES = {
  // Base severity scores for threat detection
  SEVERITY: {
    CRITICAL: 50,
    HIGH: 30,
    MEDIUM: 20,
    LOW: 10,
  },

  // Specific threat type scores
  THREATS: {
    // SQL Injection related
    SQL_INJECTION: 50,
    SQL_CHARACTERS: 20,

    // XSS related
    SCRIPT_INJECTION: 50,
    EVENT_HANDLER_INJECTION: 30,
    JAVASCRIPT_PROTOCOL: 30,

    // Path/Command Injection
    PATH_TRAVERSAL: 30,
    COMMAND_INJECTION: 50,

    // DoS related
    POTENTIAL_DOS: 20,

    // User agent related
    SUSPICIOUS_USER_AGENT: 25,

    // Pattern detection errors
    PATTERN_DETECTION_ERROR: 10,
  },

  // Input validation scores
  INPUT_VALIDATION: {
    ROBOT_NAME_INVALID: 50,
    ROBOT_NAME_SUSPICIOUS: 30,
    ROBOT_NAME_PATH_TRAVERSAL: 40,
    STRATEGY_TYPE_INVALID: 20,
    STRATEGY_TYPE_SUSPICIOUS: 20,
    BACKTEST_PARAMS_INVALID: 20,
    USER_ID_INVALID: 20,
    USER_ID_MALICIOUS: 30,
    CODE_LENGTH_EXCEEDED: 10,
    PARAMS_LENGTH_EXCEEDED: 10,
    ROBOT_NAME_LENGTH_EXCEEDED: 15,
  },

  // Security manager scores
  SECURITY_MANAGER: {
    PAYLOAD_TOO_LARGE: 50,
    PAYLOAD_STRUCTURE_INVALID: 30,
    PAYLOAD_DEPTH_EXCEEDED: 40,
    XSS_DETECTED: 30,
    SQL_INJECTION_DETECTED: 30,
    NO_SQL_INJECTION_DETECTED: 30,
    COMMAND_INJECTION_DETECTED: 30,
    PATH_TRAVERSAL_DETECTED: 30,
    SPECIAL_CHARS_EXCESSIVE: 10,
    SUSPICIOUS_PATTERN_LENGTH: 10,
    SUSPICIOUS_PATTERN_STRUCTURE: 10,
    PROTOTYPE_POLLUTION: 100,
  },

  // Risk thresholds
  THRESHOLDS: {
    MALICIOUS: 30,       // Score >= 30 is considered malicious
    HIGH_RISK: 50,       // Score >= 50 is high risk
    SUSPICIOUS: 20,      // Score >= 20 is suspicious
    LOW_RISK: 10,        // Score >= 10 is low risk
  },

  // Max possible score for normalization
  MAX_SCORE: 100,
} as const;

// ========== ADJUSTMENT & MULTIPLIER CONSTANTS ==========
export const ADJUSTMENT_FACTORS = {
  // Moving average weights
  MOVING_AVERAGE: {
    HISTORY_WEIGHT: 0.9,  // Weight for historical value
    NEW_WEIGHT: 0.1,      // Weight for new value
  },
  
  // Jitter for randomized delays
  JITTER: {
    MIN: 0.5,             // Minimum jitter multiplier
    MAX: 1.0,             // Maximum jitter multiplier (0.5 + 0.5)
    RANGE: 0.5,           // Random range (Math.random() * 0.5)
  },
  
  // TTL multipliers for cache adjustments
  TTL: {
    DECREASE_SMALL: 0.5,   // Halve TTL
    DECREASE_MEDIUM: 0.7,  // 30% reduction
    DECREASE_LARGE: 0.8,   // 20% reduction
    INCREASE_SMALL: 1.2,   // 20% increase
    INCREASE_MEDIUM: 1.5,  // 50% increase
    ROBOTS_MULTIPLIER: 1.5, // Robots list TTL boost
    MARKET_MULTIPLIER: 0.5, // Market data TTL reduction
    SESSION_MULTIPLIER: 0.8, // Session TTL reduction
  },
  
  // Degraded mode levels
  DEGRADED_MODE: {
    LIGHT: 0.5,   // 50% capacity
    MODERATE: 0.75, // 75% capacity
    SEVERE: 0.25,   // 25% capacity
  },
  
  // Backoff multipliers
  BACKOFF: {
    GENTLE: 1.5,   // Gentler backoff
    STANDARD: 2.0, // Standard exponential backoff
    AGGRESSIVE: 3.0, // Aggressive backoff
  },
  
  // Percentiles for statistical analysis
  PERCENTILES: {
    P50: 0.5,  // Median
    P75: 0.75, // 75th percentile
    P90: 0.9,  // 90th percentile
    P95: 0.95, // 95th percentile
    P99: 0.99, // 99th percentile
  },
  
  // AI service multipliers
  AI: {
    ANALYSIS_WEIGHT: 0.5,    // Analysis counts as half request
    IMPORTANCE_BOOST: 0.5,   // Importance score boost
    TRUNCATION_RATIO: 0.7,   // Use 70% of available space
    IMPROVEMENT_ESTIMATE: 0.9, // Assume 10% improvement
  },
  
  // Performance thresholds
  PERFORMANCE: {
    COLD_START_THRESHOLD: 0.9,  // 90% memory usage critical
    EFFICIENCY_BASELINE: 10,    // 10ms per request baseline
    HEALTH_CHECK_UNHEALTHY: 0.5, // 50% unhealthy threshold
    WARMUP_INTERVAL_REDUCTION: 0.75, // Reduce warmup by 25%
  },
  
  // Cache eviction
  EVICTION: {
    STALE_THRESHOLD: 0.5,  // Allow 50% past TTL
    TARGET_SIZE: 0.8,      // Evict to 80% capacity
    COMPRESSION_THRESHOLD: 0.8, // Reduce threshold by 20%
  },
} as const;

// ========== EXTERNAL RESOURCE URLS ==========
export const EXTERNAL_RESOURCES = {
  // Font services
  FONTS: {
    GOOGLE_FONTS_BASE: 'https://fonts.googleapis.com',
    GOOGLE_FONTS_STATIC: 'https://fonts.gstatic.com',
    INTER_FONT_URL: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    INTER_FONT_PRELOAD: 'https://fonts.gstatic.com/s/inter/v18/UcCo3FwrK3iLTcviYwY.woff2',
  },
  
  // API endpoints
  APIs: {
    GEMINI: 'https://generativelanguage.googleapis.com',
    SUPABASE: 'https://*.supabase.co',
    TWELVE_DATA: 'https://ws.twelvedata.com',
    BINANCE_WS: 'wss://stream.binance.com:9443/ws',
  },
  
  // CDN resources
  CDN: {
    JSDELIVR: 'https://cdn.jsdelivr.net',
    UNPKG: 'https://unpkg.com',
    GOOGLE_ANALYTICS: 'https://www.google-analytics.com',
  },
  
  // Domain configurations
  DOMAINS: {
    PRODUCTION: 'https://quanforge.ai',
    PRODUCTION_WWW: 'https://www.quanforge.ai',
  },
  
  // Allowed protocols
  PROTOCOLS: {
    SECURE: ['https:', 'wss:'],
    STANDARD: ['http:', 'https:'],
    WEBSOCKET: ['ws:', 'wss:'],
  },
} as const;

// ========== FONT CONFIGURATION ==========
export const FONT_CONFIG = {
  FAMILY: {
    PRIMARY: 'Inter',
    FALLBACK: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  WEIGHTS: {
    REGULAR: 400,
    MEDIUM: 500,
    SEMIBOLD: 600,
    BOLD: 700,
  },
  DISPLAY: 'swap',
} as const;

// ========== MODULAR EXPORTS ==========
// Grouped exports for specific use cases

export const AuthConstants = {
  TOKEN: TOKEN_CONSTANTS,
  SECURITY: SECURITY_CONFIG,
} as const;

export const CacheConstants = {
  CONFIG: CACHE_CONFIG,
  SIZE: SIZE_CONSTANTS.MEMORY,
  COUNT: COUNT_CONSTANTS.CACHE,
  THRESHOLD: THRESHOLD_CONSTANTS.CACHE_HIT_RATE,
} as const;

export const PerformanceConstants = {
  THRESHOLDS: THRESHOLD_CONSTANTS.PERFORMANCE,
  QUERY: THRESHOLD_CONSTANTS.QUERY,
  MEMORY: THRESHOLD_CONSTANTS.MEMORY,
  API: THRESHOLD_CONSTANTS.API,
  WEB_VITALS,
} as const;

export const ApiConstants = {
  HTTP: HTTP_CONSTANTS,
  TIMEOUT: API_CONFIG,
  RETRY: COUNT_CONSTANTS.RETRY,
  PAGINATION: COUNT_CONSTANTS.PAGINATION,
} as const;

export const DatabaseConstants = {
  ERRORS: SUPABASE_ERRORS,
  BATCH: COUNT_CONSTANTS.BATCH,
  HISTORY: COUNT_CONSTANTS.HISTORY,
} as const;

export const UiConstants = {
  DELAY: DELAY_CONSTANTS,
  SIZE: SIZE_CONSTANTS.DISPLAY,
  STRING: SIZE_CONSTANTS.STRING,
  FONT: FONT_CONFIG,
} as const;

export const AdjustmentConstants = {
  FACTORS: ADJUSTMENT_FACTORS,
  MOVING_AVERAGE: ADJUSTMENT_FACTORS.MOVING_AVERAGE,
  JITTER: ADJUSTMENT_FACTORS.JITTER,
  TTL: ADJUSTMENT_FACTORS.TTL,
  DEGRADED_MODE: ADJUSTMENT_FACTORS.DEGRADED_MODE,
  BACKOFF: ADJUSTMENT_FACTORS.BACKOFF,
  PERCENTILES: ADJUSTMENT_FACTORS.PERCENTILES,
  AI: ADJUSTMENT_FACTORS.AI,
} as const;

export const ResourceConstants = {
  EXTERNAL: EXTERNAL_RESOURCES,
  FONTS: EXTERNAL_RESOURCES.FONTS,
  APIs: EXTERNAL_RESOURCES.APIs,
  CDN: EXTERNAL_RESOURCES.CDN,
  DOMAINS: EXTERNAL_RESOURCES.DOMAINS,
} as const;

export const SecurityConstants = {
  RISK: SECURITY_RISK_SCORES,
  SEVERITY: SECURITY_RISK_SCORES.SEVERITY,
  THREATS: SECURITY_RISK_SCORES.THREATS,
  INPUT: SECURITY_RISK_SCORES.INPUT_VALIDATION,
  MANAGER: SECURITY_RISK_SCORES.SECURITY_MANAGER,
  THRESHOLDS: SECURITY_RISK_SCORES.THRESHOLDS,
} as const;

// ========== CONCURRENCY LIMITS (Flexy-approved! No hardcoded values) ==========
export const CONCURRENCY_LIMITS = {
  REQUESTS: {
    DEFAULT: 6,
    MIN: 1,
    MAX: 20,
    HIGH: 10,
    LOW: 3,
  },
  CONNECTIONS: {
    MIN: 1,
    DEFAULT: 2,
    MAX: 10,
    EDGE_MIN: 1,
    EDGE_MAX: 4,
  },
  WORKERS: {
    MIN: 1,
    DEFAULT: 4,
    MAX: 8,
  },
} as const;

// ========== ATTEMPT LIMITS (Flexy-approved! No hardcoded values) ==========
export const ATTEMPT_LIMITS = {
  RETRY: {
    MIN: 1,
    DEFAULT: 3,
    MAX: 5,
    EXTENDED: 10,
  },
  CONNECTION: {
    MIN: 1,
    DEFAULT: 3,
    MAX: 10,
  },
  HEALTH_CHECK: {
    MIN: 1,
    DEFAULT: 3,
    MAX: 5,
  },
} as const;

// ========== SAFE REGEX CONFIGURATION (Flexy-approved! No hardcoded values) ==========
export const SAFE_REGEX_CONFIG = {
  PATTERN: {
    MAX_LENGTH: 200,
    MAX_SPECIAL_CHARS: 20,
    MAX_QUANTIFIER_DEPTH: 3,
  },
  TIMEOUT_MS: 100,
  INPUT: {
    MAX_LENGTH: 500,
    MAX_TEXT_LENGTH: 10000,
  },
  COMPLEXITY: {
    MAX_ESTIMATED_COMPLEXITY: 1000000,
    SCORE_PER_LENGTH: 1,
    SCORE_PER_QUANTIFIER: 10,
    SCORE_PER_GROUP: 5,
    SCORE_PER_ALTERNATION: 20,
    SCORE_PER_NESTED_GROUP: 50,
  },
} as const;

// ========== EDGE POOL CONFIGURATION (Flexy-approved! No hardcoded values) ==========
export const EDGE_POOL_CONFIG = {
  // Health check intervals (ms)
  HEALTH_CHECK: {
    INTERVAL_MS: 15000,           // 15 seconds for reduced overhead
    FAST_INTERVAL_MS: 10000,      // 10 seconds for high reliability
    SLOW_INTERVAL_MS: 30000,      // 30 seconds for low traffic
  },
  
  // Connection timeouts (ms)
  TIMEOUT: {
    CONNECTION_MS: 1500,          // 1.5 seconds for better edge reliability
    HEALTH_CHECK_MS: 2000,        // 2 seconds for health checks
    FAST_MS: 800,                 // 0.8 seconds for fast connections
    STANDARD_MS: 5000,            // 5 seconds standard timeout
  },
  
  // Client cache configuration
  CACHE: {
    TTL_MS: 60000,                // 60 seconds - optimized for edge performance
    MAX_ENTRIES: 100,             // Maximum cached clients
  },
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_MULTIPLIER: 2,
  },
} as const;

// ========== SECURITY REGIONS & PATTERNS (Flexy-approved! No hardcoded values) ==========
export const SECURITY_REGIONS = {
  // Blocked regions (ISO country codes)
  BLOCKED: ['CN', 'RU', 'IR', 'KP'],
  
  // High-risk regions requiring additional verification
  HIGH_RISK: ['BY', 'VE', 'SY', 'AF'],
  
  // Trusted regions with relaxed security
  TRUSTED: ['US', 'CA', 'GB', 'DE', 'FR', 'AU', 'JP', 'SG'],
} as const;

export const SECURITY_PATTERNS = {
  // Bot detection patterns
  BOT_PATTERNS: [
    'sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster',
    'wfuzz', 'burp', 'owasp', 'scanner', 'bot', 'crawler', 'spider'
  ],
  
  // Suspicious user agent patterns (regex strings for flexibility)
  SUSPICIOUS_USER_AGENTS: [
    'sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster',
    'wfuzz', 'burp', 'owasp', 'scanner', 'bot', 'crawler', 'spider',
    'scrape', 'scraping', 'harvest', 'harvester'
  ],
  
  // Code injection patterns (for prompt validation)
  CODE_INJECTION: {
    EVAL: 'eval\\s*\\(',
    FUNCTION_CONSTRUCTOR: 'function\\s*\\(',
    DOCUMENT_ACCESS: 'document\\.',
    WINDOW_ACCESS: 'window\\.',
    LOCAL_STORAGE: 'localStorage',
    SESSION_STORAGE: 'sessionStorage',
    COOKIE_ACCESS: 'cookie',
    LOCATION_ACCESS: 'location\\.',
    NAVIGATOR_ACCESS: 'navigator\\.',
  },
} as const;

// ========== INPUT VALIDATION CONSTANTS (Flexy-approved! No hardcoded values) ==========
export const INPUT_VALIDATION = {
  // Prompt length limits
  PROMPT: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 10000,
    DEFAULT_MAX_TOKENS: 4000,
  },
  
  // Rate limit display
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 10,
    DISPLAY_WAIT_TIME_MINUTES: true,
  },
  
  // Security sanitization
  SANITIZATION: {
    MAX_LENGTH_MULTIPLIER: 10,    // Multiplier for cache size calculations
    FORBIDDEN_CHARS: '<>',        // Characters to strip from suspicious content
  },
} as const;

// ========== EDGE CACHE CONFIGURATION (Flexy-approved! No hardcoded values) ==========
export const EDGE_CACHE_CONSTANTS = {
  // Size limits (bytes)
  SIZE: {
    PERSISTENT_MAX: 75 * 1024 * 1024,     // 75MB persistent cache
    PERSISTENT_MAX_ENTRIES: 3000,         // Maximum entries in persistent cache
    DEFAULT_MAX: 10 * 1024 * 1024,        // 10MB default cache
  },
  
  // TTL ranges (ms)
  TTL: {
    MIN: 5 * 60 * 1000,                   // 5 minutes minimum
    MAX: 2 * 60 * 60 * 1000,              // 2 hours maximum
    DEFAULT: 5 * 60 * 1000,               // 5 minutes default
  },
  
  // Compression
  COMPRESSION: {
    ENABLED: true,
    THRESHOLD: 1024,                      // 1KB threshold
  },
  
  // Cleanup
  CLEANUP: {
    STAGGER_DELAY_MS: 50,                 // 50ms stagger delay
    EVICTION_BATCH_SIZE: 100,             // Batch size for eviction
  },
} as const;

// ========== DEFAULT EXPORT ==========
export const ModularConstants = {
  TIME: TIME_CONSTANTS,
  TOKEN: TOKEN_CONSTANTS,
  SIZE: SIZE_CONSTANTS,
  THRESHOLD: THRESHOLD_CONSTANTS,
  COUNT: COUNT_CONSTANTS,
  MATH: MATH_CONSTANTS,
  DELAY: DELAY_CONSTANTS,
  HTTP: HTTP_CONSTANTS,
  SUPABASE: SUPABASE_ERRORS,
  WEB_VITALS,
  TRADING: TRADING_DEFAULTS,
  ADJUSTMENT: ADJUSTMENT_FACTORS,
  RESOURCES: EXTERNAL_RESOURCES,
  FONT: FONT_CONFIG,
  SECURITY: SECURITY_RISK_SCORES,
  Auth: AuthConstants,
  Cache: CacheConstants,
  Performance: PerformanceConstants,
  Api: ApiConstants,
  Database: DatabaseConstants,
  Ui: UiConstants,
  Adjustment: AdjustmentConstants,
  Resource: ResourceConstants,
  Security: SecurityConstants,
  CONCURRENCY: CONCURRENCY_LIMITS,
  ATTEMPTS: ATTEMPT_LIMITS,
  SAFE_REGEX: SAFE_REGEX_CONFIG,
  EDGE_POOL: EDGE_POOL_CONFIG,
  REGIONS: SECURITY_REGIONS,
  PATTERNS: SECURITY_PATTERNS,
  INPUT: INPUT_VALIDATION,
  EDGE_CACHE: EDGE_CACHE_CONSTANTS,
} as const;

export default ModularConstants;
