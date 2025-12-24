interface RateLimitConfig {
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  edgeRateLimiting: {
    enabled: boolean;
    requestsPerSecond: number;
    burstLimit: number;
  };
}

interface RateLimitResult {
  allowed: boolean;
  resetTime?: number;
  remainingRequests?: number;
  resetIn?: number;
  retryAfter?: number;
}

interface EdgeRateLimitResult extends RateLimitResult {
  burstTokens?: number;
  regionQuota?: {
    used: number;
    limit: number;
  };
}

interface RateLimitStats {
  activeEntries: number;
  blockedRequests: number;
  averageUsage: number;
  peakUsage: number;
  tierDistribution: Record<string, number>;
}

export class RateLimitingService {
  private static instance: RateLimitingService;
  private config: RateLimitConfig;
  private rateLimitMap = new Map<string, { count: number; resetTime: number; burstTokens?: number }>();
  private userTierMap = new Map<string, string>();

  private constructor() {
    this.config = {
      rateLimiting: {
        windowMs: 60000, // 1 minute
        maxRequests: 100,
      },
      edgeRateLimiting: {
        enabled: true,
        requestsPerSecond: 10,
        burstLimit: 20
      }
    };

    // Cleanup expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  static getInstance(): RateLimitingService {
    if (!RateLimitingService.instance) {
      RateLimitingService.instance = new RateLimitingService();
    }
    return RateLimitingService.instance;
  }

