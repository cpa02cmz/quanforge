/**
 * useOptimizedResize - High-performance window resize hook
 * 
 * Features:
 * - Debounced resize events to prevent layout thrashing
 * - Throttled updates for smooth animations
 * - RAF-based updates for better performance
 * - Memory-efficient with proper cleanup
 * - SSR-safe implementation
 * - Supports multiple resize modes (debounce, throttle, raf)
 * 
 * @module hooks/useOptimizedResize
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type ResizeMode = 'debounce' | 'throttle' | 'raf';

export interface ResizeOptions {
  /** Update mode: debounce (default), throttle, or raf */
  mode?: ResizeMode;
  /** Debounce/throttle delay in ms (default: 100) */
  delay?: number;
  /** Whether to update immediately on mount (default: true) */
  immediate?: boolean;
  /** Callback when resize occurs */
  onResize?: (size: { width: number; height: number }) => void;
}

export interface ResizeResult {
  /** Current window width */
  width: number;
  /** Current window height */
  height: number;
  /** Whether the resize event is being processed */
  isResizing: boolean;
  /** Breakpoint helpers */
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
}

/**
 * Default breakpoint values matching Tailwind's defaults
 */
const BREAKPOINTS = {
  sm: 640,   // Mobile
  md: 768,   // Tablet
  lg: 1024,  // Desktop
  xl: 1280,  // Large desktop
} as const;

/**
 * useOptimizedResize hook for efficient window resize handling
 * 
 * @example
 * ```tsx
 * // Basic usage
 * const { width, height, isMobile } = useOptimizedResize();
 * 
 * // With options
 * const { width, height, isResizing } = useOptimizedResize({
 *   mode: 'throttle',
 *   delay: 50,
 *   onResize: (size) => console.log(size)
 * });
 * ```
 */
export function useOptimizedResize(options: ResizeOptions = {}): ResizeResult {
  const {
    mode = 'debounce',
    delay = 100,
    immediate = true,
    onResize
  } = options;

  const [dimensions, setDimensions] = useState<ResizeResult>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        isResizing: false,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isLargeDesktop: true,
      };
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    return {
      width,
      height,
      isResizing: false,
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.sm && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      isLargeDesktop: width >= BREAKPOINTS.xl,
    };
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastArgsRef = useRef<{ width: number; height: number } | null>(null);

  const updateDimensions = useCallback((width: number, height: number) => {
    setDimensions(prev => ({
      ...prev,
      width,
      height,
      isResizing: false,
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.sm && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      isLargeDesktop: width >= BREAKPOINTS.xl,
    }));
    onResize?.({ width, height });
  }, [onResize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Mark as resizing during updates
      setDimensions(prev => ({ ...prev, isResizing: true }));

      switch (mode) {
        case 'debounce':
          // Clear existing timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          // Set new timeout
          timeoutRef.current = setTimeout(() => {
            updateDimensions(width, height);
          }, delay);
          break;

        case 'throttle':
          // Throttle: update immediately if enough time has passed
          if (!timeoutRef.current) {
            updateDimensions(width, height);
            timeoutRef.current = setTimeout(() => {
              timeoutRef.current = null;
            }, delay);
          } else {
            // Store latest args for final update
            lastArgsRef.current = { width, height };
          }
          break;

        case 'raf':
          // Cancel any pending RAF
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
          }
          // Schedule RAF update
          rafRef.current = requestAnimationFrame(() => {
            updateDimensions(width, height);
            rafRef.current = null;
          });
          break;
      }
    };

    // Immediate update on mount if enabled
    if (immediate) {
      updateDimensions(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [mode, delay, immediate, updateDimensions]);

  return dimensions;
}

export default useOptimizedResize;
