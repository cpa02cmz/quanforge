import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from './settingsManager';

interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  idleTimeout: number;
  healthCheckInterval: number;
  connectionTimeout: number;
  adaptiveSizing: boolean;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  maxScaleUpConnections: number;
}

interface ConnectionHealth {
  isHealthy: boolean;
  lastCheck: number;
  responseTime: number;
  errorCount: number;
  requestCount: number;
  lastUsed: number;
}

interface LoadMetrics {
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  concurrentConnections: number;
}

class SupabaseConnectionPool {
  private static instance: SupabaseConnectionPool;
  private clients: Map<string, SupabaseClient> = new Map();
  private healthStatus: Map<string, ConnectionHealth> = new Map();
  private config: ConnectionPoolConfig = {
    maxConnections: 10,
    minConnections: 2,
    idleTimeout: 300000, // 5 minutes
    healthCheckInterval: 30000, // 30 seconds
    connectionTimeout: 10000, // 10 seconds
    adaptiveSizing: true,
    scaleUpThreshold: 0.7, // Scale up when 70% of connections are busy
    scaleDownThreshold: 0.3, // Scale down when 30% of connections are busy
    maxScaleUpConnections: 5,
  };
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private adaptiveSizingTimer: NodeJS.Timeout | null = null;
  private requestMetrics: Array<{ timestamp: number; responseTime: number; success: boolean }> = [];
  private loadMetrics: LoadMetrics = {
    requestsPerSecond: 0,
    averageResponseTime: 0,
    errorRate: 0,
    concurrentConnections: 0,
  };

  private constructor() {
    this.startHealthChecks();
    if (this.config.adaptiveSizing) {
      this.startAdaptiveSizing();
    }
  }

  static getInstance(): SupabaseConnectionPool {
    if (!SupabaseConnectionPool.instance) {
      SupabaseConnectionPool.instance = new SupabaseConnectionPool();
    }
    return SupabaseConnectionPool.instance;
  }

  async getClient(connectionId: string = 'default'): Promise<SupabaseClient> {
    const startTime = Date.now();
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode !== 'supabase' || !settings.url || !settings.anonKey) {
      throw new Error('Supabase not configured');
    }

    // Check if we have a healthy existing connection
    const existingClient = this.clients.get(connectionId);
    const health = this.healthStatus.get(connectionId);
    
    if (existingClient && health?.isHealthy) {
      // Update usage metrics
      this.updateConnectionUsage(connectionId, true);
      return existingClient;
    }

