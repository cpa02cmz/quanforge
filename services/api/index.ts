/**
 * API Module - Enhanced API Layer for QuanForge
 * 
 * This module provides a comprehensive API layer with:
 * - Standardized response handling
 * - Request/response interceptors
 * - API versioning support
 * - Client factory pattern
 * - Response caching
 * - Metrics collection
 * - Batch operations
 * - Health monitoring
 * - Request deduplication
 * - Distributed tracing
 * - Unified API facade
 * - Middleware registry
 * 
 * @module services/api
 * @since 2026-02-20
 * @author API Specialist Agent
 */

// ============= Response Handler =============

export {
  // Types
  HTTP_STATUS,
  APIErrorDetail,
  StandardizedAPIError,
  PaginatedData,
  APIResponseMetadata,
  StandardizedAPIResponse,
  
  // Class and Instance
  APIResponseHandler,
  apiResponseHandler,
  
  // Convenience Functions
  apiSuccess,
  apiError,
  apiWrap,
  apiPaginated,
} from './APIResponseHandler';

// ============= Interceptors =============

export {
  // Types
  RequestConfig,
  RequestContext,
  ResponseContext,
  ErrorContext,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
  InterceptorSet,
  
  // Built-in Interceptors
  defaultRequestInterceptors,
  defaultResponseInterceptors,
  defaultErrorInterceptors,
  
  // Manager
  InterceptorManager,
  interceptorManager,
  
  // Convenience Functions
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  
  // Interceptor Factories
  createAuthInterceptor,
  createRateLimitInterceptor,
  createRetryInterceptor,
} from './APIInterceptors';

// ============= Versioning =============

export {
  // Types
  APIVersion,
  VersionConfig,
  VersionInfo,
  
  // Parsing and Comparison
  parseVersion,
  versionToString,
  compareVersions,
  isVersionSupported,
  
  // Manager
  APIVersionManager,
  apiVersionManager,
  
  // Convenience Functions
  getAPIVersion,
  isFeatureAvailable,
  getVersionHeaders,
  createVersionedUrl,
  registerDefaultFeatures,
} from './APIVersioning';

// ============= Client Factory =============

export {
  // Types
  APIClientConfig,
  APIClient,
  
  // Factory Functions
  createAPIClient,
  createGoogleAPIClient,
  createSupabaseAPIClient,
  createOpenAICompatibleClient,
  
  // Default Client
  getDefaultClient,
  initializeDefaultClient,
  hasDefaultClient,
} from './APIClientFactory';

// ============= Response Cache =============

export {
  APIResponseCache,
  apiResponseCache,
  useAPIResponseCache,
  type CacheEntry,
  type CacheStats,
  type CacheOptions,
  type InvalidationEvent,
  type WarmingTask
} from './apiResponseCache';

// ============= Request Interceptor =============

export {
  APIRequestInterceptor as AdvancedRequestInterceptor,
  apiRequestInterceptor,
  useAPIRequestInterceptor,
  APIError as AdvancedAPIError,
  type RequestConfig as InterceptorRequestConfig,
  type InterceptedResponse,
  type RequestMetrics,
  type InterceptorStats
} from './apiRequestInterceptor';

// ============= Metrics Collector =============

export {
  APIMetricsCollector,
  apiMetricsCollector,
  useAPIMetrics,
  type RequestMetric,
  type EndpointStats,
  type AlertConfig,
  type AlertEvent,
  type MetricsSummary,
  type TimeSeriesPoint
} from './apiMetricsCollector';

// ============= Batch Operations =============

export {
  APIBatchOperations,
  apiBatchOperations,
  useAPIBatchOperations,
  type BatchItem,
  type BatchResult,
  type BatchConfig,
  type BatchStatus,
  type BatchSummary
} from './apiBatchOperations';

// ============= Health Monitor =============

export {
  APIHealthMonitor,
  apiHealthMonitor,
  useAPIHealthMonitor,
  type HealthStatus,
  type HealthCheckConfig,
  type HealthCheckResult,
  type HealthSummary,
  type HealthAlert,
  type HealthAlertHandler
} from './apiHealthMonitor';

// ============= Request Deduplicator =============

export {
  APIRequestDeduplicator,
  apiRequestDeduplicator,
  useAPIRequestDeduplicator,
  type RequestFingerprint,
  type DeduplicationConfig,
  type DeduplicationStats
} from './apiRequestDeduplicator';

// ============= Tracing =============

export {
  APITracing,
  apiTracing,
  useAPITracing,
  type SpanKind,
  type SpanStatus,
  type TraceContext,
  type AttributeValue,
  type SpanEvent,
  type SpanLink,
  type Span,
  type TracingConfig,
  type TracingStats
} from './apiTracing';

// ============= Re-export Common Types =============

export { APIResponse } from '../../types/common';

// ============= Unified API Facade =============

export {
  // Types
  UnifiedAPIConfig,
  UnifiedRequestOptions,
  UnifiedAPIStats,
  UnifiedAPIHealth,
  
  // Class and Instance
  UnifiedAPIFacade,
  getUnifiedAPIFacade,
  initializeUnifiedAPIFacade,
  hasUnifiedAPIFacade,
  
  // Convenience Functions
  unifiedGet,
  unifiedPost,
  unifiedPut,
  unifiedDelete,
  
  // React Hook
  useUnifiedAPI,
} from './apiUnifiedFacade';

// ============= Middleware Registry =============

