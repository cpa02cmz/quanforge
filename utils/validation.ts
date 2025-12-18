import DOMPurify from 'dompurify';
import { StrategyParams, BacktestSettings, CustomInput } from '../types';

// Validation Interfaces
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Validation Constants
const VALIDATION_CONSTANTS = {
  TIMEFRAMES: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'],
  SYMBOL_REGEX: /^[A-Z]{3,6}[\/]?[A-Z]{3,6}$/,
  NAME_REGEX: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  MAX_RISK_PERCENT: 100,
  MIN_RISK_PERCENT: 0.01,
  MAX_STOP_LOSS: 1000,
  MIN_STOP_LOSS: 1,
  MAX_TAKE_PROFIT: 1000,
  MIN_TAKE_PROFIT: 1,
  MAX_MAGIC_NUMBER: 999999,
  MIN_MAGIC_NUMBER: 1,
  MAX_INITIAL_DEPOSIT: 10000000,
  MIN_INITIAL_DEPOSIT: 100,
  MAX_DURATION: 365,
  MIN_DURATION: 1,
  MAX_LEVERAGE: 1000,
  MIN_LEVERAGE: 1,
  MAX_CHAT_LENGTH: 5000,
  MIN_CHAT_LENGTH: 3,
  MAX_API_KEY_LENGTH: 200,
  MIN_API_KEY_LENGTH: 10,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 50,
  MAX_LOCAL_STORAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILENAME_LENGTH: 255
};

// Rate Limiter
class RateLimiter {
  private static instance = new Map<string, { count: number; resetTime: number }>();

  static checkLimit(key: string, maxRequests: number = VALIDATION_CONSTANTS.MAX_REQUESTS_PER_WINDOW): boolean {
    const now = Date.now();
    const record = this.instance.get(key);
    
    if (!record || now > record.resetTime) {
      this.instance.set(key, { count: 1, resetTime: now + VALIDATION_CONSTANTS.RATE_LIMIT_WINDOW });
      return true;
    }
    
    if (record.count >= maxRequests) {
      return false;
    }
    
    record.count++;
    return true;
  }

  static reset(key: string): void {
    this.instance.delete(key);
  }
}

// Base Validation Functions
export function validateRequired(value: unknown, fieldName: string): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: false,
      errors: [{ field: fieldName, message: `${fieldName} is required` }]
    };
  }
  return { isValid: true, errors: [] };
}

export function validateRange(
  value: number,
  fieldName: string,
  min: number,
  max: number
): ValidationResult {
  if (value < min || value > max) {
    return {
      isValid: false,
      errors: [{ 
        field: fieldName, 
        message: `${fieldName} must be between ${min} and ${max}` 
      }]
    };
  }
  return { isValid: true, errors: [] };
}

export function validateRegex(value: string, fieldName: string, regex: RegExp): ValidationResult {
  if (!regex.test(value)) {
    return {
      isValid: false,
      errors: [{ 
        field: fieldName, 
        message: `${fieldName} format is invalid` 
      }]
    };
  }
  return { isValid: true, errors: [] };
}

export function validateInSet(value: string, fieldName: string, validSet: string[]): ValidationResult {
  if (!validSet.includes(value)) {
    return {
      isValid: false,
      errors: [{ 
        field: fieldName, 
        message: `${fieldName} must be one of: ${validSet.join(', ')}` 
      }]
    };
  }
  return { isValid: true, errors: [] };
}

// Specialized Validation Functions
export function validateSymbol(symbol: string): ValidationResult {
  return validateRegex(symbol, 'Symbol', VALIDATION_CONSTANTS.SYMBOL_REGEX);
}

