import { createScopedLogger } from '../utils/logger';
import { AutoCacheMigration, CacheMigrationHelper } from './cacheMigration';
import { UnifiedCacheFactory } from './unifiedCacheService';
import { memoryMonitor } from './memoryMonitor';

const logger = createScopedLogger('CacheSystemMigration');

/**
 * Complete Cache System Migration Script
 * 
 * This script handles the complete migration from legacy cache implementations
 * to the new unified cache system with minimal disruption.
 */
export class CacheSystemMigration {
  private static migrationCompleted = false;

  /**
   * Execute complete cache system migration
   */
  static async execute(): Promise<{
    success: boolean;
    migratedCaches: string[];
    errors: string[];
    recommendations: string[];
  }> {
    if (this.migrationCompleted) {
      logger.info('Cache migration already completed');
      return {
        success: true,
        migratedCaches: [],
        errors: [],
        recommendations: []
      };
    }

    logger.info('Starting complete cache system migration...');
    
    const result = {
      success: false,
      migratedCaches: [] as string[],
      errors: [] as string[],
      recommendations: [] as string[]
    };

    try {
      // Step 1: Start memory monitoring
      memoryMonitor.startMonitoring();
      logger.info('Memory monitoring started');

      // Step 2: Auto-migrate existing caches
      const autoMigrationResult = await AutoCacheMigration.autoMigrate();
      
      if (autoMigrationResult.errors.length > 0) {
        result.errors.push(...autoMigrationResult.errors.map(e => `Auto-migration: ${e}`));
      }
      
      result.migratedCaches.push(...autoMigrationResult.migratedCaches);
      logger.info(`Auto-migration completed: ${autoMigrationResult.migratedCaches.length} caches migrated`);

      // Step 3: Validate migrations
      const validationResults = await this.validateMigrations();
      
      if (validationResults.failed > 0) {
        result.errors.push(`${validationResults.failed} cache validations failed`);
        result.errors.push(...validationResults.issues);
      }

      // Step 4: Configure memory monitoring callbacks
      this.setupMemoryMonitoring();

      // Step 5: Clean up legacy caches
      this.cleanupLegacyCaches();

      // Step 6: Generate post-migration recommendations
      result.recommendations = this.generateRecommendations(validationResults);

      result.success = result.errors.length === 0;
      this.migrationCompleted = true;

      logger.info('Cache system migration completed', {
        success: result.success,
        migrated: result.migratedCaches.length,
        errors: result.errors.length
      });

    } catch (error) {
      logger.error('Cache migration failed', error);
      result.errors.push(`Migration failed: ${error}`);
    }

    return result;
  }

  /**
   * Validate all cache migrations
   */
  private static async validateMigrations(): Promise<{
    totalChecked: number;
    passed: number;
    failed: number;
    issues: string[];
  }> {
    const allStats = UnifiedCacheFactory.getAllStats();
    const result = {
      totalChecked: 0,
      passed: 0,
      failed: 0,
      issues: [] as string[]
    };

    for (const cacheName in allStats) {
      result.totalChecked++;
      
      try {
        const cacheStats = allStats[cacheName];
        
        // Check basic cache health
        if (cacheStats.memoryPressure === 'critical') {
          result.issues.push(`${cacheName}: Critical memory pressure`);
          result.failed++;
          continue;
        }

        if (cacheStats.hitRate < 30 && cacheStats.totalRequests > 50) {
          result.issues.push(`${cacheName}: Low hit rate (${cacheStats.hitRate.toFixed(1)}%)`);
          result.failed++;
          continue;
        }

        result.passed++;
        
      } catch (error) {
        result.issues.push(`${cacheName}: Validation error - ${error}`);
        result.failed++;
      }
    }

    logger.info(`Cache validation completed: ${result.passed}/${result.totalChecked} passed`);
    return result;
  }

  /**
   * Setup memory monitoring callbacks
   */
  private static setupMemoryMonitoring(): void {
    memoryMonitor.updateCallbacks({
      onHighPressure: async (event) => {
        logger.warn('High memory pressure detected during migration', {
          used: `${(event.stats.used / 1024 / 1024).toFixed(1)}MB`,
          actions: event.actions.length
        });

        // Force cleanup of all caches
        const allStats = UnifiedCacheFactory.getAllStats();
        for (const cacheName in allStats) {
          const cache = (UnifiedCacheFactory as any).instances.get(cacheName);
          if (cache && cache.forceCleanup) {
            await cache.forceCleanup();
          }
        }
      },

      onCriticalPressure: (event) => {
        logger.error('Critical memory pressure during migration', {
          used: `${(event.stats.used / 1024 / 1024).toFixed(1)}MB`,
          actions: event.actions.length
        });

        // Emergency measures
        for (const cacheName in UnifiedCacheFactory.getAllStats()) {
          UnifiedCacheFactory.destroyInstance(cacheName);
        }
      }
    });
  }

