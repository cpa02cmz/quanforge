/**
 * Edge Analytics API Endpoint with Real-time Streaming
 * Collects and analyzes edge performance metrics with live streaming capabilities
 */

import { edgeMetrics } from '../services/edgeMetrics';
import { vercelEdgeOptimizer } from '../services/vercelEdgeOptimizer';

export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
  prefersStatic: true
};

// Real-time streaming connections
const streamingConnections = new Map<string, {
  controller: ReadableStreamDefaultController;
  lastPing: number;
  region: string;
  filters: AnalyticsFilters;
}>();

// Analytics data buffer for streaming (available for future use)

interface AnalyticsFilters {
  regions?: string[];
  metrics?: string[];
  timeWindow?: number;
  threshold?: number;
}

interface StreamingMetrics {
  timestamp: number;
  region: string;
  responseTime: number;
  cacheHitRate: number;
  bandwidthSaved: number;
  requestsServed: number;
  errorRate: number;
  throughput: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

interface AnalyticsPayload {
  timestamp: number;
  analytics: any;
  userAgent: string;
  url: string;
}

interface AnalyticsResponse {
  success: boolean;
  metrics?: any;
  recommendations?: string[];
  performanceScore?: number;
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const startTime = Date.now();
  
  // Add security and performance headers
  const headers = {
    'Cache-Control': 'public, max-age=300, s-maxage=600',
    'X-Edge-Function': 'edge-analytics',
    'X-Response-Time': `${Date.now() - startTime}ms`,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' ? 'https://quanforge.ai' : '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200, 
        headers 
      });
    }

    // POST endpoint for receiving analytics data
    if (url.pathname === '/api/analytics/edge-metrics' && req.method === 'POST') {
      try {
        const payload: AnalyticsPayload = await req.json();
        
        // Validate payload
        if (!payload.analytics || !payload.timestamp) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid payload structure'
          } as AnalyticsResponse), {
            status: 400,
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            }
          });
        }

        // Process analytics data
        const region = req.headers.get('x-vercel-region') || 'unknown';
        const responseTime = Date.now() - startTime;
        
        // Record edge metrics
        edgeMetrics.recordMetric({
          region,
          responseTime,
          cacheHitRate: payload.analytics.globalCacheHitRate || 0,
          throughput: payload.analytics.totalRequests || 1,
          errorRate: payload.analytics.errorRate || 0,
          timestamp: Date.now()
        });

        // Get performance recommendations
        const recommendations = vercelEdgeOptimizer.getEdgeMetrics().length > 0 
          ? ['Edge performance is being monitored', 'Continue monitoring cache hit rates']
          : ['Enable edge metrics collection for better insights'];

        const response: AnalyticsResponse = {
          success: true,
          metrics: {
            region,
            responseTime,
            performanceScore: payload.analytics.performanceScore || 0,
            totalRequests: payload.analytics.totalRequests || 0,
            cacheHitRate: payload.analytics.globalCacheHitRate || 0,
          },
          recommendations,
          performanceScore: payload.analytics.performanceScore || 0,
        };

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          }
        });
      } catch (error) {
        console.error('Analytics processing error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to process analytics data'
        } as AnalyticsResponse), {
          status: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          }
        });
      }
    }

    // GET endpoint for retrieving analytics summary
    if (url.pathname === '/api/analytics/summary' && req.method === 'GET') {
      try {
        const region = req.headers.get('x-vercel-region') || 'unknown';
        const timeWindow = parseInt(url.searchParams.get('window') || '300000'); // 5 minutes default
        
        // Get edge metrics
        const currentEdgeMetrics = edgeMetrics.getMetricsByRegion(region);
        const averageMetrics = edgeMetrics.getAverageMetrics(timeWindow);
        const performanceScore = edgeMetrics.getPerformanceScore();
        const cachePerformance = edgeMetrics.getCachePerformance();
        
        // Get Vercel edge optimizer metrics
        const vercelMetrics = vercelEdgeOptimizer.getEdgeMetrics();
        
        const response = {
          success: true,
          region,
          timeWindow,
          edgeMetrics: {
            totalRequests: currentEdgeMetrics.length,
            averageResponseTime: averageMetrics.avgResponseTime,
            cacheHitRate: averageMetrics.avgCacheHitRate,
            errorRate: averageMetrics.avgErrorRate,
            throughput: averageMetrics.avgThroughput,
            performanceScore,
          },
          cachePerformance,
          vercelMetrics,
          recommendations: [],
          timestamp: Date.now(),
        };

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          }
        });
      } catch (error) {
        console.error('Analytics summary error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to retrieve analytics summary'
        } as AnalyticsResponse), {
          status: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          }
        });
      }
    }

    // GET endpoint for performance score
    if (url.pathname === '/api/analytics/performance-score' && req.method === 'GET') {
      try {
        const region = req.headers.get('x-vercel-region') || 'unknown';
        const performanceScore = edgeMetrics.getPerformanceScore();
        const recommendations = [];
        
        const response = {
          success: true,
          region,
          performanceScore,
          recommendations,
          timestamp: Date.now(),
        };

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          }
        });
      } catch (error) {
        console.error('Performance score error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to calculate performance score'
        } as AnalyticsResponse), {
          status: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          }
        });
      }
    }

    // Real-time streaming endpoint
    if (url.pathname === '/api/analytics/stream' && req.method === 'GET') {
      try {
        const region = req.headers.get('x-vercel-region') || 'unknown';
        const clientId = crypto.randomUUID();
        
        // Parse filters from query parameters
        const filters: AnalyticsFilters = {
          regions: url.searchParams.get('regions')?.split(',') || undefined,
          metrics: url.searchParams.get('metrics')?.split(',') || undefined,
          timeWindow: parseInt(url.searchParams.get('timeWindow') || '300000'),
          threshold: parseFloat(url.searchParams.get('threshold') || '0')
        };

        // Create streaming response
        const stream = new ReadableStream({
          start(controller) {
            // Register streaming connection
            streamingConnections.set(clientId, {
              controller,
              lastPing: Date.now(),
              region,
              filters
            });

            // Send initial connection message
            const initMessage = {
              type: 'connected',
              clientId,
              region,
              timestamp: Date.now(),
              filters
            };
            controller.enqueue(`data: ${JSON.stringify(initMessage)}\n\n`);

            // Start periodic data streaming
            const interval = setInterval(() => {
              if (!streamingConnections.has(clientId)) {
                clearInterval(interval);
                return;
              }

              try {
                const metrics = collectStreamingMetrics(region, filters);
                const message = {
                  type: 'metrics',
                  data: metrics,
                  timestamp: Date.now()
                };
                controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
              } catch (error) {
                console.error('Streaming error:', error);
                const errorMessage = {
                  type: 'error',
                  error: 'Failed to collect metrics',
                  timestamp: Date.now()
                };
                controller.enqueue(`data: ${JSON.stringify(errorMessage)}\n\n`);
              }
            }, 1000); // Stream every second

            // Cleanup on connection close
            req.signal.addEventListener('abort', () => {
              clearInterval(interval);
              streamingConnections.delete(clientId);
            });
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' ? 'https://quanforge.ai' : '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
          }
        });
      } catch (error) {
        console.error('Streaming setup error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to establish streaming connection'
        } as AnalyticsResponse), {
          status: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          }
        });
      }
    }

    // Enhanced analytics aggregation endpoint
    if (url.pathname === '/api/analytics/aggregate' && req.method === 'POST') {
      try {
        const body = await req.json();
        const { timeRange, groupBy, metrics, regions } = body;
        
        const aggregatedData = await aggregateAnalyticsData({
          timeRange: timeRange || '1h',
          groupBy: groupBy || 'region',
          metrics: metrics || ['responseTime', 'cacheHitRate', 'throughput'],
          regions: regions || ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1']
        });

        return new Response(JSON.stringify({
          success: true,
          data: aggregatedData,
          timestamp: Date.now()
        }), {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          }
        });
      } catch (error) {
        console.error('Aggregation error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to aggregate analytics data'
        } as AnalyticsResponse), {
          status: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          }
        });
      }
    }

    // Simulate edge performance for testing
    if (url.pathname === '/api/analytics/simulate' && req.method === 'POST') {
      try {
        edgeMetrics.simulateEdgePerformance();
        
        // Broadcast to all streaming connections
        broadcastToStreams({
          type: 'simulation',
          message: 'Edge performance simulation completed',
          timestamp: Date.now()
        });
        
        const response = {
          success: true,
          message: 'Edge performance simulation completed',
          timestamp: Date.now(),
        };

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          }
        });
      } catch (error) {
        console.error('Simulation error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to simulate edge performance'
        } as AnalyticsResponse), {
          status: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          }
        });
      }
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Endpoint not found'
    } as AnalyticsResponse), { 
      status: 404, 
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      }
    });

  } catch (error) {
    console.error('Edge analytics function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal Server Error',
      message: 'An error occurred while processing your request'
    } as AnalyticsResponse), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      }
    });
  }
}

