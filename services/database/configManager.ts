/**
 * Database Configuration Manager
 * 
 * Centralized configuration management for all database services.
 * Provides validation, hot-reload capabilities, and environment-based configuration.
 * 
 * Features:
 * - Centralized configuration management
 * - Environment-based configuration loading
 * - Configuration validation and migration
 * - Hot-reload support
 * - Configuration versioning and history
 * 
 * @module services/database/configManager
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../modularConstants';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('DatabaseConfigManager');

// ============================================================================
// TYPES
// ============================================================================

export type ConfigSource = 'default' | 'environment' | 'file' | 'runtime' | 'initialization';
export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface DatabaseConfig {
  version: string;
  connection: ConnectionConfig;
  pool: PoolConfig;
  cache: CacheConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  performance: PerformanceConfig;
}

export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  sslConfig?: {
    ca?: string;
    cert?: string;
    key?: string;
    rejectUnauthorized: boolean;
  };
  connectionTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
}

export interface PoolConfig {
  min: number;
  max: number;
  acquireTimeout: number;
  idleTimeout: number;
  validationQuery: string;
  validationInterval: number;
  testOnBorrow: boolean;
  testOnReturn: boolean;
}

export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  ttl: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
  invalidateOnWrite: boolean;
  preload: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  healthCheckInterval: number;
  slowQueryThreshold: number;
  logQueries: boolean;
  logSlowQueries: boolean;
  alertThresholds: {
    connectionUsage: number;
    queryLatency: number;
    errorRate: number;
  };
}

export interface SecurityConfig {
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotationDays: number;
  };
  audit: {
    enabled: boolean;
    logLevel: 'minimal' | 'standard' | 'verbose';
    retainDays: number;
  };
  access: {
    maxConnections: number;
    rateLimit: number;
    ipWhitelist: string[];
  };
}

export interface PerformanceConfig {
  batchSize: number;
  prefetchSize: number;
  parallelQueries: number;
  optimizeJoins: boolean;
  enableQueryPlan: boolean;
  autoVacuum: boolean;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationIssue[];
  warnings: ConfigValidationIssue[];
}

export interface ConfigValidationIssue {
  path: string;
  message: string;
  severity: ValidationSeverity;
  value?: unknown;
  suggestion?: string;
}

export interface ConfigChangeEvent {
  timestamp: number;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  source: ConfigSource;
}

export interface ConfigHistory {
  timestamp: number;
  config: DatabaseConfig;
  source: ConfigSource;
  checksum: string;
}

export interface ConfigManagerOptions {
  enableHotReload: boolean;
  enableValidation: boolean;
  historySize: number;
  autoSave: boolean;
  watchInterval: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: DatabaseConfig = {
  version: '1.0.0',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'quanforge',
    username: 'postgres',
    password: '',
    ssl: false,
    connectionTimeout: TIME_CONSTANTS.SECOND * 30,
    idleTimeout: TIME_CONSTANTS.MINUTE * 10,
    maxLifetime: TIME_CONSTANTS.HOUR,
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeout: TIME_CONSTANTS.SECOND * 30,
    idleTimeout: TIME_CONSTANTS.MINUTE * 5,
    validationQuery: 'SELECT 1',
    validationInterval: TIME_CONSTANTS.MINUTE,
    testOnBorrow: true,
    testOnReturn: false,
  },
  cache: {
    enabled: true,
    maxSize: 100 * 1024 * 1024, // 100MB
    ttl: TIME_CONSTANTS.MINUTE * 5,
    evictionPolicy: 'lru',
    invalidateOnWrite: true,
    preload: false,
  },
  monitoring: {
    enabled: true,
    metricsInterval: TIME_CONSTANTS.SECOND * 30,
    healthCheckInterval: TIME_CONSTANTS.MINUTE,
    slowQueryThreshold: 100,
    logQueries: false,
    logSlowQueries: true,
    alertThresholds: {
      connectionUsage: 0.8,
      queryLatency: 500,
      errorRate: 0.05,
    },
  },
  security: {
    encryption: {
      enabled: false,
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90,
    },
    audit: {
      enabled: true,
      logLevel: 'standard',
      retainDays: 90,
    },
    access: {
      maxConnections: 100,
      rateLimit: 1000,
      ipWhitelist: [],
    },
  },
  performance: {
    batchSize: 100,
    prefetchSize: 1000,
    parallelQueries: 4,
    optimizeJoins: true,
    enableQueryPlan: true,
    autoVacuum: true,
  },
};

const DEFAULT_OPTIONS: ConfigManagerOptions = {
  enableHotReload: false,
  enableValidation: true,
  historySize: 50,
  autoSave: true,
  watchInterval: TIME_CONSTANTS.SECOND * 10,
};

// ============================================================================
// DATABASE CONFIGURATION MANAGER CLASS
// ============================================================================

/**
 * Manages database configuration with validation and hot-reload support
 */
