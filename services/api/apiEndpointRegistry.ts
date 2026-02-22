/**
 * API Endpoint Registry - Centralized Endpoint Management
 * 
 * This module provides a centralized registry for all API endpoints with:
 * - Type-safe endpoint definitions
 * - Dynamic URL building with path parameters
 * - Endpoint versioning support
 * - Environment-based URL configuration
 * - Endpoint health tracking
 * - Request/Response type associations
 * 
 * Benefits:
 * - Single source of truth for all API endpoints
 * - Type-safe endpoint access
 * - Easy endpoint configuration management
 * - Automatic endpoint health monitoring
 * - Simplified API client usage
 * 
 * @module services/api/apiEndpointRegistry
 * @since 2026-02-22
 * @author API Specialist Agent
 */

import { createScopedLogger } from '../../utils/logger';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('APIEndpointRegistry');

// ============= Types =============

/**
 * HTTP methods supported by endpoints
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Endpoint category for grouping
 */
export type EndpointCategory = 
  | 'auth'
  | 'data'
  | 'ai'
  | 'market'
  | 'user'
  | 'analytics'
  | 'storage'
  | 'webhook'
  | 'health'
  | 'admin'
  | 'external';

/**
 * Endpoint configuration
 */
export interface EndpointConfig<TParams = Record<string, string>, TQuery = Record<string, unknown>, TBody = unknown, TResponse = unknown> {
  /** Unique endpoint identifier */
  id: string;
  /** Human-readable endpoint name */
  name: string;
  /** Endpoint description */
  description?: string;
  /** HTTP method */
  method: HTTPMethod;
  /** URL path pattern (supports :param syntax) */
  path: string;
  /** Base URL override (optional) */
  baseUrl?: string;
  /** Endpoint category */
  category: EndpointCategory;
  /** Whether endpoint requires authentication */
  requiresAuth: boolean;
  /** Whether endpoint is deprecated */
  deprecated?: boolean;
  /** Deprecation message if deprecated */
  deprecationMessage?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Default retry count */
  retryCount?: number;
  /** Cache TTL in seconds (0 = no caching) */
  cacheTTL?: number;
  /** Rate limit requests per minute */
  rateLimit?: number;
  /** Request parameter types */
  paramsType?: TParams;
  /** Query parameter types */
  queryType?: TQuery;
  /** Request body types */
  bodyType?: TBody;
  /** Response type */
  responseType?: TResponse;
  /** Custom headers for this endpoint */
  headers?: Record<string, string>;
  /** Tags for grouping/filtering */
  tags?: string[];
  /** Whether to enable request deduplication */
  enableDeduplication?: boolean;
  /** Whether to enable response caching */
  enableCache?: boolean;
}

/**
 * Resolved endpoint with full URL
 */
export interface ResolvedEndpoint {
  /** Endpoint ID */
  id: string;
  /** Full URL with parameters resolved */
  url: string;
  /** HTTP method */
  method: HTTPMethod;
  /** Endpoint configuration */
  config: EndpointConfig;
  /** Request headers (merged with defaults) */
  headers: Record<string, string>;
}

/**
 * Endpoint health status
 */
export interface EndpointHealth {
  /** Endpoint ID */
  endpointId: string;
  /** Whether endpoint is healthy */
  healthy: boolean;
  /** Last check timestamp */
  lastCheck: number;
  /** Average response time in ms */
  averageResponseTime: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Total requests */
  totalRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Last error message */
  lastError?: string;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  /** Total registered endpoints */
  totalEndpoints: number;
  /** Endpoints by category */
  endpointsByCategory: Record<EndpointCategory, number>;
  /** Deprecated endpoints */
  deprecatedEndpoints: number;
  /** Auth-required endpoints */
  authRequiredEndpoints: number;
  /** Cached endpoints */
  cachedEndpoints: number;
  /** Overall health status */
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  /** Average response time across all endpoints */
  averageResponseTime: number;
}

/**
 * Base URL configuration
 */
export interface BaseURLConfig {
  /** Default base URL */
  default: string;
  /** Development environment URL */
  development?: string;
  /** Staging environment URL */
  staging?: string;
  /** Production environment URL */
  production?: string;
  /** Custom environment URLs */
  [key: string]: string | undefined;
}

// ============= Default Base URLs =============

const DEFAULT_BASE_URLS: Record<string, BaseURLConfig> = {
  api: {
    default: '/api',
    development: 'http://localhost:3000/api',
    production: '/api',
  },
  supabase: {
    default: (typeof import.meta !== 'undefined' ? (import.meta as ImportMeta & { env: Record<string, string> }).env?.VITE_SUPABASE_URL : '') || '',
  },
  gemini: {
    default: 'https://generativelanguage.googleapis.com/v1beta',
  },
  market: {
    default: 'https://api.twelvedata.com',
  },
};

