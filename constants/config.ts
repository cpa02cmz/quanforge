/**
 * Application Configuration Constants
 * Centralizes all hardcoded values for better maintainability and flexibility
 */

// ========== TIME CONSTANTS ==========
export const TIME_CONSTANTS = {
  // Millisecond conversions
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  
  // Default TTL values
  CACHE_DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
  CACHE_SHORT_TTL: 1 * 60 * 1000,   // 1 minute
  CACHE_MEDIUM_TTL: 15 * 60 * 1000, // 15 minutes
  CACHE_LONG_TTL: 60 * 60 * 1000,   // 1 hour
  CACHE_EXTENDED_TTL: 24 * 60 * 60 * 1000, // 24 hours
  
  // Cleanup intervals
  CLEANUP_SHORT_INTERVAL: 30 * 1000,    // 30 seconds
  CLEANUP_DEFAULT_INTERVAL: 60 * 1000,  // 1 minute
  CLEANUP_LONG_INTERVAL: 5 * 60 * 1000,  // 5 minutes
};

// ========== CACHE CONFIGURATION ==========
export const CACHE_CONFIG = {
  // Size limits
  MAX_CACHE_ENTRIES: 1000,
  MAX_CACHE_MEMORY_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_LRU_CACHE_SIZE: 200,
  MAX_ADVANCED_CACHE_SIZE: 500,
  
  // Compression settings
  COMPRESSION_THRESHOLD: 1024, // 1KB
  COMPRESSION_RATIO_THRESHOLD: 0.8, // Compress if reduces by 20%
  
  // Performance targets
  MIN_CACHE_HIT_RATE: 0.7, // 70%
  TARGET_CACHE_HIT_RATE: 0.9, // 90%
  
  // Edge-specific cache TTL
  EDGE_CACHE_TTL: 3 * 60 * 1000, // 3 minutes
  STATIC_CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours
};

// ========== RATE LIMITING CONFIGURATION ==========
export const RATE_LIMITING = {
  // General rate limits
  DEFAULT_WINDOW: TIME_CONSTANTS.MINUTE,
  DEFAULT_MAX_REQUESTS: 100,
  
  // User tier specific limits
  TIERS: {
    FREE: {
      WINDOW: TIME_CONSTANTS.MINUTE,
      MAX_REQUESTS: 10,
      DAILY_LIMIT: 100,
      MONTHLY_LIMIT: 1000,
    },
    PRO: {
      WINDOW: TIME_CONSTANTS.MINUTE,
      MAX_REQUESTS: 50,
      DAILY_LIMIT: 1000,
      MONTHLY_LIMIT: 10000,
    },
    ENTERPRISE: {
      WINDOW: TIME_CONSTANTS.MINUTE,
      MAX_REQUESTS: 200,
      DAILY_LIMIT: 10000,
      MONTHLY_LIMIT: 100000,
    },
  },
  
  // API-specific limits
  AI_GENERATION: {
    WINDOW: TIME_CONSTANTS.MINUTE,
    MAX_REQUESTS: 20,
  },
  MARKET_DATA: {
    WINDOW: TIME_CONSTANTS.MINUTE,
    MAX_REQUESTS: 60,
  },
  DATABASE_QUERIES: {
    WINDOW: TIME_CONSTANTS.MINUTE,
    MAX_REQUESTS: 200,
  },
};

// ========== TRADING/STRATEGY CONSTANTS ==========
export const TRADING_CONSTANTS = {
  // Risk management
  MAX_RISK_PERCENT: 100,
  MIN_RISK_PERCENT: 0.01,
  DEFAULT_RISK_PERCENT: 2,
  
  // Stop loss and take profit
  MAX_STOP_LOSS_PIPS: 1000,
  MIN_STOP_LOSS_PIPS: 1,
  MAX_TAKE_PROFIT_PIPS: 1000,
  MIN_TAKE_PROFIT_PIPS: 1,
  
  // Account settings
  MAX_MAGIC_NUMBER: 999999,
  MIN_MAGIC_NUMBER: 1,
  MAX_INITIAL_DEPOSIT: 10000000,
  MIN_INITIAL_DEPOSIT: 100,
  MAX_LEVERAGE: 1000,
  MIN_LEVERAGE: 1,
  
  // Backtesting
  MAX_BACKTEST_DURATION: 365,
  MIN_BACKTEST_DURATION: 1,
  DEFAULT_BACKTEST_DURATION: 30,
  
  // Valid timeframes
  TIMEFRAMES: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'],
  
  // Symbol validation
  SYMBOL_REGEX: /^[A-Z]{3,6}[\/]?[A-Z]{3,6}$/,
};

