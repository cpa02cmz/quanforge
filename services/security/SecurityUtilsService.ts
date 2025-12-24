/**
 * Security Utils Service
 * 
 * Provides foundational security utilities used across all security services.
 * This is the base service that other security services depend on.
 * 
 * @author QuantForge Security Team
 * @version 1.0.0
 */

export interface SecurityUtilsConfig {
  enableConsoleLogging: boolean;
  tokenLength: number;
  secureTokenGeneration: boolean;
}

/**
 * Security utilities service containing shared functionality
 */
export class SecurityUtilsService {
  private static instance: SecurityUtilsService;
  private config: SecurityUtilsConfig;

  private constructor() {
    this.config = {
      enableConsoleLogging: process.env['NODE_ENV'] === 'development',
      tokenLength: 32,
      secureTokenGeneration: true
    };
  }

  static getInstance(): SecurityUtilsService {
    if (!SecurityUtilsService.instance) {
      SecurityUtilsService.instance = new SecurityUtilsService();
    }
    return SecurityUtilsService.instance;
  }

  /**
   * Generate secure random token using crypto API
   */
  generateSecureToken(): string {
    // Use browser crypto API when available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback for compatibility
    const array = new Uint8Array(this.config.tokenLength);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Less secure fallback for older environments
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Simple hash function for rate limiting and caching
   * Browser-compatible alternative to Node.js crypto
   */
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

  /**
   * Check for prototype pollution attacks
   */
  isPrototypePollution(obj: any): boolean {
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

    // Check nested objects recursively
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
   * Safe JSON parsing with prototype pollution protection
   */
  safeJSONParse(jsonString: string): any {
    try {
      // First, parse the JSON
      const parsed = JSON.parse(jsonString);
      
      // Then check for prototype pollution
      if (this.isPrototypePollution(parsed)) {
        throw new Error('Prototype pollution detected in JSON');
      }
      
      return parsed;
    } catch (error) {
      if (this.config.enableConsoleLogging) {
        console.error('JSON parsing error:', error);
      }
      return null;
    }
  }

  /**
   * Check if IP address is private/internal
   */
  isPrivateIP(ip: string): boolean {
    const privatePatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];

    return privatePatterns.some(pattern => pattern.test(ip));
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize string by removing potentially dangerous characters
   */
  sanitizeString(input: string): string {
    if (!input) return '';
    
    return input
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[\uFFFE\uFFFF]/g, '') // Remove non-characters
      .trim();
  }

  /**
   * Check if string contains potentially dangerous patterns
   */
  containsMaliciousPatterns(input: string): boolean {
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /exec\s*\(/i,
      /expression\s*\(/i,
      /@import/i,
      /vbscript:/i
    ];

    return maliciousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityUtilsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SecurityUtilsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Log security event in development environment
   */
  logSecurityEvent(event: string, data?: any): void {
    if (this.config.enableConsoleLogging) {
      console.warn(`[SecurityEvent] ${event}`, data || '');
    }
  }
}

// Export singleton instance for convenience
export const securityUtils = SecurityUtilsService.getInstance();