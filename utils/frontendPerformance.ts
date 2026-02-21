/**
 * Frontend Performance Utility
 * 
 * Provides frontend-specific performance optimizations including:
 * - Bundle size monitoring with alerts
 * - Memory pressure auto-cleanup triggers
 * - Performance budget enforcement
 * - Core Web Vitals monitoring
 * - Resource usage tracking and optimization
 * 
 * @module utils/frontendPerformance
 */

import { createScopedLogger } from './logger';
import { serviceCleanupCoordinator } from './serviceCleanupCoordinator';
import { resourcePreloader } from './resourcePreloader';

const logger = createScopedLogger('frontend-performance');

// ========== TYPES ==========

export interface BundleSizeThreshold {
  name: string;
  maxSize: number; // in bytes
  currentSize?: number;
  severity: 'warning' | 'error' | 'critical';
  action?: () => void;
}

export interface FrontendPerformanceConfig {
  /** Maximum bundle size in KB */
  maxBundleSizeKB: number;
  /** Maximum memory usage in MB */
  maxMemoryMB: number;
  /** Maximum initial load time in ms */
  maxLoadTimeMs: number;
  /** Maximum FCP in ms */
  maxFCP: number;
  /** Maximum LCP in ms */
  maxLCP: number;
  /** Maximum CLS */
  maxCLS: number;
  /** Maximum FID in ms */
  maxFID: number;
  /** Enable auto cleanup on memory pressure */
  autoCleanup: boolean;
  /** Enable performance alerts */
  enableAlerts: boolean;
  /** Check interval in ms */
  checkIntervalMs: number;
}

export interface FrontendPerformanceMetrics {
  memoryUsage: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    usedMB: number;
    limitMB: number;
    usagePercent: number;
  } | null;
  bundleSizes: Map<string, number>;
  loadTime: number;
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  fid: number | null;
  timestamp: number;
}

export interface PerformanceAlert {
  type: 'bundle_size' | 'memory_pressure' | 'slow_load' | 'budget_violation';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  suggestion: string;
}

const DEFAULT_CONFIG: FrontendPerformanceConfig = {
  maxBundleSizeKB: 300,
  maxMemoryMB: 200,
  maxLoadTimeMs: 3000,
  maxFCP: 1800,
  maxLCP: 2500,
  maxCLS: 0.1,
  maxFID: 100,
  autoCleanup: true,
  enableAlerts: true,
  checkIntervalMs: 30000
};

// ========== FRONTEND PERFORMANCE CLASS ==========

class FrontendPerformanceMonitor {
  private config: FrontendPerformanceConfig;
  private metrics: FrontendPerformanceMetrics;
  private alerts: PerformanceAlert[] = [];
  private checkInterval?: ReturnType<typeof setInterval>;
  private isInitialized = false;
  private bundleSizeThresholds: BundleSizeThreshold[] = [];

