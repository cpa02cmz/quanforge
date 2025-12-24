/**
 * Supabase Services Backward Compatibility Adapter
 * Provides legacy API support while transitioning to new modular structure
 */

import { coreSupabase } from './core';
import { supabasePool } from './pools';
import { supabaseEdge } from './edge';
import type { Robot, UserSession } from '../../types';
import type { ConnectionConfig, Connection, PoolStats } from './pools';
import type { EdgeConfig, EdgeMetrics } from './edge';

/**
 * Legacy adapter that maintains existing API contracts
 * while delegating to the new modular services
 */

// Create a mock database object that matches the existing interface
const mockDB = {
  from: (table: string) => ({
    select: async (columns?: string) => {
      if (table === 'robots') {
        const robots = await coreSupabase.getRobots();
        return { data: robots, error: null };
      }
      return { data: [], error: { message: `Table ${table} not supported` } };
    },
    insert: async (data: any) => {
      if (table === 'robots') {
        const robot = await coreSupabase.createRobot(data);
        return { data: robot, error: null };
      }
      return { data: null, error: { message: `Table ${table} not supported` } };
    },
    update: async (data: any) => ({
      eq: async (column: string, value: any) => {
        if (table === 'robots' && column === 'id') {
          const robot = await coreSupabase.updateRobot(value, data);
          return { data: robot, error: null };
        }
        return { data: null, error: { message: `Update not supported for this operation` } };
      }
    }),
    delete: async () => ({
      eq: async (column: string, value: any) => {
        if (table === 'robots' && column === 'id') {
          await coreSupabase.deleteRobot(value);
          return { data: null, error: null };
        }
        return { data: null, error: { message: `Delete not supported for this operation` } };
      }
    }),
    single: async () => {
      // This would be used for .single() calls - implement as needed
      return { data: null, error: { message: 'Single() not implemented in adapter' } };
    }
  })
};

// Mock auth that matches existing interface
const mockAuth = {
  signIn: async (email: string, password: string) => {
    const session = await coreSupabase.signIn(email, password);
    return { 
      data: { 
        user: session.user, 
        session: {
          access_token: session.access_token,
          expires_at: Date.now() + (session.expires_in || 3600) * 1000
        }
      }, 
      error: null 
    };
  },
  signUp: async (email: string, password: string) => {
    const session = await coreSupabase.signUp(email, password);
    return { 
      data: { 
        user: session.user, 
        session: {
          access_token: session.access_token,
          expires_at: Date.now() + (session.expires_in || 3600) * 1000
        }
      }, 
      error: null 
    };
  },
  signOut: async () => {
    await coreSupabase.signOut();
    return { error: null };
  },
  getCurrentSession: async () => {
    const session = await coreSupabase.getCurrentSession();
    if (session) {
      return {
        data: {
          user: session.user,
          session: {
            access_token: session.access_token,
            expires_at: Date.now() + (session.expires_in || 3600) * 1000
          }
        },
        error: null
      };
    }
    return { data: { session: null }, error: null };
  },
  onAuthStateChange: (callback: Function) => {
    // Simplified listener - in real implementation this would use Supabase listeners
    const unsubscribe = () => {};
    return { data: { subscription: { unsubscribe } } };
  }
};

// Auth listener functions
const addAuthListener = (callback: Function) => {
  return mockAuth.onAuthStateChange(callback);
};

const removeAuthListener = (subscription: any) => {
  if (subscription?.subscription?.unsubscribe) {
    subscription.subscription.unsubscribe();
  }
};

// Database utility functions
const getRobotsPaginated = async (page: number = 1, limit: number = 10, userId?: string) => {
  const robots = await coreSupabase.getRobots(userId);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedRobots = robots.slice(startIndex, endIndex);
  
  return {
    data: paginatedRobots,
    pagination: {
      page,
      limit,
      total: robots.length,
      totalPages: Math.ceil(robots.length / limit)
    },
    error: null
  };
};

const searchRobots = async (query: string, userId?: string) => {
  const robots = await coreSupabase.getRobots(userId);
  const filteredRobots = robots.filter(robot => 
    robot.name.toLowerCase().includes(query.toLowerCase()) ||
    robot.description.toLowerCase().includes(query.toLowerCase())
  );
  
  return { data: filteredRobots, error: null };
};

