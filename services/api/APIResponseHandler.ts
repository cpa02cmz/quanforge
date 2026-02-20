/**
 * API Response Handler - Standardized API Response Processing
 * 
 * This module provides a unified approach to handling API responses across
 * all services in the application. It implements best practices for:
 * - Type-safe response handling
 * - Standardized error transformation
 * - Response validation
 * - Metrics collection
 * 
 * @module APIResponseHandler
 * @since 2026-02-20
 */

import { APIResponse } from '../../types/common';
import { createScopedLogger } from '../../utils/logger';

const _logger = createScopedLogger('APIResponseHandler');

// ============= HTTP Status Codes =============

export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// ============= API Error Types =============

export interface APIErrorDetail {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface StandardizedAPIError {
  status: number;
  code: string;
  message: string;
  details: APIErrorDetail[];
  timestamp: number;
  requestId?: string;
  retryable: boolean;
}

// ============= Response Types =============

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface APIResponseMetadata {
  timestamp: number;
  requestId?: string;
  duration?: number;
  cached?: boolean;
  version?: string;
}

export interface StandardizedAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: StandardizedAPIError;
  metadata: APIResponseMetadata;
}

// ============= Response Handler Class =============

/**
 * Handles API responses with standardized formatting and error handling
 */
export class APIResponseHandler {
  private static instance: APIResponseHandler;
  private requestMetrics = new Map<string, { count: number; totalDuration: number; errors: number }>();

  private constructor() {}

  static getInstance(): APIResponseHandler {
    if (!APIResponseHandler.instance) {
      APIResponseHandler.instance = new APIResponseHandler();
    }
    return APIResponseHandler.instance;
  }

