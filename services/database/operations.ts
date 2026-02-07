import { Robot, AuditLog, RobotVersion } from '../../types';
import { getClient, STORAGE_KEYS, safeParse, trySaveToStorage, generateUUID } from './client';
import { handleError } from '../../utils/errorHandler';
import { storage } from '../../utils/storage';

// Robot operations
export const getRobots = async (userId: string): Promise<Robot[]> => {
    try {
        const client = getClient();
        const { data, error } = await client
            .from('robots')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)  // Filter out soft-deleted records
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        handleError(error instanceof Error ? error : String(error), 'getRobots');
        // Fallback to storage
        const robots = safeParse(storage.get(STORAGE_KEYS.ROBOTS), []);
        return robots.filter((r: Robot) => r.user_id === userId && !r.deleted_at);
    }
};

export const getRobot = async (id: string): Promise<Robot | null> => {
    try {
        const client = getClient();
        const { data, error } = await client
            .from('robots')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        handleError(error instanceof Error ? error : String(error), 'getRobot');
        // Fallback to storage
        const robots = safeParse(storage.get(STORAGE_KEYS.ROBOTS), []);
        return robots.find((r: Robot) => r.id === id) || null;
    }
};

export const saveRobot = async (robot: Robot): Promise<Robot> => {
    try {
        const client = getClient();
        const { data, error } = await client
            .from('robots')
            .upsert(robot)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        handleError(error instanceof Error ? error : String(error), 'saveRobot');
        // Fallback to storage
        const robots = safeParse(storage.get(STORAGE_KEYS.ROBOTS), []);
        const existingIndex = robots.findIndex((r: Robot) => r.id === robot.id);
        
        if (existingIndex >= 0) {
            robots[existingIndex] = robot;
        } else {
            robots.push(robot);
        }
        
        trySaveToStorage(STORAGE_KEYS.ROBOTS, robots);
        return robot;
    }
};

export const deleteRobot = async (id: string): Promise<void> => {
    try {
        const client = getClient();
        // Use soft delete instead of hard delete
        const { error } = await client
            .from('robots')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        handleError(error instanceof Error ? error : String(error), 'deleteRobot');
        // Fallback to storage - soft delete
        const robots = safeParse(storage.get(STORAGE_KEYS.ROBOTS), []);
        const filteredRobots = robots.filter((r: Robot) => r.id !== id);
        trySaveToStorage(STORAGE_KEYS.ROBOTS, filteredRobots);
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
        const { data, error } = await client
            .from('robots')
            .upsert(robots)
            .select();

        if (error) throw error;
        return data || [];
    } catch (error) {
        handleError(error instanceof Error ? error : String(error), 'batchUpdateRobots');
        // Fallback to storage
        const existingRobots = safeParse(storage.get(STORAGE_KEYS.ROBOTS), []);
        const updatedRobots = [...existingRobots];
        
        robots.forEach(robot => {
            const index = updatedRobots.findIndex((r: Robot) => r.id === robot.id);
            if (index >= 0) {
                updatedRobots[index] = robot;
            } else {
                updatedRobots.push(robot);
            }
        });
        
        trySaveToStorage(STORAGE_KEYS.ROBOTS, updatedRobots);
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
        handleError(error instanceof Error ? error : String(error), 'getRobotsByIds');
        // Fallback to storage
        const robots = safeParse(storage.get(STORAGE_KEYS.ROBOTS), []);
        return robots.filter((r: Robot) => ids.includes(r.id));
    }
};

