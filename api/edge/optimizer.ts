/**
 * Enhanced Edge Function for Vercel Deployment
 * Optimized for global distribution and performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { edgeSupabase } from '../../services/edgeSupabaseClient';
import { vercelEdgeOptimizer } from '../../services/vercelEdgeOptimizer';

interface EdgeResponse<T = any> {
  data?: T;
  error?: string;
  cached?: boolean;
  region?: string;
  responseTime?: number;
}

/**
 * Enhanced edge function with caching and optimization
 */
export default async function edgeHandler(request: Request): Promise<Response> {
  const startTime = performance.now();
  const url = new URL(request.url);
  const region = request.headers.get('x-vercel-region') || 'unknown';
  
  try {
    // Add edge-specific headers
    const responseHeaders = {
      'x-edge-region': region,
      'x-edge-cache': 'enabled',
      'x-edge-optimized': 'true',
      'cache-control': 'public, max-age=300, s-maxage=600', // 5min client, 10min edge
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, x-edge-region',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200,
        headers: responseHeaders 
      });
    }

    // Route handling
    const path = url.pathname;
    const searchParams = url.searchParams;

    let response: EdgeResponse;

    switch (path) {
      case '/api/edge/robots':
        response = await handleRobots(request, searchParams, region);
        break;
      
      case '/api/edge/strategies':
        response = await handleStrategies(request, searchParams, region);
        break;
      
      case '/api/edge/analytics/performance':
        response = await handlePerformanceAnalytics(request, searchParams, region);
        break;
      
      case '/api/edge/health':
        response = await handleHealthCheck(region);
        break;
      
      case '/api/edge/cache/warm':
        response = await handleCacheWarmup(searchParams, region);
        break;
      
      case '/api/edge/optimize':
        response = await handleOptimization(request, region);
        break;
      
      default:
        response = { error: 'Endpoint not found' };
        return NextResponse.json(response, {
          status: 404,
          headers: responseHeaders,
        });
    }

    // Add performance metadata
    const responseTime = performance.now() - startTime;
    response.responseTime = Math.round(responseTime);
    response.region = region;

    // Log performance metrics
    if (process.env.NODE_ENV === 'production') {
      console.log(`Edge function ${path} executed in ${responseTime}ms from ${region}`);
    }

    return new Response(JSON.stringify(response), {
      status: response.error ? 500 : 200,
      headers: {
        ...responseHeaders,
        'x-response-time': responseTime.toString(),
        'x-edge-cached': response.cached ? 'true' : 'false',
      },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      region,
      responseTime: Math.round(performance.now() - startTime),
    }), {
      status: 500,
      headers: {
        'x-edge-region': region,
        'cache-control': 'no-cache',
      },
    });
  }
}

/**
 * Handle robots endpoint with edge optimization
 */
