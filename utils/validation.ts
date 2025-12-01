import { StrategyParams, CustomInput, BacktestSettings } from '../types';

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationService {
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

   static validateStrategyParams(params: StrategyParams): ValidationError[] {
     const errors: ValidationError[] = [];

     // Validate timeframe - use Set for O(1) lookup
     const TIMEFRAMES_SET = new Set(this.TIMEFRAMES);
     if (!TIMEFRAMES_SET.has(params.timeframe)) {
       errors.push({
         field: 'timeframe',
         message: `Invalid timeframe. Must be one of: ${this.TIMEFRAMES.join(', ')}`
       });
     }

     // Validate symbol
     if (!params.symbol) {
       errors.push({
         field: 'symbol',
         message: 'Symbol is required'
       });
     } else {
       // Optimize regex by pre-processing the string
       const cleanSymbol = params.symbol.replace('USDT', '').replace('BUSD', '');
       if (!this.SYMBOL_REGEX.test(cleanSymbol)) {
         errors.push({
           field: 'symbol',
           message: 'Invalid symbol format. Use format like BTCUSDT, EUR/USD, XAUUSD'
         });
       }
     }

     // Validate risk percent - single check with bounds
     if (params.riskPercent < this.MIN_RISK_PERCENT || params.riskPercent > this.MAX_RISK_PERCENT) {
       errors.push({
         field: 'riskPercent',
         message: `Risk percent must be between ${this.MIN_RISK_PERCENT} and ${this.MAX_RISK_PERCENT}`
       });
     }

     // Validate stop loss
     if (params.stopLoss < this.MIN_STOP_LOSS || params.stopLoss > this.MAX_STOP_LOSS) {
       errors.push({
         field: 'stopLoss',
         message: `Stop loss must be between ${this.MIN_STOP_LOSS} and ${this.MAX_STOP_LOSS} pips`
       });
     }

     // Validate take profit
     if (params.takeProfit < this.MIN_TAKE_PROFIT || params.takeProfit > this.MAX_TAKE_PROFIT) {
       errors.push({
         field: 'takeProfit',
         message: `Take profit must be between ${this.MIN_TAKE_PROFIT} and ${this.MAX_TAKE_PROFIT} pips`
       });
     }

     // Validate magic number
     if (params.magicNumber < this.MIN_MAGIC_NUMBER || params.magicNumber > this.MAX_MAGIC_NUMBER) {
       errors.push({
         field: 'magicNumber',
         message: `Magic number must be between ${this.MIN_MAGIC_NUMBER} and ${this.MAX_MAGIC_NUMBER}`
       });
     }

     // Validate custom inputs - optimize duplicate checking
     const seenNames = new Set<string>();
     for (let index = 0; index < params.customInputs.length; index++) {
       const input = params.customInputs[index];
       const prefix = `customInputs[${index}]`;
       
       if (!input.name || !input.name.trim()) {
         errors.push({
           field: `${prefix}.name`,
           message: 'Custom input name is required'
         });
         continue; // Skip further validation for invalid names
       }
       
       if (!this.NAME_REGEX.test(input.name)) {
         errors.push({
           field: `${prefix}.name`,
           message: 'Invalid name format. Use letters, numbers, and underscores only, starting with a letter or underscore'
         });
       }

       // Check for duplicate names using Set for O(1) lookup
       if (seenNames.has(input.name)) {
         errors.push({
           field: `${prefix}.name`,
           message: `Duplicate input name: "${input.name}"`
         });
       } else {
         seenNames.add(input.name);
       }

       // Validate value based on type
       if (input.type === 'int') {
         const value = parseInt(input.value, 10);
         if (isNaN(value) || value < -2147483648 || value > 2147483647) {
           errors.push({
             field: `${prefix}.value`,
             message: 'Invalid integer value'
           });
         }
       } else if (input.type === 'double') {
         const value = parseFloat(input.value);
         if (isNaN(value) || !isFinite(value)) {
           errors.push({
             field: `${prefix}.value`,
             message: 'Invalid number value'
           });
         }
       } else if (input.type === 'bool') {
         if (input.value !== 'true' && input.value !== 'false') {
           errors.push({
             field: `${prefix}.value`,
             message: 'Boolean value must be "true" or "false"'
           });
         }
       }
     }

     return errors;
   }

  static validateBacktestSettings(settings: BacktestSettings): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate initial deposit
    if (settings.initialDeposit < this.MIN_INITIAL_DEPOSIT || settings.initialDeposit > this.MAX_INITIAL_DEPOSIT) {
      errors.push({
        field: 'initialDeposit',
        message: `Initial deposit must be between $${this.MIN_INITIAL_DEPOSIT} and $${this.MAX_INITIAL_DEPOSIT}`
      });
    }

    // Validate duration
    if (settings.days < this.MIN_DURATION || settings.days > this.MAX_DURATION) {
      errors.push({
        field: 'days',
        message: `Duration must be between ${this.MIN_DURATION} and ${this.MAX_DURATION} days`
      });
    }

    // Validate leverage
    if (settings.leverage < this.MIN_LEVERAGE || settings.leverage > this.MAX_LEVERAGE) {
      errors.push({
        field: 'leverage',
        message: `Leverage must be between ${this.MIN_LEVERAGE} and ${this.MAX_LEVERAGE}`
      });
    }

    return errors;
  }

  static validateRobotName(name: string): ValidationError[] {
    const errors: ValidationError[] = [];

     if (!name || !name.trim()) {
       errors.push({
         field: 'name',
         message: 'Robot name is required'
       });
       return errors; // Return early if name is empty
     }

     if (name.length < 3) {
       errors.push({
         field: 'name',
         message: 'Robot name must be at least 3 characters long'
       });
     } else if (name.length > 100) {
       errors.push({
         field: 'name',
         message: 'Robot name must not exceed 100 characters'
       });
     }

    return errors;
  }

   static validateChatMessage(message: string): ValidationError[] {
      const errors: ValidationError[] = [];

      if (!message || !message.trim()) {
        errors.push({
          field: 'message',
          message: 'Message cannot be empty'
        });
      } else if (message.length > 10000) {
        errors.push({
          field: 'message',
          message: 'Message is too long (max 10,000 characters)'
        });
      }

      // Enhanced XSS prevention with more patterns
      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /on\w+\s*=/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
        /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
        /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
        /eval\s*\(/gi,
        /expression\s*\(/gi,
        /<link[^>]+rel=["']stylesheet["']/gi,
        /<meta[^>]+http-equiv=["']refresh["']/gi,
        /data:text\/html/gi,
        /<svg[^>]*onload=/gi,
        /<img[^>]*src[\s]*=[\s]*["'][\s]*(javascript:|data:)/gi,
        /<a[^>]*href[\s]*=[\s]*["'][\s]*javascript:/gi,
        /&#x?0*(58|106|0*74|0*42|0*6a);?/gi,  // Hex/decimal encoded chars
         /\/\*.*\*\/|<%.*%>|<\?php?.*?\?>/gi,  // Comments and server-side code
        /<style[^>]*>.*?<(?:\/|\\\/)style>/gi,  // Embedded styles
      ];

       for (const pattern of xssPatterns) {
         if (pattern.test(message)) {
           errors.push({
             field: 'message',
             message: 'Message contains potentially unsafe content'
           });
           break;
         }
       }

       // Additional content validation for MQL5-specific security
       const mql5DangerousPatterns = [
         /#include\s+<\s*(?!stdlib\.h|stdstring\.h|stdfile\.h|stdstringarray\.h|chart\.h|terminal\.h|trade\.h|fxt\.h|resource\.h)/i,
         /Import\s+/i,
         /ResourceCreate/i,
         /ResourceSave/i,
         /FileFindFirst|FileFindNext|FileFindClose/i,
         /WebRequest/i,
         /ShellExecute|ShellExecuteW/i,
         /GlobalVariables.*|GlobalVariable.*|GlobalVariableListDelete/i,
         /TerminalInfo.*|MQLInfo.*|MqlInfoInteger/i,
       ];

       for (const pattern of mql5DangerousPatterns) {
         if (pattern.test(message)) {
           errors.push({
             field: 'message',
             message: 'Message contains potentially dangerous MQL5 operations'
           });
           break;
         }
       }

         return errors;
       }

  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  }

  static isValid(errors: ValidationError[]): boolean {
    return errors.length === 0;
  }

  static formatErrors(errors: ValidationError[]): string {
    return errors.map(error => `${error.field}: ${error.message}`).join('\n');
  }
}