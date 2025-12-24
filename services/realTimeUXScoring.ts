/**
 * Backward Compatibility Shim for Real-time UX Scoring
 * Maintains the original API while using the new modular implementation
 */

import { UXMetrics, UXScore, UXConfig, UXIssue } from './ux/uxTypes';
import { realTimeUXScoring as modularUXScoring } from './ux/modularUXScoring';

// Export the original interface for backward compatibility
export type { UXMetrics, UXScore, UXConfig, UXIssue };

/**
 * Legacy UX Performance Monitor Interface
 * Maintains compatibility with existing code
 */
class LegacyUXPerformanceMonitor {
  private initialized = false;

  constructor(config: Partial<UXConfig> = {}) {
    // Initialize the modular instance with the provided config
    const modularInstance = modularUXScoring;
    if (config && Object.keys(config).length > 0) {
      modularInstance.updateConfig(config);
    }
    this.initialized = true;
  }

  /**
   * Start monitoring (backward compatibility)
   */
  startMonitoring(): void {
    modularUXScoring.startMonitoring();
  }

  /**
   * Stop monitoring (backward compatibility)
   */
  stopMonitoring(): void {
    modularUXScoring.stopMonitoring();
  }

  /**
   * Calculate UX score (backward compatibility)
   */
  calculateUXScore(): UXScore {
    return modularUXScoring.calculateUXScore();
  }

  /**
   * Get current metrics (backward compatibility)
   */
  getMetrics(): UXMetrics {
    return modularUXScoring.getMetrics();
  }

  /**
   * Update configuration (backward compatibility)
   */
  updateConfig(newConfig: Partial<UXConfig>): void {
    modularUXScoring.updateConfig(newConfig);
  }

  /**
   * Get current configuration (backward compatibility)
   */
  getConfig(): UXConfig {
    return modularUXScoring.getConfig();
  }

  /**
   * Get health status (backward compatibility)
   */
  getHealthStatus(score: number): 'excellent' | 'good' | 'needs-improvement' | 'poor' {
    return modularUXScoring.getHealthStatus(score);
  }

  /**
   * Force assessment (backward compatibility)
   */
  forceAssessment(): UXScore {
    return modularUXScoring.forceAssessment();
  }

  /**
   * Check if monitoring is active (backward compatibility)
   */
  isActive(): boolean {
    return modularUXScoring.isActive();
  }

  /**
   * Reset metrics (backward compatibility)
   */
  reset(): void {
    modularUXScoring.reset();
  }

  /**
   * Destroy monitor (backward compatibility)
   */
  destroy(): void {
    modularUXScoring.destroy();
    this.initialized = false;
  }

  // Additional methods available in the modular version

  /**
   * Get comprehensive UX insights
   */
  getUXInsights(): import('./ux/uxAnalyzer').UXInsights {
    return modularUXScoring.getUXInsights();
  }

  /**
   * Get performance benchmarks
   */
  getBenchmarks(): Record<string, { good: number; average: number; poor: number }> {
    return modularUXScoring.getBenchmarks();
  }

  /**
   * Compare with benchmarks
   */
  compareWithBenchmarks(): Record<string, 'good' | 'average' | 'poor'> {
    return modularUXScoring.compareWithBenchmarks();
  }

  /**
   * Get score history
   */
  getScoreHistory(): UXScore[] {
    return modularUXScoring.getScoreHistory();
  }

  /**
   * Get detailed report
   */
  getDetailedReport(): {
    currentScore: UXScore;
    insights: import('./ux/uxAnalyzer').UXInsights;
    metrics: UXMetrics;
    benchmarks: Record<string, 'good' | 'average' | 'poor'>;
    recommendations: string[];
  } {
    return modularUXScoring.getDetailedReport();
  }
}

// Create and export singleton instance with the original name
const legacyInstance = new LegacyUXPerformanceMonitor();

// Export the singleton with the original class name for backward compatibility
export const uxPerformanceMonitor = legacyInstance;

// Export the class for testing purposes
export { LegacyUXPerformanceMonitor as UXPerformanceMonitor };

// Export React hook with original name
export function useRealTimeUXScoring(config?: Partial<UXConfig>) {
  const hook = require('./ux/modularUXScoring').useUXMonitoring;
  return hook(config);
}

// Default export for backward compatibility
export default legacyInstance;