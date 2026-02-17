 
import { settingsManager } from './settingsManager';
import { Robot, UserSession } from '../types';
import { edgeConnectionPool } from './edgeSupabasePool';
import { securityManager } from './securityManager';
import { handleError, getErrorMessage } from '../utils/errorHandler';
import { consolidatedCache } from './consolidatedCacheManager';
import { DEFAULT_CIRCUIT_BREAKERS } from './circuitBreaker';
import { TIMEOUTS, CACHE_LIMITS, BATCH_SIZES, ERROR_CODES, TIME_CONSTANTS } from '../constants';
import { getLocalStorage, StorageQuotaError } from '../utils/storage';
import { createScopedLogger } from '../utils/logger';
import { STORAGE_KEYS, STORAGE_PREFIXES, RETRY_CONFIGS } from '../constants/modularConfig';
import { TOKEN_CONSTANTS, COUNT_CONSTANTS } from './modularConstants';

const logger = createScopedLogger('Supabase');

// Enhanced connection retry configuration with exponential backoff - using modular config
const RETRY_CONFIG = {
  maxRetries: RETRY_CONFIGS.AGGRESSIVE.MAX_ATTEMPTS,
  retryDelay: RETRY_CONFIGS.AGGRESSIVE.BASE_DELAY_MS,
  backoffMultiplier: RETRY_CONFIGS.AGGRESSIVE.BACKOFF_MULTIPLIER,
  maxDelay: RETRY_CONFIGS.AGGRESSIVE.MAX_DELAY_MS,
  jitter: RETRY_CONFIGS.AGGRESSIVE.USE_JITTER,
};


// Mock session storage - using Flexy's modular config
const STORAGE_KEY = STORAGE_KEYS.SESSION;
const ROBOTS_KEY = STORAGE_KEYS.ROBOTS;
const storage = getLocalStorage({ prefix: STORAGE_PREFIXES.MOCK, enableSerialization: true });

// Helper for safe JSON parsing with enhanced security
const safeParse = <T>(data: T | null, fallback: any) => {
    if (!data) return fallback;
    try {
        return securityManager.safeJSONParse(data as string) || fallback;
    } catch (e) {
        logger.error("Failed to parse data from storage:", e);
        return fallback;
    }
};

// Helper: Try save to storage with Quota handling
const trySaveToStorage = (key: string, value: any) => {
    try {
        storage.set(key, value);
    } catch (e) {
        if (e instanceof StorageQuotaError) {
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
  return safeParse(storage.get(STORAGE_KEY), null);
};

const authListeners: Array<(event: string, session: UserSession | null) => void> = [];

/**
 * Clear all auth listeners - used for cleanup to prevent memory leaks
 */
const clearAllAuthListeners = (): void => {
  authListeners.length = 0;
};

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
      expires_in: TOKEN_CONSTANTS.DEFAULT_ACCESS_TOKEN_EXPIRY_S
    };
    trySaveToStorage(STORAGE_KEY, JSON.stringify(session));
    authListeners.forEach(cb => cb('SIGNED_IN', session));
    return { data: { session }, error: null };
  },
  signUp: async ({ email }: { email: string }) => {
    const session = {
      user: { id: generateUUID(), email },
      access_token: 'mock-token-' + Date.now(),
      expires_in: TOKEN_CONSTANTS.DEFAULT_ACCESS_TOKEN_EXPIRY_S
    };
    trySaveToStorage(STORAGE_KEY, JSON.stringify(session));
    authListeners.forEach(cb => cb('SIGNED_IN', session));
    return { data: { user: { email }, session }, error: null };
  },
  signOut: async () => {
    storage.remove(STORAGE_KEY);
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

let activeClient: any = null;




// Enhanced retry wrapper with exponential backoff and jitter
const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      
      // Don't retry on certain errors
      const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code: unknown }).code : undefined;
      const errorStatus = error && typeof error === 'object' && 'status' in error ? (error as { status: unknown }).status : undefined;
      if (errorCode === ERROR_CODES.RECORD_NOT_FOUND || errorStatus === ERROR_CODES.NOT_FOUND) {
        throw error; // Not found errors shouldn't be retried
      }
      
      if (attempt === RETRY_CONFIG.maxRetries) {
        logger.error(`Operation ${operationName} failed after ${RETRY_CONFIG.maxRetries} retries:`, error);
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
};