export class DatabaseConfigManager {
  private static instance: DatabaseConfigManager;
  private config: DatabaseConfig;
  private options: ConfigManagerOptions;
  private history: ConfigHistory[] = [];
  private changeListeners: Array<(event: ConfigChangeEvent) => void> = [];
  private watchTimer?: ReturnType<typeof setInterval>;
  private configSource: ConfigSource = 'default';
  private isInitialized = false;
  private pendingChanges: ConfigChangeEvent[] = [];

  private constructor(options: Partial<ConfigManagerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.config = this.loadConfiguration();
  }

  static getInstance(options?: Partial<ConfigManagerOptions>): DatabaseConfigManager {
    if (!DatabaseConfigManager.instance) {
      DatabaseConfigManager.instance = new DatabaseConfigManager(options);
    }
    return DatabaseConfigManager.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the configuration manager
   */
  initialize(): void {
    if (this.isInitialized) return;

    if (this.options.enableHotReload) {
      this.startWatching();
    }

    this.saveHistory('initialization');
    this.isInitialized = true;

    logger.log('Database configuration manager initialized', {
      source: this.configSource,
      hotReload: this.options.enableHotReload,
    });
  }

  /**
   * Shutdown the configuration manager
   */
  shutdown(): void {
    this.stopWatching();
    this.changeListeners = [];
    this.history = [];
    this.isInitialized = false;

    logger.log('Database configuration manager shutdown');
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<DatabaseConfig> {
    return { ...this.config };
  }

  /**
   * Get a specific configuration section
   */
  getSection<K extends keyof DatabaseConfig>(section: K): Readonly<DatabaseConfig[K]> {
    const value = this.config[section];
    return typeof value === 'object' && value !== null ? { ...value } as DatabaseConfig[K] : value;
  }

  /**
   * Get a nested configuration value by path
   */
  get<T = unknown>(path: string, defaultValue?: T): T {
    const value = this.getByPath(this.config, path);
    return (value !== undefined ? value : defaultValue) as T;
  }

  /**
   * Update configuration
   */
  update(config: Partial<DatabaseConfig>, source: ConfigSource = 'runtime'): ConfigValidationResult {
    const validation = this.validate({ ...this.config, ...config });

    if (!validation.valid) {
      logger.error('Configuration update rejected due to validation errors', {
        errors: validation.errors.length,
      });
      return validation;
    }

    // Track changes
    this.trackChanges(config, source);

    // Apply changes
    this.config = { ...this.config, ...config };
    this.configSource = source;

    // Save history
    this.saveHistory(source);

    // Notify listeners
    this.notifyListeners();

    // Log warnings
    if (validation.warnings.length > 0) {
      logger.warn('Configuration updated with warnings', {
        warnings: validation.warnings.length,
      });
    }

    logger.log('Configuration updated', { source, version: this.config.version });
    return validation;
  }

  /**
   * Update a specific configuration section
   */
  updateSection<K extends keyof DatabaseConfig>(
    section: K,
    value: Partial<DatabaseConfig[K]>,
    source: ConfigSource = 'runtime'
  ): ConfigValidationResult {
    const currentSection = this.config[section];
    const newSection = { ...(currentSection as object), ...value } as DatabaseConfig[K];
    return this.update({ [section]: newSection } as Partial<DatabaseConfig>, source);
  }

  /**
   * Set a nested configuration value by path
   */
  set(path: string, value: unknown, source: ConfigSource = 'runtime'): ConfigValidationResult {
    const newConfig = this.setByPath({ ...this.config }, path, value);
    return this.update(newConfig, source);
  }

  /**
   * Reset to default configuration
   */
  reset(source: ConfigSource = 'runtime'): void {
    const oldConfig = { ...this.config };
    this.config = { ...DEFAULT_CONFIG };
    this.configSource = source;
    this.saveHistory(source);

    // Track all changes
    this.trackAllChanges(oldConfig, this.config, source);

    logger.log('Configuration reset to defaults');
  }

  /**
   * Validate configuration
   */
  validate(config: DatabaseConfig = this.config): ConfigValidationResult {
    const errors: ConfigValidationIssue[] = [];
    const warnings: ConfigValidationIssue[] = [];

    // Validate connection config
    this.validateConnectionConfig(config.connection, errors, warnings);

    // Validate pool config
    this.validatePoolConfig(config.pool, errors, warnings);

    // Validate cache config
    this.validateCacheConfig(config.cache, errors, warnings);

    // Validate monitoring config
    this.validateMonitoringConfig(config.monitoring, errors, warnings);

    // Validate security config
    this.validateSecurityConfig(config.security, errors, warnings);

    // Validate performance config
    this.validatePerformanceConfig(config.performance, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Subscribe to configuration changes
   */
  onChange(listener: (event: ConfigChangeEvent) => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get configuration history
   */
  getHistory(limit: number = 10): ConfigHistory[] {
    return this.history.slice(-limit);
  }

  /**
   * Rollback to a previous configuration
   */
  rollback(timestamp: number): boolean {
    const historical = this.history.find(h => h.timestamp === timestamp);
    if (!historical) {
      logger.error('Cannot find configuration for rollback', { timestamp });
      return false;
    }

    this.config = { ...historical.config };
    this.configSource = 'runtime';
    this.saveHistory('runtime');

    logger.log('Configuration rolled back', { timestamp });
    return true;
  }

  /**
   * Export configuration as JSON
   */
  export(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  import(json: string, source: ConfigSource = 'file'): ConfigValidationResult {
    try {
      const config = JSON.parse(json) as DatabaseConfig;
      return this.update(config, source);
    } catch (error) {
      const validation: ConfigValidationResult = {
        valid: false,
        errors: [{
          path: '',
          message: `Failed to parse configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
        }],
        warnings: [],
      };
      return validation;
    }
  }

  /**
   * Get configuration diff
   */
  diff(other: DatabaseConfig): Array<{ path: string; thisValue: unknown; otherValue: unknown }> {
    return this.diffConfigs(this.config, other, '');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private loadConfiguration(): DatabaseConfig {
    // Start with defaults
    let config = { ...DEFAULT_CONFIG };

    // Load from environment variables
    config = this.loadFromEnvironment(config);

    // Determine source
    this.configSource = 'environment';

    return config;
  }

  private loadFromEnvironment(config: DatabaseConfig): DatabaseConfig {
    // Get environment variables safely
    let env: Record<string, string | undefined> = {};
    
    try {
      // Try Node.js process.env first
      if (typeof process !== 'undefined' && process.env) {
        env = process.env as Record<string, string | undefined>;
      }
    } catch {
      // Ignore errors
    }

    // Try Vite's import.meta.env if available
    try {
      if (typeof import.meta !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viteEnv = (import.meta as any).env;
        if (viteEnv) {
          env = { ...env, ...viteEnv };
        }
      }
    } catch {
      // Ignore errors
    }

    // Connection settings
    const supabaseUrl = env.VITE_SUPABASE_URL;
    if (supabaseUrl) {
      try {
        const url = new URL(supabaseUrl);
        config.connection.host = url.hostname;
        config.connection.port = parseInt(url.port, 10) || 5432;
        config.connection.database = url.pathname.slice(1);
      } catch {
        // Invalid URL, ignore
      }
    }

    const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
    if (supabaseKey) {
      config.connection.password = supabaseKey;
    }

    return config;
  }

  private validateConnectionConfig(
    config: ConnectionConfig,
    errors: ConfigValidationIssue[],
    warnings: ConfigValidationIssue[]
  ): void {
    if (!config.host) {
      errors.push({ path: 'connection.host', message: 'Host is required', severity: 'error' });
    }

    if (config.port < 1 || config.port > 65535) {
      errors.push({ path: 'connection.port', message: 'Port must be between 1 and 65535', severity: 'error' });
    }

    if (!config.database) {
      errors.push({ path: 'connection.database', message: 'Database name is required', severity: 'error' });
    }

    if (config.connectionTimeout < 1000) {
      warnings.push({
        path: 'connection.connectionTimeout',
        message: 'Connection timeout is very short, may cause premature failures',
        severity: 'warning',
        suggestion: 'Consider increasing to at least 5000ms',
      });
    }

    if (config.ssl && !config.sslConfig?.rejectUnauthorized) {
      warnings.push({
        path: 'connection.sslConfig.rejectUnauthorized',
        message: 'SSL enabled but rejectUnauthorized is false, may be insecure',
        severity: 'warning',
      });
    }
  }

  private validatePoolConfig(
    config: PoolConfig,
    errors: ConfigValidationIssue[],
    _warnings: ConfigValidationIssue[]
  ): void {
    if (config.min < 0) {
      errors.push({ path: 'pool.min', message: 'Minimum pool size cannot be negative', severity: 'error' });
    }

    if (config.max < config.min) {
      errors.push({ path: 'pool.max', message: 'Maximum pool size must be >= minimum', severity: 'error' });
    }

    if (config.max > 100) {
      _warnings.push({
        path: 'pool.max',
        message: 'Large pool size may consume significant resources',
        severity: 'warning',
      });
    }
  }

  private validateCacheConfig(
    config: CacheConfig,
    _errors: ConfigValidationIssue[],
    warnings: ConfigValidationIssue[]
  ): void {
    if (config.enabled && config.maxSize < 1024 * 1024) {
      warnings.push({
        path: 'cache.maxSize',
        message: 'Cache size is very small, may not be effective',
        severity: 'warning',
        suggestion: 'Consider increasing to at least 10MB',
      });
    }

    if (config.ttl < 1000) {
      warnings.push({
        path: 'cache.ttl',
        message: 'Very short TTL may cause cache thrashing',
        severity: 'warning',
      });
    }
  }

  private validateMonitoringConfig(
    config: MonitoringConfig,
    _errors: ConfigValidationIssue[],
    warnings: ConfigValidationIssue[]
  ): void {
    if (config.enabled && config.metricsInterval < 1000) {
      warnings.push({
        path: 'monitoring.metricsInterval',
        message: 'Very frequent metrics collection may impact performance',
        severity: 'warning',
      });
    }

    if (config.slowQueryThreshold < 10) {
      warnings.push({
        path: 'monitoring.slowQueryThreshold',
        message: 'Very low slow query threshold may generate excessive logs',
        severity: 'warning',
      });
    }
  }

  private validateSecurityConfig(
    config: SecurityConfig,
    _errors: ConfigValidationIssue[],
    warnings: ConfigValidationIssue[]
  ): void {
    if (!config.encryption.enabled && config.audit.logLevel === 'verbose') {
      warnings.push({
        path: 'security.encryption.enabled',
        message: 'Verbose audit logging without encryption may expose sensitive data',
        severity: 'warning',
      });
    }

    if (config.access.rateLimit < 10) {
      warnings.push({
        path: 'security.access.rateLimit',
        message: 'Very low rate limit may block legitimate traffic',
        severity: 'warning',
      });
    }
  }

  private validatePerformanceConfig(
    config: PerformanceConfig,
    _errors: ConfigValidationIssue[],
    warnings: ConfigValidationIssue[]
  ): void {
    if (config.batchSize > 10000) {
      warnings.push({
        path: 'performance.batchSize',
        message: 'Very large batch size may cause memory issues',
        severity: 'warning',
      });
    }

    if (config.parallelQueries > 16) {
      warnings.push({
        path: 'performance.parallelQueries',
        message: 'Many parallel queries may overwhelm the database',
        severity: 'warning',
      });
    }
  }

  private getByPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private setByPath<T extends Record<string, unknown>>(obj: T, path: string, value: unknown): T {
    const parts = path.split('.');
    const result = { ...obj };
    let current: Record<string, unknown> = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      current[part] = { ...(current[part] as Record<string, unknown> || {}) };
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    return result;
  }

  private trackChanges(newConfig: Partial<DatabaseConfig>, source: ConfigSource): void {
    for (const key of Object.keys(newConfig) as Array<keyof DatabaseConfig>) {
      const oldValue = this.config[key];
      const newValue = newConfig[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        this.pendingChanges.push({
          timestamp: Date.now(),
          path: key,
          oldValue,
          newValue,
          source,
        });
      }
    }
  }

  private trackAllChanges(oldConfig: DatabaseConfig, newConfig: DatabaseConfig, source: ConfigSource): void {
    for (const key of Object.keys(oldConfig) as Array<keyof DatabaseConfig>) {
      if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
        this.pendingChanges.push({
          timestamp: Date.now(),
          path: key,
          oldValue: oldConfig[key],
          newValue: newConfig[key],
          source,
        });
      }
    }
  }

  private saveHistory(source: ConfigSource): void {
    const checksum = this.calculateChecksum(this.config);

    this.history.push({
      timestamp: Date.now(),
      config: { ...this.config },
      source,
      checksum,
    });

    // Trim history
    if (this.history.length > this.options.historySize) {
      this.history = this.history.slice(-this.options.historySize);
    }
  }

  private calculateChecksum(config: DatabaseConfig): string {
    const str = JSON.stringify(config);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private startWatching(): void {
    this.watchTimer = setInterval(
      () => this.checkForChanges(),
      this.options.watchInterval
    );
  }

  private stopWatching(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = undefined;
    }
  }

  private checkForChanges(): void {
    const currentConfig = this.loadConfiguration();
    const diff = this.diff(currentConfig);

    if (diff.length > 0) {
      logger.log('Configuration changes detected, applying...');
      this.update(currentConfig, 'environment');
    }
  }

  private notifyListeners(): void {
    for (const change of this.pendingChanges) {
      for (const listener of this.changeListeners) {
        try {
          listener(change);
        } catch (error) {
          logger.error('Configuration change listener error', {
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }
    }

    this.pendingChanges = [];
  }

  private diffConfigs(
    a: unknown,
    b: unknown,
    path: string
  ): Array<{ path: string; thisValue: unknown; otherValue: unknown }> {
    const diffs: Array<{ path: string; thisValue: unknown; otherValue: unknown }> = [];

    if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
      diffs.push({ path, thisValue: a, otherValue: b });
      return diffs;
    }

    if (typeof a === 'object' && a !== null && b !== null) {
      const keysA = Object.keys(a as object);
      const keysB = Object.keys(b as object);
      const allKeys = new Set([...keysA, ...keysB]);

      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key;
        const subDiffs = this.diffConfigs(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          newPath
        );
        diffs.push(...subDiffs);
      }
    } else if (a !== b) {
      diffs.push({ path, thisValue: a, otherValue: b });
    }

    return diffs;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const databaseConfigManager = DatabaseConfigManager.getInstance();

// Register with service cleanup coordinator
serviceCleanupCoordinator.register('databaseConfigManager', {
  cleanup: () => databaseConfigManager.shutdown(),
  priority: 'high',
  description: 'Database configuration manager service',
});

// Auto-initialize
databaseConfigManager.initialize();
