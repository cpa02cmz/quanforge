/**
 * Modular Service Configuration
 * Flexy's modular configuration system - No more hardcoded values! 🎯
 * 
 * This module provides centralized, type-safe configuration for all services.
 * All hardcoded magic numbers are extracted here for maintainability.
 */

// Flexy's Modular Configuration System
// No hardcoded values allowed! 🎯

// ========== WEBSOCKET CONFIGURATION ==========
export const WEBSOCKET_CONFIG = {
  // Reconnection settings
  RECONNECT: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 30000,
    JITTER_MAX_MS: 1000,
  },
  
  // Heartbeat configuration
  HEARTBEAT: {
    INTERVAL_MS: 30000,
    TIMEOUT_MS: 10000,
  },
  
  // Connection timeouts
  TIMEOUT: {
    CONNECTION: 10000,
    READ: 30000,
    OVERALL: 30000,
  },
  
  // Binance specific
  BINANCE: {
    URL: 'wss://stream.binance.com:9443/ws',
    RECONNECT_DELAY_BASE: 1000,
    MAX_RECONNECT_DELAY: 30000,
  },
  
  // Twelve Data specific
  TWELVE_DATA: {
    URL: 'wss://ws.twelvedata.com/v1/quotes',
    RECONNECT_DELAY_BASE: 1000,
    MAX_RECONNECT_DELAY: 30000,
  },
} as const;

// ========== CACHE SIZE CONFIGURATION ==========
export const CACHE_SIZES = {
  // Memory limits in bytes
  TINY: 1 * 1024 * 1024,      // 1MB
  SMALL: 2 * 1024 * 1024,     // 2MB
  MEDIUM: 5 * 1024 * 1024,    // 5MB
  LARGE: 10 * 1024 * 1024,    // 10MB
  XLARGE: 20 * 1024 * 1024,   // 20MB
  MAX: 50 * 1024 * 1024,      // 50MB
  
  // Entry limits
  ENTRIES: {
    TINY: 50,
    SMALL: 100,
    MEDIUM: 500,
    LARGE: 1000,
    XLARGE: 2000,
  },
  
  // Specific service sizes
  SERVICES: {
    SECURITY: 1 * 1024 * 1024,    // 1MB
    SETTINGS: 1 * 1024 * 1024,    // 1MB
    CACHE: 4 * 1024 * 1024,       // 4MB
    ANALYTICS: 8 * 1024 * 1024,   // 8MB
    MARKET: 20 * 1024 * 1024,     // 20MB
  },
} as const;

// ========== SERVICE TIMEOUT CONFIGURATION ==========
export const SERVICE_TIMEOUTS = {
  // Quick operations
  QUICK: 1000,        // 1 second
  SHORT: 5000,        // 5 seconds
  STANDARD: 10000,    // 10 seconds
  MEDIUM: 30000,      // 30 seconds
  LONG: 60000,        // 1 minute
  EXTENDED: 120000,   // 2 minutes
  
  // Specific service timeouts
  SERVICES: {
    // Database
    DB_CONNECTION: 5000,
    DB_QUERY: 30000,
    DB_HEALTH_CHECK: 10000,
    
    // AI/ML
    AI_GENERATION: 60000,
    AI_ANALYSIS: 30000,
    AI_WORKER: 30000,
    
    // External APIs
    MARKET_DATA: 30000,
    EXTERNAL_API: 30000,
    
    // Cache
    CACHE_OPERATION: 5000,
    CACHE_WARMUP: 2000,
    
    // Health checks
    HEALTH_CHECK: 5000,
    HEALTH_CHECK_SLOW: 30000,
  },
} as const;

// ========== RETRY CONFIGURATION ==========
export const RETRY_CONFIGS = {
  // Standard retry policy
  STANDARD: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 10000,
    BACKOFF_MULTIPLIER: 2,
    USE_JITTER: true,
  },
  
  // Aggressive retry for critical paths
  AGGRESSIVE: {
    MAX_ATTEMPTS: 5,
    BASE_DELAY_MS: 500,
    MAX_DELAY_MS: 30000,
    BACKOFF_MULTIPLIER: 2,
    USE_JITTER: true,
  },
  
  // Conservative retry for external APIs
  CONSERVATIVE: {
    MAX_ATTEMPTS: 2,
    BASE_DELAY_MS: 2000,
    MAX_DELAY_MS: 15000,
    BACKOFF_MULTIPLIER: 2,
    USE_JITTER: true,
  },
  
  // Service-specific retry configs
  SERVICES: {
    DATABASE: {
      MAX_ATTEMPTS: 3,
      BASE_DELAY_MS: 500,
      MAX_DELAY_MS: 5000,
      BACKOFF_MULTIPLIER: 2,
    },
    AI_SERVICE: {
      MAX_ATTEMPTS: 3,
      BASE_DELAY_MS: 1000,
      MAX_DELAY_MS: 10000,
      BACKOFF_MULTIPLIER: 2,
    },
    MARKET_DATA: {
      MAX_ATTEMPTS: 3,
      BASE_DELAY_MS: 1000,
      MAX_DELAY_MS: 30000,
      BACKOFF_MULTIPLIER: 2,
    },
  },
} as const;

