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
  warnings?: string[];
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
  // Use Sets for O(1) lookup performance
  private static readonly TIMEFRAMES = new Set(['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1']);
  private static readonly SYMBOL_REGEX = /^(?:[A-Z]{6}|[A-Z]{3}\/[A-Z]{3}|[A-Z]{3,6}[A-Z]{3}|[A-Z]{2,5}[-_][A-Z]{2,5}|[A-Z]{3,6}USDT|[A-Z]{3,6}BUSD)$/;
  private static readonly NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  private static readonly API_KEY_PATTERNS = [
    /^[A-Za-z0-9_-]{20,}$/,
    /^[A-Za-z0-9]{32}$/,
    /^[A-Za-z0-9_-]{40}$/
  ];
  
  // Consolidated bounds for better maintainability
  private static readonly BOUNDS = {
    riskPercent: { min: 0.01, max: 100 },
    stopLoss: { min: 1, max: 1000 },
    takeProfit: { min: 1, max: 1000 },
    magicNumber: { min: 1, max: 999999 },
    initialDeposit: { min: 100, max: 10000000 },
    duration: { min: 1, max: 365 },
    leverage: { min: 1, max: 1000 },
    messageLength: { max: 10000 },
    nameLength: { min: 3, max: 100 }
  } as const;

  // Rate limiting for chat validation
  private static rateLimiter = new Map<string, { count: number; resetTime: number }>();
  private static readonly RATE_LIMIT = { window: 60000, maxRequests: 10 };

  // Security patterns - compiled once for performance
  private static readonly SECURITY_PATTERNS = {
    xss: [
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /&#x?0*(58|106|0*74|0*42|0*6a);?/gi,
    ],
    mql5Dangerous: [
      /FileFind\s*\(|FileOpen\s*\(|FileClose\s*\(|FileDelete\s*\(/i,
      /WebRequest\s*\(|SocketCreate\s*\(|SocketConnect\s*\(/i,
      /ShellExecute\s*\(|WinExec\s*\(|CreateProcess\s*\(/i,
      /memcpy\s*\(|memset\s*\(|malloc\s*\(|free\s*\(/i,
      /RegOpenKey\s*\(|RegCreateKey\s*\(|RegSetValue\s*\(/i,
      /#import\s+["\']?(?!user32\.dll|kernel32\.dll)[^"\']*["\']?/i,
      /SendNotification\s*\(|SendMail\s*\(|SendFTP\s*\(/i,
      /OrderSend\s*\(|OrderClose\s*\(|OrderModify\s*\(/i,
      /PositionOpen\s*\(|PositionClose\s*\(|PositionModify\s*\(/i,
    ],
    obfuscation: [
      /0x[0-9a-fA-F]+/g,
      /[A-Za-z0-9+\/]{20,}={0,2}/g,
      /\\u[0-9a-fA-F]{4}/g,
      /\\x[0-9a-fA-F]{2}/g,
    ],
    suspicious: new Set([
      'password', 'secret', 'key', 'token', 'auth', 'credential',
      'exploit', 'hack', 'crack', 'bypass', 'inject', 'payload',
      'malware', 'virus', 'trojan', 'backdoor', 'rootkit'
    ])
  } as const;

  private static readonly BLACKLISTED_SYMBOLS = new Set(['TEST', 'DEMO', 'FAKE', 'INVALID']);
  private static readonly PLACEHOLDER_KEYS = new Set([
    'your-api-key-here', '1234567890', 'abcdefghijk', 'test-key', 'demo-key', 'sample-key'
  ]);

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
    const warnings: string[] = [];

    // Timeframe validation
    if (!this.TIMEFRAMES.has(params.timeframe)) {
      errors.push({
        field: 'timeframe',
        message: `Invalid timeframe. Must be one of: ${Array.from(this.TIMEFRAMES).join(', ')}`
      });
    }

    // Symbol validation
    const symbolError = this.validateRegex(
      params.symbol, 
      'symbol', 
      this.SYMBOL_REGEX, 
      'Symbol must be in format like EURUSD or GBP/USD'
    );
    if (symbolError) errors.push(symbolError);

    // Range validations
    const riskError = this.validateRange(
      params.riskPercent, 
      'riskPercent', 
      this.BOUNDS.riskPercent.min, 
      this.BOUNDS.riskPercent.max
    );
    if (riskError) errors.push(riskError);

    const stopLossError = this.validateRange(
      params.stopLoss, 
      'stopLoss', 
      this.BOUNDS.stopLoss.min, 
      this.BOUNDS.stopLoss.max
    );
    if (stopLossError) errors.push(stopLossError);

    const takeProfitError = this.validateRange(
      params.takeProfit, 
      'takeProfit', 
      this.BOUNDS.takeProfit.min, 
      this.BOUNDS.takeProfit.max
    );
    if (takeProfitError) errors.push(takeProfitError);

    const magicNumberError = this.validateRange(
      params.magicNumber, 
      'magicNumber', 
      this.BOUNDS.magicNumber.min, 
      this.BOUNDS.magicNumber.max
    );
    if (magicNumberError) errors.push(magicNumberError);

    // Custom inputs validation
    const seenNames = new Set<string>();
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

      // Check for duplicate names
      if (input.name && seenNames.has(input.name)) {
        errors.push({ field: `${prefix}.name`, message: `Duplicate input name: "${input.name}"` });
      } else if (input.name) {
        seenNames.add(input.name);
      }
    });

    // Risk warnings
    if (params.riskPercent > 10) {
      warnings.push('High risk percentage detected (>10%). Consider using lower risk settings.');
    }

    if (params.stopLoss === 0) {
      warnings.push('Stop loss is set to 0. This may result in unlimited losses.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Backtest settings validation
  static validateBacktestSettings(settings: BacktestSettings): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    const depositError = this.validateRange(
      settings.initialDeposit, 
      'initialDeposit', 
      this.BOUNDS.initialDeposit.min, 
      this.BOUNDS.initialDeposit.max
    );
    if (depositError) errors.push(depositError);

    const durationError = this.validateRange(
      settings.days, 
      'days', 
      this.BOUNDS.duration.min, 
      this.BOUNDS.duration.max
    );
    if (durationError) errors.push(durationError);

    const leverageError = this.validateRange(
      settings.leverage, 
      'leverage', 
      this.BOUNDS.leverage.min, 
      this.BOUNDS.leverage.max
    );
    if (leverageError) errors.push(leverageError);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Enhanced API key validation
  static validateApiKey(apiKey: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    const requiredError = this.validateRequired(apiKey, 'apiKey');
    if (requiredError) {
      errors.push(requiredError);
      return { isValid: false, errors, warnings };
    }

    // Format validation using patterns
    const isValidFormat = this.API_KEY_PATTERNS.some(pattern => pattern.test(apiKey.trim()));
    if (!isValidFormat) {
      errors.push({ field: 'apiKey', message: 'Invalid API key format' });
    }

    // Placeholder check
    const lowerKey = apiKey.toLowerCase();
    if (this.PLACEHOLDER_KEYS.has(lowerKey) || 
        Array.from(this.PLACEHOLDER_KEYS).some(placeholder => lowerKey.includes(placeholder))) {
      errors.push({ field: 'apiKey', message: 'Please use a valid API key, not a placeholder' });
    }

    // Security warnings
    if (apiKey.length < 20) {
      warnings.push('API key appears to be short. Ensure it\'s a valid production key.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Enhanced symbol validation
  static validateSymbol(symbol: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    const requiredError = this.validateRequired(symbol, 'symbol');
    if (requiredError) {
      errors.push(requiredError);
      return { isValid: false, errors, warnings };
    }

    const trimmedSymbol = symbol.trim().toUpperCase();
    
    if (!this.SYMBOL_REGEX.test(trimmedSymbol)) {
      errors.push({
        field: 'symbol',
        message: 'Invalid symbol format. Use formats like: EURUSD, EUR/USD, XAUUSD, BTCUSDT'
      });
    }

    if (this.BLACKLISTED_SYMBOLS.has(trimmedSymbol)) {
      errors.push({ field: 'symbol', message: 'Invalid symbol for trading' });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Enhanced chat message validation with security checks
  static validateChatMessage(message: string, userId?: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Rate limiting check
    if (userId) {
      const now = Date.now();
      const userLimit = this.rateLimiter.get(userId);
      
      if (!userLimit || now > userLimit.resetTime) {
        this.rateLimiter.set(userId, { count: 1, resetTime: now + this.RATE_LIMIT.window });
      } else {
        userLimit.count++;
        if (userLimit.count > this.RATE_LIMIT.maxRequests) {
          errors.push({
            field: 'rateLimit',
            message: `Rate limit exceeded. Maximum ${this.RATE_LIMIT.maxRequests} messages per minute.`
          });
        }
      }
    }

    // Content validation
    const contentError = this.validateLength(message, 'message', 1, this.BOUNDS.messageLength.max);
    if (contentError) errors.push(contentError);

    // Security validation
    this.validateSecurity(message, errors, warnings);

    // Sanitize message
    const sanitized = this.sanitizeInput(message);
    if (sanitized !== message) {
      warnings.push('Message content was sanitized during validation');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Security validation helper
  private static validateSecurity(message: string, errors: ValidationError[], warnings: string[]): void {
    // XSS checks
    for (const pattern of this.SECURITY_PATTERNS.xss) {
      if (pattern.test(message)) {
        errors.push({ field: 'message', message: 'Message contains potentially unsafe content' });
        return;
      }
    }

    // Obfuscation checks
    let obfuscationCount = 0;
    for (const pattern of this.SECURITY_PATTERNS.obfuscation) {
      const matches = message.match(pattern);
      if (matches && matches.length > 3) {
        obfuscationCount++;
      }
    }
    
    if (obfuscationCount > 0) {
      warnings.push('Message contains potentially obfuscated content');
    }

    // MQL5 dangerous patterns
    for (const pattern of this.SECURITY_PATTERNS.mql5Dangerous) {
      if (pattern.test(message)) {
        errors.push({ field: 'message', message: 'Message contains potentially dangerous MQL5 operations' });
        return;
      }
    }

    // Suspicious keywords
    const lowerMessage = message.toLowerCase();
    let suspiciousCount = 0;
    for (const keyword of this.SECURITY_PATTERNS.suspicious) {
      if (lowerMessage.includes(keyword)) {
        suspiciousCount++;
      }
    }

    if (suspiciousCount > 2) {
      warnings.push('Message contains suspicious content');
    }
  }

  // MQL5 code validation
  static validateMQL5Code(code: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    const requiredError = this.validateRequired(code, 'code');
    if (requiredError) {
      errors.push(requiredError);
      return { isValid: false, errors, warnings };
    }

    // Essential MQL5 components
    const essentialPatterns = {
      onInit: /\bint\s+OnInit\s*\(\s*\)/g,
      onTick: /\bvoid\s+OnTick\s*\(\s*\)/g,
      onDeinit: /\bvoid\s+OnDeinit\s*\(\s*const\s+int\s+reason\s*\)/g
    };

    if (!essentialPatterns.onInit.test(code)) {
      warnings.push('MQL5 code should contain an OnInit() function');
    }

    if (!essentialPatterns.onTick.test(code)) {
      warnings.push('MQL5 code should contain an OnTick() function');
    }

    if (!essentialPatterns.onDeinit.test(code)) {
      warnings.push('MQL5 code should contain an OnDeinit() function');
    }

    // Security checks
    for (const pattern of this.SECURITY_PATTERNS.mql5Dangerous) {
      if (pattern.test(code)) {
        errors.push({ field: 'code', message: 'Code contains potentially dangerous MQL5 operations' });
        break; // Stop after first dangerous pattern
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Generic validation using rules
  static validateWithRules(data: Record<string, any>, rules: ValidationRule[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

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
      errors,
      warnings
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
      remaining: Math.max(0, this.RATE_LIMIT.maxRequests - limit.count)
    };
  }

  // Clean up expired rate limit entries
  static cleanupRateLimit(): void {
    const now = Date.now();
    for (const [userId, limit] of this.rateLimiter.entries()) {
      if (now >= limit.resetTime) {
        this.rateLimiter.delete(userId);
      }
    }
  }
}

// Export singleton instance for convenience
export const validator = UnifiedValidationService;

// Backward compatibility exports
export const ValidationService = UnifiedValidationService;