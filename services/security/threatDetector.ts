export interface WAFPattern {
  name: string;
  patterns: RegExp[];
  riskScore: number;
}

export interface WAFResult {
  isMalicious: boolean;
  threats: string[];
  riskScore: number;
}

export interface CSPViolation {
  blockedURI: string;
  documentURI: string;
  referrer: string;
  violatedDirective: string;
  effectiveDirective: string;
  originalPolicy: string;
  disposition: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  statusCode?: number;
  sample?: string;
  timestamp: number;
}

export interface SecurityAlert {
  type: string;
  data: any;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
}

export interface EdgeAnomaly {
  timestamp: number;
  region: string;
  endpoint: string;
}

export interface BotDetection {
  isBot: boolean;
  confidence: number;
  botType?: string;
}

export class ThreatDetector {
  private config: {
    endpoint?: string;
    maxPayloadSize: number;
    edgeRateLimiting: {
      enabled: boolean;
      requestsPerSecond: number;
      burstLimit: number;
    };
    regionBlocking: {
      enabled: boolean;
      blockedRegions: string[];
    };
    botDetection: {
      enabled: boolean;
      suspiciousPatterns: string[];
    };
  };

  private wafPatterns: WAFPattern[] = [];
  private cspViolations: CSPViolation[] = [];
  private securityAlerts: SecurityAlert[] = [];

  constructor(config: any) {
    this.config = config;
    this.initializeWAFPatterns();
  }

