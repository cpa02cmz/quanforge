/**
 * Reliability Middleware
 * 
 * A middleware layer for API calls that provides:
 * - Request/response transformation
 * - Error normalization
 * - Logging and tracing
 * - Performance monitoring
 * - Request lifecycle hooks
 * 
 * @module services/reliability/reliabilityMiddleware
 */

import { createScopedLogger } from '../../utils/logger';
import { 
  reliableFetch, 
  FetchReliabilityConfig
} from './fetchWithReliability';

const logger = createScopedLogger('ReliabilityMiddleware');

/**
 * Request context
 */
export interface RequestContext {
  /** Unique request ID */
  id: string;
  /** Request URL */
  url: string;
  /** HTTP method */
  method: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Timestamp when request started */
  startTime: number;
  /** Retry count */
  retryCount: number;
  /** Custom metadata */
  metadata: Record<string, unknown>;
}

/**
 * Response context
 */
export interface ResponseContext {
  /** Request ID */
  id: string;
  /** Response status code */
  status: number;
  /** Response status text */
  statusText: string;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body */
  body?: unknown;
  /** Duration in milliseconds */
  duration: number;
  /** Whether request was successful */
  success: boolean;
  /** Error if request failed */
  error?: Error;
}

/**
 * Middleware function type
 */
export type MiddlewareFunction = (
  context: RequestContext,
  next: () => Promise<ResponseContext>
) => Promise<ResponseContext>;

/**
 * Error normalizer configuration
 */
export interface ErrorNormalizerConfig {
  /** Map HTTP status codes to error types */
  statusErrorMap: Record<number, string>;
  /** Default error type for unknown errors */
  defaultErrorType: string;
  /** Include stack trace in error response */
  includeStackTrace: boolean;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Log request details */
  logRequests: boolean;
  /** Log response details */
  logResponses: boolean;
  /** Log errors */
  logErrors: boolean;
  /** Log performance metrics */
  logPerformance: boolean;
  /** Performance threshold for slow requests (ms) */
  slowRequestThreshold: number;
}

/**
 * Middleware configuration
 */
export interface ReliabilityMiddlewareConfig {
  /** Enable error normalization */
  enableErrorNormalization: boolean;
  /** Enable logging */
  enableLogging: boolean;
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** Enable request tracing */
  enableTracing: boolean;
  /** Error normalizer configuration */
  errorNormalizer: ErrorNormalizerConfig;
  /** Logging configuration */
  logging: LoggingConfig;
  /** Maximum request body size to log (bytes) */
  maxLogBodySize: number;
  /** Sensitive headers to redact in logs */
  sensitiveHeaders: string[];
}

/**
 * Normalized error
 */
export interface NormalizedError {
  type: string;
  message: string;
  statusCode: number;
  requestId: string;
  timestamp: string;
  details?: Record<string, unknown>;
  stack?: string;
}

/**
 * Performance metrics for middleware
 */
export interface MiddlewarePerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  slowRequests: number;
  errorsByType: Record<string, number>;
  errorsByStatus: Record<number, number>;
}

/**
 * Default error normalizer configuration
 */
const DEFAULT_ERROR_NORMALIZER: ErrorNormalizerConfig = {
  statusErrorMap: {
    400: 'BadRequestError',
    401: 'AuthenticationError',
    403: 'AuthorizationError',
    404: 'NotFoundError',
    408: 'RequestTimeoutError',
    409: 'ConflictError',
    422: 'ValidationError',
    429: 'RateLimitError',
    500: 'InternalServerError',
    502: 'BadGatewayError',
    503: 'ServiceUnavailableError',
    504: 'GatewayTimeoutError'
  },
  defaultErrorType: 'UnknownError',
  includeStackTrace: import.meta.env.DEV
};

/**
 * Default logging configuration
 */
const DEFAULT_LOGGING: LoggingConfig = {
  logRequests: true,
  logResponses: true,
  logErrors: true,
  logPerformance: true,
  slowRequestThreshold: 5000
};