export {
  // Types
  MiddlewareContext,
  MiddlewarePhase,
  MiddlewarePriority,
  MiddlewareConfig,
  MiddlewareFunction,
  MiddlewareResult,
  RegistryStats,
  
  // Class and Instance
  APIMiddlewareRegistry,
  getAPIMiddlewareRegistry,
  initializeAPIMiddlewareRegistry,
  hasAPIMiddlewareRegistry,
  
  // Convenience Functions
  registerPreRequestMiddleware,
  registerPostRequestMiddleware,
  registerErrorMiddleware,
  
  // React Hook
  useAPIMiddleware,
} from './apiMiddlewareRegistry';

// ============= Request Queue =============

export {
  // Types
  RequestPriority,
  RequestStatus,
  QueuedRequest,
  QueueConfig,
  QueueStats,
  QueueEvent,
  QueueEventHandler,
  
  // Class and Instance
  APIRequestQueue,
  getAPIRequestQueue,
  initializeAPIRequestQueue,
  hasAPIRequestQueue,
  
  // Convenience Functions
  queueRequest,
  queueHighPriority,
  queueLowPriority,
  queueBackground,
  
  // React Hook
  useAPIRequestQueue,
} from './apiRequestQueue';

// ============= Retry Policy =============

export {
  // Types
  BackoffStrategy,
  RetryCondition,
  RetryContext,
  RetryPolicyConfig,
  RetryAttemptResult,
  RetryStats,
  CircuitBreakerState,
  EndpointRetryConfig,
  
  // Class and Instance
  APIRetryPolicy,
  getAPIRetryPolicy,
  initializeAPIRetryPolicy,
  hasAPIRetryPolicy,
  
  // Convenience Functions
  withRetry,
  createRetryable,
  
  // Pre-built Retry Conditions
  retryOnNetworkError,
  retryOnServerError,
  retryOnRateLimit,
  retryOnTransientError,
  
  // React Hook
  useAPIRetryPolicy,
} from './apiRetryPolicy';

// ============= Utility Functions =============

import { apiResponseCache } from './apiResponseCache';
import { apiRequestInterceptor } from './apiRequestInterceptor';
import { apiMetricsCollector } from './apiMetricsCollector';
import { apiBatchOperations } from './apiBatchOperations';
import { apiHealthMonitor } from './apiHealthMonitor';
import { apiRequestDeduplicator } from './apiRequestDeduplicator';
import { apiTracing } from './apiTracing';
import { getUnifiedAPIFacade, hasUnifiedAPIFacade } from './apiUnifiedFacade';
import { getAPIMiddlewareRegistry, hasAPIMiddlewareRegistry } from './apiMiddlewareRegistry';
import { getAPIRequestQueue, hasAPIRequestQueue } from './apiRequestQueue';
import { getAPIRetryPolicy, hasAPIRetryPolicy } from './apiRetryPolicy';

/**
 * Initialize all API services
 * Call this early in the application lifecycle
 */
export function initializeAPIServices(): void {
  // Services auto-initialize via their constructors
  // This function can be used for additional setup if needed
}

/**
 * Get health status of all API services
 */
export function getAPIServicesHealth(): {
  cache: ReturnType<typeof apiResponseCache.getStats>;
  interceptor: ReturnType<typeof apiRequestInterceptor.getStats>;
  metrics: ReturnType<typeof apiMetricsCollector.getSummary>;
  batch: ReturnType<typeof apiBatchOperations.getStats>;
  health: ReturnType<typeof apiHealthMonitor.getSummary>;
  deduplicator: ReturnType<typeof apiRequestDeduplicator.getStats>;
  tracing: ReturnType<typeof apiTracing.getStats>;
  unifiedFacade?: ReturnType<typeof getUnifiedAPIFacade>['getStats'] extends () => infer R ? R : never;
  middlewareRegistry?: ReturnType<typeof getAPIMiddlewareRegistry>['getStats'] extends () => infer R ? R : never;
  requestQueue?: ReturnType<typeof getAPIRequestQueue>['getStats'] extends () => infer R ? R : never;
  retryPolicy?: ReturnType<typeof getAPIRetryPolicy>['getStats'] extends () => infer R ? R : never;
} {
  return {
    cache: apiResponseCache.getStats(),
    interceptor: apiRequestInterceptor.getStats(),
    metrics: apiMetricsCollector.getSummary(),
    batch: apiBatchOperations.getStats(),
    health: apiHealthMonitor.getSummary(),
    deduplicator: apiRequestDeduplicator.getStats(),
    tracing: apiTracing.getStats(),
    unifiedFacade: hasUnifiedAPIFacade() ? getUnifiedAPIFacade().getStats() as any : undefined,
    middlewareRegistry: hasAPIMiddlewareRegistry() ? getAPIMiddlewareRegistry().getStats() as any : undefined,
    requestQueue: hasAPIRequestQueue() ? getAPIRequestQueue().getStats() as any : undefined,
    retryPolicy: hasAPIRetryPolicy() ? getAPIRetryPolicy().getStats() as any : undefined,
  };
}

/**
 * Destroy all API services
 * Call this when the application is shutting down
 */
export function destroyAPIServices(): void {
  apiResponseCache.destroy();
  apiRequestInterceptor.destroy();
  apiMetricsCollector.destroy();
  apiBatchOperations.destroy();
  apiHealthMonitor.destroy();
  apiRequestDeduplicator.destroy();
  apiTracing.destroy();
  if (hasUnifiedAPIFacade()) {
    getUnifiedAPIFacade().destroy();
  }
  if (hasAPIMiddlewareRegistry()) {
    getAPIMiddlewareRegistry().destroy();
  }
  if (hasAPIRequestQueue()) {
    getAPIRequestQueue().destroy();
  }
  if (hasAPIRetryPolicy()) {
    getAPIRetryPolicy().destroy();
  }
}
