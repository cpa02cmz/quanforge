/**
 * Cascading Failure Detector
 * 
 * Detects and alerts on potential cascading failures across services.
 * Analyzes failure patterns, correlations, and propagation to identify
 * systemic issues before they become critical.
 * 
 * Features:
 * - Failure pattern analysis
 * - Correlation detection across services
 * - Cascade prediction and early warning
 * - Automated isolation recommendations
 * 
 * @module services/reliability/cascadingFailureDetector
 */

import { createScopedLogger } from '../../utils/logger';
import { serviceRegistry, ServiceCriticality } from './serviceRegistry';
import { gracefulDegradation, DegradationLevel, ServiceHealth } from './gracefulDegradation';
import { bulkheadManager, BulkheadState } from './bulkhead';

const logger = createScopedLogger('cascading-failure-detector');

/**
 * Failure severity level
 */
export enum FailureSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Failure record
 */
export interface FailureRecord {
  serviceName: string;
  timestamp: number;
  errorType: string;
  errorMessage: string;
  duration?: number;
  recovered: boolean;
  recoveryTime?: number;
}

/**
 * Correlation result
 */
export interface CorrelationResult {
  serviceA: string;
  serviceB: string;
  correlationScore: number;
  timeWindow: number;
  sharedFailures: number;
  pattern: 'simultaneous' | 'sequential' | 'periodic';
}

/**
 * Cascade prediction
 */
export interface CascadePrediction {
  probability: number;
  affectedServices: string[];
  rootCause: string;
  propagationPath: string[];
  estimatedImpact: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  confidence: number;
}

/**
 * Cascade alert
 */
export interface CascadeAlert {
  id: string;
  type: 'cascade_detected' | 'cascade_warning' | 'correlation_high' | 'isolation_recommended';
  severity: FailureSeverity;
  message: string;
  timestamp: number;
  services: string[];
  details: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
}

/**
 * Detector configuration
 */
export interface CascadingFailureConfig {
  /** Time window for correlation analysis (ms) */
  correlationWindow: number;
  /** Minimum failures to consider for pattern */
  minFailureThreshold: number;
  /** Correlation score threshold (0-1) */
  correlationThreshold: number;
  /** Time between pattern analyses (ms) */
  analysisInterval: number;
  /** Maximum failure history to keep */
  maxHistorySize: number;
  /** Enable automatic recommendations */
  enableAutoRecommendations: boolean;
  /** Callback for cascade alerts */
  onAlert?: (alert: CascadeAlert) => void;
}

/**
 * Service failure state
 */
interface ServiceFailureState {
  consecutiveFailures: number;
  lastFailureTime: number | null;
  totalFailures: number;
  recentFailures: FailureRecord[];
  isRecovering: boolean;
}

/**
 * Cascading Failure Detector
 */
export class CascadingFailureDetector {
  private config: CascadingFailureConfig;
  private failureHistory = new Map<string, ServiceFailureState>();
  private correlationCache = new Map<string, CorrelationResult>();
  private alerts: CascadeAlert[] = [];
  private analysisInterval?: ReturnType<typeof setInterval>;
  private alertCallbacks: Array<(alert: CascadeAlert) => void> = [];
  
  private readonly DEFAULT_CONFIG: CascadingFailureConfig = {
    correlationWindow: 5 * 60 * 1000, // 5 minutes
    minFailureThreshold: 3,
    correlationThreshold: 0.7,
    analysisInterval: 30 * 1000, // 30 seconds
    maxHistorySize: 1000,
    enableAutoRecommendations: true
  };

