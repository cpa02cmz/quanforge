/**
 * Backend Circuit Breaker Coordinator
 * 
 * Provides centralized circuit breaker management with:
 * - Per-service circuit breaker instances
 * - Circuit state coordination
 * - Automatic recovery management
 * - Metrics collection
 * - Event-driven notifications
 * - Fallback strategy integration
 * 
 * @module services/backend/circuitBreakerCoordinator
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('CircuitBreakerCoordinator');

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half_open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  serviceName: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms
  resetTimeout: number; // ms to wait before attempting to close
  halfOpenMaxCalls: number;
}

/**
 * Circuit breaker status
 */
export interface CircuitBreakerStatus {
  serviceName: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastStateChange: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  timeoutCalls: number;
}

/**
 * Circuit breaker event
 */
export interface CircuitBreakerEvent {
  type: 'state_change' | 'call_success' | 'call_failure' | 'call_rejected' | 'call_timeout';
  serviceName: string;
  timestamp: number;
  data: {
    previousState?: CircuitState;
    newState?: CircuitState;
    error?: string;
    duration?: number;
  };
}

/**
 * Default circuit breaker configurations for common services
 */
export const DEFAULT_CIRCUIT_CONFIGS: Record<string, Partial<CircuitBreakerConfig>> = {
  database: {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,
    resetTimeout: 30000,
    halfOpenMaxCalls: 3,
  },
  ai_service: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000,
    resetTimeout: 60000,
    halfOpenMaxCalls: 2,
  },
  cache: {
    failureThreshold: 10,
    successThreshold: 5,
    timeout: 5000,
    resetTimeout: 10000,
    halfOpenMaxCalls: 5,
  },
  market_data: {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 15000,
    resetTimeout: 20000,
    halfOpenMaxCalls: 3,
  },
  external_api: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000,
    resetTimeout: 45000,
    halfOpenMaxCalls: 2,
  },
  default: {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,
    resetTimeout: 30000,
    halfOpenMaxCalls: 3,
  },
};

/**
 * Internal circuit breaker instance
 */
interface CircuitBreakerInstance {
  config: CircuitBreakerConfig;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastStateChange: number;
  halfOpenCalls: number;
  stats: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    rejectedCalls: number;
    timeoutCalls: number;
  };
}

/**
 * Backend Circuit Breaker Coordinator
 * 
 * Singleton class that manages circuit breakers for all backend services.
 */
export class CircuitBreakerCoordinator {
  private static instance: CircuitBreakerCoordinator | null = null;

  private circuits: Map<string, CircuitBreakerInstance> = new Map();
  private eventListeners: Set<(event: CircuitBreakerEvent) => void> = new Set();
  private fallbacks: Map<string, (...args: unknown[]) => Promise<unknown>> = new Map();

  private constructor() {
    this.initializeDefaultCircuits();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): CircuitBreakerCoordinator {
    if (!CircuitBreakerCoordinator.instance) {
      CircuitBreakerCoordinator.instance = new CircuitBreakerCoordinator();
    }
    return CircuitBreakerCoordinator.instance;
  }

  /**
   * Configure a circuit breaker for a service
   */
  configureCircuit(config: CircuitBreakerConfig): void {
    const existingCircuit = this.circuits.get(config.serviceName);
    
    const circuit: CircuitBreakerInstance = {
      config,
      state: existingCircuit?.state || 'closed',
      failureCount: existingCircuit?.failureCount || 0,
      successCount: existingCircuit?.successCount || 0,
      lastFailureTime: existingCircuit?.lastFailureTime || null,
      lastStateChange: existingCircuit?.lastStateChange || Date.now(),
      halfOpenCalls: 0,
      stats: existingCircuit?.stats || {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        rejectedCalls: 0,
        timeoutCalls: 0,
      },
    };

    this.circuits.set(config.serviceName, circuit);
    logger.log(`Circuit breaker configured for ${config.serviceName}`);
  }

