/**
 * UI Constants
 * Centralizes all UI-related hardcoded values for better maintainability
 * Flexy loves modularity! No hardcoded values allowed! 
 */

import { TIME_CONSTANTS } from './config';

// ========== ANIMATION TIMINGS ==========
export const ANIMATION_TIMINGS = {
  // Micro-interactions (fast feedback)
  MICRO: 50,                    // 50ms - micro-interactions
  INSTANT: 100,                 // 100ms - instant feedback
  FAST: 150,                    // 150ms - fast transitions
  
  // Standard transitions
  NORMAL: 200,                  // 200ms - standard transitions
  SMOOTH: 300,                  // 300ms - smooth animations
  RELAXED: 400,                 // 400ms - relaxed pace
  
  // Emphasis animations
  SLOW: 500,                    // 500ms - emphasis
  DRAMATIC: 800,                // 800ms - dramatic effects
  
  // Stagger delays
  STAGGER_MICRO: 25,            // 25ms between items
  STAGGER_FAST: 50,             // 50ms between items
  STAGGER_NORMAL: 100,          // 100ms between items
  STAGGER_SLOW: 150,            // 150ms between items
} as const;

// ========== UI DURATIONS ==========
export const UI_DURATIONS = {
  // Toast notifications
  TOAST_SHORT: 2 * TIME_CONSTANTS.SECOND,      // 2 seconds
  TOAST_NORMAL: 3 * TIME_CONSTANTS.SECOND,     // 3 seconds
  TOAST_LONG: 5 * TIME_CONSTANTS.SECOND,       // 5 seconds
  
  // Feedback indicators
  COPY_FEEDBACK: 2 * TIME_CONSTANTS.SECOND,    // 2 seconds
  DIRECTION_INDICATOR: 800,                    // 0.8 seconds
  
  // Tooltip delays
  TOOLTIP_SHOW_DELAY: 200,                     // 200ms
  TOOLTIP_HIDE_DELAY: 100,                     // 100ms
  
  // Loading states
  LOADING_MIN_DISPLAY: 500,                    // 500ms minimum
  SKELETON_FADE_IN: 300,                       // 300ms
  
  // Modal/Popup
  MODAL_OPEN_DELAY: 50,                        // 50ms
  MODAL_CLOSE_DELAY: 200,                      // 200ms
  DROPDOWN_DELAY: 150,                         // 150ms
} as const;

// ========== DEBOUNCE/THROTTLE TIMINGS ==========
export const INPUT_TIMINGS = {
  // Debounce delays
  DEBOUNCE_SEARCH: 300,                        // 300ms for search
  DEBOUNCE_INPUT: 150,                         // 150ms for input
  DEBOUNCE_RESIZE: 200,                        // 200ms for resize
  DEBOUNCE_SCROLL: 100,                        // 100ms for scroll
  
  // Throttle limits
  THROTTLE_SCROLL: 16,                         // 16ms (~60fps)
  THROTTLE_RESIZE: 100,                        // 100ms
  THROTTLE_MOUSE: 50,                          // 50ms
} as const;

// ========== POLLING INTERVALS ==========
export const POLLING_INTERVALS = {
  // Real-time updates
  REALTIME_FAST: 1 * TIME_CONSTANTS.SECOND,    // 1 second
  REALTIME_NORMAL: 5 * TIME_CONSTANTS.SECOND,  // 5 seconds
  REALTIME_SLOW: 30 * TIME_CONSTANTS.SECOND,   // 30 seconds
  
  // Background sync
  SYNC_FAST: 10 * TIME_CONSTANTS.SECOND,       // 10 seconds
  SYNC_NORMAL: 30 * TIME_CONSTANTS.SECOND,     // 30 seconds
  SYNC_SLOW: TIME_CONSTANTS.MINUTE,            // 1 minute
  
  // Health checks
  HEALTH_FAST: 5 * TIME_CONSTANTS.SECOND,      // 5 seconds
  HEALTH_NORMAL: 15 * TIME_CONSTANTS.SECOND,   // 15 seconds
  HEALTH_SLOW: TIME_CONSTANTS.MINUTE,          // 1 minute
} as const;

