import type { Toast } from '../types/toast';
import { ERROR_DISPLAY } from '../constants/timing';
import { TIME_CONSTANTS } from '../constants/config';
import { ERROR_MANAGEMENT_CONFIG } from '../services/monitoringConfig';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  DATABASE = 'database',
  SECURITY = 'security',
  UI = 'ui',
  UNKNOWN = 'unknown'
}

export interface StructuredError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: number;
  context?: Record<string, any>;
  stack?: string;
  userId?: string;
  retryable: boolean;
  action?: 'retry' | 'fallback' | 'skip' | 'abort';
  userMessage?: string;
  technicalMessage?: string;
}

export type ErrorHandler = (error: StructuredError) => void;

export class ErrorManager {
  private static instance: ErrorManager;
  private errorHandlers: Map<ErrorCategory, ErrorHandler[]> = new Map();
  private errorHistory: StructuredError[] = [];
  private maxHistorySize = ERROR_MANAGEMENT_CONFIG.MAX_HISTORY_SIZE;
  private toastNotification?: (toast: { message: string; type: Toast['type']; duration?: number }) => void;

  private constructor() {
    // Initialize default handlers for each category
    this.initializeDefaultHandlers();
    
    // Set up global error listeners
    if (typeof window !== 'undefined') {
      this.setupGlobalErrorHandlers();
    }
  }

