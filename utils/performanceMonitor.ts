import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage?: number;
  metadata?: Record<string, any>;
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
  private maxMetrics = 1000; // Keep last 1000 metrics
  private reportingThreshold = 100; // Report every 100 operations

  startTimer(operation: string, metadata?: Record<string, any>): () => PerformanceMetrics {
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
        memoryUsage,
        metadata
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
      if (this.memorySnapshots.length > 100) {
        this.memorySnapshots = this.memorySnapshots.slice(-100);
      }
    }

    // Auto-report if threshold reached
    if (this.metrics.length % this.reportingThreshold === 0) {
      this.logPerformanceReport();
    }
  }

  private getMemoryUsage(): number | undefined {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return undefined;
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
      if (!acc[metric.operation]) {
        acc[metric.operation] = [];
      }
      acc[metric.operation].push(metric);
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
      const currentMemory = report.memoryTrend[report.memoryTrend.length - 1];
      const memoryMB = (currentMemory / 1024 / 1024).toFixed(2);
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
    if (report.slowestOperation.duration > 1000) {
      console.warn(`⚠️  Slow operation detected: ${report.slowestOperation.operation} took ${report.slowestOperation.duration.toFixed(2)}ms`);
    }

    // Log memory warnings
    if (report.memoryTrend.length > 0) {
      const currentMemory = report.memoryTrend[report.memoryTrend.length - 1];
      if (currentMemory > 50 * 1024 * 1024) { // 50MB
        console.warn(`⚠️  High memory usage: ${(currentMemory / 1024 / 1024).toFixed(2)} MB`);
      }
    }
  }

  getSlowOperations(threshold: number = 500): PerformanceMetrics[] {
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
    getWebVitals(): any {
      if (typeof performance !== 'undefined' && 'getEntriesByType' in performance) {
        // Use any type to avoid strict typing issues with performance entries
        const performanceAPI: any = performance;
        const navigationEntries = performanceAPI.getEntriesByType?.('navigation') || [];
        const paintEntries = performanceAPI.getEntriesByType?.('paint') || [];
        const resourceEntries = performanceAPI.getEntriesByType?.('resource') || [];
        
        // Calculate Core Web Vitals
        let lcpValue = 0;
        let clsValue = 0;
        let fidValue = 0;
        
        // LCP (Largest Contentful Paint)
        const lcpEntries = performanceAPI.getEntriesByType?.('largest-contentful-paint') || [];
        if (lcpEntries.length > 0) {
          const lcpEntry = lcpEntries[lcpEntries.length - 1];
          lcpValue = lcpEntry.startTime;
        }
        
        // Calculate CLS (Cumulative Layout Shift)
        const layoutShiftEntries = performanceAPI.getEntriesByType?.('layout-shift') || [];
        let clsSessionWindow = 0;
        for (const entry of layoutShiftEntries) {
          if (!entry.hadRecentInput) {
            clsSessionWindow += entry.value;
          }
        }
        clsValue = clsSessionWindow;
        
        // Calculate FID (First Input Delay) - only available after user interaction
        const fidEntries = performanceAPI.getEntriesByType?.('first-input') || [];
        if (fidEntries.length > 0) {
          const fidEntry = fidEntries[0];
          fidValue = fidEntry.processingStart - fidEntry.startTime;
        }
        
        return {
          navigation: navigationEntries.length > 0 ? navigationEntries[0] : null,
          paint: {
            firstPaint: Array.isArray(paintEntries) ? paintEntries.find((entry: any) => entry.name === 'first-paint') : null,
            firstContentfulPaint: Array.isArray(paintEntries) ? paintEntries.find((entry: any) => entry.name === 'first-contentful-paint') : null,
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
    const slowOps = this.getSlowOperations(500);
    score -= Math.min(30, slowOps.length * 5);
    
    // Deduct points for high average duration
    if (report.averageDuration > 200) {
      score -= Math.min(20, (report.averageDuration - 200) / 10);
    }
    
    // Deduct points for memory usage
    if (report.memoryTrend.length > 0) {
      const currentMemory = report.memoryTrend[report.memoryTrend.length - 1];
      if (currentMemory > 30 * 1024 * 1024) { // 30MB
        score -= Math.min(20, (currentMemory - 30 * 1024 * 1024) / (1024 * 1024));
      }
    }
    
    return Math.max(0, Math.round(score));
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Decorator for automatic performance monitoring
export function measurePerformance(operationName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = function (...args: any[]) {
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
            .then((value: any) => {
              endTimer();
              return value;
            })
            .catch((error: any) => {
              endTimer();
              throw error;
            });
        } else {
          // Handle sync methods
          endTimer();
          return result;
        }
      } catch (error) {
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
  metadata?: Record<string, any>
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
  metadata?: Record<string, any>
): T {
  const endTimer = performanceMonitor.startTimer(operation, metadata);
  try {
    const result = fn();
    endTimer();
    return result;
  } catch (error) {
    endTimer();
    throw error;
  }
}

// Advanced logging and monitoring utilities
interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: Record<string, any>;
  operation?: string;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep only last 1000 logs
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private sessionId: string;
  private userId?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return 'session_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
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

  debug(message: string, context: Record<string, any> = {}): void {
    this.log('debug', message, context);
  }

  info(message: string, context: Record<string, any> = {}): void {
    this.log('info', message, context);
  }

  warn(message: string, context: Record<string, any> = {}): void {
    this.log('warn', message, context);
  }

  error(message: string, context: Record<string, any> = {}): void {
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

  // Database-specific monitoring methods
  async logDatabaseQuery(
    queryType: string, 
    executionTime: number, 
    resultCount: number, 
    userId?: string,
    parameters?: Record<string, any>,
    isCached: boolean = false
  ): Promise<void> {
    const context = {
      queryType,
      executionTime,
      resultCount,
      isCached,
      parameters: parameters ? JSON.stringify(parameters) : undefined,
      userId
    };

    // Log slow queries as warnings
    if (executionTime > 1000) { // More than 1 second
      this.logger.warn(`Slow database query detected: ${queryType}`, context);
    } else if (executionTime > 500) { // More than 0.5 seconds
      this.logger.info(`Moderate database query: ${queryType}`, context);
    } else {
      this.logger.debug(`Database query executed: ${queryType}`, context);
    }
  }

  // Database performance analysis
  getDatabasePerformanceAnalysis(): {
    averageQueryTime: number;
    slowQueryCount: number;
    cacheHitRate: number;
    topSlowQueries: Array<{ queryType: string; avgTime: number; count: number }>;
  } {
    // Extract database-related logs
    const dbLogs = this.getLogs().filter(log => 
      log.message.includes('Database query') || 
      log.message.includes('Slow database query') ||
      log.message.includes('Moderate database query')
    );

    if (dbLogs.length === 0) {
      return {
        averageQueryTime: 0,
        slowQueryCount: 0,
        cacheHitRate: 0,
        topSlowQueries: []
      };
    }

    const queryTimes: Record<string, number[]> = {};
    const queryCounts: Record<string, number> = {};
    const cachedQueries: Record<string, number> = {};
    let totalQueries = 0;
    let slowQueries = 0;

    for (const log of dbLogs) {
      if (log.context && log.context['queryType']) {
        const queryType = log.context['queryType'];
        const executionTime = log.context['executionTime'];
        
        if (!queryTimes[queryType]) {
          queryTimes[queryType] = [];
          queryCounts[queryType] = 0;
          cachedQueries[queryType] = 0;
        }

        queryTimes[queryType].push(executionTime);
        queryCounts[queryType]++;
        totalQueries++;

        if (log.context['isCached']) {
          cachedQueries[queryType]++;
        }

        if (executionTime > 1000) {
          slowQueries++;
        }
      }
    }

    // Calculate average times
    const queryAverages: Array<{ queryType: string; avgTime: number; count: number }> = [];
    for (const [queryType, times] of Object.entries(queryTimes)) {
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      queryAverages.push({
        queryType,
        avgTime,
        count: queryCounts[queryType]
      });
    }

    // Sort by average time to get top slow queries
    const topSlowQueries = queryAverages
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 5);

    // Calculate overall average
    const allTimes = dbLogs
      .filter(log => log.context && typeof log.context['executionTime'] === 'number')
      .map(log => log.context['executionTime'] as number);
    const averageQueryTime = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;

    // Calculate cache hit rate
    const totalCached = dbLogs.filter(log => log.context && log.context['isCached']).length;
    const cacheHitRate = totalQueries > 0 ? (totalCached / totalQueries) * 100 : 0;

    return {
      averageQueryTime,
      slowQueryCount: slowQueries,
      cacheHitRate,
      topSlowQueries
    };
  }

  // Public API
  getLogger(): Logger {
    return this.logger;
  }

  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context: Record<string, any> = {}): void {
    this.logger.log(level, message, context);
  }

  info(message: string, context: Record<string, any> = {}): void {
    this.logger.info(message, context);
  }

  warn(message: string, context: Record<string, any> = {}): void {
    this.logger.warn(message, context);
  }

  error(message: string, context: Record<string, any> = {}): void {
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