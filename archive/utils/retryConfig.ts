/**
 * Centralized retry and timing configuration
 * Eliminates hardcoded retry/timing values scattered throughout services
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface TimeoutConfig {
  connection: number;
  query: number;
  healthCheck: number;
  fallback: number;
  warmup: number;
}

export interface CacheConfig {
  memoryTTL: number;
  edgeTTL: number;
  persistentTTL: number;
  cleanupInterval: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
} as const;

export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  connection: 30000,
  query: 30000,
  healthCheck: 5000,
  fallback: 5000,
  warmup: 2000,
} as const;

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  memoryTTL: 300000, // 5 minutes
  edgeTTL: 600000, // 10 minutes
  persistentTTL: 3600000, // 1 hour
  cleanupInterval: 300000, // 5 minutes
} as const;

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Create a timeout promise
 */
export function createTimeoutPromise(
  ms: number,
  message: string = 'Operation timed out'
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < config.maxAttempts - 1) {
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }
        
        const delay = calculateRetryDelay(attempt, config);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Service-specific configurations
 */
export const SERVICE_CONFIGS = {
  supabase: {
    retry: { ...DEFAULT_RETRY_CONFIG, maxAttempts: 3 },
    timeout: { ...DEFAULT_TIMEOUT_CONFIG, connection: 10000, query: 30000 },
  },
  ai: {
    retry: { ...DEFAULT_RETRY_CONFIG, maxAttempts: 2 },
    timeout: { ...DEFAULT_TIMEOUT_CONFIG, query: 60000 },
  },
  market: {
    retry: { ...DEFAULT_RETRY_CONFIG, maxAttempts: 3 },
    timeout: { ...DEFAULT_TIMEOUT_CONFIG, query: 5000 },
  },
  cache: {
    ...DEFAULT_CACHE_CONFIG,
    maxEntries: 1000,
  },
} as const;
