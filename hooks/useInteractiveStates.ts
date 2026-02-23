/**
 * useInteractiveStates Hook
 * 
 * A comprehensive hook for managing interactive states (hover, press, focus)
 * with consistent transition support and motion preference integration.
 * 
 * @module hooks/useInteractiveStates
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMotionPreferences } from './useMotionPreferences';
import { INTERACTIVE_ANIMATION, EASING } from '../constants/animations';

/**
 * Interactive state types
 */
export interface InteractiveState {
  /** Whether the element is being hovered */
  isHovered: boolean;
  /** Whether the element is being pressed */
  isPressed: boolean;
  /** Whether the element is focused */
  isFocused: boolean;
  /** Whether the element should show focus ring (keyboard vs mouse) */
  isFocusVisible: boolean;
  /** Whether the element is active (pressed or focused) */
  isActive: boolean;
  /** Current state name for CSS class generation */
  stateName: 'idle' | 'hover' | 'press' | 'focus' | 'hover-focus' | 'press-focus';
}

/**
 * Configuration options for useInteractiveStates
 */
export interface InteractiveStatesOptions {
  /** Whether to track hover state */
  trackHover?: boolean;
  /** Whether to track press state */
  trackPress?: boolean;
  /** Whether to track focus state */
  trackFocus?: boolean;
  /** Whether to distinguish keyboard vs mouse focus */
  trackFocusVisible?: boolean;
  /** Custom transition duration (ms) */
  transitionDuration?: number;
  /** Custom easing function */
  easing?: string;
  /** Scale factor when pressed */
  pressScale?: number;
  /** Scale factor when hovered */
  hoverScale?: number;
  /** Callback when hover state changes */
  onHoverChange?: (isHovered: boolean) => void;
  /** Callback when press state changes */
  onPressChange?: (isPressed: boolean) => void;
  /** Callback when focus state changes */
  onFocusChange?: (isFocused: boolean) => void;
  /** Whether the element is disabled */
  disabled?: boolean;
}

/**
 * Return type for useInteractiveStates hook
 */
export interface InteractiveStatesResult extends InteractiveState {
  /** Props to spread on the element */
  props: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onMouseDown: () => void;
    onMouseUp: () => void;
    onFocus: () => void;
    onBlur: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onKeyUp: (e: React.KeyboardEvent) => void;
    onTouchStart: () => void;
    onTouchEnd: () => void;
    tabIndex?: number;
    'aria-disabled'?: boolean;
  };
  /** Get transition styles for CSS properties */
  getTransitionStyle: (properties: string[]) => React.CSSProperties;
  /** Get transform style based on current state */
  getTransformStyle: () => React.CSSProperties;
  /** CSS class name for current state */
  stateClassName: string;
  /** Reset all states to idle */
  reset: () => void;
}

// Keys that indicate keyboard interaction
const KEYBOARD_KEYS = new Set([
  'Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown', 'Escape',
]);

/**
 * useInteractiveStates Hook
 * 
 * Provides comprehensive interactive state management with motion preferences.
 * 
 * @example
 * ```tsx
 * const InteractiveButton = () => {
 *   const { isHovered, isPressed, isFocused, props, getTransformStyle, stateClassName } = useInteractiveStates({
 *     trackHover: true,
 *     trackPress: true,
 *     trackFocus: true,
 *   });
 *   
 *   return (
 *     <button
 *       {...props}
 *       style={getTransformStyle()}
 *       className={`btn ${stateClassName}`}
 *     >
 *       Click me
 *     </button>
 *   );
 * };
 * ```
 */
