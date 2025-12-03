/**
 * Frontend Optimizer Service
 * Provides additional performance optimizations for the frontend
 */

interface FrontendOptimizationConfig {
  enableResourcePrefetching: boolean;
  enableLazyLoading: boolean;
  enableImageOptimization: boolean;
  enableFontOptimization: boolean;
  enableBundleOptimization: boolean;
  enableVirtualScrolling: boolean;
  enableProgressiveLoading: boolean;
}

interface OptimizationMetrics {
  bundleSize: number;
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  virtualScrollEfficiency: number;
}

class FrontendOptimizer {
  private config: FrontendOptimizationConfig = {
    enableResourcePrefetching: true,
    enableLazyLoading: true,
    enableImageOptimization: true,
    enableFontOptimization: true,
    enableBundleOptimization: true,
    enableVirtualScrolling: true,
    enableProgressiveLoading: true,
  };

  private metrics: OptimizationMetrics = {
    bundleSize: 0,
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    virtualScrollEfficiency: 0,
  };

  private resourceCache = new Map<string, { data: any; timestamp: number; size: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(config?: Partial<FrontendOptimizationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.initializeOptimizations();
  }

  private initializeOptimizations(): void {
    if (this.config.enableResourcePrefetching) {
      this.setupResourcePrefetching();
    }

    if (this.config.enableLazyLoading) {
      this.setupLazyLoading();
    }

    if (this.config.enableFontOptimization) {
      this.setupFontOptimization();
    }

    if (this.config.enableBundleOptimization) {
      this.setupBundleOptimization();
    }
  }

  /**
   * Setup resource prefetching for critical resources
   */
  private setupResourcePrefetching(): void {
    const criticalResources = [
      '/api/robots',
      '/api/strategies',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    ];

    criticalResources.forEach((resource) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = resource;
      document.head.appendChild(link);
    });
  }

