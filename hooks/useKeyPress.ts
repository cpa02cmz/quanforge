/**
 * useKeyPress Hook
 * 
 * Hook to detect key presses and keyboard shortcuts.
 * Useful for implementing keyboard navigation, shortcuts, and accessibility features.
 * 
 * Features:
 * - Single key detection
 * - Keyboard shortcut combinations (Ctrl+S, Cmd+K, etc.)
 * - Key sequence detection (Konami code, etc.)
 * - Configurable target element
 * - Event options (preventDefault, stopPropagation)
 * - TypeScript support with key type definitions
 * 
 * @module hooks/useKeyPress
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ========== TYPES ==========

export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';

export interface KeyPressOptions {
  /** Target element to attach listener (default: window) */
  target?: HTMLElement | Window | null;
  /** Whether to call preventDefault on keydown (default: false) */
  preventDefault?: boolean;
  /** Whether to call stopPropagation on keydown (default: false) */
  stopPropagation?: boolean;
  /** Whether to listen for keydown (default: true) */
  keydown?: boolean;
  /** Whether to listen for keyup (default: false) */
  keyup?: boolean;
  /** Callback when key is pressed */
  onPress?: () => void;
  /** Callback when key is released */
  onRelease?: () => void;
}

export interface ShortcutOptions extends KeyPressOptions {
  /** Whether the shortcut is enabled (default: true) */
  enabled?: boolean;
  /** Description for accessibility/documentation */
  description?: string;
}

export interface KeySequenceOptions extends KeyPressOptions {
  /** Maximum time between key presses in ms (default: 1000) */
  timeout?: number;
  /** Whether to reset on wrong key (default: true) */
  resetOnWrongKey?: boolean;
}

// ========== HELPER FUNCTIONS ==========

/**
 * Check if a modifier key is currently pressed
 */
function isModifierPressed(modifier: ModifierKey, event: KeyboardEvent): boolean {
  switch (modifier) {
    case 'ctrl':
      return event.ctrlKey;
    case 'alt':
      return event.altKey;
    case 'shift':
      return event.shiftKey;
    case 'meta':
      return event.metaKey;
    default:
      return false;
  }
}

/**
 * Check if the event key matches the target key
 */
function matchesKey(event: KeyboardEvent, targetKey: string): boolean {
  const eventKey = event.key.toLowerCase();
  const eventCode = event.code.toLowerCase();
  const target = targetKey.toLowerCase();

  return (
    eventKey === target ||
    eventCode === target ||
    eventCode === `key${target}` ||
    eventCode === `digit${target}` ||
    eventCode === `numpad${target}` ||
    eventCode === `arrow${target}`
  );
}

// ========== MAIN HOOKS ==========

/**
 * Hook to detect when a specific key is pressed
 * 
 * @example
 * ```tsx
 * function Modal({ onClose }) {
 *   const isEscapePressed = useKeyPress('Escape', {
 *     onPress: onClose,
 *     preventDefault: true,
 *   });
 *   
 *   return (
 *     <div className="modal" role="dialog">
 *       {/* Modal content *\/}
 *     </div>
 *   );
 * }
 * ```
 */
export function useKeyPress(
  targetKey: string,
  options: KeyPressOptions = {}
): boolean {
  const {
    target = null,
    preventDefault = false,
    stopPropagation = false,
    keydown = true,
    keyup = false,
    onPress,
    onRelease,
  } = options;

  const [keyPressed, setKeyPressed] = useState(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (matchesKey(event, targetKey)) {
        if (preventDefault) {
          event.preventDefault();
        }
        if (stopPropagation) {
          event.stopPropagation();
        }
        setKeyPressed(true);
        onPress?.();
      }
    },
    [targetKey, preventDefault, stopPropagation, onPress]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (matchesKey(event, targetKey)) {
        setKeyPressed(false);
        onRelease?.();
      }
    },
    [targetKey, onRelease]
  );

  useEffect(() => {
    const targetElement = target || window;

    if (keydown) {
      targetElement.addEventListener('keydown', handleKeyDown as EventListener);
    }
    if (keyup) {
      targetElement.addEventListener('keyup', handleKeyUp as EventListener);
    }

    return () => {
      if (keydown) {
        targetElement.removeEventListener('keydown', handleKeyDown as EventListener);
      }
      if (keyup) {
        targetElement.removeEventListener('keyup', handleKeyUp as EventListener);
      }
    };
  }, [target, keydown, keyup, handleKeyDown, handleKeyUp]);

  return keyPressed;
}

/**
 * Hook to detect keyboard shortcuts with modifiers
 * 
 * @example
 * ```tsx
 * function Editor() {
 *   useKeyboardShortcut(['ctrl', 's'], {
 *     onPress: () => saveDocument(),
 *     preventDefault: true,
 *     description: 'Save document',
 *   });
 *   
 *   useKeyboardShortcut(['meta', 'k'], {
 *     onPress: () => openCommandPalette(),
 *     description: 'Open command palette',
 *   });
 *   
 *   return <textarea />;
 * }
 * ```
 */
