import { Language } from "../types";
import { logger } from "../utils/logger";

export const TIMEFRAMES = [
  'M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'
];

export const STRATEGY_TYPES = [
  'Trend Following',
  'Scalping',
  'Grid System',
  'Breakout',
  'Mean Reversion',
  'Multi-Currency'
];

export const MQL5_SYSTEM_PROMPT = `
You are an elite automated trading systems engineer specializing in MQL5 (MetaQuotes Language 5).
Your task is to generate robust, compile-ready, and professional-grade MQL5 code for Expert Advisors (trading robots).

Rules:
1. Always include standard MQL5 libraries when necessary (e.g., #include <Trade\\Trade.mqh>).
2. Structure the code with clear inputs, global variables, OnInit(), OnDeinit(), and OnTick() functions.
3. Use the CTrade class for order execution logic to ensure reliability.
4. Add comments explaining complex logic.
5. If the user asks for a modification, output the FULL modified code.
6. Handle errors gracefully (e.g., check return codes for OrderSend).
7. Do not use deprecated MQL4 functions like OrderSelect, Point (use _Point), Ask/Bid (use SymbolInfoDouble).

ADVANCED LOGIC INSTRUCTIONS:
- Multi-Currency/Correlation: If the user asks to check another symbol (e.g. "Buy BTC if Gold is up"), use \`SymbolInfoDouble("XAUUSD", ...)\` or \`iClose("XAUUSD", ...)\`. Ensure you handle error checks if the other symbol data is not ready.
- Always use \`SymbolInfoDouble(_Symbol, ...)\` for the current chart symbol.

CRITICAL OUTPUT RESTRICTIONS:
- NO PLACEHOLDERS: Do not use comments like "// ... existing code ..." or "// ... rest of logic". You must output the COMPLETE file every time.
- NO LAZY CODING: Do not skip standard event handlers.
- If the user asks a question that DOES NOT require code changes (e.g., "How does this work?"), provide a text explanation ONLY. Do not output code blocks.
- If the user asks for code creation or modification:
  1. Provide a concise explanation of the changes first.
  2. Then, provide the COMPLETE MQL5 code wrapped in a markdown code block (e.g., \`\`\`cpp ... \`\`\`).
`;

export const DEFAULT_STRATEGY_PARAMS = {
  timeframe: 'H1',
  symbol: 'BTCUSDT',
  riskPercent: 1.0,
  stopLoss: 50, // Pips
  takeProfit: 100, // Pips
  magicNumber: 123456,
  customInputs: []
};

