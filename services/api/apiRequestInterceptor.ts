/**
 * API Request Interceptor Service
 * Centralized request/response handling with logging, metrics, and error handling
 * 
 * @module services/api/apiRequestInterceptor
 */

import { createScopedLogger } from '../../utils/logger';
import { API_CONFIG, TIME_CONSTANTS } from '../../constants/config';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';
import { apiResponseCache, type CacheOptions } from './apiResponseCache';

const logger = createScopedLogger('APIRequestInterceptor');

/**
 * Request configuration
 */
export interface RequestConfig extends Omit<RequestInit, 'priority'> {
  url: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  cacheKey?: string;
  cacheOptions?: CacheOptions;
  skipCache?: boolean;
  priority?: 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown>;
}

/**
 * Response with metadata
 */
export interface InterceptedResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  duration: number;
  cached: boolean;
  retries: number;
  requestId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request interceptor function type
 */
type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;

/**
 * Response interceptor function type
 */
type ResponseInterceptor = <T>(
  response: InterceptedResponse<T>,
  config: RequestConfig
) => InterceptedResponse<T> | Promise<InterceptedResponse<T>>;

/**
 * Error interceptor function type
 */
type ErrorInterceptor = (
  error: Error,
  config: RequestConfig,
  attempt: number
) => Error | Promise<Error>;

/**
 * Request metrics
 */
export interface RequestMetrics {
  requestId: string;
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  cached: boolean;
  retries: number;
  error?: string;
  size?: number;
}

/**
 * Interceptor statistics
 */
export interface InterceptorStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cachedRequests: number;
  averageDuration: number;
  totalBytes: number;
  activeRequests: number;
  queuedRequests: number;
}

/**
 * API Request Interceptor
 * 
 * Features:
 * - Request/response transformation
 * - Automatic retries with backoff
 * - Request timeout handling
 * - Cache integration
 * - Request queuing with priority
 * - Metrics collection
 * - Error handling and transformation
 */
