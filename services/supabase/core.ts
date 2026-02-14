/**
 * Core Supabase Service - Unified Database Operations
 * Consolidated from supabase.ts (1,583 lines) and related variants
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Robot, UserSession } from '../../types';
import { securityManager } from '../securityManager';
import { consolidatedCache } from '../consolidatedCacheManager';
import { createScopedLogger } from '../../utils/logger';
import { DATABASE, SERVICE_CACHE_CONFIG } from '../constants';
import { getErrorCode, getErrorMessage } from '../../utils/errorHandler';
import { STORAGE_KEYS, TOKEN_CONFIG } from '../../constants/modularConfig';

const logger = createScopedLogger('CoreSupabaseService');

// Enhanced connection retry configuration - using modular constants
const RETRY_CONFIG = {
  maxRetries: DATABASE.RETRY.MAX_ATTEMPTS,
  retryDelay: DATABASE.RETRY.BASE_DELAY_MS,
  backoffMultiplier: DATABASE.RETRY.BACKOFF_MULTIPLIER,
  maxDelay: DATABASE.RETRY.MAX_DELAY_MS,
  jitter: true,
};

// Cache configuration optimized for edge performance - using modular constants
const CACHE_CONFIG = {
  ttl: SERVICE_CACHE_CONFIG.SUPABASE_CORE.TTL_MS,
  maxSize: SERVICE_CACHE_CONFIG.SUPABASE_CORE.MAX_SIZE,
};

// Mock storage keys for fallback mode - using Flexy's modular config
const STORAGE_KEY = STORAGE_KEYS.SESSION;
const ROBOTS_KEY = STORAGE_KEYS.ROBOTS;

/**
 * Safe JSON parsing with security validation
 */
const safeParse = (data: string | null, fallback: any) => {
  if (!data) return fallback;
  try {
    return securityManager.safeJSONParse(data) || fallback;
  } catch (e) {
    logger.error("Failed to parse data from storage:", e);
    return fallback;
  }
};

/**
 * Safe localStorage storage with quota handling
 */
const trySaveToStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e: unknown) {
    const errorCode = getErrorCode(e);
    const errorMessage = getErrorMessage(e);
    if (
      errorMessage.includes('QuotaExceededError') || 
      errorMessage.includes('NS_ERROR_DOM_QUOTA_REACHED') ||
      errorCode === '22' ||
      errorCode === '1014'
    ) {
      logger.warn('Storage quota exceeded, attempting cleanup');
      try {
        // Try to clean up old data
        const keys = Object.keys(localStorage);
        const oldKeys = keys.filter(k => k.includes('old_') || k.includes('temp_'));
        oldKeys.forEach(k => localStorage.removeItem(k));
        // Retry save
        localStorage.setItem(key, value);
      } catch (cleanupError: unknown) {
        logger.error('Failed to cleanup and save to storage:', getErrorMessage(cleanupError));
      }
    }
  }
};

/**
 * Core Supabase Service Class
 * Provides unified database operations with edge optimization
 */
class CoreSupabaseService {
  private client: SupabaseClient | null = null;
  private isMockMode: boolean = false;
  private retryCount: number = 0;

  constructor() {
    this.initializeClient();
  }

