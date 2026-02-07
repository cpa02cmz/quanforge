/**
 * Legacy Performance Module - DEPRECATED
 * This module has been consolidated into utils/performanceConsolidated.ts
 * Please import from performanceConsolidated.ts instead
 */

import { performanceManager } from './performanceConsolidated';

// Simple interface matching the old implementation
interface PerformanceMetrics {
  [key: string]: number;
}

class PerformanceMonitor {
  recordMetric(name: string, value: number): void {
    performanceManager.recordMetric(name, value);
  }

  getMetric(name: string): number | undefined {
    const metrics = performanceManager.getMetrics();
    const nameMetrics = metrics.filter(m => m.name === name);
    const lastMetric = nameMetrics[nameMetrics.length - 1];
    return lastMetric?.value;
  }

  getAllMetrics(): PerformanceMetrics {
    const all = performanceManager.getMetrics();
    const result: PerformanceMetrics = {};
    all.forEach(metric => {
      if (metric && metric.name && metric.value !== undefined) {
        result[metric.name] = metric.value;
      }
    });
    return result;
  }

  markStart(name: string): void {
    performanceManager.startMark(name);
  }

  markEnd(name: string): number {
    performanceManager.endMark(name);
    const result = this.getMetric(`measure_${name}`);
    return result ?? 0;
  }

  clearMetrics(): void {
    // Clear would have to be added to performanceManager if needed
    console.warn('clearMetrics not implemented in consolidated version');
  }

  cleanup(): void {
    // Cleanup any resources used by the performance monitor
    this.clearMetrics();
  }
}

export const performanceMonitor = new PerformanceMonitor();
export type { PerformanceMetrics };