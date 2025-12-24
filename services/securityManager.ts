/**
 * Unified SecurityManager - Backward Compatibility Layer
 * 
 * This file provides the same interface as the original securityManager.ts
 * but uses the new modular architecture underneath.
 * 
 * This ensures zero breaking changes for existing code while
 * benefiting from the improved modular design.
 */

import { securityManager as modularSecurityManager, SecurityManager } from './security/SecurityManager';
import { ValidationResult } from './security/InputValidator';

// Legacy interface for backward compatibility
interface LegacyValidationResult {
  allowed: boolean;
  sanitized: string;
}

// Create backward-compatibility wrapper
const securityManager = {
  // Use modular system
  ...modularSecurityManager,
  
  // Legacy sanitizeAndValidate method for string input
  sanitizeAndValidate(input: string): LegacyValidationResult {
    try {
      // For string input, detect injection patterns and sanitize
      const patterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /eval\s*\(/gi,
        /expression\s*\(/gi,
        /import\s+.*\s+from/gi
      ];
      
      const hasInjection = patterns.some(pattern => pattern.test(input));
      const sanitized = input
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/javascript:/gi, '') // Remove javascript protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
      
      return {
        allowed: !hasInjection,
        sanitized
      };
    } catch {
      return {
        allowed: false,
        sanitized: ''
      };
    }
  },
  
  // Legacy sanitizeInput method
  sanitizeInput(input: string, type?: string): string {
    return modularSecurityManager.sanitizeInput(input, type as any);
  },
  
  // Legacy methods that might be missing
  sanitizeHTML: (dirty: string) => {
    // Basic HTML sanitization
    return dirty.replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<[^>]*>/g, '');
  },
  
  detectInjection: (input: string): boolean => {
    const patterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
      /import\s+.*\s+from/gi
    ];
    
    return patterns.some(pattern => pattern.test(input));
  },
  
  // Keep the modular methods available
  sanitizeAndValidateData: modularSecurityManager.sanitizeAndValidate,
  checkRateLimit: modularSecurityManager.checkRateLimit,
  validateOrigin: modularSecurityManager.validateOrigin,
  hashString: modularSecurityManager.hashString,
  safeJSONParse: modularSecurityManager.safeJSONParse,
  validateInput: modularSecurityManager.validateInput
};

export { securityManager, SecurityManager };

// Re-export commonly used types for backward compatibility
export type { ValidationResult };

// Default export for backward compatibility
export default securityManager;