// ========== CIRCUIT BREAKER CONFIGURATION ==========
export const CIRCUIT_BREAKER_CONFIGS = {
  // Default configuration
  DEFAULT: {
    FAILURE_THRESHOLD: 3,
    SUCCESS_THRESHOLD: 3,
    RESET_TIMEOUT_MS: 60000,  // 1 minute
    HALF_OPEN_MAX_CALLS: 5,
    TIMEOUT_MS: 30000,
  },
  
  // Service-specific configurations
  SERVICES: {
    DATABASE: {
      FAILURE_THRESHOLD: 3,
      SUCCESS_THRESHOLD: 3,
      RESET_TIMEOUT_MS: 60000,
      HALF_OPEN_MAX_CALLS: 5,
      TIMEOUT_MS: 30000,
    },
    AI_SERVICE: {
      FAILURE_THRESHOLD: 3,
      SUCCESS_THRESHOLD: 3,
      RESET_TIMEOUT_MS: 30000,
      HALF_OPEN_MAX_CALLS: 3,
      TIMEOUT_MS: 60000,
    },
    MARKET_DATA: {
      FAILURE_THRESHOLD: 3,
      SUCCESS_THRESHOLD: 3,
      RESET_TIMEOUT_MS: 60000,
      HALF_OPEN_MAX_CALLS: 5,
      TIMEOUT_MS: 30000,
    },
    CACHE: {
      FAILURE_THRESHOLD: 3,
      SUCCESS_THRESHOLD: 3,
      RESET_TIMEOUT_MS: 30000,
      HALF_OPEN_MAX_CALLS: 5,
      TIMEOUT_MS: 30000,
    },
    EXTERNAL_API: {
      FAILURE_THRESHOLD: 5,
      SUCCESS_THRESHOLD: 3,
      RESET_TIMEOUT_MS: 120000,
      HALF_OPEN_MAX_CALLS: 3,
      TIMEOUT_MS: 60000,
    },
  },
} as const;

// ========== MONITORING INTERVALS ==========
export const MONITORING_INTERVALS = {
  // Health check intervals
  HEALTH_CHECK: {
    FAST: 5000,       // 5 seconds
    NORMAL: 10000,    // 10 seconds
    SLOW: 30000,      // 30 seconds
    VERY_SLOW: 60000, // 1 minute
  },
  
  // Cleanup intervals
  CLEANUP: {
    FAST: 15000,      // 15 seconds
    NORMAL: 30000,    // 30 seconds
    SLOW: 60000,      // 1 minute
    VERY_SLOW: 300000, // 5 minutes
  },
  
  // Metrics collection
  METRICS: {
    FLUSH: 30000,     // 30 seconds
    COLLECTION: 10000, // 10 seconds
    BATCH_SIZE: 100,
  },
  
  // Cache warming
  CACHE_WARMUP: {
    INTERVAL: 1800000,  // 30 minutes
    CHECK_INTERVAL: 300000, // 5 minutes
  },
} as const;

// ========== POOL CONFIGURATION ==========
export const POOL_CONFIGS = {
  // Connection pool settings
  CONNECTION: {
    MIN_CONNECTIONS: 1,
    MAX_CONNECTIONS: 4,
    ACQUIRE_TIMEOUT: 1000,
    IDLE_TIMEOUT: 180000,  // 3 minutes
    HEALTH_CHECK_INTERVAL: 30000,  // 30 seconds
    RETRY_DELAY: 500,
    MAX_RETRY_ATTEMPTS: 2,
  },
  
  // Scoring weights for pool selection
  SCORING: {
    REGION_MATCH_BONUS: 2000,
    HEALTHY_BONUS: 500,
    RECENT_USE_PENALTY: 200,
    LATENCY_MULTIPLIER: 1000,
    MAX_LATENCY_PENALTY: 1000,
  },
  
  // Thresholds
  THRESHOLDS: {
    RECENT_USAGE_MS: 30000,  // 30 seconds
    COLD_START_MS: 500,      // 0.5 seconds
    CONNECTION_AGE_MS: 60000, // 1 minute
  },
} as const;

// ========== RATE LIMITING CONFIGURATION ==========
export const RATE_LIMITS = {
  // Default settings
  DEFAULT: {
    WINDOW_MS: 60000,  // 1 minute
    MAX_REQUESTS: 100,
  },
  
  // User tiers
  TIERS: {
    BASIC: {
      WINDOW_MS: 60000,
      MAX_REQUESTS: 30,
    },
    STANDARD: {
      WINDOW_MS: 60000,
      MAX_REQUESTS: 100,
    },
    PREMIUM: {
      WINDOW_MS: 60000,
      MAX_REQUESTS: 500,
    },
    ENTERPRISE: {
      WINDOW_MS: 60000,
      MAX_REQUESTS: 2000,
    },
  },
  
  // Specific services
  SERVICES: {
    AI_GENERATION: {
      WINDOW_MS: 60000,
      MAX_REQUESTS: 20,
    },
    MARKET_DATA: {
      WINDOW_MS: 60000,
      MAX_REQUESTS: 60,
    },
    DATABASE: {
      WINDOW_MS: 60000,
      MAX_REQUESTS: 200,
    },
  },
} as const;

