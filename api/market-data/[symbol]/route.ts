/**
 * Individual Symbol Market Data API Endpoint
 * Real-time data for specific trading symbols
 */

import { NextRequest } from 'next/server';
import { securityManager } from '../../../services/securityManager';
import {
  edgeConfig,
  handleGetRequest,
  handlePostRequest,
  handleCORS,
  RouteContext,
  validateRouteParam,
  APIError,
} from '../../../utils/apiShared';

export const config = edgeConfig;

// Available symbols and their base prices
const SYMBOLS: Record<string, { basePrice: number; pipValue: number }> = {
  'EURUSD': { basePrice: 1.0850, pipValue: 0.0001 },
  'GBPUSD': { basePrice: 1.2750, pipValue: 0.0001 },
  'USDJPY': { basePrice: 157.50, pipValue: 0.01 },
  'USDCHF': { basePrice: 0.9050, pipValue: 0.0001 },
  'AUDUSD': { basePrice: 0.6650, pipValue: 0.0001 },
  'USDCAD': { basePrice: 1.3650, pipValue: 0.0001 },
  'EURGBP': { basePrice: 0.8510, pipValue: 0.0001 },
  'EURJPY': { basePrice: 171.00, pipValue: 0.01 },
  'GBPJPY': { basePrice: 200.50, pipValue: 0.01 },
  'EURCHF': { basePrice: 0.9820, pipValue: 0.0001 },
  'AUDJPY': { basePrice: 104.80, pipValue: 0.01 },
  'CADJPY': { basePrice: 115.40, pipValue: 0.01 },
};

const generateSymbolData = (symbol: string, timeframe: string = '1m') => {
  const symbolConfig = SYMBOLS[symbol];
  if (!symbolConfig) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  const { basePrice, pipValue } = symbolConfig;
  const variation = (Math.random() - 0.5) * 0.002; // ±0.2% variation
  const price = basePrice * (1 + variation);
  const spread = pipValue * (1 + Math.random()); // 1-2 pips spread
  
  // Generate historical data based on timeframe
  const periods: Record<string, number> = {
    '1m': 60,
    '5m': 12,
    '15m': 4,
    '1h': 1,
    '4h': 0.25,
    '1d': 0.0625,
  };

  const periodCount = periods[timeframe] || 60;
  const historicalData = [];

  for (let i = periodCount; i >= 0; i--) {
    const timeOffset = i * 60000; // minutes in milliseconds
    const historicalVariation = (Math.random() - 0.5) * 0.001;
    const historicalPrice = basePrice * (1 + historicalVariation);
    
    historicalData.push({
      timestamp: Date.now() - timeOffset,
      open: parseFloat((historicalPrice * (1 - Math.random() * 0.0005)).toFixed(5)),
      high: parseFloat((historicalPrice * (1 + Math.random() * 0.001)).toFixed(5)),
      low: parseFloat((historicalPrice * (1 - Math.random() * 0.001)).toFixed(5)),
      close: parseFloat((historicalPrice * (1 + (Math.random() - 0.5) * 0.0005)).toFixed(5)),
      volume: Math.floor(Math.random() * 100000) + 10000,
    });
  }

  return {
    symbol,
    timestamp: Date.now(),
    bid: parseFloat((price - spread / 2).toFixed(5)),
    ask: parseFloat((price + spread / 2).toFixed(5)),
    mid: parseFloat(price.toFixed(5)),
    spread: parseFloat(spread.toFixed(5)),
    change: parseFloat(variation.toFixed(5)),
    changePercent: parseFloat((variation * 100).toFixed(3)),
    volume: Math.floor(Math.random() * 1000000) + 100000,
    high: parseFloat((price * 1.001).toFixed(5)),
    low: parseFloat((price * 0.999).toFixed(5)),
    open: parseFloat((price * (1 - variation * 0.5)).toFixed(5)),
    timeframe,
    historical: historicalData,
    technical: {
      sma_20: parseFloat((basePrice * (1 + (Math.random() - 0.5) * 0.001)).toFixed(5)),
      ema_12: parseFloat((basePrice * (1 + (Math.random() - 0.5) * 0.0008)).toFixed(5)),
      ema_26: parseFloat((basePrice * (1 + (Math.random() - 0.5) * 0.0012)).toFixed(5)),
      rsi: parseFloat((Math.random() * 100).toFixed(2)),
      macd: {
        main: parseFloat(((Math.random() - 0.5) * 0.001).toFixed(5)),
        signal: parseFloat(((Math.random() - 0.5) * 0.0008).toFixed(5)),
        histogram: parseFloat(((Math.random() - 0.5) * 0.0005).toFixed(5)),
      },
      bollinger: {
        upper: parseFloat((price * 1.002).toFixed(5)),
        middle: parseFloat(price.toFixed(5)),
        lower: parseFloat((price * 0.998).toFixed(5)),
      },
    },
  };
};

