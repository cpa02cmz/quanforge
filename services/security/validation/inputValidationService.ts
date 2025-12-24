import { Robot, StrategyParams, BacktestSettings } from '../../../types';
import DOMPurify from 'dompurify';

interface ValidationConfig {
  maxLength: {
    name: number;
    description: number;
    code: number;
  };
  validation: {
    maxPayloadSize: number;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

interface MQL5ValidationResult {
  isValid: boolean;
  errors: string[];
  riskScore: number;
}

interface ThreatDetectionResult {
  hasXSS: boolean;
  hasSQLInjection: boolean;
  riskScore: number;
}

export class InputValidationService {
  private static instance: InputValidationService;
  private config: ValidationConfig;

  private constructor() {
    this.config = {
      maxLength: {
        name: 100,
        description: 1000,
        code: 100000,
      },
      validation: {
        maxPayloadSize: 5 * 1024 * 1024, // 5MB
      }
    };
  }

  static getInstance(): InputValidationService {
    if (!InputValidationService.instance) {
      InputValidationService.instance = new InputValidationService();
    }
    return InputValidationService.instance;
  }

  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    const errors: string[] = [];
    let sanitizedData = data;
    let riskScore = 0;

    try {
      // Check payload size
      const payloadSize = new Blob([JSON.stringify(data)]).size;
      if (payloadSize > this.config.validation.maxPayloadSize) {
        errors.push(`Payload too large: ${payloadSize} bytes (max: ${this.config.validation.maxPayloadSize})`);
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

      // Final XSS and SQL injection check
      const xssResult = this.detectXSSThreats(JSON.stringify(sanitizedData));
      if (xssResult.hasXSS) {
        errors.push('Potential XSS threat detected');
        riskScore += 60;
      }

      const sqlResult = this.detectSQLInjectionThreats(JSON.stringify(sanitizedData));
      if (sqlResult.hasSQLInjection) {
        errors.push('Potential SQL injection threat detected');
        riskScore += 70;
      }

      // Check for prototype pollution
      if (this.isPrototypePollution(sanitizedData)) {
        errors.push('Prototype pollution attempt detected');
        riskScore += 80;
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData,
        riskScore: Math.min(riskScore, 100)
      };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors, riskScore: 100 };
    }
  }

  private validateRobotData(data: Partial<Robot>): ValidationResult {
    const errors: string[] = [];
    let sanitizedData = { ...data };
    let riskScore = 0;

    // Name validation
    if (data.name) {
      const sanitizedName = this.sanitizeText(data.name);
      if (sanitizedName.length < 3 || sanitizedName.length > this.config.maxLength.name) {
        errors.push(`Robot name must be between 3 and ${this.config.maxLength.name} characters`);
        riskScore += 20;
      }
      sanitizedData.name = sanitizedName;
    }

    // Description validation
    if (data.description) {
      const sanitizedDescription = this.sanitizeText(data.description);
      if (sanitizedDescription.length > this.config.maxLength.description) {
        errors.push(`Description too long (max ${this.config.maxLength.description} characters)`);
        riskScore += 10;
      }
      sanitizedData.description = sanitizedDescription;
    }

    // Code validation
    if (data.code) {
      const codeValidation = this.validateMQL5Code(data.code);
      if (!codeValidation.isValid) {
        errors.push(...codeValidation.errors);
        riskScore += codeValidation.riskScore;
        sanitizedData.code = this.sanitizeCode(data.code);
      }
    }

    // Strategy type validation
    if (data.strategy_type) {
      const validTypes = ['trend_following', 'mean_reversion', 'breakout', 'scalping', 'swing'];
      if (!validTypes.includes(data.strategy_type)) {
        errors.push('Invalid strategy type');
        riskScore += 15;
      }
    }

    // Validate strategy parameters
    if (data.strategy_params) {
      const strategyValidation = this.validateStrategyParams(data.strategy_params);
      errors.push(...strategyValidation.errors);
      riskScore += strategyValidation.riskScore;
    }

    return { isValid: errors.length === 0, errors, sanitizedData, riskScore };
  }

  private validateStrategyData(data: StrategyParams): ValidationResult {
    const errors: string[] = [];
    let sanitizedData = { ...data };
    let riskScore = 0;

    // Timeframe validation
    if (data.timeframe) {
      const validTimeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];
      if (!validTimeframes.includes(data.timeframe)) {
        errors.push('Invalid timeframe');
        riskScore += 15;
      }
    }

    // Symbol validation
    if (data.symbol) {
      const sanitizedSymbol = this.validateSymbol(data.symbol);
      if (!sanitizedSymbol) {
        errors.push('Invalid trading symbol');
        riskScore += 20;
      } else {
        sanitizedData.symbol = sanitizedSymbol;
      }
    }

    // Risk parameters validation
    if (data.stopLoss && data.stopLoss < 1) {
      errors.push('Stop loss must be at least 1 pip');
      riskScore += 10;
    }

    if (data.takeProfit && data.takeProfit < 1) {
      errors.push('Take profit must be at least 1 pip');
      riskScore += 10;
    }

    return { isValid: errors.length === 0, errors, sanitizedData, riskScore };
  }

