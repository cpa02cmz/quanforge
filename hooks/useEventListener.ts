/**
 * useEventListener Hook
 * 
 * A type-safe event listener hook with automatic cleanup to prevent memory leaks.
 * Provides a declarative way to add and remove event listeners in React components.
 * 
 * Features:
 * - Automatic cleanup on unmount
 * - Type-safe event types
 * - Support for custom event targets
 * - Optional condition-based activation
 * - Passive event listener support
 * - Once listener support
 * 
 * @module hooks/useEventListener
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Configuration options for event listener
 */
interface EventListenerOptions {
  /** Whether to use passive listener (default: false) */
  passive?: boolean;
  /** Whether to remove listener after first trigger (default: false) */
  once?: boolean;
  /** Whether to use capture phase (default: false) */
  capture?: boolean;
  /** Condition to enable/disable the listener (default: true) */
  enabled?: boolean;
}

/**
 * Default event listener options
 */
const DEFAULT_OPTIONS: Required<Omit<EventListenerOptions, 'enabled'>> = {
  passive: false,
  once: false,
  capture: false,
};

/**
 * Hook for adding event listeners with automatic cleanup
 * 
 * @example
 * ```tsx
 * // Window event
 * useEventListener('resize', handleResize);
 * 
 * // Custom target
 * useEventListener('click', handleClick, ref.current);
 * 
 * // With options
 * useEventListener('scroll', handleScroll, window, { passive: true });
 * 
 * // Conditional
 * useEventListener('keydown', handleKeyDown, window, { enabled: isActive });
 * ```
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  target?: Window | null,
  options?: EventListenerOptions
): void;

export function useEventListener<K extends keyof DocumentEventMap>(
  eventName: K,
  handler: (event: DocumentEventMap[K]) => void,
  target: Document | null,
  options?: EventListenerOptions
): void;

export function useEventListener<K extends keyof HTMLElementEventMap>(
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  target: HTMLElement | null,
  options?: EventListenerOptions
): void;

export function useEventListener(
  eventName: string,
  handler: EventListener,
  target: EventTarget | null | undefined,
  options?: EventListenerOptions
): void;

export function useEventListener(
  eventName: string,
  handler: EventListener,
  target?: Window | Document | HTMLElement | EventTarget | null,
  options?: EventListenerOptions
): void {
  const { passive, once, capture, enabled = true } = { ...DEFAULT_OPTIONS, ...options };
  
  // Store handler in ref to avoid re-binding on every render
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const eventTarget = target ?? (typeof window !== 'undefined' ? window : null);
    if (!eventTarget) return;

    const eventOptions: AddEventListenerOptions = {
      passive,
      once,
      capture,
    };

    const wrappedHandler: EventListener = (event) => {
      handlerRef.current(event);
    };

    eventTarget.addEventListener(eventName, wrappedHandler, eventOptions);

    return () => {
      eventTarget.removeEventListener(eventName, wrappedHandler, eventOptions);
    };
  }, [eventName, target, passive, once, capture, enabled]);
}

/**
 * Hook for multiple event listeners with automatic cleanup
 * 
 * @example
 * ```tsx
 * useEventListeners([
 *   { event: 'keydown', handler: handleKeyDown },
 *   { event: 'keyup', handler: handleKeyUp },
 * ], document);
 * ```
 */
interface EventConfig<E extends Event = Event> {
  event: string;
  handler: (event: E) => void;
  options?: EventListenerOptions;
}

export function useEventListeners(
  configs: EventConfig[],
  target?: Window | Document | HTMLElement | EventTarget | null
): void {
  configs.forEach(({ event, handler, options }) => {
    useEventListener(event, handler as EventListener, target, options);
  });
}

/**
 * Hook for keyboard event listener with automatic cleanup
 * 
 * @example
 * ```tsx
 * useKeyboardEvent('Escape', () => closeModal());
 * useKeyboardEvent('Enter', handleSubmit, { ctrlKey: true });
 * ```
 */
interface KeyboardOptions extends EventListenerOptions {
  /** Require Ctrl/Cmd key */
  ctrlKey?: boolean;
  /** Require Shift key */
  shiftKey?: boolean;
  /** Require Alt key */
  altKey?: boolean;
  /** Require Meta key */
  metaKey?: boolean;
}

export function useKeyboardEvent(
  key: string | string[],
  handler: (event: KeyboardEvent) => void,
  options?: KeyboardOptions
): void {
  const { ctrlKey, shiftKey, altKey, metaKey, enabled = true, ...eventOptions } = options ?? {};
  
  const keys = Array.isArray(key) ? key : [key];
  
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check if the key matches
      const keyMatch = keys.some((k) => event.key === k || event.code === k);
      if (!keyMatch) return;

      // Check modifier keys
      if (ctrlKey !== undefined && ctrlKey !== (event.ctrlKey || event.metaKey)) return;
      if (shiftKey !== undefined && shiftKey !== event.shiftKey) return;
      if (altKey !== undefined && altKey !== event.altKey) return;
      if (metaKey !== undefined && metaKey !== event.metaKey) return;

      event.preventDefault();
      handler(event);
    },
    [keys, ctrlKey, shiftKey, altKey, metaKey, handler]
  );

  useEventListener('keydown', handleKeyDown, typeof window !== 'undefined' ? window : null, {
    ...eventOptions,
    enabled,
  });
}

/**
 * Hook for window resize event with automatic cleanup and debouncing
 * 
 * @example
 * ```tsx
 * const windowSize = useWindowResize((size) => {
 *   console.log(`Window resized to ${size.width}x${size.height}`);
 * }, { debounce: 100 });
 * ```
 */
interface WindowSize {
  width: number;
  height: number;
}

interface ResizeOptions extends EventListenerOptions {
  /** Debounce delay in milliseconds */
  debounce?: number;
  /** Immediate callback on mount */
  immediate?: boolean;
}

export function useWindowResize(
  handler: (size: WindowSize) => void,
  options?: ResizeOptions
): WindowSize {
  const { debounce = 0, immediate = true, enabled = true, ...eventOptions } = options ?? {};
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sizeRef = useRef<WindowSize>({ width: 0, height: 0 });

  const handleResize = useCallback(() => {
    const newSize: WindowSize = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    sizeRef.current = newSize;

    if (debounce > 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        handler(newSize);
      }, debounce);
    } else {
      handler(newSize);
    }
  }, [handler, debounce]);

  useEventListener('resize', handleResize, typeof window !== 'undefined' ? window : null, {
    ...eventOptions,
    passive: true,
    enabled,
  });

  // Immediate callback on mount
  useEffect(() => {
    if (immediate && enabled && typeof window !== 'undefined') {
      handler({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [immediate, enabled, handler]);

  return sizeRef.current;
}

/**
 * Hook for click outside detection with automatic cleanup
 * 
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useClickOutside(ref, () => {
 *   closeDropdown();
 * });
 * ```
 */
export function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void,
  options?: EventListenerOptions
): void {
  const { enabled = true, ...eventOptions } = options ?? {};

  const handleClick = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside the ref element
      if (ref.current && !ref.current.contains(target)) {
        handler(event);
      }
    },
    [ref, handler]
  );

  useEventListener('mousedown', handleClick, typeof document !== 'undefined' ? document : null, {
    ...eventOptions,
    enabled,
  });

  useEventListener('touchstart', handleClick, typeof document !== 'undefined' ? document : null, {
    ...eventOptions,
    enabled,
  });
}

export default useEventListener;
