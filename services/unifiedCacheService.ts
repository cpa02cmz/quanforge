import { createScopedLogger } from '../utils/logger';
import { securityManager } from './securityManager';
import { 
  CacheConfig, 
  CacheStrategyConfig, 
  CACHE_CONFIGS, 
  CACHE_STRATEGIES, 
  CACHE_PRIORITIES, 
  CACHE_TAGS, 
  CacheUtils,
  MEMORY_LIMITS,
  DEFAULT_CACHE_CONFIG
} from '../config/cache';

const logger = createScopedLogger('UnifiedCacheService');

// Re-exported interfaces for backward compatibility
export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high' | 'critical';
  compress?: boolean;
  customConfig?: Partial<CacheConfig>;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  compressed: boolean;
  accessCount: number;
  lastAccessed: number;
  size: number;
  originalSize?: number;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  memoryUsage: number;
  entryCount: number;
  compressionRatio: number;
  evictions: number;
  compressionSavings: number;
  memoryPressure: 'low' | 'medium' | 'high' | 'critical';
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  compressions: number;
  decompressions: number;
  validations: number;
  validationFailures: number;
  cleanupRuns: number;
}

/**
 * Unified Cache Service
 * 
 * Consolidates all caching patterns into a single, configurable service
 * with environment-aware optimization and comprehensive monitoring.
 */
