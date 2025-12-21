import { Robot, StrategyParams, BacktestSettings } from '../types';
import DOMPurify from 'dompurify';

class SecurityManager {
  private static instance: SecurityManager;

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // Sanitize HTML to prevent XSS
  sanitizeHTML(dirty: string): string {
    return DOMPurify.sanitize(dirty);
  }

  // Safe JSON parsing
  safeJSONParse(data: string): any {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  // Validate strategy parameters
  validateStrategyParams(params: StrategyParams): boolean {
    if (!params || typeof params !== 'object') return false;
    
    // Basic validation
    if (params.stopLoss && (params.stopLoss < 0 || params.stopLoss > 100)) return false;
    if (params.takeProfit && (params.takeProfit < 0 || params.takeProfit > 1000)) return false;
    
    return true;
  }

  // Validate backtest settings
  validateBacktestSettings(settings: BacktestSettings): boolean {
    if (!settings || typeof settings !== 'object') return false;
    
    // Generic validation since BacktestSettings interface may vary
    if (Object.keys(settings).length === 0) return false;
    
    return true;
  }

  // Validate robot data
  validateRobot(robot: Robot): boolean {
    if (!robot || typeof robot !== 'object') return false;
    
    if (!robot.name || typeof robot.name !== 'string') return false;
    if (!robot.description || typeof robot.description !== 'string') return false;
    if (robot.name.length > 100 || robot.description.length > 1000) return false;
    
    return true;
  }

  // Sanitize user input
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  // Check for potential injection patterns
  detectInjection(input: string): boolean {
    const patterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
      /import\s+.*\s+from/gi
    ];
    
    return patterns.some(pattern => pattern.test(input));
  }

  // Sanitize and validate (for supabase.ts compatibility)
  sanitizeAndValidate(input: string): { allowed: boolean; sanitized: string } {
    const hasInjection = this.detectInjection(input);
    return {
      allowed: !hasInjection,
      sanitized: this.sanitizeInput(input)
    };
  }

  // Rate limiting (basic implementation)
  private lastRequest = new Map<string, number>();
  
  checkRateLimit(identifier: string, limitMs: number = 1000): boolean {
    const now = Date.now();
    const lastTime = this.lastRequest.get(identifier) || 0;
    
    if (now - lastTime < limitMs) {
      return false; // Rate limited
    }
    
    this.lastRequest.set(identifier, now);
    return true; // Allow request
  }

  // Validate file upload (if applicable)
  validateFileUpload(fileName: string, fileSize: number, maxSize: number = 5 * 1024 * 1024): boolean {
    const allowedExtensions = ['.mq5', '.mqh', '.txt', '.json'];
    const fileExtension = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) return false;
    if (fileSize > maxSize) return false;
    if (fileName.length > 255) return false;
    
    return true;
  }
}

export const securityManager = SecurityManager.getInstance();
export default securityManager;