export function useKeyboardShortcut(
  keys: (ModifierKey | string)[],
  options: ShortcutOptions = {}
): boolean {
  const {
    target = null,
    preventDefault = true,
    stopPropagation = false,
    enabled = true,
    onPress,
    description,
  } = options;

  const [isPressed, setIsPressed] = useState(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Separate modifier keys and regular keys
      const modifiers = keys.filter((key): key is ModifierKey =>
        ['ctrl', 'alt', 'shift', 'meta'].includes(key)
      );
      const regularKeys = keys.filter((key) =>
        !['ctrl', 'alt', 'shift', 'meta'].includes(key)
      );

      // Check if all required modifiers are pressed
      const allModifiersPressed = modifiers.every((mod) =>
        isModifierPressed(mod, event)
      );

      // Check if any of the regular keys match
      const keyMatches = regularKeys.some((key) => matchesKey(event, key));

      if (allModifiersPressed && keyMatches) {
        if (preventDefault) {
          event.preventDefault();
        }
        if (stopPropagation) {
          event.stopPropagation();
        }
        setIsPressed(true);
        onPress?.();
      }
    },
    [keys, enabled, preventDefault, stopPropagation, onPress]
  );

  const handleKeyUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const targetElement = target || window;

    targetElement.addEventListener('keydown', handleKeyDown as EventListener);
    targetElement.addEventListener('keyup', handleKeyUp as EventListener);

    return () => {
      targetElement.removeEventListener('keydown', handleKeyDown as EventListener);
      targetElement.removeEventListener('keyup', handleKeyUp as EventListener);
    };
  }, [target, enabled, handleKeyDown, handleKeyUp]);

  // Log description in development for documentation
  useEffect(() => {
    if (import.meta.env.DEV && description) {
      // Shortcut registered: ${keys.join('+')} - ${description}
    }
  }, [keys, description]);

  return isPressed;
}

/**
 * Hook to detect key sequences (like Konami code)
 * 
 * @example
 * ```tsx
 * function EasterEgg() {
 *   const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
 *   
 *   const sequenceDetected = useKeySequence(konamiCode, {
 *     onPress: () => showEasterEgg(),
 *     timeout: 2000,
 *   });
 *   
 *   return sequenceDetected ? <SecretMessage /> : null;
 * }
 * ```
 */
export function useKeySequence(
  sequence: string[],
  options: KeySequenceOptions = {}
): boolean {
  const {
    target = null,
    preventDefault = false,
    stopPropagation = false,
    timeout = 1000,
    resetOnWrongKey = true,
    onPress,
  } = options;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSequence = useCallback(() => {
    setCurrentIndex(0);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const expectedKey = sequence[currentIndex];

      if (expectedKey && matchesKey(event, expectedKey)) {
        if (preventDefault) {
          event.preventDefault();
        }
        if (stopPropagation) {
          event.stopPropagation();
        }

        const nextIndex = currentIndex + 1;

        if (nextIndex === sequence.length) {
          // Sequence complete
          setIsComplete(true);
          onPress?.();
          resetSequence();
        } else {
          // Continue sequence
          setCurrentIndex(nextIndex);

          // Reset timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(resetSequence, timeout);
        }
      } else if (resetOnWrongKey && currentIndex > 0) {
        // Wrong key pressed, reset
        resetSequence();
      }
    },
    [sequence, currentIndex, preventDefault, stopPropagation, resetOnWrongKey, timeout, resetSequence, onPress]
  );

  useEffect(() => {
    const targetElement = target || window;

    targetElement.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      targetElement.removeEventListener('keydown', handleKeyDown as EventListener);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [target, handleKeyDown]);

  // Reset after completion
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => setIsComplete(false), 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isComplete]);

  return isComplete;
}

/**
 * Hook to track currently pressed keys
 * 
 * @example
 * ```tsx
 * function GlobalKeyTracker() {
 *   const { pressedKeys, pressedModifiers } = usePressedKeys();
 *   
 *   return (
 *     <div>
 *       <p>Pressed keys: {Array.from(pressedKeys).join(', ')}</p>
 *       <p>Modifiers: {pressedModifiers.join(', ')}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePressedKeys(): {
  pressedKeys: Set<string>;
  pressedModifiers: ModifierKey[];
} {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [pressedModifiers, setPressedModifiers] = useState<ModifierKey[]>([]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    setPressedKeys((prev) => new Set(prev).add(event.key));

    const modifiers: ModifierKey[] = [];
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');
    setPressedModifiers(modifiers);
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    setPressedKeys((prev) => {
      const next = new Set(prev);
      next.delete(event.key);
      return next;
    });
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Also clear on blur (window losing focus)
    const handleBlur = () => {
      setPressedKeys(new Set());
      setPressedModifiers([]);
    };
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyDown, handleKeyUp]);

  return { pressedKeys, pressedModifiers };
}

export default useKeyPress;