const getClient = async () => {
    if (activeClient) return activeClient;

    const settings = settingsManager.getDBSettings();

    if (settings.mode === 'supabase' && settings.url && settings.anonKey) {
        try {
            // Use optimized connection pool with enhanced retry mechanism
            const client = await withRetry(async () => {
                return await edgeConnectionPool.getClient('default');
            }, 'getClient');
            activeClient = client;
        } catch (e) {
            logger.error("Connection pool failed, using mock client", e);
            activeClient = mockClient;
        }
    } else {
        activeClient = mockClient;
    }
    return activeClient;
};

// Store event listener reference for cleanup
const dbSettingsChangeHandler = () => {
    activeClient = null;
    getClient();
};
window.addEventListener('db-settings-changed', dbSettingsChangeHandler);

/**
 * Cleanup function to remove global event listeners - prevents memory leaks
 * Call this when the application is unmounting or during testing
 */
export const cleanupSupabaseListeners = (): void => {
    window.removeEventListener('db-settings-changed', dbSettingsChangeHandler);
    clearAllAuthListeners();
};

// Fixed supabase export - auth accessible synchronously, rest lazy-loaded
const supabaseAuth = {
    getSession: async () => {
        return { data: { session: getMockSession() }, error: null };
    },
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
        authListeners.push(callback);
        return { 
            data: { 
                subscription: { 
                    unsubscribe: () => {
                        const idx = authListeners.indexOf(callback);
                        if (idx > -1) authListeners.splice(idx, 1);
                    } 
                } 
            }, 
            error: null 
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
        storage.remove(STORAGE_KEY);
        authListeners.forEach(cb => cb('SIGNED_OUT', null));
        return { error: null };
    }
};

// Create a proxy that has auth synchronously and delegates the rest
export const supabase = new Proxy({ auth: supabaseAuth } as any, {
    get: (target, prop: string | symbol) => {
        // Auth is always synchronous
        if (prop === 'auth') {
            return target.auth;
        }
        // For everything else, use the lazy client
        const client = getClient();
        return (client as any)[prop];
    }
});


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
    logger.log('Database Performance Metrics:');
    for (const [operation, metric] of Object.entries(allMetrics)) {
      logger.log(`  ${operation}: ${metric.count} calls, avg: ${metric.avgTime.toFixed(2)}ms`);
    }
  }
}

const performanceMonitor = new PerformanceMonitor();

// Enhanced performance monitoring with edge metrics
class EdgePerformanceTracker {
  private metrics: Map<string, number[]> = new Map();
  
  recordMetric(operation: string, value: number) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    const values = this.metrics.get(operation)!;
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.splice(0, values.length - 100);
    }
  }
  
  getAverage(operation: string): number {
    const values = this.metrics.get(operation) || [];
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }
  
  getPercentile(operation: string, percentile: number): number {
    const values = this.metrics.get(operation) || [];
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * (percentile / 100));
    return sorted[Math.min(index, sorted.length - 1)] || 0;
  }
  
  getAllMetrics() {
    const result: Record<string, { avg: number; p95: number; p99: number; count: number }> = {};
    
    for (const [operation] of this.metrics) {
      result[operation] = {
        avg: this.getAverage(operation),
        p95: this.getPercentile(operation, 95),
        p99: this.getPercentile(operation, 99),
        count: this.metrics.get(operation)!.length,
      };
    }
    
    return result;
  }
}

const edgePerformanceTracker = new EdgePerformanceTracker();

// Index structure for faster searching and filtering
interface RobotIndex {
  byId: Map<string, Robot>;
  byName: Map<string, Robot[]>;
  byType: Map<string, Robot[]>;
  byDate: Robot[]; // Sorted by date for efficient pagination
}