// ========== VALIDATION LIMITS ==========
export const VALIDATION_LIMITS = {
  // String lengths
  STRING: {
    MIN: 1,
    SHORT: 50,
    MEDIUM: 100,
    LONG: 255,
    MAX: 1000,
    TEXT_AREA: 10000,
    CODE: 1000000,
  },
  
  // Numeric ranges
  NUMERIC: {
    RISK_PERCENT: { MIN: 0.01, MAX: 100, DEFAULT: 2 },
    STOP_LOSS_PIPS: { MIN: 1, MAX: 1000, DEFAULT: 50 },
    TAKE_PROFIT_PIPS: { MIN: 1, MAX: 1000, DEFAULT: 100 },
    MAGIC_NUMBER: { MIN: 1, MAX: 999999, DEFAULT: 123456 },
    INITIAL_DEPOSIT: { MIN: 100, MAX: 10000000, DEFAULT: 10000 },
    LEVERAGE: { MIN: 1, MAX: 1000, DEFAULT: 100 },
    BACKTEST_DURATION: { MIN: 1, MAX: 365, DEFAULT: 30 },
  },
  
  // File uploads
  FILE: {
    MAX_SIZE: 10 * 1024 * 1024,  // 10MB
    ALLOWED_TYPES: ['.json', '.csv', '.txt', '.mq5'],
  },
  
  // API/Payload
  PAYLOAD: {
    MAX_SIZE: 5 * 1024 * 1024,   // 5MB
    MAX_INPUT_LENGTH: 10000,
  },
  
  // Trading strategy defaults
  STRATEGY: {
    SYMBOL: 'EURUSD',
    TIMEFRAME: 'H1',
    RISK_PERCENT: 2,
    STOP_LOSS_PIPS: 50,
    TAKE_PROFIT_PIPS: 100,
  },
} as const;

// ========== TOKEN/SESSION CONFIGURATION ==========
export const TOKEN_CONFIG = {
  // Expiry times
  EXPIRY: {
    ACCESS_TOKEN_MS: 3600000,        // 1 hour
    REFRESH_TOKEN_MS: 604800000,     // 7 days
    SESSION_MS: 86400000,            // 24 hours
    CSRF_VIOLATION_MS: 86400000,     // 24 hours
  },
  
  // Refresh timing
  REFRESH: {
    BEFORE_EXPIRY_MS: 300000,        // 5 minutes before expiry
    GRACE_PERIOD_MS: 60000,          // 1 minute grace period
  },
  
  // Key lengths
  KEY_LENGTH: {
    MIN: 10,
    MAX: 500,
    API_KEY: { MIN: 10, MAX: 500 },
  },
} as const;

// ========== BACKUP CONFIGURATION ==========
export const BACKUP_CONFIG = {
  // Schedule
  SCHEDULE: {
    INTERVAL_MS: 21600000,           // 6 hours
    MAX_DURATION_MS: 600000,         // 10 minutes
  },
  
  // Retention
  RETENTION: {
    DAYS: 30,
    FULL_BACKUP_DAYS: 7,
  },
  
  // Recovery
  RECOVERY: {
    ESTIMATED_DOWNTIME_MS: 1800000,  // 30 minutes
    MAX_RESTORE_TIME_MS: 3600000,    // 1 hour
  },
} as const;

// ========== EDGE-SPECIFIC CONFIGURATION ==========
export const EDGE_CONFIG = {
  // Regions
  REGIONS: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1', 'cle1'],
  DEFAULT_REGION: 'iad1',
  
  // Cache
  CACHE: {
    TTL_MS: 180000,                  // 3 minutes
    STALE_WHILE_REVALIDATE_MS: 300000, // 5 minutes
    MAX_SIZE_MB: 10,
    MAX_ENTRIES: 1000,
  },
  
  // Function limits
  FUNCTIONS: {
    MAX_DURATION_MS: 30000,          // 30 seconds
    MAX_MEMORY_MB: 512,
    COLD_START_TIMEOUT_MS: 5000,     // 5 seconds
  },
  
  // Connection warming
  WARMING: {
    ENABLED: true,
    INTERVAL_MS: 420000,             // 7 minutes
    MIN_INTERVAL_MS: 60000,          // 1 minute
    PEAK_INTERVAL_MS: 180000,        // 3 minutes
  },
} as const;

// ========== AI/ML CONFIGURATION ==========
export const AI_CONFIG = {
  // Model settings
  MODEL: {
    DEFAULT: 'gemini-3-pro-preview',
    FALLBACK: ['gemini-2-pro', 'gemini-1-pro'],

    CONFIGS: {
      'gemini-3-pro-preview': {
        MAX_TOKENS: 8192,
        TEMPERATURE: 0.7,
        TOP_P: 0.8,
        TOP_K: 40,
      },
      'gpt-4': {
        MAX_TOKENS: 4096,
        TEMPERATURE: 0.7,
        TOP_P: 1,
      },
    },
  },

  // Code generation
  CODE: {
    MAX_LENGTH: 30000,
    CACHE_TTL_MS: 600000,            // 10 minutes
  },

  // Worker timeouts
  WORKER_TIMEOUTS: {
    DEFAULT: 30000,
    BUILD_CONTEXT: 10000,
    PROCESS_RESPONSE: 5000,
    EXTRACT_CODE: 3000,
    FORMAT_MESSAGE: 3000,
    GENERATE_CONTENT: 60000,
    PARSE_RESPONSE: 5000,
    HEALTH_CHECK: 2000,
  },

  // Token estimation
  TOKEN_ESTIMATION: {
    WORDS_MULTIPLIER: 1.3,
    CHARS_MULTIPLIER: 0.5,
  },

  // Generation parameters
  GENERATION: {
    DEFAULT_TEMPERATURE: 0.7,
    DEFAULT_TOP_P: 0.8,
    DEFAULT_TOP_K: 40,
    TEST_MAX_TOKENS: 10,
    TEST_PROMPT: 'Hello',
  },

  // Strategy analysis
  ANALYSIS: {
    MIN_RISK_SCORE: 1,
    MAX_RISK_SCORE: 10,
    MIN_PROFITABILITY_SCORE: 1,
    MAX_PROFITABILITY_SCORE: 10,
  },
} as const;

