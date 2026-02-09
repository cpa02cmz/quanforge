/**
 * Supabase Service - Backward Compatibility Wrapper
 * 
 * Provides the same interface as the original monolithic supabase.ts
 * but delegates to the new modular service architecture
 * 
 * This ensures zero breaking changes during the migration
 */

import { globalOrchestrator } from './core/ServiceOrchestrator';
import { SERVICE_TOKENS } from '../types/serviceInterfaces';
import { Robot, UserSession } from '../types';
import { handleError } from '../utils/errorHandler';
import { STORAGE_KEYS } from '../constants';

// Import the robot database service
import { RobotDatabaseService, IRobotDatabaseService } from './database/RobotDatabaseService';

// Keep a singleton instance of the robot database service
let robotDatabaseService: RobotDatabaseService | null = null;

const getService = async (): Promise<IRobotDatabaseService> => {
    if (!globalOrchestrator.isReady()) {
        await globalOrchestrator.initialize();
    }
    
    if (!robotDatabaseService) {
        robotDatabaseService = new RobotDatabaseService();
        await robotDatabaseService.initialize();
    }
    
    return robotDatabaseService;
};

// Mock session and auth utilities (preserved from original)
const STORAGE_KEY = STORAGE_KEYS.SESSION;
const ROBOTS_KEY = STORAGE_KEYS.ROBOTS;

const safeParse = (data: string | null, fallback: any) => {
    if (!data) return fallback;
    try {
        return JSON.parse(data) || fallback;
    } catch (e) {
        console.error("Failed to parse data from storage:", e);
        return fallback;
    }
};

const trySaveToStorage = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (e: any) {
        if (
            e.name === 'QuotaExceededError' || 
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            e.code === 22 ||
            e.code === 1014 ||
            e.name === 'NS_ERROR_FILE_NO_DEVICE_SPACE'
        ) {
            console.warn('Storage quota exceeded, clearing old data');
            // Clear old data and try again
            const keys = Object.keys(localStorage);
            for (let i = 0; i < keys.length - 5; i++) { // Keep last 5 items
                localStorage.removeItem(keys[i]);
            }
            localStorage.setItem(key, value);
        } else {
            console.error('Error saving to localStorage:', e);
            throw e;
        }
    }
};

