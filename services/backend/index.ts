/**
 * Backend Module
 * 
 * Comprehensive backend engineering services including:
 * - Service Registry: Centralized service management and health checking
 * - Request Context Manager: Distributed tracing and request lifecycle tracking
 * - Performance Analyzer: Performance analysis and optimization recommendations
 * - Rate Limiter: Token bucket rate limiting for services
 * - Request Queue Manager: Priority-based request queuing
 * - Backend Manager: Unified orchestrator for all backend services
 * - Telemetry Exporter: OpenTelemetry-compatible metrics and tracing
 * - Health Aggregator: Unified health reporting across services
 * - Circuit Breaker Coordinator: Centralized circuit breaker management
 * 
 * @module services/backend
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../utils/logger';
import { registerCommonBackendServices } from './serviceRegistry';

// Types - use export type for type-only exports
export type {
  // Service Registry Types
  BackendServiceStatus,
  ServiceCriticality,
  BackendServiceConfig,
  ServiceHealthResult,
  RegisteredService,
  ServiceRegistryStats,
  
  // Request Context Types
  RequestContext,
  RequestEntry,
  RequestContextOptions,
  RequestStats,
  
  // Performance Analysis Types
  PerformanceMetric,
  PerformanceAnalysis,
  PerformanceBottleneck,
  PerformanceRecommendation,
  BackendPerformanceReport,
  
  // Health Dashboard Types
  BackendHealthDashboard,
  ServiceHealthDisplay,
  BackendAlert,
  
  // Event Types
  BackendEvent,
  BackendEventListener,
  
  // Configuration Types
  BackendManagerConfig,
} from './types';

// Rate Limiter Types
export type {
  RateLimitStatus,
  RateLimitConfig,
  RateLimitResult,
} from './rateLimiter';

// Request Queue Types
export type {
  QueuePriority,
  QueueStatus,
  QueueItem,
  QueueConfig,
  QueueStats,
  QueueOptions,
} from './requestQueue';

// Backend Manager Types
export type {
  BackendManagerOptions,
  BackendManagerStatus,
  BackendOperationContext,
} from './manager';

// Telemetry Exporter Types
export type {
  TelemetryMetricType,
  TelemetryMetric,
  TelemetrySpan,
  TelemetryEvent,
  TelemetryLog,
  TelemetryConfig,
  TelemetryExportData,
} from './telemetryExporter';

// Health Aggregator Types
export type {
  HealthLevel,
  ServiceHealthInfo,
  AggregatedHealthReport,
  HealthRecommendation,
  HealthAlert,
  HealthTrends,
  HealthThresholds,
} from './healthAggregator';

// Circuit Breaker Coordinator Types
export type {
  CircuitState as CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  CircuitBreakerEvent,
} from './circuitBreakerCoordinator';

// Enums and Constants
export { BackendEventType, DEFAULT_BACKEND_CONFIG } from './types';
export { DEFAULT_RATE_LIMITS } from './rateLimiter';
export { DEFAULT_QUEUE_CONFIGS } from './requestQueue';
export { DEFAULT_TELEMETRY_CONFIG } from './telemetryExporter';
export { DEFAULT_HEALTH_THRESHOLDS } from './healthAggregator';
export { DEFAULT_CIRCUIT_CONFIGS } from './circuitBreakerCoordinator';

// Service Registry
export {
  BackendServiceRegistry,
  backendServiceRegistry,
  registerCommonBackendServices,
} from './serviceRegistry';

// Request Context Manager
export {
  RequestContextManager,
  requestContextManager,
  trackRequest,
} from './requestContext';

// Performance Analyzer
export {
  BackendPerformanceAnalyzer,
  backendPerformanceAnalyzer,
  recordLatency,
  recordRequestCount,
  recordErrorCount,
} from './performanceAnalyzer';

// Rate Limiter
export {
  BackendRateLimiter,
  backendRateLimiter,
  checkRateLimit,
  waitForRateLimit,
} from './rateLimiter';

// Request Queue Manager
export {
  RequestQueueManager,
  requestQueueManager,
  enqueue,
  enqueueAndWait,
} from './requestQueue';

// Backend Manager
export {
  BackendManager,
  backendManager,
  executeBackendOperation,
  getBackendHealth,
  getBackendStatus,
} from './manager';

// Telemetry Exporter
export {
  BackendTelemetryExporter,
  backendTelemetryExporter,
  recordBackendMetric,
  timeOperation,
  createTelemetryLogger,
} from './telemetryExporter';

// Health Aggregator
export {
  BackendHealthAggregator,
  backendHealthAggregator,
  getBackendHealthReport,
  isBackendHealthy,
} from './healthAggregator';

// Circuit Breaker Coordinator
export {
  CircuitBreakerCoordinator,
  circuitBreakerCoordinator,
  executeWithCircuitBreaker,
  getCircuitBreakerStatus,
  isCircuitOpen,
} from './circuitBreakerCoordinator';

// Import for use in this module
import { backendManager } from './manager';
import { backendTelemetryExporter } from './telemetryExporter';
import { backendHealthAggregator } from './healthAggregator';
import { circuitBreakerCoordinator } from './circuitBreakerCoordinator';

/**
 * Initialize backend services
 * 
 * Call this function to set up all backend services with default configurations.
 */
export async function initializeBackendServices(): Promise<void> {
  // Initialize the backend manager (which initializes all subsystems)
  await backendManager.initialize();
  
  // Register common services
  registerCommonBackendServices();
  
  // Log initialization
  const logger = createScopedLogger('Backend');
  logger.log('Backend services initialized');
}

/**
 * Shutdown backend services
 * 
 * Call this function to gracefully shut down all backend services.
 */
export async function shutdownBackendServices(): Promise<void> {
  const logger = createScopedLogger('Backend');
  logger.log('Shutting down backend services...');
  
  await backendManager.shutdown();
  
  logger.log('Backend services shut down');
}

/**
 * Get comprehensive backend status
 * 
 * Returns a unified status object with all backend service information.
 */
export function getComprehensiveBackendStatus(): {
  manager: ReturnType<typeof backendManager.getStatus>;
  telemetry: ReturnType<typeof backendTelemetryExporter.getStats>;
  health: ReturnType<typeof backendHealthAggregator.getAggregatedHealth>;
  circuitBreakers: ReturnType<typeof circuitBreakerCoordinator.getStats>;
} {
  return {
    manager: backendManager.getStatus(),
    telemetry: backendTelemetryExporter.getStats(),
    health: backendHealthAggregator.getAggregatedHealth(),
    circuitBreakers: circuitBreakerCoordinator.getStats(),
  };
}
