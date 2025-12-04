import { createDynamicSupabaseClient } from './dynamicSupabaseLoader';
import type { SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from './settingsManager';

interface EdgeClientConfig {
  ttl: number;
  healthCheckInterval: number;
  connectionTimeout: number;
  maxRetries: number;
}

interface ClientCache {
  client: SupabaseClient;
  lastUsed: number;
  isHealthy: boolean;
}

class EdgeSupabasePool {
  private static instance: EdgeSupabasePool;
  private clientCache: Map<string, ClientCache> = new Map();
  private config: EdgeClientConfig = {
    ttl: 60000, // 60 seconds - optimized for better performance
    healthCheckInterval: 7500, // 7.5 seconds for faster detection
    connectionTimeout: 750, // 0.75 seconds for faster failover
    maxRetries: 5, // Increased retries for better reliability
  };
  private healthCheckTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startHealthChecks();
  }

  static getInstance(): EdgeSupabasePool {
    if (!EdgeSupabasePool.instance) {
      EdgeSupabasePool.instance = new EdgeSupabasePool();
    }
    return EdgeSupabasePool.instance;
  }

  async getClient(connectionId: string = 'default'): Promise<SupabaseClient> {
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode !== 'supabase' || !settings.url || !settings.anonKey) {
      throw new Error('Supabase not configured');
    }

    const cacheKey = this.getCacheKey(connectionId);
    const cached = this.clientCache.get(cacheKey);

    // Return healthy cached client if within TTL
    if (cached && cached.isHealthy && (Date.now() - cached.lastUsed) < this.config.ttl) {
      cached.lastUsed = Date.now();
      return cached.client;
    }

    // Create new client
    const client = await createDynamicSupabaseClient(settings.url, settings.anonKey);
    
    // Quick health check
    const isHealthy = await this.quickHealthCheck(client);
    
    if (!isHealthy) {
      throw new Error('Failed to establish healthy Supabase connection');
    }

    // Cache the client
    this.clientCache.set(cacheKey, {
      client,
      lastUsed: Date.now(),
      isHealthy: true,
    });

    return client;
  }

  async getEdgeClient(connectionId: string = 'default', region?: string): Promise<SupabaseClient> {
    const edgeConnectionId = region ? `edge_${region}_${connectionId}` : connectionId;
    return this.getClient(edgeConnectionId);
  }

  private getCacheKey(connectionId: string): string {
    const region = typeof window !== 'undefined' 
      ? 'client' 
      : process.env['VERCEL_REGION'] || 'unknown';
    return `${region}_${connectionId}`;
  }

  private async quickHealthCheck(client: SupabaseClient): Promise<boolean> {
    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), this.config.connectionTimeout)
      );

      const healthPromise = client
        .from('robots')
        .select('id')
        .limit(1);

      const result = await Promise.race([healthPromise, timeoutPromise]) as { error?: any };
      
      return !result?.error;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, cache] of this.clientCache) {
      // Remove expired clients
      if (now - cache.lastUsed > this.config.ttl) {
        expiredKeys.push(key);
        continue;
      }

      // Periodic health check for active clients
      if (now - cache.lastUsed > this.config.healthCheckInterval) {
        try {
          const isHealthy = await this.quickHealthCheck(cache.client);
          cache.isHealthy = isHealthy;
          
          if (!isHealthy) {
            expiredKeys.push(key);
          }
        } catch (error) {
          console.warn(`Health check failed for ${key}:`, error);
          expiredKeys.push(key);
        }
      }
    }

    // Clean up expired and unhealthy clients
    expiredKeys.forEach(key => {
      this.clientCache.delete(key);
    });
  }

  // Warm up connections for key regions with enhanced parallel processing
  async warmEdgeConnections(): Promise<void> {
    const regions = ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1', 'cle1'];
    
    // Process regions in batches for better resource management
    const batchSize = 3;
    const results: { region: string; success: boolean; latency: number }[] = [];
    
    for (let i = 0; i < regions.length; i += batchSize) {
      const batch = regions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (region) => {
        const startTime = Date.now();
        try {
          await this.getEdgeClient('warmup', region);
          const latency = Date.now() - startTime;
          console.log(`✅ Edge connection warmed for region: ${region} (${latency}ms)`);
          return { region, success: true, latency };
        } catch (error) {
          const latency = Date.now() - startTime;
          console.warn(`❌ Failed to warm edge connection for ${region}:`, error);
          return { region, success: false, latency };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });
      
      // Small delay between batches to prevent overwhelming
      if (i + batchSize < regions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Log warming summary
    const successCount = results.filter(r => r.success).length;
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    console.log(`🔥 Edge warming completed: ${successCount}/${regions.length} regions successful, avg latency: ${avgLatency.toFixed(2)}ms`);
    
    return;
  }

  // Get connection metrics
  getConnectionMetrics(): {
    totalConnections: number;
    healthyConnections: number;
    averageAge: number;
    regions: { [region: string]: number };
  } {
    const now = Date.now();
    const connections = Array.from(this.clientCache.values());
    const healthyConnections = connections.filter(c => c.isHealthy).length;
    const averageAge = connections.length > 0
      ? connections.reduce((sum, c) => sum + (now - c.lastUsed), 0) / connections.length
      : 0;

    const regions: { [region: string]: number } = {};
    for (const [key] of this.clientCache) {
      const parts = key.split('_');
      const region = parts[0] || 'unknown';
      regions[region] = (regions[region] || 0) + 1;
    }

    return {
      totalConnections: this.clientCache.size,
      healthyConnections,
      averageAge,
      regions,
    };
  }

  // Clear all connections
  async clearConnections(): Promise<void> {
    this.clientCache.clear();
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // Remove specific connection
  async removeConnection(connectionId: string): Promise<void> {
    const cacheKey = this.getCacheKey(connectionId);
    this.clientCache.delete(cacheKey);
  }
}

export const edgeConnectionPool = EdgeSupabasePool.getInstance();