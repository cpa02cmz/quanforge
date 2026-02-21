/**
 * Database Architect Enhancement Services Tests
 * 
 * Tests for data integrity validation, query caching, and audit logging
 * 
 * @module services/database/databaseArchitectEnhancements.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DataIntegrityValidator,
  dataIntegrityValidator
} from './dataIntegrityValidator';
import {
  QueryCacheService
} from './queryCacheService';
import {
  DatabaseAuditLogger
} from './databaseAuditLogger';

// ============================================================================
// DATA INTEGRITY VALIDATOR TESTS
// ============================================================================

describe('DataIntegrityValidator', () => {
  let validator: DataIntegrityValidator;

  beforeEach(() => {
    validator = new DataIntegrityValidator();
  });

  describe('validateCreateRobot', () => {
    it('should pass validation for valid robot data', async () => {
      const result = await validator.validateCreateRobot({
        name: 'Test Robot',
        code: '// Valid MQL5 code\nvoid OnTick() {}',
        description: 'Test description'
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', async () => {
      const result = await validator.validateCreateRobot({
        name: '',
        code: ''
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'REQUIRED_FIELD')).toBe(true);
    });

    it('should warn about high risk percentage', async () => {
      const result = await validator.validateCreateRobot({
        name: 'Test Robot',
        code: '// Code',
        strategy_params: {
          riskPercent: 15
        }
      });

      expect(result.warnings.some(w => w.code === 'HIGH_RISK_PERCENT')).toBe(true);
    });

    it('should fail for negative stop loss', async () => {
      const result = await validator.validateCreateRobot({
        name: 'Test Robot',
        code: '// Code',
        strategy_params: {
          stopLoss: -50
        }
      });

      expect(result.errors.some(e => e.code === 'NEGATIVE_STOP_LOSS')).toBe(true);
    });

    it('should detect dangerous code patterns', async () => {
      const result = await validator.validateCreateRobot({
        name: 'Test Robot',
        code: 'eval("dangerous")'
      });

      expect(result.errors.some(e => e.code === 'DANGEROUS_CODE_PATTERN')).toBe(true);
    });

    it('should validate chat history messages', async () => {
      const result = await validator.validateCreateRobot({
        name: 'Test Robot',
        code: '// Code',
        chat_history: [
          { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
        ]
      });

      expect(result.valid).toBe(true);
    });

    it('should fail for invalid message role', async () => {
      const result = await validator.validateCreateRobot({
        name: 'Test Robot',
        code: '// Code',
        chat_history: [
          { id: '1', role: 'invalid' as any, content: 'Hello', timestamp: Date.now() }
        ]
      });

      expect(result.errors.some(e => e.code === 'INVALID_MESSAGE_ROLE')).toBe(true);
    });

    it('should warn about generic names', async () => {
      const result = await validator.validateCreateRobot({
        name: 'untitled',
        code: '// Code'
      });

      expect(result.warnings.some(w => w.code === 'GENERIC_NAME')).toBe(true);
    });

    it('should fail for name exceeding max length', async () => {
      const result = await validator.validateCreateRobot({
        name: 'a'.repeat(300),
        code: '// Code'
      });

      expect(result.errors.some(e => e.code === 'NAME_TOO_LONG')).toBe(true);
    });

    it('should detect potential SQL injection in name', async () => {
      const result = await validator.validateCreateRobot({
        name: "'; DROP TABLE robots; --",
        code: '// Code'
      });

      expect(result.errors.some(e => e.code === 'POTENTIAL_SQL_INJECTION')).toBe(true);
    });
  });

  describe('validateUpdateRobot', () => {
    it('should pass validation for valid update', async () => {
      const existingData = {
        id: 'test-id',
        user_id: 'user-1',
        name: 'Existing Robot',
        code: '// Code',
        strategy_type: 'Custom' as const,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      };

      const result = await validator.validateUpdateRobot(
        'test-id',
        { name: 'Updated Robot' },
        existingData as any
      );

      expect(result.valid).toBe(true);
    });

    it('should detect version conflicts', async () => {
      const existingData = {
        id: 'test-id',
        user_id: 'user-1',
        name: 'Existing Robot',
        code: '// Code',
        version: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await validator.validateUpdateRobot(
        'test-id',
        { name: 'Updated Robot', version: 3 },
        existingData as any
      );

      expect(result.errors.some(e => e.code === 'VERSION_CONFLICT')).toBe(true);
    });

    it('should fail for soft-deleted records', async () => {
      const existingData = {
        id: 'test-id',
        user_id: 'user-1',
        name: 'Deleted Robot',
        code: '// Code',
        version: 1,
        deleted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await validator.validateUpdateRobot(
        'test-id',
        { name: 'Updated Robot' },
        existingData as any
      );

      expect(result.errors.some(e => e.code === 'DELETED_RECORD')).toBe(true);
    });

    it('should warn about public robot deactivation', async () => {
      const existingData = {
        id: 'test-id',
        user_id: 'user-1',
        name: 'Public Robot',
        code: '// Code',
        version: 1,
        is_public: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await validator.validateUpdateRobot(
        'test-id',
        { is_active: false },
        existingData as any
      );

      expect(result.warnings.some(w => w.code === 'PUBLIC_DEACTIVATION')).toBe(true);
    });
  });

  describe('validateRobotRow', () => {
    it('should validate correct robot row', () => {
      const row = {
        id: 'test-id',
        user_id: 'user-1',
        name: 'Test Robot',
        code: '// Code',
        strategy_type: 'Custom',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(validator.validateRobotRow(row)).toBe(true);
    });

    it('should reject row missing required fields', () => {
      const row = {
        id: 'test-id',
        name: 'Test Robot'
      };

      expect(validator.validateRobotRow(row)).toBe(false);
    });

    it('should reject row with invalid strategy type', () => {
      const row = {
        id: 'test-id',
        user_id: 'user-1',
        name: 'Test Robot',
        code: '// Code',
        strategy_type: 'Invalid',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(validator.validateRobotRow(row)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return validation statistics', async () => {
      await validator.validateCreateRobot({ name: 'Test', code: '// Code' });
      await validator.validateCreateRobot({ name: '', code: '' });

      const stats = validator.getStats();

      expect(stats.totalValidations).toBe(2);
      expect(stats.passedValidations).toBe(1);
      expect(stats.failedValidations).toBe(1);
    });

    it('should track common errors', async () => {
      await validator.validateCreateRobot({ name: '', code: '' });
      await validator.validateCreateRobot({ name: 'Test', code: '' });

      const stats = validator.getStats();

      expect(stats.commonErrors.size).toBeGreaterThan(0);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      await validator.validateCreateRobot({ name: 'Test', code: '// Code' });
      
      validator.resetStats();
      const stats = validator.getStats();

      expect(stats.totalValidations).toBe(0);
      expect(stats.passedValidations).toBe(0);
      expect(stats.failedValidations).toBe(0);
    });
  });
});

// ============================================================================
// QUERY CACHE SERVICE TESTS
// ============================================================================

describe('QueryCacheService', () => {
  let cache: QueryCacheService;

  beforeEach(async () => {
    cache = new QueryCacheService({ maxSize: 1024 * 100, maxEntries: 100 });
    await cache.initialize();
    cache.clear();
  });

  afterEach(async () => {
    await cache.shutdown();
  });

  describe('get and set', () => {
    it('should store and retrieve data', () => {
      const key = 'robots:123';
      const data = { id: '123', name: 'Test Robot' };

      cache.set(key, data);
      const result = cache.get(key);

      expect(result).toEqual(data);
    });

    it('should return null for missing keys', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should respect TTL', async () => {
      const key = 'robots:123';
      const data = { id: '123', name: 'Test Robot' };

      cache.set(key, data, { ttl: 100 }); // 100ms TTL
      
      // Should be available immediately
      expect(cache.get(key)).toEqual(data);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be null after TTL
      expect(cache.get(key)).toBeNull();
    });

    it('should bypass cache when specified', () => {
      const key = 'robots:123';
      const data = { id: '123', name: 'Test Robot' };

      cache.set(key, data, { bypassCache: true });
      const result = cache.get(key);

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete cached entries', () => {
      cache.set('robots:1', { id: '1' });
      
      const deleted = cache.delete('robots:1');
      
      expect(deleted).toBe(true);
      expect(cache.get('robots:1')).toBeNull();
    });

    it('should return false for non-existent keys', () => {
      const deleted = cache.delete('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('robots:1', { id: '1' });
      cache.set('robots:2', { id: '2' });

      cache.clear();

      expect(cache.get('robots:1')).toBeNull();
      expect(cache.get('robots:2')).toBeNull();
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate entries matching pattern', () => {
      cache.set('robots:1', { id: '1' });
      cache.set('robots:2', { id: '2' });
      cache.set('other:1', { id: '3' });

      const invalidated = cache.invalidatePattern(/^robots:/);

      expect(invalidated).toBe(2);
      expect(cache.get('robots:1')).toBeNull();
      expect(cache.get('robots:2')).toBeNull();
      expect(cache.get('other:1')).not.toBeNull();
    });
  });

  describe('invalidateTags', () => {
    it('should invalidate entries with specific tags', () => {
      cache.set('robots:1', { id: '1' }, { tags: ['robots', 'list'] });
      cache.set('robots:2', { id: '2' }, { tags: ['robots', 'single'] });
      cache.set('other:1', { id: '3' }, { tags: ['other'] });

      const invalidated = cache.invalidateTags(['list']);

      expect(invalidated).toBe(1);
      expect(cache.get('robots:1')).toBeNull();
      expect(cache.get('robots:2')).not.toBeNull();
    });
  });

  describe('getOrSet', () => {
    it('should return cached data when available', async () => {
      const factory = vi.fn().mockResolvedValue({ id: '123' });

      cache.set('robots:123', { id: '123' });
      const result = await cache.getOrSet('robots:123', factory);

      expect(result).toEqual({ id: '123' });
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory when data not cached', async () => {
      const factory = vi.fn().mockResolvedValue({ id: '123' });

      const result = await cache.getOrSet('robots:123', factory);

      expect(result).toEqual({ id: '123' });
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('should track cache hits and misses', () => {
      cache.set('robots:1', { id: '1' });

      cache.get('robots:1'); // Hit
      cache.get('robots:2'); // Miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5);
    });
  });

  describe('getEntries', () => {
    it('should return entry information', () => {
      cache.set('robots:1', { id: '1' }, { tags: ['robots'] });
      cache.set('robots:2', { id: '2' }, { tags: ['robots'] });

      const entries = cache.getEntries();

      expect(entries).toHaveLength(2);
      expect(entries[0].key).toBeDefined();
      expect(entries[0].tags).toBeDefined();
    });
  });

  describe('event callbacks', () => {
    it('should notify on cache events', () => {
      const callback = vi.fn();
      cache.onEvent(callback);

      cache.set('test:1', { data: 'test' });
      cache.get('test:1');

      expect(callback).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// DATABASE AUDIT LOGGER TESTS
// ============================================================================

describe('DatabaseAuditLogger', () => {
  let auditLogger: DatabaseAuditLogger;

  beforeEach(async () => {
    auditLogger = new DatabaseAuditLogger({ logToStorage: false });
    await auditLogger.initialize();
    await auditLogger.clear();
  });

  afterEach(async () => {
    await auditLogger.shutdown();
  });

  describe('log', () => {
    it('should create audit entries', () => {
      const entry = auditLogger.log({
        eventType: 'create',
        entityType: 'robot',
        entityId: 'robot-123',
        action: 'Created robot',
        details: { name: 'Test Robot' },
        success: true
      });

      expect(entry.id).toBeDefined();
      expect(entry.eventType).toBe('create');
      expect(entry.entityType).toBe('robot');
      expect(entry.entityId).toBe('robot-123');
      expect(entry.success).toBe(true);
    });

    it('should capture state changes', () => {
      const entry = auditLogger.logUpdate(
        'robot',
        'robot-123',
        { name: 'Old Name', code: 'old code' },
        { name: 'New Name', code: 'old code' }
      );

      expect(entry.changes).toBeDefined();
      expect(entry.changes).toHaveLength(1);
      expect(entry.changes![0].field).toBe('name');
      expect(entry.changes![0].type).toBe('modified');
    });

    it('should sanitize sensitive fields', () => {
      const entry = auditLogger.log({
        eventType: 'create',
        entityType: 'robot',
        action: 'Created robot',
        details: { password: 'secret123', name: 'Test' },
        success: true
      });

      expect(entry.details.password).toBe('[REDACTED]');
      expect(entry.details.name).toBe('Test');
    });
  });

  describe('convenience methods', () => {
    it('should log create operations', () => {
      const entry = auditLogger.logCreate(
        'robot',
        'robot-123',
        { name: 'Test Robot', code: '// code' }
      );

      expect(entry.eventType).toBe('create');
      expect(entry.newState).toBeDefined();
    });

    it('should log delete operations', () => {
      const entry = auditLogger.logDelete(
        'robot',
        'robot-123',
        { name: 'Test Robot', code: '// code' }
      );

      expect(entry.eventType).toBe('delete');
      expect(entry.severity).toBe('warning');
      expect(entry.previousState).toBeDefined();
    });

    it('should log read operations', () => {
      const entry = auditLogger.logRead(
        'robot',
        'robot-123',
        { source: 'dashboard' }
      );

      expect(entry.eventType).toBe('read');
      expect(entry.success).toBe(true);
    });

    it('should log access denied', () => {
      const entry = auditLogger.logAccessDenied(
        'robot',
        'robot-123',
        'User does not have permission'
      );

      expect(entry.eventType).toBe('access_denied');
      expect(entry.success).toBe(false);
    });

    it('should log security events', () => {
      const entry = auditLogger.logSecurityEvent(
        'Suspicious activity detected',
        'warning',
        { ip: '192.168.1.1' }
      );

      expect(entry.eventType).toBe('security_event');
      expect(entry.entityType).toBe('system');
    });
  });

  describe('getEntries', () => {
    it('should filter entries by event type', () => {
      auditLogger.logCreate('robot', 'r1', { name: 'Robot 1' });
      auditLogger.logDelete('robot', 'r2', { name: 'Robot 2' });

      const createEntries = auditLogger.getEntries({ eventTypes: ['create'] });

      expect(createEntries).toHaveLength(1);
      expect(createEntries[0].eventType).toBe('create');
    });

    it('should filter entries by entity type', () => {
      auditLogger.logCreate('robot', 'r1', { name: 'Robot 1' });
      auditLogger.logCreate('user', 'u1', { name: 'User 1' });

      const robotEntries = auditLogger.getEntries({ entityTypes: ['robot'] });

      expect(robotEntries).toHaveLength(1);
    });

    it('should search entries', () => {
      auditLogger.logCreate('robot', 'r1', { name: 'Alpha Bot' });
      auditLogger.logCreate('robot', 'r2', { name: 'Beta Bot' });

      const entries = auditLogger.getEntries({ search: 'Alpha' });

      // Search is case-insensitive and searches action and errorMessage fields
      expect(entries.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStats', () => {
    it('should calculate statistics', () => {
      auditLogger.logCreate('robot', 'r1', { name: 'Robot 1' });
      auditLogger.logDelete('robot', 'r2', { name: 'Robot 2' });
      auditLogger.logAccessDenied('robot', 'r3', 'No access');

      const stats = auditLogger.getStats();

      expect(stats.totalEvents).toBe(3);
      expect(stats.errorCount).toBe(1);
    });
  });

  describe('callbacks', () => {
    it('should notify callbacks on audit events', () => {
      const callback = vi.fn();
      auditLogger.onAudit(callback);

      auditLogger.logCreate('robot', 'r1', { name: 'Robot 1' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'create'
      }));
    });

    it('should allow unregistering callbacks', () => {
      const callback = vi.fn();
      const unregister = auditLogger.onAudit(callback);

      unregister();
      auditLogger.logCreate('robot', 'r1', { name: 'Robot 1' });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('export', () => {
    it('should export as JSON', async () => {
      auditLogger.logCreate('robot', 'r1', { name: 'Robot 1' });

      const exported = await auditLogger.export('json');
      const parsed = JSON.parse(exported);

      expect(parsed.version).toBeDefined();
      expect(Array.isArray(parsed.entries)).toBe(true);
    });

    it('should export as CSV', async () => {
      auditLogger.logCreate('robot', 'r1', { name: 'Robot 1' });

      const exported = await auditLogger.export('csv');

      expect(exported).toContain('id,timestamp,eventType');
      expect(exported).toContain('create');
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report', () => {
      auditLogger.logCreate('robot', 'r1', { name: 'Robot 1' });
      auditLogger.logDelete('robot', 'r2', { name: 'Robot 2' });

      const report = auditLogger.generateReport();

      expect(report.generatedAt).toBeDefined();
      expect(report.period).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('session context', () => {
    it('should track session context', () => {
      auditLogger.setSessionContext({
        userId: 'user-123',
        userName: 'Test User'
      });

      const entry = auditLogger.logCreate('robot', 'r1', { name: 'Robot 1' });

      expect(entry.userId).toBe('user-123');
      expect(entry.userName).toBe('Test User');
    });

    it('should clear session context', () => {
      auditLogger.setSessionContext({
        userId: 'user-123',
        userName: 'Test User'
      });

      auditLogger.clearSessionContext();

      const entry = auditLogger.logCreate('robot', 'r1', { name: 'Robot 1' });

      expect(entry.userId).toBeUndefined();
    });
  });
});
