/**
 * Centralized Cache Configuration
 * 
 * This file contains all cache-related configuration constants
 * to maintain consistency across the application and enable
 * dynamic tuning without code changes.
 */

export interface CacheConfig {
  // Size limits
  readonly maxSize: number;
  readonly maxEntries: number;
  
  // Timing
  readonly defaultTTL: number;
  readonly cleanupInterval: number;
  
  // Performance
  readonly compressionThreshold: number;
  readonly samplingRate: number;
  readonly maxRetries: number;
}

export interface CacheStrategyConfig {
  readonly name: string;
  readonly config: CacheConfig;
  readonly features: {
    readonly compression: boolean;
    readonly metrics: boolean;
    readonly validation: boolean;
    readonly tagSupport: boolean;
  };
}

// Base configuration constants
export const CACHE_CONSTANTS = {
  // Time conversions for readability
  MS_IN_SECOND: 1000,
  SECONDS_IN_MINUTE: 60,
  MINUTES_IN_HOUR: 60,
  HOURS_IN_DAY: 24,
  
  // Size conversions
  BYTES_PER_KB: 1024,
  BYTES_PER_MB: 1024 * 1024,
  
  // Performance thresholds
  HIT_RATE_GOOD: 80,
  HIT_RATE_OK: 60,
  MEMORY_PRESSURE_HIGH: 80,
  MEMORY_PRESSURE_CRITICAL: 95
} as const;

// Memory limits for different environments
export const MEMORY_LIMITS = {
  // MB values converted to bytes
  EDGE_MAX_MEMORY_BYTES: 50 * CACHE_CONSTANTS.BYTES_PER_MB,
  BROWSER_MAX_MEMORY_BYTES: 100 * CACHE_CONSTANTS.BYTES_PER_MB,
  SERVER_MAX_MEMORY_BYTES: 512 * CACHE_CONSTANTS.BYTES_PER_MB,
  
  WARNING_THRESHOLD_RATIO: 0.8,
  CRITICAL_THRESHOLD_RATIO: 0.95,
  
  get warningThreshold(): number {
    return (typeof window === 'undefined' ? this.SERVER_MAX_MEMORY_BYTES : this.BROWSER_MAX_MEMORY_BYTES) * 
           this.WARNING_THRESHOLD_RATIO;
  },
  
  get criticalThreshold(): number {
    return (typeof window === 'undefined' ? this.SERVER_MAX_MEMORY_BYTES : this.BROWSER_MAX_MEMORY_BYTES) * 
           this.CRITICAL_THRESHOLD_RATIO;
  }
} as const;

