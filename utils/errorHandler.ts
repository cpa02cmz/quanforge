export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorInfo {
  message: string;
  stack: string;
  context: ErrorContext;
  timestamp: string;
  userAgent: string;
  url: string;
}

import { ERROR_CONFIG } from '../constants/config';

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: ErrorInfo[] = [];
  private maxErrors = ERROR_CONFIG.MAX_ERROR_LOG_SIZE;

  private constructor() {
    // Store errors in localStorage for debugging
    this.loadStoredErrors();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private loadStoredErrors(): void {
    try {
      const stored = localStorage.getItem('app_errors');
      if (stored) {
        this.errors = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load stored errors:', e);
    }
  }

  private storeErrors(): void {
    try {
      localStorage.setItem('app_errors', JSON.stringify(this.errors));
    } catch (e) {
      console.warn('Failed to store errors:', e);
    }
  }

  private addError(error: ErrorInfo): void {
    this.errors.push(error);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
    this.storeErrors();
  }

  public handleError(error: Error | string, context: ErrorContext): void {
    const errorInfo: ErrorInfo = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? '' : (error.stack || ''),
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.addError(errorInfo);

    // Log to console with context
    console.error(`[${context.operation}] Error:`, error, context);

    // In production, you could send errors to a monitoring service
    if (import.meta.env.PROD && this.shouldReportError(errorInfo)) {
      this.reportError(errorInfo);
    }
  }

  private shouldReportError(error: ErrorInfo): boolean {
      // Don't report certain common errors
      const ignorePatterns = [
        /NetworkError/i,
        /AbortError/i,
        /ResizeObserver loop limit exceeded/i,
        /Non-Error promise rejection captured/i,
        /Failed to fetch/i,
        /Load failed/i,
        /Loading chunk.*failed/i,  // Handle dynamic import errors
        /Script error/i,            // Ignore generic script errors
        /ChunkLoadError/i,          // Webpack chunk loading errors
        /ResizeObserver loop limit exceeded/i,  // Browser-specific error
      ];

      return !ignorePatterns.some(pattern => pattern.test(error.message));
    }

  private async reportError(error: ErrorInfo): Promise<void> {
    try {
      // Only report to external service in production
      if (import.meta.env.PROD) {
        // In a real implementation, you would send to an error reporting service
        // For now, we'll log to console with additional context
        console.error('Reporting error to external service:', {
          message: error.message,
          operation: error.context.operation,
          component: error.context.component,
          timestamp: error.timestamp,
          userAgent: error.userAgent,
          url: error.url,
          stack: error.stack,
        });
        
        // Example of how to send to external service:
        // await fetch('/api/errors', { 
        //   method: 'POST', 
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(error) 
        // });
      }
    } catch (e) {
      console.warn('Failed to report error:', e);
    }
  }

  public getErrors(): ErrorInfo[] {
    return [...this.errors];
  }

  public clearErrors(): void {
    this.errors = [];
    this.storeErrors();
  }

  public getErrorStats(): { total: number; byOperation: Record<string, number> } {
    const stats = { total: this.errors.length, byOperation: {} as Record<string, number> };
    
    this.errors.forEach(error => {
      stats.byOperation[error.context.operation] = 
        (stats.byOperation[error.context.operation] || 0) + 1;
    });

    return stats;
  }
}

// Convenience function for global error handling
export const handleError = (error: Error | string, operation: string, component?: string, additionalData?: Record<string, any>) => {
  const errorHandler = ErrorHandler.getInstance();
  errorHandler.handleError(error, { 
    operation, 
    component: component || 'unknown', 
    ...(additionalData && { additionalData })
  });
};

// Higher-order function for wrapping async functions with retry logic
export const withErrorHandling = <T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  operation: string,
  component?: string,
  options: {
    retries?: number;
    fallback?: () => Promise<ReturnType<T>> | ReturnType<T>;
    backoff?: 'linear' | 'exponential';
    backoffBase?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): T => {
  const { 
    retries = 0, 
    fallback, 
    backoff = 'exponential', 
    backoffBase = ERROR_CONFIG.ERROR_RETRY_DELAY_BASE,
    shouldRetry = () => true
  } = options;
  
  return (async (...args: Parameters<T>) => {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          // Apply backoff delay
          const delay = backoff === 'exponential' 
            ? backoffBase * Math.pow(2, attempt - 1)
            : backoffBase * attempt;
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        return await fn(...args);
      } catch (error: unknown) {
        const typedError = error instanceof Error ? error : new Error(String(error));
        lastError = typedError;
        
        // Log error on each attempt
        handleError(typedError, `${operation} (attempt ${attempt + 1}/${retries + 1})`, component || 'unknown', { 
          args, 
          attempt: attempt + 1,
          error: typedError.message
        });
        
        // Check if we should retry this error
        if (!shouldRetry(typedError) || attempt === retries) {
          break;
        }
      }
    }
    
    // If fallback is provided, try that instead of re-throwing
    if (fallback) {
      try {
        console.warn(`Using fallback for ${operation} after ${retries + 1} attempts`);
        return await fallback();
      } catch (fallbackError) {
        console.error(`Fallback failed for ${operation}:`, fallbackError);
      }
    }
    
    throw lastError; // Re-throw the original error if no fallback worked
  }) as T;
};