/**
 * GET /api/market-data/[symbol] - Get real-time data for a specific symbol
 */
export async function GET(request: NextRequest, context: RouteContext) {
  return handleGetRequest(request, async (params) => {
    const { symbol } = await context.params;
    const { timeframe, includeTechnical } = params;

    // Validate and sanitize symbol
    const sanitizedSymbol = securityManager.sanitizeInput(symbol.trim().toUpperCase(), 'symbol' as any);
    
    if (!sanitizedSymbol || !SYMBOLS[sanitizedSymbol]) {
      throw new APIError('Invalid symbol', 400, { availableSymbols: Object.keys(SYMBOLS) });
    }

    // Generate symbol data
    const symbolData = generateSymbolData(sanitizedSymbol, timeframe);

    // Remove technical data if not requested
    if (!includeTechnical) {
      delete symbolData.technical;
    }

    return {
      success: true,
      data: symbolData,
      meta: {
        symbol: sanitizedSymbol,
        timeframe,
        includeTechnical,
        timestamp: Date.now(),
        dataSource: 'mock',
        region: process.env['VERCEL_REGION'] || 'unknown',
      },
    };
  }, {
    key: 'symbol_data',
    ttl: 3 * 1000, // 3 seconds for real-time data
    tags: ['symbol_data'],
  });
}

/**
 * POST /api/market-data/[symbol] - Create subscription for specific symbol
 */
export async function POST(request: NextRequest, context: RouteContext) {
  return handlePostRequest(request, async (data, params) => {
    const { symbol } = await context.params;
    const { webhook_url, alert_conditions = [] } = data;

    // Validate and sanitize symbol
    const sanitizedSymbol = securityManager.sanitizeInput(symbol.trim().toUpperCase(), 'symbol' as any);
    
    if (!sanitizedSymbol || !SYMBOLS[sanitizedSymbol]) {
      throw new APIError('Invalid symbol', 400, { availableSymbols: Object.keys(SYMBOLS) });
    }

    // Generate subscription ID
    const subscriptionId = `sub_${sanitizedSymbol}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Validate alert conditions
    const sanitizedConditions = alert_conditions.map((condition: any) => ({
      type: securityManager.sanitizeInput(condition.type, 'text'),
      operator: securityManager.sanitizeInput(condition.operator, 'text'),
      value: parseFloat(condition.value),
      enabled: Boolean(condition.enabled),
    }));

    const subscription = {
      id: subscriptionId,
      symbol: sanitizedSymbol,
      webhook_url: webhook_url ? securityManager.sanitizeInput(webhook_url, 'url') : null,
      alert_conditions: sanitizedConditions,
      created_at: new Date().toISOString(),
      status: 'active',
      region: process.env['VERCEL_REGION'] || 'unknown',
    };

    return {
      success: true,
      data: subscription,
      message: `Subscription created for ${sanitizedSymbol}`,
    };
  });
}

/**
 * OPTIONS /api/market-data/[symbol] - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return handleCORS();
}