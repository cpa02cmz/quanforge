import { describe, it, expect, beforeEach } from 'vitest';
import {
  createVersion,
  getVersionHistory,
  getVersion,
  restoreVersion,
  compareVersions,
  getVersionStats,
  deleteVersion,
  getVersionMetadata,
  __resetVersionStore
} from './versionControlService';
import { CreateVersionRequest } from './types';

describe('VersionControlService', () => {
  const mockRobotId = 'robot_test_' + Date.now();
  const mockUserId = 'user_456';
  
  const createMockRequest = (overrides: Partial<CreateVersionRequest> = {}): CreateVersionRequest => ({
    robot_id: mockRobotId,
    code: '// Test code\nvoid OnTick() {}',
    strategy_params: {
      timeframe: 'H1',
      symbol: 'EURUSD',
      riskPercent: 2,
      stopLoss: 50,
      takeProfit: 100,
      magicNumber: 12345,
      customInputs: []
    },
    note: 'Test version',
    ...overrides
  });

  beforeEach(() => {
    // Reset state between tests
    __resetVersionStore();
  });

  beforeEach(() => {
    // Reset state between tests
  });

  describe('createVersion', () => {
    it('should create a new version successfully', async () => {
      const request = createMockRequest();
      const result = await createVersion(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.version_number).toBe(1);
      expect(result.data?.robot_id).toBe(mockRobotId);
      expect(result.data?.code).toBe(request.code);
    });

    it('should increment version numbers sequentially', async () => {
      const request1 = createMockRequest();
      const request2 = createMockRequest({ note: 'Second version' });

      const result1 = await createVersion(request1);
      const result2 = await createVersion(request2);

      expect(result1.version_number).toBe(1);
      expect(result2.version_number).toBe(2);
    });

    it('should mark auto-saves correctly', async () => {
      const request = createMockRequest({ is_auto_save: true });
      const result = await createVersion(request);

      expect(result.success).toBe(true);
      expect(result.data?.is_auto_save).toBe(true);
      expect(result.data?.created_by).toBe('auto');
    });

    it('should generate change summary', async () => {
      const request = createMockRequest();
      const result = await createVersion(request);

      expect(result.success).toBe(true);
      expect(result.data?.change_summary).toContain('lines of code');
      expect(result.data?.change_summary).toContain('strategy parameters');
    });
  });

  describe('getVersionHistory', () => {
    it('should return empty array for new robot', async () => {
      const result = await getVersionHistory('new_robot_id');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return all versions for existing robot', async () => {
      // Create some versions first
      await createVersion(createMockRequest({ note: 'Version 1' }));
      await createVersion(createMockRequest({ note: 'Version 2' }));
      await createVersion(createMockRequest({ note: 'Version 3' }));

      const result = await getVersionHistory(mockRobotId);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(3);
    });

    it('should respect limit option', async () => {
      for (let i = 0; i < 5; i++) {
        await createVersion(createMockRequest({ note: `Version ${i}` }));
      }

      const result = await getVersionHistory(mockRobotId, { limit: 3 });

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(3);
    });
  });

  describe('getVersion', () => {
    it('should return specific version by number', async () => {
      await createVersion(createMockRequest({ note: 'Version 1' }));
      await createVersion(createMockRequest({ note: 'Version 2' }));

      const result = await getVersion(mockRobotId, 2);

      expect(result.success).toBe(true);
      expect(result.data?.version_number).toBe(2);
      expect(result.data?.note).toBe('Version 2');
    });

    it('should return error for non-existent version', async () => {
      const result = await getVersion(mockRobotId, 999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('restoreVersion', () => {
    it('should restore version data successfully', async () => {
      const originalCode = '// Original code';
      await createVersion(createMockRequest({ code: originalCode, note: 'Original' }));

      const result = await restoreVersion(mockRobotId, 1);

      expect(result.success).toBe(true);
      expect(result.data?.code).toBe(originalCode);
    });

    it('should return error for non-existent version', async () => {
      const result = await restoreVersion(mockRobotId, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('compareVersions', () => {
    it('should compare two versions successfully', async () => {
      await createVersion(createMockRequest({ code: '// Version 1' }));
      await createVersion(createMockRequest({ code: '// Version 2\n// Added line' }));

      const result = await compareVersions(mockRobotId, 1, 2);

      expect(result.success).toBe(true);
      expect(result.data?.from_version).toBe(1);
      expect(result.data?.to_version).toBe(2);
      expect(result.data?.code_diff.added).toBeGreaterThan(0);
    });

    it('should detect parameter changes', async () => {
      await createVersion(createMockRequest({ 
        strategy_params: { timeframe: 'H1', symbol: 'EURUSD', riskPercent: 2, stopLoss: 50, takeProfit: 100, magicNumber: 12345, customInputs: [] }
      }));
      await createVersion(createMockRequest({ 
        strategy_params: { timeframe: 'H4', symbol: 'EURUSD', riskPercent: 2, stopLoss: 50, takeProfit: 100, magicNumber: 12345, customInputs: [] }
      }));

      const result = await compareVersions(mockRobotId, 1, 2);

      expect(result.success).toBe(true);
      expect(result.data?.params_changed).toBe(true);
    });
  });

  describe('getVersionStats', () => {
    it('should return empty stats for new robot', async () => {
      const robotId = `stats_empty_${Date.now()}`;
      
      const statsResult = await getVersionStats(robotId);

      expect(statsResult.success).toBe(true);
      expect(statsResult.data?.total_versions).toBe(0);
      expect(statsResult.data?.manual_saves).toBe(0);
      expect(statsResult.data?.auto_saves).toBe(0);
    });

    it('should calculate stats for single version', async () => {
      const robotId = `stats_single_${Date.now()}`;
      
      const req = createMockRequest({ is_auto_save: false });
      req.robot_id = robotId;
      await createVersion(req);

      const statsResult = await getVersionStats(robotId);

      expect(statsResult.success).toBe(true);
      expect(statsResult.data?.total_versions).toBe(1);
      expect(statsResult.data?.manual_saves).toBe(1);
      expect(statsResult.data?.auto_saves).toBe(0);
    });
  });

  describe('deleteVersion', () => {
    it('should delete version successfully', async () => {
      await createVersion(createMockRequest());
      
      const result = await deleteVersion(mockRobotId, 1);

      expect(result.success).toBe(true);

      // Verify it's gone
      const getResult = await getVersion(mockRobotId, 1);
      expect(getResult.success).toBe(false);
    });

    it('should return error for non-existent version', async () => {
      const result = await deleteVersion(mockRobotId, 999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getVersionMetadata', () => {
    it('should return lightweight metadata', async () => {
      await createVersion(createMockRequest({ note: 'Test note' }));

      const result = await getVersionMetadata(mockRobotId);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].note).toBe('Test note');
      // Should not include full code
      expect((result.data?.[0] as RobotVersion).code).toBeUndefined();
    });
  });
});
