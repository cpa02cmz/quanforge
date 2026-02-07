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

export const TIMEOUTS = {
  HEALTH_CHECK: 30000, // 30 seconds - health check intervals
  CACHE_TTL: 300000, // 5 minutes - default cache time-to-live
  PERFORMANCE_THRESHOLD: 3000, // 3 seconds - performance monitoring thresholds
  API_TIMEOUT: 30000, // 30 seconds - API request timeouts
  HEARTBEAT_INTERVAL: 30000, // 30 seconds - websocket heartbeat
  CONNECTION_TIMEOUT: 30000, // 30 seconds - connection establishment timeout
  RETRY_DELAY: 30000, // 30 seconds - retry delay for failed requests
  METRICS_UPDATE_INTERVAL: 30000, // 30 seconds - metrics update interval
  MONITORING_INTERVAL: 300000, // 5 minutes - background monitoring interval
} as const;

export const PERFORMANCE_THRESHOLDS = {
  FCP_GOOD: 1800, // 1.8 seconds - First Contentful Paint good threshold
  FCP_POOR: 3000, // 3 seconds - First Contentful Paint poor threshold
  PAGE_LOAD_THRESHOLD: 3000, // 3 seconds - page load time warning threshold
  WARNING_SIZE: 200000, // 200KB - bundle size warning
  CRITICAL_SIZE: 300000, // 300KB - bundle size critical
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
// Lazy load translations
export const loadTranslations = async (language: Language) => {
  const translations = await import(`./translations/${language}.js`);
  return translations.TRANSLATIONS;
};

// Lazy load wiki content
export const loadWikiContent = async (language: Language) => {
  // Check if wiki directory exists, otherwise return empty content
  try {
    const wiki = await import(`./wiki/${language}.js`);
    return wiki.WIKI_CONTENT || [];
  } catch (e) {
    if (import.meta.env.DEV) {
      logger.warn(`Wiki content not found for language: ${language}`, e);
    }
    return []; // Return empty array as fallback
  }
};

// Load suggested strategies
export const loadSuggestedStrategies = async (language: Language) => {
  const strategies = await import(`./strategies/${language}.js`);
  return strategies.SUGGESTED_STRATEGIES;
};