/**
 * Core Robots API Endpoint
 * Optimized for Vercel Edge with caching and validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { mockDb, dbUtils } from '../../services/supabase';
import { securityManager } from '../../services/securityManager';
import { advancedCache } from '../../services/advancedCache';
import { performanceMonitorEnhanced } from '../../services/performanceMonitorEnhanced';
import { Robot } from '../../types';

export const config = {
  runtime: 'edge',
  maxDuration: 15,
  memory: 512,
  cache: 'max-age=300, s-maxage=900, stale-while-revalidate=300',
};

interface RobotsQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  type?: string;
  sort?: 'created_at' | 'updated_at' | 'name';
  order?: 'asc' | 'desc';
}

/**
 * GET /api/robots - List robots with pagination, search, and filtering
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params: RobotsQueryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || undefined,
      type: searchParams.get('type') || undefined,
      sort: (searchParams.get('sort') as any) || 'created_at',
      order: (searchParams.get('order') as any) || 'desc',
    };

    // Validate parameters
    const page = Math.max(1, parseInt(params.page, 10));
    const limit = Math.min(100, Math.max(1, parseInt(params.limit, 10)));
    
    // Create cache key
    const cacheKey = `robots_list_${page}_${limit}_${params.search || ''}_${params.type || 'All'}_${params.sort}_${params.order}`;
    
    // Check cache first
    const cached = await advancedCache.get(cacheKey);
    if (cached) {
      const duration = performance.now() - startTime;
      performanceMonitorEnhanced.recordMetric('robots_api_cache_hit', duration);
      
      return NextResponse.json(cached, {
        headers: {
          'X-Cache': 'HIT',
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        },
      });
    }

    // Sanitize search term
    const sanitizedSearch = params.search 
      ? securityManager.sanitizeInput(params.search, 'search')
      : undefined;

    // Fetch robots from database
    const result = await mockDb.getRobotsPaginated(
      page,
      limit,
      sanitizedSearch,
      params.type
    );

    if (result.error) {
      throw new Error(result.error);
    }

    // Transform response for API
    const response = {
      success: true,
      data: result.data,
      pagination: result.pagination,
      meta: {
        page,
        limit,
        search: params.search,
        type: params.type,
        sort: params.sort,
        order: params.order,
        total: result.pagination?.totalCount || 0,
      },
    };

    // Cache successful response
    await advancedCache.set(cacheKey, response, {
      ttl: 5 * 60 * 1000, // 5 minutes
      tags: ['robots', 'list'],
      priority: 'high',
    });

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robots_api_get', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robots_api_error', duration);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch robots',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}

/**
 * POST /api/robots - Create a new robot
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate and sanitize input
    const validation = securityManager.sanitizeAndValidate(body, 'robot');
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors,
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Add metadata
    const robotData = {
      ...validation.sanitizedData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to database
    const result = await mockDb.saveRobot(robotData);
    
    if (result.error) {
      throw new Error(result.error);
    }

    // Invalidate relevant caches
    await advancedCache.clearByTags(['robots', 'list']);

    const response = {
      success: true,
      data: result.data?.[0] || null,
      message: 'Robot created successfully',
    };

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robots_api_create', duration);

    return NextResponse.json(response, {
      status: 201,
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'no-cache',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robots_api_create_error', duration);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create robot',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}

/**
 * PUT /api/robots - Update multiple robots (batch operation)
 */
export async function PUT(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: updates array is required',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Validate and sanitize all updates
    const sanitizedUpdates = updates.map(update => {
      const validation = securityManager.sanitizeAndValidate(update.data, 'robot');
      if (!validation.isValid) {
        throw new Error(`Validation failed for robot ${update.id}: ${validation.errors.join(', ')}`);
      }
      return {
        id: update.id,
        data: validation.sanitizedData,
      };
    });

    // Perform batch update
    const result = await mockDb.batchUpdateRobots(sanitizedUpdates);
    
    if (result.error) {
      throw new Error(result.error);
    }

    // Invalidate caches
    await advancedCache.clearByTags(['robots', 'list']);

    const response = {
      success: true,
      data: result.data,
      updated: result.data?.length || 0,
      message: `Updated ${result.data?.length || 0} robots successfully`,
    };

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robots_api_batch_update', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'no-cache',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robots_api_batch_update_error', duration);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update robots',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}

/**
 * DELETE /api/robots - Delete robots (batch operation)
 */
export async function DELETE(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids')?.split(',').filter(Boolean);

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: ids parameter is required',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Validate IDs
    const validIds = ids.filter(id => id && typeof id === 'string');
    if (validIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid robot IDs provided',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Delete robots
    let deletedCount = 0;
    const errors: string[] = [];

    for (const id of validIds) {
      const result = await mockDb.deleteRobot(id);
      if (result.error) {
        errors.push(`Failed to delete ${id}: ${result.error}`);
      } else {
        deletedCount++;
      }
    }

    // Invalidate caches
    await advancedCache.clearByTags(['robots', 'list']);

    const response = {
      success: deletedCount > 0,
      data: {
        deleted: deletedCount,
        requested: validIds.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `Deleted ${deletedCount} robots successfully`,
    };

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robots_api_delete', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'no-cache',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robots_api_delete_error', duration);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete robots',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}