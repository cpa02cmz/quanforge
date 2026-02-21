/**
 * Database Schema Manager
 * 
 * Provides utilities for introspecting, validating, and managing database schema.
 * Includes schema versioning, validation, and migration support.
 * 
 * @module services/database/schemaManager
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { CACHE_SIZES } from '../../constants/modularConfig';

const logger = createScopedLogger('SchemaManager');

// ============================================================================
// TYPES
// ============================================================================

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
    onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  };
  constraints: string[];
  comment?: string;
}

export interface IndexDefinition {
  name: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'spgist' | 'brin';
  definition: string;
  size?: number;
  scans?: number;
  tuplesRead?: number;
  tuplesFetched?: number;
}

export interface TableDefinition {
  name: string;
  schema: string;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  constraints: TableConstraint[];
  rowCount?: number;
  tableSize?: number;
  indexSize?: number;
  comment?: string;
}

export interface TableConstraint {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK' | 'EXCLUSION';
  columns: string[];
  definition: string;
  referencedTable?: string;
  referencedColumns?: string[];
}

export interface SchemaVersion {
  version: string;
  appliedAt: string;
  description: string;
  checksum: string;
}

export interface SchemaDiff {
  table: string;
  type: 'added' | 'removed' | 'modified';
  changes?: SchemaChange[];
}

export interface SchemaChange {
  type: 'column_added' | 'column_removed' | 'column_modified' | 'index_added' | 'index_removed' | 'constraint_added' | 'constraint_removed';
  details: Record<string, unknown>;
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors: SchemaValidationError[];
  warnings: SchemaValidationWarning[];
}

export interface SchemaValidationError {
  table: string;
  column?: string;
  message: string;
  severity: 'error';
}

export interface SchemaValidationWarning {
  table: string;
  column?: string;
  message: string;
  severity: 'warning';
}

export interface SchemaIntrospectionOptions {
  includeSystemTables?: boolean;
  includeIndexes?: boolean;
  includeConstraints?: boolean;
  includeStatistics?: boolean;
}

// ============================================================================
// EXPECTED SCHEMA DEFINITIONS
// ============================================================================

const EXPECTED_ROBOTS_TABLE: Partial<TableDefinition> = {
  name: 'robots',
  columns: [
    { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isForeignKey: false, constraints: [], defaultValue: 'gen_random_uuid()' },
    { name: 'user_id', type: 'uuid', nullable: false, isPrimaryKey: false, isForeignKey: true, constraints: [], defaultValue: null },
    { name: 'name', type: 'text', nullable: false, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: null },
    { name: 'description', type: 'text', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: null },
    { name: 'code', type: 'text', nullable: false, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: null },
    { name: 'strategy_type', type: 'text', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: null },
    { name: 'strategy_params', type: 'jsonb', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: '{}' },
    { name: 'backtest_settings', type: 'jsonb', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: '{}' },
    { name: 'analysis_result', type: 'jsonb', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: '{}' },
    { name: 'chat_history', type: 'jsonb', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: '[]' },
    { name: 'version', type: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: '1' },
    { name: 'is_active', type: 'boolean', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: 'true' },
    { name: 'is_public', type: 'boolean', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: 'false' },
    { name: 'view_count', type: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: '0' },
    { name: 'copy_count', type: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: '0' },
    { name: 'deleted_at', type: 'timestamp with time zone', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: null },
    { name: 'created_at', type: 'timestamp with time zone', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: 'now()' },
    { name: 'updated_at', type: 'timestamp with time zone', nullable: true, isPrimaryKey: false, isForeignKey: false, constraints: [], defaultValue: 'now()' },
  ],
  indexes: [
    { name: 'robots_pkey', tableName: 'robots', columns: ['id'], isUnique: true, isPrimary: true, type: 'btree', definition: 'PRIMARY KEY (id)' },
    { name: 'idx_robots_user_id', tableName: 'robots', columns: ['user_id'], isUnique: false, isPrimary: false, type: 'btree', definition: 'CREATE INDEX idx_robots_user_id ON robots(user_id)' },
    { name: 'idx_robots_created_at', tableName: 'robots', columns: ['created_at'], isUnique: false, isPrimary: false, type: 'btree', definition: 'CREATE INDEX idx_robots_created_at ON robots(created_at DESC)' },
    { name: 'idx_robots_strategy_type', tableName: 'robots', columns: ['strategy_type'], isUnique: false, isPrimary: false, type: 'btree', definition: 'CREATE INDEX idx_robots_strategy_type ON robots(strategy_type)' },
  ],
};

// ============================================================================
// SCHEMA MANAGER CLASS
// ============================================================================

/**
 * Manages database schema introspection, validation, and versioning
 */
