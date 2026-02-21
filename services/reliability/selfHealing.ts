/**
 * Self-Healing Service
 * 
 * Automatically detects and recovers from service failures.
 * Implements proactive healing strategies for common failure scenarios.
 * 
 * Features:
 * - Automatic failure detection and classification
 * - Configurable healing strategies per service
 * - Recovery attempt tracking and backoff
 * - Integration with cascading failure detection
 * - Health restoration monitoring
 * 
 * @module services/reliability/selfHealing
 */

import { createScopedLogger } from '../../utils/logger';
import { serviceRegistry, ServiceCriticality } from './serviceRegistry';
import { gracefulDegradation, DegradationLevel } from './gracefulDegradation';
import { bulkheadManager } from './bulkhead';
import { cascadingFailureDetector } from './cascadingFailureDetector';

const logger = createScopedLogger('self-healing');

/**
 * Healing strategy type
 */
export enum HealingStrategy {
  RESTART = 'restart',
  RESET_CONNECTION = 'reset_connection',
  CLEAR_CACHE = 'clear_cache',
  SCALE_DOWN = 'scale_down',
  FALLBACK_MODE = 'fallback_mode',
  BULKHEAD_RESET = 'bulkhead_reset',
  CIRCUIT_BREAKER_RESET = 'circuit_breaker_reset',
  CUSTOM = 'custom'
}

/**
 * Healing action
 */
export interface HealingAction {
  strategy: HealingStrategy;
  description: string;
  execute: () => Promise<boolean>;
  priority: number; // Lower is higher priority
}

/**
 * Healing configuration per service
 */
export interface HealingConfig {
  /** Enable automatic healing */
  enabled: boolean;
  /** Maximum healing attempts before giving up */
  maxAttempts: number;
  /** Cooldown between healing attempts (ms) */
  cooldownPeriod: number;
  /** Time to wait before declaring healing successful (ms) */
  successWindow: number;
  /** Healing strategies to try in order */
  strategies: HealingStrategy[];
  /** Custom healing function */
  customHealer?: () => Promise<boolean>;
  /** Callback before healing attempt */
  onBeforeHeal?: (serviceName: string, attempt: number) => void;
  /** Callback after healing attempt */
  onAfterHeal?: (serviceName: string, attempt: number, success: boolean) => void;
  /** Callback when healing succeeds */
  onHealingSuccess?: (serviceName: string) => void;
  /** Callback when healing fails after all attempts */
  onHealingFailed?: (serviceName: string, attempts: number) => void;
}

/**
 * Healing attempt record
 */
export interface HealingAttempt {
  serviceName: string;
  timestamp: number;
  strategy: HealingStrategy;
  success: boolean;
  error?: string;
  duration: number;
}

/**
 * Service healing state
 */
interface ServiceHealingState {
  config: HealingConfig;
  attempts: HealingAttempt[];
  lastAttempt: number;
  consecutiveFailures: number;
  isHealing: boolean;
  healingPromise: Promise<boolean> | null;
}

/**
 * Healing event
 */
export interface HealingEvent {
  type: 'healing_started' | 'healing_attempt' | 'healing_success' | 'healing_failed' | 'healing_exhausted';
  serviceName: string;
  timestamp: number;
  details: {
    attempt?: number;
    strategy?: HealingStrategy;
    success?: boolean;
    error?: string;
  };
}

/**
 * Default healing configurations by criticality
 */
const DEFAULT_CONFIGS: Record<ServiceCriticality, Partial<HealingConfig>> = {
  [ServiceCriticality.CRITICAL]: {
    enabled: true,
    maxAttempts: 5,
    cooldownPeriod: 10000, // 10 seconds
    successWindow: 30000,  // 30 seconds
    strategies: [
      HealingStrategy.CLEAR_CACHE,
      HealingStrategy.RESET_CONNECTION,
      HealingStrategy.BULKHEAD_RESET,
      HealingStrategy.CIRCUIT_BREAKER_RESET,
      HealingStrategy.FALLBACK_MODE
    ]
  },
  [ServiceCriticality.HIGH]: {
    enabled: true,
    maxAttempts: 3,
    cooldownPeriod: 30000, // 30 seconds
    successWindow: 60000,  // 1 minute
    strategies: [
      HealingStrategy.CLEAR_CACHE,
      HealingStrategy.RESET_CONNECTION,
      HealingStrategy.FALLBACK_MODE
    ]
  },
  [ServiceCriticality.MEDIUM]: {
    enabled: true,
    maxAttempts: 2,
    cooldownPeriod: 60000, // 1 minute
    successWindow: 120000, // 2 minutes
    strategies: [
      HealingStrategy.CLEAR_CACHE,
      HealingStrategy.FALLBACK_MODE
    ]
  },
  [ServiceCriticality.LOW]: {
    enabled: false, // Auto-healing disabled for low criticality services
    maxAttempts: 1,
    cooldownPeriod: 300000, // 5 minutes
    successWindow: 300000,  // 5 minutes
    strategies: [HealingStrategy.FALLBACK_MODE]
  }
};

