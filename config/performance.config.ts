/**
 * Performance Configuration - Timeouts, limits, and performance thresholds
 */

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
  jitter: boolean;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
}

export interface PerformanceConfig {
  retry: RetryConfig;
  cache: CacheConfig;
  database: {
    queryLimit: number;
    slowQueryThreshold: number;
    slowOperationThreshold: number;
  };
  ai: {
    cacheSize: number;
    defaultTtl: number;
  };
  monitoring: {
    metricsFrequency: number;
    alertThreshold: number;
  };
}

export const performanceConfig: PerformanceConfig = {
  retry: {
    maxRetries: parseInt(import.meta.env.VITE_MAX_RETRIES || '5') || 5,
    retryDelay: parseInt(import.meta.env.VITE_RETRY_DELAY || '500') || 500,
    backoffMultiplier: parseFloat(import.meta.env.VITE_BACKOFF_MULTIPLIER || '1.5') || 1.5,
    maxDelay: parseInt(import.meta.env.VITE_MAX_DELAY || '10000') || 10000,
    jitter: import.meta.env.VITE_RETRY_JITTER !== 'false',
  },
  cache: {
    ttl: parseInt(import.meta.env.VITE_CACHE_TTL || '900000') || 15 * 60 * 1000, // 15 minutes
    maxSize: parseInt(import.meta.env.VITE_CACHE_MAX_SIZE || '200') || 200,
  },
  database: {
    queryLimit: parseInt(import.meta.env.VITE_DB_QUERY_LIMIT || '100') || 100,
    slowQueryThreshold: parseInt(import.meta.env.VITE_SLOW_QUERY_THRESHOLD || '1000') || 1000,
    slowOperationThreshold: parseInt(import.meta.env.VITE_SLOW_OPERATION_THRESHOLD || '500') || 500,
  },
  ai: {
    cacheSize: parseInt(import.meta.env.VITE_AI_CACHE_SIZE || '100') || 100,
    defaultTtl: parseInt(import.meta.env.VITE_AI_DEFAULT_TTL || '300000') || 300000, // 5 minutes
  },
  monitoring: {
    metricsFrequency: parseInt(import.meta.env.VITE_METRICS_FREQUENCY || '30000') || 30000, // 30 seconds
    alertThreshold: parseFloat(import.meta.env.VITE_ALERT_THRESHOLD || '0.8') || 0.8,
  },
};