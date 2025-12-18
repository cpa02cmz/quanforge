/**
 * Centralized Configuration System
 * 
 * This configuration system provides environment-based settings with fallbacks
 * for all hardcoded values throughout the application.
 */

// Configuration interfaces for type safety
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
  jitter: boolean;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
}

export interface SecurityConfig {
  maxPayloadSize: number;
  allowedOrigins: string[];
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
  batchSize: number;
  cacheTTL: number;
  connectionTimeout: number;
  requestTimeout: number;
}

export interface DatabaseConfig {
  retryConfig: RetryConfig;
  cacheConfig: CacheConfig;
  performanceConfig: PerformanceConfig;
}

/**
 * Environment variable helper with type safety and fallbacks
 */
function getEnvVar<T>(key: string, fallback: T, parser?: (value: string) => T): T {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const value = import.meta.env[key];
    if (value !== undefined) {
      try {
        return parser ? parser(value) : (value as unknown as T);
      } catch (error) {
        console.warn(`Failed to parse environment variable ${key}:`, error);
        return fallback;
      }
    }
  }
  
  // Fallback to process.env for SSR/Node environments
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key];
    if (value !== undefined) {
      try {
        return parser ? parser(value) : (value as unknown as T);
      } catch (error) {
        console.warn(`Failed to parse environment variable ${key}:`, error);
        return fallback;
      }
    }
  }
  
  return fallback;
}

/**
 * Parse numeric environment variables with validation
 */
