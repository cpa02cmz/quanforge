/**
 * Tests for Database Configuration Manager Service
 * 
 * @module services/database/configManager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the serviceCleanupCoordinator
vi.mock('../../utils/serviceCleanupCoordinator', () => ({
  serviceCleanupCoordinator: {
    register: vi.fn(),
  },
}));

// Mock the logger
vi.mock('../../utils/logger', () => ({
  createScopedLogger: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock modularConstants
vi.mock('../modularConstants', () => ({
  TIME_CONSTANTS: {
    SECOND: 1000,
    MINUTE: 60000,
    HOUR: 3600000,
  },
}));

import { DatabaseConfigManager } from './configManager';

describe('DatabaseConfigManager', () => {
  let manager: DatabaseConfigManager;

  beforeEach(() => {
    manager = DatabaseConfigManager.getInstance({
      enableHotReload: false,
      enableValidation: true,
      historySize: 10,
    });
    manager.initialize();
  });

  afterEach(() => {
    manager.shutdown();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const config = manager.getConfig();
      
      expect(config).toBeDefined();
      expect(config.version).toBeDefined();
      expect(config.connection).toBeDefined();
      expect(config.pool).toBeDefined();
      expect(config.cache).toBeDefined();
    });
  });

  describe('configuration access', () => {
    it('should get full configuration', () => {
      const config = manager.getConfig();
      
      expect(config).toHaveProperty('connection');
      expect(config).toHaveProperty('pool');
      expect(config).toHaveProperty('cache');
      expect(config).toHaveProperty('monitoring');
      expect(config).toHaveProperty('security');
      expect(config).toHaveProperty('performance');
    });

    it('should get configuration section', () => {
      const connection = manager.getSection('connection');
      
      expect(connection).toHaveProperty('host');
      expect(connection).toHaveProperty('port');
      expect(connection).toHaveProperty('database');
    });

    it('should get nested value by path', () => {
      const host = manager.get('connection.host');
      const port = manager.get('connection.port');
      
      expect(typeof host).toBe('string');
      expect(typeof port).toBe('number');
    });

    it('should return default for missing path', () => {
      const value = manager.get('nonexistent.path', 'default');
      
      expect(value).toBe('default');
    });
  });

  describe('configuration update', () => {
    it('should update configuration', () => {
      const result = manager.update({
        connection: {
          ...manager.getSection('connection'),
          host: 'new-host',
        },
      });

      expect(result.valid).toBe(true);
      
      const config = manager.getConfig();
      expect(config.connection.host).toBe('new-host');
    });

    it('should update specific section', () => {
      const result = manager.updateSection('pool', {
        max: 20,
      });

      expect(result.valid).toBe(true);
      
      const pool = manager.getSection('pool');
      expect(pool.max).toBe(20);
    });

    it('should set value by path', () => {
      const result = manager.set('connection.port', 5433);
      
      expect(result.valid).toBe(true);
      
      const port = manager.get('connection.port');
      expect(port).toBe(5433);
    });

    it('should reset to defaults', () => {
      manager.update({
        connection: {
          ...manager.getSection('connection'),
          host: 'custom-host',
        },
      });

      manager.reset();

      const config = manager.getConfig();
      expect(config.connection.host).toBe('localhost');
    });
  });

  describe('validation', () => {
    it('should validate valid configuration', () => {
      const config = manager.getConfig();
      const result = manager.validate(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect invalid port', () => {
      const result = manager.update({
        connection: {
          ...manager.getSection('connection'),
          port: -1,
        },
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'connection.port')).toBe(true);
    });

    it('should warn about short timeout', () => {
      const result = manager.update({
        connection: {
          ...manager.getSection('connection'),
          connectionTimeout: 100,
        },
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate pool configuration', () => {
      const result = manager.update({
        pool: {
          ...manager.getSection('pool'),
          min: 10,
          max: 5,
        },
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'pool.max')).toBe(true);
    });
  });

  describe('change notifications', () => {
    it('should notify listeners on change', () => {
      const listener = vi.fn();
      manager.onChange(listener);

      manager.update({
        connection: {
          ...manager.getSection('connection'),
          host: 'changed-host',
        },
      });

      expect(listener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = manager.onChange(listener);

      unsubscribe();

      manager.update({
        connection: {
          ...manager.getSection('connection'),
          host: 'another-host',
        },
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('should track configuration history', () => {
      manager.update({
        connection: {
          ...manager.getSection('connection'),
          host: 'history-test',
        },
      });

      const history = manager.getHistory();
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('config');
      expect(history[0]).toHaveProperty('source');
    });

    it('should rollback to previous configuration', () => {
      const originalHost = manager.get('connection.host');
      
      manager.update({
        connection: {
          ...manager.getSection('connection'),
          host: 'before-rollback',
        },
      });

      const history = manager.getHistory();
      const previousTimestamp = history[history.length - 2]?.timestamp;

      if (previousTimestamp) {
        const success = manager.rollback(previousTimestamp);
        expect(success).toBe(true);
      }
    });
  });

  describe('import/export', () => {
    it('should export configuration as JSON', () => {
      const json = manager.export();
      
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should import configuration from JSON', () => {
      const json = JSON.stringify({
        ...manager.getConfig(),
        connection: {
          ...manager.getSection('connection'),
          host: 'imported-host',
        },
      });

      const result = manager.import(json);
      
      expect(result.valid).toBe(true);
      expect(manager.get('connection.host')).toBe('imported-host');
    });

    it('should reject invalid JSON', () => {
      const result = manager.import('invalid json');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('configuration diff', () => {
    it('should compare configurations', () => {
      const config1 = manager.getConfig();
      const config2 = {
        ...config1,
        connection: {
          ...config1.connection,
          host: 'different-host',
        },
      };

      const diff = manager.diff(config2);
      
      expect(diff.length).toBeGreaterThan(0);
      expect(diff.some(d => d.path.includes('host'))).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should clear state on shutdown', () => {
      manager.update({
        connection: {
          ...manager.getSection('connection'),
          host: 'test-host',
        },
      });

      manager.shutdown();

      // After shutdown, should be able to reinitialize
      manager.initialize();
      const config = manager.getConfig();
      expect(config).toBeDefined();
    });
  });
});
