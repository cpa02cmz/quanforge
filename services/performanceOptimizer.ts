/**
 * Performance Optimizer Service
 * Provides various performance optimization utilities for the application
 */

interface PerformanceMetrics {
  [key: string]: number;
}

class PerformanceOptimizer {
  private metrics: PerformanceMetrics = {};
  private readonly maxMetrics: number = 100;
  private readonly observerMap = new Map<string, MutationObserver | IntersectionObserver>();
  private readonly resizeObserver: ResizeObserver | null = null;

  constructor() {
    // Initialize ResizeObserver if available
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // Handle resize events for performance optimization
          this.optimizeElementPerformance(entry.target as HTMLElement);
        }
      });
    }
  }

  /**
   * Measures performance of a function and records metrics
   */
  async measurePerformance<T>(
    name: string, 
    fn: () => Promise<T> | T, 
    shouldLog: boolean = true
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await Promise.resolve(fn());
      const end = performance.now();
      const duration = end - start;
      
      // Store metric
      this.metrics[name] = duration;
      
      // Keep metrics array size manageable
      if (Object.keys(this.metrics).length > this.maxMetrics) {
        // Remove oldest metrics
        const oldestKey = Object.keys(this.metrics).sort((a, b) => 
          this.metrics[a] - this.metrics[b]
        )[0];
        if (oldestKey) delete this.metrics[oldestKey];
      }
      
      if (shouldLog) {
        console.debug(`Performance: ${name} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const end = performance.now();
      const duration = end - start;
      console.error(`Performance: ${name} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * Debounces a function to limit execution frequency
   */
  debounce<T extends (...args: any[]) => any>(
    func: T, 
    wait: number, 
    immediate: boolean = false
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return function (this: any, ...args: Parameters<T>) {
      const callNow = immediate && !timeoutId;
      const later = () => {
        timeoutId = null;
        if (!immediate) func.apply(this, args);
      };

      clearTimeout(timeoutId as NodeJS.Timeout);
      timeoutId = setTimeout(later, wait);

      if (callNow) func.apply(this, args);
    };
  }

  /**
   * Throttles a function to execute at most once per interval
   */
  throttle<T extends (...args: any[]) => any>(
    func: T, 
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return function (this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Optimizes rendering by batching DOM updates
   */
  batchDOMUpdates(callback: () => void): void {
    if (typeof window !== 'undefined' && (window as any).requestIdleCallback) {
      (window as any).requestIdleCallback(() => {
        callback();
      });
    } else {
      // Fallback to requestAnimationFrame
      requestAnimationFrame(() => {
        callback();
      });
    }
  }

  /**
   * Optimizes element performance based on resize events
   */
  private optimizeElementPerformance(element: HTMLElement): void {
    // Example optimization: reduce complexity for small elements
    const rect = element.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) {
      element.style.willChange = 'transform';
    }
  }

  /**
   * Creates an optimized intersection observer
   */
  createIntersectionObserver(
    options: IntersectionObserverInit,
    callback: IntersectionObserverCallback
  ): IntersectionObserver {
    const observer = new IntersectionObserver(callback, {
      ...options,
      // Reduce frequency of callbacks
      threshold: options.threshold || [0, 0.25, 0.5, 0.75, 1.0]
    });
    
    return observer;
  }

  /**
   * Creates an optimized mutation observer
   */
  createMutationObserver(
    callback: MutationCallback,
    options: MutationObserverInit = {}
  ): MutationObserver {
    const observer = new MutationObserver(callback);
    
    // Default to optimized settings
    const defaultOptions: MutationObserverInit = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: false,
      characterData: false,
      ...options
    };
    
    return observer;
  }

  /**
   * Gets collected performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Clears all performance metrics
   */
  clearMetrics(): void {
    this.metrics = {};
  }

  /**
   * Gets average performance for a specific metric
   */
  getAverageMetric(name: string): number | null {
    // This would require storing multiple values for the same metric
    // For now, return the current value
    return this.metrics[name] || null;
  }

  /**
   * Preloads a resource for better performance
   */
  preloadResource(url: string, as?: 'script' | 'style' | 'image' | 'font'): void {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      if (as) {
        link.as = as;
      }
      document.head.appendChild(link);
    }
  }

  /**
   * Optimizes image loading
   */
  optimizeImageLoading(img: HTMLImageElement): void {
    if (img) {
      img.decoding = 'async';
      img.loading = 'lazy';
    }
  }

  /**
   * Cleans up resources
   */
  destroy(): void {
    // Disconnect all observers
    this.observerMap.forEach(observer => {
      if ('disconnect' in observer) {
        observer.disconnect();
      }
    });
    this.observerMap.clear();
    
    // Clear metrics
    this.metrics = {};
  }
}

// Create singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// Export the class for potential instantiation elsewhere
export { PerformanceOptimizer };