function parseNumber(value: string, min?: number, max?: number): number {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Invalid number: ${value}`);
  }
  if (min !== undefined && num < min) {
    throw new Error(`Number ${num} is below minimum ${min}`);
  }
  if (max !== undefined && num > max) {
    throw new Error(`Number ${num} is above maximum ${max}`);
  }
  return num;
}

function parseBoolean(value: string): boolean {
  return value.toLowerCase() === 'true';
}

function parseArray(value: string): string[] {
  try {
    return JSON.parse(value);
  } catch {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

/**
 * Retry Configuration
 */
export const retryConfig: RetryConfig = {
  maxRetries: getEnvVar('VITE_MAX_RETRIES', 5, (v) => parseNumber(v, 1, 10)),
  retryDelay: getEnvVar('VITE_RETRY_DELAY', 500, (v) => parseNumber(v, 100, 10000)),
  backoffMultiplier: getEnvVar('VITE_BACKOFF_MULTIPLIER', 1.5, (v) => parseFloat(v)),
  maxDelay: getEnvVar('VITE_MAX_DELAY', 10000, (v) => parseNumber(v, 1000, 60000)),
  jitter: getEnvVar('VITE_RETRY_JITTER', true, parseBoolean),
};

/**
 * Cache Configuration
 */
export const cacheConfig: CacheConfig = {
  ttl: getEnvVar('VITE_CACHE_TTL', 15 * 60 * 1000, (v) => parseNumber(v, 1000, 24 * 60 * 60 * 1000)), // 15 minutes default
  maxSize: getEnvVar('VITE_CACHE_MAX_SIZE', 200, (v) => parseNumber(v, 10, 10000)),
};

/**
 * Security Configuration
 */
export const securityConfig: SecurityConfig = {
  maxPayloadSize: getEnvVar('VITE_MAX_PAYLOAD_SIZE', 5 * 1024 * 1024, (v) => parseNumber(v, 1024, 100 * 1024 * 1024)), // 5MB default
  allowedOrigins: getEnvVar<string[]>('VITE_ALLOWED_ORIGINS', ['https://quanforge.ai', 'https://www.quanforge.ai', 'http://localhost:3000', 'http://localhost:5173'], parseArray),
  rateLimiting: {
    windowMs: getEnvVar('VITE_RATE_LIMIT_WINDOW', 60000, (v) => parseNumber(v, 1000, 3600000)), // 1 minute default
    maxRequests: getEnvVar('VITE_RATE_LIMIT_MAX', 100, (v) => parseNumber(v, 10, 1000)),
  },
  encryption: {
    algorithm: getEnvVar('VITE_ENCRYPTION_ALGORITHM', 'AES-256-GCM'),
    keyRotationInterval: getEnvVar('VITE_KEY_ROTATION_INTERVAL', 43200000, (v) => parseNumber(v, 3600000, 604800000)), // 12 hours default
  },
  edgeRateLimiting: {
    enabled: getEnvVar('VITE_EDGE_RATE_LIMITING', true, parseBoolean),
    requestsPerSecond: getEnvVar('VITE_EDGE_RPS', 10, (v) => parseNumber(v, 1, 100)),
    burstLimit: getEnvVar('VITE_EDGE_BURST_LIMIT', 20, (v) => parseNumber(v, 5, 200)),
  },
  regionBlocking: {
    enabled: getEnvVar('VITE_REGION_BLOCKING', true, parseBoolean),
    blockedRegions: getEnvVar<string[]>('VITE_BLOCKED_REGIONS', ['CN', 'RU', 'IR', 'KP'], parseArray),
  },
  botDetection: {
    enabled: getEnvVar('VITE_BOT_DETECTION', true, parseBoolean),
    suspiciousPatterns: getEnvVar<string[]>('VITE_SUSPICIOUS_PATTERNS', [
      'sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster', 
      'wfuzz', 'burp', 'owasp', 'scanner', 'bot', 'crawler', 'spider'
    ], parseArray),
  },
};

/**
 * Performance Configuration
 */
export const performanceConfig: PerformanceConfig = {
  batchSize: getEnvVar('VITE_BATCH_SIZE', 10, (v) => parseNumber(v, 1, 100)),
  cacheTTL: getEnvVar('VITE_PERF_CACHE_TTL', 5 * 60 * 1000, (v) => parseNumber(v, 1000, 3600000)), // 5 minutes default
  connectionTimeout: getEnvVar('VITE_CONNECTION_TIMEOUT', 10000, (v) => parseNumber(v, 1000, 60000)), // 10 seconds default
  requestTimeout: getEnvVar('VITE_REQUEST_TIMEOUT', 30000, (v) => parseNumber(v, 5000, 300000)), // 30 seconds default
};

/**
 * Database Configuration
 */
export const databaseConfig: DatabaseConfig = {
  retryConfig,
  cacheConfig,
  performanceConfig,
};

/**
 * Specialized cache configurations for different use cases
 */
export const cacheConfigs = {
  robots: {
    ttl: getEnvVar('VITE_ROBOTS_CACHE_TTL', 600000, (v) => parseNumber(v, 60000, 3600000)), // 10 minutes
    maxSize: getEnvVar('VITE_ROBOTS_CACHE_MAX_SIZE', 50 * 1024 * 1024, (v) => parseNumber(v, 1024 * 1024, 1024 * 1024 * 1024)), // 50MB
  },
  marketData: {
    ttl: getEnvVar('VITE_MARKET_DATA_CACHE_TTL', 30000, (v) => parseNumber(v, 5000, 300000)), // 30 seconds
    maxSize: getEnvVar('VITE_MARKET_DATA_CACHE_MAX_SIZE', 20 * 1024 * 1024, (v) => parseNumber(v, 1024 * 1024, 512 * 1024 * 1024)), // 20MB
  },
  analysis: {
    ttl: getEnvVar('VITE_ANALYSIS_CACHE_TTL', 900000, (v) => parseNumber(v, 60000, 7200000)), // 15 minutes
    maxSize: getEnvVar('VITE_ANALYSIS_CACHE_MAX_SIZE', 30 * 1024 * 1024, (v) => parseNumber(v, 1024 * 1024, 1024 * 1024 * 1024)), // 30MB
  },
  aiResponses: {
    ttl: getEnvVar('VITE_AI_RESPONSES_CACHE_TTL', 900000, (v) => parseNumber(v, 300000, 3600000)), // 15 minutes
    maxSize: getEnvVar('VITE_AI_RESPONSES_CACHE_MAX_SIZE', 200, (v) => parseNumber(v, 50, 1000)),
  },
  static: {
    ttl: getEnvVar('VITE_STATIC_CACHE_TTL', 3600000, (v) => parseNumber(v, 1800000, 24 * 60 * 60 * 1000)), // 1 hour
    maxSize: getEnvVar('VITE_STATIC_CACHE_MAX_SIZE', 20 * 1024 * 1024, (v) => parseNumber(v, 1024 * 1024, 1024 * 1024 * 1024)), // 20MB
  },
};

/**
 * Environment validation
 */
export function validateConfiguration(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate retry configuration
  if (retryConfig.maxDelay < retryConfig.retryDelay) {
    errors.push('MAX_DELAY must be greater than or equal to RETRY_DELAY');
  }
  
  // Validate security configuration
  if (securityConfig.rateLimiting.maxRequests <= 0) {
    errors.push('RATE_LIMIT_MAX must be greater than 0');
  }
  
  if (securityConfig.allowedOrigins.length === 0) {
    errors.push('ALLOWED_ORIGINS cannot be empty');
  }
  
  // Validate cache configuration
  if (cacheConfig.ttl <= 0) {
    errors.push('CACHE_TTL must be greater than 0');
  }
  
  if (cacheConfig.maxSize <= 0) {
    errors.push('CACHE_MAX_SIZE must be greater than 0');
  }
  
  // Validate performance configuration
  if (performanceConfig.batchSize <= 0) {
    errors.push('BATCH_SIZE must be greater than 0');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Logger for configuration issues
 */
export const configLogger = {
  logConfigIssues: () => {
    const validation = validateConfiguration();
    if (!validation.isValid) {
      console.error('Configuration validation failed:');
      validation.errors.forEach(error => console.error(`- ${error}`));
    }
    
    // Log current configuration in development
    if (getEnvVar('MODE', 'development') === 'development') {
      console.log('Current configuration:', {
        retry: retryConfig,
        cache: cacheConfig,
        security: {
          maxPayloadSize: securityConfig.maxPayloadSize,
          rateLimiting: securityConfig.rateLimiting,
        },
        performance: performanceConfig,
      });
    }
  },
};

// Initialize configuration validation
configLogger.logConfigIssues();