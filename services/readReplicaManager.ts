// Read Replica Optimization Service for Analytics Queries
import { createDynamicSupabaseClient } from './dynamicSupabaseLoader';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './settingsManager';
import { queryCache } from './advancedCache';
import { withErrorHandling } from '../utils/errorManager';

interface ReadReplicaConfig {
  readonly: boolean;
  region: string;
  priority: number;
}

interface QueryMetrics {
  executionTime: number;
  cacheHit: boolean;
  replicaUsed: string;
  timestamp: number;
}

class ReadReplicaManager {
  private replicas: Map<string, SupabaseClient> = new Map();
  private primaryClient: SupabaseClient | null = null;
  private metrics: QueryMetrics[] = [];
  private readonly MAX_METRICS = 1000;

  constructor() {
    // Initialize asynchronously without blocking
    this.initializeClients().catch(console.error);
  }

  private async initializeClients() {
    const supabaseUrl = getEnv('VITE_SUPABASE_URL');
    const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Read replicas disabled: Missing Supabase configuration');
      return;
    }

    // Primary client for writes
    this.primaryClient = await createDynamicSupabaseClient(supabaseUrl, supabaseAnonKey);

    // Read replica configurations (example regions)
    const replicaConfigs: ReadReplicaConfig[] = [
      { readonly: true, region: 'us-east-1', priority: 1 },
      { readonly: true, region: 'eu-west-1', priority: 2 },
      { readonly: true, region: 'ap-southeast-1', priority: 3 }
    ];

