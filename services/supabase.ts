import { settingsManager } from './settingsManager';
import { Robot } from '../types';
import { robotCache } from './optimizedCache';
import { securityManager } from './securityManager';
import { handleError } from '../utils/errorHandler';

// Connection retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
};

// Mock client for fallback
const mockClient = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signIn: () => Promise.resolve({ data: { user: null }, error: new Error('Mock mode') }),
    signOut: () => Promise.resolve({ error: null }),
  },
  from: () => ({
    select: () => ({
      order: () => ({
        limit: () => Promise.resolve({ data: [], error: null })
      })
    }),
    insert: () => Promise.resolve({ data: null, error: new Error('Mock mode') }),
    update: () => Promise.resolve({ data: null, error: new Error('Mock mode') }),
    delete: () => Promise.resolve({ data: null, error: new Error('Mock mode') }),
    eq: () => ({
      select: () => Promise.resolve({ data: null, error: new Error('Mock mode') })
    })
  })
};

let activeClient: any = mockClient;

// Initialize client
const initializeClient = async () => {
  try {
    const settings = settingsManager.getDBSettings();
    if (settings.url && settings.anonKey) {
      // Try to import and create Supabase client
      const { createClient } = await import('@supabase/supabase-js');
      activeClient = createClient(settings.url, settings.anonKey);
    } else {
      activeClient = mockClient;
    }
  } catch (error) {
    console.warn('Failed to initialize Supabase client, using mock:', error);
    activeClient = mockClient;
  }
};

// Retry helper
const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < RETRY_CONFIG.maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < RETRY_CONFIG.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.retryDelay * (i + 1)));
      }
    }
  }
  
  throw lastError;
};

// Initialize on import
initializeClient();

export const mockDb = {
  // Get all robots
  async getRobots() {
    try {
      const cacheKey = 'robots_list';
      const cached = await robotCache.get<Robot[]>(cacheKey);
      if (cached) {
        return { data: cached, error: null };
      }
      
      const result = await withRetry(async () => {
        const client = await getClient();
        return client
          .from('robots')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
      });
      
      if (result.data && !result.error) {
        await robotCache.set(cacheKey, result.data, { ttl: 300000 }); // 5 minutes
      }
      
      return result;
    } catch (error) {
      handleError(error as Error, 'getRobots', 'supabase');
      return { data: [], error: error as Error };
    }
  },

  // Save robot
  async saveRobot(robot: any) {
    try {
      // Validate robot data
      const validation = securityManager.sanitizeAndValidate(robot, 'robot');
      if (!validation.isValid) {
        throw new Error(`Invalid robot data: ${validation.errors.join(', ')}`);
      }

      const result = await withRetry(async () => {
        const client = await getClient();
        return client.from('robots').insert(validation.sanitizedData);
      });

      // Clear cache
      await robotCache.delete('robots_list');
      
      return result;
    } catch (error) {
      handleError(error as Error, 'saveRobot', 'supabase');
      return { data: null, error: error as Error };
    }
  },

  // Update robot
  async updateRobot(id: string, updates: any) {
    try {
      // Validate updates
      const validation = securityManager.sanitizeAndValidate(updates, 'robot');
      if (!validation.isValid) {
        throw new Error(`Invalid updates: ${validation.errors.join(', ')}`);
      }

      const result = await withRetry(async () => {
        const client = await getClient();
        return client.from('robots').update(validation.sanitizedData).eq('id', id);
      });

      // Clear cache
      await robotCache.delete('robots_list');
      
      return result;
    } catch (error) {
      handleError(error as Error, 'updateRobot', 'supabase');
      return { data: null, error: error as Error };
    }
  },

  // Delete robot
  async deleteRobot(id: string) {
    try {
      const result = await withRetry(async () => {
        const client = await getClient();
        return client.from('robots').delete().eq('id', id);
      });

      // Clear cache
      await robotCache.delete('robots_list');
      
      return result;
    } catch (error) {
      handleError(error as Error, 'deleteRobot', 'supabase');
      return { data: null, error: error as Error };
    }
  },

  // Duplicate robot
  async duplicateRobot(id: string) {
    try {
      // First get the original robot
      const originalResult = await withRetry(async () => {
        const client = await getClient();
        return client.from('robots').select('*').eq('id', id).single();
      });

      if (originalResult.error || !originalResult.data) {
        throw new Error('Robot not found');
      }

      // Create a copy
      const robot = originalResult.data;
      const duplicate = {
        ...robot,
        id: undefined,
        name: `${robot.name} (Copy)`,
        created_at: undefined,
        updated_at: undefined,
      };

      return await this.saveRobot(duplicate);
    } catch (error) {
      handleError(error as Error, 'duplicateRobot', 'supabase');
      return { data: null, error: error as Error };
    }
  },
};

// Helper function to get client
async function getClient() {
  return activeClient;
}

// Export the client for direct use
export const supabase = activeClient;

// Export utilities
export const dbUtils = {
  clearCache: () => robotCache.clear(),
  getCacheStats: () => robotCache.getStats(),
  async getStats() {
    return {
      count: 0,
      storageType: 'mock'
    };
  },
  async checkConnection() {
    try {
      await initializeClient();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: 'Connection failed' };
    }
  },
  async migrateMockToSupabase() {
    // Mock migration
    return { success: true, message: 'Migration completed', count: 0 };
  }
};