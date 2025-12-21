import { Robot, StrategyParams, BacktestSettings } from '../../types';

export interface SecurityConfig {
  maxPayloadSize: number;
  allowedOrigins: string[];
  endpoint?: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  encryption: {
    algorithm: string;
    keyRotationInterval: number;
  };
  edgeRateLimiting: {
    enabled: boolean;
    requestsPerSecond: number;
    burstLimit: number;
  };
  regionBlocking: {
    enabled: boolean;
    blockedRegions: string[];
  };
  botDetection: {
    enabled: boolean;
    suspiciousPatterns: string[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

export interface MQL5ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedCode: string;
}

export class RequestValidator {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

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
        return { isValid: false, errors, riskScore: 100 };
      }

      // Type-specific validation
      switch (type) {
        case 'robot':
          const robotResult = this.validateRobotData(data);
          errors.push(...robotResult.errors);
          sanitizedData = robotResult.sanitizedData;
          riskScore += robotResult.riskScore;
          break;

        case 'strategy':
          const strategyResult = this.validateStrategyData(data);
          errors.push(...strategyResult.errors);
          sanitizedData = strategyResult.sanitizedData;
          riskScore += strategyResult.riskScore;
          break;

        case 'backtest':
          const backtestResult = this.validateBacktestData(data);
          errors.push(...backtestResult.errors);
          sanitizedData = backtestResult.sanitizedData;
          riskScore += backtestResult.riskScore;
          break;

        case 'user':
          const userResult = this.validateUserData(data);
          errors.push(...userResult.errors);
          sanitizedData = userResult.sanitizedData;
          riskScore += userResult.riskScore;
          break;
      }

      // XSS and injection prevention
      const xssResult = this.preventXSS(sanitizedData);
      if (xssResult.hasXSS) {
        errors.push('Potential XSS detected and removed');
        riskScore += 30;
        sanitizedData = xssResult.sanitizedData;
      }

      // SQL injection prevention
      const sqlResult = this.preventSQLInjection(sanitizedData);
      if (sqlResult.hasSQLInjection) {
        errors.push('Potential SQL injection detected and removed');
        riskScore += 40;
        sanitizedData = sqlResult.sanitizedData;
      }

    } catch (error) {
      errors.push(`Validation error: ${error}`);
      riskScore += 20;
    }