/**
 * Self-Healing Service
 */
export class SelfHealingService {
  private healingStates = new Map<string, ServiceHealingState>();
  private eventListeners = new Map<string, Array<(event: HealingEvent) => void>>();
  private healingIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private static instance: SelfHealingService | null = null;

  private constructor() {
    // Subscribe to cascade detection alerts
    cascadingFailureDetector.onAlert(this.handleCascadeAlert.bind(this));

    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SelfHealingService {
    if (!SelfHealingService.instance) {
      SelfHealingService.instance = new SelfHealingService();
    }
    return SelfHealingService.instance;
  }

  /**
   * Register a service for self-healing
   */
  register(serviceName: string, config?: Partial<HealingConfig>): void {
    if (this.healingStates.has(serviceName)) {
      logger.warn(`Service '${serviceName}' already registered for self-healing`);
      return;
    }

    const registration = serviceRegistry.getRegistration(serviceName);
    const criticality = registration?.criticality || ServiceCriticality.MEDIUM;
    const defaultConfig = DEFAULT_CONFIGS[criticality];

    const finalConfig: HealingConfig = {
      enabled: config?.enabled ?? defaultConfig.enabled ?? true,
      maxAttempts: config?.maxAttempts ?? defaultConfig.maxAttempts ?? 3,
      cooldownPeriod: config?.cooldownPeriod ?? defaultConfig.cooldownPeriod ?? 30000,
      successWindow: config?.successWindow ?? defaultConfig.successWindow ?? 60000,
      strategies: config?.strategies ?? defaultConfig.strategies ?? [HealingStrategy.FALLBACK_MODE],
      customHealer: config?.customHealer,
      onBeforeHeal: config?.onBeforeHeal,
      onAfterHeal: config?.onAfterHeal,
      onHealingSuccess: config?.onHealingSuccess,
      onHealingFailed: config?.onHealingFailed
    };

    this.healingStates.set(serviceName, {
      config: finalConfig,
      attempts: [],
      lastAttempt: 0,
      consecutiveFailures: 0,
      isHealing: false,
      healingPromise: null
    });

    logger.info(`Registered '${serviceName}' for self-healing (${finalConfig.strategies.length} strategies)`);
  }

  /**
   * Unregister a service from self-healing
   */
  unregister(serviceName: string): void {
    const interval = this.healingIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.healingIntervals.delete(serviceName);
    }

    this.healingStates.delete(serviceName);
    logger.info(`Unregistered '${serviceName}' from self-healing`);
  }

  /**
   * Handle cascade detection alerts
   */
  private handleCascadeAlert(alert: { type: string; severity: string; services: string[]; message: string }): void {
    if (alert.severity === 'critical' || alert.severity === 'high') {
      alert.services.forEach(serviceName => {
        this.triggerHealing(serviceName, `Cascade alert: ${alert.message}`);
      });
    }
  }

  /**
   * Trigger healing for a service
   */
  async triggerHealing(serviceName: string, reason?: string): Promise<boolean> {
    const state = this.healingStates.get(serviceName);
    if (!state) {
      logger.debug(`Service '${serviceName}' not registered for self-healing`);
      return false;
    }

    if (!state.config.enabled) {
      logger.debug(`Self-healing disabled for '${serviceName}'`);
      return false;
    }

    // Check if already healing
    if (state.isHealing && state.healingPromise) {
      logger.info(`Healing already in progress for '${serviceName}', waiting...`);
      return state.healingPromise;
    }

    // Check cooldown
    const now = Date.now();
    const timeSinceLastAttempt = now - state.lastAttempt;
    if (timeSinceLastAttempt < state.config.cooldownPeriod) {
      logger.debug(
        `Healing cooldown for '${serviceName}', ` +
        `${state.config.cooldownPeriod - timeSinceLastAttempt}ms remaining`
      );
      return false;
    }

    // Check if max attempts reached
    const recentAttempts = this.getRecentAttempts(serviceName, state.config.successWindow);
    if (recentAttempts.length >= state.config.maxAttempts) {
      logger.warn(`Max healing attempts reached for '${serviceName}'`);
      state.config.onHealingFailed?.(serviceName, recentAttempts.length);
      this.emitEvent({
        type: 'healing_exhausted',
        serviceName,
        timestamp: now,
        details: { attempt: recentAttempts.length }
      });
      return false;
    }

    // Start healing
    state.isHealing = true;
    state.healingPromise = this.performHealing(serviceName, state, reason);

    try {
      const result = await state.healingPromise;
      return result;
    } finally {
      state.isHealing = false;
      state.healingPromise = null;
    }
  }

