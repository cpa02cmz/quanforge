/**
 * Modular Supabase Service - Refactored Architecture
 * 
 * This file has been decomposed from ~1578 lines to use modular services.
 * Backward compatibility is maintained through the modular system.
 * 
 * Previous monolithic structure → Modular components:
 * - Core Operations → database/coreOperations.ts
 * - Connection Management → database/connectionManager.ts  
 * - Cache Layer → database/cacheLayer.ts
 * - Retry Logic → database/retryLogic.ts
 * - Analytics → database/analyticsCollector.ts
 * - Storage → supabase/storage.ts
 * - Authentication → supabase/auth.ts
 * - Database → supabase/database.ts
 * - Index → supabase/index.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Robot, UserSession } from '../types';
import { modularSupabase } from './database/modularSupabase';
import { checkSupabaseHealth } from './supabase/index';
import { mockAuth } from './supabase/auth';
import { mockDB as mockDb, getRobots as getDbRobots } from './supabase/database';

// Client proxy for backward compatibility
export const supabase = {
    // Use modular client when available, otherwise provide a mock
    get auth() {
        return modularSupabase.onAuthStateChange ? 
            { 
                onAuthStateChange: modularSupabase.onAuthStateChange, 
                signOut: modularSupabase.signOut,
                signInWithPassword: modularSupabase.signInWithPassword,
                signUp: modularSupabase.signUp,
                getSession: modularSupabase.getSession
            } : 
            mockAuth;
    },
    // Proxy other properties through the modular system
from: (_table: string) => {
        // This would delegate to the actual Supabase client via the modular system
        // For now, provide a mock implementation for compatibility
        return {
            select: (_columns: string) => ({
                order: (_column: string, _options: any) => ({
                    limit: (_limit: number) => Promise.resolve({ data: [], error: null }),
                }),
                eq: (_column: string, _value: any) => ({
                    limit: (_limit: number) => Promise.resolve({ data: [], error: null }),
                }),
            }),
        };
    },

    async saveRobot(robot: Partial<Robot>) {
        try {
            const result = await modularSupabase.saveRobot(robot);
            if (result.success && result.data) {
                return result.data[0]; // Return the first saved robot
            }
            throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to save robot');
        } catch (error) {
            console.error('saveRobot error:', error);
            throw error;
        }
    },

    async updateRobot(id: string, updates: Partial<Robot>) {
        try {
            const result = await modularSupabase.updateRobot(id, updates);
            if (result.success && result.data) {
                return result.data[0]; // Return the updated robot
            }
            throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to update robot');
        } catch (error) {
            console.error('updateRobot error:', error);
            throw error;
        }
    },

    async deleteRobot(id: string) {
        try {
            const result = await modularSupabase.deleteRobot(id);
            return result.success;
        } catch (error) {
            console.error('deleteRobot error:', error);
            throw error;
        }
    },

    async getRobotById(id: string) {
        try {
            const result = await modularSupabase.getRobotById(id);
            return result.success && result.data ? result.data : null;
        } catch (error) {
            console.error('getRobotById error:', error);
            return null;
        }
    },

    async duplicateRobot(id: string) {
        try {
            const robot = await this.getRobotById(id);
            if (!robot) {
                throw new Error('Robot not found');
            }
            
            // Create a copy without the ID
            const { id: _, created_at, updated_at, ...rest } = robot;
            const newRobot = {
                ...rest,
                name: `Copy of ${robot.name}`,
            };
            
            return await this.saveRobot(newRobot);
        } catch (error) {
            console.error('duplicateRobot error:', error);
            throw error;
        }
    },

    async getRobots() {
        try {
            const result = await modularSupabase.getRobots();
            if (result.success && result.data) {
                return result;
            }
            throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to get robots');
        } catch (error) {
            console.error('getRobots error:', error);
            throw error;
        }
    }
};

// Database utilities using modular system
export const dbUtils = {
    async checkConnection(): Promise<{ success: boolean; message: string; mode: string }> {
        try {
            const healthResult = await checkSupabaseHealth();
            return {
                success: healthResult.status === 'healthy',
                message: healthResult.message,
                mode: healthResult.status === 'mock_mode' ? 'mock' : 'modular'
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Connection check failed',
                mode: 'modular'
            };
        }
    },

    async getStats(): Promise<{ count: number; storageType: string }> {
        try {
            const metrics = modularSupabase.getPerformanceMetrics();
            return {
                count: (metrics['totalRobots'] as number) || 0,
                storageType: 'Modular Database System'
            };
        } catch (error) {
            return { count: 0, storageType: 'Error getting stats' };
        }
    },

    async exportDatabase(): Promise<string> {
        try {
            const result = await modularSupabase.getRobots();
            if (!result.success || !result.data) {
                throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch robots for export');
            }
            
            const exportObj = {
                version: "1.0",
                exportedAt: new Date().toISOString(),
                source: 'modular',
                robots: result.data
            };
            
            return JSON.stringify(exportObj, null, 2);
        } catch (error) {
            console.error('exportDatabase error:', error);
            throw error;
        }
    },

    async importDatabase(jsonString: string, _merge: boolean = true): Promise<{ success: boolean; count: number; error?: string }> {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed.robots || !Array.isArray(parsed.robots)) {
                throw new Error("Invalid format: 'robots' array missing.");
            }

            const robots = parsed.robots.filter((r: any) => r && typeof r.name === 'string');
            
            if (robots.length === 0 && parsed.robots.length > 0) {
                return { success: false, count: 0, error: "No valid robots found in import data." };
            }

            // Use modular batch update
            const batchUpdates = robots.map((robot: Robot) => ({
                id: robot.id,
                data: robot
            }));
            
            const result = await modularSupabase.batchUpdateRobots(batchUpdates);
            
            if (result.success) {
                return { 
                    success: true, 
                    count: robots.length
                };
            } else {
                return { 
                    success: false, 
                    count: 0, 
                    error: typeof result.error === 'string' ? result.error : result.error?.message || 'Import failed' 
                };
            }
        } catch (error) {
            return { 
                success: false, 
                count: 0, 
                error: error instanceof Error ? error.message : 'Import failed' 
            };
        }
    },

    async migrateMockToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
        try {
            // Get all robots from current storage (could be mock or Supabase)
            const result = await modularSupabase.getRobots();
            if (!result.success || !result.data) {
                throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch robots for migration');
            }

            const robots = result.data;
            if (robots.length === 0) {
                return { success: true, count: 0 };
            }

            // For simplicity, we're ensuring all robots are properly saved
            // This effectively "migrates" them by ensuring they're in the current active backend
            let successCount = 0;
            let errorCount = 0;
            const errors: string[] = [];

            for (const robot of robots) {
                try {
                    const saveResult = await modularSupabase.saveRobot(robot);
                    if (saveResult.success) {
                        successCount++;
                    } else {
                        errorCount++;
                        errors.push(`Failed to migrate robot ${robot.id}: ${saveResult.error}`);
                    }
                } catch (error) {
                    errorCount++;
                    errors.push(`Error migrating robot ${robot.id}: ${(error as Error).message}`);
                }
            }

            if (errorCount > 0) {
                return {
                    success: false,
                    count: successCount,
                    error: `Partial success: ${successCount} migrated, ${errorCount} failed. Errors: ${errors.join(', ')}`
                };
            }

            return {
                success: true,
                count: successCount
            };
        } catch (error) {
            return {
                success: false,
                count: 0,
                error: error instanceof Error ? error.message : 'Migration failed'
            };
        }
    }
};

// Additional utility functions for backward compatibility
export const getRobotsPaginated = async (page: number = 1, pageSize: number = 10) => {
const result = await getDbRobots();
    
    // Handle different possible return types from database
    let robots: Robot[] = [];
    if (Array.isArray(result.data)) {
        robots = result.data as Robot[];
    } else if (result.data && typeof result.data === 'object' && 'then' in result.data) {
        // This looks like a promise that wasn't awaited
        robots = await (result.data as Promise<Robot[]>);
    }
    
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return {
        robots: robots.slice(start, end),
        total: robots.length,
        page,
        pageSize
    };
};

export const searchRobots = async (searchTerm: string) => {
    const result = await getDbRobots();
    
    // Handle different possible return types from database
    let robots: Robot[] = [];
    if (Array.isArray(result.data)) {
        robots = result.data as Robot[];
    } else if (result.data && typeof result.data === 'object' && 'then' in result.data) {
        robots = await (result.data as Promise<Robot[]>);
    }
    
    const term = searchTerm.toLowerCase();
    return robots.filter((robot: Robot) => 
        robot.name?.toLowerCase().includes(term) ||
        robot.description?.toLowerCase().includes(term) ||
        robot.code?.toLowerCase().includes(term)
    );
};

// Export mockDb for backward compatibility
export { mockDb };

// Performance monitoring utilities
export const performanceMonitor = {
    logMetrics: () => {
        const metrics = modularSupabase.getPerformanceMetrics();
        console.log('Database Performance Metrics:', metrics);
    },
    
    resetMetrics: () => {
        modularSupabase.resetPerformanceMetrics();
    },
    
    optimizeDatabase: async () => {
        const result = await modularSupabase.optimizeDatabase();
        return {
            success: result,
            message: result ? 'Database optimization completed' : 'Database optimization failed'
        };
    }
};

// Export authentication utilities
export { mockAuth };

// Export types for backward compatibility
export type { Robot, UserSession };
export type { SupabaseClient };

// Default export
export default { 
    supabase, 
    mockDb, 
    dbUtils, 
    mockAuth, 
    performanceMonitor,
    getRobotsPaginated,
    searchRobots
};