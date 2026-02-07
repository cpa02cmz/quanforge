import { 
  CircuitBreakerState, 
  CircuitBreakerConfig, 
  CircuitBreakerMetrics,
  HealthStatus,
  getConfig,
  classifyError,
  ErrorCategory
} from './integrationResilience';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('circuit-breaker-monitor');

export interface CircuitBreakerOptions {
  name: string;
  config: CircuitBreakerConfig;
  onStateChange?: (state: CircuitBreakerState, metrics: CircuitBreakerMetrics) => void;
}

class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private halfOpenCalls = 0;
  private nextAttemptTime?: number;
  private readonly options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = options;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() >= (this.nextAttemptTime || 0)) {
        this.transitionTo(CircuitBreakerState.HALF_OPEN);
      } else {
        const error = new Error(`Circuit breaker ${this.options.name} is OPEN. Next attempt at ${new Date(this.nextAttemptTime || 0).toISOString()}`);
        (error as any).circuitBreakerOpen = true;
        throw error;
      }
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.options.config.halfOpenMaxCalls) {
        const error = new Error(`Circuit breaker ${this.options.name} HALF_OPEN limit reached`);
        (error as any).circuitBreakerOpen = true;
        throw error;
      }
    }

    this.halfOpenCalls++;
    const startTime = Date.now();

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error: any) {
      this.onFailure(error);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      logger.debug(`Circuit breaker ${this.options.name} operation completed in ${duration}ms`);
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.successes >= this.options.config.successThreshold) {
        this.transitionTo(CircuitBreakerState.CLOSED);
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      this.failures = 0;
    }
  }

  private onFailure(error: any): void {
    const errorCategory = classifyError(error);
    
    if (errorCategory === ErrorCategory.CLIENT_ERROR || errorCategory === ErrorCategory.VALIDATION) {
      logger.debug(`Circuit breaker ${this.options.name}: Non-failure error (${errorCategory}), not counting as failure`);
      return;
    }

    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionTo(CircuitBreakerState.OPEN);
    } else if (this.state === CircuitBreakerState.CLOSED) {
      if (this.failures >= this.options.config.failureThreshold) {
        this.transitionTo(CircuitBreakerState.OPEN);
      }
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitBreakerState.OPEN) {
      this.nextAttemptTime = Date.now() + this.options.config.resetTimeout;
      this.halfOpenCalls = 0;
    } else if (newState === CircuitBreakerState.CLOSED) {
      this.failures = 0;
      this.successes = 0;
      this.halfOpenCalls = 0;
      this.nextAttemptTime = undefined;
    } else if (newState === CircuitBreakerState.HALF_OPEN) {
      this.successes = 0;
      this.halfOpenCalls = 0;
    }

    logger.warn(`Circuit breaker ${this.options.name} transitioned: ${oldState} -> ${newState}`);
    
    if (this.options.onStateChange) {
      this.options.onStateChange(newState, this.getMetrics());
    }
  }

  getMetrics(): CircuitBreakerMetrics {
    const totalCalls = this.successes + this.failures;
    const failureRate = totalCalls > 0 ? this.failures / totalCalls : 0;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      failureRate,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    logger.info(`Circuit breaker ${this.options.name} reset to CLOSED`);
  }
}

class CircuitBreakerMonitor {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private healthStatuses = new Map<string, HealthStatus>();
  private responseTimes = new Map<string, number[]>();
  private readonly maxResponseTimeHistory = 100;

  registerCircuitBreaker(name: string, config: CircuitBreakerConfig, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (this.circuitBreakers.has(name)) {
      return this.circuitBreakers.get(name)!;
    }

    const breaker = new CircuitBreaker({
      name,
      config,
      onStateChange: (state, metrics) => {
        this.updateHealthStatus(name, metrics);
        if (options?.onStateChange) {
          options.onStateChange(state, metrics);
        }
      }
    });

    this.circuitBreakers.set(name, breaker);
    logger.info(`Circuit breaker registered: ${name}`);
    return breaker;
  }

  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const result: Record<string, CircuitBreakerMetrics> = {};
    this.circuitBreakers.forEach((breaker, name) => {
      result[name] = breaker.getMetrics();
    });
    return result;
  }

  getAllHealthStatuses(): Record<string, HealthStatus> {
    const result: Record<string, HealthStatus> = {};
    this.circuitBreakers.forEach((_breaker, name) => {
      void _breaker;
      result[name] = this.getHealthStatus(name);
    });
    return result;
  }

  getHealthStatus(name: string): HealthStatus {
    const breaker = this.circuitBreakers.get(name);
    const config = getConfig(name);
    const metrics = breaker?.getMetrics();

    if (!metrics) {
      return {
        integration: name,
        type: config.type,
        healthy: false,
        lastCheck: Date.now(),
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        circuitBreakerState: CircuitBreakerState.CLOSED,
        responseTime: 0,
        errorRate: 0
      };
    }

    const responseTimes = this.responseTimes.get(name) || [];
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    return {
      integration: name,
      type: config.type,
      healthy: metrics.state !== CircuitBreakerState.OPEN,
      lastCheck: Date.now(),
      consecutiveFailures: metrics.failures,
      consecutiveSuccesses: metrics.successes,
      circuitBreakerState: metrics.state,
      responseTime: avgResponseTime,
      errorRate: metrics.failureRate
    };
  }

  recordResponseTime(name: string, duration: number): void {
    if (!this.responseTimes.has(name)) {
      this.responseTimes.set(name, []);
    }

    const times = this.responseTimes.get(name)!;
    times.push(duration);

    if (times.length > this.maxResponseTimeHistory) {
      times.shift();
    }
  }

  updateHealthStatus(name: string, metrics: CircuitBreakerMetrics): void {
    const previousStatus = this.healthStatuses.get(name);
    const now = Date.now();

    this.healthStatuses.set(name, {
      integration: name,
      type: getConfig(name).type,
      healthy: metrics.state !== CircuitBreakerState.OPEN,
      lastCheck: now,
      consecutiveFailures: metrics.failures,
      consecutiveSuccesses: metrics.successes,
      circuitBreakerState: metrics.state,
      responseTime: previousStatus?.responseTime || 0,
      errorRate: metrics.failureRate
    });
  }

  resetCircuitBreaker(name: string): void {
    const breaker = this.circuitBreakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  resetAll(): void {
    this.circuitBreakers.forEach(breaker => breaker.reset());
    this.responseTimes.clear();
    logger.info('All circuit breakers reset');
  }

  getSummary(): {
    totalIntegrations: number;
    healthy: number;
    unhealthy: number;
    details: Record<string, HealthStatus>;
  } {
    const statuses = this.getAllHealthStatuses();
    const values = Object.values(statuses);
    
    return {
      totalIntegrations: values.length,
      healthy: values.filter(s => s.healthy).length,
      unhealthy: values.filter(s => !s.healthy).length,
      details: statuses
    };
  }
}

export const circuitBreakerMonitor = new CircuitBreakerMonitor();