// ========== CONNECTION POOL CONFIGURATION ==========
export const CONNECTION_POOL_CONFIG = {
  // Edge-optimized defaults
  EDGE: {
    MIN_CONNECTIONS: 1,
    MAX_CONNECTIONS: 3,
    IDLE_TIMEOUT_MS: 45000,           // 45 seconds
    HEALTH_CHECK_INTERVAL_MS: 15000,  // 15 seconds
    CONNECTION_TIMEOUT_MS: 800,       // 0.8 seconds
    ACQUIRE_TIMEOUT_MS: 300,          // 0.3 seconds
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY_MS: 300,              // 0.3 seconds
  },

  // Standard defaults
  STANDARD: {
    MIN_CONNECTIONS: 2,
    MAX_CONNECTIONS: 10,
    IDLE_TIMEOUT_MS: 300000,          // 5 minutes
    HEALTH_CHECK_INTERVAL_MS: 30000,  // 30 seconds
    CONNECTION_TIMEOUT_MS: 5000,      // 5 seconds
    ACQUIRE_TIMEOUT_MS: 5000,         // 5 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000,             // 1 second
  },

  // Replica selection scoring weights
  REPLICA_SCORING: {
    REGION_MATCH_BONUS: 2000,
    LATENCY_MULTIPLIER: 1000,
    HEALTHY_BONUS: 500,
    RECENT_USE_PENALTY: 200,
    PRIORITY_MULTIPLIER: 10,
    RECENT_USE_THRESHOLD_MS: 30000,   // 30 seconds
  },

  // Region latency map (ms)
  REGION_LATENCIES: {
    PRIMARY: 50,
    HKG1: 120,
    IAD1: 80,
    SIN1: 100,
    FRA1: 90,
    SFO1: 70,
    UNKNOWN: 150,
  },

  // Health check thresholds
  HEALTH: {
    MAX_FAILED_CHECKS: 3,
    EDGE_CHECK_INTERVAL_MS: 30000,    // 30 seconds
  },

  // Edge warming
  WARMING: {
    REGIONS: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
  },
} as const;

// ========== UNIFIED CACHE CONFIGURATION ==========
export const UNIFIED_CACHE_CONFIG = {
  // Compression
  COMPRESSION: {
    THRESHOLD_BYTES: 1024,            // 1KB
    ENABLED: true,
  },

  // Cleanup intervals
  CLEANUP: {
    INTERVAL_MS: 300000,              // 5 minutes
  },

  // Default TTLs
  TTL: {
    DEFAULT_MS: 300000,               // 5 minutes
    STATIC_MS: 3600000,               // 1 hour
    SHORT_MS: 120000,                 // 2 minutes
    MEDIUM_MS: 600000,                // 10 minutes
    LONG_MS: 900000,                  // 15 minutes
  },

  // Cache sizes
  SIZES: {
    DEFAULT_BYTES: 10 * 1024 * 1024,  // 10MB
    ROBOT_BYTES: 20 * 1024 * 1024,    // 20MB
    QUERY_BYTES: 25 * 1024 * 1024,    // 25MB - for query optimizer
    USER_BYTES: 2 * 1024 * 1024,      // 2MB
  },

  // Preload data
  PRELOAD: {
    STRATEGY_TYPES: ['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'],
    TIMEFRAMES: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'],
    SYMBOLS: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'],
  },
} as const;

// ========== BACKEND OPTIMIZER CONFIGURATION ==========
export const BACKEND_OPTIMIZER_CONFIG = {
  // Request deduplication
  DEDUPLICATION: {
    TTL_MS: 5000,                     // 5 seconds
    CLEANUP_INTERVAL_MS: 10000,       // 10 seconds
  },

  // Health monitoring
  HEALTH: {
    CHECK_INTERVAL_MS: 30000,         // 30 seconds
    MAX_CONCURRENT_REQUESTS: 10,
  },

  // Feature toggles
  FEATURES: {
    ENABLE_DEDUPLICATION: true,
    ENABLE_QUERY_ANALYSIS: true,
    ENABLE_CONNECTION_HEALTH_CHECK: true,
    ENABLE_BATCH_OPTIMIZATIONS: true,
  },
} as const;

