/**
 * Rate Limiting Service
 * 
 * Handles all rate limiting, access control, and API key validation functionality.
 * This service prevents abuse and ensures fair usage of system resources.
 * 
 * @author QuantForge Security Team
 * @version 1.0.0
 */

import { securityUtils } from './SecurityUtilsService';

export interface RateLimitConfig {
  basic: {
    maxRequests: number;
    windowMs: number;
  };
  premium: {
    maxRequests: number;
    windowMs: number;
  };
  enterprise: {
    maxRequests: number;
    windowMs: number;
  };
  edge: {
    requestsPerSecond: number;
    burstLimit: number;
  };
  allowedOrigins: string[];
}

export interface RateLimitResult {
  allowed: boolean;
  resetTime?: number;
  remainingRequests?: number;
  retryAfter?: number;
}

export interface EdgeRateLimitResult {
  allowed: boolean;
  resetTime?: number;
  region?: string;
  burstLimitExceeded: boolean;
}

/**
 * Rate limiting and access control service
 */
export class RateLimitingService {
  private static instance: RateLimitingService;
  private config: RateLimitConfig;
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private edgeRateLimitMap = new Map<string, { requests: number[]; lastReset: number }>();

  private constructor() {
    this.config = {
      basic: {
        maxRequests: 100,
        windowMs: 60000, // 1 minute
      },
      premium: {
        maxRequests: 500,
        windowMs: 60000, // 1 minute
      },
      enterprise: {
        maxRequests: 2000,
        windowMs: 60000, // 1 minute
      },
      edge: {
        requestsPerSecond: 10,
        burstLimit: 20,
      },
      allowedOrigins: [
        'https://quanforge.ai',
        'https://www.quanforge.ai',
        'http://localhost:3000',
        'http://localhost:5173' // Vite dev server
      ]
    };
  }

  static getInstance(): RateLimitingService {
    if (!RateLimitingService.instance) {
      RateLimitingService.instance = new RateLimitingService();
    }
    return RateLimitingService.instance;
  }

  /**
   * Basic rate limiting check
   */
  checkRateLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    if (!record || now > record.resetTime) {
      // New window
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.config.basic.windowMs,
      });
      return { allowed: true, remainingRequests: this.config.basic.maxRequests - 1 };
    }

    if (record.count >= this.config.basic.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return { 
        allowed: false, 
        resetTime: record.resetTime,
        retryAfter
      };
    }

    record.count++;
    return { 
      allowed: true, 
      remainingRequests: this.config.basic.maxRequests - record.count
    };
  }

  /**
   * Adaptive rate limiting based on user tier
   */
  checkAdaptiveRateLimit(identifier: string, userTier: 'basic' | 'premium' | 'enterprise' = 'basic'): RateLimitResult {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    // Get limits based on user tier
    const limits = this.config[userTier];

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

    if (record.count >= limits.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return { 
        allowed: false, 
        resetTime: record.resetTime,
        remainingRequests: 0,
        retryAfter
      };
    }

    record.count++;
    return { 
      allowed: true, 
      remainingRequests: limits.maxRequests - record.count 
    };
  }

  /**
   * Edge-specific rate limiting for better performance at the edge
   */
  checkEdgeRateLimit(identifier: string, region: string): EdgeRateLimitResult {
    const now = Date.now();
    const key = `${identifier}:${region}`;
    const record = this.edgeRateLimitMap.get(key);

    // Reset sliding window if needed (1 second window)
    if (!record || now - record.lastReset > 1000) {
      this.edgeRateLimitMap.set(key, {
        requests: [now],
        lastReset: now,
      });
      return { 
        allowed: true, 
        region,
        burstLimitExceeded: false
      };
    }

    // Clean old requests (sliding window)
    const oneSecondAgo = now - 1000;
    const recentRequests = record.requests.filter(time => time > oneSecondAgo);

    // Check rate limit
    if (recentRequests.length >= this.config.edge.requestsPerSecond) {
      return { 
        allowed: false, 
        resetTime: record.lastReset + 1000,
        region,
        burstLimitExceeded: recentRequests.length >= this.config.edge.burstLimit
      };
    }

    // Add current request
    recentRequests.push(now);
    this.edgeRateLimitMap.set(key, {
      requests: recentRequests,
      lastReset: record.lastReset,
    });

    return { 
      allowed: true, 
      region,
      burstLimitExceeded: false
    };
  }

  /**
   * Validate request origin against allowed origins
   */
  validateOrigin(origin: string): boolean {
    return this.config.allowedOrigins.includes(origin);
  }

  /**
   * Validate API key format and presence
   */
  validateAPIKey(apiKey: string, type: 'gemini' | 'supabase' | 'twelvedata' | 'generic' = 'generic'): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Basic format validation
    if (apiKey.length < 10 || apiKey.length > 500) {
      return false;
    }

    // Type-specific validation
    switch (type) {
      case 'gemini':
        // Gemini API keys typically start with specific prefixes
        return /^[A-Za-z0-9_-]{20,}$/.test(apiKey);
        
      case 'supabase':
        // Supabase keys have specific format
        return /^[A-Za-z0-9_-]{30,}$/.test(apiKey);
        
      case 'twelvedata':
        // TwelveData API keys are typically 32 characters
        return /^[A-Za-z0-9]{32}$/.test(apiKey);
        
      case 'generic':
      default:
        // Generic validation - allow alphanumeric with common symbols
        return /^[A-Za-z0-9._-]{10,}$/.test(apiKey);
    }
  }