// Timeouts in milliseconds - centralized for consistency across the application
export const TIMEOUTS = {
  // Short timeouts (1-5 seconds)
  QUICK_OPERATION: 5000, // 5 seconds - quick operations
  CIRCUIT_BREAKER_FAST: 5000, // 5 seconds - fast circuit breaker timeout
  RETRY_BASE_DELAY: 1000, // 1 second - base retry delay
  POOL_ACQUIRE: 5000, // 5 seconds - connection pool acquire timeout

  // Medium timeouts (10-30 seconds)
  API_REQUEST: 10000, // 10 seconds - standard API request timeout
  CIRCUIT_BREAKER_SLOW: 15000, // 15 seconds - slow operation circuit breaker
  BACKUP_VERIFICATION: 10000, // 10 seconds - backup verification timeout
  BUILD_TIME: 10000, // 10 seconds - build time threshold
  METRICS_CLEANUP: 10000, // 10 seconds - metrics cleanup interval
  POOL_HEALTH_CHECK: 10000, // 10 seconds - pool health check interval

  // Long timeouts (30+ seconds)
  HEALTH_CHECK: 30000, // 30 seconds - health check intervals
  CIRCUIT_BREAKER_RESET: 30000, // 30 seconds - circuit breaker reset timeout
  CACHE_TTL: 300000, // 5 minutes - default cache time-to-live
  PERFORMANCE_THRESHOLD: 3000, // 3 seconds - performance monitoring thresholds
  API_TIMEOUT: 30000, // 30 seconds - API request timeouts
  HEARTBEAT_INTERVAL: 30000, // 30 seconds - websocket heartbeat
  CONNECTION_TIMEOUT: 30000, // 30 seconds - connection establishment timeout
  RETRY_DELAY: 30000, // 30 seconds - retry delay for failed requests
  METRICS_UPDATE_INTERVAL: 30000, // 30 seconds - metrics update interval
  MONITORING_INTERVAL: 300000, // 5 minutes - background monitoring interval
  AUTO_CLEANUP_INTERVAL: 300000, // 5 minutes - auto cleanup interval
  BACKUP_CRITICAL_THRESHOLD: 30000, // 30 seconds - backup critical threshold
  CACHE_CLEANUP_INTERVAL: 30000, // 30 seconds - cache cleanup interval
  COALESCER_CLEANUP: 30000, // 30 seconds - request coalescer cleanup
  COALESCER_CLEANUP_FAST: 15000, // 15 seconds - fast coalescer cleanup
  DEDUPLICATOR_MAX_AGE: 30000, // 30 seconds - deduplicator max age
  DEDUPLICATOR_CACHE_TTL: 300000, // 5 minutes - deduplicator cache TTL
  LRU_CACHE_TTL: 300000, // 5 minutes - LRU cache TTL
  REALTIME_SYNC_INTERVAL: 30000, // 30 seconds - realtime sync interval
  EDGE_CACHE_TTL: 30000, // 30 seconds - edge cache TTL
  POOL_IDLE_TIMEOUT: 30000, // 30 seconds - pool idle timeout
  MAX_RETRY_DELAY: 30000, // 30 seconds - max retry delay
} as const;

// Circuit Breaker Configuration
export const CIRCUIT_BREAKER = {
  CLOSE_THRESHOLD: 3, // Consecutive successes needed to close circuit
  DEFAULT_FAILURE_THRESHOLD: 5, // Default failures before opening circuit
  AI_FAILURE_THRESHOLD: 3, // AI service specific threshold
  MARKET_DATA_FAILURE_THRESHOLD: 7, // Market data specific threshold
  RESET_TIMEOUT_DB: 60000, // 1 minute - database recovery
  RESET_TIMEOUT_MARKET: 120000, // 2 minutes - market data recovery
} as const;

// Retry Configuration
export const RETRY = {
  DEFAULT_MAX_RETRIES: 3, // Default max retry attempts
  BACKOFF_BASE: 1000, // Base delay for exponential backoff (1 second)
  REALTIME_MAX_RETRIES: 3, // Realtime subscription max retries
} as const;

export const PERFORMANCE_THRESHOLDS = {
  FCP_GOOD: 1800, // 1.8 seconds - First Contentful Paint good threshold
  FCP_POOR: 3000, // 3 seconds - First Contentful Paint poor threshold
  PAGE_LOAD_THRESHOLD: 3000, // 3 seconds - page load time warning threshold
  WARNING_SIZE: 200000, // 200KB - bundle size warning
  CRITICAL_SIZE: 300000, // 300KB - bundle size critical
  CLS_GOOD: 0.1, // Cumulative Layout Shift good threshold
  CLS_POOR: 0.25, // Cumulative Layout Shift poor threshold
} as const;

// UI Timing Constants
export const UI_TIMING = {
  TOAST_DURATION: 3000, // 3 seconds
  COPY_FEEDBACK_DURATION: 2000, // 2 seconds
  DIRECTION_INDICATOR_DURATION: 800, // 0.8 seconds
  MEMORY_MONITOR_INTERVAL_LARGE: 5000, // 5 seconds
  MEMORY_MONITOR_INTERVAL_NORMAL: 10000, // 10 seconds
  MAX_CHAT_HISTORY_LENGTH: 5000, // Maximum messages to retain
  PERFORMANCE_INSIGHTS_INTERVAL: 5000, // 5 seconds
  FILTER_CACHE_TTL: 5000, // 5 seconds
  FADE_TRANSITION_DURATION: 300, // 300ms
} as const;

