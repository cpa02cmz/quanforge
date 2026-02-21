/**
 * Lazy Loading Utilities
 * 
 * Provides enhanced lazy loading capabilities for services, components, and modules.
 * Optimizes bundle splitting and reduces initial load time.
 * 
 * Features:
 * - Lazy service loading with initialization tracking
 * - Prefetching on idle/hover/focus
 * - Loading state management
 * - Error boundaries for lazy imports
 * - Retry logic for failed imports
 * - Priority-based loading
 * 
 * @module utils/lazyLoader
 */

import { createScopedLogger } from './logger';

const logger = createScopedLogger('lazy-loader');

// ========== TYPES ==========

export interface LazyLoadOptions {
  /** Retry attempts on failure */
  retries?: number;
  /** Delay between retries (ms) */
  retryDelay?: number;
  /** Timeout for loading (ms) */
  timeout?: number;
  /** Whether to prefetch on idle */
  prefetchOnIdle?: boolean;
  /** Whether to preload immediately */
  preload?: boolean;
  /** Priority for loading */
  priority?: 'high' | 'low' | 'auto';
  /** Custom error handler */
  onError?: (error: Error) => void;
  /** Callback when loading starts */
  onLoadStart?: () => void;
  /** Callback when loading completes */
  onLoadEnd?: () => void;
}

export interface LazyModule<T> {
  /** The loaded module */
  module: T;
  /** Whether the module is loaded */
  isLoaded: boolean;
  /** Whether the module is loading */
  isLoading: boolean;
  /** Any error that occurred */
  error: Error | null;
  /** Time taken to load (ms) */
  loadTime: number | null;
}

export interface PrefetchQueueItem {
  /** Unique identifier */
  id: string;
  /** Import function */
  importFn: () => Promise<unknown>;
  /** Priority (higher = more important) */
  priority: number;
  /** Whether it's been prefetched */
  prefetched: boolean;
}

export interface LazyLoaderStats {
  /** Modules currently loaded */
  loaded: string[];
  /** Modules currently loading */
  loading: string[];
  /** Failed loads */
  failed: string[];
  /** Prefetched modules */
  prefetched: string[];
  /** Total load time */
  totalLoadTime: number;
  /** Average load time */
  avgLoadTime: number;
}

// ========== CONSTANTS ==========

const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_TIMEOUT = 30000;

const loadedModules = new Map<string, LazyModule<unknown>>();
const loadingPromises = new Map<string, Promise<unknown>>();
const prefetchQueue: PrefetchQueueItem[] = [];

// ========== HELPER FUNCTIONS ==========

/**
 * Create a timeout promise
 */
