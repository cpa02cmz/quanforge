import { createScopedLogger } from '../utils/logger';
import { UnifiedCacheFactory } from './unifiedCacheService';
import { MEMORY_LIMITS, CacheUtils } from '../config/cache';

const logger = createScopedLogger('MemoryMonitor');

export interface MemoryStats {
  used: number;
  total: number;
  limit: number;
  pressure: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  jsHeapSizeLimit?: number;
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
}

export interface MemoryPressureEvent {
  level: 'medium' | 'high' | 'critical';
  stats: MemoryStats;
  actions: string[];
  timestamp: number;
}

export interface MemoryPressureCallbacks {
  onMediumPressure?: (event: MemoryPressureEvent) => void;
  onHighPressure?: (event: MemoryPressureEvent) => void;
  onCriticalPressure?: (event: MemoryPressureEvent) => void;
  onPressureResolved?: (event: MemoryPressureEvent) => void;
}

/**
 * Memory Pressure Monitor
 * 
 * Monitors memory usage across cache instances and triggers
 * appropriate cleanup actions when pressure thresholds are reached.
 */
export class MemoryPressureMonitor {
  private monitoring = false;
  private monitorInterval: NodeJS.Timeout;
  private lastPressureLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  private callbacks: MemoryPressureCallbacks = {};
  private recentEvents: MemoryPressureEvent[] = [];
  private cleanupInProgress = false;
  
  private readonly MONITOR_INTERVAL = 5000; // 5 seconds
  private readonly EVENT_HISTORY_SIZE = 50;
  private readonly CLEANUP_COOLDOWN = 10000; // 10 seconds between cleanups

  constructor(callbacks: MemoryPressureCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Start monitoring memory pressure
   */
  startMonitoring(): void {
    if (this.monitoring) {
      logger.warn('Memory monitoring already started');
      return;
    }

    this.monitoring = true;
    this.monitorInterval = setInterval(() => {
      this.checkMemoryPressure();
    }, this.MONITOR_INTERVAL);

    logger.info('Memory pressure monitoring started');
  }

  /**
   * Stop monitoring memory pressure
   */
  stopMonitoring(): void {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    logger.info('Memory pressure monitoring stopped');
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const stats: MemoryStats = {
      used: 0,
      total: 0,
      limit: MEMORY_LIMITS.warningThreshold,
      pressure: 'low',
      timestamp: Date.now()
    };

    // Browser environment - use performance.memory if available
    if (typeof window !== 'undefined' && (window.performance as any).memory) {
      const memory = (window.performance as any).memory;
      stats.used = memory.usedJSHeapSize;
      stats.total = memory.totalJSHeapSize;
      stats.jsHeapSizeLimit = memory.jsHeapSizeLimit;
      stats.usedJSHeapSize = memory.usedJSHeapSize;
      stats.totalJSHeapSize = memory.totalJSHeapSize;
    }

    // Node.js environment - use process.memoryUsage()
    else if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      stats.used = memory.heapUsed;
      stats.total = memory.heapTotal;
    }

    // Add cache memory usage
    const cacheStats = UnifiedCacheFactory.getAllStats();
    let totalCacheMemory = 0;
    for (const cacheName in cacheStats) {
      totalCacheMemory += cacheStats[cacheName].memoryUsage;
    }
    stats.used += totalCacheMemory;

    // Calculate pressure level
    if (stats.used >= MEMORY_LIMITS.criticalThreshold) {
      stats.pressure = 'critical';
      stats.limit = MEMORY_LIMITS.criticalThreshold;
    } else if (stats.used >= MEMORY_LIMITS.warningThreshold) {
      stats.pressure = 'high';
      stats.limit = MEMORY_LIMITS.warningThreshold;
    } else if (stats.used >= MEMORY_LIMITS.warningThreshold * 0.7) {
      stats.pressure = 'medium';
      stats.limit = MEMORY_LIMITS.warningThreshold * 0.7;
    } else {
      stats.pressure = 'low';
    }

    return stats;
  }

  /**
   * Force immediate memory pressure check
   */
  forceCheck(): MemoryPressureEvent | null {
    return this.checkMemoryPressure();
  }

  /**
   * Get recent memory pressure events
   */
  getRecentEvents(): MemoryPressureEvent[] {
    return [...this.recentEvents];
  }

