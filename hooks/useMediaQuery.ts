/**
 * useMediaQuery Hook
 * 
 * A responsive hook for matching CSS media queries with SSR support.
 * Useful for responsive design patterns and conditional rendering.
 * 
 * Features:
 * - SSR-safe with hydration support
 * - Reactive updates when media query changes
 * - TypeScript support with type-safe media query helpers
 * - Cleanup on unmount
 * - Performance optimized with memoization
 * 
 * @module hooks/useMediaQuery
 */

import { useState, useEffect, useMemo } from 'react';

// ========== TYPES ==========

export interface MediaQueryOptions {
  /** Default value for SSR (default: false) */
  defaultMatches?: boolean;
  /** Whether to hydrate from window.matchMedia (default: true) */
  hydrate?: boolean;
}

export interface MediaQueryResult {
  /** Whether the media query matches */
  matches: boolean;
  /** The media query string */
  query: string;
}

// ========== PREDEFINED BREAKPOINTS ==========

/**
 * Predefined breakpoint values (matching Tailwind defaults)
 * These can be used with useBreakpoint hook
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// ========== MAIN HOOK ==========

/**
 * Hook to match a CSS media query
 * 
 * @example
 * ```tsx
 * function ResponsiveComponent() {
 *   const isMobile = useMediaQuery('(max-width: 768px)');
 *   
 *   return (
 *     <div>
 *       {isMobile ? <MobileNav /> : <DesktopNav />}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // With SSR default
 * const isMobile = useMediaQuery('(max-width: 768px)', { 
 *   defaultMatches: true // Assume mobile for SSR
 * });
 * ```
 */
