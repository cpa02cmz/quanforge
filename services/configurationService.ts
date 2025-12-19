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

  static validateArray(value: any[], name: string, minLength?: number): void {
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

    return {
      security: securityConfig,
      performance: performanceConfig,
      infrastructure: infrastructureConfig,
      monitoring: monitoringConfig,
      features: featureFlags,
    };
  }

  private validateConfiguration(): void {
    try {
      ConfigValidator.validateSecurityConfig(this.config.security);
      ConfigValidator.validatePerformanceConfig(this.config.performance);
      ConfigValidator.validateInfrastructureConfig(this.config.infrastructure);
      ConfigValidator.validateMonitoringConfig(this.config.monitoring);
    } catch (error) {
      console.error('Configuration validation failed:', error);
      throw new Error(`Invalid configuration: ${error}`);
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
      console.warn(`Invalid number for ${key}: ${value}, using default: ${defaultValue}`);
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