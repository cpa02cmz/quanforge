/**
 * Database Services Index
 * 
 * Centralized exports for all database-related services
 * 
 * @module services/database
 * @author Database Architect
 */

// Core Services
export { DatabaseCore } from './DatabaseCore';
export { RobotDatabaseService, type IRobotDatabaseService } from './RobotDatabaseService';
export { ConnectionPool, type PoolConfig } from './ConnectionPool';

// Optimization Services
export { 
  DatabaseOptimizerService,
  QueryOptimizer,
  IndexAnalyzer,
  databaseOptimizer
} from './DatabaseOptimizer';

// Health Monitoring
export { DatabaseHealthMonitor, databaseHealthMonitor } from './DatabaseHealthMonitor';

// Query Performance
export { QueryPerformanceAnalyzer, queryPerformanceAnalyzer } from './QueryPerformanceAnalyzer';

// Transaction Management
export { 
  TransactionManager, 
  transactionManager,
  type TransactionOptions,
  type TransactionResult,
  type TransactionError,
  type TransactionMetrics,
  type IsolationLevel,
  type Savepoint
} from './transactionManager';

// Schema Management
export {
  SchemaManager,
  schemaManager,
  type ColumnDefinition,
  type IndexDefinition,
  type TableDefinition,
  type TableConstraint,
  type SchemaVersion,
  type SchemaDiff,
  type SchemaChange,
  type SchemaValidationResult,
  type SchemaValidationError,
  type SchemaValidationWarning,
  type SchemaIntrospectionOptions
} from './schemaManager';

// Index Advisor
export {
  IndexAdvisor,
  indexAdvisor,
  type IndexRecommendation,
  type IndexUsageStats,
  type QueryPattern,
  type IndexAnalysisResult,
  type AdvisorConfig
} from './indexAdvisor';

// Query Builder
export {
  QueryBuilder,
  RobotQueryBuilder,
  query,
  robotQuery,
  type SortDirection,
  type LogicalOperator,
  type FilterCondition,
  type FilterGroup,
  type SortOption,
  type QueryOptions,
  type BuildResult
} from './queryBuilder';

// Sub-modules
export * from './operations';
export * from './cacheLayer';
export * from './client';
export * from './monitoring';