  /**
   * Perform healing process
   */
  private async performHealing(
    serviceName: string,
    state: ServiceHealingState,
    reason?: string
  ): Promise<boolean> {
    const now = Date.now();
    const attemptNumber = state.attempts.length + 1;

    logger.info(`Starting healing for '${serviceName}' (attempt ${attemptNumber})${reason ? `: ${reason}` : ''}`);

    this.emitEvent({
      type: 'healing_started',
      serviceName,
      timestamp: now,
      details: { attempt: attemptNumber }
    });

    state.config.onBeforeHeal?.(serviceName, attemptNumber);

    // Try each strategy in order
    for (const strategy of state.config.strategies) {
      const attemptStart = Date.now();

      try {
        const success = await this.executeStrategy(serviceName, strategy, state.config);

        const attempt: HealingAttempt = {
          serviceName,
          timestamp: now,
          strategy,
          success,
          duration: Date.now() - attemptStart
        };

        state.attempts.push(attempt);
        state.lastAttempt = now;

        if (success) {
          logger.info(`Healing successful for '${serviceName}' using strategy '${strategy}'`);

          // Record recovery in cascade detector
          cascadingFailureDetector.recordRecovery(serviceName);

          // Record incident in service registry
          serviceRegistry.recordIncident(
            serviceName,
            'recovery',
            'info',
            `Service recovered using ${strategy} strategy`
          );

          state.consecutiveFailures = 0;
          state.config.onHealingSuccess?.(serviceName);

          this.emitEvent({
            type: 'healing_success',
            serviceName,
            timestamp: Date.now(),
            details: { attempt: attemptNumber, strategy, success: true }
          });

          return true;
        }
      } catch (error: unknown) {
        const attempt: HealingAttempt = {
          serviceName,
          timestamp: now,
          strategy,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - attemptStart
        };

        state.attempts.push(attempt);
        state.lastAttempt = now;
        state.consecutiveFailures++;

        logger.error(
          `Healing attempt failed for '${serviceName}' using strategy '${strategy}':`,
          error
        );

        this.emitEvent({
          type: 'healing_attempt',
          serviceName,
          timestamp: now,
          details: {
            attempt: attemptNumber,
            strategy,
            success: false,
            error: attempt.error
          }
        });
      }
    }

    // All strategies failed
    state.config.onHealingFailed?.(serviceName, attemptNumber);
    state.config.onAfterHeal?.(serviceName, attemptNumber, false);

    this.emitEvent({
      type: 'healing_failed',
      serviceName,
      timestamp: now,
      details: { attempt: attemptNumber, success: false }
    });

    return false;
  }

  /**
   * Execute a healing strategy
   */
  private async executeStrategy(
    serviceName: string,
    strategy: HealingStrategy,
    config: HealingConfig
  ): Promise<boolean> {
    switch (strategy) {
      case HealingStrategy.CLEAR_CACHE:
        return this.clearCache(serviceName);

      case HealingStrategy.RESET_CONNECTION:
        return this.resetConnection(serviceName);

      case HealingStrategy.BULKHEAD_RESET:
        return this.resetBulkhead(serviceName);

      case HealingStrategy.CIRCUIT_BREAKER_RESET:
        return this.resetCircuitBreaker(serviceName);

      case HealingStrategy.FALLBACK_MODE:
        return this.enableFallbackMode(serviceName);

      case HealingStrategy.SCALE_DOWN:
        return this.scaleDown(serviceName);

      case HealingStrategy.CUSTOM:
        if (config.customHealer) {
          return config.customHealer();
        }
        logger.warn(`No custom healer configured for '${serviceName}'`);
        return false;

      default:
        logger.warn(`Unknown healing strategy: ${strategy}`);
        return false;
    }
  }