// ========== EDGE KV CONFIGURATION ==========
export const EDGE_KV_CONFIG = {
  // TTL values in seconds for different data types
  TTL: {
    SESSION: 86400,                   // 24 hours
    CACHE: 300,                       // 5 minutes
    API_RESPONSE: 180,                // 3 minutes
    USER_PREFERENCES: 3600,           // 1 hour
    SEARCH_RESULTS: 600,              // 10 minutes
    ANALYTICS: 1800,                  // 30 minutes
    RATE_LIMIT: 60,                   // 1 minute
  },

  // Memory cache settings
  MEMORY_CACHE: {
    TTL_MS: 60000,                    // 1 minute
    CLEANUP_INTERVAL_MS: 300000,      // 5 minutes
  },

  // Compression
  COMPRESSION: {
    THRESHOLD_BYTES: 1024,            // 1KB
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 100,
  },

  // Regions
  REGIONS: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
} as const;

// ========== DATA COMPRESSION CONFIGURATION ==========
export const DATA_COMPRESSION_CONFIG = {
  // Compression threshold in bytes
  THRESHOLD_BYTES: 1024,              // 1KB

  // Size detection
  SIZE_DETECTION: {
    COMPRESSED_LENGTH_THRESHOLD: 100,
    NULL_CHAR_CHECK: true,
  },
} as const;

// ========== UX MONITORING CONFIGURATION ==========
export const UX_MONITORING_CONFIG = {
  // Scoring weights
  WEIGHTS: {
    PERFORMANCE: 0.4,
    RELIABILITY: 0.3,
    ENGAGEMENT: 0.3,
  },

  // Web Vitals thresholds (ms)
  THRESHOLDS: {
    LCP: { GOOD: 2500, NEEDS_IMPROVEMENT: 4000 },
    FID: { GOOD: 100, NEEDS_IMPROVEMENT: 300 },
    CLS: { GOOD: 0.1, NEEDS_IMPROVEMENT: 0.25 },
    TTFB: { GOOD: 800, NEEDS_IMPROVEMENT: 1800 },
    FCP: { GOOD: 1500, NEEDS_IMPROVEMENT: 3000 },
    API_RESPONSE: { GOOD: 200, NEEDS_IMPROVEMENT: 1000 },
    RENDER: { GOOD: 100, NEEDS_IMPROVEMENT: 500 },
    CLICK_DELAY: { GOOD: 50, NEEDS_IMPROVEMENT: 200 },
    INPUT_LAG: { GOOD: 16, NEEDS_IMPROVEMENT: 100 },
  },

  // Monitoring intervals
  INTERVALS: {
    MONITORING_MS: 5000,              // 5 seconds
    SCORE_UPDATE_MS: 10000,           // 10 seconds
  },

  // Score thresholds
  SCORES: {
    EXCELLENT: 90,
    GOOD: 70,
    NEEDS_IMPROVEMENT: 50,
  },
} as const;

// ========== MEMORY MANAGEMENT ==========
export const MEMORY_CONFIG = {
  // Thresholds
  THRESHOLDS: {
    WARNING_MB: 50,
    CRITICAL_MB: 100,
    CLEANUP_PERCENT: 0.8,            // 80%
  },
  
  // Monitoring intervals
  MONITORING: {
    NORMAL_MS: 10000,                // 10 seconds
    HIGH_LOAD_MS: 5000,              // 5 seconds
  },
  
  // Buffer limits
  BUFFERS: {
    MAX_CHAT_HISTORY: 5000,
    MAX_HISTORY_SIZE: 100,
  },
} as const;

// ========== BATCH SIZES ==========
export const BATCH_CONFIG = {
  // Database
  DATABASE: {
    OPERATIONS: 10,
    INSERT: 100,
    UPDATE: 50,
  },
  
  // Pagination
  PAGINATION: {
    DEFAULT: 20,
    MAX: 100,
    PREFETCH: 20,
  },
  
  // Real-time
  REALTIME: {
    SYNC: 50,
    EVENTS: 100,
  },
  
  // Metrics
  METRICS: {
    BATCH_SIZE: 100,
    FLUSH_INTERVAL_MS: 30000,
  },
} as const;

// Type-safe configuration getter
export function getConfigValue<T>(
  category: keyof typeof APP_CONFIG,
  key: string
): T {
  const categoryConfig = APP_CONFIG[category];
  if (categoryConfig && key in categoryConfig) {
    const value = (categoryConfig as unknown as Record<string, T>)[key];
    if (value === undefined) {
      throw new Error(`Configuration key '${key}' not found in category '${category}'`);
    }
    return value;
  }
  throw new Error(`Configuration key '${key}' not found in category '${category}'`);
}

// Convenience function to get timeout with fallback
export function getTimeout(service: keyof typeof SERVICE_TIMEOUTS.SERVICES, fallback = 30000): number {
  return SERVICE_TIMEOUTS.SERVICES[service] ?? fallback;
}

// Convenience function to get cache size
export function getCacheSize(size: keyof typeof CACHE_SIZES): number {
  const value = CACHE_SIZES[size];
  return typeof value === 'number' ? value : 0;
}

// Convenience function to get retry config
export function getRetryConfig(service: keyof typeof RETRY_CONFIGS.SERVICES) {
  return RETRY_CONFIGS.SERVICES[service] ?? RETRY_CONFIGS.STANDARD;
}

