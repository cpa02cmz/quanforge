/**
 * Centralized Configuration Service
 * Provides a single source of truth for all application configuration
 * with type safety, validation, and environment-specific values
 */

// TypeScript interfaces for configuration
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

// Configuration validation helpers
class ConfigValidator {
  static validateNumber(value: number, name: string, min?: number, max?: number): void {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${name} must be a valid number, got: ${value}`);
    }
    if (min !== undefined && value < min) {
      throw new Error(`${name} must be at least ${min}, got: ${value}`);
    }
    if (max !== undefined && value > max) {
      throw new Error(`${name} must be at most ${max}, got: ${value}`);
    }
  }

  static validateString(value: string, name: string, minLength?: number): void {
    if (typeof value !== 'string') {
      throw new Error(`${name} must be a string, got: ${typeof value}`);
    }
    if (minLength && value.length < minLength) {
      throw new Error(`${name} must be at least ${minLength} characters, got: ${value.length}`);
    }
  }

  static validateArray(value: unknown[], name: string, minLength?: number): void {
    if (!Array.isArray(value)) {
      throw new Error(`${name} must be an array, got: ${typeof value}`);
    }
    if (minLength && value.length < minLength) {
      throw new Error(`${name} must have at least ${minLength} items, got: ${value.length}`);
    }
  }

  static validateSecurityConfig(config: SecurityConfig): void {
    ConfigValidator.validateNumber(config.maxPayloadSize, 'maxPayloadSize', 1024, 100 * 1024 * 1024);
    ConfigValidator.validateArray(config.allowedOrigins, 'allowedOrigins');
    if (config.endpoint) {
      ConfigValidator.validateString(config.endpoint, 'endpoint', 1);
    }
    ConfigValidator.validateNumber(config.rateLimiting.windowMs, 'rateLimiting.windowMs', 1000);
    ConfigValidator.validateNumber(config.rateLimiting.maxRequests, 'rateLimiting.maxRequests', 1);
    ConfigValidator.validateString(config.encryption.algorithm, 'encryption.algorithm');
    ConfigValidator.validateNumber(config.encryption.keyRotationInterval, 'encryption.keyRotationInterval', 60000);
    ConfigValidator.validateBoolean(config.edgeRateLimiting.enabled, 'edgeRateLimiting.enabled');
    ConfigValidator.validateNumber(config.edgeRateLimiting.requestsPerSecond, 'edgeRateLimiting.requestsPerSecond', 1);
    ConfigValidator.validateNumber(config.edgeRateLimiting.burstLimit, 'edgeRateLimiting.burstLimit', 1);
    ConfigValidator.validateArray(config.regionBlocking.blockedRegions, 'regionBlocking.blockedRegions');
    ConfigValidator.validateArray(config.botDetection.suspiciousPatterns, 'botDetection.suspiciousPatterns');
    
    // Validate new security properties
    ConfigValidator.validateString(config.apiEndpoints.binanceWebSocket, 'apiEndpoints.binanceWebSocket', 1);
    ConfigValidator.validateString(config.apiEndpoints.twelveDataWebSocket, 'apiEndpoints.twelveDataWebSocket', 1);
    ConfigValidator.validateString(config.apiEndpoints.openAI, 'apiEndpoints.openAI', 1);
    ConfigValidator.validateNumber(config.rateLimits.aiRpm, 'rateLimits.aiRpm', 1);
    ConfigValidator.validateNumber(config.rateLimits.defaultRpm, 'rateLimits.defaultRpm', 1);
    ConfigValidator.validateNumber(config.rateLimits.edgeRps, 'rateLimits.edgeRps', 1);
    ConfigValidator.validateNumber(config.rateLimits.requestsPerWindow, 'rateLimits.requestsPerWindow', 1);
    ConfigValidator.validateNumber(config.csrf.tokenExpiryMs, 'csrf.tokenExpiryMs', 1000);
  }

  static validatePerformanceConfig(config: PerformanceConfig): void {
    // Validate timeouts
    ConfigValidator.validateNumber(config.timeouts.aiWorker.default, 'aiWorker.default', 1000);
    ConfigValidator.validateNumber(config.timeouts.aiWorker.contextBuilding, 'aiWorker.contextBuilding', 1000);
    ConfigValidator.validateNumber(config.timeouts.aiWorker.responseProcessing, 'aiWorker.responseProcessing', 1000);
    ConfigValidator.validateNumber(config.timeouts.aiWorker.codeExtraction, 'aiWorker.codeExtraction', 1000);
    ConfigValidator.validateNumber(config.timeouts.aiWorker.messageFormatting, 'aiWorker.messageFormatting', 1000);
    ConfigValidator.validateNumber(config.timeouts.aiWorker.contentGeneration, 'aiWorker.contentGeneration', 1000);
    ConfigValidator.validateNumber(config.timeouts.aiWorker.responseParsing, 'aiWorker.responseParsing', 1000);
    ConfigValidator.validateNumber(config.timeouts.aiWorker.healthCheck, 'aiWorker.healthCheck', 1000);
    ConfigValidator.validateNumber(config.timeouts.database.query, 'database.query', 5000);
    ConfigValidator.validateNumber(config.timeouts.database.connection, 'database.connection', 1000);

    // Validate caching
    ConfigValidator.validateNumber(config.caching.defaultTTL, 'caching.defaultTTL', 60000);
    ConfigValidator.validateNumber(config.caching.analyticsTTL, 'caching.analyticsTTL', 60000);
    ConfigValidator.validateNumber(config.caching.metricsTTL, 'caching.metricsTTL', 60000);

    // Validate thresholds
    ConfigValidator.validateNumber(config.thresholds.maxMetrics, 'thresholds.maxMetrics', 10);
    ConfigValidator.validateNumber(config.thresholds.maxErrors, 'thresholds.maxErrors', 10);
    ConfigValidator.validateNumber(config.thresholds.batchSize, 'thresholds.batchSize', 1);
  }

  static validateInfrastructureConfig(config: InfrastructureConfig): void {
    ConfigValidator.validateBoolean(config.edgeRuntime.enabled, 'edgeRuntime.enabled');
    ConfigValidator.validateArray(config.edgeRuntime.regions, 'edgeRuntime.regions');
    ConfigValidator.validateNumber(config.edgeRuntime.cacheTTL.static, 'cacheTTL.static', 86400);
    ConfigValidator.validateNumber(config.edgeRuntime.cacheTTL.api.health, 'cacheTTL.api.health', 30);
    ConfigValidator.validateNumber(config.edgeRuntime.cacheTTL.api.robots, 'cacheTTL.api.robots', 60);
    ConfigValidator.validateNumber(config.edgeRuntime.cacheTTL.api.strategies, 'cacheTTL.api.strategies', 60);
    ConfigValidator.validateNumber(config.edgeRuntime.cacheTTL.api.analytics, 'cacheTTL.api.analytics', 180);

    ConfigValidator.validateBoolean(config.database.replicas.enabled, 'database.replicas.enabled');
    ConfigValidator.validateArray(config.database.replicas.regions, 'database.replicas.regions');
    ConfigValidator.validateNumber(config.database.replicas.maxMetrics, 'database.replicas.maxMetrics', 100);
    ConfigValidator.validateNumber(config.database.replicas.failoverTimeout, 'database.replicas.failoverTimeout', 5000);
    ConfigValidator.validateNumber(config.database.limits.queryLimit, 'database.limits.queryLimit', 10);
    ConfigValidator.validateNumber(config.database.limits.maxDelay, 'database.limits.maxDelay', 1000);
  }

  static validateMonitoringConfig(config: MonitoringConfig): void {
    ConfigValidator.validateBoolean(config.realUserMonitoring.enabled, 'realUserMonitoring.enabled');
    ConfigValidator.validateNumber(config.realUserMonitoring.sampleRate, 'realUserMonitoring.sampleRate', 0, 1);
    ConfigValidator.validateNumber(config.realUserMonitoring.thresholds.LCP, 'RUM.thresholds.LCP', 1000);
    ConfigValidator.validateNumber(config.realUserMonitoring.thresholds.FID, 'RUM.thresholds.FID', 50);
    ConfigValidator.validateNumber(config.realUserMonitoring.thresholds.CLS, 'RUM.thresholds.CLS', 0.01, 1);
    ConfigValidator.validateNumber(config.realUserMonitoring.thresholds.FCP, 'RUM.thresholds.FCP', 1000);
    ConfigValidator.validateNumber(config.realUserMonitoring.thresholds.TTFB, 'RUM.thresholds.TTFB', 200);
    ConfigValidator.validateNumber(config.realUserMonitoring.thresholds.INP, 'RUM.thresholds.INP', 100);

    // Circuit breaker validation
    ConfigValidator.validateNumber(config.circuitBreaker.database.failureThreshold, 'CB.database.failureThreshold', 1);
    ConfigValidator.validateNumber(config.circuitBreaker.database.timeout, 'CB.database.timeout', 1000);
    ConfigValidator.validateNumber(config.circuitBreaker.database.resetTimeout, 'CB.database.resetTimeout', 10000);
    ConfigValidator.validateNumber(config.circuitBreaker.ai.failureThreshold, 'CB.ai.failureThreshold', 1);
    ConfigValidator.validateNumber(config.circuitBreaker.ai.timeout, 'CB.ai.timeout', 1000);
    ConfigValidator.validateNumber(config.circuitBreaker.ai.resetTimeout, 'CB.ai.resetTimeout', 10000);
    ConfigValidator.validateNumber(config.circuitBreaker.marketData.failureThreshold, 'CB.marketData.failureThreshold', 1);
    ConfigValidator.validateNumber(config.circuitBreaker.marketData.timeout, 'CB.marketData.timeout', 1000);
    ConfigValidator.validateNumber(config.circuitBreaker.marketData.resetTimeout, 'CB.marketData.resetTimeout', 10000);
  }

  static validateBoolean(value: boolean, name: string): void {
    if (typeof value !== 'boolean') {
      throw new Error(`${name} must be a boolean, got: ${typeof value}`);
    }
  }

  static validateWebSocketConfig(config: WebSocketConfig): void {
    ConfigValidator.validateString(config.binance.websocketEndpoint, 'websockets.binance.websocketEndpoint', 1);
    ConfigValidator.validateNumber(config.binance.maxReconnectAttempts, 'websockets.binance.maxReconnectAttempts', 1);
    ConfigValidator.validateNumber(config.binance.baseReconnectDelay, 'websockets.binance.baseReconnectDelay', 100);
    ConfigValidator.validateNumber(config.binance.maxReconnectDelay, 'websockets.binance.maxReconnectDelay', 1000);
    ConfigValidator.validateString(config.twelveData.websocketEndpoint, 'websockets.twelveData.websocketEndpoint', 1);
    ConfigValidator.validateNumber(config.twelveData.maxReconnectAttempts, 'websockets.twelveData.maxReconnectAttempts', 1);
    ConfigValidator.validateNumber(config.twelveData.baseReconnectDelay, 'websockets.twelveData.baseReconnectDelay', 100);
    ConfigValidator.validateNumber(config.twelveData.maxReconnectDelay, 'websockets.twelveData.maxReconnectDelay', 1000);
  }

  static validateDatabaseConfig(config: DatabaseConfig): void {
    ConfigValidator.validateNumber(config.connection.maxRetries, 'database.connection.maxRetries', 1);
    ConfigValidator.validateNumber(config.connection.retryDelay, 'database.connection.retryDelay', 100);
    ConfigValidator.validateNumber(config.connection.backoffMultiplier, 'database.connection.backoffMultiplier', 1);
    ConfigValidator.validateNumber(config.connection.maxDelay, 'database.connection.maxDelay', 1000);
    ConfigValidator.validateNumber(config.cache.ttl, 'database.cache.ttl', 60000);
    ConfigValidator.validateNumber(config.cache.maxSize, 'database.cache.maxSize', 10);
    ConfigValidator.validateNumber(config.query.limit, 'database.query.limit', 10);
    ConfigValidator.validateNumber(config.query.batchSize, 'database.query.batchSize', 1);
  }

  static validateAIConfig(config: AIConfig): void {
    ConfigValidator.validateString(config.models.gemini, 'ai.models.gemini', 1);
    ConfigValidator.validateString(config.models.openai, 'ai.models.openai', 1);
    ConfigValidator.validateString(config.models.analysis, 'ai.models.analysis', 1);
    
    ConfigValidator.validateNumber(config.performance.temperature, 'ai.performance.temperature', 0, 2);
    ConfigValidator.validateNumber(config.performance.maxPromptLength, 'ai.performance.maxPromptLength', 10);
    ConfigValidator.validateNumber(config.performance.minPromptLength, 'ai.performance.minPromptLength', 1);
    ConfigValidator.validateNumber(config.performance.maxContextChars, 'ai.performance.maxContextChars', 100);
    ConfigValidator.validateNumber(config.performance.minHistoryChars, 'ai.performance.minHistoryChars', 10);
    ConfigValidator.validateNumber(config.performance.maxCodeLength, 'ai.performance.maxCodeLength', 100);

    ConfigValidator.validateNumber(config.cache.maxSize, 'ai.cache.maxSize', 1);
    ConfigValidator.validateNumber(config.cache.ttl, 'ai.cache.ttl', 60000);
    ConfigValidator.validateNumber(config.cache.strategyCacheSize, 'ai.cache.strategyCacheSize', 1);
    ConfigValidator.validateNumber(config.cache.strategyCacheTtl, 'ai.cache.strategyCacheTtl', 60000);
    ConfigValidator.validateNumber(config.cache.enhancedCacheSize, 'ai.cache.enhancedCacheSize', 1);
    ConfigValidator.validateNumber(config.cache.mql5CacheSize, 'ai.cache.mql5CacheSize', 1);
    ConfigValidator.validateNumber(config.cache.mql5ResponseTtl, 'ai.cache.mql5ResponseTtl', 60000);
    ConfigValidator.validateNumber(config.cache.contextCacheSize, 'ai.cache.contextCacheSize', 1);
    ConfigValidator.validateNumber(config.cache.contextCacheTtl, 'ai.cache.contextCacheTtl', 60000);
  }
}

// Environment-aware configuration service
class ConfigurationService {
  private static instance: ConfigurationService;
  private config: {
    security: SecurityConfig;
    performance: PerformanceConfig;
    infrastructure: InfrastructureConfig;
    monitoring: MonitoringConfig;
    features: FeatureFlags;
    websockets: WebSocketConfig;
    database: DatabaseConfig;
    ai: AIConfig;
  };

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  private getEnvironment(): string {
    return process.env['NODE_ENV'] || 'development';
  }

  private loadConfiguration() {
    // Security configuration
    const securityConfig: SecurityConfig = {
      maxPayloadSize: this.getEnvNumber('MAX_PAYLOAD_SIZE', 5 * 1024 * 1024),
      allowedOrigins: this.getEnvArray('ALLOWED_ORIGINS', [
        'https://quanforge.ai',
        'https://www.quanforge.ai',
        'http://localhost:3000',
        'http://localhost:5173'
      ]),
      endpoint: this.getEnvString('SECURITY_ENDPOINT', ''),
      rateLimiting: {
        windowMs: this.getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
        maxRequests: this.getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
      },
      encryption: {
        algorithm: this.getEnvString('ENCRYPTION_ALGORITHM', 'AES-256-GCM'),
        keyRotationInterval: this.getEnvNumber('KEY_ROTATION_INTERVAL', 43200000),
      },
      edgeRateLimiting: {
        enabled: this.getEnvBoolean('EDGE_RATE_LIMIT_ENABLED', true),
        requestsPerSecond: this.getEnvNumber('EDGE_RATE_LIMIT_RPS', 10),
        burstLimit: this.getEnvNumber('EDGE_RATE_LIMIT_BURST', 20),
      },
      regionBlocking: {
        enabled: this.getEnvBoolean('REGION_BLOCKING_ENABLED', true),
        blockedRegions: this.getEnvArray('BLOCKED_REGIONS', ['CN', 'RU', 'IR', 'KP']),
      },
      botDetection: {
        enabled: this.getEnvBoolean('BOT_DETECTION_ENABLED', true),
        suspiciousPatterns: this.getEnvArray('BOT_PATTERNS', [
          'sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster',
          'wfuzz', 'burp', 'owasp', 'scanner', 'bot', 'crawler', 'spider'
        ]),
      },
      apiEndpoints: {
        binanceWebSocket: this.getEnvString('BINANCE_WS_URL', 'wss://stream.binance.com:9443/ws'),
        twelveDataWebSocket: this.getEnvString('TWELVE_DATA_WS_URL', 'wss://ws.twelvedata.com/v1/quotes'),
        openAI: this.getEnvString('OPENAI_API_BASE_URL', 'https://api.openai.com/v1'),
      },
      rateLimits: {
        aiRpm: this.getEnvNumber('AI_RATE_LIMIT_RPM', 10),
        defaultRpm: this.getEnvNumber('DEFAULT_RATE_LIMIT_RPM', 30),
        edgeRps: this.getEnvNumber('EDGE_RATE_LIMIT_RPS', 10),
        requestsPerWindow: this.getEnvNumber('RATE_LIMIT_REQUESTS', 100),
      },
      csrf: {
        tokenExpiryMs: this.getEnvNumber('CSRF_TOKEN_EXPIRY', 3600000),
      },
    };

    // Performance configuration
    const performanceConfig: PerformanceConfig = {
      timeouts: {
        aiWorker: {
          default: this.getEnvNumber('AI_TIMEOUT_DEFAULT', 30000),
          contextBuilding: this.getEnvNumber('AI_TIMEOUT_CONTEXT', 10000),
          responseProcessing: this.getEnvNumber('AI_TIMEOUT_RESPONSE', 5000),
          codeExtraction: this.getEnvNumber('AI_TIMEOUT_EXTRACTION', 3000),
          messageFormatting: this.getEnvNumber('AI_TIMEOUT_FORMATTING', 3000),
          contentGeneration: this.getEnvNumber('AI_TIMEOUT_GENERATION', 60000),
          responseParsing: this.getEnvNumber('AI_TIMEOUT_PARSING', 5000),
          healthCheck: this.getEnvNumber('AI_TIMEOUT_HEALTH', 2000),
        },
        database: {
          query: this.getEnvNumber('DB_TIMEOUT_QUERY', 30000),
          connection: this.getEnvNumber('DB_TIMEOUT_CONNECTION', 10000),
        },
      },
      caching: {
        defaultTTL: this.getEnvNumber('CACHE_DEFAULT_TTL', 300000),
        analyticsTTL: this.getEnvNumber('CACHE_ANALYTICS_TTL', 60000),
        metricsTTL: this.getEnvNumber('CACHE_METRICS_TTL', 600000),
      },
      thresholds: {
        maxMetrics: this.getEnvNumber('MONITORING_MAX_METRICS', 100),
        maxErrors: this.getEnvNumber('MONITORING_MAX_ERRORS', 50),
        batchSize: this.getEnvNumber('MONITORING_BATCH_SIZE', 10),
      },
    };

    // Infrastructure configuration
    const infrastructureConfig: InfrastructureConfig = {
      edgeRuntime: {
        enabled: this.getEnvBoolean('EDGE_RUNTIME_ENABLED', true),
        regions: this.getEnvArray('EDGE_REGIONS', ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1']),
        cacheTTL: {
          static: this.getEnvNumber('EDGE_CACHE_STATIC_TTL', 31536000),
          api: {
            health: this.getEnvNumber('EDGE_CACHE_HEALTH_TTL', 30),
            robots: this.getEnvNumber('EDGE_CACHE_ROBOTS_TTL', 300),
            strategies: this.getEnvNumber('EDGE_CACHE_STRATEGIES_TTL', 300),
            analytics: this.getEnvNumber('EDGE_CACHE_ANALYTICS_TTL', 180),
          },
        },
      },
      database: {
        replicas: {
          enabled: this.getEnvBoolean('DB_REPLICAS_ENABLED', true),
          regions: this.getEnvArray('DB_REPLICA_REGIONS', ['us-east-1', 'eu-west-1', 'ap-southeast-1']),
          maxMetrics: this.getEnvNumber('DB_REPLICA_MAX_METRICS', 1000),
          failoverTimeout: this.getEnvNumber('DB_FAILOVER_TIMEOUT', 5000),
        },
        limits: {
          queryLimit: this.getEnvNumber('DB_QUERY_LIMIT', 100),
          maxDelay: this.getEnvNumber('DB_MAX_DELAY', 10000),
        },
      },
    };

    // Monitoring configuration
    const monitoringConfig: MonitoringConfig = {
      realUserMonitoring: {
        enabled: this.getEnvBoolean('RUM_ENABLED', true),
        sampleRate: this.getEnvNumber('RUM_SAMPLE_RATE', 0.1),
        thresholds: {
          LCP: this.getEnvNumber('RUM_THRESHOLD_LCP', 2500),
          FID: this.getEnvNumber('RUM_THRESHOLD_FID', 100),
          CLS: this.getEnvNumber('RUM_THRESHOLD_CLS', 0.1),
          FCP: this.getEnvNumber('RUM_THRESHOLD_FCP', 1800),
          TTFB: this.getEnvNumber('RUM_THRESHOLD_TTFB', 800),
          INP: this.getEnvNumber('RUM_THRESHOLD_INP', 200),
        },
      },
      circuitBreaker: {
        database: {
          failureThreshold: this.getEnvNumber('CB_DB_FAILURE_THRESHOLD', 5),
          timeout: this.getEnvNumber('CB_DB_TIMEOUT', 10000),
          resetTimeout: this.getEnvNumber('CB_DB_RESET_TIMEOUT', 60000),
        },
        ai: {
          failureThreshold: this.getEnvNumber('CB_AI_FAILURE_THRESHOLD', 3),
          timeout: this.getEnvNumber('CB_AI_TIMEOUT', 15000),
          resetTimeout: this.getEnvNumber('CB_AI_RESET_TIMEOUT', 30000),
        },
        marketData: {
          failureThreshold: this.getEnvNumber('CB_MD_FAILURE_THRESHOLD', 7),
          timeout: this.getEnvNumber('CB_MD_TIMEOUT', 5000),
          resetTimeout: this.getEnvNumber('CB_MD_RESET_TIMEOUT', 120000),
        },
      },
    };

    // Feature flags
    const featureFlags: FeatureFlags = {
      edgeOptimization: this.getEnvBoolean('FEATURE_EDGE_OPTIMIZATION', true),
      compression: this.getEnvBoolean('FEATURE_COMPRESSION', true),
      prefetch: this.getEnvBoolean('FEATURE_PREFETCH', true),
      preload: this.getEnvBoolean('FEATURE_PRELOAD', true),
      webVitals: this.getEnvBoolean('FEATURE_WEB_VITALS', true),
      advancedSecurity: this.getEnvBoolean('FEATURE_ADVANCED_SECURITY', true),
      multiRegion: this.getEnvBoolean('FEATURE_MULTI_REGION', true),
      aiOptimization: this.getEnvBoolean('FEATURE_AI_OPTIMIZATION', true),
    };

    // WebSocket configuration
    const websocketsConfig: WebSocketConfig = {
      binance: {
        websocketEndpoint: this.getEnvString('BINANCE_WS_URL', 'wss://stream.binance.com:9443/ws'),
        maxReconnectAttempts: this.getEnvNumber('WS_BINANCE_MAX_RECONNECT_ATTEMPTS', 10),
        baseReconnectDelay: this.getEnvNumber('WS_BINANCE_BASE_RECONNECT_DELAY', 1000),
        maxReconnectDelay: this.getEnvNumber('WS_BINANCE_MAX_RECONNECT_DELAY', 30000),
      },
      twelveData: {
        websocketEndpoint: this.getEnvString('TWELVE_DATA_WS_URL', 'wss://ws.twelvedata.com/v1/quotes'),
        maxReconnectAttempts: this.getEnvNumber('WS_TWELVE_MAX_RECONNECT_ATTEMPTS', 10),
        baseReconnectDelay: this.getEnvNumber('WS_TWELVE_BASE_RECONNECT_DELAY', 1000),
        maxReconnectDelay: this.getEnvNumber('WS_TWELVE_MAX_RECONNECT_DELAY', 30000),
      },
    };

    // Database configuration
    const databaseConfig: DatabaseConfig = {
      connection: {
        maxRetries: this.getEnvNumber('DB_MAX_RETRIES', 5),
        retryDelay: this.getEnvNumber('DB_RETRY_DELAY', 500),
        backoffMultiplier: this.getEnvNumber('DB_BACKOFF_MULTIPLIER', 1.5),
        maxDelay: this.getEnvNumber('DB_MAX_DELAY', 10000),
      },
      cache: {
        ttl: this.getEnvNumber('DB_CACHE_TTL', 900000),
        maxSize: this.getEnvNumber('DB_CACHE_MAX_SIZE', 200),
      },
      query: {
        limit: this.getEnvNumber('DB_QUERY_LIMIT', 100),
        batchSize: this.getEnvNumber('DB_BATCH_SIZE', 10),
      },
    };

    // AI configuration
    const aiConfig: AIConfig = {
      models: {
        gemini: this.getEnvString('DEFAULT_GEMINI_MODEL', 'gemini-3-pro-preview'),
        openai: this.getEnvString('DEFAULT_OPENAI_MODEL', 'gpt-4'),
        analysis: this.getEnvString('DEFAULT_ANALYSIS_MODEL', 'gemini-2.5-flash'),
      },
      performance: {
        temperature: this.getEnvNumber('DEFAULT_AI_TEMPERATURE', 0.7),
        maxPromptLength: this.getEnvNumber('MAX_PROMPT_LENGTH', 10000),
        minPromptLength: this.getEnvNumber('MIN_PROMPT_LENGTH', 10),
        maxContextChars: this.getEnvNumber('AI_MAX_CONTEXT_CHARS', 100000),
        minHistoryChars: this.getEnvNumber('AI_MIN_HISTORY_CHARS', 1000),
        maxCodeLength: this.getEnvNumber('AI_MAX_CODE_LENGTH', 30000),
      },
      cache: {
        maxSize: this.getEnvNumber('AI_CACHE_MAX_SIZE', 100),
        ttl: this.getEnvNumber('AI_CACHE_TTL', 300000),
        strategyCacheSize: this.getEnvNumber('STRATEGY_CACHE_SIZE', 100),
        strategyCacheTtl: this.getEnvNumber('STRATEGY_CACHE_TTL', 300000),
        enhancedCacheSize: this.getEnvNumber('ENHANCED_CACHE_SIZE', 200),
        mql5CacheSize: this.getEnvNumber('MQL5_CACHE_SIZE', 300),
        mql5ResponseTtl: this.getEnvNumber('MQL5_RESPONSE_TTL', 900000),
        contextCacheSize: this.getEnvNumber('AI_CONTEXT_CACHE_SIZE', 20),
        contextCacheTtl: this.getEnvNumber('AI_CONTEXT_CACHE_TTL', 300000),
      },
    };

    return {
      security: securityConfig,
      performance: performanceConfig,
      infrastructure: infrastructureConfig,
      monitoring: monitoringConfig,
      features: featureFlags,
      websockets: websocketsConfig,
      database: databaseConfig,
      ai: aiConfig,
    };
  }

  private validateConfiguration(): void {
    try {
      ConfigValidator.validateSecurityConfig(this.config.security);
      ConfigValidator.validatePerformanceConfig(this.config.performance);
      ConfigValidator.validateInfrastructureConfig(this.config.infrastructure);
      ConfigValidator.validateMonitoringConfig(this.config.monitoring);
      ConfigValidator.validateWebSocketConfig(this.config.websockets);
      ConfigValidator.validateDatabaseConfig(this.config.database);
      ConfigValidator.validateAIConfig(this.config.ai);
    } catch (error) {
      // In production, use proper logging. For now, rethrow with context
      throw new Error(`Invalid configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Environment variable helpers with type safety
  private getEnvString(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  private getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      // Development logging would go here in non-production
      return defaultValue;
    }
    return parsed;
  }

