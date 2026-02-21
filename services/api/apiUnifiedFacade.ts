/**
 * Unified API Facade - Single Entry Point for All API Operations
 * 
 * This module provides a unified facade that orchestrates all API services:
 * - Request deduplication (via ApiDeduplicator)
 * - Rate limiting (via RateLimiter)
 * - Security validation (via APISecurityManager)
 * - Response caching (via APIResponseCache)
 * - Request interceptors (via InterceptorManager)
 * - Metrics collection (via APIMetricsCollector)
 * - Health monitoring (via APIHealthMonitor)
 * 
 * Benefits:
 * - Single entry point for all API calls
 * - Automatic request optimization
 * - Comprehensive error handling
 * - Built-in observability
 * - Configurable middleware chain
 * 
 * @module services/api/apiUnifiedFacade
 * @since 2026-02-21
 * @author API Specialist Agent
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS, API_CONFIG } from '../../constants/config';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';
import { 
  StandardizedAPIResponse, 
  apiResponseHandler,
  HTTP_STATUS 
} from './APIResponseHandler';
import { InterceptorManager, RequestConfig, interceptorManager } from './APIInterceptors';
import { apiResponseCache, CacheOptions } from './apiResponseCache';
import { apiMetricsCollector, RequestMetric } from './apiMetricsCollector';
import { apiHealthMonitor } from './apiHealthMonitor';
import { apiRequestDeduplicator, RequestFingerprint } from './apiRequestDeduplicator';
import { RateLimiter } from '../security/RateLimiter';

const logger = createScopedLogger('UnifiedAPIFacade');

// ============= Types =============

/**
 * Configuration for the unified API facade
 */
export interface UnifiedAPIConfig {
  /** Enable request deduplication */
  enableDeduplication: boolean;
  /** Enable rate limiting */
  enableRateLimiting: boolean;
  /** Enable security validation */
  enableSecurity: boolean;
  /** Enable response caching */
  enableCaching: boolean;
  /** Enable metrics collection */
  enableMetrics: boolean;
  /** Enable health monitoring */
  enableHealthMonitoring: boolean;
  /** Default timeout in milliseconds */
  defaultTimeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Base delay for retries (exponential backoff) */
  retryBaseDelay: number;
  /** User tier for rate limiting */
  userTier: 'basic' | 'premium' | 'enterprise';
  /** Custom headers to include in all requests */
  defaultHeaders: Record<string, string>;
}

/**
 * Request options specific to the unified facade
 */
export interface UnifiedRequestOptions {
  /** Request URL */
  url: string;
  /** HTTP method */
  method?: string;
  /** Request headers */
  headers?: HeadersInit;
  /** Request body */
  body?: BodyInit | null;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Base delay for retries */
  retryDelay?: number;
  /** Cache key for deduplication and caching */
  cacheKey?: string;
  /** Cache options */
  cacheOptions?: CacheOptions;
  /** Skip all optimizations (direct fetch) */
  skipOptimizations?: boolean;
  /** Skip deduplication only */
  skipDeduplication?: boolean;
  /** Skip caching only */
  skipCache?: boolean;
  /** Skip rate limiting only */
  skipRateLimiting?: boolean;
  /** Skip security validation only */
  skipSecurity?: boolean;
  /** Priority for request queue */
  priority?: 'high' | 'medium' | 'low';
  /** Request metadata for logging/tracing */
  metadata?: Record<string, unknown>;
  /** Custom deduplication key generator */
  deduplicationKeyGenerator?: () => string;
}

/**
 * Statistics from the unified facade
 */
export interface UnifiedAPIStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  deduplicatedRequests: number;
  cachedResponses: number;
  rateLimitedRequests: number;
  securityBlockedRequests: number;
  averageResponseTime: number;
  activeRequests: number;
}

/**
 * Health status of the unified API
 */
export interface UnifiedAPIHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    cache: boolean;
    deduplicator: boolean;
    rateLimiter: boolean;
    metrics: boolean;
    healthMonitor: boolean;
  };
  lastCheck: number;
}

// ============= Default Configuration =============

const DEFAULT_CONFIG: UnifiedAPIConfig = {
  enableDeduplication: true,
  enableRateLimiting: true,
  enableSecurity: true,
  enableCaching: true,
  enableMetrics: true,
  enableHealthMonitoring: true,
  defaultTimeout: API_CONFIG.REQUEST_TIMEOUT,
  maxRetries: API_CONFIG.MAX_RETRY_ATTEMPTS,
  retryBaseDelay: 1000,
  userTier: 'basic',
  defaultHeaders: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
};