  static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }

  // Set toast notification handler
  setToastHandler(handler: (toast: { message: string; type: Toast['type']; duration?: number }) => void): void {
    this.toastNotification = handler;
  }

  // Register error handler for specific category
  registerHandler(category: ErrorCategory, handler: ErrorHandler): void {
    const handlers = this.errorHandlers.get(category) || [];
    handlers.push(handler);
    this.errorHandlers.set(category, handlers);
  }

  // Remove error handler
  removeHandler(category: ErrorCategory, handler: ErrorHandler): void {
    const handlers = this.errorHandlers.get(category) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.errorHandlers.set(category, handlers);
    }
  }

  // Main error handling method
  handleError(
    error: Error | string | StructuredError,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    context?: Record<string, any>,
    options?: {
      severity?: ErrorSeverity;
      retryable?: boolean;
      action?: StructuredError['action'];
      userMessage?: string;
      showToast?: boolean;
    }
  ): StructuredError {
    const structuredError = this.createStructuredError(error, category, context, options);
    
    // Store in history
    this.storeError(structuredError);
    
    // Log to console (only in development or for high severity)
    this.logError(structuredError);
    
    // Show toast notification if requested
    if (options?.showToast && structuredError.userMessage) {
      this.showToast(structuredError);
    }
    
    // Execute registered handlers
    this.executeHandlers(structuredError);
    
    return structuredError;
  }

  // Create structured error from various input types
  private createStructuredError(
    error: Error | string | StructuredError,
    category: ErrorCategory,
    context?: Record<string, any>,
    options?: {
      severity?: ErrorSeverity;
      retryable?: boolean;
      action?: StructuredError['action'];
      userMessage?: string;
    }
  ): StructuredError {
    if (this.isStructuredError(error)) {
      return error;
    }

    const errorMessage = typeof error === 'string' ? error : error.message;
    const stack = error instanceof Error ? error.stack : undefined;
    
    const errorId = this.generateErrorId();
    const severity = options?.severity || this.determineSeverity(category, errorMessage);
    
    return {
      id: errorId,
      message: errorMessage,
      category,
      severity,
      timestamp: Date.now(),
      context,
      stack,
      retryable: options?.retryable ?? this.isRetryable(category, errorMessage),
      action: options?.action || this.getDefaultAction(category, severity),
      userMessage: options?.userMessage || this.generateUserMessage(category, severity),
      technicalMessage: errorMessage
    };
  }

  // Generate unique error ID
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Determine error severity based on category and message
  private determineSeverity(category: ErrorCategory, message: string): ErrorSeverity {
    // High severity indicators
    if (message.includes('Critical') || message.includes('fatal') || 
        message.includes('Permission denied') || message.includes('Access denied')) {
      return ErrorSeverity.HIGH;
    }
    
    // Category-based defaults
    switch (category) {
      case ErrorCategory.SECURITY:
        return ErrorSeverity.HIGH;
      case ErrorCategory.AUTHENTICATION:
        return ErrorSeverity.MEDIUM;
      case ErrorCategory.DATABASE:
        return message.includes('connection') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      case ErrorCategory.NETWORK:
        return message.includes('timeout') ? ErrorSeverity.LOW : ErrorSeverity.MEDIUM;
      case ErrorCategory.VALIDATION:
        return ErrorSeverity.LOW;
      case ErrorCategory.UI:
        return ErrorSeverity.LOW;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  // Determine if error is retryable
  private isRetryable(category: ErrorCategory, message: string): boolean {
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /temporary/i,
      /rate.?limit/i
    ];
    
    const nonRetryablePatterns = [
      /permission/i,
      /unauthorized/i,
      /forbidden/i,
      /not found/i,
      /validation/i
    ];
    
    // Check for explicit retryable patterns
    if (retryablePatterns.some(pattern => pattern.test(message))) {
      return true;
    }
    
    // Check for non-retryable patterns
    if (nonRetryablePatterns.some(pattern => pattern.test(message))) {
      return false;
    }
    
    // Category-based defaults
    switch (category) {
      case ErrorCategory.NETWORK:
        return true;
      case ErrorCategory.DATABASE:
        return !message.includes('constraint') && !message.includes('duplicate');
      case ErrorCategory.VALIDATION:
        return false;
      case ErrorCategory.AUTHENTICATION:
        return false;
      default:
        return false;
    }
  }

  // Get default action based on category and severity
  private getDefaultAction(category: ErrorCategory, severity: ErrorSeverity): StructuredError['action'] {
    if (severity === ErrorSeverity.CRITICAL) {
      return 'abort';
    }
    
    switch (category) {
      case ErrorCategory.NETWORK:
        return 'retry';
      case ErrorCategory.VALIDATION:
        return 'skip';
      case ErrorCategory.UI:
        return 'fallback';
      default:
        return 'retry';
    }
  }

  // Generate user-friendly message
  private generateUserMessage(category: ErrorCategory, severity: ErrorSeverity): string {
    switch (category) {
      case ErrorCategory.NETWORK:
        return severity === ErrorSeverity.HIGH 
          ? 'Network connection failed. Please check your internet connection.'
          : 'Temporary network issue. Retrying...';
      case ErrorCategory.DATABASE:
        return severity === ErrorSeverity.HIGH
          ? 'Database error occurred. Please try again later.'
          : 'Data save issue. Your data is safe.';
      case ErrorCategory.AUTHENTICATION:
        return 'Authentication required. Please sign in again.';
      case ErrorCategory.VALIDATION:
        return 'Please check your input and try again.';
      case ErrorCategory.SECURITY:
        return 'Security check failed. Please contact support.';
      case ErrorCategory.UI:
        return 'Display issue occurred. Refreshing may help.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  // Store error in history
  private storeError(error: StructuredError): void {
    this.errorHistory.push(error);
    
    // Maintain max history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.splice(0, this.errorHistory.length - this.maxHistorySize);
    }
    
    // Also store in localStorage for persistence
    try {
      const persistent = JSON.parse(localStorage.getItem('error_history') || '[]');
      persistent.push(error);
      
      // Keep last 100 in localStorage
      if (persistent.length > 100) {
        persistent.splice(0, persistent.length - 100);
      }
      
      localStorage.setItem('error_history', JSON.stringify(persistent));
    } catch (_e) {
      // Silent fail for error storage
    }
  }

  // Log error to console with appropriate level
  private logError(error: StructuredError): void {
    const logData = {
      id: error.id,
      message: error.technicalMessage || error.message,
      category: error.category,
      severity: error.severity,
      context: error.context
    };
    
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🔴 CRITICAL ERROR:', logData, error.stack);
        break;
      case ErrorSeverity.HIGH:
        console.error('🟠 HIGH ERROR:', logData, error.stack);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('🟡 WARNING:', logData);
        break;
      case ErrorSeverity.LOW:
      default:
        console.info('🔵 INFO:', logData);
        break;
    }
  }

  // Show toast notification
  private showToast(error: StructuredError): void {
    if (!this.toastNotification || !error.userMessage) {
      return;
    }
    
    const toastType = this.getToastType(error.severity);
    const duration = this.getToastDuration(error.severity);
    
    // Use enhanced toast interface with duration support
    this.toastNotification({
      message: error.userMessage,
      type: toastType,
      duration
    });
  }

  // Get toast duration based on severity
  private getToastDuration(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return ERROR_DISPLAY.DURATION_LONG;
      case ErrorSeverity.MEDIUM:
        return ERROR_DISPLAY.DURATION_MEDIUM;
      default:
        return ERROR_DISPLAY.DURATION_SHORT;
    }
  }

  // Map severity to toast type
  private getToastType(severity: ErrorSeverity): Toast['type'] {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'error'; // Use error instead of warning since warning type doesn't exist
      default:
        return 'info';
    }
  }

  // Execute registered handlers
  private executeHandlers(error: StructuredError): void {
    const handlers = this.errorHandlers.get(error.category) || [];
    handlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }

  // Initialize default handlers
  private initializeDefaultHandlers(): void {
    // Default handler for each category
    Object.values(ErrorCategory).forEach(category => {
      this.registerHandler(category, (error: StructuredError) => {
        // Default: log to monitoring service in production
        if (typeof process !== 'undefined' && process.env?.['NODE_ENV'] === 'production') {
          // Would integrate with external monitoring
          this.sendToMonitoring(error);
        }
      });
    });
  }

  // Setup global error listeners
  private setupGlobalErrorHandlers(): void {
    // Global JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(
        event.message || String(event.error),
        ErrorCategory.UI,
        { 
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error?.stack
        }
      );
    });

    // Unhandled promise rejections  
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason?.message || String(event.reason),
        ErrorCategory.UNKNOWN,
        { stack: event.reason?.stack }
      );
    });
  }

  // Send to monitoring service
  private sendToMonitoring(_error: StructuredError): void {
    // Placeholder for monitoring service integration
    // In production, would send to services like Sentry, DataDog, etc.
    // Error sent to monitoring service
  }

  // Helper methods
  private isStructuredError(error: unknown): error is StructuredError {
    return error !== null && typeof error === 'object' && 'id' in error && 'category' in error;
  }

  // Public API for accessing error history
  getErrorHistory(filter?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    timeRange?: { start: number; end: number };
  }): StructuredError[] {
    let history = [...this.errorHistory];
    
    if (filter?.category) {
      history = history.filter(error => error.category === filter.category);
    }
    
    if (filter?.severity) {
      history = history.filter(error => error.severity === filter.severity);
    }
    
    if (filter?.timeRange) {
      history = history.filter(error => 
        error.timestamp >= filter.timeRange!.start && 
        error.timestamp <= filter.timeRange!.end
      );
    }
    
    return history;
  }

  // Get error statistics
  getErrorStats(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recent: StructuredError[];
    critical: StructuredError[];
  } {
    const byCategory = {} as Record<ErrorCategory, number>;
    const bySeverity = {} as Record<ErrorSeverity, number>;
    
    this.errorHistory.forEach(error => {
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    });
    
    const oneHourAgo = Date.now() - TIME_CONSTANTS.HOUR;
    const recent = this.errorHistory.filter(error => error.timestamp > oneHourAgo);
    const critical = this.errorHistory.filter(error => error.severity === ErrorSeverity.CRITICAL);
    
    return {
      total: this.errorHistory.length,
      byCategory,
      bySeverity,
      recent: recent.slice(-10),
      critical: critical.slice(-5)
    };
  }

  // Clear error history
  clearHistory(): void {
    this.errorHistory = [];
    try {
      localStorage.removeItem('error_history');
    } catch (_e) {
      // Silent fail
    }
  }

  // Test error handling (for development)
  testErrorHandling(): void {
    this.handleError(
      'This is a test error',
      ErrorCategory.UI,
      { test: true },
      { 
        severity: ErrorSeverity.LOW,
        showToast: true 
      }
    );
  }
}

