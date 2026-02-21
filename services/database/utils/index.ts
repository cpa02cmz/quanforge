/**
 * Database Utils - Comprehensive Backend Utilities
 * 
 * Provides centralized exports for all database utility modules including:
 * - Transaction Management
 * - Query Building
 * - Health Checking
 * - Data Validation
 * - Audit Trail
 * - Core Database Utilities
 * 
 * @module services/database/utils
 * @author Backend Engineer
 */

// ============= Transaction Manager =============

export {
  TransactionManager,
  transactionManager,
  withTransaction,
  withBatchTransaction,
  DEFAULT_TRANSACTION_OPTIONS,
  type IsolationLevel,
  type TransactionOptions,
  type TransactionResult,
  type TransactionCallback,
  type TransactionClient,
  type TransactionMetrics,
} from './transactionManager';

// ============= Query Builder =============

export {
  QueryBuilder,
  buildSupabaseQuery,
  query,
  createPaginatedResult,
  calculateOffset,
  calculateTotalPages,
  validatePagination,
  type SortDirection,
  type SortOption,
  type PaginationOptions,
  type PaginatedResult,
  type FilterCondition,
  type FilterOperator,
  type QueryOptions,
  type QueryExecutor,
} from './queryBuilder';

// ============= Health Checker =============

export {
  DatabaseHealthChecker,
  databaseHealthChecker,
  checkDatabaseHealth,
  recordQueryExecution,
  getDatabaseHealthStatus,
  type HealthStatus,
  type ConnectionHealth,
  type PoolHealth,
  type QueryHealth,
  type DatabaseHealthReport,
  type HealthCheckOptions,
} from './healthChecker';

// ============= Data Validator =============

export {
  DataValidator,
  dataValidator,
  validateData,
  validateRobot,
  validateUser,
  sanitizeString,
  sanitizeNumber,
  sanitizeBoolean,
  isValidUUID,
  isValidEmail,
  isValidURL,
  robotSchema,
  userSchema,
  type ValidatorType,
  type ValidationRule,
  type ValidationSchema,
  type ValidationError,
  type ValidationResult,
  type ValidationOptions,
} from './dataValidator';

// ============= Audit Trail =============

export {
  AuditTrailService,
  auditTrailService,
  logAudit,
  logCreate,
  logUpdate,
  logDelete,
  getAuditHistory,
  getAuditStats,
  type AuditAction,
  type AuditEntry,
  type AuditQueryOptions,
  type AuditStats,
} from './auditTrail';
