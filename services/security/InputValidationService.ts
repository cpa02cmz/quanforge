/**
 * Input Validation Service
 * 
 * Handles all input validation, sanitization, and data security for the application.
 * This service ensures all incoming data is properly validated and sanitized.
 * 
 * @author QuantForge Security Team
 * @version 1.0.0
 */

import { Robot, StrategyParams, BacktestSettings } from '../../types';
import { securityUtils } from './SecurityUtilsService';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

export interface InputValidationConfig {
  maxPayloadSize: number;
  maxStringLength: {
    name: number;
    description: number;
    code: number;
    symbol: number;
    email: number;
  };
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
  };
}

/**
 * Input validation service for data sanitization and security validation
 */
export class InputValidationService {
  private static instance: InputValidationService;
  private config: InputValidationConfig;

  private constructor() {
    this.config = {
      maxPayloadSize: 5 * 1024 * 1024, // 5MB
      maxStringLength: {
        name: 100,
        description: 1000,
        code: 50000,
        symbol: 10,
        email: 254
      },
      riskThresholds: {
        low: 30,
        medium: 50,
        high: 70
      }
    };
  }

  static getInstance(): InputValidationService {
    if (!InputValidationService.instance) {
      InputValidationService.instance = new InputValidationService();
    }
    return InputValidationService.instance;
  }

  /**
   * Main validation orchestrator
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
      securityUtils.logSecurityEvent('ValidationError', { error, type });
    }

    return {
      isValid: errors.length === 0 && riskScore < this.config.riskThresholds.high,
      errors,
      sanitizedData,
      riskScore,
    };
  }

  /**
   * Validate robot-specific data
   */
  private validateRobotData(data: any): ValidationResult {
     const errors: string[] = [];
     let riskScore = 0;
     const sanitized: Partial<Robot> = {};

     // Prevent prototype pollution
     if (securityUtils.isPrototypePollution(data)) {
       errors.push('Prototype pollution detected');
       riskScore += 100;
       return { isValid: false, errors, riskScore: 100 };
     }

     // Name validation
     if (data.name) {
       const sanitizedName = securityUtils.sanitizeString(data.name);
       if (sanitizedName.length < 3 || sanitizedName.length > this.config.maxStringLength.name) {
         errors.push(`Robot name must be between 3 and ${this.config.maxStringLength.name} characters`);
         riskScore += 10;
       }
       sanitized.name = sanitizedName;
     } else {
       errors.push('Robot name is required');
       riskScore += 15;
     }

     // Description validation
     if (data.description) {
       const sanitizedDescription = securityUtils.sanitizeString(data.description);
       if (sanitizedDescription.length > this.config.maxStringLength.description) {
         errors.push(`Description too long (max ${this.config.maxStringLength.description} characters)`);
         riskScore += 5;
       }
       sanitized.description = sanitizedDescription;
     }

     // Code validation
     if (data.code) {
       const codeValidation = this.validateMQL5Code(data.code);
       if (!codeValidation.isValid) {
         errors.push(...codeValidation.errors);
         riskScore += codeValidation.errors.length * 10;
       }
       sanitized.code = codeValidation.sanitizedCode;
     } else {
       errors.push('Robot code is required');
       riskScore += 25;
     }

     // Strategy type validation
     if (data.strategy_type) {
       const validTypes = ['trend_following', 'mean_reversion', 'breakout', 'arbitrage', 'custom'];
       if (!validTypes.includes(data.strategy_type)) {
         errors.push('Invalid strategy type');
         riskScore += 10;
       }
       sanitized.strategy_type = data.strategy_type;
     }

     return {
       isValid: errors.length === 0 && riskScore < this.config.riskThresholds.medium,
       errors,
       sanitizedData: sanitized,
       riskScore,
     };
   }

   /**
   * Validate strategy-specific data
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
       if (!this.validateSymbol(sanitizedSymbol)) {
         errors.push('Invalid trading symbol');
         riskScore += 15;
       }
       sanitized.symbol = sanitizedSymbol;
     }

     // Risk percentage validation
     if (data.riskPercent !== undefined) {
       sanitized.riskPercent = Math.max(0.01, Math.min(100, data.riskPercent));
     }

     // Stop loss and take profit validation
     if (data.stopLoss !== undefined) {
       sanitized.stopLoss = Math.max(1, Math.min(1000, data.stopLoss));
     }
     if (data.takeProfit !== undefined) {
       sanitized.takeProfit = Math.max(1, Math.min(1000, data.takeProfit));
     }

     return {
       isValid: errors.length === 0 && riskScore < this.config.riskThresholds.medium,
       errors,
       sanitizedData: sanitized,
       riskScore,
     };
   }

   /**
   * Validate backtest-specific data
   */
   private validateBacktestData(data: any): ValidationResult {
     const errors: string[] = [];
     let riskScore = 0;
     const sanitized: Partial<BacktestSettings> = {};

     // Initial deposit validation
     if (data.initialDeposit !== undefined) {
       sanitized.initialDeposit = Math.max(100, Math.min(10000000, data.initialDeposit));
     }

     // Days validation
     if (data.days !== undefined) {
       sanitized.days = Math.max(1, Math.min(365, data.days));
     }

     // Leverage validation
     if (data.leverage !== undefined) {
       sanitized.leverage = Math.max(1, Math.min(1000, data.leverage));
     }

     // Symbol validation (optional field for backtest context)
     if (data.symbol) {
       const sanitizedSymbol = this.sanitizeSymbol(data.symbol);
       if (!this.validateSymbol(sanitizedSymbol)) {
         errors.push('Invalid trading symbol for backtest');
         riskScore += 10;
       }
       // Note: symbol is not part of BacktestSettings interface, but we can validate it
     }

     return {
       isValid: errors.length === 0 && riskScore < this.config.riskThresholds.medium,
       errors,
       sanitizedData: sanitized,
       riskScore,
     };
   }

