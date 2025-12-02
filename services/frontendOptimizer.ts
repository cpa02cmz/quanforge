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
     
     // Initialize additional optimizations
     if (this.config.enableImageOptimization) {
       this.optimizeImageLoading().catch(console.warn);
     }
     
     if (this.config.enableResourcePrefetching) {
       this.registerServiceWorker().catch(console.warn);
     }
     
     this.optimizeCriticalResources();
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
     
     // Setup resource hints for critical resources
     this.setupResourceHints();
   }

   /**
    * Setup resource hints for performance optimization
    */
   private setupResourceHints(): void {
     // Preconnect to important third-party domains
     const domains = [
       'https://fonts.googleapis.com',
       'https://fonts.gstatic.com',
       'https://api.gemini.google.com', // Example - replace with actual API domains
       'https://supabase.api.com',      // Example - replace with actual Supabase URL
     ];
     
     domains.forEach(domain => {
       const link = document.createElement('link');
       link.rel = 'preconnect';
       link.href = domain;
       document.head.appendChild(link);
     });
   }

   /**
    * Preload non-critical modules for better performance
    */
   private preloadNonCriticalModules(): void {
     // Lazy load non-critical features
     const nonCriticalModules = [
       () => import('../components/ChartComponents'),
       () => import('../components/BacktestPanel'),
       () => import('../services/gemini'),
       () => import('../services/simulation'),
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
    * Advanced caching with service worker registration
    */
   async registerServiceWorker(): Promise<void> {
     if ('serviceWorker' in navigator && this.config.enableResourcePrefetching) {
       try {
         const registration = await navigator.serviceWorker.register('/sw.js');
         console.log('Service Worker registered:', registration);
         
         // Set up cache strategies for different resource types
         this.setupAdvancedCaching();
       } catch (error) {
         console.warn('Service Worker registration failed:', error);
       }
     }
   }
   
   /**
    * Setup advanced caching strategies
    */
   private setupAdvancedCaching(): void {
     // Cache API responses with appropriate strategies
     const cacheStrategies = {
       // Cache static assets with cache-first strategy
       static: {
         pattern: /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/,
         strategy: 'cache-first',
         maxAge: 31536000 // 1 year
       },
       // Cache API responses with stale-while-revalidate
       api: {
         pattern: /\/api\//,
         strategy: 'stale-while-revalidate',
         maxAge: 300 // 5 minutes
       },
       // Cache user data with network-first
       user: {
         pattern: /\/api\/user/,
         strategy: 'network-first',
         maxAge: 60 // 1 minute
       }
     };
     
     // Store cache strategies for service worker to use
     if (typeof window !== 'undefined') {
       (window as any).__QUANTFORGE_CACHE_STRATEGIES = cacheStrategies;
     }
   }
   
   /**
    * Optimize image loading with WebP support and lazy loading
    */
   async optimizeImageLoading(): Promise<void> {
     // Convert images to WebP if supported
     if (!this.config.enableImageOptimization) return;
     
     // Check WebP support
     const supportsWebP = await this.checkWebPSupport();
     
     // Process all images on the page
     const images = document.querySelectorAll('img[data-src]');
     images.forEach(img => {
       const originalSrc = img.getAttribute('data-src');
       if (originalSrc) {
         // If WebP is supported, try to load WebP version
         if (supportsWebP) {
           const webpSrc = originalSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
           // Preload WebP version
           const preloadLink = document.createElement('link');
           preloadLink.rel = 'preload';
           preloadLink.href = webpSrc;
           preloadLink.as = 'image';
           document.head.appendChild(preloadLink);
         }
       }
     });
   }
   
   /**
    * Check if browser supports WebP
    */
   private async checkWebPSupport(): Promise<boolean> {
     return new Promise(resolve => {
       const canvas = document.createElement('canvas');
       canvas.width = 1;
       canvas.height = 1;
       const isSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
       resolve(isSupported);
     });
   }
   
   /**
    * Optimize critical resource loading
    */
   optimizeCriticalResources(): void {
     // Optimize critical path resources
     const criticalResources = [
       { href: '/assets/css/main.css', rel: 'preload', as: 'style' },
       { href: '/assets/js/vendor-react.js', rel: 'preload', as: 'script' },
       { href: '/assets/js/pages-dashboard.js', rel: 'preload', as: 'script' },
     ];
     
     criticalResources.forEach(resource => {
       const link = document.createElement('link');
       link.rel = resource.rel;
       link.href = resource.href;
       if (resource.as) link.as = resource.as;
       document.head.appendChild(link);
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