/**
 * Request Deduplication Service
 * 
 * Prevents duplicate in-flight API requests by caching promises.
 * When the same request is made multiple times concurrently, only one
 * actual request is sent and all callers receive the same response.
 * 
 * @module services/ai/requestDeduplicator
 */

/**
 * Request deduplication to prevent duplicate API calls
 * 
 * Features:
 * - Deduplicates concurrent requests with the same key
 * - Automatically cleans up after request completion
 * - Provides pending request count for monitoring
 * 
 * @example
 * ```typescript
 * const deduplicator = new RequestDeduplicator();
 * 
 * // Multiple calls with same key will only execute once
 * const result1 = deduplicator.deduplicate('user-123', () => fetchUser('123'));
 * const result2 = deduplicator.deduplicate('user-123', () => fetchUser('123'));
 * // Both promises resolve to the same result
 * ```
 */
export class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<unknown>>();

  /**
   * Execute a function with deduplication
   * If a request with the same key is already in flight, returns the existing promise
   * 
   * @param key - Unique identifier for the request
   * @param requestFn - Function that returns a promise
   * @returns Promise that resolves to the request result
   */
  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // If request is already in flight, return the existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    // Create new request and store the promise
    const promise = requestFn().finally(() => {
      // Clean up after request completes (whether success or failure)
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Clear all pending requests
   * Useful for cleanup during shutdown or error recovery
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get count of pending requests
   */
  get pendingCount(): number {
    return this.pendingRequests.size;
  }
}

/**
 * Global request deduplicator instance
 */
export const requestDeduplicator = new RequestDeduplicator();

export default RequestDeduplicator;
