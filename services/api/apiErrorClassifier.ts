/**
 * API Error Classifier - Typed Error Handling for API Operations
 * 
 * This module provides a comprehensive error classification system that:
 * - Categorizes errors by type (network, server, client, auth, etc.)
 * - Provides typed error classes with detailed information
 * - Supports error recovery suggestions
 * - Tracks error patterns and frequencies
 * - Integrates with logging and monitoring
 * 
 * Benefits:
 * - Consistent error handling across the application
 * - Type-safe error catching and handling
 * - Actionable error messages for users
 * - Error analytics and pattern detection
 * 
 * @module services/api/apiErrorClassifier
 * @since 2026-02-22
 * @author API Specialist Agent
 */

import { createScopedLogger } from '../../utils/logger';
import { HTTP_STATUS } from './APIResponseHandler';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('APIErrorClassifier');

// ============= Types =============

/**
 * Error category for classification
 */
export type ErrorCategory = 
  | 'network'
  | 'timeout'
  | 'server'
  | 'client'
  | 'auth'
  | 'validation'
  | 'rate_limit'
  | 'not_found'
  | 'conflict'
  | 'cancellation'
  | 'unknown';

/**
 * Error severity level
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error recovery suggestion
 */
export interface ErrorRecovery {
  /** Suggested action for the user */
  action: string;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryDelay?: number;
  /** Whether user intervention is required */
  requiresUserAction: boolean;
  /** Help URL for more information */
  helpUrl?: string;
}

/**
 * Base API error interface
 */
export interface APIErrorInfo {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** HTTP status code if available */
  statusCode?: number;
  /** Original error */
  originalError?: Error;
  /** Request URL */
  url?: string;
  /** Request method */
  method?: string;
  /** Timestamp */
  timestamp: number;
  /** Request ID for tracing */
  requestId?: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Recovery suggestions */
  recovery?: ErrorRecovery;
}

/**
 * Error statistics
 */
export interface ErrorStats {
  /** Total errors recorded */
  totalErrors: number;
  /** Errors by category */
  errorsByCategory: Record<ErrorCategory, number>;
  /** Errors by code */
  errorsByCode: Record<string, number>;
  /** Most common errors */
  topErrors: Array<{ code: string; count: number; message: string }>;
  /** Error rate (errors per minute) */
  errorRate: number;
}

// ============= Error Classes =============

/**
 * Base API Error class
 */
export class APIError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly statusCode?: number;
  public readonly originalError?: Error;
  public readonly url?: string;
  public readonly method?: string;
  public readonly timestamp: number;
  public readonly requestId?: string;
  public readonly context?: Record<string, unknown>;
  public readonly recovery?: ErrorRecovery;

  constructor(info: APIErrorInfo) {
    super(info.message);
    this.name = 'APIError';
    this.code = info.code;
    this.category = info.category;
    this.severity = info.severity;
    this.statusCode = info.statusCode;
    this.originalError = info.originalError;
    this.url = info.url;
    this.method = info.method;
    this.timestamp = info.timestamp;
    this.requestId = info.requestId;
    this.context = info.context;
    this.recovery = info.recovery;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.recovery?.retryable ?? false;
  }

  /**
   * Get suggested retry delay
   */
  getRetryDelay(): number {
    return this.recovery?.retryDelay ?? 1000;
  }

  /**
   * Convert to plain object
   */
  toJSON(): APIErrorInfo {
    return {
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      statusCode: this.statusCode,
      url: this.url,
      method: this.method,
      timestamp: this.timestamp,
      requestId: this.requestId,
      context: this.context,
      recovery: this.recovery,
    };
  }
}

/**
 * Network error (connection issues)
 */
