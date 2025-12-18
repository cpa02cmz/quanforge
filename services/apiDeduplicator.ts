import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('ApiDeduplicator');

interface PendingRequest<T = any> {
  promise: Promise<T>;
  timestamp: number;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
}

export class ApiDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly maxAge = 30000; // 30 seconds max age for pending requests
  private cleanupInterval: NodeJS.Timeout;
  private requestCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly maxCacheSize = 100;

  constructor() {
    // Clean up expired requests every 10 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRequests();
      this.cleanupExpiredCache();
    }, 10000);
  }

  /**
   * Deduplicate API requests with the same key
   * If a request with the same key is already pending, return the existing promise
   * Otherwise, execute the request function and cache the promise
   */
  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if there's already a pending request for this key
    const existingRequest = this.pendingRequests.get(key);
    
    if (existingRequest) {
      const age = Date.now() - existingRequest.timestamp;
      if (age < this.maxAge) {
        logger.debug(`Deduplicating request for key: ${key}`);
        return existingRequest.promise;
      } else {
        // Remove expired request
        this.pendingRequests.delete(key);
      }
    }

    // Create new request
    let resolve: (value: T) => void;
    let reject: (reason: any) => void;
    
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // Store the pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
      resolve: resolve!,
      reject: reject!
    });

    try {
      logger.debug(`Executing new request for key: ${key}`);
      const result = await requestFn();
      resolve!(result);
      return result;
    } catch (error) {
      logger.error(`Request failed for key: ${key}`, error);
      reject!(error);
      throw error;
    } finally {
      // Clean up the request after completion
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Generate a cache key from parameters with improved hashing for complex objects
   */
  static generateKey(endpoint: string, params?: Record<string, any>): string {
    if (!params) return endpoint;
    
    // Create a deterministic string from parameters
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => {
        const value = params[key];
        // Handle different data types for more accurate key generation
        if (value === null || value === undefined) {
          return `${key}:null`;
        } else if (typeof value === 'object') {
          // For objects, create a consistent string representation
          return `${key}:${JSON.stringify(value, Object.keys(value).sort())}`;
        } else {
          return `${key}:${String(value)}`;
        }
      })
      .join('|');
    
    return `${endpoint}?${sortedParams}`;
  }

  /**
   * Generate a cache key with deep object hashing for complex structures
   */
  static generateDeepKey(endpoint: string, params?: any): string {
    if (!params) return endpoint;
    
    // For complex nested objects, use a more sophisticated hashing approach
    const jsonString = JSON.stringify(params, (_key, val) => {
      if (val instanceof RegExp) return `__REGEXP ${val.toString()}`;
      if (typeof val === 'function') return `__FUNCTION ${val.name || 'anonymous'}`;
      if (val instanceof Date) return `__DATE ${val.toISOString()}`;
      if (val instanceof Map) return `__MAP ${JSON.stringify(Array.from(val.entries()))}`;
      if (val instanceof Set) return `__SET ${JSON.stringify(Array.from(val))}`;
      return val;
    }, 0); // No indentation to reduce string length
    
    // Generate a simple hash of the string
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    
    return `${endpoint}#${hash >>> 0}`; // Convert to unsigned 32-bit integer
  }

  /**
   * Check if a request is currently pending
   */
  isPending(key: string): boolean {
    const request = this.pendingRequests.get(key);
    if (!request) return false;
    
    const age = Date.now() - request.timestamp;
    return age < this.maxAge;
  }

  /**
   * Get the number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Enhanced deduplication with response caching
   */
  async deduplicateWithCache<T>(
    key: string, 
    requestFn: () => Promise<T>, 
    cacheTTL: number = 300000 // 5 minutes default TTL
  ): Promise<T> {
    // Check cache first
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      logger.debug(`Cache hit for key: ${key}`);
      return cached.data;
    }

    // Check if there's already a pending request for this key
    const existingRequest = this.pendingRequests.get(key);
    
    if (existingRequest) {
      const age = Date.now() - existingRequest.timestamp;
      if (age < this.maxAge) {
        logger.debug(`Deduplicating request for key: ${key}`);
        return existingRequest.promise;
      } else {
        // Remove expired request
        this.pendingRequests.delete(key);
      }
    }

    // Create new request
    let resolve: (value: T) => void;
    let reject: (reason: any) => void;
    
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // Store the pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
      resolve: resolve!,
      reject: reject!
    });

    try {
      logger.debug(`Executing new request for key: ${key}`);
      const result = await requestFn();
      resolve!(result);
      
      // Cache the result
      this.setCache(key, result, cacheTTL);
      
      return result;
    } catch (error) {
      logger.error(`Request failed for key: ${key}`, error);
      reject!(error);
      throw error;
    } finally {
      // Clean up the request after completion
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Set cache entry with size management
   */
  private setCache(key: string, data: any, ttl: number): void {
    // Remove oldest entries if cache is full
    if (this.requestCache.size >= this.maxCacheSize) {
      const oldestKey = this.requestCache.keys().next().value;
      if (oldestKey) {
        this.requestCache.delete(oldestKey);
      }
    }
    
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.requestCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.requestCache.delete(key);
      }
    }
  }

  /**
   * Get all pending request keys
   */
  getPendingKeys(): string[] {
    return Array.from(this.pendingRequests.keys());
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(key: string): boolean {
    const request = this.pendingRequests.get(key);
    if (request) {
      request.reject(new Error('Request cancelled'));
      this.pendingRequests.delete(key);
      logger.info(`Cancelled request for key: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    const count = this.pendingRequests.size;
    this.pendingRequests.forEach((request) => {
      request.reject(new Error('All requests cancelled'));
    });
    this.pendingRequests.clear();
    logger.info(`Cancelled ${count} pending requests`);
  }

  /**
   * Cancel pending requests by pattern matching
   */
  cancelRequestsByPattern(pattern: string): number {
    let cancelledCount = 0;
    const keysToCancel: string[] = [];

    this.pendingRequests.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToCancel.push(key);
      }
    });

    keysToCancel.forEach(key => {
      const request = this.pendingRequests.get(key);
      if (request) {
        request.reject(new Error(`Request cancelled by pattern: ${pattern}`));
      }
      this.pendingRequests.delete(key);
      cancelledCount++;
    });

    logger.info(`Cancelled ${cancelledCount} requests matching pattern: ${pattern}`);
    return cancelledCount;
  }

  /**
   * Clean up expired requests
   */
  private cleanupExpiredRequests(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > this.maxAge) {
        expiredKeys.push(key);
        request.reject(new Error('Request expired'));
      }
    });
    
    expiredKeys.forEach((key) => {
      this.pendingRequests.delete(key);
    });
    
    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned up ${expiredKeys.length} expired requests`);
    }
  }

  /**
   * Destroy the deduplicator and clean up resources
   */
  destroy(): void {
    this.cancelAllRequests();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global instance for application-wide deduplication
export const apiDeduplicator = new ApiDeduplicator();

// Hook for React components to use the deduplicator
export const useApiDeduplicator = () => {
  return {
    deduplicate: apiDeduplicator.deduplicate.bind(apiDeduplicator),
    isPending: apiDeduplicator.isPending.bind(apiDeduplicator),
    cancelRequest: apiDeduplicator.cancelRequest.bind(apiDeduplicator),
    cancelRequestsByPattern: apiDeduplicator.cancelRequestsByPattern.bind(apiDeduplicator),
    getPendingCount: apiDeduplicator.getPendingCount.bind(apiDeduplicator),
    generateKey: ApiDeduplicator.generateKey,
    generateDeepKey: ApiDeduplicator.generateDeepKey
  };
};