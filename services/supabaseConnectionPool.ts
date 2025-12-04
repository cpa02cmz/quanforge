import { createDynamicSupabaseClient } from './dynamicSupabaseLoader';
import type { SupabaseClient } from '@supabase/supabase-js';
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

interface ReadReplicaConfig {
  url: string;
  anonKey: string;
  region: string;
  priority: number;
  isHealthy: boolean;
  lastUsed: number;
}

class SupabaseConnectionPool {
  private static instance: SupabaseConnectionPool;
  private clients: Map<string, SupabaseClient> = new Map();
  private readReplicas: Map<string, ReadReplicaConfig> = new Map();
  private healthStatus: Map<string, ConnectionHealth> = new Map();
  private config: ConnectionPoolConfig = {
    minConnections: 3, // Optimized for Vercel Edge
    maxConnections: 12, // Increased for better concurrency
    idleTimeout: 180000, // 3 minutes (optimized for serverless)
    healthCheckInterval: 8000, // 8 seconds (more frequent health checks)
    connectionTimeout: 2000, // 2 seconds (faster failover for edge)
    acquireTimeout: 1500, // 1.5 seconds (quicker acquisition)
    retryAttempts: 4, // More retries for edge reliability
    retryDelay: 500, // Faster retry for edge environments
  };
  private healthCheckTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeReadReplicas();
    this.startHealthChecks();
  }

  private initializeReadReplicas(): void {
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode === 'supabase' && settings.url && settings.anonKey) {
      // Initialize read replicas if configured
      const replicaConfigs = this.getReadReplicaConfigs();
      
      replicaConfigs.forEach((config, index) => {
        this.readReplicas.set(`replica_${index}`, {
          ...config,
          isHealthy: true,
          lastUsed: 0,
        });
      });
    }
  }

  private getReadReplicaConfigs(): ReadReplicaConfig[] {
    // Read replica configurations - these should be environment-specific
    const settings = settingsManager.getDBSettings();
    const baseConfig = {
      anonKey: settings.anonKey!,
    };

    // Example read replica configurations
    // In production, these would come from environment variables
    return [
      {
        ...baseConfig,
        url: settings.url!, // Primary can also serve as read replica
        region: 'primary',
        priority: 1,
        isHealthy: true,
        lastUsed: 0,
      },
      // Additional read replicas would be configured here
      // {
      //   ...baseConfig,
      //   url: process.env.VITE_SUPABASE_READ_REPLICA_URL_1 || settings.url!,
      //   region: 'replica-1',
      //   priority: 2,
      // },
      // {
      //   ...baseConfig,
      //   url: process.env.VITE_SUPABASE_READ_REPLICA_URL_2 || settings.url!,
      //   region: 'replica-2',
      //   priority: 3,
      // },
    ];
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
    const client = await createDynamicSupabaseClient(settings.url, settings.anonKey);

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

  // Get read client with automatic replica selection
  async getReadClient(connectionId: string = 'default'): Promise<SupabaseClient> {
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode !== 'supabase' || !settings.url || !settings.anonKey) {
      throw new Error('Supabase not configured');
    }

    // Get the best available read replica
    const replica = this.selectBestReadReplica();
    
    if (!replica) {
      // Fallback to primary client if no replicas available
      return this.getClient(`read_${connectionId}`);
    }

    const replicaConnectionId = `read_replica_${replica.region}_${connectionId}`;
    
    // Check if we have a healthy existing replica connection
    const existingClient = this.clients.get(replicaConnectionId);
    const health = this.healthStatus.get(replicaConnectionId);
    
    if (existingClient && health?.isHealthy) {
      replica.lastUsed = Date.now();
      return existingClient;
    }

    // Create new replica connection with edge optimizations
    const client = await createDynamicSupabaseClient(replica.url, replica.anonKey);

    // Test connection
    const isHealthy = await this.testConnection(client);
    
    if (isHealthy) {
      this.clients.set(replicaConnectionId, client);
      this.healthStatus.set(replicaConnectionId, {
        isHealthy: true,
        lastCheck: Date.now(),
        responseTime: 0,
        errorCount: 0,
      });
      replica.lastUsed = Date.now();
      return client;
    } else {
      // Mark replica as unhealthy and try next one
      replica.isHealthy = false;
      return this.getReadClient(connectionId); // Recursive call to try next replica
    }
  }

  private selectBestReadReplica(): ReadReplicaConfig | null {
    const healthyReplicas = Array.from(this.readReplicas.values())
      .filter(replica => replica.isHealthy)
      .map(replica => ({
        replica,
        score: this.calculateReplicaScore(replica)
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.replica);

    if (healthyReplicas.length === 0) {
      return null;
    }

    // Select highest scoring replica
    const selectedReplica = healthyReplicas[0];
    if (selectedReplica) {
      selectedReplica.lastUsed = Date.now();
    }
    
    return selectedReplica || null;
  }

  private calculateReplicaScore(replica: ReadReplicaConfig): number {
    let score = 0;
    
    // Geographic proximity scoring (increased priority for region match)
    const currentRegion = typeof window !== 'undefined' 
      ? 'client' 
      : (process.env as any)['VERCEL_REGION'] || 'unknown';
    
    if (replica.region === currentRegion) {
      score += 2000; // Increased priority for region match
    }
    
    // Latency-based scoring
    const regionLatency = this.getRegionLatency(replica.region);
    score += Math.max(0, 1000 - regionLatency);
    
    // Connection age and health
    if (replica.isHealthy) score += 500;
    const timeSinceLastUse = Date.now() - replica.lastUsed;
    if (timeSinceLastUse > 30000) score += 200; // Prefer connections that haven't been used recently
    
    // Priority-based scoring
    score += (100 - replica.priority) * 10;
    
    return score;
  }

  private getRegionLatency(region: string): number {
    // Simulated region latencies in ms (in production, these would be measured)
    const latencyMap: Record<string, number> = {
      'primary': 50,
      'hkg1': 120,
      'iad1': 80,
      'sin1': 100,
      'fra1': 90,
      'sfo1': 70,
      'unknown': 150,
    };
    
    return latencyMap[region] || 150;
  }

  // Get write client (always uses primary)
  async getWriteClient(connectionId: string = 'default'): Promise<SupabaseClient> {
    return this.getClient(`write_${connectionId}`);
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
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
    
    // Perform initial health check for warm connections
    this.performHealthChecks();
  }

  private async performHealthChecks(): Promise<void> {
    for (const [connectionId, client] of this.clients) {
      try {
        const startTime = Date.now();
        const isHealthy = await this.testConnection(client);
        const currentHealth = this.healthStatus.get(connectionId) || {
          isHealthy: false,
          lastCheck: 0,
          responseTime: 0,
          errorCount: 0,
        };

        this.healthStatus.set(connectionId, {
          isHealthy,
          lastCheck: Date.now(),
          responseTime: Date.now() - startTime,
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

  // Add connection warming for edge regions with warmup queries
  async warmEdgeConnections(): Promise<void> {
    const regions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'];
    const warmupQueries = ['SELECT 1', 'SELECT COUNT(*) FROM robots LIMIT 1'];
    
    const warmPromises = regions.map(async (region) => {
      try {
        const client = await this.getClient(`edge_${region}`);
        // Pre-warm with multiple lightweight queries
        for (const query of warmupQueries) {
          await client.rpc('exec_sql', { query });
        }
        console.log(`Edge connection warmed for region: ${region}`);
      } catch (error) {
        console.warn(`Failed to warm edge connection for ${region}:`, error);
      }
    });
    
    await Promise.allSettled(warmPromises);
  }

  // Enhanced edge-optimized connection acquisition with geographic optimization
  async getEdgeClient(connectionId: string = 'default', region?: string): Promise<SupabaseClient> {
    const edgeConnectionId = region ? `edge_${region}_${connectionId}` : connectionId;
    
    // Check if we have a healthy existing connection
    const existingClient = this.clients.get(edgeConnectionId);
    const health = this.healthStatus.get(edgeConnectionId);
    
    if (existingClient && health?.isHealthy && (Date.now() - health.lastCheck) < 30000) {
      return existingClient;
    }

    try {
      return await this.getClient(edgeConnectionId);
    } catch (error) {
      // Fallback to default connection if edge connection fails
      if (region) {
        console.warn(`Edge connection failed for ${region}, falling back to default:`, error);
        return this.getClient(connectionId);
      }
      throw error;
    }
  }

   // Get optimal connection with geographic scoring (currently unused but kept for future use)
   private getOptimalConnection(region?: string): { connection: SupabaseClient; score: number } | null {
     const candidates: Array<{ connection: SupabaseClient; score: number; connectionId: string }> = [];
     
     for (const [connectionId, connection] of this.clients) {
       const health = this.healthStatus.get(connectionId);
       if (!connection || !health?.isHealthy) continue;
       
       let score = 0;
       
       // Geographic proximity scoring
       if (region && connectionId.includes(region)) {
         score += 2000; // Increased priority for region match
       }
       
       // Latency-based scoring
       const regionLatency = this.getRegionLatency(region || 'unknown');
       score += Math.max(0, 1000 - regionLatency);
       
       // Connection age and health
       if (health.isHealthy) score += 500;
       if (Date.now() - health.lastCheck > 30000) score += 200;
       
       candidates.push({ connection, score, connectionId });
     }
     
     if (candidates.length === 0) return null;
     
     const sortedCandidates = candidates.sort((a, b) => b.score - a.score);
     const best = sortedCandidates[0];
     if (!best) return null;
     return { connection: best.connection, score: best.score };
   }

  // Enhanced connection metrics with edge-specific data and read replica info
  getDetailedConnectionMetrics(): {
    totalConnections: number;
    healthyConnections: number;
    averageResponseTime: number;
    totalErrors: number;
    edgeConnections: { [region: string]: number };
    readReplicaConnections: { [region: string]: number };
    connectionUtilization: number;
    uptime: number;
    readReplicaMetrics: {
      totalReplicas: number;
      healthyReplicas: number;
      replicaUtilization: number;
    };
  } {
    const healthArray = Array.from(this.healthStatus.values());
    const healthyConnections = healthArray.filter(h => h.isHealthy).length;
    const averageResponseTime = healthArray.length > 0 
      ? healthArray.reduce((sum, h) => sum + h.responseTime, 0) / healthArray.length 
      : 0;
    const totalErrors = healthArray.reduce((sum, h) => sum + h.errorCount, 0);

    // Count edge connections by region
    const edgeConnections: { [region: string]: number } = {};
    const readReplicaConnections: { [region: string]: number } = {};
    
    for (const [connectionId] of this.clients) {
      if (connectionId.startsWith('edge_')) {
        const parts = connectionId.split('_');
        const region = parts[1];
        if (region) {
          edgeConnections[region] = (edgeConnections[region] || 0) + 1;
        }
      }
      
      if (connectionId.startsWith('read_replica_')) {
        const parts = connectionId.split('_');
        const region = parts[2];
        if (region) {
          readReplicaConnections[region] = (readReplicaConnections[region] || 0) + 1;
        }
      }
    }

    const connectionUtilization = this.config.maxConnections > 0 
      ? (this.clients.size / this.config.maxConnections) * 100 
      : 0;

    // Read replica metrics
    const totalReplicas = this.readReplicas.size;
    const healthyReplicas = Array.from(this.readReplicas.values())
      .filter(replica => replica.isHealthy).length;
    const replicaUtilization = totalReplicas > 0 
      ? (healthyReplicas / totalReplicas) * 100 
      : 0;

    return {
      totalConnections: this.clients.size,
      healthyConnections,
      averageResponseTime,
      totalErrors,
      edgeConnections,
      readReplicaConnections,
      connectionUtilization,
      uptime: Date.now() - (this.healthCheckTimer ? 0 : Date.now()),
      readReplicaMetrics: {
        totalReplicas,
        healthyReplicas,
        replicaUtilization,
      },
    };
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