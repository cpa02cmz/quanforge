/**
 * Database Query Builder Utility
 * 
 * Provides type-safe query building with automatic soft-delete filtering,
 * pagination, and query optimization for backend operations.
 * 
 * @module services/database/utils/queryBuilder
 * @author Backend Engineer
 */

import { COUNT_CONSTANTS } from '../../modularConstants';

/**
 * Sort direction type
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Query options interface
 */
export interface QueryOptions {
  /** Include soft-deleted records */
  includeDeleted?: boolean;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Sort column */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: SortDirection;
  /** Select specific columns */
  select?: string | string[];
  /** Filter by user ID (for RLS) */
  userId?: string;
}

/**
 * Pagination result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Query filter conditions
 */
export interface FilterCondition {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';
  value: unknown;
}

/**
 * Default query options
 */
export const DEFAULT_QUERY_OPTIONS: Required<Omit<QueryOptions, 'userId'>> = {
  includeDeleted: false,
  page: 1,
  limit: COUNT_CONSTANTS.PAGINATION.DEFAULT,
  sortBy: 'created_at',
  sortOrder: 'desc',
  select: '*',
};

/**
 * Soft delete filter constant
 */
export const SOFT_DELETE_FILTER = {
  column: 'deleted_at',
  operator: 'is' as const,
  value: null,
};

/**
 * Build a select query with standard options
 * 
 * @param table - Table name
 * @param options - Query options
 * @returns Query configuration object
 */
export function buildSelectQuery(
  table: string,
  options: QueryOptions = {}
): {
  table: string;
  select: string;
  filters: FilterCondition[];
  pagination: { offset: number; limit: number };
  sort: { column: string; direction: SortDirection };
} {
  const opts = { ...DEFAULT_QUERY_OPTIONS, ...options };
  
  const filters: FilterCondition[] = [];
  
  // Add soft-delete filter by default
  if (!opts.includeDeleted) {
    filters.push(SOFT_DELETE_FILTER);
  }
  
  // Add user filter for RLS
  if (opts.userId) {
    filters.push({
      column: 'user_id',
      operator: 'eq',
      value: opts.userId,
    });
  }
  
  // Calculate pagination
  const offset = (opts.page - 1) * opts.limit;
  
  // Build select columns
  const select = Array.isArray(opts.select) ? opts.select.join(', ') : opts.select;
  
  return {
    table,
    select,
    filters,
    pagination: { offset, limit: opts.limit },
    sort: { column: opts.sortBy, direction: opts.sortOrder },
  };
}

/**
 * Build search conditions for text search
 * 
 * @param searchTerm - Search term
 * @param columns - Columns to search in
 * @returns Array of filter conditions for OR search
 */
export function buildSearchConditions(
  searchTerm: string,
  columns: string[]
): FilterCondition[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return [];
  }
  
  const term = searchTerm.trim();
  return columns.map((column) => ({
    column,
    operator: 'ilike' as const,
    value: `%${term}%`,
  }));
}

/**
 * Calculate pagination metadata
 * 
 * @param total - Total number of items
 * @param page - Current page
 * @param limit - Items per page
 * @returns Pagination metadata
 */
export function calculatePaginationMeta(
  total: number,
  page: number,
  limit: number
): { totalPages: number; hasMore: boolean } {
  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;
  return { totalPages, hasMore };
}

/**
 * Create a paginated result wrapper
 * 
 * @param data - Array of results
 * @param total - Total count
 * @param page - Current page
 * @param limit - Items per page
 * @returns Paginated result object
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const { totalPages, hasMore } = calculatePaginationMeta(total, page, limit);
  return {
    data,
    total,
    page,
    limit,
    totalPages,
    hasMore,
  };
}

/**
 * Validate pagination parameters
 * 
 * @param page - Page number
 * @param limit - Items per page
 * @returns Validated and clamped parameters
 */
export function validatePagination(
  page: unknown,
  limit: unknown
): { page: number; limit: number } {
  const validatedPage = Math.max(1, Math.floor(Number(page) || 1));
  const validatedLimit = Math.min(
    COUNT_CONSTANTS.PAGINATION.MAX,
    Math.max(1, Math.floor(Number(limit) || COUNT_CONSTANTS.PAGINATION.DEFAULT))
  );
  
  return { page: validatedPage, limit: validatedLimit };
}

/**
 * Build update payload with timestamp
 * 
 * @param data - Update data
 * @returns Data with updated_at timestamp
 */
export function buildUpdatePayload<T extends Record<string, unknown>>(
  data: Partial<T>
): Partial<T> & { updated_at: string } {
  return {
    ...data,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Build soft delete payload
 * 
 * @returns Soft delete payload with deleted_at timestamp
 */
export function buildSoftDeletePayload(): { deleted_at: string } {
  return {
    deleted_at: new Date().toISOString(),
  };
}

/**
 * Build restore payload (undo soft delete)
 * 
 * @returns Restore payload with null deleted_at
 */
export function buildRestorePayload(): { deleted_at: null } {
  return {
    deleted_at: null,
  };
}

/**
 * Query performance metrics interface
 */
export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

/**
 * Query performance tracker
 */
class QueryPerformanceTracker {
  private metrics: QueryMetrics[] = [];
  private maxSize = 1000;

  track(metrics: QueryMetrics): void {
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxSize) {
      this.metrics.shift();
    }
  }

  getAverageDuration(queryPattern?: string): number {
    const relevant = queryPattern
      ? this.metrics.filter((m) => m.query.includes(queryPattern))
      : this.metrics;
    
    if (relevant.length === 0) return 0;
    
    const total = relevant.reduce((sum, m) => sum + m.duration, 0);
    return total / relevant.length;
  }

  getSlowQueries(thresholdMs: number = 1000): QueryMetrics[] {
    return this.metrics.filter((m) => m.duration > thresholdMs);
  }

  getErrorRate(): number {
    if (this.metrics.length === 0) return 0;
    const errors = this.metrics.filter((m) => !m.success).length;
    return errors / this.metrics.length;
  }

  getRecentMetrics(count: number = 100): QueryMetrics[] {
    return this.metrics.slice(-count);
  }

  clear(): void {
    this.metrics = [];
  }
}

/**
 * Global query performance tracker instance
 */
export const queryPerformanceTracker = new QueryPerformanceTracker();

/**
 * Measure query execution time
 * 
 * @param queryName - Name of the query
 * @param fn - Async function to measure
 * @returns Result of the function
 */
export async function measureQuery<T>(
  queryName: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const timestamp = startTime;
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    queryPerformanceTracker.track({
      query: queryName,
      duration,
      timestamp,
      success: true,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    queryPerformanceTracker.track({
      query: queryName,
      duration,
      timestamp,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    
    throw error;
  }
}