  /**
   * Clean up legacy cache references
   */
  private static cleanupLegacyCaches(): void {
    const legacyCacheNames = [
      'robotCache',
      'marketDataCache', 
      'analysisCache',
      'userCache',
      'unifiedRobotCache',
      'unifiedQueryCache', 
      'unifiedUserCache',
      'consolidatedCache',
      'globalCache',
      'smartCache',
      'semanticCache'
    ];

    let cleanedCount = 0;
    for (const cacheName of legacyCacheNames) {
      if ((globalThis as any)[cacheName]) {
        try {
          // Attempt to destroy if it has destroy method
          if ((globalThis as any)[cacheName].destroy) {
            (globalThis as any)[cacheName].destroy();
          }
          delete (globalThis as any)[cacheName];
          cleanedCount++;
        } catch (error) {
          logger.warn(`Failed to cleanup legacy cache: ${cacheName}`, error);
        }
      }
    }

    logger.info(`Legacy cache cleanup completed: ${cleanedCount} caches removed`);
  }

  /**
   * Generate post-migration recommendations
   */
  private static generateRecommendations(validationResults: any): string[] {
    const recommendations: string[] = [];

    if (validationResults.failed === 0) {
      recommendations.push('✅ Cache migration completed successfully');
    } else {
      recommendations.push('⚠️  Some cache validations failed - review issues');
    }

    // Performance recommendations
    const allStats = UnifiedCacheFactory.getAllStats();
    let totalMemory = 0;
    let totalRequests = 0;
    let totalHits = 0;

    for (const cacheName in allStats) {
      const stats = allStats[cacheName];
      totalMemory += stats.memoryUsage;
      totalRequests += stats.totalRequests;
      totalHits += stats.hitRate * (stats.totalRequests / 100);
    }

    const overallHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    if (overallHitRate < 70) {
      recommendations.push('🔧 Consider adjusting cache TTLs for better hit rates');
    }

    if (totalMemory > 150 * 1024 * 1024) { // 150MB
      recommendations.push('🔧 Consider reducing cache sizes to optimize memory usage');
    }

    recommendations.push('📊 Monitor memory pressure using the new monitoring system');
    recommendations.push('🔍 Review cache metrics in UnifiedCacheFactory.getAllStats()');
    recommendations.push('🧹 Use memoryMonitor.forceCheck() for manual memory checks');

    return recommendations;
  }

  /**
   * Check if migration is needed
   */
  static isMigrationNeeded(): boolean {
    return !this.migrationCompleted;
  }

  /**
   * Get migration status
   */
  static getStatus(): {
    completed: boolean;
    activeCaches: number;
    totalMemoryUsage: number;
    memoryPressure: string;
  } {
    const allStats = UnifiedCacheFactory.getAllStats();
    let totalMemory = 0;
    let highestPressure = 'low';

    for (const cacheName in allStats) {
      const stats = allStats[cacheName];
      totalMemory += stats.memoryUsage;
      
      if (stats.memoryPressure === 'critical') {
        highestPressure = 'critical';
      } else if (stats.memoryPressure === 'high' && highestPressure !== 'critical') {
        highestPressure = 'high';
      } else if (stats.memoryPressure === 'medium' && highestPressure === 'low') {
        highestPressure = 'medium';
      }
    }

    return {
      completed: this.migrationCompleted,
      activeCaches: Object.keys(allStats).length,
      totalMemoryUsage: totalMemory,
      memoryPressure: highestPressure
    };
  }
}

// Export convenience function for initialization
export const initializeCacheSystem = async () => {
  return CacheSystemMigration.execute();
};

// Auto-initialize on module load (in development)
if (process.env.NODE_ENV === 'development') {
  setTimeout(async () => {
    if (CacheSystemMigration.isMigrationNeeded()) {
      logger.info('Auto-initializing cache system in development mode');
      const result = await initializeCacheSystem();
      
      if (!result.success) {
        console.error('Cache system initialization failed:', result.errors);
      } else {
        console.log('Cache system initialized successfully', {
          migratedCaches: result.migratedCaches.length,
          recommendations: result.recommendations.length
        });
      }
    }
  }, 1000);
}