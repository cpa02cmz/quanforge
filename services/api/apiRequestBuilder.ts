/**
 * API Request Builder - Fluent Request Construction
 * 
 * This module provides a fluent API for building and executing API requests:
 * - Chainable method calls for request configuration
 * - Type-safe request building
 * - Automatic integration with unified facade
 * - Request interceptors and transformations
 * - Progress tracking for uploads/downloads
 * 
 * Benefits:
 * - Clean, readable request code
 * - Type safety throughout the request chain
 * - Reusable request configurations
 * - Easy testing and mocking
 * 
 * @module services/api/apiRequestBuilder
 * @since 2026-02-22
 * @author API Specialist Agent
 */

import { createScopedLogger } from '../../utils/logger';
import { getUnifiedAPIFacade, UnifiedRequestOptions } from './apiUnifiedFacade';
import { StandardizedAPIResponse } from './APIResponseHandler';
import { getAPIEndpointRegistry } from './apiEndpointRegistry';
import { getAPIErrorClassifier, APIError } from './apiErrorClassifier';

const _logger = createScopedLogger('APIRequestBuilder');

// ============= Types =============

/**
 * Request body types
 */
export type RequestBody = 
  | string
  | Blob
  | ArrayBuffer
  | FormData
  | URLSearchParams
  | Record<string, unknown>
  | unknown[];

/**
 * Progress event for uploads/downloads
 */
export interface ProgressEvent {
  /** Bytes loaded */
  loaded: number;
  /** Total bytes (if known) */
  total?: number;
  /** Progress percentage (0-100) */
  percentage?: number;
  /** Time elapsed in ms */
  elapsed: number;
  /** Transfer speed in bytes/second */
  speed?: number;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Request builder options
 */
export interface RequestBuilderOptions {
  /** Base URL */
  baseUrl?: string;
  /** Default headers */
  defaultHeaders?: Record<string, string>;
  /** Default timeout */
  defaultTimeout?: number;
  /** Request transform function */
  transformRequest?: (options: UnifiedRequestOptions) => UnifiedRequestOptions;
  /** Response transform function */
  transformResponse?: <T>(response: T) => T;
  /** Error transform function */
  transformError?: (error: unknown) => APIError;
}

/**
 * Request configuration state
 */
interface RequestState {
  url: string;
  method: string;
  headers: Record<string, string>;
  query: Record<string, string | number | boolean>;
  body?: RequestBody;
  timeout?: number;
  metadata?: Record<string, unknown>;
  cacheKey?: string;
  priority?: 'high' | 'medium' | 'low';
  skipCache?: boolean;
  skipDeduplication?: boolean;
  skipRateLimiting?: boolean;
  skipSecurity?: boolean;
  skipOptimizations?: boolean;
  onUploadProgress?: ProgressCallback;
  onDownloadProgress?: ProgressCallback;
  signal?: AbortSignal;
}

// ============= API Request Builder Class =============

/**
 * API Request Builder
 * 
 * A fluent builder for constructing and executing API requests.
 */
export class APIRequestBuilder<T = unknown> {
  private state: RequestState;
  private options: RequestBuilderOptions;
  private transformFn?: (response: unknown) => T;

  constructor(
    url: string = '',
    options: RequestBuilderOptions = {}
  ) {
    this.state = {
      url,
      method: 'GET',
      headers: {},
      query: {},
    };
    this.options = options;
    
    // Apply default headers
    if (options.defaultHeaders) {
      this.state.headers = { ...options.defaultHeaders };
    }
  }

  // ============= URL Methods =============

  /**
   * Set the request URL
   */
  url(url: string): this {
    this.state.url = url;
    return this;
  }

  /**
   * Append to the URL path
   */
  path(...segments: string[]): this {
    const cleanSegments = segments.map(s => s.replace(/^\/|\/$/g, ''));
    this.state.url = `${this.state.url}/${cleanSegments.join('/')}`;
    return this;
  }

  /**
   * Set base URL
   */
  baseUrl(baseUrl: string): this {
    this.options.baseUrl = baseUrl;
    return this;
  }