const getRobots = async (userId?: string) => {
  const robots = await coreSupabase.getRobots(userId);
  return { data: robots, error: null };
};

const saveRobot = async (robot: Omit<Robot, 'id' | 'created_at' | 'updated_at'>) => {
  const createdRobot = await coreSupabase.createRobot(robot);
  return { data: createdRobot, error: null };
};

const updateRobot = async (id: string, updates: Partial<Robot>) => {
  const updatedRobot = await coreSupabase.updateRobot(id, updates);
  return { data: updatedRobot, error: null };
};

const deleteRobot = async (id: string) => {
  await coreSupabase.deleteRobot(id);
  return { data: null, error: null };
};

const duplicateRobot = async (id: string, newName?: string) => {
  const originalRobot = await coreSupabase.getRobot(id);
  if (!originalRobot) {
    return { data: null, error: { message: 'Robot not found' } };
  }

  const { id: _, created_at: __, updated_at: ___, ...robotData } = originalRobot;
  const duplicatedRobot = await coreSupabase.createRobot({
    ...robotData,
    name: newName || `${originalRobot.name} (Copy)`,
  });

  return { data: duplicatedRobot, error: null };
};

// Export unified interface maintaining backward compatibility
export const supabase = {
  // Authentication
  auth: mockAuth,
  
  // Database operations
  from: (table: string) => mockDB.from(table),
  
  // Real-time subscriptions
  channel: (name: string) => ({
    on: (event: string, callback: Function) => ({
      subscribe: () => ({
        unsubscribe: () => {}
      })
    })
  }),
  
  // Storage operations
  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, file: File) => ({ data: null, error: { message: 'Storage not implemented in adapter' } }),
      download: async (path: string) => ({ data: null, error: { message: 'Storage not implemented in adapter' } }),
      remove: async (paths: string[]) => ({ data: null, error: { message: 'Storage not implemented in adapter' } }),
    })
  },
  
  // Functions
  functions: {
    invoke: async (functionName: string, payload?: any) => ({ data: null, error: { message: 'Functions not implemented in adapter' } })
  }
};

// Database utilities
export const dbUtils = {
  async checkConnection(): Promise<{ success: boolean; message: string; mode: string }> {
    const health = await coreSupabase.healthCheck();
    return {
      success: health.status === 'healthy',
      message: health.mockMode ? "Connected to Local Storage (Mock Mode)" : "Connected to Supabase",
      mode: health.mockMode ? 'mock' : 'supabase'
    };
  },

  async getStats(): Promise<{ count: number; storageType: string }> {
    const robots = await coreSupabase.getRobots();
    const health = await coreSupabase.healthCheck();
    return { 
      count: robots.length, 
      storageType: health.mockMode ? 'Browser Local Storage' : 'Supabase Cloud DB' 
    };
  },

  async migrateMockToSupabase(): Promise<{ success: boolean; message: string; count?: number }> {
    return { success: false, message: "Migration not implemented in adapter" };
  }
};

// Export all the convenience functions
export { 
  addAuthListener, 
  removeAuthListener, 
  getRobotsPaginated, 
  searchRobots, 
  mockDB, 
  getRobots, 
  saveRobot, 
  updateRobot, 
  deleteRobot, 
  duplicateRobot 
};

// Health check
export const checkSupabaseHealth = async () => {
  const health = await coreSupabase.healthCheck();
  return {
    status: health.mockMode ? 'mock_mode' : health.status,
    message: health.mockMode ? 'Running in localStorage mock mode' : 'Supabase connection healthy'
  };
};

// Connection state
export const getConnectionState = () => {
  const mockMode = coreSupabase.mockMode;
  return {
    connected: !mockMode,
    mode: mockMode ? 'mock' : 'real',
    provider: mockMode ? 'localStorage' : 'supabase'
  };
};

// Export the new modular services for advanced usage
export { coreSupabase, supabasePool, supabaseEdge };

// Export types
export type { SupabaseClient } from '@supabase/supabase-js';
export type { ConnectionConfig, Connection, PoolStats, EdgeConfig, EdgeMetrics };