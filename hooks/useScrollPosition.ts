/**
 * useScrollPosition Hook
 * 
 * A hook for tracking scroll position with SSR support.
 * Useful for scroll-based animations, progress indicators, and lazy loading.
 * 
 * Features:
 * - SSR-safe with hydration support
 * - Throttled updates for performance
 * - TypeScript support
 * - Cleanup on unmount
 * - Direction detection
 * 
 * @module hooks/useScrollPosition
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ========== TYPES ==========

export interface ScrollPosition {
  /** Current scroll X position */
  x: number;
  /** Current scroll Y position */
  y: number;
}

export interface ScrollDirection {
  /** Is scrolling up */
  isScrollingUp: boolean;
  /** Is scrolling down */
  isScrollingDown: boolean;
  /** Is scrolling left */
  isScrollingLeft: boolean;
  /** Is scrolling right */
  isScrollingRight: boolean;
}

export interface ScrollPositionOptions {
  /** Throttle time in milliseconds (default: 16) */
  throttleMs?: number;
  /** Enable direction tracking (default: true) */
  trackDirection?: boolean;
  /** Enable scroll speed tracking (default: false) */
  trackSpeed?: boolean;
  /** Element to track scroll on (default: window) */
  element?: React.RefObject<HTMLElement | null>;
}

export interface ScrollPositionResult extends ScrollPosition, ScrollDirection {
  /** Scroll progress (0-1) based on document height */
  progress: number;
  /** Maximum scrollable Y position */
  maxScrollY: number;
  /** Current scroll speed in pixels per second */
  speed: number;
  /** Whether the user is currently scrolling */
  isScrolling: boolean;
  /** Whether the scroll is at the top */
  isAtTop: boolean;
  /** Whether the scroll is at the bottom */
  isAtBottom: boolean;
}

// ========== MAIN HOOK ==========

/**
 * Hook to track scroll position
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const { y, progress, isScrollingDown } = useScrollPosition();
 *   
 *   return (
 *     <div className={isScrollingDown ? 'hide-nav' : 'show-nav'}>
 *       Progress: {(progress * 100).toFixed(0)}%
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollPosition(options: ScrollPositionOptions = {}): ScrollPositionResult {
  const {
    throttleMs = 16,
    trackDirection = true,
    trackSpeed = false,
    element,
  } = options;

  const [position, setPosition] = useState<ScrollPosition>({ x: 0, y: 0 });
  const [direction, setDirection] = useState<ScrollDirection>({
    isScrollingUp: false,
    isScrollingDown: false,
    isScrollingLeft: false,
    isScrollingRight: false,
  });
  const [speed, setSpeed] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  const lastPositionRef = useRef<ScrollPosition>({ x: 0, y: 0 });
  const lastTimeRef = useRef(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const updatePosition = useCallback(() => {
    const newX = element?.current?.scrollLeft ?? window.scrollX;
    const newY = element?.current?.scrollTop ?? window.scrollY;

    // Calculate speed
    if (trackSpeed) {
      const now = Date.now();
      const timeDiff = now - lastTimeRef.current;
      const distance = Math.abs(newY - lastPositionRef.current.y);
      const newSpeed = timeDiff > 0 ? (distance / timeDiff) * 1000 : 0;
      setSpeed(newSpeed);
      lastTimeRef.current = now;
    }

    // Calculate direction
    if (trackDirection) {
      setDirection({
        isScrollingUp: newY < lastPositionRef.current.y,
        isScrollingDown: newY > lastPositionRef.current.y,
        isScrollingLeft: newX < lastPositionRef.current.x,
        isScrollingRight: newX > lastPositionRef.current.x,
      });
    }

    lastPositionRef.current = { x: newX, y: newY };
    setPosition({ x: newX, y: newY });

    // Set scrolling state
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
      setSpeed(0);
    }, 150);
  }, [element, trackDirection, trackSpeed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const target = element?.current ?? window;
    let lastCall = 0;

    const handleScroll = () => {
      const now = Date.now();
      
      if (now - lastCall >= throttleMs) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          updatePosition();
          lastCall = now;
        });
      }
    };

    // Initial position
    updatePosition();

    target.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      target.removeEventListener('scroll', handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [element, throttleMs, updatePosition]);

  // Calculate derived values
  const maxScrollY = useMemo(() => {
    if (typeof document === 'undefined') return 0;
    return document.documentElement.scrollHeight - window.innerHeight;
  }, []);

  const progress = useMemo(() => {
    if (maxScrollY === 0) return 0;
    return Math.min(1, Math.max(0, position.y / maxScrollY));
  }, [position.y, maxScrollY]);

  const isAtTop = position.y <= 0;
  const isAtBottom = position.y >= maxScrollY - 1;

  return {
    ...position,
    ...direction,
    progress,
    maxScrollY,
    speed,
    isScrolling,
    isAtTop,
    isAtBottom,
  };
}

// ========== UTILITY HOOKS ==========

/**
 * Hook to get just the vertical scroll position
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const scrollY = useScrollY();
 *   
 *   return <div>Scrolled: {scrollY}px</div>;
 * }
 * ```
 */
