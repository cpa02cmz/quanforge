import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from './settingsManager';

interface EnhancedPoolConfig {
  maxConnections: number;
  minConnections: number;
  idleTimeout: number;
  healthCheckInterval: number;
  connectionTimeout: number;
  maxRetries: number;
  backoffMultiplier: number;
  evictionThreshold: number; // Connection error count threshold for eviction
}

interface ConnectionHealth {
  isHealthy: boolean;
  lastCheck: number;
  responseTime: number;
  errorCount: number;
  lastUsed: number;
  inUse: boolean;
  useCount: number;
}

interface PooledConnection {
  client: SupabaseClient;
  health: ConnectionHealth;
}

class EnhancedConnectionPool {
  private static instance: EnhancedConnectionPool;
  private connections: Map<string, PooledConnection> = new Map();
  private availableConnections: string[] = [];
  private config: EnhancedPoolConfig = {
    maxConnections: 10,
    minConnections: 2,
    idleTimeout: 300000, // 5 minutes
    healthCheckInterval: 30000, // 30 seconds
    connectionTimeout: 10000, // 10 seconds
    maxRetries: 3,
    backoffMultiplier: 2,
    evictionThreshold: 3, // Evict connection after 3 consecutive errors
  };
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private connectionIdCounter = 0;

  private constructor() {
    this.startHealthChecks();
    this.initializeMinConnections();
  }

  static getInstance(): EnhancedConnectionPool {
    if (!EnhancedConnectionPool.instance) {
      EnhancedConnectionPool.instance = new EnhancedConnectionPool();
    }
    return EnhancedConnectionPool.instance;
  }

  private initializeMinConnections(): void {
    // Initialize minimum number of connections based on config
    for (let i = 0; i < this.config.minConnections; i++) {
      this.createConnection(`init-${i}`);
    }
  }

  async getConnection(): Promise<SupabaseClient> {
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode !== 'supabase' || !settings.url || !settings.anonKey) {
      throw new Error('Supabase not configured');
    }

    // First, try to get an available healthy connection
    for (const connectionId of this.availableConnections) {
      const pooledConnection = this.connections.get(connectionId);
      if (pooledConnection && pooledConnection.health.isHealthy && !pooledConnection.health.inUse) {
        // Mark as in use and return
        pooledConnection.health.inUse = true;
        pooledConnection.health.lastUsed = Date.now();
        pooledConnection.health.useCount++;
        
        // Remove from available list
        const index = this.availableConnections.indexOf(connectionId);
        if (index !== -1) {
          this.availableConnections.splice(index, 1);
        }
        
        return pooledConnection.client;
      }
    }

    // If no available connections, try to create a new one if under limit
    if (this.connections.size < this.config.maxConnections) {
      const newConnectionId = `conn-${++this.connectionIdCounter}`;
      const newClient = await this.createConnection(newConnectionId);
      
      if (newClient) {
        const pooledConnection = this.connections.get(newConnectionId)!;
        pooledConnection.health.inUse = true;
        pooledConnection.health.lastUsed = Date.now();
        pooledConnection.health.useCount++;
        
        return pooledConnection.client;
      }
    }

