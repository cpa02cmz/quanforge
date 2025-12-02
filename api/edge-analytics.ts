/**
 * Edge Analytics API Endpoint
 * Collects and analyzes edge performance metrics
 */

import { edgeMetricsCollector } from '../services/edgeMetrics';
import { vercelEdgeOptimizer } from '../services/vercelEdgeOptimizer';

export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
  prefersStatic: true
};

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
        edgeMetricsCollector.recordMetric(region, {
          responseTime,
          cacheHitRate: payload.analytics.globalCacheHitRate || 0,
          bandwidthSaved: payload.analytics.totalBandwidthSaved || 0,
          requestsServed: payload.analytics.totalRequests || 1,
          errorRate: payload.analytics.errorRate || 0,
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
        const edgeMetrics = edgeMetricsCollector.getMetricsByRegion(region);
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
            totalRequests: edgeMetrics.length,
            averageResponseTime: averageMetrics.avgResponseTime,
            cacheHitRate: averageMetrics.avgCacheHitRate,
            errorRate: averageMetrics.avgErrorRate,
            throughput: averageMetrics.avgThroughput,
            performanceScore,
          },
          cachePerformance,
          vercelMetrics,
          recommendations: edgeMetricsCollector.getPerformanceRecommendations(),
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
        const performanceScore = edgeMetricsCollector.getPerformanceScore();
        const recommendations = edgeMetricsCollector.getPerformanceRecommendations();
        
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

    // Simulate edge performance for testing
    if (url.pathname === '/api/analytics/simulate' && req.method === 'POST') {
      try {
        edgeMetricsCollector.simulateEdgePerformance();
        
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