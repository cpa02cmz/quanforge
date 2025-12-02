import { ValidationError } from './validationTypes';

// Basic validation utilities
export const validateRequired = (value: string, field: string): ValidationError | null => {
  if (!value || value.trim().length === 0) {
    return {
      field,
      message: `${field} is required`
    };
  }
  return null;
};

export const validateRange = (
  value: number,
  field: string,
  min: number,
  max: number
): ValidationError | null => {
  if (value < min || value > max) {
    return {
      field,
      message: `${field} must be between ${min} and ${max}`
    };
  }
  return null;
};

export const validateRegex = (
  value: string,
  field: string,
  regex: RegExp,
  message: string
): ValidationError | null => {
  if (!regex.test(value)) {
    return {
      field,
      message
    };
  }
  return null;
};

export const validateInSet = (
  value: string,
  field: string,
  validValues: Set<string> | string[],
  message?: string
): ValidationError | null => {
  const isValid = Array.isArray(validValues) ? validValues.includes(value) : validValues.has(value);
  if (!isValid) {
    return {
      field,
      message: message || `Invalid ${field}. Must be one of: ${Array.isArray(validValues) ? validValues.join(', ') : Array.from(validValues).join(', ')}`
    };
  }
  return null;
};

// Error collection utilities
export const collectErrors = (...errors: (ValidationError | null)[]): ValidationError[] => {
  return errors.filter((error): error is ValidationError => error !== null);
};

export const isValid = (errors: ValidationError[]): boolean => {
  return errors.length === 0;
};

export const formatErrors = (errors: ValidationError[]): string => {
  return errors.map(error => `${error.field}: ${error.message}`).join('; ');
};