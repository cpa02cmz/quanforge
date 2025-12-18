/**
 * AI Response Caching Service for QuantForge AI
 * Provides intelligent caching for AI responses to reduce API costs and improve performance
 */

import { createScopedLogger } from '../utils/logger';

interface AIResponseCacheEntry {
  prompt: string;
  response: unknown;
  timestamp: number;
  ttl: number;
  strategy: string; // The strategy type for cache grouping
}

interface AIResponseCacheConfig {
  defaultTTL: number;        // Default time-to-live in milliseconds
  maxSize: number;           // Maximum number of entries
  compression: boolean;      // Whether to compress cache data
  enableCompression: boolean; // Enable compression for AI responses
  cacheStrategies: boolean;  // Whether to cache strategy-specific responses
}

class AIResponseCache {
  private cache: Map<string, AIResponseCacheEntry> = new Map();
  private readonly config: AIResponseCacheConfig;
  private readonly storageKey = 'quantforge-ai-response-cache';
  private readonly logger = createScopedLogger('AIResponseCache');
  
  constructor(config?: Partial<AIResponseCacheConfig>) {
    this.config = {
      defaultTTL: 3600000,        // 1 hour default for AI responses
      maxSize: 200,               // 200 entries max (more conservative for AI responses)
      compression: true,
      enableCompression: true,
      cacheStrategies: true,
      ...config
    };
    
    // Initialize from localStorage if available
    this.loadFromStorage();
  }
  
  private generateKey(prompt: string, strategy?: string): string {
    // Create a unique key based on prompt and strategy
    const baseKey = `${prompt}_${strategy || 'default'}`;
    
    // Simple hash function to create a consistent key
    let hash = 0;
    for (let i = 0; i < baseKey.length; i++) {
      const char = baseKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
  
  private compressData(data: unknown): unknown {
    if (!this.config.enableCompression) return data;
    
    try {
      // In a real implementation, we would use a compression library like LZ-String
      // For now, we'll just return the data as-is but in a real app this would compress
      return data;
    } catch (e) {
      this.logger.warn('Failed to compress data:', e);
      return data;
    }
  }
  
  private decompressData(data: unknown): unknown {
    if (!this.config.enableCompression) return data;
    
    try {
      // In a real implementation, we would decompress the data
      return data;
    } catch (e) {
      this.logger.warn('Failed to decompress data:', e);
      return data;
    }
  }
  
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
  }
  
  private enforceMaxSize(): void {
    if (this.cache.size <= this.config.maxSize) return;
    
    // Remove oldest entries first
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const excessCount = Math.min(this.cache.size - this.config.maxSize, entries.length);
    for (let i = 0; i < excessCount; i++) {
      const entry = entries[i];
      if (entry) {
        this.cache.delete(entry[0]);
      }
    }
  }
  
  async get(prompt: string, strategy?: string): Promise<unknown | null> {
    this.cleanupExpired();
    
    const key = this.generateKey(prompt, strategy);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.saveToStorage();
      return null;
    }
    
    try {
      const decompressed = this.decompressData(entry.response);
      return decompressed;
    } catch (e) {
      this.logger.error('Failed to retrieve cached AI response:', e);
      this.cache.delete(key);
      return null;
    }
  }
  
  async set(prompt: string, response: unknown, strategy?: string, ttl?: number): Promise<void> {
    this.cleanupExpired();
    
    const key = this.generateKey(prompt, strategy);
    const entry: AIResponseCacheEntry = {
      prompt,
      response: this.compressData(response),
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTTL,
      strategy: strategy || 'default'
    };
    
    this.cache.set(key, entry);
    this.enforceMaxSize();
    this.saveToStorage();
  }
  
  async delete(prompt: string, strategy?: string): Promise<void> {
    const key = this.generateKey(prompt, strategy);
    this.cache.delete(key);
    this.saveToStorage();
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  }
  
  size(): number {
    return this.cache.size;
  }
  
  // Get cache statistics
  getStats(): {
    size: number;
    keys: number;
    estimatedSizeKB: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      keys: this.cache.size,
      estimatedSizeKB: Math.round(JSON.stringify(Array.from(this.cache.entries())).length / 1024),
      hitRate: 0 // Would require tracking hits/misses
    };
  }
  
  // Save to storage with error handling
  private saveToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.cache.entries())));
      } catch (e) {
        this.logger.error('Failed to save AI response cache to storage:', e);
      }
    }
  }
  
  // Load from storage with error handling
  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          this.cache = new Map(data);
        }
      } catch (e) {
        this.logger.error('Failed to load AI response cache from storage:', e);
      }
    }
  }
  
  // Invalidate cache entries for a specific strategy
  async invalidateStrategy(strategy: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.strategy === strategy) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    this.saveToStorage();
  }
  
  // Clean up resources
  destroy(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const aiResponseCache = new AIResponseCache({
  defaultTTL: 3600000, // 1 hour
  maxSize: 200,
  enableCompression: true
});

export { AIResponseCache };