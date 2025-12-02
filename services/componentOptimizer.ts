import React, { memo, useMemo, useCallback, DependencyList } from 'react';

/**
 * Component optimization utilities for enhanced performance
 */

interface RenderMetrics {
  componentName: string;
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  totalRenderTime: number;
}

class ComponentOptimizer {
  private renderMetrics = new Map<string, RenderMetrics>();
  private memoizedComponents = new Map<string, React.ComponentType<any>>();
  
  /**
   * Create a memoized component with performance tracking
   */
  createOptimizedComponent<P extends Record<string, any>>(
    name: string,
    component: React.FunctionComponent<P>,
    propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean
  ): React.NamedExoticComponent<P> {
    // Track render metrics
    const trackedComponent: React.FunctionComponent<P> = (props) => {
      const startTime = performance.now();
      const result = component(props);
      const endTime = performance.now();
      
      this.recordRenderMetric(name, endTime - startTime);
      
      return result;
    };
    
    return memo(trackedComponent, propsAreEqual) as React.NamedExoticComponent<P>;
  }
  
  /**
   * Record render metrics for a component
   */
  private recordRenderMetric(componentName: string, renderTime: number): void {
    const existing = this.renderMetrics.get(componentName);
    if (existing) {
      const newTotal = existing.totalRenderTime + renderTime;
      const newRenderCount = existing.renderCount + 1;
      
      this.renderMetrics.set(componentName, {
        componentName,
        renderCount: newRenderCount,
        lastRenderTime: Date.now(),
        averageRenderTime: newTotal / newRenderCount,
        totalRenderTime: newTotal
      });
    } else {
      this.renderMetrics.set(componentName, {
        componentName,
        renderCount: 1,
        lastRenderTime: Date.now(),
        averageRenderTime: renderTime,
        totalRenderTime: renderTime
      });
    }
  }
  
  /**
   * Get render metrics for a component
   */
  getRenderMetrics(componentName: string): RenderMetrics | undefined {
    return this.renderMetrics.get(componentName);
  }
  
  /**
   * Get all render metrics
   */
  getAllRenderMetrics(): RenderMetrics[] {
    return Array.from(this.renderMetrics.values());
  }
  
  /**
   * Clear render metrics
   */
  clearMetrics(): void {
    this.renderMetrics.clear();
  }
  
  /**
   * Create an optimized callback with performance tracking
   */
  createOptimizedCallback<T extends (...args: any[]) => any>(
    callback: T,
    componentName: string,
    callbackName: string
  ): T {
    return ((...args: any[]) => {
      const startTime = performance.now();
      const result = callback(...args);
      const endTime = performance.now();
      
      // Log performance if callback takes too long
      if (endTime - startTime > 16.67) { // More than one frame at 60fps
        console.warn(`Slow callback detected: ${componentName}.${callbackName} took ${endTime - startTime}ms`);
      }
      
      return result;
    }) as T;
  }
  
  /**
   * Create an optimized memo hook with performance tracking
   */
  createOptimizedMemo<T>(
    factory: () => T,
    deps: DependencyList,
    componentName: string
  ): T {
    const startTime = performance.now();
    const result = useMemo(factory, deps);
    const endTime = performance.now();
    
    // Log performance if memo calculation takes too long
    if (endTime - startTime > 16.67) {
      console.warn(`Slow memo calculation in ${componentName} took ${endTime - startTime}ms`);
    }
    
    return result;
  }
  
  /**
   * Debounce function for performance optimization
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    componentName: string
  ): T {
    let timeout: NodeJS.Timeout | null = null;
    
    return ((...args: any[]) => {
      const later = () => {
        timeout = null;
        func(...args);
      };
      
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(later, wait);
    }) as T;
  }
  
  /**
   * Throttle function for performance optimization
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number,
    componentName: string
  ): T {
    let inThrottle: boolean;
    
    return ((...args: any[]) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }) as T;
  }
  
  /**
   * Virtualization helper for large lists
   */
  createVirtualizedList<T>(
    items: T[],
    itemHeight: number,
    containerHeight: number,
    renderItem: (item: T, index: number) => React.ReactNode
  ): { visibleItems: T[], visibleRange: { start: number, end: number }, totalHeight: number } {
    const totalHeight = items.length * itemHeight;
    
    // Calculate visible range
    const visibleStart = 0; // In a real implementation, this would be calculated from scroll position
    const visibleEnd = Math.min(
      Math.ceil(containerHeight / itemHeight) + 5, // +5 for buffer
      items.length
    );
    
    const visibleItems = items.slice(visibleStart, visibleEnd);
    
    return {
      visibleItems,
      visibleRange: { start: visibleStart, end: visibleEnd },
      totalHeight
    };
  }
}

export const componentOptimizer = new ComponentOptimizer();

/**
 * Hook for optimizing component performance
 */
export const useComponentOptimizer = (componentName: string) => {
  const optimizedCallback = useCallback(
    <T extends (...args: any[]) => any>(callback: T, callbackName: string): T => {
      return componentOptimizer.createOptimizedCallback(callback, componentName, callbackName);
    },
    [componentName]
  );

  const optimizedMemo = useCallback(
    <T>(factory: () => T, deps: DependencyList): T => {
      return componentOptimizer.createOptimizedMemo(factory, deps, componentName);
    },
    [componentName]
  );

  return {
    optimizedCallback,
    optimizedMemo,
    recordRenderMetric: (renderTime: number) => {
      // Public method to allow access to the private method
      const existing = componentOptimizer['renderMetrics'].get(componentName);
      if (existing) {
        const newTotal = existing.totalRenderTime + renderTime;
        const newRenderCount = existing.renderCount + 1;
        
        componentOptimizer['renderMetrics'].set(componentName, {
          componentName,
          renderCount: newRenderCount,
          lastRenderTime: Date.now(),
          averageRenderTime: newTotal / newRenderCount,
          totalRenderTime: newTotal
        });
      } else {
        componentOptimizer['renderMetrics'].set(componentName, {
          componentName,
          renderCount: 1,
          lastRenderTime: Date.now(),
          averageRenderTime: renderTime,
          totalRenderTime: renderTime
        });
      }
    },
    getMetrics: () => componentOptimizer.getRenderMetrics(componentName)
  };
};