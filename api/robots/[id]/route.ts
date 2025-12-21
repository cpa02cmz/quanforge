/**
 * Individual Robot API Endpoint
 * Handle operations for specific robots by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { mockDb } from '../../../services/supabase';
import { securityManager } from '../../../services/securityManager';
import { advancedCache } from '../../../services/advancedCache';
import { performanceMonitorEnhanced } from '../../../services/performanceMonitorEnhanced';

export const config = {
  runtime: 'edge',
};

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/robots/[id] - Get a specific robot by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const startTime = performance.now();
  
  try {
    const { id } = await context.params;
    
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid robot ID',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Check cache first
    const cacheKey = `robot_${id}`;
    const cached = await advancedCache.get(cacheKey);
    
    if (cached) {
      const duration = performance.now() - startTime;
      performanceMonitorEnhanced.recordMetric('robot_api_cache_hit', duration);
      
      return NextResponse.json(cached, {
        headers: {
          'X-Cache': 'HIT',
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'public, max-age=600, stale-while-revalidate=120',
        },
      });
    }

    // Get all robots and find the specific one
    const result = await mockDb.getRobots();
    
    if (result.error) {
      throw new Error(result.error);
    }

    const robot = result.data?.find((r: any) => r.id === id);
    
    if (!robot) {
      return NextResponse.json(
        {
          success: false,
          error: 'Robot not found',
        },
        { 
          status: 404,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
            'Cache-Control': 'no-cache',
          },
        }
      );
    }

    const response = {
      success: true,
      data: robot,
    };

    // Cache the result
    await advancedCache.set(cacheKey, response, {
      ttl: 10 * 60 * 1000, // 10 minutes
      tags: ['robot', id],
      priority: 'high',
    });

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robot_api_get', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=120',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robot_api_error', duration);
    
    console.error('Robot API GET error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch robot',
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
 * PUT /api/robots/[id] - Update a specific robot
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const startTime = performance.now();
  
  try {
    const { id } = await context.params;
    
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid robot ID',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

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

    // Update robot
    const result = await mockDb.updateRobot(id, validation.sanitizedData);
    
    if (result.error) {
      if (result.error.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Robot not found',
          },
          { 
            status: 404,
            headers: {
              'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
              'Cache-Control': 'no-cache',
            },
          }
        );
      }
      throw new Error(result.error);
    }

    // Invalidate caches
    await advancedCache.delete(`robot_${id}`);
    await advancedCache.clearByTags(['robots', 'list']);

    const response = {
      success: true,
      data: result.data,
      message: 'Robot updated successfully',
    };

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robot_api_update', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'no-cache',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robot_api_update_error', duration);
    
    console.error('Robot API PUT error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update robot',
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
 * DELETE /api/robots/[id] - Delete a specific robot
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const startTime = performance.now();
  
  try {
    const { id } = await context.params;
    
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid robot ID',
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

    // Delete robot
    const result = await mockDb.deleteRobot(id);
    
    if (result.error) {
      if (result.error.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Robot not found',
          },
          { 
            status: 404,
            headers: {
              'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
              'Cache-Control': 'no-cache',
            },
          }
        );
      }
      throw new Error(result.error);
    }

    // Invalidate caches
    await advancedCache.delete(`robot_${id}`);
    await advancedCache.clearByTags(['robots', 'list']);

    const response = {
      success: true,
      data: { deleted: true, id },
      message: 'Robot deleted successfully',
    };

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robot_api_delete', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'no-cache',
        'X-Edge-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('robot_api_delete_error', duration);
    
    console.error('Robot API DELETE error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete robot',
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