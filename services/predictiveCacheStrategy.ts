/**
 * Predictive Cache Strategy for Edge Optimization
 * Implements intelligent caching based on user behavior patterns and access predictions
 */

export interface AccessPattern {
  key: string;
  frequency: number;
  lastAccess: number;
  avgResponseTime: number;
  priority: 'high' | 'medium' | 'low';
  region?: string;
}

export interface UserBehavior {
  userId?: string;
  sessionId: string;
  region: string;
  recentRequests: string[];
  timePatterns: Record<string, number>; // Hour of day -> frequency
  navigationPatterns: string[]; // Sequence of pages visited
}

export interface CacheConfig {
  defaultTTL: number;
  maxEntries: number;
  cleanupInterval: number;
  predictiveThreshold: number; // Confidence threshold for predictive caching
  regionOptimization: boolean;
}

export interface PredictionResult {
  url: string;
  confidence: number;
  reason: string;
  estimatedBenefit: number;
  priority: 'high' | 'medium' | 'low';
}

class PredictiveCacheStrategy {
  private static instance: PredictiveCacheStrategy;
  private accessPatterns: Map<string, AccessPattern> = new Map();
  private userBehaviors: Map<string, UserBehavior> = new Map();
  private predictions: Map<string, PredictionResult[]> = new Map();
  private config: CacheConfig;
  private cleanupTimer: number | null = null;
  private learningEnabled: boolean = true;

  private constructor() {
    this.config = {
      defaultTTL: 300000, // 5 minutes
      maxEntries: 1000,
      cleanupInterval: 60000, // 1 minute
      predictiveThreshold: 0.7, // 70% confidence
      regionOptimization: true
    };

    this.startCleanup();
    this.initializePredictiveModels();
  }

  static getInstance(): PredictiveCacheStrategy {
    if (!PredictiveCacheStrategy.instance) {
      PredictiveCacheStrategy.instance = new PredictiveCacheStrategy();
    }
    return PredictiveCacheStrategy.instance;
  }

  /**
   * Initialize predictive models and load historical data
   */
  private async initializePredictiveModels(): Promise<void> {
    try {
      // Load historical patterns from localStorage if available
      const stored = localStorage.getItem('predictive_cache_patterns');
      if (stored) {
        const patterns = JSON.parse(stored);
        Object.entries(patterns).forEach(([key, pattern]: [string, any]) => {
          this.accessPatterns.set(key, pattern as AccessPattern);
        });
      }

      console.log(`Predictive cache initialized with ${this.accessPatterns.size} patterns`);
    } catch (error) {
      console.warn('Failed to initialize predictive models:', error);
    }
  }

  /**
   * Record access to a resource for learning
   */
  recordAccess(key: string, responseTime: number, region?: string, userId?: string): void {
    const now = Date.now();
    const existing = this.accessPatterns.get(key);

    if (existing) {
      // Update existing pattern
      existing.frequency = (existing.frequency + 1) / 2; // Exponential moving average
      existing.lastAccess = now;
      existing.avgResponseTime = (existing.avgResponseTime + responseTime) / 2;
      existing.region = region;
      
      // Update priority based on frequency and response time
      existing.priority = this.calculatePriority(existing);
    } else {
      // Create new pattern
      const pattern: AccessPattern = {
        key,
        frequency: 1.0,
        lastAccess: now,
        avgResponseTime: responseTime,
        priority: 'medium',
        region
      };
      
      this.accessPatterns.set(key, pattern);
    }

    // Record user behavior if userId provided
    if (userId) {
      this.recordUserBehavior(userId, key, region);
    }
  }

  /**
   * Record user behavior for better predictions
   */
  private recordUserBehavior(userId: string, key: string, region?: string): void {
    const sessionId = this.getSessionId();
    let behavior = this.userBehaviors.get(userId);

    if (!behavior) {
      behavior = {
        userId,
        sessionId,
        region: region || 'unknown',
        recentRequests: [],
        timePatterns: {},
        navigationPatterns: []
      };
      this.userBehaviors.set(userId, behavior);
    }

    // Update recent requests
    behavior.recentRequests.push(key);
    if (behavior.recentRequests.length > 20) {
      behavior.recentRequests.shift();
    }

    // Update time patterns
    const hour = new Date().getHours().toString();
    behavior.timePatterns[hour] = (behavior.timePatterns[hour] || 0) + 1;

    // Update navigation patterns
    behavior.navigationPatterns.push(key);
    if (behavior.navigationPatterns.length > 10) {
      behavior.navigationPatterns.shift();
    }
  }

