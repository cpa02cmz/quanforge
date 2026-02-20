/**
 * API Interceptors - Request/Response Middleware Pattern
 * 
 * This module provides a flexible interceptor system for API calls,
 * allowing for:
 * - Request transformation (auth headers, logging, etc.)
 * - Response transformation (data normalization, error handling)
 * - Retry logic with customizable strategies
 * - Request deduplication
 * 
 * @module APIInterceptors
 * @since 2026-02-20
 */

import { createScopedLogger } from '../../utils/logger';
import { HTTP_STATUS, StandardizedAPIResponse, apiResponseHandler } from './APIResponseHandler';

const logger = createScopedLogger('APIInterceptors');

// ============= Types =============

export interface RequestConfig extends RequestInit {
  url: string;
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
  retryDelay?: number;
  metadata?: Record<string, unknown>;
}

export interface RequestContext {
  config: RequestConfig;
  startTime: number;
  requestId: string;
  attempt: number;
}

export interface ResponseContext {
  request: RequestContext;
  response: Response;
  duration: number;
}

export interface ErrorContext {
  request: RequestContext;
  error: unknown;
  attempt: number;
}

export type RequestInterceptor = (context: RequestContext) => Promise<RequestContext> | RequestContext;
export type ResponseInterceptor = (context: ResponseContext) => Promise<ResponseContext> | ResponseContext;
export type ErrorInterceptor = (context: ErrorContext) => Promise<boolean> | boolean;

export interface InterceptorSet {
  request: RequestInterceptor[];
  response: ResponseInterceptor[];
  error: ErrorInterceptor[];
}

// ============= Built-in Interceptors =============

/**
 * Default request interceptors
 */
export const defaultRequestInterceptors: RequestInterceptor[] = [
  // Add timestamp to requests
  (context: RequestContext): RequestContext => {
    if (!context.config.metadata) {
      context.config.metadata = {};
    }
    context.config.metadata.timestamp = Date.now();
    return context;
  },

  // Add default headers
  (context: RequestContext): RequestContext => {
    const headers = new Headers(context.config.headers);
    
    if (!headers.has('Content-Type') && context.config.body) {
      headers.set('Content-Type', 'application/json');
    }
    
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    
    context.config.headers = headers;
    return context;
  },
];

/**
 * Default response interceptors
 */
export const defaultResponseInterceptors: ResponseInterceptor[] = [
  // Log response duration
  (context: ResponseContext): ResponseContext => {
    logger.debug(`API request completed`, {
      url: context.request.config.url,
      status: context.response.status,
      duration: `${context.duration}ms`,
    });
    return context;
  },
];

/**
 * Default error interceptors
 */
export const defaultErrorInterceptors: ErrorInterceptor[] = [
  // Log errors
  (context: ErrorContext): boolean => {
    logger.error(`API request failed`, {
      url: context.request.config.url,
      attempt: context.attempt,
      error: context.error instanceof Error ? context.error.message : String(context.error),
    });
    return false; // Don't retry by default
  },
];

// ============= Interceptor Manager =============

/**
 * Manages interceptors for API requests
 */
export class InterceptorManager {
  private interceptors: InterceptorSet = {
    request: [...defaultRequestInterceptors],
    response: [...defaultResponseInterceptors],
    error: [...defaultErrorInterceptors],
  };

  private requestCounter = 0;

  /**
   * Add a request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.interceptors.request.push(interceptor);
    return () => {
      const index = this.interceptors.request.indexOf(interceptor);
      if (index > -1) {
        this.interceptors.request.splice(index, 1);
      }
    };
  }

  /**
   * Add a response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.interceptors.response.push(interceptor);
    return () => {
      const index = this.interceptors.response.indexOf(interceptor);
      if (index > -1) {
        this.interceptors.response.splice(index, 1);
      }
    };
  }

  /**
   * Add an error interceptor
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.interceptors.error.push(interceptor);
    return () => {
      const index = this.interceptors.error.indexOf(interceptor);
      if (index > -1) {
        this.interceptors.error.splice(index, 1);
      }
    };
  }

  /**
   * Clear all interceptors
   */
  clearAll(): void {
    this.interceptors = {
      request: [...defaultRequestInterceptors],
      response: [...defaultResponseInterceptors],
      error: [...defaultErrorInterceptors],
    };
  }

