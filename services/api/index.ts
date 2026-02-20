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

// ============= Re-export Common Types =============

export { APIResponse } from '../../types/common';
