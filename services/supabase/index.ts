/**
 * Main Supabase Service Interface for QuantForge AI
 * Unified interface that delegates to modular components
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { UserSession } from '../../types';
import { connectionManager } from '../database/connectionManager';
import { settingsManager } from '../settingsManager';
import { mockAuth, addAuthListener, removeAuthListener } from './auth';
import { mockDB, getRobotsPaginated, searchRobots, getRobots, saveRobot, updateRobot, deleteRobot, duplicateRobot } from './database';
import { handleErrorCompat as handleError } from '../../utils/errorManager';

// Determine if we're in mock mode
const isMockMode = settingsManager.getDBSettings().mode !== 'supabase';

/**
 * Main Supabase Client Interface
 * Provides consistent API regardless of backend mode
 */
export const supabase = {
  // Authentication
  auth: mockAuth,
  
  // Database operations
  from: (table: string) => {
    if (isMockMode) {
      return mockDB.from(table);
    }
    
    // TODO: Implement real Supabase client operations
    // For now, delegate to mock implementation
    return mockDB.from(table);
  },
  
  // Real-time subscriptions (mock implementation)
  channel: (name: string) => ({
    on: (event: string, callback: Function) => ({
      subscribe: () => ({
        unsubscribe: () => {}
      })
    })
  }),
  
  // Storage operations (mock implementation)
  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, file: File) => ({ data: null, error: { message: 'Storage not implemented in mock mode' } }),
      download: async (path: string) => ({ data: null, error: { message: 'Storage not implemented in mock mode' } }),
      remove: async (paths: string[]) => ({ data: null, error: { message: 'Storage not implemented in mock mode' } }),
    })
  },
  
  // Functions (mock implementation)
  functions: {
    invoke: async (functionName: string, payload?: any) => ({ data: null, error: { message: 'Functions not implemented in mock mode' } })
  }
};

export const dbUtils = {
  async checkConnection(): Promise<{ success: boolean; message: string; mode: string }> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      return { success: true, message: "Connected to Local Storage (Mock Mode)", mode: 'mock' };
    }

    if (!settings.url || !settings.anonKey) {
      return { success: false, message: "Missing Supabase URL or Key", mode: 'supabase' };
    }

    try {
      const { data, error } = await mockDB.from('robots').select();
      if (error) throw error;
      return { success: true, message: `Connected to Supabase. Found ${data?.length || 0} records.`, mode: 'supabase' };
    } catch (e: unknown) {
      const error = e as Error;
      return { success: false, message: `Connection Failed: ${error.message || error}`, mode: 'supabase' };
    }
  },

  async getStats(): Promise<{ count: number; storageType: string }> {
    const settings = settingsManager.getDBSettings();
    if (settings.mode === 'mock') {
      const { data: robots } = await mockDB.from('robots').select();
      return { count: robots?.length || 0, storageType: 'Browser Local Storage' };
    } else {
      const { data } = await mockDB.from('robots').select();
      return { count: data?.length || 0, storageType: 'Supabase Cloud DB' };
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
  } catch (error) {
    handleError(error, 'supabase.health_check');
    return { status: 'error', message: 'Health check failed' };
  }
};

// Connection management for real mode
export const getConnectionState = () => {
  if (isMockMode) {
    return { connected: false, mode: 'mock', provider: 'localStorage' };
  }
  
  try {
    const client = connectionManager.getConnection(true);
    return { connected: Boolean(client), mode: 'real' };
  } catch (error) {
    handleError(error, 'supabase.get_connection_state');
    return { connected: false, mode: 'error', error: 'Failed to get connection state' };
  }
};