export function useInteractiveStates(
  options: InteractiveStatesOptions = {}
): InteractiveStatesResult {
  const {
    trackHover = true,
    trackPress = true,
    trackFocus = true,
    trackFocusVisible = true,
    transitionDuration = INTERACTIVE_ANIMATION.HOVER_TRANSITION,
    easing = EASING.STANDARD,
    pressScale = INTERACTIVE_ANIMATION.SCALE_EFFECT,
    hoverScale = 1.02,
    onHoverChange,
    onPressChange,
    onFocusChange,
    disabled = false,
  } = options;

  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isFocusVisible, setIsFocusVisible] = useState(false);
  
  const hadKeyboardEvent = useRef(false);
  const touchActive = useRef(false);

  const { getEffectiveSettings, defaultEasing } = useMotionPreferences();
  const hoverSettings = getEffectiveSettings('hover');

  /**
   * Get effective transition duration based on motion preferences
   */
  const effectiveDuration = useMemo(() => {
    if (!hoverSettings.enabled) return 0;
    return transitionDuration * hoverSettings.durationMultiplier;
  }, [hoverSettings, transitionDuration]);

  /**
   * Get effective easing based on motion preferences
   */
  const effectiveEasing = useMemo(() => {
    return hoverSettings.easing || easing || defaultEasing;
  }, [hoverSettings, easing, defaultEasing]);

  /**
   * Hover handlers
   */
  const handleMouseEnter = useCallback(() => {
    if (disabled || !trackHover) return;
    setIsHovered(true);
    onHoverChange?.(true);
  }, [disabled, trackHover, onHoverChange]);

  const handleMouseLeave = useCallback(() => {
    if (disabled) return;
    setIsHovered(false);
    setIsPressed(false);
    onHoverChange?.(false);
    onPressChange?.(false);
  }, [disabled, onHoverChange, onPressChange]);

  /**
   * Press handlers
   */
  const handleMouseDown = useCallback(() => {
    if (disabled || !trackPress) return;
    setIsPressed(true);
    onPressChange?.(true);
  }, [disabled, trackPress, onPressChange]);

  const handleMouseUp = useCallback(() => {
    if (disabled) return;
    setIsPressed(false);
    onPressChange?.(false);
  }, [disabled, onPressChange]);

  /**
   * Touch handlers for mobile
   */
  const handleTouchStart = useCallback(() => {
    if (disabled || !trackPress) return;
    touchActive.current = true;
    setIsPressed(true);
    onPressChange?.(true);
  }, [disabled, trackPress, onPressChange]);

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    touchActive.current = false;
    setIsPressed(false);
    onPressChange?.(false);
  }, [disabled, onPressChange]);

  /**
   * Focus handlers
   */
  const handleFocus = useCallback(() => {
    if (disabled || !trackFocus) return;
    setIsFocused(true);
    onFocusChange?.(true);
    
    // Determine if focus should be visible (keyboard navigation)
    if (trackFocusVisible && hadKeyboardEvent.current) {
      setIsFocusVisible(true);
    }
  }, [disabled, trackFocus, trackFocusVisible, onFocusChange]);

  const handleBlur = useCallback(() => {
    if (disabled) return;
    setIsFocused(false);
    setIsFocusVisible(false);
    setIsPressed(false);
    onFocusChange?.(false);
    onPressChange?.(false);
  }, [disabled, onFocusChange, onPressChange]);

  /**
   * Keyboard handlers
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (KEYBOARD_KEYS.has(e.key)) {
      hadKeyboardEvent.current = true;
    }
    
    // Space and Enter trigger press state
    if ((e.key === ' ' || e.key === 'Enter') && trackPress) {
      setIsPressed(true);
      onPressChange?.(true);
    }
  }, [disabled, trackPress, onPressChange]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    
    // Release press state
    if ((e.key === ' ' || e.key === 'Enter') && trackPress) {
      setIsPressed(false);
      onPressChange?.(false);
    }
  }, [disabled, trackPress, onPressChange]);

  /**
   * Reset all states
   */
  const reset = useCallback(() => {
    setIsHovered(false);
    setIsPressed(false);
    setIsFocused(false);
    setIsFocusVisible(false);
    hadKeyboardEvent.current = false;
    touchActive.current = false;
  }, []);

  /**
   * Global keyboard listener for focus-visible detection
   */
  useEffect(() => {
    if (!trackFocusVisible) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (KEYBOARD_KEYS.has(e.key)) {
        hadKeyboardEvent.current = true;
      }
    };

    const handleGlobalPointerDown = () => {
      hadKeyboardEvent.current = false;
      setIsFocusVisible(false);
    };

    document.addEventListener('keydown', handleGlobalKeyDown, true);
    document.addEventListener('pointerdown', handleGlobalPointerDown, true);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
      document.removeEventListener('pointerdown', handleGlobalPointerDown, true);
    };
  }, [trackFocusVisible]);

  /**
   * Derived state: is active
   */
  const isActive = isPressed || isFocused;

  /**
   * Compute state name for CSS class generation
   */
  const stateName = useMemo((): InteractiveState['stateName'] => {
    if (isPressed && isFocused) return 'press-focus';
    if (isPressed) return 'press';
    if (isHovered && isFocused) return 'hover-focus';
    if (isFocused) return 'focus';
    if (isHovered) return 'hover';
    return 'idle';
  }, [isHovered, isPressed, isFocused]);

  /**
   * Get transition style for specified properties
   */
  const getTransitionStyle = useCallback((properties: string[]): React.CSSProperties => {
    if (effectiveDuration === 0) return {};

    const transitions = properties.map(
      prop => `${prop} ${effectiveDuration}ms ${effectiveEasing}`
    );

    return {
      transition: transitions.join(', '),
    };
  }, [effectiveDuration, effectiveEasing]);

  /**
   * Get transform style based on current state
   */
  const getTransformStyle = useCallback((): React.CSSProperties => {
    if (!hoverSettings.enabled) return {};

    let scale = 1;
    
    if (isPressed) {
      scale = pressScale;
    } else if (isHovered) {
      scale = hoverScale;
    }

    return {
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      transition: effectiveDuration > 0 
        ? `transform ${effectiveDuration}ms ${effectiveEasing}` 
        : undefined,
    };
  }, [isPressed, isHovered, pressScale, hoverScale, hoverSettings.enabled, effectiveDuration, effectiveEasing]);

  /**
   * CSS class name for current state
   */
  const stateClassName = useMemo(() => {
    const classes: string[] = [];
    if (isHovered) classes.push('is-hovered');
    if (isPressed) classes.push('is-pressed');
    if (isFocused) classes.push('is-focused');
    if (isFocusVisible) classes.push('is-focus-visible');
    if (isActive) classes.push('is-active');
    return classes.join(' ');
  }, [isHovered, isPressed, isFocused, isFocusVisible, isActive]);

  /**
   * Props to spread on the element
   */
  const props = useMemo(() => ({
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onKeyUp: handleKeyUp,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    tabIndex: disabled ? undefined : 0,
    'aria-disabled': disabled || undefined,
  }), [
    handleMouseEnter, handleMouseLeave, handleMouseDown, handleMouseUp,
    handleFocus, handleBlur, handleKeyDown, handleKeyUp,
    handleTouchStart, handleTouchEnd, disabled,
  ]);

  return {
    isHovered,
    isPressed,
    isFocused,
    isFocusVisible,
    isActive,
    stateName,
    props,
    getTransitionStyle,
    getTransformStyle,
    stateClassName,
    reset,
  };
}

