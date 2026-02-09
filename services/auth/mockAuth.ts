/**
 * Mock authentication system for development and offline usage
 * Extracted from monolithic supabase.ts for better modularity
 */

import type { UserSession } from '../../types';
import { STORAGE_KEYS } from '../core/databaseConfig';
import { generateUUID, trySaveToStorage } from '../utils/helpers';
import { getMockSession } from './mockSession';

// Array of auth event listeners
const authListeners: Array<(event: string, session: UserSession | null) => void> = [];

/**
 * Mock authentication system that emulates Supabase auth API
 * Provides full authentication flow without requiring backend connection
 */
export const mockAuth = {
  /**
   * Get current session from localStorage
   */
  getSession: async () => {
    return { data: { session: getMockSession() }, error: null };
  },

  /**
   * Subscribe to auth state changes
   * Returns subscription with unsubscribe method
   */
  onAuthStateChange: (callback: (event: string, session: UserSession | null) => void) => {
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

  /**
   * Sign in with email (mock implementation)
   */
  signInWithPassword: async ({ email }: { email: string }) => {
    const session = {
      user: { id: generateUUID(), email },
      access_token: 'mock-token-' + Date.now(),
      expires_in: 3600
    };
    trySaveToStorage(STORAGE_KEYS.SESSION, JSON.stringify(session));
    authListeners.forEach(cb => cb('SIGNED_IN', session));
    return { data: { session }, error: null };
  },

  /**
   * Sign up with email (mock implementation)
   */
  signUp: async ({ email }: { email: string }) => {
    const session = {
      user: { id: generateUUID(), email },
      access_token: 'mock-token-' + Date.now(),
      expires_in: 3600
    };
    trySaveToStorage(STORAGE_KEYS.SESSION, JSON.stringify(session));
    authListeners.forEach(cb => cb('SIGNED_IN', session));
    return { data: { user: { email }, session }, error: null };
  },

  /**
   * Sign out and clear session
   */
  signOut: async () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    authListeners.forEach(cb => cb('SIGNED_OUT', null));
    return { error: null };
  }
};