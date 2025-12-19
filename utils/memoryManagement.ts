/**
 * Memory Management Utilities
 * Provides optimized memory management functions for the application
 */

// Circular buffer implementation for managing large datasets
export class CircularBuffer<T> {
  private buffer: T[];
  private size: number;
  private index: number;
  private count: number;

  constructor(size: number) {
    this.buffer = new Array(size);
    this.size = size;
    this.index = 0;
    this.count = 0;
  }

  push(item: T): void {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.size;
    this.count = Math.min(this.count + 1, this.size);
  }

  toArray(): T[] {
    if (this.count < this.size) {
      return this.buffer.slice(0, this.count);
    }
    return [...this.buffer.slice(this.index), ...this.buffer.slice(0, this.index)];
  }

  get length(): number {
    return this.count;
  }

  clear(): void {
    this.count = 0;
    this.index = 0;
  }
}

// Debounce utility for performance optimization
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

// Throttle utility for performance optimization
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  let lastCall = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func(...args);
    }
  }) as T;
}

// Enhanced memory monitoring and management system
interface MemoryStats {
  used: number;
  total: number;
  limit: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  pressure: 'low' | 'medium' | 'high' | 'critical';
}

interface CacheMetrics {
  name: string;
  size: number;
  maxSize: number;
  hitRate: number;
  memoryUsage: number;
  lastCleanup: number;
  evictionRate: number;
}

