export interface ThreatConfig {
  enabled: boolean;
  suspiciousPatterns: string[];
  wafEnabled: boolean;
  ipBlacklist: string[];
  ipWhitelist: string[];
  maxThreatScore: number;
}

export interface ThreatResult {
  isThreat: boolean;
  threatTypes: string[];
  riskScore: number;
  details: ThreatDetail[];
}

export interface ThreatDetail {
  type: 'bot' | 'xss' | 'sql_injection' | 'csrf' | 'file_upload' | 'waf' | 'rate_abuse' | 'geo_block';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  riskScore: number;
  matchedPattern?: string;
}

export interface DetectionContext {
  ip?: string;
  userAgent?: string;
  headers?: Record<string, string>;
  url?: string;
  method?: string;
  referer?: string;
  origin?: string;
  payload?: any;
  requestCount?: number;
  region?: string;
  requestPattern?: any;
}

export interface WAFPatterngroup {
  name: string;
  patterns: RegExp[];
  riskScore: number;
}

/**
 * ThreatDetectionService - Detects and analyzes various security threats
 * 
 * Responsibilities:
 * - Bot detection and classification
 * - XSS and injection attack detection
 * - WAF pattern matching
 * - Geographic threat analysis
 * - Request pattern analysis
 * - Threat scoring and classification
 * - IP reputation checking
 */
export class ThreatDetectionService {
  private config: ThreatConfig;
  private wafPatterns: WAFPatterngroup[] = [];
  private threatLog: ThreatLogEntry[] = [];
  private ipReputation = new Map<string, IPReputation>();

  constructor(config?: Partial<ThreatConfig>) {
    this.config = {
      enabled: true,
      suspiciousPatterns: [
        'sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster', 
        'wfuzz', 'burp', 'owasp', 'scanner', 'bot', 'crawler', 'spider'
      ],
      wafEnabled: true,
      ipBlacklist: [],
      ipWhitelist: [],
      maxThreatScore: 100,
      ...config
    };

    this.initializeWAFPatterns();
  }

