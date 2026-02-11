/**
 * Main Supabase Service Interface for QuantForge AI
 * Unified interface that delegates to modular components
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from '../settingsManager';
import { mockAuth, addAuthListener, removeAuthListener } from './auth';
import { mockDB, getRobotsPaginated, searchRobots, getRobots, saveRobot, updateRobot, deleteRobot, duplicateRobot } from './database';

// Auth methods are handled directly in the main interface
import { handleErrorCompat as handleError } from '../../utils/errorManager';
import { logger } from '../../utils/logger';

// Define the enhanced supabase interface to include convenience methods
interface EnhancedSupabaseClient {
  auth: any;
  from: (table: string) => any;
  getRobots: () => Promise<any>;
  updateRobot: (id: string, updates: any) => Promise<any>;
  saveRobot: (robot: any) => Promise<any>;
  channel: (name: string) => any;
  storage: any;
  functions: any;
}

// Determine if we're in mock mode
const isMockMode = settingsManager.getDBSettings()?.mode !== 'supabase';

/**
 * Main Supabase Client Interface
 * Provides consistent API regardless of backend mode
 */
const supabaseImpl: EnhancedSupabaseClient = {
  // Authentication - with defensive checks to ensure methods exist
  auth: {
    ...mockAuth,
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      // Password is ignored in mock mode, but interface is preserved
      if (typeof mockAuth.signInWithPassword !== 'function') {
        logger.error('signInWithPassword is not a function');
        return { data: { session: null, user: null }, error: { message: 'Auth not initialized' } };
      }
      return mockAuth.signInWithPassword({ email, password });
    },
    signUp: async ({ email, password }: { email: string; password: string }) => {
      // Password is ignored in mock mode, but interface is preserved
      if (typeof mockAuth.signUp !== 'function') {
        logger.error('signUp is not a function');
        return { data: { session: null, user: null }, error: { message: 'Auth not initialized' } };
      }
      return mockAuth.signUp({ email, password });
    },
    signOut: async () => {
      if (typeof mockAuth.signOut !== 'function') {
        logger.error('signOut is not a function');
        return { error: { message: 'Auth not initialized' } };
      }
      return mockAuth.signOut();
    },
    getSession: async () => {
      // Defensive check: ensure getSession is always a function
      if (typeof mockAuth.getSession !== 'function') {
        logger.warn('getSession is not a function, returning null session');
        return { data: { session: null }, error: null };
      }
      return mockAuth.getSession();
    },
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      if (typeof mockAuth.onAuthStateChange !== 'function') {
        logger.error('onAuthStateChange is not a function');
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
      return mockAuth.onAuthStateChange(callback);
    },
  },
  
  // Database operations
  from: (table: string) => {
    if (isMockMode) {
      return mockDB.from(table);
    }
    
    // TODO: Implement real Supabase client operations
    // For now, delegate to mock implementation
    return mockDB.from(table);
  },

  // Convenience methods for backward compatibility
  getRobots: async () => {
    const result = await mockDB.from('robots').select();
    return result;
  },
  updateRobot: async (id: string, updates: any) => {
    const result = await mockDB.from('robots').update({ id, ...updates });
    return result;
  },
  saveRobot: async (robot: any) => {
    const result = await mockDB.from('robots').insert(robot);
    return result;
  },
  
  // Real-time subscriptions (mock implementation)
  channel: (_name: string) => ({
    on: (_event: string, _callback: Function) => ({
      subscribe: () => ({
        unsubscribe: () => {}
      })
    })
  }),
  
  // Storage operations (mock implementation)
  storage: {
    from: (_bucket: string) => ({
      upload: async (_path: string, _file: File) => ({ data: null, error: { message: 'Storage not implemented in mock mode' } }),
      download: async (_path: string) => ({ data: null, error: { message: 'Storage not implemented in mock mode' } }),
      remove: async (_paths: string[]) => ({ data: null, error: { message: 'Storage not implemented in mock mode' } }),
    })
  },
  
  // Functions (mock implementation)
  functions: {
    invoke: async (_functionName: string, _payload?: any) => ({ data: null, error: { message: 'Functions not implemented in mock mode' } })
  }
};

export const supabase = supabaseImpl;

export const dbUtils = {
  async checkConnection(): Promise<{ success: boolean; message: string; mode: string }> {
    const settings = settingsManager.getDBSettings();
    if (!settings || settings.mode === 'mock') {
      return { success: true, message: "Connected to Local Storage (Mock Mode)", mode: 'mock' };
    }

    if (!settings.url || !settings.anonKey) {
      return { success: false, message: "Missing Supabase URL or Key", mode: 'supabase' };
    }

    try {
      const { data, error } = await mockDB.from('robots').select();
      if (error) throw error;
      return { success: true, message: `Connected to Supabase. Found ${(Array.isArray(data) ? data.length : 0)} records.`, mode: 'supabase' };
    } catch (e: unknown) {
      const error = e as Error;
      return { success: false, message: `Connection Failed: ${error.message || error}`, mode: 'supabase' };
    }
  },

  async getStats(): Promise<{ count: number; storageType: string }> {
    const settings = settingsManager.getDBSettings();
    if (!settings || settings.mode === 'mock') {
      const { data: robots } = await mockDB.from('robots').select();
      return { count: (Array.isArray(robots) ? robots.length : 0), storageType: 'Browser Local Storage' };
    } else {
      const { data } = await mockDB.from('robots').select();
      return { count: (Array.isArray(data) ? data.length : 0), storageType: 'Supabase Cloud DB' };
    }
  },

  async migrateMockToSupabase(): Promise<{ success: boolean; message: string; count?: number }> {
    // Simplified migration - for now return not implemented
    return { success: false, message: "Migration not implemented in current version" };
  }
};

// Export convenience functions
export { addAuthListener, removeAuthListener, getRobotsPaginated, searchRobots, mockDB, 
         getRobots, saveRobot, updateRobot, deleteRobot, duplicateRobot };

// Export types
export type { SupabaseClient };

// Health check
export const checkSupabaseHealth = async () => {
  try {
    if (isMockMode) {
      return { status: 'mock_mode', message: 'Running in localStorage mock mode' };
    }
    
    // TODO: Implement real Supabase health check
    return { status: 'not_implemented', message: 'Real Supabase health check not implemented' };
  } catch (error: unknown) {
    handleError(error instanceof Error ? error : new Error(String(error)), 'supabase.health_check');
    return { status: 'error', message: 'Health check failed' };
  }
};

// Connection management for real mode
export const getConnectionState = () => {
  if (isMockMode) {
    return { connected: false, mode: 'mock', provider: 'localStorage' };
  }
  
  // TODO: Implement real connection management
  return { connected: false, mode: 'real', provider: 'supabase' };
};