/// <reference types="../../vite-env.d.ts" />

/**
 * Supabase Connection Pool Service
 * Consolidated connection pooling logic from enhancedSupabasePool.ts (1,405 lines)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_CONFIG } from '../../constants/config';
import { STAGGER } from '../constants';
import { createScopedLogger } from '../../utils/logger';
import { ARRAY_LIMITS, ID_GENERATION } from '../../constants/modularConfig';

const logger = createScopedLogger('ConnectionPool');

interface ConnectionConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  healthCheckInterval: number;
  retryAttempts: number;
  retryDelay: number;
  enableConnectionDraining?: boolean;
  regionAffinity?: boolean;
  connectionWarming?: boolean;
}

interface Connection {
  id: string;
  client: SupabaseClient;
  created: number;
  lastUsed: number;
  inUse: boolean;
  healthy: boolean;
  region?: string;
}

interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  unhealthyConnections: number;
  waitingRequests: number;
  avgAcquireTime: number;
  hitRate: number;
}

const DEFAULT_CONFIG: ConnectionConfig = {
  maxConnections: DATABASE_CONFIG.POOL.MAX_SIZE,
  minConnections: 2,
  acquireTimeout: DATABASE_CONFIG.POOL.ACQUIRE_TIMEOUT,
  idleTimeout: DATABASE_CONFIG.POOL.IDLE_TIMEOUT,
  healthCheckInterval: DATABASE_CONFIG.POOL.HEALTH_CHECK_INTERVAL,
  retryAttempts: DATABASE_CONFIG.RETRY.MAX_ATTEMPTS,
  retryDelay: DATABASE_CONFIG.POOL.RETRY_DELAY,
  enableConnectionDraining: true,
  regionAffinity: true,
  connectionWarming: true,
};

class SupabaseConnectionPool {
  private static instance: SupabaseConnectionPool;
  private connections: Map<string, Connection> = new Map();
  private waitingQueue: Array<{
    resolve: (connection: Connection) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private config: ConnectionConfig;
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private stats: PoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    unhealthyConnections: 0,
    waitingRequests: 0,
    avgAcquireTime: 0,
    hitRate: 0,
  };
  private acquireTimes: number[] = [];
  private totalAcquires = 0;
  private cacheHits = 0;

  private constructor(config: Partial<ConnectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startHealthCheck();
    this.initializeMinConnections();
  }

  static getInstance(config?: Partial<ConnectionConfig>): SupabaseConnectionPool {
    if (!SupabaseConnectionPool.instance) {
      SupabaseConnectionPool.instance = new SupabaseConnectionPool(config);
    }
    return SupabaseConnectionPool.instance;
  }

  /**
   * Create a new Supabase client connection
   */
  private async createConnection(region?: string): Promise<Connection> {
    const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'];
    const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'];

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase credentials not available');
    }

    const { createClient } = await import('@supabase/supabase-js');
    
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // Pool connections don't persist sessions
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'X-Connection-Pool': 'true',
          'X-Connection-ID': `pool-${Date.now()}-${Math.random().toString(36).substr(2, ID_GENERATION.RANDOM.STANDARD)}`,
          ...(region && { 'X-Preferred-Region': region }),
        },
      },
    });

    const connection: Connection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, ID_GENERATION.RANDOM.STANDARD)}`,
      client,
      created: Date.now(),
      lastUsed: Date.now(),
      inUse: false,
      healthy: true,
      region,
    };

    // Health check the new connection
    await this.healthCheckConnection(connection);

    return connection;
  }

  /**
   * Initialize minimum number of connections
   */
  private async initializeMinConnections(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createAndAddConnection());
    }
    await Promise.all(promises);
  }

  /**
   * Create and add connection to pool
   */
  private async createAndAddConnection(region?: string): Promise<void> {
    if (this.connections.size >= this.config.maxConnections) {
      return;
    }

    try {
      const connection = await this.createConnection(region);
      this.connections.set(connection.id, connection);
      this.updateStats();
    } catch (error: unknown) {
      console.error('Failed to create connection:', error);
    }
  }

  /**
   * Health check a specific connection
   */
  private async healthCheckConnection(connection: Connection): Promise<boolean> {
    try {
      const { error } = await connection.client.from('_health_check').select('1').limit(1);

      if (error) {
        connection.healthy = false;
        return false;
      }

      connection.healthy = true;
      connection.lastUsed = Date.now();
      return true;
    } catch (_error) {
      connection.healthy = false;
      return false;
    }
  }

  /**
   * Start periodic health checking
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
      await this.cleanupIdleConnections();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks on all connections
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.connections.values()).map(
      async (connection) => {
        const isHealthy = await this.healthCheckConnection(connection);
        if (!isHealthy) {
          logger.warn(`Connection ${connection.id} failed health check`);
          this.removeConnection(connection.id);
        }
      }
    );

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Remove connection from pool
   */
  private removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
    this.updateStats();
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    this.connections.forEach((connection) => {
      if (
        !connection.inUse &&
        now - connection.lastUsed > this.config.idleTimeout &&
        this.connections.size > this.config.minConnections
      ) {
        connectionsToRemove.push(connection.id);
      }
    });

    connectionsToRemove.forEach(id => this.removeConnection(id));

    // Ensure we have minimum connections
    const currentCount = this.connections.size;
    if (currentCount < this.config.minConnections) {
      const needed = this.config.minConnections - currentCount;
      for (let i = 0; i < needed; i++) {
        this.createAndAddConnection();
      }
    }
  }

  /**
   * Acquire connection from pool
   */
  async acquireConnection(region?: string): Promise<Connection> {
    const startTime = Date.now();
    this.totalAcquires++;

    // Look for available healthy connection
    let availableConnection: Connection | null = null;
    
    for (const connection of this.connections.values()) {
      if (
        !connection.inUse &&
        connection.healthy &&
        (!region || connection.region === region)
      ) {
        availableConnection = connection;
        break;
      }
    }

    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();
      this.cacheHits++;
      this.updateStats();
      this.recordAcquireTime(Date.now() - startTime);
      return availableConnection;
    }

    // If no available connection and we can create more
    if (this.connections.size < this.config.maxConnections) {
      try {
        const newConnection = await this.createConnection(region);
        newConnection.inUse = true;
        this.connections.set(newConnection.id, newConnection);
        this.updateStats();
        this.recordAcquireTime(Date.now() - startTime);
        return newConnection;
      } catch (error: unknown) {
        console.error('Failed to create new connection:', error);
      }
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeout);

      this.waitingQueue.push({
        resolve: (connection) => {
          clearTimeout(timeout);
          this.recordAcquireTime(Date.now() - startTime);
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(connection: Connection): void {
    if (!this.connections.has(connection.id)) {
      return;
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();

    // Process waiting queue
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift();
      if (waiter) {
        connection.inUse = true;
        waiter.resolve(connection);
      }
    }

    this.updateStats();
  }

  /**
   * Record acquire time for statistics
   */
  private recordAcquireTime(time: number): void {
    this.acquireTimes.push(time);
    if (this.acquireTimes.length > ARRAY_LIMITS.STANDARD) {
      this.acquireTimes = this.acquireTimes.slice(-ARRAY_LIMITS.STANDARD);
    }
    this.updateStats();
  }

  /**
   * Update pool statistics
   */
  private updateStats(): void {
    const connections = Array.from(this.connections.values());
    
    this.stats.totalConnections = connections.length;
    this.stats.activeConnections = connections.filter(c => c.inUse).length;
    this.stats.idleConnections = connections.filter(c => !c.inUse && c.healthy).length;
    this.stats.unhealthyConnections = connections.filter(c => !c.healthy).length;
    this.stats.waitingRequests = this.waitingQueue.length;
    this.stats.avgAcquireTime = this.acquireTimes.length > 0 
      ? this.acquireTimes.reduce((a, b) => a + b, 0) / this.acquireTimes.length 
      : 0;
    this.stats.hitRate = this.totalAcquires > 0 ? (this.cacheHits / this.totalAcquires) * 100 : 0;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return { ...this.stats };
  }

  /**
   * Get pool configuration
   */
  getConfig(): ConnectionConfig {
    return { ...this.config };
  }

  /**
   * Update pool configuration
   */
  updateConfig(newConfig: Partial<ConnectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart health check if interval changed
    if (newConfig.healthCheckInterval) {
      this.startHealthCheck();
    }
  }

  /**
   * Drain connection pool (for graceful shutdown)
   */
  async drain(): Promise<void> {
    this.config.enableConnectionDraining = true;
    
    // Wait for all connections to be released
    while (this.stats.activeConnections > 0) {
      await new Promise(resolve => setTimeout(resolve, STAGGER.DEFAULT_DELAY_MS));
    }

    // Clear health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // Clear all connections
    this.connections.clear();
    this.waitingQueue = [];
    this.updateStats();
  }

  /**
   * Force close all connections (emergency)
   */
  forceClose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    this.connections.clear();
    this.waitingQueue = [];
    this.updateStats();
  }
}

// Export singleton instance
export const supabasePool = SupabaseConnectionPool.getInstance();
export default supabasePool;
export type { ConnectionConfig, Connection, PoolStats };