/**
 * Advanced API Caching Service for QuantForge AI
 * Provides sophisticated caching strategies for API calls to improve performance
 */

// Import required types for compatibility
type HeadersInit = string[][] | Record<string, string> | Headers;
type BodyInit = Blob | ArrayBuffer | Uint8Array | DataView | FormData | URLSearchParams | ReadableStream | string;
type RequestCache = 'default' | 'force-cache' | 'no-cache' | 'no-store' | 'only-if-cached' | 'reload';
type RequestCredentials = 'include' | 'omit' | 'same-origin';
type RequestRedirect = 'error' | 'follow' | 'manual';
type ReferrerPolicy = '' | 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
type RequestMode = 'cors' | 'navigate' | 'no-cors' | 'same-origin';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
  etag?: string;
}

// Define RequestInit interface for compatibility
interface RequestInit {
  method?: string;
  headers?: HeadersInit | Record<string, string>;
  body?: BodyInit | null;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  integrity?: string;
  keepalive?: boolean;
  signal?: AbortSignal | null;
  mode?: RequestMode;
}



interface CacheConfig {
  defaultTTL: number;        // Default time-to-live in milliseconds
  maxSize: number;           // Maximum number of entries
  compression: boolean;      // Whether to compress cache data
  encryption: boolean;       // Whether to encrypt cache data
  syncAcrossTabs: boolean;   // Whether to sync cache across browser tabs
}

class AdvancedAPICache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly config: CacheConfig;
  private readonly storageKey = 'quantforge-api-cache';
  
  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      defaultTTL: 300000,        // 5 minutes default
      maxSize: 1000,             // 1000 entries max
      compression: true,         // Enable compression
      encryption: false,         // Disable encryption by default
      syncAcrossTabs: true,      // Sync across tabs
      ...config
    };
    
    // Initialize from localStorage if available
    this.loadFromStorage();
    
    // Set up tab sync if enabled
    if (this.config.syncAcrossTabs && typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange);
    }
  }
  
   private handleStorageChange = (event: StorageEvent) => {
     if (event.key === this.storageKey && event.newValue) {
       try {
         const data = JSON.parse(event.newValue);
         this.cache = new Map(data);
       } catch (e) {
         // Log error properly in development
        // console.error('Failed to sync cache from storage:', e);
       }
     }
   };
  
   private saveToStorage(): void {
     if (typeof localStorage !== 'undefined') {
       try {
         localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.cache.entries())));
       } catch (e) {
         // Storage might be full or unavailable, handle gracefully
// Removed for production: console.error('Failed to save cache to storage:', e);
       }
     }
   }
  
   private loadFromStorage(): void {
     if (typeof localStorage !== 'undefined') {
       try {
         const stored = localStorage.getItem(this.storageKey);
         if (stored) {
           const data = JSON.parse(stored);
           this.cache = new Map(data);
         }
       } catch (e) {
// Removed for production: console.error('Failed to load cache from storage:', e);
       }
     }
   }
  