export function useMediaQuery(
  query: string,
  options: MediaQueryOptions = {}
): boolean {
  const { defaultMatches = false, hydrate = true } = options;

  const [matches, setMatches] = useState<boolean>(() => {
    // SSR: return default value
    if (typeof window === 'undefined') {
      return defaultMatches;
    }

    // Hydration: check actual match
    if (hydrate) {
      return window.matchMedia(query).matches;
    }

    return defaultMatches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQueryList.matches);

    // Handle changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers use addEventListener
    mediaQueryList.addEventListener('change', handleChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

// ========== UTILITY HOOKS ==========

/**
 * Hook to check if viewport matches a minimum width
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const isTabletUp = useMinWidth('md');
 *   
 *   return <div>{isTabletUp ? 'Tablet+' : 'Mobile'}</div>;
 * }
 * ```
 */
export function useMinWidth(breakpoint: Breakpoint | number): boolean {
  const query = useMemo(() => {
    const minWidth = typeof breakpoint === 'number' 
      ? breakpoint 
      : BREAKPOINTS[breakpoint];
    return `(min-width: ${minWidth}px)`;
  }, [breakpoint]);

  return useMediaQuery(query);
}

/**
 * Hook to check if viewport matches a maximum width
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const isMobile = useMaxWidth('md');
 *   
 *   return <div>{isMobile ? 'Mobile' : 'Desktop'}</div>;
 * }
 * ```
 */
export function useMaxWidth(breakpoint: Breakpoint | number): boolean {
  const query = useMemo(() => {
    const maxWidth = typeof breakpoint === 'number' 
      ? breakpoint 
      : BREAKPOINTS[breakpoint];
    return `(max-width: ${maxWidth}px)`;
  }, [breakpoint]);

  return useMediaQuery(query);
}

/**
 * Hook to check if viewport is within a range
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const isTablet = useBreakpointRange('sm', 'lg');
 *   
 *   return <div>{isTablet ? 'Tablet' : 'Other'}</div>;
 * }
 * ```
 */
export function useBreakpointRange(
  minBreakpoint: Breakpoint | number,
  maxBreakpoint: Breakpoint | number
): boolean {
  const min = typeof minBreakpoint === 'number' 
    ? minBreakpoint 
    : BREAKPOINTS[minBreakpoint];
  const max = typeof maxBreakpoint === 'number' 
    ? maxBreakpoint 
    : BREAKPOINTS[maxBreakpoint];

  const query = useMemo(() => {
    return `(min-width: ${min}px) and (max-width: ${max}px)`;
  }, [min, max]);

  return useMediaQuery(query);
}

/**
 * Hook to get the current active breakpoint
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const { breakpoint, isMobile, isTablet, isDesktop } = useBreakpoint();
 *   
 *   return (
 *     <div>
 *       Current: {breakpoint}
 *       {isMobile && <MobileUI />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBreakpoint(): {
  breakpoint: Breakpoint | 'xs';
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  is2xl: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
} {
  const is2xl = useMediaQuery(`(min-width: ${BREAKPOINTS['2xl']}px)`);
  const isXl = useMediaQuery(`(min-width: ${BREAKPOINTS.xl}px)`);
  const isLg = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
  const isMd = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
  const isSm = useMediaQuery(`(min-width: ${BREAKPOINTS.sm}px)`);

  return useMemo(() => {
    // Determine current breakpoint (largest that matches)
    let breakpoint: Breakpoint | 'xs' = 'xs';
    if (is2xl) breakpoint = '2xl';
    else if (isXl) breakpoint = 'xl';
    else if (isLg) breakpoint = 'lg';
    else if (isMd) breakpoint = 'md';
    else if (isSm) breakpoint = 'sm';

    return {
      breakpoint,
      isXs: breakpoint === 'xs',
      isSm: breakpoint === 'sm',
      isMd: breakpoint === 'md',
      isLg: breakpoint === 'lg',
      isXl: breakpoint === 'xl',
      is2xl: breakpoint === '2xl',
      isMobile: breakpoint === 'xs' || breakpoint === 'sm',
      isTablet: breakpoint === 'md',
      isDesktop: isLg || isXl || is2xl,
    };
  }, [is2xl, isXl, isLg, isMd, isSm]);
}

/**
 * Hook to check if user prefers high contrast mode
 */
export function usePrefersHighContrast(): boolean {
  return useMediaQuery('(prefers-contrast: more)');
}

/**
 * Hook to check if user prefers reduced data usage
 */
export function usePrefersReducedData(): boolean {
  return useMediaQuery('(prefers-reduced-data: reduce)');
}

/**
 * Hook to check if the device supports hover
 */
export function useHoverCapability(): boolean {
  return useMediaQuery('(hover: hover)');
}

/**
 * Hook to check if the device has a pointer (mouse)
 */
export function usePointerCapability(): {
  hasFinePointer: boolean;
  hasCoarsePointer: boolean;
  hasAnyPointer: boolean;
} {
  const hasFinePointer = useMediaQuery('(pointer: fine)');
  const hasCoarsePointer = useMediaQuery('(pointer: coarse)');

  return {
    hasFinePointer,
    hasCoarsePointer,
    hasAnyPointer: hasFinePointer || hasCoarsePointer,
  };
}

/**
 * Hook to check if the device is in landscape orientation
 */
export function useOrientation(): {
  isLandscape: boolean;
  isPortrait: boolean;
} {
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isPortrait = useMediaQuery('(orientation: portrait)');

  return { isLandscape, isPortrait };
}

/**
 * Hook to check if the screen can display HDR content
 */
export function useHDRSupport(): boolean {
  return useMediaQuery('(dynamic-range: high)');
}

/**
 * Hook to match multiple media queries at once
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const { matches } = useMediaQueries({
 *     isMobile: '(max-width: 768px)',
 *     isDark: '(prefers-color-scheme: dark)',
 *     reducedMotion: '(prefers-reduced-motion: reduce)',
 *   });
 *   
 *   return (
 *     <div className={matches.isDark ? 'dark' : 'light'}>
 *       {matches.isMobile ? 'Mobile' : 'Desktop'}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMediaQueries<T extends Record<string, string>>(
  queries: T
): { matches: Record<keyof T, boolean> } {
  const [matches, setMatches] = useState<Record<keyof T, boolean>>(() => {
    const result = {} as Record<keyof T, boolean>;
    for (const key in queries) {
      result[key] = false;
    }
    return result;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryLists: MediaQueryList[] = [];
    const handlers: ((this: MediaQueryList, ev: MediaQueryListEvent) => void)[] = [];

    const updateMatches = () => {
      const newMatches = {} as Record<keyof T, boolean>;
      
      for (const key in queries) {
        const query = queries[key];
        if (query) {
          const mql = window.matchMedia(query);
          newMatches[key] = mql.matches;
        }
      }
      
      setMatches(newMatches);
    };

    // Initial update
    updateMatches();

    // Setup listeners
    for (const key in queries) {
      const query = queries[key];
      if (query) {
        const mql = window.matchMedia(query);
        mediaQueryLists.push(mql);
        
        const handler = function(this: MediaQueryList, _ev: MediaQueryListEvent) {
          updateMatches();
        };
        
        handlers.push(handler);
        mql.addEventListener('change', handler);
      }
    }

    return () => {
      mediaQueryLists.forEach((mql, i) => {
        const handler = handlers[i];
        if (handler) {
          mql.removeEventListener('change', handler);
        }
      });
    };
  }, [queries]);

  return { matches };
}

export default useMediaQuery;
