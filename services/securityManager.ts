/**
 * Consolidated Security Manager - Main Interface
 * 
 * This file now acts as the main interface that delegates to the modular security system
 * for backward compatibility while maintaining the improved architecture.
 */

// Simplified imports to avoid circular dependencies
import { SecurityManager as ModularSecurityManager } from './security/SecurityManager';

// Define local interfaces to avoid import issues
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

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
}

/**
 * Legacy SecurityManager wrapper for backward compatibility
 * Delegates to the new modular security system
 */
class SecurityManager {
  private static instance: SecurityManager;
  private modularSecurityManager: ModularSecurityManager;
  private config: SecurityConfig;

  private constructor() {
    // Get configuration dynamically to avoid circular dependencies
    const { securityConfig } = require('./configurationService');
    this.config = securityConfig();
    this.modularSecurityManager = ModularSecurityManager.getInstance();
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // Delegate to modular security manager
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    return this.modularSecurityManager.sanitizeAndValidate(data, type);
  }

  validateInput(input: string, type: 'search' | 'record' | 'user'): boolean {
    return this.modularSecurityManager.validateInput(input, type);
  }

  sanitizeInput(input: string): string {
    return this.modularSecurityManager.sanitizeInput(input);
  }

  safeJSONParse(data: string): any {
    return this.modularSecurityManager.safeJSONParse(data);
  }

  generateCSRFToken(sessionId: string = 'default'): string {
    return this.modularSecurityManager.generateCSRFToken(sessionId);
  }

  validateCSRFToken(sessionId: string, token: string): boolean {
    return this.modularSecurityManager.validateCSRFToken(sessionId, token);
  }

  hashString(input: string): string {
    return this.modularSecurityManager.hashString(input);
  }

  generateNonce(): string {
    // Simple nonce generation
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  encrypt(data: string): string {
    // Simple encryption - in production would use proper crypto
    return btoa(data);
  }

  decrypt(encryptedData: string): string {
    // Simple decryption - in production would use proper crypto
    return atob(encryptedData);
  }

  checkRateLimit(identifier: string, endpoint: string = 'default'): boolean {
    const result = this.modularSecurityManager.checkRateLimit(identifier);
    return result.allowed;
  }

  getSecurityMetrics(): any {
    return this.modularSecurityManager.getSecurityMetrics();
  }

  // Additional legacy methods that can be mapped to modular components
  preventXSS(data: any): { hasXSS: boolean; sanitizedData: any } {
    // Use DOMPurify through the modular system
    const sanitized = this.modularSecurityManager.sanitizeInput(JSON.stringify(data));
    return { 
      hasXSS: sanitized !== JSON.stringify(data), 
      sanitizedData: JSON.parse(sanitized) 
    };
  }

  preventSQLInjection(data: any): { hasSQLInjection: boolean; sanitizedData: any } {
    const validation = this.modularSecurityManager.sanitizeAndValidate(data, 'user');
    return { 
      hasSQLInjection: validation.riskScore > 30, 
      sanitizedData: validation.sanitizedData || data 
    };
  }

  isPrototypePollution(obj: any): boolean {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    
    for (const key of dangerousKeys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return true;
      }
    }
    
    return false;
  }
}

// Export singleton instance for backward compatibility
export const securityManager = SecurityManager.getInstance();
export { SecurityManager };
export type { SecurityConfig, ValidationResult };