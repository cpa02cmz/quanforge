/**
 * Database Event Publisher
 * 
 * Provides a pub/sub system for database events enabling reactive patterns,
 * real-time updates, and event-driven architectures.
 * 
 * Features:
 * - Event publishing for CRUD operations
 * - Subscription management with filters
 * - Event buffering and replay
 * - Async event handling with backpressure
 * - Event persistence for audit trails
 * 
 * @module services/database/eventPublisher
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';
import { COUNT_CONSTANTS, TIME_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('DatabaseEventPublisher');

// ============================================================================
// TYPES
// ============================================================================

export type DatabaseEventType = 'create' | 'update' | 'delete' | 'read' | 'error';

export type DatabaseEntity = 'robot' | 'user' | 'session' | 'settings' | 'cache';

export interface DatabaseEvent<T = unknown> {
  id: string;
  type: DatabaseEventType;
  entity: DatabaseEntity;
  entityId: string;
  timestamp: string;
  data?: T;
  previousData?: T;
  metadata: EventMetadata;
  correlationId?: string;
}

export interface EventMetadata {
  source: 'api' | 'scheduler' | 'migration' | 'system' | 'user';
  userId?: string;
  userAgent?: string;
  ip?: string;
  version: number;
  [key: string]: unknown;
}

export interface EventFilter {
  types?: DatabaseEventType[];
  entities?: DatabaseEntity[];
  entityIds?: string[];
  userIds?: string[];
  since?: string;
  until?: string;
  custom?: (event: DatabaseEvent) => boolean;
}

export interface EventSubscription {
  id: string;
  filter: EventFilter;
  callback: EventCallback;
  createdAt: string;
  eventCount: number;
  lastTriggered?: string;
  isActive: boolean;
}

export interface EventBuffer {
  maxSize: number;
  events: DatabaseEvent[];
  oldestTimestamp?: string;
  newestTimestamp?: string;
}

export interface EventStatistics {
  totalEvents: number;
  eventsByType: Record<DatabaseEventType, number>;
  eventsByEntity: Record<DatabaseEntity, number>;
  activeSubscriptions: number;
  bufferedEvents: number;
  averageLatencyMs: number;
  errors: number;
}

export type EventCallback = (event: DatabaseEvent) => void | Promise<void>;

export interface EventPublisherConfig {
  bufferEnabled: boolean;
  bufferMaxSize: number;
  asyncProcessing: boolean;
  maxConcurrentHandlers: number;
  retryAttempts: number;
  retryDelayMs: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: EventPublisherConfig = {
  bufferEnabled: true,
  bufferMaxSize: COUNT_CONSTANTS.HISTORY.LARGE,
  asyncProcessing: true,
  maxConcurrentHandlers: 10,
  retryAttempts: 3,
  retryDelayMs: TIME_CONSTANTS.SECOND,
};

// ============================================================================
// DATABASE EVENT PUBLISHER CLASS
// ============================================================================

/**
 * Manages database event publishing and subscription
 */
export class DatabaseEventPublisher {
  private static instance: DatabaseEventPublisher;
  private config: EventPublisherConfig;
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventBuffer: EventBuffer;
  private statistics: EventStatistics;
  private processingQueue: DatabaseEvent[] = [];
  private isProcessing = false;
  private currentHandlers = 0;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  private constructor(config: Partial<EventPublisherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventBuffer = {
      maxSize: this.config.bufferMaxSize,
      events: [],
    };
    this.statistics = this.initializeStatistics();
  }

