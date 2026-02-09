import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('integration-resilience');

export enum IntegrationType {
  DATABASE = 'database',
  AI_SERVICE = 'ai_service',
  MARKET_DATA = 'market_data',
  CACHE = 'cache',
  EXTERNAL_API = 'external_api'
}

export enum ErrorCategory {
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  SERVER_ERROR = 'server_error',
  CLIENT_ERROR = 'client_error',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface TimeoutConfig {
  connect: number;
  read: number;
  write: number;
  overall: number;
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: ErrorCategory[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenMaxCalls: number;
  resetTimeout: number;
}

export interface IntegrationConfig {
  type: IntegrationType;
  name: string;
  timeouts: TimeoutConfig;
  retryPolicy: RetryPolicy;
  circuitBreaker: CircuitBreakerConfig;
  fallbackEnabled: boolean;
  healthCheckInterval: number;
}

export interface StandardizedError {
  code: string;
  category: ErrorCategory;
  message: string;
  details?: Record<string, any>;
  originalError?: Error;
  timestamp: number;
  retryable: boolean;
  integrationType: IntegrationType;
}

export interface HealthStatus {
  integration: string;
  type: IntegrationType;
  healthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  circuitBreakerState: CircuitBreakerState;
  responseTime: number;
  errorRate: number;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  failureRate: number;
  nextAttemptTime?: number;
}

const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {
  database: {
    type: IntegrationType.DATABASE,
    name: 'Database',
    timeouts: {
      connect: 5000,
      read: 10000,
      write: 15000,
      overall: 30000
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelay: 500,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK,
        ErrorCategory.SERVER_ERROR
      ]
    },
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      halfOpenMaxCalls: 3,
      resetTimeout: 60000
    },
    fallbackEnabled: true,
    healthCheckInterval: 30000
  },
  ai_service: {
    type: IntegrationType.AI_SERVICE,
    name: 'AI Service',
    timeouts: {
      connect: 5000,
      read: 30000,
      write: 10000,
      overall: 60000
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 15000,
      backoffMultiplier: 1.5,
      jitter: true,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK,
        ErrorCategory.SERVER_ERROR,
        ErrorCategory.RATE_LIMIT
      ]
    },
    circuitBreaker: {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000,
      halfOpenMaxCalls: 2,
      resetTimeout: 120000
    },
    fallbackEnabled: true,
    healthCheckInterval: 60000
  },
  market_data: {
    type: IntegrationType.MARKET_DATA,
    name: 'Market Data',
    timeouts: {
      connect: 2000,
      read: 5000,
      write: 2000,
      overall: 10000
    },
    retryPolicy: {
      maxRetries: 2,
      initialDelay: 200,
      maxDelay: 2000,
      backoffMultiplier: 1.5,
      jitter: true,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK
      ]
    },
    circuitBreaker: {
      failureThreshold: 10,
      successThreshold: 5,
      timeout: 10000,
      halfOpenMaxCalls: 5,
      resetTimeout: 30000
    },
    fallbackEnabled: true,
    healthCheckInterval: 10000
  },
  cache: {
    type: IntegrationType.CACHE,
    name: 'Cache',
    timeouts: {
      connect: 1000,
      read: 2000,
      write: 2000,
      overall: 5000
    },
    retryPolicy: {
      maxRetries: 1,
      initialDelay: 100,
      maxDelay: 500,
      backoffMultiplier: 1,
      jitter: false,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK
      ]
    },
    circuitBreaker: {
      failureThreshold: 20,
      successThreshold: 10,
      timeout: 5000,
      halfOpenMaxCalls: 10,
      resetTimeout: 60000
    },
    fallbackEnabled: false,
    healthCheckInterval: 60000
  },
  external_api_slow: {
    type: IntegrationType.EXTERNAL_API,
    name: 'External API (Slow)',
    timeouts: {
      connect: 10000,
      read: 30000,
      write: 30000,
      overall: 60000
    },
    retryPolicy: {
      maxRetries: 5,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK,
        ErrorCategory.SERVER_ERROR,
        ErrorCategory.RATE_LIMIT
      ]
    },
    circuitBreaker: {
      failureThreshold: 10,
      successThreshold: 5,
      timeout: 60000,
      halfOpenMaxCalls: 3,
      resetTimeout: 120000
    },
    fallbackEnabled: true,
    healthCheckInterval: 60000
  },
  external_api_fast: {
    type: IntegrationType.EXTERNAL_API,
    name: 'External API (Fast)',
    timeouts: {
      connect: 2000,
      read: 5000,
      write: 5000,
      overall: 10000
    },
    retryPolicy: {
      maxRetries: 1,
      initialDelay: 200,
      maxDelay: 1000,
      backoffMultiplier: 1.5,
      jitter: true,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK
      ]
    },
    circuitBreaker: {
      failureThreshold: 10,
      successThreshold: 5,
      timeout: 10000,
      halfOpenMaxCalls: 5,
      resetTimeout: 30000
    },
    fallbackEnabled: false,
    healthCheckInterval: 30000
  },
  webhook: {
    type: IntegrationType.EXTERNAL_API,
    name: 'Webhook Endpoint',
    timeouts: {
      connect: 2000,
      read: 3000,
      write: 3000,
      overall: 5000
    },
    retryPolicy: {
      maxRetries: 0,
      initialDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitter: false,
      retryableErrors: []
    },
    circuitBreaker: {
      failureThreshold: 20,
      successThreshold: 10,
      timeout: 5000,
      halfOpenMaxCalls: 5,
      resetTimeout: 60000
    },
    fallbackEnabled: false,
    healthCheckInterval: 60000
  }
};

