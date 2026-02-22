/**
 * Message Queue Service
 * 
 * Comprehensive message queue system for asynchronous processing:
 * - Multiple queue types (FIFO, priority, delayed, dead-letter)
 * - Message deduplication
 * - Retry strategies with backoff
 * - Consumer management with concurrency control
 * - Event-driven monitoring
 * - Message expiration and TTL
 * 
 * @module services/queue/messageQueue
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../utils/logger';
import {
  MessagePriority,
  MessageHandler,
  QueueMessage,
  QueueConfig,
  ConsumerConfig,
  RegisteredConsumer,
  QueueStats,
  MessageQueueStats,
  QueueEvent,
  QueueEventType,
  QueueEventListener,
  MessageContext,
  PublishOptions,
  DEFAULT_QUEUE_CONFIG,
  DEFAULT_CONSUMER_CONFIG,
} from './types';

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate unique consumer ID
 */
function generateConsumerId(): string {
  return `consumer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Get priority weight for message ordering
 */
function getPriorityWeight(priority: MessagePriority): number {
  const weights: Record<MessagePriority, number> = {
    critical: 100,
    high: 75,
    normal: 50,
    low: 25,
  };
  return weights[priority] || 50;
}

/**
 * Message Queue Service
 * 
 * Manages message queues and asynchronous processing
 */
export class MessageQueue {
  private static instance: MessageQueue | null = null;
  private logger = createScopedLogger('MessageQueue');
  private queues: Map<string, { config: QueueConfig; messages: QueueMessage[] }> = new Map();
  private consumers: Map<string, RegisteredConsumer> = new Map();
  private processing: Map<string, QueueMessage> = new Map();
  private eventListeners: Map<QueueEventType, Set<QueueEventListener>> = new Map();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private started = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MessageQueue {
    if (!MessageQueue.instance) {
      MessageQueue.instance = new MessageQueue();
    }
    return MessageQueue.instance;
  }

  /**
   * Create a new queue
   */
  createQueue(config: QueueConfig): boolean {
    if (this.queues.has(config.name)) {
      this.logger.warn(`Queue ${config.name} already exists`);
      return false;
    }

    const queueConfig: QueueConfig = {
      ...DEFAULT_QUEUE_CONFIG,
      ...config,
    };

    this.queues.set(config.name, {
      config: queueConfig,
      messages: [],
    });

    // Create dead letter queue if specified
    if (queueConfig.deadLetterQueue && !this.queues.has(queueConfig.deadLetterQueue)) {
      this.createQueue({
        name: queueConfig.deadLetterQueue,
        type: 'dead_letter',
      });
    }

    this.emitEvent({
      type: QueueEventType.QUEUE_CREATED,
      queueName: config.name,
      timestamp: Date.now(),
      data: { config: queueConfig },
    });

    this.logger.log(`Queue created: ${config.name}`, { type: queueConfig.type });
    return true;
  }

  /**
   * Delete a queue
   */
  deleteQueue(queueName: string): boolean {
    const queue = this.queues.get(queueName);
    if (!queue) {
      this.logger.warn(`Queue ${queueName} not found`);
      return false;
    }

    // Stop all consumers for this queue
    for (const [consumerId, consumer] of this.consumers) {
      if (consumer.config.queueName === queueName) {
        this.unregisterConsumer(consumerId);
      }
    }

    this.queues.delete(queueName);

    this.emitEvent({
      type: QueueEventType.QUEUE_DELETED,
      queueName,
      timestamp: Date.now(),
      data: {},
    });

    this.logger.log(`Queue deleted: ${queueName}`);
    return true;
  }

  /**
   * Purge all messages from a queue
   */
  purgeQueue(queueName: string): number {
    const queue = this.queues.get(queueName);
    if (!queue) return 0;

    const count = queue.messages.length;
    queue.messages = [];

    this.emitEvent({
      type: QueueEventType.QUEUE_PURGED,
      queueName,
      timestamp: Date.now(),
      data: { count },
    });

    this.logger.log(`Queue purged: ${queueName}`, { count });
    return count;
  }

  /**
   * Publish a message to a queue
   */
  publish<T = unknown>(
    queueName: string,
    payload: T,
    options: PublishOptions = {}
  ): string {
    let queue = this.queues.get(queueName);
    
    // Auto-create queue if it doesn't exist
    if (!queue) {
      this.createQueue({ name: queueName, type: 'fifo' });
      queue = this.queues.get(queueName)!;
    }

    const messageId = generateMessageId();
    const now = Date.now();

    const message: QueueMessage<T> = {
      id: messageId,
      queue: queueName,
      payload,
      priority: options.priority || 'normal',
      status: 'pending',
      createdAt: now,
      processAfter: options.delay ? now + options.delay : undefined,
      expiresAt: options.expiresAt || (queue.config.messageTTL ? now + queue.config.messageTTL : undefined),
      attempts: 0,
      maxAttempts: queue.config.maxRetries || 3,
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      metadata: options.metadata,
      headers: options.headers,
    };

    // Check deduplication
    if (queue.config.enableDeduplication && options.correlationId) {
      const existing = queue.messages.find(
        m => m.correlationId === options.correlationId &&
        now - m.createdAt < (queue.config.deduplicationWindow || 300000)
      );
      if (existing) {
        this.logger.log(`Duplicate message detected`, { correlationId: options.correlationId });
        return existing.id;
      }
    }

    // Check queue size
    if (queue.config.maxSize && queue.messages.length >= queue.config.maxSize) {
      throw new Error(`Queue ${queueName} is full (max: ${queue.config.maxSize})`);
    }

    // Add message to queue
    queue.messages.push(message);

    // Sort by priority if enabled
    if (queue.config.enablePriority || queue.config.type === 'priority') {
      queue.messages.sort((a, b) => 
        getPriorityWeight(b.priority) - getPriorityWeight(a.priority)
      );
    }

    this.emitEvent({
      type: QueueEventType.MESSAGE_ENQUEUED,
      queueName,
      messageId,
      timestamp: now,
      data: { priority: message.priority },
    });

    this.logger.log(`Message published to ${queueName}`, { messageId, priority: message.priority });
    return messageId;
  }

  /**
   * Publish multiple messages in batch
   */
  publishBatch<T = unknown>(
    queueName: string,
    payloads: T[],
    options: PublishOptions = {}
  ): string[] {
    return payloads.map(payload => this.publish(queueName, payload, options));
  }

  /**
   * Register a consumer
   */
  registerConsumer(
    config: Omit<ConsumerConfig, 'id'>
  ): string {
    const queue = this.queues.get(config.queueName);
    if (!queue) {
      throw new Error(`Queue ${config.queueName} not found`);
    }

    const consumerId = generateConsumerId();
    const consumerConfig: ConsumerConfig = {
      ...DEFAULT_CONSUMER_CONFIG,
      ...config,
      id: consumerId,
    };

    const consumer: RegisteredConsumer = {
      config: consumerConfig,
      status: 'stopped',
      messagesProcessed: 0,
      messagesFailed: 0,
      averageProcessingTime: 0,
    };

    this.consumers.set(consumerId, consumer);

    this.emitEvent({
      type: QueueEventType.CONSUMER_REGISTERED,
      queueName: config.queueName,
      timestamp: Date.now(),
      data: { consumerId },
    });

    this.logger.log(`Consumer registered for ${config.queueName}`, { consumerId });

    // Auto-start if enabled
    if (consumerConfig.enabled) {
      this.startConsumer(consumerId);
    }

    return consumerId;
  }

  /**
   * Unregister a consumer
   */
  unregisterConsumer(consumerId: string): boolean {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) return false;

    this.stopConsumer(consumerId);
    this.consumers.delete(consumerId);

    this.emitEvent({
      type: QueueEventType.CONSUMER_UNREGISTERED,
      queueName: consumer.config.queueName,
      timestamp: Date.now(),
      data: { consumerId },
    });

    this.logger.log(`Consumer unregistered`, { consumerId });
    return true;
  }

  /**
   * Start a consumer
   */
  startConsumer(consumerId: string): boolean {
    const consumer = this.consumers.get(consumerId);
    if (!consumer || consumer.status === 'running') return false;

    consumer.status = 'running';
    consumer.startedAt = Date.now();

    this.emitEvent({
      type: QueueEventType.CONSUMER_STARTED,
      queueName: consumer.config.queueName,
      timestamp: Date.now(),
      data: { consumerId },
    });

    this.logger.log(`Consumer started`, { consumerId, queue: consumer.config.queueName });
    return true;
  }

  /**
   * Stop a consumer
   */
  stopConsumer(consumerId: string): boolean {
    const consumer = this.consumers.get(consumerId);
    if (!consumer || consumer.status === 'stopped') return false;

    consumer.status = 'stopped';

    this.emitEvent({
      type: QueueEventType.CONSUMER_STOPPED,
      queueName: consumer.config.queueName,
      timestamp: Date.now(),
      data: { consumerId },
    });

    this.logger.log(`Consumer stopped`, { consumerId });
    return true;
  }

  /**
   * Start the message queue processing
   */
  start(): void {
    if (this.started) return;

    this.started = true;
    this.pollInterval = setInterval(() => {
      this.processMessages();
    }, 100); // Poll every 100ms

    this.logger.log('Message queue started');
  }

  /**
   * Stop the message queue processing
   */
  stop(): void {
    if (!this.started) return;

    this.started = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Stop all consumers
    for (const consumerId of this.consumers.keys()) {
      this.stopConsumer(consumerId);
    }

    this.logger.log('Message queue stopped');
  }

  /**
   * Get queue statistics
   */
  getQueueStats(queueName: string): QueueStats | undefined {
    const queue = this.queues.get(queueName);
    if (!queue) return undefined;

    const messages = queue.messages;
    const now = Date.now();

    const pending = messages.filter(m => m.status === 'pending' && (!m.processAfter || m.processAfter <= now));
    const processing = messages.filter(m => m.status === 'processing');
    const completed = messages.filter(m => m.status === 'completed');
    const failed = messages.filter(m => m.status === 'failed');
    const deadLettered = messages.filter(m => m.status === 'dead_letter');
    const delayed = messages.filter(m => m.status === 'delayed' || (m.processAfter && m.processAfter > now));

    const consumers = Array.from(this.consumers.values())
      .filter(c => c.config.queueName === queueName && c.status === 'running');

    return {
      name: queueName,
      type: queue.config.type,
      size: messages.length,
      pendingMessages: pending.length,
      processingMessages: processing.length,
      completedMessages: completed.length,
      failedMessages: failed.length,
      deadLetterMessages: deadLettered.length,
      delayedMessages: delayed.length,
      consumers: consumers.length,
      throughput: this.calculateThroughput(queueName),
      averageWaitTime: this.calculateAverageWaitTime(messages),
      averageProcessingTime: this.calculateAverageProcessingTime(queueName),
      oldestMessage: messages.length > 0 ? messages[0]!.createdAt : undefined,
      newestMessage: messages.length > 0 ? messages[messages.length - 1]!.createdAt : undefined,
    };
  }

  /**
   * Get overall message queue statistics
   */
  getStats(): MessageQueueStats {
    const queueStats = Array.from(this.queues.keys())
      .map(name => this.getQueueStats(name)!)
      .filter(Boolean);

    return {
      totalQueues: this.queues.size,
      totalMessages: queueStats.reduce((sum, q) => sum + q.size, 0),
      totalConsumers: this.consumers.size,
      activeQueues: queueStats.filter(q => q.size > 0).length,
      activeConsumers: Array.from(this.consumers.values()).filter(c => c.status === 'running').length,
      totalThroughput: queueStats.reduce((sum, q) => sum + q.throughput, 0),
      queueStats,
    };
  }

  /**
   * Get a message by ID
   */
  getMessage(messageId: string): QueueMessage | undefined {
    for (const queue of this.queues.values()) {
      const message = queue.messages.find(m => m.id === messageId);
      if (message) return message;
    }
    return undefined;
  }

  /**
   * Acknowledge a message
   */
  ack(messageId: string): boolean {
    const message = this.processing.get(messageId);
    if (!message) return false;

    message.status = 'completed';
    this.processing.delete(messageId);

    // Remove from queue
    const queue = this.queues.get(message.queue);
    if (queue) {
      const index = queue.messages.findIndex(m => m.id === messageId);
      if (index !== -1) {
        queue.messages.splice(index, 1);
      }
    }

    this.emitEvent({
      type: QueueEventType.MESSAGE_COMPLETED,
      queueName: message.queue,
      messageId,
      timestamp: Date.now(),
      data: {},
    });

    return true;
  }

  /**
   * Negatively acknowledge a message (requeue or dead-letter)
   */
  nack(messageId: string, requeue = false): boolean {
    const message = this.processing.get(messageId);
    if (!message) return false;

    this.processing.delete(messageId);

    if (requeue && message.attempts < message.maxAttempts) {
      message.status = 'pending';
      message.lastAttemptAt = Date.now();
      
      this.emitEvent({
        type: QueueEventType.MESSAGE_FAILED,
        queueName: message.queue,
        messageId,
        timestamp: Date.now(),
        data: { requeued: true, attempt: message.attempts },
      });
    } else {
      // Move to dead letter queue
      const queue = this.queues.get(message.queue);
      if (queue?.config.deadLetterQueue) {
        this.moveToDeadLetter(message, queue.config.deadLetterQueue);
      } else {
        message.status = 'failed';
        this.emitEvent({
          type: QueueEventType.MESSAGE_RETRIES_EXHAUSTED,
          queueName: message.queue,
          messageId,
          timestamp: Date.now(),
          data: { attempts: message.attempts },
        });
      }
    }

    return true;
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: QueueEventType, listener: QueueEventListener): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);

    return () => {
      this.eventListeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Destroy the message queue
   */
  destroy(): void {
    this.stop();
    this.queues.clear();
    this.consumers.clear();
    this.processing.clear();
    this.eventListeners.clear();
    MessageQueue.instance = null;
    this.logger.log('Message queue destroyed');
  }

  // ============= Private Methods =============

  /**
   * Process messages for all queues
   */
  private async processMessages(): Promise<void> {
    if (!this.started) return;

    for (const [_consumerId, consumer] of this.consumers) {
      if (consumer.status !== 'running') continue;

      const queue = this.queues.get(consumer.config.queueName);
      if (!queue) continue;

      // Check concurrency limit
      const activeProcessing = Array.from(this.processing.values())
        .filter(m => m.queue === consumer.config.queueName).length;
      
      if (activeProcessing >= (consumer.config.concurrency || 1)) continue;

      // Get next message to process
      const message = this.getNextMessage(queue, consumer);
      if (!message) continue;

      // Process the message
      await this.processMessage(message, consumer);
    }
  }

  /**
   * Get next message to process
   */
  private getNextMessage(
    queue: { config: QueueConfig; messages: QueueMessage[] },
    consumer: RegisteredConsumer
  ): QueueMessage | undefined {
    const now = Date.now();
    // Prefetch is used for batch processing (future enhancement)
    void consumer.config.prefetch;

    // Find available messages
    const available = queue.messages.filter(m => {
      if (m.status !== 'pending') return false;
      if (m.processAfter && m.processAfter > now) return false;
      if (m.expiresAt && m.expiresAt < now) {
        this.expireMessage(m, queue.config);
        return false;
      }
      return true;
    });

    // Return first available (already sorted by priority if enabled)
    return available[0];
  }

  /**
   * Process a single message
   */
  private async processMessage<T = unknown>(
    message: QueueMessage<T>,
    consumer: RegisteredConsumer
  ): Promise<void> {
    const startTime = Date.now();

    // Mark as processing
    message.status = 'processing';
    message.attempts++;
    message.lastAttemptAt = startTime;
    this.processing.set(message.id, message);

    this.emitEvent({
      type: QueueEventType.MESSAGE_DEQUEUED,
      queueName: message.queue,
      messageId: message.id,
      timestamp: startTime,
      data: { attempt: message.attempts },
    });

    const context: MessageContext = {
      messageId: message.id,
      queueName: message.queue,
      attemptNumber: message.attempts,
      timestamp: startTime,
      metadata: message.metadata || {},
    };

    try {
      await consumer.config.handler(message, context);
      const processingTime = Date.now() - startTime;

      if (consumer.config.autoAck) {
        this.ack(message.id);
      }

      consumer.messagesProcessed++;
      consumer.averageProcessingTime = 
        (consumer.averageProcessingTime * (consumer.messagesProcessed - 1) + processingTime) / 
        consumer.messagesProcessed;
      consumer.lastMessageAt = Date.now();

      this.logger.log(`Message processed`, { 
        messageId: message.id, 
        queue: message.queue,
        processingTime 
      });

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      message.lastError = errorMsg;
      consumer.messagesFailed++;

      this.logger.error(`Message processing failed`, {
        messageId: message.id,
        queue: message.queue,
        error: errorMsg,
        attempt: message.attempts,
        processingTimeMs
      });

      if (consumer.config.autoAck) {
        this.nack(message.id, true);
      }
    }
  }

  /**
   * Move message to dead letter queue
   */
  private moveToDeadLetter(message: QueueMessage, deadLetterQueueName: string): void {
    const dlq = this.queues.get(deadLetterQueueName);
    if (!dlq) {
      message.status = 'failed';
      return;
    }

    message.status = 'dead_letter';
    dlq.messages.push(message);

    // Remove from original queue
    const originalQueue = this.queues.get(message.queue);
    if (originalQueue) {
      const index = originalQueue.messages.findIndex(m => m.id === message.id);
      if (index !== -1) {
        originalQueue.messages.splice(index, 1);
      }
    }

    this.emitEvent({
      type: QueueEventType.MESSAGE_DEAD_LETTERED,
      queueName: message.queue,
      messageId: message.id,
      timestamp: Date.now(),
      data: { deadLetterQueue: deadLetterQueueName },
    });
  }

  /**
   * Expire a message
   */
  private expireMessage(message: QueueMessage, config: QueueConfig): void {
    message.status = 'failed';

    this.emitEvent({
      type: QueueEventType.MESSAGE_EXPIRED,
      queueName: message.queue,
      messageId: message.id,
      timestamp: Date.now(),
      data: {},
    });

    if (config.deadLetterQueue) {
      this.moveToDeadLetter(message, config.deadLetterQueue);
    }
  }

  /**
   * Calculate throughput for a queue
   */
  private calculateThroughput(queueName: string): number {
    // Simple calculation based on completed messages in the last minute
    // In a real implementation, this would use time-windowed metrics
    const consumers = Array.from(this.consumers.values())
      .filter(c => c.config.queueName === queueName);
    
    if (consumers.length === 0) return 0;
    
    return consumers.reduce((sum, c) => sum + c.messagesProcessed, 0) / 60;
  }

  /**
   * Calculate average wait time
   */
  private calculateAverageWaitTime(messages: QueueMessage[]): number {
    const now = Date.now();
    const pending = messages.filter(m => m.status === 'pending');
    if (pending.length === 0) return 0;
    
    return pending.reduce((sum, m) => sum + (now - m.createdAt), 0) / pending.length;
  }

  /**
   * Calculate average processing time
   */
  private calculateAverageProcessingTime(queueName: string): number {
    const consumers = Array.from(this.consumers.values())
      .filter(c => c.config.queueName === queueName);
    
    if (consumers.length === 0) return 0;
    
    const total = consumers.reduce((sum, c) => sum + c.averageProcessingTime, 0);
    return total / consumers.length;
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: QueueEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          this.logger.error('Event listener error', { error, event });
        }
      }
    }
  }
}

// Singleton instance
export const messageQueue = MessageQueue.getInstance();

/**
 * Convenience function to create a queue
 */
export function createQueue(config: QueueConfig): boolean {
  return messageQueue.createQueue(config);
}

/**
 * Convenience function to publish a message
 */
export function publish<T = unknown>(
  queueName: string,
  payload: T,
  options?: PublishOptions
): string {
  return messageQueue.publish(queueName, payload, options);
}

/**
 * Convenience function to register a consumer
 */
export function consume<T = unknown, R = unknown>(
  queueName: string,
  handler: (message: QueueMessage<T>, context: MessageContext) => Promise<R> | R,
  options?: Partial<ConsumerConfig>
): string {
  return messageQueue.registerConsumer({
    queueName,
    handler: handler as MessageHandler,
    ...options,
  });
}