// Convenience functions for common error handling patterns
export const handleError = (
  error: Error | string,
  category?: ErrorCategory,
  context?: Record<string, any>
): StructuredError => {
  return ErrorManager.getInstance().handleError(error, category, context);
};

export const handleNetworkError = (error: Error | string, context?: Record<string, any>): StructuredError => {
  return ErrorManager.getInstance().handleError(error, ErrorCategory.NETWORK, context, { 
    severity: ErrorSeverity.MEDIUM,
    retryable: true,
    action: 'retry',
    showToast: true 
  });
};

export const handleValidationError = (error: Error | string, context?: Record<string, any>): StructuredError => {
  return ErrorManager.getInstance().handleError(error, ErrorCategory.VALIDATION, context, {
    severity: ErrorSeverity.LOW,
    retryable: false,
    action: 'skip',
    showToast: true
  });
};

export const handleSecurityError = (error: Error | string, context?: Record<string, any>): StructuredError => {
  return ErrorManager.getInstance().handleError(error, ErrorCategory.SECURITY, context, {
    severity: ErrorSeverity.HIGH,
    retryable: false,
    action: 'abort',
    showToast: true
  });
};

// Legacy compatibility function
export const handleErrorCompat = (
  error: Error | string,
  operation: string,
  component?: string,
  additionalData?: Record<string, any>
): StructuredError => {
  return ErrorManager.getInstance().handleError(error, ErrorCategory.UNKNOWN, {
    operation,
    component,
    ...additionalData
  }, { showToast: true });
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
    backoffBase = TIME_CONSTANTS.SECOND,
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
        handleErrorCompat(typedError, `${operation} (attempt ${attempt + 1}/${retries + 1})`, component || 'unknown', { 
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

// React hook for error handling (legacy compatibility)
export const useErrorHandler = () => {
  const errorManager = ErrorManager.getInstance();

  return {
    handleError: (error: Error | string, operation: string, component?: string, additionalData?: Record<string, any>) => {
      handleErrorCompat(error, operation, component, additionalData);
    },
    getErrors: () => errorManager.getErrorHistory(),
    clearErrors: () => errorManager.clearHistory(),
    getErrorStats: () => errorManager.getErrorStats(),
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
           error.message.includes('timed out');
  },
  
  isAuthError: (error: Error): boolean => {
    return error.message.includes('Unauthorized') ||
           error.message.includes('Authentication') ||
           error.message.includes('401') ||
           error.message.includes('403');
  },
  
  isValidationError: (error: Error): boolean => {
    return error.message.includes('Validation') ||
           error.message.includes('Invalid') ||
           error.message.includes('400') ||
           error.message.includes('Required');
  },
  
  isDatabaseError: (error: Error): boolean => {
    return error.message.includes('Database') ||
           error.message.includes('Connection') ||
           error.message.includes('Query') ||
           error.message.includes('500');
  }
};

// Circuit breaker pattern for resilience
export class CircuitBreaker {
  private failureThreshold = 5;
  private recoveryTimeout = TIME_CONSTANTS.MINUTE; // 1 minute
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(options?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
  }) {
    if (options?.failureThreshold) this.failureThreshold = options.failureThreshold;
    if (options?.recoveryTimeout) this.recoveryTimeout = options.recoveryTimeout;
  }

  async execute<T>(fn: () => Promise<T>, context?: { operation: string; component?: string }): Promise<T> {
    const now = Date.now();
    
    // Check if we should attempt to reset the circuit
    if (this.state === 'OPEN' && now - this.lastFailureTime > this.recoveryTimeout) {
      this.state = 'HALF_OPEN';
    }
    
    // Reject immediately if circuit is open
    if (this.state === 'OPEN') {
      const error = new Error('Circuit breaker is OPEN');
      handleErrorCompat(error, context?.operation || 'Circuit breaker blocked', context?.component, {
        state: this.state,
        failures: this.failures
      });
      throw error;
    }
    
    try {
      const result = await fn();
      
      // Success: reset failures if we were half-open
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
      
      return result;
    } catch (error: unknown) {
      this.failures++;
      this.lastFailureTime = now;
      
      handleErrorCompat(error as Error, context?.operation || 'Circuit breaker failure', context?.component, {
        state: this.state,
        failures: this.failures
      });
      
      // Open circuit if threshold reached
      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
      } else if (this.state === 'HALF_OPEN') {
        // We actually remain half-open until success
        this.state = 'OPEN';
      }
      
      throw error;
    }
  }
}

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
  
  handleEdgeError: (error: Error, context: { operation: string; component?: string; additionalData?: Record<string, any> }): void => {
    if (edgeErrorHandler.isEdgeError(error)) {
      // Fallback to client-side processing
      console.warn('Edge error, falling back to client:', error);
      // Implement fallback logic
      handleErrorCompat(error, `${context.operation} (edge fallback)`, context.component || 'unknown', {
        ...context.additionalData,
        edgeError: true,
        fallbackTriggered: true
      });
    } else {
      handleErrorCompat(error, context.operation, context.component || 'unknown', context.additionalData);
    }
  }
};

export const errorManager = ErrorManager.getInstance();
export default errorManager;