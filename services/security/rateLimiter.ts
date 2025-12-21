import { SecurityConfig } from './types';

export interface RateLimitInfo {
  count: number;
  resetTime: number;
  isBlocked: boolean;
}

export class RateLimiter {
  private rateLimitMap = new Map<string, RateLimitInfo>();
  private config: SecurityConfig['rateLimiting'];

  constructor(config: SecurityConfig['rateLimiting']) {
    this.config = config;
  }

  isRateLimited(identifier: string): { isLimited: boolean; resetTime?: number; remainingRequests?: number } {
    const now = Date.now();
    const existing = this.rateLimitMap.get(identifier);

    if (!existing || now > existing.resetTime) {
      // Reset or create new entry
      const newEntry: RateLimitInfo = {
        count: 1,
        resetTime: now + this.config.windowMs,
        isBlocked: false
      };
      this.rateLimitMap.set(identifier, newEntry);
      
      return {
        isLimited: false,
        resetTime: newEntry.resetTime,
        remainingRequests: this.config.maxRequests - 1
      };
    }

    // Increment count
    existing.count++;
    
    // Check if rate limit exceeded
    if (existing.count > this.config.maxRequests) {
      existing.isBlocked = true;
      return {
        isLimited: true,
        resetTime: existing.resetTime,
        remainingRequests: 0
      };
    }

    // Update existing entry
    this.rateLimitMap.set(identifier, existing);

    return {
      isLimited: false,
      resetTime: existing.resetTime,
      remainingRequests: this.config.maxRequests - existing.count
    };
  }

  resetRateLimit(identifier: string): void {
    this.rateLimitMap.delete(identifier);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.rateLimitMap.entries()) {
      if (now > value.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  getRateLimitInfo(identifier: string): RateLimitInfo | undefined {
    return this.rateLimitMap.get(identifier);
  }

  isBlocked(identifier: string): boolean {
    const info = this.rateLimitMap.get(identifier);
    return info?.isBlocked ?? false;
  }
}

export class EdgeRateLimiter {
  private requestCounts = new Map<string, { count: number; lastReset: number }>();
  private config: SecurityConfig['edgeRateLimiting'];

  constructor(config: SecurityConfig['edgeRateLimiting']) {
    this.config = config;
  }

  checkEdgeRateLimit(clientId: string): { allowed: boolean; retryAfter?: number } {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    const existing = this.requestCounts.get(clientId);

    if (!existing || now - existing.lastReset > 1000) {
      // Reset window
      this.requestCounts.set(clientId, { count: 1, lastReset: now });
      return { allowed: true };
    }

    existing.count++;

    if (existing.count > this.config.requestsPerSecond) {
      // Burst limit check
      if (existing.count > this.config.burstLimit) {
        return { allowed: false, retryAfter: 1000 };
      }
    }

    this.requestCounts.set(clientId, existing);
    return { allowed: true };
  }

  cleanup(): void {
    const now = Date.now();
    const cutoff = now - 1000; // 1 second ago
    
    for (const [key, value] of this.requestCounts.entries()) {
      if (now - value.lastReset > cutoff) {
        this.requestCounts.delete(key);
      }
    }
  }
}