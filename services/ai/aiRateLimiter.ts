// AI Rate Limiting with Burst Control
import { createScopedLogger } from "../../utils/logger";
import { AI_CONFIG, TIME_CONSTANTS } from "../../constants/config";

const logger = createScopedLogger('ai-rate-limiter');

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstMultiplier?: number;
  penaltyMs?: number;
}

export interface UserRateLimit {
  requests: number;
  windowStart: number;
  burstTokens: number;
  lastRequestTime: number;
  penaltyUntil?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  reason?: string;
}

export class AIRateLimiter {
  private userLimits = new Map<string, UserRateLimit>();
  private defaultConfig: RateLimitConfig;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(config?: Partial<RateLimitConfig>) {
    this.defaultConfig = {
      windowMs: AI_CONFIG.RATE_LIMITS.GOOGLE.REQUESTS_PER_MINUTE * TIME_CONSTANTS.MINUTE / 60,
      maxRequests: AI_CONFIG.RATE_LIMITS.GOOGLE.REQUESTS_PER_MINUTE,
      burstMultiplier: 1.5,
      penaltyMs: TIME_CONSTANTS.MINUTE * 5, // 5 minute penalty
      ...config
    };

    // Cleanup expired limits every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLimits();
    }, TIME_CONSTANTS.MINUTE);

    logger.info('AI Rate Limiter initialized', this.defaultConfig);
  }

  async checkRateLimit(userId: string, action: 'generation' | 'analysis' = 'generation'): Promise<RateLimitResult> {
    const now = Date.now();
    let userLimit = this.userLimits.get(userId);

    // Initialize if not exists
    if (!userLimit) {
      userLimit = {
        requests: 0,
        windowStart: now,
        burstTokens: Math.floor(this.defaultConfig.maxRequests * (this.defaultConfig.burstMultiplier! - 1)),
        lastRequestTime: now
      };
      this.userLimits.set(userId, userLimit);
    }

    // Check if user is in penalty period
    if (userLimit.penaltyUntil && now < userLimit.penaltyUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: userLimit.penaltyUntil,
        retryAfter: Math.ceil((userLimit.penaltyUntil - now) / 1000),
        reason: 'rate_limit_penalty'
      };
    }

    // Reset window if expired
    if (now - userLimit.windowStart >= this.defaultConfig.windowMs) {
      userLimit.requests = 0;
      userLimit.windowStart = now;
      // Restore some burst tokens after successful window
      userLimit.burstTokens = Math.min(
        userLimit.burstTokens + 1,
        Math.floor(this.defaultConfig.maxRequests * (this.defaultConfig.burstMultiplier! - 1))
      );
    }

    // Calculate limits based on action type
    const actionMultiplier = action === 'generation' ? 1 : 0.5; // Analysis counts as half a request
    const effectiveMaxRequests = Math.floor(this.defaultConfig.maxRequests * actionMultiplier);
    
    // Check burst availability
    const canUseBurst = userLimit.requests >= effectiveMaxRequests && userLimit.burstTokens > 0;
    const hasBasicCapacity = userLimit.requests < effectiveMaxRequests;

    if (!hasBasicCapacity && !canUseBurst) {
      // Rate limit exceeded - apply penalty for aggressive violations
      if (userLimit.requests - effectiveMaxRequests > 2) {
        userLimit.penaltyUntil = now + this.defaultConfig.penaltyMs!;
        logger.warn(`Rate limit penalty applied for user ${userId}`);
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime: userLimit.windowStart + this.defaultConfig.windowMs,
        retryAfter: Math.ceil((userLimit.windowStart + this.defaultConfig.windowMs - now) / 1000),
        reason: 'rate_limit_exceeded'
      };
    }

    // Allow request and update counters
    userLimit.requests++;
    userLimit.lastRequestTime = now;

    if (canUseBurst) {
      userLimit.burstTokens--;
    }

    const remaining = canUseBurst ? userLimit.burstTokens : effectiveMaxRequests - userLimit.requests;

    this.userLimits.set(userId, userLimit);

    logger.debug('Rate limit check passed', { 
      userId, 
      action, 
      remaining: remaining.toString(),
      burstTokens: userLimit.burstTokens 
    });

    return {
      allowed: true,
      remaining: Math.max(0, remaining),
      resetTime: userLimit.windowStart + this.defaultConfig.windowMs
    };
  }

  recordSuccess(userId: string): void {
    const now = Date.now();
    const userLimit = this.userLimits.get(userId);

    if (!userLimit) return;

    // If user was in penalty, clear it on successful request
    if (userLimit.penaltyUntil && now >= userLimit.penaltyUntil) {
      userLimit.penaltyUntil = undefined;
      // Reward good behavior with burst tokens
      userLimit.burstTokens = Math.min(
        userLimit.burstTokens + 2,
        Math.floor(this.defaultConfig.maxRequests * (this.defaultConfig.burstMultiplier! - 1))
      );
      logger.info(`Rate limit penalty cleared for user ${userId}`);
    }

    this.userLimits.set(userId, userLimit);
  }

  recordError(userId: string, error: Error): void {
    // If it's a rate limit error, apply penalty
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      const userLimit = this.userLimits.get(userId);
      if (userLimit) {
        userLimit.penaltyUntil = Date.now() + this.defaultConfig.penaltyMs!;
        this.userLimits.set(userId, userLimit);
        logger.warn(`Rate limit penalty applied due to 429 error for user ${userId}`);
      }
    }
  }

  getUserStats(userId: string): {
    currentRequests: number;
    burstTokens: number;
    penaltyUntil?: number;
    resetTime: number;
  } | null {
    const userLimit = this.userLimits.get(userId);
    if (!userLimit) return null;

    return {
      currentRequests: userLimit.requests,
      burstTokens: userLimit.burstTokens,
      penaltyUntil: userLimit.penaltyUntil,
      resetTime: userLimit.windowStart + this.defaultConfig.windowMs
    };
  }

  getAllStats(): {
    totalUsers: number;
    activeUsers: number;
    penalizedUsers: number;
    burstTokensInUse: number;
  } {
    const now = Date.now();
    let activeUsers = 0;
    let penalizedUsers = 0;
    let burstTokensInUse = 0;

    for (const userLimit of this.userLimits.values()) {
      if (now - userLimit.lastRequestTime < TIME_CONSTANTS.MINUTE * 5) {
        activeUsers++;
      }
      if (userLimit.penaltyUntil && userLimit.penaltyUntil > now) {
        penalizedUsers++;
      }
      burstTokensInUse += userLimit.burstTokens;
    }

    return {
      totalUsers: this.userLimits.size,
      activeUsers,
      penalizedUsers,
      burstTokensInUse
    };
  }

  clearUserLimit(userId: string): void {
    this.userLimits.delete(userId);
    logger.info(`Rate limit cleared for user ${userId}`);
  }

  clearAllLimits(): void {
    this.userLimits.clear();
    logger.info('All rate limits cleared');
  }

  private cleanupExpiredLimits(): void {
    const now = Date.now();
    const expiredUsers: string[] = [];

    for (const [userId, userLimit] of this.userLimits.entries()) {
      // Remove users inactive for more than 1 hour
      if (now - userLimit.lastRequestTime > TIME_CONSTANTS.HOUR) {
        expiredUsers.push(userId);
      }
    }

    if (expiredUsers.length > 0) {
      expiredUsers.forEach(userId => this.userLimits.delete(userId));
      logger.debug(`Cleaned up ${expiredUsers.length} expired rate limits`);
    }
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    logger.info('Rate limit config updated', this.defaultConfig);
  }

  // Cleanup method
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.userLimits.clear();
    logger.info('AI Rate Limiter destroyed');
  }
}

// Export singleton instance
export const aiRateLimiter = new AIRateLimiter();