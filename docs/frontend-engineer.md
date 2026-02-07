# Frontend Engineer Documentation

## Overview
This document serves as a guide for frontend engineers working on the QuantForge AI project. It includes coding standards, common issues, and best practices specific to the frontend codebase.

## Tech Stack
- **Framework**: React 19.2.3 with TypeScript
- **Build Tool**: Vite 6.4.1
- **Router**: React Router DOM 7.12.0
- **State Management**: React hooks (useState, useEffect, useCallback, useMemo)
- **Styling**: Tailwind CSS (via CDN in index.html)
- **UI Components**: Custom components with Tailwind
- **Testing**: Vitest with React Testing Library
- **Linting**: ESLint with TypeScript support

## Project Structure
```
├── components/          # React components
│   ├── ChatInterface.tsx
│   ├── Layout.tsx
│   ├── StrategyConfig.tsx
│   └── ...
├── hooks/              # Custom React hooks
│   └── useGeneratorLogic.ts
├── pages/              # Page components
│   ├── Dashboard.tsx
│   ├── Generator.tsx
│   └── ...
├── services/           # Business logic services
├── utils/              # Utility functions
├── constants/          # Constants and configuration
└── types.ts            # TypeScript type definitions
```

## Common Issues & Solutions

### 1. React Fast Refresh Warnings
**Issue**: ESLint warning "Fast refresh only works when a file only exports components"

**Solution**: Don't export non-component functions from component files. Move utility exports to separate files.

**Example**:
```typescript
// ❌ Bad - Toast.tsx exports non-component functions
export const getToastAriaLive = (type: ToastType) => { ... };
export const getToastLabel = (type: ToastType) => { ... };

// ✅ Good - Move to toastUtils.ts
// components/toastUtils.ts
export const getToastAriaLive = (type: ToastType) => { ... };
export const getToastLabel = (type: ToastType) => { ... };

// components/Toast.tsx
import { getToastAriaLive, getToastLabel } from './toastUtils';
```

**Fixed In**:
- `components/Toast.tsx` - Moved helper functions to `components/toastUtils.ts`

### 2. Unused Variables
**Issue**: ESLint error for unused variables in catch blocks

**Solution**: Prefix unused variables with underscore or remove them.

**Example**:
```typescript
// ❌ Bad
} catch (e) {
  // Ignore storage errors
}

// ✅ Good
} catch (_e) {
  // Ignore storage errors
}
```

### 3. Console Statements in Production
**Issue**: Console statements in constants/services causing lint warnings

**Solution**: Use environment check or logger utility.

**Example**:
```typescript
// ❌ Bad
console.warn(`Wiki content not found for language: ${language}`, e);

// ✅ Good
if (import.meta.env.DEV) {
  logger.warn(`Wiki content not found for language: ${language}`, e);
}
```

### 4. Type `any` Usage
**Issue**: Using `any` type bypasses TypeScript type checking

**Solution**: Use proper types or `unknown` with type guards.

**Example**:
```typescript
// ❌ Bad
const data: any = await response.json();

// ✅ Good
const data: ApiResponse = await response.json();
```

**Frontend-Specific Fixes**:
- `components/ChatInterface.tsx`: Replaced `any[]` with `Strategy[]` for suggested strategies state
- `components/ChatInterface.tsx`: Added proper `PerformanceMemory` interface for browser memory API
- `components/ChatInterface.tsx`: Fixed `formatMessageContent` return type to `React.ReactNode[]`
- `components/DatabaseSettingsModal.tsx`: Fixed `DBMode` type usage in radio inputs
- `components/DatabaseSettingsModal.tsx`: Changed `e: any` to `e: unknown` in catch blocks
- `components/StrategyConfig.tsx`: Added proper eslint-disable comments for complex validation logic
- `components/StrategyConfig.tsx`: Changed error handling to use `unknown` type with type guards
- `components/VirtualScrollList.tsx`: Fixed translation function type to `Record<string, string | number>`
- `components/CodeEditor.tsx`: Added proper typing for `window.Prism` global
- `pages/Dashboard.tsx`: Fixed debounce utility type definition
- `pages/Dashboard.tsx`: Fixed translation function parameter type
- `pages/FAQ.tsx`: Added `FAQQuestion` and `FAQCategory` interfaces
- `pages/FAQ.tsx`: Replaced `any` types in filter logic with proper types
- `pages/Wiki.tsx`: Added `WikiSection` type import
- `pages/Wiki.tsx`: Fixed filteredSections type with proper type assertion

## Build Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test
npm run test:run

