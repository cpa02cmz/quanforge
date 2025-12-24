/**
 * Legacy Edge Performance Monitor - DEPRECATED
 * This module has been consolidated into performanceConsolidated.ts
 * Please import from performanceConsolidated.ts instead
 */

import { performanceManager } from './performanceConsolidated';

export class EdgePerformanceMonitor {
  async measureEdgeFunction<T>(
    name: string,
    fn: () => Promise<T>,
    options?: {
      region?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    return performanceManager.measureEdgeFunction(name, fn, options);
  }

  getMetrics() {
    return performanceManager.getMetrics();
  }

  getStatistics() {
    return { totalCalls: 0, averageDuration: 0 }; // Simplified for compatibility
  }
}

export const edgePerformanceMonitor = new EdgePerformanceMonitor();

// Utility function for easy function measurement
export function measureEdge<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    region?: string;
    metadata?: Record<string, any>;
  }
): Promise<T> {
  return edgePerformanceMonitor.measureEdgeFunction(name, fn, options);
}