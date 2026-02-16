/**
 * Edge KV Storage Service for Vercel Deployment
 * Provides high-performance edge storage with multi-region replication
 * Optimized for session management, caching, and real-time data
 */

import { createClient, type VercelKV } from '@vercel/kv';
import { TIME_CONSTANTS } from '../constants/config';
import { EDGE_KV_CONFIG } from '../constants/modularConfig';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('EdgeKVStorage');

// Edge KV client with connection pooling
class EdgeKVClient {
  public client: VercelKV;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private metrics: {
    hits: number;
    misses: number;
    errors: number;
    sets: number;
    deletes: number;
  } = {
    hits: 0,
    misses: 0,
    errors: 0,
    sets: 0,
    deletes: 0,
  };

  constructor() {
    this.client = createClient({
      url: process['env']['KV_REST_API_URL'],
      token: process['env']['KV_REST_API_TOKEN'],
    });
  }

  // Compress data if needed
  private compress(data: string): string {
    if (data.length > EDGE_KV_CONFIG.COMPRESSION.THRESHOLD_BYTES) {
      try {
        return JSON.stringify({ compressed: true, data: this.gzipCompress(data) });
      } catch (e) {
        logger.warn('Compression failed, storing uncompressed:', e);
        return data;
      }
    }
    return data;
  }

  // Decompress data if needed
  private decompress(data: string): string {
    try {
      const parsed = JSON.parse(data);
      if (parsed.compressed) {
        return this.gzipDecompress(parsed.data);
      }
      return data;
    } catch (_e) {
      return data; // Not compressed or invalid JSON
    }
  }

  // Simple gzip compression (browser-compatible)
  private gzipCompress(data: string): string {
    // In a real implementation, use a proper compression library
    // For now, just return base64 encoded data
    return btoa(data);
  }

  // Simple gzip decompression (browser-compatible)
  private gzipDecompress(data: string): string {
    // In a real implementation, use a proper decompression library
    // For now, just decode base64
    return atob(data);
  }

