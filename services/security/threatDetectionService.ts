

export interface ThreatConfig {
  enabled: boolean;
  loggingEnabled: boolean;
  alertThreshold: number;
  blockedPatternThreshold: number;
  suspiciousHeaderThreshold: number;
  contentLengthThreshold: number;
  endpoint: string;
}

export interface WAFRule {
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'allow' | 'block' | 'log' | 'alert';
  description: string;
}

export interface ThreatDetectionResult {
  threats: string[];
  riskScore: number;
  blocked: boolean;
  wafMatches: Array<{
    rule: string;
    severity: string;
    action: string;
    match: string;
  }>;
}

export class ThreatDetectionService {
  private config: ThreatConfig;
  private wafRules: WAFRule[];
  private blockedIPs = new Set<string>();
  private threatLog: Array<{
    timestamp: number;
    type: string;
    severity: string;
    details: any;
    ip?: string;
    userAgent?: string;
  }> = [];

  constructor(config: Partial<ThreatConfig> = {}) {
    this.config = {
      enabled: true,
      loggingEnabled: true,
      alertThreshold: 80,
      blockedPatternThreshold: 3,
      suspiciousHeaderThreshold: 5,
      contentLengthThreshold: 10 * 1024 * 1024, // 10MB
      endpoint: '/api/security/threats',
      ...config
    };

    this.wafRules = [
      {
        name: 'SQL Injection',
        pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
        severity: 'critical',
        action: 'block',
        description: 'Detects SQL injection attempts'
      },
      {
        name: 'XSS Attempt',
        pattern: /(<script[^>]*>.*?<\/script>)|(javascript:)|(on\w+\s*=)/i,
        severity: 'high',
        action: 'block',
        description: 'Detects cross-site scripting attempts'
      },
      {
        name: 'Path Traversal',
        pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|\.\.%2f|%2e%2e\\)/i,
        severity: 'high',
        action: 'block',
        description: 'Detects path traversal attacks'
      },
      {
        name: 'Command Injection',
        pattern: /(;|\||&|\$\(|\`|\${|;|\||&)/i,
        severity: 'critical',
        action: 'block',
        description: 'Detects command injection attempts'
      },
      {
        name: 'LDAP Injection',
        pattern: /(\(|\)|\*|&|\||!|=)/i,
        severity: 'medium',
        action: 'log',
        description: 'Detects LDAP injection attempts'
      },
      {
        name: 'NoSQL Injection',
        pattern: /(\$where|\$ne|\$gt|\$lt|\$in|\$nin)/i,
        severity: 'high',
        action: 'block',
        description: 'Detects NoSQL injection attempts'
      },
      {
        name: 'XXE Attack',
        pattern: /(<\!DOCTYPE.*\[.*\]>)|(&\w+;)/i,
        severity: 'high',
        action: 'block',
        description: 'Detects XML External Entity attacks'
      },
      {
        name: 'SSRF Attempt',
        pattern: /(https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.))/i,
        severity: 'critical',
        action: 'block',
        description: 'Detects Server-Side Request Forgery'
      },
      {
        name: 'Buffer Overflow',
        pattern: /(A{1000,}|.{500000,})/i,
        severity: 'medium',
        action: 'block',
        description: 'Detects potential buffer overflow attempts'
      }
    ];
  }

  detectThreats(request: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    ip?: string;
    userAgent?: string;
  }): ThreatDetectionResult {
    if (!this.config.enabled) {
      return { threats: [], riskScore: 0, blocked: false, wafMatches: [] };
    }

    const threats: string[] = [];
    let riskScore = 0;
    let blocked = false;
    const wafMatches: ThreatDetectionResult['wafMatches'] = [];

    const { url = '', method = '', headers = {}, body, ip = '', userAgent = '' } = request;

    // Check URL and parameters
    const urlWithParams = url + JSON.stringify(body || {});
    for (const rule of this.wafRules) {
      const matches = urlWithParams.match(rule.pattern);
      if (matches) {
        riskScore += this.getSeverityScore(rule.severity);
        
        if (rule.action === 'block') {
          blocked = true;
        }
        
        if (rule.action === 'block' || rule.action === 'alert') {
          threats.push(`${rule.name}: ${rule.description}`);
        }

        wafMatches.push({
          rule: rule.name,
          severity: rule.severity,
          action: rule.action,
          match: matches[0]
        });

        this.logThreat({
          type: 'waf_match',
          severity: rule.severity,
          details: { rule: rule.name, match: matches[0], url },
          ip,
          userAgent
        });
      }
    }

    // Check for suspicious User-Agent patterns
    const suspiciousUserAgents = [
      /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i,
      /python/i, /java/i, /node/i, /go-http/i, /masscan/i, /zmap/i
    ];

    for (const pattern of suspiciousUserAgents) {
      if (pattern.test(userAgent)) {
        riskScore += 10;
        threats.push(`Suspicious User-Agent: ${pattern.source}`);
      }
    }

    // Check for HTTP method abuse
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(method.toUpperCase())) {
      riskScore += 15;
      threats.push(`Unusual HTTP method: ${method}`);
    }

    // Check for unusual header patterns
    const suspiciousHeaders: string[] = [];
    const headerEntries = Object.entries(headers);

    for (const [key, value] of headerEntries) {
      const headerKey = key.toLowerCase();

      // Check for header injection
      if (headerKey.includes('content-type') && value.includes('multipart/form-data')) {
        // Valid content-type, continue
      } else if (headerKey.includes('x-') && value.length > 200) {
        suspiciousHeaders.push(`${key}: unusually long value`);
        riskScore += 5;
      }

      // Check for suspicious headers
      const headerPatterns = [
        { pattern: /admin/i, severity: 10 },
        { pattern: /test/i, severity: 5 },
        { pattern: /debug/i, severity: 8 },
        { pattern: /trace/i, severity: 12 }
      ];

      for (const { pattern, severity } of headerPatterns) {
        if (pattern.test(value)) {
          suspiciousHeaders.push(`${key}: suspicious pattern ${pattern.source}`);
          riskScore += severity;
        }
      }
    }

    // Check Content-Length abuse
    const contentLength = parseInt(headers['content-length'] || '0');
    if (contentLength > this.config.contentLengthThreshold) {
      riskScore += 20;
      threats.push(`Excessive content length: ${contentLength} bytes`);
    }

    // Check IP blocklist
    if (this.isIPBlocked(ip)) {
      blocked = true;
      riskScore += 50;
      threats.push('Blocked IP address detected');
    }

    // Edge-specific threat detection
    const edgeThreats = this.detectEdgeThreats(request);
    threats.push(...edgeThreats.threats);
    riskScore += edgeThreats.riskScore;
    if (edgeThreats.blocked) blocked = true;

    // Log high-risk threats
    if (riskScore >= this.config.alertThreshold) {
      this.logThreat({
        type: 'high_risk_detection',
        severity: 'high',
        details: { threats, riskScore, url, method },
        ip,
        userAgent
      });
    }

    return {
      threats,
      riskScore: Math.min(riskScore, 100),
      blocked: blocked || riskScore >= this.config.alertThreshold,
      wafMatches
    };
  }

  private detectEdgeThreats(request: {
    url?: string;
    headers?: Record<string, string>;
    ip?: string;
  }): { threats: string[]; riskScore: number; blocked: boolean } {
    const threats: string[] = [];
    let riskScore = 0;
    let blocked = false;

    const { url = '', ip = '' } = request;

    // Monitor request patterns for edge abuse
    const requests = this.getRecentEdgeRequests();
    const anomalies = this.detectEdgeAnomalies(requests);
    
    threats.push(...anomalies);
    riskScore += anomalies.length * 10;

    // Check for rapid region hopping
    const regions = this.getRegionsFromIP(ip);
    if (regions.length > 3) {
      riskScore += 25;
      threats.push('Rapid region hopping detected');
    }

    // Check for unusual request frequency
    const recentRequests = requests.filter(r => 
      r.timestamp > Date.now() - 60000 && 
      (r.endpoint === url || r.ip === ip)
    );

    if (recentRequests.length > 100) {
      riskScore += 30;
      threats.push('Unusual request frequency');
      if (recentRequests.length > 200) {
        blocked = true;
      }
    }

    return { threats, riskScore, blocked };
  }

  private getRegionsFromIP(ip: string): string[] {
    // Simplified region detection - in production, use GeoIP database
    if (ip.startsWith('192.168.') || ip.startsWith('10.')) return ['internal'];
    if (ip.startsWith('127.')) return ['localhost'];
    return ['unknown'];
  }

  private getRecentEdgeRequests(): Array<{ timestamp: number; region: string; endpoint: string; ip: string }> {
    // In a real implementation, this would pull from edge metrics
    // For now, return empty array
    return [];
  }

  private detectEdgeAnomalies(requests: Array<{ timestamp: number; region: string; endpoint: string; ip: string }>): string[] {
    const anomalies: string[] = [];
    
    // Check for unusual patterns
    const regionCounts = new Map<string, number>();
    const endpointCounts = new Map<string, number>();

    for (const request of requests) {
      regionCounts.set(request.region, (regionCounts.get(request.region) || 0) + 1);
      endpointCounts.set(request.endpoint, (endpointCounts.get(request.endpoint) || 0) + 1);
    }

    // Check for unusual region distribution
    const regionValues = Array.from(regionCounts.values());
    const maxRegionRequests = Math.max(...regionValues);
    const avgRegionRequests = regionValues.reduce((a, b) => a + b, 0) / regionValues.length;

    if (maxRegionRequests > avgRegionRequests * 3) {
      anomalies.push('Unusual regional request concentration');
    }

    // Check for rapid endpoint hopping
    const uniqueEndpoints = endpointCounts.size;
    if (uniqueEndpoints > 10 && requests.length > 50) {
      anomalies.push('Rapid endpoint hopping detected');
    }

    return anomalies;
  }

  private isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  private getSeverityScore(severity: string): number {
    const scores = {
      low: 5,
      medium: 15,
      high: 30,
      critical: 50
    };
    return scores[severity as keyof typeof scores] || 10;
  }

  private logThreat(entry: {
    type: string;
    severity: string;
    details: any;
    ip?: string;
    userAgent?: string;
  }): void {
    if (!this.config.loggingEnabled) return;

    this.threatLog.push({
      timestamp: Date.now(),
      ...entry
    });

    // Keep only last 1000 entries
    if (this.threatLog.length > 1000) {
      this.threatLog = this.threatLog.slice(-1000);
    }

    // In production, send to security monitoring service
    if (entry.severity === 'critical' || entry.severity === 'high') {
      this.triggerSecurityAlert(entry.type, entry.details);
    }
  }

  private triggerSecurityAlert(type: string, data: any): void {
    // In production, integrate with security alerting system
    console.warn(`🚨 SECURITY ALERT [${type}]:`, data);
  }

  // Public methods for managing threats
  blockIP(ip: string, reason?: string): void {
    this.blockedIPs.add(ip);
    this.logThreat({
      type: 'ip_blocked',
      severity: 'medium',
      details: { reason },
      ip
    });
  }

  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.logThreat({
      type: 'ip_unblocked',
      severity: 'low',
      details: {},
      ip
    });
  }

  getThreatStatistics(): {
    totalThreats: number;
    blockedIPs: number;
    recentThreats: number;
    topThreatTypes: Array<{ type: string; count: number }>;
  } {
    const recentThreats = this.threatLog.filter(t => 
      Date.now() - t.timestamp < 3600000 // Last hour
    ).length;

    const threatTypes = new Map<string, number>();
    for (const threat of this.threatLog) {
      threatTypes.set(threat.type, (threatTypes.get(threat.type) || 0) + 1);
    }

    const topThreatTypes = Array.from(threatTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    return {
      totalThreats: this.threatLog.length,
      blockedIPs: this.blockedIPs.size,
      recentThreats,
      topThreatTypes
    };
  }

  addWAFCustomRule(rule: Omit<WAFRule, 'name'> & { name?: string }): void {
    const newRule: WAFRule = {
      name: rule.name || `Custom_${Date.now()}`,
      ...rule
    };
    
    this.wafRules.push(newRule);
    this.logThreat({
      type: 'waf_rule_added',
      severity: 'low',
      details: { rule: newRule.name, pattern: newRule.pattern.source }
    });
  }

  removeWAFCustomRule(ruleName: string): boolean {
    const initialLength = this.wafRules.length;
    this.wafRules = this.wafRules.filter(rule => rule.name !== ruleName);
    
    if (this.wafRules.length < initialLength) {
      this.logThreat({
        type: 'waf_rule_removed',
        severity: 'low',
        details: { ruleName }
      });
      return true;
    }
    
    return false;
  }
}