/**
 * Modular Real-time UX Performance Monitoring Manager
 * Orchestrates all UX monitoring activities through modular components
 */

import { useState, useEffect, useCallback } from 'react';
import { UXMetrics, UXScore, UXConfig } from './uxTypes';
import { UXMetricsCollector } from './uxMetricsCollector';
import { UXScoreCalculator } from './uxScoreCalculator';
import { UXAnalyzer, UXInsights } from './uxAnalyzer';
import { UX_MONITORING_CONFIG } from '../../constants/modularConfig';

class RealTimeUXScoring {
  private static instance: RealTimeUXScoring;
  private config: UXConfig;
  private metrics: UXMetrics;
  private metricsCollector: UXMetricsCollector;
  private scoreCalculator: UXScoreCalculator;
  private uxAnalyzer: UXAnalyzer;
  private monitoringTimer?: ReturnType<typeof setInterval>;
  private isMonitoring = false;

  private constructor(config: Partial<UXConfig> = {}) {
    this.config = {
      scoringWeights: {
        performance: UX_MONITORING_CONFIG.WEIGHTS.PERFORMANCE,
        reliability: UX_MONITORING_CONFIG.WEIGHTS.RELIABILITY,
        engagement: UX_MONITORING_CONFIG.WEIGHTS.ENGAGEMENT,
      },
      thresholds: {
        lcp: {
          good: UX_MONITORING_CONFIG.THRESHOLDS.LCP.GOOD,
          needsImprovement: UX_MONITORING_CONFIG.THRESHOLDS.LCP.NEEDS_IMPROVEMENT
        },
        fid: {
          good: UX_MONITORING_CONFIG.THRESHOLDS.FID.GOOD,
          needsImprovement: UX_MONITORING_CONFIG.THRESHOLDS.FID.NEEDS_IMPROVEMENT
        },
        cls: {
          good: UX_MONITORING_CONFIG.THRESHOLDS.CLS.GOOD,
          needsImprovement: UX_MONITORING_CONFIG.THRESHOLDS.CLS.NEEDS_IMPROVEMENT
        },
        ttfb: {
          good: UX_MONITORING_CONFIG.THRESHOLDS.TTFB.GOOD,
          needsImprovement: UX_MONITORING_CONFIG.THRESHOLDS.TTFB.NEEDS_IMPROVEMENT
        },
      },
      enableRealTimeMonitoring: true,
      monitoringInterval: UX_MONITORING_CONFIG.INTERVALS.MONITORING_MS,
      enablePredictiveAnalysis: true,
      ...config
    };

    this.metrics = this.initializeMetrics();
    this.metricsCollector = new UXMetricsCollector(this.metrics);
    this.scoreCalculator = new UXScoreCalculator(this.config);
    this.uxAnalyzer = new UXAnalyzer(this.scoreCalculator, this.config);
  }

  static getInstance(config?: Partial<UXConfig>): RealTimeUXScoring {
    if (!RealTimeUXScoring.instance) {
      RealTimeUXScoring.instance = new RealTimeUXScoring(config);
    }
    return RealTimeUXScoring.instance;
  }

  /**
   * Initialize UX metrics with default values
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
   * Start real-time UX monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.metricsCollector.startMonitoring();

    if (this.config.enableRealTimeMonitoring) {
      this.startPeriodicAssessment();
    }

    console.log('UX monitoring started');
  }

  /**
   * Stop real-time UX monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    this.metricsCollector.stopMonitoring();

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    console.log('UX monitoring stopped');
  }

  /**
   * Start periodic UX assessment
   */
  private startPeriodicAssessment(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(() => {
      this.performPeriodicAssessment();
    }, this.config.monitoringInterval);
  }

  /**
   * Perform periodic UX assessment
   */
  private performPeriodicAssessment(): void {
    try {
      // Measure render time
      this.metricsCollector.measureRenderTime();

      // Update interaction metrics (in real implementation, these would be event-driven)
      this.updateInteractionMetrics();

      // Update error metrics (in real implementation, these would be error-driven)
      this.updateErrorMetrics();

      // Log current score for debugging
      const currentScore = this.scoreCalculator.calculateScore(this.metrics);
      console.log(`UX Score: ${currentScore.overall} (${this.getHealthStatus(currentScore.overall)})`);
    } catch (error: unknown) {
      console.error('Error during periodic UX assessment:', error);
    }
  }

  /**
   * Update interaction metrics (placeholder for real implementation)
   */
  private updateInteractionMetrics(): void {
    // In a real implementation, these would be updated by event listeners
    this.metricsCollector.updateInteractionMetrics({
      clickDelay: Math.random() * 100, // Placeholder
      scrollPerformance: Math.random() * 10, // Placeholder
      inputLag: Math.random() * 50, // Placeholder
    });
  }

