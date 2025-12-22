/**
 * Centralized Configuration Management System
 * Replaces hardcoded values with environment-driven configuration
 * Provides type safety, validation, and runtime configuration management
 */

// ==================== Configuration Schema ====================

export interface CacheConfig {
  // Semantic Cache Configuration
  semantic: {
    maxCacheSize: number;
    maxMemoryUsage: number; // MB
    defaultTTL: number; // milliseconds
    cleanupInterval: number; // milliseconds
    enableCompression: boolean;
    enableMetrics: boolean;
    semanticThreshold: number; // 0-1 similarity threshold
  };
  
  // Unified Cache Configuration
  unified: {
    compressionThreshold: number; // bytes
    maxSize: number; // bytes
    defaultTTL: number; // milliseconds
    cleanupInterval: number; // milliseconds
  };
  
  // API Cache Configuration
  api: {
    robots: number; // TTL in milliseconds
    strategies: number; // TTL in milliseconds
    analytics: number; // TTL in milliseconds
    health: number; // TTL in milliseconds
  };
}

export interface DatabaseConfig {
  retry: {
    maxRetries: number;
    retryDelay: number; // milliseconds
    backoffMultiplier: number;
    maxDelay: number; // milliseconds
    jitter: boolean;
  };
  
  cache: {
    ttl: number; // milliseconds
    maxSize: number; // items
  };
  
  query: {
    timeout: number; // milliseconds
    batchSize: number;
    defaultLimit: number;
    paginationLimit: number;
  };
  
  pool: {
    acquireTimeout: number; // milliseconds
    maxConnections: number;
    minConnections: number;
  };
}

export interface EdgeConfig {
  enableEdgeRuntime: boolean;
  enableEdgeCaching: boolean;
  enableCompression: boolean;
  enablePrefetch: boolean;
  enablePreload: boolean;
  
  // Cache TTLs for different resource types
  staticAssetsCacheTTL: number; // milliseconds
  apiCacheTTL: number; // milliseconds
  
  // Performance thresholds
  slowQueryThreshold: number; // milliseconds
  largeResponseThreshold: number; // bytes
  
  // Edge regions
  regions: string[];
  
  // Update intervals
  periodicSyncInterval: number; // milliseconds
  metricsUpdateInterval: number; // milliseconds
}

export interface SimulationConfig {
  // Risk and profitability boundaries
  riskScore: {
    min: number;
    max: number;
    default: number;
  };
  
  profitability: {
    min: number;
    max: number;
    default: number;
  };
  
  // Simulation limits
  maxDays: number; // Maximum simulation days
  dailyDrift: {
    neutral: number; // Neutral drift value
    multiplier: number; // Profitability impact multiplier
  };
  
  volatility: {
    base: number; // Base volatility
    riskMultiplier: number; // Risk impact multiplier
  };
  
  // Performance configuration
  performanceThresholds: {
    slowQuery: number; // milliseconds
    largeDataset: number; // records
  };
}

export interface PerformanceConfig {
  // Memory management
  memory: {
    maxHeapSize: number; // MB
    gcThreshold: number; // percentage
    monitoringInterval: number; // milliseconds
  };
  
  // Request optimization
  requests: {
    timeout: number; // milliseconds
    retryLimit: number;
    batchSize: number;
    concurrency: number;
  };
  
  // Bundle optimization
  bundle: {
    chunkSizeWarning: number; // KB
    compressionThreshold: number; // KB
    maxConcurrency: number;
  };
}

export interface SecurityConfig {
  // Rate limiting
  rateLimit: {
    windowMs: number; // milliseconds
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  
  // Validation limits
  validation: {
    maxInputLength: number;
    maxFileSize: number; // MB
    allowedMimeTypes: string[];
  };
  
  // Token management
  tokens: {
    maxTokens: number;
    tokenBudget: number;
    refreshThreshold: number; // percentage
  };
}

// ==================== Main Configuration Schema ====================

export interface AppConfig {
  cache: CacheConfig;
  database: DatabaseConfig;
  edge: EdgeConfig;
  simulation: SimulationConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
  
