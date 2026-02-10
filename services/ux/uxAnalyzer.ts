/**
 * UX Analysis and Insights Module
 * Provides advanced analysis and predictive capabilities
 */

import { UXMetrics, UXScore, UXConfig } from './uxTypes';
import { UXScoreCalculator } from './uxScoreCalculator';
import { MEMORY_LIMITS, UX_THRESHOLDS, API_RESPONSE_THRESHOLDS, SCORE_CALCULATION } from '../../constants';

export interface UXInsights {
  healthStatus: 'excellent' | 'good' | 'needs-improvement' | 'poor';
  trend: 'improving' | 'stable' | 'declining' | 'insufficient-data';
  keyMetrics: {
    best: string;
    worst: string;
    mostVolatile: string;
  };
  predictiveInsights: {
    nextPeriodScore: number;
    riskFactors: string[];
    opportunities: string[];
  };
  userImpact: {
    satisfaction: number;
    abandonmentRisk: number;
    conversionImpact: number;
  };
}

export class UXAnalyzer {
  private scoreHistory: UXScore[] = [];
  private maxHistorySize = MEMORY_LIMITS.MAX_HISTORY_SIZE;

  constructor(
    private scoreCalculator: UXScoreCalculator,
    private config: UXConfig
  ) {}

  /**
   * Add score to history for trend analysis
   */
  addScoreToHistory(score: UXScore): void {
    this.scoreHistory.push(score);
    
    // Keep history within limits
    if (this.scoreHistory.length > this.maxHistorySize) {
      this.scoreHistory = this.scoreHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get comprehensive UX insights
   */
  getInsights(currentMetrics: UXMetrics): UXInsights {
    const currentScore = this.scoreCalculator.calculateScore(currentMetrics);
    this.addScoreToHistory(currentScore);

    return {
      healthStatus: this.scoreCalculator.getHealthStatus(currentScore),
      trend: this.scoreCalculator.analyzeTrend(this.scoreHistory),
      keyMetrics: this.analyzeKeyMetrics(currentScore, currentMetrics),
      predictiveInsights: this.getPredictiveInsights(currentScore, currentMetrics),
      userImpact: this.calculateUserImpact(currentScore, currentMetrics),
    };
  }

  /**
   * Analyze key metrics to identify best, worst, and most volatile
   */
  private analyzeKeyMetrics(score: UXScore, metrics: UXMetrics): UXInsights['keyMetrics'] {
    const metricScores = [
      { name: 'LCP', score: score.lcpScore, value: metrics.lcp },
      { name: 'FID', score: score.fidScore, value: metrics.fid },
      { name: 'CLS', score: score.clsScore, value: metrics.cls },
      { name: 'TTFB', score: score.ttfbScore, value: metrics.ttfb },
      { name: 'API Response Time', score: this.calculateAPIScore(metrics.apiResponseTime), value: metrics.apiResponseTime },
    ];

    const best = metricScores.reduce((prev, current) => 
      prev.score > current.score ? prev : current
    ).name;

    const worst = metricScores.reduce((prev, current) => 
      prev.score < current.score ? prev : current
    ).name;

    // Determine most volatile (based on recent history)
    // Determine most volatile (based on recent history)
    const mostVolatile = this.calculateMostVolatile(metricScores);

    return { best, worst, mostVolatile };
  }

  /**
   * Calculate most volatile metric based on recent history
   */
  private calculateMostVolatile(metricScores: Array<{ name: string; score: number; value: number }>): string {
    if (this.scoreHistory.length < 3) {
      return 'Insufficient data';
    }

    // Calculate volatility for each metric based on recent scores
    const volatilities = metricScores.map(metric => {
      const recentScores = this.scoreHistory.slice(-10).map(score => {
        switch (metric.name) {
          case 'LCP': return score.lcpScore;
          case 'FID': return score.fidScore;
          case 'CLS': return score.clsScore;
          case 'TTFB': return score.ttfbScore;
          default: return score.overall;
        }
      });

      if (recentScores.length < 2) return { name: metric.name, volatility: 0 };

      const mean = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
      const variance = recentScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / recentScores.length;
      const volatility = Math.sqrt(variance);

      return { name: metric.name, volatility };
    });

    return volatilities.reduce((prev, current) => 
      prev.volatility > current.volatility ? prev : current
    ).name;
  }

  /**
   * Get predictive insights for next period
   */
  private getPredictiveInsights(currentScore: UXScore, metrics: UXMetrics): UXInsights['predictiveInsights'] {
    const trend = this.scoreCalculator.analyzeTrend(this.scoreHistory);
    const trendAdjustment = trend === 'improving' ? 2 : trend === 'declining' ? -2 : 0;
    
    // Simple linear prediction based on trend
    let nextPeriodScore = currentScore.overall + trendAdjustment;
    
    // Apply adjustments based on current issues
    const criticalIssues = currentScore.issues.filter(issue => issue.type === 'critical').length;
    const warningIssues = currentScore.issues.filter(issue => issue.type === 'warning').length;
    
    nextPeriodScore -= (criticalIssues * 3) + (warningIssues * 1);
    nextPeriodScore = Math.max(SCORE_CALCULATION.MIN_SCORE, Math.min(SCORE_CALCULATION.MAX_SCORE, nextPeriodScore));

    const riskFactors = this.identifyRiskFactors(currentScore, metrics);
    const opportunities = this.identifyOpportunities(currentScore, metrics);

    return {
      nextPeriodScore: Math.round(nextPeriodScore),
      riskFactors,
      opportunities,
    };
  }

  /**
   * Identify risk factors based on current metrics
   */
  private identifyRiskFactors(score: UXScore, metrics: UXMetrics): string[] {
    const riskFactors: string[] = [];

    if (score.overall < 50) {
      riskFactors.push('Overall UX score is below acceptable threshold');
    }

    if (metrics.errorRate > 0.05) {
      riskFactors.push('High error rate may lead to user frustration');
    }

    if (metrics.lcp > UX_THRESHOLDS.LCP_AVERAGE) {
      riskFactors.push('Slow loading times may increase bounce rate');
    }

    if (metrics.fid > UX_THRESHOLDS.FID_AVERAGE) {
      riskFactors.push('Poor interactivity may affect user engagement');
    }

    if (metrics.cls > 0.25) {
      riskFactors.push('Layout instability may confuse users');
    }

    if (metrics.apiResponseTime > API_RESPONSE_THRESHOLDS.POOR) {
      riskFactors.push('Slow API responses may impact user experience');
    }

    return riskFactors;
  }

  /**
   * Identify optimization opportunities
   */
  private identifyOpportunities(score: UXScore, metrics: UXMetrics): string[] {
    const opportunities: string[] = [];

    if (metrics.lcp > UX_THRESHOLDS.LCP_GOOD) {
      opportunities.push('Optimize LCP for better first impression');
    }

    if (metrics.apiResponseTime > API_RESPONSE_THRESHOLDS.GOOD) {
      opportunities.push('Implement API caching for faster responses');
    }

    if (metrics.renderTime > 50) {
      opportunities.push('Optimize React rendering for better performance');
    }

    if (score.performance < 70) {
      opportunities.push('Focus on performance optimizations for better scores');
    }

    if (score.reliability < 70) {
      opportunities.push('Improve error handling to increase reliability');
    }

    return opportunities;
  }

  /**
   * Calculate user impact metrics
   */
  private calculateUserImpact(score: UXScore, metrics: UXMetrics): UXInsights['userImpact'] {
    // Calculate estimated user satisfaction based on UX score
    const satisfaction = Math.max(SCORE_CALCULATION.MIN_SCORE, Math.min(SCORE_CALCULATION.MAX_SCORE, score.overall + 10));

    // Calculate abandonment risk based on critical issues and poor metrics
    let abandonmentRisk = 0;
    
    if (score.overall < 50) abandonmentRisk += 30;
    if (metrics.lcp > UX_THRESHOLDS.LCP_AVERAGE) abandonmentRisk += 20;
    if (metrics.errorRate > 0.05) abandonmentRisk += 25;
    if (metrics.fid > UX_THRESHOLDS.FID_AVERAGE) abandonmentRisk += 15;
    if (metrics.cls > 0.25) abandonmentRisk += 10;

    abandonmentRisk = Math.max(SCORE_CALCULATION.MIN_SCORE, Math.min(SCORE_CALCULATION.MAX_SCORE, abandonmentRisk));

    // Calculate conversion impact (inverse of abandonment risk)
    const conversionImpact = Math.max(SCORE_CALCULATION.MIN_SCORE, SCORE_CALCULATION.MAX_SCORE - abandonmentRisk);

    return {
      satisfaction,
      abandonmentRisk,
      conversionImpact,
    };
  }

  /**
   * Get performance benchmarks
   */
  getBenchmarks(): Record<string, { good: number; average: number; poor: number }> {
    return {
      LCP: { good: UX_THRESHOLDS.LCP_GOOD, average: UX_THRESHOLDS.LCP_AVERAGE, poor: UX_THRESHOLDS.LCP_POOR },
      FID: { good: UX_THRESHOLDS.FID_GOOD, average: UX_THRESHOLDS.FID_AVERAGE, poor: UX_THRESHOLDS.FID_POOR },
      CLS: { good: 0.1, average: 0.25, poor: 0.5 },
      TTFB: { good: UX_THRESHOLDS.TTFB_GOOD, average: UX_THRESHOLDS.TTFB_AVERAGE, poor: UX_THRESHOLDS.TTFB_POOR },
      'API Response Time': { good: API_RESPONSE_THRESHOLDS.EXCELLENT, average: API_RESPONSE_THRESHOLDS.NEEDS_IMPROVEMENT, poor: API_RESPONSE_THRESHOLDS.POOR },
    };
  }

  /**
   * Compare current metrics with benchmarks
   */
  compareWithBenchmarks(metrics: UXMetrics): Record<string, 'good' | 'average' | 'poor'> {
    const benchmarks = this.getBenchmarks();
    const comparison: Record<string, 'good' | 'average' | 'poor'> = {};

    Object.entries(benchmarks).forEach(([metric, benchmark]) => {
      let value: number;
      
      switch (metric) {
        case 'LCP': value = metrics.lcp; break;
        case 'FID': value = metrics.fid; break;
        case 'CLS': value = metrics.cls; break;
        case 'TTFB': value = metrics.ttfb; break;
        case 'API Response Time': value = metrics.apiResponseTime; break;
        default: return;
      }

      if (value <= benchmark.good) {
        comparison[metric] = 'good';
      } else if (value <= benchmark.average) {
        comparison[metric] = 'average';
      } else {
        comparison[metric] = 'poor';
      }
    });

    return comparison;
  }

  /**
   * Calculate API score helper method
   */
  private calculateAPIScore(apiResponseTime: number): number {
    if (apiResponseTime <= API_RESPONSE_THRESHOLDS.EXCELLENT) return SCORE_CALCULATION.MAX_SCORE;
    if (apiResponseTime <= API_RESPONSE_THRESHOLDS.NEEDS_IMPROVEMENT) {
      const ratio = (apiResponseTime - API_RESPONSE_THRESHOLDS.EXCELLENT) / (API_RESPONSE_THRESHOLDS.NEEDS_IMPROVEMENT - API_RESPONSE_THRESHOLDS.EXCELLENT);
      return Math.round(SCORE_CALCULATION.MAX_SCORE - (ratio * SCORE_CALCULATION.SCORE_RATIO_MULTIPLIER));
    }
    const excess = apiResponseTime - API_RESPONSE_THRESHOLDS.NEEDS_IMPROVEMENT;
    const score = Math.max(SCORE_CALCULATION.MIN_SCORE, 50 - Math.log10(excess + 1) * 10);
    return Math.round(score);
  }

  /**
   * Get score history
   */
  getScoreHistory(): UXScore[] {
    return [...this.scoreHistory];
  }

  /**
   * Clear score history
   */
  clearHistory(): void {
    this.scoreHistory = [];
  }
}