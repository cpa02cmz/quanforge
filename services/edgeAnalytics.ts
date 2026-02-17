/**
 * Advanced Edge Analytics Service
 * Provides comprehensive analytics and monitoring for edge deployment
 */

import { WindowWithVercel } from '../types/browser';
import { createScopedLogger } from '../utils/logger';
import { DELAY_CONSTANTS, SIZE_CONSTANTS } from './modularConstants';
import { ANALYTICS_CONFIG } from '../constants/config';
import { ID_GENERATION } from '../constants/modularConfig';

const logger = createScopedLogger('EdgeAnalytics');

interface EdgeAnalyticsConfig {
  enableRealTimeMetrics: boolean;
  enablePerformanceTracking: boolean;
  enableUserBehaviorTracking: boolean;
  enableErrorTracking: boolean;
  sampleRate: number;
  endpoint: string | undefined;
}

interface EdgeMetrics {
  timestamp: number;
  region: string;
  userAgent: string;
  url: string;
  loadTime: number;
  renderTime: number;
  cacheHitRate: number;
  errorCount: number;
  userInteractions: number;
  bandwidthUsage: number;
}

interface UserBehaviorData {
  sessionId: string;
  userId?: string;
  events: Array<{
    type: string;
    target: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
  }>;
  pageViews: number;
  timeOnPage: number;
  bounceRate: number;
}

interface PerformanceData {
  coreWebVitals: {
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
    fcp: number; // First Contentful Paint
    ttfb: number; // Time to First Byte
  };
  resourceTiming: Array<{
    name: string;
    duration: number;
    size: number;
    cached: boolean;
  }>;
  navigationTiming: {
    domContentLoaded: number;
    loadComplete: number;
    redirectTime: number;
    dnsTime: number;
    connectTime: number;
    requestTime: number;
    responseTime: number;
  };
}

class EdgeAnalytics {
  private static instance: EdgeAnalytics;
  private config: EdgeAnalyticsConfig;
  private metrics: EdgeMetrics[] = [];
  private userBehavior: Map<string, UserBehaviorData> = new Map();
  private performanceData: PerformanceData | null = null;
  private sessionId: string;
  private startTime: number;
  private observers: PerformanceObserver[] = [];

  // Timer references for cleanup
  private metricsInterval: ReturnType<typeof setInterval> | null = null;

  // Event listener references for cleanup
  private visibilityHandler: (() => void) | null = null;
  private clickHandler: ((event: MouseEvent) => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  private submitHandler: ((event: SubmitEvent) => void) | null = null;
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;
  private beforeUnloadHandler: (() => void) | null = null;

  // Scroll timeout for cleanup
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    this.config = {
      enableRealTimeMetrics: process.env['VITE_ENABLE_ANALYTICS'] === 'true',
      enablePerformanceTracking: process.env['VITE_ENABLE_PERFORMANCE_MONITORING'] === 'true',
      enableUserBehaviorTracking: true,
      enableErrorTracking: process.env['VITE_ENABLE_ERROR_REPORTING'] === 'true',
      sampleRate: ANALYTICS_CONFIG.DEFAULT_SAMPLE_RATE, // 10% sample rate
      endpoint: process.env['VITE_ANALYTICS_ENDPOINT'] || undefined
    };

    this.sessionId = this.generateSessionId();
    this.startTime = performance.now();
    
    this.initializeAnalytics();
  }

  static getInstance(): EdgeAnalytics {
    if (!EdgeAnalytics.instance) {
      EdgeAnalytics.instance = new EdgeAnalytics();
    }
    return EdgeAnalytics.instance;
  }

  private initializeAnalytics(): void {
    if (!this.shouldTrack()) return;

    // Initialize performance monitoring
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceMonitoring();
    }

    // Initialize user behavior tracking
    if (this.config.enableUserBehaviorTracking) {
      this.setupUserBehaviorTracking();
    }

    // Initialize error tracking
    if (this.config.enableErrorTracking) {
      this.setupErrorTracking();
    }

