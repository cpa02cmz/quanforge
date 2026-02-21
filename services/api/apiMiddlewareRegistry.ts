/**
 * API Middleware Registry - Composable Middleware System for API Operations
 * 
 * This module provides a flexible middleware system that allows for:
 * - Composable request/response processing
 * - Priority-based middleware execution
 * - Conditional middleware activation
 * - Async middleware support
 * - Easy testing and debugging
 * 
 * @module services/api/apiMiddlewareRegistry
 * @since 2026-02-21
 * @author API Specialist Agent
 */

import { createScopedLogger } from '../../utils/logger';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('APIMiddlewareRegistry');

// ============= Types =============

/**
 * Middleware context passed through the middleware chain
 */
export interface MiddlewareContext<T = unknown> {
  /** Unique request identifier */
  requestId: string;
  /** Request URL */
  url: string;
  /** HTTP method */
  method: string;
  /** Request headers */
  headers: Headers;
  /** Request body */
  body?: BodyInit | null;
  /** Request metadata */
  metadata: Record<string, unknown>;
  /** Start timestamp */
  startTime: number;
  /** Custom data that can be modified by middleware */
  state: T;
  /** Whether the request has been aborted */
  aborted: boolean;
  /** Abort reason if aborted */
  abortReason?: string;
}

/**
 * Middleware execution phase
 */
export type MiddlewarePhase = 'pre-request' | 'post-request' | 'error' | 'finally';

/**
 * Middleware priority (higher = executed first)
 */
export type MiddlewarePriority = 'critical' | 'high' | 'normal' | 'low' | 'lowest';

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /** Unique middleware name */
  name: string;
  /** Execution phase */
  phase: MiddlewarePhase;
  /** Execution priority */
  priority: MiddlewarePriority;
  /** Whether middleware is enabled */
  enabled: boolean;
  /** Condition to check before running middleware */
  condition?: (context: MiddlewareContext) => boolean;
  /** Maximum execution time in milliseconds */
  timeout?: number;
  /** Whether to skip on error */
  skipOnError?: boolean;
  /** Middleware description */
  description?: string;
}

/**
 * Middleware function type
 */
export type MiddlewareFunction<T = unknown, R = unknown> = (
  context: MiddlewareContext<T>,
  next: () => Promise<MiddlewareContext<R>>
) => Promise<MiddlewareContext<R>>;

/**
 * Registered middleware entry
 */
interface MiddlewareEntry {
  config: MiddlewareConfig;
  handler: MiddlewareFunction;
  stats: {
    executions: number;
    successes: number;
    failures: number;
    totalDuration: number;
    lastExecution?: number;
    lastError?: string;
  };
}

/**
 * Middleware execution result
 */
export interface MiddlewareResult<T = unknown> {
  context: MiddlewareContext<T>;
  executed: string[];
  skipped: string[];
  failed: string[];
  duration: number;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalMiddlewares: number;
  enabledMiddlewares: number;
  totalExecutions: number;
  totalSuccesses: number;
  totalFailures: number;
  averageDuration: number;
  middlewares: Record<string, {
    executions: number;
    successes: number;
    failures: number;
    averageDuration: number;
    lastError?: string;
  }>;
}

// ============= Priority Values =============

const PRIORITY_VALUES: Record<MiddlewarePriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
  lowest: 0,
};

// ============= API Middleware Registry Class =============

/**
 * API Middleware Registry
 * 
 * A flexible middleware system for composable request/response processing.
 * Supports multiple execution phases, priority ordering, and conditional activation.
 */
export class APIMiddlewareRegistry {
  private middlewares = new Map<MiddlewarePhase, MiddlewareEntry[]>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  
  // Global statistics
  private stats = {
    totalExecutions: 0,
    totalSuccesses: 0,
    totalFailures: 0,
    totalDuration: 0,
  };

