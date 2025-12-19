import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage: number;
  metadata: Record<string, unknown>;
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
  private maxMetrics = 500; // Reduced from 1000 for better memory
  private reportingThreshold = 200; // Increased from 100 to reduce overhead
  private samplingRate = 0.1; // Sample 10% of operations to reduce overhead

  startTimer(operation: string, metadata?: Record<string, unknown>): () => PerformanceMetrics {
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
    this.memorySnapshots.push(metric.memoryUsage);

    // Keep only recent metrics to prevent memory leaks
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
      this.memorySnapshots.shift();
    }

    // Auto-report if threshold reached
    if (this.metrics.length >= this.reportingThreshold) {
      this.generateReport();
    }
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return usage.heapUsed;
    }
    return 0;
  }

  generateReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        slowestOperation: {
          operation: '',
          startTime: 0,
          endTime: 0,
          duration: 0,
          memoryUsage: 0,
          metadata: {}
        },
        fastestOperation: {
          operation: '',
          startTime: 0,
          endTime: 0,
          duration: 0,
          memoryUsage: 0,
          metadata: {}
        },
        operationsByType: {},
        memoryTrend: []
      };
    }

    const durations = this.metrics.map(m => m.duration);
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    const sorted = [...this.metrics].sort((a, b) => a.duration - b.duration);
    const operationsByType = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = [];
      }
      (acc[metric.operation] || []).push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetrics[]>);

    const slowest = sorted[sorted.length - 1];
    const fastest = sorted[0];

    const report: PerformanceReport = {
      totalOperations: this.metrics.length,
      averageDuration,
      slowestOperation: slowest || {
        operation: '',
        startTime: 0,
        endTime: 0,
        duration: 0,
        memoryUsage: 0,
        metadata: {}
      },
      fastestOperation: fastest || {
        operation: '',
        startTime: 0,
        endTime: 0,
        duration: 0,
        memoryUsage: 0,
        metadata: {}
      },
      operationsByType,
      memoryTrend: [...this.memorySnapshots]
    };

    // Clear metrics after report to prevent memory growth
    this.clearMetrics();
    
    return report;
  }

  clearMetrics(): void {
    this.metrics = [];
    this.memorySnapshots = [];
  }

  // New method to get Web Vitals
  async getWebVitals(): Promise<Record<string, number>> {
    if (typeof window === 'undefined' || !window.performance) {
      return {};
    }

    try {
      const performanceAPI = window.performance;
      
      // Get navigation timing entries
      const navigationEntries = performanceAPI.getEntriesByType?.('navigation') || [];
      if (!navigationEntries.length) {
        return {};
      }
      
      return {
        lcp: 0, // Would need PerformanceObserver for real LCP
        cls: 0, // Would need PerformanceObserver for real CLS  
        fid: 0  // Would need PerformanceObserver for real FID
      };
    } catch (error) {
      return {};
    }
  }

  // Performance score calculation
  calculateScore(report: PerformanceReport): number {
    let score = 100;
    
    // Deduct points for high average duration
    if (report.averageDuration > 200) {
      score -= Math.min(20, (report.averageDuration - 200) / 10);
    }
    
    // Deduct points for memory usage
    if (report.memoryTrend.length > 0) {
      const currentMemory = report.memoryTrend[report.memoryTrend.length - 1] || 0;
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
export function measurePerformance(_operationName?: string) {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const constructorName = (target as any).constructor?.name || 'Unknown';

    descriptor.value = function (...args: unknown[]) {
      const endTimer = performanceMonitor.startTimer(propertyName, {
        className: constructorName,
        methodName: propertyName
      });

      try {
        const result = method.apply(this, args);
        
        // Handle async functions
        if (result && typeof result.then === 'function') {
          return result.finally(() => {
            endTimer();
          });
        }
        
        endTimer();
        return result;
      } catch (error) {
        endTimer();
        throw error;
      }
    };

    return descriptor;
  };
}

// Performance monitoring utilities
export const perfUtils = {
  startTimer: (operation: string, metadata?: Record<string, unknown>) => 
    performanceMonitor.startTimer(operation, metadata),
  
  getReport: () => performanceMonitor.generateReport(),
  
  getScore: () => {
    const report = performanceMonitor.generateReport();
    return performanceMonitor.calculateScore(report);
  },
  
  getWebVitals: () => performanceMonitor.getWebVitals(),
  
  clear: () => performanceMonitor.clearMetrics()
};

export default performanceMonitor;