// ========== STORAGE KEYS CONFIGURATION ==========
export const STORAGE_KEYS = {
  // Session and authentication
  SESSION: 'mock_session',
  MOCK_SESSION: 'mock_session',
  
  // Data storage
  ROBOTS: 'mock_robots',
  
  // Settings
  AI_SETTINGS: 'quantforge_ai_settings',
  DB_SETTINGS: 'quantforge_db_settings',
  
  // API keys
  API_KEYS: 'api_keys',
  
  // Security
  CSP_VIOLATIONS: 'csp_violations',
  WAF_TOTAL_REQUESTS: 'waf_total_requests',
  WAF_BLOCKED_REQUESTS: 'waf_blocked_requests',
  WAF_TOP_THREATS: 'waf_top_threats',
  EDGE_REQUESTS: 'edge_requests',
  
  // Cache
  EDGE_CACHE_PREFIX: 'edge-cache-',
} as const;

// ========== STORAGE PREFIXES ==========
export const STORAGE_PREFIXES = {
  MOCK: 'mock_',
  EDGE: 'edge-',
  CACHE: 'cache_',
} as const;

// ========== MAGIC NUMBERS ==========
export const MAGIC_NUMBERS = {
  // Time conversions
  MS_PER_SECOND: 1000,
  MS_PER_MINUTE: 60000,
  MS_PER_HOUR: 3600000,
  MS_PER_DAY: 86400000,
  MS_PER_WEEK: 604800000,
  
  // Size conversions
  BYTES_PER_KB: 1024,
  BYTES_PER_MB: 1048576,
  BYTES_PER_GB: 1073741824,
  
  // Common thresholds
  MAX_SAFE_INTEGER: 9007199254740991,
  MIN_SAFE_INTEGER: -9007199254740991,
} as const;

// ========== SCORING WEIGHTS ==========
export const SCORING_WEIGHTS = {
  // Pool selection scoring
  POOL: {
    REGION_MATCH_BONUS: 2000,
    HEALTHY_BONUS: 500,
    RECENT_USE_PENALTY: 200,
    LATENCY_MULTIPLIER: 1000,
    MAX_LATENCY_PENALTY: 1000,
  },
  
  // Edge metrics scoring
  EDGE: {
    DEFAULT_SCORE: 100,
    LATENCY_DIVISOR: 1,
    COMPRESSION_RATIO_PRECISION: 100,
  },
} as const;

// ========== THRESHOLD VALUES ==========
export const THRESHOLDS = {
  // Usage thresholds
  RECENT_USAGE_MS: 30000,
  COLD_START_MS: 500,
  CONNECTION_AGE_MS: 60000,

  // String limits
  STRING_MAX_LENGTH: 1000,
  STRING_CODE_MAX: 50000,
  STRING_URL_MAX: 2048,

  // Compression
  COMPRESSION_THRESHOLD: 1024,
} as const;

// ========== STRING TRUNCATION LENGTHS ==========
export const STRING_TRUNCATION = {
  // Log/debug truncation lengths
  LOG: {
    SHORT: 50,      // For key/id logging
    MEDIUM: 100,    // For message summaries
    LONG: 200,      // For detailed logs
    DEBUG: 500,     // For debug output
  },

  // Display truncation lengths
  DISPLAY: {
    LABEL: 50,      // UI labels
    DESCRIPTION: 100, // Description text
    PREVIEW: 200,   // Content previews
    CODE_SNIPPET: 500, // Code samples
    FULL_TEXT: 1000, // Full text content
  },

  // Hash generation lengths
  HASH: {
    SHORT: 500,     // Short hash input
    STANDARD: 1000, // Standard hash input
  },

  // Database/Storage limits
  STORAGE: {
    QUERY_PREVIEW: 100, // SQL query preview
    ID_TRUNCATE: 12,    // ID string truncation
    ERROR_MESSAGE: 1000, // Error message max
  },
} as const;

// ========== STATUS TYPE CONSTANTS ==========
export const STATUS_TYPES = {
  // Health status
  HEALTH: {
    HEALTHY: 'healthy',
    WARNING: 'warning',
    CRITICAL: 'critical',
  } as const,

  // Operation status
  OPERATION: {
    IDLE: 'idle',
    BUSY: 'busy',
    ERROR: 'error',
    SUCCESS: 'success',
    PENDING: 'pending',
  } as const,

  // Issue/Alert types
  ISSUE: {
    CRITICAL: 'critical',
    WARNING: 'warning',
    INFO: 'info',
    ERROR: 'error',
  } as const,

  // Alert/Monitor types
  ALERT: {
    PERFORMANCE: 'performance',
    AVAILABILITY: 'availability',
    ERROR: 'error',
    RESOURCE: 'resource',
  } as const,

  // Connection status
  CONNECTION: {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    RECONNECTING: 'reconnecting',
  } as const,
} as const;

// ========== ARRAY SIZE LIMITS ==========
export const ARRAY_LIMITS = {
  // Small collections
  SMALL: 50,

  // Standard collections
  STANDARD: 100,

  // Large collections
  LARGE: 1000,

  // Specific use cases
  METRICS: 100,
  ERRORS: 50,
  HISTORY: 100,
  VIOLATIONS: 100,
  RECENT_REQUESTS: 100,
  ACCESS_TIMES: 100,
  OPTIMIZATION_HISTORY: 1000,
  TOP_OPERATIONS: 10,
} as const;

