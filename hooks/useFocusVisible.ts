/**
 * useFocusVisible Hook
 * 
 * Detects keyboard vs mouse focus for proper focus indicator styling.
 * Uses the :focus-visible polyfill pattern to distinguish between
 * keyboard navigation (show focus ring) and mouse clicks (hide focus ring).
 * 
 * @module hooks/useFocusVisible
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Input modality types
 */
export type InputModality = 'keyboard' | 'mouse' | 'touch' | 'pointer' | null;

/**
 * Configuration options for useFocusVisible
 */
export interface FocusVisibleOptions {
  /**
   * Whether to automatically attach event listeners
   * @default true
   */
  autoAttach?: boolean;
  /**
   * Whether to track the current input modality
   * @default true
   */
  trackModality?: boolean;
  /**
   * Custom class to apply when focus is visible
   * @default 'focus-visible'
   */
  focusVisibleClass?: string;
  /**
   * Whether to use CSS :focus-visible support check
   * @default true
   */
  useNativeSupport?: boolean;
}

/**
 * Return type for useFocusVisible hook
 */
export interface FocusVisibleResult {
  /** Whether the element should show a visible focus indicator */
  isFocusVisible: boolean;
  /** The current input modality being used */
  modality: InputModality;
  /** Whether the browser supports :focus-visible natively */
  hasNativeSupport: boolean;
  /** Ref to attach to the target element */
  ref: React.RefObject<HTMLElement | null>;
  /** Manually set focus visible state (for custom implementations) */
  setIsFocusVisible: (value: boolean) => void;
  /** Event handler for focus events */
  handleFocus: () => void;
  /** Event handler for blur events */
  handleBlur: () => void;
  /** Event handler for keydown events */
  handleKeyDown: (event: KeyboardEvent) => void;
  /** Event handler for pointer events */
  handlePointerDown: () => void;
}

/**
 * Check if the browser natively supports :focus-visible
 */
function checkNativeSupport(): boolean {
  if (typeof document === 'undefined') return false;
  
  try {
    return CSS.supports('selector(:focus-visible)');
  } catch {
    return false;
  }
}

/**
 * Detect current input modality from event
 */
function detectModality(event: Event): InputModality {
  if (event.type.startsWith('key')) return 'keyboard';
  if (event.type.startsWith('touch')) return 'touch';
  if (event.type.startsWith('mouse')) return 'mouse';
  if (event.type.startsWith('pointer')) {
    const pointerEvent = event as PointerEvent;
    if (pointerEvent.pointerType === 'touch') return 'touch';
    if (pointerEvent.pointerType === 'pen') return 'pointer';
    return 'mouse';
  }
  return null;
}

/**
 * Keys that trigger focus-visible state
 */
const FOCUS_VISIBLE_KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Enter',
  'Space',
]);

/**
 * useFocusVisible Hook
 * 
 * Provides proper focus indicator management for accessibility.
 * Distinguishes between keyboard and mouse focus to show/hide focus rings.
 * 
 * @example
 * ```tsx
 * const MyButton = () => {
 *   const { isFocusVisible, ref, handleFocus, handleBlur, handleKeyDown, handlePointerDown } = useFocusVisible();
 *   
 *   return (
 *     <button
 *       ref={ref}
 *       onFocus={handleFocus}
 *       onBlur={handleBlur}
 *       onKeyDown={handleKeyDown}
 *       onPointerDown={handlePointerDown}
 *       className={isFocusVisible ? 'ring-2 ring-brand-500' : ''}
 *     >
 *       Click me
 *     </button>
 *   );
 * };
 * ```
 */
export function useFocusVisible(options: FocusVisibleOptions = {}): FocusVisibleResult {
  const {
    autoAttach = true,
    trackModality = true,
    useNativeSupport = true,
  } = options;

  const [isFocusVisible, setIsFocusVisible] = useState(false);
  const [modality, setModality] = useState<InputModality>(null);
  const [hasNativeSupport] = useState(() => checkNativeSupport());
  const ref = useRef<HTMLElement | null>(null);
  const hadKeyboardEvent = useRef(false);
  const hadPointerDown = useRef(false);

  /**
   * Handle focus event
   */
  const handleFocus = useCallback(() => {
    // If we had a keyboard event and no recent pointer down, show focus
    if (hadKeyboardEvent.current && !hadPointerDown.current) {
      setIsFocusVisible(true);
    } else if (modality === 'keyboard') {
      setIsFocusVisible(true);
    }
  }, [modality]);

  /**
   * Handle blur event
   */
  const handleBlur = useCallback(() => {
    setIsFocusVisible(false);
    hadKeyboardEvent.current = false;
  }, []);

  /**
   * Handle keydown event
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (trackModality) {
      setModality('keyboard');
    }
    
    if (FOCUS_VISIBLE_KEYS.has(event.key)) {
      hadKeyboardEvent.current = true;
    }
  }, [trackModality]);

  /**
   * Handle pointer down event
   */
  const handlePointerDown = useCallback(() => {
    if (trackModality) {
      setModality('mouse');
    }
    
    hadPointerDown.current = true;
    hadKeyboardEvent.current = false;
    setIsFocusVisible(false);
    
    // Reset pointer down flag after a short delay
    setTimeout(() => {
      hadPointerDown.current = false;
    }, 100);
  }, [trackModality]);

  /**
   * Attach global event listeners for modality detection
   */
  useEffect(() => {
    if (!autoAttach) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (FOCUS_VISIBLE_KEYS.has(e.key)) {
        hadKeyboardEvent.current = true;
        if (trackModality) {
          setModality('keyboard');
        }
      }
    };

    const handleGlobalPointerDown = (e: PointerEvent) => {
      hadPointerDown.current = true;
      hadKeyboardEvent.current = false;
      if (trackModality) {
        setModality(detectModality(e));
      }
      
      setTimeout(() => {
        hadPointerDown.current = false;
      }, 100);
    };

    // Add global listeners
    document.addEventListener('keydown', handleGlobalKeyDown, true);
    document.addEventListener('pointerdown', handleGlobalPointerDown, true);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
      document.removeEventListener('pointerdown', handleGlobalPointerDown, true);
    };
  }, [autoAttach, trackModality]);

  /**
   * If native support is available and we want to use it,
   * we can rely on CSS :focus-visible instead
   */
  useEffect(() => {
    if (useNativeSupport && hasNativeSupport) {
      // Native support is available, the hook still works but
      // CSS :focus-visible will handle styling automatically
    }
  }, [useNativeSupport, hasNativeSupport]);

  return {
    isFocusVisible: useNativeSupport && hasNativeSupport ? true : isFocusVisible,
    modality,
    hasNativeSupport,
    ref,
    setIsFocusVisible,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handlePointerDown,
  };
}

