/**
 * Legacy Performance Monitor Enhanced - DEPRECATED
 * This module has been consolidated into utils/performanceConsolidated.ts
 * Please import from performanceConsolidated.ts instead
 */

import { performanceManager } from '../utils/performanceConsolidated';

// Re-export for backward compatibility
export class PerformanceMonitorEnhanced {
  private static instance: PerformanceMonitorEnhanced;

  static getInstance(): PerformanceMonitorEnhanced {
    if (!PerformanceMonitorEnhanced.instance) {
      PerformanceMonitorEnhanced.instance = new PerformanceMonitorEnhanced();
    }
    return PerformanceMonitorEnhanced.instance;
  }

  // Delegate to consolidated performance manager
  getMetrics() {
    return performanceManager.getMetrics();
  }

  recordMetric(name: string, value: number) {
    performanceManager.recordMetric(name, value);
  }

  getCoreWebVitals() {
    return performanceManager.getWebVitals();
  }
}

// Legacy exports for backward compatibility
export const performanceMonitorEnhanced = PerformanceMonitorEnhanced.getInstance();