  /**
   * Execute request interceptors
   */
  async executeRequestInterceptors(context: RequestContext): Promise<RequestContext> {
    let currentContext = context;

    for (const interceptor of this.interceptors.request) {
      currentContext = await interceptor(currentContext);
    }

    return currentContext;
  }

  /**
   * Execute response interceptors
   */
  async executeResponseInterceptors(context: ResponseContext): Promise<ResponseContext> {
    let currentContext = context;

    for (const interceptor of this.interceptors.response) {
      currentContext = await interceptor(currentContext);
    }

    return currentContext;
  }

  /**
   * Execute error interceptors
   * Returns true if should retry, false otherwise
   */
  async executeErrorInterceptors(context: ErrorContext): Promise<boolean> {
    let shouldRetry = false;

    for (const interceptor of this.interceptors.error) {
      const result = await interceptor(context);
      if (result) {
        shouldRetry = true;
      }
    }

    return shouldRetry;
  }

  /**
   * Generate a unique request ID
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  /**
   * Make an API request with interceptors
   */
  async fetch<T = unknown>(
    config: RequestConfig
  ): Promise<StandardizedAPIResponse<T>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    let context: RequestContext = {
      config,
      startTime,
      requestId,
      attempt: config.retryCount || 0,
    };

    try {
      // Execute request interceptors
      context = await this.executeRequestInterceptors(context);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeout = config.timeout || 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // Make the request
        const response = await fetch(context.config.url, {
          ...context.config,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Execute response interceptors
        await this.executeResponseInterceptors({
          request: context,
          response,
          duration: Date.now() - startTime,
        });

        // Parse response
        if (!response.ok) {
          const errorData = await this.parseErrorResponse(response);
          return apiResponseHandler.error(errorData, {
            requestId,
            duration: Date.now() - startTime,
          });
        }

        const data = await this.parseResponse<T>(response);
        return apiResponseHandler.success(data, {
          requestId,
          duration: Date.now() - startTime,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: unknown) {
      // Execute error interceptors
      const shouldRetry = await this.executeErrorInterceptors({
        request: context,
        error,
        attempt: context.attempt,
      });

      // Handle retry logic
      const maxRetries = config.maxRetries || 3;
      if (shouldRetry && context.attempt < maxRetries) {
        const delay = config.retryDelay || this.calculateRetryDelay(context.attempt);
        await this.sleep(delay);

        return this.fetch<T>({
          ...config,
          retryCount: context.attempt + 1,
        });
      }

      return apiResponseHandler.error(error, {
        requestId,
        duration: Date.now() - startTime,
      });
    }
  }

  // ============= Private Helpers =============

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    
    if (contentType?.includes('text/')) {
      return response.text() as Promise<T>;
    }
    
    // For other types, return as blob or array buffer
    return response.blob() as Promise<T>;
  }

  private async parseErrorResponse(response: Response): Promise<Error> {
    try {
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        const message = data.message || data.error || `HTTP Error ${response.status}`;
        const error = new Error(message) as Error & { status: number; code?: string };
        error.status = response.status;
        error.code = data.code;
        return error;
      }
      
      const text = await response.text();
      const error = new Error(text || `HTTP Error ${response.status}`) as Error & { status: number };
      error.status = response.status;
      return error;
    } catch {
      const error = new Error(`HTTP Error ${response.status}`) as Error & { status: number };
      error.status = response.status;
      return error;
    }
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000;
    const maxDelay = 30000;
    const jitter = Math.random() * 0.3 * baseDelay;
    const delay = Math.min(baseDelay * Math.pow(2, attempt) + jitter, maxDelay);
    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============= Export Singleton Instance =============

export const interceptorManager = new InterceptorManager();

// ============= Convenience Functions =============

/**
 * Make a GET request
 */
export const apiGet = <T = unknown>(
  url: string,
  options?: Omit<RequestConfig, 'url' | 'method'>
): Promise<StandardizedAPIResponse<T>> => 
  interceptorManager.fetch<T>({ ...options, url, method: 'GET' });

/**
 * Make a POST request
 */
export const apiPost = <T = unknown>(
  url: string,
  body?: unknown,
  options?: Omit<RequestConfig, 'url' | 'method' | 'body'>
): Promise<StandardizedAPIResponse<T>> =>
  interceptorManager.fetch<T>({
    ...options,
    url,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });

/**
 * Make a PUT request
 */
export const apiPut = <T = unknown>(
  url: string,
  body?: unknown,
  options?: Omit<RequestConfig, 'url' | 'method' | 'body'>
): Promise<StandardizedAPIResponse<T>> =>
  interceptorManager.fetch<T>({
    ...options,
    url,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });

/**
 * Make a DELETE request
 */
export const apiDelete = <T = unknown>(
  url: string,
  options?: Omit<RequestConfig, 'url' | 'method'>
): Promise<StandardizedAPIResponse<T>> =>
  interceptorManager.fetch<T>({ ...options, url, method: 'DELETE' });

// ============= Auth Interceptor Factory =============

/**
 * Creates an auth header interceptor
 */
export const createAuthInterceptor = (
  getToken: () => string | Promise<string>,
  headerName = 'Authorization',
  prefix = 'Bearer'
): RequestInterceptor => {
  return async (context: RequestContext): Promise<RequestContext> => {
    const token = await getToken();
    const headers = new Headers(context.config.headers);
    headers.set(headerName, `${prefix} ${token}`);
    context.config.headers = headers;
    return context;
  };
};

// ============= Rate Limit Interceptor Factory =============

/**
 * Creates a rate limit handling interceptor
 */
export const createRateLimitInterceptor = (
  options: {
    maxRetries?: number;
    onRateLimited?: (retryAfter: number) => void;
  } = {}
): ErrorInterceptor => {
  const { maxRetries = 3, onRateLimited } = options;

  return (context: ErrorContext): boolean => {
    if (context.attempt >= maxRetries) {
      return false;
    }

    // Check for rate limit error
    const error = context.error as Error & { status?: number };
    if (error?.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      // Extract retry-after header if available
      const retryAfter = 60; // Default to 60 seconds
      
      if (onRateLimited) {
        onRateLimited(retryAfter);
      }

      logger.warn(`Rate limited, retrying after ${retryAfter}s`);
      return true;
    }

    return false;
  };
};

// ============= Retry Interceptor Factory =============

/**
 * Creates a retry interceptor for transient errors
 */
export const createRetryInterceptor = (
  options: {
    maxRetries?: number;
    retryableStatuses?: number[];
  } = {}
): ErrorInterceptor => {
  const { 
    maxRetries = 3,
    retryableStatuses = [
      HTTP_STATUS.TOO_MANY_REQUESTS,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      HTTP_STATUS.BAD_GATEWAY,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      HTTP_STATUS.GATEWAY_TIMEOUT,
    ],
  } = options;

  return (context: ErrorContext): boolean => {
    if (context.attempt >= maxRetries) {
      return false;
    }

    const error = context.error as Error & { status?: number };
    const status = error?.status;

    if (status && retryableStatuses.includes(status)) {
      logger.debug(`Retrying request due to status ${status}`);
      return true;
    }

    // Retry network errors
    if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
      logger.debug('Retrying request due to network error');
      return true;
    }

    return false;
  };
};
