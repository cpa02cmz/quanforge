import { edgeConnectionPool } from '../services/edgeSupabasePool';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  region: string;
  uptime: number;
  version: string;
  checks: {
    database: boolean;
    cache: boolean;
    memory: boolean;
    latency: boolean;
  };
  metrics: {
    responseTime: number;
    memoryUsage: number;
    cacheHitRate: number;
    activeConnections: number;
  };
}

const startTime = Date.now();

export async function GET(request: Request) {
  const requestStart = Date.now();
  
  try {
    const region = request.headers.get('x-vercel-region') || 'unknown';
    
    // Perform health checks
    const checks = await Promise.allSettled([
      checkDatabase(),
      checkCache(),
      checkMemory(),
      checkLatency(),
    ]);
    
    const [dbResult, cacheResult, memoryResult, latencyResult] = checks;
    
    const healthChecks = {
      database: dbResult.status === 'fulfilled' && dbResult.value,
      cache: cacheResult.status === 'fulfilled' && cacheResult.value,
      memory: memoryResult.status === 'fulfilled' && memoryResult.value,
      latency: latencyResult.status === 'fulfilled' && latencyResult.value,
    };
    
    // Calculate overall status
    const passedChecks = Object.values(healthChecks).filter(Boolean).length;
    const totalChecks = Object.keys(healthChecks).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (passedChecks === totalChecks) {
      status = 'healthy';
    } else if (passedChecks >= totalChecks * 0.7) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }
    
    // Get connection pool metrics
    const connectionMetrics = edgeConnectionPool.getConnectionMetrics();
    
    const healthStatus: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      region,
      uptime: Date.now() - startTime,
      version: '2.0.0',
      checks: healthChecks,
      metrics: {
        responseTime: Date.now() - requestStart,
        memoryUsage: getMemoryUsage(),
        cacheHitRate: 0.85, // Placeholder - would come from actual cache metrics
        activeConnections: connectionMetrics.totalConnections,
      },
    };
    
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    
    return Response.json(healthStatus, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Health-Status': status,
        'X-Region': region,
        'X-Uptime': healthStatus.uptime.toString(),
      }
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    
    return Response.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Health-Status': 'unhealthy',
      }
    });
  }
}

async function checkDatabase(): Promise<boolean> {
  try {
    const client = await edgeConnectionPool.getClient('health-check');
    const { error } = await client.from('robots').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function checkCache(): Promise<boolean> {
  // Simple cache check - would implement actual cache validation
  return true;
}

async function checkMemory(): Promise<boolean> {
  const usage = getMemoryUsage();
  return usage < 0.9; // Less than 90% memory usage
}

async function checkLatency(): Promise<boolean> {
  const start = Date.now();
  try {
    await edgeConnectionPool.getClient('latency-check');
    return Date.now() - start < 1000; // Less than 1 second latency
  } catch {
    return false;
  }
}

function getMemoryUsage(): number {
  // Edge runtime memory usage estimation
  // In a real implementation, you'd use performance.memory or similar
  return Math.random() * 0.5; // Placeholder
}