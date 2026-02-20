/**
 * Database Types - Enhanced Type Definitions
 * 
 * Comprehensive type definitions for database entities following best practices
 * Aligns with supabase/migrations schema definitions
 * 
 * @module types/database
 * @author Database Architect
 */

// ============================================================================
// ENUM TYPES (Mirror PostgreSQL enums)
// ============================================================================

/**
 * Trading strategy classification
 */
export type StrategyType = 'Trend' | 'Scalping' | 'Grid' | 'Martingale' | 'Custom';

/**
 * Message role in chat history
 */
export type MessageRole = 'user' | 'model' | 'system';

/**
 * Database operation mode
 */
export type DatabaseMode = 'mock' | 'supabase';

// ============================================================================
// DATABASE ROW TYPES (Direct mapping to table columns)
// ============================================================================

/**
 * Robot table row type - matches database schema exactly
 */
export interface RobotRow {
  // Primary key
  id: string;
  
  // Foreign key
  user_id: string;
  
  // Core fields
  name: string;
  description: string;
  code: string;
  
  // Strategy
  strategy_type: StrategyType;
  
  // JSONB columns
  strategy_params: StrategyParamsJSON;
  backtest_settings: BacktestSettingsJSON;
  analysis_result: AnalysisResultJSON;
  chat_history: ChatHistoryJSON;
  
  // Versioning
  version: number;
  
  // Status flags
  is_active: boolean;
  is_public: boolean;
  
  // Counters
  view_count: number;
  copy_count: number;
  
  // Soft delete
  deleted_at: string | null;
  
  // Audit timestamps
  created_at: string;
  updated_at: string;
}

// ============================================================================
// JSONB COLUMN TYPES
// ============================================================================

/**
 * Strategy parameters stored in strategy_params column
 */
export interface StrategyParamsJSON {
  timeframe?: string;
  symbol?: string;
  riskPercent?: number;
  stopLoss?: number;
  takeProfit?: number;
  magicNumber?: number;
  customInputs?: CustomInputJSON[];
  [key: string]: unknown;
}

/**
 * Custom input definition
 */
export interface CustomInputJSON {
  id: string;
  name: string;
  type: 'int' | 'double' | 'string' | 'bool';
  value: string;
}

/**
 * Backtest settings stored in backtest_settings column
 */
export interface BacktestSettingsJSON {
  initialDeposit?: number;
  days?: number;
  leverage?: number;
  [key: string]: unknown;
}

/**
 * Analysis result stored in analysis_result column
 */
export interface AnalysisResultJSON {
  riskScore?: number;
  profitability?: number;
  description?: string;
  recommendations?: string[];
  [key: string]: unknown;
}

/**
 * Chat message in chat_history column
 */
export interface ChatMessageJSON {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  thinking?: string | null;
}

/**
 * Chat history array type
 */
export type ChatHistoryJSON = ChatMessageJSON[];

// ============================================================================
// DTO TYPES (Data Transfer Objects)
// ============================================================================

/**
 * Robot creation DTO - fields allowed during creation
 */
export interface CreateRobotDTO {
  name: string;
  description?: string;
  code: string;
  strategy_type?: StrategyType;
  strategy_params?: Partial<StrategyParamsJSON>;
  backtest_settings?: Partial<BacktestSettingsJSON>;
  analysis_result?: Partial<AnalysisResultJSON>;
  chat_history?: ChatHistoryJSON;
  is_public?: boolean;
}

/**
 * Robot update DTO - fields allowed during update
 */
export interface UpdateRobotDTO {
  name?: string;
  description?: string;
  code?: string;
  strategy_type?: StrategyType;
  strategy_params?: Partial<StrategyParamsJSON>;
  backtest_settings?: Partial<BacktestSettingsJSON>;
  analysis_result?: Partial<AnalysisResultJSON>;
  chat_history?: ChatHistoryJSON;
  is_public?: boolean;
  is_active?: boolean;
  version?: number;
}

/**
 * Robot filter DTO for querying
 */
