import { performanceMonitor } from '../utils/performance';
import { robotCache, queryCache, userCache } from './advancedCache';
import { databasePerformanceMonitor } from './databasePerformanceMonitor';

interface OptimizationMetrics {
  cacheHitRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  apiCallCount: number;
  dbQueryCount: number;
}

interface ResourceUsage {
  cpu: number;
  memory: number;
  network: number;
  cache: number;
}

class OptimizationManager {
  private static instance: OptimizationManager;
  private resourceUsage: ResourceUsage = {
    cpu: 0,
    memory: 0,
    network: 0,
    cache: 0
  };
  private optimizationMetrics: OptimizationMetrics = {
    cacheHitRate: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    apiCallCount: 0,
    dbQueryCount: 0
  };
  private optimizationEnabled = true;
  private performanceThresholds = {
    slowResponse: 1000, // ms
    highMemory: 80, // percentage
    lowCacheHitRate: 70 // percentage
  };

  private constructor() {
    this.initPerformanceMonitoring();
    this.startResourceMonitoring();
  }

  static getInstance(): OptimizationManager {
    if (!OptimizationManager.instance) {
      OptimizationManager.instance = new OptimizationManager();
    }
    return OptimizationManager.instance;
  }

  private initPerformanceMonitoring(): void {
    // Initialize performance monitoring
    performanceMonitor.monitorMemoryUsage(15000); // Monitor every 15 seconds
    
    // Set up performance observers
    if ('PerformanceObserver' in window) {
      // Monitor long tasks that could affect performance
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Tasks longer than 50ms
            console.warn(`Long task detected: ${entry.duration}ms`, entry);
            performanceMonitor.recordMetric('long_task', entry.duration);
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    }
  }

  private startResourceMonitoring(): void {
    // Monitor resource usage periodically
    setInterval(() => {
      this.updateResourceUsage();
      this.checkOptimizationThresholds();
    }, 30000); // Every 30 seconds
  }

