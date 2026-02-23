/**
 * useContainerQuery Hook
 * 
 * A hook for responsive design based on container size rather than viewport.
 * Uses ResizeObserver to detect container size changes and apply responsive styles.
 * 
 * Features:
 * - Container-based responsive design
 * - Breakpoint detection
 * - Size change callbacks
 * - SSR-safe implementation
 * - TypeScript support
 * - Multiple measurement modes
 * 
 * @module hooks/useContainerQuery
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  RefObject,
} from 'react';

// ========== TYPES ==========

export type ContainerSize = {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
};

export type ContainerBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export type ContainerBreakpoints = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
};

export type ContainerQueryOptions = {
  /** Custom breakpoints (default values provided) */
  breakpoints?: Partial<ContainerBreakpoints>;
  /** Debounce time in milliseconds for resize events */
  debounceMs?: number;
  /** Callback when container size changes */
  onResize?: (size: ContainerSize) => void;
  /** Callback when breakpoint changes */
  onBreakpointChange?: (breakpoint: ContainerBreakpoint) => void;
  /** Whether to include scrollbars in measurements */
  includeScrollbar?: boolean;
};

export type ContainerQueryResult = {
  /** Ref to attach to the container element */
  ref: RefObject<HTMLDivElement | null>;
  /** Current container size */
  size: ContainerSize;
  /** Current breakpoint */
  breakpoint: ContainerBreakpoint;
  /** Whether the container matches a breakpoint */
  matches: (breakpoint: ContainerBreakpoint) => boolean;
  /** Whether the container is at least a breakpoint */
  atLeast: (breakpoint: ContainerBreakpoint) => boolean;
  /** Whether the container is at most a breakpoint */
  atMost: (breakpoint: ContainerBreakpoint) => boolean;
  /** Whether the container is between two breakpoints */
  between: (min: ContainerBreakpoint, max: ContainerBreakpoint) => boolean;
  /** Get CSS custom properties for container query */
  cssProperties: Record<string, string>;
};

// Default breakpoints
const DEFAULT_BREAKPOINTS: ContainerBreakpoints = {
  xs: 0,
  sm: 384,
  md: 640,
  lg: 768,
  xl: 1024,
  '2xl': 1280,
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Get the current breakpoint based on width
 */
function getBreakpoint(
  width: number,
  breakpoints: ContainerBreakpoints
): ContainerBreakpoint {
  if (width >= breakpoints['2xl']) return '2xl';
  if (width >= breakpoints.xl) return 'xl';
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  if (width >= breakpoints.sm) return 'sm';
  return 'xs';
}

/**
 * Get breakpoint value
 */
function getBreakpointValue(
  breakpoint: ContainerBreakpoint,
  breakpoints: ContainerBreakpoints
): number {
  return breakpoints[breakpoint];
}

// ========== MAIN HOOK ==========

/**
 * A hook for container-based responsive design
 * 
 * @example
 * ```tsx
 * function Card() {
 *   const container = useContainerQuery({
 *     onBreakpointChange: (bp) => console.log('Breakpoint:', bp),
 *   });
 * 
 *   return (
 *     <div ref={container.ref} className="card">
 *       {container.atLeast('md') ? (
 *         <LargeLayout />
 *       ) : (
 *         <SmallLayout />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // With custom breakpoints
 * const container = useContainerQuery({
 *   breakpoints: {
 *     sm: 300,
 *     md: 500,
 *     lg: 800,
 *   },
 * });
 * ```
 */
export function useContainerQuery(
  options: ContainerQueryOptions = {}
): ContainerQueryResult {
  const {
    breakpoints: customBreakpoints,
    debounceMs = 100,
    onResize,
    onBreakpointChange,
    includeScrollbar = false,
  } = options;

  const breakpoints = useMemo(
    () => ({ ...DEFAULT_BREAKPOINTS, ...customBreakpoints }),
    [customBreakpoints]
  );

  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });
  const [breakpoint, setBreakpoint] = useState<ContainerBreakpoint>('xs');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousBreakpointRef = useRef<ContainerBreakpoint>('xs');

  // Update size and breakpoint
  const updateSize = useCallback(
    (entry: ResizeObserverEntry) => {
      const { width, height } = includeScrollbar
        ? entry.target.getBoundingClientRect()
        : {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          };

      const newSize = { width: Math.round(width), height: Math.round(height) };
      const newBreakpoint = getBreakpoint(newSize.width, breakpoints);

      setSize(newSize);
      setBreakpoint(newBreakpoint);

      // Callbacks
      onResize?.(newSize);

      if (newBreakpoint !== previousBreakpointRef.current) {
        previousBreakpointRef.current = newBreakpoint;
        onBreakpointChange?.(newBreakpoint);
      }
    },
    [breakpoints, includeScrollbar, onResize, onBreakpointChange]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Initial measurement
    const rect = includeScrollbar
      ? element.getBoundingClientRect()
      : {
          width: element.clientWidth,
          height: element.clientHeight,
        };

    const initialSize = {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
    const initialBreakpoint = getBreakpoint(initialSize.width, breakpoints);

    setSize(initialSize);
    setBreakpoint(initialBreakpoint);
    previousBreakpointRef.current = initialBreakpoint;

    // Set up ResizeObserver
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      if (debounceMs > 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          updateSize(entry);
        }, debounceMs);
      } else {
        updateSize(entry);
      }
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [debounceMs, includeScrollbar, breakpoints, updateSize]);

  // Check if container matches a specific breakpoint
  const matches = useCallback(
    (bp: ContainerBreakpoint): boolean => {
      return breakpoint === bp;
    },
    [breakpoint]
  );

  // Check if container is at least a breakpoint
  const atLeast = useCallback(
    (bp: ContainerBreakpoint): boolean => {
      return size.width >= getBreakpointValue(bp, breakpoints);
    },
    [size.width, breakpoints]
  );

  // Check if container is at most a breakpoint
  const atMost = useCallback(
    (bp: ContainerBreakpoint): boolean => {
      return size.width < getBreakpointValue(bp, breakpoints);
    },
    [size.width, breakpoints]
  );

  // Check if container is between two breakpoints
  const between = useCallback(
    (min: ContainerBreakpoint, max: ContainerBreakpoint): boolean => {
      return (
        size.width >= getBreakpointValue(min, breakpoints) &&
        size.width < getBreakpointValue(max, breakpoints)
      );
    },
    [size.width, breakpoints]
  );

  // Generate CSS custom properties
  const cssProperties = useMemo(
    () => ({
      '--container-width': `${size.width}px`,
      '--container-height': `${size.height}px`,
      '--container-breakpoint': breakpoint,
    }),
    [size, breakpoint]
  );

  return useMemo(
    () => ({
      ref,
      size,
      breakpoint,
      matches,
      atLeast,
      atMost,
      between,
      cssProperties,
    }),
    [size, breakpoint, matches, atLeast, atMost, between, cssProperties]
  );
}