  /**
   * Update callbacks
   */
  updateCallbacks(callbacks: Partial<MemoryPressureCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Private methods

  private checkMemoryPressure(): MemoryPressureEvent | null {
    const stats = this.getMemoryStats();
    const pressureLevel = stats.pressure;

    // Skip if pressure level hasn't changed
    if (pressureLevel === this.lastPressureLevel && pressureLevel === 'low') {
      return null;
    }

    const event: MemoryPressureEvent = {
      level: pressureLevel === 'low' ? 'medium' : pressureLevel,
      stats,
      actions: [],
      timestamp: Date.now()
    };

    // Handle pressure level changes
    if (pressureLevel !== this.lastPressureLevel) {
      if (pressureLevel !== 'low') {
        this.handleMemoryPressure(event);
      } else if (this.lastPressureLevel !== 'low') {
        this.handlePressureResolved(event);
      }

      this.lastPressureLevel = pressureLevel;
      this.addEvent(event);
    }

    return pressureLevel !== 'low' ? event : null;
  }

  private handleMemoryPressure(event: MemoryPressureEvent): void {
    // Prevent concurrent cleanups
    if (this.cleanupInProgress) {
      logger.warn('Memory cleanup already in progress');
      return;
    }

    this.cleanupInProgress = true;

    try {
      const actions = event.level === 'critical' 
        ? this.handleCriticalPressure()
        : event.level === 'high'
        ? this.handleHighPressure()
        : this.handleMediumPressure();

      event.actions = actions;

      // Trigger appropriate callback
      const callback = event.level === 'critical' 
        ? this.callbacks.onCriticalPressure
        : event.level === 'high'
        ? this.callbacks.onHighPressure
        : this.callbacks.onMediumPressure;

      if (callback) {
        try {
          callback(event);
        } catch (error) {
          logger.error(`Memory pressure callback error: ${event.level}`, error);
        }
      }

      logger.warn(`Memory pressure detected: ${event.level}`, {
        usedMB: `${(event.stats.used / 1024 / 1024).toFixed(1)}MB`,
        actions: actions.length,
        timestamp: new Date(event.timestamp).toISOString()
      });

    } catch (error) {
      logger.error('Error handling memory pressure', error);
    } finally {
      setTimeout(() => {
        this.cleanupInProgress = false;
      }, this.CLEANUP_COOLDOWN);
    }
  }

  private handleCriticalPressure(): string[] {
    const actions: string[] = [];
    logger.warn('CRITICAL memory pressure - emergency cleanup initiated');

    // Force cleanup all caches
    const allStats = UnifiedCacheFactory.getAllStats();
    for (const cacheName in allStats) {
      try {
        const cache = (UnifiedCacheFactory as any).instances.get(cacheName);
        if (cache) {
          cache.forceCleanup?.();
          actions.push(`Force cleaned cache: ${cacheName}`);
        }
      } catch (error) {
        actions.push(`Failed to clean cache: ${cacheName} - ${error}`);
      }
    }

    // Trigger garbage collection in non-browser environments
    if (typeof window === 'undefined' && (global as any).gc) {
      try {
        (global as any).gc();
        actions.push('Manual garbage collection (Node.js)');
      } catch (error) {
        logger.warn('Manual GC failed', error);
      }
    }

    // Browser-specific: attempt memory cleanup hints
    if (typeof window !== 'undefined && (navigator as any)?.scheduling?.isInputPending?.() === false) {
      this.scheduleBackgroundCleanup();
      actions.push('Scheduled background cleanup');
    }

    return actions;
  }

  private handleHighPressure(): string[] {
    const actions: string[] = [];
    logger.warn('HIGH memory pressure - aggressive cleanup');

    // Aggressive cleanup with higher thresholds
    const allStats = UnifiedCacheFactory.getAllStats();
    for (const cacheName in allStats) {
      const stats = allStats[cacheName];
      if (stats.memoryPressure === 'high' || stats.memoryPressure === 'critical') {
        try {
          const cache = (UnifiedCacheFactory as any).instances.get(cacheName);
          if (cache) {
            cache.forceCleanup?.();
            actions.push(`Aggressive cleanup: ${cacheName}`);
          }
        } catch (error) {
          actions.push(`Failed cleanup: ${cacheName} - ${error}`);
        }
      }
    }

    // Clear low-priority cache entries
    this.clearLowPriorityEntries();
    actions.push('Cleared low-priority entries');

    return actions;
  }

  private handleMediumPressure(): string[] {
    const actions: string[] = [];
    logger.info('MEDIUM memory pressure - standard cleanup');

    // Standard cleanup routine
    const allStats = UnifiedCacheFactory.getAllStats();
    let totalCleaned = 0;

    for (const cacheName in allStats) {
      const stats = allStats[cacheName];
      try {
        const cache = (UnifiedCacheFactory as any).instances.get(cacheName);
        if (cache) {
          const cleaned = cache.forceCleanup?.() || 0;
          totalCleaned += cleaned;
          if (cleaned > 0) {
            actions.push(`Cleaned ${cleaned} entries from ${cacheName}`);
          }
        }
      } catch (error) {
        actions.push(`Cleanup failed for ${cacheName} - ${error}`);
      }
    }

    if (totalCleaned === 0 && actions.length === 0) {
      actions.push('Standard cleanup completed (no entries removed)');
    }

    return actions;
  }

  private handlePressureResolved(event: MemoryPressureEvent): void {
    logger.info('Memory pressure resolved', {
      usedMB: `${(event.stats.used / 1024 / 1024).toFixed(1)}MB`,
      previousLevel: this.lastPressureLevel
    });

    if (this.callbacks.onPressureResolved) {
      try {
        this.callbacks.onPressureResolved(event);
      } catch (error) {
        logger.error('Pressure resolved callback error', error);
      }
    }
  }

  private clearLowPriorityEntries(): void {
    const allStats = UnifiedCacheFactory.getAllStats();
    
    for (const cacheName in allStats) {
      try {
        const cache = (UnifiedCacheFactory as any).instances.get(cacheName);
        if (cache && cache.invalidateByTags) {
          // Invalidate entries with low priority tags
          const cleared = cache.invalidateByTags(['priority:low']);
          if (cleared > 0) {
            logger.debug(`Cleared ${cleared} low-priority entries from ${cacheName}`);
          }
        }
      } catch (error) {
        logger.warn(`Failed to clear low-priority entries from ${cacheName}`, error);
      }
    }
  }

  private scheduleBackgroundCleanup(): void {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        this.performBackgroundCleanup();
      }, { timeout: 2000 });
    } else {
      setTimeout(() => {
        this.performBackgroundCleanup();
      }, 1000);
    }
  }

  private performBackgroundCleanup(): void {
    try {
      // Gentle cleanup operations
      const allStats = UnifiedCacheFactory.getAllStats();
      for (const cacheName in allStats) {
        try {
          const cache = (UnifiedCacheFactory as any).instances.get(cacheName);
          if (cache && cache.forceCleanup) {
            cache.forceCleanup();
          }
        } catch (error) {
          // Ignore errors in background cleanup
        }
      }
    } catch (error) {
      // Ignore background cleanup errors
    }
  }

  private addEvent(event: MemoryPressureEvent): void {
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > this.EVENT_HISTORY_SIZE) {
      this.recentEvents = this.recentEvents.slice(0, this.EVENT_HISTORY_SIZE);
    }
  }
}

