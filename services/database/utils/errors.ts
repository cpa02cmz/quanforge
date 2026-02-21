/**
 * Database Error Types and Error Handling Utilities
 * 
 * Provides specialized error types for database operations with
 * proper error classification and recovery strategies.
 * 
 * @module services/database/utils/errors
 * @author Backend Engineer
 */

/**
 * Base database error class
 */
export class DatabaseError extends Error {
  public readonly code: string;
  public readonly table?: string;
  public readonly operation?: string;
  public readonly recoverable: boolean;
  public readonly timestamp: number;
  public readonly causeError?: Error;

  constructor(
    message: string,
    code: string,
    options?: {
      table?: string;
      operation?: string;
      recoverable?: boolean;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.table = options?.table;
    this.operation = options?.operation;
    this.recoverable = options?.recoverable ?? false;
    this.timestamp = Date.now();
    this.causeError = options?.cause;
  }
}

/**
 * Connection error - indicates issues connecting to the database
 */
export class DatabaseConnectionError extends DatabaseError {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, 'DB_CONNECTION_ERROR', {
      operation: 'connect',
      recoverable: true,
      ...options,
    });
    this.name = 'DatabaseConnectionError';
  }
}

/**
 * Query error - indicates issues with a specific query
 */
export class DatabaseQueryError extends DatabaseError {
  constructor(
    message: string,
    options?: {
      table?: string;
      operation?: string;
      cause?: Error;
    }
  ) {
    super(message, 'DB_QUERY_ERROR', {
      recoverable: false,
      ...options,
    });
    this.name = 'DatabaseQueryError';
  }
}

/**
 * Timeout error - indicates a query timed out
 */
export class DatabaseTimeoutError extends DatabaseError {
  constructor(
    message: string,
    options?: {
      table?: string;
      operation?: string;
    }
  ) {
    super(message, 'DB_TIMEOUT_ERROR', {
      recoverable: true,
      ...options,
    });
    this.name = 'DatabaseTimeoutError';
  }
}

/**
 * Constraint violation error - unique key, foreign key, etc.
 */
export class DatabaseConstraintError extends DatabaseError {
  public readonly constraint?: string;

  constructor(
    message: string,
    options?: {
      table?: string;
      operation?: string;
      constraint?: string;
      cause?: Error;
    }
  ) {
    super(message, 'DB_CONSTRAINT_ERROR', {
      recoverable: false,
      ...options,
    });
    this.name = 'DatabaseConstraintError';
    this.constraint = options?.constraint;
  }
}

/**
 * Not found error - record not found
 */
export class DatabaseNotFoundError extends DatabaseError {
  constructor(
    message: string,
    options?: {
      table?: string;
      operation?: string;
    }
  ) {
    super(message, 'DB_NOT_FOUND_ERROR', {
      recoverable: false,
      ...options,
    });
    this.name = 'DatabaseNotFoundError';
  }
}

/**
 * Validation error - data validation failed
 */
export class DatabaseValidationError extends DatabaseError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(
    message: string,
    options?: {
      table?: string;
      operation?: string;
      field?: string;
      value?: unknown;
      cause?: Error;
    }
  ) {
    super(message, 'DB_VALIDATION_ERROR', {
      recoverable: false,
      ...options,
    });
    this.name = 'DatabaseValidationError';
    this.field = options?.field;
    this.value = options?.value;
  }
}

/**
 * Permission error - RLS or auth issues
 */
export class DatabasePermissionError extends DatabaseError {
  constructor(
    message: string,
    options?: {
      table?: string;
      operation?: string;
    }
  ) {
    super(message, 'DB_PERMISSION_ERROR', {
      recoverable: false,
      ...options,
    });
    this.name = 'DatabasePermissionError';
  }
}

/**
 * Quota error - storage limit exceeded
 */
export class DatabaseQuotaError extends DatabaseError {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, 'DB_QUOTA_ERROR', {
      recoverable: false,
      ...options,
    });
    this.name = 'DatabaseQuotaError';
  }
}

/**
 * Supabase/PostgreSQL error code mappings
 */
