/**
 * Reliability Orchestrator
 * 
 * Central coordinator for all reliability services.
 * Provides a unified interface for managing resilience across the application.
 * 
 * Features:
 * - Single entry point for reliability management
 * - Automatic service registration and configuration
 * - Cross-service event coordination
 * - System-wide health aggregation
 * - Simplified API for common reliability patterns
 * 
 * @module services/reliability/orchestrator
 */

import { createScopedLogger } from '../../utils/logger';
import { serviceRegistry, ServiceType, ServiceCriticality, registerCommonServices } from './serviceRegistry';
import { healthCheckScheduler, type HealthCheckResult } from './healthCheckScheduler';
import { rateLimiterManager, type RateLimiterConfig, type RateLimiterStatus, registerDefaultRateLimiters } from './rateLimiter';
import { selfHealingService, type HealingConfig, type HealingEvent } from './selfHealing';
import { cascadingFailureDetector, type CascadeAlert } from './cascadingFailureDetector';
import { gracefulDegradation, DegradationLevel, ServiceHealth } from './gracefulDegradation';
import { bulkheadManager, BulkheadState } from './bulkhead';
import { errorBudgetTracker, type SLOConfig, type ErrorBudgetStatus } from './errorBudgetTracker';
import { reliabilityDashboard, type SystemHealthStatus } from './dashboard';

const logger = createScopedLogger('reliability-orchestrator');

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Enable health checking */
  enableHealthChecks?: boolean;
  /** Enable rate limiting */
  enableRateLimiting?: boolean;
  /** Enable self-healing */
  enableSelfHealing?: boolean;
  /** Enable cascade detection */
  enableCascadeDetection?: boolean;
  /** Enable reliability dashboard */
  enableDashboard?: boolean;
  /** Auto-register common services */
  autoRegisterServices?: boolean;
  /** Health check interval for all services (ms) */
  defaultHealthCheckInterval?: number;
  /** Default rate limit tokens per second */
  defaultRateLimit?: number;
}

/**
 * Service reliability configuration
 */
export interface ServiceReliabilityConfig {
  /** Service name */
  name: string;
  /** Service type */
  type: ServiceType;
  /** Service criticality */
  criticality: ServiceCriticality;
  /** Health check configuration */
  healthCheck?: {
    interval?: number;
    timeout?: number;
    checkFn?: () => Promise<{ healthy: boolean; details?: Record<string, unknown> }>;
  } | false;
  /** Rate limiter configuration */
  rateLimiter?: RateLimiterConfig | false;
  /** Self-healing configuration */
  selfHealing?: Partial<HealingConfig> | false;
  /** Bulkhead configuration */
  bulkhead?: { maxConcurrentCalls?: number; maxWaitTime?: number; enableDegradation?: boolean } | false;
  /** SLO configuration */
  slo?: SLOConfig;
  /** Dependencies */
  dependencies?: string[];
}

/**
 * Orchestrated service status
 */
export interface OrchestratedServiceStatus {
  name: string;
  type: ServiceType;
  criticality: ServiceCriticality;
  health: {
    status: ServiceHealth;
    lastCheck: HealthCheckResult | null;
  };
  rateLimiter?: RateLimiterStatus;
  degradation: {
    level: DegradationLevel;
    health: ServiceHealth;
  };
  bulkhead?: {
    state: BulkheadState;
    availableSlots: number;
  };
  errorBudget?: ErrorBudgetStatus;
  healing: {
    isHealing: boolean;
    totalAttempts: number;
  };
}

/**
 * System reliability summary
 */
export interface SystemReliabilitySummary {
  timestamp: number;
  overallHealth: SystemHealthStatus;
  services: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    offline: number;
  };
  cascadeRisk: 'low' | 'medium' | 'high' | 'critical';
  activeHealing: number;
  throttledServices: number;
  errorBudgets: {
    healthy: number;
    atRisk: number;
    exhausted: number;
  };
  recommendations: string[];
}

/**
 * Default orchestrator configuration
 */
