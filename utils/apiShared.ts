/**
 * Shared API utilities for better maintainability across all routes
 * Consolidates common patterns: error handling, validation, caching, headers, etc.
 */

// Web standard types for API requests
export interface APIRequest extends Request {}
export interface APIResponse extends Response {}
import { securityManager } from '../services/securityManager';
import { robotCache } from '../services/advancedCache';
import { performanceMonitor } from '../services/performanceMonitorEnhanced';

// Create alias for advancedCache compatibility
const advancedCache = robotCache;

// Create alias for performanceMonitor compatibility
const performanceMonitorEnhanced = {
  recordMetric: (name: string, duration: number) => {
    performanceMonitor.recordMetric(name, duration);
  }
};

// Standard edge configuration for all API routes
export const edgeConfig = {
  runtime: 'edge' as const,
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
  maxDuration: 15,
  memory: 512,
};

// Common interface for route context (dynamic routes)
export interface RouteContext {
  params: Promise<{ id?: string; symbol?: string }>;
}

// Error handling utilities
export class APIError extends Error {
  constructor(
    public override message: string,
    public status: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export const createErrorResponse = (
  error: Error | APIError,
  startTime: number,
  additionalHeaders: Record<string, string> = {}
) => {
  const duration = performance.now() - startTime;
  const status = error instanceof APIError ? error.status : 500;
  
  return Response.json(
    {
      success: false,
      error: error.message,
      ...(error instanceof APIError && error.details && { details: error.details }),
      ...(process.env['NODE_ENV'] === 'development' && { stack: error.stack }),
    },
    {
      status,
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'no-cache',
        'X-Edge-Region': process.env['VERCEL_REGION'] || 'unknown',
        ...additionalHeaders,
      },
    }
  );
};

export const createSuccessResponse = (
  data: any,
  startTime: number,
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
) => {
  const duration = performance.now() - startTime;
  
  return Response.json(data, {
    status,
    headers: {
      'X-Response-Time': `${duration.toFixed(2)}ms`,
      'X-Edge-Region': process.env['VERCEL_REGION'] || 'unknown',
      ...additionalHeaders,
    },
  });
};

// Request validation utilities
export const validateAndParseBody = async (request: Request, validationType: string = 'general') => {
  try {
    const body = await request.json();
    
    if (validationType === 'robot' || validationType === 'strategy') {
      const validation = securityManager.sanitizeAndValidate(body, validationType);
      if (!validation.isValid) {
        throw new APIError('Validation failed', 400, validation.errors);
      }
      return validation.sanitizedData;
    }
    
    return body;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new APIError('Invalid JSON in request body', 400);
    }
    throw error;
  }
};

export const validateRouteParam = (param: string | undefined, paramName: string, type: 'string' | 'number' = 'string') => {
  if (!param || typeof param !== 'string') {
    throw new APIError(`Invalid ${paramName}`, 400);
  }
  
  if (type === 'number') {
    const num = parseFloat(param);
    if (isNaN(num)) {
      throw new APIError(`Invalid ${paramName}: must be a number`, 400);
    }
    return num;
  }
  
  return param;
};

// Query parameter parsing and validation
export const parseQueryParams = (request: Request) => {
  const { searchParams } = new URL(request.url);
  return {
    page: Math.max(1, parseInt(searchParams.get('page') || '1', 10)),
    limit: Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10))),
    search: searchParams.get('search') || undefined,
    type: searchParams.get('type') || undefined,
    category: searchParams.get('category') || undefined,
    difficulty: searchParams.get('difficulty') || undefined,
    sort: searchParams.get('sort') || 'created_at',
    order: searchParams.get('order') || 'desc',
    ids: searchParams.get('ids')?.split(',').filter(Boolean),
    symbols: searchParams.get('symbols')?.split(',').filter(Boolean),
    timeframe: searchParams.get('timeframe') || '1m',
    includeTechnical: searchParams.get('technical') === 'true',
  };
};

// Cache management utilities
export const checkCache = async (cacheKey: string) => {
  const cached = await advancedCache.get(cacheKey);
  return cached;
};

export const setCache = async (cacheKey: string, data: any, options: {
  ttl?: number;
  tags?: string[];
  priority?: 'high' | 'medium' | 'low';
} = {}) => {
  await advancedCache.set(cacheKey, data, {
    ttl: options.ttl || 5 * 60 * 1000, // 5 minutes default
    tags: options.tags || [],
    priority: options.priority === 'medium' ? 'normal' : (options.priority || 'normal'),
  });
};

export const invalidateCache = async (tags: string[]) => {
  await advancedCache.clearByTags(tags);
};

export const deleteCacheKey = async (cacheKey: string) => {
  await advancedCache.delete(cacheKey);
};

// Performance monitoring wrapper
export const withPerformanceMonitoring = async <T>(
  metricName: string,
  fn: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric(metricName, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric(`${metricName}_error`, duration);
    throw error;
  }
};

