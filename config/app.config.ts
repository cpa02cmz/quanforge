// Centralized application configuration
// No hardcoded values - use this file for all configuration

export const config = {
  // Application metadata
  app: {
    name: 'QuantForge AI',
    version: '1.0.0',
    description: 'Algorithmic trading strategy generator',
  },

  // API configuration
  api: {
    // Timeout settings (ms)
    timeout: 30000,
    
    // Retry configuration
    retries: {
      maxAttempts: 3,
      baseDelay: 1000,
      backoffMultiplier: 2,
    },

    // Rate limiting
    rateLimit: {
      requestsPerMinute: 60,
      burstLimit: 10,
    },
  },

  // Build and optimization settings
  build: {
    // Performance targets
    bundleSizeLimit: '500KB',
    chunkSizeWarningLimit: '100KB',
    buildTimeTarget: 15, // seconds
    
    // File size limits
    maxServiceLines: 500,
    maxComponentLines: 300,
    maxUtilLines: 200,
  },

  // Quality standards
  quality: {
    // Type safety targets
    maxAnyTypes: 450, // Target reduction from 905
    
    // Performance metrics
    coreWebVitals: {
      LCP: 2500, // Largest Contentful Paint (ms)
      FID: 100,  // First Input Delay (ms)
      CLS: 0.1,  // Cumulative Layout Shift
    },
    
    // Testing coverage
    minTestCoverage: 80, // percentage
  },

  // Cache configuration
  cache: {
    // TTL settings (ms)
    defaultTTL: 300000,        // 5 minutes
    shortTTL: 60000,          // 1 minute
    longTTL: 3600000,         // 1 hour
    
    // Storage limits
    maxEntries: 1000,
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
  },

  // Database optimization
  database: {
    // Connection pooling
    poolConnections: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
    },
    
    // Query optimization
    queryTimeout: 10000,
    slowQueryThreshold: 1000, // ms
    maxResultRows: 10000,
  },

  // Security settings
  security: {
    // Rate limiting thresholds
    rateLimitThresholds: {
      suspicious: 100,   // requests per hour
      blocking: 500,     // requests per hour
    },
    
    // Input validation limits
    validation: {
      maxInputLength: 10000,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileTypes: ['.json', '.csv', '.mq5'],
    },
    
    // Encryption settings
    encryption: {
      keyRotationInterval: 86400000, // 24 hours
      maxKeyAge: 7 * 86400000,       // 7 days
    },
  },

  // Development settings
  development: {
    // Local development ports
    ports: {
      dev: 3000,
      test: 3001,
    },
    
    // Debug options
    logging: {
      enabled: true as boolean,
      level: 'info' as 'info' | 'debug' | 'warn' | 'error',
    },
    
    // Hot reload settings
    hotReload: {
      enabled: true as boolean,
      debounceMs: 300,
    },
  },

  // Deployment settings
  deployment: {
    // Environment names
    environments: ['development', 'staging', 'production'],
    
    // Feature flags
    features: {
      analytics: true,
      monitoring: true,
      cacheOptimization: true,
      edgeOptimization: true,
    },
    
    // Resource limits
    resources: {
      maxMemoryMB: 512,
      maxExecutionTimeMs: 30000,
    },
  },

  // Service architecture limits
  architecture: {
    // Microservice guidelines
    serviceMaxLines: 500,
    serviceMaxFunctions: 20,
    functionMaxLines: 50,
    
    // Component guidelines
    componentMaxProps: 10,
    componentMaxLines: 300,
    
    // Utility guidelines
    utilMaxLines: 200,
    utilMaxComplexity: 10,
  },
} as const

// Export configuration type for type safety
export type Config = typeof config

// Environment-specific overrides
export const getEnvConfig = () => {
  const env = process.env.NODE_ENV || 'development'
  
  return {
    ...config,
    development: {
      ...config.development,
      logging: {
        enabled: env === 'development',
        level: env === 'development' ? 'debug' : 'info' as const,
      },
    },
  }
}

export default config