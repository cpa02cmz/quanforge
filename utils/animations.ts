/**
 * Animation Utilities Module
 * Centralized animation configurations and helpers for consistent UI motion
 * 
 * Features:
 * - Standardized animation presets with accessibility support
 * - Reduced motion detection and handling
 * - Easing functions for natural-feeling animations
 * - Transition configurations for common UI patterns
 * - CSS custom properties for animation values
 * 
 * @module utils/animations
 */

// =============================================================================
// ANIMATION PRESETS
// =============================================================================

/**
 * Standard animation durations in milliseconds
 * Follows a progressive scale for consistency
 */
export const DURATIONS = {
  instant: 0,
  fastest: 100,
  faster: 150,
  fast: 200,
  normal: 300,
  slow: 400,
  slower: 500,
  slowest: 700,
} as const;

/**
 * Standard animation delays in milliseconds
 */
export const DELAYS = {
  none: 0,
  short: 50,
  medium: 100,
  long: 200,
  extra: 300,
} as const;

/**
 * Easing functions for natural-feeling animations
 * Based on standard CSS easing and custom curves
 */
export const EASINGS = {
  // Standard easings
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  
  // Material Design inspired
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',
  
  // Bounce and spring effects
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  elastic: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
  
  // Smooth curves
  smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  smoothOut: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  smoothInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
} as const;

/**
 * Animation keyframe definitions for common effects
 */
export const KEYFRAMES = {
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  fadeOut: {
    from: { opacity: 1 },
    to: { opacity: 0 },
  },
  fadeInUp: {
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  fadeInDown: {
    from: { opacity: 0, transform: 'translateY(-10px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  fadeInLeft: {
    from: { opacity: 0, transform: 'translateX(-10px)' },
    to: { opacity: 1, transform: 'translateX(0)' },
  },
  fadeInRight: {
    from: { opacity: 0, transform: 'translateX(10px)' },
    to: { opacity: 1, transform: 'translateX(0)' },
  },
  fadeOutDown: {
    from: { opacity: 1, transform: 'translateY(0)' },
    to: { opacity: 0, transform: 'translateY(10px)' },
  },
  scaleIn: {
    from: { opacity: 0, transform: 'scale(0.95)' },
    to: { opacity: 1, transform: 'scale(1)' },
  },
  scaleOut: {
    from: { opacity: 1, transform: 'scale(1)' },
    to: { opacity: 0, transform: 'scale(0.95)' },
  },
  slideInUp: {
    from: { transform: 'translateY(100%)' },
    to: { transform: 'translateY(0)' },
  },
  slideInDown: {
    from: { transform: 'translateY(-100%)' },
    to: { transform: 'translateY(0)' },
  },
  slideInLeft: {
    from: { transform: 'translateX(-100%)' },
    to: { transform: 'translateX(0)' },
  },
  slideInRight: {
    from: { transform: 'translateX(100%)' },
    to: { transform: 'translateX(0)' },
  },
  spin: {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
  pulse: {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.5 },
  },
  bounce: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-10px)' },
  },
  shake: {
    '0%, 100%': { transform: 'translateX(0)' },
    '25%': { transform: 'translateX(-5px)' },
    '75%': { transform: 'translateX(5px)' },
  },
  shimmer: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
} as const;

// =============================================================================
// TRANSITION PRESETS
// =============================================================================

/**
 * Pre-configured transition configurations for common UI patterns
 */
export const TRANSITIONS = {
  // Basic transitions
  none: 'none',
  all: `all ${DURATIONS.normal}ms ${EASINGS.standard}`,
  colors: `color, background-color, border-color ${DURATIONS.fast}ms ${EASINGS.standard}`,
  opacity: `opacity ${DURATIONS.normal}ms ${EASINGS.standard}`,
  transform: `transform ${DURATIONS.normal}ms ${EASINGS.standard}`,
  
  // Component-specific
  button: `all ${DURATIONS.fast}ms ${EASINGS.standard}`,
  input: `border-color, box-shadow ${DURATIONS.fast}ms ${EASINGS.standard}`,
  modal: `opacity ${DURATIONS.normal}ms ${EASINGS.standard}, transform ${DURATIONS.normal}ms ${EASINGS.decelerate}`,
  drawer: `transform ${DURATIONS.slow}ms ${EASINGS.decelerate}`,
  tooltip: `opacity ${DURATIONS.fast}ms ${EASINGS.standard}, transform ${DURATIONS.fast}ms ${EASINGS.standard}`,
  dropdown: `opacity ${DURATIONS.fast}ms ${EASINGS.standard}, transform ${DURATIONS.fast}ms ${EASINGS.decelerate}`,
  toast: `all ${DURATIONS.normal}ms ${EASINGS.standard}`,
  
  // Interactive states
  hover: `all ${DURATIONS.faster}ms ${EASINGS.standard}`,
  focus: `box-shadow ${DURATIONS.fast}ms ${EASINGS.standard}`,
  active: `transform ${DURATIONS.fastest}ms ${EASINGS.standard}`,
  
  // Page transitions
  page: `opacity ${DURATIONS.slow}ms ${EASINGS.standard}, transform ${DURATIONS.slow}ms ${EASINGS.decelerate}`,
  route: `opacity ${DURATIONS.normal}ms ${EASINGS.standard}`,
} as const;

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

/**
 * Animation variants for Framer Motion-like animation libraries
 * Can be used with React Spring, Framer Motion, or custom animation solutions
 */
export const VARIANTS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  fadeInUp: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  fadeInDown: {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  slideInUp: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
  },
  slideInLeft: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
  },
  slideInRight: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
  },
  modal: {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 10 },
  },
  dropdown: {
    initial: { opacity: 0, y: -10, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.95 },
  },
  tooltip: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if the user prefers reduced motion
 * Used to disable animations for accessibility
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Subscribe to reduced motion preference changes
 * @param callback Function to call when preference changes
 * @returns Cleanup function
 */
