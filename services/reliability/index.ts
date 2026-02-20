/**
 * Reliability Module
 * 
 * Provides comprehensive reliability patterns for the application:
 * - Bulkhead: Isolate failures by limiting concurrent calls
 * - Circuit Breaker: Prevent cascading failures
 * - Health Monitoring: Track service health status
 * - Retry Logic: Handle transient failures
 * - Dashboard: Centralized reliability metrics
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
