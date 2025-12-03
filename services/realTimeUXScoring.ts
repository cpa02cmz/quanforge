/**
 * Real-time UX Performance Scoring
 * Monitors and scores user experience in real-time
 * Provides actionable insights for performance optimization
 */

// Import React hooks
import { useState, useEffect, useCallback } from 'react';

interface UXMetrics {
  // Core Web Vitals
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  
  // Custom metrics
  fcp: number; // First Contentful Paint
  tti: number; // Time to Interactive
  si: number; // Speed Index
  tbt: number; // Total Blocking Time
  
  // Application-specific metrics
  apiResponseTime: number;
  renderTime: number;
  errorRate: number;
  crashRate: number;
  
  // User interaction metrics
  clickDelay: number;
  scrollPerformance: number;
  inputLag: number;
}

interface UXScore {
  overall: number; // 0-100
  performance: number; // 0-100
  reliability: number; // 0-100
  engagement: number; // 0-100
  
  // Individual scores
  lcpScore: number;
  fidScore: number;
  clsScore: number;
  ttfbScore: number;
  
  // Recommendations
  recommendations: string[];
  issues: UXIssue[];
}

interface UXIssue {
  type: 'critical' | 'warning' | 'info';
  metric: string;
  value: number;
  threshold: number;
  description: string;
  recommendation: string;
}

interface UXConfig {
  scoringWeights: {
    performance: number;
    reliability: number;
    engagement: number;
  };
  thresholds: {
    lcp: { good: number; needsImprovement: number };
    fid: { good: number; needsImprovement: number };
    cls: { good: number; needsImprovement: number };
    ttfb: { good: number; needsImprovement: number };
  };
  enableRealTimeMonitoring: boolean;
  monitoringInterval: number;
  enablePredictiveAnalysis: boolean;
}

class UXPerformanceMonitor {
  private config: UXConfig;
  private metrics: UXMetrics;
  private observers: PerformanceObserver[] = [];
  private monitoringTimer?: NodeJS.Timeout;
  private scoreHistory: UXScore[] = [];
  private maxHistorySize = 100;