// ========== API CONFIGURATION ==========
export const API_CONFIG = {
  // Timeouts
  REQUEST_TIMEOUT: 30 * TIME_CONSTANTS.SECOND,
  API_TIMEOUT: 60 * TIME_CONSTANTS.SECOND,
  WEBSOCKET_TIMEOUT: 120 * TIME_CONSTANTS.SECOND,
  
  // Retry configuration
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // 1 second
  RETRY_DELAY_MAX: 10000, // 10 seconds
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Response limits
  MAX_RESPONSE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_PAYLOAD_SIZE: 10 * 1024 * 1024,  // 10MB
};

// ========== SECURITY CONFIGURATION ==========
export const SECURITY_CONFIG = {
  // Input validation
  MAX_INPUT_LENGTH: 10000,
  MAX_USERNAME_LENGTH: 50,
  MAX_EMAIL_LENGTH: 255,
  MAX_PASSWORD_LENGTH: 128,
  
  // Rate limiting for authentication
  AUTH_ATTEMPTS: {
    WINDOW: 15 * TIME_CONSTANTS.MINUTE, // 15 minutes
    MAX_ATTEMPTS: 5,
  },
  
  // Session management
  SESSION_TIMEOUT: 24 * TIME_CONSTANTS.HOUR,
  TOKEN_EXPIRY: TIME_CONSTANTS.HOUR,
  REFRESH_TOKEN_EXPIRY: 7 * TIME_CONSTANTS.DAY,
  
  // API key security
  MIN_API_KEY_LENGTH: 10,
  MAX_API_KEY_LENGTH: 500,
  API_KEY_ROTATION_INTERVAL: 30 * TIME_CONSTANTS.DAY,
};

// ========== PERFORMANCE THRESHOLDS ==========
export const PERFORMANCE_THRESHOLDS = {
  // Web Vitals thresholds
  LCP: {
    GOOD: 2500,
    NEEDS_IMPROVEMENT: 4000,
  },
  FID: {
    GOOD: 100,
    NEEDS_IMPROVEMENT: 300,
  },
  CLS: {
    GOOD: 0.1,
    NEEDS_IMPROVEMENT: 0.25,
  },
  
  // Database performance
  SLOW_QUERY_THRESHOLD: 1000, // 1 second
  MAX_DB_CONNECTIONS: 100,
  CONNECTION_POOL_IDLE_TIMEOUT: 30 * TIME_CONSTANTS.SECOND,
  
  // Memory usage
  MAX_MEMORY_USAGE: 512 * 1024 * 1024, // 512MB
  MEMORY_CLEANUP_THRESHOLD: 0.8, // 80%
  
  // Cache performance
  MIN_CACHE_EFFICIENCY: 0.7, // 70%
  CACHE_WARMUP_CONCURRENCY: 5,
};

// ========== EDGE/CDN CONFIGURATION ==========
export const EDGE_CONFIG = {
  // Supported edge regions
  REGIONS: ['hkg1', 'iad1', 'sin1', 'cle1', 'fra1'],
  DEFAULT_REGION: 'iad1',
  
// Edge-specific caching
  EDGE_CACHE_TTL: TIME_CONSTANTS.MINUTE * 3, // 3 minutes
  EDGE_STALE_WHILE_REVALIDATE: TIME_CONSTANTS.MINUTE * 5, // 5 minutes
  
  // Function limits
  MAX_FUNCTION_DURATION: 30 * TIME_CONSTANTS.SECOND,
  MAX_FUNCTION_MEMORY: 512, // MB
  COLD_START_TIMEOUT: 5000, // 5 seconds
};

// ========== VALIDATION CONFIGURATION ==========
export const VALIDATION_CONFIG = {
  // Regex patterns
  PATTERNS: {
    NAME: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/.+/,
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  },
  
  // Input lengths
  MAX_STRING_LENGTH: 1000,
  MAX_TEXT_AREA_LENGTH: 10000,
  MAX_CODE_LENGTH: 1000000,
  
  // File uploads
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['.json', '.csv', '.txt'],
};

// ========== ERROR HANDLING CONFIGURATION ==========
export const ERROR_CONFIG = {
  // Retry settings
  MAX_ERROR_RETRY_ATTEMPTS: 3,
  ERROR_RETRY_DELAY_BASE: 2000, // 2 seconds
  
  // Error logging
  MAX_ERROR_LOG_SIZE: 1000,
  ERROR_LOG_RETENTION: 7 * TIME_CONSTANTS.DAY,
  
  // Circuit breaker
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_TIMEOUT: 60 * TIME_CONSTANTS.SECOND,
};