  /**
   * Use an endpoint ID from the registry
   */
  endpoint(endpointId: string, params?: Record<string, string>): this {
    const registry = getAPIEndpointRegistry();
    const resolved = registry.resolve(endpointId, params);
    if (resolved) {
      this.state.url = resolved.url;
      this.state.method = resolved.method;
      this.state.headers = { ...this.state.headers, ...resolved.headers };
      
      if (resolved.config.timeout) {
        this.state.timeout = resolved.config.timeout;
      }
    }
    return this;
  }

  // ============= HTTP Method Methods =============

  /**
   * Set method to GET
   */
  get(): this {
    this.state.method = 'GET';
    return this;
  }

  /**
   * Set method to POST
   */
  post(body?: RequestBody): this {
    this.state.method = 'POST';
    if (body !== undefined) {
      this.state.body = body;
    }
    return this;
  }

  /**
   * Set method to PUT
   */
  put(body?: RequestBody): this {
    this.state.method = 'PUT';
    if (body !== undefined) {
      this.state.body = body;
    }
    return this;
  }

  /**
   * Set method to PATCH
   */
  patch(body?: RequestBody): this {
    this.state.method = 'PATCH';
    if (body !== undefined) {
      this.state.body = body;
    }
    return this;
  }

  /**
   * Set method to DELETE
   */
  delete(): this {
    this.state.method = 'DELETE';
    return this;
  }

  /**
   * Set custom HTTP method
   */
  method(method: string): this {
    this.state.method = method.toUpperCase();
    return this;
  }

  // ============= Header Methods =============

  /**
   * Set a single header
   */
  header(key: string, value: string): this {
    this.state.headers[key] = value;
    return this;
  }

  /**
   * Set multiple headers
   */
  headers(headers: Record<string, string>): this {
    this.state.headers = { ...this.state.headers, ...headers };
    return this;
  }

  /**
   * Set Content-Type header
   */
  contentType(type: string): this {
    this.state.headers['Content-Type'] = type;
    return this;
  }

  /**
   * Set Authorization header (Bearer token)
   */
  bearerToken(token: string): this {
    this.state.headers['Authorization'] = `Bearer ${token}`;
    return this;
  }

  /**
   * Set Authorization header (API key)
   */
  apiKey(key: string, headerName: string = 'X-API-Key'): this {
    this.state.headers[headerName] = key;
    return this;
  }

  /**
   * Set Accept header
   */
  accept(type: string): this {
    this.state.headers['Accept'] = type;
    return this;
  }

  // ============= Query Methods =============

  /**
   * Add a query parameter
   */
  query(key: string, value: string | number | boolean): this {
    this.state.query[key] = value;
    return this;
  }

  /**
   * Add multiple query parameters
   */
  queryParams(params: Record<string, string | number | boolean>): this {
    this.state.query = { ...this.state.query, ...params };
    return this;
  }

  // ============= Body Methods =============

  /**
   * Set JSON body
   */
  json<TBody>(body: TBody): this {
    this.state.body = JSON.stringify(body);
    this.state.headers['Content-Type'] = 'application/json';
    return this;
  }

  /**
   * Set form data body
   */
  formData(formData: FormData): this {
    this.state.body = formData;
    // Don't set Content-Type, let the browser set it with boundary
    delete this.state.headers['Content-Type'];
    return this;
  }

  /**
   * Set URL encoded body
   */
  urlEncoded(data: Record<string, string>): this {
    const params = new URLSearchParams(data);
    this.state.body = params.toString();
    this.state.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    return this;
  }

  /**
   * Set text body
   */
  text(text: string): this {
    this.state.body = text;
    this.state.headers['Content-Type'] = 'text/plain';
    return this;
  }

  /**
   * Set blob body
   */
  blob(blob: Blob): this {
    this.state.body = blob;
    return this;
  }

  /**
   * Set raw body
   */
  body(body: RequestBody): this {
    this.state.body = body;
    return this;
  }

  // ============= Configuration Methods =============

  /**
   * Set request timeout
   */
  timeout(ms: number): this {
    this.state.timeout = ms;
    return this;
  }

  /**
   * Set request priority
   */
  priority(priority: 'high' | 'medium' | 'low'): this {
    this.state.priority = priority;
    return this;
  }