// Predefined cache strategies
export const CACHE_STRATEGIES: Record<string, CacheStrategyConfig> = {
  // Edge-optimized strategy for Vercel Edge Functions
  edge: {
    name: 'edge',
    config: {
      maxSize: 10 * CACHE_CONSTANTS.BYTES_PER_MB, // 10MB
      maxEntries: 500,
      defaultTTL: 3 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND, // 3 minutes
      cleanupInterval: 30 * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND, // 30 seconds
      compressionThreshold: 512, // 0.5KB - more aggressive compression
      samplingRate: 0.05, // 5% sampling to reduce overhead
      maxRetries: 2
    },
    features: {
      compression: true,
      metrics: true,
      validation: false, // Skip validation for performance
      tagSupport: false // Simplified for edge
    }
  },

  // Browser strategy for client-side caching
  browser: {
    name: 'browser',
    config: {
      maxSize: 20 * CACHE_CONSTANTS.BYTES_PER_MB, // 20MB
      maxEntries: 1000,
      defaultTTL: 5 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND, // 5 minutes
      cleanupInterval: 2 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND, // 2 minutes
      compressionThreshold: 1024, // 1KB
      samplingRate: 0.1, // 10% sampling
      maxRetries: 3
    },
    features: {
      compression: true,
      metrics: true,
      validation: true, // Full validation for security
      tagSupport: true
    }
  },

  // Server strategy for backend operations
  server: {
    name: 'server',
    config: {
      maxSize: 100 * CACHE_CONSTANTS.BYTES_PER_MB, // 100MB
      maxEntries: 5000,
      defaultTTL: 10 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND, // 10 minutes
      cleanupInterval: 5 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND, // 5 minutes
      compressionThreshold: 2048, // 2KB - less aggressive on server
      samplingRate: 0.2, // 20% sampling for better metrics
      maxRetries: 5
    },
    features: {
      compression: true,
      metrics: true,
      validation: true,
      tagSupport: true
    }
  },

  // High-frequency strategy for real-time data
  realtime: {
    name: 'realtime',
    config: {
      maxSize: 5 * CACHE_CONSTANTS.BYTES_PER_MB, // 5MB smaller for speed
      maxEntries: 200,
      defaultTTL: 30 * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND, // 30 seconds
      cleanupInterval: 10 * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND, // 10 seconds
      compressionThreshold: 256, // 0.25KB very aggressive
      samplingRate: 0.01, // 1% sampling minimal overhead
      maxRetries: 1 // Fast fail
    },
    features: {
      compression: true,
      metrics: false, // Minimal metrics for speed
      validation: false, // Skip validation for speed
      tagSupport: false // Simplified for speed
    }
  },

  // Long-term strategy for static data
  persistent: {
    name: 'persistent',
    config: {
      maxSize: 50 * CACHE_CONSTANTS.BYTES_PER_MB, // 50MB
      maxEntries: 2000,
      defaultTTL: 24 * CACHE_CONSTANTS.HOURS_IN_DAY * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND, // 24 hours
      cleanupInterval: 30 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND, // 30 minutes
      compressionThreshold: 4096, // 4KB - less compression
      samplingRate: 0.15, // 15% sampling
      maxRetries: 3
    },
    features: {
      compression: true,
      metrics: true,
      validation: true,
      tagSupport: true
    }
  }
} as const;

// Specific cache configurations for different data types
export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Robot configurations
  robots: {
    maxSize: 20 * CACHE_CONSTANTS.BYTES_PER_MB,
    maxEntries: 1000,
    defaultTTL: 10 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    cleanupInterval: 2 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    compressionThreshold: 1024,
    samplingRate: 0.1,
    maxRetries: 3
  },

  // Market data (high frequency, short TTL)
  marketData: {
    maxSize: 15 * CACHE_CONSTANTS.BYTES_PER_MB,
    maxEntries: 500,
    defaultTTL: 30 * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    cleanupInterval: 15 * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    compressionThreshold: 256,
    samplingRate: 0.05,
    maxRetries: 1
  },

  // Analysis results (medium frequency, longer TTL)
  analysis: {
    maxSize: 30 * CACHE_CONSTANTS.BYTES_PER_MB,
    maxEntries: 200,
    defaultTTL: 15 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    cleanupInterval: 3 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    compressionThreshold: 2048,
    samplingRate: 0.15,
    maxRetries: 3
  },

  // User sessions (security focused)
  users: {
    maxSize: 5 * CACHE_CONSTANTS.BYTES_PER_MB,
    maxEntries: 100,
    defaultTTL: 15 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    cleanupInterval: 1 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    compressionThreshold: 512,
    samplingRate: 0.1,
    maxRetries: 2
  },

  // API responses (rate limiting aware)
  api: {
    maxSize: 10 * CACHE_CONSTANTS.BYTES_PER_MB,
    maxEntries: 300,
    defaultTTL: 2 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    cleanupInterval: 1 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    compressionThreshold: 1024,
    samplingRate: 0.1,
    maxRetries: 2
  },

  // AI responses (expensive, longer cache)
  ai: {
    maxSize: 50 * CACHE_CONSTANTS.BYTES_PER_MB,
    maxEntries: 100,
    defaultTTL: 30 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    cleanupInterval: 5 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    compressionThreshold: 4096,
    samplingRate: 0.2,
    maxRetries: 3
  },

  // Component cache (UI specific)
  components: {
    maxSize: 5 * CACHE_CONSTANTS.BYTES_PER_MB,
    maxEntries: 150,
    defaultTTL: 5 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    cleanupInterval: 1 * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    compressionThreshold: 512,
    samplingRate: 0.05,
    maxRetries: 1
  }
} as const;

