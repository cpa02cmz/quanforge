/**
 * Simple Connection Manager Wrapper
 * Bridges the existing connection manager to our modular interface
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { UserSession } from '../../types';
import { handleError } from '../../utils/errorHandler';
import { getClient as getSupabaseClient } from './client';

export interface ConnectionManagerInterface {
  getClient(): Promise<SupabaseClient>;
  getSession(): Promise<{ data: { session: UserSession | null }; error: any }>;
  onAuthStateChange(callback: (event: string, session: UserSession | null) => void): { data: { subscription: { unsubscribe: () => void } } };
  isAuthenticated(): boolean;
  signOut(): Promise<{ error: any }>;
  getHealthStatus(): Promise<{ healthy: boolean; latency: number; error?: string }>;
}

export class SimpleConnectionManager implements ConnectionManagerInterface {

  async getClient(): Promise<SupabaseClient> {
    try {
      return getSupabaseClient();
    } catch (error) {
      handleError(error as Error, 'getClient', 'simpleConnectionManager');
      throw error;
    }
  }

  async getSession(): Promise<{ data: { session: UserSession | null }; error: any }> {
    try {
      // For now, implement basic session handling
      const data = localStorage.getItem('mock_session');
      const session = data ? JSON.parse(data) : null;
      return { data: { session }, error: null };
    } catch (error) {
      handleError(error as Error, 'getSession', 'simpleConnectionManager');
      return { data: { session: null }, error: (error as Error).message };
    }
  }

  onAuthStateChange(_callback: (event: string, session: UserSession | null) => void): { data: { subscription: { unsubscribe: () => void } } } {
    // Mock implementation for now
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            // Mock unsubscribe
          }
        }
      }
    };
  }

  isAuthenticated(): boolean {
    const data = localStorage.getItem('mock_session');
    return !!data;
  }

  async signOut(): Promise<{ error: any }> {
    try {
      localStorage.removeItem('mock_session');
      return { error: null };
    } catch (error) {
      handleError(error as Error, 'signOut', 'simpleConnectionManager');
      return { error: (error as Error).message };
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    try {
      const startTime = performance.now();
      const client = await this.getClient();
      
      // Simple health check
      await client.from('robots').select('id').limit(1);
      
      const latency = performance.now() - startTime;
      return { healthy: true, latency };
    } catch (error) {
      return { 
        healthy: false, 
        latency: 0, 
        error: (error as Error).message 
      };
    }
  }
}

// Export singleton instance
export const connectionManager = new SimpleConnectionManager();