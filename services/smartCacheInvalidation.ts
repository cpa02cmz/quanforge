/**
 * Smart Cache Invalidation Service
 * Provides intelligent cache invalidation strategies with predictive optimization
 */

import { consolidatedCache } from './consolidatedCacheManager';
import { edgeKVService } from './edgeKVStorage';

interface InvalidationRule {
  id: string;
  name: string;
  triggers: string[];
  patterns: string[];
  strategy: 'immediate' | 'delayed' | 'scheduled' | 'conditional';
  delay?: number;
  schedule?: string;
  condition?: (data: any) => boolean;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
}

interface InvalidationEvent {
  id: string;
  ruleId: string;
  trigger: string;
  data: any;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  affectedKeys: string[];
  error?: string;
}

interface CacheMetrics {
  totalInvalidations: number;
  successfulInvalidations: number;
  failedInvalidations: number;
  averageInvalidationTime: number;
  cacheHitRate: number;
  invalidationAccuracy: number;
}

class SmartCacheInvalidation {
  private static instance: SmartCacheInvalidation;
  private rules: Map<string, InvalidationRule> = new Map();
  private events: InvalidationEvent[] = [];
  private metrics: CacheMetrics;
  private processingQueue: InvalidationEvent[] = [];
  private isProcessing = false;
  private scheduleTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.metrics = {
      totalInvalidations: 0,
      successfulInvalidations: 0,
      failedInvalidations: 0,
      averageInvalidationTime: 0,
      cacheHitRate: 0,
      invalidationAccuracy: 0,
    };
    
