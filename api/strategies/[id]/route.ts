/**
 * Individual Strategy API Endpoint
 * Handle operations for specific strategies by ID
 */

import { NextRequest } from 'next/server';
import { securityManager } from '../../../services/securityManager';
import {
  edgeConfig,
  handleGetRequest,
  handlePutRequest,
  handleDeleteRequest,
  RouteContext,
  validateRouteParam,
  buildSingleResourceResponse,
  buildOperationResponse,
  APIError,
} from '../../../utils/apiShared';

export const config = edgeConfig;

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
  return handleGetRequest(request, async (params) => {
    const { id } = await context.params;
    const validatedId = validateRouteParam(id, 'ID');

    // Find the strategy
    const strategy = STRATEGY_TEMPLATES.find(s => s.id === validatedId);
    
    if (!strategy) {
      throw new APIError('Strategy not found', 404);
    }

    return buildSingleResourceResponse(strategy, 'fetched');
  }, {
    key: 'strategy',
    ttl: 60 * 60 * 1000, // 1 hour
    tags: ['strategy'],
  });
}

/**
 * PUT /api/strategies/[id] - Update a strategy (only for custom strategies)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  return handlePutRequest(request, context, async (id, data) => {
    // Check if it's a custom strategy (starts with 'custom_')
    if (!id.startsWith('custom_')) {
      throw new APIError('Cannot update built-in strategy templates', 403);
    }

    // Sanitize input
    const sanitizedData = {
      name: data.name ? securityManager.sanitizeInput(data.name, 'text') : undefined,
      description: data.description ? securityManager.sanitizeInput(data.description, 'text') : undefined,
      category: data.category ? securityManager.sanitizeInput(data.category, 'text') : undefined,
      difficulty: data.difficulty || undefined,
      parameters: data.parameters || undefined,
      code_template: data.code_template ? securityManager.sanitizeInput(data.code_template, 'code') : undefined,
    };

    // In production, update in database
    // For now, just return success
    
    return {
      success: true,
      data: {
        id,
        ...sanitizedData,
        updated_at: new Date().toISOString(),
      },
      message: 'Strategy updated successfully',
    };
  }, undefined, ['strategies', 'list']);
}

/**
 * DELETE /api/strategies/[id] - Delete a custom strategy
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleDeleteRequest(request, context, async (id, params) => {
    // Check if it's a custom strategy (starts with 'custom_')
    if (!id.startsWith('custom_')) {
      throw new APIError('Cannot delete built-in strategy templates', 403);
    }

    // In production, delete from database
    // For now, just return success
    
    return buildOperationResponse('delete', 1, 'strategy');
  }, ['strategies', 'list']);
}