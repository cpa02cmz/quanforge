/**
 * Legacy Performance Monitor - DEPRECATED
 * This module has been consolidated into utils/performanceConsolidated.ts
 * Please import from performanceConsolidated.ts instead
 */

import { performanceManager } from './performanceConsolidated';

interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage: number;
  metadata: Record<string, any>;
}

interface PerformanceReport {
  totalOperations: number;
  averageDuration: number;
  slowestOperation: PerformanceMetrics;
  fastestOperation: PerformanceMetrics;
  operationsByType: Record<string, PerformanceMetrics[]>;
  memoryTrend: number[];
}

// Legacy PerformanceMonitor class for backward compatibility
class PerformanceMonitor {
  startTimer(operation: string, metadata?: Record<string, any>): () => PerformanceMetrics {
    const startTime = performance.now();
    
    return (): PerformanceMetrics => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Record in consolidated performance manager
      performanceManager.recordMetric(operation, duration);
      
      return {
        operation,
        startTime,
        endTime,
        duration,
        memoryUsage: 0, // Simplified for legacy compatibility
        metadata: metadata || {}
      };
    };
  }

  getPerformanceReport(): PerformanceReport {
    const metrics = performanceManager.getMetrics();
    
    return {
      totalOperations: metrics.length,
      averageDuration: 0, // Simplified
      slowestOperation: {} as PerformanceMetrics,
      fastestOperation: {} as PerformanceMetrics,
      operationsByType: {},
      memoryTrend: []
    };
  }

  // Delegate specific methods to consolidated manager
  recordMetric(name: string, value: number) {
    performanceManager.recordMetric(name, value);
  }

  getMetrics() {
    return performanceManager.getMetrics();
  }
}

// Export for backward compatibility
export const performanceMonitor = new PerformanceMonitor();

// Export types
export type { PerformanceMetrics, PerformanceReport };