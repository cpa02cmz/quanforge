/**
 * useVisualFeedback Hook
 * 
 * A comprehensive hook for managing visual feedback states (loading, success, error)
 * with animation support and motion preference integration.
 * 
 * @module hooks/useVisualFeedback
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMotionPreferences } from './useMotionPreferences';
import { FADE_TIMING, LOADING_ANIMATION } from '../constants/animations';

/**
 * Visual feedback states
 */
export type FeedbackState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Configuration options for useVisualFeedback
 */
export interface VisualFeedbackOptions {
  /** Duration of success state before returning to idle (ms) */
  successDuration?: number;
  /** Duration of error state before returning to idle (ms) */
  errorDuration?: number;
  /** Minimum time to show loading state (ms) */
  minLoadingDuration?: number;
  /** Whether to auto-dismiss success/error states */
  autoDismiss?: boolean;
  /** Callback when state changes */
  onStateChange?: (state: FeedbackState) => void;
  /** Callback when loading completes successfully */
  onSuccess?: () => void;
  /** Callback when loading fails */
  onError?: (error?: Error) => void;
}

/**
 * Return type for useVisualFeedback hook
 */
export interface VisualFeedbackResult {
  /** Current feedback state */
  state: FeedbackState;
  /** Whether currently in loading state */
  isLoading: boolean;
  /** Whether in success state */
  isSuccess: boolean;
  /** Whether in error state */
  isError: boolean;
  /** Whether in idle state */
  isIdle: boolean;
  /** Error message if in error state */
  errorMessage: string | null;
  /** Start loading state */
  startLoading: () => void;
  /** Set success state */
  setSuccess: () => void;
  /** Set error state */
  setError: (message?: string) => void;
  /** Reset to idle state */
  reset: () => void;
  /** Wrap an async function with automatic feedback states */
  withFeedback: <T>(
    asyncFn: () => Promise<T>,
    options?: { onSuccessMessage?: string; onErrorMessage?: string }
  ) => Promise<T | null>;
  /** Get animation duration based on motion preferences */
  getAnimationDuration: (baseDuration: number) => number;
  /** Get transition style based on motion preferences */
  getTransitionStyle: (properties: string[]) => React.CSSProperties;
  /** ARIA attributes for the feedback container */
  ariaAttributes: {
    'aria-busy': boolean;
    'aria-live': 'polite' | 'assertive' | 'off';
    'aria-atomic': boolean;
    role: 'status' | 'alert' | undefined;
  };
  /** Screen reader announcement text */
  announcement: string;
}

/**
 * useVisualFeedback Hook
 * 
 * Provides comprehensive visual feedback state management with motion preference support.
 * 
 * @example
 * ```tsx
 * const SaveButton = () => {
 *   const { state, isLoading, isSuccess, isError, withFeedback, ariaAttributes } = useVisualFeedback();
 *   
 *   const handleSave = () => withFeedback(() => saveData());
 *   
 *   return (
 *     <button onClick={handleSave} disabled={isLoading} {...ariaAttributes}>
 *       {isLoading ? 'Saving...' : isSuccess ? 'Saved!' : isError ? 'Error!' : 'Save'}
 *     </button>
 *   );
 * };
 * ```
 */
