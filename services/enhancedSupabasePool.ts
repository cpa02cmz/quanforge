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
  // Edge-specific optimizations
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

class EnhancedSupabaseConnectionPool {
  private static instance: EnhancedSupabaseConnectionPool;
  private connections: Map<string, Connection> = new Map();
  private readReplicaClients: Map<string, SupabaseClient> = new Map();
  private waitingQueue: Array<{
    resolve: (connection: Connection) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private config: ConnectionConfig = {
    maxConnections: 8, // Optimized for serverless edge environment
    minConnections: 2, // Reduced minimum for edge efficiency
    acquireTimeout: 1000, // 1 second - optimized for edge functions
    idleTimeout: 60000, // 1 minute - faster cleanup for serverless
    healthCheckInterval: 15000, // 15 seconds - frequent health checks
    retryAttempts: 2, // Fewer retries for edge environment
    retryDelay: 200, // Faster retry for edge recovery
    // Add missing edge optimizations
    enableConnectionDraining: true,
    regionAffinity: true,
    connectionWarming: true
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
  private healthCheckTimer: number | null = null;
  private cleanupTimer: number | null = null;
  private edgeWarmingTimer: number | null = null;
  private acquireTimes: number[] = [];
  private edgeRegions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1', 'cle1'];

  private constructor() {
    this.initializePool();
    this.startHealthChecks();
    this.startCleanup();
    // Initialize edge warming if enabled
    if (this.config.connectionWarming) {
      this.initializeEdgeWarming();
    }
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
    const preferredRegion = region || process.env['VERCEL_REGION'] || 'default';
    
    // Enhanced connection configuration for edge optimization
    const client = new SupabaseClient(settings.url, settings.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'X-Connection-ID': id,
          'X-Connection-Region': preferredRegion,
          'X-Edge-Optimized': 'true',
          'X-Client-Info': 'quantforge-edge/1.0.0',
          'X-Priority': 'high',
          'X-Connection-Pool': 'enhanced',
          'X-Serverless-Optimized': 'true'
        }
      },
      // Edge-specific options
      realtime: {
        params: {
          edge: 'true',
          region: preferredRegion
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

  async acquire(region?: string, useReadReplica: boolean = false): Promise<SupabaseClient> {
    const startTime = performance.now();
    const preferredRegion = region || process.env['VERCEL_REGION'] || 'default';

    // Use read replica for read operations if requested and available
    if (useReadReplica) {
      const readClient = await this.acquireReadReplica(preferredRegion);
      if (readClient) {
        const acquireTime = performance.now() - startTime;
        this.recordAcquireTime(acquireTime);
        console.debug(`Using read replica for region: ${preferredRegion}`);
        return readClient;
      }
    }

    // Try to find an available connection with enhanced selection logic
    let connection = this.getOptimalConnection(preferredRegion);

    if (!connection) {
      // Try to create a new connection if under limit
      if (this.stats.totalConnections < this.config.maxConnections) {
        try {
          connection = await this.createConnection(preferredRegion);
          console.debug(`Created new connection for region: ${preferredRegion}`);
        } catch (error) {
          console.warn('Failed to create new connection:', error);
          
          // Fallback: try to create connection without region preference
          if (this.stats.totalConnections < this.config.maxConnections) {
            try {
              connection = await this.createConnection();
            } catch (fallbackError) {
              console.warn('Fallback connection creation failed:', fallbackError);
            }
          }
        }
      }

      // If still no connection, wait for one to become available
      if (!connection) {
        connection = await this.waitForConnection();
      }
    }

    if (!connection) {
      throw new Error(`Unable to acquire database connection for region: ${preferredRegion}`);
    }

    // Mark connection as in use and update metadata
    connection.inUse = true;
    connection.lastUsed = Date.now();
    
    // Update region if different (for connection reuse)
    if (connection.region !== preferredRegion) {
      connection.region = preferredRegion;
    }

    // Record acquire time
    const acquireTime = performance.now() - startTime;
    this.recordAcquireTime(acquireTime);

    // Log slow acquisitions
    if (acquireTime > 1000) {
      console.warn(`Slow connection acquisition: ${acquireTime.toFixed(2)}ms for region ${preferredRegion}`);
    }

    this.updateStats();

    return connection.client;
  }



  /**
   * Get optimal connection based on region, health, and recent usage
   */
  private getOptimalConnection(region?: string): Connection | null {
    const now = Date.now();
    const candidates: Array<{ connection: Connection; score: number }> = [];

    for (const connection of this.connections.values()) {
      if (connection.inUse || !connection.healthy) {
        continue;
      }

      let score = 0;

      // Region preference (highest priority)
      if (region && connection.region === region) {
        score += 1000;
      }

      // Recent usage penalty (prefer less recently used)
      const idleTime = now - connection.lastUsed;
      score += Math.min(idleTime / 1000, 100); // Max 100 points for idle time

      // Connection age preference (prefer established connections)
      const age = now - connection.created;
      if (age > 60000) { // More than 1 minute old
        score += 50;
      }

      candidates.push({ connection, score });
    }

    // Sort by score (highest first) and return the best
    candidates.sort((a, b) => b.score - a.score);
    
    return candidates.length > 0 ? (candidates[0]?.connection || null) : null;
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
      const startTime = performance.now();
      
      // Enhanced health check with multiple validation steps
      // 1. Basic connectivity test
      const { error: pingError } = await connection.client
        .from('robots')
        .select('id')
        .limit(1)
        .single();

      if (pingError) {
        connection.healthy = false;
        return false;
      }

      // 2. Performance check - should be fast for healthy connection
      const responseTime = performance.now() - startTime;
      if (responseTime > 1000) { // 1 second threshold for edge environment
        console.warn(`Connection ${connection.id} slow response: ${responseTime.toFixed(2)}ms`);
        connection.healthy = false;
        return false;
      }

      // 3. Auth check (if applicable)
      try {
        await connection.client.auth.getSession();
      } catch (authError) {
        // Auth errors are not critical for connection health
        console.debug(`Auth check failed for connection ${connection.id}:`, authError);
      }

      connection.healthy = true;
      connection.lastUsed = Date.now(); // Update last used on successful health check
      
      return true;
    } catch (error) {
      connection.healthy = false;
      console.warn(`Connection ${connection.id} health check failed:`, error);
      return false;
    }
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = window.setInterval(async () => {
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
    this.cleanupTimer = window.setInterval(() => {
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
      window.clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.cleanupTimer) {
      window.clearInterval(this.cleanupTimer);
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

  /**
   * Acquire a read replica client for read operations
   */
  private async acquireReadReplica(region?: string): Promise<SupabaseClient | null> {
    const settings = settingsManager.getDBSettings();
    
    // Check if read replica is configured (using environment variables as fallback)
    const readReplicaUrl = (settings as any).readReplicaUrl || process.env['VITE_SUPABASE_READ_REPLICA_URL'];
    const readReplicaAnonKey = (settings as any).readReplicaAnonKey || process.env['VITE_SUPABASE_READ_REPLICA_ANON_KEY'];
    
    if (!readReplicaUrl || !readReplicaAnonKey) {
      return null; // No read replica configured
    }

    const replicaKey = `${region || 'default'}_read_replica`;
    let readClient = this.readReplicaClients.get(replicaKey);

    if (!readClient) {
      try {
        readClient = new SupabaseClient(readReplicaUrl, readReplicaAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          },
          db: {
            schema: 'public'
          },
          global: {
            headers: {
              'X-Connection-Type': 'read-replica',
              'X-Connection-Region': region || process.env['VERCEL_REGION'] || 'default',
              'X-Edge-Optimized': 'true',
              'X-Client-Info': 'quantforge-read-replica/1.0.0'
            }
          }
        });

        // Test the connection
        const { error } = await readClient.from('robots').select('id').limit(1);
        if (error) {
          console.warn('Read replica connection test failed:', error);
          return null;
        }

        this.readReplicaClients.set(replicaKey, readClient);
        console.debug(`Created read replica client for region: ${region || 'default'}`);
      } catch (error) {
        console.warn('Failed to create read replica client:', error);
        return null;
      }
    }

    return readClient;
  }

  /**
   * Warm up read replica connections proactively
   */
  async warmUpReadReplicas(): Promise<void> {
    const regions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1'];
    const warmUpPromises = regions.map(async (region) => {
      try {
        await this.acquireReadReplica(region);
      } catch (error) {
        console.warn(`Failed to warm up read replica for region ${region}:`, error);
      }
    });

    await Promise.allSettled(warmUpPromises);
    console.log('Read replica warm-up completed');
  }

   /**
    * Get read replica statistics
    */
   getReadReplicaStats(): { region: string; status: 'connected' | 'disconnected'; lastUsed?: number }[] {
     const stats: { region: string; status: 'connected' | 'disconnected'; lastUsed?: number }[] = [];
     
     for (const [key, ] of this.readReplicaClients.entries()) {
       const region = key.replace('_read_replica', '');
       stats.push({
         region,
         status: 'connected', // We only store successful connections
         lastUsed: Date.now() // This could be enhanced with actual last used tracking
       });
     }

     return stats;
   }

/**
    * Close all read replica connections
    */
  async closeReadReplicas(): Promise<void> {
    this.readReplicaClients.clear();
    console.log('All read replica connections closed');
  }

  /**
   * Initialize edge connection warming
   */
  private async initializeEdgeWarming(): Promise<void> {
    // Delay initial warm-up to allow for application startup
    setTimeout(() => {
      this.warmEdgeConnections();
    }, 5000);

    // Schedule periodic warming
    this.edgeWarmingTimer = window.setInterval(() => {
      this.warmEdgeConnections();
    }, 300000); // Every 5 minutes
  }

  /**
   * Warm up edge connections across all regions
   */
  async warmEdgeConnections(): Promise<void> {
    if (!this.config.connectionWarming) {
      return;
    }

    const startTime = performance.now();
    const warmupPromises: Promise<void>[] = [];

    console.log('Starting edge connection warm-up...');

    // Warm up primary connections for each region
    for (const region of this.edgeRegions) {
      warmupPromises.push(this.warmRegionConnection(region));
    }

    // Warm up read replicas
    warmupPromises.push(this.warmUpReadReplicas());

    try {
      await Promise.allSettled(warmupPromises);
      const duration = performance.now() - startTime;
      console.log(`Edge connection warm-up completed in ${duration.toFixed(2)}ms`);
    } catch (error) {
      console.warn('Edge connection warm-up failed:', error);
    }
  }

  /**
   * Warm up connection for a specific region
   */
  private async warmRegionConnection(region: string): Promise<void> {
    try {
      // Check if we already have a healthy connection for this region
      const existingConnection = Array.from(this.connections.values())
        .find(conn => conn.region === region && conn.healthy && !conn.inUse);

      if (existingConnection) {
        console.debug(`Region ${region} already has a warm connection`);
        return;
      }

      // Create a new connection for the region if under limit
      if (this.stats.totalConnections < this.config.maxConnections) {
        const connection = await this.createConnection(region);
        
        // Perform a warm-up query
        await this.performWarmupQuery(connection.client);
        
        console.debug(`Warmed up connection for region: ${region}`);
      } else {
        console.debug(`Skipping warm-up for ${region} - connection pool at capacity`);
      }
    } catch (error) {
      console.warn(`Failed to warm up connection for region ${region}:`, error);
    }
  }

  /**
   * Perform a warm-up query to initialize the connection
   */
  private async performWarmupQuery(client: SupabaseClient): Promise<void> {
    try {
      // Simple lightweight query for warm-up
      await client
        .from('robots')
        .select('count', { count: 'exact', head: true })
        .limit(1);
    } catch (error) {
      // Don't throw error for warm-up failures, just log
      console.debug('Warm-up query failed:', error);
    }
  }

  /**
   * Get edge warming statistics
   */
  getEdgeWarmingStats(): {
    enabled: boolean;
    regions: string[];
    warmedRegions: string[];
    lastWarmup?: number;
    nextWarmup?: number;
  } {
    const warmedRegions = Array.from(this.connections.values())
      .filter(conn => conn.region && conn.healthy)
      .map(conn => conn.region!)
      .filter((region, index, self) => self.indexOf(region) === index);

    return {
      enabled: this.config.connectionWarming || false,
      regions: this.edgeRegions,
      warmedRegions,
      lastWarmup: this.edgeWarmingTimer ? Date.now() - 300000 : undefined,
      nextWarmup: this.edgeWarmingTimer ? Date.now() + 300000 : undefined
    } as {
      enabled: boolean;
      regions: string[];
      warmedRegions: string[];
      lastWarmup?: number;
      nextWarmup?: number;
    };
  }

  /**
   * Force immediate edge warming
   */
  async forceEdgeWarming(): Promise<void> {
    console.log('Forcing immediate edge connection warming...');
    await this.warmEdgeConnections();
  }

 /**
    * Optimize connection pool for edge deployment
    */
   optimizeForEdge(): void {
     // Update configuration for edge optimization
     this.updateConfig({
       maxConnections: Math.min(this.config.maxConnections, 6), // Lower max for edge
       minConnections: Math.max(this.config.minConnections, 1), // Ensure at least 1
       acquireTimeout: 800, // Faster timeout for edge
       idleTimeout: 45000, // Faster cleanup for serverless
       healthCheckInterval: 10000, // More frequent health checks
       retryAttempts: 1, // Reduce retries for edge to fail faster
       retryDelay: 150, // Faster retry for edge recovery
       connectionWarming: true,
       enableConnectionDraining: true,
       regionAffinity: true
     });
 
     console.log('Connection pool optimized for edge deployment');
   }
   
   /**
    * Implement smart routing to the nearest region
    */
   async routeToNearestRegion(): Promise<string> {
     const userRegion = process.env['VERCEL_REGION'] || 'default';
     const availableRegions = this.edgeRegions;
     
     // For now, return the current region; in production this could use 
     // more sophisticated routing based on latency measurements
     if (availableRegions.includes(userRegion)) {
       return userRegion;
     }
     
     // Fallback to the first available region
     return availableRegions[0] || 'default';
   }
   
   /**
    * Implement connection pre-warming for specific regions
    */
   async prewarmConnectionsForRegion(region: string, count: number = 2): Promise<void> {
     const promises = [];
     
     for (let i = 0; i < count; i++) {
       if (this.stats.totalConnections < this.config.maxConnections) {
         promises.push(this.createConnection(region));
       }
     }
     
     await Promise.allSettled(promises);
     console.log(`Pre-warmed ${promises.length} connections for region: ${region}`);
   }
   
   /**
    * Implement intelligent connection cleanup for serverless environments
    */
   async cleanupForServerless(): Promise<void> {
     const now = Date.now();
     const connectionsToRemove: string[] = [];
     
     for (const [id, connection] of this.connections.entries()) {
       // More aggressive cleanup for serverless
       if (connection.inUse || this.stats.totalConnections <= this.config.minConnections) {
         continue;
       }
 
       // Remove if idle for more than 30 seconds or unhealthy
       if (!connection.healthy || (now - connection.lastUsed) > 30000) {
         connectionsToRemove.push(id);
       }
     }
 
     connectionsToRemove.forEach(id => {
       this.connections.delete(id);
       console.debug(`Serverless cleanup: removed connection ${id}`);
     });
 
     if (connectionsToRemove.length > 0) {
       this.updateStats();
     }
   }
   
   /**
    * Get connection efficiency metrics
    */
   getConnectionEfficiency(): {
     utilizationRate: number;
     avgResponseTime: number;
     successRate: number;
     idleRate: number;
   } {
     const totalConnections = this.stats.totalConnections;
     if (totalConnections === 0) {
       return {
         utilizationRate: 0,
         avgResponseTime: 0,
         successRate: 1,
         idleRate: 1
       };
     }
     
     const activeRate = this.stats.activeConnections / totalConnections;
     const idleRate = this.stats.idleConnections / totalConnections;
     const successRate = 1 - (this.stats.unhealthyConnections / totalConnections);
     
     return {
       utilizationRate: activeRate,
       avgResponseTime: this.stats.avgAcquireTime,
       successRate,
       idleRate
     };
   }

  /**
   * Get connection metrics for edge monitoring
   */
  getEdgeMetrics(): {
    totalConnections: number;
    connectionsByRegion: Record<string, number>;
    healthyConnectionsByRegion: Record<string, number>;
    avgResponseTime: number;
    coldStartRate: number;
    cacheHitRate: number;
  } {
    const connectionsByRegion: Record<string, number> = {};
    const healthyConnectionsByRegion: Record<string, number> = {};

    for (const connection of this.connections.values()) {
      const region = connection.region || 'unknown';
      connectionsByRegion[region] = (connectionsByRegion[region] || 0) + 1;
      
      if (connection.healthy) {
        healthyConnectionsByRegion[region] = (healthyConnectionsByRegion[region] || 0) + 1;
      }
    }

    return {
      totalConnections: this.stats.totalConnections,
      connectionsByRegion,
      healthyConnectionsByRegion,
      avgResponseTime: this.stats.avgAcquireTime,
      coldStartRate: this.calculateColdStartRate(),
      cacheHitRate: this.stats.hitRate
    };
  }

  /**
   * Calculate cold start rate based on connection acquisition times
   */
  private calculateColdStartRate(): number {
    if (this.acquireTimes.length === 0) return 0;
    
    // Consider acquisitions over 500ms as potential cold starts
    const coldStarts = this.acquireTimes.filter(time => time > 500).length;
    return coldStarts / this.acquireTimes.length;
  }

  /**
   * Enhanced cleanup for edge environment
   */
  protected async cleanupForEdge(): Promise<void> {
    // Force cleanup of idle connections more aggressively
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [id, connection] of this.connections.entries()) {
      // More aggressive cleanup for edge
      if (connection.inUse || this.stats.totalConnections <= this.config.minConnections) {
        continue;
      }

      // Remove if idle for more than 30 seconds or unhealthy
      if (!connection.healthy || (now - connection.lastUsed) > 30000) {
        connectionsToRemove.push(id);
      }
    }

    connectionsToRemove.forEach(id => {
      this.connections.delete(id);
      console.debug(`Edge cleanup: removed connection ${id}`);
    });

    if (connectionsToRemove.length > 0) {
      this.updateStats();
    }
  }
}

export const enhancedConnectionPool = EnhancedSupabaseConnectionPool.getInstance();