// Virtual Scroll Constants
export const VIRTUAL_SCROLL = {
  OVERSCAN: 5, // Number of items to render outside viewport
  ITEM_HEIGHT: 280, // Height of each robot card in px
} as const;

// Cache and Query Limits
export const CACHE_LIMITS = {
  DEFAULT_QUERY_LIMIT: 100, // Default limit for database queries
  ROBOT_CACHE_SIZE: 200, // Maximum items in robot cache
  ANALYTICS_CACHE_SIZE: 100, // Maximum items in analytics cache
  MARKET_DATA_CACHE_SIZE: 50, // Maximum items in market data cache
  CACHE_HISTORY_LIMIT: 100, // Maximum history entries to retain
} as const;

// Batch Processing Sizes
export const BATCH_SIZES = {
  DATABASE_OPERATIONS: 10, // Batch size for DB operations
  PAGINATION_DEFAULT: 20, // Default items per page
  PAGINATION_MAX: 100, // Maximum items per page
  PREFETCH_BATCH: 20, // Batch size for prefetch operations
  REALTIME_SYNC: 50, // Batch size for realtime sync operations
} as const;

// Performance Thresholds (ms)
export const PERF_THRESHOLDS = {
  QUERY_SLOW: 500, // Slow query threshold
  QUERY_CRITICAL: 1000, // Critical query threshold
  CACHE_LOW_HIT_RATE: 30, // Low cache hit rate percentage
  MEMORY_CLEANUP_THRESHOLD: 1000, // Memory cleanup trigger
} as const;

// Performance Score Thresholds (for UI indicators)
export const PERFORMANCE_SCORE_THRESHOLDS = {
  EXCELLENT: 80, // Score >= 80 is considered excellent
  GOOD: 60, // Score >= 60 is considered good
  POOR: 0, // Score < 60 needs improvement
} as const;

// Connection Pool Configuration
export const CONNECTION_POOL = {
  IDLE_TIMEOUT: 45000, // 45 seconds - idle timeout for connections
  HEALTH_CHECK_INTERVAL: 15000, // 15 seconds - health check interval
  CONNECTION_TIMEOUT: 800, // 0.8 seconds - connection timeout
  ACQUIRE_TIMEOUT: 300, // 0.3 seconds - acquire timeout
  RETRY_DELAY: 300, // 0.3 seconds - retry delay
  MAX_CONNECTIONS: 100, // Maximum connections in pool
  RECENT_USAGE_THRESHOLD: 30000, // 30 seconds - recent usage threshold
  REGION_MATCH_BONUS: 2000, // Score bonus for region match
  HEALTHY_BONUS: 500, // Score bonus for healthy connection
  LATENCY_MULTIPLIER: 1000, // Latency calculation multiplier
} as const;

// Edge Metrics Configuration
export const EDGE_METRICS = {
  DEFAULT_TIME_WINDOW: 300000, // 5 minutes default time window
  MAX_METRICS_SIZE: 1000, // Maximum metrics entries
  CACHE_EFFICIENCY_BASELINE: 10, // 10ms per request baseline
  DEFAULT_SCORE: 100, // Default score base
  COMPRESSION_RATIO_PRECISION: 100, // For rounding
} as const;

// API Response Time Thresholds (ms)
export const API_RESPONSE_THRESHOLDS = {
  EXCELLENT: 200, // Excellent response time
  GOOD: 500, // Good response time
  NEEDS_IMPROVEMENT: 1000, // Needs improvement
  POOR: 2000, // Poor response time
} as const;

// Score Calculation Constants
export const SCORE_CALCULATION = {
  MAX_SCORE: 100, // Maximum score value
  MIN_SCORE: 0, // Minimum score value
  PERCENTAGE_MULTIPLIER: 100, // For percentage calculations
  SCORE_RATIO_MULTIPLIER: 50, // For ratio-based scoring
} as const;

