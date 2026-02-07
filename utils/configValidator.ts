/**
 * Configuration Validation Utility
 * Comprehensive validation for all application configuration from environment variables
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: string;
}

export interface AppConfig {
  security: {
    encryptionKey: string;
    hasValidKey: boolean;
  };
  marketData: {
    symbols: Record<string, any>;
    timeouts: {
      cacheTTL: number;
      subscriptionTTL: number;
      healthCheckInterval: number;
    };
    limits: {
      maxSymbols: number;
      maxLimit: number;
      minVariation: number;
      maxVariation: number;
    };
    websockets: {
      binanceUrl: string;
      twelveDataUrl: string;
      reconnectInterval: number;
      maxReconnectAttempts: number;
    };
  };
  ai: {
    apiKey: string;
    hasValidKey: boolean;
  };
  supabase: {
    url?: string;
    anonKey?: string;
    hasValidConfig: boolean;
  };
}

/**
 * Get environment variable safely with fallback
 */
const getEnvVar = (key: string, fallback: string = ''): string => {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]) {
    return import.meta.env[key];
  }
  return fallback;
};

/**
 * Validate encryption key strength
 */
const validateEncryptionKey = (key: string): { isValid: boolean; message: string } => {
  if (!key || key.length < 16) {
    return {
      isValid: false,
      message: 'Encryption key must be at least 16 characters long'
    };
  }
  
  if (key.includes('dev_fallback') || key.includes('Dev_Fallback')) {
    return {
      isValid: false,
      message: 'Using development fallback encryption key - not secure for production'
    };
  }
  
  if (key.length < 32) {
    return {
      isValid: true,
      message: 'Encryption key is acceptable but longer keys (32+ chars) are recommended'
    };
  }
  
  return {
    isValid: true,
    message: 'Encryption key meets security requirements'
  };
};

/**
 * Validate API key format
 */
const validateApiKey = (apiKey: string, provider: string): { isValid: boolean; message: string } => {
  if (!apiKey || apiKey.length < 10) {
    return {
      isValid: false,
      message: `${provider} API key is missing or too short`
    };
  }
  
  // Check for placeholder patterns
  if (apiKey.includes('your_') || apiKey.includes('here') || apiKey.includes('example')) {
    return {
      isValid: false,
      message: `${provider} API key appears to be a placeholder`
    };
  }
  
  return {
    isValid: true,
    message: `${provider} API key format appears valid`
  };
};

/**
 * Validate WebSocket URL
 */
const validateWebSocketUrl = (url: string, provider: string): { isValid: boolean; message: string } => {
  if (!url) {
    return {
      isValid: false,
      message: `${provider} WebSocket URL is required`
    };
  }
  
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    return {
      isValid: false,
      message: `${provider} WebSocket URL must start with ws:// or wss://`
    };
  }
  
  return {
    isValid: true,
    message: `${provider} WebSocket URL format is valid`
  };
};

/**
 * Validate numeric configuration
 */
const validateNumber = (value: string, min: number, max: number, name: string): { isValid: boolean; message: string } => {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return {
      isValid: false,
      message: `${name} must be a valid number`
    };
  }
  
  if (num < min || num > max) {
    return {
      isValid: false,
      message: `${name} must be between ${min} and ${max}`
    };
  }
  
  return {
    isValid: true,
    message: `${name} is valid`
  };
};

/**
 * Load and validate all application configuration
 */
