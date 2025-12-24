/**
 * Frontend Performance Optimizer Service
 */

import { logger } from '../utils/logger';

class FrontendPerformanceOptimizer {
  private static instance: FrontendPerformanceOptimizer;
  private isWarmedUp = false;

  static getInstance(): FrontendPerformanceOptimizer {
    if (!FrontendPerformanceOptimizer.instance) {
      FrontendPerformanceOptimizer.instance = new FrontendPerformanceOptimizer();
    }
    return FrontendPerformanceOptimizer.instance;
  }

  // Warm up services and cache critical resources
  async warmUp(): Promise<void> {
    try {
      if (this.isWarmedUp) {
        logger.info('Frontend optimizer already warmed up');
        return;
      }

      logger.info('Warming up frontend performance optimizer...');
      
      // Preload critical resources
      await this.preloadCriticalResources();
      
      // Initialize performance monitoring
      this.initializePerformanceMonitoring();
      
      // Setup intersection observers for lazy loading
      this.setupLazyLoading();
      
      this.isWarmedUp = true;
      logger.info('Frontend performance optimizer warmed up successfully');
    } catch (error) {
      logger.error('Failed to warm up frontend optimizer:', error);
    }
  }

  private async preloadCriticalResources(): Promise<void> {
    // Preload critical fonts and assets
    if (typeof window !== 'undefined') {
      // Preload critical CSS and fonts
      this.preloadFont('/fonts/inter.woff2');
      this.preloadFont('/fonts/mono.woff2');
    }
  }

  private preloadFont(url: string): void {
    if (typeof window !== 'undefined' && 'fonts' in document) {
      document.fonts.load(`1em url(${url})`).catch(() => {
        logger.warn(`Failed to preload font: ${url}`);
      });
    }
  }

  private initializePerformanceMonitoring(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Monitor core web vitals
      this.monitorCoreWebVitals();
    }
  }

  private monitorCoreWebVitals(): void {
    // Simple implementation for monitoring
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              logger.debug('Navigation timing:', {
                loadTime: navEntry.loadEventEnd - navEntry.loadEventStart,
                domComplete: navEntry.domComplete,
                firstPaint: navEntry.fetchStart
              });
            }
          }
        });
        
        observer.observe({ entryTypes: ['navigation'] });
      } catch (error) {
        logger.warn('Performance observer not fully supported:', error);
      }
    }
  }

  private setupLazyLoading(): void {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      // Setup image lazy loading
      this.setupImageLazyLoading();
    }
  }

  private setupImageLazyLoading(): void {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as any;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    });

    // Observe all images with data-src
    document.querySelectorAll('img[data-src]').forEach((img) => {
      imageObserver.observe(img);
    });
  }

  // Optimize bundle loading
  optimizeBundleLoading(): void {
    if (typeof window !== 'undefined') {
      // Enable code splitting hints for modern browsers
      if ('link' in document.createElement('link')) {
        this.prefetchCriticalRoutes();
      }
    }
  }

  private prefetchCriticalRoutes(): void {
    const criticalRoutes = ['/dashboard', '/generator'];
    criticalRoutes.forEach((route) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = route;
      document.head.appendChild(link);
    });
  }

  // Get optimization status
  getOptimizationStatus(): { warmedUp: boolean; features: string[] } {
    return {
      warmedUp: this.isWarmedUp,
      features: [
        'core_web_vitals_monitoring',
        'image_lazy_loading', 
        'route_prefetching',
        'font_preloading'
      ]
    };
  }
}

export const frontendPerformanceOptimizer = FrontendPerformanceOptimizer.getInstance();
export default frontendPerformanceOptimizer;