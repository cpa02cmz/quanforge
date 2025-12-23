/**
 * Real-time Market Data API Endpoint
 * Edge-optimized for high-frequency market data delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { robotCache } from '../../services/advancedCache';
import { performanceMonitorEnhanced } from '../../services/performanceMonitorEnhanced';
import { securityManager } from '../../services/securityManager';
import { getMarketDataConfig } from '../../utils/marketConfig';

export const config = {
  runtime: 'edge',
  maxDuration: 15,
  memory: 512,
  cache: 'max-age=5, s-maxage=30, stale-while-revalidate=5',
};

// Load market data configuration
const marketConfig = getMarketDataConfig();
const SYMBOLS = Object.keys(marketConfig.symbols);

const generateMarketData = (symbol: string) => {
  const symbolConfig = marketConfig.symbols[symbol];
  if (!symbolConfig) {
    console.warn(`Unknown symbol: ${symbol}, using fallback`);
    return {
      symbol,
      timestamp: Date.now(),
      bid: 1.0000,
      ask: 1.0001,
      mid: 1.0000,
      spread: 0.0001,
      change: 0.0000,
      changePercent: 0.000,
      volume: 100000,
      high: 1.0010,
      low: 0.9990,
      open: 1.0000,
    };
  }

  const { basePrice, pipValue } = symbolConfig;

  const variation = (Math.random() - 0.5) * marketConfig.limits.maxVariation; // Use configured variation
  const price = basePrice * (1 + variation);
  const spread = pipValue * (1 + Math.random()); // 1-2 pips spread
  
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
    const cached = await robotCache.get(cacheKey);
    
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

    // Cache for configurable time using market config
    await robotCache.set(cacheKey, response, {
      ttl: marketConfig.timeouts.cacheTTL,
      tags: ['market_data', 'realtime'],
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
    await robotCache.set(`subscription_${subscriptionId}`, subscription, {
      ttl: marketConfig.timeouts.subscriptionTTL,
      tags: ['subscription', 'market_data'],
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