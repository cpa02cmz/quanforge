import DOMPurify from 'dompurify';
import { STRING_LIMITS } from '../constants';

/**
 * Core security utilities and helper functions
 * Provides basic sanitization, hash generation, and anti-pollution utilities
 */
export class SecurityUtils {
  /**
   * Sanitize input string by removing potentially dangerous content
   */
  sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .substring(0, STRING_LIMITS.MAX_LENGTH); // Prevent extremely long strings
  }

  /**
   * Sanitize trading symbol to allow only valid formats
   */
  sanitizeSymbol(symbol: string): string {
    const symbolRegex = /^[A-Z]{3,6}\/?[A-Z]{3,6}$/;
    const cleanSymbol = symbol.replace(/[^A-Z/]/g, '').toUpperCase();
    return symbolRegex.test(cleanSymbol) ? cleanSymbol : '';
  }

  /**
   * Generate hash string for rate limiting and caching
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
   * Generate secure random token
   */
  generateSecureToken(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Less secure fallback
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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

    // Check nested objects
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === 'object') {
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
    } catch (error: unknown) {
      console.error('JSON parsing error:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Sanitize HTML input using DOMPurify
   */
  sanitizeHTML(input: string): string {
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(input);
    }
    
    // Fallback sanitization if DOMPurify is not available
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Validate and sanitize URL
   */
  sanitizeURL(url: string): string {
    try {
      const parsed = new URL(url);
      // Only allow http and https protocols
      if (['http:', 'https:'].includes(parsed.protocol)) {
        return parsed.toString();
      }
    } catch {
      // Invalid URL
    }
    return '';
  }

  /**
   * Check if string contains potentially malicious content
   */
  containsSuspiciousContent(input: string): boolean {
    const suspiciousPatterns = [
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /<script/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(input));
  }
}

export default SecurityUtils;