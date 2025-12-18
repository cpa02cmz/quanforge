import { createScopedLogger } from '../utils/logger';
import { UnifiedCacheService, UnifiedCacheFactory } from './unifiedCacheService';
import { CACHE_CONFIGS, CacheUtils } from '../config/cache';

const logger = createScopedLogger('CacheMigration');

export interface LegacyCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  tags?: string[];
  priority?: string;
  compressed?: boolean;
  accessCount?: number;
  lastAccessed?: number;
}

export interface CacheMigrationOptions {
  preserveData?: boolean;
  validateDuringMigration?: boolean;
  batchSize?: number;
  progressCallback?: (progress: { current: number; total: number; cacheName: string }) => void;
}

export interface MigrationResult {
  cacheName: string;
  entriesMigrated: number;
  entriesFailed: number;
  dataSizeMigrated: number;
  duration: number;
  errors: string[];
}

/**
 * Cache Migration Utility
 * 
 * Provides utilities to migrate from existing cache implementations
 * to the new UnifiedCacheService with data preservation and validation.
 */
export class CacheMigrationHelper {
  /**
   * Migrate from EnhancedCache (gemini.ts) to UnifiedCacheService
   */
  static async migrateFromEnhancedCache(
    legacyCache: Map<string, any>,
    targetCacheName: string,
    options: CacheMigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      cacheName: targetCacheName,
      entriesMigrated: 0,
      entriesFailed: 0,
      dataSizeMigrated: 0,
      duration: 0,
      errors: []
    };

    try {
      const unifiedCache = UnifiedCacheFactory.getInstance(targetCacheName);
      const entries = Array.from(legacyCache.entries());
      const totalEntries = entries.length;
      
      logger.info(`Starting migration from EnhancedCache: ${totalEntries} entries`);

      const batchSize = options.batchSize || 100;
      
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        
        for (const [key, entry] of batch) {
          try {
            await this.migrateEnhancedCacheEntry(unifiedCache, key, entry, options);
            result.entriesMigrated++;
            result.dataSizeMigrated += this.estimateEntrySize(entry);
          } catch (error) {
            result.entriesFailed++;
            const errorMsg = `Failed to migrate entry ${key}: ${error}`;
            result.errors.push(errorMsg);
            logger.warn(errorMsg);
          }
        }

        if (options.progressCallback) {
          options.progressCallback({
            current: Math.min(i + batchSize, totalEntries),
            total: totalEntries,
            cacheName: targetCacheName
          });
        }
      }