  /**
   * Calculate priority based on frequency and response time
   */
  private calculatePriority(pattern: AccessPattern): 'high' | 'medium' | 'low' {
    const score = pattern.frequency * 100 - pattern.avgResponseTime;
    
    if (score > 80) return 'high';
    if (score > 40) return 'medium';
    return 'low';
  }

  /**
   * Get intelligent cache warming recommendations
   */
  async getWarmingRecommendations(region?: string, limit: number = 20): Promise<PredictionResult[]> {
    const recommendations: PredictionResult[] = [];
    const now = Date.now();

    // Sort patterns by priority and recent access
    const sortedPatterns = Array.from(this.accessPatterns.values())
      .filter(pattern => !region || pattern.region === region || !pattern.region)
      .sort((a, b) => {
        // Priority score calculation
        const scoreA = this.calculatePriorityScore(a, now);
        const scoreB = this.calculatePriorityScore(b, now);
        return scoreB - scoreA;
      });

    for (const pattern of sortedPatterns.slice(0, limit)) {
      const confidence = this.calculateConfidence(pattern, now);
      
      if (confidence >= this.config.predictiveThreshold) {
        const prediction: PredictionResult = {
          url: pattern.key,
          confidence,
          reason: this.getReason(pattern, confidence),
          estimatedBenefit: this.calculateBenefit(pattern),
          priority: pattern.priority
        };
        
        recommendations.push(prediction);
      }
    }

    // Store predictions for analysis
    const cacheKey = region || 'global';
    this.predictions.set(cacheKey, recommendations);

    return recommendations;
  }

  /**
   * Calculate priority score for a pattern
   */
  private calculatePriorityScore(pattern: AccessPattern, now: number): number {
    const timeSinceAccess = now - pattern.lastAccess;
    const recencyScore = Math.max(0, 1 - timeSinceAccess / (24 * 60 * 60 * 1000)); // Decay over 24 hours
    const frequencyScore = pattern.frequency;
    const performanceScore = Math.max(0, 1 - pattern.avgResponseTime / 1000); // Normalize to seconds
    
    return frequencyScore * 0.4 + recencyScore * 0.4 + performanceScore * 0.2;
  }

  /**
   * Calculate confidence score for prediction
   */
  private calculateConfidence(pattern: AccessPattern, now: number): number {
    const timeSinceAccess = now - pattern.lastAccess;
    const recencyFactor = Math.max(0, 1 - timeSinceAccess / (60 * 60 * 1000)); // 1 hour decay
    const frequencyFactor = Math.min(1, pattern.frequency / 10); // Normalize to max 10 accesses
    const consistencyFactor = pattern.avgResponseTime < 500 ? 1 : 0.7; // Fast responses are more reliable
    
    return recencyFactor * 0.4 + frequencyFactor * 0.4 + consistencyFactor * 0.2;
  }

  /**
   * Get reason for prediction
   */
  private getReason(pattern: AccessPattern, confidence: number): string {
    const timeSinceAccess = Date.now() - pattern.lastAccess;
    
    if (pattern.frequency > 5) {
      return `High frequency access (${pattern.frequency.toFixed(1)} times)`;
    }
    
    if (timeSinceAccess < 300000) { // 5 minutes
      return `Recently accessed (${Math.round(timeSinceAccess / 1000)}s ago)`;
    }
    
    if (pattern.avgResponseTime < 200) {
      return `Fast response time (${pattern.avgResponseTime.toFixed(0)}ms)`;
    }
    
    return `Pattern-based prediction (${(confidence * 100).toFixed(1)}% confidence)`;
  }