export class NetworkError extends APIError {
  constructor(message: string, options?: Partial<APIErrorInfo>) {
    super({
      code: 'NETWORK_ERROR',
      message,
      category: 'network',
      severity: 'high',
      timestamp: Date.now(),
      recovery: {
        action: 'Check your internet connection and try again',
        retryable: true,
        retryDelay: 2000,
        requiresUserAction: false,
      },
      ...options,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends APIError {
  constructor(message: string, options?: Partial<APIErrorInfo>) {
    super({
      code: 'TIMEOUT_ERROR',
      message,
      category: 'timeout',
      severity: 'medium',
      timestamp: Date.now(),
      recovery: {
        action: 'The request took too long. Please try again',
        retryable: true,
        retryDelay: 1000,
        requiresUserAction: false,
      },
      ...options,
    });
    this.name = 'TimeoutError';
  }
}

/**
 * Authentication error
 */
export class AuthError extends APIError {
  constructor(message: string, options?: Partial<APIErrorInfo>) {
    super({
      code: 'AUTH_ERROR',
      message,
      category: 'auth',
      severity: 'high',
      timestamp: Date.now(),
      recovery: {
        action: 'Please log in again to continue',
        retryable: false,
        requiresUserAction: true,
      },
      ...options,
    });
    this.name = 'AuthError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends APIError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, options?: Partial<APIErrorInfo>) {
    super({
      code: 'RATE_LIMIT_ERROR',
      message,
      category: 'rate_limit',
      severity: 'medium',
      statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
      timestamp: Date.now(),
      recovery: {
        action: `Too many requests. Please wait ${retryAfter ? `${retryAfter} seconds` : 'a moment'} and try again`,
        retryable: true,
        retryDelay: (retryAfter ?? 60) * 1000,
        requiresUserAction: false,
      },
      ...options,
    });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Validation error
 */
export class ValidationError extends APIError {
  public readonly fields?: Record<string, string[]>;

  constructor(message: string, fields?: Record<string, string[]>, options?: Partial<APIErrorInfo>) {
    super({
      code: 'VALIDATION_ERROR',
      message,
      category: 'validation',
      severity: 'low',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      timestamp: Date.now(),
      recovery: {
        action: 'Please check your input and try again',
        retryable: false,
        requiresUserAction: true,
      },
      ...options,
    });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/**
 * Not found error
 */
export class NotFoundError extends APIError {
  constructor(message: string, options?: Partial<APIErrorInfo>) {
    super({
      code: 'NOT_FOUND_ERROR',
      message,
      category: 'not_found',
      severity: 'low',
      statusCode: HTTP_STATUS.NOT_FOUND,
      timestamp: Date.now(),
      recovery: {
        action: 'The requested resource was not found',
        retryable: false,
        requiresUserAction: false,
      },
      ...options,
    });
    this.name = 'NotFoundError';
  }
}

/**
 * Server error
 */
export class ServerError extends APIError {
  constructor(message: string, options?: Partial<APIErrorInfo>) {
    super({
      code: 'SERVER_ERROR',
      message,
      category: 'server',
      severity: 'high',
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      timestamp: Date.now(),
      recovery: {
        action: 'A server error occurred. Please try again later',
        retryable: true,
        retryDelay: 5000,
        requiresUserAction: false,
      },
      ...options,
    });
    this.name = 'ServerError';
  }
}

/**
 * Cancellation error
 */
export class CancellationError extends APIError {
  constructor(message: string = 'Request was cancelled', options?: Partial<APIErrorInfo>) {
    super({
      code: 'CANCELLATION_ERROR',
      message,
      category: 'cancellation',
      severity: 'low',
      timestamp: Date.now(),
      recovery: {
        action: 'The request was cancelled',
        retryable: true,
        retryDelay: 0,
        requiresUserAction: false,
      },
      ...options,
    });
    this.name = 'CancellationError';
  }
}

/**
 * Conflict error
 */
export class ConflictError extends APIError {
  constructor(message: string, options?: Partial<APIErrorInfo>) {
    super({
      code: 'CONFLICT_ERROR',
      message,
      category: 'conflict',
      severity: 'medium',
      statusCode: HTTP_STATUS.CONFLICT,
      timestamp: Date.now(),
      recovery: {
        action: 'The resource has been modified. Please refresh and try again',
        retryable: false,
        requiresUserAction: true,
      },
      ...options,
    });
    this.name = 'ConflictError';
  }
}

// ============= Error Classifier Class =============

/**
 * API Error Classifier
 * 
 * Classifies and transforms raw errors into typed API errors
 * with recovery suggestions and tracking.
 */
export class APIErrorClassifier {
  // Error tracking
  private errorHistory: APIError[] = [];
  private maxHistorySize = 1000;
  
  // Statistics
  private stats = {
    totalErrors: 0,
    errorsByCategory: {} as Record<ErrorCategory, number>,
    errorsByCode: {} as Record<string, number>,
    startTime: Date.now(),
  };
  
  // Cleanup interval
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Initialize category counts
    const categories: ErrorCategory[] = [
      'network', 'timeout', 'server', 'client', 'auth',
      'validation', 'rate_limit', 'not_found', 'conflict',
      'cancellation', 'unknown',
    ];
    for (const category of categories) {
      this.stats.errorsByCategory[category] = 0;
    }
    
    // Start periodic cleanup
    this.startCleanup();
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiErrorClassifier', {
        cleanup: () => this.destroy(),
        priority: 'low',
        description: 'API error classifier service',
      });
    }
    
    logger.info('API Error Classifier initialized');
  }

  // ============= Classification Methods =============

  /**
   * Classify a raw error into an API error
   */
  classify(
    error: unknown,
    context?: {
      url?: string;
      method?: string;
      requestId?: string;
      statusCode?: number;
    }
  ): APIError {
    let apiError: APIError;
    
    if (error instanceof APIError) {
      apiError = error;
    } else if (error instanceof Error) {
      apiError = this.classifyNativeError(error, context);
    } else if (typeof error === 'string') {
      apiError = new APIError({
        code: 'UNKNOWN_ERROR',
        message: error,
        category: 'unknown',
        severity: 'medium',
        timestamp: Date.now(),
        ...context,
      });
    } else {
      apiError = new APIError({
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        category: 'unknown',
        severity: 'medium',
        timestamp: Date.now(),
        ...context,
      });
    }
    
    // Track the error
    this.trackError(apiError);
    
    return apiError;
  }

  /**
   * Classify a native Error object
   */
  private classifyNativeError(
    error: Error,
    context?: { url?: string; method?: string; requestId?: string; statusCode?: number }
  ): APIError {
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    const statusCode = context?.statusCode;
    
    // Check for specific error types
    if (name.includes('abort') || message.includes('abort')) {
      return new CancellationError(error.message, { originalError: error, ...context });
    }
    
    if (name.includes('timeout') || message.includes('timeout')) {
      return new TimeoutError(error.message, { originalError: error, ...context });
    }
    
    if (name.includes('network') || message.includes('network') || message.includes('fetch')) {
      return new NetworkError(error.message, { originalError: error, ...context });
    }
    
    // Check by status code
    if (statusCode !== undefined) {
      return this.classifyByStatusCode(error, statusCode, context);
    }
    
    // Default to unknown error
    return new APIError({
      code: 'UNKNOWN_ERROR',
      message: error.message,
      category: 'unknown',
      severity: 'medium',
      originalError: error,
      timestamp: Date.now(),
      ...context,
    });
  }

  /**
   * Classify error by HTTP status code
   */
  private classifyByStatusCode(
    error: Error,
    statusCode: number,
    context?: { url?: string; method?: string; requestId?: string }
  ): APIError {
    if (statusCode === HTTP_STATUS.UNAUTHORIZED) {
      return new AuthError('Authentication required', {
        originalError: error,
        statusCode,
        ...context,
      });
    }
    
    if (statusCode === HTTP_STATUS.FORBIDDEN) {
      return new AuthError('Access denied', {
        originalError: error,
        statusCode,
        ...context,
      });
    }
    
    if (statusCode === HTTP_STATUS.NOT_FOUND) {
      return new NotFoundError(error.message, {
        originalError: error,
        statusCode,
        ...context,
      });
    }
    
    if (statusCode === HTTP_STATUS.TOO_MANY_REQUESTS) {
      return new RateLimitError(error.message, undefined, {
        originalError: error,
        statusCode,
        ...context,
      });
    }
    
    if (statusCode === HTTP_STATUS.BAD_REQUEST) {
      return new ValidationError(error.message, undefined, {
        originalError: error,
        statusCode,
        ...context,
      });
    }
    
    if (statusCode === HTTP_STATUS.CONFLICT) {
      return new ConflictError(error.message, {
        originalError: error,
        statusCode,
        ...context,
      });
    }
    
    if (statusCode >= 500) {
      return new ServerError(error.message, {
        originalError: error,
        statusCode,
        ...context,
      });
    }
    
    if (statusCode >= 400 && statusCode < 500) {
      return new APIError({
        code: 'CLIENT_ERROR',
        message: error.message,
        category: 'client',
        severity: 'medium',
        originalError: error,
        statusCode,
        timestamp: Date.now(),
        ...context,
      });
    }
    
    return new APIError({
      code: 'HTTP_ERROR',
      message: error.message,
      category: 'unknown',
      severity: 'medium',
      originalError: error,
      statusCode,
      timestamp: Date.now(),
      ...context,
    });
  }

  // ============= Tracking Methods =============

  /**
   * Track an error for statistics
   */
  private trackError(error: APIError): void {
    this.stats.totalErrors++;
    this.stats.errorsByCategory[error.category]++;
    this.stats.errorsByCode[error.code] = (this.stats.errorsByCode[error.code] || 0) + 1;
    
    // Add to history
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
    
    // Log error
    this.logError(error);
  }

  /**
   * Log an error with appropriate level
   */
  private logError(error: APIError): void {
    const logData = {
      code: error.code,
      category: error.category,
      message: error.message,
      url: error.url,
      method: error.method,
      requestId: error.requestId,
    };
    
    switch (error.severity) {
      case 'critical':
        logger.error('Critical API error', logData);
        break;
      case 'high':
        logger.error('High severity API error', logData);
        break;
      case 'medium':
        logger.warn('API error', logData);
        break;
      case 'low':
        logger.debug('Low severity API error', logData);
        break;
    }
  }

  // ============= Statistics Methods =============

  /**
   * Get error statistics
   */
  getStats(): ErrorStats {
    const topErrors = Object.entries(this.stats.errorsByCode)
      .map(([code, count]) => ({
        code,
        count,
        message: this.getErrorMessage(code),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    const elapsedMinutes = (Date.now() - this.stats.startTime) / 60000;
    const errorRate = elapsedMinutes > 0 ? this.stats.totalErrors / elapsedMinutes : 0;
    
    return {
      totalErrors: this.stats.totalErrors,
      errorsByCategory: { ...this.stats.errorsByCategory },
      errorsByCode: { ...this.stats.errorsByCode },
      topErrors,
      errorRate,
    };
  }

  /**
   * Get error message by code
   */
  private getErrorMessage(code: string): string {
    const lastError = this.errorHistory.find(e => e.code === code);
    return lastError?.message || 'Unknown error';
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): APIError[] {
    return this.errorHistory.slice(-limit);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory, limit: number = 50): APIError[] {
    return this.errorHistory
      .filter(e => e.category === category)
      .slice(-limit);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsByCode: {},
      startTime: Date.now(),
    };
    
    // Reinitialize category counts
    const categories: ErrorCategory[] = [
      'network', 'timeout', 'server', 'client', 'auth',
      'validation', 'rate_limit', 'not_found', 'conflict',
      'cancellation', 'unknown',
    ];
    for (const category of categories) {
      this.stats.errorsByCategory[category] = 0;
    }
    
    this.errorHistory = [];
    logger.info('Error classifier statistics reset');
  }

  // ============= Utility Methods =============

  /**
   * Check if an error is retryable
   */
  isRetryable(error: unknown): boolean {
    if (error instanceof APIError) {
      return error.isRetryable();
    }
    return false;
  }

  /**
   * Get retry delay for an error
   */
  getRetryDelay(error: unknown): number {
    if (error instanceof APIError) {
      return error.getRetryDelay();
    }
    return 1000;
  }

  /**
   * Destroy the classifier
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.errorHistory = [];
    logger.info('API Error Classifier destroyed');
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      // Keep only last hour of errors
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      this.errorHistory = this.errorHistory.filter(e => e.timestamp > oneHourAgo);
    }, 60 * 60 * 1000);
  }
}

// ============= Singleton Instance =============

let classifierInstance: APIErrorClassifier | null = null;

/**
 * Get the API error classifier instance
 */
export const getAPIErrorClassifier = (): APIErrorClassifier => {
  if (!classifierInstance) {
    classifierInstance = new APIErrorClassifier();
  }
  return classifierInstance;
};

/**
 * Initialize the API error classifier
 */
export const initializeAPIErrorClassifier = (): APIErrorClassifier => {
  if (classifierInstance) {
    classifierInstance.destroy();
  }
  classifierInstance = new APIErrorClassifier();
  return classifierInstance;
};

/**
 * Check if error classifier is initialized
 */
export const hasAPIErrorClassifier = (): boolean => {
  return classifierInstance !== null;
};

// ============= Convenience Functions =============

/**
 * Classify an error
 */
export const classifyError = (
  error: unknown,
  context?: { url?: string; method?: string; requestId?: string; statusCode?: number }
): APIError => getAPIErrorClassifier().classify(error, context);

/**
 * Check if error is retryable
 */
export const isErrorRetryable = (error: unknown): boolean =>
  getAPIErrorClassifier().isRetryable(error);

/**
 * Get retry delay for error
 */
export const getErrorRetryDelay = (error: unknown): number =>
  getAPIErrorClassifier().getRetryDelay(error);

// ============= React Hook =============

/**
 * React hook for using the API error classifier
 */
export const useAPIErrorClassifier = () => {
  const classifier = getAPIErrorClassifier();
  
  return {
    classify: (
      error: unknown,
      context?: { url?: string; method?: string; requestId?: string; statusCode?: number }
    ) => classifier.classify(error, context),
    
    isRetryable: (error: unknown) => classifier.isRetryable(error),
    getRetryDelay: (error: unknown) => classifier.getRetryDelay(error),
    
    getStats: () => classifier.getStats(),
    getRecentErrors: (limit?: number) => classifier.getRecentErrors(limit),
    getErrorsByCategory: (category: ErrorCategory, limit?: number) =>
      classifier.getErrorsByCategory(category, limit),
    resetStats: () => classifier.resetStats(),
    
    // Error constructors
    createNetworkError: (message: string, options?: Partial<APIErrorInfo>) =>
      new NetworkError(message, options),
    createTimeoutError: (message: string, options?: Partial<APIErrorInfo>) =>
      new TimeoutError(message, options),
    createAuthError: (message: string, options?: Partial<APIErrorInfo>) =>
      new AuthError(message, options),
    createRateLimitError: (message: string, retryAfter?: number, options?: Partial<APIErrorInfo>) =>
      new RateLimitError(message, retryAfter, options),
    createValidationError: (message: string, fields?: Record<string, string[]>, options?: Partial<APIErrorInfo>) =>
      new ValidationError(message, fields, options),
    createNotFoundError: (message: string, options?: Partial<APIErrorInfo>) =>
      new NotFoundError(message, options),
    createServerError: (message: string, options?: Partial<APIErrorInfo>) =>
      new ServerError(message, options),
    createCancellationError: (message?: string, options?: Partial<APIErrorInfo>) =>
      new CancellationError(message, options),
    createConflictError: (message: string, options?: Partial<APIErrorInfo>) =>
      new ConflictError(message, options),
  };
};
