/**
 * Rate Limiter Service - Advanced Rate Limiting and Request Management
 * 
 * Handles rate limiting, burst control, and request throttling across multiple users
 */

import { IRateLimiter, RateLimitConfig } from '../../types/serviceInterfaces';
import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('RateLimiter');

export interface RateLimitInfo {
  identifier: string;
  requests: number;
  windowStart: number;
  resetTime: number;
  lastRequest: number;
  isInBurst: boolean;
  burstCount: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  reason?: string;
}

export class RateLimiter implements IRateLimiter {
  
  // Alias method to match interface name
  async checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const result = await this.checkRateLimit(identifier);
    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetTime: result.resetTime,
    };
  }
  private config!: RateLimitConfig;
  private limits = new Map<string, RateLimitInfo>();
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private stats = {
    totalRequests: 0,
    blockedRequests: 0,
    activeUsers: 0,
    cleanupRuns: 0,
  };

  async initialize(): Promise<void> {
    this.config = {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    };

    // Start cleanup timer
    this.startCleanupTimer();
    
    logger.info('Rate Limiter initialized');
  }

  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.limits.clear();
    logger.info('Rate Limiter destroyed');
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test rate limiting with a test identifier
      const testResult = await this.checkRateLimit('health-check-test');
      return testResult.allowed;
    } catch (error) {
      logger.error('Rate Limiter health check failed:', error);
      return false;
    }
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Rate Limiter configuration updated', this.config);
  }

  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  async checkRateLimit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    this.stats.totalRequests++;

    try {
      // Get or create rate limit info
      let info = this.limits.get(identifier);
      
      if (!info) {
        info = this.createRateLimitInfo(identifier, now);
        this.limits.set(identifier, info);
        this.stats.activeUsers = this.limits.size;
      }

      // Check if window has expired
      if (now - info.windowStart >= this.config.windowMs) {
        this.resetWindow(info, now);
      }

      // Calculate remaining requests
      const remaining = Math.max(0, this.config.maxRequests - info.requests);
      
      // Check if request is allowed
      if (info.requests >= this.config.maxRequests) {
        this.stats.blockedRequests++;
        const retryAfter = Math.ceil((info.resetTime - now) / 1000);
        
        return {
          allowed: false,
          remaining: 0,
          resetTime: info.resetTime,
          retryAfter,
          reason: 'Rate limit exceeded',
        };
      }

      // Allow request
      info.requests++;
      info.lastRequest = now;
      
      logger.debug(`Rate limit check for ${identifier}: ${remaining - 1} remaining`);
      
      return {
        allowed: true,
        remaining: remaining - 1,
        resetTime: info.resetTime,
      };
    } catch (error) {
      logger.error(`Rate limit check failed for ${identifier}:`, error);
      // On error, allow request to prevent blocking legitimate traffic
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: Date.now() + this.config.windowMs,
        reason: 'Rate limiter error - allowing by default',
      };
    }
  }

  async resetLimit(identifier: string): Promise<void> {
    const info = this.limits.get(identifier);
    if (info) {
      const now = Date.now();
      this.resetWindow(info, now);
      logger.info(`Rate limit reset for ${identifier}`);
    }
  }

  getLimitStats(identifier: string): { used: number; remaining: number; resetTime: number } {
    const info = this.limits.get(identifier);
    
    if (!info) {
      return {
        used: 0,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs,
      };
    }

    const now = Date.now();
    
    // Check if window has expired
    if (now - info.windowStart >= this.config.windowMs) {
      return {
        used: 0,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
      };
    }

    return {
      used: info.requests,
      remaining: Math.max(0, this.config.maxRequests - info.requests),
      resetTime: info.resetTime,
    };
  }

  // Private helper methods

  private createRateLimitInfo(identifier: string, now: number): RateLimitInfo {
    return {
      identifier,
      requests: 0,
      windowStart: now,
      resetTime: now + this.config.windowMs,
      lastRequest: now,
      isInBurst: false,
      burstCount: 0,
    };
  }

  private resetWindow(info: RateLimitInfo, now: number): void {
    info.requests = 0;
    info.windowStart = now;
    info.resetTime = now + this.config.windowMs;
    info.isInBurst = false;
    info.burstCount = 0;
  }

  private startCleanupTimer(): void {
    // Run cleanup every few minutes
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000); // 5 minutes
  }

  private performCleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    // Find expired entries
    for (const [key, info] of this.limits.entries()) {
      const timeSinceLastRequest = now - info.lastRequest;
      
      // Remove entries that haven't been active for an hour
      if (timeSinceLastRequest > 60 * 60 * 1000) {
        expiredKeys.push(key);
      }
    }
    
    // Remove expired entries
    for (const key of expiredKeys) {
      this.limits.delete(key);
    }
    
    this.stats.cleanupRuns++;
    this.stats.activeUsers = this.limits.size;
    
    if (expiredKeys.length > 0) {
      logger.info(`Cleaned up ${expiredKeys.length} expired rate limit entries`);
    }
  }

  // Advanced rate limiting features

  async checkBurstRateLimit(identifier: string, burstSize: number = 10): Promise<RateLimitResult> {
    const now = Date.now();
    this.stats.totalRequests++;

    let info = this.limits.get(identifier);
    
    if (!info) {
      info = this.createRateLimitInfo(identifier, now);
      this.limits.set(identifier, info);
    }

    // Check if currently in a burst
    if (info.isInBurst) {
      const timeSinceBurstStart = now - info.burstCount;
      
      // Reset burst if enough time has passed (e.g., 10 seconds)
      if (timeSinceBurstStart > 10000) {
        info.isInBurst = false;
        info.burstCount = 0;
      }
    }

    // Check if this would create a burst
    if (info.requests + 1 > this.config.maxRequests && !info.isInBurst) {
      if (info.burstCount < burstSize) {
        info.isInBurst = true;
        info.burstCount = now;
        
        // Allow burst request but with limited remaining
        return {
          allowed: true,
          remaining: 0,
          resetTime: info.resetTime,
          reason: 'Burst request allowed',
        };
      }
    }

    // Fall back to regular rate limiting
    return this.checkRateLimit(identifier);
  }

  async checkSlidingWindowRateLimit(
    identifier: string, 
    customWindow?: number, 
    customMax?: number
  ): Promise<RateLimitResult> {
    const windowMs = customWindow || this.config.windowMs;
    const maxRequests = customMax || this.config.maxRequests;
    const now = Date.now();

    let info = this.limits.get(identifier);
    
    if (!info) {
      info = this.createRateLimitInfo(identifier, now);
      info.resetTime = now + windowMs;
      this.limits.set(identifier, info);
    }

    // Remove requests outside the sliding window
    // Note: In a full implementation, you'd store individual request timestamps
    // For this demo, we'll use the existing window approach
    
    const remaining = Math.max(0, maxRequests - info.requests);
    
    if (info.requests >= maxRequests) {
      this.stats.blockedRequests++;
      const retryAfter = Math.ceil((info.resetTime - now) / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: info.resetTime,
        retryAfter,
        reason: 'Sliding window rate limit exceeded',
      };
    }

    info.requests++;
    info.lastRequest = now;
    
    return {
      allowed: true,
      remaining: remaining - 1,
      resetTime: info.resetTime,
    };
  }

  getGlobalStats() {
    return {
      ...this.stats,
      activeLimits: this.limits.size,
      config: this.getConfig(),
    };
  }

  getTopUsers(limit: number = 10): Array<{ identifier: string; requests: number; usagePercent: number }> {
    const sorted = Array.from(this.limits.entries())
      .sort(([, a], [, b]) => b.requests - a.requests)
      .slice(0, limit);
    
    return sorted.map(([identifier, info]) => ({
      identifier,
      requests: info.requests,
      usagePercent: Math.round((info.requests / this.config.maxRequests) * 100),
    }));
  }

  async setCustomLimit(identifier: string, maxRequests: number, windowMs?: number): Promise<void> {
    const now = Date.now();
    let info = this.limits.get(identifier);
    
    if (!info) {
      info = this.createRateLimitInfo(identifier, now);
      this.limits.set(identifier, info);
    }
    
    // Store custom limit in the info object
    (info as any).customMaxRequests = maxRequests;
    (info as any).customWindowMs = windowMs || this.config.windowMs;
    
    logger.info(`Set custom rate limit for ${identifier}: ${maxRequests} requests per ${windowMs || this.config.windowMs}ms`);
  }

  async resetAllLimits(): Promise<void> {
    const count = this.limits.size;
    this.limits.clear();
    this.stats.activeUsers = 0;
    logger.info(`Reset all rate limits (${count} entries cleared)`);
  }

  exportData(): Array<{ identifier: string; data: RateLimitInfo }> {
    return Array.from(this.limits.entries()).map(([identifier, data]) => ({
      identifier,
      data,
    }));
  }

  importData(entries: Array<{ identifier: string; data: RateLimitInfo }>): void {
    for (const { identifier, data: infoData } of entries) {
      this.limits.set(identifier, infoData);
    }
    
    this.stats.activeUsers = this.limits.size;
    logger.info(`Imported ${entries.length} rate limit entries`);
  }
}