export function useScrollY(options: Omit<ScrollPositionOptions, 'trackDirection' | 'trackSpeed'> = {}): number {
  const { y } = useScrollPosition({ ...options, trackDirection: false, trackSpeed: false });
  return y;
}

/**
 * Hook to get scroll progress (0-1)
 * 
 * @example
 * ```tsx
 * function ReadingProgress() {
 *   const progress = useScrollProgress();
 *   
 *   return (
 *     <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
 *   );
 * }
 * ```
 */
export function useScrollProgress(options: Omit<ScrollPositionOptions, 'trackDirection' | 'trackSpeed'> = {}): number {
  const { progress } = useScrollPosition({ ...options, trackDirection: false, trackSpeed: false });
  return progress;
}

/**
 * Hook to detect scroll direction
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const { isScrollingDown, isScrollingUp } = useScrollDirection();
 *   
 *   return (
 *     <nav className={isScrollingDown ? 'hide' : 'show'}>
 *       Navigation
 *     </nav>
 *   );
 * }
 * ```
 */
export function useScrollDirection(): ScrollDirection {
  const { isScrollingUp, isScrollingDown, isScrollingLeft, isScrollingRight } = useScrollPosition({
    trackDirection: true,
    trackSpeed: false,
  });

  return { isScrollingUp, isScrollingDown, isScrollingLeft, isScrollingRight };
}

/**
 * Hook to check if scrolled past a threshold
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const hasScrolled = useHasScrolled(100);
 *   
 *   return <header className={hasScrolled ? 'scrolled' : ''} />;
 * }
 * ```
 */
export function useHasScrolled(threshold: number = 0): boolean {
  const { y } = useScrollPosition({ trackDirection: false, trackSpeed: false });
  return y > threshold;
}

/**
 * Hook to check if element is in view (viewport)
 * 
 * @example
 * ```tsx
 * function LazySection() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const isInView = useElementInView(ref, { threshold: 0.5 });
 *   
 *   return (
 *     <div ref={ref}>
 *       {isInView ? <HeavyContent /> : <Skeleton />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useElementInView(
  elementRef: React.RefObject<HTMLElement | null>,
  options: { threshold?: number; rootMargin?: string } = {}
): boolean {
  const [isInView, setIsInView] = useState(false);
  const { threshold = 0, rootMargin = '0px' } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsInView(entry.isIntersecting);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [elementRef, threshold, rootMargin]);

  return isInView;
}

/**
 * Hook to scroll to top of page
 * 
 * @example
 * ```tsx
 * function ScrollToTopButton() {
 *   const { scrollToTop, canScrollToTop } = useScrollToTop();
 *   
 *   return canScrollToTop ? (
 *     <button onClick={scrollToTop}>Back to Top</button>
 *   ) : null;
 * }
 * ```
 */
export function useScrollToTop(): {
  scrollToTop: (behavior?: ScrollBehavior) => void;
  canScrollToTop: boolean;
} {
  const { y } = useScrollPosition({ trackDirection: false, trackSpeed: false });

  const scrollToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    window.scrollTo({ top: 0, behavior });
  }, []);

  return {
    scrollToTop,
    canScrollToTop: y > 100,
  };
}

/**
 * Hook to lock body scroll (useful for modals)
 * 
 * @example
 * ```tsx
 * function Modal({ isOpen }) {
 *   useLockBodyScroll(isOpen);
 *   
 *   return isOpen ? <dialog>...</dialog> : null;
 * }
 * ```
 */
export function useLockBodyScroll(locked: boolean = true): void {
  useEffect(() => {
    if (!locked) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [locked]);
}

export default useScrollPosition;
