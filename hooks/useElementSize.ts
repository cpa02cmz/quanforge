/**
 * useElementSize Hook
 * 
 * A hook for tracking element dimensions with SSR support.
 * Useful for responsive layouts and animations based on element size.
 * 
 * Features:
 * - SSR-safe with ResizeObserver
 * - Debounced updates for performance
 * - TypeScript support
 * - Cleanup on unmount
 * - Border box support
 * 
 * @module hooks/useElementSize
 */

import { useState, useEffect, useRef, RefObject } from 'react';
import { useDebouncedCallback } from './useDebouncedValue';

// ========== TYPES ==========

export interface ElementSize {
  /** Element width in pixels */
  width: number;
  /** Element height in pixels */
  height: number;
}

export interface ElementSizeOptions {
  /** Debounce time in milliseconds (default: 100) */
  debounceMs?: number;
  /** Initial width for SSR (default: 0) */
  initialWidth?: number;
  /** Initial height for SSR (default: 0) */
  initialHeight?: number;
  /** Whether to include padding in measurement */
  includePadding?: boolean;
  /** Whether to include border in measurement */
  includeBorder?: boolean;
}

export interface ElementSizeResult extends ElementSize {
  /** Element offset from viewport left */
  offsetLeft: number;
  /** Element offset from viewport top */
  offsetTop: number;
}

// ========== MAIN HOOK ==========

/**
 * Hook to track element dimensions
 * 
 * @example
 * ```tsx
 * function ResponsiveBox() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const { width, height } = useElementSize(ref);
 *   
 *   return (
 *     <div ref={ref}>
 *       Size: {width}x{height}
 *     </div>
 *   );
 * }
 * ```
 */
export function useElementSize(
  ref: RefObject<HTMLElement>,
  options: ElementSizeOptions = {}
): ElementSizeResult {
  const {
    debounceMs = 100,
    initialWidth = 0,
    initialHeight = 0,
  } = options;

  const [size, setSize] = useState<ElementSize>({
    width: initialWidth,
    height: initialHeight,
  });

  const [offset, setOffset] = useState({ offsetLeft: 0, offsetTop: 0 });
  const previousSizeRef = useRef<ElementSize>({ width: initialWidth, height: initialHeight });

  const updateSize = useDebouncedCallback(() => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    
    const newSize = {
      width: rect.width,
      height: rect.height,
    };

    const newOffset = {
      offsetLeft: rect.left,
      offsetTop: rect.top,
    };

    // Only update if size changed
    if (
      previousSizeRef.current.width !== newSize.width ||
      previousSizeRef.current.height !== newSize.height
    ) {
      previousSizeRef.current = newSize;
      setSize(newSize);
      setOffset(newOffset);
    }
  }, debounceMs);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Initial measurement
    const rect = element.getBoundingClientRect();
    const initialSize = {
      width: rect.width,
      height: rect.height,
    };
    previousSizeRef.current = initialSize;
    setSize(initialSize);
    setOffset({
      offsetLeft: rect.left,
      offsetTop: rect.top,
    });

    // Use ResizeObserver if available
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === element) {
            updateSize();
          }
        }
      });

      resizeObserver.observe(element);

      return () => {
        resizeObserver.disconnect();
      };
    } else {
      // Fallback: listen to window resize
      const handleResize = () => updateSize();
      window.addEventListener('resize', handleResize, { passive: true });

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [ref, updateSize]);

  return {
    ...size,
    ...offset,
  };
}

// ========== UTILITY HOOKS ==========

/**
 * Hook to get just the element width
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const width = useElementWidth(ref);
 *   
 *   return <div ref={ref}>Width: {width}</div>;
 * }
 * ```
 */
export function useElementWidth(
  ref: RefObject<HTMLElement>,
  options: Omit<ElementSizeOptions, 'initialHeight'> = {}
): number {
  const { width } = useElementSize(ref, options);
  return width;
}

/**
 * Hook to get just the element height
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const height = useElementHeight(ref);
 *   
 *   return <div ref={ref}>Height: {height}</div>;
 * }
 * ```
 */
export function useElementHeight(
  ref: RefObject<HTMLElement>,
  options: Omit<ElementSizeOptions, 'initialWidth'> = {}
): number {
  const { height } = useElementSize(ref, options);
  return height;
}

/**
 * Hook to check if element is overflowing its container
 * 
 * @example
 * ```tsx
 * function ScrollableContainer() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const { isOverflowing, overflowX, overflowY } = useElementOverflow(ref);
 *   
 *   return (
 *     <div ref={ref} className={isOverflowing ? 'scrollable' : ''}>
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function useElementOverflow(
  ref: RefObject<HTMLElement>
): {
  isOverflowing: boolean;
  overflowX: boolean;
  overflowY: boolean;
} {
  const [overflow, setOverflow] = useState({
    isOverflowing: false,
    overflowX: false,
    overflowY: false,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const checkOverflow = () => {
      const isOverflowing = 
        element.scrollWidth > element.clientWidth ||
        element.scrollHeight > element.clientHeight;
      
      const overflowX = element.scrollWidth > element.clientWidth;
      const overflowY = element.scrollHeight > element.clientHeight;

      setOverflow({ isOverflowing, overflowX, overflowY });
    };

    // Initial check
    checkOverflow();

    // Create ResizeObserver to detect size changes
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(checkOverflow);
      observer.observe(element);

      return () => observer.disconnect();
    }
    return undefined;
  }, [ref]);

  return overflow;
}

/**
 * Hook to get element's position relative to viewport
 * 
 * @example
 * ```tsx
 * function VisibilityTracker() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const position = useElementViewportPosition(ref);
 *   
 *   return (
 *     <div ref={ref}>
 *       Visible: {position.isInViewport ? 'Yes' : 'No'}
 *     </div>
 *   );
 * }
 * ```
 */
export function useElementViewportPosition(
  ref: RefObject<HTMLElement>
): {
  isInViewport: boolean;
  isFullyVisible: boolean;
  visibilityPercentage: number;
  position: 'above' | 'below' | 'left' | 'right' | 'inside' | 'unknown';
} {
  const [position, setPosition] = useState({
    isInViewport: false,
    isFullyVisible: false,
    visibilityPercentage: 0,
    position: 'unknown' as 'above' | 'below' | 'left' | 'right' | 'inside' | 'unknown',
  });

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setPosition({
        isInViewport: true,
        isFullyVisible: true,
        visibilityPercentage: 100,
        position: 'inside',
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const rect = entry.boundingClientRect;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate visibility percentage
        const visibleWidth = Math.max(
          0,
          Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
        );
        const visibleHeight = Math.max(
          0,
          Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
        );
        const visibleArea = visibleWidth * visibleHeight;
        const totalArea = rect.width * rect.height;
        const visibilityPercentage = totalArea > 0 ? (visibleArea / totalArea) * 100 : 0;

        // Determine position
        let elementPosition: 'above' | 'below' | 'left' | 'right' | 'inside';
        if (rect.bottom < 0) {
          elementPosition = 'above';
        } else if (rect.top > viewportHeight) {
          elementPosition = 'below';
        } else if (rect.right < 0) {
          elementPosition = 'left';
        } else if (rect.left > viewportWidth) {
          elementPosition = 'right';
        } else {
          elementPosition = 'inside';
        }

        setPosition({
          isInViewport: entry.isIntersecting,
          isFullyVisible: visibilityPercentage >= 99,
          visibilityPercentage,
          position: elementPosition,
        });
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return position;
}

export default useElementSize;