export interface RobotFilterDTO {
  user_id?: string;
  strategy_type?: StrategyType | 'All';
  is_active?: boolean;
  is_public?: boolean;
  search_term?: string;
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sort_by?: 'created_at' | 'updated_at' | 'name' | 'view_count' | 'copy_count';
  sort_order?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// ============================================================================
// DATABASE STATISTICS TYPES
// ============================================================================

/**
 * Robot statistics from get_robot_stats function
 */
export interface RobotStats {
  total_count: number;
  active_count: number;
  public_count: number;
  by_strategy: Record<StrategyType, number>;
}

/**
 * Database health check result
 */
export interface DatabaseHealthCheck {
  is_healthy: boolean;
  latency_ms: number;
  connection_pool: {
    active: number;
    idle: number;
    total: number;
  };
  last_check: string;
  error?: string;
}

/**
 * Query performance metrics
 */
export interface QueryMetrics {
  query_name: string;
  execution_count: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  min_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  last_executed: string;
}

/**
 * Database performance summary
 */
export interface DatabasePerformanceSummary {
  total_queries: number;
  slow_queries: number;
  avg_latency_ms: number;
  cache_hit_rate: number;
  connection_errors: number;
  metrics_by_operation: Record<string, QueryMetrics>;
}

// ============================================================================
// DATABASE CONFIG TYPES
// ============================================================================

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  mode: DatabaseMode;
  url?: string;
  anonKey?: string;
  retryConfig?: RetryConfig;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  useJitter: boolean;
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  healthCheckIntervalMs: number;
}

// ============================================================================
// DATABASE OPERATION RESULT TYPES
// ============================================================================

/**
 * Generic database operation result
 */
export interface DatabaseResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

/**
 * Database error type
 */
export interface DatabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
}

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ item: T; error: DatabaseError }>;
  total_count: number;
  success_count: number;
  failure_count: number;
}

// ============================================================================
// MIGRATION TYPES
// ============================================================================

/**
 * Migration status
 */
export type MigrationStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Migration record
 */