export const validateAppConfig = (): ValidationResult & { config: AppConfig } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Security Configuration
  const encryptionKey = getEnvVar('ENCRYPTION_KEY') || getEnvVar('VITE_ENCRYPTION_KEY');
  const encryptionValidation = validateEncryptionKey(encryptionKey);
  if (!encryptionValidation.isValid) {
    errors.push(encryptionValidation.message);
  }
  
  // AI Configuration
  const aiApiKey = getEnvVar('VITE_API_KEY');
  const aiValidation = validateApiKey(aiApiKey, 'Google Gemini');
  if (!aiValidation.isValid) {
    warnings.push(aiValidation.message);
  }
  
  // Supabase Configuration
  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
  const hasSupabase = supabaseUrl && supabaseAnonKey;
  
  if (!hasSupabase) {
    warnings.push('Supabase configuration missing - will use localStorage fallback');
  }
  
  // Market Data Configuration
  let marketSymbols = {};
  try {
    const symbolsConfig = getEnvVar('MARKET_SYMBOLS_CONFIG') || getEnvVar('VITE_MARKET_SYMBOLS_CONFIG');
    if (symbolsConfig) {
      marketSymbols = JSON.parse(symbolsConfig);
    }
  } catch (error) {
    warnings.push('Failed to parse market symbols configuration, using defaults');
  }
  
  // Validate market timeouts
  const marketCacheTTL = getEnvVar('MARKET_CACHE_TTL', '5000');
  const cacheValidation = validateNumber(marketCacheTTL, 1000, 300000, 'Market cache TTL');
  if (!cacheValidation.isValid) {
    errors.push(cacheValidation.message);
  }
  
  const marketSubscriptionTTL = getEnvVar('MARKET_SUBSCRIPTION_TTL', '86400000');
  const subscriptionValidation = validateNumber(marketSubscriptionTTL, 60000, 604800000, 'Market subscription TTL');
  if (!subscriptionValidation.isValid) {
    errors.push(subscriptionValidation.message);
  }
  
  // Validate WebSocket URLs
  const binanceWS = getEnvVar('MARKET_BINANCE_WS_URL', 'wss://stream.binance.com:9443/ws');
  const binanceValidation = validateWebSocketUrl(binanceWS, 'Binance');
  if (!binanceValidation.isValid) {
    errors.push(binanceValidation.message);
  }
  
  const twelveDataWS = getEnvVar('MARKET_TWELVEDATA_WS_URL', 'wss://ws.twelvedata.com/v1/quotes');
  const twelveDataValidation = validateWebSocketUrl(twelveDataWS, 'Twelve Data');
  if (!twelveDataValidation.isValid) {
    errors.push(twelveDataValidation.message);
  }
  
  // Build configuration object
  const config: AppConfig = {
    security: {
      encryptionKey,
      hasValidKey: encryptionValidation.isValid,
    },
    marketData: {
      symbols: marketSymbols,
      timeouts: {
        cacheTTL: parseInt(marketCacheTTL),
        subscriptionTTL: parseInt(marketSubscriptionTTL),
        healthCheckInterval: parseInt(getEnvVar('MARKET_HEALTH_CHECK_INTERVAL', '15000')),
      },
      limits: {
        maxSymbols: parseInt(getEnvVar('MARKET_MAX_SYMBOLS', '50')),
        maxLimit: parseInt(getEnvVar('MARKET_MAX_LIMIT', '1000')),
        minVariation: parseFloat(getEnvVar('MARKET_MIN_VARIATION', '0.0001')),
        maxVariation: parseFloat(getEnvVar('MARKET_MAX_VARIATION', '0.01')),
      },
      websockets: {
        binanceUrl: binanceWS,
        twelveDataUrl: twelveDataWS,
        reconnectInterval: parseInt(getEnvVar('MARKET_WS_RECONNECT_INTERVAL', '5000')),
        maxReconnectAttempts: parseInt(getEnvVar('MARKET_WS_MAX_RECONNECT_ATTEMPTS', '10')),
      },
    },
    ai: {
      apiKey: aiApiKey,
      hasValidKey: aiValidation.isValid,
    },
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      hasValidConfig: Boolean(hasSupabase),
    },
  };
  
  // Generate summary
  const isValid = errors.length === 0;
  let summary = '';
  
  if (isValid) {
    if (warnings.length === 0) {
      summary = 'All configuration is valid and complete';
    } else {
      summary = 'Configuration is valid but has some warnings';
    }
  } else {
    summary = 'Configuration has critical errors that must be fixed';
  }
  
  return {
    isValid,
    errors,
    warnings,
    summary,
    config,
  };
};

/**
 * Get configuration validation for specific section
 */
export const validateSecurityConfig = () => {
  const result = validateAppConfig();
  return {
    isValid: result.config.security.hasValidKey,
    errors: result.errors.filter(e => e.toLowerCase().includes('encryption')),
    warnings: result.warnings.filter(w => w.toLowerCase().includes('encryption')),
  };
};

export const validateMarketDataConfig = () => {
  const result = validateAppConfig();
  const marketErrors = result.errors.filter(e => 
    e.toLowerCase().includes('market') || 
    e.toLowerCase().includes('websocket') ||
    e.toLowerCase().includes('cache ttl')
  );
  const marketWarnings = result.warnings.filter(w => 
    w.toLowerCase().includes('market') || 
    w.toLowerCase().includes('symbols')
  );
  
  return {
    isValid: marketErrors.length === 0,
    errors: marketErrors,
    warnings: marketWarnings,
  };
};

/**
 * Runtime configuration check (for startup validation)
 */
export const performStartupValidation = (): void => {
  const validation = validateAppConfig();
  
  if (!validation.isValid) {
    console.error('❌ Configuration validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    
    if (validation.errors.some(e => e.includes('encryption'))) {
      console.error('🔒 Critical: Invalid encryption configuration - application may be insecure');
    }
    
    throw new Error('Application configuration is invalid. Please check environment variables.');
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  console.log('✅ Configuration validation passed:', validation.summary);
  
  // Log non-sensitive configuration summary
  console.log('📋 Configuration Summary:');
  console.log(`  - Security: ${validation.config.security.hasValidKey ? '✅' : '❌'}`);
  console.log(`  - AI Service: ${validation.config.ai.hasValidKey ? '✅' : '⚠️'}`);
  console.log(`  - Database: ${validation.config.supabase.hasValidConfig ? '✅ (Supabase)' : '⚠️ (LocalStorage)'}`);
  console.log(`  - Market Symbols: ${Object.keys(validation.config.marketData.symbols).length} configured`);
  console.log(`  - Market Cache TTL: ${validation.config.marketData.timeouts.cacheTTL}ms`);
};