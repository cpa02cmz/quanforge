/**
 * Real-time Market Data API Endpoint
 * Edge-optimized for high-frequency market data delivery
 */

import { NextRequest } from 'next/server';
import { securityManager } from '../../services/securityManager';
import {
  edgeConfig,
  handleGetRequest,
  handlePostRequest,
  handleCORS,
  sanitizeArray,
  createCORSResponse,
  APIError,
} from '../../utils/apiShared';

export const config = edgeConfig;

// Mock market data (in production, this would come from a real market data provider)
const SYMBOLS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY', 'CADJPY'
];

const generateMarketData = (symbol: string) => {
  const basePrice = {
    'EURUSD': 1.0850,
    'GBPUSD': 1.2750,
    'USDJPY': 157.50,
    'USDCHF': 0.9050,
    'AUDUSD': 0.6650,
    'USDCAD': 1.3650,
    'EURGBP': 0.8510,
    'EURJPY': 171.00,
    'GBPJPY': 200.50,
    'EURCHF': 0.9820,
    'AUDJPY': 104.80,
    'CADJPY': 115.40,
  }[symbol] || 1.0000;

  const variation = (Math.random() - 0.5) * 0.002; // ±0.2% variation
  const price = basePrice * (1 + variation);
  const spread = basePrice * 0.0001; // 1 pip spread
  
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
  };
};

/**
 * GET /api/market-data - Get real-time market data
 */
export async function GET(request: NextRequest) {
  return handleGetRequest(request, async (params) => {
    const { symbols: requestedSymbols, timeframe, limit } = params;
    
    const symbols = requestedSymbols || SYMBOLS;
    
    // Validate and sanitize symbols
    const sanitizedSymbols = sanitizeArray(symbols, 'text')
      .filter(s => SYMBOLS.includes(s));
    
    if (sanitizedSymbols.length === 0) {
      throw new APIError('No valid symbols provided', 400);
    }

    // Generate market data for each symbol
    const marketData = sanitizedSymbols.map(symbol => generateMarketData(symbol));

    // Calculate additional metrics
    const marketMetrics = {
      totalVolume: marketData.reduce((sum, data) => sum + data.volume, 0),
      avgSpread: marketData.reduce((sum, data) => sum + data.spread, 0) / marketData.length,
      mostVolatile: marketData.reduce((max, data) => 
        Math.abs(data.changePercent) > Math.abs(max.changePercent) ? data : max
      ),
      leastVolatile: marketData.reduce((min, data) => 
        Math.abs(data.changePercent) < Math.abs(min.changePercent) ? data : min
      ),
    };

    return {
      success: true,
      data: marketData,
      metrics: marketMetrics,
      meta: {
        symbols: sanitizedSymbols,
        timeframe,
        limit,
        timestamp: Date.now(),
        dataSource: 'mock', // In production: 'twelve_data', 'yahoo', etc.
        region: process.env['VERCEL_REGION'] || 'unknown',
      },
    };
  }, {
    key: 'market_data',
    ttl: 5 * 1000, // 5 seconds for real-time data
    tags: ['market_data', 'realtime'],
  });
}

/**
 * POST /api/market-data - Subscribe to real-time market data updates
 */
export async function POST(request: NextRequest) {
  return handlePostRequest(request, async (data, params) => {
    const { symbols, webhook_url, subscription_type = 'realtime' } = data;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      throw new APIError('Symbols array is required', 400);
    }

    // Validate and sanitize symbols
    const sanitizedSymbols = sanitizeArray(symbols, 'text')
      .filter(s => SYMBOLS.includes(s));

    if (sanitizedSymbols.length === 0) {
      throw new APIError('No valid symbols provided', 400);
    }

    // Generate subscription ID
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // In production, this would set up WebSocket connections or webhooks
    const subscription = {
      id: subscriptionId,
      symbols: sanitizedSymbols,
      type: subscription_type,
      webhook_url: webhook_url ? securityManager.sanitizeInput(webhook_url, 'url') : null,
      created_at: new Date().toISOString(),
      status: 'active',
      region: process.env['VERCEL_REGION'] || 'unknown',
    };

    return {
      success: true,
      data: subscription,
      message: 'Market data subscription created successfully',
    };
  });
}

/**
 * OPTIONS /api/market-data - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return handleCORS();
}