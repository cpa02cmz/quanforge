export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimitResult {
  allowed: boolean;
  resetTime?: number;
  remainingRequests?: number;
  reason?: string;
}

export interface AdaptiveRateLimitConfig {
  basic: RateLimitConfig;
  premium: RateLimitConfig;
  enterprise: RateLimitConfig;
}

export interface EdgeRateLimitConfig {
  enabled: boolean;
  requestsPerSecond: number;
  burstLimit: number;
}

export interface RegionBlockingConfig {
  enabled: boolean;
  blockedRegions: string[];
}

export class RateLimitService {
  private rateLimitMap = new Map<string, RateLimitRecord>();
  private config: RateLimitConfig;
  private adaptiveConfigs: AdaptiveRateLimitConfig;
  private edgeConfig: EdgeRateLimitConfig;
  private regionConfig: RegionBlockingConfig;

  constructor(config: RateLimitConfig, adaptiveConfigs: AdaptiveRateLimitConfig, edgeConfig: EdgeRateLimitConfig, regionConfig: RegionBlockingConfig) {
    this.config = config;
    this.adaptiveConfigs = adaptiveConfigs;
    this.edgeConfig = edgeConfig;
    this.regionConfig = regionConfig;
  }

  // Basic rate limiting
  checkRateLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    if (!record || now > record.resetTime) {
      // New window
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return { allowed: true, remainingRequests: this.config.maxRequests - 1 };
    }

    if (record.count >= this.config.maxRequests) {
      return { 
        allowed: false, 
        resetTime: record.resetTime,
        remainingRequests: 0
      };
    }

