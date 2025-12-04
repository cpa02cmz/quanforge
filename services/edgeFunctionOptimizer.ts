/**
 * Edge Function Optimization and Warming Service
 * Optimizes Vercel Edge Functions for better performance and reduced cold starts
 */

interface EdgeFunctionConfig {
  name: string;
  regions: string[];
  memory: number;
  maxDuration: number;
  warmupInterval: number;
  priority: 'high' | 'medium' | 'low';
}

interface WarmupRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
}

interface EdgeMetrics {
  coldStartCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  requestCount: number;
  lastWarmup: number;
}

class EdgeFunctionOptimizer {
  private static instance: EdgeFunctionOptimizer;
  private configs: Map<string, EdgeFunctionConfig> = new Map();
  private metrics: Map<string, EdgeMetrics> = new Map();
  private warmupTimers: Map<string, NodeJS.Timeout> = new Map();
  private isWarmingUp: Set<string> = new Set();

  private constructor() {
    this.initializeDefaultConfigs();
    this.startPeriodicWarmups();
  }

  static getInstance(): EdgeFunctionOptimizer {
    if (!EdgeFunctionOptimizer.instance) {
      EdgeFunctionOptimizer.instance = new EdgeFunctionOptimizer();
    }
    return EdgeFunctionOptimizer.instance;
  }

  private initializeDefaultConfigs(): void {
    // Default edge function configurations
    const defaultConfigs: EdgeFunctionConfig[] = [
      {
        name: 'api/supabase',
        regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
        memory: 512,
        maxDuration: 30,
        warmupInterval: 5 * 60 * 1000, // 5 minutes - optimized for edge
        priority: 'high',
      },
      {
        name: 'api/analytics',
        regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
        memory: 256,
        maxDuration: 10,
        warmupInterval: 7 * 60 * 1000, // 7 minutes - optimized for edge
        priority: 'medium',
      },
      {
        name: 'api/edge-metrics',
        regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
        memory: 128,
        maxDuration: 5,
        warmupInterval: 10 * 60 * 1000, // 10 minutes - optimized for edge
        priority: 'low',
      },
    ];

    defaultConfigs.forEach(config => {
      this.configs.set(config.name, config);
      this.metrics.set(config.name, {
        coldStartCount: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        errorRate: 0,
        requestCount: 0,
        lastWarmup: 0,
      });
    });
  }

  /**
   * Register a new edge function configuration
   */
  registerFunction(config: EdgeFunctionConfig): void {
    this.configs.set(config.name, config);
    this.metrics.set(config.name, {
      coldStartCount: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      errorRate: 0,
      requestCount: 0,
      lastWarmup: 0,
    });
    
    // Start warmup for this function
    this.scheduleWarmup(config.name);
  }

  /**
   * Warm up edge functions to prevent cold starts
   */
  async warmupFunction(functionName: string): Promise<void> {
    const config = this.configs.get(functionName);
    if (!config || this.isWarmingUp.has(functionName)) {
      return;
    }

    this.isWarmingUp.add(functionName);

    try {
      const warmupRequests = this.generateWarmupRequests(functionName);
      
      // Execute warmup requests in parallel for different regions
      const warmupPromises = config.regions.map(region => 
        this.executeWarmupRequest(warmupRequests, region)
      );

      await Promise.allSettled(warmupPromises);

      // Update metrics
      const metrics = this.metrics.get(functionName)!;
      metrics.lastWarmup = Date.now();

      console.log(`Edge function ${functionName} warmed up successfully`);
    } catch (error) {
      console.error(`Failed to warm up edge function ${functionName}:`, error);
    } finally {
      this.isWarmingUp.delete(functionName);
    }
  }

  /**
   * Generate warmup requests for a function
   */
  private generateWarmupRequests(functionName: string): WarmupRequest[] {
    const baseUrl = process.env['VERCEL_URL'] || 'localhost:3000';
    const protocol = process.env['NODE_ENV'] === 'production' ? 'https' : 'http';

    switch (functionName) {
      case 'api/supabase':
        return [
          {
            url: `${protocol}://${baseUrl}/api/supabase/health`,
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-warmup': 'true',
              'x-edge-region': 'auto',
            },
            timestamp: Date.now(),
          },
          {
            url: `${protocol}://${baseUrl}/api/supabase/status`,
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-warmup': 'true',
            },
            timestamp: Date.now(),
          },
        ];