// React hook for error handling
export const useErrorHandler = () => {
  const errorHandler = ErrorHandler.getInstance();

  return {
    handleError: (error: Error | string, operation: string, component?: string, additionalData?: Record<string, any>) => {
      errorHandler.handleError(error, { operation, component: component || 'unknown', ...(additionalData && { additionalData }) });
    },
    getErrors: () => errorHandler.getErrors(),
    clearErrors: () => errorHandler.clearErrors(),
    getErrorStats: () => errorHandler.getErrorStats(),
  };
};

// Error classification utilities
export const errorClassifier = {
  isNetworkError: (error: Error): boolean => {
    return error.name === 'NetworkError' || 
           error.message.includes('Network') ||
           error.message.includes('fetch') ||
           error.message.includes('Failed to fetch') ||
           error.message.includes('Load failed');
  },
  
  isTimeoutError: (error: Error): boolean => {
    return error.name === 'TimeoutError' || 
           error.message.includes('timeout') ||
           error.name === 'AbortError';
  },
  
  isValidationError: (error: Error): boolean => {
    return error.name === 'ValidationError' || 
           error.message.includes('validation');
  },
  
  isAuthError: (error: Error): boolean => {
    return error.message.toLowerCase().includes('unauthorized') ||
           error.message.toLowerCase().includes('forbidden') ||
           error.message.includes('401') ||
           error.message.includes('403');
  },
  
  isRateLimitError: (error: Error): boolean => {
    return error.message.toLowerCase().includes('rate limit') ||
           error.message.includes('429');
  },
  
  isServerError: (error: Error): boolean => {
    return error.message.includes('500') ||
           error.message.includes('502') ||
           error.message.includes('503') ||
           error.message.includes('504') ||
           error.message.toLowerCase().includes('server error');
  },
  
  isClientError: (error: Error): boolean => {
    return error.message.includes('400') ||
           error.message.includes('404') ||
           error.message.includes('409') ||
           error.message.toLowerCase().includes('client error');
  }
};

// Error recovery utilities
export const errorRecovery = {
  async retryWithBackoff<T>(
    operation: () => Promise<T>, 
    maxRetries: number = ERROR_CONFIG.MAX_ERROR_RETRY_ATTEMPTS,
    baseDelay: number = ERROR_CONFIG.ERROR_RETRY_DELAY_BASE,
    shouldRetry?: (error: Error) => boolean
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await operation();
      } catch (error: unknown) {
        const typedError = error instanceof Error ? error : new Error(String(error));
        lastError = typedError;
        
        if (i === maxRetries) {
          throw typedError;
        }

        // Check if this error should be retried
        if (shouldRetry && !shouldRetry(typedError)) {
          throw typedError;
        }

        // Don't retry on validation or auth errors
        if (errorClassifier.isValidationError(typedError) || errorClassifier.isAuthError(typedError)) {
          throw typedError;
        }
        
        const delay = baseDelay * Math.pow(2, i); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  },
  
  async fallbackToCache<T>(
    operation: () => Promise<T>,
    cacheKey: string,
    cacheGetter: (key: string) => T | null,
    cacheSetter: (key: string, value: T) => void
  ): Promise<T> {
    try {
      const result = await operation();
      cacheSetter(cacheKey, result);
      return result;
    } catch (error: unknown) {
      // Try to get from cache
      const cached = cacheGetter(cacheKey);
      if (cached !== null) {
        console.warn(`Operation failed, using cached data for ${cacheKey}`);
        return cached;
      }
      throw error;
    }
  },
  
  // Circuit breaker pattern implementation
  createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
    operation: T,
    options: {
      failureThreshold?: number;
      timeout?: number;
      resetTimeout?: number;
    } = {}
  ): T {
    const {
      failureThreshold = ERROR_CONFIG.CIRCUIT_BREAKER_THRESHOLD,
      timeout = ERROR_CONFIG.CIRCUIT_BREAKER_TIMEOUT,
      resetTimeout = ERROR_CONFIG.CIRCUIT_BREAKER_TIMEOUT
    } = options;
    
    let failureCount = 0;
    let lastFailureTime: number | null = null;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const now = Date.now();
      
      // If OPEN and reset timeout has passed, move to HALF_OPEN
      if (state === 'OPEN' && lastFailureTime && now - lastFailureTime > resetTimeout) {
        state = 'HALF_OPEN';
      }
      
      // If OPEN, fail fast
      if (state === 'OPEN') {
        throw new Error('Circuit breaker is OPEN');
      }
      
      let timeoutId: ReturnType<typeof setTimeout>;
      
      try {
        const result = await Promise.race([
          operation(...args).then((value: any) => {
            clearTimeout(timeoutId);
            return value;
          }),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Circuit breaker timeout')), timeout);
          })
        ]);
        
        // Success - reset failure count and close circuit
        failureCount = 0;
        state = 'CLOSED';
        return result;
      } catch (error: unknown) {
        failureCount++;
        lastFailureTime = now;
        
        // If failure threshold exceeded, open circuit
        if (failureCount >= failureThreshold) {
          state = 'OPEN';
        } else {
          // Move back to CLOSED if we were in HALF_OPEN and succeeded
          state = 'HALF_OPEN'; // We actually remain half-open until success
        }
        
        throw error;
      }
    }) as T;
  }
};

