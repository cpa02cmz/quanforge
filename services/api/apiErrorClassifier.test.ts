/**
 * API Error Classifier Tests
 * 
 * @module services/api/apiErrorClassifier.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  APIErrorClassifier,
  getAPIErrorClassifier,
  initializeAPIErrorClassifier,
  hasAPIErrorClassifier,
  classifyError,
  isErrorRetryable,
  getErrorRetryDelay,
  useAPIErrorClassifier,
  APIError,
  NetworkError,
  TimeoutError,
  AuthError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  ServerError,
  CancellationError,
  ConflictError,
  type ErrorCategory,
} from './apiErrorClassifier';

describe('APIErrorClassifier', () => {
  let classifier: APIErrorClassifier;

  beforeEach(() => {
    classifier = new APIErrorClassifier();
  });

  afterEach(() => {
    classifier.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const stats = classifier.getStats();
      expect(stats.totalErrors).toBe(0);
      expect(stats.errorsByCategory).toBeDefined();
      expect(stats.topErrors).toEqual([]);
    });

    it('should initialize all error categories with zero count', () => {
      const stats = classifier.getStats();
      const categories: ErrorCategory[] = [
        'network', 'timeout', 'server', 'client', 'auth',
        'validation', 'rate_limit', 'not_found', 'conflict',
        'cancellation', 'unknown',
      ];
      
      for (const category of categories) {
        expect(stats.errorsByCategory[category]).toBe(0);
      }
    });
  });

  describe('classify', () => {
    it('should classify native Error objects', () => {
      const error = new Error('Test error');
      const apiError = classifier.classify(error);
      
      expect(apiError).toBeInstanceOf(APIError);
      expect(apiError.message).toBe('Test error');
    });

    it('should preserve existing APIError instances', () => {
      const originalError = new NetworkError('Network failed');
      const classified = classifier.classify(originalError);
      
      expect(classified).toBe(originalError);
      expect(classified.category).toBe('network');
    });

    it('should classify string errors', () => {
      const apiError = classifier.classify('Something went wrong');
      
      expect(apiError.message).toBe('Something went wrong');
      expect(apiError.category).toBe('unknown');
    });

    it('should classify unknown error types', () => {
      const apiError = classifier.classify({ foo: 'bar' });
      
      expect(apiError.message).toBe('An unknown error occurred');
      expect(apiError.category).toBe('unknown');
    });

    it('should include context in classified error', () => {
      const error = new Error('Test');
      const apiError = classifier.classify(error, {
        url: 'https://api.example.com/test',
        method: 'GET',
        requestId: 'req-123',
        statusCode: 500,
      });
      
      expect(apiError.url).toBe('https://api.example.com/test');
      expect(apiError.method).toBe('GET');
      expect(apiError.requestId).toBe('req-123');
      expect(apiError.statusCode).toBe(500);
    });

    it('should track classified errors in statistics', () => {
      classifier.classify(new Error('Error 1'));
      classifier.classify(new Error('Error 2'));
      classifier.classify(new Error('Error 3'));
      
      const stats = classifier.getStats();
      expect(stats.totalErrors).toBe(3);
    });
  });

  describe('error classification by type', () => {
    it('should classify AbortError as CancellationError', () => {
      const error = new Error('Request aborted');
      error.name = 'AbortError';
      
      const apiError = classifier.classify(error);
      
      expect(apiError).toBeInstanceOf(CancellationError);
      expect(apiError.category).toBe('cancellation');
      expect(apiError.isRetryable()).toBe(true);
    });

    it('should classify TimeoutError correctly', () => {
      const error = new Error('Request timeout');
      error.name = 'TimeoutError';
      
      const apiError = classifier.classify(error);
      
      expect(apiError).toBeInstanceOf(TimeoutError);
      expect(apiError.category).toBe('timeout');
    });

    it('should classify NetworkError correctly', () => {
      const error = new Error('Network failure');
      error.name = 'NetworkError';
      
      const apiError = classifier.classify(error);
      
      expect(apiError).toBeInstanceOf(NetworkError);
      expect(apiError.category).toBe('network');
    });

    it('should classify fetch errors as NetworkError', () => {
      const error = new Error('Failed to fetch');
      
      const apiError = classifier.classify(error);
      
      expect(apiError).toBeInstanceOf(NetworkError);
    });
  });

  describe('error classification by status code', () => {
    it('should classify 401 as AuthError', () => {
      const error = new Error('Unauthorized');
      const apiError = classifier.classify(error, { statusCode: 401 });
      
      expect(apiError).toBeInstanceOf(AuthError);
      expect(apiError.category).toBe('auth');
    });

    it('should classify 403 as AuthError', () => {
      const error = new Error('Forbidden');
      const apiError = classifier.classify(error, { statusCode: 403 });
      
      expect(apiError).toBeInstanceOf(AuthError);
      expect(apiError.category).toBe('auth');
    });

    it('should classify 404 as NotFoundError', () => {
      const error = new Error('Not found');
      const apiError = classifier.classify(error, { statusCode: 404 });
      
      expect(apiError).toBeInstanceOf(NotFoundError);
      expect(apiError.category).toBe('not_found');
    });

    it('should classify 429 as RateLimitError', () => {
      const error = new Error('Too many requests');
      const apiError = classifier.classify(error, { statusCode: 429 });
      
      expect(apiError).toBeInstanceOf(RateLimitError);
      expect(apiError.category).toBe('rate_limit');
    });

    it('should classify 400 as ValidationError', () => {
      const error = new Error('Bad request');
      const apiError = classifier.classify(error, { statusCode: 400 });
      
      expect(apiError).toBeInstanceOf(ValidationError);
      expect(apiError.category).toBe('validation');
    });

    it('should classify 409 as ConflictError', () => {
      const error = new Error('Conflict');
      const apiError = classifier.classify(error, { statusCode: 409 });
      
      expect(apiError).toBeInstanceOf(ConflictError);
      expect(apiError.category).toBe('conflict');
    });

    it('should classify 500 as ServerError', () => {
      const error = new Error('Internal server error');
      const apiError = classifier.classify(error, { statusCode: 500 });
      
      expect(apiError).toBeInstanceOf(ServerError);
      expect(apiError.category).toBe('server');
    });

    it('should classify 502 as ServerError', () => {
      const error = new Error('Bad gateway');
      const apiError = classifier.classify(error, { statusCode: 502 });
      
      expect(apiError).toBeInstanceOf(ServerError);
    });

    it('should classify 503 as ServerError', () => {
      const error = new Error('Service unavailable');
      const apiError = classifier.classify(error, { statusCode: 503 });
      
      expect(apiError).toBeInstanceOf(ServerError);
    });
  });
});

describe('Error Classes', () => {
  describe('APIError', () => {
    it('should create APIError with all properties', () => {
      const error = new APIError({
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
        category: 'client',
        severity: 'medium',
        statusCode: 400,
        url: 'https://api.example.com/test',
        method: 'POST',
        timestamp: Date.now(),
        requestId: 'req-123',
        context: { key: 'value' },
        recovery: {
          action: 'Try again',
          retryable: true,
          requiresUserAction: false,
        },
      });
      
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.message).toBe('Custom error message');
      expect(error.category).toBe('client');
      expect(error.severity).toBe('medium');
      expect(error.statusCode).toBe(400);
      expect(error.url).toBe('https://api.example.com/test');
      expect(error.method).toBe('POST');
      expect(error.requestId).toBe('req-123');
      expect(error.context).toEqual({ key: 'value' });
      expect(error.recovery?.action).toBe('Try again');
    });

    it('should return correct retryable status', () => {
      const retryableError = new APIError({
        code: 'RETRYABLE',
        message: 'Retry me',
        category: 'network',
        severity: 'high',
        timestamp: Date.now(),
        recovery: { action: 'Retry', retryable: true, requiresUserAction: false },
      });
      
      const nonRetryableError = new APIError({
        code: 'NOT_RETRYABLE',
        message: 'Do not retry',
        category: 'auth',
        severity: 'high',
        timestamp: Date.now(),
        recovery: { action: 'Login', retryable: false, requiresUserAction: true },
      });
      
      expect(retryableError.isRetryable()).toBe(true);
      expect(nonRetryableError.isRetryable()).toBe(false);
    });

    it('should return retry delay', () => {
      const error = new APIError({
        code: 'DELAY_ERROR',
        message: 'Wait and retry',
        category: 'rate_limit',
        severity: 'medium',
        timestamp: Date.now(),
        recovery: { action: 'Wait', retryable: true, retryDelay: 5000, requiresUserAction: false },
      });
      
      expect(error.getRetryDelay()).toBe(5000);
    });

    it('should convert to JSON', () => {
      const error = new APIError({
        code: 'JSON_ERROR',
        message: 'JSON test',
        category: 'server',
        severity: 'high',
        timestamp: 1234567890,
      });
      
      const json = error.toJSON();
      
      expect(json.code).toBe('JSON_ERROR');
      expect(json.message).toBe('JSON test');
      expect(json.category).toBe('server');
      expect(json.severity).toBe('high');
      expect(json.timestamp).toBe(1234567890);
    });
  });

  describe('NetworkError', () => {
    it('should create NetworkError with correct properties', () => {
      const error = new NetworkError('Connection refused');
      
      expect(error).toBeInstanceOf(APIError);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.category).toBe('network');
      expect(error.severity).toBe('high');
      expect(error.isRetryable()).toBe(true);
    });
  });

  describe('TimeoutError', () => {
    it('should create TimeoutError with correct properties', () => {
      const error = new TimeoutError('Request timed out');
      
      expect(error).toBeInstanceOf(APIError);
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.category).toBe('timeout');
      expect(error.severity).toBe('medium');
      expect(error.isRetryable()).toBe(true);
    });
  });

  describe('AuthError', () => {
    it('should create AuthError with correct properties', () => {
      const error = new AuthError('Invalid credentials');
      
      expect(error).toBeInstanceOf(APIError);
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.category).toBe('auth');
      expect(error.severity).toBe('high');
      expect(error.isRetryable()).toBe(false);
      expect(error.recovery?.requiresUserAction).toBe(true);
    });
  });

  describe('RateLimitError', () => {
    it('should create RateLimitError with retryAfter', () => {
      const error = new RateLimitError('Too many requests', 60);
      
      expect(error).toBeInstanceOf(APIError);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.category).toBe('rate_limit');
      expect(error.severity).toBe('medium');
      expect(error.retryAfter).toBe(60);
      expect(error.isRetryable()).toBe(true);
      expect(error.getRetryDelay()).toBe(60000);
    });

    it('should use default retry delay if no retryAfter', () => {
      const error = new RateLimitError('Rate limited');
      
      expect(error.getRetryDelay()).toBe(60000); // 60 seconds default
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with fields', () => {
      const error = new ValidationError('Validation failed', {
        email: ['Invalid email format'],
        password: ['Too short', 'Missing number'],
      });
      
      expect(error).toBeInstanceOf(APIError);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.category).toBe('validation');
      expect(error.severity).toBe('low');
      expect(error.fields).toEqual({
        email: ['Invalid email format'],
        password: ['Too short', 'Missing number'],
      });
    });
  });

  describe('NotFoundError', () => {
    it('should create NotFoundError with correct properties', () => {
      const error = new NotFoundError('Resource not found');
      
      expect(error).toBeInstanceOf(APIError);
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error.category).toBe('not_found');
      expect(error.severity).toBe('low');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('ServerError', () => {
    it('should create ServerError with correct properties', () => {
      const error = new ServerError('Internal server error');
      
      expect(error).toBeInstanceOf(APIError);
      expect(error.code).toBe('SERVER_ERROR');
      expect(error.category).toBe('server');
      expect(error.severity).toBe('high');
      expect(error.statusCode).toBe(500);
      expect(error.isRetryable()).toBe(true);
    });
  });

  describe('CancellationError', () => {
    it('should create CancellationError with default message', () => {
      const error = new CancellationError();
      
      expect(error).toBeInstanceOf(APIError);
      expect(error.code).toBe('CANCELLATION_ERROR');
      expect(error.category).toBe('cancellation');
      expect(error.message).toBe('Request was cancelled');
      expect(error.severity).toBe('low');
    });

    it('should create CancellationError with custom message', () => {
      const error = new CancellationError('User cancelled the request');
      
      expect(error.message).toBe('User cancelled the request');
    });
  });

  describe('ConflictError', () => {
    it('should create ConflictError with correct properties', () => {
      const error = new ConflictError('Resource already exists');
      
      expect(error).toBeInstanceOf(APIError);
      expect(error.code).toBe('CONFLICT_ERROR');
      expect(error.category).toBe('conflict');
      expect(error.severity).toBe('medium');
      expect(error.statusCode).toBe(409);
    });
  });
});

describe('Singleton functions', () => {
  it('should get singleton instance', () => {
    const instance1 = getAPIErrorClassifier();
    const instance2 = getAPIErrorClassifier();
    expect(instance1).toBe(instance2);
  });

  it('should initialize new instance', () => {
    initializeAPIErrorClassifier();
    expect(hasAPIErrorClassifier()).toBe(true);
  });
});

describe('Convenience functions', () => {
  it('should classify error using convenience function', () => {
    const error = new Error('Test error');
    const apiError = classifyError(error, { url: '/test' });
    
    expect(apiError).toBeInstanceOf(APIError);
    expect(apiError.url).toBe('/test');
  });

  it('should check if error is retryable', () => {
    const retryableError = new NetworkError('Network failed');
    const nonRetryableError = new AuthError('Not authenticated');
    
    expect(isErrorRetryable(retryableError)).toBe(true);
    expect(isErrorRetryable(nonRetryableError)).toBe(false);
  });

  it('should get retry delay', () => {
    const error = new RateLimitError('Rate limited', 30);
    
    expect(getErrorRetryDelay(error)).toBe(30000);
  });

  it('should return default retry delay for non-API errors', () => {
    expect(getErrorRetryDelay(new Error('Unknown'))).toBe(1000);
  });
});

describe('useAPIErrorClassifier hook', () => {
  it('should return classifier methods', () => {
    const hook = useAPIErrorClassifier();
    
    expect(hook.classify).toBeDefined();
    expect(hook.isRetryable).toBeDefined();
    expect(hook.getRetryDelay).toBeDefined();
    expect(hook.getStats).toBeDefined();
    expect(hook.getRecentErrors).toBeDefined();
    expect(hook.getErrorsByCategory).toBeDefined();
    expect(hook.resetStats).toBeDefined();
  });

  it('should provide error constructors', () => {
    const hook = useAPIErrorClassifier();
    
    expect(hook.createNetworkError('Test')).toBeInstanceOf(NetworkError);
    expect(hook.createTimeoutError('Test')).toBeInstanceOf(TimeoutError);
    expect(hook.createAuthError('Test')).toBeInstanceOf(AuthError);
    expect(hook.createRateLimitError('Test')).toBeInstanceOf(RateLimitError);
    expect(hook.createValidationError('Test')).toBeInstanceOf(ValidationError);
    expect(hook.createNotFoundError('Test')).toBeInstanceOf(NotFoundError);
    expect(hook.createServerError('Test')).toBeInstanceOf(ServerError);
    expect(hook.createCancellationError('Test')).toBeInstanceOf(CancellationError);
    expect(hook.createConflictError('Test')).toBeInstanceOf(ConflictError);
  });
});

describe('Error statistics', () => {
  it('should track errors by category', () => {
    const classifier = new APIErrorClassifier();
    
    classifier.classify(new NetworkError('Network 1'));
    classifier.classify(new NetworkError('Network 2'));
    classifier.classify(new TimeoutError('Timeout 1'));
    
    const stats = classifier.getStats();
    
    expect(stats.errorsByCategory.network).toBe(2);
    expect(stats.errorsByCategory.timeout).toBe(1);
    
    classifier.destroy();
  });

  it('should track errors by code', () => {
    const classifier = new APIErrorClassifier();
    
    classifier.classify(new NetworkError('Network 1'));
    classifier.classify(new NetworkError('Network 2'));
    classifier.classify(new TimeoutError('Timeout 1'));
    
    const stats = classifier.getStats();
    
    expect(stats.errorsByCode['NETWORK_ERROR']).toBe(2);
    expect(stats.errorsByCode['TIMEOUT_ERROR']).toBe(1);
    
    classifier.destroy();
  });

  it('should calculate error rate', () => {
    const classifier = new APIErrorClassifier();
    
    // Add some errors
    for (let i = 0; i < 10; i++) {
      classifier.classify(new Error(`Error ${i}`));
    }
    
    const stats = classifier.getStats();
    
    expect(stats.totalErrors).toBe(10);
    // Error rate is totalErrors / elapsedMinutes, so when no time has passed, it's 0
    // When time has passed, it should be a positive number
    expect(stats.errorRate).toBeGreaterThanOrEqual(0);
    
    classifier.destroy();
  });

  it('should return top errors', () => {
    const classifier = new APIErrorClassifier();
    
    // Add various errors
    for (let i = 0; i < 5; i++) {
      classifier.classify(new NetworkError(`Network ${i}`));
    }
    for (let i = 0; i < 3; i++) {
      classifier.classify(new TimeoutError(`Timeout ${i}`));
    }
    
    const stats = classifier.getStats();
    const topErrors = stats.topErrors;
    
    expect(topErrors.length).toBeGreaterThan(0);
    expect(topErrors[0].code).toBe('NETWORK_ERROR');
    expect(topErrors[0].count).toBe(5);
    
    classifier.destroy();
  });

  it('should get recent errors', () => {
    const classifier = new APIErrorClassifier();
    
    classifier.classify(new Error('Error 1'));
    classifier.classify(new Error('Error 2'));
    classifier.classify(new Error('Error 3'));
    
    const recent = classifier.getRecentErrors(2);
    
    expect(recent.length).toBe(2);
    
    classifier.destroy();
  });

  it('should get errors by category', () => {
    const classifier = new APIErrorClassifier();
    
    classifier.classify(new NetworkError('Network 1'));
    classifier.classify(new TimeoutError('Timeout 1'));
    classifier.classify(new NetworkError('Network 2'));
    
    const networkErrors = classifier.getErrorsByCategory('network');
    
    expect(networkErrors.length).toBe(2);
    
    classifier.destroy();
  });

  it('should reset statistics', () => {
    const classifier = new APIErrorClassifier();
    
    classifier.classify(new Error('Error 1'));
    classifier.classify(new Error('Error 2'));
    
    expect(classifier.getStats().totalErrors).toBe(2);
    
    classifier.resetStats();
    
    expect(classifier.getStats().totalErrors).toBe(0);
    
    classifier.destroy();
  });
});