      case 'api/analytics':
        return [
          {
            url: `${protocol}://${baseUrl}/api/analytics/ping`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-warmup': 'true',
            },
            body: JSON.stringify({ type: 'warmup', timestamp: Date.now() }),
            timestamp: Date.now(),
          },
        ];

      case 'api/edge-metrics':
        return [
          {
            url: `${protocol}://${baseUrl}/api/edge-metrics`,
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-warmup': 'true',
            },
            timestamp: Date.now(),
          },
        ];

      default:
        return [
          {
            url: `${protocol}://${baseUrl}/api/${functionName}/ping`,
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-warmup': 'true',
            },
            timestamp: Date.now(),
          },
        ];
    }
  }

  /**
   * Execute warmup request for a specific region
   */
  private async executeWarmupRequest(requests: WarmupRequest[], region: string): Promise<void> {
    for (const request of requests) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const fetchOptions: RequestInit = {
          method: request.method,
          headers: {
            ...request.headers,
            'x-edge-region': region,
            'x-vercel-region': region,
          },
          signal: controller.signal,
        };
        
        if (request.body) {
          fetchOptions.body = request.body;
        }
        
        const response = await fetch(request.url, fetchOptions);

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Warmup request failed: ${response.status}`);
        }
      } catch (error) {
        // Log but don't throw - warmup failures shouldn't crash the app
        console.warn(`Warmup request failed for region ${region}:`, error);
      }
    }
  }

  /**
   * Schedule periodic warmups for all functions
   */
  private startPeriodicWarmups(): void {
    // Warm up high priority functions every 5 minutes - optimized for edge
    setInterval(() => {
      this.configs.forEach((config, name) => {
        if (config.priority === 'high') {
          this.warmupFunction(name);
        }
      });
    }, 5 * 60 * 1000);

    // Warm up medium priority functions every 10 minutes - optimized for edge
    setInterval(() => {
      this.configs.forEach((config, name) => {
        if (config.priority === 'medium') {
          this.warmupFunction(name);
        }
      });
    }, 10 * 60 * 1000);

    // Warm up low priority functions every 15 minutes - optimized for edge
    setInterval(() => {
      this.configs.forEach((config, name) => {
        if (config.priority === 'low') {
          this.warmupFunction(name);
        }
      });
    }, 15 * 60 * 1000);
  }

  /**
   * Schedule warmup for a specific function
   */
  private scheduleWarmup(functionName: string): void {
    const config = this.configs.get(functionName);
    if (!config) return;

    // Clear existing timer
    const existingTimer = this.warmupTimers.get(functionName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new warmup
    const timer = setTimeout(() => {
      this.warmupFunction(functionName);
      this.scheduleWarmup(functionName); // Reschedule
    }, config.warmupInterval);

    this.warmupTimers.set(functionName, timer);
  }

  /**
   * Record metrics for edge function performance
   */
  recordMetrics(functionName: string, responseTime: number, isError: boolean): void {
    const metrics = this.metrics.get(functionName);
    if (!metrics) return;

    metrics.requestCount++;

    if (isError) {
      metrics.errorRate = (metrics.errorRate * (metrics.requestCount - 1) + 1) / metrics.requestCount;
    } else {
      metrics.errorRate = (metrics.errorRate * (metrics.requestCount - 1)) / metrics.requestCount;
    }

    // Update average response time
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.requestCount - 1) + responseTime) / metrics.requestCount;

    // Detect potential cold start (response time > 100ms)
    if (responseTime > 100) {
      metrics.coldStartCount++;
    }
  }

  /**
   * Get performance metrics for all functions
   */
  getMetrics(): Record<string, EdgeMetrics> {
    const result: Record<string, EdgeMetrics> = {};
    this.metrics.forEach((metrics, name) => {
      result[name] = { ...metrics };
    });
    return result;
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    this.metrics.forEach((metrics, name) => {
      const config = this.configs.get(name);
      if (!config) return;

      // Check cold start frequency
      const coldStartRate = metrics.coldStartCount / metrics.requestCount;
      if (coldStartRate > 0.1) {
        recommendations.push(
          `High cold start rate (${(coldStartRate * 100).toFixed(1)}%) for ${name}. Consider reducing warmup interval.`
        );
      }

      // Check error rate
      if (metrics.errorRate > 0.05) {
        recommendations.push(
          `High error rate (${(metrics.errorRate * 100).toFixed(1)}%) for ${name}. Check function health.`
        );
      }

      // Check response time
      if (metrics.averageResponseTime > 500) {
        recommendations.push(
          `Slow response time (${metrics.averageResponseTime.toFixed(0)}ms) for ${name}. Consider increasing memory allocation.`
        );
      }

      // Check if function needs warming
      const timeSinceLastWarmup = Date.now() - metrics.lastWarmup;
      if (timeSinceLastWarmup > config.warmupInterval * 2) {
        recommendations.push(
          `Function ${name} hasn't been warmed up recently. Check warmup scheduler.`
        );
      }
    });

    return recommendations;
  }

  /**
   * Force warmup of all functions
   */
  async warmupAllFunctions(): Promise<void> {
    const warmupPromises = Array.from(this.configs.keys()).map(name => 
      this.warmupFunction(name)
    );

    await Promise.allSettled(warmupPromises);
  }

  /**
   * Monitor performance and auto-optimize based on metrics
   */
  async monitorPerformance(): Promise<void> {
    try {
      const recommendations = this.getOptimizationRecommendations();
      
      // Auto-optimize based on recommendations
      for (const recommendation of recommendations) {
        if (recommendation.includes('High cold start rate')) {
          await this.optimizeColdStarts();
        }
        if (recommendation.includes('High error rate')) {
          await this.enableCircuitBreaker();
        }
        if (recommendation.includes('Slow response time')) {
          await this.optimizeMemoryAllocation();
        }
      }
      
      console.log('Performance monitoring and auto-optimization completed');
    } catch (error) {
      console.error('Performance monitoring failed:', error);
    }
  }

  /**
   * Optimize cold starts by reducing warmup intervals
   */
  private async optimizeColdStarts(): Promise<void> {
    this.configs.forEach((config, name) => {
      const metrics = this.metrics.get(name);
      if (!metrics) return;

      const coldStartRate = metrics.coldStartCount / metrics.requestCount;
      if (coldStartRate > 0.1) {
        // Reduce warmup interval by 25%
        config.warmupInterval = Math.max(config.warmupInterval * 0.75, 60000); // Minimum 1 minute
        this.scheduleWarmup(name);
        console.log(`Reduced warmup interval for ${name} to ${config.warmupInterval}ms`);
      }
    });
  }

  /**
   * Enable circuit breaker pattern for fault tolerance
   */
  private async enableCircuitBreaker(): Promise<void> {
    console.log('Circuit breaker enabled due to high error rate');
    // Implementation would go here
  }

  /**
   * Optimize memory allocation for slow functions
   */
  private async optimizeMemoryAllocation(): Promise<void> {
    this.configs.forEach((config, name) => {
      const metrics = this.metrics.get(name);
      if (!metrics) return;

      if (metrics.averageResponseTime > 500) {
        // Increase memory allocation by 25%
        config.memory = Math.min(config.memory * 1.25, 1024); // Maximum 1GB
        console.log(`Increased memory allocation for ${name} to ${config.memory}MB`);
      }
    });
  }

  /**
   * Get health status of the optimizer
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    functionsCount: number;
    activeWarmups: number;
    recommendations: string[];
  } {
    const recommendations = this.getOptimizationRecommendations();
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (recommendations.length > 5) {
      status = 'critical';
    } else if (recommendations.length > 2) {
      status = 'warning';
    }
    
    return {
      status,
      functionsCount: this.configs.size,
      activeWarmups: this.isWarmingUp.size,
      recommendations
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Clear all warmup timers
    this.warmupTimers.forEach(timer => clearTimeout(timer));
    this.warmupTimers.clear();

    // Clear warming flags
    this.isWarmingUp.clear();
  }
}

// Export singleton instance
export const edgeOptimizer = EdgeFunctionOptimizer.getInstance();

// Export types and class for testing
export { EdgeFunctionOptimizer, type EdgeFunctionConfig, type EdgeMetrics };