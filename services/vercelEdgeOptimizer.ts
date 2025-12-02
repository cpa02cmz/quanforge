/**
 * Vercel Edge Optimization Service
 * Provides edge-specific optimizations for better performance
 */

interface EdgeConfig {
  enableEdgeRuntime: boolean;
  enableEdgeCaching: boolean;
  enableCompression: boolean;
  enablePrefetch: boolean;
  enablePreload: boolean;
  cacheTTL: number;
  edgeRegions: string[];
}

interface EdgeMetrics {
  region: string;
  responseTime: number;
  cacheHitRate: number;
  bandwidthSaved: number;
  requestsServed: number;
}

class VercelEdgeOptimizer {
  private static instance: VercelEdgeOptimizer;
  private config: EdgeConfig = {
    enableEdgeRuntime: process.env['VITE_EDGE_RUNTIME'] === 'true',
    enableEdgeCaching: true,
    enableCompression: process.env['VITE_ENABLE_COMPRESSION'] === 'true',
    enablePrefetch: process.env['VITE_ENABLE_PREFETCH'] === 'true',
    enablePreload: process.env['VITE_ENABLE_PRELOAD'] === 'true',
    cacheTTL: 31536000, // 1 year for static assets
    edgeRegions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
  };
  private metrics: Map<string, EdgeMetrics> = new Map();

  private constructor() {
    this.initializeEdgeFeatures();
  }

  static getInstance(): VercelEdgeOptimizer {
    if (!VercelEdgeOptimizer.instance) {
      VercelEdgeOptimizer.instance = new VercelEdgeOptimizer();
    }
    return VercelEdgeOptimizer.instance;
  }

  private initializeEdgeFeatures(): void {
    // Enable edge-specific optimizations
    if (this.config.enableEdgeCaching) {
      this.setupEdgeCaching();
    }

    if (this.config.enablePrefetch) {
      this.setupResourcePrefetching();
    }

    if (this.config.enablePreload) {
      this.setupResourcePreloading();
    }

    // Setup performance monitoring
    this.setupPerformanceMonitoring();
  }

  private setupEdgeCaching(): void {
    // Set up service worker for edge caching
    if ('serviceWorker' in navigator && this.config.enableEdgeRuntime) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('Edge Service Worker registered:', registration);
      }).catch((error) => {
        console.warn('Edge Service Worker registration failed:', error);
      });
    }
  }

  private setupResourcePrefetching(): void {
    // Prefetch critical resources
    const criticalResources = [
      '/api/robots',
      '/api/strategies',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700',
    ];

    criticalResources.forEach((resource) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = resource;
      document.head.appendChild(link);
    });
  }

  private setupResourcePreloading(): void {
    // Preload critical resources
    const criticalResources = [
      { href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
      { href: '/api/health', as: 'fetch' },
    ];

    criticalResources.forEach((resource) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.href;
      link.as = resource.as;
      if (resource.type) link.type = resource.type;
      if (resource.crossOrigin) link.crossOrigin = resource.crossOrigin;
      document.head.appendChild(link);
    });
  }

  private setupPerformanceMonitoring(): void {
    // Monitor Core Web Vitals
    if ('PerformanceObserver' in window) {
      try {
        // Monitor Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric('lcp', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Monitor First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.recordMetric('fid', entry.processingStart - entry.startTime);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Monitor Cumulative Layout Shift
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              this.recordMetric('cls', clsValue);
            }
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        console.warn('Performance monitoring setup failed:', error);
      }
    }
  }

  private recordMetric(type: string, value: number): void {
    // Send metrics to analytics for edge performance monitoring
    if (process.env['VITE_ENABLE_WEB_VITALS'] === 'true') {
      // In production, send to analytics service
      console.log(`Performance metric ${type}:`, value);
    }
  }

  // Optimize API calls for edge
  async optimizeApiCall<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const startTime = performance.now();

    // Add edge-specific headers
    const edgeHeaders = {
      'x-edge-region': this.detectEdgeRegion(),
      'x-edge-cache': this.config.enableEdgeCaching ? 'enabled' : 'disabled',
      'x-edge-compression': this.config.enableCompression ? 'enabled' : 'disabled',
    };

    const optimizedOptions = {
      ...options,
      headers: {
        ...options.headers,
        ...edgeHeaders,
      },
    };

    try {
      const response = await fetch(url, optimizedOptions);
      const data = await response.json();

      // Record metrics
      const responseTime = performance.now() - startTime;
      this.recordApiMetrics(url, responseTime, response.ok);

      return data;
    } catch (error) {
      console.error('Optimized API call failed:', error);
      throw error;
    }
  }

  private detectEdgeRegion(): string {
    // Detect edge region from request headers or performance timing
    // This is a simplified detection - in production, use more sophisticated methods
    const regions = this.config.edgeRegions;
    return regions[Math.floor(Math.random() * regions.length)];
  }

  private recordApiMetrics(url: string, responseTime: number, success: boolean): void {
    const region = this.detectEdgeRegion();
    const existing = this.metrics.get(region) || {
      region,
      responseTime: 0,
      cacheHitRate: 0,
      bandwidthSaved: 0,
      requestsServed: 0,
    };

    existing.responseTime = (existing.responseTime + responseTime) / 2;
    existing.requestsServed++;

    this.metrics.set(region, existing);
  }

  // Get edge performance metrics
  getEdgeMetrics(): EdgeMetrics[] {
    return Array.from(this.metrics.values());
  }

  // Optimize bundle for edge deployment
  optimizeBundleForEdge(): void {
    // Enable dynamic imports for code splitting
    if (this.config.enableEdgeRuntime) {
      // Preload critical chunks
      const criticalChunks = [
        'vendor-react',
        'vendor-charts',
        'components-heavy',
      ];

      criticalChunks.forEach((chunk) => {
        const link = document.createElement('link');
        link.rel = 'modulepreload';
        link.href = `/assets/js/${chunk}.js`;
        document.head.appendChild(link);
      });
    }
  }

  // Enable edge-side rendering optimizations
  enableEdgeSSR(): void {
    // Add SSR-specific optimizations
    if (this.config.enableEdgeRuntime) {
      // Pre-render critical components
      const criticalComponents = ['Layout', 'Dashboard', 'Generator'];
      
      criticalComponents.forEach((component) => {
        // In a real implementation, this would trigger edge-side rendering
        console.log(`Pre-rendering ${component} at edge`);
      });
    }
  }

  // Setup edge-specific error handling
  setupEdgeErrorHandling(): void {
    // Global error handler for edge environment
    window.addEventListener('error', (event) => {
      console.error('Edge error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        region: this.detectEdgeRegion(),
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Edge unhandled promise rejection:', {
        reason: event.reason,
        region: this.detectEdgeRegion(),
      });
    });
  }

  // Get edge configuration
  getConfig(): EdgeConfig {
    return { ...this.config };
  }

  // Update edge configuration
  updateConfig(newConfig: Partial<EdgeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const vercelEdgeOptimizer = VercelEdgeOptimizer.getInstance();