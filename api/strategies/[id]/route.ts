/**
 * Individual Strategy API Endpoint
 * Handle operations for specific strategies by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { securityManager } from '../../../services/securityManager';
import { advancedCache } from '../../../services/advancedCache';
import { performanceMonitorEnhanced } from '../../../services/performanceMonitorEnhanced';

export const config = {
  runtime: 'edge',
};

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Strategy templates (same as in the main strategies endpoint)
const STRATEGY_TEMPLATES = [
  {
    id: 'ema_crossover',
    name: 'EMA Crossover',
    description: 'Exponential Moving Average crossover strategy',
    category: 'trend_following',
    difficulty: 'beginner',
    parameters: {
      fast_ema: { type: 'number', default: 12, min: 5, max: 50 },
      slow_ema: { type: 'number', default: 26, min: 20, max: 100 },
      signal_period: { type: 'number', default: 9, min: 5, max: 20 },
    },
    code_template: `// EMA Crossover Strategy
input int FastEMA = 12;
input int SlowEMA = 26;
input int SignalPeriod = 9;

// EMA calculations
double fastEMA = iMA(Symbol(), Period(), FastEMA, 0, MODE_EMA, PRICE_CLOSE, 0);
double slowEMA = iMA(Symbol(), Period(), SlowEMA, 0, MODE_EMA, PRICE_CLOSE, 0);

// Trading logic
if (fastEMA > slowEMA && fastEMA[1] <= slowEMA[1]) {
    // Buy signal
    OrderSend(Symbol(), OP_BUY, 0.1, Ask, 3, 0, 0, "EMA Crossover Buy", 0, 0, Green);
} else if (fastEMA < slowEMA && fastEMA[1] >= slowEMA[1]) {
    // Sell signal
    OrderSend(Symbol(), OP_SELL, 0.1, Bid, 3, 0, 0, "EMA Crossover Sell", 0, 0, Red);
}`,
  },
  {
    id: 'rsi_reversal',
    name: 'RSI Reversal',
    description: 'Relative Strength Index reversal strategy',
    category: 'mean_reversion',
    difficulty: 'intermediate',
    parameters: {
      rsi_period: { type: 'number', default: 14, min: 5, max: 30 },
      oversold: { type: 'number', default: 30, min: 10, max: 40 },
      overbought: { type: 'number', default: 70, min: 60, max: 90 },
    },
    code_template: `// RSI Reversal Strategy
input int RSIPeriod = 14;
input double OversoldLevel = 30.0;
input double OverboughtLevel = 70.0;

// RSI calculation
double rsi = iRSI(Symbol(), Period(), RSIPeriod, PRICE_CLOSE, 0);

// Trading logic
if (rsi < OversoldLevel && rsi[1] >= OversoldLevel) {
    // Buy signal - RSI crossing above oversold
    OrderSend(Symbol(), OP_BUY, 0.1, Ask, 3, 0, 0, "RSI Reversal Buy", 0, 0, Green);
} else if (rsi > OverboughtLevel && rsi[1] <= OverboughtLevel) {
    // Sell signal - RSI crossing below overbought
    OrderSend(Symbol(), OP_SELL, 0.1, Bid, 3, 0, 0, "RSI Reversal Sell", 0, 0, Red);
}`,
  },
  {
    id: 'bollinger_bands',
    name: 'Bollinger Bands Breakout',
    description: 'Bollinger Bands breakout strategy',
    category: 'volatility',
    difficulty: 'intermediate',
    parameters: {
      period: { type: 'number', default: 20, min: 10, max: 50 },
      deviation: { type: 'number', default: 2, min: 1, max: 3 },
    },
    code_template: `// Bollinger Bands Strategy
input int BBPeriod = 20;
input double BBDeviation = 2.0;

// Bollinger Bands calculations
double upperBand = iBands(Symbol(), Period(), BBPeriod, BBDeviation, 0, PRICE_CLOSE, MODE_UPPER, 0);
double lowerBand = iBands(Symbol(), Period(), BBPeriod, BBDeviation, 0, PRICE_CLOSE, MODE_LOWER, 0);
double middleBand = iBands(Symbol(), Period(), BBPeriod, BBDeviation, 0, PRICE_CLOSE, MODE_MAIN, 0);

// Trading logic
if (Close[0] > upperBand && Close[1] <= upperBand[1]) {
    // Breakout above upper band
    OrderSend(Symbol(), OP_BUY, 0.1, Ask, 3, lowerBand, 0, "BB Breakout Buy", 0, 0, Green);
} else if (Close[0] < lowerBand && Close[1] >= lowerBand[1]) {
    // Breakout below lower band
    OrderSend(Symbol(), OP_SELL, 0.1, Bid, 3, upperBand, 0, "BB Breakout Sell", 0, 0, Red);
}`,
  },
  {
    id: 'macd_strategy',
    name: 'MACD Strategy',
    description: 'Moving Average Convergence Divergence strategy',
    category: 'momentum',
    difficulty: 'advanced',
    parameters: {
      fast_ema: { type: 'number', default: 12, min: 5, max: 20 },
      slow_ema: { type: 'number', default: 26, min: 20, max: 40 },
      signal: { type: 'number', default: 9, min: 5, max: 15 },
    },
    code_template: `// MACD Strategy
input int FastEMA = 12;
input int SlowEMA = 26;
input int SignalPeriod = 9;

// MACD calculations
double macdMain = iMACD(Symbol(), Period(), FastEMA, SlowEMA, SignalPeriod, PRICE_CLOSE, MODE_MAIN, 0);
double macdSignal = iMACD(Symbol(), Period(), FastEMA, SlowEMA, SignalPeriod, PRICE_CLOSE, MODE_SIGNAL, 0);

// Trading logic
if (macdMain > macdSignal && macdMain[1] <= macdSignal[1]) {
    // MACD bullish crossover
    OrderSend(Symbol(), OP_BUY, 0.1, Ask, 3, 0, 0, "MACD Buy", 0, 0, Green);
} else if (macdMain < macdSignal && macdMain[1] >= macdSignal[1]) {
    // MACD bearish crossover
    OrderSend(Symbol(), OP_SELL, 0.1, Bid, 3, 0, 0, "MACD Sell", 0, 0, Red);
}`,
  },
];

/**
 * GET /api/strategies/[id] - Get a specific strategy by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const startTime = performance.now();
  
  try {
    const { id } = await context.params;
    
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid strategy ID',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Check cache first
    const cacheKey = `strategy_${id}`;
    const cached = await advancedCache.get(cacheKey);
    
    if (cached) {
      const duration = performance.now() - startTime;
      performanceMonitorEnhanced.recordMetric('strategy_api_cache_hit', duration);
      
      return NextResponse.json(cached, {
        headers: {
          'X-Cache': 'HIT',
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600',
        },
      });
    }

    // Find the strategy
    const strategy = STRATEGY_TEMPLATES.find(s => s.id === id);
    
    if (!strategy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Strategy not found',
        },
        { 
          status: 404,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
            'Cache-Control': 'no-cache',
          },
        }
      );
    }

    const response = {
      success: true,
      data: strategy,
    };

    // Cache the result
    await advancedCache.set(cacheKey, response, {
      ttl: 60 * 60 * 1000, // 1 hour
      tags: ['strategy', id],
      priority: 'medium',
    });

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('strategy_api_get', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('strategy_api_error', duration);
    
    console.error('Strategy API GET error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch strategy',
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
 * PUT /api/strategies/[id] - Update a strategy (only for custom strategies)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const startTime = performance.now();
  
  try {
    const { id } = await context.params;
    
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid strategy ID',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Check if it's a custom strategy (starts with 'custom_')
    if (!id.startsWith('custom_')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot update built-in strategy templates',
        },
        { 
          status: 403,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Sanitize input
    const sanitizedData = {
      name: body.name ? securityManager.sanitizeInput(body.name, 'text') : undefined,
      description: body.description ? securityManager.sanitizeInput(body.description, 'text') : undefined,
      category: body.category ? securityManager.sanitizeInput(body.category, 'text') : undefined,
      difficulty: body.difficulty || undefined,
      parameters: body.parameters || undefined,
      code_template: body.code_template ? securityManager.sanitizeInput(body.code_template, 'code') : undefined,
    };

    // In production, update in database
    // For now, just return success
    
    // Invalidate caches
    await advancedCache.delete(`strategy_${id}`);
    await advancedCache.clearByTags(['strategies', 'list']);

    const response = {
      success: true,
      data: {
        id,
        ...sanitizedData,
        updated_at: new Date().toISOString(),
      },
      message: 'Strategy updated successfully',
    };

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('strategy_api_update', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'no-cache',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('strategy_api_update_error', duration);
    
    console.error('Strategy API PUT error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update strategy',
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
 * DELETE /api/strategies/[id] - Delete a custom strategy
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const startTime = performance.now();
  
  try {
    const { id } = await context.params;
    
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid strategy ID',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Check if it's a custom strategy (starts with 'custom_')
    if (!id.startsWith('custom_')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete built-in strategy templates',
        },
        { 
          status: 403,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // In production, delete from database
    // For now, just return success
    
    // Invalidate caches
    await advancedCache.delete(`strategy_${id}`);
    await advancedCache.clearByTags(['strategies', 'list']);

    const response = {
      success: true,
      data: { deleted: true, id },
      message: 'Strategy deleted successfully',
    };

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('strategy_api_delete', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'no-cache',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('strategy_api_delete_error', duration);
    
    console.error('Strategy API DELETE error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete strategy',
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