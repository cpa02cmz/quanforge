/**
 * Core Robots API Endpoint
 * Optimized for Vercel Edge with caching and validation
 */

import { NextRequest } from 'next/server';
import { mockDb } from '../../services/supabase';
import { securityManager } from '../../services/securityManager';
import {
  edgeConfig,
  handleGetRequest,
  handlePostRequest,
  handlePutRequest,
  handleDeleteRequest,
  validateRequiredFields,
  sanitizeArray,
  buildPaginatedResponse,
  buildOperationResponse,
  APIError,
} from '../../utils/apiShared';

export const config = edgeConfig;

/**
 * GET /api/robots - List robots with pagination, search, and filtering
 */
export async function GET(request: NextRequest) {
  return handleGetRequest(request, async (params) => {
    const { page, limit, search, type, sort, order } = params;
    
    // Sanitize search term
    const sanitizedSearch = search 
      ? securityManager.sanitizeInput(search, 'search')
      : undefined;

    // Fetch robots from database
    const result = await mockDb.getRobotsPaginated(
      page,
      limit,
      sanitizedSearch,
      type
    );

    if (result.error) {
      throw new APIError(result.error, 500);
    }

    // Transform response for API
    return buildPaginatedResponse(result.data, result.pagination, {
      search,
      type,
      sort,
      order,
    });
  }, {
    key: 'robots_list',
    ttl: 5 * 60 * 1000, // 5 minutes
    tags: ['robots', 'list'],
  });
}

/**
 * POST /api/robots - Create a new robot
 */
export async function POST(request: NextRequest) {
  return handlePostRequest(request, async (data, params) => {
    // Add metadata
    const robotData = {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to database
    const result = await mockDb.saveRobot(robotData);
    
    if (result.error) {
      throw new APIError(result.error, 500);
    }

    return buildOperationResponse('create', 1, 'robot');
  }, 'robot', ['robots', 'list']);
}

/**
 * PUT /api/robots - Update multiple robots (batch operation)
 */
export async function PUT(request: NextRequest) {
  return handlePostRequest(request, async (data, params) => {
    const { updates } = data;

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new APIError('Invalid request: updates array is required', 400);
    }

    // Validate and sanitize all updates
    const sanitizedUpdates = updates.map(update => {
      const validation = securityManager.sanitizeAndValidate(update.data, 'robot');
      if (!validation.isValid) {
        throw new APIError(`Validation failed for robot ${update.id}: ${validation.errors.join(', ')}`, 400);
      }
      return {
        id: update.id,
        data: validation.sanitizedData,
      };
    });

    // Perform batch update
    const result = await mockDb.batchUpdateRobots(sanitizedUpdates);
    
    if (result.error) {
      throw new APIError(result.error, 500);
    }

    return {
      success: true,
      data: result.data,
      updated: result.data?.length || 0,
      message: `Updated ${result.data?.length || 0} robots successfully`,
    };
  }, undefined, ['robots', 'list']);
}

/**
 * DELETE /api/robots - Delete robots (batch operation)
 */
export async function DELETE(request: NextRequest) {
  return handleDeleteRequest(request, undefined, async (id, params) => {
    const { ids } = params;
    
    if (!ids || ids.length === 0) {
      throw new APIError('Invalid request: ids parameter is required', 400);
    }

    // Validate IDs
    const validIds = sanitizeArray(ids, 'text');
    if (validIds.length === 0) {
      throw new APIError('No valid robot IDs provided', 400);
    }

    // Delete robots
    let deletedCount = 0;
    const errors: string[] = [];

    for (const validId of validIds) {
      const result = await mockDb.deleteRobot(validId);
      if (result.error) {
        errors.push(`Failed to delete ${validId}: ${result.error}`);
      } else {
        deletedCount++;
      }
    }

    return {
      success: deletedCount > 0,
      data: {
        deleted: deletedCount,
        requested: validIds.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `Deleted ${deletedCount} robots successfully`,
    };
  }, ['robots', 'list']);
}