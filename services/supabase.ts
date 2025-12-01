
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { settingsManager, getEnv } from './settingsManager';
import { Robot, UserSession } from '../types';

// Mock session storage
const STORAGE_KEY = 'mock_session';
const ROBOTS_KEY = 'mock_robots';

// Helper for safe JSON parsing
const safeParse = (data: string | null, fallback: any) => {
    if (!data) return fallback;
    try {
        const parsed = JSON.parse(data);
        // Security: Prevent prototype pollution
        if (parsed && typeof parsed === 'object' && ('__proto__' in parsed || 'constructor' in parsed)) {
             return fallback;
        }
        return parsed;
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
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const isValidRobot = (r: any): boolean => {
    return (
        typeof r === 'object' &&
        r !== null &&
        typeof r.name === 'string' &&
        typeof r.code === 'string'
    );
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

// --- Dynamic Client Manager ---

let activeClient: SupabaseClient | any = null;

const getClient = () => {
    if (activeClient) return activeClient;

    const settings = settingsManager.getDBSettings();

    if (settings.mode === 'supabase' && settings.url && settings.anonKey) {
        try {
            activeClient = createClient(settings.url, settings.anonKey);
        } catch (e) {
            console.error("Invalid Supabase Config, falling back to mock", e);
            activeClient = mockClient;
        }
    } else {
        activeClient = mockClient;
    }
    return activeClient;
};

window.addEventListener('db-settings-changed', () => {
    activeClient = null;
    getClient(); 
});

export const supabase = new Proxy({}, {
    get: (target, prop) => {
        const client = getClient();
        return client[prop];
    }
}) as SupabaseClient;


// --- Database Operations Wrapper ---

export const mockDb = {
  async getRobots() {
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode === 'mock') {
      const stored = localStorage.getItem(ROBOTS_KEY);
      return { data: safeParse(stored, []), error: null };
    }
    return getClient().from('robots').select('*').order('created_at', { ascending: false });
  },

  async saveRobot(robot: any) {
    const settings = settingsManager.getDBSettings();

    if (settings.mode === 'mock') {
      try {
          const stored = localStorage.getItem(ROBOTS_KEY);
          const robots = safeParse(stored, []);
          
          const newRobot = { ...robot, id: generateUUID(), created_at: new Date().toISOString() };
          robots.unshift(newRobot);
          
          trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
          return { data: [newRobot], error: null };
      } catch (e: any) {
          return { data: null, error: e.message };
      }
    }
    return getClient().from('robots').insert([robot]).select();
  },

  async updateRobot(id: string, updates: any) {
    const settings = settingsManager.getDBSettings();

    if (settings.mode === 'mock') {
        try {
            const stored = localStorage.getItem(ROBOTS_KEY);
            let robots = safeParse(stored, []);
            robots = robots.map((r: any) => r.id === id ? { ...r, ...updates } : r);
            trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
            return { data: robots.find((r:any) => r.id === id), error: null };
        } catch (e: any) {
            return { data: null, error: e.message };
        }
    }
    return getClient().from('robots').update(updates).match({ id });
  },

  async deleteRobot(id: string) {
    const settings = settingsManager.getDBSettings();

    if (settings.mode === 'mock') {
        try {
            const stored = localStorage.getItem(ROBOTS_KEY);
            let robots = safeParse(stored, []);
            const initialLength = robots.length;
            robots = robots.filter((r: any) => r.id !== id);
            
            if (robots.length === initialLength) {
                return { error: "Robot not found" };
            }

            trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
            return { data: true, error: null };
        } catch (e: any) {
            return { error: e.message };
        }
    }
    return getClient().from('robots').delete().match({ id });
  },

  async duplicateRobot(id: string) {
    const settings = settingsManager.getDBSettings();

    if (settings.mode === 'mock') {
        try {
            const stored = localStorage.getItem(ROBOTS_KEY);
            const robots = safeParse(stored, []);
            const original = robots.find((r: any) => r.id === id);
            
            if (!original) return { error: "Robot not found", data: null };

            const newRobot = {
                ...original,
                id: generateUUID(),
                name: `Copy of ${original.name}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            robots.unshift(newRobot);
            trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
            return { data: [newRobot], error: null };
        } catch (e: any) {
            return { data: null, error: e.message };
        }
    }
    
    const client = getClient();
    const { data: original, error } = await client.from('robots').select('*').eq('id', id).single();
    if (error || !original) return { error: error || "Robot not found" };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, created_at, updated_at, ...rest } = original;
    const session = await client.auth.getSession();
    
    const newRobotPayload = {
        ...rest,
        name: `Copy of ${original.name}`,
        user_id: session.data.session?.user?.id,
    };

    return client.from('robots').insert([newRobotPayload]).select();
  }
};

// --- Database Utilities ---

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
            const { count, error } = await getClient().from('robots').select('*', { count: 'exact', head: true });
            
            if (error) throw error;
            return { success: true, message: `Connected to Supabase. Found ${count} records.`, mode: 'supabase' };
        } catch (e: any) {
            return { success: false, message: `Connection Failed: ${e.message || e}`, mode: 'supabase' };
        }
    },

    async getStats(): Promise<{ count: number; storageType: string }> {
        const settings = settingsManager.getDBSettings();
        if (settings.mode === 'mock') {
            const stored = localStorage.getItem(ROBOTS_KEY);
            const robots = safeParse(stored, []);
            return { count: robots.length, storageType: 'Browser Local Storage' };
        } else {
            const { count } = await getClient().from('robots').select('*', { count: 'exact', head: true });
            return { count: count || 0, storageType: 'Supabase Cloud DB' };
        }
    },

    async exportDatabase(): Promise<string> {
        const settings = settingsManager.getDBSettings();
        let robots = [];

        if (settings.mode === 'mock') {
            const stored = localStorage.getItem(ROBOTS_KEY);
            robots = safeParse(stored, []);
        } else {
            const { data, error } = await getClient().from('robots').select('*');
            if (error) throw error;
            robots = data;
        }

        const exportObj = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            source: settings.mode,
            robots: robots
        };

        return JSON.stringify(exportObj, null, 2);
    },

    async importDatabase(jsonString: string, merge: boolean = true): Promise<{ success: boolean; count: number; error?: string }> {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed.robots || !Array.isArray(parsed.robots)) {
                throw new Error("Invalid format: 'robots' array missing.");
            }

            const validRobots = parsed.robots.filter(isValidRobot).map((r: Robot) => ({
                ...r,
                strategy_type: r.strategy_type || 'Custom',
                name: r.name || 'Untitled Robot',
                code: r.code || '// No code'
            }));
            
            const skippedCount = parsed.robots.length - validRobots.length;

            if (validRobots.length === 0 && parsed.robots.length > 0) {
                 throw new Error("No valid robot data found in import file.");
            }

            const settings = settingsManager.getDBSettings();

            if (settings.mode === 'mock') {
                const stored = localStorage.getItem(ROBOTS_KEY);
                const currentRobots = merge ? safeParse(stored, []) : [];
                
                const newRobots = validRobots.map((r: Robot) => ({
                    ...r,
                    id: generateUUID()
                }));

                const finalRobots = [...newRobots, ...currentRobots]; 
                
                trySaveToStorage(ROBOTS_KEY, JSON.stringify(finalRobots));
                
                return { 
                    success: true, 
                    count: newRobots.length, 
                    error: skippedCount > 0 ? `Skipped ${skippedCount} invalid records.` : undefined 
                };
            } else {
                const client = getClient();
                const { data: sessionData } = await client.auth.getSession();
                const userId = sessionData.session?.user?.id;

                if (!userId) {
                    throw new Error("Authentication required: You must be signed in to import data to Supabase.");
                }

                const payload = validRobots.map((r: Robot) => {
                     // eslint-disable-next-line @typescript-eslint/no-unused-vars
                     const { id, created_at, updated_at, ...rest } = r;
                     return { ...rest, user_id: userId };
                });

                const { error } = await client.from('robots').insert(payload);
                if (error) throw error;
                
                return { 
                    success: true, 
                    count: payload.length,
                    error: skippedCount > 0 ? `Skipped ${skippedCount} invalid records.` : undefined 
                };
            }

        } catch (e: any) {
            return { success: false, count: 0, error: e.message };
        }
    },

    /**
     * Migration Utility: Moves data from LocalStorage Mock to Supabase Cloud.
     * Uses batch processing to avoid payload limits.
     * With Fault Tolerance: If one batch fails, try to continue.
     */
    async migrateMockToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
        const stored = localStorage.getItem(ROBOTS_KEY);
        const localRobots = safeParse(stored, []);
        
        if (localRobots.length === 0) {
            return { success: false, count: 0, error: "No local robots found to migrate." };
        }

        const client = getClient();
        const { data: sessionData } = await client.auth.getSession();
        const userId = sessionData.session?.user?.id;

        if (!userId) {
            return { success: false, count: 0, error: "You must be signed in to Supabase to migrate data." };
        }

        let successCount = 0;
        let failCount = 0;
        let lastError = "";

        try {
            const payload = localRobots.filter(isValidRobot).map((r: Robot) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, created_at, updated_at, ...rest } = r;
                return { 
                    ...rest,
                    strategy_type: r.strategy_type || 'Custom',
                    user_id: userId 
                };
            });

            if (payload.length === 0) return { success: false, count: 0, error: "Local data invalid." };

            const BATCH_SIZE = 10;
            for (let i = 0; i < payload.length; i += BATCH_SIZE) {
                const chunk = payload.slice(i, i + BATCH_SIZE);
                const { error } = await client.from('robots').insert(chunk);
                if (error) {
                    console.error("Batch migration failed", error);
                    failCount += chunk.length;
                    lastError = error.message;
                } else {
                    successCount += chunk.length;
                }
            }

            if (successCount === 0 && failCount > 0) {
                return { success: false, count: 0, error: lastError };
            }

            return { success: true, count: successCount, error: failCount > 0 ? `Migrated ${successCount}, Failed ${failCount}. Last error: ${lastError}` : undefined };
        } catch (e: any) {
            return { success: false, count: 0, error: e.message };
        }
    },
    
    async clearDatabase(): Promise<boolean> {
        const settings = settingsManager.getDBSettings();
        if (settings.mode === 'mock') {
            trySaveToStorage(ROBOTS_KEY, '[]');
            return true;
        }
        return false;
    }
};