    this.initializeDefaultRules();
    this.startScheduledInvalidations();
    this.startMetricsCollection();
  }

  static getInstance(): SmartCacheInvalidation {
    if (!SmartCacheInvalidation.instance) {
      SmartCacheInvalidation.instance = new SmartCacheInvalidation();
    }
    return SmartCacheInvalidation.instance;
  }

  /**
   * Initialize default invalidation rules
   */
  private initializeDefaultRules(): void {
    // Robot data invalidation
    this.addRule({
      id: 'robot-crud',
      name: 'Robot CRUD Operations',
      triggers: ['robot.created', 'robot.updated', 'robot.deleted'],
      patterns: ['robots:*', 'robots_paginated:*', 'robot:*'],
      strategy: 'immediate',
      priority: 'high',
      tags: ['robots', 'crud']
    });

    // User session invalidation
    this.addRule({
      id: 'user-session',
      name: 'User Session Changes',
      triggers: ['user.login', 'user.logout', 'user.updated'],
      patterns: ['session:*', 'user:*', 'preferences:*'],
      strategy: 'immediate',
      priority: 'high',
      tags: ['user', 'session']
    });

    // Analytics data invalidation
    this.addRule({
      id: 'analytics-update',
      name: 'Analytics Data Updates',
      triggers: ['analytics.generated', 'metrics.updated'],
      patterns: ['analytics:*', 'metrics:*', 'dashboard:*'],
      strategy: 'delayed',
      delay: 5000, // 5 seconds delay
      priority: 'medium',
      tags: ['analytics', 'metrics']
    });

    // Market data invalidation
    this.addRule({
      id: 'market-data',
      name: 'Market Data Updates',
      triggers: ['market.updated', 'price.changed'],
      patterns: ['market:*', 'price:*', 'ticker:*'],
      strategy: 'conditional',
      condition: (data) => data.changePercent > 0.1, // Only if change > 0.1%
      priority: 'high',
      tags: ['market', 'realtime']
    });

    // Search results invalidation
    this.addRule({
      id: 'search-index',
      name: 'Search Index Updates',
      triggers: ['search.indexed', 'robots.reindexed'],
      patterns: ['search:*', 'robots_search:*'],
      strategy: 'delayed',
      delay: 2000, // 2 seconds delay
      priority: 'medium',
      tags: ['search', 'index']
    });

    // Scheduled cleanup
    this.addRule({
      id: 'scheduled-cleanup',
      name: 'Scheduled Cache Cleanup',
      triggers: ['scheduler.cleanup'],
      patterns: ['temp:*', 'cache:*'],
      strategy: 'scheduled',
      schedule: '0 */6 * * *', // Every 6 hours
      priority: 'low',
      tags: ['cleanup', 'scheduled']
    });
  }

  /**
   * Add a new invalidation rule
   */
  addRule(rule: InvalidationRule): void {
    this.rules.set(rule.id, rule);
    console.log(`Added invalidation rule: ${rule.name}`);
  }

  /**
   * Remove an invalidation rule
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Trigger cache invalidation
   */
  async triggerInvalidation(trigger: string, data: any = {}): Promise<void> {
    const applicableRules = Array.from(this.rules.values())
      .filter(rule => rule.triggers.includes(trigger));

    if (applicableRules.length === 0) {
      console.debug(`No invalidation rules found for trigger: ${trigger}`);
      return;
    }

    // Sort by priority
    applicableRules.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Create invalidation events
    for (const rule of applicableRules) {
      const event: InvalidationEvent = {
        id: this.generateEventId(),
        ruleId: rule.id,
        trigger,
        data,
        timestamp: Date.now(),
        status: 'pending',
        affectedKeys: []
      };

      this.events.push(event);
      
      // Process based on strategy
      switch (rule.strategy) {
        case 'immediate':
          this.processingQueue.push(event);
          break;
        case 'delayed':
          setTimeout(() => {
            this.processingQueue.push(event);
          }, rule.delay || 1000);
          break;
        case 'conditional':
          if (rule.condition && rule.condition(data)) {
            this.processingQueue.push(event);
          }
          break;
        case 'scheduled':
          // Handled by scheduled invalidations
          break;
      }
    }

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process invalidation queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const event = this.processingQueue.shift()!;
      await this.processInvalidationEvent(event);
    }

    this.isProcessing = false;
  }

  /**
   * Process a single invalidation event
   */
  private async processInvalidationEvent(event: InvalidationEvent): Promise<void> {
    const startTime = Date.now();
    event.status = 'processing';

    try {
      const rule = this.rules.get(event.ruleId);
      if (!rule) {
        throw new Error(`Rule not found: ${event.ruleId}`);
      }

      // Find affected cache keys
      const affectedKeys = await this.findAffectedKeys(rule.patterns, event.data);
      event.affectedKeys = affectedKeys;

      // Invalidate from consolidated cache
      let invalidatedCount = 0;
      for (const key of affectedKeys) {
        try {
          const deleted = await consolidatedCache.delete(key);
          if (deleted) invalidatedCount++;
        } catch (error) {
          console.warn(`Failed to delete key ${key} from consolidated cache:`, error);
        }
      }

      // Invalidate from edge KV storage
      try {
        await edgeKVService.clearAll();
      } catch (error) {
        console.warn('Failed to clear edge KV storage:', error);
      }

      // Invalidate by tags
      if (rule.tags.length > 0) {
        try {
          const tagInvalidations = await consolidatedCache.invalidateByTags(rule.tags);
          invalidatedCount += tagInvalidations;
        } catch (error) {
          console.warn(`Failed to invalidate by tags ${rule.tags.join(', ')}:`, error);
        }
      }

      const processingTime = Date.now() - startTime;
      
      // Update metrics
      this.metrics.totalInvalidations++;
      this.metrics.successfulInvalidations++;
      this.updateAverageInvalidationTime(processingTime);

      event.status = 'completed';
      
      console.log(`Invalidation completed: ${rule.name}, ${invalidatedCount} keys, ${processingTime}ms`);

    } catch (error) {
      event.status = 'failed';
      event.error = (error as Error).message;
      
      this.metrics.totalInvalidations++;
      this.metrics.failedInvalidations++;
      
      console.error(`Invalidation failed for event ${event.id}:`, error);
    }
  }

  /**
   * Find cache keys affected by invalidation patterns
   */
  private async findAffectedKeys(patterns: string[], data: any): Promise<string[]> {
    const affectedKeys: string[] = [];
    const allKeys = consolidatedCache.keys();

    for (const pattern of patterns) {
      // Convert pattern to regex
      const regex = new RegExp(
        pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
        'i'
      );

      // Find matching keys
      const matchingKeys = allKeys.filter(key => regex.test(key));
      affectedKeys.push(...matchingKeys);

      // Add dynamic keys based on data
      if (data.id) {
        affectedKeys.push(`${pattern.replace('*', data.id)}`);
      }
      if (data.userId) {
        affectedKeys.push(`user_${data.userId}:*`);
      }
    }

    // Remove duplicates
    return [...new Set(affectedKeys)];
  }

  /**
   * Start scheduled invalidations
   */
  private startScheduledInvalidations(): void {
    // Check for scheduled invalidations every minute
    this.scheduleTimer = setInterval(() => {
      this.checkScheduledInvalidations();
    }, 60000);
  }

  /**
   * Check and execute scheduled invalidations
   */
  private checkScheduledInvalidations(): void {
    const now = new Date();
    const currentTime = `${now.getMinutes()} ${now.getHours()} ${now.getDate()} ${now.getMonth() + 1} ${now.getDay()}`;

    for (const rule of this.rules.values()) {
      if (rule.strategy === 'scheduled' && rule.schedule) {
        // Simple cron-like matching (minutes hour day month dayOfWeek)
        if (this.matchesSchedule(currentTime, rule.schedule)) {
          this.triggerInvalidation('scheduler.cleanup', { scheduled: true });
        }
      }
    }
  }

  /**
   * Simple schedule matching
   */
  private matchesSchedule(currentTime: string, schedule: string): boolean {
    // This is a simplified implementation
    // In production, use a proper cron library
    const currentParts = currentTime.split(' ');
    const scheduleParts = schedule.split(' ');

    return scheduleParts.every((part, index) => 
      part === '*' || part === currentParts[index]
    );
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    // Collect metrics every 5 minutes
    setInterval(() => {
      this.collectMetrics();
    }, 5 * 60 * 1000);
  }

  /**
   * Collect performance metrics
   */
  private collectMetrics(): void {
    try {
      const cacheMetrics = consolidatedCache.getMetrics();
      this.metrics.cacheHitRate = cacheMetrics.hitRate;

      // Calculate invalidation accuracy
      const recentEvents = this.events.slice(-100);
      const successfulEvents = recentEvents.filter(e => e.status === 'completed');
      this.metrics.invalidationAccuracy = recentEvents.length > 0 
        ? successfulEvents.length / recentEvents.length 
        : 0;

    } catch (error) {
      console.warn('Failed to collect metrics:', error);
    }
  }

  /**
   * Update average invalidation time
   */
  private updateAverageInvalidationTime(newTime: number): void {
    const total = this.metrics.successfulInvalidations;
    if (total === 1) {
      this.metrics.averageInvalidationTime = newTime;
    } else {
      this.metrics.averageInvalidationTime = 
        (this.metrics.averageInvalidationTime * (total - 1) + newTime) / total;
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get invalidation metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent invalidation events
   */
  getRecentEvents(limit: number = 50): InvalidationEvent[] {
    return this.events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get invalidation rules
   */
  getRules(): InvalidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get processing queue status
   */
  getQueueStatus(): {
    isProcessing: boolean;
    queueLength: number;
    pendingEvents: number;
    processingEvents: number;
  } {
    const pendingEvents = this.events.filter(e => e.status === 'pending').length;
    const processingEvents = this.events.filter(e => e.status === 'processing').length;

    return {
      isProcessing: this.isProcessing,
      queueLength: this.processingQueue.length,
      pendingEvents,
      processingEvents
    };
  }

  /**
   * Force invalidation of specific patterns
   */
  async forceInvalidation(patterns: string[], reason: string = 'manual'): Promise<void> {
    const event: InvalidationEvent = {
      id: this.generateEventId(),
      ruleId: 'manual',
      trigger: 'manual.invalidation',
      data: { reason, patterns },
      timestamp: Date.now(),
      status: 'pending',
      affectedKeys: []
    };

    this.events.push(event);
    this.processingQueue.push(event);

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Predictive invalidation based on usage patterns
   */
  async predictiveInvalidation(): Promise<void> {
    try {
      // Analyze recent access patterns
      const recentEvents = this.events.slice(-100);
      const triggerFrequency = new Map<string, number>();

      for (const event of recentEvents) {
        const count = triggerFrequency.get(event.trigger) || 0;
        triggerFrequency.set(event.trigger, count + 1);
      }

      // Pre-emptively invalidate frequently accessed data
      for (const [trigger, frequency] of triggerFrequency) {
        if (frequency > 10) { // High frequency trigger
          const relatedPatterns = this.getRelatedPatterns(trigger);
          if (relatedPatterns.length > 0) {
            await this.forceInvalidation(relatedPatterns, 'predictive');
          }
        }
      }

    } catch (error) {
      console.warn('Predictive invalidation failed:', error);
    }
  }

  /**
   * Get patterns related to a trigger
   */
  private getRelatedPatterns(trigger: string): string[] {
    const relatedRules = Array.from(this.rules.values())
      .filter(rule => rule.triggers.includes(trigger));

    return relatedRules.flatMap(rule => rule.patterns);
  }

  /**
   * Cleanup old events
   */
  cleanup(): void {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.events = this.events.filter(event => event.timestamp > oneWeekAgo);
  }

  /**
   * Destroy the invalidation service
   */
  destroy(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    
    this.rules.clear();
    this.events = [];
    this.processingQueue = [];
    this.isProcessing = false;
  }
}

// Export singleton instance
export const smartCacheInvalidation = SmartCacheInvalidation.getInstance();

// Export types and class for testing
export { SmartCacheInvalidation, type InvalidationRule, type InvalidationEvent };

// Convenience functions
export const invalidateCache = (trigger: string, data?: any): Promise<void> => 
  smartCacheInvalidation.triggerInvalidation(trigger, data);

export const forceCacheInvalidation = (patterns: string[], reason?: string): Promise<void> => 
  smartCacheInvalidation.forceInvalidation(patterns, reason);