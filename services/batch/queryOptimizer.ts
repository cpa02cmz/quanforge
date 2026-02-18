/**
 * Query Optimizer
 * Combines and optimizes queries for better performance
 */

import { BatchQuery } from './queryQueue';
import { createScopedLogger } from '../../utils/logger';

const logger = () => createScopedLogger('QueryOptimizer');

export interface CombinedQuery {
  table: string;
  originalQueries: BatchQuery[];
  combinedFilters?: Array<{ column: string; operator: string; value: unknown }>;
  selectColumns?: string;
}

export class QueryOptimizer {
  /**
   * Group queries by table and operation for batch optimization
   */
  groupByTableAndOperation(batch: BatchQuery[]): Array<{
    table?: string;
    operation: BatchQuery['operation'];
    queries: BatchQuery[];
  }> {
    const groups = new Map<string, {
      table?: string;
      operation: BatchQuery['operation'];
      queries: BatchQuery[];
    }>();

    for (const query of batch) {
      const key = `${query.table || 'no-table'}-${query.operation}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          table: query.table,
          operation: query.operation,
          queries: []
        });
      }
      
      groups.get(key)!.queries.push(query);
    }

    return Array.from(groups.values());
  }

  /**
   * Combine compatible SELECT queries for better performance
   */
  combineSelectQueries(queries: BatchQuery[]): CombinedQuery[] {
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

    for (const [groupKey, groupQueries] of groups) {
      const parts = groupKey.split('-');
      const tableName = parts[0] || 'unknown';
      const selectColumns = parts[1];
      
      combined.push({
        table: tableName,
        originalQueries: groupQueries,
        selectColumns: selectColumns !== 'undefined' ? selectColumns : undefined,
        combinedFilters: this.extractFilters(groupQueries)
      });
    }

    logger().debug(`Combined ${queries.length} queries into ${combined.length} groups`);
    return combined;
  }

  /**
   * Extract select columns from query string
   */
  private extractSelectColumns(query: BatchQuery): string {
    const match = query.query.match(/select\s+(.+?)\s+from/i);
    return match && match[1] ? match[1].trim() : '*';
  }

  /**
   * Extract filters from queries
   */
  private extractFilters(queries: BatchQuery[]): Array<{ column: string; operator: string; value: unknown }> {
    const filters: Array<{ column: string; operator: string; value: unknown }> = [];
    
    for (const query of queries) {
      if (query.params && query.params.length > 0) {
        // Extract filter information from parameters
        // This would need to be more sophisticated in practice
        // For now, just log that we have params
        logger().debug(`Query ${query.id} has ${query.params.length} parameters`);
      }
    }

    return filters;
  }

  /**
   * Check if queries can be combined
   */
  canCombine(queries: BatchQuery[]): boolean {
    if (queries.length < 2) return false;
    
    const firstTable = queries[0]?.table;
    return queries.every(q => q.table === firstTable && q.operation === 'select');
  }
}
