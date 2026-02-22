/**
 * useWindowSize Hook
 * 
 * A hook for tracking window dimensions with SSR support.
 * Useful for responsive layouts and conditional rendering.
 * 
 * Features:
 * - SSR-safe with hydration support
 * - Debounced updates for performance
 * - TypeScript support
 * - Cleanup on unmount
 * - Breakpoint helpers
 * 
 * @module hooks/useWindowSize
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useDebouncedCallback } from './useDebouncedValue';

// ========== TYPES ==========

export interface WindowSize {
  /** Window width in pixels */
  width: number;
  /** Window height in pixels */
  height: number;
}

export interface WindowSizeOptions {
  /** Debounce time in milliseconds (default: 100) */
  debounceMs?: number;
  /** Initial width for SSR (default: 1024) */
  initialWidth?: number;
  /** Initial height for SSR (default: 768) */
  initialHeight?: number;
  /** Whether to include scrollbars in measurement */
  includeScrollbars?: boolean;
}

export interface WindowSizeResult extends WindowSize {
  /** Whether the window is currently being resized */
  isResizing: boolean;
  /** Current breakpoint name */
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Is mobile device (< 768px) */
  isMobile: boolean;
  /** Is tablet device (768px - 1023px) */
  isTablet: boolean;
  /** Is desktop device (>= 1024px) */
  isDesktop: boolean;
}

// ========== BREAKPOINTS ==========

const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// ========== MAIN HOOK ==========

/**
 * Hook to track window dimensions
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const { width, height, isMobile } = useWindowSize();
 *   
 *   return (
 *     <div>
 *       {width}x{height}
 *       {isMobile && <MobileNav />}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // With debounce
 * const { width, height } = useWindowSize({ debounceMs: 250 });
 * ```
 */
export function useWindowSize(options: WindowSizeOptions = {}): WindowSizeResult {
  const {
    debounceMs = 100,
    initialWidth = 1024,
    initialHeight = 768,
  } = options;

  const [size, setSize] = useState<WindowSize>(() => {
    // SSR check
    if (typeof window === 'undefined') {
      return { width: initialWidth, height: initialHeight };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });

  const [isResizing, setIsResizing] = useState(false);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced size update
  const updateSize = useDebouncedCallback(() => {
    setSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    setIsResizing(false);
  }, debounceMs);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsResizing(true);
      
      // Clear previous timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      updateSize();
    };

    // Set initial size
    setSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [updateSize]);

  // Calculate breakpoint
  const breakpoint = useMemo(() => {
    if (size.width >= BREAKPOINTS['2xl']) return '2xl';
    if (size.width >= BREAKPOINTS.xl) return 'xl';
    if (size.width >= BREAKPOINTS.lg) return 'lg';
    if (size.width >= BREAKPOINTS.md) return 'md';
    if (size.width >= BREAKPOINTS.sm) return 'sm';
    return 'xs';
  }, [size.width]);

  // Calculate device type
  const isMobile = size.width < BREAKPOINTS.md;
  const isTablet = size.width >= BREAKPOINTS.md && size.width < BREAKPOINTS.lg;
  const isDesktop = size.width >= BREAKPOINTS.lg;

  return {
    ...size,
    isResizing,
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
  };
}

// ========== UTILITY HOOKS ==========

/**
 * Hook to get just the window width
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const width = useWindowWidth();
 *   
 *   return <div>Width: {width}px</div>;
 * }
 * ```
 */
export function useWindowWidth(options: Omit<WindowSizeOptions, 'initialHeight'> = {}): number {
  const { width } = useWindowSize(options);
  return width;
}

/**
 * Hook to get just the window height
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const height = useWindowHeight();
 *   
 *   return <div>Height: {height}px</div>;
 * }
 * ```
 */
export function useWindowHeight(options: Omit<WindowSizeOptions, 'initialWidth'> = {}): number {
  const { height } = useWindowSize(options);
  return height;
}

/**
 * Hook to check if viewport is above a certain width
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const isWide = useIsAboveWidth(1024);
 *   
 *   return <div>{isWide ? 'Wide' : 'Narrow'}</div>;
 * }
 * ```
 */
export function useIsAboveWidth(threshold: number): boolean {
  const { width } = useWindowSize();
  return width >= threshold;
}

/**
 * Hook to check if viewport is below a certain width
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const isNarrow = useIsBelowWidth(768);
 *   
 *   return <div>{isNarrow ? 'Mobile' : 'Desktop'}</div>;
 * }
 * ```
 */
export function useIsBelowWidth(threshold: number): boolean {
  const { width } = useWindowSize();
  return width < threshold;
}

/**
 * Hook to get aspect ratio of the window
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const { ratio, isLandscape, isPortrait, isSquare } = useAspectRatio();
 *   
 *   return <div>Aspect Ratio: {ratio.toFixed(2)}</div>;
 * }
 * ```
 */
export function useAspectRatio(): {
  ratio: number;
  isLandscape: boolean;
  isPortrait: boolean;
  isSquare: boolean;
} {
  const { width, height } = useWindowSize();

  return useMemo(() => {
    const ratio = width / height;
    return {
      ratio,
      isLandscape: ratio > 1,
      isPortrait: ratio < 1,
      isSquare: Math.abs(ratio - 1) < 0.05,
    };
  }, [width, height]);
}

/**
 * Hook to get window dimensions with throttled updates
 * Useful for animations that need real-time updates
 * 
 * @example
 * ```tsx
 * function AnimatedComponent() {
 *   const { width, height } = useWindowSizeThrottled(16); // 60fps
 *   
 *   return <div style={{ width, height }} />;
 * }
 * ```
 */
export function useWindowSizeThrottled(throttleMs: number = 16): WindowSize {
  const [size, setSize] = useState<WindowSize>(() => {
    if (typeof window === 'undefined') {
      return { width: 1024, height: 768 };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });

  const lastUpdateRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const now = Date.now();
      
      if (now - lastUpdateRef.current >= throttleMs) {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
        lastUpdateRef.current = now;
      } else {
        // Schedule update for next frame
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          setSize({
            width: window.innerWidth,
            height: window.innerHeight,
          });
          lastUpdateRef.current = Date.now();
        });
      }
    };

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [throttleMs]);

  return size;
}

export default useWindowSize;
