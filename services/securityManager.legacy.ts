/**
 * @deprecated Use the new modular SecurityManager from './security/index' instead
 * This file provides backward compatibility for existing code
 */

import { Robot, StrategyParams, BacktestSettings } from '../types';
import { SecurityManager as NewSecurityManager, DEFAULT_SECURITY_CONFIG } from './security';

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

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

/**
 * Legacy SecurityManager - Wraps the new modular system for backward compatibility
 */
export class SecurityManager {
  private delegate: NewSecurityManager;

  private constructor() {
    this.delegate = NewSecurityManager.getInstance();
  }

  static getInstance(): SecurityManager {
    // Create singleton instance that wraps the new system
    if (!(globalThis as any)._legacySecurityManagerInstance) {
      (globalThis as any)._legacySecurityManagerInstance = new SecurityManager();
    }
    return (globalThis as any)._legacySecurityManagerInstance;
  }

  // Delegate all methods to the new implementation
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    return this.delegate.sanitizeAndValidate(data, type);
  }

  isRateLimited(identifier: string) {
    return this.delegate.isRateLimited(identifier);
  }

  resetRateLimit(identifier: string): void {
    this.delegate.resetRateLimit(identifier);
  }

  checkEdgeRateLimit(clientId: string) {
    return this.delegate.checkEdgeRateLimit(clientId);
  }

  analyzeRequest(requestData: {
    userAgent?: string;
    ip?: string;
    headers?: Record<string, string>;
    requestPath?: string;
    requestMethod?: string;
  }) {
    return this.delegate.analyzeRequest(requestData);
  }

  isSuspiciousIP(ip: string): boolean {
    return this.delegate.isSuspiciousIP(ip);
  }

  shouldBlockRequest(requestData: {
    ip?: string;
    countryCode?: string;
    forwardedFor?: string;
  }): boolean {
    return this.delegate.shouldBlockRequest(requestData);
  }

  analyzeIP(ip: string) {
    return this.delegate.analyzeIP(ip);
  }

  // For compatibility, expose the old config structure
  get config(): SecurityConfig {
    return this.delegate.getConfig() as SecurityConfig;
  }

  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.delegate.updateConfig(newConfig as any);
  }
}

// Export the default instance for backward compatibility
export default SecurityManager.getInstance();