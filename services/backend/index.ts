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

// Enums and Constants
export { BackendEventType, DEFAULT_BACKEND_CONFIG } from './types';
export { DEFAULT_RATE_LIMITS } from './rateLimiter';
export { DEFAULT_QUEUE_CONFIGS } from './requestQueue';

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

// Load Balancer
export {
  BackendLoadBalancer,
  backendLoadBalancer,
  getNextBackendInstance,
  acquireBackendConnection,
  releaseBackendConnection,
  recordBackendRequest,
  DEFAULT_LOAD_BALANCER_CONFIGS,
} from './loadBalancer';

// Load Balancer Types
export type {
  LoadBalancingStrategy,
  BackendInstance,
  LoadBalancerConfig,
  LoadBalancerStats,
  LoadBalancerResult,
} from './loadBalancer';

// Import for use in this module
import { backendManager } from './manager';

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