// Error Codes and Status Codes
export const ERROR_CODES = {
  // HTTP Status Codes
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
  BAD_REQUEST: 400,
  
  // Supabase Error Codes
  CONNECTION_ERROR: 1014,
  RECORD_NOT_FOUND: 'PGRST116',
  
  // Thresholds
  CLIENT_ERROR_MIN: 400,
  CLIENT_ERROR_MAX: 499,
  SERVER_ERROR_MIN: 500,
} as const;

// Memory and History Limits
export const MEMORY_LIMITS = {
  MAX_HISTORY_SIZE: 100, // Maximum history entries
  MAX_METRICS_RETENTION: 1000, // Maximum metrics to retain
  MAX_LOGS: 1000, // Maximum log entries
  MAX_SAMPLES: 100, // Maximum samples for calculations
} as const;

// Stagger and Delay Configuration
export const STAGGER_CONFIG = {
  DEFAULT_DELAY: 100, // Default stagger delay in ms
  IMPORT_STAGGER: 1000, // Stagger for imports (1 second)
  HEALTH_CHECK_TIMEOUT: 2000, // Health check timeout (2 seconds)
  WARMUP_TIMEOUT: 2000, // Warmup timeout (2 seconds)
  MAX_EXPONENTIAL_DELAY: 5000, // Max exponential backoff delay
} as const;

// UX and Interaction Thresholds
export const UX_THRESHOLDS = {
  LCP_GOOD: 2500, // Largest Contentful Paint - good
  LCP_AVERAGE: 4000, // Largest Contentful Paint - average
  LCP_POOR: 6000, // Largest Contentful Paint - poor
  FID_GOOD: 100, // First Input Delay - good
  FID_AVERAGE: 300, // First Input Delay - average
  FID_POOR: 500, // First Input Delay - poor
  TTFB_GOOD: 800, // Time to First Byte - good
  TTFB_AVERAGE: 1800, // Time to First Byte - average
  TTFB_POOR: 3000, // Time to First Byte - poor
  INP_GOOD: 200, // Interaction to Next Paint - good
} as const;

// Cache and Storage TTLs
export const CACHE_TTLS = {
  SEMANTIC_CACHE: 900000, // 15 minutes
  MQL5_GENERATION: 1800000, // 30 minutes
  STRATEGY_ANALYSIS: 7200000, // 2 hours
  ENHANCED_ANALYSIS: 600000, // 10 minutes
  EDGE_CACHE: 30000, // 30 seconds
  KV_CLEANUP: 300000, // 5 minutes
  POOL_WARMUP: 1800000, // 30 minutes
} as const;

// Lazy load translations with error handling
export const loadTranslations = async (language: Language) => {
  try {
    const translations = await import(`./translations/${language}.ts`);
    return translations.TRANSLATIONS || {};
  } catch (_e) {
    // Fallback to empty translations if file not found
    if (import.meta.env.DEV) {
      logger.debug(`Translations not found for language: ${language}`);
    }
    return {};
  }
};

// Lazy load wiki content
export const loadWikiContent = async (language: Language) => {
  // Check if wiki directory exists, otherwise return empty content
  try {
    const wiki = await import(`./wiki/${language}.js`);
    return wiki.WIKI_CONTENT || [];
  } catch (e: unknown) {
    if (import.meta.env.DEV) {
      logger.warn(`Wiki content not found for language: ${language}`, e);
    }
    return []; // Return empty array as fallback
  }
};

// Load suggested strategies with error handling
export const loadSuggestedStrategies = async (language: Language) => {
  try {
    const strategies = await import(`./strategies/${language}.ts`);
    return strategies.SUGGESTED_STRATEGIES || [];
  } catch (_e) {
    // Fallback to empty strategies if file not found
    if (import.meta.env.DEV) {
      logger.debug(`Strategies not found for language: ${language}`);
    }
    return [];
  }
};

// Re-export time constants for backward compatibility
export { TIME_CONSTANTS } from './config';

// Export modular simulation constants
export {
  SIMULATION_CONSTANTS,
  SIMULATION_TIME,
  RISK_CONFIG,
  PROFITABILITY_CONFIG,
  WIN_RATE_CONFIG,
  MONTE_CARLO_CONFIG,
  BALANCE_CONFIG,
  SIMULATION_PARAMS,
} from './simulation';

