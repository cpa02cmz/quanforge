/**
 * Backend Rate Limiter
 * 
 * Provides centralized rate limiting with:
 * - Token bucket algorithm
 * - Per-service rate limits
 * - Burst handling
 * - Automatic token refill
 * - Rate limit statistics
 * 
 * @module services/backend/rateLimiter
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('RateLimiter');

/**
 * Rate limit status for a service
 */
export interface RateLimitStatus {
  serviceName: string;
  availableTokens: number;
  maxTokens: number;
  refillRate: number; // tokens per second
  lastRefillTime: number;
  totalRequests: number;
  allowedRequests: number;
  rejectedRequests: number;
  currentBucketLevel: number; // percentage
}

/**
 * Rate limiter configuration
 */
export interface RateLimitConfig {
  serviceName: string;
  maxTokens: number;
  refillRate: number; // tokens per second
  burstSize?: number; // max burst capacity
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  retryAfter?: number; // milliseconds until tokens available
  resetTime?: number; // timestamp when full capacity restored
}

/**
 * Default rate limit configurations for common services
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  database: {
    serviceName: 'database',
    maxTokens: 100,
    refillRate: 50, // 50 tokens/second
    burstSize: 150,
  },
  ai_service: {
    serviceName: 'ai_service',
    maxTokens: 30,
    refillRate: 5, // 5 tokens/second (conservative for AI API)
    burstSize: 50,
  },
  cache: {
    serviceName: 'cache',
    maxTokens: 500,
    refillRate: 200,
    burstSize: 1000,
  },
  market_data: {
    serviceName: 'market_data',
    maxTokens: 100,
    refillRate: 20,
    burstSize: 200,
  },
  external_api: {
    serviceName: 'external_api',
    maxTokens: 50,
    refillRate: 10,
    burstSize: 100,
  },
  default: {
    serviceName: 'default',
    maxTokens: 60,
    refillRate: 10,
    burstSize: 100,
  },
};

/**
 * Token bucket for rate limiting
 */
interface TokenBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number;
  burstSize: number;
  lastRefillTime: number;
  totalRequests: number;
  allowedRequests: number;
  rejectedRequests: number;
}

/**
 * Backend Rate Limiter
 * 
 * Singleton class that provides centralized rate limiting for all backend services.
 */
export class BackendRateLimiter {
  private static instance: BackendRateLimiter | null = null;
  
  private buckets: Map<string, TokenBucket> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupIntervalMs: number = 60000; // 1 minute

  private constructor() {
    this.initializeDefaultBuckets();
    this.startCleanupInterval();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): BackendRateLimiter {
    if (!BackendRateLimiter.instance) {
      BackendRateLimiter.instance = new BackendRateLimiter();
    }
    return BackendRateLimiter.instance;
  }

  /**
   * Configure rate limit for a service
   */
  configureService(config: RateLimitConfig): void {
    const bucket: TokenBucket = {
      tokens: config.maxTokens,
      maxTokens: config.maxTokens,
      refillRate: config.refillRate,
      burstSize: config.burstSize || config.maxTokens * 1.5,
      lastRefillTime: Date.now(),
      totalRequests: 0,
      allowedRequests: 0,
      rejectedRequests: 0,
    };

    this.buckets.set(config.serviceName, bucket);
    logger.log(`Rate limiter configured for ${config.serviceName}: ${config.maxTokens} tokens @ ${config.refillRate}/s`);
  }

  /**
   * Try to consume tokens for a request
   */
  tryConsume(serviceName: string, tokens: number = 1): RateLimitResult {
    this.refillTokens(serviceName);

    let bucket = this.buckets.get(serviceName);
    if (!bucket) {
      // Auto-configure with defaults - use the serviceName we're looking for
      const defaultConfig = DEFAULT_RATE_LIMITS[serviceName] ?? DEFAULT_RATE_LIMITS['default'];
      // Create a config for this specific service name
      this.configureService({
        ...defaultConfig!,
        serviceName, // Override with the requested service name
      });
      bucket = this.buckets.get(serviceName);
    }

    if (!bucket) {
      // Should never happen, but TypeScript needs this check
      return {
        allowed: false,
        remainingTokens: 0,
        retryAfter: 1000,
      };
    }

    bucket.totalRequests++;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      bucket.allowedRequests++;

      return {
        allowed: true,
        remainingTokens: bucket.tokens,
        resetTime: this.calculateResetTime(bucket),
      };
    }

    bucket.rejectedRequests++;

    // Calculate time until enough tokens are available
    const tokensNeeded = tokens - bucket.tokens;
    const timeToRefill = (tokensNeeded / bucket.refillRate) * 1000;

