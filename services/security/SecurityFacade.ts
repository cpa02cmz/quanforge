/**
 * Security Facade
 * 
 * Provides backward compatibility with the original SecurityManager class
 * while internally using the decomposed modular services.
 * 
 * @author QuantForge Security Team
 * @version 1.0.0
 */


import { securityUtils, SecurityUtilsService } from './SecurityUtilsService';
import { inputValidation, InputValidationService, ValidationResult } from './InputValidationService';
import { rateLimiting, RateLimitingService, RateLimitResult } from './RateLimitingService';
import { authToken, AuthenticationTokenService, APIKeyRotationResult } from './AuthenticationTokenService';
import { securityMonitoring, SecurityMonitoringService, CompliantSecurityStats } from './SecurityMonitoringService';
import { webApplicationFirewall, WebApplicationFirewallService, WAFResult } from './WebApplicationFirewallService';

// Legacy interfaces for backward compatibility
export interface SecurityConfig {
  maxPayloadSize: number;
  allowedOrigins: string[];
  endpoint?: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  encryption: {
    algorithm: string;
    keyRotationInterval: number;
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
  botDetection: {
    enabled: boolean;
    suspiciousPatterns: string[];
  };
}

/**
 * Security Facade - maintains backward compatibility while using new modular services
 * 
 * This class acts as an adapter that provides the same interface as the original
 * SecurityManager class but internally delegates to the specialized services.
 */
class SecurityManager {
  private static instance: SecurityManager;

  // Legacy configuration for backward compatibility
  private config: SecurityConfig = {
    maxPayloadSize: 5 * 1024 * 1024, // 5MB
    allowedOrigins: [
      'https://quanforge.ai',
      'https://www.quanforge.ai',
      'http://localhost:3000',
      'http://localhost:5173' // Vite dev server
    ],
    rateLimiting: {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
    },
    encryption: {
      algorithm: 'AES-256-GCM',
      keyRotationInterval: 43200000, // 12 hours
    },
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

  private constructor() {
    // Initialize all services
    securityMonitoring.startMonitoring();
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // ============= DELEGATED METHODS =============
  // All methods delegate to the appropriate specialized service

  // Input Validation Methods (delegated to InputValidationService)
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    return inputValidation.sanitizeAndValidate(data, type);
  }

  sanitizeInput(input: string, type: 'text' | 'code' | 'symbol' | 'url' | 'token' | 'search' | 'email' | 'html' = 'text'): string {
    return inputValidation.sanitizeInput(input, type);
  }

  validateInput(input: any, type: 'search' | 'record' | 'robot' | 'strategy' | 'backtest' | 'user' | 'text' | 'code' | 'symbol' | 'url' | 'token' | 'html' = 'text'): boolean {
    return inputValidation.validateInput(input, type);
  }

  validateSymbol(symbol: string): boolean {
    return inputValidation.validateSymbol(symbol);
  }

  // Rate Limiting Methods (delegated to RateLimitingService)
  checkRateLimit(identifier: string): RateLimitResult {
    return rateLimiting.checkRateLimit(identifier);
  }

  checkAdaptiveRateLimit(identifier: string, userTier: string = 'basic'): RateLimitResult {
    return rateLimiting.checkAdaptiveRateLimit(identifier, userTier as 'basic' | 'premium' | 'enterprise');
  }

  checkEdgeRateLimit(identifier: string, region: string): any {
    return rateLimiting.checkEdgeRateLimit(identifier, region);
  }

  validateOrigin(origin: string): boolean {
    return rateLimiting.validateOrigin(origin);
  }

  // Token Management Methods (delegated to AuthenticationTokenService)
  generateCSRFToken(sessionId: string): string {
    return authToken.generateCSRFToken(sessionId);
  }

  validateCSRFToken(sessionId: string, token: string): boolean {
    return authToken.validateCSRFToken(sessionId, token);
  }

  rotateAPIKeys(): APIKeyRotationResult {
    return authToken.rotateAPIKeys('generic');
  }

  validateAPIKey(apiKey: string, type: 'gemini' | 'supabase' | 'twelvedata' | 'generic' = 'generic'): boolean {
    return authToken.validateAPIKey(apiKey, type).isValid;
  }

  generateSecureToken(): string {
    return authToken.generateSecureToken();
  }

  // WAF Methods (delegated to WebApplicationFirewallService)
  detectWAFPatterns(request: any): WAFResult {
    return webApplicationFirewall.detectWAFPatterns(request);
  }

  setupEdgeWAF(): void {
    // WAF service automatically sets up edge monitoring when initialized
    // This method remains for backward compatibility
  }

  // Security Metrics Methods (delegated to SecurityMonitoringService)
  getSecurityMetrics(): any {
    return securityMonitoring.getSecurityMetrics();
  }

  getComprehensiveSecurityStats(): CompliantSecurityStats {
    return securityMonitoring.getComprehensiveSecurityStats();
  }

  monitorCSPViolations(): void {
    // CSP monitoring is automatically started when SecurityMonitoringService starts
    // This method remains for backward compatibility
  }

  // Utility Methods (delegated to SecurityUtilsService)
  hashString(input: string): string {
    return securityUtils.hashString(input);
  }

  isPrototypePollution(obj: any): boolean {
    return securityUtils.isPrototypePollution(obj);
  }

  safeJSONParse(jsonString: string): any {
    return securityUtils.safeJSONParse(jsonString);
  }

  isPrivateIP(ip: string): boolean {
    return securityUtils.isPrivateIP(ip);
  }

  // ============= CONFIGURATION METHODS =============

  /**
   * Get legacy configuration
   */
  getLegacyConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Update legacy configuration and sync with services
   */
  updateLegacyConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update service configurations as needed
    if (newConfig.allowedOrigins) {
      const rateLimitConfig = rateLimiting.getConfig();
      rateLimitConfig.allowedOrigins = newConfig.allowedOrigins;
      rateLimiting.updateConfig(rateLimitConfig);
    }

    if (newConfig.botDetection) {
      const wafConfig = webApplicationFirewall.getConfig();
      wafConfig.suspiciousPatterns = newConfig.botDetection.suspiciousPatterns;
      webApplicationFirewall.updateConfig(wafConfig);
    }
  }

