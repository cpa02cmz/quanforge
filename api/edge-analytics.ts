/**
 * Edge Analytics API Endpoint with Real-time Streaming
 * Collects and analyzes edge performance metrics with live streaming capabilities
 */

<<<<<<< HEAD
import { edgeMetrics as edgeMetricsCollector } from '../services/edgeMetrics';
import { vercelEdgeOptimizer } from '../services/vercelEdgeOptimizer';

// Proper logging interface for edge environment
interface EdgeLogger {
  error: (message: string, context?: Record<string, unknown>) => void;
  log: (message: string, context?: Record<string, unknown>) => void;
}

const edgeLogger: EdgeLogger = {
  error: (message: string, context?: Record<string, unknown>) => {
    if (typeof globalThis.console !== 'undefined') {
      globalThis.console.error(message, context);
    }
  },
  log: (message: string, context?: Record<string, unknown>) => {
    if (typeof globalThis.console !== 'undefined' && typeof globalThis.console.log !== 'undefined') {
      globalThis.console.log(message, context);
    }
  }
};

export const config = {
  runtime: 'edge',
=======
import { edgeMetricsCollector } from '../services/edgeMetrics';
import { vercelEdgeOptimizer } from '../services/vercelEdgeOptimizer';

export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
  prefersStatic: true
};

// Real-time streaming connections
const streamingConnections = new Map<string, {
  controller: ReadableStreamDefaultController;
  lastPing: number;
  region: string;
  filters: AnalyticsFilters;
}>();

<<<<<<< HEAD
// Analytics data buffer for streaming (not used currently but available for future)
// const analyticsBuffer = new Map<string, {
//   data: StreamingMetrics[];
//   maxSize: number;
//   ttl: number;
// }>();
=======
// Analytics data buffer for streaming
const analyticsBuffer = new Map<string, {
  data: any[];
  maxSize: number;
  ttl: number;
}>();
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)

interface AnalyticsFilters {
  regions?: string[];
  metrics?: string[];
  timeWindow?: number;
  threshold?: number;
}

<<<<<<< HEAD
interface EdgeMetrics {
  region: string;
  responseTime: number;
  cacheHitRate: number;
  throughput: number;
  errorRate: number;
  timestamp: number;
}

=======
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
  analytics: {
    globalCacheHitRate?: number;
    totalBandwidthSaved?: number;
    totalRequests?: number;
    errorRate?: number;
    performanceScore?: number;
  };
=======
  analytics: any;
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
  userAgent: string;
  url: string;
}

