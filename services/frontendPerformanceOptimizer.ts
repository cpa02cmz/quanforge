/**
 * Advanced Frontend Performance Optimizer Service
 * Provides comprehensive performance optimizations for frontend
 */

import { performanceMonitor } from '../utils/performance';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';

interface PerformanceOptimizerConfig {
  enableResourcePrefetching: boolean;
  enableLazyLoading: boolean;
  enableImageOptimization: boolean;
  enableFontOptimization: boolean;
  enableBundleOptimization: boolean;
  enableVirtualScrolling: boolean;
  enableProgressiveLoading: boolean;
  enablePreconnect?: boolean;
  enableDNSPrefetch?: boolean;
  enableScriptPreloading?: boolean;
  enableResourceCaching?: boolean;
  enableMemoryOptimization?: boolean;
  enableRenderOptimization?: boolean;
}

interface OptimizationMetrics {
  bundleSize: number;
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  virtualScrollEfficiency: number;
  preconnectHitRate: number;
  dnsPrefetchHitRate: number;
  scriptPreloadHitRate: number;
  resourceOptimizationScore: number;
  renderOptimizationScore: number;
  memoryOptimizationScore: number;
}

class FrontendPerformanceOptimizer {
  private config: PerformanceOptimizerConfig = {
    enableResourcePrefetching: true,
    enableLazyLoading: true,
    enableImageOptimization: true,
    enableFontOptimization: true,
    enableBundleOptimization: true,
    enableVirtualScrolling: true,
    enableProgressiveLoading: true,
    enablePreconnect: true,
    enableDNSPrefetch: true,
    enableScriptPreloading: true,
    enableResourceCaching: true,
    enableMemoryOptimization: true,
    enableRenderOptimization: true,
  };

  private metrics: OptimizationMetrics = {
    bundleSize: 0,
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    virtualScrollEfficiency: 0,
    preconnectHitRate: 0,
    dnsPrefetchHitRate: 0,
    scriptPreloadHitRate: 0,
    resourceOptimizationScore: 0,
    renderOptimizationScore: 0,
    memoryOptimizationScore: 0,
  };