    // If pool is full, wait and retry or throw an error
    throw new Error('Connection pool exhausted. All connections are in use.');
  }

  async releaseConnection(client: SupabaseClient): Promise<void> {
    for (const [connectionId, pooledConnection] of this.connections) {
      if (pooledConnection.client === client) {
        // Mark as available again
        pooledConnection.health.inUse = false;
        
        // Add to available list if not already there
        if (!this.availableConnections.includes(connectionId)) {
          this.availableConnections.push(connectionId);
        }
        
        // Check if we should shrink the pool if it's too large and underutilized
        this.maybeShrinkPool();
        break;
      }
    }
  }

  private async createConnection(connectionId: string): Promise<SupabaseClient | null> {
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode !== 'supabase' || !settings.url || !settings.anonKey) {
      throw new Error('Supabase not configured');
    }

    try {
      // Create new connection with optimized config
      const client = createClient(settings.url, settings.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-application-name': 'quanforge-ai-enhanced',
            'x-connection-id': connectionId,
          },
          fetch: (url, options = {}) => {
            // Add request timeout handling
            return Promise.race([
              fetch(url, options),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), this.config.connectionTimeout)
              ) as Promise<Response>
            ]);
          }
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });

      // Test connection
      const isHealthy = await this.testConnection(client);
      
      if (isHealthy) {
        const pooledConnection: PooledConnection = {
          client,
          health: {
            isHealthy: true,
            lastCheck: Date.now(),
            responseTime: 0,
            errorCount: 0,
            lastUsed: Date.now(),
            inUse: false,
            useCount: 0,
          }
        };
        
        this.connections.set(connectionId, pooledConnection);
        this.availableConnections.push(connectionId);
        return client;
      } else {
        throw new Error('Failed to establish healthy Supabase connection');
      }
    } catch (error) {
      console.error(`Failed to create connection ${connectionId}:`, error);
      return null;
    }
  }

  private async testConnection(client: SupabaseClient): Promise<boolean> {
    try {
      const startTime = Date.now();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeout)
      );
      
      // Use a lightweight query for connection testing
      const queryPromise = client
        .from('robots')
        .select('id')
        .limit(1);
      
      const result = await Promise.race([queryPromise, timeoutPromise]) as { data?: any[]; error?: any };
      const responseTime = Date.now() - startTime;
      
      // Check if result has error property
      if (result && result.error) {
        console.error('Connection health check failed:', result.error);
        return false;
      }
      
      // Optionally log response time for debugging
      // console.log(`Connection test response time: ${responseTime}ms`);
      
      return true;
    } catch (error: any) {
      console.error('Connection health check failed:', error?.message || error);
      return false;
    }
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const now = Date.now();
    
    for (const [connectionId, pooledConnection] of this.connections) {
      const { client, health } = pooledConnection;
      
      try {
        const startTime = Date.now();
        const isHealthy = await this.testConnection(client);
        const responseTime = Date.now() - startTime;
        
        // Update health status
        pooledConnection.health = {
          ...health,
          isHealthy,
          lastCheck: now,
          responseTime,
          errorCount: isHealthy ? 0 : health.errorCount + 1,
        };

        // Remove unhealthy connections that have exceeded the error threshold
        if (!isHealthy && health.errorCount >= this.config.evictionThreshold) {
          this.connections.delete(connectionId);
          
          // Remove from available connections list
          const index = this.availableConnections.indexOf(connectionId);
          if (index !== -1) {
            this.availableConnections.splice(index, 1);
          }
          
          console.warn(`Removed unhealthy connection: ${connectionId} (error count: ${health.errorCount})`);
        }
        
        // Clean up idle connections that are not in use
        this.cleanupIdleConnections();
      } catch (error) {
        console.error(`Health check failed for connection ${connectionId}:`, error);
      }
    }
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];
    
    for (const [connectionId, pooledConnection] of this.connections) {
      const { health } = pooledConnection;
      
      // Don't remove connections that are in use
      if (health.inUse) continue;
      
      // Remove connections that have been idle beyond the timeout
      if (now - health.lastUsed > this.config.idleTimeout) {
        // Only remove if we have more than the minimum connections
        if (this.connections.size > this.config.minConnections) {
          connectionsToRemove.push(connectionId);
        }
      }
    }
    
    for (const connectionId of connectionsToRemove) {
      this.connections.delete(connectionId);
      
      // Remove from available connections list
      const index = this.availableConnections.indexOf(connectionId);
      if (index !== -1) {
        this.availableConnections.splice(index, 1);
      }
      
      console.log(`Removed idle connection: ${connectionId}`);
    }
  }

  private maybeShrinkPool(): void {
    // Only shrink if we're above the minimum and utilization is low
    if (this.connections.size <= this.config.minConnections) return;
    
    const totalConnections = this.connections.size;
    const inUseConnections = Array.from(this.connections.values())
      .filter(conn => conn.health.inUse).length;
    const utilization = totalConnections > 0 ? inUseConnections / totalConnections : 0;
    
    // If utilization is low and we have more than minimum connections, consider cleanup
    if (utilization < 0.3) {
      this.cleanupIdleConnections();
    }
  }

  async closeConnection(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
    
    // Remove from available connections list
    const index = this.availableConnections.indexOf(connectionId);
    if (index !== -1) {
      this.availableConnections.splice(index, 1);
    }
  }

  async closeAllConnections(): Promise<void> {
    this.connections.clear();
    this.availableConnections = [];
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // Get connection metrics for monitoring
  getConnectionMetrics(): {
    totalConnections: number;
    availableConnections: number;
    inUseConnections: number;
    healthyConnections: number;
    averageResponseTime: number;
    totalErrors: number;
    totalUsageCount: number;
    utilization: number;
  } {
    const healthArray = Array.from(this.connections.values()).map(pc => pc.health);
    const healthyConnections = healthArray.filter(h => h.isHealthy).length;
    const inUseConnections = healthArray.filter(h => h.inUse).length;
    const averageResponseTime = healthArray.length > 0 
      ? healthArray.reduce((sum, h) => sum + h.responseTime, 0) / healthArray.length 
      : 0;
    const totalErrors = healthArray.reduce((sum, h) => sum + h.errorCount, 0);
    const totalUsageCount = healthArray.reduce((sum, h) => sum + h.useCount, 0);
    const utilization = healthArray.length > 0 ? inUseConnections / healthArray.length : 0;

    return {
      totalConnections: this.connections.size,
      availableConnections: this.availableConnections.length,
      inUseConnections,
      healthyConnections,
      averageResponseTime,
      totalErrors,
      totalUsageCount,
      utilization,
    };
  }

  // Update configuration dynamically
  updateConfig(newConfig: Partial<EnhancedPoolConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Adjust connection pool based on new configuration
    if (this.config.minConnections > this.connections.size) {
      // Add more connections if needed
      const needed = this.config.minConnections - this.connections.size;
      for (let i = 0; i < needed; i++) {
        this.createConnection(`dynamic-${++this.connectionIdCounter}`);
      }
    } else if (this.config.minConnections < this.connections.size) {
      // Clean up excess connections
      this.cleanupIdleConnections();
    }
  }

  // Get current configuration
  getConfig(): EnhancedPoolConfig {
    return { ...this.config };
  }

  // Force health check on all connections
  async forceHealthCheck(): Promise<void> {
    await this.performHealthChecks();
  }
}

export const enhancedConnectionPool = EnhancedConnectionPool.getInstance();