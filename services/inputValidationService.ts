import { Robot, StrategyParams, BacktestSettings } from '../types';
import DOMPurify from 'dompurify';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

export interface InputValidationConfig {
  maxPayloadSize: number;
  allowedMQL5Functions: string[];
  maxStringLength: number;
  codeValidationPatterns: {
    dangerousFunctions: RegExp[];
    safeIncludes: RegExp[];
  };
}

/**
 * Input Validation Service
 * Handles comprehensive input sanitization, validation, and security checks
 */
export class InputValidationService {
  private config: InputValidationConfig;

  constructor(config?: Partial<InputValidationConfig>) {
    this.config = {
      maxPayloadSize: 5 * 1024 * 1024, // 5MB
      allowedMQL5Functions: [
        'OrderSend', 'OrderClose', 'OrderModify', 'PositionInfo',
        'SymbolInfoDouble', 'SymbolInfoInteger', 'SymbolInfoString',
        'AccountInfoDouble', 'AccountInfoInteger', 'AccountInfoString',
        'NormalizeDouble', 'Point', 'Digits', '_Period', '_Symbol',
        'iMA', 'iRSI', 'iMACD', 'iBands', 'iADX', 'iCCI', 'iMomentum',
        'iATR', 'iBullsPower', 'iBearsPower', 'iStochastic', 'iWPR'
      ],
      maxStringLength: 10000,
      codeValidationPatterns: {
        dangerousFunctions: [
          /ShellExecute\s*\(/gi,
          /WinExec\s*\(/gi,
          /CreateProcess\s*\(/gi,
          /system\s*\(/gi,
          /exec\s*\(/gi,
          /eval\s*\(/gi,
          /import\s+["']crypto["']/gi,
          /import\s+["']fs["']/gi,
          /import\s+["']child_process["']/gi,
          /require\s*\(\s*["']crypto["']/gi,
          /require\s*\(\s*["']fs["']/gi,
          /require\s*\(\s*["']child_process["']/gi,
          /document\.write/gi,
          /innerHTML\s*\=/gi,
          /outerHTML\s*\=/gi,
        ],
        safeIncludes: [
          /^#property\s+.*$/gm,
          /^input\s+.*$/gm,
          /^extern\s+.*$/gm,
          /^(int|double|string|bool|datetime)\s+\w+\s*(\[.*?\])?\s*(=.*)?;$/gm,
          /^(void|int|double|string|bool|datetime)\s+\w+\s*\([^)]*\)\s*\{.*\}$/gm,
          /^if\s*\([^)]+\)\s*\{.*\}$/gm,
          /^for\s*\([^)]+\)\s*\{.*\}$/gm,
          /^while\s*\([^)]+\)\s*\{.*\}$/gm,
          /^(OnTick|OnInit|OnDeinit|OnTimer|OnCalculate)\s*\([^)]*\)\s*\{.*\}$/gm,
          /OrderSend\s*\(/gi,
          /OrderClose\s*\(/gi,
          /OrderModify\s*\(/gi,
          /PositionInfo\s*\(/gi,
          /SymbolInfoDouble\s*\(/gi,
          /SymbolInfoInteger\s*\(/gi,
        ]
      },
      ...config
    };
  }

  /**
   * Main validation method for different data types
   */
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    const errors: string[] = [];
    const sanitizedData = data;
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
        return {
          isValid: false,
          errors,
          riskScore: 75,
        };
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
          riskScore += 25;
      }
    } catch (error) {
      errors.push('Validation processing error');
      riskScore += 50;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData,
      riskScore,
    };
  }

  /**
   * Validate robot/trading strategy data
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
        riskScore += 15;
      }
      sanitized.name = sanitizedName;
    } else {
      sanitized.name = 'Untitled Robot';
    }

    // Description validation
    if (data.description) {
      const sanitizedDescription = this.sanitizeInput(data.description, 'html');
      if (sanitizedDescription.length > 1000) {
        errors.push('Description too long');
        riskScore += 10;
      }
      sanitized.description = sanitizedDescription;
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
   * Validate strategy parameters
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
   * Validate backtest settings
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
   * Validate user data
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
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(data.username)) {
        errors.push('Username must be 3-20 characters (alphanumeric and underscore only)');
        riskScore += 10;
      }
      sanitized.username = data.username.toLowerCase().trim();
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
      riskScore,
    };
  }

  /**
   * Validate MQL5 code for security and syntax
   */
  validateMQL5Code(code: string): { isValid: boolean; errors: string[]; sanitizedCode: string } {
    const errors: string[] = [];
    let sanitizedCode = code;

    // Remove potential dangerous content
    sanitizedCode = sanitizedCode.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
    sanitizedCode = sanitizedCode.replace(/\/\/.*$/gm, ''); // Remove line comments

    // Check for dangerous functions
    for (const pattern of this.config.codeValidationPatterns.dangerousFunctions) {
      if (pattern.test(sanitizedCode)) {
        errors.push(`Dangerous function detected: ${pattern.source}`);
      }
    }

    // Check for required MQL5 structure
    const hasOnInit = /OnInit\s*\(/.test(sanitizedCode);
    const hasOnTick = /OnTick\s*\(/.test(sanitizedCode);
    
    if (!hasOnInit) {
      errors.push('MQL5 code must have OnInit() function');
    }
    
    if (!hasOnTick) {
      errors.push('MQL5 code must have OnTick() function');
    }

    // Check for includes and validate them
    const includes = sanitizedCode.match(/#include\s+<[^>]+>/g) || [];
    for (const include of includes) {
      const fileName = include.match(/<([^>]+)>/)?.[1];
      if (fileName && !this.isValidInclude(fileName)) {
        errors.push(`Invalid or suspicious include file: ${fileName}`);
      }
    }

    // Basic syntax checks
    const openBraces = (sanitizedCode.match(/\{/g) || []).length;
    const closeBraces = (sanitizedCode.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Unmatched braces in code');
    }

    // Check for extremely long code
    if (sanitizedCode.length > this.config.maxStringLength) {
      errors.push(`Code too long: ${sanitizedCode.length} characters (max: ${this.config.maxStringLength})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedCode,
    };
  }

  /**
   * Validate include file names
   */
  private isValidInclude(fileName: string): boolean {
    const allowedIncludes = [
      'Trade\\Trade.mqh',
      'Trade\\PositionInfo.mqh',
      'Trade\\OrderInfo.mqh',
      'Trade\\AccountInfo.mqh',
      'Trade\\SymbolInfo.mqh',
      'Arrays\\ArrayObj.mqh',
      'Arrays\\ArrayInt.mqh',
      'Arrays\\ArrayDouble.mqh',
      'Arrays\\ArrayString.mqh',
      'DateTimes\\DateTimes.mqh',
      'Strings\\String.mqh',
      'ChartObjects\\ChartObjectsWnd.mqh',
      'ChartObjects\\ChartObjectsTxt.mqh',
    ];

    return allowedIncludes.some(allowed => fileName.includes(allowed)) || 
           fileName.startsWith('Standard\\') ||
           /^[A-Za-z0-9_\\]+\.mqh$/.test(fileName);
  }

  /**
   * WAF (Web Application Firewall) pattern detection
   */
  detectWAFPatterns(request: Request): { isMalicious: boolean; threats: string[]; riskScore: number } {
    const threats: string[] = [];
    let riskScore = 0;

    // Get request details
    const url = request.url;
    const method = request.method;
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const origin = request.headers.get('origin') || '';

    // Common attack patterns
    const wafPatterns = [
      // SQL Injection patterns
      {
        name: 'SQL Injection',
        patterns: [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
          /(--|\*\/|\/\*)/g,
          /(\bOR\b.*=.*\bOR\b)/gi,
          /(\bAND\b.*=.*\bAND\b)/gi,
          /('.*'|".*")/g,
          /waitfor\s+delay/gi,
          /benchmark\s*\(/gi,
          /sleep\s*\(/gi,
        ],
        riskScore: 80
      },
      // XSS patterns
      {
        name: 'Cross-Site Scripting',
        patterns: [
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          /javascript:/gi,
          /on\w+\s*=/gi,
          /<iframe\b[^>]*>/gi,
          /<object\b[^>]*>/gi,
          /<embed\b[^>]*>/gi,
        ],
        riskScore: 70
      },
      // Path traversal
      {
        name: 'Path Traversal',
        patterns: [
          /\.\.\//g,
          /\.\.\\/g,
          /%2e%2e%2f/gi,
          /%2e%2e\\/gi,
        ],
        riskScore: 60
      },
      // Command injection
      {
        name: 'Command Injection',
        patterns: [
          /[;&|`$(){}[\]]/g,
          /curl\s+/gi,
          /wget\s+/gi,
          /nc\s+/gi,
          /netcat\s+/gi,
        ],
        riskScore: 90
      }
    ];

    // Check each pattern category
    for (const category of wafPatterns) {
      for (const pattern of category.patterns) {
        const testString = `${url} ${method} ${userAgent} ${referer} ${origin}`;
        if (pattern.test(testString)) {
          threats.push(category.name);
          riskScore += category.riskScore;
          break; // One hit per category is enough
        }
      }
    }

    // Additional heuristic checks
    if (userAgent.length > 500) {
      threats.push('Suspicious User Agent');
      riskScore += 30;
    }

    if (url.length > 2048) {
      threats.push('Suspicious URL Length');
      riskScore += 20;
    }

    const isMalicious = threats.length > 0 || riskScore > 50;

    return {
      isMalicious,
      threats: [...new Set(threats)], // Remove duplicates
      riskScore: Math.min(riskScore, 100),
    };
  }

  /**
   * Sanitize input based on type
   */
  sanitizeInput(input: string, type: 'text' | 'html' | 'code' | 'symbol' | 'url' | 'token' = 'text'): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input.trim();

    switch (type) {
      case 'html':
        // Use DOMPurify for HTML content
        try {
          sanitized = DOMPurify.sanitize(sanitized, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
            ALLOWED_ATTR: [],
          });
        } catch (error) {
          console.error('DOMPurify error:', error);
          sanitized = sanitized.replace(/<[^>]*>/g, ''); // Fallback
        }
        break;

      case 'code':
        // Allow code-related characters but remove dangerous ones
        sanitized = sanitized
          .replace(/[<>]/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .substring(0, 1000);
        break;

      case 'symbol':
        return this.sanitizeSymbol(sanitized);

      case 'url':
        // Basic URL sanitization
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        sanitized = sanitized.replace(/javascript:/gi, '');
        break;

      case 'token':
        // Token sanitization - only allow alphanumeric and specific characters
        sanitized = sanitized.replace(/[^a-zA-Z0-9\-_\.]/g, '').substring(0, 500);
        break;

      case 'text':
      default:
        // General text sanitization
        sanitized = sanitized
          .replace(/[<>]/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .substring(0, 1000);
        break;
    }

    return sanitized;
  }

  /**
   * Sanitize trading symbol
   */
  sanitizeSymbol(symbol: string): string {
    // Allow common forex symbols and crypto pairs
    const symbolRegex = /^[A-Z]{3,6}[\/]?[A-Z]{3,6}$/;
    const cleanSymbol = symbol.replace(/[^A-Z\/]/g, '').toUpperCase();
    return symbolRegex.test(cleanSymbol) ? cleanSymbol : '';
  }

  /**
   * Generic input validation method
   */
  validateInput(input: any, type: 'search' | 'record' | 'robot' | 'strategy' | 'backtest' | 'user' | 'text' | 'code' | 'symbol' | 'url' | 'token' | 'html' = 'text'): boolean {
    if (input === null || input === undefined) {
      return false;
    }

    // Use existing validation methods based on type
    switch (type) {
      case 'search':
        const searchValidation = this.sanitizeAndValidate({ searchTerm: input }, 'strategy');
        return searchValidation.isValid && searchValidation.riskScore < 30;

      case 'record':
        const recordValidation = this.sanitizeAndValidate(input, 'robot');
        return recordValidation.isValid && recordValidation.riskScore < 50;

      case 'robot':
      case 'strategy':
      case 'backtest':
      case 'user':
        const validation = this.sanitizeAndValidate(input, type);
        return validation.isValid && validation.riskScore < 70;

      default:
        // For other types, use basic sanitization
        const sanitized = this.sanitizeInput(String(input), type);
        return sanitized.length > 0 && sanitized.length < 10000;
    }
  }

  /**
   * Prevent prototype pollution attacks
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
      console.error('JSON parsing error:', error);
      return null;
    }
  }
}

// Singleton instance
export const inputValidationService = new InputValidationService();