/**
 * Mock Authentication Service for QuantForge AI
 * Provides Supabase-compatible authentication interface using localStorage
 */

import { UserSession } from '../../types';
import { STORAGE_KEYS, safeParse, trySaveToStorage, generateUUID } from './storage';

// Auth state management
const authListeners: Array<(event: string, session: UserSession | null) => void> = [];

const getMockSession = (): UserSession | null => {
  return safeParse(localStorage.getItem(STORAGE_KEYS.SESSION), null);
};

const setMockSession = (session: UserSession | null) => {
  if (session) {
    trySaveToStorage(STORAGE_KEYS.SESSION, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }
  
  // Notify all listeners
  const event = session ? 'SIGNED_IN' : 'SIGNED_OUT';
  authListeners.forEach(listener => {
    try {
      listener(event, session);
    } catch (e) {
      console.error('Auth listener error:', e);
    }
  });
};

// Mock auth implementation
export const mockAuth = {
  getSession: async () => {
    return { data: { session: getMockSession() }, error: null };
  },
  
  onAuthStateChange: (callback: (event: string, session: UserSession | null) => void) => {
    authListeners.push(callback);
    return { 
      data: { 
        subscription: { 
          unsubscribe: () => {
            const idx = authListeners.indexOf(callback);
            if (idx > -1) {
              authListeners.splice(idx, 1);
            }
          }
        } 
      } 
    };
  },
  
  signInWithPassword: async ({ email }: { email: string }) => {
    const session: UserSession = {
      user: {
        id: generateUUID(),
        email: email,
      },
      access_token: generateUUID(),
      refresh_token: generateUUID(),
      expires_in: 3600, // 1 hour
      token_type: 'bearer'
    };
    
    setMockSession(session);
    return { data: { session, user: session.user }, error: null };
  },
  
  signUp: async ({ email }: { email: string }) => {
    return mockAuth.signInWithPassword({ email });
  },
  
  signOut: async () => {
    setMockSession(null);
    return { error: null };
  },
  
  updateUser: async (attributes: { email?: string }) => {
    const currentSession = getMockSession();
    if (!currentSession) {
      return { data: { user: null }, error: { message: 'No active session' } };
    }
    
    const updatedSession: UserSession = {
      ...currentSession,
      user: {
        ...currentSession.user,
        ...attributes
      }
    };
    
    setMockSession(updatedSession);
    return { data: { user: updatedSession.user }, error: null };
  }
};

// Auth listener helper for external use
export const addAuthListener = (callback: (event: string, session: UserSession | null) => void) => {
  authListeners.push(callback);
};

export const removeAuthListener = (callback: (event: string, session: UserSession | null) => void) => {
  const idx = authListeners.indexOf(callback);
  if (idx > -1) {
    authListeners.splice(idx, 1);
  }
};