    record.count++;
    return { 
      allowed: true, 
      remainingRequests: this.config.maxRequests - record.count 
    };
  }

  // Enhanced rate limiting with adaptive thresholds
  checkAdaptiveRateLimit(identifier: string, userTier: 'basic' | 'premium' | 'enterprise' = 'basic'): RateLimitResult {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    const limits = this.adaptiveConfigs[userTier];

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
      return { 
        allowed: false, 
        resetTime: record.resetTime,
        remainingRequests: 0
      };
    }

    record.count++;
    return { 
      allowed: true, 
      remainingRequests: limits.maxRequests - record.count 
    };
  }

  // Enhanced edge rate limiting
  checkEdgeRateLimit(identifier: string, region: string): RateLimitResult {
    if (!this.edgeConfig.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    const key = `edge_${identifier}_${region}`;
    const record = this.rateLimitMap.get(key);

    // Check region blocking
    if (this.regionConfig.enabled && 
        this.regionConfig.blockedRegions.includes(region)) {
      return { 
        allowed: false, 
        reason: 'Region blocked',
        remainingRequests: 0
      };
    }

    const windowMs = 1000; // 1 second window for edge rate limiting
    const maxRequests = this.edgeConfig.requestsPerSecond;

    if (!record || now > record.resetTime) {
      // New window
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return { 
        allowed: true, 
        remainingRequests: maxRequests - 1 
      };
    }

    if (record.count >= maxRequests) {
      return { 
        allowed: false, 
        resetTime: record.resetTime,
        remainingRequests: 0,
        reason: 'Edge rate limit exceeded'
      };
    }

    record.count++;
    return { 
      allowed: true, 
      remainingRequests: maxRequests - record.count 
    };
  }

  // Check if identifier is currently rate limited
  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);
    
    if (!record || now > record.resetTime) {
      return false;
    }
    
    return record.count >= this.config.maxRequests;
  }

  // Get remaining requests for identifier
  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);
    
    if (!record || now > record.resetTime) {
      return this.config.maxRequests;
    }
    
    return Math.max(0, this.config.maxRequests - record.count);
  }

  // Get reset time for identifier
  getResetTime(identifier: string): number | null {
    const record = this.rateLimitMap.get(identifier);
    return record ? record.resetTime : null;
  }

  // Reset rate limit for identifier (admin function)
  resetRateLimit(identifier: string): void {
    this.rateLimitMap.delete(identifier);
  }

  // Get comprehensive rate limit statistics
  getRateLimitStats(): {
    activeEntries: number;
    blockedRequests: number;
    totalRequests: number;
    averageRequestsPerWindow: number;
  } {
    const now = Date.now();
    const activeEntries = this.rateLimitMap.size;
    
    let blockedRequests = 0;
    let totalRequests = 0;
    let validRecords = 0;

    for (const [_, record] of this.rateLimitMap.entries()) {
      if (now <= record.resetTime) {
        totalRequests += record.count;
        blockedRequests += Math.max(0, record.count - this.config.maxRequests);
        validRecords++;
      }
    }

    const averageRequestsPerWindow = validRecords > 0 ? totalRequests / validRecords : 0;

    return {
      activeEntries,
      blockedRequests,
      totalRequests,
      averageRequestsPerWindow
    };
  }

  // Clean up expired entries
  cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, record] of this.rateLimitMap.entries()) {
      if (now > record.resetTime) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.rateLimitMap.delete(key));
  }

  // Get top rate limited identifiers
  getTopRateLimitedIdentifiers(limit: number = 10): Array<{ identifier: string; count: number; blockedCount: number }> {
    const now = Date.now();
    const results: Array<{ identifier: string; count: number; blockedCount: number }> = [];

    for (const [identifier, record] of this.rateLimitMap.entries()) {
      if (now <= record.resetTime) {
        results.push({
          identifier,
          count: record.count,
          blockedCount: Math.max(0, record.count - this.config.maxRequests)
        });
      }
    }

    return results
      .sort((a, b) => b.blockedCount - a.blockedCount)
      .slice(0, limit);
  }

  // Check burst limit (for edge rate limiting)
  checkBurstLimit(identifier: string, requestCount: number): RateLimitResult {
    if (!this.edgeConfig.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    const key = `burst_${identifier}`;
    const record = this.rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      // New burst window (shorter window for burst detection)
      this.rateLimitMap.set(key, {
        count: requestCount,
        resetTime: now + 5000, // 5 second burst window
      });
      return { 
        allowed: requestCount <= this.edgeConfig.burstLimit,
        remainingRequests: Math.max(0, this.edgeConfig.burstLimit - requestCount)
      };
    }

    const newCount = record.count + requestCount;
    if (newCount > this.edgeConfig.burstLimit) {
      return {
        allowed: false,
        reason: 'Burst limit exceeded',
        resetTime: record.resetTime,
        remainingRequests: 0
      };
    }

    record.count = newCount;
    return {
      allowed: true,
      remainingRequests: this.edgeConfig.burstLimit - newCount
    };
  }

  // Update configuration
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Update adaptive configuration
  updateAdaptiveConfig(newConfig: Partial<AdaptiveRateLimitConfig>): void {
    this.adaptiveConfigs = {
      basic: { ...this.adaptiveConfigs.basic, ...newConfig.basic },
      premium: { ...this.adaptiveConfigs.premium, ...newConfig.premium },
      enterprise: { ...this.adaptiveConfigs.enterprise, ...newConfig.enterprise }
    };
  }

  // Update edge configuration
  updateEdgeConfig(newConfig: Partial<EdgeRateLimitConfig>): void {
    this.edgeConfig = { ...this.edgeConfig, ...newConfig };
  }

  // Update region blocking configuration
  updateRegionConfig(newConfig: Partial<RegionBlockingConfig>): void {
    this.regionConfig = { ...this.regionConfig, ...newConfig };
  }

  // Export current state for persistence
  exportState(): Record<string, RateLimitRecord> {
    const state: Record<string, RateLimitRecord> = {};
    const now = Date.now();
    
    for (const [key, record] of this.rateLimitMap.entries()) {
      // Only export active records
      if (now <= record.resetTime) {
        state[key] = record;
      }
    }
    
    return state;
  }

  // Import state from persistence
  importState(state: Record<string, RateLimitRecord>): void {
    const now = Date.now();
    
    for (const [key, record] of Object.entries(state)) {
      // Only import records that are still valid
      if (now <= record.resetTime) {
        this.rateLimitMap.set(key, record);
      }
    }
  }
}