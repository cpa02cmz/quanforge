/**
 * Reliability Module
 * 
 * Provides comprehensive reliability patterns for the application:
 * - Bulkhead: Isolate failures by limiting concurrent calls
 * - Circuit Breaker: Prevent cascading failures
 * - Health Monitoring: Track service health status
 * - Retry Logic: Handle transient failures
 * - Dashboard: Centralized reliability metrics
 * - Timeout Manager: Centralized timer management
 * - Graceful Degradation: Fallback mechanisms for critical services
 * - Service Registry: Track and coordinate service reliability
 * 
 * @module services/reliability
 */

// Bulkhead pattern for isolation
export {
  Bulkhead,
  BulkheadManager,
  BulkheadState,
  bulkheadManager,
  DEFAULT_BULKHEAD_CONFIGS,
  type BulkheadConfig,
  type BulkheadMetrics
} from './bulkhead';

// Reliability dashboard
export {
  ReliabilityDashboard,
  reliabilityDashboard,
  type SystemHealthStatus,
  type IntegrationReliabilityMetrics,
  type SystemReliabilitySummary,
  type AlertConfig,
  type Alert
} from './dashboard';

// Timeout Manager for centralized timer management
export {
  TimeoutManager,
  TimerType,
  timeoutManager,
  type TimeoutManagerConfig,
  type TimerStats
} from './timeoutManager';

// Graceful Degradation for fallback mechanisms
export {
  GracefulDegradationService,
  DegradationLevel,
  ServiceHealth,
  gracefulDegradation,
  createResilientService,
  type FallbackConfig,
  type DegradationMetrics
} from './gracefulDegradation';

// Service Registry for tracking service reliability
export {
  ServiceReliabilityRegistry,
  ServiceType,
  ServiceCriticality,
  serviceRegistry,
  registerCommonServices,
  type ServiceRegistration,
  type ServiceStatus,
  type Incident,
  type SystemReliabilityReport
} from './serviceRegistry';
