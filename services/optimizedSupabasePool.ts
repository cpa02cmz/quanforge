/**
 * Optimized Supabase Connection Pool for Edge Deployment
 * Simplified and optimized for Vercel Edge Functions
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from './settingsManager';

interface OptimizedConnectionConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  healthCheckInterval: number;
  retryAttempts: number;
  retryDelay: number;
}

interface OptimizedConnection {
  id: string;
  client: SupabaseClient;
  created: number;
  lastUsed: number;
  inUse: boolean;
  healthy: boolean;
  region?: string;
}

class OptimizedSupabasePool {
  private static instance: OptimizedSupabasePool;
  private connections: Map<string, OptimizedConnection> = new Map();
  private config: OptimizedConnectionConfig = {
    maxConnections: 4, // Optimized for edge
    minConnections: 1, // Reduced for edge efficiency
    acquireTimeout: 1000, // Fast timeout for edge
    idleTimeout: 180000, // 3 minutes
    healthCheckInterval: 30000, // 30 seconds
    retryAttempts: 2,
    retryDelay: 500
  };
  private healthCheckTimer: number | null = null;
  private cleanupTimer: number | null = null;

  private constructor() {
    this.initializePool();
    this.startHealthChecks();
    this.startCleanup();
  }

  static getInstance(): OptimizedSupabasePool {
    if (!OptimizedSupabasePool.instance) {
      OptimizedSupabasePool.instance = new OptimizedSupabasePool();
    }
    return OptimizedSupabasePool.instance;
  }

  private async initializePool(): Promise<void> {
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode !== 'supabase' || !settings.url || !settings.anonKey) {
      return;
    }

    // Create minimum connections
    try {
      for (let i = 0; i < this.config.minConnections; i++) {
        await this.createConnection();
      }
      console.log(`Optimized connection pool initialized with ${this.config.minConnections} connections`);
    } catch (error) {
      console.error('Failed to initialize optimized connection pool:', error);
    }
  }

  private async createConnection(region?: string): Promise<OptimizedConnection> {
    const settings = settingsManager.getDBSettings();
    
    if (!settings.url || !settings.anonKey) {
      throw new Error('Supabase configuration missing');
    }

    const id = this.generateConnectionId();
    const preferredRegion = region || process.env['VERCEL_REGION'] || 'default';
    
    // Optimized connection configuration for edge
    const client = new SupabaseClient(settings.url, settings.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'X-Connection-ID': id,
          'X-Connection-Region': preferredRegion,
          'X-Edge-Optimized': 'true',
          'X-Client-Info': 'quanforge-edge/2.0.0'
        }
      }
    });

    const connection: OptimizedConnection = {
      id,
      client,
      created: Date.now(),
      lastUsed: Date.now(),
      inUse: false,
      healthy: true,
      ...(region && { region })
    };

    this.connections.set(id, connection);
    return connection;
  }

  async acquire(region?: string): Promise<SupabaseClient> {
    const startTime = performance.now();
    const preferredRegion = region || process.env['VERCEL_REGION'] || 'default';

    // Try to find an available connection
    let connection = this.getAvailableConnection(preferredRegion);

    if (!connection) {
      // Try to create a new connection if under limit
      if (this.connections.size < this.config.maxConnections) {
        try {
          connection = await this.createConnection(preferredRegion);
        } catch (error) {
          console.warn('Failed to create new connection:', error);
        }
      }
    }

    if (!connection) {
      throw new Error(`Unable to acquire database connection for region: ${preferredRegion}`);
    }

    // Mark connection as in use
    connection.inUse = true;
    connection.lastUsed = Date.now();

    const acquireTime = performance.now() - startTime;
    
    // Log slow acquisitions
    if (acquireTime > 500) {
      console.warn(`Slow connection acquisition: ${acquireTime.toFixed(2)}ms for region ${preferredRegion}`);
    }

    return connection.client;
  }

  private getAvailableConnection(region?: string): OptimizedConnection | null {
    const candidates = Array.from(this.connections.values())
      .filter(conn => !conn.inUse && conn.healthy);

    if (candidates.length === 0) {
      return null;
    }

    // Prefer connections from the same region
    if (region) {
      const regionalConnection = candidates.find(conn => conn.region === region);
      if (regionalConnection) {
        return regionalConnection;
      }
    }

    // Return the least recently used connection
    return candidates.reduce((oldest, current) => 
      current.lastUsed < oldest.lastUsed ? current : oldest
    );
  }

  release(client: SupabaseClient): void {
    const connection = Array.from(this.connections.values())
      .find(conn => conn.client === client);

    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
    }
  }

  private async healthCheck(connection: OptimizedConnection): Promise<boolean> {
    try {
      const startTime = performance.now();
      
      // Simple health check
      const { error } = await connection.client
        .from('robots')
        .select('id')
        .limit(1)
        .single();

      if (error) {
        connection.healthy = false;
        return false;
      }

      const responseTime = performance.now() - startTime;
      if (responseTime > 1000) {
        console.warn(`Connection ${connection.id} slow response: ${responseTime.toFixed(2)}ms`);
        connection.healthy = false;
        return false;
      }

      connection.healthy = true;
      connection.lastUsed = Date.now();
      return true;
    } catch (error) {
      connection.healthy = false;
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
          }
        });

      await Promise.allSettled(healthCheckPromises);
    }, this.config.healthCheckInterval);
  }

  private startCleanup(): void {
    this.cleanupTimer = window.setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Run cleanup every minute
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [id, connection] of this.connections) {
      // Don't remove if in use or below minimum
      if (connection.inUse || this.connections.size <= this.config.minConnections) {
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
  }

  private generateConnectionId(): string {
    return `opt_conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    const connections = Array.from(this.connections.values());
    
    return {
      totalConnections: connections.length,
      activeConnections: connections.filter(c => c.inUse).length,
      idleConnections: connections.filter(c => !c.inUse && c.healthy).length,
      unhealthyConnections: connections.filter(c => !c.healthy).length,
      config: { ...this.config }
    };
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

    this.connections.clear();
    console.log('Optimized connection pool closed');
  }

  // Optimize for edge deployment
  optimizeForEdge(): void {
    this.updateConfig({
      maxConnections: 4,
      minConnections: 1,
      acquireTimeout: 1000,
      idleTimeout: 180000,
      healthCheckInterval: 30000
    });
  }

  updateConfig(newConfig: Partial<OptimizedConnectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Optimized connection pool configuration updated:', this.config);
  }
}

export const optimizedSupabasePool = OptimizedSupabasePool.getInstance();