import DOMPurify from 'dompurify';

export class ThreatDetector {
  private wafPatterns: Array<{
    pattern: RegExp;
    threat: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [
    // SQL Injection patterns
    {
      pattern: /\\bUNION\\b.*\\bSELECT\\b|\\bSELECT\\b.*\\bFROM\\b.*\\bWHERE\\b/gi,
      threat: 'SQL Injection',
      severity: 'critical'
    },
    {
      pattern: /[';]|(--)|(\s*(\/\*|\*\/))/gi,
      threat: 'SQL Characters',
      severity: 'medium'
    },
    
    // XSS patterns
    {
      pattern: /<script.*?>.*?<\/script>/gi,
      threat: 'Script Injection',
      severity: 'critical'
    },
    {
      pattern: /on\\w+\\s*=/gi,
      threat: 'Event Handler Injection',
      severity: 'high'
    },
    {
      pattern: /javascript:/gi,
      threat: 'JavaScript Protocol',
      severity: 'high'
    },
    
    // Path Traversal
    {
      pattern: /\.\.\//g,
      threat: 'Path Traversal',
      severity: 'high'
    },
    
    // Command Injection
    {
      pattern: /;\s*\w+\s*\|/i,
      threat: 'Command Injection',
      severity: 'critical'
    },
    
    // DoS patterns
    {
      pattern: /SELECT.*FROM.*WHERE.*(\s+)OR(\s+).*=/i,
      threat: 'Potential DoS Query',
      severity: 'medium'
    }
  ];

  detectWAFPatterns(request: Request): { isMalicious: boolean; threats: string[]; riskScore: number } {
    const threats: string[] = [];
    let riskScore = 0;

    try {
      const url = request.url.toLowerCase();
      const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
      const referer = request.headers.get('referer')?.toLowerCase() || '';

      // Check URL patterns
      for (const threatPattern of this.wafPatterns) {
        if (threatPattern.pattern.test(url) || 
            threatPattern.pattern.test(userAgent) || 
            threatPattern.pattern.test(referer)) {
          threats.push(threatPattern.threat);
          
          // Calculate risk score based on severity
          switch (threatPattern.severity) {
            case 'critical':
              riskScore += 50;
              break;
            case 'high':
              riskScore += 30;
              break;
            case 'medium':
              riskScore += 20;
              break;
            case 'low':
              riskScore += 10;
              break;
          }
        }
      }

      // Additional checks
      if (this.detectSuspiciousUserAgent(userAgent)) {
        threats.push('Suspicious User Agent');
        riskScore += 25;
      }

    } catch (_error) {
      threats.push('Pattern detection error');
      riskScore += 10;
    }

    return {
      isMalicious: riskScore >= 30,
      threats,
      riskScore
    };
  }

  preventXSS(data: any): { hasXSS: boolean; sanitizedData: any } {
    let hasXSS = false;
    let sanitizedData = data;

    try {
      if (typeof data === 'string') {
        const sanitized = DOMPurify.sanitize(data);
        hasXSS = sanitized !== data;
        sanitizedData = sanitized;
      } else if (typeof data === 'object' && data !== null) {
        sanitizedData = this.deepXSSPrevention(data);
        hasXSS = JSON.stringify(sanitizedData) !== JSON.stringify(data);
      }
    } catch (error) {
      console.error('XSS prevention error:', error);
    }

    return { hasXSS, sanitizedData };
  }

  preventSQLInjection(data: any): { hasSQLInjection: boolean; sanitizedData: any } {
    let hasSQLInjection = false;
    let sanitizedData = data;

    const sqlPatterns = [
      /\\bUNION\\b.*\\bSELECT\\b|\\bSELECT\\b.*\\bFROM\\b.*\\bWHERE\\b/gi,
      /[';]|(--)|(\s*(\/\*|\*\/))/gi,
      /\\bINSERT\\b.*\\bINTO\\b/gi,
      /\\bDELETE\\b.*\\bFROM\\b/gi,
      /\\bUPDATE\\b.*\\bSET\\b/gi,
      /\\bDROP\\b.*\\bTABLE\\b/gi,
      /\\bEXEC\\b|\\bEXECUTE\\b/gi
    ];

    try {
      if (typeof data === 'string') {
        let sanitized = data;
        for (const pattern of sqlPatterns) {
          if (pattern.test(sanitized)) {
            hasSQLInjection = true;
            sanitized = sanitized.replace(pattern, '');
          }
        }
        sanitizedData = sanitized;
      } else if (typeof data === 'object' && data !== null) {
        sanitizedData = this.deepSQLPrevention(data, sqlPatterns);
        hasSQLInjection = JSON.stringify(sanitizedData) !== JSON.stringify(data);
      }
    } catch (error) {
      console.error('SQL injection prevention error:', error);
    }

    return { hasSQLInjection, sanitizedData };
  }

  private deepXSSPrevention(obj: any): any {
    if (typeof obj === 'string') {
      return DOMPurify.sanitize(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepXSSPrevention(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.deepXSSPrevention(value);
      }
      return sanitized;
    }
    
    return obj;
  }

  private deepSQLPrevention(obj: any, patterns: RegExp[]): any {
    if (typeof obj === 'string') {
      let sanitized = obj;
      for (const pattern of patterns) {
        if (pattern.test(sanitized)) {
          sanitized = sanitized.replace(pattern, '');
        }
      }
      return sanitized;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSQLPrevention(item, patterns));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.deepSQLPrevention(value, patterns);
      }
      return sanitized;
    }
    
    return obj;
  }

  private detectSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /go-http/i,
      /postman/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost$/
    ];

    return privateRanges.some(range => range.test(ip));
  }

  isPrototypePollution(obj: any): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    return Object.keys(obj).some(key => dangerousKeys.includes(key));
  }
}