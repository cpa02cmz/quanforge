import { createScopedLogger } from '../utils/logger';
import { TIMEOUTS } from './constants';

const logger = createScopedLogger('fallback-strategies');

// Import IntegrationType for type safety
import type { IntegrationType } from './integrationResilience';

export interface FallbackResult<T> {
  data?: T;
  fallbackUsed: boolean;
  fallbackType?: string;
  error?: any;
}

export type FallbackFunction<T> = () => Promise<T> | T;

export interface FallbackStrategy<T> {
  name: string;
  priority: number;
  execute: FallbackFunction<T>;
  condition?: () => boolean;
}

export interface FallbackOptions<T> {
  integrationType: IntegrationType;
  integrationName: string;
  primaryOperation: () => Promise<T>;
  fallbacks: FallbackStrategy<T>[];
  fallbackTimeout?: number;
  logFallbacks?: boolean;
}

export interface FallbackMetrics {
  primaryFailures: number;
  fallbackSuccesses: Record<string, number>;
  fallbackFailures: Record<string, number>;
  lastFallbackTime?: number;
}

export class FallbackManager {
  private fallbackMetrics = new Map<string, FallbackMetrics>();

  async executeWithFallback<T>(options: FallbackOptions<T>): Promise<FallbackResult<T>> {
    const { integrationName, primaryOperation, fallbacks, fallbackTimeout = TIMEOUTS.STANDARD, logFallbacks = true } = options;
    const metrics = this.getOrCreateMetrics(integrationName);

    try {
      const startTime = Date.now();
      const data = await primaryOperation();
      
      logger.debug(`Primary operation ${integrationName} succeeded in ${Date.now() - startTime}ms`);
      
      return {
        data,
        fallbackUsed: false
      };
    } catch (primaryError: any) {
      metrics.primaryFailures++;
      logger.warn(`Primary operation ${integrationName} failed:`, primaryError.message);

      if (fallbacks.length === 0) {
        return {
          error: primaryError,
          fallbackUsed: false
        };
      }

      const sortedFallbacks = [...fallbacks].sort((a, b) => a.priority - b.priority);

      for (const fallback of sortedFallbacks) {
        if (fallback.condition && !fallback.condition()) {
          logger.debug(`Fallback ${fallback.name} condition not met, skipping`);
          continue;
        }

        try {
          const startTime = Date.now();
          const fallbackPromise = Promise.resolve(fallback.execute());
          let timeoutId: ReturnType<typeof setTimeout>;
          const fallbackData = await Promise.race([
            fallbackPromise.then(value => {
              clearTimeout(timeoutId);
              return value;
            }),
            new Promise<T>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('Fallback timeout')), fallbackTimeout);
            })
          ]);

          metrics.fallbackSuccesses[fallback.name] = (metrics.fallbackSuccesses[fallback.name] || 0) + 1;
          metrics.lastFallbackTime = Date.now();

          if (logFallbacks) {
            logger.info(`Fallback ${fallback.name} succeeded for ${integrationName} in ${Date.now() - startTime}ms`);
          }

          return {
            data: fallbackData,
            fallbackUsed: true,
            fallbackType: fallback.name
          };
        } catch (fallbackError: any) {
          metrics.fallbackFailures[fallback.name] = (metrics.fallbackFailures[fallback.name] || 0) + 1;
          logger.warn(`Fallback ${fallback.name} failed for ${integrationName}:`, fallbackError.message);
          continue;
        }
      }

      return {
        error: primaryError,
        fallbackUsed: false
      };
    }
  }

  private getOrCreateMetrics(integrationName: string): FallbackMetrics {
    if (!this.fallbackMetrics.has(integrationName)) {
      this.fallbackMetrics.set(integrationName, {
        primaryFailures: 0,
        fallbackSuccesses: {},
        fallbackFailures: {}
      });
    }
    return this.fallbackMetrics.get(integrationName)!;
  }

  getMetrics(integrationName: string): FallbackMetrics {
    const metrics = this.fallbackMetrics.get(integrationName);
    if (!metrics) {
      return {
        primaryFailures: 0,
        fallbackSuccesses: {},
        fallbackFailures: {}
      };
    }

    return {
      primaryFailures: metrics.primaryFailures,
      fallbackSuccesses: { ...metrics.fallbackSuccesses },
      fallbackFailures: { ...metrics.fallbackFailures },
      lastFallbackTime: metrics.lastFallbackTime
    };
  }

  getAllMetrics(): Record<string, FallbackMetrics> {
    const result: Record<string, FallbackMetrics> = {};
    this.fallbackMetrics.forEach((_metrics, name) => {
      result[name] = this.getMetrics(name);
    });
    return result;
  }

  resetMetrics(integrationName?: string): void {
    if (integrationName) {
      this.fallbackMetrics.delete(integrationName);
      logger.debug(`Fallback metrics reset for ${integrationName}`);
    } else {
      this.fallbackMetrics.clear();
      logger.info('All fallback metrics reset');
    }
  }
}

