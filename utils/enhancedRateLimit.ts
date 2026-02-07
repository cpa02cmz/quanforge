// Synchronous hash using a simple algorithm for browser compatibility
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash).toString(16).padStart(32, '0').substring(0, 32);
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
}

export class EnhancedRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;
  
  constructor(private config: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 30,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  }) {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private generateKey(identifier: string): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(identifier);
    }
    
    // Create a hash to prevent key collisions and ensure consistency
    const hash = simpleHash(identifier);
    return `rate_limit_${hash.substring(0, 16)}`;
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.store.entries()) {
      // Remove entries that haven't been accessed for 10 minutes
      if (now - entry.lastAccess > 10 * 60 * 1000) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.store.delete(key));
  }

  /**
   * Check if a request is allowed and update the rate limit counter
   * @param identifier - Unique identifier (userId, IP, etc.)
   * @param options - Optional override settings
   * @returns Object with allowed status and rate limit info
   */
  public checkLimit(
    identifier: string, 
    options: Partial<RateLimitConfig> = {}
  ): { allowed: boolean; remaining: number; resetTime: number; retryAfter?: number } {
    const key = this.generateKey(identifier);
    const now = Date.now();
    
    // Get or create entry
    let entry = this.store.get(key);
    
    if (!entry || now > entry.resetTime) {
      // New window
      entry = {
        count: 0,
        resetTime: now + (options.windowMs || this.config.windowMs),
        lastAccess: now
      };
      this.store.set(key, entry);
    }
    
    // Update last access
    entry.lastAccess = now;
    
    // Check if limit exceeded
    const maxRequests = options.maxRequests || this.config.maxRequests;
    const allowed = entry.count < maxRequests;
    
    // Increment counter if allowed
    if (allowed) {
      entry.count++;
    }
    
    return {
      allowed,
      remaining: Math.max(0, maxRequests - entry.count),
      resetTime: entry.resetTime,
      retryAfter: allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000)
    };
  }

  /**
   * Get current rate limit status without consuming a request
   */
  public getStatus(identifier: string): RateLimitEntry | null {
    const key = this.generateKey(identifier);
    const entry = this.store.get(key);
    
    if (entry) {
      // Update last access for status check
      entry.lastAccess = Date.now();
    }
    
    return entry || null;
  }

  /**
   * Reset rate limit for a specific identifier
   */
  public reset(identifier: string): void {
    const key = this.generateKey(identifier);
    this.store.delete(key);
  }

  /**
   * Get statistics for monitoring
   */
  public getStats(): {
    totalEntries: number;
    activeLastMinute: number;
    entriesByCount: Array<{ count: number; identifiers: number }>;
  } {
    const now = Date.now();
    const totalEntries = this.store.size;
    let activeLastMinute = 0;
    const countDistribution = new Map<number, number>();
    
    for (const entry of this.store.values()) {
      if (now - entry.lastAccess < 60000) {
        activeLastMinute++;
      }
      
      const count = Math.floor(entry.count / 10) * 10; // Group by 10s
      countDistribution.set(count, (countDistribution.get(count) || 0) + 1);
    }
    
    const entriesByCount = Array.from(countDistribution.entries())
      .map(([count, identifiers]) => ({ count, identifiers }))
      .sort((a, b) => b.count - a.count);
    
    return {
      totalEntries,
      activeLastMinute,
      entriesByCount
    };
  }

  /**
   * Cleanup and destroy the rate limiter
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }

  /**
   * Validate rate limit configuration
   */
  public validateConfig(config: RateLimitConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.windowMs || config.windowMs < 1000) {
      errors.push('windowMs must be at least 1000ms');
    }
    
    if (!config.maxRequests || config.maxRequests < 1) {
      errors.push('maxRequests must be at least 1');
    }
    
    if (config.maxRequests > 1000) {
      errors.push('maxRequests should not exceed 1000 for performance');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Singleton instance for the application
let globalRateLimiter: EnhancedRateLimiter;

export function getRateLimiter(): EnhancedRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new EnhancedRateLimiter();
  }
  return globalRateLimiter;
}

// User-specific rate limiter for AI requests
export function getAIRateLimiter(): EnhancedRateLimiter {
  return new EnhancedRateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 10, // 10 AI requests per minute
    keyGenerator: (identifier: string) => {
      const hash = simpleHash(`ai_${identifier}`);
      return `ai_request_${hash.substring(0, 16)}`;
    }
  });
}