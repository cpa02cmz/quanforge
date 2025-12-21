/**
 * Validation Types and Utilities
 * Complementary module to validationCore.ts for type definitions and helper utilities
 */

// ========== TYPE DEFINITIONS ==========

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  field?: string;
}

export interface StrategyValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedParams?: any;
}

export interface RateLimiterEntry {
  count: number;
  resetTime: number;
}

// Strategy-specific interfaces
export interface CustomInput {
  name: string;
  type: 'number' | 'string' | 'boolean';
  defaultValue: any;
  description?: string;
  minValue?: number;
  maxValue?: number;
  options?: string[];
}

export interface StrategyParams {
  timeframe: string;
  riskPercent: number;
  stopLossPips?: number;
  takeProfitPips?: number;
  symbol?: string;
  customInputs?: CustomInput[];
  magicNumber?: number;
  initialDeposit?: number;
  duration?: number;
  leverage?: number;
}

// Validation rule interfaces
export interface ValidationRule<T = any> {
  name: string;
  validator: (value: T) => ValidationError | null;
  required?: boolean;
  sanitizer?: (value: T) => T;
}

export interface ValidationSchema<T = any> {
  [key: string]: ValidationRule<T> | ValidationRule<T>[];
}

// Legacy types for backward compatibility
export interface InputValidationOptions {
  sanitize?: boolean;
  checkXSS?: boolean;
  maxLength?: number;
  minLength?: number;
}

export interface SecurityValidationOptions {
  checkMQL5?: boolean;
  allowFileOperations?: boolean;
  allowNetworkOperations?: boolean;
}