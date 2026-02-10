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
    QUERY_BYTES: 5 * 1024 * 1024,     // 5MB
    USER_BYTES: 2 * 1024 * 1024,      // 2MB
  },

  // Preload data
  PRELOAD: {
    STRATEGY_TYPES: ['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'],
    TIMEFRAMES: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'],
    SYMBOLS: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'],
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
} as const;

// Default export
export default APP_CONFIG;