  // Basic rate limiting
  checkRateLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    if (!record || now > record.resetTime) {
      // New window
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.config.rateLimiting.windowMs,
      });
      return { allowed: true };
    }

    record.count++;

    if (record.count >= this.config.rateLimiting.maxRequests) {
      return {
        allowed: false,
        resetTime: record.resetTime,
        resetIn: Math.ceil((record.resetTime - now) / 1000),
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      };
    }

    return {
      allowed: true,
      remainingRequests: this.config.rateLimiting.maxRequests - record.count,
      resetIn: Math.ceil((record.resetTime - now) / 1000)
    };
  }

  // Enhanced adaptive rate limiting with user tiers
  checkAdaptiveRateLimit(identifier: string, userTier: string = 'basic'): RateLimitResult {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    // Update user tier
    this.userTierMap.set(identifier, userTier);

    // Adaptive limits based on user tier
    const tierLimits = {
      basic: { maxRequests: 100, windowMs: 60000 },
      premium: { maxRequests: 500, windowMs: 60000 },
      enterprise: { maxRequests: 2000, windowMs: 60000 }
    };

    const limits = tierLimits[userTier as keyof typeof tierLimits] || tierLimits.basic;

    if (!record || now > record.resetTime) {
      // New window
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + limits.windowMs,
      });
      return { 
        allowed: true,
        remainingRequests: limits.maxRequests - 1
      };
    }

    record.count++;

    if (record.count >= limits.maxRequests) {
      return {
        allowed: false,
        resetTime: record.resetTime,
        resetIn: Math.ceil((record.resetTime - now) / 1000),
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      };
    }

    return {
      allowed: true,
      remainingRequests: limits.maxRequests - record.count,
      resetIn: Math.ceil((record.resetTime - now) / 1000)
    };
  }

  // Edge-specific rate limiting with burst handling
  checkEdgeRateLimit(identifier: string, region: string = 'global'): EdgeRateLimitResult {
    if (!this.config.edgeRateLimiting.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    const key = `${identifier}:${region}`;
    const record = this.rateLimitMap.get(key);
    const requestsPerSecond = this.config.edgeRateLimiting.requestsPerSecond;
    const burstLimit = this.config.edgeRateLimiting.burstLimit;

    // Simple sliding window implementation
    if (!record) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + 1000, // 1 second window
        burstTokens: burstLimit - 1
      });
      return {
        allowed: true,
        burstTokens: burstLimit - 1
      };
    }

    // Reset if window expired
    if (now > record.resetTime) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + 1000,
        burstTokens: burstLimit - 1
      });
      return {
        allowed: true,
        burstTokens: burstLimit - 1
      };
    }

    const tokens = record.burstTokens || burstLimit;
    
    // Check if we have burst tokens available
    if (tokens > 0) {
      this.rateLimitMap.set(key, {
        ...record,
        count: record.count + 1,
        burstTokens: tokens - 1
      });
      return {
        allowed: true,
        burstTokens: tokens - 1,
        regionQuota: {
          used: record.count + 1,
          limit: requestsPerSecond
        }
      };
    }

    // Check rate limit
    if (record.count >= requestsPerSecond) {
      return {
        allowed: false,
        resetIn: Math.ceil((record.resetTime - now) / 1000),
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
        burstTokens: 0,
        regionQuota: {
          used: record.count,
          limit: requestsPerSecond
        }
      };
    }

    this.rateLimitMap.set(key, {
      ...record,
      count: record.count + 1,
      burstTokens: tokens - 1
    });

    return {
      allowed: true,
      burstTokens: tokens - 1,
      regionQuota: {
        used: record.count + 1,
        limit: requestsPerSecond
      }
    };
  }

  // Get global rate limit metrics
  getRateLimitMetrics(): RateLimitStats {
    const now = Date.now();
    const rateLimitEntries = Array.from(this.rateLimitMap.entries());
    const blockedRequests = rateLimitEntries.reduce((sum, [key, record]) => {
      const identifier = key.split(':')[0]; // Extract identifier from edge key
      const tier = this.userTierMap.get(identifier!) || 'basic';
      const tierLimits = {
        basic: { maxRequests: 100 },
        premium: { maxRequests: 500 },
        enterprise: { maxRequests: 2000 }
      };
      const limit = tierLimits[tier as keyof typeof tierLimits].maxRequests;
      return sum + Math.max(0, record.count - limit);
    }, 0);

    const allCounts = rateLimitEntries.map(([_, record]) => record.count);
    const activeEntries = rateLimitEntries.filter(([_, record]) => now <= record.resetTime).length;

    return {
      activeEntries,
      blockedRequests,
      averageUsage: allCounts.length > 0 ? allCounts.reduce((a, b) => a + b, 0) / allCounts.length : 0,
      peakUsage: allCounts.length > 0 ? Math.max(...allCounts) : 0,
      tierDistribution: this.getTierDistribution()
    };
  }

  // Check if identifier is currently rate limited
  isRateLimited(identifier: string): boolean {
    const record = this.rateLimitMap.get(identifier);
    if (!record) return false;

    const now = Date.now();
    if (now > record.resetTime) return false;

    const userTier = this.userTierMap.get(identifier) || 'basic';
    const tierLimits = {
      basic: { maxRequests: 100 },
      premium: { maxRequests: 500 },
      enterprise: { maxRequests: 2000 }
    };
    const limit = tierLimits[userTier as keyof typeof tierLimits].maxRequests;

    return record.count >= limit;
  }

  // Reset rate limit for specific identifier (admin function)
  resetRateLimit(identifier: string): boolean {
    return this.rateLimitMap.delete(identifier);
  }

  // Set custom rate limit for identifier (admin function)
  setCustomRateLimit(identifier: string, _maxRequests: number, windowMs: number): void {
    const now = Date.now();
    this.rateLimitMap.set(identifier, {
      count: 0,
      resetTime: now + windowMs
    });
  }

  // Get remaining requests for identifier
  getRemainingRequests(identifier: string): number {
    const record = this.rateLimitMap.get(identifier);
    if (!record) return this.config.rateLimiting.maxRequests;

    const now = Date.now();
    if (now > record.resetTime) return this.config.rateLimiting.maxRequests;

    const userTier = this.userTierMap.get(identifier) || 'basic';
    const tierLimits = {
      basic: { maxRequests: 100 },
      premium: { maxRequests: 500 },
      enterprise: { maxRequests: 2000 }
    };
    const limit = tierLimits[userTier as keyof typeof tierLimits].maxRequests;

    return Math.max(0, limit - record.count);
  }

  // Get time until rate limit reset
  getTimeUntilReset(identifier: string): number {
    const record = this.rateLimitMap.get(identifier);
    if (!record) return 0;

    const now = Date.now();
    return Math.max(0, Math.ceil((record.resetTime - now) / 1000));
  }

  // Update configuration
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current configuration
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  private getTierDistribution(): Record<string, number> {
    const distribution: Record<string, number> = { basic: 0, premium: 0, enterprise: 0 };
    
    this.userTierMap.forEach(tier => {
      if (tier && tier in distribution) {
        const currentValue = distribution[tier as keyof typeof distribution];
        if (typeof currentValue === 'number') {
          distribution[tier as keyof typeof distribution] = currentValue + 1;
        }
      }
    });

    return distribution;
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.rateLimitMap.forEach((record, key) => {
      if (now > record.resetTime) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.rateLimitMap.delete(key);
    });
  }
}