// Export Flexy's new modular constants
export {
  STRING_TRUNCATION,
  STATUS_TYPES,
  ARRAY_LIMITS,
  SCORE_CALCULATION as MODULAR_SCORE_CALCULATION,
  DISPLAY_FORMAT,
} from './modularConfig';

// Export UI constants (Flexy's modular system)
export {
  UI_CONSTANTS,
  ANIMATION_TIMINGS,
  UI_DURATIONS,
  INPUT_TIMINGS,
  POLLING_INTERVALS,
  UI_DIMENSIONS,
  VIRTUAL_SCROLL_CONFIG,
  PAGINATION_CONFIG,
  SCROLL_CONFIG,
  FORM_CONFIG,
  UPLOAD_CONFIG,
} from './ui';

// Export modular animation constants
export {
  UI_ANIMATION,
  TYPING_ANIMATION,
  FADE_TIMING,
  STAGGER_ANIMATION,
  LOADING_ANIMATION,
  INTERACTIVE_ANIMATION,
  TOAST_ANIMATION,
  MODAL_ANIMATION,
  CHART_ANIMATION,
  SCROLL_ANIMATION,
  FORM_ANIMATION,
  PARTICLE_ANIMATION,
  COPY_BUTTON_ANIMATION,
  CSS_DURATION,
  ANIMATION_INTERVALS,
  EASING,
  ANIMATION_PERFORMANCE,
} from './animations';

// ============================================
// Flexy's Modular Configuration System 🎯
// ============================================
// Import all configurations from this single entry point:
//   import { SERVICE_TIMEOUTS, CACHE_SIZES, RETRY_CONFIGS } from '@/constants';
// Or import specific modules:
//   import { SERVICE_TIMEOUTS } from '@/constants/modularConfig';

export {
  // Main configuration objects
  WEBSOCKET_CONFIG,
  CACHE_SIZES as MODULAR_CACHE_SIZES,
  SERVICE_TIMEOUTS,
  RETRY_CONFIGS,
  CIRCUIT_BREAKER_CONFIGS,
  MONITORING_INTERVALS,
  POOL_CONFIGS,
  RATE_LIMITS as MODULAR_RATE_LIMITS,
  VALIDATION_LIMITS as MODULAR_VALIDATION_LIMITS,
  TOKEN_CONFIG,
  BACKUP_CONFIG,
  EDGE_CONFIG as MODULAR_EDGE_CONFIG,
  AI_CONFIG as MODULAR_AI_CONFIG,
  MEMORY_CONFIG,
  BATCH_CONFIG as MODULAR_BATCH_CONFIG,
  
  // Flexy's new modular configs
  STORAGE_KEYS,
  STORAGE_PREFIXES,
  MAGIC_NUMBERS,
  SCORING_WEIGHTS,
  THRESHOLDS,

  // Flexy's latest modular additions
  ENCRYPTION_CONFIG,
  PROGRESSIVE_LOADING_CONFIG,
  HEALTH_DASHBOARD_CONFIG,

  // Helper functions
  getConfigValue,
  getTimeout,
  getCacheSize,
  getRetryConfig,

  // Combined app config
  APP_CONFIG as MODULAR_APP_CONFIG,
} from './modularConfig';

// Export UI Component Defaults (Flexy's modular system for component defaults)
export {
  UI_COMPONENT_DEFAULTS,
  ANIMATION_DEFAULTS,
  INTERACTION_DEFAULTS,
  PROGRESS_DEFAULTS,
  FORM_DEFAULTS,
  HAPTIC_DEFAULTS,
  NAVIGATION_DEFAULTS,
  MODAL_DEFAULTS,
  DATA_DISPLAY_DEFAULTS,
  CHAT_DEFAULTS,
  MARKET_DATA_DEFAULTS,
  ACCESSIBILITY_DEFAULTS,
} from './uiComponentDefaults';