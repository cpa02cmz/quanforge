// Circuit Breaker Pattern Implementation for API Resilience
import { TIMEOUTS, CIRCUIT_BREAKER } from '../constants';

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

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
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
      if (this.successCount >= CIRCUIT_BREAKER.CLOSE_THRESHOLD) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
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

// Default circuit breaker configurations using centralized timeouts
export const DEFAULT_CIRCUIT_BREAKERS = {
  database: new CircuitBreaker({
    failureThreshold: CIRCUIT_BREAKER.DEFAULT_FAILURE_THRESHOLD,
    timeout: TIMEOUTS.API_REQUEST,
    resetTimeout: CIRCUIT_BREAKER.RESET_TIMEOUT_DB
  }),
  ai: new CircuitBreaker({
    failureThreshold: CIRCUIT_BREAKER.AI_FAILURE_THRESHOLD,
    timeout: TIMEOUTS.CIRCUIT_BREAKER_SLOW,
    resetTimeout: TIMEOUTS.CIRCUIT_BREAKER_RESET
  }),
  marketData: new CircuitBreaker({
    failureThreshold: CIRCUIT_BREAKER.MARKET_DATA_FAILURE_THRESHOLD,
    timeout: TIMEOUTS.CIRCUIT_BREAKER_FAST,
    resetTimeout: CIRCUIT_BREAKER.RESET_TIMEOUT_MARKET
  })
};