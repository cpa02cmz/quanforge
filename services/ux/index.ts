// UX Monitoring Services - Barrel Export
// Modular decomposition of real-time UX performance monitoring

// Types
export type {
  UXMetrics,
  UXScore,
  UXIssue,
  UXConfig,
  MetricThresholds,
  ScoringWeights,
} from './uxTypes';

// Core Components
export { UXMetricsCollector } from './uxMetricsCollector';
export { UXScoreCalculator } from './uxScoreCalculator';
export { UXAnalyzer, UXInsights } from './uxAnalyzer';

// Main Manager & Hook
export {
  RealTimeUXScoring,
  realTimeUXScoring,
  useUXMonitoring,
} from './modularUXScoring';
