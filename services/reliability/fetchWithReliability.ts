/**
 * FetchWithReliability
 * 
 * A comprehensive fetch wrapper with built-in reliability patterns:
 * - Automatic timeout via AbortController
 * - Automatic retry with exponential backoff
 * - Circuit breaker integration
 * - Request deduplication
 * - Response caching integration
 * - Metrics collection
 * 
 * @module services/reliability/fetchWithReliability
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('FetchWithReliability');

/**
 * Retry strategy configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to prevent thundering herd */
  jitter: number;
  /** HTTP status codes that should trigger retry */
  retryableStatusCodes: number[];
}

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  /** Connection timeout in milliseconds */
  connection: number;
  /** Read timeout in milliseconds */
  read: number;
  /** Total request timeout in milliseconds */
  total: number;
}

/**
 * Reliability configuration for fetch
 */
export interface FetchReliabilityConfig {
  /** Enable automatic retry */
  enableRetry: boolean;
  /** Enable timeout */
  enableTimeout: boolean;
  /** Enable request deduplication */
  enableDeduplication: boolean;
  /** Enable circuit breaker */
  enableCircuitBreaker: boolean;
  /** Retry configuration */
  retry: RetryConfig;
  /** Timeout configuration */
  timeout: TimeoutConfig;
  /** Cache key generator */
  cacheKeyGenerator?: (url: string, options?: RequestInit) => string;
  /** Custom retry condition */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback on successful request */
  onSuccess?: (response: Response, duration: number) => void;
  /** Callback on failed request */
  onError?: (error: Error, attempt: number) => void;
  /** Callback on retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * Request state for deduplication
 */
interface RequestState {
  promise: Promise<Response>;
  timestamp: number;
  abortController: AbortController;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

/**
 * Metrics for monitoring
 */
export interface FetchMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retries: number;
  timeouts: number;
  deduplicatedRequests: number;
  circuitBreakerTrips: number;
  averageResponseTime: number;
  lastRequestTime: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: 0.1,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};

/**
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  connection: 5000,
  read: 30000,
  total: 60000
};

/**
 * Default reliability configuration
 */
const DEFAULT_CONFIG: FetchReliabilityConfig = {
  enableRetry: true,
  enableTimeout: true,
  enableDeduplication: true,
  enableCircuitBreaker: true,
  retry: DEFAULT_RETRY_CONFIG,
  timeout: DEFAULT_TIMEOUT_CONFIG
};

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  const baseDelay = Math.min(
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelay
  );
  
  const jitter = baseDelay * config.jitter * (Math.random() * 2 - 1);
  return Math.max(0, baseDelay + jitter);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(
  error: Error,
  config: RetryConfig,
  response?: Response
): boolean {
  // Check for abort errors (should not retry)
  if (error.name === 'AbortError') {
    return false;
  }

  // Check for network errors
  if (
    error.message.includes('network') ||
    error.message.includes('fetch') ||
    error.message.includes('timeout')
  ) {
    return true;
  }

  // Check response status
  if (response && config.retryableStatusCodes.includes(response.status)) {
    return true;
  }

  return false;
}

/**
 * Generate cache key for request
 */
export function generateCacheKey(url: string, options?: RequestInit): string {
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.stringify(options.body) : '';
  return `${method}:${url}:${body}`;
}

/**
 * FetchWithReliability class
 * Provides reliable fetch operations with built-in resilience patterns
 */
export class FetchWithReliability {
  private config: FetchReliabilityConfig;
  private pendingRequests = new Map<string, RequestState>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private metrics: FetchMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retries: 0,
    timeouts: 0,
    deduplicatedRequests: 0,
    circuitBreakerTrips: 0,
    averageResponseTime: 0,
    lastRequestTime: 0
  };
  private responseTimes: number[] = [];
  private static instance: FetchWithReliability | null = null;

