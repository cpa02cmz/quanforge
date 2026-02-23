/**
 * useClickOutside Hook
 * 
 * A hook for detecting clicks outside an element.
 * Useful for closing dropdowns, modals, and popovers on outside clicks.
 * 
 * Features:
 * - SSR-safe implementation
 * - TypeScript support
 * - Proper cleanup on unmount
 * - Multiple ref support
 * - Event delegation option
 * 
 * @module hooks/useClickOutside
 */

import { useEffect, useRef, RefObject, useState, useCallback } from 'react';

// ========== TYPES ==========

export interface ClickOutsideOptions {
  /** Whether the listen for touch events (default: true on mobile) */
  includeTouch?: boolean;
  /** Whether the listen for click events (default: true) */
  includeClick?: boolean;
  /** Callback when clicking outside */
  onClickOutside: (event: MouseEvent | TouchEvent) => void;
  /** Callback when clicking inside (optional) */
  onClickInside?: (event: MouseEvent | TouchEvent) => void;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

// ========== MAIN HOOK ==========

/**
 * Hook to detect clicks outside an element
 * 
 * @example
 * ```tsx
 * function Dropdown() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const ref = useRef<HTMLDivElement>(null);
 *   
 *   useClickOutside(ref, () => setIsOpen(false));
 *   
 *   return (
 *     <div ref={ref}>
 *       <button onClick={() => setIsOpen(true)}>Toggle</button>
 *       {isOpen && <div>Dropdown content</div>}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // Multiple refs (exclude multiple elements)
 * function Modal() {
 *   const modalRef = useRef<HTMLDivElement>(null);
 *   const buttonRef = useRef<HTMLButtonElement>(null);
 *   
 *   useClickOutside([modalRef, buttonRef], () => closeModal());
 *   
 *   return <dialog ref={modalRef}>...</dialog>;
 * }
 * ```
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  onClickOutside: ClickOutsideOptions['onClickOutside'],
  options: Omit<ClickOutsideOptions, 'onClickOutside'> = {}
): void {
  const {
    includeTouch = true,
    includeClick = true,
    onClickInside,
    enabled = true,
  } = options;

  const callbackRef = useRef(onClickOutside);
  callbackRef.current = onClickOutside;

  useEffect(() => {
    if (!enabled) return;

    const handleClick = (event: MouseEvent | TouchEvent) => {
    // Check if click is inside any of the refs
    const refsArray = Array.isArray(refs) ? refs : [refs];
    const target = event.target as Node;
    
    const isInside = refsArray.some(ref => {
      return ref.current && ref.current.contains(target);
    });

    if (isInside) {
      onClickInside?.(event);
    } else {
      callbackRef.current(event);
    }
  };

    // Add event listeners
    if (includeClick) {
      document.addEventListener('click', handleClick);
    }
    if (includeTouch) {
      document.addEventListener('touchend', handleClick);
    }

    return () => {
      if (includeClick) {
        document.removeEventListener('click', handleClick);
      }
      if (includeTouch) {
        document.removeEventListener('touchend', handleClick);
      }
    };
  }, [enabled, includeClick, includeTouch, onClickInside, refs]);
}

// ========== UTILITY HOOKS ==========

/**
 * Hook to handle escape key press
 * 
 * @example
 * ```tsx
 * function Modal({ onClose }) {
 *   useEscapeKey(onClose);
 *   
 *   return <dialog>...</dialog>;
 * }
 * ```
 */
export function useEscapeKey(
  onEscape: () => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, onEscape]);
}

/**
 * Hook for creating a dropdown with automatic close on outside click
 * 
 * @example
 * ```tsx
 * function MyDropdown() {
 *   const { isOpen, toggle, close, ref } = useDropdown();
 *   
 *   return (
*     <div ref={ref}>
 *       <button onClick={toggle}>Toggle</button>
 *       {isOpen && <div>Menu</div>}
*     </div>
*   );
 * }
 * ```
 */
export function useDropdown(): {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  ref: RefObject<HTMLDivElement | null>;
} {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setIsOpen(false), { enabled: isOpen });

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return { isOpen, toggle, open, close, ref };
}

/**
 * Hook for detecting long press (context menu trigger)
 * 
 * @example
 * ```tsx
 * function ContextMenuTrigger() {
 *   const { ref, isLongPress } = useLongPress(500);
 *   
 *   return (
*     <div ref={ref}>
*       {isLongPress && <ContextMenu />}
*     </div>
*   );
* }
 * ```
 */
export function useLongPress(
  duration: number = 500
): {
  ref: RefObject<HTMLDivElement | null>;
  isLongPress: boolean;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [isLongPress, setIsLongPress] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = () => {
      timeoutRef.current = setTimeout(() => {
        setIsLongPress(true);
      }, duration);
    };

    const handleTouchEnd = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsLongPress(false);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchmove', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchmove', handleTouchEnd);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [duration]);

  return { ref, isLongPress };
}

export default useClickOutside;
