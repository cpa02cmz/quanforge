import { SecurityConfig } from '../configurationService';
import { STRING_LIMITS } from '../constants';
import { SECURITY_RISK_SCORES } from '../modularConstants';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

export class InputValidator {
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
        riskScore += SECURITY_RISK_SCORES.INPUT_VALIDATION.ROBOT_NAME_INVALID;
      }

      // Basic structure validation
      if (!data || typeof data !== 'object') {
        errors.push('Invalid data structure');
        return { isValid: false, errors, riskScore: SECURITY_RISK_SCORES.MAX_SCORE };
      }

      // Type-specific validation
      switch (type) {
        case 'robot': {
          const robotResult = this.validateRobotData(data);
          errors.push(...robotResult.errors);
          sanitizedData = robotResult.sanitizedData;
          riskScore += robotResult.riskScore;
          break;
        }

        case 'strategy': {
          const strategyResult = this.validateStrategyData(data);
          errors.push(...strategyResult.errors);
          sanitizedData = strategyResult.sanitizedData;
          riskScore += strategyResult.riskScore;
          break;
        }

        case 'backtest': {
          const backtestResult = this.validateBacktestData(data);
          errors.push(...backtestResult.errors);
          sanitizedData = backtestResult.sanitizedData;
          riskScore += backtestResult.riskScore;
          break;
        }

        case 'user': {
          const userResult = this.validateUserData(data);
          errors.push(...userResult.errors);
          sanitizedData = userResult.sanitizedData;
          riskScore += userResult.riskScore;
          break;
        }
      }

    } catch (error: unknown) {
      errors.push(`Validation error: ${error}`);
      riskScore += SECURITY_RISK_SCORES.SEVERITY.MEDIUM;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData,
      riskScore
    };
  }

  private validateRobotData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    // Check required fields
    if (!data.name || typeof data.name !== 'string') {
      errors.push('Robot name is required and must be a string');
      riskScore += SECURITY_RISK_SCORES.INPUT_VALIDATION.ROBOT_NAME_INVALID;
    }

    if (data.code) {
      const codeValidation = this.validateMQL5Code(data.code);
      if (!codeValidation.isValid) {
        errors.push(...codeValidation.errors);
        riskScore += SECURITY_RISK_SCORES.INPUT_VALIDATION.USER_ID_MALICIOUS;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: this.sanitizeRobotData(data),
      riskScore
    };
  }

  private validateMQL5Code(code: string): { isValid: boolean; errors: string[]; sanitizedCode: string } {
    const errors: string[] = [];
    const sanitizedCode = code;

    // Check for dangerous functions
    const dangerousFunctions = [
      'SystemExec', 'ShellExecute', 'WinExec', 'CreateFile', 
      'DeleteFile', 'CopyFile', 'MoveFile', 'Sendmessage',
      'RegCreateKey', 'RegSetValue', 'RegDeleteKey'
    ];

    for (const func of dangerousFunctions) {
      if (code.includes(func)) {
        errors.push(`Dangerous function detected: ${func}`);
      }
    }

    // Check for network operations
    const networkFunctions = ['InternetOpen', 'InternetConnect', 'HttpOpenRequest', 'HttpSendRequest'];
    for (const func of networkFunctions) {
      if (code.includes(func)) {
        errors.push(`Network function detected: ${func}`);
      }
    }

    // Basic MQL5 structure validation
    if (!code.includes('void OnInit()') && !code.includes('int OnInit()')) {
      errors.push('Missing OnInit function');
    }

    if (!code.includes('void OnTick()') && !code.includes('void OnTimer()')) {
      errors.push('Missing OnTick or OnTimer function');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedCode
    };
  }

  private validateStrategyData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    if (!data.timeframe || typeof data.timeframe !== 'string') {
      errors.push('Invalid timeframe');
      riskScore += SECURITY_RISK_SCORES.INPUT_VALIDATION.CODE_LENGTH_EXCEEDED;
    }

    if (data.riskLevel && (data.riskLevel < 1 || data.riskLevel > 10)) {
      errors.push('Risk level must be between 1 and 10');
      riskScore += SECURITY_RISK_SCORES.INPUT_VALIDATION.ROBOT_NAME_LENGTH_EXCEEDED;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: this.sanitizeStrategyData(data),
      riskScore
    };
  }

  private validateBacktestData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    if (data.startDate && !this.isValidDate(data.startDate)) {
      errors.push('Invalid start date');
      riskScore += SECURITY_RISK_SCORES.INPUT_VALIDATION.CODE_LENGTH_EXCEEDED;
    }

    if (data.endDate && !this.isValidDate(data.endDate)) {
      errors.push('Invalid end date');
      riskScore += SECURITY_RISK_SCORES.INPUT_VALIDATION.CODE_LENGTH_EXCEEDED;
    }

    if (data.initialBalance && (data.initialBalance < 0 || !Number.isFinite(data.initialBalance))) {
      errors.push('Invalid initial balance');
      riskScore += SECURITY_RISK_SCORES.INPUT_VALIDATION.ROBOT_NAME_LENGTH_EXCEEDED;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: this.sanitizeBacktestData(data),
      riskScore
    };
  }

  private validateUserData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Invalid email format');
      riskScore += SECURITY_RISK_SCORES.INPUT_VALIDATION.CODE_LENGTH_EXCEEDED;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: this.sanitizeUserData(data),
      riskScore
    };
  }

  // Sanitization methods
  private sanitizeRobotData(robot: any): any {
    return {
      ...robot,
      name: this.sanitizeString(robot.name || ''),
      description: this.sanitizeString(robot.description || ''),
      code: robot.code || ''
    };
  }

  private sanitizeStrategyData(strategy: any): any {
    return {
      ...strategy,
      timeframe: this.sanitizeString(strategy.timeframe || ''),
      description: this.sanitizeString(strategy.description || '')
    };
  }

  private sanitizeBacktestData(backtest: any): any {
    return {
      ...backtest,
      symbol: this.sanitizeSymbol(backtest.symbol || '')
    };
  }

  private sanitizeUserData(user: any): any {
    return {
      ...user,
      email: user.email ? user.email.toLowerCase().trim() : ''
    };
  }

  private sanitizeString(input: string): string {
    return input.replace(/<[^>]*>/g, '').substring(0, STRING_LIMITS.MAX_LENGTH);
  }

  private sanitizeSymbol(symbol: string): string {
    return symbol.replace(/[^A-Z0-9_]/g, '').toUpperCase().substring(0, STRING_LIMITS.DISPLAY_SHORT);
  }

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}