// Cache priority levels
export const CACHE_PRIORITIES = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  CRITICAL: 3
} as const;

// Cache tag categories for organized invalidation
export const CACHE_TAGS = {
  // Data source tags
  DATA_SOURCE: {
    TWELVE_DATA: 'data:twelve-data',
    BINANCE: 'data:binance',
    GEMINI: 'data:gemini',
    USER_GENERATED: 'data:user',
    CALCULATED: 'data:calculated'
  },

  // Content type tags
  CONTENT_TYPE: {
    ROBOT: 'type:robot',
    MARKET_DATA: 'type:market-data',
    ANALYSIS: 'type:analysis',
    USER_SESSION: 'type:user-session',
    API_RESPONSE: 'type:api-response'
  },

  // Lifecycle tags
  LIFECYCLE: {
    SHORT_TERM: 'lifecycle:short',
    MEDIUM_TERM: 'lifecycle:medium',
    LONG_TERM: 'lifecycle:long'
  },

  // Security tags
  SECURITY: {
    PUBLIC: 'security:public',
    USER_SPECIFIC: 'security:user-specific',
    SENSITIVE: 'security:sensitive'
  },

  // Environment tags
  ENVIRONMENT: {
    EDGE: 'env:edge',
    BROWSER: 'env:browser',
    SERVER: 'env:server'
  }
} as const;

// Utility functions
export const CacheUtils = {
  /**
   * Get appropriate cache strategy based on environment
   */
  getStrategyForEnvironment(): CacheStrategyConfig {
    if (typeof window === 'undefined') {
      // Edge or server environment
      return process.env.EDGE_ENVIRONMENT ? CACHE_STRATEGIES.edge : CACHE_STRATEGIES.server;
    }
    return CACHE_STRATEGIES.browser;
  },

  /**
   * Get cache config with environment-specific overrides
   */
  getConfigWithOverrides(baseConfig: CacheConfig, overrides: Partial<CacheConfig> = {}): CacheConfig {
    return { ...baseConfig, ...overrides };
  },

  /**
   * Calculate optimal compression threshold based on data type
   */
  getOptimalCompressionThreshold(dataType: keyof typeof CACHE_CONFIGS): number {
    const config = CACHE_CONFIGS[dataType];
    return config.compressionThreshold;
  },

  /**
   * Check if memory pressure is high
   */
  isMemoryPressureHigh(currentMemory: number): boolean {
    return currentMemory > MEMORY_LIMITS.warningThreshold;
  },

  /**
   * Check if memory pressure is critical
   */
  isMemoryPressureCritical(currentMemory: number): boolean {
    return currentMemory > MEMORY_LIMITS.criticalThreshold;
  },

  /**
   * Get TTL in milliseconds from human-readable format
   */
  ttlms: {
    seconds: (s: number) => s * CACHE_CONSTANTS.MS_IN_SECOND,
    minutes: (m: number) => m * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    hours: (h: number) => h * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND,
    days: (d: number) => d * CACHE_CONSTANTS.HOURS_IN_DAY * CACHE_CONSTANTS.MINUTES_IN_HOUR * CACHE_CONSTANTS.SECONDS_IN_MINUTE * CACHE_CONSTANTS.MS_IN_SECOND
  } as const,

  /**
   * Get size in bytes from human-readable format
   */
  size: {
    kb: (kb: number) => kb * CACHE_CONSTANTS.BYTES_PER_KB,
    mb: (mb: number) => mb * CACHE_CONSTANTS.BYTES_PER_MB
  } as const
} as const;

// Export commonly used configurations
export const DEFAULT_CACHE_CONFIG = CacheUtils.getConfigWithOverrides(
  CacheUtils.getStrategyForEnvironment().config
);

export const ROBOT_CACHE_CONFIG = CacheUtils.getConfigWithOverrides(
  CACHE_CONFIGS.robots
);

export const MARKET_DATA_CACHE_CONFIG = CacheUtils.getConfigWithOverrides(
  CACHE_CONFIGS.marketData
);