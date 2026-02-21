/**
 * Database Query Builder
 * 
 * Provides a type-safe, fluent interface for building database queries.
 * Supports filtering, sorting, pagination, and complex conditions.
 * 
 * @module services/database/queryBuilder
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../../types';
import { COUNT_CONSTANTS } from '../modularConstants';
import { 
  RobotFilterDTO, 
  PaginationParams, 
  PaginatedResponse,
  StrategyType
} from '../../types/database';

const logger = createScopedLogger('QueryBuilder');

// ============================================================================
// TYPES
// ============================================================================

export type SortDirection = 'asc' | 'desc';
export type LogicalOperator = 'and' | 'or';

export interface FilterCondition {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'cs' | 'cd';
  value: unknown;
}

export interface FilterGroup {
  operator: LogicalOperator;
  conditions: Array<FilterCondition | FilterGroup>;
}

export interface SortOption {
  column: string;
  direction: SortDirection;
  nulls?: 'first' | 'last';
}

export interface QueryOptions {
  select?: string[];
  filters?: FilterGroup;
  sorts?: SortOption[];
  pagination?: PaginationParams;
  includeSoftDeleted?: boolean;
}

export interface BuildResult {
  query: string;
  params: unknown[];
  filters: FilterCondition[];
}

// ============================================================================
// QUERY BUILDER CLASS
// ============================================================================

/**
 * Type-safe query builder for database operations
 */
export class QueryBuilder<T = Record<string, unknown>> {
  private tableName: string;
  private client: SupabaseClient;
  private selectFields: string[] = ['*'];
  private filterGroup: FilterGroup = { operator: 'and', conditions: [] };
  private sortOptions: SortOption[] = [];
  private paginationParams: PaginationParams | null = null;
  private includeSoftDeleted: boolean = false;
  private _limit: number | null = null;
  private _offset: number | null = null;

