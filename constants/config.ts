/**
 * Application Configuration Constants
 * Centralizes all hardcoded values for better maintainability and flexibility
 */

import { getUrlConfig } from '../utils/urls';

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
  
  // Cleanup intervals for advanced cache
  ADVANCED_CACHE_CLEANUP_INTERVAL: TIME_CONSTANTS.CLEANUP_DEFAULT_INTERVAL, // 1 minute
  ADVANCED_CACHE_COMPRESSION_THRESHOLD: 512, // 0.5KB
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
  SYMBOL_REGEX: /^[A-Z]{3,6}\/?[A-Z]{3,6}$/,
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

// ========== AI/ML CONFIGURATION ==========
export const AI_CONFIG = {
  // Default model configurations
  DEFAULT_MODELS: {
    GOOGLE: 'gemini-3-pro-preview',
    OPENAI: 'gpt-4',
    OPENAI_COMPATIBLE: 'gpt-4',
    CLAUDE: 'claude-3-sonnet-20240229',
  },
  
  // Fallback models in order of preference
  FALLBACK_MODELS: {
    GOOGLE: ['gemini-3-pro-preview', 'gemini-2-pro', 'gemini-1-pro'],
    OPENAI: ['gpt-4', 'gpt-3.5-turbo'],
    OPENAI_COMPATIBLE: ['gpt-4', 'gpt-3.5-turbo', 'llama-2'],
  },
  
  // Model-specific configurations
  MODEL_CONFIGS: {
    'gemini-3-pro-preview': {
      maxTokens: 8192,
      temperature: 0.7,
      topP: 0.8,
      topK: 40,
    },
    'gpt-4': {
      maxTokens: 4096,
      temperature: 0.7,
      topP: 1,
    },
    'gpt-3.5-turbo': {
      maxTokens: 4096,
      temperature: 0.7,
      topP: 1,
    },
  },
  
  // Token limits for different providers
  TOKEN_LIMITS: {
    GOOGLE: 8192,
    OPENAI: 8192,
    CLAUDE: 100000,
    // Default fallback
    DEFAULT: 4000,
  },
  
  // Cache configuration specific to AI services
  CACHE: {
    STRATEGY_ANALYSIS_TTL: TIME_CONSTANTS.HOUR * 2, // 2 hours
    MQL5_GENERATION_TTL: TIME_CONSTANTS.MINUTE * 30, // 30 minutes
    SEMANTIC_CACHE_TTL: TIME_CONSTANTS.MINUTE * 15, // 15 minutes
    MAX_CACHE_SIZE: 500,
    MAX_ANALYSIS_CACHE_SIZE: 200,
    MAX_MQL5_CACHE_SIZE: 300,
  },
  
  // Rate limiting for AI APIs
  RATE_LIMITS: {
    GOOGLE: {
      REQUESTS_PER_MINUTE: 60,
      TOKENS_PER_MINUTE: 32000,
    },
    OPENAI: {
      REQUESTS_PER_MINUTE: 500,
      TOKENS_PER_MINUTE: 160000,
    },
    CLAUDE: {
      REQUESTS_PER_MINUTE: 50,
      TOKENS_PER_MINUTE: 40000,
    },
  },
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000, // 1 second
    MAX_DELAY: 10000, // 10 seconds
    BACKOFF_MULTIPLIER: 2,
  },
  
  // Provider-specific endpoints
  ENDPOINTS: {
    OPENAI: 'https://api.openai.com/v1',
    OPENROUTER: 'https://openrouter.ai/api/v1',
    DEEPSEEK: 'https://api.deepseek.com/v1',
    LOCAL_LLM: 'http://localhost:8000/v1',
  },
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