// ========== SCORE CALCULATION CONSTANTS ==========
export const SCORE_CALCULATION = {
  // Score ranges
  MIN: 0,
  MAX: 100,

  // Percentage multiplier
  PERCENTAGE_MULTIPLIER: 100,

  // Risk/Profit scoring
  RISK: {
    MIN: 1,
    MAX: 10,
  },

  // Performance scoring weights
  WEIGHTS: {
    PERFORMANCE: 40,  // 40%
    RELIABILITY: 25,  // 25%
    ENGAGEMENT: 20,   // 20%
    OTHER: 15,        // 15%
  },

  // Score thresholds
  THRESHOLDS: {
    EXCELLENT: 80,
    GOOD: 60,
    NEEDS_IMPROVEMENT: 50,
  },
} as const;

// ========== DISPLAY FORMATTING ==========
export const DISPLAY_FORMAT = {
  // Decimal places
  DECIMALS: {
    DEFAULT: 2,
    CURRENCY: 2,
    PERCENTAGE: 1,
    PRECISION: 4,
  },

  // Number formatting
  LARGE_NUMBER: {
    THOUSAND: 1000,
    MILLION: 1000000,
    BILLION: 1000000000,
  },
} as const;

// ========== CONCURRENCY LIMITS ==========
export const CONCURRENCY_LIMITS = {
  // Request throttling
  REQUESTS: {
    DEFAULT: 6,
    MIN: 1,
    MAX: 20,
    HIGH: 10,
    LOW: 3,
  },
  
  // Connection pools
  CONNECTIONS: {
    MIN: 1,
    DEFAULT: 2,
    MAX: 10,
    EDGE_MIN: 1,
    EDGE_MAX: 4,
  },
  
  // Workers
  WORKERS: {
    MIN: 1,
    DEFAULT: 4,
    MAX: 8,
  },
} as const;

// ========== ATTEMPT LIMITS ==========
export const ATTEMPT_LIMITS = {
  // Retry attempts
  RETRY: {
    MIN: 1,
    DEFAULT: 3,
    MAX: 5,
    EXTENDED: 10,
  },
  
  // Connection attempts
  CONNECTION: {
    MIN: 1,
    DEFAULT: 3,
    MAX: 10,
  },
  
  // Health check attempts
  HEALTH_CHECK: {
    MIN: 1,
    DEFAULT: 3,
    MAX: 5,
  },
} as const;

// ========== SAFE REGEX CONFIGURATION ==========
export const SAFE_REGEX_CONFIG = {
  // Pattern limits
  PATTERN: {
    MAX_LENGTH: 200,
    MAX_SPECIAL_CHARS: 20,
    MAX_QUANTIFIER_DEPTH: 3,
  },
  
  // Execution timeout
  TIMEOUT_MS: 100,
  
  // Input validation
  INPUT: {
    MAX_LENGTH: 500,
    MAX_TEXT_LENGTH: 10000,
  },
  
  // Complexity thresholds
  COMPLEXITY: {
    MAX_ESTIMATED_COMPLEXITY: 1000000,
    SCORE_PER_LENGTH: 1,
    SCORE_PER_QUANTIFIER: 10,
    SCORE_PER_GROUP: 5,
    SCORE_PER_ALTERNATION: 20,
    SCORE_PER_NESTED_GROUP: 50,
  },
} as const;

// ========== ID GENERATION CONSTANTS ==========
export const ID_GENERATION = {
  // Random string lengths for ID generation
  RANDOM: {
    SHORT: 6,      // Short ID suffix (e.g., anon IDs)
    STANDARD: 9,   // Standard ID suffix (most common)
    LONG: 12,      // Long ID suffix (database IDs)
    HASH: 16,      // Hash substring length
  },
  
  // ID prefixes
  PREFIXES: {
    ANONYMOUS: 'anon',
    SESSION: 'session',
    CONNECTION: 'conn',
    QUERY: 'query',
    TASK: 'task',
    SUBSCRIPTION: 'sub',
    ALERT: 'alert',
    BATCH: 'batch',
    REAL_USER_MONITORING: 'rum',
  },
  
  // Separator used in IDs
  SEPARATOR: '_',
} as const;

// ========== SLICE/SPLICE LIMITS ==========
export const SLICE_LIMITS = {
  // History/array slicing
  HISTORY: {
    TINY: 5,       // Very small history window
    SMALL: 10,     // Small history window (e.g., recent alerts)
    STANDARD: 50,  // Standard history window (e.g., alerts)
    LARGE: 100,    // Large history window (e.g., metrics, access times)
    XLARGE: 1000,  // Extra large history (e.g., optimization history)
  },
  
  // Score history slicing
  SCORES: {
    RECENT: 5,     // Recent scores for trend analysis
    STANDARD: 10,  // Standard score history
  },
  
  // Metrics slicing
  METRICS: {
    LATEST: 2,     // Latest metrics (e.g., web vitals)
    RECENT: 10,    // Recent metrics
  },
  
  // Region slicing
  REGIONS: {
    PRIORITY: 3,   // Priority regions count
    LOW_PRIORITY: 2, // Low priority regions count
  },
} as const;

