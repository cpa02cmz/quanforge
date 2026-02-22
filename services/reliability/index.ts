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
 * - Error Budget Tracker: SLA/SLO monitoring and error budget management
 * - Resilience Policy: Unified resilience pattern enforcement
 * - Cascading Failure Detector: Early detection of systemic failures
 * - Health Check Scheduler: Periodic health checking for services
 * - Rate Limiter: Token bucket rate limiting for API calls
 * - Self-Healing Service: Automatic failure recovery
 * - Reliability Orchestrator: Central coordinator for all reliability services
 * - Service Dependency Graph: Dependency tracking and health propagation
 * - Adaptive Rate Limiter: Dynamic rate limit adjustment
 * - Latency Budget Tracker: Latency monitoring and budget enforcement
 * - Metrics Exporter: Unified metrics collection and export
 * - FetchWithReliability: Reliable fetch with timeout, retry, and circuit breaker
 * - ReliabilityMiddleware: Middleware for API call reliability
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
  type SystemReliabilitySummary as DashboardSummary,
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

// Error Budget Tracker for SLA monitoring
export {
  ErrorBudgetTracker,
  errorBudgetTracker,
  createTrackedService,
  type SLOConfig,
  type ErrorBudgetStatus,
  type BudgetAlert
} from './errorBudgetTracker';

// Resilience Policy for unified pattern enforcement
export {
  ResiliencePolicy,
  ResiliencePolicyManager,
  resiliencePolicyManager,
  withResilience,
  ResiliencePattern,
  DEFAULT_RESILIENCE_CONFIGS,
  type ResiliencePolicyConfig,
  type ResilienceEvent,
  type ResilienceMetrics
} from './resiliencePolicy';

// Cascading Failure Detector for early warning
export {
  CascadingFailureDetector,
  cascadingFailureDetector,
  withCascadeDetection,
  FailureSeverity,
  type CascadingFailureConfig,
  type FailureRecord,
  type CorrelationResult,
  type CascadePrediction,
  type CascadeAlert
} from './cascadingFailureDetector';

// Health Check Scheduler for periodic health checking
export {
  HealthCheckScheduler,
  healthCheckScheduler,
  registerServiceHealthCheck,
  type HealthCheckResult,
  type HealthCheckConfig,
  type HealthCheckEvent
} from './healthCheckScheduler';

// Rate Limiter for API rate limiting
export {
  TokenBucket,
  RateLimiterManager,
  rateLimiterManager,
  withRateLimit,
  registerDefaultRateLimiters,
  DEFAULT_RATE_LIMITER_CONFIGS,
  type RateLimiterConfig,
  type RateLimiterStatus
} from './rateLimiter';

// Self-Healing Service for automatic recovery
export {
  SelfHealingService,
  selfHealingService,
  withSelfHealing,
  HealingStrategy,
  type HealingConfig,
  type HealingAction,
  type HealingAttempt,
  type HealingEvent
} from './selfHealing';

// Reliability Orchestrator for unified management
export {
  ReliabilityOrchestrator,
  reliabilityOrchestrator,
  registerReliableService,
  withOrchestratedReliability,
  type OrchestratorConfig,
  type ServiceReliabilityConfig,
  type OrchestratedServiceStatus,
  type SystemReliabilitySummary
} from './orchestrator';

// Service Dependency Graph for dependency tracking
export {
  ServiceDependencyGraph,
  serviceDependencyGraph,
  DependencyType,
  registerServiceWithDependencies,
  analyzeFailureImpact,
  type DependencyEdge,
  type ServiceNode,
  type ImpactAnalysis,
  type CycleDetectionResult,
  type HealthPropagationEvent
} from './dependencyGraph';

// Adaptive Rate Limiter for dynamic rate limiting
export {
  AdaptiveRateLimiter,
  adaptiveRateLimiter,
  LoadLevel,
  AdaptationStrategy,
  registerAdaptiveRateLimiter,
  updateAdaptiveMetrics,
  type AdaptiveRateLimiterConfig,
  type AdaptiveRateLimiterStatus
} from './adaptiveRateLimiter';

// Latency Budget Tracker for latency monitoring
export {
  LatencyBudgetTracker,
  latencyBudgetTracker,
  ViolationLevel,
  recordLatency,
  registerLatencyBudget,
  type LatencyBudgetConfig,
  type LatencyMetrics,
  type LatencyBudgetEvent,
  type BudgetViolationSummary
} from './latencyBudgetTracker';

// Metrics Exporter for observability
export {
  ReliabilityMetricsExporter,
  metricsExporter,
  exportMetrics,
  getCurrentMetrics,
  type ExportFormat,
  type HealthScore,
  type UnifiedReliabilityMetrics
} from './metricsExporter';

// FetchWithReliability for reliable HTTP requests
export {
  FetchWithReliability,
  fetchWithReliability,
  reliableFetch,
  reliableFetchJson,
  fetchWithTimeout,
  createReliableFetch,
  calculateDelay,
  isRetryableError,
  generateCacheKey,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_TIMEOUT_CONFIG,
  type RetryConfig,
  type TimeoutConfig,
  type FetchReliabilityConfig,
  type FetchMetrics
} from './fetchWithReliability';

// ReliabilityMiddleware for API call patterns
export {
  ReliabilityMiddleware,
  reliabilityMiddleware,
  fetchWithMiddleware,
  fetchJsonWithMiddleware,
  type RequestContext,
  type ResponseContext,
  type MiddlewareFunction,
  type ErrorNormalizerConfig,
  type LoggingConfig,
  type ReliabilityMiddlewareConfig,
  type NormalizedError,
  type MiddlewarePerformanceMetrics
} from './reliabilityMiddleware';

// Backpressure Manager for system overload protection
export {
  BackpressureManager,
  PressureLevel,
  LoadSheddingStrategy,
  shouldAcceptRequest,
  getBackpressureRateFactor,
  withBackpressure,
  type ResourceMetrics,
  type PressureThresholds,
  type BackpressureConfig,
  type BackpressureStatus,
  type PressureEvent,
  type PressureEventListener
} from './backpressureManager';

// Re-export the singleton getter for backward compatibility
export { backpressureManager as backpressureManagerInstance } from './backpressureManager';
