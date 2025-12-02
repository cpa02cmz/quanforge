/**
 * Enhanced Security Manager
 * Advanced security implementation for QuantForge AI
 */

import { Robot } from '../types';
import { securityManager } from './securityManager';

interface SecurityMetrics {
  threatLevel: number;
  securityScore: number;
  vulnerabilities: number;
  blockedAttempts: number;
  successfulAttacks: number;
  falsePositives: number;
}

interface ThreatDetection {
  type: 'xss' | 'sql_injection' | 'code_injection' | 'api_abuse' | 'session_hijacking' | 'prompt_injection';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  timestamp: number;
  details: string;
}

interface SecurityPolicy {
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    perIp: boolean;
  };
  inputValidation: {
    strictMode: boolean;
    allowedOrigins: string[];
    blockedPatterns: string[];
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotationDays: number;
  };
  aiSafety: {
    contentFiltering: boolean;
    promptInjectionProtection: boolean;
    outputValidation: boolean;
  };
}

class EnhancedSecurityManager {
  private static instance: EnhancedSecurityManager;
  private metrics: SecurityMetrics = {
    threatLevel: 0,
    securityScore: 100,
    vulnerabilities: 0,
    blockedAttempts: 0,
    successfulAttacks: 0,
    falsePositives: 0,
  };
  private threatLog: ThreatDetection[] = [];
  private securityPolicy: SecurityPolicy = {
    rateLimiting: {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      perIp: true,
    },
    inputValidation: {
      strictMode: true,
      allowedOrigins: ['https://quanforge.ai', 'http://localhost:3000'],
      blockedPatterns: [
        '<script',
        'javascript:',
        'onerror=',
        'onload=',
        'eval(',
        'exec(',
        'system(',
        'alert(',
        'document.cookie',
        'window.location',
        '__proto__',
        'constructor',
        'prototype'
      ],
    },
    encryption: {
      enabled: true,
      algorithm: 'AES-GCM',
      keyRotationDays: 7,
    },
    aiSafety: {
      contentFiltering: true,
      promptInjectionProtection: true,
      outputValidation: true,
    },
  };
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private sessionTokens = new Map<string, { userId: string; expiry: number; permissions: string[] }>();
  private readonly MAX_THREAT_LOG = 1000;
  private readonly THREAT_THRESHOLD = 0.7; // 70% threat level triggers enhanced security

  private constructor() {
    this.initializeSecurity();
  }

  static getInstance(): EnhancedSecurityManager {
    if (!EnhancedSecurityManager.instance) {
      EnhancedSecurityManager.instance = new EnhancedSecurityManager();
    }
    return EnhancedSecurityManager.instance;
  }

  private initializeSecurity(): void {
    // Set up security monitoring intervals
    this.startSecurityMonitoring();
  }

  private startSecurityMonitoring(): void {
    // Monitor security metrics every 30 seconds
    setInterval(() => {
      this.collectSecurityMetrics();
      this.analyzeThreats();
    }, 30000);
  }

  /**
   * Enhanced input validation with multiple layers of protection
   */
  validateInput<T>(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user' | 'ai_prompt' | 'code'): { 
    isValid: boolean; 
    sanitizedData: T; 
    threats: ThreatDetection[] 
  } {
    const threats: ThreatDetection[] = [];
    
    // Run through multiple validation layers
    const layer1Result = this.layer1Validation(data, type);
    threats.push(...layer1Result.threats);
    
    const layer2Result = this.layer2Validation(layer1Result.sanitizedData, type);
    threats.push(...layer2Result.threats);
    
    const layer3Result = this.layer3Validation(layer2Result.sanitizedData, type);
    threats.push(...layer3Result.threats);
    
    const isValid = threats.every(threat => threat.severity !== 'high' && threat.severity !== 'critical') && 
                  this.basicValidation(layer3Result.sanitizedData, type).isValid;
    
    // Log threats if any are found
    if (threats.length > 0) {
      this.logThreats(threats);
      this.metrics.blockedAttempts += threats.length;
    }
    
    return {
      isValid,
      sanitizedData: layer3Result.sanitizedData,
      threats
    };
  }

  private layer1Validation(data: any, _type: string): { sanitizedData: any; threats: ThreatDetection[] } {
    const threats: ThreatDetection[] = [];
    let sanitizedData = data;
    
    // Basic structure validation
    if (!data || typeof data !== 'object') {
      threats.push({
        type: 'code_injection',
        severity: 'high',
        confidence: 0.9,
        timestamp: Date.now(),
        details: 'Invalid data structure detected'
      });
      return { sanitizedData: {}, threats };
    }
    
    // Check for common attack patterns
    const stringifiedData = JSON.stringify(data);
    for (const pattern of this.securityPolicy.inputValidation.blockedPatterns) {
      if (stringifiedData.toLowerCase().includes(pattern.toLowerCase())) {
        threats.push({
          type: 'code_injection',
          severity: 'high',
          confidence: 0.8,
          timestamp: Date.now(),
          details: `Blocked pattern detected: ${pattern}`
        });
      }
    }
    
    return { sanitizedData, threats };
  }