  /**
   * Set cache key
   */
  cacheKey(key: string): this {
    this.state.cacheKey = key;
    return this;
  }

  /**
   * Set request metadata
   */
  metadata(metadata: Record<string, unknown>): this {
    this.state.metadata = metadata;
    return this;
  }

  // ============= Skip Methods =============

  /**
   * Skip all optimizations
   */
  skipOptimizations(): this {
    this.state.skipOptimizations = true;
    return this;
  }

  /**
   * Skip caching
   */
  skipCache(): this {
    this.state.skipCache = true;
    return this;
  }

  /**
   * Skip deduplication
   */
  skipDeduplication(): this {
    this.state.skipDeduplication = true;
    return this;
  }

  /**
   * Skip rate limiting
   */
  skipRateLimiting(): this {
    this.state.skipRateLimiting = true;
    return this;
  }

  /**
   * Skip security validation
   */
  skipSecurity(): this {
    this.state.skipSecurity = true;
    return this;
  }

  // ============= Progress Methods =============

  /**
   * Set upload progress callback
   */
  onUploadProgress(callback: ProgressCallback): this {
    this.state.onUploadProgress = callback;
    return this;
  }

  /**
   * Set download progress callback
   */
  onDownloadProgress(callback: ProgressCallback): this {
    this.state.onDownloadProgress = callback;
    return this;
  }

  // ============= Abort Methods =============

  /**
   * Set abort signal
   */
  signal(signal: AbortSignal): this {
    this.state.signal = signal;
    return this;
  }

  // ============= Transform Methods =============

  /**
   * Transform the response
   */
  transform<R>(fn: (response: T) => R): APIRequestBuilder<R> {
    const builder = new APIRequestBuilder<R>(this.state.url, this.options);
    builder.state = { ...this.state };
    builder.transformFn = fn as (response: unknown) => R;
    return builder;
  }

  // ============= Execution Methods =============

  /**
   * Execute the request and get a standardized response
   */
  async execute(): Promise<StandardizedAPIResponse<T>> {
    const options = this.buildOptions();
    
    try {
      const facade = getUnifiedAPIFacade();
      let response = await facade.request<unknown>(options);
      
      // Apply transform if set
      if (response.success && response.data && this.transformFn) {
        response = {
          ...response,
          data: this.transformFn(response.data),
        } as StandardizedAPIResponse<T>;
      }
      
      // Record to endpoint registry if using endpoint ID
      if (options.metadata?.endpointId) {
        const registry = getAPIEndpointRegistry();
        registry.recordRequest(
          options.metadata.endpointId as string,
          response.success,
          response.metadata?.duration || 0
        );
      }
      
      return response as StandardizedAPIResponse<T>;
      
    } catch (error: unknown) {
      const classifier = getAPIErrorClassifier();
      const apiError = classifier.classify(error, {
        url: options.url,
        method: options.method,
      });
      
      return {
        success: false,
        error: {
          status: 500,
          code: apiError.code,
          message: apiError.message,
          details: [{
            code: apiError.code,
            message: apiError.message,
          }],
          timestamp: Date.now(),
          requestId: apiError.requestId,
          retryable: apiError.isRetryable(),
        },
        metadata: {
          timestamp: Date.now(),
          requestId: apiError.requestId,
          duration: 0,
        },
      };
    }
  }

  /**
   * Execute and return only the data
   * @throws APIError if the request fails
   */
  async getData(): Promise<T> {
    const response = await this.execute();
    if (!response.success) {
      throw getAPIErrorClassifier().classify(response.error, {
        url: this.state.url,
        method: this.state.method,
      });
    }
    return response.data as T;
  }

  /**
   * Execute and check if successful
   */
  async isSuccess(): Promise<boolean> {
    const response = await this.execute();
    return response.success;
  }

  /**
   * Build the request options
   */
  private buildOptions(): UnifiedRequestOptions {
    // Build URL with query parameters
    let url = this.state.url;
    if (Object.keys(this.state.query).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(this.state.query)) {
        searchParams.append(key, String(value));
      }
      url = `${url}?${searchParams.toString()}`;
    }
    
    // Apply base URL if set
    if (this.options.baseUrl) {
      url = `${this.options.baseUrl}${url}`;
    }
    
