/**
 * Database Utilities Index
 * 
 * Centralized exports for database utility modules
 * 
 * @module services/database/utils
 * @author Backend Engineer
 */

// Query Builder
export {
  buildSelectQuery,
  buildSearchConditions,
  calculatePaginationMeta,
  createPaginatedResult,
  validatePagination,
  buildUpdatePayload,
  buildSoftDeletePayload,
  buildRestorePayload,
  measureQuery,
  queryPerformanceTracker,
  DEFAULT_QUERY_OPTIONS,
  SOFT_DELETE_FILTER,
  type QueryOptions,
  type PaginatedResult,
  type FilterCondition,
  type SortDirection,
  type QueryMetrics,
} from './queryBuilder';

// Error Handling
export {
  DatabaseError,
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseTimeoutError,
  DatabaseConstraintError,
  DatabaseNotFoundError,
  DatabaseValidationError,
  DatabasePermissionError,
  DatabaseQuotaError,
  mapSupabaseError,
  isDatabaseError,
  isRecoverableError,
  getErrorRecoveryStrategy,
  formatErrorForLog,
  SUPABASE_ERROR_CODES,
} from './errors';

// Health Check
export {
  runHealthCheck,
  HealthCheckScheduler,
  healthCheckScheduler,
  type HealthStatus,
  type HealthCheckResult,
  type HealthCheckOptions,
} from './healthCheck';