    // Check if we need to scale up connections
    if (this.config.adaptiveSizing && this.shouldScaleUp()) {
      await this.scaleUpConnections();
    }

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
          'x-application-name': 'quanforge-ai',
          'x-connection-id': connectionId,
        },
      },
      // Add connection timeout
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });

    // Test connection
    const isHealthy = await this.testConnection(client);
    const responseTime = Date.now() - startTime;
    
    if (isHealthy) {
      this.clients.set(connectionId, client);
      this.healthStatus.set(connectionId, {
        isHealthy: true,
        lastCheck: Date.now(),
        responseTime,
        errorCount: 0,
        requestCount: 1,
        lastUsed: Date.now(),
      });
      this.recordRequestMetric(responseTime, true);
      this.updateConnectionUsage(connectionId, true);
      return client;
    } else {
      this.recordRequestMetric(responseTime, false);
      throw new Error('Failed to establish healthy Supabase connection');
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

  private startAdaptiveSizing(): void {
    this.adaptiveSizingTimer = setInterval(async () => {
      await this.performAdaptiveSizing();
    }, 60000); // Check every minute
  }

  private updateConnectionUsage(connectionId: string, success: boolean): void {
    const health = this.healthStatus.get(connectionId);
    if (health) {
      health.requestCount++;
      health.lastUsed = Date.now();
      if (!success) {
        health.errorCount++;
      }
    }
  }

  private recordRequestMetric(responseTime: number, success: boolean): void {
    const now = Date.now();
    this.requestMetrics.push({
      timestamp: now,
      responseTime,
      success,
    });

    // Keep only last 5 minutes of metrics
    const fiveMinutesAgo = now - 300000;
    this.requestMetrics = this.requestMetrics.filter(m => m.timestamp > fiveMinutesAgo);

    // Update load metrics
    this.updateLoadMetrics();
  }

  private updateLoadMetrics(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentMetrics = this.requestMetrics.filter(m => m.timestamp > oneMinuteAgo);
    
    this.loadMetrics.requestsPerSecond = recentMetrics.length / 60;
    this.loadMetrics.averageResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length
      : 0;
    this.loadMetrics.errorRate = recentMetrics.length > 0
      ? recentMetrics.filter(m => !m.success).length / recentMetrics.length
      : 0;
    this.loadMetrics.concurrentConnections = this.clients.size;
  }

  private shouldScaleUp(): boolean {
    const utilizationRate = this.loadMetrics.concurrentConnections / this.config.maxConnections;
    const highErrorRate = this.loadMetrics.errorRate > 0.1; // 10% error rate
    const highResponseTime = this.loadMetrics.averageResponseTime > 1000; // 1 second
    
    return utilizationRate > this.config.scaleUpThreshold || highErrorRate || highResponseTime;
  }

  private shouldScaleDown(): boolean {
    const utilizationRate = this.loadMetrics.concurrentConnections / this.config.maxConnections;
    const lowErrorRate = this.loadMetrics.errorRate < 0.02; // 2% error rate
    const lowResponseTime = this.loadMetrics.averageResponseTime < 500; // 500ms
    const aboveMinConnections = this.clients.size > this.config.minConnections;
    
    return utilizationRate < this.config.scaleDownThreshold && lowErrorRate && lowResponseTime && aboveMinConnections;
  }

  private async scaleUpConnections(): Promise<void> {
    const currentConnections = this.clients.size;
    const maxNewConnections = Math.min(
      this.config.maxScaleUpConnections,
      this.config.maxConnections - currentConnections
    );

    if (maxNewConnections <= 0) return;

    console.log(`Scaling up connection pool: adding ${maxNewConnections} connections`);
    
    for (let i = 0; i < maxNewConnections; i++) {
      const connectionId = `adaptive_${Date.now()}_${i}`;
      try {
        await this.getClient(connectionId);
      } catch (error) {
        console.warn(`Failed to create adaptive connection ${connectionId}:`, error);
      }
    }
  }

  private async scaleDownConnections(): Promise<void> {
    const connectionsToRemove = Math.max(1, Math.floor(this.clients.size * 0.2)); // Remove 20%
    
    // Find least recently used connections
    const sortedConnections = Array.from(this.healthStatus.entries())
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed)
      .slice(0, connectionsToRemove);

    console.log(`Scaling down connection pool: removing ${connectionsToRemove} connections`);
    
    for (const [connectionId] of sortedConnections) {
      await this.closeConnection(connectionId);
    }
  }

  private async performAdaptiveSizing(): Promise<void> {
    if (!this.config.adaptiveSizing) return;

    try {
      if (this.shouldScaleUp()) {
        await this.scaleUpConnections();
      } else if (this.shouldScaleDown()) {
        await this.scaleDownConnections();
      }

      // Clean up idle connections
      await this.cleanupIdleConnections();
    } catch (error) {
      console.error('Adaptive sizing failed:', error);
    }
  }

  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const idleThreshold = this.config.idleTimeout;
    
    for (const [connectionId, health] of this.healthStatus) {
      if (now - health.lastUsed > idleThreshold && this.clients.size > this.config.minConnections) {
        console.log(`Removing idle connection: ${connectionId}`);
        await this.closeConnection(connectionId);
      }
    }
  }

  private async performHealthChecks(): Promise<void> {
    for (const [connectionId, client] of this.clients) {
      try {
        const startTime = Date.now();
        const isHealthy = await this.testConnection(client);
        const responseTime = Date.now() - startTime;
        
        const currentHealth = this.healthStatus.get(connectionId) || {
          isHealthy: false,
          lastCheck: 0,
          responseTime: 0,
          errorCount: 0,
          requestCount: 0,
          lastUsed: 0,
        };

        this.healthStatus.set(connectionId, {
          isHealthy,
          lastCheck: Date.now(),
          responseTime,
          errorCount: isHealthy ? 0 : currentHealth.errorCount + 1,
          requestCount: currentHealth.requestCount,
          lastUsed: currentHealth.lastUsed,
        });

        // Remove unhealthy connections after 3 failed checks
        if (!isHealthy && currentHealth.errorCount >= 2) {
          this.clients.delete(connectionId);
          this.healthStatus.delete(connectionId);
          console.warn(`Removed unhealthy connection: ${connectionId}`);
        }
      } catch (error) {
        console.error(`Health check failed for connection ${connectionId}:`, error);
      }
    }
  }

  getHealthStatus(): Map<string, ConnectionHealth> {
    return new Map(this.healthStatus);
  }

  async closeConnection(connectionId: string): Promise<void> {
    this.clients.delete(connectionId);
    this.healthStatus.delete(connectionId);
  }

  async closeAllConnections(): Promise<void> {
    this.clients.clear();
    this.healthStatus.clear();
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.adaptiveSizingTimer) {
      clearInterval(this.adaptiveSizingTimer);
      this.adaptiveSizingTimer = null;
    }
  }

  // Get connection metrics for monitoring
  getConnectionMetrics(): {
    totalConnections: number;
    healthyConnections: number;
    averageResponseTime: number;
    totalErrors: number;
    loadMetrics: LoadMetrics;
    config: ConnectionPoolConfig;
  } {
    const healthArray = Array.from(this.healthStatus.values());
    const healthyConnections = healthArray.filter(h => h.isHealthy).length;
    const averageResponseTime = healthArray.length > 0 
      ? healthArray.reduce((sum, h) => sum + h.responseTime, 0) / healthArray.length 
      : 0;
    const totalErrors = healthArray.reduce((sum, h) => sum + h.errorCount, 0);

    return {
      totalConnections: this.clients.size,
      healthyConnections,
      averageResponseTime,
      totalErrors,
      loadMetrics: { ...this.loadMetrics },
      config: { ...this.config },
    };
  }

  // Get adaptive sizing status
  getAdaptiveSizingStatus(): {
    enabled: boolean;
    currentLoad: LoadMetrics;
    shouldScaleUp: boolean;
    shouldScaleDown: boolean;
    lastScaleAction: string;
  } {
    return {
      enabled: this.config.adaptiveSizing,
      currentLoad: { ...this.loadMetrics },
      shouldScaleUp: this.shouldScaleUp(),
      shouldScaleDown: this.shouldScaleDown(),
      lastScaleAction: this.getLastScaleAction(),
    };
  }

  private getLastScaleAction(): string {
    // This would track the last scaling action in a real implementation
    return 'none';
  }

  // Update configuration
  updateConfig(newConfig: Partial<ConnectionPoolConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart adaptive sizing if enabled/disabled
    if (newConfig.adaptiveSizing !== undefined) {
      if (this.adaptiveSizingTimer) {
        clearInterval(this.adaptiveSizingTimer);
        this.adaptiveSizingTimer = null;
      }
      
      if (this.config.adaptiveSizing) {
        this.startAdaptiveSizing();
      }
    }
  }
}

export const connectionPool = SupabaseConnectionPool.getInstance();