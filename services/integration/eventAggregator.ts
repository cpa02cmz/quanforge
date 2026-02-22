/**
 * Integration Event Aggregator - Cross-Integration Event Management
 * 
 * Provides comprehensive event aggregation capabilities:
 * - Event collection from multiple integrations
 * - Event correlation and pattern detection
 * - Aggregated event notifications
 * - Event replay and auditing
 * - Real-time event streaming
 */

import { createScopedLogger } from '../../utils/logger';
import { MEMORY_LIMITS } from '../../constants';
import {
  IntegrationEventType,
  type IntegrationEvent,
  type IntegrationEventListener,
} from './types';
import { IntegrationType } from '../integrationResilience';
import { integrationOrchestrator } from './orchestrator';

const logger = createScopedLogger('integration-event-aggregator');

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Aggregated event representing multiple related events
 */
export interface AggregatedEvent {
  /** Unique identifier */
  id: string;
  /** Type of aggregation */
  aggregationType: AggregationType;
  /** Source events that were aggregated */
  sourceEvents: IntegrationEvent[];
  /** Timestamp when aggregation was created */
  timestamp: Date;
  /** Aggregation window start */
  windowStart: Date;
  /** Aggregation window end */
  windowEnd: Date;
  /** Aggregated metrics */
  metrics: AggregatedMetrics;
  /** Derived insights from aggregation */
  insights?: string[];
  /** Severity level */
  severity: EventSeverity;
  /** Whether this requires attention */
  requiresAttention: boolean;
}

/**
 * Types of event aggregation
 */
export enum AggregationType {
  /** Multiple events of the same type */
  SIMILAR_EVENTS = 'similar_events',
  /** Events that occurred in sequence */
  SEQUENCE = 'sequence',
  /** Events that occurred within a time window */
  TIME_WINDOW = 'time_window',
  /** Events from related integrations */
  INTEGRATION_CLUSTER = 'integration_cluster',
  /** Events indicating a pattern */
  PATTERN = 'pattern',
  /** Events that are related by causality */
  CAUSAL_CHAIN = 'causal_chain',
}

/**
 * Event severity levels
 */
export enum EventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Metrics for aggregated events
 */
export interface AggregatedMetrics {
  /** Total number of events */
  eventCount: number;
  /** Unique integrations involved */
  uniqueIntegrations: number;
  /** Time span of events in ms */
  timeSpan: number;
  /** Error count if applicable */
  errorCount: number;
  /** Recovery count if applicable */
  recoveryCount: number;
  /** Average latency if applicable */
  avgLatency?: number;
  /** Affected integrations */
  affectedIntegrations: string[];
}

/**
 * Event correlation rule
 */
export interface CorrelationRule {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Description */
  description?: string;
  /** Event types to match */
  eventTypes: IntegrationEventType[];
  /** Integration types to match */
  integrationTypes?: IntegrationType[];
  /** Time window for correlation in ms */
  timeWindow: number;
  /** Minimum events to trigger aggregation */
  minEvents: number;
  /** Maximum events to include in aggregation */
  maxEvents: number;
  /** Custom matching function */
  matcher?: (events: IntegrationEvent[]) => boolean;
  /** Custom aggregation function */
  aggregator?: (events: IntegrationEvent[]) => Partial<AggregatedEvent>;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Severity override */
  severity?: EventSeverity;
}

/**
 * Event pattern definition
 */
export interface EventPattern {
  /** Pattern identifier */
  id: string;
  /** Pattern name */
  name: string;
  /** Pattern description */
  description?: string;
  /** Event sequence definition */
  sequence: Array<{
    eventType: IntegrationEventType;
    integrationType?: IntegrationType;
    optional?: boolean;
    maxDelay?: number; // Max delay from previous event in ms
  }>;
  /** Pattern detection callback */
  onDetected?: (events: IntegrationEvent[], pattern: EventPattern) => void;
  /** Whether pattern is enabled */
  enabled: boolean;
}

/**
 * Event aggregator configuration
 */