  /**
   * Setup lazy loading for images and components
   */
  private setupLazyLoading(): void {
    // Set up Intersection Observer for lazy loading
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
           if (entry.isIntersecting) {
             const img = entry.target as HTMLImageElement;
             const src = img.dataset['src'];
             if (src) {
               img.src = src;
               img.removeAttribute('data-src');
               imageObserver.unobserve(img);
             }
           }
         });
       });

      // Observe all lazy images
      document.querySelectorAll('img[data-src]').forEach((img) => {
        imageObserver.observe(img);
      });
    }
  }

  /**
   * Setup font optimization with preloading
   */
  private setupFontOptimization(): void {
    const fontLinks = [
      {
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
        rel: 'preload',
        as: 'style',
      },
    ];

    fontLinks.forEach((font) => {
      const link = document.createElement('link');
      Object.assign(link, font);
      document.head.appendChild(link);
    });
  }

  /**
   * Setup bundle optimization techniques
   */
  private setupBundleOptimization(): void {
    // Implement code splitting hints and dynamic import optimization
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // Preload non-critical modules when browser is idle
        this.preloadNonCriticalModules();
      });
    }
  }

  /**
   * Preload non-critical modules for better performance
   */
  private preloadNonCriticalModules(): void {
    // Lazy load non-critical features
    const nonCriticalModules = [
      () => import('../components/ChartComponents'),
      () => import('../components/BacktestPanel'),
    ];

    // Load modules with low priority when idle
    nonCriticalModules.forEach((moduleLoader, index) => {
      setTimeout(() => {
        moduleLoader().catch((error) => {
          console.warn(`Failed to preload module ${index}:`, error);
        });
      }, 5000 + index * 2000); // Stagger loading
    });
  }

  /**
   * Optimize image loading with compression and caching
   */
  async optimizeImage(src: string, options?: { quality?: number; width?: number; height?: number }): Promise<string> {
    if (!this.config.enableImageOptimization) {
      return src;
    }

    // Check cache first
    const cacheKey = `${src}_${JSON.stringify(options || {})}`;
    const cached = this.resourceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // In a real implementation, this would process the image
    // For now, return the original src
    const processedSrc = src;

    // Cache the result
    this.resourceCache.set(cacheKey, {
      data: processedSrc,
      timestamp: Date.now(),
      size: new Blob([processedSrc]).size,
    });

    return processedSrc;
  }

  /**
   * Optimize component rendering with virtual scrolling
   */
  optimizeVirtualScrolling<T>(items: T[], renderItem: (item: T, index: number) => any, containerSize: number): any[] {
    if (!this.config.enableVirtualScrolling) {
      return items.map(renderItem);
    }

    // Calculate visible items based on container size and item height
    const itemHeight = 50; // Average item height
    const visibleItemsCount = Math.ceil(containerSize / itemHeight) + 5; // Add buffer

    // Only render visible items plus buffer
    const startIndex = 0; // In a real implementation, this would be calculated based on scroll position
    const endIndex = Math.min(startIndex + visibleItemsCount, items.length);

    const visibleItems = items.slice(startIndex, endIndex);
    const renderedItems = visibleItems.map((item, index) => renderItem(item, startIndex + index));

    // Track virtual scrolling efficiency metrics
    this.metrics.virtualScrollEfficiency = (visibleItems.length / items.length) * 100;

    return renderedItems;
  }

  /**
   * Progressive loading for large datasets
   */
  async progressiveLoad<T>(
    loader: (offset: number, limit: number) => Promise<{ data: T[]; hasMore: boolean }>,
    options?: { batchSize?: number; delay?: number }
  ): Promise<T[]> {
    if (!this.config.enableProgressiveLoading) {
      const result = await loader(0, 100);
      return result.data;
    }

    const batchSize = options?.batchSize || 20;
    const delay = options?.delay || 100;
    let offset = 0;
    let allItems: T[] = [];
    let hasMore = true;

    while (hasMore) {
      const result = await loader(offset, batchSize);
      allItems = [...allItems, ...result.data];
      hasMore = result.hasMore;
      offset += batchSize;

      // Small delay to allow UI to update
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return allItems;
  }

  /**
   * Optimize memory usage by cleaning up unused resources
   */
  optimizeMemoryUsage(): void {
    // Clean up expired cache entries
    const now = Date.now();
    for (const [key, entry] of this.resourceCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.resourceCache.delete(key);
      }
    }

    // Clear old metrics periodically
    this.metrics.memoryUsage = this.getCurrentMemoryUsage();
  }

   /**
    * Get current memory usage if available
    */
   private getCurrentMemoryUsage(): number {
     if ('memory' in performance) {
       const memory = (performance as any).memory;
       return memory ? memory.usedJSHeapSize : 0;
     }
     return 0;
   }
   
   /**
    * Optimize rendering performance by batching DOM updates
    */
   batchDOMUpdates(updateFn: () => void): void {
     if ('requestIdleCallback' in window) {
       // Use requestIdleCallback if available for better performance
       requestIdleCallback(() => {
         updateFn();
       }, { timeout: 100 });
     } else {
       // Fallback to requestAnimationFrame
       requestAnimationFrame(() => {
         updateFn();
       });
     }
   }
   
   /**
    * Optimize event handling by debouncing and throttling
    */
   createOptimizedEventHandler<T extends Event>(
     handler: (event: T) => void,
     options: { debounce?: number; throttle?: number; passive?: boolean } = {}
   ): (event: T) => void {
     let timeoutId: number | null = null;
     let lastExecution = 0;
     
     return (event: T) => {
       const now = Date.now();
       
       // Throttle: ensure minimum time between executions
       if (options.throttle && now - lastExecution < options.throttle) {
         return;
       }
       
       // Debounce: delay execution and cancel previous
       if (options.debounce) {
         if (timeoutId !== null) {
           clearTimeout(timeoutId);
         }
         
         timeoutId = window.setTimeout(() => {
           handler(event);
           lastExecution = Date.now();
           timeoutId = null;
         }, options.debounce);
       } else {
         handler(event);
         lastExecution = Date.now();
       }
     };
   }

  /**
   * Get optimization metrics
   */
  getMetrics(): OptimizationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number; entries: number } {
    return {
      size: Array.from(this.resourceCache.values()).reduce((sum, entry) => sum + entry.size, 0),
      hitRate: 0, // Placeholder - would require tracking hits/misses
      entries: this.resourceCache.size,
    };
  }

  /**
   * Warm up the optimizer with common resources
   */
  async warmUp(): Promise<void> {
    const warmUpTasks = [
      this.preloadNonCriticalModules(),
      new Promise((resolve) => setTimeout(resolve, 2000)).then(() => {
        this.optimizeMemoryUsage();
      }),
    ];

    await Promise.allSettled(warmUpTasks);
  }

  /**
   * Reset optimizer state
   */
  reset(): void {
    this.resourceCache.clear();
    this.metrics = {
      bundleSize: 0,
      loadTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      virtualScrollEfficiency: 0,
    };
  }
}

// Singleton instance
export const frontendOptimizer = new FrontendOptimizer();

// Export the class for potential instantiation with custom config
export { FrontendOptimizer };