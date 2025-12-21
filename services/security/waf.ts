interface WAFConfig {
  maxPayloadSize: number;
  allowedOrigins: string[];
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
}

interface WAFResult {
  isMalicious: boolean;
  threats: string[];
  riskScore: number;
  allowed: boolean;
}

export class WebApplicationFirewall {
  private config: WAFConfig = {
    maxPayloadSize: 5 * 1024 * 1024, // 5MB
    allowedOrigins: [
      'https://quanforge.ai',
      'https://www.quanforge.ai',
      'http://localhost:3000',
      'http://localhost:5173'
    ],
    edgeRateLimiting: {
      enabled: true,
      requestsPerSecond: 10,
      burstLimit: 20
    },
    regionBlocking: {
      enabled: true,
      blockedRegions: ['CN', 'RU', 'IR', 'KP']
    },
    botDetection: {
      enabled: true,
      suspiciousPatterns: [
        'sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster', 
        'wfuzz', 'burp', 'owasp', 'scanner', 'bot', 'crawler', 'spider'
      ]
    }
  };

  // Main WAF detection
  detectWAFPatterns(request: Request): WAFResult {
    const threats: string[] = [];
    let riskScore = 0;

    // Request method validation
    const method = request.method;
    const dangerousMethods = ['TRACE', 'CONNECT', 'OPTIONS'];
    if (dangerousMethods.includes(method.toUpperCase())) {
      threats.push(`Dangerous HTTP method: ${method}`);
      riskScore += 30;
    }

    // URL validation
    const url = new URL(request.url);
    const urlToCheck = url.pathname + url.search;
    
    // SQL Injection patterns in URL
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
      /(--|\#|\/\*)/gi,
      /(\b(or|and)\s+\d+\s*=\s*\d+)/gi,
      /(\bxp_cmdshell\b)/gi
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(urlToCheck)) {
        threats.push('SQL Injection pattern in URL');
        riskScore += 40;
        break;
      }
    }

