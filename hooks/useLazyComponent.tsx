/**
 * useLazyComponent Hook
 * Lazy loads components when they enter the viewport
 * 
 * Features:
 * - Intersection Observer-based lazy loading
 * - Configurable root margin for preloading
 * - Placeholder support during loading
 * - Automatic cleanup on unmount
 * - TypeScript-first with full type safety
 * 
 * @module hooks/useLazyComponent
 */

import React, { 
  useState, 
  useEffect, 
  useRef, 
  useCallback, 
  Suspense,
  lazy,
  ComponentType,
  LazyExoticComponent
} from 'react';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('useLazyComponent');

/**
 * Options for lazy component loading
 */
interface LazyComponentOptions {
  /** Root margin for intersection observer (default: '100px' for preload) */
  rootMargin?: string;
  /** Threshold for intersection (default: 0.1) */
  threshold?: number;
  /** Custom loading placeholder */
  fallback?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * State for lazy component
 */
interface LazyComponentState {
  isLoaded: boolean;
  isVisible: boolean;
  hasError: boolean;
  error: Error | null;
}

/**
 * Hook return type for lazy component
 */
interface UseLazyComponentResult {
  ref: React.RefObject<HTMLDivElement | null>;
  isLoaded: boolean;
  isVisible: boolean;
  hasError: boolean;
  error: Error | null;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<Omit<LazyComponentOptions, 'fallback' | 'errorComponent'>> = {
  rootMargin: '100px',
  threshold: 0.1,
  debug: false,
};

/**
 * Hook for lazy loading components when they enter the viewport
 * 
 * @example
 * ```tsx
 * const LazyChart = lazy(() => import('./Chart'));
 * 
 * function Dashboard() {
 *   const { ref, isLoaded } = useLazyComponent();
 *   
 *   return (
 *     <div ref={ref}>
 *       {isLoaded && (
 *         <Suspense fallback={<LoadingSpinner />}>
 *           <LazyChart />
 *         </Suspense>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLazyComponent(
  options: LazyComponentOptions = {}
): UseLazyComponentResult {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const ref = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  const [state, setState] = useState<LazyComponentState>({
    isLoaded: false,
    isVisible: false,
    hasError: false,
    error: null,
  });

  const debugLog = useCallback((message: string, ...args: unknown[]) => {
    if (mergedOptions.debug) {
      logger.debug(message, ...args);
    }
  }, [mergedOptions.debug]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    // Check if already in view
    const rect = element.getBoundingClientRect();
    const isAlreadyVisible = 
      rect.top < window.innerHeight && 
      rect.bottom > 0;

    if (isAlreadyVisible) {
      debugLog('Element already visible, loading immediately');
      setState(prev => ({ ...prev, isVisible: true, isLoaded: true }));
      return;
    }

    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            debugLog('Element entered viewport');
            setState(prev => ({ ...prev, isVisible: true, isLoaded: true }));
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: mergedOptions.rootMargin,
        threshold: mergedOptions.threshold,
      }
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [mergedOptions.rootMargin, mergedOptions.threshold, debugLog]);

  return {
    ref,
    ...state,
  };
}

/**
 * Props for LazyComponent wrapper
 */
interface LazyComponentWrapperProps {
  /** The lazy-loaded component */
  component: LazyExoticComponent<ComponentType<Record<string, unknown>>>;
  /** Props to pass to the component */
  componentProps?: Record<string, unknown>;
  /** Loading placeholder */
  fallback?: React.ReactNode;
  /** Root margin for preloading */
  rootMargin?: string;
  /** Whether to load immediately (skip lazy loading) */
  loadImmediately?: boolean;
  /** Additional className for wrapper */
  className?: string;
  /** Additional styles for wrapper */
  style?: React.CSSProperties;
}

/**
 * Wrapper component for lazy-loaded components
 * 
 * @example
 * ```tsx
 * const LazyChart = lazy(() => import('./Chart'));
 * 
 * <LazyComponentWrapper
 *   component={LazyChart}
 *   fallback={<Skeleton />}
 *   rootMargin="200px"
 * />
 * ```
 */
export const LazyComponentWrapper: React.FC<LazyComponentWrapperProps> = ({
  component: LazyComponent,
  componentProps = {},
  fallback = <div className="animate-pulse bg-gray-200 h-32 rounded" />,
  rootMargin = '100px',
  loadImmediately = false,
  className,
  style,
}) => {
  const { ref, isLoaded, isVisible } = useLazyComponent({ 
    rootMargin,
    debug: false,
  });

  const shouldRender = loadImmediately || isLoaded;

  return (
    <div ref={ref} className={className} style={style}>
      {shouldRender ? (
        <Suspense fallback={fallback}>
          <LazyComponent {...componentProps} />
        </Suspense>
      ) : (
        <div style={{ minHeight: 1 }}>
          {isVisible && (
            <Suspense fallback={fallback}>
              <LazyComponent {...componentProps} />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
};

LazyComponentWrapper.displayName = 'LazyComponentWrapper';

/**
 * Hook for preloading multiple components
 * Useful for preloading components likely to be needed
 * 
 * @example
 * ```tsx
 * const { preload } = usePreloadComponents();
 * 
 * // Preload components after initial page load
 * useEffect(() => {
 *   preload([
 *     () => import('./Chart'),
 *     () => import('./Dashboard'),
 *   ]);
 * }, []);
 * ```
 */
export function usePreloadComponents(): {
  preload: (loaders: Array<() => Promise<unknown>>) => void;
  preloadOnIdle: (loaders: Array<() => Promise<unknown>>) => void;
  isPreloading: boolean;
} {
  const [isPreloading, setIsPreloading] = useState(false);

  /**
   * Preload components immediately
   */
  const preload = useCallback((loaders: Array<() => Promise<unknown>>) => {
    setIsPreloading(true);
    
    Promise.all(loaders.map(loader => loader()))
      .catch((error) => {
        console.error('[usePreloadComponents] Preload error:', error);
      })
      .finally(() => {
        setIsPreloading(false);
      });
  }, []);

  /**
   * Preload components during idle time
   */
  const preloadOnIdle = useCallback((loaders: Array<() => Promise<unknown>>) => {
    if (typeof window === 'undefined' || !window.requestIdleCallback) {
      preload(loaders);
      return;
    }

    window.requestIdleCallback(() => {
      preload(loaders);
    }, { timeout: 2000 });
  }, [preload]);

  return {
    preload,
    preloadOnIdle,
    isPreloading,
  };
}

/**
 * Create a lazy-loaded component with built-in Intersection Observer
 * 
 * @example
 * ```tsx
 * // Create lazy component
 * const LazyChart = createLazyComponent(
 *   () => import('./Chart'),
 *   { rootMargin: '200px' }
 * );
 * 
 * // Use in component
 * <LazyChart data={chartData} />
 * ```
 */
export function createLazyComponent<P extends Record<string, unknown>>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  options: LazyComponentOptions = {}
): React.FC<P & { fallback?: React.ReactNode; className?: string; style?: React.CSSProperties }> {
  const LazyComponent = lazy(loader);

  const LazyWrapper: React.FC<P & { 
    fallback?: React.ReactNode; 
    className?: string; 
    style?: React.CSSProperties 
  }> = ({ fallback, className, style, ...props }) => {
    const { ref, isLoaded } = useLazyComponent(options);
    const defaultFallback = options.fallback || (
      <div className="animate-pulse bg-gray-200 h-32 rounded" />
    );

    return (
      <div ref={ref} className={className} style={style}>
        {isLoaded ? (
          <Suspense fallback={fallback || defaultFallback}>
            <LazyComponent {...(props as P)} />
          </Suspense>
        ) : (
          <div style={{ minHeight: 1 }}>
            {fallback || defaultFallback}
          </div>
        )}
      </div>
    );
  };

  LazyWrapper.displayName = 'LazyComponent';
  
  return LazyWrapper;
}

export default useLazyComponent;
