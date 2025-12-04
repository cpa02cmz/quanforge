import { NextRequest, NextResponse } from 'next/server';

interface EdgeMetrics {
  region: string;
  timestamp: string;
  responseTime: number;
  cacheStatus: string;
  endpoint: string;
  userAgent: string;
  latency: number;
  memoryUsage?: number;
  cacheHitRate?: number;
}

// In-memory storage for demo purposes (in production, use Redis or similar)
const metricsStore: EdgeMetrics[] = [];
const MAX_METRICS = 1000; // Keep last 1000 metrics

export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1', 'cle1'],
};

export default async function handler(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const url = new URL(req.url);
    const region = req.headers.get('x-vercel-region') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    if (req.method === 'GET') {
      // Return aggregated metrics
      const recentMetrics = metricsStore.slice(-100); // Last 100 metrics
      
      const aggregated = {
        totalRequests: recentMetrics.length,
        averageResponseTime: recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length || 0,
        averageLatency: recentMetrics.reduce((sum, m) => sum + m.latency, 0) / recentMetrics.length || 0,
        cacheHitRate: recentMetrics.filter(m => m.cacheStatus === 'HIT').length / recentMetrics.length * 100 || 0,
        regionDistribution: recentMetrics.reduce((acc, m) => {
          acc[m.region] = (acc[m.region] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        topEndpoints: recentMetrics.reduce((acc, m) => {
          acc[m.endpoint] = (acc[m.endpoint] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        timestamp: new Date().toISOString(),
        region,
      };
      
      return NextResponse.json(aggregated, {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300',
          'X-Edge-Metrics': 'realtime',
          'X-Region': region,
        }
      });
    }
    
    if (req.method === 'POST') {
      // Record new metrics
      const body = await req.json();
      const metric: EdgeMetrics = {
        region,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        cacheStatus: req.headers.get('x-edge-cache-status') || 'UNKNOWN',
        endpoint: body.endpoint || url.pathname,
        userAgent,
        latency: body.latency || 0,
        memoryUsage: body.memoryUsage,
        cacheHitRate: body.cacheHitRate,
      };
      
      metricsStore.push(metric);
      
      // Keep only recent metrics
      if (metricsStore.length > MAX_METRICS) {
        metricsStore.splice(0, metricsStore.length - MAX_METRICS);
      }
      
      return NextResponse.json({ success: true, recorded: true }, {
        headers: {
          'Cache-Control': 'no-cache',
          'X-Edge-Metrics': 'recorded',
        }
      });
    }
    
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    
  } catch (error) {
    console.error('Edge metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}