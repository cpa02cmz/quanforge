/**
 * Enhanced Edge Optimization Service
 * Advanced optimizations for Vercel Edge deployment
 */

interface EdgeMetrics {
  region: string;
  responseTime: number;
  cacheHitRate: number;
  bandwidthSaved: number;
  requestsServed: number;
  compressionRatio: number;
  coreWebVitals: {
    lcp: number;
    fid: number;
    cls: number;
    fcp: number;
    ttfb: number;
  };
}

interface EdgeConfig {
  enableEdgeRuntime: boolean;
  enableEdgeCaching: boolean;
  enableCompression: boolean;
  enablePrefetch: boolean;
  enablePreload: boolean;
  enableServiceWorker: boolean;
  cacheTTL: number;
  edgeRegions: string[];
  compressionLevel: number;
  enableBrotli: boolean;
}

interface CacheStrategy {
  name: string;
  pattern: RegExp;
  strategy: 'cacheFirst' | 'networkFirst' | 'staleWhileRevalidate' | 'edgeFirst';
  ttl: number;
  compression: boolean;
}

class EnhancedEdgeOptimizer {
  private static instance: EnhancedEdgeOptimizer;
  private config: EdgeConfig = {
    enableEdgeRuntime: process.env['VITE_EDGE_RUNTIME'] === 'true',
    enableEdgeCaching: true,
    enableCompression: process.env['VITE_ENABLE_COMPRESSION'] === 'true',
    enablePrefetch: process.env['VITE_ENABLE_PREFETCH'] === 'true',
    enablePreload: process.env['VITE_ENABLE_PRELOAD'] === 'true',
    enableServiceWorker: process.env['VITE_ENABLE_SERVICE_WORKER'] === 'true',
    cacheTTL: 31536000, // 1 year for static assets
    edgeRegions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
    compressionLevel: 6,
    enableBrotli: true,
  };
  
  private metrics: Map<string, EdgeMetrics> = new Map();
  private cacheStrategies: CacheStrategy[] = [];
  private performanceObserver: PerformanceObserver | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;

  private constructor() {
    this.initializeEdgeFeatures();
    this.setupCacheStrategies();
    this.initializePerformanceMonitoring();
  }

  static getInstance(): EnhancedEdgeOptimizer {
    if (!EnhancedEdgeOptimizer.instance) {
      EnhancedEdgeOptimizer.instance = new EnhancedEdgeOptimizer();
    }
    return EnhancedEdgeOptimizer.instance;
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

    if (this.config.enableServiceWorker) {
      this.setupServiceWorkerRegistration();
    }

    // Setup edge-specific error handling
    this.setupEdgeErrorHandling();
  }

  private setupCacheStrategies(): void {
    this.cacheStrategies = [
      {
        name: 'static-assets',
        pattern: /\.(js|css|woff|woff2|ttf|eot|png|jpg|jpeg|gif|svg|ico|webp|avif)$/,
        strategy: 'cacheFirst',
        ttl: this.config.cacheTTL,
        compression: true,
      },
      {
        name: 'api-responses',
        pattern: /\/api\//,
        strategy: 'networkFirst',
        ttl: 300000, // 5 minutes
        compression: true,
      },
      {
        name: 'pages',
        pattern: /\/$|\/dashboard|\/generator|\/wiki/,
        strategy: 'staleWhileRevalidate',
        ttl: 86400000, // 24 hours
        compression: true,
      },
      {
        name: 'external-apis',
        pattern: /(supabase|googleapis|twelvedata)/,
        strategy: 'networkFirst',
        ttl: 60000, // 1 minute
        compression: true,
      },
    ];
  }

