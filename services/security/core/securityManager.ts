// import { Robot, StrategyParams, BacktestSettings } from '../../../types';

// Import modular services
import { InputValidationService } from '../validation/inputValidationService';
import { RateLimitingService } from '../accessControl/rateLimitingService';
import { WAFService } from '../firewall/wafService';
import { CSPMonitoringService } from '../monitoring/cspMonitoringService';
import { TokenManagementService } from '../authentication/tokenManagementService';
import { SecurityUtilsService } from '../utils/securityUtilsService';

// Legacy interfaces for backward compatibility
interface SecurityConfig {
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

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

/**
 * SecurityManager - Facade for modular security services
 * 
 * This facade maintains backward compatibility while delegating to specialized services.
 * Each security domain is now handled by a dedicated service class.
 */
class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig;
  
  // Modular services
  private inputValidation: InputValidationService;
  private rateLimiting: RateLimitingService;
  private waf: WAFService;
  private cspMonitor: CSPMonitoringService;
  private tokenManager: TokenManagementService;
  private securityUtils: SecurityUtilsService;

  private readonly defaultConfig: SecurityConfig = {
    maxPayloadSize: 5 * 1024 * 1024,
    allowedOrigins: [
      'https://quanforge.ai',
      'https://www.quanforge.ai',
      'http://localhost:3000',
      'http://localhost:5173'
    ],
    rateLimiting: {
      windowMs: 60000,
      maxRequests: 100,
    },
    encryption: {
      algorithm: 'AES-256-GCM',
      keyRotationInterval: 43200000,
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
    this.config = { ...this.defaultConfig };
    
    // Initialize modular services
    this.inputValidation = InputValidationService.getInstance();
    this.rateLimiting = RateLimitingService.getInstance();
    this.waf = WAFService.getInstance();
    this.cspMonitor = CSPMonitoringService.getInstance();
    this.tokenManager = TokenManagementService.getInstance();
    this.securityUtils = SecurityUtilsService.getInstance();
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // ========== Input Validation & Sanitization ==========
  
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    return this.inputValidation.sanitizeAndValidate(data, type);
  }

  validateInput(input: any, type: 'search' | 'record' | 'robot' | 'strategy' | 'backtest' | 'user' | 'text' | 'code' | 'symbol' | 'url' | 'token' | 'html' = 'text'): boolean {
    // Map legacy types to service types
    const mappedType = this.mapLegacyTypeToService(type);
    return this.securityUtils.validateInput(input, mappedType);
  }

  sanitizeInput(input: string, type: 'text' | 'code' | 'symbol' | 'url' | 'token' | 'search' | 'email' | 'html' = 'text'): string {
    return this.securityUtils.sanitizeInput(input, type);
  }

  validateSymbol(symbol: string): boolean {
    return this.securityUtils.validateSymbol(symbol);
  }

  safeJSONParse(jsonString: string): any {
    return this.securityUtils.safeJSONParse(jsonString);
  }

  hashString(input: string): string {
    return this.securityUtils.hashString(input);
  }

  // ========== Rate Limiting ==========
  
  checkRateLimit(identifier: string): { allowed: boolean; resetTime?: number } {
    return this.rateLimiting.checkRateLimit(identifier);
  }

  checkAdaptiveRateLimit(identifier: string, userTier: string = 'basic'): { 
    allowed: boolean; 
    resetTime?: number; 
    remainingRequests?: number;
  } {
    return this.rateLimiting.checkAdaptiveRateLimit(identifier, userTier);
  }

  checkEdgeRateLimit(identifier: string, region: string = 'global'): { 
    allowed: boolean;
    resetTime?: number;
    retryAfter?: number;
    burstTokens?: number;
  } {
    return this.rateLimiting.checkEdgeRateLimit(identifier, region);
  }

  getSecurityMetrics(): {
    rateLimitEntries: number;
    averageRiskScore: number;
    blockedRequests: number;
  } {
    const metrics = this.rateLimiting.getRateLimitMetrics();
    return {
      rateLimitEntries: metrics.activeEntries,
      averageRiskScore: 0, // Would need comprehensive tracking
      blockedRequests: metrics.blockedRequests
    };
  }

  getComprehensiveSecurityStats(): {
    rateLimitStats: {
      activeEntries: number;
      blockedRequests: number;
      averageUsage: number;
      peakUsage: number;
      tierDistribution: Record<string, number>;
    };
    wafStats: {
      blockedIPs: number;
      attackPatterns: number;
      topThreats: Array<{ threat: string; count: number }>;
    };
    tokenStats: {
      activeCSRF: number;
      expiredCSRF: number;
      activeAPIKeys: number;
      inactiveAPIKeys: number;
    };
    cspStats?: {
      totalViolations: number;
      blockedURIs: number;
    };
  } {
    return {
      rateLimitStats: this.rateLimiting.getRateLimitMetrics(),
      wafStats: this.waf.getWAFStats(),
      tokenStats: this.tokenManager.getTokenStats(),
      cspStats: this.cspMonitor.getCSPStats()
    };
  }

  // ========== Web Application Firewall ==========
  
  detectWAFPatterns(request: Request): { isMalicious: boolean; threats: string[]; riskScore: number } {
    return this.waf.detectWAFPatterns(request);
  }

  detectEdgeBot(userAgent: string, ip: string, requestPattern: any): { 
    isBot: boolean; 
    botType: string; 
    confidence: number;
  } {
    return this.waf.detectBotActivity(userAgent, ip, requestPattern);
  }

  setupEdgeWAF(): void {
    // Initialize edge WAF configuration
    this.waf.updateConfig({
      enabled: true,
      strictMode: this.config.botDetection.enabled,
      logLevel: 'warn',
      threshold: {
        medium: 50,
        high: 70,
        critical: 85
      }
    });
  }

  // ========== CSP Monitoring ==========
  
  monitorCSPViolations(): void {
    this.cspMonitor.monitorCSPViolations();
  }

  rotateAPIKeys(): { oldKey: string; newKey: string; expiresAt: number } {
    // This would need a concrete key rotation implementation
    // For now, return a placeholder
    const oldKey = this.securityUtils.generateSecureRandom(32);
    const newKey = this.securityUtils.generateSecureRandom(32);
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    return { oldKey, newKey, expiresAt };
  }

  // ========== Token Management ==========
  
  generateCSRFToken(sessionId: string): string {
    return this.tokenManager.generateCSRFToken(sessionId);
  }

  validateCSRFToken(sessionId: string, token: string): boolean {
    return this.tokenManager.validateCSRFToken(sessionId, token);
  }

  validateAPIKey(apiKey: string, type: 'gemini' | 'supabase' | 'twelvedata' | 'generic' = 'generic'): boolean {
    return this.tokenManager.validateAPIKey(apiKey, type);
  }

  // ========== Origin & Configuration ==========
  
  validateOrigin(origin: string): boolean {
    return this.config.allowedOrigins.includes(origin);
  }

  // ========== Advanced Edge Operations ==========
  
  detectEdgeAnomalies(userPattern: any): { 
    isAnomalous: boolean; 
    riskScore: number; 
    reasons: string[] 
  } {
    const anomalies = this.waf.detectHeaderAnomalies(userPattern.headers || {});
    
    return {
      isAnomalous: anomalies.hasAnomalies,
      riskScore: anomalies.riskScore,
      reasons: anomalies.anomalies
    };
  }

  detectRegionalAbuse(_region: string): {
    isAbusive: boolean;
    riskScore: number;
    topIPs: Array<{ ip: string; requestCount: number }>;
  } {
    // Implement regional abuse detection based on rate limiting data
    // For now, return placeholder
    return {
      isAbusive: false,
      riskScore: 0,
      topIPs: []
    };
  }

  // ========== Helper Methods ==========
  
  private mapLegacyTypeToService(type: string): 'text' | 'code' | 'symbol' | 'url' | 'token' | 'search' | 'email' | 'html' {
    const typeMap: Record<string, 'text' | 'code' | 'symbol' | 'url' | 'token' | 'search' | 'email' | 'html'> = {
      'text': 'text',
      'code': 'code',
      'symbol': 'symbol',
      'url': 'url',
      'token': 'token',
      'search': 'search',
      'email': 'email',
      'html': 'html',
      'robot': 'text', // Map complex types to text for basic validation
      'strategy': 'text',
      'backtest': 'text',
      'user': 'text',
      'record': 'text'
    };
    
    return typeMap[type] || 'text';
  }

  // ========== Configuration & Management ==========
  
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update dependent service configurations
    this.rateLimiting.updateConfig({
      rateLimiting: this.config.rateLimiting,
      edgeRateLimiting: this.config.edgeRateLimiting
    });
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  // ========== Migration Support ==========
  
  /**
   * Legacy method to support existing code that might use SecurityManager directly
   * @deprecated Use specific service methods instead
   */
  getSecurityService(serviceName: 'validation' | 'rateLimit' | 'waf' | 'csp' | 'token' | 'utils') {
    switch (serviceName) {
      case 'validation': return this.inputValidation;
      case 'rateLimit': return this.rateLimiting;
      case 'waf': return this.waf;
      case 'csp': return this.cspMonitor;
      case 'token': return this.tokenManager;
      case 'utils': return this.securityUtils;
      default: throw new Error(`Unknown security service: ${serviceName}`);
    }
  }
}

// Export both the facaded class and singleton instance
export { SecurityManager as default };
export { SecurityManager };
export type { SecurityConfig, ValidationResult };