    return {
      isValid: errors.length === 0 && riskScore < 70,
      errors,
      sanitizedData,
      riskScore,
    };
  }

  private validateRobotData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;
    const sanitized: Partial<Robot> = {};

    // Prevent prototype pollution
    if (this.isPrototypePollution(data)) {
      errors.push('Prototype pollution detected');
      riskScore += 100;
      return { isValid: false, errors, riskScore: 100 };
    }

    // Name validation
    if (data.name) {
      const sanitizedName = this.sanitizeString(data.name);
      if (sanitizedName.length < 3 || sanitizedName.length > 100) {
        errors.push('Robot name must be between 3 and 100 characters');
        riskScore += 10;
      }
      sanitized.name = sanitizedName;
    } else {
      errors.push('Robot name is required');
      riskScore += 15;
    }

    // Description validation
    if (data.description) {
      const sanitizedDescription = this.sanitizeString(data.description);
      if (sanitizedDescription.length > 1000) {
        errors.push('Description too long (max 1000 characters)');
        riskScore += 5;
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

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
      riskScore,
    };
  }

  private validateMQL5Code(code: string): MQL5ValidationResult {
    const errors: string[] = [];
    let sanitizedCode = code;

    // Check for dangerous functions with more comprehensive patterns
    const dangerousFunctions = [
      'SendFTP', 'SendMail', 'SendNotification', 'WebRequest',
      'ShellExecute', 'Import', 'CustomIndicator', 'WindowFind',
      'WindowScreenShot', 'GlobalVariableTemp', 'ResourceCreate',
      'WinExec', 'CreateProcess', 'System', 'Exec', 'Popen',
      'FileFindFirst', 'FileFindNext', 'FileFindClose', 'FileFlush',
      'ResourceSave', 'ResourceRead', 'GlobalVariablesFlush',
      'OrderSend', 'OrderClose', 'OrderModify', 'OrderDelete',
      'PositionOpen', 'PositionClose', 'PositionModify',
      'TerminalInfoInteger', 'TerminalInfoString', 'TerminalInfoDouble',
      'AccountInfo', 'AccountInfoInteger', 'AccountInfoDouble',
      'ChartApplyTemplate', 'ChartSave', 'ChartScreenShot',
      'Alert', 'Comment', 'Print', 'MessageBox', 'Sleep'
    ];

    for (const func of dangerousFunctions) {
      const regex = new RegExp(`\\b${func}\\s*\\(`, 'gi');
      if (regex.test(sanitizedCode)) {
        errors.push(`Dangerous function detected: ${func}`);
        // Remove or comment out dangerous functions
        sanitizedCode = sanitizedCode.replace(regex, `// REMOVED_${func}(`);
      }
    }

    // Additional security checks
    const mqlSecurityPatterns = [
      { pattern: /import\s+|^#import/gi, message: 'Import directives detected' },
      { pattern: /webrequest/gi, message: 'Web request functions detected' },
      { pattern: /sendftp/gi, message: 'FTP operations detected' },
      { pattern: /sendmail/gi, message: 'Email operations detected' },
      { pattern: /alert\(/gi, message: 'Alert function detected' },
      { pattern: /comment\(/gi, message: 'Comment function detected' },
      { pattern: /print\(/gi, message: 'Print function detected' },
    ];
    
    for (const { pattern, message } of mqlSecurityPatterns) {
      if (pattern.test(sanitizedCode)) {
        errors.push(message);
        sanitizedCode = sanitizedCode.replace(pattern, `// SECURITY_BLOCKED: ${message}`);
      }
    }

    // Basic syntax validation
    if (!sanitizedCode.includes('OnTick') && !sanitizedCode.includes('OnStart') && 
        !sanitizedCode.includes('OnInit') && !sanitizedCode.includes('OnDeinit')) {
      errors.push('MQL5 code should contain standard functions like OnTick, OnInit, OnDeinit');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedCode,
    };
  }

  private preventXSS(data: any): { hasXSS: boolean; sanitizedData: any } {
    let hasXSS = false;
    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /<link\b[^>]*>/gi,
      /<meta\b[^>]*>/gi,
      /<form\b[^>]*>/gi,
      /vbscript:/gi,
      /data:/gi,
      /about:/gi,
      /document\.cookie/gi,
      /window\.location/gi,
      /document\.write/gi,
      /eval\(/gi,
      /expression\(/gi,
      /alert\(/gi,
      /confirm\(/gi,
      /prompt\(/gi,
    ];

    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        let sanitized = value;
        for (const pattern of xssPatterns) {
          if (pattern.test(sanitized)) {
            hasXSS = true;
            sanitized = sanitized.replace(pattern, '');
          }
        }
        return sanitized;
      } else if (typeof value === 'object' && value !== null) {
        const sanitizedObj = Array.isArray(value) ? [] : {};
        for (const [key, val] of Object.entries(value)) {
          (sanitizedObj as any)[key] = sanitizeValue(val);
        }
        return sanitizedObj;
      }
      return value;
    };

    const sanitizedData = sanitizeValue(sanitized);
    return { hasXSS, sanitizedData };
  }

  private preventSQLInjection(data: any): { hasSQLInjection: boolean; sanitizedData: any } {
    let hasSQLInjection = false;
    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /(--|\*\/|\/\*)/g,
      /(\bOR\b.*=.*\bOR\b)/gi,
      /(\bAND\b.*=.*\bAND\b)/gi,
      /('.*'|".*")/g,
    ];

    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        let sanitized = value;
        for (const pattern of sqlPatterns) {
          if (pattern.test(sanitized)) {
            hasSQLInjection = true;
            sanitized = sanitized.replace(pattern, '');
          }
        }
        return sanitized;
      } else if (typeof value === 'object' && value !== null) {
        const sanitizedObj = Array.isArray(value) ? [] : {};
        for (const [key, val] of Object.entries(value)) {
          (sanitizedObj as any)[key] = sanitizeValue(val);
        }
        return sanitizedObj;
      }
      return value;
    };

    const sanitizedData = sanitizeValue(sanitized);
    return { hasSQLInjection, sanitizedData };
  }

  private sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .substring(0, 1000);
  }

  private sanitizeSymbol(symbol: string): string {
    // Allow common forex symbols and crypto pairs
    const symbolRegex = /^[A-Z]{3,6}[\/]?[A-Z]{3,6}$/;
    const cleanSymbol = symbol.replace(/[^A-Z\/]/g, '').toUpperCase();
    return symbolRegex.test(cleanSymbol) ? cleanSymbol : '';
  }

  private isPrototypePollution(obj: any): boolean {
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

  // Enhanced input sanitization with type-specific handling
  sanitizeInput(input: string, type: 'text' | 'code' | 'symbol' | 'url' | 'token' | 'search' | 'email' | 'html' = 'text'): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input.trim();

    switch (type) {
      case 'html':
        // Remove dangerous HTML tags while preserving basic formatting
        sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gis, '');
        sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gis, '');
        sanitized = sanitized.replace(/<object[^>]*>.*?<\/object>/gis, '');
        sanitized = sanitized.replace(/<embed[^>]*>.*?<\/embed>/gis, '');
        sanitized = sanitized.substring(0, 1000);
        break;

      case 'text':
        // Remove HTML tags and dangerous characters
        sanitized = sanitized.replace(/<[^>]*>/g, '');
        sanitized = sanitized.replace(/[<>]/g, '');
        sanitized = sanitized.substring(0, 1000);
        break;

      case 'code':
        // Allow code characters but remove dangerous patterns
        sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gis, '');
        sanitized = sanitized.replace(/javascript:/gi, '');
        sanitized = sanitized.substring(0, 50000);
        break;

      case 'symbol':
        // Only allow uppercase letters, numbers, and some special characters
        sanitized = sanitized.toUpperCase().replace(/[^A-Z0-9/]/g, '');
        sanitized = sanitized.substring(0, 10);
        break;

      case 'url':
        // Basic URL sanitization
        sanitized = sanitized.replace(/[<>'"]/g, '');
        if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
          sanitized = 'https://' + sanitized;
        }
        sanitized = sanitized.substring(0, 2048);
        break;

      case 'token':
        // Only allow alphanumeric and some special characters
        sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '');
        sanitized = sanitized.substring(0, 500);
        break;

      case 'search':
        // Allow search terms but limit dangerous characters
        sanitized = sanitized.replace(/[<>'"]/g, '');
        sanitized = sanitized.substring(0, 200);
        break;

      case 'email':
        // Basic email sanitization
        sanitized = sanitized.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
        sanitized = sanitized.substring(0, 254);
        break;
    }

    return sanitized;
  }

  // Safe JSON parsing with prototype pollution protection
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