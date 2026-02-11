import { secureStorage } from '../../utils/secureStorage';
import { TIME_CONSTANTS } from '../../constants/config';

export class APISecurityManager {
  private apiKeys = new Map<string, { key: string; type: string; expiresAt: number; rotations: number }>();
  private cspViolations: Array<{ timestamp: number; violation: any; severity: string }> = [];
  private csrfTokens = new Map<string, { token: string; expiresAt: number }>();

  constructor(private config: {
    apiKeyRotationInterval: number;
    maxCSRFViolationAge: number;
    maxTokenAge: number;
  }) {}

  async rotateAPIKeys(): Promise<{ oldKey: string; newKey: string; expiresAt: number }> {
    const oldKey = this.generateSecureAPIKey();
    const newKey = this.generateSecureAPIKey();
    const expiresAt = Date.now() + this.config.apiKeyRotationInterval;

    // Store old key for backward compatibility
    this.apiKeys.set(oldKey, {
      key: oldKey,
      type: 'expired',
      expiresAt,
      rotations: (this.apiKeys.get(oldKey)?.rotations || 0) + 1
    });

    // Store new key
    this.apiKeys.set(newKey, {
      key: newKey,
      type: 'active',
      expiresAt,
      rotations: 0
    });

    // Encrypt and store new key
    await secureStorage.set('api_key', newKey);

    return {
      oldKey,
      newKey,
      expiresAt
    };
  }

  private generateSecureAPIKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  generateCSRFToken(sessionId: string): string {
    const token = this.generateSecureToken();
    const expiresAt = Date.now() + this.config.maxTokenAge;

    this.csrfTokens.set(sessionId, {
      token,
      expiresAt
    });

    return token;
  }

  validateCSRFToken(sessionId: string, token: string): boolean {
    const storedToken = this.csrfTokens.get(sessionId);
    
    if (!storedToken) {
      return false;
    }

    const now = Date.now();
    if (now > storedToken.expiresAt) {
      this.csrfTokens.delete(sessionId);
      return false;
    }

    return storedToken.token === token;
  }

  validateAPIKey(apiKey: string, _type: 'gemini' | 'supabase' | 'twelvedata' | 'generic' = 'generic'): boolean {
    const keyData = this.apiKeys.get(apiKey);
    
    if (!keyData) {
      return false;
    }

    // Check if expired
    if (Date.now() > keyData.expiresAt) {
      this.apiKeys.delete(apiKey);
      return false;
    }

    // Only allow active keys
    if (keyData.type !== 'active') {
      return false;
    }

    return true;
  }

  validateSymbol(symbol: string): boolean {
    // Symbol validation for trading pairs
    const symbolRegex = /^[A-Z]{6}$/; // Standard forex pair format
    const cryptoRegex = /^[A-Z]{3,10}\/[A-Z]{3,10}$/; // Crypto pair format
    const stockRegex = /^[A-Z]{1,5}$/; // Stock symbol format

    return symbolRegex.test(symbol) || 
           cryptoRegex.test(symbol) || 
           stockRegex.test(symbol);
  }

  private generateSecureToken(): string {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  monitorCSPViolations(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('securitypolicyviolation', (event) => {
        this.handleCSPViolation(event);
      });
    }
  }

  private handleCSPViolation(violation: SecurityPolicyViolationEvent): void {
    const violationData = {
      timestamp: Date.now(),
      violation: {
        blockedURI: violation.blockedURI,
        documentURI: violation.documentURI,
        effectiveDirective: violation.effectiveDirective,
        originalPolicy: violation.originalPolicy,
        referrer: violation.referrer,
        sample: violation.sample,
        sourceFile: violation.sourceFile,
        statusCode: violation.statusCode,
        violatedDirective: violation.violatedDirective
      }
    };

    const violationWithSeverity = {
        ...violationData,
        severity: this.isHighSeverityViolation(violation) ? 'high' : 'medium'
      };
      
      this.cspViolations.push(violationWithSeverity);
      this.storeCSPViolation(violationWithSeverity);

    if (this.isHighSeverityViolation(violation)) {
      this.triggerSecurityAlert('CSPViolation', violationData);
    }
  }

  private storeCSPViolation(violation: any): void {
    // In a real implementation, you'd send this to your security endpoint
    try {
      const existing = localStorage.getItem('csp_violations') || '[]';
      const violations = JSON.parse(existing);
      violations.push(violation);
      
      // Keep only last 100 violations
      if (violations.length > 100) {
        violations.splice(0, violations.length - 100);
      }
      
      localStorage.setItem('csp_violations', JSON.stringify(violations));
    } catch (error: unknown) {
      console.error('Failed to store CSP violation:', error);
    }
  }

  private isHighSeverityViolation(violation: SecurityPolicyViolationEvent): boolean {
    const highSeverityDirectives = [
      'script-src',
      'object-src',
      'frame-src',
      'connect-src',
      'default-src'
    ];

    return highSeverityDirectives.includes(violation.effectiveDirective);
  }

