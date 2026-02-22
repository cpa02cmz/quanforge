/**
 * Lazy AI Service Loader
 * 
 * A performance optimization module that provides lazy loading for the AI service.
 * The AI service chunk (ai-web-runtime) is ~252KB, so lazy loading it significantly
 * reduces the initial bundle size and improves Time to Interactive (TTI).
 * 
 * Features:
 * - Lazy loading of AI service on demand
 * - Preloading capability for anticipated usage
 * - Request queuing while service is loading
 * - Error handling and retry logic
 * - Performance metrics tracking
 * 
 * @module services/ai/lazyAILoader
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('lazy-ai-loader');

// ========== TYPES ==========

export interface AILoaderState {
  /** Whether the AI service is loaded */
  isLoaded: boolean;
  /** Whether the AI service is currently loading */
  isLoading: boolean;
  /** Error if loading failed */
  error: Error | null;
  /** Time taken to load the service */
  loadTime: number | null;
  /** Number of requests queued while loading */
  queuedRequests: number;
}

export interface AILoaderResult {
  /** Get the loaded AI service or null if not loaded */
  getService: () => unknown | null;
  /** Load the AI service (returns promise that resolves when loaded) */
  loadService: () => Promise<unknown>;
  /** Preload the AI service in the background */
  preloadService: () => void;
  /** Execute a function with the AI service (loads if needed) */
  withService: <T>(fn: (service: unknown) => T | Promise<T>) => Promise<T>;
  /** Current loader state */
  getState: () => AILoaderState;
}

// ========== CONSTANTS ==========

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const PRELOAD_DELAY = 2000; // Delay before preloading after page load

// ========== LAZY LOADER CLASS ==========

class LazyAILoader {
  private state: AILoaderState = {
    isLoaded: false,
    isLoading: false,
    error: null,
    loadTime: null,
    queuedRequests: 0,
  };
  
  private service: unknown = null;
  private loadPromise: Promise<unknown> | null = null;
  private requestQueue: Array<{
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    fn: (service: unknown) => unknown;
  }> = [];
  
  private stateListeners: Set<(state: AILoaderState) => void> = new Set();

  /**
   * Get current state
   */
  getState(): AILoaderState {
    return { ...this.state };
  }

  /**
   * Update state and notify listeners
   */
  private updateState(partial: Partial<AILoaderState>): void {
    this.state = { ...this.state, ...partial };
    this.stateListeners.forEach((listener) => listener(this.state));
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: AILoaderState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Get the loaded service or null
   */
  getService(): unknown | null {
    return this.service;
  }

  /**
   * Load the AI service
   */
  async loadService(): Promise<unknown> {
    // Return cached service if already loaded
    if (this.state.isLoaded && this.service) {
      return this.service;
    }

    // Return existing load promise if already loading
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    this.updateState({ isLoading: true, error: null });
    const startTime = performance.now();

    this.loadPromise = this.loadWithRetry();
    
    try {
      this.service = await this.loadPromise;
      const loadTime = performance.now() - startTime;
      
      this.updateState({
        isLoaded: true,
        isLoading: false,
        loadTime,
      });
      
      logger.log(`AI service loaded in ${loadTime.toFixed(2)}ms`);
      
      // Process queued requests
      this.processQueue();
      
      return this.service;
    } catch (error) {
      this.updateState({
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      
      this.loadPromise = null;
      throw error;
    }
  }

  /**
   * Load with retry logic
   */
  private async loadWithRetry(retryCount = 0): Promise<unknown> {
    try {
      // Dynamic import of the AI service
      // This will create a separate chunk for the AI service
      const module = await import('./AICore');
      return module;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        logger.warn(`AI service load failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return this.loadWithRetry(retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Preload the AI service in the background
   */
  preloadService(): void {
    if (this.state.isLoaded || this.state.isLoading) {
      return;
    }

    // Use requestIdleCallback for non-critical preloading
    const schedulePreload = () => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(
          () => {
            this.loadService().catch((error) => {
              logger.error('Failed to preload AI service:', error);
            });
          },
          { timeout: 10000 }
        );
      } else {
        setTimeout(() => {
          this.loadService().catch((error) => {
            logger.error('Failed to preload AI service:', error);
          });
        }, 100);
      }
    };

    schedulePreload();
  }

  /**
   * Execute a function with the AI service
   */
  async withService<T>(fn: (service: unknown) => T | Promise<T>): Promise<T> {
    // If service is already loaded, execute immediately
    if (this.state.isLoaded && this.service) {
      return fn(this.service);
    }

    // If loading, queue the request
    if (this.state.isLoading) {
      return new Promise<T>((resolve, reject) => {
        this.requestQueue.push({
          resolve: resolve as (value: unknown) => void,
          reject,
          fn: fn as (service: unknown) => unknown,
        });
        this.updateState({ queuedRequests: this.state.queuedRequests + 1 });
      });
    }

    // Load and then execute
    await this.loadService();
    return fn(this.service);
  }

  /**
   * Process queued requests after service loads
   */
  private processQueue(): void {
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) break;

      try {
        const result = request.fn(this.service);
        if (result instanceof Promise) {
          result.then(request.resolve).catch(request.reject);
        } else {
          request.resolve(result);
        }
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.updateState({ queuedRequests: 0 });
  }
}

// ========== SINGLETON INSTANCE ==========

const lazyAILoader = new LazyAILoader();

// ========== AUTO-PRELOAD ==========

/**
 * Automatically preload the AI service after a delay
 * This improves perceived performance when the user eventually uses AI features
 */
if (typeof window !== 'undefined') {
  // Wait for page to be fully loaded before preloading
  if (document.readyState === 'complete') {
    setTimeout(() => lazyAILoader.preloadService(), PRELOAD_DELAY);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => lazyAILoader.preloadService(), PRELOAD_DELAY);
    });
  }
  
  // Also preload on user interaction (any interaction triggers preload)
  const interactionEvents = ['mousemove', 'touchstart', 'keydown', 'click'];
  const preloadOnInteraction = () => {
    lazyAILoader.preloadService();
    interactionEvents.forEach((event) => {
      document.removeEventListener(event, preloadOnInteraction);
    });
  };
  
  interactionEvents.forEach((event) => {
    document.addEventListener(event, preloadOnInteraction, { once: true, passive: true });
  });
}

// ========== EXPORTS ==========

export const lazyAI = {
  getService: () => lazyAILoader.getService(),
  loadService: () => lazyAILoader.loadService(),
  preloadService: () => lazyAILoader.preloadService(),
  withService: <T>(fn: (service: unknown) => T | Promise<T>) => lazyAILoader.withService(fn),
  getState: () => lazyAILoader.getState(),
  subscribe: (listener: (state: AILoaderState) => void) => lazyAILoader.subscribe(listener),
};

export default lazyAI;