// ========== DEVELOPMENT SERVER CONFIGURATION ==========
export const DEV_SERVER_CONFIG = {
  // Default development ports
  HTTP_PORT: 3000,
  VITE_PORT: 5173,
  WEBSOCKET_PORT: 3001,
  
  // Port range for automatic port allocation
  PORT_RANGE_START: 3000,
  PORT_RANGE_END: 3100,
  
  // Host configuration
  DEFAULT_HOST: '0.0.0.0',
  LOCALHOST: 'localhost',
  
  // Development URLs
  getDevUrl: (port?: number) => `http://${DEV_SERVER_CONFIG.DEFAULT_HOST}:${port || DEV_SERVER_CONFIG.HTTP_PORT}`,
  getViteUrl: (port?: number) => `http://${DEV_SERVER_CONFIG.DEFAULT_HOST}:${port || DEV_SERVER_CONFIG.VITE_PORT}`,
  getWebSocketUrl: (port?: number) => `ws://${DEV_SERVER_CONFIG.DEFAULT_HOST}:${port || DEV_SERVER_CONFIG.WEBSOCKET_PORT}`,
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
  WEBSOCKET_URL: (typeof process !== 'undefined' && process?.env?.['WEBSOCKET_URL']) || (() => {
    const urlConfig = getUrlConfig();
    return urlConfig.WEBSOCKET_URL;
  })(),
  
  // AI Service endpoints
  AI_ENDPOINTS: {
    OPENAI: (typeof process !== 'undefined' && process?.env?.['OPENAI_ENDPOINT']) || AI_CONFIG.ENDPOINTS.OPENAI,
    OPENROUTER: (typeof process !== 'undefined' && process?.env?.['OPENROUTER_ENDPOINT']) || AI_CONFIG.ENDPOINTS.OPENROUTER,
    DEEPSEEK: (typeof process !== 'undefined' && process?.env?.['DEEPSEEK_ENDPOINT']) || AI_CONFIG.ENDPOINTS.DEEPSEEK,
    LOCAL_LLM: (typeof process !== 'undefined' && process?.env?.['LOCAL_LLM_ENDPOINT']) || AI_CONFIG.ENDPOINTS.LOCAL_LLM,
  },
  
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

// ========== EDGE CACHE ENHANCEMENT CONFIGURATION ==========
export const EDGE_CACHE_CONFIG = {
  // Memory and size constraints for edge deployment
  MAX_SIZE: 10 * 1024 * 1024, // 10MB for edge constraints
  MAX_ENTRIES: 1000, // Reduced for edge memory
  COMPRESSION_THRESHOLD: 1024, // 1KB
  CLEANUP_INTERVAL: 30 * 1000, // 30 seconds
  DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
  
  // Cache strategy TTL values
  STRATEGIES: {
    API_ROBOTS: 5 * 60 * 1000, // 5 minutes
    API_GENERATE: 2 * 60 * 1000, // 2 minutes  
    API_MARKET_DATA: 30 * 1000, // 30 seconds
    STATIC_ASSETS: 24 * 60 * 60 * 1000, // 24 hours
    PAGE_DASHBOARD: 10 * 60 * 1000, // 10 minutes
    PAGE_GENERATOR: 5 * 60 * 1000, // 5 minutes
  },
  
  // Optimization thresholds
  ACCESS_TIMES_RETENTION: 100,
  COMPRESSION_ENABLED: true,
  METRICS_ENABLED: true,
  REGION_SPECIFIC_DEFAULT: true,
};

// ========== CACHE SIZING CONFIGURATION ==========
export const CACHE_SIZING_CONFIG = {
  ROBOT_CACHE: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    DEFAULT_TTL: 600000, // 10 minutes
  },
  MARKET_DATA_CACHE: {
    MAX_SIZE: 20 * 1024 * 1024, // 20MB
    DEFAULT_TTL: 30000, // 30 seconds
  },
  ANALYSIS_CACHE: {
    MAX_SIZE: 30 * 1024 * 1024, // 30MB
    DEFAULT_TTL: 900000, // 15 minutes
  },
  DEFAULT_CACHE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    DEFAULT_TTL: 300000, // 5 minutes
    MAX_ENTRIES: 1000,
  }
};

