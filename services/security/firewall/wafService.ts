interface WAFPattern {
  name: string;
  patterns: RegExp[];
  riskScore: number;
}

interface WAFDetectionResult {
  isMalicious: boolean;
  threats: string[];
  riskScore: number;
  blockedPatterns?: Array<{
    name: string;
    pattern: string;
    matches: string[];
  }>;
}

interface WAFConfig {
  enabled: boolean;
  strictMode: boolean;
  logLevel: 'info' | 'warn' | 'error';
  threshold: {
    medium: number;
    high: number;
    critical: number;
  };
}

interface RequestAnalysis {
  method: string;
  url: string;
  userAgent: string;
  referer: string;
  origin: string;
  host?: string;
  headers: Record<string, string>;
  body?: string;
}

export class WAFService {
  private static instance: WAFService;
  private config: WAFConfig;
  private wafPatterns: WAFPattern[];
  private blockedIPs = new Set<string>();
  private suspiciousPatterns = new Map<string, number>();

  private constructor() {
    this.config = {
      enabled: true,
      strictMode: false,
      logLevel: 'warn',
      threshold: {
        medium: 50,
        high: 70,
        critical: 85
      }
    };

    this.wafPatterns = this.initializePatterns();
  }

  static getInstance(): WAFService {
    if (!WAFService.instance) {
      WAFService.instance = new WAFService();
    }
    return WAFService.instance;
  }

  detectWAFPatterns(request: Request | RequestAnalysis): WAFDetectionResult {
    if (!this.config.enabled) {
      return { isMalicious: false, threats: [], riskScore: 0 };
    }

    const threats: string[] = [];
    let riskScore = 0;
    const blockedPatterns: Array<{ name: string; pattern: string; matches: string[] }> = [];

    // Extract request details
    const analysis = this.parseRequest(request);
    
    // Create input to analyze (URL + headers + optional body)
    const inputToAnalyze = [
      analysis.url,
      analysis.method,
      analysis.userAgent,
      analysis.referer,
      analysis.origin,
      analysis.body || '',
      JSON.stringify(analysis.headers)
    ].join(' ');

    // Check each pattern category
    for (const category of this.wafPatterns) {
      const matches: string[] = [];
      let categoryScore = 0;

      for (const pattern of category.patterns) {
        const matchesFound = inputToAnalyze.match(pattern);
        if (matchesFound) {
          matches.push(...matchesFound);
          categoryScore += category.riskScore;
        }
      }

      if (matches.length > 0) {
        threats.push(category.name);
        riskScore += categoryScore;
        blockedPatterns.push({
          name: category.name,
          pattern: category.patterns[0]?.toString() || '',
          matches: matches.slice(0, 5) // Limit to first 5 matches
        });
      }
    }

    // Additional heuristic checks
    const heuristicScore = this.performHeuristicAnalysis(analysis);
    riskScore += heuristicScore;

    const isMalicious = riskScore >= (this.config.strictMode ? this.config.threshold.medium : this.config.threshold.high);

    if (isMalicious && this.config.logLevel !== 'info') {
      console.warn(`WAF: Malicious request detected (Score: ${riskScore})`, {
        url: analysis.url,
        method: analysis.method,
        userAgent: analysis.userAgent,
        threats,
        riskScore
      });
    }

    return {
      isMalicious,
      threats: [...new Set(threats)], // Remove duplicates
      riskScore: Math.min(riskScore, 100),
      blockedPatterns: isMalicious ? blockedPatterns : undefined
    };
  }

  // Check for bot and scanner detection
  detectBotActivity(userAgent: string, ip: string, _requestPattern: any): {
    isBot: boolean;
    botType: string;
    confidence: number;
  } {
    if (!userAgent) {
      return { isBot: true, botType: 'empty-user-agent', confidence: 0.8 };
    }

    const suspiciousPatterns = [
      /(?:^|\s)(?:sqlmap|nikto|nmap|masscan|dirb|gobuster|wfuzz|burp|owasp|scanner)(?:\s|$)/gi,
      /(?:^|\s)(?:bot|crawler|spider|scraper)(?:\s|$)/gi,
      /python-requests|curl|wget|httpie|postman/gi,
      /automated|script|harvest|extract/gi
    ];

    let maxConfidence = 0;
    let detectedType = 'unknown';

    suspiciousPatterns.forEach((pattern, index) => {
      if (pattern.test(userAgent)) {
        const confidence = 0.6 + (index * 0.1);
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          detectedType = pattern.source.match(/\/([\w-]+)\//)?.[1] || 'pattern-match';
        }
      }
    });

    // Check for empty user agent
    if (!userAgent || userAgent.length < 10) {
      maxConfidence = Math.max(maxConfidence, 0.7);
      detectedType = 'minimal-user-agent';
    }

    // Check for known malicious IPs (placeholder for real implementation)
    if (this.blockedIPs.has(ip)) {
      return { isBot: true, botType: 'blocked-ip', confidence: 1.0 };
    }

    return {
      isBot: maxConfidence > 0.6,
      botType: detectedType,
      confidence: maxConfidence
    };
  }

