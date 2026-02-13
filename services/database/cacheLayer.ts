/**
 * Database Cache Layer
 * Handles caching operations, cache invalidation, and performance optimization
 */

import { Robot } from '../../types';
import { LRUCache } from './cache';
import { handleError } from '../../utils/errorHandler';
import { TIME_CONSTANTS } from '../../constants/config';
import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('CacheLayer');

export interface CacheLayerInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void>;
  delete(key: string): Promise<boolean>;
  invalidateByTags(tags: string[]): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
  clear(): Promise<void>;
  getCacheStats(): Promise<any>;
  preloadCommonData(): Promise<void>;
  getCachedRobotsList(): Promise<Robot[] | null>;
  cacheRobotsList(robots: Robot[]): Promise<void>;
  getCachedRobot(id: string): Promise<Robot | null>;
  cacheRobot(robot: Robot): Promise<void>;
  invalidateRobotCaches(id?: string): Promise<void>;
}

export class CacheLayer implements CacheLayerInterface {
  private cache = new LRUCache<any>(TIME_CONSTANTS.CACHE_MEDIUM_TTL, 1000);
  private defaultTtl = TIME_CONSTANTS.CACHE_MEDIUM_TTL; // 15 minutes

  async get<T>(key: string): Promise<T | null> {
    try {
      return this.cache.get(key) || null;
    } catch (error: unknown) {
      handleError(error instanceof Error ? error : new Error(String(error)), 'cache.get', 'cacheLayer');
      return null;
    }
  }

  async set<T>(key: string, value: T, _ttl?: number, _tags?: string[]): Promise<void> {
    try {
      this.cache.set(key, value);
      // Tags functionality not implemented in simple LRU cache
    } catch (error: unknown) {
      handleError(error instanceof Error ? error : new Error(String(error)), 'cache.set', 'cacheLayer');
      // Don't throw - cache failures shouldn't break the main flow
    }
  }

  async invalidateByTags(_tags: string[]): Promise<void> {
    try {
      // Tags functionality not implemented in simple LRU cache - clear all for now
      this.cache.clear();
    } catch (error: unknown) {
      handleError(error instanceof Error ? error : new Error(String(error)), 'cache.invalidateByTags', 'cacheLayer');
      // Don't throw - cache failures shouldn't break the main flow
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Since getAllKeys is not available, use tag-based invalidation instead
      // Convert pattern to appropriate tag
      const tag = pattern.replace(/[^a-zA-Z0-9]/g, '_');
      await this.invalidateByTags([tag]);
    } catch (error: unknown) {
      handleError(error instanceof Error ? error : new Error(String(error)), 'cache.invalidatePattern', 'cacheLayer');
      // Don't throw - cache failures shouldn't break the main flow
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      return await this.cache.delete(key);
    } catch (error: unknown) {
      handleError(error instanceof Error ? error : new Error(String(error)), 'cache.delete', 'cacheLayer');
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.cache.clear();
    } catch (error: unknown) {
      handleError(error instanceof Error ? error : new Error(String(error)), 'cache.clear', 'cacheLayer');
      // Don't throw - cache failures shouldn't break the main flow
    }
  }

  async getCacheStats(): Promise<any> {
    // Since getStats is not available, return basic metrics
    // In a real implementation, we would track metrics internally
    return {
      size: 0, // Would be tracked internally
      hitRate: 0, // Would be calculated from hits/misses
      error: 'Basic stats - detailed stats not available'
    };
  }

  async preloadCommonData(): Promise<void> {
    try {
      // Preload commonly accessed data
      // This would typically include recent robots, user preferences, etc.
      const commonKeys = [
        'robots_list_recent',
        'user_preferences',
        'system_status'
      ];

      for (const key of commonKeys) {
        // Check if data exists and is fresh
        const cached = await this.get(key);
        if (!cached) {
          // Trigger background refresh through appropriate service
          // This would be implemented with proper service integration
          logger.debug('Preloading cache', { key });
        }
      }
    } catch (error: unknown) {
      handleError(error instanceof Error ? error : new Error(String(error)), 'cache.preloadCommonData', 'cacheLayer');
      // Don't throw - preloading failures shouldn't break the main flow
    }
  }

  // Cache-specific helpers for robot operations
  async getCachedRobotsList(): Promise<Robot[] | null> {
    return await this.get<Robot[]>('robots_list_all');
  }

  async cacheRobotsList(robots: Robot[]): Promise<void> {
    await this.set('robots_list_all', robots, this.defaultTtl, ['robots', 'list']);
  }

  async getCachedRobot(id: string): Promise<Robot | null> {
    return await this.get<Robot>(`robot_${id}`);
  }

  async cacheRobot(robot: Robot): Promise<void> {
    await this.set(`robot_${robot.id}`, robot, this.defaultTtl, ['robots', 'single']);
  }

  async invalidateRobotCaches(id?: string): Promise<void> {
    if (id) {
      // Invalidate specific robot cache
      await this.cache.delete(`robot_${id}`);
      // Invalidate list caches that might contain this robot
      await this.invalidateByTags(['robots', 'list']);
    } else {
      // Invalidate all robot-related caches
      await this.invalidateByTags(['robots']);
    }
  }

  async getCachedUserRobots(userId: string): Promise<Robot[] | null> {
    return await this.get<Robot[]>(`user_robots_${userId}`);
  }

  async cacheUserRobots(userId: string, robots: Robot[]): Promise<void> {
    await this.set(`user_robots_${userId}`, robots, this.defaultTtl, ['robots', 'user']);
  }

  // Advanced caching strategies
  async cacheWithSmartInvalidation<T>(
    key: string, 
    value: T, 
    ttl?: number, 
    tags?: string[],
    dependencies?: string[]
  ): Promise<void> {
    const effectiveTtl = ttl || this.defaultTtl;
    await this.set(key, value, effectiveTtl, tags);
    
    // Store dependency information for smart invalidation
    if (dependencies && dependencies.length > 0) {
      const depKey = `${key}_dependencies`;
      await this.set(depKey, dependencies, effectiveTtl * 2, ['dependencies']);
      
      // Also tag with dependency names for easier invalidation
      const dependencyTags = dependencies.map(dep => `dependency_${dep}`);
      await this.set(key, value, effectiveTtl, [...(tags || []), ...dependencyTags]);
    }
  }

  async smartInvalidate(dependency: string): Promise<void> {
    try {
      // Since getAllKeys is not available, use tag-based invalidation
      // This is a simplified version that would work with the available API
      await this.invalidateByTags([`dependency_${dependency}`]);
    } catch (error: unknown) {
      handleError(error instanceof Error ? error : new Error(String(error)), 'cache.smartInvalidate', 'cacheLayer');
    }
  }

  // Performance optimization methods
  async warmupCacheForUser(userId: string): Promise<void> {
    try {
      // Warmup common user-specific caches
      const warmupOperations = [
        this.get(`user_robots_${userId}`),
        this.get('user_preferences'),
        this.get('system_status')
      ];

      await Promise.allSettled(warmupOperations);
    } catch (error: unknown) {
      handleError(error instanceof Error ? error : new Error(String(error)), 'cache.warmupCacheForUser', 'cacheLayer');
    }
  }

  async batchInvalidate(keys: string[]): Promise<void> {
    try {
      await Promise.allSettled(
        keys.map(key => this.cache.delete(key))
      );
    } catch (error: unknown) {
      handleError(error instanceof Error ? error : new Error(String(error)), 'cache.batchInvalidate', 'cacheLayer');
    }
  }
}

// Export singleton instance
export const cacheLayer = new CacheLayer();