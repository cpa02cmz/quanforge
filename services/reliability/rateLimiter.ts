/**
 * Rate Limiter
 * 
 * Token bucket rate limiting for API calls and service operations.
 * Prevents overwhelming downstream services and ensures fair resource allocation.
 * 
 * Features:
 * - Token bucket algorithm with configurable rates
 * - Per-service rate limiting
 * - Burst handling with bucket capacity
 * - Automatic refill based on rate
 * - Queue management for pending requests
 * 
 * @module services/reliability/rateLimiter
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('rate-limiter');

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Tokens added per second (rate) */
  tokensPerSecond: number;
  /** Maximum tokens in bucket (burst capacity) */
  maxTokens: number;
  /** Initial tokens in bucket */
  initialTokens?: number;
  /** Maximum wait time for token (ms) - 0 means no wait */
  maxWaitTime?: number;
  /** Enable queue for pending requests */
  enableQueue?: boolean;
  /** Maximum queue size */
  maxQueueSize?: number;
}

/**
 * Rate limiter status
 */
export interface RateLimiterStatus {
  name: string;
  availableTokens: number;
  maxTokens: number;
  tokensPerSecond: number;
  queueSize: number;
  totalRequests: number;
  allowedRequests: number;
  rejectedRequests: number;
  queuedRequests: number;
  isThrottled: boolean;
}

/**
 * Queued request
 */
interface QueuedRequest {
  resolve: (value: boolean) => void;
  reject: (reason: Error) => void;
  timestamp: number;
}

/**
 * Token Bucket Rate Limiter
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private queue: QueuedRequest[] = [];
  private totalRequests = 0;
  private allowedRequests = 0;
  private rejectedRequests = 0;
  private queuedRequests = 0;
  private refillInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly name: string,
    private readonly config: RateLimiterConfig
  ) {
    this.tokens = config.initialTokens ?? config.maxTokens;
    this.lastRefill = Date.now();

    // Start refill interval (every 100ms for smooth refilling)
    this.startRefill();
  }

  /**
   * Start token refill interval
   */
  private startRefill(): void {
    if (this.refillInterval) return;

    const refillRate = 100; // Refill every 100ms
    const tokensPerRefill = (this.config.tokensPerSecond * refillRate) / 1000;

    this.refillInterval = setInterval(() => {
      this.refill(tokensPerRefill);
    }, refillRate);
  }

  /**
   * Refill tokens
   */
  private refill(tokensToAdd: number): void {
    this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = Date.now();

    // Process queued requests if tokens available
    this.processQueue();
  }

  /**
   * Try to consume a token
   */
  tryConsume(tokens: number = 1): boolean {
    this.totalRequests++;

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      this.allowedRequests++;
      return true;
    }

    this.rejectedRequests++;
    return false;
  }

  /**
   * Consume a token, waiting if necessary
   */
  async consume(tokens: number = 1): Promise<boolean> {
    this.totalRequests++;

    // Try immediate consumption
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      this.allowedRequests++;
      return true;
    }

    // Check if queueing is enabled
    if (!this.config.enableQueue) {
      this.rejectedRequests++;
      return false;
    }

    // Check queue size limit
    if (this.config.maxQueueSize && this.queue.length >= this.config.maxQueueSize) {
      this.rejectedRequests++;
      logger.warn(`Rate limiter '${this.name}' queue full, request rejected`);
      return false;
    }

    // Queue the request
    return new Promise<boolean>((resolve, reject) => {
      const request: QueuedRequest = {
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.queue.push(request);
      this.queuedRequests++;

      // Set max wait timeout
      if (this.config.maxWaitTime && this.config.maxWaitTime > 0) {
        setTimeout(() => {
          const index = this.queue.indexOf(request);
          if (index !== -1) {
            this.queue.splice(index, 1);
            this.rejectedRequests++;
            reject(new Error(`Rate limit wait timeout for '${this.name}'`));
          }
        }, this.config.maxWaitTime);
      }
    });
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.tokens >= 1) {
      const request = this.queue.shift();
      if (request) {
        this.tokens -= 1;
        this.allowedRequests++;
        request.resolve(true);
      }
    }
  }

  /**
   * Get current status
   */
  getStatus(): RateLimiterStatus {
    return {
      name: this.name,
      availableTokens: this.tokens,
      maxTokens: this.config.maxTokens,
      tokensPerSecond: this.config.tokensPerSecond,
      queueSize: this.queue.length,
      totalRequests: this.totalRequests,
      allowedRequests: this.allowedRequests,
      rejectedRequests: this.rejectedRequests,
      queuedRequests: this.queuedRequests,
      isThrottled: this.tokens < this.config.maxTokens * 0.1
    };
  }

  /**
   * Check if rate limited
   */
  isRateLimited(): boolean {
    return this.tokens < 1;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.tokens = this.config.maxTokens;
    this.queue.forEach(request => {
      request.reject(new Error('Rate limiter reset'));
    });
    this.queue = [];
    this.totalRequests = 0;
    this.allowedRequests = 0;
    this.rejectedRequests = 0;
    this.queuedRequests = 0;
    logger.info(`Rate limiter '${this.name}' reset`);
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
      this.refillInterval = null;
    }
    this.queue.forEach(request => {
      request.reject(new Error('Rate limiter destroyed'));
    });
    this.queue = [];
    logger.info(`Rate limiter '${this.name}' destroyed`);
  }
}

