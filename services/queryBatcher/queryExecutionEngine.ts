/**
 * Query Execution Engine
 * Handles batched query execution and optimization
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BatchQuery, BatchResult, CombinedQuery } from './queryTypes';

export class QueryExecutionEngine {
  private retryCount = new Map<string, number>();

  constructor(
    private client: SupabaseClient,
    private config: { retryAttempts: number; retryDelay: number }
  ) {}

  /**
   * Execute a batch of queries
   */
  async executeBatch(batch: BatchQuery[]): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    
    // Group queries by operation type
    const groupedQueries = this.groupQueriesByOperation(batch);
    
    // Execute each group
    for (const [operation, queries] of groupedQueries.entries()) {
      try {
        const operationResults = await this.executeOperation(operation, queries);
        results.push(...operationResults);
      } catch (error: unknown) {
        // Handle operation-level errors
        const errorResults = queries.map(query => ({
          id: query.id,
          error: {
            code: 'OPERATION_FAILED',
            message: `Failed to execute ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'database',
            status: 500,
            details: { operation, originalError: error instanceof Error ? error.message : error }
          } as any,
          executionTime: 0
        }));
        results.push(...errorResults);
      }
    }

    return results;
  }

  /**
   * Execute SELECT queries with optimization
   */
  private async executeSelectQueries(queries: BatchQuery[]): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    const startTime = performance.now();

    try {
      // Try to combine compatible SELECT queries
      const combinedQueries = this.combineSelectQueries(queries);

      for (const combined of combinedQueries) {
        const combinedResults = await this.executeCombinedSelect(combined);
        const executionTime = performance.now() - startTime;
        
        // Add execution time to results
        combinedResults.forEach(result => {
          result.executionTime = executionTime / combinedResults.length; // Distribute time evenly
        });
        
        results.push(...combinedResults);
      }
    } catch (error: unknown) {
      return this.createErrorResults(queries, error as any);
    }

    return results;
  }

  /**
   * Execute INSERT queries 
   */
  private async executeInsertQueries(queries: BatchQuery[]): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const query of queries) {
      try {
        const result = await this.executeSingleQuery(query);
        results.push(result);
      } catch (error: unknown) {
        results.push(this.createErrorResult(query, error as any));
      }
    }

    return results;
  }

  /**
   * Execute UPDATE queries
   */
  private async executeUpdateQueries(queries: BatchQuery[]): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const query of queries) {
      try {
        const result = await this.executeSingleQuery(query);
        results.push(result);
      } catch (error: unknown) {
        results.push(this.createErrorResult(query, error as any));
      }
    }

    return results;
  }

  /**
   * Execute DELETE queries
   */
  private async executeDeleteQueries(queries: BatchQuery[]): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const query of queries) {
      try {
        const result = await this.executeSingleQuery(query);
        results.push(result);
      } catch (error: unknown) {
        results.push(this.createErrorResult(query, error as any));
      }
    }

    return results;
  }

  /**
   * Execute a single query with retry logic
   */
  private async executeSingleQuery(query: BatchQuery): Promise<BatchResult> {
    const startTime = performance.now();
    const retryKey = `${query.id}_${Date.now()}`;

    try {
      let result: any;

      switch (query.operation) {
        case 'select':
          result = await this.executeSelect(query);
          break;
        case 'insert':
          result = await this.executeInsert(query);
          break;
        case 'update':
          result = await this.executeUpdate(query);
          break;
        case 'delete':
          result = await this.executeDelete(query);
          break;
        default:
          throw new Error(`Unsupported operation: ${query.operation}`);
      }

      const executionTime = performance.now() - startTime;
      this.retryCount.delete(retryKey);

      return {
        id: query.id,
        data: result.data,
        executionTime
      };
    } catch (error: unknown) {
      const executionTime = performance.now() - startTime;
      
      // Check if we should retry
      const currentRetries = this.retryCount.get(retryKey) || 0;
      if (currentRetries < this.config.retryAttempts) {
        this.retryCount.set(retryKey, currentRetries + 1);
        
        // Wait before retry
        await this.delay(this.config.retryDelay * Math.pow(2, currentRetries)); // Exponential backoff
        
        return this.executeSingleQuery(query);
      }

      this.retryCount.delete(retryKey);
      return {
        id: query.id,
        error: {
          code: 'QUERY_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'database',
          status: 500,
          details: { query: query.query, retries: currentRetries }
        } as any,
        executionTime
      };
    }
  }

/**
   * Execute SELECT query
   */
  private async executeSelect(query: BatchQuery): Promise<{ data: any }> {
    const queryBuilder = this.client.from(query.table || 'unknown');
    const result = await queryBuilder.select('*').limit(1000);
    
    if (result.error) {
      throw result.error;
    }

    return { data: result.data };
  }

  /**
   * Execute INSERT query
   */
  private async executeInsert(query: BatchQuery): Promise<{ data: any }> {
    if (!query.table) {
      throw new Error('Table name required for INSERT operations');
    }

    const { data, error } = await this.client
      .from(query.table)
      .insert(query.params || []);

    if (error) {
      throw error;
    }

    return { data };
  }

  /**
   * Execute UPDATE query
   */
  private async executeUpdate(query: BatchQuery): Promise<{ data: any }> {
    if (!query.table) {
      throw new Error('Table name required for UPDATE operations');
    }

    const { data, error } = await this.client
      .from(query.table)
      .update(query.params?.[0] || {})
      .match(query.params?.[1] || {});

    if (error) {
      throw error;
    }

    return { data };
  }

  /**
   * Execute DELETE query
   */
  private async executeDelete(query: BatchQuery): Promise<{ data: any }> {
    if (!query.table) {
      throw new Error('Table name required for DELETE operations');
    }

    const { data, error } = await this.client
      .from(query.table)
      .delete()
      .match(query.params?.[0] || {});

    if (error) {
      throw error;
    }

    return { data };
  }

  /**
   * Execute combined SELECT queries
   */
  private async executeCombinedSelect(combined: CombinedQuery): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    const startTime = performance.now();

    try {
      // Simplified combined query execution
      const baseQuery = this.client.from(combined.table);
      const result = await baseQuery.select('*').limit(1000);
      
      if (result.error) {
        return this.createErrorResults(combined.originalQueries, result.error as any);
      }

      const data = result.data;
      const executionTime = performance.now() - startTime;

      // Distribute results back to original queries
      for (const originalQuery of combined.originalQueries) {
        const queryData = this.filterDataForQuery(data, originalQuery);
        results.push({
          id: originalQuery.id,
          data: queryData,
          executionTime: executionTime / combined.originalQueries.length
        });
      }
    } catch (error: unknown) {
      return this.createErrorResults(combined.originalQueries, error as any);
    }

    return results;
  }

  /**
   * Group queries by operation type
   */
  private groupQueriesByOperation(queries: BatchQuery[]): Map<string, BatchQuery[]> {
    const groups = new Map<string, BatchQuery[]>();
    
    for (const query of queries) {
      if (!groups.has(query.operation)) {
        groups.set(query.operation, []);
      }
      groups.get(query.operation)!.push(query);
    }

    return groups;
  }

  /**
   * Execute operation based on type
   */
  private async executeOperation(operation: string, queries: BatchQuery[]): Promise<BatchResult[]> {
    switch (operation) {
      case 'select':
        return this.executeSelectQueries(queries);
      case 'insert':
        return this.executeInsertQueries(queries);
      case 'update':
        return this.executeUpdateQueries(queries);
      case 'delete':
        return this.executeDeleteQueries(queries);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  /**
   * Combine compatible SELECT queries
   */
  private combineSelectQueries(queries: BatchQuery[]): CombinedQuery[] {
    const groups = new Map<string, BatchQuery[]>();

    // Group by table and select columns
    for (const query of queries) {
      const key = `${query.table || 'unknown'}-${this.extractSelectColumns(query)}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(query);
    }

    const combined: CombinedQuery[] = [];
    for (const [key, groupQueries] of groups) {
      const [table, selectColumns] = key.split('-');
      
      combined.push({
        table,
        originalQueries: groupQueries,
        selectColumns: selectColumns !== 'undefined' ? selectColumns : undefined,
        combinedFilters: this.extractFilters(groupQueries)
      });
    }

    return combined;
  }

  /**
   * Extract select columns from query
   */
  private extractSelectColumns(query: BatchQuery): string {
    const match = query.query.match(/select\s+(.+?)\s+from/i);
    return match ? match[1].trim() : '*';
  }

  /**
   * Extract filters from queries
   */
  private extractFilters(queries: BatchQuery[]): Array<{ column: string; operator: string; value: any }> {
    const filters: Array<{ column: string; operator: string; value: any }> = [];
    
    // This is a simplified implementation
    // In reality, you'd parse the SQL WHERE clauses properly
    for (const query of queries) {
      const whereMatch = query.query.match(/where\s+(.+?)(?:\s+(order|limit|group|$))/i);
      if (whereMatch) {
        const whereClause = whereMatch[1];
        // Simple parsing for basic filters
        const filterMatches = whereClause.match(/(\w+)\s*(=|>|<|>=|<=)\s*'?([^'\s]+)'?/g);
        if (filterMatches) {
          for (const match of filterMatches) {
            const filterMatch = match.match(/(\w+)\s*(=|>|<|>=|<=)\s*'?([^'\s]+)'?/);
            if (filterMatch) {
              filters.push({
                column: filterMatch[1],
                operator: filterMatch[2],
                value: filterMatch[3]
              });
            }
          }
        }
      }
    }

    return filters;
  }

  /**
   * Filter data for specific query
   */
  private filterDataForQuery(data: any[], _query: BatchQuery): any[] {
    // This is a simplified implementation
    // In reality, you'd filter the combined data based on the specific query requirements
    return data;
  }

  /**
   * Create error results for multiple queries
   */
  private createErrorResults(queries: BatchQuery[], error: any): BatchResult[] {
    return queries.map(query => this.createErrorResult(query, error));
  }

  /**
   * Create error result for a single query
   */
  private createErrorResult(query: BatchQuery, error: any): BatchResult {
    return {
      id: query.id,
      error: {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'database',
        status: 500,
        details: { query: query.query, originalError: error }
      } as any,
      executionTime: 0
    };
  }

  /**
   * Delay function for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}