    // Initialize replica clients
    // Initialize replica clients asynchronously
    replicaConfigs.forEach(async (config) => {
      const replicaUrl = supabaseUrl.replace('.supabase.co', `-${config.region}.supabase.co`);
      const client = await createDynamicSupabaseClient(replicaUrl, supabaseAnonKey);
      this.replicas.set(config.region, client);
    });
  }

  async executeAnalyticsQuery<T = any>(
    query: string,
    params: any[] = [],
    options: {
      useCache?: boolean;
      cacheTTL?: number;
      forceReplica?: string;
    } = {}
  ): Promise<{ data: T[] | null; error: any; metrics: QueryMetrics }> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, params);
    
    // Check cache first
    if (options.useCache !== false) {
      const cached = queryCache.get(cacheKey) as any;
      if (cached && cached.data) {
        return {
          data: cached.data,
          error: null,
          metrics: {
            executionTime: Date.now() - startTime,
            cacheHit: true,
            replicaUsed: 'cache',
            timestamp: Date.now()
          }
        };
      }
    }

    // Select optimal replica
    const client = this.selectOptimalReplica(options.forceReplica);
    const replicaName = options.forceReplica || this.getReplicaName(client);

    try {
      // Execute query with timeout
      const result = await Promise.race([
        client.rpc('execute_analytics_query', { query, params }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 30000)
        )
      ]) as any;

      const executionTime = Date.now() - startTime;
      const metrics: QueryMetrics = {
        executionTime,
        cacheHit: false,
        replicaUsed: replicaName,
        timestamp: Date.now()
      };

      // Cache successful results
      if (result && result.data && !result.error) {
        queryCache.set(cacheKey, {
          data: result.data,
          timestamp: Date.now(),
          ttl: options.cacheTTL || 300000 // 5 minutes default
        });
      }

      this.recordMetrics(metrics);

      return {
        data: result?.data || null,
        error: result?.error || null,
        metrics
      };

    } catch (error) {
      // Fallback to primary on replica failure
      if (client !== this.primaryClient && this.primaryClient) {
        console.warn(`Replica ${replicaName} failed, falling back to primary`);
        return this.executeAnalyticsQuery(query, params, {
          ...options,
          forceReplica: 'primary'
        });
      }
      throw error;
    }
  }

  private selectOptimalReplica(forceReplica?: string): SupabaseClient {
    if (forceReplica === 'primary' || !this.primaryClient) {
      return this.primaryClient!;
    }

    if (forceReplica && this.replicas.has(forceReplica)) {
      return this.replicas.get(forceReplica)!;
    }

    // Select replica based on recent performance
    const availableReplicas = Array.from(this.replicas.entries());
    if (availableReplicas.length === 0) {
      return this.primaryClient!;
    }

    // Simple load balancing - select replica with best recent performance
    const replicaMetrics = this.metrics.filter(m => 
      m.replicaUsed !== 'cache' && 
      m.replicaUsed !== 'primary' &&
      Date.now() - m.timestamp < 300000 // Last 5 minutes
    );

    if (replicaMetrics.length === 0) {
      // No recent metrics, use first available replica
      return availableReplicas[0][1];
    }

    // Calculate average execution time per replica
    const avgPerformance = new Map<string, number>();
    replicaMetrics.forEach(metric => {
      const current = avgPerformance.get(metric.replicaUsed) || 0;
      avgPerformance.set(metric.replicaUsed, current + metric.executionTime);
    });

    // Find best performing replica
    let bestReplica = availableReplicas[0][1];
    let bestRegion = availableReplicas[0][0];
    let bestTime = Infinity;

    availableReplicas.forEach(([region, client]) => {
      const avgTime = avgPerformance.get(region) || 0;
      const count = replicaMetrics.filter(m => m.replicaUsed === region).length;
      const performance = count > 0 ? avgTime / count : Infinity;

      if (performance < bestTime) {
        bestTime = performance;
        bestReplica = client;
        bestRegion = region;
      }
    });

    return bestReplica;
  }

  private getReplicaName(client: SupabaseClient): string {
    if (client === this.primaryClient) return 'primary';
    
    for (const [region, replicaClient] of this.replicas.entries()) {
      if (client === replicaClient) return region;
    }
    
    return 'unknown';
  }

  private generateCacheKey(query: string, params: any[]): string {
    return `analytics:${Buffer.from(query + JSON.stringify(params)).toString('base64')}`;
  }

  private recordMetrics(metrics: QueryMetrics) {
    this.metrics.push(metrics);
    
    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  // Analytics-specific optimized queries
  async getRobotAnalytics(robotId: string, timeRange: 'day' | 'week' | 'month' = 'week') {
    const query = `
      SELECT 
        r.id,
        r.name,
        r.strategy_type,
        r.created_at,
        COUNT(a.id) as analysis_count,
        AVG(a.risk_score) as avg_risk_score,
        MAX(a.created_at) as last_analysis
      FROM robots r
      LEFT JOIN robot_analysis a ON r.id = a.robot_id
      WHERE r.id = $1
        AND a.created_at >= NOW() - INTERVAL '${timeRange}'
      GROUP BY r.id, r.name, r.strategy_type, r.created_at
    `;

    return this.executeAnalyticsQuery(query, [robotId], {
      useCache: true,
      cacheTTL: 60000 // 1 minute for analytics
    });
  }

  async getPerformanceMetrics(timeRange: 'hour' | 'day' | 'week' = 'day') {
    const query = `
      SELECT 
        DATE_TRUNC('${timeRange}', created_at) as period,
        COUNT(*) as robot_count,
        COUNT(DISTINCT strategy_type) as strategy_diversity,
        AVG(CASE WHEN risk_score < 5 THEN 1 ELSE 0 END) * 100 as low_risk_percentage
      FROM robots r
      LEFT JOIN robot_analysis a ON r.id = a.robot_id
      WHERE r.created_at >= NOW() - INTERVAL '1 ${timeRange}'
      GROUP BY DATE_TRUNC('${timeRange}', created_at)
      ORDER BY period DESC
      LIMIT 24
    `;

    return this.executeAnalyticsQuery(query, [], {
      useCache: true,
      cacheTTL: 300000 // 5 minutes
    });
  }

  async getUsageStatistics() {
    const query = `
      SELECT 
        strategy_type,
        COUNT(*) as count,
        AVG(risk_score) as avg_risk,
        MIN(created_at) as first_used,
        MAX(created_at) as last_used
      FROM robots r
      LEFT JOIN robot_analysis a ON r.id = a.robot_id
      GROUP BY strategy_type
      ORDER BY count DESC
    `;

    return this.executeAnalyticsQuery(query, [], {
      useCache: true,
      cacheTTL: 600000 // 10 minutes
    });
  }

  // Health check for replicas
  async checkReplicaHealth() {
    const healthChecks = await Promise.allSettled(
      Array.from(this.replicas.entries()).map(async ([region, client]) => {
        const start = Date.now();
        try {
          await client.from('robots').select('count').limit(1);
          return {
            region,
            status: 'healthy',
            latency: Date.now() - start
          };
        } catch (error) {
          return {
            region,
            status: 'unhealthy',
            latency: Date.now() - start,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    return healthChecks.map(result => 
      result.status === 'fulfilled' ? result.value : {
        region: 'unknown',
        status: 'error',
        error: result.reason
      }
    );
  }

  getMetrics(): QueryMetrics[] {
    return [...this.metrics];
  }

  clearMetrics() {
    this.metrics = [];
  }
}

export const readReplicaManager = new ReadReplicaManager();
export default readReplicaManager;