/**
 * Rate Limiter Manager
 * 
 * Manages multiple rate limiters for different services
 */
export class RateLimiterManager {
  private limiters = new Map<string, TokenBucket>();
  private static instance: RateLimiterManager | null = null;

  private constructor() {
    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RateLimiterManager {
    if (!RateLimiterManager.instance) {
      RateLimiterManager.instance = new RateLimiterManager();
    }
    return RateLimiterManager.instance;
  }

  /**
   * Register a rate limiter
   */
  register(name: string, config: RateLimiterConfig): TokenBucket {
    if (this.limiters.has(name)) {
      logger.warn(`Rate limiter '${name}' already exists, replacing`);
      this.limiters.get(name)?.destroy();
    }

    const limiter = new TokenBucket(name, config);
    this.limiters.set(name, limiter);
    logger.info(`Rate limiter '${name}' registered (${config.tokensPerSecond} tokens/s, max ${config.maxTokens})`);

    return limiter;
  }

  /**
   * Get a rate limiter by name
   */
  get(name: string): TokenBucket | undefined {
    return this.limiters.get(name);
  }

  /**
   * Check if rate limiter exists
   */
  has(name: string): boolean {
    return this.limiters.has(name);
  }

  /**
   * Remove a rate limiter
   */
  remove(name: string): boolean {
    const limiter = this.limiters.get(name);
    if (limiter) {
      limiter.destroy();
      this.limiters.delete(name);
      logger.info(`Rate limiter '${name}' removed`);
      return true;
    }
    return false;
  }

  /**
   * Try to consume a token from a rate limiter
   */
  tryConsume(name: string, tokens: number = 1): boolean {
    const limiter = this.limiters.get(name);
    if (!limiter) {
      logger.warn(`Rate limiter '${name}' not found, allowing request`);
      return true;
    }
    return limiter.tryConsume(tokens);
  }

  /**
   * Consume a token, waiting if necessary
   */
  async consume(name: string, tokens: number = 1): Promise<boolean> {
    const limiter = this.limiters.get(name);
    if (!limiter) {
      logger.warn(`Rate limiter '${name}' not found, allowing request`);
      return true;
    }
    return limiter.consume(tokens);
  }

  /**
   * Check if a service is rate limited
   */
  isRateLimited(name: string): boolean {
    const limiter = this.limiters.get(name);
    return limiter ? limiter.isRateLimited() : false;
  }

  /**
   * Get all rate limiter statuses
   */
  getAllStatuses(): RateLimiterStatus[] {
    return Array.from(this.limiters.values()).map(limiter => limiter.getStatus());
  }

  /**
   * Get rate limiters that are currently throttling
   */
  getThrottledLimiters(): RateLimiterStatus[] {
    return this.getAllStatuses().filter(status => status.isThrottled);
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    this.limiters.forEach(limiter => limiter.reset());
    logger.info('All rate limiters reset');
  }

  /**
   * Destroy all rate limiters
   */
  destroy(): void {
    this.limiters.forEach(limiter => limiter.destroy());
    this.limiters.clear();
    RateLimiterManager.instance = null;
    logger.info('Rate limiter manager destroyed');
  }
}

// Export singleton instance
export const rateLimiterManager = RateLimiterManager.getInstance();

/**
 * Default rate limiter configurations
 */
export const DEFAULT_RATE_LIMITER_CONFIGS: Record<string, RateLimiterConfig> = {
  // AI API rate limiting
  ai_service: {
    tokensPerSecond: 10,    // 10 requests per second
    maxTokens: 20,          // Allow burst of 20 requests
    maxWaitTime: 30000,     // Wait up to 30 seconds
    enableQueue: true,
    maxQueueSize: 50
  },

  // Database rate limiting
  database: {
    tokensPerSecond: 50,    // 50 queries per second
    maxTokens: 100,         // Allow burst of 100 queries
    maxWaitTime: 5000,      // Wait up to 5 seconds
    enableQueue: true,
    maxQueueSize: 200
  },

  // External API rate limiting
  external_api: {
    tokensPerSecond: 5,     // 5 requests per second
    maxTokens: 10,          // Allow burst of 10 requests
    maxWaitTime: 10000,     // Wait up to 10 seconds
    enableQueue: true,
    maxQueueSize: 20
  },

  // Cache rate limiting
  cache: {
    tokensPerSecond: 100,   // 100 operations per second
    maxTokens: 200,         // Allow burst of 200 operations
    maxWaitTime: 100,       // Very short wait (cache should be fast)
    enableQueue: false      // No queue for cache
  },

  // Auth rate limiting (prevent brute force)
  auth: {
    tokensPerSecond: 1,     // 1 request per second
    maxTokens: 5,           // Allow burst of 5 requests
    maxWaitTime: 0,         // No wait, reject immediately
    enableQueue: false
  }
};

/**
 * Helper function to wrap a function with rate limiting
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  limiterName: string,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    const allowed = await rateLimiterManager.consume(limiterName);
    if (!allowed) {
      throw new Error(`Rate limit exceeded for '${limiterName}'`);
    }
    return fn(...args);
  }) as T;
}

/**
 * Helper function to register default rate limiters
 */
export function registerDefaultRateLimiters(): void {
  Object.entries(DEFAULT_RATE_LIMITER_CONFIGS).forEach(([name, config]) => {
    rateLimiterManager.register(name, config);
  });

  logger.info('Default rate limiters registered');
}
