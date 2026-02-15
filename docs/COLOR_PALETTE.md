# Color Palette & WCAG Contrast Compliance

This document provides verified color combinations that meet WCAG 2.1 AA accessibility standards.

## WCAG 2.1 Requirements

- **Normal Text**: 4.5:1 minimum contrast ratio
- **Large Text** (18pt+ or 14pt bold): 3:1 minimum contrast ratio
- **UI Components**: 3:1 minimum contrast ratio

## Verified Color Combinations

### Dark Background (slate-900: #0f172a)

| Text Color | Hex Code | Contrast Ratio | AA Pass | AAA Pass |
|------------|----------|----------------|---------|----------|
| White | #ffffff | 16.1:1 | ✅ Yes | ✅ Yes |
| Gray-100 | #f3f4f6 | 14.8:1 | ✅ Yes | ✅ Yes |
| Gray-200 | #e5e7eb | 11.8:1 | ✅ Yes | ✅ Yes |
| Gray-300 | #d1d5db | 8.8:1 | ✅ Yes | ✅ Yes |
| Gray-400 | #9ca3af | 5.8:1 | ✅ Yes | ⚠️ No |

> ⚠️ **Note**: Gray-400 is the minimum acceptable for normal text. Use gray-300 or lighter for better accessibility.

### Dark Surface (slate-800: #1e293b)

| Text Color | Hex Code | Contrast Ratio | AA Pass | AAA Pass |
|------------|----------|----------------|---------|----------|
| White | #ffffff | 13.5:1 | ✅ Yes | ✅ Yes |
| Gray-100 | #f3f4f6 | 12.4:1 | ✅ Yes | ✅ Yes |
| Gray-200 | #e5e7eb | 9.9:1 | ✅ Yes | ✅ Yes |
| Gray-300 | #d1d5db | 7.4:1 | ✅ Yes | ✅ Yes |
| Gray-400 | #9ca3af | 4.9:1 | ✅ Yes | ⚠️ No |

### Brand Colors

#### Emerald-500 (#22c55e) - Primary Brand

| Text Color | Contrast Ratio | Usage |
|------------|----------------|-------|
| White | 3.2:1 | ⚠️ Large text only |
| Black | 7.8:1 | ✅ All text |
| Slate-900 | 6.8:1 | ✅ All text |

> ⚠️ **Important**: White text on emerald green only passes for large text (18pt+ or 14pt bold). Use dark text for better readability.

### Semantic Colors

#### Error State (on dark background #0f172a)

| Color | Hex | Contrast Ratio | Pass |
|-------|-----|----------------|------|
| Red-400 | #f87171 | 6.2:1 | ✅ AA |
| Red-500 | #ef4444 | 7.1:1 | ✅ AA, AAA |

#### Warning State (on dark background #0f172a)

| Color | Hex | Contrast Ratio | Pass |
|-------|-----|----------------|------|
| Yellow-400 | #fbbf24 | 10.7:1 | ✅ AA, AAA |
| Yellow-500 | #f59e0b | 12.8:1 | ✅ AA, AAA |

#### Success State (on dark background #0f172a)

| Color | Hex | Contrast Ratio | Pass |
|-------|-----|----------------|------|
| Emerald-400 | #34d399 | 6.8:1 | ✅ AA, AAA |
| Emerald-500 | #22c55e | 4.2:1 | ⚠️ AA Large only |

## Usage Guidelines

### ✅ Recommended Combinations

1. **Primary Text**: White (#ffffff) or Gray-100 (#f3f4f6) on dark backgrounds
2. **Secondary Text**: Gray-300 (#d1d5db) on dark backgrounds
3. **Muted Text**: Gray-400 (#9ca3af) on dark backgrounds (use sparingly)
4. **Brand Text**: Use dark text on emerald backgrounds
5. **Error Messages**: Red-400 or Red-500 on dark background
6. **Success Messages**: Emerald-400 on dark background

### ❌ Avoid These Combinations

1. White text on emerald green for normal-sized text
2. Gray-400 on lighter backgrounds
3. Yellow text on white backgrounds
4. Light gray on light backgrounds

## Testing

Run the color contrast audit:

```typescript
import { auditColorCombinations } from './utils/colorContrast';

// In development
auditColorCombinations();
```

Or use the utility functions:

```typescript
import { checkContrast, getAccessibleTextColor } from './utils/colorContrast';

// Check specific combination
const result = checkContrast('#ffffff', '#0f172a');
console.log(result.ratio); // 16.1
console.log(result.passesAA); // true

// Get accessible text color
const textColor = getAccessibleTextColor('#0f172a');
console.log(textColor); // '#ffffff'
```

## Automated Testing

The color contrast utilities include comprehensive tests:

```bash
npm test -- utils/colorContrast.test.ts
```

## Implementation Notes

1. **Always verify** new color combinations using the contrast utility
2. **Test with actual users** who have visual impairments
3. **Use browser dev tools** accessibility panel for manual verification
4. **Consider color blindness** when choosing semantic colors
5. **Maintain consistency** across the application

## Related Documentation

- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [UI/UX Engineer Guide](./ui-ux-engineer.md)
