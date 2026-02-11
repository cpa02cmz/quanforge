/**
 * Modular Supabase Service
 * Consolidates the 5 service modules into a unified interface that matches the original supabase.ts API
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Robot, UserSession } from '../../types';
import type { APIResponse } from '../../types/common';
import { handleError } from '../../utils/errorHandler';
import { settingsManager } from '../settingsManager';
import { securityManager } from '../securityManager';
import { databaseCore, DatabaseCoreInterface } from './coreOperations';
import { connectionManager, ConnectionManagerInterface } from './simpleConnectionManager';
import { cacheLayer, CacheLayerInterface } from './cacheLayer';
import { retryLogic, RetryLogicInterface } from './retryLogic';
import { analyticsCollector, AnalyticsCollectorInterface } from './analyticsCollector';
import { STORAGE_KEYS } from '../../constants/modularConfig';

// Mock session storage constants - using Flexy's modular config
const ROBOTS_KEY = STORAGE_KEYS.ROBOTS;

// Helper for safe JSON parsing
const safeParse = <T = unknown>(data: string | null, fallback: T): T => {
  if (!data) return fallback;
  try {
    const parsed = securityManager.safeJSONParse(data);
    return (parsed as T) || fallback;
  } catch (_e) {
    return fallback;
  }
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
  signInWithPassword: ({ email, password }: { email: string; password: string }) => Promise<{ data: { session: UserSession | null; user: UserSession['user'] | null }; error: any }>;
  signUp: ({ email, password }: { email: string; password: string }) => Promise<{ data: { session: UserSession | null; user: UserSession['user'] | null }; error: any }>;
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
      handleError(error instanceof Error ? error : new Error(String(error)), 'getSession', 'modularSupabase');
      return createErrorResponse(
        error instanceof Error ? error.message : 'Session retrieval failed',
        error instanceof Error && 'code' in error ? String(error.code) : undefined
      );
    }
  }

  onAuthStateChange(callback: (event: string, session: UserSession | null) => void): { data: { subscription: { unsubscribe: () => void } } } {
    return this.connMgr.onAuthStateChange(callback);
  }

  async signInWithPassword({ email, password }: { email: string; password: string }): Promise<{ data: { session: UserSession | null; user: UserSession['user'] | null }; error: any }> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        // Mock auth implementation
        const session: UserSession = {
          user: {
            id: this.generateUUID(),
            email: email,
          },
          access_token: this.generateUUID(),
          refresh_token: this.generateUUID(),
          expires_in: 3600,
          token_type: 'bearer'
        };
        
        // Store mock session
        localStorage.setItem('mock_session', JSON.stringify(session));
        
        this.analytics.recordOperation('signInWithPassword-mock', endTimer());
        return { data: { session, user: session.user }, error: null };
      }

      // Real Supabase auth (not implemented in current modular system)
      const client = await this.connMgr.getClient();
      const result = await client.auth.signInWithPassword({ email, password });
      
      this.analytics.recordOperation('signInWithPassword', endTimer());
      return result as any;
    } catch (error: unknown) {
      this.analytics.recordOperation('signInWithPassword', endTimer(), error);
      handleError(error instanceof Error ? error : new Error(String(error)), 'signInWithPassword', 'modularSupabase');
      return { 
        data: { session: null, user: null }, 
        error: error instanceof Error ? error.message : 'Sign in failed' 
      };
    }
  }

  async signUp({ email, password }: { email: string; password: string }): Promise<{ data: { session: UserSession | null; user: UserSession['user'] | null }; error: any }> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        // Mock auth implementation - same as signIn for demo
        const session: UserSession = {
          user: {
            id: this.generateUUID(),
            email: email,
          },
          access_token: this.generateUUID(),
          refresh_token: this.generateUUID(),
          expires_in: 3600,
          token_type: 'bearer'
        };
        
        // Store mock session
        localStorage.setItem('mock_session', JSON.stringify(session));
        
        this.analytics.recordOperation('signUp-mock', endTimer());
        return { data: { session, user: session.user }, error: null };
      }

      // Real Supabase auth (not implemented in current modular system)
      const client = await this.connMgr.getClient();
      const result = await client.auth.signUp({ email, password });
      
      this.analytics.recordOperation('signUp', endTimer());
      return result as any;
    } catch (error: unknown) {
      this.analytics.recordOperation('signUp', endTimer(), error);
      handleError(error instanceof Error ? error : new Error(String(error)), 'signUp', 'modularSupabase');
      return { 
        data: { session: null, user: null }, 
        error: error instanceof Error ? error.message : 'Sign up failed' 
      };
    }
  }

  async signOut(): Promise<APIResponse<null>> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const result = await this.connMgr.signOut();
      // Clear all caches on sign out
      await this.cache.clear();
      this.analytics.recordOperation('signOut', endTimer());
      if (result.error) {
        return createErrorResponse(result.error.message, result.error.code);
      }
      return createSuccessResponse(null);
    } catch (error: unknown) {
      this.analytics.recordOperation('signOut', endTimer(), error);
      handleError(error instanceof Error ? error : new Error(String(error)), 'signOut', 'modularSupabase');
      return createErrorResponse(
        error instanceof Error ? error.message : 'Sign out failed',
        error instanceof Error && 'code' in error ? String(error.code) : undefined
      );
    }
  }

  // Robot operations with caching and retry logic
  async getRobots(): Promise<APIResponse<Robot[]>> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return await this.getMockRobots(endTimer);
      }

      // Try cache first
      const cached = await this.cache.getCachedRobotsList();
      if (cached) {
        this.analytics.recordOperation('getRobots-cache', endTimer());
        return createSuccessResponse(cached);
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
      if (result.error) {
        return createErrorResponse(result.error.message, result.error.code);
      }
      return createSuccessResponse(result.data || []);
    } catch (error: unknown) {
      this.analytics.recordOperation('getRobots', endTimer(), error);
      handleError(error instanceof Error ? error : new Error(String(error)), 'getRobots', 'modularSupabase');
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get robots',
        error instanceof Error && 'code' in error ? String(error.code) : undefined
      );
    }
  }

  async getRobotById(id: string): Promise<APIResponse<Robot>> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return await this.getMockRobotById(id, endTimer);
      }

      // Try cache first
      const cached = await this.cache.getCachedRobot(id);
      if (cached) {
        this.analytics.recordOperation('getRobotById-cache', endTimer());
        return createSuccessResponse(cached);
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
      if (result.error) {
        return createErrorResponse(result.error.message, result.error.code);
      }
      if (!result.data) {
        return createErrorResponse('Robot not found', 404);
      }
      return createSuccessResponse(result.data);
    } catch (error: unknown) {
      this.analytics.recordOperation('getRobotById', endTimer(), error);
      handleError(error instanceof Error ? error : new Error(String(error)), 'getRobotById', 'modularSupabase');
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get robot',
        error instanceof Error && 'code' in error ? String(error.code) : undefined
      );
    }
  }

  async getRobotsByIds(ids: string[]): Promise<APIResponse<Robot[]>> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return await this.getMockRobotsByIds(ids, endTimer);
      }

      // For now, implement as multiple single calls - could be optimized
      const robots: Robot[] = [];
      let error: any = null;

      for (const id of ids) {
        const result = await this.getRobotById(id);
        if (result.success && result.data) {
          robots.push(result.data);
        }
        if (!result.success && !error) {
          error = result.error;
        }
      }

      this.analytics.recordOperation('getRobotsByIds', endTimer());
      if (error) {
        return createErrorResponse(error);
      }
      return createSuccessResponse(robots);
    } catch (error: unknown) {
      this.analytics.recordOperation('getRobotsByIds', endTimer(), error);
      handleError(error instanceof Error ? error : new Error(String(error)), 'getRobotsByIds', 'modularSupabase');
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get robots by IDs',
        error instanceof Error && 'code' in error ? String(error.code) : undefined
      );
    }
  }

  async saveRobot(robot: Partial<Robot>): Promise<APIResponse<Robot[]>> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      // Security validation
      if (!robot || typeof robot !== 'object') {
        const duration = endTimer();
        this.analytics.recordOperation('saveRobot', duration);
        return createErrorResponse('Invalid robot data structure', 'INVALID_DATA');
      }

      // Rate limiting check
      if (robot.user_id) {
        const allowed = securityManager.checkRateLimit(robot.user_id);
        if (!allowed) {
          const duration = endTimer();
          this.analytics.recordOperation('saveRobot', duration);
          return createErrorResponse('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
        }
      }

      const sanitizedRobot = robot;

      if (settings?.mode === 'mock') {
        return await this.saveMockRobot(sanitizedRobot, endTimer);
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
      if (result.error) {
        return createErrorResponse(result.error.message, result.error.code);
      }
      return createSuccessResponse(result.data || []);
    } catch (error: unknown) {
      this.analytics.recordOperation('saveRobot', endTimer(), error);
      handleError(error instanceof Error ? error : new Error(String(error)), 'saveRobot', 'modularSupabase');
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to save robot',
        error instanceof Error && 'code' in error ? String(error.code) : undefined
      );
    }
  }

  async updateRobot(id: string, updates: Partial<Robot>): Promise<APIResponse<Robot[]>> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return await this.updateMockRobot(id, updates, endTimer);
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
      if (result.error) {
        return createErrorResponse(result.error.message, result.error.code);
      }
      return createSuccessResponse(result.data || []);
    } catch (error: unknown) {
      this.analytics.recordOperation('updateRobot', endTimer(), error);
      handleError(error instanceof Error ? error : new Error(String(error)), 'updateRobot', 'modularSupabase');
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to update robot',
        error instanceof Error && 'code' in error ? String(error.code) : undefined
      );
    }
  }

  async deleteRobot(id: string): Promise<APIResponse<boolean>> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return await this.deleteMockRobot(id, endTimer);
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
      if (result.error) {
        return createErrorResponse(result.error.message, result.error.code);
      }
      return createSuccessResponse(Boolean(result.data));
    } catch (error: unknown) {
      this.analytics.recordOperation('deleteRobot', endTimer(), error);
      handleError(error instanceof Error ? error : new Error(String(error)), 'deleteRobot', 'modularSupabase');
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to delete robot',
        error instanceof Error && 'code' in error ? String(error.code) : undefined
      );
    }
  }

  async batchUpdateRobots(updates: Array<{ id: string; data: Partial<Robot> }>): Promise<APIResponse<{ successful: number; failed: number; errors?: string[] }>> {
    const endTimer = this.analytics.startPerformanceTimer();
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings?.mode === 'mock') {
        return await this.batchUpdateMockRobots(updates, endTimer);
      }

      // Batch update with retry
      const result = await this.retry.withRetry(async () => {
        const client = await this.connMgr.getClient();
        return await this.dbCore.batchUpdateRobots(client, updates);
      }, 'batchUpdateRobots');

      // Invalidate all robot caches after batch update
      await this.cache.invalidateRobotCaches();

      this.analytics.recordOperation('batchUpdateRobots', endTimer());
      return createSuccessResponse({
        successful: result.success,
        failed: result.failed,
        errors: result.errors
      });
    } catch (error: unknown) {
      this.analytics.recordOperation('batchUpdateRobots', endTimer(), error);
      handleError(error instanceof Error ? error : new Error(String(error)), 'batchUpdateRobots', 'modularSupabase');
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to batch update robots',
        error instanceof Error && 'code' in error ? String(error.code) : undefined
      );
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
    } catch (error: unknown) {
      handleError(error instanceof Error ? error : new Error(String(error)), 'optimizeDatabase', 'modularSupabase');
      return { 
        success: false, 
        message: `Database optimization failed: ${error instanceof Error ? error.message : String(error)}` 
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
  private async getMockRobots(endTimer: () => number): Promise<APIResponse<Robot[]>> {
    const stored = localStorage.getItem(ROBOTS_KEY);
    const robots = safeParse(stored, []);
    this.analytics.recordOperation('getRobots-mock', endTimer());
    return createSuccessResponse(robots);
  }

  private async getMockRobotById(id: string, endTimer: () => number): Promise<APIResponse<Robot>> {
    const stored = localStorage.getItem(ROBOTS_KEY);
    const robots = safeParse(stored, []);
    const robot = robots.find((r: Robot) => r.id === id);
    this.analytics.recordOperation('getRobotById-mock', endTimer());
    if (!robot) {
      return createErrorResponse('Robot not found', 404);
    }
    return createSuccessResponse(robot);
  }

  private async getMockRobotsByIds(ids: string[], endTimer: () => number): Promise<APIResponse<Robot[]>> {
    const stored = localStorage.getItem(ROBOTS_KEY);
    const robots = safeParse(stored, []);
    const filteredRobots = robots.filter((robot: Robot) => ids.includes(robot.id));
    this.analytics.recordOperation('getRobotsByIds-mock', endTimer());
    return createSuccessResponse(filteredRobots);
  }

  private async saveMockRobot(robot: Partial<Robot>, endTimer: () => number): Promise<APIResponse<Robot[]>> {
    try {
      const stored = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse<Robot[]>(stored, []);
      
      const newRobot: Robot = { 
        ...robot, 
        id: robot.id || this.generateUUID(), 
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Robot;
      robots.unshift(newRobot);
      
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
      this.analytics.recordOperation('saveRobot-mock', endTimer());
      
      return createSuccessResponse([newRobot]);
    } catch (e: unknown) {
      this.analytics.recordOperation('saveRobot-mock', endTimer(), e);
      return createErrorResponse(
        e instanceof Error ? e.message : 'Failed to save robot',
        e instanceof Error && 'code' in e ? String(e.code) : undefined
      );
    }
  }

  private async updateMockRobot(id: string, updates: Partial<Robot>, endTimer: () => number): Promise<APIResponse<Robot[]>> {
    try {
      const stored = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse<Robot[]>(stored, []);
      
const index = robots.findIndex((r: Robot) => r.id === id);
      if (index === -1) {
        return createErrorResponse('Robot not found', 'NOT_FOUND');
      }
      
      const existingRobot = robots[index];
      if (!existingRobot) {
        return createErrorResponse('Robot not found', 'NOT_FOUND');
      }
      
      const updatedRobot: Robot = { 
        ...existingRobot, 
        ...updates, 
        id: existingRobot.id, // Ensure id is preserved
        user_id: existingRobot.user_id, // Ensure user_id is preserved
        name: updates.name || existingRobot.name, // Ensure name is preserved
        description: updates.description || existingRobot.description, // Ensure description is preserved
        code: updates.code || existingRobot.code, // Ensure code is preserved
        strategy_type: updates.strategy_type || existingRobot.strategy_type, // Ensure strategy_type is preserved
        created_at: existingRobot.created_at, // Ensure created_at is preserved
        updated_at: new Date().toISOString() 
      };
      robots[index] = updatedRobot;
      
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));
      this.analytics.recordOperation('updateRobot-mock', endTimer());
      
      return createSuccessResponse([updatedRobot]);
    } catch (e: unknown) {
      this.analytics.recordOperation('updateRobot-mock', endTimer(), e);
      return createErrorResponse(
        e instanceof Error ? e.message : 'Failed to update robot',
        e instanceof Error && 'code' in e ? String(e.code) : undefined
      );
    }
  }

  private async deleteMockRobot(id: string, endTimer: () => number): Promise<APIResponse<boolean>> {
    try {
      const stored = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse<Robot[]>(stored, []);
      
      const filteredRobots = robots.filter((r: Robot) => r.id !== id);
      
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(filteredRobots));
      this.analytics.recordOperation('deleteRobot-mock', endTimer());
      
      return createSuccessResponse(true);
    } catch (e: unknown) {
      this.analytics.recordOperation('deleteRobot-mock', endTimer(), e);
      return createErrorResponse(
        (e as Error).message || 'Unknown error',
        (e as any).code
      );
    }
  }

  private async batchUpdateMockRobots(updates: Array<{ id: string; data: Partial<Robot> }>, endTimer: () => number): Promise<APIResponse<{ successful: number; failed: number; errors?: string[] }>> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const { id, data } of updates) {
      try {
        const result = await this.updateMockRobot(id, data, () => 0);
        if (!result.success) {
          failedCount++;
          errors.push(`Failed to update robot ${id}: ${result.error}`);
        } else {
          successCount++;
        }
      } catch (error: unknown) {
        failedCount++;
        errors.push(`Error updating robot ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.analytics.recordOperation('batchUpdateRobots-mock', endTimer());
    
    return createSuccessResponse({
      successful: successCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined
    });
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
    } catch (error: unknown) {
      return { 
        success: false, 
        message: `Mock database optimization failed: ${error instanceof Error ? error.message : String(error)}` 
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