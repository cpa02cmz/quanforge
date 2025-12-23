import { Robot, StrategyParams, BacktestSettings } from '../types';
import DOMPurify from 'dompurify';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

export interface ValidationConfig {
  maxPayloadSize: number;
  maxInputLength: number;
  allowedHtmlTags: string[];
  forbiddenPatterns: RegExp[];
}

/**
 * InputValidationService - Handles all input sanitization and validation logic
 * 
 * Responsibilities:
 * - Input sanitization and cleaning
 * - Data type validation
 * - MQL5 code validation
 * - Symbol and parameter validation
 * - XSS and injection prevention
 * - Size and format constraint checking
 */
export class InputValidationService {
  private config: ValidationConfig;

  constructor(config?: Partial<ValidationConfig>) {
    this.config = {
      maxPayloadSize: 5 * 1024 * 1024, // 5MB
      maxInputLength: 10000,
      allowedHtmlTags: ['b', 'i', 'em', 'strong', 'a', 'code', 'pre'],
      forbiddenPatterns: [
        /javascript:/gi,
        /vbscript:/gi,
        /onload=/gi,
        /onerror=/gi,
        /onclick=/gi,
        /<script/gi,
        /<iframe/gi,
        /<object/gi,
        /<embed/gi,
        /eval\s*\(/gi,
        /expression\s*\(/gi,
        /@import/gi,
        /binding\s*:/gi
      ],
      ...config
    };
  }

  /**
   * Main validation entry point
   */
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    const errors: string[] = [];
    let sanitizedData = data;
    let riskScore = 0;

    try {
      // Check payload size
      const payloadSize = new Blob([JSON.stringify(data)]).size;
      if (payloadSize > this.config.maxPayloadSize) {
        errors.push(`Payload too large: ${payloadSize} bytes (max: ${this.config.maxPayloadSize})`);
        riskScore += 50;
      }

      // Basic structure validation
      if (!data || typeof data !== 'object') {
        errors.push('Invalid data structure');
        return { isValid: false, errors, riskScore: 90 };
      }

      // Type-specific validation
      switch (type) {
        case 'robot':
          return this.validateRobotData(data);
        case 'strategy':
          return this.validateStrategyData(data);
        case 'backtest':
          return this.validateBacktestData(data);
        case 'user':
          return this.validateUserData(data);
        default:
          errors.push('Unknown validation type');
          riskScore += 20;
      }
    } catch (error) {
      errors.push('Validation error: ' + (error as Error).message);
      riskScore += 30;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData,
      riskScore,
    };
  }

  /**
   * Robot data validation
   */
  private validateRobotData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;
    const sanitized: Partial<Robot> = {};

    // Name validation
    if (data.name) {
      const sanitizedName = this.sanitizeInput(data.name, 'text');
      if (!sanitizedName || sanitizedName.length > 100) {
        errors.push('Invalid robot name');
        riskScore += 10;
      }
      sanitized.name = sanitizedName;
    } else {
      errors.push('Robot name is required');
      riskScore += 15;
    }

    // Description validation
    if (data.description) {
      const sanitizedDesc = this.sanitizeInput(data.description, 'html');
      if (sanitizedDesc.length > 500) {
        errors.push('Description too long');
        riskScore += 5;
      }
      sanitized.description = sanitizedDesc;
    }

    // Code validation - critical for security
    if (data.code) {
      const codeValidation = this.validateMQL5Code(data.code);
      if (!codeValidation.isValid) {
        errors.push(...codeValidation.errors);
        riskScore += 25;
      }
      sanitized.code = codeValidation.sanitizedCode;
    } else {
      errors.push('Robot code is required');
      riskScore += 20;
    }

    // Strategy type validation
    if (data.strategy_type) {
      const validTypes = ['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'];
      if (!validTypes.includes(data.strategy_type)) {
        errors.push('Invalid strategy type');
        riskScore += 10;
      }
      sanitized.strategy_type = data.strategy_type;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
      riskScore,
    };
  }

  /**
   * Strategy parameter validation
   */
  private validateStrategyData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;
    const sanitized: Partial<StrategyParams> = {};