  /**
   * Register a fallback function for a service
   */
  registerFallback<T>(
    serviceName: string,
    fallback: (...args: unknown[]) => Promise<T>
  ): void {
    this.fallbacks.set(serviceName, fallback as (...args: unknown[]) => Promise<unknown>);
    logger.log(`Fallback registered for ${serviceName}`);
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(
    serviceName: string,
    fn: () => Promise<T>,
    fallbackArgs?: unknown[]
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(serviceName);
    const startTime = Date.now();

    // Check circuit state
    if (circuit.state === 'open') {
      // Check if we should try half-open
      if (circuit.lastFailureTime && 
          Date.now() - circuit.lastFailureTime >= circuit.config.resetTimeout) {
        this.transitionTo(serviceName, 'half_open');
      } else {
        // Reject the call
        circuit.stats.totalCalls++;
        circuit.stats.rejectedCalls++;
        
        this.emitEvent({
          type: 'call_rejected',
          serviceName,
          timestamp: Date.now(),
          data: { previousState: 'open', newState: 'open' },
        });

        // Try fallback if available
        if (this.fallbacks.has(serviceName) && fallbackArgs) {
          logger.debug(`Using fallback for ${serviceName}`);
          return this.fallbacks.get(serviceName)!(...fallbackArgs) as Promise<T>;
        }

        throw new Error(`Circuit breaker is OPEN for ${serviceName}`);
      }
    }

    // In half-open state, limit calls
    if (circuit.state === 'half_open') {
      if (circuit.halfOpenCalls >= circuit.config.halfOpenMaxCalls) {
        circuit.stats.totalCalls++;
        circuit.stats.rejectedCalls++;
        
        // Try fallback if available
        if (this.fallbacks.has(serviceName) && fallbackArgs) {
          return this.fallbacks.get(serviceName)!(...fallbackArgs) as Promise<T>;
        }

        throw new Error(`Circuit breaker is HALF_OPEN and at max calls for ${serviceName}`);
      }
      circuit.halfOpenCalls++;
    }

    // Execute the function
    circuit.stats.totalCalls++;

    try {
      // Add timeout wrapper
      const result = await this.executeWithTimeout(
        fn,
        circuit.config.timeout,
        serviceName
      );

      const duration = Date.now() - startTime;
      this.onSuccess(serviceName, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error instanceof Error && error.message.includes('timeout')) {
        this.onTimeout(serviceName, duration);
      } else {
        this.onFailure(serviceName, error as Error, duration);
      }

      // Try fallback if available
      if (this.fallbacks.has(serviceName) && fallbackArgs) {
        logger.debug(`Using fallback for ${serviceName} after error`);
        return this.fallbacks.get(serviceName)!(...fallbackArgs) as Promise<T>;
      }

      throw error;
    }
  }

  /**
   * Get circuit breaker status for a service
   */
  getStatus(serviceName: string): CircuitBreakerStatus | null {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) return null;

    return {
      serviceName,
      state: circuit.state,
      failureCount: circuit.failureCount,
      successCount: circuit.successCount,
      lastFailureTime: circuit.lastFailureTime,
      lastStateChange: circuit.lastStateChange,
      totalCalls: circuit.stats.totalCalls,
      successfulCalls: circuit.stats.successfulCalls,
      failedCalls: circuit.stats.failedCalls,
      rejectedCalls: circuit.stats.rejectedCalls,
      timeoutCalls: circuit.stats.timeoutCalls,
    };
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllStatuses(): CircuitBreakerStatus[] {
    const statuses: CircuitBreakerStatus[] = [];
    
    for (const serviceName of this.circuits.keys()) {
      const status = this.getStatus(serviceName);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  /**
   * Reset a circuit breaker
   */
  reset(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) return;

    const previousState = circuit.state;
    circuit.state = 'closed';
    circuit.failureCount = 0;
    circuit.successCount = 0;
    circuit.lastFailureTime = null;
    circuit.lastStateChange = Date.now();
    circuit.halfOpenCalls = 0;

    if (previousState !== 'closed') {
      this.emitEvent({
        type: 'state_change',
        serviceName,
        timestamp: Date.now(),
        data: { previousState, newState: 'closed' },
      });
    }

    logger.log(`Circuit breaker reset for ${serviceName}`);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const serviceName of this.circuits.keys()) {
      this.reset(serviceName);
    }
  }

  /**
   * Force open a circuit breaker (for maintenance)
   */
  forceOpen(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) return;

    const previousState = circuit.state;
    circuit.state = 'open';
    circuit.lastFailureTime = Date.now();
    circuit.lastStateChange = Date.now();

    this.emitEvent({
      type: 'state_change',
      serviceName,
      timestamp: Date.now(),
      data: { previousState, newState: 'open' },
    });

    logger.log(`Circuit breaker force opened for ${serviceName}`);
  }