  // Generate cache key with namespace
  public generateKey(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  // Get value with multi-tier caching
  async get(namespace: string, key: string): Promise<any> {
    const fullKey = this.generateKey(namespace, key);
    
    try {
      // Check memory cache first
      const memCached = this.cache.get(fullKey);
      if (memCached && memCached.expiry > Date.now()) {
        this.metrics.hits++;
        return memCached.data;
      }

      // Check Edge KV
      const value = await this.client.get(fullKey);
      if (value !== null) {
        this.metrics.hits++;
        const decompressed = this.decompress(value as string);
        const parsed = JSON.parse(decompressed);
        
        // Cache in memory for faster access
        this.cache.set(fullKey, {
          data: parsed,
          expiry: Date.now() + TIME_CONSTANTS.MINUTE, // 1 minute memory cache
        });
        
        return parsed;
      }

      this.metrics.misses++;
      return null;
    } catch (error: unknown) {
      this.metrics.errors++;
      logger.error(`EdgeKV get error for key ${fullKey}:`, error);
      return null;
    }
  }

  // Set value with automatic compression
  async set(namespace: string, key: string, value: any, ttl?: number): Promise<boolean> {
    const fullKey = this.generateKey(namespace, key);
    const effectiveTTL = ttl || EDGE_KV_CONFIG.TTL.CACHE;
    
    try {
      const serialized = JSON.stringify(value);
      const compressed = this.compress(serialized);
      
      await this.client.set(fullKey, compressed, { ex: effectiveTTL });
      
      // Update memory cache - cap at 1 minute for memory cache freshness
      this.cache.set(fullKey, {
        data: value,
        expiry: Date.now() + Math.min(effectiveTTL * TIME_CONSTANTS.SECOND, TIME_CONSTANTS.MINUTE),
      });
      
      this.metrics.sets++;
      return true;
    } catch (error: unknown) {
      this.metrics.errors++;
      logger.error(`EdgeKV set error for key ${fullKey}:`, error);
      return false;
    }
  }

  // Delete value
  async delete(namespace: string, key: string): Promise<boolean> {
    const fullKey = this.generateKey(namespace, key);
    
    try {
      await this.client.del(fullKey);
      this.cache.delete(fullKey);
      this.metrics.deletes++;
      return true;
    } catch (error: unknown) {
      this.metrics.errors++;
      logger.error(`EdgeKV delete error for key ${fullKey}:`, error);
      return false;
    }
  }

  // Clear namespace
  async clearNamespace(namespace: string): Promise<boolean> {
    try {
      // Get all keys in namespace
      const keys = await this.client.keys(`${namespace}:*`);
      
      // Delete all keys
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      
      // Clear memory cache for this namespace
      for (const [key] of this.cache.entries()) {
        if (key.startsWith(`${namespace}:`)) {
          this.cache.delete(key);
        }
      }
      
      return true;
    } catch (error: unknown) {
      this.metrics.errors++;
      logger.error(`EdgeKV clear namespace error for ${namespace}:`, error);
      return false;
    }
  }

  // Get multiple values (batch operation)
  async mget(namespace: string, keys: string[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    try {
      const fullKeys = keys.map(key => this.generateKey(namespace, key));
      const values = await this.client.mget(...fullKeys);
      
      keys.forEach((key, index) => {
        const value = values[index];
        if (value !== null) {
          try {
            const decompressed = this.decompress(value as string);
            results[key] = JSON.parse(decompressed);
          } catch (e) {
            logger.warn(`Failed to parse cached value for key ${key}:`, e);
          }
        }
      });
      
      return results;
    } catch (error: unknown) {
      this.metrics.errors++;
      logger.error(`EdgeKV mget error:`, error);
      return {};
    }
  }

  // Set multiple values (batch operation)
  async mset(namespace: string, entries: Record<string, any>, ttl?: number): Promise<boolean> {
    const effectiveTTL = ttl || EDGE_KV_CONFIG.TTL.CACHE;
    
    try {
      const operations: Promise<any>[] = [];
      
      for (const [key, value] of Object.entries(entries)) {
        const fullKey = this.generateKey(namespace, key);
        const serialized = JSON.stringify(value);
        const compressed = this.compress(serialized);
        
        operations.push(this.client.set(fullKey, compressed, { ex: effectiveTTL }));
        
        // Update memory cache - cap at 1 minute for memory cache freshness
        this.cache.set(fullKey, {
          data: value,
          expiry: Date.now() + Math.min(effectiveTTL * TIME_CONSTANTS.SECOND, TIME_CONSTANTS.MINUTE),
        });
      }

      await Promise.all(operations);
      this.metrics.sets += Object.keys(entries).length;
      return true;
    } catch (error: unknown) {
      this.metrics.errors++;
      logger.error(`EdgeKV mset error:`, error);
      return false;
    }
  }

  // Increment counter
  async increment(namespace: string, key: string, amount: number = 1): Promise<number | null> {
    const fullKey = this.generateKey(namespace, key);
    
    try {
      const result = await this.client.incrby(fullKey, amount);
      return result;
    } catch (error: unknown) {
      this.metrics.errors++;
      logger.error(`EdgeKV increment error for key ${fullKey}:`, error);
      return null;
    }
  }

  // Get metrics
  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? (this.metrics.hits / total * 100).toFixed(2) + '%' : '0%',
      cacheSize: this.cache.size,
    };
  }