export interface EventAggregatorConfig {
  /** Maximum events to store */
  maxEvents: number;
  /** Maximum aggregated events to store */
  maxAggregations: number;
  /** Default time window for aggregation in ms */
  defaultTimeWindow: number;
  /** Enable pattern detection */
  enablePatternDetection: boolean;
  /** Enable causal analysis */
  enableCausalAnalysis: boolean;
  /** Notification callback for new aggregations */
  onAggregation?: (aggregation: AggregatedEvent) => void;
  /** Notification callback for pattern detection */
  onPatternDetected?: (pattern: EventPattern, events: IntegrationEvent[]) => void;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: EventAggregatorConfig = {
  maxEvents: MEMORY_LIMITS.MAX_HISTORY_SIZE || 100,
  maxAggregations: 50,
  defaultTimeWindow: 60000, // 1 minute
  enablePatternDetection: true,
  enableCausalAnalysis: true,
};

// ============================================================================
// Pre-defined Correlation Rules
// ============================================================================

const DEFAULT_CORRELATION_RULES: CorrelationRule[] = [
  {
    id: 'cascade_failure',
    name: 'Cascade Failure Detection',
    description: 'Detects multiple integration failures in quick succession',
    eventTypes: [
      IntegrationEventType.HEALTH_CHECK_FAILED,
      IntegrationEventType.CIRCUIT_BREAKER_OPENED,
      IntegrationEventType.DEGRADED_MODE_ENTERED,
    ],
    timeWindow: 30000, // 30 seconds
    minEvents: 2,
    maxEvents: 10,
    enabled: true,
    severity: EventSeverity.CRITICAL,
  },
  {
    id: 'recovery_chain',
    name: 'Recovery Chain Detection',
    description: 'Detects recovery patterns across integrations',
    eventTypes: [
      IntegrationEventType.RECOVERY_STARTED,
      IntegrationEventType.RECOVERY_COMPLETED,
      IntegrationEventType.HEALTH_CHECK_PASSED,
      IntegrationEventType.CIRCUIT_BREAKER_CLOSED,
    ],
    timeWindow: 60000, // 1 minute
    minEvents: 2,
    maxEvents: 20,
    enabled: true,
    severity: EventSeverity.INFO,
  },
  {
    id: 'unstable_integration',
    name: 'Unstable Integration Detection',
    description: 'Detects integrations with frequent status changes',
    eventTypes: [IntegrationEventType.STATUS_CHANGED],
    timeWindow: 300000, // 5 minutes
    minEvents: 5,
    maxEvents: 50,
    enabled: true,
    severity: EventSeverity.WARNING,
    matcher: (events) => {
      // Check if same integration has multiple status changes
      const integrationCounts = new Map<string, number>();
      events.forEach(e => {
        integrationCounts.set(e.integrationName, (integrationCounts.get(e.integrationName) || 0) + 1);
      });
      return Array.from(integrationCounts.values()).some(count => count >= 5);
    },
  },
  {
    id: 'degraded_cluster',
    name: 'Degraded Cluster Detection',
    description: 'Detects when multiple integrations enter degraded mode',
    eventTypes: [IntegrationEventType.DEGRADED_MODE_ENTERED],
    timeWindow: 60000, // 1 minute
    minEvents: 2,
    maxEvents: 10,
    enabled: true,
    severity: EventSeverity.WARNING,
  },
];

// ============================================================================
// Pre-defined Patterns
// ============================================================================

const DEFAULT_PATTERNS: EventPattern[] = [
  {
    id: 'failure_recovery_cycle',
    name: 'Failure-Recovery Cycle',
    description: 'Pattern indicating a failure followed by successful recovery',
    sequence: [
      { eventType: IntegrationEventType.HEALTH_CHECK_FAILED },
      { eventType: IntegrationEventType.RECOVERY_STARTED, maxDelay: 10000 },
      { eventType: IntegrationEventType.RECOVERY_COMPLETED, maxDelay: 30000 },
      { eventType: IntegrationEventType.HEALTH_CHECK_PASSED, maxDelay: 10000 },
    ],
    enabled: true,
  },
  {
    id: 'circuit_breaker_cycle',
    name: 'Circuit Breaker Cycle',
    description: 'Full circuit breaker open-halfopen-closed cycle',
    sequence: [
      { eventType: IntegrationEventType.CIRCUIT_BREAKER_OPENED },
      { eventType: IntegrationEventType.CIRCUIT_BREAKER_HALF_OPEN, maxDelay: 60000 },
      { eventType: IntegrationEventType.CIRCUIT_BREAKER_CLOSED, maxDelay: 30000 },
    ],
    enabled: true,
  },
  {
    id: 'degradation_escalation',
    name: 'Degradation Escalation',
    description: 'Pattern indicating escalating degradation',
    sequence: [
      { eventType: IntegrationEventType.HEALTH_CHECK_FAILED },
      { eventType: IntegrationEventType.DEGRADED_MODE_ENTERED, maxDelay: 30000 },
      { eventType: IntegrationEventType.CIRCUIT_BREAKER_OPENED, maxDelay: 60000 },
    ],
    enabled: true,
  },
];

// ============================================================================
// Integration Event Aggregator
// ============================================================================

/**
 * Integration Event Aggregator
 * 
 * Collects, correlates, and aggregates events from multiple integrations
 */
export class IntegrationEventAggregator {
  private static instance: IntegrationEventAggregator | null = null;
  