    // XSS patterns in URL
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(urlToCheck)) {
        threats.push('XSS pattern in URL');
        riskScore += 35;
        break;
      }
    }

    // User-Agent analysis
    const userAgent = request.headers.get('user-agent') || '';
    for (const patternStr of this.config.botDetection.suspiciousPatterns) {
      const pattern = new RegExp(patternStr, 'i');
      if (pattern.test(userAgent)) {
        threats.push(`Suspicious user agent: ${patternStr}`);
        riskScore += 20;
        break;
      }
    }

    // Header analysis
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > this.config.maxPayloadSize) {
      threats.push('Request payload too large');
      riskScore += 25;
    }

    // Check for suspicious headers
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
    for (const header of suspiciousHeaders) {
      const value = request.headers.get(header);
      if (value) {
        // Check for IP in headers that might indicate proxy/VPN
        if (/\r|\n/.test(value)) {
          threats.push(`Header injection detected in ${header}`);
          riskScore += 30;
        }
        if (this.isPrivateIP(value)) {
          threats.push(`Private IP in ${header} header`);
          riskScore += 15;
        }
      }
    }

    // Origin validation
    const origin = request.headers.get('origin');
    if (origin && !this.config.allowedOrigins.includes(origin)) {
      threats.push('Unauthorized origin');
      riskScore += 25;
    }

    const isMalicious = riskScore >= 30;
    const allowed = !isMalicious;

    return {
      isMalicious,
      threats,
      riskScore,
      allowed
    };
  }

  // Origin validation
  validateOrigin(origin: string): boolean {
    return this.config.allowedOrigins.includes(origin);
  }

  // Private IP detection
  private isPrivateIP(ip: string): boolean {
    // Basic private IP ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];

    return privateRanges.some(range => range.test(ip));
  }

  // Setup edge WAF monitoring
  setupEdgeWAF(): void {
    if (typeof window === 'undefined') return;

    // Monitor CSP violations
    document.addEventListener('securitypolicyviolation', (event) => {
      this.handleCSPViolation(event);
    });

    // Monitor security events
    this.monitorEdgeThreats();
  }

  // Handle CSP violations
  private handleCSPViolation(event: SecurityPolicyViolationEvent): void {
    const violation = {
      blockedURI: event.blockedURI,
      documentURI: event.documentURI,
      effectiveDirective: event.effectiveDirective,
      originalPolicy: event.originalPolicy,
      referrer: event.referrer,
      sourceFile: event.sourceFile,
      sample: event.sample,
      lineNumber: event.lineNumber,
      columnNumber: event.columnNumber,
      timestamp: Date.now()
    };

    this.storeCSPViolation(violation);

    if (this.isHighSeverityViolation(violation)) {
      this.triggerSecurityAlert('CSP_VIOLATION', violation);
    }
  }

  // Store CSP violation
  private storeCSPViolation(violation: any): void {
    try {
      const violations = JSON.parse(localStorage.getItem('csp_violations') || '[]');
      violations.push(violation);
      
      // Keep only last 100 violations
      if (violations.length > 100) {
        violations.splice(0, violations.length - 100);
      }
      
      localStorage.setItem('csp_violations', JSON.stringify(violations));
    } catch (e) {
      console.error('Failed to store CSP violation:', e);
    }
  }

  // Check if violation is high severity
  private isHighSeverityViolation(violation: any): boolean {
    const highSeverityDirectives = [
      'script-src', 'object-src', 'frame-src', 'connect-src', 'default-src'
    ];
    
    return highSeverityDirectives.includes(violation.effectiveDirective) ||
           violation.blockedURI.includes('javascript:') ||
           violation.blockedURI.includes('data:');
  }

  // Monitor edge threats
  private monitorEdgeThreats(): void {
    if (typeof window === 'undefined') return;

    setInterval(() => {
      this.analyzeEdgeRequestPatterns();
    }, 30000); // Check every 30 seconds
  }

  // Analyze edge request patterns
  private analyzeEdgeRequestPatterns(): void {
    // This would integrate with edge monitoring services
    // For now, implement basic anomaly detection
    const anomalies = this.detectAnomalies();
    
    if (anomalies.length > 0) {
      this.triggerSecurityAlert('EDGE_ANOMALY', { anomalies });
    }
  }

  // Detect anomalies
  private detectAnomalies(): string[] {
    const anomalies: string[] = [];
    
    // Check for unusual request patterns
    const requestCount = parseInt(localStorage.getItem('request_count') || '0');
    if (requestCount > 1000) { // Unusual high traffic
      anomalies.push('High request volume detected');
    }
    
    // Check for repeated failed requests
    const failedRequests = parseInt(localStorage.getItem('failed_requests') || '0');
    if (failedRequests > 50) {
      anomalies.push('High rate of failed requests');
    }
    
    return anomalies;
  }

  // Trigger security alert
  private triggerSecurityAlert(type: string, data: any): void {
    const alert = {
      type,
      data,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : 'server'
    };

    // Store alert for monitoring
    try {
      const alerts = JSON.parse(localStorage.getItem('security_alerts') || '[]');
      alerts.push(alert);
      
      // Keep only last 50 alerts
      if (alerts.length > 50) {
        alerts.splice(0, alerts.length - 50);
      }
      
      localStorage.setItem('security_alerts', JSON.stringify(alerts));
    } catch (e) {
      console.error('Failed to store security alert:', e);
    }

    // In production, send to external monitoring service
    if (typeof process !== 'undefined' && process.env?.['NODE_ENV'] === 'production') {
      // Integration with external monitoring service would go here
    }

    console.warn('Security Alert:', alert);
  }

  // Get security metrics
  getSecurityMetrics(): {
    totalAlerts: number;
    cspViolations: number;
    activeThreats: string[];
    lastAlert?: any;
  } {
    try {
      const alerts = JSON.parse(localStorage.getItem('security_alerts') || '[]');
      const violations = JSON.parse(localStorage.getItem('csp_violations') || '[]');
      
      return {
        totalAlerts: alerts.length,
        cspViolations: violations.length,
        activeThreats: alerts.slice(-5).map((a: any) => a.type),
        lastAlert: alerts[alerts.length - 1]
      };
    } catch (e) {
      return {
        totalAlerts: 0,
        cspViolations: 0,
        activeThreats: []
      };
    }
  }

  // Comprehensive security statistics
  getComprehensiveSecurityStats(): {
    threats: {
      total: number;
      byType: Record<string, number>;
      recent: any[];
    };
    rateLimits: {
      active: number;
      blocked: number;
      topViolators: string[];
    };
    waf: {
      totalRequests: number;
      blockedRequests: number;
      riskScore: number;
    };
    alerts: {
      total: number;
      severity: Record<string, number>;
      last24h: number;
    };
  } {
    const alerts = JSON.parse(localStorage.getItem('security_alerts') || '[]');
    const violations = JSON.parse(localStorage.getItem('csp_violations') || '[]');
    const last24h = Date.now() - (24 * 60 * 60 * 1000);

    // Threat analysis
    const threatsByType: Record<string, number> = {};
    alerts.forEach((alert: any) => {
      threatsByType[alert.type] = (threatsByType[alert.type] || 0) + 1;
    });

    // Severity analysis
    const severity: Record<string, number> = {};
    alerts.forEach((alert: any) => {
      const level = alert.riskScore > 50 ? 'high' : alert.riskScore > 25 ? 'medium' : 'low';
      severity[level] = (severity[level] || 0) + 1;
    });

    // Recent alerts
    const recentAlerts = alerts.filter((alert: any) => alert.timestamp > last24h);

    return {
      threats: {
        total: alerts.length,
        byType: threatsByType,
        recent: alerts.slice(-10)
      },
      rateLimits: {
        active: 0, // Would come from rate limiter
        blocked: 0, // Would come from rate limiter
        topViolators: []
      },
      waf: {
        totalRequests: parseInt(localStorage.getItem('request_count') || '0'),
        blockedRequests: parseInt(localStorage.getItem('blocked_requests') || '0'),
        riskScore: this.calculateOverallRiskScore(alerts, violations)
      },
      alerts: {
        total: alerts.length,
        severity,
        last24h: recentAlerts.length
      }
    };
  }

  // Calculate overall risk score
  private calculateOverallRiskScore(alerts: any[], violations: any[]): number {
    let totalScore = 0;
    
    alerts.forEach((alert: any) => {
      totalScore += alert.riskScore || 0;
    });

    violations.forEach((violation: any) => {
      const severity = this.isHighSeverityViolation(violation) ? 20 : 5;
      totalScore += severity;
    });

    return Math.min(100, totalScore / 10); // Cap at 100
  }
}