interface MemoryThresholds {
  warning: number;
  critical: number;
  emergency: number;
}

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private stats: MemoryStats[] = [];
  private cacheMetrics = new Map<string, CacheMetrics>();
  private monitoringInterval: number | null = null;
  private lastGC = 0;
  private readonly thresholds: MemoryThresholds = {
    warning: 75,
    critical: 90,
    emergency: 95
  };
  private readonly maxHistoryLength = 100;
  private threshold: number;
  private onThresholdExceeded?: (usage: number) => void;

  constructor(threshold: number = 85, onThresholdExceeded?: (usage: number) => void) {
    this.threshold = threshold;
    this.onThresholdExceeded = onThresholdExceeded;
    this.startMonitoring();
  }

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  private startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = window.setInterval(() => {
      this.collectMemoryStats();
      this.checkMemoryPressure();
      this.performMaintenanceTasks();
    }, 30000); // Monitor every 30 seconds
  }

  private collectMemoryStats(): void {
    if (!('memory' in performance)) return;

    const memory = (performance as any).memory;
    const current: MemoryStats = {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      trend: this.calculateTrend(),
      pressure: this.calculatePressure(memory.usedJSHeapSize, memory.jsHeapSizeLimit)
    };

    this.stats.push(current);
    
    // Keep only recent history
    if (this.stats.length > this.maxHistoryLength) {
      this.stats = this.stats.slice(-this.maxHistoryLength);
    }

    // Check threshold for legacy callback
    if (this.onThresholdExceeded && current.percentage > this.threshold) {
      this.onThresholdExceeded(current.percentage);
    }
  }

  private calculateTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.stats.length < 3) return 'stable';
    
    const recent = this.stats.slice(-3);
    const trend = recent[2]!.used - recent[0]!.used;
    
    if (Math.abs(trend) < 1024 * 1024) { // Less than 1MB change
      return 'stable';
    }
    
    return trend > 0 ? 'increasing' : 'decreasing';
  }

  private calculatePressure(used: number, limit: number): 'low' | 'medium' | 'high' | 'critical' {
    const percentage = (used / limit) * 100;
    
    if (percentage >= this.thresholds.emergency) return 'critical';
    if (percentage >= this.thresholds.critical) return 'high';
    if (percentage >= this.thresholds.warning) return 'medium';
    return 'low';
  }

  private checkMemoryPressure(): void {
    const current = this.getCurrentStats();
    
    if (!current) return;

    switch (current.pressure) {
      case 'critical':
        this.performEmergencyCleanup();
        break;
      case 'high':
        this.performAggressiveCleanup();
        break;
      case 'medium':
        this.performLightCleanup();
        break;
    }
  }

  private performMaintenanceTasks(): void {
    const now = Date.now();
    
    // Force garbage collection every 5 minutes if available
    if (now - this.lastGC > 300000 && 'gc' in globalThis) {
      try {
        (globalThis as any).gc();
        this.lastGC = now;
      } catch (error) {
        // Ignore GC errors
      }
    }
  }

  private performEmergencyCleanup(): void {
    console.warn('🚨 Emergency memory cleanup triggered');
    
    // Clear all cache metrics and force cache cleanup
    this.cacheMetrics.forEach((_, name) => {
      this.requestCacheCleanup(name, 'emergency');
    });
    
    // Clear performance history
    this.stats = this.stats.slice(-10); // Keep only last 10 entries
    
    // Force garbage collection
    if ('gc' in globalThis) {
      try {
        (globalThis as any).gc();
      } catch (error) {
        // Ignore GC errors
      }
    }
  }

  private performAggressiveCleanup(): void {
    console.warn('⚠️ Aggressive memory cleanup triggered');
    
    // Request cleanup for low-priority caches
    this.cacheMetrics.forEach((metrics, name) => {
      if (metrics.hitRate < 0.5 || metrics.evictionRate > 0.3) {
        this.requestCacheCleanup(name, 'aggressive');
      }
    });
  }

  private performLightCleanup(): void {
    // Request cleanup for expired entries only
    this.cacheMetrics.forEach((_, name) => {
      this.requestCacheCleanup(name, 'light');
    });
  }

  private requestCacheCleanup(cacheName: string, level: 'light' | 'aggressive' | 'emergency'): void {
    // Dispatch custom event for cache systems to listen to
    window.dispatchEvent(new CustomEvent('memory-cleanup', {
      detail: { cacheName, level, timestamp: Date.now() }
    }));
  }

  registerCache(name: string, cache: {
    size: () => number;
    maxSize: number;
    hits: number;
    misses: number;
    clear: () => void;
    cleanup?: () => number;
  }): void {
    const hitRate = cache.hits + cache.misses > 0 
      ? cache.hits / (cache.hits + cache.misses) 
      : 0;

    this.cacheMetrics.set(name, {
      name,
      size: cache.size(),
      maxSize: cache.maxSize,
      hitRate,
      memoryUsage: this.estimateMemoryUsage(cache.size()),
      lastCleanup: Date.now(),
      evictionRate: 0
    });
  }

  updateCacheMetrics(name: string, updates: Partial<CacheMetrics>): void {
    const existing = this.cacheMetrics.get(name);
    if (!existing) return;

    this.cacheMetrics.set(name, { ...existing, ...updates });
  }

  private estimateMemoryUsage(size: number): number {
    return size * 512;
  }

  getCurrentStats(): MemoryStats | null {
    return this.stats.length > 0 ? this.stats[this.stats.length - 1]! : null;
  }

  getCacheMetrics(): CacheMetrics[] {
    return Array.from(this.cacheMetrics.values());
  }

  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const current = this.getCurrentStats();
    const caches = this.getCacheMetrics();

    if (!current) return recommendations;

    if (current.pressure === 'critical') {
      recommendations.push('Critical memory usage detected. Consider reducing cache sizes.');
    } else if (current.pressure === 'high') {
      recommendations.push('High memory usage. Monitor cache hit rates and consider optimization.');
    }

    caches.forEach(cache => {
      if (cache.hitRate < 0.3) {
        recommendations.push(`Cache "${cache.name}" has low hit rate (${(cache.hitRate * 100).toFixed(1)}%). Consider reducing size.`);
      }
      
      if (cache.size >= cache.maxSize * 0.9) {
        recommendations.push(`Cache "${cache.name}" is near capacity. Consider increasing maxSize or reducing TTL.`);
      }

      if (cache.memoryUsage > 50 * 1024 * 1024) {
        recommendations.push(`Cache "${cache.name}" uses significant memory (${(cache.memoryUsage / 1024 / 1024).toFixed(1)}MB).`);
      }
    });

    if (current.trend === 'increasing' && current.pressure !== 'low') {
      recommendations.push('Memory usage is trending upward. Investigate potential memory leaks.');
    }

    return recommendations;
  }

  getMemoryReport(): {
    timestamp: number;
    memory: MemoryStats | null;
    caches: CacheMetrics[];
    recommendations: string[];
    health: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  } {
    const memory = this.getCurrentStats();
    const caches = this.getCacheMetrics();
    const recommendations = this.getRecommendations();
    
    let health: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' = 'excellent';
    
    if (memory?.pressure === 'critical' || recommendations.length > 5) {
      health = 'critical';
    } else if (memory?.pressure === 'high' || recommendations.length > 3) {
      health = 'poor';
    } else if (memory?.pressure === 'medium' || recommendations.length > 1) {
      health = 'fair';
    } else if (recommendations.length > 0) {
      health = 'good';
    }

    return {
      timestamp: Date.now(),
      memory,
      caches,
      recommendations,
      health
    };
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  start(_intervalMs: number = 10000): void {
    // Legacy method - monitoring is already started in constructor
  }

  isRunning(): boolean {
    return this.monitoringInterval !== null;
  }

  forceCleanupAll(): void {
    this.cacheMetrics.forEach((_, name) => {
      this.requestCacheCleanup(name, 'aggressive');
    });
  }

  // Test-only methods
  stopMonitoring(): void {
    this.stop();
  }

  reset(): void {
    this.stats = [];
    this.cacheMetrics.clear();
  }
}

