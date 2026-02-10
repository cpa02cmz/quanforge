/**
 * UI Animation Constants
 * Centralized configuration for all UI animations and timing
 * 
 * Flexy Principle: No hardcoded timing values - all animations are configurable
 */

/**
 * Typing Animation Configuration
 * Used by useAnimatedPlaceholder hook
 */
export const TYPING_ANIMATION = {
  /** Speed of typing characters (ms per character) */
  TYPING_SPEED: 50,
  /** Speed of deleting characters (ms per character) */
  DELETE_SPEED: 30,
  /** Duration to pause after completing a word (ms) */
  PAUSE_DURATION: 2000,
  /** Minimum typing speed for accessibility */
  MIN_TYPING_SPEED: 20,
  /** Maximum typing speed */
  MAX_TYPING_SPEED: 200,
} as const;

/**
 * Fade and Transition Timing
 */
export const FADE_TIMING = {
  /** Quick fade duration (ms) */
  QUICK: 150,
  /** Standard fade duration (ms) */
  STANDARD: 300,
  /** Slow fade duration (ms) */
  SLOW: 500,
  /** Duration for content transitions */
  CONTENT: 400,
} as const;

/**
 * Stagger Animation Configuration
 */
export const STAGGER_ANIMATION = {
  /** Default delay between staggered items (ms) */
  DEFAULT_DELAY: 100,
  /** Fast stagger for quick sequences */
  FAST_DELAY: 50,
  /** Slow stagger for dramatic effect */
  SLOW_DELAY: 200,
  /** Maximum items to stagger at once */
  MAX_ITEMS: 20,
} as const;

/**
 * Loading and Skeleton Animations
 */
export const LOADING_ANIMATION = {
  /** Pulse animation duration (ms) */
  PULSE_DURATION: 2000,
  /** Shimmer animation duration (ms) */
  SHIMMER_DURATION: 1500,
  /** Minimum time to show loading state (ms) */
  MIN_DISPLAY_TIME: 500,
} as const;

/**
 * Interactive Element Animations
 */
export const INTERACTIVE_ANIMATION = {
  /** Button press feedback duration (ms) */
  BUTTON_PRESS: 100,
  /** Hover transition duration (ms) */
  HOVER_TRANSITION: 200,
  /** Focus ring animation duration (ms) */
  FOCUS_RING: 150,
  /** Scale effect for interactive elements */
  SCALE_EFFECT: 0.98,
} as const;

/**
 * Toast and Notification Animations
 */
export const TOAST_ANIMATION = {
  /** Duration of toast entrance animation (ms) */
  ENTER_DURATION: 300,
  /** Duration of toast exit animation (ms) */
  EXIT_DURATION: 200,
  /** Auto-dismiss delay (ms) */
  AUTO_DISMISS_DELAY: 3000,
  /** Minimum duration for error toasts (ms) */
  ERROR_MIN_DURATION: 5000,
} as const;

/**
 * Modal and Dialog Animations
 */
export const MODAL_ANIMATION = {
  /** Backdrop fade duration (ms) */
  BACKDROP_FADE: 200,
  /** Content scale/enter duration (ms) */
  CONTENT_ENTER: 300,
  /** Content exit duration (ms) */
  CONTENT_EXIT: 200,
  /** Delay before removing from DOM (ms) */
  REMOVE_DELAY: 300,
} as const;

/**
 * Chart and Data Visualization Animations
 */
export const CHART_ANIMATION = {
  /** Duration for data point transitions (ms) */
  DATA_TRANSITION: 750,
  /** Duration for axis animations (ms) */
  AXIS_ANIMATION: 500,
  /** Stagger delay for multiple series (ms) */
  SERIES_STAGGER: 100,
  /** Tooltip enter duration (ms) */
  TOOLTIP_ENTER: 150,
} as const;

/**
 * Scroll and Navigation Animations
 */
export const SCROLL_ANIMATION = {
  /** Smooth scroll duration (ms) */
  SMOOTH_SCROLL: 500,
  /** Parallax scroll factor */
  PARALLAX_FACTOR: 0.5,
  /** Scroll-triggered animation offset (px) */
  TRIGGER_OFFSET: 100,
} as const;

/**
 * Easing Functions (CSS cubic-bezier values)
 */
export const EASING = {
  /** Standard ease */
  STANDARD: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** Ease in */
  EASE_IN: 'cubic-bezier(0.4, 0, 1, 1)',
  /** Ease out */
  EASE_OUT: 'cubic-bezier(0, 0, 0.2, 1)',
  /** Ease in-out */
  EASE_IN_OUT: 'cubic-bezier(0.4, 0, 0.6, 1)',
  /** Bounce effect */
  BOUNCE: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  /** Spring effect */
  SPRING: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;

/**
 * Animation Performance Settings
 */
export const ANIMATION_PERFORMANCE = {
  /** Use will-change hint for animated elements */
  USE_WILL_CHANGE: true,
  /** Prefer reduced motion when user prefers */
  RESPECT_REDUCED_MOTION: true,
  /** Maximum simultaneous animations */
  MAX_CONCURRENT: 10,
} as const;

// Default export
export const UI_ANIMATION = {
  TYPING: TYPING_ANIMATION,
  FADE: FADE_TIMING,
  STAGGER: STAGGER_ANIMATION,
  LOADING: LOADING_ANIMATION,
  INTERACTIVE: INTERACTIVE_ANIMATION,
  TOAST: TOAST_ANIMATION,
  MODAL: MODAL_ANIMATION,
  CHART: CHART_ANIMATION,
  SCROLL: SCROLL_ANIMATION,
  EASING,
  PERFORMANCE: ANIMATION_PERFORMANCE,
} as const;

export default UI_ANIMATION;
