/**
 * UX Score Calculation Module
 * Handles all scoring algorithms and metric evaluation
 */

import { UXMetrics, UXScore, UXIssue, UXConfig, MetricThresholds } from './uxTypes';

export class UXScoreCalculator {
  constructor(private config: UXConfig) {}

  /**
   * Calculate comprehensive UX score
   */
  calculateScore(metrics: UXMetrics): UXScore {
    const performanceScore = this.calculatePerformanceScore(metrics);
    const reliabilityScore = this.calculateReliabilityScore(metrics);
    const engagementScore = this.calculateEngagementScore(metrics);
    
    const overall = Math.round(
      performanceScore * this.config.scoringWeights.performance +
      reliabilityScore * this.config.scoringWeights.reliability +
      engagementScore * this.config.scoringWeights.engagement
    );

    const issues = this.identifyIssues(metrics);
    const recommendations = this.generateRecommendations(issues);

    return {
      overall,
      performance: performanceScore,
      reliability: reliabilityScore,
      engagement: engagementScore,
      lcpScore: this.scoreMetric(metrics.lcp, this.config.thresholds.lcp),
      fidScore: this.scoreMetric(metrics.fid, this.config.thresholds.fid),
      clsScore: this.scoreMetric(metrics.cls, this.config.thresholds.cls),
      ttfbScore: this.scoreMetric(metrics.ttfb, this.config.thresholds.ttfb),
      recommendations,
      issues,
    };
  }

  /**
   * Calculate performance score based on Core Web Vitals
   */
  private calculatePerformanceScore(metrics: UXMetrics): number {
    const lcpScore = this.scoreMetric(metrics.lcp, this.config.thresholds.lcp);
    const fidScore = this.scoreMetric(metrics.fid, this.config.thresholds.fid);
    const clsScore = this.scoreMetric(metrics.cls, this.config.thresholds.cls);
    const ttfbScore = this.scoreMetric(metrics.ttfb, this.config.thresholds.ttfb);
    
    return Math.round((lcpScore + fidScore + clsScore + ttfbScore) / 4);
  }

  /**
   * Calculate reliability score based on error rates
   */
  private calculateReliabilityScore(metrics: UXMetrics): number {
    const errorScore = Math.max(0, 100 - (metrics.errorRate * 100));
    const crashScore = Math.max(0, 100 - (metrics.crashRate * 100));
    const apiScore = this.scoreMetric(metrics.apiResponseTime, { good: 200, needsImprovement: 1000 });
    
    return Math.round((errorScore + crashScore + apiScore) / 3);
  }

  /**
   * Calculate engagement score based on user interaction
   */
  private calculateEngagementScore(metrics: UXMetrics): number {
    const clickScore = this.scoreMetric(metrics.clickDelay, { good: 50, needsImprovement: 200 });
    const scrollScore = Math.min(100, metrics.scrollPerformance * 10);
    const inputScore = this.scoreMetric(metrics.inputLag, { good: 16, needsImprovement: 100 });
    
    return Math.round((clickScore + scrollScore + inputScore) / 3);
  }

  /**
   * Score individual metric based on thresholds
   */
  private scoreMetric(value: number, thresholds: MetricThresholds): number {
    if (value <= thresholds.good) {
      return 100;
    } else if (value <= thresholds.needsImprovement) {
      // Linear interpolation between good and needs improvement
      const ratio = (value - thresholds.good) / (thresholds.needsImprovement - thresholds.good);
      return Math.round(100 - (ratio * 50));
    } else {
      // For values worse than needs improvement, use logarithmic decay
      const excess = value - thresholds.needsImprovement;
      const score = Math.max(0, 50 - Math.log10(excess + 1) * 10);
      return Math.round(score);
    }
  }