/**
 * useFocusWithin Hook
 * 
 * Detects if any element within a container has focus.
 * Useful for styling parent containers when children are focused.
 * 
 * @example
 * ```tsx
 * const FormField = () => {
 *   const { isFocusWithin, ref } = useFocusWithin();
 *   
 *   return (
 *     <div ref={ref} className={isFocusWithin ? 'border-brand-500' : ''}>
 *       <input type="text" />
 *       <input type="text" />
 *     </div>
 *   );
 * };
 * ```
 */
export function useFocusWithin(): {
  isFocusWithin: boolean;
  ref: React.RefObject<HTMLElement | null>;
  handleFocus: () => void;
  handleBlur: () => void;
} {
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  const handleFocus = useCallback(() => {
    setIsFocusWithin(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Check if focus is still within the container
    if (ref.current && !ref.current.contains(document.activeElement)) {
      setIsFocusWithin(false);
    }
  }, []);

  return {
    isFocusWithin,
    ref,
    handleFocus,
    handleBlur,
  };
}

/**
 * useFocusTrap Hook
 * 
 * Traps focus within a container element.
 * Essential for modal dialogs and other focus-trapping scenarios.
 * 
 * @example
 * ```tsx
 * const Modal = ({ isOpen, onClose }) => {
 *   const { ref, handleKeyDown } = useFocusTrap(isOpen);
 *   
 *   if (!isOpen) return null;
 *   
 *   return (
 *     <div ref={ref} onKeyDown={handleKeyDown} role="dialog">
 *       <button>First focusable</button>
 *       <button>Second focusable</button>
 *     </div>
 *   );
 * };
 * ```
 */
export function useFocusTrap(
  isActive: boolean = true
): {
  ref: React.RefObject<HTMLElement | null>;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  focusFirst: () => void;
  focusLast: () => void;
} {
  const ref = useRef<HTMLElement | null>(null);

  /**
   * Get all focusable elements within the container
   */
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!ref.current) return [];

    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return Array.from(ref.current.querySelectorAll<HTMLElement>(selector));
  }, []);

  /**
   * Focus the first focusable element
   */
  const focusFirst = useCallback(() => {
    const focusable = getFocusableElements();
    focusable[0]?.focus();
  }, [getFocusableElements]);

  /**
   * Focus the last focusable element
   */
  const focusLast = useCallback(() => {
    const focusable = getFocusableElements();
    focusable[focusable.length - 1]?.focus();
  }, [getFocusableElements]);

  /**
   * Handle keydown for focus trapping
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isActive || event.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (!firstElement || !lastElement) return;

      if (event.shiftKey) {
        // Shift+Tab: if on first element, move to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, move to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [isActive, getFocusableElements]
  );

  /**
   * Auto-focus first element when trap becomes active
   */
  useEffect(() => {
    if (isActive) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(focusFirst, 50);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isActive, focusFirst]);

  return {
    ref,
    handleKeyDown,
    focusFirst,
    focusLast,
  };
}

/**
 * useAutoFocus Hook
 * 
 * Automatically focuses an element when it mounts or when triggered.
 * 
 * @example
 * ```tsx
 * const Input = () => {
 *   const { ref, isFocused } = useAutoFocus();
 *   
 *   return <input ref={ref} className={isFocused ? 'focused' : ''} />;
 * };
 * ```
 */
export function useAutoFocus(
  shouldFocus: boolean = true,
  delay: number = 0
): {
  ref: React.RefObject<HTMLElement | null>;
  isFocused: boolean;
  focus: () => void;
  blur: () => void;
} {
  const ref = useRef<HTMLElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const focus = useCallback(() => {
    if (ref.current) {
      ref.current.focus();
      setIsFocused(true);
    }
  }, []);

  const blur = useCallback(() => {
    if (ref.current) {
      ref.current.blur();
      setIsFocused(false);
    }
  }, []);

  useEffect(() => {
    if (!shouldFocus) return;

    const timeoutId = setTimeout(focus, delay);
    return () => clearTimeout(timeoutId);
  }, [shouldFocus, delay, focus]);

  // Track focus/blur events
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleFocusEvent = () => setIsFocused(true);
    const handleBlurEvent = () => setIsFocused(false);

    element.addEventListener('focus', handleFocusEvent);
    element.addEventListener('blur', handleBlurEvent);

    return () => {
      element.removeEventListener('focus', handleFocusEvent);
      element.removeEventListener('blur', handleBlurEvent);
    };
  }, []);

  return {
    ref,
    isFocused,
    focus,
    blur,
  };
}

// Default export
export default useFocusVisible;