export function useVisualFeedback(
  options: VisualFeedbackOptions = {}
): VisualFeedbackResult {
  const {
    successDuration = 2000,
    errorDuration = 3000,
    minLoadingDuration = LOADING_ANIMATION.MIN_DISPLAY_TIME,
    autoDismiss = true,
    onStateChange,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<FeedbackState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadingStartTime = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { getEffectiveSettings, defaultEasing } = useMotionPreferences();
  const entranceSettings = getEffectiveSettings('entrance');
  const transitionSettings = getEffectiveSettings('transition');

  /**
   * Clear any pending timeout
   */
  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => clearPendingTimeout();
  }, [clearPendingTimeout]);

  /**
   * Handle state transitions with callbacks
   */
  const transitionTo = useCallback((newState: FeedbackState) => {
    clearPendingTimeout();
    setState(newState);
    onStateChange?.(newState);
  }, [clearPendingTimeout, onStateChange]);

  /**
   * Start loading state
   */
  const startLoading = useCallback(() => {
    loadingStartTime.current = Date.now();
    transitionTo('loading');
    setErrorMessage(null);
  }, [transitionTo]);

  /**
   * Set success state
   */
  const setSuccess = useCallback(() => {
    const loadingDuration = Date.now() - loadingStartTime.current;
    const remainingTime = Math.max(0, minLoadingDuration - loadingDuration);

    // Ensure minimum loading duration for visual feedback
    if (remainingTime > 0) {
      setTimeout(() => {
        transitionTo('success');
        onSuccess?.();

        if (autoDismiss) {
          timeoutRef.current = setTimeout(() => {
            transitionTo('idle');
          }, successDuration);
        }
      }, remainingTime);
    } else {
      transitionTo('success');
      onSuccess?.();

      if (autoDismiss) {
        timeoutRef.current = setTimeout(() => {
          transitionTo('idle');
        }, successDuration);
      }
    }
  }, [transitionTo, minLoadingDuration, autoDismiss, successDuration, onSuccess]);

  /**
   * Set error state
   */
  const setError = useCallback((message?: string) => {
    transitionTo('error');
    setErrorMessage(message || null);
    onError?.(message ? new Error(message) : undefined);

    if (autoDismiss) {
      timeoutRef.current = setTimeout(() => {
        transitionTo('idle');
        setErrorMessage(null);
      }, errorDuration);
    }
  }, [transitionTo, autoDismiss, errorDuration, onError]);

  /**
   * Reset to idle state
   */
  const reset = useCallback(() => {
    clearPendingTimeout();
    setState('idle');
    setErrorMessage(null);
    onStateChange?.('idle');
  }, [clearPendingTimeout, onStateChange]);

  /**
   * Wrap an async function with automatic feedback states
   */
  const withFeedback = useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    feedbackOptions?: { onSuccessMessage?: string; onErrorMessage?: string }
  ): Promise<T | null> => {
    try {
      startLoading();
      const result = await asyncFn();
      setSuccess();
      return result;
    } catch (error) {
      const message = feedbackOptions?.onErrorMessage || 
        (error instanceof Error ? error.message : 'An error occurred');
      setError(message);
      return null;
    }
  }, [startLoading, setSuccess, setError]);

  /**
   * Get animation duration based on motion preferences
   */
  const getAnimationDuration = useCallback((baseDuration: number): number => {
    return entranceSettings.enabled ? baseDuration * entranceSettings.durationMultiplier : 0;
  }, [entranceSettings]);

  /**
   * Get transition style based on motion preferences
   */
  const getTransitionStyle = useCallback((properties: string[]): React.CSSProperties => {
    if (!transitionSettings.enabled) return {};

    const duration = FADE_TIMING.STANDARD * transitionSettings.durationMultiplier;
    const transitions = properties.map(prop => `${prop} ${duration}ms ${transitionSettings.easing || defaultEasing}`);

    return {
      transition: transitions.join(', '),
    };
  }, [transitionSettings, defaultEasing]);

  /**
   * Compute derived state booleans
   */
  const isLoading = state === 'loading';
  const isSuccess = state === 'success';
  const isError = state === 'error';
  const isIdle = state === 'idle';

  /**
   * ARIA attributes for accessibility
   */
  const ariaAttributes = useMemo(() => ({
    'aria-busy': isLoading,
    'aria-live': isError ? 'assertive' as const : 'polite' as const,
    'aria-atomic': true,
    role: isError ? 'alert' as const : 'status' as const,
  }), [isLoading, isError]);

  /**
   * Screen reader announcement text
   */
  const announcement = useMemo(() => {
    switch (state) {
      case 'loading':
        return 'Loading...';
      case 'success':
        return 'Operation completed successfully';
      case 'error':
        return errorMessage || 'An error occurred';
      default:
        return '';
    }
  }, [state, errorMessage]);

  return {
    state,
    isLoading,
    isSuccess,
    isError,
    isIdle,
    errorMessage,
    startLoading,
    setSuccess,
    setError,
    reset,
    withFeedback,
    getAnimationDuration,
    getTransitionStyle,
    ariaAttributes,
    announcement,
  };
}

/**
 * useButtonFeedback Hook
 * 
 * A specialized hook for button feedback states.
 * Simplifies the useVisualFeedback for button interactions.
 * 
 * @example
 * ```tsx
 * const SubmitButton = () => {
 *   const { buttonState, handleClick, buttonProps } = useButtonFeedback({
 *     onClick: async () => await submitForm(),
 *   });
 *   
 *   return (
 *     <button {...buttonProps}>
 *       {buttonState === 'loading' ? 'Submitting...' : 'Submit'}
 *     </button>
 *   );
 * };
 * ```
 */
export function useButtonFeedback(options: {
  onClick: () => Promise<void> | void;
  successDuration?: number;
  errorDuration?: number;
  disabled?: boolean;
}): {
  buttonState: FeedbackState;
  handleClick: () => Promise<void>;
  buttonProps: {
    disabled: boolean;
    'aria-busy': boolean;
    'aria-live': 'polite' | 'assertive' | 'off';
    'aria-atomic': boolean;
    role: 'status' | 'alert' | undefined;
  };
} {
  const { onClick, successDuration, errorDuration, disabled = false } = options;
  
  const {
    state: buttonState,
    isLoading,
    withFeedback,
    ariaAttributes,
  } = useVisualFeedback({
    successDuration,
    errorDuration,
    autoDismiss: true,
  });

  const handleClick = useCallback(async () => {
    if (disabled || isLoading) return;
    
    await withFeedback(async () => {
      await onClick();
    });
  }, [disabled, isLoading, withFeedback, onClick]);

  const buttonProps = useMemo(() => ({
    disabled: disabled || isLoading,
    ...ariaAttributes,
  }), [disabled, isLoading, ariaAttributes]);

  return {
    buttonState,
    handleClick,
    buttonProps,
  };
}

export default useVisualFeedback;
