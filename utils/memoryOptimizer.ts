/**
 * Memory Optimizer Utility for QuantForge AI
 * Provides utilities to optimize memory usage and prevent memory leaks
 */

interface MemoryStats {
  used: number;
  total: number;
  limit: number;
  percentage: number;
}

class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private cleanupInterval: number | null = null;
  private listeners: Array<() => void> = [];
  
  private constructor() {}
  
  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }
  
  /**
   * Monitor memory usage and trigger cleanup when necessary
   */
  startMonitoring(): void {
    if (this.cleanupInterval) return; // Already running
    
    this.cleanupInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000) as unknown as number; // 30 seconds
  }
  
  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Force cleanup of unused resources
   */
  forceCleanup(): void {
    // Clean up any large objects that are no longer needed
    this.cleanupLargeObjects();
    
    // Trigger any registered cleanup listeners
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.warn('Error during memory cleanup:', error);
      }
    });
    
    // If available, trigger garbage collection (only works in development)
    if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
    }
  }
  
  /**
   * Add a cleanup listener for when forceCleanup is called
   */
  addCleanupListener(listener: () => void): void {
    this.listeners.push(listener);
  }
  
  /**
   * Remove a cleanup listener
   */
  removeCleanupListener(listener: () => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * Check current memory usage and trigger cleanup if needed
   */
  private checkMemoryUsage(): void {
    const stats = this.getMemoryStats();
    
    if (stats && stats.percentage > 80) { // If using more than 80% of available memory
      console.warn('High memory usage detected:', stats);
      this.forceCleanup();
    }
  }
  
  /**
   * Get current memory statistics if available
   */
  getMemoryStats(): MemoryStats | null {
    if (typeof window !== 'undefined' && (window as any).performance && (window as any).performance.memory) {
      const memoryInfo = (window as any).performance.memory;
      return {
        used: memoryInfo.usedJSHeapSize,
        total: memoryInfo.totalJSHeapSize,
        limit: memoryInfo.jsHeapSizeLimit,
        percentage: (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100
      };
    }
    
    // Fallback: return null if memory info is not available
    return null;
  }
  
  /**
   * Clean up large objects that might be consuming memory
   */
  private cleanupLargeObjects(): void {
    // This is a placeholder for specific cleanup logic
    // In a real implementation, this would clean up large cached objects, etc.
    console.debug('Performing memory cleanup...');
  }
  
  /**
   * Optimize an array by removing unnecessary references
   */
  optimizeArray<T>(arr: T[]): T[] {
    // Create a new array to potentially free up memory
    return [...arr];
  }
  
  /**
   * Create a weak reference wrapper for objects that should be garbage collected when possible
   */
  createWeakRef<T extends object>(obj: T): WeakRef<T> | T {
    // Use WeakRef if available (newer browsers), otherwise return the object
    if (typeof WeakRef !== 'undefined') {
      return new WeakRef(obj);
    }
    return obj;
  }
  
  /**
   * Optimize string memory usage by interning common strings
   */
  internString(str: string): string {
    // This is a simplified implementation
    // In a real implementation, you might maintain a Map of common strings
    return str;
  }
  
  /**
   * Debounce function with memory optimization
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate: boolean = false
  ): T {
    let timeout: number | null = null;
    
    const debounced = function(this: any, ...args: any[]) {
      const callNow = immediate && !timeout;
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait) as unknown as number;
      
      if (callNow) func.apply(this, args);
    } as T;
    
    // Add cancel method to the debounced function
    (debounced as any).cancel = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
    
    return debounced;
  }
  
  /**
   * Throttle function with memory optimization
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): T {
    let inThrottle: boolean;
    
    return function(this: any, ...args: any[]) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    } as T;
  }
  
  /**
   * Optimize object creation by reusing objects when possible
   */
  createReusableObject<T extends Record<string, any>>(defaults: T): (updates?: Partial<T>) => T {
    let lastObj: T | null = null;
    
    return (updates?: Partial<T>) => {
      if (!lastObj) {
        lastObj = { ...defaults, ...updates } as T;
      } else {
        // Reuse the object but update its properties
        Object.assign(lastObj, defaults, updates);
      }
      return lastObj;
    };
  }
}

// Export singleton instance
export const memoryOptimizer = MemoryOptimizer.getInstance();

// Export types
export type { MemoryStats };