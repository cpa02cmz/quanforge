import { SupabaseClient } from '@supabase/supabase-js';
import { handleError } from '../utils/errorHandler';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

interface ResilienceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  circuitBreakerTrips: number;
  retryAttempts: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
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
      if (this.successCount >= 3) { // Need 3 successes to close
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

class ResilientSupabaseClient {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
  };
  private circuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 60000,
    monitoringPeriod: 300000,
  };
  private metrics: ResilienceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    circuitBreakerTrips: 0,
    retryAttempts: 0,
  };
  private responseTimes: number[] = [];
  private readonly maxResponseTimes = 100;

  constructor(
    private client: SupabaseClient,
    retryConfig?: Partial<RetryConfig>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>
  ) {
    this.retryConfig = {
      ...this.retryConfig,
      ...retryConfig
    };
    
    this.circuitBreakerConfig = {
      ...this.circuitBreakerConfig,
      ...circuitBreakerConfig
    };
  }

  // Execute operation with retry and circuit breaker
  async executeWithResilience<T>(
    operationName: string,
    operation: () => Promise<T>,
    options?: {
      skipRetry?: boolean;
      skipCircuitBreaker?: boolean;
      customRetryConfig?: Partial<RetryConfig>;
    }
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      let result: T;

      if (options?.skipCircuitBreaker) {
        result = options?.skipRetry 
          ? await operation()
          : await this.executeWithRetry(operationName, operation, options?.customRetryConfig);
      } else {
        const circuitBreaker = this.getCircuitBreaker(operationName);
        result = await circuitBreaker.execute(async () => {
          return options?.skipRetry 
            ? await operation()
            : await this.executeWithRetry(operationName, operation, options?.customRetryConfig);
        });
      }

      this.metrics.successfulRequests++;
      this.recordResponseTime(Date.now() - startTime);
      return result;

    } catch (error) {
      this.metrics.failedRequests++;
      this.recordResponseTime(Date.now() - startTime);
      
      handleError(error, operationName, 'ResilientSupabaseClient', {
        retryAttempts: this.metrics.retryAttempts,
        circuitBreakerState: this.getCircuitBreaker(operationName).getState(),
      });

      throw error;
    }
  }

  // Execute with exponential backoff retry
  private async executeWithRetry<T>(
    operationName: string,
    operation: () => Promise<T>,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    let lastError: any;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry on certain errors
        if (this.shouldNotRetry(error)) {
          throw error;
        }

        if (attempt === config.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );

        const jitterDelay = config.jitter 
          ? delay * (0.5 + Math.random() * 0.5)
          : delay;

        this.metrics.retryAttempts++;
        
        await new Promise(resolve => setTimeout(resolve, jitterDelay));
      }
    }

    throw lastError;
  }

  // Determine if error should not be retried
  private shouldNotRetry(error: any): boolean {
    const nonRetryableErrors = [
      'PGRST116', // Not found
      'PGRST301', // Permission denied
      '42501',    // Insufficient privilege
      '23505',    // Unique violation
      '23503',    // Foreign key violation
    ];

    const nonRetryableStatusCodes = [400, 401, 403, 404, 422];

    return (
      nonRetryableErrors.some(code => error?.code === code) ||
      nonRetryableStatusCodes.some(status => error?.status === status) ||
      error?.message?.includes('circuit breaker is OPEN')
    );
  }

  // Get or create circuit breaker for operation
  private getCircuitBreaker(operationName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operationName)) {
      this.circuitBreakers.set(operationName, new CircuitBreaker(this.circuitBreakerConfig));
    }
    return this.circuitBreakers.get(operationName)!;
  }

  // Record response time for metrics
  private recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes.shift();
    }

    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

   // Wrapper methods for common Supabase operations
   from(table: string) {
     return {
       select: (columns?: string) => ({
         order: (column: string, options?: { ascending: boolean }) => ({
           limit: (limit: number) => ({
             range: (from: number, to: number) => 
               this.executeWithResilience(
                 `${table}_select_range`,
                 () => this.client.from(table).select(columns).order(column, options).limit(limit).range(from, to)
               ) as any,
             eq: (column: string, value: any) => 
               this.executeWithResilience(
                 `${table}_select_eq`,
                 () => this.client.from(table).select(columns).order(column, options).limit(limit).eq(column, value)
               ) as any,
             or: (filter: string) => 
               this.executeWithResilience(
                 `${table}_select_or`,
                 () => this.client.from(table).select(columns).order(column, options).limit(limit).or(filter)
               ) as any,
             single: () => 
               this.executeWithResilience(
                 `${table}_select_single`,
                 () => this.client.from(table).select(columns).order(column, options).limit(limit).single()
               ) as any,
           }),
           eq: (column: string, value: any) => ({
             single: () => 
               this.executeWithResilience(
                 `${table}_select_eq_single`,
                 () => this.client.from(table).select(columns).order(column, options).eq(column, value).single()
               ) as any,
           }),
           or: (filter: string) => 
             this.executeWithResilience(
               `${table}_select_or`,
               () => this.client.from(table).select(columns).order(column, options).or(filter)
             ) as any,
           single: () => 
             this.executeWithResilience(
               `${table}_select_single`,
               () => this.client.from(table).select(columns).order(column, options).single()
             ) as any,
         }),
         eq: (column: string, value: any) => ({
           single: () => 
             this.executeWithResilience(
               `${table}_select_eq_single`,
               () => this.client.from(table).select(columns).eq(column, value).single()
             ) as any,
         }),
         or: (filter: string) => 
           this.executeWithResilience(
             `${table}_select_or`,
             () => this.client.from(table).select(columns).or(filter)
           ) as any,
         single: () => 
           this.executeWithResilience(
             `${table}_select_single`,
             () => this.client.from(table).select(columns).single()
           ) as any,
       }),
       insert: (data: any) => ({
         select: (columns?: string) => 
           this.executeWithResilience(
             `${table}_insert_select`,
             () => this.client.from(table).insert(data).select(columns)
           ) as any,
       }),
       update: (data: any) => ({
         match: (criteria: any) => ({
           select: (columns?: string) => 
             this.executeWithResilience(
               `${table}_update_match_select`,
               () => this.client.from(table).update(data).match(criteria).select(columns)
             ) as any,
         }),
         eq: (column: string, value: any) => ({
           select: (columns?: string) => 
             this.executeWithResilience(
               `${table}_update_eq_select`,
               () => this.client.from(table).update(data).eq(column, value).select(columns)
             ) as any,
         }),
       }),
       delete: () => ({
         match: (criteria: any) => 
           this.executeWithResilience(
             `${table}_delete_match`,
             () => this.client.from(table).delete().match(criteria)
           ) as any,
         eq: (column: string, value: any) => 
           this.executeWithResilience(
             `${table}_delete_eq`,
             () => this.client.from(table).delete().eq(column, value)
           ) as any,
       }),
     };
   }

  // Auth operations with resilience
  get auth() {
    return {
      getSession: () => 
        this.executeWithResilience(
          'auth_getSession',
          () => this.client.auth.getSession()
        ),
      signInWithPassword: (credentials: any) => 
        this.executeWithResilience(
          'auth_signInWithPassword',
          () => this.client.auth.signInWithPassword(credentials),
          { skipRetry: true } // Don't retry auth failures
        ),
      signUp: (credentials: any) => 
        this.executeWithResilience(
          'auth_signUp',
          () => this.client.auth.signUp(credentials),
          { skipRetry: true }
        ),
      signOut: () => 
        this.executeWithResilience(
          'auth_signOut',
          () => this.client.auth.signOut()
        ),
      onAuthStateChange: (callback: any) => 
        this.client.auth.onAuthStateChange(callback),
    };
  }

   // RPC operations with resilience
   async rpc(fnName: string, params?: any) {
     return this.executeWithResilience(
       `rpc_${fnName}`,
       async () => {
         const result = await this.client.rpc(fnName, params);
         return result;
       }
     );
   }

  // Get resilience metrics
  getMetrics(): ResilienceMetrics {
    return { ...this.metrics };
  }

  // Get circuit breaker states
  getCircuitBreakerStates(): Array<{ operation: string; state: CircuitState; failureCount: number }> {
    return Array.from(this.circuitBreakers.entries()).map(([operation, breaker]) => ({
      operation,
      state: breaker.getState(),
      failureCount: breaker.getFailureCount(),
    }));
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      circuitBreakerTrips: 0,
      retryAttempts: 0,
    };
    this.responseTimes = [];
  }

  // Reset specific circuit breaker
  resetCircuitBreaker(operationName: string): void {
    const breaker = this.circuitBreakers.get(operationName);
    if (breaker) {
      this.circuitBreakers.delete(operationName);
    }
  }

   // Health check
   async healthCheck(): Promise<{ healthy: boolean; details: any }> {
     try {
       const startTime = Date.now();
       await this.executeWithResilience(
         'health_check',
         async () => {
           const result = await this.client.from('robots').select('id').limit(1);
           return result;
         }
       );
       
       const responseTime = Date.now() - startTime;
       const metrics = this.getMetrics();
       const circuitBreakers = this.getCircuitBreakerStates();

       return {
         healthy: true,
         details: {
           responseTime,
           successRate: metrics.totalRequests > 0 
             ? (metrics.successfulRequests / metrics.totalRequests) * 100 
             : 0,
           averageResponseTime: metrics.averageResponseTime,
           openCircuitBreakers: circuitBreakers.filter(cb => cb.state === CircuitState.OPEN).length,
           totalCircuitBreakers: circuitBreakers.length,
         },
       };
     } catch (error) {
       return {
         healthy: false,
         details: {
           error: error instanceof Error ? error.message : 'Unknown error',
           metrics: this.getMetrics(),
           circuitBreakers: this.getCircuitBreakerStates(),
         },
       };
     }
   }
}

// Factory function to create resilient client
export function createResilientClient(
  client: SupabaseClient,
  retryConfig?: Partial<RetryConfig>,
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>
): ResilientSupabaseClient {
  return new ResilientSupabaseClient(client, retryConfig, circuitBreakerConfig);
}

export { CircuitState, type RetryConfig, type CircuitBreakerConfig, type ResilienceMetrics };