private generateKey(url: string, options?: RequestInit): string {
     // Create a unique key based on URL and request options
     const optionsKey = options ? JSON.stringify({
       method: options.method,
       body: options.body,
       cache: options.cache,
       credentials: options.credentials,
       headers: options.headers
     }) : '';
     const combinedKey = `${url}_${optionsKey}`;
     
     // Simple hash function to create a consistent key
     let hash = 0;
     for (let i = 0; i < combinedKey.length; i++) {
       const char = combinedKey.charCodeAt(i);
       hash = ((hash << 5) - hash) + char;
       hash |= 0; // Convert to 32-bit integer
     }
     
     return Math.abs(hash).toString(36);
   }
  
  private compressData(data: any): any {
    if (!this.config.compression) return data;
    
    // In a real implementation, we would use a compression library
    // For now, we'll just return the data as-is
    return data;
  }
  
  private decompressData(data: any): any {
    if (!this.config.compression) return data;
    
    // In a real implementation, we would decompress the data
    return data;
  }
  
  private encryptData(data: any): any {
    if (!this.config.encryption) return data;
    
    // In a real implementation, we would encrypt the data
    return data;
  }
  
  private decryptData(data: any): any {
    if (!this.config.encryption) return data;
    
    // In a real implementation, we would decrypt the data
    return data;
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
  
  async get<T = any>(key: string): Promise<T | null> {
    this.cleanupExpired();
    
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.saveToStorage();
      return null;
    }
    
    try {
      const decompressed = this.decompressData(entry.data);
      const decrypted = this.decryptData(decompressed);
      return decrypted as T;
    } catch (e) {
// Removed for production: console.warn('Failed to retrieve cached data:', e);
      this.cache.delete(key);
      return null;
    }
  }
  
  async set(key: string, data: any, ttl?: number): Promise<void> {
    this.cleanupExpired();
    
    const entry: CacheEntry = {
      data: this.encryptData(this.compressData(data)),
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTTL
    };
    
    this.cache.set(key, entry);
    this.enforceMaxSize();
    this.saveToStorage();
  }
  
  async delete(key: string): Promise<void> {
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
  
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
  
   // Enhanced fetch with caching
   async cachedFetch<T = unknown>(
     url: string, 
     options?: RequestInit, 
     cacheTTL?: number
   ): Promise<T> {
    const cacheKey = this.generateKey(url, options);
    
    // Try to get from cache first
    const cached = await this.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch from network
    const response = await fetch(url, options as any);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Cache the successful response
    await this.set(cacheKey, data, cacheTTL);
    
    return data;
  }
  
   // Stale-while-revalidate pattern
   async staleWhileRevalidate<T = any>(
     url: string,
     options?: RequestInit,
     cacheTTL?: number
   ): Promise<{ data: T; isStale?: boolean }> {
    const cacheKey = this.generateKey(url, options);
    const ttl = cacheTTL ?? this.config.defaultTTL;
    
    // Get from cache first (even if expired)
    const cached = await this.get<T>(cacheKey);
    let isStale = false;
    
    // Check if cached entry exists but is expired
    const entry = this.cache.get(cacheKey);
    if (entry && Date.now() - entry.timestamp > ttl) {
      isStale = true;
    }
    
    if (cached) {
      // Return stale data while revalidating
      this.revalidate(url, options, cacheKey, ttl).catch(() => {
        // Silently handle revalidation errors in production
      });
      return { data: cached, isStale };
    }
    
    // No cache available, fetch fresh data
    const freshData = await this.cachedFetch<T>(url, options, ttl);
    return { data: freshData };
  }
  
  private async revalidate(
    url: string,
    options: RequestInit | undefined,
    cacheKey: string,
    ttl: number
  ): Promise<void> {
    try {
const response = await fetch(url, options as any);
      if (response.ok) {
        const data = await response.json();
        await this.set(cacheKey, data, ttl);
      }
    } catch (error) {
// Removed for production: console.warn('Revalidation failed:', error);
      // Keep the stale data in cache
    }
  }
  
  // Batch API calls for better performance
  async batchFetch<T = any[]>(
    requests: Array<{ url: string; options?: RequestInit }>,
    cacheTTL?: number
  ): Promise<T[]> {
    const promises = requests.map(req => this.cachedFetch<T>(req.url, req.options ?? undefined, cacheTTL));
    return Promise.all(promises);
  }
  
  // Prefetch URLs for better user experience
  async prefetch(urls: string[], options?: RequestInit): Promise<void> {
    const requests = urls.map(url => {
      const req: { url: string; options?: RequestInit } = { url };
      if (options) {
        req.options = options;
      }
      return req;
    });
    await this.batchFetch(requests);
  }
  
  // Invalidate specific cache entries
  async invalidate(pattern: string): Promise<void> {
    const keys = this.keys();
    const regex = new RegExp(pattern);
    
    for (const key of keys) {
      if (regex.test(key)) {
        await this.delete(key);
      }
    }
  }
  
  // Get cache statistics for monitoring
  getStats(): {
    size: number;
    keys: number;
    hitRate: number;
    estimatedSizeKB: number;
  } {
    // Simple stats calculation
    return {
      size: this.cache.size,
      keys: this.cache.size,
      hitRate: 0, // Would require tracking hits/misses
      estimatedSizeKB: Math.round(JSON.stringify(Array.from(this.cache.entries())).length / 1024)
    };
  }
  
  // Clean up resources
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange);
    }
    this.cache.clear();
  }
}

// Singleton instance
export const advancedAPICache = new AdvancedAPICache({
  defaultTTL: 300000, // 5 minutes
  maxSize: 500,       // 500 entries max
  compression: true
});

export { AdvancedAPICache };