/**
 * Analytics Collector Service - Centralized Analytics and Performance Tracking
 * 
 * Handles event tracking, performance metrics, and analytics data collection
 */

import { IAnalyticsCollector, AnalyticsConfig } from '../../types/serviceInterfaces';
import { supabase } from '../supabase';
import { createScopedLogger } from '../../utils/logger';
import { BATCH_SIZES, MONITORING } from '../constants';

const logger = createScopedLogger('AnalyticsCollector');

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
  context?: Record<string, any>;
}

export interface OperationRecord {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: number;
  error?: string;
  properties?: Record<string, any>;
}

export class AnalyticsCollector implements IAnalyticsCollector {
  private config!: AnalyticsConfig;
  private eventQueue: AnalyticsEvent[] = [];
  private metricsQueue: PerformanceMetric[] = [];
  private operationQueue: OperationRecord[] = [];
  private isProcessing = false;
  private batchProcessor?: ReturnType<typeof setInterval>;

  async initialize(): Promise<void> {
    this.config = {
      enabled: true,
      sampleRate: 1.0, // 100% sampling by default
      batchSize: BATCH_SIZES.METRICS_BATCH,
    };

    // Start batch processing
    this.startBatchProcessor();
  }

  async destroy(): Promise<void> {
    // Stop batch processor
    if (this.batchProcessor) {
      clearInterval(this.batchProcessor);
    }

    // Process any remaining queued items
    await this.flushQueues();
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test basic event tracking
      const testEvent: AnalyticsEvent = {
        event: 'health_check',
        timestamp: Date.now(),
      };
      
      this.eventQueue.push(testEvent);
      this.eventQueue.pop(); // Remove test event
      
      return true;
    } catch (error: unknown) {
      logger.error('Analytics health check failed:', error);
      return false;
    }
  }

  updateConfig(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  async trackEvent(event: string, properties?: Record<string, any>): Promise<void> {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return;
    }

    try {
      const analyticsEvent: AnalyticsEvent = {
        event,
        properties,
        timestamp: Date.now(),
        userId: await this.getCurrentUserId(),
        sessionId: this.getSessionId(),
      };

      this.eventQueue.push(analyticsEvent);

      // Process immediately if queue is getting large
      if (this.eventQueue.length >= this.config.batchSize) {
        await this.processEventQueue();
      }
    } catch (error: unknown) {
      logger.error(`Failed to track event ${event}:`, error);
    }
  }

  async trackMetric(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return;
    }

    try {
      const metric: PerformanceMetric = {
        name,
        value,
        unit: 'ms', // Default unit
        timestamp: Date.now(),
        tags,
        context: {
          userId: await this.getCurrentUserId(),
          sessionId: this.getSessionId(),
        },
      };

      this.metricsQueue.push(metric);

      // Process immediately if queue is getting large
      if (this.metricsQueue.length >= this.config.batchSize) {
        await this.processMetricsQueue();
      }
    } catch (error: unknown) {
      logger.error(`Failed to track metric ${name}:`, error);
    }
  }

  async trackOperation(operation: string, duration: number, success: boolean): Promise<void> {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return;
    }

    try {
      const operationRecord: OperationRecord = {
        operation,
        duration,
        success,
        timestamp: Date.now(),
        properties: {
          userId: await this.getCurrentUserId(),
          sessionId: this.getSessionId(),
        },
      };

      this.operationQueue.push(operationRecord);

      // Process immediately if queue is getting large
      if (this.operationQueue.length >= this.config.batchSize) {
        await this.processOperationQueue();
      }
    } catch (error: unknown) {
      logger.error(`Failed to track operation ${operation}:`, error);
    }
  }

  async getAnalytics(): Promise<(AnalyticsEvent | (PerformanceMetric & { type: 'metric' }) | (OperationRecord & { type: 'operation' }))[]> {
    // Combine all analytics data
    const allData: (AnalyticsEvent | (PerformanceMetric & { type: 'metric' }) | (OperationRecord & { type: 'operation' }))[] = [
      ...this.eventQueue,
      ...this.metricsQueue.map(metric => ({
        type: 'metric' as const,
        ...metric,
      })),
      ...this.operationQueue.map(operation => ({
        type: 'operation' as const,
        ...operation,
      })),
    ];

    return allData.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Private helper methods

  private startBatchProcessor(): void {
    this.batchProcessor = setInterval(async () => {
      if (this.isProcessing) return;
      
      await this.flushQueues();
    }, MONITORING.FLUSH_INTERVAL_MS); // Use modular constant
  }

  private async flushQueues(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    try {
      await Promise.all([
        this.processEventQueue(),
        this.processMetricsQueue(),
        this.processOperationQueue(),
      ]);
    } catch (error: unknown) {
      logger.error('Error during batch processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.config.batchSize);
    
    // Send events to analytics service
    logger.log(`Processing ${events.length} analytics events`);
    
    // Here you would send to your analytics backend
    // For now, we'll just log them
    events.forEach(event => {
      logger.log('Event:', {
        event: event.event,
        timestamp: new Date(event.timestamp).toISOString(),
        properties: event.properties,
      });
    });
  }

  private async processMetricsQueue(): Promise<void> {
    if (this.metricsQueue.length === 0) return;

    const metrics = this.metricsQueue.splice(0, this.config.batchSize);
    
    // Send metrics to monitoring service
    logger.log(`Processing ${metrics.length} performance metrics`);
    
    metrics.forEach(metric => {
      logger.log('Metric:', {
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
        timestamp: new Date(metric.timestamp).toISOString(),
        tags: metric.tags,
      });
    });
  }

  private async processOperationQueue(): Promise<void> {
    if (this.operationQueue.length === 0) return;

    const operations = this.operationQueue.splice(0, this.config.batchSize);
    
    // Send operation data to analytics service
    logger.log(`Processing ${operations.length} operation records`);
    
    operations.forEach(operation => {
      logger.log('Operation:', {
        operation: operation.operation,
        duration: operation.duration,
        success: operation.success,
        timestamp: new Date(operation.timestamp).toISOString(),
      });
    });
  }

  private async getCurrentUserId(): Promise<string | undefined> {
    try {
      // Try to get user from Supabase session using secure method
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        return session.user.id;
      }
    } catch (_error) {
      // Silently fail - user might not be authenticated
    }

    return undefined;
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    
    return sessionId;
  }

  // Advanced analytics methods

  async trackUserAction(action: string, target: string, properties?: Record<string, any>): Promise<void> {
    await this.trackEvent('user_action', {
      action,
      target,
      ...properties,
    });
  }

  async trackPerformance(operation: string, startTime: number, endTime: number, success: boolean): Promise<void> {
    const duration = endTime - startTime;
    await this.trackOperation(operation, duration, success);
    
    // Also track as metric for performance monitoring
    await this.trackMetric(`${operation}_duration`, duration, {
      operation,
      success: success.toString(),
    });
  }

  async trackError(error: Error, operation?: string, properties?: Record<string, any>): Promise<void> {
    await this.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      operation,
      ...properties,
    });
  }

  getQueueStats() {
    return {
      events: this.eventQueue.length,
      metrics: this.metricsQueue.length,
      operations: this.operationQueue.length,
      isProcessing: this.isProcessing,
    };
  }
}