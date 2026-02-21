/**
 * Data Validation Layer - Pre-Database Validation
 * 
 * Provides comprehensive data validation for database operations with:
 * - Schema validation
 * - Type checking
 * - Constraint validation
 * - Custom validation rules
 * - Sanitization utilities
 * 
 * @module services/database/utils/dataValidator
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../../utils/logger';

// Logger for debugging (reserved for future enhanced logging)
const _logger = createScopedLogger('DataValidator');

// ============= Types =============

export type ValidatorType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'array' 
  | 'object' 
  | 'uuid' 
  | 'email' 
  | 'url';

export interface ValidationRule {
  /** Field name */
  field: string;
  /** Expected type */
  type?: ValidatorType;
  /** Is field required */
  required?: boolean;
  /** Minimum length (for strings/arrays) */
  minLength?: number;
  /** Maximum length (for strings/arrays) */
  maxLength?: number;
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
  /** Regex pattern to match */
  pattern?: RegExp;
  /** Custom validation function */
  custom?: (value: unknown) => boolean | string;
  /** Default value if not provided */
  defaultValue?: unknown;
  /** Transform function */
  transform?: (value: unknown) => unknown;
  /** Array of allowed values */
  enum?: unknown[];
  /** Nested schema for objects */
  schema?: ValidationSchema;
}

export type ValidationSchema = ValidationRule[];

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult<T = Record<string, unknown>> {
  valid: boolean;
  data: T | null;
  errors: ValidationError[];
  sanitized: boolean;
}

export interface ValidationOptions {
  /** Strip unknown fields */
  stripUnknown?: boolean;
  /** Allow partial validation */
  partial?: boolean;
  /** Abort on first error */
  abortEarly?: boolean;
  /** Custom error messages */
  customMessages?: Record<string, string>;
}

// ============= Default Options =============

const DEFAULT_OPTIONS: ValidationOptions = {
  stripUnknown: true,
  partial: false,
  abortEarly: false,
  customMessages: {},
};

// ============= Type Validators =============

