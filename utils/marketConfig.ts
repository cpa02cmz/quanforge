/**
 * Market Data Configuration
 * Centralized configuration for market data symbols, prices, and settings
 */

export interface MarketSymbol {
  symbol: string;
  basePrice: number;
  pipValue: number;
  description?: string;
}

export interface MarketDataConfig {
  symbols: Record<string, MarketSymbol>;
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
}

// Default configuration for development
const defaultMarketConfig: MarketDataConfig = {
  symbols: {
    'EURUSD': { symbol: 'EURUSD', basePrice: 1.0850, pipValue: 0.0001, description: 'Euro/US Dollar' },
    'GBPUSD': { symbol: 'GBPUSD', basePrice: 1.2750, pipValue: 0.0001, description: 'British Pound/US Dollar' },
    'USDJPY': { symbol: 'USDJPY', basePrice: 157.50, pipValue: 0.01, description: 'US Dollar/Japanese Yen' },
    'USDCHF': { symbol: 'USDCHF', basePrice: 0.9050, pipValue: 0.0001, description: 'US Dollar/Swiss Franc' },
    'AUDUSD': { symbol: 'AUDUSD', basePrice: 0.6650, pipValue: 0.0001, description: 'Australian Dollar/US Dollar' },
    'USDCAD': { symbol: 'USDCAD', basePrice: 1.3650, pipValue: 0.0001, description: 'US Dollar/Canadian Dollar' },
    'EURGBP': { symbol: 'EURGBP', basePrice: 0.8510, pipValue: 0.0001, description: 'Euro/British Pound' },
    'EURJPY': { symbol: 'EURJPY', basePrice: 171.00, pipValue: 0.01, description: 'Euro/Japanese Yen' },
    'GBPJPY': { symbol: 'GBPJPY', basePrice: 200.50, pipValue: 0.01, description: 'British Pound/Japanese Yen' },
    'EURCHF': { symbol: 'EURCHF', basePrice: 0.9820, pipValue: 0.0001, description: 'Euro/Swiss Franc' },
    'AUDJPY': { symbol: 'AUDJPY', basePrice: 104.80, pipValue: 0.01, description: 'Australian Dollar/Japanese Yen' },
    'CADJPY': { symbol: 'CADJPY', basePrice: 115.40, pipValue: 0.01, description: 'Canadian Dollar/Japanese Yen' },
  },
  timeouts: {
    cacheTTL: 5000, // 5 seconds
    subscriptionTTL: 24 * 60 * 60 * 1000, // 24 hours
    healthCheckInterval: 15000, // 15 seconds
  },
  limits: {
    maxSymbols: 50,
    maxLimit: 1000,
    minVariation: 0.0001,
    maxVariation: 0.01,
  },
  websockets: {
    binanceUrl: 'wss://stream.binance.com:9443/ws',
    twelveDataUrl: 'wss://ws.twelvedata.com/v1/quotes',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
  },
};

// Parse JSON from environment variable with fallback
const parseEnvJSON = <T>(envKey: string, fallback: T): T => {
  try {
    const envValue = typeof process !== 'undefined' 
      ? process.env?.[envKey] 
      : (typeof import.meta !== 'undefined' ? import.meta.env?.[envKey] : null);
    
    if (envValue) {
      return JSON.parse(envValue) as T;
    }
  } catch (error) {
    console.warn(`Failed to parse ${envKey} from environment, using fallback:`, error);
  }
  return fallback;
};

