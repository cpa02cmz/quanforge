// Circuit Breaker Pattern Implementation for API Resilience

export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private _config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this._config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) { // Need 3 consecutive successes to close
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this._config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
  }
}

import { monitoringConfig } from './configurationService';

// Circuit breaker factory function
export const createCircuitBreakers = () => {
  const config = monitoringConfig();
  return {
    database: new CircuitBreaker({
      failureThreshold: config.circuitBreaker.database.failureThreshold,
      timeout: config.circuitBreaker.database.timeout,
      resetTimeout: config.circuitBreaker.database.resetTimeout
    }),
    ai: new CircuitBreaker({
      failureThreshold: config.circuitBreaker.ai.failureThreshold,
      timeout: config.circuitBreaker.ai.timeout,
      resetTimeout: config.circuitBreaker.ai.resetTimeout
    }),
    marketData: new CircuitBreaker({
      failureThreshold: config.circuitBreaker.marketData.failureThreshold,
      timeout: config.circuitBreaker.marketData.timeout,
      resetTimeout: config.circuitBreaker.marketData.resetTimeout
    })
  };
};

// Default circuit breaker configurations (for backward compatibility)
export const DEFAULT_CIRCUIT_BREAKERS = createCircuitBreakers();