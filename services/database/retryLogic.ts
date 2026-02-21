/**
 * Database Retry Logic
 * Handles retry mechanisms, circuit breakers, and error recovery strategies
 */

import { handleError } from '../../utils/errorHandler';
import { DATABASE_CONFIG } from '../../constants/config';
import { HTTP_CONSTANTS } from '../modularConstants';

export interface RetryLogicInterface {
  withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T>;
  isRetryableError(error: unknown): boolean;
  getCircuitBreakerStatus(operationName: string): { open: boolean; failures: number };
  resetCircuitBreaker(operationName: string): void;
}

export class RetryLogic implements RetryLogicInterface {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(operationName);
    
    // Check if circuit breaker is open
    if (circuitBreaker.isOpen()) {
      throw new Error(`Circuit breaker is open for operation: ${operationName}`);
    }

    let lastError: unknown;
    
    for (let attempt = 1; attempt <= DATABASE_CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
      try {
        const result = await operation();
        
        // Success - reset circuit breaker
        circuitBreaker.recordSuccess();
        return result;
      } catch (error: unknown) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          circuitBreaker.recordFailure();
          throw error;
        }

        // Record failure for circuit breaker
        circuitBreaker.recordFailure();

        // If this is the last attempt, don't wait
        if (attempt === DATABASE_CONFIG.RETRY.MAX_ATTEMPTS) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    // All attempts failed
    handleError(lastError instanceof Error ? lastError : new Error(String(lastError)), operationName, 'retryLogic');
    throw lastError;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = DATABASE_CONFIG.RETRY.DELAYS.BASE * Math.pow(DATABASE_CONFIG.RETRY.DELAYS.BACKOFF_MULTIPLIER, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, DATABASE_CONFIG.RETRY.DELAYS.MAX);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * cappedDelay;
    return Math.floor(cappedDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isRetryableError(error: unknown): boolean {
    if (!error) return false;

    // Type the error for property access
    const err = error as { code?: string | number; status?: number; details?: { code?: string }; message?: string };

    // Check for non-retryable error codes
    const errorCode = err.code || err.status;
    if (DATABASE_CONFIG.RETRY.NON_RETRYABLE_STATUS_CODES.includes(errorCode as number)) {
      return false;
    }

    // Check for non-retryable database error codes
    const dbErrorCode = err.details?.code || err.message;
    if (typeof dbErrorCode === 'string' && DATABASE_CONFIG.RETRY.NON_RETRYABLE_ERRORS.includes(dbErrorCode)) {
      return false;
    }

    // Check for edge-specific errors
    if (typeof dbErrorCode === 'string' && DATABASE_CONFIG.RETRY.EDGE_SPECIFIC_ERRORS.includes(dbErrorCode)) {
      return false;
    }

    // Network errors, timeouts, and rate limit errors are generally retryable
    if (this.isNetworkError(error) || this.isTimeoutError(error) || this.isRateLimitError(error)) {
      return true;
    }

    // Default to retryable for unknown errors
    return true;
  }

  private isNetworkError(error: unknown): boolean {
    const err = error as { message?: string; type?: string; code?: string };
    return !!(
      err.message?.toLowerCase().includes('network') ||
      err.message?.toLowerCase().includes('fetch') ||
      err.type === 'network' ||
      err.code === 'NETWORK_ERROR'
    );
  }

  private isTimeoutError(error: unknown): boolean {
    const err = error as { message?: string; name?: string; code?: string };
    return !!(
      err.message?.toLowerCase().includes('timeout') ||
      err.name === 'TimeoutError' ||
      err.code === 'TIMEOUT'
    );
  }

  private isRateLimitError(error: unknown): boolean {
    const err = error as { message?: string; status?: number; code?: string };
    return !!(
      err.message?.toLowerCase().includes('rate limit') ||
      err.status === HTTP_CONSTANTS.RATE_LIMITED ||
      err.code === 'RATE_LIMIT_EXCEEDED'
    );
  }

  private getCircuitBreaker(operationName: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(operationName)) {
      this.circuitBreakers.set(operationName, new CircuitBreakerState());
    }
    return this.circuitBreakers.get(operationName)!;
  }

  getCircuitBreakerStatus(operationName: string): { open: boolean; failures: number } {
    const circuitBreaker = this.getCircuitBreaker(operationName);
    return {
      open: circuitBreaker.isOpen(),
      failures: circuitBreaker.getFailureCount()
    };
  }

  resetCircuitBreaker(operationName: string): void {
    const circuitBreaker = this.getCircuitBreaker(operationName);
    circuitBreaker.reset();
  }

  // Reset all circuit breakers (useful for testing or recovery)
  resetAllCircuitBreakers(): void {
    for (const [_name, breaker] of this.circuitBreakers.entries()) {
      breaker.reset();
    }
  }

  // Get status of all circuit breakers
  getAllCircuitBreakerStatus(): Record<string, { open: boolean; failures: number; lastFailure: number | null }> {
    const status: Record<string, { open: boolean; failures: number; lastFailure: number | null }> = {};
    
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      status[name] = {
        open: breaker.isOpen(),
        failures: breaker.getFailureCount(),
        lastFailure: breaker.getLastFailureTime()
      };
    }
    
    return status;
  }
}

class CircuitBreakerState {
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  recordSuccess(): void {
    this.successCount++;
    
    if (this.state === 'half-open') {
      // If we get enough successes in half-open state, close the circuit
      if (this.successCount >= DATABASE_CONFIG.CIRCUIT_BREAKER.SUCCESS_THRESHOLD) {
        this.reset();
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0; // Reset success count

    // Check if we should open the circuit
    if (this.failureCount >= DATABASE_CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD) {
      this.state = 'open';
    }
  }

  isOpen(): boolean {
    if (this.state === 'open') {
      // Check if we should try half-open state
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      if (timeSinceLastFailure > DATABASE_CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.state = 'closed';
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getLastFailureTime(): number | null {
    return this.lastFailureTime;
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
}

// Export singleton instance
export const retryLogic = new RetryLogic();