const generateUUID = (): string => {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }
    
    const timestamp = new Date().getTime();
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    
    // Convert to hex with timestamp included
    const hex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${timestamp}-${hex.substring(0, 12)}-${hex.substring(12)}`;
};

const isValidRobot = (r: any): boolean => {
    return r && typeof r.name === 'string' && r.name.trim().length > 0;
};

// Auth listeners
const authListeners: Array<(event: string, session: UserSession | null) => void> = [];

const getMockSession = () => {
    const sessionData = localStorage.getItem(STORAGE_KEY);
    return safeParse(sessionData, null);
};

const mockAuth = {
    onAuthStateChange(callback: (event: string, session: UserSession | null) => void) {
        authListeners.push(callback);
        // Initial call
        callback('INITIAL_SESSION', getMockSession());
        
        return {
            data: {
                subscription: {
                    unsubscribe: () => {
                        const index = authListeners.indexOf(callback);
                        if (index > -1) {
                            authListeners.splice(index, 1);
                        }
                    }
                }
            }
        };
    },
    
    getCurrentUser() {
        return getMockSession()?.user || null;
    },
    
    async signOut() {
        localStorage.removeItem(STORAGE_KEY);
        authListeners.forEach(listener => listener('SIGNED_OUT', null));
    },
    
    async signIn(email: string, password: string) {
        // Mock sign in
        const user = {
            id: generateUUID(),
            email,
            created_at: new Date().toISOString()
        };
        
        const session = { user, access_token: 'mock_token' };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        authListeners.forEach(listener => listener('SIGNED_IN', session));
        
        return { data: { session, user }, error: null };
    },
    
    async signUp(email: string, password: string) {
        return this.signIn(email, password);
    }
};

// Legacy supabase proxy - maintains same interface as original
export const supabase = new Proxy({}, {
    get(target: any, prop: string) {
        if (prop === 'auth') return mockAuth;
        
        // For any other property, provide a mock implementation or delegate
        return {
            from: (table: string) => ({
                select: (columns: string) => ({
                    order: (column: string, options: any) => ({
                        limit: (limit: number) => Promise.resolve({ data: [], error: null }),
                        then: (resolve: any) => Promise.resolve({ data: [], error: null }),
                    }),
                    count: (option: string) => ({
                        head: (option: boolean) => Promise.resolve({ count: 0, error: null }),
                    }),
                }),
                insert: (data: any) => Promise.resolve({ data, error: null }),
                update: (data: any) => ({
                    eq: (column: string, value: any) => Promise.resolve({ data, error: null }),
                }),
                delete: () => ({
                    eq: (column: string, value: any) => Promise.resolve({ error: null }),
                }),
            }),
            rpc: (functionName: string, params: any) => Promise.resolve({ data: null, error: null }),
        };
    }
}) as any;

// Mock client for backward compatibility
export const mockClient = {
    auth: mockAuth,
    
    from: (table: string) => ({
        select: (columns: string) => ({
            order: (column: string, options: any) => ({
                limit: (limit: number) => Promise.resolve({ data: [], error: null }),
                then: (resolve: any) => Promise.resolve({ data: [], error: null }),
            }),
            count: (option: string) => ({
                head: (option: boolean) => Promise.resolve({ count: 0, error: null }),
            }),
        }),
        insert: (data: any) => Promise.resolve({ data, error: null }),
        update: (data: any) => ({
            eq: (column: string, value: any) => Promise.resolve({ data, error: null }),
        }),
        delete: () => ({
            eq: (column: string, value: any) => Promise.resolve({ error: null }),
        }),
    }),
    
    rpc: (functionName: string, params: any) => Promise.resolve({ data: null, error: null }),
};

// Enhanced mock database implementation using modular services
export const mockDb = {
    async getRobots() {
        const startTime = performance.now();
        
        try {
            const database = await getService();
            const cache = await globalOrchestrator.getCache();
            
            // Try cache first
            const cacheKey = STORAGE_KEYS.ROBOTS_LIST;
            let robots = await cache.get<Robot[]>(cacheKey);
            
            if (!robots) {
                robots = await this.getAllRobots();
                await cache.set(cacheKey, robots, ['robots', 'list']);
            }
            
            const duration = performance.now() - startTime;
            
            return { data: robots, error: null };
        } catch (error) {
            const duration = performance.now() - startTime;
            console.error(`getRobots failed after ${duration.toFixed(2)}ms:`, error);
            handleError(error as Error, 'getRobots', 'mockDb');
            throw error;
        }
    },

    async getRobot(id: string) {
        try {
            const database = await getService();
            
            return await database.getRobot(id);
        } catch (error) {
            handleError(error as Error, 'getRobot', 'mockDb');
            throw error;
        }
    },

    async saveRobot(robot: any) {
        try {
            const database = await getService();
            const cache = await globalOrchestrator.getCache();
            const analytics = await globalOrchestrator.getAnalytics();
            
            const robotId = await database.saveRobot(robot);
            
            // Invalidate cache
            await cache.invalidate('robots_list');
            
            // Track analytics
            await analytics.trackEvent('robot_saved', { robotId, name: robot.name });
            
            return { data: { id: robotId }, error: null };
        } catch (error) {
            handleError(error as Error, 'saveRobot', 'mockDb');
            throw error;
        }
    },

    async updateRobot(id: string, updates: any) {
        try {
            const database = await getService();
            const cache = await globalOrchestrator.getCache();
            
            const success = await database.updateRobot(id, updates);
            
            if (success) {
                await cache.invalidate('robots_list');
            }
            
            return { data: { success }, error: null };
        } catch (error) {
            handleError(error as Error, 'updateRobot', 'mockDb');
            throw error;
        }
    },

    async deleteRobot(id: string) {
        try {
            const database = await getService();
            const cache = await globalOrchestrator.getCache();
            const analytics = await globalOrchestrator.getAnalytics();
            
            const success = await database.deleteRobot(id);
            
            if (success) {
                await cache.invalidate('robots_list');
                await analytics.trackEvent('robot_deleted', { robotId: id });
            }
            
            return { data: { success }, error: null };
        } catch (error) {
            handleError(error as Error, 'deleteRobot', 'mockDb');
            throw error;
        }
    },

    async getAllRobots() {
        try {
            const database = await getService();
            
            return await database.getAllRobots();
        } catch (error) {
            handleError(error as Error, 'getAllRobots', 'mockDb');
            throw error;
        }
    },

    async searchRobots(searchTerm: string, filterType?: string) {
        try {
            const database = await getService();
            
            return await database.searchRobots(searchTerm, filterType);
        } catch (error) {
            handleError(error as Error, 'searchRobots', 'mockDb');
            throw error;
        }
    }
};

// Database utilities - delegate to modular services
export const dbUtils = {
    async checkConnection() {
        try {
            const database = await getService();
            
            return await database.checkConnection();
        } catch (error) {
            return { 
                success: false, 
                message: `Connection Failed: ${(error as Error).message}`, 
                mode: 'unknown' 
            };
        }
    },

    async getStats() {
        try {
            const database = await getService();
            
            return await database.getStats();
        } catch (error) {
            return { count: 0, storageType: 'Error' };
        }
    },

    async exportDatabase() {
        try {
            const database = await getService();
            
            return await database.exportDatabase();
        } catch (error) {
            handleError(error as Error, 'exportDatabase', 'dbUtils');
            throw error;
        }
    },

    async importDatabase(jsonString: string, merge: boolean = true) {
        try {
            const database = await getService();
            const cache = await globalOrchestrator.getCache();
            const analytics = await globalOrchestrator.getAnalytics();
            
            const result = await database.importDatabase(jsonString, merge);
            
            if (result.success) {
                await cache.invalidate('robots_list');
                await analytics.trackEvent('database_imported', { 
                    count: result.count, 
                    merge 
                });
            }
            
            return result;
        } catch (error) {
            handleError(error as Error, 'importDatabase', 'dbUtils');
            return {
                success: false,
                count: 0,
                error: (error as Error).message
            };
        }
    },

    async clearDatabase() {
        try {
            // For safety, we'll just clear robots
            let deletedCount = 0;
            const robots = await mockDb.getAllRobots();
            
            for (const robot of robots) {
                await mockDb.deleteRobot(robot.id);
                deletedCount++;
            }
            
            return true;
        } catch (error) {
            handleError(error as Error, 'clearDatabase', 'dbUtils');
            return false;
        }
    },

    async searchRobots(searchTerm: string, filterType?: string) {
        try {
            return await mockDb.searchRobots(searchTerm, filterType);
        } catch (error) {
            handleError(error as Error, 'searchRobots', 'dbUtils');
            return [];
        }
    },

    async getStrategyTypes() {
        try {
            const robots = await mockDb.getAllRobots();
            const types = new Set(robots.map(r => r.strategy_type || 'Custom'));
            return Array.from(types);
        } catch (error) {
            handleError(error as Error, 'getStrategyTypes', 'dbUtils');
            return [];
        }
    },

    async batchUpdateRobots(updates: Array<{ id: string; updates: any }>) {
        let successCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        for (const update of updates) {
            try {
                await mockDb.updateRobot(update.id, update.updates);
                successCount++;
            } catch (error) {
                failedCount++;
                errors.push(`${update.id}: ${(error as Error).message}`);
            }
        }

        return { success: successCount, failed: failedCount, errors };
    },

    async optimizeDatabase() {
        try {
            const database = await getService();
            
            return await database.optimizeDatabase();
        } catch (error) {
            return {
                success: false,
                message: `Optimization failed: ${(error as Error).message}`
            };
        }
    },

    async getDatabaseStats() {
        try {
            const database = await getService();
            const cache = await globalOrchestrator.getCache();
            const pool = await globalOrchestrator.getConnectionPool();
            
            const dbStats = await database.getStats();
            const cacheStats = cache.getStats();
            const poolStats = pool.getPoolStats();
            
            return {
                database: dbStats,
                cache: cacheStats,
                connectionPool: poolStats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                database: { count: 0, storageType: 'Error' },
                cache: { hitRate: 0, size: 0, memoryUsage: 0 },
                connectionPool: { active: 0, idle: 0, total: 0 },
                timestamp: new Date().toISOString(),
                error: (error as Error).message
            };
        }
    }
};

// Export for use in application initialization
export const initializeLegacyServices = async () => {
    await getService();
};

// Helper to get service orchestrator for advanced usage
export const getServiceOrchestrator = () => {
    return globalOrchestrator;
};