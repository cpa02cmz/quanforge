/**
 * API Client Factory - Standardized API Client Creation
 * 
 * This module provides a factory pattern for creating API clients
 * with consistent configuration and behavior:
 * - Pre-configured interceptors
 * - Version support
 * - Error handling
 * - Caching integration
 * 
 * @module APIClientFactory
 * @since 2026-02-20
 */

import { createScopedLogger } from '../../utils/logger';
import { StandardizedAPIResponse, apiResponseHandler } from './APIResponseHandler';
import {
  InterceptorManager,
  RequestConfig,
  ResponseInterceptor,
  RequestInterceptor,
  ErrorInterceptor,
  createAuthInterceptor,
  createRetryInterceptor,
  createRateLimitInterceptor,
} from './APIInterceptors';
import {
  APIVersion,
  getVersionHeaders,
} from './APIVersioning';

const logger = createScopedLogger('APIClientFactory');

// ============= Types =============

export interface APIClientConfig {
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  version?: APIVersion;
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'api-key' | 'basic';
    getToken: () => string | Promise<string>;
    headerName?: string;
  };
  cache?: {
    enabled: boolean;
    ttl?: number;
    maxSize?: number;
  };
}

export interface APIClient {
  get: <T = unknown>(path: string, options?: Partial<RequestConfig>) => Promise<StandardizedAPIResponse<T>>;
  post: <T = unknown>(path: string, body?: unknown, options?: Partial<RequestConfig>) => Promise<StandardizedAPIResponse<T>>;
  put: <T = unknown>(path: string, body?: unknown, options?: Partial<RequestConfig>) => Promise<StandardizedAPIResponse<T>>;
  patch: <T = unknown>(path: string, body?: unknown, options?: Partial<RequestConfig>) => Promise<StandardizedAPIResponse<T>>;
  delete: <T = unknown>(path: string, options?: Partial<RequestConfig>) => Promise<StandardizedAPIResponse<T>>;
  request: <T = unknown>(config: RequestConfig) => Promise<StandardizedAPIResponse<T>>;
  getConfig: () => APIClientConfig;
  setHeader: (key: string, value: string) => void;
  addInterceptor: (type: 'request' | 'response' | 'error', interceptor: unknown) => () => void;
}

// ============= Client Implementation =============

/**
 * Standard API Client implementation
 */
class StandardAPIClient implements APIClient {
  private interceptorManager: InterceptorManager;
  private headers: Record<string, string>;
  private cache: Map<string, { data: unknown; expires: number }> | null = null;
  private requestCounter = 0;

  constructor(private config: APIClientConfig) {
    this.interceptorManager = new InterceptorManager();
    this.headers = { ...config.headers };

    // Initialize cache if enabled
    if (config.cache?.enabled) {
      this.cache = new Map();
    }

    // Set up default interceptors
    this.setupDefaultInterceptors();
  }

  get<T = unknown>(path: string, options?: Partial<RequestConfig>): Promise<StandardizedAPIResponse<T>> {
    return this.request<T>({
      ...options,
      url: this.buildUrl(path),
      method: 'GET',
    });
  }

