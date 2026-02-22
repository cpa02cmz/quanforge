# React Hooks Reference

> Comprehensive documentation for all React hooks in QuanForge AI

**Last Updated**: 2026-02-22  
**Version**: 2.2.0

---

## Table of Contents

1. [Overview](#overview)
2. [Generator Hooks](#generator-hooks)
3. [Performance Hooks](#performance-hooks)
4. [UI/UX Hooks](#uiux-hooks)
5. [Accessibility Hooks](#accessibility-hooks)
6. [Data Management Hooks](#data-management-hooks)
7. [Utility Hooks](#utility-hooks)
8. [Best Practices](#best-practices)

---

## Overview

QuanForge AI provides a comprehensive set of React hooks for various purposes:

- **State Management**: Optimized state updates and memoization
- **Performance**: Component profiling and render optimization
- **Accessibility**: Focus management and screen reader support
- **User Experience**: Animations, haptics, and interactions
- **Data Handling**: Lazy loading, caching, and debouncing

### Import Pattern

```typescript
// Import from hooks index
import { 
  useGeneratorLogic, 
  useStableMemo,
  useFocusVisible 
} from './hooks';

// Or import specific hooks
import { useEnhancedLazyLoad } from './hooks/useEnhancedLazyLoad';
```

---

## Generator Hooks

### useGeneratorLogic

**File**: `hooks/useGeneratorLogic.ts`

Core hook for the strategy generator functionality.

```typescript
import { useGeneratorLogic } from './hooks';

function Generator() {
  const {
    code,
    setCode,
    isLoading,
    generateCode,
    analyzeCode,
    error
  } = useGeneratorLogic();
  
  return (
    // ... component
  );
}
```

**Returns**:
| Property | Type | Description |
|----------|------|-------------|
| `code` | `string` | Current generated code |
| `setCode` | `(code: string) => void` | Update code state |
| `isLoading` | `boolean` | Generation in progress |
| `generateCode` | `(prompt: string) => Promise<void>` | Generate MQL5 code |
| `analyzeCode` | `(code: string) => Promise<Analysis>` | Analyze strategy |
| `error` | `Error \| null` | Current error state |
| `chatHistory` | `ChatMessage[]` | Conversation history |
| `addToChat` | `(message: string) => void` | Add message to chat |

**Features**:
- Automatic code parsing
- Chat history persistence
- Error recovery
- Streaming support

---

## Performance Hooks

### useStableMemo

**File**: `hooks/useStableMemo.ts`

Memoization with deep/shallow equality comparison.

```typescript
import { 
  useStableMemo, 
  useStableCallback,
  useStableObject 
} from './hooks';

// Stable object reference
const config = useStableObject({
  theme: 'dark',
  locale: 'en'
});

// Stable callback
const handler = useStableCallback((event) => {
  // ... handler logic
}, [dependency1, dependency2]);

// Custom equality
const result = useStableMemo(
  () => computeExpensive(data),
  [data],
  { equality: 'deep' }
);
```

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `equality` | `'shallow' \| 'deep'` | `'shallow'` | Comparison method |
| `customEquality` | `(a, b) => boolean` | - | Custom comparison function |

---

### useOptimizedReducer

**File**: `hooks/useOptimizedReducer.ts`

Reducer with batch updates and re-render prevention.

```typescript
import { 
  useOptimizedReducer, 
  useBatchDispatch 
} from './hooks';

const [state, dispatch] = useOptimizedReducer(reducer, initialState);

// Batch multiple updates
useBatchDispatch(dispatch, [
  { type: 'SET_LOADING', payload: true },
  { type: 'SET_DATA', payload: data },
  { type: 'SET_LOADING', payload: false }
]);
```

**Features**:
- Prevents re-renders when state unchanged
- Batches rapid updates (~16ms window)
- Performance monitoring

---

### useComponentPerformance

**File**: `hooks/useComponentPerformance.tsx`

Component performance profiling.

```typescript
import { useComponentPerformance } from './hooks';

function MyComponent() {
  const { 
    renderCount, 
    averageRenderTime,
    slowRenders 
  } = useComponentPerformance('MyComponent');
  
  return (
    <div>
      Renders: {renderCount}
      Avg Time: {averageRenderTime}ms
    </div>
  );
}
```

**Metrics Tracked**:
- Render count
- Average render time
- Slow render detection (>16ms)
- Memory usage

---

### usePerformanceBudget

**File**: `hooks/usePerformanceBudget.ts`

Performance budget monitoring and alerts.

```typescript
import { usePerformanceBudget } from './hooks';

function App() {
  const budget = usePerformanceBudget({
    maxBundleSize: 500000,
    maxRenderTime: 16,
    maxMemoryUsage: 50 * 1024 * 1024
  });
  
  if (budget.exceeded) {
    console.warn('Performance budget exceeded:', budget.violations);
  }
  
  // ...
}
```

---

### useMemoryPressure

**File**: `hooks/useMemoryPressure.ts`

Real-time memory usage monitoring.

```typescript
import { useMemoryPressure } from './hooks';

function MyComponent() {
  const { pressure, usedJSHeapSize, totalJSHeapSize } = useMemoryPressure({
    lowThreshold: 0.5,
    criticalThreshold: 0.9,
    onPressureChange: (level) => {
      if (level === 'critical') {
        // Trigger cleanup
      }
    }
  });
  
  return <div>Memory pressure: {pressure}</div>;
}
```

**Pressure Levels**:
- `low` - Under 50% memory usage
- `moderate` - 50-80% memory usage
- `critical` - Over 80% memory usage

---

### useBatchUpdates

**File**: `hooks/useBatchUpdates.ts`

Batch multiple state updates for performance.

```typescript
import { useBatchUpdates } from './hooks';

function MyComponent() {
  const { batchUpdate, flushBatch, isPending } = useBatchUpdates();
  
  const handleClick = () => {
    batchUpdate(() => {
      setValue1(a);
      setValue2(b);
      setValue3(c);
    });
  };
  
  return (
    <button onClick={handleClick} disabled={isPending}>
      Update All
    </button>
  );
}
```

---

## UI/UX Hooks

### useEnhancedLazyLoad

**File**: `hooks/useEnhancedLazyLoad.ts`

Advanced lazy loading with intersection observer.

```typescript
import { 
  useEnhancedLazyLoad,
  useLazyImageEnhanced 
} from './hooks';

function LazyComponent() {
  const { ref, isLoaded, isVisible } = useEnhancedLazyLoad({
    loadDelay: 100,
    onIntersect: () => console.log('Visible!')
  });
  
  return (
    <div ref={ref}>
      {isLoaded ? <Content /> : <Placeholder />}
    </div>
  );
}

// Image-specific helper
function LazyImage({ src, alt }) {
  const { ref, isLoaded, imageRef } = useLazyImageEnhanced(src, {
    loadDelay: 50
  });
  
  return (
    <div ref={ref}>
      <img ref={imageRef} src={isLoaded ? src : undefined} alt={alt} />
    </div>
  );
}
```

---

### useAnimatedPlaceholder

**File**: `hooks/useAnimatedPlaceholder.ts`

Animated placeholder text for inputs.

```typescript
import { useAnimatedPlaceholder } from './hooks';

function SearchInput() {
  const placeholder = useAnimatedPlaceholder(
    ['Search strategies...', 'Find robots...', 'Filter by type...'],
    { interval: 2000, typeSpeed: 50 }
  );
  
  return <input placeholder={placeholder} />;
}
```

---

### useHapticFeedback

**File**: `hooks/useHapticFeedback.ts`

Haptic feedback support for mobile devices.

```typescript
import { useHapticFeedback } from './hooks';

function Button() {
  const { triggerHaptic, isSupported } = useHapticFeedback();
  
  const handleClick = () => {
    triggerHaptic('medium');
    // ... action
  };
  
  return (
    <button onClick={handleClick}>
      Click me
    </button>
  );
}
```

**Feedback Types**:
- `light` - Light tap
- `medium` - Medium impact
- `heavy` - Strong impact
- `success` - Success notification
- `warning` - Warning notification
- `error` - Error notification

---

### useSwipe

**File**: `hooks/useSwipe.ts`

Touch swipe gesture detection.

```typescript
import { useSwipe } from './hooks';

function SwipeableCard() {
  const { direction, deltaX, deltaY } = useSwipe({
    onSwipeLeft: () => previousCard(),
    onSwipeRight: () => nextCard(),
    threshold: 50
  });
  
  return (
    <div {...bindSwipeHandlers()}>
      Card content
    </div>
  );
}
```

---

### useReducedMotion

**File**: `hooks/useReducedMotion.ts`

Check user's reduced motion preference.

```typescript
import { useReducedMotion } from './hooks';

function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <div 
      style={{
        transition: prefersReducedMotion ? 'none' : 'all 0.3s'
      }}
    >
      Content
    </div>
  );
}
```

---

## Accessibility Hooks

### useFocusVisible

**File**: `hooks/useFocusVisible.ts`

Keyboard focus detection for accessibility.

```typescript
import { useFocusVisible } from './hooks';

function Button() {
  const { ref, isFocusVisible, bindFocusEvents } = useFocusVisible();
  
  return (
    <button 
      ref={ref}
      {...bindFocusEvents()}
      className={isFocusVisible ? 'focus-visible' : ''}
    >
      Click me
    </button>
  );
}
```

---

### useKeyPress

**File**: `hooks/useKeyPress.ts`

Keyboard shortcut and key press detection.

```typescript
import { useKeyPress } from './hooks';

function Modal() {
  const closeModal = useKeyPress('Escape', () => {
    // Close modal
  });
  
  // Or with modifiers
  useKeyPress('s', () => save(), { ctrl: true });
}
```

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ctrl` | `boolean` | `false` | Require Ctrl key |
| `shift` | `boolean` | `false` | Require Shift key |
| `alt` | `boolean` | `false` | Require Alt key |
| `preventDefault` | `boolean` | `true` | Prevent default action |

---

### useIntersectionObserver

**File**: `hooks/useIntersectionObserver.ts`

Intersection Observer API wrapper.

```typescript
import { useIntersectionObserver } from './hooks';

function LazySection() {
  const { ref, isIntersecting, intersectionRatio } = useIntersectionObserver({
    threshold: 0.5,
    rootMargin: '100px'
  });
  
  return (
    <section ref={ref}>
      {isIntersecting ? <Content /> : <Skeleton />}
    </section>
  );
}
```

---

### useModalAccessibility

**File**: `hooks/useModalAccessibility.ts`

Modal focus trapping and accessibility.

```typescript
import { useModalAccessibility } from './hooks';

function Modal({ isOpen, onClose }) {
  const { modalRef, triggerRef, bindKeyDown } = useModalAccessibility({
    isOpen,
    onClose
  });
  
  if (!isOpen) return null;
  
  return (
    <div 
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      {...bindKeyDown()}
    >
      Modal content
    </div>
  );
}
```

---

### useIdleCallback

**File**: `hooks/useIdleCallback.ts`

Schedule work during browser idle periods.

```typescript
import { useIdleCallback } from './hooks';

function MyComponent() {
  useIdleCallback(() => {
    // Preload data during idle time
    prefetchNextPage();
  }, { timeout: 2000 });
  
  // ...
}
```

---

## Data Management Hooks

### useDashboardStats

**File**: `hooks/useDashboardStats.ts`

Dashboard statistics and metrics.

```typescript
import { useDashboardStats } from './hooks';

function Dashboard() {
  const { 
    totalRobots, 
    activeRobots, 
    recentRobots,
    loading 
  } = useDashboardStats();
  
  return (
    <div>
      Total: {totalRobots}
      Active: {activeRobots}
    </div>
  );
}
```

---

### useDebouncedValue

**File**: `hooks/useDebouncedValue.ts`

Debounced value updates for performance.

```typescript
import { useDebouncedValue } from './hooks';

function SearchInput() {
  const [value, setValue] = useState('');
  const [debouncedValue] = useDebouncedValue(value, 300);
  
  useEffect(() => {
    if (debouncedValue) {
      search(debouncedValue);
    }
  }, [debouncedValue]);
  
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}
```

---

### useLazyComponent

**File**: `hooks/useLazyComponent.tsx`

Lazy component loading with loading states.

```typescript
import { useLazyComponent } from './hooks';

const HeavyChart = useLazyComponent(
  () => import('./Chart'),
  { fallback: <ChartSkeleton /> }
);

function Dashboard() {
  return (
    <div>
      <HeavyChart data={chartData} />
    </div>
  );
}
```

---

## Utility Hooks

### useChatFocusManagement

**File**: `hooks/useChatFocusManagement.ts`

Focus management for chat interfaces.

```typescript
import { useChatFocusManagement } from './hooks';

function ChatInterface() {
  const { 
    inputRef, 
    focusInput, 
    isInputFocused 
  } = useChatFocusManagement();
  
  return (
    <div>
      <input ref={inputRef} />
      <button onClick={focusInput}>Focus Input</button>
    </div>
  );
}
```

---

### useToast

**File**: `hooks/useToast.ts`

Toast notification helper.

```typescript
import { useToast } from './hooks';

function MyComponent() {
  const showToast = useToast();
  
  const handleSuccess = () => {
    showToast('Operation successful!', { type: 'success' });
  };
  
  return <button onClick={handleSuccess}>Save</button>;
}
```

---

### useComponentRenderProfiler

**File**: `hooks/useComponentRenderProfiler.ts`

Detailed component render profiling.

```typescript
import { useComponentRenderProfiler } from './hooks';

function MyComponent(props) {
  useComponentRenderProfiler('MyComponent', props);
  
  // Component logic
}
```

---

## Best Practices

### 1. Use Stable Memoization

```typescript
// Good - stable reference
const config = useStableObject({ theme: 'dark' });

// Avoid - new object on every render
const config = { theme: 'dark' };
```

### 2. Batch Updates

```typescript
// Good - batched
useBatchDispatch(dispatch, [
  { type: 'SET_A', payload: a },
  { type: 'SET_B', payload: b }
]);

// Avoid - multiple renders
dispatch({ type: 'SET_A', payload: a });
dispatch({ type: 'SET_B', payload: b });
```

### 3. Respect User Preferences

```typescript
// Good - check reduced motion
const reducedMotion = useReducedMotion();
const animation = reducedMotion ? 'none' : 'fadeIn';

// Avoid - ignore preferences
const animation = 'fadeIn';
```

### 4. Use Lazy Loading

```typescript
// Good - lazy load heavy components
const Chart = useLazyComponent(() => import('./Chart'));

// Avoid - import directly
import { Chart } from './Chart';
```

### 5. Debounce Expensive Operations

```typescript
// Good - debounced search
const [debouncedSearch] = useDebouncedValue(search, 300);

// Avoid - search on every keystroke
useEffect(() => {
  search(query);
}, [query]);
```

---

## Related Documentation

- [API_REFERENCE.md](./API_REFERENCE.md) - Services API documentation
- [SERVICE_ARCHITECTURE.md](./SERVICE_ARCHITECTURE.md) - Architecture overview
- [MEMORY_MANAGEMENT_GUIDE.md](./MEMORY_MANAGEMENT_GUIDE.md) - Performance optimization

---

**Documentation Version**: 1.0.0  
**Author**: Technical Writer Agent  
**Last Updated**: 2026-02-22