  /**
   * Initialize WAF (Web Application Firewall) patterns
   */
  private initializeWAFPatterns(): void {
    this.wafPatterns = [
      // SQL Injection Patterns
      {
        name: 'SQL Injection',
        patterns: [
          /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
          /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
          /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
          /((\%27)|(\'))union/gi,
          /exec\s*\(\s*xp_cmdshell/gi,
          /((\%3C)|<)((\%69)|i|(\%49))((\%6D)|m|(\%4D))((\%67)|g|(\%47))/gi,
          /((\%3C)|<)((\%73)|s|(\%53))((\%63)|c|(\%43))((\%72)|r|(\%52))/gi,
          /((\%3C)|<)((\%73)|s|(\%53))((\%63)|c|(\%43))((\%72)|r|(\%52))\//gi
        ],
        riskScore: 90
      },

      // XSS Patterns
      {
        name: 'Cross-Site Scripting (XSS)',
        patterns: [
          /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/gi,
          /((\%3C)|<)((\%69)|i|(\%49))((\%6D)|m|(\%4D))((\%67)|g|(\%47))/gi,
          /((\%3C)|<)((\%73)|s|(\%53))((\%63)|c|(\%43))((\%72)|r|(\%52))((\%69)|i|(\%49))((\%70)|p|(\%50))((\%74)|t|(\%54))/gi,
          /((\%3C)|<)((\%6F)|o|(\%4F))((\%6E)|n|(\%4E))((\%6C)|l|(\%4C))((\%6F)|o|(\%4F))((\%61)|a|(\%41))((\%64)|d|(\%44))/gi,
          /((\%3C)|<)((\%73)|s|(\%53))((\%63)|c|(\%43))((\%72)|r|(\%52))((\%69)|i|(\%49))((\%70)|p|(\%50))((\%74)|t|(\%54))/gi,
          /((\%3C)|<)[^\n]+((\%3E)|>)/gi,
        ],
        riskScore: 80
      },

      // Directory Traversal
      {
        name: 'Directory Traversal',
        patterns: [
          /(\.\.\/)/gi,
          /(\.\.\\)/gi,
          /(\%2e\%2e\%2f)/gi,
          /(\%2e\%2e\\)/gi,
          /(\.%2e\/)/gi,
          /(\.%2e\\)/gi,
        ],
        riskScore: 75
      },

      // Command Injection
      {
        name: 'Command Injection',
        patterns: [
          /;\s*(whoami|id|uname|pwd|ls|dir|cat|type|netstat|ipconfig|ifconfig)/gi,
          /(\|\s*)(whoami|id|uname|pwd|ls|dir|cat|type|netstat|ipconfig|ifconfig)/gi,
          /(&&\s*)(whoami|id|uname|pwd|ls|dir|cat|type|netstat|ipconfig|ifconfig)/gi,
          /(\$\()[^)]*\)/gi,
          /`[^`]*`/gi,
          /\${[^}]*}/gi,
        ],
        riskScore: 85
      },

      // File Inclusion
      {
        name: 'File Inclusion',
        patterns: [
          /php:\/\/filter/gi,
          /php:\/\/input/gi,
          /data:\/\//gi,
          /expect:\/\//gi,
          /file:\/\//gi,
          /zip:\/\//gi,
          /phar:\/\//gi,
          /ssh2\.shell/gi,
          /ssh2\.exec/gi
        ],
        riskScore: 85
      },

      // Buffer Overflow
      {
        name: 'Buffer Overflow',
        patterns: [
          /A{1000,}/g,
          /%41{100,}/gi,
          /0x41{100,}/gi,
          /\x90{100,}/gi,
          /\x90{50,}\x31\xc0/gi
        ],
        riskScore: 75
      },

      // HTTP Header Injection
      {
        name: 'HTTP Header Injection',
        patterns: [
          /\r\n/gi,
          /%0d%0a/gi,
          /Content-Type:/gi,
          /Location:/gi,
          /Set-Cookie:/gi
        ],
        riskScore: 70
      },

      // LDAP Injection
      {
        name: 'LDAP Injection',
        patterns: [
          /\*[)]/gi,
          /[)]\*[)]/gi,
          /[)]\*[(]/gi,
          /[*][(][*]/gi
        ],
        riskScore: 80
      },

      // NoSQL Injection
      {
        name: 'NoSQL Injection',
        patterns: [
          /\$where/gi,
          /\$ne/gi,
          /\$gt/gi,
          /\$lt/gi,
          /\$regex/gi,
          /\{[^\}]*\$ne[^\}]*\}/gi
        ],
        riskScore: 85
      }
    ];
  }

  /**
   * Main threat detection entry point
   */
  detectThreats(context: DetectionContext): ThreatResult {
    if (!this.config.enabled) {
      return {
        isThreat: false,
        threatTypes: [],
        riskScore: 0,
        details: []
      };
    }

    const details: ThreatDetail[] = [];
    let totalRiskScore = 0;
    const threatTypes = new Set<string>();

    // Check IP reputation first
    const ipResult = this.checkIPReputation(context.ip ?? undefined);
    if (ipResult) {
      details.push(ipResult);
      threatTypes.add('ip_reputation');
      totalRiskScore += ipResult.riskScore;
    }

    // Bot detection
    const botResult = this.detectBot(context);
    if (botResult) {
      details.push(botResult);
      threatTypes.add('bot');
      totalRiskScore += botResult.riskScore;
    }

    // WAF pattern detection
    if (this.config.wafEnabled) {
      const wafResult = this.detectWAFThreats(context);
      if (wafResult) {
        details.push(wafResult);
        threatTypes.add('waf');
        totalRiskScore += wafResult.riskScore;
      }
    }

    // XSS detection
    const xssResult = this.detectXSS(context);
    if (xssResult) {
      details.push(xssResult);
      threatTypes.add('xss');
      totalRiskScore += xssResult.riskScore;
    }

    // SQL injection detection
    const sqlResult = this.detectSQLInjection(context);
    if (sqlResult) {
      details.push(sqlResult);
      threatTypes.add('sql_injection');
      totalRiskScore += sqlResult.riskScore;
    }

    // CSRF detection
    const csrfResult = this.detectCSRF(context);
    if (csrfResult) {
      details.push(csrfResult);
      threatTypes.add('csrf');
      totalRiskScore += csrfResult.riskScore;
    }

    // Rate abuse detection
    const rateResult = this.detectRateAbuse(context);
    if (rateResult) {
      details.push(rateResult);
      threatTypes.add('rate_abuse');
      totalRiskScore += rateResult.riskScore;
    }

    // Geographic threat detection
    const geoResult = this.detectGeographicThreat(context);
    if (geoResult) {
      details.push(geoResult);
      threatTypes.add('geo_block');
      totalRiskScore += geoResult.riskScore;
    }

    // Cap at maximum threat score
    totalRiskScore = Math.min(totalRiskScore, this.config.maxThreatScore);

    const isThreat = details.length > 0 && totalRiskScore > 0;

    // Log threat detection
    this.logThreatDetection(context, isThreat, totalRiskScore, details);

    return {
      isThreat,
      threatTypes: Array.from(threatTypes),
      riskScore: totalRiskScore,
      details
    };
  }

  /**
   * Check IP reputation
   */
  private checkIPReputation(ip?: string): ThreatDetail | null {
    if (!ip) return null;

    // Check whitelist first
    if (this.config.ipWhitelist.includes(ip)) {
      return null;
    }

    // Check blacklist
    if (this.config.ipBlacklist.includes(ip)) {
      return {
        type: 'bot',
        severity: 'critical',
        description: 'IP address is blacklisted',
        riskScore: 100,
        matchedPattern: ip
      };
    }

    // Check reputation database
    const reputation = this.ipReputation.get(ip);
    if (reputation && reputation.score < 50) {
      return {
        type: 'bot',
        severity: reputation.score < 25 ? 'high' : 'medium',
        description: `IP has poor reputation score: ${reputation.score}`,
        riskScore: 100 - reputation.score,
        matchedPattern: ip
      };
    }

    return null;
  }

  /**
   * Detect bot activity based on user agent and patterns
   */
  private detectBot(context: DetectionContext): ThreatDetail | null {
    if (!context.userAgent) return null;

    const suspiciousPatterns = this.config.suspiciousPatterns;
    let matchedPattern = '';
    let riskScore = 0;

    // Check suspicious patterns
    for (const pattern of suspiciousPatterns) {
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(context.userAgent)) {
        matchedPattern = pattern;
        riskScore += 50;
        break;
      }
    }

    // Check for automated tool characteristics
    const botCharacteristics = [
      /bot/gi,
      /crawler/gi,
      /spider/gi,
      /scraper/gi,
      /checker/gi,
      /probe/gi,
      /scan/gi,
      /\+http/gi,
      /java/gi,
      /python/gi,
      /curl/gi,
      /wget/gi,
      /powershell/gi
    ];

    let botMatches = 0;
    botCharacteristics.forEach(pattern => {
      if (pattern.test(context.userAgent ?? '')) {
        botMatches++;
        riskScore += 20;
      }
    });

    // Check for missing common browser features
    const missingBrowserFeatures = [
      !/mozilla/i.test(context.userAgent),
      !/webkit|gecko|trident/i.test(context.userAgent),
      context.userAgent.length < 10,
      context.userAgent.length > 200
    ].filter(Boolean).length;

    riskScore += missingBrowserFeatures * 15;

    if (riskScore > 30) {
      return {
        type: 'bot',
        severity: riskScore > 70 ? 'high' : 'medium',
        description: `Bot detected with ${botMatches} suspicious characteristics`,
        riskScore: Math.min(riskScore, 90),
        matchedPattern: matchedPattern || `Bot characteristics: ${botMatches}`
      };
    }

    return null;
  }

  /**
   * Detect WAF pattern matches
   */
  private detectWAFThreats(context: DetectionContext): ThreatDetail | null {
    const threats: string[] = [];
    let highestRiskScore = 0;
    let matchedPattern = '';

    // Check URL and parameters
    const textToCheck = [
      context.url || '',
      context.referer || '',
      context.origin || '',
      JSON.stringify(context.payload) || ''
    ].join(' ');

    this.wafPatterns.forEach(threat => {
      threat.patterns.forEach(pattern => {
        if (pattern.test(textToCheck)) {
          threats.push(threat.name);
          highestRiskScore = Math.max(highestRiskScore, threat.riskScore);
          matchedPattern = pattern.source;
        }
      });
    });

    if (threats.length > 0) {
      return {
        type: 'waf',
        severity: highestRiskScore > 80 ? 'critical' : highestRiskScore > 60 ? 'high' : 'medium',
        description: `WAF detected threats: ${threats.join(', ')}`,
        riskScore: highestRiskScore,
        matchedPattern
      };
    }

    return null;
  }

  /**
   * Detect XSS attacks
   */
  private detectXSS(context: DetectionContext): ThreatDetail | null {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /onerror\s*=/gi,
      /onload\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
      /vbscript:/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /@import/gi,
      /binding\s*:/gi
    ];

    const textToCheck = [
      context.url || '',
      context.referer || '',
      JSON.stringify(context.payload) || ''
    ].join(' ');

    for (const pattern of xssPatterns) {
      if (pattern.test(textToCheck)) {
        return {
          type: 'xss',
          severity: 'high',
          description: 'Potential XSS injection detected',
          riskScore: 80,
          matchedPattern: pattern.source
        };
      }
    }

    return null;
  }

  /**
   * Detect SQL injection attacks
   */
  private detectSQLInjection(context: DetectionContext): ThreatDetail | null {
    const sqlPatterns = [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
      /union\s+select/gi,
      /exec\s*\(/gi,
      /insert\s+into/gi,
      /delete\s+from/gi,
      /update\s+.+set/gi,
      /drop\s+(table|database)/gi
    ];

    const textToCheck = [
      context.url || '',
      JSON.stringify(context.payload) || ''
    ].join(' ');

    for (const pattern of sqlPatterns) {
      if (pattern.test(textToCheck)) {
        return {
          type: 'sql_injection',
          severity: 'critical',
          description: 'SQL injection attempt detected',
          riskScore: 90,
          matchedPattern: pattern.source
        };
      }
    }

    return null;
  }

  /**
   * Detect CSRF attempts
   */
  private detectCSRF(context: DetectionContext): ThreatDetail | null {
    // Simple CSRF detection based on referer and origin mismatch
    if (context.referer && context.origin) {
      try {
        const refererUrl = new URL(context.referer);
        const originUrl = new URL(context.origin);
        
        if (refererUrl.origin !== originUrl.origin) {
          return {
            type: 'csrf',
            severity: 'medium',
            description: 'Potential CSRF - referer and origin mismatch',
            riskScore: 60,
            matchedPattern: `${refererUrl.origin} -> ${originUrl.origin}`
          };
        }
      } catch (error) {
        // Invalid URL
      }
    }

    return null;
  }

  /**
   * Detect rate abuse patterns
   */
  private detectRateAbuse(context: DetectionContext): ThreatDetail | null {
    if (!context.requestCount) return null;

    // Check for excessive request patterns
    if (context.requestCount > 1000) {
      return {
        type: 'rate_abuse',
        severity: 'high',
        description: `Excessive request rate: ${context.requestCount} requests`,
        riskScore: Math.min(70 + Math.floor(context.requestCount / 100), 90),
        matchedPattern: `${context.requestCount} requests`
      };
    }

    if (context.requestCount > 500) {
      return {
        type: 'rate_abuse',
        severity: 'medium',
        description: `High request rate: ${context.requestCount} requests`,
        riskScore: Math.min(50 + Math.floor(context.requestCount / 100), 70),
        matchedPattern: `${context.requestCount} requests`
      };
    }

    return null;
  }

  /**
   * Detect geographic threats
   */
  private detectGeographicThreat(context: DetectionContext): ThreatDetail | null {
    // This would typically integrate with a GeoIP service
    // For now, just check for missing or suspicious regions
    if (!context.region) {
      return {
        type: 'geo_block',
        severity: 'low',
        description: 'Unable to determine geographic location',
        riskScore: 20
      };
    }

    // Add logic for high-risk regions if needed
    const highRiskRegions = ['XX']; // Unknown country code
    if (highRiskRegions.includes(context.region)) {
      return {
        type: 'geo_block',
        severity: 'medium',
        description: `Request from high-risk region: ${context.region}`,
        riskScore: 50,
        matchedPattern: context.region
      };
    }

    return null;
  }

  /**
   * Log threat detection for audit
   */
  private logThreatDetection(context: DetectionContext, isThreat: boolean, riskScore: number, details: ThreatDetail[]): void {
    const entry: ThreatLogEntry = {
      timestamp: new Date(),
      ip: context.ip,
      userAgent: context.userAgent,
      url: context.url,
      method: context.method,
      isThreat,
      riskScore,
      threatTypes: details.map(d => d.type),
      details: details.length
    };

    this.threatLog.push(entry);

    // Keep only last 10,000 entries
    if (this.threatLog.length > 10000) {
      this.threatLog = this.threatLog.slice(-10000);
    }
  }

  /**
   * Add IP to reputation database
   */
  updateIPReputation(ip: string, score: number, reason?: string): void {
    const reputation: IPReputation = {
      ip,
      score: Math.max(0, Math.min(100, score)), // Clamp to 0-100
      lastUpdated: new Date(),
      reason
    };

    this.ipReputation.set(ip, reputation);
  }

  /**
   * Get threat detection statistics
   */
  getStatistics(): {
    totalDetections: number;
    threatCount: number;
    topThreatTypes: Array<{ type: string; count: number }>;
    averageRiskScore: number;
    ipReputationEntries: number;
  } {
    const threatEntries = this.threatLog.filter(entry => entry.isThreat);
    const totalRiskScore = threatEntries.reduce((sum, entry) => sum + entry.riskScore, 0);
    
    const threatTypes = new Map<string, number>();
    threatEntries.forEach(entry => {
      entry.threatTypes.forEach(type => {
        threatTypes.set(type, (threatTypes.get(type) || 0) + 1);
      });
    });

    const topThreatTypes = Array.from(threatTypes.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalDetections: this.threatLog.length,
      threatCount: threatEntries.length,
      topThreatTypes,
      averageRiskScore: threatEntries.length > 0 ? totalRiskScore / threatEntries.length : 0,
      ipReputationEntries: this.ipReputation.size
    };
  }

  /**
   * Get threat log
   */
  getThreatLog(limit?: number): ThreatLogEntry[] {
    if (limit) {
      return this.threatLog.slice(-limit);
    }
    return [...this.threatLog];
  }

  /**
   * Clear threat log
   */
  clearThreatLog(): void {
    this.threatLog = [];
  }

  /**
   * Clear IP reputation database
   */
  clearIPReputation(): void {
    this.ipReputation.clear();
  }

  /**
   * Add IP to blacklist
   */
  addIPToBlacklist(ip: string): void {
    if (!this.config.ipBlacklist.includes(ip)) {
      this.config.ipBlacklist.push(ip);
    }
  }

  /**
   * Remove IP from blacklist
   */
  removeIPFromBlacklist(ip: string): void {
    const index = this.config.ipBlacklist.indexOf(ip);
    if (index !== -1) {
      this.config.ipBlacklist.splice(index, 1);
    }
  }

  /**
   * Add IP to whitelist
   */
  addIPToWhitelist(ip: string): void {
    if (!this.config.ipWhitelist.includes(ip)) {
      this.config.ipWhitelist.push(ip);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ThreatConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ThreatConfig {
    return { ...this.config };
  }
}

// Supporting interfaces
interface ThreatLogEntry {
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  url?: string;
  method?: string;
  isThreat: boolean;
  riskScore: number;
  threatTypes: string[];
  details: number;
}

interface IPReputation {
  ip: string;
  score: number; // 0-100, higher is better
  lastUpdated: Date;
  reason?: string;
}