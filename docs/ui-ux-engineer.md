# UI/UX Engineer Guide - QuantForge AI

## Overview

This document provides comprehensive guidelines for UI/UX Engineers working on the QuantForge AI project. It covers accessibility standards, component design patterns, mobile responsiveness, and best practices for creating an inclusive and performant user interface.

**Document Status**: Active
**Last Updated**: 2026-02-07
**Maintainer**: UI/UX Engineering Team

---

## Table of Contents

1. [Accessibility Standards (WCAG 2.1 AA)](#accessibility-standards-wcag-21-aa)
2. [Component Design Patterns](#component-design-patterns)
3. [Mobile Responsiveness](#mobile-responsiveness)
4. [Keyboard Navigation](#keyboard-navigation)
5. [Screen Reader Support](#screen-reader-support)
6. [Form Accessibility](#form-accessibility)
7. [Toast & Notification Accessibility](#toast--notification-accessibility)
8. [Chart Accessibility](#chart-accessibility)
9. [Performance Considerations](#performance-considerations)
10. [Common UI/UX Issues & Fixes](#common-uiux-issues--fixes)
11. [Tools & Resources](#tools--resources)

---

## Accessibility Standards (WCAG 2.1 AA)

### Compliance Checklist

Our application targets **WCAG 2.1 AA** compliance. All UI components must meet these criteria:

- ✅ **Perceivable**: Information must be presentable in ways users can perceive
- ✅ **Operable**: Interface components must be operable by all users
- ✅ **Understandable**: Information and operation must be understandable
- ✅ **Robust**: Content must work with current and future assistive technologies

### Key Requirements

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Color Contrast | Minimum 4.5:1 for normal text, 3:1 for large text | ✅ |
| Keyboard Navigation | All interactive elements accessible via keyboard | ✅ |
| Focus Indicators | Visible focus rings (2px solid #22c55e) | ✅ |
| Screen Reader Support | ARIA labels, roles, and live regions | ✅ |
| Touch Targets | Minimum 44x44px for interactive elements | ✅ |
| Text Resize | Support 200% zoom without loss of content | ✅ |

---

## Component Design Patterns

### Reusable Components

#### 1. FormField Component

**Location**: `components/FormField.tsx`

**Purpose**: Provides consistent, accessible form field rendering with built-in ARIA support.

**Features**:
- Automatic label association (`htmlFor` + `id`)
- Error announcements with `aria-live="assertive"`
- Helper text support
- Required field indicators
- Touch-friendly sizing

**Usage Example**:
```tsx
import { FormField } from './components/FormField';

<FormField
  label="Strategy Name"
  htmlFor="strategy-name"
  required
  error={errors.name}
  helperText="Enter a unique name for your strategy"
>
  <input
    id="strategy-name"
    type="text"
    value={name}
    onChange={handleChange}
    aria-describedby={errors.name ? 'strategy-name-error' : 'strategy-name-helper'}
  />
</FormField>
```

#### 2. CustomInputRow Component

**Location**: `components/CustomInputRow.tsx`

**Purpose**: Manages custom input rows with enhanced keyboard navigation.

**Features**:
- Arrow key navigation between rows
- Delete/Backspace to remove rows
- Full ARIA labeling
- Touch-friendly controls

**Keyboard Shortcuts**:
- `↑` / `↓` - Navigate between rows
- `Delete` / `Backspace` - Remove current row (when empty)
- `Tab` - Move to next field

#### 3. Announcer Utility

**Location**: `utils/announcer.ts`

**Purpose**: Screen reader announcement system for dynamic content.

**API**:
```typescript
import { announceToScreenReader, announceFormValidation, announceFormSuccess } from '../utils/announcer';

// General announcement
announceToScreenReader('Loading complete', 'polite');

// Form validation errors
announceFormValidation(['Name is required', 'Invalid email format']);

// Success messages
announceFormSuccess('Strategy saved successfully');
```

#### 4. KeyboardShortcutsModal

**Location**: `components/KeyboardShortcutsModal.tsx`

**Purpose**: Platform-aware keyboard shortcuts documentation (Mac/Windows/Linux).

**Features**:
- Dynamic platform detection
- Visual key representations
- Proper ARIA dialog attributes
- Accessible via `?` key or settings menu

---

## Mobile Responsiveness

### Breakpoints

```css
/* Mobile First Approach */
sm: 640px   /* Small devices */
md: 768px   /* Tablets */
lg: 1024px  /* Small laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large screens */
```

### Mobile-Specific Features

#### 1. Mobile Menu

**Implementation**: `components/Layout.tsx`

**Features**:
- Slide-out sidebar on mobile
- Body scroll lock when open
- Backdrop overlay with blur
- Touch-friendly close button (44x44px)
- ARIA attributes: `aria-expanded`, `aria-controls`

```tsx
// Body scroll lock effect
useEffect(() => {
  if (isMobileMenuOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
  
  return () => {
    document.body.style.overflow = '';
  };
}, [isMobileMenuOpen]);
```

#### 2. Mobile Tab Navigation

**Implementation**: `pages/Generator.tsx`

**Features**:
- Tab-based interface for mobile screens
- Swipe gestures (future enhancement)
- Bottom navigation bar
- Proper ARIA tab roles

#### 3. Touch Targets

All interactive elements must meet minimum touch target size:

```css
/* Minimum touch target */
.min-touch-target {
  min-width: 44px;
  min-height: 44px;
}
```

**Components Updated**:
- Navigation buttons
- Form inputs
- Action buttons
- Icon buttons (with padding)

---

## Keyboard Navigation

### Global Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `?` | Open keyboard shortcuts help | Global |
| `Esc` | Close modal/dropdown/toast | Global |
| `Tab` | Move to next focusable element | Global |
| `Shift+Tab` | Move to previous focusable element | Global |
| `Enter` / `Space` | Activate focused element | Global |
| `Ctrl/Cmd + K` | Open search (future) | Global |

### Focus Management

#### 1. Global Focus Indicators

**Location**: `index.html`

```css
/* Focus visible for keyboard users only */
:focus-visible {
  outline: 2px solid #22c55e;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
}

/* Remove outline for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

#### 2. Skip Navigation Link

**Purpose**: Allow keyboard users to skip to main content.

**Implementation**:
```tsx
<a 
  href="#main-content" 
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-brand-600 text-white px-4 py-2 rounded z-50"
>
  Skip to main content
</a>
```

#### 3. Focus Trap in Modals

Modals should trap focus within their content when open.

**Implementation Pattern**:
```tsx
useEffect(() => {
  if (isOpen) {
    const modal = modalRef.current;
    const focusableElements = modal?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    // Focus first element
    focusableElements?.[0]?.focus();
    
    // Handle Tab key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        // Trap focus logic
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }
}, [isOpen, onClose]);
```

---

## Screen Reader Support

### ARIA Patterns

#### 1. Live Regions

**Error Announcements** (Immediate):
```tsx
<div role="alert" aria-live="assertive" className="sr-only">
  Form submission failed: {errorMessage}
</div>
```

**Status Updates** (Polite):
```tsx
<div role="status" aria-live="polite" className="sr-only">
  Strategy saved successfully
</div>
```

#### 2. Semantic Roles

| Element | Role | Usage |
|---------|------|-------|
| Charts | `role="img"` | With `aria-label` describing data |
| Loading | `role="status"` | With `aria-busy="true"` |
| Dialogs | `role="dialog"` | With `aria-modal="true"` |
| Navigation | `role="navigation"` | For sidebar/menu |
| Tabs | `role="tablist"` | Container for tabs |
| Tab | `role="tab"` | Individual tab |
| Tab Panel | `role="tabpanel"` | Tab content area |

#### 3. Screen Reader Only Content

**CSS Utility** (in `index.html`):
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

#### 4. Icon Accessibility

All decorative icons must be hidden from screen readers:

```tsx
<svg aria-hidden="true" focusable="false">
  {/* Icon content */}
</svg>
```

Interactive icons must have descriptive labels:

```tsx
<button aria-label="Delete strategy EMA Crossover">
  <svg aria-hidden="true">...</svg>
</button>
```

---

## Form Accessibility

### Label Association

**Required Pattern**:
```tsx
<label htmlFor="input-id">Label Text</label>
<input id="input-id" aria-describedby="input-help" />
<p id="input-help">Helpful description</p>
```

### Error Handling

**Pattern**:
```tsx
<div>
  <label htmlFor="email" className={error ? 'text-red-500' : ''}>
    Email {required && <span aria-label="required">*</span>}
  </label>
  <input
    id="email"
    type="email"
    aria-invalid={!!error}
    aria-describedby={error ? 'email-error' : 'email-help'}
    aria-required={required}
    autoComplete="email"
  />
  {error && (
    <p id="email-error" role="alert" className="text-red-500">
      {error}
    </p>
  )}
  <p id="email-help">We'll never share your email</p>
</div>
```

### AutoComplete Attributes

Use appropriate `autoComplete` values for better browser support:

| Field | autoComplete Value |
|-------|-------------------|
| Email | `email` |
| Password | `current-password` / `new-password` |
| Name | `name` |
| Strategy Name | `off` (custom field) |

---

## Toast & Notification Accessibility

### Implementation Pattern

**Location**: `components/Toast.tsx`

**Features**:
- `aria-live` regions for announcements
- Keyboard dismissal (Escape key)
- Focus management
- Role-based semantics

```tsx
<div 
  role="alert"
  aria-live="assertive"  // For errors
  // aria-live="polite"  // For success/info
>
  <span className="sr-only">{type}:</span>
  {message}
  <button aria-label="Dismiss notification">×</button>
</div>
```

### Priority Levels

| Type | aria-live | Use Case |
|------|-----------|----------|
| Error | `assertive` | Immediate attention required |
| Warning | `polite` | Important but not blocking |
| Success | `polite` | Confirmation messages |
| Info | `polite` | General updates |

---

## Chart Accessibility

### Implementation

**Location**: `components/ChartComponents.tsx`

**Requirements**:
1. **ARIA Labels**: Describe chart purpose and data
2. **Data Tables**: Provide accessible data representation
3. **Dynamic Announcements**: Announce data changes
4. **Semantic Structure**: Proper heading hierarchy

**Pattern**:
```tsx
<div role="img" aria-label="Equity curve chart showing 15% return over 30 days">
  <ResponsiveContainer>
    <LineChart data={data}>
      {/* Chart components */}
    </LineChart>
  </ResponsiveContainer>
</div>

{/* Accessible data table for screen readers */}
<table className="sr-only">
  <caption>Equity Curve Data</caption>
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

---

## Performance Considerations

### React Optimization

#### 1. Memoization

Use `React.memo` for components that receive stable props:

```tsx
export const Layout = memo(({ session }) => {
  // Component logic
});
```

#### 2. Stable References

Use `useMemo` for expensive calculations and `useCallback` for stable function references:

```tsx
const navItems = useMemo(() => [
  { name: 'Dashboard', path: '/' },
  // ...
], []); // Empty deps for stable reference

const handleClick = useCallback(() => {
  // Handler logic
}, [deps]);
```

### Lazy Loading

Implement lazy loading for non-critical components:

```tsx
const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

### Virtual Scrolling

For long lists (chat messages, robot lists), use virtual scrolling:

```tsx
const visibleMessages = useMemo(() => {
  const VIEWPORT_SIZE = 20;
  const BUFFER_SIZE = 10;
  const WINDOW_SIZE = VIEWPORT_SIZE + (BUFFER_SIZE * 2);
  
  if (messages.length <= WINDOW_SIZE) {
    return messages;
  }
  
  const startIndex = Math.max(0, messages.length - WINDOW_SIZE);
  return messages.slice(startIndex, startIndex + WINDOW_SIZE);
}, [messages]);
```

---

## Common UI/UX Issues & Fixes

### Issue Reference Table

| ID | Component | Issue | Fix | Status |
|----|-----------|-------|-----|--------|
| ui-001 | StrategyConfig | Missing reusable FormField | Created FormField component | ✅ |
| ui-002 | StrategyConfig | No keyboard navigation | Added CustomInputRow with arrow keys | ✅ |
| ui-003 | Global | Missing focus indicators | Added global :focus-visible styles | ✅ |
| ui-004 | Layout | Mobile menu lacks scroll lock | Added body overflow hidden | ✅ |
| ui-005 | Forms | No ARIA announcements | Created announcer utility | ✅ |
| ui-006 | Charts | Missing ARIA labels | Added role="img" + labels | ✅ |
| ui-007 | Charts | No accessible data tables | Added sr-only tables | ✅ |
| ui-008 | Charts | Missing aria-live | Added live regions | ✅ |
| ui-009 | Charts | Decorative elements exposed | Added aria-hidden | ✅ |
| ui-010 | Toast | Incorrect aria-live | Fixed to assertive for errors | ✅ |
| ui-011 | Toast | Missing keyboard focus | Added focus management | ✅ |
| ui-012 | Toast | Missing context labels | Added descriptive labels | ✅ |
| ui-013 | Toast | Touch targets too small | Increased to 44x44px | ✅ |
| ui-014 | LoadingState | Missing role="status" | Added role and aria-live | ✅ |
| ui-015 | LoadingState | Missing aria-live | Added polite announcements | ✅ |
| ui-016 | LoadingState | Missing aria-busy | Added aria-busy="true" | ✅ |
| ui-017 | LoadingState | No aria-label | Added customizable label | ✅ |
| ui-018 | Auth | Using `any` type in catch | Changed to `unknown` | ✅ |
| ui-019 | Auth | Labels not associated | Added htmlFor attributes | ✅ |
| ui-020 | Auth | Missing autoComplete | Added appropriate values | ✅ |
| ui-021 | Auth | Missing aria-busy | Added during loading | ✅ |
| ui-022 | Auth | Button text not announced | Added sr-only text | ✅ |
| ui-023 | Auth | Toggle button submits form | Added type="button" | ✅ |
| ui-024 | RobotCard | Decorative icons exposed | Added aria-hidden | ✅ |
| ui-025 | RobotCard | Duplicate button no context | Added aria-label | ✅ |
| ui-026 | RobotCard | Delete button no context | Added aria-label | ✅ |
| ui-027 | CodeEditor | Edit toggle no aria-label | Added dynamic label | ✅ |
| ui-028 | CodeEditor | Refine button no aria-label | Added aria-label | ✅ |
| ui-029 | CodeEditor | Explain button no aria-label | Added aria-label | ✅ |
| ui-030 | CodeEditor | Font size controls no label | Added aria-label | ✅ |
| ui-031 | CodeEditor | Word wrap no announcement | Added state announcement | ✅ |
| ui-032 | CodeEditor | Copy button no state | Added dynamic label | ✅ |
| ui-033 | CodeEditor | Download button no label | Added aria-label | ✅ |
| ui-034 | VirtualScrollList | Inconsistent logging | Fixed logger usage | ✅ |
| ui-035 | VirtualScrollList | Using `Record<any>` | Changed to proper types | ✅ |
| ui-036 | VirtualScrollList | Clear filters no aria-label | Added aria-label | ✅ |
| ui-037 | AISettingsModal | Using `any` for errors | Changed to `unknown` | ✅ |
| ui-038 | Dashboard | Filter dropdown no aria-label | Added aria-label | ✅ |
| ui-039 | BacktestPanel | Run/Export no aria attrs | Added aria-label | ✅ |
| ui-040 | Generator | Mobile tabs no ARIA roles | Added tab roles | ✅ |
| ui-041 | Global | No keyboard shortcuts help | Created KeyboardShortcutsModal | ✅ |
| ui-042 | cacheLayer.ts | Unreachable code in getCacheStats | Removed unnecessary try-catch | ✅ |
| ui-043 | recommendationEngine.ts | Unreachable code in analyzeQueries | Removed unnecessary try-catch | ✅ |
| ui-044 | modularBackendOptimizationManager.ts | Unreachable code in getQueryOptimizationRecommendations | Removed unnecessary try-catch | ✅ |
| ui-045 | supabase/index.ts | Unreachable code in getConnectionState | Removed unnecessary try-catch | ✅ |
| ui-046 | VirtualScrollList | RobotCard buttons missing aria-label | Added aria-label with robot name context | ✅ |
| ui-047 | VirtualScrollList | RobotCard icons not hidden from screen readers | Added aria-hidden="true" to icons | ✅ |
| ui-048 | StrategyConfig | Header buttons missing aria-label | Added aria-label to Reset, Import, Copy buttons | ✅ |
| ui-049 | StrategyConfig | Add input button icon not hidden | Added aria-hidden="true" to icon | ✅ |
| ui-050 | DatabaseSettingsModal | Close button missing aria-label | Added aria-label="Close database settings" | ✅ |
| ui-051 | DatabaseSettingsModal | Close icon not hidden from screen readers | Added aria-hidden="true" to icon | ✅ |
| ui-052 | AISettingsModal | Close button missing aria-label | Added aria-label="Close AI settings" | ✅ |
| ui-053 | AISettingsModal | Close icon not hidden from screen readers | Added aria-hidden="true" to icon | ✅ |

---

## Tools & Resources

### Testing Tools

1. **Browser DevTools**
   - Accessibility panel (Chrome/Firefox)
   - Lighthouse audits
   - Color contrast checker

2. **Screen Readers**
   - NVDA (Windows) - Free
   - JAWS (Windows) - Commercial
   - VoiceOver (macOS/iOS) - Built-in
   - TalkBack (Android) - Built-in

3. **Automated Testing**
   - jest-axe for unit tests
   - @axe-core/react for development
   - Lighthouse CI for CI/CD

### Documentation Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [React Accessibility Docs](https://reactjs.org/docs/accessibility.html)

### Design Resources

- **Color Contrast**: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- **Touch Target Size**: [Material Design Guidelines](https://material.io/design/layout/spacing-methods.html#touch-targets)
- **Focus Indicators**: [WCAG Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)

---

## Best Practices Summary

### Do's ✅

- Use semantic HTML elements
- Associate labels with form inputs (`htmlFor`)
- Provide alternative text for images
- Ensure keyboard accessibility
- Test with screen readers
- Use ARIA live regions for dynamic content
- Maintain focus indicators
- Use proper heading hierarchy
- Test at 200% zoom level
- Use `aria-hidden` for decorative elements

### Don'ts ❌

- Use `onClick` on non-interactive elements
- Remove focus indicators entirely
- Use color alone to convey information
- Trap keyboard users without escape
- Auto-play audio/video without controls
- Use `tabindex` > 0
- Skip heading levels
- Rely solely on hover for interactions
- Use placeholder text as labels
- Forget to test with keyboard-only navigation

---

## Contributing

When making UI/UX changes:

1. **Test accessibility** using keyboard navigation and screen readers
2. **Verify mobile** responsiveness at various breakpoints
3. **Check performance** impact with React DevTools Profiler
4. **Update this document** with any new patterns or fixes
5. **Add test cases** for accessibility features
6. **Follow the established patterns** in existing components

---

## Contact

For UI/UX questions or issues:
- Create an issue with the `ui/ux` label
- Reference specific WCAG guidelines when applicable
- Include screenshots or recordings for visual issues
- Test on multiple devices/browsers when possible

---

**Document Version**: 1.1
**Last Updated**: 2026-02-07
**Next Review**: 2026-03-07