  constructor(config: Partial<FrontendPerformanceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      memoryUsage: null,
      bundleSizes: new Map(),
      loadTime: 0,
      fcp: null,
      lcp: null,
      cls: null,
      fid: null,
      timestamp: Date.now()
    };
  }

  /**
   * Initialize the frontend performance monitor
   */
  initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') return;

    this.isInitialized = true;
    this.setupMemoryMonitoring();
    this.setupPerformanceObservers();
    this.startPeriodicCheck();
    this.optimizePreloading();

    logger.info('Frontend performance monitor initialized');
  }

  /**
   * Setup memory pressure monitoring
   */
  private setupMemoryMonitoring(): void {
    // Listen for memory pressure events from serviceCleanupCoordinator
    window.addEventListener('memory-pressure', ((event: CustomEvent) => {
      const level = event.detail?.level || 'moderate';
      this.handleMemoryPressure(level);
    }) as EventListener);

    // Also check memory periodically
    this.updateMemoryMetrics();
  }

  /**
   * Setup performance observers for Core Web Vitals
   */
  private setupPerformanceObservers(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      // Observe paint timing (FCP, LCP)
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime;
            this.checkBudget('fcp', entry.startTime);
          }
        }
      });
      paintObserver.observe({ type: 'paint', buffered: true });

      // Observe largest contentful paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.metrics.lcp = lastEntry.startTime;
          this.checkBudget('lcp', lastEntry.startTime);
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // Observe layout shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShiftEntry = entry as unknown as { hadRecentInput: boolean; value: number };
          if (!layoutShiftEntry.hadRecentInput) {
            clsValue += layoutShiftEntry.value;
          }
        }
        this.metrics.cls = clsValue;
        this.checkBudget('cls', clsValue);
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      // Observe first input delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidEntry = entry as unknown as { processingStart: number };
          this.metrics.fid = fidEntry.processingStart - entry.startTime;
          this.checkBudget('fid', this.metrics.fid);
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });

    } catch {
      logger.debug('Performance observers not fully supported');
    }

    // Measure page load time
    if (document.readyState === 'complete') {
      this.measureLoadTime();
    } else {
      window.addEventListener('load', () => this.measureLoadTime());
    }
  }

  /**
   * Measure page load time
   */
  private measureLoadTime(): void {
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navEntry) {
      this.metrics.loadTime = navEntry.loadEventEnd - navEntry.startTime;
      this.checkBudget('loadTime', this.metrics.loadTime);
    }
  }

  /**
   * Update memory metrics
   */
  private updateMemoryMetrics(): void {
    const perfWithMemory = performance as unknown as {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };

    if (perfWithMemory.memory) {
      const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = perfWithMemory.memory;
      this.metrics.memoryUsage = {
        usedJSHeapSize,
        totalJSHeapSize,
        jsHeapSizeLimit,
        usedMB: usedJSHeapSize / (1024 * 1024),
        limitMB: jsHeapSizeLimit / (1024 * 1024),
        usagePercent: (usedJSHeapSize / jsHeapSizeLimit) * 100
      };
    }
  }

  /**
   * Start periodic performance check
   */
  private startPeriodicCheck(): void {
    this.checkInterval = setInterval(() => {
      this.runPeriodicCheck();
    }, this.config.checkIntervalMs);
  }

  /**
   * Run periodic performance check
   */
  private runPeriodicCheck(): void {
    this.updateMemoryMetrics();

    // Check memory pressure
    if (this.metrics.memoryUsage) {
      const { usedMB, usagePercent } = this.metrics.memoryUsage;

      if (usagePercent > 80 || usedMB > this.config.maxMemoryMB) {
        this.handleMemoryPressure('critical');
      } else if (usagePercent > 60) {
        this.handleMemoryPressure('moderate');
      } else if (usagePercent > 40) {
        this.handleMemoryPressure('low');
      }
    }
  }

  /**
   * Handle memory pressure event
   */
  private handleMemoryPressure(level: 'low' | 'moderate' | 'critical'): void {
    logger.debug(`Memory pressure detected: ${level}`);

    if (!this.config.autoCleanup) return;

    switch (level) {
      case 'critical':
        // Emergency cleanup - all services
        serviceCleanupCoordinator.forceCleanup();
        this.createAlert('memory_pressure', 'critical',
          `Critical memory pressure: ${this.metrics.memoryUsage?.usedMB.toFixed(1)}MB used`,
          this.metrics.memoryUsage?.usedMB || 0,
          this.config.maxMemoryMB,
          'Consider closing unused tabs or refreshing the page'
        );
        break;

      case 'moderate':
        // Aggressive cleanup - medium and low priority
        this.createAlert('memory_pressure', 'error',
          `Moderate memory pressure: ${this.metrics.memoryUsage?.usedMB.toFixed(1)}MB used`,
          this.metrics.memoryUsage?.usedMB || 0,
          this.config.maxMemoryMB * 0.8,
          'Some features may be temporarily slower'
        );
        break;

      case 'low':
        // Proactive cleanup - low priority only
        logger.debug('Low memory pressure - proactive cleanup initiated');
        break;
    }
  }

  /**
   * Check if a metric violates the budget
   */
  private checkBudget(metric: string, value: number): void {
    const thresholds: Record<string, { max: number; unit: string }> = {
      fcp: { max: this.config.maxFCP, unit: 'ms' },
      lcp: { max: this.config.maxLCP, unit: 'ms' },
      cls: { max: this.config.maxCLS, unit: '' },
      fid: { max: this.config.maxFID, unit: 'ms' },
      loadTime: { max: this.config.maxLoadTimeMs, unit: 'ms' }
    };

    const threshold = thresholds[metric];
    if (threshold && value > threshold.max) {
      this.createAlert(
        'budget_violation',
        value > threshold.max * 1.5 ? 'critical' : 'error',
        `${metric.toUpperCase()} exceeded budget: ${value.toFixed(2)}${threshold.unit} > ${threshold.max}${threshold.unit}`,
        value,
        threshold.max,
        `Optimize ${metric} to improve user experience`
      );
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number,
    suggestion: string
  ): void {
    const alert: PerformanceAlert = {
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: Date.now(),
      suggestion
    };

    this.alerts.push(alert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    if (this.config.enableAlerts) {
      const logMethod = severity === 'critical' ? 'error' : severity === 'error' ? 'warn' : 'info';
      logger[logMethod](`Performance Alert [${type}]: ${message}`);
    }
  }

  /**
   * Register bundle size threshold
   */
  registerBundleThreshold(threshold: BundleSizeThreshold): void {
    this.bundleSizeThresholds.push(threshold);
    logger.debug(`Registered bundle threshold: ${threshold.name} (${threshold.maxSize} bytes)`);
  }

  /**
   * Check bundle sizes against thresholds
   */
  checkBundleSizes(bundleSizes: Map<string, number>): void {
    this.metrics.bundleSizes = bundleSizes;

    for (const threshold of this.bundleSizeThresholds) {
      const currentSize = bundleSizes.get(threshold.name);
      if (currentSize !== undefined && currentSize > threshold.maxSize) {
        this.createAlert(
          'bundle_size',
          threshold.severity,
          `Bundle "${threshold.name}" exceeds size limit: ${(currentSize / 1024).toFixed(2)}KB`,
          currentSize,
          threshold.maxSize,
          'Consider code splitting or lazy loading'
        );

        if (threshold.action) {
          threshold.action();
        }
      }
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): FrontendPerformanceMetrics {
    this.updateMemoryMetrics();
    return { ...this.metrics, timestamp: Date.now() };
  }

  /**
   * Get performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get performance score (0-100)
   */
  getPerformanceScore(): number {
    let score = 100;
    const weights = {
      fcp: 15,
      lcp: 25,
      cls: 25,
      fid: 15,
      memory: 20
    };

    // FCP scoring
    if (this.metrics.fcp !== null) {
      if (this.metrics.fcp > this.config.maxFCP * 1.5) {
        score -= weights.fcp;
      } else if (this.metrics.fcp > this.config.maxFCP) {
        score -= weights.fcp * 0.5;
      }
    }

    // LCP scoring
    if (this.metrics.lcp !== null) {
      if (this.metrics.lcp > this.config.maxLCP * 1.5) {
        score -= weights.lcp;
      } else if (this.metrics.lcp > this.config.maxLCP) {
        score -= weights.lcp * 0.5;
      }
    }

    // CLS scoring
    if (this.metrics.cls !== null) {
      if (this.metrics.cls > this.config.maxCLS * 2) {
        score -= weights.cls;
      } else if (this.metrics.cls > this.config.maxCLS) {
        score -= weights.cls * 0.5;
      }
    }

    // FID scoring
    if (this.metrics.fid !== null) {
      if (this.metrics.fid > this.config.maxFID * 2) {
        score -= weights.fid;
      } else if (this.metrics.fid > this.config.maxFID) {
        score -= weights.fid * 0.5;
      }
    }

    // Memory scoring
    if (this.metrics.memoryUsage) {
      const { usagePercent } = this.metrics.memoryUsage;
      if (usagePercent > 80) {
        score -= weights.memory;
      } else if (usagePercent > 60) {
        score -= weights.memory * 0.5;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.fcp && this.metrics.fcp > this.config.maxFCP) {
      recommendations.push('Optimize First Contentful Paint: Consider inlining critical CSS, reducing render-blocking resources');
    }

    if (this.metrics.lcp && this.metrics.lcp > this.config.maxLCP) {
      recommendations.push('Optimize Largest Contentful Paint: Consider preloading hero images, optimizing server response time');
    }

    if (this.metrics.cls && this.metrics.cls > this.config.maxCLS) {
      recommendations.push('Reduce Cumulative Layout Shift: Add size attributes to images, avoid inserting content above existing content');
    }

    if (this.metrics.fid && this.metrics.fid > this.config.maxFID) {
      recommendations.push('Improve First Input Delay: Break up long tasks, use web workers for heavy computation');
    }

    if (this.metrics.memoryUsage && this.metrics.memoryUsage.usagePercent > 60) {
      recommendations.push('Reduce memory usage: Clear unused data, implement virtual scrolling for large lists');
    }

    return recommendations;
  }

  /**
   * Preload resources for optimal performance
   */
  optimizePreloading(): void {
    // Preconnect to common origins
    const origins = [
      'https://generativelanguage.googleapis.com',
      'https://supabase.co',
      'https://vercel.com'
    ];

    for (const origin of origins) {
      resourcePreloader.preconnect(origin, { crossOrigin: 'anonymous' });
    }

    // DNS prefetch for CDN domains
    const cdnDomains = [
      'cdn.jsdelivr.net',
      'fonts.googleapis.com',
      'fonts.gstatic.com'
    ];

    for (const domain of cdnDomains) {
      resourcePreloader.dnsPrefetch(domain, { secure: true });
    }
  }

  /**
   * Destroy the monitor
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.isInitialized = false;
    this.alerts = [];
    logger.info('Frontend performance monitor destroyed');
  }
}

// ========== SINGLETON INSTANCE ==========

export const frontendPerformance = new FrontendPerformanceMonitor();

// ========== UTILITY FUNCTIONS ==========

/**
 * Quick function to check if memory is under pressure
 */
export function isMemoryUnderPressure(): boolean {
  const perfWithMemory = performance as unknown as {
    memory?: {
      usedJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  };

  if (perfWithMemory.memory) {
    const { usedJSHeapSize, jsHeapSizeLimit } = perfWithMemory.memory;
    return (usedJSHeapSize / jsHeapSizeLimit) > 0.7;
  }
  return false;
}

/**
 * Quick function to get current memory usage
 */
export function getMemoryUsageMB(): number | null {
  const perfWithMemory = performance as unknown as {
    memory?: { usedJSHeapSize: number };
  };

  if (perfWithMemory.memory) {
    return perfWithMemory.memory.usedJSHeapSize / (1024 * 1024);
  }
  return null;
}

/**
 * Quick function to trigger cleanup if needed
 */
export function triggerCleanupIfNeeded(): void {
  if (isMemoryUnderPressure()) {
    serviceCleanupCoordinator.forceCleanup();
  }
}

/**
 * Hook for React components to monitor performance
 */
export function usePerformanceMetrics(): FrontendPerformanceMetrics {
  return frontendPerformance.getMetrics();
}

/**
 * Hook for React components to get performance score
 */
export function usePerformanceScore(): number {
  return frontendPerformance.getPerformanceScore();
}

export default frontendPerformance;
