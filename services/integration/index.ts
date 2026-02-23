/**
 * Integration Module - External Integration Management
 * 
 * Provides centralized management for all external integrations:
 * - Database (Supabase)
 * - AI Service (Google Gemini)
 * - Market Data (Twelve Data / Simulated)
 * - Cache
 * - External APIs
 * 
 * Additional features:
 * - Integration Testing Utilities
 * - Data Synchronization
 * - Event Aggregation
 * - Service Discovery
 * - Metrics Export
 */

// Types
export {
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
} from './types';

// Orchestrator
export {
  IntegrationOrchestrator,
  integrationOrchestrator,
} from './orchestrator';

// Setup
export {
  INTEGRATION_NAMES,
  registerStandardIntegrations,
  initializeIntegrations,
  getIntegrationStatusDisplay,
  getIntegrationDashboardData,
} from './setup';

// Connection Pool
export {
  ConnectionState,
  DEFAULT_POOL_CONFIG,
  connectionPoolRegistry,
  ConnectionPoolManager,
  type ConnectionPoolConfig,
  type PooledConnection,
  type ConnectionFactory,
  type ConnectionPoolMetrics,
} from './connectionPool';

// Testing Utilities
export {
  BaseMockAdapter,
  MockDatabaseAdapter,
  MockAIServiceAdapter,
  MockMarketDataAdapter,
  MockCacheAdapter,
  IntegrationTestHarness,
  waitFor,
  createDeferred,
  createTestHarness,
  createTestIntegrationConfig,
  type MockAdapter,
  type MockBehavior,
  type MockIntegrationState,
} from './testing';

// Sync Manager
export {
  SyncDirection,
  ConflictResolution,
  SyncStatus,
  IntegrationSyncManager,
  integrationSyncManager,
  type SyncConfig,
  type SyncResult,
  type SyncMetrics,
  type DeltaRecord,
} from './syncManager';

// Event Aggregator
export {
  AggregationType,
  EventSeverity,
  IntegrationEventAggregator,
  integrationEventAggregator,
  type AggregatedEvent,
  type AggregatedMetrics,
  type CorrelationRule,
  type EventPattern,
  type EventAggregatorConfig,
} from './eventAggregator';

// Service Discovery
export {
  LoadBalancingStrategy,
  ServiceDiscoveryManager,
  serviceDiscovery,
  type ServiceCapability,
  type ServiceInstance,
  type ServiceQueryOptions,
  type ServiceDiscoveryResult,
  type ServiceDiscoveryConfig,
} from './serviceDiscovery';

// Metrics Exporter
export {
  PrometheusMetricType,
  IntegrationMetricsExporter,
  integrationMetricsExporter,
  type PrometheusMetric,
  type MetricsExporterConfig,
  type AlertThreshold,
  type AlertEvent,
  type MetricsSnapshot,
  type MetricsSubscriber,
} from './metricsExporter';
