/**
 * Enhanced Rate Limiter with advanced security features
 * Implements token bucket algorithm with IP-based tracking
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
  blocked: boolean;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

class EnhancedRateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = {
      ...config
    };

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a request should be rate limited
   */
  async checkLimit(clientId: string): Promise<{ 
    allowed: boolean; 
    remaining: number; 
    resetTime: number;
    retryAfter?: number;
  }> {
    const now = Date.now();
    const entry = this.limits.get(clientId) || {
      count: 0,
      resetTime: now + this.config.windowMs,
      lastAccess: now,
      blocked: false
    };

    // Check if client is currently blocked
    if (entry.blocked && now < entry.resetTime) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      };
    }

    // Reset window if expired
    if (now >= entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + this.config.windowMs;
      entry.blocked = false;
    }

    // Check limit
    if (entry.count >= this.config.maxRequests) {
      entry.blocked = true;
      entry.resetTime = now + this.config.blockDurationMs;
      this.limits.set(clientId, entry);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil(this.config.blockDurationMs / 1000)
      };
    }

    // Increment counter
    entry.count++;
    entry.lastAccess = now;
    this.limits.set(clientId, entry);

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  /**
   * Get client ID from request with enhanced security
   */
  static getClientId(request: Request): string {
    // Try multiple sources for client identification
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
    const xClientIp = request.headers.get('x-client-ip');
    
    let ip = 'unknown';
    
    if (forwardedFor) {
      ip = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ip = realIp.trim();
    } else if (cfConnectingIp) {
      ip = cfConnectingIp.trim();
    } else if (xClientIp) {
      ip = xClientIp.trim();
    }

    // Simple hash for privacy (fallback for environments without digestSync)
    const data = ip + (process.env.RATE_LIMIT_SECRET || 'default-secret');
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash)}`;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.limits.entries()) {
      // Remove entries that haven't been accessed for 10 minutes
      if (now - entry.lastAccess > 10 * 60 * 1000) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.limits.delete(key));
  }

  /**
   * Get statistics
   */
  getStats(): { totalClients: number; blockedClients: number } {
    const now = Date.now();
    let blockedClients = 0;
    
    for (const entry of this.limits.values()) {
      if (entry.blocked && now < entry.resetTime) {
        blockedClients++;
      }
    }
    
    return {
      totalClients: this.limits.size,
      blockedClients
    };
  }

  /**
   * Destroy the rate limiter and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.limits.clear();
  }
}

// Predefined rate limit configurations
export const RATE_LIMIT_CONFIGS = {
  // API endpoints - strict limits
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    blockDurationMs: 5 * 60 * 1000, // 5 minutes
  },
  
  // AI generation - very strict limits
  ai: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    blockDurationMs: 15 * 60 * 1000, // 15 minutes
  },
  
  // Authentication - moderate limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  },
  
  // General endpoints - lenient limits
  general: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    blockDurationMs: 2 * 60 * 1000, // 2 minutes
  }
};

// Create rate limiter instances
export const apiRateLimiter = new EnhancedRateLimiter(RATE_LIMIT_CONFIGS.api);
export const aiRateLimiter = new EnhancedRateLimiter(RATE_LIMIT_CONFIGS.ai);
export const authRateLimiter = new EnhancedRateLimiter(RATE_LIMIT_CONFIGS.auth);
export const generalRateLimiter = new EnhancedRateLimiter(RATE_LIMIT_CONFIGS.general);

export default EnhancedRateLimiter;