  // ============= ADVANCED METHODS =============

  /**
   * Get service status and health
   */
  getServiceStatus(): {
    utils: boolean;
    validation: boolean;
    rateLimiting: boolean;
    authTokens: boolean;
    monitoring: boolean;
    waf: boolean;
    overall: 'healthy' | 'degraded' | 'unhealthy';
  } {
    const utilsStatus = !!SecurityUtilsService.getInstance();
    const validationStatus = !!InputValidationService.getInstance();
    const rateLimitingStatus = !!RateLimitingService.getInstance();
    const authTokenStatus = !!AuthenticationTokenService.getInstance();
    const monitoringStatus = !!SecurityMonitoringService.getInstance();
    const wafStatus = !!WebApplicationFirewallService.getInstance();

    const allHealthy = utilsStatus && validationStatus && rateLimitingStatus && 
                      authTokenStatus && monitoringStatus && wafStatus;

    return {
      utils: utilsStatus,
      validation: validationStatus,
      rateLimiting: rateLimitingStatus,
      authTokens: authTokenStatus,
      monitoring: monitoringStatus,
      waf: wafStatus,
      overall: allHealthy ? 'healthy' : 'degraded'
    };
  }

  /**
   * Get comprehensive health check with metrics
   */
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: ReturnType<SecurityManager['getServiceStatus']>;
    metrics: any;
    recommendations: string[];
  }> {
    const serviceStatus = this.getServiceStatus();
    const metrics = securityMonitoring.getComprehensiveSecurityStats();
    const recommendations: string[] = [];

    // Analyze metrics and provide recommendations
    if (metrics.securityScore < 80) {
      recommendations.push('Security score is below optimal threshold. Review recent alerts.');
    }

    if (metrics.totalViolations > 50) {
      recommendations.push('High number of security violations detected. Consider tightening WAF rules.');
    }

    if (metrics.blockedRequests > 100) {
      recommendations.push('High number of blocked requests. Review IP blocking policies.');
    }

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (serviceStatus.overall === 'degraded' || metrics.securityScore < 60) {
      overall = 'degraded';
    }
    if (metrics.securityScore < 40 || recommendations.length > 3) {
      overall = 'unhealthy';
    }

    return {
      status: overall,
      services: serviceStatus,
      metrics,
      recommendations
    };
  }

  /**
   * Reset all security data (use with caution)
   */
  resetAllSecurityData(): void {
    securityMonitoring.resetMonitoringData();
    webApplicationFirewall.resetWAFData();
    rateLimiting.cleanupExpiredEntries();
    securityUtils.logSecurityEvent('AllSecurityDataReset');
  }

  /**
   * Export security data for backup or analysis
   */
  exportSecurityData(): {
    timestamp: number;
    version: string;
    services: {
      monitoring: any;
      waf: any;
      rateLimiting: any;
      tokens: any;
    };
  } {
    return {
      timestamp: Date.now(),
      version: '1.0.0',
      services: {
        monitoring: securityMonitoring.exportMonitoringData(),
        waf: webApplicationFirewall.getWAFStats(),
        rateLimiting: rateLimiting.getRateLimitMetrics(),
        tokens: authToken.getTokenStats()
      }
    };
  }

  /**
   * Get service statistics for monitoring dashboard
   */
  getDashboardStats(): {
    securityScore: number;
    activeThreats: number;
    blockedRequests: number;
    totalRequests: number;
    uptime: number;
    lastSecurityEvent: number;
  } {
    const comprehensiveStats = securityMonitoring.getComprehensiveSecurityStats();
    const wafStats = webApplicationFirewall.getWAFStats();

    return {
      securityScore: comprehensiveStats.securityScore,
      activeThreats: comprehensiveStats.totalViolations,
      blockedRequests: comprehensiveStats.blockedRequests,
      totalRequests: wafStats.totalRequests,
      uptime: 0, // Would need to track service start time
      lastSecurityEvent: 0 // Would need to track last event timestamp
    };
  }

  /**
   * Legacy cleanup method for backward compatibility
   */
  cleanup(): void {
    // Cleanup expired entries from all services
    rateLimiting.cleanupExpiredEntries();
    authToken.cleanupExpiredTokens();
    webApplicationFirewall.cleanupExpiredIPBlocks();
    securityUtils.logSecurityEvent('LegacyCleanupPerformed');
  }
}

// Export singleton instance for backward compatibility
export default SecurityManager.getInstance();

// Also export the individual services for new code that wants to use them directly
export {
  securityUtils,
  inputValidation,
  rateLimiting,
  authToken,
  securityMonitoring,
  webApplicationFirewall
};

// Export service classes for advanced usage
export {
  SecurityUtilsService,
  InputValidationService,
  RateLimitingService,
  AuthenticationTokenService,
  SecurityMonitoringService,
  WebApplicationFirewallService
};

// Export types
export type {
  ValidationResult,
  RateLimitResult,
  APIKeyRotationResult,
  CompliantSecurityStats,
  WAFResult
};