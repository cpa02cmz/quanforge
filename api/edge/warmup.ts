/**
 * Edge Warmup API
 * Proactive edge function and connection warming
 */

import { NextRequest, NextResponse } from 'next/server';
import { enhancedConnectionPool } from '../../../services/enhancedSupabasePool';
import { edgeCacheManager } from '../../../services/edgeCacheManager';

interface WarmupRequest {
  functions?: string[];
  regions?: string[];
  patterns?: string[];
  priority?: 'low' | 'medium' | 'high';
}

interface WarmupResult {
  success: boolean;
  results: {
    connections: { region: string; success: boolean; duration: number; error?: string }[];
    cache: { pattern: string; success: boolean; keysWarmed: number; duration: number; error?: string }[];
    functions: { function: string; region: string; success: boolean; duration: number; error?: string }[];
  };
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    totalDuration: number;
  };
  timestamp: number;
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const body: WarmupRequest = await request.json();
    const { functions = [], regions = [], patterns = [], priority = 'medium' } = body;
    
    const currentRegion = request.headers.get('x-vercel-region') || 'unknown';
    const targetRegions = regions.length > 0 ? regions : [currentRegion];
    
    // Warmup started

    const results: WarmupResult['results'] = {
      connections: [],
      cache: [],
      functions: []
    };

    // Warm up database connections
    const connectionPromises = targetRegions.map(async (region) => {
      const connStartTime = performance.now();
      try {
        await enhancedConnectionPool.warmRegionConnection(region);
        const duration = performance.now() - connStartTime;
        
        results.connections.push({
          region,
          success: true,
          duration
        });
      } catch (error) {
        const duration = performance.now() - connStartTime;
        
        results.connections.push({
          region,
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Warm up read replicas
    const readReplicaPromise = enhancedConnectionPool.warmUpReadReplicas();
    connectionPromises.push(readReplicaPromise);

    // Warm up cache with patterns
    const cachePromises = patterns.map(async (pattern) => {
      const cacheStartTime = performance.now();
      try {
        const keysWarmed = await edgeCacheManager.warmupPattern(pattern);
        const duration = performance.now() - cacheStartTime;
        
        results.cache.push({
          pattern,
          success: true,
          keysWarmed: keysWarmed.length,
          duration
        });
      } catch (error) {
        const duration = performance.now() - cacheStartTime;
        
        results.cache.push({
          pattern,
          success: false,
          keysWarmed: 0,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Warm up edge functions if specified
    const functionPromises = functions.map(async (functionName) => {
      return Promise.all(targetRegions.map(async (region) => {
        const funcStartTime = performance.now();
        try {
          await warmEdgeFunction(functionName, region);
          const duration = performance.now() - funcStartTime;
          
          results.functions.push({
            function: functionName,
            region,
            success: true,
            duration
          });
        } catch (error) {
          const duration = performance.now() - funcStartTime;
          
          results.functions.push({
            function: functionName,
            region,
            success: false,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }));
    });

    // Execute all warmup operations
    await Promise.allSettled([
      ...connectionPromises,
      ...cachePromises,
      ...functionPromises
    ]);

    const totalDuration = performance.now() - startTime;
    const allOperations = [
      ...results.connections,
      ...results.cache,
      ...results.functions
    ];

    const summary = {
      totalOperations: allOperations.length,
      successfulOperations: allOperations.filter(op => op.success).length,
      failedOperations: allOperations.filter(op => !op.success).length,
      totalDuration
    };

    const result: WarmupResult = {
      success: summary.failedOperations === 0,
      results,
      summary,
      timestamp: Date.now()
    };

    // Log warmup results
    // Warmup completed

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-Edge-Warmup': 'completed',
        'X-Warmup-Duration': `${totalDuration.toFixed(2)}ms`,
        'X-Region': currentRegion
      }
    });

  } catch (error) {
    // Warmup error handled
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
      executionTime: performance.now() - startTime
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Edge-Warmup': 'failed'
      }
    });
  }
}

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Get current warmup status
    const edgeWarmingStats = enhancedConnectionPool.getEdgeWarmingStats();
    const cacheWarmupStats = await edgeCacheManager.getWarmupStatus();
    
    const status = {
      edgeWarming: edgeWarmingStats,
      cacheWarmup: cacheWarmupStats,
      lastWarmup: Date.now(),
      nextScheduledWarmup: Date.now() + 300000, // 5 minutes
      recommendations: await generateWarmupRecommendations()
    };

    return NextResponse.json({
      success: true,
      status,
      timestamp: Date.now(),
      generationTime: performance.now() - startTime
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'X-Edge-Warmup-Status': 'active'
      }
    });

  } catch (error) {
    // Status check error handled
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
  }
}

/**
 * Warm up a specific edge function
 */
async function warmEdgeFunction(functionName: string, region: string): Promise<void> {
  const functionUrl = `https://${functionName}.${region}.vercel.app/warm`;
  
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Warmup-Request': 'true',
        'X-Region': region
      },
      body: JSON.stringify({
        action: 'warmup',
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`Function warmup failed: ${response.status} ${response.statusText}`);
    }

    // Wait a moment for the function to fully initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    // Don't fail the entire warmup if one function fails
    // Function warmup failed
    throw error;
  }
}

/**
 * Generate warmup recommendations based on current usage patterns
 */
async function generateWarmupRecommendations(): Promise<string[]> {
  const recommendations: string[] = [];
  
  try {
    const poolStats = enhancedConnectionPool.getStats();
    const cacheStats = edgeCacheManager.getMetrics();
    
    // Connection recommendations
    if (poolStats.hitRate < 0.7) {
      recommendations.push('Consider increasing minimum connections to improve hit rate');
    }
    
    if (poolStats.avgAcquireTime > 500) {
      recommendations.push('Connection acquisition is slow, consider connection warming');
    }
    
    // Cache recommendations
    if (cacheStats.hitRate < 0.6) {
      recommendations.push('Cache hit rate is low, consider warming frequently accessed patterns');
    }
    
    if (cacheStats.memoryUsage > 0.8) {
      recommendations.push('Cache memory usage is high, consider increasing cache size or TTL');
    }
    
    // Regional recommendations
    const edgeMetrics = enhancedConnectionPool.getEdgeMetrics();
    const regionsWithNoConnections = Object.keys(edgeMetrics.connectionsByRegion).filter(
      region => edgeMetrics.connectionsByRegion[region] === 0
    );
    
    if (regionsWithNoConnections.length > 0) {
      recommendations.push(`Consider warming connections for regions: ${regionsWithNoConnections.join(', ')}`);
    }
    
  } catch (error) {
    // Recommendation generation failed
  }
  
  return recommendations;
}