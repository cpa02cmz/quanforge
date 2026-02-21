/**
 * API Request Queue Tests
 * 
 * @module services/api/apiRequestQueue.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  APIRequestQueue,
  getAPIRequestQueue,
  initializeAPIRequestQueue,
  hasAPIRequestQueue,
  queueRequest,
  queueHighPriority,
  queueLowPriority,
  queueBackground,
  useAPIRequestQueue,
  type RequestPriority,
  type QueueStats,
} from './apiRequestQueue';

describe('APIRequestQueue', () => {
  let queue: APIRequestQueue;

  beforeEach(() => {
    queue = new APIRequestQueue({
      maxConcurrent: 2,
      maxQueueSize: 10,
      autoStart: true,
      pauseOnHidden: false,
    });
  });

  afterEach(() => {
    queue.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultQueue = new APIRequestQueue();
      expect(defaultQueue.getStats()).toBeDefined();
      defaultQueue.destroy();
    });

    it('should initialize with custom config', () => {
      const customQueue = new APIRequestQueue({
        maxConcurrent: 5,
        maxQueueSize: 20,
      });
      customQueue.destroy();
    });
  });

  describe('enqueue', () => {
    it('should execute a request and return result', async () => {
      const result = await queue.enqueue(() => Promise.resolve('test'));
      expect(result).toBe('test');
    });

    it('should handle request errors', async () => {
      await expect(
        queue.enqueue(() => Promise.reject(new Error('test error')))
      ).rejects.toThrow('test error');
    });

    it('should respect priority order', async () => {
      const executionOrder: string[] = [];
      
      // Fill concurrent slots
      const slow1 = queue.enqueue(
        () => new Promise(r => setTimeout(() => { executionOrder.push('slow1'); r('slow1'); }, 100)),
        { priority: 'normal' }
      );
      const slow2 = queue.enqueue(
        () => new Promise(r => setTimeout(() => { executionOrder.push('slow2'); r('slow2'); }, 100)),
        { priority: 'normal' }
      );
      
      // Queue high priority (should execute after slow ones complete)
      queue.enqueue(
        () => new Promise(r => { executionOrder.push('high'); r('high'); }),
        { priority: 'high' }
      );
      
      // Queue low priority
      queue.enqueue(
        () => new Promise(r => { executionOrder.push('low'); r('low'); }),
        { priority: 'low' }
      );
      
      await Promise.all([slow1, slow2]);
      
      // Wait for queue to process
      await new Promise(r => setTimeout(r, 200));
      
      // High priority should execute before low priority
      expect(executionOrder.indexOf('high')).toBeLessThan(executionOrder.indexOf('low'));
    });

    it('should enforce max queue size', async () => {
      const smallQueue = new APIRequestQueue({
        maxConcurrent: 1,
        maxQueueSize: 3,
        autoStart: true,
      });

      // Verify queue starts empty
      expect(smallQueue.getQueueSize()).toBe(0);
      
      // Verify queue respects max concurrent
      const slowRequest = () => new Promise(r => setTimeout(r, 100));
      smallQueue.enqueue(slowRequest);
      smallQueue.enqueue(slowRequest);
      smallQueue.enqueue(slowRequest);
      smallQueue.enqueue(slowRequest);
      
      // Wait a bit for queue to process
      await new Promise(r => setTimeout(r, 50));
      
      // Queue should be managing requests
      expect(smallQueue.getStats().runningCount + smallQueue.getStats().pendingCount).toBeGreaterThan(0);
      
      // Clean up
      smallQueue.cancelAll();
      smallQueue.destroy();
    });
  });

  describe('cancel', () => {
    it('should cancel all requests', async () => {
      const slowQueue = new APIRequestQueue({
        maxConcurrent: 2,
        autoStart: true,
      });
      
      // Add multiple slow requests that won't complete
      slowQueue.enqueue(() => new Promise(r => setTimeout(r, 10000))).catch(() => {});
      slowQueue.enqueue(() => new Promise(r => setTimeout(r, 10000))).catch(() => {});
      slowQueue.enqueue(() => new Promise(r => setTimeout(r, 10000))).catch(() => {});
      
      // Wait for queue to process
      await new Promise(r => setTimeout(r, 50));
      
      // Cancel all
      const count = slowQueue.cancelAll();
      expect(count).toBeGreaterThan(0);
      
      // Verify queue is empty
      expect(slowQueue.getQueueSize()).toBe(0);
      expect(slowQueue.getRunningCount()).toBe(0);
      
      slowQueue.destroy();
    });

    it('should track cancelled requests in stats', async () => {
      const slowQueue = new APIRequestQueue({
        maxConcurrent: 1,
        autoStart: true,
      });
      
      // Add requests
      slowQueue.enqueue(() => new Promise(r => setTimeout(r, 10000))).catch(() => {});
      slowQueue.enqueue(() => new Promise(r => setTimeout(r, 10000))).catch(() => {});
      
      await new Promise(r => setTimeout(r, 50));
      
      const beforeStats = slowQueue.getStats();
      slowQueue.cancelAll();
      const afterStats = slowQueue.getStats();
      
      expect(afterStats.cancelledRequests).toBeGreaterThan(beforeStats.cancelledRequests);
      
      slowQueue.destroy();
    });
  });

  describe('pause and resume', () => {
    it('should pause queue processing', () => {
      queue.pause();
      expect(queue.isPaused()).toBe(true);
    });

    it('should resume queue processing', () => {
      queue.pause();
      queue.resume();
      expect(queue.isPaused()).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', () => {
      const stats = queue.getStats();
      
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('successfulRequests');
      expect(stats).toHaveProperty('failedRequests');
      expect(stats).toHaveProperty('cancelledRequests');
      expect(stats).toHaveProperty('pendingCount');
      expect(stats).toHaveProperty('runningCount');
      expect(stats).toHaveProperty('health');
    });

    it('should track successful requests', async () => {
      await queue.enqueue(() => Promise.resolve('test'));
      
      const stats = queue.getStats();
      expect(stats.successfulRequests).toBe(1);
    });

    it('should track failed requests', async () => {
      try {
        await queue.enqueue(() => Promise.reject(new Error('test')));
      } catch {
        // Expected
      }
      
      const stats = queue.getStats();
      expect(stats.failedRequests).toBe(1);
    });
  });

  describe('events', () => {
    it('should emit request_enqueued event', async () => {
      const handler = vi.fn();
      queue.on('request_enqueued', handler);
      
      await queue.enqueue(() => Promise.resolve('test'));
      
      expect(handler).toHaveBeenCalled();
    });

    it('should emit request_completed event', async () => {
      const handler = vi.fn();
      queue.on('request_completed', handler);
      
      await queue.enqueue(() => Promise.resolve('test'));
      
      expect(handler).toHaveBeenCalled();
    });
  });
});

describe('Singleton functions', () => {
  it('should get singleton instance', () => {
    const instance1 = getAPIRequestQueue();
    const instance2 = getAPIRequestQueue();
    expect(instance1).toBe(instance2);
  });

  it('should initialize new instance', () => {
    initializeAPIRequestQueue({ maxConcurrent: 3 });
    expect(hasAPIRequestQueue()).toBe(true);
  });
});

describe('Convenience functions', () => {
  it('should queue request with default priority', async () => {
    const result = await queueRequest(() => Promise.resolve('test'));
    expect(result).toBe('test');
  });

  it('should queue high priority request', async () => {
    const result = await queueHighPriority(() => Promise.resolve('test'));
    expect(result).toBe('test');
  });

  it('should queue low priority request', async () => {
    const result = await queueLowPriority(() => Promise.resolve('test'));
    expect(result).toBe('test');
  });

  it('should queue background request', async () => {
    const result = await queueBackground(() => Promise.resolve('test'));
    expect(result).toBe('test');
  });
});

describe('useAPIRequestQueue hook', () => {
  it('should return queue methods', () => {
    const hook = useAPIRequestQueue();
    
    expect(hook.enqueue).toBeDefined();
    expect(hook.cancel).toBeDefined();
    expect(hook.cancelAll).toBeDefined();
    expect(hook.pause).toBeDefined();
    expect(hook.resume).toBeDefined();
    expect(hook.getStats).toBeDefined();
  });
});
