/**
 * Message Queue Types
 * 
 * Type definitions for the message queue system including:
 * - Message types and configurations
 * - Queue management types
 * - Consumer configurations
 * - Queue statistics
 * 
 * @module services/queue/types
 * @author Backend Engineer
 */

/**
 * Message status
 */
export type MessageStatus = 
  | 'pending'      // Message is in queue waiting to be processed
  | 'processing'   // Message is being processed by a consumer
  | 'completed'    // Message was processed successfully
  | 'failed'       // Message processing failed
  | 'dead_letter'  // Message moved to dead letter queue
  | 'delayed';     // Message is delayed for future processing

/**
 * Message priority levels
 */
export type MessagePriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Queue type
 */
export type QueueType = 
  | 'fifo'         // First-in, first-out
  | 'priority'     // Priority-based ordering
  | 'delayed'      // Delayed message processing
  | 'dead_letter'; // Dead letter queue for failed messages

/**
 * Message handler function type
 */
export type MessageHandler<T = unknown, R = unknown> = (
  message: QueueMessage<T>,
  context: MessageContext
) => Promise<R> | R;

/**
 * Message processing context
 */
export interface MessageContext {
  messageId: string;
  queueName: string;
  attemptNumber: number;
  timestamp: number;
  metadata: Record<string, unknown>;
}

/**
 * Message processing result
 */
export interface MessageResult<R = unknown> {
  messageId: string;
  status: MessageStatus;
  result?: R;
  error?: Error;
  processingTime: number;
  attemptNumber: number;
}

/**
 * Queue message
 */
export interface QueueMessage<T = unknown> {
  id: string;
  queue: string;
  payload: T;
  priority: MessagePriority;
  status: MessageStatus;
  createdAt: number;
  processAfter?: number;        // For delayed messages
  expiresAt?: number;           // Message expiration time
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  lastAttemptAt?: number;
  correlationId?: string;       // For tracking related messages
  replyTo?: string;             // For request-reply pattern
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  name: string;
  type: QueueType;
  maxSize?: number;             // Maximum queue size (0 = unlimited)
  messageTTL?: number;          // Message time-to-live in ms
  deadLetterQueue?: string;     // Dead letter queue name
  maxRetries?: number;          // Maximum retry attempts
  retryDelay?: number;          // Delay between retries in ms
  visibilityTimeout?: number;   // Time message is invisible during processing
  enablePriority?: boolean;     // Enable priority ordering
  enableDelay?: boolean;        // Enable delayed messages
  enableDeduplication?: boolean; // Enable message deduplication
  deduplicationWindow?: number; // Window for deduplication in ms
}

/**
 * Consumer configuration
 */
export interface ConsumerConfig {
  id: string;
  queueName: string;
  handler: MessageHandler;
  concurrency?: number;         // Number of concurrent message handlers
  prefetch?: number;            // Number of messages to prefetch
  autoAck?: boolean;            // Auto-acknowledge on successful processing
  batchSize?: number;           // Process messages in batches
  enabled?: boolean;
}

/**
 * Registered consumer
 */
export interface RegisteredConsumer {
  config: ConsumerConfig;
  status: 'running' | 'paused' | 'stopped';
  messagesProcessed: number;
  messagesFailed: number;
  averageProcessingTime: number;
  lastMessageAt?: number;
  startedAt?: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  name: string;
  type: QueueType;
  size: number;
  pendingMessages: number;
  processingMessages: number;
  completedMessages: number;
  failedMessages: number;
  deadLetterMessages: number;
  delayedMessages: number;
  consumers: number;
  throughput: number;           // Messages per second
  averageWaitTime: number;      // Average time in queue
  averageProcessingTime: number;
  oldestMessage?: number;       // Timestamp of oldest message
  newestMessage?: number;       // Timestamp of newest message
}

/**
 * Message queue manager statistics
 */
export interface MessageQueueStats {
  totalQueues: number;
  totalMessages: number;
  totalConsumers: number;
  activeQueues: number;
  activeConsumers: number;
  totalThroughput: number;
  queueStats: QueueStats[];
}

/**
 * Queue event types
 */
export enum QueueEventType {
  MESSAGE_ENQUEUED = 'message_enqueued',
  MESSAGE_DEQUEUED = 'message_dequeued',
  MESSAGE_COMPLETED = 'message_completed',
  MESSAGE_FAILED = 'message_failed',
  MESSAGE_RETRIES_EXHAUSTED = 'message_retries_exhausted',
  MESSAGE_EXPIRED = 'message_expired',
  MESSAGE_DEAD_LETTERED = 'message_dead_lettered',
  CONSUMER_REGISTERED = 'consumer_registered',
  CONSUMER_UNREGISTERED = 'consumer_unregistered',
  CONSUMER_STARTED = 'consumer_started',
  CONSUMER_STOPPED = 'consumer_stopped',
  QUEUE_CREATED = 'queue_created',
  QUEUE_DELETED = 'queue_deleted',
  QUEUE_PURGED = 'queue_purged',
}

/**
 * Queue event
 */
export interface QueueEvent {
  type: QueueEventType;
  queueName: string;
  messageId?: string;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Queue event listener
 */
export type QueueEventListener = (event: QueueEvent) => void;

/**
 * Message publish options
 */
export interface PublishOptions {
  priority?: MessagePriority;
  delay?: number;               // Delay before message becomes visible
  expiresAt?: number;           // Message expiration timestamp
  correlationId?: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: Partial<QueueConfig> = {
  type: 'fifo',
  maxSize: 0,                   // Unlimited
  messageTTL: 86400000,         // 24 hours
  maxRetries: 3,
  retryDelay: 1000,             // 1 second
  visibilityTimeout: 30000,     // 30 seconds
  enablePriority: false,
  enableDelay: false,
  enableDeduplication: false,
  deduplicationWindow: 300000,  // 5 minutes
};

/**
 * Default consumer configuration
 */
export const DEFAULT_CONSUMER_CONFIG: Partial<ConsumerConfig> = {
  concurrency: 1,
  prefetch: 1,
  autoAck: true,
  batchSize: 1,
  enabled: true,
};
