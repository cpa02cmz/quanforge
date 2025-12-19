/**
 * Advanced Edge API Functions for Vercel Deployment
 * Provides edge-optimized API endpoints for better performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { edgeCacheStrategy } from '../../services/edgeCacheManager';
import { databasePerformanceMonitor } from '../../services/databasePerformanceMonitor';

// Edge-optimized health check
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Get request metadata
    const region = request.headers.get('x-vercel-id')?.split('-')[1] || 'unknown';
    const country = request.headers.get('x-vercel-ip-country') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Check cache
    const cacheKey = `health_${region}_${country}`;
    const cached = await edgeCacheStrategy.get(cacheKey);
    
    if (cached) {
      return NextResponse.json({
        status: 'healthy',
        cached: true,
        region,
        country,
        timestamp: Date.now(),
        performance: {
          responseTime: performance.now() - startTime,
          cacheHit: true
        }
      }, {
        headers: {
          'Cache-Control': 'public, max-age=60',
          'X-Edge-Region': region,
          'X-Edge-Cache': 'HIT'
        }
      });
    }
    
    // Perform health checks
    const healthChecks = await Promise.allSettled([
      checkDatabaseHealth(),
      checkCacheHealth(),
      checkMemoryHealth(),
      checkPerformanceHealth()
    ]);
    
    const results = {
      database: healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : { status: 'error', error: String(healthChecks[0].reason) },
      cache: healthChecks[1].status === 'fulfilled' ? healthChecks[1].value : { status: 'error', error: String(healthChecks[1].reason) },
      memory: healthChecks[2].status === 'fulfilled' ? healthChecks[2].value : { status: 'error', error: String(healthChecks[2].reason) },
      performance: healthChecks[3].status === 'fulfilled' ? healthChecks[3].value : { status: 'error', error: String(healthChecks[3].reason) }
    };
    
    const isHealthy = Object.values(results).every(check => 
      typeof check === 'object' && check.status !== 'error'
    );
    
    const response = {
      status: isHealthy ? 'healthy' : 'degraded',
      region,
      country,
      userAgent: userAgent.substring(0, 100), // Limit length
      timestamp: Date.now(),
      checks: results,
      performance: {
        responseTime: performance.now() - startTime,
        cacheHit: false
      }
    };
    
    // Cache successful responses
    if (isHealthy) {
      await edgeCacheStrategy.set(cacheKey, response, {
        ttl: 60000, // 1 minute
        tags: ['health', region]
      });
    }
    
    return NextResponse.json(response, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'public, max-age=60',
        'X-Edge-Region': region,
        'X-Edge-Cache': 'MISS'
      }
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: Date.now(),
      error: 'Internal server error',
      performance: {
        responseTime: performance.now() - startTime,
        cacheHit: false
      }
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Edge-Region': 'unknown',
        'X-Edge-Cache': 'ERROR'
      }
    });
  }
}

async function checkDatabaseHealth() {
  const startTime = performance.now();
  
  try {
    // Simulate database health check
    // In production, this would check actual Supabase connection
    const metrics = databasePerformanceMonitor.getMetrics();
    
    return {
      status: 'healthy',
      responseTime: performance.now() - startTime,
      metrics: {
        queryTime: metrics.queryTime,
        cacheHitRate: metrics.cacheHitRate,
        connectionPoolUtilization: metrics.connectionPoolUtilization,
        errorRate: metrics.errorRate
      }
    };
  } catch (error) {
    return {
      status: 'error',
      error: String(error),
      responseTime: performance.now() - startTime
    };
  }
}

async function checkCacheHealth() {
  const startTime = performance.now();
  
  try {
    const stats = edgeCacheStrategy.getStats();
    
    return {
      status: 'healthy',
      responseTime: performance.now() - startTime,
      stats: {
        hitRate: stats.hitRate,
        entries: stats.entries,
        size: stats.size,
        hits: stats.hits,
        misses: stats.misses
      }
    };
  } catch (error) {
    return {
      status: 'error',
      error: String(error),
      responseTime: performance.now() - startTime
    };
  }
}

async function checkMemoryHealth() {
  const startTime = performance.now();
  
  try {
    // Check memory usage (if available)
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      const usedMemory = memory.heapUsed / 1024 / 1024; // MB
      const totalMemory = memory.heapTotal / 1024 / 1024; // MB
      const memoryUsage = (usedMemory / totalMemory) * 100;
      
      return {
        status: memoryUsage > 90 ? 'warning' : 'healthy',
        responseTime: performance.now() - startTime,
        memory: {
          used: Math.round(usedMemory * 100) / 100,
          total: Math.round(totalMemory * 100) / 100,
          usage: Math.round(memoryUsage * 100) / 100
        }
      };
    }
    
    return {
      status: 'healthy',
      responseTime: performance.now() - startTime,
      memory: { message: 'Memory monitoring not available' }
    };
  } catch (error) {
    return {
      status: 'error',
      error: String(error),
      responseTime: performance.now() - startTime
    };
  }
}

async function checkPerformanceHealth() {
  const startTime = performance.now();
  
  try {
    const metrics = databasePerformanceMonitor.getMetrics();
    const alerts = databasePerformanceMonitor.getAlerts();
    
    // Determine performance health based on metrics
    const slowQueries = metrics.slowQueries;
    const errorRate = metrics.errorRate;
    const avgQueryTime = metrics.queryTime;
    
    let status = 'healthy';
    if (errorRate > 0.1 || avgQueryTime > 2000) {
      status = 'critical';
    } else if (errorRate > 0.05 || avgQueryTime > 1000 || slowQueries > 10) {
      status = 'warning';
    }
    
    return {
      status,
      responseTime: performance.now() - startTime,
      metrics: {
        slowQueries,
        errorRate: Math.round(errorRate * 10000) / 100, // Convert to percentage
        avgQueryTime: Math.round(avgQueryTime * 100) / 100,
        throughput: metrics.throughput
      },
      alerts: alerts.slice(-5) // Last 5 alerts
    };
  } catch (error) {
    return {
      status: 'error',
      error: String(error),
      responseTime: performance.now() - startTime
    };
  }
}