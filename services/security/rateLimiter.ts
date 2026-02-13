import { RATE_LIMITING } from '../../constants/config';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface AdaptiveLimits {
  windowMs: number;
  maxRequests: number;
}

/**
 * Default rate limit configuration using centralized constants
 * Flexy loves modularity - no more hardcoded values!
 */
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: RATE_LIMITING.DEFAULT_WINDOW, // 1 minute
  maxRequests: RATE_LIMITING.DEFAULT_MAX_REQUESTS, // 10 requests
};

/**
 * Tier-based adaptive rate limits using centralized constants
 */
const TIER_ADAPTIVE_LIMITS: Record<string, AdaptiveLimits> = {
  basic: { 
    windowMs: RATE_LIMITING.TIERS.FREE.WINDOW, 
    maxRequests: RATE_LIMITING.TIERS.FREE.MAX_REQUESTS 
  },
  premium: { 
    windowMs: RATE_LIMITING.TIERS.PRO.WINDOW, 
    maxRequests: RATE_LIMITING.TIERS.PRO.MAX_REQUESTS 
  },
  enterprise: { 
    windowMs: RATE_LIMITING.TIERS.ENTERPRISE.WINDOW, 
    maxRequests: RATE_LIMITING.TIERS.ENTERPRISE.MAX_REQUESTS 
  }
};

export class RateLimiter {
  private rateLimitMap = new Map<string, RateLimitRecord>();
  private config: RateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG };

  // Basic rate limiting
  checkRateLimit(identifier: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    if (!record || now > record.resetTime) {
      // First request or window reset
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return { allowed: true };
    }

    // Increment counter
    record.count++;

    // Check limit
    if (record.count >= this.config.maxRequests) {
      return {
        allowed: false,
        resetTime: record.resetTime
      };
    }

    return { allowed: true };
  }

  // Adaptive rate limiting based on user tier
  checkAdaptiveRateLimit(
    identifier: string, 
    userTier: string = 'basic'
  ): { 
    allowed: boolean; 
    resetTime?: number;
    currentCount: number;
    limit: number;
  } {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    // Tier-based limits - using centralized constants
    const tierLimits = TIER_ADAPTIVE_LIMITS[userTier] || TIER_ADAPTIVE_LIMITS['basic'];

    if (!tierLimits) {
      return { allowed: true, resetTime: 0, currentCount: 0, limit: 0 };
    }

    if (!record || now > record.resetTime) {
      // First request or window reset
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + tierLimits.windowMs
      });
      return {
        allowed: true,
        currentCount: 1,
        limit: tierLimits.maxRequests
      };
    }

    // Increment counter
    record.count++;

    // Check limit
    const allowed = record.count < tierLimits.maxRequests;
    return {
      allowed,
      resetTime: allowed ? undefined : record.resetTime,
      currentCount: record.count,
      limit: tierLimits.maxRequests
    };
  }

  // Reset rate limit for specific identifier
  resetRateLimit(identifier: string): void {
    this.rateLimitMap.delete(identifier);
  }

  // Get current rate limit status
  getRateLimitStatus(identifier: string): {
    currentCount: number;
    limit: number;
    resetTime: number;
    timeRemaining: number;
  } | null {
    const record = this.rateLimitMap.get(identifier);
    if (!record) return null;

    const now = Date.now();
    const timeRemaining = Math.max(0, record.resetTime - now);

    return {
      currentCount: record.count,
      limit: this.config.maxRequests,
      resetTime: record.resetTime,
      timeRemaining
    };
  }

  // Clean up expired entries
  cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, record] of this.rateLimitMap.entries()) {
      if (now > record.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  // Get total active rate limits
  getActiveLimitsCount(): number {
    return this.rateLimitMap.size;
  }

  // Update configuration
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}