/**
 * useHover Hook
 * 
 * A simplified hook for tracking hover state only.
 * 
 * @example
 * ```tsx
 * const HoverCard = () => {
 *   const { isHovered, hoverProps } = useHover();
 *   
 *   return (
 *     <div {...hoverProps} className={isHovered ? 'hovered' : ''}>
 *       Content
 *     </div>
 *   );
 * };
 * ```
 */
export function useHover(options: {
  disabled?: boolean;
  onHoverChange?: (isHovered: boolean) => void;
} = {}): {
  isHovered: boolean;
  hoverProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
} {
  const { disabled = false, onHoverChange } = options;
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    setIsHovered(true);
    onHoverChange?.(true);
  }, [disabled, onHoverChange]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onHoverChange?.(false);
  }, [onHoverChange]);

  const hoverProps = useMemo(() => ({
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  }), [handleMouseEnter, handleMouseLeave]);

  return { isHovered, hoverProps };
}

/**
 * usePress Hook
 * 
 * A simplified hook for tracking press state only.
 * 
 * @example
 * ```tsx
 * const PressableButton = () => {
 *   const { isPressed, pressProps } = usePress();
 *   
 *   return (
 *     <button {...pressProps} className={isPressed ? 'pressed' : ''}>
 *       Click
 *     </button>
 *   );
 * };
 * ```
 */
export function usePress(options: {
  disabled?: boolean;
  onPressChange?: (isPressed: boolean) => void;
} = {}): {
  isPressed: boolean;
  pressProps: {
    onMouseDown: () => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
    onTouchStart: () => void;
    onTouchEnd: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onKeyUp: (e: React.KeyboardEvent) => void;
  };
} {
  const { disabled = false, onPressChange } = options;
  const [isPressed, setIsPressed] = useState(false);

  const handlePressStart = useCallback(() => {
    if (disabled) return;
    setIsPressed(true);
    onPressChange?.(true);
  }, [disabled, onPressChange]);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
    onPressChange?.(false);
  }, [onPressChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      handlePressStart();
    }
  }, [disabled, handlePressStart]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      handlePressEnd();
    }
  }, [handlePressEnd]);

  const pressProps = useMemo(() => ({
    onMouseDown: handlePressStart,
    onMouseUp: handlePressEnd,
    onMouseLeave: handlePressEnd,
    onTouchStart: handlePressStart,
    onTouchEnd: handlePressEnd,
    onKeyDown: handleKeyDown,
    onKeyUp: handleKeyUp,
  }), [handlePressStart, handlePressEnd, handleKeyDown, handleKeyUp]);

  return { isPressed, pressProps };
}

export default useInteractiveStates;
