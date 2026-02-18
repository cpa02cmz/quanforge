import { useCallback, useEffect, useState } from 'react';
import { createScopedLogger } from '../utils/logger';
import { HAPTIC_DEFAULTS } from '../constants/uiComponentDefaults';

interface HapticPattern {
  /** Pattern of vibration durations in milliseconds */
  pattern: number | number[];
  /** Description of when this haptic should be used */
  description: string;
}

/**
 * Predefined haptic feedback patterns for consistent UX
 * Flexy-approved: All values come from modular constants
 */
export const HAPTIC_PATTERNS: Record<string, HapticPattern> = {
  LIGHT: { pattern: HAPTIC_DEFAULTS.LIGHT.pattern, description: HAPTIC_DEFAULTS.LIGHT.description },
  MEDIUM: { pattern: HAPTIC_DEFAULTS.MEDIUM.pattern, description: HAPTIC_DEFAULTS.MEDIUM.description },
  HEAVY: { pattern: HAPTIC_DEFAULTS.HEAVY.pattern, description: HAPTIC_DEFAULTS.HEAVY.description },
  SUCCESS: { pattern: [...HAPTIC_DEFAULTS.SUCCESS.pattern], description: HAPTIC_DEFAULTS.SUCCESS.description },
  ERROR: { pattern: HAPTIC_DEFAULTS.ERROR.pattern, description: HAPTIC_DEFAULTS.ERROR.description },
  WARNING: { pattern: [...HAPTIC_DEFAULTS.WARNING.pattern], description: HAPTIC_DEFAULTS.WARNING.description },
  SELECTION: { pattern: HAPTIC_DEFAULTS.SELECTION.pattern, description: HAPTIC_DEFAULTS.SELECTION.description },
  GESTURE_START: { pattern: HAPTIC_DEFAULTS.GESTURE_START.pattern, description: HAPTIC_DEFAULTS.GESTURE_START.description },
  GESTURE_END: { pattern: [...HAPTIC_DEFAULTS.GESTURE_END.pattern], description: HAPTIC_DEFAULTS.GESTURE_END.description },
};

interface UseHapticFeedbackOptions {
  /** Whether haptic feedback is enabled (default: true) */
  enabled?: boolean;
  /** Default pattern to use if none specified */
  defaultPattern?: HapticPattern;
}

/**
 * Hook for providing haptic feedback on supported devices
 * 
 * Features:
 * - Uses Vibration API on supported mobile devices
 * - Gracefully degrades on unsupported devices (desktop)
 * - Predefined patterns for consistent UX
 * - Can be disabled globally
 * - Type-safe with full TypeScript support
 * 
 * UX Benefits:
 * - Adds tactile confirmation to button presses
 * - Provides feedback for important actions
 * - Enhances mobile experience without visual clutter
 * - Follows mobile platform conventions
 * 
 * @example
 * // Basic usage with predefined pattern
 * const { trigger } = useHapticFeedback();
 * <button onClick={() => trigger(HAPTIC_PATTERNS.SUCCESS)}>Save</button>
 * 
 * @example
 * // Custom pattern
 * const { trigger } = useHapticFeedback();
 * <button onClick={() => trigger({ pattern: [50, 100, 50] })}>Custom</button>
 * 
 * @example
 * // Disabled state
 * const { trigger, isSupported } = useHapticFeedback({ enabled: false });
 * <button onClick={() => isSupported && trigger(HAPTIC_PATTERNS.MEDIUM)}>Click</button>
 */
const logger = createScopedLogger('useHapticFeedback');

export function useHapticFeedback(options: UseHapticFeedbackOptions = {}) {
  const { enabled = true, defaultPattern = HAPTIC_PATTERNS['MEDIUM'] } = options;
  const [isSupported, setIsSupported] = useState(false);

  // Check for vibration API support
  useEffect(() => {
    setIsSupported(typeof navigator !== 'undefined' && 'vibrate' in navigator);
  }, []);

  /**
   * Trigger haptic feedback
   * @param pattern - Vibration pattern (defaults to options.defaultPattern)
   */
  const trigger = useCallback((pattern?: HapticPattern | string) => {
    // Early return if disabled or not supported
    if (!enabled || !isSupported) {
      return false;
    }

    try {
      let vibrationPattern: number | number[];
      const fallbackPattern = HAPTIC_PATTERNS['MEDIUM']?.pattern ?? 20;

      // Handle string pattern names
      if (typeof pattern === 'string') {
        const upperPattern = pattern.toUpperCase();
        const predefinedPattern = upperPattern in HAPTIC_PATTERNS 
          ? HAPTIC_PATTERNS[upperPattern as keyof typeof HAPTIC_PATTERNS] 
          : undefined;
        if (predefinedPattern) {
          vibrationPattern = predefinedPattern.pattern;
        } else {
          logger.warn(`[useHapticFeedback] Unknown pattern: ${pattern}`);
          vibrationPattern = defaultPattern?.pattern ?? fallbackPattern;
        }
      } else if (pattern && typeof pattern === 'object' && 'pattern' in pattern) {
        // Handle HapticPattern object
        vibrationPattern = pattern.pattern;
      } else {
        // Use default pattern
        vibrationPattern = defaultPattern?.pattern ?? fallbackPattern;
      }

      // Trigger vibration
      const result = navigator.vibrate(vibrationPattern);
      return result;
    } catch {
      // Silently fail - haptic feedback is not critical
      return false;
    }
  }, [enabled, isSupported, defaultPattern]);

  /**
   * Trigger haptic feedback with a predefined pattern by name
   * @param patternName - Name of the predefined pattern
   */
  const triggerByName = useCallback((patternName: keyof typeof HAPTIC_PATTERNS) => {
    return trigger(HAPTIC_PATTERNS[patternName]);
  }, [trigger]);

  return {
    /** Trigger haptic feedback with a pattern */
    trigger,
    /** Trigger haptic feedback by predefined pattern name */
    triggerByName,
    /** Whether the Vibration API is supported */
    isSupported,
    /** Whether haptic feedback is enabled */
    isEnabled: enabled,
    /** Predefined haptic patterns */
    patterns: HAPTIC_PATTERNS,
  };
}

/**
 * Utility function for one-off haptic feedback
 * Use this when you don't need the full hook capabilities
 * 
 * @example
 * // Simple one-off haptic
 * hapticFeedback('SUCCESS');
 * 
 * @example
 * // Custom pattern
 * hapticFeedback([50, 100, 50]);
 */
export function hapticFeedback(
  pattern: number | number[] | keyof typeof HAPTIC_PATTERNS = 'MEDIUM'
): boolean {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return false;
  }

  try {
    let vibrationPattern: number | number[];
    const fallbackPattern = 20; // Default 20ms vibration

    if (typeof pattern === 'string') {
      const upperPattern = pattern.toUpperCase();
      const predefinedPattern = upperPattern in HAPTIC_PATTERNS 
        ? HAPTIC_PATTERNS[upperPattern as keyof typeof HAPTIC_PATTERNS] 
        : undefined;
      if (predefinedPattern) {
        vibrationPattern = predefinedPattern.pattern;
      } else {
        vibrationPattern = HAPTIC_PATTERNS['MEDIUM']?.pattern ?? fallbackPattern;
      }
    } else {
      vibrationPattern = pattern;
    }

    return navigator.vibrate(vibrationPattern);
  } catch {
    return false;
  }
}

export default useHapticFeedback;