    // Convert body if object
    let body: BodyInit | null | undefined;
    if (this.state.body !== undefined) {
      if (typeof this.state.body === 'object' && 
          !(this.state.body instanceof Blob) &&
          !(this.state.body instanceof FormData) &&
          !(this.state.body instanceof URLSearchParams) &&
          !(this.state.body instanceof ArrayBuffer)) {
        body = JSON.stringify(this.state.body);
        this.state.headers['Content-Type'] = 'application/json';
      } else {
        body = this.state.body as BodyInit;
      }
    }
    
    const options: UnifiedRequestOptions = {
      url,
      method: this.state.method,
      headers: this.state.headers,
      body,
      timeout: this.state.timeout,
      cacheKey: this.state.cacheKey,
      priority: this.state.priority,
      metadata: this.state.metadata,
      skipCache: this.state.skipCache,
      skipDeduplication: this.state.skipDeduplication,
      skipRateLimiting: this.state.skipRateLimiting,
      skipSecurity: this.state.skipSecurity,
      skipOptimizations: this.state.skipOptimizations,
    };
    
    // Apply request transform if set
    if (this.options.transformRequest) {
      return this.options.transformRequest(options);
    }
    
    return options;
  }

  // ============= Utility Methods =============

  /**
   * Clone the builder
   */
  clone(): APIRequestBuilder<T> {
    const builder = new APIRequestBuilder<T>(this.state.url, this.options);
    builder.state = { ...this.state, headers: { ...this.state.headers }, query: { ...this.state.query } };
    builder.transformFn = this.transformFn;
    return builder;
  }

  /**
   * Get current request URL (with query params)
   */
  getUrl(): string {
    let url = this.state.url;
    if (Object.keys(this.state.query).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(this.state.query)) {
        searchParams.append(key, String(value));
      }
      url = `${url}?${searchParams.toString()}`;
    }
    if (this.options.baseUrl) {
      url = `${this.options.baseUrl}${url}`;
    }
    return url;
  }

  /**
   * Get current HTTP method
   */
  getMethod(): string {
    return this.state.method;
  }
}

// ============= Factory Functions =============

/**
 * Create a new request builder
 */
export const request = <T = unknown>(url?: string): APIRequestBuilder<T> => 
  new APIRequestBuilder<T>(url);

/**
 * Create a GET request builder
 */
export const getRequest = <T = unknown>(url: string): APIRequestBuilder<T> =>
  new APIRequestBuilder<T>(url).get() as unknown as APIRequestBuilder<T>;

/**
 * Create a POST request builder
 */
export const postRequest = <T = unknown>(url: string, body?: RequestBody): APIRequestBuilder<T> =>
  new APIRequestBuilder<T>(url).post(body) as unknown as APIRequestBuilder<T>;

/**
 * Create a PUT request builder
 */
export const putRequest = <T = unknown>(url: string, body?: RequestBody): APIRequestBuilder<T> =>
  new APIRequestBuilder<T>(url).put(body) as unknown as APIRequestBuilder<T>;

/**
 * Create a PATCH request builder
 */
export const patchRequest = <T = unknown>(url: string, body?: RequestBody): APIRequestBuilder<T> =>
  new APIRequestBuilder<T>(url).patch(body) as unknown as APIRequestBuilder<T>;

/**
 * Create a DELETE request builder
 */
export const deleteRequest = <T = unknown>(url: string): APIRequestBuilder<T> =>
  new APIRequestBuilder<T>(url).delete() as unknown as APIRequestBuilder<T>;

// ============= React Hook =============

/**
 * React hook for using the API request builder
 */
export const useAPIRequestBuilder = () => {
  return {
    request: <T = unknown>(url?: string) => request<T>(url),
    get: <T = unknown>(url: string) => getRequest<T>(url),
    post: <T = unknown>(url: string, body?: RequestBody) => postRequest<T>(url, body),
    put: <T = unknown>(url: string, body?: RequestBody) => putRequest<T>(url, body),
    patch: <T = unknown>(url: string, body?: RequestBody) => patchRequest<T>(url, body),
    del: <T = unknown>(url: string) => deleteRequest<T>(url),
  };
};