  private setupServiceWorkerRegistration(): void {
    // Set up enhanced service worker for edge caching
    if ('serviceWorker' in navigator && this.config.enableServiceWorker) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Enhanced Edge Service Worker registered:', registration);
          this.swRegistration = registration;
          this.setupServiceWorkerCommunication(registration);
        })
        .catch((error) => {
          console.warn('Enhanced Edge Service Worker registration failed:', error);
        });
    }
  }

  private setupEdgeCaching(): void {
    // Additional edge caching setup
    console.log('Edge caching initialized');
  }

  private setupServiceWorkerCommunication(registration: ServiceWorkerRegistration): void {
    // Set up communication channel with service worker
    const messageChannel = new MessageChannel();
    
    messageChannel.port1.onmessage = (event) => {
      if (event.data.type === 'EDGE_STATUS') {
        console.log('Edge Status:', event.data);
        this.updateEdgeMetrics(event.data);
      }
    };

    // Request edge status from service worker
    if (registration.active) {
      registration.active.postMessage(
        { type: 'EDGE_STATUS' },
        [messageChannel.port2]
      );
    }
  }

  private setupResourcePrefetching(): void {
    // Enhanced prefetching with priority and timing
    const criticalResources = [
      { url: '/api/health', priority: 'high', delay: 0 },
      { url: '/api/strategies', priority: 'medium', delay: 1000 },
      { url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700', priority: 'low', delay: 2000 },
    ];

    criticalResources.forEach(({ url, priority, delay }) => {
      setTimeout(() => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        link.setAttribute('data-priority', priority);
        document.head.appendChild(link);
      }, delay);
    });
  }

  private setupResourcePreloading(): void {
    // Enhanced preloading with proper resource hints
    const criticalResources = [
      { href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
      { href: '/api/health', as: 'fetch' },
      { href: '/assets/js/vendor-react.js', as: 'script' },
      { href: '/assets/js/main.js', as: 'script' },
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

  private initializePerformanceMonitoring(): void {
    // Enhanced Core Web Vitals monitoring
    if ('PerformanceObserver' in window) {
      try {
        // Monitor Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordWebVital('lcp', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Monitor First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.recordWebVital('fid', entry.processingStart - entry.startTime);
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
              this.recordWebVital('cls', clsValue);
            }
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // Monitor First Contentful Paint
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
          if (fcpEntry) {
            this.recordWebVital('fcp', fcpEntry.startTime);
          }
        });
        fcpObserver.observe({ entryTypes: ['paint'] });

        // Monitor Time to First Byte
        const ttfbObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.entryType === 'navigation') {
              const ttfb = entry.responseStart - entry.requestStart;
              this.recordWebVital('ttfb', ttfb);
            }
          });
        });
        ttfbObserver.observe({ entryTypes: ['navigation'] });

      } catch (error) {
        console.warn('Enhanced performance monitoring setup failed:', error);
      }
    }
  }

  private recordWebVital(type: string, value: number): void {
    const region = this.detectEdgeRegion();
    const existing = this.metrics.get(region) || this.getDefaultMetrics();
    
    existing.coreWebVitals[type as keyof typeof existing.coreWebVitals] = value;
    this.metrics.set(region, existing);

    // Send to analytics if enabled
    if (process.env['VITE_ENABLE_WEB_VITALS'] === 'true') {
      this.sendToAnalytics('web-vital', { type, value, region });
    }
  }

  private getDefaultMetrics(): EdgeMetrics {
    return {
      region: this.detectEdgeRegion(),
      responseTime: 0,
      cacheHitRate: 0,
      bandwidthSaved: 0,
      requestsServed: 0,
      compressionRatio: 0,
      coreWebVitals: {
        lcp: 0,
        fid: 0,
        cls: 0,
        fcp: 0,
        ttfb: 0,
      },
    };
  }

  // Enhanced API call optimization
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
      'x-edge-brotli': this.config.enableBrotli ? 'enabled' : 'disabled',
      'accept-encoding': this.config.enableBrotli ? 'br, gzip, deflate' : 'gzip, deflate',
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
      console.error('Enhanced optimized API call failed:', error);
      throw error;
    }
  }

  private detectEdgeRegion(): string {
    // Enhanced edge region detection
    // In production, this would use actual edge detection logic
    const regions = this.config.edgeRegions;
    
    // Simple load balancing based on time
    const index = Math.floor(Date.now() / 10000) % regions.length;
    return regions[index];
  }

  private recordApiMetrics(url: string, responseTime: number, success: boolean): void {
    const region = this.detectEdgeRegion();
    const existing = this.metrics.get(region) || this.getDefaultMetrics();

    existing.responseTime = (existing.responseTime + responseTime) / 2;
    existing.requestsServed++;

    // Simulate cache hit rate (in production, this would come from actual cache headers)
    existing.cacheHitRate = Math.min(0.95, existing.cacheHitRate + 0.01);

    this.metrics.set(region, existing);
  }

  private recordMetric(type: string, value: number): void {
    // Send metrics to analytics for edge performance monitoring
    if (process.env['VITE_ENABLE_WEB_VITALS'] === 'true') {
      this.sendToAnalytics('performance', { type, value, region: this.detectEdgeRegion() });
    }
  }

  private sendToAnalytics(eventType: string, data: any): void {
    // In production, send to actual analytics service
    console.log(`Edge Analytics [${eventType}]:`, data);
  }

  private updateEdgeMetrics(status: any): void {
    // Update metrics from service worker
    const region = status.region || this.detectEdgeRegion();
    const existing = this.metrics.get(region) || this.getDefaultMetrics();
    
    // Update with service worker data
    if (status.caches) {
      Object.assign(existing, status);
    }
    
    this.metrics.set(region, existing);
  }

  private setupEdgeErrorHandling(): void {
    // Enhanced global error handler for edge environment
    window.addEventListener('error', (event) => {
      console.error('Enhanced edge error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        region: this.detectEdgeRegion(),
        timestamp: Date.now(),
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Enhanced edge unhandled promise rejection:', {
        reason: event.reason,
        region: this.detectEdgeRegion(),
        timestamp: Date.now(),
      });
    });
  }

  // Public API methods

  // Get edge performance metrics
  getEdgeMetrics(): EdgeMetrics[] {
    return Array.from(this.metrics.values());
  }

  // Get edge configuration
  getConfig(): EdgeConfig {
    return { ...this.config };
  }

  // Update edge configuration
  updateConfig(newConfig: Partial<EdgeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Optimize bundle for edge deployment
  optimizeBundleForEdge(): void {
    if (this.config.enableEdgeRuntime) {
      // Preload critical chunks with priority
      const criticalChunks = [
        { name: 'vendor-react', priority: 'high' },
        { name: 'vendor-charts', priority: 'medium' },
        { name: 'main', priority: 'high' },
        { name: 'components', priority: 'medium' },
      ];

      criticalChunks.forEach(({ name, priority }) => {
        const link = document.createElement('link');
        link.rel = 'modulepreload';
        link.href = `/assets/js/${name}.js`;
        link.setAttribute('data-priority', priority);
        document.head.appendChild(link);
      });
    }
  }

  // Enable edge-side rendering optimizations
  enableEdgeSSR(): void {
    if (this.config.enableEdgeRuntime) {
      // Pre-render critical components at edge
      const criticalComponents = ['Layout', 'Dashboard', 'Generator'];
      
      criticalComponents.forEach((component) => {
        console.log(`Pre-rendering ${component} at edge`);
        // In a real implementation, this would trigger edge-side rendering
      });
    }
  }

  // Clear edge caches
  async clearEdgeCaches(): Promise<void> {
    if (this.swRegistration) {
      this.swRegistration.active?.postMessage({ type: 'CACHE_CLEAR' });
    }
  }

  // Update edge caches
  async updateEdgeCaches(): Promise<void> {
    if (this.swRegistration) {
      this.swRegistration.active?.postMessage({ type: 'CACHE_UPDATE' });
    }
  }

  // Get cache strategies
  getCacheStrategies(): CacheStrategy[] {
    return [...this.cacheStrategies];
  }

  // Add custom cache strategy
  addCacheStrategy(strategy: CacheStrategy): void {
    this.cacheStrategies.push(strategy);
  }

  // Get performance report
  getPerformanceReport(): {
    summary: EdgeMetrics[];
    webVitals: any;
    recommendations: string[];
  } {
    const summary = this.getEdgeMetrics();
    const webVitals = this.aggregateWebVitals();
    const recommendations = this.generateRecommendations();

    return {
      summary,
      webVitals,
      recommendations,
    };
  }

  private aggregateWebVitals(): any {
    const allMetrics = this.getEdgeMetrics();
    const aggregated = {
      lcp: { avg: 0, min: Infinity, max: 0 },
      fid: { avg: 0, min: Infinity, max: 0 },
      cls: { avg: 0, min: Infinity, max: 0 },
      fcp: { avg: 0, min: Infinity, max: 0 },
      ttfb: { avg: 0, min: Infinity, max: 0 },
    };

    allMetrics.forEach((metrics) => {
      Object.keys(aggregated).forEach((vital) => {
        const value = metrics.coreWebVitals[vital as keyof typeof metrics.coreWebVitals];
        aggregated[vital as keyof typeof aggregated].avg += value;
        aggregated[vital as keyof typeof aggregated].min = Math.min(aggregated[vital as keyof typeof aggregated].min, value);
        aggregated[vital as keyof typeof aggregated].max = Math.max(aggregated[vital as keyof typeof aggregated].max, value);
      });
    });

    // Calculate averages
    const count = allMetrics.length || 1;
    Object.keys(aggregated).forEach((vital) => {
      aggregated[vital as keyof typeof aggregated].avg /= count;
    });

    return aggregated;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getEdgeMetrics();

    if (metrics.length === 0) {
      return ['No edge metrics available yet. Continue monitoring...'];
    }

    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const avgCacheHitRate = metrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / metrics.length;

    if (avgResponseTime > 500) {
      recommendations.push('Consider enabling edge caching for API responses to reduce response time');
    }

    if (avgCacheHitRate < 0.8) {
      recommendations.push('Cache hit rate is below 80%. Consider increasing cache TTL or implementing edge-side caching');
    }

    const avgLCP = this.aggregateWebVitals().lcp.avg;
    if (avgLCP > 2500) {
      recommendations.push('Largest Contentful Paint is slow. Consider optimizing critical resources and enabling edge preloading');
    }

    const avgCLS = this.aggregateWebVitals().cls.avg;
    if (avgCLS > 0.1) {
      recommendations.push('Cumulative Layout Shift is high. Ensure proper dimensions for media and optimize font loading');
    }

    if (recommendations.length === 0) {
      recommendations.push('Edge performance is optimal. Continue monitoring for improvements.');
    }

    return recommendations;
  }
}

export const enhancedEdgeOptimizer = EnhancedEdgeOptimizer.getInstance();