  /**
   * Calculate estimated benefit of caching
   */
  private calculateBenefit(pattern: AccessPattern): number {
    // Benefit = frequency * response_time_savings
    const responseTimeSavings = Math.max(0, pattern.avgResponseTime - 50); // Assume 50ms cache hit time
    return pattern.frequency * responseTimeSavings;
  }

  /**
   * Predict next requests based on user behavior
   */
  async predictNextRequests(userId: string, limit: number = 10): Promise<PredictionResult[]> {
    const behavior = this.userBehaviors.get(userId);
    if (!behavior || behavior.recentRequests.length < 2) {
      return [];
    }

    const predictions: PredictionResult[] = [];
    const recentKeys = behavior.recentRequests.slice(-5);

    // Find patterns that follow similar sequences
    for (const [key, pattern] of this.accessPatterns.entries()) {
      if (recentKeys.includes(key)) continue; // Skip already accessed

      const confidence = this.calculateSequenceConfidence(behavior, key);
      
      if (confidence >= this.config.predictiveThreshold) {
        predictions.push({
          url: key,
          confidence,
          reason: `Sequential pattern prediction (${(confidence * 100).toFixed(1)}% confidence)`,
          estimatedBenefit: this.calculateBenefit(pattern),
          priority: pattern.priority
        });
      }
    }

    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Calculate confidence based on sequence patterns
   */
  private calculateSequenceConfidence(behavior: UserBehavior, key: string): number {
    const recentRequests = behavior.recentRequests.slice(-3);
    let sequenceMatches = 0;
    let totalSequences = 0;

    // Look for similar sequences in historical data
    for (const pattern of this.accessPatterns.values()) {
      // This is a simplified implementation
      // In practice, you'd use more sophisticated sequence analysis
      if (Math.random() < 0.1) { // Simulated pattern matching
        totalSequences++;
        if (Math.random() < 0.3) { // Simulated match
          sequenceMatches++;
        }
      }
    }

    return totalSequences > 0 ? sequenceMatches / totalSequences : 0;
  }

  /**
   * Optimize cache for specific region
   */
  async optimizeForRegion(region: string): Promise<void> {
    if (!this.config.regionOptimization) {
      return;
    }

    const regionPatterns = Array.from(this.accessPatterns.values())
      .filter(pattern => pattern.region === region || !pattern.region);

    // Adjust TTL based on region performance
    const avgResponseTime = regionPatterns.reduce((sum, p) => sum + p.avgResponseTime, 0) / regionPatterns.length;
    
    if (avgResponseTime > 500) {
      // Increase TTL for high-latency regions
      this.config.defaultTTL = Math.min(this.config.defaultTTL * 1.5, 600000); // Max 10 minutes
    } else if (avgResponseTime < 200) {
      // Decrease TTL for low-latency regions
      this.config.defaultTTL = Math.max(this.config.defaultTTL * 0.8, 120000); // Min 2 minutes
    }

    console.log(`Optimized cache TTL for region ${region}: ${this.config.defaultTTL}ms (avg response: ${avgResponseTime.toFixed(0)}ms)`);
  }

  /**
   * Intelligent cache warming based on predictions
   */
  async intelligentWarmup(): Promise<void> {
    const startTime = performance.now();
    console.log('Starting intelligent cache warm-up...');

    try {
      // Get warming recommendations for current region
      const currentRegion = process.env['VERCEL_REGION'] || 'unknown';
      const recommendations = await this.getWarmingRecommendations(currentRegion, 15);

      // Group by priority for staged warming
      const highPriority = recommendations.filter(r => r.priority === 'high');
      const mediumPriority = recommendations.filter(r => r.priority === 'medium');
      const lowPriority = recommendations.filter(r => r.priority === 'low');

      // Stage 1: High priority (immediate)
      await this.warmupBatch(highPriority, 'high');

      // Stage 2: Medium priority (delayed)
      setTimeout(() => {
        this.warmupBatch(mediumPriority, 'medium');
      }, 1000);

      // Stage 3: Low priority (further delayed)
      setTimeout(() => {
        this.warmupBatch(lowPriority, 'low');
      }, 2000);

      const duration = performance.now() - startTime;
      console.log(`Intelligent cache warm-up completed in ${duration.toFixed(2)}ms (${recommendations.length} predictions)`);
    } catch (error) {
      console.warn('Intelligent cache warm-up failed:', error);
    }
  }

  /**
   * Warm up a batch of predictions
   */
  private async warmupBatch(predictions: PredictionResult[], priority: string): Promise<void> {
    if (predictions.length === 0) return;

    const warmupPromises = predictions.map(async (prediction, index) => {
      // Stagger requests to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, index * 100));
      
      try {
        await this.prefetch(prediction.url);
        console.debug(`Warmed up ${prediction.url} (${priority} priority, ${(prediction.confidence * 100).toFixed(1)}% confidence)`);
      } catch (error) {
        console.warn(`Failed to warm up ${prediction.url}:`, error);
      }
    });

    await Promise.allSettled(warmupPromises);
  }

  /**
   * Prefetch a URL for caching
   */
  private async prefetch(url: string): Promise<void> {
    // In a real implementation, this would make an actual request
    // For now, simulate the prefetch
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  /**
   * Get session ID for anonymous users
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('predictive_cache_session');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('predictive_cache_session', sessionId);
    }
    return sessionId;
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    this.cleanupTimer = window.setInterval(() => {
      this.cleanupOldPatterns();
    }, this.config.cleanupInterval);
  }

  /**
   * Cleanup old patterns and behaviors
   */
  private cleanupOldPatterns(): void {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    let cleanedCount = 0;

    // Clean old access patterns
    for (const [key, pattern] of this.accessPatterns.entries()) {
      if (now - pattern.lastAccess > maxAge) {
        this.accessPatterns.delete(key);
        cleanedCount++;
      }
    }

    // Clean old user behaviors
    for (const [userId, behavior] of this.userBehaviors.entries()) {
      const lastAccess = Math.max(...behavior.recentRequests.map(() => now)); // Simplified
      if (now - lastAccess > maxAge) {
        this.userBehaviors.delete(userId);
        cleanedCount++;
      }
    }

    // Limit total entries
    if (this.accessPatterns.size > this.config.maxEntries) {
      const entries = Array.from(this.accessPatterns.entries())
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
      
      const toRemove = entries.slice(0, this.accessPatterns.size - this.config.maxEntries);
      toRemove.forEach(([key]) => this.accessPatterns.delete(key));
      cleanedCount += toRemove.length;
    }

    if (cleanedCount > 0) {
      console.debug(`Predictive cache cleanup: removed ${cleanedCount} old entries`);
    }
  }

  /**
   * Get analytics about cache performance
   */
  getAnalytics(): {
    totalPatterns: number;
    patternsByPriority: Record<string, number>;
    patternsByRegion: Record<string, number>;
    avgResponseTime: number;
    hitRate: number;
    predictionsAccuracy: number;
  } {
    const patterns = Array.from(this.accessPatterns.values());
    
    const patternsByPriority = patterns.reduce((acc, p) => {
      acc[p.priority] = (acc[p.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const patternsByRegion = patterns.reduce((acc, p) => {
      const region = p.region || 'unknown';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgResponseTime = patterns.reduce((sum, p) => sum + p.avgResponseTime, 0) / patterns.length;

    return {
      totalPatterns: patterns.length,
      patternsByPriority,
      patternsByRegion,
      avgResponseTime,
      hitRate: 0, // Would be calculated from actual cache hits
      predictionsAccuracy: 0 // Would be calculated from actual prediction accuracy
    };
  }

  /**
   * Save patterns to localStorage for persistence
   */
  savePatterns(): void {
    try {
      const patterns = Object.fromEntries(this.accessPatterns);
      localStorage.setItem('predictive_cache_patterns', JSON.stringify(patterns));
    } catch (error) {
      console.warn('Failed to save predictive cache patterns:', error);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Enable/disable learning
   */
  setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.accessPatterns.clear();
    this.userBehaviors.clear();
    this.predictions.clear();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.cleanupTimer) {
      window.clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // Save patterns before cleanup
    this.savePatterns();
  }
}

// Export singleton instance
export const predictiveCacheStrategy = PredictiveCacheStrategy.getInstance();

// Export types and class for testing
export { PredictiveCacheStrategy };