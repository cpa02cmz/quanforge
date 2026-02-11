/**
 * Consolidated Performance Module
 * Unified performance monitoring and optimization utilities
 */

import React from 'react';
import { PerformanceWithMemory } from '../types/browser';
import { TIME_CONSTANTS } from '../constants/config';

// ========== INTERFACES ==========

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

interface PageLoadMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

interface EdgeMetrics {
  region: string;
  functionName: string;
  duration: number;
  memoryUsage: number;
  coldStart: boolean;
  cacheHitRate: number;
  timestamp: number;
}

interface DatabaseMetrics {
  queryTime: number;
  cacheHitRate: number;
  connectionPoolUtilization: number;
  indexUsage: number;
  slowQueries: number;
  errorRate: number;
  throughput: number;
}

interface PerformanceThresholds {
  maxDuration: number;
  maxMemoryUsage: number;
  minCacheHitRate: number;
}

interface PerformanceAlert {
  type: 'slow_query' | 'high_error_rate' | 'connection_exhaustion' | 'cache_miss' | 'duration' | 'memory' | 'cold_start';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metadata: any;
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

// ========== CORE PERFORMANCE MONITOR ==========

class PerformanceCore {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private isSupported = typeof window !== 'undefined' && 'performance' in window;
  private maxMetrics = 50;

  constructor() {
    if (this.isSupported && import.meta.env.PROD) {
      this.initWebVitals();
      this.observePageLoad();
    }
  }

  // Core metric recording
  recordMetric(name: string, value: number): void {
    const metric: PerformanceMetric = { name, value, timestamp: Date.now() };
    this.metrics.push(metric);
    
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log in production for monitoring
    if (import.meta.env.PROD) {
      console.log(`Performance Metric [${name}]:`, value);
    }

    // Store critical metrics in localStorage
    if (['fcp', 'lcp', 'cls', 'fid', 'ttfb'].includes(name)) {
      try {
        const key = `perf_${name}`;
        localStorage.setItem(key, value.toString());
      } catch (_e) {
        // Ignore storage errors
      }
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // Web Vitals initialization
  private initWebVitals(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      this.setupFCPObserver();
      this.setupLCPObserver();
      this.setupCLSObserver();
      this.setupFIDObserver();
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('Performance monitoring not fully supported:', e);
      }
    }
  }

  private setupFCPObserver(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric('fcp', entry.startTime);
        }
      }
    });
    observer.observe({ entryTypes: ['paint'] });
    this.observers.push(observer);
  }

  private setupLCPObserver(): void {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        this.recordMetric('lcp', lastEntry.startTime);
      }
    });
    observer.observe({ entryTypes: ['largest-contentful-paint'] });
    this.observers.push(observer);
  }

  private setupCLSObserver(): void {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.recordMetric('cls', clsValue);
    });
    observer.observe({ entryTypes: ['layout-shift'] });
    this.observers.push(observer);
  }

  private setupFIDObserver(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric('fid', (entry as any).processingStart - entry.startTime);
      }
    });
    observer.observe({ entryTypes: ['first-input'] });
    this.observers.push(observer);
  }

  private observePageLoad(): void {
    if (this.isSupported) {
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.recordMetric('ttfb', navigation.responseStart - navigation.requestStart);
          this.recordMetric('pageLoad', navigation.loadEventEnd - navigation.fetchStart);
          this.recordMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart);
          this.recordMetric('window_load_time', navigation.loadEventEnd - navigation.fetchStart);
          this.recordMetric('first_byte_time', navigation.responseStart - navigation.requestStart);
        }
      });
    }
  }

  getWebVitals(): Partial<PageLoadMetrics> {
    const vitals: Partial<PageLoadMetrics> = {};
    
    this.metrics.forEach(metric => {
      switch (metric.name) {
        case 'fcp': vitals.fcp = metric.value; break;
        case 'lcp': vitals.lcp = metric.value; break;
        case 'fid': vitals.fid = metric.value; break;
        case 'cls': vitals.cls = metric.value; break;
        case 'ttfb': vitals.ttfb = metric.value; break;
      }
    });

    return vitals;
  }

  cleanup(): void {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (_e) {
        // Ignore errors during cleanup
      }
    });
    this.observers = [];
    this.metrics = [];
  }
}

