/**
 * Enhanced Supabase Connection Manager
 * Provides advanced connection pooling and optimization for Supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from './settingsManager';

interface ConnectionConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  healthCheckInterval: number;
  retryAttempts: number;
  retryDelay: number;
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

class EnhancedSupabaseConnectionPool {
  private static instance: EnhancedSupabaseConnectionPool;
  private connections: Map<string, Connection> = new Map();
  private waitingQueue: Array<{
    resolve: (connection: Connection) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private config: ConnectionConfig = {
    maxConnections: 20,
    minConnections: 5,
    acquireTimeout: 10000,
    idleTimeout: 300000, // 5 minutes
    healthCheckInterval: 60000, // 1 minute
    retryAttempts: 3,
    retryDelay: 1000
  };
  private stats: PoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    unhealthyConnections: 0,
    waitingRequests: 0,
    avgAcquireTime: 0,
    hitRate: 0
  };
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private acquireTimes: number[] = [];

  private constructor() {
    this.initializePool();
    this.startHealthChecks();
    this.startCleanup();
  }

  static getInstance(): EnhancedSupabaseConnectionPool {
    if (!EnhancedSupabaseConnectionPool.instance) {
      EnhancedSupabaseConnectionPool.instance = new EnhancedSupabaseConnectionPool();
    }
    return EnhancedSupabaseConnectionPool.instance;
  }

  private async initializePool(): Promise<void> {
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode !== 'supabase' || !settings.url || !settings.anonKey) {
      return;
    }

    // Create minimum connections
    const promises = [];
    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createConnection());
    }

    try {
      await Promise.all(promises);
      console.log(`Enhanced connection pool initialized with ${this.config.minConnections} connections`);
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
    }
  }

  private async createConnection(region?: string): Promise<Connection> {
    const settings = settingsManager.getDBSettings();
    
    if (!settings.url || !settings.anonKey) {
      throw new Error('Supabase configuration missing');
    }

    const id = this.generateConnectionId();
    const client = new SupabaseClient(settings.url, settings.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'X-Connection-ID': id,
          'X-Connection-Region': region || 'default'
        }
      }
    });

    const connection: Connection = {
      id,
      client,
      created: Date.now(),
      lastUsed: Date.now(),
      inUse: false,
      healthy: true,
      ...(region && { region })
    };

    this.connections.set(id, connection);
    this.updateStats();

    return connection;
  }

  async acquire(region?: string): Promise<SupabaseClient> {
    const startTime = performance.now();

    // Try to find an available connection
    let connection = this.getAvailableConnection(region);

    if (!connection) {
      // Try to create a new connection if under limit
      if (this.stats.totalConnections < this.config.maxConnections) {
        try {
          connection = await this.createConnection(region);
        } catch (error) {
          console.warn('Failed to create new connection:', error);
        }
      }

      // If still no connection, wait for one to become available
      if (!connection) {
        connection = await this.waitForConnection();
      }
    }

    if (!connection) {
      throw new Error('Unable to acquire database connection');
    }

    // Mark connection as in use
    connection.inUse = true;
    connection.lastUsed = Date.now();

    // Record acquire time
    const acquireTime = performance.now() - startTime;
    this.recordAcquireTime(acquireTime);

    this.updateStats();

    return connection.client;
  }

  private getAvailableConnection(region?: string): Connection | null {
    // Prefer connections from the same region
    if (region) {
      for (const connection of this.connections.values()) {
        if (!connection.inUse && connection.healthy && connection.region === region) {
          return connection;
        }
      }
    }

    // Fall back to any available connection
    for (const connection of this.connections.values()) {
      if (!connection.inUse && connection.healthy) {
        return connection;
      }
    }

    return null;
  }

  private async waitForConnection(): Promise<Connection> {
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
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now()
      });

      this.updateStats();
    });
  }

  release(client: SupabaseClient): void {
    const connection = Array.from(this.connections.values())
      .find(conn => conn.client === client);

    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();

      // Check if there are waiting requests
      if (this.waitingQueue.length > 0) {
        const waiting = this.waitingQueue.shift();
        if (waiting) {
          connection.inUse = true;
          waiting.resolve(connection);
        }
      }

      this.updateStats();
    }
  }

  private async healthCheck(connection: Connection): Promise<boolean> {
    try {
      // Simple health check - try to execute a lightweight query
      const { error } = await connection.client
        .from('robots')
        .select('id')
        .limit(1)
        .single();

      connection.healthy = !error;
      return connection.healthy;
    } catch (error) {
      connection.healthy = false;
      console.warn(`Connection ${connection.id} health check failed:`, error);
      return false;
    }
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      const healthCheckPromises = Array.from(this.connections.values())
        .map(async (connection) => {
          const wasHealthy = connection.healthy;
          const isHealthy = await this.healthCheck(connection);

          if (wasHealthy && !isHealthy) {
            console.warn(`Connection ${connection.id} became unhealthy`);
          } else if (!wasHealthy && isHealthy) {
            console.info(`Connection ${connection.id} recovered`);
          }
        });

      await Promise.allSettled(healthCheckPromises);
      this.updateStats();
    }, this.config.healthCheckInterval);
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleConnections();
      this.cleanupWaitingQueue();
    }, 60000); // Run cleanup every minute
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [id, connection] of this.connections) {
      // Don't remove if in use or below minimum
      if (connection.inUse || this.stats.totalConnections <= this.config.minConnections) {
        continue;
      }

      // Remove if idle for too long or unhealthy
      if (!connection.healthy || (now - connection.lastUsed) > this.config.idleTimeout) {
        connectionsToRemove.push(id);
      }
    }

    connectionsToRemove.forEach(id => {
      this.connections.delete(id);
      console.debug(`Removed idle connection ${id}`);
    });

    if (connectionsToRemove.length > 0) {
      this.updateStats();
    }
  }

  private cleanupWaitingQueue(): void {
    const now = Date.now();
    const timeout = this.config.acquireTimeout;
    const toRemove: number[] = [];

    this.waitingQueue.forEach((item, index) => {
      if (now - item.timestamp > timeout) {
        item.reject(new Error('Connection acquire timeout'));
        toRemove.push(index);
      }
    });

    // Remove from end to avoid index shifting
    toRemove.reverse().forEach(index => {
      this.waitingQueue.splice(index, 1);
    });

    if (toRemove.length > 0) {
      this.updateStats();
    }
  }

  private updateStats(): void {
    const connections = Array.from(this.connections.values());
    
    this.stats.totalConnections = connections.length;
    this.stats.activeConnections = connections.filter(c => c.inUse).length;
    this.stats.idleConnections = connections.filter(c => !c.inUse && c.healthy).length;
    this.stats.unhealthyConnections = connections.filter(c => !c.healthy).length;
    this.stats.waitingRequests = this.waitingQueue.length;
    
    // Calculate average acquire time
    if (this.acquireTimes.length > 0) {
      this.stats.avgAcquireTime = this.acquireTimes.reduce((sum, time) => sum + time, 0) / this.acquireTimes.length;
    }
    
    // Calculate hit rate (successful immediate acquisitions)
    const totalAcquisitions = this.acquireTimes.length;
    const immediateAcquisitions = this.acquireTimes.filter(time => time < 50).length; // Less than 50ms
    this.stats.hitRate = totalAcquisitions > 0 ? immediateAcquisitions / totalAcquisitions : 0;
  }

  private recordAcquireTime(time: number): void {
    this.acquireTimes.push(time);
    
    // Keep only last 100 measurements
    if (this.acquireTimes.length > 100) {
      this.acquireTimes = this.acquireTimes.slice(-100);
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  getStats(): PoolStats {
    return { ...this.stats };
  }

  async getDetailedStats(): Promise<{
    pool: PoolStats;
    connections: Array<{
      id: string;
      region?: string;
      created: number;
      lastUsed: number;
      inUse: boolean;
      healthy: boolean;
      age: number;
      idleTime: number;
    }>;
    config: ConnectionConfig;
  }> {
    const connections = Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      ...(conn.region && { region: conn.region }),
      created: conn.created,
      lastUsed: conn.lastUsed,
      inUse: conn.inUse,
      healthy: conn.healthy,
      age: Date.now() - conn.created,
      idleTime: Date.now() - conn.lastUsed
    }));

    return {
      pool: this.getStats(),
      connections,
      config: { ...this.config }
    };
  }

  updateConfig(newConfig: Partial<ConnectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Connection pool configuration updated:', this.config);
  }

  async closeAll(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Reject all waiting requests
    this.waitingQueue.forEach(item => {
      item.reject(new Error('Connection pool closing'));
    });
    this.waitingQueue = [];

    // Clear all connections
    this.connections.clear();
    this.updateStats();

    console.log('Connection pool closed');
  }

  // Force health check on all connections
  async forceHealthCheck(): Promise<{ healthy: number; unhealthy: number }> {
    let healthy = 0;
    let unhealthy = 0;

    for (const connection of this.connections.values()) {
      const isHealthy = await this.healthCheck(connection);
      if (isHealthy) {
        healthy++;
      } else {
        unhealthy++;
      }
    }

    this.updateStats();
    return { healthy, unhealthy };
  }
}

export const enhancedConnectionPool = EnhancedSupabaseConnectionPool.getInstance();