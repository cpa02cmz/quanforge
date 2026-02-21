/**
 * API Request Deduplicator Service
 * Prevents duplicate concurrent requests by coalescing identical requests
 * 
 * @module services/api/apiRequestDeduplicator
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../../constants/config';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('APIRequestDeduplicator');

/**
 * Request fingerprint for deduplication
 */
export interface RequestFingerprint {
  url: string;
  method: string;
  bodyHash?: string;
  headersHash?: string;
}

/**
 * Pending request entry
 */
interface PendingRequest<T = unknown> {
  fingerprint: string;
  promise: Promise<T>;
  timestamp: number;
  subscribers: number;
  abortController?: AbortController;
}

/**
 * Deduplication configuration
 */
export interface DeduplicationConfig {
  enabled?: boolean;
  ttl?: number; // Time to wait before considering a request stale
  maxPending?: number; // Maximum pending requests to track
  hashBody?: boolean; // Include body in fingerprint
  hashHeaders?: boolean; // Include headers in fingerprint
  ignoredHeaders?: string[]; // Headers to ignore in fingerprint
}

/**
 * Deduplication statistics
 */
export interface DeduplicationStats {
  totalRequests: number;
  deduplicatedRequests: number;
  uniqueRequests: number;
  pendingRequests: number;
  hitRate: number;
  averageWaitTime: number;
  maxWaitTime: number;
}

/**
 * API Request Deduplicator Service
 * 
 * Features:
 * - Request coalescing for identical concurrent requests
 * - Configurable fingerprinting (URL, method, body, headers)
 * - TTL-based stale request handling
 * - Abort controller support
 * - Statistics tracking
 * - Memory management
 */