function createTimeoutPromise<T>(ms: number): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Load timed out after ${ms}ms`)), ms);
  });
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
        logger.debug(`Retry attempt ${attempt + 1}/${retries}`);
      }
    }
  }
  
  throw lastError;
}

/**
 * Check if requestIdleCallback is available
 */
function requestIdleCallback(fn: () => void): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(fn);
  } else {
    setTimeout(fn, 1);
  }
}

// ========== MAIN LAZY LOADER CLASS ==========

class LazyLoader {
  private stats: LazyLoaderStats = {
    loaded: [],
    loading: [],
    failed: [],
    prefetched: [],
    totalLoadTime: 0,
    avgLoadTime: 0,
  };

  /**
   * Lazy load a module with enhanced features
   * 
   * @param id - Unique identifier for the module
   * @param importFn - Dynamic import function
   * @param options - Load options
   * 
   * @example
   * // Basic lazy loading
   * const geminiService = await lazyLoader.load('gemini', () => import('./services/gemini'));
   * 
   * @example
   * // With retry and timeout
   * const module = await lazyLoader.load('heavy-module', () => import('./heavy'), {
   *   retries: 3,
   *   timeout: 10000,
   *   prefetchOnIdle: true
   * });
   */
  async load<T>(
    id: string,
    importFn: () => Promise<T>,
    options: LazyLoadOptions = {}
  ): Promise<T> {
    const {
      retries = DEFAULT_RETRIES,
      retryDelay = DEFAULT_RETRY_DELAY,
      timeout = DEFAULT_TIMEOUT,
      onError,
      onLoadStart,
      onLoadEnd,
    } = options;

    // Check if already loaded
    const cached = loadedModules.get(id);
    if (cached?.isLoaded) {
      return cached.module as T;
    }

    // Check if currently loading
    const loadingPromise = loadingPromises.get(id);
    if (loadingPromise) {
      return loadingPromise as Promise<T>;
    }

    // Start loading
    onLoadStart?.();
    const startTime = Date.now();
    
    if (!this.stats.loading.includes(id)) {
      this.stats.loading.push(id);
    }

    const loadPromise = (async (): Promise<T> => {
      try {
        const module = await withRetry(
          async () => {
            const result = await Promise.race([
              importFn(),
              createTimeoutPromise<T>(timeout),
            ]);
            return result;
          },
          retries,
          retryDelay
        );

        const loadTime = Date.now() - startTime;
        
        // Cache the loaded module
        loadedModules.set(id, {
          module,
          isLoaded: true,
          isLoading: false,
          error: null,
          loadTime,
        });

        // Update stats
        this.stats.loaded.push(id);
        this.stats.loading = this.stats.loading.filter((m) => m !== id);
        this.stats.totalLoadTime += loadTime;
        this.stats.avgLoadTime = this.stats.totalLoadTime / this.stats.loaded.length;

        logger.debug(`Loaded module: ${id} in ${loadTime}ms`);
        onLoadEnd?.();

        return module;
      } catch (error) {
        // Handle error
        const err = error as Error;
        loadedModules.set(id, {
          module: null,
          isLoaded: false,
          isLoading: false,
          error: err,
          loadTime: null,
        });

        this.stats.failed.push(id);
        this.stats.loading = this.stats.loading.filter((m) => m !== id);
        
        onError?.(err);
        logger.error(`Failed to load module: ${id}`, err);

        throw err;
      }
    })();

    loadingPromises.set(id, loadPromise);

    try {
      return await loadPromise;
    } finally {
      loadingPromises.delete(id);
    }
  }

  /**
   * Prefetch a module for later use
   * Does not return the module, just loads it into cache
   * 
   * @param id - Unique identifier
   * @param importFn - Dynamic import function
   * @param priority - Priority (higher = load sooner)
   * 
   * @example
   * // Prefetch on hover
   * <button onMouseEnter={() => lazyLoader.prefetch('chart', () => import('./chart'))}>
   *   Load Chart
   * </button>
   */
  prefetch(id: string, importFn: () => Promise<unknown>, priority = 0): void {
    // Skip if already loaded or prefetched
    if (loadedModules.has(id) || this.stats.prefetched.includes(id)) {
      return;
    }

    // Add to prefetch queue
    prefetchQueue.push({
      id,
      importFn,
      priority,
      prefetched: false,
    });

    // Sort by priority
    prefetchQueue.sort((a, b) => b.priority - a.priority);

    // Process queue on idle
    requestIdleCallback(() => this.processPrefetchQueue());
  }

  /**
   * Process the prefetch queue
   */
  private async processPrefetchQueue(): Promise<void> {
    const next = prefetchQueue.find((item) => !item.prefetched);
    if (!next) return;

    next.prefetched = true;

    try {
      await this.load(next.id, next.importFn as () => Promise<unknown>, {
        retries: 1,
        timeout: 10000,
      });
      this.stats.prefetched.push(next.id);
      logger.debug(`Prefetched: ${next.id}`);
    } catch {
      // Prefetch failure is not critical
    }

    // Continue processing
    requestIdleCallback(() => this.processPrefetchQueue());
  }

  /**
   * Preload multiple modules
   * Loads in parallel with priority ordering
   */
  async preloadAll(
    modules: Array<{ id: string; importFn: () => Promise<unknown>; priority?: number }>
  ): Promise<void> {
    // Sort by priority
    const sorted = [...modules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Load in parallel
    await Promise.all(
      sorted.map(({ id, importFn }) =>
        this.load(id, importFn).catch(() => {
          // Log but don't fail entire preload
          logger.warn(`Preload failed for: ${id}`);
        })
      )
    );
  }

  /**
   * Check if a module is loaded
   */
  isLoaded(id: string): boolean {
    return loadedModules.get(id)?.isLoaded ?? false;
  }

  /**
   * Check if a module is loading
   */
  isLoading(id: string): boolean {
    return loadedModules.get(id)?.isLoading ?? loadingPromises.has(id);
  }

  /**
   * Get a loaded module
   */
  get<T>(id: string): T | null {
    const cached = loadedModules.get(id);
    if (cached?.isLoaded) {
      return cached.module as T;
    }
    return null;
  }

  /**
   * Get load time for a module
   */
  getLoadTime(id: string): number | null {
    return loadedModules.get(id)?.loadTime ?? null;
  }

  /**
   * Get current stats
   */
  getStats(): LazyLoaderStats {
    return { ...this.stats };
  }

  /**
   * Clear a module from cache
   */
  clear(id: string): boolean {
    return loadedModules.delete(id);
  }

  /**
   * Clear all cached modules
   */
  clearAll(): void {
    loadedModules.clear();
    loadingPromises.clear();
    prefetchQueue.length = 0;
    this.stats = {
      loaded: [],
      loading: [],
      failed: [],
      prefetched: [],
      totalLoadTime: 0,
      avgLoadTime: 0,
    };
    logger.info('Lazy loader cache cleared');
  }
}

// ========== SINGLETON EXPORT ==========

export const lazyLoader = new LazyLoader();

// ========== REACT HOOKS ==========

/**
 * Hook to lazy load a module
 * 
 * @param id - Module identifier
 * @param importFn - Import function
 * @param options - Load options
 * 
 * @example
 * const { module, isLoading, error } = useLazyModule('chart', () => import('./chart'));
 */
export function useLazyModule<T>(
  id: string,
  importFn: () => Promise<T>,
  options: LazyLoadOptions = {}
): {
  module: T | null;
  isLoading: boolean;
  error: Error | null;
  load: () => Promise<void>;
  loadTime: number | null;
} {
  // This is a simplified version - in a real React app, you'd use useState/useEffect
  // For now, we'll return a synchronous interface that works with the lazyLoader
  
  const cached = loadedModules.get(id);
  
  return {
    module: cached?.isLoaded ? (cached.module as T) : null,
    isLoading: cached?.isLoading ?? false,
    error: cached?.error ?? null,
    load: async () => {
      await lazyLoader.load(id, importFn, options);
    },
    loadTime: cached?.loadTime ?? null,
  };
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Create a lazy service factory
 * Useful for services that should only be instantiated when first accessed
 */
export function createLazyService<T>(
  id: string,
  factory: () => Promise<T>,
  options: LazyLoadOptions = {}
): {
  get: () => Promise<T>;
  isLoaded: () => boolean;
  preload: () => Promise<void>;
} {
  let instance: T | null = null;

  return {
    get: async () => {
      if (instance) return instance;
      instance = await lazyLoader.load(id, factory, options);
      return instance;
    },
    isLoaded: () => instance !== null,
    preload: async () => {
      if (!instance) {
        instance = await lazyLoader.load(id, factory, { ...options, preload: true });
      }
    },
  };
}

/**
 * Prefetch on user interaction
 * Attaches event listeners to trigger prefetching
 */
export function prefetchOnInteraction(
  element: HTMLElement,
  id: string,
  importFn: () => Promise<unknown>,
  events: ('hover' | 'focus' | 'click')[] = ['hover', 'focus']
): () => void {
  const handlers: Array<{ event: string; handler: () => void }> = [];

  const prefetch = () => {
    lazyLoader.prefetch(id, importFn);
  };

  if (events.includes('hover')) {
    const handler = () => prefetch();
    element.addEventListener('mouseenter', handler);
    handlers.push({ event: 'mouseenter', handler });
  }

  if (events.includes('focus')) {
    const handler = () => prefetch();
    element.addEventListener('focus', handler);
    handlers.push({ event: 'focus', handler });
  }

  if (events.includes('click')) {
    const handler = () => prefetch();
    element.addEventListener('click', handler);
    handlers.push({ event: 'click', handler });
  }

  // Return cleanup function
  return () => {
    handlers.forEach(({ event, handler }) => {
      element.removeEventListener(event, handler);
    });
  };
}

export default lazyLoader;
