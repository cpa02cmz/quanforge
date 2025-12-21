import { RequestValidator, SecurityConfig, ValidationResult } from './security/requestValidator';
import { APIKeyManager, APIKeyRotationResult } from './security/apiKeyManager';
import { ThreatDetector, WAFResult, SecurityAlert } from './security/threatDetector';
import { RateLimitService, RateLimitResult } from './security/rateLimitService';

class SecurityManager {
  private static instance: SecurityManager;
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

  // Service instances
  private requestValidator: RequestValidator;
  private apiKeyManager: APIKeyManager;
  private threatDetector: ThreatDetector;
  private rateLimitService: RateLimitService;

  private constructor() {
    this.requestValidator = new RequestValidator(this.config);
    this.apiKeyManager = new APIKeyManager(this.config.encryption.keyRotationInterval);
    this.threatDetector = new ThreatDetector(this.config);
    this.rateLimitService = new RateLimitService(
      this.config.rateLimiting,
      {
        basic: { windowMs: 60000, maxRequests: 100 },
        premium: { windowMs: 60000, maxRequests: 500 },
        enterprise: { windowMs: 60000, maxRequests: 2000 }
      },
      this.config.edgeRateLimiting,
      this.config.regionBlocking
    );

    // Initialize services
    this.initializeServices();
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  private initializeServices(): void {
    // Initialize API key manager with stored keys
    this.apiKeyManager.loadKeysFromStorage();
    
    // Initialize CSP monitoring
    this.threatDetector.monitorCSPViolations();
    
    // Set up edge WAF
    this.setupEdgeWAF();
  }

  // Request validation methods (delegated to RequestValidator)
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    return this.requestValidator.sanitizeAndValidate(data, type);
  }

  sanitizeInput(input: string, type: 'text' | 'code' | 'symbol' | 'url' | 'token' | 'search' | 'email' | 'html' = 'text'): string {
    return this.requestValidator.sanitizeInput(input, type);
  }

  safeJSONParse(jsonString: string): any {
    return this.requestValidator.safeJSONParse(jsonString);
  }

  validateInput(input: any, type: 'search' | 'record' | 'robot' | 'strategy' | 'backtest' | 'user' | 'text' | 'code' | 'symbol' | 'url' | 'token' | 'html' = 'text'): boolean {
    if (input === null || input === undefined) {
      return false;
    }
    
    // Use existing validation methods based on type
    switch (type) {
      case 'search':
        const searchValidation = this.sanitizeAndValidate({ searchTerm: input }, 'strategy');
        return searchValidation.isValid && searchValidation.riskScore < 30;
        
      case 'record':
        const recordValidation = this.sanitizeAndValidate(input, 'robot');
        return recordValidation.isValid && recordValidation.riskScore < 50;
        
      case 'robot':
      case 'strategy':
      case 'backtest':
      case 'user':
        const validation = this.sanitizeAndValidate(input, type);
        return validation.isValid && validation.riskScore < 70;
        
      default:
        // For other types, use basic sanitization
        const sanitized = this.sanitizeInput(String(input), type);
        return sanitized.length > 0 && sanitized.length < 10000;
    }
  }

  // API key management methods (delegated to APIKeyManager)
  rotateAPIKeys(identifier?: string): APIKeyRotationResult {
    return this.apiKeyManager.rotateAPIKeys(identifier);
  }

  validateAPIKey(apiKey: string, type: 'gemini' | 'supabase' | 'twelvedata' | 'generic' = 'generic'): boolean {
    return this.apiKeyManager.validateAPIKey(apiKey, type);
  }

  getValidAPIKey(identifier?: string): string {
    return this.apiKeyManager.getValidAPIKey(identifier);
  }

  isAPIKeyExpired(identifier: string): boolean {
    return this.apiKeyManager.isAPIKeyExpired(identifier);
  }

  revokeAPIKey(identifier: string): void {
    this.apiKeyManager.revokeAPIKey(identifier);
  }

  getActiveAPIKeys(): Array<{ identifier: string; expiresAt: number; isExpired: boolean }> {
    return this.apiKeyManager.getActiveAPIKeys();
  }

  // CSRF token methods (delegated to APIKeyManager)
  generateCSRFToken(sessionId: string): string {
    const token = this.apiKeyManager.generateCSRFToken();
    const expiresAt = Date.now() + 3600000; // 1 hour
    
    // Store token with expiration
    this.csrfTokens.set(sessionId, { token, expiresAt });
    
    return token;
  }

  validateCSRFToken(sessionId: string, token: string): boolean {
    return this.apiKeyManager.validateCSRFToken(sessionId, token, this.csrfTokens);
  }

  // Threat detection methods (delegated to ThreatDetector)
  detectWAFPatterns(request: Request): WAFResult {
    return this.threatDetector.detectWAFPatterns(request);
  }

  getSecurityStats(): {
    wafStats: { totalRequests: number; blockedRequests: number; topThreats: Array<{ threat: string; count: number }> };
    cspStats: { totalViolations: number; highSeverityViolations: number; topViolations: Array<{ directive: string; count: number }> };
    alertStats: { totalAlerts: number; highSeverityAlerts: number; topAlertTypes: Array<{ type: string; count: number }> };
  } {
    return this.threatDetector.getSecurityStats();
  }