// ========== UTILITY HOOKS ==========

/**
 * Hook for simple container width detection
 * 
 * @example
 * ```tsx
 * function ResponsiveContainer() {
 *   const { ref, width } = useContainerWidth();
 * 
 *   return (
 *     <div ref={ref}>
 *       Width: {width}px
 *     </div>
 *   );
 * }
 * ```
 */
export function useContainerWidth(): {
  ref: RefObject<HTMLDivElement | null>;
  width: number;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWidth(Math.round(entry.contentRect.width));
      }
    });

    observer.observe(element);
    setWidth(Math.round(element.clientWidth));

    return () => observer.disconnect();
  }, []);

  return useMemo(() => ({ ref, width }), [width]);
}

/**
 * Hook for responsive columns based on container width
 * 
 * @example
 * ```tsx
 * function Grid() {
 *   const { ref, columns } = useResponsiveColumns({
 *     xs: 1,
 *     sm: 2,
 *     md: 3,
 *     lg: 4,
 *   });
 * 
 *   return (
 *     <div ref={ref} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
 *       {items.map(item => <Item key={item.id} {...item} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useResponsiveColumns(
  columnConfig: Partial<Record<ContainerBreakpoint, number>>
): {
  ref: RefObject<HTMLDivElement | null>;
  columns: number;
  size: ContainerSize;
} {
  const { ref, size, breakpoint } = useContainerQuery();

  const columns = useMemo(() => {
    // Try to match exact breakpoint first
    if (columnConfig[breakpoint] !== undefined) {
      return columnConfig[breakpoint]!;
    }

    // Find the largest matching breakpoint
    const breakpointOrder: ContainerBreakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = breakpointOrder.indexOf(breakpoint);

    for (let i = currentIndex; i >= 0; i--) {
      const bp = breakpointOrder[i];
      const columnCount = columnConfig[bp as ContainerBreakpoint];
      if (columnCount !== undefined) {
        return columnCount;
      }
    }

    // Default to 1 column
    return 1;
  }, [breakpoint, columnConfig]);

  return useMemo(() => ({ ref, columns, size }), [ref, columns, size]);
}

/**
 * Hook for detecting container orientation
 * 
 * @example
 * ```tsx
 * function AdaptiveLayout() {
 *   const { ref, isPortrait, isLandscape } = useContainerOrientation();
 * 
 *   return (
 *     <div ref={ref} style={{ flexDirection: isPortrait ? 'column' : 'row' }}>
 *       <Sidebar />
 *       <Content />
 *     </div>
 *   );
 * }
 * ```
 */
export function useContainerOrientation(): {
  ref: RefObject<HTMLDivElement | null>;
  isPortrait: boolean;
  isLandscape: boolean;
  aspectRatio: number;
} {
  const { ref, size } = useContainerQuery();

  const isPortrait = size.height > size.width;
  const isLandscape = size.width > size.height;
  const aspectRatio = size.width > 0 ? size.width / size.height : 1;

  return useMemo(
    () => ({
      ref,
      isPortrait,
      isLandscape,
      aspectRatio: Math.round(aspectRatio * 100) / 100,
    }),
    [isPortrait, isLandscape, aspectRatio]
  );
}

export default useContainerQuery;
