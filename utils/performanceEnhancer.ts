/**
 * Performance Enhancer Service
 * Provides advanced performance optimizations for complex operations
 */

interface PerformanceConfig {
  enableDebouncing: boolean;
  enableThrottling: boolean;
  enableMemoization: boolean;
  enableVirtualization: boolean;
  enableLazyInitialization: boolean;
  enableResourcePooling: boolean;
  debounceDelay: number;
  throttleInterval: number;
  maxCacheSize: number;
}

interface ResourcePool<T> {
  available: T[];
  inUse: Set<T>;
  create: () => T;
  reset: (resource: T) => void;
  destroy: (resource: T) => void;
}

class PerformanceEnhancer {
  private config: PerformanceConfig = {
    enableDebouncing: true,
    enableThrottling: true,
    enableMemoization: true,
    enableVirtualization: true,
    enableLazyInitialization: true,
    enableResourcePooling: true,
    debounceDelay: 300,
    throttleInterval: 100,
    maxCacheSize: 100,
  };

  private memoizationCache = new Map<string, { value: any; timestamp: number }>();
  private resourcePools = new Map<string, ResourcePool<any>>();
  private debouncedFunctions = new Map<string, Function>();
  private throttledFunctions = new Map<string, { func: Function; lastExecution: number }>();

