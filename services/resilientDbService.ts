import { mockDb as originalMockDb, dbUtils as originalDbUtils } from './supabase';
import * as dbOperations from './database/operations';
import { withIntegrationResilience } from './integrationWrapper';
import { IntegrationType } from './integrationResilience';
import { databaseFallbacks } from './fallbackStrategies';
import { storage } from '../utils/storage';
import type { Robot, AuditLog, RobotVersion } from '../types';

export const resilientDb = {
  async updateRobot(id: string, updates: any) {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.updateRobot(id, updates),
      {
        operationName: 'update_robot'
      }
    );

    return result.data;
  },

  async getRobots() {
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

    return result.data;
  },

  async saveRobot(robot: any) {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.saveRobot(robot),
      {
        operationName: 'save_robot'
      }
    );

    return result.data;
  },

  async getRobotsByIds(ids: string[]) {
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

    return result.data;
  },

  async deleteRobot(id: string) {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.deleteRobot(id),
      {
        operationName: 'delete_robot'
      }
    );

    return result.data;
  },

  async duplicateRobot(id: string) {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.duplicateRobot(id),
      {
        operationName: 'duplicate_robot'
      }
    );

    return result.data;
  },

  async batchUpdateRobots(updates: Array<{id: string, data: any}>) {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalMockDb.batchUpdateRobots(updates),
      {
        operationName: 'batch_update_robots'
      }
    );

    return result.data;
  },

  // Get a single robot by ID
  async getRobot(id: string): Promise<Robot | null> {
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

    return result.data || null;
  },

  // Additional operations from database/operations.ts with resilience
  async getRobotsPaginated(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ robots: Robot[]; total: number; page: number; totalPages: number }> {
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

    return result.data || { robots: [], total: 0, page, totalPages: 0 };
  },

  async getRobotHistory(robotId: string): Promise<RobotVersion[]> {
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

    return result.data || [];
  },

  async getAuditLog(tableName: string, recordId: string): Promise<AuditLog[]> {
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

    return result.data || [];
  },

  async restoreRobot(id: string): Promise<Robot | null> {
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

    return result.data || null;
  },

  async permanentlyDeleteRobot(id: string): Promise<void> {
    await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => {
        await dbOperations.permanentlyDeleteRobot(id);
        return { data: null, error: null };
      },
      {
        operationName: 'permanently_delete_robot'
      }
    );
  }
};

export const resilientDbUtils = {
  async checkConnection() {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.checkConnection(),
      {
        operationName: 'check_connection'
      }
    );

    return result.data;
  },

  async getStats() {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.getStats(),
      {
        operationName: 'get_stats'
      }
    );

    return result.data;
  },

  async exportDatabase() {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.exportDatabase(),
      {
        operationName: 'export_database'
      }
    );

    return result.data;
  },

  async importDatabase(jsonString: string, merge: boolean = true) {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.importDatabase(jsonString, merge),
      {
        operationName: 'import_database'
      }
    );

    return result.data;
  },

  async migrateMockToSupabase() {
    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'database',
      async () => await originalDbUtils.migrateMockToSupabase(),
      {
        operationName: 'migrate_mock_to_supabase'
      }
    );

    return result.data;
  }
};
