export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  edgeRateLimiting: {
    enabled: boolean;
    requestsPerSecond: number;
    burstLimit: number;
  };
  regionBlocking: {
    enabled: boolean;
    blockedRegions: string[];
  };
}

export interface RateLimitResult {
  allowed: boolean;
  resetTime?: number;
  remainingRequests?: number;
  reason?: string;
  retryAfter?: number;
}

export interface RateLimitRecord {
  count: number;
  resetTime: number;
  firstRequest: number;
  lastRequest: number;
}

interface EdgeRequestRecord {
  timestamp: number;
  region: string;
  endpoint: string;
  identifier: string;
}

/**
 * RateLimitService - Handles rate limiting, throttling, and request quotas
 * 
 * Responsibilities:
 * - Basic rate limiting with sliding windows
 * - Edge-optimized rate limiting
 * - Region-based access control
 * - Burst protection
 * - Request pattern analysis
 * - Quota management
 */
export class RateLimitService {
  private config: RateLimitConfig;
  private rateLimitMap = new Map<string, RateLimitRecord>();
  private edgeRequestHistory: EdgeRequestRecord[] = [];
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      edgeRateLimiting: {
        enabled: true,
        requestsPerSecond: 10,
        burstLimit: 20
      },
      regionBlocking: {
        enabled: true,
        blockedRegions: ['CN', 'RU', 'IR', 'KP'] // Example blocked regions
      },
      ...config
    };

    // Start cleanup interval to prevent memory leaks
    this.startCleanup();
  }

  /**
   * Main rate limiting check
   */
  checkRateLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const key = `standard_${identifier}`;
    const record = this.rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      // New window expired
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
        firstRequest: now,
        lastRequest: now
      });

      return {
        allowed: true,
        remainingRequests: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs
      };
    }

    if (record.count >= this.config.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return {
        allowed: false,
        resetTime: record.resetTime,
        remainingRequests: 0,
        reason: 'Rate limit exceeded',
        retryAfter
      };
    }

    // Update existing record
    record.count++;
    record.lastRequest = now;

    return {
      allowed: true,
      remainingRequests: this.config.maxRequests - record.count,
      resetTime: record.resetTime
    };
  }

  /**
   * Edge-optimized rate limiting for global applications
   */
  checkEdgeRateLimit(identifier: string, region: string, endpoint?: string): RateLimitResult {
    if (!this.config.edgeRateLimiting.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    const key = `edge_${identifier}_${region}`;
    const record = this.rateLimitMap.get(key);

    // Check region blocking first
    if (this.config.regionBlocking.enabled && 
        this.config.regionBlocking.blockedRegions.includes(region)) {
      return { 
        allowed: false, 
        reason: 'Region blocked',
        remainingRequests: 0
      };
    }

    // Record edge request for analysis
    this.recordEdgeRequest(identifier, region, endpoint || 'unknown');

    // Edge rate limiting uses shorter windows (1 second)
    const windowMs = 1000;
    const maxRequests = this.config.edgeRateLimiting.requestsPerSecond;

    if (!record || now > record.resetTime) {
      // New window
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs,
        firstRequest: now,
        lastRequest: now
      });

      return { 
        allowed: true, 
        remainingRequests: maxRequests - 1,
        resetTime: now + windowMs
      };
    }

    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return { 
        allowed: false, 
        resetTime: record.resetTime,
        remainingRequests: 0,
        reason: 'Edge rate limit exceeded',
        retryAfter
      };
    }

    // Check for burst protection
    if (record.count >= this.config.edgeRateLimiting.burstLimit) {
      return {
        allowed: false,
        reason: 'Burst limit exceeded',
        retryAfter: 1
      };
    }

    record.count++;
    record.lastRequest = now;

    return { 
      allowed: true, 
      remainingRequests: maxRequests - record.count,
      resetTime: record.resetTime
    };
  }

  /**
   * Advanced rate limiting with custom windows
   */
  checkCustomRateLimit(
    identifier: string, 
    maxRequests: number, 
    windowMs: number,
    scope: string = 'custom'
  ): RateLimitResult {
    const now = Date.now();
    const key = `${scope}_${identifier}`;
    const record = this.rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs,
        firstRequest: now,
        lastRequest: now
      });

      return {
        allowed: true,
        remainingRequests: maxRequests - 1,
        resetTime: now + windowMs
      };
    }

    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return {
        allowed: false,
        resetTime: record.resetTime,
        remainingRequests: 0,
        reason: 'Custom rate limit exceeded',
        retryAfter
      };
    }

    record.count++;
    record.lastRequest = now;

    return {
      allowed: true,
      remainingRequests: maxRequests - record.count,
      resetTime: record.resetTime
    };
  }

  /**
   * Check if identifier is currently rate limited
   */
  isRateLimited(identifier: string): boolean {
    const keys = Array.from(this.rateLimitMap.keys()).filter(key => 
      key.includes(identifier)
    );

    const now = Date.now();
    return keys.some(key => {
      const record = this.rateLimitMap.get(key);
      return record && record.count >= this.config.maxRequests && now <= record.resetTime;
    });
  }

  /**
   * Get current rate limit status for an identifier
   */
  getRateLimitStatus(identifier: string): {
    standard: RateLimitRecord | null;
    edge: Map<string, RateLimitRecord>;
    custom: Map<string, RateLimitRecord>;
  } {
    const standardKey = `standard_${identifier}`;
    const standardRecord = this.rateLimitMap.get(standardKey) || null;

    const edgeRecords = new Map<string, RateLimitRecord>();
    const customRecords = new Map<string, RateLimitRecord>();

    for (const [key, record] of this.rateLimitMap.entries()) {
      if (key.startsWith(`edge_${identifier}_`)) {
        edgeRecords.set(key, record);
      } else if (key.includes(identifier) && !key.startsWith('standard_') && !key.startsWith('edge_')) {
        customRecords.set(key, record);
      }
    }

    return {
      standard: standardRecord,
      edge: edgeRecords,
      custom: customRecords
    };
  }

  /**
   * Reset rate limits for an identifier
   */
  resetRateLimit(identifier: string): void {
    const keysToDelete = Array.from(this.rateLimitMap.keys()).filter(key => 
      key.includes(identifier)
    );

    keysToDelete.forEach(key => this.rateLimitMap.delete(key));
  }

  /**
   * Reset all rate limits (admin function)
   */
  resetAllRateLimits(): void {
    this.rateLimitMap.clear();
    this.edgeRequestHistory = [];
  }

  /**
   * Record edge request for pattern analysis
   */
  private recordEdgeRequest(identifier: string, region: string, endpoint: string): void {
    this.edgeRequestHistory.push({
      timestamp: Date.now(),
      region,
      endpoint,
      identifier
    });

    // Keep only last 1000 requests to prevent memory leaks
    if (this.edgeRequestHistory.length > 1000) {
      this.edgeRequestHistory = this.edgeRequestHistory.slice(-1000);
    }
  }

  /**
   * Detect anomalies in edge request patterns
   */
  detectEdgeAnomalies(identifier: string): string[] {
    const anomalies: string[] = [];
    const now = Date.now();
    const recentRequests = this.edgeRequestHistory.filter(r => 
      r.identifier === identifier && now - r.timestamp < 60000
    );

    // Check for rapid region hopping
    const regions = new Set(recentRequests.map(r => r.region));
    if (regions.size > 5) {
      anomalies.push('Rapid region hopping detected');
    }

    // Check for unusual request frequency
    if (recentRequests.length > 100) {
      anomalies.push('High frequency edge requests detected');
    }

    // Check for endpoint abuse
    const endpointCounts = new Map<string, number>();
    recentRequests.forEach(r => {
      endpointCounts.set(r.endpoint, (endpointCounts.get(r.endpoint) || 0) + 1);
    });

    for (const [endpoint, count] of endpointCounts.entries()) {
      if (count > 50) {
        anomalies.push(`Endpoint abuse detected: ${endpoint}`);
      }
    }

    return anomalies;
  }

  /**
   * Get rate limit statistics
   */
  getStatistics(): {
    totalActiveLimits: number;
    edgeRequestCount: number;
    mostActiveIdentifiers: Array<{ identifier: string; requestCount: number }>;
    blockedRegionsCount: number;
  } {
    const totalActiveLimits = this.rateLimitMap.size;
    const edgeRequestCount = this.edgeRequestHistory.length;

    // Calculate most active identifiers
    const identifierCounts = new Map<string, number>();
    for (const [key, record] of this.rateLimitMap.entries()) {
      if (key.startsWith('standard_')) {
        const identifier = key.replace('standard_', '');
        identifierCounts.set(identifier, (identifierCounts.get(identifier) || 0) + record.count);
      }
    }

    const mostActiveIdentifiers = Array.from(identifierCounts.entries())
      .map(([identifier, requestCount]) => ({ identifier, requestCount }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    const blockedRegionsCount = this.config.regionBlocking.blockedRegions.length;

    return {
      totalActiveLimits,
      edgeRequestCount,
      mostActiveIdentifiers,
      blockedRegionsCount
    };
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Start cleanup interval to prevent memory leaks
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [key, record] of this.rateLimitMap.entries()) {
        if (now > record.resetTime + 60000) { // Keep for 1 minute after expiry
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.rateLimitMap.delete(key));

      // Clean old edge request history
      const cutoffTime = now - 300000; // Keep last 5 minutes
      this.edgeRequestHistory = this.edgeRequestHistory.filter(
        request => request.timestamp > cutoffTime
      );

    }, 60000); // Run every minute
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.resetAllRateLimits();
  }

  /**
   * Hash string for consistent identifier generation
   */
  hashString(input: string): string {
    if (!input) return '';
    
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}