/**
 * Query Builder Utilities - Common Query Patterns
 * 
 * Provides fluent query building for database operations with:
 * - Type-safe query construction
 * - Common filter patterns
 * - Pagination utilities
 * - Sorting helpers
 * - Query optimization
 * 
 * @module services/database/utils/queryBuilder
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../../utils/logger';

const logger = createScopedLogger('QueryBuilder');

// ============= Types =============

export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  column: string;
  direction: SortDirection;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  /** Include total count in response */
  includeTotal?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value: unknown;
}

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
  | 'not.in'
  | 'is' 
  | 'not.is'
  | 'contains' 
  | 'contained';

export interface QueryOptions {
  /** Columns to select */
  select?: string[];
  /** Filter conditions */
  filters?: FilterCondition[];
  /** Sort options */
  sort?: SortOption[];
  /** Pagination options */
  pagination?: PaginationOptions;
  /** Include soft-deleted records */
  includeDeleted?: boolean;
  /** Soft delete column name */
  deletedColumn?: string;
}

// ============= Query Builder Class =============

/**
 * Fluent query builder for database operations
 */
export class QueryBuilder<T = Record<string, unknown>> {
  private tableName: string;
  private options: QueryOptions = {};

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Create a new query builder for a table
   */
  static from<K = Record<string, unknown>>(tableName: string): QueryBuilder<K> {
    return new QueryBuilder<K>(tableName);
  }

  /**
   * Select specific columns
   */
  select(...columns: string[]): this {
    this.options.select = columns;
    return this;
  }

  /**
   * Add a filter condition
   */
  where(column: string, operator: FilterOperator, value: unknown): this {
    if (!this.options.filters) {
      this.options.filters = [];
    }
    this.options.filters.push({ column, operator, value });
    return this;
  }

  /**
   * Add equality filter
   */
  whereEq(column: string, value: unknown): this {
    return this.where(column, 'eq', value);
  }

  /**
   * Add not-equal filter
   */
  whereNeq(column: string, value: unknown): this {
    return this.where(column, 'neq', value);
  }

  /**
   * Add greater-than filter
   */
  whereGt(column: string, value: unknown): this {
    return this.where(column, 'gt', value);
  }

  /**
   * Add greater-than-or-equal filter
   */
  whereGte(column: string, value: unknown): this {
    return this.where(column, 'gte', value);
  }

  /**
   * Add less-than filter
   */
  whereLt(column: string, value: unknown): this {
    return this.where(column, 'lt', value);
  }

  /**
   * Add less-than-or-equal filter
   */
  whereLte(column: string, value: unknown): this {
    return this.where(column, 'lte', value);
  }

  /**
   * Add LIKE filter (case-sensitive)
   */
  whereLike(column: string, pattern: string): this {
    return this.where(column, 'like', pattern);
  }

  /**
   * Add ILIKE filter (case-insensitive)
   */
  whereILike(column: string, pattern: string): this {
    return this.where(column, 'ilike', pattern);
  }

  /**
   * Add IN filter
   */
  whereIn(column: string, values: unknown[]): this {
    return this.where(column, 'in', values);
  }

  /**
   * Add NOT IN filter
   */
  whereNotIn(column: string, values: unknown[]): this {
    return this.where(column, 'not.in', values);
  }

  /**
   * Add IS NULL/NOT NULL filter
   */
  whereNull(column: string, isNull: boolean = true): this {
    return this.where(column, 'is', isNull ? null : 'not.null');
  }

  /**
   * Add IS NOT NULL filter
   */
  whereNotNull(column: string): this {
    return this.whereNull(column, false);
  }

  /**
   * Add JSONB contains filter
   */
  whereContains(column: string, value: unknown): this {
    return this.where(column, 'contains', value);
  }

  /**
   * Add JSONB contained filter
   */
  whereContained(column: string, value: unknown): this {
    return this.where(column, 'contained', value);
  }

  /**
   * Filter by user (common pattern)
   */
  forUser(userId: string, column: string = 'user_id'): this {
    return this.whereEq(column, userId);
  }

  /**
   * Filter out soft-deleted records
   */
  notDeleted(column: string = 'deleted_at'): this {
    this.options.deletedColumn = column;
    if (!this.options.includeDeleted) {
      this.whereNull(column);
    }
    return this;
  }

  /**
   * Include soft-deleted records
   */
  includeDeleted(): this {
    this.options.includeDeleted = true;
    return this;
  }

  /**
   * Add sort order
   */
  orderBy(column: string, direction: SortDirection = 'asc'): this {
    if (!this.options.sort) {
      this.options.sort = [];
    }
    this.options.sort.push({ column, direction });
    return this;
  }

  /**
   * Sort by column ascending
   */
  orderAsc(column: string): this {
    return this.orderBy(column, 'asc');
  }

  /**
   * Sort by column descending
   */
  orderDesc(column: string): this {
    return this.orderBy(column, 'desc');
  }

  /**
   * Sort by updated_at descending (most recent first)
   */
  latest(column: string = 'updated_at'): this {
    return this.orderDesc(column);
  }

  /**
   * Sort by created_at descending (newest first)
   */
  newest(column: string = 'created_at'): this {
    return this.orderDesc(column);
  }

  /**
   * Sort by created_at ascending (oldest first)
   */
  oldest(column: string = 'created_at'): this {
    return this.orderAsc(column);
  }