   /**
   * Validate user-specific data
   */
   private validateUserData(data: any): ValidationResult {
     const errors: string[] = [];
     let riskScore = 0;
     const sanitized: any = {};

     // Email validation
     if (data.email) {
       if (!securityUtils.isValidEmail(data.email)) {
         errors.push('Invalid email format');
         riskScore += 20;
       }
       sanitized.email = data.email.toLowerCase().trim();
     }

     return {
       isValid: errors.length === 0 && riskScore < this.config.riskThresholds.low,
       errors,
       sanitizedData: sanitized,
       riskScore,
     };
   }

   /**
   * Validate MQL5 code for security issues
   */
   private validateMQL5Code(code: string): { isValid: boolean; errors: string[]; sanitizedCode: string } {
     const errors: string[] = [];
     let sanitizedCode = code;

     // Check for dangerous function calls
     const dangerousFunctions = [
       'SendFTP', 'SendMail', 'SendNotification', 'Sleep', 'ExpertRemove',
       'TerminalClose', 'ChartWindowFind', 'ChartScreenShot'
     ];

     dangerousFunctions.forEach(func => {
       const regex = new RegExp(`\\b${func}\\s*\\(`, 'gi');
       if (regex.test(sanitizedCode)) {
         errors.push(`Dangerous function ${func}() detected`);
         sanitizedCode = sanitizedCode.replace(regex, `// REMOVED_${func}(`);
       }
     });

     // Check for dangerous operations
     const dangerousOps = [
       { pattern: /FileOpen\s*\(/gi, message: 'File operations not allowed' },
       { pattern: /FileWrite\s*\(/gi, message: 'File operations not allowed' },
       { pattern: /FileDelete\s*\(/gi, message: 'File operations not allowed' },
       { pattern: /Registry\s+/gi, message: 'Registry operations not allowed' },
       { pattern: /Win32\s+/gi, message: 'Windows API calls not allowed' }
     ];

     dangerousOps.forEach(op => {
       if (op.pattern.test(sanitizedCode)) {
         errors.push(op.message);
         sanitizedCode = sanitizedCode.replace(op.pattern, `// SECURITY_BLOCKED: ${op.message}`);
       }
     });

     // Check for excessive complexity
     const lines = sanitizedCode.split('\n').length;
     if (lines > 5000) {
       errors.push('Code too large (max 5000 lines)');
     }

     return {
       isValid: errors.length === 0,
       errors,
       sanitizedCode
     };
   }

   /**
   * Prevent XSS attacks in data
   */
   private preventXSS(data: any): { hasXSS: boolean; sanitizedData: any } {
     let hasXSS = false;
     const sanitized = JSON.parse(JSON.stringify(data));

     const sanitizeValue = (value: any): any => {
if (typeof value === 'string') {
        const patterns = [
          /<script[^>]*>.*?<\/script>/gis,
          /javascript:/gi,
          /on\w+\s*=/gi,
          /<iframe[^>]*>/gi,
          /<object[^>]*>/gi,
          /<embed[^>]*>/gi
        ];

        patterns.forEach(pattern => {
          if (pattern.test(value)) {
            hasXSS = true;
            value = value.replace(pattern, '');
          }
        });

        return value;
      } else if (typeof value === 'object' && value !== null) {
        const result = Array.isArray(value) ? [] : {};
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            (result as any)[key] = sanitizeValue((value as any)[key]);
          }
        }
        return result;
      }
       return value;
     };

     return {
       hasXSS,
       sanitizedData: sanitizeValue(sanitized)
     };
   }

   /**
   * Prevent SQL injection attacks
   */
   private preventSQLInjection(data: any): { hasSQLInjection: boolean; sanitizedData: any } {
     let hasSQLInjection = false;
     const sanitized = JSON.parse(JSON.stringify(data));

     const sanitizeValue = (value: any): any => {
       if (typeof value === 'string') {
         const sqlPatterns = [
           /('|(\\')|(\'\\'))|(;)|(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|SELECT|UNION|UPDATE)\b)/gi,
           /\bOR\b.*?=.*?/gi,
           /\bAND\b.*?=.*?/gi,
           /--/,
           /\/\*/,
         ];

         sqlPatterns.forEach(pattern => {
           if (pattern.test(value)) {
             hasSQLInjection = true;
             value = value.replace(pattern, '');
           }
         });

         return value;
} else if (typeof value === 'object' && value !== null) {
        const result = Array.isArray(value) ? [] : {};
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            (result as any)[key] = sanitizeValue((value as any)[key]);
          }
        }
        return result;
      }
      return value;
     };

     return {
       hasSQLInjection,
       sanitizedData: sanitizeValue(sanitized)
     };
   }

   /**
   * Sanitize trading symbol
   */
   private sanitizeSymbol(symbol: string): string {
     return symbol.toUpperCase().replace(/[^A-Z0-9/]/g, '').substring(0, 10);
   }

   /**
   * Validate trading symbol format
   */
   validateSymbol(symbol: string): boolean {
     if (!symbol || typeof symbol !== 'string') return false;
     
     const sanitized = this.sanitizeSymbol(symbol);
     const validPrefixes = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'XAU', 'XAG'];
     const hasValidPrefix = validPrefixes.some(prefix => sanitized.startsWith(prefix));
     
     return sanitized.length >= 3 && sanitized.length <= 10 && hasValidPrefix;
   }

   /**
   * Enhanced input sanitization by type
   */
   sanitizeInput(input: string, type: 'text' | 'code' | 'symbol' | 'url' | 'token' | 'search' | 'email' | 'html' = 'text'): string {
     if (!input) return '';

     let sanitized = securityUtils.sanitizeString(input);

     switch (type) {
       case 'text':
         sanitized = sanitized.substring(0, 1000);
         break;
       case 'code':
         // Allow more characters for code but limit length
         sanitized = sanitized.replace(/<\?php/g, '// PHP_BLOCKED');
         sanitized = sanitized.substring(0, 50000);
         break;
       case 'symbol':
         sanitized = sanitized.toUpperCase().replace(/[^A-Z0-9/]/g, '');
         sanitized = sanitized.substring(0, 10);
         break;
       case 'url':
         const cleanUrl = sanitized.replace(/[<>'"]/g, '');
         if (!cleanUrl.startsWith('http')) {
           sanitized = 'https://' + cleanUrl;
         } else {
           sanitized = cleanUrl;
         }
         sanitized = sanitized.substring(0, 2048);
         break;
       case 'token':
         sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '');
         sanitized = sanitized.substring(0, 500);
         break;
       case 'search':
         sanitized = sanitized.replace(/[<>'"]/g, '');
         sanitized = sanitized.substring(0, 200);
         break;
       case 'email':
         sanitized = sanitized.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
         sanitized = sanitized.substring(0, 254);
         break;
       case 'html':
         // For HTML, we remove all tags
         sanitized = sanitized.replace(/<[^>]*>/g, '');
         sanitized = sanitized.replace(/[<>]/g, '');
         sanitized = sanitized.substring(0, 1000);
         break;
     }

     return sanitized;
   }

   /**
   * Quick validation based on input type
   */
   validateInput(input: any, type: 'search' | 'record' | 'robot' | 'strategy' | 'backtest' | 'user' | 'text' | 'code' | 'symbol' | 'url' | 'token' | 'html' = 'text'): boolean {
     if (input === null || input === undefined) {
       return false;
     }
     
     // Use existing validation methods based on type
     switch (type) {
       case 'search':
         const searchValidation = this.sanitizeAndValidate({ searchTerm: input }, 'strategy');
         return searchValidation.isValid && searchValidation.riskScore < this.config.riskThresholds.low;
         
       case 'record':
         const recordValidation = this.sanitizeAndValidate(input, 'robot');
         return recordValidation.isValid && recordValidation.riskScore < this.config.riskThresholds.medium;
         
       case 'robot':
         return this.sanitizeAndValidate(input, 'robot').isValid;
         
       case 'strategy':
         return this.sanitizeAndValidate(input, 'strategy').isValid;
         
       case 'backtest':
         return this.sanitizeAndValidate(input, 'backtest').isValid;
         
       case 'user':
         return this.sanitizeAndValidate(input, 'user').isValid;
         
       default:
         // For simple types, just check basic validity
         return typeof input === 'string' && input.length > 0 && input.length <= this.config.maxStringLength.name;
     }
   }

   /**
   * Get current configuration
   */
   getConfig(): InputValidationConfig {
     return { ...this.config };
   }

   /**
   * Update configuration
   */
   updateConfig(newConfig: Partial<InputValidationConfig>): void {
     this.config = { ...this.config, ...newConfig };
   }
}

// Export singleton instance for convenience
export const inputValidation = InputValidationService.getInstance();