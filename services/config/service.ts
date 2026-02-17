/**
 * Configuration Service
 * Provides environment-aware configuration with type safety and validation
 */

import { getUrlConfig } from '../../utils/urls';
import type {
  SecurityConfig,
  PerformanceConfig,
  InfrastructureConfig,
  MonitoringConfig,
  FeatureFlags,
  WebSocketConfig,
  DatabaseConfig,
  AIConfig,
} from './types';
import { ConfigValidator } from './validator';
import { SECURITY_REGIONS, SECURITY_PATTERNS } from '../modularConstants';

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
    const securityConfig: SecurityConfig = {
      maxPayloadSize: this.getEnvNumber('MAX_PAYLOAD_SIZE', 5 * 1024 * 1024),
      allowedOrigins: this.getEnvArray('ALLOWED_ORIGINS', (() => {
        const urlConfig = getUrlConfig();
        return urlConfig.getAllowedOrigins();
      })()),
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
        blockedRegions: this.getEnvArray('BLOCKED_REGIONS', [...SECURITY_REGIONS.BLOCKED]),
      },
      botDetection: {
        enabled: this.getEnvBoolean('BOT_DETECTION_ENABLED', true),
        suspiciousPatterns: this.getEnvArray('BOT_PATTERNS', [...SECURITY_PATTERNS.BOT_PATTERNS]),
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
    } catch (error: unknown) {
      throw new Error(`Invalid configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getEnvString(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  private getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
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

  public updateSecurityConfig(updates: Partial<SecurityConfig>): void {
    this.config.security = { ...this.config.security, ...updates };
    ConfigValidator.validateSecurityConfig(this.config.security);
  }

  public updatePerformanceConfig(updates: Partial<PerformanceConfig>): void {
    this.config.performance = { ...this.config.performance, ...updates };
    ConfigValidator.validatePerformanceConfig(this.config.performance);
  }

  public isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  public isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  public isTest(): boolean {
    return this.getEnvironment() === 'test';
  }

  public validateConfigurationHealth(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      ConfigValidator.validateSecurityConfig(this.config.security);
    } catch (error: unknown) {
      errors.push(`Security config: ${error}`);
    }
    
    try {
      ConfigValidator.validatePerformanceConfig(this.config.performance);
    } catch (error: unknown) {
      errors.push(`Performance config: ${error}`);
    }
    
    try {
      ConfigValidator.validateInfrastructureConfig(this.config.infrastructure);
    } catch (error: unknown) {
      errors.push(`Infrastructure config: ${error}`);
    }
    
    try {
      ConfigValidator.validateMonitoringConfig(this.config.monitoring);
    } catch (error: unknown) {
      errors.push(`Monitoring config: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  public exportConfiguration(): string {
    return JSON.stringify({
      environment: this.getEnvironment(),
      config: this.config,
      timestamp: new Date().toISOString(),
    }, null, 2);
  }
}

export const config = ConfigurationService.getInstance();
export { ConfigurationService };