export interface MigrationRecord {
  id: string;
  name: string;
  status: MigrationStatus;
  executed_at?: string;
  duration_ms?: number;
  error?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Make all fields optional except specified required fields
 */
export type PartialWithRequired<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Nullable type helper
 */
export type Nullable<T> = T | null;

/**
 * Deep partial type for nested updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for StrategyType
 */
export function isStrategyType(value: unknown): value is StrategyType {
  return ['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'].includes(value as string);
}

/**
 * Type guard for MessageRole
 */
export function isMessageRole(value: unknown): value is MessageRole {
  return ['user', 'model', 'system'].includes(value as string);
}

/**
 * Type guard for RobotRow
 */
export function isRobotRow(value: unknown): value is RobotRow {
  if (!value || typeof value !== 'object') return false;
  
  const robot = value as Partial<RobotRow>;
  return (
    typeof robot.id === 'string' &&
    typeof robot.user_id === 'string' &&
    typeof robot.name === 'string' &&
    typeof robot.code === 'string' &&
    typeof robot.created_at === 'string' &&
    typeof robot.updated_at === 'string'
  );
}

/**
 * Type guard for CreateRobotDTO
 */
export function isCreateRobotDTO(value: unknown): value is CreateRobotDTO {
  if (!value || typeof value !== 'object') return false;
  
  const dto = value as Partial<CreateRobotDTO>;
  return (
    typeof dto.name === 'string' &&
    typeof dto.code === 'string' &&
    dto.name.length >= 1 &&
    dto.name.length <= 255 &&
    dto.code.length >= 1
  );
}

/**
 * Type guard for PaginatedResponse
 */
export function isPaginatedResponse<T>(value: unknown, itemGuard?: (item: unknown) => item is T): value is PaginatedResponse<T> {
  if (!value || typeof value !== 'object') return false;
  
  const response = value as Partial<PaginatedResponse<T>>;
  
  // Check basic structure
  if (
    !Array.isArray(response.data) ||
    response.pagination === undefined ||
    typeof response.pagination.page !== 'number' ||
    typeof response.pagination.limit !== 'number' ||
    typeof response.pagination.total_count !== 'number'
  ) {
    return false;
  }
  
  // If item guard provided, validate all items
  if (itemGuard && response.data.length > 0) {
    return response.data.every(itemGuard);
  }
  
  return true;
}

// ============================================================================
// DATABASE PERFORMANCE DASHBOARD TYPES
// ============================================================================

/**
 * Health status for database monitoring
 */
export type DatabaseHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';

/**
 * Alert severity levels
 */
export type DatabaseAlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Database connection metrics
 */
export interface DatabaseConnectionMetrics {
  total: number;
  active: number;
  idle: number;
  maxConnections: number;
  utilizationPercent: number;
  averageResponseTimeMs: number;
}

/**
 * Database query metrics
 */
export interface DatabaseQueryMetrics {
  totalExecuted: number;
  averageExecutionTimeMs: number;
  slowQueryCount: number;
  cacheHitRate: number;
  queriesPerSecond: number;
  errorRate: number;
}

/**
 * Database storage metrics
 */
export interface DatabaseStorageMetrics {
  mode: 'mock' | 'supabase';
  totalRecords: number;
  estimatedSizeBytes: number;
  indexSizeBytes: number;
  tableSizeBytes: number;
}

/**
 * Complete database health metrics
 */
export interface DatabaseHealthMetricsDashboard {
  status: DatabaseHealthStatus;
  timestamp: string;
  uptime: number;
  connections: DatabaseConnectionMetrics;
  queries: DatabaseQueryMetrics;
  storage: DatabaseStorageMetrics;
  performanceScore: number;
}

/**
 * Database alert for monitoring
 */
export interface DatabaseDashboardAlert {
  id: string;
  severity: DatabaseAlertSeverity;
  message: string;
  timestamp: string;
  metric: string;
  value: number;
  threshold: number;
  resolved: boolean;
  resolvedAt?: string;
}

/**
 * Database performance trend data point
 */
export interface DatabasePerformanceTrend {
  timestamp: string;
  queryTimeMs: number;
  connectionCount: number;
  cacheHitRate: number;
  errorRate: number;
  throughput: number;
}

/**
 * Database index statistics
 */
export interface DatabaseIndexStats {
  indexName: string;
  tableName: string;
  indexSize: number;
  indexScans: number;
  tuplesRead: number;
  tuplesFetched: number;
  isUnused: boolean;
  recommendation?: string;
}

/**
 * Database table statistics
 */
export interface DatabaseTableStats {
  tableName: string;
  rowCount: number;
  tableSize: number;
  indexSize: number;
  totalSize: number;
  sequentialScans: number;
  indexScans: number;
  cacheHitRatio: number;
  lastVacuum: string | null;
  lastAnalyze: string | null;
}

/**
 * Database slow query log entry
 */
export interface DatabaseSlowQuery {
  id: string;
  query: string;
  executionTimeMs: number;
  timestamp: string;
  tableName: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  rowsAffected: number;
  recommendation?: string;
}

/**
 * Database backup status
 */
export interface DatabaseBackupStatus {
  lastBackup: string | null;
  nextBackup: string | null;
  backupSize: number;
  backupCount: number;
  oldestBackup: string | null;
  isScheduled: boolean;
  health: 'good' | 'warning' | 'critical';
}

/**
 * Database migration status
 */
export interface DatabaseMigrationStatus {
  currentVersion: string;
  appliedMigrations: string[];
  pendingMigrations: string[];
  lastMigration: string | null;
  migrationCount: number;
  status: 'up-to-date' | 'pending' | 'failed' | 'unknown';
}

/**
 * Complete database dashboard summary
 */
export interface DatabaseDashboardSummary {
  health: DatabaseHealthMetricsDashboard;
  alerts: DatabaseDashboardAlert[];
  trends: DatabasePerformanceTrend[];
  indexes: DatabaseIndexStats[];
  tables: DatabaseTableStats[];
  slowQueries: DatabaseSlowQuery[];
  backup: DatabaseBackupStatus;
  migrations: DatabaseMigrationStatus;
  lastUpdated: string;
}

/**
 * Database configuration display
 */
export interface DatabaseConfigDisplay {
  mode: 'mock' | 'supabase';
  connected: boolean;
  connectionUrl?: string;
  poolSize: number;
  maxConnections: number;
  retryAttempts: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  healthCheckInterval: number;
}

/**
 * Database optimization recommendation
 */
export interface DatabaseOptimizationRecommendation {
  id: string;
  category: 'index' | 'query' | 'configuration' | 'maintenance' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  sql?: string;
  applied: boolean;
}

/**
 * Database performance comparison
 */
export interface DatabasePerformanceComparison {
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'improving' | 'stable' | 'degrading';
}

/**
 * Real-time database event
 */
export interface DatabaseRealtimeEvent {
  id: string;
  type: 'connection' | 'query' | 'error' | 'alert' | 'migration' | 'backup';
  timestamp: string;
  message: string;
  details: Record<string, unknown>;
  severity: DatabaseAlertSeverity;
}
