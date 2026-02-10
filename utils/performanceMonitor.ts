import { performance } from 'perf_hooks';
import { PERFORMANCE_MONITORING, MEMORY } from '../constants/timing';

// Type definitions for better type safety
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

interface PerformanceEntryWithName {
  name: string;
  startTime: number;
}

interface LayoutShiftEntry {
  hadRecentInput: boolean;
  value: number;
}

interface FirstInputEntry {
  processingStart: number;
  startTime: number;
}

interface WebVitalsResult {
  navigation: PerformanceNavigationTiming | null;
  paint: {
    firstPaint: PerformanceEntryWithName | null;
    firstContentfulPaint: PerformanceEntryWithName | null;
  };
  coreWebVitals: {
    lcp: number;
    cls: number;
    fid: number;
  };
  resourcesCount: number;
  domContentLoaded: boolean;
}

interface DecoratorTarget {
  constructor: { name: string };
}

interface LogMetadata {
  [key: string]: unknown;
}

interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage: number;
  metadata: Record<string, any>;
}

interface PerformanceReport {
  totalOperations: number;
  averageDuration: number;
  slowestOperation: PerformanceMetrics;
  fastestOperation: PerformanceMetrics;
  operationsByType: Record<string, PerformanceMetrics[]>;
  memoryTrend: number[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private memorySnapshots: number[] = [];
  private maxMetrics = PERFORMANCE_MONITORING.MAX_METRICS;
  private reportingThreshold = PERFORMANCE_MONITORING.REPORTING_THRESHOLD;
  private samplingRate = PERFORMANCE_MONITORING.SAMPLING_RATE;

  startTimer(operation: string, metadata?: Record<string, any>): () => PerformanceMetrics {
    // Skip monitoring for some operations to reduce overhead
    if (Math.random() > this.samplingRate) {
      return () => ({} as PerformanceMetrics);
    }

    const startTime = performance.now();
    const memoryUsage = this.getMemoryUsage();

    return (): PerformanceMetrics => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const metric: PerformanceMetrics = {
        operation,
        startTime,
        endTime,
        duration,
        memoryUsage: memoryUsage || 0,
        metadata: metadata || {}
      };

      this.addMetric(metric);
      return metric;
    };
  }

  private addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Keep only the latest metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Add memory snapshot
    if (metric.memoryUsage) {
      this.memorySnapshots.push(metric.memoryUsage);
      if (this.memorySnapshots.length > PERFORMANCE_MONITORING.MAX_MEMORY_SNAPSHOTS) {
        this.memorySnapshots = this.memorySnapshots.slice(-PERFORMANCE_MONITORING.MAX_MEMORY_SNAPSHOTS);
      }
    }