/**
 * Default middleware configuration
 */
const DEFAULT_CONFIG: ReliabilityMiddlewareConfig = {
  enableErrorNormalization: true,
  enableLogging: true,
  enablePerformanceMonitoring: true,
  enableTracing: true,
  errorNormalizer: DEFAULT_ERROR_NORMALIZER,
  logging: DEFAULT_LOGGING,
  maxLogBodySize: 1024,
  sensitiveHeaders: ['authorization', 'cookie', 'set-cookie', 'x-api-key']
};

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate percentile
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Reliability Middleware class
 */
export class ReliabilityMiddleware {
  private config: ReliabilityMiddlewareConfig;
  private middlewares: MiddlewareFunction[] = [];
  private durations: number[] = [];
  private metrics: MiddlewarePerformanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageDuration: 0,
    p50Duration: 0,
    p95Duration: 0,
    p99Duration: 0,
    slowRequests: 0,
    errorsByType: {},
    errorsByStatus: {}
  };
  private static instance: ReliabilityMiddleware | null = null;

  private constructor(config?: Partial<ReliabilityMiddlewareConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Deep merge nested configs
    if (config?.errorNormalizer) {
      this.config.errorNormalizer = { ...DEFAULT_ERROR_NORMALIZER, ...config.errorNormalizer };
    }
    if (config?.logging) {
      this.config.logging = { ...DEFAULT_LOGGING, ...config.logging };
    }

    // Add built-in middlewares
    this.addBuiltInMiddlewares();

    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.cleanup());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ReliabilityMiddlewareConfig>): ReliabilityMiddleware {
    if (!ReliabilityMiddleware.instance) {
      ReliabilityMiddleware.instance = new ReliabilityMiddleware(config);
    }
    return ReliabilityMiddleware.instance;
  }

  /**
   * Add built-in middlewares
   */
  private addBuiltInMiddlewares(): void {
    // Request logging middleware
    this.use(this.requestLoggingMiddleware.bind(this));
    
    // Performance monitoring middleware
    this.use(this.performanceMonitoringMiddleware.bind(this));
    
    // Error normalization middleware
    this.use(this.errorNormalizationMiddleware.bind(this));
    
    // Response logging middleware
    this.use(this.responseLoggingMiddleware.bind(this));
  }

  /**
   * Request logging middleware
   */
  private async requestLoggingMiddleware(
    context: RequestContext,
    next: () => Promise<ResponseContext>
  ): Promise<ResponseContext> {
    if (this.config.enableLogging && this.config.logging.logRequests) {
      const logData = {
        id: context.id,
        method: context.method,
        url: context.url,
        headers: this.redactSensitiveHeaders(context.headers),
        body: this.truncateBody(context.body)
      };
      logger.debug('Request started', logData);
    }

    return next();
  }

  /**
   * Performance monitoring middleware
   */
  private async performanceMonitoringMiddleware(
    context: RequestContext,
    next: () => Promise<ResponseContext>
  ): Promise<ResponseContext> {
    const startTime = performance.now();
    
    try {
      const response = await next();
      
      if (this.config.enablePerformanceMonitoring) {
        const duration = performance.now() - startTime;
        this.recordDuration(duration);
        
        if (this.config.logging.logPerformance) {
          const isSlow = duration > this.config.logging.slowRequestThreshold;
          if (isSlow) {
            this.metrics.slowRequests++;
            logger.warn('Slow request detected', {
              id: context.id,
              url: context.url,
              method: context.method,
              duration: `${duration.toFixed(2)}ms`
            });
          }
        }
      }
      
      return response;
    } catch (error: unknown) {
      if (this.config.enablePerformanceMonitoring) {
        const duration = performance.now() - startTime;
        this.recordDuration(duration);
      }
      throw error;
    }
  }

  /**
   * Error normalization middleware
   */
  private async errorNormalizationMiddleware(
    context: RequestContext,
    next: () => Promise<ResponseContext>
  ): Promise<ResponseContext> {
    try {
      return await next();
    } catch (error: unknown) {
      if (!this.config.enableErrorNormalization) {
        throw error;
      }

      const normalizedError = this.normalizeError(error, context);
      
      // Update metrics
      this.metrics.errorsByType[normalizedError.type] = 
        (this.metrics.errorsByType[normalizedError.type] || 0) + 1;
      
      throw Object.assign(new Error(normalizedError.message), {
        type: normalizedError.type,
        statusCode: normalizedError.statusCode,
        requestId: normalizedError.requestId,
        details: normalizedError.details,
        stack: normalizedError.stack
      });
    }
  }

  /**
   * Response logging middleware
   */
  private async responseLoggingMiddleware(
    context: RequestContext,
    next: () => Promise<ResponseContext>
  ): Promise<ResponseContext> {
    const response = await next();
    
    if (this.config.enableLogging && this.config.logging.logResponses) {
      const logData = {
        id: response.id,
        status: response.status,
        statusText: response.statusText,
        duration: `${response.duration}ms`,
        success: response.success
      };
      
      if (response.success) {
        logger.debug('Request completed', logData);
      } else if (this.config.logging.logErrors) {
        logger.error('Request failed', { ...logData, error: response.error });
      }
    }
    
    return response;
  }

  /**
   * Add middleware to the chain
   */
  use(middleware: MiddlewareFunction): void {
    this.middlewares.push(middleware);
  }

  /**
   * Execute request through middleware chain
   */
  async execute(
    url: string,
    options?: RequestInit,
    reliabilityConfig?: Partial<FetchReliabilityConfig>
  ): Promise<ResponseContext> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    // Create request context
    const context: RequestContext = {
      id: requestId,
      url,
      method: options?.method || 'GET',
      headers: this.headersToObject(options?.headers),
      body: options?.body,
      startTime,
      retryCount: 0,
      metadata: {}
    };

    // Update metrics
    this.metrics.totalRequests++;

    // Execute middleware chain
    const executeChain = async (index: number): Promise<ResponseContext> => {
      if (index >= this.middlewares.length) {
        // End of chain - execute actual fetch
        return this.executeFetch(context, options, reliabilityConfig);
      }

      const middleware = this.middlewares[index];
      return middleware(context, () => executeChain(index + 1));
    };

    try {
      const response = await executeChain(0);
      
      // Update metrics
      if (response.success) {
        this.metrics.successfulRequests++;
      } else {
        this.metrics.failedRequests++;
        if (response.status) {
          this.metrics.errorsByStatus[response.status] = 
            (this.metrics.errorsByStatus[response.status] || 0) + 1;
        }
      }
      
      return response;
    } catch (error: unknown) {
      // Update metrics
      this.metrics.failedRequests++;
      
      const err = error instanceof Error ? error : new Error(String(error));
      
      return {
        id: requestId,
        status: 0,
        statusText: 'Error',
        headers: {},
        duration: Date.now() - startTime,
        success: false,
        error: err
      };
    }
  }

  /**
   * Execute actual fetch
   */
  private async executeFetch(
    context: RequestContext,
    options?: RequestInit,
    reliabilityConfig?: Partial<FetchReliabilityConfig>
  ): Promise<ResponseContext> {
    const startTime = Date.now();

    try {
      const response = await reliableFetch(context.url, options, reliabilityConfig);
      
      let body: unknown = undefined;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          body = await response.json();
        } catch {
          // Ignore JSON parse errors
        }
      }

      return {
        id: context.id,
        status: response.status,
        statusText: response.statusText,
        headers: this.responseHeadersToObject(response.headers),
        body,
        duration: Date.now() - startTime,
        success: response.ok
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      return {
        id: context.id,
        status: 0,
        statusText: 'Error',
        headers: {},
        duration: Date.now() - startTime,
        success: false,
        error: err
      };
    }
  }

  /**
   * Normalize error
   */
  private normalizeError(error: unknown, context: RequestContext): NormalizedError {
    const err = error instanceof Error ? error : new Error(String(error));
    const statusCode = (err as unknown as Record<string, unknown>)?.statusCode as number || 0;
    
    const errorType = this.config.errorNormalizer.statusErrorMap[statusCode] ||
      this.config.errorNormalizer.defaultErrorType;

    return {
      type: errorType,
      message: err.message,
      statusCode,
      requestId: context.id,
      timestamp: new Date().toISOString(),
      details: {
        url: context.url,
        method: context.method
      },
      stack: this.config.errorNormalizer.includeStackTrace ? err.stack : undefined
    };
  }

  /**
   * Convert headers to object
   */
  private headersToObject(headers: HeadersInit | undefined): Record<string, string> {
    if (!headers) return {};
    
    if (headers instanceof Headers) {
      const obj: Record<string, string> = {};
      headers.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
    
    if (Array.isArray(headers)) {
      const obj: Record<string, string> = {};
      headers.forEach(([key, value]) => {
        obj[key] = value;
      });
      return obj;
    }
    
    return headers as Record<string, string>;
  }

  /**
   * Convert response headers to object
   */
  private responseHeadersToObject(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Redact sensitive headers
   */
  private redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
    const redacted: Record<string, string> = { ...headers };
    
    for (const key of Object.keys(redacted)) {
      if (this.config.sensitiveHeaders.includes(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      }
    }
    
    return redacted;
  }

  /**
   * Truncate body for logging
   */
  private truncateBody(body: unknown): unknown {
    if (!body) return body;
    
    const str = typeof body === 'string' ? body : JSON.stringify(body);
    
    if (str.length > this.config.maxLogBodySize) {
      return str.substring(0, this.config.maxLogBodySize) + '...[truncated]';
    }
    
    return body;
  }

  /**
   * Record duration for metrics
   */
  private recordDuration(duration: number): void {
    this.durations.push(duration);
    
    // Keep only last 1000 durations
    if (this.durations.length > 1000) {
      this.durations.shift();
    }
    
    // Update metrics
    this.metrics.averageDuration = 
      this.durations.reduce((a, b) => a + b, 0) / this.durations.length;
    this.metrics.p50Duration = calculatePercentile(this.durations, 50);
    this.metrics.p95Duration = calculatePercentile(this.durations, 95);
    this.metrics.p99Duration = calculatePercentile(this.durations, 99);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): MiddlewarePerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageDuration: 0,
      p50Duration: 0,
      p95Duration: 0,
      p99Duration: 0,
      slowRequests: 0,
      errorsByType: {},
      errorsByStatus: {}
    };
    this.durations = [];
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.middlewares = [];
    this.durations = [];
    this.addBuiltInMiddlewares();
  }

  /**
   * Destroy instance
   */
  destroy(): void {
    this.cleanup();
    ReliabilityMiddleware.instance = null;
  }
}

// Export singleton instance
export const reliabilityMiddleware = ReliabilityMiddleware.getInstance();

/**
 * Convenience function for reliable fetch with middleware
 */
export async function fetchWithMiddleware(
  url: string,
  options?: RequestInit,
  reliabilityConfig?: Partial<FetchReliabilityConfig>
): Promise<ResponseContext> {
  return reliabilityMiddleware.execute(url, options, reliabilityConfig);
}

/**
 * Fetch JSON with middleware
 */
export async function fetchJsonWithMiddleware<T = unknown>(
  url: string,
  options?: RequestInit,
  reliabilityConfig?: Partial<FetchReliabilityConfig>
): Promise<T> {
  const response = await reliabilityMiddleware.execute(url, options, reliabilityConfig);
  
  if (!response.success) {
    throw response.error || new Error(`Request failed with status ${response.status}`);
  }
  
  return response.body as T;
}
