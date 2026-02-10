/**
 * Request Throttling Service
 * Optimizes API requests and prevents abuse
 * Enhanced for Vercel Edge deployment
 */

import { API_CONFIG, RATE_LIMITING } from '../constants/config';
import { RATE_LIMITS, RETRY_CONFIG } from './constants';

interface RequestConfig {
  url: string;
  options?: RequestInit;
  priority?: 'high' | 'medium' | 'low';
  retryCount?: number;
}

interface QueuedRequest {
  config: RequestConfig;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
  timestamp: number;
  retryCount: number;
}

class RequestThrottler {
  private queue: QueuedRequest[] = [];
  private activeRequests = 0;
  private readonly maxConcurrent = 6;
  private readonly rateLimitDelay = RATE_LIMITS.RATE_LIMIT_DELAY_MS; // ms between requests
  private readonly maxRetries = API_CONFIG.MAX_RETRY_ATTEMPTS;
  private lastRequestTime = 0;
  private requestCounts = new Map<string, number>();
  private readonly windowMs = RATE_LIMITING.DEFAULT_WINDOW; // 1 minute window
  private readonly maxRequestsPerWindow = RATE_LIMITING.DEFAULT_MAX_REQUESTS;

  constructor() {
    // Clean up old request counts periodically
    setInterval(() => this.cleanupRequestCounts(), this.windowMs);
  }

  async request(config: RequestConfig): Promise<Response> {
    // Check rate limits
    if (this.isRateLimited(config.url)) {
      throw new Error('Rate limit exceeded');
    }

    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        config,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: config.retryCount || 0
      };

      this.queue.push(queuedRequest);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Sort by priority and timestamp
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.config.priority || 'medium'];
      const bPriority = priorityOrder[b.config.priority || 'medium'];
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return a.timestamp - b.timestamp;
    });

    const request = this.queue.shift()!;
    this.activeRequests++;

    try {
      // Rate limiting delay
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.rateLimitDelay) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
      }

      this.lastRequestTime = Date.now();
      this.incrementRequestCount(request.config.url);

      const response = await fetch(request.config.url, request.config.options);
      
      if (!response.ok && request.retryCount < this.maxRetries) {
        // Retry with exponential backoff using modular config
        const delay = Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, request.retryCount) * RETRY_CONFIG.BASE_DELAY_MS;
        setTimeout(() => {
          this.activeRequests--;
          request.retryCount++;
          request.timestamp = Date.now();
          this.queue.unshift(request);
          this.processQueue();
        }, delay);
        return;
      }

      request.resolve(response);
    } catch (error) {
      if (request.retryCount < this.maxRetries) {
        // Retry with exponential backoff using modular config
        const delay = Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, request.retryCount) * RETRY_CONFIG.BASE_DELAY_MS;
        setTimeout(() => {
          this.activeRequests--;
          request.retryCount++;
          request.timestamp = Date.now();
          this.queue.unshift(request);
          this.processQueue();
        }, delay);
        return;
      }
      request.reject(error as Error);
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  private isRateLimited(url: string): boolean {
    const count = this.requestCounts.get(url) || 0;
    return count >= this.maxRequestsPerWindow;
  }

  private incrementRequestCount(url: string): void {
    const current = this.requestCounts.get(url) || 0;
    this.requestCounts.set(url, current + 1);
  }

  private cleanupRequestCounts(): void {
    this.requestCounts.clear();
  }

  // Batch multiple requests together
  async batchRequests(requests: RequestConfig[]): Promise<Response[]> {
    const promises = requests.map(config => this.request(config));
    return Promise.all(promises);
  }

  // Get current queue status
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.maxConcurrent,
      requestCounts: Object.fromEntries(this.requestCounts)
    };
  }

  // Clear queue (useful for cleanup)
  clearQueue(): void {
    this.queue.forEach(request => {
      request.reject(new Error('Request cancelled due to queue clear'));
    });
    this.queue = [];
  }
}

export const requestThrottler = new RequestThrottler();

// Export convenience functions for common use cases
export const throttledFetch = (url: string, options?: RequestInit, priority?: 'high' | 'medium' | 'low') => 
  requestThrottler.request({ url, options, priority });

export const batchFetch = (requests: Array<{ url: string; options?: RequestInit; priority?: 'high' | 'medium' | 'low' }>) =>
  requestThrottler.batchRequests(requests);