  /**
   * Initialize Supabase client or mock mode
   */
  private initializeClient() {
    try {
      // Use import.meta.env for Vite environment variables
      const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'];
      const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'];

      if (!supabaseUrl || !supabaseAnonKey) {
        logger.log('Supabase credentials not found, using mock mode');
        this.isMockMode = true;
        return;
      }

      // Dynamic import to avoid SSR issues
      import('@supabase/supabase-js').then(({ createClient }) => {
        this.client = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
          global: {
            headers: {
              'X-Client-Info': 'quantforge-ai/1.0.0',
            },
          },
        });
      }).catch(error => {
        logger.error('Failed to initialize Supabase client:', error);
        this.isMockMode = true;
      });
    } catch (error: unknown) {
      logger.error('Error initializing Supabase service:', error instanceof Error ? error.message : String(error));
      this.isMockMode = true;
    }
  }

  /**
   * Check if service is in mock mode
   */
  get mockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Get current client (for advanced operations)
   */
  getClient(): SupabaseClient | null {
    return this.client;
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    this.retryCount = 0;

    while (this.retryCount <= RETRY_CONFIG.maxRetries) {
      try {
        return await operation();
      } catch (error: unknown) {
        this.retryCount++;

        if (this.retryCount > RETRY_CONFIG.maxRetries) {
          logger.error(`Operation ${operationName} failed after ${RETRY_CONFIG.maxRetries} retries:`, error);
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, this.retryCount - 1);
        const jitter = RETRY_CONFIG.jitter ? Math.random() * 0.1 * baseDelay : 0;
        const delay = Math.min(baseDelay + jitter, RETRY_CONFIG.maxDelay);

        logger.warn(`Operation ${operationName} failed, retry ${this.retryCount}/${RETRY_CONFIG.maxRetries} in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Operation ${operationName} failed after all retries`);
  }

  /**
   * Authentication Methods
   */

  async signIn(email: string, password: string): Promise<UserSession> {
    if (this.isMockMode) {
      const mockSession: UserSession = {
        user: { id: 'mock-user', email },
        access_token: 'mock-token',
        expires_in: TOKEN_CONFIG.EXPIRY.ACCESS_TOKEN_MS / 1000,
        refresh_token: 'mock-refresh',
        token_type: 'bearer'
      };
      trySaveToStorage(STORAGE_KEY, JSON.stringify(mockSession));
      return mockSession;
    }

    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Supabase client not initialized');

      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user || !data.session) throw new Error('Invalid sign in response');

      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
        },
        session: {
          access_token: data.session.access_token,
          expires_at: data.session.expires_at || 0,
        },
      };
    }, 'signIn');
  }

  async signUp(email: string, password: string): Promise<UserSession> {
    if (this.isMockMode) {
      const mockSession: UserSession = {
        user: { id: 'mock-user-' + Date.now(), email },
        access_token: 'mock-token',
        expires_in: TOKEN_CONFIG.EXPIRY.ACCESS_TOKEN_MS / 1000,
        refresh_token: 'mock-refresh',
        token_type: 'bearer'
      };
      trySaveToStorage(STORAGE_KEY, JSON.stringify(mockSession));
      return mockSession;
    }

    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Supabase client not initialized');

      const { data, error } = await this.client.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user || !data.session) throw new Error('Invalid sign up response');

      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
        },
        session: {
          access_token: data.session.access_token,
          expires_at: data.session.expires_at || 0,
        },
      };
    }, 'signUp');
  }

  async signOut(): Promise<void> {
    if (this.isMockMode) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ROBOTS_KEY);
      return;
    }

    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Supabase client not initialized');

      const { error } = await this.client.auth.signOut();
      if (error) throw error;
    }, 'signOut');
  }

  async getCurrentSession(): Promise<UserSession | null> {
    if (this.isMockMode) {
      const sessionData = localStorage.getItem(STORAGE_KEY);
      return sessionData ? safeParse(sessionData, null) : null;
    }

return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Supabase client not initialized');

      const { data: { session }, error } = await this.client.auth.getSession();
      if (error) throw error;
      if (!session) return null;

      return {
        user: {
          id: session.user.id,
          email: session.user.email || '',
        },
        access_token: session.access_token,
        expires_in: session.expires_at ? Math.floor((session.expires_at - Date.now()) / 1000) : TOKEN_CONFIG.EXPIRY.ACCESS_TOKEN_MS / 1000,
        refresh_token: session.refresh_token || '',
        token_type: 'bearer',
      };
    }, 'getCurrentSession');
  }

  /**
   * Robot CRUD Operations
   */

  async getRobots(userId?: string): Promise<Robot[]> {
    const cacheKey = `robots:${userId || 'all'}`;
    
    // Check cache first
    const cached = consolidatedCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.isMockMode) {
      const robotsData = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse(robotsData, []);
      const filtered = userId ? robots.filter((r: Robot) => r.user_id === userId) : robots;
      
      // Cache the result
      consolidatedCache.set(cacheKey, filtered, CACHE_CONFIG.ttl);
      return filtered;
    }

    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Supabase client not initialized');

      let query = this.client.from('robots').select('*').is('deleted_at', null);
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const robots = data || [];
      
      // Cache the result
      consolidatedCache.set(cacheKey, robots, CACHE_CONFIG.ttl);
      
      return robots;
    }, 'getRobots');
  }

  async getRobot(id: string): Promise<Robot | null> {
    const cacheKey = `robot:${id}`;
    
    // Check cache first
    const cached = consolidatedCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.isMockMode) {
      const robotsData = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse(robotsData, []);
      const robot = robots.find((r: Robot) => r.id === id) || null;
      
      if (robot) {
        consolidatedCache.set(cacheKey, robot, CACHE_CONFIG.ttl);
      }
      
      return robot;
    }

    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Supabase client not initialized');

      const { data, error } = await this.client
        .from('robots')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Record not found
        throw error;
      }

      if (data) {
        consolidatedCache.set(cacheKey, data, CACHE_CONFIG.ttl);
      }
      
      return data;
    }, 'getRobot');
  }

  async createRobot(robot: Omit<Robot, 'id' | 'created_at' | 'updated_at'>): Promise<Robot> {
    const newRobot: Omit<Robot, 'id'> = {
      ...robot,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMockMode) {
      const robotsData = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse(robotsData, []);
      const createdRobot: Robot = {
        ...newRobot,
        id: 'mock-robot-' + Date.now(),
      };
      robots.push(createdRobot);
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));

      // Invalidate cache
      consolidatedCache.delete(`robots:${robot.user_id || 'all'}`);
      consolidatedCache.delete(`robots:all`);

      return createdRobot;
    }

    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Supabase client not initialized');

      const { data, error } = await this.client
        .from('robots')
        .insert(newRobot)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create robot');

      // Invalidate cache
      consolidatedCache.delete(`robots:${robot.user_id || 'all'}`);
      consolidatedCache.delete(`robots:all`);

      return data;
    }, 'createRobot');
  }

  async updateRobot(id: string, updates: Partial<Omit<Robot, 'id' | 'created_at' | 'user_id'>>): Promise<Robot> {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (this.isMockMode) {
      const robotsData = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse(robotsData, []);
      const index = robots.findIndex((r: Robot) => r.id === id);
      
      if (index === -1) throw new Error('Robot not found');
      
      const updatedRobot = { ...robots[index], ...updateData };
      robots[index] = updatedRobot;
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(robots));

      // Update cache
      consolidatedCache.set(`robot:${id}`, updatedRobot, CACHE_CONFIG.ttl);
      consolidatedCache.delete(`robots:${updatedRobot.user_id || 'all'}`);
      consolidatedCache.delete(`robots:all`);

      return updatedRobot;
    }

    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Supabase client not initialized');

      const { data, error } = await this.client
        .from('robots')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Robot not found');

      // Update cache
      consolidatedCache.set(`robot:${id}`, data, CACHE_CONFIG.ttl);
      consolidatedCache.delete(`robots:${data.user_id || 'all'}`);
      consolidatedCache.delete(`robots:all`);

      return data;
    }, 'updateRobot');
  }

  async deleteRobot(id: string): Promise<void> {
    if (this.isMockMode) {
      const robotsData = localStorage.getItem(ROBOTS_KEY);
      const robots = safeParse(robotsData, []);
      const filteredRobots = robots.filter((r: Robot) => r.id !== id);
      trySaveToStorage(ROBOTS_KEY, JSON.stringify(filteredRobots));

      // Remove from cache
      consolidatedCache.delete(`robot:${id}`);
      // Invalidate all robots cache
      const keys = consolidatedCache.keys().filter(k => k.startsWith('robots:'));
      keys.forEach(k => consolidatedCache.delete(k));

      return;
    }

    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Supabase client not initialized');

      const { error } = await this.client
        .from('robots')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Remove from cache
      consolidatedCache.delete(`robot:${id}`);
      // Invalidate all robots cache
      const keys = consolidatedCache.keys().filter(k => k.startsWith('robots:'));
      keys.forEach(k => consolidatedCache.delete(k));

    }, 'deleteRobot');
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; mockMode: boolean }> {
    const start = Date.now();
    
    try {
      if (this.isMockMode) {
        return {
          status: 'healthy',
          latency: Date.now() - start,
          mockMode: true,
        };
      }

      await this.executeWithRetry(async () => {
        if (!this.client) throw new Error('Supabase client not initialized');
        
        // Simple health check - try to get session
        await this.client.auth.getSession();
      }, 'healthCheck');

      return {
        status: 'healthy',
        latency: Date.now() - start,
        mockMode: false,
      };
    } catch (_error: unknown) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        mockMode: this.isMockMode,
      };
    }
  }
}

// Export singleton instance
export const coreSupabase = new CoreSupabaseService();
export default coreSupabase;