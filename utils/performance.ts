/**
 * Legacy Performance Module - DEPRECATED
 * This module has been consolidated into performanceConsolidated.ts
 * Please import from performanceConsolidated.ts instead
 */

import { performanceManager } from './performanceConsolidated';
import React from 'react';

// Legacy exports for backward compatibility
export const performanceMonitor = performanceManager;
export const measureRender = (componentName: string) => {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      performanceManager.recordMetric(`render_${componentName}`, duration);
    }
  };
};

// Hook for React components
export const usePerformanceMonitor = (componentName: string) => {
  const startTime = React.useRef<number>(performance.now());
  
  React.useEffect(() => {
    return () => {
      if (startTime.current) {
        const duration = performance.now() - startTime.current;
        performanceManager.recordMetric(`component_${componentName}`, duration);
      }
    };
  }, [componentName]);
};