export class APIRequestInterceptor {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];
  
  private activeRequests = new Map<string, RequestMetrics>();
  private requestQueue: Array<{
    config: RequestConfig;
    resolve: (response: InterceptedResponse) => void;
    reject: (error: Error) => void;
  }> = [];
  
  private readonly maxConcurrent: number;
  private readonly defaultTimeout: number;
  private readonly defaultRetries: number;
  private processingQueue = false;
  
  // Statistics
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cachedRequests: 0,
    totalDuration: 0,
    totalBytes: 0
  };
  
  // Request history for debugging
  private requestHistory: RequestMetrics[] = [];
  private readonly maxHistorySize = 100;
  
  // Cleanup timer
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(options?: {
    maxConcurrent?: number;
    defaultTimeout?: number;
    defaultRetries?: number;
  }) {
    this.maxConcurrent = options?.maxConcurrent ?? 6; // Default concurrent requests
    this.defaultTimeout = options?.defaultTimeout ?? API_CONFIG.REQUEST_TIMEOUT;
    this.defaultRetries = options?.defaultRetries ?? API_CONFIG.MAX_RETRY_ATTEMPTS;
    
    // Cleanup old request history periodically
    this.cleanupInterval = setInterval(
      () => this.cleanupHistory(),
      TIME_CONSTANTS.CLEANUP_DEFAULT_INTERVAL
    );
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiRequestInterceptor', {
        cleanup: () => this.destroy(),
        priority: 'high',
        description: 'API request interceptor service'
      });
    }
  }

  /**
   * Add a request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.requestInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Add a response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.responseInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Add an error interceptor
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.errorInterceptors.push(interceptor);
    return () => {
      const index = this.errorInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.errorInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Make an intercepted request
   */
  async request<T = unknown>(config: RequestConfig): Promise<InterceptedResponse<T>> {
    const requestId = this.generateRequestId();
    
    // Apply request interceptors
    let processedConfig = config;
    for (const interceptor of this.requestInterceptors) {
      processedConfig = await interceptor(processedConfig);
    }
    
    // Check cache first if not skipped
    if (!processedConfig.skipCache && processedConfig.cacheKey) {
      const cached = apiResponseCache.get<T>(processedConfig.cacheKey);
      if (cached !== null) {
        this.stats.cachedRequests++;
        return this.createCachedResponse(cached, processedConfig, requestId);
      }
    }
    
    // Queue request if at capacity
    if (this.activeRequests.size >= this.maxConcurrent) {
      return this.queueRequest(processedConfig, requestId);
    }
    
    return this.executeRequest<T>(processedConfig, requestId);
  }

  /**
   * Convenience method for GET requests
   */
  async get<T = unknown>(
    url: string,
    options?: Omit<RequestConfig, 'url' | 'method'>
  ): Promise<InterceptedResponse<T>> {
    return this.request<T>({ ...options, url, method: 'GET' });
  }

  /**
   * Convenience method for POST requests
   */
  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<RequestConfig, 'url' | 'method' | 'body'>
  ): Promise<InterceptedResponse<T>> {
    return this.request<T>({
      ...options,
      url,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });
  }

  /**
   * Convenience method for PUT requests
   */
  async put<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<RequestConfig, 'url' | 'method' | 'body'>
  ): Promise<InterceptedResponse<T>> {
    return this.request<T>({
      ...options,
      url,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });
  }

  /**
   * Convenience method for DELETE requests
   */
  async delete<T = unknown>(
    url: string,
    options?: Omit<RequestConfig, 'url' | 'method'>
  ): Promise<InterceptedResponse<T>> {
    return this.request<T>({ ...options, url, method: 'DELETE' });
  }

  /**
   * Get interceptor statistics
   */
  getStats(): InterceptorStats {
    const avgDuration = this.stats.totalRequests > 0
      ? this.stats.totalDuration / this.stats.totalRequests
      : 0;
    
    return {
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      cachedRequests: this.stats.cachedRequests,
      averageDuration: avgDuration,
      totalBytes: this.stats.totalBytes,
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length
    };
  }

  /**
   * Get request history
   */
  getHistory(): RequestMetrics[] {
    return [...this.requestHistory];
  }

  /**
   * Get active requests
   */
  getActiveRequests(): RequestMetrics[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Cancel a request by ID
   */
  cancelRequest(requestId: string): boolean {
    const abortController = this.abortControllers.get(requestId);
    if (abortController) {
      abortController.abort();
      return true;
    }
    return false;
  }

  /**
   * Cancel all active requests
   */
  cancelAllRequests(): number {
    let count = 0;
    for (const [requestId] of this.abortControllers) {
      if (this.cancelRequest(requestId)) {
        count++;
      }
    }
    return count;
  }

  // Private properties
  private abortControllers = new Map<string, AbortController>();

  // Private methods

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async executeRequest<T>(
    config: RequestConfig,
    requestId: string,
    attempt: number = 0
  ): Promise<InterceptedResponse<T>> {
    const startTime = Date.now();
    const metrics: RequestMetrics = {
      requestId,
      url: config.url,
      method: config.method || 'GET',
      startTime,
      cached: false,
      retries: attempt
    };
    
    this.activeRequests.set(requestId, metrics);
    this.stats.totalRequests++;
    
    // Create abort controller for timeout
    const abortController = new AbortController();
    this.abortControllers.set(requestId, abortController);
    
    // Set up timeout
    const timeout = config.timeout ?? this.defaultTimeout;
    const timeoutId = setTimeout(() => abortController.abort(), timeout);
    
    try {
      // Extract only valid RequestInit properties
      const {
        url: _url,
        timeout: _timeout,
        retries: _retries,
        retryDelay: _retryDelay,
        cacheKey: _cacheKey,
        cacheOptions: _cacheOptions,
        skipCache: _skipCache,
        priority: _priority,
        metadata: _metadata,
        ...requestInit
      } = config;
      
      const response = await fetch(config.url, {
        ...requestInit,
        signal: abortController.signal
      });
      
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      metrics.endTime = Date.now();
      metrics.duration = duration;
      metrics.status = response.status;
      
      if (!response.ok) {
        throw new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          config.url
        );
      }
      
      // Parse response
      const contentType = response.headers.get('content-type');
      let data: T;
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text() as T;
      }
      
      // Update metrics
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        metrics.size = parseInt(contentLength, 10);
        this.stats.totalBytes += metrics.size;
      }
      
      // Cache response if cacheKey is provided
      if (config.cacheKey && !config.skipCache) {
        apiResponseCache.set(config.cacheKey, data, {
          ...config.cacheOptions,
          etag: response.headers.get('etag') ?? undefined,
          lastModified: response.headers.get('last-modified') ?? undefined
        });
      }
      
      // Create intercepted response
      let interceptedResponse: InterceptedResponse<T> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        duration,
        cached: false,
        retries: attempt,
        requestId,
        metadata: config.metadata
      };
      
      // Apply response interceptors
      for (const interceptor of this.responseInterceptors) {
        interceptedResponse = await interceptor(interceptedResponse, config);
      }
      
      this.stats.successfulRequests++;
      this.stats.totalDuration += duration;
      
      return interceptedResponse;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Apply error interceptors
      let processedError = error instanceof Error ? error : new Error(String(error));
      for (const interceptor of this.errorInterceptors) {
        processedError = await interceptor(processedError, config, attempt);
      }
      
      // Retry logic
      const maxRetries = config.retries ?? this.defaultRetries;
      if (attempt < maxRetries && this.isRetryable(error)) {
        const delay = this.calculateRetryDelay(attempt, config.retryDelay);
        logger.debug(`Retrying request ${requestId} (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`);
        
        await this.delay(delay);
        return this.executeRequest<T>(config, requestId, attempt + 1);
      }
      
      // Record failure
      metrics.error = processedError.message;
      this.stats.failedRequests++;
      
      throw processedError;
      
    } finally {
      this.activeRequests.delete(requestId);
      this.abortControllers.delete(requestId);
      this.addToHistory(metrics);
      this.processQueue();
    }
  }

  private createCachedResponse<T>(
    data: T,
    config: RequestConfig,
    requestId: string
  ): InterceptedResponse<T> {
    const response: InterceptedResponse<T> = {
      data,
      status: 200,
      statusText: 'OK (from cache)',
      headers: new Headers(),
      duration: 0,
      cached: true,
      retries: 0,
      requestId
    };
    
    this.stats.totalRequests++;
    this.addToHistory({
      requestId,
      url: config.url,
      method: config.method || 'GET',
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      status: 200,
      cached: true,
      retries: 0
    });
    
    return response;
  }

  private queueRequest<T>(
    config: RequestConfig,
    requestId: string
  ): Promise<InterceptedResponse<T>> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        config,
        resolve: resolve as (response: InterceptedResponse) => void,
        reject
      });
      
      // Sort by priority
      this.requestQueue.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const aPriority = priorityOrder[a.config.priority || 'medium'];
        const bPriority = priorityOrder[b.config.priority || 'medium'];
        return aPriority - bPriority;
      });
      
      logger.debug(`Queued request ${requestId} (queue size: ${this.requestQueue.length})`);
    });
  }

  private processQueue(): void {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    if (this.activeRequests.size >= this.maxConcurrent) {
      return;
    }
    
    this.processingQueue = true;
    
    while (this.requestQueue.length > 0 && this.activeRequests.size < this.maxConcurrent) {
      const item = this.requestQueue.shift();
      if (item) {
        const requestId = this.generateRequestId();
        this.executeRequest(item.config, requestId)
          .then(item.resolve)
          .catch(item.reject);
      }
    }
    
    this.processingQueue = false;
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof APIError) {
      // Retry on server errors and rate limits
      return error.status >= 500 || error.status === 429;
    }
    
    if (error instanceof Error) {
      // Retry on network errors
      const retryableMessages = [
        'network error',
        'failed to fetch',
        'timeout',
        'aborted'
      ];
      
      const message = error.message.toLowerCase();
      return retryableMessages.some(msg => message.includes(msg));
    }
    
    return false;
  }

  private calculateRetryDelay(attempt: number, baseDelay?: number): number {
    const delay = baseDelay ?? 1000;
    const exponentialDelay = delay * Math.pow(2, attempt);
    
    // Add jitter (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private addToHistory(metrics: RequestMetrics): void {
    this.requestHistory.push(metrics);
    
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.shift();
    }
  }

  private cleanupHistory(): void {
    const maxAge = TIME_CONSTANTS.HOUR;
    const now = Date.now();
    
    this.requestHistory = this.requestHistory.filter(
      m => now - m.startTime < maxAge
    );
  }

  /**
   * Destroy the interceptor and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cancelAllRequests();
    this.requestQueue = [];
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
    
    logger.info('API Request Interceptor destroyed');
  }
}

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public url: string,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Create singleton instance
export const apiRequestInterceptor = new APIRequestInterceptor();

// React hook for interceptor
export const useAPIRequestInterceptor = () => ({
  request: <T>(config: RequestConfig) => apiRequestInterceptor.request<T>(config),
  get: <T>(url: string, options?: Omit<RequestConfig, 'url' | 'method'>) =>
    apiRequestInterceptor.get<T>(url, options),
  post: <T>(url: string, body?: unknown, options?: Omit<RequestConfig, 'url' | 'method' | 'body'>) =>
    apiRequestInterceptor.post<T>(url, body, options),
  put: <T>(url: string, body?: unknown, options?: Omit<RequestConfig, 'url' | 'method' | 'body'>) =>
    apiRequestInterceptor.put<T>(url, body, options),
  delete: <T>(url: string, options?: Omit<RequestConfig, 'url' | 'method'>) =>
    apiRequestInterceptor.delete<T>(url, options),
  addRequestInterceptor: (interceptor: RequestInterceptor) =>
    apiRequestInterceptor.addRequestInterceptor(interceptor),
  addResponseInterceptor: (interceptor: ResponseInterceptor) =>
    apiRequestInterceptor.addResponseInterceptor(interceptor),
  addErrorInterceptor: (interceptor: ErrorInterceptor) =>
    apiRequestInterceptor.addErrorInterceptor(interceptor),
  getStats: () => apiRequestInterceptor.getStats()
});