    // Auto-report if threshold reached
    if (this.metrics.length % this.reportingThreshold === 0) {
      this.logPerformanceReport();
    }
  }

  private getMemoryUsage(): number {
    const perf = performance as unknown as ExtendedPerformance;
    if (typeof performance !== 'undefined' && perf.memory) {
      return perf.memory.usedJSHeapSize || 0;
    }
    return 0;
  }

  getPerformanceReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        slowestOperation: {} as PerformanceMetrics,
        fastestOperation: {} as PerformanceMetrics,
        operationsByType: {},
        memoryTrend: []
      };
    }

    const totalOperations = this.metrics.length;
    const averageDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations;
    
    const slowestOperation = this.metrics.reduce((slowest, current) => 
      current.duration > slowest.duration ? current : slowest
    );
    
    const fastestOperation = this.metrics.reduce((fastest, current) => 
      current.duration < fastest.duration ? current : fastest
    );

    const operationsByType = this.metrics.reduce((acc, metric) => {
      const operation = metric.operation;
      if (!acc[operation]) {
        acc[operation] = [];
      }
      acc[operation].push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetrics[]>);

    return {
      totalOperations,
      averageDuration,
      slowestOperation,
      fastestOperation,
      operationsByType,
      memoryTrend: [...this.memorySnapshots]
    };
  }

  logPerformanceReport(): void {
    const report = this.getPerformanceReport();
    
    console.group('🚀 Performance Report');
    console.log(`📊 Total Operations: ${report.totalOperations}`);
    console.log(`⏱️  Average Duration: ${report.averageDuration.toFixed(2)}ms`);
    console.log(`🐌 Slowest Operation: ${report.slowestOperation.operation} (${report.slowestOperation.duration.toFixed(2)}ms)`);
    console.log(`🚀 Fastest Operation: ${report.fastestOperation.operation} (${report.fastestOperation.duration.toFixed(2)}ms)`);
    
    if (report.memoryTrend.length > 0) {
      const currentMemory = report.memoryTrend[report.memoryTrend.length - 1] || 0;
      const memoryMB = (currentMemory / MEMORY.MB).toFixed(2);
      console.log(`💾 Current Memory Usage: ${memoryMB} MB`);
    }

    console.log('\n📈 Operations by Type:');
    Object.entries(report.operationsByType).forEach(([operation, metrics]) => {
      const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
      const maxDuration = Math.max(...metrics.map(m => m.duration));
      console.log(`  ${operation}: ${metrics.length} ops, avg: ${avgDuration.toFixed(2)}ms, max: ${maxDuration.toFixed(2)}ms`);
    });
    
    console.groupEnd();

    // Log warnings for slow operations
    if (report.slowestOperation.duration > PERFORMANCE_MONITORING.SLOW_OPERATION_THRESHOLD) {
      console.warn(`⚠️  Slow operation detected: ${report.slowestOperation.operation} took ${report.slowestOperation.duration.toFixed(2)}ms`);
    }

    // Log memory warnings
    if (report.memoryTrend.length > 0) {
      const currentMemory = report.memoryTrend[report.memoryTrend.length - 1] || 0;
      if (currentMemory > PERFORMANCE_MONITORING.HIGH_MEMORY_THRESHOLD_MB * MEMORY.MB) {
        console.warn(`⚠️  High memory usage: ${(currentMemory / MEMORY.MB).toFixed(2)} MB`);
      }
    }
  }

  getSlowOperations(threshold: number = PERFORMANCE_MONITORING.SLOW_OP_SCORE_THRESHOLD): PerformanceMetrics[] {
    return this.metrics.filter(m => m.duration > threshold);
  }

  getOperationMetrics(operation: string): PerformanceMetrics[] {
    return this.metrics.filter(m => m.operation === operation);
  }

  clearMetrics(): void {
    this.metrics = [];
    this.memorySnapshots = [];
  }

  // Export metrics for external monitoring
  exportMetrics(): string {
    return JSON.stringify(this.getPerformanceReport(), null, 2);
  }