/**
 * Cache Health Monitor
 * 
 * Monitors cache health metrics and provides recommendations
 */
export class CacheHealthMonitor {
  private healthChecks: Array<{
    name: string;
    check: () => { status: 'healthy' | 'warning' | 'error'; message: string; metrics?: any };
  }> = [];

  constructor() {
    this.setupHealthChecks();
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<{
    overall: 'healthy' | 'warning' | 'error';
    checks: Array<{
      name: string;
      status: 'healthy' | 'warning' | 'error';
      message: string;
      metrics?: any;
    }>;
    recommendations: string[];
  }> {
    const results = [];
    let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    const recommendations: string[] = [];

    for (const healthCheck of this.healthChecks) {
      try {
        const result = healthCheck.check();
        results.push({
          name: healthCheck.name,
          ...result
        });

        if (result.status === 'error') {
          overallStatus = 'error';
        } else if (result.status === 'warning' && overallStatus !== 'error') {
          overallStatus = 'warning';
        }

      } catch (error) {
        results.push({
          name: healthCheck.name,
          status: 'error',
          message: `Health check failed: ${error}`
        });
        overallStatus = 'error';
      }
    }

    // Generate recommendations based on results
    recommendations.push(...this.generateRecommendations(results));

    return {
      overall: overallStatus,
      checks: results,
      recommendations
    };
  }

  private setupHealthChecks(): void {
    // Memory usage health check
    this.healthChecks.push({
      name: 'memory-usage',
      check: () => {
        const memoryStats = new MemoryPressureMonitor().getMemoryStats();
        
        if (memoryStats.pressure === 'critical') {
          return {
            status: 'error' as const,
            message: `Critical memory pressure: ${memoryStats.used} bytes used`,
            metrics: memoryStats
          };
        } else if (memoryStats.pressure === 'high') {
          return {
            status: 'warning' as const,
            message: `High memory pressure: ${memoryStats.used} bytes used`,
            metrics: memoryStats
          };
        }
        
        return {
          status: 'healthy' as const,
          message: `Memory usage normal: ${memoryStats.used} bytes`,
          metrics: memoryStats
        };
      }
    });

    // Cache hit rate health check
    this.healthChecks.push({
      name: 'cache-hit-rates',
      check: () => {
        const allStats = UnifiedCacheFactory.getAllStats();
        let totalHits = 0;
        let totalRequests = 0;
        let unhealthyCaches = 0;

        for (const cacheName in allStats) {
          const stats = allStats[cacheName];
          totalHits += stats.hitRate * (stats.totalRequests / 100);
          totalRequests += stats.totalRequests;
          
          if (stats.hitRate < 50 && stats.totalRequests > 100) {
            unhealthyCaches++;
          }
        }

        const overallHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

        if (overallHitRate < 40) {
          return {
            status: 'error' as const,
            message: `Very low cache hit rate: ${overallHitRate.toFixed(1)}%`,
            metrics: { overallHitRate, unhealthyCaches }
          };
        } else if (overallHitRate < 60) {
          return {
            status: 'warning' as const,
            message: `Low cache hit rate: ${overallHitRate.toFixed(1)}%`,
            metrics: { overallHitRate, unhealthyCaches }
          };
        }

        return {
          status: 'healthy' as const,
          message: `Cache hit rate acceptable: ${overallHitRate.toFixed(1)}%`,
          metrics: { overallHitRate, unhealthyCaches }
        };
      }
    });

    // Cache size health check
    this.healthChecks.push({
      name: 'cache-sizes',
      check: () => {
        const allStats = UnifiedCacheFactory.getAllStats();
        let oversizedCaches = 0;
        let totalMemory = 0;

        for (const cacheName in allStats) {
          const stats = allStats[cacheName];
          totalMemory += stats.memoryUsage;
          
          // Check if cache is using more than 80% of its typical limit
          if (stats.memoryUsage > 50 * 1024 * 1024) { // 50MB threshold
            oversizedCaches++;
          }
        }

        if (totalMemory > 200 * 1024 * 1024) { // 200MB total threshold
          return {
            status: 'error' as const,
            message: `Excessive total cache memory usage: ${(totalMemory / 1024 / 1024).toFixed(1)}MB`,
            metrics: { totalMemory, oversizedCaches }
          };
        } else if (oversizedCaches > 2) {
          return {
            status: 'warning' as const,
            message: `Multiple oversized caches: ${oversizedCaches} caches > 50MB`,
            metrics: { totalMemory, oversizedCaches }
          };
        }

        return {
          status: 'healthy' as const,
          message: `Cache memory usage normal: ${(totalMemory / 1024 / 1024).toFixed(1)}MB`,
          metrics: { totalMemory, oversizedCaches }
        };
      }
    });
  }

  private generateRecommendations(results: any[]): string[] {
    const recommendations: string[] = [];

    for (const result of results) {
      switch (result.name) {
        case 'memory-usage':
          if (result.status !== 'healthy') {
            recommendations.push('Consider reducing cache sizes or TTLs');
            recommendations.push('Enable more aggressive compression');
            recommendations.push('Review memory-intensive operations');
          }
          break;
          
        case 'cache-hit-rates':
          if (result.status !== 'healthy') {
            recommendations.push('Review cache TTLs - may be too short');
            recommendations.push('Check cache warming strategies');
            recommendations.push('Analyze access patterns for better caching');
          }
          break;
          
        case 'cache-sizes':
          if (result.status !== 'healthy') {
            recommendations.push('Implement more aggressive eviction policies');
            recommendations.push('Consider cache partitioning by data type');
            recommendations.push('Review cache configuration for oversized caches');
          }
          break;
      }
    }

    return recommendations;
  }
}

// Global singleton instances
export const memoryMonitor = new MemoryPressureMonitor({
  onHighPressure: (event) => {
    logger.warn('High memory pressure detected', {
      used: `${(event.stats.used / 1024 / 1024).toFixed(1)}MB`,
      actions: event.actions.length
    });
  },
  
  onCriticalPressure: (event) => {
    logger.error('Critical memory pressure - emergency cleanup', {
      used: `${(event.stats.used / 1024 / 1024).toFixed(1)}MB`,
      actions: event.actions.length
    });
  }
});

export const healthMonitor = new CacheHealthMonitor();