  private validateBacktestData(data: BacktestSettings): ValidationResult {
    const errors: string[] = [];
    let sanitizedData = { ...data };
    let riskScore = 0;

    // Days validation
    if (data.days && data.days < 1) {
      errors.push('Backtest duration must be at least 1 day');
      riskScore += 10;
    }

    if (data.days && data.days > 365 * 5) { // 5 years max
      errors.push('Backtest duration too large (max 5 years)');
      riskScore += 10;
    }

    // Initial deposit validation
    if (data.initialDeposit) {
      const balance = parseFloat(data.initialDeposit.toString());
      if (isNaN(balance) || balance < 100 || balance > 1000000) {
        errors.push('Initial deposit must be between 100 and 1,000,000');
        riskScore += 15;
      }
    }

    // Leverage validation
    if (data.leverage && (data.leverage < 1 || data.leverage > 1000)) {
      errors.push('Leverage must be between 1 and 1000');
      riskScore += 10;
    }

    return { isValid: errors.length === 0, errors, sanitizedData, riskScore };
  }

  private validateUserData(data: any): ValidationResult {
    const errors: string[] = [];
    let sanitizedData = { ...data };
    let riskScore = 0;

    // Email validation
    if (data.email) {
      const sanitizedEmail = this.sanitizeText(data.email).toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(sanitizedEmail)) {
        errors.push('Invalid email format');
        riskScore += 15;
      }
      sanitizedData.email = sanitizedEmail;
    }

    // General text field validation
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'string' && key !== 'email') {
        sanitizedData[key] = this.sanitizeText(data[key]);
      }
    });

    return { isValid: errors.length === 0, errors, sanitizedData, riskScore };
  }

  private validateStrategyParams(params: StrategyParams): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    // Validate numeric parameters
    const numericParams = ['stopLoss', 'takeProfit', 'riskPercent'];
    numericParams.forEach(param => {
      if (params[param as keyof StrategyParams] !== undefined) {
        const value = parseFloat(params[param as keyof StrategyParams] as string);
        if (isNaN(value) || value < 0) {
          errors.push(`${param} must be a positive number`);
          riskScore += 10;
        }
      }
    });

    return { isValid: errors.length === 0, errors, sanitizedData: params, riskScore };
  }

  private validateMQL5Code(code: string): MQL5ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    // Dangerous patterns in MQL5
    const dangerousPatterns = [
      {
        pattern: /system\s*\(/gi,
        description: 'System calls'
      },
      {
        pattern: /exec\s*\(/gi,
        description: 'Execution commands'
      },
      {
        pattern: /shell\s*\(/gi,
        description: 'Shell access'
      },
      {
        pattern: /import\s+.*User32/gi,
        description: 'DLL imports'
      },
      {
        pattern: /SendNotification\s*\(/gi,
        description: 'External notifications'
      },
      {
        pattern: /WebRequest\s*\(/gi,
        description: 'Web requests'
      },
      {
        pattern: /FileOpen\s*\(/gi,
        description: 'File operations'
      },
      {
        pattern: /Registry_\w+/gi,
        description: 'Registry access'
      }
    ];

    dangerousPatterns.forEach(({ pattern, description }) => {
      if (pattern.test(code)) {
        errors.push(`Dangerous pattern detected: ${description}`);
        riskScore += 20;
      }
    });

    // Code structure validation
    if (!code.includes('OnInit') || !code.includes('OnTick') || !code.includes('OnDeinit')) {
      errors.push('Missing required MQL5 functions (OnInit, OnTick, OnDeinit)');
      riskScore += 25;
    }

    return {
      isValid: errors.length === 0,
      errors,
      riskScore: Math.min(riskScore, 100)
    };
  }

  private validateSymbol(symbol: string): string | null {
    // Sanitize and validate forex symbol format
    const sanitized = this.sanitizeText(symbol).toUpperCase();
    const symbolRegex = /^[A-Z]{6}$/; // Standard forex format (e.g., EURUSD)
    
    if (symbolRegex.test(sanitized)) {
      return sanitized;
    }
    
    return null;
  }

  private detectXSSThreats(input: string): ThreatDetectionResult {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi
    ];

    let hasXSS = false;
    let riskScore = 0;

    xssPatterns.forEach(pattern => {
      if (pattern.test(input)) {
        hasXSS = true;
        riskScore += 10;
      }
    });

    return { hasXSS, hasSQLInjection: false, riskScore };
  }

  private detectSQLInjectionThreats(input: string): ThreatDetectionResult {
    const sqlPatterns = [
      /(\b UNION \b|\b SELECT \b|\b INSERT \b|\b UPDATE \b|\b DELETE \b|\b DROP \b|\b CREATE \b|\b ALTER \b|\b EXEC \b)/gi,
      /(--|\*\/|\/\*)/g,
      /(\b OR \b.*=.*\b OR \b)/gi,
      /(\b AND \b.*=.*\b AND \b)/gi,
      /('|'|''|;)/gi,
      /(\b WAITFOR \b|\b DELAY \b)/gi,
      /(\b xp_cmdshell \b|\b sp_executesql \b)/gi
    ];

    let hasSQLInjection = false;
    let riskScore = 0;

    sqlPatterns.forEach(pattern => {
      if (pattern.test(input)) {
        hasSQLInjection = true;
        riskScore += 15;
      }
    });

    return { hasXSS: false, hasSQLInjection, riskScore };
  }

  private isPrototypePollution(obj: any): boolean {
    if (obj && typeof obj === 'object') {
      const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
      return dangerousKeys.some(key => key in obj);
    }
    return false;
  }

  private sanitizeText(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  }

  private sanitizeCode(input: string): string {
    // Sanitize code but preserve MQL5 syntax
    return input
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/<!--.*?-->/gs, '') // Remove HTML comments
      .replace(/<[^>]*>/g, ''); // Remove HTML tags
  }
}