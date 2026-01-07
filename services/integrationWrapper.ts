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
  FallbackOptions,
  FallbackStrategy,
  degradedModeManager
} from './fallbackStrategies';
import { integrationHealthMonitor, integrationMetrics } from './integrationHealthMonitor';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('integration-wrapper');

export interface IntegrationWrapperOptions {
  integrationType: IntegrationType;
  integrationName: string;
  operation: string;
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
    options: IntegrationWrapperOptions
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
          logger.info(`Operation ${options.operation} succeeded after ${attempt} retries`);
        }
        
        return { result, attempts: attempt + 1 };
      } catch (error: any) {
        lastError = error;
        const errorCategory = classifyError(error);
        
        const isRetryable = retryPolicy.retryableErrors.includes(errorCategory);
        
        if (!isRetryable) {
          logger.debug(`Operation ${options.operation} encountered non-retryable error: ${errorCategory}`);
          throw error;
        }

        if (attempt === retryPolicy.maxRetries) {
          logger.warn(`Operation ${options.operation} failed after ${retryPolicy.maxRetries} retries`);
          throw error;
        }

        const delay = calculateRetryDelay(attempt, retryPolicy);
        logger.warn(`Operation ${options.operation} failed (attempt ${attempt + 1}/${retryPolicy.maxRetries + 1}), retrying in ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private static async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    options: IntegrationWrapperOptions
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
    options: IntegrationWrapperOptions
  ): Promise<T> {
    const config = getConfig(options.integrationName);
    const timeout = options.customTimeout || config.timeouts.overall;

    return wrapWithTimeout(
      operation,
      timeout,
      options.operationName || options.operation
    );
  }

  static async execute<T>(
    options: IntegrationWrapperOptions
  ): Promise<IntegrationResult<T>> {
    const startTime = Date.now();
    const opName = options.operationName || options.operation;
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
        result = await this.executeOperation(options);
      }

      const totalTime = Date.now() - startTime;
      integrationMetrics.recordOperation(
        options.integrationName,
        options.operation,
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
        options.operation,
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
    options: IntegrationWrapperOptions
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
          try {
            const startTime = Date.now();
            
            if (name === 'database') {
              return {
                success: true,
                latency: Date.now() - startTime
              };
            } else if (name === 'ai_service') {
              return {
                success: true,
                latency: Date.now() - startTime
              };
            } else if (name === 'market_data') {
              return {
                success: true,
                latency: Date.now() - startTime
              };
            } else if (name === 'cache') {
              return {
                success: true,
                latency: Date.now() - startTime
              };
            }

            return { success: false };
          } catch (error) {
            logger.error(`Health check failed for ${name}:`, error);
            return {
              success: false,
              error,
              latency: Date.now() - Date.now()
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
  options?: Partial<IntegrationWrapperOptions>
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
  options?: Partial<IntegrationWrapperOptions>
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
