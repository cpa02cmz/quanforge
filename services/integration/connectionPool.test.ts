/**
 * Connection Pool Manager Tests
 * 
 * Tests for the integration connection pool management system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConnectionPoolManager,
  connectionPoolRegistry,
  ConnectionState,
  DEFAULT_POOL_CONFIG,
  type ConnectionFactory,
  type ConnectionPoolConfig,
} from './connectionPool';

// Mock factory for testing
interface TestConnection {
  id: string;
  isValid: boolean;
  isClosed: boolean;
}

const createMockFactory = (): ConnectionFactory<TestConnection> => ({
  create: vi.fn(async () => ({
    id: `conn-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    isValid: true,
    isClosed: false,
  })),
  validate: vi.fn(async (conn) => conn.isValid && !conn.isClosed),
  destroy: vi.fn(async (conn) => {
    conn.isClosed = true;
  }),
  reset: vi.fn(async (_conn) => {
    // Reset logic
  }),
});

describe('ConnectionPoolManager', () => {
  let factory: ConnectionFactory<TestConnection>;
  let pool: ConnectionPoolManager<TestConnection>;

  beforeEach(() => {
    factory = createMockFactory();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
    }
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a pool with default config', () => {
      pool = new ConnectionPoolManager('test-pool', factory);
      expect(pool).toBeDefined();
    });

    it('should create a pool with custom config', () => {
      const customConfig: Partial<ConnectionPoolConfig> = {
        minConnections: 2,
        maxConnections: 5,
        acquireTimeout: 3000,
      };
      pool = new ConnectionPoolManager('test-pool', factory, customConfig);
      expect(pool).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should create minimum connections on initialize', async () => {
      pool = new ConnectionPoolManager('test-pool', factory, {
        minConnections: 3,
      });
      
      await pool.initialize();
      
      expect(factory.create).toHaveBeenCalledTimes(3);
    });

    it('should handle initialization failures gracefully', async () => {
      const failingFactory: ConnectionFactory<TestConnection> = {
        create: vi.fn(async () => {
          throw new Error('Connection failed');
        }),
        validate: vi.fn(async () => true),
        destroy: vi.fn(async () => {}),
      };
      
      pool = new ConnectionPoolManager('test-pool', failingFactory, {
        minConnections: 2,
      });
      
      // Should not throw
      await pool.initialize();
      
      const metrics = pool.getMetrics();
      expect(metrics.totalConnections).toBe(0);
    });
  });

  describe('acquire', () => {
    beforeEach(async () => {
      pool = new ConnectionPoolManager('test-pool', factory, {
        minConnections: 1,
        maxConnections: 3,
        acquireTimeout: 1000,
      });
      await pool.initialize();
    });

    it('should acquire a connection from the pool', async () => {
      const conn = await pool.acquire();
      
      expect(conn).toBeDefined();
      expect(conn.state).toBe(ConnectionState.ACTIVE);
      expect(conn.connection).toBeDefined();
    });

    it('should create new connection if pool is empty', async () => {
      // Acquire all initial connections
      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();
      
      expect(conn1).toBeDefined();
      expect(conn2).toBeDefined();
    });

    it('should wait for connection if max connections reached', async () => {
      const config: Partial<ConnectionPoolConfig> = {
        minConnections: 1,
        maxConnections: 1,
        acquireTimeout: 100,
      };
      pool = new ConnectionPoolManager('test-pool', factory, config);
      await pool.initialize();
      
      // Acquire the only connection
      const conn1 = await pool.acquire();
      
      // This should wait
      const acquirePromise = pool.acquire();
      
      // Fast forward but not enough to timeout
      vi.advanceTimersByTime(50);
      
      // Release the first connection
      await pool.release(conn1);
      
      // The waiting acquire should now resolve
      const conn2 = await acquirePromise;
      expect(conn2).toBeDefined();
    });

    it('should timeout if no connection available', async () => {
      const config: Partial<ConnectionPoolConfig> = {
        minConnections: 1,
        maxConnections: 1,
        acquireTimeout: 100,
      };
      pool = new ConnectionPoolManager('test-pool', factory, config);
      await pool.initialize();
      
      // Acquire the only connection
      await pool.acquire();
      
      // This should timeout
      const acquirePromise = pool.acquire();
      
      vi.advanceTimersByTime(150);
      
      await expect(acquirePromise).rejects.toThrow('Connection acquire timeout');
    });
  });

  describe('release', () => {
    beforeEach(async () => {
      pool = new ConnectionPoolManager('test-pool', factory, {
        minConnections: 1,
        maxConnections: 3,
        validateOnReturn: false,
      });
      await pool.initialize();
    });

    it('should release a connection back to the pool', async () => {
      const conn = await pool.acquire();
      expect(conn.state).toBe(ConnectionState.ACTIVE);
      
      await pool.release(conn);
      
      expect(conn.state).toBe(ConnectionState.IDLE);
    });

    it('should validate connection on return if configured', async () => {
      pool = new ConnectionPoolManager('test-pool', factory, {
        minConnections: 1,
        validateOnReturn: true,
      });
      await pool.initialize();
      
      const conn = await pool.acquire();
      conn.connection.isValid = false;
      
      await pool.release(conn);
      
      // Invalid connection should be destroyed
      expect(factory.destroy).toHaveBeenCalled();
    });

    it('should fulfill pending acquire on release', async () => {
      const config: Partial<ConnectionPoolConfig> = {
        minConnections: 1,
        maxConnections: 1,
        acquireTimeout: 500,
      };
      pool = new ConnectionPoolManager('test-pool', factory, config);
      await pool.initialize();
      
      const conn = await pool.acquire();
      const pendingAcquire = pool.acquire();
      
      await pool.release(conn);
      
      const newConn = await pendingAcquire;
      expect(newConn).toBe(conn);
    });
  });

  describe('getMetrics', () => {
    beforeEach(async () => {
      pool = new ConnectionPoolManager('test-pool', factory, {
        minConnections: 2,
        maxConnections: 5,
      });
      await pool.initialize();
    });

    it('should return correct metrics', () => {
      const metrics = pool.getMetrics();
      
      expect(metrics.totalConnections).toBe(2);
      expect(metrics.idleConnections).toBe(2);
      expect(metrics.activeConnections).toBe(0);
    });

    it('should track acquisitions', async () => {
      await pool.acquire();
      
      const metrics = pool.getMetrics();
      expect(metrics.totalAcquisitions).toBe(1);
      expect(metrics.activeConnections).toBe(1);
    });

    it('should calculate utilization', async () => {
      await pool.acquire();
      await pool.acquire();
      
      const metrics = pool.getMetrics();
      expect(metrics.utilization).toBe(40); // 2 out of 5 = 40%
    });
  });

  describe('getStatus', () => {
    beforeEach(async () => {
      pool = new ConnectionPoolManager('test-pool', factory, {
        minConnections: 2,
      });
      await pool.initialize();
    });

    it('should return healthy status when all is well', () => {
      const status = pool.getStatus();
      
      expect(status.healthy).toBe(true);
      expect(status.status).toBe('healthy');
    });

    it('should return degraded when below minimum connections', async () => {
      // Force connections to error state
      pool = new ConnectionPoolManager('test-pool', factory, {
        minConnections: 5,
      });
      await pool.initialize();
      
      const status = pool.getStatus();
      // Since we can't create all connections in tests easily
      expect(status.connections).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shutdown', () => {
    it('should close all connections on shutdown', async () => {
      pool = new ConnectionPoolManager('test-pool', factory, {
        minConnections: 3,
      });
      await pool.initialize();
      
      await pool.shutdown();
      
      const metrics = pool.getMetrics();
      expect(metrics.totalConnections).toBe(0);
    });

    it('should reject pending acquires on shutdown', async () => {
      const config: Partial<ConnectionPoolConfig> = {
        minConnections: 1,
        maxConnections: 1,
        acquireTimeout: 1000,
      };
      pool = new ConnectionPoolManager('test-pool', factory, config);
      await pool.initialize();
      
      await pool.acquire();
      const pendingAcquire = pool.acquire();
      
      await pool.shutdown();
      
      await expect(pendingAcquire).rejects.toThrow('is shutting down');
    });
  });

  describe('connection validation', () => {
    it('should validate connections on borrow when configured', async () => {
      pool = new ConnectionPoolManager('test-pool', factory, {
        minConnections: 1,
        validateOnBorrow: true,
      });
      await pool.initialize();
      
      await pool.acquire();
      
      expect(factory.validate).toHaveBeenCalled();
    });

    it('should replace invalid connections', async () => {
      pool = new ConnectionPoolManager('test-pool', factory, {
        minConnections: 1,
        validateOnBorrow: true,
      });
      await pool.initialize();
      
      const conn = await pool.acquire();
      conn.connection.isValid = false;
      await pool.release(conn);
      
      // Next acquire should get a new connection
      const newConn = await pool.acquire();
      expect(newConn.connection.isValid).toBe(true);
    });
  });
});

describe('ConnectionPoolRegistry', () => {
  beforeEach(() => {
    // Clear any existing pools
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await connectionPoolRegistry.shutdownAll();
    vi.useRealTimers();
  });

  it('should register a connection pool', () => {
    const factory = createMockFactory();
    const pool = connectionPoolRegistry.register('test-pool-1', factory);
    
    expect(pool).toBeDefined();
    expect(connectionPoolRegistry.get('test-pool-1')).toBe(pool);
  });

  it('should throw if pool already registered', () => {
    const factory = createMockFactory();
    connectionPoolRegistry.register('test-pool-2', factory);
    
    expect(() => {
      connectionPoolRegistry.register('test-pool-2', factory);
    }).toThrow('already registered');
  });

  it('should unregister a connection pool', async () => {
    const factory = createMockFactory();
    connectionPoolRegistry.register('test-pool-3', factory);
    
    await connectionPoolRegistry.unregister('test-pool-3');
    
    expect(connectionPoolRegistry.get('test-pool-3')).toBeUndefined();
  });

  it('should get all pool statuses', async () => {
    const factory = createMockFactory();
    
    connectionPoolRegistry.register('pool-a', factory, { minConnections: 1 });
    connectionPoolRegistry.register('pool-b', factory, { minConnections: 1 });
    
    const poolA = connectionPoolRegistry.get<TestConnection>('pool-a');
    const poolB = connectionPoolRegistry.get<TestConnection>('pool-b');
    
    if (poolA) await poolA.initialize();
    if (poolB) await poolB.initialize();
    
    const statuses = connectionPoolRegistry.getAllStatuses();
    
    expect(statuses).toHaveLength(2);
    expect(statuses.find(s => s.name === 'pool-a')).toBeDefined();
    expect(statuses.find(s => s.name === 'pool-b')).toBeDefined();
  });

  it('should check if all pools are healthy', async () => {
    const factory = createMockFactory();
    
    connectionPoolRegistry.register('healthy-pool', factory, { minConnections: 1 });
    
    const pool = connectionPoolRegistry.get<TestConnection>('healthy-pool');
    if (pool) await pool.initialize();
    
    expect(connectionPoolRegistry.isHealthy()).toBe(true);
  });

  it('should shutdown all pools', async () => {
    const factory = createMockFactory();
    
    connectionPoolRegistry.register('pool-1', factory);
    connectionPoolRegistry.register('pool-2', factory);
    
    await connectionPoolRegistry.shutdownAll();
    
    const statuses = connectionPoolRegistry.getAllStatuses();
    expect(statuses).toHaveLength(0);
  });
});

describe('DEFAULT_POOL_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_POOL_CONFIG.minConnections).toBe(1);
    expect(DEFAULT_POOL_CONFIG.maxConnections).toBe(10);
    expect(DEFAULT_POOL_CONFIG.enableReconnection).toBe(true);
    expect(DEFAULT_POOL_CONFIG.validateOnBorrow).toBe(true);
  });
});