  private initializeWAFPatterns(): void {
    this.wafPatterns = [
      // SQL Injection patterns
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
        riskScore: 70
      },
      // Path Traversal
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
      // Command Injection
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
      // LDAP Injection
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
          /\$regex/gi,
          /\{.*\$.*\}/gi
        ],
        riskScore: 70
      },
      // XXE (XML External Entity)
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
      // SSRF (Server-Side Request Forgery)
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
      }
    ];
  }

  // Web Application Firewall (WAF) patterns detection
  detectWAFPatterns(request: Request): WAFResult {
    const threats: string[] = [];
    let riskScore = 0;

    // Get request details
    const url = request.url;
    const method = request.method;
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const origin = request.headers.get('origin') || '';

    // Check URL and parameters
    const urlToCheck = url + referer + origin;
    
    this.wafPatterns.forEach(threat => {
      threat.patterns.forEach(pattern => {
        if (pattern.test(urlToCheck)) {
          threats.push(threat.name);
          riskScore += threat.riskScore;
        }
      });
    });

    // Check User-Agent for suspicious patterns
    const suspiciousUAPatterns = [
      /sqlmap/gi,
      /nikto/gi,
      /nmap/gi,
      /masscan/gi,
      /dirb/gi,
      /gobuster/gi,
      /wfuzz/gi,
      /burp/gi,
      /owasp/gi,
      /scanner/gi,
      /bot/gi,
      /crawler/gi,
      /spider/gi
    ];

    suspiciousUAPatterns.forEach(pattern => {
      if (pattern.test(userAgent)) {
        threats.push('Suspicious User-Agent');
        riskScore += 50;
      }
    });

    // Check for HTTP method abuse
    const dangerousMethods = ['TRACE', 'CONNECT', 'TRACK', 'DEBUG'];
    if (dangerousMethods.includes(method.toUpperCase())) {
      threats.push('Dangerous HTTP Method');
      riskScore += 60;
    }

    // Check for unusual header patterns
    try {
      const headerNames = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip', 'x-remote-ip', 'x-remote-addr'];
      headerNames.forEach(name => {
        const value = request.headers.get(name);
        if (value) {
          // Check for header injection
          if (/\r|\n/.test(value)) {
            threats.push('Header Injection');
            riskScore += 70;
          }
          
          // Check for suspicious headers
          if (this.isPrivateIP(value)) {
            threats.push('IP Spoofing Attempt');
            riskScore += 65;
          }
        }
      });
    } catch (e) {
      console.warn('Could not check headers for threats:', e);
    }

    // Content-Length abuse
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > this.config.maxPayloadSize) {
      threats.push('Oversized Payload');
      riskScore += 40;
    }

     return {
       isMalicious: riskScore > 50,
       threats: Array.from(new Set(threats)), // Remove duplicates
       riskScore: Math.min(riskScore, 100)
     };
  }

  // Check if IP is private/internal
  private isPrivateIP(ip: string): boolean {
    const privatePatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];

    return privatePatterns.some(pattern => pattern.test(ip));
  }

  // Content Security Policy monitoring
  monitorCSPViolations(): void {
    if (typeof document === 'undefined') {
      return;
    }

    // Listen for CSP violation reports
    document.addEventListener('securitypolicyviolation', (event) => {
      const violation: CSPViolation = {
        blockedURI: event.blockedURI,
        documentURI: event.documentURI,
        referrer: event.referrer,
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective,
        originalPolicy: event.originalPolicy,
        disposition: event.disposition,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
        statusCode: event.statusCode,
        sample: event.sample,
        timestamp: Date.now()
      };

      console.warn('🛡️ CSP Violation detected:', violation);
      
      // Store violation for analysis
      this.storeCSPViolation(violation);
      
      // Trigger alert if high severity
      if (this.isHighSeverityViolation(violation)) {
        this.triggerSecurityAlert('CSP Violation', violation);
      }
    });
  }

  private storeCSPViolation(violation: CSPViolation): void {
    this.cspViolations.push(violation);
    
    // Keep only last 100 violations
    if (this.cspViolations.length > 100) {
      this.cspViolations = this.cspViolations.slice(-100);
    }
    
    // Also persist to localStorage if available
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('csp_violations', JSON.stringify(this.cspViolations));
      } catch (e) {
        console.warn('Could not store CSP violations:', e);
      }
    }
  }

  private isHighSeverityViolation(violation: CSPViolation): boolean {
    const highSeverityDirectives = [
      'script-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors'
    ];
    
    return highSeverityDirectives.includes(violation.effectiveDirective);
  }

  private triggerSecurityAlert(type: string, data: any): void {
    const alert: SecurityAlert = {
      type,
      data,
      timestamp: Date.now(),
      severity: 'high',
      url: typeof window !== 'undefined' ? window.location.href : ''
    };

    console.error('🚨 Security Alert:', alert);
    
    // Store alert for monitoring
    this.securityAlerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.securityAlerts.length > 50) {
      this.securityAlerts = this.securityAlerts.slice(-50);
    }
    
    // In production, send to security monitoring service
    if (process.env["NODE_ENV"] === 'production' && this.config.endpoint) {
      this.sendSecurityAlert(alert);
    }
  }

  private async sendSecurityAlert(alert: SecurityAlert): Promise<void> {
    try {
      if (typeof fetch === 'undefined') {
        return; // Fetch not available in this environment
      }
      
      await fetch(`${this.config.endpoint}/security-alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Security-Alert': 'true'
        },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }

  // Edge-specific threat detection
  detectEdgeAnomalies(requests: EdgeAnomaly[]): string[] {
    const anomalies: string[] = [];
    const now = Date.now();
    const recentRequests = requests.filter(r => now - r.timestamp < 60000); // Last minute

    // Check for rapid region hopping
    const regions = new Set(recentRequests.map(r => r.region));
    if (regions.size > 5) {
      anomalies.push('Rapid region hopping detected');
    }

    // Check for unusual request frequency
    if (recentRequests.length > 100) {
      anomalies.push('High frequency edge requests detected');
    }

    return anomalies;
  }

  // Bot detection for edge functions
  detectEdgeBot(userAgent: string, requestPattern: { 
    requestFrequency: number; 
    consistentTiming: boolean; 
    missingHeaders: boolean; 
  }): BotDetection {
    if (!this.config.botDetection.enabled) {
      return { isBot: false, confidence: 0 };
    }

    let confidence = 0;
    let botType = '';

    // Check user agent patterns
    const suspiciousPatterns = this.config.botDetection.suspiciousPatterns;
    for (const pattern of suspiciousPatterns) {
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(userAgent)) {
        confidence += 30;
        botType = pattern;
      }
    }

    // Check request patterns
    if (requestPattern.requestFrequency > 10) { // More than 10 requests per second
      confidence += 40;
      botType = botType || 'high-frequency';
    }

    // Check for consistent timing (bot-like behavior)
    if (requestPattern.consistentTiming) {
      confidence += 20;
      botType = botType || 'automated';
    }

    // Check for missing headers (common with simple bots)
    if (requestPattern.missingHeaders) {
      confidence += 10;
      botType = botType || 'simple-bot';
    }

    return {
      isBot: confidence > 50,
      confidence: Math.min(confidence, 100),
      botType
    };
  }

  // Get security statistics
  getSecurityStats(): {
    wafStats: { totalRequests: number; blockedRequests: number; topThreats: Array<{ threat: string; count: number }> };
    cspStats: { totalViolations: number; highSeverityViolations: number; topViolations: Array<{ directive: string; count: number }> };
    alertStats: { totalAlerts: number; highSeverityAlerts: number; topAlertTypes: Array<{ type: string; count: number }> };
  } {
    // WAF Statistics (mock data for now)
    const wafStats = {
      totalRequests: parseInt(typeof localStorage !== 'undefined' ? localStorage.getItem('waf_total_requests') || '0' : '0'),
      blockedRequests: parseInt(typeof localStorage !== 'undefined' ? localStorage.getItem('waf_blocked_requests') || '0' : '0'),
      topThreats: [] as Array<{ threat: string; count: number }>
    };

    // CSP Statistics
    const highSeverityViolations = this.cspViolations.filter(v => this.isHighSeverityViolation(v));
    
    const directiveCounts = this.cspViolations.reduce((acc, violation) => {
      const directive = violation.effectiveDirective;
      acc[directive] = (acc[directive] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const cspStats = {
      totalViolations: this.cspViolations.length,
      highSeverityViolations: highSeverityViolations.length,
      topViolations: Object.entries(directiveCounts)
        .map(([directive, count]) => ({ directive, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    };

    // Alert Statistics
    const highSeverityAlerts = this.securityAlerts.filter(a => a.severity === 'high' || a.severity === 'critical');
    
    const alertTypeCounts = this.securityAlerts.reduce((acc, alert) => {
      const type = alert.type;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const alertStats = {
      totalAlerts: this.securityAlerts.length,
      highSeverityAlerts: highSeverityAlerts.length,
      topAlertTypes: Object.entries(alertTypeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    };

    return {
      wafStats,
      cspStats,
      alertStats
    };
  }
}