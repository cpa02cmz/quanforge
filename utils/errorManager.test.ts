import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorManager, ErrorCategory, ErrorSeverity, type StructuredError, handleError, handleNetworkError, handleValidationError, handleSecurityError } from './errorManager';
import type { Toast } from '../types/toast';

describe('ErrorManager', () => {
  let mockToastHandler: (toast: { message: string; type: Toast['type']; duration?: number }) => void;

  beforeEach(() => {
    mockToastHandler = vi.fn() as unknown as (toast: { message: string; type: Toast['type']; duration?: number }) => void;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ErrorManager.getInstance();
      const instance2 = ErrorManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Error Handling', () => {
    it('should handle string errors', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Test error message');
      expect(error.message).toBe('Test error message');
      expect(error.category).toBe(ErrorCategory.UNKNOWN);
      expect(error.id).toBeDefined();
      expect(error.timestamp).toBeDefined();
    });

    it('should handle Error objects', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const originalError = new Error('Test error');
      const error = errorManager.handleError(originalError);
      expect(error.message).toBe('Test error');
      expect(error.stack).toBe(originalError.stack);
    });

    it('should handle structured errors', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const structuredError: StructuredError = {
        id: 'test-id',
        message: 'Structured error',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.HIGH,
        timestamp: Date.now(),
        retryable: false,
        action: 'abort'
      };
      const error = errorManager.handleError(structuredError);
      expect(error).toBe(structuredError);
    });

    it('should assign correct category', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Test', ErrorCategory.NETWORK);
      expect(error.category).toBe(ErrorCategory.NETWORK);
    });

    it('should include context when provided', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const context = { userId: '123', action: 'save' };
      const error = errorManager.handleError('Test', ErrorCategory.DATABASE, context);
      expect(error.context).toEqual(context);
    });
  });

  describe('Severity Determination', () => {
    it('should determine HIGH severity for security errors', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Security issue', ErrorCategory.SECURITY);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should determine HIGH severity for database connection errors', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Database connection failed', ErrorCategory.DATABASE);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should determine MEDIUM severity for authentication errors', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Auth failed', ErrorCategory.AUTHENTICATION);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should determine LOW severity for validation errors', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Invalid input', ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.LOW);
    });

    it('should detect critical keywords in message', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Critical system failure', ErrorCategory.UNKNOWN);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });
  });

  describe('Retryability', () => {
    it('should mark network errors as retryable', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Network timeout', ErrorCategory.NETWORK);
      expect(error.retryable).toBe(true);
    });

    it('should mark permission errors as non-retryable', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Permission denied', ErrorCategory.SECURITY);
      expect(error.retryable).toBe(false);
    });

    it('should respect explicit retryable option', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Test', ErrorCategory.NETWORK, {}, { retryable: false });
      expect(error.retryable).toBe(false);
    });
  });

  describe('Error History', () => {
    it('should store errors in history', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      errorManager.handleError('Test error 1');
      errorManager.handleError('Test error 2');
      const history = errorManager.getErrorHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handlers', () => {
    it('should register error handlers', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const handler = vi.fn();
      errorManager.registerHandler(ErrorCategory.NETWORK, handler);
      errorManager.handleError('Network error', ErrorCategory.NETWORK);
      expect(handler).toHaveBeenCalled();
    });

    it('should remove error handlers', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const handler = vi.fn();
      errorManager.registerHandler(ErrorCategory.NETWORK, handler);
      errorManager.removeHandler(ErrorCategory.NETWORK, handler);
      errorManager.handleError('Network error', ErrorCategory.NETWORK);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should call multiple handlers for same category', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      errorManager.registerHandler(ErrorCategory.DATABASE, handler1);
      errorManager.registerHandler(ErrorCategory.DATABASE, handler2);
      errorManager.handleError('DB error', ErrorCategory.DATABASE);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Toast Notifications', () => {
    it('should show toast when showToast option is true', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      errorManager.handleError('User error', ErrorCategory.UI, {}, { 
        showToast: true, 
        userMessage: 'User-friendly message' 
      });
      expect(mockToastHandler).toHaveBeenCalledWith(expect.objectContaining({
        message: 'User-friendly message'
      }));
    });

    it('should not show toast by default', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      errorManager.handleError('Test error');
      // Only called when explicitly requested
    });
  });

  describe('User Messages', () => {
    it('should generate user-friendly messages for validation errors', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Invalid input', ErrorCategory.VALIDATION);
      expect(error.userMessage).toBeDefined();
      expect(error.userMessage?.length).toBeGreaterThan(0);
    });

    it('should generate user-friendly messages for network errors', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Network failed', ErrorCategory.NETWORK);
      expect(error.userMessage).toBeDefined();
    });

    it('should use custom user message when provided', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Technical error', ErrorCategory.UNKNOWN, {}, {
        userMessage: 'Custom user message'
      });
      expect(error.userMessage).toBe('Custom user message');
    });
  });

  describe('Error Actions', () => {
    it('should suggest retry action for network errors', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Network timeout', ErrorCategory.NETWORK);
      expect(error.action).toBe('retry');
    });

    it('should respect explicit action option', () => {
      const errorManager = ErrorManager.getInstance();
      errorManager.setToastHandler(mockToastHandler);
      const error = errorManager.handleError('Test', ErrorCategory.UNKNOWN, {}, {
        action: 'fallback'
      });
      expect(error.action).toBe('fallback');
    });
  });

  describe('Convenience Functions', () => {
    it('should handle network errors with convenience function', () => {
      const error = handleNetworkError('Connection failed', { url: '/api/test' });
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.retryable).toBe(true);
    });

    it('should handle validation errors with convenience function', () => {
      const error = handleValidationError('Invalid input', { field: 'email' });
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.LOW);
    });

    it('should handle security errors with convenience function', () => {
      const error = handleSecurityError('Unauthorized access', { userId: '123' });
      expect(error.category).toBe(ErrorCategory.SECURITY);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should handle generic errors with handleError function', () => {
      const error = handleError('Generic error', ErrorCategory.UNKNOWN);
      expect(error.message).toBe('Generic error');
    });
  });
});
