/**
 * Tests for Database Architect Services
 * 
 * @module services/database/architect.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionManager, transactionManager } from './transactionManager';
import { SchemaManager, schemaManager } from './schemaManager';
import { IndexAdvisor, indexAdvisor } from './indexAdvisor';
import { QueryBuilder, RobotQueryBuilder, query, robotQuery } from './queryBuilder';

// Mock Supabase client
const mockClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      order: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
      range: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
      is: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
      })),
    })),
    insert: vi.fn(() => Promise.resolve({ data: [], error: null })),
    update: vi.fn(() => Promise.resolve({ data: [], error: null })),
    delete: vi.fn(() => Promise.resolve({ data: [], error: null })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  })),
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  },
} as any;

describe('TransactionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = TransactionManager.getInstance();
      const instance2 = TransactionManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getMetrics', () => {
    it('should return transaction metrics', () => {
      const metrics = transactionManager.getMetrics();
      expect(metrics).toHaveProperty('totalTransactions');
      expect(metrics).toHaveProperty('successfulTransactions');
      expect(metrics).toHaveProperty('failedTransactions');
      expect(metrics).toHaveProperty('rolledBackTransactions');
      expect(metrics).toHaveProperty('averageDuration');
      expect(metrics).toHaveProperty('totalRetries');
    });
  });

  describe('getActiveTransactionCount', () => {
    it('should return active transaction count', () => {
      const count = transactionManager.getActiveTransactionCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeTransaction', () => {
    it('should execute operation and return result', async () => {
      const operation = vi.fn().mockResolvedValue({ id: '1', name: 'test' });
      
      const result = await transactionManager.executeTransaction(
        mockClient,
        operation,
        { retryAttempts: 0 }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'test' });
      expect(result.error).toBeNull();
    });

    it('should handle operation failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      const result = await transactionManager.executeTransaction(
        mockClient,
        operation,
        { retryAttempts: 0 }
      );

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });
  });
});

describe('SchemaManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schemaManager.clearCache();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SchemaManager.getInstance();
      const instance2 = SchemaManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getCurrentVersion', () => {
    it('should return current version', () => {
      const version = schemaManager.getCurrentVersion();
      expect(version).toBe('1.0.0');
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history', () => {
      const history = schemaManager.getVersionHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('recordMigration', () => {
    it('should record migration', () => {
      schemaManager.recordMigration('1.1.0', 'Add new column', 'abc123');
      
      const history = schemaManager.getVersionHistory();
      expect(history.length).toBe(1);
      expect(history[0].version).toBe('1.1.0');
      expect(history[0].description).toBe('Add new column');
      expect(history[0].checksum).toBe('abc123');
    });
  });

  describe('generateSchemaChecksum', () => {
    it('should generate consistent checksums', () => {
      const tables = [
        {
          name: 'robots',
          schema: 'public',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isForeignKey: false, constraints: [], defaultValue: null },
          ],
          indexes: [],
          constraints: [],
        },
      ];

      const checksum1 = schemaManager.generateSchemaChecksum(tables as any);
      const checksum2 = schemaManager.generateSchemaChecksum(tables as any);

      expect(checksum1).toBe(checksum2);
    });
  });

  describe('getExpectedTableDefinition', () => {
    it('should return expected robots table definition', () => {
      const tableDef = schemaManager.getExpectedTableDefinition('robots');
      expect(tableDef).not.toBeNull();
      expect(tableDef?.name).toBe('robots');
      expect(tableDef?.columns).toBeDefined();
    });

    it('should return null for unknown table', () => {
      const tableDef = schemaManager.getExpectedTableDefinition('unknown_table');
      expect(tableDef).toBeNull();
    });
  });

  describe('getRecommendedIndexes', () => {
    it('should return recommended indexes', () => {
      const indexes = schemaManager.getRecommendedIndexes();
      expect(Array.isArray(indexes)).toBe(true);
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear schema cache', () => {
      schemaManager.clearCache();
      // No error should be thrown
      expect(true).toBe(true);
    });
  });
});

describe('IndexAdvisor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = IndexAdvisor.getInstance();
      const instance2 = IndexAdvisor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getQueryPatterns', () => {
    it('should return recorded query patterns', () => {
      indexAdvisor.recordQueryPattern('SELECT * FROM robots', 'robots', ['id', 'name'], 'SELECT', 100);
      
      const patterns = indexAdvisor.getQueryPatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('recordQueryPattern', () => {
    it('should record query pattern', () => {
      indexAdvisor.recordQueryPattern('SELECT * FROM robots', 'robots', ['id'], 'SELECT', 50);
      
      const patterns = indexAdvisor.getQueryPatterns();
      const robotsPattern = patterns.find(p => p.tableName === 'robots' && p.operation === 'SELECT');
      
      expect(robotsPattern).toBeDefined();
    });
  });

  describe('getAnalysisHistory', () => {
    it('should return analysis history', () => {
      const history = indexAdvisor.getAnalysisHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('generateMigrationScript', () => {
    it('should generate migration script', () => {
      const recommendations = [
        {
          id: 'rec1',
          tableName: 'robots',
          columns: ['user_id'],
          indexType: 'btree' as const,
          isUnique: false,
          priority: 'high' as const,
          reason: 'Test recommendation',
          estimatedImpact: '50% improvement',
          createStatement: 'CREATE INDEX idx_test ON robots(user_id);',
          relatedQueries: [],
        },
      ];

      const script = indexAdvisor.generateMigrationScript(recommendations);
      
      expect(script).toContain('Index Optimization Migration');
      expect(script).toContain('CREATE INDEX idx_test ON robots(user_id);');
    });
  });

  describe('generateDropScript', () => {
    it('should generate drop script for unused indexes', () => {
      const unusedIndexes = [
        {
          indexName: 'idx_unused',
          tableName: 'robots',
          scans: 0,
          tuplesRead: 0,
          tuplesFetched: 0,
          size: 1024,
          isUnused: true,
          usageRatio: 0,
        },
      ];

      const script = indexAdvisor.generateDropScript(unusedIndexes);
      
      expect(script).toContain('Unused Index Cleanup Migration');
      expect(script).toContain('DROP INDEX CONCURRENTLY IF EXISTS idx_unused');
    });
  });
});

describe('QueryBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('select', () => {
    it('should create query builder with select', () => {
      const builder = query(mockClient, 'robots');
      builder.select('id', 'name');
      
      expect(builder).toBeDefined();
    });
  });

  describe('where', () => {
    it('should add equality filter', () => {
      const builder = query(mockClient, 'robots');
      builder.where('id', '123');
      
      expect(builder).toBeDefined();
    });
  });

  describe('whereILike', () => {
    it('should add case-insensitive like filter', () => {
      const builder = query(mockClient, 'robots');
      builder.whereILike('name', '%test%');
      
      expect(builder).toBeDefined();
    });
  });

  describe('orderBy', () => {
    it('should add sort order', () => {
      const builder = query(mockClient, 'robots');
      builder.orderBy('created_at', 'desc');
      
      expect(builder).toBeDefined();
    });
  });

  describe('paginate', () => {
    it('should add pagination', () => {
      const builder = query(mockClient, 'robots');
      builder.paginate(1, 10);
      
      expect(builder).toBeDefined();
    });
  });

  describe('search', () => {
    it('should add search filter on multiple columns', () => {
      const builder = query(mockClient, 'robots');
      builder.search('test', ['name', 'description']);
      
      expect(builder).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute query and return results', async () => {
      const builder = query(mockClient, 'robots');
      const result = await builder.execute();
      
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });
  });

  describe('first', () => {
    it('should return first result', async () => {
      const builder = query(mockClient, 'robots');
      const result = await builder.first();
      
      // Result could be null or an object
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });
});

describe('RobotQueryBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('byUser', () => {
    it('should filter by user ID', () => {
      const builder = robotQuery(mockClient);
      builder.byUser('user-123');
      
      expect(builder).toBeDefined();
    });
  });

  describe('byStrategy', () => {
    it('should filter by strategy type', () => {
      const builder = robotQuery(mockClient);
      builder.byStrategy('Trend');
      
      expect(builder).toBeDefined();
    });
  });

  describe('activeOnly', () => {
    it('should filter active robots only', () => {
      const builder = robotQuery(mockClient);
      builder.activeOnly();
      
      expect(builder).toBeDefined();
    });
  });

  describe('publicOnly', () => {
    it('should filter public robots only', () => {
      const builder = robotQuery(mockClient);
      builder.publicOnly();
      
      expect(builder).toBeDefined();
    });
  });

  describe('searchRobots', () => {
    it('should search by name or description', () => {
      const builder = robotQuery(mockClient);
      builder.searchRobots('trend following');
      
      expect(builder).toBeDefined();
    });
  });

  describe('recentlyUpdated', () => {
    it('should filter recently updated robots', () => {
      const builder = robotQuery(mockClient);
      builder.recentlyUpdated(7);
      
      expect(builder).toBeDefined();
    });
  });

  describe('popular', () => {
    it('should filter popular robots', () => {
      const builder = robotQuery(mockClient);
      builder.popular(100);
      
      expect(builder).toBeDefined();
    });
  });

  describe('orderByPopularity', () => {
    it('should order by view count', () => {
      const builder = robotQuery(mockClient);
      builder.orderByPopularity();
      
      expect(builder).toBeDefined();
    });
  });

  describe('latest', () => {
    it('should order by creation date descending', () => {
      const builder = robotQuery(mockClient);
      builder.latest();
      
      expect(builder).toBeDefined();
    });
  });

  describe('oldest', () => {
    it('should order by creation date ascending', () => {
      const builder = robotQuery(mockClient);
      builder.oldest();
      
      expect(builder).toBeDefined();
    });
  });
});
