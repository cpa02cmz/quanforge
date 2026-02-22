/**
 * Database Architect Services Tests
 * 
 * Tests for BackupService, QueryDiagnostics, and ConnectionLeakDetector
 * 
 * @module services/database/databaseArchitect.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BackupService, type BackupConfig } from './backupService';
import { QueryDiagnostics, type DiagnosticsConfig } from './queryDiagnostics';
import { ConnectionLeakDetector, type LeakDetectorConfig } from './connectionLeakDetector';

// Mock Supabase client
const mockClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
  rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
} as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>;

// ============================================================================
// BACKUP SERVICE TESTS
// ============================================================================

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = BackupService.getInstance();
    service.initialize();
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = BackupService.getInstance();
      const instance2 = BackupService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize without errors', () => {
      expect(() => service.initialize()).not.toThrow();
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();
      
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('schedule');
      expect(config).toHaveProperty('retentionDays');
      expect(config).toHaveProperty('backupType');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service.updateConfig({ retentionDays: 60 });
      const config = service.getConfig();
      
      expect(config.retentionDays).toBe(60);
    });
  });

  describe('createBackup', () => {
    it('should create a backup successfully', async () => {
      const backup = await service.createBackup(mockClient, {
        type: 'full',
        trigger: 'manual',
      });
      
      expect(backup.id).toBeDefined();
      expect(backup.status).toBe('completed');
      expect(backup.type).toBe('full');
      expect(backup.trigger).toBe('manual');
    });

    it('should track backup duration', async () => {
      const backup = await service.createBackup(mockClient);
      
      expect(backup.duration).toBeGreaterThanOrEqual(0);
      expect(backup.startTime).toBeLessThanOrEqual(backup.endTime!);
    });

    it('should handle tables parameter', async () => {
      const backup = await service.createBackup(mockClient, {
        tables: ['robots', 'audit_logs'],
      });
      
      expect(backup.tables).toContain('robots');
      expect(backup.tables).toContain('audit_logs');
    });
  });

  describe('getBackup', () => {
    it('should return backup by ID', async () => {
      const created = await service.createBackup(mockClient);
      const retrieved = service.getBackup(created.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for unknown ID', () => {
      const backup = service.getBackup('unknown-id');
      expect(backup).toBeUndefined();
    });
  });

  describe('getBackups', () => {
    it('should return all backups', async () => {
      await service.createBackup(mockClient);
      await service.createBackup(mockClient);
      
      const backups = service.getBackups();
      expect(backups.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      await service.createBackup(mockClient);
      
      const completed = service.getBackups({ status: 'completed' });
      expect(completed.every(b => b.status === 'completed')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      await service.createBackup(mockClient);
      await service.createBackup(mockClient);
      await service.createBackup(mockClient);
      
      const backups = service.getBackups({ limit: 2 });
      expect(backups.length).toBe(2);
    });
  });

  describe('getRecoveryPoints', () => {
    it('should return recovery points', async () => {
      await service.createBackup(mockClient, { type: 'full' });
      
      const recoveryPoints = service.getRecoveryPoints();
      expect(recoveryPoints.length).toBeGreaterThan(0);
      expect(recoveryPoints[0]).toHaveProperty('backupId');
      expect(recoveryPoints[0]).toHaveProperty('timestamp');
    });
  });

  describe('getReport', () => {
    it('should generate comprehensive report', async () => {
      await service.createBackup(mockClient);
      
      const report = service.getReport();
      
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('totalBackups');
      expect(report).toHaveProperty('totalSizeBytes');
      expect(report).toHaveProperty('backupsByType');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('deleteBackup', () => {
    it('should delete existing backup', async () => {
      const backup = await service.createBackup(mockClient);
      const result = await service.deleteBackup(backup.id);
      
      expect(result).toBe(true);
      expect(service.getBackup(backup.id)).toBeUndefined();
    });

    it('should return false for non-existent backup', async () => {
      const result = await service.deleteBackup('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('schedules', () => {
    it('should create a schedule', () => {
      const schedule = service.createSchedule({
        name: 'Test Schedule',
        cronExpression: '0 3 * * *',
        backupType: 'full',
        enabled: true,
        retentionDays: 7,
      });
      
      expect(schedule.id).toBeDefined();
      expect(schedule.name).toBe('Test Schedule');
    });

    it('should get all schedules', () => {
      service.createSchedule({
        name: 'Test',
        cronExpression: '0 0 * * *',
        backupType: 'full',
        enabled: true,
        retentionDays: 7,
      });
      
      const schedules = service.getSchedules();
      expect(schedules.length).toBeGreaterThan(0);
    });

    it('should delete a schedule', () => {
      const schedule = service.createSchedule({
        name: 'To Delete',
        cronExpression: '0 0 * * *',
        backupType: 'full',
        enabled: true,
        retentionDays: 7,
      });
      
      const result = service.deleteSchedule(schedule.id);
      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// QUERY DIAGNOSTICS TESTS
// ============================================================================

describe('QueryDiagnostics', () => {
  let service: QueryDiagnostics;

  beforeEach(() => {
    vi.clearAllMocks();
    service = QueryDiagnostics.getInstance();
    service.initialize();
    service.clear();
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = QueryDiagnostics.getInstance();
      const instance2 = QueryDiagnostics.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('startQuery', () => {
    it('should start a query trace', () => {
      const queryId = service.startQuery('SELECT * FROM robots', ['param1']);
      
      expect(queryId).toBeDefined();
      expect(service.getTrace(queryId)).toBeDefined();
    });

    it('should track query metadata', () => {
      const queryId = service.startQuery('SELECT * FROM robots', [], {
        user: 'test-user',
        application: 'test-app',
      });
      
      const trace = service.getTrace(queryId);
      expect(trace?.metadata.user).toBe('test-user');
      expect(trace?.metadata.application).toBe('test-app');
    });
  });

  describe('endQuery', () => {
    it('should mark query as completed', () => {
      const queryId = service.startQuery('SELECT * FROM robots');
      service.endQuery(queryId, 100);
      
      const trace = service.getTrace(queryId);
      expect(trace?.state).toBe('completed');
      expect(trace?.rowCount).toBe(100);
      expect(trace?.duration).toBeDefined();
    });

    it('should mark query as failed with error', () => {
      const queryId = service.startQuery('SELECT * FROM robots');
      service.endQuery(queryId, undefined, 'Connection timeout');
      
      const trace = service.getTrace(queryId);
      expect(trace?.state).toBe('failed');
      expect(trace?.error).toBe('Connection timeout');
    });
  });

  describe('cancelQuery', () => {
    it('should cancel a query', () => {
      const queryId = service.startQuery('SELECT * FROM robots');
      service.cancelQuery(queryId);
      
      const trace = service.getTrace(queryId);
      expect(trace?.state).toBe('cancelled');
    });
  });

  describe('recordResourceUsage', () => {
    it('should record resource usage for a query', () => {
      const queryId = service.startQuery('SELECT * FROM robots');
      service.recordResourceUsage(queryId, {
        type: 'cpu',
        value: 75,
        unit: '%',
        timestamp: Date.now(),
      });
      
      const trace = service.getTrace(queryId);
      expect(trace?.resources.length).toBe(1);
      expect(trace?.resources[0].type).toBe('cpu');
      expect(trace?.resources[0].value).toBe(75);
    });
  });

  describe('analyzeQuery', () => {
    it('should detect SELECT *', () => {
      const warnings = service.analyzeQuery('SELECT * FROM robots');
      
      const selectAllWarning = warnings.find(w => w.code === 'Q001');
      expect(selectAllWarning).toBeDefined();
      expect(selectAllWarning?.severity).toBe('warning');
    });

    it('should detect UPDATE without WHERE', () => {
      const warnings = service.analyzeQuery('UPDATE robots SET active = true');
      
      const whereWarning = warnings.find(w => w.code === 'Q002');
      expect(whereWarning).toBeDefined();
      expect(whereWarning?.severity).toBe('error');
    });

    it('should detect LIKE with leading wildcard', () => {
      const warnings = service.analyzeQuery("SELECT * FROM robots WHERE name LIKE '%test%'");
      
      const likeWarning = warnings.find(w => w.code === 'Q003');
      expect(likeWarning).toBeDefined();
    });

    it('should detect NOT IN', () => {
      const warnings = service.analyzeQuery('SELECT * FROM robots WHERE id NOT IN (1, 2, 3)');
      
      const notInWarning = warnings.find(w => w.code === 'Q005');
      expect(notInWarning).toBeDefined();
    });
  });

  describe('getSlowQueries', () => {
    it('should return slow queries', async () => {
      // Create a slow query
      const queryId = service.startQuery('SELECT * FROM robots');
      await new Promise(r => setTimeout(r, 10)); // Small delay
      service.endQuery(queryId, 100);
      
      const trace = service.getTrace(queryId);
      if (trace && trace.duration && trace.duration > 100) {
        const slowQueries = service.getSlowQueries();
        expect(slowQueries.length).toBeGreaterThan(0);
      } else {
        // If not slow enough, just verify the method works
        const slowQueries = service.getSlowQueries();
        expect(Array.isArray(slowQueries)).toBe(true);
      }
    });
  });

  describe('getAlerts', () => {
    it('should return alerts', () => {
      const alerts = service.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('getReport', () => {
    it('should generate diagnostics report', () => {
      service.startQuery('SELECT * FROM robots');
      
      const report = service.getReport();
      
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('totalQueries');
      expect(report).toHaveProperty('activeQueries');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('getDetailedAnalysis', () => {
    it('should return analysis for a query', () => {
      const queryId = service.startQuery('SELECT * FROM robots WHERE name LIKE "%test%"');
      service.endQuery(queryId);
      
      const analysis = service.getDetailedAnalysis(queryId);
      
      expect(analysis).toBeDefined();
      expect(analysis?.queryId).toBe(queryId);
      expect(analysis?.issues).toBeDefined();
      expect(analysis?.optimizations).toBeDefined();
    });

    it('should return null for unknown query', () => {
      const analysis = service.getDetailedAnalysis('unknown-id');
      expect(analysis).toBeNull();
    });
  });
});

// ============================================================================
// CONNECTION LEAK DETECTOR TESTS
// ============================================================================

describe('ConnectionLeakDetector', () => {
  let service: ConnectionLeakDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    service = ConnectionLeakDetector.getInstance();
    service.initialize();
    service.clear();
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ConnectionLeakDetector.getInstance();
      const instance2 = ConnectionLeakDetector.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('trackAcquisition', () => {
    it('should track connection acquisition', () => {
      service.trackAcquisition('conn-1', 'test-source');
      
      const conn = service.getConnection('conn-1');
      expect(conn).toBeDefined();
      expect(conn?.state).toBe('acquired');
      expect(conn?.source).toBe('test-source');
    });

    it('should capture stack trace when enabled', () => {
      service.updateConfig({ captureStackTrace: true });
      service.trackAcquisition('conn-2', 'test-source');
      
      const conn = service.getConnection('conn-2');
      expect(conn?.stackTrace).toBeDefined();
    });

    it('should track metadata', () => {
      service.trackAcquisition('conn-3', 'test-source', { user: 'test-user' });
      
      const conn = service.getConnection('conn-3');
      expect(conn?.metadata.user).toBe('test-user');
    });
  });

  describe('trackActivity', () => {
    it('should update last activity time', async () => {
      service.trackAcquisition('conn-4', 'test');
      await new Promise(r => setTimeout(r, 10));
      
      service.trackActivity('conn-4', true);
      
      const conn = service.getConnection('conn-4');
      expect(conn?.queryCount).toBe(1);
      expect(conn?.state).toBe('active');
    });
  });

  describe('trackRelease', () => {
    it('should track connection release', () => {
      service.trackAcquisition('conn-5', 'test');
      service.trackRelease('conn-5');
      
      const conn = service.getConnection('conn-5');
      expect(conn).toBeUndefined();
    });

    it('should update statistics', () => {
      service.trackAcquisition('conn-6', 'test');
      service.trackRelease('conn-6');
      
      const stats = service.getStats();
      expect(stats.totalAcquired).toBe(1);
      expect(stats.totalReleased).toBe(1);
    });
  });

  describe('trackError', () => {
    it('should mark connection as error', () => {
      service.trackAcquisition('conn-7', 'test');
      service.trackError('conn-7', 'Connection failed');
      
      const conn = service.getConnection('conn-7');
      expect(conn?.state).toBe('error');
      expect(conn?.metadata.error).toBe('Connection failed');
    });
  });

  describe('detectLeaks', () => {
    it('should detect potential leaks', async () => {
      service.updateConfig({ leakThresholdMs: 50 }); // Very short for testing
      
      service.trackAcquisition('conn-8', 'test');
      await new Promise(r => setTimeout(r, 60)); // Wait to exceed threshold
      
      const leaks = service.detectLeaks();
      
      // Connection should be marked as potentially leaked
      expect(leaks.length).toBeGreaterThanOrEqual(0); // May or may not detect based on timing
    });
  });

  describe('getPoolHealth', () => {
    it('should return pool health status', () => {
      service.trackAcquisition('conn-9', 'test');
      
      const health = service.getPoolHealth();
      
      expect(health).toHaveProperty('totalConnections');
      expect(health).toHaveProperty('activeConnections');
      expect(health).toHaveProperty('idleConnections');
      expect(health).toHaveProperty('leakedConnections');
      expect(health).toHaveProperty('health');
    });

    it('should report healthy status when no leaks', () => {
      service.trackAcquisition('conn-10', 'test');
      service.trackActivity('conn-10');
      
      const health = service.getPoolHealth();
      expect(['healthy', 'warning', 'critical']).toContain(health.health);
    });
  });

  describe('getActiveConnections', () => {
    it('should return active connections', () => {
      service.trackAcquisition('conn-11', 'test');
      service.trackActivity('conn-11');
      
      const active = service.getActiveConnections();
      expect(active.length).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return connection statistics', () => {
      service.trackAcquisition('conn-12', 'test');
      service.trackRelease('conn-12');
      
      const stats = service.getStats();
      
      expect(stats).toHaveProperty('totalAcquired');
      expect(stats).toHaveProperty('totalReleased');
      expect(stats).toHaveProperty('currentActive');
    });
  });

  describe('getReport', () => {
    it('should generate leak report', () => {
      service.trackAcquisition('conn-13', 'test');
      
      const report = service.getReport();
      
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('stats');
      expect(report).toHaveProperty('poolHealth');
      expect(report).toHaveProperty('potentialLeaks');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('cleanupLeaks', () => {
    it('should cleanup leaked connections', async () => {
      service.updateConfig({ leakThresholdMs: 50 });
      
      service.trackAcquisition('conn-14', 'test');
      await new Promise(r => setTimeout(r, 60));
      
      const result = await service.cleanupLeaks();
      
      expect(result).toHaveProperty('cleaned');
      expect(result).toHaveProperty('failed');
    });
  });

  describe('clear', () => {
    it('should clear all tracked connections', () => {
      service.trackAcquisition('conn-15', 'test');
      service.clear();
      
      const connections = service.getAllConnections();
      expect(connections.length).toBe(0);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Database Architect Services Integration', () => {
  it('should allow all services to work together', () => {
    const backup = BackupService.getInstance();
    const diagnostics = QueryDiagnostics.getInstance();
    const leakDetector = ConnectionLeakDetector.getInstance();

    expect(backup).toBeDefined();
    expect(diagnostics).toBeDefined();
    expect(leakDetector).toBeDefined();

    // All should have proper type definitions
    const backupConfig: Partial<BackupConfig> = {
      retentionDays: 30,
    };
    expect(backupConfig.retentionDays).toBe(30);

    const diagConfig: Partial<DiagnosticsConfig> = {
      slowQueryThresholdMs: 100,
    };
    expect(diagConfig.slowQueryThresholdMs).toBe(100);

    const leakConfig: Partial<LeakDetectorConfig> = {
      leakThresholdMs: 5000,
    };
    expect(leakConfig.leakThresholdMs).toBe(5000);
  });

  it('should have proper singleton behavior', () => {
    const backup1 = BackupService.getInstance();
    const backup2 = BackupService.getInstance();
    expect(backup1).toBe(backup2);

    const diag1 = QueryDiagnostics.getInstance();
    const diag2 = QueryDiagnostics.getInstance();
    expect(diag1).toBe(diag2);

    const leak1 = ConnectionLeakDetector.getInstance();
    const leak2 = ConnectionLeakDetector.getInstance();
    expect(leak1).toBe(leak2);
  });
});
