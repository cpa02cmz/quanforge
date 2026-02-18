/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please use the modular UX scoring system instead:
 *
 * ```typescript
 * // Old (deprecated):
 * import { UXPerformanceMonitor } from './services/realTimeUXScoring';
 *
 * // New (recommended):
 * import { RealTimeUXScoring } from './services/ux';
 * import { UXMetricsCollector } from './services/ux/uxMetricsCollector';
 * import { UXScoreCalculator } from './services/ux/uxScoreCalculator';
 * import { UXAnalyzer } from './services/ux/uxAnalyzer';
 * ```
 *
 * The modular version provides:
 * - Better separation of concerns
 * - Smaller bundle sizes (tree-shakeable)
 * - Easier testing and maintenance
 * - Clearer API boundaries
 *
 * Related Issue: #594 - Monolithic Backend Services Violating SRP
 * Migration Guide: See docs/backend-engineer.md
 */

// Re-export from modular version for backward compatibility
export {
  // Main class
  RealTimeUXScoring as UXPerformanceMonitor,
  RealTimeUXScoring,
  // Types
  UXMetrics,
  UXScore,
  UXConfig,
  UXIssue,
} from './ux';

// Re-export modular components for gradual migration
export { UXMetricsCollector } from './ux/uxMetricsCollector';
export { UXScoreCalculator } from './ux/uxScoreCalculator';
export { UXAnalyzer, UXInsights } from './services/ux/uxAnalyzer';
export { UXStatus, UXAlert } from './services/ux/uxTypes';

// Log deprecation warning once
import { createScopedLogger } from '../utils/logger';
const logger = createScopedLogger('RealTimeUXScoring');
logger.warn(
  'DEPRECATION: realTimeUXScoring.ts is deprecated. ' +
  'Please migrate to services/ux/modularUXScoring.ts. ' +
  'See Issue #594 for details.'
);
