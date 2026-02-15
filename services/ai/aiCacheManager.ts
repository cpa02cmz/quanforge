// AI Cache Management with TTL and Semantic Similarity
import { createScopedLogger } from "../../utils/logger";
import { StrategyParams, StrategyAnalysis, AISettings } from "../../types";
import { AI_CONFIG } from "../../constants/config";
import { STRING_TRUNCATION } from "../../constants/modularConfig";

const logger = createScopedLogger('ai-cache-manager');

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  semanticKey?: string;
  size: number;
}

interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number;
  hitRate: number;
}

export class AICacheManager {
  private generationCache = new Map<string, CacheEntry<{ thinking?: string, content: string }>>();
  private analysisCache = new Map<string, CacheEntry<StrategyAnalysis>>();
  
  private stats: CacheStats = {
    totalEntries: 0,
    totalHits: 0,
    totalMisses: 0,
    memoryUsage: 0,
    hitRate: 0
  };

  constructor() {
    logger.info('AI Cache Manager initialized');
  }

  getCachedGeneration(
    prompt: string,
    currentCode?: string,
    strategyParams?: StrategyParams,
    settings?: AISettings
  ): { thinking?: string, content: string } | null {
    const key = this.createGenerationCacheKey(prompt, currentCode, strategyParams, settings);
    const entry = this.generationCache.get(key);

    if (entry && !this.isExpired(entry)) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.stats.totalHits++;
      this.updateHitRate();
      
      logger.debug('Cache hit for generation key:', key.substring(0, STRING_TRUNCATION.LOG.SHORT));
      return entry.data;
    }

    // Also check short code hash for similar code detection
    const shortCodeHash = this.createHash(currentCode?.substring(0, STRING_TRUNCATION.HASH.STANDARD) || '');
    const shortKey = `short-${shortCodeHash}-${settings?.provider || 'google'}`;
    const shortEntry = this.generationCache.get(shortKey);

    if (shortEntry && !this.isExpired(shortEntry)) {
      shortEntry.accessCount++;
      shortEntry.lastAccessed = Date.now();
      this.stats.totalHits++;
      this.updateHitRate();
      
      logger.debug('Cache hit (short code) for generation');
      return shortEntry.data;
    }