  constructor(config?: Partial<PerformanceConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Debounce a function call
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number = this.config.debounceDelay,
    key?: string
  ): (...args: Parameters<T>) => void {
    if (!this.config.enableDebouncing) {
      return func;
    }

    const debounceKey = key || func.toString();
    let timeoutId: NodeJS.Timeout | null = null;

    const debouncedFunc = (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);

      // Store the debounced function for potential cancellation
      this.debouncedFunctions.set(debounceKey, () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      });
    };

    return debouncedFunc;
  }

  /**
   * Throttle a function call
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    interval: number = this.config.throttleInterval,
    key?: string
  ): (...args: Parameters<T>) => void {
    if (!this.config.enableThrottling) {
      return func;
    }

    const throttleKey = key || func.toString();
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      const throttledEntry = this.throttledFunctions.get(throttleKey);
      const lastExecution = throttledEntry ? throttledEntry.lastExecution : 0;

      if (now - lastExecution >= interval) {
        this.throttledFunctions.set(throttleKey, { func, lastExecution: now });
        func(...args);
      }
    };
  }

  /**
   * Memoize a function with caching
   */
  memoize<T extends (...args: any[]) => any>(
    func: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ): T {
    if (!this.config.enableMemoization) {
      return func;
    }

    const defaultKeyGenerator = (...args: any[]): string => {
      return JSON.stringify(args);
    };

    const generateKey = keyGenerator || defaultKeyGenerator;

    return ((...args: Parameters<T>): any => {
      const key = generateKey(...args);
      const cached = this.memoizationCache.get(key);

      if (cached) {
        const age = Date.now() - cached.timestamp;
        // Cache TTL of 5 minutes
        if (age < 300000) {
          return cached.value;
        } else {
          // Remove expired cache entry
          this.memoizationCache.delete(key);
        }
      }

      const result = func(...args);
      this.memoizationCache.set(key, { value: result, timestamp: Date.now() });

      // Clean up cache if it exceeds max size
      if (this.memoizationCache.size > this.config.maxCacheSize) {
        const keys = Array.from(this.memoizationCache.keys());
        if (keys.length > 0) {
          const key = keys[0];
          if (key !== undefined) {
            this.memoizationCache.delete(key);
          }
        }
      }

      return result;
    }) as T;
  }

  /**
   * Create and manage a resource pool
   */
  createResourcePool<T>(
    name: string,
    create: () => T,
    reset: (resource: T) => void,
    destroy: (resource: T) => void
  ): {
    acquire: () => T;
    release: (resource: T) => void;
    destroyPool: () => void;
  } {
    if (!this.config.enableResourcePooling) {
      return {
        acquire: create,
        release: (resource: T) => destroy(resource),
        destroyPool: () => {}
      };
    }

    const pool: ResourcePool<T> = {
      available: [],
      inUse: new Set<T>(),
      create,
      reset,
      destroy
    };

    this.resourcePools.set(name, pool);

    return {
      acquire: () => {
        if (pool.available.length > 0) {
          const resource = pool.available.pop();
          if (resource) {
            pool.inUse.add(resource);
            return resource;
          }
        }
        const resource = create();
        pool.inUse.add(resource);
        return resource;
      },
      release: (resource: T) => {
        if (pool.inUse.has(resource)) {
          pool.inUse.delete(resource);
          reset(resource);
          pool.available.push(resource);
        }
      },
      destroyPool: () => {
        // Destroy all available resources
        pool.available.forEach(resource => destroy(resource));
        pool.available = [];

        // Destroy all in-use resources
        pool.inUse.forEach(resource => destroy(resource));
        pool.inUse.clear();

        this.resourcePools.delete(name);
      }
    };
  }

  /**
   * Virtualize a list rendering function
   */
  virtualize<T>(
    items: T[],
    renderItem: (item: T, index: number) => any,
    containerHeight: number,
    itemHeight: number
  ): { visibleItems: any[], startIndex: number, endIndex: number } {
    if (!this.config.enableVirtualization) {
      return {
        visibleItems: items.map((item, index) => renderItem(item, index)),
        startIndex: 0,
        endIndex: items.length - 1
      };
    }

    // Calculate visible range with buffer
    const itemsPerViewport = Math.ceil(containerHeight / itemHeight);
    const bufferSize = Math.ceil(itemsPerViewport / 2); // 50% buffer
    
    // For simplicity, we'll assume the scroll position is 0
    // In real implementation, you'd get this from scroll events
    const scrollPosition = 0;
    const startIndex = Math.max(0, Math.floor(scrollPosition / itemHeight) - bufferSize);
    const endIndex = Math.min(
      items.length - 1,
      startIndex + itemsPerViewport + (bufferSize * 2)
    );

    const visibleItems: any[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (i >= 0 && i < items.length) {
        const item = items[i];
        if (item !== undefined) {
          visibleItems.push(renderItem(item, i));
        }
      }
    }

    return { visibleItems, startIndex, endIndex };
  }

  /**
   * Lazy initialization wrapper
   */
  lazyInit<T>(initFn: () => T): () => T {
    if (!this.config.enableLazyInitialization) {
      return initFn;
    }

    let instance: T | null = null;
    let initialized = false;

    return () => {
      if (!initialized) {
        instance = initFn();
        initialized = true;
      }
      return instance!;
    };
  }

  /**
   * Batch multiple operations to optimize performance
   */
  batch<T>(operations: (() => T)[], batchSize: number = 10): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const results: T[] = [];
      let index = 0;

      const executeBatch = () => {
        if (index >= operations.length) {
          resolve(results);
          return;
        }

        const batchEnd = Math.min(index + batchSize, operations.length);
         for (let i = index; i < batchEnd; i++) {
           try {
             const operation = operations[i];
             if (operation) {
               results.push(operation());
             }
           } catch (error) {
             reject(error);
             return;
           }
         }

        index = batchEnd;

        // Yield to the event loop to prevent blocking
        if (index < operations.length) {
          setTimeout(executeBatch, 0);
        } else {
          resolve(results);
        }
      };

      executeBatch();
    });
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): {
    cacheSize: number;
    cacheHitRate: number;
    activeResourcePools: number;
    totalPooledResources: number;
  } {
    const totalResources = Array.from(this.resourcePools.values())
      .reduce((sum, pool) => sum + pool.available.length + pool.inUse.size, 0);

    return {
      cacheSize: this.memoizationCache.size,
      cacheHitRate: 0, // Would need to track hits/misses to calculate this
      activeResourcePools: this.resourcePools.size,
      totalPooledResources: totalResources
    };
  }

  /**
   * Clear all caches and pools
   */
  clearAll(): void {
    this.memoizationCache.clear();
    
    this.resourcePools.forEach(pool => {
      pool.available.forEach(resource => pool.destroy(resource));
      pool.inUse.forEach(resource => pool.destroy(resource));
      pool.inUse.clear();
    });
    
    this.resourcePools.clear();
    this.debouncedFunctions.clear();
    this.throttledFunctions.clear();
  }
}

// Singleton instance
export const performanceEnhancer = new PerformanceEnhancer();

// Export the class for potential instantiation with custom config
export { PerformanceEnhancer };