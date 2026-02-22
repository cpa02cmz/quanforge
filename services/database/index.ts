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

// Event Publisher
export {
  DatabaseEventPublisher,
  databaseEventPublisher,
  type DatabaseEventType,
  type DatabaseEntity,
  type DatabaseEvent,
  type EventMetadata,
  type EventFilter,
  type EventSubscription,
  type EventBuffer,
  type EventStatistics,
  type EventCallback,
  type EventPublisherConfig
} from './eventPublisher';

// Query Plan Analyzer
export {
  QueryPlanAnalyzer,
  queryPlanAnalyzer,
  type QueryPlan,
  type PlanNode,
  type QueryAnalysis,
  type QueryIssue,
  type IssueType,
  type QuerySuggestion,
  type SuggestionType,
  type AnalyzerConfig,
  type QueryStats
} from './queryPlanAnalyzer';

// Migration Runner
export {
  MigrationRunner,
  migrationRunner,
  type MigrationStatus,
  type Migration,
  type MigrationResult,
  type MigrationReport,
  type MigrationConfig,
  type MigrationValidator,
  type ValidationResult
} from './migrationRunner';

// Benchmark Service
export {
  BenchmarkService,
  benchmarkService,
  type BenchmarkResult,
  type BenchmarkCategory,
  type BaselineComparison,
  type RegressionInfo,
  type BenchmarkSuite,
  type BenchmarkConfig,
  type BenchmarkHistory,
  type BenchmarkReport
} from './benchmarkService';

// Archiving Service
export {
  ArchivingService,
  archivingService,
  CREATE_ARCHIVE_TABLE_SQL,
  type ArchiveConfig,
  type ArchiveRecord,
  type ArchiveStats,
  type ArchiveReport,
  type ArchiveCandidate,
  type PurgeResult,
  type RestoreResult,
  type ArchiveOperation
} from './archivingService';

// Seeding Service
export {
  SeedingService,
  seedingService,
  type SeedingConfig,
  type SeedUser,
  type SeedResult,
  type RobotTemplate,
  type SeedOperation
} from './seedingService';

// Sub-modules
export * from './operations';
export * from './cacheLayer';
export * from './client';
export * from './monitoring';

// Data Integrity
export {
  DataIntegrityValidator,
  dataIntegrityValidator,
  type IntegrityValidationResult,
  type IntegrityValidationError,
  type IntegrityValidationWarning,
  type ValidationRule,
  type ValidationContext,
  type IntegrityStats
} from './dataIntegrityValidator';

// Query Cache
export {
  QueryCacheService,
  queryCacheService,
  type CacheEntry,
  type CacheStats,
  type CacheConfig,
  type CacheInvalidationRule,
  type QueryCacheOptions
} from './queryCacheService';

// Audit Logger
export {
  DatabaseAuditLogger,
  databaseAuditLogger,
  type AuditEventType,
  type AuditSeverity,
  type AuditEntityType,
  type AuditEntry,
  type FieldChange,
  type AuditMetadata,
  type AuditFilter,
  type AuditStats,
  type AuditConfig,
  type AuditReport
} from './databaseAuditLogger';

// Query Plan Cache
export {
  QueryPlanCache,
  queryPlanCache,
  type CachedQueryPlan,
  type CacheEntry as QueryPlanCacheEntry,
  type CacheStats as QueryPlanCacheStats,
  type CacheConfig as QueryPlanCacheConfig
} from './queryPlanCache';

// Failover Manager
export {
  FailoverManager,
  failoverManager,
  type FailoverState,
  type FailoverStrategy,
  type DatabaseEndpoint,
  type FailoverConfig,
  type FailoverEvent,
  type FailoverStatus
} from './failoverManager';

// Retention Policy Manager
export {
  RetentionPolicyManager,
  retentionPolicyManager,
  type RetentionAction,
  type RetentionPolicyStatus,
  type RetentionPolicy,
  type RetentionExecution,
  type RetentionExecutionDetail,
  type RetentionStats,
  type RetentionConfig,
  type RetentionReport
} from './retentionPolicyManager';
