/**
 * Real-time Market Data API Endpoint
 * Edge-optimized for high-frequency market data delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { advancedCache } from '../../services/advancedCache';
import { performanceMonitorEnhanced } from '../../services/performanceMonitorEnhanced';
import { securityManager } from '../../services/securityManager';

export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
  maxDuration: 15,
  memory: 512,
  cache: 'max-age=5, s-maxage=30, stale-while-revalidate=5',
};

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
  const startTime = performance.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols')?.split(',').filter(Boolean) || SYMBOLS;
    const timeframe = searchParams.get('timeframe') || '1m';
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '100')));

    // Validate and sanitize symbols
    const sanitizedSymbols = symbols
      .map(s => securityManager.sanitizeInput(s.trim().toUpperCase(), 'symbol'))
      .filter(s => SYMBOLS.includes(s));

    if (sanitizedSymbols.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid symbols provided',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Check cache first (very short cache for real-time data)
    const cacheKey = `market_data_${sanitizedSymbols.join('_')}_${timeframe}_${limit}`;
    const cached = await advancedCache.get(cacheKey);
    
    if (cached) {
      const duration = performance.now() - startTime;
      performanceMonitorEnhanced.recordMetric('market_data_api_cache_hit', duration);
      
      return NextResponse.json(cached, {
        headers: {
          'X-Cache': 'HIT',
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'public, max-age=5, stale-while-revalidate=2',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
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

    const response = {
      success: true,
      data: marketData,
      metrics: marketMetrics,
      meta: {
        symbols: sanitizedSymbols,
        timeframe,
        limit,
        timestamp: Date.now(),
        dataSource: 'mock', // In production: 'twelve_data', 'yahoo', etc.
        region: process.env.VERCEL_REGION || 'unknown',
      },
    };

    // Cache for very short time (5 seconds) for real-time data
    await advancedCache.set(cacheKey, response, {
      ttl: 5 * 1000, // 5 seconds
      tags: ['market_data', 'realtime'],
      priority: 'high',
    });

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('market_data_api_get', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'public, max-age=5, stale-while-revalidate=2',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('market_data_api_error', duration);
    
    console.error('Market Data API GET error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch market data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

/**
 * POST /api/market-data - Subscribe to real-time market data updates
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const body = await request.json();
    const { symbols, webhook_url, subscription_type = 'realtime' } = body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Symbols array is required',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Validate and sanitize symbols
    const sanitizedSymbols = symbols
      .map(s => securityManager.sanitizeInput(s.trim().toUpperCase(), 'symbol'))
      .filter(s => SYMBOLS.includes(s));

    if (sanitizedSymbols.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid symbols provided',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Generate subscription ID
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // In production, this would set up WebSocket connections or webhooks
    const subscription = {
      id: subscriptionId,
      symbols: sanitizedSymbols,
      type: subscription_type,
      webhook_url: webhook_url ? securityManager.sanitizeInput(webhook_url, 'url') : null,
      created_at: new Date().toISOString(),
      status: 'active',
      region: process.env.VERCEL_REGION || 'unknown',
    };

    // Cache subscription
    await advancedCache.set(`subscription_${subscriptionId}`, subscription, {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      tags: ['subscription', 'market_data'],
      priority: 'medium',
    });

    const response = {
      success: true,
      data: subscription,
      message: 'Market data subscription created successfully',
    };

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('market_data_api_subscribe', duration);

    return NextResponse.json(response, {
      status: 201,
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'no-cache',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('market_data_api_subscribe_error', duration);
    
    console.error('Market Data API POST error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}

/**
 * OPTIONS /api/market-data - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}