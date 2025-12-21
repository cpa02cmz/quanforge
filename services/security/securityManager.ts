import { InputValidator } from './inputValidator';
import { InputSanitizer } from './inputSanitizer';
import { RateLimiter, EdgeRateLimiter } from './rateLimiter';
import { BotDetector } from './botDetector';
import { RegionBlocker } from './regionBlocker';
import { SecurityConfig, ValidationResult, DEFAULT_SECURITY_CONFIG } from './types';

/**
 * Modular SecurityManager - Refactored for maintainability and scalability
 * 
 * This class orchestrates various security modules to provide comprehensive
 * input validation, sanitization, rate limiting, and threat detection.
 */
export class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig;
  
  // Security modules
  private rateLimiter: RateLimiter;
  private edgeRateLimiter: EdgeRateLimiter;
  private botDetector: BotDetector;
  private regionBlocker: RegionBlocker;

  private constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    
    // Initialize modules with their respective configs
    this.rateLimiter = new RateLimiter(this.config.rateLimiting);
    this.edgeRateLimiter = new EdgeRateLimiter(this.config.edgeRateLimiting);
    this.botDetector = new BotDetector(this.config.botDetection);
    this.regionBlocker = new RegionBlocker(this.config.regionBlocking);

    // Start cleanup interval for rate limiters
    this.startCleanupInterval();
  }

  static getInstance(config?: Partial<SecurityConfig>): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager(config);
    }
    return SecurityManager.instance;
  }

  /**
   * Main validation and sanitization method
   */
  sanitizeAndValidate(data: unknown, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    const errors: string[] = [];
    let sanitizedData = data;
    let riskScore = 0;

    try {
      // Check payload size
      const payloadSize = new Blob([JSON.stringify(data)]).size;
      if (payloadSize > this.config.maxPayloadSize) {
        errors.push(`Payload too large: ${payloadSize} bytes (max: ${this.config.maxPayloadSize})`);
        riskScore += 50;
      }

      // Basic structure validation
      if (!data || typeof data !== 'object') {
        errors.push('Invalid data structure');
        riskScore += 30;
        return { isValid: false, errors, riskScore };
      }

      // Type-specific validation
      let validationResult: ValidationResult;
      switch (type) {
        case 'robot':
          validationResult = InputValidator.validateRobotData(data);
          break;
        case 'strategy':
          validationResult = InputValidator.validateStrategyData(data);
          break;
        case 'backtest':
          validationResult = InputValidator.validateBacktestData(data);
          break;
        case 'user':
          validationResult = InputValidator.validateUserData(data);
          break;
      }

      errors.push(...validationResult.errors);
      riskScore += validationResult.riskScore;

      // Sanitize data
      let sanitized: unknown;
      switch (type) {
        case 'robot':
          sanitized = InputSanitizer.sanitizeRobotData(data);
          break;
        case 'backtest':
          sanitized = InputSanitizer.sanitizeBacktestData(data);
          break;
        default:
          sanitized = data; // Pass through for strategy/user
      }

      // XSS prevention
      const xssResult = InputSanitizer.preventXSS(sanitized);
      if (!xssResult.isValid) {
        errors.push(...xssResult.errors);
        riskScore += xssResult.riskScore;
      }
      sanitizedData = xssResult.sanitizedData;

      // SQL injection prevention
      const sqlResult = InputSanitizer.preventSQLInjection(sanitizedData);
      if (!sqlResult.isValid) {
        errors.push(...sqlResult.errors);
        riskScore += sqlResult.riskScore;
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData,
        riskScore
      };
    } catch (error) {
      errors.push('Validation process failed');
      return {
        isValid: false,
        errors,
        riskScore: 100 // Maximum risk for system failures
      };
    }
  }

  /**
   * Rate limiting methods
   */
  isRateLimited(identifier: string) {
    return this.rateLimiter.isRateLimited(identifier);
  }

  resetRateLimit(identifier: string): void {
    this.rateLimiter.resetRateLimit(identifier);
  }

  /**
   * Edge-specific rate limiting
   */
  checkEdgeRateLimit(clientId: string) {
    return this.edgeRateLimiter.checkEdgeRateLimit(clientId);
  }

  /**
   * Bot detection
   */
  analyzeRequest(requestData: {
    userAgent?: string;
    ip?: string;
    headers?: Record<string, string>;
    requestPath?: string;
    requestMethod?: string;
  }) {
    return this.botDetector.analyzeRequest(requestData);
  }

  isSuspiciousIP(ip: string): boolean {
    return this.botDetector.isSuspiciousIP(ip);
  }

  /**
   * Region blocking
   */
  shouldBlockRequest(requestData: {
    ip?: string;
    countryCode?: string;
    forwardedFor?: string;
  }): boolean {
    return this.regionBlocker.shouldBlockRequest(requestData);
  }

  analyzeIP(ip: string) {
    return this.regionBlocker.analyzeIP(ip);
  }

  /**
   * Configuration management
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize modules with new config
    this.rateLimiter = new RateLimiter(this.config.rateLimiting);
    this.edgeRateLimiter = new EdgeRateLimiter(this.config.edgeRateLimiting);
    this.botDetector = new BotDetector(this.config.botDetection);
    this.regionBlocker = new RegionBlocker(this.config.regionBlocking);
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Maintenance
   */
  private startCleanupInterval(): void {
    // Cleanup rate limiters every 5 minutes
    setInterval(() => {
      this.rateLimiter.cleanup();
      this.edgeRateLimiter.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Security audit methods
   */
  getSecurityStatus(): {
    rateLimitActiveUsers: number;
    edgeRateLimitActiveUsers: number;
    blockedRegions: string[];
    botDetectionEnabled: boolean;
    regionBlockingEnabled: boolean;
    edgeRateLimitingEnabled: boolean;
  } {
    return {
      rateLimitActiveUsers: 0, // Would need to expose from rateLimiter
      edgeRateLimitActiveUsers: 0, // Would need to expose from edgeRateLimiter
      blockedRegions: this.regionBlocker.getBlockedRegions(),
      botDetectionEnabled: this.config.botDetection.enabled,
      regionBlockingEnabled: this.config.regionBlocking.enabled,
      edgeRateLimitingEnabled: this.config.edgeRateLimiting.enabled
    };
  }
}