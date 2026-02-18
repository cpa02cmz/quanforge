/**
 * Query Executor
 * Executes batched queries against the database
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BatchQuery, BatchOperation } from './queryQueue';
import { QueryOptimizer } from './queryOptimizer';

export interface BatchResult {
  id: string;
  data?: unknown;
  error?: unknown;
  executionTime: number;
}

export interface QueryGroup {
  table?: string;
  operation: BatchOperation;
  queries: BatchQuery[];
}

export class QueryExecutor {
  private optimizer = new QueryOptimizer();

  /**
   * Execute a batch of queries grouped by table and operation
   */
  async executeBatch(
    client: SupabaseClient,
    batch: BatchQuery[]
  ): Promise<BatchResult[]> {
    const groupedQueries = this.optimizer.groupByTableAndOperation(batch);
    const results: BatchResult[] = [];

    for (const group of groupedQueries) {
      try {
        const groupResults = await this.executeQueryGroup(client, group);
        results.push(...groupResults);
      } catch (error: unknown) {
        // Add error results for all queries in this group
        const errorResults = group.queries.map(query => ({
          id: query.id,
          error,
          executionTime: 0
        }));
        results.push(...errorResults);
      }
    }

    return results;
  }

  /**
   * Execute a group of related queries
   */
  private async executeQueryGroup(
    client: SupabaseClient,
    group: QueryGroup
  ): Promise<BatchResult[]> {
    const { operation, queries } = group;

    switch (operation) {
      case 'select':
        return this.executeSelectQueries(client, queries);
      case 'insert':
        return this.executeInsertQueries(client, queries);
      case 'update':
        return this.executeUpdateQueries(client, queries);
      case 'delete':
        return this.executeDeleteQueries(client, queries);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  /**
   * Execute SELECT queries with optimization
   */
  private async executeSelectQueries(
    client: SupabaseClient,
    queries: BatchQuery[]
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    const combinedQueries = this.optimizer.combineSelectQueries(queries);

    for (const combined of combinedQueries) {
      const startTime = performance.now();
      
      try {
        // Build query chain
        let queryBuilder: unknown = client.from(combined.table);

        // Apply select columns first
        if (combined.selectColumns) {
          queryBuilder = (queryBuilder as { select: (cols: string) => unknown }).select(combined.selectColumns);
        } else {
          queryBuilder = (queryBuilder as { select: (cols: string) => unknown }).select('*');
        }

        // Apply combined filters
        if (combined.combinedFilters) {
          for (const filter of combined.combinedFilters) {
            queryBuilder = (queryBuilder as { eq: (col: string, val: unknown) => unknown }).eq(filter.column, filter.value);
          }
        }

        const response = await queryBuilder as { data?: unknown; error?: unknown };
        const { data, error } = response;
        const executionTime = performance.now() - startTime;

        // Distribute results back to original queries
        for (const originalQuery of combined.originalQueries) {
          results.push({
            id: originalQuery.id,
            data: error ? undefined : data,
            error: error || undefined,
            executionTime
          });
        }
      } catch (error: unknown) {
        const executionTime = performance.now() - startTime;
        for (const originalQuery of combined.originalQueries) {
          results.push({
            id: originalQuery.id,
            error,
            executionTime
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute INSERT queries
   */
  private async executeInsertQueries(
    client: SupabaseClient,
    queries: BatchQuery[]
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const query of queries) {
      const startTime = performance.now();
      
      try {
        const { data, error } = await client
          .from(query.table!)
          .insert(query.params?.[0] || {});

        results.push({
          id: query.id,
          data,
          error,
          executionTime: performance.now() - startTime
        });
      } catch (error: unknown) {
        results.push({
          id: query.id,
          error,
          executionTime: performance.now() - startTime
        });
      }
    }

    return results;
  }

  /**
   * Execute UPDATE queries
   */
  private async executeUpdateQueries(
    client: SupabaseClient,
    queries: BatchQuery[]
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const query of queries) {
      const startTime = performance.now();
      
      try {
        const [updateData, filterCondition] = query.params || [{}, {}];
        let queryBuilder = client.from(query.table!).update(updateData);

        // Apply filter conditions
        for (const [column, value] of Object.entries(filterCondition as Record<string, unknown>)) {
          queryBuilder = queryBuilder.eq(column, value);
        }

        const { data, error } = await queryBuilder;

        results.push({
          id: query.id,
          data,
          error,
          executionTime: performance.now() - startTime
        });
      } catch (error: unknown) {
        results.push({
          id: query.id,
          error,
          executionTime: performance.now() - startTime
        });
      }
    }

    return results;
  }

  /**
   * Execute DELETE queries
   */
  private async executeDeleteQueries(
    client: SupabaseClient,
    queries: BatchQuery[]
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const query of queries) {
      const startTime = performance.now();
      
      try {
        let queryBuilder = client.from(query.table!).delete();

        // Apply filter conditions
        if (query.params && query.params.length > 0) {
          const filterCondition = query.params[0] as Record<string, unknown>;
          for (const [column, value] of Object.entries(filterCondition)) {
            queryBuilder = queryBuilder.eq(column, value);
          }
        }

        const { data, error } = await queryBuilder;

        results.push({
          id: query.id,
          data,
          error,
          executionTime: performance.now() - startTime
        });
      } catch (error: unknown) {
        results.push({
          id: query.id,
          error,
          executionTime: performance.now() - startTime
        });
      }
    }

    return results;
  }
}
