import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from './settingsManager';

interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeout: number;
  healthCheckInterval: number;
  connectionTimeout: number;
  acquireTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface ConnectionHealth {
  isHealthy: boolean;
  lastCheck: number;
  responseTime: number;
  errorCount: number;
}

class SupabaseConnectionPool {
  private static instance: SupabaseConnectionPool;
  private clients: Map<string, SupabaseClient> = new Map();
  private healthStatus: Map<string, ConnectionHealth> = new Map();
  private config: ConnectionPoolConfig = {
    minConnections: 1, // Reduce for edge
    maxConnections: 5, // Lower for edge memory constraints
    idleTimeout: 120000, // 2 minutes (reduced)
    healthCheckInterval: 15000, // 15 seconds (more frequent)
    connectionTimeout: 5000, // 5 seconds (faster failover)
    acquireTimeout: 2000, // 2 seconds
    retryAttempts: 2, // Reduce retries for edge
    retryDelay: 500, // Faster retry
  };
  private healthCheckTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startHealthChecks();
  }

  static getInstance(): SupabaseConnectionPool {
    if (!SupabaseConnectionPool.instance) {
      SupabaseConnectionPool.instance = new SupabaseConnectionPool();
    }
    return SupabaseConnectionPool.instance;
  }

  async getClient(connectionId: string = 'default'): Promise<SupabaseClient> {
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode !== 'supabase' || !settings.url || !settings.anonKey) {
      throw new Error('Supabase not configured');
    }

    // Check if we have a healthy existing connection
    const existingClient = this.clients.get(connectionId);
    const health = this.healthStatus.get(connectionId);
    
    if (existingClient && health?.isHealthy) {
      return existingClient;
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
    
    if (isHealthy) {
      this.clients.set(connectionId, client);
      this.healthStatus.set(connectionId, {
        isHealthy: true,
        lastCheck: Date.now(),
        responseTime: 0,
        errorCount: 0,
      });
      return client;
    } else {
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
        };

        this.healthStatus.set(connectionId, {
          isHealthy,
          lastCheck: Date.now(),
          responseTime,
          errorCount: isHealthy ? 0 : currentHealth.errorCount + 1,
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
  }

  // Add connection warming for edge regions
  async warmEdgeConnections(): Promise<void> {
    const regions = ['hkg1', 'iad1', 'sin1'];
    await Promise.allSettled(
      regions.map(region => this.getClient(`edge_${region}`))
    );
  }

  // Edge-optimized connection acquisition
  async getEdgeClient(connectionId: string = 'default', region?: string): Promise<SupabaseClient> {
    const edgeConnectionId = region ? `edge_${region}_${connectionId}` : connectionId;
    
    // Check if we have a healthy existing connection
    const existingClient = this.clients.get(edgeConnectionId);
    const health = this.healthStatus.get(edgeConnectionId);
    
    if (existingClient && health?.isHealthy && (Date.now() - health.lastCheck) < 60000) {
      return existingClient;
    }

    return this.getClient(edgeConnectionId);
  }

  // Get connection metrics for monitoring
  getConnectionMetrics(): {
    totalConnections: number;
    healthyConnections: number;
    averageResponseTime: number;
    totalErrors: number;
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
    };
  }
}

export const connectionPool = SupabaseConnectionPool.getInstance();