// ============= API Endpoint Registry Class =============

/**
 * API Endpoint Registry
 * 
 * A centralized registry for managing all API endpoints with type-safe access,
 * health monitoring, and dynamic URL building.
 */
export class APIEndpointRegistry {
  private endpoints = new Map<string, EndpointConfig>();
  private baseUrls = new Map<string, BaseURLConfig>();
  private health = new Map<string, EndpointHealth>();
  private defaultHeaders: Record<string, string> = {};
  private environment: string = 'default';
  
  // Statistics
  private stats = {
    totalRequests: 0,
    totalErrors: 0,
    totalResponseTime: 0,
  };
  
  // Cleanup interval
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Initialize default base URLs
    for (const [key, config] of Object.entries(DEFAULT_BASE_URLS)) {
      this.baseUrls.set(key, config);
    }
    
    // Register built-in endpoints
    this.registerBuiltinEndpoints();
    
    // Start periodic cleanup
    this.startCleanup();
    
    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiEndpointRegistry', {
        cleanup: () => this.destroy(),
        priority: 'medium',
        description: 'API endpoint registry service',
      });
    }
    
    logger.info('API Endpoint Registry initialized');
  }

  // ============= Registration Methods =============

  /**
   * Register a new endpoint
   */
  register<TParams = Record<string, string>, TQuery = Record<string, unknown>, TBody = unknown, TResponse = unknown>(
    config: EndpointConfig<TParams, TQuery, TBody, TResponse>
  ): () => void {
    if (this.endpoints.has(config.id)) {
      logger.warn(`Endpoint already registered: ${config.id}, overwriting`);
    }
    
    this.endpoints.set(config.id, config as EndpointConfig);
    
    // Initialize health tracking
    this.health.set(config.id, {
      endpointId: config.id,
      healthy: true,
      lastCheck: Date.now(),
      averageResponseTime: 0,
      successRate: 1,
      totalRequests: 0,
      failedRequests: 0,
    });
    
    logger.debug(`Registered endpoint: ${config.id} (${config.method} ${config.path})`);
    
    // Return unregister function
    return () => {
      this.unregister(config.id);
    };
  }

  /**
   * Register multiple endpoints at once
   */
  registerAll(configs: EndpointConfig[]): void {
    for (const config of configs) {
      this.register(config);
    }
  }

  /**
   * Unregister an endpoint
   */
  unregister(endpointId: string): boolean {
    const deleted = this.endpoints.delete(endpointId);
    this.health.delete(endpointId);
    
    if (deleted) {
      logger.debug(`Unregistered endpoint: ${endpointId}`);
    }
    
    return deleted;
  }

  /**
   * Register a base URL configuration
   */
  registerBaseUrl(name: string, config: BaseURLConfig): void {
    this.baseUrls.set(name, config);
    logger.debug(`Registered base URL: ${name}`);
  }

  // ============= Resolution Methods =============

  /**
   * Get an endpoint configuration by ID
   */
  get<TParams = Record<string, string>, TQuery = Record<string, unknown>, TBody = unknown, TResponse = unknown>(
    endpointId: string
  ): EndpointConfig<TParams, TQuery, TBody, TResponse> | null {
    return (this.endpoints.get(endpointId) as EndpointConfig<TParams, TQuery, TBody, TResponse>) || null;
  }

  /**
   * Resolve an endpoint to a full URL with parameters
   */
  resolve(
    endpointId: string,
    params?: Record<string, string>,
    query?: Record<string, unknown>
  ): ResolvedEndpoint | null {
    const config = this.endpoints.get(endpointId);
    if (!config) {
      logger.warn(`Endpoint not found: ${endpointId}`);
      return null;
    }
    
    // Check deprecation
    if (config.deprecated) {
      logger.warn(`Using deprecated endpoint: ${endpointId}. ${config.deprecationMessage || ''}`);
    }
    
    // Build URL
    const baseUrl = this.getBaseUrl(config);
    let url = this.buildPath(config.path, params);
    
    // Add query parameters
    if (query && Object.keys(query).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      url += `?${searchParams.toString()}`;
    }
    
    // Merge headers
    const headers = {
      ...this.defaultHeaders,
      ...config.headers,
    };
    
    return {
      id: endpointId,
      url: baseUrl + url,
      method: config.method,
      config,
      headers,
    };
  }

  /**
   * Get all endpoints in a category
   */
  getByCategory(category: EndpointCategory): EndpointConfig[] {
    return Array.from(this.endpoints.values()).filter(e => e.category === category);
  }

  /**
   * Get all endpoints matching a tag
   */
  getByTag(tag: string): EndpointConfig[] {
    return Array.from(this.endpoints.values()).filter(e => e.tags?.includes(tag));
  }

  /**
   * Search endpoints by name or description
   */
  search(query: string): EndpointConfig[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.endpoints.values()).filter(e => 
      e.name.toLowerCase().includes(lowerQuery) ||
      e.description?.toLowerCase().includes(lowerQuery) ||
      e.path.toLowerCase().includes(lowerQuery)
    );
  }

  // ============= Health Methods =============

  /**
   * Get health status for an endpoint
   */
  getHealth(endpointId: string): EndpointHealth | null {
    return this.health.get(endpointId) || null;
  }

  /**
   * Record a request result for health tracking
   */
  recordRequest(
    endpointId: string,
    success: boolean,
    responseTime: number,
    error?: string
  ): void {
    const health = this.health.get(endpointId);
    if (!health) return;
    
    health.lastCheck = Date.now();
    health.totalRequests++;
    health.averageResponseTime = 
      (health.averageResponseTime * (health.totalRequests - 1) + responseTime) / 
      health.totalRequests;
    
    if (!success) {
      health.failedRequests++;
      health.lastError = error;
    }
    
    health.successRate = 1 - (health.failedRequests / health.totalRequests);
    health.healthy = health.successRate > 0.8;
    
    // Update global stats
    this.stats.totalRequests++;
    this.stats.totalResponseTime += responseTime;
    if (!success) {
      this.stats.totalErrors++;
    }
  }

  /**
   * Get all unhealthy endpoints
   */
  getUnhealthyEndpoints(): EndpointHealth[] {
    return Array.from(this.health.values()).filter(h => !h.healthy);
  }

  // ============= Configuration Methods =============

  /**
   * Set the current environment
   */
  setEnvironment(env: string): void {
    this.environment = env;
    logger.info(`Environment set to: ${env}`);
  }

  /**
   * Set default headers for all requests
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  /**
   * Update an endpoint configuration
   */
  updateEndpoint(endpointId: string, updates: Partial<EndpointConfig>): boolean {
    const existing = this.endpoints.get(endpointId);
    if (!existing) return false;
    
    this.endpoints.set(endpointId, { ...existing, ...updates });
    logger.debug(`Updated endpoint: ${endpointId}`);
    return true;
  }

  /**
   * Mark an endpoint as deprecated
   */
  deprecate(endpointId: string, message?: string): boolean {
    return this.updateEndpoint(endpointId, {
      deprecated: true,
      deprecationMessage: message,
    });
  }

  // ============= Statistics Methods =============

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const endpointsByCategory: Record<EndpointCategory, number> = {
      auth: 0, data: 0, ai: 0, market: 0, user: 0,
      analytics: 0, storage: 0, webhook: 0, health: 0,
      admin: 0, external: 0,
    };
    
    let deprecatedEndpoints = 0;
    let authRequiredEndpoints = 0;
    let cachedEndpoints = 0;
    
    for (const endpoint of this.endpoints.values()) {
      endpointsByCategory[endpoint.category]++;
      if (endpoint.deprecated) deprecatedEndpoints++;
      if (endpoint.requiresAuth) authRequiredEndpoints++;
      if (endpoint.enableCache) cachedEndpoints++;
    }
    
    // Calculate overall health
    const unhealthyCount = this.getUnhealthyEndpoints().length;
    const healthRatio = 1 - (unhealthyCount / Math.max(this.endpoints.size, 1));
    
    let overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    if (healthRatio > 0.9) {
      overallHealth = 'healthy';
    } else if (healthRatio > 0.7) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'unhealthy';
    }
    
    return {
      totalEndpoints: this.endpoints.size,
      endpointsByCategory,
      deprecatedEndpoints,
      authRequiredEndpoints,
      cachedEndpoints,
      overallHealth,
      averageResponseTime: this.stats.totalRequests > 0
        ? this.stats.totalResponseTime / this.stats.totalRequests
        : 0,
    };
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      totalErrors: 0,
      totalResponseTime: 0,
    };
    
    for (const health of this.health.values()) {
      health.totalRequests = 0;
      health.failedRequests = 0;
      health.averageResponseTime = 0;
      health.successRate = 1;
      health.healthy = true;
      health.lastCheck = Date.now();
    }
    
    logger.info('Endpoint registry statistics reset');
  }

  // ============= Utility Methods =============

  /**
   * Check if an endpoint exists
   */
  has(endpointId: string): boolean {
    return this.endpoints.has(endpointId);
  }

  /**
   * Get all endpoint IDs
   */
  getEndpointIds(): string[] {
    return Array.from(this.endpoints.keys());
  }

  /**
   * Clear all endpoints
   */
  clear(): void {
    this.endpoints.clear();
    this.health.clear();
    logger.info('All endpoints cleared');
  }

  /**
   * Destroy the registry
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    logger.info('API Endpoint Registry destroyed');
  }

  // ============= Private Methods =============

  private getBaseUrl(config: EndpointConfig): string {
    // Use explicit baseUrl override
    if (config.baseUrl) {
      return config.baseUrl;
    }
    
    // Determine base URL from category
    const baseKey = this.categoryToBaseKey(config.category);
    const baseConfig = this.baseUrls.get(baseKey);
    
    if (baseConfig) {
      return baseConfig[this.environment] || baseConfig.default || '';
    }
    
    return '';
  }

  private categoryToBaseKey(category: EndpointCategory): string {
    const mapping: Partial<Record<EndpointCategory, string>> = {
      auth: 'api',
      data: 'api',
      ai: 'gemini',
      market: 'market',
      user: 'api',
      analytics: 'api',
      storage: 'supabase',
      webhook: 'api',
      health: 'api',
      admin: 'api',
      external: 'api',
    };
    return mapping[category] || 'api';
  }

  private buildPath(path: string, params?: Record<string, string>): string {
    if (!params) return path;
    
    let result = path;
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(`:${key}`, encodeURIComponent(value));
    }
    return result;
  }

  private registerBuiltinEndpoints(): void {
    // Authentication endpoints
    this.register({
      id: 'auth.login',
      name: 'Login',
      description: 'User login endpoint',
      method: 'POST',
      path: '/auth/login',
      category: 'auth',
      requiresAuth: false,
      tags: ['auth', 'public'],
    });

    this.register({
      id: 'auth.logout',
      name: 'Logout',
      method: 'POST',
      path: '/auth/logout',
      category: 'auth',
      requiresAuth: true,
      tags: ['auth'],
    });

    this.register({
      id: 'auth.refresh',
      name: 'Refresh Token',
      method: 'POST',
      path: '/auth/refresh',
      category: 'auth',
      requiresAuth: true,
      tags: ['auth'],
    });

    // Data endpoints
    this.register({
      id: 'data.robots.list',
      name: 'List Robots',
      method: 'GET',
      path: '/robots',
      category: 'data',
      requiresAuth: true,
      enableCache: true,
      cacheTTL: 60,
      tags: ['robots', 'list'],
    });

    this.register({
      id: 'data.robots.get',
      name: 'Get Robot',
      method: 'GET',
      path: '/robots/:id',
      category: 'data',
      requiresAuth: true,
      enableCache: true,
      cacheTTL: 60,
      tags: ['robots'],
    });

    this.register({
      id: 'data.robots.create',
      name: 'Create Robot',
      method: 'POST',
      path: '/robots',
      category: 'data',
      requiresAuth: true,
      tags: ['robots', 'create'],
    });

    this.register({
      id: 'data.robots.update',
      name: 'Update Robot',
      method: 'PUT',
      path: '/robots/:id',
      category: 'data',
      requiresAuth: true,
      tags: ['robots', 'update'],
    });

    this.register({
      id: 'data.robots.delete',
      name: 'Delete Robot',
      method: 'DELETE',
      path: '/robots/:id',
      category: 'data',
      requiresAuth: true,
      tags: ['robots', 'delete'],
    });

    // AI endpoints
    this.register({
      id: 'ai.generate',
      name: 'Generate Code',
      method: 'POST',
      path: '/models/gemini-3-pro-preview:generateContent',
      baseUrl: DEFAULT_BASE_URLS.gemini.default,
      category: 'ai',
      requiresAuth: false,
      timeout: 60000,
      retryCount: 2,
      tags: ['ai', 'generation'],
    });

    this.register({
      id: 'ai.analyze',
      name: 'Analyze Strategy',
      method: 'POST',
      path: '/models/gemini-2.5-flash:generateContent',
      baseUrl: DEFAULT_BASE_URLS.gemini.default,
      category: 'ai',
      requiresAuth: false,
      timeout: 30000,
      tags: ['ai', 'analysis'],
    });

    // Health endpoints
    this.register({
      id: 'health.check',
      name: 'Health Check',
      method: 'GET',
      path: '/health',
      category: 'health',
      requiresAuth: false,
      cacheTTL: 0,
      tags: ['health', 'monitoring'],
    });
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      // Clean up old health records
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      const now = Date.now();
      
      for (const health of this.health.values()) {
        if (now - health.lastCheck > maxAge && health.totalRequests === 0) {
          health.averageResponseTime = 0;
          health.successRate = 1;
          health.healthy = true;
        }
      }
    }, 60 * 60 * 1000);
  }
}

// ============= Singleton Instance =============

let registryInstance: APIEndpointRegistry | null = null;

/**
 * Get the API endpoint registry instance
 */
