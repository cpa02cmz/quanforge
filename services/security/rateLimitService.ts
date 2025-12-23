interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  adaptiveLimits: {
    enabled: boolean;
    tiers: {
      free: { requests: number; window: number };
      premium: { requests: number; window: number };
      enterprise: { requests: number; window: number };
    };
  };
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

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastReset: number;
}

interface BotDetectionEntry {
  requests: number;
  suspiciousPatterns: number;
  lastAccess: number;
  userAgents: Set<string>;
  headers: Map<string, number>;
  timingPatterns: number[];
}

interface BotDetectionConfig {
  enabled: boolean;
  suspiciousPatterns: RegExp[];
  rateThreshold: number;
  patternThreshold: number;
  timingVarianceThreshold: number;
}

export class RateLimitService {
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private botDetectionMap = new Map<string, BotDetectionEntry>();
  private config: RateLimitConfig;
  private botConfig: BotDetectionConfig;

  constructor(config: Partial<RateLimitConfig> = {}, botConfig: Partial<BotDetectionConfig> = {}) {
    this.config = {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      adaptiveLimits: {
        enabled: true,
        tiers: {
          free: { requests: 100, window: 60000 },
          premium: { requests: 500, window: 60000 },
          enterprise: { requests: 2000, window: 60000 }
        }
      },
      edgeRateLimiting: {
        enabled: true,
        requestsPerSecond: 10,
        burstLimit: 20
      },
      regionBlocking: {
        enabled: true,
        blockedRegions: ['CN', 'RU', 'KP', 'IR']
      },
      ...config
    };

    this.botConfig = {
      enabled: true,
      suspiciousPatterns: [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i,
        /curl/i,
        /wget/i,
        /python/i,
        /java/i,
        /node/i,
        /go-http/i
      ],
      rateThreshold: 50,
      patternThreshold: 3,
      timingVarianceThreshold: 100, // milliseconds
      ...botConfig
    };
  }

  isRateLimited(identifier: string, userTier: 'free' | 'premium' | 'enterprise' = 'free'): { limited: boolean; retryAfter?: number; remainingRequests: number } {
    const entry = this.rateLimitMap.get(identifier);
    const now = Date.now();
    
    // Get adaptive limits based on user tier
    const limits = this.config.adaptiveLimits.enabled 
      ? this.config.adaptiveLimits.tiers[userTier]
      : { requests: this.config.maxRequests, window: this.config.windowMs };

    if (!entry || now - entry.lastReset > limits.window) {
      // New window
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + limits.window,
        lastReset: now
      });
      