  /**
   * Update error metrics (placeholder for real implementation)
   */
  private updateErrorMetrics(): void {
    // In a real implementation, these would be updated by error handlers
    this.metricsCollector.updateErrorMetrics({
      errorRate: Math.random() * 0.1, // Placeholder
      crashRate: Math.random() * 0.01, // Placeholder
    });
  }

  /**
   * Calculate current UX score
   */
  calculateUXScore(): UXScore {
    return this.scoreCalculator.calculateScore(this.metrics);
  }

  /**
   * Get comprehensive UX insights
   */
  getUXInsights(): UXInsights {
    return this.uxAnalyzer.getInsights(this.metrics);
  }

  /**
   * Get current metrics
   */
  getMetrics(): UXMetrics {
    return this.metricsCollector.getMetrics();
  }

  /**
   * Get current configuration
   */
  getConfig(): UXConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<UXConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Recreate components with new config
    this.scoreCalculator = new UXScoreCalculator(this.config);
    this.uxAnalyzer = new UXAnalyzer(this.scoreCalculator, this.config);

    // Restart monitoring if active
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Get health status based on score
   */
  getHealthStatus(score: number): 'excellent' | 'good' | 'needs-improvement' | 'poor' {
    if (score >= UX_MONITORING_CONFIG.SCORES.EXCELLENT) return 'excellent';
    if (score >= UX_MONITORING_CONFIG.SCORES.GOOD) return 'good';
    if (score >= UX_MONITORING_CONFIG.SCORES.NEEDS_IMPROVEMENT) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get performance benchmarks
   */
  getBenchmarks(): Record<string, { good: number; average: number; poor: number }> {
    return this.uxAnalyzer.getBenchmarks();
  }

  /**
   * Compare current metrics with benchmarks
   */
  compareWithBenchmarks(): Record<string, 'good' | 'average' | 'poor'> {
    return this.uxAnalyzer.compareWithBenchmarks(this.metrics);
  }

  /**
   * Get score history
   */
  getScoreHistory(): UXScore[] {
    return this.uxAnalyzer.getScoreHistory();
  }

  /**
   * Get detailed UX report
   */
  getDetailedReport(): {
    currentScore: UXScore;
    insights: UXInsights;
    metrics: UXMetrics;
    benchmarks: Record<string, 'good' | 'average' | 'poor'>;
    recommendations: string[];
  } {
    const currentScore = this.calculateUXScore();
    const insights = this.getUXInsights();
    const benchmarkComparison = this.compareWithBenchmarks();

    return {
      currentScore,
      insights,
      metrics: this.getMetrics(),
      benchmarks: benchmarkComparison,
      recommendations: [
        ...currentScore.recommendations,
        ...insights.predictiveInsights.opportunities,
      ],
    };
  }

  /**
   * Force immediate metrics collection and scoring
   */
  forceAssessment(): UXScore {
    this.performPeriodicAssessment();
    return this.calculateUXScore();
  }

  /**
   * Reset all metrics and history
   */
  reset(): void {
    this.metricsCollector.resetMetrics();
    this.uxAnalyzer.clearHistory();
    console.log('UX metrics and history reset');
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Destroy the monitoring instance
   */
  destroy(): void {
    this.stopMonitoring();
    this.reset();
  }
}

// Export singleton instance
export const realTimeUXScoring = RealTimeUXScoring.getInstance();

// Export class for testing
export { RealTimeUXScoring };

// Export React hook for easy integration
export function useUXMonitoring(config?: Partial<UXConfig>) {
  const [score, setScore] = useState<UXScore | null>(null);
  const [insights, setInsights] = useState<UXInsights | null>(null);
  const [isActive, setIsActive] = useState(false);

  const uxMonitor = RealTimeUXScoring.getInstance(config);

  useEffect(() => {
    // Start monitoring
    uxMonitor.startMonitoring();
    setIsActive(true);

    // Set up periodic updates
    const updateInterval = setInterval(() => {
      const currentScore = uxMonitor.calculateUXScore();
      const currentInsights = uxMonitor.getUXInsights();
      
      setScore(currentScore);
      setInsights(currentInsights);
    }, uxMonitor.getConfig().monitoringInterval);

    return () => {
      clearInterval(updateInterval);
    };
  }, [uxMonitor]);

  const forceAssessment = useCallback(() => {
    const newScore = uxMonitor.forceAssessment();
    const newInsights = uxMonitor.getUXInsights();
    setScore(newScore);
    setInsights(newInsights);
    return newScore;
  }, [uxMonitor]);

  return {
    score,
    insights,
    isActive,
    forceAssessment,
    metrics: uxMonitor.getMetrics(),
    benchmarks: uxMonitor.getBenchmarks(),
    comparison: uxMonitor.compareWithBenchmarks(),
    history: uxMonitor.getScoreHistory(),
    report: uxMonitor.getDetailedReport(),
  };
}