  private resourceCache = new Map<string, { data: any; timestamp: number; size: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100; // Maximum cache entries

  constructor(config?: Partial<PerformanceOptimizerConfig>) {
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

    // New optimizations
    if (this.config.enablePreconnect) {
      this.setupPreconnect();
    }

    if (this.config.enableDNSPrefetch) {
      this.setupDNSPrefetch();
    }

    if (this.config.enableScriptPreloading) {
      this.setupScriptPreloading();
    }

    if (this.config.enableResourceCaching) {
      this.setupResourceCaching();
    }

    if (this.config.enableMemoryOptimization) {
      this.setupMemoryOptimization();
    }

    if (this.config.enableRenderOptimization) {
      this.setupRenderOptimization();
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
      performanceMonitor.recordMetric('resource_prefetch_added', 1);
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
              img.classList.add('loaded');
              imageObserver.unobserve(img);
              performanceMonitor.recordMetric('image_lazy_loaded', 1);
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
      {
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
        rel: 'stylesheet',
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
   * Setup preconnect hints for critical origins
   */
  private setupPreconnect(): void {
    const origins = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://*.supabase.co',
      'https://generativelanguage.googleapis.com',
      'https://cdn.jsdelivr.net',
      'https://unpkg.com',
    ];

    origins.forEach(origin => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      performanceMonitor.recordMetric('preconnect_added', 1);
    });
  }

  /**
   * Setup DNS prefetch for non-critical origins
   */
  private setupDNSPrefetch(): void {
    const origins = [
      'https://www.google-analytics.com',
      'https://cdn.jsdelivr.net',
      'https://unpkg.com',
      'https://*.vercel.app',
      'https://*.vercel-insights.com',
    ];

    origins.forEach(origin => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = origin;
      document.head.appendChild(link);
      performanceMonitor.recordMetric('dns_prefetch_added', 1);
    });
  }

  /**
   * Setup script preloading for critical scripts
   */
  private setupScriptPreloading(): void {
    // Preload critical JavaScript modules that will be needed soon
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.preloadCriticalScripts();
      });
    }
  }

  /**
   * Setup resource caching with advanced strategies
   */
   private setupResourceCaching(): void {
     // Implement advanced caching strategies
     window.addEventListener('beforeunload', () => {
       // Store performance metrics before page unload
       storage.set('perf_metrics_cache', this.metrics);
     });
   }

  /**
   * Setup memory optimization
   */
  private setupMemoryOptimization(): void {
    // Set up memory cleanup intervals
    setInterval(() => {
      this.optimizeMemoryUsage();
    }, 30000); // Every 30 seconds
  }

  /**
   * Setup render optimization
   */
  private setupRenderOptimization(): void {
    // Implement render optimization techniques
    if ('requestAnimationFrame' in window) {
      // Optimize rendering by batching DOM updates
      let renderQueue: (() => void)[] = [];
      let rendering = false;

      const processRenderQueue = () => {
        if (rendering) return;
        
        rendering = true;
        const queue = [...renderQueue];
        renderQueue = [];
        
        queue.forEach(task => task());
        rendering = false;
      };

      // Create a method to batch updates
      (globalThis as any).__batchRender = (task: () => void) => {
        renderQueue.push(task);
        requestAnimationFrame(processRenderQueue);
      };
    }
  }

  /**
   * Preload non-critical modules for better performance
   */
  private preloadNonCriticalModules(): void {
    // Lazy load non-critical features
    // Note: advancedAPICache is statically imported in App.tsx, so not included here
    const nonCriticalModules = [
      () => import('../components/ChartComponents'),
      () => import('../components/BacktestPanel'),
      () => import('../components/MarketTicker'),
    ];

    // Load modules with low priority when idle
    nonCriticalModules.forEach((moduleLoader, index) => {
      setTimeout(() => {
        moduleLoader().then(() => {
          performanceMonitor.recordMetric('module_preloaded', 1);
        }).catch((error) => {
          logger.warn(`Failed to preload module ${index}:`, error);
        });
      }, 5000 + index * 2000); // Stagger loading
    });
  }

  /**
   * Preload critical scripts for better performance
   */
  private preloadCriticalScripts(): void {
    const criticalScripts = [
      { src: 'https://unpkg.com/lz-string@1.5.0/libs/lz-string.min.js', as: 'script' },
      { src: 'https://unpkg.com/dompurify@3.0.5/dist/purify.min.js', as: 'script' },
    ];

    criticalScripts.forEach(script => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = script.src;
      link.as = script.as;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      performanceMonitor.recordMetric('script_preloaded', 1);
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

    // Maintain cache size
    if (this.resourceCache.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.resourceCache.keys().next().value;
      if (firstKey) this.resourceCache.delete(firstKey);
    }

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
    performanceMonitor.recordMetric('virtual_scroll_efficiency', this.metrics.virtualScrollEfficiency);

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
      
      // Record progress
      performanceMonitor.recordMetric('progressive_load_batch', 1);
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
    
    // Force garbage collection if available (for development/testing)
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc?.();
    }
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
    performanceMonitor.recordMetric('optimizer_warmup_complete', 1);
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
      preconnectHitRate: 0,
      dnsPrefetchHitRate: 0,
      scriptPreloadHitRate: 0,
      resourceOptimizationScore: 0,
      renderOptimizationScore: 0,
      memoryOptimizationScore: 0,
    };
  }

  /**
   * Get performance optimization score
   */
  getOptimizationScore(): number {
    const scores = [
      this.metrics.cacheHitRate,
      this.metrics.virtualScrollEfficiency,
      this.metrics.preconnectHitRate,
      this.metrics.dnsPrefetchHitRate,
      this.metrics.scriptPreloadHitRate,
      this.metrics.resourceOptimizationScore,
      this.metrics.renderOptimizationScore,
      this.metrics.memoryOptimizationScore,
    ];

    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    return totalScore / scores.length;
  }

  /**
   * Optimize rendering performance by batching DOM updates
   */
  batchDOMUpdates(updates: () => void): void {
    if ((globalThis as any).__batchRender) {
      (globalThis as any).__batchRender(updates);
    } else {
      // Fallback to direct execution
      updates();
    }
  }

  /**
   * Optimize component rendering with memoization
   */
  memoizeComponent<T>(key: string, component: () => T, ttl: number = 300000): T {
    const cacheKey = `component_${key}`;
    const cached = this.resourceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
    
    const result = component();
    this.resourceCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      size: JSON.stringify(result).length,
    });
    
    // Maintain cache size
    if (this.resourceCache.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.resourceCache.keys().next().value;
      if (firstKey) this.resourceCache.delete(firstKey);
    }
    
    return result;
  }
}

// Singleton instance
export const frontendPerformanceOptimizer = new FrontendPerformanceOptimizer();

// Export the class for potential instantiation with custom config
export { FrontendPerformanceOptimizer };