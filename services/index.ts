// Export all services for easier imports

// Service Factory Pattern (Issue #795)
export { 
  ServiceFactory, 
  BaseService, 
  ServiceInitializer,
  Service,
  type IService 
} from './core/ServiceFactory';

// Core Services with Resilience (Recommended)
export { aiService } from './resilientAIService';
export { resilientDb as db, resilientDbUtils as dbUtils } from './resilientDbService';
export { resilientMarketService as marketData } from './resilientMarketService';

// Backward Compatibility (Legacy exports - use resilient versions above)
export { supabase, mockDb } from './supabase';
export { marketService } from './marketData';
export type { MarketData } from './marketData';

// AI Functions (dynamic import via aiServiceLoader for lazy loading)
export * from './aiServiceLoader';
export * from './settingsManager';
export * from './simulation';
export * from './vercelEdgeOptimizer';
export * from './frontendOptimizer';
export * from './edgeAnalytics';
export * from './performanceMonitorEnhanced';
export * from './realUserMonitoring';
export * from './apiDeduplicator';
export * from './advancedAPICache';
export * from './databaseOptimizer';
export * from './realtimeManager';
export * from './edgeCacheManager';
export * from './edgeSupabaseClient';
export * from './edgeMonitoring';
export * from './edgeRequestCoalescer';
export * from './circuitBreaker';
export * from './dataCompression';
export * from './requestThrottler';
export * from './readReplicaManager';
export * from './queryBatcher';
export * from './edgeKVStorage';
// UX Monitoring (Modular Architecture)
export * from './ux';

// Integration Hardening System
export { IntegrationType, ErrorCategory, CircuitBreakerState, getConfig, classifyError, createStandardizedError } from './integrationResilience';
export { withIntegrationResilience, createIntegrationOperation, getIntegrationHealth, getAllIntegrationHealth, getCircuitBreakerStatus, getAllCircuitBreakerStatuses, resetCircuitBreaker, enterDegradedMode, exitDegradedMode, isDegraded, getDegradedIntegrations } from './integrationWrapper';
export { circuitBreakerMonitor } from './circuitBreakerMonitor';
export { fallbackManager, databaseFallbacks, aiServiceFallbacks, marketDataFallbacks, degradedModeManager } from './fallbackStrategies';
export { integrationHealthMonitor, integrationMetrics } from './integrationHealthMonitor';

// Reliability Module - Bulkhead, Circuit Breaker, Health Monitoring, Dashboard
export {
  Bulkhead,
  BulkheadManager,
  BulkheadState,
  bulkheadManager,
  DEFAULT_BULKHEAD_CONFIGS,
  type BulkheadConfig,
  type BulkheadMetrics
} from './reliability/bulkhead';
export {
  ReliabilityDashboard,
  reliabilityDashboard,
  type SystemHealthStatus,
  type IntegrationReliabilityMetrics,
  type SystemReliabilitySummary,
  type AlertConfig,
  type Alert
} from './reliability/dashboard';

// Flexy's Modular Constants - No more hardcoded values!
export {
  ModularConstants,
  TOKEN_CONSTANTS,
  SIZE_CONSTANTS,
  THRESHOLD_CONSTANTS,
  COUNT_CONSTANTS,
  MATH_CONSTANTS,
  DELAY_CONSTANTS,
  HTTP_CONSTANTS,
  SUPABASE_ERRORS,
  WEB_VITALS,
  TRADING_DEFAULTS,
  AuthConstants,
  CacheConstants,
  PerformanceConstants,
  ApiConstants,
  DatabaseConstants,
  UiConstants,
} from './modularConstants';

// Service Cleanup Coordinator - Lifecycle management for services
export { 
  serviceCleanupCoordinator,
  useServiceCleanup,
  type ServiceCleanupHandler,
  type CleanupPriority,
  type MemoryPressureEvent,
  type CoordinatorMetrics,
} from '../utils/serviceCleanupCoordinator';

// Database Architect Services - Health, Backup, Migration
export { 
  databaseHealthMonitor,
  DatabaseHealthMonitor,
  type HealthStatus,
  type AlertSeverity,
  type DatabaseHealthMetrics,
  type DatabaseAlert,
  type HealthCheckResult,
  type HealthMonitorConfig,
} from './databaseHealthMonitor';

export { 
  databaseBackup,
  DatabaseBackupManager,
  type BackupMetadata,
  type BackupData,
  type BackupOptions,
  type RestoreOptions,
  type RestoreResult,
  type BackupSchedule,
} from './databaseBackup';

