/**
 * Service Cleanup Coordinator
 * Centralized management for service cleanup on page lifecycle events
 * 
 * Features:
 * - Coordinates cleanup of all registered services
 * - Handles beforeunload, pagehide, and visibilitychange events
 * - Provides memory pressure detection and proactive cleanup
 * - Supports idle callback for non-critical cleanup
 * 
 * Usage:
 * ```typescript
 * // Register a service for cleanup
 * serviceCleanupCoordinator.register('myService', {
 *   cleanup: () => myService.destroy(),
 *   priority: 'high', // 'high' | 'medium' | 'low'
 * });
 * 
 * // Unregister a service
 * serviceCleanupCoordinator.unregister('myService');
 * ```
 */

import { createScopedLogger } from './logger';

const logger = createScopedLogger('ServiceCleanupCoordinator');

// ========== TYPES ==========

export type CleanupPriority = 'high' | 'medium' | 'low';

export interface ServiceCleanupHandler {
  cleanup: () => void | Promise<void>;
  priority: CleanupPriority;
  description?: string;
}

export interface MemoryPressureEvent {
  level: 'low' | 'moderate' | 'critical';
  timestamp: number;
}

export interface CoordinatorMetrics {
  registeredServices: number;
  cleanupCount: number;
  lastCleanupTime: number | null;
  memoryPressureEvents: number;
}

// ========== CONSTANTS ==========

const MEMORY_PRESSURE_THRESHOLD_MB = {
  LOW: 100, // MB - Start proactive cleanup
  MODERATE: 200, // MB - Aggressive cleanup
  CRITICAL: 300, // MB - Emergency cleanup
};

const IDLE_CALLBACK_TIMEOUT = 2000; // 2 seconds max wait for idle

// ========== MAIN CLASS ==========

class ServiceCleanupCoordinator {
  private services = new Map<string, ServiceCleanupHandler>();
  private isInitialized = false;
  private metrics: CoordinatorMetrics = {
    registeredServices: 0,
    cleanupCount: 0,
    lastCleanupTime: null,
    memoryPressureEvents: 0,
  };
  private memoryCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the coordinator and set up event listeners
   */
  private initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    this.isInitialized = true;

    // Handle page unload (desktop)
    window.addEventListener('beforeunload', () => {
      this.executeCleanup('beforeunload');
    });

    // Handle page hide (mobile - more reliable than beforeunload)
    window.addEventListener('pagehide', (event) => {
      // persisted means the page is being cached (bfcache)
      if (!event.persisted) {
        this.executeCleanup('pagehide');
      }
    });