export class UnifiedCacheService<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private tagIndex = new Map<string, Set<string>>();
  
  private config: CacheConfig;
  private strategy: CacheStrategyConfig;
  private name: string;
  
  private metrics: CacheMetrics;
  private cleanupInterval: NodeJS.Timeout;
  private accessCounter = 0;
  private isDestroyed = false;
  
  // Compression state management
  private compressionAvailable: boolean = false;

  constructor(name: string, configOrStrategy: string | Partial<CacheConfig> = DEFAULT_CACHE_CONFIG) {
    this.name = name;
    
    // Initialize configuration
    if (typeof configOrStrategy === 'string') {
      this.strategy = CACHE_STRATEGIES[configOrStrategy] || CacheUtils.getStrategyForEnvironment();
      this.config = CacheUtils.getConfigWithOverrides(this.strategy.config);
    } else {
      this.strategy = CacheUtils.getStrategyForEnvironment();
      this.config = CacheUtils.getConfigWithOverrides(DEFAULT_CACHE_CONFIG, configOrStrategy);
    }

    // Initialize metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      compressions: 0,
      decompressions: 0,
      validations: 0,
      validationFailures: 0,
      cleanupRuns: 0
    };

    // Check compression availability lazily
    this.checkCompressionAvailability();
    
    // Start cleanup interval
    this.startCleanup();
    
    logger.info(`Cache service initialized: ${this.name}`, {
      strategy: this.strategy.name,
      maxSize: `${(this.config.maxSize / 1024 / 1024).toFixed(1)}MB`,
      compression: this.strategy.features.compression
    });
  }

  /**
   * Get data from cache with comprehensive security and performance checks
   */
  async get(key: string): Promise<T | null> {
    if (this.isDestroyed) {
      logger.warn(`Attempted to get from destroyed cache: ${this.name}`);
      return null;
    }

    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.metrics.misses++;
        return null;
      }

      // Check TTL expiration
      if (this.isExpired(entry)) {
        this.delete(key);
        this.metrics.misses++;
        return null;
      }

      // Update access tracking
      this.updateAccessTracking(key, entry);

      // Security validation if enabled
      if (this.strategy.features.validation) {
        this.metrics.validations++;
        const validation = securityManager.sanitizeAndValidate(entry.data, 'robot');
        if (!validation.isValid) {
          logger.warn(`Invalid cached data detected for key: ${key}`, validation.errors);
          this.delete(key);
          this.metrics.validationFailures++;
          this.metrics.misses++;
          return null;
        }
      }

      // Decompress if needed
      let data = entry.data;
      if (entry.compressed) {
        data = await this.decompress(entry.data);
        this.metrics.decompressions++;
      }

      this.metrics.hits++;
      return data as T;

    } catch (error) {
      logger.error(`Cache get error for key: ${key}`, error);
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Set data in cache with validation, compression, and size management
   */
  async set(key: string, data: T, options: CacheOptions = {}): Promise<boolean> {
    if (this.isDestroyed) {
      logger.warn(`Attempted to set to destroyed cache: ${this.name}`);
      return false;
    }

    try {
      // Security validation if enabled
      if (this.strategy.features.validation) {
        this.metrics.validations++;
        const validation = securityManager.sanitizeAndValidate(data, 'robot');
        if (!validation.isValid) {
          logger.warn(`Invalid data blocked from cache for key: ${key}`, validation.errors);
          this.metrics.validationFailures++;
          return false;
        }
        data = validation.sanitizedData || data;
      }

      const ttl = options.ttl || this.config.defaultTTL;
      const tags = options.tags || [];
      const priority = options.priority || 'normal';
      
      // Process data (compression)
      const { processedData, compressed, originalSize, finalSize } = await this.processDataForStorage(
        data, 
        options.compress
      );

      const entry: CacheEntry<T> = {
        data: processedData,
        timestamp: Date.now(),
        ttl,
        tags,
        priority,
        compressed,
        accessCount: 1,
        lastAccessed: Date.now(),
        size: finalSize,
        originalSize
      };

      // Ensure capacity before setting
      const capacityEnsured = this.ensureCapacity(entry.size);
      if (!capacityEnsured) {
        logger.warn(`Failed to ensure capacity for cache entry: ${key}`);
        return false;
      }

      // Store entry
      this.cache.set(key, entry);
      this.accessOrder.set(key, ++this.accessCounter);
      
      // Update tag index if supported
      if (this.strategy.features.tagSupport && tags.length > 0) {
        this.updateTagIndex(key, tags);
      }

      this.metrics.sets++;
      return true;

    } catch (error) {
      logger.error(`Cache set error for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Delete cache entry with cleanup
   */
  delete(key: string): boolean {
    if (this.isDestroyed) return false;

    const entry = this.cache.get(key);
    const deleted = this.cache.delete(key);
    this.accessOrder.delete(key);

    if (deleted && entry && entry.tags.length > 0) {
      this.removeTagIndex(key, entry.tags);
    }

    if (deleted) {
      this.metrics.deletes++;
    }
    
    return deleted;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    if (this.isDestroyed) return false;
    
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    if (this.isDestroyed) return;
    
    this.cache.clear();
    this.accessOrder.clear();
    this.tagIndex.clear();
    this.accessCounter = 0;
    
    logger.debug(`Cache cleared: ${this.name}`);
  }

  /**
   * Invalidate entries by tags
   */
  invalidateByTags(tags: string[]): number {
    if (!this.strategy.features.tagSupport || this.isDestroyed) {
      return 0;
    }

    let invalidatedCount = 0;
    const keysToInvalidate = new Set<string>();

    for (const tag of tags) {
      const tagKeys = this.tagIndex.get(tag);
      if (tagKeys) {
        tagKeys.forEach(key => keysToInvalidate.add(key));
      }
    }

    for (const key of keysToInvalidate) {
      if (this.delete(key)) {
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      logger.debug(`Invalidated ${invalidatedCount} entries by tags`, { tags });
    }

    return invalidatedCount;
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (this.metrics.misses / totalRequests) * 100 : 0;
    const memoryUsage = this.getCurrentMemoryUsage();
    const compressionSavings = this.calculateCompressionSavings();
    const memoryPressure = this.getMemoryPressureLevel(memoryUsage);

    return {
      hitRate,
      missRate,
      totalRequests,
      memoryUsage,
      entryCount: this.cache.size,
      compressionRatio: this.metrics.compressions > 0 ? compressionSavings / 100 : 1,
      evictions: this.metrics.evictions,
      compressionSavings,
      memoryPressure
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Preload cache with common data using provided loaders
   */
  async warmCache(loaders: Array<{
    key: string;
    loader: () => Promise<T>;
    options?: CacheOptions;
  }>): Promise<void> {
    if (this.isDestroyed) return;

    logger.info(`Warming cache ${this.name} with ${loaders.length} entries`);
    
    const promises = loaders.map(async ({ key, loader, options }) => {
      try {
        const data = await loader();
        await this.set(key, data, options);
        logger.debug(`Cache warmed for key: ${key}`);
      } catch (error) {
        logger.warn(`Failed to warm cache for key: ${key}`, error);
      }
    });

    await Promise.allSettled(promises);
    logger.info(`Cache warming completed: ${this.name}`);
  }

  /**
   * Force cleanup of expired entries and capacity optimization
   */
  forceCleanup(): number {
    if (this.isDestroyed) return 0;
    
    return this.performCleanup();
  }

  /**
   * Update cache configuration dynamically
   */
  updateConfig(overrides: Partial<CacheConfig>): void {
    this.config = CacheUtils.getConfigWithOverrides(this.config, overrides);
    logger.info(`Cache config updated: ${this.name}`, overrides);
    
    // Perform cleanup with new constraints
    this.performCleanup();
  }

  /**
   * Destroy cache instance and cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.clear();
    logger.info(`Cache destroyed: ${this.name}`);
  }

  // Private helper methods

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private updateAccessTracking(key: string, entry: CacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.accessOrder.set(key, ++this.accessCounter);
  }

  private updateTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  private removeTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      const tagKeys = this.tagIndex.get(tag);
      if (tagKeys) {
        tagKeys.delete(key);
        if (tagKeys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }

  private async processDataForStorage(
    data: T, 
    compressEnabled?: boolean
  ): Promise<{
    processedData: T;
    compressed: boolean;
    originalSize: number;
    finalSize: number;
  }> {
    let processedData = data;
    let compressed = false;
    const originalSize = this.estimateSize(data);

    // Apply compression if enabled and available
    if (
      this.strategy.features.compression && 
      (compressEnabled !== false) && 
      originalSize > this.config.compressionThreshold
    ) {
      try {
        processedData = await this.compress(data);
        compressed = true;
        this.metrics.compressions++;
      } catch (error) {
        logger.warn(`Compression failed for cache entry`, error);
        // Fall back to uncompressed data
      }
    }

    const finalSize = compressed ? this.estimateSize(processedData) : originalSize;

    return { processedData, compressed, originalSize, finalSize };
  }

  private ensureCapacity(newEntrySize: number): boolean {
    // Remove expired entries first
    this.removeExpiredEntries();

    // Check if we need to evict entries
    while (
      this.getCurrentMemoryUsage() + newEntrySize > this.config.maxSize ||
      this.cache.size >= this.config.maxEntries
    ) {
      const evicted = this.evictLeastRecentlyUsed();
      if (!evicted) {
        logger.warn(`Cannot ensure cache capacity - no evictable entries`);
        return false;
      }
    }

    return true;
  }

  private removeExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  private evictLeastRecentlyUsed(): boolean {
    let lruKey: string | null = null;
    let oldestAccess = Date.now();
    let lowestPriority = CACHE_PRIORITIES.CRITICAL;

    // Find LRU entry with lowest priority
    for (const [key, entry] of this.cache.entries()) {
      const entryPriority = CACHE_PRIORITIES[entry.priority.toUpperCase() as keyof typeof CACHE_PRIORITIES];
      
      if (entryPriority < lowestPriority || 
          (entryPriority === lowestPriority && entry.lastAccessed < oldestAccess)) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
        lowestPriority = entryPriority;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
      this.metrics.evictions++;
      logger.debug(`Evicted LRU cache entry: ${lruKey}`);
      return true;
    }

    return false;
  }

  private getCurrentMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private calculateCompressionSavings(): number {
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    for (const entry of this.cache.values()) {
      totalOriginalSize += entry.originalSize || entry.size;
      totalCompressedSize += entry.size;
    }

    return totalOriginalSize > 0 ? ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100 : 0;
  }

  private getMemoryPressureLevel(memoryUsage: number): 'low' | 'medium' | 'high' | 'critical' {
    const usageRatio = memoryUsage / this.config.maxSize;
    
    if (usageRatio >= 0.95) return 'critical';
    if (usageRatio >= 0.8) return 'high';
    if (usageRatio >= 0.6) return 'medium';
    return 'low';
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // UTF-16 approximation
    } catch {
      return 1024; // Default 1KB estimate
    }
  }

  private async compress(data: T): Promise<T> {
    if (!this.compressionAvailable) {
      throw new Error('Compression not available');
    }

    try {
      const lzModule = await import('lz-string');
      const serialized = JSON.stringify(data);
      return lzModule.default.compressToUTF16(serialized) as T;
    } catch (error) {
      this.compressionAvailable = false;
      throw error;
    }
  }

  private async decompress(compressedData: T): Promise<T> {
    if (!this.compressionAvailable) {
      return compressedData;
    }

    try {
      const lzModule = await import('lz-string');
      const decompressed = lzModule.default.decompressFromUTF16(compressedData as string);
      return JSON.parse(decompressed);
    } catch (error) {
      logger.warn('Decompression failed, returning original data', error);
      return compressedData;
    }
  }

  private async checkCompressionAvailability(): Promise<void> {
    try {
      await import('lz-string');
      this.compressionAvailable = true;
    } catch {
      logger.info('Compression library not available');
      this.compressionAvailable = false;
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  private performCleanup(): number {
    this.metrics.cleanupRuns++;
    
    let cleanedCount = 0;
    
    // Remove expired entries
    this.removeExpiredEntries();
    
    // Enforce memory limits
    const memoryUsage = this.getCurrentMemoryUsage();
    if (memoryUsage > this.config.maxSize * 0.8) {
      while (memoryUsage > this.config.maxSize * 0.7) {
        const evicted = this.evictLeastRecentlyUsed();
        if (!evicted) break;
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
}

// Factory for creating and managing cache instances
export class UnifiedCacheFactory {
  private static instances = new Map<string, UnifiedCacheService>();
  private static defaultConfigs = new Map<string, Partial<CacheConfig>>();

  static getInstance(name: string, config?: Partial<CacheConfig>): UnifiedCacheService {
    if (!this.instances.has(name)) {
      const finalConfig = config || this.defaultConfigs.get(name) || {};
      this.instances.set(name, new UnifiedCacheService(name, finalConfig));
    }
    return this.instances.get(name)!;
  }

  static setDefaultConfig(name: string, config: Partial<CacheConfig>): void {
    this.defaultConfigs.set(name, config);
  }

  static destroyInstance(name: string): void {
    const instance = this.instances.get(name);
    if (instance) {
      instance.destroy();
      this.instances.delete(name);
    }
  }

  static destroyAll(): void {
    for (const [name, instance] of this.instances) {
      instance.destroy();
    }
    this.instances.clear();
    this.defaultConfigs.clear();
  }

  static getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, instance] of this.instances) {
      stats[name] = instance.getStats();
    }
    return stats;
  }

  static getAllMetrics(): Record<string, CacheMetrics> {
    const metrics: Record<string, CacheMetrics> = {};
    for (const [name, instance] of this.instances) {
      metrics[name] = instance.getMetrics();
    }
    return metrics;
  }
}

// Pre-configured default cache instances
UnifiedCacheFactory.setDefaultConfig('robots', CACHE_CONFIGS.robots);
UnifiedCacheFactory.setDefaultConfig('marketData', CACHE_CONFIGS.marketData);
UnifiedCacheFactory.setDefaultConfig('analysis', CACHE_CONFIGS.analysis);
UnifiedCacheFactory.setDefaultConfig('users', CACHE_CONFIGS.users);
UnifiedCacheFactory.setDefaultConfig('api', CACHE_CONFIGS.api);
UnifiedCacheFactory.setDefaultConfig('ai', CACHE_CONFIGS.ai);
UnifiedCacheFactory.setDefaultConfig('components', CACHE_CONFIGS.components);

export const robotCache = UnifiedCacheFactory.getInstance('robots');
export const marketDataCache = UnifiedCacheFactory.getInstance('marketData');
export const analysisCache = UnifiedCacheFactory.getInstance('analysis');
export const userCache = UnifiedCacheFactory.getInstance('users');
export const apiCache = UnifiedCacheFactory.getInstance('api');
export const aiCache = UnifiedCacheFactory.getInstance('ai');
export const componentCache = UnifiedCacheFactory.getInstance('components');

// Cleanup on environment unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    UnifiedCacheFactory.destroyAll();
  });
} else if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    UnifiedCacheFactory.destroyAll();
  });
}