  // Check for HTTP header anomalies
  detectHeaderAnomalies(headers: Record<string, string>): {
    hasAnomalies: boolean;
    anomalies: string[];
    riskScore: number;
  } {
    const anomalies: string[] = [];
    let riskScore = 0;

    // Suspicious header patterns
    const suspiciousHeaders = [
      { header: 'X-Forwarded-For', check: (value: string) => /[^0-9.,\s]/.test(value) },
      { header: 'User-Agent', check: (value: string) => !value || value.length > 500 },
      { header: 'Referer', check: (value: string) => value && !value.startsWith('http') },
      { header: 'Origin', check: (value: string) => value && !value.startsWith('http') }
    ];

    suspiciousHeaders.forEach(({ header, check }) => {
      const value = headers[header.toLowerCase()] || headers[header];
      if (value && check(value)) {
        anomalies.push(`Suspicious ${header} header`);
        riskScore += 10;
      }
    });

    // Check for missing required headers in certain contexts
    if (!headers['user-agent']) {
      anomalies.push('Missing User-Agent header');
      riskScore += 15;
    }

    // Check for unusual header count
    const headerCount = Object.keys(headers).length;
    if (headerCount > 50) {
      anomalies.push('Excessive number of headers');
      riskScore += 20;
    }

    return {
      hasAnomalies: anomalies.length > 0,
      anomalies,
      riskScore
    };
  }

  // Rate limiting for repeated attacks
  isAttackPatternRepeating(identifier: string, threshold: number = 5): boolean {
    const currentCount = this.suspiciousPatterns.get(identifier) || 0;
    this.suspiciousPatterns.set(identifier, currentCount + 1);
    
    // Reset counter after successful period (simplified - in real implementation, use time windows)
    setTimeout(() => {
      const count = this.suspiciousPatterns.get(identifier) || 0;
      if (count > 0) {
        this.suspiciousPatterns.set(identifier, count - 1);
      }
    }, 300000); // 5 minutes

    return currentCount >= threshold;
  }

  // Block IP address (admin function)
  blockIP(ip: string): void {
    this.blockedIPs.add(ip);
  }

  // Unblock IP address (admin function)
  unblockIP(ip: string): boolean {
    return this.blockedIPs.delete(ip);
  }

