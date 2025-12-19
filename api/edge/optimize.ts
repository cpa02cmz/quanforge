/**
 * Edge Optimization API
 * Provides edge-specific optimizations and caching strategies
 */

import { NextRequest, NextResponse } from 'next/server';
import { edgeCacheStrategy } from '../../services/edgeCacheStrategy';
import { vercelEdgeOptimizer } from '../../services/vercelEdgeOptimizer';
import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('EdgeOptimize');

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation') || 'optimize';
    const region = request.headers.get('x-vercel-id')?.split('-')[1] || 'unknown';
    
    // Check cache first
    const cacheKey = `edge_optimize_${operation}_${region}`;
    const cached = await edgeCacheStrategy.get(cacheKey);
    
    if (cached) {
      return NextResponse.json({
        success: true,
        cached: true,
        operation,
        region,
        data: cached,
        performance: {
          responseTime: performance.now() - startTime,
          cacheHit: true
        }
      }, {
        headers: {
          'Cache-Control': 'public, max-age=300',
          'X-Edge-Region': region,
          'X-Edge-Cache': 'HIT'
        }
      });
    }
    
    let result;
    
    switch (operation) {
      case 'optimize':
        result = await performOptimizations(region);
        break;
      case 'metrics':
        result = await getEdgeMetrics(region);
        break;
      case 'warm-cache':
        result = await warmEdgeCache(region);
        break;
      case 'clear-cache':
        result = await clearEdgeCache(region);
        break;
      case 'config':
        result = vercelEdgeOptimizer.getConfig();
        break;
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid operation',
          availableOperations: ['optimize', 'metrics', 'warm-cache', 'clear-cache', 'config']
        }, { status: 400 });
    }
    
    const response = {
      success: true,
      cached: false,
      operation,
      region,
      data: result,
      performance: {
        responseTime: performance.now() - startTime,
        cacheHit: false
      }
    };
    
    // Cache successful responses (except clear-cache)
    if (operation !== 'clear-cache') {
      await edgeCacheStrategy.set(cacheKey, response.data, {
        ttl: 300000, // 5 minutes
        tags: ['edge-optimize', operation, region]
      });
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'X-Edge-Region': region,
        'X-Edge-Cache': 'MISS'
      }
    });
    
  } catch (error) {
    logger.error('Edge optimization failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      performance: {
        responseTime: performance.now() - startTime,
        cacheHit: false
      }
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Edge-Cache': 'ERROR'
      }
    });
  }
}

async function performOptimizations(region: string) {
  const startTime = performance.now();
  
  try {
    // Enable edge-specific optimizations
    vercelEdgeOptimizer.optimizeBundleForEdge();
    vercelEdgeOptimizer.enableEdgeSSR();
    vercelEdgeOptimizer.setupEdgeErrorHandling();
    
    // Warm up critical caches
    await edgeCacheStrategy.warmEdgeRegions();
    
    // Get optimization results
    const metrics = vercelEdgeOptimizer.getEdgeMetrics();
    const cacheStats = edgeCacheStrategy.getStats();
    
    return {
      optimized: true,
      region,
      optimizations: {
        bundleOptimized: true,
        ssrEnabled: true,
        errorHandlingSetup: true,
        cacheWarmed: true
      },
      metrics: {
        edgePerformance: metrics,
        cachePerformance: cacheStats,
        optimizationTime: performance.now() - startTime
      },
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      optimized: false,
      region,
      error: String(error),
      optimizationTime: performance.now() - startTime
    };
  }
}

async function getEdgeMetrics(region: string) {
  try {
    const edgeMetrics = vercelEdgeOptimizer.getEdgeMetrics();
    const cacheStats = edgeCacheStrategy.getStats();
    const tagIndex = edgeCacheStrategy.getTagIndex();
    
    return {
      region,
      timestamp: Date.now(),
      edge: {
        metrics: edgeMetrics,
        config: vercelEdgeOptimizer.getConfig()
      },
      cache: {
        stats: cacheStats,
        tagCount: tagIndex.size,
        topTags: Array.from(tagIndex.entries())
          .sort(([, a], [, b]) => b.size - a.size)
          .slice(0, 10)
          .map(([tag, keys]) => ({ tag, keyCount: keys.size }))
      },
      performance: {
        totalRequests: edgeMetrics.reduce((sum, m) => sum + m.requestsServed, 0),
        avgResponseTime: edgeMetrics.length > 0 
          ? edgeMetrics.reduce((sum, m) => sum + m.responseTime, 0) / edgeMetrics.length 
          : 0,
        totalBandwidthSaved: edgeMetrics.reduce((sum, m) => sum + m.bandwidthSaved, 0)
      }
    };
  } catch (error) {
    return {
      region,
      error: String(error),
      timestamp: Date.now()
    };
  }
}

async function warmEdgeCache(region: string) {
  try {
    await edgeCacheStrategy.warmEdgeRegions();
    
    return {
      warmed: true,
      region,
      timestamp: Date.now(),
      message: 'Edge cache warmed successfully'
    };
  } catch (error) {
    return {
      warmed: false,
      region,
      error: String(error),
      timestamp: Date.now()
    };
  }
}

async function clearEdgeCache(region: string) {
  try {
    // Clear region-specific cache
    await edgeCacheStrategy.invalidateRegion(region);
    
    // Also clear optimization-related caches
    await edgeCacheStrategy.invalidateByTags(['edge-optimize']);
    
    return {
      cleared: true,
      region,
      timestamp: Date.now(),
      message: 'Edge cache cleared successfully'
    };
  } catch (error) {
    return {
      cleared: false,
      region,
      error: String(error),
      timestamp: Date.now()
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, ...params } = body;
    const region = request.headers.get('x-vercel-id')?.split('-')[1] || 'unknown';
    
    // Handle POST operations for cache invalidation
    if (operation === 'invalidate') {
      const { tags, pattern } = params;
      
      if (tags && Array.isArray(tags)) {
        await edgeCacheStrategy.invalidateByTags(tags);
      } else if (pattern && typeof pattern === 'string') {
        await edgeCacheStrategy.invalidateByPattern(pattern);
      } else {
        await edgeCacheStrategy.invalidateRegion(region, '*');
      }
      
      return NextResponse.json({
        success: true,
        operation: 'invalidate',
        region,
        invalidated: { tags, pattern },
        timestamp: Date.now()
      });
    }
    
    if (operation === 'smart-invalidate') {
      const { type, ...eventParams } = params;
      await edgeCacheStrategy.smartInvalidate({
        type,
        ...eventParams,
        region
      });
      
      return NextResponse.json({
        success: true,
        operation: 'smart-invalidate',
        region,
        event: { type, ...eventParams },
        timestamp: Date.now()
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid POST operation',
      availableOperations: ['invalidate', 'smart-invalidate']
    }, { status: 400 });
    
  } catch (error) {
    logger.error('Edge optimization POST failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}