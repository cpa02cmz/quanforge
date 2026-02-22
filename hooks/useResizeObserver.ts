/**
 * useResizeObserver Hook
 * High-performance element resize observation using ResizeObserver API
 * 
 * Features:
 * - Efficient element size tracking with ResizeObserver
 * - Debounced updates for performance
 * - Multiple element support
 * - SSR-safe implementation
 * - Automatic cleanup on unmount
 * - Memory-efficient with shared observer instance
 * 
 * @module hooks/useResizeObserver
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ========== TYPES ==========

export interface ResizeEntry {
  /** Element width in pixels */
  width: number;
  /** Element height in pixels */
  height: number;
  /** Content box size */
  contentBoxSize: {
    inlineSize: number;
    blockSize: number;
  };
  /** Border box size */
  borderBoxSize: {
    inlineSize: number;
    blockSize: number;
  };
  /** Device pixel ratio at measurement time */
  devicePixelRatio: number;
}

export interface ResizeObserverOptions {
  /** Debounce time in milliseconds (default: 16 for ~60fps) */
  debounceMs?: number;
  /** Box type to observe (default: 'content-box') */
  box?: 'content-box' | 'border-box' | 'device-pixel-content-box';
  /** Callback when size changes */
  onResize?: (entry: ResizeEntry, element: Element) => void;
  /** Initial size before first measurement */
  initialSize?: { width: number; height: number };
}

export interface UseResizeObserverResult {
  /** Current size entry */
  size: ResizeEntry;
  /** Ref to attach to target element */
  ref: <T extends Element>(node: T | null) => void;
  /** Manually trigger measurement */
  measure: () => void;
  /** Whether currently observing */
  isObserving: boolean;
}

// ========== SINGLETON OBSERVER MANAGER ==========

interface ObserverEntry {
  callback: (entry: ResizeObserverEntry) => void;
  options: ResizeObserverOptions;
}

// Shared observer instance for better performance
let sharedObserver: ResizeObserver | null = null;
const observerCallbacks = new Map<Element, ObserverEntry>();
let observerInitialized = false;

function getSharedObserver(): ResizeObserver | null {
  if (typeof window === 'undefined' || !('ResizeObserver' in window)) {
    return null;
  }

  if (!sharedObserver && !observerInitialized) {
    observerInitialized = true;
    
    sharedObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const callbackData = observerCallbacks.get(entry.target);
        if (callbackData) {
          // Apply debouncing at the callback level
          const { callback, options } = callbackData;
          
          // Helper to extract size from contentBoxSize/borderBoxSize
          const extractSize = (size: readonly ResizeObserverSize[] | ResizeObserverSize) => {
            const s = Array.isArray(size) ? size[0] : size;
            return s ? { inlineSize: s.inlineSize, blockSize: s.blockSize } : { inlineSize: 0, blockSize: 0 };
          };

          const contentBox = extractSize(entry.contentBoxSize);
          const borderBox = extractSize(entry.borderBoxSize);
          
          const resizeEntry: ResizeEntry = {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
            contentBoxSize: contentBox,
            borderBoxSize: borderBox,
            devicePixelRatio: window.devicePixelRatio,
          };

          callback(entry);
          options.onResize?.(resizeEntry, entry.target);
        }
      }
    });
  }

  return sharedObserver;
}

// ========== HELPER FUNCTIONS ==========

function createInitialSize(options: ResizeObserverOptions): ResizeEntry {
  const { initialSize } = options;
  return {
    width: initialSize?.width ?? 0,
    height: initialSize?.height ?? 0,
    contentBoxSize: {
      inlineSize: initialSize?.width ?? 0,
      blockSize: initialSize?.height ?? 0,
    },
    borderBoxSize: {
      inlineSize: initialSize?.width ?? 0,
      blockSize: initialSize?.height ?? 0,
    },
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  };
}

// ========== MAIN HOOK ==========

/**
 * Hook to observe element size changes using ResizeObserver
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const { size, ref } = useResizeObserver();
 *   
 *   return (
 *     <div ref={ref}>
 *       Size: {size.width}x{size.height}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // With options
 * const { size, ref } = useResizeObserver({
 *   debounceMs: 100,
 *   box: 'border-box',
 *   onResize: (entry) => {
 *     console.log('Resized:', entry.width, entry.height);
 *   },
 * });
 * ```
 */