export const getAPIEndpointRegistry = (): APIEndpointRegistry => {
  if (!registryInstance) {
    registryInstance = new APIEndpointRegistry();
  }
  return registryInstance;
};

/**
 * Initialize the API endpoint registry
 */
export const initializeAPIEndpointRegistry = (): APIEndpointRegistry => {
  if (registryInstance) {
    registryInstance.destroy();
  }
  registryInstance = new APIEndpointRegistry();
  return registryInstance;
};

/**
 * Check if endpoint registry is initialized
 */
export const hasAPIEndpointRegistry = (): boolean => {
  return registryInstance !== null;
};

// ============= Convenience Functions =============

/**
 * Resolve an endpoint to a full URL
 */
export const resolveEndpoint = (
  endpointId: string,
  params?: Record<string, string>,
  query?: Record<string, unknown>
): ResolvedEndpoint | null => getAPIEndpointRegistry().resolve(endpointId, params, query);

/**
 * Get an endpoint configuration
 */
export const getEndpoint = <TParams = Record<string, string>, TQuery = Record<string, unknown>, TBody = unknown, TResponse = unknown>(
  endpointId: string
): EndpointConfig<TParams, TQuery, TBody, TResponse> | null => 
  getAPIEndpointRegistry().get<TParams, TQuery, TBody, TResponse>(endpointId);