    this.stats.totalMisses++;
    this.updateHitRate();
    return null;
  }

  setCachedGeneration(
    prompt: string,
    data: { thinking?: string, content: string },
    currentCode?: string,
    strategyParams?: StrategyParams,
    settings?: AISettings,
    ttl?: number
  ): void {
    const key = this.createGenerationCacheKey(prompt, currentCode, strategyParams, settings);
    const shortCodeHash = this.createHash(currentCode?.substring(0, STRING_TRUNCATION.HASH.STANDARD) || '');
    const shortKey = `short-${shortCodeHash}-${settings?.provider || 'google'}`;
    
    const size = this.estimateSize(data);
    const entry: CacheEntry<{ thinking?: string, content: string }> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || AI_CONFIG.CACHE.MQL5_GENERATION_TTL,
      accessCount: 0,
      lastAccessed: Date.now(),
      size
    };

    // Check if we need to evict old entries
    if (this.generationCache.size >= AI_CONFIG.CACHE.MAX_MQL5_CACHE_SIZE) {
      this.performEviction('generation');
    }

    this.generationCache.set(key, entry);
    this.generationCache.set(shortKey, entry); // Also cache by short code
    this.updateMemoryStats();
    
    logger.debug('Cached generation with key:', key.substring(0, STRING_TRUNCATION.LOG.SHORT));
  }

  getCachedAnalysis(
    code: string,
    settings?: AISettings
  ): StrategyAnalysis | null {
    const key = this.createAnalysisCacheKey(code, settings);
    const entry = this.analysisCache.get(key);

    if (entry && !this.isExpired(entry)) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.stats.totalHits++;
      this.updateHitRate();
      
      logger.debug('Cache hit for analysis key:', key.substring(0, STRING_TRUNCATION.LOG.SHORT));
      return entry.data;
    }

    // Also check short code hash for similar code detection
    const shortCodeHash = this.createHash(code.substring(0, STRING_TRUNCATION.HASH.STANDARD));
    const shortKey = `short-${shortCodeHash}-${settings?.provider || 'google'}`;
    const shortEntry = this.analysisCache.get(shortKey);

    if (shortEntry && !this.isExpired(shortEntry)) {
      shortEntry.accessCount++;
      shortEntry.lastAccessed = Date.now();
      this.stats.totalHits++;
      this.updateHitRate();
      
      logger.debug('Cache hit (short code) for analysis');
      return shortEntry.data;
    }

    this.stats.totalMisses++;
    this.updateHitRate();
    return null;
  }

  setCachedAnalysis(
    code: string,
    analysis: StrategyAnalysis,
    settings?: AISettings,
    ttl?: number
  ): void {
    const key = this.createAnalysisCacheKey(code, settings);
    const shortCodeHash = this.createHash(code.substring(0, STRING_TRUNCATION.HASH.STANDARD));
    const shortKey = `short-${shortCodeHash}-${settings?.provider || 'google'}`;
    
    const size = this.estimateSize(analysis);
    const entry: CacheEntry<StrategyAnalysis> = {
      data: analysis,
      timestamp: Date.now(),
      ttl: ttl || AI_CONFIG.CACHE.STRATEGY_ANALYSIS_TTL,
      accessCount: 0,
      lastAccessed: Date.now(),
      size
    };

    // Check if we need to evict old entries
    if (this.analysisCache.size >= AI_CONFIG.CACHE.MAX_ANALYSIS_CACHE_SIZE) {
      this.performEviction('analysis');
    }

    this.analysisCache.set(key, entry);
    this.analysisCache.set(shortKey, entry); // Also cache by short code
    this.updateMemoryStats();
    
    logger.debug('Cached analysis with key:', key.substring(0, STRING_TRUNCATION.LOG.SHORT));
  }

  private createGenerationCacheKey(
    prompt: string,
    currentCode?: string,
    strategyParams?: StrategyParams,
    settings?: AISettings
  ): string {
    const components = [
      prompt.substring(0, STRING_TRUNCATION.LOG.LONG),
      currentCode ? currentCode.substring(0, STRING_TRUNCATION.DISPLAY.DESCRIPTION) : 'none',
      JSON.stringify(strategyParams || {}),
      settings?.provider || 'google',
      settings?.modelName || 'default'
    ];
    return this.createHash(components.join('|'));
  }

  private createAnalysisCacheKey(code: string, settings?: AISettings): string {
    const components = [
      this.createHash(code.substring(0, STRING_TRUNCATION.HASH.SHORT)), // First 500 chars
      settings?.provider || 'google',
      settings?.modelName || 'default'
    ];
    return this.createHash(components.join('|'));
  }

  private createHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private performEviction(cacheType: 'generation' | 'analysis'): void {
    if (cacheType === 'generation') {
      // Sort by last accessed time (LRU)
      const entries = Array.from(this.generationCache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

      // Evict oldest 10% of entries
      const evictCount = Math.max(1, Math.floor(entries.length * 0.1));
      
      for (let i = 0; i < evictCount; i++) {
        this.generationCache.delete(entries[i][0]);
      }
    } else {
      // Sort by last accessed time (LRU)
      const entries = Array.from(this.analysisCache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

      // Evict oldest 10% of entries
      const evictCount = Math.max(1, Math.floor(entries.length * 0.1));
      
      for (let i = 0; i < evictCount; i++) {
        this.analysisCache.delete(entries[i][0]);
      }
    }

    this.updateMemoryStats();
    logger.debug(`Evicted entries from ${cacheType} cache`);
  }

  private performCleanup(): void {
    let cleaned = 0;

    // Clean expired generation cache entries
    for (const [key, entry] of this.generationCache.entries()) {
      if (this.isExpired(entry)) {
        this.generationCache.delete(key);
        cleaned++;
      }
    }

    // Clean expired analysis cache entries
    for (const [key, entry] of this.analysisCache.entries()) {
      if (this.isExpired(entry)) {
        this.analysisCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.updateMemoryStats();
      logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  private updateHitRate(): void {
    const total = this.stats.totalHits + this.stats.totalMisses;
    this.stats.hitRate = total > 0 ? this.stats.totalHits / total : 0;
  }

  private updateMemoryStats(): void {
    let totalMemory = 0;
    let totalEntries = 0;

    for (const entry of this.generationCache.values()) {
      totalMemory += entry.size;
      totalEntries++;
    }

    for (const entry of this.analysisCache.values()) {
      totalMemory += entry.size;
      totalEntries++;
    }

    this.stats.memoryUsage = totalMemory;
    this.stats.totalEntries = totalEntries;
  }

  private estimateSize(data: any): number {
    try {
      // Rough estimation of JSON stringified size
      const jsonStr = JSON.stringify(data);
      return jsonStr.length * 2; // UTF-16 characters are typically 2 bytes
    } catch {
      // Fallback estimation
      return 1000; // 1KB default estimate
    }
  }

  // Public methods for cache management
  clearCache(type?: 'generation' | 'analysis'): void {
    if (type === 'generation') {
      this.generationCache.clear();
    } else if (type === 'analysis') {
      this.analysisCache.clear();
    } else {
      this.generationCache.clear();
      this.analysisCache.clear();
    }
    
    this.updateMemoryStats();
    logger.info(`Cleared ${type || 'all'} cache`);
  }

  getStats(): CacheStats {
    this.updateMemoryStats();
    return { ...this.stats };
  }

  // Manual cleanup method
  cleanup(): void {
    this.performCleanup();
  }

  // Cleanup method
  destroy(): void {
    this.generationCache.clear();
    this.analysisCache.clear();
    logger.info('AI Cache Manager destroyed');
  }
}

// Export singleton instance
export const aiCacheManager = new AICacheManager();