import {
  IntegrationType,
  getConfig,
  wrapWithTimeout,
  calculateRetryDelay,
  createStandardizedError,
  classifyError,
  StandardizedError,
  RetryPolicy
} from './integrationResilience';
import { circuitBreakerMonitor } from './circuitBreakerMonitor';
import {
  fallbackManager,
  FallbackStrategy,
  degradedModeManager
} from './fallbackStrategies';
import { integrationHealthMonitor, integrationMetrics } from './integrationHealthMonitor';
import { createScopedLogger } from '../utils/logger';
import { dbUtils } from './supabase';
import { marketService } from './marketData';
import { consolidatedCache } from './consolidatedCacheManager';
import { settingsManager } from './settingsManager';

const logger = createScopedLogger('integration-wrapper');

export interface IntegrationWrapperOptions<T> {
  integrationType: IntegrationType;
  integrationName: string;
  operation: () => Promise<T>;
  operationName?: string;
  fallbacks?: FallbackStrategy<any>[];
  disableCircuitBreaker?: boolean;
  disableRetry?: boolean;
  disableFallback?: boolean;
  customTimeout?: number;
  customRetryPolicy?: Partial<RetryPolicy>;
}

export interface IntegrationResult<T> {
  success: boolean;
  data?: T;
  error?: StandardizedError;
  metrics: {
    attempts: number;
    totalTime: number;
    fallbackUsed: boolean;
    circuitBreakerTripped: boolean;
    retried: boolean;
  };
}

export class IntegrationWrapper {
  private static async withRetry<T>(
    operation: () => Promise<T>,
    options: IntegrationWrapperOptions<T>
  ): Promise<{ result?: T; attempts: number; lastError?: any }> {
    const config = getConfig(options.integrationName);
    const retryPolicy = { ...config.retryPolicy, ...options.customRetryPolicy };

    if (options.disableRetry) {
      try {
        const result = await operation();
        return { result, attempts: 1 };
      } catch (error) {
        return { attempts: 1, lastError: error };
      }
    }

    let lastError: any;
    
    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 0) {
          logger.info(`Operation ${options.operationName || 'integration-operation'} succeeded after ${attempt} retries`);
        }
        