  // Environment metadata
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
  version: string;
}

// ==================== Default Configuration ====================

export const DEFAULT_CONFIG: AppConfig = {
  cache: {
    semantic: {
      maxCacheSize: 1000,
      maxMemoryUsage: 100, // MB
      defaultTTL: 300000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      enableCompression: true,
      enableMetrics: true,
      semanticThreshold: 0.8,
    },
    unified: {
      compressionThreshold: 1024, // 1KB
      maxSize: 10 * 1024 * 1024, // 10MB
      defaultTTL: 300000, // 5 minutes
      cleanupInterval: 300000, // 5 minutes
    },
    api: {
      robots: 300000, // 5 minutes
      strategies: 600000, // 10 minutes
      analytics: 180000, // 3 minutes
      health: 30000, // 30 seconds
    },
  },
  
  database: {
    retry: {
      maxRetries: 5,
      retryDelay: 500, // milliseconds
      backoffMultiplier: 1.5,
      maxDelay: 10000, // 10 seconds
      jitter: true,
    },
    cache: {
      ttl: 15 * 60 * 1000, // 15 minutes
      maxSize: 200, // items
    },
    query: {
      timeout: 5000, // 5 seconds
      batchSize: 50,
      defaultLimit: 100,
      paginationLimit: 20,
    },
    pool: {
      acquireTimeout: 1000, // 1 second
      maxConnections: 10,
      minConnections: 2,
    },
  },
  
  edge: {
    enableEdgeRuntime: false,
    enableEdgeCaching: true,
    enableCompression: true,
    enablePrefetch: true,
    enablePreload: true,
    staticAssetsCacheTTL: 31536000, // 1 year
    apiCacheTTL: 300000, // 5 minutes
    slowQueryThreshold: 500, // milliseconds
    largeResponseThreshold: 1024 * 100, // 100KB
    regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
    periodicSyncInterval: 24 * 60 * 60 * 1000, // 24 hours
    metricsUpdateInterval: 30000, // 30 seconds
  },
  
  simulation: {
    riskScore: {
      min: 1,
      max: 10,
      default: 5,
    },
    profitability: {
      min: 1,
      max: 10,
      default: 5,
    },
    maxDays: 3650, // 10 years
    dailyDrift: {
      neutral: 4,
      multiplier: 0.0005,
    },
    volatility: {
      base: 0.002,
      riskMultiplier: 0.003,
    },
    performanceThresholds: {
      slowQuery: 1000, // milliseconds
      largeDataset: 1000, // records
    },
  },
  
  performance: {
    memory: {
      maxHeapSize: 4096, // MB
      gcThreshold: 80, // percentage
      monitoringInterval: 5000, // 5 seconds
    },
    requests: {
      timeout: 10000, // 10 seconds
      retryLimit: 3,
      batchSize: 10,
      concurrency: 5,
    },
    bundle: {
      chunkSizeWarning: 100, // KB
      compressionThreshold: 1, // KB
      maxConcurrency: 4,
    },
  },
  
  security: {
    rateLimit: {
      windowMs: 900000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    },
    validation: {
      maxInputLength: 10000,
      maxFileSize: 10, // MB
      allowedMimeTypes: ['application/json', 'text/plain', 'text/csv'],
    },
    tokens: {
      maxTokens: 100000,
      tokenBudget: 50000,
      refreshThreshold: 20, // percentage
    },
  },
  
  environment: 'development',
  debug: true,
  version: '1.0.0',
};

// ==================== Environment Variable Mapping ====================

export interface EnvironmentMapping {
  [key: string]: {
    envVar: string;
    type: 'number' | 'boolean' | 'string';
    path: string;
    required?: boolean;
  };
}

export const ENV_MAPPING: EnvironmentMapping = {
  // Cache Configuration
  'CACHE_SEMANTIC_MAX_SIZE': {
    envVar: 'VITE_CACHE_SEMANTIC_MAX_SIZE',
    type: 'number',
    path: 'cache.semantic.maxCacheSize',
  },
  'CACHE_SEMANTIC_MEMORY_MB': {
    envVar: 'VITE_CACHE_SEMANTIC_MEMORY_MB',
    type: 'number',
    path: 'cache.semantic.maxMemoryUsage',
  },
  'CACHE_SEMANTIC_TTL': {
    envVar: 'VITE_CACHE_SEMANTIC_TTL',
    type: 'number',
    path: 'cache.semantic.defaultTTL',
  },
  'CACHE_UNIFIED_MAX_SIZE': {
    envVar: 'VITE_CACHE_UNIFIED_MAX_SIZE',
    type: 'number',
    path: 'cache.unified.maxSize',
  },
  'CACHE_UNIFIED_TTL': {
    envVar: 'VITE_CACHE_UNIFIED_TTL',
    type: 'number',
    path: 'cache.unified.defaultTTL',
  },
  
  // Database Configuration
  'DB_RETRY_MAX': {
    envVar: 'VITE_DB_RETRY_MAX',
    type: 'number',
    path: 'database.retry.maxRetries',
  },
  'DB_RETRY_DELAY': {
    envVar: 'VITE_DB_RETRY_DELAY',
    type: 'number',
    path: 'database.retry.retryDelay',
  },
  'DB_QUERY_TIMEOUT': {
    envVar: 'VITE_DB_QUERY_TIMEOUT',
    type: 'number',
    path: 'database.query.timeout',
  },
  'DB_BATCH_SIZE': {
    envVar: 'VITE_DB_BATCH_SIZE',
    type: 'number',
    path: 'database.query.batchSize',
  },
  
  // Edge Configuration
  'EDGE_RUNTIME': {
    envVar: 'VITE_EDGE_RUNTIME',
    type: 'boolean',
    path: 'edge.enableEdgeRuntime',
  },
  'EDGE_CACHING': {
    envVar: 'VITE_EDGE_CACHING',
    type: 'boolean',
    path: 'edge.enableEdgeCaching',
  },
  'EDGE_COMPRESSION': {
    envVar: 'VITE_ENABLE_COMPRESSION',
    type: 'boolean',
    path: 'edge.enableCompression',
  },
  'EDGE_PREFETCH': {
    envVar: 'VITE_ENABLE_PREFETCH',
    type: 'boolean',
    path: 'edge.enablePrefetch',
  },
  'EDGE_PRELOAD': {
    envVar: 'VITE_ENABLE_PRELOAD',
    type: 'boolean',
    path: 'edge.enablePreload',
  },
  
  // Performance Configuration
  'PERF_MEMORY_LIMIT': {
    envVar: 'VITE_PERF_MEMORY_LIMIT',
    type: 'number',
    path: 'performance.memory.maxHeapSize',
  },
  'PERF_REQUEST_TIMEOUT': {
    envVar: 'VITE_PERF_REQUEST_TIMEOUT',
    type: 'number',
    path: 'performance.requests.timeout',
  },
  'PERF_BUNDLE_CHUNK_WARNING': {
    envVar: 'VITE_PERF_BUNDLE_CHUNK_WARNING',
    type: 'number',
    path: 'performance.bundle.chunkSizeWarning',
  },
  
  // Security Configuration
  'SEC_RATE_LIMIT_MAX': {
    envVar: 'VITE_SEC_RATE_LIMIT_MAX',
    type: 'number',
    path: 'security.rateLimit.maxRequests',
  },
  'SEC_RATE_LIMIT_WINDOW': {
    envVar: 'VITE_SEC_RATE_LIMIT_WINDOW',
    type: 'number',
    path: 'security.rateLimit.windowMs',
  },
  'SEC_MAX_FILE_SIZE': {
    envVar: 'VITE_SEC_MAX_FILE_SIZE',
    type: 'number',
    path: 'security.validation.maxFileSize',
  },
  
  // Environment
  'NODE_ENV': {
    envVar: 'NODE_ENV',
    type: 'string',
    path: 'environment',
  },
  'DEBUG': {
    envVar: 'VITE_DEBUG',
    type: 'boolean',
    path: 'debug',
  },
};