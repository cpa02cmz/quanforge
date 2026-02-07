/**
 * Consolidated Validation Service
 * Merges all validation functionality into 2 core modules
 * This replaces the 6 separate validation modules
 */

import DOMPurify from 'dompurify';
import { ValidationError } from './validationTypes';

// ========== VALIDATION INTERFACES ==========

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  field?: string;
}

export interface StrategyValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedParams?: any;
}

export interface RateLimiterEntry {
  count: number;
  resetTime: number;
}

// ========== VALIDATION CONSTANTS ==========

export const VALIDATION_CONSTANTS = {
  // Timeframe options
  TIMEFRAMES: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'],
  
  // Regex patterns
  SYMBOL_REGEX: /^[A-Z]{3,6}\/?[A-Z]{3,6}$/,
  NAME_REGEX: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL_REGEX: /^https?:\/\/.+/,
  
  // Numeric ranges
  MAX_RISK_PERCENT: 100,
  MIN_RISK_PERCENT: 0.01,
  MAX_STOP_LOSS: 1000,
  MIN_STOP_LOSS: 1,
  MAX_TAKE_PROFIT: 1000,
  MIN_TAKE_PROFIT: 1,
  MAX_MAGIC_NUMBER: 999999,
  MIN_MAGIC_NUMBER: 1,
  MAX_INITIAL_DEPOSIT: 10000000,
  MIN_INITIAL_DEPOSIT: 100,
  MAX_DURATION: 365,
  MIN_DURATION: 1,
  MAX_LEVERAGE: 1000,
  MIN_LEVERAGE: 1,
  
  // Rate limiting
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 10,
  
  // Security patterns
  XSS_PATTERNS: [
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /&#x?0*(58|106|0*74|0*42|0*6a);?/gi,
  ],
  
  MQL5_DANGEROUS_PATTERNS: [
    /FileFind\s*\(|FileOpen\s*\(|FileClose\s*\(/i,
    /WebRequest\s*\(|SocketCreate\s*\(|SocketConnect\s*\(/i,
    /ShellExecute\s*\(|WinExec\s*\(|CreateProcess\s*\(/i,
    /SendNotification\s*\(|SendMail\s*\(|SendFTP\s*\(/i,
    /OrderSend\s*\(|OrderClose\s*\(|OrderModify\s*\(/i,
  ],
};

// ========== CORE VALIDATION UTILITIES ==========

export class ValidationCore {
  private static rateLimiter = new Map<string, RateLimiterEntry>();

  // Basic validation functions
  static validateRequired(value: string, field: string): ValidationError | null {
    if (!value || value.trim().length === 0) {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  static validateRange(value: number, field: string, min: number, max: number): ValidationError | null {
    if (value < min || value > max) {
      return { field, message: `${field} must be between ${min} and ${max}` };
    }
    return null;
  }

  static validateRegex(value: string, field: string, regex: RegExp, message: string): ValidationError | null {
    if (!regex.test(value)) {
      return { field, message };
    }
    return null;
  }

  static validateInSet(value: string, field: string, validValues: Set<string> | string[], message?: string): ValidationError | null {
    const isValid = Array.isArray(validValues) ? validValues.includes(value) : validValues.has(value);
    if (!isValid) {
      return {
        field,
        message: message || `${field} must be one of: ${Array.isArray(validValues) ? validValues.join(', ') : Array.from(validValues).join(', ')}`
      };
    }
    return null;
  }

  // Error collection utilities
  static collectErrors(results: (ValidationError | null)[]): ValidationError[] {
    return results.filter((error): error is ValidationError => error !== null);
  }

  static isValid(results: (ValidationError | null)[]): boolean {
    return this.collectErrors(results).length === 0;
  }

  static formatErrors(errors: ValidationError[]): string {
    return errors.map(error => `${error.field}: ${error.message}`).join(', ');
  }

  // Security validation
  static sanitizeInput(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  static validateXSS(input: string): ValidationError | null {
    for (const pattern of VALIDATION_CONSTANTS.XSS_PATTERNS) {
      if (pattern.test(input)) {
        return { field: 'input', message: 'Input contains potentially dangerous content' };
      }
    }
    return null;
  }

  static validateMQL5Security(code: string): ValidationError | null {
    for (const pattern of VALIDATION_CONSTANTS.MQL5_DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        return { field: 'code', message: 'Code contains potentially dangerous MQL5 functions' };
      }
    }
    return null;
  }

  // Rate limiting
  static checkRateLimit(identifier: string): ValidationError | null {
    const now = Date.now();
    const entry = this.rateLimiter.get(identifier);

    if (!entry) {
      this.rateLimiter.set(identifier, {
        count: 1,
        resetTime: now + VALIDATION_CONSTANTS.RATE_LIMIT_WINDOW
      });
      return null;
    }

    // Reset if window expired
    if (now > entry.resetTime) {
      this.rateLimiter.set(identifier, {
        count: 1,
        resetTime: now + VALIDATION_CONSTANTS.RATE_LIMIT_WINDOW
      });
      return null;
    }

    // Check limit
    if (entry.count >= VALIDATION_CONSTANTS.RATE_LIMIT_MAX_REQUESTS) {
      return {
        field: 'rate_limit',
        message: `Rate limit exceeded. Please wait ${Math.ceil((entry.resetTime - now) / 1000)} seconds.`
      };
    }

    // Increment count
    this.rateLimiter.set(identifier, {
      count: entry.count + 1,
      resetTime: entry.resetTime
    });

    return null;
  }
}

// ========== SPECIALIZED VALIDATORS ==========

export class StrategyValidator {
  static validateStrategyParams(params: any): StrategyValidationResult {
    const errors: ValidationError[] = [];
    const sanitizedParams = { ...params };

    // Required field validation
    if (!params.timeframe) {
      errors.push({ field: 'timeframe', message: 'Timeframe is required' });
    } else if (!VALIDATION_CONSTANTS.TIMEFRAMES.includes(params.timeframe)) {
      errors.push({ 
        field: 'timeframe', 
        message: `Invalid timeframe. Must be one of: ${VALIDATION_CONSTANTS.TIMEFRAMES.join(', ')}` 
      });
    }

    // Risk percentage validation
    if (params.riskPercent !== undefined) {
      const riskError = ValidationCore.validateRange(
        params.riskPercent,
        'riskPercent',
        VALIDATION_CONSTANTS.MIN_RISK_PERCENT,
        VALIDATION_CONSTANTS.MAX_RISK_PERCENT
      );
      if (riskError) errors.push(riskError);
      sanitizedParams.riskPercent = Math.max(VALIDATION_CONSTANTS.MIN_RISK_PERCENT, Math.min(VALIDATION_CONSTANTS.MAX_RISK_PERCENT, params.riskPercent));
    }

    // Stop loss validation
    if (params.stopLossPips !== undefined) {
      const slError = ValidationCore.validateRange(
        params.stopLossPips,
        'stopLossPips',
        VALIDATION_CONSTANTS.MIN_STOP_LOSS,
        VALIDATION_CONSTANTS.MAX_STOP_LOSS
      );
      if (slError) errors.push(slError);
    }

    // Take profit validation
    if (params.takeProfitPips !== undefined) {
      const tpError = ValidationCore.validateRange(
        params.takeProfitPips,
        'takeProfitPips',
        VALIDATION_CONSTANTS.MIN_TAKE_PROFIT,
        VALIDATION_CONSTANTS.MAX_TAKE_PROFIT
      );
      if (tpError) errors.push(tpError);
    }

    // Symbol validation
    if (params.symbol) {
      const symbolError = ValidationCore.validateRegex(
        params.symbol,
        'symbol',
        VALIDATION_CONSTANTS.SYMBOL_REGEX,
        'Invalid symbol format (e.g., EUR/USD, GBPJPY)'
      );
      if (symbolError) errors.push(symbolError);
    }

    // Custom inputs validation
    if (params.customInputs && Array.isArray(params.customInputs)) {
      params.customInputs.forEach((input: any, index: number) => {
        if (!input.name) {
          errors.push({ field: `customInputs.${index}.name`, message: 'Custom input name is required' });
        } else if (!VALIDATION_CONSTANTS.NAME_REGEX.test(input.name)) {
          errors.push({ 
            field: `customInputs.${index}.name`, 
            message: 'Invalid custom input name (must start with letter or underscore, contain only letters, numbers, underscores)' 
          });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedParams
    };
  }
}

export class InputValidator {
  static validateChatMessage(message: string, userId?: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Rate limiting
    if (userId) {
      const rateLimitError = ValidationCore.checkRateLimit(userId);
      if (rateLimitError) errors.push(rateLimitError);
    }

    // Required check
    if (!message || message.trim().length === 0) {
      errors.push({ field: 'message', message: 'Message cannot be empty' });
      return { isValid: false, errors, warnings };
    }

    // Length validation
    if (message.length > 10000) {
      errors.push({ field: 'message', message: 'Message too long (max 10000 characters)' });
    }

    // XSS validation
    const xssError = ValidationCore.validateXSS(message);
    if (xssError) errors.push(xssError);

    // MQL5 security validation for code snippets
    if (message.includes('```mql5') || message.includes('```mq5')) {
      const mql5Error = ValidationCore.validateMQL5Security(message);
      if (mql5Error) {
        warnings.push('Message contains potentially dangerous MQL5 code');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateApiKey(apiKey: string, provider: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Required check
    if (!apiKey || apiKey.trim().length === 0) {
      errors.push({ field: 'apiKey', message: 'API key is required' });
      return { isValid: false, errors, warnings };
    }

    // Basic format validation
    if (apiKey.length < 10) {
      errors.push({ field: 'apiKey', message: 'API key appears to be too short' });
    }

    if (apiKey.length > 500) {
      errors.push({ field: 'apiKey', message: 'API key is too long' });
    }

    // Provider-specific validation
    switch (provider.toLowerCase()) {
      case 'openai':
        if (!apiKey.startsWith('sk-')) {
          errors.push({ field: 'apiKey', message: 'OpenAI API key must start with "sk-"' });
        }
        break;
      case 'anthropic':
        if (!apiKey.startsWith('sk-ant-')) {
          warnings.push('Anthropic API key should typically start with "sk-ant-"');
        }
        break;
      default:
        warnings.push(`Unknown provider: ${provider}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateSymbol(symbol: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Required check
    if (!symbol || symbol.trim().length === 0) {
      errors.push({ field: 'symbol', message: 'Symbol is required' });
      return { isValid: false, errors, warnings };
    }

    // Format validation
    const symbolError = ValidationCore.validateRegex(
      symbol.toUpperCase(),
      'symbol',
      VALIDATION_CONSTANTS.SYMBOL_REGEX,
      'Invalid symbol format (e.g., EUR/USD, GBPJPY)'
    );
    if (symbolError) errors.push(symbolError);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// ========== MAIN VALIDATION SERVICE ==========

export class UnifiedValidationService {
  // Core validation utilities
  static validateRequired = ValidationCore.validateRequired;
  static validateRange = ValidationCore.validateRange;
  static validateRegex = ValidationCore.validateRegex;
  static validateInSet = ValidationCore.validateInSet;
  static collectErrors = ValidationCore.collectErrors;
  static isValid = ValidationCore.isValid;
  static formatErrors = ValidationCore.formatErrors;

  // Security utilities
  static sanitizeInput = ValidationCore.sanitizeInput;
  static checkRateLimit = ValidationCore.checkRateLimit;

  // Specialized validators
  static validateStrategyParams = StrategyValidator.validateStrategyParams;
  static validateChatMessage = InputValidator.validateChatMessage;
  static validateApiKey = InputValidator.validateApiKey;
  static validateSymbol = InputValidator.validateSymbol;
  
  // Legacy compatibility
  static validateRobot = (data: any): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Robot name is required and must be a non-empty string' });
    }

    if (data.code && data.code.length > 1000000) {
      warnings.push('Robot code is very large and may affect performance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  };
}

// Export types already exported above

// Export singletons
export const validationService = UnifiedValidationService;
export const validator = ValidationCore;