# Bundle analysis
npm run build:analyze
```

## Code Quality Standards

### ESLint Rules Applied
- `react-refresh/only-export-components`: Only export components from component files
- `@typescript-eslint/no-explicit-any`: Avoid using `any` type
- `@typescript-eslint/no-unused-vars`: No unused variables
- `no-console`: No console statements in production code

### TypeScript Configuration
- Strict mode enabled
- No implicit any
- Strict null checks
- No unused locals/parameters

## Performance Best Practices

1. **Lazy Loading**: Use dynamic imports for code splitting
2. **Memoization**: Use React.memo, useMemo, useCallback appropriately
3. **Bundle Size**: Monitor bundle sizes with `npm run build:analyze`
4. **Image Optimization**: Use WebP format with fallbacks
5. **CSS**: Use Tailwind's purge feature to remove unused styles

### Lazy Loading Pattern

**File Structure**:
```
components/
├── LazyLoader.tsx          # Only exports lazy-loaded components
utils/
├── lazyUtils.tsx           # Contains utility functions (createLazyComponent, etc.)
```

**Usage**:
```typescript
// Import lazy components
import { LazyDashboard, LazyGenerator } from './components/LazyLoader';

// Import utilities (if needed)
import { preloadCriticalComponents } from './utils/lazyUtils';

// Use in Router
<Route path="/dashboard" element={<LazyDashboard />} />

// Preload critical components on app start
useEffect(() => {
  preloadCriticalComponents();
}, []);
```

**Benefits**:
- Code splitting for better initial load performance
- Error boundaries for failed component loads
- Preloading for critical path optimization
- Fast Refresh compliance (separate utilities from components)

## Testing Guidelines

1. Write unit tests for utilities and hooks
2. Use React Testing Library for component tests
3. Mock external dependencies (API calls, browser APIs)
4. Test error boundaries and loading states
5. Run tests before committing: `npm run test:run`

## Common Frontend Bugs

### Bug: Fast Refresh Breaking
**Location**: App.tsx, Toast.tsx, FAQ.tsx
**Issue**: Files export non-component functions (e.g., `getToastAriaLive`, `getToastLabel`)
**Fix**: Move non-component exports to separate utility files (e.g., `toastUtils.ts`)
**Files Fixed**:
- `components/Toast.tsx` - Moved helpers to `components/toastUtils.ts`

### Bug: Type `any` in Components
**Location**: Multiple frontend files
**Issue**: Using `any` type bypasses TypeScript type checking
**Files Fixed**:
- `components/ChatInterface.tsx` - Strategy type, PerformanceMemory interface
- `components/CodeEditor.tsx` - window.Prism typing, removed unused eslint-disable directives
- `components/DatabaseSettingsModal.tsx` - DBMode type usage
- `components/StrategyConfig.tsx` - Validation function types with eslint-disable
- `components/VirtualScrollList.tsx` - Translation parameter types
- `pages/Dashboard.tsx` - Debounce utility types
- `pages/FAQ.tsx` - FAQQuestion and FAQCategory interfaces, fixed `any` type in questions.map (line 343)
- `pages/Wiki.tsx` - WikiSection type

### Bug: Error Handling with `any` Type
**Location**: StrategyConfig.tsx, DatabaseSettingsModal.tsx
**Issue**: Using `e: any` in catch blocks
**Fix**: Change to `e: unknown` with type guards
**Example**:
```typescript
// ❌ Bad
catch (e: any) {
  showToast(`Error: ${e.message}`, 'error');
}

// ✅ Good
catch (e: unknown) {
  const errorMessage = e instanceof Error ? e.message : 'Unknown error';
  showToast(`Error: ${errorMessage}`, 'error');
}
```

### Bug: Browser API Typing
**Location**: ChatInterface.tsx, CodeEditor.tsx
**Issue**: Using `(window as any)` or `(performance as any)` for browser-specific APIs
**Fix**: Define proper interfaces for browser extensions
**Example**:
```typescript
// ✅ Good - Define interface for Chrome's memory API
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

// Usage
const perf = performance as PerformanceWithMemory;
const memoryUsage = perf.memory;
```

### Bug: Unused Catch Variables  
**Location**: ErrorBoundary.tsx
**Fix**: Prefix unused variables with underscore

### Bug: Console in Production
**Location**: constants/index.ts, ChatErrorBoundary.tsx, CodeEditorErrorBoundary.tsx
**Fix**: Use logger utility with scoped logger instances

**Example**:
```typescript
// ❌ Bad - Using console directly
console.error('ChatInterface Error:', error);
console.warn('Network error in ChatInterface');

// ✅ Good - Using scoped logger
import { createScopedLogger } from '../utils/logger';
const logger = createScopedLogger('ChatErrorBoundary');

