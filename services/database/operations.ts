import { Robot } from '../../types';
import { getClient, STORAGE_KEYS, safeParse, trySaveToStorage, generateUUID } from './client';
import { handleError } from '../../utils/errorHandler';

// Robot operations
export const getRobots = async (userId: string): Promise<Robot[]> => {
    try {
        const client = getClient();
        const { data, error } = await client
            .from('robots')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        handleError(error, 'getRobots');
        // Fallback to localStorage
        const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        return robots.filter((r: Robot) => r.user_id === userId);
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
        handleError(error, 'getRobot');
        // Fallback to localStorage
        const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
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
        handleError(error, 'saveRobot');
        // Fallback to localStorage
        const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        const existingIndex = robots.findIndex((r: Robot) => r.id === robot.id);
        
        if (existingIndex >= 0) {
            robots[existingIndex] = robot;
        } else {
            robots.push(robot);
        }
        
        trySaveToStorage(STORAGE_KEYS.ROBOTS, JSON.stringify(robots));
        return robot;
    }
};

export const deleteRobot = async (id: string): Promise<void> => {
    try {
        const client = getClient();
        const { error } = await client
            .from('robots')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        handleError(error, 'deleteRobot');
        // Fallback to localStorage
        const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        const filteredRobots = robots.filter((r: Robot) => r.id !== id);
        trySaveToStorage(STORAGE_KEYS.ROBOTS, JSON.stringify(filteredRobots));
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
        handleError(error, 'batchUpdateRobots');
        // Fallback to localStorage
        const existingRobots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        const updatedRobots = [...existingRobots];
        
        robots.forEach(robot => {
            const index = updatedRobots.findIndex((r: Robot) => r.id === robot.id);
            if (index >= 0) {
                updatedRobots[index] = robot;
            } else {
                updatedRobots.push(robot);
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

// Pagination support
export const getRobotsPaginated = async (
    userId: string, 
    page: number = 1, 
    limit: number = 20
): Promise<{ robots: Robot[]; total: number; page: number; totalPages: number }> => {
    try {
        const client = getClient();
        const offset = (page - 1) * limit;
        
        // Get total count
        const { count: total, error: countError } = await client
            .from('robots')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (countError) throw countError;

        // Get paginated data
        const { data, error } = await client
            .from('robots')
            .select('*')
            .eq('user_id', userId)
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
        handleError(error, 'getRobotsPaginated');
        // Fallback to localStorage
        const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
        const userRobots = robots.filter((r: Robot) => r.user_id === userId);
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