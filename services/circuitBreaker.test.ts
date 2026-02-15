import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitState,
  DEFAULT_CIRCUIT_BREAKERS,
} from './circuitBreaker';

describe('Circuit Breaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: 5000,
      resetTimeout: 1000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should have zero failures initially', () => {
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('Successful Operations', () => {
    it('should execute function successfully in CLOSED state', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await breaker.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reset failure count on success', async () => {
      const failingOperation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      // 2 failures
      try { await breaker.execute(failingOperation); } catch {}
      try { await breaker.execute(failingOperation); } catch {}
      
      expect(breaker.getStats().failureCount).toBe(2);
      
      // 1 success should reset failure count
      await breaker.execute(failingOperation);
      
      expect(breaker.getStats().failureCount).toBe(0);
    });
  });

  describe('Failure Tracking', () => {
    it('should track consecutive failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failure'));
      
      try { await breaker.execute(operation); } catch {}
      try { await breaker.execute(operation); } catch {}
      
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(2);
    });

    it('should open circuit after threshold failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failure'));
      
      // 3 failures to reach threshold
      try { await breaker.execute(operation); } catch {}
      try { await breaker.execute(operation); } catch {}
      try { await breaker.execute(operation); } catch {}
      
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should not execute function when circuit is OPEN', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failure'));
      
      // Open the circuit
      try { await breaker.execute(operation); } catch {}
      try { await breaker.execute(operation); } catch {}
      try { await breaker.execute(operation); } catch {}
      
      expect(breaker.getState()).toBe(CircuitState.OPEN);
      
      // Reset mock to track new calls
      operation.mockClear();
      
      // Should reject without calling operation
      await expect(breaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN');
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('Half-Open State', () => {
    it('should check state after timeout period', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failure'));
      
      // Open the circuit
      try { await breaker.execute(operation); } catch {}
      try { await breaker.execute(operation); } catch {}
      try { await breaker.execute(operation); } catch {}
      
      expect(breaker.getState()).toBe(CircuitState.OPEN);
      
      // After timeout, next execute should try in HALF_OPEN
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Create new breaker with same state to test timeout
      const newBreaker = new CircuitBreaker({
        failureThreshold: 3,
        timeout: 5000,
        resetTimeout: 100,
      });
      
      // Open it
      const op = vi.fn().mockRejectedValue(new Error('fail'));
      try { await newBreaker.execute(op); } catch {}
      try { await newBreaker.execute(op); } catch {}
      try { await newBreaker.execute(op); } catch {}
      expect(newBreaker.getState()).toBe(CircuitState.OPEN);
      
      // Wait for short timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Now it should be in HALF_OPEN
      const successOp = vi.fn().mockResolvedValue('success');
      await newBreaker.execute(successOp); // This should work in HALF_OPEN
      
      expect(newBreaker.getStats().state).toBe(CircuitState.HALF_OPEN);
    });
  });

  describe('State Management', () => {
    it('should allow manual state reset', () => {
      breaker.reset();
      
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });

    it('should provide current state info', () => {
      const stats = breaker.getStats();
      
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('successCount');
      expect(stats).toHaveProperty('lastFailureTime');
    });
  });

  describe('Default Circuit Breakers', () => {
    it('should have database circuit breaker', () => {
      expect(DEFAULT_CIRCUIT_BREAKERS.database).toBeDefined();
      expect(typeof DEFAULT_CIRCUIT_BREAKERS.database.execute).toBe('function');
    });

    it('should have AI circuit breaker', () => {
      expect(DEFAULT_CIRCUIT_BREAKERS.ai).toBeDefined();
      expect(typeof DEFAULT_CIRCUIT_BREAKERS.ai.execute).toBe('function');
    });

    it('should have market data circuit breaker', () => {
      expect(DEFAULT_CIRCUIT_BREAKERS.marketData).toBeDefined();
      expect(typeof DEFAULT_CIRCUIT_BREAKERS.marketData.execute).toBe('function');
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 5,
        timeout: 5000,
        resetTimeout: 5000,
      });
      
      expect(customBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should handle edge case configurations', () => {
      const edgeCaseBreaker = new CircuitBreaker({
        failureThreshold: 1,
        timeout: 100,
        resetTimeout: 100,
      });
      
      expect(edgeCaseBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Error Types', () => {
    it('should handle different error types', async () => {
      const typeError = vi.fn().mockRejectedValue(new TypeError('type error'));
      const rangeError = vi.fn().mockRejectedValue(new RangeError('range error'));
      
      try { await breaker.execute(typeError); } catch {}
      try { await breaker.execute(rangeError); } catch {}
      
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(2);
    });

    it('should handle non-error rejections', async () => {
      const stringRejection = vi.fn().mockRejectedValue('string error');
      
      try { await breaker.execute(stringRejection); } catch {}
      
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(1);
    });
  });
});