// ========== UI DIMENSIONS ==========
export const UI_DIMENSIONS = {
  // Touch targets (accessibility)
  TOUCH_TARGET_MIN: 44,                        // 44px minimum
  TOUCH_TARGET_COMFORTABLE: 48,                // 48px comfortable
  TOUCH_TARGET_LARGE: 56,                      // 56px large
  
  // Spacing scale
  SPACE_XS: 4,                                 // 4px
  SPACE_SM: 8,                                 // 8px
  SPACE_MD: 16,                                // 16px
  SPACE_LG: 24,                                // 24px
  SPACE_XL: 32,                                // 32px
  SPACE_2XL: 48,                               // 48px
  
  // Border radius
  RADIUS_SM: 4,                                // 4px
  RADIUS_MD: 8,                                // 8px
  RADIUS_LG: 12,                               // 12px
  RADIUS_XL: 16,                               // 16px
  RADIUS_FULL: 9999,                           // Full rounded
  
  // Z-index scale
  Z_BASE: 0,
  Z_DROPDOWN: 100,
  Z_STICKY: 200,
  Z_FIXED: 300,
  Z_MODAL_BACKDROP: 400,
  Z_MODAL: 500,
  Z_POPOVER: 600,
  Z_TOOLTIP: 700,
  Z_TOAST: 800,
  Z_MAX: 9999,
} as const;

// ========== VIRTUAL SCROLL ==========
export const VIRTUAL_SCROLL_CONFIG = {
  OVERSCAN: 5,                                 // Items to render outside viewport
  ITEM_HEIGHT_DEFAULT: 280,                    // Default item height in px
  ITEM_HEIGHT_SMALL: 64,                       // Small item height
  ITEM_HEIGHT_LARGE: 400,                      // Large item height
  BUFFER_SIZE: 3,                              // Buffer multiplier
} as const;

// ========== PAGINATION ==========
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MIN_PAGE_SIZE: 5,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MAX_VISIBLE_PAGES: 5,
} as const;

// ========== SCROLL BEHAVIOR ==========
export const SCROLL_CONFIG = {
  // Offset for sticky headers
  STICKY_HEADER_OFFSET: 64,                    // 64px
  
  // Scroll padding
  SCROLL_PADDING: 16,                          // 16px padding
  
  // Smooth scroll settings
  SMOOTH_SCROLL_BEHAVIOR: 'smooth' as const,
  AUTO_SCROLL_BEHAVIOR: 'auto' as const,
  
  // Thresholds
  INFINITE_SCROLL_THRESHOLD: 100,              // 100px from bottom
  SCROLL_TO_TOP_THRESHOLD: 300,                // Show button after 300px
} as const;

// ========== FORM VALIDATION ==========
export const FORM_CONFIG = {
  // Validation delays
  VALIDATE_ON_BLUR: true,
  VALIDATE_ON_CHANGE_DELAY: 300,               // 300ms
  
  // Character limits
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  MAX_EMAIL_LENGTH: 255,
  
  // Display limits
  MAX_DISPLAY_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_TAG_LENGTH: 30,
} as const;

// ========== FILE UPLOAD ==========
export const UPLOAD_CONFIG = {
  // Size limits
  MAX_FILE_SIZE_SMALL: 1 * 1024 * 1024,        // 1MB
  MAX_FILE_SIZE_MEDIUM: 5 * 1024 * 1024,       // 5MB
  MAX_FILE_SIZE_LARGE: 10 * 1024 * 1024,       // 10MB
  
  // Chunk sizes
  CHUNK_SIZE_SMALL: 64 * 1024,                 // 64KB
  CHUNK_SIZE_MEDIUM: 256 * 1024,               // 256KB
  CHUNK_SIZE_LARGE: 1024 * 1024,               // 1MB
  
  // Allowed types
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'text/plain', 'application/json'],
} as const;

// Default export
export const UI_CONSTANTS = {
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
} as const;
