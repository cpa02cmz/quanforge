// Performance monitoring utilities for database operations

export interface PerformanceMetric {
  count: number;
  totalTime: number;
  avgTime: number;
}

export interface OperationMetrics {
  [operation: string]: PerformanceMetric;
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();

  record(operation: string, duration: number) {
    const metric = this.metrics.get(operation) || { count: 0, totalTime: 0, avgTime: 0 };
    metric.count++;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.count;
    this.metrics.set(operation, metric);
  }

  getMetrics(operation: string): PerformanceMetric | undefined {
    return this.metrics.get(operation);
  }

  getAllMetrics(): OperationMetrics {
    const result: OperationMetrics = {};
    this.metrics.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  reset() {
    this.metrics.clear();
  }
}

// Edge performance tracker for monitoring database operations in edge environments
export class EdgePerformanceTracker {
  private metrics: Map<string, number[]> = new Map();
  private readonly maxSamples = 100;

  recordMetric(operation: string, duration: number) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const samples = this.metrics.get(operation)!;
    samples.push(duration);
    
    // Keep only the latest samples
    if (samples.length > this.maxSamples) {
      samples.shift();
    }
  }

  getAverageLatency(operation: string): number {
    const samples = this.metrics.get(operation);
    if (!samples || samples.length === 0) return 0;
    
    return samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  }

  getPercentile(operation: string, percentile: number): number {
    const samples = this.metrics.get(operation);
    if (!samples || samples.length === 0) return 0;
    
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getAllOperationMetrics() {
    const result: { [operation: string]: { avg: number; p95: number; p99: number } } = {};
    
    this.metrics.forEach((samples, operation) => {
      result[operation] = {
        avg: this.getAverageLatency(operation),
        p95: this.getPercentile(operation, 95),
        p99: this.getPercentile(operation, 99)
      };
    });
    
    return result;
  }

  reset() {
    this.metrics.clear();
  }
}