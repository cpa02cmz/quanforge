import { generateMQL5Code, analyzeStrategy, refineCode, explainCode, testAIConnection } from './gemini';
import { AISettings } from '../types';
import { settingsManager } from './settingsManager';
import { performanceMonitor } from '../utils/performance';

interface AIOptimizationMetrics {
  callCount: number;
  avgResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  tokenUsage: number;
  costEstimate: number;
}

class EnhancedAIPerformanceOptimizer {
  private metrics = new Map<string, AIOptimizationMetrics>();
  private responseCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly DEFAULT_TTL = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;
  
  /**
   * Enhanced generateMQL5Code with performance tracking and intelligent caching
   */
  async generateMQL5CodeWithOptimization(
    prompt: string,
    currentCode?: string,
    strategyParams?: any,
    history: any[] = [],
    signal?: AbortSignal
  ) {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('generate', prompt, currentCode, strategyParams);
    
    // Check cache first
    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.recordMetric('generate', performance.now() - startTime, true);
      return cached.data;
    }
    
    try {
      const result = await generateMQL5Code(prompt, currentCode, strategyParams, history, signal);
      
      // Cache successful result
      this.setCache(cacheKey, result);
      
      this.recordMetric('generate', performance.now() - startTime, false);
      return result;
    } catch (error) {
      this.recordMetric('generate', performance.now() - startTime, false, true);
      throw error;
    }
  }
  
  /**
   * Enhanced analyzeStrategy with performance tracking and caching
   */
  async analyzeStrategyWithOptimization(
    code: string,
    signal?: AbortSignal
  ) {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('analyze', code);
    
    // Check cache first
    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour TTL for analysis
      this.recordMetric('analyze', performance.now() - startTime, true);
      return cached.data;
    }
    
    try {
      const result = await analyzeStrategy(code, signal);
      
      // Cache successful result
      this.setCache(cacheKey, result);
      
      this.recordMetric('analyze', performance.now() - startTime, false);
      return result;
    } catch (error) {
      this.recordMetric('analyze', performance.now() - startTime, false, true);
      throw error;
    }
  }
  
  /**
   * Enhanced refineCode with performance tracking
   */
  async refineCodeWithOptimization(
    currentCode: string,
    signal?: AbortSignal
  ) {
    const startTime = performance.now();
    
    try {
      const result = await refineCode(currentCode, signal);
      this.recordMetric('refine', performance.now() - startTime, false);
      return result;
    } catch (error) {
      this.recordMetric('refine', performance.now() - startTime, false, true);
      throw error;
    }
  }
  
  /**
   * Enhanced explainCode with performance tracking
   */
  async explainCodeWithOptimization(
    currentCode: string,
    signal?: AbortSignal
  ) {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('explain', currentCode.substring(0, 1000)); // First 1000 chars only
    
    // Check cache first
    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 1800000) { // 30 minutes TTL for explanations
      this.recordMetric('explain', performance.now() - startTime, true);
      return cached.data;
    }
    
    try {
      const result = await explainCode(currentCode, signal);
      
      // Cache successful result
      this.setCache(cacheKey, result);
      
      this.recordMetric('explain', performance.now() - startTime, false);
      return result;
    } catch (error) {
      this.recordMetric('explain', performance.now() - startTime, false, true);
      throw error;
    }
  }
  
  /**
   * Smart retry mechanism with exponential backoff for AI calls
   */
  async smartRetryAI<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries) {
          break; // Last attempt, throw the error
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        // Exponential backoff with jitter
        const delay = this.calculateExponentialBackoff(baseDelay, i);
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }
  
  /**
   * Predictive preloading based on user behavior patterns
   */
  async preloadCommonAICalls() {
    const settings = settingsManager.getSettings();
    
    // Preload common analysis patterns
    const commonPatterns = [
      'Simple Moving Average crossover',
      'RSI overbought/oversold',
      'MACD signal',
      'Bollinger Bands breakout'
    ];
    
    // Run preloading in background without blocking
    commonPatterns.forEach(async (pattern) => {
      try {
        await this.generateMQL5CodeWithOptimization(`Create a ${pattern} strategy`, undefined, undefined, []);
      } catch (e) {
        // Ignore preload errors
      }
    });
  }
  
  /**
   * Batch AI operations for better efficiency
   */
  async batchAIOperations(operations: Array<{
    type: 'generate' | 'analyze' | 'refine' | 'explain';
    params: any;
  }>, signal?: AbortSignal) {
    const results = [];
    const startTime = performance.now();
    
    for (const op of operations) {
      try {
        let result;
        switch (op.type) {
          case 'generate':
            result = await this.generateMQL5CodeWithOptimization(
              op.params.prompt,
              op.params.currentCode,
              op.params.strategyParams,
              op.params.history,
              signal
            );
            break;
          case 'analyze':
            result = await this.analyzeStrategyWithOptimization(
              op.params.code,
              signal
            );
            break;
          case 'refine':
            result = await this.refineCodeWithOptimization(
              op.params.currentCode,
              signal
            );
            break;
          case 'explain':
            result = await this.explainCodeWithOptimization(
              op.params.currentCode,
              signal
            );
            break;
          default:
            throw new Error(`Unknown operation type: ${op.type}`);
        }
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error });
      }
    }
    
    this.recordMetric('batch', performance.now() - startTime, false);
    return results;
  }
  
  /**
   * Get AI optimization metrics for monitoring
   */
  getAIMetrics(operationType?: string): AIOptimizationMetrics | Map<string, AIOptimizationMetrics> {
    if (operationType) {
      return this.metrics.get(operationType) || this.getDefaultMetrics();
    }
    return new Map(this.metrics);
  }
  
  /**
   * Clear AI cache to free up memory
   */
  clearAICache(): void {
    this.responseCache.clear();
  }
  
  // Private helper methods
  private generateCacheKey(operation: string, ...params: any[]): string {
    const key = `${operation}::${JSON.stringify(params)}`;
    // Create a simple hash to keep key length manageable
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${operation}_${Math.abs(hash).toString(36)}`;
  }
  
  private setCache(key: string, data: any): void {
    if (this.responseCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry (FIFO)
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
    
    this.responseCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.DEFAULT_TTL
    });
  }
  
  private recordMetric(
    operation: string,
    responseTime: number,
    cacheHit: boolean,
    hasError: boolean = false
  ): void {
    let metrics = this.metrics.get(operation);
    if (!metrics) {
      metrics = this.getDefaultMetrics();
    }
    
    metrics.callCount++;
    metrics.avgResponseTime = (metrics.avgResponseTime * (metrics.callCount - 1) + responseTime) / metrics.callCount;
    metrics.cacheHitRate = cacheHit ? metrics.cacheHitRate + 1 : metrics.cacheHitRate;
    metrics.errorRate = hasError ? metrics.errorRate + 1 : metrics.errorRate;
    
    this.metrics.set(operation, metrics);
    
    // Record to performance monitor for broader tracking
    performanceMonitor.recordMetric(`ai_${operation}_time`, responseTime);
  }
  
  private getDefaultMetrics(): AIOptimizationMetrics {
    return {
      callCount: 0,
      avgResponseTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      tokenUsage: 0,
      costEstimate: 0
    };
  }
  
  private isRetryableError(error: any): boolean {
    // Check for common retryable errors
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorStatus = error?.status;
    
    return (
      errorStatus === 429 || // Rate limit
      errorStatus >= 500 || // Server error
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('fetch failed')
    );
  }
  
  private calculateExponentialBackoff(baseDelay: number, attempt: number): number {
    // Exponential backoff with jitter: base * 2^attempt + random jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return exponentialDelay + jitter;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get estimated cost based on token usage
   */
  estimateCost(settings: AISettings, tokenCount: number): number {
    // Basic cost estimation based on model
    const costPerMillionTokens: Record<string, number> = {
      'gemini-3-pro-preview': 0.15, // $0.15 per million tokens input
      'gemini-2.5-flash': 0.075,    // $0.075 per million tokens input
      'gpt-4': 10,                 // $10 per million tokens input
      'gpt-4-turbo': 5,            // $5 per million tokens input
    };
    
    const costPerToken = (costPerMillionTokens[settings.modelName] || 0.15) / 1_000_000;
    return costPerToken * tokenCount;
  }
  
  /**
   * Warm up AI connections and caches
   */
  async warmUp(settings: AISettings): Promise<boolean> {
    try {
      // Test connection first
      const isConnected = await testAIConnection(settings);
      if (!isConnected) {
        return false;
      }
      
      // Preload common operations in the background
      setTimeout(() => {
        this.preloadCommonAICalls();
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('AI warmup failed:', error);
      return false;
    }
  }
}

export const enhancedAIPerformanceOptimizer = new EnhancedAIPerformanceOptimizer();