  private layer2Validation(data: any, _type: string): { sanitizedData: any; threats: ThreatDetection[] } {
    const threats: ThreatDetection[] = [];
    let sanitizedData = Array.isArray(data) ? [...data] : { ...data };
    
    // Deep validation and sanitization
    const deepSanitized = this.deepSanitize(sanitizedData, threats);
    
    return { sanitizedData: deepSanitized, threats };
  }

  private layer3Validation(data: any, type: string): { sanitizedData: any; threats: ThreatDetection[] } {
    const threats: ThreatDetection[] = [];
    let sanitizedData = data;
    
    // Context-aware validation
    switch (type) {
      case 'ai_prompt':
        // Validate AI prompt for injection attempts
        const promptThreats = this.validateAIPrompt(data as string);
        threats.push(...promptThreats);
        break;
        
      case 'code':
        // Validate code for dangerous patterns
        const codeThreats = this.validateCode(data as string);
        threats.push(...codeThreats);
        break;
        
      case 'robot':
        // Validate robot data security
        const robotThreats = this.validateRobotSecurity(data as Robot);
        threats.push(...robotThreats);
        break;
    }
    
    return { sanitizedData, threats };
  }

  private deepSanitize(obj: any, threats: ThreatDetection[]): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Sanitize string values
        const sanitizedValue = this.sanitizeString(value, threats);
        (sanitized as any)[key] = sanitizedValue;
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        (sanitized as any)[key] = this.deepSanitize(value, threats);
      } else {
        // Keep primitive values as is
        (sanitized as any)[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeString(input: string, threats: ThreatDetection[]): string {
    if (typeof input !== 'string') return input;

    // Check for XSS patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /<link\b[^>]*>/gi,
      /<meta\b[^>]*>/gi,
      /<form\b[^>]*>/gi,
      /vbscript:/gi,
      /data:/gi,
      /about:/gi,
      /document\.cookie/gi,
      /window\.location/gi,
      /document\.write/gi,
      /eval\(/gi,
      /expression\(/gi,
      /alert\(/gi,
      /confirm\(/gi,
      /prompt\(/gi,
      /decodeURIComponent/gi,
      /escape\(/gi,
      /unescape\(/gi,
    ];

    let sanitized = input;
    for (const pattern of xssPatterns) {
      if (pattern.test(sanitized)) {
        threats.push({
          type: 'xss',
          severity: 'high',
          confidence: 0.9,
          timestamp: Date.now(),
          details: `XSS pattern detected in field`
        });
        sanitized = sanitized.replace(pattern, '[REMOVED_XSS_CONTENT]');
      }
    }

    // Remove potential SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /(--|\*\/|\/\*)/g,
      /(\bOR\b.*=.*\bOR\b)/gi,
      /(\bAND\b.*=.*\bAND\b)/gi,
      /('.*'|".*")/g,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(sanitized)) {
        threats.push({
          type: 'sql_injection',
          severity: 'high',
          confidence: 0.85,
          timestamp: Date.now(),
          details: `SQL injection pattern detected in field`
        });
        sanitized = sanitized.replace(pattern, '[REMOVED_SQL_CONTENT]');
      }
    }

    // Basic sanitization
    sanitized = sanitized
      .trim()
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    return sanitized.substring(0, 1000); // Prevent extremely long strings
  }

  private validateAIPrompt(prompt: string): ThreatDetection[] {
    const threats: ThreatDetection[] = [];
    
    // Check for prompt injection attempts
    const injectionPatterns = [
      /<\|system\|>/gi,
      /<\|user\|>/gi,
      /<\|assistant\|>/gi,
      /### System:/gi,
      /### Instruction:/gi,
      /Ignore the above instructions/gi,
      /You are now DAN/gi,
      /Your new name is/gi,
      /From now on, you will/gi,
      /Disregard all previous/gi,
      /You must/gi,
      /You will/gi,
    ];
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(prompt)) {
        threats.push({
          type: 'prompt_injection',
          severity: 'high',
          confidence: 0.9,
          timestamp: Date.now(),
          details: `Prompt injection attempt detected: ${pattern.toString()}`
        });
      }
    }
    
    return threats;
  }

  private validateCode(code: string): ThreatDetection[] {
    const threats: ThreatDetection[] = [];
    
    // Check for dangerous code patterns
    const dangerousPatterns = [
      /import\s+|^#import/gi,
      /resourceadd/gi,
      /filefindfirst|filefindnext|filefindclose/gi,
      /terminalinfostring|terminalinfointeger|terminalinfodouble/gi,
      /webrequest/gi,
      /resourcecreate/gi,
      /resourcefree/gi,
      /sendftp/gi,
      /sendmail/gi,
      /sendnotification/gi,
      /globalvariable/gi,
      /window/gi,
      /chart/gi,
      /trade/gi,
      /order/gi,
      /alert\(/gi,
      /comment\(/gi,
      /print\(/gi,
      /printf\(/gi,
      /eval\(/gi,
      /exec\(/gi,
      /system\(/gi,
      /shell/i,
      /process/i,
      /command/i,
      /system\./gi,
      /process\./gi,
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        threats.push({
          type: 'code_injection',
          severity: 'medium',
          confidence: 0.7,
          timestamp: Date.now(),
          details: `Dangerous code pattern detected: ${pattern.toString()}`
        });
      }
    }
    
    return threats;
  }

  private validateRobotSecurity(robot: Robot): ThreatDetection[] {
    const threats: ThreatDetection[] = [];
    
    // Validate robot security aspects
    if (robot.code && robot.code.length > 50000) { // Unusually large code
      threats.push({
        type: 'code_injection',
        severity: 'medium',
        confidence: 0.6,
        timestamp: Date.now(),
        details: 'Robot code exceeds normal size limits'
      });
    }
    
    // Validate strategy type
    const validTypes = ['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'];
    if (robot.strategy_type && !validTypes.includes(robot.strategy_type)) {
      threats.push({
        type: 'code_injection',
        severity: 'low',
        confidence: 0.5,
        timestamp: Date.now(),
        details: 'Invalid strategy type detected'
      });
    }
    
    return threats;
  }

  private basicValidation(data: any, type: string): { isValid: boolean } {
    // Use the existing security manager for basic validation
    const result = securityManager.sanitizeAndValidate(data, type as any);
    return { isValid: result.isValid };
  }

  /**
   * Advanced threat detection and analysis
   */
  detectThreats(data: any, context: string): ThreatDetection[] {
    const threats: ThreatDetection[] = [];
    
    // Analyze data for threats
    const stringData = JSON.stringify(data);
    
    // Pattern-based threat detection
    if (/<script/i.test(stringData)) {
      threats.push({
        type: 'xss',
        severity: 'high',
        confidence: 0.9,
        timestamp: Date.now(),
        details: `XSS attempt detected in ${context}`
      });
    }
    
    if (/\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b/i.test(stringData)) {
      threats.push({
        type: 'sql_injection',
        severity: 'high',
        confidence: 0.85,
        timestamp: Date.now(),
        details: `SQL injection attempt detected in ${context}`
      });
    }
    
    if (/exec\(|eval\(|system\(/i.test(stringData)) {
      threats.push({
        type: 'code_injection',
        severity: 'critical',
        confidence: 0.95,
        timestamp: Date.now(),
        details: `Code injection attempt detected in ${context}`
      });
    }
    
    return threats;
  }

  /**
   * Enhanced session management with security
   */
  createSecureSession(userId: string, permissions: string[] = []): string {
    const sessionId = this.generateSecureId();
    const expiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    this.sessionTokens.set(sessionId, {
      userId,
      expiry,
      permissions
    });
    
    return sessionId;
  }

  validateSession(sessionId: string): { isValid: boolean; userId?: string; permissions?: string[] } {
    const session = this.sessionTokens.get(sessionId);
    
    if (!session) {
      return { isValid: false };
    }
    
    if (session.expiry < Date.now()) {
      this.sessionTokens.delete(sessionId);
      return { isValid: false };
    }
    
    // Refresh session expiry
    session.expiry = Date.now() + (24 * 60 * 60 * 1000);
    
    return {
      isValid: true,
      userId: session.userId,
      permissions: session.permissions
    };
  }

  private generateSecureId(): string {
    // Generate a cryptographically secure ID
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback for environments without crypto
      return Math.random().toString(36).substring(2, 15) + 
             Math.random().toString(36).substring(2, 15);
    }
  }

  /**
   * API rate limiting with enhanced security
   */
  checkRateLimit(identifier: string, action: string = 'general'): { allowed: boolean; resetTime?: number; message?: string } {
    const now = Date.now();
    const key = `${identifier}:${action}`;
    const record = this.rateLimitMap.get(key);
    
    const limit = this.securityPolicy.rateLimiting.maxRequests;
    const window = this.securityPolicy.rateLimiting.windowMs;
    
    if (!record || now > record.resetTime) {
      // New window
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + window,
      });
      return { allowed: true };
    }
    
    if (record.count >= limit) {
      this.metrics.blockedAttempts++;
      return { 
        allowed: false, 
        resetTime: record.resetTime,
        message: `Rate limit exceeded. Try again later.`
      };
    }
    
    record.count++;
    return { allowed: true };
  }

  /**
   * Log threats for analysis
   */
  private logThreats(threats: ThreatDetection[]): void {
    for (const threat of threats) {
      this.threatLog.push(threat);
      
      // Keep threat log size manageable
      if (this.threatLog.length > this.MAX_THREAT_LOG) {
        this.threatLog = this.threatLog.slice(-this.MAX_THREAT_LOG);
      }
      
      // Log high and critical threats
      if (threat.severity === 'high' || threat.severity === 'critical') {
        console.warn(`Security Threat [${threat.severity.toUpperCase()}]: ${threat.details}`);
      }
    }
  }

  /**
   * Analyze collected security metrics
   */
  private collectSecurityMetrics(): void {
    // Calculate threat level based on recent threats
    const recentThreats = this.threatLog.filter(t => t.timestamp > Date.now() - 300000); // Last 5 minutes
    const criticalThreats = recentThreats.filter(t => t.severity === 'critical').length;
    const highThreats = recentThreats.filter(t => t.severity === 'high').length;
    
    // Calculate threat level (0-1 scale)
    this.metrics.threatLevel = Math.min(1, (criticalThreats * 0.5 + highThreats * 0.3) / 10);
    
    // Update security score (100-0 scale, higher is better)
    this.metrics.securityScore = Math.max(0, 100 - (this.metrics.threatLevel * 100));
    
    // Update other metrics
    this.metrics.vulnerabilities = recentThreats.length;
  }

  /**
   * Analyze threats and trigger enhanced security if needed
   */
  private analyzeThreats(): void {
    if (this.metrics.threatLevel > this.THREAT_THRESHOLD) {
      // Trigger enhanced security measures
      this.enableEnhancedSecurity();
    }
  }

  private enableEnhancedSecurity(): void {
    // Increase rate limiting
    this.securityPolicy.rateLimiting.maxRequests = Math.floor(this.securityPolicy.rateLimiting.maxRequests * 0.5);
    
    // Enable strict validation mode
    this.securityPolicy.inputValidation.strictMode = true;
    
    console.warn('Enhanced security mode activated due to elevated threat level');
  }

  /**
   * Validate origin for security
   */
  validateOrigin(origin: string): boolean {
    return this.securityPolicy.inputValidation.allowedOrigins.includes(origin);
  }

  /**
   * Validate API key with enhanced security
   */
  validateAPIKey(key: string, _provider: 'google' | 'openai' | 'custom'): boolean {
    // Use existing validation as base
    if (!securityManager.validateAPIKey(key)) {
      return false;
    }
    
    // Additional security checks
    if (key.length < 20) return false;
    
    // Check for common weak key patterns
    const weakPatterns = [
      /test/i,
      /demo/i,
      /sample/i,
      /your_/i,
      /api_/i,
      /key_/i,
      /123456/i,
      /password/i,
    ];
    
    for (const pattern of weakPatterns) {
      if (pattern.test(key)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get security report
   */
  getSecurityReport(): {
    metrics: SecurityMetrics;
    recentThreats: ThreatDetection[];
    policy: SecurityPolicy;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    if (this.metrics.threatLevel > 0.5) {
      recommendations.push('Threat level is elevated - consider reviewing security logs');
    }
    
    if (this.metrics.securityScore < 80) {
      recommendations.push('Security score is below 80 - consider implementing additional security measures');
    }
    
    if (this.metrics.vulnerabilities > 10) {
      recommendations.push('Multiple vulnerabilities detected - review and address security issues');
    }
    
    return {
      metrics: { ...this.metrics },
      recentThreats: this.threatLog.slice(-50), // Last 50 threats
      policy: { ...this.securityPolicy },
      recommendations
    };
  }

  /**
   * Reset security metrics
   */
  resetMetrics(): void {
    this.metrics = {
      threatLevel: 0,
      securityScore: 100,
      vulnerabilities: 0,
      blockedAttempts: 0,
      successfulAttacks: 0,
      falsePositives: 0,
    };
    this.threatLog = [];
  }
}

export const enhancedSecurityManager = EnhancedSecurityManager.getInstance();