/**
 * Legacy Performance Monitor - DEPRECATED
 * This module has been consolidated into utils/performanceConsolidated.ts
 * Please import from performanceConsolidated.ts instead
 */

import { performanceManager } from './performanceConsolidated';

// Interface matching the old implementation
interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  timestamp: number;
  category: 'render' | 'network' | 'memory' | 'custom';
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];

  constructor() {
    // Initialize with consolidated monitoring
    if (typeof window !== 'undefined') {
      console.info('PerformanceMonitor: Using consolidated performance system');
    }
  }

  recordMetric(metric: Partial<PerformanceMetric>): void {
    if (!metric.name || metric.value === undefined) return;
    
    const newMetric: PerformanceMetric = {
      id: metric.id || `metric-${Date.now()}-${Math.random()}`,
      name: metric.name,
      value: metric.value,
      timestamp: metric.timestamp || Date.now(),
      category: metric.category || 'custom'
    };

    this.metrics.push(newMetric);
    performanceManager.recordMetric(metric.name, metric.value);
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === name);
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  // Legacy compatibility methods
  measurePageLoad(): number {
    const webVitals = performanceManager.getWebVitals();
    return webVitals.fcp || 0;
  }

  measureMemoryUsage(): number | null {
    const memory = performanceManager.getMemoryUsage();
    return memory ? memory.used : null;
  }
}

export const performanceMonitor = new PerformanceMonitor();
export type { PerformanceMetric };