interface AnalyticsResponse {
  success: boolean;
<<<<<<< HEAD
  metrics?: {
    region: string;
    responseTime: number;
    performanceScore: number;
    totalRequests: number;
    cacheHitRate: number;
  };
=======
  metrics?: any;
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
        
<<<<<<< HEAD
// Record edge metrics
        edgeMetricsCollector.recordMetric({
          region,
          responseTime,
          cacheHitRate: payload.analytics.globalCacheHitRate || 0,
          throughput: 100, // Mock throughput in requests/month  
          errorRate: payload.analytics.errorRate || 0,
          timestamp: Date.now()
=======
        // Record edge metrics
        edgeMetricsCollector.recordMetric(region, {
          responseTime,
          cacheHitRate: payload.analytics.globalCacheHitRate || 0,
          bandwidthSaved: payload.analytics.totalBandwidthSaved || 0,
          requestsServed: payload.analytics.totalRequests || 1,
          errorRate: payload.analytics.errorRate || 0,
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
        edgeLogger.error('Analytics processing error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
=======
        console.error('Analytics processing error:', error);
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
        
<<<<<<< HEAD
// Get edge metrics
        const currentEdgeMetrics = edgeMetricsCollector.getMetricsByRegion(region);
=======
        // Get edge metrics
        const edgeMetrics = edgeMetricsCollector.getMetricsByRegion(region);
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
        const averageMetrics = edgeMetricsCollector.getAverageMetrics(timeWindow);
        const performanceScore = edgeMetricsCollector.getPerformanceScore();
        const cachePerformance = edgeMetricsCollector.getCachePerformance();
        
        // Get Vercel edge optimizer metrics
        const vercelMetrics = vercelEdgeOptimizer.getEdgeMetrics();
        
        const response = {
          success: true,
          region,
          timeWindow,
          edgeMetrics: {
<<<<<<< HEAD
            totalRequests: currentEdgeMetrics.length,
=======
            totalRequests: edgeMetrics.length,
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
            averageResponseTime: averageMetrics.avgResponseTime,
            cacheHitRate: averageMetrics.avgCacheHitRate,
            errorRate: averageMetrics.avgErrorRate,
            throughput: averageMetrics.avgThroughput,
            performanceScore,
          },
          cachePerformance,
          vercelMetrics,
<<<<<<< HEAD
          recommendations: [], // getPerformanceRecommendations method doesn't exist
=======
          recommendations: edgeMetricsCollector.getPerformanceRecommendations(),
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
        edgeLogger.error('Analytics summary error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
=======
        console.error('Analytics summary error:', error);
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
        const performanceScore = edgeMetricsCollector.getPerformanceScore();
<<<<<<< HEAD
        const recommendations: string[] = []; // getPerformanceRecommendations method doesn't exist
=======
        const recommendations = edgeMetricsCollector.getPerformanceRecommendations();
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
        
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
<<<<<<< HEAD
        edgeLogger.error('Performance score error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
=======
        console.error('Performance score error:', error);
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
                edgeLogger.error('Streaming error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
=======
                console.error('Streaming error:', error);
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
        edgeLogger.error('Streaming setup error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
=======
        console.error('Streaming setup error:', error);
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
        edgeLogger.error('Aggregation error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
=======
        console.error('Aggregation error:', error);
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
try {
        edgeMetricsCollector.simulateEdgePerformance();
=======
      try {
        edgeMetricsCollector.simulateEdgePerformance();
        
        // Broadcast to all streaming connections
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
        edgeLogger.error('Simulation error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
=======
        console.error('Simulation error:', error);
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
    edgeLogger.error('Edge analytics function error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
=======
    console.error('Edge analytics function error:', error);
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
  const currentEdgeMetrics = edgeMetricsCollector.getMetricsByRegion(region);
  const averageMetrics = edgeMetricsCollector.getAverageMetrics(filters.timeWindow || 300000);
  
  // Apply filters
  let filteredMetrics = currentEdgeMetrics;
=======
  const edgeMetrics = edgeMetricsCollector.getMetricsByRegion(region);
  const averageMetrics = edgeMetricsCollector.getAverageMetrics(filters.timeWindow || 300000);
  
  // Apply filters
  let filteredMetrics = edgeMetrics;
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
function broadcastToStreams(message: {
  type: string;
  message?: string;
  timestamp: number;
  data?: StreamingMetrics;
  error?: string;
}): void {
=======
function broadcastToStreams(message: any): void {
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
  const now = Date.now();
  
  for (const [clientId, connection] of streamingConnections.entries()) {
    try {
      // Remove stale connections
      if (now - connection.lastPing > 30000) { // 30 seconds timeout
        try {
          connection.controller.close();
<<<<<<< HEAD
        } catch {
=======
        } catch (e) {
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
          // Ignore close errors
        }
        streamingConnections.delete(clientId);
        continue;
      }

      // Send message
      connection.controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
    } catch (error) {
<<<<<<< HEAD
      edgeLogger.error(`Failed to send to stream ${clientId}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
=======
      console.error(`Failed to send to stream ${clientId}:`, error);
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
}): Promise<{
  aggregation: {
    timeRange: string;
    groupBy: string;
    metrics: string[];
    regions: string[];
    totalDataPoints: number;
  };
  data: Record<string, {
    responseTime?: number;
    cacheHitRate?: number;
    errorRate?: number;
    bandwidthSaved?: number;
    requestsServed?: number;
    throughput?: number;
    count?: number;
    minTimestamp?: number;
    maxTimestamp?: number;
  }>;
  summary: Record<string, {
    min: number;
    max: number;
    avg: number;
    total: number;
  }>;
}> {
  const timeWindow = parseTimeRange(options.timeRange);
  const aggregated: Record<string, {
    responseTime?: number;
    cacheHitRate?: number;
    errorRate?: number;
    bandwidthSaved?: number;
    requestsServed?: number;
    throughput?: number;
    count?: number;
    minTimestamp?: number;
    maxTimestamp?: number;
  }> = {};
=======
}): Promise<any> {
  const timeWindow = parseTimeRange(options.timeRange);
  const aggregated: Record<string, any> = {};
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)

  for (const region of options.regions) {
    const metrics = edgeMetricsCollector.getMetricsByRegion(region);
    const filteredMetrics = metrics.filter(m => 
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
<<<<<<< HEAD
function groupByTimeBuckets(metrics: EdgeMetrics[], bucketSize: number): Map<number, EdgeMetrics[]> {
  const buckets = new Map<number, EdgeMetrics[]>();
=======
function groupByTimeBuckets(metrics: any[], bucketSize: number): Map<number, any[]> {
  const buckets = new Map<number, any[]>();
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
  
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
<<<<<<< HEAD
function calculateAggregatedMetrics(dataPoints: EdgeMetrics[], requestedMetrics: string[]): Record<string, number> {
=======
function calculateAggregatedMetrics(dataPoints: any[], requestedMetrics: string[]): any {
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
function calculateSummaryStats(aggregatedData: Record<string, Record<string, number>>): Record<string, {
  min: number;
  max: number;
  avg: number;
  total: number;
}> {
=======
function calculateSummaryStats(aggregatedData: Record<string, any>): any {
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
  const values = Object.values(aggregatedData);
  
  if (values.length === 0) {
    return {};
  }

<<<<<<< HEAD
  const summary: Record<string, {
  min: number;
  max: number;
  avg: number;
  total: number;
}> = {};
=======
  const summary: Record<string, any> = {};
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
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
<<<<<<< HEAD
      } catch {
=======
      } catch (e) {
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
        // Ignore close errors
      }
      streamingConnections.delete(clientId);
    }
  });
  
  if (staleConnections.length > 0) {
<<<<<<< HEAD
    edgeLogger.log(`Cleaned up ${staleConnections.length} stale streaming connections`, { 
        count: staleConnections.length,
        timestamp: Date.now()
      });
=======
    console.log(`Cleaned up ${staleConnections.length} stale streaming connections`);
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
  }
}, 10000); // Check every 10 seconds