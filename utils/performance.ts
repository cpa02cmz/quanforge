/**
 * Performance monitoring utility
 */

interface PerformanceMetrics {
  [key: string]: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private startTime: number = Date.now();

  recordMetric(name: string, value: number): void {
    this.metrics[name] = value;
  }

  getMetric(name: string): number | undefined {
    return this.metrics[name];
  }

  getAllMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  markStart(name: string): void {
    this.metrics[`${name}_start`] = performance.now();
  }

  markEnd(name: string): number {
    const start = this.metrics[`${name}_start`];
    if (start) {
      const duration = performance.now() - start;
      this.metrics[name] = duration;
      delete this.metrics[`${name}_start`];
      return duration;
    }
    return 0;
  }

  cleanup(): void {
    this.metrics = {};
  }

  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      totalRuntime: Date.now() - this.startTime
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;