export const SUPABASE_ERROR_CODES = {
  // Connection errors
  CONNECTION_ERROR: '08006',
  CONNECTION_DOES_NOT_EXIST: '08003',
  CONNECTION_FAILURE: '08001',
  
  // Timeout
  QUERY_CANCELED: '57014',
  
  // Constraint violations
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
  
  // Not found
  NOT_FOUND: 'PGRST116',
  
  // Permission
  INSUFFICIENT_PRIVILEGE: '42501',
  
  // Syntax
  SYNTAX_ERROR: '42601',
  INVALID_COLUMN: '42703',
  
  // Quota
  DISK_FULL: '53100',
} as const;

/**
 * Map Supabase error code to appropriate error class
 */
export function mapSupabaseError(
  error: { code?: string; message: string },
  table?: string,
  operation?: string
): DatabaseError {
  const code = error.code || '';
  
  // Connection errors
  if (SUPABASE_ERROR_CODES.CONNECTION_ERROR === code ||
      SUPABASE_ERROR_CODES.CONNECTION_DOES_NOT_EXIST === code ||
      SUPABASE_ERROR_CODES.CONNECTION_FAILURE === code) {
    return new DatabaseConnectionError(error.message);
  }
  
  // Timeout
  if (SUPABASE_ERROR_CODES.QUERY_CANCELED === code) {
    return new DatabaseTimeoutError(error.message, { table, operation });
  }
  
  // Constraint violations
  if (SUPABASE_ERROR_CODES.UNIQUE_VIOLATION === code) {
    return new DatabaseConstraintError(error.message, {
      table,
      operation,
      constraint: 'unique',
    });
  }
  
  if (SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION === code) {
    return new DatabaseConstraintError(error.message, {
      table,
      operation,
      constraint: 'foreign_key',
    });
  }
  
  if (SUPABASE_ERROR_CODES.NOT_NULL_VIOLATION === code) {
    return new DatabaseValidationError(error.message, { table, operation });
  }
  
  // Not found
  if (SUPABASE_ERROR_CODES.NOT_FOUND === code) {
    return new DatabaseNotFoundError(error.message, { table, operation });
  }
  
  // Permission
  if (SUPABASE_ERROR_CODES.INSUFFICIENT_PRIVILEGE === code) {
    return new DatabasePermissionError(error.message, { table, operation });
  }
  
  // Default to generic query error
  return new DatabaseQueryError(error.message, { table, operation });
}

/**
 * Check if error is a database error
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

/**
 * Check if error is recoverable (can retry)
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof DatabaseError) {
    return error.recoverable;
  }
  return false;
}

/**
 * Get error recovery strategy
 */
export function getErrorRecoveryStrategy(error: DatabaseError): {
  shouldRetry: boolean;
  retryDelay: number;
  fallbackAction?: 'cache' | 'mock' | 'throw';
} {
  if (error instanceof DatabaseConnectionError) {
    return { shouldRetry: true, retryDelay: 1000, fallbackAction: 'cache' };
  }
  
  if (error instanceof DatabaseTimeoutError) {
    return { shouldRetry: true, retryDelay: 500, fallbackAction: 'throw' };
  }
  
  if (error instanceof DatabaseNotFoundError) {
    return { shouldRetry: false, retryDelay: 0, fallbackAction: 'mock' };
  }
  
  if (error instanceof DatabaseQuotaError) {
    return { shouldRetry: false, retryDelay: 0, fallbackAction: 'throw' };
  }
  
  return { shouldRetry: false, retryDelay: 0, fallbackAction: 'throw' };
}

/**
 * Format error for logging
 */
export function formatErrorForLog(error: DatabaseError): string {
  const parts = [
    `[${error.name}]`,
    `code=${error.code}`,
  ];
  
  if (error.table) parts.push(`table=${error.table}`);
  if (error.operation) parts.push(`operation=${error.operation}`);
  parts.push(`recoverable=${error.recoverable}`);
  parts.push(`message="${error.message}"`);
  
  if (error.causeError) {
    parts.push(`cause="${error.causeError.message}"`);
  }
  
  return parts.join(' ');
}
