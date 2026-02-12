/**
 * Mock Database Service for QuantForge AI
 * Provides Supabase-compatible database interface using localStorage
 */

import { handleErrorCompat as handleError } from '../../utils/errorManager';
import { globalCache } from '../unifiedCacheManager';
import { Robot } from '../../types';
import { STORAGE_KEYS, safeParse, trySaveToStorage, generateUUID } from './storage';
import { createSafeSQLPattern, ReDoSError } from '../../utils/safeRegex';
import { getErrorMessage } from '../../utils/errorHandler';
import { RETRY_CONFIGS, CACHE_SIZES } from '../../constants/modularConfig';
import { CACHE_TTLS } from '../constants';

// Database configurations - using modular config
export const DB_CONFIG = {
  CACHE_TTL: CACHE_TTLS.FIFTEEN_MINUTES,
  CACHE_SIZE: CACHE_SIZES.ENTRIES.MEDIUM,
  RETRY_CONFIG: {
    maxRetries: RETRY_CONFIGS.STANDARD.MAX_ATTEMPTS,
    retryDelay: RETRY_CONFIGS.STANDARD.BASE_DELAY_MS,
    backoffMultiplier: RETRY_CONFIGS.STANDARD.BACKOFF_MULTIPLIER,
    maxDelay: RETRY_CONFIGS.STANDARD.MAX_DELAY_MS,
  }
};

// Storage operations
const getStoredRobots = (): Robot[] => {
  const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
  // Filter out soft-deleted records by default
  return robots.filter((r: Robot) => !r.deleted_at);
};

const saveStoredRobots = (robots: Robot[]) => {
  trySaveToStorage(STORAGE_KEYS.ROBOTS, JSON.stringify(robots));
  // Invalidate cache when data changes
  globalCache.delete('robots');
  globalCache.delete('robots_paginated');
};

