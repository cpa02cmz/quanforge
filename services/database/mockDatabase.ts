import { Robot } from '../../types';
import { generateUUID, isValidRobot, safeParse, trySaveToStorage, ROBOTS_KEY } from './utils';

// Mock session storage
const STORAGE_KEY = 'mock_session';

// --- Mock Implementation ---

const getMockSession = () => {
  return safeParse(localStorage.getItem(STORAGE_KEY), null);
};

const authListeners: Array<(event: string, session: any) => void> = [];

const mockAuth = {
  getSession: async () => {
    return { data: { session: getMockSession() }, error: null };
  },
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    authListeners.push(callback);
    return { 
      data: { 
        subscription: { 
          unsubscribe: () => {
            const idx = authListeners.indexOf(callback);
            if (idx > -1) authListeners.splice(idx, 1);
          }
        } 
      } 
    };
  },
  signIn: async () => {
    const session = {
      user: { id: generateUUID(), email: 'demo@example.com' },
      access_token: 'mock_token',
      expires_in: 3600,
      refresh_token: 'mock_refresh',
      token_type: 'bearer'
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    authListeners.forEach(listener => listener('SIGNED_IN', session));
    return { data: { session }, error: null };
  },
  signOut: async () => {
    localStorage.removeItem(STORAGE_KEY);
    authListeners.forEach(listener => listener('SIGNED_OUT', null));
    return { error: null };
  },
  updateUser: async (attributes: any) => {
    const session = getMockSession();
    if (session) {
      const updatedSession = { ...session, user: { ...session.user, ...attributes } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
      authListeners.forEach(listener => listener('USER_UPDATED', updatedSession));
      return { data: { session: updatedSession }, error: null };
    }
    return { data: { session: null }, error: { message: 'No active session' } };
  }
};

const mockDb = {
  // Robot CRUD operations
  async getRobots(userId: string): Promise<Robot[]> {
    const stored = localStorage.getItem(ROBOTS_KEY);
    const robots = safeParse(stored, []);
    return robots.filter((r: Robot) => r.user_id === userId);
  },

  async getRobot(userId: string, robotId: string): Promise<Robot | null> {
    const robots = await this.getRobots(userId);
    return robots.find((r: Robot) => r.id === robotId) || null;
  },

  async saveRobot(robot: Robot): Promise<{ error: any }> {
    try {
      const robots = await this.getRobots(robot.user_id);
      const existingIndex = robots.findIndex((r: Robot) => r.id === robot.id);
      
      if (existingIndex >= 0) {
        robots[existingIndex] = { ...robot, updated_at: new Date().toISOString() };
      } else {
        robots.push({ ...robot, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
      
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  },

  async deleteRobot(userId: string, robotId: string): Promise<{ error: any }> {
    try {
      const robots = await this.getRobots(userId);
      const filtered = robots.filter((r: Robot) => r.id !== robotId);
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(filtered));
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  },

  async duplicateRobot(userId: string, robotId: string, newName: string): Promise<Robot | null> {
    try {
      const original = await this.getRobot(userId, robotId);
      if (!original) return null;

      const duplicate: Robot = {
        ...original,
        id: generateUUID(),
        name: newName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await this.saveRobot(duplicate);
      return error ? null : duplicate;
    } catch (error) {
      return null;
    }
  },

  // Batch operations
  async batchUpdateRobots(updates: Array<{ id: string; data: Partial<Robot> }>): Promise<{ error: any }> {
    try {
      const stored = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse(stored, []);
      
      updates.forEach(({ id, data }) => {
        const index = robots.findIndex((r: Robot) => r.id === id);
        if (index >= 0) {
          robots[index] = { 
            ...robots[index], 
            ...data, 
            updated_at: new Date().toISOString() 
          };
        }
      });
      
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  },

  // Search and filter operations
  async searchRobots(userId: string, query: string): Promise<Robot[]> {
    const robots = await this.getRobots(userId);
    const lowercaseQuery = query.toLowerCase();
    
    return robots.filter((robot: Robot) => 
      robot.name.toLowerCase().includes(lowercaseQuery) ||
      robot.description.toLowerCase().includes(lowercaseQuery) ||
      robot.strategy_type.toLowerCase().includes(lowercaseQuery)
    );
  },

  async getRobotsByStrategyType(userId: string, strategyType: string): Promise<Robot[]> {
    const robots = await this.getRobots(userId);
    return robots.filter((robot: Robot) => robot.strategy_type === strategyType);
  },

  // Pagination
  async getRobotsPaginated(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<{ robots: Robot[]; total: number; page: number; totalPages: number }> {
    const robots = await this.getRobots(userId);
    const total = robots.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
      robots: robots.slice(startIndex, endIndex),
      total,
      page,
      totalPages
    };
  },

  // Database optimization
  async optimizeDatabase(): Promise<{ success: boolean; message: string }> {
    try {
      const stored = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse(stored, []);
      
      // Remove invalid or duplicate records
      const seenIds = new Set<string>();
      const validRobots = robots.filter((robot: Robot) => {
        if (!isValidRobot(robot)) return false;
        if (seenIds.has(robot.id)) return false;
        seenIds.add(robot.id);
        return true;
      });
      
      if (validRobots.length !== robots.length) {
        trySaveToStorage(ROBOTS_KEY, JSON.stringify(validRobots));
        return { 
          success: true, 
          message: `Database optimized: ${robots.length - validRobots.length} invalid or duplicate records removed. ${validRobots.length} valid records remaining.` 
        };
      }
      
      return { 
        success: true, 
        message: "Database is already optimized" 
      };
    } catch (e: any) {
      return { 
        success: false, 
        message: `Database optimization failed: ${e.message}` 
      };
    }
  },

  // Database statistics
  async getDatabaseStats(): Promise<{ 
    totalRecords: number; 
    totalSizeKB: number; 
    avgRecordSizeKB: number; 
    duplicateRecords?: number;
    invalidRecords?: number;
  }> {
    const stored = localStorage.getItem(ROBOTS_KEY);
    const robots = safeParse(stored, []);
    
    // Calculate total size
    const totalSize = new Blob([JSON.stringify(robots)]).size;
    const avgSize = robots.length > 0 ? totalSize / robots.length : 0;
    
    // Identify duplicates and invalid records
    const seenIds = new Set<string>();
    let duplicateCount = 0;
    let invalidCount = 0;
    
    for (const robot of robots) {
      if (seenIds.has(robot.id)) {
        duplicateCount++;
      } else {
        seenIds.add(robot.id);
      }
      
      if (!robot || typeof robot !== 'object' || !robot.id || !robot.name || !robot.code) {
        invalidCount++;
      }
    }
    
    return {
      totalRecords: robots.length,
      totalSizeKB: Math.round(totalSize / 1024),
      avgRecordSizeKB: Math.round(avgSize / 1024),
      duplicateRecords: duplicateCount,
      invalidRecords: invalidCount
    };
  }
};

export { mockAuth, mockDb };