  private getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    
    return value.toLowerCase() === 'true';
  }

  private getEnvArray(key: string, defaultValue: string[]): string[] {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }

  // Public getters
  public get security(): SecurityConfig {
    return this.config.security;
  }

  public get performance(): PerformanceConfig {
    return this.config.performance;
  }

  public get infrastructure(): InfrastructureConfig {
    return this.config.infrastructure;
  }

  public get monitoring(): MonitoringConfig {
    return this.config.monitoring;
  }

  public get features(): FeatureFlags {
    return this.config.features;
  }

  public get websockets(): WebSocketConfig {
    return this.config.websockets;
  }

  public get database(): DatabaseConfig {
    return this.config.database;
  }

  public get ai(): AIConfig {
    return this.config.ai;
  }

  // Dynamic configuration updates (for runtime changes)
  public updateSecurityConfig(updates: Partial<SecurityConfig>): void {
    this.config.security = { ...this.config.security, ...updates };
    ConfigValidator.validateSecurityConfig(this.config.security);
  }

  public updatePerformanceConfig(updates: Partial<PerformanceConfig>): void {
    this.config.performance = { ...this.config.performance, ...updates };
    ConfigValidator.validatePerformanceConfig(this.config.performance);
  }

  // Environment-specific methods
  public isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  public isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  public isTest(): boolean {
    return this.getEnvironment() === 'test';
  }

  // Configuration validation and health check
  public validateConfigurationHealth(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      ConfigValidator.validateSecurityConfig(this.config.security);
    } catch (error) {
      errors.push(`Security config: ${error}`);
    }
    
    try {
      ConfigValidator.validatePerformanceConfig(this.config.performance);
    } catch (error) {
      errors.push(`Performance config: ${error}`);
    }
    
    try {
      ConfigValidator.validateInfrastructureConfig(this.config.infrastructure);
    } catch (error) {
      errors.push(`Infrastructure config: ${error}`);
    }
    
    try {
      ConfigValidator.validateMonitoringConfig(this.config.monitoring);
    } catch (error) {
      errors.push(`Monitoring config: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Export configuration for debugging
  public exportConfiguration(): string {
    return JSON.stringify({
      environment: this.getEnvironment(),
      config: this.config,
      timestamp: new Date().toISOString(),
    }, null, 2);
  }
}

// Export singleton instance
export const config = ConfigurationService.getInstance();

// Export convenience getters
export const securityConfig = () => config.security;
export const performanceConfig = () => config.performance;
export const infrastructureConfig = () => config.infrastructure;
export const monitoringConfig = () => config.monitoring;
export const featureFlags = () => config.features;
export const websocketsConfig = () => config.websockets;
export const databaseConfig = () => config.database;
export const aiConfig = () => config.ai;