  /**
   * Identify UX issues based on metrics
   */
  private identifyIssues(metrics: UXMetrics): UXIssue[] {
    const issues: UXIssue[] = [];

    // LCP Issues
    if (metrics.lcp > this.config.thresholds.lcp.needsImprovement) {
      issues.push({
        type: 'critical',
        metric: 'LCP',
        value: metrics.lcp,
        threshold: this.config.thresholds.lcp.needsImprovement,
        description: 'Largest Contentful Paint is too slow',
        recommendation: 'Optimize server response time, resource loading, and client-side rendering'
      });
    }

    // FID Issues
    if (metrics.fid > this.config.thresholds.fid.needsImprovement) {
      issues.push({
        type: 'critical',
        metric: 'FID',
        value: metrics.fid,
        threshold: this.config.thresholds.fid.needsImprovement,
        description: 'First Input Delay is too high',
        recommendation: 'Reduce JavaScript execution time and break up long tasks'
      });
    }

    // CLS Issues
    if (metrics.cls > this.config.thresholds.cls.needsImprovement) {
      issues.push({
        type: 'critical',
        metric: 'CLS',
        value: metrics.cls,
        threshold: this.config.thresholds.cls.needsImprovement,
        description: 'Cumulative Layout Shift is too high',
        recommendation: 'Ensure proper dimensions for images and embeds, avoid inserting content above existing content'
      });
    }

    // TTFB Issues
    if (metrics.ttfb > this.config.thresholds.ttfb.needsImprovement) {
      issues.push({
        type: 'warning',
        metric: 'TTFB',
        value: metrics.ttfb,
        threshold: this.config.thresholds.ttfb.needsImprovement,
        description: 'Time to First Byte is slow',
        recommendation: 'Improve server response time and CDN configuration'
      });
    }

    // API Response Time Issues
    if (metrics.apiResponseTime > 1000) {
      issues.push({
        type: 'warning',
        metric: 'API Response Time',
        value: metrics.apiResponseTime,
        threshold: 1000,
        description: 'API responses are slow',
        recommendation: 'Optimize database queries, implement caching, and consider edge functions'
      });
    }

    // Error Rate Issues
    if (metrics.errorRate > 0.05) {
      issues.push({
        type: 'critical',
        metric: 'Error Rate',
        value: metrics.errorRate,
        threshold: 0.05,
        description: 'High error rate detected',
        recommendation: 'Improve error handling and fix underlying bugs'
      });
    }

    // Render Time Issues
    if (metrics.renderTime > 100) {
      issues.push({
        type: 'warning',
        metric: 'Render Time',
        value: metrics.renderTime,
        threshold: 100,
        description: 'Render time is slow',
        recommendation: 'Optimize React rendering and reduce component complexity'
      });
    }

    return issues;
  }

  /**
   * Generate recommendations based on identified issues
   */
  private generateRecommendations(issues: UXIssue[]): string[] {
    const recommendations: string[] = [];
    
    // Group issues by type for better recommendations
    const criticalIssues = issues.filter(issue => issue.type === 'critical');
    const warningIssues = issues.filter(issue => issue.type === 'warning');

    if (criticalIssues.length > 0) {
      recommendations.push(`Address ${criticalIssues.length} critical issues immediately for better user experience`);
    }

    if (warningIssues.length > 0) {
      recommendations.push(`Consider fixing ${warningIssues.length} warning issues to improve performance`);
    }

    // Add specific recommendations
    const issueMetrics = [...new Set(issues.map(issue => issue.metric))];
    
    if (issueMetrics.includes('LCP')) {
      recommendations.push('Optimize LCP: Preload critical resources, improve server response time');
    }

    if (issueMetrics.includes('FID')) {
      recommendations.push('Optimize FID: Reduce JavaScript execution time, use code splitting');
    }

    if (issueMetrics.includes('CLS')) {
      recommendations.push('Optimize CLS: Ensure proper image dimensions, avoid layout shifts');
    }

    if (issueMetrics.includes('API Response Time')) {
      recommendations.push('Optimize API: Add caching, use edge functions, optimize database queries');
    }

    return recommendations;
  }

  /**
   * Get health status based on score
   */
  getHealthStatus(score: UXScore): 'excellent' | 'good' | 'needs-improvement' | 'poor' {
    if (score.overall >= 90) return 'excellent';
    if (score.overall >= 70) return 'good';
    if (score.overall >= 50) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get trend analysis based on score history
   */
  analyzeTrend(scores: UXScore[]): 'improving' | 'stable' | 'declining' | 'insufficient-data' {
    if (scores.length < 3) return 'insufficient-data';
    
    const recentScores = scores.slice(-5).map(s => s.overall);
    const average = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    
    const firstHalf = recentScores.slice(0, Math.floor(recentScores.length / 2));
    const secondHalf = recentScores.slice(Math.floor(recentScores.length / 2));
    
    const firstAverage = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAverage = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    const difference = secondAverage - firstAverage;
    
    if (Math.abs(difference) < 2) return 'stable';
    return difference > 0 ? 'improving' : 'declining';
  }
}