// ========== SCORE MULTIPLIERS ==========
export const SCORE_MULTIPLIERS = {
  // Percentage calculations
  PERCENTAGE: {
    TO_PERCENT: 100,     // Convert ratio to percentage
    FROM_PERCENT: 0.01,  // Convert percentage to ratio
  },
  
  // Error rate calculations
  ERROR_RATE: {
    MULTIPLIER: 100,     // Convert error rate to score
    INVERSE_BASE: 100,   // Base for inverse scoring
  },
  
  // Performance scoring
  PERFORMANCE: {
    SCROLL: 10,          // Scroll performance multiplier
    RATIO_PENALTY: 50,   // Ratio penalty multiplier
    RATIO_MULTIPLIER: 100, // Full ratio multiplier
  },
  
  // Hash generation
  HASH: {
    BASE36: 36,          // Base36 for hash strings
  },
} as const;

// ========== ENCRYPTION CONFIGURATION ==========
export const ENCRYPTION_CONFIG = {
  // Web Crypto API settings
  WEB_CRYPTO: {
    ALGORITHM: 'AES-GCM',
    KEY_LENGTH: 256,           // bits
    IV_LENGTH: 12,             // bytes
    SALT_LENGTH: 32,           // bytes
    ITERATIONS: 100000,        // PBKDF2 iterations
  },

  // Key derivation
  KEY_DERIVATION: {
    MIN_ITERATIONS: 100000,
    RECOMMENDED_ITERATIONS: 100000,
    MAX_ITERATIONS: 500000,
  },

  // Storage encryption
  STORAGE: {
    VERSION: '1.0',
    KEY_ROTATION_DAYS: 1,      // Daily key rotation
  },
} as const;

// ========== PROGRESSIVE LOADING CONFIGURATION ==========
export const PROGRESSIVE_LOADING_CONFIG = {
  // Default batch sizes
  BATCH_SIZE: {
    MIN: 5,
    DEFAULT: 20,
    MAX: 100,
  },

  // Delay between batches (ms)
  DELAY: {
    NONE: 0,
    MINIMAL: 50,
    DEFAULT: 100,
    SMOOTH: 200,
  },

  // Progressive loading limits
  LIMITS: {
    INITIAL_LOAD: 100,         // Items to load initially
    MAX_ITEMS: 10000,          // Maximum total items
  },
} as const;

// ========== HEALTH DASHBOARD CONFIGURATION ==========
export const HEALTH_DASHBOARD_CONFIG = {
  // Refresh intervals
  REFRESH_INTERVAL: {
    REALTIME: 1000,            // 1 second
    FAST: 5000,                // 5 seconds
    NORMAL: 10000,             // 10 seconds
    SLOW: 30000,               // 30 seconds
  },

  // Display settings
  DISPLAY: {
    MAX_INTEGRATIONS_SHOWN: 50,
    ERROR_RATE_DECIMALS: 2,
    LATENCY_DECIMALS: 0,
  },
} as const;

// Export all configurations as a single object
export const APP_CONFIG = {
  WEBSOCKET: WEBSOCKET_CONFIG,
  CACHE_SIZES,
  TIMEOUTS: SERVICE_TIMEOUTS,
  RETRY: RETRY_CONFIGS,
  CIRCUIT_BREAKER: CIRCUIT_BREAKER_CONFIGS,
  MONITORING: MONITORING_INTERVALS,
  POOL: POOL_CONFIGS,
  RATE_LIMIT: RATE_LIMITS,
  VALIDATION: VALIDATION_LIMITS,
  TOKEN: TOKEN_CONFIG,
  BACKUP: BACKUP_CONFIG,
  EDGE: EDGE_CONFIG,
  AI: AI_CONFIG,
  MEMORY: MEMORY_CONFIG,
  BATCH: BATCH_CONFIG,
  CONNECTION_POOL: CONNECTION_POOL_CONFIG,
  UNIFIED_CACHE: UNIFIED_CACHE_CONFIG,
  UX_MONITORING: UX_MONITORING_CONFIG,
  BACKEND_OPTIMIZER: BACKEND_OPTIMIZER_CONFIG,
  EDGE_KV: EDGE_KV_CONFIG,
  DATA_COMPRESSION: DATA_COMPRESSION_CONFIG,
  STORAGE: STORAGE_KEYS,
  PREFIXES: STORAGE_PREFIXES,
  MAGIC: MAGIC_NUMBERS,
  SCORING: SCORING_WEIGHTS,
  THRESHOLD: THRESHOLDS,
  STRING_TRUNCATION,
  STATUS_TYPES,
  ARRAY_LIMITS,
  SCORE_CALCULATION,
  DISPLAY_FORMAT,
  CONCURRENCY: CONCURRENCY_LIMITS,
  ATTEMPTS: ATTEMPT_LIMITS,
  SAFE_REGEX: SAFE_REGEX_CONFIG,
  ID_GENERATION,
  SLICE_LIMITS,
  SCORE_MULTIPLIERS,
  ENCRYPTION: ENCRYPTION_CONFIG,
  PROGRESSIVE_LOADING: PROGRESSIVE_LOADING_CONFIG,
  HEALTH_DASHBOARD: HEALTH_DASHBOARD_CONFIG,
} as const;

// Default export
export default APP_CONFIG;
