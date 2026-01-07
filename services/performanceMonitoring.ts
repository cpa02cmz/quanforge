
export class PerformanceMonitor {
  private metrics: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();

  record(operation: string, duration: number) {
    const metric = this.metrics.get(operation) || { count: 0, totalTime: 0, avgTime: 0 };
    metric.count++;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.count;
    this.metrics.set(operation, metric);
  }

  getMetrics(operation: string) {
    return this.metrics.get(operation);
  }

  getAllMetrics() {
    return Object.fromEntries(Array.from(this.metrics.entries()));
  }

  reset() {
    this.metrics.clear();
  }

  logMetrics() {
    const allMetrics = this.getAllMetrics();
    console.group('Database Performance Metrics');
    for (const [operation, metric] of Object.entries(allMetrics)) {
      console.log(`${operation}: ${metric.count} calls, avg: ${metric.avgTime.toFixed(2)}ms`);
    }
    console.groupEnd();
  }
}

export class EdgePerformanceTracker {
  private metrics: Map<string, number[]> = new Map();
  
  recordMetric(operation: string, value: number) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    const values = this.metrics.get(operation)!;
    values.push(value);
    
    if (values.length > 100) {
      values.splice(0, values.length - 100);
    }
  }
  
  getAverage(operation: string): number {
    const values = this.metrics.get(operation) || [];
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }
  
  getPercentile(operation: string, percentile: number): number {
    const values = this.metrics.get(operation) || [];
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * (percentile / 100));
    return sorted[Math.min(index, sorted.length - 1)] || 0;
  }
  
  getAllMetrics() {
    const result: Record<string, { avg: number; p95: number; p99: number; count: number }> = {};
    
    for (const [operation] of Array.from(this.metrics.entries())) {
      result[operation] = {
        avg: this.getAverage(operation),
        p95: this.getPercentile(operation, 95),
        p99: this.getPercentile(operation, 99),
        count: this.metrics.get(operation)!.length,
      };
    }
    
    return result;
  }
}

export const performanceMonitor = new PerformanceMonitor();
export const edgePerformanceTracker = new EdgePerformanceTracker();