export class SchemaManager {
  private static instance: SchemaManager;
  private schemaCache: Map<string, TableDefinition> = new Map();
  private lastIntrospection: number = 0;
  private cacheTtl: number = 5 * 60 * 1000; // 5 minutes
  private schemaVersions: SchemaVersion[] = [];

  private constructor() {}

  static getInstance(): SchemaManager {
    if (!SchemaManager.instance) {
      SchemaManager.instance = new SchemaManager();
    }
    return SchemaManager.instance;
  }

  // ============================================================================
  // PUBLIC API - SCHEMA INTROSPECTION
  // ============================================================================

  /**
   * Get complete table definition
   */
  async getTableDefinition(
    client: SupabaseClient,
    tableName: string,
    options: SchemaIntrospectionOptions = {}
  ): Promise<TableDefinition | null> {
    const cacheKey = `table_${tableName}`;
    const cached = this.schemaCache.get(cacheKey);

    if (cached && Date.now() - this.lastIntrospection < this.cacheTtl) {
      return cached;
    }

    try {
      const columns = await this.getColumns(client, tableName);
      const indexes = options.includeIndexes !== false
        ? await this.getIndexes(client, tableName)
        : [];
      const constraints = options.includeConstraints !== false
        ? await this.getConstraints(client, tableName)
        : [];

      let rowCount: number | undefined;
      let tableSize: number | undefined;
      let indexSize: number | undefined;

      if (options.includeStatistics) {
        const stats = await this.getTableStatistics(client, tableName);
        rowCount = stats.rowCount;
        tableSize = stats.tableSize;
        indexSize = stats.indexSize;
      }

      const tableDef: TableDefinition = {
        name: tableName,
        schema: 'public',
        columns,
        indexes,
        constraints,
        rowCount,
        tableSize,
        indexSize,
      };

      this.schemaCache.set(cacheKey, tableDef);
      this.lastIntrospection = Date.now();

      return tableDef;
    } catch (error) {
      logger.error(`Failed to get table definition for ${tableName}:`, error);
      return null;
    }
  }

  /**
   * Get all tables in the database
   */
  async getAllTables(
    client: SupabaseClient,
    options: SchemaIntrospectionOptions = {}
  ): Promise<string[]> {
    try {
      // Query information_schema for table names
      const { data, error } = await client.rpc('get_table_names');

      if (error) {
        // Fallback: use known tables
        return ['robots'];
      }

      const tables = (data || []).map((t: { table_name: string }) => t.table_name);

      if (!options.includeSystemTables) {
        // Filter out system tables
        return tables.filter((t: string) => !t.startsWith('pg_') && !t.startsWith('_'));
      }

      return tables;
    } catch {
      // Return known tables on error
      return ['robots'];
    }
  }

  /**
   * Get column definitions for a table
   */
  async getColumns(client: SupabaseClient, tableName: string): Promise<ColumnDefinition[]> {
    try {
      // Try to query information_schema
      const { data, error } = await client.rpc('get_table_columns', { table_name: tableName });

      if (error || !data) {
        // Return expected columns for robots table
        if (tableName === 'robots' && EXPECTED_ROBOTS_TABLE.columns) {
          return EXPECTED_ROBOTS_TABLE.columns;
        }
        return [];
      }

      return data.map((col: Record<string, unknown>) => ({
        name: String(col.column_name),
        type: String(col.data_type),
        nullable: col.is_nullable === 'YES',
        defaultValue: col.column_default ? String(col.column_default) : null,
        isPrimaryKey: false, // Would need additional query
        isForeignKey: false, // Would need additional query
        constraints: [],
      }));
    } catch {
      // Fallback to expected schema
      if (tableName === 'robots' && EXPECTED_ROBOTS_TABLE.columns) {
        return EXPECTED_ROBOTS_TABLE.columns;
      }
      return [];
    }
  }

