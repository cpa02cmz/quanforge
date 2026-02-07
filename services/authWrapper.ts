/**
 * Auth Wrapper - Provides unified auth interface for both mock and modular systems
 * Bridges the gap between different auth implementations
 */

import { UserSession } from '../types';
import { mockAuth } from './supabase/auth';

// Import modular supabase if available, otherwise use mock
let modularAuth: any = null;
try {
  // Lazy import to avoid circular dependencies
  const modularModule = require('./database/modularSupabase');
  modularAuth = modularModule.modularSupabase;
} catch (e) {
  // Modular system not available, use mock
}

// Determine which auth system to use
const isModularMode = () => {
  // Check if we should use modular service
  return Boolean(modularAuth && localStorage.getItem('use_modular_auth'));
};

// Unified auth interface
export const unifiedAuth = {
  async getSession() {
    if (isModularMode() && modularAuth) {
      const result = await modularAuth.getSession();
      return result;
    }
    return mockAuth.getSession();
  },

  onAuthStateChange(callback: (event: string, session: UserSession | null) => void) {
    if (isModularMode() && modularAuth) {
      return modularAuth.onAuthStateChange(callback);
    }
    return mockAuth.onAuthStateChange(callback);
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    if (isModularMode() && modularAuth && modularAuth.signInWithPassword) {
      return await modularAuth.signInWithPassword({ email, password });
    }
    // Fallback to mock auth
    const result = await mockAuth.signInWithPassword({ email, password });
    
    // Store session for modular compatibility
    if (result.data?.session) {
      localStorage.setItem('mock_session', JSON.stringify(result.data.session));
    }
    
    return result;
  },

  async signUp({ email, password }: { email: string; password: string }) {
    if (isModularMode() && modularAuth && modularAuth.signUp) {
      return await modularAuth.signUp({ email, password });
    }
    // Fallback to mock auth
    const result = await mockAuth.signUp({ email, password });
    
    // Store session for modular compatibility
    if (result.data?.session) {
      localStorage.setItem('mock_session', JSON.stringify(result.data.session));
    }
    
    return result;
  },

  async signOut() {
    if (isModularMode() && modularAuth) {
      const result = await modularAuth.signOut();
      // Always clear local session
      localStorage.removeItem('mock_session');
      return result;
    }
    
    // Use mock auth
    localStorage.removeItem('mock_session');
    return mockAuth.signOut();
  }
};