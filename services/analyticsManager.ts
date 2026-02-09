import { createListenerManager, ListenerManager } from '../utils/listenerManager';
import { createScopedLogger } from '../utils/logger';
import { TIME_CONSTANTS, ANALYTICS_CONFIG } from '../constants/config';

const logger = createScopedLogger('AnalyticsManager');

interface UserEvent {
  type: string;
  category: 'navigation' | 'interaction' | 'performance' | 'error' | 'business';
  action: string;
  label?: string;
  value?: number;
  timestamp: number;
  userId?: string;
  sessionId: string;
  url: string;
  userAgent: string;
  referrer?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

interface AnalyticsConfig {
  endpoint?: string;
  batchSize: number;
  flushInterval: number;
  enableRealTime: boolean;
  enablePersistence: boolean;
  sampleRate: number;
  debugMode: boolean;
}

interface BusinessMetrics {
  robotGeneration: {
    total: number;
    successful: number;
    failed: number;
    averageTime: number;
    strategyTypes: Record<string, number>;
  };
  userEngagement: {
    sessionDuration: number;
    pageViews: number;
    bounceRate: number;
    returnUsers: number;
    newUsers: number;
  };
  performance: {
    averageLoadTime: number;
    errorRate: number;
    cacheHitRate: number;
    apiResponseTime: number;
  };
  conversion: {
    signUps: number;
    robotExports: number;
    premiumUpgrades: number;
    featureAdoption: Record<string, number>;
  };
}



interface BIReport {
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  timestamp: number;
  metrics: BusinessMetrics;
  insights: string[];
  recommendations: string[];
}

export class AnalyticsManager {
  private events: UserEvent[] = [];
  private config: AnalyticsConfig;
  private sessionId: string;
  private userId?: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isOnline = navigator.onLine;
  private listenerManager: ListenerManager;