/**
 * Collect metrics for streaming
 */
function collectStreamingMetrics(region: string, filters: AnalyticsFilters): StreamingMetrics {
  const currentEdgeMetrics = edgeMetrics.getMetricsByRegion(region);
  const averageMetrics = edgeMetrics.getAverageMetrics(filters.timeWindow || 300000);
  
  // Apply filters
  let filteredMetrics = currentEdgeMetrics;
  if (filters.regions && filters.regions.length > 0) {
    filteredMetrics = filteredMetrics.filter(m => filters.regions!.includes(m.region));
  }

  return {
    timestamp: Date.now(),
    region,
    responseTime: averageMetrics.avgResponseTime || 0,
    cacheHitRate: averageMetrics.avgCacheHitRate || 0,
    bandwidthSaved: averageMetrics.avgBandwidthSaved || 0,
    requestsServed: filteredMetrics.length,
    errorRate: averageMetrics.avgErrorRate || 0,
    throughput: averageMetrics.avgThroughput || 0,
    memoryUsage: getMemoryUsage(),
    cpuUsage: getCpuUsage()
  };
}

/**
 * Broadcast message to all streaming connections
 */
function broadcastToStreams(message: any): void {
  const now = Date.now();
  
  for (const [clientId, connection] of streamingConnections.entries()) {
    try {
      // Remove stale connections
      if (now - connection.lastPing > 30000) { // 30 seconds timeout
        try {
          connection.controller.close();
        } catch (e) {
          // Ignore close errors
        }
        streamingConnections.delete(clientId);
        continue;
      }

      // Send message
      connection.controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
    } catch (error) {
      console.error(`Failed to send to stream ${clientId}:`, error);
      streamingConnections.delete(clientId);
    }
  }
}