export function onReducedMotionChange(callback: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}

/**
 * Get appropriate animation duration based on user preferences
 * Returns 0 if reduced motion is preferred
 */
export function getSafeDuration(duration: number): number {
  return prefersReducedMotion() ? 0 : duration;
}

/**
 * Create a transition string with reduced motion support
 */
export function createTransition(
  properties: string | string[],
  duration: number = DURATIONS.normal,
  easing: string = EASINGS.standard
): string {
  if (prefersReducedMotion()) {
    return 'none';
  }
  
  const props = Array.isArray(properties) ? properties.join(', ') : properties;
  return `${props} ${duration}ms ${easing}`;
}

/**
 * Generate staggered animation delay for list items
 */
export function getStaggerDelay(index: number, baseDelay: number = 50): number {
  if (prefersReducedMotion()) return 0;
  return index * baseDelay;
}

/**
 * Create CSS animation string
 */
export function createAnimation(
  name: string,
  duration: number = DURATIONS.normal,
  timingFunction: string = EASINGS.standard,
  delay: number = 0,
  iterationCount: string | number = 1,
  direction: string = 'normal',
  fillMode: string = 'both'
): string {
  if (prefersReducedMotion()) {
    return 'none';
  }
  
  return `${name} ${duration}ms ${timingFunction} ${delay}ms ${iterationCount} ${direction} ${fillMode}`;
}

// =============================================================================
// ANIMATION PRESET CLASSES
// =============================================================================

/**
 * CSS class names for common animations
 * These should be defined in your CSS/ Tailwind config
 */
export const ANIMATION_CLASSES = {
  fadeIn: 'animate-fade-in',
  fadeInUp: 'animate-fade-in-up',
  fadeInDown: 'animate-fade-in-down',
  fadeOut: 'animate-fade-out',
  fadeOutDown: 'animate-fade-out-down',
  scaleIn: 'animate-scale-in',
  scaleOut: 'animate-scale-out',
  slideInUp: 'animate-slide-in-up',
  slideInDown: 'animate-slide-in-down',
  slideInLeft: 'animate-slide-in-left',
  slideInRight: 'animate-slide-in-right',
  spin: 'animate-spin',
  pulse: 'animate-pulse',
  bounce: 'animate-bounce',
  shake: 'animate-shake',
  shimmer: 'animate-shimmer',
  skeleton: 'animate-skeleton-pulse',
} as const;

// =============================================================================
// INTERPOLATION UTILITIES
// =============================================================================

/**
 * Interpolate between two values
 */
export function interpolate(
  start: number,
  end: number,
  progress: number,
  easing: (t: number) => number = (t) => t
): number {
  const easedProgress = easing(Math.max(0, Math.min(1, progress)));
  return start + (end - start) * easedProgress;
}

/**
 * Common easing functions for JavaScript animations
 */
export const easingFunctions = {
  linear: (t: number): number => t,
  easeInQuad: (t: number): number => t * t,
  easeOutQuad: (t: number): number => t * (2 - t),
  easeInOutQuad: (t: number): number => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => --t * t * t + 1,
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: (t: number): number => t * t * t * t,
  easeOutQuart: (t: number): number => 1 - --t * t * t * t,
  easeInOutQuart: (t: number): number =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,
  easeInExpo: (t: number): number => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  easeOutExpo: (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t: number): number => {
    if (t === 0 || t === 1) return t;
    if (t < 0.5) return Math.pow(2, 10 * (2 * t - 1)) / 2;
    return (2 - Math.pow(2, -10 * (2 * t - 1))) / 2;
  },
  easeInBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  easeInElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  easeOutElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeOutBounce: (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  easeInBounce: (t: number): number => 1 - easingFunctions.easeOutBounce(1 - t),
  easeInOutBounce: (t: number): number =>
    t < 0.5
      ? easingFunctions.easeInBounce(t * 2) * 0.5
      : easingFunctions.easeOutBounce(t * 2 - 1) * 0.5 + 0.5,
} as const;

// =============================================================================
// ANIMATION CONTROLLER
// =============================================================================

/**
 * Simple animation controller for managing animations
 */
export class AnimationController {
  private animationFrameId: number | null = null;
  private startTime: number | null = null;
  private isRunning = false;

  /**
   * Start an animation
   */
  start(
    duration: number,
    onUpdate: (progress: number) => void,
    onComplete?: () => void,
    easing: (t: number) => number = easingFunctions.linear
  ): void {
    if (prefersReducedMotion()) {
      onUpdate(1);
      onComplete?.();
      return;
    }

    this.stop();
    this.isRunning = true;
    this.startTime = performance.now();

    const animate = (currentTime: number) => {
      if (!this.isRunning || this.startTime === null) return;

      const elapsed = currentTime - this.startTime;
      const rawProgress = Math.min(elapsed / duration, 1);
      const progress = easing(rawProgress);

      onUpdate(progress);

      if (rawProgress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.isRunning = false;
        this.animationFrameId = null;
        onComplete?.();
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Stop the current animation
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isRunning = false;
    this.startTime = null;
  }

  /**
   * Check if animation is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Duration = (typeof DURATIONS)[keyof typeof DURATIONS];
export type Easing = (typeof EASINGS)[keyof typeof EASINGS];
export type Transition = (typeof TRANSITIONS)[keyof typeof TRANSITIONS];
export type AnimationClass = (typeof ANIMATION_CLASSES)[keyof typeof ANIMATION_CLASSES];
export type EasingFunction = (t: number) => number;