  constructor(config?: Partial<CascadingFailureConfig>) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    
    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Start monitoring for cascading failures
   */
  start(): void {
    if (this.analysisInterval) {
      logger.warn('Cascade detection already running');
      return;
    }

    this.analysisInterval = setInterval(() => {
      this.analyze();
    }, this.config.analysisInterval);

    logger.info('Cascading failure detection started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }
    logger.info('Cascading failure detection stopped');
  }

  /**
   * Record a failure event
   */
  recordFailure(
    serviceName: string,
    errorType: string,
    errorMessage: string,
    duration?: number
  ): void {
    const now = Date.now();
    
    let state = this.failureHistory.get(serviceName);
    if (!state) {
      state = {
        consecutiveFailures: 0,
        lastFailureTime: null,
        totalFailures: 0,
        recentFailures: [],
        isRecovering: false
      };
      this.failureHistory.set(serviceName, state);
    }

    state.consecutiveFailures++;
    state.totalFailures++;
    state.lastFailureTime = now;
    state.isRecovering = false;

    const failure: FailureRecord = {
      serviceName,
      timestamp: now,
      errorType,
      errorMessage,
      duration,
      recovered: false
    };

    state.recentFailures.push(failure);

    // Trim old failures
    if (state.recentFailures.length > this.config.maxHistorySize) {
      state.recentFailures = state.recentFailures.slice(-this.config.maxHistorySize);
    }

    // Check for immediate cascade indicators
    this.checkImmediateIndicators(serviceName, state);

    logger.debug(`Failure recorded for '${serviceName}': ${errorType}`);
  }

  /**
   * Record a recovery event
   */
  recordRecovery(serviceName: string): void {
    let state = this.failureHistory.get(serviceName);
    
    // Create state if it doesn't exist (for services that recover without prior failures)
    if (!state) {
      state = {
        consecutiveFailures: 0,
        lastFailureTime: null,
        totalFailures: 0,
        recentFailures: [],
        isRecovering: false
      };
      this.failureHistory.set(serviceName, state);
    }

    state.consecutiveFailures = 0;
    state.isRecovering = true;

    // Mark recent failures as recovered
    const now = Date.now();
    state.recentFailures.forEach(f => {
      if (!f.recovered) {
        f.recovered = true;
        f.recoveryTime = now - f.timestamp;
      }
    });

    logger.info(`Recovery recorded for '${serviceName}'`);
  }

  /**
   * Check for immediate cascade indicators
   */
  private checkImmediateIndicators(serviceName: string, state: ServiceFailureState): void {
    // Check for rapid failure accumulation
    if (state.consecutiveFailures >= this.config.minFailureThreshold) {
      this.createAlert({
        type: 'cascade_warning',
        severity: FailureSeverity.HIGH,
        message: `Service '${serviceName}' has ${state.consecutiveFailures} consecutive failures`,
        services: [serviceName],
        details: {
          consecutiveFailures: state.consecutiveFailures,
          lastError: state.recentFailures[state.recentFailures.length - 1]?.errorMessage
        }
      });
    }

    // Check for critical service failure
    const registration = serviceRegistry.getRegistration(serviceName);
    if (registration?.criticality === ServiceCriticality.CRITICAL) {
      this.checkDependentServices(serviceName);
    }
  }

  /**
   * Check services that depend on a failing service
   */
  private checkDependentServices(failedService: string): void {
    const dependents = serviceRegistry.getDependentServices(failedService);
    
    if (dependents.length > 0) {
      const atRiskServices: string[] = [];
      
      dependents.forEach(dep => {
        const depState = this.failureHistory.get(dep);
        const health = gracefulDegradation.getHealth(dep);
        
        if (health !== ServiceHealth.HEALTHY || (depState && depState.consecutiveFailures > 0)) {
          atRiskServices.push(dep);
        }
      });

      if (atRiskServices.length > 0) {
        this.createAlert({
          type: 'cascade_detected',
          severity: FailureSeverity.CRITICAL,
          message: `Critical service '${failedService}' failure may cascade to: ${atRiskServices.join(', ')}`,
          services: [failedService, ...atRiskServices],
          details: {
            rootCause: failedService,
            atRiskServices,
            propagationRisk: 'high'
          }
        });
      }
    }
  }

  /**
   * Perform full analysis
   */
  analyze(): CascadePrediction[] {
    const predictions: CascadePrediction[] = [];
    const now = Date.now();
    const windowStart = now - this.config.correlationWindow;

    // Analyze each service
    this.failureHistory.forEach((state, serviceName) => {
      // Get recent failures in window
      const recentFailures = state.recentFailures.filter(f => f.timestamp >= windowStart);
      
      if (recentFailures.length < this.config.minFailureThreshold) {
        return;
      }

      // Check correlations with other services
      this.analyzeCorrelations(serviceName, recentFailures);

      // Generate predictions
      const prediction = this.generatePrediction(serviceName, state);
      if (prediction) {
        predictions.push(prediction);
      }
    });

    // Update correlation cache
    this.updateCorrelationCache();

    return predictions;
  }

  /**
   * Analyze correlations between services
   */
  private analyzeCorrelations(
    serviceName: string,
    failures: FailureRecord[]
  ): Map<string, CorrelationResult> {
    const correlations = new Map<string, CorrelationResult>();
    const now = Date.now();
    const windowStart = now - this.config.correlationWindow;

    this.failureHistory.forEach((otherState, otherService) => {
      if (otherService === serviceName) return;

      const otherFailures = otherState.recentFailures.filter(f => f.timestamp >= windowStart);
      if (otherFailures.length < this.config.minFailureThreshold) return;

      // Calculate correlation score
      const correlation = this.calculateCorrelation(failures, otherFailures);
      
      if (correlation.score >= this.config.correlationThreshold) {
        const result: CorrelationResult = {
          serviceA: serviceName,
          serviceB: otherService,
          correlationScore: correlation.score,
          timeWindow: this.config.correlationWindow,
          sharedFailures: correlation.sharedCount,
          pattern: correlation.pattern
        };

        correlations.set(otherService, result);
        this.correlationCache.set(`${serviceName}-${otherService}`, result);
      }
    });

    return correlations;
  }

  /**
   * Calculate correlation between two failure sets
   */
  private calculateCorrelation(
    failuresA: FailureRecord[],
    failuresB: FailureRecord[]
  ): { score: number; sharedCount: number; pattern: 'simultaneous' | 'sequential' | 'periodic' } {
    const thresholdMs = 5000; // 5 seconds for "simultaneous"
    let simultaneousCount = 0;
    let sequentialCount = 0;

    failuresA.forEach(fa => {
      failuresB.forEach(fb => {
        const timeDiff = Math.abs(fa.timestamp - fb.timestamp);
        
        if (timeDiff <= thresholdMs) {
          simultaneousCount++;
        } else if (timeDiff <= this.config.correlationWindow / 10) {
          sequentialCount++;
        }
      });
    });

    const sharedCount = Math.max(simultaneousCount, sequentialCount);
    const maxPossible = Math.max(failuresA.length, failuresB.length);
    const score = maxPossible > 0 ? sharedCount / maxPossible : 0;

    const pattern = simultaneousCount >= sequentialCount ? 'simultaneous' : 'sequential';

    return { score, sharedCount, pattern };
  }

  /**
   * Generate cascade prediction for a service
   */
  private generatePrediction(
    serviceName: string,
    state: ServiceFailureState
  ): CascadePrediction | null {
    if (state.consecutiveFailures < this.config.minFailureThreshold) {
      return null;
    }

    const registration = serviceRegistry.getRegistration(serviceName);
    const dependents = serviceRegistry.getDependentServices(serviceName);
    
    // Calculate probability based on failure rate and criticality
    const failureRate = state.recentFailures.length / this.config.maxHistorySize;
    const criticalityMultiplier = registration?.criticality === ServiceCriticality.CRITICAL ? 1.5 :
                                   registration?.criticality === ServiceCriticality.HIGH ? 1.2 : 1;
    
    const probability = Math.min(1, failureRate * criticalityMultiplier * state.consecutiveFailures / 10);

    // Determine propagation path
    const propagationPath = this.calculatePropagationPath(serviceName);

    // Determine estimated impact
    const estimatedImpact = this.calculateImpact(serviceName, dependents);

    // Generate recommendations
    const recommendations = this.generateRecommendations(serviceName, state, dependents);

    return {
      probability,
      affectedServices: [serviceName, ...dependents],
      rootCause: serviceName,
      propagationPath,
      estimatedImpact,
      recommendations,
      confidence: Math.min(1, state.consecutiveFailures / 5)
    };
  }

  /**
   * Calculate failure propagation path
   */
  private calculatePropagationPath(rootService: string): string[] {
    const path = [rootService];
    const visited = new Set<string>([rootService]);
    const queue = [rootService];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = serviceRegistry.getDependentServices(current);

      dependents.forEach(dep => {
        if (!visited.has(dep)) {
          visited.add(dep);
          path.push(dep);
          queue.push(dep);
        }
      });
    }

    return path;
  }

