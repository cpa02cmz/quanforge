import { mockDb as originalMockDb, dbUtils as originalDbUtils } from './supabase';
import { withIntegrationResilience } from './integrationWrapper';
import { IntegrationType } from './integrationResilience';
import { databaseFallbacks } from './fallbackStrategies';
import { storage } from '../utils/storage';

export const resilientDb = {
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