export abstract class MemoryAwareCache {
  protected memoryMonitor: MemoryMonitor;
  protected lastCleanup = 0;
  protected cleanupInterval = 60000;

  constructor(protected cacheName: string) {
    this.memoryMonitor = MemoryMonitor.getInstance();
    this.setupMemoryListener();
  }

  private setupMemoryListener(): void {
    window.addEventListener('memory-cleanup', (event: any) => {
      if (event.detail.cacheName === this.cacheName || !event.detail.cacheName) {
        this.performCleanup(event.detail.level);
      }
    });
  }

  protected performCleanup(level: 'light' | 'aggressive' | 'emergency'): void {
    const now = Date.now();
    
    switch (level) {
      case 'emergency':
        this.emergencyCleanup();
        break;
      case 'aggressive':
        this.aggressiveCleanup();
        break;
      case 'light':
      default:
        this.lightCleanup();
        break;
    }
    
    this.lastCleanup = now;
    this.updateMemoryMetrics();
  }

  protected abstract lightCleanup(): void;
  protected abstract aggressiveCleanup(): void;
  protected abstract emergencyCleanup(): void;

  protected updateMemoryMetrics(): void {
    this.memoryMonitor.updateCacheMetrics(this.cacheName, {
      lastCleanup: Date.now()
    });
  }

  abstract getMemoryUsage(): number;
  abstract getSize(): number;
  abstract getMaxSize(): number;
  abstract getHitRate(): number;
}

export const memoryMonitor = MemoryMonitor.getInstance();

if (process.env['NODE_ENV'] === 'development') {
  (window as any).memoryMonitor = memoryMonitor;
  (window as any).memoryReport = () => memoryMonitor.getMemoryReport();
}

// Cleanup manager for unified resource management
export class CleanupManager {
  private abortController: AbortController;
  private resources: Array<() => void> = [];

  constructor() {
    this.abortController = new AbortController();
  }

  addCleanup(resource: () => void): void {
    this.resources.push(resource);
  }

  cleanup(): void {
    this.abortController.abort();
    this.resources.forEach(cleanup => cleanup());
    this.resources = [];
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  isAborted(): boolean {
    return this.abortController.signal.aborted;
  }
}

// Performance measurement utility
export class PerformanceMeasure {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = performance.now();
  }

  end(): number {
    const duration = performance.now() - this.startTime;
    if (import.meta.env.DEV) {
      console.debug(`Performance [${this.label}]: ${duration.toFixed(2)}ms`);
    }
    return duration;
  }
}

// Optimized array operations
export const ArrayUtils = {
  // Efficient chunking for large arrays
  chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  // Efficient unique filtering
  unique<T>(array: T[]): T[] {
    return Array.from(new Set(array));
  },

  // Efficient filtering with early termination
  filterWithLimit<T>(
    array: T[],
    predicate: (item: T) => boolean,
    limit: number
  ): T[] {
    const result: T[] = [];
    for (const item of array) {
      if (predicate(item)) {
        result.push(item);
        if (result.length >= limit) break;
      }
    }
    return result;
  }
};

// String operations optimization
export const StringUtils = {
  // Efficient case-insensitive search
  containsIgnoreCase(text: string, search: string): boolean {
    return text.toLowerCase().includes(search.toLowerCase());
  },

  // Efficient string truncation
  truncate(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  },

  // Efficient line counting
  countLines(text: string): number {
    return (text.match(/\n/g) || []).length + 1;
  }
};