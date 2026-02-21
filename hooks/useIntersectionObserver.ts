/**
 * useIntersectionObserver Hook
 * 
 * Hook to observe element intersection with viewport or container.
 * Useful for lazy loading components, infinite scroll, visibility tracking.
 * 
 * Features:
 * - Configurable threshold and root margin
 * - Support for multiple thresholds
 * - Freeze once intersected option (for one-time triggers)
 * - SSR-safe with fallback
 * - TypeScript support
 * - Cleanup on unmount
 * 
 * @module hooks/useIntersectionObserver
 */

import { useState, useEffect, useRef, useCallback, RefObject } from 'react';

// ========== TYPES ==========

export interface IntersectionObserverOptions {
  /** Element that is used as a viewport for checking visibility (default: null = viewport) */
  root?: Element | null;
  /** Margin around the root element (CSS margin syntax) */
  rootMargin?: string;
  /** Threshold(s) at which to trigger callback (0-1) */
  threshold?: number | number[];
  /** Whether to stop observing after first intersection (default: false) */
  triggerOnce?: boolean;
  /** Whether the observer is enabled (default: true) */
  enabled?: boolean;
  /** Callback when intersection changes */
  onChange?: (entry: IntersectionObserverEntry) => void;
}

export interface IntersectionObserverResult {
  /** Ref to attach to the target element */
  ref: RefObject<HTMLDivElement | null>;
  /** Whether the element is currently intersecting */
  isIntersecting: boolean;
  /** Intersection ratio (0-1) */
  intersectionRatio: number;
  /** Whether the element has ever intersected */
  hasIntersected: boolean;
  /** BoundingClientRect of the target element */
  bounds: DOMRectReadOnly | null;
  /** The intersection observer entry */
  entry: IntersectionObserverEntry | null;
}

// ========== MAIN HOOK ==========

/**
 * Hook to observe element intersection with viewport or container
 * 
 * @example
 * ```tsx
 * function LazyImage({ src, alt }) {
 *   const { ref, isIntersecting } = useIntersectionObserver({
 *     threshold: 0.1,
 *     rootMargin: '100px',
 *   });
 *   
 *   return (
 *     <div ref={ref}>
 *       {isIntersecting ? (
 *         <img src={src} alt={alt} />
 *       ) : (
 *         <div className="skeleton" />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // Infinite scroll with triggerOnce
 * function InfiniteList({ onLoadMore }) {
 *   const { ref, hasIntersected } = useIntersectionObserver({
 *     threshold: 1.0,
 *     triggerOnce: true,
 *     onChange: (entry) => {
 *       if (entry.isIntersecting) {
 *         onLoadMore();
 *       }
 *     },
 *   });
 *   
 *   return (
 *     <>
 *       <ItemsList />
 *       <div ref={ref} className="load-more-trigger" />
 *     </>
 *   );
 * }
 * ```
 */
export function useIntersectionObserver(
  options: IntersectionObserverOptions = {}
): IntersectionObserverResult {
  const {
    root = null,
    rootMargin = '1px',
    threshold = 0,
    triggerOnce = false,
    enabled = true,
    onChange,
  } = options;

  const elementRef = useRef<HTMLDivElement | null>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [hasIntersected, setHasIntersected] = useState(false);

  // Memoized callback for intersection changes
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [currentEntry] = entries;

      if (currentEntry) {
        setEntry(currentEntry);

        if (currentEntry.isIntersecting) {
          setHasIntersected(true);
        }

        onChange?.(currentEntry);
      }
    },
    [onChange]
  );

  useEffect(() => {
    const element = elementRef.current;

    // Don't observe if disabled or SSR
    if (!enabled || !element) {
      return;
    }

    // Check for IntersectionObserver support
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: assume visible
      setHasIntersected(true);
      return;
    }

    // If already triggered once, don't create new observer
    if (triggerOnce && hasIntersected) {
      return;
    }

    const observer = new IntersectionObserver(handleIntersect, {
      root,
      rootMargin,
      threshold,
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [enabled, root, rootMargin, threshold, triggerOnce, hasIntersected, handleIntersect]);

  return {
    ref: elementRef,
    isIntersecting: entry?.isIntersecting ?? false,
    intersectionRatio: entry?.intersectionRatio ?? 0,
    hasIntersected,
    bounds: entry?.boundingClientRect ?? null,
    entry,
  };
}

// ========== UTILITY HOOKS ==========

/**
 * Hook to check if an element is visible in the viewport
 * 
 * @example
 * ```tsx
 * function VisibilityTracker({ children }) {
 *   const { ref, isVisible } = useIsVisible({ threshold: 0.5 });
 *   
 *   return (
 *     <div ref={ref} className={isVisible ? 'visible' : 'hidden'}>
 *       {children}
 *     </div>
 *   );
 * }
 * ```
 */
export function useIsVisible(
  options: Omit<IntersectionObserverOptions, 'onChange'> = {}
): Pick<IntersectionObserverResult, 'ref' | 'isIntersecting' | 'hasIntersected'> & { isVisible: boolean } {
  const { ref, isIntersecting, hasIntersected } = useIntersectionObserver(options);

  return {
    ref,
    isIntersecting,
    hasIntersected,
    isVisible: isIntersecting,
  };
}

/**
 * Hook to track scroll position relative to an element
 * 
 * @example
 * ```tsx
 * function ScrollProgress() {
 *   const { ref, progress } = useScrollProgress();
 *   
 *   return (
 *     <div ref={ref}>
 *       <div style={{ width: `${progress * 100}%` }} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollProgress(
  _options?: Omit<IntersectionObserverOptions, 'threshold' | 'onChange'>
): { ref: RefObject<HTMLDivElement | null>; progress: number } {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    const handleScroll = () => {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Calculate progress (0 = just entering, 1 = fully scrolled past)
      const scrolled = windowHeight - rect.top;
      const total = windowHeight + rect.height;

      setProgress(Math.max(0, Math.min(1, scrolled / total)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return { ref: elementRef, progress };
}

/**
 * Hook for lazy loading with intersection observer
 * 
 * @example
 * ```tsx
 * function LazyComponent() {
 *   const { ref, shouldLoad, markLoaded } = useLazyLoad({
 *     rootMargin: '200px', // Start loading 200px before visible
 *   });
 *   
 *   return (
 *     <div ref={ref}>
 *       {shouldLoad ? (
 *         <Suspense fallback={<Skeleton />}>
 *           <HeavyComponent onLoad={markLoaded} />
 *         </Suspense>
 *       ) : (
 *         <Skeleton />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLazyLoad(
  options: Omit<IntersectionObserverOptions, 'triggerOnce' | 'onChange'> = {}
): {
  ref: RefObject<HTMLDivElement | null>;
  shouldLoad: boolean;
  isLoaded: boolean;
  markLoaded: () => void;
} {
  const { ref, hasIntersected } = useIntersectionObserver({
    ...options,
    triggerOnce: true,
  });

  const [isLoaded, setIsLoaded] = useState(false);

  const markLoaded = useCallback(() => {
    setIsLoaded(true);
  }, []);

  // Cleanup when unmounted
  useEffect(() => {
    return () => {
      setIsLoaded(false);
    };
  }, []);

  return {
    ref,
    shouldLoad: hasIntersected || isLoaded,
    isLoaded,
    markLoaded,
  };
}

export default useIntersectionObserver;