  /**
   * Subscribe to circuit breaker events
   */
  subscribe(listener: (event: CircuitBreakerEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Get overall statistics
   */
  getStats(): {
    totalCircuits: number;
    openCircuits: number;
    halfOpenCircuits: number;
    closedCircuits: number;
    totalCalls: number;
    totalRejected: number;
    totalFailed: number;
  } {
    let openCircuits = 0;
    let halfOpenCircuits = 0;
    let closedCircuits = 0;
    let totalCalls = 0;
    let totalRejected = 0;
    let totalFailed = 0;

    for (const circuit of this.circuits.values()) {
      if (circuit.state === 'open') openCircuits++;
      else if (circuit.state === 'half_open') halfOpenCircuits++;
      else closedCircuits++;

      totalCalls += circuit.stats.totalCalls;
      totalRejected += circuit.stats.rejectedCalls;
      totalFailed += circuit.stats.failedCalls;
    }

    return {
      totalCircuits: this.circuits.size,
      openCircuits,
      halfOpenCircuits,
      closedCircuits,
      totalCalls,
      totalRejected,
      totalFailed,
    };
  }

  // Private methods

  private initializeDefaultCircuits(): void {
    for (const [serviceName, config] of Object.entries(DEFAULT_CIRCUIT_CONFIGS)) {
      this.configureCircuit({
        serviceName,
        failureThreshold: config.failureThreshold || 5,
        successThreshold: config.successThreshold || 3,
        timeout: config.timeout || 30000,
        resetTimeout: config.resetTimeout || 30000,
        halfOpenMaxCalls: config.halfOpenMaxCalls || 3,
      });
    }
  }

  private getOrCreateCircuit(serviceName: string): CircuitBreakerInstance {
    let circuit = this.circuits.get(serviceName);
    
    if (!circuit) {
      const defaultConfig = DEFAULT_CIRCUIT_CONFIGS['default']!;
      this.configureCircuit({
        serviceName,
        failureThreshold: defaultConfig.failureThreshold!,
        successThreshold: defaultConfig.successThreshold!,
        timeout: defaultConfig.timeout!,
        resetTimeout: defaultConfig.resetTimeout!,
        halfOpenMaxCalls: defaultConfig.halfOpenMaxCalls!,
      });
      circuit = this.circuits.get(serviceName)!;
    }

    return circuit;
  }

  private onSuccess(serviceName: string, duration: number): void {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) return;

    circuit.stats.successfulCalls++;
    circuit.successCount++;
    circuit.failureCount = 0;

    this.emitEvent({
      type: 'call_success',
      serviceName,
      timestamp: Date.now(),
      data: { duration },
    });

    // Check if we should close from half-open
    if (circuit.state === 'half_open' && 
        circuit.successCount >= circuit.config.successThreshold) {
      this.transitionTo(serviceName, 'closed');
    }
  }

  private onFailure(serviceName: string, error: Error, duration: number): void {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) return;

    circuit.stats.failedCalls++;
    circuit.failureCount++;
    circuit.successCount = 0;
    circuit.lastFailureTime = Date.now();

    this.emitEvent({
      type: 'call_failure',
      serviceName,
      timestamp: Date.now(),
      data: { error: error.message, duration },
    });

    // Check if we should open
    if (circuit.state === 'half_open') {
      // Immediately open on failure in half-open state
      this.transitionTo(serviceName, 'open');
    } else if (circuit.failureCount >= circuit.config.failureThreshold) {
      this.transitionTo(serviceName, 'open');
    }
  }

  private onTimeout(serviceName: string, duration: number): void {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) return;

    circuit.stats.timeoutCalls++;
    circuit.stats.failedCalls++;
    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();

    this.emitEvent({
      type: 'call_timeout',
      serviceName,
      timestamp: Date.now(),
      data: { duration },
    });

    // Treat timeout as failure
    if (circuit.state === 'half_open') {
      this.transitionTo(serviceName, 'open');
    } else if (circuit.failureCount >= circuit.config.failureThreshold) {
      this.transitionTo(serviceName, 'open');
    }
  }

  private transitionTo(serviceName: string, newState: CircuitState): void {
    const circuit = this.circuits.get(serviceName);
    if (!circuit || circuit.state === newState) return;

    const previousState = circuit.state;
    circuit.state = newState;
    circuit.lastStateChange = Date.now();

    if (newState === 'closed') {
      circuit.failureCount = 0;
      circuit.successCount = 0;
      circuit.halfOpenCalls = 0;
    } else if (newState === 'half_open') {
      circuit.halfOpenCalls = 0;
    }

    this.emitEvent({
      type: 'state_change',
      serviceName,
      timestamp: Date.now(),
      data: { previousState, newState },
    });

    logger.log(`Circuit breaker for ${serviceName}: ${previousState} -> ${newState}`);
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    serviceName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout after ${timeout}ms for ${serviceName}`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private emitEvent(event: CircuitBreakerEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.warn('Error in circuit breaker event listener:', error);
      }
    });
  }

  /**
   * Cleanup and destroy the coordinator
   */
  destroy(): void {
    this.circuits.clear();
    this.fallbacks.clear();
    this.eventListeners.clear();

    CircuitBreakerCoordinator.instance = null;
    logger.log('Circuit breaker coordinator destroyed');
  }
}

// Export singleton instance
export const circuitBreakerCoordinator = CircuitBreakerCoordinator.getInstance();

/**
 * Helper function to execute through circuit breaker
 */
export function executeWithCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  fallbackArgs?: unknown[]
): Promise<T> {
  return circuitBreakerCoordinator.execute(serviceName, fn, fallbackArgs);
}

/**
 * Helper function to get circuit breaker status
 */
export function getCircuitBreakerStatus(serviceName: string): CircuitBreakerStatus | null {
  return circuitBreakerCoordinator.getStatus(serviceName);
}

/**
 * Helper function to check if circuit is open
 */
export function isCircuitOpen(serviceName: string): boolean {
  const status = circuitBreakerCoordinator.getStatus(serviceName);
  return status?.state === 'open';
}
