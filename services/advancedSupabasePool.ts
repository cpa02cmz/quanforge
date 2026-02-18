/**
 * Advanced Supabase Connection Pool with Enhanced Edge Optimization
 * Provides intelligent connection management, health monitoring, and auto-scaling
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from './settingsManager';
import { createScopedLogger } from '../utils/logger';
import { TIMEOUTS, RETRY_CONFIG, STAGGER, TIME_CONSTANTS } from './constants';
import { CONNECTION_POOL_CONFIG } from '../constants/modularConfig';

const logger = createScopedLogger('AdvancedSupabasePool');

interface ConnectionConfig {
  url: string;
  anonKey: string;
  region?: string;
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  healthCheckInterval: number;
  retryAttempts: number;
  retryDelay: number;
  enableReadReplica: boolean;
  readReplicaUrl?: string;
}

interface PooledConnection {
  client: SupabaseClient;
  created: number;
  lastUsed: number;
  isHealthy: boolean;
  isInUse: boolean;
  region: string;
  requestCount: number;
  errorCount: number;
  lastError?: string;
}

interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  unhealthyConnections: number;
  averageResponseTime: number;
  errorRate: number;
  connectionUtilization: number;
  regionDistribution: Record<string, number>;
}

class AdvancedSupabasePool {
  private static instance: AdvancedSupabasePool;
  private pools: Map<string, PooledConnection[]> = new Map();
  private configs: Map<string, ConnectionConfig> = new Map();
  private metrics: PoolMetrics;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly DEFAULT_CONFIG: ConnectionConfig = {
    url: '',
    anonKey: '',
    maxConnections: CONNECTION_POOL_CONFIG.STANDARD.MAX_CONNECTIONS,
    minConnections: CONNECTION_POOL_CONFIG.STANDARD.MIN_CONNECTIONS,
    connectionTimeout: CONNECTION_POOL_CONFIG.STANDARD.CONNECTION_TIMEOUT_MS,
    idleTimeout: CONNECTION_POOL_CONFIG.STANDARD.IDLE_TIMEOUT_MS,
    healthCheckInterval: CONNECTION_POOL_CONFIG.STANDARD.HEALTH_CHECK_INTERVAL_MS,
    retryAttempts: CONNECTION_POOL_CONFIG.STANDARD.RETRY_ATTEMPTS,
    retryDelay: CONNECTION_POOL_CONFIG.STANDARD.RETRY_DELAY_MS,
    enableReadReplica: true,
  };

  private constructor() {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      unhealthyConnections: 0,
      averageResponseTime: 0,
      errorRate: 0,
      connectionUtilization: 0,
      regionDistribution: {}
    };
    
    this.startHealthChecks();
    this.startCleanup();
  }

  static getInstance(): AdvancedSupabasePool {
    if (!AdvancedSupabasePool.instance) {
      AdvancedSupabasePool.instance = new AdvancedSupabasePool();
    }
    return AdvancedSupabasePool.instance;
  }

  /**
   * Initialize connection pool for a specific configuration
   */
  async initializePool(poolId: string, config: Partial<ConnectionConfig>): Promise<void> {
    const settings = settingsManager.getDBSettings();
    
    const fullConfig: ConnectionConfig = {
      ...this.DEFAULT_CONFIG,
      ...config,
      url: settings.url || config.url || '',
      anonKey: settings.anonKey || config.anonKey || '',
      region: config.region || 'unknown',
    };

    if (!fullConfig.url || !fullConfig.anonKey) {
      throw new Error('Supabase URL and anon key are required');
    }

    this.configs.set(poolId, fullConfig);
    this.pools.set(poolId, []);

    // Create minimum connections
    await this.ensureMinimumConnections(poolId);
    
    // Pool initialized successfully
  }

  /**
   * Acquire a connection from the pool
   */
  async acquireConnection(poolId: string = 'default', _preferReadReplica: boolean = false): Promise<SupabaseClient> {
    const config = this.configs.get(poolId);
    if (!config) {
      throw new Error(`Pool '${poolId}' not initialized`);
    }

    const pool = this.pools.get(poolId) || [];
    
    // Try to find an available, healthy connection
    let connection = pool.find(conn => !conn.isInUse && conn.isHealthy);
    
    if (!connection) {
      // Create new connection if under max limit
      if (pool.length < config.maxConnections) {
        connection = await this.createNewConnection(poolId, config);
        pool.push(connection);
      } else {
        // Pool is full, wait for available connection
        connection = await this.waitForAvailableConnection(poolId, config.connectionTimeout);
      }
    }

    if (!connection) {
      throw new Error(`No available connections in pool '${poolId}'`);
    }

    // Mark connection as in use
    connection.isInUse = true;
    connection.lastUsed = Date.now();
    connection.requestCount++;

    // Update metrics
    this.updateMetrics();

    return connection.client;
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(poolId: string, client: SupabaseClient): void {
    const pool = this.pools.get(poolId);
    if (!pool) return;

    const connection = pool.find(conn => conn.client === client);
    if (connection) {
      connection.isInUse = false;
      connection.lastUsed = Date.now();
      this.updateMetrics();
    }
  }

  /**
   * Create a new connection
   */
  private async createNewConnection(poolId: string, config: ConnectionConfig): Promise<PooledConnection> {
    const startTime = Date.now();
    
    try {
      const client = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'X-Connection-Pool': poolId,
            'X-Region': config.region || 'unknown',
            'X-Client-Version': '3.0.0',
          },
        },
      });

      // Test connection with health check
      const isHealthy = await this.performHealthCheck(client);
      const creationTime = Date.now() - startTime;

      if (!isHealthy) {
        throw new Error('Connection health check failed');
      }

      const connection: PooledConnection = {
        client,
        created: Date.now(),
        lastUsed: Date.now(),
        isHealthy: true,
        isInUse: false,
        region: config.region || 'unknown',
        requestCount: 0,
        errorCount: 0,
      };

      logger.log(`Created new Supabase connection for pool '${poolId}' in ${creationTime}ms`);
      return connection;

    } catch (error: unknown) {
      logger.error(`Failed to create connection for pool '${poolId}':`, error);
      throw error;
    }
  }

  /**
   * Perform health check on a connection
   */
  private async performHealthCheck(client: SupabaseClient): Promise<boolean> {
    try {
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Health check timeout')), TIMEOUTS.QUICK);
      });

      const healthPromise = client
        .from('robots')
        .select('id')
        .limit(1)
        .single()
        .then((value: any) => {
          clearTimeout(timeoutId);
          return value;
        });

      const result = await Promise.race([healthPromise, timeoutPromise]);
      return !('error' in result && result.error);
    } catch {
      return false;
    }
  }

  /**
   * Wait for an available connection
   */
  private async waitForAvailableConnection(poolId: string, timeout: number): Promise<PooledConnection | undefined> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const pool = this.pools.get(poolId) || [];
      const connection = pool.find(conn => !conn.isInUse && conn.isHealthy);
      
      if (connection) {
        return connection;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, STAGGER.DEFAULT_DELAY_MS));
    }
    
    return undefined;
  }

  /**
   * Ensure minimum number of connections in pool
   */
  private async ensureMinimumConnections(poolId: string): Promise<void> {
    const config = this.configs.get(poolId);
    const pool = this.pools.get(poolId) || [];
    
    if (!config) return;

    const currentCount = pool.length;
    const needed = config.minConnections - currentCount;
    
    if (needed > 0) {
      const promises = Array.from({ length: needed }, () => 
        this.createNewConnection(poolId, config)
      );
      
      const newConnections = await Promise.allSettled(promises);
      
      for (const result of newConnections) {
        if (result.status === 'fulfilled') {
          pool.push(result.value);
        }
      }
      
      this.pools.set(poolId, pool);
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performPoolHealthChecks();
    }, 15000); // Every 15 seconds
  }

  /**
   * Perform health checks on all connections
   */
  private async performPoolHealthChecks(): Promise<void> {
    for (const [poolId, pool] of this.pools) {
      const config = this.configs.get(poolId);
      if (!config) continue;

      for (const connection of pool) {
        if (connection.isInUse) continue; // Skip active connections

        const isHealthy = await this.performHealthCheck(connection.client);
        
        if (!isHealthy) {
          connection.isHealthy = false;
          connection.errorCount++;
          logger.warn(`Connection in pool '${poolId}' marked as unhealthy`);
        } else {
          connection.isHealthy = true;
        }
      }

      // Remove unhealthy connections and create new ones to maintain minimum
      await this.cleanupUnhealthyConnections(poolId);
      await this.ensureMinimumConnections(poolId);
    }

    this.updateMetrics();
  }

  /**
   * Clean up unhealthy connections
   */
  private async cleanupUnhealthyConnections(poolId: string): Promise<void> {
    const pool = this.pools.get(poolId) || [];
    const config = this.configs.get(poolId);
    
    if (!config) return;

    const healthyConnections = pool.filter(conn => {
      // Remove connections that are unhealthy or too old
      const isTooOld = Date.now() - conn.created > TIME_CONSTANTS.MINUTE * 30; // 30 minutes
      const isIdle = !conn.isInUse && Date.now() - conn.lastUsed > config.idleTimeout;
      
      return conn.isHealthy && !isTooOld && !(isIdle && pool.length > config.minConnections);
    });

    this.pools.set(poolId, healthyConnections);
  }

  /**
   * Start cleanup timer for idle connections
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupIdleConnections();
    }, TIME_CONSTANTS.MINUTE); // Every minute
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    for (const [poolId, pool] of this.pools) {
      const config = this.configs.get(poolId);
      if (!config) continue;

      const activeConnections = pool.filter(conn => {
        const isIdle = !conn.isInUse && Date.now() - conn.lastUsed > config.idleTimeout;
        return !isIdle || pool.length <= config.minConnections;
      });

      this.pools.set(poolId, activeConnections);
    }

    this.updateMetrics();
  }

  /**
   * Update pool metrics
   */
  private updateMetrics(): void {
    let totalConnections = 0;
    let activeConnections = 0;
    let idleConnections = 0;
    let unhealthyConnections = 0;
    const totalResponseTime = 0;
    let totalErrors = 0;
    let totalRequests = 0;
    const regionDistribution: Record<string, number> = {};

    for (const [, pool] of this.pools) {
      for (const connection of pool) {
        totalConnections++;
        
        if (connection.isInUse) {
          activeConnections++;
        } else {
          idleConnections++;
        }
        
        if (!connection.isHealthy) {
          unhealthyConnections++;
        }
        
        totalRequests += connection.requestCount;
        totalErrors += connection.errorCount;
        
        regionDistribution[connection.region] = (regionDistribution[connection.region] || 0) + 1;
      }
    }

    this.metrics = {
      totalConnections,
      activeConnections,
      idleConnections,
      unhealthyConnections,
      averageResponseTime: totalResponseTime / Math.max(totalConnections, 1),
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      connectionUtilization: totalConnections > 0 ? activeConnections / totalConnections : 0,
      regionDistribution
    };
  }

  /**
   * Get pool metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed pool status
   */
  getPoolStatus(poolId: string): {
    config: ConnectionConfig | undefined;
    connections: PooledConnection[];
    health: 'healthy' | 'warning' | 'critical';
  } {
    const config = this.configs.get(poolId);
    const connections = this.pools.get(poolId) || [];
    
    const unhealthyCount = connections.filter(conn => !conn.isHealthy).length;
    const utilization = connections.length > 0 ? connections.filter(conn => conn.isInUse).length / connections.length : 0;
    
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (unhealthyCount > connections.length * 0.3 || utilization > 0.9) {
      health = 'critical';
    } else if (unhealthyCount > 0 || utilization > 0.7) {
      health = 'warning';
    }
    
    return {
      config,
      connections,
      health
    };
  }

  /**
   * Warm up connections for all pools
   */
  async warmUpAllPools(): Promise<void> {
    const warmupPromises = Array.from(this.configs.keys()).map(poolId => 
      this.warmUpPool(poolId)
    );
    
    await Promise.allSettled(warmupPromises);
  }

  /**
   * Warm up a specific pool
   */
  async warmUpPool(poolId: string): Promise<void> {
    const config = this.configs.get(poolId);
    if (!config) return;

    logger.log(`Warming up pool '${poolId}'...`);
    
    // Ensure minimum connections are created and healthy
    await this.ensureMinimumConnections(poolId);
    await this.performPoolHealthChecks();
    
    logger.log(`Pool '${poolId}' warmed up successfully`);
  }

  /**
   * Close all connections and cleanup
   */
  async closeAllPools(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.pools.clear();
    this.configs.clear();
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      unhealthyConnections: 0,
      averageResponseTime: 0,
      errorRate: 0,
      connectionUtilization: 0,
      regionDistribution: {}
    };
    
    logger.log('All Supabase connection pools closed');
  }

  /**
   * Execute operation with automatic connection management
   */
  async execute<T>(
    poolId: string,
    operation: (client: SupabaseClient) => Promise<T>,
    options: {
      preferReadReplica?: boolean;
      retryAttempts?: number;
    } = {}
  ): Promise<T> {
    const { preferReadReplica = false, retryAttempts = 3 } = options;
    
    let lastError: Error;
    
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      let client: SupabaseClient | undefined;
      
      try {
        client = await this.acquireConnection(poolId, preferReadReplica);
        
        const result = await operation(client);
        
        this.releaseConnection(poolId, client);
        return result;
        
      } catch (error: unknown) {
        lastError = error as Error;
        
        if (client) {
          this.releaseConnection(poolId, client);
        }
        
        if (attempt === retryAttempts) {
          throw lastError;
        }
        
        // Exponential backoff with modular config
        const delay = Math.min(
          RETRY_CONFIG.BASE_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt),
          RETRY_CONFIG.CAP_DELAY_MS
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}

// Export singleton instance
export const advancedSupabasePool = AdvancedSupabasePool.getInstance();

// Export types and class for testing
export { AdvancedSupabasePool, type PooledConnection, type PoolMetrics };

// Convenience wrapper for common operations
export const withSupabaseClient = async <T>(
  _operation: (client: SupabaseClient) => Promise<T>,
  poolId: string = 'default'
): Promise<T> => {
  return advancedSupabasePool.execute(poolId, _operation);
};