  /**
   * Creates a successful API response
   */
  success<T>(
    data: T,
    options?: {
      requestId?: string;
      duration?: number;
      cached?: boolean;
      version?: string;
    }
  ): StandardizedAPIResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        timestamp: Date.now(),
        requestId: options?.requestId,
        duration: options?.duration,
        cached: options?.cached,
        version: options?.version,
      },
    };
  }

  /**
   * Creates an error API response
   */
  error(
    error: unknown,
    options?: {
      requestId?: string;
      duration?: number;
      version?: string;
    }
  ): StandardizedAPIResponse<never> {
    const standardizedError = this.standardizeError(error);
    
    return {
      success: false,
      error: standardizedError,
      metadata: {
        timestamp: Date.now(),
        requestId: options?.requestId,
        duration: options?.duration,
        version: options?.version,
      },
    };
  }

  /**
   * Wraps a raw API response in standardized format
   */
  wrap<T>(
    response: APIResponse<T>,
    options?: {
      requestId?: string;
      duration?: number;
      cached?: boolean;
      version?: string;
    }
  ): StandardizedAPIResponse<T> {
    if (response.success) {
      return this.success(response.data as T, {
        requestId: options?.requestId ?? response.timestamp?.toString(),
        duration: options?.duration,
        cached: options?.cached,
        version: options?.version,
      });
    }

    return this.error(response.error, {
      requestId: options?.requestId ?? response.timestamp?.toString(),
      duration: options?.duration,
      version: options?.version,
    });
  }

  /**
   * Transforms unknown error to standardized API error
   */
  standardizeError(error: unknown): StandardizedAPIError {
    const timestamp = Date.now();

    // Handle Error instances
    if (error instanceof Error) {
      return {
        status: this.extractStatus(error),
        code: this.extractCode(error),
        message: error.message,
        details: [{
          code: this.extractCode(error),
          message: error.message,
        }],
        timestamp,
        retryable: this.isRetryable(error),
      };
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: error,
        details: [{
          code: 'INTERNAL_ERROR',
          message: error,
        }],
        timestamp,
        retryable: false,
      };
    }

    // Handle object errors
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      const status = typeof errorObj.status === 'number' ? errorObj.status : HTTP_STATUS.INTERNAL_SERVER_ERROR;
      const message = typeof errorObj.message === 'string' ? errorObj.message : 'An unexpected error occurred';
      const code = typeof errorObj.code === 'string' ? errorObj.code : 'UNKNOWN_ERROR';

      return {
        status,
        code,
        message,
        details: [{
          code,
          message,
          details: errorObj.details as Record<string, unknown> | undefined,
        }],
        timestamp,
        requestId: typeof errorObj.requestId === 'string' ? errorObj.requestId : undefined,
        retryable: this.isRetryableByStatus(status),
      };
    }

    // Fallback
    return {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      details: [{
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
      }],
      timestamp,
      retryable: false,
    };
  }

  /**
   * Validates response data against a schema
   */
  validate<T>(
    data: unknown,
    validator: (data: unknown) => data is T,
    errorMessage = 'Response validation failed'
  ): StandardizedAPIResponse<T> {
    if (validator(data)) {
      return this.success(data);
    }

    return this.error(new Error(errorMessage));
  }

  /**
   * Creates a paginated response
   */
  paginated<T>(
    items: T[],
    options: {
      total: number;
      page: number;
      pageSize: number;
    }
  ): StandardizedAPIResponse<PaginatedData<T>> {
    const { total, page, pageSize } = options;
    const hasMore = page * pageSize < total;

    return this.success<PaginatedData<T>>({
      items,
      total,
      page,
      pageSize,
      hasMore,
    });
  }

  /**
   * Records metrics for a request
   */
  recordMetrics(
    endpoint: string,
    duration: number,
    success: boolean
  ): void {
    const metrics = this.requestMetrics.get(endpoint) || { count: 0, totalDuration: 0, errors: 0 };
    metrics.count++;
    metrics.totalDuration += duration;
    if (!success) {
      metrics.errors++;
    }
    this.requestMetrics.set(endpoint, metrics);
  }

  /**
   * Gets metrics for all requests
   */
  getMetrics(): Record<string, { count: number; avgDuration: number; errorRate: number }> {
    const result: Record<string, { count: number; avgDuration: number; errorRate: number }> = {};

    for (const [endpoint, metrics] of this.requestMetrics.entries()) {
      result[endpoint] = {
        count: metrics.count,
        avgDuration: metrics.count > 0 ? metrics.totalDuration / metrics.count : 0,
        errorRate: metrics.count > 0 ? metrics.errors / metrics.count : 0,
      };
    }

    return result;
  }

  /**
   * Clears all metrics
   */
  clearMetrics(): void {
    this.requestMetrics.clear();
  }

  // ============= Private Helpers =============

  private extractStatus(error: Error): number {
    const errorWithStatus = error as Error & { status?: number };
    if (errorWithStatus.status) {
      return errorWithStatus.status;
    }

    // Check for status in message
    const statusMatch = error.message.match(/(\d{3})/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      if (status >= 400 && status < 600) {
        return status;
      }
    }

    return HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }

  private extractCode(error: Error): string {
    const errorWithCode = error as Error & { code?: string };
    if (errorWithCode.code) {
      return errorWithCode.code;
    }

    // Generate code from status
    const status = this.extractStatus(error);
    return this.statusToCode(status);
  }

  private statusToCode(status: number): string {
    const codes: Record<number, string> = {
      [HTTP_STATUS.BAD_REQUEST]: 'BAD_REQUEST',
      [HTTP_STATUS.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HTTP_STATUS.FORBIDDEN]: 'FORBIDDEN',
      [HTTP_STATUS.NOT_FOUND]: 'NOT_FOUND',
      [HTTP_STATUS.CONFLICT]: 'CONFLICT',
      [HTTP_STATUS.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HTTP_STATUS.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
      [HTTP_STATUS.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
      [HTTP_STATUS.BAD_GATEWAY]: 'BAD_GATEWAY',
      [HTTP_STATUS.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
      [HTTP_STATUS.GATEWAY_TIMEOUT]: 'GATEWAY_TIMEOUT',
    };

    return codes[status] || 'UNKNOWN_ERROR';
  }

  private isRetryable(error: Error): boolean {
    const status = this.extractStatus(error);
    return this.isRetryableByStatus(status);
  }

  private isRetryableByStatus(status: number): boolean {
    // Retryable status codes
    const retryableStatuses: number[] = [
      HTTP_STATUS.TOO_MANY_REQUESTS,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      HTTP_STATUS.BAD_GATEWAY,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      HTTP_STATUS.GATEWAY_TIMEOUT,
    ];

    return retryableStatuses.includes(status);
  }
}

// ============= Export Singleton Instance =============

export const apiResponseHandler = APIResponseHandler.getInstance();

// ============= Convenience Functions =============

/**
 * Creates a success response
 */
export const apiSuccess = <T>(data: T, options?: Parameters<typeof apiResponseHandler.success>[1]) =>
  apiResponseHandler.success(data, options);

/**
 * Creates an error response
 */
export const apiError = (error: unknown, options?: Parameters<typeof apiResponseHandler.error>[1]) =>
  apiResponseHandler.error(error, options);

/**
 * Wraps an API response
 */
export const apiWrap = <T>(response: APIResponse<T>, options?: Parameters<typeof apiResponseHandler.wrap>[1]) =>
  apiResponseHandler.wrap(response, options);

/**
 * Creates a paginated response
 */
export const apiPaginated = <T>(
  items: T[],
  options: Parameters<typeof apiResponseHandler.paginated>[1]
) => apiResponseHandler.paginated(items, options);
