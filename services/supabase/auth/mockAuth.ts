// Mock authentication implementation for development

import { UserSession } from '../../../types';
import { STORAGE_KEYS, safeParse } from './databaseUtils';
import { logger } from '../../../utils/logger';
import { TOKEN_CONFIG } from '../../../constants/modularConfig';

// Auth state listeners
const authListeners: Array<(event: string, session: UserSession | null) => void> = [];

export const mockAuth = {
  getSession: async () => {
    try {
      const storedData = localStorage.getItem(STORAGE_KEYS.MOCK_SESSION);
      const session = safeParse(storedData, null);
      return { data: { session }, error: null };
    } catch (error: unknown) {
      logger.error('Error getting mock session:', error);
      return { data: { session: null }, error: { message: 'Failed to get session' } };
    }
  },

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

  signIn: async (email: string, _password: string) => {
    try {
      const session: UserSession = {
        user: {
          id: 'mock-user-id',
          email: email,
          created_at: new Date().toISOString()
        },
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_at: Date.now() + TOKEN_CONFIG.EXPIRY.ACCESS_TOKEN_MS
      };

      localStorage.setItem(STORAGE_KEYS.MOCK_SESSION, JSON.stringify(session));

      // Notify listeners
      authListeners.forEach(listener => listener('SIGNED_IN', session));

      return { data: { user: session.user, session }, error: null };
    } catch (error: unknown) {
      logger.error('Error signing in:', error);
      return { data: { user: null, session: null }, error: { message: 'Sign in failed' } };
    }
  },

  signUp: async (email: string, password: string) => {
    return mockAuth.signIn(email, password);
  },

  signOut: async () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.MOCK_SESSION);

      // Notify listeners
      authListeners.forEach(listener => listener('SIGNED_OUT', null));

      return { error: null };
    } catch (error: unknown) {
      logger.error('Error signing out:', error);
      return { error: { message: 'Sign out failed' } };
    }
  },

  // Helper to create a mock user for testing
  createMockUser: (email: string = 'test@example.com') => {
    const session: UserSession = {
      user: {
        id: 'mock-user-' + Date.now(),
        email: email,
        created_at: new Date().toISOString()
      },
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_at: Date.now() + TOKEN_CONFIG.EXPIRY.ACCESS_TOKEN_MS
    };

    try {
      localStorage.setItem(STORAGE_KEYS.MOCK_SESSION, JSON.stringify(session));
      authListeners.forEach(listener => listener('SIGNED_IN', session));
      return session;
    } catch (error: unknown) {
      logger.error('Error creating mock user:', error);
      return null;
    }
  },

  // Helper to clear mock session
  clearMockSession: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.MOCK_SESSION);
      authListeners.forEach(listener => listener('SIGNED_OUT', null));
    } catch (error: unknown) {
      logger.error('Error clearing mock session:', error);
    }
  }
};