  constructor(client: SupabaseClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  // ============================================================================
  // SELECT METHODS
  // ============================================================================

  /**
   * Specify columns to select
   */
  select(...columns: string[]): this {
    this.selectFields = columns;
    return this;
  }

  /**
   * Select all columns
   */
  selectAll(): this {
    this.selectFields = ['*'];
    return this;
  }

  // ============================================================================
  // FILTER METHODS
  // ============================================================================

  /**
   * Add equality filter
   */
  where(column: keyof T, value: unknown): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'eq',
      value,
    });
    return this;
  }

  /**
   * Add inequality filter
   */
  whereNot(column: keyof T, value: unknown): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'neq',
      value,
    });
    return this;
  }

  /**
   * Add greater than filter
   */
  whereGreaterThan(column: keyof T, value: unknown): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'gt',
      value,
    });
    return this;
  }

  /**
   * Add greater than or equal filter
   */
  whereGreaterThanOrEqual(column: keyof T, value: unknown): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'gte',
      value,
    });
    return this;
  }

  /**
   * Add less than filter
   */
  whereLessThan(column: keyof T, value: unknown): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'lt',
      value,
    });
    return this;
  }

  /**
   * Add less than or equal filter
   */
  whereLessThanOrEqual(column: keyof T, value: unknown): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'lte',
      value,
    });
    return this;
  }

  /**
   * Add LIKE filter (case-sensitive)
   */
  whereLike(column: keyof T, pattern: string): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'like',
      value: pattern,
    });
    return this;
  }

  /**
   * Add ILIKE filter (case-insensitive)
   */
  whereILike(column: keyof T, pattern: string): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'ilike',
      value: pattern,
    });
    return this;
  }

  /**
   * Add IN filter
   */
  whereIn(column: keyof T, values: unknown[]): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'in',
      value: values,
    });
    return this;
  }

  /**
   * Add IS NULL or IS NOT NULL filter
   */
  whereNull(column: keyof T, isNull: boolean = true): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'is',
      value: isNull ? null : 'not.null',
    });
    return this;
  }

  /**
   * Add contains filter for arrays/JSONB
   */
  whereContains(column: keyof T, value: unknown): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'cs',
      value,
    });
    return this;
  }

  /**
   * Add contained by filter for arrays/JSONB
   */
  whereContainedBy(column: keyof T, value: unknown): this {
    this.filterGroup.conditions.push({
      column: column as string,
      operator: 'cd',
      value,
    });
    return this;
  }

  /**
   * Add OR conditions
   */
  or(conditions: (builder: QueryBuilder<T>) => void): this {
    const orBuilder = new QueryBuilder<T>(this.client, this.tableName);
    conditions(orBuilder);
    
    if (orBuilder.filterGroup.conditions.length > 0) {
      this.filterGroup.conditions.push({
        operator: 'or',
        conditions: orBuilder.filterGroup.conditions,
      });
    }
    return this;
  }

  /**
   * Add AND conditions group
   */
  and(conditions: (builder: QueryBuilder<T>) => void): this {
    const andBuilder = new QueryBuilder<T>(this.client, this.tableName);
    conditions(andBuilder);
    
    if (andBuilder.filterGroup.conditions.length > 0) {
      this.filterGroup.conditions.push({
        operator: 'and',
        conditions: andBuilder.filterGroup.conditions,
      });
    }
    return this;
  }

  /**
   * Filter by search term on multiple columns
   */
  search(term: string, columns: (keyof T)[]): this {
    if (!term || columns.length === 0) return this;

    const searchConditions: FilterCondition[] = columns.map((col) => ({
      column: col as string,
      operator: 'ilike' as const,
      value: `%${term}%`,
    }));

    this.filterGroup.conditions.push({
      operator: 'or',
      conditions: searchConditions,
    });
    return this;
  }

  /**
   * Filter by date range
   */
  whereDateRange(column: keyof T, startDate?: Date, endDate?: Date): this {
    if (startDate) {
      this.whereGreaterThanOrEqual(column, startDate.toISOString());
    }
    if (endDate) {
      this.whereLessThanOrEqual(column, endDate.toISOString());
    }
    return this;
  }

  /**
   * Include soft-deleted records
   */
  withSoftDeleted(): this {
    this.includeSoftDeleted = true;
    return this;
  }

  // ============================================================================
  // SORT METHODS
  // ============================================================================

  /**
   * Add sort order
   */
  orderBy(column: keyof T, direction: SortDirection = 'asc'): this {
    this.sortOptions.push({
      column: column as string,
      direction,
    });
    return this;
  }

  /**
   * Sort ascending
   */
  orderByAsc(column: keyof T): this {
    return this.orderBy(column, 'asc');
  }

  /**
   * Sort descending
   */
  orderByDesc(column: keyof T): this {
    return this.orderBy(column, 'desc');
  }

  /**
   * Sort by creation date (newest first)
   */
  latest(): this {
    return this.orderByDesc('created_at' as keyof T);
  }

  /**
   * Sort by creation date (oldest first)
   */
  oldest(): this {
    return this.orderByAsc('created_at' as keyof T);
  }

  // ============================================================================
  // PAGINATION METHODS
  // ============================================================================

  /**
   * Set pagination parameters
   */
  paginate(page: number, limit: number): this {
    this.paginationParams = {
      page: Math.max(1, page),
      limit: Math.max(1, Math.min(100, limit)),
    };
    return this;
  }

  /**
   * Set limit
   */
  limit(count: number): this {
    this._limit = Math.max(1, count);
    return this;
  }

  /**
   * Set offset
   */
  offset(count: number): this {
    this._offset = Math.max(0, count);
    return this;
  }

  // ============================================================================
  // EXECUTION METHODS
  // ============================================================================

  /**
   * Execute query and return results
   */
  async execute(): Promise<{ data: T[] | null; error: any; count?: number }> {
    try {
      let query = this.client
        .from(this.tableName)
        .select(this.selectFields.join(','), { count: 'exact' });

      // Apply soft delete filter
      if (!this.includeSoftDeleted) {
        query = query.is('deleted_at', null);
      }

      // Apply filters
      query = this.applyFilters(query);

      // Apply sorting
      for (const sort of this.sortOptions) {
        query = query.order(sort.column, { 
          ascending: sort.direction === 'asc',
          nullsFirst: sort.nulls === 'first' ? true : sort.nulls === 'last' ? false : undefined,
        });
      }

      // Apply pagination
      if (this.paginationParams) {
        const { page, limit } = this.paginationParams;
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);
      } else if (this._limit !== null) {
        query = query.limit(this._limit);
      }

      if (this._offset !== null) {
        query = query.range(this._offset, this._offset + (this._limit || COUNT_CONSTANTS.PAGINATION.DEFAULT) - 1);
      }

      const result = await query;

      return {
        data: result.data as T[] | null,
        error: result.error,
        count: result.count ?? undefined,
      };
    } catch (error) {
      logger.error('Query execution failed:', error);
      return { data: null, error };
    }
  }

  /**
   * Execute query and return paginated response
   */
  async executePaginated(): Promise<PaginatedResponse<T>> {
    const page = this.paginationParams?.page || 1;
    const limit = this.paginationParams?.limit || COUNT_CONSTANTS.PAGINATION.DEFAULT;

    const { data, error, count } = await this.execute();

    if (error) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total_count: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false,
        },
      };
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: data || [],
      pagination: {
        page,
        limit,
        total_count: totalCount,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };
  }

  /**
   * Get single result
   */
  async first(): Promise<T | null> {
    this._limit = 1;
    const { data, error } = await this.execute();

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0];
  }

  /**
   * Get result count
   */
  async count(): Promise<number> {
    try {
      let query = this.client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      if (!this.includeSoftDeleted) {
        query = query.is('deleted_at', null);
      }

      query = this.applyFilters(query);

      const { count } = await query;
      return count || 0;
    } catch (error) {
      logger.error('Count query failed:', error);
      return 0;
    }
  }

  /**
   * Check if any records exist
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private applyFilters(query: any): any {
    const applyCondition = (q: any, condition: FilterCondition | FilterGroup): any => {
      if ('operator' in condition && 'conditions' in condition) {
        // This is a FilterGroup
        const groupConditions = condition.conditions
          .map((c) => this.conditionToString(c))
          .filter(Boolean)
          .join(`.${condition.operator}(`);
        
        if (groupConditions) {
          return q.or(groupConditions);
        }
        return q;
      }

      // This is a FilterCondition
      const { column, operator, value } = condition as FilterCondition;

      switch (operator) {
        case 'eq':
          return q.eq(column, value);
        case 'neq':
          return q.neq(column, value);
        case 'gt':
          return q.gt(column, value);
        case 'gte':
          return q.gte(column, value);
        case 'lt':
          return q.lt(column, value);
        case 'lte':
          return q.lte(column, value);
        case 'like':
          return q.like(column, value as string);
        case 'ilike':
          return q.ilike(column, value as string);
        case 'in':
          return q.in(column, value as unknown[]);
        case 'is':
          return value === null ? q.is(column, null) : q.not(column, 'is', null);
        case 'cs':
          return q.contains(column, value);
        case 'cd':
          return q.containedBy(column, value);
        default:
          return q;
      }
    };

    for (const condition of this.filterGroup.conditions) {
      query = applyCondition(query, condition);
    }

    return query;
  }

  private conditionToString(condition: FilterCondition | FilterGroup): string {
    if ('conditions' in condition) {
      return condition.conditions
        .map((c) => this.conditionToString(c))
        .join(',');
    }

    const { column, operator, value } = condition;
    const operatorMap: Record<string, string> = {
      eq: 'eq',
      neq: 'neq',
      gt: 'gt',
      gte: 'gte',
      lt: 'lt',
      lte: 'lte',
      like: 'like',
      ilike: 'ilike',
      in: 'in',
      is: 'is',
    };

    return `${column}.${operatorMap[operator] || 'eq'}.${value}`;
  }
}

// ============================================================================
// SPECIALIZED ROBOT QUERY BUILDER
// ============================================================================

/**
 * Type-safe query builder specifically for Robot entity
 */