    // Handle visibility change (mobile tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Run low-priority cleanup when page is hidden
        this.executeIdleCleanup();
      }
    });

    // Handle memory pressure (if supported)
    this.setupMemoryPressureDetection();

    logger.info('Service cleanup coordinator initialized');
  }

  /**
   * Set up memory pressure detection
   */
  private setupMemoryPressureDetection(): void {
    // Check if Memory Pressure API is available
    if ('memory' in performance && 'addEventListener' in (performance as unknown as EventTarget)) {
      try {
        // @ts-expect-error - Memory Pressure API is experimental
        performance.addEventListener('pressurechange', (event: PressureRecord) => {
          const level = event.state;
          this.handleMemoryPressure(level);
        });
        logger.debug('Memory pressure API detected and enabled');
      } catch {
        // Fallback to polling for memory
        this.startMemoryPolling();
      }
    } else {
      // Fallback to polling for memory
      this.startMemoryPolling();
    }
  }

  /**
   * Start polling for memory usage (fallback)
   */
  private startMemoryPolling(): void {
    // Check memory every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000);

    // Also check on memory-pressure events (custom)
    window.addEventListener('memory-pressure', ((event: CustomEvent) => {
      this.handleMemoryPressure(event.detail?.level || 'moderate');
    }) as EventListener);
  }

  /**
   * Check current memory usage and trigger cleanup if needed
   */
  private checkMemoryUsage(): void {
    const memory = this.getMemoryInfo();
    if (!memory) return;

    const usedMB = memory.usedJSHeapSize / (1024 * 1024);
    const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
    const usagePercent = (usedMB / limitMB) * 100;

    // Determine pressure level based on usage
    let level: 'low' | 'moderate' | 'critical' | null = null;
    
    if (usagePercent > 80 || usedMB > MEMORY_PRESSURE_THRESHOLD_MB.CRITICAL) {
      level = 'critical';
    } else if (usagePercent > 60 || usedMB > MEMORY_PRESSURE_THRESHOLD_MB.MODERATE) {
      level = 'moderate';
    } else if (usagePercent > 40 || usedMB > MEMORY_PRESSURE_THRESHOLD_MB.LOW) {
      level = 'low';
    }

    if (level) {
      logger.debug(`Memory usage: ${usedMB.toFixed(1)}MB / ${limitMB.toFixed(1)}MB (${usagePercent.toFixed(1)}%) - ${level} pressure`);
      this.handleMemoryPressure(level);
    }
  }

  /**
   * Get memory info from performance API
   */
  private getMemoryInfo(): { usedJSHeapSize: number; jsHeapSizeLimit: number; totalJSHeapSize: number } | null {
    const perfWithMemory = performance as unknown as { 
      memory?: { 
        usedJSHeapSize: number; 
        jsHeapSizeLimit: number; 
        totalJSHeapSize: number;
      };
    };
    
    if (perfWithMemory.memory) {
      return perfWithMemory.memory;
    }
    return null;
  }

  /**
   * Handle memory pressure event
   */
  private handleMemoryPressure(level: 'low' | 'moderate' | 'critical'): void {
    this.metrics.memoryPressureEvents++;
    logger.warn(`Memory pressure detected: ${level}`);

    // Dispatch custom event for components to react
    window.dispatchEvent(new CustomEvent('memory-pressure', {
      detail: { level, timestamp: Date.now() }
    }));

    // Execute cleanup based on pressure level
    switch (level) {
      case 'critical':
        // Emergency: cleanup all services immediately
        this.executeCleanup('memory-critical');
        // Request garbage collection if available
        this.requestGC();
        break;
      case 'moderate':
        // Aggressive: cleanup low and medium priority
        this.executeCleanupByPriority(['low', 'medium']);
        this.requestGC();
        break;
      case 'low':
        // Proactive: cleanup only low priority via idle callback
        this.executeIdleCleanup(['low']);
        break;
    }
  }

  /**
   * Request garbage collection (if available)
   */
  private requestGC(): void {
    const windowWithGC = window as unknown as { gc?: () => void };
    if (typeof windowWithGC.gc === 'function') {
      try {
        windowWithGC.gc();
        logger.debug('Garbage collection requested');
      } catch {
        // GC not available or failed
      }
    }
  }

  /**
   * Register a service for cleanup
   */
  register(name: string, handler: ServiceCleanupHandler): () => void {
    if (this.services.has(name)) {
      logger.warn(`Service "${name}" is already registered. Overwriting.`);
    }

    this.services.set(name, handler);
    this.metrics.registeredServices = this.services.size;
    logger.debug(`Registered service: ${name} (priority: ${handler.priority})`);

    // Return unregister function
    return () => this.unregister(name);
  }

  /**
   * Unregister a service
   */
  unregister(name: string): boolean {
    const deleted = this.services.delete(name);
    if (deleted) {
      this.metrics.registeredServices = this.services.size;
      logger.debug(`Unregistered service: ${name}`);
    }
    return deleted;
  }

  /**
   * Execute cleanup for all services
   */
  private async executeCleanup(reason: string): Promise<void> {
    const startTime = Date.now();
    logger.info(`Executing cleanup (reason: ${reason}) for ${this.services.size} services`);

    // Sort by priority (high first)
    const sortedServices = Array.from(this.services.entries())
      .sort(([, a], [, b]) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    // Execute cleanup for each service
    for (const [name, handler] of sortedServices) {
      try {
        await handler.cleanup();
        logger.debug(`Cleaned up service: ${name}`);
      } catch (error) {
        logger.error(`Failed to cleanup service "${name}":`, error);
      }
    }

    this.metrics.cleanupCount++;
    this.metrics.lastCleanupTime = startTime;

    const duration = Date.now() - startTime;
    logger.info(`Cleanup completed in ${duration}ms`);
  }

  /**
   * Execute cleanup for specific priorities
   */
  private async executeCleanupByPriority(priorities: CleanupPriority[]): Promise<void> {
    const servicesToClean = Array.from(this.services.entries())
      .filter(([, handler]) => priorities.includes(handler.priority));

    logger.debug(`Executing cleanup for ${servicesToClean.length} services (priorities: ${priorities.join(', ')})`);

    for (const [name, handler] of servicesToClean) {
      try {
        await handler.cleanup();
        logger.debug(`Cleaned up service: ${name}`);
      } catch (error) {
        logger.error(`Failed to cleanup service "${name}":`, error);
      }
    }
  }

  /**
   * Execute cleanup during idle time
   */
  private executeIdleCleanup(priorities: CleanupPriority[] = ['low']): void {
    if (typeof window === 'undefined') return;

    const idleCallback = window.requestIdleCallback || 
      ((cb: IdleRequestCallback) => setTimeout(() => cb({ 
        didTimeout: false, 
        timeRemaining: () => 50 
      } as IdleDeadline), 1));

    idleCallback(() => {
      this.executeCleanupByPriority(priorities);
    }, { timeout: IDLE_CALLBACK_TIMEOUT });
  }

  /**
   * Get current metrics
   */
  getMetrics(): CoordinatorMetrics {
    return { ...this.metrics };
  }

  /**
   * Get list of registered services
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Force cleanup (for testing or manual trigger)
   */
  async forceCleanup(): Promise<void> {
    await this.executeCleanup('manual');
  }

  /**
   * Destroy the coordinator
   */
  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    this.services.clear();
    this.metrics.registeredServices = 0;
    this.isInitialized = false;
    logger.info('Service cleanup coordinator destroyed');
  }
}

// ========== SINGLETON INSTANCE ==========

export const serviceCleanupCoordinator = new ServiceCleanupCoordinator();

// ========== UTILITY HOOKS ==========

/**
 * React hook for registering a cleanup handler
 */
export function useServiceCleanup(
  name: string,
  cleanup: () => void | Promise<void>,
  priority: CleanupPriority = 'medium',
  description?: string
): void {
  // This would need to be imported from React, but we keep it simple
  // for the utility to work without React dependency
  if (typeof window !== 'undefined') {
    serviceCleanupCoordinator.register(name, { cleanup, priority, description });
  }
}

// ========== EXPORTS ==========

export default serviceCleanupCoordinator;