  private readonly config: EventAggregatorConfig;
  private readonly events: IntegrationEvent[] = [];
  private readonly aggregations: AggregatedEvent[] = [];
  private readonly correlationRules = new Map<string, CorrelationRule>();
  private readonly patterns = new Map<string, EventPattern>();
  private readonly listeners = new Set<IntegrationEventListener>();
  private readonly aggregationListeners = new Set<(aggregation: AggregatedEvent) => void>();
  
  private unsubscribeOrchestrator?: () => void;
  private isInitialized = false;
  private aggregationIdCounter = 0;

  private constructor(config: Partial<EventAggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('Integration Event Aggregator created');
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<EventAggregatorConfig>): IntegrationEventAggregator {
    if (!IntegrationEventAggregator.instance) {
      IntegrationEventAggregator.instance = new IntegrationEventAggregator(config);
    }
    return IntegrationEventAggregator.instance;
  }

  /**
   * Initialize the aggregator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Event Aggregator already initialized');
      return;
    }

    logger.info('Initializing Integration Event Aggregator...');

    // Load default rules and patterns
    DEFAULT_CORRELATION_RULES.forEach(rule => {
      this.correlationRules.set(rule.id, rule);
    });

    DEFAULT_PATTERNS.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });

    // Subscribe to orchestrator events
    this.unsubscribeOrchestrator = integrationOrchestrator.subscribeAll((event) => {
      this.processEvent(event);
    });

    this.isInitialized = true;
    logger.info('Integration Event Aggregator initialized', {
      rules: this.correlationRules.size,
      patterns: this.patterns.size,
    });
  }

  /**
   * Process an incoming event
   */
  processEvent(event: IntegrationEvent): void {
    // Add to event buffer
    this.events.push(event);
    
    // Trim buffer if needed
    if (this.events.length > this.config.maxEvents) {
      this.events.shift();
    }

    // Notify direct listeners
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('Error in event listener:', error);
      }
    });

    // Check correlation rules
    this.checkCorrelationRules(event);

    // Check patterns if enabled
    if (this.config.enablePatternDetection) {
      this.checkPatterns(event);
    }

    logger.debug(`Processed event: ${event.type} from ${event.integrationName}`);
  }

  /**
   * Add a correlation rule
   */
  addCorrelationRule(rule: CorrelationRule): void {
    this.correlationRules.set(rule.id, rule);
    logger.info(`Added correlation rule: ${rule.id}`);
  }

  /**
   * Remove a correlation rule
   */
  removeCorrelationRule(ruleId: string): void {
    this.correlationRules.delete(ruleId);
    logger.info(`Removed correlation rule: ${ruleId}`);
  }

  /**
   * Add an event pattern
   */
  addPattern(pattern: EventPattern): void {
    this.patterns.set(pattern.id, pattern);
    logger.info(`Added event pattern: ${pattern.id}`);
  }

  /**
   * Remove an event pattern
   */
  removePattern(patternId: string): void {
    this.patterns.delete(patternId);
    logger.info(`Removed event pattern: ${patternId}`);
  }

  /**
   * Subscribe to all events
   */
  subscribe(listener: IntegrationEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to aggregated events
   */
  subscribeAggregations(listener: (aggregation: AggregatedEvent) => void): () => void {
    this.aggregationListeners.add(listener);
    return () => this.aggregationListeners.delete(listener);
  }

  /**
   * Get recent events
   */
  getRecentEvents(options: {
    limit?: number;
    types?: IntegrationEventType[];
    integrations?: string[];
    since?: Date;
  } = {}): IntegrationEvent[] {
    let filtered = [...this.events];

    if (options.types) {
      filtered = filtered.filter(e => options.types!.includes(e.type));
    }

    if (options.integrations) {
      filtered = filtered.filter(e => options.integrations!.includes(e.integrationName));
    }

    if (options.since) {
      filtered = filtered.filter(e => e.timestamp >= options.since!);
    }

    const limit = options.limit || 100;
    return filtered.slice(-limit);
  }

  /**
   * Get aggregations
   */
  getAggregations(options: {
    limit?: number;
    severity?: EventSeverity;
    since?: Date;
  } = {}): AggregatedEvent[] {
    let filtered = [...this.aggregations];

    if (options.severity) {
      filtered = filtered.filter(a => a.severity === options.severity);
    }

    if (options.since) {
      filtered = filtered.filter(a => a.timestamp >= options.since!);
    }

    const limit = options.limit || 50;
    return filtered.slice(-limit);
  }

  /**
   * Get event statistics
   */
  getStatistics(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByIntegration: Record<string, number>;
    aggregationsCount: number;
    aggregationsBySeverity: Record<string, number>;
    patterns: { id: string; name: string; enabled: boolean }[];
    rules: { id: string; name: string; enabled: boolean }[];
  } {
    const eventsByType: Record<string, number> = {};
    const eventsByIntegration: Record<string, number> = {};
    const aggregationsBySeverity: Record<string, number> = {};

    this.events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsByIntegration[event.integrationName] = (eventsByIntegration[event.integrationName] || 0) + 1;
    });

    this.aggregations.forEach(agg => {
      aggregationsBySeverity[agg.severity] = (aggregationsBySeverity[agg.severity] || 0) + 1;
    });

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsByIntegration,
      aggregationsCount: this.aggregations.length,
      aggregationsBySeverity,
      patterns: Array.from(this.patterns.values()).map(p => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
      })),
      rules: Array.from(this.correlationRules.values()).map(r => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
      })),
    };
  }

  /**
   * Clear all events and aggregations
   */
  clear(): void {
    this.events.length = 0;
    this.aggregations.length = 0;
    logger.info('Event Aggregator cleared');
  }

  /**
   * Shutdown the aggregator
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Integration Event Aggregator...');

    if (this.unsubscribeOrchestrator) {
      this.unsubscribeOrchestrator();
    }

    this.listeners.clear();
    this.aggregationListeners.clear();
    this.events.length = 0;
    this.aggregations.length = 0;
    this.isInitialized = false;

    logger.info('Integration Event Aggregator shut down');
  }

  // Private methods

  private checkCorrelationRules(event: IntegrationEvent): void {
    this.correlationRules.forEach(rule => {
      if (!rule.enabled) return;
      if (!rule.eventTypes.includes(event.type)) return;
      if (rule.integrationTypes && !rule.integrationTypes.includes(event.integrationType)) return;

      // Get events within time window
      const windowStart = new Date(Date.now() - rule.timeWindow);
      const windowEvents = this.events.filter(e => 
        e.timestamp >= windowStart &&
        rule.eventTypes.includes(e.type)
      );

      if (windowEvents.length < rule.minEvents) return;
      if (windowEvents.length > rule.maxEvents) return;

      // Apply custom matcher if present
      if (rule.matcher && !rule.matcher(windowEvents)) return;

      // Create aggregation
      this.createAggregation(
        AggregationType.TIME_WINDOW,
        windowEvents.slice(-rule.maxEvents),
        rule.severity || EventSeverity.INFO,
        rule.aggregator?.(windowEvents)
      );
    });
  }

  private checkPatterns(_event: IntegrationEvent): void {
    this.patterns.forEach(pattern => {
      if (!pattern.enabled) return;

      const matchedEvents = this.matchPattern(pattern);
      if (matchedEvents) {
        logger.info(`Pattern detected: ${pattern.name}`);
        
        if (pattern.onDetected) {
          pattern.onDetected(matchedEvents, pattern);
        }

        if (this.config.onPatternDetected) {
          this.config.onPatternDetected(pattern, matchedEvents);
        }

        // Create aggregation for pattern
        this.createAggregation(
          AggregationType.PATTERN,
          matchedEvents,
          EventSeverity.INFO,
          { insights: [`Pattern "${pattern.name}" detected`] }
        );
      }
    });
  }

  private matchPattern(pattern: EventPattern): IntegrationEvent[] | null {
    const matchedEvents: IntegrationEvent[] = [];
    let lastMatchTime: Date | null = null;

    for (const step of pattern.sequence) {
      // Find matching event
      let matchingEvent: IntegrationEvent | null = null;
      
      for (let i = this.events.length - 1; i >= 0; i--) {
        const event = this.events[i];
        if (!event) continue;
        
        // Skip if already matched
        if (matchedEvents.includes(event)) continue;
        
        // Check event type
        if (event.type !== step.eventType) continue;
        
        // Check integration type if specified
        if (step.integrationType && event.integrationType !== step.integrationType) continue;
        
        // Check timing constraint
        if (lastMatchTime && step.maxDelay) {
          const delay = event.timestamp.getTime() - lastMatchTime.getTime();
          if (delay > step.maxDelay) continue;
        }
        
        matchingEvent = event;
        break;
      }

      if (matchingEvent) {
        matchedEvents.push(matchingEvent);
        lastMatchTime = matchingEvent.timestamp;
      } else if (!step.optional) {
        return null; // Required step not matched
      }
    }

    return matchedEvents.length > 0 ? matchedEvents : null;
  }

  private createAggregation(
    aggregationType: AggregationType,
    sourceEvents: IntegrationEvent[],
    severity: EventSeverity,
    additional?: Partial<AggregatedEvent>
  ): AggregatedEvent {
    const now = new Date();
    const windowStart = sourceEvents[0]?.timestamp || now;
    const windowEnd = sourceEvents[sourceEvents.length - 1]?.timestamp || now;

    const uniqueIntegrations = new Set(sourceEvents.map(e => e.integrationName));
    const affectedIntegrations = Array.from(uniqueIntegrations);
    
    const errorCount = sourceEvents.filter(e => 
      e.type === IntegrationEventType.HEALTH_CHECK_FAILED ||
      e.type === IntegrationEventType.CIRCUIT_BREAKER_OPENED
    ).length;

    const recoveryCount = sourceEvents.filter(e =>
      e.type === IntegrationEventType.RECOVERY_COMPLETED ||
      e.type === IntegrationEventType.HEALTH_CHECK_PASSED
    ).length;

    const aggregation: AggregatedEvent = {
      id: `agg-${++this.aggregationIdCounter}`,
      aggregationType,
      sourceEvents,
      timestamp: now,
      windowStart,
      windowEnd,
      metrics: {
        eventCount: sourceEvents.length,
        uniqueIntegrations: uniqueIntegrations.size,
        timeSpan: windowEnd.getTime() - windowStart.getTime(),
        errorCount,
        recoveryCount,
        affectedIntegrations,
      },
      severity,
      requiresAttention: severity === EventSeverity.WARNING || 
                         severity === EventSeverity.ERROR ||
                         severity === EventSeverity.CRITICAL,
      ...additional,
    };

    // Add to aggregations
    this.aggregations.push(aggregation);
    
    // Trim if needed
    if (this.aggregations.length > this.config.maxAggregations) {
      this.aggregations.shift();
    }

    // Notify listeners
    this.aggregationListeners.forEach(listener => {
      try {
        listener(aggregation);
      } catch (error) {
        logger.error('Error in aggregation listener:', error);
      }
    });

    if (this.config.onAggregation) {
      this.config.onAggregation(aggregation);
    }

    logger.info(`Created aggregation: ${aggregation.id}`, {
      type: aggregationType,
      events: sourceEvents.length,
      severity,
    });

    return aggregation;
  }
}

// Export singleton instance
export const integrationEventAggregator = IntegrationEventAggregator.getInstance();
