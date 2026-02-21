/**
 * Integration Connection Pool Manager
 * 
 * Provides centralized connection pooling for external integrations:
 * - Connection lifecycle management
 * - Automatic reconnection with backoff
 * - Connection health monitoring
 * - Pool sizing and throttling
 * - Connection validation and refresh
 * - Integration with orchestrator events
 */

import { createScopedLogger } from '../../utils/logger';
import { TIMEOUTS } from '../../constants';
import { IntegrationStatus } from './types';

const logger = createScopedLogger('connection-pool');

/**
 * Connection states
 */
export enum ConnectionState {
  IDLE = 'idle',
  ACTIVE = 'active',
  BUSY = 'busy',
  ERROR = 'error',
  CLOSED = 'closed',
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  /** Minimum connections to maintain */
  minConnections: number;
  /** Maximum connections allowed */
  maxConnections: number;
  /** Connection acquire timeout in ms */
  acquireTimeout: number;
  /** Idle timeout before closing connection in ms */
  idleTimeout: number;
  /** Maximum connection age in ms (0 = no limit) */
  maxConnectionAge: number;
  /** Health check interval in ms */
  healthCheckInterval: number;
  /** Enable automatic reconnection */
  enableReconnection: boolean;
  /** Reconnection backoff multiplier */
  backoffMultiplier: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts: number;
  /** Initial reconnection delay in ms */
  initialReconnectDelay: number;
  /** Maximum reconnection delay in ms */
  maxReconnectDelay: number;
  /** Validate connection on borrow */
  validateOnBorrow: boolean;
  /** Validate connection on return */
  validateOnReturn: boolean;
  /** Connection test query/function */
  testConnection?: () => Promise<boolean>;
}

/**
 * Default connection pool configuration
 */
export const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  minConnections: 1,
  maxConnections: 10,
  acquireTimeout: TIMEOUTS.POOL_ACQUIRE || 5000,
  idleTimeout: TIMEOUTS.POOL_IDLE_TIMEOUT || 30000,
  maxConnectionAge: 0, // No age limit by default
  healthCheckInterval: TIMEOUTS.HEALTH_CHECK || 30000,
  enableReconnection: true,
  backoffMultiplier: 1.5,
  maxReconnectAttempts: 5,
  initialReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  validateOnBorrow: true,
  validateOnReturn: false,
};

/**
 * Connection wrapper with metadata
 */
export interface PooledConnection<T = unknown> {
  /** Unique connection identifier */
  id: string;
  /** The actual connection object */
  connection: T;
  /** Current connection state */
  state: ConnectionState;
  /** When the connection was created */
  createdAt: Date;
  /** When the connection was last used */
  lastUsedAt: Date;
  /** Number of times this connection has been used */
  usageCount: number;
  /** Number of errors encountered */
  errorCount: number;
  /** Last error message */
  lastError?: string;
  /** Reconnection attempts */
  reconnectAttempts: number;
  /** Whether connection is currently being validated */
  isValidating: boolean;
}

/**
 * Connection factory interface
 */
export interface ConnectionFactory<T> {
  /** Create a new connection */
  create(): Promise<T>;
  /** Validate a connection is still usable */
  validate(connection: T): Promise<boolean>;
  /** Destroy a connection */
  destroy(connection: T): Promise<void>;
  /** Reset a connection to clean state */
  reset?(connection: T): Promise<void>;
}

/**
 * Connection pool metrics
 */
export interface ConnectionPoolMetrics {
  /** Total connections in pool */
  totalConnections: number;
  /** Active (in-use) connections */
  activeConnections: number;
  /** Idle connections */
  idleConnections: number;
  /** Connections waiting to be acquired */
  pendingAcquires: number;
  /** Total acquisitions */
  totalAcquisitions: number;
  /** Total releases */
  totalReleases: number;
  /** Total errors */
  totalErrors: number;
  /** Total reconnections */
  totalReconnections: number;
  /** Average acquisition time in ms */
  avgAcquisitionTime: number;
  /** Average connection age in ms */
  avgConnectionAge: number;
  /** Pool utilization percentage */
  utilization: number;
}

