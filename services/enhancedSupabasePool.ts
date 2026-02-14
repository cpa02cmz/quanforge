/**
 * Enhanced Supabase Connection Manager
 * Provides advanced connection pooling and optimization for Supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from './settingsManager';
import { createScopedLogger } from '../utils/logger';
import { createDynamicSupabaseClient } from './dynamicSupabaseLoader';
import { TIMEOUTS, RETRY_CONFIG, STAGGER, TIME_CONSTANTS, POOL_CONFIG, SCORING } from './constants';
import { THRESHOLD_CONSTANTS, DELAY_CONSTANTS } from './modularConstants';
import { getErrorMessage } from '../utils/errorHandler';

const logger = createScopedLogger('EnhancedConnectionPool');

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
    maxConnections: 4, // Optimized for edge performance
    minConnections: 1, // Reduced minimum for edge efficiency
    acquireTimeout: TIMEOUTS.POOL.ACQUIRE, // Faster timeout for edge failover
    idleTimeout: 3 * TIME_CONSTANTS.MINUTE, // 3 minutes - optimized for serverless
    healthCheckInterval: TIMEOUTS.POOL.HEALTH_CHECK, // 30 seconds - balanced for edge
    retryAttempts: RETRY_CONFIG.MAX_ATTEMPTS, // Fewer retries for edge environment
    retryDelay: RETRY_CONFIG.DELAYS.SHORT, // Optimized retry for edge recovery
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
  private timers: Set<number> = new Set(); // Track all timers for cleanup

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
      logger.log(`Enhanced connection pool initialized with ${this.config.minConnections} connections`);
    } catch (error: unknown) {
      logger.error('Failed to initialize connection pool:', getErrorMessage(error));
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
    const client = await createDynamicSupabaseClient(
      settings.url, 
      settings.anonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: 'pkce', // Enhanced security for edge
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
            'X-Serverless-Optimized': 'true',
            'X-Edge-Pool-Version': '2.0',
            'X-Connection-Timestamp': Date.now().toString(),
          }
        },
        // Edge-specific options
        realtime: {
          params: {
            edge: 'true',
            region: preferredRegion,
            pool: 'enhanced'
          }
        }
      }
    );

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
        logger.debug(`Using read replica for region: ${preferredRegion}`);
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
          logger.debug(`Created new connection for region: ${preferredRegion}`);
        } catch (error: unknown) {
          logger.warn('Failed to create new connection:', getErrorMessage(error));

          // Fallback: try to create connection without region preference
          if (this.stats.totalConnections < this.config.maxConnections) {
            try {
              connection = await this.createConnection();
            } catch (fallbackError: unknown) {
              logger.warn('Fallback connection creation failed:', getErrorMessage(fallbackError));
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
    if (acquireTime > THRESHOLD_CONSTANTS.API.TIMEOUT) {
      logger.warn(`Slow connection acquisition: ${acquireTime.toFixed(2)}ms for region ${preferredRegion}`);
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
        score += POOL_CONFIG.SCORING.REGION_MATCH_BONUS;
      }

      // Recent usage penalty (prefer less recently used)
      const idleTime = now - connection.lastUsed;
      score += Math.min(idleTime / 1000, SCORING.MAX_SCORE); // Max points for idle time

      // Connection age preference (prefer established connections)
      const age = now - connection.created;
      if (age > POOL_CONFIG.RECENT_USAGE_THRESHOLD_MS) { // More than threshold old
        score += POOL_CONFIG.SCORING.HEALTHY_BONUS;
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
      if (responseTime > THRESHOLD_CONSTANTS.API.TIMEOUT) { // 1 second threshold for edge environment
        logger.warn(`Connection ${connection.id} slow response: ${responseTime.toFixed(2)}ms`);
        connection.healthy = false;
        return false;
      }

      // 3. Auth check (if applicable)
      try {
        await connection.client.auth.getSession();
      } catch (authError) {
        // Auth errors are not critical for connection health
        logger.debug(`Auth check failed for connection ${connection.id}:`, authError);
      }

      connection.healthy = true;
      connection.lastUsed = Date.now(); // Update last used on successful health check

      return true;
    } catch (error: unknown) {
      connection.healthy = false;
      logger.warn(`Connection ${connection.id} health check failed:`, getErrorMessage(error));
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
            logger.warn(`Connection ${connection.id} became unhealthy`);
          } else if (!wasHealthy && isHealthy) {
            logger.info(`Connection ${connection.id} recovered`);
          }
        });

      await Promise.allSettled(healthCheckPromises);
      this.updateStats();
    }, this.config.healthCheckInterval);
    this.timers.add(this.healthCheckTimer);
  }

  private startCleanup(): void {
    this.cleanupTimer = window.setInterval(() => {
      this.cleanupIdleConnections();
      this.cleanupWaitingQueue();
    }, 60000); // Run cleanup every minute
    this.timers.add(this.cleanupTimer);
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
      logger.debug(`Removed idle connection ${id}`);
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
    logger.log('Connection pool configuration updated:', this.config);
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

    logger.log('Connection pool closed');
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
          logger.warn('Read replica connection test failed:', error);
          return null;
        }

        this.readReplicaClients.set(replicaKey, readClient);
        logger.debug(`Created read replica client for region: ${region || 'default'}`);
      } catch (error: unknown) {
        logger.warn('Failed to create read replica client:', getErrorMessage(error));
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
      } catch (error: unknown) {
        logger.warn(`Failed to warm up read replica for region ${region}:`, getErrorMessage(error));
      }
    });

    await Promise.allSettled(warmUpPromises);
    logger.log('Read replica warm-up completed');
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
    logger.log('All read replica connections closed');
  }

  /**
   * Initialize edge connection warming with intelligent scheduling
   */
  private async initializeEdgeWarming(): Promise<void> {
    // Delay initial warm-up to allow for application startup
    setTimeout(() => {
      this.warmEdgeConnectionsEnhanced();
    }, DELAY_CONSTANTS.EXTENDED);

    // Schedule periodic warming with adaptive intervals
    this.scheduleAdaptiveWarming();
    
    // Schedule predictive warming based on usage patterns
    this.schedulePredictiveWarming();
  }

  /**
   * Schedule adaptive warming based on current performance metrics
   */
  private scheduleAdaptiveWarming(): void {
    const adaptiveInterval = this.calculateAdaptiveWarmingInterval();
    
    this.edgeWarmingTimer = window.setInterval(() => {
      this.warmEdgeConnectionsEnhanced();
      
      // Re-calculate interval for next cycle
      if (this.edgeWarmingTimer) {
        window.clearInterval(this.edgeWarmingTimer);
        this.timers.delete(this.edgeWarmingTimer);
        this.scheduleAdaptiveWarming();
      }
    }, adaptiveInterval);
    this.timers.add(this.edgeWarmingTimer);
  }

  /**
   * Calculate adaptive warming interval based on performance
   */
  private calculateAdaptiveWarmingInterval(): number {
    const stats = this.getStats();
    const coldStartRate = this.calculateColdStartRate();
    
    // More frequent warming if high cold start rate
    if (coldStartRate > 0.3) {
      return 2 * TIME_CONSTANTS.MINUTE; // 2 minutes
    } else if (coldStartRate > 0.1) {
      return 3 * TIME_CONSTANTS.MINUTE; // 3 minutes
    } else if (stats.hitRate < 0.8) {
      return 4 * TIME_CONSTANTS.MINUTE; // 4 minutes
    } else {
      return TIME_CONSTANTS.CACHE_DEFAULT_TTL; // 5 minutes (default)
    }
  }

  /**
   * Schedule predictive warming based on time and usage patterns
   */
  private schedulePredictiveWarming(): void {
    // Schedule predictive warming every 15 minutes
    const predictiveTimer = window.setInterval(() => {
      this.predictiveWarming();
    }, 15 * TIME_CONSTANTS.MINUTE);
    this.timers.add(predictiveTimer);
    
    // Schedule time-based warming for business hours
    this.scheduleBusinessHoursWarming();
  }

  /**
   * Schedule warming during business hours
   */
  private scheduleBusinessHoursWarming(): void {
    const checkAndWarm = () => {
      const currentHour = new Date().getHours();
      const currentDay = new Date().getDay();
      
      // Business hours: Monday-Friday, 9 AM - 6 PM
      const isBusinessHours = currentDay >= 1 && currentDay <= 5 && currentHour >= 9 && currentHour < 18;
      
      if (isBusinessHours) {
        // More aggressive warming during business hours
        this.warmEdgeConnectionsEnhanced();
      }
    };
    
    // Check every 30 minutes during business hours
    const businessHoursTimer = window.setInterval(checkAndWarm, 30 * TIME_CONSTANTS.MINUTE);
    this.timers.add(businessHoursTimer);
  }

  /**
   * Enhanced edge warming with intelligent pre-warming strategies
   */
  async warmEdgeConnectionsEnhanced(): Promise<void> {
    if (!this.config.connectionWarming) {
      return;
    }

    const startTime = performance.now();
    logger.log('Starting enhanced edge connection warm-up...');

    // Get current region for optimization
    const currentRegion = process.env['VERCEL_REGION'] || 'unknown';
    
    // Priority-based warming: current region first, then high-traffic regions
    const priorityRegions = [currentRegion, 'hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'];
    const remainingRegions = this.edgeRegions.filter(r => !priorityRegions.includes(r));

    const warmupPromises: Promise<void>[] = [];

    // Phase 1: Warm current region immediately (parallel)
    for (const region of priorityRegions.slice(0, 3)) {
      warmupPromises.push(this.warmRegionConnectionEnhanced(region, 'high'));
    }

    // Phase 2: Warm other regions (parallel with delay)
    setTimeout(() => {
      for (const region of priorityRegions.slice(3)) {
        warmupPromises.push(this.warmRegionConnectionEnhanced(region, 'medium'));
      }
    }, DELAY_CONSTANTS.MEDIUM);

    // Phase 3: Warm remaining regions (lower priority)
    setTimeout(() => {
      for (const region of remainingRegions) {
        warmupPromises.push(this.warmRegionConnectionEnhanced(region, 'low'));
      }
    }, DELAY_CONSTANTS.LONG);

    // Phase 4: Warm read replicas
    setTimeout(() => {
      warmupPromises.push(this.warmUpReadReplicasEnhanced());
    }, 1500); // 1.5s - specific timing for replica warmup

    try {
      await Promise.allSettled(warmupPromises);
      const duration = performance.now() - startTime;
      logger.log(`Enhanced edge connection warm-up completed in ${duration.toFixed(2)}ms`);
    } catch (error: unknown) {
      logger.warn('Enhanced edge connection warm-up failed:', getErrorMessage(error));
    }
  }

  /**
   * Enhanced region warming with priority and retry logic
   */
  private async warmRegionConnectionEnhanced(region: string, priority: 'high' | 'medium' | 'low'): Promise<void> {
    try {
      // Check if we already have a healthy connection for this region
      const existingConnection = Array.from(this.connections.values())
        .find(conn => conn.region === region && conn.healthy && !conn.inUse);

      if (existingConnection) {
        logger.debug(`Region ${region} already has a warm connection (${priority} priority)`);
        return;
      }

      // Create connection based on priority using modular constants
      const maxRetries = priority === 'high' ? RETRY_CONFIG.MAX_ATTEMPTS : priority === 'medium' ? 2 : 1;
      const timeout = priority === 'high' ? TIMEOUTS.QUICK : priority === 'medium' ? TIMEOUTS.STANDARD : TIMEOUTS.EXTENDED;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Check connection pool capacity
          if (this.stats.totalConnections >= this.config.maxConnections) {
            // For high priority, try to drain an idle connection
            if (priority === 'high') {
              await this.drainOneIdleConnection();
            } else {
              logger.debug(`Skipping warm-up for ${region} - connection pool at capacity (${priority} priority)`);
              return;
            }
          }

          const connection = await this.createConnectionWithTimeout(region, timeout);
          
          // Perform enhanced warm-up queries
          await this.performEnhancedWarmupQueries(connection.client, region);

          logger.debug(`Enhanced warm-up completed for region: ${region} (${priority} priority, attempt ${attempt})`);
          return; // Success, exit retry loop

        } catch (error: unknown) {
          if (attempt === maxRetries) {
            logger.warn(`Failed to warm up connection for region ${region} after ${maxRetries} attempts (${priority} priority):`, getErrorMessage(error));
          } else {
            logger.debug(`Warm-up attempt ${attempt} failed for region ${region} (${priority} priority), retrying...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.BASE_DELAY_MS * attempt)); // Exponential backoff
          }
        }
      }
    } catch (error: unknown) {
      logger.warn(`Enhanced warm-up failed for region ${region}:`, getErrorMessage(error));
    }
  }

  /**
   * Create connection with timeout
   */
  private async createConnectionWithTimeout(region: string, timeout: number): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Connection creation timeout for region ${region}`));
      }, timeout);

      this.createConnection(region)
        .then(connection => {
          clearTimeout(timer);
          resolve(connection);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Perform enhanced warm-up queries
   */
  private async performEnhancedWarmupQueries(client: SupabaseClient, region: string): Promise<void> {
    try {
      const startTime = performance.now();

      // Query 1: Basic connectivity test
      await client
        .from('robots')
        .select('count', { count: 'exact', head: true })
        .limit(1);

      // Query 2: Auth session test (lightweight)
      try {
        await client.auth.getSession();
      } catch (authError) {
        // Auth errors are not critical for warm-up
        logger.debug(`Auth warm-up failed for region ${region}:`, authError);
      }

      // Query 3: Index warm-up (if robots table exists)
      try {
        await client
          .from('robots')
          .select('id, created_at')
          .order('created_at', { ascending: false })
          .limit(1);
      } catch (indexError) {
        logger.debug(`Index warm-up failed for region ${region}:`, indexError);
      }

      const duration = performance.now() - startTime;
      logger.debug(`Enhanced warm-up queries completed for region ${region} in ${duration.toFixed(2)}ms`);

    } catch (error: unknown) {
      logger.debug(`Enhanced warm-up queries failed for region ${region}:`, getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Enhanced read replica warming
   */
  private async warmUpReadReplicasEnhanced(): Promise<void> {
    const regions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1'];
    const warmUpPromises = regions.map(async (region, index) => {
      // Stagger the requests to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, index * DELAY_CONSTANTS.SHORT));
      
      try {
        const readClient = await this.acquireReadReplica(region);
        if (readClient) {
          // Perform warm-up query on read replica
          await readClient.from('robots').select('count', { count: 'exact', head: true }).limit(1);
          logger.debug(`Enhanced read replica warm-up completed for region: ${region}`);
        }
      } catch (error: unknown) {
        logger.warn(`Enhanced read replica warm-up failed for region ${region}:`, getErrorMessage(error));
      }
    });

    await Promise.allSettled(warmUpPromises);
    logger.log('Enhanced read replica warm-up completed');
  }

  /**
   * Drain one idle connection to make room for high-priority connections
   */
  private async drainOneIdleConnection(): Promise<void> {
    const idleConnections = Array.from(this.connections.values())
      .filter(conn => !conn.inUse && conn.healthy)
      .sort((a, b) => a.lastUsed - b.lastUsed); // Oldest first

    if (idleConnections.length > 0) {
      const connectionToDrain = idleConnections[0];
      if (connectionToDrain) {
        await this.closeConnection(connectionToDrain.id);
        logger.debug(`Drained idle connection ${connectionToDrain.id} for high-priority warm-up`);
      }
    }
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

    logger.log('Starting edge connection warm-up...');

    // Warm up primary connections for each region
    for (const region of this.edgeRegions) {
      warmupPromises.push(this.warmRegionConnection(region));
    }

    // Warm up read replicas
    warmupPromises.push(this.warmUpReadReplicas());

    try {
      await Promise.allSettled(warmupPromises);
      const duration = performance.now() - startTime;
      logger.log(`Edge connection warm-up completed in ${duration.toFixed(2)}ms`);
    } catch (error: unknown) {
      logger.warn('Edge connection warm-up failed:', getErrorMessage(error));
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
        logger.debug(`Region ${region} already has a warm connection`);
        return;
      }

      // Create a new connection for region if under limit
      if (this.stats.totalConnections < this.config.maxConnections) {
        const connection = await this.createConnection(region);

        // Perform a warm-up query
        await this.performWarmupQuery(connection.client);

        logger.debug(`Warmed up connection for region: ${region}`);
      } else {
        logger.debug(`Skipping warm-up for ${region} - connection pool at capacity`);
      }
    } catch (error: unknown) {
      logger.warn(`Failed to warm up connection for region ${region}:`, getErrorMessage(error));
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
    } catch (error: unknown) {
      // Don't throw error for warm-up failures, just log
      logger.debug('Warm-up query failed:', getErrorMessage(error));
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
      lastWarmup: this.edgeWarmingTimer ? Date.now() - TIME_CONSTANTS.CACHE_DEFAULT_TTL : undefined,
      nextWarmup: this.edgeWarmingTimer ? Date.now() + TIME_CONSTANTS.CACHE_DEFAULT_TTL : undefined
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
    logger.log('Forcing immediate edge connection warming...');
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
      connectionWarming: true,
      enableConnectionDraining: true,
      regionAffinity: true
    });

    logger.log('Connection pool optimized for edge deployment');
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
    const coldStarts = this.acquireTimes.filter(time => time > DELAY_CONSTANTS.NORMAL).length;
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
      if (!connection.healthy || (now - connection.lastUsed) > 30 * TIME_CONSTANTS.SECOND) {
        connectionsToRemove.push(id);
      }
    }

    connectionsToRemove.forEach(id => {
      this.connections.delete(id);
      logger.debug(`Edge cleanup: removed connection ${id}`);
    });

    if (connectionsToRemove.length > 0) {
      this.updateStats();
    }
  }

  /**
   * Enhanced connection draining for edge optimization with predictive analysis
   */
  async drainConnections(): Promise<void> {
    if (!this.config.enableConnectionDraining) {
      return;
    }

    const now = Date.now();
    const usagePatterns = this.analyzeUsagePatterns();
    
    // Enhanced draining logic with predictive analysis
    const connectionsToDrain = Array.from(this.connections.values())
      .filter(conn => {
        // Always drain unhealthy connections
        if (!conn.healthy) return true;
        
        // Drain connections idle beyond timeout
        if (now - conn.lastUsed > this.config.idleTimeout) return true;
        
        // Predictive draining: drain low-priority region connections during peak hours
        if (conn.region && usagePatterns.lowPriorityRegions.includes(conn.region)) {
          return now - conn.lastUsed > this.config.idleTimeout * 0.5; // 50% of normal timeout
        }
        
        return false;
      });
    
    const drainPromises = connectionsToDrain.map(async (conn) => {
      try {
        await this.gracefulShutdownConnection(conn);
        logger.debug(`Drained connection ${conn.id} (healthy: ${conn.healthy}, region: ${conn.region})`);
      } catch (error: unknown) {
        logger.warn(`Failed to drain connection ${conn.id}:`, getErrorMessage(error));
      }
    });

    await Promise.allSettled(drainPromises);
    
    // Also drain read replicas if they're idle
    await this.drainReadReplicas();
  }

  /**
   * Analyze usage patterns for predictive optimization
   */
  private analyzeUsagePatterns(): {
    topRegions: string[];
    lowPriorityRegions: string[];
    peakHours: boolean;
    avgUsage: number;
  } {
    const connections = Array.from(this.connections.values());
    const regionUsage: Record<string, number> = {};
    
    // Analyze region usage
    connections.forEach(conn => {
      if (conn.region) {
        regionUsage[conn.region] = (regionUsage[conn.region] || 0) + 1;
      }
    });
    
    // Sort regions by usage
    const sortedRegions = Object.entries(regionUsage)
      .sort(([, a], [, b]) => b - a)
      .map(([region]) => region);
    
    // Determine peak hours (simplified - in real implementation, use time-based analysis)
    const currentHour = new Date().getHours();
    const peakHours = currentHour >= 9 && currentHour <= 17; // Business hours
    
    const avgUsage = connections.length > 0 ? 
      connections.reduce((sum, conn) => sum + (conn.inUse ? 1 : 0), 0) / connections.length : 0;
    
    return {
      topRegions: sortedRegions.slice(0, 3),
      lowPriorityRegions: sortedRegions.slice(-2),
      peakHours,
      avgUsage
    };
  }

  /**
   * Graceful shutdown with retry logic
   */
  private async gracefulShutdownConnection(connection: Connection): Promise<void> {
    const maxWaitTime = TIMEOUTS.STANDARD; // 5 seconds max wait
    const startTime = Date.now();
    
    // Wait for connection to become idle
    while (connection.inUse && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, STAGGER.DEFAULT_DELAY_MS));
    }
    
    // Force close if still in use after timeout
    if (connection.inUse) {
      logger.warn(`Force closing connection ${connection.id} - still in use after timeout`);
    }
    
    await this.closeConnection(connection.id);
  }

  /**
   * Predictive connection warming based on usage patterns
   */
  async predictiveWarming(): Promise<void> {
    const usagePatterns = this.analyzeUsagePatterns();
    const predictedRegions = usagePatterns.topRegions.slice(0, 3);

    logger.log('Starting predictive connection warming for regions:', predictedRegions);

    const warmupPromises = predictedRegions.map(async (region, index) => {
      // Stagger warmups to prevent overwhelming system
      await new Promise(resolve => setTimeout(resolve, index * DELAY_CONSTANTS.NORMAL));

      try {
        await this.warmRegionConnectionEnhanced(region, 'high');
        logger.debug(`Predictive warm-up completed for region: ${region}`);
      } catch (error: unknown) {
        logger.warn(`Predictive warm-up failed for region ${region}:`, getErrorMessage(error));
      }
    });

    await Promise.allSettled(warmupPromises);
    logger.log('Predictive connection warming completed');
  }

  /**
    * Close a specific connection gracefully
    */
  private async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      // Wait for any in-use operations to complete (with timeout)
      let attempts = 0;
      const maxAttempts = 10;
      
      while (connection.inUse && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, STAGGER.DEFAULT_DELAY_MS));
        attempts++;
      }

      // Remove from pool
      this.connections.delete(connectionId);
      this.updateStats();

      logger.debug(`Successfully closed connection ${connectionId}`);
    } catch (error: unknown) {
      logger.error(`Error closing connection ${connectionId}:`, getErrorMessage(error));
      // Force remove even if error occurs
      this.connections.delete(connectionId);
      this.updateStats();
    }
  }

  /**
   * Drain idle read replica connections
   */
  private async drainReadReplicas(): Promise<void> {
    // Simple heuristic - remove replicas randomly to prevent memory leaks
    // In a real implementation, you'd track last used time
    for (const [key] of this.readReplicaClients.entries()) {
      if (Math.random() < 0.1) { // 10% chance to clean up each run
        this.readReplicaClients.delete(key);
        logger.debug(`Drained read replica connection for ${key}`);
      }
    }
  }

  /**
   * Get connection pool health metrics for monitoring
   */
  getHealthMetrics(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    connections: {
      total: number;
      healthy: number;
      unhealthy: number;
      draining: number;
    };
    readReplicas: {
      total: number;
      active: number;
    };
    performance: {
      avgAcquireTime: number;
      hitRate: number;
      coldStartRate: number;
    };
  } {
    const connections = Array.from(this.connections.values());
    const healthy = connections.filter(c => c.healthy).length;
    const unhealthy = connections.filter(c => !c.healthy).length;
    const draining = connections.filter(c => !c.healthy && Date.now() - c.lastUsed > this.config.idleTimeout).length;
    
    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthy > 0) {
      overall = unhealthy > this.connections.size * 0.5 ? 'unhealthy' : 'degraded';
    }

    return {
      overall,
      connections: {
        total: connections.length,
        healthy,
        unhealthy,
        draining
      },
      readReplicas: {
        total: this.readReplicaClients.size,
        active: this.readReplicaClients.size // All stored replicas are considered active
      },
      performance: {
        avgAcquireTime: this.stats.avgAcquireTime,
        hitRate: this.stats.hitRate,
        coldStartRate: this.calculateColdStartRate()
      }
    };
  }

  /**
   * Destroy the connection pool and cleanup all resources
   * Fixes Issue #600: Database Connection Pool Resource Leak Risk
   */
  destroy(): void {
    // Clear all tracked timers
    this.timers.forEach(timer => {
      clearInterval(timer);
      clearTimeout(timer);
    });
    this.timers.clear();

    // Clear individual timer references
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.edgeWarmingTimer) {
      clearInterval(this.edgeWarmingTimer);
      this.edgeWarmingTimer = null;
    }

    // Clear connections
    this.connections.clear();
    this.readReplicaClients.clear();
    this.waitingQueue = [];
    this.acquireTimes = [];

    // Reset stats
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      unhealthyConnections: 0,
      waitingRequests: 0,
      avgAcquireTime: 0,
      hitRate: 0
    };

    logger.log('Connection pool destroyed and all resources cleaned up');
  }
}

export const enhancedConnectionPool = EnhancedSupabaseConnectionPool.getInstance();