  /**
   * Add pagination
   */
  paginate(page: number, limit: number): this {
    this.options.pagination = { page, limit, includeTotal: true };
    return this;
  }

  /**
   * Add pagination without total count
   */
  paginateFast(page: number, limit: number): this {
    this.options.pagination = { page, limit, includeTotal: false };
    return this;
  }

  /**
   * Limit results
   */
  limit(limit: number): this {
    this.options.pagination = { page: 1, limit, includeTotal: false };
    return this;
  }

  /**
   * Take first N results
   */
  take(n: number): this {
    return this.limit(n);
  }

  /**
   * Get first result
   */
  first(): this {
    return this.limit(1);
  }

  /**
   * Get the built query options
   */
  build(): QueryOptions {
    return { ...this.options };
  }

  /**
   * Get the table name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Clone the query builder
   */
  clone(): QueryBuilder<T> {
    const cloned = new QueryBuilder<T>(this.tableName);
    cloned.options = JSON.parse(JSON.stringify(this.options));
    return cloned;
  }

  /**
   * Reset the query builder
   */
  reset(): this {
    this.options = {};
    return this;
  }
}

// ============= Query Executor Interface =============

/**
 * Interface for query executors that work with Supabase client
 */
export interface QueryExecutor {
  executeQuery<T>(tableName: string, options: QueryOptions): Promise<T[]>;
  executePaginated<T>(tableName: string, options: QueryOptions): Promise<PaginatedResult<T>>;
  executeCount(tableName: string, options: QueryOptions): Promise<number>;
}

// ============= Query Utils =============

/**
 * Build a Supabase query from options
 */
export function buildSupabaseQuery(
  client: { from: (table: string) => unknown },
  tableName: string,
  options: QueryOptions
): unknown {
  let query = client.from(tableName);

  // Apply select
  if (options.select && options.select.length > 0) {
    query = (query as { select: (cols: string) => unknown }).select(options.select.join(','));
  } else {
    query = (query as { select: (cols: string) => unknown }).select('*');
  }

  // Apply filters
  if (options.filters) {
    for (const filter of options.filters) {
      query = applyFilter(query, filter);
    }
  }

  // Apply soft delete filter
  if (!options.includeDeleted && options.deletedColumn) {
    query = (query as { is: (col: string, val: unknown) => unknown }).is(options.deletedColumn, null);
  }

  // Apply sorting
  if (options.sort) {
    for (const sort of options.sort) {
      query = (query as { order: (col: string, opts: { ascending: boolean }) => unknown }).order(
        sort.column,
        { ascending: sort.direction === 'asc' }
      );
    }
  }

  // Apply pagination
  if (options.pagination) {
    const { page, limit } = options.pagination;
    const offset = (page - 1) * limit;
    query = (query as { range: (start: number, end: number) => unknown }).range(offset, offset + limit - 1);
  }

  return query;
}

/**
 * Apply a filter to a query
 */
function applyFilter(
  query: unknown,
  filter: FilterCondition
): unknown {
  const q = query as Record<string, (col: string, val?: unknown) => unknown>;
  
  switch (filter.operator) {
    case 'eq':
      return q.eq(filter.column, filter.value);
    case 'neq':
      return q.neq(filter.column, filter.value);
    case 'gt':
      return q.gt(filter.column, filter.value);
    case 'gte':
      return q.gte(filter.column, filter.value);
    case 'lt':
      return q.lt(filter.column, filter.value);
    case 'lte':
      return q.lte(filter.column, filter.value);
    case 'like':
      return q.like(filter.column, filter.value);
    case 'ilike':
      return q.ilike(filter.column, filter.value);
    case 'in':
      return q.in(filter.column, filter.value as unknown[]);
    case 'not.in': {
      // Use not() method if available, otherwise use notIn pattern
      const notQ = q as Record<string, (col: string, op: string, val: unknown) => unknown>;
      if (typeof notQ.not === 'function') {
        return notQ.not(filter.column, 'in', filter.value);
      }
      return q;
    }
    case 'is':
      return q.is(filter.column, filter.value);
    case 'not.is': {
      const notQ = q as Record<string, (col: string, op: string, val: unknown) => unknown>;
      if (typeof notQ.not === 'function') {
        return notQ.not(filter.column, 'is', filter.value);
      }
      return q;
    }
    case 'contains':
      return q.contains(filter.column, filter.value);
    case 'contained':
      return q.containedBy ? q.containedBy(filter.column, filter.value) : q.contains(filter.column, filter.value);
    default:
      logger.warn(`Unknown filter operator: ${filter.operator}`);
      return query;
  }
}

// ============= Convenience Functions =============

/**
 * Create a query builder for a table
 */
export function query<K = Record<string, unknown>>(tableName: string): QueryBuilder<K> {
  return QueryBuilder.from<K>(tableName);
}

/**
 * Create a paginated result
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

/**
 * Calculate pagination offset
 */
export function calculateOffset(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

/**
 * Calculate total pages
 */
export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page: number, limit: number, maxLimit: number = 100): {
  page: number;
  limit: number;
} {
  return {
    page: Math.max(1, Math.floor(page)),
    limit: Math.min(Math.max(1, Math.floor(limit)), maxLimit),
  };
}