// ========== MONITORING CONFIGURATION ==========
export const MONITORING_CONFIG = {
  // Metrics collection
  METRICS_BATCH_SIZE: 100,
  METRICS_FLUSH_INTERVAL: 30 * TIME_CONSTANTS.SECOND,
  MAX_METRICS_IN_MEMORY: 10000,
  
  // Health checks
  HEALTH_CHECK_INTERVAL: 30 * TIME_CONSTANTS.SECOND,
  HEALTH_CHECK_TIMEOUT: 5 * TIME_CONSTANTS.SECOND,
  
  // Alerts
  ALERT_COOLDOWN: TIME_CONSTANTS.MINUTE * 5, // 5 minutes
  MAX_ALERTS_PER_HOUR: 20,
};

// ========== BUILD CONFIGURATION ==========
export const BUILD_CONFIG = {
  // Chunk size optimization - adjusted for modern web standards
  CHUNK_SIZE_WARNING_LIMIT: 150, // kB - increased to account for large vendor deps
  CHUNK_SIZE_LARGE_LIMIT: 250,   // kB for large chunks
  CHUNK_SIZE_VENDORS_LIMIT: 350, // kB for vendor chunks - realistic for modern libraries
  
  // Asset optimization
  ASSETS_INLINE_LIMIT: 256,      // bytes
  MAX_ASSET_SIZE: 50 * 1024 * 1024, // 50MB
  
  // Terser optimization
  TERSER_COMPRESSION_PASSES: 3,
  TERSER_COMPRESSION_THRESHOLD: 1024, // 1KB
  
  // Tree shaking
  TREE_SHAKING_AGGRESSIVE: true,
  DEAD_CODE_ELIMINATION: true,
  
  // Code splitting
  CSS_CODE_SPLIT: true,
  CSS_MINIFY: true,
  DYNAMIC_IMPORTS: true,
  
  // Build targets
  TARGET_BROWSER_SUPPORT: ['esnext', 'chrome87', 'firefox78', 'safari14'],
  TARGET_EDGE_RUNTIME: true,
  
  // Source maps
  SOURCE_MAP_DEV: 'hidden',
  SOURCE_MAP_PROD: false,
  
  // Performance budgets
  BUNDLE_MAX_SIZE: 1024 * 1024,    // 1MB total
  VENDOR_MAX_SIZE: 500 * 1024,     // 500KB per vendor chunk
  CHUNK_MAX_SIZE: 100 * 1024,      // 100KB per chunk
  
  // Compression targets
  COMPRESSION_RATIO_TARGET: 0.7,   // 30% reduction target
  GZIP_THRESHOLD: 1024,           // 1KB gzip threshold
};

// Environment-overridable build configuration
export const getBuildConfig = () => {
  const envConfig = getEnvironmentConfig();
  const isEdgeDeployed = (typeof process !== 'undefined' && process?.env?.['EDGE_RUNTIME']) === 'true';
  const isPerformanceMode = (typeof process !== 'undefined' && process?.env?.['PERFORMANCE_MODE']) === 'true';
  
  return {
    ...BUILD_CONFIG,
    
    // Environment-specific overrides with performance considerations
    CHUNK_SIZE_WARNING_LIMIT: parseInt(
      (typeof process !== 'undefined' && process?.env?.['CHUNK_SIZE_WARNING_LIMIT']) || 
      (isEdgeDeployed ? '120' : BUILD_CONFIG.CHUNK_SIZE_WARNING_LIMIT.toString())
    ),
    ASSETS_INLINE_LIMIT: parseInt((typeof process !== 'undefined' && process?.env?.['ASSETS_INLINE_LIMIT']) || BUILD_CONFIG.ASSETS_INLINE_LIMIT.toString()),
    TERSER_COMPRESSION_PASSES: parseInt(
      (typeof process !== 'undefined' && process?.env?.['TERSER_COMPRESSION_PASSES']) || 
      (isPerformanceMode ? '4' : BUILD_CONFIG.TERSER_COMPRESSION_PASSES.toString())
    ),
    
    // Feature-based overrides
    CSS_MINIFY: (typeof process !== 'undefined' && process?.env?.['CSS_MINIFY']) !== 'false' && BUILD_CONFIG.CSS_MINIFY,
    CSS_CODE_SPLIT: (typeof process !== 'undefined' && process?.env?.['CSS_CODE_SPLIT']) !== 'false' && BUILD_CONFIG.CSS_CODE_SPLIT,
    
    // Performance mode optimizations
    PERFORMANCE_MODE: isPerformanceMode,
    DEBUG_MODE: envConfig.isDevelopment || (typeof process !== 'undefined' && process?.env?.['DEBUG_MODE']) === 'true',
    EDGE_OPTIMIZED: isEdgeDeployed,
    
    // Source map configuration based on environment
    SOURCE_MAP_DEV: envConfig.isDevelopment ? BUILD_CONFIG.SOURCE_MAP_DEV as boolean | 'hidden' | 'inline' | undefined : BUILD_CONFIG.SOURCE_MAP_PROD as boolean | 'hidden' | 'inline' | undefined,
    DROP_CONSOLE: !envConfig.isDevelopment && (typeof process !== 'undefined' && process?.env?.['DROP_CONSOLE']) !== 'false',
    
    // Dynamic optimization levels
    AGGRESSIVE_TREESHAKING: isPerformanceMode,
    ENHANCED_COMPRESSION: isEdgeDeployed,
  };
};

