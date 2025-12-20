/**
 * Consolidated Database Connection Manager
 * Merges functionality from: advancedSupabasePool, edgeSupabasePool, supabaseConnectionPool, resilientSupabase
 * Provides unified connection management, health monitoring, and auto-scaling for all database operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from '../settingsManager';
import { handleError } from '../../utils/errorHandler';

// Dynamic client creation function (replaced dynamicSupabaseLoader)
const createDynamicSupabaseClient = async (
  url: string, 
  anonKey: string, 
  additionalConfig?: any
): Promise<SupabaseClient> => {
  const baseConfig = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'quanforge-ai/1.0.0',
      },
    },
  };

  const config = additionalConfig 
    ? { ...baseConfig, ...additionalConfig }
    : baseConfig;

  return createClient(url, anonKey, config);
};

// Consolidated connection configuration
export interface ConnectionConfig {
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
  readReplicaKey?: string;
  edgeOptimized: boolean;
}

// Unified connection interface
export interface DatabaseConnection {
  client: SupabaseClient;
  created: number;
  lastUsed: number;
  isHealthy: boolean;
  isInUse: boolean;
  region: string;
  requestCount: number;
  errorCount: number;
  lastError?: string;
  responseTime: number;
}

// Pool metrics interface
export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  unhealthyConnections: number;
  averageResponseTime: number;
  errorRate: number;
  connectionUtilization: number;
  regionDistribution: Record<string, number>;
}

class ConnectionManager {
  private static instance: ConnectionManager;
  private pools: Map<string, DatabaseConnection[]> = new Map();
  private configs: Map<string, ConnectionConfig> = new Map();
  private readReplicas: DatabaseConnection[] = [];
  private metrics: PoolMetrics;
  private healthCheckTimer: NodeJS.Timeout | null = null;

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
    this.initializePool();
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  private async initializePool(): Promise<void> {
    const config = await this.getDefaultConfig();
    this.configs.set('default', config);
    
    // Initialize primary pool
    await this.createConnectionPool('default', config);
    
    // Initialize read replicas if configured
    if (config.enableReadReplica && config.readReplicaUrl) {
      await this.initializeReadReplicas(config);
    }
    
    this.startHealthChecks();
  }

  private async getDefaultConfig(): Promise<ConnectionConfig> {
    const settings = settingsManager.getDBSettings();
    return {
      url: settings.url || process.env['VITE_SUPABASE_URL'] || '',
      anonKey: settings.anonKey || process.env['VITE_SUPABASE_ANON_KEY'] || '',
      region: process.env['VITE_SUPABASE_REGION'] || 'us-east-1',
      maxConnections: parseInt(process.env['VITE_DB_MAX_CONNECTIONS'] || '50'),
      minConnections: parseInt(process.env['VITE_DB_MIN_CONNECTIONS'] || '10'),
      connectionTimeout: parseInt(process.env['VITE_DB_CONNECTION_TIMEOUT'] || '5000'),
      idleTimeout: parseInt(process.env['VITE_DB_IDLE_TIMEOUT'] || '300000'), // 5 minutes
      healthCheckInterval: parseInt(process.env['VITE_DB_HEALTH_CHECK_INTERVAL'] || '30000'), // 30 seconds
      retryAttempts: parseInt(process.env['VITE_DB_RETRY_ATTEMPTS'] || '3'),
      retryDelay: parseInt(process.env['VITE_DB_RETRY_DELAY'] || '1000'),
      enableReadReplica: process.env['VITE_DB_ENABLE_READ_REPLICA'] === 'true',
      readReplicaUrl: process.env['VITE_DB_READ_REPLICA_URL'],
      readReplicaKey: process.env['VITE_DB_READ_REPLICA_KEY'],
      edgeOptimized: process.env['VITE_DB_EDGE_OPTIMIZED'] === 'true'
    };
  }

  private async createConnectionPool(poolId: string, config: ConnectionConfig): Promise<void> {
    const pool: DatabaseConnection[] = [];
    
    for (let i = 0; i < config.minConnections; i++) {
      const connection = await this.createConnection(config);
      if (connection) {
        pool.push(connection);
      }
    }
    
    this.pools.set(poolId, pool);
  }

  private async createConnection(config: ConnectionConfig): Promise<DatabaseConnection | null> {
    try {
      const startTime = Date.now();
      
      // Choose appropriate client creation method
      const client = config.edgeOptimized 
        ? await createDynamicSupabaseClient(config.url, config.anonKey, {
            db: {
              schema: 'public'
            },
            auth: {
              persistSession: true,
              autoRefreshToken: true
            },
            global: {
              headers: {
                'X-Connection-Manager': 'unified-edge'
              }
            }
          })
        : createClient(config.url, config.anonKey, {
            db: {
              schema: 'public'
            },
            auth: {
              persistSession: true,
              autoRefreshToken: true
            },
            global: {
              headers: {
                'X-Connection-Manager': 'unified'
              }
            }
          });

      const responseTime = Date.now() - startTime;
      
      return {
        client,
        created: Date.now(),
        lastUsed: Date.now(),
        isHealthy: true,
        isInUse: false,
        region: config.region || 'default',
        requestCount: 0,
        errorCount: 0,
        responseTime
      };
    } catch (error) {
      handleError(error as Error, 'createConnection');
      return null;
    }
  }

  private async initializeReadReplicas(config: ConnectionConfig): Promise<void> {
    if (!config.readReplicaUrl || !config.readReplicaKey) return;

    const replicaConfig: ConnectionConfig = {
      ...config,
      url: config.readReplicaUrl,
      anonKey: config.readReplicaKey,
      region: config.region + '-replica',
      maxConnections: Math.floor(config.maxConnections / 2),
      minConnections: 1
    };

    const replicaConnection = await this.createConnection(replicaConfig);
    if (replicaConnection) {
      this.readReplicas.push(replicaConnection);
    }
  }

  async getConnection(readOnly: boolean = false): Promise<SupabaseClient> {
    const pool = this.pools.get('default');
    if (!pool || pool.length === 0) {
      throw new Error('No database connections available');
    }

    // For read-only operations, prefer read replicas
    if (readOnly && this.readReplicas.length > 0) {
      const replica = this.readReplicas.find(r => r.isHealthy && !r.isInUse);
      if (replica) {
        replica.isInUse = true;
        replica.lastUsed = Date.now();
        return replica.client;
      }
    }

    // Get connection from primary pool
    const connection = pool.find(conn => conn.isHealthy && !conn.isInUse);
    if (!connection) {
      // Try to create new connection if under max limit
      const config = this.configs.get('default');
      if (config && pool.length < config.maxConnections) {
        const newConnection = await this.createConnection(config);
        if (newConnection) {
          pool.push(newConnection);
          newConnection.isInUse = true;
          return newConnection.client;
        }
      }
      throw new Error('No available database connections');
    }

    connection.isInUse = true;
    connection.lastUsed = Date.now();
    return connection.client;
  }

  releaseConnection(client: SupabaseClient): void {
    // Release from primary pool
    for (const pool of this.pools.values()) {
      const connection = pool.find(conn => conn.client === client);
      if (connection) {
        connection.isInUse = false;
        return;
      }
    }

    // Release from read replicas
    const replica = this.readReplicas.find(conn => conn.client === client);
    if (replica) {
      replica.isInUse = false;
    }
  }

  async validateConnection(connection: DatabaseConnection): Promise<boolean> {
    try {
      const startTime = Date.now();
      const { error } = await connection.client.from('robots').select('id').limit(1);
      const responseTime = Date.now() - startTime;
      
      if (error) {
        connection.errorCount++;
        connection.isHealthy = false;
        connection.lastError = error.message;
        return false;
      }

      connection.responseTime = responseTime;
      connection.isHealthy = true;
      connection.lastUsed = Date.now();
      return true;
    } catch (error) {
      connection.errorCount++;
      connection.isHealthy = false;
      connection.lastError = (error as Error).message;
      return false;
    }
  }

  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
      await this.updateMetrics();
    }, parseInt(process.env['VITE_DB_HEALTH_CHECK_INTERVAL'] || '30000'));
  }

  private async performHealthChecks(): Promise<void> {
    for (const pool of this.pools.values()) {
      for (const connection of pool) {
        if (!connection.isInUse) {
          await this.validateConnection(connection);
        }
      }
    }

    for (const replica of this.readReplicas) {
      if (!replica.isInUse) {
        await this.validateConnection(replica);
      }
    }
  }

  private async updateMetrics(): Promise<void> {
    let totalConnections = 0;
    let activeConnections = 0;
    let idleConnections = 0;
    let unhealthyConnections = 0;
    let totalResponseTime = 0;
    let totalErrors = 0;
    let totalRequests = 0;
    const regionDistribution: Record<string, number> = {};

    for (const pool of this.pools.values()) {
      for (const connection of pool) {
        totalConnections++;
        totalResponseTime += connection.responseTime;
        totalErrors += connection.errorCount;
        totalRequests += connection.requestCount;
        
        if (connection.isInUse) activeConnections++;
        else idleConnections++;
        
        if (!connection.isHealthy) unhealthyConnections++;
        
        regionDistribution[connection.region] = (regionDistribution[connection.region] || 0) + 1;
      }
    }

    for (const replica of this.readReplicas) {
      totalConnections++;
      totalResponseTime += replica.responseTime;
      totalErrors += replica.errorCount;
      totalRequests += replica.requestCount;
      
      if (replica.isInUse) activeConnections++;
      else idleConnections++;
      
      if (!replica.isHealthy) unhealthyConnections++;
      
      regionDistribution[replica.region] = (regionDistribution[replica.region] || 0) + 1;
    }

    this.metrics = {
      totalConnections,
      activeConnections,
      idleConnections,
      unhealthyConnections,
      averageResponseTime: totalConnections > 0 ? totalResponseTime / totalConnections : 0,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      connectionUtilization: totalConnections > 0 ? (activeConnections / totalConnections) * 100 : 0,
      regionDistribution
    };
  }

  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Close all connections
    for (const pool of this.pools.values()) {
      pool.forEach(connection => {
        connection.client.removeAllChannels();
        connection.client = null as any;
      });
    }

    this.readReplicas.forEach(replica => {
      replica.client.removeAllChannels();
      replica.client = null as any;
    });

    this.pools.clear();
    this.readReplicas = [];
  }
}

// Export singleton instance
export const connectionManager = ConnectionManager.getInstance();

// Export legacy compatibility functions
export const edgeConnectionPool = connectionManager;
export default connectionManager;