export function getConfig(integrationKey: string): IntegrationConfig {
  const config = INTEGRATION_CONFIGS[integrationKey];
  if (!config) {
    const availableConfigs = Object.keys(INTEGRATION_CONFIGS).join(', ');
    logger.warn(
      `Integration config not found for '${integrationKey}'. Using generic default config. ` +
      `Available configs: ${availableConfigs}. ` +
      `Consider adding explicit configuration for '${integrationKey}' to INTEGRATION_CONFIGS.`
    );
    return {
      type: IntegrationType.EXTERNAL_API,
      name: integrationKey,
      timeouts: {
        connect: 5000,
        read: 10000,
        write: 10000,
        overall: 20000
      },
      retryPolicy: {
        maxRetries: 2,
        initialDelay: 500,
        maxDelay: 5000,
        backoffMultiplier: 1.5,
        jitter: true,
        retryableErrors: [ErrorCategory.TIMEOUT, ErrorCategory.NETWORK, ErrorCategory.SERVER_ERROR]
      },
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 10000,
        halfOpenMaxCalls: 3,
        resetTimeout: 60000
      },
      fallbackEnabled: false,
      healthCheckInterval: 30000
    };
  }
  return config;
}

export function classifyError(error: any): ErrorCategory {
  if (!error) return ErrorCategory.UNKNOWN;

  const message = (error.message || '').toLowerCase();
  const status = error.status || error.statusCode;

  if (message.includes('timeout') || message.includes('timed out')) {
    return ErrorCategory.TIMEOUT;
  }

  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return ErrorCategory.RATE_LIMIT;
  }

  if (message.includes('network') || message.includes('fetch failed') || 
      message.includes('econnrefused') || message.includes('enotfound')) {
    return ErrorCategory.NETWORK;
  }

  if (status && status >= 500) {
    return ErrorCategory.SERVER_ERROR;
  }

  if (status && status >= 400 && status < 500) {
    return ErrorCategory.CLIENT_ERROR;
  }

  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return ErrorCategory.VALIDATION;
  }

  return ErrorCategory.UNKNOWN;
}

export function createStandardizedError(
  code: string,
  category: ErrorCategory,
  message: string,
  originalError?: Error,
  details?: Record<string, any>,
  integrationType: IntegrationType = IntegrationType.EXTERNAL_API
): StandardizedError {
  const config = INTEGRATION_CONFIGS[integrationType];
  const retryable = config ? config.retryPolicy.retryableErrors.includes(category) : false;

  return {
    code,
    category,
    message,
    details,
    originalError,
    timestamp: Date.now(),
    retryable,
    integrationType
  };
}

export function wrapWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = createStandardizedError(
        'TIMEOUT',
        ErrorCategory.TIMEOUT,
        `Operation ${operationName} timed out after ${timeoutMs}ms`,
        undefined,
        { timeoutMs, operationName }
      );
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([
    promise.then(value => {
      clearTimeout(timeoutId);
      return value;
    }),
    timeoutPromise
  ]);
}

export function calculateRetryDelay(
  attempt: number,
  config: RetryPolicy
): number {
  let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  delay = Math.min(delay, config.maxDelay);

  if (config.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.floor(delay);
}