  post<T = unknown>(path: string, body?: unknown, options?: Partial<RequestConfig>): Promise<StandardizedAPIResponse<T>> {
    return this.request<T>({
      ...options,
      url: this.buildUrl(path),
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T = unknown>(path: string, body?: unknown, options?: Partial<RequestConfig>): Promise<StandardizedAPIResponse<T>> {
    return this.request<T>({
      ...options,
      url: this.buildUrl(path),
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T = unknown>(path: string, body?: unknown, options?: Partial<RequestConfig>): Promise<StandardizedAPIResponse<T>> {
    return this.request<T>({
      ...options,
      url: this.buildUrl(path),
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = unknown>(path: string, options?: Partial<RequestConfig>): Promise<StandardizedAPIResponse<T>> {
    return this.request<T>({
      ...options,
      url: this.buildUrl(path),
      method: 'DELETE',
    });
  }

  async request<T = unknown>(config: RequestConfig): Promise<StandardizedAPIResponse<T>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    // Check cache for GET requests
    if (config.method === 'GET' && this.cache) {
      const cached = this.getCached<T>(config.url);
      if (cached) {
        return apiResponseHandler.success(cached, {
          requestId,
          duration: 0,
          cached: true,
        });
      }
    }

    try {
      // Merge headers
      const mergedHeaders = new Headers({
        ...this.headers,
        ...getVersionHeaders(),
        ...config.headers,
      });
      config.headers = mergedHeaders;

      // Set default timeout
      if (!config.timeout) {
        config.timeout = this.config.timeout || 30000;
      }

      // Set default retries
      if (config.maxRetries === undefined) {
        config.maxRetries = this.config.maxRetries || 3;
      }

      // Make request through interceptor manager
      const response = await this.interceptorManager.fetch<T>(config);

      // Cache successful GET responses
      if (config.method === 'GET' && this.cache && response.success && response.data) {
        this.setCached(config.url, response.data);
      }

      // Record metrics
      this.recordMetrics(config.url, Date.now() - startTime, response.success);

      return response;
    } catch (error: unknown) {
      logger.error(`API request failed: ${config.url}`, error);
      
      return apiResponseHandler.error(error, {
        requestId,
        duration: Date.now() - startTime,
      });
    }
  }

  getConfig(): APIClientConfig {
    return { ...this.config };
  }

  setHeader(key: string, value: string): void {
    this.headers[key] = value;
  }

  addInterceptor(
    type: 'request' | 'response' | 'error',
    interceptor: unknown
  ): () => void {
    switch (type) {
      case 'request':
        return this.interceptorManager.addRequestInterceptor(interceptor as RequestInterceptor);
      case 'response':
        return this.interceptorManager.addResponseInterceptor(interceptor as ResponseInterceptor);
      case 'error':
        return this.interceptorManager.addErrorInterceptor(interceptor as ErrorInterceptor);
    }
  }

  // ============= Private Methods =============

  private buildUrl(path: string): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  private setupDefaultInterceptors(): void {
    // Add auth interceptor if configured
    if (this.config.auth) {
      const authInterceptor = createAuthInterceptor(
        this.config.auth.getToken,
        this.config.auth.headerName || 'Authorization',
        this.config.auth.type === 'bearer' ? 'Bearer' : 
        this.config.auth.type === 'api-key' ? '' : 'Basic'
      );
      this.interceptorManager.addRequestInterceptor(authInterceptor);
    }

    // Add retry interceptor
    const retryInterceptor = createRetryInterceptor({
      maxRetries: this.config.maxRetries || 3,
    });
    this.interceptorManager.addErrorInterceptor(retryInterceptor);

    // Add rate limit interceptor
    const rateLimitInterceptor = createRateLimitInterceptor({
      maxRetries: this.config.maxRetries || 3,
      onRateLimited: (retryAfter) => {
        logger.warn(`Rate limited, will retry after ${retryAfter}s`);
      },
    });
    this.interceptorManager.addErrorInterceptor(rateLimitInterceptor);

    // Add logging interceptor
    const loggingInterceptor: ResponseInterceptor = (context) => {
      logger.debug(`API call: ${context.request.config.url}`, {
        status: context.response.status,
        duration: `${context.duration}ms`,
      });
      return context;
    };
    this.interceptorManager.addResponseInterceptor(loggingInterceptor);
  }

  private getCached<T>(url: string): T | null {
    if (!this.cache) return null;

    const cached = this.cache.get(url);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }

    if (cached) {
      this.cache.delete(url);
    }

    return null;
  }

  private setCached(url: string, data: unknown): void {
    if (!this.cache) return;

    const ttl = this.config.cache?.ttl || 5 * 60 * 1000; // 5 minutes default
    
    this.cache.set(url, {
      data,
      expires: Date.now() + ttl,
    });

    // Enforce max size
    const maxSize = this.config.cache?.maxSize || 100;
    if (this.cache.size > maxSize) {
      // Remove oldest entries
      const keys = Array.from(this.cache.keys());
      const toRemove = keys.slice(0, this.cache.size - maxSize);
      for (const key of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  private metrics = new Map<string, { count: number; errors: number; totalDuration: number }>();

  private recordMetrics(url: string, duration: number, success: boolean): void {
    const key = new URL(url, this.config.baseUrl).pathname;
    const metric = this.metrics.get(key) || { count: 0, errors: 0, totalDuration: 0 };
    
    metric.count++;
    metric.totalDuration += duration;
    if (!success) metric.errors++;
    
    this.metrics.set(key, metric);
  }
}

// ============= Factory Functions =============

/**
 * Create a new API client with the given configuration
 */
export const createAPIClient = (config: APIClientConfig): APIClient => {
  // Validate required config
  if (!config.baseUrl) {
    throw new Error('baseUrl is required for API client');
  }

  // Normalize base URL
  const normalizedConfig: APIClientConfig = {
    ...config,
    baseUrl: config.baseUrl.replace(/\/$/, ''),
  };

  return new StandardAPIClient(normalizedConfig);
};

/**
 * Create a Google API client
 */
export const createGoogleAPIClient = (
  apiKey: string | (() => string | Promise<string>)
): APIClient => {
  return createAPIClient({
    baseUrl: 'https://generativelanguage.googleapis.com',
    auth: {
      type: 'api-key',
      getToken: typeof apiKey === 'function' ? apiKey : () => apiKey,
      headerName: 'x-goog-api-key',
    },
    timeout: 60000,
    maxRetries: 3,
    cache: {
      enabled: true,
      ttl: 15 * 60 * 1000, // 15 minutes
    },
  });
};

/**
 * Create a Supabase API client
 */
export const createSupabaseAPIClient = (
  baseUrl: string,
  anonKey: string | (() => string | Promise<string>)
): APIClient => {
  return createAPIClient({
    baseUrl,
    auth: {
      type: 'bearer',
      getToken: typeof anonKey === 'function' ? anonKey : () => anonKey,
      headerName: 'Authorization',
    },
    headers: {
      'apikey': typeof anonKey === 'function' ? '' : anonKey,
    },
    timeout: 30000,
    maxRetries: 3,
    cache: {
      enabled: true,
      ttl: 5 * 60 * 1000, // 5 minutes
    },
  });
};

/**
 * Create an OpenAI-compatible API client
 */
export const createOpenAICompatibleClient = (
  baseUrl: string,
  apiKey: string | (() => string | Promise<string>),
  options?: Partial<APIClientConfig>
): APIClient => {
  return createAPIClient({
    baseUrl,
    auth: {
      type: 'bearer',
      getToken: typeof apiKey === 'function' ? apiKey : () => apiKey,
    },
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 120000, // 2 minutes for AI generation
    maxRetries: 3,
    ...options,
  });
};

// ============= Default Client =============

let defaultClient: APIClient | null = null;

/**
 * Get or create the default API client
 */
export const getDefaultClient = (): APIClient => {
  if (!defaultClient) {
    throw new Error('Default API client not initialized. Call initializeDefaultClient first.');
  }
  return defaultClient;
};

/**
 * Initialize the default API client
 */
export const initializeDefaultClient = (config: APIClientConfig): void => {
  defaultClient = createAPIClient(config);
  logger.info('Default API client initialized');
};

/**
 * Check if default client is initialized
 */
export const hasDefaultClient = (): boolean => {
  return defaultClient !== null;
};