// Pagination support
export const getRobotsPaginated = async (
    userId: string, 
    page: number = 1, 
    limit: number = 20
): Promise<{ robots: Robot[]; total: number; page: number; totalPages: number }> => {
    try {
        const client = getClient();
        const offset = (page - 1) * limit;
        
        // Get total count (excluding soft-deleted)
        const { count: total, error: countError } = await client
            .from('robots')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('deleted_at', null);  // Filter out soft-deleted records

        if (countError) throw countError;

        // Get paginated data (excluding soft-deleted)
        const { data, error } = await client
            .from('robots')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)  // Filter out soft-deleted records
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        const totalPages = Math.ceil((total || 0) / limit);
        
        return {
            robots: data || [],
            total: total || 0,
            page,
            totalPages
        };
    } catch (error) {
        handleError(error instanceof Error ? error : String(error), 'getRobotsPaginated');
        // Fallback to storage
        const robots = safeParse(storage.get(STORAGE_KEYS.ROBOTS), []);
        const userRobots = robots.filter((r: Robot) => r.user_id === userId && !r.deleted_at);
        const total = userRobots.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const paginatedRobots = userRobots.slice(offset, offset + limit);
        
        return {
            robots: paginatedRobots,
            total,
            page,
            totalPages
        };
    }
};

// Audit log operations
export const getAuditLog = async (tableName: string, recordId: string): Promise<AuditLog[]> => {
    try {
        const client = getClient();
        const { data, error } = await client
            .rpc('get_audit_log', {
                target_table_name: tableName,
                target_record_id: recordId
            });

        if (error) throw error;
        return data || [];
    } catch (error) {
        handleError(error instanceof Error ? error : String(error), 'getAuditLog');
        return [];
    }
};

// Robot version history operations
export const getRobotHistory = async (robotId: string): Promise<RobotVersion[]> => {
    try {
        const client = getClient();
        const { data, error } = await client
            .rpc('get_robot_history', {
                target_robot_id: robotId
            });

        if (error) throw error;
        return data || [];
    } catch (error) {
        handleError(error instanceof Error ? error : String(error), 'getRobotHistory');
        return [];
    }
};

export const rollbackRobot = async (robotId: string, version: number, userId: string): Promise<{ robotId: string; version: number; success: boolean; message: string }> => {
    try {
        const client = getClient();
        const { data, error } = await client
            .rpc('rollback_robot', {
                target_robot_id: robotId,
                target_version: version,
                performing_user_id: userId
            });

        if (error) throw error;
        return {
            robotId: robotId,
            version: version,
            success: true,
            message: data?.[0]?.message || 'Rollback successful'
        };
    } catch (error) {
        handleError(error instanceof Error ? error : String(error), 'rollbackRobot');
        return {
            robotId: robotId,
            version: version,
            success: false,
            message: 'Rollback failed'
        };
    }
};

// Permanently delete a robot (hard delete - use with caution)
export const permanentlyDeleteRobot = async (id: string): Promise<void> => {
    try {
        const client = getClient();
        // This will cascade delete version history due to foreign key constraint
        const { error } = await client
            .from('robots')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        handleError(error instanceof Error ? error : String(error), 'permanentlyDeleteRobot');
        // Fallback to storage - hard delete
        const robots = safeParse(storage.get(STORAGE_KEYS.ROBOTS), []);
        const filteredRobots = robots.filter((r: Robot) => r.id !== id);
        trySaveToStorage(STORAGE_KEYS.ROBOTS, filteredRobots);
    }
};

// Restore a soft-deleted robot
export const restoreRobot = async (id: string): Promise<Robot | null> => {
    try {
        const client = getClient();
        const { data, error } = await client
            .from('robots')
            .update({ deleted_at: null })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        handleError(error instanceof Error ? error : String(error), 'restoreRobot');
        // Fallback to storage - restore
        const robots = safeParse(storage.get(STORAGE_KEYS.ROBOTS), []);
        const robot = robots.find((r: Robot) => r.id === id);
        if (robot) {
            const updatedRobot = { ...robot, deleted_at: null };
            const updatedRobots = robots.map((r: Robot) => r.id === id ? updatedRobot : r);
            trySaveToStorage(STORAGE_KEYS.ROBOTS, updatedRobots);
            return updatedRobot;
        }
        return null;
    }
};