  constructor() {
    // Start periodic cleanup
    this.startCleanup();
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiMiddlewareRegistry', {
        cleanup: () => this.destroy(),
        priority: 'medium',
        description: 'API middleware registry service',
      });
    }
    
    // Register built-in middlewares
    this.registerBuiltinMiddlewares();
    
    logger.info('API Middleware Registry initialized');
  }

  // ============= Registration Methods =============

  /**
   * Register a new middleware
   */
  register<T = unknown, R = unknown>(
    config: MiddlewareConfig,
    handler: MiddlewareFunction<T, R>
  ): () => void {
    const phaseMiddlewares = this.middlewares.get(config.phase) || [];
    
    const entry: MiddlewareEntry = {
      config,
      handler: handler as MiddlewareFunction,
      stats: {
        executions: 0,
        successes: 0,
        failures: 0,
        totalDuration: 0,
      },
    };
    
    phaseMiddlewares.push(entry);
    
    // Sort by priority (higher first)
    phaseMiddlewares.sort((a, b) => 
      PRIORITY_VALUES[b.config.priority] - PRIORITY_VALUES[a.config.priority]
    );
    
    this.middlewares.set(config.phase, phaseMiddlewares);
    
    logger.debug(`Registered middleware: ${config.name} (${config.phase}, ${config.priority})`);
    
    // Return unregister function
    return () => {
      this.unregister(config.name, config.phase);
    };
  }

  /**
   * Unregister a middleware by name and phase
   */
  unregister(name: string, phase: MiddlewarePhase): boolean {
    const phaseMiddlewares = this.middlewares.get(phase);
    if (!phaseMiddlewares) return false;
    
    const index = phaseMiddlewares.findIndex(m => m.config.name === name);
    if (index === -1) return false;
    
    phaseMiddlewares.splice(index, 1);
    logger.debug(`Unregistered middleware: ${name} (${phase})`);
    
    return true;
  }

  /**
   * Enable a middleware by name
   */
  enable(name: string, phase?: MiddlewarePhase): boolean {
    return this.setMiddlewareEnabled(name, true, phase);
  }

  /**
   * Disable a middleware by name
   */
  disable(name: string, phase?: MiddlewarePhase): boolean {
    return this.setMiddlewareEnabled(name, false, phase);
  }

  /**
   * Check if a middleware is registered
   */
  has(name: string, phase?: MiddlewarePhase): boolean {
    if (phase) {
      const phaseMiddlewares = this.middlewares.get(phase);
      return phaseMiddlewares?.some(m => m.config.name === name) ?? false;
    }
    
    for (const middlewares of this.middlewares.values()) {
      if (middlewares.some(m => m.config.name === name)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get middleware configuration
   */
  get(name: string, phase: MiddlewarePhase): MiddlewareConfig | null {
    const phaseMiddlewares = this.middlewares.get(phase);
    const entry = phaseMiddlewares?.find(m => m.config.name === name);
    return entry?.config ?? null;
  }

  // ============= Execution Methods =============

  /**
   * Execute middlewares for a given phase
   */
  async execute<T = unknown>(
    phase: MiddlewarePhase,
    initialContext: MiddlewareContext<T>
  ): Promise<MiddlewareResult<T>> {
    const startTime = Date.now();
    const phaseMiddlewares = this.middlewares.get(phase) || [];
    
    const executed: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    
    let currentContext = initialContext;
    
    // Create a chain of middlewares
    const chain = phaseMiddlewares
      .filter(entry => {
        if (!entry.config.enabled) {
          skipped.push(entry.config.name);
          return false;
        }
        
        if (entry.config.condition && !entry.config.condition(currentContext)) {
          skipped.push(entry.config.name);
          return false;
        }
        
        return true;
      });
    
    // Execute middleware chain
    for (const entry of chain) {
      if (currentContext.aborted) {
        skipped.push(entry.config.name);
        continue;
      }
      
      const middlewareStart = Date.now();
      
      try {
        // Execute with optional timeout
        currentContext = await this.executeWithTimeout(
          entry,
          currentContext
        );
        
        entry.stats.executions++;
        entry.stats.successes++;
        entry.stats.totalDuration += Date.now() - middlewareStart;
        entry.stats.lastExecution = Date.now();
        
        executed.push(entry.config.name);
        
      } catch (error: unknown) {
        entry.stats.executions++;
        entry.stats.failures++;
        entry.stats.totalDuration += Date.now() - middlewareStart;
        entry.stats.lastError = error instanceof Error ? error.message : String(error);
        
        failed.push(entry.config.name);
        
        // Continue to next middleware unless critical
        if (entry.config.priority === 'critical') {
          currentContext.aborted = true;
          currentContext.abortReason = `Critical middleware failed: ${entry.config.name}`;
        }
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Update global stats
    this.stats.totalExecutions++;
    this.stats.totalDuration += duration;
    if (failed.length === 0) {
      this.stats.totalSuccesses++;
    } else {
      this.stats.totalFailures++;
    }
    
    return {
      context: currentContext,
      executed,
      skipped,
      failed,
      duration,
    };
  }

  /**
   * Execute pre-request middlewares
   */
  async executePreRequest<T = unknown>(
    context: MiddlewareContext<T>
  ): Promise<MiddlewareResult<T>> {
    return this.execute('pre-request', context);
  }

  /**
   * Execute post-request middlewares
   */
  async executePostRequest<T = unknown>(
    context: MiddlewareContext<T>
  ): Promise<MiddlewareResult<T>> {
    return this.execute('post-request', context);
  }

  /**
   * Execute error middlewares
   */
  async executeError<T = unknown>(
    context: MiddlewareContext<T>
  ): Promise<MiddlewareResult<T>> {
    return this.execute('error', context);
  }

  /**
   * Execute finally middlewares
   */
  async executeFinally<T = unknown>(
    context: MiddlewareContext<T>
  ): Promise<MiddlewareResult<T>> {
    return this.execute('finally', context);
  }

  // ============= Statistics Methods =============

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const middlewares: RegistryStats['middlewares'] = {};
    let enabledCount = 0;
    
    for (const [phase, entries] of this.middlewares.entries()) {
      for (const entry of entries) {
        if (entry.config.enabled) {
          enabledCount++;
        }
        
        middlewares[entry.config.name] = {
          executions: entry.stats.executions,
          successes: entry.stats.successes,
          failures: entry.stats.failures,
          averageDuration: entry.stats.executions > 0
            ? entry.stats.totalDuration / entry.stats.executions
            : 0,
          lastError: entry.stats.lastError,
        };
      }
    }
    
    return {
      totalMiddlewares: Object.keys(middlewares).length,
      enabledMiddlewares: enabledCount,
      totalExecutions: this.stats.totalExecutions,
      totalSuccesses: this.stats.totalSuccesses,
      totalFailures: this.stats.totalFailures,
      averageDuration: this.stats.totalExecutions > 0
        ? this.stats.totalDuration / this.stats.totalExecutions
        : 0,
      middlewares,
    };
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.stats = {
      totalExecutions: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalDuration: 0,
    };
    
    for (const entries of this.middlewares.values()) {
      for (const entry of entries) {
        entry.stats = {
          executions: 0,
          successes: 0,
          failures: 0,
          totalDuration: 0,
        };
      }
    }
    
    logger.info('Middleware registry statistics reset');
  }

  // ============= Helper Methods =============

  /**
   * Create a new middleware context
   */
  createContext<T = unknown>(options: {
    requestId: string;
    url: string;
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit | null;
    metadata?: Record<string, unknown>;
    state?: T;
  }): MiddlewareContext<T> {
    return {
      requestId: options.requestId,
      url: options.url,
      method: options.method || 'GET',
      headers: options.headers instanceof Headers 
        ? options.headers 
        : new Headers(options.headers),
      body: options.body,
      metadata: options.metadata || {},
      state: options.state || ({} as T),
      startTime: Date.now(),
      aborted: false,
    };
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares.clear();
    logger.info('All middlewares cleared');
  }

  /**
   * Destroy the registry
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    logger.info('API Middleware Registry destroyed');
  }

  // ============= Private Methods =============

  private setMiddlewareEnabled(
    name: string, 
    enabled: boolean, 
    phase?: MiddlewarePhase
  ): boolean {
    const phases = phase ? [phase] : Array.from(this.middlewares.keys()) as MiddlewarePhase[];
    
    for (const p of phases) {
      const phaseMiddlewares = this.middlewares.get(p);
      const entry = phaseMiddlewares?.find(m => m.config.name === name);
      
      if (entry) {
        entry.config.enabled = enabled;
        logger.debug(`Middleware ${name} ${enabled ? 'enabled' : 'disabled'}`);
        return true;
      }
    }
    
    return false;
  }

  private async executeWithTimeout<T>(
    entry: MiddlewareEntry,
    context: MiddlewareContext<T>
  ): Promise<MiddlewareContext<T>> {
    const handler = entry.handler as MiddlewareFunction<T, T>;
    
    if (!entry.config.timeout) {
      // No timeout, just execute
      return handler(context, async () => context);
    }
    
    // Execute with timeout
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Middleware ${entry.config.name} timed out`));
      }, entry.config.timeout);
      
      handler(context, async () => context)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result as MiddlewareContext<T>);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private registerBuiltinMiddlewares(): void {
    // Request ID middleware
    this.register(
      {
        name: 'request-id',
        phase: 'pre-request',
        priority: 'critical',
        enabled: true,
        description: 'Adds unique request ID to headers',
      },
      async (context, next) => {
        if (!context.headers.has('X-Request-ID')) {
          context.headers.set('X-Request-ID', context.requestId);
        }
        return next();
      }
    );
    
    // Timing middleware
    this.register(
      {
        name: 'timing',
        phase: 'pre-request',
        priority: 'high',
        enabled: true,
        description: 'Records request timing',
      },
      async (context, next) => {
        context.metadata.timingStart = Date.now();
        const result = await next();
        result.metadata.timingEnd = Date.now();
        result.metadata.duration = (result.metadata.timingEnd as number) - (result.metadata.timingStart as number);
        return result;
      }
    );
    
    // Error logging middleware
    this.register(
      {
        name: 'error-logging',
        phase: 'error',
        priority: 'normal',
        enabled: true,
        description: 'Logs errors that occur during request processing',
      },
      async (context, next) => {
        logger.error(`Request error: ${context.url}`, {
          requestId: context.requestId,
          method: context.method,
          abortReason: context.abortReason,
        });
        return next();
      }
    );
    
    // Response time header middleware
    this.register(
      {
        name: 'response-time',
        phase: 'post-request',
        priority: 'low',
        enabled: true,
        description: 'Adds X-Response-Time header',
      },
      async (context, next) => {
        const result = await next();
        const duration = Date.now() - context.startTime;
        result.metadata.responseTime = duration;
        return result;
      }
    );
  }

  private startCleanup(): void {
    // Periodic cleanup of old stats (every hour)
    this.cleanupInterval = setInterval(() => {
      // Reset stats that are too old
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const entries of this.middlewares.values()) {
        for (const entry of entries) {
          if (entry.stats.lastExecution && Date.now() - entry.stats.lastExecution > maxAge) {
            entry.stats = {
              executions: 0,
              successes: 0,
              failures: 0,
              totalDuration: 0,
            };
          }
        }
      }
    }, 60 * 60 * 1000);
  }
}

// ============= Singleton Instance =============

let middlewareRegistryInstance: APIMiddlewareRegistry | null = null;

/**
 * Get the middleware registry instance
 */
export const getAPIMiddlewareRegistry = (): APIMiddlewareRegistry => {
  if (!middlewareRegistryInstance) {
    middlewareRegistryInstance = new APIMiddlewareRegistry();
  }
  return middlewareRegistryInstance;
};

/**
 * Initialize the middleware registry
 */
export const initializeAPIMiddlewareRegistry = (): APIMiddlewareRegistry => {
  if (middlewareRegistryInstance) {
    middlewareRegistryInstance.destroy();
  }
  middlewareRegistryInstance = new APIMiddlewareRegistry();
  return middlewareRegistryInstance;
};

/**
 * Check if middleware registry is initialized
 */
export const hasAPIMiddlewareRegistry = (): boolean => {
  return middlewareRegistryInstance !== null;
};

// ============= Convenience Functions =============

/**
 * Register a pre-request middleware
 */
export const registerPreRequestMiddleware = (
  name: string,
  handler: MiddlewareFunction,
  options?: Partial<MiddlewareConfig>
): (() => void) => 
  getAPIMiddlewareRegistry().register(
    { name, phase: 'pre-request', priority: 'normal', enabled: true, ...options },
    handler
  );

/**
 * Register a post-request middleware
 */
export const registerPostRequestMiddleware = (
  name: string,
  handler: MiddlewareFunction,
  options?: Partial<MiddlewareConfig>
): (() => void) => 
  getAPIMiddlewareRegistry().register(
    { name, phase: 'post-request', priority: 'normal', enabled: true, ...options },
    handler
  );

/**
 * Register an error middleware
 */
export const registerErrorMiddleware = (
  name: string,
  handler: MiddlewareFunction,
  options?: Partial<MiddlewareConfig>
): (() => void) => 
  getAPIMiddlewareRegistry().register(
    { name, phase: 'error', priority: 'normal', enabled: true, ...options },
    handler
  );

// ============= React Hook =============

/**
 * React hook for using the middleware registry
 */
export const useAPIMiddleware = () => {
  const registry = getAPIMiddlewareRegistry();
  
  return {
    register: <T = unknown, R = unknown>(
      config: MiddlewareConfig,
      handler: MiddlewareFunction<T, R>
    ) => registry.register(config, handler),
    unregister: (name: string, phase: MiddlewarePhase) => registry.unregister(name, phase),
    enable: (name: string, phase?: MiddlewarePhase) => registry.enable(name, phase),
    disable: (name: string, phase?: MiddlewarePhase) => registry.disable(name, phase),
    has: (name: string, phase?: MiddlewarePhase) => registry.has(name, phase),
    get: (name: string, phase: MiddlewarePhase) => registry.get(name, phase),
    execute: <T = unknown>(phase: MiddlewarePhase, context: MiddlewareContext<T>) =>
      registry.execute(phase, context),
    createContext: <T = unknown>(options: {
      requestId: string;
      url: string;
      method?: string;
      headers?: HeadersInit;
      body?: BodyInit | null;
      metadata?: Record<string, unknown>;
      state?: T;
    }) => registry.createContext<T>(options),
    getStats: () => registry.getStats(),
    resetStats: () => registry.resetStats(),
  };
};
