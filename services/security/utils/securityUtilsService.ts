import DOMPurify from 'dompurify';

export type SanitizeType = 'text' | 'code' | 'symbol' | 'url' | 'token' | 'search' | 'email' | 'html';

export class SecurityUtilsService {
  private static instance: SecurityUtilsService;

  private constructor() {}

  static getInstance(): SecurityUtilsService {
    if (!SecurityUtilsService.instance) {
      SecurityUtilsService.instance = new SecurityUtilsService();
    }
    return SecurityUtilsService.instance;
  }

  sanitizeInput(input: string, type: SanitizeType = 'text'): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    switch (type) {
      case 'text':
        return this.sanitizeText(input);
      
      case 'code':
        return this.sanitizeCode(input);
      
      case 'symbol':
        return this.sanitizeSymbol(input);
      
      case 'url':
        return this.sanitizeURL(input);
      
      case 'token':
        return this.sanitizeToken(input);
      
      case 'search':
        return this.sanitizeSearch(input);
      
      case 'email':
        return this.sanitizeEmail(input);
      
      case 'html':
        return this.sanitizeHTML(input);
      
      default:
        return this.sanitizeText(input);
    }
  }

  validateSymbol(symbol: string): boolean {
    if (!symbol || typeof symbol !== 'string') {
      return false;
    }

    const sanitized = this.sanitizeInput(symbol, 'symbol');
    const symbolRegex = /^[A-Z]{6}$/; // Standard forex format (e.g., EURUSD)
    
    return symbolRegex.test(sanitized);
  }

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

  safeJSONParse(jsonString: string): any {
    if (!jsonString || typeof jsonString !== 'string') {
      return null;
    }

    try {
      // Basic security check
      const trimmed = jsonString.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return null;
      }

      const parsed = JSON.parse(trimmed);
      
      // Validate structure to prevent prototype pollution
      if (this.hasPrototypePollution(parsed)) {
        console.warn('Security: Prototype pollution attempt detected in JSON');
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn('Security: Invalid JSON detected:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  validateInput(input: any, type: SanitizeType = 'text'): boolean {
    if (input === null || input === undefined) {
      return false;
    }

    if (typeof input === 'string') {
      const sanitized = this.sanitizeInput(input, type);
      
      // Additional validation based on type
      switch (type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(sanitized);
        
        case 'url':
          try {
            new URL(sanitized);
            return true;
          } catch {
            return false;
          }
        
        case 'symbol':
          return this.validateSymbol(sanitized);
        
        case 'token':
          // Token should be alphanumeric and reasonable length
          return /^[a-zA-Z0-9]{8,64}$/.test(sanitized);
        
        default:
          return sanitized.length > 0 && sanitized.length <= 1000;
      }
    }

    // For non-string inputs, basic validation
    return typeof input !== 'object' || input !== null;
  }

  escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

generateSecureRandom(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    // Simple fallback to Math.random to avoid TypeScript issues
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    
    return result;
  }

  // Private helper methods
  private sanitizeText(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
  }

  private sanitizeCode(input: string): string {
    // Preserve MQL5 syntax but remove dangerous content
    return input
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/<!--.*?-->/gs, '') // Remove HTML comments
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/data:[^;]*/gi, ''); // Remove data URLs
  }

  private sanitizeSymbol(input: string): string {
    // For trading symbols, allow only letters and convert to uppercase
    return input
      .replace(/[^a-zA-Z]/g, '') // Remove non-letters
      .toUpperCase()
      .substring(0, 6); // Limit to 6 characters
  }

  private sanitizeURL(input: string): string {
    try {
      const url = new URL(input);
      // Validate and clean URL components
      return url.toString();
    } catch {
      // If invalid URL, return empty string
      return '';
    }
  }

  private sanitizeToken(input: string): string {
    // Allow only alphanumeric characters for tokens
    return input.replace(/[^a-zA-Z0-9]/g, '');
  }

  private sanitizeSearch(input: string): string {
    // Allow common search characters but remove dangerous ones
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .substring(0, 200); // Limit length
  }

  private sanitizeEmail(input: string): string {
    // Basic email sanitization
    return input
      .toLowerCase()
      .replace(/[^a-z0-9@._-]/g, '')
      .substring(0, 254); // RFC 5321 limit
  }

  private sanitizeHTML(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      KEEP_CONTENT: true
    });
  }

  private hasPrototypePollution(obj: any): boolean {
    if (obj && typeof obj === 'object') {
      const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
      return dangerousKeys.some(key => key in obj) ||
             (Array.isArray(obj) && obj.some(item => this.hasPrototypePollution(item)));
    }
    return false;
  }
}