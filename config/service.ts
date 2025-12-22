/**
 * Configuration Service Implementation
 * Provides centralized configuration management with validation and environment variable support
 */

import { AppConfig, DEFAULT_CONFIG, ENV_MAPPING } from './schema';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('ConfigService');

// ==================== Validation Utilities ====================

export class ConfigurationError extends Error {
  constructor(message: string, public path?: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function validateConfig(config: AppConfig): void {
  const errors: string[] = [];
  
  // Validate cache configuration
  if (config.cache.semantic.maxCacheSize <= 0) {
    errors.push('cache.semantic.maxCacheSize must be positive');
  }
  
  if (config.cache.semantic.maxMemoryUsage <= 0) {
    errors.push('cache.semantic.maxMemoryUsage must be positive');
  }
  
  if (config.cache.semantic.defaultTTL <= 0) {
    errors.push('cache.semantic.defaultTTL must be positive');
  }
  
  if (config.cache.semantic.semanticThreshold < 0 || config.cache.semantic.semanticThreshold > 1) {
    errors.push('cache.semantic.semanticThreshold must be between 0 and 1');
  }
  
  // Validate database configuration
  if (config.database.retry.maxRetries < 0) {
    errors.push('database.retry.maxRetries must be non-negative');
  }
  
  if (config.database.retry.retryDelay <= 0) {
    errors.push('database.retry.retryDelay must be positive');
  }
  
  if (config.database.retry.maxDelay <= 0) {
    errors.push('database.retry.maxDelay must be positive');
  }
  
  if (config.database.query.timeout <= 0) {
    errors.push('database.query.timeout must be positive');
  }
  
  if (config.database.query.batchSize <= 0) {
    errors.push('database.query.batchSize must be positive');
  }
  
  // Validate edge configuration
  if (config.edge.staticAssetsCacheTTL <= 0) {
    errors.push('edge.staticAssetsCacheTTL must be positive');
  }
  
  if (config.edge.apiCacheTTL <= 0) {
    errors.push('edge.apiCacheTTL must be positive');
  }
  
  if (config.edge.regions.length === 0) {
    errors.push('edge.regions cannot be empty');
  }
  
  // Validate simulation configuration
  if (config.simulation.riskScore.min < 1 || config.simulation.riskScore.max > 10) {
    errors.push('simulation.riskScore values must be between 1 and 10');
  }
  
  if (config.simulation.profitability.min < 1 || config.simulation.profitability.max > 10) {
    errors.push('simulation.profitability values must be between 1 and 10');
  }
  
  if (config.simulation.maxDays <= 0) {
    errors.push('simulation.maxDays must be positive');
  }
  
  // Validate performance configuration
  if (config.performance.memory.maxHeapSize <= 0) {
    errors.push('performance.memory.maxHeapSize must be positive');
  }
  
  if (config.performance.requests.timeout <= 0) {
    errors.push('performance.requests.timeout must be positive');
  }
  
  // Validate security configuration
  if (config.security.rateLimit.maxRequests <= 0) {
    errors.push('security.rateLimit.maxRequests must be positive');
  }
  
  if (config.security.rateLimit.windowMs <= 0) {
    errors.push('security.rateLimit.windowMs must be positive');
  }
  
  if (config.security.validation.maxFileSize <= 0) {
    errors.push('security.validation.maxFileSize must be positive');
  }
  
  if (errors.length > 0) {
    throw new ConfigurationError(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// ==================== Environment Variable Utilities ====================

function parseEnvironmentValue(value: string | undefined, type: 'number' | 'boolean' | 'string'): any {
  if (value === undefined) {
    return undefined;
  }
  
  switch (type) {
    case 'number':
      const parsed = Number(value);
      if (isNaN(parsed)) {
        throw new ConfigurationError(`Invalid number value: ${value}`);
      }
      return parsed;
    
    case 'boolean':
      return value.toLowerCase() === 'true' || value === '1';
    
    case 'string':
      return value;
    
    default:
      throw new ConfigurationError(`Unknown type: ${type}`);
  }
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  const finalKey = keys[keys.length - 1];
  current[finalKey] = value;
}

function loadEnvironmentVariables(config: AppConfig): void {
  const envVars: Record<string, string> = {};
  
  // Load all environment variables that match our mapping
  Object.entries(ENV_MAPPING).forEach(([key, mapping]) => {
    const envValue = process.env[mapping.envVar];
    if (envValue !== undefined) {
      try {
        const parsedValue = parseEnvironmentValue(envValue, mapping.type);
        setNestedValue(config, mapping.path, parsedValue);
        envVars[key] = envValue;
        logger.debug(`Loaded environment variable ${mapping.envVar} -> ${mapping.path}`);
      } catch (error) {
        if (mapping.required) {
          throw new ConfigurationError(`Required environment variable ${mapping.envVar} is invalid: ${error}`);
        }
        logger.warn(`Failed to parse environment variable ${mapping.envVar}: ${error}`);
      }
    } else if (mapping.required) {
      throw new ConfigurationError(`Required environment variable ${mapping.envVar} is not set`);
    }
  });
  
  // Log loaded environment variables (without sensitive values)
  const loadedCount = Object.keys(envVars).length;
  if (loadedCount > 0) {
    logger.info(`Loaded ${loadedCount} environment variables into configuration`);
  }
}

// ==================== Configuration Service ====================

export class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig;
  private initialized: boolean = false;
  
  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }
  
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }
  
  /**
   * Initialize configuration with environment variables and validation
   */
  initialize(customConfig?: Partial<AppConfig>): void {
    if (this.initialized) {
      logger.warn('Configuration service already initialized');
      return;
    }
    
    try {
      // Start with default configuration
      this.config = { ...DEFAULT_CONFIG };
      
      // Apply custom configuration if provided
      if (customConfig) {
        this.config = this.deepMerge(this.config, customConfig);
        logger.info('Applied custom configuration');
      }
      
      // Load environment variables
      loadEnvironmentVariables(this.config);
      
      // Validate final configuration
      validateConfig(this.config);
      
      this.initialized = true;
      logger.info('Configuration service initialized successfully');
      logger.debug(`Environment: ${this.config.environment}, Debug: ${this.config.debug}`);
      
    } catch (error) {
      logger.error('Failed to initialize configuration:', error);
      throw error;
    }
  }
  
  /**
   * Get the complete configuration object
   */
  getConfig(): AppConfig {
    this.ensureInitialized();
    return { ...this.config };
  }
  
  /**
   * Get a specific configuration value by path
   */
  get<T = any>(path: string): T {
    this.ensureInitialized();
    
    const keys = path.split('.');
    let current: any = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        throw new ConfigurationError(`Configuration path not found: ${path}`, path);
      }
    }
    
    return current as T;
  }
  
