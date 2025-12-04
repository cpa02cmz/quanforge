/**
 * Enhanced Input Validation Service
 * Provides comprehensive validation and sanitization for all user inputs
 */

import DOMPurify from 'dompurify';

export interface ValidationResult {
  isValid: boolean;
  sanitized?: string;
  errors?: string[];
  warnings?: string[];
}

export interface ValidationRule {
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  allowedChars?: string[];
  forbiddenPatterns?: RegExp[];
  sanitize?: boolean;
  trim?: boolean;
}

export class EnhancedInputValidator {
  private static readonly COMMON_PATTERNS = {
    // XSS patterns
    xss: [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /<link\b[^>]*>/gi,
      /<meta\b[^>]*>/gi,
      /expression\s*\(/gi,
      /url\s*\(\s*['"]*javascript:/gi,
      /@import/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /<[^>]*[^a-zA-Z0-9\s\-\._\?=\/&:%\+\#]/gi, // Special chars in tags
    ],
    
    // SQL injection patterns
    sqlInjection: [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
      /(\b(OR|AND)\s+['"][^'"]*['"]\s*=\s*['"][^'"]*['"])/gi,
      /(--|\#|\/\*|\*\/)/gi,
      /(\bUNION\s+SELECT\b)/gi,
      /(\b(INSERT|INTO)\b)/gi,
      /(\b(UPDATE|SET)\b)/gi,
      /(\bDELETE\s+FROM\b)/gi,
    ],
    
    // Command injection patterns
    commandInjection: [
      /[;&|`$(){}[\]]/gi,
      /\b(curl|wget|nc|netcat|ssh|ftp|telnet)\b/gi,
      /\b(rm|mv|cp|cat|ls|ps|kill|chmod|chown)\b/gi,
      /\b(python|perl|ruby|bash|sh|cmd|powershell)\b/gi,
    ],
    
    // Path traversal patterns
    pathTraversal: [
      /\.\.\//g,
      /\.\.\\/g,
      /%2e%2e\//gi,
      /%2e%2e\\/gi,
      /\.\.%2f/gi,
      /\.\.%5c/gi,
    ],
    
    // MQL5 specific dangerous patterns
    mql5Dangerous: [
      /\b(ShellExecute|WinExec|CreateProcess|system|exec)\b/gi,
      /\b(DeleteFile|RemoveDirectory|FormatDisk)\b/gi,
      /\b(Registry|RegCreate|RegDelete|RegSetValue)\b/gi,
      /\b(Network|Socket|Connect|Bind|Listen)\b/gi,
      /\b(Crypt|Encrypt|Decrypt|Hash)\b/gi,
    ]
  };

  /**
   * Validate and sanitize text input
   */
  static validateText(input: string, rules: ValidationRule): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitized = input;

    // Trim if requested
    if (rules.trim) {
      sanitized = sanitized.trim();
    }

    // Length validation
    if (rules.minLength && sanitized.length < rules.minLength) {
      errors.push(`Input must be at least ${rules.minLength} characters long`);
    }

    if (rules.maxLength && sanitized.length > rules.maxLength) {
      errors.push(`Input must not exceed ${rules.maxLength} characters`);
      sanitized = sanitized.substring(0, rules.maxLength);
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(sanitized)) {
      errors.push('Input format is invalid');
    }

    // Allowed characters validation
    if (rules.allowedChars) {
      const allowedPattern = new RegExp(`^[${rules.allowedChars.join('')}]*$`);
      if (!allowedPattern.test(sanitized)) {
        errors.push('Input contains invalid characters');
        // Remove invalid characters
        sanitized = sanitized.replace(new RegExp(`[^${rules.allowedChars.join('')}]`, 'g'), '');
      }
    }

    // Check for forbidden patterns
    if (rules.forbiddenPatterns) {
      for (const pattern of rules.forbiddenPatterns) {
        if (pattern.test(sanitized)) {
          errors.push('Input contains forbidden content');
          break;
        }
      }
    }

    // Sanitize with DOMPurify if requested
    if (rules.sanitize) {
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false
      });
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate chat message input
   */
  static validateChatMessage(input: string): ValidationResult {
    const rules: ValidationRule = {
      minLength: 1,
      maxLength: 10000,
      sanitize: true,
      trim: true,
      forbiddenPatterns: [
        ...this.COMMON_PATTERNS.xss,
        ...this.COMMON_PATTERNS.sqlInjection,
        ...this.COMMON_PATTERNS.commandInjection,
        ...this.COMMON_PATTERNS.pathTraversal,
      ]
    };

    return this.validateText(input, rules);
  }

  /**
   * Validate robot name
   */
  static validateRobotName(input: string): ValidationResult {
    const rules: ValidationRule = {
      minLength: 1,
      maxLength: 100,
      allowedChars: ['a-zA-Z0-9', '\\s', '\\-\\_', '\\.'],
      trim: true,
      sanitize: true,
      forbiddenPatterns: this.COMMON_PATTERNS.xss
    };

    return this.validateText(input, rules);
  }

  /**
   * Validate MQL5 code
   */
  static validateMQL5Code(input: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitized = input;

    // Basic length check
    if (sanitized.length > 100000) {
      errors.push('Code is too long (max 100KB)');
      sanitized = sanitized.substring(0, 100000);
    }

    // Check for dangerous MQL5 patterns
    for (const pattern of this.COMMON_PATTERNS.mql5Dangerous) {
      if (pattern.test(sanitized)) {
        warnings.push('Code contains potentially dangerous functions');
        break;
      }
    }

    // Check for obvious syntax errors
    const openBraces = (sanitized.match(/\{/g) || []).length;
    const closeBraces = (sanitized.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      warnings.push('Unbalanced braces detected');
    }

    // Basic structure validation
    if (!sanitized.includes('void OnTick()') && !sanitized.includes('int OnTick()')) {
      warnings.push('Missing OnTick function');
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate API key format
   */
  static validateApiKey(input: string): ValidationResult {
    const rules: ValidationRule = {
      minLength: 10,
      maxLength: 200,
      pattern: /^[a-zA-Z0-9\-_\.]+$/,
      trim: true,
      sanitize: false // Don't sanitize API keys
    };

    // Check for common placeholder values
    const placeholders = [
      'your-api-key',
      'api-key',
      'your-key',
      'sk-',
      'test-key',
      'demo-key',
      'example-key'
    ];

    const lowerInput = input.toLowerCase();
    for (const placeholder of placeholders) {
      if (lowerInput.includes(placeholder)) {
        return {
          isValid: false,
          errors: ['API key appears to be a placeholder value']
        };
      }
    }

    return this.validateText(input, rules);
  }

  /**
   * Validate trading symbol
   */
  static validateSymbol(input: string): ValidationResult {
    const rules: ValidationRule = {
      minLength: 1,
      maxLength: 20,
      pattern: /^[A-Z0-9\-_\.\/]+$/,
      trim: true,
      sanitize: true
    };

    // Common forex pairs validation
    const validPairs = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD',
      'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'GBPCHF', 'GBPCHF'
    ];

    const result = this.validateText(input, rules);
    
    // Add warning if symbol is not a common pair
    if (result.isValid && !validPairs.includes(input.toUpperCase())) {
      result.warnings = ['Symbol is not a common trading pair'];
    }

    return result;
  }

  /**
   * Validate numeric input (risk, pips, etc.)
   */
  static validateNumeric(input: string, min: number = 0, max: number = 1000000): ValidationResult {
    const rules: ValidationRule = {
      minLength: 1,
      maxLength: 20,
      pattern: /^\d*\.?\d+$/,
      trim: true,
      sanitize: true
    };

    const result = this.validateText(input, rules);
    
    if (result.isValid && result.sanitized) {
      const num = parseFloat(result.sanitized);
      if (isNaN(num)) {
        result.isValid = false;
        result.errors = ['Invalid number format'];
      } else if (num < min || num > max) {
        result.isValid = false;
        result.errors = [`Value must be between ${min} and ${max}`];
      }
    }

    return result;
  }

  /**
   * Comprehensive validation for AI prompts
   */
  static validateAIPrompt(input: string): ValidationResult {
    const rules: ValidationRule = {
      minLength: 5,
      maxLength: 5000,
      sanitize: true,
      trim: true,
      forbiddenPatterns: [
        ...this.COMMON_PATTERNS.xss,
        ...this.COMMON_PATTERNS.sqlInjection,
        ...this.COMMON_PATTERNS.commandInjection,
        ...this.COMMON_PATTERNS.pathTraversal,
      ]
    };

    const result = this.validateText(input, rules);

    // Additional AI-specific checks
    if (result.isValid && result.sanitized) {
      // Check for prompt injection attempts
      const injectionPatterns = [
        /ignore\s+previous\s+instructions/gi,
        /disregard\s+the\s+above/gi,
        /system\s*:\s*you\s+are/gi,
        /act\s+as\s+if/gi,
        /pretend\s+to\s+be/gi,
        /roleplay\s+as/gi,
      ];

      for (const pattern of injectionPatterns) {
        if (pattern.test(result.sanitized)) {
          result.warnings = result.warnings || [];
          result.warnings.push('Prompt may contain injection attempts');
          break;
        }
      }
    }

    return result;
  }
}

export default EnhancedInputValidator;