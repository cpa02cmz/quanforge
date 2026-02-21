/**
 * Common Backend Type Definitions
 * 
 * Provides centralized type definitions for backend services including:
 * - API request/response types
 * - Cache entry types
 * - Query result types
 * - Error handling types
 * 
 * @module services/common/types
 * @author Backend Engineer
 */

// ============= API Types =============

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

/**
 * Standardized API error structure
 */
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Creates a standardized API error
 */
export function createApiError(
  message: string,
  code?: string,
  statusCode?: number,
  details?: Record<string, unknown>
): ApiError {
  return {
    message,
    code,
    statusCode,
    details,
    timestamp: Date.now(),
  };
}

/**
 * Creates a successful API response
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return { data, error: null };
}

/**
 * Creates an error API response
 */
export function createErrorResponse<T>(error: ApiError | string): ApiResponse<T> {
  if (typeof error === 'string') {
    return { data: null, error: createApiError(error) };
  }
  return { data: null, error };
}

// ============= Cache Types =============

/**
 * Generic cache entry structure
 */
export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
  metadata?: CacheMetadata;
}

/**
 * Cache entry metadata
 */
export interface CacheMetadata {
  size?: number;
  hitCount?: number;
  lastAccessed?: number;
  source?: string;
  version?: number;
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  maxSize?: number;
  compression?: boolean;
  persistent?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  evictions: number;
  entries: number;
}

// ============= Request Deduplication Types =============

/**
 * Pending request state for deduplication
 */
export interface PendingRequest<T = unknown> {
  promise: Promise<T>;
  timestamp: number;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

/**
 * Request cache entry for deduplication
 */
export interface RequestCacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Options for request deduplication
 */
export interface DeduplicationOptions {
  cacheTTL?: number;
  maxAge?: number;
  useCache?: boolean;
}

// ============= Query Types =============

/**
 * Generic query result wrapper
 */
export interface QueryResult<T> {
  data: T | null;
  error: QueryError | null;
  count?: number;
}

/**
 * Query error structure
 */
export interface QueryError {
  message: string;
  code?: string;
  hint?: string;
  details?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

/**
 * Paginated query result
 */
export interface PaginatedResult<T> extends QueryResult<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Query sorting options
 */
export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Query filter condition
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Filter operators
 */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'is'
  | 'contains'
  | 'startsWith'
  | 'endsWith';

// ============= Backend Service Types =============

/**
 * Backend service configuration base
 */
export interface BackendServiceConfig {
  enabled?: boolean;
  debug?: boolean;
  timeout?: number;
  retries?: number;
}

/**
 * Backend service metrics
 */
export interface BackendServiceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastRequestTime: number | null;
  healthStatus: HealthStatus;
}

/**
 * Health status enum
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  timestamp: number;
  details?: Record<string, unknown>;
  latency?: number;
}

// ============= Optimization Types =============

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'reliability' | 'efficiency' | 'security';
  description: string;
  impact: string;
  autoApplicable: boolean;
  applied?: boolean;
  appliedAt?: number;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  applied: number;
  skipped: number;
  failed: number;
  recommendations: OptimizationRecommendation[];
  performanceGain?: number;
  executionTime?: number;
}

/**
 * Query optimization insights
 */
export interface QueryOptimizationInsights {
  slowQueries: SlowQueryInfo[];
  indexRecommendations: IndexRecommendation[];
  unusedIndexes: string[];
  tableSizeRecommendations: TableSizeRecommendation[];
}

/**
 * Query optimization result
 */
export interface QueryOptimizationResult {
  recommendations: string[];
  analysis: {
    slowQueries: number;
    unusedIndexes: string[];
    suggestedIndexes: string[];
  };
  appliedOptimizations: number;
}

/**
 * Advanced optimization insights result
 */
export interface AdvancedInsightsResult {
  performanceScore: number;
  bottlenecks: Array<{
    area: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestion: string;
  }>;
  recommendations: string[];
  potentialGain: string;
}

/**
 * Slow query information
 */
export interface SlowQueryInfo {
  query: string;
  averageTime: number;
  callCount: number;
  suggestedOptimization?: string;
}

/**
 * Index recommendation
 */
export interface IndexRecommendation {
  table: string;
  columns: string[];
  reason: string;
  estimatedImpact: 'low' | 'medium' | 'high';
}

/**
 * Table size recommendation
 */
export interface TableSizeRecommendation {
  table: string;
  currentSize: string;
  recommendation: string;
  estimatedSavings?: string;
}

// ============= Utility Types =============

/**
 * Makes specified keys optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Makes specified keys required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract the data type from an ApiResponse
 */
export type ApiResponseData<T> = T extends ApiResponse<infer U> ? U : never;

/**
 * Extract the error type from an ApiResponse
 */
export type ApiResponseError<T> = T extends ApiResponse<infer _U>
  ? NonNullable<T['error']>
  : never;
