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

// Batch update hooks
export { useBatchUpdates, useBatchedState, useDebouncedState } from './useBatchUpdates';

// Component render profiling
export { 
  useComponentRenderProfiler, 
  usePerformanceMeasure, 
  useMountProfiler 
} from './useComponentRenderProfiler';

// Value transformation hooks
export { useDebouncedValue, useDebouncedCallback, useThrottledValue } from './useDebouncedValue';
export type { DebounceOptions, DebouncedValueState } from './useDebouncedValue';

// Stable reference hooks (performance optimization)
export { 
  useStableMemo, 
  useStableCallback, 
  useStableObject, 
  useStableArray,
  useCombineProps 
} from './useStableMemo';
export type { StableMemoOptions } from './useStableMemo';

// Optimized reducer hooks (performance optimization)
export { 
  useOptimizedReducer, 
  useBatchDispatch, 
  useDebouncedDispatch 
} from './useOptimizedReducer';
export type { 
  OptimizedAction, 
  OptimizedReducerOptions 
} from './useOptimizedReducer';

// DOM hooks
export { 
  useIntersectionObserver, 
  useIsVisible, 
  useScrollProgress, 
  useLazyLoad 
} from './useIntersectionObserver';
export type { 
  IntersectionObserverOptions, 
  IntersectionObserverResult 
} from './useIntersectionObserver';

// Keyboard hooks
export { 
  useKeyPress, 
  useKeyboardShortcut, 
  useKeySequence, 
  usePressedKeys 
} from './useKeyPress';
export type { 
  KeyPressOptions, 
  ShortcutOptions, 
  KeySequenceOptions, 
  ModifierKey 
} from './useKeyPress';

// UI hooks
export { useAnimatedPlaceholder } from './useAnimatedPlaceholder';
export { useChatFocusManagement } from './useChatFocusManagement';
export { useHapticFeedback } from './useHapticFeedback';
export { useModalAccessibility } from './useModalAccessibility';
export { useReducedMotion } from './useReducedMotion';
export { useToast } from './useToast';

// Focus management hooks
export { 
  useFocusVisible, 
  useFocusWithin, 
  useFocusTrap, 
  useAutoFocus 
} from './useFocusVisible';
export type { 
  FocusVisibleOptions, 
  FocusVisibleResult, 
  InputModality 
} from './useFocusVisible';

// Business logic hooks
export { useDashboardStats } from './useDashboardStats';
export { useGeneratorLogic } from './useGeneratorLogic';

// Enhanced lazy loading hooks
export { 
  useEnhancedLazyLoad, 
  useLazyImageEnhanced, 
  useLazyComponentEnhanced 
} from './useEnhancedLazyLoad';
export type { 
  UseEnhancedLazyLoadOptions,
  UseLazyLoadReturn 
} from './useEnhancedLazyLoad';