  /**
   * Create a new instance (use getInstance for singleton)
   */
  constructor(config?: Partial<FetchReliabilityConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Deep merge nested configs
    if (config?.retry) {
      this.config.retry = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
    }
    if (config?.timeout) {
      this.config.timeout = { ...DEFAULT_TIMEOUT_CONFIG, ...config.timeout };
    }

    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.cleanup());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<FetchReliabilityConfig>): FetchWithReliability {
    if (!FetchWithReliability.instance) {
      FetchWithReliability.instance = new FetchWithReliability(config);
    }
    return FetchWithReliability.instance;
  }

  /**
   * Execute a reliable fetch request
   */
  async fetch(
    url: string,
    options?: RequestInit,
    reliabilityOptions?: Partial<FetchReliabilityConfig>
  ): Promise<Response> {
    const config = { ...this.config, ...reliabilityOptions };
    const startTime = Date.now();

    // Update metrics
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = startTime;

    // Generate cache key for deduplication
    const cacheKey = config.cacheKeyGenerator 
      ? config.cacheKeyGenerator(url, options)
      : generateCacheKey(url, options);

    // Check circuit breaker
    if (config.enableCircuitBreaker && this.isCircuitOpen(cacheKey)) {
      const error = new Error(`Circuit breaker is open for ${cacheKey}`);
      this.metrics.failedRequests++;
      throw error;
    }

    // Check for pending request (deduplication)
    if (config.enableDeduplication && options?.method === 'GET') {
      const pending = this.pendingRequests.get(cacheKey);
      if (pending && Date.now() - pending.timestamp < config.timeout.total) {
        this.metrics.deduplicatedRequests++;
        logger.debug(`Deduplicating request: ${cacheKey}`);
        return pending.promise;
      }
    }

    // Execute with retry logic
    return this.executeWithRetry(url, options, config, cacheKey, startTime);
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry(
    url: string,
    options: RequestInit | undefined,
    config: FetchReliabilityConfig,
    cacheKey: string,
    startTime: number,
    attempt: number = 1
  ): Promise<Response> {
    const maxAttempts = config.enableRetry ? config.retry.maxRetries + 1 : 1;

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = config.enableTimeout
        ? setTimeout(() => controller.abort(), config.timeout.total)
        : null;

      // Store pending request for deduplication
      const requestPromise = this.doFetch(url, options, controller.signal);
      if (config.enableDeduplication && options?.method === 'GET') {
        this.pendingRequests.set(cacheKey, {
          promise: requestPromise,
          timestamp: startTime,
          abortController: controller
        });
      }

      // Execute fetch
      const response = await requestPromise;

      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);

      // Remove from pending
      this.pendingRequests.delete(cacheKey);

      // Check response status
      if (!response.ok && config.retry.retryableStatusCodes.includes(response.status)) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Update circuit breaker on success
      if (config.enableCircuitBreaker) {
        this.recordSuccess(cacheKey);
      }

      // Update metrics
      this.metrics.successfulRequests++;
      const duration = Date.now() - startTime;
      this.recordResponseTime(duration);

      // Callback
      config.onSuccess?.(response, duration);

      return response;

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Remove from pending
      this.pendingRequests.delete(cacheKey);

      // Check if we should retry
      const shouldRetry = attempt < maxAttempts && 
        (config.shouldRetry?.(err, attempt) ?? isRetryableError(err, config.retry));

      if (shouldRetry) {
        this.metrics.retries++;
        
        const delay = calculateDelay(attempt, config.retry);
        
        logger.debug(`Retrying request (attempt ${attempt + 1}/${maxAttempts}) after ${delay}ms`);
        
        config.onRetry?.(err, attempt, delay);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry
        return this.executeWithRetry(url, options, config, cacheKey, startTime, attempt + 1);
      }

      // Update circuit breaker on failure
      if (config.enableCircuitBreaker) {
        this.recordFailure(cacheKey);
      }

      // Update metrics
      this.metrics.failedRequests++;
      if (err.name === 'AbortError') {
        this.metrics.timeouts++;
      }

      // Callback
      config.onError?.(err, attempt);

      throw err;
    }
  }

  /**
   * Execute actual fetch
   */
  private async doFetch(
    url: string,
    options: RequestInit | undefined,
    signal: AbortSignal
  ): Promise<Response> {
    const fetchOptions: RequestInit = {
      ...options,
      signal
    };

    const response = await fetch(url, fetchOptions);
    return response;
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(key: string): boolean {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return false;

    if (breaker.status === 'open') {
      // Check if we should transition to half-open
      if (Date.now() >= breaker.nextAttemptTime) {
        breaker.status = 'half-open';
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record success for circuit breaker
   */
  private recordSuccess(key: string): void {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return;

    breaker.failureCount = 0;
    breaker.status = 'closed';
  }

  /**
   * Record failure for circuit breaker
   */
  private recordFailure(key: string): void {
    let breaker = this.circuitBreakers.get(key);
    if (!breaker) {
      breaker = {
        status: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0
      };
      this.circuitBreakers.set(key, breaker);
    }

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    // Open circuit if too many failures
    if (breaker.failureCount >= 5) {
      breaker.status = 'open';
      breaker.nextAttemptTime = Date.now() + 30000; // 30 second cooldown
      this.metrics.circuitBreakerTrips++;
      logger.warn(`Circuit breaker opened for ${key}`);
    }
  }

  /**
   * Record response time
   */
  private recordResponseTime(duration: number): void {
    this.responseTimes.push(duration);
    
    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    // Calculate average
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  /**
   * Get current metrics
   */
  getMetrics(): FetchMetrics {
    return { ...this.metrics };
  }

  /**
   * Cancel a pending request
   */
  cancel(url: string, options?: RequestInit): boolean {
    const cacheKey = this.config.cacheKeyGenerator 
      ? this.config.cacheKeyGenerator(url, options)
      : generateCacheKey(url, options);

    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      pending.abortController.abort();
      this.pendingRequests.delete(cacheKey);
      logger.debug(`Cancelled request: ${cacheKey}`);
      return true;
    }
    return false;
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    this.pendingRequests.forEach((pending, key) => {
      pending.abortController.abort();
      logger.debug(`Cancelled request: ${key}`);
    });
    this.pendingRequests.clear();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(key?: string): void {
    if (key) {
      this.circuitBreakers.delete(key);
    } else {
      this.circuitBreakers.clear();
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retries: 0,
      timeouts: 0,
      deduplicatedRequests: 0,
      circuitBreakerTrips: 0,
      averageResponseTime: 0,
      lastRequestTime: 0
    };
    this.responseTimes = [];
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.cancelAll();
    this.pendingRequests.clear();
    this.circuitBreakers.clear();
  }

  /**
   * Destroy instance
   */
  destroy(): void {
    this.cleanup();
    FetchWithReliability.instance = null;
  }
}

// Export singleton instance
export const fetchWithReliability = FetchWithReliability.getInstance();

/**
 * Convenience function for reliable fetch
 */
export async function reliableFetch(
  url: string,
  options?: RequestInit,
  config?: Partial<FetchReliabilityConfig>
): Promise<Response> {
  return fetchWithReliability.fetch(url, options, config);
}

/**
 * Fetch with JSON response parsing
 */
export async function reliableFetchJson<T = unknown>(
  url: string,
  options?: RequestInit,
  config?: Partial<FetchReliabilityConfig>
): Promise<T> {
  const response = await fetchWithReliability.fetch(url, options, config);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Fetch with timeout only (no retry)
 */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create a pre-configured fetch function
 */
export function createReliableFetch(
  defaultConfig: Partial<FetchReliabilityConfig>
): (url: string, options?: RequestInit) => Promise<Response> {
  return (url: string, options?: RequestInit) => 
    reliableFetch(url, options, defaultConfig);
}