// ========== ENVIRONMENT-OVERRIDABLE CONFIGURATION ==========
export const getEnvironmentConfig = () => ({
  // Development overrides
  isDevelopment: (typeof process !== 'undefined' && process?.env?.['NODE_ENV']) === 'development',
  isProduction: (typeof process !== 'undefined' && process?.env?.['NODE_ENV']) === 'production',
  isTest: (typeof process !== 'undefined' && process?.env?.['NODE_ENV']) === 'test',
  
  // API endpoints
  API_BASE_URL: (typeof process !== 'undefined' && process?.env?.['API_BASE_URL']) || '/api',
  WEBSOCKET_URL: (typeof process !== 'undefined' && process?.env?.['WEBSOCKET_URL']) || 'ws://localhost:3001',
  
  // Feature flags
  FEATURES: {
    EDGE_CACHING: (typeof process !== 'undefined' && process?.env?.['ENABLE_EDGE_CACHING']) !== 'false',
    PERFORMANCE_MONITORING: (typeof process !== 'undefined' && process?.env?.['ENABLE_PERFORMANCE_MONITORING']) !== 'false',
    ADVANCED_VALIDATION: (typeof process !== 'undefined' && process?.env?.['ENABLE_ADVANCED_VALIDATION']) !== 'false',
    BETA_FEATURES: (typeof process !== 'undefined' && process?.env?.['ENABLE_BETA_FEATURES']) === 'true',
  },
  
  // Debug settings
  DEBUG: {
    ENABLE_CONSOLE_LOGS: (typeof process !== 'undefined' && process?.env?.['NODE_ENV']) === 'development',
    ENABLE_PERFORMANCE_LOGS: (typeof process !== 'undefined' && process?.env?.['ENABLE_PERFORMANCE_LOGS']) === 'true',
    ENABLE_CACHE_DEBUG: (typeof process !== 'undefined' && process?.env?.['ENABLE_CACHE_DEBUG']) === 'true',
  },
});

// Type-safe configuration getter
export const getConfig = <T>(section: string, key: string): T => {
  const configMap: Record<string, any> = {
    TIME_CONSTANTS,
    CACHE_CONFIG,
    RATE_LIMITING,
    TRADING_CONSTANTS,
    API_CONFIG,
    SECURITY_CONFIG,
    PERFORMANCE_THRESHOLDS,
    EDGE_CONFIG,
    VALIDATION_CONFIG,
    ERROR_CONFIG,
    MONITORING_CONFIG,
    BUILD_CONFIG,
  };
  
  const sectionConfig = configMap[section];
  if (sectionConfig && key in sectionConfig) {
    return sectionConfig[key] as T;
  }
  
  throw new Error(`Configuration key '${key}' not found in section '${section}'`);
};

// Default export with all configuration
export const APP_CONFIG = {
  TIME_CONSTANTS,
  CACHE_CONFIG,
  RATE_LIMITING,
  TRADING_CONSTANTS,
  API_CONFIG,
  SECURITY_CONFIG,
  PERFORMANCE_THRESHOLDS,
  EDGE_CONFIG,
  VALIDATION_CONFIG,
  ERROR_CONFIG,
  MONITORING_CONFIG,
  BUILD_CONFIG,
  getEnvironmentConfig,
  getConfig,
};