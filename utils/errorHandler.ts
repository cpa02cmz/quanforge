export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  context: ErrorContext;
  timestamp: string;
  userAgent: string;
  url: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: ErrorInfo[] = [];
  private maxErrors = 50; // Keep only last 50 errors

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
      stack: typeof error === 'string' ? undefined : error.stack,
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
  errorHandler.handleError(error, { operation, component, additionalData });
};

// Higher-order function for wrapping async functions
export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operation: string,
  component?: string
): T => {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error as Error, operation, component, { args });
      throw error; // Re-throw to maintain original behavior
    }
  }) as T;
};

// React hook for error handling
export const useErrorHandler = () => {
  const errorHandler = ErrorHandler.getInstance();

  return {
    handleError: (error: Error | string, operation: string, component?: string, additionalData?: Record<string, any>) => {
      errorHandler.handleError(error, { operation, component, additionalData });
    },
    getErrors: () => errorHandler.getErrors(),
    clearErrors: () => errorHandler.clearErrors(),
    getErrorStats: () => errorHandler.getErrorStats(),
  };
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