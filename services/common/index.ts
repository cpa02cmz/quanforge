/**
 * Common Backend Module Index
 * 
 * Centralized exports for common backend utilities and types
 * 
 * @module services/common
 * @author Backend Engineer
 */

// Type definitions
export * from './types';

// Utility functions
export {
  createApiError,
  createSuccessResponse,
  createErrorResponse,
} from './types';

// Type re-exports for convenience
export type {
  ApiResponse,
  ApiError,
  CacheEntry,
  CacheMetadata,
  CacheOptions,
  CacheStatistics,
  PendingRequest,
  RequestCacheEntry,
  DeduplicationOptions,
  QueryResult,
  QueryError,
  PaginationParams,
  PaginatedResult,
  SortOption,
  FilterCondition,
  FilterOperator,
  BackendServiceConfig,
  BackendServiceMetrics,
  HealthStatus,
  HealthCheckResult,
  OptimizationRecommendation,
  OptimizationResult,
  QueryOptimizationInsights,
  QueryOptimizationResult,
  AdvancedInsightsResult,
  SlowQueryInfo,
  IndexRecommendation,
  TableSizeRecommendation,
} from './types';