    return {
      allowed: false,
      remainingTokens: bucket.tokens,
      retryAfter: Math.ceil(timeToRefill),
      resetTime: Date.now() + timeToRefill,
    };
  }

  /**
   * Wait for tokens to be available (async)
   */
  async waitForTokens(serviceName: string, tokens: number = 1, maxWaitMs: number = 30000): Promise<boolean> {
    const result = this.tryConsume(serviceName, tokens);
    
    if (result.allowed) {
      return true;
    }

    if (!result.retryAfter || result.retryAfter > maxWaitMs) {
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, result.retryAfter));
    return this.tryConsume(serviceName, tokens).allowed;
  }

  /**
   * Get current rate limit status for a service
   */
  getStatus(serviceName: string): RateLimitStatus | null {
    this.refillTokens(serviceName);

    const bucket = this.buckets.get(serviceName);
    if (!bucket) {
      return null;
    }

    return {
      serviceName,
      availableTokens: bucket.tokens,
      maxTokens: bucket.maxTokens,
      refillRate: bucket.refillRate,
      lastRefillTime: bucket.lastRefillTime,
      totalRequests: bucket.totalRequests,
      allowedRequests: bucket.allowedRequests,
      rejectedRequests: bucket.rejectedRequests,
      currentBucketLevel: (bucket.tokens / bucket.maxTokens) * 100,
    };
  }

  /**
   * Get status for all services
   */
  getAllStatuses(): RateLimitStatus[] {
    const statuses: RateLimitStatus[] = [];
    
    for (const serviceName of this.buckets.keys()) {
      const status = this.getStatus(serviceName);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  /**
   * Reset rate limit for a service
   */
  reset(serviceName: string): void {
    const bucket = this.buckets.get(serviceName);
    if (bucket) {
      bucket.tokens = bucket.maxTokens;
      bucket.lastRefillTime = Date.now();
      bucket.totalRequests = 0;
      bucket.allowedRequests = 0;
      bucket.rejectedRequests = 0;
      logger.log(`Rate limit reset for ${serviceName}`);
    }
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    for (const serviceName of this.buckets.keys()) {
      this.reset(serviceName);
    }
  }

  /**
   * Get overall statistics
   */
  getStats(): {
    totalServices: number;
    totalRequests: number;
    totalAllowed: number;
    totalRejected: number;
    averageAllowRate: number;
  } {
    let totalRequests = 0;
    let totalAllowed = 0;
    let totalRejected = 0;

    for (const bucket of this.buckets.values()) {
      totalRequests += bucket.totalRequests;
      totalAllowed += bucket.allowedRequests;
      totalRejected += bucket.rejectedRequests;
    }

    return {
      totalServices: this.buckets.size,
      totalRequests,
      totalAllowed,
      totalRejected,
      averageAllowRate: totalRequests > 0 ? (totalAllowed / totalRequests) * 100 : 100,
    };
  }

  // Private methods

  private initializeDefaultBuckets(): void {
    for (const [_serviceName, config] of Object.entries(DEFAULT_RATE_LIMITS)) {
      this.configureService(config);
    }
  }

  private refillTokens(serviceName: string): void {
    const bucket = this.buckets.get(serviceName);
    if (!bucket) {
      return;
    }

    const now = Date.now();
    const elapsed = (now - bucket.lastRefillTime) / 1000; // seconds
    const tokensToAdd = elapsed * bucket.refillRate;

    bucket.tokens = Math.min(bucket.burstSize, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;
  }

  private calculateResetTime(bucket: TokenBucket): number {
    const tokensNeeded = bucket.maxTokens - bucket.tokens;
    const timeToRefill = (tokensNeeded / bucket.refillRate) * 1000;
    return Date.now() + timeToRefill;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      // Reset statistics for services with no recent activity
      for (const [_serviceName, bucket] of this.buckets) {
        const timeSinceLastRefill = Date.now() - bucket.lastRefillTime;
        if (timeSinceLastRefill > 300000 && bucket.totalRequests === 0) { // 5 minutes
          bucket.totalRequests = 0;
          bucket.allowedRequests = 0;
          bucket.rejectedRequests = 0;
        }
      }
    }, this.cleanupIntervalMs);
  }

  /**
   * Cleanup and destroy the rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.buckets.clear();
    BackendRateLimiter.instance = null;
    logger.log('Rate limiter destroyed');
  }
}

// Export singleton instance
export const backendRateLimiter = BackendRateLimiter.getInstance();

/**
 * Helper function to check rate limit
 */
export function checkRateLimit(serviceName: string, tokens: number = 1): RateLimitResult {
  return backendRateLimiter.tryConsume(serviceName, tokens);
}

/**
 * Helper function to wait for rate limit
 */
export async function waitForRateLimit(
  serviceName: string,
  tokens: number = 1,
  maxWaitMs: number = 30000
): Promise<boolean> {
  return backendRateLimiter.waitForTokens(serviceName, tokens, maxWaitMs);
}
