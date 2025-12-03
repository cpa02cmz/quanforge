/**
 * WebSocket Edge Function for Real-time Communication
 * Handles WebSocket connections for live market data and notifications
 */

import { NextRequest } from 'next/server';
import { performanceMonitorEnhanced } from '../../services/performanceMonitorEnhanced';
import { securityManager } from '../../services/securityManager';

// Define global WebSocketPair for edge runtime
declare global {
  var WebSocketPair: any;
}

export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
};

// WebSocket connection store (in production, use Redis or similar)
const connections = new Map<string, {
  socket: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  lastPing: number;
  region: string;
}>();

// Market data symbols
const SYMBOLS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY', 'CADJPY'
];

// Generate mock market data
const generateMarketData = (symbol: string) => {
  const basePrice = {
    'EURUSD': 1.0850, 'GBPUSD': 1.2750, 'USDJPY': 157.50, 'USDCHF': 0.9050,
    'AUDUSD': 0.6650, 'USDCAD': 1.3650, 'EURGBP': 0.8510, 'EURJPY': 171.00,
    'GBPJPY': 200.50, 'EURCHF': 0.9820, 'AUDJPY': 104.80, 'CADJPY': 115.40,
  }[symbol] || 1.0000;

  const variation = (Math.random() - 0.5) * 0.002;
  const price = basePrice * (1 + variation);
  const spread = basePrice * 0.0001;

  return {
    type: 'market_data',
    symbol,
    timestamp: Date.now(),
    bid: parseFloat((price - spread / 2).toFixed(5)),
    ask: parseFloat((price + spread / 2).toFixed(5)),
    mid: parseFloat(price.toFixed(5)),
    spread: parseFloat(spread.toFixed(5)),
    change: parseFloat(variation.toFixed(5)),
    changePercent: parseFloat((variation * 100).toFixed(3)),
  };
};

// Broadcast market data to subscribed clients
const broadcastMarketData = () => {
  const marketData = SYMBOLS.map(symbol => generateMarketData(symbol));
  
  connections.forEach((connection, connectionId) => {
    try {
      // Send only subscribed symbols
      const subscribedData = marketData.filter(data => 
        connection.subscriptions.has(data.symbol) || connection.subscriptions.has('all')
      );

      if (subscribedData.length > 0 && connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(JSON.stringify({
          type: 'market_update',
          data: subscribedData,
          timestamp: Date.now(),
          region: connection.region,
        }));
      }
    } catch (error) {
      console.error(`Error broadcasting to connection ${connectionId}:`, error);
      connections.delete(connectionId);
    }
  });
};

// Start market data broadcasting
let broadcastInterval: NodeJS.Timeout;
if (typeof setInterval !== 'undefined') {
  broadcastInterval = setInterval(broadcastMarketData, 1000); // Update every second
}

// Clean up dead connections
const cleanupConnections = () => {
  const now = Date.now();
  connections.forEach((connection, connectionId) => {
    if (now - connection.lastPing > 30000) { // 30 seconds timeout
      try {
        connection.socket.close();
      } catch (error) {
        // Ignore close errors
      }
      connections.delete(connectionId);
    }
  });
};

if (typeof setInterval !== 'undefined') {
  setInterval(cleanupConnections, 10000); // Clean up every 10 seconds
}