export function useResizeObserver(
  options: ResizeObserverOptions = {}
): UseResizeObserverResult {
  const { debounceMs = 16, box = 'content-box' } = options;

  const [size, setSize] = useState<ResizeEntry>(() => createInitialSize(options));
  const [isObserving, setIsObserving] = useState(false);
  
  const elementRef = useRef<Element | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEntryRef = useRef<ResizeObserverEntry | null>(null);

  // Helper to extract size from contentBoxSize/borderBoxSize
  const extractSize = useCallback((sizeData: readonly ResizeObserverSize[] | ResizeObserverSize) => {
    const s = Array.isArray(sizeData) ? sizeData[0] : sizeData;
    return s ? { inlineSize: s.inlineSize, blockSize: s.blockSize } : { inlineSize: 0, blockSize: 0 };
  }, []);

  // Debounced size update
  const updateSize = useCallback((entry: ResizeObserverEntry) => {
    const createResizeEntry = () => {
      const contentBox = extractSize(entry.contentBoxSize);
      const borderBox = extractSize(entry.borderBoxSize);
      
      return {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
        contentBoxSize: contentBox,
        borderBoxSize: borderBox,
        devicePixelRatio: window.devicePixelRatio,
      };
    };

    if (debounceMs <= 0) {
      setSize(createResizeEntry());
      return;
    }

    pendingEntryRef.current = entry;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (pendingEntryRef.current) {
        setSize(createResizeEntry());
        pendingEntryRef.current = null;
      }
      debounceTimeoutRef.current = null;
    }, debounceMs);
  }, [debounceMs, extractSize]);

  // Ref callback to attach to element
  const ref = useCallback(<T extends Element>(node: T | null) => {
    // Cleanup previous element
    if (elementRef.current) {
      const observer = getSharedObserver();
      if (observer) {
        observer.unobserve(elementRef.current);
        observerCallbacks.delete(elementRef.current);
      }
      setIsObserving(false);
    }

    elementRef.current = node;

    if (node) {
      const observer = getSharedObserver();
      if (observer) {
        observerCallbacks.set(node, {
          callback: updateSize,
          options: { ...options, onResize: options.onResize },
        });
        observer.observe(node, { box });
        setIsObserving(true);
      }
    }
  }, [updateSize, box, options]);

  // Manual measurement
  const measure = useCallback(() => {
    if (elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect();
      const resizeEntry: ResizeEntry = {
        width: rect.width,
        height: rect.height,
        contentBoxSize: {
          inlineSize: rect.width,
          blockSize: rect.height,
        },
        borderBoxSize: {
          inlineSize: rect.width,
          blockSize: rect.height,
        },
        devicePixelRatio: window.devicePixelRatio,
      };
      setSize(resizeEntry);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      if (elementRef.current) {
        const observer = getSharedObserver();
        if (observer) {
          observer.unobserve(elementRef.current);
          observerCallbacks.delete(elementRef.current);
        }
      }
    };
  }, []);

  return {
    size,
    ref,
    measure,
    isObserving,
  };
}

// ========== UTILITY HOOKS ==========

/**
 * Hook to get just the width of an element
 */
export function useElementWidth(options: Omit<ResizeObserverOptions, 'initialSize'> = {}): {
  width: number;
  ref: <T extends Element>(node: T | null) => void;
} {
  const { size, ref } = useResizeObserver(options);
  return { width: size.width, ref };
}

/**
 * Hook to get just the height of an element
 */
export function useElementHeight(options: Omit<ResizeObserverOptions, 'initialSize'> = {}): {
  height: number;
  ref: <T extends Element>(node: T | null) => void;
} {
  const { size, ref } = useResizeObserver(options);
  return { height: size.height, ref };
}

/**
 * Hook to check if an element is above a certain width
 */
export function useIsElementAboveWidth(
  threshold: number,
  options: ResizeObserverOptions = {}
): {
  isAbove: boolean;
  ref: <T extends Element>(node: T | null) => void;
} {
  const { size, ref } = useResizeObserver(options);
  const isAbove = useMemo(() => size.width >= threshold, [size.width, threshold]);
  return { isAbove, ref };
}

/**
 * Hook to get element aspect ratio
 */
export function useElementAspectRatio(options: ResizeObserverOptions = {}): {
  ratio: number;
  isLandscape: boolean;
  isPortrait: boolean;
  isSquare: boolean;
  ref: <T extends Element>(node: T | null) => void;
} {
  const { size, ref } = useResizeObserver(options);

  return useMemo(() => {
    const ratio = size.height > 0 ? size.width / size.height : 0;
    return {
      ratio,
      isLandscape: ratio > 1,
      isPortrait: ratio < 1,
      isSquare: Math.abs(ratio - 1) < 0.05,
      ref,
    };
  }, [size.width, size.height, ref]);
}

/**
 * Hook to get element breakpoints
 */
export function useElementBreakpoint(options: ResizeObserverOptions = {}): {
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isSmall: boolean;
  isMedium: boolean;
  isLarge: boolean;
  ref: <T extends Element>(node: T | null) => void;
} {
  const { size, ref } = useResizeObserver(options);

  return useMemo(() => {
    const width = size.width;
    let breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    
    if (width >= 1536) breakpoint = '2xl';
    else if (width >= 1280) breakpoint = 'xl';
    else if (width >= 1024) breakpoint = 'lg';
    else if (width >= 768) breakpoint = 'md';
    else if (width >= 640) breakpoint = 'sm';
    else breakpoint = 'xs';

    return {
      breakpoint,
      isSmall: width < 768,
      isMedium: width >= 768 && width < 1024,
      isLarge: width >= 1024,
      ref,
    };
  }, [size.width, ref]);
}

export default useResizeObserver;