// Web performance API integration
    getWebVitals(): WebVitalsResult | null {
      if (typeof performance !== 'undefined' && 'getEntriesByType' in performance) {
        const performanceAPI = performance as unknown as Performance & {
          getEntriesByType<T>(type: string): T[];
        };
        const navigationEntries = performanceAPI.getEntriesByType?.('navigation') || [];
        const paintEntries = performanceAPI.getEntriesByType?.('paint') || [];
        const resourceEntries = performanceAPI.getEntriesByType?.('resource') || [];
        
        // Calculate Core Web Vitals
        let lcpValue = 0;
        let clsValue = 0;
        let fidValue = 0;
        
        // LCP (Largest Contentful Paint)
        const lcpEntries = performanceAPI.getEntriesByType<PerformanceEntry>('largest-contentful-paint') || [];
        if (lcpEntries.length > 0) {
          const lcpEntry = lcpEntries[lcpEntries.length - 1];
          lcpValue = lcpEntry?.startTime || 0;
        }
        
        // Calculate CLS (Cumulative Layout Shift)
        const layoutShiftEntries = performanceAPI.getEntriesByType<PerformanceEntry>('layout-shift') || [];
        let clsSessionWindow = 0;
        for (const entry of layoutShiftEntries) {
          const layoutEntry = entry as unknown as LayoutShiftEntry;
          if (!layoutEntry.hadRecentInput) {
            clsSessionWindow += layoutEntry.value;
          }
        }
        clsValue = clsSessionWindow;
        
        // Calculate FID (First Input Delay) - only available after user interaction
        const fidEntries = performanceAPI.getEntriesByType<PerformanceEntry>('first-input') || [];
        if (fidEntries.length > 0) {
          const fidEntry = fidEntries[0] as unknown as FirstInputEntry;
          fidValue = fidEntry.processingStart - fidEntry.startTime;
        }
        
        return {
          navigation: navigationEntries.length > 0 ? (navigationEntries[0] as PerformanceNavigationTiming) : null,
          paint: {
            firstPaint: Array.isArray(paintEntries) ? (paintEntries.find((entry) => entry.name === 'first-paint') as PerformanceEntryWithName || null) : null,
            firstContentfulPaint: Array.isArray(paintEntries) ? (paintEntries.find((entry) => entry.name === 'first-contentful-paint') as PerformanceEntryWithName || null) : null,
          },
          coreWebVitals: {
            lcp: lcpValue,
            cls: clsValue,
            fid: fidValue,
          },
          resourcesCount: resourceEntries.length,
          domContentLoaded: typeof document !== 'undefined' && (document.readyState === 'interactive' || document.readyState === 'complete')
        };
      }
      return null;
    }

   // Get performance score (0-100)
   getPerformanceScore(): number {
     const report = this.getPerformanceReport();
     if (report.totalOperations === 0) return 100;

    let score = 100;
    
    // Deduct points for slow operations
    const slowOps = this.getSlowOperations(PERFORMANCE_MONITORING.SLOW_OP_SCORE_THRESHOLD);
    score -= Math.min(
      PERFORMANCE_MONITORING.SLOW_OP_MAX_PENALTY, 
      slowOps.length * PERFORMANCE_MONITORING.SLOW_OP_PENALTY_MULTIPLIER
    );
    
    // Deduct points for high average duration
    if (report.averageDuration > PERFORMANCE_MONITORING.HIGH_AVG_DURATION_THRESHOLD) {
      score -= Math.min(
        PERFORMANCE_MONITORING.HIGH_AVG_DURATION_MAX_PENALTY, 
        (report.averageDuration - PERFORMANCE_MONITORING.HIGH_AVG_DURATION_THRESHOLD) / 10
      );
    }
    
    // Deduct points for memory usage
    if (report.memoryTrend.length > 0) {
      const currentMemory = report.memoryTrend[report.memoryTrend.length - 1] || 0;
      const memoryThreshold = PERFORMANCE_MONITORING.MODERATE_MEMORY_THRESHOLD_MB * MEMORY.MB;
      if (currentMemory > memoryThreshold) {
        score -= Math.min(
          PERFORMANCE_MONITORING.MEMORY_USAGE_MAX_PENALTY, 
          (currentMemory - memoryThreshold) / MEMORY.MB
        );
      }
    }
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Cleanup method to clear metrics and memory snapshots
   * Called when the app unmounts to prevent memory leaks
   */
  cleanup(): void {
    this.metrics = [];
    this.memorySnapshots = [];
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Decorator for automatic performance monitoring
export function measurePerformance(operationName?: string) {
  return function (target: DecoratorTarget, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = function (...args: unknown[]) {
      const endTimer = performanceMonitor.startTimer(operation, {
        className: target.constructor.name,
        methodName: propertyName,
        argsCount: args.length
      });

      try {
        const result = method.apply(this, args);
        
        if (result && typeof result.then === 'function') {
          // Handle async methods
          return result
            .then((value: unknown) => {
              endTimer();
              return value;
            })
            .catch((error: unknown) => {
              endTimer();
              throw error;
            });
        } else {
          // Handle sync methods
          endTimer();
          return result;
        }
      } catch (error: unknown) {
        endTimer();
        throw error;
      }
    };

    return descriptor;
  };
}

// Utility function for manual performance measurement
export function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: LogMetadata
): Promise<T> {
  const endTimer = performanceMonitor.startTimer(operation, metadata);
  
  return fn()
    .then(result => {
      endTimer();
      return result;
    })
    .catch(error => {
      endTimer();
      throw error;
    });
}

// Utility function for synchronous operations
export function measure<T>(
  operation: string,
  fn: () => T,
  metadata?: LogMetadata
): T {
  const endTimer = performanceMonitor.startTimer(operation, metadata);
  try {
    const result = fn();
    endTimer();
    return result;
  } catch (error: unknown) {
    endTimer();
    throw error;
  }
}

// Advanced logging and monitoring utilities
interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: LogMetadata;
  operation?: string;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = PERFORMANCE_MONITORING.MAX_LOGS;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private sessionId: string;
  private userId?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return 'session_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context: Record<string, any> = {}): void {
    if (!this.shouldLog(level)) return;

    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context: {
        ...context,
        sessionId: this.sessionId,
        userId: this.userId
      }
    };

    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Also output to console
    const consoleMethod = level === 'debug' ? 'log' : level;
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, context);

    // In production, send to external logging service
    if (import.meta.env.PROD) {
      this.sendToExternalLogger(logEntry);
    }
  }

  debug(message: string, context: LogMetadata = {}): void {
    this.log('debug', message, context);
  }

  info(message: string, context: LogMetadata = {}): void {
    this.log('info', message, context);
  }

  warn(message: string, context: LogMetadata = {}): void {
    this.log('warn', message, context);
  }

  error(message: string, context: LogMetadata = {}): void {
    this.log('error', message, context);
  }

  private async sendToExternalLogger(logEntry: LogEntry): Promise<void> {
    try {
      // In a real implementation, you would send to a logging service like LogRocket, Sentry, etc.
      // For now, we'll just log to console to avoid external dependencies
      console.log('External logging service call:', logEntry);
    } catch (e) {
      console.warn('Failed to send log to external service:', e);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Performance monitoring for React components
export function usePerformanceMonitor(componentName: string) {
  const startRender = () => performanceMonitor.startTimer(`${componentName}.render`);
  const startMount = () => performanceMonitor.startTimer(`${componentName}.mount`);
  const startUpdate = () => performanceMonitor.startTimer(`${componentName}.update`);
  
  return {
    startRender,
    startMount,
    startUpdate,
    getReport: () => performanceMonitor.getPerformanceReport(),
    getScore: () => performanceMonitor.getPerformanceScore()
  };
}

// Enhanced monitoring service that combines performance and logging
class MonitoringService {
  private logger: Logger;
  private perfMonitor: PerformanceMonitor;
  private initialized = false;

  constructor() {
    this.logger = new Logger();
    this.perfMonitor = performanceMonitor; // Use existing instance
  }

  getPerformanceMonitor(): PerformanceMonitor {
    return this.perfMonitor;
  }

  init(userId?: string): void {
    if (this.initialized) return;

    this.logger.setUserId(userId || '');
    this.initialized = true;

    // Set up performance monitoring
    this.setupPerformanceMonitoring();
    
    // Log initialization
    this.logger.info('Monitoring service initialized', { userId });
  }

  private setupPerformanceMonitoring(): void {
    // Monitor resource loading
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            this.logger.info('Navigation timing', {
              url: entry.name,
              startTime: entry.startTime,
              duration: entry.duration
            });
          } else if (entry.entryType === 'resource') {
            this.logger.debug('Resource loaded', {
              name: entry.name,
              duration: entry.duration,
              initiatorType: (entry as PerformanceResourceTiming).initiatorType
            });
          }
        }
      });
      
      observer.observe({ entryTypes: ['navigation', 'resource', 'paint'] });
    }
  }

  // Public API
  getLogger(): Logger {
    return this.logger;
  }

  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context: LogMetadata = {}): void {
    this.logger.log(level, message, context);
  }

  info(message: string, context: LogMetadata = {}): void {
    this.logger.info(message, context);
  }

  warn(message: string, context: LogMetadata = {}): void {
    this.logger.warn(message, context);
  }

  error(message: string, context: LogMetadata = {}): void {
    this.logger.error(message, context);
  }

  getLogs(): LogEntry[] {
    return this.logger.getLogs();
  }

  exportLogs(): string {
    return this.logger.exportLogs();
  }

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logger.setLogLevel(level);
  }

  clearLogs(): void {
    this.logger.clearLogs();
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();

export default performanceMonitor;