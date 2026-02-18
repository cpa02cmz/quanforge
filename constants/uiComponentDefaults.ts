/**
 * UI Component Default Constants
 * Flexy's modular configuration for component default values
 * 
 * This module provides centralized default values for all UI components
 * eliminating magic numbers and hardcoded defaults.
 */

// ========== ANIMATION COMPONENT DEFAULTS ==========
export const ANIMATION_DEFAULTS = {
  /** Success checkmark animation */
  SUCCESS_CHECKMARK: {
    DURATION_MS: 600,
    DELAY_MS: 0,
    AUTO_HIDE_DELAY_MS: 2000,
    SIZE: 'md' as const,
    VARIANT: 'circle' as const,
  },
  
  /** Confetti celebration animation */
  CONFETTI: {
    DURATION_MS: 2500,
    COUNT: 60,
    SPREAD_DEGREES: 360,
    VELOCITY: 1,
    COLORS: [
      '#22c55e', '#4ade80', '#16a34a', '#86efac', 
      '#bbf7d0', '#fcd34d', '#fbbf24'
    ],
  },
  
  /** Celebration burst animation */
  CELEBRATION: {
    DURATION_MS: 1500,
    PARTICLE_COUNT: 30,
    ORIGIN: 'center' as const,
    COLORS: [
      '#22c55e', // brand green
      '#3b82f6', // blue
      '#f59e0b', // amber
      '#ec4899', // pink
      '#8b5cf6', // violet
      '#06b6d4', // cyan
      '#f97316', // orange
    ],
  },
  
  /** Shine effect animation */
  SHINE_EFFECT: {
    DURATION_MS: 800,
    COLOR: 'rgba(255, 255, 255, 0.15)',
    DIRECTION: 'left-to-right' as const,
  },
  
  /** Glow cursor effect */
  GLOW_CURSOR: {
    DELAY_MS: 50,
    BLUR_PX: 40,
    OPACITY: 0.5,
  },
  
  /** Flip card animation */
  FLIP_CARD: {
    DURATION_MS: 600,
    EASING: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  /** Hover card delay */
  HOVER_CARD: {
    DELAY_MS: 300,
  },
  
  /** Tooltip delay */
  TOOLTIP: {
    DELAY_MS: 200,
  },
  
  /** Keyboard shortcut hint delay */
  KEYBOARD_HINT: {
    DELAY_MS: 400,
  },
  
  /** Pulse indicator */
  PULSE_INDICATOR: {
    DELAY_MS: 0,
    SCALE_MIN: 0.8,
    SCALE_MAX: 1.2,
  },
  
  /** Text scramble effect */
  TEXT_SCRAMBLE: {
    DELAY_MS: 0,
    CHARS: '!<>-_\\/[]{}—=+*^?#________',
  },
  
  /** Typewriter text effect */
  TYPEWRITER: {
    DELAY_MS: 0,
    LINE_DELAY_MS: 1000,
    SPEED_MS: 50,
  },
  
  /** Animated counter */
  ANIMATED_COUNTER: {
    DURATION_MS: 500,
  },
  
  /** Shine effect on save button */
  SAVE_BUTTON: {
    SHINE_DELAY_MS: 600,
  },
  
  /** Typing indicator dots */
  TYPING_INDICATOR: {
    STAGGER_DELAY_S: 0.15, // 150ms between dots
    DOT_COUNT: 3,
  },
} as const;

// ========== INTERACTION DEFAULTS ==========
export const INTERACTION_DEFAULTS = {
  /** Press and hold button */
  PRESS_HOLD: {
    DURATION_MS: 1500,
    HOLDING_TEXT: 'Hold to confirm...',
    VARIANT: 'danger' as const,
    SIZE: 'md' as const,
  },
  
  /** Magnetic button */
  MAGNETIC_BUTTON: {
    STRENGTH: 0.3,
    RADIUS_PX: 100,
  },
  
  /** Like button */
  LIKE_BUTTON: {
    ANIMATION_DURATION_MS: 300,
  },
  
  /** Icon button */
  ICON_BUTTON: {
    PRESS_SCALE: 0.9,
    PRESS_DURATION_MS: 150,
  },
  
  /** Long press detection */
  LONG_PRESS: {
    DELAY_MS: 600,
    INTERVALS: {
      SLOW_MS: 400,
      MEDIUM_MS: 200,
      FAST_MS: 100,
      VERY_FAST_MS: 50,
    },
    THRESHOLDS: {
      TO_MEDIUM: 5,
      TO_FAST: 10,
      TO_VERY_FAST: 20,
    },
  },
} as const;

// ========== PROGRESS & LOADING DEFAULTS ==========
export const PROGRESS_DEFAULTS = {
  /** Progress bar */
  PROGRESS_BAR: {
    ANIMATION_DURATION_MS: 500,
  },
  
  /** Step indicator */
  STEP_INDICATOR: {
    ANIMATION_DURATION_MS: 300,
    COMPLETION_DURATION_MS: 500,
  },
  
  /** Reading progress bar */
  READING_PROGRESS: {
    UPDATE_INTERVAL_MS: 100,
  },
  
  /** Skeleton loading */
  SKELETON: {
    SHIMMER_DURATION_MS: 1500,
    STAGGER_DELAY_MS: 100,
  },
  
  /** Toast progress */
  TOAST_PROGRESS: {
    UPDATE_INTERVAL_MS: 16, // ~60fps
  },
} as const;

// ========== FORM COMPONENT DEFAULTS ==========
export const FORM_DEFAULTS = {
  /** Floating label input */
  FLOATING_LABEL: {
    ANIMATION_DURATION_MS: 200,
  },
  
  /** Character counter */
  CHARACTER_COUNTER: {
    WARNING_THRESHOLD_PERCENT: 80,
    CRITICAL_THRESHOLD_PERCENT: 95,
  },
  
  /** Form field */
  FORM_FIELD: {
    TRANSITION_DURATION_MS: 200,
  },
  
  /** Numeric input */
  NUMERIC_INPUT: {
    HOLD_DELAY_MS: 600,
    HOLD_INTERVAL_MS: 100,
    STEP_SMALL: 1,
    STEP_MEDIUM: 5,
    STEP_LARGE: 10,
  },
  
  /** Password input */
  PASSWORD_INPUT: {
    MIN_LENGTH: 8,
    STRENGTH_CHECK_DELAY_MS: 300,
  },
  
  /** Custom input row */
  CUSTOM_INPUT: {
    TRANSITION_DURATION_MS: 200,
  },
} as const;

// ========== HAPTIC FEEDBACK DEFAULTS ==========
export const HAPTIC_DEFAULTS = {
  /** Light tap */
  LIGHT: { pattern: 10, description: 'Light tap for subtle feedback' },
  /** Medium tap */
  MEDIUM: { pattern: 20, description: 'Medium tap for button presses' },
  /** Heavy tap */
  HEAVY: { pattern: 30, description: 'Heavy tap for important actions' },
  /** Success pattern - two quick pulses */
  SUCCESS: { pattern: [20, 50, 20], description: 'Success feedback' },
  /** Error pattern - single longer vibration */
  ERROR: { pattern: 60, description: 'Error or warning feedback' },
  /** Warning pattern - double pulse */
  WARNING: { pattern: [30, 50, 30], description: 'Warning feedback' },
  /** Selection change - very light tick */
  SELECTION: { pattern: 5, description: 'Selection change feedback' },
  /** Gesture start - light feedback */
  GESTURE_START: { pattern: 15, description: 'Gesture initiation feedback' },
  /** Gesture end - confirming feedback */
  GESTURE_END: { pattern: [15, 30, 15], description: 'Gesture completion feedback' },
} as const;

// ========== SCROLL & NAVIGATION DEFAULTS ==========
export const NAVIGATION_DEFAULTS = {
  /** Scroll to top button */
  SCROLL_TO_TOP: {
    SCROLL_DURATION_MS: 500,
    VISIBILITY_THRESHOLD_PX: 300,
  },
  
  /** Scroll to bottom button */
  SCROLL_TO_BOTTOM: {
    SCROLL_DURATION_MS: 500,
  },
  
  /** Virtual scroll */
  VIRTUAL_SCROLL: {
    OVERSCAN: 5,
    ITEM_HEIGHT_PX: 280,
    ESTIMATE_ITEM_HEIGHT_PX: 300,
  },
  
  /** Page transition */
  PAGE_TRANSITION: {
    DURATION_MS: 300,
  },
  
  /** Back button */
  BACK_BUTTON: {
    HOVER_SCALE: 1.05,
    TRANSITION_DURATION_MS: 200,
  },
} as const;

// ========== MODAL & OVERLAY DEFAULTS ==========
export const MODAL_DEFAULTS = {
  /** Confirmation modal */
  CONFIRMATION: {
    ANIMATION_DURATION_MS: 200,
  },
  
  /** AI Settings modal */
  AI_SETTINGS: {
    TRANSITION_DURATION_MS: 200,
  },
  
  /** Database settings modal */
  DATABASE_SETTINGS: {
    TRANSITION_DURATION_MS: 200,
  },
  
  /** Keyboard shortcuts modal */
  KEYBOARD_SHORTCUTS: {
    TRANSITION_DURATION_MS: 200,
  },
} as const;

// ========== DATA DISPLAY DEFAULTS ==========
export const DATA_DISPLAY_DEFAULTS = {
  /** Badge */
  BADGE: {
    TRANSITION_DURATION_MS: 300,
  },
  
  /** Empty state */
  EMPTY_STATE: {
    ANIMATION_DELAY_MS: 100,
    ICON_SIZE: 'lg' as const,
  },
  
  /** Spotlight card */
  SPOTLIGHT_CARD: {
    GLOW_OPACITY: 0.15,
    TRANSITION_DURATION_MS: 300,
  },
  
  /** Tilt card */
  TILT_CARD: {
    MAX_TILT_DEGREES: 10,
    PERSPECTIVE_PX: 1000,
    TRANSITION_DURATION_MS: 300,
  },
  
  /** Status indicator */
  STATUS_INDICATOR: {
    PULSE_DURATION_MS: 2000,
  },
  
  /** Health status indicator */
  HEALTH_STATUS: {
    UPDATE_INTERVAL_MS: 5000,
  },
} as const;

// ========== CHAT & MESSAGING DEFAULTS ==========
export const CHAT_DEFAULTS = {
  /** Chat interface */
  CHAT_INTERFACE: {
    SCROLL_DEBOUNCE_MS: 100,
    TYPING_INDICATOR_DELAY_MS: 500,
  },
  
  /** Send button */
  SEND_BUTTON: {
    PRESS_DURATION_MS: 150,
    SUCCESS_ANIMATION_MS: 300,
  },
  
  /** Copy button */
  COPY_BUTTON: {
    SUCCESS_DURATION_MS: 1500,
    FEEDBACK_DURATION_MS: 2000,
  },
} as const;

// ========== MARKET DATA DEFAULTS ==========
export const MARKET_DATA_DEFAULTS = {
  /** Market ticker */
  TICKER: {
    UPDATE_INTERVAL_MS: 5000,
    ANIMATION_INTERVAL_MS: 50,
    FADE_DURATION_MS: 500,
  },
} as const;

// ========== ACCESSIBILITY DEFAULTS ==========
export const ACCESSIBILITY_DEFAULTS = {
  /** Reduced motion */
  REDUCED_MOTION: {
    MEDIA_QUERY: '(prefers-reduced-motion: reduce)',
    DEFAULT_PREFERS_REDUCED: false,
  },
  
  /** Focus management */
  FOCUS: {
    RING_DURATION_MS: 150,
    SCROLL_PADDING_PX: 20,
  },
  
  /** Skip link */
  SKIP_LINK: {
    VISIBILITY_DURATION_MS: 5000,
  },
} as const;

// ========== DEFAULT EXPORT ==========
export const UI_COMPONENT_DEFAULTS = {
  ANIMATION: ANIMATION_DEFAULTS,
  INTERACTION: INTERACTION_DEFAULTS,
  PROGRESS: PROGRESS_DEFAULTS,
  FORM: FORM_DEFAULTS,
  HAPTIC: HAPTIC_DEFAULTS,
  NAVIGATION: NAVIGATION_DEFAULTS,
  MODAL: MODAL_DEFAULTS,
  DATA_DISPLAY: DATA_DISPLAY_DEFAULTS,
  CHAT: CHAT_DEFAULTS,
  MARKET_DATA: MARKET_DATA_DEFAULTS,
  ACCESSIBILITY: ACCESSIBILITY_DEFAULTS,
} as const;

export default UI_COMPONENT_DEFAULTS;