// ========== BACKEND OPTIMIZATION CONFIGURATION ==========
export const BACKEND_OPTIMIZATION_CONFIG = {
  // Performance thresholds
  DATABASE_QUERY_TIME_THRESHOLD: 1000, // 1 second
  COLD_START_COUNT_THRESHOLD: 10,
  DATABASE_ERROR_RATE_THRESHOLD: 0.1, // 10%
  
  // Cache TTL values
  ROBOTS_LIST_TTL: 300000, // 5 minutes
  STRATEGIES_LIST_TTL: 600000, // 10 minutes
  
  // Monitoring intervals
  OPTIMIZATION_CHECK_INTERVAL: 2000, // 2 seconds
};

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
    AI_CONFIG,
    DEV_SERVER_CONFIG,
  };
  
  const sectionConfig = configMap[section];
  if (sectionConfig && key in sectionConfig) {
    return sectionConfig[key] as T;
  }
  
  throw new Error(`Configuration key '${key}' not found in section '${section}'`);
};

// ========== DATABASE CONFIGURATION ==========
export const DATABASE_CONFIG = {
  RETRY: {
    DELAYS: {
      BASE: 1000,
      MAX: 5000,
      BACKOFF_MULTIPLIER: 2,
    },
    MAX_ATTEMPTS: 3,
    NON_RETRYABLE_ERRORS: [
      'PGRST116', // Not found
      'PGRST301', // Permission denied
      '42501',    // Insufficient privilege
      '23505',    // Unique violation
      '23503',    // Foreign key violation
    ],
    NON_RETRYABLE_STATUS_CODES: [400, 401, 403, 404, 422],
    EDGE_SPECIFIC_ERRORS: [
      'EDGE_FUNCTION_TIMEOUT',
      'EDGE_MEMORY_LIMIT',
      'EDGE_RATE_LIMIT'
    ],
  },
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 3,
    RESET_TIMEOUT: TIME_CONSTANTS.MINUTE * 0.5, // 30 seconds
    MONITORING_PERIOD: 10000, // 10 seconds
    SUCCESS_THRESHOLD: 3, // Need 3 successes to close
  },
  POOL: {
    ACQUIRE_TIMEOUT: 5000,
    IDLE_TIMEOUT: TIME_CONSTANTS.MINUTE * 0.5, // 30 seconds
    HEALTH_CHECK_INTERVAL: 10000,
    RETRY_DELAY: 1000,
    MAX_SIZE: 100,
    MAX_RESPONSE_TIME_SAMPLES: 100,
  }
};

// ========== CIRCUIT BREAKER CONFIGURATION ==========
export const CIRCUIT_BREAKER_CONFIG = {
  DEFAULT_FAILURE_THRESHOLD: 3,
  DEFAULT_RESET_TIMEOUT: TIME_CONSTANTS.MINUTE * 0.5, // 30 seconds
  DEFAULT_MONITORING_PERIOD: 10000, // 10 seconds
  SUCCESS_THRESHOLD: 3,
};

// ========== EDGE MONITORING CONFIGURATION ==========
export const EDGE_MONITORING_CONFIG = {
  METRICS: {
    COLLECTION_INTERVAL: TIME_CONSTANTS.CLEANUP_SHORT_INTERVAL, // 30 seconds
    MAX_IN_MEMORY: 1000,
    PERFORMANCE_SUMMARY_LIMIT: 10,
    MAX_CACHE_METRICS: 1000,
    ACCESS_TIMES_RETENTION: 100,
  },
  HEALTH_CHECKS: {
    MAX_PER_REGION: 100,
    MAX_RESPONSE_TIME: 1000, // 1 second
  },
  ALERTS: {
    MAX_RETAINED: 100,
    RESPONSE_TIME_THRESHOLD: 1000, // 1 second
    ERROR_RATE_THRESHOLD: 0.05, // 5%
    MEMORY_USAGE_THRESHOLD: 80, // 80%
  }
};

// ========== AI CACHE CONFIGURATION ENHANCEMENTS ==========
export const AI_CACHE_ENHANCED = {
  HASH_SUBSTRING_LENGTH: 1000,
  DEFAULT_ESTIMATE_SIZE: 1000,
  SEMANTIC_THRESHOLD: 0.85,
  PROMOTION_THRESHOLD: 3,
  PROMOTION_SIZE_LIMIT: 5000,
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
  AI_CONFIG,
  DEV_SERVER_CONFIG,
  DATABASE_CONFIG,
  CIRCUIT_BREAKER_CONFIG,
  EDGE_MONITORING_CONFIG,
  AI_CACHE_ENHANCED,
  getEnvironmentConfig,
  getConfig,
};