/**
 * Aggregate analytics data by different dimensions
 */
async function aggregateAnalyticsData(options: {
  timeRange: string;
  groupBy: string;
  metrics: string[];
  regions: string[];
}): Promise<any> {
  const timeWindow = parseTimeRange(options.timeRange);
  const aggregated: Record<string, any> = {};

  for (const region of options.regions) {
    const regionMetrics = edgeMetrics.getMetricsByRegion(region);
    const filteredMetrics = regionMetrics.filter(m => 
      Date.now() - m.timestamp <= timeWindow
    );

    if (options.groupBy === 'region') {
      aggregated[region] = calculateAggregatedMetrics(filteredMetrics, options.metrics);
    } else if (options.groupBy === 'time') {
      // Group by time buckets (e.g., 5-minute intervals)
      const timeBuckets = groupByTimeBuckets(filteredMetrics, 300000); // 5 minutes
      timeBuckets.forEach((bucket, timestamp) => {
        const key = `${region}_${timestamp}`;
        aggregated[key] = calculateAggregatedMetrics(bucket, options.metrics);
      });
    }
  }

  return {
    aggregation: {
      timeRange: options.timeRange,
      groupBy: options.groupBy,
      metrics: options.metrics,
      regions: options.regions,
      totalDataPoints: Object.values(aggregated).length
    },
    data: aggregated,
    summary: calculateSummaryStats(aggregated)
  };
}

/**
 * Parse time range string to milliseconds
 */