      return { 
        limited: false, 
        remainingRequests: limits.requests - 1 
      };
    }

    // Increment count
    entry.count++;
    
    if (entry.count > limits.requests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return { 
        limited: true, 
        retryAfter,
        remainingRequests: 0 
      };
    }

    return { 
      limited: false, 
      remainingRequests: limits.requests - entry.count 
    };
  }

  isBotDetected(identifier: string, requestInfo: {
    userAgent?: string;
    headers?: Record<string, string>;
    timing?: number;
  }): { isBot: boolean; riskScore: number; reasons: string[] } {
    if (!this.botConfig.enabled) {
      return { isBot: false, riskScore: 0, reasons: [] };
    }

    const { userAgent = '', headers = {}, timing = 0 } = requestInfo;
    const entry: BotDetectionEntry = this.botDetectionMap.get(identifier) || {
      requests: 0,
      suspiciousPatterns: 0,
      lastAccess: Date.now(),
      userAgents: new Set(),
      headers: new Map(),
      timingPatterns: []
    };

    const reasons: string[] = [];
    let riskScore = 0;

    // Update request count
    entry.requests++;
    entry.lastAccess = Date.now();

    // Check User-Agent patterns
    let userAgentScore = 0;
    for (const pattern of this.botConfig.suspiciousPatterns) {
      if (pattern.test(userAgent)) {
        userAgentScore += 10;
        reasons.push(`Suspicious User-Agent pattern: ${pattern.source}`);
      }
    }
    riskScore += userAgentScore;

    // Track unique User-Agents
    entry.userAgents.add(userAgent.toLowerCase());
    if (entry.userAgents.size > 5) {
      riskScore += 20;
      reasons.push('Too many different User-Agents');
    }

    // Check for missing headers (common with simple bots)
    const essentialHeaders = ['accept', 'accept-language', 'accept-encoding'];
    const missingHeaders = essentialHeaders.filter(header => !headers[header]);
    if (missingHeaders.length > 1) {
      riskScore += 15;
      reasons.push('Missing essential HTTP headers');
    }

    // Check header patterns
    for (const [header, value] of Object.entries(headers)) {
      const headerKey = header.toLowerCase();
      const currentCount = entry.headers.get(headerKey) || 0;
      entry.headers.set(headerKey, currentCount + 1);

      // Check for suspicious header values
      if (headerKey === 'user-agent' && value.length > 200) {
        riskScore += 10;
        reasons.push('Unusually long User-Agent header');
      }
    }

    // Check request timing patterns
    if (timing && entry.timingPatterns.length > 0) {
      const avgTiming = entry.timingPatterns.reduce((a, b) => a + b, 0) / entry.timingPatterns.length;
      const variance = Math.abs(timing - avgTiming);
      
      if (variance < this.botConfig.timingVarianceThreshold) {
        riskScore += 15;
        reasons.push('Consistent timing patterns (bot-like)');
      }
    }
    if (timing !== undefined) {
      entry.timingPatterns.push(timing);
    }

    // Check rate thresholds
    if (entry.requests > this.botConfig.rateThreshold) {
      riskScore += 25;
      reasons.push('Excessive request rate');
    }

    // Check suspicious pattern threshold
    if (entry.suspiciousPatterns > this.botConfig.patternThreshold) {
      riskScore += 20;
      reasons.push('Multiple suspicious patterns detected');
    }

    // Update entry
    this.botDetectionMap.set(identifier, entry);

    const isBot = riskScore > 50;
    return { isBot, riskScore, reasons };
  }

  isRegionBlocked(region: string): boolean {
    if (!this.config.regionBlocking.enabled) {
      return false;
    }
    
    return this.config.regionBlocking.blockedRegions.includes(region);
  }

  checkEdgeRateLimit(identifier: string, requestCount: number = 1): boolean {
    if (!this.config.edgeRateLimiting.enabled) {
      return false;
    }

    const entry = this.rateLimitMap.get(`edge:${identifier}`);
    const now = Date.now();
    const windowMs = 1000; // 1 second window for edge rate limiting

    if (!entry || now - entry.lastReset > windowMs) {
      // New edge window
      this.rateLimitMap.set(`edge:${identifier}`, {
        count: requestCount,
        resetTime: now + windowMs,
        lastReset: now
      });
      
      return false;
    }

    entry.count += requestCount;
    return entry.count > this.config.edgeRateLimiting.requestsPerSecond;
  }

  // Generate unique identifier for rate limiting
  generateIdentifier(context: {
    ip?: string;
    userAgent?: string;
    userId?: string;
    sessionId?: string;
  }): string {
    const { ip, userAgent, userId, sessionId } = context;
    
    // Prefer user-based identification when available
    if (userId) return `user:${userId}`;
    if (sessionId) return `session:${sessionId}`;
    
    // Fall back to IP and User-Agent combination
    if (ip && userAgent) {
      return this.hashString(`${ip}:${userAgent}`);
    }
    
    return this.hashString(JSON.stringify(context));
  }

  // Simple hash function for identifier generation
  private hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    
    // Cleanup rate limit entries
    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now - entry.lastReset > this.config.windowMs * 2) {
        this.rateLimitMap.delete(key);
      }
    }

    // Cleanup bot detection entries
    for (const [key, entry] of this.botDetectionMap.entries()) {
      if (now - entry.lastAccess > this.config.windowMs * 2) {
        this.botDetectionMap.delete(key);
      }
    }
  }

  // Get rate limiting statistics
  getStatistics(): {
    totalEntries: number;
    activeEntries: number;
    botDetections: number;
    blockedRegions: string[];
  } {
    const now = Date.now();
    let activeEntries = 0;
    let botDetections = 0;

    for (const entry of this.rateLimitMap.values()) {
      if (now - entry.lastReset <= this.config.windowMs) {
        activeEntries++;
      }
    }

    for (const entry of this.botDetectionMap.values()) {
      if (now - entry.lastAccess <= this.config.windowMs) {
        botDetections++;
      }
    }

    return {
      totalEntries: this.rateLimitMap.size,
      activeEntries,
      botDetections,
      blockedRegions: this.config.regionBlocking.blockedRegions
    };
  }
}