// HTTP method handlers with common patterns
export const handleGetRequest = <T>(
  request: Request,
  handler: (params: any) => Promise<T>,
  cacheConfig?: {
    key: string;
    ttl?: number;
    tags?: string[];
    headers?: Record<string, string>;
  }
) => {
  return withPerformanceMonitoring(`api_get`, async () => {
    const startTime = performance.now();
    
    try {
      const params = parseQueryParams(request);
      
      // Check cache if configured
      if (cacheConfig) {
        const cacheKey = `${cacheConfig.key}_${JSON.stringify(params)}`;
        const cached = await checkCache(cacheKey);
        
        if (cached) {
          return Response.json(cached, {
            headers: {
              'X-Cache': 'HIT',
              'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
              'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
              ...cacheConfig.headers,
            },
          });
        }
        
        // Execute handler and cache result
        const result = await handler(params);
        await setCache(cacheKey, result, {
          ttl: cacheConfig.ttl,
          tags: cacheConfig.tags,
        });
        
        return Response.json(result, {
          headers: {
            'X-Cache': 'MISS',
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
            ...cacheConfig.headers,
          },
        });
      }
      
      // No caching - execute directly
      const result = await handler(params);
      return createSuccessResponse(result, startTime);
      
    } catch (error) {
      return createErrorResponse(error as Error, startTime);
    }
  });
};

export const handlePostRequest = <T>(
  request: Request,
  handler: (data: any, params: any) => Promise<T>,
  validationType?: string,
  invalidateTags: string[] = []
) => {
  return withPerformanceMonitoring(`api_post`, async () => {
    const startTime = performance.now();
    
    try {
      const data = await validateAndParseBody(request, validationType);
      const params = parseQueryParams(request);
      const result = await handler(data, params);
      
      // Invalidate relevant caches
      if (invalidateTags.length > 0) {
        await invalidateCache(invalidateTags);
      }
      
      return createSuccessResponse(result, startTime, 201);
      
    } catch (error) {
      return createErrorResponse(error as Error, startTime);
    }
  });
};

export const handlePutRequest = <T>(
  request: Request,
  context: RouteContext,
  handler: (id: string, data: any) => Promise<T>,
  validationType?: string,
  invalidateTags: string[] = []
) => {
  return withPerformanceMonitoring(`api_put`, async () => {
    const startTime = performance.now();
    
    try {
      const { id } = await context.params;
      const validatedId = validateRouteParam(id, 'ID');
      const data = await validateAndParseBody(request, validationType);
      const result = await handler(String(validatedId), data);
      
      // Invalidate caches
      await deleteCacheKey(`${validationType || 'resource'}_${String(validatedId)}`);
      await invalidateCache(invalidateTags);
      
      return createSuccessResponse(result, startTime);
      
    } catch (error) {
      return createErrorResponse(error as Error, startTime);
    }
  });
};

export const handleDeleteRequest = <T>(
  request: Request,
  context?: RouteContext,
  handler?: (id: string, params: any) => Promise<T>,
  invalidateTags: string[] = []
) => {
  return withPerformanceMonitoring(`api_delete`, async () => {
    const startTime = performance.now();
    
    try {
      const params = parseQueryParams(request);
      let result: T;
      
      if (context && handler) {
        // Delete specific resource
        const { id } = await context.params;
        const validatedId = validateRouteParam(id, 'ID');
        result = await handler(String(validatedId), params);
        
        // Invalidate specific and list caches
        await deleteCacheKey(`resource_${String(validatedId)}`);
        await invalidateCache(invalidateTags);
      } else {
        // Batch delete using query params
        if (!handler) {
          throw new APIError('Handler function required for batch operations', 500);
        }
        result = await handler('', params);
        await invalidateCache(invalidateTags);
      }
      
      return createSuccessResponse(result, startTime);
      
    } catch (error) {
      return createErrorResponse(error as Error, startTime);
    }
  });
};

// CORS utilities
export const createCORSResponse = (
  data?: any,
  status: number = 200,
  headers: Record<string, string> = {}
) => {
  return Response.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      ...headers,
    },
  });
};

export const handleCORS = () => {
  return createCORSResponse(null, 200, {
    'Access-Control-Max-Age': '86400',
  });
};

// Database error handling
export const handleDatabaseError = (error: any, resource: string) => {
  if (error?.message?.includes('not found')) {
    throw new APIError(`${resource} not found`, 404);
  }
  throw new APIError(`Database operation failed: ${error?.message || 'Unknown error'}`, 500);
};

// Common validation patterns
export const validateRequiredFields = (body: any, requiredFields: string[]) => {
  const missing = requiredFields.filter(field => !body[field]);
  if (missing.length > 0) {
    throw new APIError(`Missing required fields: ${missing.join(', ')}`, 400);
  }
};

export const sanitizeArray = (arr: any[], sanitizeType: string): string[] => {
  return arr
    .map(item => securityManager.sanitizeInput(String(item).trim(), sanitizeType as any))
    .filter(Boolean);
};

// Standard response builders
export const buildPaginatedResponse = (
  data: any[],
  pagination: any,
  meta: any = {}
) => ({
  success: true,
  data,
  pagination,
  meta: {
    total: pagination?.totalCount || data.length,
    ...meta,
  },
});

export const buildSingleResourceResponse = (resource: any, messageType: string = 'fetched') => ({
  success: true,
  data: resource,
  message: `${resource?.type || 'Resource'} ${messageType} successfully`,
});

export const buildOperationResponse = (
  operation: 'create' | 'update' | 'delete',
  count: number = 1,
  resourceType: string = 'resource'
) => ({
  success: true,
  data: {
    [operation === 'delete' ? 'deleted' : operation === 'update' ? 'updated' : 'created']: count,
  },
  message: `${operation === 'delete' ? 'Deleted' : operation === 'update' ? 'Updated' : 'Created'} ${count} ${resourceType}${count !== 1 ? 's' : ''} successfully`,
});

// Rate limiting and security headers
export const addSecurityHeaders = (headers: Record<string, string> = {}) => {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...headers,
  };
};