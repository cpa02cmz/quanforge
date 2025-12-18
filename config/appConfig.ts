import { RetryOptions, CacheOptions } from '../types';

// Application-wide configuration constants
export const APP_CONFIG = {
  // Performance and timeout settings
  TIMEOUTS: {
    AI_RESPONSE: 30000, // 30 seconds for AI responses
    SIMULATION_DELAY: 500, // 500ms delay for UI feedback
    NETWORK_REQUEST: 10000, // 10 seconds for network requests
    EDGE_FUNCTION: 25000, // 25 seconds for edge functions
    CACHE_EXPIRY: 300000, // 5 minutes for default cache
  },
  
  // Retry configurations
  RETRY: {
    DEFAULT: {
      retries: 3,
      backoff: 'exponential' as const,
      backoffBase: 1000,
    } satisfies RetryOptions,
    NETWORK: {
      retries: 5,
      backoff: 'exponential' as const,
      backoffBase: 2000,
    } satisfies RetryOptions,
    AI_SERVICE: {
      retries: 2,
      backoff: 'linear' as const,
      backoffBase: 500,
    } satisfies RetryOptions,
  },
  
  // Cache configurations
  CACHE: {
    AI_RESPONSES: {
      ttl: 300000, // 5 minutes
      maxSize: 100,
      strategy: 'lru' as const,
    } satisfies CacheOptions,
    MARKET_DATA: {
      ttl: 60000, // 1 minute
      maxSize: 50,
      strategy: 'fifo' as const,
    } satisfies CacheOptions,
    USER_PREFERENCES: {
      ttl: 3600000, // 1 hour
      maxSize: 10,
      strategy: 'lru' as const,
    } satisfies CacheOptions,
  },
  
  // UI/UX settings
  UI: {
    MESSAGES_BUFFER_SIZE: 50, // Maximum messages to keep in memory
    ERROR_HISTORY_SIZE: 50, // Maximum errors to store
    DEBOUNCE_DELAY: 300, // milliseconds for search/filter debounce
    TOAST_DURATION: 4000, // milliseconds for toast notifications
    MOBILE_BREAKPOINT: 768, // pixels for mobile layout
  },
  
  // Simulation settings
  SIMULATION: {
    DEFAULT_DAYS: 90,
    DEFAULT_DEPOSIT: 10000,
    DEFAULT_LEVERAGE: 100,
    MIN_SIMULATION_STEPS: 100,
    MAX_SIMULATION_STEPS: 1000,
  },
  
  // Validation limits
  VALIDATION: {
    MAX_ROBOT_NAME_LENGTH: 100,
    MAX_MESSAGE_LENGTH: 5000,
    MAX_CUSTOM_INPUTS: 20,
    MIN_STOP_LOSS: 1,
    MAX_STOP_LOSS: 500,
    MIN_TAKE_PROFIT: 1,
    MAX_TAKE_PROFIT: 1000,
    MIN_RISK_PERCENT: 0.1,
    MAX_RISK_PERCENT: 10,
  },
  
  // Security settings
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 900000, // 15 minutes
    SESSION_TIMEOUT: 3600000, // 1 hour
    TOKEN_REFRESH_THRESHOLD: 300000, // 5 minutes before expiry
  },
  
  // Database settings
  DATABASE: {
    PAGINATION_SIZE: 20,
    MAX_QUERY_TIMEOUT: 30000,
    CONNECTION_POOL_SIZE: 10,
    QUERY_RETRY_ATTEMPTS: 3,
  },
  
  // Environment-specific settings
  ENVIRONMENT: {
    isDevelopment: process.env['NODE_ENV'] === 'development',
    isProduction: process.env['NODE_ENV'] === 'production',
    isTest: process.env['NODE_ENV'] === 'test',
  },
  
  // Feature flags
  FEATURES: {
    ENABLE_ANALYTICS: true,
    ENABLE_EDGE_OPTIMIZATION: true,
    ENABLE_CIRCUIT_BREAKER: true,
    ENABLE_ADVANCED_CACHING: true,
    ENABLE_PERFORMANCE_MONITORING: true,
  },
} as const;

// Helper functions for accessing configuration
export const getConfig = {
  timeout: (key: keyof typeof APP_CONFIG.TIMEOUTS) => APP_CONFIG.TIMEOUTS[key],
  retry: (key: keyof typeof APP_CONFIG.RETRY) => APP_CONFIG.RETRY[key],
  cache: (key: keyof typeof APP_CONFIG.CACHE) => APP_CONFIG.CACHE[key],
  ui: (key: keyof typeof APP_CONFIG.UI) => APP_CONFIG.UI[key],
  simulation: (key: keyof typeof APP_CONFIG.SIMULATION) => APP_CONFIG.SIMULATION[key],
  validation: (key: keyof typeof APP_CONFIG.VALIDATION) => APP_CONFIG.VALIDATION[key],
  security: (key: keyof typeof APP_CONFIG.SECURITY) => APP_CONFIG.SECURITY[key],
  database: (key: keyof typeof APP_CONFIG.DATABASE) => APP_CONFIG.DATABASE[key],
};

// Environment-specific configuration adjustments
export const getAdjustedConfig = {
  timeout: (key: keyof typeof APP_CONFIG.TIMEOUTS) => {
    const baseTimeout = APP_CONFIG.TIMEOUTS[key];
    return APP_CONFIG.ENVIRONMENT.isDevelopment ? baseTimeout * 2 : baseTimeout;
  },
  retry: (key: keyof typeof APP_CONFIG.RETRY) => {
    const baseRetry = APP_CONFIG.RETRY[key];
    return APP_CONFIG.ENVIRONMENT.isDevelopment 
      ? { ...baseRetry, retries: baseRetry.retries + 1 }
      : baseRetry;
  },
};

// Configuration validation
export const validateConfig = () => {
  const errors: string[] = [];
  
  // Validate timeout ranges
  Object.entries(APP_CONFIG.TIMEOUTS).forEach(([key, value]) => {
    if (value < 100 || value > 300000) {
      errors.push(`Timeout ${key} (${value}ms) is outside valid range (100ms - 5min)`);
    }
  });
  
  // Validate retry configurations
  Object.entries(APP_CONFIG.RETRY).forEach(([key, config]) => {
    if (config.retries && config.retries > 10) {
      errors.push(`Retry ${key} has too many retries (${config.retries})`);
    }
    if (config.backoffBase && config.backoffBase < 100) {
      errors.push(`Retry ${key} backoff base is too low (${config.backoffBase}ms)`);
    }
  });
  
  // Validate validation limits (meta!)
  Object.entries(APP_CONFIG.VALIDATION).forEach(([key, value]) => {
    if (typeof value === 'number' && value < 0) {
      errors.push(`Validation limit ${key} cannot be negative (${value})`);
    }
  });
  
  return errors;
};

// Dynamic configuration updates (for admin/configuration panel)
export class ConfigManager {
  private static instance: ConfigManager;
  private listeners: Set<() => void> = new Set();
  
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
  
  // Update configuration (would persist to backend in production)
  updateConfig(section: string, key: string, value: unknown) {
    // This would normally validate and persist to backend
    console.warn(`Config update attempted: ${section}.${key} = ${value}`);
    this.notifyListeners();
  }
  
  // Reset configuration to defaults
  resetConfig() {
    // This would normally reset persisted config
    console.warn('Config reset to defaults');
    this.notifyListeners();
  }
}

// Export configuration hook for React components
export const useConfig = () => {
  return {
    config: APP_CONFIG,
    get: getConfig,
    getAdjusted: getAdjustedConfig,
    manager: ConfigManager.getInstance(),
  };
};