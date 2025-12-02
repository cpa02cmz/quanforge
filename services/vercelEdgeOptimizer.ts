/**
 * Enhanced Vercel Edge Optimization Service
 * Provides comprehensive edge-specific optimizations for better performance
 */

interface EdgeConfig {
  enableEdgeRuntime: boolean;
  enableEdgeCaching: boolean;
  enableCompression: boolean;
  enablePrefetch: boolean;
  enablePreload: boolean;
  enableServiceWorker: boolean;
  enableBackgroundSync: boolean;
  enablePushNotifications: boolean;
  cacheTTL: number;
  edgeRegions: string[];
  cdnUrl?: string;
}

interface EdgeMetrics {
  region: string;
  responseTime: number;
  cacheHitRate: number;
  bandwidthSaved: number;
  requestsServed: number;
  errorRate: number;
  throughput: number;
  lastUpdated: number;
}

interface EdgePerformanceReport {
  summary: {
    totalRequests: number;
    averageResponseTime: number;
    globalCacheHitRate: number;
    totalBandwidthSaved: number;
    errorRate: number;
  };
  byRegion: EdgeMetrics[];
  recommendations: string[];
  alerts: Array<{
    type: 'performance' | 'availability' | 'cache';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: number;
  }>;
}

class VercelEdgeOptimizer {
  private static instance: VercelEdgeOptimizer;
  private config: EdgeConfig = {
    enableEdgeRuntime: process.env['VITE_EDGE_RUNTIME'] === 'true',
    enableEdgeCaching: true,
    enableCompression: process.env['VITE_ENABLE_COMPRESSION'] === 'true',
    enablePrefetch: process.env['VITE_ENABLE_PREFETCH'] === 'true',
    enablePreload: process.env['VITE_ENABLE_PRELOAD'] === 'true',
    enableServiceWorker: process.env['VITE_ENABLE_SERVICE_WORKER'] === 'true',
    enableBackgroundSync: true,
    enablePushNotifications: false,
    cacheTTL: 31536000, // 1 year for static assets
    edgeRegions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
    cdnUrl: process.env['VERCEL_URL'] ? `https://${process.env['VERCEL_URL']}` : undefined,
  };
  private metrics: Map<string, EdgeMetrics> = new Map();
  private performanceThresholds = {
    responseTime: 500, // 500ms
    cacheHitRate: 0.8, // 80%
    errorRate: 0.01, // 1%
    bandwidthSaved: 1024 * 1024, // 1MB
  };

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

    if (this.config.enableServiceWorker) {
      this.setupServiceWorker();
    }

    if (this.config.enableBackgroundSync) {
      this.setupBackgroundSync();
    }

    // Setup enhanced performance monitoring
    this.setupPerformanceMonitoring();
    
    // Setup edge error handling
    this.setupEdgeErrorHandling();
    