  detectEdgeBot(userAgent: string, requestPattern: { 
    requestFrequency: number; 
    consistentTiming: boolean; 
    missingHeaders: boolean; 
  }) {
    return this.threatDetector.detectEdgeBot(userAgent, requestPattern);
  }

  // Rate limiting methods (delegated to RateLimitService)
  checkRateLimit(identifier: string): RateLimitResult {
    return this.rateLimitService.checkRateLimit(identifier);
  }

  checkAdaptiveRateLimit(identifier: string, userTier: 'basic' | 'premium' | 'enterprise' = 'basic'): RateLimitResult {
    return this.rateLimitService.checkAdaptiveRateLimit(identifier, userTier);
  }

  checkEdgeRateLimit(identifier: string, region: string): RateLimitResult {
    return this.rateLimitService.checkEdgeRateLimit(identifier, region);
  }

  isRateLimited(identifier: string): boolean {
    return this.rateLimitService.isRateLimited(identifier);
  }

  getRemainingRequests(identifier: string): number {
    return this.rateLimitService.getRemainingRequests(identifier);
  }

  resetRateLimit(identifier: string): void {
    this.rateLimitService.resetRateLimit(identifier);
  }

  getRateLimitStats(): {
    activeEntries: number;
    blockedRequests: number;
    totalRequests: number;
    averageRequestsPerWindow: number;
  } {
    return this.rateLimitService.getRateLimitStats();
  }

  // Origin validation (stays in main class)
  validateOrigin(origin: string): boolean {
    return this.config.allowedOrigins.includes(origin);
  }

  // Enhanced symbol validation (delegated to RequestValidator)
  validateSymbol(symbol: string): boolean {
    if (!symbol || typeof symbol !== 'string') {
      return false;
    }

    const sanitized = this.requestValidator.sanitizeInput(symbol, 'symbol');
    
    // Common forex pairs pattern (EUR/USD, GBP/JPY, etc.)
    const forexPattern = /^[A-Z]{3}\/[A-Z]{3}$/;
    if (forexPattern.test(sanitized)) {
      return true;
    }

    // Crypto pairs pattern (BTC/USD, ETH/USDT, etc.)
    const cryptoPattern = /^[A-Z]{3,10}\/[A-Z]{3,10}$/;
    if (cryptoPattern.test(sanitized)) {
      return true;
    }

    // Stock symbols pattern (AAPL, GOOGL, etc.)
    const stockPattern = /^[A-Z]{1,5}$/;
    if (stockPattern.test(sanitized)) {
      return true;
    }

    // Blacklist common invalid symbols
    const blacklist = ['TEST', 'INVALID', 'DEMO', 'SAMPLE'];
    return !blacklist.includes(sanitized);
  }

  // Edge security methods
  setupEdgeWAF(): void {
    // Add edge-specific threat detection
    this.monitorEdgeThreats();
  }

  private monitorEdgeThreats(): void {
    // Monitor request patterns for edge abuse
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.analyzeEdgeRequestPatterns();
      }, 30000); // Check every 30 seconds
    }
  }

  private analyzeEdgeRequestPatterns(): void {
    const recentRequests = this.getRecentEdgeRequests();
    
    // Check for unusual patterns
    const anomalies = this.threatDetector.detectEdgeAnomalies(recentRequests);
    
    if (anomalies.length > 0) {
      this.triggerSecurityAlert('Edge Anomaly Detected', { anomalies });
    }
  }

  private getRecentEdgeRequests(): Array<{ timestamp: number; region: string; endpoint: string }> {
    // In a real implementation, this would pull from edge metrics
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('edge_requests') : null;
    return stored ? JSON.parse(stored) : [];
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
  }

  // Comprehensive security statistics
  getComprehensiveSecurityStats(): {
    wafStats: {
      totalRequests: number;
      blockedRequests: number;
      topThreats: Array<{ threat: string; count: number }>;
    };
    cspStats: {
      totalViolations: number;
      highSeverityViolations: number;
      topViolations: Array<{ directive: string; count: number }>;
    };
    rateLimitStats: {
      activeEntries: number;
      blockedRequests: number;
      topBlockedIPs: Array<{ ip: string; count: number }>;
    };
  } {
    const stats = this.getSecurityStats();
    const rateLimitStats = this.getRateLimitStats();

    return {
      wafStats: stats.wafStats,
      cspStats: stats.cspStats,
      rateLimitStats: {
        activeEntries: rateLimitStats.activeEntries,
        blockedRequests: rateLimitStats.blockedRequests,
        topBlockedIPs: [] // Would need IP tracking implementation
      }
    };
  }

  // Utility methods
  hashString(input: string): string {
    if (!input) return '';
    
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Configuration methods
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize services with new config
    this.requestValidator = new RequestValidator(this.config);
    this.threatDetector = new ThreatDetector(this.config);
    this.rateLimitService.updateConfig(this.config.rateLimiting);
    this.rateLimitService.updateEdgeConfig(this.config.edgeRateLimiting);
    this.rateLimitService.updateRegionConfig(this.config.regionBlocking);
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  // Cleanup method
  cleanup(): void {
    this.apiKeyManager.cleanupExpiredKeys();
    this.rateLimitService.cleanupExpiredEntries();
  }

  // CSRF token storage (remains in main class)
  private csrfTokens = new Map<string, { token: string; expiresAt: number }>();
}

export const securityManager = SecurityManager.getInstance();