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

export class RateLimiter {
  private rateLimitMap = new Map<string, RateLimitRecord>();
  private config: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
  };

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

    // Tier-based limits
    const limits: Record<string, AdaptiveLimits> = {
      basic: { windowMs: 60000, maxRequests: 30 },
      premium: { windowMs: 60000, maxRequests: 100 },
      enterprise: { windowMs: 60000, maxRequests: 500 }
    };

    const tierLimits = limits[userTier] || limits.basic;

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