// ========== TIMING UTILITIES ==========

class TimingUtilities {
  private core: PerformanceCore;

  constructor(core: PerformanceCore) {
    this.core = core;
  }

  // Generic interaction timing
  measureInteraction(name: string, fn: () => void | Promise<void>): Promise<void> | void {
    const start = performance.now();
    
    const result = fn();
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start;
        this.core.recordMetric(`interaction_${name}`, duration);
      });
    } else {
      const duration = performance.now() - start;
      this.core.recordMetric(`interaction_${name}`, duration);
    }
  }

  // API call timing with error tracking
  async measureApiCall<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    let success = true;
    let errorType: string | undefined;
    
    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      errorType = error instanceof Error ? error.constructor.name : typeof error;
      throw error;
    } finally {
      const duration = performance.now() - start;
      this.core.recordMetric(`api_${name}_duration`, duration);
      this.core.recordMetric(`api_${name}_success`, success ? 1 : 0);
      if (!success && errorType) {
        this.core.recordMetric(`api_${name}_error_${errorType}`, 1);
      }
      
      if (duration > TIME_CONSTANTS.SECOND) {
        console.warn(`Slow API call detected: ${name} took ${duration.toFixed(2)}ms`);
      }
    }
  }

  // Database operation timing
  async measureDbOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    let success = true;
    let errorType: string | undefined;
    let resultSize = 0;
    
    try {
      const result = await fn();
      if (Array.isArray(result)) {
        resultSize = result.length;
      } else if (result && typeof result === 'object') {
        resultSize = JSON.stringify(result).length;
      } else {
        resultSize = typeof result === 'string' ? result.length : 1;
      }
      return result;
    } catch (error) {
      success = false;
      errorType = error instanceof Error ? error.constructor.name : typeof error;
      throw error;
    } finally {
      const duration = performance.now() - start;
      this.core.recordMetric(`db_${name}_duration`, duration);
      this.core.recordMetric(`db_${name}_success`, success ? 1 : 0);
      this.core.recordMetric(`db_${name}_result_size`, resultSize);
      if (!success && errorType) {
        this.core.recordMetric(`db_${name}_error_${errorType}`, 1);
      }
      
      if (duration > TIME_CONSTANTS.SECOND / 2) {
        console.warn(`Slow DB operation detected: ${name} took ${duration.toFixed(2)}ms, result size: ${resultSize}`);
      }
    }
  }

  // Edge function timing
  async measureEdgeFunction<T>(
    name: string,
    fn: () => Promise<T>,
    options?: { region?: string; metadata?: Record<string, any> }
  ): Promise<T> {
    const startTime = performance.now();
    const region = options?.region || process.env['VERCEL_REGION'] || 'unknown';
    const coldStart = this.isColdStart();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      this.core.recordMetric(`edge_${name}_duration`, duration);
      this.core.recordMetric(`edge_${name}_memory`, this.getMemoryUsage());
      this.core.recordMetric(`edge_${name}_cold_start`, coldStart ? 1 : 0);
      
      if (import.meta.env.DEV && duration > TIME_CONSTANTS.SECOND) {
        console.warn(`Slow edge function ${name}: ${duration.toFixed(2)}ms in region ${region}`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.core.recordMetric(`edge_${name}_error_duration`, duration);
      console.error(`Edge function ${name} failed in region ${region} after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  private isColdStart(): boolean {
    return !(globalThis as any)._edgeFunctionInitialized;
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  // Performance marks
  startMark(name: string): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(`start_${name}`);
    }
  }

  endMark(name: string): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(`end_${name}`);
      performance.measure(name, `start_${name}`, `end_${name}`);
      
      const measure = performance.getEntriesByName(name)[0];
      if (measure) {
        this.core.recordMetric(`measure_${name}`, measure.duration);
      }
      
      performance.clearMarks(`start_${name}`);
      performance.clearMarks(`end_${name}`);
      performance.clearMeasures(name);
    }
  }
}

// ========== MEMORY UTILITIES ==========

class MemoryUtilities {
  private core: PerformanceCore;
  private monitoringInterval?: ReturnType<typeof setInterval>;

  constructor(core: PerformanceCore) {
    this.core = core;
  }

  // Memory usage snapshot
  captureMemorySnapshot(): void {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const perf = performance as PerformanceWithMemory;
      const memory = perf.memory;
      if (memory) {
        this.core.recordMetric('memory_used', memory.usedJSHeapSize);
        this.core.recordMetric('memory_total', memory.totalJSHeapSize);
        this.core.recordMetric('memory_limit', memory.jsHeapSizeLimit);
      }
    }
  }

  getMemoryUsage(): { used: number; total: number; limit: number; utilization: number } | null {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const perf = performance as PerformanceWithMemory;
      const memory = perf.memory;
      if (memory) {
        return {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
          utilization: memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100,
        };
      }
    }
    return null;
  }

  // Monitor memory usage over time
  monitorMemoryUsage(intervalMs: number = TIME_CONSTANTS.SECOND * 30): () => void {
    if (typeof window === 'undefined' || !('performance' in window) || !('memory' in performance)) {
      if (import.meta.env.DEV) {
        console.warn('Memory monitoring not supported in this environment');
      }
      return () => {};
    }

    this.monitoringInterval = setInterval(() => {
      const memory = this.getMemoryUsage();
      if (memory) {
        this.core.recordMetric('memory_used_bytes', memory.used);
        this.core.recordMetric('memory_utilization_percent', memory.utilization);
        
        if (memory.utilization > 80) {
          if (import.meta.env.DEV) {
            console.warn(`High memory usage detected: ${memory.utilization.toFixed(2)}%`);
          }
          this.core.recordMetric('high_memory_event', 1);
        }
        
        if (memory.utilization > 90) {
          this.performEmergencyCleanup();
        }
      }
    }, intervalMs);
    
    return () => {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
    };
  }

  private performEmergencyCleanup(): void {
    try {
      // Clear performance metrics history
      (this.core as any).metrics.length = 0;
      
      // Force garbage collection if available
      if ('gc' in globalThis) {
        (globalThis as any).gc();
      }
      
      console.warn('Emergency memory cleanup performed');
      this.core.recordMetric('emergency_cleanup', 1);
    } catch (error) {
      console.warn('Failed to perform emergency cleanup:', error);
    }
  }

  stopMemoryMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }
}

// ========== MONITORING INTEGRATION ==========

class EnhancedMonitor {
  private dbMetrics: DatabaseMetrics;
  private frontendMetrics: OptimizationMetrics;
  private queryHistory: Array<{ query: string; time: number; timestamp: number }>;

  constructor(private core: PerformanceCore) {
    this.dbMetrics = {
      queryTime: 0,
      cacheHitRate: 0,
      connectionPoolUtilization: 0,
      indexUsage: 0,
      slowQueries: 0,
      errorRate: 0,
      throughput: 0,
    };
    this.frontendMetrics = {
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
    this.queryHistory = [];
  }

  // Database monitoring
  recordQuery(query: string, executionTime: number, success: boolean): void {
    this.queryHistory.push({
      query: this.sanitizeQuery(query),
      time: executionTime,
      timestamp: Date.now(),
    });

    if (this.queryHistory.length > 1000) {
      this.queryHistory = this.queryHistory.slice(-1000);
    }

    this.updateQueryMetrics(executionTime, success);

    if (executionTime > TIME_CONSTANTS.SECOND) {
      this.createAlert('slow_query', 'medium', `Slow query detected: ${executionTime}ms`, {
        query: this.sanitizeQuery(query),
        executionTime,
      });
    }
  }

  private sanitizeQuery(query: string): string {
    return query
      .replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, "'***'")
      .replace(/\b\d+\b/g, '***')
      .substring(0, 200);
  }

  private updateQueryMetrics(_executionTime: number, _success: boolean): void {
    const recentQueries = this.queryHistory.slice(-100);
    this.dbMetrics.queryTime = recentQueries.length > 0 
      ? recentQueries.reduce((sum, q) => sum + q.time, 0) / recentQueries.length 
      : 0;

    const oneMinuteAgo = Date.now() - TIME_CONSTANTS.MINUTE;
    const queriesInLastMinute = this.queryHistory.filter(q => q.timestamp > oneMinuteAgo).length;
    this.dbMetrics.throughput = queriesInLastMinute / 60;
    this.dbMetrics.slowQueries = this.queryHistory.filter(q => q.time > TIME_CONSTANTS.SECOND).length;
  }

  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    metadata: any
  ): void {
    console.warn(`Performance Alert [${severity.toUpperCase()}]: ${message}`, { type, metadata });
    // In production, this would send to alerting system
  }

  getDatabaseMetrics(): DatabaseMetrics {
    return { ...this.dbMetrics };
  }

  getFrontendMetrics(): OptimizationMetrics {
    return { ...this.frontendMetrics };
  }

  // Performance health check
  async performHealthCheck(): Promise<{
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    const webVitals = this.core.getWebVitals();
    const memory = new MemoryUtilities(this.core).getMemoryUsage();
    
    let score = 100;
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    if (webVitals.lcp && webVitals.lcp > 2500) {
      score -= 25;
      issues.push(`LCP is ${webVitals.lcp}ms (should be < 2500ms)`);
      suggestions.push('Optimize critical rendering path and reduce server response time');
    }
    
    if (webVitals.fid && webVitals.fid > 100) {
      score -= 20;
      issues.push(`FID is ${webVitals.fid}ms (should be < 100ms)`);
      suggestions.push('Reduce JavaScript execution time and break long tasks');
    }
    
    if (webVitals.cls && webVitals.cls > 0.1) {
      score -= 15;
      issues.push(`CLS is ${webVitals.cls} (should be < 0.1)`);
      suggestions.push('Reserve space for images and avoid dynamic content injection');
    }
    
    if (memory && memory.utilization > 80) {
      score -= 10;
      issues.push(`Memory usage is ${memory.utilization.toFixed(1)}% (high)`);
      suggestions.push('Consider implementing memory cleanup and optimize data structures');
    }
    
    return {
      score: Math.max(0, score),
      issues,
      suggestions
    };
  }
}

// ========== MAIN PERFORMANCE MANAGER ==========

export class PerformanceManager {
  private static instance: PerformanceManager;
  private core: PerformanceCore;
  private timing: TimingUtilities;
  private memory: MemoryUtilities;
  private monitor: EnhancedMonitor;

  private constructor() {
    this.core = new PerformanceCore();
    this.timing = new TimingUtilities(this.core);
    this.memory = new MemoryUtilities(this.core);
    this.monitor = new EnhancedMonitor(this.core);
  }

  static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  // Core API
  recordMetric(name: string, value: number): void {
    this.core.recordMetric(name, value);
  }

  getMetrics(): PerformanceMetric[] {
    return this.core.getMetrics();
  }

  getWebVitals(): Partial<PageLoadMetrics> {
    return this.core.getWebVitals();
  }

  // Timing API
  measureInteraction(name: string, fn: () => void | Promise<void>): Promise<void> | void {
    return this.timing.measureInteraction(name, fn);
  }

  async measureApiCall<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return this.timing.measureApiCall(name, fn);
  }

  async measureDbOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return this.timing.measureDbOperation(name, fn);
  }

  async measureEdgeFunction<T>(
    name: string,
    fn: () => Promise<T>,
    options?: { region?: string; metadata?: Record<string, any> }
  ): Promise<T> {
    return this.timing.measureEdgeFunction(name, fn, options);
  }

  startMark(name: string): void {
    this.timing.startMark(name);
  }

  endMark(name: string): void {
    this.timing.endMark(name);
  }

  // Memory API
  captureMemorySnapshot(): void {
    this.memory.captureMemorySnapshot();
  }

  getMemoryUsage(): { used: number; total: number; limit: number; utilization: number } | null {
    return this.memory.getMemoryUsage();
  }

  monitorMemoryUsage(intervalMs?: number): () => void {
    return this.memory.monitorMemoryUsage(intervalMs);
  }

  stopMemoryMonitoring(): void {
    this.memory.stopMemoryMonitoring();
  }

  // Database monitoring API
  recordQuery(query: string, executionTime: number, success: boolean): void {
    this.monitor.recordQuery(query, executionTime, success);
  }

  getDatabaseMetrics(): DatabaseMetrics {
    return this.monitor.getDatabaseMetrics();
  }

  getFrontendMetrics(): OptimizationMetrics {
    return this.monitor.getFrontendMetrics();
  }

  async performHealthCheck(): Promise<{
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    return this.monitor.performHealthCheck();
  }

  // Bundle performance tracking
  async trackBundlePerformance(): Promise<void> {
    if (typeof window !== 'undefined' && 'performance' in window) {
      window.addEventListener('load', () => {
        // Track resource loading times
        const resources = performance.getEntriesByType('resource');
        resources.forEach((resource: PerformanceEntry) => {
          if (resource.name.includes('assets/js/')) {
            this.core.recordMetric('bundle_load_time', resource.duration);
          }
        });
        
        // Record overall page load performance
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.core.recordMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart);
          this.core.recordMetric('window_load_time', navigation.loadEventEnd - navigation.fetchStart);
          this.core.recordMetric('first_byte_time', navigation.responseStart - navigation.requestStart);
        }
      });
    }
  }

  // Performance feedback
  getPerformanceFeedback(): string {
    const webVitals = this.core.getWebVitals();
    let feedback = '';
    
    if (webVitals.lcp && webVitals.lcp > 2500) {
      feedback += 'Slow loading detected. Consider optimizing images and assets. ';
    } else if (webVitals.lcp && webVitals.lcp < 1500) {
      feedback += 'Great loading performance! ';
    }
    
    if (webVitals.fid && webVitals.fid > 100) {
      feedback += 'Slow interactions detected. Consider optimizing code. ';
    }
    
    if (webVitals.cls && webVitals.cls > 0.1) {
      feedback += 'Layout shifts detected. Consider reserving space for images. ';
    }
    
    return feedback || 'Performance looks good!';
  }

  // Cleanup
  cleanup(): void {
    this.memory.stopMemoryMonitoring();
    this.core.cleanup();
  }
}

// ========== EXPORTS ==========

// Global instance
export const performanceManager = PerformanceManager.getInstance();

// Utility functions for backward compatibility
export const measureRender = (componentName: string) => {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      performanceManager.recordMetric(`render_${componentName}`, duration);
    }
  };
};

// React hook
export const usePerformanceMonitor = (componentName: string) => {
  const startTime = React.useRef<number>(performance.now());
  
  React.useEffect(() => {
    return () => {
      if (startTime.current) {
        const duration = performance.now() - startTime.current;
        performanceManager.recordMetric(`component_${componentName}`, duration);
      }
    };
  }, [componentName]);
};

// Legacy singleton exports for backward compatibility
export const performanceMonitor = performanceManager;
export const databasePerformanceMonitor = {
  recordQuery: (query: string, time: number, success: boolean) => 
    performanceManager.recordQuery(query, time, success),
  getMetrics: () => performanceManager.getDatabaseMetrics(),
};
export const edgePerformanceMonitor = {
  measureEdgeFunction: <T>(name: string, fn: () => Promise<T>, options?: any) =>
    performanceManager.measureEdgeFunction(name, fn, options),
  getMetrics: () => performanceManager.getMetrics(),
  getStatistics: () => ({ totalCalls: 0, averageDuration: 0 }), // Simplified
};
export const frontendPerformanceOptimizer = {
  recordMetric: (name: string, value: number) => performanceManager.recordMetric(name, value),
  getMetrics: () => performanceManager.getFrontendMetrics(),
  batchDOMUpdates: (updates: () => void) => updates(), // Simplified
};

// Export types
export type {
  PerformanceMetric,
  PageLoadMetrics,
  EdgeMetrics,
  DatabaseMetrics,
  PerformanceAlert,
  OptimizationMetrics,
  PerformanceThresholds,
};