/**
 * Pending acquire request
 */
interface PendingAcquire<T> {
  resolve: (conn: PooledConnection<T>) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  startTime: number;
}

/**
 * Connection Pool Manager
 * 
 * Manages connection pools for external integrations with:
 * - Automatic sizing and scaling
 * - Health monitoring
 * - Reconnection with backoff
 * - Metrics collection
 */
export class ConnectionPoolManager<T = unknown> {
  private readonly name: string;
  private readonly factory: ConnectionFactory<T>;
  private readonly config: ConnectionPoolConfig;
  
  private readonly connections = new Map<string, PooledConnection<T>>();
  private readonly idleConnections = new Set<string>();
  private readonly pendingAcquires: PendingAcquire<T>[] = [];
  
  private connectionIdCounter = 0;
  private metrics: ConnectionPoolMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    pendingAcquires: 0,
    totalAcquisitions: 0,
    totalReleases: 0,
    totalErrors: 0,
    totalReconnections: 0,
    avgAcquisitionTime: 0,
    avgConnectionAge: 0,
    utilization: 0,
  };
  
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private idleCheckTimer?: ReturnType<typeof setInterval>;
  private isShuttingDown = false;
  private totalAcquisitionTime = 0;
  
  constructor(
    name: string,
    factory: ConnectionFactory<T>,
    config: Partial<ConnectionPoolConfig> = {}
  ) {
    this.name = name;
    this.factory = factory;
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    
    logger.info(`Connection pool '${name}' created`, {
      minConnections: this.config.minConnections,
      maxConnections: this.config.maxConnections,
    });
  }

  /**
   * Initialize the connection pool with minimum connections
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing connection pool '${this.name}'...`);
    
    // Create minimum connections
    const initPromises = Array.from(
      { length: this.config.minConnections },
      () => this.createConnection()
    );
    
    await Promise.allSettled(initPromises);
    
    // Start background tasks
    this.startHealthChecks();
    this.startIdleCheck();
    
    logger.info(`Connection pool '${this.name}' initialized`, {
      connections: this.connections.size,
    });
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<PooledConnection<T>> {
    if (this.isShuttingDown) {
      throw new Error(`Connection pool '${this.name}' is shutting down`);
    }

    const startTime = Date.now();
    
    // Try to get an idle connection
    const idleConn = this.getIdleConnection();
    if (idleConn) {
      if (this.config.validateOnBorrow) {
        const valid = await this.validateConnection(idleConn);
        if (!valid) {
          await this.destroyConnection(idleConn.id);
          return this.acquire(); // Retry
        }
      }
      
      this.setConnectionState(idleConn, ConnectionState.ACTIVE);
      this.updateMetrics(startTime);
      
      return idleConn;
    }
    
    // Create new connection if under max
    if (this.connections.size < this.config.maxConnections) {
      const newConn = await this.createConnection();
      if (newConn) {
        this.setConnectionState(newConn, ConnectionState.ACTIVE);
        this.updateMetrics(startTime);
        return newConn;
      }
    }
    
    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.pendingAcquires.findIndex(p => p.timeoutId === timeoutId);
        if (index !== -1) {
          this.pendingAcquires.splice(index, 1);
          reject(new Error(`Connection acquire timeout for pool '${this.name}'`));
        }
      }, this.config.acquireTimeout);
      
      this.pendingAcquires.push({
        resolve: (conn) => {
          clearTimeout(timeoutId);
          this.updateMetrics(startTime);
          resolve(conn);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timeoutId,
        startTime,
      });
      
      this.metrics.pendingAcquires = this.pendingAcquires.length;
    });
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection: PooledConnection<T>): Promise<void> {
    if (this.isShuttingDown) {
      await this.destroyConnection(connection.id);
      return;
    }
    
    // Check if connection is too old
    if (this.config.maxConnectionAge > 0) {
      const age = Date.now() - connection.createdAt.getTime();
      if (age > this.config.maxConnectionAge) {
        logger.debug(`Connection '${connection.id}' exceeded max age, destroying`);
        await this.destroyConnection(connection.id);
        await this.maintainMinConnections();
        return;
      }
    }
    
    // Validate on return if configured
    if (this.config.validateOnReturn) {
      const valid = await this.validateConnection(connection);
      if (!valid) {
        await this.destroyConnection(connection.id);
        await this.maintainMinConnections();
        return;
      }
    }
    
    // Reset connection if factory supports it
    if (this.factory.reset) {
      try {
        await this.factory.reset(connection.connection);
      } catch (error) {
        logger.warn(`Failed to reset connection '${connection.id}':`, error);
        await this.destroyConnection(connection.id);
        await this.maintainMinConnections();
        return;
      }
    }
    
    // Mark as idle
    connection.lastUsedAt = new Date();
    this.setConnectionState(connection, ConnectionState.IDLE);
    this.idleConnections.add(connection.id);
    this.metrics.totalReleases++;
    
    // Fulfill pending acquire if any
    const pending = this.pendingAcquires.shift();
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.setConnectionState(connection, ConnectionState.ACTIVE);
      pending.resolve(connection);
    }
    
    this.metrics.pendingAcquires = this.pendingAcquires.length;
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): ConnectionPoolMetrics {
    const activeConnections = Array.from(this.connections.values())
      .filter(c => c.state === ConnectionState.ACTIVE || c.state === ConnectionState.BUSY).length;
    
    this.metrics.totalConnections = this.connections.size;
    this.metrics.activeConnections = activeConnections;
    this.metrics.idleConnections = this.idleConnections.size;
    this.metrics.utilization = this.connections.size > 0 
      ? (activeConnections / this.config.maxConnections) * 100 
      : 0;
    
    // Calculate average connection age
    const now = Date.now();
    const ages = Array.from(this.connections.values())
      .map(c => now - c.createdAt.getTime());
    this.metrics.avgConnectionAge = ages.length > 0
      ? ages.reduce((a, b) => a + b, 0) / ages.length
      : 0;
    
    return { ...this.metrics };
  }

  /**
   * Get connection pool status
   */
  getStatus(): {
    name: string;
    status: IntegrationStatus;
    connections: number;
    active: number;
    idle: number;
    pending: number;
    healthy: boolean;
  } {
    const metrics = this.getMetrics();
    const hasMinConnections = metrics.totalConnections >= this.config.minConnections;
    const hasErrors = Array.from(this.connections.values()).some(c => c.state === ConnectionState.ERROR);
    
    let status: IntegrationStatus;
    if (this.isShuttingDown) {
      status = IntegrationStatus.UNHEALTHY;
    } else if (hasErrors || !hasMinConnections) {
      status = IntegrationStatus.DEGRADED;
    } else {
      status = IntegrationStatus.HEALTHY;
    }
    
    return {
      name: this.name,
      status,
      connections: metrics.totalConnections,
      active: metrics.activeConnections,
      idle: metrics.idleConnections,
      pending: metrics.pendingAcquires,
      healthy: status === IntegrationStatus.HEALTHY,
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    logger.info(`Shutting down connection pool '${this.name}'...`);
    this.isShuttingDown = true;
    
    // Stop background tasks
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
    }
    
    // Reject all pending acquires
    this.pendingAcquires.forEach(pending => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(`Connection pool '${this.name}' is shutting down`));
    });
    this.pendingAcquires.length = 0;
    
    // Destroy all connections
    const destroyPromises = Array.from(this.connections.keys())
      .map(id => this.destroyConnection(id));
    
    await Promise.allSettled(destroyPromises);
    
    this.connections.clear();
    this.idleConnections.clear();
    
    logger.info(`Connection pool '${this.name}' shut down`);
  }

  // Private methods

  private async createConnection(): Promise<PooledConnection<T> | null> {
    const id = `${this.name}-${++this.connectionIdCounter}`;
    
    try {
      logger.debug(`Creating connection '${id}'...`);
      
      const connection = await this.factory.create();
      
      const pooledConnection: PooledConnection<T> = {
        id,
        connection,
        state: ConnectionState.IDLE,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        usageCount: 0,
        errorCount: 0,
        reconnectAttempts: 0,
        isValidating: false,
      };
      
      this.connections.set(id, pooledConnection);
      this.idleConnections.add(id);
      this.metrics.totalConnections = this.connections.size;
      
      logger.debug(`Connection '${id}' created`);
      
      return pooledConnection;
    } catch (error) {
      logger.error(`Failed to create connection '${id}':`, error);
      this.metrics.totalErrors++;
      return null;
    }
  }

  private async destroyConnection(id: string): Promise<void> {
    const conn = this.connections.get(id);
    if (!conn) return;
    
    try {
      this.setConnectionState(conn, ConnectionState.CLOSED);
      await this.factory.destroy(conn.connection);
    } catch (error) {
      logger.warn(`Error destroying connection '${id}':`, error);
    } finally {
      this.connections.delete(id);
      this.idleConnections.delete(id);
      this.metrics.totalConnections = this.connections.size;
    }
  }

  private getIdleConnection(): PooledConnection<T> | null {
    for (const id of this.idleConnections) {
      const conn = this.connections.get(id);
      if (conn && conn.state === ConnectionState.IDLE) {
        this.idleConnections.delete(id);
        return conn;
      }
    }
    return null;
  }

  private setConnectionState(conn: PooledConnection<T>, state: ConnectionState): void {
    conn.state = state;
    
    if (state === ConnectionState.ACTIVE || state === ConnectionState.BUSY) {
      conn.usageCount++;
    } else if (state === ConnectionState.ERROR) {
      conn.errorCount++;
    }
  }

  private async validateConnection(conn: PooledConnection<T>): Promise<boolean> {
    if (conn.isValidating) return false;
    
    conn.isValidating = true;
    
    try {
      const valid = await this.factory.validate(conn.connection);
      
      if (!valid) {
        logger.debug(`Connection '${conn.id}' failed validation`);
      }
      
      return valid;
    } catch (error) {
      logger.warn(`Error validating connection '${conn.id}':`, error);
      return false;
    } finally {
      conn.isValidating = false;
    }
  }

  private async maintainMinConnections(): Promise<void> {
    const needed = this.config.minConnections - this.connections.size;
    if (needed <= 0) return;
    
    logger.debug(`Maintaining minimum connections, need ${needed} more`);
    
    const promises = Array.from({ length: needed }, () => this.createConnection());
    await Promise.allSettled(promises);
  }

  private updateMetrics(startTime: number): void {
    const acquisitionTime = Date.now() - startTime;
    this.totalAcquisitionTime += acquisitionTime;
    this.metrics.totalAcquisitions++;
    this.metrics.avgAcquisitionTime = 
      this.totalAcquisitionTime / this.metrics.totalAcquisitions;
  }

  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(async () => {
      await this.runHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async runHealthChecks(): Promise<void> {
    if (this.isShuttingDown) return;
    
    logger.debug(`Running health checks for pool '${this.name}'`);
    
    const connections = Array.from(this.connections.values());
    const unhealthyIds: string[] = [];
    
    for (const conn of connections) {
      // Skip active connections
      if (conn.state === ConnectionState.ACTIVE || conn.state === ConnectionState.BUSY) {
        continue;
      }
      
      const valid = await this.validateConnection(conn);
      if (!valid) {
        unhealthyIds.push(conn.id);
      }
    }
    
    // Remove unhealthy connections
    for (const id of unhealthyIds) {
      await this.destroyConnection(id);
    }
    
    // Reconnect if enabled and below minimum
    if (this.config.enableReconnection && unhealthyIds.length > 0) {
      await this.reconnectWithBackoff();
    }
    
    // Maintain minimum connections
    await this.maintainMinConnections();
  }

  private async reconnectWithBackoff(): Promise<void> {
    let delay = this.config.initialReconnectDelay;
    let attempts = 0;
    
    while (
      attempts < this.config.maxReconnectAttempts &&
      this.connections.size < this.config.minConnections &&
      !this.isShuttingDown
    ) {
      attempts++;
      this.metrics.totalReconnections++;
      
      logger.debug(`Reconnection attempt ${attempts}/${this.config.maxReconnectAttempts}`);
      
      const conn = await this.createConnection();
      if (conn) {
        logger.info(`Reconnection successful on attempt ${attempts}`);
        return;
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxReconnectDelay);
    }
    
    if (this.connections.size < this.config.minConnections) {
      logger.error(`Failed to reconnect after ${attempts} attempts`);
    }
  }

  private startIdleCheck(): void {
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
    }
    
    // Check every 10 seconds for idle connections
    this.idleCheckTimer = setInterval(async () => {
      await this.cleanupIdleConnections();
    }, 10000);
  }

  private async cleanupIdleConnections(): Promise<void> {
    if (this.isShuttingDown) return;
    
    const now = Date.now();
    const idsToRemove: string[] = [];
    
    for (const id of this.idleConnections) {
      const conn = this.connections.get(id);
      if (!conn) continue;
      
      const idleTime = now - conn.lastUsedAt.getTime();
      if (
        idleTime > this.config.idleTimeout &&
        this.connections.size > this.config.minConnections
      ) {
        idsToRemove.push(id);
      }
    }
    
    if (idsToRemove.length > 0) {
      logger.debug(`Cleaning up ${idsToRemove.length} idle connections`);
      
      for (const id of idsToRemove) {
        await this.destroyConnection(id);
      }
    }
  }
}

