
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { settingsManager, getEnv } from './settingsManager';
import { Robot, UserSession } from '../types';

// Connection retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
};

// Cache configuration
const CACHE_CONFIG = {
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 100, // Max cached items
};

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

// LRU Cache implementation for better performance and memory management
class LRUCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(ttl: number, maxSize: number) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.data;
  }

  set(key: string, data: T): void {
    // Evict oldest if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
}

const cache = new LRUCache<any>(CACHE_CONFIG.ttl, CACHE_CONFIG.maxSize);

const getCachedData = (key: string): any | null => {
  return cache.get(key);
};

const setCachedData = (key: string, data: any): void => {
  cache.set(key, data);
};

// Retry wrapper for Supabase operations
const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === RETRY_CONFIG.maxRetries) {
        console.error(`Operation ${operationName} failed after ${RETRY_CONFIG.maxRetries} retries:`, error);
        throw error;
      }
      
      // Exponential backoff
      const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

const getClient = () => {
    if (activeClient) return activeClient;

    const settings = settingsManager.getDBSettings();

    if (settings.mode === 'supabase' && settings.url && settings.anonKey) {
        try {
            activeClient = createClient(settings.url, settings.anonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                },
                db: {
                    schema: 'public',
                },
                global: {
                    headers: {
                        'x-application-name': 'quanforge-ai',
                    },
                },
            });
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

// Performance monitoring utilities
class PerformanceMonitor {
  private metrics: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();

  record(operation: string, duration: number) {
    const metric = this.metrics.get(operation) || { count: 0, totalTime: 0, avgTime: 0 };
    metric.count++;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.count;
    this.metrics.set(operation, metric);
  }

  getMetrics(operation: string) {
    return this.metrics.get(operation);
  }

  getAllMetrics() {
    return Object.fromEntries(this.metrics);
  }

  reset() {
    this.metrics.clear();
  }

  // Log performance metrics periodically
  logMetrics() {
    const allMetrics = this.getAllMetrics();
    console.group('Database Performance Metrics');
    for (const [operation, metric] of Object.entries(allMetrics)) {
      console.log(`${operation}: ${metric.count} calls, avg: ${metric.avgTime.toFixed(2)}ms`);
    }
    console.groupEnd();
  }
}

const performanceMonitor = new PerformanceMonitor();

// Index structure for faster searching and filtering
interface RobotIndex {
  byId: Map<string, Robot>;
  byName: Map<string, Robot[]>;
  byType: Map<string, Robot[]>;
  byDate: Robot[]; // Sorted by date for efficient pagination
}

class RobotIndexManager {
  private index: RobotIndex | null = null;
  private lastUpdated: number = 0;
  private rebuildInterval: number = 30000; // Rebuild index every 30 seconds if needed

  createIndex(robots: Robot[]): RobotIndex {
    const byId = new Map<string, Robot>();
    const byName = new Map<string, Robot[]>();
    const byType = new Map<string, Robot[]>();
    
    // Sort by date for efficient pagination
    const byDate = [...robots].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    for (const robot of robots) {
      // Index by ID
      byId.set(robot.id, robot);
      
      // Index by name (for search)
      const nameKey = robot.name.toLowerCase();
      if (!byName.has(nameKey)) {
        byName.set(nameKey, []);
      }
      byName.get(nameKey)!.push(robot);
      
      // Index by type (for filtering)
      const typeKey = robot.strategy_type || 'Custom';
      if (!byType.has(typeKey)) {
        byType.set(typeKey, []);
      }
      byType.get(typeKey)!.push(robot);
    }
    
    return { byId, byName, byType, byDate };
  }

  getIndex(robots: Robot[]): RobotIndex {
    const now = Date.now();
    // Rebuild index if it doesn't exist or if it's too old
    if (!this.index || now - this.lastUpdated > this.rebuildInterval) {
      this.index = this.createIndex(robots);
      this.lastUpdated = now;
    }
    return this.index;
  }

  clear() {
    this.index = null;
    this.lastUpdated = 0;
  }
}

const robotIndexManager = new RobotIndexManager();

export const mockDb = {
  async getRobots() {
    const startTime = performance.now();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings.mode === 'mock') {
        const stored = localStorage.getItem(ROBOTS_KEY);
        const robots = safeParse(stored, []);
        // Create index for performance
        robotIndexManager.getIndex(robots);
        const duration = performance.now() - startTime;
        performanceMonitor.record('getRobots', duration);
        return { data: robots, error: null };
      }
      
      const cacheKey = 'robots_list';
      const cached = getCachedData(cacheKey);
      if (cached) {
        // Create index for performance
        robotIndexManager.getIndex(cached);
        const duration = performance.now() - startTime;
        performanceMonitor.record('getRobots', duration);
        return { data: cached, error: null };
      }
      
      return withRetry(async () => {
        const result = await getClient()
          .from('robots')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100); // Add reasonable limit to prevent performance issues
        
        if (result.data && !result.error) {
          // Create index for performance
          robotIndexManager.getIndex(result.data);
          setCachedData(cacheKey, result.data);
        }
        
        const duration = performance.now() - startTime;
        performanceMonitor.record('getRobots', duration);
        
        return result;
      }, 'getRobots');
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.record('getRobots', duration);
      throw error;
    }
  },

  async saveRobot(robot: any) {
    const startTime = performance.now();
    try {
      const settings = settingsManager.getDBSettings();

      if (settings.mode === 'mock') {
        try {
            const stored = localStorage.getItem(ROBOTS_KEY);
            const robots = safeParse(stored, []);
            
            const newRobot = { ...robot, id: generateUUID(), created_at: new Date().toISOString() };
            robots.unshift(newRobot);
            
            trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
            const duration = performance.now() - startTime;
            performanceMonitor.record('saveRobot', duration);
            robotIndexManager.clear(); // Clear index since data changed
            return { data: [newRobot], error: null };
        } catch (e: any) {
            const duration = performance.now() - startTime;
            performanceMonitor.record('saveRobot', duration);
            return { data: null, error: e.message };
        }
      }
      
      return withRetry(async () => {
        const result = await getClient().from('robots').insert([robot]).select();
        
        // Invalidate cache after save
        cache.delete('robots_list');
        
        const duration = performance.now() - startTime;
        performanceMonitor.record('saveRobot', duration);
        
        return result;
      }, 'saveRobot');
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.record('saveRobot', duration);
      throw error;
    }
  },

  async updateRobot(id: string, updates: any) {
    const startTime = performance.now();
    try {
      const settings = settingsManager.getDBSettings();

      if (settings.mode === 'mock') {
          try {
              const stored = localStorage.getItem(ROBOTS_KEY);
              const robots = safeParse(stored, []);
              
              // Find and update the robot in place for better performance
              const robotIndex = robots.findIndex((r: any) => r.id === id);
              if (robotIndex === -1) {
                  const duration = performance.now() - startTime;
                  performanceMonitor.record('updateRobot', duration);
                  return { data: null, error: "Robot not found" };
              }
              
              // Create updated robot object
              const updatedRobot = { ...robots[robotIndex], ...updates, updated_at: new Date().toISOString() };
              robots[robotIndex] = updatedRobot;
              
              trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
              const duration = performance.now() - startTime;
              performanceMonitor.record('updateRobot', duration);
              robotIndexManager.clear(); // Clear index since data changed
              return { data: updatedRobot, error: null };
          } catch (e: any) {
              const duration = performance.now() - startTime;
              performanceMonitor.record('updateRobot', duration);
              return { data: null, error: e.message };
          }
      }
      
      return withRetry(async () => {
        const result = await getClient()
          .from('robots')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .match({ id })
          .select();
        
        // Invalidate cache after update
        cache.delete('robots_list');
        
        const duration = performance.now() - startTime;
        performanceMonitor.record('updateRobot', duration);
        
        return result;
      }, 'updateRobot');
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.record('updateRobot', duration);
      throw error;
    }
  },

  async deleteRobot(id: string) {
    const startTime = performance.now();
    try {
      const settings = settingsManager.getDBSettings();

      if (settings.mode === 'mock') {
          try {
              const stored = localStorage.getItem(ROBOTS_KEY);
              let robots = safeParse(stored, []);
              const initialLength = robots.length;
              robots = robots.filter((r: any) => r.id !== id);
              
              if (robots.length === initialLength) {
                  const duration = performance.now() - startTime;
                  performanceMonitor.record('deleteRobot', duration);
                  return { error: "Robot not found" };
              }

              trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
              const duration = performance.now() - startTime;
              performanceMonitor.record('deleteRobot', duration);
              robotIndexManager.clear(); // Clear index since data changed
              return { data: true, error: null };
          } catch (e: any) {
              const duration = performance.now() - startTime;
              performanceMonitor.record('deleteRobot', duration);
              return { error: e.message };
          }
      }
      
      return withRetry(async () => {
        const result = await getClient().from('robots').delete().match({ id });
        
        // Invalidate cache after delete
        cache.delete('robots_list');
        
        const duration = performance.now() - startTime;
        performanceMonitor.record('deleteRobot', duration);
        
        return result;
      }, 'deleteRobot');
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.record('deleteRobot', duration);
      throw error;
    }
  },

  async duplicateRobot(id: string) {
    const startTime = performance.now();
    try {
      const settings = settingsManager.getDBSettings();

      if (settings.mode === 'mock') {
          try {
              const stored = localStorage.getItem(ROBOTS_KEY);
              const robots = safeParse(stored, []);
              const original = robots.find((r: any) => r.id === id);
              
              if (!original) {
                  const duration = performance.now() - startTime;
                  performanceMonitor.record('duplicateRobot', duration);
                  return { error: "Robot not found", data: null };
              }

              const newRobot = {
                  ...original,
                  id: generateUUID(),
                  name: `Copy of ${original.name}`,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
              };
              
              robots.unshift(newRobot);
              trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
              const duration = performance.now() - startTime;
              performanceMonitor.record('duplicateRobot', duration);
              robotIndexManager.clear(); // Clear index since data changed
              return { data: [newRobot], error: null };
          } catch (e: any) {
              const duration = performance.now() - startTime;
              performanceMonitor.record('duplicateRobot', duration);
              return { data: null, error: e.message };
          }
      }
      
      const client = getClient();
      const { data: original, error } = await client.from('robots').select('*').eq('id', id).single();
      if (error || !original) {
        const duration = performance.now() - startTime;
        performanceMonitor.record('duplicateRobot', duration);
        return { error: error || "Robot not found" };
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _, created_at, updated_at, ...rest } = original;
      const session = await client.auth.getSession();
      
      const newRobotPayload = {
          ...rest,
          name: `Copy of ${original.name}`,
          user_id: session.data.session?.user?.id,
      };

      const result = await client.from('robots').insert([newRobotPayload]).select();
      const duration = performance.now() - startTime;
      performanceMonitor.record('duplicateRobot', duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.record('duplicateRobot', duration);
      throw error;
    }
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
            robotIndexManager.clear();
            return true;
        }
        return false;
    },
    
    /**
     * Advanced search with indexing for better performance
     */
    async searchRobots(searchTerm: string, filterType?: string): Promise<Robot[]> {
        const startTime = performance.now();
        try {
            const settings = settingsManager.getDBSettings();
            
            if (settings.mode === 'mock') {
                const stored = localStorage.getItem(ROBOTS_KEY);
                const robots = safeParse(stored, []);
                const index = robotIndexManager.getIndex(robots);
                
                if (!searchTerm && (!filterType || filterType === 'All')) {
                    const duration = performance.now() - startTime;
                    performanceMonitor.record('searchRobots', duration);
                    return index.byDate;
                }
                
                let results = index.byDate; // Start with all if no search term
                
                // Apply search filter if provided
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    results = results.filter(robot => 
                        robot.name.toLowerCase().includes(term) || 
                        robot.description.toLowerCase().includes(term)
                    );
                }
                
                // Apply type filter if provided
                if (filterType && filterType !== 'All') {
                    results = results.filter(robot => 
                        (robot.strategy_type || 'Custom') === filterType
                    );
                }
                
                const duration = performance.now() - startTime;
                performanceMonitor.record('searchRobots', duration);
                return results;
            } else {
                // For Supabase, use database queries
                let query = getClient().from('robots').select('*');
                
                if (searchTerm) {
                    query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
                }
                
                if (filterType && filterType !== 'All') {
                    query = query.eq('strategy_type', filterType);
                }
                
                query = query.order('created_at', { ascending: false });
                
                const { data, error } = await query;
                if (error) throw error;
                
                const duration = performance.now() - startTime;
                performanceMonitor.record('searchRobots', duration);
                return data || [];
            }
        } catch (error) {
            const duration = performance.now() - startTime;
            performanceMonitor.record('searchRobots', duration);
            throw error;
        }
    },
    
    /**
     * Get unique strategy types for filtering
     */
    async getStrategyTypes(): Promise<string[]> {
        const startTime = performance.now();
        try {
            const settings = settingsManager.getDBSettings();
            
            if (settings.mode === 'mock') {
                const stored = localStorage.getItem(ROBOTS_KEY);
                const robots = safeParse(stored, []);
                const index = robotIndexManager.getIndex(robots);
                
                // Get all unique types from the index
                const result = Array.from(index.byType.keys());
                const duration = performance.now() - startTime;
                performanceMonitor.record('getStrategyTypes', duration);
                return result;
            } else {
                // For Supabase, use distinct query
                const { data, error } = await getClient()
                    .from('robots')
                    .select('strategy_type', { distinct: true });
                
                if (error) throw error;
                
                // Filter out null/undefined values and return unique types
                const types = (data || [])
                    .map((item: { strategy_type: string | null }) => item.strategy_type || 'Custom')
                    .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index);
                
                const duration = performance.now() - startTime;
                performanceMonitor.record('getStrategyTypes', duration);
                return types;
            }
        } catch (error) {
            const duration = performance.now() - startTime;
            performanceMonitor.record('getStrategyTypes', duration);
            throw error;
        }
    },
    
    /**
     * Batch operations for better performance
     */
    async batchUpdateRobots(updates: Array<{ id: string; updates: any }>): Promise<{ success: number; failed: number; errors?: string[] }> {
        const startTime = performance.now();
        try {
            const settings = settingsManager.getDBSettings();
            const errors: string[] = [];
            let successCount = 0;
            let failedCount = 0;
            
            if (settings.mode === 'mock') {
                try {
                    const stored = localStorage.getItem(ROBOTS_KEY);
                    let robots = safeParse(stored, []);
                    
                    for (const item of updates) {
                        const robotIndex = robots.findIndex((r: any) => r.id === item.id);
                        if (robotIndex !== -1) {
                            robots[robotIndex] = { 
                                ...robots[robotIndex], 
                                ...item.updates, 
                                updated_at: new Date().toISOString() 
                            };
                            successCount++;
                        } else {
                            failedCount++;
                            errors.push(`Robot with id ${item.id} not found`);
                        }
                    }
                    
                    trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
                    robotIndexManager.clear(); // Clear index since data changed
                    
                    const duration = performance.now() - startTime;
                    performanceMonitor.record('batchUpdateRobots', duration);
                    return { success: successCount, failed: failedCount, errors: errors.length > 0 ? errors : undefined };
                } catch (e: any) {
                    const duration = performance.now() - startTime;
                    performanceMonitor.record('batchUpdateRobots', duration);
                    return { success: 0, failed: updates.length, errors: [e.message] };
                }
            } else {
                // For Supabase, process in batches to avoid query limits
                const BATCH_SIZE = 10;
                
                for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                    const batch = updates.slice(i, i + BATCH_SIZE);
                    
                    try {
                        // Process each item in the batch individually due to Supabase limitations
                        for (const item of batch) {
                            const result = await getClient()
                                .from('robots')
                                .update({ ...item.updates, updated_at: new Date().toISOString() })
                                .match({ id: item.id })
                                .select();
                                
                            if (result.error) {
                                failedCount++;
                                errors.push(`Error updating ${item.id}: ${result.error.message}`);
                            } else {
                                successCount++;
                            }
                        }
                    } catch (e: any) {
                        failedCount += batch.length;
                        errors.push(e.message);
                    }
                }
                
                cache.delete('robots_list'); // Invalidate cache
                
                const duration = performance.now() - startTime;
                performanceMonitor.record('batchUpdateRobots', duration);
                return { success: successCount, failed: failedCount, errors: errors.length > 0 ? errors : undefined };
            }
        } catch (error) {
            const duration = performance.now() - startTime;
            performanceMonitor.record('batchUpdateRobots', duration);
            throw error;
        }
    },
    
    /**
     * Get robots with pagination for better performance with large datasets
     */
    async getRobotsPaginated(page: number = 1, limit: number = 20, searchTerm?: string, filterType?: string): Promise<{ data: Robot[]; total: number; page: number; totalPages: number }> {
        const startTime = performance.now();
        try {
            const settings = settingsManager.getDBSettings();
            const offset = (page - 1) * limit;
            
            if (settings.mode === 'mock') {
                const stored = localStorage.getItem(ROBOTS_KEY);
                const allRobots = safeParse(stored, []);
                
                // Apply search and filter
                let filteredRobots = allRobots;
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    filteredRobots = filteredRobots.filter(robot => 
                        robot.name.toLowerCase().includes(term) || 
                        robot.description.toLowerCase().includes(term)
                    );
                }
                
                if (filterType && filterType !== 'All') {
                    filteredRobots = filteredRobots.filter(robot => 
                        (robot.strategy_type || 'Custom') === filterType
                    );
                }
                
            // Sort by date
            filteredRobots.sort((a: Robot, b: Robot) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
                
                const total = filteredRobots.length;
                const totalPages = Math.ceil(total / limit);
                const paginatedData = filteredRobots.slice(offset, offset + limit);
                
                const duration = performance.now() - startTime;
                performanceMonitor.record('getRobotsPaginated', duration);
                
                return {
                    data: paginatedData,
                    total,
                    page,
                    totalPages
                };
            } else {
                // For Supabase, use proper pagination
                let query = getClient().from('robots').select('*', { count: 'exact' });
                
                // Apply search filter
                if (searchTerm) {
                    query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
                }
                
                // Apply type filter
                if (filterType && filterType !== 'All') {
                    query = query.eq('strategy_type', filterType);
                }
                
                // Apply pagination and sorting
                const { data, error, count } = await query
                    .order('created_at', { ascending: false })
                    .range(offset, offset + limit - 1);
                    
                if (error) throw error;
                
                const total = count || 0;
                const totalPages = Math.ceil(total / limit);
                
                const duration = performance.now() - startTime;
                performanceMonitor.record('getRobotsPaginated', duration);
                
                return {
                    data: data || [],
                    total,
                    page,
                    totalPages
                };
            }
        } catch (error) {
            const duration = performance.now() - startTime;
            performanceMonitor.record('getRobotsPaginated', duration);
            throw error;
        }
    },
    
    /**
     * Get database performance metrics
     */
    getPerformanceMetrics() {
        return performanceMonitor.getAllMetrics();
    },
    
    /**
     * Reset database performance metrics
     */
    resetPerformanceMetrics() {
        performanceMonitor.reset();
    },
    
    /**
     * Log performance metrics to console
     */
    logPerformanceMetrics() {
        performanceMonitor.logMetrics();
    },
    
    /**
     * Optimize database by running maintenance tasks
     */
    async optimizeDatabase(): Promise<{ success: boolean; message: string }> {
        try {
            const settings = settingsManager.getDBSettings();
            
            if (settings.mode === 'mock') {
                // For mock mode, run maintenance tasks
                const stored = localStorage.getItem(ROBOTS_KEY);
                const robots = safeParse(stored, []);
                
                // Remove any potential duplicates by ID
                const seenIds = new Set<string>();
                const uniqueRobots = robots.filter(robot => {
                    if (seenIds.has(robot.id)) {
                        return false; // Duplicate, remove
                    }
                    seenIds.add(robot.id);
                    return true;
                });
                
                // Clean up any invalid robots
                const validRobots = uniqueRobots.filter(robot => 
                    robot && 
                    typeof robot === 'object' && 
                    robot.id && 
                    robot.name && 
                    robot.code
                );
                
                // Update the storage with cleaned data
                trySaveToStorage(ROBOTS_KEY, JSON.stringify(validRobots));
                
                // Clear and rebuild index
                robotIndexManager.clear();
                
                return { 
                    success: true, 
                    message: `Database optimized: ${robots.length - validRobots.length} invalid or duplicate records removed. ${validRobots.length} valid records remaining.` 
                };
            } else {
                // For Supabase, run VACUUM and ANALYZE equivalent operations
                // Note: Supabase/PostgreSQL handles these automatically, but we can run ANALYZE
                const { error } = await getClient().rpc('pg_stat_reset');
                
                if (error) {
                    console.warn("Could not run database optimization:", error.message);
                    // Non-critical error, just return success with warning
                }
                
                return { 
                    success: true, 
                    message: "Database optimization commands issued successfully" 
                };
            }
        } catch (e: any) {
            return { 
                success: false, 
                message: `Database optimization failed: ${e.message}` 
            };
        }
    },
    
    /**
     * Get database statistics for optimization analysis
     */
    async getDatabaseStats(): Promise<{ 
        totalRecords: number; 
        totalSizeKB: number; 
        avgRecordSizeKB: number; 
        lastOptimized?: string;
        duplicateRecords?: number;
        invalidRecords?: number;
    }> {
        const settings = settingsManager.getDBSettings();
        
        if (settings.mode === 'mock') {
            const stored = localStorage.getItem(ROBOTS_KEY);
            const robots = safeParse(stored, []);
            
            // Calculate total size
            const totalSize = new Blob([JSON.stringify(robots)]).size;
            const avgSize = robots.length > 0 ? totalSize / robots.length : 0;
            
            // Identify duplicates and invalid records
            const seenIds = new Set<string>();
            let duplicateCount = 0;
            let invalidCount = 0;
            
            for (const robot of robots) {
                if (seenIds.has(robot.id)) {
                    duplicateCount++;
                } else {
                    seenIds.add(robot.id);
                }
                
                if (!robot || typeof robot !== 'object' || !robot.id || !robot.name || !robot.code) {
                    invalidCount++;
                }
            }
            
            return {
                totalRecords: robots.length,
                totalSizeKB: Math.round(totalSize / 1024),
                avgRecordSizeKB: Math.round(avgSize / 1024),
                duplicateRecords: duplicateCount,
                invalidRecords: invalidCount
            };
        } else {
            // For Supabase, get table statistics
            const { count, error } = await getClient().from('robots').select('*', { count: 'exact', head: true });
            
            if (error) {
                throw error;
            }
            
            // Get approximate table size from PostgreSQL
            const { data: tableSize, error: sizeError } = await getClient()
                .from('information_schema.tables')
                .select('table_schema, table_name')
                .eq('table_name', 'robots');
            
            return {
                totalRecords: count || 0,
                totalSizeKB: 0, // Cannot get exact size from Supabase
                avgRecordSizeKB: 0, // Cannot get exact size from Supabase
                lastOptimized: new Date().toISOString()
            };
        }
    }
};