    // Setup periodic reporting
    this.setupPeriodicReporting();

    // Track page load
    this.trackPageLoad();
  }

  private shouldTrack(): boolean {
    // Sample rate based tracking
    return Math.random() < this.config.sampleRate;
  }

  private generateSessionId(): string {
    return `${ID_GENERATION.PREFIXES.SESSION}${ID_GENERATION.SEPARATOR}${Date.now()}${ID_GENERATION.SEPARATOR}${Math.random().toString(36).substr(2, ID_GENERATION.RANDOM.STANDARD)}`;
  }

  private setupPerformanceMonitoring(): void {
    try {
      // Core Web Vitals monitoring
      this.observeLCP();
      this.observeFID();
      this.observeCLS();
      this.observeFCP();
      this.observeTTFB();

      // Resource timing monitoring
      this.observeResourceTiming();

      // Navigation timing monitoring
      this.observeNavigationTiming();
    } catch (error: unknown) {
      logger.warn('Performance monitoring setup failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry | undefined;
        
        if (lastEntry) {
          this.updatePerformanceData('lcp', lastEntry.startTime);
        }
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('LCP observation failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: PerformanceEntry) => {
          const fidEntry = entry as PerformanceEntry & { processingStart?: number };
          if (fidEntry.processingStart) {
            this.updatePerformanceData('fid', fidEntry.processingStart - fidEntry.startTime);
          }
        });
      });
      
      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('FID observation failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private observeCLS(): void {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: PerformanceEntry) => {
          const clsEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!clsEntry.hadRecentInput) {
            clsValue += clsEntry.value || 0;
            this.updatePerformanceData('cls', clsValue);
          }
        });
      });
      
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('CLS observation failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private observeFCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        
        if (fcpEntry) {
          this.updatePerformanceData('fcp', fcpEntry.startTime);
        }
      });
      
      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('FCP observation failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private observeTTFB(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const navEntry = entries.find(entry => entry.entryType === 'navigation') as PerformanceNavigationTiming | undefined;
        
        if (navEntry && navEntry.responseStart) {
          this.updatePerformanceData('ttfb', navEntry.responseStart - navEntry.requestStart);
        }
      });
      
      observer.observe({ entryTypes: ['navigation'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('TTFB observation failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private observeResourceTiming(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry: PerformanceEntry) => {
          const resourceEntry = entry as PerformanceResourceTiming;
          const resourceData = {
            name: resourceEntry.name,
            duration: resourceEntry.duration,
            size: resourceEntry.transferSize || 0,
            cached: resourceEntry.transferSize === 0 && resourceEntry.decodedBodySize > 0
          };

          if (!this.performanceData) {
            this.performanceData = {
              coreWebVitals: { lcp: 0, fid: 0, cls: 0, fcp: 0, ttfb: 0 },
              resourceTiming: [],
              navigationTiming: {
                domContentLoaded: 0,
                loadComplete: 0,
                redirectTime: 0,
                dnsTime: 0,
                connectTime: 0,
                requestTime: 0,
                responseTime: 0
              }
            };
          }

          this.performanceData.resourceTiming.push(resourceData);
        });
      });
      
      observer.observe({ entryTypes: ['resource'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('Resource timing observation failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private observeNavigationTiming(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const navEntry = entries.find(entry => entry.entryType === 'navigation') as PerformanceNavigationTiming | undefined;
        
        if (navEntry) {
          // Use startTime as base for calculations (navigationStart equivalent)
          const navStart = navEntry.startTime;
          const navTiming = {
            domContentLoaded: navEntry.domContentLoadedEventEnd - navStart,
            loadComplete: navEntry.loadEventEnd - navStart,
            redirectTime: navEntry.redirectEnd - navEntry.redirectStart,
            dnsTime: navEntry.domainLookupEnd - navEntry.domainLookupStart,
            connectTime: navEntry.connectEnd - navEntry.connectStart,
            requestTime: navEntry.responseStart - navEntry.requestStart,
            responseTime: navEntry.responseEnd - navEntry.responseStart
          };

          if (!this.performanceData) {
            this.performanceData = {
              coreWebVitals: { lcp: 0, fid: 0, cls: 0, fcp: 0, ttfb: 0 },
              resourceTiming: [],
              navigationTiming: navTiming
            };
          } else {
            this.performanceData.navigationTiming = navTiming;
          }
        }
      });
      
      observer.observe({ entryTypes: ['navigation'] });
      this.observers.push(observer);
    } catch (error: unknown) {
      logger.warn('Navigation timing observation failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private updatePerformanceData(metric: keyof PerformanceData['coreWebVitals'], value: number): void {
    if (!this.performanceData) return;
    
    this.performanceData.coreWebVitals[metric] = value;
  }

  private setupUserBehaviorTracking(): void {
    // Track page visibility changes
    this.visibilityHandler = () => {
      this.trackUserInteraction('visibility_change', {
        hidden: document.hidden,
        timestamp: Date.now()
      });
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Track clicks
    this.clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      this.trackUserInteraction('click', {
        tagName: target.tagName,
        className: target.className,
        id: target.id,
        textContent: target.textContent?.substring(0, SIZE_CONSTANTS.STRING.SHORT)
      });
    };
    document.addEventListener('click', this.clickHandler);

    // Track scrolls with passive listener for better performance
    this.scrollHandler = () => {
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }
      this.scrollTimeout = setTimeout(() => {
        this.trackUserInteraction('scroll', {
          scrollY: window.scrollY,
          scrollX: window.scrollX,
          documentHeight: document.documentElement.scrollHeight
        });
      }, 100);
    };
    document.addEventListener('scroll', this.scrollHandler, { passive: true });

    // Track form interactions
    this.submitHandler = (event: SubmitEvent) => {
      const target = event.target as HTMLFormElement;
      this.trackUserInteraction('form_submit', {
        formId: target.id,
        formName: target.name,
        action: target.action
      });
    };
    document.addEventListener('submit', this.submitHandler);
  }

  private setupErrorTracking(): void {
    // Track JavaScript errors
    this.errorHandler = (event: ErrorEvent) => {
      this.trackError('javascript_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    };
    window.addEventListener('error', this.errorHandler);

    // Track promise rejections
    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      this.trackError('promise_rejection', {
        reason: event.reason,
        stack: event.reason?.stack
      });
    };
    window.addEventListener('unhandledrejection', this.rejectionHandler);

    // Track resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        // Type guard to safely get src or href
        let srcOrHref: string | undefined;
        if ('src' in target) {
          srcOrHref = (target as HTMLImageElement | HTMLScriptElement).src;
        } else if ('href' in target) {
          srcOrHref = (target as HTMLLinkElement | HTMLAnchorElement).href;
        }
        this.trackError('resource_error', {
          tagName: target.tagName,
          src: srcOrHref
        });
      }
    }, true);
  }

  private trackPageLoad(): void {
    const loadTime = performance.now() - this.startTime;
    
    this.recordMetric({
      timestamp: Date.now(),
      region: this.detectRegion(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      loadTime,
      renderTime: 0, // Will be updated after paint
      cacheHitRate: 0, // Will be calculated
      errorCount: 0,
      userInteractions: 0,
      bandwidthUsage: 0
    });
  }

  private trackUserInteraction(type: string, metadata: Record<string, unknown> & { tagName?: string }): void {
    if (!this.shouldTrack()) return;

    let behaviorData = this.userBehavior.get(this.sessionId);
    
    if (!behaviorData) {
      behaviorData = {
        sessionId: this.sessionId,
        events: [],
        pageViews: 0,
        timeOnPage: 0,
        bounceRate: 0
      };
      this.userBehavior.set(this.sessionId, behaviorData);
    }

    behaviorData.events.push({
      type,
      target: metadata.tagName || 'unknown',
      timestamp: Date.now(),
      metadata
    });

    // Update interaction count
    const latestMetric = this.metrics[this.metrics.length - 1];
    if (latestMetric) {
      latestMetric.userInteractions++;
    }
  }

  private trackError(type: string, metadata: Record<string, unknown>): void {
    if (!this.shouldTrack()) return;

    const latestMetric = this.metrics[this.metrics.length - 1];
    if (latestMetric) {
      latestMetric.errorCount++;
    }

    // Send error report immediately
    this.sendErrorReport(type, metadata);
  }

  private recordMetric(metric: EdgeMetrics): void {
    this.metrics.push(metric);
    
    // Keep only last 100 metrics in memory
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  private detectRegion(): string {
    // Detect region from various sources
    const cfRay = navigator.userAgent.includes('CF-RAY');
    const win = window as WindowWithVercel;
    const vercelRegion = win.__VERCEL_REGION__ || win.__VERCEL_REGION;
    
    if (vercelRegion) return vercelRegion;
    if (cfRay) return 'cloudflare';
    
    // Fallback to timezone-based detection
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone.includes('America')) return 'us';
    if (timezone.includes('Europe')) return 'eu';
    if (timezone.includes('Asia')) return 'asia';
    
    return 'unknown';
  }

  private setupPeriodicReporting(): void {
    // Report metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      this.reportMetrics();
    }, DELAY_CONSTANTS.POLLING.VERY_SLOW);

    // Report on page unload
    this.beforeUnloadHandler = () => {
      this.reportMetrics(true);
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private async reportMetrics(isFinal = false): Promise<void> {
    if (!this.config.endpoint || this.metrics.length === 0) return;

    const report = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      isFinal,
      metrics: this.metrics.slice(),
      userBehavior: Array.from(this.userBehavior.values()),
      performanceData: this.performanceData,
      region: this.detectRegion(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Edge-Analytics': 'true'
        },
        body: JSON.stringify(report)
      });

      // Clear reported metrics if not final
      if (!isFinal) {
        this.metrics = [];
      }
    } catch (error: unknown) {
      logger.warn('Failed to report analytics:', error instanceof Error ? error.message : String(error));
    }
  }

  private async sendErrorReport(type: string, metadata: Record<string, unknown>): Promise<void> {
    if (!this.config.endpoint) return;

    const errorReport = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      type,
      metadata,
      url: window.location.href,
      userAgent: navigator.userAgent,
      region: this.detectRegion()
    };

    try {
      await fetch(`${this.config.endpoint}/error`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Edge-Error': 'true'
        },
        body: JSON.stringify(errorReport)
      });
    } catch (error: unknown) {
      logger.warn('Failed to report error:', error instanceof Error ? error.message : String(error));
    }
  }

  // Public API methods
  public trackCustomEvent(name: string, data: Record<string, unknown>): void {
    this.trackUserInteraction(`custom_${name}`, data);
  }

  public trackConversion(type: string, value?: number): void {
    this.trackUserInteraction('conversion', {
      type,
      value,
      timestamp: Date.now()
    });
  }

  public getPerformanceMetrics(): PerformanceData | null {
    return this.performanceData;
  }

  public getUserBehavior(): UserBehaviorData[] {
    return Array.from(this.userBehavior.values());
  }

  public getEdgeMetrics(): EdgeMetrics[] {
    return this.metrics;
  }

  public updateConfig(newConfig: Partial<EdgeAnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public destroy(): void {
    // Disconnect all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    // Clear interval
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    // Clear scroll timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }

    // Remove all event listeners
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
    if (this.scrollHandler) {
      document.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
    if (this.submitHandler) {
      document.removeEventListener('submit', this.submitHandler);
      this.submitHandler = null;
    }
    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler);
      this.errorHandler = null;
    }
    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = null;
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    // Send final report
    this.reportMetrics(true);
  }
}

export const edgeAnalytics = EdgeAnalytics.getInstance();

// Export types for external use
export type {
  EdgeAnalyticsConfig,
  EdgeMetrics,
  UserBehaviorData,
  PerformanceData
};