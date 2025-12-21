/**
 * Edge Cache Invalidation API
 * Smart cache invalidation with cascade and pattern matching
 */

import { NextRequest, NextResponse } from 'next/server';
import { edgeCacheManager } from '../../../services/edgeCacheManager';
import { enhancedConnectionPool } from '../../../services/enhancedSupabasePool';

interface InvalidationRequest {
  keys?: string[];
  patterns?: string[];
  tags?: string[];
  cascade?: boolean;
  regions?: string[];
  priority?: 'low' | 'medium' | 'high';
}

interface InvalidationResult {
  success: boolean;
  invalidated: {
    keys: string[];
    patterns: string[];
    tags: string[];
  };
  affectedRegions: string[];
  cascadeInvalidations: string[];
  summary: {
    totalInvalidated: number;
    keysInvalidated: number;
    patternsInvalidated: number;
    tagsInvalidated: number;
    duration: number;
  };
  timestamp: number;
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const body: InvalidationRequest = await request.json();
    const { 
      keys = [], 
      patterns = [], 
      tags = [], 
      cascade = false, 
      regions = []
    } = body;
    
    const currentRegion = request.headers.get('x-vercel-region') || 'unknown';
    const targetRegions = regions.length > 0 ? regions : [currentRegion];
    
    console.log(`Starting cache invalidation: ${keys.length} keys, ${patterns.length} patterns, ${tags.length} tags`);

    const invalidated = {
      keys: [] as string[],
      patterns: [] as string[],
      tags: [] as string[]
    };

    const cascadeInvalidations: string[] = [];

    // Invalidate specific keys
    if (keys.length > 0) {
      for (const key of keys) {
        try {
          await edgeCacheManager.invalidate(key, { regions: targetRegions });
          invalidated.keys.push(key);
          
          // Cascade invalidation for related keys
          if (cascade) {
            const relatedKeys = await findRelatedKeys(key);
            for (const relatedKey of relatedKeys) {
              await edgeCacheManager.invalidate(relatedKey, { regions: targetRegions });
              cascadeInvalidations.push(relatedKey);
            }
          }
        } catch (error) {
          console.warn(`Failed to invalidate key ${key}:`, error);
        }
      }
    }

    // Invalidate patterns
    if (patterns.length > 0) {
      for (const pattern of patterns) {
        try {
          const invalidatedPatternKeys = await edgeCacheManager.invalidatePattern(pattern, { 
            regions: targetRegions 
          });
          invalidated.patterns.push(pattern);
          
          // Add pattern-matched keys to cascade invalidations
          if (cascade) {
            cascadeInvalidations.push(...invalidatedPatternKeys);
          }
        } catch (error) {
          console.warn(`Failed to invalidate pattern ${pattern}:`, error);
        }
      }
    }

    // Invalidate tags
    if (tags.length > 0) {
      for (const tag of tags) {
        try {
          await edgeCacheManager.invalidateByTag(tag, { regions: targetRegions });
          invalidated.tags.push(tag);
        } catch (error) {
          console.warn(`Failed to invalidate tag ${tag}:`, error);
        }
      }
    }

    // Invalidate database query cache if relevant
    if (tags.includes('database') || tags.includes('supabase')) {
      try {
        // Clear connection pool cache
        await enhancedConnectionPool.clearCache();
        console.log('Cleared database connection cache');
      } catch (error) {
        console.warn('Failed to clear database cache:', error);
      }
    }

    const duration = performance.now() - startTime;
    const totalInvalidated = invalidated.keys.length + invalidated.patterns.length + invalidated.tags.length + cascadeInvalidations.length;

    const result: InvalidationResult = {
      success: true,
      invalidated,
      affectedRegions: targetRegions,
      cascadeInvalidations,
      summary: {
        totalInvalidated,
        keysInvalidated: invalidated.keys.length,
        patternsInvalidated: invalidated.patterns.length,
        tagsInvalidated: invalidated.tags.length,
        duration
      },
      timestamp: Date.now()
    };