export { 
  databaseMigrationValidator,
  DatabaseMigrationValidator,
  type MigrationFile,
  type ValidationRule,
  type ValidationResult,
  type MigrationValidationReport,
} from './databaseMigrationValidator';

// Integration Orchestrator - Unified External Integration Management
export {
  // Types
  IntegrationStatus,
  IntegrationPriority,
  IntegrationEventType,
  type IntegrationEvent,
  type IntegrationEventListener,
  type IntegrationConfig,
  type IntegrationHealthCheckResult,
  type IntegrationStatusInfo,
  type IntegrationSystemSummary,
  type IntegrationMetrics,
  type RecoveryOptions,
  type InitializationResult,
  type IntegrationDiagnostic,
  type OrchestratorConfig,
  // Orchestrator
  IntegrationOrchestrator,
  integrationOrchestrator,
  // Setup
  INTEGRATION_NAMES,
  registerStandardIntegrations,
  initializeIntegrations,
  getIntegrationStatusDisplay,
  getIntegrationDashboardData,
  // Service Discovery
  LoadBalancingStrategy,
  ServiceDiscoveryManager,
  serviceDiscovery,
  type ServiceCapability,
  type ServiceInstance,
  type ServiceQueryOptions,
  type ServiceDiscoveryResult,
  type ServiceDiscoveryConfig,
  // Metrics Exporter
  PrometheusMetricType,
  IntegrationMetricsExporter,
  integrationMetricsExporter,
  type PrometheusMetric,
  type MetricsExporterConfig,
  type AlertThreshold,
  type AlertEvent,
  type MetricsSnapshot,
  type MetricsSubscriber,
} from './integration';

// Backend Module - Service Registry, Request Context, Performance Analysis
export type {
  // Types
  BackendServiceStatus,
  ServiceCriticality,
  BackendServiceConfig,
  ServiceHealthResult,
  RegisteredService,
  ServiceRegistryStats,
  RequestContext,
  RequestEntry,
  RequestContextOptions,
  RequestStats,
  PerformanceMetric,
  PerformanceAnalysis,
  PerformanceBottleneck,
  PerformanceRecommendation,
  BackendPerformanceReport,
  BackendHealthDashboard,
  ServiceHealthDisplay,
  BackendAlert,
  BackendEvent,
  BackendEventListener,
  BackendManagerConfig,
} from './backend';

export {
  // Enums
  BackendEventType,
  DEFAULT_BACKEND_CONFIG,
  // Service Registry
  BackendServiceRegistry,
  backendServiceRegistry,
  registerCommonBackendServices,
  // Request Context Manager
  RequestContextManager,
  requestContextManager,
  trackRequest,
  // Performance Analyzer
  BackendPerformanceAnalyzer,
  backendPerformanceAnalyzer,
  recordLatency,
  recordRequestCount,
  recordErrorCount,
  // Initialization
  initializeBackendServices,
} from './backend';

// Scheduler Module - Background Job Scheduling
export type {
  JobStatus,
  JobPriority,
  RetryStrategy,
  ScheduleType,
  JobExecutionContext,
  JobExecutionResult,
  JobHandler,
  RetryConfig,
  ScheduleConfig,
  JobConfig,
  RegisteredJob,
  SchedulerStats,
  SchedulerConfig,
  JobEvent,
  JobEventListener,
  CronParts,
} from './scheduler';

export {
  // Enums and Constants
  JobEventType,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_RETRY_CONFIG,
  // Job Scheduler
  JobScheduler,
  jobScheduler,
  scheduleJob,
  executeJobNow,
  // Initialization
  initializeScheduler,
  getSchedulerHealth,
} from './scheduler';

// Message Queue Module - Asynchronous Message Processing
export type {
  MessageStatus,
  MessagePriority,
  QueueType,
  MessageHandler,
  MessageContext,
  MessageResult,
  QueueMessage,
  QueueConfig,
  ConsumerConfig,
  RegisteredConsumer,
  QueueStats,
  MessageQueueStats,
  QueueEvent,
  QueueEventListener,
  PublishOptions,
} from './queue';

export {
  // Enums and Constants
  QueueEventType,
  DEFAULT_QUEUE_CONFIG,
  DEFAULT_CONSUMER_CONFIG,
  // Message Queue
  MessageQueue,
  messageQueue,
  createQueue,
  publish,
  consume,
  // Initialization
  initializeMessageQueue,
  getMessageQueueHealth,
} from './queue';