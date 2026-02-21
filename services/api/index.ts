/**
 * API Module - Enhanced API Layer for QuanForge
 * 
 * This module provides a comprehensive API layer with:
 * - Standardized response handling
 * - Request/response interceptors
 * - API versioning support
 * - Client factory pattern
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

// ============= Re-export Common Types =============

export { APIResponse } from '../../types/common';

// ============= Utility Functions =============

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
} {
  return {
    cache: apiResponseCache.getStats(),
    interceptor: apiRequestInterceptor.getStats(),
    metrics: apiMetricsCollector.getSummary()
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
}