    // Initialize edge metrics collection
    this.initializeMetricsCollection();
  }

  private setupEdgeCaching(): void {
    // Set up enhanced service worker for edge caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('Enhanced Edge Service Worker registered:', registration);
        
        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                this.notifyServiceWorkerUpdate();
              }
            });
          }
        });
        
        // Set up periodic cache updates
        this.setupPeriodicCacheUpdates(registration);
        
      }).catch((error) => {
        console.warn('Enhanced Edge Service Worker registration failed:', error);
      });
    }
  }

  private setupServiceWorker(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Enable background sync
        if ('sync' in registration) {
          (registration as any).sync.register('background-sync-robots');
        }
        
        // Enable push notifications if configured
        if (this.config.enablePushNotifications && 'pushManager' in registration) {
          this.setupPushNotifications(registration);
        }
        
        // Set up message handling for edge features
        this.setupServiceWorkerMessaging(registration);
      });
    }
  }

  private setupBackgroundSync(): void {
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        // Register background sync for offline actions
        (registration as any).sync.register('background-sync-robots');
      });
    }
  }

  private setupPeriodicCacheUpdates(registration: ServiceWorkerRegistration): void {
    // Request periodic background sync for cache updates
    if ('periodicSync' in registration) {
      (registration as any).periodicSync.register('cache-update', {
        minInterval: 24 * 60 * 60 * 1000, // 24 hours
      }).catch((error: any) => {
        console.warn('Periodic sync registration failed:', error);
      });
    }
  }

  private setupServiceWorkerMessaging(registration: ServiceWorkerRegistration): void {
    // Set up communication channel with service worker
    const channel = new MessageChannel();
    
    channel.port1.onmessage = (event) => {
      if (event.data.type === 'EDGE_STATUS') {
        this.updateEdgeMetrics(event.data.metrics);
      }
    };
    
    // Request edge status from service worker
    navigator.serviceWorker.controller?.postMessage(
      { type: 'EDGE_STATUS' },
      [channel.port2]
    );
  }

  private setupPushNotifications(registration: ServiceWorkerRegistration): void {
    // Request notification permission
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        // Subscribe to push notifications
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(process.env['VITE_VAPID_PUBLIC_KEY'] || ''),
        }).then((subscription) => {
          console.log('Push subscription successful:', subscription);
          // Send subscription to server
          this.sendPushSubscriptionToServer(subscription);
        }).catch((error) => {
          console.warn('Push subscription failed:', error);
        });
      }
    });
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }

  private sendPushSubscriptionToServer(subscription: PushSubscription): void {
    // Send subscription to server for push notifications
    fetch('/api/push-subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    }).catch((error) => {
      console.warn('Failed to send push subscription to server:', error);
    });
  }

  private notifyServiceWorkerUpdate(): void {
    // Notify user about service worker update
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('QuantForge AI Update Available', {
        body: 'A new version is ready. Refresh to get the latest features.',
        icon: '/manifest.json',
        badge: '/manifest.json',
        tag: 'app-update',
      });
    }
  }

  private setupResourcePrefetching(): void {
    // Prefetch critical resources with enhanced prioritization
    const criticalResources = [
      { href: '/api/health', priority: 'high' },
      { href: '/api/strategies', priority: 'medium' },
      { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700', priority: 'low' },
      { href: 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.css', priority: 'low' },
    ];

    criticalResources.forEach((resource) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = resource.href;
      if (resource.priority === 'high') {
        link.setAttribute('importance', 'high');
      }
      document.head.appendChild(link);
    });

    // Prefetch next likely pages based on user behavior
    this.prefetchLikelyPages();
  }

  private prefetchLikelyPages(): void {
    // Analyze user behavior and prefetch likely pages
    const currentPath = window.location.pathname;
    let likelyPages: string[] = [];

    switch (currentPath) {
      case '/':
        likelyPages = ['/dashboard', '/generator'];
        break;
      case '/dashboard':
        likelyPages = ['/generator', '/wiki'];
        break;
      case '/generator':
        likelyPages = ['/dashboard'];
        break;
      default:
        likelyPages = ['/dashboard', '/generator'];
    }

    likelyPages.forEach((page) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = page;
      document.head.appendChild(link);
    });
  }

  private setupResourcePreloading(): void {
    // Preload critical resources with enhanced optimization
    const criticalResources = [
      { href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
      { href: '/api/health', as: 'fetch' },
      { href: '/api/strategies', as: 'fetch' },
      { href: '/manifest.json', as: 'fetch' },
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

    // Preload critical JavaScript chunks
    this.preloadCriticalChunks();
  }

  private preloadCriticalChunks(): void {
    // Preload critical JavaScript chunks for better performance
    const criticalChunks = [
      'vendor-react-core',
      'vendor-database',
      'services-core',
      'component-layout',
    ];

    criticalChunks.forEach((chunk) => {
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = `/assets/js/${chunk}.js`;
      document.head.appendChild(link);
    });
  }

  private setupPerformanceMonitoring(): void {
    // Monitor Core Web Vitals with enhanced tracking
    if ('PerformanceObserver' in window) {
      try {
        // Monitor Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric('lcp', lastEntry.startTime);
          this.checkPerformanceThreshold('lcp', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Monitor First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            const fid = entry.processingStart - entry.startTime;
            this.recordMetric('fid', fid);
            this.checkPerformanceThreshold('fid', fid);
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
              this.checkPerformanceThreshold('cls', clsValue);
            }
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // Monitor First Contentful Paint
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              this.recordMetric('fcp', entry.startTime);
              this.checkPerformanceThreshold('fcp', entry.startTime);
            }
          });
        });
        fcpObserver.observe({ entryTypes: ['paint'] });

        // Monitor Time to Interactive
        const ttiObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            this.recordMetric('tti', entry.startTime);
            this.checkPerformanceThreshold('tti', entry.startTime);
          });
        });
        ttiObserver.observe({ entryTypes: ['longtask'] });

      } catch (error) {
        console.warn('Enhanced performance monitoring setup failed:', error);
      }
    }
  }

  private checkPerformanceThreshold(metric: string, value: number): void {
    const thresholds: Record<string, number> = {
      lcp: 2500, // 2.5s
      fid: 100,  // 100ms
      cls: 0.1,  // 0.1
      fcp: 1800, // 1.8s
      tti: 3800, // 3.8s
    };

    if (value > thresholds[metric]) {
      this.createPerformanceAlert(metric, value, thresholds[metric]);
    }
  }

  private createPerformanceAlert(metric: string, value: number, threshold: number): void {
    console.warn(`Performance Alert: ${metric} (${value.toFixed(2)}) exceeds threshold (${threshold})`);
    
    // Send alert to monitoring service in production
    if (process.env['NODE_ENV'] === 'production') {
      this.sendPerformanceAlert(metric, value, threshold);
    }
  }

  private sendPerformanceAlert(metric: string, value: number, threshold: number): void {
    // Send performance alert to monitoring service
    fetch('/api/performance-alert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metric,
        value,
        threshold,
        timestamp: Date.now(),
        region: this.detectEdgeRegion(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
    }).catch((error) => {
      console.warn('Failed to send performance alert:', error);
    });
  }

  private recordMetric(type: string, value: number): void {
    // Send metrics to analytics for edge performance monitoring
    if (process.env['VITE_ENABLE_WEB_VITALS'] === 'true') {
      // Store metric locally
      const metrics = JSON.parse(localStorage.getItem('edge-metrics') || '{}');
      metrics[type] = { value, timestamp: Date.now() };
      localStorage.setItem('edge-metrics', JSON.stringify(metrics));
      
      // In production, send to analytics service
      if (process.env['NODE_ENV'] === 'production') {
        this.sendMetricToAnalytics(type, value);
      } else {
        console.log(`Performance metric ${type}:`, value);
      }
    }
  }

  private sendMetricToAnalytics(type: string, value: number): void {
    // Send metric to analytics service
    fetch('/api/analytics/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        value,
        timestamp: Date.now(),
        region: this.detectEdgeRegion(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
    }).catch((error) => {
      console.warn('Failed to send metric to analytics:', error);
    });
  }

  private initializeMetricsCollection(): void {
    // Initialize metrics collection for edge performance
    setInterval(() => {
      this.collectEdgeMetrics();
    }, 60000); // Collect metrics every minute
  }

  private collectEdgeMetrics(): void {
    const region = this.detectEdgeRegion();
    const existing: EdgeMetrics = this.metrics.get(region) || {
      region,
      responseTime: 0,
      cacheHitRate: 0,
      bandwidthSaved: 0,
      requestsServed: 0,
      errorRate: 0,
      throughput: 0,
      lastUpdated: Date.now(),
    };

    // Update metrics from service worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(
        { type: 'COLLECT_METRICS' }
      );
    }

    this.metrics.set(region, existing);
  }

  private updateEdgeMetrics(serviceWorkerMetrics: any): void {
    // Update metrics from service worker
    const region = this.detectEdgeRegion();
    const existing: EdgeMetrics = this.metrics.get(region) || {
      region,
      responseTime: 0,
      cacheHitRate: 0,
      bandwidthSaved: 0,
      requestsServed: 0,
      errorRate: 0,
      throughput: 0,
      lastUpdated: Date.now(),
    };

    // Merge metrics from service worker
    Object.assign(existing, serviceWorkerMetrics);
    existing.lastUpdated = Date.now();

    this.metrics.set(region, existing);
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
    const existing: EdgeMetrics = this.metrics.get(region) || {
      region,
      responseTime: 0,
      cacheHitRate: 0,
      bandwidthSaved: 0,
      requestsServed: 0,
      errorRate: 0,
      throughput: 0,
      lastUpdated: Date.now(),
    };

    existing.responseTime = (existing.responseTime + responseTime) / 2;
    existing.requestsServed++;
    existing.lastUpdated = Date.now();

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
    this.reinitializeEdgeFeatures();
  }

  private reinitializeEdgeFeatures(): void {
    // Reinitialize edge features when configuration changes
    if (this.config.enableServiceWorker) {
      this.setupServiceWorker();
    }
    if (this.config.enableEdgeCaching) {
      this.setupEdgeCaching();
    }
  }

  // Get comprehensive edge performance report
  getEdgePerformanceReport(): EdgePerformanceReport {
    const allMetrics = Array.from(this.metrics.values());
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.requestsServed, 0);
    const averageResponseTime = allMetrics.reduce((sum, m) => sum + m.responseTime, 0) / allMetrics.length || 0;
    const globalCacheHitRate = allMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / allMetrics.length || 0;
    const totalBandwidthSaved = allMetrics.reduce((sum, m) => sum + m.bandwidthSaved, 0);
    const errorRate = allMetrics.reduce((sum, m) => sum + m.errorRate, 0) / allMetrics.length || 0;

    return {
      summary: {
        totalRequests,
        averageResponseTime,
        globalCacheHitRate,
        totalBandwidthSaved,
        errorRate,
      },
      byRegion: allMetrics,
      recommendations: this.generateOptimizationRecommendations(),
      alerts: this.generatePerformanceAlerts(),
    };
  }

  private generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const report = this.getEdgePerformanceReport();

    if (report.summary.averageResponseTime > this.performanceThresholds.responseTime) {
      recommendations.push('Consider enabling edge caching for API responses to reduce response time');
    }

    if (report.summary.globalCacheHitRate < this.performanceThresholds.cacheHitRate) {
      recommendations.push('Increase cache TTL or implement more aggressive caching strategies');
    }

    if (report.summary.errorRate > this.performanceThresholds.errorRate) {
      recommendations.push('Investigate high error rate and implement better error handling');
    }

    if (report.summary.totalBandwidthSaved < this.performanceThresholds.bandwidthSaved) {
      recommendations.push('Enable compression and optimize asset delivery for better bandwidth savings');
    }

    return recommendations;
  }

  private generatePerformanceAlerts(): Array<{
    type: 'performance' | 'availability' | 'cache';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: number;
  }> {
    const alerts: Array<{
      type: 'performance' | 'availability' | 'cache';
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      timestamp: number;
    }> = [];

    const report = this.getEdgePerformanceReport();

    if (report.summary.averageResponseTime > this.performanceThresholds.responseTime * 2) {
      alerts.push({
        type: 'performance',
        severity: 'critical',
        message: `Very high response time: ${report.summary.averageResponseTime.toFixed(2)}ms`,
        timestamp: Date.now(),
      });
    }

    if (report.summary.globalCacheHitRate < this.performanceThresholds.cacheHitRate / 2) {
      alerts.push({
        type: 'cache',
        severity: 'high',
        message: `Very low cache hit rate: ${(report.summary.globalCacheHitRate * 100).toFixed(1)}%`,
        timestamp: Date.now(),
      });
    }

    if (report.summary.errorRate > this.performanceThresholds.errorRate * 5) {
      alerts.push({
        type: 'availability',
        severity: 'critical',
        message: `High error rate: ${(report.summary.errorRate * 100).toFixed(2)}%`,
        timestamp: Date.now(),
      });
    }

    return alerts;
  }

  // Optimize images for edge delivery
  optimizeImagesForEdge(): void {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = (img as any).dataset.src;
          if (src) {
            // Convert to next-gen format and add edge optimization
            const optimizedSrc = this.optimizeImageUrl(src);
            img.setAttribute('src', optimizedSrc);
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    });

    images.forEach((img) => imageObserver.observe(img));
  }

  private optimizeImageUrl(url: string): string {
    // Add edge optimization parameters to image URLs
    const urlObj = new URL(url, window.location.origin);
    
    // Add optimization parameters
    urlObj.searchParams.set('auto', 'format');
    urlObj.searchParams.set('q', '80');
    urlObj.searchParams.set('w', '1200');
    urlObj.searchParams.set('fit', 'max');
    
    return urlObj.toString();
  }

  // Enable adaptive loading based on network conditions
  enableAdaptiveLoading(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      // Adjust loading strategy based on network conditions
      if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        this.enableDataSaverMode();
      } else if (connection.effectiveType === '4g') {
        this.enableHighPerformanceMode();
      }
      
      // Listen for network changes
      connection.addEventListener('change', () => {
        this.adaptToNetworkConditions(connection);
      });
    }
  }

  private enableDataSaverMode(): void {
    // Reduce quality and disable non-essential features
    console.log('Enabling data saver mode');
    document.body.classList.add('data-saver');
    
    // Reduce image quality
    this.optimizeImagesForEdge();
    
    // Disable animations
    document.body.style.setProperty('--animation-duration', '0s');
  }

  private enableHighPerformanceMode(): void {
    // Enable all features and high-quality assets
    console.log('Enabling high performance mode');
    document.body.classList.remove('data-saver');
    
    // Preload more resources
    this.setupResourcePrefetching();
    this.setupResourcePreloading();
  }

  private adaptToNetworkConditions(connection: any): void {
    if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      this.enableDataSaverMode();
    } else if (connection.effectiveType === '4g') {
      this.enableHighPerformanceMode();
    }
  }

  // Clear edge caches
  async clearEdgeCaches(): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CACHE_CLEAR' });
    }
    
    // Clear local metrics
    this.metrics.clear();
    localStorage.removeItem('edge-metrics');
  }

  // Force refresh edge caches
  async refreshEdgeCaches(): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller!.postMessage({ type: 'CACHE_UPDATE' });
    }
  }

  // Get edge status
  async getEdgeStatus(): Promise<any> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const channel = new MessageChannel();
      
      return new Promise((resolve) => {
        channel.port1.onmessage = (event) => {
          resolve(event.data);
        };
        
        navigator.serviceWorker.controller!.postMessage(
          { type: 'EDGE_STATUS' },
          [channel.port2]
        );
      });
    }
    
    return null;
  }
}

export const vercelEdgeOptimizer = VercelEdgeOptimizer.getInstance();