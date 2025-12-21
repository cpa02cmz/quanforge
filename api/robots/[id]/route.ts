/**
 * Individual Robot API Endpoint
 * Handle operations for specific robots by ID
 */

import { NextRequest } from 'next/server';
import { mockDb } from '../../../services/supabase';
import {
  edgeConfig,
  handleGetRequest,
  handlePutRequest,
  handleDeleteRequest,
  RouteContext,
  validateRouteParam,
  buildSingleResourceResponse,
  buildOperationResponse,
  APIError,
  handleDatabaseError,
} from '../../../utils/apiShared';

export const config = edgeConfig;

/**
 * GET /api/robots/[id] - Get a specific robot by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  return handleGetRequest(request, async (params) => {
    const { id } = await context.params;
    const validatedId = validateRouteParam(id, 'ID');

    // Get all robots and find the specific one
    const result = await mockDb.getRobots();
    
    if (result.error) {
      throw new APIError(result.error, 500);
    }

    const robot = result.data?.find((r: any) => r.id === validatedId);
    
    if (!robot) {
      throw new APIError('Robot not found', 404);
    }

    return buildSingleResourceResponse(robot, 'fetched');
  }, {
    key: 'robot',
    ttl: 10 * 60 * 1000, // 10 minutes
    tags: ['robot'],
  });
}

/**
 * PUT /api/robots/[id] - Update a specific robot
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  return handlePutRequest(request, context, async (id, data) => {
    // Update robot
    const result = await mockDb.updateRobot(id, data);
    
    if (result.error) {
      handleDatabaseError(result.error, 'Robot');
    }

    return buildSingleResourceResponse(result.data, 'updated');
  }, 'robot', ['robots', 'list']);
}

/**
 * DELETE /api/robots/[id] - Delete a specific robot
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleDeleteRequest(request, context, async (id, params) => {
    // Delete robot
    const result = await mockDb.deleteRobot(id);
    
    if (result.error) {
      handleDatabaseError(result.error, 'Robot');
    }

    return buildOperationResponse('delete', 1, 'robot');
  }, ['robots', 'list']);
}