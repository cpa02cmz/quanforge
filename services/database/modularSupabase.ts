/**
 * Modular Supabase Service
 * Consolidates the 5 service modules into a unified interface that matches the original supabase.ts API
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Robot, UserSession } from '../../types';
import type { AppError, APIResponse } from '../../types/common';
import { handleError } from '../../utils/errorHandler';
import { settingsManager } from '../settingsManager';
import { securityManager } from '../securityManager';
import { databaseCore, DatabaseCoreInterface } from './coreOperations';
import { connectionManager, ConnectionManagerInterface } from './simpleConnectionManager';
import { cacheLayer, CacheLayerInterface } from './cacheLayer';
import { retryLogic, RetryLogicInterface } from './retryLogic';
import { analyticsCollector, AnalyticsCollectorInterface } from './analyticsCollector';

// Mock session storage constants
const STORAGE_KEY = 'mock_session';
const ROBOTS_KEY = 'mock_robots';

// Helper for safe JSON parsing
const safeParse = <T = unknown>(data: string | null, fallback: T): T => {
  if (!data) return fallback;
  try {
    return securityManager.safeJSONParse(data) || fallback;
  } catch (e) {
    return fallback;
  }
};

// Helper for creating AppError objects
const createAppError = (message: string, code?: string | number): AppError => {
  const error = new Error(message) as AppError;
  error.name = 'SupabaseError';
  error.code = code;
  return error;
};

// Helper to convert old format to APIResponse format
const toApiResult = <T>(
  data: T | null, 
  error: AppError | null
): APIResponse<T> => {
  if (error) {
    return {
      success: false,
      error: error.message,
      status: typeof error.code === 'number' ? error.code : undefined,
      timestamp: Date.now(),
    };
  }
  
  return {
    success: true,
    data: data as T,
    timestamp: Date.now(),
  };
};

// Helper for success responses
const createSuccessResponse = <T>(data: T): APIResponse<T> => ({
  success: true,
  data,
  timestamp: Date.now(),
});

// Helper for error responses
const createErrorResponse = <T = null>(message: string, code?: number | string): APIResponse<T> => ({
  success: false,
  error: message,
  status: typeof code === 'number' ? code : undefined,
  timestamp: Date.now(),
});

// Helper for safe localStorage operations
const trySaveToStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e: unknown) {
    if ((e as Error).name === 'QuotaExceededError' || 
      (e as Error).name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      (e as { code?: number }).code === 22 ||
      (e as { code?: number }).code === 1014
    ) {
      throw new Error("Browser Storage Full. Please delete some robots or export/clear your database to free up space.");
    }
    throw e;
  }
};

export interface ModularSupabaseService {
  // Authentication methods
  getSession(): Promise<APIResponse<{ session: UserSession | null }>>;
  onAuthStateChange(callback: (event: string, session: UserSession | null) => void): { data: { subscription: { unsubscribe: () => void } } };
  signOut(): Promise<APIResponse<null>>;
  
  // Robot operations
  getRobots(): Promise<APIResponse<Robot[]>>;
  getRobotById(id: string): Promise<APIResponse<Robot>>;
  getRobotsByIds(ids: string[]): Promise<APIResponse<Robot[]>>;
  saveRobot(robot: Partial<Robot>): Promise<APIResponse<Robot[]>>;
  updateRobot(id: string, updates: Partial<Robot>): Promise<APIResponse<Robot[]>>;
  deleteRobot(id: string): Promise<APIResponse<boolean>>;
  batchUpdateRobots(updates: Array<{ id: string; data: Partial<Robot> }>): Promise<APIResponse<{ successful: number; failed: number; errors?: string[] }>>;
  
  // Analytics and performance
  getPerformanceMetrics(): Record<string, unknown>;
  resetPerformanceMetrics(): void;
  logPerformanceMetrics(): void;
  optimizeDatabase(): Promise<{ success: boolean; message: string }>;
  
  // Utility methods
  getClient(): Promise<SupabaseClient>;
  getHealthStatus(): Promise<{ healthy: boolean; latency: number; error?: string }>;
}

class ModularSupabase implements ModularSupabaseService {
  constructor(
    private dbCore: DatabaseCoreInterface,
    private connMgr: ConnectionManagerInterface,
    private cache: CacheLayerInterface,
    private retry: RetryLogicInterface,
    private analytics: AnalyticsCollectorInterface
  ) {}

  // Authentication methods
  async getSession(): Promise<APIResponse<{ session: UserSession | null }>> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const result = await this.connMgr.getSession();
      this.analytics.recordOperation('getSession', endTimer());
      if (result.error) {
        return createErrorResponse(
          result.error.message,
          result.error.code
        );
      }
      return createSuccessResponse(result.data);
    } catch (error: unknown) {
      this.analytics.recordOperation('getSession', endTimer(), error);
      handleError(error as Error, 'getSession', 'modularSupabase');
      return createErrorResponse(
        error instanceof Error ? error.message : 'Session retrieval failed',
        error instanceof Error && 'code' in error ? String(error.code) : undefined
      );
    }
  }

  onAuthStateChange(callback: (event: string, session: UserSession | null) => void): { data: { subscription: { unsubscribe: () => void } } } {
    return this.connMgr.onAuthStateChange(callback);
  }

  async signOut(): Promise<{ error: AppError | null }> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const result = await this.connMgr.signOut();
      // Clear all caches on sign out
      await this.cache.clear();
      this.analytics.recordOperation('signOut', endTimer());
      return result;
    } catch (error) {
      this.analytics.recordOperation('signOut', endTimer(), error);
      handleError(error as Error, 'signOut', 'modularSupabase');
      throw error;
    }
  }

  // Robot operations with caching and retry logic
  async getRobots(): Promise<{ data: Robot[] | null; error: AppError | null }> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return this.getMockRobots(endTimer);
      }

      // Try cache first
      const cached = await this.cache.getCachedRobotsList();
      if (cached) {
        this.analytics.recordOperation('getRobots-cache', endTimer());
        return { data: cached, error: null };
      }

      // Fetch from database with retry
      const result = await this.retry.withRetry(async () => {
        const client = await this.connMgr.getClient();
        return await this.dbCore.getRobots(client);
      }, 'getRobots');

      if (result.data && !result.error) {
        await this.cache.cacheRobotsList(result.data);
      }

      this.analytics.recordOperation('getRobots', endTimer());
      return result;
    } catch (error) {
      this.analytics.recordOperation('getRobots', endTimer(), error);
      handleError(error as Error, 'getRobots', 'modularSupabase');
      throw error;
    }
  }

  async getRobotById(id: string): Promise<{ data: Robot | null; error: AppError | null }> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return this.getMockRobotById(id, endTimer);
      }

      // Try cache first
      const cached = await this.cache.getCachedRobot(id);
      if (cached) {
        this.analytics.recordOperation('getRobotById-cache', endTimer());
        return { data: cached, error: null };
      }

      // Fetch from database with retry
      const result = await this.retry.withRetry(async () => {
        const client = await this.connMgr.getClient();
        return await this.dbCore.getRobotById(client, id);
      }, 'getRobotById');

      if (result.data && !result.error) {
        await this.cache.cacheRobot(result.data);
      }

      this.analytics.recordOperation('getRobotById', endTimer());
      return result;
    } catch (error) {
      this.analytics.recordOperation('getRobotById', endTimer(), error);
      handleError(error as Error, 'getRobotById', 'modularSupabase');
      throw error;
    }
  }

  async getRobotsByIds(ids: string[]): Promise<{ data: Robot[] | null; error: AppError | null }> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return this.getMockRobotsByIds(ids, endTimer);
      }

      // For now, implement as multiple single calls - could be optimized
      const robots: Robot[] = [];
      let error: any = null;

      for (const id of ids) {
        const result = await this.getRobotById(id);
        if (result.data) {
          robots.push(result.data);
        }
        if (result.error && !error) {
          error = result.error;
        }
      }

      this.analytics.recordOperation('getRobotsByIds', endTimer());
      return { data: robots, error };
    } catch (error) {
      this.analytics.recordOperation('getRobotsByIds', endTimer(), error);
      handleError(error as Error, 'getRobotsByIds', 'modularSupabase');
      throw error;
    }
  }

  async saveRobot(robot: Partial<Robot>): Promise<{ data: Robot[] | null; error: AppError | null }> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      // Security validation
      if (!robot || typeof robot !== 'object') {
        const duration = endTimer();
        this.analytics.recordOperation('saveRobot', duration);
        return { data: null, error: createAppError('Invalid robot data structure', 'INVALID_DATA') };
      }

      // Rate limiting check
      if (robot.user_id) {
        const allowed = securityManager.checkRateLimit(robot.user_id);
        if (!allowed) {
          const duration = endTimer();
          this.analytics.recordOperation('saveRobot', duration);
          return { data: null, error: createAppError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED') };
        }
      }

      const sanitizedRobot = robot;

      if (settings?.mode === 'mock') {
        return this.saveMockRobot(sanitizedRobot, endTimer);
      }

      // Save to database with retry
      const result = await this.retry.withRetry(async () => {
        const client = await this.connMgr.getClient();
        return await this.dbCore.saveRobot(client, sanitizedRobot);
      }, 'saveRobot');

      if (result.data && !result.error) {
        // Invalidate relevant caches
        await this.cache.invalidateRobotCaches();
      }

      this.analytics.recordOperation('saveRobot', endTimer());
      return result;
    } catch (error) {
      this.analytics.recordOperation('saveRobot', endTimer(), error);
      handleError(error as Error, 'saveRobot', 'modularSupabase');
      throw error;
    }
  }

  async updateRobot(id: string, updates: Partial<Robot>): Promise<{ data: Robot[] | null; error: AppError | null }> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return this.updateMockRobot(id, updates, endTimer);
      }

      // Update in database with retry
      const result = await this.retry.withRetry(async () => {
        const client = await this.connMgr.getClient();
        return await this.dbCore.updateRobot(client, id, updates);
      }, 'updateRobot');

      if (result.data && !result.error) {
        // Invalidate relevant caches
        await this.cache.invalidateRobotCaches(id);
      }

      this.analytics.recordOperation('updateRobot', endTimer());
      return result;
    } catch (error) {
      this.analytics.recordOperation('updateRobot', endTimer(), error);
      handleError(error as Error, 'updateRobot', 'modularSupabase');
      throw error;
    }
  }

  async deleteRobot(id: string): Promise<{ data: true | null; error: AppError | null }> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return this.deleteMockRobot(id, endTimer);
      }

      // Delete from database with retry
      const result = await this.retry.withRetry(async () => {
        const client = await this.connMgr.getClient();
        return await this.dbCore.deleteRobot(client, id);
      }, 'deleteRobot');

      if (!result.error) {
        // Invalidate relevant caches
        await this.cache.invalidateRobotCaches(id);
      }

      this.analytics.recordOperation('deleteRobot', endTimer());
      return result;
    } catch (error) {
      this.analytics.recordOperation('deleteRobot', endTimer(), error);
      handleError(error as Error, 'deleteRobot', 'modularSupabase');
      throw error;
    }
  }

  async batchUpdateRobots(updates: Array<{ id: string; data: Partial<Robot> }>): Promise<{ success: number; failed: number; errors?: string[] }> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return this.batchUpdateMockRobots(updates, endTimer);
      }

      // Batch update with retry
      const result = await this.retry.withRetry(async () => {
        const client = await this.connMgr.getClient();
        return await this.dbCore.batchUpdateRobots(client, updates);
      }, 'batchUpdateRobots');

      // Invalidate all robot caches after batch update
      await this.cache.invalidateRobotCaches();

      this.analytics.recordOperation('batchUpdateRobots', endTimer());
      return result;
    } catch (error) {
      this.analytics.recordOperation('batchUpdateRobots', endTimer(), error);
      handleError(error as Error, 'batchUpdateRobots', 'modularSupabase');
      throw error;
    }
  }

  // Analytics and performance methods
  getPerformanceMetrics(): Record<string, any> {
    return this.dbCore.getPerformanceMetrics();
  }

  resetPerformanceMetrics(): void {
    this.dbCore.resetPerformanceMetrics();
    this.analytics.resetMetrics();
  }

  logPerformanceMetrics(): void {
    const report = this.analytics.getPerformanceReport();
    console.log(report);
  }

  async optimizeDatabase(): Promise<{ success: boolean; message: string }> {
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return this.optimizeMockDatabase();
      }

      // For Supabase, run optimization operations
      const client = await this.connMgr.getClient();
      const { error } = await client.rpc('pg_stat_reset');
      
      if (error) {
        console.warn("Could not run database optimization:", error.message);
      }
      
      // Clear and warm up caches
      await this.cache.clear();
      await this.cache.preloadCommonData();
      
      return { 
        success: true, 
        message: "Database optimization completed successfully" 
      };
    } catch (error) {
      handleError(error as Error, 'optimizeDatabase', 'modularSupabase');
      return { 
        success: false, 
        message: `Database optimization failed: ${(error as Error).message}` 
      };
    }
  }

  // Utility methods
  async getClient(): Promise<SupabaseClient> {
    return await this.connMgr.getClient();
  }

  async getHealthStatus(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    return await this.connMgr.getHealthStatus();
  }

  // Mock implementation methods (moved from original supabase.ts)
  private async getMockRobots(endTimer: () => number): Promise<{ data: Robot[] | null; error: AppError | null }> {
    const stored = localStorage.getItem(ROBOTS_KEY);
    const robots = safeParse(stored, []);
    this.analytics.recordOperation('getRobots-mock', endTimer());
    return { data: robots, error: null };
  }

  private async getMockRobotById(id: string, endTimer: () => number): Promise<{ data: Robot | null; error: AppError | null }> {
    const stored = localStorage.getItem(ROBOTS_KEY);
    const robots = safeParse(stored, []);
    const robot = robots.find((r: Robot) => r.id === id);
    this.analytics.recordOperation('getRobotById-mock', endTimer());
    return { data: robot || null, error: null };
  }

  private async getMockRobotsByIds(ids: string[], endTimer: () => number): Promise<{ data: Robot[] | null; error: AppError | null }> {
    const stored = localStorage.getItem(ROBOTS_KEY);
    const robots = safeParse(stored, []);
    const filteredRobots = robots.filter((robot: Robot) => ids.includes(robot.id));
    this.analytics.recordOperation('getRobotsByIds-mock', endTimer());
    return { data: filteredRobots, error: null };
  }

  private async saveMockRobot(robot: Partial<Robot>, endTimer: () => number): Promise<{ data: Robot[] | null; error: AppError | null }> {
    try {
      const stored = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse<Robot[]>(stored, []);
      
      const newRobot = { ...robot, id: robot.id || this.generateUUID(), created_at: new Date().toISOString() } as Robot;
      robots.unshift(newRobot);
      
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
      this.analytics.recordOperation('saveRobot-mock', endTimer());
      
      return { data: [newRobot], error: null };
    } catch (e: any) {
      this.analytics.recordOperation('saveRobot-mock', endTimer(), e);
      return { data: null, error: e.message };
    }
  }

  private async updateMockRobot(id: string, updates: Partial<Robot>, endTimer: () => number): Promise<{ data: Robot[] | null; error: AppError | null }> {
    try {
      const stored = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse<Robot[]>(stored, []);
      
      const index = robots.findIndex((r: Robot) => r.id === id);
      if (index === -1) {
        return { data: null, error: createAppError('Robot not found', 'NOT_FOUND') };
      }
      
      robots[index] = { ...robots[index], ...updates, updated_at: new Date().toISOString() };
      
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
      this.analytics.recordOperation('updateRobot-mock', endTimer());
      
      return { data: [robots[index]], error: null };
    } catch (e: any) {
      this.analytics.recordOperation('updateRobot-mock', endTimer(), e);
      return { data: null, error: e.message };
    }
  }

  private async deleteMockRobot(id: string, endTimer: () => number): Promise<{ data: true | null; error: AppError | null }> {
    try {
      const stored = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse<Robot[]>(stored, []);
      
      const filteredRobots = robots.filter((r: Robot) => r.id !== id);
      
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(filteredRobots));
      this.analytics.recordOperation('deleteRobot-mock', endTimer());
      
      return { data: true, error: null };
    } catch (e: unknown) {
      this.analytics.recordOperation('deleteRobot-mock', endTimer(), e);
      return { data: null, error: createAppError((e as Error).message || 'Unknown error') };
    }
  }

  private async batchUpdateMockRobots(updates: Array<{ id: string; data: Partial<Robot> }>, endTimer: () => number): Promise<{ success: number; failed: number; errors?: string[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const { id, data } of updates) {
      try {
        const result = await this.updateMockRobot(id, data, () => 0);
        if (result.error) {
          failedCount++;
          errors.push(`Failed to update robot ${id}: ${result.error}`);
        } else {
          successCount++;
        }
      } catch (error) {
        failedCount++;
        errors.push(`Error updating robot ${id}: ${(error as Error).message}`);
      }
    }

    this.analytics.recordOperation('batchUpdateRobots-mock', endTimer());
    
    return {
      success: successCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private async optimizeMockDatabase(): Promise<{ success: boolean; message: string }> {
    try {
      const stored = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse<Robot[]>(stored, []);
      
      // Remove duplicates and invalid robots
      const seenIds = new Set<string>();
      const uniqueRobots = robots.filter((robot: any) => {
        if (!robot || typeof robot !== 'object') return false;
        if (seenIds.has(robot.id)) return false;
        if (!robot.id || !robot.name || !robot.code) return false;
        
        seenIds.add(robot.id);
        return true;
      });
      
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(uniqueRobots));
      
      return { 
        success: true, 
        message: `Mock database optimized: ${robots.length - uniqueRobots.length} invalid records removed.` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Mock database optimization failed: ${(error as Error).message}` 
      };
    }
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Export singleton instance
export const modularSupabase = new ModularSupabase(
  databaseCore,
  connectionManager,
  cacheLayer,
  retryLogic,
  analyticsCollector
);

// Export type for backward compatibility
export type { ModularSupabase as SupabaseService };