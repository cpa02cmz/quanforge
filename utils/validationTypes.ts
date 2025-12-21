/**
 * Validation Types and Utilities
 * Complementary module to validationCore.ts for type definitions and helper utilities
 */

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
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
  } else if (apiKey.length < 10) {
    errors.push('API key must be at least 10 characters');
  } else if (apiKey.length > 2000) {
    errors.push('API key cannot exceed 2000 characters');
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

  if (typeof params.riskPercent !== 'number' || params.riskPercent <= 0) {
    errors.push('Risk percent must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};