  private triggerSecurityAlert(type: string, data: any): void {
    // In a real implementation, you'd send this to your security monitoring service
    console.warn(`Security Alert [${type}]:`, data);
    
    // Store high-priority alerts
    try {
      const existing = localStorage.getItem('security_alerts') || '[]';
      const alerts = JSON.parse(existing);
      alerts.push({
        type,
        timestamp: Date.now(),
        data,
        priority: 'high'
      });
      
      // Keep only last 50 alerts
      if (alerts.length > 50) {
        alerts.splice(0, alerts.length - 50);
      }
      
      localStorage.setItem('security_alerts', JSON.stringify(alerts));
    } catch (error: unknown) {
      console.error('Failed to store security alert:', error);
    }
  }

  // Edge bot detection
  detectEdgeBot(userAgent: string, _ip: string, requestPattern: any): { 
    isBot: boolean; 
    confidence: number; 
    botType: string;
  } {
    const botPatterns = [
      { pattern: /bot/i, type: 'generic', confidence: 0.7 },
      { pattern: /crawler/i, type: 'crawler', confidence: 0.8 },
      { pattern: /spider/i, type: 'spider', confidence: 0.8 },
      { pattern: /scraper/i, type: 'scraper', confidence: 0.9 },
      { pattern: /curl/i, type: 'cli', confidence: 0.9 },
      { pattern: /wget/i, type: 'cli', confidence: 0.9 },
      { pattern: /python/i, type: 'script', confidence: 0.8 },
      { pattern: /java/i, type: 'script', confidence: 0.7 },
      { pattern: /go-http/i, type: 'script', confidence: 0.7 },
      { pattern: /postman/i, type: 'api_tool', confidence: 0.95 }
    ];

    let isBot = false;
    let maxConfidence = 0;
    let detectedBotType = '';

    // Check user agent patterns
    const userAgentLower = userAgent.toLowerCase();
    for (const botPattern of botPatterns) {
      if (botPattern.pattern.test(userAgentLower)) {
        isBot = true;
        if (botPattern.confidence > maxConfidence) {
          maxConfidence = botPattern.confidence;
          detectedBotType = botPattern.type;
        }
      }
    }

    // Analyze request patterns
    if (requestPattern) {
      const { frequency, endpoints, timing } = requestPattern;
      
      // High frequency requests
      if (frequency && frequency > 100) { // 100 requests per minute
        isBot = true;
        maxConfidence = Math.max(maxConfidence, 0.8);
        detectedBotType = detectedBotType || 'high_frequency';
      }

      // Automated access patterns
      if (timing && timing.variance < 0.1) { // Very consistent timing
        isBot = true;
        maxConfidence = Math.max(maxConfidence, 0.7);
        detectedBotType = detectedBotType || 'automated';
      }

      // Limited endpoint diversity (typical of simple bots)
      if (endpoints && endpoints.length < 3 && frequency > 50) {
        isBot = true;
        maxConfidence = Math.max(maxConfidence, 0.6);
        detectedBotType = detectedBotType || 'simple_bot';
      }
    }

    return {
      isBot,
      confidence: maxConfidence,
      botType: detectedBotType || 'unknown'
    };
  }

  // Cleanup expired tokens and violations
  cleanup(): void {
    const now = Date.now();

    // Clean expired CSRF tokens
    for (const [sessionId, tokenData] of this.csrfTokens.entries()) {
      if (now > tokenData.expiresAt) {
        this.csrfTokens.delete(sessionId);
      }
    }

    // Clean expired API keys
    for (const [key, keyData] of this.apiKeys.entries()) {
      if (now > keyData.expiresAt) {
        this.apiKeys.delete(key);
      }
    }

    // Clean old CSP violations
    this.cspViolations = this.cspViolations.filter(
      violation => now - violation.timestamp < this.config.maxCSRFViolationAge
    );
  }

  // Get security statistics
  getSecurityStats(): {
    activeAPIKeys: number;
    activeCSRFPTokens: number;
    recentCSPViolations: number;
    highSeverityAlerts: number;
  } {
    const now = Date.now();
    const recentViolations = this.cspViolations.filter(
      violation => now - violation.timestamp < TIME_CONSTANTS.HOUR // Last hour
    ).length;

    let highSeverityAlerts = 0;
    try {
      const alerts = JSON.parse(localStorage.getItem('security_alerts') || '[]');
      const recentAlerts = alerts.filter((alert: any) => 
        now - alert.timestamp < TIME_CONSTANTS.HOUR && alert.priority === 'high'
      );
      highSeverityAlerts = recentAlerts.length;
    } catch (error: unknown) {
      console.error('Failed to get security alerts:', error);
    }

    return {
      activeAPIKeys: this.apiKeys.size,
      activeCSRFPTokens: this.csrfTokens.size,
      recentCSPViolations: recentViolations,
      highSeverityAlerts
    };
  }
}