/**
 * Edge Metrics API
 * Centralized edge performance metrics collection and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { enhancedConnectionPool } from '../../../services/enhancedSupabasePool';
import { edgeCacheManager } from '../../../services/edgeCacheManager';
import { performanceMonitorEnhanced } from '../../../services/performanceMonitorEnhanced';

interface EdgeMetrics {
  timestamp: number;
  region: string;
  connectionPool: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    avgAcquireTime: number;
    hitRate: number;
    connectionsByRegion: Record<string, number>;
  };
  cache: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
    cacheSize: number;
    memoryUsage: number;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    lastHealthCheck: number;
  };
}

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const region = request.headers.get('x-vercel-region') || 'unknown';
    const searchParams = request.nextUrl.searchParams;
    const detailed = searchParams.get('detailed') === 'true';
    const timeframe = parseInt(searchParams.get('timeframe') || '300'); // 5 minutes default

    // Collect connection pool metrics
    const poolStats = enhancedConnectionPool.getStats();
    const poolDetails = detailed ? await enhancedConnectionPool.getDetailedStats() : null;
    const edgeMetrics = enhancedConnectionPool.getEdgeMetrics();
    const edgeWarmingStats = enhancedConnectionPool.getEdgeWarmingStats();

    // Collect cache metrics
    const cacheStats = edgeCacheManager.getMetrics();
    const cacheDetails = detailed ? await edgeCacheManager.getDetailedMetrics() : null;

    // Collect performance metrics
    const perfMetrics = performanceMonitorEnhanced.getMetrics(timeframe);
    const perfDetails = detailed ? await performanceMonitorEnhanced.getDetailedMetrics() : null;

    // Calculate health status
    const health = calculateHealthStatus({
      poolStats,
      cacheStats,
      perfMetrics,
      edgeMetrics
    });

    const metrics: EdgeMetrics = {
      timestamp: Date.now(),
      region,
      connectionPool: {
        totalConnections: poolStats.totalConnections,
        activeConnections: poolStats.activeConnections,
        idleConnections: poolStats.idleConnections,
        avgAcquireTime: poolStats.avgAcquireTime,
        hitRate: poolStats.hitRate,
        connectionsByRegion: edgeMetrics.connectionsByRegion
      },
      cache: {
        hitRate: cacheStats.hitRate,
        missRate: cacheStats.missRate,
        totalRequests: cacheStats.totalRequests,
        cacheSize: cacheStats.cacheSize,
        memoryUsage: cacheStats.memoryUsage
      },
      performance: {
        avgResponseTime: perfMetrics.avgResponseTime,
        p95ResponseTime: perfMetrics.p95ResponseTime,
        p99ResponseTime: perfMetrics.p99ResponseTime,
        errorRate: perfMetrics.errorRate,
        throughput: perfMetrics.throughput
      },
      health
    };

    const response = {
      success: true,
      metrics,
      ...(detailed && {
        details: {
          connectionPool: poolDetails,
          cache: cacheDetails,
          performance: perfDetails,
          edgeWarming: edgeWarmingStats
        }
      }),
      meta: {
        generatedAt: Date.now(),
        generationTime: performance.now() - startTime,
        region,
        timeframe,
        version: '1.0.0'
      }
    };

    // Cache the metrics response for a short time
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=10',
        'X-Edge-Metrics': 'true',
        'X-Region': region,
        'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`
      }
    });

  } catch (error) {
    // Edge metrics collection failed - error details returned in response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: 'Failed to collect edge metrics',
      details: errorMessage, // Include error details for debugging
      timestamp: Date.now(),
      generationTime: performance.now() - startTime
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Edge-Metrics': 'error'
      }
    });
  }
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const body = await request.json();
    const { action, params } = body;

    switch (action) {
      case 'warmup':
        await enhancedConnectionPool.forceEdgeWarming();
        await edgeCacheManager.warmupCache(params?.patterns || []);
        break;

      case 'cleanup':
        await enhancedConnectionPool.cleanupForEdge();
        await edgeCacheManager.cleanup();
        break;

      case 'health-check':
        await enhancedConnectionPool.forceHealthCheck();
        break;

      case 'reset-metrics':
        performanceMonitorEnhanced.resetMetrics();
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return NextResponse.json({
      success: true,
      action,
      timestamp: Date.now(),
      executionTime: performance.now() - startTime
    }, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-Edge-Action': action
      }
    });

  } catch (error) {
    // Edge metrics action failed - error details returned in response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { 
      status: 400,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
  }
}

function calculateHealthStatus(data: {
  poolStats: any;
  cacheStats: any;
  perfMetrics: any;
  edgeMetrics: any;
}): EdgeMetrics['health'] {
  const issues: string[] = [];
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check connection pool health
  if (data.poolStats.unhealthyConnections > 0) {
    issues.push(`${data.poolStats.unhealthyConnections} unhealthy connections`);
    status = 'degraded';
  }

  if (data.poolStats.avgAcquireTime > 1000) {
    issues.push('Slow connection acquisition');
    status = 'degraded';
  }

  if (data.edgeMetrics.coldStartRate > 0.2) {
    issues.push('High cold start rate');
    status = 'degraded';
  }

  // Check cache health
  if (data.cacheStats.hitRate < 0.5) {
    issues.push('Low cache hit rate');
    status = 'degraded';
  }

  // Check performance health
  if (data.perfMetrics.errorRate > 0.05) {
    issues.push('High error rate');
    status = 'unhealthy';
  }

  if (data.perfMetrics.avgResponseTime > 2000) {
    issues.push('Slow response times');
    status = 'unhealthy';
  }

  // Check for critical issues
  if (data.poolStats.totalConnections === 0) {
    issues.push('No database connections available');
    status = 'unhealthy';
  }

  return {
    status,
    issues,
    lastHealthCheck: Date.now()
  };
}