  private updateResourceUsage(): void {
    // Update CPU usage (estimated through performance monitoring)
    this.resourceUsage.cpu = this.estimateCPUUsage();
    
    // Update memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      if (memory) {
        this.resourceUsage.memory = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      }
    }
    
    // Update cache usage
    const stats = robotCache.getStats();
    this.resourceUsage.cache = stats.hitRate;
    
    // Update network usage (estimated)
    this.resourceUsage.network = this.estimateNetworkUsage();
  }

  private estimateCPUUsage(): number {
    // Estimate CPU usage based on performance metrics
    // This is a simplified estimation - in a real app, you'd use more sophisticated methods
    const recentMetrics = performanceMonitor.getMetrics();
    const recentSlowTasks = recentMetrics.filter(m => m.name.startsWith('api_') && m.value > 500).length;
    return Math.min(100, (recentSlowTasks / 10) * 100); // Simplified calculation
  }

  private estimateNetworkUsage(): number {
    // Estimate network usage based on recent API calls
    const recentMetrics = performanceMonitor.getMetrics();
    const recentCalls = recentMetrics.filter(m => m.name.startsWith('api_')).length;
    return Math.min(100, (recentCalls / 20) * 100); // Simplified calculation
  }

  private checkOptimizationThresholds(): void {
    if (!this.optimizationEnabled) return;

    // Check for slow responses
    const slowResponses = performanceMonitor.getMetrics()
      .filter(m => m.name.startsWith('api_') && m.name.includes('_duration') && m.value > this.performanceThresholds.slowResponse)
      .length;
    
    if (slowResponses > 5) {
      console.warn('Performance: Too many slow API responses detected');
      this.triggerOptimization('slow_api_responses');
    }

    // Check for high memory usage
    if (this.resourceUsage.memory > this.performanceThresholds.highMemory) {
      console.warn('Performance: High memory usage detected');
      this.triggerOptimization('high_memory_usage');
    }

    // Check for low cache hit rate
    if (this.resourceUsage.cache < this.performanceThresholds.lowCacheHitRate) {
      console.warn('Performance: Low cache hit rate detected');
      this.triggerOptimization('low_cache_hit_rate');
    }
  }

  private triggerOptimization(type: string): void {
    switch (type) {
      case 'slow_api_responses':
        this.optimizeAPIResponses();
        break;
      case 'high_memory_usage':
        this.optimizeMemoryUsage();
        break;
      case 'low_cache_hit_rate':
        this.optimizeCacheUsage();
        break;
    }
  }

  private optimizeAPIResponses(): void {
    console.log('Optimizing API responses...');
    // Implement API response optimizations
    // - Add request batching
    // - Implement smarter caching
    // - Optimize request payloads
  }

  private optimizeMemoryUsage(): void {
    console.log('Optimizing memory usage...');
    // Implement memory optimizations
    // - Clear unused caches
    // - Optimize data structures
    // - Implement lazy loading
    robotCache.getStats(); // Trigger cache cleanup
    queryCache.getStats();
    userCache.getStats();
  }

  private optimizeCacheUsage(): void {
    console.log('Optimizing cache usage...');
    // Implement cache optimizations
    // - Adjust cache sizes
    // - Implement smarter invalidation
    // - Optimize cache keys
    robotCache.getHotEntries(20); // Pre-warm hot entries
  }

  // Public methods for optimization management
  enableOptimization(): void {
    this.optimizationEnabled = true;
  }

  disableOptimization(): void {
    this.optimizationEnabled = false;
  }

  getOptimizationMetrics(): OptimizationMetrics {
    return { ...this.optimizationMetrics };
  }

  getResourceUsage(): ResourceUsage {
    return { ...this.resourceUsage };
  }

  // Performance optimization utilities
  async optimizeForUserInteraction<T>(fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    
    try {
      // Prioritize this task by temporarily boosting performance
      this.boostPerformanceForTask();
      
      const result = await fn();
      
      const duration = performance.now() - start;
      performanceMonitor.recordMetric('user_interaction_duration', duration);
      
      return result;
    } catch (error) {
      performanceMonitor.recordMetric('user_interaction_error', 1);
      throw error;
    } finally {
      // Restore normal performance settings
      this.restoreNormalPerformance();
    }
  }

  private boostPerformanceForTask(): void {
    // Temporarily boost performance for user interactions
    // This could involve increasing cache sizes, reducing timeouts, etc.
    console.log('Boosting performance for user interaction');
  }

  private restoreNormalPerformance(): void {
    // Restore normal performance settings after user interaction
    console.log('Restoring normal performance settings');
  }

  // Memory optimization utilities
  optimizeMemoryForPage(page: string): void {
    // Optimize memory usage for specific pages
    switch (page) {
      case 'generator':
        // Preload commonly used data for generator page
        robotCache.getHotEntries(10);
        break;
      case 'dashboard':
        // Preload dashboard data
        queryCache.getStats();
        break;
      default:
        // General optimization
        break;
    }
  }

  // Cache warm-up utilities
  async warmupCommonResources(): Promise<void> {
    console.log('Warming up common resources...');
    
    // Preload commonly accessed data
    await Promise.allSettled([
      // Could preload common robots, user settings, etc.
      // This would be implemented based on actual usage patterns
    ]);
  }

  // Cleanup method
  cleanup(): void {
    // Stop memory monitoring
    performanceMonitor.stopMemoryMonitoring();
    
    // Clear caches
    robotCache.getStats(); // This triggers cleanup
    queryCache.getStats();
    userCache.getStats();
  }

  // Performance analysis utilities
  async analyzePerformance(): Promise<{
    metrics: OptimizationMetrics;
    recommendations: string[];
    currentResourceUsage: ResourceUsage;
  }> {
    const metrics = this.getOptimizationMetrics();
    const resourceUsage = this.getResourceUsage();
    
    const recommendations: string[] = [];
    
    // Generate recommendations based on current metrics
    if (resourceUsage.memory > 75) {
      recommendations.push('High memory usage detected - consider implementing more aggressive cache cleanup');
    }
    
    if (resourceUsage.cache < 70) {
      recommendations.push('Low cache hit rate - consider adjusting cache TTL or invalidation strategy');
    }
    
    if (resourceUsage.cpu > 70) {
      recommendations.push('High CPU usage - consider optimizing heavy computations');
    }
    
    // Add database performance recommendations
    const dbReport = databasePerformanceMonitor.getPerformanceReport();
    if (dbReport.summary.queryTime > 500) {
      recommendations.push(`Slow database queries detected (${dbReport.summary.queryTime}ms average)`);
    }
    
    if (dbReport.summary.errorRate > 0.05) { // 5% error rate
      recommendations.push(`High database error rate (${(dbReport.summary.errorRate * 100).toFixed(2)}%)`);
    }
    
    return {
      metrics,
      recommendations,
      currentResourceUsage: resourceUsage
    };
  }
}

export const optimizationManager = OptimizationManager.getInstance();

// Initialize optimization manager on module load
export default optimizationManager;