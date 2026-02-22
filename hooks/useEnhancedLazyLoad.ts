/**
 * useEnhancedLazyLoad - An enhanced hook for lazy loading content with intersection observer
 * 
 * This hook provides more advanced lazy loading features compared to the basic useEnhancedLazyLoad:
 * - Load delay support for performance optimization
 * - onLoad and onIntersect callbacks
 * - Manual load trigger
 * - Lazy image loading helper hook
 * - Lazy component loading helper hook
 * 
 * @example
 * const { ref, isIntersecting, isVisible, load } = useEnhancedLazyLoad({
 *   rootMargin: '100px',
 *   threshold: 0.1,
 *   onLoad: () => fetchData()
 * });
 */

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

export interface UseEnhancedLazyLoadOptions {
  /** Margin around the root element for early loading */
  rootMargin?: string;
  /** Threshold(s) at which to trigger callback (0-1) */
  threshold?: number | number[];
  /** Whether to disconnect observer after first intersection */
  triggerOnce?: boolean;
  /** Callback when element becomes visible */
  onIntersect?: (entry: IntersectionObserverEntry) => void;
  /** Callback when loading should start */
  onLoad?: () => void;
  /** Delay in ms before triggering load after intersection */
  loadDelay?: number;
  /** Whether the hook is enabled */
  enabled?: boolean;
}

export interface UseLazyLoadReturn<T extends Element> {
  /** Ref to attach to the target element */
  ref: RefObject<T>;
  /** Whether the element is currently intersecting the viewport */
  isIntersecting: boolean;
  /** Whether the element has been visible at least once */
  isVisible: boolean;
  /** Ratio of element visible (0-1) */
  intersectionRatio: number;
  /** Whether content has been loaded */
  isLoaded: boolean;
  /** Manually trigger loading */
  load: () => void;
  /** Reset loaded state */
  reset: () => void;
  /** The latest intersection entry */
  entry: IntersectionObserverEntry | null;
}

/**
 * Hook for lazy loading content when element enters viewport
 * 
 * @param options - Configuration options
 * @returns Object with ref, visibility state, and control methods
 */
export function useEnhancedLazyLoad<T extends Element = HTMLDivElement>(
  options: UseEnhancedLazyLoadOptions = {}
): UseLazyLoadReturn<T> {
  const {
    rootMargin = '50px',
    threshold = 0.1,
    triggerOnce = true,
    onIntersect,
    onLoad,
    loadDelay = 0,
    enabled = true
  } = options;

  const ref = useRef<T>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [intersectionRatio, setIntersectionRatio] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTriggeredRef = useRef(false);

  // Manual load function
  const load = useCallback(() => {
    if (!isLoaded) {
      setIsLoaded(true);
      onLoad?.();
    }
  }, [isLoaded, onLoad]);

  // Reset function
  const reset = useCallback(() => {
    setIsLoaded(false);
    hasTriggeredRef.current = false;
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  // Handle intersection
  useEffect(() => {
    const element = ref.current;
    
    if (!element || !enabled) {
      return;
    }

    // Skip if already triggered once
    if (triggerOnce && hasTriggeredRef.current) {
      return;
    }

    const handleIntersection: IntersectionObserverCallback = (entries) => {
      const [observerEntry] = entries;
      
      if (!observerEntry) return;

      setEntry(observerEntry);
      setIsIntersecting(observerEntry.isIntersecting);
      setIntersectionRatio(observerEntry.intersectionRatio);

      if (observerEntry.isIntersecting) {
        setIsVisible(true);
        hasTriggeredRef.current = true;

        // Call onIntersect callback
        onIntersect?.(observerEntry);

        // Trigger load with optional delay
        if (loadDelay > 0) {
          loadTimeoutRef.current = setTimeout(() => {
            load();
          }, loadDelay);
        } else {
          load();
        }
      }
    };

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [enabled, rootMargin, threshold, triggerOnce, load, loadDelay, onIntersect]);

  return {
    ref: ref as RefObject<T>,
    isIntersecting,
    isVisible,
    intersectionRatio,
    isLoaded,
    load,
    reset,
    entry
  };
}

/**
 * Hook for lazy loading images with placeholder support
 * 
 * @example
 * const { ref, isLoaded, src } = useLazyImageEnhanced(imageSrc, placeholderSrc);
 */
export function useLazyImageEnhanced<T extends HTMLImageElement = HTMLImageElement>(
  imageSrc: string,
  placeholderSrc?: string,
  options: Omit<UseEnhancedLazyLoadOptions, 'onLoad'> = {}
): UseLazyLoadReturn<T> & { src: string } {
  const [loadedSrc, setLoadedSrc] = useState(placeholderSrc || '');
  
  const lazyLoad = useEnhancedLazyLoad<T>({
    ...options,
    onLoad: () => {
      setLoadedSrc(imageSrc);
    }
  });

  return {
    ...lazyLoad,
    src: lazyLoad.isLoaded ? imageSrc : loadedSrc
  };
}

/**
 * Hook for lazy loading components with suspense-like behavior
 * 
 * @example
 * const { ref, shouldRender, placeholder } = useLazyComponentEnhanced({ 
 *   rootMargin: '200px',
 *   placeholder: <LoadingSkeleton />
 * });
 */
export function useLazyComponentEnhanced<T extends Element = HTMLDivElement>(
  options: UseEnhancedLazyLoadOptions & { placeholder?: React.ReactNode } = {}
): UseLazyLoadReturn<T> & { shouldRender: boolean } {
  const { placeholder: _placeholder, ...lazyOptions } = options;
  
  const lazyLoad = useEnhancedLazyLoad<T>({
    ...lazyOptions,
    triggerOnce: true
  });

  return {
    ...lazyLoad,
    shouldRender: lazyLoad.isLoaded || lazyLoad.isIntersecting
  };
}

export default useEnhancedLazyLoad;