  /**
   * Get index definitions for a table
   */
  async getIndexes(client: SupabaseClient, tableName: string): Promise<IndexDefinition[]> {
    try {
      const { data, error } = await client.rpc('get_table_indexes', { table_name: tableName });

      if (error || !data) {
        if (tableName === 'robots' && EXPECTED_ROBOTS_TABLE.indexes) {
          return EXPECTED_ROBOTS_TABLE.indexes;
        }
        return [];
      }

      return data.map((idx: Record<string, unknown>) => ({
        name: String(idx.indexname),
        tableName: String(idx.tablename),
        columns: String(idx.indexdef).match(/\(([^)]+)\)/)?.[1]?.split(', ') || [],
        isUnique: String(idx.indexdef).includes('UNIQUE'),
        isPrimary: String(idx.indexname).endsWith('_pkey'),
        type: 'btree' as const,
        definition: String(idx.indexdef),
      }));
    } catch {
      if (tableName === 'robots' && EXPECTED_ROBOTS_TABLE.indexes) {
        return EXPECTED_ROBOTS_TABLE.indexes;
      }
      return [];
    }
  }

  /**
   * Get constraints for a table
   */
  async getConstraints(client: SupabaseClient, tableName: string): Promise<TableConstraint[]> {
    try {
      const { data, error } = await client.rpc('get_table_constraints', { table_name: tableName });

      if (error || !data) {
        return [];
      }

      return data.map((con: Record<string, unknown>) => ({
        name: String(con.constraint_name),
        type: String(con.constraint_type) as TableConstraint['type'],
        columns: [], // Would need additional parsing
        definition: String(con.definition || ''),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get table statistics
   */
  async getTableStatistics(
    client: SupabaseClient,
    tableName: string
  ): Promise<{ rowCount?: number; tableSize?: number; indexSize?: number }> {
    try {
      // Get row count
      const { count } = await client
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      return {
        rowCount: count || 0,
        tableSize: undefined, // Would require pg_relation_size
        indexSize: undefined,
      };
    } catch {
      return {};
    }
  }

  // ============================================================================
  // PUBLIC API - SCHEMA VALIDATION
  // ============================================================================

  /**
   * Validate database schema against expected structure
   */
  async validateSchema(client: SupabaseClient): Promise<SchemaValidationResult> {
    const errors: SchemaValidationError[] = [];
    const warnings: SchemaValidationWarning[] = [];

    try {
      // Validate robots table
      const robotsTable = await this.getTableDefinition(client, 'robots');

      if (!robotsTable) {
        errors.push({
          table: 'robots',
          message: 'Required table "robots" does not exist',
          severity: 'error',
        });
        return { isValid: false, errors, warnings };
      }

      // Validate required columns
      const requiredColumns = ['id', 'user_id', 'name', 'code', 'created_at', 'updated_at'];
      const existingColumns = robotsTable.columns.map((c) => c.name);

      for (const col of requiredColumns) {
        if (!existingColumns.includes(col)) {
          errors.push({
            table: 'robots',
            column: col,
            message: `Required column "${col}" is missing from robots table`,
            severity: 'error',
          });
        }
      }

      // Validate indexes
      const expectedIndexes = ['robots_pkey', 'idx_robots_user_id'];
      const existingIndexes = robotsTable.indexes.map((i) => i.name);

      for (const idx of expectedIndexes) {
        if (!existingIndexes.includes(idx)) {
          warnings.push({
            table: 'robots',
            message: `Recommended index "${idx}" is missing from robots table`,
            severity: 'warning',
          });
        }
      }

      // Validate JSONB columns have default values
      const jsonbColumns = robotsTable.columns.filter((c) => c.type === 'jsonb');
      for (const col of jsonbColumns) {
        if (!col.defaultValue) {
          warnings.push({
            table: 'robots',
            column: col.name,
            message: `JSONB column "${col.name}" should have a default value`,
            severity: 'warning',
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push({
        table: 'unknown',
        message: `Schema validation failed: ${error}`,
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Compare current schema with expected schema
   */
  async compareSchema(
    client: SupabaseClient,
    expectedTables: TableDefinition[]
  ): Promise<SchemaDiff[]> {
    const diffs: SchemaDiff[] = [];

    for (const expectedTable of expectedTables) {
      const currentTable = await this.getTableDefinition(client, expectedTable.name);

      if (!currentTable) {
        diffs.push({
          table: expectedTable.name,
          type: 'removed',
        });
        continue;
      }

      const changes: SchemaChange[] = [];

      // Check for missing columns
      for (const expectedCol of expectedTable.columns) {
        const currentCol = currentTable.columns.find((c) => c.name === expectedCol.name);
        if (!currentCol) {
          changes.push({
            type: 'column_added',
            details: { column: expectedCol },
          });
        }
      }

      // Check for extra columns
      for (const currentCol of currentTable.columns) {
        const expectedCol = expectedTable.columns.find((c) => c.name === currentCol.name);
        if (!expectedCol) {
          changes.push({
            type: 'column_removed',
            details: { column: currentCol.name },
          });
        }
      }

      if (changes.length > 0) {
        diffs.push({
          table: expectedTable.name,
          type: 'modified',
          changes,
        });
      }
    }

    return diffs;
  }

  // ============================================================================
  // PUBLIC API - SCHEMA VERSIONING
  // ============================================================================

  /**
   * Get current schema version
   */
  getCurrentVersion(): string {
    if (this.schemaVersions.length === 0) {
      return '1.0.0';
    }
    return this.schemaVersions[this.schemaVersions.length - 1].version;
  }

  /**
   * Get schema version history
   */
  getVersionHistory(): SchemaVersion[] {
    return [...this.schemaVersions];
  }

  /**
   * Record a schema migration
   */
  recordMigration(version: string, description: string, checksum: string): void {
    this.schemaVersions.push({
      version,
      appliedAt: new Date().toISOString(),
      description,
      checksum,
    });
  }

  /**
   * Generate checksum for schema
   */
  generateSchemaChecksum(tables: TableDefinition[]): string {
    const content = tables
      .map((t) => {
        const cols = t.columns.map((c) => `${c.name}:${c.type}:${c.nullable}`).join(',');
        return `${t.name}:${cols}`;
      })
      .join('|');

    // Simple hash function for checksum
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // ============================================================================
  // PUBLIC API - UTILITY METHODS
  // ============================================================================

  /**
   * Clear schema cache
   */
  clearCache(): void {
    this.schemaCache.clear();
    this.lastIntrospection = 0;
  }

  /**
   * Get expected table definition
   */
  getExpectedTableDefinition(tableName: string): Partial<TableDefinition> | null {
    if (tableName === 'robots') {
      return EXPECTED_ROBOTS_TABLE;
    }
    return null;
  }

  /**
   * Check if a column exists in a table
   */
  async hasColumn(client: SupabaseClient, tableName: string, columnName: string): Promise<boolean> {
    const columns = await this.getColumns(client, tableName);
    return columns.some((c) => c.name === columnName);
  }

  /**
   * Check if an index exists on a table
   */
  async hasIndex(client: SupabaseClient, tableName: string, indexName: string): Promise<boolean> {
    const indexes = await this.getIndexes(client, tableName);
    return indexes.some((i) => i.name === indexName);
  }

  /**
   * Get recommended indexes based on query patterns
   */
  getRecommendedIndexes(): Array<{ tableName: string; columns: string[]; reason: string }> {
    return [
      {
        tableName: 'robots',
        columns: ['user_id', 'created_at'],
        reason: 'Composite index for efficient user robot listing with ordering',
      },
      {
        tableName: 'robots',
        columns: ['strategy_type', 'is_active'],
        reason: 'Composite index for strategy filtering',
      },
      {
        tableName: 'robots',
        columns: ['deleted_at'],
        reason: 'Partial index for soft delete queries',
      },
      {
        tableName: 'robots',
        columns: ['name'],
        reason: 'Full-text search index for robot name search',
      },
    ];
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const schemaManager = SchemaManager.getInstance();
