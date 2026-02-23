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

// Visual feedback hooks (UI/UX enhancement)
export { useVisualFeedback, useButtonFeedback } from './useVisualFeedback';
export type {
  FeedbackState,
  VisualFeedbackOptions,
  VisualFeedbackResult,
} from './useVisualFeedback';

// Interactive states hooks (UI/UX enhancement)
export {
  useInteractiveStates,
  useHover,
  usePress,
} from './useInteractiveStates';
export type {
  InteractiveState,
  InteractiveStatesOptions,
  InteractiveStatesResult,
} from './useInteractiveStates';

// Screen reader announcement hooks (UI/UX enhancement)
export {
  useAnnounce,
  useAnnounceOnce,
  useAnnounceValue,
  useAnnounceError,
} from './useAnnounce';
export type {
  AnnouncementPriority,
  AnnouncementOptions,
  AnnounceResult,
} from './useAnnounce';

// Motion preferences hooks (UI/UX enhancement)
export {
  MotionPreferencesProvider,
  useMotionPreferences,
  useAnimation,
  useReducedMotionEnhanced,
} from './useMotionPreferences';
export type {
  MotionLevel,
  AnimationType,
  MotionSettings,
  MotionPreferences,
  MotionPreferencesContextValue,
} from './useMotionPreferences';

// Scroll-triggered animation hooks (UI/UX enhancement)
export {
  useScrollTriggeredAnimation,
  useStaggeredScrollAnimation,
  ScrollAnimationContainer,
} from './useScrollTriggeredAnimation';
export type {
  ScrollAnimationEffect,
  ScrollAnimationState,
  ScrollAnimationOptions,
  ScrollAnimationResult,
  ScrollAnimationContainerProps,
} from './useScrollTriggeredAnimation';

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

// Media query hooks (UI/UX enhancement)
export { 
  useMediaQuery, 
  useMinWidth, 
  useMaxWidth, 
  useBreakpointRange, 
  useBreakpoint,
  usePrefersHighContrast,
  usePrefersReducedData,
  useHoverCapability,
  usePointerCapability,
  useOrientation,
  useHDRSupport,
  useMediaQueries,
  BREAKPOINTS,
} from './useMediaQuery';
export type { 
  MediaQueryOptions, 
  MediaQueryResult,
  Breakpoint,
} from './useMediaQuery';

// Window size hooks (UI/UX enhancement)
export { 
  useWindowSize, 
  useWindowWidth, 
  useWindowHeight,
  useIsAboveWidth,
  useIsBelowWidth,
  useAspectRatio,
  useWindowSizeThrottled,
} from './useWindowSize';
export type { 
  WindowSize, 
  WindowSizeOptions, 
  WindowSizeResult 
} from './useWindowSize';

// Scroll position hooks (UI/UX enhancement)
export { 
  useScrollPosition, 
  useScrollY, 
  useScrollProgress as useScrollProgressDetailed,
  useScrollDirection,
  useHasScrolled,
  useElementInView,
  useScrollToTop,
  useLockBodyScroll,
} from './useScrollPosition';
export type { 
  ScrollPosition, 
  ScrollDirection, 
  ScrollPositionOptions, 
  ScrollPositionResult 
} from './useScrollPosition';

// Copy to clipboard hooks (UI/UX enhancement)
export { 
  useCopyToClipboard, 
  useClipboardHistory, 
  useCopyFormatted,
} from './useCopyToClipboard';
export type { 
  CopyToClipboardOptions, 
  CopyToClipboardResult 
} from './useCopyToClipboard';

// Click outside hooks (UI/UX enhancement)
export { 
  useClickOutside, 
  useEscapeKey, 
  useDropdown,
  useLongPress,
} from './useClickOutside';
export type { ClickOutsideOptions } from './useClickOutside';

// Element size hooks (UI/UX enhancement)
export { 
  useElementSize, 
  useElementWidth, 
  useElementHeight,
  useElementOverflow,
  useElementViewportPosition,
} from './useElementSize';
export type { 
  ElementSize, 
  ElementSizeOptions, 
  ElementSizeResult 
} from './useElementSize';

// Color scheme hooks (UI/UX enhancement)
export { 
  usePrefersColorScheme, 
  useColorSchemeWithOverride,
  usePrefersHighContrast as usePrefersHighContrastHook,
  usePrefersReducedTransparency,
  useAccessibilityPreferences,
} from './usePrefersColorScheme';
export type { 
  ColorScheme, 
  ColorSchemeOptions, 
  ColorSchemeResult 
} from './usePrefersColorScheme';

// Deferred value hooks (performance optimization)
export { 
  useDeferredValue, 
  useDeferredSearch, 
  useDeferredList 
} from './useDeferredValue';
export type { 
  DeferredValueOptions, 
  DeferredValueResult 
} from './useDeferredValue';

// Idle task scheduling hooks (performance optimization)
export { 
  useIdleTask, 
  useIdleAnalytics, 
  useIdlePrefetch 
} from './useIdleTask';
export type { 
  IdleTask, 
  IdleTaskResult,
  TaskPriority 
} from './useIdleTask';

// Swipe gesture hooks (UI/UX enhancement)
export { useSwipeGesture } from './useSwipeGesture';
export type { 
  SwipeGestureOptions, 
  SwipeGestureState, 
  SwipeGestureHandlers 
} from './useSwipeGesture';

// Idle callback hooks (performance optimization)
export {
  useIdleCallback,
  useIdleCallbackEffect,
  useIdleProcessor,
} from './useIdleCallback';

// Online status hooks (network connectivity)
export {
  useOnlineStatus,
  useIsOnline,
  useIsOffline,
} from './useOnlineStatus';
export type {
  OnlineStatusState,
  OnlineStatusOptions,
} from './useOnlineStatus';

// Previous value hooks (change detection)
export {
  usePrevious,
  usePreviousWithEquals,
  useValueHistory,
  useChangeDetector,
  useTransition,
} from './usePrevious';

// Toggle hooks (boolean state management)
export {
  useToggle,
  useToggleState,
  useToggles,
  useToggleWithTimeout,
} from './useToggle';
export type { ToggleState } from './useToggle';

// Local storage hooks (persistent state)
export {
  useLocalStorage,
  useLocalStorageState,
  useMultipleLocalStorage,
} from './useLocalStorage';
export type {
  UseLocalStorageOptions,
  UseLocalStorageReturn,
} from './useLocalStorage';

// Form validation hooks (frontend engineering)
export {
  useFormValidation,
  required,
  minLength,
  maxLength,
  email,
  pattern,
  range,
  custom,
} from './useFormValidation';
export type {
  ValidationRule,
  FieldConfig,
  FieldState,
  FormState,
  FormOptions,
} from './useFormValidation';

// Async operation hooks (frontend engineering)
export {
  useAsyncOperation,
  useAsyncOperations,
  usePolling,
} from './useAsyncOperation';
export type {
  AsyncState,
  AsyncOptions,
  AsyncOperation,
} from './useAsyncOperation';

// Container query hooks (responsive design)
export {
  useContainerQuery,
  useContainerWidth,
  useResponsiveColumns,
  useContainerOrientation,
} from './useContainerQuery';
export type {
  ContainerSize,
  ContainerBreakpoint,
  ContainerBreakpoints,
  ContainerQueryOptions,
  ContainerQueryResult,
} from './useContainerQuery';
