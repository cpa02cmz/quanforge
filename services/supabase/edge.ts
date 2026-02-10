/**
 * Supabase Edge Optimizations Service
 * Edge-specific functionality and optimizations for Supabase operations
 */

import { SupabaseClient } from '@supabase/supabase-js';


interface EdgeConfig {
  enableRegionOptimization: boolean;
  enableCompression: boolean;
  enableRequestBatching: boolean;
  batchSize: number;
  batchTimeout: number;
  preferredRegions: string[];
  fallbackRegions: string[];
  edgeCacheTTL: number;
}

interface EdgeMetrics {
  regionLatency: Map<string, number>;
  requestCount: number;
  cacheHitRate: number;
  compressionRatio: number;
  batchEfficiency: number;
}

interface BatchedRequest {
  id: string;
  operation: () => Promise<any>;
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

const DEFAULT_EDGE_CONFIG: EdgeConfig = {
  enableRegionOptimization: true,
  enableCompression: true,
  enableRequestBatching: true,
  batchSize: 10,
  batchTimeout: 50, // ms
  preferredRegions: ['auto', 'us-east-1', 'eu-west-1'],
  fallbackRegions: ['us-west-1', 'ap-southeast-1'],
  edgeCacheTTL: 30000, // 30 seconds
};

class SupabaseEdgeOptimizations {
  private static instance: SupabaseEdgeOptimizations;
  private config: EdgeConfig;
  private metrics: EdgeMetrics;
  private requestQueue: BatchedRequest[] = [];
  private batchTimer?: ReturnType<typeof setTimeout>;
  private edgeCache: Map<string, { data: any; timestamp: number; region?: string }> = new Map();
  private regionPerformance: Map<string, { totalLatency: number; requestCount: number }> = new Map();

  private constructor(config: Partial<EdgeConfig> = {}) {
    this.config = { ...DEFAULT_EDGE_CONFIG, ...config };
    this.metrics = {
      regionLatency: new Map(),
      requestCount: 0,
      cacheHitRate: 0,
      compressionRatio: 0,
      batchEfficiency: 0,
    };
  }

  static getInstance(config?: Partial<EdgeConfig>): SupabaseEdgeOptimizations {
    if (!SupabaseEdgeOptimizations.instance) {
      SupabaseEdgeOptimizations.instance = new SupabaseEdgeOptimizations(config);
    }
    return SupabaseEdgeOptimizations.instance;
  }

  /**
   * Get optimal region for connection based on performance metrics
   */
  getOptimalRegion(): string {
    if (!this.config.enableRegionOptimization) {
      return this.config.preferredRegions[0];
    }

    // Calculate performance scores for each region
    const regionScores = new Map<string, number>();
    
    for (const [region, performance] of this.regionPerformance) {
      const avgLatency = performance.totalLatency / performance.requestCount;
      const score = 1000 / (avgLatency + 1); // Lower latency = higher score
      regionScores.set(region, score);
    }

    // Sort regions by performance score
    const sortedRegions = Array.from(regionScores.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([region]) => region);

    // Return best performing region, fallback to preferred
    for (const preferred of this.config.preferredRegions) {
      if (sortedRegions.includes(preferred)) {
        return preferred;
      }
    }

    return this.config.preferredRegions[0];
  }

  /**
   * Record region performance metrics
   */
  recordRegionPerformance(region: string, latency: number): void {
    const current = this.regionPerformance.get(region) || { totalLatency: 0, requestCount: 0 };
    current.totalLatency += latency;
    current.requestCount++;
    this.regionPerformance.set(region, current);
    this.metrics.regionLatency.set(region, latency);
    this.metrics.requestCount++;
  }

  /**
   * Edge-aware client factory with optimizations
   */
  async createOptimizedClient(region?: string): Promise<SupabaseClient> {
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase credentials not available');
    }

    const optimalRegion = region || this.getOptimalRegion();
    const startTime = Date.now();

