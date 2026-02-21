/**
 * Hooks Index
 * Central export point for all custom React hooks
 */

// Performance hooks
export { useComponentPerformance, withPerformance } from './useComponentPerformance';
export type { 
  ComponentPerformanceConfig, 
  ComponentPerformanceResult, 
  RenderMetric 
} from './useComponentPerformance';

export { usePerformanceBudget } from './usePerformanceBudget';
export type {
  PerformanceBudget,
  MetricValue,
  BudgetViolation,
  PerformanceScore,
  PerformanceBudgetConfig,
  PerformanceBudgetState,
} from './usePerformanceBudget';

export { useMemoryPressure } from './useMemoryPressure';

// UI hooks
export { useAnimatedPlaceholder } from './useAnimatedPlaceholder';
export { useChatFocusManagement } from './useChatFocusManagement';
export { useHapticFeedback } from './useHapticFeedback';
export { useModalAccessibility } from './useModalAccessibility';
export { useReducedMotion } from './useReducedMotion';
export { useToast } from './useToast';

// Business logic hooks
export { useDashboardStats } from './useDashboardStats';
export { useGeneratorLogic } from './useGeneratorLogic';