    // Log invalidation results
    console.log(`Cache invalidation completed: ${totalInvalidated} items invalidated in ${duration.toFixed(2)}ms`);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-Edge-Cache-Invalidation': 'completed',
        'X-Invalidation-Duration': `${duration.toFixed(2)}ms`,
        'X-Region': currentRegion,
        'X-Items-Invalidated': totalInvalidated.toString()
      }
    });

  } catch (error) {
    console.error('Cache invalidation failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
      executionTime: performance.now() - startTime
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Edge-Cache-Invalidation': 'failed'
      }
    });
  }
}

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusType = searchParams.get('type') || 'overview';
    
    let status;
    
    switch (statusType) {
      case 'overview':
        status = await getCacheOverview();
        break;
      case 'detailed':
        status = await getDetailedCacheStatus();
        break;
      case 'regions':
        status = await getRegionalCacheStatus();
        break;
      default:
        throw new Error(`Invalid status type: ${statusType}`);
    }

    return NextResponse.json({
      success: true,
      status,
      timestamp: Date.now(),
      generationTime: performance.now() - startTime
    }, {
      headers: {
        'Cache-Control': 'public, max-age=30',
        'X-Edge-Cache-Status': statusType
      }
    });

  } catch (error) {
    console.error('Failed to get cache status:', error);
    
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
 * Find keys related to a given key for cascade invalidation
 */
async function findRelatedKeys(key: string): Promise<string[]> {
  const relatedKeys: string[] = [];
  
  try {
    // Find keys with similar prefixes
    const keyParts = key.split(':');
    const prefix = keyParts.slice(0, -1).join(':');
    
    if (prefix) {
      const similarKeys = await edgeCacheManager.getKeysByPattern(`${prefix}:*`);
      relatedKeys.push(...similarKeys.filter(k => k !== key));
    }
    
    // Find keys with matching tags
    const keyTags = await edgeCacheManager.getKeyTags(key);
    for (const tag of keyTags) {
      const taggedKeys = await edgeCacheManager.getKeysByTag(tag);
      relatedKeys.push(...taggedKeys.filter(k => k !== key));
    }
    
    // Remove duplicates
    return [...new Set(relatedKeys)];
    
  } catch (error) {
    console.warn('Failed to find related keys:', error);
    return [];
  }
}

/**
 * Get cache overview status
 */
async function getCacheOverview() {
  const metrics = edgeCacheManager.getMetrics();
  const warmingStats = await edgeCacheManager.getWarmupStatus();
  
  return {
    metrics,
    warming: warmingStats,
    health: {
      status: metrics.hitRate > 0.6 ? 'healthy' : metrics.hitRate > 0.3 ? 'degraded' : 'unhealthy',
      hitRate: metrics.hitRate,
      memoryUsage: metrics.memoryUsage,
      totalKeys: metrics.totalKeys
    },
    recommendations: generateCacheRecommendations(metrics)
  };
}

/**
 * Get detailed cache status
 */
async function getDetailedCacheStatus() {
  const detailedMetrics = await edgeCacheManager.getDetailedMetrics();
  const topKeys = await edgeCacheManager.getTopKeys(20);
  const regions = await getRegionalCacheStatus();
  
  return {
    detailed: detailedMetrics,
    topKeys,
    regions,
    patterns: await edgeCacheManager.getCachePatterns()
  };
}

/**
 * Get regional cache status
 */
async function getRegionalCacheStatus() {
  const regions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1', 'cle1'];
  const regionalStatus: Record<string, any> = {};
  
  for (const region of regions) {
    try {
      const regionMetrics = await edgeCacheManager.getRegionalMetrics(region);
      regionalStatus[region] = regionMetrics;
    } catch (error) {
      regionalStatus[region] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  return regionalStatus;
}

/**
 * Generate cache optimization recommendations
 */
function generateCacheRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];
  
  if (metrics.hitRate < 0.5) {
    recommendations.push('Low cache hit rate - consider warming frequently accessed patterns');
  }
  
  if (metrics.memoryUsage > 0.9) {
    recommendations.push('High memory usage - consider increasing cache size or reducing TTL');
  }
  
  if (metrics.memoryUsage < 0.3) {
    recommendations.push('Low memory usage - cache size could be reduced for cost optimization');
  }
  
  if (metrics.avgAccessTime > 100) {
    recommendations.push('Slow cache access - consider optimizing cache structure or using faster storage');
  }
  
  return recommendations;
}