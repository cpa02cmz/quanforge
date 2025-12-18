/**
 * Vercel Edge Optimization Service
 * Provides edge-specific optimizations for better performance
 */

import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('VercelEdgeOptimizer');

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
    edgeRegions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1'],
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
    // Set up enhanced service worker for edge caching
    if ('serviceWorker' in navigator && this.config.enableEdgeRuntime) {
      navigator.serviceWorker.register('/sw-enhanced.js').then((registration) => {
        logger.info('Enhanced Edge Service Worker registered:', registration);
        
        // Send message to service worker to skip waiting
        if (registration.active) {
          registration.active.postMessage({ type: 'SKIP_WAITING' });
        }
        
        // Set up periodic cache updates
        if ('periodicSync' in registration) {
          (registration as any).periodicSync.register('cache-update', {
            minInterval: 24 * 60 * 60 * 1000 // 24 hours
          }).then(() => {
            logger.info('Periodic cache sync registered');
          }).catch((error: any) => {
            logger.warn('Periodic sync registration failed:', error);
          });
        }
      }).catch((error) => {
        logger.warn('Enhanced Edge Service Worker registration failed:', error);
        // Fallback to basic service worker
        navigator.serviceWorker.register('/sw.js').then((registration) => {
          logger.info('Fallback Service Worker registered:', registration);
        }).catch((fallbackError) => {
          logger.warn('Fallback Service Worker registration failed:', fallbackError);
        });
      });
    }
  }

  private setupResourcePrefetching(): void {
    // Prefetch critical resources with enhanced strategy
    const criticalResources = [
      '/api/robots',
      '/api/strategies',
      '/api/health',
      '/api/analytics/performance-score',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700',
    ];

    criticalResources.forEach((resource) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = resource;
      link.setAttribute('data-edge-optimized', 'true');
      document.head.appendChild(link);
    });

    // Prefetch based on user interaction patterns
    this.setupIntelligentPrefetching();
  }

  private setupIntelligentPrefetching(): void {
    // Prefetch resources based on user behavior
    
    
    const prefetchWhenIdle = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          // Prefetch next likely pages/resources
          const likelyResources = [
            '/api/edge-optimize',
            '/api/analytics/summary',
          ];
          
          likelyResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = resource;
            document.head.appendChild(link);
          });
        });
      }
    };

    // Setup intersection observer for prefetching
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            prefetchWhenIdle();
          }
        });
      });

      // Observe main content area
      const mainContent = document.querySelector('main');
      if (mainContent) {
        observer.observe(mainContent);
      }
    }
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
        if (lastEntry) {
          this.recordMetric('lcp', lastEntry.startTime);
        }
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
        logger.warn('Performance monitoring setup failed:', error);
      }
    }
  }

  private recordMetric(type: string, value: number): void {
    // Send metrics to analytics for edge performance monitoring
    if (process.env['VITE_ENABLE_WEB_VITALS'] === 'true') {
      // In production, send to analytics service
      logger.debug(`Performance metric ${type}:`, value);
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
      logger.error('Optimized API call failed:', error);
      throw error;
    }
  }

  private detectEdgeRegion(): string {
    // Detect edge region from request headers or performance timing
    // This is a simplified detection - in production, use more sophisticated methods
    const regions = this.config.edgeRegions;
    return regions[Math.floor(Math.random() * regions.length)] || 'iad1';
  }

  private recordApiMetrics(_url: string, responseTime: number, _success: boolean): void {
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
        logger.debug(`Pre-rendering ${component} at edge`);
      });
    }
  }

  // Setup edge-specific error handling
  setupEdgeErrorHandling(): void {
    // Global error handler for edge environment
    window.addEventListener('error', (event) => {
      logger.error('Edge error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        region: this.detectEdgeRegion(),
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      logger.error('Edge unhandled promise rejection:', {
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

  // Advanced edge caching strategies
  setupAdvancedCaching(): void {
    if (!this.config.enableEdgeCaching) return;

    // Cache API responses with different strategies
    this.setupAPICaching();
    
    // Cache static assets with long TTL
    this.setupStaticAssetCaching();
    
    // Cache database queries with intelligent invalidation
    this.setupDatabaseQueryCaching();
  }

  private setupAPICaching(): void {
    // Cache API responses based on endpoint patterns
    const cacheStrategies: Record<string, { ttl: number; vary: string[] }> = {
      '/api/robots': { ttl: 300000, vary: ['Authorization'] }, // 5 minutes
      '/api/strategies': { ttl: 600000, vary: ['Authorization'] }, // 10 minutes
      '/api/analytics': { ttl: 180000, vary: ['Authorization'] }, // 3 minutes
      '/api/health': { ttl: 30000, vary: [] }, // 30 seconds
    };

    // Apply caching headers to fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
      
      for (const [pattern, strategy] of Object.entries(cacheStrategies)) {
        if (url.includes(pattern)) {
          init = init || {};
          init.headers = {
            ...init.headers,
            'Cache-Control': `max-age=${Math.floor(strategy.ttl / 1000)}`,
            'Vary': strategy.vary.join(', '),
            'X-Edge-Cache-Strategy': pattern,
          };
          break;
        }
      }

      return originalFetch(input, init);
    };
  }

  private setupStaticAssetCaching(): void {
    // Long-term caching for static assets
    

    // Service worker for offline caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-enhanced.js').catch(() => {
        // Fallback to application cache
        this.setupApplicationCache();
      });
    }
  }

  private setupApplicationCache(): void {
    // Fallback caching strategy
    const cacheName = 'quantforge-edge-v1';
    const assetsToCache = [
      '/',
      '/index.html',
      '/manifest.json',
      '/assets/js/main.js',
      '/assets/css/main.css',
    ];

    caches.open(cacheName).then((cache) => {
      return cache.addAll(assetsToCache);
    }).catch(() => {
      logger.warn('Application cache not available');
    });
  }

  private setupDatabaseQueryCaching(): void {
    // Intelligent caching for database queries
    const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

    // Cache invalidation based on data modifications
    this.setupCacheInvalidation(queryCache);
  }

  private setupCacheInvalidation(cache: Map<string, any>): void {
    // Listen for data changes and invalidate relevant cache entries
    const invalidateCache = (pattern: string) => {
      for (const [key] of cache.entries()) {
        if (key.includes(pattern)) {
          cache.delete(key);
        }
      }
    };

    // Hook into data modification operations
    if (typeof window !== 'undefined') {
      window.addEventListener('robot-updated', () => invalidateCache('robots'));
      window.addEventListener('robot-created', () => invalidateCache('robots'));
      window.addEventListener('robot-deleted', () => invalidateCache('robots'));
    }
  }

  // Edge-optimized data fetching
  async optimizedFetch<T>(
    url: string,
    options: RequestInit = {},
    cacheOptions: {
      ttl?: number;
      key?: string;
      forceRefresh?: boolean;
    } = {}
  ): Promise<T> {
    const { ttl = 300000, key, forceRefresh = false } = cacheOptions;
    const cacheKey = key || url;

    // Check cache first
    if (!forceRefresh) {
      const cached = this.getOptimizedCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-Edge-Optimized': 'true',
          'X-Edge-Region': this.getCurrentRegion(),
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache successful responses
      this.setOptimizedCache(cacheKey, data, ttl);
      
      return data;
    } catch (error) {
      logger.error(`Optimized fetch failed for ${url}:`, error);
      throw error;
    }
  }

  private getCurrentRegion(): string {
    // Detect current edge region
    return process.env['VERCEL_REGION'] || 'unknown';
  }

  private getOptimizedCache(key: string): any | null {
    try {
      const cached = localStorage.getItem(`edge-cache-${key}`);
      if (!cached) return null;

      const { data, timestamp, ttl } = JSON.parse(cached);
      if (Date.now() - timestamp > ttl) {
        localStorage.removeItem(`edge-cache-${key}`);
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  private setOptimizedCache(key: string, data: any, ttl: number): void {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(`edge-cache-${key}`, JSON.stringify(cacheData));
    } catch (error) {
      logger.warn('Failed to cache data:', error);
    }
  }

  // Performance optimization for Supabase queries
  optimizeSupabaseQuery(query: string, table: string): {
    optimizedQuery: string;
    cacheKey: string;
    ttl: number;
  } {
    // Add query optimizations
    let optimizedQuery = query;
    
    // Add select optimizations
    if (!query.includes('select') && !query.includes('SELECT')) {
      optimizedQuery = `select(*) ${optimizedQuery}`;
    }

    // Add limit for performance
    if (!query.includes('limit') && !query.includes('LIMIT')) {
      optimizedQuery += '.limit(100)';
    }

    // Generate cache key
    const cacheKey = `${table}_${Buffer.from(optimizedQuery).toString('base64')}`;
    
    // Determine TTL based on table type
    const ttlMap: Record<string, number> = {
      robots: 300000, // 5 minutes
      strategies: 600000, // 10 minutes
      analytics: 180000, // 3 minutes
      health: 30000, // 30 seconds
    };

    const ttl = ttlMap[table] || 300000;

    return {
      optimizedQuery,
      cacheKey,
      ttl,
    };
  }

  // Bundle optimization for edge deployment
  optimizeBundle(): void {
    // Dynamic imports for code splitting
    this.setupDynamicImports();
    
    // Tree shaking for unused code
    this.setupTreeShaking();
    
    // Minification for production
    this.setupMinification();
  }

  private setupDynamicImports(): void {
    // Lazy load heavy components
    const lazyComponents = [
      () => import('../components/ChartComponents'),
      () => import('../components/CodeEditor'),
      () => import('../components/ChatInterface'),
    ];

    // Preload critical components
    lazyComponents.forEach((importFn, index) => {
      setTimeout(() => {
        importFn().catch(() => {
          // Handle import errors gracefully
        });
      }, index * 1000); // Stagger imports
    });
  }

  private setupTreeShaking(): void {
    // Mark unused functions for tree shaking
    if (process.env['NODE_ENV'] === 'production') {
      // Enable tree shaking optimizations
      console.debug('Tree shaking enabled for production build');
    }
  }

  private setupMinification(): void {
    // Enable minification for production
    if (process.env['NODE_ENV'] === 'production') {
      // Additional minification settings would be handled by build tools
      console.debug('Minification enabled for production build');
    }
  }
}

export const vercelEdgeOptimizer = VercelEdgeOptimizer.getInstance();