  /**
   * Update a configuration value by path
   */
  set(path: string, value: any): void {
    this.ensureInitialized();
    
    setNestedValue(this.config, path, value);
    
    // Validate the updated configuration
    try {
      validateConfig(this.config);
      logger.debug(`Updated configuration: ${path} = ${value}`);
    } catch (error) {
      // Revert the change if validation fails
      logger.error(`Failed to validate configuration after update ${path}: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get cache configuration
   */
  getCacheConfig() {
    return this.get('cache');
  }
  
  /**
   * Get database configuration
   */
  getDatabaseConfig() {
    return this.get('database');
  }
  
  /**
   * Get edge configuration
   */
  getEdgeConfig() {
    return this.get('edge');
  }
  
  /**
   * Get simulation configuration
   */
  getSimulationConfig() {
    return this.get('simulation');
  }
  
  /**
   * Get performance configuration
   */
  getPerformanceConfig() {
    return this.get('performance');
  }
  
  /**
   * Get security configuration
   */
  getSecurityConfig() {
    return this.get('security');
  }
  
  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return this.get('environment') === 'development';
  }
  
  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return this.get('environment') === 'production';
  }
  
  /**
   * Check if debug mode is enabled
   */
  isDebug(): boolean {
    return this.get('debug');
  }
  
  /**
   * Reset configuration to defaults
   */
  reset(): void {
    logger.info('Resetting configuration to defaults');
    this.config = { ...DEFAULT_CONFIG };
  }
  
  /**
   * Export configuration (for debugging)
   */
  exportConfig(): string {
    this.ensureInitialized();
    return JSON.stringify(this.config, null, 2);
  }
  
  // ==================== Private Methods ====================
  
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ConfigurationError('Configuration service not initialized. Call initialize() first.');
    }
  }
  
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}

// ==================== Export Instance ====================

export const configService = ConfigService.getInstance();

// ==================== Convenience Functions ====================

/**
 * Get configuration service and ensure it's initialized
 */
export function getConfig(): ConfigService {
  if (!configService) {
    throw new ConfigurationError('Configuration service not available');
  }
  return configService;
}

/**
 * Initialize configuration with optional custom settings
 */
export function initializeConfig(customConfig?: Partial<AppConfig>): void {
  configService.initialize(customConfig);
}

/**
 * Get cache configuration shortcut
 */
export function getCacheConfig() {
  return configService.getCacheConfig();
}

/**
 * Get database configuration shortcut
 */
export function getDatabaseConfig() {
  return configService.getDatabaseConfig();
}

/**
 * Get edge configuration shortcut
 */
export function getEdgeConfig() {
  return configService.getEdgeConfig();
}