export class APIRequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private config: Required<DeduplicationConfig>;
  private cleanupInterval: ReturnType<typeof setInterval>;
  
  // Statistics
  private stats = {
    totalRequests: 0,
    deduplicatedRequests: 0,
    uniqueRequests: 0,
    totalWaitTime: 0,
    maxWaitTime: 0
  };

  constructor(config?: DeduplicationConfig) {
    this.config = {
      enabled: config?.enabled ?? true,
      ttl: config?.ttl ?? 30000, // 30 seconds
      maxPending: config?.maxPending ?? 100,
      hashBody: config?.hashBody ?? true,
      hashHeaders: config?.hashHeaders ?? false,
      ignoredHeaders: config?.ignoredHeaders ?? ['authorization', 'x-request-id', 'x-trace-id']
    };

    // Cleanup stale requests periodically
    this.cleanupInterval = setInterval(
      () => this.cleanupStaleRequests(),
      TIME_CONSTANTS.MINUTE
    );

    // Register with cleanup coordinator
    if (typeof window !== 'undefined') {
      serviceCleanupCoordinator.register('apiRequestDeduplicator', {
        cleanup: () => this.destroy(),
        priority: 'high',
        description: 'API request deduplicator service'
      });
    }
  }

  /**
   * Execute a request with deduplication
   * If an identical request is already in progress, returns the existing promise
   */
  async execute<T>(
    request: () => Promise<T>,
    fingerprint: RequestFingerprint,
    options?: {
      skipDeduplication?: boolean;
      abortSignal?: AbortSignal;
    }
  ): Promise<T> {
    this.stats.totalRequests++;

    if (!this.config.enabled || options?.skipDeduplication) {
      return request();
    }

    const key = this.createFingerprint(fingerprint);
    const existing = this.pendingRequests.get(key);

    // Check for existing pending request
    if (existing) {
      // Check if request is stale
      if (Date.now() - existing.timestamp > this.config.ttl) {
        this.pendingRequests.delete(key);
      } else {
        this.stats.deduplicatedRequests++;
        logger.debug(`Deduplicating request: ${fingerprint.method} ${fingerprint.url}`);
        
        existing.subscribers++;
        try {
          const result = await existing.promise;
          return result as T;
        } finally {
          existing.subscribers--;
        }
      }
    }

    // Create new pending request
    this.stats.uniqueRequests++;
    const startTime = Date.now();
    
    // Create abort controller for this request (not passed from outside)
    const abortController = new AbortController();

    const promise = request().finally(() => {
      const waitTime = Date.now() - startTime;
      this.stats.totalWaitTime += waitTime;
      this.stats.maxWaitTime = Math.max(this.stats.maxWaitTime, waitTime);
      
      // Remove from pending after completion
      const pending = this.pendingRequests.get(key);
      if (pending && pending.promise === promise) {
        this.pendingRequests.delete(key);
      }
    });

    // Store pending request
    const pendingRequest: PendingRequest<T> = {
      fingerprint: key,
      promise,
      timestamp: Date.now(),
      subscribers: 1,
      abortController
    };

    // Enforce max pending limit
    if (this.pendingRequests.size >= this.config.maxPending) {
      this.evictOldest();
    }

    this.pendingRequests.set(key, pendingRequest);

    return promise;
  }

  /**
   * Wrap a fetch function with deduplication
   */
  wrapFetch(
    originalFetch: typeof fetch = fetch
  ): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : 
        input instanceof URL ? input.href :
        input instanceof Request ? input.url : String(input);

      const method = init?.method ?? 'GET';

      // Only deduplicate GET requests by default (safe methods)
      if (method !== 'GET' && method !== 'HEAD') {
        return originalFetch(input, init);
      }

      const fingerprint: RequestFingerprint = {
        url,
        method,
        bodyHash: this.config.hashBody && init?.body 
          ? await this.hashBody(init.body)
          : undefined,
        headersHash: this.config.hashHeaders && init?.headers
          ? this.hashHeaders(init.headers)
          : undefined
      };

      return this.execute(
        () => originalFetch(input, init),
        fingerprint,
        { abortSignal: init?.signal ?? undefined }
      );
    };
  }

  /**
   * Check if a request is currently pending
   */
  isPending(fingerprint: RequestFingerprint): boolean {
    const key = this.createFingerprint(fingerprint);
    const pending = this.pendingRequests.get(key);
    
    if (!pending) return false;
    
    // Check if stale
    if (Date.now() - pending.timestamp > this.config.ttl) {
      this.pendingRequests.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Cancel a pending request
   */
  cancel(fingerprint: RequestFingerprint): boolean {
    const key = this.createFingerprint(fingerprint);
    const pending = this.pendingRequests.get(key);
    
    if (!pending) return false;
    
    if (pending.abortController) {
      pending.abortController.abort();
    }
    
    this.pendingRequests.delete(key);
    logger.debug(`Cancelled pending request: ${fingerprint.method} ${fingerprint.url}`);
    return true;
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): number {
    let count = 0;
    
    for (const pending of this.pendingRequests.values()) {
      if (pending.abortController) {
        pending.abortController.abort();
      }
      count++;
    }
    
    this.pendingRequests.clear();
    logger.info(`Cancelled ${count} pending requests`);
    return count;
  }

  /**
   * Get pending request count
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get statistics
   */
  getStats(): DeduplicationStats {
    const hitRate = this.stats.totalRequests > 0
      ? this.stats.deduplicatedRequests / this.stats.totalRequests
      : 0;

    const avgWaitTime = this.stats.uniqueRequests > 0
      ? this.stats.totalWaitTime / this.stats.uniqueRequests
      : 0;

    return {
      totalRequests: this.stats.totalRequests,
      deduplicatedRequests: this.stats.deduplicatedRequests,
      uniqueRequests: this.stats.uniqueRequests,
      pendingRequests: this.pendingRequests.size,
      hitRate,
      averageWaitTime: avgWaitTime,
      maxWaitTime: this.stats.maxWaitTime
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Deduplicator config updated', config);
  }

  /**
   * Clear all pending requests and reset statistics
   */
  reset(): void {
    this.cancelAll();
    this.stats = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      uniqueRequests: 0,
      totalWaitTime: 0,
      maxWaitTime: 0
    };
  }

  // Private methods

  private createFingerprint(fingerprint: RequestFingerprint): string {
    const parts = [
      fingerprint.method.toUpperCase(),
      fingerprint.url
    ];

    if (fingerprint.bodyHash) {
      parts.push(`body:${fingerprint.bodyHash}`);
    }

    if (fingerprint.headersHash) {
      parts.push(`headers:${fingerprint.headersHash}`);
    }

    return parts.join('|');
  }

  private async hashBody(body: BodyInit): Promise<string> {
    try {
      let content: string;
      
      if (typeof body === 'string') {
        content = body;
      } else if (body instanceof ArrayBuffer) {
        content = String.fromCharCode(...new Uint8Array(body));
      } else if (body instanceof Blob) {
        content = await body.text();
      } else if (body instanceof FormData) {
        content = JSON.stringify(Object.fromEntries(body));
      } else {
        content = String(body);
      }

      // Simple hash function (djb2)
      let hash = 5381;
      for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) + hash) + content.charCodeAt(i);
      }
      return hash.toString(16);
    } catch {
      return 'unknown';
    }
  }

  private hashHeaders(headers: HeadersInit): string {
    try {
      const headerMap = new Map<string, string>();
      
      if (headers instanceof Headers) {
        headers.forEach((value, key) => {
          if (!this.config.ignoredHeaders.includes(key.toLowerCase())) {
            headerMap.set(key.toLowerCase(), value);
          }
        });
      } else if (Array.isArray(headers)) {
        for (const [key, value] of headers) {
          if (!this.config.ignoredHeaders.includes(key.toLowerCase())) {
            headerMap.set(key.toLowerCase(), value);
          }
        }
      } else {
        for (const [key, value] of Object.entries(headers)) {
          if (!this.config.ignoredHeaders.includes(key.toLowerCase())) {
            headerMap.set(key.toLowerCase(), String(value));
          }
        }
      }

      // Sort and stringify
      const sorted = Array.from(headerMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      return JSON.stringify(sorted);
    } catch {
      return 'unknown';
    }
  }

  private cleanupStaleRequests(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, pending] of this.pendingRequests.entries()) {
      if (now - pending.timestamp > this.config.ttl) {
        this.pendingRequests.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} stale requests`);
    }
  }

  private evictOldest(): void {
    let oldest: { key: string; timestamp: number } | null = null;

    for (const [key, pending] of this.pendingRequests.entries()) {
      if (!oldest || pending.timestamp < oldest.timestamp) {
        oldest = { key, timestamp: pending.timestamp };
      }
    }

    if (oldest) {
      const pending = this.pendingRequests.get(oldest.key);
      if (pending?.abortController) {
        pending.abortController.abort();
      }
      this.pendingRequests.delete(oldest.key);
      logger.debug('Evicted oldest pending request');
    }
  }

  /**
   * Destroy the deduplicator and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cancelAll();
    logger.info('API Request Deduplicator destroyed');
  }
}

// Create singleton instance
export const apiRequestDeduplicator = new APIRequestDeduplicator();

// React hook for deduplication
export const useAPIRequestDeduplicator = () => ({
  execute: <T>(
    request: () => Promise<T>,
    fingerprint: RequestFingerprint,
    options?: { skipDeduplication?: boolean; abortSignal?: AbortSignal }
  ) => apiRequestDeduplicator.execute(request, fingerprint, options),
  
  wrapFetch: (originalFetch?: typeof fetch) =>
    apiRequestDeduplicator.wrapFetch(originalFetch),
  
  isPending: (fingerprint: RequestFingerprint) =>
    apiRequestDeduplicator.isPending(fingerprint),
  
  cancel: (fingerprint: RequestFingerprint) =>
    apiRequestDeduplicator.cancel(fingerprint),
  
  cancelAll: () => apiRequestDeduplicator.cancelAll(),
  
  getPendingCount: () => apiRequestDeduplicator.getPendingCount(),
  
  getStats: () => apiRequestDeduplicator.getStats(),
  
  updateConfig: (config: Partial<DeduplicationConfig>) =>
    apiRequestDeduplicator.updateConfig(config),
  
  reset: () => apiRequestDeduplicator.reset()
});
