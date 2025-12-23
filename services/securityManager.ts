import { InputValidationService, ValidationResult } from './security/inputValidationService';
import { RateLimitService } from './security/rateLimitService';
import { ThreatDetectionService, ThreatDetectionResult } from './security/threatDetectionService';
import { EncryptionService } from './security/encryptionService';

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
        suspiciousPatterns: RegExp[];
      };
  threatDetection: {
    enabled: boolean;
    alertThreshold: number;
  };
  inputValidation: {
    maxStringLength: number;
    allowedHTMLTags: string[];
  };
}

interface SecurityStatistics {
  validation: {
    totalValidations: number;
    failedValidations: number;
    averageRiskScore: number;
  };
  rateLimiting: {
    totalEntries: number;
    activeEntries: number;
    botDetections: number;
    blockedRegions: string[];
  };
  threatDetection: {
    totalThreats: number;
    blockedIPs: number;
    recentThreats: number;
    topThreatTypes: Array<{ type: string; count: number }>;
  };
  encryption: {
    activeAPIKeys: number;
    activeCSRFtokens: number;
    totalKeyRotations: number;
    averageKeyUsage: number;
  };
  performance: {
    responseTimeStats: {
      average: number;
      min: number;
      max: number;
      p95: number;
    };
    throughput: {
      requestsPerMinute: number;
      requestsPerHour: number;
    };
  };
}

/**
 * Modular SecurityManager - facade for focused security services
 */
