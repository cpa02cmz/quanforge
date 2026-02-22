/**
 * Message Queue Module
 * 
 * Provides comprehensive message queue capabilities:
 * - Message Queue: Asynchronous message processing
 * - Multiple queue types (FIFO, priority, delayed, dead-letter)
 * - Message deduplication
 * - Retry strategies with backoff
 * - Consumer management with concurrency control
 * - Event-driven monitoring
 * 
 * @module services/queue
 * @author Backend Engineer
 */

// Types
export type {
  MessageStatus,
  MessagePriority,
  QueueType,
  MessageHandler,
  MessageContext,
  MessageResult,
  QueueMessage,
  QueueConfig,
  ConsumerConfig,
  RegisteredConsumer,
  QueueStats,
  MessageQueueStats,
  QueueEvent,
  QueueEventListener,
  PublishOptions,
} from './types';

// Enums and Constants
export {
  QueueEventType,
  DEFAULT_QUEUE_CONFIG,
  DEFAULT_CONSUMER_CONFIG,
} from './types';

// Message Queue
export {
  MessageQueue,
  messageQueue,
  createQueue,
  publish,
  consume,
} from './messageQueue';

// Import for use in functions
import { messageQueue as queueInstance } from './messageQueue';
import type { MessageQueueStats } from './types';

/**
 * Initialize the message queue
 */
export function initializeMessageQueue(): void {
  queueInstance.start();
}

/**
 * Get message queue health status
 */
export function getMessageQueueHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  stats: MessageQueueStats;
} {
  const stats = queueInstance.getStats();
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  const failedRate = stats.totalMessages > 0 
    ? stats.queueStats.reduce((sum, q) => sum + q.failedMessages, 0) / stats.totalMessages 
    : 0;
  
  if (failedRate > 0.5 || stats.activeConsumers === 0) {
    status = 'unhealthy';
  } else if (failedRate > 0.1 || stats.activeQueues < stats.totalQueues * 0.5) {
    status = 'degraded';
  }
  
  return { status, stats };
}
