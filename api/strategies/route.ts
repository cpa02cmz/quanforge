/**
 * Strategies API Endpoint
 * Manage trading strategy templates and configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { securityManager } from '../../services/securityManager';
import { advancedCache } from '../../services/advancedCache';
import { performanceMonitorEnhanced } from '../../services/performanceMonitorEnhanced';

export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
  maxDuration: 15,
  memory: 512,
  cache: 'max-age=300, s-maxage=900, stale-while-revalidate=300',
};

// Strategy templates (in production, these would come from a database)
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
 * GET /api/strategies - List all available strategy templates
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const search = searchParams.get('search');

    // Check cache first
    const cacheKey = `strategies_list_${category || 'all'}_${difficulty || 'all'}_${search || ''}`;
    const cached = await advancedCache.get(cacheKey);
    
    if (cached) {
      const duration = performance.now() - startTime;
      performanceMonitorEnhanced.recordMetric('strategies_api_cache_hit', duration);
      
      return NextResponse.json(cached, {
        headers: {
          'X-Cache': 'HIT',
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'public, max-age=1800, stale-while-revalidate=300',
        },
      });
    }

    let filteredStrategies = [...STRATEGY_TEMPLATES];

    // Apply filters
    if (category && category !== 'all') {
      filteredStrategies = filteredStrategies.filter(s => s.category === category);
    }

    if (difficulty && difficulty !== 'all') {
      filteredStrategies = filteredStrategies.filter(s => s.difficulty === difficulty);
    }

    if (search) {
      const sanitizedSearch = search.toLowerCase();
      filteredStrategies = filteredStrategies.filter(s => 
        s.name.toLowerCase().includes(sanitizedSearch) ||
        s.description.toLowerCase().includes(sanitizedSearch)
      );
    }

    const response = {
      success: true,
      data: filteredStrategies,
      meta: {
        total: filteredStrategies.length,
        categories: [...new Set(STRATEGY_TEMPLATES.map(s => s.category))],
        difficulties: [...new Set(STRATEGY_TEMPLATES.map(s => s.difficulty))],
        filters: {
          category: category || null,
          difficulty: difficulty || null,
          search: search || null,
        },
      },
    };

    // Cache the result
    await advancedCache.set(cacheKey, response, {
      ttl: 30 * 60 * 1000, // 30 minutes
      tags: ['strategies', 'list'],
      priority: 'medium',
    });

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('strategies_api_get', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=300',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('strategies_api_error', duration);
    
    console.error('Strategies API GET error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch strategies',
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
 * POST /api/strategies - Create a custom strategy template
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['name', 'description', 'category', 'code_template'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required field: ${field}`,
          },
          { 
            status: 400,
            headers: {
              'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
            },
          }
        );
      }
    }

    // Sanitize input
    const sanitizedData = {
      name: securityManager.sanitizeInput(body.name, 'text'),
      description: securityManager.sanitizeInput(body.description, 'text'),
      category: securityManager.sanitizeInput(body.category, 'text'),
      difficulty: body.difficulty || 'custom',
      parameters: body.parameters || {},
      code_template: securityManager.sanitizeInput(body.code_template, 'code'),
    };

    // Generate ID and timestamps
    const newStrategy = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...sanitizedData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // In production, save to database
    // For now, just return the created strategy
    
    // Invalidate caches
    await advancedCache.clearByTags(['strategies', 'list']);

    const response = {
      success: true,
      data: newStrategy,
      message: 'Strategy created successfully',
    };

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('strategies_api_create', duration);

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
    performanceMonitorEnhanced.recordMetric('strategies_api_create_error', duration);
    
    console.error('Strategies API POST error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create strategy',
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