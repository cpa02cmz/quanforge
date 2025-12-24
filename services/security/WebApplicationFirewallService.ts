/**
 * Web Application Firewall Service
 * 
 * Handles threat detection, request pattern analysis, and attack prevention.
 * This service provides comprehensive WAF protection against various attack vectors.
 * 
 * @author QuantForge Security Team
 * @version 1.0.0
 */

import { securityUtils } from './SecurityUtilsService';
import { securityMonitoring } from './SecurityMonitoringService';

export interface WAFResult {
  isMalicious: boolean;
  threats: string[];
  riskScore: number;
  blocked: boolean;
  details: {
    attackTypes: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  };
}

export interface EdgeRequest {
  timestamp: number;
  region: string;
  endpoint: string;
  method: string;
  userAgent: string;
  ip: string;
}

export interface WAFPattern {
  name: string;
  patterns: RegExp[];
  riskScore: number;
  description: string;
}

export interface WAFConfig {
  enabled: boolean;
  strictMode: boolean;
  blockThreshold: number;
  monitoringEnabled: boolean;
  edgeMonitoringEnabled: boolean;
  blockedRegions: string[];
  botDetectionEnabled: boolean;
  suspiciousPatterns: string[];
}

export interface WAFStats {
  totalRequests: number;
  blockedRequests: number;
  threatDetections: Array<{ threat: string; count: number }>;
  topAttackTypes: Array<{ threat: string; count: number }>;
  blockedRegions: Array<{ region: string; count: number }>;
  detectionAccuracy: number;
}

/**
 * Web Application Firewall service for threat detection and prevention
 */
export class WebApplicationFirewallService {
  private static instance: WebApplicationFirewallService;
  private config: WAFConfig;
  private requestHistory: EdgeRequest[] = [];
  private blockedIPs = new Map<string, { expiresAt: number; reason: string }>();
  private threatCounters = new Map<string, number>();
  private isEdgeWAFSetup = false;

  private constructor() {
    this.config = {
      enabled: true,
      strictMode: false,
      blockThreshold: 50,
      monitoringEnabled: true,
      edgeMonitoringEnabled: true,
      blockedRegions: ['CN', 'RU', 'IR', 'KP'], // Example blocked regions
      botDetectionEnabled: true,
      suspiciousPatterns: [
        'sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster', 
        'wfuzz', 'burp', 'owasp', 'scanner', 'bot', 'crawler', 'spider'
      ]
    };

    this.setupEdgeWAF();
  }

  static getInstance(): WebApplicationFirewallService {
    if (!WebApplicationFirewallService.instance) {
      WebApplicationFirewallService.instance = new WebApplicationFirewallService();
    }
    return WebApplicationFirewallService.instance;
  }

