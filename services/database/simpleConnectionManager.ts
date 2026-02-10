/**
 * Simple Connection Manager Wrapper
 * Bridges the existing connection manager to our modular interface
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { UserSession } from '../../types';
import { handleError, isError, getErrorMessage } from '../../utils/errorHandler';
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
    } catch (error: unknown) {
      const typedError = isError(error) ? error : new Error(getErrorMessage(error));
      handleError(typedError, 'getClient', 'simpleConnectionManager');
      throw typedError;
    }
  }

  async getSession(): Promise<{ data: { session: UserSession | null }; error: unknown }> {
    try {
      // For now, implement basic session handling
      const data = localStorage.getItem('mock_session');
      const session = data ? JSON.parse(data) : null;
      return { data: { session }, error: null };
    } catch (error: unknown) {
      const typedError = isError(error) ? error : new Error(getErrorMessage(error));
      handleError(typedError, 'getSession', 'simpleConnectionManager');
      return { data: { session: null }, error: getErrorMessage(error) };
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

  async signOut(): Promise<{ error: unknown }> {
    try {
      localStorage.removeItem('mock_session');
      return { error: null };
    } catch (error: unknown) {
      const typedError = isError(error) ? error : new Error(getErrorMessage(error));
      handleError(typedError, 'signOut', 'simpleConnectionManager');
      return { error: getErrorMessage(error) };
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
    } catch (error: unknown) {
      return {
        healthy: false,
        latency: 0,
        error: getErrorMessage(error)
      };
    }
  }
}

// Export singleton instance
export const connectionManager = new SimpleConnectionManager();