const DEFAULT_CONFIG: Required<OrchestratorConfig> = {
  enableHealthChecks: true,
  enableRateLimiting: true,
  enableSelfHealing: true,
  enableCascadeDetection: true,
  enableDashboard: true,
  autoRegisterServices: true,
  defaultHealthCheckInterval: 30000,
  defaultRateLimit: 50
};

/**
 * Reliability Orchestrator
 */
export class ReliabilityOrchestrator {
  private config: Required<OrchestratorConfig>;
  private registeredServices = new Map<string, ServiceReliabilityConfig>();
  private isInitialized = false;
  private static instance: ReliabilityOrchestrator | null = null;

  private constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<OrchestratorConfig>): ReliabilityOrchestrator {
    if (!ReliabilityOrchestrator.instance) {
      ReliabilityOrchestrator.instance = new ReliabilityOrchestrator(config);
    }
    return ReliabilityOrchestrator.instance;
  }

  /**
   * Initialize the orchestrator
   */
  initialize(): void {
    if (this.isInitialized) {
      logger.warn('Reliability orchestrator already initialized');
      return;
    }

    logger.info('Initializing reliability orchestrator...');

    // Register common services
    if (this.config.autoRegisterServices) {
      registerCommonServices();
      registerDefaultRateLimiters();
    }

    // Start cascade detection
    if (this.config.enableCascadeDetection) {
      cascadingFailureDetector.start();
    }

    // Set up event coordination
    this.setupEventCoordination();

    this.isInitialized = true;
    logger.info('Reliability orchestrator initialized successfully');
  }

  /**
   * Set up event coordination between services
   */
  private setupEventCoordination(): void {
    // Coordinate cascade alerts with self-healing
    if (this.config.enableCascadeDetection && this.config.enableSelfHealing) {
      cascadingFailureDetector.onAlert((alert: CascadeAlert) => {
        if (alert.severity === 'critical' || alert.severity === 'high') {
          alert.services.forEach(serviceName => {
            selfHealingService.triggerHealing(
              serviceName,
              `Cascade alert: ${alert.message}`
            );
          });
        }
      });
    }

    // Coordinate health check failures with healing
    if (this.config.enableHealthChecks && this.config.enableSelfHealing) {
      healthCheckScheduler.subscribe('service_unhealthy', (event) => {
        selfHealingService.triggerHealing(
          event.serviceName,
          'Service marked unhealthy by health checker'
        );
      });
    }

    // Coordinate healing events with cascade detection
    if (this.config.enableSelfHealing && this.config.enableCascadeDetection) {
      selfHealingService.subscribe('healing_success', (event: HealingEvent) => {
        cascadingFailureDetector.recordRecovery(event.serviceName);
      });

      selfHealingService.subscribe('healing_attempt', (event: HealingEvent) => {
        if (!event.details.success) {
          cascadingFailureDetector.recordFailure(
            event.serviceName,
            'healing_failure',
            event.details.error || 'Healing attempt failed'
          );
        }
      });
    }
  }

  /**
   * Register a service with full reliability configuration
   */
  registerService(config: ServiceReliabilityConfig): void {
    if (this.registeredServices.has(config.name)) {
      logger.warn(`Service '${config.name}' already registered, updating configuration`);
    }

    // Register with service registry
    serviceRegistry.register({
      name: config.name,
      type: config.type,
      criticality: config.criticality,
      dependencies: config.dependencies,
      autoRecoveryEnabled: this.config.enableSelfHealing
    });

    // Register health checking
    if (this.config.enableHealthChecks && config.healthCheck !== false) {
      const healthConfig = config.healthCheck;
      healthCheckScheduler.register(
        config.name,
        {
          interval: healthConfig?.interval ?? this.config.defaultHealthCheckInterval,
          timeout: healthConfig?.timeout ?? 5000
        },
        healthConfig?.checkFn
      );
    }

    // Register rate limiting
    if (this.config.enableRateLimiting && config.rateLimiter !== false) {
      const rateConfig: RateLimiterConfig = config.rateLimiter ?? {
        tokensPerSecond: this.config.defaultRateLimit,
        maxTokens: this.config.defaultRateLimit * 2,
        enableQueue: true,
        maxQueueSize: 50
      };
      rateLimiterManager.register(config.name, rateConfig);
    }

    // Register self-healing
    if (this.config.enableSelfHealing && config.selfHealing !== false) {
      selfHealingService.register(config.name, config.selfHealing);
    }

    // Register bulkhead
    if (config.bulkhead !== false) {
      const bulkheadConfig = config.bulkhead ?? {
        maxConcurrentCalls: config.criticality === ServiceCriticality.CRITICAL ? 50 : 20,
        maxWaitTime: 5000,
        enableDegradation: true
      };
      bulkheadManager.register(config.name, {
        maxConcurrentCalls: bulkheadConfig.maxConcurrentCalls ?? 20,
        maxWaitTime: bulkheadConfig.maxWaitTime ?? 5000,
        enableDegradation: bulkheadConfig.enableDegradation ?? true
      });
    }

    // Register SLO
    if (config.slo) {
      errorBudgetTracker.registerService(config.slo);
    }

    this.registeredServices.set(config.name, config);
    logger.info(`Service '${config.name}' registered with reliability configuration`);
  }

  /**
   * Unregister a service
   */
  unregisterService(serviceName: string): void {
    if (!this.registeredServices.has(serviceName)) {
      logger.warn(`Service '${serviceName}' not registered`);
      return;
    }

    serviceRegistry.unregister(serviceName);
    healthCheckScheduler.unregister(serviceName);
    rateLimiterManager.remove(serviceName);
    selfHealingService.unregister(serviceName);
    // Note: BulkheadManager doesn't have unregister method

    this.registeredServices.delete(serviceName);
    logger.info(`Service '${serviceName}' unregistered`);
  }

  /**
   * Execute a function with full reliability protection
   */
  async executeWithReliability<T>(
    serviceName: string,
    fn: () => Promise<T>,
    options?: {
      skipRateLimit?: boolean;
      skipBulkhead?: boolean;
      skipHealing?: boolean;
    }
  ): Promise<T> {
    const config = this.registeredServices.get(serviceName);
    if (!config) {
      logger.debug(`Service '${serviceName}' not registered, executing without reliability`);
      return fn();
    }

    // Check rate limit
    if (this.config.enableRateLimiting && !options?.skipRateLimit && config.rateLimiter !== false) {
      const allowed = await rateLimiterManager.consume(serviceName);
      if (!allowed) {
        throw new Error(`Rate limit exceeded for service '${serviceName}'`);
      }
    }

    // Execute with bulkhead
    if (!options?.skipBulkhead && config.bulkhead !== false) {
      const bulkhead = bulkheadManager.get(serviceName);
      if (bulkhead) {
        return bulkhead.execute(async () => {
          return this.executeWithHealing(serviceName, fn, options?.skipHealing);
        });
      }
    }

    return this.executeWithHealing(serviceName, fn, options?.skipHealing);
  }

  /**
   * Execute with self-healing support
   */
  private async executeWithHealing<T>(
    serviceName: string,
    fn: () => Promise<T>,
    skipHealing?: boolean
  ): Promise<T> {
    try {
      const result = await fn();
      
      // Record success
      cascadingFailureDetector.recordRecovery(serviceName);
      
      return result;
    } catch (error: unknown) {
      // Record failure
      cascadingFailureDetector.recordFailure(
        serviceName,
        error instanceof Error ? error.constructor.name : 'UnknownError',
        error instanceof Error ? error.message : String(error)
      );

      // Trigger healing
      if (this.config.enableSelfHealing && !skipHealing) {
        selfHealingService.triggerHealing(
          serviceName,
          `Execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      throw error;
    }
  }

  /**
   * Get status for a specific service
   */
  getServiceStatus(serviceName: string): OrchestratedServiceStatus | null {
    const config = this.registeredServices.get(serviceName);
    if (!config) return null;

    const registryStatus = serviceRegistry.getStatus(serviceName);
    const healthStatus = healthCheckScheduler.getHealth(serviceName);
    const rateLimiterStatus = rateLimiterManager.get(serviceName)?.getStatus();
    const degradationMetrics = gracefulDegradation.getMetrics(serviceName);
    const bulkhead = bulkheadManager.get(serviceName);
    const errorBudgetStatus = errorBudgetTracker.getStatus(serviceName);
    const healingStatus = selfHealingService.getStatus(serviceName);

    return {
      name: serviceName,
      type: config.type,
      criticality: config.criticality,
      health: {
        status: registryStatus?.health ?? ServiceHealth.HEALTHY,
        lastCheck: healthStatus?.lastCheck ?? null
      },
      rateLimiter: rateLimiterStatus,
      degradation: {
        level: degradationMetrics?.level ?? DegradationLevel.FULL,
        health: degradationMetrics?.health ?? ServiceHealth.HEALTHY
      },
      bulkhead: bulkhead ? {
        state: bulkhead.getState(),
        availableSlots: bulkhead.getMetrics().availableSlots
      } : undefined,
      errorBudget: errorBudgetStatus ?? undefined,
      healing: {
        isHealing: healingStatus?.isHealing ?? false,
        totalAttempts: healingStatus?.totalAttempts ?? 0
      }
    };
  }

  /**
   * Get all service statuses
   */
  getAllServiceStatuses(): OrchestratedServiceStatus[] {
    const statuses: OrchestratedServiceStatus[] = [];
    this.registeredServices.forEach((_, serviceName) => {
      const status = this.getServiceStatus(serviceName);
      if (status) statuses.push(status);
    });
    return statuses;
  }

  /**
   * Get system reliability summary
   */
  getSystemSummary(): SystemReliabilitySummary {
    const statuses = this.getAllServiceStatuses();
    const now = Date.now();

    // Count services by health
    const serviceCounts = {
      total: statuses.length,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      offline: 0
    };

    statuses.forEach(status => {
      switch (status.health.status) {
        case ServiceHealth.HEALTHY:
          serviceCounts.healthy++;
          break;
        case ServiceHealth.DEGRADED:
          serviceCounts.degraded++;
          break;
        case ServiceHealth.UNHEALTHY:
          serviceCounts.unhealthy++;
          break;
        case ServiceHealth.OFFLINE:
          serviceCounts.offline++;
          break;
      }
    });

    // Get cascade risk
    const riskSummary = cascadingFailureDetector.getRiskSummary();

    // Count active healing
    const activeHealing = statuses.filter(s => s.healing.isHealing).length;

    // Count throttled services
    const throttledServices = statuses.filter(
      s => s.rateLimiter?.isThrottled
    ).length;

    // Count error budget states
    const errorBudgetCounts = {
      healthy: 0,
      atRisk: 0,
      exhausted: 0
    };

    statuses.forEach(status => {
      if (status.errorBudget) {
        const budgetRatio = status.errorBudget.remainingBudget / status.errorBudget.totalBudget;
        if (budgetRatio > 0.5) {
          errorBudgetCounts.healthy++;
        } else if (budgetRatio > 0) {
          errorBudgetCounts.atRisk++;
        } else {
          errorBudgetCounts.exhausted++;
        }
      }
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations(statuses, riskSummary);

    // Determine overall health
    let overallHealth: SystemHealthStatus;
    if (serviceCounts.offline > 0 || riskSummary.overallRisk === 'critical') {
      overallHealth = 'critical';
    } else if (serviceCounts.unhealthy > 0 || riskSummary.overallRisk === 'high') {
      overallHealth = 'unhealthy';
    } else if (serviceCounts.degraded > 0 || riskSummary.overallRisk === 'medium') {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'healthy';
    }

    return {
      timestamp: now,
      overallHealth,
      services: serviceCounts,
      cascadeRisk: riskSummary.overallRisk,
      activeHealing,
      throttledServices,
      errorBudgets: errorBudgetCounts,
      recommendations
    };
  }

  /**
   * Generate recommendations based on current state
   */
  private generateRecommendations(
    statuses: OrchestratedServiceStatus[],
    riskSummary: { overallRisk: string; servicesAtRisk: string[] }
  ): string[] {
    const recommendations: string[] = [];

    // Critical services offline
    const criticalOffline = statuses.filter(
      s => s.criticality === ServiceCriticality.CRITICAL &&
           (s.health.status === ServiceHealth.OFFLINE || s.health.status === ServiceHealth.UNHEALTHY)
    );
    if (criticalOffline.length > 0) {
      recommendations.push(
        `CRITICAL: Services ${criticalOffline.map(s => s.name).join(', ')} require immediate attention`
      );
    }

    // Cascade risk
    if (riskSummary.overallRisk === 'high' || riskSummary.overallRisk === 'critical') {
      recommendations.push(
        `High cascade risk detected. Services at risk: ${riskSummary.servicesAtRisk.join(', ')}`
      );
    }

    // Rate limiting
    const throttledServices = statuses.filter(s => s.rateLimiter?.isThrottled);
    if (throttledServices.length > 0) {
      recommendations.push(
        `Services experiencing rate limiting: ${throttledServices.map(s => s.name).join(', ')}. Consider increasing limits.`
      );
    }

    // Error budgets
    const exhaustedBudgets = statuses.filter(s => 
      s.errorBudget && s.errorBudget.remainingBudget <= 0
    );
    if (exhaustedBudgets.length > 0) {
      recommendations.push(
        `Error budget exhausted for: ${exhaustedBudgets.map(s => s.name).join(', ')}. SLA at risk.`
      );
    }

    // Active healing
    const activeHealing = statuses.filter(s => s.healing.isHealing);
    if (activeHealing.length > 0) {
      recommendations.push(
        `Self-healing in progress for: ${activeHealing.map(s => s.name).join(', ')}`
      );
    }

    return recommendations;
  }

  /**
   * Start all monitoring
   */
  startMonitoring(): void {
    if (this.config.enableHealthChecks) {
      healthCheckScheduler.startAll();
    }
    if (this.config.enableCascadeDetection) {
      cascadingFailureDetector.start();
    }
    logger.info('Reliability monitoring started');
  }

  /**
   * Stop all monitoring
   */
  stopMonitoring(): void {
    healthCheckScheduler.stopAll();
    cascadingFailureDetector.stop();
    logger.info('Reliability monitoring stopped');
  }

  /**
   * Check if orchestrator is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get registered service count
   */
  getServiceCount(): number {
    return this.registeredServices.size;
  }

  /**
   * Reset all reliability services
   */
  reset(): void {
    serviceRegistry.reset();
    healthCheckScheduler.reset();
    rateLimiterManager.resetAll();
    selfHealingService.reset();
    cascadingFailureDetector.reset();
    gracefulDegradation.resetAll();
    errorBudgetTracker.reset();
    bulkheadManager.resetAll();
    reliabilityDashboard.reset();
    logger.info('All reliability services reset');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.stopMonitoring();
    serviceRegistry.destroy();
    healthCheckScheduler.destroy();
    rateLimiterManager.destroy();
    selfHealingService.destroy();
    cascadingFailureDetector.destroy();
    gracefulDegradation.destroy();
    errorBudgetTracker.destroy();
    // Note: BulkheadManager and ReliabilityDashboard don't have destroy method
    this.registeredServices.clear();
    this.isInitialized = false;
    ReliabilityOrchestrator.instance = null;
    logger.info('Reliability orchestrator destroyed');
  }
}

// Export singleton instance
export const reliabilityOrchestrator = ReliabilityOrchestrator.getInstance();

/**
 * Helper function to register a service with default configuration
 */
export function registerReliableService(
  name: string,
  type: ServiceType,
  criticality: ServiceCriticality,
  options?: Partial<ServiceReliabilityConfig>
): void {
  reliabilityOrchestrator.registerService({
    name,
    type,
    criticality,
    ...options
  });
}

/**
 * Helper function to execute with reliability
 */
export function withOrchestratedReliability<T>(
  serviceName: string,
  fn: () => Promise<T>
): Promise<T> {
  return reliabilityOrchestrator.executeWithReliability(serviceName, fn);
}