/**
   * Enhance API key validation with expiration and rotation
   */
  validateAPIKeyWithExpiry(apiKey: string, type: 'gemini' | 'supabase' | 'twelvedata' | 'generic' = 'generic'): { 
    isValid: boolean; 
    expiresAt?: number; 
    isExpired: boolean;
    daysUntilExpiry?: number;
  } {
    const isValidFormat = this.validateAPIKey(apiKey, type);
    
    if (!isValidFormat) {
      return { isValid: false, isExpired: false };
    }

    // Check for expiration if stored
    const storedKey = this.getStoredAPIKey(apiKey);
    if (!storedKey) {
      return { isValid: false, isExpired: false };
    }

    const currentTime = Date.now();
    const isExpired = currentTime > storedKey.expiresAt;
    const daysUntilExpiry = Math.max(0, Math.ceil((storedKey.expiresAt - currentTime) / (1000 * 60 * 60 * 24)));

    return {
      isValid: !isExpired,
      expiresAt: storedKey.expiresAt,
      isExpired,
      daysUntilExpiry
    };
  }

  /**
   * Store API key with expiration
   */
  storeAPIKey(key: string, expiresAt: number): void {
    // This would typically use secure storage
    // For now, we'll use in-memory storage with hashing
    const keyHash = securityUtils.hashString(key);
    localStorage.setItem(`api_key_${keyHash}`, JSON.stringify({
      key: keyHash,
      expiresAt,
      createdAt: Date.now()
    }));
  }

  /**
   * Get stored API key information
   */
  private getStoredAPIKey(apiKey: string): { key: string; expiresAt: number; createdAt: number } | null {
    const keyHash = securityUtils.hashString(apiKey);
    const stored = localStorage.getItem(`api_key_${keyHash}`);
    
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  /**
   * Get rate limiting metrics and statistics
   */
  getRateLimitMetrics(): {
    totalEntries: number;
    basicTierActive: number;
    premiumTierActive: number;
    enterpriseTierActive: number;
    edgeRequestsActive: number;
    blockedRequests: number;
    averageUtilization: number;
  } {
    const rateLimitEntries = Array.from(this.rateLimitMap.values());
    const edgeEntries = Array.from(this.edgeRateLimitMap.values());

    // Calculate blocked requests
    const blockedRequests = rateLimitEntries
      .reduce((sum, record) => {
        if (record.count > this.config.basic.maxRequests) {
          return sum + (record.count - this.config.basic.maxRequests);
        }
        return sum;
      }, 0);

    // Calculate average utilization
    const averageUtilization = rateLimitEntries.length > 0
      ? rateLimitEntries.reduce((sum, record) => {
          const Utilization = (record.count / this.config.basic.maxRequests) * 100;
          return sum + Utilization;
        }, 0) / rateLimitEntries.length
      : 0;

    return {
      totalEntries: this.rateLimitMap.size,
      basicTierActive: rateLimitEntries.length, // Simplified for now
      premiumTierActive: 0,
      enterpriseTierActive: 0,
      edgeRequestsActive: edgeEntries.reduce((sum, record) => sum + record.requests.length, 0),
      blockedRequests,
      averageUtilization: Math.round(averageUtilization * 100) / 100
    };
  }

  /**
   * Clean expired entries
   */
  cleanupExpiredEntries(): number {
    let cleanedCount = 0;

    // Clean basic rate limit entries
    for (const [key, record] of this.rateLimitMap.entries()) {
      if (Date.now() > record.resetTime + this.config.basic.windowMs) {
        this.rateLimitMap.delete(key);
        cleanedCount++;
      }
    }

    // Clean edge rate limit entries
    for (const [key, record] of this.edgeRateLimitMap.entries()) {
      if (Date.now() - record.lastReset > 60000) { // Clean after 1 minute of inactivity
        this.edgeRateLimitMap.delete(key);
        cleanedCount++;
      }
    }

    securityUtils.logSecurityEvent('RateLimitCleanup', { cleanedCount });
    return cleanedCount;
  }

  /**
   * Reset rate limit for a specific identifier (admin function)
   */
  resetRateLimit(identifier: string, region?: string): boolean {
    if (region) {
      const key = `${identifier}:${region}`;
      return this.edgeRateLimitMap.delete(key);
    } else {
      return this.rateLimitMap.delete(identifier);
    }
  }

  /**
   * Check if IP is being rate limited
   */
  isRateLimited(identifier: string, userTier: 'basic' | 'premium' | 'enterprise' = 'basic'): boolean {
    const result = this.checkAdaptiveRateLimit(identifier, userTier);
    return !result.allowed;
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    securityUtils.logSecurityEvent('RateLimitConfigUpdated', { newConfig });
  }

  /**
   * Add allowed origin
   */
  addAllowedOrigin(origin: string): void {
    if (!this.config.allowedOrigins.includes(origin)) {
      this.config.allowedOrigins.push(origin);
      securityUtils.logSecurityEvent('OriginAdded', { origin });
    }
  }

  /**
   * Remove allowed origin
   */
  removeAllowedOrigin(origin: string): boolean {
    const index = this.config.allowedOrigins.indexOf(origin);
    if (index > -1) {
      this.config.allowedOrigins.splice(index, 1);
      securityUtils.logSecurityEvent('OriginRemoved', { origin });
      return true;
    }
    return false;
  }
}

// Export singleton instance for convenience
export const rateLimiting = RateLimitingService.getInstance();