  // Get blocked IPs list (admin function)
  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }

  // Update WAF configuration
  updateConfig(newConfig: Partial<WAFConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Add custom patterns (admin function)
  addCustomPattern(category: string, patterns: RegExp[], riskScore: number): void {
    this.wafPatterns.push({
      name: category,
      patterns,
      riskScore
    });
  }

  // Get WAF statistics
  getWAFStats(): {
    blockedIPs: number;
    attackPatterns: number;
    topThreats: Array<{ threat: string; count: number }>;
  } {
    return {
      blockedIPs: this.blockedIPs.size,
      attackPatterns: Array.from(this.suspiciousPatterns.values()).reduce((a, b) => a + b, 0),
      topThreats: this.wafPatterns.map(pattern => ({
        threat: pattern.name,
        count: 0 // Would need real tracking for accurate count
      }))
    };
  }

  private parseRequest(request: Request | RequestAnalysis): RequestAnalysis {
    if ('method' in request) {
      // It's a RequestAnalysis object
      return request as RequestAnalysis;
    }

    // It's a Request object
    const req = request as Request;
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent') || '',
      referer: req.headers.get('referer') || '',
      origin: req.headers.get('origin') || '',
      host: req.headers.get('host') || '',
      headers,
      body: undefined // Would need to read body asynchronously
    };
  }

  private performHeuristicAnalysis(analysis: RequestAnalysis): number {
    let score = 0;

    // Unusual HTTP methods
    const unusualMethods = ['TRACE', 'CONNECT', 'DEBUG', 'PATCH'];
    if (unusualMethods.includes(analysis.method.toUpperCase())) {
      score += 30;
    }

    // Suspicious URL patterns
    const suspiciousUrls = [
      /\/admin/i,
      /\/wp-admin/i,
      /\/phpmyadmin/i,
      /\.\./g,
      /%2e%2e/gi
    ];

    suspiciousUrls.forEach(pattern => {
      if (pattern.test(analysis.url)) {
        score += 20;
      }
    });

    // Long URLs (potential buffer overflow attempt)
    if (analysis.url.length > 2000) {
      score += 25;
    }

    // Suspicious user agent characteristics
    if (analysis.userAgent.length > 500) {
      score += 15;
    }

    // Missing common headers
    if (!analysis.userAgent || !analysis.host) {
      score += 10;
    }

    return score;
  }

  private initializePatterns(): WAFPattern[] {
    return [
      {
        name: 'SQL Injection',
        patterns: [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
          /(--|\*\/|\/\*)/g,
          /(\bOR\b.*=.*\bOR\b)/gi,
          /(\bAND\b.*=.*\bAND\b)/gi,
          /('.*'|".*")/g,
          /waitfor\s+delay/gi,
          /benchmark\s*\(/gi,
          /sleep\s*\(/gi,
          /pg_sleep\s*\(/gi,
          /dbms_pipe\.receive_message/gi
        ],
        riskScore: 80
      },
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
        riskScore: 70
      },
      {
        name: 'Path Traversal',
        patterns: [
          /\.\.\//g,
          /\.\.\\/g,
          /%2e%2e%2f/gi,
          /%2e%2e\\/gi,
          /etc\/passwd/gi,
          /windows\/system32/gi,
          /\/proc\//gi,
          /\/sys\//gi
        ],
        riskScore: 75
      },
      {
        name: 'Command Injection',
        patterns: [
          /;\s*(rm|del|format|fdisk|mkfs)/gi,
          /\|\s*(nc|netcat|telnet|wget|curl)/gi,
          /&&\s*(rm|del|format|shutdown|reboot)/gi,
          /\$\(/g,
          /`[^`]*`/g,
          /\${[^}]*}/g,
          /eval\s*\(/gi,
          /exec\s*\(/gi,
          /system\s*\(/gi
        ],
        riskScore: 90
      },
      {
        name: 'LDAP Injection',
        patterns: [
          /\*\)/g,
          /\)\(/g,
          /\*\(/g,
          /&\(/g,
          /\|\(/g,
          /!\(/g,
          /\/\*/g,
          /\*\//g
        ],
        riskScore: 65
      },
      {
        name: 'NoSQL Injection',
        patterns: [
          /\$where/gi,
          /\$ne/gi,
          /\$gt/gi,
          /\$lt/gi,
          /\$in/gi,
          /\$nin/gi,
          /\$regex/gi,
          /\{.*\$.*\}/gi
        ],
        riskScore: 70
      },
      {
        name: 'XXE Attack',
        patterns: [
          /<!DOCTYPE/gi,
          /<!ENTITY/gi,
          /&[a-zA-Z]+;/g,
          /<\?xml/gi,
          /SYSTEM\s+"/gi,
          /PUBLIC\s+"/gi
        ],
        riskScore: 85
      },
      {
        name: 'SSRF Attack',
        patterns: [
          /localhost/gi,
          /127\.0\.0\.1/gi,
          /0x7f000001/gi,
          /2130706433/gi,
          /169\.254\./gi,
          /192\.168\./gi,
          /10\./gi,
          /172\.1[6-9]\./gi,
          /172\.2[0-9]\./gi,
          /172\.3[0-1]\./gi,
          /::1/gi,
          /metadata/gi
        ],
        riskScore: 80
      },
      {
        name: 'File Inclusion',
        patterns: [
          /php:\/\/filter/gi,
          /php:\/\/input/gi,
          /data:\/\//gi,
          /expect:\/\//gi,
          /file:\/\//gi,
          /ftp:\/\//gi,
          /http:\/\//gi,
          /https:\/\//gi,
          /zip:\/\//gi,
          /phar:\/\//gi
        ],
        riskScore: 75
      }
    ];
  }
}