  constructor(config?: Partial<AnalyticsConfig>) {
    this.listenerManager = createListenerManager();
    this.config = {
      batchSize: ANALYTICS_CONFIG.DEFAULT_BATCH_SIZE,
      flushInterval: ANALYTICS_CONFIG.DEFAULT_FLUSH_INTERVAL,
      enableRealTime: true,
      enablePersistence: ANALYTICS_CONFIG.DEFAULT_PERSISTENCE_ENABLED,
      sampleRate: ANALYTICS_CONFIG.DEFAULT_SAMPLE_RATE,
      debugMode: process.env['NODE_ENV'] === 'development',
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.initializePersistence();
    this.startFlushTimer();
    this.setupEventListeners();
    
    logger.log('Analytics Manager initialized');
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 2 + ANALYTICS_CONFIG.SESSION_ID_LENGTH)}`;
  }

  private initializePersistence(): void {
    if (this.config.enablePersistence) {
      // Load persisted events from localStorage
      try {
        const persisted = localStorage.getItem(ANALYTICS_CONFIG.PERSISTENCE_KEY);
        if (persisted) {
          this.events = JSON.parse(persisted);
          logger.log(`Loaded ${this.events.length} persisted events`);
        }
      } catch (error) {
        logger.warn('Failed to load persisted analytics events:', error);
      }
    }
  }

  private persistEvents(): void {
    if (this.config.enablePersistence && this.events.length > 0) {
      try {
        localStorage.setItem(ANALYTICS_CONFIG.PERSISTENCE_KEY, JSON.stringify(this.events));
      } catch (error) {
        logger.warn('Failed to persist analytics events:', error);
        // Clear old events if storage is full
        this.clearOldEvents();
      }
    }
  }

  private clearOldEvents(): void {
    const retentionTime = Date.now() - (ANALYTICS_CONFIG.EVENT_RETENTION_HOURS * TIME_CONSTANTS.HOUR);
    this.events = this.events.filter(event => event.timestamp > retentionTime);
    this.persistEvents();
  }

  private setupEventListeners(): void {
    // Track online/offline status
    this.listenerManager.addEventListener(window, 'online', () => {
      this.isOnline = true;
      this.flushEvents(); // Flush when coming back online
    });

    this.listenerManager.addEventListener(window, 'offline', () => {
      this.isOnline = false;
    });

    // Track page visibility
    this.listenerManager.addEventListener(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent('page_hidden', 'interaction', 'Page Hidden');
      } else {
        this.trackEvent('page_visible', 'interaction', 'Page Visible');
      }
    });

    // Track page unload
    this.listenerManager.addEventListener(window, 'beforeunload', () => {
      this.trackEvent('page_unload', 'interaction', 'Page Unload');
      this.flushEvents(); // Try to flush before unload
    });
  }

  private startFlushTimer(): void {
    if (this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flushEvents();
      }, this.config.flushInterval);
    }
  }

  // Track user events
  public trackEvent(
    action: string,
    category: UserEvent['category'],
    label?: string,
    value?: number,
    metadata?: Record<string, string | number | boolean | undefined>
  ): void {
    // Sample rate check
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    const event: UserEvent = {
      type: 'user_event',
      category,
      action,
      label,
      value,
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      metadata
    };

    this.addEvent(event);
  }

  // Track page views
  public trackPageView(path?: string, title?: string): void {
    this.trackEvent('page_view', 'navigation', title || document.title, undefined, {
      path: path || window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    });
  }

  // Track robot generation
  public trackRobotGeneration(strategyType: string, success: boolean, duration: number, metadata?: Record<string, unknown>): void {
    this.trackEvent('robot_generated', 'business', `Robot Generation - ${strategyType}`, duration, {
      strategyType,
      success,
      duration,
      ...metadata
    });
  }

  // Track user interactions
  public trackInteraction(element: string, action: string, context?: Record<string, string | number | boolean | undefined>): void {
    this.trackEvent(`interaction_${action}`, 'interaction', element, undefined, context);
  }

  // Track performance metrics
  public trackPerformance(metric: string, value: number, context?: Record<string, string | number | boolean | undefined>): void {
    this.trackEvent(`performance_${metric}`, 'performance', metric, value, context);
  }

  // Track errors
  public trackError(error: Error, context?: Record<string, string | number | boolean | undefined>): void {
    this.trackEvent('javascript_error', 'error', error.name, undefined, {
      message: error.message,
      stack: error.stack,
      ...context
    });
  }

  // Track API calls
  public trackApiCall(endpoint: string, method: string, duration: number, status: number): void {
    this.trackEvent('api_call', 'performance', `${method} ${endpoint}`, duration, {
      endpoint,
      method,
      status,
      success: status >= 200 && status < 400
    });
  }

  // Track feature usage
  public trackFeatureUsage(feature: string, action: string, value?: number): void {
    this.trackEvent(`feature_${feature}`, 'business', action, value, { feature });
  }

  // Set user ID for user tracking
  public setUserId(userId: string): void {
    this.userId = userId;
    this.trackEvent('user_identified', 'navigation', 'User Identified');
  }

  // Add event to queue
  private addEvent(event: UserEvent): void {
    this.events.push(event);

    // Debug logging
    if (this.config.debugMode) {
      logger.log('Analytics Event:', event);
    }

    // Persist events
    this.persistEvents();

    // Auto-flush if batch size reached
    if (this.events.length >= this.config.batchSize) {
      this.flushEvents();
    }
  }

  // Flush events to server
  public async flushEvents(): Promise<void> {
    if (!this.isOnline || this.events.length === 0) {
      return;
    }

    const eventsToSend = [...this.events];
    this.events = []; // Clear immediately to avoid duplicates

    try {
      await this.sendEvents(eventsToSend);
      
      // Clear persisted events on successful send
      if (this.config.enablePersistence) {
        localStorage.removeItem(ANALYTICS_CONFIG.PERSISTENCE_KEY);
      }
      
      if (this.config.debugMode) {
        logger.log(`Successfully sent ${eventsToSend.length} events`);
      }
    } catch (error) {
      logger.error('Failed to send analytics events:', error);
      
      // Re-add events to queue on failure
      this.events.unshift(...eventsToSend);
      this.persistEvents();
    }
  }

  // Send events to analytics endpoint
  private async sendEvents(events: UserEvent[]): Promise<void> {
    if (!this.config.endpoint) {
      // Default to console logging in development
      if (this.config.debugMode) {
        logger.log('Analytics Events (no endpoint configured):', events);
      }
      return;
    }

    const payload = {
      events,
      metadata: {
        sdkVersion: '1.0.0',
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        sessionId: this.sessionId,
        userId: this.userId
      }
    };

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Analytics-Source': 'quanforge-web'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Analytics server responded with ${response.status}`);
    }
  }

  // Generate business intelligence reports
  public async generateBIReport(period: BIReport['period'] = 'daily'): Promise<BIReport> {
    const now = Date.now();
    const periodMs = this.getPeriodMilliseconds(period);
    const startTime = now - periodMs;

    // Filter events for the period
    const periodEvents = this.events.filter(event => event.timestamp >= startTime);

    const metrics = this.calculateBusinessMetrics(periodEvents);
    const insights = this.generateInsights(metrics);
    const recommendations = this.generateRecommendations(metrics, insights);

    return {
      period,
      timestamp: now,
      metrics,
      insights,
      recommendations
    };
  }

  private getPeriodMilliseconds(period: BIReport['period']): number {
    const multipliers = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000
    };
    return multipliers[period];
  }

  private calculateBusinessMetrics(events: UserEvent[]): BusinessMetrics {
    const metrics: BusinessMetrics = {
      robotGeneration: {
        total: 0,
        successful: 0,
        failed: 0,
        averageTime: 0,
        strategyTypes: {}
      },
      userEngagement: {
        sessionDuration: 0,
        pageViews: 0,
        bounceRate: 0,
        returnUsers: 0,
        newUsers: 0
      },
      performance: {
        averageLoadTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        apiResponseTime: 0
      },
      conversion: {
        signUps: 0,
        robotExports: 0,
        premiumUpgrades: 0,
        featureAdoption: {}
      }
    };

    // Calculate metrics from events
    events.forEach(event => {
      switch (event.action) {
        case 'robot_generated':
          metrics.robotGeneration.total++;
          if (event.metadata && event.metadata.success) {
            metrics.robotGeneration.successful++;
          } else {
            metrics.robotGeneration.failed++;
          }
          
          if (event.value) {
            metrics.robotGeneration.averageTime += event.value;
          }
          
          if (event.metadata && event.metadata.strategyType) {
            const strategy = String(event.metadata.strategyType);
            metrics.robotGeneration.strategyTypes[strategy] = 
              (metrics.robotGeneration.strategyTypes[strategy] || 0) + 1;
          }
          break;

        case 'page_view':
          metrics.userEngagement.pageViews++;
          break;

        case 'user_identified':
          metrics.userEngagement.newUsers++;
          break;

        case 'feature_export':
          metrics.conversion.robotExports++;
          break;

        case 'performance_load_time':
          if (event.value) {
            metrics.performance.averageLoadTime += event.value;
          }
          break;

        case 'javascript_error':
          metrics.performance.errorRate++;
          break;
      }
    });

    // Calculate averages and rates
    if (metrics.robotGeneration.successful > 0) {
      metrics.robotGeneration.averageTime /= metrics.robotGeneration.successful;
    }

    if (metrics.userEngagement.pageViews > 0) {
      metrics.performance.errorRate = (metrics.performance.errorRate / events.length) * 100;
    }

    return metrics;
  }

  private generateInsights(metrics: BusinessMetrics): string[] {
    const insights: string[] = [];

    // Robot generation insights
    if (metrics.robotGeneration.total > 0) {
      const successRate = (metrics.robotGeneration.successful / metrics.robotGeneration.total) * 100;
      if (successRate < 80) {
        insights.push(`Robot generation success rate is ${successRate.toFixed(1)}%, below target of 80%`);
      }
      
      if (metrics.robotGeneration.averageTime > 5000) {
        insights.push(`Average robot generation time is ${(metrics.robotGeneration.averageTime / 1000).toFixed(1)}s, consider optimization`);
      }
    }

    // User engagement insights
    if (metrics.userEngagement.pageViews > 0) {
      if (metrics.userEngagement.bounceRate > 70) {
        insights.push(`High bounce rate of ${metrics.userEngagement.bounceRate.toFixed(1)}% detected`);
      }
    }

    // Performance insights
    if (metrics.performance.averageLoadTime > 3000) {
      insights.push(`Average load time is ${(metrics.performance.averageLoadTime / 1000).toFixed(1)}s, above 3s target`);
    }

    if (metrics.performance.errorRate > 5) {
      insights.push(`Error rate is ${metrics.performance.errorRate.toFixed(1)}%, above 5% threshold`);
    }

    return insights;
  }

  private generateRecommendations(metrics: BusinessMetrics, insights: string[]): string[] {
    const recommendations: string[] = [];

    insights.forEach(insight => {
      if (insight.includes('success rate')) {
        recommendations.push('Review AI model prompts and improve error handling in robot generation');
      }
      
      if (insight.includes('generation time')) {
        recommendations.push('Optimize AI API calls and implement better caching strategies');
      }
      
      if (insight.includes('bounce rate')) {
        recommendations.push('Improve onboarding experience and page load performance');
      }
      
      if (insight.includes('load time')) {
        recommendations.push('Optimize bundle size and implement better code splitting');
      }
      
      if (insight.includes('error rate')) {
        recommendations.push('Implement better error monitoring and improve code quality');
      }
    });

    // Business recommendations
    if (metrics.conversion.robotExports > metrics.robotGeneration.total * 0.5) {
      recommendations.push('High export rate detected - consider premium features for exports');
    }

    const topStrategy = Object.entries(metrics.robotGeneration.strategyTypes)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topStrategy) {
      recommendations.push(`Most popular strategy is "${topStrategy[0]}" - consider expanding this category`);
    }

    return recommendations;
  }

  // Get current analytics statistics
  public getStats(): {
    totalEvents: number;
    sessionId: string;
    userId: string | undefined;
    isOnline: boolean;
    config: AnalyticsConfig;
    oldestEvent: number | null;
    newestEvent: number | null;
  } {
    return {
      totalEvents: this.events.length,
      sessionId: this.sessionId,
      userId: this.userId,
      isOnline: this.isOnline,
      config: this.config,
      oldestEvent: this.events.length > 0 ? Math.min(...this.events.map(e => e.timestamp)) : null,
      newestEvent: this.events.length > 0 ? Math.max(...this.events.map(e => e.timestamp)) : null
    };
  }

  // Add edge-specific performance tracking
  public trackEdgePerformance(metric: string, value: number, region?: string): void {
    this.trackEvent(`edge_performance_${metric}`, 'performance', metric, value, {
      region,
      edgeOptimized: true,
      timestamp: Date.now()
    });
  }

  // Clear all events
  public clearEvents(): void {
    this.events = [];
    if (this.config.enablePersistence) {
      localStorage.removeItem(ANALYTICS_CONFIG.PERSISTENCE_KEY);
    }
  }

  // Destroy analytics manager
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Clean up all event listeners
    this.listenerManager.cleanup();
    
    // Try to flush remaining events
    this.flushEvents();
    
    logger.log('Analytics Manager destroyed');
  }
}

// Singleton instance
// Note: This is a client-side SPA with no REST API endpoints
// Analytics are stored locally or sent to external services, not to internal APIs
export const analyticsManager = new AnalyticsManager({
  endpoint: undefined, // No internal API endpoint - client-side only
  batchSize: ANALYTICS_CONFIG.DEFAULT_BATCH_SIZE * 2,
  flushInterval: ANALYTICS_CONFIG.DEFAULT_FLUSH_INTERVAL * 2,
  enableRealTime: true,
  enablePersistence: ANALYTICS_CONFIG.DEFAULT_PERSISTENCE_ENABLED,
  sampleRate: ANALYTICS_CONFIG.REAL_TIME_SAMPLE_RATE,
  debugMode: process.env['NODE_ENV'] === 'development'
});

// Auto-track page views
analyticsManager.trackPageView();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  analyticsManager.destroy();
});