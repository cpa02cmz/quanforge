/**
 * Tests for Database Utilities
 * 
 * @module services/database/utils/test
 * @author Backend Engineer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildSelectQuery,
  buildSearchConditions,
  calculatePaginationMeta,
  createPaginatedResult,
  validatePagination,
  buildUpdatePayload,
  buildSoftDeletePayload,
  buildRestorePayload,
  measureQuery,
  queryPerformanceTracker,
  DEFAULT_QUERY_OPTIONS,
  SOFT_DELETE_FILTER,
} from './queryBuilder';
import {
  DatabaseError,
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseTimeoutError,
  DatabaseConstraintError,
  DatabaseNotFoundError,
  DatabaseValidationError,
  DatabasePermissionError,
  DatabaseQuotaError,
  mapSupabaseError,
  isDatabaseError,
  isRecoverableError,
  getErrorRecoveryStrategy,
  formatErrorForLog,
  SUPABASE_ERROR_CODES,
} from './errors';
import { runHealthCheck, HealthCheckScheduler } from './healthCheck';

describe('QueryBuilder Utils', () => {
  describe('buildSelectQuery', () => {
    it('should build query with default options', () => {
      const query = buildSelectQuery('robots');
      
      expect(query.table).toBe('robots');
      expect(query.select).toBe('*');
      expect(query.filters).toHaveLength(1);
      expect(query.filters[0]).toEqual(SOFT_DELETE_FILTER);
      expect(query.sort.column).toBe(DEFAULT_QUERY_OPTIONS.sortBy);
      expect(query.sort.direction).toBe(DEFAULT_QUERY_OPTIONS.sortOrder);
    });

    it('should include user filter when userId is provided', () => {
      const query = buildSelectQuery('robots', { userId: 'user-123' });
      
      expect(query.filters).toHaveLength(2);
      expect(query.filters.find(f => f.column === 'user_id')).toBeDefined();
    });

    it('should include deleted records when includeDeleted is true', () => {
      const query = buildSelectQuery('robots', { includeDeleted: true });
      
      expect(query.filters).toHaveLength(0);
    });

    it('should calculate correct pagination offset', () => {
      const query = buildSelectQuery('robots', { page: 3, limit: 20 });
      
      expect(query.pagination.offset).toBe(40);
      expect(query.pagination.limit).toBe(20);
    });

    it('should use custom select columns', () => {
      const query = buildSelectQuery('robots', { select: 'id, name, code' });
      
      expect(query.select).toBe('id, name, code');
    });

    it('should use custom sort options', () => {
      const query = buildSelectQuery('robots', { sortBy: 'name', sortOrder: 'asc' });
      
      expect(query.sort.column).toBe('name');
      expect(query.sort.direction).toBe('asc');
    });
  });

  describe('buildSearchConditions', () => {
    it('should return empty array for empty search term', () => {
      const conditions = buildSearchConditions('', ['name', 'code']);
      
      expect(conditions).toHaveLength(0);
    });

    it('should build ilike conditions for each column', () => {
      const conditions = buildSearchConditions('test', ['name', 'code']);
      
      expect(conditions).toHaveLength(2);
      expect(conditions[0].operator).toBe('ilike');
      expect(conditions[0].value).toBe('%test%');
    });
  });

  describe('calculatePaginationMeta', () => {
    it('should calculate correct pagination metadata', () => {
      const meta = calculatePaginationMeta(100, 2, 20);
      
      expect(meta.totalPages).toBe(5);
      expect(meta.hasMore).toBe(true);
    });

    it('should return hasMore false on last page', () => {
      const meta = calculatePaginationMeta(100, 5, 20);
      
      expect(meta.totalPages).toBe(5);
      expect(meta.hasMore).toBe(false);
    });
  });

  describe('createPaginatedResult', () => {
    it('should create paginated result with all metadata', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = createPaginatedResult(data, 100, 1, 20);
      
      expect(result.data).toEqual(data);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(5);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('validatePagination', () => {
    it('should validate and clamp page and limit', () => {
      // limit of 0 falls back to DEFAULT (20)
      expect(validatePagination(0, 0)).toEqual({ page: 1, limit: 20 });
      // limit of 1000 is within MAX (1000), so it's kept
      expect(validatePagination(-1, 1000)).toEqual({ page: 1, limit: 1000 });
      // limit of 2000 would be clamped to MAX (1000)
      expect(validatePagination(-1, 2000)).toEqual({ page: 1, limit: 1000 });
    });

    it('should handle non-numeric inputs', () => {
      // Non-numeric falls back to DEFAULT limit (20)
      expect(validatePagination('abc', 'def')).toEqual({ page: 1, limit: 20 });
    });
  });

  describe('buildUpdatePayload', () => {
    it('should add updated_at timestamp', () => {
      const payload = buildUpdatePayload({ name: 'test' });
      
      expect(payload.name).toBe('test');
      expect(payload.updated_at).toBeDefined();
    });
  });

  describe('buildSoftDeletePayload', () => {
    it('should return deleted_at timestamp', () => {
      const payload = buildSoftDeletePayload();
      
      expect(payload.deleted_at).toBeDefined();
    });
  });

  describe('buildRestorePayload', () => {
    it('should return null deleted_at', () => {
      const payload = buildRestorePayload();
      
      expect(payload.deleted_at).toBeNull();
    });
  });

  describe('measureQuery', () => {
    it('should track successful query', async () => {
      const result = await measureQuery('test-query', async () => 'success');
      
      expect(result).toBe('success');
    });

    it('should track failed query', async () => {
      await expect(
        measureQuery('test-query', async () => {
          throw new Error('Query failed');
        })
      ).rejects.toThrow('Query failed');
    });
  });

  describe('queryPerformanceTracker', () => {
    beforeEach(() => {
      queryPerformanceTracker.clear();
    });

    it('should track metrics', () => {
      queryPerformanceTracker.track({
        query: 'test',
        duration: 100,
        timestamp: Date.now(),
        success: true,
      });
      
      const metrics = queryPerformanceTracker.getRecentMetrics();
      expect(metrics).toHaveLength(1);
    });

    it('should calculate average duration', () => {
      queryPerformanceTracker.track({
        query: 'test',
        duration: 100,
        timestamp: Date.now(),
        success: true,
      });
      queryPerformanceTracker.track({
        query: 'test',
        duration: 200,
        timestamp: Date.now(),
        success: true,
      });
      
      expect(queryPerformanceTracker.getAverageDuration('test')).toBe(150);
    });

    it('should identify slow queries', () => {
      queryPerformanceTracker.track({
        query: 'slow-query',
        duration: 2000,
        timestamp: Date.now(),
        success: true,
      });
      
      const slowQueries = queryPerformanceTracker.getSlowQueries(1000);
      expect(slowQueries).toHaveLength(1);
    });
  });
});

describe('Database Errors', () => {
  describe('Error Classes', () => {
    it('should create DatabaseError with all properties', () => {
      const error = new DatabaseError('Test error', 'TEST_CODE', {
        table: 'robots',
        operation: 'select',
        recoverable: true,
      });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.table).toBe('robots');
      expect(error.operation).toBe('select');
      expect(error.recoverable).toBe(true);
    });

    it('should create DatabaseConnectionError', () => {
      const error = new DatabaseConnectionError('Connection failed');
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.recoverable).toBe(true);
    });

    it('should create DatabaseTimeoutError', () => {
      const error = new DatabaseTimeoutError('Query timeout', {
        table: 'robots',
        operation: 'select',
      });
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.recoverable).toBe(true);
    });

    it('should create DatabaseNotFoundError', () => {
      const error = new DatabaseNotFoundError('Robot not found', {
        table: 'robots',
        operation: 'get',
      });
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.recoverable).toBe(false);
    });

    it('should create DatabaseConstraintError', () => {
      const error = new DatabaseConstraintError('Unique violation', {
        table: 'robots',
        constraint: 'unique',
      });
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.constraint).toBe('unique');
    });

    it('should create DatabasePermissionError', () => {
      const error = new DatabasePermissionError('Permission denied', {
        table: 'robots',
        operation: 'select',
      });
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.recoverable).toBe(false);
      expect(error.code).toBe('DB_PERMISSION_ERROR');
    });

    it('should create DatabaseQuotaError', () => {
      const error = new DatabaseQuotaError('Quota exceeded');
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.recoverable).toBe(false);
      expect(error.code).toBe('DB_QUOTA_ERROR');
    });
  });

  describe('mapSupabaseError', () => {
    it('should map connection error', () => {
      const error = mapSupabaseError({
        code: SUPABASE_ERROR_CODES.CONNECTION_ERROR,
        message: 'Connection failed',
      });
      
      expect(error).toBeInstanceOf(DatabaseConnectionError);
    });

    it('should map unique violation', () => {
      const error = mapSupabaseError({
        code: SUPABASE_ERROR_CODES.UNIQUE_VIOLATION,
        message: 'Duplicate key',
      }, 'robots', 'insert');
      
      expect(error).toBeInstanceOf(DatabaseConstraintError);
    });

    it('should map not found', () => {
      const error = mapSupabaseError({
        code: SUPABASE_ERROR_CODES.NOT_FOUND,
        message: 'Not found',
      }, 'robots', 'get');
      
      expect(error).toBeInstanceOf(DatabaseNotFoundError);
    });

    it('should default to DatabaseQueryError', () => {
      const error = mapSupabaseError({
        message: 'Unknown error',
      });
      
      expect(error).toBeInstanceOf(DatabaseQueryError);
    });
  });

  describe('isDatabaseError', () => {
    it('should return true for DatabaseError', () => {
      expect(isDatabaseError(new DatabaseError('test', 'CODE'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isDatabaseError(new Error('test'))).toBe(false);
    });
  });

  describe('isRecoverableError', () => {
    it('should return true for recoverable errors', () => {
      expect(isRecoverableError(new DatabaseConnectionError('test'))).toBe(true);
    });

    it('should return false for non-recoverable errors', () => {
      expect(isRecoverableError(new DatabaseNotFoundError('test'))).toBe(false);
    });
  });

  describe('getErrorRecoveryStrategy', () => {
    it('should suggest retry for connection errors', () => {
      const strategy = getErrorRecoveryStrategy(new DatabaseConnectionError('test'));
      
      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.fallbackAction).toBe('cache');
    });

    it('should not retry for validation errors', () => {
      const strategy = getErrorRecoveryStrategy(new DatabaseValidationError('test'));
      
      expect(strategy.shouldRetry).toBe(false);
    });
  });

  describe('formatErrorForLog', () => {
    it('should format error with all details', () => {
      const error = new DatabaseError('Test error', 'TEST_CODE', {
        table: 'robots',
        operation: 'select',
        recoverable: true,
      });
      
      const formatted = formatErrorForLog(error);
      
      expect(formatted).toContain('DatabaseError');
      expect(formatted).toContain('code=TEST_CODE');
      expect(formatted).toContain('table=robots');
      expect(formatted).toContain('operation=select');
    });
  });
});

describe('Health Check', () => {
  describe('runHealthCheck', () => {
    it('should return unhealthy for null client', async () => {
      const result = await runHealthCheck(null);
      
      expect(result.status).toBe('unhealthy');
      expect(result.details.connection).toBe(false);
    });

    it('should return healthy for working client', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
      
      const result = await runHealthCheck(mockClient as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            limit: (limit: number) => Promise<{ data: unknown; error: { message: string } | null }>;
          };
        };
      }, { includeMetrics: false }); // Disable metrics for this test
      
      expect(result.status).toBe('healthy');
      expect(result.details.connection).toBe(true);
      expect(result.details.queryable).toBe(true);
      expect(result.details.responsive).toBe(true);
    });

    it('should return unhealthy for error response', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Query failed' } }),
          }),
        }),
      };
      
      const result = await runHealthCheck(mockClient as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            limit: (limit: number) => Promise<{ data: unknown; error: { message: string } | null }>;
          };
        };
      }, { includeMetrics: false }); // Disable metrics for this test
      
      expect(result.status).toBe('unhealthy');
      expect(result.details.queryable).toBe(false);
    });
  });

  describe('HealthCheckScheduler', () => {
    it('should track consecutive failures', () => {
      const scheduler = new HealthCheckScheduler();
      
      expect(scheduler.getConsecutiveFailures()).toBe(0);
      expect(scheduler.isHealthy()).toBe(false);
      expect(scheduler.getLastResult()).toBeNull();
    });

    it('should stop scheduler', () => {
      const scheduler = new HealthCheckScheduler();
      scheduler.stop();
      
      // No error should occur
      expect(scheduler.getLastResult()).toBeNull();
    });
  });
});