  // Clear memory cache
  clearMemoryCache() {
    this.cache.clear();
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry <= now) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
const edgeKVClient = new EdgeKVClient();

// Cleanup expired entries every 5 minutes
const cleanupTimer = setInterval(() => edgeKVClient.cleanup(), TIME_CONSTANTS.CLEANUP_LONG_INTERVAL);

/**
 * Cleanup function to stop the cleanup timer
 * Call this when the application is shutting down or to prevent memory leaks
 */
export function stopCleanupTimer(): void {
  clearInterval(cleanupTimer);
}

// Edge KV Service with specialized methods
export const edgeKVService = {
  // Session management
  session: {
    async get(sessionId: string) {
      return await edgeKVClient.get('session', sessionId);
    },
    
    async set(sessionId: string, sessionData: any) {
      return await edgeKVClient.set('session', sessionId, sessionData, EDGE_KV_CONFIG.TTL.SESSION);
    },
    
    async delete(sessionId: string) {
      return await edgeKVClient.delete('session', sessionId);
    },
    
    async refresh(sessionId: string) {
      const session = await this.get(sessionId);
      if (session) {
        return await this.set(sessionId, session);
      }
      return false;
    },
  },

  // API response caching
  api: {
    async get(endpoint: string, params?: Record<string, any>) {
      const key = params ? `${endpoint}:${JSON.stringify(params)}` : endpoint;
      return await edgeKVClient.get('api', key);
    },
    
    async set(endpoint: string, data: any, params?: Record<string, any>) {
      const key = params ? `${endpoint}:${JSON.stringify(params)}` : endpoint;
      return await edgeKVClient.set('api', key, data, EDGE_KV_CONFIG.TTL.API_RESPONSE);
    },
    
    async invalidate(endpoint: string) {
      // Delete all variations of this endpoint
      const keys = await edgeKVClient.client.keys(`api:${endpoint}*`);
      if (keys.length > 0) {
        await edgeKVClient.client.del(...keys);
      }
    },
  },

  // User preferences
  preferences: {
    async get(userId: string) {
      return await edgeKVClient.get('preferences', userId);
    },
    
    async set(userId: string, preferences: any) {
      return await edgeKVClient.set('preferences', userId, preferences, EDGE_KV_CONFIG.TTL.USER_PREFERENCES);
    },
    
    async update(userId: string, updates: Partial<any>) {
      const current = await this.get(userId) || {};
      const updated = { ...current, ...updates };
      return await this.set(userId, updated);
    },
  },

  // Search results caching
  search: {
    async get(query: string, filters?: Record<string, any>) {
      const key = filters ? `${query}:${JSON.stringify(filters)}` : query;
      return await edgeKVClient.get('search', key);
    },
    
    async set(query: string, results: any, filters?: Record<string, any>) {
      const key = filters ? `${query}:${JSON.stringify(filters)}` : query;
      return await edgeKVClient.set('search', key, results, EDGE_KV_CONFIG.TTL.SEARCH_RESULTS);
    },
  },

  // Analytics data
  analytics: {
    async get(key: string) {
      return await edgeKVClient.get('analytics', key);
    },
    
    async set(key: string, data: any) {
      return await edgeKVClient.set('analytics', key, data, EDGE_KV_CONFIG.TTL.ANALYTICS);
    },
    
    async increment(metric: string, value: number = 1) {
      return await edgeKVClient.increment('analytics', metric, value);
    },
    
    async batchIncrement(metrics: Record<string, number>) {
      const operations = Object.entries(metrics).map(([metric, value]) =>
        edgeKVClient.increment('analytics', metric, value)
      );
      await Promise.all(operations);
    },
  },

  // Rate limiting
  rateLimit: {
    async check(identifier: string, limit: number, window: number = EDGE_KV_CONFIG.TTL.RATE_LIMIT): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
      const key = `rate:${identifier}`;
      const current = await edgeKVClient.increment('rate_limit', key, 1);

      if (current === null) {
        return { allowed: false, remaining: 0, resetTime: Date.now() + (window * TIME_CONSTANTS.SECOND) };
      }

      if (current === 1) {
        // First request in window, set expiry
        await edgeKVClient.client.expire(edgeKVClient.generateKey('rate_limit', key), window);
      }

      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);
      const resetTime = Date.now() + (window * TIME_CONSTANTS.SECOND);
      
      return { allowed, remaining, resetTime };
    },
    
    async reset(identifier: string) {
      return await edgeKVClient.delete('rate_limit', `rate:${identifier}`);
    },
  },

  // Real-time subscriptions
  realtime: {
    async subscribe(channel: string, _userId: string) {
      const key = `subscribers:${channel}`;
      return await edgeKVClient.increment('realtime', key, 1);
    },

    async unsubscribe(channel: string, _userId: string) {
      const key = `subscribers:${channel}`;
      return await edgeKVClient.increment('realtime', key, -1);
    },
    
    async getSubscriberCount(channel: string) {
      const count = await edgeKVClient.get('realtime', `subscribers:${channel}`);
      return count || 0;
    },
  },

  // Cache warming
  warming: {
    async warmData(data: Record<string, any>, namespace: string = 'warm') {
      return await edgeKVClient.mset(namespace, data, EDGE_KV_CONFIG.TTL.CACHE);
    },
    
    async getWarmedData(key: string) {
      return await edgeKVClient.get('warm', key);
    },
  },

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; metrics: any }> {
    const start = Date.now();
    
    try {
      // Test set/get operation
      const testKey = `health:${Date.now()}`;
      await edgeKVClient.set('health', testKey, { test: true }, 10);
      const result = await edgeKVClient.get('health', testKey);
      await edgeKVClient.delete('health', testKey);
      
      const latency = Date.now() - start;
      const status = result ? 'healthy' : 'unhealthy';
      
      return {
        status,
        latency,
        metrics: edgeKVClient.getMetrics(),
      };
    } catch (_error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        metrics: edgeKVClient.getMetrics(),
      };
    }
  },

  // Get client metrics
  getMetrics() {
    return edgeKVClient.getMetrics();
  },

  // Clear all caches (emergency use)
  async clearAll() {
    const namespaces = ['session', 'api', 'preferences', 'search', 'analytics', 'rate_limit', 'realtime', 'warm'];
    
    for (const namespace of namespaces) {
      await edgeKVClient.clearNamespace(namespace);
    }
    
    edgeKVClient.clearMemoryCache();
  },
};

export default edgeKVService;