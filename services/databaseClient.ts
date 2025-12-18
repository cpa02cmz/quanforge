import type { SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from './settingsManager';
import { UserSession } from '../types';
import { edgeConnectionPool } from './edgeSupabasePool';
import { securityManager } from './securityManager';
import { handleError } from '../utils/errorHandler';

export interface IDatabaseClient {
  getClient(): Promise<SupabaseClient>;
  checkConnection(): Promise<{ success: boolean; message: string; mode: string }>;
  getStats(): Promise<{ count: number; storageType: string }>;
  getSession(): Promise<any>;
  signIn(email: string): Promise<any>;
  signOut(): Promise<void>;
  signUp(email: string): Promise<any>;
  onAuthStateChange(callback: Function): { data: { subscription: { unsubscribe: Function } } };
}

// Enhanced connection retry configuration with exponential backoff
const RETRY_CONFIG = {
  maxRetries: 5,
  retryDelay: 500,
  backoffMultiplier: 1.5,
  maxDelay: 10000, // Cap at 10 seconds
  jitter: true, // Add jitter to prevent thundering herd
};

// Mock session storage
const STORAGE_KEY = 'mock_session';

// Helper for safe JSON parsing with enhanced security
const safeParse = (data: string | null, fallback: any) => {
    if (!data) return fallback;
    try {
        // Use security manager's safe JSON parsing
        return securityManager.safeJSONParse(data) || fallback;
    } catch (e) {
        console.error("Failed to parse data from storage:", e);
        return fallback;
    }
};

// Helper: Try save to storage with Quota handling
const trySaveToStorage = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (e: any) {
        if (
            e.name === 'QuotaExceededError' || 
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            e.code === 22 ||
            e.code === 1014
        ) {
            throw new Error("Browser Storage Full. Please delete some robots or export/clear your database to free up space.");
        }
        throw e;
    }
};

// Helper: Generate robust UUID
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// --- Mock Implementation ---

const getMockSession = () => {
  return safeParse(localStorage.getItem(STORAGE_KEY), null);
};

const authListeners: Array<(event: string, session: UserSession | null) => void> = [];

const mockAuth = {
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
            if (idx > -1) authListeners.splice(idx, 1);
          } 
        } 
      } 
    };
  },
  signInWithPassword: async ({ email }: { email: string }) => {
    const session = {
      user: { id: generateUUID(), email },
      access_token: 'mock-token-' + Date.now(),
      expires_in: 3600
    };
    trySaveToStorage(STORAGE_KEY, JSON.stringify(session));
    authListeners.forEach(cb => cb('SIGNED_IN', session));
    return { data: { session }, error: null };
  },
  signUp: async ({ email }: { email: string }) => {
    const session = {
      user: { id: generateUUID(), email },
      access_token: 'mock-token-' + Date.now(),
      expires_in: 3600
    };
    trySaveToStorage(STORAGE_KEY, JSON.stringify(session));
    authListeners.forEach(cb => cb('SIGNED_IN', session));
    return { data: { user: { email }, session }, error: null };
  },
  signOut: async () => {
    localStorage.removeItem(STORAGE_KEY);
    authListeners.forEach(cb => cb('SIGNED_OUT', null));
    return { error: null };
  }
};

const mockClient = {
  auth: mockAuth,
  from: () => ({
    select: () => ({ 
        order: () => Promise.resolve({ data: [], error: null }),
        eq: () => ({ single: () => Promise.resolve({ data: null, error: "Mock single not found" }) })
    }),
    insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
    update: () => ({ match: () => Promise.resolve({ data: [], error: null }) }),
    delete: () => ({ match: () => Promise.resolve({ data: [], error: null }) }),
  })
};

// --- Database Client Class ---

export class DatabaseClient implements IDatabaseClient {
  private activeClient: SupabaseClient | any = null;

  // Enhanced retry wrapper with exponential backoff and jitter
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error?.code === 'PGRST116' || error?.status === 404) {
          throw error; // Not found errors shouldn't be retried
        }
        
        if (attempt === RETRY_CONFIG.maxRetries) {
          console.error(`Operation ${operationName} failed after ${RETRY_CONFIG.maxRetries} retries:`, error);
          throw error;
        }
        
        // Enhanced exponential backoff with jitter
        let delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
        delay = Math.min(delay, RETRY_CONFIG.maxDelay);
        
        // Add jitter to prevent thundering herd
        if (RETRY_CONFIG.jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  async getClient(): Promise<SupabaseClient> {
    if (this.activeClient) return this.activeClient;

    const settings = settingsManager.getDBSettings();

    if (settings.mode === 'supabase' && settings.url && settings.anonKey) {
        try {
            // Use optimized connection pool with enhanced retry mechanism
            const client = await this.withRetry(async () => {
                return await edgeConnectionPool.getClient('default');
            }, 'getClient');
            this.activeClient = client;
        } catch (e) {
            console.error("Connection pool failed, using mock client", e);
            this.activeClient = mockClient;
        }
    } else {
        this.activeClient = mockClient;
    }
    return this.activeClient;
  }

  async checkConnection(): Promise<{ success: boolean; message: string; mode: string }> {
    try {
        const settings = settingsManager.getDBSettings();
        
        if (!settings.url || !settings.anonKey) {
            return {
                success: false,
                message: "Database settings incomplete. In offline mock mode. Configure database connection under Settings > Database or switch to demo for full features."
            }];
        }

        // Test connection with retry mechanism
        const client = await this.getClient();
        const { data, error } = await client.from('robots').select('count').limit(1);
        
        if (error) {
            return {
                success: false,
                message: `Connection failed: ${error.message || "Unknown error"}`
            };
        }

        return {
            success: true,
            message: "Connected to database."
        }];
    } catch (e) {
        return {
            success: false,
            message: `Connection check failed: ${e instanceof Error ? e.message : 'Unknown error'}`
        };
    }
  }

  async getStats(): Promise<{ count: number; storageType: string }> {
    const settings = settingsManager.getDBSettings();
    const storageType = settings.mode === 'supabase' ? "Supabase" : "Local";

    if (settings.mode !== 'supabase') {
        return {
            count: safeParse(localStorage.getItem('mock_robots'), []).length,
            storageType
        };
    }

    try {
        const client = await this.getClient();
        const { count, error } = await client.from('robots').select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error("Stats fetch error:", error);
            return { count: 0, storageType };
        }
        
        return { count: count || 0, storageType };
    } catch (e) {
        console.error("Stats fetch exception:", e);
        return { count: 0, storageType };
    }
  }

  async getSession(): Promise<any> {
    const client = await this.getClient();
    return client.auth.getSession();
  }

  async signIn(email: string): Promise<any> {
    const client = await this.getClient();
    return client.auth.signInWithPassword({ email });
  }

  async signOut(): Promise<void> {
    const client = await this.getClient();
    return client.auth.signOut();
  }

  async signUp(email: string): Promise<any> {
    const client = await this.getClient();
    return client.auth.signUp({ email });
  }

  onAuthStateChange(callback: Function): { data: { subscription: { unsubscribe: Function } } } {
    // Set up listener for database settings changes
    window.addEventListener('db-settings-changed', () => {
        this.activeClient = null;
        this.getClient(); 
    });

    const client promise = this.getClient();
    return client.then(c => c.auth.onAuthStateChange(callback));
  }
}

// Singleton instance
export const databaseClient = new DatabaseClient();

// Export proxy for backward compatibility
export const supabase = new Proxy({}, {
    get: (_target, prop) => {
        const client = databaseClient.getClient();
        return (client as any)[prop];
    }
}) as SupabaseClient;