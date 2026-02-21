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
 * 
 * @module services/api
 * @since 2026-02-20
 * @author API Specialist Agent
 */

// ============= Local Imports for Utility Functions =============

import { apiResponseCache } from './apiResponseCache';
import { apiRequestInterceptor } from './apiRequestInterceptor';
import { apiMetricsCollector } from './apiMetricsCollector';

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

// ============= Utility Functions =============

import { apiResponseCache } from './apiResponseCache';
import { apiRequestInterceptor } from './apiRequestInterceptor';
import { apiMetricsCollector } from './apiMetricsCollector';
import { apiBatchOperations } from './apiBatchOperations';
import { apiHealthMonitor } from './apiHealthMonitor';
import { apiRequestDeduplicator } from './apiRequestDeduplicator';
import { apiTracing } from './apiTracing';

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
} {
  return {
    cache: apiResponseCache.getStats(),
    interceptor: apiRequestInterceptor.getStats(),
    metrics: apiMetricsCollector.getSummary(),
    batch: apiBatchOperations.getStats(),
    health: apiHealthMonitor.getSummary(),
    deduplicator: apiRequestDeduplicator.getStats(),
    tracing: apiTracing.getStats()
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
}
