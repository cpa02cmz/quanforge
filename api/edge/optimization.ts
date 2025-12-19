/**
 * Enhanced Edge Optimization API
 * Provides comprehensive edge optimization endpoints for Vercel deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { edgeOptimizationService } from '../../services/edgeOptimizationService';
import { enhancedConnectionPool } from '../../services/enhancedSupabasePool';
import { globalCache } from '../../services/unifiedCacheManager';
import { optimizedSupabase } from '../../services/supabaseOptimized';
import { logger } from '../../utils/logger';
import { performanceMonitor } from '../../utils/performance';

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const region = request.headers.get('x-vercel-region') || 'unknown';
    const action = searchParams.get('action') || 'metrics';
    const detailed = searchParams.get('detailed') === 'true';

    const response: any = {
      success: true,
      region,
      timestamp: Date.now(),
      action
    };

    switch (action) {
      case 'metrics': {
        const metrics = await edgeOptimizationService.getMetrics();
        response.metrics = metrics;
        
        if (detailed) {
          response.historical = edgeOptimizationService.getHistoricalMetrics(region, 100);
          response.recommendations = edgeOptimizationService.getRecommendations();
        }
        break;
      }

      case 'health': {
        const healthStatus = edgeOptimizationService.getHealthStatus();
        response.health = healthStatus;
        break;
      }

      case 'connections': {
        const poolStats = enhancedConnectionPool.getStats();
        const detailedStats = detailed ? await enhancedConnectionPool.getDetailedStats() : null;
        const edgeMetrics = enhancedConnectionPool.getEdgeMetrics();
        
        response.connections = {
          pool: poolStats,
          edge: edgeMetrics,
          ...(detailed && { detailed: detailedStats })
        };
        break;
      }

      case 'cache': {
        const cacheMetrics = globalCache.getMetrics();
        response.cache = {
          metrics: cacheMetrics,
          size: globalCache.size(),
          keys: globalCache.keys().slice(0, 50) // Limit keys for performance
        };
        break;
      }

      case 'performance': {
        const perfMetrics = await edgeOptimizationService.getMetrics();
        response.performance = perfMetrics.performance;
        
        if (detailed) {
          response.historicalPerformance = edgeOptimizationService
            .getHistoricalMetrics(region, 100)
            .map(m => ({
              timestamp: m.timestamp,
              avgResponseTime: m.performance.avgResponseTime,
              p95ResponseTime: m.performance.p95ResponseTime,
              errorRate: m.performance.errorRate,
              throughput: m.performance.throughput
            }));
        }
        break;
      }

      case 'recommendations': {
        response.recommendations = edgeOptimizationService.getRecommendations();
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const generationTime = performance.now() - startTime;
    response.meta = {
      generationTime,
      region,
      version: '2.0.0',
      optimized: true
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=10',
        'X-Edge-Optimization': 'true',
        'X-Region': region,
        'X-Response-Time': `${generationTime.toFixed(2)}ms`,
        'X-Action': action
      }
    });

  } catch (error) {
    logger.error('Edge optimization API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
      generationTime: performance.now() - startTime
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Edge-Optimization': 'error'
      }
    });
  }
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const body = await request.json();
    const { action, params } = body;
    const region = request.headers.get('x-vercel-region') || 'unknown';

    const response: any = {
      success: true,
      action,
      region,
      timestamp: Date.now()
    };

    switch (action) {
      case 'optimize': {
        await edgeOptimizationService.forceOptimization();
        response.message = 'Edge optimization completed';
        break;
      }

      case 'warmup': {
        await enhancedConnectionPool.forceEdgeWarming();
        response.message = 'Edge connection warm-up completed';
        break;
      }

      case 'health-check': {
        const healthResult = await enhancedConnectionPool.forceHealthCheck();
        response.health = healthResult;
        response.message = 'Health check completed';
        break;
      }

      case 'cleanup': {
        await enhancedConnectionPool.drainConnections();
        globalCache.clear();
        response.message = 'Edge cleanup completed';
        break;
      }

      case 'config-update': {
        if (!params || !params.config) {
          throw new Error('Configuration parameters required');
        }
        edgeOptimizationService.updateConfig(params.config);
        response.message = 'Configuration updated';
        response.config = params.config;
        break;
      }

      case 'cache-invalidate': {
        const patterns = params?.patterns || [];
        if (patterns.length === 0) {
          globalCache.clear();
        } else {
          patterns.forEach((pattern: string) => {
            const keys = globalCache.keys().filter(key => key.includes(pattern));
            keys.forEach(key => globalCache.delete(key));
          });
        }
        response.message = `Cache invalidated for ${patterns.length || 'all'} patterns`;
        break;
      }

      case 'connection-drain': {
        await enhancedConnectionPool.drainConnections();
        response.message = 'Connection drain completed';
        break;
      }

      case 'predictive-warmup': {
        await enhancedConnectionPool.predictiveWarming();
        response.message = 'Predictive warm-up completed';
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const executionTime = performance.now() - startTime;
    response.executionTime = executionTime;

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-Edge-Optimization': 'true',
        'X-Region': region,
        'X-Response-Time': `${executionTime.toFixed(2)}ms`,
        'X-Action': action
      }
    });

  } catch (error) {
    logger.error('Edge optimization action error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
      executionTime: performance.now() - startTime
    }, { 
      status: 400,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Edge-Optimization': 'error'
      }
    });
  }
}

// Edge function configuration for optimal performance
export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1', 'cle1'],
  maxDuration: 30,
  memory: 512,
  cache: 'max-age=300, s-maxage=900'
};