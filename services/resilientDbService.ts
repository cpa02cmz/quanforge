import { mockDb as originalMockDb, dbUtils as originalDbUtils } from './supabase';
import * as dbOperations from './database/operations';
import { withIntegrationResilience, type IntegrationResult } from './integrationWrapper';
import { IntegrationType } from './integrationResilience';
import { databaseFallbacks } from './fallbackStrategies';
import { storage } from '../utils/storage';
import { createScopedLogger } from '../utils/logger';
import type { Robot, AuditLog, RobotVersion } from '../types';
import { COUNT_CONSTANTS } from './modularConstants';

const logger = createScopedLogger('ResilientDb');

export const resilientDb = {
  async updateRobot(id: string, updates: any): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.updateRobot(id, updates),
      {
        operationName: 'update_robot'
      }
    );

    if (!result.success && result.error) {
      logger.error('updateRobot failed:', result.error);
    }

    return result;
  },

  async getRobots(): Promise<IntegrationResult<any[]>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.getRobots(),
      {
        operationName: 'get_robots',
        fallbacks: [
          databaseFallbacks.cacheFirst('robots_list', (key: string) => {
            const cached = storage.get(key);
            return cached !== undefined ? cached : null;
          }),
          databaseFallbacks.mockData([])
        ]
      }
    );

    if (!result.success && result.error) {
      logger.error('getRobots failed:', result.error);
    }

    return result;
  },

  async saveRobot(robot: any): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.saveRobot(robot),
      {
        operationName: 'save_robot'
      }
    );

    if (!result.success && result.error) {
      logger.error('saveRobot failed:', result.error);
    }

    return result;
  },

  async getRobotsByIds(ids: string[]): Promise<IntegrationResult<any[]>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.getRobotsByIds(ids),
      {
        operationName: 'get_robots_by_ids',
        fallbacks: [
          databaseFallbacks.mockData([])
        ]
      }
    );

    return result;
  },

  async deleteRobot(id: string): Promise<IntegrationResult<void>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.deleteRobot(id),
      {
        operationName: 'delete_robot'
      }
    );

    return result;
  },

  async duplicateRobot(id: string): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.duplicateRobot(id),
      {
        operationName: 'duplicate_robot'
      }
    );

    return result;
  },

  async batchUpdateRobots(updates: Array<{id: string, data: any}>): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.batchUpdateRobots(updates),
      {
        operationName: 'batch_update_robots'
      }
    );

    return result;
  },

  // Get a single robot by ID
  async getRobot(id: string): Promise<IntegrationResult<Robot | null>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await dbOperations.getRobot(id),
      {
        operationName: 'get_robot',
        fallbacks: [
          databaseFallbacks.mockData(null)
        ]
      }
    );

    return result;
  },

  // Additional operations from database/operations.ts with resilience
  async getRobotsPaginated(
    userId: string,
    page: number = 1,
    limit: number = COUNT_CONSTANTS.PAGINATION.DEFAULT
  ): Promise<IntegrationResult<{ robots: Robot[]; total: number; page: number; totalPages: number }>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await dbOperations.getRobotsPaginated(userId, page, limit),
      {
        operationName: 'get_robots_paginated',
        fallbacks: [
          databaseFallbacks.mockData({ robots: [], total: 0, page, totalPages: 0 })
        ]
      }
    );

    return result;
  },

  async getRobotHistory(robotId: string): Promise<IntegrationResult<RobotVersion[]>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await dbOperations.getRobotHistory(robotId),
      {
        operationName: 'get_robot_history',
        fallbacks: [
          databaseFallbacks.mockData([])
        ]
      }
    );

    return result;
  },

  async getAuditLog(tableName: string, recordId: string): Promise<IntegrationResult<AuditLog[]>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await dbOperations.getAuditLog(tableName, recordId),
      {
        operationName: 'get_audit_log',
        fallbacks: [
          databaseFallbacks.mockData([])
        ]
      }
    );

    return result;
  },

  async restoreRobot(id: string): Promise<IntegrationResult<Robot | null>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await dbOperations.restoreRobot(id),
      {
        operationName: 'restore_robot',
        fallbacks: [
          databaseFallbacks.mockData(null)
        ]
      }
    );

    return result;
  },

  async permanentlyDeleteRobot(id: string): Promise<IntegrationResult<void>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => {
        await dbOperations.permanentlyDeleteRobot(id);
        return undefined;
      },
      {
        operationName: 'permanently_delete_robot'
      }
    );

    return result;
  },

  async rollbackRobot(robotId: string, version: number): Promise<IntegrationResult<{ robotId: string; version: number; success: boolean; message: string }>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await dbOperations.rollbackRobot(robotId, version, ''),
      {
        operationName: 'rollback_robot',
        fallbacks: [
          databaseFallbacks.mockData({ robotId, version, success: false, message: 'Rollback failed' })
        ]
      }
    );

    return result;
  },

  async searchRobots(searchTerm: string, filterType?: string): Promise<IntegrationResult<Robot[]>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.searchRobots(searchTerm, filterType),
      {
        operationName: 'search_robots',
        fallbacks: [
          databaseFallbacks.mockData([])
        ]
      }
    );

    return result;
  }
};

export const resilientDbUtils = {
  async checkConnection(): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.checkConnection(),
      {
        operationName: 'check_connection'
      }
    );

    return result;
  },

  async getStats(): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.getStats(),
      {
        operationName: 'get_stats'
      }
    );

    return result;
  },

  async exportDatabase(): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.exportDatabase(),
      {
        operationName: 'export_database'
      }
    );

    return result;
  },

  async importDatabase(jsonString: string, merge: boolean = true): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.importDatabase(jsonString, merge),
      {
        operationName: 'import_database'
      }
    );

    return result;
  },

  async migrateMockToSupabase(): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.migrateMockToSupabase(),
      {
        operationName: 'migrate_mock_to_supabase'
      }
    );

    return result;
  },

  async clearDatabase(): Promise<IntegrationResult<boolean>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.clearDatabase(),
      {
        operationName: 'clear_database'
      }
    );

    return result;
  },

  async getStrategyTypes(): Promise<IntegrationResult<string[]>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.getStrategyTypes(),
      {
        operationName: 'get_strategy_types',
        fallbacks: [
          databaseFallbacks.mockData([])
        ]
      }
    );

    return result;
  },

  async optimizeDatabase(): Promise<IntegrationResult<{ success: boolean; message: string }>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.optimizeDatabase(),
      {
        operationName: 'optimize_database'
      }
    );

    return result;
  },

  async getDatabaseStats(): Promise<IntegrationResult<{
    totalRecords: number;
    totalSizeKB: number;
    avgRecordSizeKB: number;
    lastOptimized?: string;
    duplicateRecords?: number;
    invalidRecords?: number;
  }>> {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.getDatabaseStats(),
      {
        operationName: 'get_database_stats',
        fallbacks: [
          databaseFallbacks.mockData({
            totalRecords: 0,
            totalSizeKB: 0,
            avgRecordSizeKB: 0
          })
        ]
      }
    );

    return result;
  }
};

// Re-export IntegrationResult type for consumers
export type { IntegrationResult };
