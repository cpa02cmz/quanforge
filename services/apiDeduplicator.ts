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

  constructor() {
    // Clean up expired requests every 10 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRequests();
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
   * Generate a cache key from parameters
   */
  static generateKey(endpoint: string, params?: Record<string, any>): string {
    if (!params) return endpoint;
    
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    
    return `${endpoint}?${sortedParams}`;
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
      if (now - request.timestamp > this.maxAge) {
        expiredKeys.push('');
        request.reject(new Error('Request expired'));
      }
    });
    this.pendingRequests.clear();
    logger.info(`Cancelled ${count} pending requests`);
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
    getPendingCount: apiDeduplicator.getPendingCount.bind(apiDeduplicator),
    generateKey: ApiDeduplicator.generateKey
  };
};