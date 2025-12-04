import { mockAuth, mockDb } from './database/mockDatabase';
import { getClient, resetClient, healthCheck } from './database/supabaseClient';
import { supabaseDb } from './database/supabaseOperations';
import { settingsManager } from './settingsManager';
import { Robot, UserSession } from '../types';
import { handleError } from '../utils/errorHandler';

// Main database service that switches between mock and real Supabase
const databaseService = {
  // Auth methods
  auth: {
    getSession: async () => {
      const settings = settingsManager.getDBSettings();
      if (settings.mode === 'mock') {
        return mockAuth.getSession();
      }
      
      try {
        const client = await getClient();
        return await client.auth.getSession();
      } catch (error) {
        handleError(error, 'auth.getSession');
        return { data: { session: null }, error };
      }
    },

    onAuthStateChange: (callback: (event: string, session: UserSession | null) => void) => {
      const settings = settingsManager.getDBSettings();
      if (settings.mode === 'mock') {
        return mockAuth.onAuthStateChange(callback);
      }
      
      try {
        const clientPromise = getClient();
        clientPromise.then(client => {
          return client.auth.onAuthStateChange(callback);
        }).catch(error => {
          handleError(error, 'auth.onAuthStateChange');
        });
      } catch (error) {
        handleError(error, 'auth.onAuthStateChange');
      }
      
      // Return mock subscription for consistency
      return mockAuth.onAuthStateChange(callback);
    },

    signIn: async () => {
      const settings = settingsManager.getDBSettings();
      if (settings.mode === 'mock') {
        return mockAuth.signIn();
      }
      
      try {
        const client = await getClient();
        // For Supabase, you would implement proper OAuth or email sign in
        // For now, return mock behavior
        return mockAuth.signIn();
      } catch (error) {
        handleError(error, 'auth.signIn');
        return { data: { session: null }, error };
      }
    },

    signOut: async () => {
      const settings = settingsManager.getDBSettings();
      if (settings.mode === 'mock') {
        return mockAuth.signOut();
      }
      
      try {
        const client = await getClient();
        const result = await client.auth.signOut();
        resetClient(); // Reset client on sign out
        return result;
      } catch (error) {
        handleError(error, 'auth.signOut');
        return { error };
      }
    },

    updateUser: async (attributes: any) => {
      const settings = settingsManager.getDBSettings();
      if (settings.mode === 'mock') {
        return mockAuth.updateUser(attributes);
      }
      
      try {
        const client = await getClient();
        return await client.auth.updateUser(attributes);
      } catch (error) {
        handleError(error, 'auth.updateUser');
        return { data: { session: null }, error };
      }
    }
  },

  // Database methods
  async getRobots(userId: string): Promise<Robot[]> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return mockDb.getRobots(userId);
    }
    
    try {
      return await supabaseDb.getRobots(userId);
    } catch (error) {
      handleError(error, 'getRobots');
      return [];
    }
  },

  async getRobot(userId: string, robotId: string): Promise<Robot | null> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return mockDb.getRobot(userId, robotId);
    }
    
    try {
      return await supabaseDb.getRobot(userId, robotId);
    } catch (error) {
      handleError(error, 'getRobot');
      return null;
    }
  },

  async saveRobot(robot: Robot): Promise<{ error: any }> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return mockDb.saveRobot(robot);
    }
    
    try {
      return await supabaseDb.saveRobot(robot);
    } catch (error) {
      handleError(error, 'saveRobot');
      return { error };
    }
  },

  async deleteRobot(userId: string, robotId: string): Promise<{ error: any }> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return mockDb.deleteRobot(userId, robotId);
    }
    
    try {
      return await supabaseDb.deleteRobot(userId, robotId);
    } catch (error) {
      handleError(error, 'deleteRobot');
      return { error };
    }
  },

  async duplicateRobot(userId: string, robotId: string, newName: string): Promise<Robot | null> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return mockDb.duplicateRobot(userId, robotId, newName);
    }
    
    try {
      return await supabaseDb.duplicateRobot(userId, robotId, newName);
    } catch (error) {
      handleError(error, 'duplicateRobot');
      return null;
    }
  },

  // Batch operations
  async batchUpdateRobots(updates: Array<{ id: string; data: Partial<Robot> }>): Promise<{ error: any }> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return mockDb.batchUpdateRobots(updates);
    }
    
    try {
      return await supabaseDb.batchUpdateRobots(updates);
    } catch (error) {
      handleError(error, 'batchUpdateRobots');
      return { error };
    }
  },

  // Search and filter operations
  async searchRobots(userId: string, query: string): Promise<Robot[]> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return mockDb.searchRobots(userId, query);
    }
    
    try {
      return await supabaseDb.searchRobots(userId, query);
    } catch (error) {
      handleError(error, 'searchRobots');
      return [];
    }
  },

  async getRobotsByStrategyType(userId: string, strategyType: string): Promise<Robot[]> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return mockDb.getRobotsByStrategyType(userId, strategyType);
    }
    
    try {
      return await supabaseDb.getRobotsByStrategyType(userId, strategyType);
    } catch (error) {
      handleError(error, 'getRobotsByStrategyType');
      return [];
    }
  },

  // Pagination
  async getRobotsPaginated(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<{ robots: Robot[]; total: number; page: number; totalPages: number }> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return mockDb.getRobotsPaginated(userId, page, limit);
    }
    
    try {
      return await supabaseDb.getRobotsPaginated(userId, page, limit);
    } catch (error) {
      handleError(error, 'getRobotsPaginated');
      return { robots: [], total: 0, page, totalPages: 0 };
    }
  },

  // Database optimization
  async optimizeDatabase(): Promise<{ success: boolean; message: string }> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return mockDb.optimizeDatabase();
    }
    
    try {
      return await supabaseDb.optimizeDatabase();
    } catch (error) {
      handleError(error, 'optimizeDatabase');
      return { success: false, message: 'Optimization failed' };
    }
  },

  // Database statistics
  async getDatabaseStats(): Promise<{ 
    totalRecords: number; 
    totalSizeKB: number; 
    avgRecordSizeKB: number; 
    lastOptimized?: string;
    duplicateRecords?: number;
    invalidRecords?: number;
  }> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return mockDb.getDatabaseStats();
    }
    
    try {
      return await supabaseDb.getDatabaseStats();
    } catch (error) {
      handleError(error, 'getDatabaseStats');
      return { totalRecords: 0, totalSizeKB: 0, avgRecordSizeKB: 0 };
    }
  },

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; error?: string; mode: string }> {
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode === 'mock') {
      return { healthy: true, mode: 'mock' };
    }
    
    try {
      const result = await healthCheck();
      return { ...result, mode: 'supabase' };
    } catch (error) {
      handleError(error, 'healthCheck');
      return { healthy: false, error: 'Health check failed', mode: 'supabase' };
    }
  }
};

export { databaseService };
export default databaseService;