// Mock database implementation
export const mockDB = {
  // Robot operations
  from: (table: string) => {
    if (table !== 'robots') {
      throw new Error(`Table '${table}' not supported in mock mode`);
    }

    return {
      select: async (columns?: string) => {
        try {
          const robots = getStoredRobots();
          
          // Cache management
          const cacheKey = columns ? `robots_${columns}` : 'robots';
          const cached = globalCache.get(cacheKey);
          if (cached) {
            return { data: cached, error: null };
          }
          
          globalCache.set(cacheKey, robots, DB_CONFIG.CACHE_TTL, ['robots']);
          return { data: robots, error: null };
        } catch (error: unknown) {
          handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.operation');
          return { data: null, error };
        }
      },

      insert: async (data: Partial<Robot> | Partial<Robot>[]) => {
        try {
          const robots = getStoredRobots();
          const newRobots = Array.isArray(data) ? data : [data];
          
          const insertedRobots = newRobots.map(robot => {
            const now = new Date().toISOString();
            return {
              ...robot,
              id: generateUUID(),
              user_id: 'mock_user',
              created_at: now,
              updated_at: now,
            } as Robot;
          });

          const updatedRobots = [...robots, ...insertedRobots];
          saveStoredRobots(updatedRobots);

          return { data: insertedRobots, error: null };
        } catch (error: unknown) {
          handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.operation');
          return { data: null, error };
        }
      },

      update: async (data: Partial<Robot>) => {
        try {
          const robots = getStoredRobots();
          const updatedRobots = robots.map(robot => 
            robot.id === data.id ? { ...robot, ...data, updated_at: new Date().toISOString() } : robot
          );
          
          saveStoredRobots(updatedRobots);
          const updatedRobot = updatedRobots.find(r => r.id === data.id);
          
          return { data: updatedRobot || null, error: null };
        } catch (error: unknown) {
          handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.operation');
          return { data: null, error };
        }
      },

      delete: async () => {
        // This is a simplified delete - in real implementation would handle filters
        return { data: null, error: { message: 'Delete with filters not implemented in mock' } };
      },

      eq: (column: string, value: string) => ({
        select: async () => {
          try {
            const robots = getStoredRobots();
            const filtered = robots.filter(robot => robot[column as keyof Robot] === value);
            
            const cacheKey = `robots_${column}_${value}`;
            globalCache.set(cacheKey, filtered, DB_CONFIG.CACHE_TTL, ['robots', 'search']);
            
            return { data: filtered, error: null };
} catch (error: unknown) {
          handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.operation');
          return { data: null, error };
        }
        },

        delete: async () => {
          try {
            // Use soft delete instead of hard delete for data integrity
            const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
            const updatedRobots = robots.map((robot: Robot) => 
              robot[column as keyof Robot] === value 
                ? { ...robot, deleted_at: new Date().toISOString() }
                : robot
            );
            
            saveStoredRobots(updatedRobots);
            return { data: null, error: null };
          } catch (error: unknown) {
            handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.operation');
            return { data: null, error };
          }
        }
      }),

      // Advanced query methods
      ilike: (column: string, pattern: string) => ({
        select: async () => {
          try {
            const robots = getStoredRobots();
            // Use safe regex to prevent ReDoS attacks
            const regex = createSafeSQLPattern(pattern);
            const filtered = robots.filter(robot => 
              regex.test(String(robot[column as keyof Robot]))
            );
            
            return { data: filtered, error: null };
          } catch (error: unknown) {
            // Handle ReDoS errors gracefully
            if (error instanceof ReDoSError) {
              console.warn('Unsafe pattern detected in ilike:', error.message);
              return { data: [], error: { message: `Invalid search pattern: ${error.message}` } };
            }
            handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.operation');
            return { data: null, error };
          }
        }
      }),

      order: (column: string, options?: { ascending?: boolean }) => {
        const ascending = options?.ascending ?? true;
        return {
          select: async () => {
            try {
              const robots = getStoredRobots();
              const sorted = [...robots].sort((a, b) => {
                const aVal = a[column as keyof Robot];
                const bVal = b[column as keyof Robot];
                
                if (aVal === undefined || aVal === null) return 1;
                if (bVal === undefined || bVal === null) return -1;
                
                const comparison = String(aVal).localeCompare(String(bVal));
                return ascending ? comparison : -comparison;
              });
              
              return { data: sorted, error: null };
} catch (error: unknown) {
          handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.operation');
          return { data: null, error };
        }
          }
        };
      },

      range: (from: number, to: number) => ({
        select: async () => {
          try {
            const robots = getStoredRobots();
            const paginated = robots.slice(from, to + 1);

            const cacheKey = `robots_range_${from}_${to}`;
            globalCache.set(cacheKey, paginated, DB_CONFIG.CACHE_TTL, ['robots', 'paginated']);

            return { data: paginated, error: null };
} catch (error: unknown) {
          handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.operation');
          return { data: null, error };
        }
        }
      }),

      gte: (column: string, value: string) => ({
        select: async () => {
          try {
            const robots = getStoredRobots();
            const filtered = robots.filter(robot =>
              String(robot[column as keyof Robot]) >= value
            );

            return { data: filtered, error: null };
} catch (error: unknown) {
          handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.operation');
          return { data: null, error };
        }
        }
      }),

      upsert: async (data: Partial<Robot> | Partial<Robot>[]) => {
        try {
          const robots = getStoredRobots();
          const dataArray = Array.isArray(data) ? data : [data];

          const updatedRobots = [...robots];

          for (const item of dataArray) {
            const existingIndex = updatedRobots.findIndex(r => r.id === item.id);
            if (existingIndex >= 0) {
              updatedRobots[existingIndex] = { ...updatedRobots[existingIndex], ...item, updated_at: new Date().toISOString() } as Robot;
            } else {
              updatedRobots.push({ ...item, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Robot);
            }
          }

          saveStoredRobots(updatedRobots);
          return { data: dataArray, error: null };
        } catch (error: unknown) {
          handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.operation');
          return { data: null, error };
        }
      }
    };
  }
};

// Database utility functions
export const getRobotsPaginated = async (page: number = 1, pageSize: number = 10) => {
  try {
    const cacheKey = `robots_paginated_${page}_${pageSize}`;
    const cached = globalCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const robots = getStoredRobots();
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRobots = robots.slice(startIndex, endIndex);
    
    const result = {
      data: paginatedRobots,
      count: robots.length,
      page,
      pageSize,
      totalPages: Math.ceil(robots.length / pageSize)
    };
    
    globalCache.set(cacheKey, result, DB_CONFIG.CACHE_TTL, ['robots', 'paginated']);
    return result;
  } catch (error: unknown) {
    handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.operation');
    return { data: null, error };
  }
};

export const searchRobots = async (searchTerm: string) => {
  try {
    const robots = getStoredRobots();
    // Use safe regex to prevent ReDoS attacks
    const regex = createSafeSQLPattern(searchTerm);
    const filtered = robots.filter(robot =>
      regex.test(robot.name) ||
      regex.test(robot.description) ||
      regex.test(robot.strategy_type)
    );

    return { data: filtered, error: null };
  } catch (error: unknown) {
    // Handle ReDoS errors gracefully
    if (error instanceof ReDoSError) {
      console.warn('Unsafe search pattern detected:', error.message);
      return { data: [], error: { message: `Invalid search pattern: ${error.message}` } };
    }
    handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.search');
    return { data: [], error };
  }
};

// Legacy compatibility methods
export const getRobots = async () => {
  return mockDB.from('robots').select();
};

export const saveRobot = async (robot: Partial<Robot>) => {
  return mockDB.from('robots').insert(robot);
};

export const updateRobot = async (id: string, updates: Partial<Robot>) => {
  return mockDB.from('robots').update({ id, ...updates });
};

export const deleteRobot = async (id: string) => {
  // Use soft delete for data integrity
  const robots = safeParse(localStorage.getItem(STORAGE_KEYS.ROBOTS), []);
  const updatedRobots = robots.map((robot: Robot) => 
    robot.id === id 
      ? { ...robot, deleted_at: new Date().toISOString() }
      : robot
  );
  
  try {
    saveStoredRobots(updatedRobots);
    return { data: null, error: null };
  } catch (error: unknown) {
    handleError(error instanceof Error ? error : new Error(getErrorMessage(error)), 'database.delete');
    return { data: null, error };
  }
};

export const duplicateRobot = async (id: string) => {
  // First get the robot to duplicate
  const { data: robot } = await mockDB.from('robots').eq('id', id).select();
  
  if (!robot || robot.length === 0) {
    return { data: null, error: { message: 'Robot not found' } };
  }
  
  const original = robot[0];
  if (!original) {
    return { data: null, error: { message: 'Robot not found' } };
  }
  const duplicate = {
    ...original,
    id: generateUUID(),
    name: `${original.name} (Copy)`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  return mockDB.from('robots').insert(duplicate);
};