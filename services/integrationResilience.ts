import { createScopedLogger } from '../utils/logger';
import {
  SERVICE_TIMEOUTS,
  RETRY_CONFIGS,
  CIRCUIT_BREAKER_CONFIGS,
  MONITORING_INTERVALS,
} from '../constants/modularConfig';

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
      connect: SERVICE_TIMEOUTS.SERVICES.DB_CONNECTION,
      read: SERVICE_TIMEOUTS.STANDARD,
      write: SERVICE_TIMEOUTS.MEDIUM,
      overall: SERVICE_TIMEOUTS.SERVICES.DB_QUERY
    },
    retryPolicy: {
      maxRetries: RETRY_CONFIGS.SERVICES.DATABASE.MAX_ATTEMPTS,
      initialDelay: RETRY_CONFIGS.SERVICES.DATABASE.BASE_DELAY_MS,
      maxDelay: RETRY_CONFIGS.SERVICES.DATABASE.MAX_DELAY_MS,
      backoffMultiplier: RETRY_CONFIGS.SERVICES.DATABASE.BACKOFF_MULTIPLIER,
      jitter: true,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK,
        ErrorCategory.SERVER_ERROR
      ]
    },
    circuitBreaker: {
      failureThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.DATABASE.FAILURE_THRESHOLD,
      successThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.DATABASE.SUCCESS_THRESHOLD,
      timeout: SERVICE_TIMEOUTS.SERVICES.DB_QUERY,
      halfOpenMaxCalls: CIRCUIT_BREAKER_CONFIGS.SERVICES.DATABASE.HALF_OPEN_MAX_CALLS,
      resetTimeout: CIRCUIT_BREAKER_CONFIGS.SERVICES.DATABASE.RESET_TIMEOUT_MS
    },
    fallbackEnabled: true,
    healthCheckInterval: MONITORING_INTERVALS.HEALTH_CHECK.NORMAL
  },
  ai_service: {
    type: IntegrationType.AI_SERVICE,
    name: 'AI Service',
    timeouts: {
      connect: SERVICE_TIMEOUTS.QUICK,
      read: SERVICE_TIMEOUTS.SERVICES.AI_GENERATION,
      write: SERVICE_TIMEOUTS.STANDARD,
      overall: SERVICE_TIMEOUTS.MEDIUM
    },
    retryPolicy: {
      maxRetries: RETRY_CONFIGS.SERVICES.AI_SERVICE.MAX_ATTEMPTS,
      initialDelay: RETRY_CONFIGS.SERVICES.AI_SERVICE.BASE_DELAY_MS,
      maxDelay: RETRY_CONFIGS.SERVICES.AI_SERVICE.MAX_DELAY_MS,
      backoffMultiplier: RETRY_CONFIGS.SERVICES.AI_SERVICE.BACKOFF_MULTIPLIER,
      jitter: true,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK,
        ErrorCategory.SERVER_ERROR,
        ErrorCategory.RATE_LIMIT
      ]
    },
    circuitBreaker: {
      failureThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.AI_SERVICE.FAILURE_THRESHOLD,
      successThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.AI_SERVICE.SUCCESS_THRESHOLD,
      timeout: SERVICE_TIMEOUTS.SERVICES.AI_GENERATION,
      halfOpenMaxCalls: CIRCUIT_BREAKER_CONFIGS.SERVICES.AI_SERVICE.HALF_OPEN_MAX_CALLS,
      resetTimeout: CIRCUIT_BREAKER_CONFIGS.SERVICES.AI_SERVICE.RESET_TIMEOUT_MS
    },
    fallbackEnabled: true,
    healthCheckInterval: MONITORING_INTERVALS.HEALTH_CHECK.SLOW
  },
  market_data: {
    type: IntegrationType.MARKET_DATA,
    name: 'Market Data',
    timeouts: {
      connect: SERVICE_TIMEOUTS.QUICK,
      read: SERVICE_TIMEOUTS.SHORT,
      write: SERVICE_TIMEOUTS.QUICK,
      overall: SERVICE_TIMEOUTS.STANDARD
    },
    retryPolicy: {
      maxRetries: RETRY_CONFIGS.SERVICES.MARKET_DATA.MAX_ATTEMPTS,
      initialDelay: RETRY_CONFIGS.SERVICES.MARKET_DATA.BASE_DELAY_MS,
      maxDelay: SERVICE_TIMEOUTS.SHORT,
      backoffMultiplier: RETRY_CONFIGS.SERVICES.MARKET_DATA.BACKOFF_MULTIPLIER,
      jitter: true,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK
      ]
    },
    circuitBreaker: {
      failureThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.MARKET_DATA.FAILURE_THRESHOLD,
      successThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.MARKET_DATA.SUCCESS_THRESHOLD,
      timeout: SERVICE_TIMEOUTS.STANDARD,
      halfOpenMaxCalls: CIRCUIT_BREAKER_CONFIGS.SERVICES.MARKET_DATA.HALF_OPEN_MAX_CALLS,
      resetTimeout: CIRCUIT_BREAKER_CONFIGS.SERVICES.MARKET_DATA.RESET_TIMEOUT_MS
    },
    fallbackEnabled: true,
    healthCheckInterval: MONITORING_INTERVALS.HEALTH_CHECK.NORMAL
  },
  cache: {
    type: IntegrationType.CACHE,
    name: 'Cache',
    timeouts: {
      connect: SERVICE_TIMEOUTS.QUICK,
      read: SERVICE_TIMEOUTS.QUICK,
      write: SERVICE_TIMEOUTS.QUICK,
      overall: SERVICE_TIMEOUTS.SHORT
    },
    retryPolicy: {
      maxRetries: RETRY_CONFIGS.CONSERVATIVE.MAX_ATTEMPTS,
      initialDelay: RETRY_CONFIGS.CONSERVATIVE.BASE_DELAY_MS / 20, // 100ms
      maxDelay: RETRY_CONFIGS.CONSERVATIVE.BASE_DELAY_MS / 4, // 500ms
      backoffMultiplier: 1,
      jitter: false,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK
      ]
    },
    circuitBreaker: {
      failureThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.CACHE.FAILURE_THRESHOLD,
      successThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.CACHE.SUCCESS_THRESHOLD,
      timeout: SERVICE_TIMEOUTS.QUICK,
      halfOpenMaxCalls: CIRCUIT_BREAKER_CONFIGS.SERVICES.CACHE.HALF_OPEN_MAX_CALLS,
      resetTimeout: CIRCUIT_BREAKER_CONFIGS.SERVICES.CACHE.RESET_TIMEOUT_MS
    },
    fallbackEnabled: false,
    healthCheckInterval: MONITORING_INTERVALS.HEALTH_CHECK.SLOW
  },
  external_api_slow: {
    type: IntegrationType.EXTERNAL_API,
    name: 'External API (Slow)',
    timeouts: {
      connect: SERVICE_TIMEOUTS.STANDARD,
      read: SERVICE_TIMEOUTS.SERVICES.EXTERNAL_API,
      write: SERVICE_TIMEOUTS.SERVICES.EXTERNAL_API,
      overall: SERVICE_TIMEOUTS.LONG
    },
    retryPolicy: {
      maxRetries: RETRY_CONFIGS.AGGRESSIVE.MAX_ATTEMPTS,
      initialDelay: RETRY_CONFIGS.AGGRESSIVE.BASE_DELAY_MS,
      maxDelay: RETRY_CONFIGS.AGGRESSIVE.MAX_DELAY_MS,
      backoffMultiplier: RETRY_CONFIGS.AGGRESSIVE.BACKOFF_MULTIPLIER,
      jitter: true,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK,
        ErrorCategory.SERVER_ERROR,
        ErrorCategory.RATE_LIMIT
      ]
    },
    circuitBreaker: {
      failureThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.EXTERNAL_API.FAILURE_THRESHOLD,
      successThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.EXTERNAL_API.SUCCESS_THRESHOLD,
      timeout: SERVICE_TIMEOUTS.LONG,
      halfOpenMaxCalls: CIRCUIT_BREAKER_CONFIGS.SERVICES.EXTERNAL_API.HALF_OPEN_MAX_CALLS,
      resetTimeout: CIRCUIT_BREAKER_CONFIGS.SERVICES.EXTERNAL_API.RESET_TIMEOUT_MS
    },
    fallbackEnabled: true,
    healthCheckInterval: MONITORING_INTERVALS.HEALTH_CHECK.SLOW
  },
  external_api_fast: {
    type: IntegrationType.EXTERNAL_API,
    name: 'External API (Fast)',
    timeouts: {
      connect: SERVICE_TIMEOUTS.QUICK,
      read: SERVICE_TIMEOUTS.QUICK,
      write: SERVICE_TIMEOUTS.QUICK,
      overall: SERVICE_TIMEOUTS.STANDARD
    },
    retryPolicy: {
      maxRetries: RETRY_CONFIGS.CONSERVATIVE.MAX_ATTEMPTS,
      initialDelay: RETRY_CONFIGS.CONSERVATIVE.BASE_DELAY_MS / 10, // 200ms
      maxDelay: SERVICE_TIMEOUTS.QUICK,
      backoffMultiplier: RETRY_CONFIGS.CONSERVATIVE.BACKOFF_MULTIPLIER,
      jitter: true,
      retryableErrors: [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK
      ]
    },
    circuitBreaker: {
      failureThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.EXTERNAL_API.FAILURE_THRESHOLD,
      successThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.EXTERNAL_API.SUCCESS_THRESHOLD,
      timeout: SERVICE_TIMEOUTS.STANDARD,
      halfOpenMaxCalls: CIRCUIT_BREAKER_CONFIGS.SERVICES.EXTERNAL_API.HALF_OPEN_MAX_CALLS,
      resetTimeout: CIRCUIT_BREAKER_CONFIGS.SERVICES.EXTERNAL_API.RESET_TIMEOUT_MS
    },
    fallbackEnabled: false,
    healthCheckInterval: MONITORING_INTERVALS.HEALTH_CHECK.NORMAL
  },
  webhook: {
    type: IntegrationType.EXTERNAL_API,
    name: 'Webhook Endpoint',
    timeouts: {
      connect: SERVICE_TIMEOUTS.QUICK,
      read: SERVICE_TIMEOUTS.SHORT,
      write: SERVICE_TIMEOUTS.SHORT,
      overall: SERVICE_TIMEOUTS.QUICK
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
      failureThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.CACHE.FAILURE_THRESHOLD,
      successThreshold: CIRCUIT_BREAKER_CONFIGS.SERVICES.CACHE.SUCCESS_THRESHOLD,
      timeout: SERVICE_TIMEOUTS.QUICK,
      halfOpenMaxCalls: CIRCUIT_BREAKER_CONFIGS.DEFAULT.HALF_OPEN_MAX_CALLS,
      resetTimeout: CIRCUIT_BREAKER_CONFIGS.DEFAULT.RESET_TIMEOUT_MS
    },
    fallbackEnabled: false,
    healthCheckInterval: MONITORING_INTERVALS.HEALTH_CHECK.SLOW
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
        connect: SERVICE_TIMEOUTS.QUICK,
        read: SERVICE_TIMEOUTS.STANDARD,
        write: SERVICE_TIMEOUTS.STANDARD,
        overall: SERVICE_TIMEOUTS.MEDIUM
      },
      retryPolicy: {
        maxRetries: RETRY_CONFIGS.STANDARD.MAX_ATTEMPTS,
        initialDelay: RETRY_CONFIGS.STANDARD.BASE_DELAY_MS / 2,
        maxDelay: SERVICE_TIMEOUTS.QUICK,
        backoffMultiplier: RETRY_CONFIGS.STANDARD.BACKOFF_MULTIPLIER,
        jitter: true,
        retryableErrors: [ErrorCategory.TIMEOUT, ErrorCategory.NETWORK, ErrorCategory.SERVER_ERROR]
      },
      circuitBreaker: {
        failureThreshold: CIRCUIT_BREAKER_CONFIGS.DEFAULT.FAILURE_THRESHOLD,
        successThreshold: CIRCUIT_BREAKER_CONFIGS.DEFAULT.SUCCESS_THRESHOLD,
        timeout: SERVICE_TIMEOUTS.STANDARD,
        halfOpenMaxCalls: CIRCUIT_BREAKER_CONFIGS.DEFAULT.HALF_OPEN_MAX_CALLS,
        resetTimeout: CIRCUIT_BREAKER_CONFIGS.DEFAULT.RESET_TIMEOUT_MS
      },
      fallbackEnabled: false,
      healthCheckInterval: MONITORING_INTERVALS.HEALTH_CHECK.NORMAL
    };
  }
  return config;
}

export function classifyError(error: unknown): ErrorCategory {
  if (!error) return ErrorCategory.UNKNOWN;

  // Safely extract message and status from unknown error
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const status = typeof error === 'object' && error !== null 
    ? (error as { status?: number; statusCode?: number }).status || (error as { status?: number; statusCode?: number }).statusCode 
    : undefined;

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
