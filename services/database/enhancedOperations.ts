/**
 * Enhanced Database Operations with Advanced Optimizations
 * Implements additional performance optimizations beyond basic CRUD operations
 */

import { Robot } from '../../types';
import { getClient, STORAGE_KEYS, safeParse, generateUUID } from './client';
import { queryOptimizer } from '../advancedQueryOptimizer';
import { handleError } from '../../utils/errorHandler';
import { getRobot, getRobotsByIds, saveRobot } from './operations';

export interface SearchOptions {
  query?: string;
  strategyType?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'name' | 'risk_score';
  sortOrder?: 'asc' | 'desc';
}

export interface AnalyticsData {
  totalRobots: number;
  activeRobots: number;
  publicRobots: number;
  avgRiskScore: number;
  avgProfitPotential: number;
  mostUsedStrategy: string;
  totalViews: number;
  totalCopies: number;
}

/**
 * Advanced search functionality with full-text search capabilities
 */
export const searchRobots = async (
  userId: string,
  options: SearchOptions = {}
): Promise<{ robots: Robot[]; total: number }> => {
  try {
    const cacheKey = `search_robots_${userId}_${JSON.stringify(options)}`;
    
    return await queryOptimizer.executeQuery(
      cacheKey,
      async () => {
        const client = getClient();
        let query = client.from('robots').select('*', { count: 'exact' });
        
        // Apply user filter
        query = query.eq('user_id', userId);
        
        // Apply search query if provided
        if (options.query && options.query.trim()) {
          // This would use the search_robots function defined in the migration
          // For now, using basic text search on name and description
          query = query.or(
            `name.ilike.%${options.query}%,description.ilike.%${options.query}%`
          );
        }
        
        // Apply strategy type filter
        if (options.strategyType) {
          query = query.eq('strategy_type', options.strategyType);
        }
        
        // Apply sorting
        const sortBy = options.sortBy || 'updated_at';
        const sortOrder = options.sortOrder || 'desc';
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        
        // Apply pagination
        if (options.limit) {
          const offset = options.offset || 0;
          query = query.range(offset, offset + options.limit - 1);
        }
        
        const { data, error, count } = await query;
        
        if (error) throw error;
        
        return {
          robots: data || [],
          total: count || 0
        };
      },
      {
        cache: true,
        cacheTTL: 180000, // 3 minutes for search results
        priority: 'normal',
        timeout: 15000
      }
    );
  } catch (error) {
    handleError(error, 'searchRobots');
    // Fallback to localStorage
    const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
    let filteredRobots = robots.filter((r: Robot) => r.user_id === userId);
    
    if (options.query) {
      const queryLower = options.query.toLowerCase();
      filteredRobots = filteredRobots.filter(
        (r: Robot) => 
          r.name.toLowerCase().includes(queryLower) || 
          r.description.toLowerCase().includes(queryLower)
      );
    }
    
    if (options.strategyType) {
      filteredRobots = filteredRobots.filter(
        (r: Robot) => r.strategy_type === options.strategyType
      );
    }
    
    // Apply sorting
    const sortBy = options.sortBy || 'updated_at';
    const sortOrder = options.sortOrder || 'desc';
    filteredRobots.sort((a: Robot, b: Robot) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'risk_score' && a.analysis_result && b.analysis_result) {
        comparison = (a.analysis_result as any).riskScore - (b.analysis_result as any).riskScore;
      } else {
        // Default to updated_at
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || filteredRobots.length;
    const paginatedRobots = filteredRobots.slice(offset, offset + limit);
    
    return {
      robots: paginatedRobots,
      total: filteredRobots.length
    };
  }
};

/**
 * Get robot analytics data
 */
export const getRobotAnalytics = async (userId?: string): Promise<AnalyticsData> => {
  try {
    const cacheKey = userId ? `analytics_user_${userId}` : 'analytics_global';
    
    return await queryOptimizer.executeQuery(
      cacheKey,
      async () => {
        const client = getClient();
        
        // In a real implementation, this would call the get_robot_analytics function
        // from the database migration. For now, we'll calculate from the basic query
        let query = client.from('robots').select('*');
        if (userId) {
          query = query.eq('user_id', userId);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        const robots = data || [];
        
        // Calculate analytics
        const totalRobots = robots.length;
        const activeRobots = robots.filter((r: Robot) => r.is_active !== false).length;
        const publicRobots = robots.filter((r: Robot) => r.is_public === true).length;
        
        const riskScores = robots
          .filter((r: Robot) => r.analysis_result && r.analysis_result.riskScore !== undefined)
          .map((r: Robot) => r.analysis_result!.riskScore);
        const avgRiskScore = riskScores.length > 0 
          ? riskScores.reduce((sum: number, score: number) => sum + score, 0) / riskScores.length 
          : 0;
          
        const profitPotentials = robots
          .filter((r: Robot) => r.analysis_result && r.analysis_result.profitability !== undefined)
          .map((r: Robot) => r.analysis_result!.profitability);
        const avgProfitPotential = profitPotentials.length > 0 
          ? profitPotentials.reduce((sum: number, score: number) => sum + score, 0) / profitPotentials.length 
          : 0;
          
        // Find most used strategy
        const strategyCounts: Record<string, number> = {};
        robots.forEach((r: Robot) => {
          strategyCounts[r.strategy_type] = (strategyCounts[r.strategy_type] || 0) + 1;
        });
        const mostUsedStrategy = Object.entries(strategyCounts)
          .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Custom';
        
        const totalViews = robots.reduce((sum: number, r: Robot) => sum + (r.view_count || 0), 0);
        const totalCopies = robots.reduce((sum: number, r: Robot) => sum + (r.copy_count || 0), 0);
        
        return {
          totalRobots,
          activeRobots,
          publicRobots,
          avgRiskScore,
          avgProfitPotential,
          mostUsedStrategy,
          totalViews,
          totalCopies
        };
      },
      {
        cache: true,
        cacheTTL: 300000, // 5 minutes for analytics
        priority: 'normal',
        timeout: 20000
      }
    );
  } catch (error) {
    handleError(error, 'getRobotAnalytics');
    // Fallback to localStorage
    const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
    const userRobots = userId ? robots.filter((r: Robot) => r.user_id === userId) : robots;
    
    // Calculate basic analytics
    const totalRobots = userRobots.length;
    const activeRobots = userRobots.length; // All are considered active in localStorage
    const publicRobots = 0; // No public functionality in localStorage mode
    
        const riskScores = userRobots
          .filter((r: Robot) => r.analysis_result && r.analysis_result.riskScore !== undefined)
          .map((r: Robot) => r.analysis_result!.riskScore);
        const avgRiskScore = riskScores.length > 0 
          ? riskScores.reduce((sum: number, score: number) => sum + score, 0) / riskScores.length 
          : 0;
          
        const profitPotentials = userRobots
          .filter((r: Robot) => r.analysis_result && r.analysis_result.profitability !== undefined)
          .map((r: Robot) => r.analysis_result!.profitability);
        const avgProfitPotential = profitPotentials.length > 0 
          ? profitPotentials.reduce((sum: number, score: number) => sum + score, 0) / profitPotentials.length 
          : 0;
      
        // Find most used strategy
        const strategyCounts: Record<string, number> = {};
        userRobots.forEach((r: Robot) => {
          strategyCounts[r.strategy_type] = (strategyCounts[r.strategy_type] || 0) + 1;
        });
        const mostUsedStrategy = Object.entries(strategyCounts)
          .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Custom';
    
        const totalViews = userRobots.reduce((sum: number, r: Robot) => sum + (r.view_count || 0), 0);
        const totalCopies = userRobots.reduce((sum: number, r: Robot) => sum + (r.copy_count || 0), 0);
    
        return {
          totalRobots,
          activeRobots,
          publicRobots,
          avgRiskScore,
          avgProfitPotential,
          mostUsedStrategy,
          totalViews,
          totalCopies
        };
  }
};

/**
 * Update robot statistics (views, copies, etc.)
 */
export const updateRobotStats = async (
  id: string, 
  statsUpdate: { view_count?: number; copy_count?: number; is_public?: boolean }
): Promise<void> => {
  try {
    await queryOptimizer.executeQuery(
      `update_stats_${id}`,
      async () => {
        const client = getClient();
        
        // Get current robot to update specific stats
        const { data: currentRobot, error: fetchError } = await client
          .from('robots')
          .select('view_count, copy_count, is_public')
          .eq('id', id)
          .single();
        
        if (fetchError) throw fetchError;
        
        // Prepare update object
        const updateData: any = { ...statsUpdate };
        
        // If incrementing rather than setting, calculate new values
        if (typeof statsUpdate.view_count === 'number' && statsUpdate.view_count === 1) {
          updateData.view_count = (currentRobot?.view_count || 0) + 1;
        }
        if (typeof statsUpdate.copy_count === 'number' && statsUpdate.copy_count === 1) {
          updateData.copy_count = (currentRobot?.copy_count || 0) + 1;
        }
        
        // Update the robot
        const { error: updateError } = await client
          .from('robots')
          .update(updateData)
          .eq('id', id);
          
        if (updateError) throw updateError;
        
        // Invalidate cache
        queryOptimizer.setCache(`robot_${id}`, null);
      },
      {
        cache: false, // Don't cache write operations
        priority: 'normal',
        timeout: 10000
      }
    );
  } catch (error) {
    handleError(error, 'updateRobotStats');
    // For localStorage, stats updates are not persisted in this implementation
  }
};

/**
 * Bulk operation to update multiple robots with different changes
 */
export const bulkUpdateRobots = async (
  updates: Array<{ id: string; changes: Partial<Robot> }>
): Promise<Robot[]> => {
  try {
    return await queryOptimizer.executeQuery(
      `bulk_update_${Date.now()}`,
      async () => {
        const client = getClient();
        
        // Process updates in batches to avoid exceeding database limits
        const batchSize = 10;
        const results: Robot[] = [];
        
        for (let i = 0; i < updates.length; i += batchSize) {
          const batch = updates.slice(i, i + batchSize);
          
          // Process each update in the batch
          for (const update of batch) {
            const { data, error } = await client
              .from('robots')
              .update(update.changes)
              .eq('id', update.id)
              .select()
              .single();
              
            if (error) {
              console.error(`Error updating robot ${update.id}:`, error);
              continue;
            }
            
            if (data) {
              results.push(data);
              // Invalidate cache for this robot
              queryOptimizer.setCache(`robot_${update.id}`, data, 600000);
            }
          }
        }
        
        // Invalidate user's robot list cache
        if (updates.length > 0) {
          const userId = updates[0].changes.user_id || 
            (await getRobot(updates[0].id))?.user_id;
          if (userId) {
            queryOptimizer.setCache(`robots_user_${userId}`, null);
          }
        }
        
        return results;
      },
      {
        cache: false, // Don't cache write operations
        priority: 'normal',
        timeout: updates.length * 2000 // Adjust timeout based on number of updates
      }
    );
  } catch (error) {
    handleError(error, 'bulkUpdateRobots');
    // Fallback to localStorage
    const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
    const updatedRobots: Robot[] = [];
    
    updates.forEach(update => {
      const index = robots.findIndex((r: Robot) => r.id === update.id);
      if (index >= 0) {
        robots[index] = { ...robots[index], ...update.changes };
        updatedRobots.push(robots[index]);
      }
    });
    
    try {
      localStorage.setItem(STORAGE_KEYS.ROBOTS, JSON.stringify(robots));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
    
    return updatedRobots;
  }
};

/**
 * Export robots data for backup or sharing
 */
export const exportRobots = async (robotIds: string[]): Promise<string> => {
  try {
    // Get robots data
    const robots = robotIds.length > 0 
      ? await getRobotsByIds(robotIds) 
      : await queryOptimizer.executeQuery(
          'export_all_robots',
          async () => {
            const client = getClient();
            const { data, error } = await client.from('robots').select('*');
            if (error) throw error;
            return data || [];
          },
          { cache: false, priority: 'low', timeout: 30000 }
        );
    
    // Remove sensitive data before export
    const exportData = robots.map(robot => ({
      id: robot.id,
      name: robot.name,
      description: robot.description,
      code: robot.code,
      strategy_type: robot.strategy_type,
      strategy_params: robot.strategy_params,
      backtest_settings: robot.backtest_settings,
      analysis_result: robot.analysis_result,
      chat_history: robot.chat_history,
      created_at: robot.created_at,
      updated_at: robot.updated_at
    }));
    
    // Return as JSON string
    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    handleError(error, 'exportRobots');
    // Fallback to localStorage
    const allRobots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
    const exportRobots = robotIds.length > 0 
      ? allRobots.filter((r: Robot) => robotIds.includes(r.id))
      : allRobots;
    
    return JSON.stringify(exportRobots, null, 2);
  }
};

/**
 * Import robots from exported data
 */
export const importRobots = async (importData: string, userId: string): Promise<number> => {
  try {
    const robotsToImport: Robot[] = JSON.parse(importData);
    let importedCount = 0;
    
    for (const robot: Robot of robotsToImport) {
      try {
        // Create a new robot with a new ID and assign to user
        const newRobot: Robot = {
          ...robot,
          id: generateUUID(),
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        await saveRobot(newRobot);
        importedCount++;
      } catch (robotError) {
        console.error(`Failed to import robot ${robot.name}:`, robotError);
        // Continue with other robots
      }
    }
    
    return importedCount;
  } catch (error) {
    handleError(error, 'importRobots');
    throw error;
  }
};