export const fallbackManager = new FallbackManager();

export const databaseFallbacks = {
  cacheFirst: <T>(cacheKey: string, cacheGet: (key: string) => T | null): FallbackStrategy<T> => ({
    name: 'cache-first',
    priority: 1,
    execute: () => {
      const cached = cacheGet(cacheKey);
      if (cached) {
        logger.debug('Cache fallback: returning cached data');
        return cached;
      }
      throw new Error('Cache miss');
    }
  }),

  mockData: <T>(mockData: T): FallbackStrategy<T> => ({
    name: 'mock-data',
    priority: 2,
    execute: () => {
      logger.info('Mock data fallback: returning mock data');
      return mockData;
    }
  }),

  emptyResult: <T>(): FallbackStrategy<T> => ({
    name: 'empty-result',
    priority: 3,
    execute: () => {
      logger.info('Empty result fallback: returning empty data');
      return [] as T;
    }
  })
};

export const aiServiceFallbacks = {
  cachedResponse: <T>(cacheKey: string, cacheGet: (key: string) => T | null): FallbackStrategy<T> => ({
    name: 'cached-response',
    priority: 1,
    execute: () => {
      const cached = cacheGet(cacheKey);
      if (cached) {
        logger.info('Cached response fallback: returning cached AI response');
        return cached;
      }
      throw new Error('Cache miss');
    }
  }),

  genericResponse: <T>(response: T): FallbackStrategy<T> => ({
    name: 'generic-response',
    priority: 2,
    execute: () => {
      logger.warn('Generic response fallback: returning default AI response');
      return response;
    }
  }),

  errorResponse: (): FallbackStrategy<{ content: string }> => ({
    name: 'error-response',
    priority: 3,
    execute: () => {
      return {
        content: 'I apologize, but I encountered an error. Please try again later.'
      };
    }
  })
};

export const marketDataFallbacks = {
  lastKnownValue: <T>(lastValue: T | null): FallbackStrategy<T> => ({
    name: 'last-known-value',
    priority: 1,
    condition: () => lastValue !== null,
    execute: () => {
      logger.info('Last known value fallback: returning previous market data');
      return lastValue!;
    }
  }),

  simulatedData: <T>(simulator: () => T): FallbackStrategy<T> => ({
    name: 'simulated-data',
    priority: 2,
    execute: () => {
      logger.info('Simulated data fallback: generating simulated market data');
      return simulator();
    }
  }),

  zeroData: <T>(): FallbackStrategy<T> => ({
    name: 'zero-data',
    priority: 3,
    execute: () => {
      logger.warn('Zero data fallback: returning zero values');
      return { bid: 0, ask: 0, spread: 0 } as T;
    }
  })
};

export interface DegradationInfo {
  type: IntegrationType;
  level: number;
  duration: number;
}

export class DegradedModeManager {
  private degradedIntegrations = new Set<IntegrationType>();
  private degradationLevels = new Map<IntegrationType, number>();
  private degradationStartTime = new Map<IntegrationType, number>();

  setDegradedMode(integrationType: IntegrationType, level: number = 0.75): void {
    this.degradedIntegrations.add(integrationType);
    this.degradationLevels.set(integrationType, level);
    this.degradationStartTime.set(integrationType, Date.now());

    logger.warn(`Integration ${integrationType} entered degraded mode at ${Math.round(level * 100)}% capacity`);
  }

  exitDegradedMode(integrationType: IntegrationType): void {
    this.degradedIntegrations.delete(integrationType);
    this.degradationLevels.delete(integrationType);
    const startTime = this.degradationStartTime.get(integrationType);
    this.degradationStartTime.delete(integrationType);

    if (startTime) {
      const duration = Date.now() - startTime;
      logger.info(`Integration ${integrationType} exited degraded mode after ${duration}ms`);
    }
  }

  isDegraded(integrationType: IntegrationType): boolean {
    return this.degradedIntegrations.has(integrationType);
  }

  getDegradationLevel(integrationType: IntegrationType): number {
    return this.degradationLevels.get(integrationType) ?? 1;
  }

  shouldLimitOperations(integrationType: IntegrationType): boolean {
    const level = this.getDegradationLevel(integrationType);
    return Math.random() > level;
  }

  getDegradedIntegrations(): DegradationInfo[] {
    const result: DegradationInfo[] = [];

    this.degradedIntegrations.forEach(type => {
      const level = this.degradationLevels.get(type) ?? 0;
      const startTime = this.degradationStartTime.get(type) ?? Date.now();
      
      result.push({
        type,
        level,
        duration: Date.now() - startTime
      });
    });

    return result;
  }

  reset(): void {
    const count = this.degradedIntegrations.size;
    this.degradedIntegrations.clear();
    this.degradationLevels.clear();
    this.degradationStartTime.clear();
    
    if (count > 0) {
      logger.info(`Degraded mode manager reset, cleared ${count} degraded integrations`);
    }
  }
}

export const degradedModeManager = new DegradedModeManager();
