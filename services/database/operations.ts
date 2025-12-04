import { Robot } from '../../types';
import { getClient, STORAGE_KEYS, safeParse, trySaveToStorage, generateUUID } from './client';
import { handleError } from '../../utils/errorHandler';
import { queryCache } from './cache';
import { databasePerformanceMonitor } from '../databasePerformanceMonitor';

// Robot operations
export const getRobots = async (userId: string): Promise<Robot[]> => {
    const startTime = performance.now();
    try {
        // Create cache key based on userId
        const cacheKey = `robots_user_${userId}`;
        
        // Check if we have cached data
        const cached = queryCache.get(cacheKey);
        if (cached) {
            // Record cache hit
            databasePerformanceMonitor.recordQuery('getRobots', 0, true);
            return cached;
        }
        
        const client = getClient();
        // Use optimized query with proper indexing and limiting
        const { data, error } = await client
            .from('robots')
            .select('id, name, description, strategy_type, created_at, updated_at, view_count, copy_count, analysis_result')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(100); // Add reasonable limit to prevent performance issues

        if (error) throw error;
        
        // Cache the results for 5 minutes
        if (data) {
            queryCache.set(cacheKey, data);
        }
        
        const executionTime = performance.now() - startTime;
        databasePerformanceMonitor.recordQuery('getRobots', executionTime, true);
        
        return data || [];
    } catch (error) {
        const executionTime = performance.now() - startTime;
        databasePerformanceMonitor.recordQuery('getRobots', executionTime, false);
        handleError(error, 'getRobots');
        // Fallback to localStorage
        const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        return robots.filter((r: Robot) => r.user_id === userId);
    }
};

export const getRobot = async (id: string): Promise<Robot | null> => {
    const startTime = performance.now();
    try {
        // Create cache key based on robot id
        const cacheKey = `robot_${id}`;
        
        // Check if we have cached data
        const cached = queryCache.get(cacheKey);
        if (cached) {
            databasePerformanceMonitor.recordQuery('getRobot', 0, true);
            return cached;
        }
        
        const client = getClient();
        const { data, error } = await client
            .from('robots')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        
        // Cache the result for 10 minutes
        if (data) {
            queryCache.set(cacheKey, data);
        }
        
        const executionTime = performance.now() - startTime;
        databasePerformanceMonitor.recordQuery('getRobot', executionTime, true);
        
        return data;
    } catch (error) {
        const executionTime = performance.now() - startTime;
        databasePerformanceMonitor.recordQuery('getRobot', executionTime, false);
        handleError(error, 'getRobot');
        // Fallback to localStorage
        const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        return robots.find((r: Robot) => r.id === id) || null;
    }
};

export const saveRobot = async (robot: Robot): Promise<Robot> => {
    try {
        const client = getClient();
        // Add validation to prevent duplicate saves and optimize upsert
        const updatedRobot = {
            ...robot,
            updated_at: new Date().toISOString()
        };
        
        const { data, error } = await client
            .from('robots')
            .upsert(updatedRobot, { onConflict: 'id' })
            .select()
            .single();

        if (error) throw error;
        
        // Invalidate related cache entries
        if (data) {
            // Invalidate the specific robot cache
            queryCache.delete(`robot_${data.id}`);
            // Invalidate the user's robot list cache
            queryCache.delete(`robots_user_${data.user_id}`);
        }
        
        return data;
    } catch (error) {
        handleError(error, 'saveRobot');
        // Fallback to localStorage
        const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        const existingIndex = robots.findIndex((r: Robot) => r.id === robot.id);
        
        if (existingIndex >= 0) {
            robots[existingIndex] = { ...robot, updated_at: new Date().toISOString() };
        } else {
            robots.push({ ...robot, updated_at: new Date().toISOString() });
        }
        
        trySaveToStorage(STORAGE_KEYS.ROBOTS, JSON.stringify(robots));
        
        // Invalidate related cache entries
        queryCache.delete(`robot_${robot.id}`);
        queryCache.delete(`robots_user_${robot.user_id}`);
        
        return robot;
    }
};

export const deleteRobot = async (id: string): Promise<void> => {
    try {
        const client = getClient();
        // Get the robot first to know its user_id for cache invalidation
        const { data: robotToDelete } = await client
            .from('robots')
            .select('user_id')
            .eq('id', id)
            .single();

        const { error } = await client
            .from('robots')
            .delete()
            .eq('id', id);

        if (error) throw error;
        
        // Invalidate related cache entries
        if (robotToDelete) {
            queryCache.delete(`robot_${id}`);
            queryCache.delete(`robots_user_${robotToDelete.user_id}`);
        }
    } catch (error) {
        handleError(error, 'deleteRobot');
        // Fallback to localStorage
        const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        const robotToDelete = robots.find((r: Robot) => r.id === id);
        const filteredRobots = robots.filter((r: Robot) => r.id !== id);
        trySaveToStorage(STORAGE_KEYS.ROBOTS, JSON.stringify(filteredRobots));
        
        // Invalidate related cache entries
        if (robotToDelete) {
            queryCache.delete(`robot_${id}`);
            queryCache.delete(`robots_user_${robotToDelete.user_id}`);
        }
    }
};

