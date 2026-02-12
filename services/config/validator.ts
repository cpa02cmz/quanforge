/**
 * Configuration Validator
 * Provides validation logic for all configuration types
 */

import type {
  SecurityConfig,
  PerformanceConfig,
  InfrastructureConfig,
  MonitoringConfig,
  WebSocketConfig,
  DatabaseConfig,
  AIConfig,
} from './types';

export class ConfigValidator {
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

  static validateBoolean(value: boolean, name: string): void {
    if (typeof value !== 'boolean') {
      throw new Error(`${name} must be a boolean, got: ${typeof value}`);
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

    ConfigValidator.validateNumber(config.caching.defaultTTL, 'caching.defaultTTL', 60000);
    ConfigValidator.validateNumber(config.caching.analyticsTTL, 'caching.analyticsTTL', 60000);
    ConfigValidator.validateNumber(config.caching.metricsTTL, 'caching.metricsTTL', 60000);

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
