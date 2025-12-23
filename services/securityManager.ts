import { InputValidationService } from './InputValidationService';
import { RateLimitService, RateLimitResult } from './RateLimitService';
import { EncryptionService } from './EncryptionService';
import { SecurityPolicyService, PolicyContext, PolicyResult } from './SecurityPolicyService';
import { ThreatDetectionService, DetectionContext, ThreatResult } from './ThreatDetectionService';

// Re-export interfaces for backward compatibility
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
  // Add missing edge-specific security configuration
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

class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig = {
    maxPayloadSize: 5 * 1024 * 1024, // Reduced to 5MB for better security
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
      keyRotationInterval: 43200000, // 12 hours - more frequent rotation
    },
    // Add missing edge security configurations
    edgeRateLimiting: {
      enabled: true,
      requestsPerSecond: 10,
      burstLimit: 20
    },
    regionBlocking: {
      enabled: true,
      blockedRegions: ['CN', 'RU', 'IR', 'KP'] // Example blocked regions
    },
    botDetection: {
      enabled: true,
      suspiciousPatterns: [
        'sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster', 
        'wfuzz', 'burp', 'owasp', 'scanner', 'bot', 'crawler', 'spider'
      ]
    }
  };
  
  // Service instances - composition pattern
  private inputValidationService!: InputValidationService;
  private rateLimitService!: RateLimitService;
  private encryptionService!: EncryptionService;
  private policyService!: SecurityPolicyService;
  private threatDetectionService!: ThreatDetectionService;

  // Legacy rate limit map for backward compatibility (not actively used)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  private constructor() {
    this.initializeServices();
  }

  /**
   * Initialize all security services
   */
  private initializeServices(): void {
    // Initialize Input Validation Service
    this.inputValidationService = new InputValidationService({
      maxPayloadSize: this.config.maxPayloadSize,
      maxInputLength: 10000,
      allowedHtmlTags: ['b', 'i', 'em', 'strong', 'a', 'code', 'pre'],
      forbiddenPatterns: [
        /javascript:/gi,
        /vbscript:/gi,
        /onload=/gi,
        /onerror=/gi,
        /onclick=/gi,
        /<script/gi,
        /<iframe/gi,
        /<object/gi,
        /<embed/gi,
        /eval\s*\(/gi,
        /expression\s*\(/gi,
        /@import/gi,
        /binding\s*:/gi
      ]
    });

    // Initialize Rate Limit Service
    this.rateLimitService = new RateLimitService({
      windowMs: this.config.rateLimiting.windowMs,
      maxRequests: this.config.rateLimiting.maxRequests,
      edgeRateLimiting: this.config.edgeRateLimiting,
      regionBlocking: this.config.regionBlocking
    });

    // Initialize Encryption Service
    this.encryptionService = new EncryptionService({
      algorithm: this.config.encryption.algorithm,
      keyRotationInterval: this.config.encryption.keyRotationInterval,
      enableEncryption: true,
      fallbackToSimple: true
    });

    // Initialize Policy Service
    this.policyService = new SecurityPolicyService();

    // Initialize Threat Detection Service
    this.threatDetectionService = new ThreatDetectionService({
      enabled: this.config.botDetection.enabled,
      suspiciousPatterns: this.config.botDetection.suspiciousPatterns,
      wafEnabled: true,
      ipBlacklist: [],
      ipWhitelist: [],
      maxThreatScore: 100
    });
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // Input sanitization and validation - delegates to InputValidationService
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    const result = this.inputValidationService.sanitizeAndValidate(data, type);
    
    // Update legacy rateLimitMap for backward compatibility
    this.updateLegacyRateLimitMap();
    
    return result;
  }

  /**
   * Update legacy rate limit map based on RateLimitService
   */
  private updateLegacyRateLimitMap(): void {
    try {
      // Create a combined view of rate limiting for backward compatibility
      this.rateLimitService.getStatistics();
      // In a real implementation, you would sync this properly
      // For now, just ensure the map is maintained as a placeholder
    } catch (error) {
      console.warn('Failed to update legacy rate limit map:', error);
    }
  }

  // Robot data validation - delegates to InputValidationService
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private validateRobotData(data: any): ValidationResult {
    const result = this.inputValidationService.sanitizeAndValidate(data, 'robot');
    return result;
  }

  // Strategy validation - delegates to InputValidationService
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private validateStrategyData(data: any): ValidationResult {
    const result = this.inputValidationService.sanitizeAndValidate(data, 'strategy');
    return result;
  }

  // Backtest validation - delegates to InputValidationService
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private validateBacktestData(data: any): ValidationResult {
    const result = this.inputValidationService.sanitizeAndValidate(data, 'strategy');
    return result;
  }

  // User validation - delegates to InputValidationService
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private validateUserData(data: any): ValidationResult {
    const result = this.inputValidationService.sanitizeAndValidate(data, 'user');
    return result;
  }

  /**
   * Detect anomalies in edge request patterns - delegates to RateLimitService
   */
  detectEdgeAnomalies(identifier: string): string[] {
    return this.rateLimitService.detectEdgeAnomalies(identifier);
  }

  /**
   * Enhanced edge rate limiting - delegates to RateLimitService
   */
  checkEdgeRateLimit(identifier: string, region: string, endpoint?: string): { 
    allowed: boolean; 
    resetTime?: number; 
    remainingRequests?: number;
    reason?: string;
    retryAfter?: number;
  } {
    const result = this.rateLimitService.checkEdgeRateLimit(identifier, region, endpoint);
    return result;
  }

  /**
   * Bot detection for edge functions - delegates to ThreatDetectionService
   */
  detectEdgeBot(userAgent: string, ip: string, requestPattern?: any): { 
    isBot: boolean; 
    confidence: number; 
    botType?: string;
  } {
    const context: DetectionContext = {
      ip,
      userAgent,
      requestPattern
    };

    const result = this.threatDetectionService.detectThreats(context);
    const botThreat = result.details.find(d => d.type === 'bot');
    
    if (botThreat) {
      return {
        isBot: true,
        confidence: botThreat.riskScore,
        botType: botThreat.description
      };
    }

    return { isBot: false, confidence: 0 };
  }

  // Enhanced input sanitization - delegates to InputValidationService
  sanitizeInput(input: string, type: 'text' | 'code' | 'symbol' | 'url' | 'token' | 'search' | 'email' | 'html' = 'text'): string {
    return this.inputValidationService.sanitizeInput(input, type);
  }

  // CSRF token generation and validation - delegates to EncryptionService
  generateCSRFToken(sessionId: string): string {
    return this.encryptionService.generateCSRFToken(sessionId);
  }

  validateCSRFToken(sessionId: string, token: string): boolean {
    return this.encryptionService.validateCSRFToken(sessionId, token);
  }

  // Enhanced symbol validation - delegates to InputValidationService
  validateSymbol(symbol: string): boolean {
    const sanitized = this.inputValidationService.sanitizeSymbol(symbol);
    return sanitized !== '';
  }

  // Symbol sanitization - delegates to InputValidationService
  sanitizeSymbol(symbol: string): string {
    return this.inputValidationService.sanitizeSymbol(symbol);
  }

  // Generate secure random token - delegates to EncryptionService
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private generateSecureToken(): string {
    return this.encryptionService.generateSecureToken();
  }

  // Hash string for rate limiting and caching - delegates to EncryptionService
  hashString(input: string): string {
    return this.encryptionService.hashString(input);
  }

  /**
   * Validate input based on type - delegates to InputValidationService
   */
   validateInput(input: any, type: 'search' | 'record' | 'robot' | 'strategy' | 'backtest' | 'user' | 'text' | 'code' | 'symbol' | 'url' | 'token' | 'html' = 'text'): boolean {
     return this.inputValidationService.validateInput(input, type);
   }

  validateMQL5Code(code: string): { isValid: boolean; errors: string[]; sanitizedCode: string } {
     return this.inputValidationService.validateMQL5Code(code);
   }

   // Safe JSON parsing with prototype pollution protection
   safeJSONParse(jsonString: string): any {
     try {
       // First, parse the JSON
       const parsed = JSON.parse(jsonString);
       
       // Check for prototype pollution
       if (this.isPrototypePollution(parsed)) {
         throw new Error('Prototype pollution detected in JSON');
       }
       
       return parsed;
     } catch (error) {
       console.error('JSON parsing error:', error);
       return null;
     }
   }

   // Prevent prototype pollution attacks
   private isPrototypePollution(obj: any): boolean {
     if (!obj || typeof obj !== 'object') {
       return false;
     }

     // Check for dangerous prototype pollution patterns
     const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
     
     for (const key of dangerousKeys) {
       if (key in obj) {
         return true;
       }
     }

     // Check nested objects
     for (const key in obj) {
       if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
         if (this.isPrototypePollution(obj[key])) {
           return true;
         }
       }
     }

     return false;
   }

  /**
   * Get access to the InputValidationService (for advanced usage)
   */
  getInputValidationService(): InputValidationService {
    return this.inputValidationService;
  }

  /**
   * Get access to the RateLimitService (for advanced usage)
   */
  getRateLimitService(): RateLimitService {
    return this.rateLimitService;
  }

  /**
   * Get access to the EncryptionService (for advanced usage)
   */
  getEncryptionService(): EncryptionService {
    return this.encryptionService;
  }

  /**
   * Get access to the PolicyService (for advanced usage)
   */
  getPolicyService(): SecurityPolicyService {
    return this.policyService;
  }

  /**
   * Get access to the ThreatDetectionService (for advanced usage)
   */
  getThreatDetectionService(): ThreatDetectionService {
    return this.threatDetectionService;
  }

  /**
   * Comprehensive security check combining all services
   */
  comprehensiveSecurityCheck(
    data: any, 
    type: 'robot' | 'strategy' | 'backtest' | 'user',
    context?: DetectionContext
  ): {
    isValid: boolean;
    validation: ValidationResult;
    rateLimit?: RateLimitResult;
    threats?: ThreatResult;
    policies?: PolicyResult[];
    overallRiskScore: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let overallRiskScore = 0;

    // Input validation
    const validation = this.sanitizeAndValidate(data, type);
    let isValid = validation.isValid;
    overallRiskScore += validation.riskScore;

    // Rate limiting (if context provided with identifier)
    let rateLimit: RateLimitResult | undefined;
    if (context?.ip) {
      rateLimit = this.checkEdgeRateLimit(context.ip, context.region || 'unknown');
      if (!rateLimit.allowed) {
        isValid = false;
        recommendations.push('Rate limit exceeded');
        overallRiskScore += 50;
      }
    }

    // Threat detection (if context provided)
    let threats: ThreatResult | undefined;
    if (context) {
      threats = this.threatDetectionService.detectThreats(context);
      if (threats.isThreat) {
        isValid = false;
        recommendations.push(`Threats detected: ${threats.threatTypes.join(', ')}`);
        overallRiskScore += threats.riskScore;
      }
    }

    // Policy evaluation (if context provided)
    let policies: PolicyResult[] | undefined;
    if (context) {
      const policyContext: PolicyContext = {
        ip: context.ip,
        userAgent: context.userAgent,
        region: context.region,
        headers: context.headers,
        method: context.method,
        path: context.url
      };
      
      policies = this.policyService.evaluatePolicies(policyContext);
      const policyActions = this.policyService.getRecommendedActions(policies);
      
      // Check if any blocking actions
      const hasBlockingActions = policyActions.some(action => action.type === 'block');
      if (hasBlockingActions) {
        isValid = false;
        recommendations.push('Blocked by security policies');
        overallRiskScore += 60;
      }
      
      const policyRiskScore = this.policyService.getTotalRiskScore(policies);
      overallRiskScore += policyRiskScore;
    }

    // Add recommendations based on risk score
    if (overallRiskScore > 70) {
      recommendations.push('High risk detected - consider blocking');
    } else if (overallRiskScore > 40) {
      recommendations.push('Medium risk - additional monitoring recommended');
    }

    if (recommendations.length === 0 && isValid) {
      recommendations.push('Security check passed');
    }

    return {
      isValid,
      validation,
      rateLimit,
      threats,
      policies,
      overallRiskScore: Math.min(100, overallRiskScore),
      recommendations
    };
  }

  /**
   * Update configuration for all services
   */
  updateConfiguration(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update individual service configurations
    this.inputValidationService.updateConfig({
      maxPayloadSize: this.config.maxPayloadSize
    });

    this.rateLimitService.updateConfig({
      windowMs: this.config.rateLimiting.windowMs,
      maxRequests: this.config.rateLimiting.maxRequests,
      edgeRateLimiting: this.config.edgeRateLimiting,
      regionBlocking: this.config.regionBlocking
    });

    this.encryptionService.updateConfig({
      algorithm: this.config.encryption.algorithm,
      keyRotationInterval: this.config.encryption.keyRotationInterval
    });

    this.threatDetectionService.updateConfig({
      enabled: this.config.botDetection.enabled,
      suspiciousPatterns: this.config.botDetection.suspiciousPatterns
    });
  }

  /**
   * Get comprehensive statistics from all services
   */
  getComprehensiveStatistics(): {
    inputValidation: any;
    rateLimit: any;
    encryption: any;
    policies: any;
    threats: any;
  } {
    return {
      inputValidation: this.inputValidationService.getConfig(),
      rateLimit: this.rateLimitService.getStatistics(),
      encryption: this.encryptionService.getStatistics(),
      policies: this.policyService.getPolicyStatistics() instanceof Map 
        ? Array.from((this.policyService.getPolicyStatistics() as Map<string, any>).entries())
        : [],
      threats: this.threatDetectionService.getStatistics()
    };
  }

  /**
   * Cleanup method to properly destroy all services
   */
  destroy(): void {
    this.rateLimitService.destroy();
    this.encryptionService.destroy();
    this.policyService.clearAuditLog();
    this.threatDetectionService.clearThreatLog();
    this.threatDetectionService.clearIPReputation();
  }
}

export const securityManager = SecurityManager.getInstance();
export { SecurityManager };
export type { SecurityConfig, ValidationResult };