/**
 * WebSocket upgrade handler
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const url = new URL(request.url);
    const isUpgrade = request.headers.get('upgrade') === 'websocket';
    
    if (!isUpgrade) {
      return new Response('Expected WebSocket connection', { status: 426 });
    }

    // Create WebSocket pair
    const { 0: client, 1: server } = new WebSocketPair();
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store connection
    connections.set(connectionId, {
      socket: server,
      subscriptions: new Set(),
      lastPing: Date.now(),
      region: process.env.VERCEL_REGION || 'unknown',
    });

    // Handle WebSocket messages
    server.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        const connection = connections.get(connectionId);
        
        if (!connection) return;

        switch (message.type) {
          case 'subscribe':
            // Subscribe to market data symbols
            if (message.symbols && Array.isArray(message.symbols)) {
              const sanitizedSymbols = message.symbols
                .map((s: string) => securityManager.sanitizeInput(s.trim().toUpperCase(), 'symbol'))
                .filter((s: string) => SYMBOLS.includes(s) || s === 'all');
              
              sanitizedSymbols.forEach((symbol: string) => {
                connection.subscriptions.add(symbol);
              });

              server.send(JSON.stringify({
                type: 'subscription_confirmed',
                symbols: sanitizedSymbols,
                timestamp: Date.now(),
              }));
            }
            break;

          case 'unsubscribe':
            // Unsubscribe from symbols
            if (message.symbols && Array.isArray(message.symbols)) {
              message.symbols.forEach((symbol: string) => {
                connection.subscriptions.delete(symbol);
              });

              server.send(JSON.stringify({
                type: 'unsubscription_confirmed',
                symbols: message.symbols,
                timestamp: Date.now(),
              }));
            }
            break;

          case 'ping':
            // Respond to ping
            connection.lastPing = Date.now();
            server.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now(),
            }));
            break;

          case 'authenticate':
            // Authenticate user (in production, verify token)
            if (message.token) {
              connection.userId = securityManager.sanitizeInput(message.token, 'token');
              server.send(JSON.stringify({
                type: 'authenticated',
                userId: connection.userId,
                timestamp: Date.now(),
              }));
            }
            break;

          default:
            server.send(JSON.stringify({
              type: 'error',
              message: `Unknown message type: ${message.type}`,
              timestamp: Date.now(),
            }));
        }
      } catch (error) {
        server.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: Date.now(),
        }));
      }
    });

    // Handle WebSocket close
    server.addEventListener('close', () => {
      connections.delete(connectionId);
      performanceMonitorEnhanced.recordMetric('websocket_close', performance.now() - startTime);
    });

    // Handle WebSocket error
    server.addEventListener('error', (error) => {
      console.error(`WebSocket error for connection ${connectionId}:`, error);
      connections.delete(connectionId);
      performanceMonitorEnhanced.recordMetric('websocket_error', performance.now() - startTime);
    });

    // Send welcome message
    server.send(JSON.stringify({
      type: 'connected',
      connectionId,
      region: process.env.VERCEL_REGION || 'unknown',
      timestamp: Date.now(),
      availableSymbols: SYMBOLS,
    }));

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('websocket_connect', duration);

    // Return client WebSocket
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: {
        'X-WebSocket-Region': process.env.VERCEL_REGION || 'unknown',
        'X-Response-Time': `${duration.toFixed(2)}ms`,
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('websocket_error', duration);
    
    console.error('WebSocket upgrade error:', error);
    
    return new Response('WebSocket upgrade failed', {
      status: 500,
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
      },
    });
  }
}

/**
 * Get WebSocket connection statistics
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'stats') {
      const stats = {
        totalConnections: connections.size,
        region: process.env.VERCEL_REGION || 'unknown',
        connectionsByRegion: Array.from(connections.values()).reduce((acc, conn) => {
          acc[conn.region] = (acc[conn.region] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        totalSubscriptions: Array.from(connections.values()).reduce((acc, conn) => {
          return acc + conn.subscriptions.size;
        }, 0),
        timestamp: Date.now(),
      };

      const duration = performance.now() - startTime;
      performanceMonitorEnhanced.recordMetric('websocket_stats', duration);

      return new Response(JSON.stringify({
        success: true,
        data: stats,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
        },
      });
    }

    if (action === 'broadcast') {
      const { message, target = 'all' } = body;
      
      if (!message) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Message is required',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let sentCount = 0;
      connections.forEach((connection, connectionId) => {
        try {
          if (connection.socket.readyState === WebSocket.OPEN) {
            if (target === 'all' || 
                (target === 'authenticated' && connection.userId) ||
                (target === 'unauthenticated' && !connection.userId)) {
              
              connection.socket.send(JSON.stringify({
                type: 'broadcast',
                message: securityManager.sanitizeInput(message, 'text'),
                timestamp: Date.now(),
                region: connection.region,
              }));
              sentCount++;
            }
          }
        } catch (error) {
          console.error(`Error broadcasting to connection ${connectionId}:`, error);
          connections.delete(connectionId);
        }
      });

      const duration = performance.now() - startTime;
      performanceMonitorEnhanced.recordMetric('websocket_broadcast', duration);

      return new Response(JSON.stringify({
        success: true,
        data: {
          sentCount,
          target,
          message,
        },
      }), {
        headers: {
          'Content-Type': 'application/json',
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
        },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('websocket_api_error', duration);
    
    console.error('WebSocket API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process request',
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'X-Response-Time': `${duration.toFixed(2)}ms`,
      },
    });
  }
}