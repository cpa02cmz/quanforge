/**
 * Types for UX Performance Monitoring System
 */

export interface UXMetrics {
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

export interface UXScore {
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

export interface UXIssue {
  type: 'critical' | 'warning' | 'info';
  metric: string;
  value: number;
  threshold: number;
  description: string;
  recommendation: string;
}

export interface UXConfig {
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

export interface MetricThresholds {
  good: number;
  needsImprovement: number;
}

export interface ScoringWeights {
  performance: number;
  reliability: number;
  engagement: number;
}