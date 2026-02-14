/**
 * UI Component Configuration Constants
 * Flexy loves modularity! Centralized UI configuration
 */

// ========== TEXT INPUT LIMITS ==========
export const TEXT_INPUT_LIMITS = {
  // Chat message limits
  CHAT_MESSAGE_SHORT: 1000,
  CHAT_MESSAGE_MEDIUM: 5000,
  CHAT_MESSAGE_LONG: 10000,
  
  // Code/content limits
  CODE_DISPLAY_MAX: 10000,
  CODE_DISPLAY_TRUNCATED: 1000,
  
  // General input limits
  INPUT_SHORT: 100,
  INPUT_MEDIUM: 500,
  INPUT_LONG: 2000,
} as const;

// ========== DISPLAY LIMITS ==========
export const DISPLAY_LIMITS = {
  // Pagination
  ITEMS_PER_PAGE_SMALL: 10,
  ITEMS_PER_PAGE_DEFAULT: 20,
  ITEMS_PER_PAGE_LARGE: 50,
  
  // List rendering
  MAX_LIST_ITEMS: 100,
  VIRTUAL_SCROLL_OVERSCAN: 5,
  
  // Character display
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_TITLE_LENGTH: 100,
} as const;

// ========== ANIMATION TIMING ==========
export const ANIMATION_TIMING = {
  // Durations (ms)
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
  
  // Delays
  STAGGER_DELAY: 50,
  TRANSITION_DELAY: 100,
} as const;

// ========== VIRTUAL SCROLL CONFIGURATION ==========
export const VIRTUAL_SCROLL_CONFIG = {
  // Window sizes
  VIEWPORT_SIZE: 20,
  BUFFER_SIZE: 10,
  MAX_MESSAGES: 100,
  
  // Memory pressure thresholds
  MEMORY_PRESSURE_MESSAGE_THRESHOLD: 50,
  
  // Monitoring intervals (ms)
  MONITORING_INTERVAL_LARGE: 5000,
  MONITORING_INTERVAL_NORMAL: 10000,
  MONITORING_INTERVAL_THRESHOLD: 100,
} as const;

// ========== CHARACTER COUNT CONFIGURATION ==========
export const CHARACTER_COUNT_CONFIG = {
  // Input limits
  MAX_INPUT_LENGTH: 1000,
  
  // Warning thresholds
  WARNING_THRESHOLD: 900,
  CRITICAL_THRESHOLD: 950,
  
  // Display format
  DISPLAY_FORMAT: '/1000',
} as const;

// Type exports
export type TextInputLimits = typeof TEXT_INPUT_LIMITS;
export type DisplayLimits = typeof DISPLAY_LIMITS;
export type AnimationTiming = typeof ANIMATION_TIMING;

// Default export
export const UI_CONFIG = {
  TEXT_LIMITS: TEXT_INPUT_LIMITS,
  DISPLAY: DISPLAY_LIMITS,
  ANIMATION: ANIMATION_TIMING,
  VIRTUAL_SCROLL: VIRTUAL_SCROLL_CONFIG,
  CHARACTER_COUNT: CHARACTER_COUNT_CONFIG,
} as const;