  constructor(config: Partial<UXConfig> = {}) {
    this.config = {
      scoringWeights: {
        performance: 0.4,
        reliability: 0.3,
        engagement: 0.3,
      },
      thresholds: {
        lcp: { good: 2500, needsImprovement: 4000 },
        fid: { good: 100, needsImprovement: 300 },
        cls: { good: 0.1, needsImprovement: 0.25 },
        ttfb: { good: 800, needsImprovement: 1800 },
      },
      enableRealTimeMonitoring: true,
      monitoringInterval: 5000, // 5 seconds
      enablePredictiveAnalysis: true,
      ...config,
    };

    this.metrics = this.initializeMetrics();
    this.initializeObservers();
    
    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }
  }

  /**
   * Initialize metrics with default values
   */
  private initializeMetrics(): UXMetrics {
    return {
      lcp: 0,
      fid: 0,
      cls: 0,
      ttfb: 0,
      fcp: 0,
      tti: 0,
      si: 0,
      tbt: 0,
      apiResponseTime: 0,
      renderTime: 0,
      errorRate: 0,
      crashRate: 0,
      clickDelay: 0,
      scrollPerformance: 0,
      inputLag: 0,
    };
  }

  /**
   * Initialize performance observers
   */
  private initializeObservers(): void {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }

    // Observe Largest Contentful Paint
    this.observeLCP();
    
    // Observe First Input Delay
    this.observeFID();
    
    // Observe Cumulative Layout Shift
    this.observeCLS();
    
    // Observe Navigation Timing
    this.observeNavigation();
    
    // Observe Resource Timing
    this.observeResources();
    
    // Observe Long Tasks
    this.observeLongTasks();
  }

  /**
   * Observe Largest Contentful Paint
   */
  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.lcp = lastEntry.startTime;
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('LCP observation not supported:', error);
    }
  }

  /**
   * Observe First Input Delay
   */
  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.name === 'first-input') {
            this.metrics.fid = (entry as any).processingStart - entry.startTime;
            break;
          }
        }
      });
      
      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('FID observation not supported:', error);
    }
  }

  /**
   * Observe Cumulative Layout Shift
   */
  private observeCLS(): void {
    try {
      let clsValue = 0;
      
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.metrics.cls = clsValue;
      });
      
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('CLS observation not supported:', error);
    }
  }

  /**
   * Observe Navigation Timing
   */
  private observeNavigation(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
            this.metrics.fcp = navEntry.loadEventStart - navEntry.fetchStart;
            break;
          }
        }
      });
      
      observer.observe({ entryTypes: ['navigation'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('Navigation timing observation not supported:', error);
    }
  }

  /**
   * Observe Resource Timing
   */
  private observeResources(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        let totalApiTime = 0;
        let apiCount = 0;
        
        for (const entry of entries) {
          if (entry.entryType === 'resource') {
            const resource = entry as PerformanceResourceTiming;
            
            // Check if it's an API call
            if (resource.name.includes('/api/')) {
              totalApiTime += resource.responseEnd - resource.requestStart;
              apiCount++;
            }
          }
        }
        
        if (apiCount > 0) {
          this.metrics.apiResponseTime = totalApiTime / apiCount;
        }
      });
      
      observer.observe({ entryTypes: ['resource'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('Resource timing observation not supported:', error);
    }
  }

  /**
   * Observe Long Tasks
   */
  private observeLongTasks(): void {
    try {
      let totalBlockingTime = 0;
      
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'longtask') {
            totalBlockingTime += entry.duration - 50;
          }
        }
        this.metrics.tbt = totalBlockingTime;
      });
      
      observer.observe({ entryTypes: ['longtask'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('Long task observation not supported:', error);
    }
  }

  /**
   * Start real-time monitoring
   */
  private startRealTimeMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.updateMetrics();
      const score = this.calculateUXScore();
      this.scoreHistory.push(score);
      
      // Keep history size manageable
      if (this.scoreHistory.length > this.maxHistorySize) {
        this.scoreHistory.shift();
      }
      
      // Emit score update event
      this.emitScoreUpdate(score);
      
    }, this.config.monitoringInterval);
  }

  /**
   * Update metrics with current values
   */
  private updateMetrics(): void {
    // Update render time
    this.updateRenderTime();
    
    // Update user interaction metrics
    this.updateInteractionMetrics();
    
    // Update error rates
    this.updateErrorMetrics();
  }

  /**
   * Update render time
   */
  private updateRenderTime(): void {
    if (typeof performance === 'undefined' || !performance.now) {
      return;
    }
    
    const startTime = performance.now();
    
    // Force a reflow to measure render time
    document.body.offsetHeight;
    
    this.metrics.renderTime = performance.now() - startTime;
  }

  /**
   * Update user interaction metrics
   */
  private updateInteractionMetrics(): void {
    // These would be updated by event listeners in a real implementation
    // For now, we'll use placeholder values
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(): void {
    // These would be updated by error handlers in a real implementation
    // For now, we'll use placeholder values
  }

  /**
   * Calculate UX score
   */
  calculateUXScore(): UXScore {
    const performanceScore = this.calculatePerformanceScore();
    const reliabilityScore = this.calculateReliabilityScore();
    const engagementScore = this.calculateEngagementScore();
    
    const overall = Math.round(
      performanceScore * this.config.scoringWeights.performance +
      reliabilityScore * this.config.scoringWeights.reliability +
      engagementScore * this.config.scoringWeights.engagement
    );

    const issues = this.identifyIssues();
    const recommendations = this.generateRecommendations(issues);

    return {
      overall,
      performance: performanceScore,
      reliability: reliabilityScore,
      engagement: engagementScore,
      lcpScore: this.scoreMetric(this.metrics.lcp, this.config.thresholds.lcp),
      fidScore: this.scoreMetric(this.metrics.fid, this.config.thresholds.fid),
      clsScore: this.scoreMetric(this.metrics.cls, this.config.thresholds.cls),
      ttfbScore: this.scoreMetric(this.metrics.ttfb, this.config.thresholds.ttfb),
      recommendations,
      issues,
    };
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(): number {
    const lcpScore = this.scoreMetric(this.metrics.lcp, this.config.thresholds.lcp);
    const fidScore = this.scoreMetric(this.metrics.fid, this.config.thresholds.fid);
    const clsScore = this.scoreMetric(this.metrics.cls, this.config.thresholds.cls);
    const ttfbScore = this.scoreMetric(this.metrics.ttfb, this.config.thresholds.ttfb);
    
    return Math.round((lcpScore + fidScore + clsScore + ttfbScore) / 4);
  }

  /**
   * Calculate reliability score
   */
  private calculateReliabilityScore(): number {
    const errorScore = Math.max(0, 100 - (this.metrics.errorRate * 100));
    const crashScore = Math.max(0, 100 - (this.metrics.crashRate * 100));
    const apiScore = this.scoreMetric(this.metrics.apiResponseTime, { good: 200, needsImprovement: 1000 });
    
    return Math.round((errorScore + crashScore + apiScore) / 3);
  }

  /**
   * Calculate engagement score
   */
  private calculateEngagementScore(): number {
    const clickScore = this.scoreMetric(this.metrics.clickDelay, { good: 50, needsImprovement: 200 });
    const scrollScore = Math.min(100, this.metrics.scrollPerformance * 10);
    const inputScore = this.scoreMetric(this.metrics.inputLag, { good: 16, needsImprovement: 100 });
    
    return Math.round((clickScore + scrollScore + inputScore) / 3);
  }

  /**
   * Score individual metric
   */
  private scoreMetric(value: number, thresholds: { good: number; needsImprovement: number }): number {
    if (value <= thresholds.good) {
      return 100;
    } else if (value <= thresholds.needsImprovement) {
      // Linear interpolation between good and needs improvement
      const ratio = (value - thresholds.good) / (thresholds.needsImprovement - thresholds.good);
      return Math.round(100 - (ratio * 50));
    } else {
      // Linear interpolation beyond needs improvement
      const ratio = Math.min((value - thresholds.needsImprovement) / thresholds.needsImprovement, 1);
      return Math.round(50 - (ratio * 50));
    }
  }

  /**
   * Identify performance issues
   */
  private identifyIssues(): UXIssue[] {
    const issues: UXIssue[] = [];

    // Check LCP
    if (this.metrics.lcp > this.config.thresholds.lcp.needsImprovement) {
      issues.push({
        type: 'critical',
        metric: 'LCP',
        value: this.metrics.lcp,
        threshold: this.config.thresholds.lcp.needsImprovement,
        description: 'Largest Contentful Paint is too slow',
        recommendation: 'Optimize images, reduce server response time, eliminate render-blocking resources',
      });
    }

    // Check FID
    if (this.metrics.fid > this.config.thresholds.fid.needsImprovement) {
      issues.push({
        type: 'critical',
        metric: 'FID',
        value: this.metrics.fid,
        threshold: this.config.thresholds.fid.needsImprovement,
        description: 'First Input Delay is too high',
        recommendation: 'Reduce JavaScript execution time, break up long tasks, use web workers',
      });
    }

    // Check CLS
    if (this.metrics.cls > this.config.thresholds.cls.needsImprovement) {
      issues.push({
        type: 'warning',
        metric: 'CLS',
        value: this.metrics.cls,
        threshold: this.config.thresholds.cls.needsImprovement,
        description: 'Cumulative Layout Shift is too high',
        recommendation: 'Include size attributes for images and videos, avoid inserting content above existing content',
      });
    }

    // Check TTFB
    if (this.metrics.ttfb > this.config.thresholds.ttfb.needsImprovement) {
      issues.push({
        type: 'critical',
        metric: 'TTFB',
        value: this.metrics.ttfb,
        threshold: this.config.thresholds.ttfb.needsImprovement,
        description: 'Time to First Byte is too slow',
        recommendation: 'Improve server performance, use CDN, optimize backend queries',
      });
    }

    // Check error rate
    if (this.metrics.errorRate > 0.05) {
      issues.push({
        type: 'critical',
        metric: 'Error Rate',
        value: this.metrics.errorRate,
        threshold: 0.05,
        description: 'High error rate detected',
        recommendation: 'Improve error handling, add better validation, monitor backend health',
      });
    }

    return issues;
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(issues: UXIssue[]): string[] {
    const recommendations = new Set<string>();

    for (const issue of issues) {
      recommendations.add(issue.recommendation);
    }

    // Add general recommendations based on overall performance
    const score = this.calculateUXScore();
    
    if (score.overall < 50) {
      recommendations.add('Consider comprehensive performance audit and optimization');
    }
    
    if (score.performance < 60) {
      recommendations.add('Focus on Core Web Vitals optimization');
    }
    
    if (score.reliability < 70) {
      recommendations.add('Improve error handling and monitoring');
    }
    
    if (score.engagement < 60) {
      recommendations.add('Optimize user interaction responsiveness');
    }

    return Array.from(recommendations);
  }

  /**
   * Emit score update event
   */
  private emitScoreUpdate(score: UXScore): void {
    const event = new CustomEvent('uxScoreUpdate', {
      detail: { score, timestamp: Date.now() },
    });
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): UXMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current score
   */
  getCurrentScore(): UXScore {
    return this.calculateUXScore();
  }

  /**
   * Get score history
   */
  getScoreHistory(): UXScore[] {
    return [...this.scoreHistory];
  }

  /**
   * Get performance trends
   */
  getTrends(): {
    trend: 'improving' | 'declining' | 'stable';
    change: number;
    period: string;
  } {
    if (this.scoreHistory.length < 2) {
      return { trend: 'stable', change: 0, period: 'insufficient data' };
    }

    const recent = this.scoreHistory.slice(-10);
    const older = this.scoreHistory.slice(-20, -10);
    
    if (older.length === 0) {
      return { trend: 'stable', change: 0, period: 'insufficient historical data' };
    }

    const recentAvg = recent.reduce((sum, score) => sum + score.overall, 0) / recent.length;
    const olderAvg = older.reduce((sum, score) => sum + score.overall, 0) / older.length;
    
    const change = recentAvg - olderAvg;
    let trend: 'improving' | 'declining' | 'stable';
    
    if (change > 5) {
      trend = 'improving';
    } else if (change < -5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return { trend, change, period: 'last 20 measurements' };
  }

  /**
   * Record custom metric
   */
  recordMetric(name: keyof UXMetrics, value: number): void {
    if (name in this.metrics) {
      (this.metrics as any)[name] = value;
    }
  }

  /**
   * Record user interaction
   */
  recordInteraction(type: 'click' | 'scroll' | 'input', delay: number): void {
    switch (type) {
      case 'click':
        this.metrics.clickDelay = delay;
        break;
      case 'scroll':
        this.metrics.scrollPerformance = Math.max(0, 100 - delay);
        break;
      case 'input':
        this.metrics.inputLag = delay;
        break;
    }
  }

  /**
   * Record error
   */
  recordError(): void {
    this.metrics.errorRate += 0.01;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.scoreHistory = [];
  }

  /**
   * Destroy monitor and cleanup resources
   */
  destroy(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    for (const observer of this.observers) {
      observer.disconnect();
    }

    this.observers = [];
    this.resetMetrics();
  }
}

// Global instance
export const uxPerformanceMonitor = new UXPerformanceMonitor({
  enableRealTimeMonitoring: true,
  monitoringInterval: 5000,
  enablePredictiveAnalysis: true,
});

// Export factory function
export const createUXPerformanceMonitor = (config?: Partial<UXConfig>): UXPerformanceMonitor => {
  return new UXPerformanceMonitor(config);
};

// Export types
export type { UXMetrics, UXScore, UXIssue, UXConfig };

/**
 * React hook for UX monitoring
 */
export function useUXScore() {
  const [score, setScore] = useState<UXScore | null>(null);
  const [metrics, setMetrics] = useState<UXMetrics | null>(null);
  const [trends, setTrends] = useState<any>(null);

  useEffect(() => {
    // Get initial score
    const initialScore = uxPerformanceMonitor.getCurrentScore();
    setScore(initialScore);
    setMetrics(uxPerformanceMonitor.getMetrics());
    setTrends(uxPerformanceMonitor.getTrends());

    // Listen for score updates
    const handleScoreUpdate = (event: CustomEvent) => {
      setScore(event.detail.score);
      setMetrics(uxPerformanceMonitor.getMetrics());
      setTrends(uxPerformanceMonitor.getTrends());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('uxScoreUpdate', handleScoreUpdate as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('uxScoreUpdate', handleScoreUpdate as EventListener);
      }
    };
  }, []);

  const recordInteraction = useCallback((type: 'click' | 'scroll' | 'input', delay: number) => {
    uxPerformanceMonitor.recordInteraction(type, delay);
  }, []);

  const recordError = useCallback(() => {
    uxPerformanceMonitor.recordError();
  }, []);

  return {
    score,
    metrics,
    trends,
    recordInteraction,
    recordError,
  };
}