export class RobotQueryBuilder extends QueryBuilder<Robot> {
  constructor(client: SupabaseClient) {
    super(client, 'robots');
  }

  /**
   * Filter by user ID
   */
  byUser(userId: string): this {
    return this.where('user_id', userId);
  }

  /**
   * Filter by strategy type
   */
  byStrategy(strategyType: StrategyType): this {
    return this.where('strategy_type', strategyType);
  }

  /**
   * Filter active robots only
   */
  activeOnly(): this {
    return this.where('is_active', true);
  }

  /**
   * Filter public robots only
   */
  publicOnly(): this {
    return this.where('is_public', true);
  }

  /**
   * Filter by name or description search
   */
  searchRobots(term: string): this {
    return this.search(term, ['name', 'description']);
  }

  /**
   * Filter recently updated robots
   */
  recentlyUpdated(days: number = 7): this {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.whereGreaterThanOrEqual('updated_at', date.toISOString());
  }

  /**
   * Filter popular robots (by view count)
   */
  popular(minViews: number = 100): this {
    return this.whereGreaterThan('view_count', minViews);
  }

  /**
   * Order by popularity
   */
  orderByPopularity(): this {
    return this.orderByDesc('view_count');
  }

  /**
   * Order by copy count
   */
  orderByCopyCount(): this {
    return this.orderByDesc('copy_count');
  }

  /**
   * Apply filter DTO
   */
  applyFilterDTO(filter: RobotFilterDTO): this {
    if (filter.user_id) this.byUser(filter.user_id);
    if (filter.strategy_type && filter.strategy_type !== 'All') {
      this.byStrategy(filter.strategy_type as StrategyType);
    }
    if (filter.is_active !== undefined) this.where('is_active', filter.is_active);
    if (filter.is_public !== undefined) this.where('is_public', filter.is_public);
    if (filter.search_term) this.searchRobots(filter.search_term);
    if (filter.created_after) this.whereGreaterThanOrEqual('created_at', filter.created_after);
    if (filter.created_before) this.whereLessThanOrEqual('created_at', filter.created_before);
    if (filter.updated_after) this.whereGreaterThanOrEqual('updated_at', filter.updated_after);
    if (filter.updated_before) this.whereLessThanOrEqual('updated_at', filter.updated_before);

    return this;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a query builder for a table
 */
export function query<T extends Record<string, unknown>>(
  client: SupabaseClient,
  tableName: string
): QueryBuilder<T> {
  return new QueryBuilder<T>(client, tableName);
}

/**
 * Create a robot query builder
 */
export function robotQuery(client: SupabaseClient): RobotQueryBuilder {
  return new RobotQueryBuilder(client);
}