export const duplicateRobot = async (id: string, newName: string): Promise<Robot> => {
    const original = await getRobot(id);
    if (!original) throw new Error('Robot not found');

    const duplicate: Robot = {
        ...original,
        id: generateUUID(),
        name: newName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    return await saveRobot(duplicate);
};

// Batch operations for better performance
export const batchUpdateRobots = async (robots: Robot[]): Promise<Robot[]> => {
    try {
        const client = getClient();
        // Use more efficient batch upsert with conflict resolution
        const updatedRobots = robots.map(robot => ({
            ...robot,
            updated_at: new Date().toISOString()
        }));
        
        const { data, error } = await client
            .from('robots')
            .upsert(updatedRobots, { 
                onConflict: 'id',
                ignoreDuplicates: false 
            })
            .select();

        if (error) throw error;
        return data || [];
    } catch (error) {
        handleError(error, 'batchUpdateRobots');
        // Fallback to localStorage
        const existingRobots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        const updatedRobots = [...existingRobots];
        
        robots.forEach(robot => {
            const index = updatedRobots.findIndex((r: Robot) => r.id === robot.id);
            if (index >= 0) {
                updatedRobots[index] = { ...robot, updated_at: new Date().toISOString() };
            } else {
                updatedRobots.push({ ...robot, updated_at: new Date().toISOString() });
            }
        });
        
        trySaveToStorage(STORAGE_KEYS.ROBOTS, JSON.stringify(updatedRobots));
        return robots;
    }
};

export const getRobotsByIds = async (ids: string[]): Promise<Robot[]> => {
    try {
        const client = getClient();
        const { data, error } = await client
            .from('robots')
            .select('*')
            .in('id', ids);

        if (error) throw error;
        return data || [];
    } catch (error) {
        handleError(error, 'getRobotsByIds');
        // Fallback to localStorage
        const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        return robots.filter((r: Robot) => ids.includes(r.id));
    }
};

// Enhanced pagination with search and filtering support
export const getRobotsPaginated = async (
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    search?: string,
    strategyType?: string
): Promise<{ robots: Robot[]; total: number; page: number; totalPages: number; hasMore: boolean }> => {
    try {
        const client = getClient();
        const offset = (page - 1) * limit;
        
        // Build query with optional filters
        let countQuery = client.from('robots').select('*', { count: 'exact', head: true });
        let dataQuery = client.from('robots').select('*');
        
        // Apply user filter
        countQuery = countQuery.eq('user_id', userId);
        dataQuery = dataQuery.eq('user_id', userId);
        
        // Apply optional strategy filter
        if (strategyType && strategyType !== 'All') {
            countQuery = countQuery.eq('strategy_type', strategyType);
            dataQuery = dataQuery.eq('strategy_type', strategyType);
        }
        
        // Apply optional search filter
        if (search && search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            countQuery = countQuery.or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`);
            dataQuery = dataQuery.or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`);
        }
        
        // Get total count
        const { count: total, error: countError } = await countQuery;
        if (countError) throw countError;

        // Get paginated data with optimized field selection
        const { data, error } = await dataQuery
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        const totalPages = Math.ceil((total || 0) / limit);
        const hasMore = (page * limit) < (total || 0);
        
        return {
            robots: data || [],
            total: total || 0,
            page,
            totalPages,
            hasMore
        };
    } catch (error) {
        handleError(error, 'getRobotsPaginated');
        // Fallback to localStorage with enhanced filtering
        const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        let userRobots = robots.filter((r: Robot) => r.user_id === userId);
        
        // Apply additional filters during fallback
        if (strategyType && strategyType !== 'All') {
            userRobots = userRobots.filter((r: Robot) => r.strategy_type === strategyType);
        }
        
        if (search && search.trim()) {
            const searchLower = search.trim().toLowerCase();
            userRobots = userRobots.filter((r: Robot) => 
                r.name.toLowerCase().includes(searchLower) || 
                r.description.toLowerCase().includes(searchLower)
            );
        }
        
        const total = userRobots.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const paginatedRobots = userRobots.slice(offset, offset + limit);
        const hasMore = (page * limit) < total;
        
        return {
            robots: paginatedRobots,
            total,
            page,
            totalPages,
            hasMore
        };
    }
};