  /**
   * Calculate impact severity
   */
  private calculateImpact(
    serviceName: string,
    dependents: string[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const registration = serviceRegistry.getRegistration(serviceName);
    
    // Check criticality
    if (registration?.criticality === ServiceCriticality.CRITICAL) {
      return 'critical';
    }

    // Check number of affected services
    if (dependents.length >= 5) {
      return 'high';
    } else if (dependents.length >= 2) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate recommendations for preventing cascade
   */
  private generateRecommendations(
    serviceName: string,
    state: ServiceFailureState,
    dependents: string[]
  ): string[] {
    const recommendations: string[] = [];

    // Check bulkhead status
    const bulkhead = bulkheadManager.get(serviceName);
    if (bulkhead) {
      const metrics = bulkhead.getMetrics();
      if (metrics.state === BulkheadState.CLOSED) {
        recommendations.push(
          `Bulkhead for '${serviceName}' is closed. Consider increasing capacity or queueing requests.`
        );
      }
    }

    // Check degradation level
    const degradationLevel = gracefulDegradation.getLevel(serviceName);
    if (degradationLevel && degradationLevel !== DegradationLevel.FULL) {
      recommendations.push(
        `Service '${serviceName}' is in ${degradationLevel} degradation mode. ` +
        `Consider activating fallback mechanisms.`
      );
    }

    // Check for isolation recommendation
    if (state.consecutiveFailures >= 5 && dependents.length > 0) {
      recommendations.push(
        `Consider isolating '${serviceName}' to prevent cascade to ${dependents.length} dependent services.`
      );
    }

    // Check for circuit breaker recommendation
    if (state.consecutiveFailures >= 3) {
      recommendations.push(
        `Circuit breaker should trip for '${serviceName}' to allow recovery.`
      );
    }

    return recommendations;
  }

  /**
   * Update correlation cache
   */
  private updateCorrelationCache(): void {
    const now = Date.now();
    const maxAge = this.config.correlationWindow * 2;

    // Remove old correlations
    const keysToRemove: string[] = [];
    this.correlationCache.forEach((_, key) => {
      // Check if either service has recent failures
      const [serviceA, serviceB] = key.split('-');
      const stateA = this.failureHistory.get(serviceA);
      const stateB = this.failureHistory.get(serviceB);
      
      const hasRecentFailuresA = stateA && stateA.lastFailureTime && 
        (now - stateA.lastFailureTime) < maxAge;
      const hasRecentFailuresB = stateB && stateB.lastFailureTime && 
        (now - stateB.lastFailureTime) < maxAge;

      if (!hasRecentFailuresA && !hasRecentFailuresB) {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => this.correlationCache.delete(key));
  }

  /**
   * Create and emit an alert
   */
  private createAlert(partial: Omit<CascadeAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const alert: CascadeAlert = {
      ...partial,
      id: `cascade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      acknowledged: false
    };

    this.alerts.push(alert);

    // Trim old alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log alert
    const logMethod = alert.severity === FailureSeverity.CRITICAL || 
                      alert.severity === FailureSeverity.HIGH ? 'error' : 'warn';
    logger[logMethod](`Cascade Alert [${alert.type}]: ${alert.message}`);

    // Emit to callbacks
    this.alertCallbacks.forEach(cb => {
      try {
        cb(alert);
      } catch (error: unknown) {
        logger.error('Alert callback error:', error);
      }
    });

    // Call config callback if set
    this.config.onAlert?.(alert);
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: CascadeAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Remove alert callback
   */
  offAlert(callback: (alert: CascadeAlert) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index !== -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = Date.now();

    logger.info(`Alert '${alertId}' acknowledged by ${acknowledgedBy || 'system'}`);
    return true;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): CascadeAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(limit?: number): CascadeAlert[] {
    return limit ? this.alerts.slice(-limit) : [...this.alerts];
  }

  /**
   * Get correlations for a service
   */
  getCorrelations(serviceName: string): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    
    this.correlationCache.forEach((correlation, key) => {
      if (key.startsWith(serviceName) || key.endsWith(serviceName)) {
        results.push(correlation);
      }
    });

    return results.sort((a, b) => b.correlationScore - a.correlationScore);
  }

  /**
   * Get service failure state
   */
  getServiceState(serviceName: string): ServiceFailureState | undefined {
    return this.failureHistory.get(serviceName);
  }

  /**
   * Get current cascade risk summary
   */
  getRiskSummary(): {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    servicesAtRisk: string[];
    topCorrelations: CorrelationResult[];
    activePredictions: CascadePrediction[];
    recentAlerts: CascadeAlert[];
  } {
    const predictions = this.analyze();
    const servicesAtRisk = predictions
      .filter(p => p.probability > 0.5)
      .flatMap(p => p.affectedServices);

    // Get top correlations
    const topCorrelations = Array.from(this.correlationCache.values())
      .sort((a, b) => b.correlationScore - a.correlationScore)
      .slice(0, 5);

    // Determine overall risk
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (predictions.some(p => p.probability > 0.8 || p.estimatedImpact === 'critical')) {
      overallRisk = 'critical';
    } else if (predictions.some(p => p.probability > 0.6 || p.estimatedImpact === 'high')) {
      overallRisk = 'high';
    } else if (predictions.some(p => p.probability > 0.3 || p.estimatedImpact === 'medium')) {
      overallRisk = 'medium';
    }

    return {
      overallRisk,
      servicesAtRisk: [...new Set(servicesAtRisk)],
      topCorrelations,
      activePredictions: predictions.filter(p => p.probability > 0.3),
      recentAlerts: this.alerts.slice(-10)
    };
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.failureHistory.clear();
    this.correlationCache.clear();
    this.alerts = [];
    logger.info('Cascading failure detector reset');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.stop();
    this.failureHistory.clear();
    this.correlationCache.clear();
    this.alerts = [];
    this.alertCallbacks = [];
    logger.info('Cascading failure detector destroyed');
  }
}

// Singleton instance
export const cascadingFailureDetector = new CascadingFailureDetector();

/**
 * Helper function to wrap a service call with cascade detection
 */
export function withCascadeDetection<T>(
  serviceName: string,
  fn: () => Promise<T>
): Promise<T> {
  return fn()
    .then(result => {
      cascadingFailureDetector.recordRecovery(serviceName);
      return result;
    })
    .catch(error => {
      cascadingFailureDetector.recordFailure(
        serviceName,
        error instanceof Error ? error.constructor.name : 'UnknownError',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    });
}