    // Timeframe validation
    if (data.timeframe) {
      const validTimeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];
      if (!validTimeframes.includes(data.timeframe)) {
        errors.push('Invalid timeframe');
        riskScore += 10;
      }
      sanitized.timeframe = data.timeframe;
    }

    // Symbol validation
    if (data.symbol) {
      const sanitizedSymbol = this.sanitizeSymbol(data.symbol);
      if (!sanitizedSymbol) {
        errors.push('Invalid symbol format');
        riskScore += 10;
      }
      sanitized.symbol = sanitizedSymbol;
    }

    // Risk percent validation
    if (typeof data.riskPercent === 'number') {
      if (data.riskPercent < 0.01 || data.riskPercent > 100) {
        errors.push('Risk percent must be between 0.01 and 100');
        riskScore += 10;
      }
      sanitized.riskPercent = Math.max(0.01, Math.min(100, data.riskPercent));
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
      riskScore,
    };
  }

  /**
   * Backtest settings validation
   */
  private validateBacktestData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;
    const sanitized: Partial<BacktestSettings> = {};

    // Initial deposit validation
    if (typeof data.initialDeposit === 'number') {
      if (data.initialDeposit < 100 || data.initialDeposit > 10000000) {
        errors.push('Initial deposit must be between $100 and $10,000,000');
        riskScore += 10;
      }
      sanitized.initialDeposit = Math.max(100, Math.min(10000000, data.initialDeposit));
    }

    // Days validation
    if (typeof data.days === 'number') {
      if (data.days < 1 || data.days > 365) {
        errors.push('Backtest duration must be between 1 and 365 days');
        riskScore += 10;
      }
      sanitized.days = Math.max(1, Math.min(365, data.days));
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
      riskScore,
    };
  }

  /**
   * User data validation
   */
  private validateUserData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;
    const sanitized: any = {};

    // Email validation
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push('Invalid email format');
        riskScore += 15;
      }
      sanitized.email = data.email.toLowerCase().trim();
    }

    // Username validation
    if (data.username) {
      const sanitizedUsername = this.sanitizeInput(data.username, 'text');
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(sanitizedUsername)) {
        errors.push('Username must be 3-30 characters, alphanumeric and underscore only');
        riskScore += 10;
      }
      sanitized.username = sanitizedUsername;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
      riskScore,
    };
  }

  /**
   * MQL5 code validation with security checks
   */
  validateMQL5Code(code: string): { isValid: boolean; errors: string[]; sanitizedCode: string } {
    const errors: string[] = [];
    let sanitizedCode = this.sanitizeInput(code, 'code');

    // Check for dangerous functions
    const dangerousFunctions = [
      'ShellExecute',
      'WinExec',
      'CreateProcess',
      'system',
      'exec',
      'eval',
      'import',
      'require',
      'SendNotification',
      'SendMail',
      'SendFTP'
    ];

    dangerousFunctions.forEach(func => {
      if (sanitizedCode.includes(func)) {
        errors.push(`Dangerous function detected: ${func}`);
      }
    });

    // Check for file operations
    const fileOperations = ['FileOpen', 'FileWrite', 'FileDelete', 'FileMove'];
    fileOperations.forEach(func => {
      if (sanitizedCode.includes(func)) {
        errors.push(`File operation detected: ${func}`);
      }
    });

    // Check for network operations
    const networkOperations = ['WebRequest', 'SocketCreate', 'SocketConnect'];
    networkOperations.forEach(func => {
      if (sanitizedCode.includes(func)) {
        errors.push(`Network operation detected: ${func}`);
      }
    });

    // Basic MQL5 structure validation
    const requiredFunctions = ['OnInit', 'OnTick', 'OnDeinit'];
    requiredFunctions.forEach(func => {
      if (!sanitizedCode.includes(func)) {
        errors.push(`Missing required function: ${func}`);
      }
    });

    // Check for infinite loops or dangerous patterns
    const dangerousPatterns = [
      /while\s*\(\s*true\s*\)/gi,
      /for\s*\(\s*;\s*;\s*\)/gi,
      /goto\s+/gi
    ];

    dangerousPatterns.forEach(pattern => {
      if (pattern.test(sanitizedCode)) {
        errors.push('Dangerous code pattern detected');
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedCode
    };
  }

  /**
   * Symbol validation and sanitization
   */
  sanitizeSymbol(symbol: string): string {
    if (!symbol || typeof symbol !== 'string') {
      return '';
    }

    const sanitized = this.sanitizeInput(symbol, 'symbol');
    
    // Common forex pairs pattern (EUR/USD, GBP/JPY, etc.)
    const forexPattern = /^[A-Z]{3}\/[A-Z]{3}$/;
    if (forexPattern.test(sanitized)) {
      return sanitized;
    }

    // Crypto pairs pattern (BTC/USD, ETH/USDT, etc.)
    const cryptoPattern = /^[A-Z]{3,10}\/[A-Z]{3,10}$/;
    if (cryptoPattern.test(sanitized)) {
      return sanitized;
    }

    // Stock symbols pattern (AAPL, GOOGL, etc.)
    const stockPattern = /^[A-Z]{1,5}$/;
    if (stockPattern.test(sanitized)) {
      return sanitized;
    }

    // Blacklist common invalid symbols
    const blacklist = ['TEST', 'INVALID', 'DEMO', 'SAMPLE'];
    return blacklist.includes(sanitized) ? '' : sanitized;
  }

  /**
   * Generic input sanitization
   */
  sanitizeInput(input: string, type: 'text' | 'html' | 'code' | 'symbol' | 'url' | 'search' | 'token' | 'email' = 'text'): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input.trim();

    // Length check
    if (sanitized.length > this.config.maxInputLength) {
      sanitized = sanitized.substring(0, this.config.maxInputLength);
    }

    // Type-specific sanitization
    switch (type) {
      case 'html':
        // Use DOMPurify for HTML content
        sanitized = DOMPurify.sanitize(sanitized, {
          ALLOWED_TAGS: this.config.allowedHtmlTags,
          ALLOWED_ATTR: ['href', 'title', 'target']
        });
        break;

      case 'code':
        // Remove dangerous code patterns
        this.config.forbiddenPatterns.forEach(pattern => {
          sanitized = sanitized.replace(pattern, '');
        });
        break;

      case 'symbol':
        // Special character cleanup for symbols
        sanitized = sanitized.replace(/[^a-zA-Z0-9/]/g, '').toUpperCase();
        break;

      case 'url':
        // Basic URL validation
        try {
          new URL(sanitized);
        } catch {
          return '';
        }
        break;

      default:
        // General text sanitization
        this.config.forbiddenPatterns.forEach(pattern => {
          sanitized = sanitized.replace(pattern, '');
        });
    }

    return sanitized;
  }

  /**
   * Validate input based on type
   */
  validateInput(input: any, type: 'search' | 'record' | 'robot' | 'strategy' | 'backtest' | 'user' | 'text' | 'code' | 'symbol' | 'url' | 'token' | 'html' = 'text'): boolean {
    if (input === null || input === undefined) {
      return false;
    }
    
    if (typeof input !== 'string' && typeof input !== 'object') {
      return false;
    }
    
    // For string inputs, use basic sanitization
    if (typeof input === 'string') {
      const sanitized = this.sanitizeInput(input, type as any);
      return sanitized.length > 0 && sanitized.length < this.config.maxInputLength;
    }
    
    // For object inputs, use validation methods
    switch (type) {
      case 'robot':
      case 'strategy':
      case 'backtest':
      case 'user':
        const validation = this.sanitizeAndValidate(input, type);
        return validation.isValid && validation.riskScore < 70;
        
      case 'record':
        const recordValidation = this.sanitizeAndValidate(input, 'robot');
        return recordValidation.isValid && recordValidation.riskScore < 50;
        
      case 'search':
        const searchValidation = this.sanitizeAndValidate({ searchTerm: input }, 'strategy');
        return searchValidation.isValid && searchValidation.riskScore < 30;
        
      default:
        return true;
    }
  }

  /**
   * Update validation configuration
   */
  updateConfig(newConfig: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }
}