  /**
   * Main threat detection method
   */
  detectWAFPatterns(request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }): WAFResult {
    const threats: string[] = [];
    let riskScore = 0;
    const attackTypes: string[] = [];

    // Extract request information
    const { url, method, headers, body } = request;
    const userAgent = headers['user-agent'] || '';
    const referer = headers['referer'] || '';
    const origin = headers['origin'] || '';

    // Run through all WAF patterns
    for (const pattern of this.getWAFPatterns()) {
      for (const regex of pattern.patterns) {
        const testString = [url, body, userAgent, referer, origin].join(' ');
        if (regex.test(testString)) {
          threats.push(pattern.name);
          riskScore += pattern.riskScore;
          attackTypes.push(pattern.name.toLowerCase().replace(/\s+/g, '-'));

          securityUtils.logSecurityEvent('WAFThreatDetected', {
            threatType: pattern.name,
            pattern: regex.source,
            url,
            userAgent
          });
        }
      }
    }

    // Bot detection
    if (this.config.botDetectionEnabled) {
      const botResult = this.detectBot(userAgent);
      if (botResult.isBot) {
        threats.push('Suspicious Bot');
        riskScore += 30;
        attackTypes.push('bot-activity');
      }
    }

    // Check for suspicious patterns
    if (this.detectSuspiciousPatterns(userAgent + url)) {
      threats.push('Suspicious Activity Pattern');
      riskScore += 25;
      attackTypes.push('suspicious-pattern');
    }

    // Determine if request should be blocked
    const blocked = this.shouldBlockRequest(riskScore, threats.length);

    // Update threat counters
    threats.forEach(threat => {
      this.threatCounters.set(threat, (this.threatCounters.get(threat) || 0) + 1);
    });

    // Calculate confidence and severity
    const confidence = Math.min(100, (threats.length * 20) + (riskScore / 2));
    const severity = this.calculateSeverity(riskScore);

    // Log to monitoring service
    if (this.config.monitoringEnabled) {
      securityMonitoring.recordSecurityEvent(
        blocked ? 'waf_block' : 'waf_detection',
        {
          url,
          method,
          threats,
          riskScore,
          blocked,
          severity
        },
        severity
      );
    }

    return {
      isMalicious: threats.length > 0,
      threats,
      riskScore,
      blocked,
      details: {
        attackTypes,
        severity,
        confidence
      }
    };
  }

  /**
   * Get WAF patterns for threat detection
   */
  private getWAFPatterns(): WAFPattern[] {
    return [
      // SQL Injection patterns
      {
        name: 'SQL Injection',
        patterns: [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
          /(--|\*\/|\/\*)/g,
          /(\bOR\b.*=.*\bOR\b)/gi,
          /(\bAND\b.*=.*\bAND\b)/gi,
          /waitfor\s+delay/gi,
          /benchmark\s*\(/gi,
          /sleep\s*\(/gi,
          /pg_sleep\s*\(/gi,
          /dbms_pipe\.receive_message/gi
        ],
        riskScore: 80,
        description: 'SQL injection attack attempts'
      },
      // XSS patterns
      {
        name: 'Cross-Site Scripting',
        patterns: [
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          /javascript:/gi,
          /on\w+\s*=/gi,
          /<iframe\b[^>]*>/gi,
          /<object\b[^>]*>/gi,
          /<embed\b[^>]*>/gi,
          /vbscript:/gi,
          /data:text\/html/gi,
          /expression\(/gi,
          /@import/gi,
          /binding:\s*source/gi
        ],
        riskScore: 70,
        description: 'Cross-site scripting attack attempts'
      },
      // Path Traversal
      {
        name: 'Path Traversal',
        patterns: [
          /\.\.[\/\\]/g,
          /%2e%2e[\/\\]/gi,
          /^(\/|[a-z]:\\|\\\\)/i,
          /\betc\/passwd\b/gi,
          /\bwindows\\system32\b/gi,
          /file:\/\/\//gi
        ],
        riskScore: 60,
        description: 'Path traversal attack attempts'
      },
      // Command Injection
      {
        name: 'Command Injection',
        patterns: [
          /[;&|`$(){}[\]]+/g,
          /eval\s*\(/gi,
          /exec\s*\(/gi,
          /system\s*\(/gi,
          /passthru\s*\(/gi,
          /shell_exec\s*\(/gi,
          /\$(\w+)/g
        ],
        riskScore: 75,
        description: 'Command injection attack attempts'
      },
      // LDAP Injection
      {
        name: 'LDAP Injection',
        patterns: [
          /\*\(.*\)/gi,
          /[()&|!=<>~*]/g,
          /\)\([^\)]*\)\(/gi
        ],
        riskScore: 55,
        description: 'LDAP injection attack attempts'
      },
      // NoSQL Injection
      {
        name: 'NoSQL Injection',
        patterns: [
          /\$where/gi,
          /\$ne/gi,
          /\$gt/gi,
          /\$lt/gi,
          /\$in/gi,
          /\$nin/gi,
          /\$regex/gi
        ],
        riskScore: 65,
        description: 'NoSQL injection attack attempts'
      },
      // XXE (XML External Entity)
      {
        name: 'XXE Attack',
        patterns: [
          /<!DOCTYPE/gi,
          /<\?xml/gi,
          /&[a-zA-Z];/g,
          /SYSTEM/gi,
          /PUBLIC/gi
        ],
        riskScore: 70,
        description: 'XXE attack attempts'
      },
      // SSRF (Server-Side Request Forgery)
      {
        name: 'SSRF Attack',
        patterns: [
          /localhost/gi,
          /127\.0\.0\.1/gi,
          /192\.168\./gi,
          /10\./gi,
          /169\.254\./gi,
          /::1/gi,
          /0x7f000001/gi
        ],
        riskScore: 75,
        description: 'Server-side request forgery attempts'
      },
      // File Inclusion
      {
        name: 'File Inclusion',
        patterns: [
          /php:\/\//gi,
          /file:\/\//gi,
          /expect:\/\//gi,
          /data:\/\//gi,
          /zip:\/\//gi,
          /compress.zlib:\/\//gi
        ],
        riskScore: 60,
        description: 'File inclusion attack attempts'
      },
      // Header Injection
      {
        name: 'Header Injection',
        patterns: [
          /\r?\n[^s\r]*:/gi,
          /%0d%0a/gi,
          /\blocation\s*:/gi,
          /\brefresh\s*:/gi,
          /\bset-cookie\s*:/gi
        ],
        riskScore: 50,
        description: 'Header injection attempts'
      }
    ];
  }

  /**
   * Detect bot activity
   */
  private detectBot(userAgent: string): { isBot: boolean; type?: string } {
    const botPatterns = [
      { pattern: /bot/i, type: 'general-bot' },
      { pattern: /crawler/i, type: 'web-crawler' },
      { pattern: /spider/i, type: 'spider' },
      { pattern: /scrapy/i, type: 'scrapy-framework' },
      { pattern: /curl/i, type: 'curl-client' },
      { pattern: /wget/i, type: 'wget-client' },
      { pattern: /python/i, type: 'python-script' },
      { pattern: /java/i, type: 'java-application' },
      { pattern: /sqlmap/i, type: 'sql-injection-tool' },
      { pattern: /nikto/i, type: 'vulnerability-scanner' },
      { pattern: /nmap/i, type: 'network-scanner' },
      { pattern: /burp/i, type: 'burp-proxy' }
    ];

    for (const { pattern, type } of botPatterns) {
      if (pattern.test(userAgent)) {
        return { isBot: true, type };
      }
    }

    return { isBot: false };
  }

  /**
   * Detect suspicious patterns
   */
  private detectSuspiciousPatterns(input: string): boolean {
    return this.config.suspiciousPatterns.some(pattern => 
      input.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Determine if request should be blocked
   */
  private shouldBlockRequest(riskScore: number, threatCount: number): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (this.config.strictMode) {
      return riskScore > 0 || threatCount > 0;
    }

    return riskScore >= this.config.blockThreshold || threatCount >= 3;
  }

  /**
   * Calculate severity based on risk score
   */
  private calculateSeverity(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 150) return 'critical';
    if (riskScore >= 100) return 'high';
    if (riskScore >= 50) return 'medium';
    return 'low';
  }

  /**
   * Setup Edge WAF monitoring
   */
  private setupEdgeWAF(): void {
    if (!this.config.edgeMonitoringEnabled || this.isEdgeWAFSetup) {
      return;
    }

    // Start monitoring edge threats
    this.monitorEdgeThreats();
    
    // Setup periodic analysis
    setInterval(() => {
      this.analyzeEdgeRequestPatterns();
    }, 30000); // Every 30 seconds

    this.isEdgeWAFSetup = true;
    securityUtils.logSecurityEvent('EdgeWAFSetup');
  }

  /**
   * Monitor edge threats
   */
  private monitorEdgeThreats(): void {
    // This would integrate with edge infrastructure
    // For now, we'll simulate with request tracking
    setInterval(() => {
      const recentRequests = this.getRecentEdgeRequests();
      if (recentRequests.length > 0) {
        const anomalies = this.detectEdgeAnomalies(recentRequests);
        if (anomalies.length > 0) {
          securityUtils.logSecurityEvent('EdgeAnomalyDetected', { anomalies });
          
          if (this.config.monitoringEnabled) {
            securityMonitoring.recordSecurityEvent(
              'edge_anomaly',
              { anomalies, requestCount: recentRequests.length },
              'medium'
            );
          }
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Analyze edge request patterns
   */
  private analyzeEdgeRequestPatterns(): void {
    const recentRequests = this.getRecentEdgeRequests();
    
    // Analyze request frequency by region
    const regionCounts = new Map<string, number>();
    for (const request of recentRequests) {
      regionCounts.set(request.region, (regionCounts.get(request.region) || 0) + 1);
    }

    // Detect unusual patterns
    for (const [region, count] of regionCounts.entries()) {
      if (count > 100) { // Threshold for unusual activity
        securityUtils.logSecurityEvent('EdgeHighActivity', { region, count });
      }
    }

    // Clean old requests (keep last hour)
    const oneHourAgo = Date.now() - 3600000;
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > oneHourAgo);
  }

  /**
   * Get recent edge requests
   */
  private getRecentEdgeRequests(): EdgeRequest[] {
    const fiveMinutesAgo = Date.now() - 300000; // Last 5 minutes
    return this.requestHistory.filter(req => req.timestamp > fiveMinutesAgo);
  }

  /**
   * Detect anomalies in edge requests
   */
  private detectEdgeAnomalies(requests: EdgeRequest[]): string[] {
    const anomalies: string[] = [];

    // Analyze request frequency
    if (requests.length > 1000) {
      anomalies.push('High request volume detected');
    }

    // Analyze unique IPs
    const uniqueIPs = new Set(requests.map(req => req.ip)).size;
    if (uniqueIPs < 10 && requests.length > 100) {
      anomalies.push('Low unique IP count with high volume');
    }

    // Analyze endpoint distribution
    const endpointCounts = new Map<string, number>();
    for (const req of requests) {
      endpointCounts.set(req.endpoint, (endpointCounts.get(req.endpoint) || 0) + 1);
    }

    // Check for endpoint concentration (possible DoS)
    for (const [endpoint, count] of endpointCounts.entries()) {
      if (count > requests.length * 0.8) {
        anomalies.push(`Endpoint concentration: ${endpoint}`);
      }
    }

    return anomalies;
  }

  /**
   * Record edge request
   */
  recordEdgeRequest(request: EdgeRequest): void {
    this.requestHistory.push(request);
    
    // Keep only recent requests for memory efficiency
    if (this.requestHistory.length > 10000) {
      const oneHourAgo = Date.now() - 3600000;
      this.requestHistory = this.requestHistory.filter(req => req.timestamp > oneHourAgo);
    }
  }

  /**
   * Block IP address temporarily
   */
  blockIP(ip: string, durationMinutes: number = 60, reason?: string): void {
    const expiresAt = Date.now() + (durationMinutes * 60000);
    this.blockedIPs.set(ip, { expiresAt, reason: reason || 'Security violation' });
    securityUtils.logSecurityEvent('IPBlocked', { ip, durationMinutes, reason });
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    const blockedInfo = this.blockedIPs.get(ip);
    if (!blockedInfo) {
      return false;
    }

    if (Date.now() > blockedInfo.expiresAt) {
      this.blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  /**
   * Get WAF statistics
   */
  getWAFStats(): WAFStats {
    const totalThreats = Array.from(this.threatCounters.values()).reduce((sum, count) => sum + count, 0);
    const blockedRequests = this.blockedIPs.size;

    // Get top attack types
    const topAttackTypes = Array.from(this.threatCounters.entries())
      .map(([threat, count]) => ({ threat, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate detection accuracy (simulated)
    const detectionAccuracy = totalThreats > 0 ? 
      Math.round(((totalThreats - (totalThreats * 0.05)) / totalThreats) * 100) : 100;

    return {
      totalRequests: this.requestHistory.length,
      blockedRequests,
      threatDetections: topAttackTypes.slice(0, 5),
      topAttackTypes,
      blockedRegions: [], // Would need region tracking
      detectionAccuracy
    };
  }

  /**
   * Get threat trends
   */
  getThreatTrends(_hours: number = 24): Array<{
    threat: string;
    count: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    // Analyze threats in recent requests (simplified)
    const trends = Array.from(this.threatCounters.entries())
      .map(([threat, count]) => ({
        threat,
        count,
        trend: 'stable' as 'increasing' | 'decreasing' | 'stable'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return trends;
  }

  /**
   * Clear blocked IPs
   */
  clearBlockedIPs(): number {
    const count = this.blockedIPs.size;
    this.blockedIPs.clear();
    securityUtils.logSecurityEvent('IPsCleared', { count });
    return count;
  }

  /**
   * Clean expired IP blocks
   */
  cleanupExpiredIPBlocks(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [ip, blockInfo] of this.blockedIPs.entries()) {
      if (now > blockInfo.expiresAt) {
        this.blockedIPs.delete(ip);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      securityUtils.logSecurityEvent('ExpiredIPBlocksCleaned', { count: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Test WAF with sample requests
   */
  testWAFPatterns(): Array<{
    test: string;
    result: WAFResult;
    expectedThreats: string[];
  }> {
    const testCases = [
      {
        name: 'SQL Injection Test',
        request: {
          url: 'https://example.com/api/search?q=SELECT%20*%20FROM%20users',
          method: 'GET',
          headers: {}
        },
        expectedThreats: ['SQL Injection']
      },
      {
        name: 'XSS Test',
        request: {
          url: 'https://example.com/api/comment',
          method: 'POST',
          headers: {}
        },
        expectedThreats: ['Cross-Site Scripting']
      },
      {
        name: 'Path Traversal Test',
        request: {
          url: 'https://example.com/api/file?path=../../../etc/passwd',
          method: 'GET',
          headers: {}
        },
        expectedThreats: ['Path Traversal']
      }
    ];

    return testCases.map(testCase => ({
      test: testCase.name,
      result: this.detectWAFPatterns(testCase.request),
      expectedThreats: testCase.expectedThreats
    }));
  }

  /**
   * Get current configuration
   */
  getConfig(): WAFConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<WAFConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.edgeMonitoringEnabled && !this.isEdgeWAFSetup) {
      this.setupEdgeWAF();
    }

    securityUtils.logSecurityEvent('WAFConfigUpdated', { newConfig });
  }

  /**
   * Add suspicious pattern
   */
  addSuspiciousPattern(pattern: string): void {
    if (!this.config.suspiciousPatterns.includes(pattern)) {
      this.config.suspiciousPatterns.push(pattern);
      securityUtils.logSecurityEvent('SuspiciousPatternAdded', { pattern });
    }
  }

  /**
   * Remove suspicious pattern
   */
  removeSuspiciousPattern(pattern: string): boolean {
    const index = this.config.suspiciousPatterns.indexOf(pattern);
    if (index > -1) {
      this.config.suspiciousPatterns.splice(index, 1);
      securityUtils.logSecurityEvent('SuspiciousPatternRemoved', { pattern });
      return true;
    }
    return false;
  }

  /**
   * Reset all WAF data
   */
  resetWAFData(): void {
    this.requestHistory = [];
    this.blockedIPs.clear();
    this.threatCounters.clear();
    securityUtils.logSecurityEvent('WAFDataReset');
  }
}

// Export singleton instance for convenience
export const webApplicationFirewall = WebApplicationFirewallService.getInstance();