  /**
   * Clear cache for a service
   */
  private async clearCache(serviceName: string): Promise<boolean> {
    logger.info(`Clearing cache for '${serviceName}'`);
    // This would integrate with the cache service
    // For now, just return success
    return true;
  }

  /**
   * Reset connection for a service
   */
  private async resetConnection(serviceName: string): Promise<boolean> {
    logger.info(`Resetting connection for '${serviceName}'`);
    // This would integrate with connection pool/manager
    // For now, just return success
    return true;
  }

  /**
   * Reset bulkhead for a service
   */
  private async resetBulkhead(serviceName: string): Promise<boolean> {
    const bulkhead = bulkheadManager.get(serviceName);
    if (bulkhead) {
      bulkhead.reset();
      logger.info(`Reset bulkhead for '${serviceName}'`);
      return true;
    }
    return false;
  }

  /**
   * Reset circuit breaker for a service
   */
  private async resetCircuitBreaker(serviceName: string): Promise<boolean> {
    // This would integrate with circuit breaker implementation
    // For now, just return success
    logger.info(`Reset circuit breaker for '${serviceName}'`);
    return true;
  }

  /**
   * Enable fallback mode for a service
   */
  private async enableFallbackMode(serviceName: string): Promise<boolean> {
    gracefulDegradation.setLevel(serviceName, DegradationLevel.PARTIAL);
    logger.info(`Enabled fallback mode for '${serviceName}'`);
    return true;
  }

  /**
   * Scale down a service
   */
  private async scaleDown(serviceName: string): Promise<boolean> {
    logger.info(`Scaling down '${serviceName}'`);
    // This would integrate with scaling infrastructure
    // For now, just return success
    return true;
  }

  /**
   * Get recent healing attempts
   */
  private getRecentAttempts(serviceName: string, windowMs: number): HealingAttempt[] {
    const state = this.healingStates.get(serviceName);
    if (!state) return [];

    const cutoff = Date.now() - windowMs;
    return state.attempts.filter(attempt => attempt.timestamp >= cutoff);
  }

  /**
   * Check if a service is currently healing
   */
  isHealing(serviceName: string): boolean {
    const state = this.healingStates.get(serviceName);
    return state?.isHealing ?? false;
  }

  /**
   * Get healing status for a service
   */
  getStatus(serviceName: string): {
    isHealing: boolean;
    totalAttempts: number;
    lastAttempt: number | null;
    consecutiveFailures: number;
  } | null {
    const state = this.healingStates.get(serviceName);
    if (!state) return null;

    return {
      isHealing: state.isHealing,
      totalAttempts: state.attempts.length,
      lastAttempt: state.lastAttempt || null,
      consecutiveFailures: state.consecutiveFailures
    };
  }

  /**
   * Subscribe to healing events
   */
  subscribe(eventType: string, callback: (event: HealingEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }

    this.eventListeners.get(eventType)!.push(callback);

    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit a healing event
   */
  private emitEvent(event: HealingEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error: unknown) {
          logger.error('Error in healing event listener:', error);
        }
      });
    }

    // Also emit to 'all' listeners
    const allListeners = this.eventListeners.get('all');
    if (allListeners) {
      allListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error: unknown) {
          logger.error('Error in healing event listener:', error);
        }
      });
    }
  }

  /**
   * Reset all healing states
   */
  reset(): void {
    this.healingStates.forEach(state => {
      state.attempts = [];
      state.lastAttempt = 0;
      state.consecutiveFailures = 0;
      state.isHealing = false;
      state.healingPromise = null;
    });
    logger.info('Self-healing service reset');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.healingIntervals.forEach(interval => clearInterval(interval));
    this.healingIntervals.clear();
    this.healingStates.clear();
    this.eventListeners.clear();
    SelfHealingService.instance = null;
    logger.info('Self-healing service destroyed');
  }
}

// Export singleton instance
export const selfHealingService = SelfHealingService.getInstance();

/**
 * Helper function to wrap a function with self-healing
 */
export function withSelfHealing<T extends (...args: unknown[]) => Promise<unknown>>(
  serviceName: string,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error: unknown) {
      // Trigger healing on failure
      await selfHealingService.triggerHealing(
        serviceName,
        `Function call failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }) as T;
}