function parseTimeRange(timeRange: string): number {
  const unit = timeRange.slice(-1);
  const value = parseInt(timeRange.slice(0, -1));
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 300000; // Default 5 minutes
  }
}

/**
 * Group metrics by time buckets
 */
function groupByTimeBuckets(metrics: any[], bucketSize: number): Map<number, any[]> {
  const buckets = new Map<number, any[]>();
  
  metrics.forEach(metric => {
    const bucketTimestamp = Math.floor(metric.timestamp / bucketSize) * bucketSize;
    
    if (!buckets.has(bucketTimestamp)) {
      buckets.set(bucketTimestamp, []);
    }
    
    buckets.get(bucketTimestamp)!.push(metric);
  });
  
  return buckets;
}

/**
 * Calculate aggregated metrics for a group of data points
 */
function calculateAggregatedMetrics(dataPoints: any[], requestedMetrics: string[]): any {
  if (dataPoints.length === 0) {
    return requestedMetrics.reduce((acc, metric) => {
      acc[metric] = 0;
      return acc;
    }, {} as Record<string, number>);
  }

  const aggregated: Record<string, number> = {};
  
  requestedMetrics.forEach(metric => {
    const values = dataPoints.map(dp => dp[metric] || 0);
    
    switch (metric) {
      case 'responseTime':
        aggregated[metric] = values.reduce((sum, val) => sum + val, 0) / values.length;
        break;
      case 'cacheHitRate':
      case 'errorRate':
        aggregated[metric] = values.reduce((sum, val) => sum + val, 0) / values.length;
        break;
      case 'bandwidthSaved':
      case 'requestsServed':
      case 'throughput':
        aggregated[metric] = values.reduce((sum, val) => sum + val, 0);
        break;
      default:
        aggregated[metric] = values.reduce((sum, val) => sum + val, 0) / values.length;
    }
  });
  
  aggregated.count = dataPoints.length;
  aggregated.minTimestamp = Math.min(...dataPoints.map(dp => dp.timestamp));
  aggregated.maxTimestamp = Math.max(...dataPoints.map(dp => dp.timestamp));
  
  return aggregated;
}

/**
 * Calculate summary statistics for aggregated data
 */
function calculateSummaryStats(aggregatedData: Record<string, any>): any {
  const values = Object.values(aggregatedData);
  
  if (values.length === 0) {
    return {};
  }

  const summary: Record<string, any> = {};
  const metrics = Object.keys(values[0]).filter(key => 
    !['count', 'minTimestamp', 'maxTimestamp'].includes(key)
  );

  metrics.forEach(metric => {
    const metricValues = values.map(v => v[metric] || 0);
    summary[metric] = {
      min: Math.min(...metricValues),
      max: Math.max(...metricValues),
      avg: metricValues.reduce((sum, val) => sum + val, 0) / metricValues.length,
      total: metricValues.reduce((sum, val) => sum + val, 0)
    };
  });

  return summary;
}

/**
 * Get memory usage (mock implementation for edge environment)
 */
function getMemoryUsage(): number {
  // In a real implementation, this would use appropriate edge runtime APIs
  return Math.random() * 100; // Mock memory usage percentage
}

/**
 * Get CPU usage (mock implementation for edge environment)
 */
function getCpuUsage(): number {
  // In a real implementation, this would use appropriate edge runtime APIs
  return Math.random() * 100; // Mock CPU usage percentage
}

/**
 * Cleanup stale streaming connections
 */
setInterval(() => {
  const now = Date.now();
  const staleConnections: string[] = [];
  
  for (const [clientId, connection] of streamingConnections.entries()) {
    if (now - connection.lastPing > 30000) { // 30 seconds
      staleConnections.push(clientId);
    }
  }
  
  staleConnections.forEach(clientId => {
    const connection = streamingConnections.get(clientId);
    if (connection) {
      try {
        connection.controller.close();
      } catch (e) {
        // Ignore close errors
      }
      streamingConnections.delete(clientId);
    }
  });
  
  if (staleConnections.length > 0) {
    console.log(`Cleaned up ${staleConnections.length} stale streaming connections`);
  }
}, 10000); // Check every 10 seconds