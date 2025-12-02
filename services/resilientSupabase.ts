import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { settingsManager } from './settingsManager';
import { performanceMonitor } from '../utils/performance';
import { securityManager } from './securityManager';
import { queryOptimizer } from './queryOptimizer';
import { databaseOptimizer } from './databaseOptimizer';
import { databaseIndexOptimizer } from './databaseIndexOptimizer';

interface ResilienceConfig {
  retryAttempts: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  requestTimeout: number;
  rateLimiting: {
    maxRequests: number;
    windowMs: number;
  };
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailure: number | null;
  nextAttempt: number | null;
}

interface RequestMetrics {
  successCount: number;
  failureCount: number;
  averageResponseTime: number;
  lastRequestTime: number;
  rateLimitRemaining: number;
}

class ResilientSupabaseClient {
  private client: SupabaseClient | null = null;
  private config: ResilienceConfig;
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();
  private requestMetrics: Map<string, RequestMetrics> = new Map();
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly DEFAULT_CONFIG: ResilienceConfig = {
    retryAttempts: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 30000,
    requestTimeout: 30000,
    rateLimiting: {
      maxRequests: 100,
      windowMs: 60000,
    },
  };

  constructor(config?: Partial<ResilienceConfig>) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  private async initializeClient(): Promise<SupabaseClient> {
    if (this.client) return this.client;

    const settings = settingsManager.getDBSettings();
    if (settings.mode !== 'supabase' || !settings.url || !settings.anonKey) {
      throw new Error('Supabase not configured properly');
    }

    this.client = createClient(settings.url, settings.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-application-name': 'quanforge-ai',
          'x-resilience-enabled': 'true',
        },
      },
    });

    return this.client;
  }

  private async checkRateLimit(identifier: string): Promise<boolean> {
    const now = Date.now();
    const record = this.rateLimiters.get(identifier);

    if (!record || now > record.resetTime) {
      // New window
      this.rateLimiters.set(identifier, {
        count: 1,
        resetTime: now + this.config.rateLimiting.windowMs,
      });
      return true;
    }

    if (record.count >= this.config.rateLimiting.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  private updateCircuitBreaker(operation: string, success: boolean): void {
    const state = this.circuitBreaker.get(operation) || {
      state: 'CLOSED' as const,
      failureCount: 0,
      lastFailure: null,
      nextAttempt: null,
    };

    if (success) {
      // Reset on success
      this.circuitBreaker.set(operation, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailure: null,
        nextAttempt: null,
      });
    } else {
      // Increment failure count
      const failureCount = state.failureCount + 1;
      
      if (failureCount >= this.config.circuitBreakerThreshold) {
        // Open the circuit
        this.circuitBreaker.set(operation, {
          state: 'OPEN',
          failureCount,
          lastFailure: Date.now(),
          nextAttempt: Date.now() + this.config.circuitBreakerTimeout,
        });
      } else {
        // Still closed, just increment failure count
        this.circuitBreaker.set(operation, {
          state: 'CLOSED',
          failureCount,
          lastFailure: Date.now(),
          nextAttempt: null,
        });
      }
    }
  }

  private isCircuitOpen(operation: string): boolean {
    const state = this.circuitBreaker.get(operation);
    if (!state) return false;

    if (state.state === 'CLOSED') return false;
    
    if (state.state === 'OPEN' && Date.now() > (state.nextAttempt || 0)) {
      // Half-open state - allow one request to test if service is back
      this.circuitBreaker.set(operation, {
        ...state,
        state: 'HALF_OPEN',
      });
      return false;
    }
    
    return state.state === 'OPEN';
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Check circuit breaker
        if (this.isCircuitOpen(operationName)) {
          throw new Error(`Circuit breaker open for operation: ${operationName}`);
        }

        // Check rate limiting
        const rateLimitId = `${operationName}_${Date.now() - (Date.now() % this.config.rateLimiting.windowMs)}`;
        if (!await this.checkRateLimit(rateLimitId)) {
          throw new Error(`Rate limit exceeded for operation: ${operationName}`);
        }

        const result = await operation();
        
        // Update circuit breaker on success
        this.updateCircuitBreaker(operationName, true);
        
        // Update metrics
        const metrics = this.requestMetrics.get(operationName) || {
          successCount: 0,
          failureCount: 0,
          averageResponseTime: 0,
          lastRequestTime: 0,
          rateLimitRemaining: this.config.rateLimiting.maxRequests,
        };
        
        metrics.successCount++;
        metrics.rateLimitRemaining--;
        this.requestMetrics.set(operationName, metrics);

        return result;
      } catch (error) {
        lastError = error;
        
        // Update circuit breaker on failure
        this.updateCircuitBreaker(operationName, false);
        
        // Update metrics
        const metrics = this.requestMetrics.get(operationName) || {
          successCount: 0,
          failureCount: 0,
          averageResponseTime: 0,
          lastRequestTime: 0,
          rateLimitRemaining: this.config.rateLimiting.maxRequests,
        };
        
        metrics.failureCount++;
        this.requestMetrics.set(operationName, metrics);

        if (attempt === this.config.retryAttempts) {
          break; // Last attempt, re-throw error
        }

        // Calculate delay with exponential backoff if enabled
        const delay = this.config.exponentialBackoff 
          ? this.config.retryDelay * Math.pow(2, attempt) 
          : this.config.retryDelay;
          
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  async executeQuery<T>(
    table: string,
    queryBuilder: (client: SupabaseClient) => any,
    options: {
      operationName?: string;
      timeout?: number;
      validateResponse?: boolean;
      cacheKey?: string;
    } = {}
  ): Promise<{ data: T | null; error: any }> {
    const operationName = options.operationName || `query_${table}`;
    const startTime = performance.now();
    
    try {
      const client = await this.initializeClient();
      
      // Use timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.config.requestTimeout);
      
      const query = queryBuilder(client);
      const result = await query.abortSignal(controller.signal);
      clearTimeout(timeoutId);
      
      const { data, error } = result as any;
      
      // Validate response if requested
      if (options.validateResponse) {
        const validation = securityManager.sanitizeAndValidate(data, 'robot' as any);
        if (!validation.isValid) {
          return { data: null, error: new Error(`Response validation failed: ${validation.errors.join(', ')}`) };
        }
      }
      
      // Record performance metric
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric(`db_${operationName}_duration`, duration);
      
      // Check for slow queries and analyze them
      if (duration > 1000) { // More than 1 second
        await databaseIndexOptimizer.analyzeSlowQuery(
          `SELECT * FROM ${table}`, // Simplified query representation
          duration,
          Array.isArray(data) ? data.length : 1
        );
      }
      
      return { data, error };
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric(`db_${operationName}_duration`, duration);
      performanceMonitor.recordMetric(`db_${operationName}_error`, 1);
      
      return { data: null, error };
    }
  }

  async resilientQuery<T>(
    table: string,
    queryBuilder: (client: SupabaseClient) => any,
    options: {
      operationName?: string;
      timeout?: number;
      validateResponse?: boolean;
      cacheKey?: string;
    } = {}
  ): Promise<{ data: T | null; error: any }> {
    const operationName = options.operationName || `resilient_query_${table}`;
    
    return this.retryOperation(async () => {
      return this.executeQuery<T>(table, queryBuilder, options);
    }, operationName);
  }

  async batchOperation<T>(
    operations: Array<() => Promise<{ data: T | null; error: any }>>,
    options: {
      batchSize?: number;
      continueOnError?: boolean;
    } = {}
  ): Promise<{ results: Array<{ data: T | null; error: any }>; error: any }> {
    const batchSize = options.batchSize || 10;
    const results: Array<{ data: T | null; error: any }> = [];
    let error: any = null;
    
    try {
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(op => this.retryOperation(() => op(), `batch_op_${i}`))
        );
        
        for (const result of batchResults) {
          if (result.error && !options.continueOnError) {
            return { results, error: result.error };
          }
          results.push(result);
        }
      }
    } catch (err) {
      error = err;
    }
    
    return { results, error };
  }

  async transaction<T>(
    operations: Array<(client: SupabaseClient) => Promise<T>>,
    options: {
      maxRetries?: number;
      rollbackOnError?: boolean;
    } = {}
  ): Promise<{ data: T[] | null; error: any }> {
    const maxRetries = options.maxRetries || 3;
    let attempt = 0;
    let lastError: any;
    
    while (attempt < maxRetries) {
      try {
        const client = await this.initializeClient();
        const results: T[] = [];
        
        // In Supabase, we don't have direct transaction support like traditional databases
        // So we'll execute operations sequentially and handle errors
        for (const operation of operations) {
          const result = await operation(client);
          results.push(result);
        }
        
        return { data: results, error: null };
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt >= maxRetries) {
          break;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, attempt)));
      }
    }
    
    return { data: null, error: lastError };
  }

  // Get resilience metrics
  getMetrics(): {
    circuitBreakerStatus: Map<string, CircuitBreakerState>;
    requestMetrics: Map<string, RequestMetrics>;
    rateLimiterStatus: Map<string, { count: number; resetTime: number }>;
  } {
    return {
      circuitBreakerStatus: new Map(this.circuitBreaker),
      requestMetrics: new Map(this.requestMetrics),
      rateLimiterStatus: new Map(this.rateLimiters),
    };
  }

  // Get a summary of resilience status
  getStatusSummary(): {
    totalOperations: number;
    successRate: number;
    openCircuits: number;
    rateLimitedOperations: number;
    averageResponseTime: number;
  } {
    const metrics = Array.from(this.requestMetrics.values());
    const totalOps = metrics.reduce((sum, m) => sum + m.successCount + m.failureCount, 0);
    const totalSuccess = metrics.reduce((sum, m) => sum + m.successCount, 0);
    const avgResponseTime = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / metrics.length 
      : 0;
      
    const openCircuits = Array.from(this.circuitBreaker.values()).filter(s => s.state === 'OPEN').length;
    
    return {
      totalOperations: totalOps,
      successRate: totalOps > 0 ? (totalSuccess / totalOps) * 100 : 100,
      openCircuits,
      rateLimitedOperations: Array.from(this.rateLimiters.values()).filter(r => r.count >= this.config.rateLimiting.maxRequests).length,
      averageResponseTime: avgResponseTime,
    };
  }

  // Reset metrics
  resetMetrics(): void {
    this.requestMetrics.clear();
    this.circuitBreaker.clear();
    this.rateLimiters.clear();
  }
}

// Create a singleton instance
export const resilientSupabase = new ResilientSupabaseClient();

// Export the class for potential custom instantiation
export { ResilientSupabaseClient };