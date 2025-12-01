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

export default performanceMonitor;