/**
 * Global connection pool registry
 */
class ConnectionPoolRegistry {
  private readonly pools = new Map<string, ConnectionPoolManager>();
  
  /**
   * Register a connection pool
   */
  register<T>(
    name: string,
    factory: ConnectionFactory<T>,
    config?: Partial<ConnectionPoolConfig>
  ): ConnectionPoolManager<T> {
    if (this.pools.has(name)) {
      throw new Error(`Connection pool '${name}' already registered`);
    }
    
    const pool = new ConnectionPoolManager(name, factory, config);
    this.pools.set(name, pool as ConnectionPoolManager);
    
    logger.info(`Connection pool '${name}' registered`);
    
    return pool;
  }
  
  /**
   * Get a connection pool by name
   */
  get<T = unknown>(name: string): ConnectionPoolManager<T> | undefined {
    return this.pools.get(name) as ConnectionPoolManager<T> | undefined;
  }
  
  /**
   * Unregister and shutdown a connection pool
   */
  async unregister(name: string): Promise<void> {
    const pool = this.pools.get(name);
    if (pool) {
      await pool.shutdown();
      this.pools.delete(name);
      logger.info(`Connection pool '${name}' unregistered`);
    }
  }
  
  /**
   * Get all pool statuses
   */
  getAllStatuses(): Array<ReturnType<ConnectionPoolManager['getStatus']>> {
    return Array.from(this.pools.values()).map(pool => pool.getStatus());
  }
  
  /**
   * Shutdown all pools
   */
  async shutdownAll(): Promise<void> {
    const promises = Array.from(this.pools.keys()).map(name => this.unregister(name));
    await Promise.allSettled(promises);
  }
  
  /**
   * Check if all pools are healthy
   */
  isHealthy(): boolean {
    return Array.from(this.pools.values()).every(
      pool => pool.getStatus().healthy
    );
  }
}

/**
 * Global connection pool registry instance
 */
export const connectionPoolRegistry = new ConnectionPoolRegistry();