/**
 * Register a new endpoint
 */
export const registerEndpoint = <TParams = Record<string, string>, TQuery = Record<string, unknown>, TBody = unknown, TResponse = unknown>(
  config: EndpointConfig<TParams, TQuery, TBody, TResponse>
): (() => void) => getAPIEndpointRegistry().register(config);

// ============= React Hook =============

/**
 * React hook for using the API endpoint registry
 */
export const useAPIEndpointRegistry = () => {
  const registry = getAPIEndpointRegistry();
  
  return {
    // Registration
    register: <TParams = Record<string, string>, TQuery = Record<string, unknown>, TBody = unknown, TResponse = unknown>(
      config: EndpointConfig<TParams, TQuery, TBody, TResponse>
    ) => registry.register(config),
    
    registerAll: (configs: EndpointConfig[]) => registry.registerAll(configs),
    unregister: (endpointId: string) => registry.unregister(endpointId),
    registerBaseUrl: (name: string, config: BaseURLConfig) => registry.registerBaseUrl(name, config),
    
    // Resolution
    get: <TParams = Record<string, string>, TQuery = Record<string, unknown>, TBody = unknown, TResponse = unknown>(
      endpointId: string
    ) => registry.get<TParams, TQuery, TBody, TResponse>(endpointId),
    
    resolve: (endpointId: string, params?: Record<string, string>, query?: Record<string, unknown>) =>
      registry.resolve(endpointId, params, query),
    
    getByCategory: (category: EndpointCategory) => registry.getByCategory(category),
    getByTag: (tag: string) => registry.getByTag(tag),
    search: (query: string) => registry.search(query),
    
    // Health
    getHealth: (endpointId: string) => registry.getHealth(endpointId),
    recordRequest: (endpointId: string, success: boolean, responseTime: number, error?: string) =>
      registry.recordRequest(endpointId, success, responseTime, error),
    getUnhealthyEndpoints: () => registry.getUnhealthyEndpoints(),
    
    // Configuration
    setEnvironment: (env: string) => registry.setEnvironment(env),
    setDefaultHeaders: (headers: Record<string, string>) => registry.setDefaultHeaders(headers),
    updateEndpoint: (endpointId: string, updates: Partial<EndpointConfig>) =>
      registry.updateEndpoint(endpointId, updates),
    deprecate: (endpointId: string, message?: string) => registry.deprecate(endpointId, message),
    
    // Utilities
    has: (endpointId: string) => registry.has(endpointId),
    getEndpointIds: () => registry.getEndpointIds(),
    getStats: () => registry.getStats(),
    resetStats: () => registry.resetStats(),
    clear: () => registry.clear(),
  };
};
