/**
 * Real User Monitoring (RUM) Service
 * Monitors real user performance and experience metrics
 */

interface WebVitals {
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  FCP?: number; // First Contentful Paint
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
}

interface UserMetrics {
  sessionId: string;
  userId?: string;
  url: string;
  userAgent: string;
  timestamp: number;
  vitals: WebVitals;
  customMetrics: Record<string, number>;
  errors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
    type: 'javascript' | 'network' | 'resource';
  }>;
  performance: {
    navigationStart: number;
    loadEventEnd?: number;
    domContentLoaded?: number;
    resourceTiming: PerformanceResourceTiming[];
  };
  geo?: {
    country?: string;
    region?: string;
    city?: string;
  };
  device: {
    type: 'mobile' | 'tablet' | 'desktop';
    screenSize: { width: number; height: number };
    viewport: { width: number; height: number };
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
    };
  };
}

interface RUMConfig {
  sampleRate: number;
  endpoint?: string;
  apiKey?: string;
  maxErrors: number;
  maxMetrics: number;
  batchSize: number;
  flushInterval: number;
  enableWebVitals: boolean;
  enableErrorTracking: boolean;
  enableResourceTiming: boolean;
  enableGeoTracking: boolean;
}

class RealUserMonitoring {
  private static instance: RealUserMonitoring;
  private config: RUMConfig = {
    sampleRate: 0.1, // 10% sampling
    maxErrors: 50,
    maxMetrics: 100,
    batchSize: 10,
    flushInterval: 30000, // 30 seconds
    enableWebVitals: true,
    enableErrorTracking: true,
    enableResourceTiming: true,
    enableGeoTracking: true
  };
  private sessionId: string;
  private metrics: UserMetrics[] = [];
  private currentMetrics: UserMetrics;
  private observers: PerformanceObserver[] = [];
  private flushTimer: number | null = null;
  private isInitialized = false;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.currentMetrics = this.initializeMetrics();
  }

  static getInstance(): RealUserMonitoring {
    if (!RealUserMonitoring.instance) {
      RealUserMonitoring.instance = new RealUserMonitoring();
    }
    return RealUserMonitoring.instance;
  }

  /**
   * Initialize RUM monitoring
   */
  async initialize(config: Partial<RUMConfig> = {}): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.config = { ...this.config, ...config };

    // Check if this session should be sampled
    if (Math.random() > this.config.sampleRate) {
      console.debug('RUM: Session not sampled');
      return;
    }

    try {
      if (this.config.enableWebVitals) {
        this.initializeWebVitals();
      }

      if (this.config.enableErrorTracking) {
        this.initializeErrorTracking();
      }

      if (this.config.enableResourceTiming) {
        this.initializeResourceTiming();
      }

      this.initializePageTracking();
      this.startFlushTimer();

      this.isInitialized = true;
      console.debug('RUM: Initialized successfully');
    } catch (error) {
      console.error('RUM: Initialization failed:', error);
    }
  }

  /**
   * Initialize Web Vitals monitoring
   */
  private initializeWebVitals(): void {
    // Largest Contentful Paint (LCP)
    this.observePerformanceEntry('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1];
      this.currentMetrics.vitals.LCP = lastEntry.startTime;
    });

    // First Input Delay (FID) and Interaction to Next Paint (INP)
    this.observePerformanceEntry('first-input', (entries) => {
      const entry = entries[0];
      this.currentMetrics.vitals.FID = entry.processingStart - entry.startTime;
    });

    this.observePerformanceEntry('event', (entries) => {
      const entry = entries[entries.length - 1];
      if (entry.interactionId) {
        this.currentMetrics.vitals.INP = entry.processingStart - entry.startTime;
      }
    });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    this.observePerformanceEntry('layout-shift', (entries) => {
      for (const entry of entries) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      this.currentMetrics.vitals.CLS = clsValue;
    });

    // First Contentful Paint (FCP)
    this.observePerformanceEntry('paint', (entries) => {
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        this.currentMetrics.vitals.FCP = fcpEntry.startTime;
      }
    });

    // Time to First Byte (TTFB)
    this.observeNavigation();
  }

  /**
   * Initialize error tracking
   */
  private initializeErrorTracking(): void {
    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.trackError({
        message: event.message,
        stack: event.error?.stack,
        timestamp: Date.now(),
        type: 'javascript'
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        timestamp: Date.now(),
        type: 'javascript'
      });
    });

    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        this.trackError({
          message: `Failed to load ${target.tagName}`,
          stack: `Resource: ${target.getAttribute('src') || target.getAttribute('href')}`,
          timestamp: Date.now(),
          type: 'resource'
        });
      }
    }, true);
  }

  /**
   * Initialize resource timing monitoring
   */
  private initializeResourceTiming(): void {
    this.observePerformanceEntry('resource', (entries) => {
      this.currentMetrics.performance.resourceTiming.push(...entries);
    });
  }

  /**
   * Initialize page tracking
   */
  private initializePageTracking(): void {
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushMetrics();
      }
    });

    // Track page unload
    window.addEventListener('beforeunload', () => {
      this.flushMetrics(true);
    });

    // Track navigation timing
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
        const nav = navigationEntries[0];
        this.currentMetrics.performance.navigationStart = nav.navigationStart;
        this.currentMetrics.performance.domContentLoaded = nav.domContentLoadedEventEnd - nav.navigationStart;
        this.currentMetrics.performance.loadEventEnd = nav.loadEventEnd - nav.navigationStart;
      }
    }
  }

  /**
   * Observe performance entries
   */
  private observePerformanceEntry(
    type: string,
    callback: (entries: any[]) => void
  ): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      
      observer.observe({ type, buffered: true });
      this.observers.push(observer);
    } catch (error) {
      console.warn(`RUM: Failed to observe ${type}:`, error);
    }
  }

  /**
   * Observe navigation timing for TTFB
   */
  private observeNavigation(): void {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
        const nav = navigationEntries[0];
        this.currentMetrics.vitals.TTFB = nav.responseStart - nav.requestStart;
      }
    }
  }

  /**
   * Initialize metrics object
   */
  private initializeMetrics(): UserMetrics {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    return {
      sessionId: this.sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      vitals: {},
      customMetrics: {},
      errors: [],
      performance: {
        navigationStart: performance.now(),
        resourceTiming: []
      },
      device: {
        type: this.getDeviceType(),
        screenSize: {
          width: screen.width,
          height: screen.height
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        connection: connection ? {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        } : undefined
      }
    };
  }

  /**
   * Get device type based on user agent
   */
  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      return 'mobile';
    }
    if (/tablet|ipad|android(?!.*mobile)/i.test(ua)) {
      return 'tablet';
    }
    return 'desktop';
  }

  /**
   * Track custom metric
   */
  trackMetric(name: string, value: number): void {
    if (!this.isInitialized) {
      return;
    }

    this.currentMetrics.customMetrics[name] = value;
  }

  /**
   * Track error
   */
  private trackError(error: {
    message: string;
    stack?: string;
    timestamp: number;
    type: 'javascript' | 'network' | 'resource';
  }): void {
    if (!this.isInitialized || this.currentMetrics.errors.length >= this.config.maxErrors) {
      return;
    }

    this.currentMetrics.errors.push(error);
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = window.setInterval(() => {
      this.flushMetrics();
    }, this.config.flushInterval);
  }

  /**
   * Flush metrics to endpoint
   */
  private async flushMetrics(isSync = false): Promise<void> {
    if (!this.isInitialized || this.metrics.length === 0) {
      return;
    }

    const metricsToSend = this.metrics.splice(0, this.config.batchSize);
    
    if (this.config.endpoint) {
      try {
        if (isSync && navigator.sendBeacon) {
          // Use sendBeacon for synchronous requests (page unload)
          navigator.sendBeacon(
            this.config.endpoint,
            JSON.stringify({
              metrics: metricsToSend,
              apiKey: this.config.apiKey
            })
          );
        } else {
          // Regular fetch for async requests
          await fetch(this.config.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              metrics: metricsToSend,
              apiKey: this.config.apiKey
            }),
            keepalive: isSync
          });
        }
        
        console.debug(`RUM: Flushed ${metricsToSend.length} metrics`);
      } catch (error) {
        console.error('RUM: Failed to flush metrics:', error);
        // Re-add metrics to queue on failure
        this.metrics.unshift(...metricsToSend);
      }
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `rum_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): UserMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    vitals: WebVitals;
    customMetrics: Record<string, number>;
    errorCount: number;
    resourceCount: number;
  } {
    return {
      vitals: this.currentMetrics.vitals,
      customMetrics: this.currentMetrics.customMetrics,
      errorCount: this.currentMetrics.errors.length,
      resourceCount: this.currentMetrics.performance.resourceTiming.length
    };
  }

  /**
   * Check if performance is good based on Web Vitals thresholds
   */
  isPerformanceGood(): boolean {
    const { vitals } = this.currentMetrics;
    const thresholds = {
      LCP: 2500,
      FID: 100,
      CLS: 0.1,
      FCP: 1800,
      TTFB: 800,
      INP: 200
    };

    return Object.entries(thresholds).every(([metric, threshold]) => {
      const value = vitals[metric as keyof WebVitals];
      return value === undefined || value <= threshold;
    });
  }

  /**
   * Get performance grade
   */
  getPerformanceGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    const { vitals } = this.currentMetrics;
    const thresholds = {
      LCP: [2500, 4000],
      FID: [100, 300],
      CLS: [0.1, 0.25],
      FCP: [1800, 3000],
      TTFB: [800, 1800],
      INP: [200, 500]
    };

    let score = 0;
    let totalMetrics = 0;

    for (const [metric, [good, poor]] of Object.entries(thresholds)) {
      const value = vitals[metric as keyof WebVitals];
      if (value !== undefined) {
        totalMetrics++;
        if (value <= good) {
          score += 100;
        } else if (value <= poor) {
          score += 50;
        } else {
          score += 0;
        }
      }
    }

    if (totalMetrics === 0) return 'A';
    
    const averageScore = score / totalMetrics;
    
    if (averageScore >= 90) return 'A';
    if (averageScore >= 80) return 'B';
    if (averageScore >= 70) return 'C';
    if (averageScore >= 60) return 'D';
    return 'F';
  }

  /**
   * Configure RUM settings
   */
  configure(config: Partial<RUMConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('RUM configuration updated:', this.config);
  }

  /**
   * Destroy RUM instance
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    this.flushMetrics();
    this.isInitialized = false;
  }
}

export const realUserMonitoring = RealUserMonitoring.getInstance();

// Utility functions for common use cases
export const trackCustomEvent = (name: string, value: number): void => {
  realUserMonitoring.trackMetric(`event_${name}`, value);
};

export const trackUserInteraction = (action: string, element: string): void => {
  realUserMonitoring.trackMetric(`interaction_${action}_${element}`, Date.now());
};

export const trackApiCall = (endpoint: string, duration: number, success: boolean): void => {
  realUserMonitoring.trackMetric(`api_${endpoint}_duration`, duration);
  realUserMonitoring.trackMetric(`api_${endpoint}_success`, success ? 1 : 0);
};

export const getPerformanceInsights = (): {
  grade: string;
  isGood: boolean;
  vitals: WebVitals;
  recommendations: string[];
} => {
  const rum = realUserMonitoring;
  const grade = rum.getPerformanceGrade();
  const isGood = rum.isPerformanceGood();
  const { vitals } = rum.getCurrentMetrics();
  
  const recommendations: string[] = [];
  
  if (vitals.LCP && vitals.LCP > 2500) {
    recommendations.push('Optimize largest contentful paint by reducing image sizes and server response time');
  }
  
  if (vitals.FID && vitals.FID > 100) {
    recommendations.push('Reduce first input delay by minimizing JavaScript execution time');
  }
  
  if (vitals.CLS && vitals.CLS > 0.1) {
    recommendations.push('Reduce cumulative layout shift by specifying image dimensions and avoiding insertions');
  }
  
  if (vitals.FCP && vitals.FCP > 1800) {
    recommendations.push('Improve first contentful paint by optimizing server response and render-blocking resources');
  }
  
  if (vitals.TTFB && vitals.TTFB > 800) {
    recommendations.push('Reduce time to first byte by optimizing server performance and using CDN');
  }

  return {
    grade,
    isGood,
    vitals,
    recommendations
  };
};