export function validateApiKey(apiKey: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Check required
  const requiredResult = validateRequired(apiKey, 'API Key');
  if (!requiredResult.isValid) {
    return requiredResult;
  }

  // Check length
  if (apiKey.length < VALIDATION_CONSTANTS.MIN_API_KEY_LENGTH || 
      apiKey.length > VALIDATION_CONSTANTS.MAX_API_KEY_LENGTH) {
    errors.push({
      field: 'API Key',
      message: `API key must be between ${VALIDATION_CONSTANTS.MIN_API_KEY_LENGTH} and ${VALIDATION_CONSTANTS.MAX_API_KEY_LENGTH} characters`
    });
  }

  // Check for valid characters (alphanumeric and some special chars)
  const apiKeyRegex = /^[a-zA-Z0-9\-_\.]+$/;
  if (!apiKeyRegex.test(apiKey)) {
    errors.push({
      field: 'API Key',
      message: 'API key contains invalid characters'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateChatMessage(message: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Check required
  const requiredResult = validateRequired(message, 'Message');
  if (!requiredResult.isValid) {
    return requiredResult;
  }

  // Check length
  if (message.length < VALIDATION_CONSTANTS.MIN_CHAT_LENGTH || 
      message.length > VALIDATION_CONSTANTS.MAX_CHAT_LENGTH) {
    errors.push({
      field: 'Message',
      message: `Message must be between ${VALIDATION_CONSTANTS.MIN_CHAT_LENGTH} and ${VALIDATION_CONSTANTS.MAX_CHAT_LENGTH} characters`
    });
  }

  // Rate limiting
  const clientIp = 'user'; // In a real app, this would be actual IP or user ID
  if (!RateLimiter.checkLimit(clientIp)) {
    errors.push({
      field: 'Message',
      message: 'Too many messages. Please wait before sending another message.'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false
  });
}

export function validateFileName(filename: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Check required
  const requiredResult = validateRequired(filename, 'Filename');
  if (!requiredResult.isValid) {
    return requiredResult;
  }

  // Check length
  if (filename.length > VALIDATION_CONSTANTS.MAX_FILENAME_LENGTH) {
    errors.push({
      field: 'Filename',
      message: `Filename must be less than ${VALIDATION_CONSTANTS.MAX_FILENAME_LENGTH} characters`
    });
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(filename)) {
    errors.push({
      field: 'Filename',
      message: 'Filename contains invalid characters'
    });
  }

  // Check for reserved names (Windows)
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  const nameWithoutExt = filename.split('.')[0]?.toUpperCase();
  if (nameWithoutExt && reservedNames.includes(nameWithoutExt)) {
    errors.push({
      field: 'Filename',
      message: 'Filename is reserved and cannot be used'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Strategy-specific validation
export function validateStrategyParams(params: StrategyParams): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate timeframe
  const timeframeResult = validateInSet(params.timeframe, 'Timeframe', VALIDATION_CONSTANTS.TIMEFRAMES);
  if (!timeframeResult.isValid) {
    errors.push(...timeframeResult.errors);
  }

  // Validate symbol
  const symbolResult = validateSymbol(params.symbol);
  if (!symbolResult.isValid) {
    errors.push(...symbolResult.errors);
  }

  // Validate risk percentage
  const riskResult = validateRange(
    params.riskPercent,
    'Risk Percentage',
    VALIDATION_CONSTANTS.MIN_RISK_PERCENT,
    VALIDATION_CONSTANTS.MAX_RISK_PERCENT
  );
  if (!riskResult.isValid) {
    errors.push(...riskResult.errors);
  }

  // Validate stop loss
  const slResult = validateRange(
    params.stopLoss,
    'Stop Loss',
    VALIDATION_CONSTANTS.MIN_STOP_LOSS,
    VALIDATION_CONSTANTS.MAX_STOP_LOSS
  );
  if (!slResult.isValid) {
    errors.push(...slResult.errors);
  }

  // Validate take profit
  const tpResult = validateRange(
    params.takeProfit,
    'Take Profit',
    VALIDATION_CONSTANTS.MIN_TAKE_PROFIT,
    VALIDATION_CONSTANTS.MAX_TAKE_PROFIT
  );
  if (!tpResult.isValid) {
    errors.push(...tpResult.errors);
  }

  // Validate magic number
  const magicResult = validateRange(
    params.magicNumber,
    'Magic Number',
    VALIDATION_CONSTANTS.MIN_MAGIC_NUMBER,
    VALIDATION_CONSTANTS.MAX_MAGIC_NUMBER
  );
  if (!magicResult.isValid) {
    errors.push(...magicResult.errors);
  }

  // Validate custom inputs
  if (params.customInputs) {
    params.customInputs.forEach((input: CustomInput, index: number) => {
      const inputRequiredResult = validateRequired(input.name, `Custom Input ${index + 1} Name`);
      if (!inputRequiredResult.isValid) {
        errors.push(...inputRequiredResult.errors);
      }

      const nameResult = validateRegex(input.name, `Custom Input ${index + 1} Name`, VALIDATION_CONSTANTS.NAME_REGEX);
      if (!nameResult.isValid) {
        errors.push(...nameResult.errors);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateBacktestSettings(settings: BacktestSettings): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate initial deposit
  const depositResult = validateRange(
    settings.initialDeposit,
    'Initial Deposit',
    VALIDATION_CONSTANTS.MIN_INITIAL_DEPOSIT,
    VALIDATION_CONSTANTS.MAX_INITIAL_DEPOSIT
  );
  if (!depositResult.isValid) {
    errors.push(...depositResult.errors);
  }

  // Validate duration (days)
  const durationResult = validateRange(
    settings.days,
    'Duration (Days)',
    VALIDATION_CONSTANTS.MIN_DURATION,
    VALIDATION_CONSTANTS.MAX_DURATION
  );
  if (!durationResult.isValid) {
    errors.push(...durationResult.errors);
  }

  // Validate leverage
  const leverageResult = validateRange(
    settings.leverage,
    'Leverage',
    VALIDATION_CONSTANTS.MIN_LEVERAGE,
    VALIDATION_CONSTANTS.MAX_LEVERAGE
  );
  if (!leverageResult.isValid) {
    errors.push(...leverageResult.errors);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Utility functions
export function collectErrors(...results: ValidationResult[]): ValidationError[] {
  const allErrors: ValidationError[] = [];
  results.forEach(result => {
    if (!result.isValid && result.errors) {
      allErrors.push(...result.errors);
    }
  });
  return allErrors;
}

export function isValid(result: ValidationResult): boolean {
  return result.isValid;
}

export function formatErrors(errors: ValidationError[]): string {
  return errors.map(error => `${error.field}: ${error.message}`).join('\n');
}

// Legacy ValidationService Class for backward compatibility
export class ValidationService {
  static validateStrategyParams(params: StrategyParams): ValidationResult {
    return validateStrategyParams(params);
  }

  static validateBacktestSettings(settings: BacktestSettings): ValidationResult {
    return validateBacktestSettings(settings);
  }

  static validateChatMessage(message: string): ValidationResult {
    return validateChatMessage(message);
  }

  static sanitizeInput(input: string): string {
    return sanitizeInput(input);
  }

  static validateApiKey(apiKey: string): ValidationResult {
    return validateApiKey(apiKey);
  }

  static validateSymbol(symbol: string): ValidationResult {
    return validateSymbol(symbol);
  }
}

// Export constants for external use
export { VALIDATION_CONSTANTS };