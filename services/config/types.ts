/**
 * Configuration Type Definitions
 * Contains all configuration interfaces for the application
 */

export interface SecurityConfig {
  maxPayloadSize: number;
  allowedOrigins: string[];
  endpoint?: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  encryption: {
    algorithm: string;
    keyRotationInterval: number;
  };
  edgeRateLimiting: {
    enabled: boolean;
    requestsPerSecond: number;
    burstLimit: number;
  };
  regionBlocking: {
    enabled: boolean;
    blockedRegions: string[];
  };
  botDetection: {
    enabled: boolean;
    suspiciousPatterns: string[];
  };
  apiEndpoints: {
    binanceWebSocket: string;
    twelveDataWebSocket: string;
    openAI: string;
  };
  rateLimits: {
    aiRpm: number;
    defaultRpm: number;
    edgeRps: number;
    requestsPerWindow: number;
  };
  csrf: {
    tokenExpiryMs: number;
  };
}

export interface PerformanceConfig {
  timeouts: {
    aiWorker: {
      default: number;
      contextBuilding: number;
      responseProcessing: number;
      codeExtraction: number;
      messageFormatting: number;
      contentGeneration: number;
      responseParsing: number;
      healthCheck: number;
    };
    database: {
      query: number;
      connection: number;
    };
  };
  caching: {
    defaultTTL: number;
    analyticsTTL: number;
    metricsTTL: number;
  };
  thresholds: {
    maxMetrics: number;
    maxErrors: number;
    batchSize: number;
  };
}

export interface InfrastructureConfig {
  edgeRuntime: {
    enabled: boolean;
    regions: string[];
    cacheTTL: {
      static: number;
      api: {
        health: number;
        robots: number;
        strategies: number;
        analytics: number;
      };
    };
  };
  database: {
    replicas: {
      enabled: boolean;
      regions: string[];
      maxMetrics: number;
      failoverTimeout: number;
    };
    limits: {
      queryLimit: number;
      maxDelay: number;
    };
  };
}

export interface MonitoringConfig {
  realUserMonitoring: {
    enabled: boolean;
    sampleRate: number;
    thresholds: {
      LCP: number;
      FID: number;
      CLS: number;
      FCP: number;
      TTFB: number;
      INP: number;
    };
  };
  circuitBreaker: {
    database: {
      failureThreshold: number;
      timeout: number;
      resetTimeout: number;
    };
    ai: {
      failureThreshold: number;
      timeout: number;
      resetTimeout: number;
    };
    marketData: {
      failureThreshold: number;
      timeout: number;
      resetTimeout: number;
    };
  };
}

export interface FeatureFlags {
  edgeOptimization: boolean;
  compression: boolean;
  prefetch: boolean;
  preload: boolean;
  webVitals: boolean;
  advancedSecurity: boolean;
  multiRegion: boolean;
  aiOptimization: boolean;
}

export interface WebSocketConfig {
  binance: {
    websocketEndpoint: string;
    maxReconnectAttempts: number;
    baseReconnectDelay: number;
    maxReconnectDelay: number;
  };
  twelveData: {
    websocketEndpoint: string;
    maxReconnectAttempts: number;
    baseReconnectDelay: number;
    maxReconnectDelay: number;
  };
}

export interface DatabaseConfig {
  connection: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
    maxDelay: number;
  };
  cache: {
    ttl: number;
    maxSize: number;
  };
  query: {
    limit: number;
    batchSize: number;
  };
}

export interface AIConfig {
  models: {
    gemini: string;
    openai: string;
    analysis: string;
  };
  performance: {
    temperature: number;
    maxPromptLength: number;
    minPromptLength: number;
    maxContextChars: number;
    minHistoryChars: number;
    maxCodeLength: number;
  };
  cache: {
    maxSize: number;
    ttl: number;
    strategyCacheSize: number;
    strategyCacheTtl: number;
    enhancedCacheSize: number;
    mql5CacheSize: number;
    mql5ResponseTtl: number;
    contextCacheSize: number;
    contextCacheTtl: number;
  };
}