      logger.info(`EnhancedCache migration completed: ${result.entriesMigrated}/${totalEntries} migrated`);

    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
      logger.error(`EnhancedCache migration failed`, error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Migrate from OptimizedCache to UnifiedCacheService
   */
  static async migrateFromOptimizedCache(
    optimizedCache: any, // OptimizedCache instance
    targetCacheName: string,
    options: CacheMigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      cacheName: targetCacheName,
      entriesMigrated: 0,
      entriesFailed: 0,
      dataSizeMigrated: 0,
      duration: 0,
      errors: []
    };

    try {
      const unifiedCache = UnifiedCacheFactory.getInstance(targetCacheName);
      
      // Access the internal cache map from OptimizedCache
      const legacyCache = optimizedCache.cache || new Map();
      const entries = Array.from(legacyCache.entries());
      const totalEntries = entries.length;
      
      logger.info(`Starting migration from OptimizedCache: ${totalEntries} entries`);

      for (let i = 0; i < entries.length; i += options.batchSize || 100) {
        const batch = entries.slice(i, i + (options.batchSize || 100));
        
        for (const [key, entry] of batch) {
          try {
            await this.migrateOptimizedCacheEntry(unifiedCache, key, entry as any, options);
            result.entriesMigrated++;
            result.dataSizeMigrated += this.estimateEntrySize(entry);
          } catch (error) {
            result.entriesFailed++;
            const errorMsg = `Failed to migrate entry ${key}: ${error}`;
            result.errors.push(errorMsg);
            logger.warn(errorMsg);
          }
        }

        if (options.progressCallback) {
          options.progressCallback({
            current: Math.min(i + (options.batchSize || 100), totalEntries),
            total: totalEntries,
            cacheName: targetCacheName
          });
        }
      }

      logger.info(`OptimizedCache migration completed: ${result.entriesMigrated}/${totalEntries} migrated`);

    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
      logger.error(`OptimizedCache migration failed`, error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Migrate from AdvancedCache to UnifiedCacheService
   */
  static async migrateFromAdvancedCache(
    advancedCache: any, // AdvancedCache instance
    targetCacheName: string,
    options: CacheMigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      cacheName: targetCacheName,
      entriesMigrated: 0,
      entriesFailed: 0,
      dataSizeMigrated: 0,
      duration: 0,
      errors: []
    };

    try {
      const unifiedCache = UnifiedCacheFactory.getInstance(targetCacheName);
      
      // Access the internal cache map from AdvancedCache
      const legacyCache = advancedCache.cache || new Map();
      const entries = Array.from(legacyCache.entries());
      const totalEntries = entries.length;
      
      logger.info(`Starting migration from AdvancedCache: ${totalEntries} entries`);

      for (let i = 0; i < entries.length; i += options.batchSize || 100) {
        const batch = entries.slice(i, i + (options.batchSize || 100));
        
        for (const [key, entry] of batch) {
          try {
            await this.migrateAdvancedCacheEntry(unifiedCache, key, entry as any, options);
            result.entriesMigrated++;
            result.dataSizeMigrated += this.estimateEntrySize(entry);
          } catch (error) {
            result.entriesFailed++;
            const errorMsg = `Failed to migrate entry ${key}: ${error}`;
            result.errors.push(errorMsg);
            logger.warn(errorMsg);
          }
        }

        if (options.progressCallback) {
          options.progressCallback({
            current: Math.min(i + (options.batchSize || 100), totalEntries),
            total: totalEntries,
            cacheName: targetCacheName
          });
        }
      }

      logger.info(`AdvancedCache migration completed: ${result.entriesMigrated}/${totalEntries} migrated`);

    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
      logger.error(`AdvancedCache migration failed`, error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Create adapter wrapper for legacy cache to maintain compatibility
   */
  static createLegacyAdapter(
    unifiedCache: UnifiedCacheService,
    legacyInterface: {
      get?(key: string): any;
      set?(key: string, value: any, options?: any): void;
      delete?(key: string): boolean;
      clear?(): void;
    } = {}
  ): any {
    return {
      get: async (key: string) => {
        if (legacyInterface.get) {
          try {
            const result = legacyInterface.get(key);
            if (result !== undefined) return result;
          } catch (error) {
            logger.warn(`Legacy get failed for ${key}, falling back to unified cache`);
          }
        }
        return unifiedCache.get(key);
      },

      set: async (key: string, value: any, options?: any) => {
        if (legacyInterface.set) {
          try {
            legacyInterface.set(key, value, options);
          } catch (error) {
            logger.warn(`Legacy set failed for ${key}, using unified cache only`);
          }
        }
        return unifiedCache.set(key, value, options);
      },

      delete: (key: string) => {
        if (legacyInterface.delete) {
          try {
            legacyInterface.delete(key);
          } catch (error) {
            logger.warn(`Legacy delete failed for ${key}, using unified cache only`);
          }
        }
        return unifiedCache.delete(key);
      },

      clear: () => {
        if (legacyInterface.clear) {
          try {
            legacyInterface.clear();
          } catch (error) {
            logger.warn(`Legacy clear failed, using unified cache only`);
          }
        }
        unifiedCache.clear();
      },

      // Unified cache specific methods
      getStats: () => unifiedCache.getStats(),
      invalidateByTags: (tags: string[]) => unifiedCache.invalidateByTags(tags),
      warmCache: (loaders: any[]) => unifiedCache.warmCache(loaders),
      destroy: () => unifiedCache.destroy()
    };
  }

  /**
   * Validate migration by comparing data integrity
   */
  static async validateMigration(
    legacyCache: Map<string, any> | any,
    unifiedCache: UnifiedCacheService,
    sampleSize: number = 100
  ): Promise<{
    totalChecked: number;
    passed: number;
    failed: number;
    issues: string[];
  }> {
    const result = {
      totalChecked: 0,
      passed: 0,
      failed: 0,
      issues: [] as string[]
    };

    const entries = Array.from((legacyCache as Map<string, any>).entries());
    const sample = entries.slice(0, Math.min(sampleSize, entries.length));

    for (const [key, legacyEntry] of sample) {
      result.totalChecked++;
      
      try {
        const unifiedData = await unifiedCache.get(key);
        
        if (unifiedData === null) {
          result.issues.push(`Missing entry in unified cache: ${key}`);
          result.failed++;
          continue;
        }

        // Compare data structure
        const legacyData = legacyEntry.data || legacyEntry;
        if (JSON.stringify(unifiedData) !== JSON.stringify(legacyData)) {
          result.issues.push(`Data mismatch for key: ${key}`);
          result.failed++;
        } else {
          result.passed++;
        }
        
      } catch (error) {
        result.issues.push(`Validation error for key ${key}: ${error}`);
        result.failed++;
      }
    }

    logger.info(`Migration validation completed: ${result.passed}/${result.totalChecked} passed`);
    return result;
  }

  /**
   * Batch migrate multiple caches
   */
  static async batchMigrate(
    migrations: Array<{
      name: string;
      source: any;
      type: 'enhanced' | 'optimized' | 'advanced';
      targetCacheName: string;
      options?: CacheMigrationOptions;
    }>
  ): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    logger.info(`Starting batch migration of ${migrations.length} caches`);

    for (const migration of migrations) {
      logger.info(`Migrating cache: ${migration.name}`);
      
      let result: MigrationResult;
      
      switch (migration.type) {
        case 'enhanced':
          result = await this.migrateFromEnhancedCache(
            migration.source,
            migration.targetCacheName,
            migration.options
          );
          break;
        case 'optimized':
          result = await this.migrateFromOptimizedCache(
            migration.source,
            migration.targetCacheName,
            migration.options
          );
          break;
        case 'advanced':
          result = await this.migrateFromAdvancedCache(
            migration.source,
            migration.targetCacheName,
            migration.options
          );
          break;
        default:
          result = {
            cacheName: migration.targetCacheName,
            entriesMigrated: 0,
            entriesFailed: 0,
            dataSizeMigrated: 0,
            duration: 0,
            errors: [`Unknown migration type: ${migration.type}`]
          };
      }
      
      results.push(result);
    }

    const totalMigrated = results.reduce((sum, r) => sum + r.entriesMigrated, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.entriesFailed, 0);
    
    logger.info(`Batch migration completed: ${totalMigrated} migrated, ${totalFailed} failed`);
    
    return results;
  }

  // Private helper methods

  private static async migrateEnhancedCacheEntry(
    unifiedCache: UnifiedCacheService,
    key: string,
    entry: any,
    options: CacheMigrationOptions
  ): Promise<void> {
    const cacheEntry = entry as LegacyCacheEntry;
    
    const unifiedOptions = {
      ttl: cacheEntry.ttl,
      tags: cacheEntry.tags || [],
      priority: (cacheEntry.priority as any) || 'normal',
      compress: cacheEntry.compressed
    };

    await unifiedCache.set(key, cacheEntry.data, unifiedOptions);
  }

  private static async migrateOptimizedCacheEntry(
    unifiedCache: UnifiedCacheService,
    key: string,
    entry: any,
    options: CacheMigrationOptions
  ): Promise<void> {
    const cacheEntry = entry as LegacyCacheEntry;
    
    const unifiedOptions = {
      ttl: cacheEntry.ttl,
      tags: cacheEntry.tags || [],
      priority: (cacheEntry.priority as any) || 'normal',
      compress: cacheEntry.compressed
    };

    await unifiedCache.set(key, cacheEntry.data, unifiedOptions);
  }

  private static async migrateAdvancedCacheEntry(
    unifiedCache: UnifiedCacheService,
    key: string,
    entry: any,
    options: CacheMigrationOptions
  ): Promise<void> {
    const cacheEntry = entry as LegacyCacheEntry;
    
    const unifiedOptions = {
      ttl: cacheEntry.ttl,
      tags: cacheEntry.tags || [],
      priority: (cacheEntry.priority as any) || 'normal',
      compress: cacheEntry.compressed
    };

    await unifiedCache.set(key, cacheEntry.data, unifiedOptions);
  }

  private static estimateEntrySize(entry: any): number {
    try {
      return JSON.stringify(entry).length * 2; // UTF-16 approximation
    } catch {
      return 1024; // Default 1KB estimate
    }
  }
}

/**
 * Auto-migration utility to detect and migrate existing caches
 */
export class AutoCacheMigration {
  /**
   * Automatically detect and migrate existing cache instances
   */
  static async autoMigrate(
    cacheMappings: Array<{
      globalName: string;
      targetCacheName: string;
      expectedType?: string;
    }> = []
  ): Promise<{
    migratedCaches: string[];
    skippedCaches: string[];
    errors: string[];
  }> {
    const result = {
      migratedCaches: [] as string[],
      skippedCaches: [] as string[],
      errors: [] as string[]
    };

    // Default cache mappings based on common patterns
    const defaultMappings = [
      { globalName: 'robotCache', targetCacheName: 'robots', expectedType: 'optimized' },
      { globalName: 'marketDataCache', targetCacheName: 'marketData', expectedType: 'optimized' },
      { globalName: 'analysisCache', targetCacheName: 'analysis', expectedType: 'optimized' },
      { globalName: 'userCache', targetCacheName: 'users', expectedType: 'advanced' },
      { globalName: 'unifiedRobotCache', targetCacheName: 'robots', expectedType: 'unified' },
      { globalName: 'unifiedQueryCache', targetCacheName: 'queries', expectedType: 'unified' },
      { globalName: 'unifiedUserCache', targetCacheName: 'users', expectedType: 'unified' }
    ];

    const mappings = cacheMappings.length > 0 ? cacheMappings : defaultMappings;

    for (const mapping of mappings) {
      try {
        const globalInstance = (globalThis as any)[mapping.globalName];
        
        if (!globalInstance) {
          result.skippedCaches.push(`${mapping.globalName} (not found)`);
          continue;
        }

        // Skip if already unified cache
        if (globalInstance instanceof UnifiedCacheService) {
          result.skippedCaches.push(`${mapping.globalName} (already unified)`);
          continue;
        }

        logger.info(`Auto-migrating cache: ${mapping.globalName} -> ${mapping.targetCacheName}`);
        
        const migrationResult = await this.migrateBasedOnType(
          globalInstance,
          mapping.targetCacheName,
          mapping.expectedType
        );

        result.migratedCaches.push(mapping.globalName);
        
      } catch (error) {
        result.errors.push(`${mapping.globalName}: ${error}`);
      }
    }

    logger.info(`Auto-migration completed: ${result.migratedCaches.length} migrated, ${result.skippedCaches.length} skipped`);
    return result;
  }

  private static async migrateBasedOnType(
    sourceInstance: any,
    targetCacheName: string,
    expectedType?: string
  ): Promise<MigrationResult> {
    // Try to determine type and call appropriate migration
    if (sourceInstance.cache instanceof Map) {
      if (expectedType === 'enhanced' || sourceInstance.constructor.name.includes('Enhanced')) {
        return CacheMigrationHelper.migrateFromEnhancedCache(
          sourceInstance.cache,
          targetCacheName
        );
      }
      
      if (expectedType === 'optimized' || sourceInstance.constructor.name.includes('Optimized')) {
        return CacheMigrationHelper.migrateFromOptimizedCache(
          sourceInstance,
          targetCacheName
        );
      }
      
      if (expectedType === 'advanced' || sourceInstance.constructor.name.includes('Advanced')) {
        return CacheMigrationHelper.migrateFromAdvancedCache(
          sourceInstance,
          targetCacheName
        );
      }
    }

    // Fallback - try to treat as generic cache with Map interface
    return CacheMigrationHelper.migrateFromEnhancedCache(
      sourceInstance.cache || new Map(),
      targetCacheName
    );
  }
}