// ============= Unified API Facade Class =============

/**
 * Unified API Facade
 * 
 * A single entry point that orchestrates all API services with:
 * - Automatic request deduplication
 * - Rate limiting per user tier
 * - Security validation
 * - Response caching
 * - Metrics collection
 * - Health monitoring
 */
export class UnifiedAPIFacade {
  private config: UnifiedAPIConfig;
  private rateLimiter: RateLimiter;
  private interceptorManager: InterceptorManager;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  
  // Statistics tracking
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    deduplicatedRequests: 0,
    cachedResponses: 0,
    rateLimitedRequests: 0,
    securityBlockedRequests: 0,
    totalResponseTime: 0,
    activeRequests: 0,
  };

  constructor(config: Partial<UnifiedAPIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = new RateLimiter({
      maxRequests: 100,
      windowMs: 60000,
      maxPayloadSize: 10 * 1024 * 1024, // 10MB
    });
    this.interceptorManager = interceptorManager;
    
    // Start periodic cleanup
    this.startCleanup();
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('unifiedAPIFacade', {
        cleanup: () => this.destroy(),
        priority: 'high',
        description: 'Unified API facade service',
      });
    }
    
    logger.info('Unified API Facade initialized', { config: this.config });
  }

  // ============= Core Request Methods =============

  /**
   * Make a unified API request with all optimizations
   */
  async request<T = unknown>(options: UnifiedRequestOptions): Promise<StandardizedAPIResponse<T>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    this.stats.totalRequests++;
    this.stats.activeRequests++;

    try {
      // Skip all optimizations if requested
      if (options.skipOptimizations) {
        return this.executeDirectRequest<T>(options, requestId, startTime);
      }

      // Generate cache key if not provided
      const cacheKey = options.cacheKey || this.generateCacheKey(options);

      // 1. Check cache first (for GET requests)
      if (this.config.enableCaching && !options.skipCache && options.method === 'GET') {
        const cached = apiResponseCache.get<T>(cacheKey);
        if (cached !== null) {
          this.stats.cachedResponses++;
          this.recordMetric(options.url, Date.now() - startTime, true, 'cache_hit');
          return apiResponseHandler.success(cached, {
            requestId,
            duration: 0,
            cached: true,
          });
        }
      }

      // 2. Check for deduplication
      if (this.config.enableDeduplication && !options.skipDeduplication) {
        const fingerprint: RequestFingerprint = {
          url: options.url,
          method: options.method || 'GET',
        };
        const isPending = apiRequestDeduplicator.isPending(fingerprint);
        if (isPending) {
          this.stats.deduplicatedRequests++;
        }
        
        // Execute through deduplicator
        return apiRequestDeduplicator.execute(
          () => this.executeOptimizedRequest<T>(options, requestId, startTime, cacheKey),
          fingerprint,
          { skipDeduplication: false }
        );
      }

      // 3. Execute with optimizations
      return this.executeOptimizedRequest<T>(options, requestId, startTime, cacheKey);
      
    } catch (error: unknown) {
      this.stats.failedRequests++;
      this.recordMetric(options.url, Date.now() - startTime, false, 'error');
      
      return apiResponseHandler.error(error, {
        requestId,
        duration: Date.now() - startTime,
      });
    } finally {
      this.stats.activeRequests--;
    }
  }

  /**
   * Execute a request with all optimizations applied
   */
  private async executeOptimizedRequest<T>(
    options: UnifiedRequestOptions,
    requestId: string,
    startTime: number,
    cacheKey: string
  ): Promise<StandardizedAPIResponse<T>> {
    // 1. Rate limiting check
    if (this.config.enableRateLimiting && !options.skipRateLimiting) {
      const rateLimitResult = this.rateLimiter.checkAdaptiveRateLimit(
        requestId,
        this.config.userTier
      );
      
      if (!rateLimitResult.allowed) {
        this.stats.rateLimitedRequests++;
        this.recordMetric(options.url, 0, false, 'rate_limited');
        
        const error = new Error(`Rate limit exceeded. Retry after ${rateLimitResult.retryAfter}s`) as Error & { status: number; code: string };
        error.status = HTTP_STATUS.TOO_MANY_REQUESTS;
        error.code = 'RATE_LIMITED';
        
        return apiResponseHandler.error(error, {
          requestId,
          duration: Date.now() - startTime,
        });
      }
    }

    // 2. Security validation (for request body)
    if (this.config.enableSecurity && !options.skipSecurity && options.body) {
      const securityCheck = this.validateRequestBody(options.body);
      if (!securityCheck.valid) {
        this.stats.securityBlockedRequests++;
        this.recordMetric(options.url, 0, false, 'security_blocked');
        
        const error = new Error(`Security validation failed: ${securityCheck.reason}`) as Error & { status: number; code: string };
        error.status = HTTP_STATUS.BAD_REQUEST;
        error.code = 'SECURITY_VIOLATION';
        
        return apiResponseHandler.error(error, {
          requestId,
          duration: Date.now() - startTime,
        });
      }
    }

    // 3. Execute request with deduplication
    if (this.config.enableDeduplication && !options.skipDeduplication) {
      const fingerprint: RequestFingerprint = {
        url: options.url,
        method: options.method || 'GET',
      };
      return apiRequestDeduplicator.execute(
        () => this.executeCoreRequest<T>(options, requestId, startTime, cacheKey),
        fingerprint
      );
    }

    return this.executeCoreRequest<T>(options, requestId, startTime, cacheKey);
  }

  /**
   * Execute the core request through interceptors
   */
  private async executeCoreRequest<T>(
    options: UnifiedRequestOptions,
    requestId: string,
    startTime: number,
    cacheKey: string
  ): Promise<StandardizedAPIResponse<T>> {
    // Build request config
    const config: RequestConfig = {
      url: options.url,
      method: options.method || 'GET',
      headers: this.mergeHeaders(options.headers),
      body: options.body,
      timeout: options.timeout ?? this.config.defaultTimeout,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
      retryDelay: options.retryDelay ?? this.config.retryBaseDelay,
      metadata: { ...options.metadata, requestId, cacheKey },
    };

    // Execute through interceptor manager
    const response = await this.interceptorManager.fetch<T>(config);
    
    const duration = Date.now() - startTime;
    this.stats.totalResponseTime += duration;
    
    if (response.success) {
      this.stats.successfulRequests++;
      
      // Cache successful GET responses
      if (this.config.enableCaching && !options.skipCache && options.method === 'GET' && response.data) {
        apiResponseCache.set(cacheKey, response.data, options.cacheOptions);
      }
      
      this.recordMetric(options.url, duration, true, 'success');
    } else {
      this.stats.failedRequests++;
      this.recordMetric(options.url, duration, false, 'error');
    }

    return response;
  }

  /**
   * Execute a direct request without optimizations
   */
  private async executeDirectRequest<T>(
    options: UnifiedRequestOptions,
    requestId: string,
    startTime: number
  ): Promise<StandardizedAPIResponse<T>> {
    const config: RequestConfig = {
      url: options.url,
      method: options.method || 'GET',
      headers: this.mergeHeaders(options.headers),
      body: options.body,
      timeout: options.timeout ?? this.config.defaultTimeout,
    };

    const response = await this.interceptorManager.fetch<T>(config);
    const duration = Date.now() - startTime;
    
    this.stats.totalResponseTime += duration;
    if (response.success) {
      this.stats.successfulRequests++;
      this.recordMetric(options.url, duration, true, 'success');
    } else {
      this.stats.failedRequests++;
      this.recordMetric(options.url, duration, false, 'error');
    }

    return response;
  }

  // ============= Convenience Methods =============

  /**
   * Make a GET request
   */
  async get<T = unknown>(
    url: string, 
    options?: Omit<UnifiedRequestOptions, 'url' | 'method'>
  ): Promise<StandardizedAPIResponse<T>> {
    return this.request<T>({ ...options, url, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(
    url: string, 
    body?: unknown, 
    options?: Omit<UnifiedRequestOptions, 'url' | 'method' | 'body'>
  ): Promise<StandardizedAPIResponse<T>> {
    return this.request<T>({
      ...options,
      url,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a PUT request
   */
  async put<T = unknown>(
    url: string, 
    body?: unknown, 
    options?: Omit<UnifiedRequestOptions, 'url' | 'method' | 'body'>
  ): Promise<StandardizedAPIResponse<T>> {
    return this.request<T>({
      ...options,
      url,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a PATCH request
   */
  async patch<T = unknown>(
    url: string, 
    body?: unknown, 
    options?: Omit<UnifiedRequestOptions, 'url' | 'method' | 'body'>
  ): Promise<StandardizedAPIResponse<T>> {
    return this.request<T>({
      ...options,
      url,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(
    url: string, 
    options?: Omit<UnifiedRequestOptions, 'url' | 'method'>
  ): Promise<StandardizedAPIResponse<T>> {
    return this.request<T>({ ...options, url, method: 'DELETE' });
  }

  // ============= Configuration Methods =============

  /**
   * Update the facade configuration
   */
  updateConfig(config: Partial<UnifiedAPIConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Unified API Facade config updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): UnifiedAPIConfig {
    return { ...this.config };
  }

  /**
   * Set default header for all requests
   */
  setDefaultHeader(key: string, value: string): void {
    this.config.defaultHeaders[key] = value;
  }

  /**
   * Remove default header
   */
  removeDefaultHeader(key: string): void {
    delete this.config.defaultHeaders[key];
  }

  /**
   * Set user tier for rate limiting
   */
  setUserTier(tier: 'basic' | 'premium' | 'enterprise'): void {
    this.config.userTier = tier;
  }

  // ============= Statistics & Health Methods =============

  /**
   * Get unified statistics
   */
  getStats(): UnifiedAPIStats {
    return {
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      deduplicatedRequests: this.stats.deduplicatedRequests,
      cachedResponses: this.stats.cachedResponses,
      rateLimitedRequests: this.stats.rateLimitedRequests,
      securityBlockedRequests: this.stats.securityBlockedRequests,
      averageResponseTime: this.stats.totalRequests > 0 
        ? this.stats.totalResponseTime / this.stats.totalRequests 
        : 0,
      activeRequests: this.stats.activeRequests,
    };
  }

  /**
   * Get health status
   */
  getHealth(): UnifiedAPIHealth {
    const components = {
      cache: this.config.enableCaching,
      deduplicator: this.config.enableDeduplication,
      rateLimiter: this.config.enableRateLimiting,
      metrics: this.config.enableMetrics,
      healthMonitor: this.config.enableHealthMonitoring,
    };

    // Determine overall status based on metrics
    const errorRate = this.stats.totalRequests > 0 
      ? this.stats.failedRequests / this.stats.totalRequests 
      : 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (errorRate < 0.05) {
      status = 'healthy';
    } else if (errorRate < 0.2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      components,
      lastCheck: Date.now(),
    };
  }

  /**
   * Get comprehensive metrics from all services
   */
  getComprehensiveMetrics(): {
    facade: UnifiedAPIStats;
    cache: ReturnType<typeof apiResponseCache.getStats>;
    deduplicator: ReturnType<typeof apiRequestDeduplicator.getStats>;
    metrics: ReturnType<typeof apiMetricsCollector.getSummary>;
    health: ReturnType<typeof apiHealthMonitor.getSummary>;
  } {
    return {
      facade: this.getStats(),
      cache: apiResponseCache.getStats(),
      deduplicator: apiRequestDeduplicator.getStats(),
      metrics: apiMetricsCollector.getSummary(),
      health: apiHealthMonitor.getSummary(),
    };
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      deduplicatedRequests: 0,
      cachedResponses: 0,
      rateLimitedRequests: 0,
      securityBlockedRequests: 0,
      totalResponseTime: 0,
      activeRequests: 0,
    };
  }

  // ============= Private Helper Methods =============

  private generateRequestId(): string {
    return `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(options: UnifiedRequestOptions): string {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body).slice(0, 100) : '';
    return `${method}:${options.url}:${body}`;
  }

  private mergeHeaders(customHeaders?: HeadersInit): Headers {
    const headers = new Headers();
    
    // Add default headers
    for (const [key, value] of Object.entries(this.config.defaultHeaders)) {
      headers.set(key, value);
    }
    
    // Add custom headers (override defaults)
    if (customHeaders) {
      const custom = new Headers(customHeaders);
      for (const [key, value] of custom.entries()) {
        headers.set(key, value);
      }
    }
    
    return headers;
  }

  private validateRequestBody(body: BodyInit | null | undefined): { valid: boolean; reason?: string } {
    if (!body) return { valid: true };
    
    try {
      const bodyStr = typeof body === 'string' ? body : String(body);
      
      // Check for potential XSS patterns
      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /data:\s*text\/html/gi,
      ];
      
      for (const pattern of xssPatterns) {
        if (pattern.test(bodyStr)) {
          return { valid: false, reason: 'Potential XSS pattern detected' };
        }
      }
      
      // Check for SQL injection patterns
      const sqlPatterns = [
        /('\s*(or|and)\s*')/gi,
        /;\s*(drop|delete|truncate|update|insert)/gi,
        /union\s+select/gi,
      ];
      
      for (const pattern of sqlPatterns) {
        if (pattern.test(bodyStr)) {
          return { valid: false, reason: 'Potential SQL injection pattern detected' };
        }
      }
      
      return { valid: true };
    } catch {
      return { valid: true }; // Allow on validation error
    }
  }

  private recordMetric(
    url: string, 
    duration: number, 
    success: boolean, 
    type: string
  ): void {
    if (this.config.enableMetrics) {
      try {
        const metric: RequestMetric = {
          endpoint: url,
          method: 'GET', // Would need to pass method through
          status: success ? 200 : 500,
          duration,
          timestamp: Date.now(),
          cached: type === 'cache_hit',
          retryCount: 0,
        };
        apiMetricsCollector.record(metric);
      } catch {
        // Silently fail metrics recording
      }
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.rateLimiter.cleanup();
    }, TIME_CONSTANTS.CLEANUP_DEFAULT_INTERVAL);
  }

  /**
   * Destroy the facade and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.rateLimiter.cleanup();
    logger.info('Unified API Facade destroyed');
  }
}

// ============= Singleton Instance =============

let unifiedFacadeInstance: UnifiedAPIFacade | null = null;

/**
 * Get the unified API facade instance
 */
export const getUnifiedAPIFacade = (config?: Partial<UnifiedAPIConfig>): UnifiedAPIFacade => {
  if (!unifiedFacadeInstance) {
    unifiedFacadeInstance = new UnifiedAPIFacade(config);
  }
  return unifiedFacadeInstance;
};

/**
 * Initialize the unified API facade with custom config
 */
export const initializeUnifiedAPIFacade = (config: Partial<UnifiedAPIConfig>): UnifiedAPIFacade => {
  if (unifiedFacadeInstance) {
    unifiedFacadeInstance.destroy();
  }
  unifiedFacadeInstance = new UnifiedAPIFacade(config);
  return unifiedFacadeInstance;
};

/**
 * Check if unified facade is initialized
 */
export const hasUnifiedAPIFacade = (): boolean => {
  return unifiedFacadeInstance !== null;
};

// ============= Convenience Functions =============

/**
 * Make a unified GET request
 */
export const unifiedGet = <T = unknown>(
  url: string,
  options?: Omit<UnifiedRequestOptions, 'url' | 'method'>
): Promise<StandardizedAPIResponse<T>> => 
  getUnifiedAPIFacade().get<T>(url, options);

/**
 * Make a unified POST request
 */
export const unifiedPost = <T = unknown>(
  url: string,
  body?: unknown,
  options?: Omit<UnifiedRequestOptions, 'url' | 'method' | 'body'>
): Promise<StandardizedAPIResponse<T>> =>
  getUnifiedAPIFacade().post<T>(url, body, options);

/**
 * Make a unified PUT request
 */
export const unifiedPut = <T = unknown>(
  url: string,
  body?: unknown,
  options?: Omit<UnifiedRequestOptions, 'url' | 'method' | 'body'>
): Promise<StandardizedAPIResponse<T>> =>
  getUnifiedAPIFacade().put<T>(url, body, options);

/**
 * Make a unified DELETE request
 */
export const unifiedDelete = <T = unknown>(
  url: string,
  options?: Omit<UnifiedRequestOptions, 'url' | 'method'>
): Promise<StandardizedAPIResponse<T>> =>
  getUnifiedAPIFacade().delete<T>(url, options);

// ============= React Hook =============

/**
 * React hook for using the unified API facade
 */
export const useUnifiedAPI = () => {
  const facade = getUnifiedAPIFacade();
  
  return {
    request: <T = unknown>(options: UnifiedRequestOptions) => facade.request<T>(options),
    get: <T = unknown>(url: string, options?: Omit<UnifiedRequestOptions, 'url' | 'method'>) =>
      facade.get<T>(url, options),
    post: <T = unknown>(url: string, body?: unknown, options?: Omit<UnifiedRequestOptions, 'url' | 'method' | 'body'>) =>
      facade.post<T>(url, body, options),
    put: <T = unknown>(url: string, body?: unknown, options?: Omit<UnifiedRequestOptions, 'url' | 'method' | 'body'>) =>
      facade.put<T>(url, body, options),
    patch: <T = unknown>(url: string, body?: unknown, options?: Omit<UnifiedRequestOptions, 'url' | 'method' | 'body'>) =>
      facade.patch<T>(url, body, options),
    delete: <T = unknown>(url: string, options?: Omit<UnifiedRequestOptions, 'url' | 'method'>) =>
      facade.delete<T>(url, options),
    getStats: () => facade.getStats(),
    getHealth: () => facade.getHealth(),
    getComprehensiveMetrics: () => facade.getComprehensiveMetrics(),
    setDefaultHeader: (key: string, value: string) => facade.setDefaultHeader(key, value),
    setUserTier: (tier: 'basic' | 'premium' | 'enterprise') => facade.setUserTier(tier),
  };
};
