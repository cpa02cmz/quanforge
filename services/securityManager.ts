
import { SecurityValidator } from './security/validation';
import { RateLimiter } from './security/rateLimiter';
import { WebApplicationFirewall } from './security/waf';
import { APIKeyManager } from './security/apiKeyManager';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

class SecurityManager {
  private static instance: SecurityManager;
  private validator: SecurityValidator;
  private rateLimiter: RateLimiter;
  private waf: WebApplicationFirewall;
  private apiKeyManager: APIKeyManager;

  private constructor() {
    this.validator = new SecurityValidator();
    this.rateLimiter = new RateLimiter();
    this.waf = new WebApplicationFirewall();
    this.apiKeyManager = new APIKeyManager();
    
    // Initialize edge WAF monitoring
    if (typeof window !== 'undefined') {
      this.waf.setupEdgeWAF();
    }
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // Safe JSON parsing utility
  safeJSONParse<T = any>(data: string, fallback?: T): T | null {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('JSON parsing failed:', error);
      return fallback || null;
    }
  }

  // Performance monitoring utility (delegates to performance monitor)
  recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    try {
      const { performanceMonitor } = require('../performanceMonitorEnhanced');
      performanceMonitor.recordCustomMetric(name, value, metadata);
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }

  // Input sanitization utility
  sanitizeInput(input: string): string {
    const result = this.validator.sanitizeAndValidate(input, 'user');
    return result.sanitizedData || input;
  }