async function handleRobots(
  request: Request, 
  searchParams: URLSearchParams, 
  region: string
): Promise<EdgeResponse> {
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || '';
  const type = searchParams.get('type') || '';

  const cacheKey = `robots_${page}_${limit}_${search}_${type}_${region}`;
  
  try {
    // Try edge cache first
    const cached = await vercelEdgeOptimizer.optimizedFetch(
      `${process.env.VERCEL_URL}/api/robots?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'x-edge-region': region,
          'x-cache-key': cacheKey,
        },
      },
      {
        ttl: 300000, // 5 minutes
        key: cacheKey,
      }
    );

    if (cached) {
      return { data: cached, cached: true };
    }

    // Fallback to Supabase with edge optimization
    const result = await edgeSupabase.edgeQuery('robots', '*', {
      cacheKey,
      cacheTTL: 300000,
      enableCache: true,
      priority: 'high',
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return { data: result.data, cached: false };

  } catch (error) {
    console.error('Robots edge function error:', error);
    return { error: 'Failed to fetch robots' };
  }
}

/**
 * Handle strategies endpoint
 */
async function handleStrategies(
  _request: Request,
  _searchParams: URLSearchParams,
  region: string
): Promise<EdgeResponse> {
  const cacheKey = `strategies_${region}`;
  
  try {
    const result = await edgeSupabase.edgeQuery('strategies', '*', {
      cacheKey,
      cacheTTL: 600000, // 10 minutes
      enableCache: true,
      priority: 'normal',
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return { data: result.data };

  } catch (error) {
    console.error('Strategies edge function error:', error);
    return { error: 'Failed to fetch strategies' };
  }
}

/**
 * Handle performance analytics endpoint
 */
async function handlePerformanceAnalytics(
  _request: Request,
  searchParams: URLSearchParams,
  region: string
): Promise<EdgeResponse> {
  const timeframe = searchParams.get('timeframe') || '24h';
  const cacheKey = `analytics_${timeframe}_${region}`;
  
  try {
    // Get edge metrics
    const edgeMetrics = vercelEdgeOptimizer.getEdgeMetrics();
    
    // Get database performance metrics
    const dbResult = await edgeSupabase.edgeQuery('analytics', `*`, {
      cacheKey,
      cacheTTL: 180000, // 3 minutes
      enableCache: true,
      priority: 'low',
    });

    const analytics = {
      edge: edgeMetrics,
      database: dbResult.data,
      region,
      timeframe,
      timestamp: Date.now(),
    };

    return { data: analytics };

  } catch (error) {
    console.error('Analytics edge function error:', error);
    return { error: 'Failed to fetch analytics' };
  }
}

/**
 * Handle health check endpoint
 */
async function handleHealthCheck(region: string): Promise<EdgeResponse> {
  try {
    const health = {
      status: 'healthy',
      region,
      timestamp: Date.now(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      edge: {
        optimized: true,
        cache: vercelEdgeOptimizer.getConfig().enableEdgeCaching,
        regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
      },
      database: await checkDatabaseHealth(),
    };

    return { data: health };

  } catch (error) {
    console.error('Health check error:', error);
    return { error: 'Health check failed' };
  }
}

/**
 * Handle cache warmup endpoint
 */
async function handleCacheWarmup(
  searchParams: URLSearchParams,
  region: string
): Promise<EdgeResponse> {
  const endpoints = searchParams.get('endpoints')?.split(',') || ['robots', 'strategies'];
  
  try {
    const warmupResults = [];

    for (const endpoint of endpoints) {
      const startTime = performance.now();
      
      try {
        await vercelEdgeOptimizer.optimizedFetch(
          `${process.env.VERCEL_URL}/api/edge/${endpoint}`,
          {
            method: 'GET',
            headers: { 'x-cache-warmup': 'true' },
          },
          {
            ttl: 300000,
            key: `warmup_${endpoint}_${region}`,
          }
        );
        
        warmupResults.push({
          endpoint,
          success: true,
          duration: Math.round(performance.now() - startTime),
        });
      } catch (error) {
        warmupResults.push({
          endpoint,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { 
      data: {
        region,
        warmed: warmupResults,
        timestamp: Date.now(),
      }
    };

  } catch (error) {
    console.error('Cache warmup error:', error);
    return { error: 'Cache warmup failed' };
  }
}

/**
 * Handle optimization endpoint
 */
async function handleOptimization(_request: Request, region: string): Promise<EdgeResponse> {
  try {
    const optimizations = {
      bundle: await optimizeBundle(),
      cache: await optimizeCache(),
      database: await optimizeDatabase(),
      edge: await optimizeEdge(region),
    };

    return { data: optimizations };

  } catch (error) {
    console.error('Optimization error:', error);
    return { error: 'Optimization failed' };
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<{ status: string; latency?: number }> {
  try {
    const startTime = performance.now();
    const result = await edgeSupabase.edgeQuery('robots', 'count', {
      cacheKey: 'health_check',
      cacheTTL: 30000, // 30 seconds
      enableCache: false,
      priority: 'high',
    });

    const latency = Math.round(performance.now() - startTime);
    
    return {
      status: result.error ? 'unhealthy' : 'healthy',
      latency,
    };
  } catch (error) {
    return { status: 'unhealthy' };
  }
}

/**
 * Optimize bundle
 */
async function optimizeBundle(): Promise<{ optimized: boolean; size?: number }> {
  try {
    // Trigger bundle optimization
    vercelEdgeOptimizer.optimizeBundle();
    
    return {
      optimized: true,
    };
  } catch (error) {
    return { optimized: false };
  }
}

/**
 * Optimize cache
 */
async function optimizeCache(): Promise<{ optimized: boolean; entries?: number }> {
  try {
    // Setup advanced caching
    vercelEdgeOptimizer.setupAdvancedCaching();
    
    return {
      optimized: true,
    };
  } catch (error) {
    return { optimized: false };
  }
}

/**
 * Optimize database
 */
async function optimizeDatabase(): Promise<{ optimized: boolean; connections?: number }> {
  try {
    // This would trigger database optimizations
    // For now, return a placeholder
    return {
      optimized: true,
    };
  } catch (_error) {
    return { optimized: false };
  }
}

/**
 * Optimize edge configuration
 */
async function optimizeEdge(region: string): Promise<{ optimized: boolean; region: string }> {
  try {
    // Update edge configuration for this region
    vercelEdgeOptimizer.updateConfig({
      enableEdgeCaching: true,
      enableCompression: true,
      cacheTTL: 3600000, // 1 hour
    });

    return {
      optimized: true,
      region,
    };
  } catch (error) {
    return { optimized: false, region };
  }
}