  static getInstance(config?: Partial<EventPublisherConfig>): DatabaseEventPublisher {
    if (!DatabaseEventPublisher.instance) {
      DatabaseEventPublisher.instance = new DatabaseEventPublisher(config);
    }
    return DatabaseEventPublisher.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the event publisher
   */
  async initialize(): Promise<void> {
    this.startCleanupInterval();
    logger.log('Database event publisher initialized');
  }

  /**
   * Shutdown the event publisher
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    // Process remaining events
    await this.flushQueue();
    this.subscriptions.clear();
    logger.log('Database event publisher shutdown complete');
  }

  /**
   * Publish a database event
   */
  async publish<T>(
    type: DatabaseEventType,
    entity: DatabaseEntity,
    entityId: string,
    data?: T,
    previousData?: T,
    metadata?: Partial<EventMetadata>
  ): Promise<string> {
    const event: DatabaseEvent<T> = {
      id: this.generateEventId(),
      type,
      entity,
      entityId,
      timestamp: new Date().toISOString(),
      data,
      previousData,
      metadata: {
        source: 'api',
        version: 1,
        ...metadata,
      },
    };

    // Update statistics
    this.updateStatistics(event);

    // Buffer event
    if (this.config.bufferEnabled) {
      this.bufferEvent(event);
    }

    // Queue for async processing or process immediately
    if (this.config.asyncProcessing) {
      this.processingQueue.push(event);
      this.processQueue();
    } else {
      await this.deliverEvent(event);
    }

    logger.debug(`Published event: ${event.id} (${type} ${entity})`);
    return event.id;
  }

  /**
   * Subscribe to database events
   */
  subscribe(
    filter: EventFilter,
    callback: EventCallback
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      filter,
      callback,
      createdAt: new Date().toISOString(),
      eventCount: 0,
      isActive: true,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.statistics.activeSubscriptions = this.subscriptions.size;

    logger.debug(`Created subscription: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from database events
   */
  unsubscribe(subscriptionId: string): boolean {
    const deleted = this.subscriptions.delete(subscriptionId);
    this.statistics.activeSubscriptions = this.subscriptions.size;
    
    if (deleted) {
      logger.debug(`Removed subscription: ${subscriptionId}`);
    }
    
    return deleted;
  }

  /**
   * Pause a subscription
   */
  pauseSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;
      return true;
    }
    return false;
  }

  /**
   * Resume a subscription
   */
  resumeSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = true;
      return true;
    }
    return false;
  }

  /**
   * Get buffered events
   */
  getBufferedEvents(filter?: EventFilter): DatabaseEvent[] {
    let events = [...this.eventBuffer.events];

    if (filter) {
      events = events.filter(event => this.matchesFilter(event, filter));
    }

    return events;
  }

  /**
   * Replay events to a subscription
   */
  async replayEvents(
    subscriptionId: string,
    filter?: EventFilter
  ): Promise<number> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return 0;
    }

    const events = this.getBufferedEvents(filter || subscription.filter);
    
    for (const event of events) {
      await this.deliverToSubscription(subscription, event);
    }

    return events.length;
  }

  /**
   * Get event statistics
   */
  getStatistics(): EventStatistics {
    return { ...this.statistics };
  }

  /**
   * Clear event buffer
   */
  clearBuffer(): void {
    this.eventBuffer.events = [];
    this.eventBuffer.oldestTimestamp = undefined;
    this.eventBuffer.newestTimestamp = undefined;
    this.statistics.bufferedEvents = 0;
  }

  /**
   * Get subscription details
   */
  getSubscription(subscriptionId: string): EventSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get all subscriptions
   */
  getAllSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  /**
   * Publish a create event
   */
  async onCreate<T>(
    entity: DatabaseEntity,
    entityId: string,
    data: T,
    metadata?: Partial<EventMetadata>
  ): Promise<string> {
    return this.publish('create', entity, entityId, data, undefined, metadata);
  }

  /**
   * Publish an update event
   */
  async onUpdate<T>(
    entity: DatabaseEntity,
    entityId: string,
    data: T,
    previousData?: T,
    metadata?: Partial<EventMetadata>
  ): Promise<string> {
    return this.publish('update', entity, entityId, data, previousData, metadata);
  }

  /**
   * Publish a delete event
   */
  async onDelete<T>(
    entity: DatabaseEntity,
    entityId: string,
    previousData?: T,
    metadata?: Partial<EventMetadata>
  ): Promise<string> {
    return this.publish('delete', entity, entityId, undefined, previousData, metadata);
  }

  /**
   * Subscribe to create events
   */
  onCreateOnly(
    entity: DatabaseEntity,
    callback: EventCallback
  ): string {
    return this.subscribe({ types: ['create'], entities: [entity] }, callback);
  }

  /**
   * Subscribe to update events
   */
  onUpdateOnly(
    entity: DatabaseEntity,
    callback: EventCallback
  ): string {
    return this.subscribe({ types: ['update'], entities: [entity] }, callback);
  }

  /**
   * Subscribe to delete events
   */
  onDeleteOnly(
    entity: DatabaseEntity,
    callback: EventCallback
  ): string {
    return this.subscribe({ types: ['delete'], entities: [entity] }, callback);
  }

  /**
   * Subscribe to all changes for an entity
   */
  onAnyChange(
    entity: DatabaseEntity,
    callback: EventCallback
  ): string {
    return this.subscribe(
      { types: ['create', 'update', 'delete'], entities: [entity] },
      callback
    );
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private initializeStatistics(): EventStatistics {
    return {
      totalEvents: 0,
      eventsByType: {
        create: 0,
        update: 0,
        delete: 0,
        read: 0,
        error: 0,
      },
      eventsByEntity: {
        robot: 0,
        user: 0,
        session: 0,
        settings: 0,
        cache: 0,
      },
      activeSubscriptions: 0,
      bufferedEvents: 0,
      averageLatencyMs: 0,
      errors: 0,
    };
  }

  private updateStatistics(event: DatabaseEvent): void {
    this.statistics.totalEvents++;
    this.statistics.eventsByType[event.type]++;
    this.statistics.eventsByEntity[event.entity]++;
  }

  private bufferEvent(event: DatabaseEvent): void {
    this.eventBuffer.events.push(event);
    this.eventBuffer.newestTimestamp = event.timestamp;

    if (!this.eventBuffer.oldestTimestamp) {
      this.eventBuffer.oldestTimestamp = event.timestamp;
    }

    // Trim buffer if exceeding max size
    if (this.eventBuffer.events.length > this.eventBuffer.maxSize) {
      this.eventBuffer.events.shift();
      this.eventBuffer.oldestTimestamp = this.eventBuffer.events[0]?.timestamp;
    }

    this.statistics.bufferedEvents = this.eventBuffer.events.length;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (
      this.processingQueue.length > 0 &&
      this.currentHandlers < this.config.maxConcurrentHandlers
    ) {
      const event = this.processingQueue.shift();
      if (event) {
        this.currentHandlers++;
        this.deliverEventWithRetry(event)
          .catch(error => {
            logger.error('Event delivery failed:', error);
            this.statistics.errors++;
          })
          .finally(() => {
            this.currentHandlers--;
          });
      }
    }

    this.isProcessing = false;
  }

  private async deliverEventWithRetry(event: DatabaseEvent): Promise<void> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.config.retryAttempts) {
      try {
        await this.deliverEvent(event);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts++;
        
        if (attempts < this.config.retryAttempts) {
          await this.sleep(this.config.retryDelayMs * attempts);
        }
      }
    }

    throw lastError;
  }

  private async deliverEvent(event: DatabaseEvent): Promise<void> {
    const startTime = performance.now();

    for (const subscription of this.subscriptions.values()) {
      if (!subscription.isActive) continue;

      if (this.matchesFilter(event, subscription.filter)) {
        await this.deliverToSubscription(subscription, event);
      }
    }

    // Update average latency
    const latency = performance.now() - startTime;
    this.statistics.averageLatencyMs = 
      (this.statistics.averageLatencyMs + latency) / 2;
  }

  private async deliverToSubscription(
    subscription: EventSubscription,
    event: DatabaseEvent
  ): Promise<void> {
    try {
      await subscription.callback(event);
      subscription.eventCount++;
      subscription.lastTriggered = new Date().toISOString();
    } catch (error) {
      logger.error(
        `Subscription callback failed (${subscription.id}):`,
        error
      );
      throw error;
    }
  }

  private matchesFilter(event: DatabaseEvent, filter: EventFilter): boolean {
    // Check event types
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(event.type)) {
        return false;
      }
    }

    // Check entities
    if (filter.entities && filter.entities.length > 0) {
      if (!filter.entities.includes(event.entity)) {
        return false;
      }
    }

    // Check entity IDs
    if (filter.entityIds && filter.entityIds.length > 0) {
      if (!filter.entityIds.includes(event.entityId)) {
        return false;
      }
    }

    // Check user IDs
    if (filter.userIds && filter.userIds.length > 0) {
      if (!filter.userIds.includes(event.metadata.userId || '')) {
        return false;
      }
    }

    // Check time range
    if (filter.since) {
      if (event.timestamp < filter.since) {
        return false;
      }
    }

    if (filter.until) {
      if (event.timestamp > filter.until) {
        return false;
      }
    }

    // Check custom filter
    if (filter.custom) {
      return filter.custom(event);
    }

    return true;
  }

  private async flushQueue(): Promise<void> {
    while (this.processingQueue.length > 0) {
      const event = this.processingQueue.shift();
      if (event) {
        await this.deliverEvent(event);
      }
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, TIME_CONSTANTS.HOUR);
  }

  private cleanupOldData(): void {
    // Remove inactive subscriptions older than 24 hours
    const cutoff = new Date(Date.now() - TIME_CONSTANTS.DAY).toISOString();
    
    for (const [id, subscription] of this.subscriptions) {
      if (!subscription.isActive && subscription.createdAt < cutoff) {
        this.subscriptions.delete(id);
      }
    }
    
    this.statistics.activeSubscriptions = this.subscriptions.size;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const databaseEventPublisher = DatabaseEventPublisher.getInstance();

// Register with service cleanup coordinator for proper lifecycle management
serviceCleanupCoordinator.register('databaseEventPublisher', {
  cleanup: () => databaseEventPublisher.shutdown(),
  priority: 'medium',
  description: 'Database event publisher service'
});