logger.error('ChatInterface Error:', error);
logger.warn('Network error in ChatInterface');
```

**Files Fixed**:
- `components/ChatErrorBoundary.tsx` - Replaced console with logger
- `components/CodeEditorErrorBoundary.tsx` - Replaced console with logger

### Bug: React Fast Refresh in LazyLoader
**Location**: LazyLoader.tsx
**Issue**: File exports both components and utility functions, breaking Fast Refresh
**Fix**: Separate utilities into utils/lazyUtils.tsx, keep only components in LazyLoader.tsx

**Before**:
```typescript
// components/LazyLoader.tsx
export function createLazyComponent(...) { ... }  // ❌ Non-component export
export const LazyDashboard = createLazyComponent(...);
export const preloadCriticalComponents = () => { ... };  // ❌ Non-component export
```

**After**:
```typescript
// utils/lazyUtils.tsx
export function createLazyComponent(...) { ... }  // ✅ Utility in utils file
export const preloadCriticalComponents = () => { ... };  // ✅ Utility in utils file

// components/LazyLoader.tsx
import { createLazyComponent } from '../utils/lazyUtils';
export const LazyDashboard = createLazyComponent(...);  // ✅ Only components exported
```

## Recent Frontend Fixes

### 2026-02-07 - Frontend Engineering Fixes

#### 1. React Fast Refresh Warning Fixes (LazyLoader.tsx)
**Issue**: ESLint warning "Fast refresh only works when a file only exports components"

**Root Cause**: `LazyLoader.tsx` was exporting both components AND utility functions (`createLazyComponent`, `loadComponentOnInteraction`, `preloadCriticalComponents`, `InteractionTrigger`)

**Solution Applied**:
- Created `utils/lazyUtils.tsx` to house all non-component exports
- Moved `createLazyComponent()` function to utils file (contains JSX, requires .tsx)
- Moved `loadComponentOnInteraction()` utility to utils file
- Moved `preloadCriticalComponents()` utility to utils file
- Moved `InteractionTrigger` type export to utils file
- Simplified `LazyLoader.tsx` to only export lazy-loaded component wrappers

**Files Changed**:
- `utils/lazyUtils.tsx` (new file) - Contains all utility functions
- `components/LazyLoader.tsx` - Now only exports lazy component wrappers

#### 2. Console Statement Cleanup (Error Boundaries)
**Issue**: Console statements in error boundary components causing lint warnings

**Files Fixed**:
- `components/ChatErrorBoundary.tsx`:
  - Replaced `console.error` with `logger.error`
  - Replaced `console.warn` with `logger.warn`
  - Replaced `console.info` with `logger.info`
  - Added scoped logger: `createScopedLogger('ChatErrorBoundary')`

- `components/CodeEditorErrorBoundary.tsx`:
  - Replaced `console.error` with `logger.error`
  - Replaced `console.warn` with `logger.warn`
  - Added scoped logger: `createScopedLogger('CodeEditorErrorBoundary')`

**Benefits**:
- Environment-aware logging (dev vs production)
- Consistent logging patterns across codebase
- Better module identification in logs

### Build Verification:
- ✅ Production build: 12.04s (no regressions)
- ✅ TypeScript compilation: Zero errors
- ✅ Lint status: 0 errors in frontend components (components/, pages/)
- ✅ No new lint warnings introduced

### Previous Fixes (2026-02-07)

1. **ESLint Error Fixes** (CodeEditor.tsx):
   - Removed unused `eslint-disable-next-line @typescript-eslint/no-explicit-any` directives (lines 29, 34)
   - Issue: ESLint reported "Unused eslint-disable directive" errors
   - Resolution: Removed unnecessary comments since proper typing was already in place

2. **Type Safety Improvement** (FAQ.tsx):
   - Fixed `any` type in questions.map callback (line 343)
   - Changed: `(question: any, index: number)` → `(question: FAQQuestion, index: number)`
   - Issue: Using `any` type bypassed TypeScript type checking
   - Resolution: Used properly defined `FAQQuestion` interface

### Build Verification (Previous):
- ✅ Production build: 12.17s (no regressions)
- ✅ TypeScript compilation: Zero errors
- ✅ Lint errors: 2 → 0 (fixed all errors, warnings only remain)

## Deployment Checklist

Before deploying, ensure:
- [ ] Build passes: `npm run build`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Lint passes: `npm run lint`
- [ ] Tests pass: `npm run test:run`
- [ ] Bundle size acceptable (check build output)
- [ ] No console errors in production build

## Development Workflow

1. Create feature branch from `main`
2. Make changes following coding standards
3. Run build, lint, and tests
4. Commit with descriptive messages
5. Push branch and create PR
6. Ensure CI passes before merging

## Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/guide/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