    const { createClient } = await import('@supabase/supabase-js');

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'X-Edge-Optimized': 'true',
          'X-Preferred-Region': optimalRegion,
          ...(this.config.enableCompression && { 'Accept-Encoding': 'gzip, br' }),
        },
      },
    });

    const latency = Date.now() - startTime;
    this.recordRegionPerformance(optimalRegion, latency);

    return client;
  }

  /**
   * Edge cache with region awareness
   */
  getFromEdgeCache(key: string, region?: string): any | null {
    const cached = this.edgeCache.get(key);
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > this.config.edgeCacheTTL) {
      this.edgeCache.delete(key);
      return null;
    }

    // Prefer region-specific cache
    if (region && cached.region !== region) {
      return null;
    }

    this.metrics.cacheHitRate = (this.metrics.cacheHitRate * 0.9) + (1 * 0.1); // Moving average
    return cached.data;
  }

  /**
   * Store in edge cache with region tagging
   */
  setEdgeCache(key: string, data: any, region?: string): void {
    this.edgeCache.set(key, {
      data,
      timestamp: Date.now(),
      region,
    });

    // Cleanup old entries
    if (this.edgeCache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Cleanup old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.edgeCache.forEach((cached, key) => {
      if (now - cached.timestamp > this.config.edgeCacheTTL) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.edgeCache.delete(key));
  }

  /**
   * Batch request queuing for edge efficiency
   */
  async batchRequest<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.config.enableRequestBatching) {
      return operation();
    }

    return new Promise((resolve, reject) => {
      const request: BatchedRequest = {
        id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        operation,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.requestQueue.push(request);

      if (this.requestQueue.length >= this.config.batchSize) {
        this.processBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.config.batchTimeout);
      }
    });
  }

  /**
   * Process batched requests
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    const batch = this.requestQueue.splice(0, this.config.batchSize);
    if (batch.length === 0) return;

    const startTime = Date.now();

    try {
      // Process requests in parallel
      const results = await Promise.allSettled(
        batch.map(req => req.operation())
      );

      // Resolve/reject based on results
      results.forEach((result, index) => {
        const request = batch[index];
        if (result.status === 'fulfilled') {
          request.resolve(result.value);
        } else {
          request.reject(result.reason);
        }
      });

      // Update metrics
      const processingTime = Date.now() - startTime;
      const avgTimePerRequest = processingTime / batch.length;
      const efficiency = Math.max(0, 100 - (avgTimePerRequest / 10)); // Arbitrary baseline of 10ms per request
      this.metrics.batchEfficiency = (this.metrics.batchEfficiency * 0.9) + (efficiency * 0.1);

    } catch (error) {
      // Reject all requests in batch on error
      batch.forEach(request => {
        request.reject(error);
      });
    }
  }

  /**
   * Compress data for edge transmission
   */
  async compressData(data: any): Promise<string> {
    if (!this.config.enableCompression) {
      return JSON.stringify(data);
    }

    const jsonString = JSON.stringify(data);
    
    try {
      // Use browser's compression if available
      if ('CompressionStream' in window) {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        writer.write(new TextEncoder().encode(jsonString));
        writer.close();
        
        const chunks: Uint8Array[] = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }
        
        const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }
        
        const compressionRatio = jsonString.length / compressed.length;
        this.metrics.compressionRatio = (this.metrics.compressionRatio * 0.9) + (compressionRatio * 0.1);
        
        return btoa(String.fromCharCode(...compressed));
      }
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
    }

    return jsonString;
  }

  /**
   * Decompress data from edge transmission
   */
  async decompressData(compressedData: string): Promise<any> {
    if (!this.config.enableCompression) {
      return JSON.parse(compressedData);
    }

    try {
      // Check if data is base64 encoded (compressed)
      if (/^[A-Za-z0-9+/]*={0,2}$/.test(compressedData)) {
        const compressed = Uint8Array.from(atob(compressedData), c => c.charCodeAt(0));
        
        if ('DecompressionStream' in window) {
          const stream = new DecompressionStream('gzip');
          const writer = stream.writable.getWriter();
          const reader = stream.readable.getReader();
          
          writer.write(compressed);
          writer.close();
          
          const chunks: Uint8Array[] = [];
          let done = false;
          
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) chunks.push(value);
          }
          
          const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
          let offset = 0;
          for (const chunk of chunks) {
            decompressed.set(chunk, offset);
            offset += chunk.length;
          }
          
          return JSON.parse(new TextDecoder().decode(decompressed));
        }
      }
    } catch (error) {
      console.warn('Decompression failed, trying direct JSON parse:', error);
    }

    return JSON.parse(compressedData);
  }

  /**
   * Get current edge metrics
   */
  getMetrics(): EdgeMetrics {
    return {
      regionLatency: new Map(this.metrics.regionLatency),
      requestCount: this.metrics.requestCount,
      cacheHitRate: Math.round(this.metrics.cacheHitRate * 100) / 100,
      compressionRatio: Math.round(this.metrics.compressionRatio * 100) / 100,
      batchEfficiency: Math.round(this.metrics.batchEfficiency * 100) / 100,
    };
  }

  /**
   * Get edge configuration
   */
  getConfig(): EdgeConfig {
    return { ...this.config };
  }

  /**
   * Update edge configuration
   */
  updateConfig(newConfig: Partial<EdgeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = {
      regionLatency: new Map(),
      requestCount: 0,
      cacheHitRate: 0,
      compressionRatio: 0,
      batchEfficiency: 0,
    };
    this.regionPerformance.clear();
  }

  /**
   * Clear edge cache
   */
  clearCache(): void {
    this.edgeCache.clear();
  }

  /**
   * Pre-warm edge cache for common operations
   */
  async warmEdgeCache(): Promise<void> {
    // Common cache keys to pre-warm
    const commonKeys = [
      'robots:list:recent',
      'user:session:current',
      'strategies:active',
    ];

    for (const key of commonKeys) {
      try {
        // This would need to be implemented based on actual data needs
        // const data = await this.getCommonData(key);
        // this.setEdgeCache(key, data);
      } catch (error) {
        console.warn(`Failed to warm cache for key ${key}:`, error);
      }
    }
  }
}

// Export singleton instance
export const supabaseEdge = SupabaseEdgeOptimizations.getInstance();
export default supabaseEdge;
export type { EdgeConfig, EdgeMetrics, BatchedRequest };