/**
 * Integration Types - Type definitions for the Integration Orchestrator
 * 
 * Defines standardized types for external integration management
 */

import type { IntegrationType, CircuitBreakerState } from '../integrationResilience';

/**
 * Integration status levels
 */
export enum IntegrationStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Integration priority levels for initialization and recovery
 */
export enum IntegrationPriority {
  CRITICAL = 1,    // Must be available (database, auth)
  HIGH = 2,        // Important but app can function (AI service)
  MEDIUM = 3,      // Nice to have (market data)
  LOW = 4          // Optional features (analytics, external APIs)
}

/**
 * Integration event types for the event bus
 */
export enum IntegrationEventType {
  STATUS_CHANGED = 'status_changed',
  HEALTH_CHECK_PASSED = 'health_check_passed',
  HEALTH_CHECK_FAILED = 'health_check_failed',
  CIRCUIT_BREAKER_OPENED = 'circuit_breaker_opened',
  CIRCUIT_BREAKER_CLOSED = 'circuit_breaker_closed',
  CIRCUIT_BREAKER_HALF_OPEN = 'circuit_breaker_half_open',
  DEGRADED_MODE_ENTERED = 'degraded_mode_entered',
  DEGRADED_MODE_EXITED = 'degraded_mode_exited',
  FALLBACK_USED = 'fallback_used',
  RECOVERY_STARTED = 'recovery_started',
  RECOVERY_COMPLETED = 'recovery_completed',
  INTEGRATION_REGISTERED = 'integration_registered',
  INTEGRATION_UNREGISTERED = 'integration_unregistered'
}

/**
 * Integration event payload
 */
export interface IntegrationEvent {
  type: IntegrationEventType;
  integrationType: IntegrationType;
  integrationName: string;
  timestamp: Date;
  data?: Record<string, unknown>;
  previousStatus?: IntegrationStatus;
  newStatus?: IntegrationStatus;
}

/**
 * Event listener callback type
 */
export type IntegrationEventListener = (event: IntegrationEvent) => void;

/**
 * Integration configuration for registration
 */
export interface IntegrationConfig {
  name: string;
  type: IntegrationType;
  priority: IntegrationPriority;
  description?: string;
  healthCheck: () => Promise<IntegrationHealthCheckResult>;
  onStatusChange?: (status: IntegrationStatusInfo) => void;
  recoveryHandler?: () => Promise<boolean>;
  gracefulShutdown?: () => Promise<void>;
  dependencies?: string[];  // Names of integrations this depends on
  metadata?: Record<string, unknown>;
}

/**
 * Result of a health check operation
 */
export interface IntegrationHealthCheckResult {
  healthy: boolean;
  latency: number;
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Comprehensive integration status information
 */
export interface IntegrationStatusInfo {
  name: string;
  type: IntegrationType;
  status: IntegrationStatus;
  priority: IntegrationPriority;
  healthy: boolean;
  lastHealthCheck: Date;
  latency: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  circuitBreakerState: CircuitBreakerState;
  degradedLevel: number;
  uptime: number;  // Percentage over last 24 hours
  errorRate: number;
  lastError?: string;
  lastErrorTime?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * System-wide integration summary
 */
export interface IntegrationSystemSummary {
  totalIntegrations: number;
  healthyCount: number;
  degradedCount: number;
  unhealthyCount: number;
  unknownCount: number;
  overallStatus: IntegrationStatus;
  criticalIntegrationsDown: string[];
  degradedIntegrations: Array<{ name: string; level: number }>;
  lastUpdated: Date;
  uptime: number;  // Overall system uptime percentage
}

/**
 * Integration metrics for monitoring
 */
export interface IntegrationMetrics {
  name: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  circuitBreakerTrips: number;
  fallbackUsageCount: number;
  lastHourRequests: number;
  lastHourErrorRate: number;
}

/**
 * Integration recovery options
 */
export interface RecoveryOptions {
  maxAttempts: number;
  delayBetweenAttempts: number;
  exponentialBackoff: boolean;
  notifyOnChange: boolean;
}

/**
 * Integration initialization result
 */
export interface InitializationResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  dependenciesMet: boolean;
  skippedDependencies: string[];
}

/**
 * Integration diagnostic information
 */
export interface IntegrationDiagnostic {
  name: string;
  type: IntegrationType;
  status: IntegrationStatusInfo;
  metrics: IntegrationMetrics;
  circuitBreakerMetrics: {
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    failureRate: number;
  };
  recentEvents: IntegrationEvent[];
  config: {
    priority: IntegrationPriority;
    hasRecoveryHandler: boolean;
    hasGracefulShutdown: boolean;
    dependencies: string[];
  };
}

/**
 * Integration orchestrator configuration
 */
export interface OrchestratorConfig {
  healthCheckInterval: number;
  metricsRetentionMs: number;
  enableAutoRecovery: boolean;
  recoveryOptions: RecoveryOptions;
  enableEventBus: boolean;
  maxConcurrentHealthChecks: number;
}
