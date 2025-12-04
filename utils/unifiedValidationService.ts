// Consolidated Validation Service - Unified validation for the entire application
import { StrategyParams, BacktestSettings } from '../types';
import DOMPurify from 'dompurify';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationRule {
  field: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedValues?: any[];
  sanitize?: boolean;
}

export class UnifiedValidationService {
  private static readonly TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];
  private static readonly SYMBOL_REGEX = /^[A-Z]{3,6}[\/]?[A-Z]{3,6}$/;
  private static readonly NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  private static readonly MAX_RISK_PERCENT = 100;
  private static readonly MIN_RISK_PERCENT = 0.01;
  private static readonly MAX_STOP_LOSS = 1000;
  private static readonly MIN_STOP_LOSS = 1;
  private static readonly MAX_TAKE_PROFIT = 1000;
  private static readonly MIN_TAKE_PROFIT = 1;
  private static readonly MAX_MAGIC_NUMBER = 999999;
  private static readonly MIN_MAGIC_NUMBER = 1;
  private static readonly MAX_INITIAL_DEPOSIT = 10000000;
  private static readonly MIN_INITIAL_DEPOSIT = 100;
  private static readonly MAX_DURATION = 365;
  private static readonly MIN_DURATION = 1;
  private static readonly MAX_LEVERAGE = 1000;
  private static readonly MIN_LEVERAGE = 1;

  // Rate limiting for chat validation
  private static rateLimiter = new Map<string, { count: number; resetTime: number }>();
  private static readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private static readonly RATE_LIMIT_MAX_REQUESTS = 30;

  // Core validation helpers
  static validateRequired(value: any, field: string): ValidationError | null {
    if (value === null || value === undefined || value === '') {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  static validateRange(value: number, field: string, min: number, max: number): ValidationError | null {
    if (typeof value !== 'number' || isNaN(value)) {
      return { field, message: `${field} must be a valid number` };
    }
    if (value < min || value > max) {
      return { field, message: `${field} must be between ${min} and ${max}` };
    }
    return null;
  }

  static validateRegex(value: string, field: string, regex: RegExp, message?: string): ValidationError | null {
    if (typeof value !== 'string') {
      return { field, message: `${field} must be a string` };
    }
    if (!regex.test(value)) {
      return { field, message: message || `${field} format is invalid` };
    }
    return null;
  }

  static validateInSet(value: any, field: string, allowedValues: any[]): ValidationError | null {
    if (!allowedValues.includes(value)) {
      return { field, message: `${field} must be one of: ${allowedValues.join(', ')}` };
    }
    return null;
  }

  static validateLength(value: string, field: string, minLength?: number, maxLength?: number): ValidationError | null {
    if (typeof value !== 'string') {
      return { field, message: `${field} must be a string` };
    }
    if (minLength !== undefined && value.length < minLength) {
      return { field, message: `${field} must be at least ${minLength} characters` };
    }
    if (maxLength !== undefined && value.length > maxLength) {
      return { field, message: `${field} must not exceed ${maxLength} characters` };
    }
    return null;
  }

  // Input sanitization
  static sanitizeInput(input: string, options: {
    allowedTags?: string[];
    allowedAttributes?: string[];
    maxLength?: number;
  } = {}): string {
    const {
      allowedTags = [],
      allowedAttributes = [],
      maxLength = 10000
    } = options;

    let sanitized = DOMPurify.sanitize(input, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: allowedAttributes,
      KEEP_CONTENT: true
    });

    // Enforce length limits
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized.trim();
  }

  // Strategy validation
  static validateStrategyParams(params: StrategyParams): ValidationResult {
    const errors: ValidationError[] = [];

    // Timeframe validation
    const timeframeError = this.validateInSet(
      params.timeframe, 
      'timeframe', 
      this.TIMEFRAMES
    );
    if (timeframeError) errors.push(timeframeError);

    // Symbol validation
    const symbolError = this.validateRegex(
      params.symbol, 
      'symbol', 
      this.SYMBOL_REGEX, 
      'Symbol must be in format like EURUSD or GBP/USD'
    );
    if (symbolError) errors.push(symbolError);

    // Risk percent validation
    const riskError = this.validateRange(
      params.riskPercent, 
      'riskPercent', 
      this.MIN_RISK_PERCENT, 
      this.MAX_RISK_PERCENT
    );
    if (riskError) errors.push(riskError);

    // Stop loss validation
    const stopLossError = this.validateRange(
      params.stopLoss, 
      'stopLoss', 
      this.MIN_STOP_LOSS, 
      this.MAX_STOP_LOSS
    );
    if (stopLossError) errors.push(stopLossError);

    // Take profit validation
    const takeProfitError = this.validateRange(
      params.takeProfit, 
      'takeProfit', 
      this.MIN_TAKE_PROFIT, 
      this.MAX_TAKE_PROFIT
    );
    if (takeProfitError) errors.push(takeProfitError);

    // Magic number validation
    const magicNumberError = this.validateRange(
      params.magicNumber, 
      'magicNumber', 
      this.MIN_MAGIC_NUMBER, 
      this.MAX_MAGIC_NUMBER
    );
    if (magicNumberError) errors.push(magicNumberError);

    // Custom inputs validation
    params.customInputs?.forEach((input, index) => {
      const prefix = `customInputs[${index}]`;
      
      const nameError = this.validateRequired(input.name, `${prefix}.name`);
      if (nameError) errors.push(nameError);

      const nameFormatError = this.validateRegex(
        input.name, 
        `${prefix}.name`, 
        this.NAME_REGEX, 
        'Name must start with letter or underscore and contain only letters, numbers, and underscores'
      );
      if (nameFormatError) errors.push(nameFormatError);

      const typeError = this.validateInSet(
        input.type, 
        `${prefix}.type`, 
        ['int', 'double', 'string', 'bool']
      );
      if (typeError) errors.push(typeError);
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Backtest settings validation
  static validateBacktestSettings(settings: BacktestSettings): ValidationResult {
    const errors: ValidationError[] = [];

    const depositError = this.validateRange(
      settings.initialDeposit, 
      'initialDeposit', 
      this.MIN_INITIAL_DEPOSIT, 
      this.MAX_INITIAL_DEPOSIT
    );
    if (depositError) errors.push(depositError);

    const durationError = this.validateRange(
      settings.days, 
      'days', 
      this.MIN_DURATION, 
      this.MAX_DURATION
    );
    if (durationError) errors.push(durationError);

    const leverageError = this.validateRange(
      settings.leverage, 
      'leverage', 
      this.MIN_LEVERAGE, 
      this.MAX_LEVERAGE
    );
    if (leverageError) errors.push(leverageError);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Chat message validation with rate limiting
  static validateChatMessage(message: string, userId?: string): ValidationResult {
    const errors: ValidationError[] = [];

    // Rate limiting check
    if (userId) {
      const now = Date.now();
      const userLimit = this.rateLimiter.get(userId);
      
      if (!userLimit || now > userLimit.resetTime) {
        this.rateLimiter.set(userId, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW });
      } else {
        userLimit.count++;
        if (userLimit.count > this.RATE_LIMIT_MAX_REQUESTS) {
          errors.push({
            field: 'rateLimit',
            message: `Rate limit exceeded. Maximum ${this.RATE_LIMIT_MAX_REQUESTS} messages per minute.`
          });
        }
      }
    }

    // Content validation
    const contentError = this.validateLength(message, 'message', 1, 5000);
    if (contentError) errors.push(contentError);

    // Sanitize message
    const sanitized = this.sanitizeInput(message);
    if (sanitized !== message) {
      // This indicates potentially harmful content was removed
      console.warn('Message content was sanitized during validation');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // API key validation
  static validateApiKey(apiKey: string, provider: string = 'google'): ValidationResult {
    const errors: ValidationError[] = [];

    const requiredError = this.validateRequired(apiKey, 'apiKey');
    if (requiredError) {
      errors.push(requiredError);
      return { isValid: false, errors };
    }

    // Provider-specific validation
    switch (provider) {
      case 'google':
        const googleLengthError = this.validateLength(apiKey, 'apiKey', 30, 50);
        if (googleLengthError) errors.push(googleLengthError);
        break;
      case 'openai':
        const openaiLengthError = this.validateLength(apiKey, 'apiKey', 40, 60);
        if (openaiLengthError) errors.push(openaiLengthError);
        break;
      default:
        const defaultLengthError = this.validateLength(apiKey, 'apiKey', 10, 100);
        if (defaultLengthError) errors.push(defaultLengthError);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Generic validation using rules
  static validateWithRules(data: Record<string, any>, rules: ValidationRule[]): ValidationResult {
    const errors: ValidationError[] = [];

    rules.forEach(rule => {
      const value = data[rule.field];

      // Required validation
      if (rule.required && (value === null || value === undefined || value === '')) {
        errors.push({ field: rule.field, message: `${rule.field} is required` });
        return;
      }

      // Skip other validations if field is not required and empty
      if (!rule.required && (value === null || value === undefined || value === '')) {
        return;
      }

      // Length validation for strings
      if (typeof value === 'string') {
        const lengthError = this.validateLength(value, rule.field, rule.minLength, rule.maxLength);
        if (lengthError) errors.push(lengthError);
      }

      // Range validation for numbers
      if (typeof value === 'number') {
        const rangeError = this.validateRange(value, rule.field, rule.min || -Infinity, rule.max || Infinity);
        if (rangeError) errors.push(rangeError);
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string') {
        const patternError = this.validateRegex(value, rule.field, rule.pattern);
        if (patternError) errors.push(patternError);
      }

      // Set validation
      if (rule.allowedValues) {
        const setError = this.validateInSet(value, rule.field, rule.allowedValues);
        if (setError) errors.push(setError);
      }

      // Sanitization
      if (rule.sanitize && typeof value === 'string') {
        data[rule.field] = this.sanitizeInput(value);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Utility methods
  static isValid(result: ValidationResult): boolean {
    return result.isValid;
  }

  static formatErrors(errors: ValidationError[]): string {
    return errors.map(error => `${error.field}: ${error.message}`).join(', ');
  }

  static clearRateLimit(userId: string): void {
    this.rateLimiter.delete(userId);
  }

  static getRateLimitStatus(userId: string): { count: number; resetTime: number; remaining: number } | null {
    const limit = this.rateLimiter.get(userId);
    if (!limit) return null;

    const now = Date.now();
    if (now > limit.resetTime) {
      this.rateLimiter.delete(userId);
      return null;
    }

    return {
      count: limit.count,
      resetTime: limit.resetTime,
      remaining: Math.max(0, this.RATE_LIMIT_MAX_REQUESTS - limit.count)
    };
  }
}

// Export singleton instance for convenience
export const validator = UnifiedValidationService;

// Backward compatibility exports
export const ValidationService = UnifiedValidationService;