// Edge-specific error handling
export const edgeErrorHandler = {
  isEdgeError: (error: Error): boolean => {
    return error.message.includes('EDGE') ||
           error.message.includes('timeout') ||
           error.message.includes('memory limit') ||
           error.message.includes('EDGE_FUNCTION_TIMEOUT') ||
           error.message.includes('EDGE_MEMORY_LIMIT') ||
           error.message.includes('EDGE_RATE_LIMIT');
  },
  
  handleEdgeError: (error: Error, context: ErrorContext): void => {
    if (edgeErrorHandler.isEdgeError(error)) {
      // Fallback to client-side processing
      console.warn('Edge error, falling back to client:', error);
      // Implement fallback logic
      handleError(error, `${context.operation} (edge fallback)`, context.component || 'unknown', {
        ...context.additionalData,
        edgeError: true,
        fallbackTriggered: true
      });
    } else {
      handleError(error, context.operation, context.component || 'unknown', context.additionalData);
    }
  }
};

// Global error handlers for unhandled errors and promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    handleError(event.error || event.message, 'Global JavaScript Error', 'Window', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason, 'Unhandled Promise Rejection', 'Window', {
      promise: event.promise,
    });
  });
}

/**
 * Type-safe error handling utilities for catch blocks
 * Replaces 'catch (e: any)' with 'catch (e: unknown)' pattern
 */

/**
 * Get error message from unknown error type safely
 * @param error - The error caught in a catch block (typed as unknown)
 * @returns The error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}

/**
 * Check if unknown value is an Error instance
 * @param error - The error caught in a catch block
 * @returns Type predicate indicating if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Get error code from unknown error type safely
 * @param error - The error caught in a catch block
 * @returns The error code string or undefined
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    if ('code' in error) {
      return String((error as { code: unknown }).code);
    }
    if ('name' in error) {
      return String((error as { name: unknown }).name);
    }
  }
  return undefined;
}

/**
 * Get error status from unknown error type safely
 * @param error - The error caught in a catch block
 * @returns The error status code number or undefined
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') {
      return status;
    }
    if (typeof status === 'string') {
      const parsed = parseInt(status, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

/**
 * Convert unknown error to Error instance
 * @param error - The error caught in a catch block
 * @returns An Error instance
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error(String(error));
}

/**
 * Type-safe error handler for service operations
 * Provides consistent error handling with proper type guards
 * @param error - The unknown error from catch block
 * @param context - Additional context about where the error occurred
 * @returns Standardized error object
 */
export function handleUnknownError(
  error: unknown,
  context?: { operation?: string; component?: string }
): { message: string; code?: string; status?: number; original: unknown } {
  const result = {
    message: getErrorMessage(error),
    code: getErrorCode(error),
    status: getErrorStatus(error),
    original: error,
  };

  if (context) {
    handleError(result.message, context.operation || 'Unknown Operation', context.component || 'Unknown', {
      code: result.code,
      status: result.status,
    });
  }

  return result;
}