  // Main validation orchestrator - delegates to SecurityValidator
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    return this.validator.sanitizeAndValidate(data, type);
  }

  // Rate limiting - delegates to RateLimiter
  checkRateLimit(identifier: string): { allowed: boolean; resetTime?: number } {
    return this.rateLimiter.checkRateLimit(identifier);
  }

  // Adaptive rate limiting - delegates to RateLimiter
  checkAdaptiveRateLimit(
    identifier: string, 
    userTier: string = 'basic'
  ): { 
    allowed: boolean; 
    resetTime?: number;
    currentCount: number;
    limit: number;
  } {
    return this.rateLimiter.checkAdaptiveRateLimit(identifier, userTier);
  }

  // WAF pattern detection - delegates to WebApplicationFirewall  
  detectWAFPatterns(request: Request): { isMalicious: boolean; threats: string[]; riskScore: number } {
    const result = this.waf.detectWAFPatterns(request);
    return {
      isMalicious: result.isMalicious,
      threats: result.threats,
      riskScore: result.riskScore
    };
  }

  // Origin validation - delegates to WebApplicationFirewall
  validateOrigin(origin: string): boolean {
    return this.waf.validateOrigin(origin);
  }

  // API key management - delegates to APIKeyManager
  rotateAPIKeys(): { oldKey: string; newKey: string; expiresAt: number } | null {
    return this.apiKeyManager.rotateAPIKeys();
  }

  getCurrentAPIKey(): string | null {
    return this.apiKeyManager.getCurrentAPIKey();
  }

  // Security metrics aggregation
  getSecurityMetrics(): {
    totalAlerts: number;
    cspViolations: number;
    activeThreats: string[];
    lastAlert?: any;
    rateLimits: {
      active: number;
      averageCount: number;
    };
    apiKeys: {
      validKeys: number;
      needsRotation: boolean;
    };
  } {
    const wafMetrics = this.waf.getSecurityMetrics();
    const rateLimitCount = this.rateLimiter.getActiveLimitsCount();
    const keyMetrics = this.apiKeyManager.getAPIKeyMetrics();

    return {
      ...wafMetrics,
      rateLimits: {
        active: rateLimitCount,
        averageCount: rateLimitCount > 0 ? 50 : 0 // Simplified average
      },
      apiKeys: {
        validKeys: keyMetrics.validKeys,
        needsRotation: this.apiKeyManager.needsRotation()
      }
    };
  }

  // Comprehensive security statistics - delegates to WebApplicationFirewall
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
    apiKeys: {
      metrics: ReturnType<APIKeyManager['getAPIKeyMetrics']>;
      rotation: ReturnType<APIKeyManager['getKeyRotationStatus']>;
    };
  } {
    const baseStats = this.waf.getComprehensiveSecurityStats();
    const keyMetrics = this.apiKeyManager.getAPIKeyMetrics();
    const keyRotation = this.apiKeyManager.getKeyRotationStatus();
    const activeLimits = this.rateLimiter.getActiveLimitsCount();

    return {
      ...baseStats,
      rateLimits: {
        active: activeLimits,
        blocked: 0, // Would need tracking in RateLimiter
        topViolators: [] // Would need tracking in RateLimiter
      },
      apiKeys: {
        metrics: keyMetrics,
        rotation: keyRotation
      }
    };
  }

  // CSP monitoring - delegates to WebApplicationFirewall
  monitorCSPViolations(): void {
    // CSP monitoring is handled automatically by WAF setup
    // This method is kept for backward compatibility
  }

  // Auto-rotate API keys if needed - delegates to APIKeyManager
  async autoRotateIfNeeded(): Promise<boolean> {
    try {
      const rotation = await this.apiKeyManager.autoRotateIfNeeded();
      return rotation !== null;
    } catch (error) {
      console.error('Auto-rotation failed:', error);
      return false;
    }
  }

  // Cleanup tasks - delegates to appropriate services
  performCleanup(): void {
    this.rateLimiter.cleanupExpiredEntries();
    this.apiKeyManager.cleanupExpiredKeys();
  }

  // Advanced security checks
  performAdvancedSecurityCheck(request?: Request): {
    overallRiskScore: number;
    threats: string[];
    recommendations: string[];
    needsImmediateAction: boolean;
  } {
    const recommendations: string[] = [];
    const allThreats: string[] = [];
    let riskScore = 0;

    // Check API key status
    const keyStatus = this.apiKeyManager.getKeyRotationStatus();
    if (!keyStatus.hasValidKey) {
      allThreats.push('No valid API keys available');
      riskScore += 40;
      recommendations.push('Rotate API keys immediately');
    }

    if (this.apiKeyManager.needsRotation()) {
      allThreats.push('API key rotation needed');
      riskScore += 20;
      recommendations.push('Schedule API key rotation');
    }

    // Request analysis if provided
    if (request) {
      const wafResult = this.waf.detectWAFPatterns(request);
      allThreats.push(...wafResult.threats);
      riskScore += wafResult.riskScore;

      if (wafResult.threats.includes('SQL Injection pattern in URL')) {
        recommendations.push('Review input sanitization');
      }

      if (wafResult.threats.includes('Suspicious user agent')) {
        recommendations.push('Implement bot protection');
      }
    }

    // Check rate limit status
    if (this.rateLimiter.getActiveLimitsCount() > 100) {
      allThreats.push('High number of active rate limits');
      riskScore += 15;
      recommendations.push('Monitor for DoS attacks');
    }

    return {
      overallRiskScore: Math.min(100, riskScore),
      threats: allThreats,
      recommendations,
      needsImmediateAction: riskScore >= 50
    };
  }

  // Export security configuration for backup
  exportSecurityConfig(): {
    apiKeys: string | null;
    timestamp: number;
    version: string;
  } {
    return {
      apiKeys: this.apiKeyManager.exportKeys(),
      timestamp: Date.now(),
      version: '1.0.0'
    };
  }

  // Import security configuration
  importSecurityConfig(config: {
    apiKeys: string;
    timestamp: number;
    version?: string;
  }): boolean {
    try {
      if (!config.apiKeys) {
        return false;
      }

      const success = this.apiKeyManager.importKeys(config.apiKeys);
      if (success) {
        console.log('Security configuration imported successfully');
      }
      return success;
    } catch (error) {
      console.error('Failed to import security configuration:', error);
      return false;
    }
  }

  // Health check for all security components
  healthCheck(): {
    status: 'healthy' | 'degraded' | 'critical';
    components: {
      validator: boolean;
      rateLimiter: boolean;
      waf: boolean;
      apiKeyManager: boolean;
    };
    issues: string[];
  } {
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Check validator
    const validatorHealthy = this.validator !== null;
    if (!validatorHealthy) {
      issues.push('Security validator not initialized');
      status = 'critical';
    }

    // Check rate limiter
    const rateLimiterHealthy = this.rateLimiter !== null;
    if (!rateLimiterHealthy) {
      issues.push('Rate limiter not initialized');
      status = 'critical';
    }

    // Check WAF
    const wafHealthy = this.waf !== null;
    if (!wafHealthy) {
      issues.push('WAF not initialized');
      status = 'critical';
    }

    // Check API key manager
    const apiKeyManagerHealthy = this.apiKeyManager !== null;
    let hasValidKeys = false;
    
    if (apiKeyManagerHealthy) {
      try {
        hasValidKeys = this.apiKeyManager.getCurrentAPIKey() !== null;
        if (!hasValidKeys) {
          issues.push('No valid API keys available');
          if (status === 'healthy') status = 'degraded';
        }
      } catch (error) {
        issues.push('API key manager error');
        status = status === 'healthy' ? 'degraded' : status;
      }
    } else {
      issues.push('API key manager not initialized');
      status = 'critical';
    }

    return {
      status,
      components: {
        validator: validatorHealthy,
        rateLimiter: rateLimiterHealthy,
        waf: wafHealthy,
        apiKeyManager: apiKeyManagerHealthy
      },
      issues
    };
  }
}

// Singleton instance for backward compatibility
export const securityManager = SecurityManager.getInstance();
export default SecurityManager;