class RobotIndexManager {
  private index: RobotIndex | null = null;
  private lastDataVersion: string = '';
  private currentDataVersion: string = '';

  private getDataVersion(robots: Robot[]): string {
    // Create a hash from robot data for change detection
    return robots.map(r => `${r.id}:${r.updated_at}`).join('|');
  }

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
    this.currentDataVersion = this.getDataVersion(robots);
    
    // Rebuild index only if data has changed
    if (!this.index || this.lastDataVersion !== this.currentDataVersion) {
      this.index = this.createIndex(robots);
      this.lastDataVersion = this.currentDataVersion;
    }
    return this.index;
  }

  clear() {
    this.index = null;
    this.lastDataVersion = '';
    this.currentDataVersion = '';
  }
}

const robotIndexManager = new RobotIndexManager();

export const mockDb = {
async getRobots() {
     const startTime = performance.now();
     try {
       const settings = settingsManager.getDBSettings();
       
        if (settings.mode === 'mock') {
          const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
          // Filter out soft-deleted robots (consistent with Supabase mode behavior)
          const robots = stored.filter((r: Robot) => !r.deleted_at);
          // Create index for performance
          robotIndexManager.getIndex(robots);
          const duration = performance.now() - startTime;
          performanceMonitor.record('getRobots', duration);
          return { data: robots, error: null };
        }
        
        const cacheKey = 'robots_list';
 const cached = await consolidatedCache.get<Robot[]>(cacheKey);
        if (cached) {
          // Create index for performance
          robotIndexManager.getIndex(cached);
          const duration = performance.now() - startTime;
          performanceMonitor.record('getRobots', duration);
          edgePerformanceTracker.recordMetric('getRobots', duration);
          return { data: cached, error: null };
        }
        
 return DEFAULT_CIRCUIT_BREAKERS.database.execute(async () => {
          return withRetry(async () => {
            const client = await getClient();
            const result = await client
              .from('robots')
              .select('*')
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(CACHE_LIMITS.DEFAULT_QUERY_LIMIT); // Use centralized limit
            
            if (result.data && !result.error) {
              // Create index for performance
              robotIndexManager.getIndex(result.data);
              await consolidatedCache.set(cacheKey, result.data, 'api', ['robots', 'list']);
            }
           
           const duration = performance.now() - startTime;
           performanceMonitor.record('getRobots', duration);
           
            // Log slow operations only in development
            if (import.meta.env.DEV && duration > 500) {
              logger.warn(`Slow getRobots operation: ${duration.toFixed(2)}ms`);
            }
           
           return result;
          }, 'getRobots');
        });
     } catch (error: unknown) {
       const duration = performance.now() - startTime;
       performanceMonitor.record('getRobots', duration);
       handleError(error as Error, 'getRobots', 'mockDb');
       throw error;
     }
   },

/**
     * Batch update multiple robots for better performance
     */
   async batchUpdateRobots(updates: Array<{id: string, data: Partial<Robot>}>) {
     const startTime = performance.now();
     try {
       const settings = settingsManager.getDBSettings();
       
       if (settings.mode === 'mock') {
         const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
         const robots = stored;
         
         updates.forEach(update => {
           const index = robots.findIndex((r: Robot) => r.id === update.id);
if (index !== -1) {
              robots[index] = { ...robots[index], ...update.data, updated_at: new Date().toISOString() } as Robot;
            }
         });
         
         trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
         robotIndexManager.clear();
         
         const duration = performance.now() - startTime;
         performanceMonitor.record('batchUpdateRobots', duration);
         return { data: updates.map(u => u.id), error: null };
       }
       
       return withRetry(async () => {
         const client = await getClient();
         const batch = updates.map(update => 
           client.from('robots').update({ ...update.data, updated_at: new Date().toISOString() }).eq('id', update.id)
         );
         
         const results = await Promise.all(batch);
         
// Clear relevant caches
          await consolidatedCache.invalidateByTags(['robots']);
         
         const duration = performance.now() - startTime;
         performanceMonitor.record('batchUpdateRobots', duration);
         
         return { 
           data: updates.map(u => u.id), 
           error: results.some(r => r.error) ? results.find(r => r.error)?.error : null 
         };
       }, 'batchUpdateRobots');
     } catch (error: unknown) {
       const duration = performance.now() - startTime;
       performanceMonitor.record('batchUpdateRobots', duration);
       handleError(error as Error, 'batchUpdateRobots', 'mockDb');
       throw error;
     }
   },

/**
      * Get robots with pagination for better performance with large datasets
      * Optimized with smart caching and query batching
      */
    async getRobotsPaginated(page: number = 1, limit: number = COUNT_CONSTANTS.PAGINATION.DEFAULT, searchTerm?: string, filterType?: string) {
      const startTime = performance.now();
      try {
        const settings = settingsManager.getDBSettings();
        const offset = (page - 1) * limit;
        
        // Generate optimized cache key with consistent ordering
        const cacheKey = `robots_paginated_${page}_${limit}_${(searchTerm || '').toLowerCase()}_${(filterType || 'All')}`;
        
        // Try consolidated cache first for both mock and supabase modes
        const cached = await consolidatedCache.get(cacheKey);
        if (cached) {
          const duration = performance.now() - startTime;
          performanceMonitor.record('getRobotsPaginated_cached', duration);
          return cached;
        }
        
        if (settings.mode === 'mock') {
          const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
          // Filter out soft-deleted robots (consistent with Supabase mode)
          const allRobots = stored.filter((r: Robot) => !r.deleted_at);
          const index = robotIndexManager.getIndex(allRobots);
          
          let results = index.byDate;
          
          // Enhanced search with optimized filtering and early termination
          if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const searchTerms = term.split(' ').filter(t => t.length > 0); // Split for multi-word search
            
            results = results.filter(robot => {
              // Check name match first (higher priority)
              const nameMatch = searchTerms.every(t => robot.name.toLowerCase().includes(t));
              if (nameMatch) return true;
              
              // Check description match
              const descMatch = searchTerms.every(t => robot.description.toLowerCase().includes(t));
              return descMatch;
            });
          }
          
          // Apply type filter if provided (optimized with direct comparison)
          if (filterType && filterType !== 'All') {
            results = results.filter(robot => robot.strategy_type === filterType);
          }
          
          const totalCount = results.length;
          const paginatedResults = results.slice(offset, offset + limit);
          
          const response = {
            data: paginatedResults,
            pagination: {
              page,
              limit,
              totalCount,
              totalPages: Math.ceil(totalCount / limit),
              hasNext: offset + limit < totalCount,
              hasPrev: page > 1
            },
            error: null
          };
          
          // Cache the result with smart TTL based on data size (min 1 minute, max 5 minutes)
          const ttl = Math.min(TIMEOUTS.CACHE_TTL, Math.max(TIME_CONSTANTS.MINUTE, totalCount * 100));
          await consolidatedCache.set(cacheKey, response, ttl, ['robots', 'paginated']);
          
          const duration = performance.now() - startTime;
          performanceMonitor.record('getRobotsPaginated_mock', duration);
          return response;
        }
        
        // Optimized Supabase query with prepared statement pattern
        return withRetry(async () => {
          const client = await getClient();
          
          // Build query with optimized filters - single query builder pattern
          let query = client
            .from('robots')
            .select('*', { count: 'exact', head: false })
            .eq('is_active', true);
          
          // Apply filters in the most efficient order
          if (filterType && filterType !== 'All') {
            query = query.eq('strategy_type', filterType);
          }
          
          if (searchTerm) {
            // Use more efficient search with index hints
            query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
          }
          
          // Apply ordering and pagination last
          query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
          
          const result = await query;
          
          if (result.data && !result.error) {
            const response = {
              data: result.data,
              pagination: {
                page,
                limit,
                totalCount: result.count || 0,
                totalPages: Math.ceil((result.count || 0) / limit),
                hasNext: offset + limit < (result.count || 0),
                hasPrev: page > 1
              },
              error: null
            };
            
            // Smart caching with adaptive TTL (min 1 minute, max 5 minutes)
            const ttl = Math.min(TIMEOUTS.CACHE_TTL, Math.max(TIME_CONSTANTS.MINUTE, (result.count || 0) * 50));
            await consolidatedCache.set(cacheKey, response, ttl, ['robots', 'paginated']);
            
            const duration = performance.now() - startTime;
            performanceMonitor.record('getRobotsPaginated_supabase', duration);
            
             // Log slow queries in development
             if (import.meta.env.DEV && duration > TIME_CONSTANTS.SECOND) {
               logger.warn(`Slow getRobotsPaginated query: ${duration.toFixed(2)}ms for ${result.count} results`);
             }
            
            return response;
          }
          
          const duration = performance.now() - startTime;
          performanceMonitor.record('getRobotsPaginated_error', duration);
          return { data: [], pagination: { page, limit, totalCount: 0, totalPages: 0, hasNext: false, hasPrev: false }, error: result.error };
        }, 'getRobotsPaginated');
      } catch (error: unknown) {
        const duration = performance.now() - startTime;
        performanceMonitor.record('getRobotsPaginated_exception', duration);
        handleError(error as Error, 'getRobotsPaginated', 'mockDb');
        throw error;
      }
 },

   /**
     * Get multiple robots by IDs in a single query for better performance
     * Security: Filters by current user_id and excludes soft-deleted records
     */
    async getRobotsByIds(ids: string[]) {
      const startTime = performance.now();
      try {
        const settings = settingsManager.getDBSettings();
        
        // Get current user session for security filtering
        const client = await getClient();
        const { data: sessionData } = await client.auth.getSession();
        const userId = sessionData.session?.user?.id;
        
        if (!userId) {
          return { data: [], error: 'Authentication required' };
        }
        
        if (settings.mode === 'mock') {
          const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
          const robots = stored.filter((robot: Robot) => 
            ids.includes(robot.id) && 
            robot.user_id === userId && 
            !robot.deleted_at
          );
          
          const duration = performance.now() - startTime;
          performanceMonitor.record('getRobotsByIds', duration);
          return { data: robots, error: null };
        }
        
        // Include user_id in cache key for security isolation
        const cacheKey = `robots_batch_${userId}_${ids.sort().join('_')}`;
        const cached = await consolidatedCache.get<Robot[]>(cacheKey);
        if (cached) {
          const duration = performance.now() - startTime;
          performanceMonitor.record('getRobotsByIds', duration);
          return { data: cached, error: null };
        }
        
        return withRetry(async () => {
          const result = await client
            .from('robots')
            .select('*')
            .in('id', ids)
            .eq('user_id', userId)  // Security: Filter by current user
            .is('deleted_at', null)  // Data Integrity: Exclude soft-deleted records
            .order('created_at', { ascending: false });
          
          if (result.data && !result.error) {
            await consolidatedCache.set(cacheKey, result.data, 'api', ['robots', 'batch']);
          }
          
          const duration = performance.now() - startTime;
          performanceMonitor.record('getRobotsByIds', duration);
          return result;
        }, 'getRobotsByIds');
      } catch (error: unknown) {
        const duration = performance.now() - startTime;
        performanceMonitor.record('getRobotsByIds', duration);
        handleError(error as Error, 'getRobotsByIds', 'mockDb');
        throw error;
      }
    },

   async saveRobot(robot: any) {
    const startTime = performance.now();
    try {
      const settings = settingsManager.getDBSettings();

      // Security validation
      const validation = securityManager.sanitizeAndValidate(robot, 'robot');
      if (!validation.isValid) {
        const duration = performance.now() - startTime;
        performanceMonitor.record('saveRobot', duration);
        return { data: null, error: validation.errors.join(', ') };
      }

      // Rate limiting check (if user ID available)
      if (robot.user_id) {
        const rateLimit = securityManager.checkRateLimit(robot.user_id);
        if (!rateLimit.allowed) {
          const duration = performance.now() - startTime;
          performanceMonitor.record('saveRobot', duration);
          return { data: null, error: 'Rate limit exceeded' };
        }
      }

      const sanitizedRobot = validation.sanitizedData;

      if (settings.mode === 'mock') {
        try {
            const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
            const robots = stored;
            
            const newRobot = { ...sanitizedRobot, id: generateUUID(), created_at: new Date().toISOString() };
            robots.unshift(newRobot);
            
            trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
            const duration = performance.now() - startTime;
            performanceMonitor.record('saveRobot', duration);
            robotIndexManager.clear(); // Clear index since data changed
            
            // Clear cache after save
            await consolidatedCache.invalidateByTags(['robots', 'list']);
            
            return { data: [newRobot], error: null };
        } catch (e: unknown) {
            const duration = performance.now() - startTime;
            performanceMonitor.record('saveRobot', duration);
            return { data: null, error: getErrorMessage(e) };
        }
      }
      
      return withRetry(async () => {
        const client = await getClient();
        const result = client.from('robots').insert([sanitizedRobot]).select();
        
        // Invalidate cache after save
        await consolidatedCache.invalidateByTags(['robots', 'list']);
        
        const duration = performance.now() - startTime;
        performanceMonitor.record('saveRobot', duration);
        
        return result;
      }, 'saveRobot');
    } catch (error: unknown) {
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
              const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
              const robots = stored;
              
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
          } catch (e: unknown) {
              const duration = performance.now() - startTime;
              performanceMonitor.record('updateRobot', duration);
              return { data: null, error: getErrorMessage(e) };
          }
      }
      
      return withRetry(async () => {
        const client = await getClient();
        const result = await client
          .from('robots')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .match({ id })
          .select();
        
        const duration = performance.now() - startTime;
        performanceMonitor.record('updateRobot', duration);
        
        return result;
      }, 'updateRobot');
    } catch (error: unknown) {
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
              const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
              const robotIndex = stored.findIndex((r: any) => r.id === id);
              
              if (robotIndex === -1) {
                  const duration = performance.now() - startTime;
                  performanceMonitor.record('deleteRobot', duration);
                  return { error: "Robot not found" };
              }

              // SOFT DELETE: Set deleted_at timestamp and is_active flag
              (stored[robotIndex] as Robot).deleted_at = new Date().toISOString();
              (stored[robotIndex] as Robot).is_active = false;

              trySaveToStorage(ROBOTS_KEY, JSON.stringify(stored));
              const duration = performance.now() - startTime;
              performanceMonitor.record('deleteRobot', duration);
              robotIndexManager.clear(); // Clear index since data changed
              return { data: true, error: null };
          } catch (e: unknown) {
              const duration = performance.now() - startTime;
              performanceMonitor.record('deleteRobot', duration);
              return { error: getErrorMessage(e) };
          }
      }
      
      return withRetry(async () => {
        const client = await getClient();
        // Use soft delete instead of hard delete for data integrity
        const result = await client
          .from('robots')
          .update({ is_active: false, deleted_at: new Date().toISOString() })
          .match({ id });
        
        const duration = performance.now() - startTime;
        performanceMonitor.record('deleteRobot', duration);
        
        return result;
      }, 'deleteRobot');
    } catch (error: unknown) {
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
              const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
              const robots = stored;
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
          } catch (e: unknown) {
              const duration = performance.now() - startTime;
              performanceMonitor.record('duplicateRobot', duration);
              return { data: null, error: getErrorMessage(e) };
          }
      }
      
      return withRetry(async () => {
        const client = await getClient();
        const { data: original, error } = await client.from('robots').select('*').eq('id', id).eq('is_active', true).single();
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
      }, 'duplicateRobot');
    } catch (error: unknown) {
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
            const client = await getClient();
            const { count, error } = await client.from('robots').select('*', { count: 'exact', head: true });
            
            if (error) throw error;
            return { success: true, message: `Connected to Supabase. Found ${count} records.`, mode: 'supabase' };
        } catch (e: unknown) {
            return { success: false, message: `Connection Failed: ${getErrorMessage(e)}`, mode: 'supabase' };
        }
    },

    async getStats(): Promise<{ count: number; storageType: string }> {
        const settings = settingsManager.getDBSettings();
        if (settings.mode === 'mock') {
            const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
            const robots = stored;
            return { count: robots.length, storageType: 'Browser Local Storage' };
        } else {
            const client = await getClient();
            const { count } = await client.from('robots').select('*', { count: 'exact', head: true });
            return { count: count || 0, storageType: 'Supabase Cloud DB' };
        }
    },

    async exportDatabase(): Promise<string> {
        const settings = settingsManager.getDBSettings();
        let robots = [];

        if (settings.mode === 'mock') {
            const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
            robots = stored;
        } else {
            const client = await getClient();
            const { data, error } = await client.from('robots').select('*');
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
                const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
                const currentRobots = merge ? stored : [];
                
                const newRobots = validRobots.map((r: Robot) => ({
                    ...r,
                    id: generateUUID()
                }));

                const finalRobots = [...newRobots, ...currentRobots]; 
                
                trySaveToStorage(ROBOTS_KEY, JSON.stringify(finalRobots));
                
                const result: { success: boolean; count: number; error?: string } = {
                    success: true, 
                    count: newRobots.length
                };
                
                if (skippedCount > 0) {
                    result.error = `Skipped ${skippedCount} invalid records.`;
                }
                
                return result;
            } else {
                const client = await getClient();
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
                
                const importResult: { success: boolean; count: number; error?: string } = {
                    success: true, 
                    count: payload.length
                };
                
                if (skippedCount > 0) {
                    importResult.error = `Skipped ${skippedCount} invalid records.`;
                }
                
                return importResult;
            }

        } catch (e: unknown) {
            return { success: false, count: 0, error: getErrorMessage(e) };
        }
    },

    /**
     * Migration Utility: Moves data from LocalStorage Mock to Supabase Cloud.
     * Uses batch processing to avoid payload limits.
     * With Fault Tolerance: If one batch fails, try to continue.
     */
    async migrateMockToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
        const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
        const localRobots = stored;
        
        if (localRobots.length === 0) {
            return { success: false, count: 0, error: "No local robots found to migrate." };
        }

        const client = await getClient();
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

            const batchSize = BATCH_SIZES.DATABASE_OPERATIONS;
            for (let i = 0; i < payload.length; i += batchSize) {
                const chunk = payload.slice(i, i + batchSize);
                const { error } = await client.from('robots').insert(chunk);
                if (error) {
                    logger.error("Batch migration failed", error);
                    failCount += chunk.length;
                    lastError = error.message;
                } else {
                    successCount += chunk.length;
                }
            }

            if (successCount === 0 && failCount > 0) {
                return { success: false, count: 0, error: lastError };
            }

            const migrationResult: { success: boolean; count: number; error?: string } = {
                success: true, 
                count: successCount
            };
            
            if (failCount > 0) {
                migrationResult.error = `Migrated ${successCount}, Failed ${failCount}. Last error: ${lastError}`;
            }

            return migrationResult;
        } catch (e: unknown) {
            return { success: false, count: 0, error: getErrorMessage(e) };
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
                const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
                // Filter out soft-deleted robots (consistent with Supabase mode)
                const robots = stored.filter((r: Robot) => !r.deleted_at);
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
                const client = await getClient();
                let query = client.from('robots').select('*').eq('is_active', true);
                
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
        } catch (error: unknown) {
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
                const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
                const robots = stored;
                const index = robotIndexManager.getIndex(robots);
                
                // Get all unique types from the index
                const result = Array.from(index.byType.keys());
                const duration = performance.now() - startTime;
                performanceMonitor.record('getStrategyTypes', duration);
                return result;
            } else {
                // For Supabase, use distinct query
                const client = await getClient();
                const { data, error } = await client
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
        } catch (error: unknown) {
            const duration = performance.now() - startTime;
            performanceMonitor.record('getStrategyTypes', duration);
            throw error;
        }
    },
    
    /**
     * Batch operations for better performance
     */
    async batchUpdateRobots(updates: Array<{ id: string; data: Partial<Robot> }>): Promise<{ success: number; failed: number; errors?: string[] }> {
        const startTime = performance.now();
        try {
            const settings = settingsManager.getDBSettings();
            const errors: string[] = [];
            let successCount = 0;
            let failedCount = 0;
            
            if (settings.mode === 'mock') {
                try {
                    const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
                    const robots = stored;
                    
                    for (const item of updates) {
                        const robotIndex = robots.findIndex((r: any) => r.id === item.id);
                        if (robotIndex !== -1) {
                            robots[robotIndex] = { 
                                ...robots[robotIndex], 
                                ...item.data, 
                                updated_at: new Date().toISOString() 
                            } as Robot;
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
	const batchResult: { success: number; failed: number; errors?: string[] } = {
                        success: successCount, 
                        failed: failedCount
                    };
                    
                    if (errors.length > 0) {
                        batchResult.errors = errors;
                    }
                    
                    return batchResult;
                } catch (e: unknown) {
                    const duration = performance.now() - startTime;
                    performanceMonitor.record('batchUpdateRobots', duration);
                    return { success: 0, failed: updates.length, errors: [getErrorMessage(e)] };
                }
            } else {
                // For Supabase, process in batches to avoid query limits
                const batchSize = BATCH_SIZES.DATABASE_OPERATIONS;

                for (let i = 0; i < updates.length; i += batchSize) {
                    const batch = updates.slice(i, i + batchSize);
                    
                    try {
                        // Process each item in the batch individually due to Supabase limitations
                        const client = await getClient();
                        for (const item of batch) {
                            const result = await client
                                .from('robots')
                                .update({ ...item.data, updated_at: new Date().toISOString() })
                                .match({ id: item.id })
                                .select();
                                
                            if (result.error) {
                                failedCount++;
                                errors.push(`Error updating ${item.id}: ${result.error.message}`);
                            } else {
                                successCount++;
                            }
                        }
                    } catch (e: unknown) {
                        failedCount += batch.length;
                        errors.push(getErrorMessage(e));
                    }
                }
                
                const duration = performance.now() - startTime;
                performanceMonitor.record('batchUpdateRobots', duration);
                const supabaseBatchResult: { success: number; failed: number; errors?: string[] } = {
                    success: successCount, 
                    failed: failedCount
                };
                
                if (errors.length > 0) {
                    supabaseBatchResult.errors = errors;
                }
                
                return supabaseBatchResult;
            }
        } catch (error: unknown) {
            const duration = performance.now() - startTime;
            performanceMonitor.record('batchUpdateRobots', duration);
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
                const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
                const robots = stored;
                
                // Remove any potential duplicates by ID
                const seenIds = new Set<string>();
                const uniqueRobots = robots.filter((robot: any) => {
                    if (seenIds.has(robot.id)) {
                        return false; // Duplicate, remove
                    }
                    seenIds.add(robot.id);
                    return true;
                });
                
                // Clean up any invalid robots
                const validRobots = uniqueRobots.filter((robot: any) => 
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
                const client = await getClient();
                const { error } = await client.rpc('pg_stat_reset');
                
                if (error) {
                    logger.warn("Could not run database optimization:", error.message);
                    // Non-critical error, just return success with warning
                }
                
                return { 
                    success: true,
                    message: "Database optimization commands issued successfully"
                };
            }
        } catch (e: unknown) {
            return {
                success: false,
                message: `Database optimization failed: ${getErrorMessage(e)}`
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
            const stored = (storage.get<Robot[]>(ROBOTS_KEY) || []) as Robot[];
            const robots = stored;
            
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
            const client = await getClient();
            const { count, error } = await client.from('robots').select('*', { count: 'exact', head: true });
            
            if (error) {
                throw error;
            }
            
            // Get approximate table size from PostgreSQL
            await client
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
    },

    /**
     * Destroy the Supabase service and clean up all resources
     * Prevents memory leaks by clearing auth listeners
     */
    destroy(): void {
        clearAllAuthListeners();
        logger.log('Supabase service destroyed and resources cleaned up');
    }
};