        return { result, attempts: attempt + 1 };
      } catch (error: any) {
        lastError = error;
        const errorCategory = classifyError(error);
        
        const isRetryable = retryPolicy.retryableErrors.includes(errorCategory);
        
        if (!isRetryable) {
          logger.debug(`Operation ${options.operationName || 'integration-operation'} encountered non-retryable error: ${errorCategory}`);
          throw error;
        }

        if (attempt === retryPolicy.maxRetries) {
          logger.warn(`Operation ${options.operationName || 'integration-operation'} failed after ${retryPolicy.maxRetries} retries`);
          throw error;
        }

        const delay = calculateRetryDelay(attempt, retryPolicy);
        logger.warn(`Operation ${options.operationName || 'integration-operation'} failed (attempt ${attempt + 1}/${retryPolicy.maxRetries + 1}), retrying in ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private static async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    options: IntegrationWrapperOptions<T>
  ): Promise<T> {
    if (options.disableCircuitBreaker) {
      return operation();
    }

    const config = getConfig(options.integrationName);
    const breaker = circuitBreakerMonitor.registerCircuitBreaker(
      options.integrationName,
      config.circuitBreaker
    );

    return breaker.execute(operation);
  }

  private static async withTimeout<T>(
    operation: () => Promise<T>,
    options: IntegrationWrapperOptions<T>
  ): Promise<T> {
    const config = getConfig(options.integrationName);
    const timeout = options.customTimeout || config.timeouts.overall;
    const operationName = options.operationName || 'integration-operation';

    return wrapWithTimeout(
      operation(),
      timeout,
      operationName
    );
  }

  static async execute<T>(
    options: IntegrationWrapperOptions<T>
  ): Promise<IntegrationResult<T>> {
    const startTime = Date.now();
    const opName = options.operationName || 'integration-operation';
    let attempts = 0;
    let retried = false;
    let circuitBreakerTripped = false;
    let fallbackUsed = false;

    logger.debug(`Starting integration operation ${opName} for ${options.integrationName}`);

    try {
      let result: T | undefined;

      if (options.fallbacks && options.fallbacks.length > 0 && !options.disableFallback) {
        const fallbackResult = await fallbackManager.executeWithFallback({
          integrationType: options.integrationType,
          integrationName: options.integrationName,
          primaryOperation: this.executeOperation.bind(this, options),
          fallbacks: options.fallbacks
        });

        if (fallbackResult.fallbackUsed) {
          fallbackUsed = true;
          result = fallbackResult.data;
        } else if (fallbackResult.error) {
          throw fallbackResult.error;
        }
      }

      if (result === undefined) {
        const operationResult = await this.executeOperationWithMetrics(options);
        result = operationResult.result;
        attempts = operationResult.attempts;
        retried = operationResult.retried;
      }

      const totalTime = Date.now() - startTime;
      integrationMetrics.recordOperation(
        options.integrationName,
        opName,
        totalTime,
        true
      );

      logger.debug(`Integration operation ${opName} completed successfully in ${totalTime}ms`);

      return {
        success: true,
        data: result,
        metrics: {
          attempts,
          totalTime,
          fallbackUsed,
          circuitBreakerTripped,
          retried
        }
      };

    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      const errorCategory = classifyError(error);

      integrationMetrics.recordOperation(
        options.integrationName,
        opName,
        totalTime,
        false
      );

      const standardizedError = createStandardizedError(
        error.code || 'INTEGRATION_ERROR',
        errorCategory,
        error.message || 'Unknown integration error',
        error,
        undefined,
        options.integrationType
      );

      if ((error as any).circuitBreakerOpen) {
        circuitBreakerTripped = true;
        logger.warn(`Circuit breaker tripped for ${options.integrationName} during ${opName}`);
      }

      logger.error(`Integration operation ${opName} failed:`, error.message);

      return {
        success: false,
        error: standardizedError,
        metrics: {
          attempts,
          totalTime,
          fallbackUsed,
          circuitBreakerTripped,
          retried
        }
      };
    }
  }

  private static async executeOperation<T>(
    options: IntegrationWrapperOptions<T>
  ): Promise<T> {
    const operation = async () => {
      return await options.operation();
    };

    const operationWithTimeout = () => this.withTimeout(operation, options);
    const operationWithCircuitBreaker = () => 
      this.withCircuitBreaker(operationWithTimeout, options);

    const retryResult = await this.withRetry(
      operationWithCircuitBreaker,
      options
    );

    return retryResult.result as T;
  }

  private static async executeOperationWithMetrics<T>(
    options: IntegrationWrapperOptions<T>
  ): Promise<{ result: T; attempts: number; retried: boolean }> {
    const operation = async () => {
      return await options.operation();
    };

    const operationWithTimeout = () => this.withTimeout(operation, options);
    const operationWithCircuitBreaker = () => 
      this.withCircuitBreaker(operationWithTimeout, options);

    const retryResult = await this.withRetry(
      operationWithCircuitBreaker,
      options
    );

    return {
      result: retryResult.result as T,
      attempts: retryResult.attempts,
      retried: retryResult.attempts > 1
    };
  }

  static createOperation<T>(
    integrationType: IntegrationType,
    integrationName: string,
    operation: () => Promise<T>
  ): () => Promise<IntegrationResult<T>> {
    return () => this.execute<T>({
      integrationType,
      integrationName,
      operation,
      operationName: integrationName
    });
  }
}

export class IntegrationHealthChecker {
  static setupHealthChecks(): void {
    const configs = ['database', 'ai_service', 'market_data', 'cache'];

    configs.forEach(name => {
      const config = getConfig(name);

      integrationHealthMonitor.registerHealthCheck({
        integrationType: config.type,
        integrationName: name,
        check: async () => {
          const startTime = Date.now();
          try {
            if (name === 'database') {
              const result = await dbUtils.checkConnection();
              return {
                success: result.success,
                latency: Date.now() - startTime,
                message: result.message,
                mode: result.mode
              };
            } else if (name === 'ai_service') {
              const settings = settingsManager.getSettings();
              if (!settings.apiKey) {
                return {
                  success: false,
                  latency: Date.now() - startTime,
                  error: 'AI API key not configured'
                };
              }
              const { testAIConnection } = await import('./gemini');
              await testAIConnection(settings);
              return {
                success: true,
                latency: Date.now() - startTime
              };
            } else if (name === 'market_data') {
              // Check if market data service has any active connections
              const hasSubscribers = marketService['subscribers'].size > 0;
              const lastData = marketService['lastKnownData'];
              return {
                success: true,
                latency: Date.now() - startTime,
                hasActiveSubscriptions: hasSubscribers,
                symbolsTracked: lastData.size
              };
            } else if (name === 'cache') {
              // Test cache operation
              const testKey = 'health_check_test';
              const testValue = { timestamp: Date.now() };
              await consolidatedCache.set(testKey, testValue, 'health', ['health_check']);
              const retrieved = await consolidatedCache.get(testKey);
              const success = retrieved && retrieved.timestamp === testValue.timestamp;
              await consolidatedCache.invalidateByTags(['health_check']);
              
              return {
                success,
                latency: Date.now() - startTime
              };
            }

            return { success: false, latency: Date.now() - startTime };
          } catch (error) {
            logger.error(`Health check failed for ${name}:`, error);
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              latency: Date.now() - startTime
            };
          }
        },
        interval: config.healthCheckInterval,
        timeout: config.timeouts.overall,
        onHealthChange: (status) => {
          if (!status.healthy) {
            logger.warn(`Integration ${name} is unhealthy:`, status);
          } else {
            logger.info(`Integration ${name} is healthy`);
          }
        }
      });
    });

    logger.info('Integration health checks setup complete');
  }

  static getHealthSummary() {
    return integrationHealthMonitor.getSummary();
  }

  static getMetricsSummary() {
    return integrationMetrics.getAllMetrics();
  }

  static getCircuitBreakerSummary() {
    return circuitBreakerMonitor.getSummary();
  }
}

export const createIntegrationOperation = <T>(
  integrationType: IntegrationType,
  integrationName: string,
  operation: () => Promise<T>,
  options?: Partial<IntegrationWrapperOptions<T>>
): () => Promise<IntegrationResult<T>> => {
  return () => IntegrationWrapper.execute<T>({
    integrationType,
    integrationName,
    operation,
    operationName: integrationName,
    ...options
  });
};

export const withIntegrationResilience = async <T>(
  integrationType: IntegrationType,
  integrationName: string,
  operation: () => Promise<T>,
  options?: Partial<IntegrationWrapperOptions<T>>
): Promise<IntegrationResult<T>> => {
  return IntegrationWrapper.execute<T>({
    integrationType,
    integrationName,
    operation,
    operationName: integrationName,
    ...options
  });
};

export const getIntegrationHealth = (integrationName: string) => {
  const config = getConfig(integrationName);
  return integrationHealthMonitor.getHealthStatus(config.type, integrationName);
};

export const getAllIntegrationHealth = () => {
  return integrationHealthMonitor.getAllHealthStatuses();
};

export const getCircuitBreakerStatus = (integrationName: string) => {
  return circuitBreakerMonitor.getCircuitBreaker(integrationName)?.getMetrics();
};

export const getAllCircuitBreakerStatuses = () => {
  return circuitBreakerMonitor.getAllMetrics();
};

export const resetCircuitBreaker = (integrationName: string) => {
  return circuitBreakerMonitor.resetCircuitBreaker(integrationName);
};

export const enterDegradedMode = (
  integrationType: IntegrationType,
  level: number = 0.75
) => {
  degradedModeManager.setDegradedMode(integrationType, level);
};

export const exitDegradedMode = (integrationType: IntegrationType) => {
  degradedModeManager.exitDegradedMode(integrationType);
};

export const isDegraded = (integrationType: IntegrationType): boolean => {
  return degradedModeManager.isDegraded(integrationType);
};

export const getDegradedIntegrations = () => {
  return degradedModeManager.getDegradedIntegrations();
};
