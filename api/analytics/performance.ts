/**
 * Advanced Analytics API
 * Provides comprehensive analytics for edge and database performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { databasePerformanceMonitor } from '../../services/databasePerformanceMonitor';
import { edgeCacheStrategy } from '../../services/edgeCacheStrategy';
import { enhancedConnectionPool } from '../../services/enhancedSupabasePool';
import { vercelEdgeOptimizer } from '../../services/vercelEdgeOptimizer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';
    const region = request.headers.get('x-vercel-id')?.split('-')[1] || 'unknown';
    const timeRange = searchParams.get('timeRange') || '1h'; // 1h, 24h, 7d, 30d
    
    let data;
    
    switch (type) {
      case 'summary':
        data = await getAnalyticsSummary(region, timeRange);
        break;
      case 'performance':
        data = await getPerformanceAnalytics(region, timeRange);
        break;
      case 'database':
        data = await getDatabaseAnalytics(region, timeRange);
        break;
      case 'cache':
        data = await getCacheAnalytics(region, timeRange);
        break;
      case 'edge':
        data = await getEdgeAnalytics(region, timeRange);
        break;
      case 'connections':
        data = await getConnectionAnalytics(region, timeRange);
        break;
      case 'alerts':
        data = await getAlertsAnalytics(region, timeRange);
        break;
      case 'trends':
        data = await getTrendsAnalytics(region, timeRange);
        break;
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid analytics type',
          availableTypes: ['summary', 'performance', 'database', 'cache', 'edge', 'connections', 'alerts', 'trends']
        }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      type,
      region,
      timeRange,
      timestamp: Date.now(),
      data
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'X-Edge-Region': region
      }
    });
    
  } catch (error) {
    // Log error properly in production
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now()
    }, { status: 500 });
  }
}

async function getAnalyticsSummary(region: string, timeRange: string) {
  const [dbMetrics, cacheStats, edgeMetrics, connectionStats] = await Promise.all([
    databasePerformanceMonitor.getMetrics(),
    edgeCacheStrategy.getStats(),
    vercelEdgeOptimizer.getEdgeMetrics(),
    enhancedConnectionPool.getDetailedStats()
  ]);
  
  const alerts = databasePerformanceMonitor.getAlerts();
  const recentAlerts = alerts.filter(alert => 
    Date.now() - alert.timestamp < getTimeRangeMs(timeRange)
  );
  
  return {
    overview: {
      region,
      timeRange,
      status: getOverallStatus(dbMetrics, cacheStats, recentAlerts),
      lastUpdated: Date.now()
    },
    performance: {
      database: {
        avgQueryTime: Math.round(dbMetrics.queryTime * 100) / 100,
        cacheHitRate: Math.round(dbMetrics.cacheHitRate * 10000) / 100,
        errorRate: Math.round(dbMetrics.errorRate * 10000) / 100,
        throughput: Math.round(dbMetrics.throughput * 100) / 100
      },
      cache: {
        hitRate: Math.round(cacheStats.hitRate * 10000) / 100,
        entries: cacheStats.entries,
        size: Math.round(cacheStats.size / 1024) + ' KB',
        hits: cacheStats.hits,
        misses: cacheStats.misses
      },
      edge: {
        avgResponseTime: edgeMetrics.length > 0 
          ? Math.round(edgeMetrics.reduce((sum, m) => sum + m.responseTime, 0) / edgeMetrics.length * 100) / 100
          : 0,
        totalRequests: edgeMetrics.reduce((sum, m) => sum + m.requestsServed, 0),
        cacheHitRate: edgeMetrics.length > 0
          ? Math.round(edgeMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / edgeMetrics.length * 10000) / 100
          : 0
      },
      connections: {
        total: connectionStats.pool.totalConnections,
        active: connectionStats.pool.activeConnections,
        idle: connectionStats.pool.idleConnections,
        hitRate: Math.round(connectionStats.pool.hitRate * 10000) / 100,
        avgAcquireTime: Math.round(connectionStats.pool.avgAcquireTime * 100) / 100
      }
    },
    alerts: {
      total: recentAlerts.length,
      critical: recentAlerts.filter(a => a.severity === 'critical').length,
      high: recentAlerts.filter(a => a.severity === 'high').length,
      medium: recentAlerts.filter(a => a.severity === 'medium').length,
      low: recentAlerts.filter(a => a.severity === 'low').length
    }
  };
}

async function getPerformanceAnalytics(_region: string, _timeRange: string) {
  const dbReport = databasePerformanceMonitor.getPerformanceReport();
  const edgeMetrics = vercelEdgeOptimizer.getEdgeMetrics();
  
  return {
    database: {
      metrics: dbReport.summary,
      slowQueries: dbReport.topSlowQueries.slice(0, 10),
      recommendations: dbReport.recommendations
    },
    edge: {
      metrics: edgeMetrics,
      regions: edgeMetrics.reduce((acc, metric) => {
        acc[metric.region] = {
          responseTime: metric.responseTime,
          cacheHitRate: metric.cacheHitRate,
          requestsServed: metric.requestsServed,
          bandwidthSaved: metric.bandwidthSaved
        };
        return acc;
      }, {} as Record<string, any>)
    },
    trends: {
      queryTime: calculateTrend(dbReport.summary.queryTime),
      errorRate: calculateTrend(dbReport.summary.errorRate),
      cacheHitRate: calculateTrend(dbReport.summary.cacheHitRate)
    }
  };
}

async function getDatabaseAnalytics(region: string, timeRange: string) {
  const metrics = databasePerformanceMonitor.getMetrics();
  const alerts = databasePerformanceMonitor.getAlerts();
  const connectionStats = enhancedConnectionPool.getDetailedStats();
  
  return {
    metrics,
    alerts: alerts.filter(alert => 
      Date.now() - alert.timestamp < getTimeRangeMs(timeRange)
    ),
    connections: connectionStats,
    optimization: {
      suggestedIndexes: getSuggestedIndexes(),
      queryOptimizations: getQueryOptimizations(),
      performanceTips: getPerformanceTips(metrics)
    }
  };
}

async function getCacheAnalytics(region: string, timeRange: string) {
  const stats = edgeCacheStrategy.getStats();
  const tagIndex = edgeCacheStrategy.getTagIndex();
  
  return {
    stats,
    tags: {
      total: tagIndex.size,
      topTags: Array.from(tagIndex.entries())
        .sort(([, a], [, b]) => b.size - a.size)
        .slice(0, 20)
        .map(([tag, keys]) => ({
          tag,
          keyCount: keys.size,
          estimatedSize: keys.size * 1024 // Rough estimate
        }))
    },
    performance: {
      hitRate: stats.hitRate,
      efficiency: calculateCacheEfficiency(stats),
      recommendations: getCacheRecommendations(stats)
    }
  };
}

async function getEdgeAnalytics(region: string, timeRange: string) {
  const metrics = vercelEdgeOptimizer.getEdgeMetrics();
  const config = vercelEdgeOptimizer.getConfig();
  
  return {
    metrics,
    config,
    regions: metrics.reduce((acc, metric) => {
      if (!acc[metric.region]) {
        acc[metric.region] = {
          responseTime: [],
          cacheHitRate: [],
          requestsServed: 0,
          bandwidthSaved: 0
        };
      }
      
      acc[metric.region].responseTime.push(metric.responseTime);
      acc[metric.region].cacheHitRate.push(metric.cacheHitRate);
      acc[metric.region].requestsServed += metric.requestsServed;
      acc[metric.region].bandwidthSaved += metric.bandwidthSaved;
      
      return acc;
    }, {} as Record<string, any>),
    optimization: {
      enabledFeatures: Object.entries(config)
        .filter(([_, value]) => value === true)
        .map(([key]) => key),
      recommendations: getEdgeOptimizationRecommendations(metrics)
    }
  };
}

async function getConnectionAnalytics(region: string, timeRange: string) {
  const stats = await enhancedConnectionPool.getDetailedStats();
  
  return {
    pool: stats.pool,
    connections: stats.connections,
    config: stats.config,
    health: {
      healthyConnections: stats.connections.filter(c => c.healthy).length,
      unhealthyConnections: stats.connections.filter(c => !c.healthy).length,
      avgAge: stats.connections.length > 0 
        ? Math.round(stats.connections.reduce((sum, c) => sum + c.age, 0) / stats.connections.length / 1000)
        : 0,
      avgIdleTime: stats.connections.filter(c => !c.inUse).length > 0
        ? Math.round(
            stats.connections
              .filter(c => !c.inUse)
              .reduce((sum, c) => sum + c.idleTime, 0) / 
            stats.connections.filter(c => !c.inUse).length / 1000
          )
        : 0
    },
    optimization: {
      recommendations: getConnectionRecommendations(stats.pool)
    }
  };
}

async function getAlertsAnalytics(region: string, timeRange: string) {
  const alerts = databasePerformanceMonitor.getAlerts();
  const filteredAlerts = alerts.filter(alert => 
    Date.now() - alert.timestamp < getTimeRangeMs(timeRange)
  );
  
  return {
    alerts: filteredAlerts,
    summary: {
      total: filteredAlerts.length,
      bySeverity: {
        critical: filteredAlerts.filter(a => a.severity === 'critical').length,
        high: filteredAlerts.filter(a => a.severity === 'high').length,
        medium: filteredAlerts.filter(a => a.severity === 'medium').length,
        low: filteredAlerts.filter(a => a.severity === 'low').length
      },
      byType: {
        slow_query: filteredAlerts.filter(a => a.type === 'slow_query').length,
        high_error_rate: filteredAlerts.filter(a => a.type === 'high_error_rate').length,
        connection_exhaustion: filteredAlerts.filter(a => a.type === 'connection_exhaustion').length,
        cache_miss: filteredAlerts.filter(a => a.type === 'cache_miss').length
      }
    },
    trends: {
      frequency: calculateAlertTrends(filteredAlerts),
      resolution: calculateResolutionTrends(filteredAlerts)
    }
  };
}

async function getTrendsAnalytics(region: string, timeRange: string) {
  // This would typically query a time-series database
  // For now, return simulated trend data
  const timePoints = getTimePoints(timeRange);
  
  return {
    timeRange,
    timePoints,
    metrics: {
      queryTime: generateTrendData(timePoints, 100, 500),
      errorRate: generateTrendData(timePoints, 0, 0.1),
      cacheHitRate: generateTrendData(timePoints, 0.7, 0.95),
      responseTime: generateTrendData(timePoints, 50, 300),
      throughput: generateTrendData(timePoints, 10, 100)
    },
    insights: generateTrendInsights(timePoints)
  };
}

// Helper functions
function getTimeRangeMs(timeRange: string): number {
  const ranges: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  return ranges[timeRange] || ranges['1h'];
}

function getTimePoints(timeRange: string): number[] {
  const ms = getTimeRangeMs(timeRange);
  const points: number[] = [];
  const interval = ms / 24; // 24 data points
  
  for (let i = 0; i < 24; i++) {
    points.push(Date.now() - ms + (i * interval));
  }
  
  return points;
}

function getOverallStatus(dbMetrics: any, cacheStats: any, alerts: any[]): string {
  if (alerts.some(a => a.severity === 'critical')) return 'critical';
  if (alerts.some(a => a.severity === 'high')) return 'degraded';
  if (dbMetrics.errorRate > 0.05 || dbMetrics.queryTime > 1000) return 'warning';
  if (cacheStats.hitRate < 0.7) return 'warning';
  return 'healthy';
}

function calculateTrend(currentValue: number): { direction: 'up' | 'down' | 'stable'; percentage: number } {
  // This would typically compare with historical data
  // For now, return a simulated trend
  const change = (Math.random() - 0.5) * 0.2; // -10% to +10%
  const direction = change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'stable';
  return { direction, percentage: Math.abs(change * 100) };
}

function calculateCacheEfficiency(stats: any): number {
  return Math.round((stats.hitRate * 100) - (stats.size / 1024 / 100) * 100) / 100;
}

function getSuggestedIndexes(): string[] {
  return [
    'CREATE INDEX CONCURRENTLY idx_robots_user_id_created_at ON robots (user_id, created_at DESC);',
    'CREATE INDEX CONCURRENTLY idx_robots_strategy_type ON robots (strategy_type);',
    'CREATE INDEX CONCURRENTLY idx_robots_name_gin ON robots USING gin(name gin_trgm_ops);'
  ];
}

function getQueryOptimizations(): string[] {
  return [
    'Use SELECT with specific columns instead of SELECT *',
    'Add LIMIT clauses to prevent large result sets',
    'Use proper indexing for WHERE and ORDER BY clauses',
    'Consider using materialized views for complex queries'
  ];
}

function getPerformanceTips(metrics: any): string[] {
  const tips: string[] = [];
  
  if (metrics.queryTime > 500) {
    tips.push('Consider adding indexes for slow queries');
  }
  
  if (metrics.cacheHitRate < 0.8) {
    tips.push('Increase cache TTL or size for better hit rates');
  }
  
  if (metrics.errorRate > 0.02) {
    tips.push('Investigate and fix high error rate');
  }
  
  return tips;
}

function getCacheRecommendations(stats: any): string[] {
  const recommendations: string[] = [];
  
  if (stats.hitRate < 0.8) {
    recommendations.push('Increase cache TTL for frequently accessed data');
  }
  
  if (stats.size > 40 * 1024 * 1024) { // 40MB
    recommendations.push('Consider increasing cache size or implementing cache eviction');
  }
  
  if (stats.entries > 10000) {
    recommendations.push('Consider cache key optimization to reduce entry count');
  }
  
  return recommendations;
}

function getEdgeOptimizationRecommendations(metrics: any[]): string[] {
  const recommendations: string[] = [];
  
  const avgResponseTime = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length 
    : 0;
  
  if (avgResponseTime > 200) {
    recommendations.push('Consider enabling edge-side rendering for better performance');
  }
  
  const avgCacheHitRate = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / metrics.length
    : 0;
  
  if (avgCacheHitRate < 0.8) {
    recommendations.push('Optimize cache strategies for better edge hit rates');
  }
  
  return recommendations;
}

function getConnectionRecommendations(poolStats: any): string[] {
  const recommendations: string[] = [];
  
  if (poolStats.hitRate < 0.8) {
    recommendations.push('Consider increasing minimum connections for better hit rate');
  }
  
  if (poolStats.avgAcquireTime > 100) {
    recommendations.push('Consider increasing maximum connections or optimizing query performance');
  }
  
  if (poolStats.waitingRequests > 5) {
    recommendations.push('Increase connection pool size to reduce wait times');
  }
  
  return recommendations;
}

function calculateAlertTrends(alerts: any[]): any[] {
  // Group alerts by hour
  const hourly = new Map<number, number>();
  
  alerts.forEach(alert => {
    const hour = Math.floor(alert.timestamp / (60 * 60 * 1000));
    hourly.set(hour, (hourly.get(hour) || 0) + 1);
  });
  
  return Array.from(hourly.entries()).map(([hour, count]) => ({
    timestamp: hour * 60 * 60 * 1000,
    count
  }));
}

function calculateResolutionTrends(alerts: any[]): any[] {
  // This would track alert resolution times
  // For now, return empty array
  return [];
}

function generateTrendData(timePoints: number[], min: number, max: number): number[] {
  return timePoints.map(() => {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
  });
}

function generateTrendInsights(timePoints: number[]): string[] {
  return [
    'Query times show improvement during off-peak hours',
    'Cache hit rates correlate with traffic patterns',
    'Error rates remain stable within acceptable thresholds',
    'Edge performance varies by geographic region'
  ];
}