// Get number from environment with fallback
const getEnvNumber = (envKey: string, fallback: number): number => {
  try {
    const envValue = typeof process !== 'undefined' 
      ? process.env?.[envKey] 
      : (typeof import.meta !== 'undefined' ? import.meta.env?.[envKey] : null);
    
    if (envValue) {
      const parsed = parseFloat(envValue);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn(`Failed to parse ${envKey} from environment, using fallback:`, error);
  }
  return fallback;
};

// Get string from environment with fallback
const getEnvString = (envKey: string, fallback: string): string => {
  try {
    const envValue = typeof process !== 'undefined' 
      ? process.env?.[envKey] 
      : (typeof import.meta !== 'undefined' ? import.meta.env?.[envKey] : null);
    
    if (envValue) {
      return envValue;
    }
  } catch (error) {
    console.warn(`Failed to get ${envKey} from environment, using fallback:`, error);
  }
  return fallback;
};

/**
 * Get market data configuration from environment or use defaults
 */
export const getMarketDataConfig = (): MarketDataConfig => {
  return {
    symbols: parseEnvJSON('MARKET_SYMBOLS_CONFIG', defaultMarketConfig.symbols),
    timeouts: {
      cacheTTL: getEnvNumber('MARKET_CACHE_TTL', defaultMarketConfig.timeouts.cacheTTL),
      subscriptionTTL: getEnvNumber('MARKET_SUBSCRIPTION_TTL', defaultMarketConfig.timeouts.subscriptionTTL),
      healthCheckInterval: getEnvNumber('MARKET_HEALTH_CHECK_INTERVAL', defaultMarketConfig.timeouts.healthCheckInterval),
    },
    limits: {
      maxSymbols: getEnvNumber('MARKET_MAX_SYMBOLS', defaultMarketConfig.limits.maxSymbols),
      maxLimit: getEnvNumber('MARKET_MAX_LIMIT', defaultMarketConfig.limits.maxLimit),
      minVariation: getEnvNumber('MARKET_MIN_VARIATION', defaultMarketConfig.limits.minVariation),
      maxVariation: getEnvNumber('MARKET_MAX_VARIATION', defaultMarketConfig.limits.maxVariation),
    },
    websockets: {
      binanceUrl: getEnvString('MARKET_BINANCE_WS_URL', defaultMarketConfig.websockets.binanceUrl),
      twelveDataUrl: getEnvString('MARKET_TWELVEDATA_WS_URL', defaultMarketConfig.websockets.twelveDataUrl),
      reconnectInterval: getEnvNumber('MARKET_WS_RECONNECT_INTERVAL', defaultMarketConfig.websockets.reconnectInterval),
      maxReconnectAttempts: getEnvNumber('MARKET_WS_MAX_RECONNECT_ATTEMPTS', defaultMarketConfig.websockets.maxReconnectAttempts),
    },
  };
};

/**
 * Validate market data configuration
 */
export const validateMarketDataConfig = (config: MarketDataConfig): string[] => {
  const errors: string[] = [];
  
  // Validate symbols
  if (!config.symbols || Object.keys(config.symbols).length === 0) {
    errors.push('At least one market symbol must be configured');
  }
  
  Object.entries(config.symbols).forEach(([symbol, symbolConfig]) => {
    if (!symbolConfig.symbol) {
      errors.push(`Symbol ${symbol} missing symbol field`);
    }
    if (!symbolConfig.basePrice || symbolConfig.basePrice <= 0) {
      errors.push(`Symbol ${symbol} has invalid base price`);
    }
    if (!symbolConfig.pipValue || symbolConfig.pipValue <= 0) {
      errors.push(`Symbol ${symbol} has invalid pip value`);
    }
  });
  
  // Validate timeouts
  if (config.timeouts.cacheTTL <= 0) {
    errors.push('Cache TTL must be positive');
  }
  if (config.timeouts.subscriptionTTL <= 0) {
    errors.push('Subscription TTL must be positive');
  }
  
  // Validate limits
  if (config.limits.maxSymbols <= 0) {
    errors.push('Max symbols must be positive');
  }
  if (config.limits.maxLimit <= 0) {
    errors.push('Max limit must be positive');
  }
  
  // Validate websockets
  if (!config.websockets.binanceUrl.startsWith('wss://') && !config.websockets.binanceUrl.startsWith('ws://')) {
    errors.push('Binance WebSocket URL must start with ws:// or wss://');
  }
  if (!config.websockets.twelveDataUrl.startsWith('wss://') && !config.websockets.twelveDataUrl.startsWith('ws://')) {
    errors.push('Twelve Data WebSocket URL must start with ws:// or wss://');
  }
  
  return errors;
};

// Export the default configuration for reference
export { defaultMarketConfig };