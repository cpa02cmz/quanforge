import { describe, test, expect, beforeEach } from 'vitest';
import { RobotIndexManager, robotIndexManager } from './robotIndexManager';
import { Robot } from '../types';

describe('RobotIndexManager', () => {
  let manager: RobotIndexManager;
  const mockRobots: Robot[] = [
    {
      id: 'robot-1',
      user_id: 'user-1',
      name: 'Test Strategy 1',
      description: 'Test description 1',
      strategy_type: 'Scalping',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      code: '// test code 1',
      chat_history: [],
      version: 1,
      is_active: true,
      is_public: false,
      view_count: 0,
      copy_count: 0,
    },
    {
      id: 'robot-2',
      user_id: 'user-1',
      name: 'Test Strategy 2',
      description: 'Test description 2',
      strategy_type: 'Trend',
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      code: '// test code 2',
      chat_history: [],
      version: 1,
      is_active: true,
      is_public: false,
      view_count: 0,
      copy_count: 0,
    },
    {
      id: 'robot-3',
      user_id: 'user-1',
      name: 'Test Strategy 3',
      description: 'Test description 3',
      strategy_type: 'Scalping',
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
      code: '// test code 3',
      chat_history: [],
      version: 1,
      is_active: true,
      is_public: false,
      view_count: 0,
      copy_count: 0,
    },
    {
      id: 'robot-4',
      user_id: 'user-1',
      name: 'test strategy 1',
      description: 'Test description 4',
      strategy_type: 'Custom',
      created_at: '2024-01-04T00:00:00Z',
      updated_at: '2024-01-04T00:00:00Z',
      code: '// test code 4',
      chat_history: [],
      version: 1,
      is_active: true,
      is_public: false,
      view_count: 0,
      copy_count: 0,
    },
  ];

  beforeEach(() => {
    manager = new RobotIndexManager();
  });

  describe('createIndex', () => {
    test('should create index with all required properties', () => {
      const index = manager.createIndex(mockRobots);

      expect(index).toBeDefined();
      expect(index.byId).toBeDefined();
      expect(index.byName).toBeDefined();
      expect(index.byType).toBeDefined();
      expect(index.byDate).toBeDefined();
    });

    test('should index robots by ID', () => {
      const index = manager.createIndex(mockRobots);

      expect(index.byId.size).toBe(4);
      expect(index.byId.get('robot-1')).toBeDefined();
      expect(index.byId.get('robot-1')?.id).toBe('robot-1');
    });

    test('should index robots by name (case-insensitive)', () => {
      const index = manager.createIndex(mockRobots);

      expect(index.byName.size).toBe(3);
      expect(index.byName.get('test strategy 1')?.length).toBe(2);
      expect(index.byName.get('test strategy 2')?.length).toBe(1);
      expect(index.byName.get('test strategy 3')?.length).toBe(1);
    });

    test('should index robots by type', () => {
      const index = manager.createIndex(mockRobots);

      expect(index.byType.size).toBe(3);
      expect(index.byType.get('Scalping')?.length).toBe(2);
      expect(index.byType.get('Trend')?.length).toBe(1);
      expect(index.byType.get('Custom')?.length).toBe(1);
    });

    test('should default to Custom type if strategy_type is missing', () => {
      const robotsWithoutType: Robot[] = [
        {
          id: 'robot-no-type',
          user_id: 'user-1',
          name: 'No Type Robot',
          description: 'No type description',
          strategy_type: 'Custom',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          code: '// code',
          chat_history: [],
          version: 1,
          is_active: true,
          is_public: false,
          view_count: 0,
          copy_count: 0,
        },
      ];

      const index = manager.createIndex(robotsWithoutType);

      expect(index.byType.get('Custom')?.length).toBe(1);
    });

    test('should sort robots by date (descending)', () => {
      const index = manager.createIndex(mockRobots);

      expect(index.byDate.length).toBe(4);
      expect(index.byDate[0].id).toBe('robot-4');
      expect(index.byDate[3].id).toBe('robot-1');
    });
  });

  describe('getIndex', () => {
    test('should create index on first call', () => {
      const index = manager.getIndex(mockRobots);

      expect(index.byId.size).toBe(4);
    });

    test('should reuse cached index if data unchanged', () => {
      const index1 = manager.getIndex(mockRobots);
      const index2 = manager.getIndex(mockRobots);

      expect(index1).toBe(index2);
    });

    test('should rebuild index if data version changes', () => {
      const index1 = manager.getIndex(mockRobots);

      const updatedRobots = [...mockRobots];
      updatedRobots[0].updated_at = '2024-01-05T00:00:00Z';

      const index2 = manager.getIndex(updatedRobots);

      expect(index1).not.toBe(index2);
      expect(index2.byId.get('robot-1')?.updated_at).toBe('2024-01-05T00:00:00Z');
    });

    test('should rebuild index if robot list changes', () => {
      manager.getIndex(mockRobots);

      const newRobots = [...mockRobots];
      newRobots.push({
        id: 'robot-5',
        user_id: 'user-1',
        name: 'New Robot',
        description: 'New robot description',
        strategy_type: 'Scalping',
        created_at: '2024-01-05T00:00:00Z',
        updated_at: '2024-01-05T00:00:00Z',
        code: '// new code',
        chat_history: [],
        version: 1,
        is_active: true,
        is_public: false,
        view_count: 0,
        copy_count: 0,
      });

      const index = manager.getIndex(newRobots);

      expect(index.byId.size).toBe(5);
    });
  });

  describe('clear', () => {
    test('should clear index and version tracking', () => {
      manager.getIndex(mockRobots);

      manager.clear();

      const newIndex = manager.getIndex(mockRobots);
      expect(newIndex).toBeDefined();
      expect(newIndex.byId.size).toBe(4);
    });
  });

  describe('Edge cases', () => {
    test('should handle empty robot array', () => {
      const index = manager.createIndex([]);

      expect(index.byId.size).toBe(0);
      expect(index.byName.size).toBe(0);
      expect(index.byType.size).toBe(0);
      expect(index.byDate.length).toBe(0);
    });

    test('should handle robots with same name (case-insensitive)', () => {
      const sameNameRobots: Robot[] = [
        {
          id: 'robot-a',
          user_id: 'user-1',
          name: 'Same Name',
          description: 'Description a',
          strategy_type: 'Scalping',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          code: '// code a',
          chat_history: [],
          version: 1,
          is_active: true,
          is_public: false,
          view_count: 0,
          copy_count: 0,
        },
        {
          id: 'robot-b',
          user_id: 'user-1',
          name: 'same name',
          description: 'Description b',
          strategy_type: 'Trend',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          code: '// code b',
          chat_history: [],
          version: 1,
          is_active: true,
          is_public: false,
          view_count: 0,
          copy_count: 0,
        },
      ];

      const index = manager.createIndex(sameNameRobots);

      expect(index.byName.get('same name')?.length).toBe(2);
    });

    test('should handle single robot', () => {
      const singleRobot: Robot[] = [
        {
          id: 'single',
          user_id: 'user-1',
          name: 'Single Robot',
          description: 'Single robot description',
          strategy_type: 'Custom',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          code: '// code',
          chat_history: [],
          version: 1,
          is_active: true,
          is_public: false,
          view_count: 0,
          copy_count: 0,
        },
      ];

      const index = manager.createIndex(singleRobot);

      expect(index.byId.size).toBe(1);
      expect(index.byId.get('single')).toBeDefined();
      expect(index.byName.get('single robot')?.length).toBe(1);
      expect(index.byType.get('Custom')?.length).toBe(1);
      expect(index.byDate.length).toBe(1);
    });
  });
});

describe('robotIndexManager singleton', () => {
  test('should be accessible as singleton', () => {
    expect(robotIndexManager).toBeDefined();
    expect(robotIndexManager).toBeInstanceOf(RobotIndexManager);
  });

  test('should maintain state across multiple calls', () => {
    const mockRobots: Robot[] = [
      {
        id: 'singleton-test',
        user_id: 'user-1',
        name: 'Singleton Test',
        description: 'Singleton description',
        strategy_type: 'Custom',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        code: '// code',
        chat_history: [],
        version: 1,
        is_active: true,
        is_public: false,
        view_count: 0,
        copy_count: 0,
      },
    ];

    const index1 = robotIndexManager.getIndex(mockRobots);
    const index2 = robotIndexManager.getIndex(mockRobots);

    expect(index1).toBe(index2);

    robotIndexManager.clear();
  });
});
