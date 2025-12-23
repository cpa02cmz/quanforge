interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface AdaptiveRateLimitEntry {
  requests: number[];
  windowStart: number;
  limit: number;
  windowMs: number;
}

export class RateLimiter {
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private adaptiveRateLimitMap = new Map<string, AdaptiveRateLimitEntry>();
  private edgeRateLimitMap = new Map<string, RateLimitEntry>();

  constructor(private config: {
    maxRequests: number;
    windowMs: number;
    maxPayloadSize: number;
  }) {}

  checkRateLimit(identifier: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const entry = this.rateLimitMap.get(identifier);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return { allowed: true };
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      return { 
        allowed: false, 
        resetTime: entry.resetTime 
      };
    }

    // Increment count
    entry.count++;
    return { allowed: true };
  }

  checkAdaptiveRateLimit(
    identifier: string, 
    userTier: string = 'basic'
  ): { 
    allowed: boolean; 
    resetTime?: number; 
    requestsRemaining: number;
    retryAfter?: number;
  } {
    const now = Date.now();
    
    // Rate limits by user tier
    const tierLimits = {
      basic: { limit: 100, windowMs: 60000 },    // 100 requests/minute
      premium: { limit: 500, windowMs: 60000 },  // 500 requests/minute
      enterprise: { limit: 2000, windowMs: 60000 } // 2000 requests/minute
    };

    const currentTier = userTier as keyof typeof tierLimits;
    const { limit, windowMs } = tierLimits[currentTier] || tierLimits.basic;

    const entry = this.adaptiveRateLimitMap.get(identifier);

    if (!entry || now - entry.windowStart > windowMs) {
      // Create new window
      this.adaptiveRateLimitMap.set(identifier, {
        requests: [now],
        windowStart: now,
        limit,
        windowMs
      });
      return { 
        allowed: true, 
        requestsRemaining: limit - 1 
      };
    }

    // Remove old requests outside window
    const validRequests = entry.requests.filter(time => now - time <= windowMs);
    entry.requests = validRequests;

    if (validRequests.length >= limit) {
      const oldestRequest = Math.min(...validRequests);
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
      
      return {
        allowed: false,
        resetTime: entry.windowStart + windowMs,
        requestsRemaining: 0,
        retryAfter
      };
    }

    // Add current request
    entry.requests.push(now);
    return {
      allowed: true,
      requestsRemaining: limit - entry.requests.length
    };
  }

  checkEdgeRateLimit(
    identifier: string, 
    region: string
  ): { 
    allowed: boolean; 
    resetTime?: number; 
    requestsRemaining: number;
    region: string;
  } {
    const now = Date.now();
    const key = `${identifier}:${region}`;
    const entry = this.edgeRateLimitMap.get(key);

    // Edge-specific rate limits (usually stricter)
    const edgeMaxRequests = Math.floor(this.config.maxRequests * 0.7); // 70% of normal limit
    const edgeWindowMs = this.config.windowMs;

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired
      this.edgeRateLimitMap.set(key, {
        count: 1,
        resetTime: now + edgeWindowMs
      });
      return { 
        allowed: true, 
        requestsRemaining: edgeMaxRequests - 1,
        region 
      };
    }

    // Check if limit exceeded
    if (entry.count >= edgeMaxRequests) {
      return { 
        allowed: false, 
        resetTime: entry.resetTime,
        requestsRemaining: 0,
        region
      };
    }

    // Increment count
    entry.count++;
    return { 
      allowed: true, 
      requestsRemaining: edgeMaxRequests - entry.count,
      region 
    };
  }

  // Advanced rate limiting with request coalescing
  checkCoalescedRateLimit(
    identifier: string, 
    requestType: string,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): { 
    allowed: boolean; 
    queuePosition?: number;
    estimatedDelay?: number;
  } {
    const now = Date.now();
    const key = `${identifier}:${requestType}`;
    const entry = this.rateLimitMap.get(key);

    // Adjust limits based on priority
    const priorityMultipliers = {
      low: 0.5,
      normal: 1.0,
      high: 2.0
    };

    const adjustedLimit = Math.floor(
      this.config.maxRequests * priorityMultipliers[priority]
    );

    if (!entry || now > entry.resetTime) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return { allowed: true };
    }

    if (entry.count >= adjustedLimit) {
      // Calculate queue position and estimated delay
      const queuePosition = entry.count - adjustedLimit + 1;
      const estimatedDelay = this.config.windowMs / adjustedLimit * queuePosition;
      
      return {
        allowed: false,
        queuePosition,
        estimatedDelay: Math.ceil(estimatedDelay / 1000)
      };
    }

    entry.count++;
    return { allowed: true };
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    
    // Clean basic rate limits
    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }

    // Clean adaptive rate limits
    for (const [key, entry] of this.adaptiveRateLimitMap.entries()) {
      if (now - entry.windowStart > entry.windowMs) {
        this.adaptiveRateLimitMap.delete(key);
      }
    }

    // Clean edge rate limits
    for (const [key, entry] of this.edgeRateLimitMap.entries()) {
      if (now > entry.resetTime) {
        this.edgeRateLimitMap.delete(key);
      }
    }
  }

  // Get rate limit statistics
  getStats(): {
    activeLimits: number;
    totalRequests: number;
    averageRequestsPerWindow: number;
  } {
    const now = Date.now();
    let totalRequests = 0;
    let activeWindows = 0;

    for (const entry of this.rateLimitMap.values()) {
      if (now <= entry.resetTime) {
        totalRequests += entry.count;
        activeWindows++;
      }
    }

    return {
      activeLimits: this.rateLimitMap.size,
      totalRequests,
      averageRequestsPerWindow: activeWindows > 0 ? totalRequests / activeWindows : 0
    };
  }

  // Reset specific identifier's rate limit (admin function)
  resetRateLimit(identifier: string): void {
    this.rateLimitMap.delete(identifier);
    this.adaptiveRateLimitMap.delete(identifier);
    
    // Reset all edge regions for this identifier
    for (const [key] of this.edgeRateLimitMap.entries()) {
      if (key.startsWith(`${identifier}:`)) {
        this.edgeRateLimitMap.delete(key);
      }
    }
  }
}