class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig;
  
  // Modular service instances
  private readonly inputValidator: InputValidationService;
  private readonly rateLimiter: RateLimitService;
  private readonly threatDetector: ThreatDetectionService;
  private readonly encryptionService: EncryptionService;

  // Performance tracking
  private responseTimeStats: number[] = [];
  private requestTimestamps: number[] = [];

  private constructor() {
    this.config = {
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
        algorithm: 'AES-GCM',
        keyRotationInterval: 3600000,
      },
      edgeRateLimiting: {
        enabled: true,
        requestsPerSecond: 10,
        burstLimit: 20,
      },
      regionBlocking: {
        enabled: true,
        blockedRegions: ['CN', 'RU', 'KP', 'IR']
      },
      botDetection: {
        enabled: true,
        suspiciousPatterns: [
          /bot/i, /crawler/i, /spider/i, /scraper/i,
          /curl/i, /wget/i, /python/i, /java/i
        ]
      },
      threatDetection: {
        enabled: true,
        alertThreshold: 80
      },
      inputValidation: {
        maxStringLength: 10000,
        allowedHTMLTags: []
      }
    };

    // Initialize modular services
    this.inputValidator = new InputValidationService();
    this.rateLimiter = new RateLimitService(this.config.rateLimiting, this.config.botDetection);
    this.threatDetector = new ThreatDetectionService(this.config.threatDetection);
    this.encryptionService = new EncryptionService(this.config.encryption);

    // Initialize monitoring
    this.initializeMonitoring();
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // ==================== INPUT VALIDATION ====================

  /**
   * Sanitize and validate input data with comprehensive security checks
   */
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user' | 'text' | 'code' | 'symbol' | 'url' | 'token' | 'html' = 'text'): ValidationResult {
    const startTime = Date.now();
    
    try {
      // Check payload size
      const dataSize = JSON.stringify(data).length;
      if (dataSize > this.config.maxPayloadSize) {
        return {
          isValid: false,
          errors: [`Payload too large: ${dataSize} bytes (max: ${this.config.maxPayloadSize})`],
          riskScore: 100
        };
      }

      // Basic structure validation
      if (!data || typeof data !== 'object') {
        return {
          isValid: false,
          errors: ['Invalid data structure'],
          riskScore: 50
        };
      }

      let validationResult: ValidationResult;
      
      // Type-specific validation
      switch (type) {
        case 'robot':
          validationResult = this.inputValidator.validateRobotData(data);
          break;
        case 'strategy':
          validationResult = this.inputValidator.validateStrategyData(data);
          break;
        case 'backtest':
          // Delegate to strategy validation for backtest (similar structure)
          validationResult = this.inputValidator.validateStrategyData(data);
          break;
        case 'user':
          validationResult = { isValid: true, errors: [], riskScore: 0, sanitizedData: data };
          break;
        case 'code':
          const codeValidation = this.inputValidator.validateMQL5Code(data);
          validationResult = {
            isValid: codeValidation.isValid,
            errors: codeValidation.errors,
            riskScore: codeValidation.isValid ? 0 : 50,
            sanitizedData: codeValidation.sanitizedCode
          };
          break;
        case 'symbol':
          const sanitizedSymbol = this.inputValidator.sanitizeSymbol(data);
          validationResult = {
            isValid: sanitizedSymbol.length > 0,
            errors: sanitizedSymbol.length === 0 ? ['Invalid symbol'] : [],
            riskScore: sanitizedSymbol.length === 0 ? 50 : 0,
            sanitizedData: sanitizedSymbol
          };
          break;
        default:
          // Generic text validation
          const sanitizedText = this.inputValidator.sanitizeString(String(data));
          validationResult = {
            isValid: true,
            errors: [],
            riskScore: 0,
            sanitizedData: sanitizedText
          };
      }

      // XSS and injection prevention
      const xssResult = this.inputValidator.preventXSS(validationResult.sanitizedData || data);
      const sqlResult = this.inputValidator.preventSQLInjection(xssResult.sanitizedData);

      let riskScore = validationResult.riskScore;
      if (xssResult.hasXSS) riskScore += 30;
      if (sqlResult.hasSQLInjection) riskScore += 40;

      // Prevent prototype pollution
      if (this.isPrototypePollution(sqlResult.sanitizedData)) {
        riskScore += 50;
        validationResult.errors.push('Prototype pollution detected');
      }

      this.recordResponseTime(Date.now() - startTime);
      
      return {
        isValid: validationResult.isValid && riskScore < 50,
        errors: [...validationResult.errors],
        riskScore: Math.min(riskScore, 100),
        sanitizedData: sqlResult.sanitizedData
      };

    } catch (error) {
      this.recordResponseTime(Date.now() - startTime);
      return {
        isValid: false,
        errors: [`Validation error: ${error}`],
        riskScore: 100
      };
    }
  }

  // ==================== RATE LIMITING ====================

  /**
   * Check if request is rate limited
   */
  isRateLimited(identifier: string, userTier: 'free' | 'premium' | 'enterprise' = 'free'): boolean {
    const startTime = Date.now();
    const result = this.rateLimiter.isRateLimited(identifier, userTier);
    this.recordResponseTime(Date.now() - startTime);
    return result.limited;
  }

  /**
   * Get comprehensive rate limiting info
   */
  getRateLimitInfo(identifier: string, userTier: 'free' | 'premium' | 'enterprise' = 'free') {
    const startTime = Date.now();
    const result = this.rateLimiter.isRateLimited(identifier, userTier);
    this.recordResponseTime(Date.now() - startTime);
    return result;
  }

  /**
   * Check for bot detection
   */
  isBotDetected(identifier: string, requestInfo: {
    userAgent?: string;
    headers?: Record<string, string>;
    timing?: number;
  }) {
    const startTime = Date.now();
    const result = this.rateLimiter.isBotDetected(identifier, requestInfo);
    this.recordResponseTime(Date.now() - startTime);
    return result;
  }

  // ==================== THREAT DETECTION ====================

  /**
   * Detect security threats in requests
   */
  detectThreats(request: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    ip?: string;
    userAgent?: string;
  }): ThreatDetectionResult {
    const startTime = Date.now();
    const result = this.threatDetector.detectThreats(request);
    this.recordResponseTime(Date.now() - startTime);
    return result;
  }

  // ==================== ENCRYPTION ====================

  /**
   * Get current API key
   */
  getCurrentAPIKey(): string {
    return this.encryptionService.getCurrentAPIKey();
  }

  /**
   * Generate new API key
   */
  generateAPIKey(): string {
    return this.encryptionService.generateSecureAPIKey();
  }

  /**
   * Validate API key
   */
  validateAPIKey(key: string): boolean {
    return this.encryptionService.validateAPIKey(key);
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(context?: string): string {
    return this.encryptionService.generateCSRFToken(context);
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(tokenId: string, expectedToken?: string): boolean {
    return this.encryptionService.validateCSRFToken(tokenId, expectedToken);
  }

  /**
   * Encrypt data
   */
  async encrypt(data: string, key?: string): Promise<{ encrypted: string; iv: string; timestamp: number }> {
    return this.encryptionService.encrypt(data, key);
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData: { encrypted: string; iv: string; timestamp: number }, key?: string): Promise<string> {
    return this.encryptionService.decrypt(encryptedData, key);
  }

  // ==================== ORIGIN VALIDATION ====================

  /**
   * Validate origin against allowed origins
   */
  validateOrigin(origin: string): boolean {
    if (!origin) return false;
    return this.config.allowedOrigins.includes(origin);
  }

  // ==================== COMPREHENSIVE STATISTICS ====================

  /**
   * Get comprehensive security statistics
   */
  getSecurityStatistics(): SecurityStatistics {
    const validationStats = this.getValidationStatistics();
    const rateLimitStats = this.rateLimiter.getStatistics();
    const threatStats = this.threatDetector.getThreatStatistics();
    const encryptionStats = this.encryptionService.getSecurityStatistics();
    const performanceStats = this.getPerformanceStatistics();

    return {
      validation: validationStats,
      rateLimiting: rateLimitStats,
      threatDetection: threatStats,
      encryption: encryptionStats,
      performance: performanceStats
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Hash string for rate limiting and caching
   */
  hashString(input: string): string {
    if (!input) return '';
    
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Safe JSON parsing with prototype pollution protection
   */
  safeJSONParse(jsonString: string): any {
    try {
      const parsed = JSON.parse(jsonString);
      
      if (this.isPrototypePollution(parsed)) {
        throw new Error('Prototype pollution detected in JSON');
      }
      
      return parsed;
    } catch (error) {
      console.error('JSON parsing error:', error);
      return null;
    }
  }

  /**
   * Check for private IP
   */
  isPrivateIP(ip: string): boolean {
    if (!ip) return false;
    
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

  // ==================== PRIVATE HELPERS ====================

  private isPrototypePollution(obj: any): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    for (const key of dangerousKeys) {
      if (key in obj) {
        return true;
      }
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
        if (this.isPrototypePollution(obj[key])) {
          return true;
        }
      }
    }

    return false;
  }

  private initializeMonitoring(): void {
    // Cleanup expired entries periodically
    setInterval(() => {
      this.rateLimiter.cleanup();
      this.encryptionService.cleanup();
      this.cleanupPerformanceData();
    }, 300000); // Every 5 minutes
  }

  private recordResponseTime(time: number): void {
    this.responseTimeStats.push(time);
    
    // Keep only last 1000 measurements
    if (this.responseTimeStats.length > 1000) {
      this.responseTimeStats = this.responseTimeStats.slice(-1000);
    }

    // Track request timestamps for throughput calculation
    this.requestTimestamps.push(Date.now());
    this.cleanupOldTimestamps();
  }

  private cleanupOldTimestamps(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > oneHourAgo);
  }

  private cleanupPerformanceData(): void {
    this.cleanupOldTimestamps();
    
    // Keep only recent response times
    if (this.responseTimeStats.length > 1000) {
      this.responseTimeStats = this.responseTimeStats.slice(-1000);
    }
  }

  private getValidationStatistics() {
    // Simplified stats - in production, track actual validation metrics
    return {
      totalValidations: 0,
      failedValidations: 0,
      averageRiskScore: 0
    };
  }

  private getPerformanceStatistics() {
    const sortedTimes = [...this.responseTimeStats].sort((a, b) => a - b);
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    return {
      responseTimeStats: {
        average: sortedTimes.length > 0 ? sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length : 0,
        min: sortedTimes.length > 0 ? (sortedTimes[0] || 0) : 0,
        max: sortedTimes.length > 0 ? (sortedTimes[sortedTimes.length - 1] || 0) : 0,
        p95: sortedTimes.length > 0 ? (sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0) : 0
      },
      throughput: {
        requestsPerMinute: this.requestTimestamps.filter(t => t > oneMinuteAgo).length,
        requestsPerHour: this.requestTimestamps.filter(t => t > oneHourAgo).length
      }
    };
  }

  // ==================== CONFIGURATION MANAGEMENT ====================

  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reconfigure services as needed
    // Note: Some service reconfiguration might require service recreation
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const securityManager = SecurityManager.getInstance();
export { SecurityManager as SecurityManagerClass };