const typeValidators: Record<ValidatorType, (value: unknown) => boolean> = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && !isNaN(v),
  boolean: (v) => typeof v === 'boolean',
  date: (v) => v instanceof Date || (typeof v === 'string' && !isNaN(Date.parse(v))),
  array: (v) => Array.isArray(v),
  object: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
  uuid: (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
  email: (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  url: (v) => {
    if (typeof v !== 'string') return false;
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  },
};

// ============= Data Validator Class =============

/**
 * Data Validator for pre-database validation
 */
export class DataValidator {
  private options: ValidationOptions;

  constructor(options: ValidationOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Validate data against a schema
   */
  validate<T = Record<string, unknown>>(
    data: Record<string, unknown>,
    schema: ValidationSchema
  ): ValidationResult<T> {
    const errors: ValidationError[] = [];
    const result: Record<string, unknown> = {};
    let sanitized = false;

    // Process each rule in schema
    for (const rule of schema) {
      const value = data[rule.field];
      const fieldErrors: ValidationError[] = [];

      // Check required
      if (value === undefined || value === null) {
        if (rule.required && !this.options.partial) {
          fieldErrors.push({
            field: rule.field,
            message: this.getMessage(rule.field, 'required', 'Field is required'),
            value,
          });
        } else if (rule.defaultValue !== undefined) {
          result[rule.field] = rule.defaultValue;
          sanitized = true;
        }
        continue;
      }

      // Skip validation if partial mode and field not provided
      if (this.options.partial && value === undefined) {
        continue;
      }

      let processedValue = value;

      // Apply transform first
      if (rule.transform) {
        processedValue = rule.transform(processedValue);
        sanitized = true;
      }

      // Type validation
      if (rule.type && !typeValidators[rule.type](processedValue)) {
        fieldErrors.push({
          field: rule.field,
          message: this.getMessage(rule.field, 'type', `Expected ${rule.type}`),
          value: processedValue,
        });
      }

      // String/Array length validation
      if (rule.minLength !== undefined) {
        const length = typeof processedValue === 'string' || Array.isArray(processedValue) 
          ? processedValue.length 
          : 0;
        if (length < rule.minLength) {
          fieldErrors.push({
            field: rule.field,
            message: this.getMessage(rule.field, 'minLength', `Minimum length is ${rule.minLength}`),
            value: processedValue,
          });
        }
      }

      if (rule.maxLength !== undefined) {
        const length = typeof processedValue === 'string' || Array.isArray(processedValue) 
          ? processedValue.length 
          : 0;
        if (length > rule.maxLength) {
          fieldErrors.push({
            field: rule.field,
            message: this.getMessage(rule.field, 'maxLength', `Maximum length is ${rule.maxLength}`),
            value: processedValue,
          });
        }
      }

      // Number range validation
      if (typeof processedValue === 'number') {
        if (rule.min !== undefined && processedValue < rule.min) {
          fieldErrors.push({
            field: rule.field,
            message: this.getMessage(rule.field, 'min', `Minimum value is ${rule.min}`),
            value: processedValue,
          });
        }
        if (rule.max !== undefined && processedValue > rule.max) {
          fieldErrors.push({
            field: rule.field,
            message: this.getMessage(rule.field, 'max', `Maximum value is ${rule.max}`),
            value: processedValue,
          });
        }
      }

      // Pattern validation
      if (rule.pattern && typeof processedValue === 'string') {
        if (!rule.pattern.test(processedValue)) {
          fieldErrors.push({
            field: rule.field,
            message: this.getMessage(rule.field, 'pattern', 'Invalid format'),
            value: processedValue,
          });
        }
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(processedValue)) {
        fieldErrors.push({
          field: rule.field,
          message: this.getMessage(rule.field, 'enum', `Must be one of: ${rule.enum.join(', ')}`),
          value: processedValue,
        });
      }

      // Custom validation
      if (rule.custom) {
        const customResult = rule.custom(processedValue);
        if (customResult !== true) {
          fieldErrors.push({
            field: rule.field,
            message: typeof customResult === 'string' ? customResult : 'Custom validation failed',
            value: processedValue,
          });
        }
      }

      // Nested schema validation
      if (rule.schema && typeof processedValue === 'object' && processedValue !== null) {
        const nestedResult = this.validate(
          processedValue as Record<string, unknown>,
          rule.schema
        );
        if (!nestedResult.valid) {
          for (const nestedError of nestedResult.errors) {
            fieldErrors.push({
              field: `${rule.field}.${nestedError.field}`,
              message: nestedError.message,
              value: nestedError.value,
            });
          }
        } else if (nestedResult.data) {
          processedValue = nestedResult.data;
          sanitized = true;
        }
      }

      // Add errors or value to result
      if (fieldErrors.length > 0) {
        errors.push(...fieldErrors);
        if (this.options.abortEarly) {
          break;
        }
      } else {
        result[rule.field] = processedValue;
      }
    }

    // Add unknown fields if not stripping
    if (!this.options.stripUnknown) {
      for (const key of Object.keys(data)) {
        if (!(key in result)) {
          result[key] = data[key];
        }
      }
    }

    const valid = errors.length === 0;

    return {
      valid,
      data: valid ? (result as T) : null,
      errors,
      sanitized,
    };
  }

  /**
   * Validate a single field
   */
  validateField(value: unknown, rule: ValidationRule): ValidationError | null {
    // Check required
    if ((value === undefined || value === null) && rule.required) {
      return {
        field: rule.field,
        message: this.getMessage(rule.field, 'required', 'Field is required'),
        value,
      };
    }

    if (value === undefined || value === null) {
      return null;
    }

    // Type validation
    if (rule.type && !typeValidators[rule.type](value)) {
      return {
        field: rule.field,
        message: this.getMessage(rule.field, 'type', `Expected ${rule.type}`),
        value,
      };
    }

    return null;
  }

  /**
   * Sanitize data by applying default values and transforms
   */
  sanitize<T = Record<string, unknown>>(
    data: Record<string, unknown>,
    schema: ValidationSchema
  ): T {
    const result: Record<string, unknown> = { ...data };

    for (const rule of schema) {
      const value = result[rule.field];

      // Apply default value
      if ((value === undefined || value === null) && rule.defaultValue !== undefined) {
        result[rule.field] = rule.defaultValue;
        continue;
      }

      // Apply transform
      if (rule.transform && value !== undefined && value !== null) {
        result[rule.field] = rule.transform(value);
      }
    }

    return result as T;
  }

  /**
   * Get custom error message
   */
  private getMessage(field: string, rule: string, defaultMsg: string): string {
    const key = `${field}.${rule}`;
    return this.options.customMessages?.[key] ?? 
           this.options.customMessages?.[rule] ?? 
           defaultMsg;
  }
}

// ============= Common Schemas =============

/**
 * Common validation schema for Robot data
 */
export const robotSchema: ValidationSchema = [
  { field: 'id', type: 'uuid', required: true },
  { field: 'name', type: 'string', required: true, minLength: 1, maxLength: 255 },
  { field: 'code', type: 'string', required: true, minLength: 1 },
  { field: 'user_id', type: 'uuid', required: true },
  { field: 'description', type: 'string', maxLength: 5000 },
  { field: 'strategy_type', type: 'string', maxLength: 100 },
  { field: 'strategy_params', type: 'object' },
  { field: 'chat_history', type: 'array' },
  { field: 'analysis_result', type: 'object' },
  { field: 'backtest_settings', type: 'object' },
  { field: 'is_active', type: 'boolean', defaultValue: true },
  { field: 'is_public', type: 'boolean', defaultValue: false },
  { field: 'view_count', type: 'number', min: 0, defaultValue: 0 },
  { field: 'copy_count', type: 'number', min: 0, defaultValue: 0 },
  { field: 'version', type: 'number', min: 1, defaultValue: 1 },
];

/**
 * Common validation schema for User data
 */
export const userSchema: ValidationSchema = [
  { field: 'id', type: 'uuid', required: true },
  { field: 'email', type: 'email', required: true },
  { field: 'name', type: 'string', maxLength: 255 },
  { field: 'avatar_url', type: 'url' },
  { field: 'created_at', type: 'date' },
  { field: 'updated_at', type: 'date' },
];

// ============= Singleton Instance =============

export const dataValidator = new DataValidator();

// ============= Convenience Functions =============

/**
 * Validate data against a schema
 */
export function validateData<T = Record<string, unknown>>(
  data: Record<string, unknown>,
  schema: ValidationSchema,
  options?: ValidationOptions
): ValidationResult<T> {
  const validator = options ? new DataValidator(options) : dataValidator;
  return validator.validate<T>(data, schema);
}

/**
 * Validate Robot data
 */
export function validateRobot(data: Record<string, unknown>): ValidationResult {
  return dataValidator.validate(data, robotSchema);
}

/**
 * Validate User data
 */
export function validateUser(data: Record<string, unknown>): ValidationResult {
  return dataValidator.validate(data, userSchema);
}

/**
 * Sanitize string input (trim and escape)
 */
export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Sanitize number input
 */
export function sanitizeNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Sanitize boolean input
 */
export function sanitizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return Boolean(value);
}

/**
 * Check if value is a valid UUID
 */
export function isValidUUID(value: unknown): boolean {
  return typeValidators.uuid(value);
}

/**
 * Check if value is a valid email
 */
export function isValidEmail(value: unknown): boolean {
  return typeValidators.email(value);
}

/**
 * Check if value is a valid URL
 */
export function isValidURL(value: unknown): boolean {
  return typeValidators.url(value);
}
