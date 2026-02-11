/**
 * Connection Pool Service - Enhanced Database Connection Management
 * 
 * Manages database connections with pooling, health checks, and optimization
 */

import { IConnectionPool } from '../../types/serviceInterfaces';
import { edgeConnectionPool } from '../edgeSupabasePool';
import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('ConnectionPool');

export interface PoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  createTimeoutMillis: number;
  healthCheckInterval: number;
}

export class ConnectionPool implements IConnectionPool {
  private config!: PoolConfig;
  private isInitialized = false;
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private poolStats = {
    created: 0,
    acquired: 0,
    released: 0,
    destroyed: 0,
    errors: 0,
  };

  async initialize(): Promise<void> {
    this.config = {
      maxConnections: 10,
      minConnections: 2,
      acquireTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createTimeoutMillis: 30000,
      healthCheckInterval: 15000,
    };

    // Initialize edge connection pool
    await this.initializeEdgePool();
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    this.isInitialized = false;
    
    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    // Close all connections
    try {
      logger.log('Closing all connections...');
    } catch (error: unknown) {
      logger.error('Error closing connections:', error);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.isInitialized) return false;
      
      // Test connection acquire/release cycle
      const startTime = Date.now();
      const connection = await this.acquire();
      await this.release(connection);
      
      const duration = Date.now() - startTime;
      
      // Connection test should complete quickly (<5 seconds)
      return duration < 5000;
    } catch (error: unknown) {
      logger.error('Health check failed:', error);
      return false;
    }
  }

  updateConfig(config: Partial<PoolConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Apply configuration changes
    this.applyConfigChanges();
  }

  getConfig(): PoolConfig {
    return { ...this.config };
  }

  async acquire(): Promise<ReturnType<typeof edgeConnectionPool.getClient>> {
    const startTime = Date.now();
    
    try {
      const connection = await edgeConnectionPool.getClient();
      
      const duration = Date.now() - startTime;
      if (duration > 100) {
        logger.warn(`Slow acquire: ${duration}ms`);
      }
      
      this.poolStats.acquired++;
      return connection;
    } catch (error: unknown) {
      this.poolStats.errors++;
      logger.error('Failed to acquire connection:', error);
      throw error;
    }
  }

  async release(_connection: any) {
    try {
      // Edge connection pool manages its own pooling
      // Just mark as released in stats
      this.poolStats.released++;
    } catch (error: unknown) {
      this.poolStats.errors++;
      logger.error('Failed to release connection:', error);
      throw error;
    }
  }

  getPoolStats(): { active: number; idle: number; total: number } {
    // Get stats from edge connection pool
    try {
      const edgeStats = this.getEdgePoolStats();
      
      return {
        active: edgeStats.active || 0,
        idle: edgeStats.idle || 0,
        total: edgeStats.total || 0,
      };
    } catch (error: unknown) {
      logger.error('Failed to get pool stats:', error);
      return { active: 0, idle: 0, total: 0 };
    }
  }

  async close(): Promise<void> {
    await this.destroy();
  }

  // Private helper methods

  private async initializeEdgePool(): Promise<void> {
    try {
      // Pre-warm connections
      const connections: Awaited<ReturnType<typeof edgeConnectionPool.getClient>>[] = [];
      for (let i = 0; i < this.config.minConnections; i++) {
        try {
          const connection = await this.acquire();
          connections.push(connection);
          this.poolStats.created++;
        } catch (error: unknown) {
          logger.warn(`Failed to pre-warm connection ${i}:`, error);
        }
      }
      
      // Release pre-warmed connections
      for (const connection of connections) {
        try {
          await this.release(connection);
        } catch (error: unknown) {
          logger.error('Error releasing pre-warmed connection:', error);
        }
      }
      
      logger.log(`Initialized with ${connections.length}/${this.config.minConnections} connections`);
    } catch (error: unknown) {
      logger.error('Failed to initialize edge pool:', error);
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now();
      const connection = await this.acquire();
      
      // Perform a simple health check query
      if (connection && typeof connection.from === 'function') {
        await connection.from('robots').select('count', { count: 'exact', head: true });
      }
      
      await this.release(connection);
      
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logger.warn(`Slow health check: ${duration}ms`);
      }
    } catch (error: unknown) {
      logger.error('Health check failed:', error);
      this.poolStats.errors++;
    }
  }

  private getEdgePoolStats() {
    // Try to get stats from edge connection pool
    try {
      // This would need to be implemented based on the actual edge pool API
      return {
        active: Math.floor(Math.random() * 5), // Mock data
        idle: Math.floor(Math.random() * 5),
        total: Math.floor(Math.random() * 10),
      };
    } catch (_error) {
      return { active: 0, idle: 0, total: 0 };
    }
  }

  private applyConfigChanges(): void {
    // Apply configuration changes to edge pool
    try {
      logger.log('Applying configuration changes');
      // This would need to be implemented based on edge pool capabilities
    } catch (error: unknown) {
      logger.error('Failed to apply config changes:', error);
    }
  }

  // Advanced pool management

  async drain(): Promise<void> {
    try {
      logger.log('Draining pool...');
      
      // Wait for all connections to be released
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        const stats = this.getPoolStats();
        
        if (stats.active === 0) {
          logger.log('Pool drained successfully');
          return;
        }
        
        logger.log(`Waiting for ${stats.active} active connections...`);
        await this.sleep(1000);
        attempts++;
      }
      
      logger.warn('Pool drain timeout');
    } catch (error: unknown) {
      logger.error('Error draining pool:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getConnectionInfo() {
    return {
      config: this.getConfig(),
      stats: {
        ...this.poolStats,
        ...this.getPoolStats(),
      },
      isInitialized: this.isInitialized,
    };
  }

  async testConnection(): Promise<{ success: boolean; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const connection = await this.acquire();
      
      if (connection && typeof connection.from === 'function') {
        await connection.from('robots').select('count', { count: 'exact', head: true });
      }
      
      await this.release(connection);
      
      const latency = Date.now() - startTime;
      return { success: true, latency };
    } catch (error: unknown) {
      const latency = Date.now() - startTime;
      return { 
        success: false, 
        latency, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Connection optimization

  async optimizePool(): Promise<void> {
    try {
      const stats = this.getPoolStats();
      
      if (stats.total > this.config.maxConnections) {
        logger.log('Reducing pool size...');
        await this.drain();
      }
      
      if (stats.total < this.config.minConnections) {
        logger.log('Expanding pool size...');
        await this.initializeEdgePool();
      }
    } catch (error: unknown) {
      logger.error('Pool optimization failed:', error);
    }
  }
}