/**
 * Validation Types and Utilities
 * Complementary module to validationCore.ts for type definitions and helper utilities
 */

import { VALIDATION_CONFIG, SECURITY_CONFIG, TRADING_CONSTANTS } from '../constants/config';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[] | string[];
  warnings?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!email) {
    errors.push('Email is required');
  } else if (!VALIDATION_CONFIG.PATTERNS.EMAIL.test(email)) {
    errors.push('Invalid email format');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateApiKey = (apiKey: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!apiKey) {
    errors.push('API key is required');
  } else if (apiKey.length < SECURITY_CONFIG.MIN_API_KEY_LENGTH) {
    errors.push(`API key must be at least ${SECURITY_CONFIG.MIN_API_KEY_LENGTH} characters`);
  } else if (apiKey.length > SECURITY_CONFIG.MAX_API_KEY_LENGTH) {
    errors.push(`API key cannot exceed ${SECURITY_CONFIG.MAX_API_KEY_LENGTH} characters`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateStrategyParams = (params: any): ValidationResult => {
  const errors: string[] = [];
  
  if (!params) {
    errors.push('Strategy parameters are required');
    return { isValid: false, errors };
  }

  if (!params.symbol || typeof params.symbol !== 'string') {
    errors.push('Symbol is required');
  }

  if (!params.timeframe || typeof params.timeframe !== 'string') {
    errors.push('Timeframe is required');
  }

  if (typeof params.riskPercent !== 'number' || params.riskPercent < TRADING_CONSTANTS.MIN_RISK_PERCENT || params.riskPercent > TRADING_CONSTANTS.MAX_RISK_PERCENT) {
    errors.push(`Risk percent must be between ${TRADING_CONSTANTS.MIN_RISK_PERCENT} and ${TRADING_CONSTANTS.MAX_RISK_PERCENT}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};