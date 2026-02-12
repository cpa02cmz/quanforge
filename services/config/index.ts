/**
 * Configuration Module
 * Centralized configuration management with type safety and validation
 * 
 * @example
 * ```typescript
 * import { config, securityConfig } from './services/config';
 * 
 * // Access configuration
 * const security = config.security;
 * 
 * // Or use convenience getter
 * const security = securityConfig();
 * ```
 */

// Types
export type {
  SecurityConfig,
  PerformanceConfig,
  InfrastructureConfig,
  MonitoringConfig,
  FeatureFlags,
  WebSocketConfig,
  DatabaseConfig,
  AIConfig,
} from './types';

// Validator
export { ConfigValidator } from './validator';

// Service
export { ConfigurationService, config } from './service';

// Convenience getters
export {
  securityConfig,
  performanceConfig,
  infrastructureConfig,
  monitoringConfig,
  featureFlags,
  websocketsConfig,
  databaseConfig,
  aiConfig,
} from './service';
